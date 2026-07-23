"use client";

import {
    Search,
    ListFilter,
    ShieldAlert,
    Database,
    X,
    FileDown,
    FileText,
} from "lucide-react";
import { Leak, STATUS_VALUES, PRIORITY_VALUES } from "@/lib/types";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";

export const STATUS_OPTIONS = ["Tüm Durumlar", ...STATUS_VALUES] as const;
export const PRIORITY_OPTIONS = ["Tüm Öncelikler", ...PRIORITY_VALUES] as const;
export const MARKET_OPTIONS = ["Tüm Marketler", "XposedOrNot", "LeakIX", "OTX", "BreachDirectory"] as const;

interface FilterBarProps {
    search: string;
    onSearchChange: (value: string) => void;
    status: string;
    onStatusChange: (value: string) => void;
    priority: string;
    onPriorityChange: (value: string) => void;
    market?: string;                 // Opsiyonel yapıldı
    onMarketChange?: (value: string) => void; // Opsiyonel yapıldı
    resultCount: number;
    totalCount: number;
    filteredLeaks: Leak[];
    domainSearchValue?: string;
    onDomainSearchValueChange?: (val: string) => void;
    onDomainSearchSubmit?: () => void;
    onDomainSearchClear?: () => void;
    domainSearchLoading?: boolean;
    domainSearchError?: string | null;
    domainSearchActive?: boolean;
}

const selectClasses =
    "appearance-none rounded-lg border border-slate-800 bg-[#0d1119] py-2 pl-9 pr-8 text-sm text-slate-300 outline-none transition-colors hover:border-slate-700 focus:border-cyan-600/60 cursor-pointer";

export default function FilterBar({
    search,
    onSearchChange,
    status,
    onStatusChange,
    priority,
    onPriorityChange,
    market = MARKET_OPTIONS[0],
    onMarketChange,
    resultCount,
    totalCount,
    filteredLeaks,
}: FilterBarProps) {
    const hasActiveFilters =
        search.trim() !== "" ||
        status !== STATUS_OPTIONS[0] ||
        priority !== PRIORITY_OPTIONS[0] ||
        market !== MARKET_OPTIONS[0];

    const clearFilters = () => {
        onSearchChange("");
        onStatusChange(STATUS_OPTIONS[0]);
        onPriorityChange(PRIORITY_OPTIONS[0]);
        if (onMarketChange) {
            onMarketChange(MARKET_OPTIONS[0]);
        }
    };

    const handleExportCSV = () => {
        if (filteredLeaks.length === 0) return;
        exportToCSV(filteredLeaks);
    };

    const handleExportPDF = () => {
        if (filteredLeaks.length === 0) return;
        exportToPDF(filteredLeaks);
    };

    return (
        <div className="mb-4">
            {/* Üst Filtre Alanı */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#101520] p-3">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Quick search */}
                    <div className="relative">
                        <Search
                            size={15}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Asset, e-posta, sızıntı tipi veya market ara..."
                            className="w-64 rounded-lg border border-slate-800 bg-[#0d1119] py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors hover:border-slate-700 focus:border-cyan-600/60"
                        />
                    </div>

                    {/* Status filter */}
                    <div className="relative">
                        <ListFilter
                            size={14}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <select
                            value={status}
                            onChange={(e) => onStatusChange(e.target.value)}
                            className={selectClasses}
                        >
                            {STATUS_OPTIONS.map((opt) => (
                                <option
                                    key={opt}
                                    value={opt}
                                    className="bg-[#0d1119] text-slate-200"
                                >
                                    {opt}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Priority filter */}
                    <div className="relative">
                        <ShieldAlert
                            size={14}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <select
                            value={priority}
                            onChange={(e) => onPriorityChange(e.target.value)}
                            className={selectClasses}
                        >
                            {PRIORITY_OPTIONS.map((opt) => (
                                <option
                                    key={opt}
                                    value={opt}
                                    className="bg-[#0d1119] text-slate-200"
                                >
                                    {opt}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Market filter */}
                    <div className="relative">
                        <Database
                            size={14}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />
                        <select
                            value={market}
                            onChange={(e) => onMarketChange && onMarketChange(e.target.value)}
                            className={selectClasses}
                        >
                            {MARKET_OPTIONS.map((opt) => (
                                <option
                                    key={opt}
                                    value={opt}
                                    className="bg-[#0d1119] text-slate-200"
                                >
                                    {opt}
                                </option>
                            ))}
                        </select>
                    </div>

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="flex items-center gap-1 rounded-lg border border-slate-800 px-2.5 py-2 text-xs text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
                        >
                            <X size={13} />
                            Filtreleri temizle
                        </button>
                    )}
                </div>

                {/* Dışa Aktar Butonları */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        disabled={filteredLeaks.length === 0}
                        title="Filtrelenmiş sonuçları CSV olarak indir"
                        className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-cyan-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-800 disabled:hover:text-slate-300"
                    >
                        <FileDown size={14} />
                        Export CSV
                    </button>

                    <button
                        type="button"
                        onClick={handleExportPDF}
                        disabled={filteredLeaks.length === 0}
                        title="Filtrelenmiş sonuçlar için SOC Threat Intelligence Report (PDF) indir"
                        className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cyan-500/10"
                    >
                        <FileText size={14} />
                        Download PDF Report
                    </button>

                    <p className="whitespace-nowrap text-xs text-slate-500">
                        <span className="font-medium text-slate-300">{resultCount}</span> /{" "}
                        {totalCount} kayıt
                    </p>
                </div>
            </div>
        </div>
    );
}