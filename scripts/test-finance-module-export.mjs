import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import XLSX from "xlsx-js-style";

const route = await readFile(new URL("../app/api/finance/modules/export/route.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/dashboard/keuangan-terpusat/unit/[module]/[[...section]]/page.tsx", import.meta.url), "utf8");

assert.match(route, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
assert.match(route, /\.xlsx/);
assert.doesNotMatch(route, /text\/csv|\.csv/);
assert.match(page, />Ekspor Excel</);

const sheet = XLSX.utils.aoa_to_sheet([
  ["Nominal", "Tanggal"],
  [125000, new Date("2026-09-18T00:00:00Z")],
], { cellDates: true });
sheet.A2.z = '"Rp" #,##0';
sheet.B2.z = "dd/mm/yyyy";
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, "Data");
const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true });
const reopened = XLSX.read(bytes, { type: "array", cellDates: true, cellStyles: true });

assert.ok(bytes.byteLength > 1000);
assert.equal(reopened.Sheets.Data.A2.v, 125000);
assert.ok(reopened.Sheets.Data.B2.v instanceof Date);
assert.equal(reopened.Sheets.Data.A2.z, '"Rp" #,##0');

console.log("PASS ekspor unit memakai XLSX dan mempertahankan tipe angka, tanggal, serta format Rupiah");
