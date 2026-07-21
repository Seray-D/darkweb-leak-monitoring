/**
 * SOC / CISO seviyesinde raporlama yardımcı fonksiyonları.
 *
 * - exportToPDF: Koyu temalı, yönetici özeti + risk istatistikleri + teknik
 *   detay tablosu içeren bir "SOC Threat Intelligence Report" üretir.
 * - exportToCSV: Excel / SIEM entegrasyonlarına uygun, UTF-8 BOM'lu, tüm
 *   teknik alanları (raw_source, discovery_date, leaked_password dahil)
 *   içeren bir CSV dosyası üretir.
 *
 * Her iki fonksiyon da, ekranda o an FİLTRELENMİŞ olan sonuç listesini
 * (filteredLeaks) parametre olarak alır — kullanıcı neyi görüyorsa onu
 * dışa aktarır.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Leak } from "@/lib/types";

// ---------------------------------------------------------------------------
// Ortak renk paleti (SOC dark tema ile birebir: Dark Slate / Cyan / Red)
// ---------------------------------------------------------------------------
const COLORS = {
  bgDark: [13, 17, 25] as [number, number, number], // #0d1119
  panelDark: [16, 21, 32] as [number, number, number], // #101520
  border: [30, 41, 59] as [number, number, number], // slate-800
  cyan: [34, 211, 238] as [number, number, number], // cyan-400
  textLight: [226, 232, 240] as [number, number, number], // slate-200
  textMuted: [100, 116, 139] as [number, number, number], // slate-500
  critical: [239, 68, 68] as [number, number, number], // red-500
  high: [249, 115, 22] as [number, number, number], // orange-500
  medium: [234, 179, 8] as [number, number, number], // yellow-500
  info: [100, 116, 139] as [number, number, number], // slate-500
};

function priorityColor(priority: string): [number, number, number] {
  switch (priority) {
    case "Critical":
      return COLORS.critical;
    case "High":
      return COLORS.high;
    case "Medium":
      return COLORS.medium;
    default:
      return COLORS.info;
  }
}

/**
 * `leaked_password` alanının ham değerini PDF'e basmak yerine, raporun
 * dışarı sızması ihtimaline karşı yalnızca DURUM bilgisini (Maskeli / Açık /
 * N/A) gösteriyoruz. Ham parola değeri yalnızca CSV çıktısında (SIEM/IR
 * ekibi için) yer alır.
 */
function passwordStatusLabel(leakedPassword: string): string {
  if (!leakedPassword || leakedPassword === "N/A") return "N/A";
  if (leakedPassword.includes("*")) return "Maskeli";
  return "Açık (Plaintext)";
}

