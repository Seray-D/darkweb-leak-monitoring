import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from database import Base

def _generate_verification_token() -> str:
    """Domain Sahiplik Doğrulaması (DNS TXT) için 16 karakterlik rastgele token üretir."""
    return uuid.uuid4().hex[:16]

class BreachLog(Base):
    """
    Anlık (ad-hoc) /api/v1/scan sonuçları için kullanılan mevcut model.
    Her yeni tarama başında ve panel ilk açılışında TAMAMEN silinir.
    """

    __tablename__ = "breach_logs"

    id = Column(Integer, primary_key=True, index=True)
    asset = Column(String, index=True, nullable=False)
    email_leak = Column(String, default="")
    leaked_password = Column(String, default="******")
    leak_type = Column(String, nullable=False)
    market = Column(String, nullable=False)
    last_seen = Column(String, default="-")
    certainty = Column(String, default="Unsure")
    status = Column(String, default="Active")
    priority = Column(String, default="Info")
    discovery_date = Column(String, nullable=False)
    raw_source = Column(String, default="", index=True)

    # --- SOC / Stealer Log detay alanları ---
    url = Column(String, default="")
    ip_info = Column(String, default="")
    hostname = Column(String, default="")
    malware_path = Column(String, default="")


class MonitoredAsset(Base):
    """
    Kullanıcının anlık arama dışında SÜREKLİ izlemek istediği e-posta veya domain kaydı.
    """

    __tablename__ = "monitored_assets"

    id = Column(Integer, primary_key=True, index=True)
    target = Column(String, nullable=False, unique=True, index=True)
    asset_type = Column(String, nullable=False)  # 'email' | 'domain'
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(
        String, nullable=False, unique=True, default=_generate_verification_token
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    breach_logs = relationship(
        "AssetBreachLog",
        back_populates="monitored_asset",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="AssetBreachLog.id.desc()",
    )


class AssetBreachLog(Base):
    """
    Bir MonitoredAsset'e bağlı KALICI sızıntı geçmişini tutar.
    Ad-hoc BreachLog ile birebir aynı detay alanlarına sahip olacak şekilde güncellenmiştir.
    """

    __tablename__ = "asset_breach_logs"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(
        Integer,
        ForeignKey("monitored_assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # BreachLog ile birebir aynı veri alanları
    asset = Column(String, index=True, nullable=False)
    email_leak = Column(String, default="")
    leaked_password = Column(String, default="******")
    leak_type = Column(String, nullable=False)
    market = Column(String, nullable=False)
    last_seen = Column(String, default="-")
    certainty = Column(String, default="Unsure")
    status = Column(String, default="Active")
    priority = Column(String, default="Info")
    discovery_date = Column(String, nullable=False)
    raw_source = Column(String, default="", index=True)
    
    # --- SOC / Stealer Log detay alanları (BreachLog ile birebir aynı) ---
    url = Column(String, default="")
    ip_info = Column(String, default="")
    hostname = Column(String, default="")
    malware_path = Column(String, default="")

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    monitored_asset = relationship("MonitoredAsset", back_populates="breach_logs")