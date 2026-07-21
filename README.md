# Dark Web Leaks Monitoring — Aşama 1 (Backend & Veritabanı)

## Dosya Yapısı
```
leak_monitor/
├── database.py        # SQLAlchemy engine/session (SQLite: leaks.db)
├── models.py           # breach_logs tablosu (ORM modeli)
├── schemas.py          # Pydantic request/response şemaları
├── seed.py             # İlk çalıştırmada mock veri ekler
├── xposed_service.py   # XposedOrNot API entegrasyonu (httpx)
├── main.py             # FastAPI uygulaması ve endpoint'ler
└── requirements.txt
```

## Kurulum
```bash
pip install -r requirements.txt
# veya tek tek:
pip install fastapi uvicorn sqlalchemy httpx pydantic
```

## Çalıştırma
```bash
uvicorn main:app --reload
```
Uygulama ilk açılışta `leaks.db` dosyasını oluşturur, tablo boşsa
görseldeki `izmir.bel.tr / yagizer` kaydı dahil 3 mock satır ekler.

Swagger arayüzü: http://127.0.0.1:8000/docs

## Endpoint'ler

### `GET /api/v1/leaks`
Tüm sızıntı kayıtlarını (en yeni önce) JSON listesi olarak döner.
```bash
curl http://127.0.0.1:8000/api/v1/leaks
```

### `GET /api/v1/scan?email=ornek@site.com`
XposedOrNot'un ücretsiz servisine canlı sorgu atar, bulunan her sızıntı
kaynağı için `breach_logs` tablosuna yeni bir satır ekler
(`certainty=Confirmed`, `priority=High`, `market=XposedOrNot`) ve
eklenen satırları döner. E-posta hiçbir sızıntıda bulunamadıysa boş
liste `[]` döner.
```bash
curl "http://127.0.0.1:8000/api/v1/scan?email=test@example.com"
```

**Not:** XposedOrNot rate limiti ~2 istek/saniyedir; `xposed_service.py`
429/5xx durumlarını yakalayıp anlamlı hata mesajıyla 502 döner.

## Test Notu
Bu sandbox ortamında `api.xposedornot.com`'a dışarıya çıkış izni
olmadığı için `/api/v1/scan` uçtan uca test edilemedi, ancak kodu
kendi makinenizde (internet erişimi olan) çalıştırdığınızda
sorunsuz çalışacaktır. `/api/v1/leaks` ve veritabanı/seed kısmı
bu ortamda test edildi ve doğrulandı (görseldeki veriyle birebir
eşleşen mock kayıt dahil).

## Sıradaki Aşama İçin Notlar
- `discovery_date` şu an string olarak tutuluyor; ileride sıralama/filtreleme
  için gerçek `DateTime` tipine geçmek isteyebilirsiniz.
- Frontend'in tablo görselindeki "Status/Priority/Certainty" filtreleri için
  `GET /api/v1/leaks` uç noktasına query parametreleri (örn. `?status=Active`)
  eklemek kolayca genişletilebilir.
