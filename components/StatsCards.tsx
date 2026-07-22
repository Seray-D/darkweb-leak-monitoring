"use client";

import { useMemo } from "react";
import { ShieldAlert, Database, Globe } from "lucide-react";
import { Leak } from "@/lib/types";

interface StatsCardsProps {
    leaks: Leak[];
}

function getTopDomain(leaks: Leak[]): string {
    if (leaks.length === 0) return "-";

    const counts = new Map<string, number>();
    for (const leak of leaks) {
        const asset = leak.asset?.trim();
        if (!asset) continue;
        counts.set(asset, (counts.get(asset) ?? 0) + 1);
    }

    let topAsset = "-";
    let topCount = 0;
    for (const [asset, count] of counts) {
        if (count > topCount) {
            topAsset = asset;
            topCount = count;
        }
    }

    return topCount > 0 ? `${topAsset} (${topCount})` : "-";
}

export default function StatsCards({ leaks }: StatsCardsProps) {
    const { total, criticalCount, topDomain } = useMemo(() => {
        const total = leaks.length;
        const criticalCount = leaks.filter(
            (leak) => leak.priority?.toLowerCase() === "critical"
        ).length;
        const topDomain = getTopDomain(leaks);
        return { total, criticalCount, topDomain };
    }, [leaks]);

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Toplam Sızıntı Sayısı */}
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#101520] px-5 py-4">
                <div>
                    <p className="text-xs font-medium tracking-wide text-slate-500">
                        TOPLAM SIZINTI SAYISI
                    </p>
                    <p className="mt-1.5 text-2xl font-semibold text-slate-100">{total}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10">
                    <Database size={18} className="text-cyan-400" />
                </div>
            </div>

            {/* Kritik Riskli Hesap Sayısı */}
            <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/5 px-5 py-4">
                <div>
                    <p className="text-xs font-medium tracking-wide text-red-400/80">
                        KRİTİK RİSKLİ HESAP SAYISI
                    </p>
                    <p className="mt-1.5 text-2xl font-semibold text-red-400">{criticalCount}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10">
                    <ShieldAlert size={18} className="text-red-400" />
                </div>
            </div>

            {/* En Çok Etkilenen Domain */}
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#101520] px-5 py-4">
                <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-slate-500">
                        EN ÇOK ETKİLENEN DOMAIN
                    </p>
                    <p className="mt-1.5 truncate text-2xl font-semibold text-slate-100" title={topDomain}>
                        {topDomain}
                    </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
                    <Globe size={18} className="text-amber-400" />
                </div>
            </div>
        </div>
    );
}
