export interface DomainAccount {
    id: string; // "adhoc-12" veya "monitored-7" formatında
    asset: string;
    email_leak: string;
    leaked_password: string;
    leak_type: string;
    market: string;
    last_seen: string;
    certainty: string;
    status: string;
    priority: string;
    discovery_date: string;
    raw_source: string;
    url: string;
    ip_info: string;
    hostname: string;
    malware_path: string;
    source: "adhoc" | "monitored";
}

/* ------------------------------------------------------------------ *
 * Domain Asset Report — Kurumsal Domain Raporu Modülü için Tip         *
 * ------------------------------------------------------------------ */
export interface DomainAssetReport {
    domain: string;
    matched_asset_count: number;
    total_leak_count: number;
    assets: MonitoredAsset[];
}

/* ------------------------------------------------------------------ *
 * Tek Kaynak (Single Source of Truth) — Certainty / Status / Priority  *
 * değer setleri.                                                     *
 * ------------------------------------------------------------------ */
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
    certainty: CertaintyValue | string;
    status: StatusValue | string;
    priority: PriorityValue | string;
    discovery_date: string;
    raw_source: string;
    url?: string;
    ip_info?: string;
    hostname?: string;
    malware_path?: string;
    system_info?: SystemInfo;
    last_check?: string;
    comments?: LeakComment[];
}

export type BadgeVariant = "certainty" | "status" | "priority";

export type PasswordExposureCategory = "corporate" | "third_party" | "stealer";

/* ------------------------------------------------------------------ *
 * HIBP "Pwned Passwords" (k-Anonymity) tipleri                         *
 * ------------------------------------------------------------------ */
export interface HibpRangeResponse {
    prefix: string;
    hashes: { suffix: string; count: number }[];
}

export interface PwnedPasswordResult {
    pwned: boolean;
    count: number;
}

/* ------------------------------------------------------------------ *
 * İzlenen Varlıklar (Monitored Assets) modülü                        *
 * ------------------------------------------------------------------ */
export type AssetType = "email" | "domain";

export interface AssetBreachLog {
    id: number;
    breach_name: string;
    breach_date?: string | null;
    exposed_data_types: string;
    created_at: string;
    email_leak?: string;
    leaked_password?: string;
    asset?: string;
    leak_type?: string;
    market?: string;
    priority?: string;
    status?: string;
    certainty?: string;
    url?: string;
    ip_info?: string;
    hostname?: string;
    malware_path?: string;
    discovery_date?: string; // Eklenen eksik alan
}

export interface MonitoredAsset {
    id: number;
    target: string;
    asset_type: AssetType;
    is_verified: boolean;
    verification_token: string;
    created_at: string;
    breach_logs: AssetBreachLog[];
}

/* ------------------------------------------------------------------ *
 * Subdomain Keşfi (crt.sh / HackerTarget) modülü                      *
 * ------------------------------------------------------------------ */
export type SubdomainSource = "crt.sh" | "hackertarget";

export interface SubdomainSearchResult {
    domain: string;
    source: SubdomainSource | string;
    count: number;
    subdomains: string[];
}

export interface SubdomainLivenessItem {
    subdomain: string;
    alive: boolean;
    scheme?: string | null;
    status_code?: number | null;
    response_time_ms?: number | null;
    error?: string | null;
}

export interface SubdomainLivenessResponse {
    checked_count: number;
    alive_count: number;
    results: SubdomainLivenessItem[];
}