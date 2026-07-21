"""
FastAPI ana uygulama.

/api/v1/scan tetiklendiğinde:
  1) Veritabanındaki TÜM eski kayıtlar silinir (temiz sayfa),
  2) XposedOrNot, LeakIX ve AlienVault OTX servisleri PARALEL olarak sorgulanır,
  3) Sonuçlar ortak NormalizedLeak şemasına göre tek listede birleştirilir,
  4) Aynı taramada birden fazla kaynaktan gelen birebir aynı kayıtlar
     (asset, email_leak, leak_type, raw_source) bazında tekilleştirilir,
  5) Kalan kayıtlar veritabanına yazılır ve Telegram/Slack bildirimi tetiklenir.

Ayrıca /api/v1/leaks/clear endpoint'i ile (örn. frontend ilk açılışta / F5'te)
veritabanı istenildiği zaman elle temizlenebilir.

NOT: Bu dosya, sizin mevcut main.py'nizin YERİNE GEÇECEK şekilde tam olarak
yazılmıştır ama kendi xposed_service.py fonksiyon adınızla (aşağıda
`_safe_xposed_check` içinde işaretlenmiştir) uyumlu hale getirmeniz gerekir.
"""

import asyncio
import logging
from typing import List, Tuple

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import BreachLog
from schemas import NormalizedLeak
from services import leakix_service, notification_service, otx_service
from services.xposed_adapter import normalize_xposed_results

# Kendi xposed_service.py dosyanızı import edin.
# Fonksiyon adı farklıysa (örn. `scan_email`, `search_xposed`) aşağıdaki
# `xposed_service.check_email(...)` çağrısını buna göre güncelleyin.
import xposed_service  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Dark Web Leak Monitoring API")

# Next.js frontend'in (localhost:3000) API'ye erişebilmesi için.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dedup anahtarı: (asset, email_leak, leak_type, raw_source)
DedupKey = Tuple[str, str, str, str]


def _dedup_key(asset: str, email_leak: str, leak_type: str, raw_source) -> DedupKey:
    """Karşılaştırmayı tutarlı yapmak için None -> '' normalize edilir."""
    return (asset or "", email_leak or "", leak_type or "", raw_source or "")


def _clear_all_leaks(db: Session) -> int:
    """Veritabanındaki tüm BreachLog kayıtlarını siler ve silinen satır sayısını döner."""
    deleted_count = db.query(BreachLog).delete()
    db.commit()
    return deleted_count


@app.get("/api/v1/leaks")
def get_leaks(db: Session = Depends(get_db)):
    """Veritabanındaki tüm sızıntı kayıtlarını döner (yalnızca en son taramaya ait olmalıdır)."""
    return db.query(BreachLog).order_by(BreachLog.id.desc()).all()


@app.delete("/api/v1/leaks/clear")
def clear_leaks(db: Session = Depends(get_db)):
    """
    Veritabanındaki tüm sızıntı kayıtlarını temizler.
    Frontend ilk açıldığında veya sayfa yenilendiğinde (F5) eski verilerin
    ekrana dolmasını engellemek için çağrılır.
    """
    deleted_count = _clear_all_leaks(db)
    logger.info("Veritabanı temizlendi, silinen kayıt sayısı: %s", deleted_count)
    return {"detail": "Veritabanı temizlendi.", "deleted_count": deleted_count}


@app.get("/api/v1/scan")
async def scan(email: str, db: Session = Depends(get_db)):
    """
    Verilen e-posta için taramaya başlamadan önce veritabanındaki TÜM eski
    kayıtları siler (temiz sayfa), ardından XposedOrNot, LeakIX ve AlienVault
    OTX servislerini PARALEL sorgular, aynı taramadaki mükerrer kayıtları
    eleyip kalanları veritabanına kaydeder, yeni kayıt varsa bildirim
    gönderir ve bu taramada eklenen kayıtları döner.
    """
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Geçerli bir e-posta adresi girin.")

    domain = email.split("@")[-1]

    # --- 0. Yeni taramaya başlamadan önce veritabanını tamamen sıfırla ---
    # İstenen davranış: veritabanında eski aramaların birikmemesi, her zaman
    # sadece O AN yapılan aramanın taze sonuçlarının bulunması.
    deleted_count = _clear_all_leaks(db)
    logger.info(
        "Yeni tarama öncesi veritabanı sıfırlandı (email=%s), silinen kayıt sayısı: %s",
        email,
        deleted_count,
    )

    # --- 1. Üç servisi paralel çağır ---
    # return_exceptions=True: bir servis çökerse diğerlerini etkilemesin.
    xposed_raw, leakix_results, otx_results = await asyncio.gather(
        _safe_xposed_check(email),
        leakix_service.search_leakix(domain),
        otx_service.search_otx(domain, email),
        return_exceptions=True,
    )

    all_results: List[NormalizedLeak] = []

    if isinstance(xposed_raw, Exception):
        logger.error("XposedOrNot sorgusu hata verdi: %s", xposed_raw)
    else:
        all_results.extend(normalize_xposed_results(xposed_raw, email))

    if isinstance(leakix_results, Exception):
        logger.error("LeakIX sorgusu hata verdi: %s", leakix_results)
    else:
        all_results.extend(leakix_results)

    if isinstance(otx_results, Exception):
        logger.error("OTX sorgusu hata verdi: %s", otx_results)
    else:
        all_results.extend(otx_results)

    if not all_results:
        return []

    # --- 2. Bu taramadaki mükerrer kayıtları ele ---
    # Veritabanı bu noktada zaten boş olduğu için (üstteki 0. adımda
    # sıfırlandı), artık eski kayıtlarla karşılaştırma yapmaya gerek yok;
    # sadece bu taramanın kendi içindeki (örn. birden fazla kaynaktan gelen
    # birebir aynı kayıt) mükerrerliği önlüyoruz.
    seen_keys: set = set()
    new_results: List[NormalizedLeak] = []
    for item in all_results:
        key = _dedup_key(item.asset, item.email_leak, item.leak_type, item.raw_source)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        new_results.append(item)

    if not new_results:
        logger.info("Tarama tamamlandı ancak işlenecek sonuç bulunamadı (email=%s).", email)
        return []

    # --- 3. Bu taramanın sonuçlarını veritabanına yaz ---
    db_objects = [
        BreachLog(
            asset=item.asset,
            email_leak=item.email_leak,
            leaked_password=item.leaked_password,
            leak_type=item.leak_type,
            market=item.market,
            last_seen=item.last_seen,
            certainty=item.certainty,
            status=item.status,
            priority=item.priority,
            discovery_date=item.discovery_date,
            raw_source=item.raw_source or "",
        )
        for item in new_results
    ]

    db.add_all(db_objects)
    db.commit()
    for obj in db_objects:
        db.refresh(obj)

    # --- 4. Yeni kayıt bulunduğu için bildirim gönder ---
    await notification_service.send_leak_alert(db_objects)

    return db_objects


async def _safe_xposed_check(email: str) -> list:
    """
    Mevcut xposed_service.py fonksiyonunuzu çağırır.
    Fonksiyon adı farklıysa burayı güncelleyin (örn. xposed_service.scan_email).
    """
    return await xposed_service.check_email(email)
