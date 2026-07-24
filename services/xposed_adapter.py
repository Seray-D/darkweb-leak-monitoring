"""
XposedOrNot normalization adaptörü.

FIX NOTU: Bu dosyada eskiden bir de `check_email` fonksiyonu vardı
(xposed_service.py içindekiyle neredeyse birebir aynı, ama ESKİ ve YANLIŞ
/v1/check-email endpoint'ini kullanıyordu). main.py zaten sadece
xposed_service.check_email'i çağırıyor, bu yüzden buradaki kopya kod
kaldırıldı — tek bir kaynağa (xposed_service.py) indirgendi. Burada sadece
normalization mantığı kalıyor.

Girdi artık /v1/breach-analytics üzerinden gelen DETAYLI breach dict'leri:
    {
      "breach": "AlienStealerLogs",
      "xposed_data": "Email addresses;Passwords;Browser Cookies",
      "xposed_records": 1542300,
      "xposed_date": "2024",
      "password_risk": "plaintext",
      "searchable": "Yes",
      "verified": "No",
      "domain": "..."   # bazı kayıtlarda mevcut olabilir
    }
"""

import logging
import urllib.parse
from typing import List

from schemas import NormalizedLeak

logger = logging.getLogger(__name__)

PART_SEPARATOR = " • "

# password_risk alanına göre öncelik eşlemesi.
_CRITICAL_RISK_HINTS = ("plaintext", "plain", "easytocrack", "easy_to_crack")

# XposedOrNot'un breach-analytics API'si sızıntı için orijinal bir
# indirme/kaynak linki DÖNMEZ — yalnızca metadata (breach, xposed_data,
# xposed_date, password_risk, verified...) döner. Bu yüzden "url" alanı
# eskiden hiç doldurulmuyor ve arayüzde "-" olarak görünüyordu. Artık gerçek
# bir link yoksa breach adına göre otomatik bir DuckDuckGo arama linki
# üretiyoruz, böylece kullanıcı tek tıkla araştırma yapabiliyor.
DUCKDUCKGO_SEARCH_URL_TEMPLATE = "https://html.duckduckgo.com/html/?q={query}"


def _build_fallback_investigation_url(breach_name: str) -> str:
    """Breach adından bir DuckDuckGo arama linki üretir (gerçek kaynak linki yoksa)."""
    label = (breach_name or "").strip() or "veri sızıntısı"
    query = urllib.parse.quote_plus(f"{label} breach leak")
    return DUCKDUCKGO_SEARCH_URL_TEMPLATE.format(query=query)


def _priority_from_password_risk(password_risk: str, verified: bool) -> str:
    risk = (password_risk or "").strip().lower()
    if any(hint in risk for hint in _CRITICAL_RISK_HINTS):
        return "Critical"
    if risk:
        return "High"
    if verified:
        return "Medium"
    return "Info"


def _is_truthy_flag(value) -> bool:
    """XposedOrNot 'verified'/'searchable' alanlarını 'Yes'/'No' string olarak döner."""
    return str(value).strip().lower() in ("yes", "true", "1")


def normalize_xposed_result(raw: dict, email: str) -> NormalizedLeak:
    """XposedOrNot breach-analytics kaydını ortak NormalizedLeak şemasına çevirir."""
    domain = email.split("@")[-1] if "@" in email else email

    breach_name = (raw.get("breach") or "").strip() or "Bilinmeyen Sızıntı"
    xposed_data = (raw.get("xposed_data") or "").replace(";", ", ").strip()
    xposed_date = str(raw.get("xposed_date") or "-")
    password_risk = raw.get("password_risk") or ""
    verified = _is_truthy_flag(raw.get("verified"))

    # "<Breach Adı> • <Sızan Veri Türleri>" — LeakIX/OTX ile aynı iki parçalı format.
    leak_type = (
        f"{breach_name}{PART_SEPARATOR}{xposed_data}"
        if xposed_data
        else breach_name
    )

    has_password_exposure = "password" in xposed_data.lower()
    if has_password_exposure and password_risk:
        leaked_password = f"Risk: {password_risk}"
    elif has_password_exposure:
        leaked_password = "******"
    else:
        leaked_password = "N/A"

    # API bugün gerçek bir link göndermiyor, ama ileride "url"/"reference"
    # gibi bir alan eklerse önce onu kullanmaya çalışıyoruz; yoksa
    # DuckDuckGo aramasına düşüyoruz. Sonuç asla boş kalmıyor.
    real_url = (raw.get("url") or raw.get("reference") or "").strip()
    investigation_url = real_url or _build_fallback_investigation_url(breach_name)

    return NormalizedLeak(
        asset=raw.get("domain") or domain,
        email_leak=email,
        leaked_password=leaked_password,
        leak_type=leak_type,
        market="XposedOrNot",
        last_seen=xposed_date,
        certainty="Confirmed" if verified else "Unsure",
        status="Active",
        priority=_priority_from_password_risk(password_risk, verified),
        raw_source=breach_name,
        url=investigation_url,
    )


def normalize_xposed_results(
    raw_results: List[dict], email: str
) -> List[NormalizedLeak]:
    """Toplu normalize etmek için yardımcı fonksiyon."""
    if not isinstance(raw_results, list):
        return []

    normalized: List[NormalizedLeak] = []
    for item in raw_results:
        if not isinstance(item, dict):
            logger.warning(
                "XposedOrNot: beklenmeyen kayıt tipi atlandı: %s", type(item)
            )
            continue
        try:
            normalized.append(normalize_xposed_result(item, email))
        except Exception:  # noqa: BLE001 - tek bir bozuk kayıt tüm taramayı düşürmesin
            logger.exception("XposedOrNot kaydı normalize edilemedi: %s", item)

    return normalized