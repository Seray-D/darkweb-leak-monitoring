"""
xposed_service.py
XposedOrNot ücretsiz "check-email" servisine istek atan yardımcı fonksiyonlar.

Not: Bu servis API anahtarı gerektirmez ancak nazik rate-limit (~2 istek/saniye)
uygulamak sizin sorumluluğunuzdadır.
"""

from datetime import datetime, timezone
import httpx

XPOSED_BASE_URL = "https://api.xposedornot.com/v1/check-email"


async def check_email_breaches(email: str) -> dict:
    """
    XposedOrNot'a e-posta sorgusu gönderir.

    Dönen JSON tipik olarak şu şekildedir:
      - Sızıntı varsa: {"breaches": [["Breach1", "Breach2", ...]]}
      - Sızıntı yoksa: alanlar null / boş gelir (HTTP 200)
      - Hata durumunda XposedOrNot 404/429/5xx dönebilir.

    Returns:
        dict: {"found": bool, "breaches": list[str], "raw": <orijinal json veya None>}
    """
    url = f"{XPOSED_BASE_URL}/{email}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(url)
        except httpx.RequestError as exc:
            return {"found": False, "breaches": [], "error": f"Bağlantı hatası: {exc}"}

    if response.status_code == 404:
        # XposedOrNot bazı durumlarda "bulunamadı" için 404 döndürür
        return {"found": False, "breaches": [], "raw": None}

    if response.status_code == 429:
        return {"found": False, "breaches": [], "error": "Rate limit aşıldı (429). Lütfen bekleyip tekrar deneyin."}

    if response.status_code >= 500:
        return {"found": False, "breaches": [], "error": f"XposedOrNot sunucu hatası: {response.status_code}"}

    if response.status_code != 200:
        return {"found": False, "breaches": [], "error": f"Beklenmeyen durum kodu: {response.status_code}"}

    data = response.json()

    breaches_field = data.get("breaches") if isinstance(data, dict) else None

    if not breaches_field:
        return {"found": False, "breaches": [], "raw": data}

    # breaches genelde iç içe liste olarak gelir: [["A","B"]]
    flat_breaches: list[str] = []
    for item in breaches_field:
        if isinstance(item, list):
            flat_breaches.extend(item)
        else:
            flat_breaches.append(item)

    return {"found": True, "breaches": flat_breaches, "raw": data}


def build_breach_log_entries(email: str, scan_result: dict) -> list[dict]:
    """
    check_email_breaches() çıktısını breach_logs tablosuna uygun satır(lar)a çevirir.
    Her bulunan sızıntı kaynağı için ayrı bir kayıt oluşturur.
    """
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    if not scan_result.get("found"):
        return []

    entries = []
    for breach_name in scan_result["breaches"]:
        entries.append(
            {
                "asset": email.split("@")[-1] if "@" in email else "unknown",
                "email_leak": email,
                "leaked_password": "******",
                "leak_type": breach_name,
                "market": "XposedOrNot",
                "last_seen": now_str[:10],
                "certainty": "Confirmed",
                "status": "Active",
                "priority": "High",
                "discovery_date": now_str,
            }
        )
    return entries
