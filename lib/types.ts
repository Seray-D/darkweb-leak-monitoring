/* ------------------------------------------------------------------ */
/* Tek Kaynak (Single Source of Truth) — Certainty / Status / Priority  */
/* değer setleri. Önceden FilterBar.tsx (STATUS_OPTIONS/PRIORITY_OPTIONS) */
/* ve PasswordCell.tsx (CERTAINTY_OPTIONS/STATUS_OPTIONS_MODAL/          */
/* PRIORITY_OPTIONS_MODAL) içinde birbirinden bağımsız, eksik ve         */
/* tutarsız olarak tanımlanıyordu (ör. modal'da "Resolved"/"Monitoring"  */
/* yoktu, filtre panelinde "Completed"/"In Progress"/"Ignored" yoktu).   */
/* Artık HER İKİ bileşen de bu dizileri import ederek kullanıyor; yeni   */
/* bir durum eklemek/çıkarmak istendiğinde tek bir yer güncellenir.      */
/* ------------------------------------------------------------------ */

export const CERTAINTY_VALUES = [
    "Unsure",
    "Confirmed",
    "Verified",
    "False Positive",
] as const;

export const STATUS_VALUES = [
    "Active",
    "In Progress",
    "Monitoring",
    "Resolved",
    "Completed",
    "Ignored",
] as const;

export const PRIORITY_VALUES = [
    "Info",
    "Low",
    "Medium",
    "High",
    "Critical",
] as const;

export type CertaintyValue = (typeof CERTAINTY_VALUES)[number];
export type StatusValue = (typeof STATUS_VALUES)[number];
export type PriorityValue = (typeof PRIORITY_VALUES)[number];

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
    // NOT: `| string` fallback'i kasıtlı olarak korunuyor — backend, henüz
    // burada tanımlanmamış bir değer dönerse (ör. yeni bir migration
    // sırasında) TypeScript derlemesi kırılmasın diye. Ama UI'da seçilebilir
    // / filtrelenebilir olması gereken TÜM değerler CERTAINTY_VALUES /
    // STATUS_VALUES / PRIORITY_VALUES içinde olmalı.
    certainty: CertaintyValue | string;
    status: StatusValue | string;
    priority: PriorityValue | string;
    discovery_date: string;
    // NOT: LeakTable.tsx'teki detay Drawer'ı ve şimdi de PDF/CSV raporlama
    // modülü bu alanı kullanıyor (LeakIX event id / OTX pulse id / XposedOrNot
    // kaynak kimliği). Backend (main.py / BreachLog modeli) bunu her zaman
    // dolduruyor (yoksa "" olarak kaydediyor), bu yüzden buraya eklendi.
    raw_source: string;

    // --- SOC Case Management ekleri (v2 - 2 sütunlu modal) ---
    // Sızıntının/login panelinin tam adresi (varsa). Backend BreachLog /
    // AssetBreachLog üzerinden artık DÜZ (flat) string olarak dolduruyor.
    url?: string;
    // Stealer log / açık servis taramasından gelen IP adresi bilgisi.
    ip_info?: string;
    // NOT: hostname আৰু malware_path artık backend'den DÜZ alanlar olarak
    // geliyor (bkz. models.py -> BreachLog.hostname / .malware_path).
    // system_info hiçbir zaman backend'den bu iç içe (nested) şekilde
    // gelmediği için PasswordCell.tsx'teki modal her zaman "-" gösteriyordu.
    hostname?: string;
    malware_path?: string;
    // Geriye dönük uyumluluk için opsiyonel bırakıldı (kullanılmıyor).
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