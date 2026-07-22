"""
Domain Sahiplik Doğrulaması (DNS TXT Verification) servisi.

Kullanıcının izlemeye aldığı bir domain'in gerçekten kendisine ait olduğunu
kanıtlamak için, MonitoredAsset oluşturulurken üretilen `verification_token`
değerinin domain'in DNS TXT kayıtlarında

    leak-monitor-verify=<token>

formatında yayınlanmasını bekleriz. Bu modül sadece bu kontrolü yapar;
veritabanı işlemleri (is_verified=True yapmak vb.) main.py tarafındaki
endpoint'te gerçekleştirilir.
"""

import logging

import dns.asyncresolver
import dns.exception
import dns.resolver

logger = logging.getLogger(__name__)

TXT_RECORD_PREFIX = "leak-monitor-verify="
DNS_LOOKUP_TIMEOUT_SECONDS = 10.0


def _normalize_txt_value(raw_value: str) -> str:
    """
    TXT kaydı değerini karşılaştırmaya uygun hale getirir:
    - Baş/son boşlukları temizler
    - Sarmalayan çift tırnakları temizler
    - İçerideki tüm boşlukları kaldırır (bazı DNS sağlayıcıları TXT
      değerlerini parçalara bölüp aralarına boşluk koyabiliyor)
    - Küçük harfe çevirir
    """
    cleaned = (raw_value or "").strip()
    if cleaned.startswith('"') and cleaned.endswith('"') and len(cleaned) >= 2:
        cleaned = cleaned[1:-1]
    cleaned = cleaned.strip().replace(" ", "")
    return cleaned.lower()


def _decode_txt_rdata(rdata) -> str:
    """
    dnspython TXT rdata'sı, uzun değerlerde birden fazla string parçasına
    (rdata.strings) bölünmüş olabilir. Hepsini birleştirip tek bir string
    olarak döneriz.
    """
    parts = []
    for chunk in getattr(rdata, "strings", []):
        if isinstance(chunk, bytes):
            parts.append(chunk.decode("utf-8", errors="ignore"))
        else:
            parts.append(str(chunk))
    return "".join(parts)


async def verify_domain_txt(domain: str, expected_token: str) -> bool:
    """
    Verilen `domain`'in TXT kayıtlarını sorgular ve
    `leak-monitor-verify=<expected_token>` değerinin mevcut olup
    olmadığını kontrol eder.

    DNS sorgusu başarısız olursa (NXDOMAIN, NoAnswer, timeout, vb.)
    exception fırlatmaz; sadece False döner ve durumu loglar. Böylece
    çağıran taraf (main.py) her zaman tek bir boolean ile ilgilenir.
    """
    cleaned_domain = (domain or "").strip().strip(".")
    cleaned_token = (expected_token or "").strip()

    if not cleaned_domain or not cleaned_token:
        logger.warning(
            "[DNS Verify] Geçersiz parametre: domain='%s', token boş mu=%s",
            cleaned_domain,
            not bool(cleaned_token),
        )
        return False

    expected_normalized = _normalize_txt_value(f"{TXT_RECORD_PREFIX}{cleaned_token}")

    try:
        answers = await dns.asyncresolver.resolve(
            cleaned_domain, "TXT", lifetime=DNS_LOOKUP_TIMEOUT_SECONDS
        )
    except dns.resolver.NXDOMAIN:
        logger.warning("[DNS Verify] Domain bulunamadı (NXDOMAIN): %s", cleaned_domain)
        return False
    except dns.resolver.NoAnswer:
        logger.warning("[DNS Verify] TXT kaydı yok: %s", cleaned_domain)
        return False
    except dns.resolver.NoNameservers:
        logger.warning(
            "[DNS Verify] Nameserver'lara ulaşılamadı: %s", cleaned_domain
        )
        return False
    except dns.exception.Timeout:
        logger.warning("[DNS Verify] DNS sorgusu zaman aşımına uğradı: %s", cleaned_domain)
        return False
    except Exception as exc:  # Beklenmeyen diğer hatalar
        logger.error("[DNS Verify] Beklenmeyen hata (%s): %s", cleaned_domain, exc)
        return False

    for rdata in answers:
        combined_value = _decode_txt_rdata(rdata)
        if _normalize_txt_value(combined_value) == expected_normalized:
            logger.info("[DNS Verify] Doğrulama başarılı: %s", cleaned_domain)
            return True

    logger.info(
        "[DNS Verify] TXT kayıtları bulundu ama beklenen token eşleşmedi: %s",
        cleaned_domain,
    )
    return False
