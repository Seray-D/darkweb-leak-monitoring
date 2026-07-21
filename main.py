"""
FastAPI ana uygulama.

/api/v1/scan tetiklendiğinde:
  1) Veritabanındaki TÜM eski kayıtlar silinir (temiz sayfa),
  2) XposedOrNot, LeakIX, AlienVault OTX ve BreachDirectory servisleri PARALEL olarak sorgulanır,
  3) Sonuçlar ortak NormalizedLeak şemasına göre tek listede birleştirilir,
  4) Aynı taramada birden fazla kaynaktan gelen birebir aynı kayıtlar
     (asset, email_leak, leak_type, raw_source) bazında tekilleştirilir,
  5) Kalan kayıtlar veritabanına yazılır ve Telegram/Slack bildirimi tetiklenir.

Ayrıca /api/v1/leaks/clear endpoint'i ile (örn. frontend ilk açılışta / F5'te)
veritabanı istenildiği zaman elle temizlenebilir.

/api/v1/leaks/search-domain endpoint'i ise yeni bir tarama tetiklemeden,
veritabanındaki mevcut kayıtları verilen bir domain'e göre (asset ve
email_leak alanlarında, case-insensitive) filtreler. Girdi "http://",
"https://", "www." veya baştaki "@" gibi eklerden otomatik arındırılır.
"""

import asyncio
import logging
import os
import re
from typing import List, Tuple
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session
from database import Base, engine, get_db
from models import BreachLog
from schemas import NormalizedLeak
from services import (
    breachdirectory_service,
    leakix_service,
    notification_service,
    otx_service,
    xposed_service,
)
from services.xposed_adapter import normalize_xposed_results

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def _log_configured_api_keys() -> None:
    """
    Sunucu açılışında hangi opsiyonel API key'lerinin .env'den okunduğunu
    (maskelenmiş şekilde) loglar. Böylece "veri hiç gelmiyor" sorunlarının
    en sık nedeni olan boş/eksik .env değeri, ilk taramayı beklemeden
    başlangıçta terminalde görünür.
    """
    keys_to_check = ("RAPIDAPI_KEY", "LEAKIX_API_KEY", "OTX_API_KEY")
    for key_name in keys_to_check:
        value = os.getenv(key_name, "").strip()
        if value:
            logger.info("✅ %s tanımlı (%s...)", key_name, value[:4])
        else:
            logger.warning(
                "⚠️ %s tanımlı DEĞİL veya boş — .env dosyasını ve çalışma dizinini kontrol edin.",
                key_name,
            )


_log_configured_api_keys()

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


def _extract_domain(raw: str) -> str:
    """
    Kullanıcının domain arama kutusuna girdiği serbest metni saf bir domain'e
    indirger. Aşağıdaki durumları otomatik temizler:
      - baştaki/sondaki boşluklar
      - "http://" / "https://" öneki
      - baştaki "@" işareti (örn. "@izmir.bel.tr")
      - girilen değer tam bir e-posta ise ("info@izmir.bel.tr") @ sonrası alınır
      - "www." öneki
      - URL'in path/query kısmı (örn. "izmir.bel.tr/giris?x=1" -> "izmir.bel.tr")
    Sonuç küçük harfe çevrilir (case-insensitive arama için).
    """
    value = (raw or "").strip()
    if not value:
        return ""

    value = re.sub(r"^https?://", "", value, flags=re.IGNORECASE)

    if "@" in value:
        # "@izmir.bel.tr" ya da "info@izmir.bel.tr" -> "izmir.bel.tr"
        value = value.split("@")[-1]

    value = re.sub(r"^www\.", "", value, flags=re.IGNORECASE)

    # Path / query / port kısmını at, sadece host kısmını bırak.
    value = value.split("/")[0].split("?")[0].split(":")[0]

    return value.strip().strip(".").lower()


def _clear_all_leaks(db: Session) -> int:
    """Veritabanındaki tüm BreachLog kayıtlarını siler ve silinen satır sayısını döner."""
    deleted_count = db.query(BreachLog).delete()
    db.commit()
    return deleted_count


@app.get("/api/v1/leaks")
def get_leaks(db: Session = Depends(get_db)):
    """Veritabanındaki tüm sızıntı kayıtlarını döner (yalnızca en son taramaya ait olmalıdır)."""
    return db.query(BreachLog).order_by(BreachLog.id.desc()).all()


