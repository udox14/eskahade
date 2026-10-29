import type { ExportDocument } from './guru-export'
import type * as Excel from 'xlsx'

export function safeExportFilename(doc: ExportDocument) {
  return `${doc.title}_${doc.kelas}_${doc.cakupan}_${doc.exportedAt.slice(0, 10)}`
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 180) + '.xlsx'
}

export function buildGuruWorkbook(XLSX: typeof Excel, doc: ExportDocument) {
  const workbook = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  // Reserve the combined sheet's name before normalizing subject/session names.
  if (doc.sheets.length > 1 && doc.sheets[0].name === 'Gabungan') usedNames.add('gabungan')
  for (const [index, sheet] of doc.sheets.entries()) {
    // SheetJS 0.18 writes unescaped ASCII apostrophes in AutoFilter named
    // ranges (e.g. 'Hafalan Al-Qur'an'!A7:J9), which Excel cannot parse.
    // Use a typographic apostrophe for tab names; cell content stays intact.
    const base = sheet.name.replace(/[\\/?*\[\]:\u0000-\u001f]/g, ' ').trim().replace(/^'+|'+$/g, '').replace(/'/g, '’').trim().slice(0, 31) || 'Rekap'
    let name = base, suffix = 2
    if (!(index === 0 && base === 'Gabungan')) {
      while (usedNames.has(name.toLowerCase())) {
        const ending = ` (${suffix++})`
        name = base.slice(0, 31 - ending.length) + ending
      }
    }
    usedNames.add(name.toLowerCase())
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
