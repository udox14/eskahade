// Ekspor RAB EHB ke Excel (.xlsx) — sel teks/angka asli (bukan gambar), nominal numerik agar bisa dijumlahkan.
// Tata letak mengikuti versi cetak PDF: kop, tabel per kategori + subtotal, TOTAL RAB, 3 penandatangan.

export type RabExportLine = {
  nama: string
  qty: number
  harga: number
  total: number
  keterangan: string
  /** Baris judul (mis. header honor pemeriksaan) — tanpa angka. */
  isHeader?: boolean
}

export type RabExportCategory = {
  title: string
  lines: RabExportLine[]
  subtotal: number
}

export type RabExportInput = {
  semester: number
  tahunAjaran: string
  categories: RabExportCategory[]
  grandTotal: number
  ketuaPelaksana: string
  wakilAkademik: string
  wakilKeuangan: string
}

type CellStyle = Record<string, unknown>

const RUPIAH_FORMAT = '"Rp" #,##0'
const COLS = 6

const border = (rgb = '000000') => ({
  top: { style: 'thin', color: { rgb } },
  bottom: { style: 'thin', color: { rgb } },
  left: { style: 'thin', color: { rgb } },
  right: { style: 'thin', color: { rgb } },
})

function colName(index: number) {
  return String.fromCharCode(65 + index)
}

