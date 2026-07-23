"""
FastAPI ana uygulama.

/api/v1/scan tetiklendiğinde:
  1) Veritabanındaki TÜM eski kayıtlar silinir (temiz sayfa),
  2) Target e-posta ise doğrudan, domain ise kurumsal e-posta kalıpları (info@, admin@ vb.) ile birlikte
     XposedOrNot, LeakIX, AlienVault OTX ve BreachDirectory servisleri PARALEL olarak sorgulanır,
  3) Sonuçlar ortak NormalizedLeak şemasına göre tek listede birleştirilir,
  4) Aynı taramada birden fazla kaynaktan gelen birebir aynı kayıtlar
     (asset, email_leak, leak_type, raw_source, discovery_date) bazında tekilleştirilir,
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

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from database import Base, SessionLocal, engine, get_db
from models import AssetBreachLog, BreachLog, MonitoredAsset
from schemas import MonitoredAssetCreate, MonitoredAssetOut, NormalizedLeak
from services import (
    breachdirectory_service,
    crtsh_service,
    dns_service,
    leakix_service,
    notification_service,
    otx_service,
    xposed_service,
)
from services.xposed_adapter import normalize_xposed_results
from services.otx_service import search_otx

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def _log_configured_api_keys() -> None:
    """
    Sunucu açılışında hangi opsiyonel API key'lerinin .env'den okunduğunu
    (maskelenmiş şekilde) loglar.
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


@app.get("/api/v1/test-otx/{domain}")
async def test_otx_endpoint(domain: str):
    """AlienVault OTX servisini test etmek için geçici endpoint."""
    results = await search_otx(domain)
    return {
        "service": "AlienVault OTX",
        "domain": domain,
        "total_pulses_found": len(results),
        "results": results,
    }


@app.get("/api/v1/test-leakix/{domain}")
async def test_leakix_endpoint(domain: str):
    """LeakIX servisini test etmek için geçici endpoint."""
    results = await leakix_service.search_leakix(domain)
    return {
        "service": "LeakIX",
        "domain": domain,
        "count": len(results),
        "results": results,
    }


@app.get("/api/v1/test-xposed/{email}")
async def test_xposed_endpoint(email: str):
    """XposedOrNot servisini test etmek için geçici endpoint."""
    raw_data = await xposed_service.check_email(email)
    normalized = normalize_xposed_results(raw_data, email)
    return {
        "service": "XposedOrNot",
        "email": email,
        "raw_response": raw_data,
        "normalized_count": len(normalized),
        "results": normalized,
    }


@app.get("/api/v1/test-breachdirectory/{email}")
async def test_breachdirectory_endpoint(email: str):
    """BreachDirectory servisini test etmek için geçici endpoint."""
    results = await breachdirectory_service.search_breachdirectory(email)
    return {
        "service": "BreachDirectory",
        "email": email,
        "count": len(results),
        "results": results,
    }


@app.get("/api/v1/osint/subdomains/{domain}")
async def get_subdomains(domain: str):
    """
    Pasif Subdomain Keşfi (crt.sh / Certificate Transparency Logs).

    Verilen domain için crt.sh'de kayıtlı geçmiş SSL sertifikalarındaki
    alt alan adlarını listeler. HİÇBİR DNS sorgusu veya domain sahiplik
    doğrulaması YAPILMAZ — tamamen pasif, ücretsiz bir OSINT kaynağıdır.
    """
    cleaned_domain = _extract_domain(domain)
    if not cleaned_domain:
        raise HTTPException(status_code=400, detail="Geçerli bir domain girin.")

    subdomains = await crtsh_service.search_crtsh(cleaned_domain)

    return {
        "domain": cleaned_domain,
        "source": "crt.sh",
        "count": len(subdomains),
        "subdomains": subdomains,
    }


# Dedup anahtarı: (asset, email_leak, leak_type, raw_source, discovery_date)
DedupKey = Tuple[str, str, str, str, str]

HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/{prefix}"
SHA1_PREFIX_RE = re.compile(r"^[A-Fa-f0-9]{5}$")


def _dedup_key(asset: str, email_leak: str, leak_type: str, raw_source: str, discovery_date: str = "") -> DedupKey:
    """Karşılaştırmayı tutarlı yapmak için None -> '' normalize edilir ve discovery_date dahil edilir."""
    return (
        (asset or "").lower().strip(),
        (email_leak or "").lower().strip(),
        (leak_type or "").lower().strip(),
        (raw_source or "").lower().strip(),
        str(discovery_date or "").strip(),
    )


