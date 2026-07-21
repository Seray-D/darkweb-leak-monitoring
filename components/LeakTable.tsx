"use client";

import { useMemo, useState } from "react";
import { Leak } from "@/lib/types";
import Badge from "./Badge";
import PasswordCell from "./PasswordCell";
import FilterBar, { STATUS_OPTIONS, PRIORITY_OPTIONS } from "./FilterBar";
import { Fingerprint, ExternalLink, Copy, Inbox, SearchX } from "lucide-react";

interface LeakTableProps {
  leaks: Leak[];
  loading: boolean;
}

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

export default function LeakTable({ leaks, loading }: LeakTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(STATUS_OPTIONS[0]);
  const [priority, setPriority] = useState<string>(PRIORITY_OPTIONS[0]);

  const filteredLeaks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leaks.filter((leak) => {
      const matchesStatus =
        status === STATUS_OPTIONS[0] || leak.status === status;
      const matchesPriority =
        priority === PRIORITY_OPTIONS[0] || leak.priority === priority;

      const matchesQuery =
        query === "" ||
        [leak.asset, leak.email_leak, leak.leak_type, leak.market].some(
          (field) => field?.toLowerCase().includes(query),
        );

      return matchesStatus && matchesPriority && matchesQuery;
    });
  }, [leaks, search, status, priority]);

  const hasActiveFilters =
    search.trim() !== "" ||
    status !== STATUS_OPTIONS[0] ||
    priority !== PRIORITY_OPTIONS[0];

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

  if (leaks.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-[#101520]">
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
          <Inbox size={28} className="text-slate-600" />
          <p className="text-sm">Henüz kayıtlı sızıntı bulunamadı.</p>
          <p className="text-xs text-slate-600">
            Yukarıdaki arama çubuğunu kullanarak bir tarama başlatın.
          </p>
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
        resultCount={filteredLeaks.length}
        totalCount={leaks.length}
      />

      {filteredLeaks.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-[#101520]">
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
            <SearchX size={28} className="text-slate-600" />
            <p className="text-sm">
              Aramanıza veya filtrelerinize uygun sızıntı kaydı bulunamadı.
            </p>
            {hasActiveFilters && (
              <p className="text-xs text-slate-600">
                Farklı bir arama terimi deneyin veya filtreleri temizleyin.
              </p>
            )}
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
                {filteredLeaks.map((leak) => (
                  <tr
                    key={leak.id}
                    className="border-b border-slate-800/60 transition-colors last:border-b-0 hover:bg-slate-900/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-200">
                      {leak.asset}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-300">
                      {leak.email_leak}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <PasswordCell value={leak.leaked_password} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-400">
                      {leak.leak_type}
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
                          title="Detayları görüntüle"
                          className="rounded p-1.5 transition-colors hover:bg-slate-800 hover:text-cyan-400"
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          type="button"
                          title="Varlığı kopyala"
                          onClick={() =>
                            navigator.clipboard.writeText(leak.asset)
                          }
                          className="rounded p-1.5 transition-colors hover:bg-slate-800 hover:text-cyan-400"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
