'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getDaftarCetakRapor,
  getDataIdentitas,
  getDataRapor,
  getKelasList,
  getLegerRaporData,
  getTahunAjaranList,
} from './actions'
import { IdentitasSantriHalaman } from './identitas-view'
import { RaporSatuHalaman } from './rapor-view'
import { useReactToPrint } from '@/lib/pdf/client'
import {
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  IdCard,
  Loader2,
  Printer,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'

type PrintKind = 'rapor' | 'identitas'

export default function CetakRaporPage() {
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([])
  const [selectedTA, setSelectedTA] = useState<number | undefined>(undefined)
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [tahunAjaran, setTahunAjaran] = useState('')

  const [daftar, setDaftar] = useState<any[]>([])
  const [dataRapor, setDataRapor] = useState<any[]>([])
  const [dataIdentitas, setDataIdentitas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const [printKind, setPrintKind] = useState<PrintKind>('rapor')
  const [printRows, setPrintRows] = useState<any[]>([])
  const [printTitle, setPrintTitle] = useState('Cetak_Rapor')
  const [printQueued, setPrintQueued] = useState(false)
  const printRef = useRef<HTMLDivElement | null>(null)

  const selectedKelasName = useMemo(() => {
    return kelasList.find(k => k.id === selectedKelas)?.nama_kelas || 'Kelas'
  }, [kelasList, selectedKelas])

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: printTitle,
    onAfterPrint: () => {
      toast.success('Dokumen dikirim ke printer.')
    },
    onPrintError: () => {
      toast.error('Gagal mencetak dokumen.')
    },
  })

  useEffect(() => {
    getTahunAjaranList().then(list => {
      setTahunAjaranList(list)
      const aktif = list.find((t: any) => t.is_active === 1)
      if (aktif) setSelectedTA(aktif.id)
    })
  }, [])

  useEffect(() => {
    if (!selectedTA) return
    const ta = tahunAjaranList.find((t: any) => Number(t.id) === Number(selectedTA))
    if (ta) setTahunAjaran(ta.nama)
    setSelectedKelas('')
    setDaftar([])
    setDataRapor([])
    setDataIdentitas([])
    getKelasList(selectedTA).then(setKelasList)
  }, [selectedTA, tahunAjaranList])

  useEffect(() => {
    if (!printQueued || printRows.length === 0) return

    const timer = window.setTimeout(() => {
      toast.info('Menyiapkan dokumen untuk dicetak...')
      handlePrint()
      setPrintQueued(false)
    }, 80)

    return () => window.clearTimeout(timer)
  }, [handlePrint, printQueued, printRows])

  const handleLoad = async () => {
    if (!selectedKelas) {
      toast.warning('Mohon pilih Kelas terlebih dahulu.')
      return
    }

    setLoading(true)
    const loadToast = toast.loading('Mengambil daftar santri dan data cetak...')
    setDaftar([])
    setDataRapor([])
    setDataIdentitas([])
    setPrintRows([])

    try {
      const semester = Number(selectedSemester)
      const [list, rapor, identitas] = await Promise.all([
        getDaftarCetakRapor(selectedKelas, semester),
        getDataRapor(selectedKelas, semester),
        getDataIdentitas(selectedKelas),
      ])

      setDaftar(list.siswa || [])
      setDataRapor(rapor || [])
      setDataIdentitas(identitas || [])

      if (!list.siswa?.length) {
        toast.info('Data Kosong', { description: 'Belum ada santri aktif di kelas ini.' })
      } else {
        toast.success('Data Siap', { description: `Berhasil memuat ${list.siswa.length} santri.` })
      }
    } catch (error) {
      console.error(error)
      toast.error('Terjadi Kesalahan', { description: 'Gagal mengambil data dari server.' })
    } finally {
      setLoading(false)
      toast.dismiss(loadToast)
    }
  }

  const queuePrint = (kind: PrintKind, rows: any[], title: string) => {
    if (!rows.length) {
      toast.warning('Tidak ada data untuk dicetak.')
      return
    }

    setPrintKind(kind)
    setPrintRows(rows)
    setPrintTitle(title)
    setPrintQueued(true)
  }

  const printRaporOne = (row: any) => {
    const rapor = dataRapor.find(item => item.id === row.riwayat_id)
    queuePrint('rapor', rapor ? [rapor] : [], `Rapor_${row.nama}_Smt${selectedSemester}`)
  }

  const printIdentitasOne = (row: any) => {
    const identitas = dataIdentitas.find(item => item.riwayat_id === row.riwayat_id)
    queuePrint('identitas', identitas ? [identitas] : [], `Identitas_${row.nama}`)
  }

  const handleExportLeger = async () => {
    if (!selectedKelas) return toast.warning('Pilih kelas terlebih dahulu.')

    setIsExporting(true)
    const toastId = toast.loading('Download leger Excel...')

    try {
      const XLSX = await import('xlsx')
      const dataLeger = await getLegerRaporData(selectedKelas, Number(selectedSemester))

      if (!dataLeger.siswa.length) {
        toast.info('Data leger kosong.')
        return
      }

      const headers = [
        'No',
        'NIS',
        'Nama Santri',
        ...dataLeger.mapel.map((m: any) => m.nama),
        'Jumlah',
        'Rata-rata',
        'Ranking',
      ]
      const rows = dataLeger.siswa.map((s: any, idx: number) => {
        const rowData: any[] = [idx + 1, s.nis, s.nama]
        dataLeger.mapel.forEach((m: any) => rowData.push(s.nilai[m.id] || ''))
        rowData.push(s.jumlah || '', s.rata || '', s.rank || '')
        return rowData
      })

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      ws['!cols'] = headers.map((header) => ({ wch: header === 'Nama Santri' ? 28 : 14 }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `Leger ${selectedKelasName}`)
      XLSX.writeFile(wb, `Leger_${selectedKelasName}_Semester_${selectedSemester}.xlsx`)
      toast.success('Leger berhasil didownload.')
    } catch (error) {
      console.error(error)
      toast.error('Gagal export leger.')
    } finally {
      setIsExporting(false)
      toast.dismiss(toastId)
    }
  }

  const hasData = daftar.length > 0

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-6">
      <div className="flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cetak Rapor Santri</h1>
          <p className="text-sm text-slate-500">Pilih kelas, lalu cetak rapor atau identitas per santri.</p>
        </div>
        {hasData ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={() => queuePrint('rapor', dataRapor, `Rapor_${selectedKelasName}_Smt${selectedSemester}`)}
              className="flex items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-800"
            >
              <Printer className="h-4 w-4" /> Cetak Semua Rapor
            </button>
            <button
              onClick={() => queuePrint('identitas', dataIdentitas, `Identitas_${selectedKelasName}`)}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-900"
            >
              <IdCard className="h-4 w-4" /> Cetak Semua Identitas
            </button>
            <button
              onClick={handleExportLeger}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Leger Excel
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-none flex-col items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden md:flex-row">
        <div className="w-full md:w-auto">
          <label className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700">
            <CalendarDays className="h-4 w-4 text-slate-400" /> Tahun Ajaran
          </label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none focus:ring-2 focus:ring-blue-500 md:w-44"
            value={selectedTA ?? ''}
            onChange={(e) => setSelectedTA(Number(e.target.value))}
          >
            <option value="">-- Pilih --</option>
            {tahunAjaranList.map(ta => (
              <option key={ta.id} value={ta.id}>
                {ta.nama}{ta.is_active ? ' (Aktif)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-auto">
          <label className="mb-1 block text-sm font-medium text-slate-700">Kelas</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none focus:ring-2 focus:ring-blue-500 md:w-48"
            value={selectedKelas}
            onChange={(e) => setSelectedKelas(e.target.value)}
          >
            <option value="">-- Pilih --</option>
            {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        </div>

        <div className="w-full md:w-auto">
          <label className="mb-1 block text-sm font-medium text-slate-700">Semester</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 outline-none focus:ring-2 focus:ring-blue-500 md:w-32"
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            <option value="1">Ganjil</option>
            <option value="2">Genap</option>
          </select>
        </div>

        <button
          onClick={handleLoad}
          disabled={!selectedKelas || loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-medium text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 md:w-auto"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Tampilkan
        </button>
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border bg-white shadow-sm print:hidden">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-blue-500" />
            <p>Sedang menyusun daftar santri...</p>
          </div>
        ) : !hasData ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <FileText className="mb-3 h-12 w-12 text-slate-300" />
            <p className="font-medium">Belum ada data ditampilkan.</p>
            <p className="text-sm">Silakan pilih kelas dan klik tombol Tampilkan.</p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-800 text-white">
                <tr>
                  <th className="w-14 px-4 py-3 text-center">No</th>
                  <th className="px-4 py-3">Santri</th>
                  <th className="w-32 px-4 py-3">NIS</th>
                  <th className="w-40 px-4 py-3">Status Nilai</th>
                  <th className="w-40 px-4 py-3 text-center">Rapor</th>
                  <th className="w-44 px-4 py-3 text-center">Identitas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daftar.map((row, idx) => (
                  <tr key={row.riwayat_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-center text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{row.nama}</p>
                      <p className="text-xs text-slate-500">{row.kelas?.nama_kelas || selectedKelasName}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.nis}</td>
                    <td className="px-4 py-3">
                      {row.status_nilai?.lengkap ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Lengkap
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                          {row.status_nilai?.terisi ?? 0}/{row.status_nilai?.total ?? 0} nilai
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => printRaporOne(row)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        <Printer className="h-3.5 w-3.5" /> Cetak Rapor
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => printIdentitasOne(row)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                      >
                        <IdCard className="h-3.5 w-3.5" /> Cetak Identitas
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="fixed -left-[10000px] top-0 print:static print:left-0">
        <div ref={printRef} className="w-fit bg-white">
          {printKind === 'rapor' ? (
            <div>
              {printRows.map((siswa) => (
                <RaporSatuHalaman
                  key={siswa.id}
                  data={siswa}
                  semester={Number(selectedSemester)}
                  tahunAjaran={tahunAjaran}
                />
              ))}
            </div>
          ) : (
            <div>
              {printRows.map((siswa) => (
                <IdentitasSantriHalaman key={siswa.riwayat_id} data={siswa} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
