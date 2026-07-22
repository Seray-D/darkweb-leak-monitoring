"""
Tüm servislerin (XposedOrNot, LeakIX, AlienVault OTX) ortak çıktı formatı.

Her servis kendi ham API yanıtını bu şemaya normalize eder, böylece main.py
kaynaktan bağımsız şekilde tek bir listeyi veritabanına yazabilir.
"""

from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

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


# --------------------------------------------------------------------- #
# İzlenen Varlıklar (Monitored Assets) modülü şemaları
#
# NOT: Buradaki AssetBreachLogOut, ad-hoc arama şeması olan NormalizedLeak
# ile KARIŞTIRILMAMALIDIR. NormalizedLeak / BreachLog anlık tarama
# sonuçlarını, AssetBreachLog ise izlenen bir varlığa bağlı KALICI sızıntı
# geçmişini temsil eder (bkz. models.py).
# --------------------------------------------------------------------- #

AssetType = Literal["email", "domain"]


class MonitoredAssetCreate(BaseModel):
    target: str = Field(..., description="İzlenecek e-posta veya domain")

    @field_validator("target")
    @classmethod
    def target_not_blank(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("target boş olamaz.")
        return cleaned


class AssetBreachLogOut(BaseModel):
    id: int
    breach_name: str
    breach_date: Optional[str] = None
    exposed_data_types: str = ""
    created_at: datetime

    class Config:
        from_attributes = True


class MonitoredAssetOut(BaseModel):
    id: int
    target: str
    asset_type: AssetType
    is_verified: bool
    # Frontend'in kullanıcıya "DNS'inize şu TXT kaydını ekleyin" diye
    # gösterebilmesi için doğrulama tokenı.
    verification_token: str
    created_at: datetime
    breach_logs: List[AssetBreachLogOut] = Field(default_factory=list)

    class Config:
        from_attributes = True
