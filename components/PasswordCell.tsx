"use client";

import { useEffect, useState } from "react";
import {
    Eye,
    EyeOff,
    X,
    Copy,
    Check,
    Mail,
    Globe,
    Bug,
    KeyRound,
    ShieldAlert,
    ListChecks,
    Fingerprint,
    Server,
    Clock,
    Link2,
    Wifi,
    MonitorSmartphone,
    FolderCog,
    MessageSquare,
    Send,
    ChevronDown,
    ExternalLink,
} from "lucide-react";
import type { Leak, LeakComment, PasswordExposureCategory } from "@/lib/types";

interface PasswordCellProps {
    leak: Leak;
    onUpdateLeak?: (id: number, changes: Partial<Leak>) => void;
}

/* ------------------------------------------------------------------ */
/* 1) Sızan Bilgi Tipi (Target Scope) — dinamik sınıflandırma          */
/* ------------------------------------------------------------------ */

const STEALER_HINTS = [
    "stealer",
    "redline",
    "vidar",
    "raccoon",
    "racoon",
    "lumma",
    "azorult",
    "formbook",
    "stealc",
    "risepro",
    "metastealer",
    "meta stealer",
];

const CORPORATE_HINTS = [
    "active directory",
    "ldap",
    "vpn",
    "exchange",
    "outlook",
    "m365",
    "office365",
    "office 365",
    "webmail",
    "cpanel",
    "domain controller",
    "rdp",
    "citrix",
    "sso",
    "okta",
    "smtp",
    "mail server",
    "jenkins",
    "gitlab",
    "git repository",
    "docker",
    "elasticsearch",
    "mongodb",
    "redis",
    "wordpress",
    "wp-config",
    "redmine",
    "jira",
    "confluence",
    "sharepoint",
    "open directory",
    "config exposure",
    ".env dosyası",
];

interface ExposureProfile {
    category: PasswordExposureCategory;
    label: string;
    shortLabel: string;
    colorClasses: string;
    Icon: typeof Mail;
}

function classifyExposure(params: {
    leakType: string;
    market: string;
    rawSource: string;
}): ExposureProfile {
    const haystack = `${params.leakType || ""} ${params.market || ""} ${params.rawSource || ""}`.toLowerCase();

    const isStealer = STEALER_HINTS.some((hint) => haystack.includes(hint));
    const isCorporate =
        !isStealer &&
        (params.market === "LeakIX" || CORPORATE_HINTS.some((hint) => haystack.includes(hint)));

    if (isStealer) {
        return {
            category: "stealer",
            label: "Stealer Log (Zararlı Yazılım Sızıntısı)",
            shortLabel: "Stealer Log",
            colorClasses: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400",
            Icon: Bug,
        };
    }

    if (isCorporate) {
        return {
            category: "corporate",
            label: "E-Posta Hesap Şifresi (Domain/Corporate Credentials)",
            shortLabel: "Corporate",
            colorClasses: "border-red-500/30 bg-red-500/10 text-red-400",
            Icon: Mail,
        };
    }

    return {
        category: "third_party",
        label: "Üçüncü Taraf Hizmet Şifresi (3rd Party Account)",
        shortLabel: "3rd Party",
        colorClasses: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        Icon: Globe,
    };
}

/* ------------------------------------------------------------------ */
/* 2) Şifre Durumu & Görünüm — format tespiti                           */
/* ------------------------------------------------------------------ */

interface PasswordFormatInfo {
    kind: "empty" | "redacted" | "risk_note" | "hash" | "plaintext";
    displayLabel: string;
}

function detectPasswordFormat(raw?: string): PasswordFormatInfo {
    if (!raw || raw === "N/A") {
        return { kind: "empty", displayLabel: "Şifre verisi mevcut değil" };
    }
    if (raw === "******") {
        return {
            kind: "redacted",
            displayLabel: "Kaynak tarafından maskelenmiş",
        };
    }
    const riskMatch = raw.match(/^Risk:\s*(.+)$/i);
    if (riskMatch) {
        return {
            kind: "risk_note",
            displayLabel: `XposedOrNot risk seviyesi: ${riskMatch[1]}`,
        };
    }
    if (/^\$2[aby]\$/.test(raw)) {
        return { kind: "hash", displayLabel: "Hash formatında (bcrypt)" };
    }
    if (/^[a-f0-9]{64}$/i.test(raw)) {
        return { kind: "hash", displayLabel: "Hash formatında (SHA-256)" };
    }
    if (/^[a-f0-9]{40}$/i.test(raw)) {
        return { kind: "hash", displayLabel: "Hash formatında (SHA-1)" };
    }
    if (/^[a-f0-9]{32}$/i.test(raw)) {
        return { kind: "hash", displayLabel: "Hash formatında (MD5)" };
    }
    return { kind: "plaintext", displayLabel: "Düz metin (plaintext) şifre" };
}

