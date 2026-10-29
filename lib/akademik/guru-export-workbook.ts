import type { ExportDocument } from './guru-export'
import type * as Excel from 'xlsx'

export function safeExportFilename(doc: ExportDocument) {
  return `${doc.title}_${doc.kelas}_${doc.cakupan}_${doc.exportedAt.slice(0, 10)}`
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 180) + '.xlsx'
}

export function buildGuruWorkbook(XLSX: typeof Excel, doc: ExportDocument) {
  const workbook = XLSX.utils.book_new()
  for (const [name, sheet] of [['Rekap', doc.rekap], ['Detail', doc.detail]] as const) {
    const headerRow = 6
    const rows = [
      [doc.title], ['Kelas', doc.kelas], ['Tahun Ajaran', doc.tahunAjaran], ['Cakupan', doc.cakupan],
      ['Waktu Ekspor', doc.exportedAt], [], sheet.headers, ...sheet.rows,
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = sheet.headers.map((header, i) => ({ wch: Math.min(48, Math.max(12, header.length + 2, ...sheet.rows.slice(0, 100).map(row => String(row[i] ?? '').length + 2))) }))
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ r: headerRow, c: 0 }, { r: headerRow + sheet.rows.length, c: sheet.headers.length - 1 }) }
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: sheet.headers.length - 1 } }]
    XLSX.utils.book_append_sheet(workbook, ws, name)
  }
  return workbook
}

export async function downloadGuruWorkbook(doc: ExportDocument, canDownload: () => boolean = () => true) {
  const XLSX = await import('xlsx')
  if (!canDownload()) return false
  XLSX.writeFile(buildGuruWorkbook(XLSX, doc), safeExportFilename(doc))
  return true
}
