"""
Veritabanı bağlantısı ve session yönetimi.

NOT: Projenizde zaten bir database.py varsa bu dosyayı ATLAYIN ve mevcut
`get_db` / `SessionLocal` / `Base` nesnelerinizi kullanın. Bu dosya sadece
main.py örneğinin bağımsız çalışabilmesi için referans olarak verilmiştir.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
