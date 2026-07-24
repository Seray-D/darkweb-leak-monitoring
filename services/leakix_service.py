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


def _escape_yql_value(value: str) -> str:
    """YQL çift tırnak içindeki değerde kaçış gerektiren karakterleri escaper."""
    return (value or "").strip().replace("\\", "\\\\").replace('"', '\\"')


def _build_domain_clause(domain: str) -> str:
    """
    Bir domain için host + ssl sertifika eşleşmesini birlikte arayan bir YQL
    grubu üretir.

    ÖNEMLİ (FIX): Eskiden domain, hiçbir alan belirtilmeden çıplak bir tam
    metin (full-text) terimi olarak gönderiliyordu (ör. `q=example.com`).
    LeakIX field dokümantasyonuna göre (docs.leakix.net/docs/query/fields/)
    `host` alanı `dns` TİPİNDEDİR, `text` (fuzzy tam metin) değil — yani
    çıplak bir terim host alanını hedeflemez ve genelde hiçbir kayda denk
    gelmez. Bu yüzden artık açıkça `host:"..."` alanını sorguluyoruz.
    `host` alanı "dns" tipi olduğu için üst domain'i aramak alt alan
    adlarını (subdomain) da otomatik kapsar (ör. `host:"example.com"` ->
    `sub.example.com` dahil). Ayrıca aynı sertifikayı paylaşan ama `host`
    alanında ayrı indekslenmemiş kayıtları da yakalamak için
    `ssl.certificate.domain` alanını OR olarak ekliyoruz.
    """
    escaped = _escape_yql_value(domain)
    return f'(host:"{escaped}" ssl.certificate.domain:"{escaped}")'


def _build_search_query(term: str, scope: str) -> str:
    """
    Verilen terimi (domain veya e-posta) ve hedef scope'u (leak/service)
    dikkate alarak LeakIX'in güncel YQL sözdizimine uygun bir `q` değeri
    üretir.

    - Domain girdisinde: `host:"..."` + `ssl.certificate.domain:"..."` (her
      iki scope'ta da geçerli, bkz. "Global fields" tablosu).
    - E-posta girdisinde: domain kısmı için aynı host/sertifika sorgusuna
      ek olarak, yalnızca `leak` scope'unda geçerli olan
      `service.credentials.username` alanı (bkz. "Leak specific fields")
      ile sızan kimlik bilgilerinde doğrudan e-posta eşleşmesi de aranır.
      `service` scope'unda bu alan geçerli olmadığı için sadece domain
      sorgusuna düşülür.
    """
    term = (term or "").strip()
    if not term:
        return ""

    if "@" in term:
        domain_part = term.split("@")[-1].strip()
        domain_clause = _build_domain_clause(domain_part) if domain_part else ""

        if scope == "leak":
            escaped_email = _escape_yql_value(term)
            email_clause = f'service.credentials.username:"{escaped_email}"'
            if domain_clause:
                return f"({email_clause} {domain_clause})"
            return email_clause

        return domain_clause or f'"{_escape_yql_value(term)}"'

    return _build_domain_clause(term)


