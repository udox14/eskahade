import fs from 'node:fs/promises'
import XLSXModule from 'xlsx-js-style'

const XLSX = XLSXModule.default ?? XLSXModule
const reference = XLSX.readFile('C:/DATA/eskahade/.codex-temp/upk-template-inspect/reference.xlsx', { cellStyles: true, cellFormula: true })
const source = reference.Sheets[reference.SheetNames[0]]
const groups = [
  { name: 'TAMHIDIYYAH', start: 5, end: 11, defaultEnd: 11 },
  { name: 'IBTIDAIYAH 1', start: 5, end: 13, defaultEnd: 12 },
  { name: 'IBTIDAIYAH 2', start: 5, end: 13, defaultEnd: 10 },
  { name: 'IBTIDAIYAH 3', start: 16, end: 23, defaultEnd: 20 },
  { name: 'MUTAWASSITHAH 1', start: 18, end: 27, defaultEnd: 26 },
  { name: 'KITAB LAIN', start: 18, end: 24, defaultEnd: 24 },
].map((group, index) => {
  const columns = ['BCD', 'FGH', 'JKL'][index % 3]
  return {
    nama: group.name,
    items: Array.from({ length: group.end - group.start + 1 }, (_, offset) => {
      const row = group.start + offset
      return {
        nama_kitab: source[`${columns[1]}${row}`]?.v ?? '',
        harga_jual: source[`${columns[2]}${row}`]?.v ?? 0,
        is_default: row <= group.defaultEnd,
      }
    }),
  }
})

const colors = ['FDEADA', 'FFFF00', 'D7E4BD', 'B7DEE8', 'CCC1DA', 'D9D9D9']
const blockCols = [1, 5, 9]
const currency = '_("Rp"* #,##0_);_("Rp"* \\(#,##0\\);_("Rp"* "-"_);_(@_)'
const border = { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } }
const colName = i => { let s = ''; for (let v = i + 1; v > 0; v = Math.floor((v - 1) / 26)) s = String.fromCharCode(65 + ((v - 1) % 26)) + s; return s }
const ws = XLSX.utils.aoa_to_sheet([])
const merges = []
let maxRow = 1
const set = (r, c, v, s, f) => { ws[`${colName(c)}${r}`] = { t: typeof v === 'number' ? 'n' : 's', v, ...(f ? { f } : {}), s }; maxRow = Math.max(maxRow, r) }
const title = { font: { name: 'Alte Haas Grotesk', sz: 18, bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'center', vertical: 'center' } }
const section = fill => ({ font: { name: 'Alte Haas Grotesk', sz: 12, bold: true }, fill: { patternType: 'solid', fgColor: { rgb: fill } }, border, alignment: { horizontal: 'center', vertical: 'center' } })
const header = { font: { name: 'Arial Narrow', sz: 12, bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } }, border, alignment: { horizontal: 'center', vertical: 'center' } }
const base = align => ({ font: { name: 'Arial Narrow', sz: 12 }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, border, alignment: { horizontal: align, vertical: 'center' } })
const optional = style => ({ ...style, font: { name: 'Arial Narrow', sz: 12, italic: true }, fill: { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } } })
const totalLabel = { font: { name: 'Arial Narrow', sz: 12, bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, border, alignment: { horizontal: 'center', vertical: 'center' } }
const totalValue = { font: { name: 'Arial Narrow', sz: 14, bold: true, color: { rgb: 'FF0000' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, border, alignment: { horizontal: 'center', vertical: 'center' }, numFmt: currency }

set(1, 1, 'DAFTAR HARGA KITAB UPK PST. SUKAHIDENG 2026', title)
merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: 11 } })
let bandStart = 3
for (let bandIndex = 0; bandIndex < Math.ceil(groups.length / 3); bandIndex++) {
  const band = groups.slice(bandIndex * 3, bandIndex * 3 + 3)
  const bandMax = Math.max(...band.map(g => g.items.length))
  band.forEach((group, blockIndex) => {
    const c = blockCols[blockIndex]
    const items = [...group.items].sort((a, b) => Number(b.is_default) - Number(a.is_default))
    const color = colors[bandIndex * 3 + blockIndex]
    for (let x = 0; x < 3; x++) set(bandStart, c + x, x ? '' : group.nama, section(color))
    merges.push({ s: { r: bandStart - 1, c }, e: { r: bandStart - 1, c: c + 2 } })
    set(bandStart + 1, c, 'No', header); set(bandStart + 1, c + 1, 'Nama Kitab', header); set(bandStart + 1, c + 2, 'Harga (Rp)', header)
    items.forEach((item, i) => {
      const r = bandStart + 2 + i
      set(r, c, i + 1, item.is_default ? base('center') : optional(base('center')))
      set(r, c + 1, item.nama_kitab, item.is_default ? base('left') : optional(base('left')))
      const priceStyle = { ...base('center'), numFmt: currency }
      set(r, c + 2, item.harga_jual, item.is_default ? priceStyle : optional(priceStyle))
    })
    const totalRow = bandStart + 2 + items.length
    const defaultCount = items.filter(i => i.is_default).length
    const total = items.slice(0, defaultCount).reduce((sum, i) => sum + i.harga_jual, 0)
    const pc = colName(c + 2)
    set(totalRow, c, 'TOTAL', totalLabel); set(totalRow, c + 1, '', totalLabel)
    set(totalRow, c + 2, total, totalValue, `SUM(${pc}${bandStart + 2}:${pc}${bandStart + 1 + defaultCount})`)
    merges.push({ s: { r: totalRow - 1, c }, e: { r: totalRow - 1, c: c + 1 } })
  })
  bandStart += bandMax + 4
}
ws['!ref'] = `B1:L${maxRow}`
ws['!merges'] = merges
ws['!cols'] = [{ wch: 4.6 }, { wch: 4.1 }, { wch: 30.6 }, { wch: 13.6 }, { wch: 1.8 }, { wch: 3.4 }, { wch: 30.6 }, { wch: 13.6 }, { wch: 1.6 }, { wch: 2.8 }, { wch: 29.3 }, { wch: 13.5 }]
ws['!rows'] = Array.from({ length: maxRow }, (_, i) => ({ hpt: i === 0 ? 22.8 : i === 1 ? 12.75 : 19.5 }))
ws['!margins'] = { left: 0.2362204724409449, right: 0.2362204724409449, top: 0.31496062992125984, bottom: 0.31496062992125984, header: 0.31496062992125984, footer: 0.31496062992125984 }
ws['!pageSetup'] = { paperSize: 14, orientation: 'landscape', fitToWidth: 1, fitToHeight: 1 }
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Harga Kitab Keseluruhan')
const outDir = 'C:/DATA/eskahade/.codex-temp/upk-template-inspect/outputs/019f5f73-5234-74b2-b2cc-2c3730902b4f'
await fs.mkdir(outDir, { recursive: true })
XLSX.writeFile(wb, `${outDir}/qa.xlsx`, { cellStyles: true })
