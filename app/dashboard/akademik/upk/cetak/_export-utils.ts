'use client'

import type { RekapTerjualItem, RekapTidakTerjualItem, RekapPemasukanItem, RekapPengeluaranItem } from './actions'
import type { getDaftarKitabPerMarhalah } from './actions'

type PriceListMarhalah = Awaited<ReturnType<typeof getDaftarKitabPerMarhalah>>['marhalah']

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

function formatRp(val: number): string {
  return `Rp ${val.toLocaleString('id-ID')}`
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── EXPORT EXCEL: REKAP TERJUAL ──────────────────────────────────────────────

export async function exportRekapTerjualExcel(
  items: RekapTerjualItem[],
  tipeStok: 'BARU' | 'LAMA',
  subtitle?: string
) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const worksheet = XLSX.utils.aoa_to_sheet([])
  let maxRow = 1

  const setCell = (row: number, col: number, val: string | number, style: any, formula?: string) => {
    const addr = cellAddress(row, col)
    worksheet[addr] = {
      t: typeof val === 'number' ? 'n' : 's',
      v: val,
      ...(formula ? { f: formula } : {}),
      s: style,
    }
    maxRow = Math.max(maxRow, row)
  }

  const titleText = `REKAP PENJUALAN KITAB STOK ${tipeStok === 'BARU' ? 'BARU' : 'LAMA'}`

  const titleStyle = {
    font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }

  const subtitleStyle = {
    font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '555555' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }

  const headerStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  }

  const centerStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }

  const leftStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'left', vertical: 'center' },
  }

  const currencyStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  const totalLabelStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }

  const totalValueStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  const totalQtyStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }

  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []

  // Row 1: Title
  setCell(1, 0, titleText, titleStyle)
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } })

  let startDataRow = 3
  if (subtitle) {
    setCell(2, 0, subtitle, subtitleStyle)
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 6 } })
    startDataRow = 4
  }

  const headerRow = startDataRow
  const firstItemRow = headerRow + 1

  // Headers (0-indexed cols: A=0, B=1, C=2, D=3, E=4, F=5, G=6)
  setCell(headerRow, 0, 'NO', headerStyle)
  setCell(headerRow, 1, 'NAMA KITAB', headerStyle)
  setCell(headerRow, 2, 'TERJUAL', headerStyle)
  setCell(headerRow, 3, 'HARGA BELI', headerStyle)
  setCell(headerRow, 4, 'HARGA JUAL', headerStyle)
  setCell(headerRow, 5, 'MODAL', headerStyle)
  setCell(headerRow, 6, 'LABA KOTOR', headerStyle)

  items.forEach((item, index) => {
    const row = firstItemRow + index
    setCell(row, 0, index + 1, centerStyle)
    setCell(row, 1, item.nama_kitab, leftStyle)
    setCell(row, 2, item.qty_terjual, centerStyle)
    setCell(row, 3, item.harga_beli, currencyStyle)
    setCell(row, 4, item.harga_jual, currencyStyle)
    setCell(row, 5, item.modal, currencyStyle, `C${row}*D${row}`)
    setCell(row, 6, item.laba_kotor, currencyStyle, `C${row}*E${row}`)
  })

  const totalRow = firstItemRow + items.length
  setCell(totalRow, 0, 'JUMLAH TOTAL', totalLabelStyle)
  setCell(totalRow, 1, '', totalLabelStyle)
  merges.push({ s: { r: totalRow - 1, c: 0 }, e: { r: totalRow - 1, c: 1 } })

  const totalQty = items.reduce((acc, i) => acc + i.qty_terjual, 0)
  const totalModal = items.reduce((acc, i) => acc + i.modal, 0)
  const totalLabaKotor = items.reduce((acc, i) => acc + i.laba_kotor, 0)

  setCell(totalRow, 2, totalQty, totalQtyStyle, `SUM(C${firstItemRow}:C${totalRow - 1})`)
  setCell(totalRow, 3, '', totalLabelStyle)
  setCell(totalRow, 4, '', totalLabelStyle)
  setCell(totalRow, 5, totalModal, totalValueStyle, `SUM(F${firstItemRow}:F${totalRow - 1})`)
  setCell(totalRow, 6, totalLabaKotor, totalValueStyle, `SUM(G${firstItemRow}:G${totalRow - 1})`)

  worksheet['!ref'] = `A1:G${maxRow}`
  worksheet['!merges'] = merges
  worksheet['!cols'] = [
    { wch: 6 },   // A: NO
    { wch: 36 },  // B: NAMA KITAB
    { wch: 12 },  // C: TERJUAL
    { wch: 16 },  // D: HARGA BELI
    { wch: 16 },  // E: HARGA JUAL
    { wch: 20 },  // F: MODAL
    { wch: 20 },  // G: LABA KOTOR
  ]
  worksheet['!rows'] = Array.from({ length: maxRow }, (_, i) => ({
    hpt: i === 0 ? 24 : i === headerRow - 1 ? 22 : 20,
  }))

  worksheet['!pageSetup'] = { paperSize: 9, orientation: 'portrait', fitToWidth: 1 }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, `Rekap Terjual Stok ${tipeStok}`)
  XLSX.writeFile(workbook, `Rekap_Penjualan_Kitab_Stok_${tipeStok}_${new Date().toISOString().slice(0, 10)}.xlsx`, { cellStyles: true })
}

