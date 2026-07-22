"use client";

import { useState, FormEvent } from "react";
import { Radar, Search, Loader2, ShieldAlert } from "lucide-react";

interface HeaderProps {
    onScan: (target: string) => Promise<void>;
    scanning: boolean;
    totalLeaks: number;
}

export default function Header({ onScan, scanning, totalLeaks }: HeaderProps) {
    const [query, setQuery] = useState("");

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed || scanning) return;
        await onScan(trimmed);
    };

    return (
        <header className="border-b border-slate-800 bg-[#0a0d14]">
            <div className="mx-auto max-w-7xl px-6 py-6">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
                            <Radar
                                size={22}
                                className="text-cyan-400"
                                style={{ animation: "spin 3s linear infinite" }}
                            />
                            <span className="absolute inset-0 rounded-lg border border-cyan-400/20 animate-ping" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight text-slate-100">
                                Dark Web Leak Monitoring
                            </h1>
                            <p className="text-xs text-slate-500">
                                Tehdit İstihbaratı Paneli · {totalLeaks} kayıtlı sızıntı
                            </p>
                        </div>
                    </div>

                    {/* Scan bar */}
                    <form onSubmit={handleSubmit} className="w-full max-w-md">
                        <div className="relative flex items-center overflow-hidden rounded-lg border border-slate-800 bg-[#101520] focus-within:border-cyan-600/60 transition-colors">
                            <Search size={16} className="ml-3 shrink-0 text-slate-500" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="E-posta veya domain girin (ör. izmir.bel.tr)"
                                disabled={scanning}
                                className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={scanning || !query.trim()}
                                className="flex shrink-0 items-center gap-1.5 border-l border-slate-800 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {scanning ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Taranıyor
                                    </>
                                ) : (
                                    <>
                                        <ShieldAlert size={14} />
                                        Scan
                                    </>
                                )}
                            </button>
                            {scanning && (
                                <span className="absolute bottom-0 left-0 h-[2px] w-full overflow-hidden bg-slate-800">
                                    <span className="block h-full w-1/3 bg-cyan-400" style={{ animation: "scanline 1.1s ease-in-out infinite" }} />
                                </span>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            <style>{`
        @keyframes scanline {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
        </header>
    );
}