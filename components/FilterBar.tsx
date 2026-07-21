"use client";

import { Search, ListFilter, ShieldAlert, X } from "lucide-react";

export const STATUS_OPTIONS = [
  "Tüm Durumlar",
  "Active",
  "Resolved",
  "Monitoring",
] as const;
export const PRIORITY_OPTIONS = [
  "Tüm Öncelikler",
  "Critical",
  "High",
  "Medium",
  "Info",
] as const;

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  priority: string;
  onPriorityChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
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

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#101520] p-3">
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

      <p className="whitespace-nowrap text-xs text-slate-500">
        <span className="font-medium text-slate-300">{resultCount}</span> /{" "}
        {totalCount} kayıt
      </p>
    </div>
  );
}