export async function exportRabExcel(input: RabExportInput) {
  const XLSXModule = await import('xlsx-js-style')
  const XLSX = XLSXModule.default ?? XLSXModule
  const ws: Record<string, unknown> = {}
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
  const rowHeights: { hpt: number }[] = []
  let r = 0

  const put = (row: number, col: number, value: string | number, style: CellStyle) => {
    const isNum = typeof value === 'number'
    ws[`${colName(col)}${row + 1}`] = {
      t: isNum ? 'n' : 's',
      v: value,
      ...(isNum && style.numFmt ? { z: style.numFmt } : {}),
      s: style,
    }
  }
  const fillRow = (row: number, from: number, to: number, style: CellStyle) => {
    for (let c = from; c <= to; c++) if (!ws[`${colName(c)}${row + 1}`]) put(row, c, '', style)
  }
  const mergeRow = (row: number, from: number, to: number) => {
    if (to > from) merges.push({ s: { r: row, c: from }, e: { r: row, c: to } })
  }
  const height = (row: number, hpt: number) => { rowHeights[row] = { hpt } }

  const semesterLabel = input.semester === 1 ? 'SEMESTER GANJIL' : 'SEMESTER GENAP'
  const centerTitle = (text: string, sz: number, bold: boolean, hpt: number) => {
    put(r, 0, text, { font: { name: 'Arial', sz, bold }, alignment: { horizontal: 'center', vertical: 'center' } })
    mergeRow(r, 0, COLS - 1)
    height(r, hpt)
    r++
  }

  // Kop
  centerTitle('EVALUASI HASIL BELAJAR', 16, true, 24)
  centerTitle(`${semesterLabel} T.A. ${input.tahunAjaran}`, 12, false, 18)
  centerTitle('LEMBAGA PENDIDIKAN PONDOK PESANTREN SUKAHIDENG', 10, false, 15)
  fillRow(r - 1, 0, COLS - 1, { border: { bottom: { style: 'medium', color: { rgb: '000000' } } } })
  // garis bawah kop: gaya sel gabungan perlu di tiap sel
  for (let c = 0; c < COLS; c++) {
    const cell = ws[`${colName(c)}${r}`] as { s: CellStyle }
    cell.s = { ...cell.s, border: { bottom: { style: 'medium', color: { rgb: '000000' } } } }
  }
  r++
  centerTitle('RENCANA ANGGARAN BELANJA', 13, true, 22)

  // Header tabel
  const th: CellStyle = {
    font: { name: 'Arial', sz: 10, bold: true },
    fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } },
    border: border(),
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  }
  ;['NO', 'URAIAN', 'QTY', 'HARGA', 'JUMLAH', 'KETERANGAN'].forEach((label, c) => put(r, c, label, th))
  height(r, 20)
  r++

  const td = (extra: CellStyle = {}): CellStyle => ({
    font: { name: 'Arial', sz: 10 },
    border: border(),
    alignment: { vertical: 'top', wrapText: true },
    ...extra,
  })
  const tdCenter = td({ alignment: { horizontal: 'center', vertical: 'top', wrapText: true } })
  const tdMoney = td({ numFmt: RUPIAH_FORMAT, alignment: { horizontal: 'right', vertical: 'top' } })

  for (const category of input.categories) {
    // Judul kategori
    put(r, 0, category.title.toUpperCase(), td({
      font: { name: 'Arial', sz: 10, bold: true },
      fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
    }))
    fillRow(r, 1, COLS - 1, td({ fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } } }))
    mergeRow(r, 0, COLS - 1)
    r++

    if (category.lines.length === 0) {
      put(r, 0, '-', tdCenter); put(r, 1, '-', td()); put(r, 2, '-', tdCenter)
      put(r, 3, '-', td({ alignment: { horizontal: 'right' } })); put(r, 4, '-', td({ alignment: { horizontal: 'right' } }))
      put(r, 5, '-', td())
      r++
    } else {
      category.lines.forEach((line, index) => {
        put(r, 0, index + 1, tdCenter)
        if (line.isHeader) {
          const headStyle = td({ font: { name: 'Arial', sz: 10, bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } } })
          put(r, 1, line.nama, headStyle)
          fillRow(r, 2, COLS - 1, headStyle)
          mergeRow(r, 1, COLS - 1)
        } else {
          put(r, 1, line.nama, td())
          put(r, 2, line.qty, td({ numFmt: '#,##0', alignment: { horizontal: 'center', vertical: 'top' } }))
          put(r, 3, line.harga, tdMoney)
          put(r, 4, line.total, tdMoney)
          put(r, 5, line.keterangan || '-', td())
          // Perkiraan tinggi baris untuk teks panjang (wrap tidak auto-height di semua viewer)
          const lines = Math.max(Math.ceil(line.nama.length / 48), Math.ceil((line.keterangan || '').length / 26), 1)
          if (lines > 1) height(r, 14 * lines)
        }
        r++
      })
    }

    // Subtotal
    const sub = { font: { name: 'Arial', sz: 10, bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } } }
    put(r, 0, `Subtotal ${category.title}`, td({ ...sub, alignment: { horizontal: 'right', vertical: 'center' } }))
    fillRow(r, 1, 3, td(sub))
    mergeRow(r, 0, 3)
    put(r, 4, category.subtotal, td({ ...sub, numFmt: RUPIAH_FORMAT, alignment: { horizontal: 'right', vertical: 'center' } }))
    put(r, 5, '', td(sub))
    r++
  }

  // Total
  const dark = { font: { name: 'Arial', sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '111827' } } }
  put(r, 0, 'TOTAL RAB', td({ ...dark, alignment: { horizontal: 'right', vertical: 'center' } }))
  fillRow(r, 1, 3, td(dark))
  mergeRow(r, 0, 3)
  put(r, 4, input.grandTotal, td({ ...dark, numFmt: RUPIAH_FORMAT, alignment: { horizontal: 'right', vertical: 'center' } }))
  put(r, 5, '', td(dark))
  height(r, 22)
  r += 3

  // Tanda tangan: 3 blok, masing-masing 2 kolom
  const signers = [
    { title: 'Ketua Pelaksana EHB', name: input.ketuaPelaksana },
    { title: 'Wakil Pimpinan Bid. Akademik', name: input.wakilAkademik },
    { title: 'Wakil Pimpinan Bid. Administrasi dan Keuangan', name: input.wakilKeuangan },
  ]
  const sigBase: CellStyle = { font: { name: 'Arial', sz: 10 }, alignment: { horizontal: 'center', vertical: 'top', wrapText: true } }
  signers.forEach((signer, i) => {
    const c = i * 2
    put(r, c, signer.title, sigBase)
    put(r, c + 1, '', sigBase)
    mergeRow(r, c, c + 1)
    put(r + 4, c, signer.name || '................................', { ...sigBase, font: { name: 'Arial', sz: 10, bold: true } })
    put(r + 4, c + 1, '', sigBase)
    mergeRow(r + 4, c, c + 1)
  })
  height(r, 32)
  for (let k = 1; k <= 3; k++) height(r + k, 18)
  height(r + 4, 18)
  const lastRow = r + 4

  ws['!ref'] = `A1:${colName(COLS - 1)}${lastRow + 1}`
  ws['!merges'] = merges
  ws['!rows'] = rowHeights
  ws['!cols'] = [{ wch: 5 }, { wch: 46 }, { wch: 9 }, { wch: 18 }, { wch: 18 }, { wch: 28 }]
  ws['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws as never, 'RAB EHB')
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `RAB-EHB-${input.tahunAjaran.replace(/[^\w-]+/g, '-')}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
