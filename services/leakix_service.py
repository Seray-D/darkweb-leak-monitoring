"""
LeakIX entegrasyonu.

LeakIX (https://leakix.net), açık servisleri ve sızıntıya uğramış sistemleri
tarayan bir OSINT/CTI platformudur. `scope=leak` ile veri sızıntılarını,
`scope=service` ile yanlış yapılandırılmış açık servisleri sorgulayabiliriz.

Docs: https://leakix.net/api-documentation
"""

import logging
from typing import List

import httpx

from config import settings
from schemas import NormalizedLeak

logger = logging.getLogger(__name__)

_SEARCH_PATH = "/search"
_SCOPES = ("leak", "service")


def _priority_from_severity(severity: float | int | None) -> str:
    """LeakIX 'severity' skorunu (0-10 aralığı) proje önceliğine eşler."""
    if severity is None:
        return "Info"
    if severity >= 8:
        return "Critical"
    if severity >= 6:
        return "High"
    if severity >= 3:
        return "Medium"
    return "Info"


def _normalize_entry(entry: dict, query: str) -> NormalizedLeak:
    """Tek bir LeakIX sonucunu ortak NormalizedLeak şemasına dönüştürür."""
    leak_info = entry.get("leak") or {}
    service_info = entry.get("service") or {}

    event_type = entry.get("event_type", "")
    leak_type = leak_info.get("type") or service_info.get("software", {}).get("name") or event_type or "Unknown"
    severity = leak_info.get("severity") or entry.get("severity")

    last_seen_raw = entry.get("time") or entry.get("last_seen") or ""
    last_seen = last_seen_raw[:10] if last_seen_raw else "-"

    asset = entry.get("host") or entry.get("ip") or query

    return NormalizedLeak(
        asset=asset,
        email_leak="",
        leaked_password="******" if leak_info else "N/A",
        leak_type=str(leak_type),
        market="LeakIX",
        last_seen=last_seen,
        certainty="Confirmed" if leak_info else "Unsure",
        status="Active",
        priority=_priority_from_severity(severity),
        raw_source=entry.get("id") or entry.get("_id"),
    )


async def search_leakix(query: str) -> List[NormalizedLeak]:
    """
    Verilen domain/asset (veya e-postadan çıkarılan domain) için LeakIX'te
    açık servis ve sızıntı bulgularını arar.

    API anahtarı olmadan da sınırlı sonuç dönebilir; anahtar varsa header'a eklenir.
    Ağ/istek hatalarında sessizce boş liste döner — bu servis diğer kaynakları
    (XposedOrNot, OTX) etkilememeli.
    """
    headers = {"Accept": "application/json"}
    if settings.leakix_api_key:
        headers["api-key"] = settings.leakix_api_key

    results: List[NormalizedLeak] = []

    async with httpx.AsyncClient(
        base_url=settings.leakix_base_url,
        headers=headers,
        timeout=settings.http_timeout_seconds,
    ) as client:
        for scope in _SCOPES:
            try:
                response = await client.get(
                    _SEARCH_PATH,
                    params={"scope": scope, "q": query},
                )
                response.raise_for_status()
                data = response.json() or []
            except httpx.HTTPStatusError as exc:
                logger.warning(
                    "LeakIX %s sorgusu başarısız oldu (%s): %s",
                    scope,
                    exc.response.status_code,
                    query,
                )
                continue
            except httpx.RequestError as exc:
                logger.warning("LeakIX'e bağlanılamadı (%s): %s", scope, exc)
                continue

            for entry in data:
                try:
                    results.append(_normalize_entry(entry, query))
                except Exception:  # noqa: BLE001 - tek bir bozuk kayıt tüm taramayı düşürmesin
                    logger.exception("LeakIX kaydı normalize edilemedi: %s", entry)

    return results
