"""
FastAPI ana uygulama.

/api/v1/scan tetiklendiğinde XposedOrNot, LeakIX ve AlienVault OTX
servislerini PARALEL olarak sorgular, sonuçları ortak NormalizedLeak
şemasına göre tek listede birleştirir, (asset, email_leak, leak_type,
raw_source) kombinasyonuna göre veritabanında zaten var olan kayıtları
ELER ve SADECE GERÇEKTEN YENİ olan kayıtları veritabanına yazar. Yeni kayıt
varsa Telegram/Slack bildirimi tetiklenir.

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


@app.get("/api/v1/leaks")
def get_leaks(db: Session = Depends(get_db)):
    """Veritabanındaki tüm sızıntı kayıtlarını döner."""
    return db.query(BreachLog).order_by(BreachLog.id.desc()).all()


@app.get("/api/v1/scan")
async def scan(email: str, db: Session = Depends(get_db)):
    """
    Verilen e-posta için XposedOrNot, LeakIX ve AlienVault OTX servislerini
    PARALEL sorgular, mükerrer kayıtları eleyip SADECE YENİ olanları
    veritabanına kaydeder, yeni kayıt varsa bildirim gönderir ve bu taramada
    eklenen kayıtları döner.
    """
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Geçerli bir e-posta adresi girin.")

    domain = email.split("@")[-1]

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

    # --- 2. Mükerrer kayıtları ele ---
    # Bu taramada bulunan adaylardan oluşan anahtar seti üzerinden DB'de
    # zaten var olanları TEK sorguda çekip Python tarafında karşılaştırıyoruz
    # (tüm tabloyu taramak yerine sadece ilgili asset'lere bakılır).
    candidate_assets = {item.asset for item in all_results}
    existing_rows = (
        db.query(
            BreachLog.asset,
            BreachLog.email_leak,
            BreachLog.leak_type,
            BreachLog.raw_source,
        )
        .filter(BreachLog.asset.in_(candidate_assets))
        .all()
    )
    existing_keys = {
        _dedup_key(row.asset, row.email_leak, row.leak_type, row.raw_source)
        for row in existing_rows
    }

    new_results: List[NormalizedLeak] = []
    for item in all_results:
        key = _dedup_key(item.asset, item.email_leak, item.leak_type, item.raw_source)
        if key in existing_keys:
            continue
        # Aynı taramada birden fazla kaynaktan gelen birebir aynı kayıt
        # tekrar eklenmesin diye anahtarı hemen sete ekliyoruz.
        existing_keys.add(key)
        new_results.append(item)

    if not new_results:
        logger.info("Tarama tamamlandı, ancak tüm sonuçlar zaten kayıtlıydı (email=%s).", email)
        return []

    # --- 3. Sadece yeni kayıtları veritabanına yaz ---
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

