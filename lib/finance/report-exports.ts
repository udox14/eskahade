// lib/finance/report-exports.ts
// Modul Utilitas Ekspor Spreadsheet Excel Profesional (Fase 10: PRD Bab 34 & UI/UX Guidelines #45)
// Menggunakan 'xlsx-js-style' untuk menghasilkan file .xlsx yang:
// 1. Memiliki header dan kop dokumen jelas.
// 2. Kolom nominal Rupiah bertipe NUMERIC (t: 'n') dengan format mata uang agar dapat dijumlahkan (SUM) di Excel.
// 3. Kolom tanggal terformat rapi (Asia/Jakarta).
// 4. Kolom auto-fit berdasarkan panjang isi teks.
// 5. Baris total agregat dengan border ganda bawah.

'use client'

import type {
  ReceiptItemRow,
  DistributionItemRow,
  ArrearItemRow,
  ExemptionItemRow,
  StudentDetailReportResponse,
  WalletSummaryRow,
  WalletMutationRow,
  CashSessionItemRow,
  SettlementItemRow,
  ReconciliationReportRow,
} from '@/lib/finance/reports'

type CellStyle = Record<string, unknown>

const CURRENCY_FORMAT = '_("Rp"* #,##0_);_("Rp"* \\(#,##0\\);_("Rp"* "-"_);_(@_)'

const thinBorder = {
  top: { style: 'thin', color: { rgb: 'CCCCCC' } },
  bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
  left: { style: 'thin', color: { rgb: 'CCCCCC' } },
  right: { style: 'thin', color: { rgb: 'CCCCCC' } },
}

const totalBorder = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'double', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: 'CCCCCC' } },
  right: { style: 'thin', color: { rgb: 'CCCCCC' } },
}

function columnName(index: number): string {
  let result = ''
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result
  }
  return result
}

function cellAddress(row: number, column: number): string {
  return `${columnName(column)}${row}`
}

/**
 * Batas dimensi (bounding box) tiap worksheet yang dibangun manual.
 * SheetJS menentukan sel yang ditulis ke file HANYA dari `ws['!ref']`; tanpa itu
 * seluruh sel di luar range diabaikan sehingga file Excel terunduh kosong.
 */
const sheetBounds = new WeakMap<object, { minRow: number; minCol: number; maxRow: number; maxCol: number }>()

function updateSheetRef(ws: Record<string, unknown>, row: number, col: number) {
  let bounds = sheetBounds.get(ws)
  if (!bounds) {
    bounds = { minRow: row, minCol: col, maxRow: row, maxCol: col }
    sheetBounds.set(ws, bounds)
  } else {
    bounds.minRow = Math.min(bounds.minRow, row)
    bounds.minCol = Math.min(bounds.minCol, col)
    bounds.maxRow = Math.max(bounds.maxRow, row)
    bounds.maxCol = Math.max(bounds.maxCol, col)
  }

  ws['!ref'] = `${cellAddress(bounds.minRow, bounds.minCol)}:${cellAddress(bounds.maxRow, bounds.maxCol)}`
}

function setSheetCell(
  ws: Record<string, unknown>,
  row: number,
  col: number,
  val: string | number,
  style: CellStyle
) {
  const addr = cellAddress(row, col)
  ws[addr] = {
    t: typeof val === 'number' ? 'n' : 's',
    v: val,
    ...(typeof val === 'number' && style.numFmt ? { z: style.numFmt } : {}),
    s: style,
  }
  updateSheetRef(ws, row, col)
}

function downloadExcelBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getFormattedTimestamp(): string {
  const now = new Date()
  return now.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

// ── 1. EXPORT PENERIMAAN ──────────────────────────────────────────────────────
export async function exportReceiptsExcel(
  items: ReceiptItemRow[],
  filterInfo = 'Semua Periode'
) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const ws = XLSX.utils.aoa_to_sheet([])

  const setCell = (row: number, col: number, val: string | number, style: CellStyle) =>
    setSheetCell(ws as Record<string, unknown>, row, col, val, style)

  // Styles
  const titleStyle: CellStyle = { font: { sz: 14, bold: true, color: { rgb: '0F172A' } } }
  const metaStyle: CellStyle = { font: { sz: 10, italic: true, color: { rgb: '475569' } } }
  const thStyle: CellStyle = {
    font: { sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const tdText: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { vertical: 'center' } }
  const tdCenter: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'center' } }
  const tdNum: CellStyle = {
    font: { sz: 10 },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalStyle: CellStyle = {
    font: { sz: 10, bold: true },
    border: totalBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  // Headers
  setCell(1, 0, 'LAPORAN PENERIMAAN KAS & PEMBAYARAN', titleStyle)
  setCell(2, 0, 'Pondok Pesantren Eskahade — Sistem Keuangan Baru', metaStyle)
  setCell(3, 0, `Filter: ${filterInfo} | Diunduh: ${getFormattedTimestamp()} WIB`, metaStyle)

  const headers = [
    'No',
    'No. Pembayaran',
    'Tanggal Bayar',
    'NIS',
    'Nama Santri',
    'Asrama',
    'Kelas',
    'Saluran',
    'Metode',
    'Alokasi Pos Tagihan',
    'Nominal Bruto',
    'Biaya Gateway',
    'Nominal Bersih',
    'Status',
    'Petugas / Kasir',
  ]

  headers.forEach((h, idx) => setCell(5, idx, h, thStyle))

  let rowIdx = 6
  let totalGross = 0
  let totalFee = 0
  let totalNet = 0

  items.forEach((item, index) => {
    setCell(rowIdx, 0, index + 1, tdCenter)
    setCell(rowIdx, 1, item.paymentNumber, tdCenter)
    setCell(rowIdx, 2, item.paidAt ? item.paidAt.slice(0, 16) : '-', tdCenter)
    setCell(rowIdx, 3, item.santriNis, tdCenter)
    setCell(rowIdx, 4, item.santriName, tdText)
    setCell(rowIdx, 5, item.santriAsrama || '-', tdCenter)
    setCell(rowIdx, 6, item.santriKelas || '-', tdCenter)
    setCell(rowIdx, 7, item.channel, tdCenter)
    setCell(rowIdx, 8, item.method, tdCenter)
    setCell(rowIdx, 9, item.allocationsSummary, tdText)
    setCell(rowIdx, 10, item.grossAmount, tdNum)
    setCell(rowIdx, 11, item.gatewayFee, tdNum)
    setCell(rowIdx, 12, item.netAmount, tdNum)
    setCell(rowIdx, 13, item.status, tdCenter)
    setCell(rowIdx, 14, item.cashierName || '-', tdCenter)

    totalGross += item.grossAmount
    totalFee += item.gatewayFee
    totalNet += item.netAmount
    rowIdx++
  })

  // Total Row
  setCell(rowIdx, 0, 'TOTAL', { ...totalStyle, alignment: { horizontal: 'center' } })
  for (let c = 1; c <= 9; c++) setCell(rowIdx, c, '', totalStyle)
  setCell(rowIdx, 10, totalGross, totalStyle)
  setCell(rowIdx, 11, totalFee, totalStyle)
  setCell(rowIdx, 12, totalNet, totalStyle)
  setCell(rowIdx, 13, '', totalStyle)
  setCell(rowIdx, 14, '', totalStyle)

  ws['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 35 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Penerimaan')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadExcelBlob(new Blob([wbout], { type: 'application/octet-stream' }), `Laporan-Penerimaan-${Date.now()}.xlsx`)
}

// ── 2. EXPORT PENYALURAN ──────────────────────────────────────────────────────
export async function exportDistributionsExcel(
  items: DistributionItemRow[],
  filterInfo = 'Semua Penyaluran'
) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const ws = XLSX.utils.aoa_to_sheet([])

  const setCell = (row: number, col: number, val: string | number, style: CellStyle) =>
    setSheetCell(ws as Record<string, unknown>, row, col, val, style)

  const titleStyle: CellStyle = { font: { sz: 14, bold: true, color: { rgb: '0F172A' } } }
  const metaStyle: CellStyle = { font: { sz: 10, italic: true, color: { rgb: '475569' } } }
  const thStyle: CellStyle = {
    font: { sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const tdText: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { vertical: 'center' } }
  const tdCenter: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'center' } }
  const tdNum: CellStyle = {
    font: { sz: 10 },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalStyle: CellStyle = {
    font: { sz: 10, bold: true },
    border: totalBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  setCell(1, 0, 'LAPORAN PENYALURAN DANA', titleStyle)
  setCell(2, 0, 'Pondok Pesantren Eskahade — Bendahara, Katering, dan Laundry', metaStyle)
  setCell(3, 0, `Filter: ${filterInfo} | Diunduh: ${getFormattedTimestamp()} WIB`, metaStyle)

  const headers = [
    'No',
    'No. Penyaluran',
    'Tanggal Salur',
    'Penerima',
    'Nama Rekanan / Kas',
    'Metode',
    'Bank Tujuan',
    'No. Rekening',
    'Atas Nama',
    'Rincian Item',
    'Nominal Disalurkan',
    'No. Ref Transfer',
    'Petugas',
    'Catatan',
  ]

  headers.forEach((h, idx) => setCell(5, idx, h, thStyle))

  let rowIdx = 6
  let totalDisbursed = 0

  items.forEach((item, index) => {
    setCell(rowIdx, 0, index + 1, tdCenter)
    setCell(rowIdx, 1, item.distributionNumber, tdCenter)
    setCell(rowIdx, 2, item.transferredAt ? item.transferredAt.slice(0, 16) : '-', tdCenter)
    setCell(rowIdx, 3, item.recipientType, tdCenter)
    setCell(rowIdx, 4, item.recipientName, tdText)
    setCell(rowIdx, 5, item.method, tdCenter)
    setCell(rowIdx, 6, item.destinationBank || '-', tdCenter)
    setCell(rowIdx, 7, item.destinationAccount || '-', tdCenter)
    setCell(rowIdx, 8, item.accountHolderName || '-', tdText)
    setCell(rowIdx, 9, item.itemsSummary, tdText)
    setCell(rowIdx, 10, item.amount, tdNum)
    setCell(rowIdx, 11, item.transferReference || '-', tdCenter)
    setCell(rowIdx, 12, item.operatorName || '-', tdCenter)
    setCell(rowIdx, 13, item.notes || '-', tdText)

    totalDisbursed += item.amount
    rowIdx++
  })

  setCell(rowIdx, 0, 'TOTAL', { ...totalStyle, alignment: { horizontal: 'center' } })
  for (let c = 1; c <= 9; c++) setCell(rowIdx, c, '', totalStyle)
  setCell(rowIdx, 10, totalDisbursed, totalStyle)
  for (let c = 11; c <= 13; c++) setCell(rowIdx, c, '', totalStyle)

  ws['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 25 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 30 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 25 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Penyaluran')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadExcelBlob(new Blob([wbout], { type: 'application/octet-stream' }), `Laporan-Penyaluran-${Date.now()}.xlsx`)
}

// ── 3. EXPORT PENUNGGAK ──────────────────────────────────────────────────────
export async function exportArrearsExcel(
  items: ArrearItemRow[],
  filterInfo = 'Semua Tagihan Tertunggak'
) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const ws = XLSX.utils.aoa_to_sheet([])

  const setCell = (row: number, col: number, val: string | number, style: CellStyle) =>
    setSheetCell(ws as Record<string, unknown>, row, col, val, style)

  const titleStyle: CellStyle = { font: { sz: 14, bold: true, color: { rgb: '0F172A' } } }
  const metaStyle: CellStyle = { font: { sz: 10, italic: true, color: { rgb: '475569' } } }
  const thStyle: CellStyle = {
    font: { sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const tdText: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { vertical: 'center' } }
  const tdCenter: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'center' } }
  const tdNum: CellStyle = {
    font: { sz: 10 },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalStyle: CellStyle = {
    font: { sz: 10, bold: true },
    border: totalBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  setCell(1, 0, 'LAPORAN SANTRI MENUNGGAK & PIUTANG BIAYA', titleStyle)
  setCell(2, 0, 'Pondok Pesantren Eskahade — Monitoring Kewajiban Santri', metaStyle)
  setCell(3, 0, `Filter: ${filterInfo} | Diunduh: ${getFormattedTimestamp()} WIB`, metaStyle)

  const headers = [
    'No',
    'NIS',
    'Nama Santri',
    'Asrama',
    'Kelas',
    'Tahun Ajaran',
    'Periode',
    'Pos Tagihan',
    'Total Tagihan',
    'Potongan Bebas',
    'Telah Terbayar',
    'Sisa Tunggakan',
    'Status',
    'No. WA Ortu',
  ]

  headers.forEach((h, idx) => setCell(5, idx, h, thStyle))

  let rowIdx = 6
  let totalExpected = 0
  let totalExempted = 0
  let totalPaid = 0
  let totalRemaining = 0

  items.forEach((item, index) => {
    setCell(rowIdx, 0, index + 1, tdCenter)
    setCell(rowIdx, 1, item.santriNis, tdCenter)
    setCell(rowIdx, 2, item.santriName, tdText)
    setCell(rowIdx, 3, item.santriAsrama || '-', tdCenter)
    setCell(rowIdx, 4, item.santriKelas || '-', tdCenter)
    setCell(rowIdx, 5, item.academicYearName || '-', tdCenter)
    setCell(rowIdx, 6, item.period, tdCenter)
    setCell(rowIdx, 7, item.itemLabel, tdText)
    setCell(rowIdx, 8, item.amountExpected, tdNum)
    setCell(rowIdx, 9, item.amountExempted, tdNum)
    setCell(rowIdx, 10, item.amountPaid, tdNum)
    setCell(rowIdx, 11, item.remaining, tdNum)
    setCell(rowIdx, 12, item.status, tdCenter)
    setCell(rowIdx, 13, item.noWaOrtu || '-', tdCenter)

    totalExpected += item.amountExpected
    totalExempted += item.amountExempted
    totalPaid += item.amountPaid
    totalRemaining += item.remaining
    rowIdx++
  })

  setCell(rowIdx, 0, 'TOTAL', { ...totalStyle, alignment: { horizontal: 'center' } })
  for (let c = 1; c <= 7; c++) setCell(rowIdx, c, '', totalStyle)
  setCell(rowIdx, 8, totalExpected, totalStyle)
  setCell(rowIdx, 9, totalExempted, totalStyle)
  setCell(rowIdx, 10, totalPaid, totalStyle)
  setCell(rowIdx, 11, totalRemaining, totalStyle)
  setCell(rowIdx, 12, '', totalStyle)
  setCell(rowIdx, 13, '', totalStyle)

  ws['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 25 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Penunggak')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadExcelBlob(new Blob([wbout], { type: 'application/octet-stream' }), `Laporan-Penunggak-${Date.now()}.xlsx`)
}

// ── 4. EXPORT SANTRI DIBEBASKAN ───────────────────────────────────────────────
export async function exportExemptionsExcel(
  items: ExemptionItemRow[],
  filterInfo = 'Semua Pembebasan'
) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const ws = XLSX.utils.aoa_to_sheet([])

  const setCell = (row: number, col: number, val: string | number, style: CellStyle) =>
    setSheetCell(ws as Record<string, unknown>, row, col, val, style)

  const titleStyle: CellStyle = { font: { sz: 14, bold: true, color: { rgb: '0F172A' } } }
  const metaStyle: CellStyle = { font: { sz: 10, italic: true, color: { rgb: '475569' } } }
  const thStyle: CellStyle = {
    font: { sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const tdText: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { vertical: 'center' } }
  const tdCenter: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'center' } }
  const tdNum: CellStyle = {
    font: { sz: 10 },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalStyle: CellStyle = {
    font: { sz: 10, bold: true },
    border: totalBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  setCell(1, 0, 'LAPORAN PEMBEBASAN BIAYA & BEASISWA SANTRI', titleStyle)
  setCell(2, 0, 'Pondok Pesantren Eskahade — Audit Diskon dan Keringanan', metaStyle)
  setCell(3, 0, `Filter: ${filterInfo} | Diunduh: ${getFormattedTimestamp()} WIB`, metaStyle)

  const headers = [
    'No',
    'NIS',
    'Nama Santri',
    'Asrama',
    'Kelas',
    'Pos Biaya Bebas',
    'Tahun Ajaran',
    'Periode Mulai',
    'Periode Akhir',
    'Alasan',
    'Nominal Terbebaskan',
    'Status',
    'Diberikan Oleh',
    'Tanggal Dibuat',
  ]

  headers.forEach((h, idx) => setCell(5, idx, h, thStyle))

  let rowIdx = 6
  let totalExempted = 0

  items.forEach((item, index) => {
    setCell(rowIdx, 0, index + 1, tdCenter)
    setCell(rowIdx, 1, item.santriNis, tdCenter)
    setCell(rowIdx, 2, item.santriName, tdText)
    setCell(rowIdx, 3, item.santriAsrama || '-', tdCenter)
    setCell(rowIdx, 4, item.santriKelas || '-', tdCenter)
    setCell(rowIdx, 5, item.itemLabel, tdText)
    setCell(rowIdx, 6, item.academicYearName || '-', tdCenter)
    setCell(rowIdx, 7, item.periodStart || '-', tdCenter)
    setCell(rowIdx, 8, item.periodEnd || '-', tdCenter)
    setCell(rowIdx, 9, item.reason, tdText)
    setCell(rowIdx, 10, item.totalExemptedAmount, tdNum)
    setCell(rowIdx, 11, item.status, tdCenter)
    setCell(rowIdx, 12, item.createdByName || '-', tdCenter)
    setCell(rowIdx, 13, item.createdAt ? item.createdAt.slice(0, 10) : '-', tdCenter)

    totalExempted += item.totalExemptedAmount
    rowIdx++
  })

  setCell(rowIdx, 0, 'TOTAL', { ...totalStyle, alignment: { horizontal: 'center' } })
  for (let c = 1; c <= 9; c++) setCell(rowIdx, c, '', totalStyle)
  setCell(rowIdx, 10, totalExempted, totalStyle)
  setCell(rowIdx, 11, '', totalStyle)
  setCell(rowIdx, 12, '', totalStyle)
  setCell(rowIdx, 13, '', totalStyle)

  ws['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 30 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pembebasan')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadExcelBlob(new Blob([wbout], { type: 'application/octet-stream' }), `Laporan-Pembebasan-${Date.now()}.xlsx`)
}

// ── 5. EXPORT DETAIL PER SANTRI ──────────────────────────────────────────────
export async function exportStudentDetailExcel(report: StudentDetailReportResponse) {
  if (!report.student) return

  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const wb = XLSX.utils.book_new()

  const setCell = (ws: Record<string, unknown>, row: number, col: number, val: string | number, style: CellStyle) =>
    setSheetCell(ws, row, col, val, style)

  const titleStyle: CellStyle = { font: { sz: 14, bold: true, color: { rgb: '0F172A' } } }
  const metaStyle: CellStyle = { font: { sz: 10, italic: true, color: { rgb: '475569' } } }
  const labelStyle: CellStyle = { font: { sz: 10, bold: true, color: { rgb: '1E293B' } } }
  const thStyle: CellStyle = {
    font: { sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const tdText: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { vertical: 'center' } }
  const tdCenter: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'center' } }
  const tdNum: CellStyle = {
    font: { sz: 10 },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalStyle: CellStyle = {
    font: { sz: 10, bold: true },
    border: totalBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  // SHEET 1: REKAP KEWAJIBAN & BIODATA
  const ws1 = XLSX.utils.aoa_to_sheet([])
  setCell(ws1 as Record<string, unknown>, 1, 0, `LEMBAR KEUANGAN SANTRI: ${report.student.nama}`, titleStyle)
  setCell(ws1 as Record<string, unknown>, 2, 0, `NIS: ${report.student.nis} | Asrama: ${report.student.asrama || '-'} (${report.student.kamar || '-'}) | Kelas: ${report.student.kelas || '-'}`, metaStyle)
  setCell(ws1 as Record<string, unknown>, 3, 0, `No. Fixed BRIVA: ${report.student.fixedVa || '-'} | No. WA Ortu: ${report.student.noWaOrtu || '-'}`, metaStyle)
  setCell(ws1 as Record<string, unknown>, 4, 0, `Saldo Titipan Uang Jajan: Rp${report.student.walletBalance.toLocaleString('id-ID')}`, labelStyle)

  const obHeaders = ['No', 'Periode', 'Pos Tagihan', 'Total Tagihan', 'Potongan Bebas', 'Telah Terbayar', 'Sisa Tagihan', 'Status']
  obHeaders.forEach((h, idx) => setCell(ws1 as Record<string, unknown>, 6, idx, h, thStyle))

  let rIdx1 = 7
  report.obligations.forEach((ob, idx) => {
    setCell(ws1 as Record<string, unknown>, rIdx1, 0, idx + 1, tdCenter)
    setCell(ws1 as Record<string, unknown>, rIdx1, 1, ob.period, tdCenter)
    setCell(ws1 as Record<string, unknown>, rIdx1, 2, ob.itemLabel, tdText)
    setCell(ws1 as Record<string, unknown>, rIdx1, 3, ob.amountExpected, tdNum)
    setCell(ws1 as Record<string, unknown>, rIdx1, 4, ob.amountExempted, tdNum)
    setCell(ws1 as Record<string, unknown>, rIdx1, 5, ob.amountPaid, tdNum)
    setCell(ws1 as Record<string, unknown>, rIdx1, 6, ob.remaining, tdNum)
    setCell(ws1 as Record<string, unknown>, rIdx1, 7, ob.status, tdCenter)
    rIdx1++
  })

  setCell(ws1 as Record<string, unknown>, rIdx1, 0, 'TOTAL', { ...totalStyle, alignment: { horizontal: 'center' } })
  setCell(ws1 as Record<string, unknown>, rIdx1, 1, '', totalStyle)
  setCell(ws1 as Record<string, unknown>, rIdx1, 2, '', totalStyle)
  setCell(ws1 as Record<string, unknown>, rIdx1, 3, report.summary.totalExpected, totalStyle)
  setCell(ws1 as Record<string, unknown>, rIdx1, 4, report.summary.totalExempted, totalStyle)
  setCell(ws1 as Record<string, unknown>, rIdx1, 5, report.summary.totalPaid, totalStyle)
  setCell(ws1 as Record<string, unknown>, rIdx1, 6, report.summary.totalRemaining, totalStyle)
  setCell(ws1 as Record<string, unknown>, rIdx1, 7, '', totalStyle)

  ws1['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Kewajiban Tagihan')

  // SHEET 2: RIWAYAT PEMBAYARAN
  const ws2 = XLSX.utils.aoa_to_sheet([])
  setCell(ws2 as Record<string, unknown>, 1, 0, `RIWAYAT PEMBAYARAN: ${report.student.nama}`, titleStyle)
  const payHeaders = ['No', 'No. Bukti', 'Tanggal Bayar', 'Metode', 'Nominal Kotor', 'Nominal Bersih', 'Alokasi Tagihan', 'Status']
  payHeaders.forEach((h, idx) => setCell(ws2 as Record<string, unknown>, 3, idx, h, thStyle))

  let rIdx2 = 4
  report.payments.forEach((p, idx) => {
    setCell(ws2 as Record<string, unknown>, rIdx2, 0, idx + 1, tdCenter)
    setCell(ws2 as Record<string, unknown>, rIdx2, 1, p.paymentNumber, tdCenter)
    setCell(ws2 as Record<string, unknown>, rIdx2, 2, p.paidAt.slice(0, 16), tdCenter)
    setCell(ws2 as Record<string, unknown>, rIdx2, 3, p.method, tdCenter)
    setCell(ws2 as Record<string, unknown>, rIdx2, 4, p.grossAmount, tdNum)
    setCell(ws2 as Record<string, unknown>, rIdx2, 5, p.netAmount, tdNum)
    setCell(ws2 as Record<string, unknown>, rIdx2, 6, p.allocationsSummary, tdText)
    setCell(ws2 as Record<string, unknown>, rIdx2, 7, p.status, tdCenter)
    rIdx2++
  })

  ws2['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 35 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Riwayat Pembayaran')

  // SHEET 3: MUTASI UANG JAJAN
  const ws3 = XLSX.utils.aoa_to_sheet([])
  setCell(ws3 as Record<string, unknown>, 1, 0, `BUKU BESAR MUTASI UANG JAJAN: ${report.student.nama}`, titleStyle)
  const mutHeaders = ['No', 'Tanggal Waktu', 'Jenis Mutasi', 'Arah', 'Nominal', 'Saldo Setelah', 'Operator', 'Catatan']
  mutHeaders.forEach((h, idx) => setCell(ws3 as Record<string, unknown>, 3, idx, h, thStyle))

  let rIdx3 = 4
  report.walletMutations.forEach((m, idx) => {
    setCell(ws3 as Record<string, unknown>, rIdx3, 0, idx + 1, tdCenter)
    setCell(ws3 as Record<string, unknown>, rIdx3, 1, m.createdAt.slice(0, 16), tdCenter)
    setCell(ws3 as Record<string, unknown>, rIdx3, 2, m.movementType, tdCenter)
    setCell(ws3 as Record<string, unknown>, rIdx3, 3, m.direction, tdCenter)
    setCell(ws3 as Record<string, unknown>, rIdx3, 4, m.amount, tdNum)
    setCell(ws3 as Record<string, unknown>, rIdx3, 5, m.balanceAfter, tdNum)
    setCell(ws3 as Record<string, unknown>, rIdx3, 6, m.operatorName || '-', tdCenter)
    setCell(ws3 as Record<string, unknown>, rIdx3, 7, m.notes || '-', tdText)
    rIdx3++
  })

  ws3['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Mutasi Uang Jajan')

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadExcelBlob(new Blob([wbout], { type: 'application/octet-stream' }), `Detail-Keuangan-${report.student.nis}-${Date.now()}.xlsx`)
}

// ── 6. EXPORT UANG JAJAN ─────────────────────────────────────────────────────
export async function exportWalletExcel(
  report: { mode: 'SUMMARY' | 'MUTATION'; summaryItems?: WalletSummaryRow[]; mutationItems?: WalletMutationRow[] },
  filterInfo = 'Semua Santri'
) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const ws = XLSX.utils.aoa_to_sheet([])

  const setCell = (row: number, col: number, val: string | number, style: CellStyle) =>
    setSheetCell(ws as Record<string, unknown>, row, col, val, style)

  const titleStyle: CellStyle = { font: { sz: 14, bold: true, color: { rgb: '0F172A' } } }
  const metaStyle: CellStyle = { font: { sz: 10, italic: true, color: { rgb: '475569' } } }
  const thStyle: CellStyle = {
    font: { sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const tdText: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { vertical: 'center' } }
  const tdCenter: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'center' } }
  const tdNum: CellStyle = {
    font: { sz: 10 },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalStyle: CellStyle = {
    font: { sz: 10, bold: true },
    border: totalBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  if (report.mode === 'SUMMARY') {
    setCell(1, 0, 'LAPORAN REKAP SALDO UANG JAJAN SANTRI', titleStyle)
    setCell(2, 0, 'Pondok Pesantren Eskahade — Titipan Dompet Digital Santri', metaStyle)
    setCell(3, 0, `Filter: ${filterInfo} | Diunduh: ${getFormattedTimestamp()} WIB`, metaStyle)

    const headers = [
      'No',
      'NIS',
      'Nama Santri',
      'Asrama',
      'Kelas',
      'Total Setoran (IN)',
      'Total Penarikan (OUT)',
      'Saldo Saat Ini',
      'Limit Harian Efektif',
      'Kartu QR Aktif',
      'Status Kartu',
    ]
    headers.forEach((h, idx) => setCell(5, idx, h, thStyle))

    let rowIdx = 6
    let sumIn = 0
    let sumOut = 0
    let sumBal = 0

    ;(report.summaryItems || []).forEach((item, idx) => {
      setCell(rowIdx, 0, idx + 1, tdCenter)
      setCell(rowIdx, 1, item.santriNis, tdCenter)
      setCell(rowIdx, 2, item.santriName, tdText)
      setCell(rowIdx, 3, item.santriAsrama || '-', tdCenter)
      setCell(rowIdx, 4, item.santriKelas || '-', tdCenter)
      setCell(rowIdx, 5, item.totalIn, tdNum)
      setCell(rowIdx, 6, item.totalOut, tdNum)
      setCell(rowIdx, 7, item.currentBalance, tdNum)
      setCell(rowIdx, 8, item.effectiveDailyLimit, tdNum)
      setCell(rowIdx, 9, item.activeCardCode || '-', tdCenter)
      setCell(rowIdx, 10, item.activeCardStatus || 'NONE', tdCenter)

      sumIn += item.totalIn
      sumOut += item.totalOut
      sumBal += item.currentBalance
      rowIdx++
    })

    setCell(rowIdx, 0, 'TOTAL', { ...totalStyle, alignment: { horizontal: 'center' } })
    for (let c = 1; c <= 4; c++) setCell(rowIdx, c, '', totalStyle)
    setCell(rowIdx, 5, sumIn, totalStyle)
    setCell(rowIdx, 6, sumOut, totalStyle)
    setCell(rowIdx, 7, sumBal, totalStyle)
    setCell(rowIdx, 8, '', totalStyle)
    setCell(rowIdx, 9, '', totalStyle)
    setCell(rowIdx, 10, '', totalStyle)

    ws['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
    ]
  } else {
    setCell(1, 0, 'BUKU BESAR MUTASI UANG JAJAN (JURNAL UMUM)', titleStyle)
    setCell(2, 0, 'Pondok Pesantren Eskahade — Audit Trail Aliran Dana Titipan', metaStyle)
    setCell(3, 0, `Filter: ${filterInfo} | Diunduh: ${getFormattedTimestamp()} WIB`, metaStyle)

    const headers = [
      'No',
      'Tanggal Waktu',
      'NIS',
      'Nama Santri',
      'Asrama',
      'Kelas',
      'Jenis Mutasi',
      'Arah',
      'Nominal',
      'Saldo Sebelum',
      'Saldo Sesudah',
      'Operator / Kasir',
      'Sesi Kasir',
      'Catatan',
    ]
    headers.forEach((h, idx) => setCell(5, idx, h, thStyle))

    let rowIdx = 6
    let sumIn = 0
    let sumOut = 0

    ;(report.mutationItems || []).forEach((item, idx) => {
      setCell(rowIdx, 0, idx + 1, tdCenter)
      setCell(rowIdx, 1, item.createdAt.slice(0, 16), tdCenter)
      setCell(rowIdx, 2, item.santriNis, tdCenter)
      setCell(rowIdx, 3, item.santriName, tdText)
      setCell(rowIdx, 4, item.santriAsrama || '-', tdCenter)
      setCell(rowIdx, 5, item.santriKelas || '-', tdCenter)
      setCell(rowIdx, 6, item.movementType, tdCenter)
      setCell(rowIdx, 7, item.direction, tdCenter)
      setCell(rowIdx, 8, item.amount, tdNum)
      setCell(rowIdx, 9, item.balanceBefore, tdNum)
      setCell(rowIdx, 10, item.balanceAfter, tdNum)
      setCell(rowIdx, 11, item.operatorName || '-', tdCenter)
      setCell(rowIdx, 12, item.cashSessionCode || '-', tdCenter)
      setCell(rowIdx, 13, item.notes || '-', tdText)

      if (item.direction === 'IN') sumIn += item.amount
      else sumOut += item.amount
      rowIdx++
    })

    setCell(rowIdx, 0, 'TOTAL', { ...totalStyle, alignment: { horizontal: 'center' } })
    for (let c = 1; c <= 7; c++) setCell(rowIdx, c, '', totalStyle)
    setCell(rowIdx, 8, sumIn - sumOut, totalStyle)
    for (let c = 9; c <= 13; c++) setCell(rowIdx, c, '', totalStyle)

    ws['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 12 },
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
      { wch: 10 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 25 },
    ]
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Uang Jajan')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadExcelBlob(new Blob([wbout], { type: 'application/octet-stream' }), `Laporan-Uang-Jajan-${Date.now()}.xlsx`)
}

// ── 7. EXPORT TRANSAKSI LOKET ────────────────────────────────────────────────
export async function exportCashSessionsExcel(
  items: CashSessionItemRow[],
  filterInfo = 'Semua Sesi Kas'
) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const ws = XLSX.utils.aoa_to_sheet([])

  const setCell = (row: number, col: number, val: string | number, style: CellStyle) =>
    setSheetCell(ws as Record<string, unknown>, row, col, val, style)

  const titleStyle: CellStyle = { font: { sz: 14, bold: true, color: { rgb: '0F172A' } } }
  const metaStyle: CellStyle = { font: { sz: 10, italic: true, color: { rgb: '475569' } } }
  const thStyle: CellStyle = {
    font: { sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const tdText: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { vertical: 'center' } }
  const tdCenter: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'center' } }
  const tdNum: CellStyle = {
    font: { sz: 10 },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalStyle: CellStyle = {
    font: { sz: 10, bold: true },
    border: totalBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  setCell(1, 0, 'LAPORAN TRANSAKSI SESI KAS LOKET KOPERASI', titleStyle)
  setCell(2, 0, 'Pondok Pesantren Eskahade — Rekonsiliasi Saldo Kasir Fisik vs Sistem', metaStyle)
  setCell(3, 0, `Filter: ${filterInfo} | Diunduh: ${getFormattedTimestamp()} WIB`, metaStyle)

  const headers = [
    'No',
    'Kode Sesi',
    'Petugas Kasir',
    'Waktu Buka',
    'Waktu Tutup',
    'Saldo Awal',
    'Total Masuk',
    'Total Keluar',
    'Ekspektasi Sistem',
    'Kas Fisik Riil',
    'Selisih Kas',
    'Status',
    'Catatan Selisih',
  ]
  headers.forEach((h, idx) => setCell(5, idx, h, thStyle))

  let rowIdx = 6
  let totalIn = 0
  let totalOut = 0
  let totalDiff = 0

  items.forEach((item, idx) => {
    setCell(rowIdx, 0, idx + 1, tdCenter)
    setCell(rowIdx, 1, item.sessionCode, tdCenter)
    setCell(rowIdx, 2, item.operatorName, tdText)
    setCell(rowIdx, 3, item.openedAt.slice(0, 16), tdCenter)
    setCell(rowIdx, 4, item.closedAt ? item.closedAt.slice(0, 16) : 'AKTIF', tdCenter)
    setCell(rowIdx, 5, item.openingBalance, tdNum)
    setCell(rowIdx, 6, item.totalCashIn, tdNum)
    setCell(rowIdx, 7, item.totalCashOut, tdNum)
    setCell(rowIdx, 8, item.expectedClosingBalance, tdNum)
    setCell(rowIdx, 9, item.actualClosingBalance !== null ? item.actualClosingBalance : '-', tdCenter)
    setCell(rowIdx, 10, item.difference !== null ? item.difference : 0, tdNum)
    setCell(rowIdx, 11, item.status, tdCenter)
    setCell(rowIdx, 12, item.differenceNotes || '-', tdText)

    totalIn += item.totalCashIn
    totalOut += item.totalCashOut
    totalDiff += item.difference || 0
    rowIdx++
  })

  setCell(rowIdx, 0, 'TOTAL', { ...totalStyle, alignment: { horizontal: 'center' } })
  for (let c = 1; c <= 5; c++) setCell(rowIdx, c, '', totalStyle)
  setCell(rowIdx, 6, totalIn, totalStyle)
  setCell(rowIdx, 7, totalOut, totalStyle)
  setCell(rowIdx, 8, '', totalStyle)
  setCell(rowIdx, 9, '', totalStyle)
  setCell(rowIdx, 10, totalDiff, totalStyle)
  setCell(rowIdx, 11, '', totalStyle)
  setCell(rowIdx, 12, '', totalStyle)

  ws['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 30 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Transaksi Loket')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadExcelBlob(new Blob([wbout], { type: 'application/octet-stream' }), `Laporan-Sesi-Kas-${Date.now()}.xlsx`)
}

// ── 8. EXPORT SETTLEMENT ─────────────────────────────────────────────────────
export async function exportSettlementsExcel(
  items: SettlementItemRow[],
  filterInfo = 'Semua Settlement'
) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const ws = XLSX.utils.aoa_to_sheet([])

  const setCell = (row: number, col: number, val: string | number, style: CellStyle) =>
    setSheetCell(ws as Record<string, unknown>, row, col, val, style)

  const titleStyle: CellStyle = { font: { sz: 14, bold: true, color: { rgb: '0F172A' } } }
  const metaStyle: CellStyle = { font: { sz: 10, italic: true, color: { rgb: '475569' } } }
  const thStyle: CellStyle = {
    font: { sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const tdText: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { vertical: 'center' } }
  const tdCenter: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'center' } }
  const tdNum: CellStyle = {
    font: { sz: 10 },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalStyle: CellStyle = {
    font: { sz: 10, bold: true },
    border: totalBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  setCell(1, 0, 'LAPORAN SETTLEMENT (HISTORIS / LEGACY)', titleStyle)
  setCell(2, 0, 'Pondok Pesantren Eskahade — Pencairan Dana Gateway ke Rekening Bank', metaStyle)
  setCell(3, 0, `Filter: ${filterInfo} | Diunduh: ${getFormattedTimestamp()} WIB`, metaStyle)

  const headers = [
    'No',
    'No. Settlement',
    'Tanggal Pencairan',
    'Bank Tujuan',
    'No. Rekening',
    'Atas Nama',
    'Jml Item',
    'Total Bruto',
    'Total Potongan Fee',
    'Dana Cair Bersih',
    'Status',
    'No. Ref Bank',
    'Dicatat Oleh',
  ]
  headers.forEach((h, idx) => setCell(5, idx, h, thStyle))

  let rowIdx = 6
  let totalGross = 0
  let totalFee = 0
  let totalNet = 0

  items.forEach((item, idx) => {
    setCell(rowIdx, 0, idx + 1, tdCenter)
    setCell(rowIdx, 1, item.settlementNumber, tdCenter)
    setCell(rowIdx, 2, item.settlementDate, tdCenter)
    setCell(rowIdx, 3, item.destinationBank, tdCenter)
    setCell(rowIdx, 4, item.destinationAccount, tdCenter)
    setCell(rowIdx, 5, item.accountHolderName, tdText)
    setCell(rowIdx, 6, item.itemCount, tdCenter)
    setCell(rowIdx, 7, item.grossAmount, tdNum)
    setCell(rowIdx, 8, item.totalFee, tdNum)
    setCell(rowIdx, 9, item.netAmount, tdNum)
    setCell(rowIdx, 10, item.status, tdCenter)
    setCell(rowIdx, 11, item.bankReference || '-', tdCenter)
    setCell(rowIdx, 12, item.createdByName || '-', tdCenter)

    totalGross += item.grossAmount
    totalFee += item.totalFee
    totalNet += item.netAmount
    rowIdx++
  })

  setCell(rowIdx, 0, 'TOTAL', { ...totalStyle, alignment: { horizontal: 'center' } })
  for (let c = 1; c <= 6; c++) setCell(rowIdx, c, '', totalStyle)
  setCell(rowIdx, 7, totalGross, totalStyle)
  setCell(rowIdx, 8, totalFee, totalStyle)
  setCell(rowIdx, 9, totalNet, totalStyle)
  setCell(rowIdx, 10, '', totalStyle)
  setCell(rowIdx, 11, '', totalStyle)
  setCell(rowIdx, 12, '', totalStyle)

  ws['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 22 },
    { wch: 10 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Settlement')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadExcelBlob(new Blob([wbout], { type: 'application/octet-stream' }), `Laporan-Settlement-${Date.now()}.xlsx`)
}

// ── 9. EXPORT REKONSILIASI ───────────────────────────────────────────────────
export async function exportReconciliationsExcel(
  items: ReconciliationReportRow[],
  filterInfo = 'Semua Rekonsiliasi'
) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const ws = XLSX.utils.aoa_to_sheet([])

  const setCell = (row: number, col: number, val: string | number, style: CellStyle) =>
    setSheetCell(ws as Record<string, unknown>, row, col, val, style)

  const titleStyle: CellStyle = { font: { sz: 14, bold: true, color: { rgb: '0F172A' } } }
  const metaStyle: CellStyle = { font: { sz: 10, italic: true, color: { rgb: '475569' } } }
  const thStyle: CellStyle = {
    font: { sz: 10, bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const tdText: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { vertical: 'center' } }
  const tdCenter: CellStyle = { font: { sz: 10 }, border: thinBorder, alignment: { horizontal: 'center', vertical: 'center' } }
  const tdNum: CellStyle = {
    font: { sz: 10 },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  setCell(1, 0, 'LAPORAN AUDIT REKONSILIASI & RESOLUSI DISKREPANSI', titleStyle)
  setCell(2, 0, 'Pondok Pesantren Eskahade — Audit Internal vs Gateway vs Bank', metaStyle)
  setCell(3, 0, `Filter: ${filterInfo} | Diunduh: ${getFormattedTimestamp()} WIB`, metaStyle)

  const headers = [
    'No',
    'Tanggal Waktu',
    'Status Kecocokan',
    'No. Referensi Eksternal',
    'No. Pembayaran',
    'Santri Terkait',
    'Nominal Sistem',
    'Nominal Eksternal',
    'Selisih Nominal',
    'Tindakan Resolusi',
    'Diselesaikan Oleh',
    'Waktu Selesai',
    'Catatan Resolusi',
  ]
  headers.forEach((h, idx) => setCell(5, idx, h, thStyle))

  let rowIdx = 6
  items.forEach((item, idx) => {
    setCell(rowIdx, 0, idx + 1, tdCenter)
    setCell(rowIdx, 1, item.createdAt.slice(0, 16), tdCenter)
    setCell(rowIdx, 2, item.matchStatus, tdCenter)
    setCell(rowIdx, 3, item.externalReference || '-', tdCenter)
    setCell(rowIdx, 4, item.paymentNumber || '-', tdCenter)
    setCell(rowIdx, 5, item.santriName || '-', tdText)
    setCell(rowIdx, 6, item.internalAmount, tdNum)
    setCell(rowIdx, 7, item.externalAmount, tdNum)
    setCell(rowIdx, 8, item.discrepancyAmount, tdNum)
    setCell(rowIdx, 9, item.resolutionAction, tdCenter)
    setCell(rowIdx, 10, item.resolvedByName || '-', tdCenter)
    setCell(rowIdx, 11, item.resolvedAt ? item.resolvedAt.slice(0, 16) : '-', tdCenter)
    setCell(rowIdx, 12, item.resolutionNotes || '-', tdText)
    rowIdx++
  })

  ws['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 30 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rekonsiliasi')
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadExcelBlob(new Blob([wbout], { type: 'application/octet-stream' }), `Laporan-Rekonsiliasi-${Date.now()}.xlsx`)
}