def _priority_from_severity(severity) -> str:
    """
    LeakIX 'leak.severity' alanını proje önceliğine eşler.

    ÖNEMLİ (FIX): LeakIX bu alanı eskiden 0-10 aralığında SAYISAL bir skor
    olarak döndürüyordu. Güncel API dokümantasyonuna göre
    (docs.leakix.net/docs/query/fields/) bu alan artık `keyword` tipinde,
    yani "critical", "high", "medium", "low" gibi bir STRING döndürüyor
    (ör. örnek yanıtta "severity": "low"). Eski kod `severity >= 8` gibi
    sayısal karşılaştırma yaptığı için bir string ile karşılaşınca
    `TypeError` fırlatıyordu — bu da her kaydın normalize aşamasında
    sessizce elenmesine (ve sonuç olarak boş liste dönmesine) yol açıyordu.

    Bu fonksiyon artık HEM string (yeni format) HEM sayısal (eski format /
    olası geriye dönük veri) girdileri destekliyor.
    """
    if severity is None:
        return "Info"

    # --- Yeni format: string/keyword severity ("critical", "high", ...) ---
    if isinstance(severity, str):
        normalized = severity.strip().lower()
        if normalized in ("critical", "crit"):
            return "Critical"
        if normalized in ("high",):
            return "High"
        if normalized in ("medium", "moderate", "med"):
            return "Medium"
        if normalized in ("low",):
            return "Info"
        if normalized in ("", "info", "unknown", "none"):
            return "Info"
        # Bilinmeyen bir string gelirse (LeakIX yeni bir kategori eklerse)
        # sessizce "Info"'ya düşür, ama logla ki fark edilsin.
        logger.warning("LeakIX: bilinmeyen severity string değeri: %r", severity)
        return "Info"

    # --- Eski format: sayısal (0-10) severity — geriye dönük uyumluluk ---
    try:
        numeric_severity = float(severity)
    except (TypeError, ValueError):
        logger.warning("LeakIX: severity ne string ne de sayısal: %r", severity)
        return "Info"

    if numeric_severity >= 8:
        return "Critical"
    if numeric_severity >= 6:
        return "High"
    if numeric_severity >= 3:
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
        logger.info("LeakIX: api-key header ayarlandı (%s...).", settings.leakix_api_key[:4])
    else:
        logger.warning(
            "LeakIX: api-key TANIMLI DEĞİL — anahtarsız istekler ciddi şekilde "
            "sınırlı/kotasız sonuç dönebilir. .env dosyasını kontrol edin."
        )

    results: List[NormalizedLeak] = []

    async with httpx.AsyncClient(
        base_url=settings.leakix_base_url,
        headers=headers,
        timeout=settings.http_timeout_seconds,
    ) as client:
        for scope in _SCOPES:
            built_query = _build_search_query(query, scope)
            if not built_query:
                logger.warning("LeakIX: boş/geçersiz arama terimi, scope=%s atlandı.", scope)
                continue

            params = {"scope": scope, "q": built_query}
            logger.info(
                "LeakIX isteği gönderiliyor: %s%s params=%s",
                settings.leakix_base_url, _SEARCH_PATH, params,
            )

            try:
                response = await client.get(_SEARCH_PATH, params=params)

                # --------------------------------------------------------- #
                # GEÇİCİ DEBUG (talep üzerine eklendi — sorun çözülünce kaldırın):
                # logger seviyesinden/kırpmadan bağımsız olarak, LeakIX'ten
                # dönen HTTP status kodunu ve TAM ham gövdeyi doğrudan
                # terminale basar. Hiçbir filtre veya 300 karakter limiti yok.
                # --------------------------------------------------------- #
                print("\n" + "=" * 80)
                print(f"[LEAKIX RAW DEBUG] scope={scope} query_param_gonderilen={built_query!r}")
                print(f"[LEAKIX RAW DEBUG] request_url={response.request.url}")
                print(f"[LEAKIX RAW DEBUG] status_code={response.status_code}")
                print(f"[LEAKIX RAW DEBUG] response_headers={dict(response.headers)}")
                print("[LEAKIX RAW DEBUG] response_body:")
                print(response.text)
                print("=" * 80 + "\n")

                logger.info(
                    "LeakIX yanıtı (scope=%s, query=%s): status=%s, body_preview=%s",
                    scope, query, response.status_code, response.text[:300],
                )

                if response.status_code == 429:
                    logger.error(
                        "❌ [LeakIX] 429 Rate-limited (scope=%s, query=%s). "
                        "x-limited-for=%s — bir sonraki istekten önce bu süre kadar beklenmeli.",
                        scope, query, response.headers.get("x-limited-for"),
                    )
                    continue

                response.raise_for_status()
                data = response.json() or []
                logger.info(
                    "LeakIX %s sorgusu %d ham kayıt döndürdü (query=%s).",
                    scope, len(data), query,
                )
            except httpx.HTTPStatusError as exc:
                print("\n" + "=" * 80)
                print(f"[LEAKIX RAW DEBUG - HTTP ERROR] scope={scope} query_param_gonderilen={built_query!r}")
                print(f"[LEAKIX RAW DEBUG - HTTP ERROR] status_code={exc.response.status_code}")
                print(f"[LEAKIX RAW DEBUG - HTTP ERROR] response_body:")
                print(exc.response.text)
                print("=" * 80 + "\n")

                logger.warning(
                    "LeakIX %s sorgusu başarısız oldu (%s): %s — yanıt: %s",
                    scope,
                    exc.response.status_code,
                    query,
                    exc.response.text[:300],
                )
                continue
            except httpx.RequestError as exc:
                logger.warning("LeakIX'e bağlanılamadı (%s): %s", scope, exc)
                continue

            normalized_count = 0
            for entry in data:
                try:
                    results.append(_normalize_entry(entry, query))
                    normalized_count += 1
                except Exception:  # noqa: BLE001 - tek bir bozuk kayıt tüm taramayı düşürmesin
                    severity_debug = (entry.get("leak") or {}).get("severity")
                    logger.exception(
                        "LeakIX kaydı normalize edilemedi (scope=%s, severity=%r): %s",
                        scope, severity_debug, entry,
                    )

            if normalized_count < len(data):
                logger.warning(
                    "LeakIX %s: %d/%d kayıt normalize edilemedi (query=%s) — yukarıdaki "
                    "'normalize edilemedi' loglarına bakın.",
                    scope, len(data) - normalized_count, len(data), query,
                )

    logger.info("LeakIX toplam %d normalize edilmiş sonuç döndü (query=%s).", len(results), query)
    return results