// ── EXPORT WORD: REKAP TERJUAL ───────────────────────────────────────────────

export function exportRekapTerjualWord(
  items: RekapTerjualItem[],
  tipeStok: 'BARU' | 'LAMA',
  subtitle?: string
) {
  const titleText = `REKAP PENJUALAN KITAB STOK ${tipeStok === 'BARU' ? 'BARU' : 'LAMA'}`
  const totalQty = items.reduce((acc, i) => acc + i.qty_terjual, 0)
  const totalModal = items.reduce((acc, i) => acc + i.modal, 0)
  const totalLabaKotor = items.reduce((acc, i) => acc + i.laba_kotor, 0)

  const tableRowsHtml = items
    .map(
      (item, idx) => `
    <tr>
      <td class="text-center">${idx + 1}</td>
      <td class="text-left">${item.nama_kitab}</td>
      <td class="text-center">${item.qty_terjual}</td>
      <td class="text-right">${formatRp(item.harga_beli)}</td>
      <td class="text-right">${formatRp(item.harga_jual)}</td>
      <td class="text-right">${formatRp(item.modal)}</td>
      <td class="text-right">${formatRp(item.laba_kotor)}</td>
    </tr>`
    )
    .join('')

  const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${titleText}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4 portrait;
      margin: 1.5cm 1.5cm 1.5cm 1.5cm;
    }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.2;
      color: #000;
    }
    h2 {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    p.subtitle {
      text-align: center;
      font-size: 10pt;
      font-style: italic;
      margin-top: 0;
      margin-bottom: 16px;
      color: #444;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th {
      background-color: #D9D9D9;
      font-weight: bold;
      text-align: center;
      border: 1px solid #000;
      padding: 6px 4px;
      font-size: 10pt;
    }
    td {
      border: 1px solid #000;
      padding: 5px 6px;
      font-size: 10pt;
      vertical-align: middle;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .total-row {
      font-weight: bold;
      background-color: #F2F2F2;
    }
  </style>
</head>
<body>
  <h2>${titleText}</h2>
  ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
  <table>
    <thead>
      <tr>
        <th style="width: 5%;">NO</th>
        <th style="width: 35%;">NAMA KITAB</th>
        <th style="width: 10%;">TERJUAL</th>
        <th style="width: 12%;">HARGA BELI</th>
        <th style="width: 12%;">HARGA JUAL</th>
        <th style="width: 13%;">MODAL</th>
        <th style="width: 13%;">LABA KOTOR</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
      <tr class="total-row">
        <td colspan="2" class="text-center">JUMLAH TOTAL</td>
        <td class="text-center">${totalQty}</td>
        <td></td>
        <td></td>
        <td class="text-right">${formatRp(totalModal)}</td>
        <td class="text-right">${formatRp(totalLabaKotor)}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' })
  downloadFile(blob, `Rekap_Penjualan_Kitab_Stok_${tipeStok}_${new Date().toISOString().slice(0, 10)}.doc`)
}

// ── EXPORT EXCEL: REKAP TIDAK TERJUAL ────────────────────────────────────────

export async function exportRekapTidakTerjualExcel(items: RekapTidakTerjualItem[], subtitle?: string) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const worksheet = XLSX.utils.aoa_to_sheet([])
  let maxRow = 1

  const setCell = (row: number, col: number, val: string | number, style: any, formula?: string) => {
    const addr = cellAddress(row, col)
    worksheet[addr] = {
      t: typeof val === 'number' ? 'n' : 's',
      v: val,
      ...(formula ? { f: formula } : {}),
      s: style,
    }
    maxRow = Math.max(maxRow, row)
  }

  const titleText = 'REKAP KITAB TIDAK / BELUM TERJUAL'

  const titleStyle = {
    font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const subtitleStyle = {
    font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '555555' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const headerStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  }
  const centerStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const leftStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'left', vertical: 'center' },
  }
  const currencyStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalLabelStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const totalValueStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalQtyStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }

  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []

  setCell(1, 0, titleText, titleStyle)
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } })

  let startDataRow = 3
  if (subtitle) {
    setCell(2, 0, subtitle, subtitleStyle)
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 8 } })
    startDataRow = 4
  }

  const headerRow = startDataRow
  const firstItemRow = headerRow + 1

  setCell(headerRow, 0, 'NO', headerStyle)
  setCell(headerRow, 1, 'NAMA KITAB', headerStyle)
  setCell(headerRow, 2, 'STOK LAMA', headerStyle)
  setCell(headerRow, 3, 'STOK BARU', headerStyle)
  setCell(headerRow, 4, 'STOK TOTAL', headerStyle)
  setCell(headerRow, 5, 'HARGA BELI', headerStyle)
  setCell(headerRow, 6, 'HARGA JUAL', headerStyle)
  setCell(headerRow, 7, 'NILAI ASSET (MODAL)', headerStyle)
  setCell(headerRow, 8, 'NILAI ASSET (JUAL)', headerStyle)

  items.forEach((item, index) => {
    const row = firstItemRow + index
    setCell(row, 0, index + 1, centerStyle)
    setCell(row, 1, item.nama_kitab, leftStyle)
    setCell(row, 2, item.stok_lama, centerStyle)
    setCell(row, 3, item.stok_baru, centerStyle)
    setCell(row, 4, item.stok_total, centerStyle, `C${row}+D${row}`)
    setCell(row, 5, item.harga_beli, currencyStyle)
    setCell(row, 6, item.harga_jual, currencyStyle)
    setCell(row, 7, item.nilai_asset_modal, currencyStyle, `E${row}*F${row}`)
    setCell(row, 8, item.nilai_asset_jual, currencyStyle, `E${row}*G${row}`)
  })

  const totalRow = firstItemRow + items.length
  setCell(totalRow, 0, 'JUMLAH TOTAL', totalLabelStyle)
  setCell(totalRow, 1, '', totalLabelStyle)
  merges.push({ s: { r: totalRow - 1, c: 0 }, e: { r: totalRow - 1, c: 1 } })

  const totalLama = items.reduce((acc, i) => acc + i.stok_lama, 0)
  const totalBaru = items.reduce((acc, i) => acc + i.stok_baru, 0)
  const totalStok = items.reduce((acc, i) => acc + i.stok_total, 0)
  const totalAssetModal = items.reduce((acc, i) => acc + i.nilai_asset_modal, 0)
  const totalAssetJual = items.reduce((acc, i) => acc + i.nilai_asset_jual, 0)

  setCell(totalRow, 2, totalLama, totalQtyStyle, `SUM(C${firstItemRow}:C${totalRow - 1})`)
  setCell(totalRow, 3, totalBaru, totalQtyStyle, `SUM(D${firstItemRow}:D${totalRow - 1})`)
  setCell(totalRow, 4, totalStok, totalQtyStyle, `SUM(E${firstItemRow}:E${totalRow - 1})`)
  setCell(totalRow, 5, '', totalLabelStyle)
  setCell(totalRow, 6, '', totalLabelStyle)
  setCell(totalRow, 7, totalAssetModal, totalValueStyle, `SUM(H${firstItemRow}:H${totalRow - 1})`)
  setCell(totalRow, 8, totalAssetJual, totalValueStyle, `SUM(I${firstItemRow}:I${totalRow - 1})`)

  worksheet['!ref'] = `A1:I${maxRow}`
  worksheet['!merges'] = merges
  worksheet['!cols'] = [
    { wch: 6 },   // A: NO
    { wch: 34 },  // B: NAMA KITAB
    { wch: 12 },  // C: STOK LAMA
    { wch: 12 },  // D: STOK BARU
    { wch: 14 },  // E: STOK TOTAL
    { wch: 15 },  // F: HARGA BELI
    { wch: 15 },  // G: HARGA JUAL
    { wch: 22 },  // H: NILAI ASSET MODAL
    { wch: 22 },  // I: NILAI ASSET JUAL
  ]
  worksheet['!rows'] = Array.from({ length: maxRow }, (_, i) => ({
    hpt: i === 0 ? 24 : i === headerRow - 1 ? 22 : 20,
  }))

  worksheet['!pageSetup'] = { paperSize: 9, orientation: 'landscape', fitToWidth: 1 }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Sisa Stok')
  XLSX.writeFile(workbook, `Rekap_Kitab_Tidak_Terjual_${new Date().toISOString().slice(0, 10)}.xlsx`, { cellStyles: true })
}

