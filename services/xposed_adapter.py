"""
Bu dosya, MEVCUT `xposed_service.py` dosyanızın YERİNE GEÇMEZ.
Sadece onu ortak NormalizedLeak şemasıyla uyumlu hale getirmek için
eklemeniz gereken normalize fonksiyonunu gösterir.

Kendi xposed_service.py dosyanızda muhtemelen şuna benzer bir fonksiyon var:

    async def check_email(email: str) -> list[dict]:
        # XposedOrNot API'sine istek atar, ham JSON sonucu döner
        ...

Aşağıdaki normalize_xposed_result() fonksiyonunu KENDİ xposed_service.py
dosyanıza ekleyin ve check_email() çağrısından dönen her ham kaydı bu
fonksiyondan geçirin. Alan adlarını (örn. "breach", "password_status",
"xposed_date") kendi XposedOrNot yanıt yapınıza göre düzenleyin.
"""

from typing import List

from schemas import NormalizedLeak


def normalize_xposed_result(raw: dict, email: str) -> NormalizedLeak:
    """XposedOrNot'un ham JSON kaydını ortak NormalizedLeak şemasına çevirir."""
    domain = email.split("@")[-1] if "@" in email else email

    return NormalizedLeak(
        asset=raw.get("domain") or domain,
        email_leak=email,
        leaked_password=raw.get("password", "******"),
        leak_type=raw.get("breach_type") or raw.get("leak_type") or "Combolist",
        market=raw.get("source") or "XposedOrNot",
        last_seen=(raw.get("xposed_date") or raw.get("last_seen") or "-")[:10],
        certainty="Confirmed" if raw.get("verified") else "Unsure",
        status="Active",
        priority=raw.get("priority") or "Medium",
        raw_source=raw.get("id"),
    )


def normalize_xposed_results(raw_results: List[dict], email: str) -> List[NormalizedLeak]:
    """Toplu normalize etmek için yardımcı fonksiyon."""
    return [normalize_xposed_result(item, email) for item in raw_results]
