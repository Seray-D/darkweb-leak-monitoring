"""
Tüm servislerin (XposedOrNot, LeakIX, AlienVault OTX) ortak çıktı formatı.

Her servis kendi ham API yanıtını bu şemaya normalize eder, böylece main.py
kaynaktan bağımsız şekilde tek bir listeyi veritabanına yazabilir.
"""

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

Priority = Literal["Info", "Low", "Medium", "High", "Critical"]
Status = Literal["Active", "Monitoring", "Resolved"]
Certainty = Literal["Unsure", "Confirmed", "Verified"]


class NormalizedLeak(BaseModel):
    asset: str = Field(..., description="Domain, IP veya varlık adı")
    email_leak: str = Field(default="", description="İlişkili e-posta (varsa)")
    leaked_password: str = Field(default="******", description="Maskeli şifre / hassas alan")
    leak_type: str = Field(..., description="Örn: Botnet, Open Service, IOC, Combolist")
    market: str = Field(..., description="Kaynak servis: XposedOrNot, LeakIX, AlienVault OTX")
    last_seen: str = Field(..., description="YYYY-MM-DD formatında en son görülme tarihi")
    certainty: Certainty = "Unsure"
    status: Status = "Active"
    priority: Priority = "Info"
    discovery_date: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    )
    raw_source: Optional[str] = Field(
        default=None, description="Debug amaçlı: orijinal servis adı / referans id"
    )
