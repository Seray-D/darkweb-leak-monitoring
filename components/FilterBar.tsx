"use client";

import {
    Search,
    ListFilter,
    ShieldAlert,
    X,
    FileDown,
    FileText,
    Globe,
    Loader2,
} from "lucide-react";
import { Leak, STATUS_VALUES, PRIORITY_VALUES } from "@/lib/types";
import { exportToCSV, exportToPDF } from "@/lib/exportUtils";

// "Tüm Durumlar" / "Tüm Öncelikler" birer filtre joker'i (sentinel) olarak
// başa ekleniyor; asıl değer seti artık lib/types.ts'te tek bir yerden
// yönetiliyor (bkz. STATUS_VALUES / PRIORITY_VALUES) — SocLeakDetailModal
// (PasswordCell.tsx) ile aynı kaynağı paylaşıyor, bu yüzden artık burada
// filtrelenebilen bir durum modal'da seçilemiyor diye bir tutarsızlık olmaz.
export const STATUS_OPTIONS = ["Tüm Durumlar", ...STATUS_VALUES] as const;

export const PRIORITY_OPTIONS = ["Tüm Öncelikler", ...PRIORITY_VALUES] as const;

interface FilterBarProps {
    search: string;
    onSearchChange: (value: string) => void;
    status: string;
    onStatusChange: (value: string) => void;
    priority: string;
    onPriorityChange: (value: string) => void;
    resultCount: number;
    totalCount: number;
    filteredLeaks: Leak[];
    domainSearchValue: string;
    onDomainSearchValueChange: (value: string) => void;
    onDomainSearchSubmit: () => void;
    onDomainSearchClear: () => void;
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
    resultCount,
    totalCount,
    filteredLeaks,
    domainSearchValue,
    onDomainSearchValueChange,
    onDomainSearchSubmit,
    onDomainSearchClear,
    domainSearchLoading = false,
    domainSearchError = null,
    domainSearchActive = false,
}: FilterBarProps) {
    const hasActiveFilters =
        search.trim() !== "" ||
        status !== STATUS_OPTIONS[0] ||
        priority !== PRIORITY_OPTIONS[0];

    const clearFilters = () => {
        onSearchChange("");
        onStatusChange(STATUS_OPTIONS[0]);
        onPriorityChange(PRIORITY_OPTIONS[0]);
    };

    const handleExportCSV = () => {
        if (filteredLeaks.length === 0) return;
        exportToCSV(filteredLeaks);
    };

    const handleExportPDF = () => {
        if (filteredLeaks.length === 0) return;
        exportToPDF(filteredLeaks);
    };

    const handleDomainSubmitWrapper = () => {
        if (domainSearchValue.trim() === "" || domainSearchLoading) return;
        // Domain taraması yapıldığında yerel filtreleri temizle ki gelen veriyi gizlemesin!
        clearFilters();
        onDomainSearchSubmit();
    };

    const handleDomainInputKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleDomainSubmitWrapper();
        }
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
                            className="w-72 rounded-lg border border-slate-800 bg-[#0d1119] py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors hover:border-slate-700 focus:border-cyan-600/60"
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

            {/* Domain Bazlı Sızıntı Tarama */}
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-[#101520] p-3">
                <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Globe size={14} className="text-cyan-500" />
                    Domain Bazlı Sızıntı Tarama
                </div>

                <div className="relative min-w-[240px] flex-1">
                    <Globe
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                        type="text"
                        value={domainSearchValue}
                        onChange={(e) => onDomainSearchValueChange(e.target.value)}
                        onKeyDown={handleDomainInputKeyDown}
                        placeholder="örnek: sirket.com veya https://sirket.com"
                        className="w-full rounded-lg border border-slate-800 bg-[#0d1119] py-2 pl-9 pr-8 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors hover:border-slate-700 focus:border-cyan-600/60"
                    />
                    {domainSearchValue && (
                        <button
                            type="button"
                            onClick={() => onDomainSearchValueChange("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleDomainSubmitWrapper}
                    disabled={domainSearchValue.trim() === "" || domainSearchLoading}
                    className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cyan-500/10"
                >
                    {domainSearchLoading ? (
                        <>
                            <Loader2 size={14} className="animate-spin text-cyan-400" />
                            Taranıyor...
                        </>
                    ) : (
                        <>
                            <Globe size={14} />
                            Domain Tara
                        </>
                    )}
                </button>

                {domainSearchActive && (
                    <button
                        type="button"
                        onClick={onDomainSearchClear}
                        className="flex items-center gap-1 rounded-lg border border-slate-800 px-2.5 py-2 text-xs text-slate-500 transition-colors hover:border-slate-700 hover:text-slate-300"
                    >
                        <X size={13} />
                        Domain aramasını temizle
                    </button>
                )}

                {domainSearchError && (
                    <p className="w-full text-xs text-red-400">{domainSearchError}</p>
                )}
            </div>
        </div>
    );
}