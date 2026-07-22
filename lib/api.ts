import { HibpRangeResponse, Leak, MonitoredAsset, PwnedPasswordResult } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function normalizeLeakArray(data: any): Leak[] {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
        if (Array.isArray(data.data)) return data.data;
        if (Array.isArray(data.leaks)) return data.leaks;
        if (Array.isArray(data.results)) return data.results;
    }
    return [];
}

/**
 * E-posta veya Domain taraması yapar.
 */
export async function scanEmail(emailOrDomain: string): Promise<Leak[]> {
    const query = encodeURIComponent(emailOrDomain.trim());

    // Artık backend /api/v1/scan?target=... parametresini kullanıyor
    const primaryUrl = `${API_BASE}/api/v1/scan?target=${query}`;
    const fallbackUrl = `${API_BASE}/api/v1/leaks/search-domain?domain=${query}`;

    try {
        let res = await fetch(primaryUrl, { cache: "no-store" });

        if (res.status === 404 || !res.ok) {
            // Yedek uç noktayı dene (Mevcut veritabanı araması)
            res = await fetch(fallbackUrl, { cache: "no-store" });
        }

        if (!res.ok) {
            throw new Error(`Tarama başarısız oldu (${res.status})`);
        }

        const rawData = await res.json();
        return normalizeLeakArray(rawData);
    } catch (error) {
        console.error("scanEmail Hatası:", error);
        throw error;
    }
}

/**
 * Verilen metnin (parolanın) SHA-1 hash'ini tarayıcıda (Web Crypto API ile)
 * hesaplar. Parola hiçbir zaman ağa gönderilmez; yalnızca bu hash'in ilk 5
 * karakteri (prefix) HIBP k-Anonymity sorgusu için kullanılır.
 */
async function sha1Hex(plainText: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText);
    const digest = await crypto.subtle.digest("SHA-1", data);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
}

/**
 * HIBP "Pwned Passwords" — Hash Bazlı Parola Sızıntı Kontrolü (k-Anonymity).
 *
 * Parola ASLA açık metin olarak hiçbir yere (backend'e dahi) gönderilmez:
 *   1) Parolanın SHA-1 hash'i bu fonksiyon içinde, tarayıcıda hesaplanır.
 *   2) Hash'in yalnızca ilk 5 karakteri (prefix) backend'e gönderilir.
 *   3) Backend (/api/v1/check-password) bu prefix'i HIBP'ye iletir ve o
 *      prefix'e uyan tüm suffix:count çiftlerini döner (CORS'suz, sunucu
 *      taraflı proxy).
 *   4) Kalan 35 karakter (suffix), yalnızca bu fonksiyonda, dönen listede
 *      aranır — asıl eşleştirme tamamen istemci tarafında yapılır.
 */
export async function checkPassword(password: string): Promise<PwnedPasswordResult> {
    const plainText = password ?? "";
    if (!plainText) {
        return { pwned: false, count: 0 };
    }

    const fullHash = await sha1Hex(plainText);
    const prefix = fullHash.slice(0, 5);
    const suffix = fullHash.slice(5);

    const res = await fetch(`${API_BASE}/api/v1/check-password?prefix=${prefix}`, {
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`Parola kontrolü başarısız oldu (${res.status})`);
    }

    const data: HibpRangeResponse = await res.json();
    const match = (data.hashes ?? []).find((entry) => entry.suffix?.toUpperCase() === suffix);

    return match ? { pwned: true, count: match.count } : { pwned: false, count: 0 };
}

export async function clearLeaks(): Promise<void> {
    let res = await fetch(`${API_BASE}/api/v1/leaks/clear`, {
        method: "DELETE",
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`Veritabanı temizlenirken hata oluştu (${res.status})`);
    }
}

/* ------------------------------------------------------------------ */
/* İzlenen Varlıklar (Monitored Assets) modülü — bkz. lib/types.ts      */
/* ------------------------------------------------------------------ */

/**
 * Verilen e-posta veya domain'i izleme listesine ekler.
 * Zaten listede varsa backend 409 döner; burada okunabilir bir hataya
 * çevrilir.
 */
export async function addMonitoredAsset(target: string): Promise<MonitoredAsset> {
    const res = await fetch(`${API_BASE}/api/v1/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim() }),
        cache: "no-store",
    });

    if (res.status === 409) {
        throw new Error("Bu varlık zaten izleme listesinde.");
    }
    if (!res.ok) {
        throw new Error(`İzlemeye eklenirken hata oluştu (${res.status})`);
    }

    return res.json();
}

/**
 * İzlenen tüm varlıkları (ve her birine bağlı kalıcı sızıntı geçmişini)
 * getirir.
 */
export async function getMonitoredAssets(): Promise<MonitoredAsset[]> {
    const res = await fetch(`${API_BASE}/api/v1/assets`, { cache: "no-store" });

    if (!res.ok) {
        throw new Error(`İzlenen varlıklar getirilirken hata oluştu (${res.status})`);
    }

    return res.json();
}

/**
 * İzleme listesinden bir varlığı (ve ona bağlı sızıntı geçmişini) kaldırır.
 */
export async function deleteMonitoredAsset(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/assets/${id}`, {
        method: "DELETE",
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`İzleme listesinden kaldırılırken hata oluştu (${res.status})`);
    }
}

/**
 * Belirli bir izlenen varlığı anında yeniden tarar, güncel (breach_logs
 * dahil) halini döner.
 */
export async function rescanMonitoredAsset(id: number): Promise<MonitoredAsset> {
    const res = await fetch(`${API_BASE}/api/v1/assets/${id}/scan`, {
        method: "POST",
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`Yeniden tarama başarısız oldu (${res.status})`);
    }

    return res.json();
}

/**
 * Domain Sahiplik Doğrulaması (DNS TXT Verification).
 *
 * `asset_type === "domain"` olan bir varlığın DNS TXT kayıtlarında
 * `leak-monitor-verify=<verification_token>` değerinin yayınlanıp
 * yayınlanmadığını backend üzerinden kontrol ettirir. Eşleşme bulunursa
 * varlık `is_verified = true` olarak işaretlenir.
 *
 * Backend hata durumunda (404 / 400) `{ detail: string }` gövdesi döner;
 * bu mesaj olduğu gibi Error içine taşınır ki UI kullanıcıya gösterebilsin.
 */
export async function verifyMonitoredAsset(
    id: number
): Promise<{ detail: string; id: number; target: string; is_verified: boolean }> {
    const res = await fetch(`${API_BASE}/api/v1/assets/${id}/verify`, {
        method: "POST",
        cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        throw new Error(data?.detail || `Domain doğrulanırken hata oluştu (${res.status})`);
    }

    return data;
}