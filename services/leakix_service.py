"""
LeakIX entegrasyonu.

LeakIX (https://leakix.net), açık servisleri ve sızıntıya uğramış sistemleri
tarayan bir OSINT/CTI platformudur. `scope=leak` ile veri sızıntılarını,
`scope=service` ile yanlış yapılandırılmış açık servisleri sorgulayabiliriz.

Bu sürümde `leak_type` alanı artık SOC ekibinin doğrudan aksiyon alabileceği
teknik bir başlığa dönüştürülür: yazılım/servis adı + port/protokol +
(varsa) olay başlığı (event_title) tek satırda birleştirilir. Frontend'in
"kalın üst satır / gri alt satır" görünümünü ayırabilmesi için iki parça
" • " ayracıyla birleştirilir:

    "<Ana Başlık> • <Port/Protokol - Teknik Detay>"

Örnekler:
    "Apache • Port 80/TCP - Open Directory / Config Exposure"
    "Git Repository Exposed • Port 443/TCP"

Docs: https://leakix.net/api-documentation
"""

import logging
from typing import List, Optional
import httpx
from config import settings
from schemas import NormalizedLeak

logger = logging.getLogger(__name__)

_SEARCH_PATH = "/search"
_SCOPES = ("leak", "service")

# İki parçalı (bold / gri alt yazı) leak_type string'lerini birleştirmek için
# kullanılan ayraç. Frontend tarafında `leak_type.split(SEPARATOR)` ile
# ayrıştırılır.
PART_SEPARATOR = " • "


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


def _humanize_event_title(raw: Optional[str]) -> Optional[str]:
    """
    LeakIX event_title / event_type değerlerini ("open-dir", "GitConfigHttpPlugin"
    gibi teknik plugin adlarını) daha okunur bir SOC başlığına çevirir.
    """
    if not raw:
        return None

    normalized = raw.replace("_", " ").replace("-", " ").strip()

    # Bilinen plugin/isim kalıplarını insan-okur teknik başlıklara eşle.
    lowered = normalized.lower()
    known_map = {
        "open dir": "Open Directory / Config Exposure",
        "opendirectory": "Open Directory / Config Exposure",
        "gitconfighttp": "Git Repository Exposed",
        "git config": "Git Repository Exposed",
        "elasticsearch": "Elasticsearch Unauthenticated Access",
        "mongodb": "MongoDB Unauthenticated Access",
        "redis": "Redis Unauthenticated Access",
        "docker": "Docker API Exposed",
        "jenkins": "Jenkins Panel Exposed",
        "envfile": ".env Dosyası Sızıntısı",
        "wp config": "WordPress wp-config.php Sızıntısı",
    }
    for needle, mapped in known_map.items():
        if needle in lowered:
            return mapped

    # Eşleşme yoksa, orijinal metni Title Case olarak döndür.
    return normalized.title()


def _build_port_protocol_label(port, protocol: Optional[str]) -> Optional[str]:
    """'Port 80/TCP' gibi kısa, teknik bir port/protokol etiketi üretir."""
    if not port:
        return None
    if protocol:
        return f"Port {port}/{protocol.upper()}"
    return f"Port {port}"


def _build_technical_leak_type(entry: dict, leak_info: dict, service_info: dict) -> str:
    """
    LeakIX kaydından SOC ekibinin doğrudan aksiyon alabileceği, iki parçalı
    ("Ana Başlık • Port/Protokol - Detay") teknik bir leak_type string'i
    üretir.
    """
    software = service_info.get("software") or {}
    plugin = entry.get("plugin") or service_info.get("plugin") or {}

    port = entry.get("port") or service_info.get("port")
    protocol = entry.get("protocol") or service_info.get("protocol")

    event_title_raw = (
        entry.get("event_title")
        or entry.get("event_type")
        or leak_info.get("type")
    )
    event_title = _humanize_event_title(event_title_raw)

    # --- Ana başlık: yazılım/plugin adı > event başlığı > jenerik ---
    software_name = software.get("name")
    software_version = software.get("version")
    plugin_name = plugin.get("name") if isinstance(plugin, dict) else None

    if software_name:
        main_title = software_name if not software_version else f"{software_name} {software_version}"
    elif event_title:
        main_title = event_title
    elif plugin_name:
        main_title = _humanize_event_title(plugin_name) or plugin_name
    else:
        main_title = "Exposed Service"

    # --- Alt satır: port/protokol + (varsa, ana başlıktan farklıysa) detay ---
    port_label = _build_port_protocol_label(port, protocol)
    detail = event_title if event_title and event_title != main_title else None

    if port_label and detail:
        sub_label = f"{port_label} - {detail}"
    elif port_label:
        sub_label = port_label
    elif detail:
        sub_label = detail
    else:
        sub_label = "Port/Protokol bilgisi yok"

    return f"{main_title}{PART_SEPARATOR}{sub_label}"


def _normalize_entry(entry: dict, query: str) -> NormalizedLeak:
    """Tek bir LeakIX sonucunu ortak NormalizedLeak şemasına dönüştürür."""
    leak_info = entry.get("leak") or {}
    service_info = entry.get("service") or {}

    severity = leak_info.get("severity") or entry.get("severity")

    last_seen_raw = entry.get("time") or entry.get("last_seen") or ""
    last_seen = last_seen_raw[:10] if last_seen_raw else "-"

    asset = entry.get("host") or entry.get("ip") or query

    leak_type = _build_technical_leak_type(entry, leak_info, service_info)

    # Teknik detay alanlarının eşlenmesi
    ip_address = entry.get("ip")
    host_name = entry.get("host")
    port = entry.get("port")
    
    generated_url = f"https://{host_name}:{port}" if host_name and port else (f"http://{ip_address}:{port}" if ip_address and port else None)

    return NormalizedLeak(
        asset=asset,
        email_leak="",
        leaked_password="******" if leak_info else "N/A",
        leak_type=leak_type,
        market="LeakIX",
        last_seen=last_seen,
        certainty="Confirmed" if leak_info else "Unsure",
        status="Active",
        priority=_priority_from_severity(severity),
        raw_source=entry.get("id") or entry.get("_id"),
        ip_info=ip_address,
        hostname=host_name,
        url=generated_url,
        malware_path=None
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