// ── EXPORT WORD: REKAP TIDAK TERJUAL ─────────────────────────────────────────

export function exportRekapTidakTerjualWord(items: RekapTidakTerjualItem[], subtitle?: string) {
  const titleText = 'REKAP KITAB TIDAK / BELUM TERJUAL'
  const totalLama = items.reduce((acc, i) => acc + i.stok_lama, 0)
  const totalBaru = items.reduce((acc, i) => acc + i.stok_baru, 0)
  const totalStok = items.reduce((acc, i) => acc + i.stok_total, 0)
  const totalAssetModal = items.reduce((acc, i) => acc + i.nilai_asset_modal, 0)
  const totalAssetJual = items.reduce((acc, i) => acc + i.nilai_asset_jual, 0)

  const tableRowsHtml = items
    .map(
      (item, idx) => `
    <tr>
      <td class="text-center">${idx + 1}</td>
      <td class="text-left">${item.nama_kitab}</td>
      <td class="text-center">${item.stok_lama}</td>
      <td class="text-center">${item.stok_baru}</td>
      <td class="text-center font-bold">${item.stok_total}</td>
      <td class="text-right">${formatRp(item.harga_beli)}</td>
      <td class="text-right">${formatRp(item.harga_jual)}</td>
      <td class="text-right">${formatRp(item.nilai_asset_modal)}</td>
      <td class="text-right">${formatRp(item.nilai_asset_jual)}</td>
    </tr>`
    )
    .join('')

  const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${titleText}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4 landscape;
      margin: 1.5cm 1.5cm 1.5cm 1.5cm;
    }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.2;
      color: #000;
    }
    h2 {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    p.subtitle {
      text-align: center;
      font-size: 10pt;
      font-style: italic;
      margin-top: 0;
      margin-bottom: 16px;
      color: #444;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th {
      background-color: #D9D9D9;
      font-weight: bold;
      text-align: center;
      border: 1px solid #000;
      padding: 6px 4px;
      font-size: 10pt;
    }
    td {
      border: 1px solid #000;
      padding: 5px 6px;
      font-size: 10pt;
      vertical-align: middle;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .total-row {
      font-weight: bold;
      background-color: #F2F2F2;
    }
  </style>
</head>
<body>
  <h2>${titleText}</h2>
  ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
  <table>
    <thead>
      <tr>
        <th style="width: 4%;">NO</th>
        <th style="width: 28%;">NAMA KITAB</th>
        <th style="width: 9%;">STOK LAMA</th>
        <th style="width: 9%;">STOK BARU</th>
        <th style="width: 10%;">STOK TOTAL</th>
        <th style="width: 10%;">HARGA BELI</th>
        <th style="width: 10%;">HARGA JUAL</th>
        <th style="width: 10%;">NILAI (MODAL)</th>
        <th style="width: 10%;">NILAI (JUAL)</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
      <tr class="total-row">
        <td colspan="2" class="text-center">JUMLAH TOTAL</td>
        <td class="text-center">${totalLama}</td>
        <td class="text-center">${totalBaru}</td>
        <td class="text-center">${totalStok}</td>
        <td></td>
        <td></td>
        <td class="text-right">${formatRp(totalAssetModal)}</td>
        <td class="text-right">${formatRp(totalAssetJual)}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' })
  downloadFile(blob, `Rekap_Kitab_Tidak_Terjual_${new Date().toISOString().slice(0, 10)}.doc`)
}

// ── EXPORT WORD: DAFTAR HARGA ────────────────────────────────────────────────

export function exportDaftarHargaWord(marhalahList: PriceListMarhalah) {
  const year = new Date().getFullYear()
  const titleText = `DAFTAR HARGA KITAB UPK PST. SUKAHIDENG ${year}`

  let contentHtml = ''

  marhalahList.forEach(m => {
    if (!m.items.length) return
    const items = [...m.items].sort((a, b) => Number(b.is_default) - Number(a.is_default))
    const defaultItems = items.filter(i => i.is_default)
    const totalHargaDefault = defaultItems.reduce((acc, i) => acc + i.harga_jual, 0)

    const rows = items
      .map(
        (item, idx) => `
      <tr ${!item.is_default ? 'style="background-color: #F9F9F9; font-style: italic;"' : ''}>
        <td class="text-center">${idx + 1}</td>
        <td class="text-left">${item.nama_kitab} ${!item.is_default ? '(Pilihan)' : ''}</td>
        <td class="text-right">${formatRp(item.harga_jual)}</td>
      </tr>`
      )
      .join('')

    contentHtml += `
    <div style="margin-bottom: 24px;">
      <h3 style="background-color: #D7E4BD; border: 1px solid #000; padding: 6px; text-align: center; margin-bottom: 0; font-size: 11pt; text-transform: uppercase;">MARHALAH ${m.nama}</h3>
      <table style="margin-top: 0;">
        <thead>
          <tr>
            <th style="width: 10%;">NO</th>
            <th style="width: 60%;">NAMA KITAB</th>
            <th style="width: 30%;">HARGA (RP)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="2" class="text-center">TOTAL HARGA WAJIB</td>
            <td class="text-right" style="color: #CC0000;">${formatRp(totalHargaDefault)}</td>
          </tr>
        </tbody>
      </table>
    </div>`
  })

  const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${titleText}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4 portrait;
      margin: 1.5cm 1.5cm 1.5cm 1.5cm;
    }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.2;
      color: #000;
    }
    h2 {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 20px;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background-color: #F2F2F2;
      font-weight: bold;
      text-align: center;
      border: 1px solid #000;
      padding: 6px 4px;
      font-size: 10pt;
    }
    td {
      border: 1px solid #000;
      padding: 5px 6px;
      font-size: 10pt;
      vertical-align: middle;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .total-row {
      font-weight: bold;
      background-color: #EEEEEE;
    }
  </style>
</head>
<body>
  <h2>${titleText}</h2>
  ${contentHtml}
</body>
</html>
`

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' })
  downloadFile(blob, `Daftar_Harga_Kitab_${year}.doc`)
}

function formatKategoriPemasukan(kat: string): string {
  if (kat === 'PINJAMAN_MODAL') return 'Pinjaman Modal'
  if (kat === 'LAINNYA') return 'Lainnya'
  return 'Setoran Penjualan'
}

function formatKategoriPengeluaran(kat: string): string {
  const map: Record<string, string> = {
    KONSUMSI: 'Konsumsi',
    TRANSPORT: 'Transport',
    BAYAR_HUTANG_TOKO: 'Bayar Hutang Toko',
    BAYAR_PINJAMAN_MODAL: 'Bayar Pinjaman Modal',
    ROYALTI_PENULIS: 'Royalti Penulis',
    KITAB_GRATIS: 'Kitab Gratis',
    OPERASIONAL: 'Operasional',
    LAINNYA: 'Lainnya',
  }
  return map[kat] || kat
}

// ── EXPORT EXCEL: REKAP PEMASUKAN ─────────────────────────────────────────────


export async function exportRekapPemasukanExcel(items: RekapPemasukanItem[], subtitle?: string) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const worksheet = XLSX.utils.aoa_to_sheet([])
  let maxRow = 1

  const setCell = (row: number, col: number, val: string | number, style: any, formula?: string) => {
    const addr = cellAddress(row, col)
    worksheet[addr] = {
      t: typeof val === 'number' ? 'n' : 's',
      v: val,
      ...(formula ? { f: formula } : {}),
      s: style,
    }
    maxRow = Math.max(maxRow, row)
  }

  const titleText = 'LAPORAN PEMASUKAN KAS UPK'

  const titleStyle = {
    font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const subtitleStyle = {
    font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '555555' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const headerStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  }
  const centerStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const leftStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'left', vertical: 'center' },
  }
  const currencyStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalLabelStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const totalValueStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []

  setCell(1, 0, titleText, titleStyle)
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } })

  let startDataRow = 3
  if (subtitle) {
    setCell(2, 0, subtitle, subtitleStyle)
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 8 } })
    startDataRow = 4
  }

  const headerRow = startDataRow
  const firstItemRow = headerRow + 1

  setCell(headerRow, 0, 'NO', headerStyle)
  setCell(headerRow, 1, 'TANGGAL & WAKTU', headerStyle)
  setCell(headerRow, 2, 'KATEGORI', headerStyle)
  setCell(headerRow, 3, 'SUMBER / PEMBERI', headerStyle)
  setCell(headerRow, 4, 'NOMINAL DICATAT', headerStyle)
  setCell(headerRow, 5, 'PENJUALAN SEHARUSNYA', headerStyle)
  setCell(headerRow, 6, 'SELISIH', headerStyle)
  setCell(headerRow, 7, 'CATATAN', headerStyle)
  setCell(headerRow, 8, 'PETUGAS', headerStyle)

  items.forEach((item, index) => {
    const row = firstItemRow + index
    setCell(row, 0, index + 1, centerStyle)
    setCell(row, 1, `${item.tanggal} ${item.waktu_catat ? item.waktu_catat.slice(11, 16) : ''}`.trim(), centerStyle)
    setCell(row, 2, formatKategoriPemasukan(item.kategori), leftStyle)
    setCell(row, 3, item.sumber || '-', leftStyle)
    setCell(row, 4, item.nominal, currencyStyle)
    setCell(row, 5, item.kategori === 'SETORAN_PENJUALAN' ? item.penjualan_seharusnya : 0, currencyStyle)
    setCell(row, 6, item.kategori === 'SETORAN_PENJUALAN' ? item.selisih : 0, currencyStyle, `E${row}-F${row}`)
    setCell(row, 7, item.catatan || '-', leftStyle)
    setCell(row, 8, item.user_name || '-', centerStyle)
  })

  const totalRow = firstItemRow + items.length
  setCell(totalRow, 0, 'JUMLAH TOTAL', totalLabelStyle)
  setCell(totalRow, 1, '', totalLabelStyle)
  setCell(totalRow, 2, '', totalLabelStyle)
  setCell(totalRow, 3, '', totalLabelStyle)
  merges.push({ s: { r: totalRow - 1, c: 0 }, e: { r: totalRow - 1, c: 3 } })

  const totalNominal = items.reduce((acc, i) => acc + i.nominal, 0)
  const totalSeharusnya = items.reduce((acc, i) => acc + (i.kategori === 'SETORAN_PENJUALAN' ? i.penjualan_seharusnya : 0), 0)
  const totalSelisih = items.reduce((acc, i) => acc + (i.kategori === 'SETORAN_PENJUALAN' ? i.selisih : 0), 0)

  setCell(totalRow, 4, totalNominal, totalValueStyle, `SUM(E${firstItemRow}:E${totalRow - 1})`)
  setCell(totalRow, 5, totalSeharusnya, totalValueStyle, `SUM(F${firstItemRow}:F${totalRow - 1})`)
  setCell(totalRow, 6, totalSelisih, totalValueStyle, `SUM(G${firstItemRow}:G${totalRow - 1})`)
  setCell(totalRow, 7, '', totalLabelStyle)
  setCell(totalRow, 8, '', totalLabelStyle)

  worksheet['!ref'] = `A1:I${maxRow}`
  worksheet['!merges'] = merges
  worksheet['!cols'] = [
    { wch: 6 },   // A: NO
    { wch: 20 },  // B: TANGGAL
    { wch: 20 },  // C: KATEGORI
    { wch: 24 },  // D: SUMBER
    { wch: 20 },  // E: NOMINAL
    { wch: 22 },  // F: SEHARUSNYA
    { wch: 18 },  // G: SELISIH
    { wch: 30 },  // H: CATATAN
    { wch: 18 },  // I: PETUGAS
  ]
  worksheet['!rows'] = Array.from({ length: maxRow }, (_, i) => ({
    hpt: i === 0 ? 24 : i === headerRow - 1 ? 22 : 20,
  }))

  worksheet['!pageSetup'] = { paperSize: 9, orientation: 'landscape', fitToWidth: 1 }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pemasukan UPK')
  XLSX.writeFile(workbook, `Laporan_Pemasukan_UPK_${new Date().toISOString().slice(0, 10)}.xlsx`, { cellStyles: true })
}

// ── EXPORT WORD: REKAP PEMASUKAN ──────────────────────────────────────────────

export function exportRekapPemasukanWord(items: RekapPemasukanItem[], subtitle?: string) {
  const titleText = 'LAPORAN PEMASUKAN KAS UPK'
  const totalNominal = items.reduce((acc, i) => acc + i.nominal, 0)
  const totalSeharusnya = items.reduce((acc, i) => acc + (i.kategori === 'SETORAN_PENJUALAN' ? i.penjualan_seharusnya : 0), 0)
  const totalSelisih = items.reduce((acc, i) => acc + (i.kategori === 'SETORAN_PENJUALAN' ? i.selisih : 0), 0)

  const tableRowsHtml = items
    .map(
      (item, idx) => `
    <tr>
      <td class="text-center">${idx + 1}</td>
      <td class="text-center">${item.tanggal}</td>
      <td class="text-left">${formatKategoriPemasukan(item.kategori)}</td>
      <td class="text-left">${item.sumber || '-'}</td>
      <td class="text-right font-bold">${formatRp(item.nominal)}</td>
      <td class="text-right">${item.kategori === 'SETORAN_PENJUALAN' ? formatRp(item.penjualan_seharusnya) : '-'}</td>
      <td class="text-right">${item.kategori === 'SETORAN_PENJUALAN' ? formatRp(item.selisih) : '-'}</td>
      <td class="text-left">${item.catatan || '-'}</td>
      <td class="text-center">${item.user_name || '-'}</td>
    </tr>`
    )
    .join('')

  const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${titleText}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4 landscape;
      margin: 1.5cm 1.5cm 1.5cm 1.5cm;
    }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 10pt;
      line-height: 1.2;
      color: #000;
    }
    h2 {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    p.subtitle {
      text-align: center;
      font-size: 10pt;
      font-style: italic;
      margin-top: 0;
      margin-bottom: 16px;
      color: #444;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th {
      background-color: #D9D9D9;
      font-weight: bold;
      text-align: center;
      border: 1px solid #000;
      padding: 6px 4px;
      font-size: 9pt;
    }
    td {
      border: 1px solid #000;
      padding: 5px 6px;
      font-size: 9pt;
      vertical-align: middle;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .total-row {
      font-weight: bold;
      background-color: #F2F2F2;
    }
  </style>
</head>
<body>
  <h2>${titleText}</h2>
  ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
  <table>
    <thead>
      <tr>
        <th style="width: 4%;">NO</th>
        <th style="width: 10%;">TANGGAL</th>
        <th style="width: 14%;">KATEGORI</th>
        <th style="width: 14%;">SUMBER / PEMBERI</th>
        <th style="width: 12%;">NOMINAL</th>
        <th style="width: 13%;">PENJUALAN</th>
        <th style="width: 11%;">SELISIH</th>
        <th style="width: 14%;">CATATAN</th>
        <th style="width: 8%;">PETUGAS</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
      <tr class="total-row">
        <td colspan="4" class="text-center">JUMLAH TOTAL</td>
        <td class="text-right">${formatRp(totalNominal)}</td>
        <td class="text-right">${formatRp(totalSeharusnya)}</td>
        <td class="text-right">${formatRp(totalSelisih)}</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' })
  downloadFile(blob, `Laporan_Pemasukan_UPK_${new Date().toISOString().slice(0, 10)}.doc`)
}

// ── EXPORT EXCEL: REKAP PENGELUARAN ───────────────────────────────────────────

export async function exportRekapPengeluaranExcel(items: RekapPengeluaranItem[], subtitle?: string) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const worksheet = XLSX.utils.aoa_to_sheet([])
  let maxRow = 1

  const setCell = (row: number, col: number, val: string | number, style: any, formula?: string) => {
    const addr = cellAddress(row, col)
    worksheet[addr] = {
      t: typeof val === 'number' ? 'n' : 's',
      v: val,
      ...(formula ? { f: formula } : {}),
      s: style,
    }
    maxRow = Math.max(maxRow, row)
  }

  const titleText = 'LAPORAN PENGELUARAN KAS UPK'

  const titleStyle = {
    font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const subtitleStyle = {
    font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '555555' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const headerStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'D9D9D9' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  }
  const centerStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const leftStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'left', vertical: 'center' },
  }
  const currencyStyle = {
    font: { name: 'Arial Narrow', sz: 11, color: { rgb: '000000' } },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }
  const totalLabelStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
    border: thinBorder,
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  const totalValueStyle = {
    font: { name: 'Arial Narrow', sz: 11, bold: true, color: { rgb: '000000' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F2F2F2' } },
    border: thinBorder,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: CURRENCY_FORMAT,
  }

  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []

  setCell(1, 0, titleText, titleStyle)
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } })

  let startDataRow = 3
  if (subtitle) {
    setCell(2, 0, subtitle, subtitleStyle)
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 7 } })
    startDataRow = 4
  }

  const headerRow = startDataRow
  const firstItemRow = headerRow + 1

  setCell(headerRow, 0, 'NO', headerStyle)
  setCell(headerRow, 1, 'TANGGAL & WAKTU', headerStyle)
  setCell(headerRow, 2, 'KATEGORI', headerStyle)
  setCell(headerRow, 3, 'PENERIMA / TUJUAN', headerStyle)
  setCell(headerRow, 4, 'NOMINAL KELUAR', headerStyle)
  setCell(headerRow, 5, 'KITAB TERKAI', headerStyle)
  setCell(headerRow, 6, 'CATATAN', headerStyle)
  setCell(headerRow, 7, 'PETUGAS', headerStyle)

  items.forEach((item, index) => {
    const row = firstItemRow + index
    setCell(row, 0, index + 1, centerStyle)
    setCell(row, 1, `${item.tanggal} ${item.waktu_catat ? item.waktu_catat.slice(11, 16) : ''}`.trim(), centerStyle)
    setCell(row, 2, formatKategoriPengeluaran(item.kategori), leftStyle)
    setCell(row, 3, item.penerima || '-', leftStyle)
    setCell(row, 4, item.nominal, currencyStyle)
    setCell(row, 5, item.nama_kitab || '-', leftStyle)
    setCell(row, 6, item.catatan || '-', leftStyle)
    setCell(row, 7, item.user_name || '-', centerStyle)
  })

  const totalRow = firstItemRow + items.length
  setCell(totalRow, 0, 'JUMLAH TOTAL', totalLabelStyle)
  setCell(totalRow, 1, '', totalLabelStyle)
  setCell(totalRow, 2, '', totalLabelStyle)
  setCell(totalRow, 3, '', totalLabelStyle)
  merges.push({ s: { r: totalRow - 1, c: 0 }, e: { r: totalRow - 1, c: 3 } })

  const totalNominal = items.reduce((acc, i) => acc + i.nominal, 0)

  setCell(totalRow, 4, totalNominal, totalValueStyle, `SUM(E${firstItemRow}:E${totalRow - 1})`)
  setCell(totalRow, 5, '', totalLabelStyle)
  setCell(totalRow, 6, '', totalLabelStyle)
  setCell(totalRow, 7, '', totalLabelStyle)

  worksheet['!ref'] = `A1:H${maxRow}`
  worksheet['!merges'] = merges
  worksheet['!cols'] = [
    { wch: 6 },   // A: NO
    { wch: 20 },  // B: TANGGAL
    { wch: 22 },  // C: KATEGORI
    { wch: 24 },  // D: PENERIMA
    { wch: 20 },  // E: NOMINAL
    { wch: 24 },  // F: KITAB TERKAIT
    { wch: 30 },  // G: CATATAN
    { wch: 18 },  // H: PETUGAS
  ]
  worksheet['!rows'] = Array.from({ length: maxRow }, (_, i) => ({
    hpt: i === 0 ? 24 : i === headerRow - 1 ? 22 : 20,
  }))

  worksheet['!pageSetup'] = { paperSize: 9, orientation: 'landscape', fitToWidth: 1 }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pengeluaran UPK')
  XLSX.writeFile(workbook, `Laporan_Pengeluaran_UPK_${new Date().toISOString().slice(0, 10)}.xlsx`, { cellStyles: true })
}

// ── EXPORT WORD: REKAP PENGELUARAN ───────────────────────────────────────────

export function exportRekapPengeluaranWord(items: RekapPengeluaranItem[], subtitle?: string) {
  const titleText = 'LAPORAN PENGELUARAN KAS UPK'
  const totalNominal = items.reduce((acc, i) => acc + i.nominal, 0)

  const tableRowsHtml = items
    .map(
      (item, idx) => `
    <tr>
      <td class="text-center">${idx + 1}</td>
      <td class="text-center">${item.tanggal}</td>
      <td class="text-left">${formatKategoriPengeluaran(item.kategori)}</td>
      <td class="text-left">${item.penerima || '-'}</td>
      <td class="text-right font-bold">${formatRp(item.nominal)}</td>
      <td class="text-left">${item.nama_kitab || '-'}</td>
      <td class="text-left">${item.catatan || '-'}</td>
      <td class="text-center">${item.user_name || '-'}</td>
    </tr>`
    )
    .join('')

  const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${titleText}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4 landscape;
      margin: 1.5cm 1.5cm 1.5cm 1.5cm;
    }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 10pt;
      line-height: 1.2;
      color: #000;
    }
    h2 {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    p.subtitle {
      text-align: center;
      font-size: 10pt;
      font-style: italic;
      margin-top: 0;
      margin-bottom: 16px;
      color: #444;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th {
      background-color: #D9D9D9;
      font-weight: bold;
      text-align: center;
      border: 1px solid #000;
      padding: 6px 4px;
      font-size: 9pt;
    }
    td {
      border: 1px solid #000;
      padding: 5px 6px;
      font-size: 9pt;
      vertical-align: middle;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .total-row {
      font-weight: bold;
      background-color: #F2F2F2;
    }
  </style>
</head>
<body>
  <h2>${titleText}</h2>
  ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
  <table>
    <thead>
      <tr>
        <th style="width: 4%;">NO</th>
        <th style="width: 11%;">TANGGAL</th>
        <th style="width: 15%;">KATEGORI</th>
        <th style="width: 16%;">PENERIMA / TUJUAN</th>
        <th style="width: 14%;">NOMINAL KELUAR</th>
        <th style="width: 15%;">KITAB TERKAIT</th>
        <th style="width: 16%;">CATATAN</th>
        <th style="width: 9%;">PETUGAS</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
      <tr class="total-row">
        <td colspan="4" class="text-center">JUMLAH TOTAL</td>
        <td class="text-right">${formatRp(totalNominal)}</td>
        <td colspan="3"></td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' })
  downloadFile(blob, `Laporan_Pengeluaran_UPK_${new Date().toISOString().slice(0, 10)}.doc`)
}

