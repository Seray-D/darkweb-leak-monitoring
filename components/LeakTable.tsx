"use client";

import { useMemo, useState } from "react";
import { Leak } from "@/lib/types";
import Badge from "./Badge";
import PasswordCell from "./PasswordCell";
import FilterBar, { STATUS_OPTIONS, PRIORITY_OPTIONS } from "./FilterBar";
import {
  Fingerprint,
  ExternalLink,
  Copy,
  Inbox,
  SearchX,
  X,
  ShieldAlert,
  Clock,
  Server,
} from "lucide-react";

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

// LeakIX ve OTX servisleri artık `leak_type` alanını iki parça halinde
// üretiyor: "<Ana Başlık> • <Port/Protokol - Teknik Detay>" (LeakIX) veya
// "<Tehdit Kategorisi> • <Pulse Başlığı>" (OTX). Bu ayraç ile ayrıştırıp
// üstte kalın ana başlığı, altında gri/küçük teknik alt satırı gösteriyoruz.
const PART_SEPARATOR = " • ";

function splitLeakType(leakType: string): { title: string; subtitle: string | null } {
  if (!leakType) {
    return { title: "Bilinmeyen", subtitle: null };
  }
  const idx = leakType.indexOf(PART_SEPARATOR);
  if (idx === -1) {
    return { title: leakType, subtitle: null };
  }
  return {
    title: leakType.slice(0, idx),
    subtitle: leakType.slice(idx + PART_SEPARATOR.length),
  };
}

export default function LeakTable({ leaks, loading }: LeakTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(STATUS_OPTIONS[0]);
  const [priority, setPriority] = useState<string>(PRIORITY_OPTIONS[0]);
  const [selectedLeak, setSelectedLeak] = useState<Leak | null>(null);

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
                {filteredLeaks.map((leak) => {
                  const parsedLeakType = splitLeakType(leak.leak_type);

                  return (
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
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-300">
                          {parsedLeakType.title}
                        </div>
                        {parsedLeakType.subtitle && (
                          <div className="mt-0.5 text-xs text-slate-500">
                            {parsedLeakType.subtitle}
                          </div>
                        )}
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
                            onClick={() => setSelectedLeak(leak)}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LeakDetailDrawer leak={selectedLeak} onClose={() => setSelectedLeak(null)} />
    </div>
  );
}

/**
 * Teknik ekibin (SOC/IR) ham sızıntı/zafiyet detayını inceleyebilmesi için
 * sağdan açılan Drawer. "İncele" (ExternalLink) ikonuna tıklandığında açılır.
 */
function LeakDetailDrawer({
  leak,
  onClose,
}: {
  leak: Leak | null;
  onClose: () => void;
}) {
  const isOpen = leak !== null;
  const parsed = leak
    ? splitLeakType(leak.leak_type)
    : { title: "", subtitle: null };

  return (
    <>
      {/* Arka plan karartma */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sağdan açılan Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform border-l border-slate-800 bg-[#0d1119] shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {leak && (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <div className="flex items-center gap-2 text-cyan-400">
                  <ShieldAlert size={18} />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Sızıntı / Zafiyet Detayı
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-semibold text-slate-100">
                  {parsed.title}
                </h3>
                {parsed.subtitle && (
                  <p className="text-sm text-slate-500">{parsed.subtitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Kapat"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <DetailRow icon={<Server size={14} />} label="Asset" value={leak.asset} mono />
              <DetailRow
                icon={<Server size={14} />}
                label="Email"
                value={leak.email_leak || "-"}
                mono
              />
              <DetailRow icon={<Server size={14} />} label="Kaynak (Market)" value={leak.market} />
              <DetailRow icon={<Clock size={14} />} label="Son Görülme" value={leak.last_seen} />
              <DetailRow
                icon={<Clock size={14} />}
                label="Keşif Tarihi"
                value={leak.discovery_date}
              />

              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Certainty
                  </div>
                  <div className="mt-1">
                    <Badge value={leak.certainty} variant="certainty" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Priority
                  </div>
                  <div className="mt-1">
                    <Badge value={leak.priority} variant="priority" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Status
                  </div>
                  <div className="mt-1">
                    <Badge value={leak.status} variant="status" />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Leaked Password
                </div>
                <div className="mt-1">
                  <PasswordCell value={leak.leaked_password} />
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Ham Kaynak Kimliği (raw_source)
                </div>
                <code className="mt-1 block break-all rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                  {leak.raw_source || "-"}
                </code>
              </div>
            </div>

            <div className="border-t border-slate-800 px-5 py-4">
              <a
                href={buildInvestigationLink(leak)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
              >
                <ExternalLink size={15} />
                Kaynakta İncele (IR)
              </a>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function DetailRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div className="flex items-center gap-1.5 text-slate-500">
        {icon}
        {label}
      </div>
      <div className={`text-right text-slate-200 ${mono ? "font-mono" : ""}`}>
        {value || "-"}
      </div>
    </div>
  );
}

/**
 * Kaynağa göre (LeakIX / AlienVault OTX / XposedOrNot) teknik ekibin ham
 * kaydı doğrudan inceleyebileceği bir bağlantı üretir. `raw_source` alanı
 * kaynağa göre farklı bir kimlik (LeakIX event id, OTX pulse id, vb.)
 * taşıdığı için burada en azından ilgili platformun arama sayfasına
 * yönlendiriyoruz; backend'iniz raw_source için tam bir URL döndürüyorsa
 * bu fonksiyonu doğrudan `leak.raw_source` döndürecek şekilde
 * sadeleştirebilirsiniz.
 */
function buildInvestigationLink(leak: Leak): string {
  const query = encodeURIComponent(leak.raw_source || leak.asset);
  switch (leak.market) {
    case "LeakIX":
      return `https://leakix.net/search?scope=service&q=${query}`;
    case "AlienVault OTX":
      return `https://otx.alienvault.com/pulse/${leak.raw_source ?? ""}`;
    default:
      return `https://www.google.com/search?q=${query}`;
  }
}
