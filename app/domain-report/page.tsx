"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    Search,
    Loader2,
    AlertTriangle,
    Globe2,
    Mail,
    Inbox,
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Clock,
    FileWarning,
    History as HistoryIcon,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { getDomainAssetReport } from "@/lib/api";
import { DomainAssetReport, MonitoredAsset } from "@/lib/types";

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

function AssetCard({ asset }: { asset: MonitoredAsset }) {
    const [expanded, setExpanded] = useState(true);
    const TypeIcon = asset.asset_type === "email" ? Mail : Globe2;
    const leakCount = asset.breach_logs.length;

    return (
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
            <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-900/70"
            >
                <div className="flex min-w-0 items-center gap-2.5">
                    <TypeIcon size={15} className="shrink-0 text-slate-500" />
                    <span className="truncate text-sm font-medium text-slate-200">
                        {asset.target}
                    </span>
                    {asset.asset_type === "domain" && (
                        asset.is_verified ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                                <ShieldCheck size={10} />
                                Doğrulandı
                            </span>
                        ) : (
                            <span className="inline-flex shrink-0 items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                                Doğrulanmadı
                            </span>
                        )
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-slate-500">
                        <span className="text-slate-300">{leakCount}</span> kayıt
                    </span>
                    {expanded ? (
                        <ChevronUp size={15} className="text-slate-600" />
                    ) : (
                        <ChevronDown size={15} className="text-slate-600" />
                    )}
                </div>
            </button>

            {expanded && (
                leakCount === 0 ? (
                    <div className="border-t border-slate-800 px-4 py-6 text-center text-xs text-slate-600">
                        Bu varlık için kayıtlı sızıntı geçmişi yok.
                    </div>
                ) : (
                    <div className="overflow-x-auto border-t border-slate-800">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-500">
                                    <th className="px-3 py-2 font-medium">E-POSTA</th>
                                    <th className="px-3 py-2 font-medium">ŞİFRE</th>
                                    <th className="px-3 py-2 font-medium">SIZINTI TÜRÜ</th>
                                    <th className="px-3 py-2 font-medium">KAYNAK</th>
                                    <th className="px-3 py-2 font-medium">ÖNCELİK</th>
                                    <th className="px-3 py-2 font-medium">KEŞİF TARİHİ</th>
                                    <th className="px-3 py-2 text-right font-medium">İŞLEM</th>
                                </tr>
                            </thead>
                            <tbody>
                                {asset.breach_logs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="border-b border-slate-800/60 last:border-b-0 hover:bg-slate-900/40"
                                    >
                                        <td className="px-3 py-2 font-mono text-slate-300">
                                            {log.email_leak || log.asset}
                                        </td>
                                        <td className="px-3 py-2 font-mono text-slate-500">
                                            {log.leaked_password || "******"}
                                        </td>
                                        <td className="px-3 py-2 text-slate-400">{log.leak_type}</td>
                                        <td className="px-3 py-2 text-slate-400">{log.market}</td>
                                        <td className="px-3 py-2">
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${getPriorityColor(
                                                    log.priority || ""
                                                )}`}
                                            >
                                                {log.priority}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {log.discovery_date}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {log.url ? (
                                                <a
                                                    href={log.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label="Kaynağı görüntüle"
                                                    className="inline-flex items-center gap-1 text-slate-500 transition hover:text-cyan-400"
                                                >
                                                    <ExternalLink size={12} />
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
                )
            )}
        </div>
    );
}

function DomainAssetReportContent() {
    const searchParams = useSearchParams();
    const [domainInput, setDomainInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<DomainAssetReport | null>(null);
    const [history, setHistory] = useState<string[]>([]);

    const runSearch = async (value: string) => {
        const cleaned = value.trim();
        if (!cleaned || loading) return;

        setLoading(true);
        setError(null);

        try {
            const data = await getDomainAssetReport(cleaned);
            setReport(data);
            setHistory((prev) => {
                const withoutDuplicate = prev.filter((d) => d !== cleaned);
                return [cleaned, ...withoutDuplicate].slice(0, 8);
            });
        } catch (err) {
            setReport(null);
            setError(
                err instanceof Error ? err.message : "Domain raporu getirilirken hata oluştu."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        runSearch(domainInput);
    };

    // Ana sayfadaki üst arama çubuğundan "?domain=..." parametresiyle
    // yönlendirilindiyse, sayfa açılır açılmaz otomatik olarak o domain için
    // raporu getir.
    useEffect(() => {
        const domainParam = searchParams.get("domain");
        if (domainParam) {
            setDomainInput(domainParam);
            runSearch(domainParam);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    return (
        <main className="min-h-screen bg-[#05070c] text-slate-200">
            <Sidebar />

            <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 md:pl-24">
                {/* Başlık */}
                <div className="mb-8">
                    <h1 className="flex items-center gap-2.5 text-xl font-semibold text-slate-100">
                        <FileWarning size={20} className="text-cyan-400" />
                        Kurumsal Domain Raporu
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-500">
                        Bir kök domain girin (örn. <code className="text-slate-400">izmir.bel.tr</code>);
                        izleme listenizdeki bu domaine ait TÜM e-postaları ve alt domainleri bulup,
                        her birinin kalıcı sızıntı geçmişini (AssetBreachLog) gruplu şekilde bir
                        araya getirir. Yeni bir tarama tetiklemez.
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
                        {loading ? "Sorgulanıyor..." : "Rapor Getir"}
                    </button>
                </form>

                {error && (
                    <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        <AlertTriangle size={15} className="shrink-0" />
                        {error}
                    </div>
                )}

                {/* Özet */}
                {report && (
                    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
                            <p className="text-xs text-slate-500">Domain</p>
                            <p className="mt-1 truncate text-sm font-medium text-slate-200">
                                {report.domain}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
                            <p className="text-xs text-slate-500">Eşleşen Varlık</p>
                            <p className="mt-1 text-sm font-medium text-slate-200">
                                {report.matched_asset_count}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
                            <p className="text-xs text-slate-500">Toplam Sızıntı Kaydı</p>
                            <p className="mt-1 text-sm font-medium text-slate-200">
                                {report.total_leak_count}
                            </p>
                        </div>
                    </div>
                )}

                {/* Varlık Kartları */}
                {report && (
                    report.assets.length === 0 ? (
                        <div className="mb-8 flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-14 text-center">
                            <Inbox size={28} className="text-slate-700" />
                            <p className="text-sm text-slate-500">
                                Bu domain izleme listenizde kayıtlı değil. Önce Varlık Yönetimi
                                ekranından ekleyip taratmanız gerekir.
                            </p>
                        </div>
                    ) : (
                        <div className="mb-8 space-y-3">
                            {report.assets.map((asset) => (
                                <AssetCard key={asset.id} asset={asset} />
                            ))}
                        </div>
                    )
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
                                        report?.domain === d
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

export default function DomainAssetReportPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen bg-[#05070c] text-slate-200">
                    <Sidebar />
                    <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 md:pl-24 text-sm text-slate-500">
                        Yükleniyor...
                    </div>
                </main>
            }
        >
            <DomainAssetReportContent />
        </Suspense>
    );
}
