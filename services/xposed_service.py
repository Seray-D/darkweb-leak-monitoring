"""
XposedOrNot entegrasyonu.

ÖNEMLİ (FIX): Eskiden burada /v1/check-email/{email} kullanılıyordu. O
endpoint sadece breach İSİMLERİNDEN oluşan tek bir string listesi döner:

    {"breaches": [["Tesco", "Adobe", "LinkedIn"]], "email": "...", "status": "success"}

yani dict değil, string listesi — bu yüzden xposed_adapter.py'daki
`isinstance(item, dict)` filtresi HER ZAMAN False dönüyor ve tüm veri
sessizce eleniyordu (exception yok, sadece filtre hiç geçmiyordu).

Bunun yerine /v1/breach-analytics?email=... kullanıyoruz. Bu endpoint
gerçek dict'lerden oluşan, SOC için anlamlı alanlar içeren
(breach, xposed_date, password_risk, verified, xposed_data, xposed_records)
"ExposedBreaches.breaches_details" listesini döner.

Kayıt bulunamadığında API HTTP 200 ile tüm alanları null döner:
    {"BreachMetrics": null, "BreachesSummary": {...}, "ExposedBreaches": null, ...}
"""

import logging
import httpx

logger = logging.getLogger(__name__)

XPOSED_ANALYTICS_URL = "https://api.xposedornot.com/v1/breach-analytics"


async def check_email(email: str) -> list:
    """
    XposedOrNot breach-analytics API'sine istek atarak verilen e-posta
    adresine ait DETAYLI sızıntı kayıtlarını (ham dict listesi olarak) getirir.

    Dönen liste, her biri şu alanları (mevcutsa) içeren dict'lerden oluşur:
    breach, xposed_data, xposed_records, xposed_date, password_risk,
    searchable, verified, domain.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                XPOSED_ANALYTICS_URL,
                params={"email": email},
                timeout=10.0,
            )

            if response.status_code == 200:
                data = response.json()

                if not isinstance(data, dict):
                    logger.warning(
                        "XposedOrNot beklenmeyen yanıt tipi (JSON dict değil): %s",
                        type(data),
                    )
                    return []

                exposed = data.get("ExposedBreaches")

                # Kayıt bulunamadığında ExposedBreaches null döner — bu bir
                # hata değil, "temiz" sonuç anlamına gelir.
                if not exposed:
                    logger.info("XposedOrNot: %s için kayıt bulunamadı.", email)
                    return []

                if not isinstance(exposed, dict):
                    logger.warning(
                        "XposedOrNot: ExposedBreaches beklenmeyen formatta: %s",
                        type(exposed),
                    )
                    return []

                details = exposed.get("breaches_details") or []
                if not isinstance(details, list):
                    logger.warning(
                        "XposedOrNot: breaches_details beklenmeyen formatta: %s",
                        type(details),
                    )
                    return []

                logger.info(
                    "✅ [XposedOrNot] %s için %s adet detaylı breach kaydı bulundu.",
                    email,
                    len(details),
                )
                return details

            elif response.status_code == 404:
                logger.info("XposedOrNot: %s için kayıt bulunamadı (404).", email)
                return []
            elif response.status_code == 429:
                logger.error(
                    "❌ [XposedOrNot] 429 Too Many Requests — rate limit aşıldı. "
                    "Retry-After header: %s",
                    response.headers.get("Retry-After"),
                )
                return []
            elif response.status_code == 403:
                logger.error(
                    "❌ [XposedOrNot] 403 Forbidden — erişim reddedildi: %s",
                    response.text,
                )
                return []
            else:
                logger.warning(
                    "XposedOrNot beklenmeyen yanıt (%s): %s",
                    response.status_code,
                    response.text,
                )
                return []

        except Exception as exc:
            logger.error("XposedOrNot isteği sırasında hata oluştu: %s", exc)
            return []
