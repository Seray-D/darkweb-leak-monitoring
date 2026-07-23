"""
crt.sh (Certificate Transparency Logs) üzerinden pasif subdomain keşfi.

Bu servis HERHANGİ bir DNS sorgusu yapmaz ve domain sahipliği doğrulaması
gerektirmez. Sadece crt.sh'nin kamuya açık JSON API'sini okuyarak, verilen
domain için geçmişte düzenlenmiş SSL/TLS sertifikalarındaki (SAN alanları
dahil) alt alan adlarını (subdomain) çıkarır ve tekilleştirir.

Kaynak: https://crt.sh/?q=<domain>&output=json
"""

import json
import logging
import re
from typing import List, Set

import httpx

logger = logging.getLogger(__name__)

CRTSH_URL = "https://crt.sh/"
REQUEST_TIMEOUT = 20.0

# Sertifika kayıtlarından çıkarılan isimlerin basit doğrulaması:
# sadece harf, rakam, nokta ve tire içermeli (aksi halde atlanır).
_VALID_HOSTNAME_RE = re.compile(r"^[a-z0-9.\-]+$")


async def search_crtsh(domain: str) -> List[str]:
    """
    Verilen domain için crt.sh'de kayıtlı tüm sertifikaları tarar ve
    bu domain'e ait benzersiz alt alan adlarını alfabetik sırayla döner.

    Hata durumunda (timeout, 5xx, parse hatası vb.) boş liste döner;
    bu servis diğer OSINT kaynakları gibi "best effort" çalışır ve
    genel taramayı bloklamaz.
    """
    domain = (domain or "").strip().lower().strip(".")
    if not domain:
        return []

    params = {"q": f"%.{domain}", "output": "json"}

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(
                CRTSH_URL,
                params=params,
                headers={"User-Agent": "Mozilla/5.0 (compatible; LeakMonitor/1.0)"},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("crt.sh isteği başarısız oldu (domain=%s): %s", domain, exc)
        return []

    entries = _parse_crtsh_response(response.text, domain)
    if entries is None:
        return []

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


def _parse_crtsh_response(raw_text: str, domain: str):
    """
    crt.sh yanıtı standart JSON listesi olmalı, ancak servis bazen boş
    body veya bozuk/kesik JSON dönebiliyor. Bu yüzden toleranslı parse ederiz.
    """
    text = (raw_text or "").strip()
    if not text:
        return []

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("crt.sh yanıtı JSON olarak parse edilemedi (domain=%s).", domain)
        return None

    if not isinstance(data, list):
        return []

    return data


def _clean_hostname(raw_name: str, root_domain: str) -> str:
    """
    Ham sertifika ismini temizler:
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
