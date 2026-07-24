"use client";

import { useEffect, useMemo, useState } from "react";
import { Leak } from "@/lib/types";
import Badge from "./Badge";
import PasswordCell, { SocLeakDetailModal } from "./PasswordCell";
import FilterBar, { STATUS_OPTIONS, PRIORITY_OPTIONS, MARKET_OPTIONS } from "./FilterBar";
import {
    Fingerprint,
    ExternalLink,
    Copy,
    Check,
    Inbox,
    SearchX,
    X,
    ShieldAlert,
    Clock,
    Server,
    Eye,
    Link2,
} from "lucide-react";

interface LeakTableProps {
    leaks: Leak[];
    loading: boolean;
    marketFilter?: string;
    onMarketFilterChange?: React.Dispatch<React.SetStateAction<string>>;
    onLeaksUpdate?: (updatedLeaks: Leak[]) => void;
}

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

const COLUMNS = [
    "ASSET",
    "EMAIL LEAK",
    "LEAKED PASSWORD",
    "LEAK TYPE",
    "MARKET / SOURCE",
    "LAST SEEN",
    "CERTAINTY",
    "STATUS",
    "PRIORITY",
    "DISCOVERY DATE",
    "ACTIONS",
];

const PART_SEPARATOR = " • ";
// Add this helper function at the top level of your component file, e.g., right under splitLeakType or near your utility functions.

function getPriorityColor(priority: string): string {
    switch (priority?.toLowerCase()) {
        case "kritik":
        case "critical":
            return "bg-red-500/10 text-red-400 border-red-500/20";
        case "yüksek":
        case "high":
            return "bg-orange-500/10 text-orange-400 border-orange-500/20";
        case "orta":
        case "medium":
            return "bg-amber-500/10 text-amber-400 border-amber-500/20";
        case "düşük":
        case "low":
            return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        default:
            return "bg-slate-800 text-slate-400 border-slate-700";
    }
}

function splitLeakType(leakType: string): { title: string; subtitle: string | null } {
    if (!leakType) {
        return { title: "Bilinmeyen", subtitle: null };
    }
    const idx = leakType.indexOf(PART_SEPARATOR);
    if (idx === -1) {
        return { title: leakType, subtitle: null };
    }
    return {
        title: leakType.slice(0, idx),
        subtitle: leakType.slice(idx + PART_SEPARATOR.length),
    };
}

// Backend (xposed_adapter.py), gerçek bir kaynak linki olmayan sızıntılar
// için (ör. XposedOrNot) otomatik olarak bir DuckDuckGo arama linki üretir.
// Burada bu durumu ayırt edip kullanıcıya farklı bir etiket gösteriyoruz,
// böylece "gerçek indirme linki" ile "araştırma önerisi" karışmıyor.
function isDuckDuckGoFallbackUrl(url: string): boolean {
    return url.includes("duckduckgo.com");
}

function UrlDetailRow({ url }: { url: string }) {
    const trimmed = (url || "").trim();

    if (!trimmed || trimmed === "-") {
        return (
            <div className="flex items-start justify-between gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-slate-500">
                    <Link2 size={14} />
                    URL
                </div>
                <div className="text-right text-slate-500">-</div>
            </div>
        );
    }

    const isFallback = isDuckDuckGoFallbackUrl(trimmed);

    return (
        <div className="flex items-start justify-between gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-slate-500">
                <Link2 size={14} />
                URL
            </div>
            <a
                href={trimmed}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 text-right hover:underline ${
                    isFallback
                        ? "text-amber-400 hover:text-amber-300"
                        : "text-cyan-400 hover:text-cyan-300"
                }`}
            >
                {isFallback ? "Web'de Ara (DuckDuckGo)" : "Kaynağı Görüntüle"}
                <ExternalLink size={12} />
            </a>
        </div>
    );
}

function buildInvestigationLink(leak: Leak): string {
    const raw = String(leak.raw_source || leak.asset || "").trim();

    if (!raw) return "#";

    if (raw.startsWith("http://") || raw.startsWith("https://")) {
        return raw;
    }

    const query = encodeURIComponent(raw);
    switch (leak.market) {
        case "LeakIX":
            return `https://leakix.net/search?scope=service&q=${query}`;
        case "AlienVault OTX":
            return `https://otx.alienvault.com/pulse/${query}`;
        default:
            return `https://www.google.com/search?q=${query}`;
    }
}

