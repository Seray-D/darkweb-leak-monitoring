"use client";

import { useState } from "react";
import {
    Search,
    Loader2,
    AlertTriangle,
    Copy,
    Check,
    Globe2,
    Zap,
    History,
    ExternalLink,
    CircleCheck,
    CircleX,
    Clock,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { getSubdomains, checkSubdomainsAlive } from "@/lib/api";
import { SubdomainLivenessItem, SubdomainSearchResult } from "@/lib/types";

// Local (DB'siz) arama geçmişi girdisi — sayfa yenilenince kaybolur, bu kasıtlıdır.
interface HistoryEntry {
    id: string;
    result: SubdomainSearchResult;
    searchedAt: number;
}

const MAX_HISTORY_ENTRIES = 8;

export default function SubdomainDiscoveryPage() {
    const [domainInput, setDomainInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SubdomainSearchResult | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    // Canlılık kontrolü — subdomain -> sonuç eşlemesi.
    const [livenessMap, setLivenessMap] = useState<Record<string, SubdomainLivenessItem>>({});
    const [livenessLoading, setLivenessLoading] = useState(false);
    const [livenessError, setLivenessError] = useState<string | null>(null);

    const [copiedSubdomain, setCopiedSubdomain] = useState<string | null>(null);
    const [copiedAll, setCopiedAll] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleaned = domainInput.trim();
        if (!cleaned || loading) return;

        setLoading(true);
        setError(null);
        setLivenessMap({});
        setLivenessError(null);

        try {
            const data = await getSubdomains(cleaned);
            setResult(data);

            setHistory((prev) => {
                // Aynı domain zaten geçmişte varsa, güncel sonuçla öne al.
                const withoutDuplicate = prev.filter((h) => h.result.domain !== data.domain);
                const next: HistoryEntry[] = [
                    { id: `${data.domain}-${Date.now()}`, result: data, searchedAt: Date.now() },
                    ...withoutDuplicate,
                ];
                return next.slice(0, MAX_HISTORY_ENTRIES);
            });
        } catch (err) {
            setResult(null);
            setError(
                err instanceof Error ? err.message : "Subdomain taraması sırasında hata oluştu."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleCheckAlive = async () => {
        if (!result || result.subdomains.length === 0 || livenessLoading) return;

        setLivenessLoading(true);
        setLivenessError(null);

        try {
            const responseData = await checkSubdomainsAlive(result.subdomains);

            // Backend'in veri yapısına göre (array veya obje içindeki results dizisi) uyumlu hale getirdik:
            const itemsList = Array.isArray(responseData)
                ? responseData
                : (responseData && Array.isArray((responseData as any).results) ? (responseData as any).results : []);

            const map: Record<string, SubdomainLivenessItem> = {};
            for (const item of itemsList) {
                if (item && item.subdomain) {
                    map[item.subdomain] = item;
                }
            }
            setLivenessMap(map);
        } catch (err) {
            setLivenessError(
                err instanceof Error ? err.message : "Canlılık kontrolü sırasında hata oluştu."
            );
        } finally {
            setLivenessLoading(false);
        }
    };

    const handleCopySubdomain = async (subdomain: string) => {
        try {
            await navigator.clipboard.writeText(subdomain);
            setCopiedSubdomain(subdomain);
            setTimeout(() => setCopiedSubdomain(null), 1500);
        } catch {
            // Panoya erişim engellenmişse sessizce yut — kritik olmayan bir kolaylık özelliği.
        }
    };

    const handleCopyAll = async () => {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.subdomains.join("\n"));
            setCopiedAll(true);
            setTimeout(() => setCopiedAll(false), 1500);
        } catch {
            // no-op
        }
    };

    const loadFromHistory = (entry: HistoryEntry) => {
        setResult(entry.result);
        setLivenessMap({});
        setLivenessError(null);
        setError(null);
        setDomainInput(entry.result.domain);
    };

    return (
        <main className="min-h-screen bg-[#05070c] text-slate-200">
            <Sidebar />

            <div className="mx-auto max-w-5xl px-6 pb-20 pt-20 md:pl-24">
                {/* Başlık */}
                <div className="mb-8">
                    <h1 className="flex items-center gap-2.5 text-xl font-semibold text-slate-100">
                        <Search size={20} className="text-cyan-400" />
                        Subdomain Keşfi
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-500">
                        Certificate Transparency logları (crt.sh) üzerinden, DNS sorgusu veya
                        domain sahiplik doğrulaması gerektirmeden pasif alt alan adı keşfi yapar.
                        crt.sh yanıt vermezse otomatik olarak HackerTarget yedek kaynağına geçilir.
                    </p>
                </div>

                {/* Arama Formu */}
                <form onSubmit={handleSearch} className="mb-6 flex gap-2">
                    <div className="relative flex-1">
                        <Globe2
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                        />
                        <input
                            type="text"
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            placeholder="ornek.com"
                            className="w-full rounded-lg border border-slate-800 bg-[#0a0d14] py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-cyan-500/50"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !domainInput.trim()}
                        className="flex items-center gap-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <Search size={15} />
                        )}
                        {loading ? "Taranıyor..." : "Tara"}
                    </button>
                </form>

                {error && (
                    <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        <AlertTriangle size={15} className="shrink-0" />
                        {error}
                    </div>
                )}

                {/* Sonuç Paneli */}
                {result && (
                    <div className="mb-8 rounded-xl border border-slate-800 bg-[#0a0d14]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
                            <div>
                                <p className="text-sm font-medium text-slate-200">
                                    {result.domain}
                                </p>
                                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                    <span>{result.count} subdomain bulundu</span>
                                    <span
                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${result.source === "hackertarget"
                                                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                                            }`}
                                    >
                                        kaynak: {result.source}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCopyAll}
                                    disabled={result.subdomains.length === 0}
                                    className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {copiedAll ? <Check size={12} /> : <Copy size={12} />}
                                    {copiedAll ? "Kopyalandı" : "Tümünü Kopyala"}
                                </button>
                                <button
                                    onClick={handleCheckAlive}
                                    disabled={result.subdomains.length === 0 || livenessLoading}
                                    className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {livenessLoading ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                        <Zap size={12} />
                                    )}
                                    {livenessLoading ? "Kontrol Ediliyor..." : "Canlılık Kontrolü Yap"}
                                </button>
                            </div>
                        </div>

                        {livenessError && (
                            <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                                <AlertTriangle size={13} className="shrink-0" />
                                {livenessError}
                            </div>
                        )}

                        {result.subdomains.length === 0 ? (
                            <p className="px-5 py-8 text-center text-sm text-slate-500">
                                Bu domain için herhangi bir subdomain bulunamadı.
                            </p>
                        ) : (
                            <ul className="max-h-[28rem] divide-y divide-slate-800/70 overflow-y-auto">
                                {result.subdomains.map((subdomain) => {
                                    const liveness = livenessMap[subdomain];
                                    return (
                                        <li
                                            key={subdomain}
                                            className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                                        >
                                            <span className="truncate text-slate-300">
                                                {subdomain}
                                            </span>

                                            <div className="flex shrink-0 items-center gap-3">
                                                {livenessLoading && !liveness && (
                                                    <Loader2
                                                        size={13}
                                                        className="animate-spin text-slate-600"
                                                    />
                                                )}

                                                {liveness && liveness.alive && (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                                                        <CircleCheck size={11} />
                                                        {liveness.scheme}
                                                        {liveness.status_code !== null &&
                                                            liveness.status_code !== undefined
                                                            ? ` · ${liveness.status_code}`
                                                            : ""}
                                                        {liveness.response_time_ms !== null &&
                                                            liveness.response_time_ms !== undefined && (
                                                                <span className="flex items-center gap-0.5 text-emerald-400/70">
                                                                    <Clock size={10} />
                                                                    {liveness.response_time_ms}ms
                                                                </span>
                                                            )}
                                                    </span>
                                                )}

                                                {liveness && !liveness.alive && (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[11px] text-slate-500">
                                                        <CircleX size={11} />
                                                        Yanıt yok
                                                    </span>
                                                )}

                                                {liveness && liveness.alive && (
                                                    <a
                                                        href={`${liveness.scheme}://${subdomain}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        aria-label={`${subdomain} adresini yeni sekmede aç`}
                                                        className="text-slate-500 transition hover:text-cyan-300"
                                                    >
                                                        <ExternalLink size={13} />
                                                    </a>
                                                )}

                                                <button
                                                    onClick={() => handleCopySubdomain(subdomain)}
                                                    aria-label={`${subdomain} kopyala`}
                                                    className="text-slate-600 transition hover:text-slate-300"
                                                >
                                                    {copiedSubdomain === subdomain ? (
                                                        <Check size={13} />
                                                    ) : (
                                                        <Copy size={13} />
                                                    )}
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}

                {/* Son Aramalar (yalnızca oturum içi, DB'ye yazılmaz) */}
                {history.length > 0 && (
                    <div>
                        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-600">
                            <History size={13} />
                            Son Aramalar
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {history.map((entry) => (
                                <button
                                    key={entry.id}
                                    onClick={() => loadFromHistory(entry)}
                                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${result?.domain === entry.result.domain
                                            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                                            : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                        }`}
                                >
                                    {entry.result.domain}
                                    <span className="text-slate-600">
                                        · {entry.result.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}