"""
Subdomain Canlılık Kontrolü (Liveness Check).

crt.sh / HackerTarget'tan gelen subdomain listesindeki her bir host'un
şu anda ayakta olup olmadığını (HTTP(S) yanıt verip vermediğini) kontrol
eder. Bu adım KEŞİF'ten (search_subdomains) kasıtlı olarak AYRI tutulur:
kullanıcı önce (hızlı) ham listeyi görür, canlılık kontrolünü isterse
ayrıca ("Canlılık Kontrolü Yap" butonu) tetikler — böylece yüzlerce
subdomain çıkan domainlerde ilk yanıt yavaşlamaz.

Yöntem (her subdomain için):
  1) https:// üzerinden HEAD denenir (en ucuz istek).
  2) Sunucu HEAD'i desteklemiyorsa (405/501 veya bağlantı hatası) aynı
     şema üzerinden GET'e düşülür.
  3) https tamamen başarısızsa (bağlantı hatası/timeout — 4xx/5xx DEĞİL,
     onlar zaten "canlı ama hata veriyor" anlamına gelir) http:// ile
     aynı adımlar tekrarlanır.
  4) İkisi de başarısız olursa alive=False, error alanına kısa sebep yazılır.

Eşzamanlılık asyncio.Semaphore ile sınırlanır (hedef sunuculara/ağa aşırı
yük bindirmemek için) — varsayılan 25.
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import List, Optional

import httpx

logger = logging.getLogger(__name__)

LIVENESS_CONCURRENCY_LIMIT = 25
LIVENESS_TIMEOUT_SECONDS = 6.0
LIVENESS_MAX_SUBDOMAINS_PER_REQUEST = 500  # tek seferde kontrol edilebilecek üst sınır (kötüye kullanımı önlemek için)

# HEAD desteklenmiyorsa GET'e düşülmesini tetikleyen durum kodları.
_HEAD_UNSUPPORTED_STATUS_CODES = {405, 501}

_REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; LeakMonitor/1.0)",
}


@dataclass
class LivenessResult:
    subdomain: str
    alive: bool
    scheme: Optional[str] = None       # "https" | "http" | None
    status_code: Optional[int] = None
    response_time_ms: Optional[int] = None
    error: Optional[str] = None        # alive=False iken kısa hata açıklaması


async def check_liveness(subdomains: List[str]) -> List[LivenessResult]:
    """
    Verilen subdomain listesini eşzamanlı olarak kontrol eder ve her biri
    için bir LivenessResult döner (sıra garanti edilmez değil, giriş
    sırasıyla aynı sırada döner).
    """
    cleaned = [s.strip().lower().strip(".") for s in subdomains if s and s.strip()]
    # Tekilleştir ama sırayı koru.
    seen = set()
    unique_subdomains: List[str] = []
    for s in cleaned:
        if s not in seen:
            seen.add(s)
            unique_subdomains.append(s)

    if not unique_subdomains:
        return []

    if len(unique_subdomains) > LIVENESS_MAX_SUBDOMAINS_PER_REQUEST:
        logger.warning(
            "Liveness check isteği %s subdomain içeriyor, ilk %s tanesiyle sınırlandırıldı.",
            len(unique_subdomains), LIVENESS_MAX_SUBDOMAINS_PER_REQUEST,
        )
        unique_subdomains = unique_subdomains[:LIVENESS_MAX_SUBDOMAINS_PER_REQUEST]

    semaphore = asyncio.Semaphore(LIVENESS_CONCURRENCY_LIMIT)

    async with httpx.AsyncClient(
        timeout=LIVENESS_TIMEOUT_SECONDS,
        follow_redirects=True,
        verify=False,  # kendi imzalı / süresi geçmiş sertifikalar canlılığı engellemesin
    ) as client:
        tasks = [
            _check_single_host(client, semaphore, subdomain)
            for subdomain in unique_subdomains
        ]
        return await asyncio.gather(*tasks)


async def _check_single_host(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    subdomain: str,
) -> LivenessResult:
    async with semaphore:
        for scheme in ("https", "http"):
            result = await _try_scheme(client, subdomain, scheme)
            if result is not None:
                return result

        return LivenessResult(
            subdomain=subdomain,
            alive=False,
            error="Ne https ne de http üzerinden yanıt alınamadı (timeout/bağlantı hatası).",
        )


async def _try_scheme(
    client: httpx.AsyncClient, subdomain: str, scheme: str
) -> Optional[LivenessResult]:
    """
    Belirtilen şema için HEAD (gerekirse GET fallback) dener.
    Bağlantı kurulup bir HTTP yanıtı alınabildiyse (status kodu ne olursa
    olsun) LivenessResult döner — bağlantı hiç kurulamadıysa None döner
    (böylece çağıran taraf diğer şemayı deneyebilir).
    """
    url = f"{scheme}://{subdomain}/"
    start = time.monotonic()

    try:
        response = await client.head(url, headers=_REQUEST_HEADERS)
        if response.status_code in _HEAD_UNSUPPORTED_STATUS_CODES:
            response = await client.get(url, headers=_REQUEST_HEADERS)
    except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPError):
        try:
            response = await client.get(url, headers=_REQUEST_HEADERS)
        except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPError) as exc:
            logger.debug("%s (%s) yanıt vermedi: %s", subdomain, scheme, exc)
            return None

    elapsed_ms = int((time.monotonic() - start) * 1000)
    return LivenessResult(
        subdomain=subdomain,
        alive=True,
        scheme=scheme,
        status_code=response.status_code,
        response_time_ms=elapsed_ms,
    )