export default function LeakTable({
    leaks,
    loading,
    marketFilter,
    onMarketFilterChange,
    onLeaksUpdate,
}: LeakTableProps) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<string>(STATUS_OPTIONS[0]);
    const [priority, setPriority] = useState<string>(PRIORITY_OPTIONS[0]);
    const [market, setMarket] = useState<string>(marketFilter ?? MARKET_OPTIONS[0]);

    // page.tsx tarafından dışarıdan (kontrollü) bir marketFilter güncellemesi
    // yapılırsa (örn. global "filtreleri temizle" veya URL senkronizasyonu),
    // iç state'i onunla senkron tut.
    useEffect(() => {
        if (marketFilter !== undefined && marketFilter !== market) {
            setMarket(marketFilter);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marketFilter]);

    const handleMarketChange = (value: string) => {
        setMarket(value);
        onMarketFilterChange?.(value);
    };

    const [selectedLeak, setSelectedLeak] = useState<Leak | null>(null);
    const [copiedAssetId, setCopiedAssetId] = useState<number | null>(null);

    const [leaksState, setLeaksState] = useState<Leak[]>(leaks);

    const [domainSearchValue, setDomainSearchValue] = useState("");
    const [domainSearchActive, setDomainSearchActive] = useState(false);
    const [domainSearchLoading, setDomainSearchLoading] = useState(false);
    const [domainSearchError, setDomainSearchError] = useState<string | null>(null);

    useEffect(() => {
        setLeaksState(leaks);
    }, [leaks]);

    const handleUpdateLeak = (id: number, changes: Partial<Leak>) => {
        setLeaksState((prev) => {
            const updated = prev.map((l) => (l.id === id ? { ...l, ...changes } : l));
            onLeaksUpdate?.(updated);
            return updated;
        });
        setSelectedLeak((prev) => (prev && prev.id === id ? { ...prev, ...changes } : prev));
    };

    const handleDomainSearchSubmit = async () => {
        const query = domainSearchValue.trim();
        if (!query) return;

        setDomainSearchLoading(true);
        setDomainSearchError(null);

        setSearch("");
        setStatus(STATUS_OPTIONS[0]);
        setPriority(PRIORITY_OPTIONS[0]);

        try {
            const res = await fetch(
                `${API_BASE_URL}/api/v1/leaks/search-domain?domain=${encodeURIComponent(query)}`
            );

            if (!res.ok) {
                const errorBody = await res.json().catch(() => null);
                throw new Error(
                    errorBody?.detail || "Sızıntı araması sırasında bir hata oluştu."
                );
            }

            const results: Leak[] = await res.json();
            setLeaksState(results);
            setDomainSearchActive(true);
        } catch (err) {
            setDomainSearchError(
                err instanceof Error
                    ? err.message
                    : "Sızıntı araması sırasında bir hata oluştu."
            );
        } finally {
            setDomainSearchLoading(false);
        }
    };

    const handleDomainSearchClear = () => {
        setDomainSearchValue("");
        setDomainSearchActive(false);
        setDomainSearchError(null);
        setLeaksState(leaks);
    };

    const handleCopyAsset = (id: number, asset: string) => {
        navigator.clipboard.writeText(asset);
        setCopiedAssetId(id);
        setTimeout(() => setCopiedAssetId(null), 2000);
    };

    const filteredLeaks = useMemo(() => {
        const query = search.trim().toLowerCase();

        return leaksState.filter((leak) => {
            const matchesStatus =
                status === STATUS_OPTIONS[0] || leak.status === status;
            const matchesPriority =
                priority === PRIORITY_OPTIONS[0] || leak.priority === priority;

            const matchesMarket =
                market === MARKET_OPTIONS[0] || leak.market === market;

            const matchesQuery =
                query === "" ||
                [leak.asset, leak.email_leak, leak.leak_type, leak.market].some(
                    (field) => field?.toLowerCase().includes(query)
                );

            return matchesStatus && matchesPriority && matchesMarket && matchesQuery;
        });
    }, [leaksState, search, status, priority, market]);

    const relatedLeaksForSelected = useMemo(() => {
        if (!selectedLeak) return [];
        return leaksState.filter((l) => {
            const sameAsset =
                l.asset &&
                selectedLeak.asset &&
                l.asset.toLowerCase() === selectedLeak.asset.toLowerCase();
            const sameEmail =
                l.email_leak &&
                selectedLeak.email_leak &&
                l.email_leak.toLowerCase() === selectedLeak.email_leak.toLowerCase();
            return sameAsset || sameEmail;
        });
    }, [leaksState, selectedLeak]);

    const hasActiveFilters =
        search.trim() !== "" ||
        status !== STATUS_OPTIONS[0] ||
        priority !== PRIORITY_OPTIONS[0] ||
        market !== MARKET_OPTIONS[0];

    if (loading) {
        return (
            <div className="rounded-lg border border-slate-800 bg-[#101520]">
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
                    <Fingerprint size={28} className="animate-pulse text-cyan-500/60" />
                    <p className="text-sm">Sızıntı kayıtları yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <FilterBar
                search={search}
                onSearchChange={setSearch}
                status={status}
                onStatusChange={setStatus}
                priority={priority}
                onPriorityChange={setPriority}
                market={market}
                onMarketChange={handleMarketChange}
                resultCount={filteredLeaks.length}
                totalCount={leaksState.length}
                filteredLeaks={filteredLeaks}
                domainSearchValue={domainSearchValue}
                onDomainSearchValueChange={setDomainSearchValue}
                onDomainSearchSubmit={handleDomainSearchSubmit}
                onDomainSearchClear={handleDomainSearchClear}
                domainSearchLoading={domainSearchLoading}
                domainSearchError={domainSearchError}
                domainSearchActive={domainSearchActive}
            />

            {leaksState.length === 0 && !domainSearchActive ? (
                <div className="rounded-lg border border-slate-800 bg-[#101520]">
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
                        <Inbox size={28} className="text-slate-600" />
                        <p className="text-sm font-medium text-slate-400">
                            Henüz kayıtlı sızıntı bulunamadı.
                        </p>
                    </div>
                </div>
            ) : filteredLeaks.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-[#101520]">
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
                        <SearchX size={28} className="text-slate-600" />
                        <p className="text-sm">
                            Aramanıza veya filtrelerinize uygun sızıntı kaydı bulunamadı.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#101520]">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-800 bg-[#0d1119]">
                                    {COLUMNS.map((col) => (
                                        <th
                                            key={col}
                                            className="whitespace-nowrap px-4 py-3 text-xs font-semibold tracking-wider text-slate-500"
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLeaks.map((leak) => {
                                    const parsedLeakType = splitLeakType(leak.leak_type);

                                    return (
                                        <tr
                                            key={leak.id}
                                            className="border-b border-slate-800/60 transition-colors last:border-b-0 hover:bg-slate-900/40"
                                        >
                                            <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-200">
                                                {leak.asset}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5 text-slate-300">
                                                {leak.email_leak || "-"}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <PasswordCell
                                                    leak={leak}
                                                    onUpdateLeak={handleUpdateLeak}
                                                />
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="font-medium text-slate-300">
                                                    {parsedLeakType.title}
                                                </div>
                                                {parsedLeakType.subtitle && (
                                                    <div className="mt-0.5 text-xs text-slate-500">
                                                        {parsedLeakType.subtitle}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5 text-slate-400">
                                                {leak.market}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-slate-500">
                                                {leak.last_seen}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <Badge value={leak.certainty} variant="certainty" />
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <Badge value={leak.status} variant="status" />
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <Badge value={leak.priority} variant="priority" />
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-slate-500">
                                                {leak.discovery_date}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5">
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <button
                                                        type="button"
                                                        title="Sızıntı Detayını İncele"
                                                        onClick={() => setSelectedLeak(leak)}
                                                        className="rounded p-1.5 transition-colors hover:bg-slate-800 hover:text-cyan-400"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <a
                                                        href={buildInvestigationLink(leak)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="Kaynakta incele"
                                                        className="rounded p-1.5 transition-colors hover:bg-slate-800 hover:text-cyan-400"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                    <button
                                                        type="button"
                                                        title="Varlığı kopyala"
                                                        onClick={() => handleCopyAsset(leak.id, leak.asset)}
                                                        className="rounded p-1.5 transition-colors hover:bg-slate-800 hover:text-cyan-400"
                                                    >
                                                        {copiedAssetId === leak.id ? (
                                                            <Check size={14} className="text-emerald-400" />
                                                        ) : (
                                                            <Copy size={14} />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <LeakDetailDrawer
                leak={selectedLeak}
                relatedLeaks={relatedLeaksForSelected}
                onClose={() => setSelectedLeak(null)}
                onUpdateLeak={handleUpdateLeak}
                onSelectLeak={(l) => setSelectedLeak(l)}
            />

            {selectedLeak && typeof SocLeakDetailModal === "function" && (
                <SocLeakDetailModal
                    leak={selectedLeak}
                    onUpdateLeak={handleUpdateLeak}
                    onClose={() => setSelectedLeak(null)}
                />
            )}
        </div>
    );
}

function LeakDetailDrawer({
    leak,
    relatedLeaks,
    onClose,
    onUpdateLeak,
    onSelectLeak,
}: {
    leak: Leak | null;
    relatedLeaks: Leak[];
    onClose: () => void;
    onUpdateLeak: (id: number, changes: Partial<Leak>) => void;
    onSelectLeak: (leak: Leak) => void;
}) {
    const isOpen = leak !== null;
    const parsed = leak
        ? splitLeakType(leak.leak_type)
        : { title: "", subtitle: null };

    return (
        <>
            <div
                onClick={onClose}
                className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
            />

            <aside
                className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform border-l border-slate-800 bg-[#0d1119] shadow-2xl transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                {leak && (
                    <div className="flex h-full flex-col">
                        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
                            <div>
                                <div className="flex items-center gap-2 text-cyan-400">
                                    <ShieldAlert size={18} />
                                    <span className="text-xs font-medium uppercase tracking-wide">
                                        Sızıntı / Zafiyet Detayı
                                    </span>
                                </div>
                                <h3 className="mt-1 text-lg font-semibold text-slate-100">
                                    {parsed.title}
                                </h3>
                                {parsed.subtitle && (
                                    <p className="text-sm text-slate-500">{parsed.subtitle}</p>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                aria-label="Kapat"
                                className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                            <DetailRow icon={<Server size={14} />} label="Asset" value={leak.asset} mono />
                            <DetailRow
                                icon={<Server size={14} />}
                                label="Email"
                                value={leak.email_leak || "-"}
                                mono
                            />
                            <DetailRow icon={<Server size={14} />} label="Kaynak (Market)" value={leak.market} />
                            <DetailRow icon={<Clock size={14} />} label="Son Görülme" value={leak.last_seen} />
                            <DetailRow
                                icon={<Clock size={14} />}
                                label="Keşif Tarihi"
                                value={leak.discovery_date}
                            />
                            <UrlDetailRow url={leak.url || ""} />

                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <div className="text-xs uppercase tracking-wide text-slate-500">
                                        Certainty
                                    </div>
                                    <div className="mt-1">
                                        <Badge value={leak.certainty} variant="certainty" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs uppercase tracking-wide text-slate-500">
                                        Priority
                                    </div>
                                    <div className="mt-1">
                                        <Badge value={leak.priority} variant="priority" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs uppercase tracking-wide text-slate-500">
                                        Status
                                    </div>
                                    <div className="mt-1">
                                        <Badge value={leak.status} variant="status" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="text-xs uppercase tracking-wide text-slate-500">
                                    Leaked Password
                                </div>
                                <div className="mt-1">
                                    <PasswordCell
                                        leak={leak}
                                        onUpdateLeak={onUpdateLeak}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
                                    <Server size={12} />
                                    Sızıntı Kaynakları ({relatedLeaks.length})
                                </div>
                                <div className="overflow-hidden rounded-md border border-slate-800">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-500">
                                                <th className="px-2.5 py-2 font-medium">E-Posta / Varlık</th>
                                                <th className="px-2.5 py-2 font-medium">Sızıntı Kaynağı</th>
                                                <th className="px-2.5 py-2 font-medium">Kategori</th>
                                                <th className="px-2.5 py-2 font-medium">Tarih</th>
                                                <th className="px-2.5 py-2 text-right font-medium">İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {relatedLeaks.map((item) => {
                                                const isActive = item.id === leak.id;
                                                const sourceLabel = item.raw_source?.trim() || item.market;

                                                return (
                                                    <tr
                                                        key={item.id}
                                                        className={`border-b border-slate-800/60 last:border-b-0 ${isActive ? "bg-cyan-500/5" : ""
                                                            }`}
                                                    >
                                                        <td className="px-2.5 py-2 font-mono text-slate-300">
                                                            {item.email_leak || item.asset}
                                                        </td>
                                                        <td
                                                            className="max-w-[160px] truncate px-2.5 py-2 text-slate-400"
                                                            title={sourceLabel}
                                                        >
                                                            <a
                                                                href={buildInvestigationLink(item)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="hover:text-cyan-400 hover:underline"
                                                            >
                                                                {sourceLabel}
                                                            </a>
                                                        </td>
                                                        <td className="px-2.5 py-2 text-slate-400">
                                                            {splitLeakType(item.leak_type).title}
                                                        </td>
                                                        <td className="whitespace-nowrap px-2.5 py-2 font-mono text-slate-500">
                                                            {item.discovery_date}
                                                        </td>
                                                        <td className="px-2.5 py-2 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => onSelectLeak(item)}
                                                                disabled={isActive}
                                                                title="Detay Gör"
                                                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-cyan-400 disabled:opacity-40"
                                                            >
                                                                <Eye size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-800 px-5 py-4">
                            <a
                                href={buildInvestigationLink(leak)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-center justify-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
                            >
                                <ExternalLink size={15} />
                                Kaynakta İncele (IR)
                            </a>
                        </div>
                    </div>
                )}
            </aside>
        </>
    );
}

function DetailRow({
    icon,
    label,
    value,
    mono = false,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className="flex items-start justify-between gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-slate-500">
                {icon}
                {label}
            </div>
            <div className={`text-right text-slate-200 ${mono ? "font-mono" : ""}`}>
                {value || "-"}
            </div>
        </div>
    );
}