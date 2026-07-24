"""
Pasif Subdomain Keşfi — Certificate Transparency (crt.sh) + yedek (HackerTarget).

Bu servis HERHANGİ bir DNS sorgusu yapmaz ve domain sahipliği doğrulaması
gerektirmez; yalnızca kamuya açık, ücretsiz OSINT API'lerini okur.

Kaynaklar:
  1) BİRİNCİL: crt.sh (Certificate Transparency Logs)
     https://crt.sh/?q=<domain>&output=json
  2) YEDEK: HackerTarget hostsearch API (crt.sh tükendiğinde otomatik devreye girer)
     https://api.hackertarget.com/hostsearch/?q=<domain>

--------------------------------------------------------------------------
NEDEN YEDEK KAYNAK VAR?
crt.sh'nin arkasındaki tek PostgreSQL sunucusu sık sık 502/503 veriyor veya
zaman aşımına uğruyor; ayrıca yoğun sorgularda JSON çıktısını geçerli bir
dizi olarak değil, nesneleri "}{" ile art arda ekleyerek bozuk şekilde
döndürdüğü biliniyor (bkz. github.com/PaulSec/crt.sh). search_crtsh():
  1) Önce crt.sh'yi dener (bozuk JSON onarımı + 5xx/timeout için üstel
     beklemeli 3 deneme),
  2) crt.sh tüm denemelerden sonra hâlâ başarısızsa, kullanıcıya HİÇBİR
     hata göstermeden otomatik olarak HackerTarget'a geçer,
  3) Yalnızca HER İKİ kaynak da başarısız olursa SubdomainLookupError
     fırlatılır (yani gerçek bir servis kesintisi anlamına gelir, "0
     sonuç" ile karıştırılmaz).
--------------------------------------------------------------------------
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import List, Optional, Set

import httpx

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------- #
# Birincil kaynak: crt.sh
# --------------------------------------------------------------------- #

CRTSH_URL = "https://crt.sh/"
CRTSH_TIMEOUT = 30.0  # crt.sh sık sık yavaş yanıt veriyor; 20sn çoğu zaman yetersiz kalıyordu
CRTSH_MAX_RETRIES = 3
CRTSH_RETRY_BACKOFF_SECONDS = 2.0  # denemeler arası: 2s, 4s, 6s
CRTSH_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

# --------------------------------------------------------------------- #
# Yedek kaynak: HackerTarget hostsearch
# --------------------------------------------------------------------- #

HACKERTARGET_URL = "https://api.hackertarget.com/hostsearch/"
HACKERTARGET_TIMEOUT = 15.0
# HackerTarget hata/kota mesajlarını 200 status + düz metin olarak döner (JSON değil).
HACKERTARGET_ERROR_MARKERS = ("error", "api count exceeded")

# Sertifika/host kayıtlarından çıkarılan isimlerin basit doğrulaması:
# sadece harf, rakam, nokta ve tire içermeli (aksi halde atlanır).
_VALID_HOSTNAME_RE = re.compile(r"^[a-z0-9.\-]+$")


class SubdomainLookupError(Exception):
    """
    Hem crt.sh hem de yedek kaynak (HackerTarget) başarısız olduğunda
    yükseltilir. Bu, "domain'in gerçekten 0 subdomain'i var" durumundan
    kasıtlı olarak AYRI tutulur; main.py bunu yakalayıp kullanıcıya uygun
    bir hata mesajı döndürür.
    """


# Geriye dönük uyumluluk: main.py hâlâ `crtsh_service.CrtShUnavailableError`
# adıyla import/except ediyor olabilir — aynı sınıfa işaret eder.
CrtShUnavailableError = SubdomainLookupError


@dataclass
class SubdomainLookupResult:
    subdomains: List[str]
    source: str  # "crt.sh" | "hackertarget"


async def search_crtsh(domain: str) -> List[str]:
    """
    Geriye dönük uyumluluk için korunan giriş noktası (main.py bunu çağırıyor).
    Sade bir List[str] döner. Hangi kaynağın kullanıldığını da öğrenmek
    isterseniz search_subdomains() kullanın (ör. UI'da "kaynak: hackertarget"
    rozeti göstermek için).
    """
    result = await search_subdomains(domain)
    return result.subdomains


async def search_subdomains(domain: str) -> SubdomainLookupResult:
    """
    Önce crt.sh'yi dener; tüm denemeler (timeout, 5xx, bozuk JSON) başarısız
    olursa kullanıcıya hiçbir hata yansıtmadan otomatik olarak HackerTarget'a
    geçer. Yalnızca ikisi de başarısız olursa SubdomainLookupError fırlatır.
    """
    domain = (domain or "").strip().lower().strip(".")
    if not domain:
        return SubdomainLookupResult(subdomains=[], source="crt.sh")

    try:
        subdomains = await _search_crtsh_only(domain)
        return SubdomainLookupResult(subdomains=subdomains, source="crt.sh")
    except SubdomainLookupError as primary_error:
        logger.warning(
            "crt.sh kullanılamıyor, HackerTarget yedek kaynağına geçiliyor (domain=%s): %s",
            domain, primary_error,
        )

    try:
        subdomains = await _search_hackertarget(domain)
        return SubdomainLookupResult(subdomains=subdomains, source="hackertarget")
    except SubdomainLookupError as fallback_error:
        logger.error(
            "Hem crt.sh hem HackerTarget başarısız oldu (domain=%s): %s", domain, fallback_error
        )
        raise SubdomainLookupError(
            "crt.sh ve yedek kaynak (HackerTarget) her ikisi de şu anda erişilemez durumda."
        ) from fallback_error


# --------------------------------------------------------------------- #
# crt.sh implementasyonu
# --------------------------------------------------------------------- #

async def _search_crtsh_only(domain: str) -> List[str]:
    params = {"q": f"%.{domain}", "output": "json"}
    last_error: Optional[Exception] = None

    async with httpx.AsyncClient(timeout=CRTSH_TIMEOUT) as client:
        for attempt in range(1, CRTSH_MAX_RETRIES + 1):
            try:
                response = await client.get(
                    CRTSH_URL,
                    params=params,
                    headers={
                        "User-Agent": "Mozilla/5.0 (compatible; LeakMonitor/1.0)",
                        "Accept": "application/json",
                    },
                )

                if response.status_code in CRTSH_RETRYABLE_STATUS_CODES:
                    last_error = httpx.HTTPStatusError(
                        f"crt.sh {response.status_code} döndürdü",
                        request=response.request,
                        response=response,
                    )
                    logger.warning(
                        "crt.sh geçici hata verdi (domain=%s, deneme=%d/%d, status=%d)",
                        domain, attempt, CRTSH_MAX_RETRIES, response.status_code,
                    )
                    await asyncio.sleep(CRTSH_RETRY_BACKOFF_SECONDS * attempt)
                    continue

                response.raise_for_status()

                entries = _parse_crtsh_response(response.text, domain)
                return _extract_subdomains_from_crtsh(entries, domain)

            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = exc
                logger.warning(
                    "crt.sh zaman aşımına uğradı/bağlantı hatası (domain=%s, deneme=%d/%d): %s",
                    domain, attempt, CRTSH_MAX_RETRIES, exc,
                )
                await asyncio.sleep(CRTSH_RETRY_BACKOFF_SECONDS * attempt)
            except httpx.HTTPStatusError as exc:
                # Retry listesinde olmayan bir HTTP hatası (ör. 400) — beklemeden vazgeç.
                logger.error("crt.sh beklenmeyen HTTP hatası (domain=%s): %s", domain, exc)
                raise SubdomainLookupError(str(exc)) from exc

    raise SubdomainLookupError(str(last_error) if last_error else "crt.sh yanıt vermiyor")


def _parse_crtsh_response(raw_text: str, domain: str) -> list:
    """
    crt.sh yanıtı standart bir JSON listesi olmalı, ancak servis çok sonuçlu
    sorgularda nesneleri "}{" ile birleşik (geçersiz) döndürebiliyor —
    bilinen bir crt.sh API tuhaflığı. Önce normal json.loads denenir;
    başarısız olursa "}{" -> "},{" onarımı yapılıp tekrar denenir.
    """
    text = (raw_text or "").strip()
    if not text:
        return []

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        repaired = text.replace("}{", "},{")
        if not repaired.startswith("["):
            repaired = f"[{repaired}]"
        try:
            data = json.loads(repaired)
            logger.info("crt.sh yanıtı bozuk geldi, onarılarak parse edildi (domain=%s).", domain)
        except json.JSONDecodeError as exc:
            logger.error(
                "crt.sh yanıtı onarım sonrası da parse edilemedi (domain=%s): %s", domain, exc
            )
            raise SubdomainLookupError("crt.sh geçersiz/bozuk JSON döndürdü") from exc

    if not isinstance(data, list):
        return []

    return data


def _extract_subdomains_from_crtsh(entries: list, domain: str) -> List[str]:
    subdomains: Set[str] = set()
    for entry in entries:
        name_value = entry.get("name_value", "") if isinstance(entry, dict) else ""
        if not name_value:
            continue
        # Bir sertifikanın SAN alanında birden fazla isim "\n" ile ayrılmış olabilir.
        for raw_name in name_value.split("\n"):
            cleaned = _clean_hostname(raw_name, domain)
            if cleaned:
                subdomains.add(cleaned)

    return sorted(subdomains)


# --------------------------------------------------------------------- #
# HackerTarget implementasyonu (yedek)
# --------------------------------------------------------------------- #

async def _search_hackertarget(domain: str) -> List[str]:
    """
    HackerTarget'ın ücretsiz hostsearch API'si CSV benzeri düz metin döner:
        www.example.com,93.184.216.34
        mail.example.com,93.184.216.35
    Hata durumlarını da (rate limit / geçersiz domain) 200 status + düz
    metin mesajıyla döndürür (ör. "API count exceeded..." veya
    "error check your search parameter"), bu yüzden içerik satır satır
    kontrol edilir. Ücretsiz kota IP başına günde ~50 sorgu ile sınırlıdır.
    """
    try:
        async with httpx.AsyncClient(timeout=HACKERTARGET_TIMEOUT) as client:
            response = await client.get(
                HACKERTARGET_URL,
                params={"q": domain},
                headers={"User-Agent": "Mozilla/5.0 (compatible; LeakMonitor/1.0)"},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("HackerTarget isteği başarısız oldu (domain=%s): %s", domain, exc)
        raise SubdomainLookupError(str(exc)) from exc

    text = (response.text or "").strip()
    if not text:
        return []

    lowered = text.lower()
    if any(marker in lowered for marker in HACKERTARGET_ERROR_MARKERS):
        logger.warning(
            "HackerTarget hata/kota mesajı döndürdü (domain=%s): %s", domain, text[:120]
        )
        raise SubdomainLookupError(f"HackerTarget: {text[:120]}")

    subdomains: Set[str] = set()
    for line in text.splitlines():
        hostname = line.split(",")[0].strip()
        cleaned = _clean_hostname(hostname, domain)
        if cleaned:
            subdomains.add(cleaned)

    return sorted(subdomains)


# --------------------------------------------------------------------- #
# Ortak yardımcılar
# --------------------------------------------------------------------- #

def _clean_hostname(raw_name: str, root_domain: str) -> str:
    """
    Ham hostname'i temizler:
    - Wildcard öneki (*.) kaldırılır
    - Baş/son boşluk ve nokta temizlenir
    - Sadece hostname karakter kümesine uyanlar kabul edilir
    - Aranan root domain'in gerçekten bir parçası olduğu doğrulanır
      (ör. "evilexample.com" içinde "example.com" araması eşleşmesin diye
      sondan eşleşme kontrolü yapılır)
    """
    name = raw_name.strip().lower().strip(".")
    if not name:
        return ""

    if name.startswith("*."):
        name = name[2:]

    if not name or not _VALID_HOSTNAME_RE.match(name):
        return ""

    if name != root_domain and not name.endswith("." + root_domain):
        return ""

    return name