@app.get("/api/v1/leaks/search-domain")
def search_domain_leaks(domain: str, db: Session = Depends(get_db)):
    """
    Verilen domain'e göre veritabanındaki kayıtları filtreler.

    - Girdi ("http://", "https://", "www.", baştaki "@" gibi eklerden)
      otomatik temizlenip saf domain'e indirgenir (bkz. _extract_domain).
    - `asset` (örn. vpn.izmir.bel.tr) veya `email_leak` (örn.
      aliguzel@izmir.bel.tr) alanlarından herhangi birinde bu domain
      GEÇEN (substring) tüm kayıtlar döner.
    - Karşılaştırma case-insensitive'dir (ILIKE).

    Not: Bu endpoint yeni bir tarama TETİKLEMEZ; mevcut veritabanı
    kayıtları üzerinde filtreleme yapar. Belirli bir domain için canlı
    kaynak taraması isteniyorsa /api/v1/scan?email=... kullanılmalıdır.
    """
    cleaned_domain = _extract_domain(domain)
    if not cleaned_domain:
        raise HTTPException(status_code=400, detail="Geçerli bir domain girin.")

    like_pattern = f"%{cleaned_domain}%"
    results = (
        db.query(BreachLog)
        .filter(
            or_(
                BreachLog.asset.ilike(like_pattern),
                BreachLog.email_leak.ilike(like_pattern),
            )
        )
        .order_by(BreachLog.id.desc())
        .all()
    )

    logger.info(
        "Domain araması: girdi='%s', temizlenmiş='%s' -> %s kayıt bulundu.",
        domain,
        cleaned_domain,
        len(results),
    )
    return results


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
    kayıtları siler (temiz sayfa), ardından XposedOrNot, LeakIX, AlienVault
    OTX ve BreachDirectory servislerini PARALEL sorgular, aynı taramadaki mükerrer kayıtları
    eleyip kalanları veritabanına kaydeder, yeni kayıt varsa bildirim
    gönderir ve bu taramada eklenen kayıtları döner.
    """
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Geçerli bir e-posta adresi girin.")

    domain = email.split("@")[-1]

    # --- 0. Yeni taramaya başlamadan önce veritabanını tamamen sıfırla ---
    deleted_count = _clear_all_leaks(db)
    logger.info(
        "Yeni tarama öncesi veritabanı sıfırlandı (email=%s), silinen kayıt sayısı: %s",
        email,
        deleted_count,
    )

    # --- 1. Dört servisi paralel çağır ---
    xposed_raw, leakix_results, otx_results, bd_results = await asyncio.gather(
        _safe_xposed_check(email),
        leakix_service.search_leakix(domain),
        otx_service.search_otx(domain, email),
        breachdirectory_service.search_breachdirectory(email),
        return_exceptions=True,
    )

    all_results: List[NormalizedLeak] = []

    if isinstance(xposed_raw, Exception):
        logger.error("XposedOrNot sorgusu hata verdi: %s", xposed_raw)
    else:
        xposed_normalized = normalize_xposed_results(xposed_raw, email)
        logger.info("XposedOrNot: %s ham kayıt -> %s normalize edilmiş kayıt", len(xposed_raw or []), len(xposed_normalized))
        all_results.extend(xposed_normalized)

    if isinstance(leakix_results, Exception):
        logger.error("LeakIX sorgusu hata verdi: %s", leakix_results)
    else:
        logger.info("LeakIX: %s kayıt bulundu", len(leakix_results))
        all_results.extend(leakix_results)

    if isinstance(otx_results, Exception):
        logger.error("OTX sorgusu hata verdi: %s", otx_results)
    else:
        logger.info("AlienVault OTX: %s kayıt bulundu", len(otx_results))
        all_results.extend(otx_results)

    if isinstance(bd_results, Exception):
        logger.error("BreachDirectory sorgusu hata verdi: %s", bd_results)
    else:
        logger.info("BreachDirectory: %s kayıt bulundu", len(bd_results))
        all_results.extend(bd_results)

    logger.info("Tüm kaynaklardan toplam %s ham kayıt birleştirildi (email=%s).", len(all_results), email)

    if not all_results:
        return []

    # --- 2. Bu taramadaki mükerrer kayıtları ele ---
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
    services/xposed_service.py içerisindeki check_email fonksiyonunu çağırır.
    """
    return await xposed_service.check_email(email)