def _extract_domain(raw: str) -> str:
    """
    Kullanıcının domain arama kutusuna girdiği serbest metni saf bir domain'e indirger.
    """
    value = (raw or "").strip()
    if not value:
        return ""

    value = re.sub(r"^https?://", "", value, flags=re.IGNORECASE)

    if "@" in value:
        value = value.split("@")[-1]

    value = re.sub(r"^www\.", "", value, flags=re.IGNORECASE)

    # Path / query / port kısmını at
    value = value.split("/")[0].split("?")[0].split(":")[0]

    return value.strip().strip(".").lower()


def _clear_all_leaks(db: Session) -> int:
    """Veritabanındaki tüm BreachLog kayıtlarını siler ve silinen satır sayısını döner."""
    deleted_count = db.query(BreachLog).delete()
    db.commit()
    return deleted_count


@app.get("/api/v1/leaks")
def get_leaks(db: Session = Depends(get_db)):
    """Veritabanındaki tüm sızıntı kayıtlarını döner."""
    return db.query(BreachLog).order_by(BreachLog.id.desc()).all()


@app.get("/api/v1/leaks/search-domain")
def search_domain_leaks(domain: str, db: Session = Depends(get_db)):
    """Verilen domain'e göre veritabanındaki kayıtları filtreler."""
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
    """Veritabanındaki tüm sızıntı kayıtlarını temizler."""
    deleted_count = _clear_all_leaks(db)
    logger.info("Veritabanı temizlendi, silinen kayıt sayısı: %s", deleted_count)
    return {"detail": "Veritabanı temizlendi.", "deleted_count": deleted_count}


