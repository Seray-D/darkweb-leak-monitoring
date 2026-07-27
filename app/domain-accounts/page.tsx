"use client";

import { useState } from "react";
import {
    Search,
    Loader2,
    AlertTriangle,
    Globe2,
    Inbox,
    ShieldAlert,
    Clock,
    ExternalLink,
    History as HistoryIcon,
    Database,
    Radar,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { getDomainAccounts } from "@/lib/api";
import { DomainAccount } from "@/lib/types";

function getPriorityColor(priority: string): string {
    switch (priority?.toLowerCase()) {
        case "critical":
            return "bg-red-500/10 text-red-400 border-red-500/20";
        case "high":
            return "bg-orange-500/10 text-orange-400 border-orange-500/20";
        case "medium":
            return "bg-amber-500/10 text-amber-400 border-amber-500/20";
        case "low":
            return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        default:
            return "bg-slate-800 text-slate-400 border-slate-700";
    }
}

function SourceBadge({ source }: { source: DomainAccount["source"] }) {
    if (source === "monitored") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300">
                <Radar size={11} />
                İzleniyor
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[11px] text-slate-400">
            <Database size={11} />
            Anlık Tarama
        </span>
    );
}

export default function DomainAccountsPage() {
    const [domainInput, setDomainInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<DomainAccount[] | null>(null);
    const [searchedDomain, setSearchedDomain] = useState<string | null>(null);
    const [history, setHistory] = useState<string[]>([]);

    const runSearch = async (value: string) => {
        const cleaned = value.trim();
        if (!cleaned || loading) return;

        setLoading(true);
        setError(null);

        try {
            const data = await getDomainAccounts(cleaned);
            setAccounts(data);
            setSearchedDomain(cleaned);
            setHistory((prev) => {
                const withoutDuplicate = prev.filter((d) => d !== cleaned);
                return [cleaned, ...withoutDuplicate].slice(0, 8);
            });
        } catch (err) {
            setAccounts(null);
            setError(
                err instanceof Error ? err.message : "Domain hesapları getirilirken hata oluştu."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        runSearch(domainInput);
    };

    return (
        <main className="min-h-screen bg-[#05070c] text-slate-200">
            <Sidebar />

            <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 md:pl-24">
                {/* Başlık */}
                <div className="mb-8">
                    <h1 className="flex items-center gap-2.5 text-xl font-semibold text-slate-100">
                        <ShieldAlert size={20} className="text-cyan-400" />
                        Domain Hesap Sorgulama
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-500">
                        Belirli bir domain&apos;e ait, veritabanında kayıtlı TÜM sızdırılmış
                        hesapları (hem anlık taramalardan hem de izleme listesindeki kalıcı
                        geçmişten) listeler. Yeni bir tarama tetiklemez, yalnızca mevcut kayıtları
                        sorgular.
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
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            placeholder="ör. izmir.bel.tr"
                            className="w-full rounded-md border border-slate-800 bg-slate-900/60 py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !domainInput.trim()}
                        className="flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        {loading ? "Sorgulanıyor..." : "Sorgula"}
                    </button>
                </form>

                {error && (
                    <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        <AlertTriangle size={15} className="shrink-0" />
                        {error}
                    </div>
                )}

                {/* Sonuçlar */}
                {accounts && (
                    <div className="mb-8 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
                        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                            <div>
                                <p className="text-sm font-medium text-slate-200">{searchedDomain}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {accounts.length} hesap bulundu
                                </p>
                            </div>
                        </div>

                        {accounts.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
                                <Inbox size={28} className="text-slate-700" />
                                <p className="text-sm text-slate-500">
                                    Bu domain için veritabanında kayıtlı herhangi bir hesap
                                    bulunamadı.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-800 bg-slate-900/60 text-xs text-slate-500">
                                            <th className="px-4 py-3 font-medium">E-POSTA / VARLIK</th>
                                            <th className="px-4 py-3 font-medium">ŞİFRE</th>
                                            <th className="px-4 py-3 font-medium">SIZINTI TÜRÜ</th>
                                            <th className="px-4 py-3 font-medium">KAYNAK</th>
                                            <th className="px-4 py-3 font-medium">ÖNCELİK</th>
                                            <th className="px-4 py-3 font-medium">KEŞİF TARİHİ</th>
                                            <th className="px-4 py-3 font-medium">KÖKEN</th>
                                            <th className="px-4 py-3 text-right font-medium">İŞLEM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accounts.map((acc) => (
                                            <tr
                                                key={acc.id}
                                                className="border-b border-slate-800/60 last:border-b-0 hover:bg-slate-900/60"
                                            >
                                                <td className="px-4 py-3 font-mono text-slate-300">
                                                    {acc.email_leak || acc.asset}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-slate-500">
                                                    {acc.leaked_password || "******"}
                                                </td>
                                                <td className="px-4 py-3 text-slate-400">{acc.leak_type}</td>
                                                <td className="px-4 py-3 text-slate-400">{acc.market}</td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${getPriorityColor(
                                                            acc.priority
                                                        )}`}
                                                    >
                                                        {acc.priority}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={11} />
                                                        {acc.discovery_date}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <SourceBadge source={acc.source} />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {acc.url ? (
                                                        <a
                                                            href={acc.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-slate-500 transition hover:text-cyan-400"
                                                            aria-label="Kaynağı görüntüle"
                                                        >
                                                            <ExternalLink size={14} />
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-700">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Son Aramalar */}
                {history.length > 0 && (
                    <div>
                        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-600">
                            <HistoryIcon size={13} />
                            Son Aramalar
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {history.map((d) => (
                                <button
                                    key={d}
                                    onClick={() => {
                                        setDomainInput(d);
                                        runSearch(d);
                                    }}
                                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                                        searchedDomain === d
                                            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                                            : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                    }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
