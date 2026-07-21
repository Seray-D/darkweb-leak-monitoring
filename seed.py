"""
seed.py
Veritabanı boşsa başlangıç (mock) verilerini ekler.
main.py başlangıçta bu fonksiyonu çağırır; ayrıca `python seed.py` ile de
elle çalıştırılabilir.
"""

from database import SessionLocal, engine, Base
from models import BreachLog

MOCK_DATA = [
    {
        "asset": "izmir.bel.tr",
        "email_leak": "yagizer",
        "leaked_password": "******",
        "leak_type": "Botnet",
        "market": "Combolist",
        "last_seen": "2026-05-20",
        "certainty": "Unsure",
        "status": "Active",
        "priority": "Info",
        "discovery_date": "2026-07-12 23:29:06",
    },
    {
        "asset": "izmir.bel.tr",
        "email_leak": "mkaraca",
        "leaked_password": "******",
        "leak_type": "Stealer Log",
        "market": "Genesis Market",
        "last_seen": "2026-06-02",
        "certainty": "Confirmed",
        "status": "Active",
        "priority": "High",
        "discovery_date": "2026-07-13 09:14:22",
    },
    {
        "asset": "izmir.bel.tr",
        "email_leak": "aciftci",
        "leaked_password": "******",
        "leak_type": "Combo List",
        "market": "Telegram Channel",
        "last_seen": "2026-04-11",
        "certainty": "Confirmed",
        "status": "Resolved",
        "priority": "Critical",
        "discovery_date": "2026-07-10 18:02:47",
    },
]


def seed_if_empty() -> None:
    """Tablo boşsa MOCK_DATA'daki kayıtları ekler."""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing_count = db.query(BreachLog).count()
        if existing_count > 0:
            print(f"[seed] Tabloda zaten {existing_count} kayıt var, seed atlandı.")
            return

        for row in MOCK_DATA:
            db.add(BreachLog(**row))
        db.commit()
        print(f"[seed] {len(MOCK_DATA)} mock kayıt eklendi.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_if_empty()