/* ------------------------------------------------------------------ */
/* 3) Kaynakta İncele linki (LeakIX / OTX / diğer)                      */
/* ------------------------------------------------------------------ */

export function buildInvestigationLink(leak: Leak): string {
    if (!leak) return "#";
    const query = encodeURIComponent(leak.raw_source || leak.asset || "");
    switch (leak.market) {
        case "LeakIX":
            return `https://leakix.net/search?scope=service&q=${query}`;
        case "AlienVault OTX":
            return `https://otx.alienvault.com/pulse/${leak.raw_source ?? ""}`;
        default:
            return `https://www.google.com/search?q=${query}`;
    }
}

/* ------------------------------------------------------------------ */
/* 4) Tablo hücresi (tetikleyici buton)                                 */
/* ------------------------------------------------------------------ */

export default function PasswordCell({ leak, onUpdateLeak }: PasswordCellProps) {
    const [modalOpen, setModalOpen] = useState(false);

    // Eğer leak nesnesi undefined ise uygulamanın çökmesini engelle
    if (!leak) {
        return <span className="font-mono text-sm text-slate-500">-</span>;
    }

    const passwordStr = leak.leaked_password ?? "";
    const maskedValue = "•".repeat(Math.max(passwordStr.length, 6));

    return (
        <>
            <button
                type="button"
                onClick={() => setModalOpen(true)}
                title="SOC Leak Details & Case Management"
                className="flex items-center gap-2 rounded px-1 py-0.5 font-mono text-sm text-slate-300 transition-colors hover:bg-slate-800/60"
            >
                <span className="min-w-[5.5rem] text-left">{maskedValue}</span>
                <span className="text-slate-500 transition-colors hover:text-cyan-400">
                    <Eye size={15} />
                </span>
            </button>

            {modalOpen && (
                <SocLeakDetailModal
                    leak={leak}
                    onUpdateLeak={onUpdateLeak}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
}

/* ------------------------------------------------------------------ */
/* 5) SOC Leak Details & Case Management — 2 sütunlu ana modal           */
/* ------------------------------------------------------------------ */

const CERTAINTY_OPTIONS = ["Unsure", "Confirmed", "False Positive"];
const STATUS_OPTIONS_MODAL = ["Active", "In Progress", "Completed", "Ignored"];
const PRIORITY_OPTIONS_MODAL = ["Info", "Low", "Medium", "High", "Critical"];

export function SocLeakDetailModal({
    leak,
    onClose,
    onUpdateLeak,
}: {
    leak: Leak;
    onClose: () => void;
    onUpdateLeak?: (id: number, changes: Partial<Leak>) => void;
}) {
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState(false);

    const [certainty, setCertainty] = useState(leak?.certainty);
    const [status, setStatus] = useState(leak?.status);
    const [priority, setPriority] = useState(leak?.priority);
    const [comments, setComments] = useState<LeakComment[]>(leak?.comments ?? []);
    const [draftComment, setDraftComment] = useState("");

    useEffect(() => {
        if (leak) {
            setCertainty(leak.certainty);
            setStatus(leak.status);
            setPriority(leak.priority);
            setComments(leak.comments ?? []);
        }
    }, [leak]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    if (!leak) return null;

    const exposure = classifyExposure({
        leakType: leak.leak_type,
        market: leak.market,
        rawSource: leak.raw_source,
    });
    const formatInfo = detectPasswordFormat(leak.leaked_password);
    const ExposureIcon = exposure.Icon;

    const canReveal = formatInfo.kind === "plaintext" || formatInfo.kind === "hash";
    const displayedPassword =
        formatInfo.kind === "empty"
            ? "-"
            : formatInfo.kind === "redacted"
                ? "••••••••"
                : formatInfo.kind === "risk_note"
                    ? leak.leaked_password
                    : revealed
                        ? leak.leaked_password
                        : "•".repeat(Math.max((leak.leaked_password ?? "").length, 8));

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(leak.leaked_password ?? "");
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Panoya erişim engellenmiş olabilir
        }
    };

    const handleCertaintyChange = (value: string) => {
        setCertainty(value);
        onUpdateLeak?.(leak.id, { certainty: value });
    };
    const handleStatusChange = (value: string) => {
        setStatus(value);
        onUpdateLeak?.(leak.id, { status: value });
    };
    const handlePriorityChange = (value: string) => {
        setPriority(value);
        onUpdateLeak?.(leak.id, { priority: value });
    };

    const handleAddComment = () => {
        const text = draftComment.trim();
        if (!text) return;
        const newComment: LeakComment = {
            id: `${Date.now()}`,
            author: "Analyst",
            text,
            created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
        };
        const updated = [...comments, newComment];
        setComments(updated);
        setDraftComment("");
        onUpdateLeak?.(leak.id, { comments: updated });
    };

    return (
        <>
            <div onClick={onClose} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-slate-800 bg-[#0b0f0d] shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-800 bg-[#0d1119] px-5 py-4">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <ShieldAlert size={18} />
                            <span className="text-sm font-semibold uppercase tracking-wide">
                                SOC Leak Details &amp; Case Management
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Kapat"
                            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* 2 Sütunlu Grid */}
                    <div className="grid grid-cols-1 gap-5 px-5 py-5 md:grid-cols-2">
                        {/* SOL SÜTUN — Dark Web Leaks Details & Technical Metadata */}
                        <div className="space-y-4">
                            {/* Unit (Asset) */}
                            <div className="rounded-md border border-emerald-900/40 bg-emerald-950/10 px-4 py-3">
                                <div className="flex items-center justify-between gap-2">
                                    <SectionLabel icon={<Server size={13} />} text="Unit (Asset)" tone="emerald" />
                                    <span
                                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${exposure.colorClasses}`}
                                    >
                                        <ExposureIcon size={11} />
                                        {exposure.shortLabel}
                                    </span>
                                </div>
                                <div className="mt-1.5 break-all font-mono text-sm text-emerald-100">
                                    {leak.asset || "-"}
                                </div>
                            </div>

                            {/* Credentials */}
                            <div className="rounded-md border border-emerald-900/40 bg-emerald-950/10 px-4 py-3">
                                <SectionLabel icon={<KeyRound size={13} />} text="Credentials" tone="emerald" />
                                <div className="mt-2 space-y-2 font-mono text-sm">
                                    <div className="flex items-center gap-2 text-emerald-100">
                                        <Mail size={13} className="shrink-0 text-emerald-600" />
                                        <span className="shrink-0 text-slate-500">Email:</span>
                                        <span className="truncate">{leak.email_leak || "-"}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2 text-emerald-100">
                                            <KeyRound size={13} className="shrink-0 text-emerald-600" />
                                            <span className="shrink-0 text-slate-500">Pass:</span>
                                            <span className="truncate">{displayedPassword}</span>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            {canReveal && (
                                                <button
                                                    type="button"
                                                    onClick={() => setRevealed((r) => !r)}
                                                    aria-label={revealed ? "Şifreyi gizle" : "Şifreyi göster"}
                                                    className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-emerald-400"
                                                >
                                                    {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            )}
                                            {formatInfo.kind !== "empty" && (
                                                <button
                                                    type="button"
                                                    onClick={handleCopy}
                                                    aria-label="Kopyala"
                                                    className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-emerald-400"
                                                >
                                                    {copied ? (
                                                        <Check size={14} className="text-emerald-400" />
                                                    ) : (
                                                        <Copy size={14} />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Discovery Date / Last Check */}
                            <div className="grid grid-cols-2 gap-3">
                                <TimestampBox
                                    icon={<Fingerprint size={13} />}
                                    label="Discovery Date"
                                    value={leak.discovery_date}
                                />
                                <TimestampBox
                                    icon={<Clock size={13} />}
                                    label="Last Check"
                                    value={leak.last_check || leak.last_seen}
                                />
                            </div>

                            {/* Details */}
                            <div className="rounded-md border border-emerald-900/40 bg-emerald-950/10 px-4 py-3">
                                <SectionLabel icon={<ListChecks size={13} />} text="Details" tone="emerald" />
                                <div className="mt-2 space-y-1.5 text-xs">
                                    <DetailLine label="Last Seen" value={leak.last_seen} />
                                    <DetailLine
                                        label="URL"
                                        value={leak.url}
                                        icon={<Link2 size={11} className="text-slate-600" />}
                                        isLink
                                    />
                                    <DetailLine
                                        label="IP info"
                                        value={leak.ip_info}
                                        icon={<Wifi size={11} className="text-slate-600" />}
                                    />
                                    <div>
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                            <MonitorSmartphone size={11} className="text-slate-600" />
                                            System Information:
                                        </div>
                                        <div className="mt-1 space-y-0.5 pl-4 font-mono text-[11px] text-slate-300">
                                            <div className="flex items-start gap-1">
                                                <span>-</span>
                                                <span>Hostname: {leak.system_info?.hostname || "-"}</span>
                                            </div>
                                            <div className="flex items-start gap-1">
                                                <FolderCog size={11} className="mt-0.5 shrink-0 text-slate-600" />
                                                <span className="break-all">
                                                    Malware Located at: {leak.system_info?.malware_path || "-"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Kaynakta İncele Butonu */}
                            <a
                                href={buildInvestigationLink(leak)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-center justify-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
                            >
                                <ExternalLink size={15} />
                                Kaynakta İncele (IR)
                            </a>
                        </div>

                        {/* SAĞ SÜTUN — SOC Operations: Attributes & Comments Panel */}
                        <div className="flex flex-col space-y-5">
                            {/* Attributes */}
                            <div>
                                <SectionLabel icon={<ListChecks size={13} />} text="Attributes" tone="slate" />
                                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <AttributeSelect
                                        label="Certainty"
                                        value={certainty}
                                        options={CERTAINTY_OPTIONS}
                                        onChange={handleCertaintyChange}
                                    />
                                    <AttributeSelect
                                        label="Status"
                                        value={status}
                                        options={STATUS_OPTIONS_MODAL}
                                        onChange={handleStatusChange}
                                    />
                                    <AttributeSelect
                                        label="Priority"
                                        value={priority}
                                        options={PRIORITY_OPTIONS_MODAL}
                                        onChange={handlePriorityChange}
                                    />
                                </div>
                            </div>

                            {/* Comments */}
                            <div className="flex flex-1 flex-col">
                                <SectionLabel icon={<MessageSquare size={13} />} text="Comments" tone="slate" />
                                <div className="mt-2 max-h-56 flex-1 space-y-2 overflow-y-auto rounded-md border border-slate-800 bg-slate-900/40 p-3">
                                    {comments.length === 0 ? (
                                        <p className="text-xs text-slate-500">No comments yet.</p>
                                    ) : (
                                        comments.map((c) => (
                                            <div
                                                key={c.id}
                                                className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2"
                                            >
                                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                                    <span className="font-medium text-slate-400">
                                                        {c.author || "Analyst"}
                                                    </span>
                                                    <span className="font-mono">{c.created_at}</span>
                                                </div>
                                                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200">
                                                    {c.text}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <textarea
                                    value={draftComment}
                                    onChange={(e) => setDraftComment(e.target.value)}
                                    placeholder="Leave a comment..."
                                    rows={3}
                                    className="mt-3 w-full resize-none rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddComment}
                                    disabled={!draftComment.trim()}
                                    className="mt-2 flex items-center justify-center gap-2 self-end rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Send size={13} />
                                    Add Comment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

/* ------------------------------------------------------------------ */
/* Yardımcı küçük bileşenler                                            */
/* ------------------------------------------------------------------ */

function SectionLabel({
    icon,
    text,
    tone = "slate",
}: {
    icon: React.ReactNode;
    text: string;
    tone?: "slate" | "emerald";
}) {
    return (
        <div
            className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${tone === "emerald" ? "text-emerald-500" : "text-slate-500"
                }`}
        >
            {icon}
            {text}
        </div>
    );
}

function TimestampBox({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value?: string;
}) {
    return (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/10 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                {icon}
                {label}
            </div>
            <div className="mt-1 font-mono text-xs text-emerald-100">{value || "-"}</div>
        </div>
    );
}

function DetailLine({
    label,
    value,
    icon,
    isLink = false,
}: {
    label: string;
    value?: string;
    icon?: React.ReactNode;
    isLink?: boolean;
}) {
    return (
        <div className="flex items-start gap-1.5">
            {icon}
            <span className="shrink-0 text-slate-500">{label}:</span>
            {isLink && value ? (
                <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-mono text-emerald-400 underline-offset-2 hover:underline"
                >
                    {value}
                </a>
            ) : (
                <span className="break-all font-mono text-slate-300">{value || "-"}</span>
            )}
        </div>
    );
}

function AttributeSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
}) {
    const allOptions = options.includes(value) || !value ? options : [value, ...options];

    return (
        <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </label>
            <div className="relative mt-1">
                <select
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full appearance-none rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 pr-7 text-xs text-slate-200 focus:border-emerald-500/50 focus:outline-none"
                >
                    {allOptions.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
                <ChevronDown
                    size={13}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                />
            </div>
        </div>
    );
}