"""
AlienVault OTX (Open Threat Exchange) entegrasyonu.

Verilen domain/asset için ilişkili "Pulse" (tehdit istihbaratı raporu) ve
IOC (Indicator of Compromise) kayıtlarını getirir.

Docs: https://otx.alienvault.com/assets/static/external_api.html
"""

import logging
from typing import List

import httpx

from config import settings
from schemas import NormalizedLeak

logger = logging.getLogger(__name__)

_DOMAIN_GENERAL_PATH = "/api/v1/indicators/domain/{domain}/general"

_CRITICAL_TAG_HINTS = ("ransomware", "apt", "critical", "zero-day", "0day")
_HIGH_TAG_HINTS = ("malware", "botnet", "trojan", "c2", "phishing")


def _priority_from_tags(tags: list[str]) -> str:
    """Pulse etiketlerine bakarak kabaca bir öncelik seviyesi çıkarır."""
    lowered = {t.lower() for t in tags}
    if any(hint in tag for tag in lowered for hint in _CRITICAL_TAG_HINTS):
        return "Critical"
    if any(hint in tag for tag in lowered for hint in _HIGH_TAG_HINTS):
        return "High"
    if lowered:
        return "Medium"
    return "Info"


def _normalize_pulse(pulse: dict, domain: str, email: str = "") -> NormalizedLeak:
    """Tek bir OTX pulse kaydını ortak NormalizedLeak şemasına dönüştürür."""
    tags = pulse.get("tags") or []
    modified = pulse.get("modified") or pulse.get("created") or ""
    last_seen = modified[:10] if modified else "-"

    return NormalizedLeak(
        asset=domain,
        email_leak=email,
        leaked_password="N/A",
        leak_type=f"Threat Pulse ({', '.join(tags[:2]) or 'IOC'})",
        market="AlienVault OTX",
        last_seen=last_seen,
        certainty="Confirmed",
        status="Active",
        priority=_priority_from_tags(tags),
        raw_source=pulse.get("id"),
    )


async def search_otx(domain: str, email: str = "") -> List[NormalizedLeak]:
    """
    Verilen domain için AlienVault OTX'te ilişkili pulse/IOC kayıtlarını arar.

    `email` verilirse, bulunan her pulse kaydının `email_leak` alanı bu
    e-posta ile doldurulur (kullanıcının aradığı e-posta ile ilişkilendirmek için).

    API anahtarı zorunludur; anahtar tanımlı değilse uyarı loglanır ve boş
    liste döner (diğer servisleri engellemeden taramaya devam edilir).
    """
    if not settings.otx_api_key:
        logger.warning("OTX_API_KEY tanımlı değil, AlienVault OTX sorgusu atlanıyor.")
        return []

    headers = {
        "X-OTX-API-KEY": settings.otx_api_key,
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(
            base_url=settings.otx_base_url,
            headers=headers,
            timeout=settings.http_timeout_seconds,
        ) as client:
            response = await client.get(
                _DOMAIN_GENERAL_PATH.format(domain=domain)
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "OTX sorgusu başarısız oldu (%s): %s", exc.response.status_code, domain
        )
        return []
    except httpx.RequestError as exc:
        logger.warning("OTX'e bağlanılamadı: %s", exc)
        return []

    pulses = (data.get("pulse_info") or {}).get("pulses") or []

    results: List[NormalizedLeak] = []
    for pulse in pulses:
        try:
            results.append(_normalize_pulse(pulse, domain, email))
        except Exception:  # noqa: BLE001 - tek bir bozuk kayıt tüm taramayı düşürmesin
            logger.exception("OTX pulse kaydı normalize edilemedi: %s", pulse)

    return results
