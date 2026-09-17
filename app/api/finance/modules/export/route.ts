import { loadModuleWorkspace } from "@/lib/finance/module-workspace";
import { isPaymentModuleCode, PAYMENT_MODULES, requireModuleAccess } from "@/lib/finance/modules";
import XLSX from "xlsx-js-style";

const ALLOWED_SECTIONS = ["tagihan", "pembayaran", "penyaluran", "laporan"];
const MONEY_COLUMNS = new Set(["amount", "paid", "sisa", "gross", "fee", "net", "nominal"]);
const DATE_COLUMNS = new Set(["waktu", "jatuh_tempo"]);
const SECTION_LABELS: Record<string, string> = {
  tagihan: "Tagihan",
  pembayaran: "Pembayaran",
  penyaluran: "Penyaluran",
  laporan: "Laporan Aktivitas",
};

function safeText(value: unknown) {
  const text = String(value ?? "");
  return /^[=+@-]/.test(text) ? `'${text}` : text;
}

function excelValue(column: string, value: string | number | null) {
  if (value === null) return "";
  if (MONEY_COLUMNS.has(column)) return Number(value) || 0;
  if (DATE_COLUMNS.has(column) && typeof value === "string") {
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const parsed = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return typeof value === "number" ? value : safeText(value);
}

function humanize(column: string) {
  return column.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const moduleCode = params.get("module") || "";
  const section = params.get("section") || "";
  if (!isPaymentModuleCode(moduleCode) || !ALLOWED_SECTIONS.includes(section)) {
    return new Response("Parameter ekspor tidak valid.", { status: 400 });
  }
  let access;
  try {
    access = await requireModuleAccess(moduleCode, "EXPORT");
  } catch {
    return new Response("Tidak berwenang.", { status: 403 });
  }
  const data = await loadModuleWorkspace({
    moduleCode,
    section,
    requestedPeriod: params.get("period") || undefined,
    annualFeeType: params.get("annualFeeType") || undefined,
    requestedStatus: params.get("status") || undefined,
    userId: access.session.id,
  });
  const exportRows: Array<Record<string, string | number | null>> = data.rows.length
    ? data.rows
    : [{ keterangan: "Tidak ada data untuk filter yang dipilih." }];
  const columns = Object.keys(exportRows[0]);
  const definition = PAYMENT_MODULES.find((item) => item.code === moduleCode);
  const annualFeeType = params.get("annualFeeType") || "Semua jenis";
  const requestedStatus = params.get("status") || "Semua status";
  const headerRow = 7;
  const values: Array<Array<string | number | Date>> = [
    [`Unit ${definition?.label || moduleCode}`],
    [`Data ${SECTION_LABELS[section] || section}`],
    ["Periode", data.period],
    ["Jenis biaya", moduleCode === "BIAYA_TAHUNAN" ? annualFeeType : "Tidak berlaku"],
    ["Status", requestedStatus],
    ["Diekspor pada", new Date()],
    columns.map(humanize),
    ...exportRows.map((row) => columns.map((column) => excelValue(column, row[column]))),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(values, { cellDates: true });
  const lastColumn = columns.length - 1;
  const titleLastColumn = Math.max(lastColumn, 1);
  const lastRow = headerRow + exportRows.length;
  if (titleLastColumn > 0) sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: titleLastColumn } }];
  sheet["!autofilter"] = columns.length ? { ref: `A${headerRow}:${XLSX.utils.encode_col(lastColumn)}${lastRow}` } : undefined;
  sheet["!cols"] = Array.from({ length: titleLastColumn + 1 }, (_, index) => ({
    wch: index < columns.length ? Math.min(42, Math.max(14, humanize(columns[index]).length + 4)) : 24,
  }));
  sheet["!rows"] = [{ hpt: 24 }, { hpt: 20 }, { hpt: 18 }, { hpt: 18 }, { hpt: 18 }, { hpt: 18 }, { hpt: 24 }];

  const titleStyle = {
    font: { name: "Arial", sz: 15, bold: true, color: { rgb: "0F172A" } },
    alignment: { vertical: "center", horizontal: "left" },
  };
  const subtitleStyle = { font: { name: "Arial", sz: 11, bold: true, color: { rgb: "475569" } } };
  const metaLabelStyle = { font: { name: "Arial", sz: 10, bold: true, color: { rgb: "334155" } } };
  const metaValueStyle = { font: { name: "Arial", sz: 10, color: { rgb: "334155" } } };
  const headerStyle = {
    font: { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "065F46" } },
    alignment: { vertical: "center", horizontal: "center" },
    border: { bottom: { style: "thin", color: { rgb: "D1FAE5" } } },
  };
  const bodyStyle = {
    font: { name: "Arial", sz: 10, color: { rgb: "0F172A" } },
    alignment: { vertical: "center" },
    border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } },
  };
  const moneyStyle = { ...bodyStyle, numFmt: '"Rp" #,##0' };
  const dateStyle = { ...bodyStyle, numFmt: "dd/mm/yyyy hh:mm" };

  if (sheet.A1) sheet.A1.s = titleStyle;
  if (sheet.A2) sheet.A2.s = subtitleStyle;
  for (let row = 3; row <= 6; row += 1) {
    const label = sheet[`A${row}`];
    const value = sheet[`B${row}`];
    if (label) label.s = metaLabelStyle;
    if (value) value.s = metaValueStyle;
  }
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const header = sheet[XLSX.utils.encode_cell({ r: headerRow - 1, c: columnIndex })];
    if (header) header.s = headerStyle;
    for (let rowIndex = headerRow; rowIndex < lastRow; rowIndex += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      if (!cell) continue;
      cell.s = MONEY_COLUMNS.has(columns[columnIndex]) ? moneyStyle : DATE_COLUMNS.has(columns[columnIndex]) ? dateStyle : bodyStyle;
    }
  }
  sheet["!ref"] = `A1:${XLSX.utils.encode_col(titleLastColumn)}${lastRow}`;

  const workbook = XLSX.utils.book_new();
  workbook.Props = { Title: `Unit ${definition?.label || moduleCode} - ${SECTION_LABELS[section]}`, Author: "Eskahade" };
  XLSX.utils.book_append_sheet(workbook, sheet, (definition?.label || moduleCode).slice(0, 31));
  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true });
  const filename = `${moduleCode.toLowerCase()}-${section}-${data.period.replace(/[^a-zA-Z0-9-]/g, "-")}.xlsx`;

  return new Response(output, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