function formatGeneratedAt(): string {
  const now = new Date();
  return now.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// PDF EXPORT
// ---------------------------------------------------------------------------
export function exportToPDF(leaks: Leak[], fileName = "soc-threat-intelligence-report.pdf") {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const riskCounts = {
    Critical: leaks.filter((l) => l.priority === "Critical").length,
    High: leaks.filter((l) => l.priority === "High").length,
    Medium: leaks.filter((l) => l.priority === "Medium").length,
    Info: leaks.filter((l) => !["Critical", "High", "Medium"].includes(l.priority)).length,
  };

  // --- Header bandı (koyu / dark konsept) ---
  const headerHeight = 64;
  doc.setFillColor(...COLORS.bgDark);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  doc.setTextColor(...COLORS.cyan);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SOC THREAT INTELLIGENCE REPORT", 32, 28);

  doc.setTextColor(...COLORS.textMuted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Dark Web & Leak Monitoring — Gizli / SOC Dahili Kullanım", 32, 42);

  doc.setTextColor(...COLORS.textLight);
  doc.setFontSize(9);
  doc.text(`Oluşturulma Tarihi: ${formatGeneratedAt()}`, pageWidth - 32, 24, { align: "right" });
  doc.text(`Toplam Sızıntı Kaydı: ${leaks.length}`, pageWidth - 32, 38, { align: "right" });

  // --- Risk özet paneli ---
  const summaryTop = headerHeight + 16;
  const summaryHeight = 46;
  const boxGap = 10;
  const boxWidth = (pageWidth - 64 - boxGap * 3) / 4;

  const summaryItems: Array<{ label: string; value: number; color: [number, number, number] }> = [
    { label: "CRITICAL", value: riskCounts.Critical, color: COLORS.critical },
    { label: "HIGH", value: riskCounts.High, color: COLORS.high },
    { label: "MEDIUM", value: riskCounts.Medium, color: COLORS.medium },
    { label: "INFO / DİĞER", value: riskCounts.Info, color: COLORS.info },
  ];

  summaryItems.forEach((item, index) => {
    const x = 32 + index * (boxWidth + boxGap);

    // Panel arka planı
    doc.setFillColor(...COLORS.panelDark);
    doc.roundedRect(x, summaryTop, boxWidth, summaryHeight, 3, 3, "F");

    // Sol renkli vurgu şeridi (öncelik rengi)
    doc.setFillColor(...item.color);
    doc.rect(x, summaryTop, 4, summaryHeight, "F");

    doc.setTextColor(...COLORS.textMuted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(item.label, x + 14, summaryTop + 16);

    doc.setTextColor(...COLORS.textLight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(String(item.value), x + 14, summaryTop + 36);
  });

  // --- Teknik detay tablosu ---
  const tableStartY = summaryTop + summaryHeight + 20;

  const tableRows = leaks.map((leak) => [
    leak.asset,
    leak.email_leak || "-",
    passwordStatusLabel(leak.leaked_password),
    leak.leak_type,
    leak.market,
    leak.last_seen,
    leak.certainty,
    leak.priority,
    leak.status,
  ]);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 32, right: 32 },
    head: [
      [
        "Asset",
        "Email Leak",
        "Password Status",
        "Leak Type",
        "Market/Source",
        "Last Seen",
        "Certainty",
        "Priority",
        "Status",
      ],
    ],
    body: tableRows,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 5,
      lineColor: COLORS.border,
      lineWidth: 0.5,
      textColor: COLORS.textLight,
      fillColor: COLORS.bgDark,
    },
    headStyles: {
      fillColor: COLORS.panelDark,
      textColor: COLORS.cyan,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: COLORS.panelDark,
    },
    columnStyles: {
      3: { cellWidth: 150 }, // Leak Type (iki parçalı, uzun metin olabilir)
    },
    didParseCell: (data) => {
      // Priority sütununu (index 7) risk rengine göre boyayıp kalınlaştır.
      if (data.section === "body" && data.column.index === 7) {
        const priority = String(data.cell.raw);
        data.cell.styles.textColor = priorityColor(priority);
        data.cell.styles.fontStyle = "bold";
      }
      // Password Status sütununu (index 2) "Açık (Plaintext)" ise kırmızıyla
      // vurgula — SOC ekibinin gözden kaçırmaması için.
      if (data.section === "body" && data.column.index === 2) {
        if (String(data.cell.raw).startsWith("Açık")) {
          data.cell.styles.textColor = COLORS.critical;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const currentPage = doc.getCurrentPageInfo().pageNumber;
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setDrawColor(...COLORS.border);
      doc.line(32, pageHeight - 28, pageWidth - 32, pageHeight - 28);

      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textMuted);
      doc.setFont("helvetica", "normal");
      doc.text("CONFIDENTIAL — SOC Internal Use Only", 32, pageHeight - 16);
      doc.text(`Sayfa ${currentPage} / ${pageCount}`, pageWidth - 32, pageHeight - 16, {
        align: "right",
      });
    },
  });

  doc.save(fileName);
}

// ---------------------------------------------------------------------------
// CSV EXPORT
// ---------------------------------------------------------------------------
const CSV_COLUMNS: Array<{ key: keyof Leak; header: string }> = [
  { key: "id", header: "ID" },
  { key: "asset", header: "Asset" },
  { key: "email_leak", header: "Email Leak" },
  { key: "leaked_password", header: "Leaked Password" },
  { key: "leak_type", header: "Leak Type" },
  { key: "market", header: "Market/Source" },
  { key: "last_seen", header: "Last Seen" },
  { key: "certainty", header: "Certainty" },
  { key: "status", header: "Status" },
  { key: "priority", header: "Priority" },
  { key: "discovery_date", header: "Discovery Date" },
  { key: "raw_source", header: "Raw Source" },
];

/** CSV hücresi için gerekli kaçışları (virgül, tırnak, satır sonu) uygular. */
function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(leaks: Leak[], fileName = "leak-report.csv") {
  const headerRow = CSV_COLUMNS.map((col) => escapeCsvCell(col.header)).join(",");
  const dataRows = leaks.map((leak) =>
    CSV_COLUMNS.map((col) => escapeCsvCell(leak[col.key])).join(","),
  );

  const csvContent = [headerRow, ...dataRows].join("\r\n");

  // Excel'in UTF-8 Türkçe karakterleri (ş, ğ, ç, ı, ö, ü) doğru okuması için
  // BOM (Byte Order Mark) ekleniyor.
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
