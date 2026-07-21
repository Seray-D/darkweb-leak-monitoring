"""
Telegram ve Slack üzerinden yeni sızıntı bildirimleri gönderir.

Sadece GERÇEKTEN YENİ eklenen kayıtlar (main.py'daki dedup filtresinden geçmiş)
olduğunda çağrılmalıdır — boş liste ile çağrılırsa hiçbir şey göndermez.

Her iki kanal da opsiyoneldir: .env'de ilgili değişkenler boşsa o kanal
sessizce atlanır. Bildirim gönderimindeki hatalar tarama işlemini
ETKİLEMEMELİDİR — bu yüzden tüm istekler try/except ile korunur ve
sadece loglanır.
"""

import logging
from typing import Iterable, Protocol

import httpx

from config import settings

logger = logging.getLogger(__name__)

_TELEGRAM_API_URL = "https://api.telegram.org/bot{token}/sendMessage"
_MAX_ITEMS_IN_MESSAGE = 10


class LeakLike(Protocol):
    """BreachLog (ORM) veya NormalizedLeak — ikisi de bu alanlara sahip."""

    asset: str
    leak_type: str
    market: str
    priority: str


def _build_message(new_leaks: list[LeakLike]) -> str:
    """Telegram/Slack için ortak, sade metin formatlı bildirim mesajı oluşturur."""
    count = len(new_leaks)
    lines = [f"🚨 *Yeni Sızıntı Uyarısı* — {count} yeni kayıt bulundu\n"]

    for leak in new_leaks[:_MAX_ITEMS_IN_MESSAGE]:
        lines.append(
            f"• *{leak.asset}* — {leak.leak_type} ({leak.market}) "
            f"— Öncelik: *{leak.priority}*"
        )

    remaining = count - _MAX_ITEMS_IN_MESSAGE
    if remaining > 0:
        lines.append(f"\n… ve {remaining} kayıt daha.")

    return "\n".join(lines)


async def _send_telegram(message: str) -> None:
    if not (settings.telegram_bot_token and settings.telegram_chat_id):
        return

    url = _TELEGRAM_API_URL.format(token=settings.telegram_bot_token)
    payload = {
        "chat_id": settings.telegram_chat_id,
        "text": message,
        "parse_mode": "Markdown",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout_seconds) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Telegram bildirimi gönderilemedi (%s): %s",
            exc.response.status_code,
            exc.response.text,
        )
    except httpx.RequestError as exc:
        logger.error("Telegram'a bağlanılamadı: %s", exc)


async def _send_slack(message: str) -> None:
    if not settings.slack_webhook_url:
        return

    # Slack Markdown yerine mrkdwn kullanır; Telegram'daki *bold* zaten uyumlu.
    payload = {"text": message}

    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout_seconds) as client:
            response = await client.post(settings.slack_webhook_url, json=payload)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Slack bildirimi gönderilemedi (%s): %s",
            exc.response.status_code,
            exc.response.text,
        )
    except httpx.RequestError as exc:
        logger.error("Slack'e bağlanılamadı: %s", exc)


async def send_leak_alert(new_leaks: Iterable[LeakLike]) -> None:
    """
    Sadece yeni eklenen sızıntı kayıtları için Telegram ve/veya Slack'e
    bildirim gönderir. Liste boşsa hiçbir istek atılmaz.

    Her iki kanal da bağımsız çalışır: biri başarısız olsa da diğeri denenir.
    Bildirim hataları çağıran kodu (main.py) etkilemez, sadece loglanır.
    """
    new_leaks = list(new_leaks)
    if not new_leaks:
        return

    message = _build_message(new_leaks)

    try:
        await _send_telegram(message)
    except Exception:  # noqa: BLE001 - bildirim hatası taramayı bozmamalı
        logger.exception("Telegram bildirimi gönderilirken beklenmeyen hata oluştu.")

    try:
        await _send_slack(message)
    except Exception:  # noqa: BLE001 - bildirim hatası taramayı bozmamalı
        logger.exception("Slack bildirimi gönderilirken beklenmeyen hata oluştu.")
