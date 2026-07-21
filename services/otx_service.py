"""
AlienVault OTX (Open Threat Exchange) entegrasyonu.

Verilen domain/asset için ilişkili "Pulse" (tehdit istihbaratı raporu) ve
IOC (Indicator of Compromise) kayıtlarını getirir.

Bu sürümde `leak_type` alanı artık SOC ekibinin doğrudan aksiyon alabileceği
teknik bir tehdit sınıflandırmasına dönüştürülür: pulse etiketlerinden
türetilen bir tehdit kategorisi + pulse başlığı tek satırda birleştirilir.
Frontend'in "kalın üst satır / gri alt satır" görünümünü ayırabilmesi için
iki parça " • " ayracıyla birleştirilir (bkz. leakix_service.PART_SEPARATOR
ile aynı format):

    "<Tehdit Kategorisi> • <Pulse Başlığı>"

Örnekler:
    "Stealer Log / Kimlik Bilgisi Sızıntısı • RedLine Stealer Logs - July 2026"
    "C2 / Komuta-Kontrol IOC • Cobalt Strike Infrastructure Tracker"

Docs: https://otx.alienvault.com/assets/static/external_api.html
"""

import logging
from typing import List
import httpx
from config import settings
from schemas import NormalizedLeak

logger = logging.getLogger(__name__)

_DOMAIN_GENERAL_PATH = "/api/v1/indicators/domain/{domain}/general"

# İki parçalı (bold / gri alt yazı) leak_type string'lerini birleştirmek için
# kullanılan ayraç. leakix_service.py ile aynı ayraç kullanılır ki frontend
# tek bir parse mantığıyla her iki kaynağı da işleyebilsin.
PART_SEPARATOR = " • "

_CRITICAL_TAG_HINTS = ("ransomware", "apt", "critical", "zero-day", "0day", "wiper")
_HIGH_TAG_HINTS = ("malware", "botnet", "trojan", "c2", "c&c", "phishing", "exploit")

# Etiketlerden SOC için anlamlı bir tehdit kategorisi türetmek üzere
# öncelik sırasına göre kontrol edilen anahtar kelime -> kategori eşlemesi.
# Sıra önemli: liste yukarıdan aşağıya taranır, ilk eşleşen kategori kullanılır.
_THREAT_CATEGORY_RULES: list[tuple[tuple[str, ...], str]] = [
    (("ransomware",), "Ransomware IOC"),
    (("stealer", "infostealer", "redline", "raccoon", "vidar"), "Stealer Log / Kimlik Bilgisi Sızıntısı"),
    (("credential", "credential-stuffing", "credstuffing", "leak", "combo"), "Credential Stuffing / Kimlik Bilgisi IOC"),
    (("c2", "c&c", "command-and-control", "cobalt", "beacon"), "C2 / Komuta-Kontrol IOC"),
    (("botnet",), "Botnet IOC"),
    (("phishing",), "Phishing Altyapısı IOC"),
    (("trojan", "backdoor", "rat"), "Trojan / Backdoor IOC"),
    (("apt",), "APT Kampanyası IOC"),
    (("exploit", "zero-day", "0day", "cve"), "Exploit / Zero-Day IOC"),
    (("malware",), "Malware IOC"),
]


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


def _threat_category_from_tags(tags: list[str]) -> str:
    """
    Pulse etiketlerini tarayarak SOC ekibi için net, aksiyon alınabilir bir
    tehdit kategorisi döner (örn. "Stealer Log / Kimlik Bilgisi Sızıntısı",
    "C2 / Komuta-Kontrol IOC"). Hiçbir bilinen kalıba uymuyorsa etiketlerin
    kendisinden kısa bir özet, o da yoksa jenerik "Threat Pulse IOC" döner.
    """
    lowered_tags = [t.lower() for t in tags]

    for keywords, category in _THREAT_CATEGORY_RULES:
        if any(keyword in tag for tag in lowered_tags for keyword in keywords):
            return category

    if tags:
        # Bilinen bir kalıba uymuyorsa, ilk 2 etiketi ham bilgi olarak göster.
        return f"Threat Pulse IOC ({', '.join(tags[:2])})"

    return "Threat Pulse IOC"


def _normalize_pulse(pulse: dict, domain: str, email: str = "") -> NormalizedLeak:
    """Tek bir OTX pulse kaydını ortak NormalizedLeak şemasına dönüştürür."""
    tags = pulse.get("tags") or []
    modified = pulse.get("modified") or pulse.get("created") or ""
    last_seen = modified[:10] if modified else "-"

    threat_category = _threat_category_from_tags(tags)
    pulse_name = (pulse.get("name") or "").strip() or "İsimsiz Pulse"

    leak_type = f"{threat_category}{PART_SEPARATOR}{pulse_name}"

    return NormalizedLeak(
        asset=domain,
        email_leak=email,
        leaked_password="N/A",
        leak_type=leak_type,
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
    Mükerrer kayıtlar (aynı Pulse ID) filtrelenerek benzersiz veriler döndürülür.
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
    seen_keys = set()  # Ekranda tekrar eden her şeyi engelleyecek küme

    for pulse in pulses:
        try:
            normalized = _normalize_pulse(pulse, domain, email)

            # KESİN BÖLGE: Kullanıcının ekranda gördüğü metinlerin bileşimi!
            # Ekranda ikisi de "izmir.bel.tr | aliguzel@... | <leak_type> | 2023-09-15" ise
            # ikincisini KESİNLİKLE LİSTEYE ALMA.
            unique_display_key = (
                normalized.asset,
                normalized.email_leak,
                normalized.leak_type,
                normalized.last_seen,
            )

            if unique_display_key not in seen_keys:
                seen_keys.add(unique_display_key)
                results.append(normalized)

        except Exception:  # noqa: BLE001
            logger.exception("OTX pulse kaydı normalize edilemedi: %s", pulse)

    return results
