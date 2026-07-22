import { Leak } from "./types";

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
    const isEmail = emailOrDomain.includes("@");

    // Eğer e-posta girildiyse öncelikle /scan veya /search endpoint'lerini kullan
    const primaryUrl = isEmail
        ? `${API_BASE}/api/v1/scan?email=${query}`
        : `${API_BASE}/api/v1/leaks/search-domain?domain=${query}`;

    const fallbackUrl = isEmail
        ? `${API_BASE}/api/v1/leaks/search-domain?domain=${query}`
        : `${API_BASE}/api/v1/scan?email=${query}`;

    try {
        let res = await fetch(primaryUrl, { cache: "no-store" });

        if (res.status === 404 || !res.ok) {
            // Yedek uç noktayı dene
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

export async function clearLeaks(): Promise<void> {
    let res = await fetch(`${API_BASE}/api/v1/leaks/clear`, {
        method: "DELETE",
        cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`Veritabanı temizlenirken hata oluştu (${res.status})`);
    }
}