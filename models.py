"""
NOT: Projenizde zaten bir models.py / BreachLog modeliniz varsa bu dosyayı
ATLAYIN — sadece alan adlarının aşağıdakiyle eşleştiğinden emin olun, çünkü
main.py bu alan adlarını kullanarak kayıt oluşturuyor.
"""

from sqlalchemy import Column, Integer, String

from database import Base


class BreachLog(Base):
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
