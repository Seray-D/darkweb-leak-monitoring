export interface SystemInfo {
    hostname?: string;
    malware_path?: string;
}

export interface LeakComment {
    id: string;
    author?: string;
    text: string;
    created_at: string;
}

export interface Leak {
    id: number;
    asset: string;
    email_leak: string;
    leaked_password: string;
    leak_type: string;
    market: string;
    last_seen: string;
    certainty: "Unsure" | "Confirmed" | "Verified" | "False Positive" | string;
    status:
    | "Active"
    | "Resolved"
    | "Monitoring"
    | "Completed"
    | "In Progress"
    | "Ignored"
    | string;
    priority: "Info" | "Low" | "Medium" | "High" | "Critical" | string;
    discovery_date: string;
    // NOT: LeakTable.tsx'teki detay Drawer'ı ve şimdi de PDF/CSV raporlama
    // modülü bu alanı kullanıyor (LeakIX event id / OTX pulse id / XposedOrNot
    // kaynak kimliği). Backend (main.py / BreachLog modeli) bunu her zaman
    // dolduruyor (yoksa "" olarak kaydediyor), bu yüzden buraya eklendi.
    raw_source: string;

    // --- SOC Case Management ekleri (v2 - 2 sütunlu modal) ---
    // Sızıntının/login panelinin tam adresi (varsa). Backend her zaman
    // dolduramayabilir (LeakIX servis kayıtları hariç genelde boş "").
    url?: string;
    // Stealer log / açık servis taramasından gelen IP adresi bilgisi.
    ip_info?: string;
    // Stealer loglarına özgü ek sistem/cihaz bilgisi (hostname, malware yolu).
    system_info?: SystemInfo;
    // Sistem tarafından yapılan en güncel taramanın zaman damgası. Backend
    // bu alanı henüz ayrı döndürmüyorsa modal `last_seen` alanına düşer
    // (bkz. PasswordCell.tsx -> SocLeakDetailModal, "Last Check" satırı).
    last_check?: string;
    // Analistlerin bıraktığı SOC vaka notları (yeni yorum eklendikçe
    // frontend state'i güncellenir; kalıcı kayıt için backend'e bir
    // PATCH/POST endpoint'i (örn. /leaks/{id}/comments) entegre edilmelidir).
    comments?: LeakComment[];
}

export type BadgeVariant = "certainty" | "status" | "priority";

// PasswordCell.tsx içindeki "Sızıntı & Şifre Analiz Modalı" tarafından
// üretilen dinamik sınıflandırma (leak_type / market / asset analizine göre).
// Diğer bileşenler (örn. gelecekteki raporlama modülü) ihtiyaç duyarsa diye
// burada da export ediliyor.
export type PasswordExposureCategory = "corporate" | "third_party" | "stealer";

/* ------------------------------------------------------------------ */
/* HIBP "Pwned Passwords" (k-Anonymity) — Hash Bazlı Parola Sızıntı     */
/* Kontrolü modülü için tipler. Bkz. lib/api.ts -> checkPassword()      */
/* ve PasswordCell.tsx -> PwnedPasswordChecker.                        */
/* ------------------------------------------------------------------ */

// Backend'in /api/v1/check-password endpoint'inden dönen ham yanıt.
// (prefix'e uyan tüm suffix:count çiftleri; asıl eşleşme istemcide yapılır.)
export interface HibpRangeResponse {
    prefix: string;
    hashes: { suffix: string; count: number }[];
}

// checkPassword() fonksiyonunun döndürdüğü, UI'ın doğrudan kullandığı
// sadeleştirilmiş sonuç.
export interface PwnedPasswordResult {
    pwned: boolean;
    count: number;
}

/* ------------------------------------------------------------------ */
/* İzlenen Varlıklar (Monitored Assets) modülü.                         */
/* NOT: AssetBreachLog, yukarıdaki ad-hoc `Leak` tipiyle KARIŞTIRILMAMALI. */
/* `Leak` her taramada sıfırlanan anlık sonuçları, `AssetBreachLog` ise   */
/* bir MonitoredAsset'e bağlı KALICI sızıntı geçmişini temsil eder.       */
/* Bkz. lib/api.ts -> addMonitoredAsset / getMonitoredAssets.            */
/* ------------------------------------------------------------------ */

export type AssetType = "email" | "domain";

export interface AssetBreachLog {
    id: number;
    breach_name: string;
    breach_date?: string | null;
    exposed_data_types: string;
    created_at: string;
}

export interface MonitoredAsset {
    id: number;
    target: string;
    asset_type: AssetType;
    is_verified: boolean;
    // Domain Sahiplik Doğrulaması (DNS TXT Verification) için: DNS'e
    // "leak-monitor-verify=<token>" olarak eklenmesi beklenen kod.
    // Sadece asset_type === "domain" && is_verified === false iken
    // UI'da gösterilir (bkz. app/page.tsx).
    verification_token: string;
    created_at: string;
    breach_logs: AssetBreachLog[];
}