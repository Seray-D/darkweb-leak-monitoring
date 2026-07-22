"""
NOT: Projenizde zaten bir models.py / BreachLog modeliniz varsa bu dosyayı
ATLAYIN — sadece alan adlarının aşağıdakiyle eşleştiğinden emin olun, çünkü
main.py bu alan adlarını kullanarak kayıt oluşturuyor.
"""

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
    Her yeni tarama başında ve panel ilk açıldığında TAMAMEN silinir
    (bkz. main.py -> _clear_all_leaks). İzlenen varlıklar (MonitoredAsset)
    modülüyle karışmaması için buraya DOKUNULMADI.
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


class MonitoredAsset(Base):
    """
    Kullanıcının anlık arama dışında SÜREKLİ izlemek istediği e-posta veya
    domain kaydı. `target` alanı normalize edilmiş (küçük harf, temizlenmiş)
    e-posta ya da domain'i tutar ve tekrar eklemeyi engellemek için unique'dir.
    """

    __tablename__ = "monitored_assets"

    id = Column(Integer, primary_key=True, index=True)
    target = Column(String, nullable=False, unique=True, index=True)
    asset_type = Column(String, nullable=False)  # 'email' | 'domain'
    is_verified = Column(Boolean, default=False, nullable=False)
    # Domain Sahiplik Doğrulaması (DNS TXT) için: DNS'e "leak-monitor-verify=<token>"
    # şeklinde eklenmesi beklenen tek kullanımlık doğrulama kodu.
    # NOT: Mevcut (önceden oluşturulmuş) veritabanlarında bu kolon otomatik
    # eklenmez (create_all sadece eksik TABLOLARI oluşturur, mevcut tabloya
    # kolon eklemez). Var olan kurulumlarda manuel migration
    # (ör. `ALTER TABLE monitored_assets ADD COLUMN verification_token ...`)
    # gerekir.
    verification_token = Column(
        String, nullable=False, unique=True, default=_generate_verification_token
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    breach_logs = relationship(
        "AssetBreachLog",
        back_populates="asset",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="AssetBreachLog.id.desc()",
    )


class AssetBreachLog(Base):
    """
    DİKKAT — bu, mevcut ad-hoc `BreachLog` modeliyle AYNI ŞEY DEĞİLDİR.
    Kasıtlı olarak farklı isimlendirildi: `BreachLog` her taramada silinen
    geçici sonuçları tutarken, `AssetBreachLog` bir `MonitoredAsset`'e bağlı
    KALICI sızıntı geçmişini tutar ve /api/v1/leaks/clear veya /api/v1/scan
    tarafından ASLA silinmez.
    """

    __tablename__ = "asset_breach_logs"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(
        Integer,
        ForeignKey("monitored_assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    breach_name = Column(String, nullable=False)
    breach_date = Column(String, nullable=True)
    exposed_data_types = Column(String, default="")
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    asset = relationship("MonitoredAsset", back_populates="breach_logs")