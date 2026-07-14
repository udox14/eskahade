'use client'

import { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type PriceListMarhalah = {
  id: number
  nama: string
  items: {
    id: number
    nama_kitab: string
    harga_jual: number
    is_default: boolean
  }[]
}

type CellStyle = Record<string, unknown>

const SECTION_COLORS = ['FDEADA', 'FFFF00', 'D7E4BD', 'B7DEE8', 'CCC1DA', 'D9D9D9']
const BLOCK_COLUMNS = [1, 5, 9] // B:D, F:H, J:L
const CURRENCY_FORMAT = '_("Rp"* #,##0_);_("Rp"* \\(#,##0\\);_("Rp"* "-"_);_(@_)'

const thinBorder = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
}

function columnName(index: number) {
  let result = ''
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result
  }
  return result
}

function cellAddress(row: number, column: number) {
  return `${columnName(column)}${row}`
}

export function PriceListExportButton({ marhalah }: { marhalah: PriceListMarhalah[] }) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!marhalah.length || exporting) return
    setExporting(true)

    try {
      const XLSXModule = await import('xlsx-js-style')
      const XLSX = XLSXModule.default ?? XLSXModule
      const worksheet = XLSX.utils.aoa_to_sheet([])
      const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
      let maxRow = 1

      const setCell = (row: number, column: number, value: string | number, style: CellStyle, formula?: string) => {
        const address = cellAddress(row, column)
        worksheet[address] = {
          t: typeof value === 'number' ? 'n' : 's',
          v: value,
          ...(formula ? { f: formula } : {}),
          s: style,
        }
        maxRow = Math.max(maxRow, row)
      }

      const titleStyle: CellStyle = {
        font: { name: 'Alte Haas Grotesk', sz: 18, bold: true, color: { rgb: '000000' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
      const sectionStyle = (fill: string): CellStyle => ({
        font: { name: 'Alte Haas Grotesk', sz: 12, bold: true, color: { rgb: '000000' } },
        fill: { patternType: 'solid', fgColor: { rgb: fill } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'center' },
      })
      const headerStyle: CellStyle = {
        font: { name: 'Arial Narrow', sz: 12, bold: true, color: { rgb: '000000' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'center' },
      }
      const numberStyle: CellStyle = {
        font: { name: 'Arial Narrow', sz: 12, color: { rgb: '000000' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'center' },
      }
      const nameStyle: CellStyle = {
        font: { name: 'Arial Narrow', sz: 12, color: { rgb: '000000' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        border: thinBorder,
        alignment: { horizontal: 'left', vertical: 'center' },
      }
      const priceStyle: CellStyle = {
        font: { name: 'Arial Narrow', sz: 12, color: { rgb: '000000' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'center' },
        numFmt: CURRENCY_FORMAT,
      }
      const optionalStyle = (base: CellStyle): CellStyle => ({
        ...base,
        font: { name: 'Arial Narrow', sz: 12, italic: true, color: { rgb: '000000' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } },
      })
      const totalLabelStyle: CellStyle = {
        font: { name: 'Arial Narrow', sz: 12, bold: true, color: { rgb: '000000' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'center' },
      }
      const totalValueStyle: CellStyle = {
        font: { name: 'Arial Narrow', sz: 14, bold: true, color: { rgb: 'FF0000' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'center' },
        numFmt: CURRENCY_FORMAT,
      }

      setCell(1, 1, `DAFTAR HARGA KITAB UPK PST. SUKAHIDENG ${new Date().getFullYear()}`, titleStyle)
      merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: 11 } })

      let bandStartRow = 3
      for (let bandIndex = 0; bandIndex < Math.ceil(marhalah.length / 3); bandIndex += 1) {
        const band = marhalah.slice(bandIndex * 3, bandIndex * 3 + 3)
        const bandMaxItems = Math.max(0, ...band.map(group => group.items.length))

        band.forEach((group, blockIndex) => {
          const startColumn = BLOCK_COLUMNS[blockIndex]
          const items = [...group.items].sort((a, b) => Number(b.is_default) - Number(a.is_default))
          const sectionRow = bandStartRow
          const headerRow = sectionRow + 1
          const firstItemRow = headerRow + 1

          setCell(sectionRow, startColumn, group.nama.toUpperCase(), sectionStyle(SECTION_COLORS[(bandIndex * 3 + blockIndex) % SECTION_COLORS.length]))
          setCell(sectionRow, startColumn + 1, '', sectionStyle(SECTION_COLORS[(bandIndex * 3 + blockIndex) % SECTION_COLORS.length]))
          setCell(sectionRow, startColumn + 2, '', sectionStyle(SECTION_COLORS[(bandIndex * 3 + blockIndex) % SECTION_COLORS.length]))
          merges.push({ s: { r: sectionRow - 1, c: startColumn }, e: { r: sectionRow - 1, c: startColumn + 2 } })

          setCell(headerRow, startColumn, 'No', headerStyle)
          setCell(headerRow, startColumn + 1, 'Nama Kitab', headerStyle)
          setCell(headerRow, startColumn + 2, 'Harga (Rp)', headerStyle)

          items.forEach((item, itemIndex) => {
            const row = firstItemRow + itemIndex
            const numberCellStyle = item.is_default ? numberStyle : optionalStyle(numberStyle)
            const nameCellStyle = item.is_default ? nameStyle : optionalStyle(nameStyle)
            const priceCellStyle = item.is_default ? priceStyle : optionalStyle(priceStyle)
            setCell(row, startColumn, itemIndex + 1, numberCellStyle)
            setCell(row, startColumn + 1, item.nama_kitab, nameCellStyle)
            setCell(row, startColumn + 2, item.harga_jual, priceCellStyle)
          })

          const totalRow = firstItemRow + items.length
          const defaultCount = items.filter(item => item.is_default).length
          const total = items.slice(0, defaultCount).reduce((sum, item) => sum + item.harga_jual, 0)
          const priceColumn = columnName(startColumn + 2)
          const formula = defaultCount > 0
            ? `SUM(${priceColumn}${firstItemRow}:${priceColumn}${firstItemRow + defaultCount - 1})`
            : undefined

          setCell(totalRow, startColumn, 'TOTAL', totalLabelStyle)
          setCell(totalRow, startColumn + 1, '', totalLabelStyle)
          setCell(totalRow, startColumn + 2, total, totalValueStyle, formula)
          merges.push({ s: { r: totalRow - 1, c: startColumn }, e: { r: totalRow - 1, c: startColumn + 1 } })
        })

        bandStartRow += bandMaxItems + 4
      }

      worksheet['!ref'] = `B1:L${maxRow}`
      worksheet['!merges'] = merges
      worksheet['!cols'] = [
        { wch: 4.6 }, { wch: 4.1 }, { wch: 30.6 }, { wch: 13.6 },
        { wch: 1.8 }, { wch: 3.4 }, { wch: 30.6 }, { wch: 13.6 },
        { wch: 1.6 }, { wch: 2.8 }, { wch: 29.3 }, { wch: 13.5 },
      ]
      worksheet['!rows'] = Array.from({ length: maxRow }, (_, index) => ({ hpt: index === 0 ? 22.8 : index === 1 ? 12.75 : 19.5 }))
      worksheet['!margins'] = {
        left: 0.2362204724409449,
        right: 0.2362204724409449,
        top: 0.31496062992125984,
        bottom: 0.31496062992125984,
        header: 0.31496062992125984,
        footer: 0.31496062992125984,
      }
      worksheet['!pageSetup'] = { paperSize: 14, orientation: 'landscape', fitToWidth: 1, fitToHeight: 1 }

      const workbook = XLSX.utils.book_new()
      workbook.Workbook = { Views: [{ RTL: false }] }
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Harga Kitab Keseluruhan')
      XLSX.writeFile(workbook, `Daftar_Harga_Per_Marhalah_${new Date().getFullYear()}.xlsx`, { cellStyles: true })
      toast.success('Daftar harga berhasil diekspor ke Excel')
    } catch (error) {
      console.error('[UPK Katalog] Gagal export Excel', error)
      toast.error('Gagal membuat file Excel daftar harga.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={!marhalah.length || exporting}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
      {exporting ? 'Membuat Excel...' : 'Export Daftar Harga'}
    </button>
  )
}
