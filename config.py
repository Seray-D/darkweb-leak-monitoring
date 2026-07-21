"""
Merkezi konfigürasyon yönetimi.

API anahtarlarını ve servis URL'lerini `.env` dosyasından okur.
Herhangi bir yerde API anahtarını hardcode YAZMAYIN — her zaman `settings` üzerinden okuyun.

Kurulum:
    pip install pydantic-settings python-dotenv
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- API Anahtarları ---
    leakix_api_key: str = ""
    otx_api_key: str = ""
    xposedornot_api_key: str = ""

    # --- Servis Base URL'leri (genelde değiştirmenize gerek yok) ---
    leakix_base_url: str = "https://leakix.net"
    otx_base_url: str = "https://otx.alienvault.com"
    xposedornot_base_url: str = "https://api.xposedornot.com"

    # --- Veritabanı ---
    database_url: str = "sqlite:///./leaks.db"

    # --- Bildirim Servisleri ---
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    slack_webhook_url: str = ""

    # --- HTTP istemci ayarları ---
    http_timeout_seconds: float = 10.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Settings nesnesini önbelleğe alarak her import'ta yeniden okumayı önler."""
    return Settings()


settings = get_settings()
