import os
import httpx
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

async def send_telegram_alert(leak_detail: dict):
    message = (
        "🚨 *Yeni Sızıntı Tespit Edildi!* 🚨\n\n"
        f"🌐 *Asset/Email:* `{leak_detail.get('asset', 'Bilinmiyor')}`\n"
        f"📊 *Market:* {leak_detail.get('market', 'Bilinmiyor')}\n"
        f"⚠️ *Öncelik:* {leak_detail.get('priority', 'Normal')}\n"
        f"🔍 *Sızıntı Tipi:* {leak_detail.get('leak_type', 'Credentials')}"
    )
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "Markdown"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload)
            print("Telegram Yanıtı:", response.status_code, response.text)
            return response.json()
        except Exception as e:
            print(f"Telegram bağlantı hatası: {e}")
            return {"error": str(e)}