@app.post("/api/v1/assets", response_model=MonitoredAssetOut, status_code=201)
async def create_monitored_asset(
    payload: MonitoredAssetCreate, db: Session = Depends(get_db)
):
    """Yeni bir e-posta veya domain'i izleme listesine ekler ve tarar."""
    raw_target = payload.target.strip()

    if "@" in raw_target:
        asset_type = "email"
        cleaned_target = raw_target.lower()
    else:
        asset_type = "domain"
        cleaned_target = _extract_domain(raw_target)

    if not cleaned_target:
        raise HTTPException(
            status_code=400, detail="Geçerli bir e-posta veya domain girin."
        )

    existing = (
        db.query(MonitoredAsset)
        .filter(MonitoredAsset.target == cleaned_target)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409, detail="Bu varlık zaten izleme listesinde."
        )

    asset = MonitoredAsset(
        target=cleaned_target, asset_type=asset_type, is_verified=False
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    logger.info("İzlemeye eklendi: target='%s', tip='%s'", cleaned_target, asset_type)

    try:
        new_count = await _scan_and_persist_asset(asset, db)
        logger.info(
            "İlk tarama tamamlandı: target='%s', yeni kayıt=%s",
            cleaned_target,
            new_count,
        )
    except Exception as exc:
        logger.error(
            "İlk tarama başarısız (target='%s'): %s", cleaned_target, exc
        )

    db.expire_all()
    db.refresh(asset)
    return asset


@app.get("/api/v1/assets", response_model=List[MonitoredAssetOut])
def list_monitored_assets(db: Session = Depends(get_db)):
    """İzlenen tüm varlıkları ve her birine bağlı sızıntı geçmişini döner."""
    return db.query(MonitoredAsset).order_by(MonitoredAsset.id.desc()).all()


@app.post("/api/v1/assets/{asset_id}/scan", response_model=MonitoredAssetOut)
async def rescan_monitored_asset(asset_id: int, db: Session = Depends(get_db)):
    """Şimdi Tara butonunun çağırdığı manuel yeniden tarama endpoint'i."""
    asset = db.query(MonitoredAsset).filter(MonitoredAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="İzlenen varlık bulunamadı.")

    try:
        new_count = await _scan_and_persist_asset(asset, db)
    except Exception as exc:
        logger.error("Manuel tarama başarısız (id=%s): %s", asset_id, exc)
        raise HTTPException(
            status_code=502, detail="Tarama sırasında hata oluştu."
        ) from exc

    db.expire_all()
    db.refresh(asset)
    logger.info(
        "Manuel tarama tamamlandı: id=%s, güncel kayıt sayısı=%s",
        asset_id,
        new_count,
    )
    return asset


@app.delete("/api/v1/assets/{asset_id}")
def delete_monitored_asset(asset_id: int, db: Session = Depends(get_db)):
    """İzleme listesinden bir varlığı çıkartır."""
    asset = db.query(MonitoredAsset).filter(MonitoredAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="İzlenen varlık bulunamadı.")

    db.delete(asset)
    db.commit()

    logger.info("İzlemeden kaldırıldı: id=%s, target='%s'", asset_id, asset.target)
    return {"detail": "İzleme listesinden kaldırıldı.", "id": asset_id}


@app.post("/api/v1/assets/{asset_id}/verify")
async def verify_monitored_asset(asset_id: int, db: Session = Depends(get_db)):
    """
    Domain Sahiplik Doğrulaması (DNS TXT Verification).

    İzlenen bir 'domain' tipi varlığın gerçek sahibi olunduğunu, domain'in
    DNS TXT kayıtlarına `leak-monitor-verify=<verification_token>` eklenip
    eklenmediğini kontrol ederek doğrular.
    """
    asset = db.query(MonitoredAsset).filter(MonitoredAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="İzlenen varlık bulunamadı.")

    if asset.asset_type != "domain":
        raise HTTPException(
            status_code=400,
            detail="Sadece 'domain' tipi varlıklar DNS TXT ile doğrulanabilir.",
        )

    if asset.is_verified:
        return {
            "detail": "Bu varlık zaten doğrulanmış.",
            "id": asset.id,
            "target": asset.target,
            "is_verified": True,
        }

    is_valid = await dns_service.verify_domain_txt(
        asset.target, asset.verification_token
    )

    if not is_valid:
        logger.warning(
            "[Domain Verify] Doğrulama başarısız: id=%s, target='%s'",
            asset.id,
            asset.target,
        )
        raise HTTPException(
            status_code=400,
            detail=(
                f"'{asset.target}' domaininin DNS ayarlarında beklenen TXT kaydı "
                f"bulunamadı veya eşleşmedi. Lütfen şu TXT kaydını ekleyip DNS "
                f"yayılımını bekledikten sonra tekrar deneyin: "
                f"leak-monitor-verify={asset.verification_token}"
            ),
        )

    asset.is_verified = True
    db.commit()
    db.refresh(asset)

    logger.info(
        "[Domain Verify] Doğrulama başarılı: id=%s, target='%s'",
        asset.id,
        asset.target,
    )

    return {
        "detail": "Domain başarıyla doğrulandı.",
        "id": asset.id,
        "target": asset.target,
        "is_verified": True,
    }


@app.get("/api/v1/check-password")
async def check_password(prefix: str):
    """HIBP Pwned Passwords kontrolü."""
    cleaned_prefix = (prefix or "").strip().upper()
    if not SHA1_PREFIX_RE.match(cleaned_prefix):
        raise HTTPException(
            status_code=400,
            detail="Geçersiz prefix: SHA-1 hash'inin ilk 5 hex karakteri olmalı.",
        )

    url = HIBP_RANGE_URL.format(prefix=cleaned_prefix)
    headers = {"Add-Padding": "true"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
    except httpx.HTTPError as exc:
        logger.error("HIBP Pwned Passwords sorgusu başarısız oldu: %s", exc)
        raise HTTPException(
            status_code=502, detail="HIBP Pwned Passwords servisine ulaşılamadı."
        ) from exc

    if resp.status_code != 200:
        logger.warning(
            "HIBP Pwned Passwords beklenmeyen durum kodu döndürdü: %s",
            resp.status_code,
        )
        raise HTTPException(
            status_code=502, detail=f"HIBP servisi hata döndü ({resp.status_code})."
        )

    hashes = []
    for line in resp.text.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        suffix, _, count_str = line.partition(":")
        try:
            count = int(count_str.strip())
        except ValueError:
            continue
        hashes.append({"suffix": suffix.strip().upper(), "count": count})

    return {"prefix": cleaned_prefix, "hashes": hashes}


# --------------------------------------------------------------------- #
# İzlenen Varlıklar Taramaları Yardımcı Fonksiyonları
# --------------------------------------------------------------------- #


async def _gather_leaks_for_asset(asset: MonitoredAsset) -> List[NormalizedLeak]:
    """
    MonitoredAsset.asset_type'a göre uygun servisleri paralel çağırır.
    /api/v1/scan endpoint'i ile BİREBİR AYNI mantıkte (domain için kurumsal 
    e-posta kalıpları dahil) sorgulama yapar.
    """
    target = asset.target
    all_results: List[NormalizedLeak] = []

    is_email = asset.asset_type == "email" or "@" in target
    domain = None
    emails_to_scan = []

    if is_email:
        emails_to_scan = [target.lower()]
    else:
        domain = _extract_domain(target)
        if not domain:
            domain = target
        
        emails_to_scan = [
            f"info@{domain}",
            f"admin@{domain}",
            f"destek@{domain}",
            f"iletisim@{domain}",
            f"hr@{domain}",
        ]

    tasks = []
    task_metadata = []

    if domain and not is_email:
        tasks.append(leakix_service.search_leakix(domain))
        task_metadata.append({"type": "leakix"})

        tasks.append(otx_service.search_otx(domain, ""))
        task_metadata.append({"type": "otx_domain"})

    for email in emails_to_scan:
        tasks.append(_safe_xposed_check(email))
        task_metadata.append({"type": "xposed", "email": email})

        otx_query_domain = domain if domain else email.split("@")[-1]
        tasks.append(otx_service.search_otx(otx_query_domain, email))
        task_metadata.append({"type": "otx_email"})

        tasks.append(breachdirectory_service.search_breachdirectory(email))
        task_metadata.append({"type": "breachdirectory"})

    responses = await asyncio.gather(*tasks, return_exceptions=True)

    for meta, resp in zip(task_metadata, responses):
        if isinstance(resp, Exception) or not resp:
            continue

        srv_type = meta.get("type")

        if srv_type == "xposed":
            email = meta.get("email", "")
            normalized = normalize_xposed_results(resp, email)
            all_results.extend(normalized)
        elif isinstance(resp, list):
            for item in resp:
                if isinstance(item, NormalizedLeak):
                    all_results.append(item)

    seen_keys: set = set()
    deduped_results: List[NormalizedLeak] = []
    
    for item in all_results:
        key = _dedup_key(
            item.asset, 
            item.email_leak, 
            item.leak_type, 
            item.raw_source, 
            str(item.discovery_date or "")
        )
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped_results.append(item)

    return deduped_results


def _persist_asset_leaks(
    asset: MonitoredAsset, leaks: List[NormalizedLeak], db: Session
) -> int:
    """
    NormalizedLeak listesini AssetBreachLog tablosuna birebir tüm detay alanlarıyla yazar.
    /api/v1/scan ile aynı sayıda ve kalitede kayıt üretilmesini sağlar.
    """
    db.query(AssetBreachLog).filter(
        AssetBreachLog.asset_id == asset.id
    ).delete(synchronize_session=False)
    db.commit()

    new_logs = [
        AssetBreachLog(
            asset_id=asset.id,
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
            url=item.url or "",
            ip_info=item.ip_info or "",
            hostname=item.hostname or "",
            malware_path=item.malware_path or "",
        )
        for item in leaks
    ]

    if new_logs:
        db.add_all(new_logs)
        db.commit()

    db.expire(asset, ["breach_logs"])
    db.refresh(asset)

    logger.info(
        "[Asset Scan] '%s' için %s güncel kayıt kaydedildi.",
        asset.target,
        len(new_logs),
    )

    return len(new_logs)


async def _scan_and_persist_asset(asset: MonitoredAsset, db: Session) -> int:
    leaks = await _gather_leaks_for_asset(asset)
    return _persist_asset_leaks(asset, leaks, db)


async def _safe_xposed_check(email: str) -> list:
    return await xposed_service.check_email(email)


@app.get("/api/v1/scan")
async def scan(target: str, db: Session = Depends(get_db)):
    """
    Verilen hedef (e-posta veya domain) için canlı tarama yapar.
    
    1) Veritabanındaki tüm eski sızıntı kayıtlarını temizler.
    2) Target e-posta ise doğrudan, domain ise varsayılan kurumsal e-postalarla birlikte 
       LeakIX, OTX, XposedOrNot ve BreachDirectory servislerini eşzamanlı (paralel) sorgular.
    3) Sonuçları ortak NormalizedLeak formatında toplar ve mükerrer kayıtları ayıklar.
    4) Güncel sonuçları DB'ye yazar ve bildirim servisini tetikler.
    """
    if not target or not target.strip():
        raise HTTPException(
            status_code=400, detail="Geçerli bir e-posta veya domain girin."
        )

    cleaned_target = target.strip()
    is_email = "@" in cleaned_target

    domain = None
    emails_to_scan = []

    if is_email:
        emails_to_scan = [cleaned_target.lower()]
    else:
        domain = _extract_domain(cleaned_target)
        if not domain:
            raise HTTPException(
                status_code=400, detail="Geçerli bir domain girin."
            )
        
        emails_to_scan = [
            f"info@{domain}",
            f"admin@{domain}",
            f"destek@{domain}",
            f"iletisim@{domain}",
            f"hr@{domain}",
        ]

    deleted_count = _clear_all_leaks(db)
    logger.info(
        "Yeni tarama öncesi veritabanı sıfırlandı (target=%s), silinen kayıt sayısı: %s",
        cleaned_target,
        deleted_count,
    )

    tasks = []
    task_metadata = []

    if domain:
        tasks.append(leakix_service.search_leakix(domain))
        task_metadata.append({"type": "leakix"})

        tasks.append(otx_service.search_otx(domain, ""))
        task_metadata.append({"type": "otx_domain"})

    for email in emails_to_scan:
        tasks.append(_safe_xposed_check(email))
        task_metadata.append({"type": "xposed", "email": email})

        otx_query_domain = domain if domain else email.split("@")[-1]
        tasks.append(otx_service.search_otx(otx_query_domain, email))
        task_metadata.append({"type": "otx_email"})

        tasks.append(breachdirectory_service.search_breachdirectory(email))
        task_metadata.append({"type": "breachdirectory"})

    responses = await asyncio.gather(*tasks, return_exceptions=True)

    all_results: List[NormalizedLeak] = []

    for meta, resp in zip(task_metadata, responses):
        if isinstance(resp, Exception):
            logger.error(
                "Servis sorgulama hatası (%s): %s", meta.get("type"), resp
            )
            continue
        if not resp:
            continue

        srv_type = meta.get("type")

        if srv_type == "xposed":
            email = meta.get("email", "")
            normalized = normalize_xposed_results(resp, email)
            all_results.extend(normalized)
        elif isinstance(resp, list):
            for item in resp:
                if isinstance(item, NormalizedLeak):
                    all_results.append(item)

    if not all_results:
        logger.info("Tarama tamamlandı, hiçbir sızıntı bulunamadı (target=%s).", cleaned_target)
        return []

    seen_keys: set = set()
    deduped_results: List[NormalizedLeak] = []

    for item in all_results:
        key = _dedup_key(
            item.asset, 
            item.email_leak, 
            item.leak_type, 
            item.raw_source, 
            str(item.discovery_date or "")
        )
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped_results.append(item)

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
            url=item.url or "",
            ip_info=item.ip_info or "",
            hostname=item.hostname or "",
            malware_path=item.malware_path or "",
        )
        for item in deduped_results
    ]

    db.add_all(db_objects)
    db.commit()

    for obj in db_objects:
        db.refresh(obj)

    try:
        await notification_service.send_leak_alert(db_objects)
    except Exception as exc:
        logger.error("Bildirim gönderilirken hata oluştu: %s", exc)

    logger.info(
        "Tarama başarıyla tamamlandı (target=%s): %s adet tekil kayıt veritabanına işlendi.",
        cleaned_target,
        len(db_objects),
    )

    return db_objects


