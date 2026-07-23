"use client";

import { useState } from "react";
import { Search, Globe2, Copy, Loader2, Check } from "lucide-react";
import { getSubdomains } from "@/lib/api";

interface SubdomainResult {
    domain: string;
    source: string;
    count: number;
    subdomains: string[];
}

export default function SubdomainScanner() {
    const [domain, setDomain] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SubdomainResult | null>(null);
    const [copied, setCopied] = useState(false);

    const handleSearch = async () => {
        const cleaned = domain.trim();
        if (!cleaned) return;

        setLoading(true);
        setError(null);
        setResult(null);
        setCopied(false);

        try {
            const data = await getSubdomains(cleaned);
            setResult(data);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") handleSearch();
    };

    const handleCopyAll = async () => {
        if (!result?.subdomains.length) return;
        await navigator.clipboard.writeText(result.subdomains.join("\n"));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Globe2 size={16} className="text-cyan-400" />
                <h2 className="text-sm font-semibold text-slate-200">
                    Subdomain Keşfi
                </h2>
                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                    crt.sh · Pasif OSINT
                </span>
            </div>

            <p className="text-xs text-slate-500">
                Certificate Transparency (CT) loglarından, DNS sorgusu veya domain
                doğrulaması yapılmadan, bu domain adına geçmişte düzenlenmiş SSL
                sertifikalarında geçen alt alan adları listelenir.
            </p>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="example.com"
                    className="flex-1 rounded-md border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500/60"
                />
                <button
                    onClick={handleSearch}
                    disabled={loading || !domain.trim()}
                    className="flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <Search size={14} />
                    )}
                    {loading ? "Taranıyor..." : "Tara"}
                </button>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            {result && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                            <span className="font-medium text-slate-200">
                                {result.domain}
                            </span>{" "}
                            için{" "}
                            <span className="font-medium text-cyan-300">
                                {result.count}
                            </span>{" "}
                            alt alan adı bulundu.
                        </p>
                        {result.count > 0 && (
                            <button
                                onClick={handleCopyAll}
                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
                            >
                                {copied ? <Check size={12} /> : <Copy size={12} />}
                                {copied ? "Kopyalandı" : "Tümünü Kopyala"}
                            </button>
                        )}
                    </div>

                    {result.count === 0 ? (
                        <p className="text-sm text-slate-500">
                            crt.sh sertifika loglarında bu domain&apos;e ait kayıt
                            bulunamadı.
                        </p>
                    ) : (
                        <ul className="max-h-64 divide-y divide-slate-800 overflow-y-auto rounded-md border border-slate-800">
                            {result.subdomains.map((sub) => (
                                <li
                                    key={sub}
                                    className="px-3 py-1.5 font-mono text-sm text-slate-300"
                                >
                                    {sub}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
