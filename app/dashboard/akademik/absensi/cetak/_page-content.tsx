'use client'

import { useState, useRef } from 'react'
import { getRekapAlfaMingguan, type RekapAlfaRow, type FilteredRow } from './actions'
import { PemanggilanView } from './pemanggilan-view'
import { useReactToPrint } from 'react-to-print'
import { Printer, Search, Loader2, ArrowLeft, FileSpreadsheet } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ─── Helper: hitung range minggu (Rabu–Selasa) ─────────────────────────────
const getWeekRange = (date: Date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day < 3 ? day + 7 : day) - 3
  d.setDate(d.getDate() - diff)
  const start = new Date(d)
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  return { start, end }
}

// ─── Helper: generate & download CSV (zero dependency) ──────────────────────
function exportToCSV(
  rekap: RekapAlfaRow[],
  filteredRows: FilteredRow[],
  periode: { start: Date; end: Date },
  filename: string
) {
  const DAY_NAMES = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

  // Daftar hari dalam range minggu
  const days: Date[] = []
  const d = new Date(periode.start)
  while (d <= periode.end) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }

  // Lookup: nis -> tanggal -> { shubuh, ashar, maghrib }
  const lookup: Record<string, Record<string, FilteredRow>> = {}
  filteredRows.forEach((row) => {
    if (!lookup[row.nis]) lookup[row.nis] = {}
    lookup[row.nis][row.tanggal] = row
  })

  // Header row
  const headers = ['No', 'Nama', 'Asrama', 'Kamar', 'Sekolah', 'Kelas Sekolah', 'Kelas Pesantren']
  days.forEach((day) => {
    const dd = String(day.getDate()).padStart(2, '0')
    const mm = String(day.getMonth() + 1).padStart(2, '0')
    const label = `${DAY_NAMES[day.getDay()]} ${dd}/${mm}`
    headers.push(`${label} - Shubuh`)
    headers.push(`${label} - Ashar`)
    headers.push(`${label} - Maghrib`)
  })
  headers.push('Total Alfa')

  // Data rows (diurutkan: asrama lalu nama)
  const sorted = [...rekap].sort((a, b) =>
    a.asrama.localeCompare(b.asrama) || a.nama.localeCompare(b.nama)
  )

  const dataRows = sorted.map((item, idx) => {
    const cells: (string | number)[] = [
      idx + 1,
      item.nama,
      item.asrama,
      item.kamar,
      item.sekolah,
      item.kelas_sekolah,
      item.kelas,
    ]
    days.forEach((day) => {
      const tanggal = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      const dayRow = lookup[item.nis]?.[tanggal]
      cells.push(dayRow?.shubuh  === 'A' ? 'A' : '')
      cells.push(dayRow?.ashar   === 'A' ? 'A' : '')
      cells.push(dayRow?.maghrib === 'A' ? 'A' : '')
    })
    cells.push(item.total)
    return cells
  })

  // Build CSV string with UTF-8 BOM agar Excel langsung baca encoding-nya
  const BOM = '\uFEFF'
  const csvContent = [headers, ...dataRows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\r\n')

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CetakPemanggilanPage() {
  const router = useRouter()
  const [tglRef, setTglRef] = useState(new Date().toISOString().split('T')[0])
  const [tglPanggil, setTglPanggil] = useState(new Date().toISOString().split('T')[0])

  const [rekap, setRekap] = useState<RekapAlfaRow[]>([])
  const [filteredRows, setFilteredRows] = useState<FilteredRow[]>([])
  const [loading, setLoading] = useState(false)
  const [periode, setPeriode] = useState<{ start: Date; end: Date } | null>(null)

  const printRef = useRef(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Pemanggilan_Alfa_${tglRef}`,
  })

  const handleLoad = async () => {
    setLoading(true)
    const res = await getRekapAlfaMingguan(tglRef)
    setRekap(res.rekap)
    setFilteredRows(res.filteredRows)
    setPeriode(getWeekRange(new Date(tglRef)))
    setLoading(false)
  }

  const handleExportCSV = () => {
    if (!periode || rekap.length === 0) return
    const tglStr = tglRef
    exportToCSV(rekap, filteredRows, periode, `Rekap_Alfa_${tglStr}.csv`)
  }

  const groupedData = rekap.reduce((groups, item) => {
    const asrama = item.asrama || 'NON-ASRAMA'
    if (!groups[asrama]) groups[asrama] = []
    groups[asrama].push(item)
    return groups
  }, {} as Record<string, RekapAlfaRow[]>)

  const sortedAsramaKeys = Object.keys(groupedData).sort()

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-4 print:hidden">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cetak Pemanggilan Alfa</h1>
          <p className="text-slate-500 text-sm">Rekap santri yang alfa dalam satu pekan pengajian.</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-6 rounded-xl border flex flex-col md:flex-row gap-6 items-end shadow-sm print:hidden">
        <div className="w-full md:w-1/3">
          <label className="text-sm font-bold text-slate-700 block mb-1">
            1. Pilih Minggu (Tanggal Salah Satu Hari)
          </label>
          <input
            type="date"
            className="w-full p-2 border border-slate-200 rounded-xl"
            value={tglRef}
            onChange={(e) => setTglRef(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">Otomatis deteksi periode Rabu – Selasa</p>
        </div>

        <div className="w-full md:w-1/3">
          <label className="text-sm font-bold text-slate-700 block mb-1">
            2. Tanggal Eksekusi / Pemanggilan
          </label>
          <input
            type="date"
            className="w-full p-2 border border-slate-200 rounded-xl"
            value={tglPanggil}
            onChange={(e) => setTglPanggil(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">Tanggal ini akan muncul di surat</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={handleLoad}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Tampilkan Data
          </button>

          {rekap.length > 0 && (
            <>
              <button
                onClick={() => handlePrint()}
                className="bg-green-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-green-800"
              >
                <Printer className="w-4 h-4" /> Cetak PDF
              </button>

              <button
                onClick={handleExportCSV}
                className="bg-emerald-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* PREVIEW AREA */}
      <div className="bg-slate-100 p-8 rounded-xl border overflow-auto min-h-[500px] flex justify-center print:p-0 print:bg-white print:rounded-none print:border-none">
        {!periode ? (
          <div className="text-center text-slate-400 py-20">Silakan pilih tanggal dan klik Tampilkan.</div>
        ) : rekap.length === 0 ? (
          <div className="text-center text-slate-400 py-20">Tidak ada data alfa pada periode ini.</div>
        ) : (
          <div ref={printRef}>
            {sortedAsramaKeys.map((asrama, i) => (
              <div
                key={asrama}
                style={{ pageBreakAfter: i < sortedAsramaKeys.length - 1 ? 'always' : 'avoid' }}
                className="mb-8 last:mb-0 print:mb-0"
              >
                <PemanggilanView
                  data={groupedData[asrama]}
                  periode={periode}
                  tglPanggil={new Date(tglPanggil)}
                  namaAsrama={asrama}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}