# --------------------------------------------------------------------- #
# Otomatik Arka Plan Taraması (APScheduler)
# --------------------------------------------------------------------- #

ASSET_SCAN_INTERVAL_HOURS = int(os.getenv("ASSET_SCAN_INTERVAL_HOURS", "24"))
scheduler = AsyncIOScheduler()


async def _scheduled_scan_all_assets() -> None:
    """Veritabanındaki tüm izlenen varlıkları periyodik olarak tarar."""
    logger.info("⏰ [Scheduler] Periyodik tarama başladı.")
    db = SessionLocal()
    try:
        assets = db.query(MonitoredAsset).all()
        for asset in assets:
            try:
                new_count = await _scan_and_persist_asset(asset, db)
                if new_count:
                    logger.info(
                        "⏰ [Scheduler] '%s' için %s güncel kayıt.",
                        asset.target,
                        new_count,
                    )
            except Exception as exc:
                logger.error(
                    "⏰ [Scheduler] '%s' taranırken hata: %s", asset.target, exc
                )
    finally:
        db.close()
    logger.info("⏰ [Scheduler] Tarama tamamlandı.")


@app.on_event("startup")
async def _start_scheduler() -> None:
    scheduler.add_job(
        _scheduled_scan_all_assets,
        trigger=IntervalTrigger(hours=ASSET_SCAN_INTERVAL_HOURS),
        id="periodic_asset_scan",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "✅ APScheduler başladı, izlenen varlıklar %s saatte bir taranacak.",
        ASSET_SCAN_INTERVAL_HOURS,
    )


@app.on_event("shutdown")
async def _stop_scheduler() -> None:
    scheduler.shutdown(wait=False)