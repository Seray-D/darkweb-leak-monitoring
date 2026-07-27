import os
import logging
from datetime import datetime, timezone
from typing import List
import httpx
from schemas import NormalizedLeak
from services.telegram_service import send_telegram_alert  # Telegram servisi eklendi

logger = logging.getLogger(__name__)

async def search_breachdirectory(email: str) -> List[NormalizedLeak]:
    """
    BreachDirectory (RapidAPI) servisini kullanarak sızıntıları sorgular ve
    projenin ortak NormalizedLeak şemasına dönüştürür.
    """
    rapidapi_key = os.getenv("RAPIDAPI_KEY", "").strip()

    if not rapidapi_key:
        logger.warning("⚠️ [BreachDirectory] RAPIDAPI_KEY bulunamadı! .env dosyasını kontrol edin.")
        return []

    url = "https://breachdirectory.p.rapidapi.com/"

    headers = {
        "x-rapidapi-key": rapidapi_key,
        "x-rapidapi-host": "breachdirectory.p.rapidapi.com"
    }

    params = {
        "func": "auto",
        "term": email
    }

    logger.info(f"🔍 [BreachDirectory] Sorgu gönderiliyor: {email} (Key: {rapidapi_key[:5]}...)")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, params=params, timeout=10.0)

            logger.info(f"📡 [BreachDirectory] HTTP Durumu: {response.status_code}")

            if response.status_code == 401:
                logger.error("❌ [BreachDirectory] 401 Unauthorized — API anahtarı hatalı/eksik. Yanıt: %s", response.text)
                return []
            if response.status_code == 403:
                logger.error("❌ [BreachDirectory] 403 Forbidden — API anahtarı geçersiz. Yanıt: %s", response.text)
                return []
            if response.status_code == 429:
                logger.error("❌ [BreachDirectory] 429 Too Many Requests — limit aşıldı. Yanıt: %s", response.text)
                return []
            if response.status_code == 500:
                logger.warning("⚠️ [BreachDirectory] 500 — sonuç bulunamadı ya da sunucu hatası. Yanıt: %s", response.text)
                return []
            if response.status_code != 200:
                logger.error(f"❌ [BreachDirectory] Yanıt Hatası ({response.status_code}): {response.text}")
                return []

            data = response.json()
            logger.info(f"📦 [BreachDirectory] Gelen Ham Yanıt: {data}")

            if not isinstance(data, dict):
                logger.warning("⚠️ [BreachDirectory] Beklenmeyen yanıt tipi (dict değil): %s", type(data))
                return []

            results = data.get("result") or []
            if not isinstance(results, list) or not results:
                logger.info(f"ℹ️ [BreachDirectory] Sonuç bulunamadı: {data.get('message', 'kayıt yok')}")
                return []

            domain = email.split("@")[-1] if "@" in email else email
            now = datetime.now(timezone.utc)
            normalized_list: List[NormalizedLeak] = []

            for item in results:
                if not isinstance(item, dict):
                    continue

                raw_sha1 = item.get("sha1") or item.get("hash") or ""
                password = item.get("password") or None
                has_password = bool(password) or item.get("has_password") is True

                sources = item.get("sources")
                if isinstance(sources, list) and sources:
                    source_label = ", ".join(str(s) for s in sources)
                elif isinstance(sources, str) and sources:
                    source_label = sources
                else:
                    source_label = "RapidAPI-BreachDirectory"

                if has_password:
                    leak_type = "Credential Breach (Password Exposed)"
                elif raw_sha1:
                    leak_type = "Credential Breach (Hash Exposed)"
                else:
                    leak_type = "Credential Breach"

                leak_item = NormalizedLeak(
                    asset=domain,
                    email_leak=email,
                    leaked_password=password if has_password else "******",
                    leak_type=leak_type,
                    market="BreachDirectory",
                    last_seen=now.strftime("%Y-%m-%d"),
                    certainty="Confirmed",
                    status="Active",
                    priority="Critical" if has_password else "High",
                    discovery_date=now.strftime("%Y-%m-%d %H:%M:%S"),
                    raw_source=raw_sha1 or source_label
                )
                normalized_list.append(leak_item)

                # YENİ EKLENEN KISIM: Her yeni sızıntı tespit edildiğinde Telegram bildirimi tetikler
                try:
                    await send_telegram_alert({
                        "asset": email,
                        "market": "BreachDirectory",
                        "priority": leak_item.priority,
                        "leak_type": leak_item.leak_type
                    })
                except Exception as tg_err:
                    logger.error(f"Telegram bildirim hatası: {tg_err}")

            logger.info(f"✅ [BreachDirectory] {len(normalized_list)} adet kayıt başarıyla işlendi.")
            return normalized_list

        except Exception as exc:
            logger.error(f"❌ [BreachDirectory] Çağrıda hata oluştu: {exc}")
            return []