'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  Calculator,
  CalendarDays,
  FileSpreadsheet,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Save,
  Search,
  Table2,
  Trophy,
  Upload,
  UserCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  getDataCatatanWali,
  getDataKepribadian,
  getDataNilaiPerMapel,
  getDataSantriPerKelas,
  getKelasListForLeger,
  getLegerData,
  getMapelPeganganForKelas,
  getTahunAjaranList,
  hitungDanSimpanLeger,
  simpanCatatanWali,
  simpanKepribadian,
  simpanNilaiExcelMenyeluruh,
  simpanNilaiMatrix,
  simpanNilaiPerMapel,
} from './actions'
import { KEPRIBADIAN_FIELDS, KEPRIBADIAN_PREDIKAT } from '@/lib/akademik/kepribadian'

type Mode = 'leger' | 'per-mapel' | 'kepribadian' | 'catatan' | 'excel'

const MODE_OPTIONS: { id: Mode; label: string; icon: any }[] = [
  { id: 'leger', label: 'Leger', icon: Table2 },
  { id: 'per-mapel', label: 'Per Mapel', icon: LayoutGrid },
  { id: 'kepribadian', label: 'Kepribadian', icon: UserCircle },
  { id: 'catatan', label: 'Catatan', icon: MessageSquare },
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet },
]

const clampNilai = (value: string) => {
  if (value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, Math.trunc(n)))
}

export default function NilaiRaporPage() {
  const confirm = useConfirm()
  const [mode, setMode] = useState<Mode>('leger')
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([])
  const [selectedTA, setSelectedTA] = useState<number | undefined>()
  const [kelasList, setKelasList] = useState<any[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('1')
  const [dataLeger, setDataLeger] = useState<any>(null)
  const [mapelPegangan, setMapelPegangan] = useState<any[]>([])
  const [selectedPegangan, setSelectedPegangan] = useState('')
  const [perMapelData, setPerMapelData] = useState<any[]>([])
  const [kepribadianData, setKepribadianData] = useState<any[]>([])
  const [catatanData, setCatatanData] = useState<any[]>([])
  const [excelPreview, setExcelPreview] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)

  const selectedPeganganData = useMemo(
    () => mapelPegangan.find(item => item.id === selectedPegangan),
    [mapelPegangan, selectedPegangan]
  )

  const selectedKelasName = useMemo(
    () => kelasList.find(k => k.id === selectedKelas)?.nama_kelas || 'Kelas',
    [kelasList, selectedKelas]
  )

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (isMobile) setMode('per-mapel')
  }, [])

  useEffect(() => {
    getTahunAjaranList().then(list => {
      setTahunAjaranList(list)
      const aktif = list.find((t: any) => t.is_active === 1)
      if (aktif) setSelectedTA(aktif.id)
    })
  }, [])

  useEffect(() => {
    if (!selectedTA) return
    setSelectedKelas('')
    setDataLeger(null)
    setMapelPegangan([])
    getKelasListForLeger(selectedTA).then(data => {
      setKelasList(data)
      if (data.length > 0) setSelectedKelas(data[0].id)
    })
  }, [selectedTA])

  useEffect(() => {
    if (!selectedKelas) return
    setSelectedPegangan('')
    setPerMapelData([])
    getMapelPeganganForKelas(selectedKelas, selectedTA).then(rows => {
      setMapelPegangan(rows)
      if (rows.length > 0) setSelectedPegangan(rows[0].id)
    })
  }, [selectedKelas, selectedTA])

  useEffect(() => {
    if (!selectedKelas) return
    if (mode === 'leger' || mode === 'excel') loadLeger()
    if (mode === 'kepribadian') loadKepribadian()
    if (mode === 'catatan') loadCatatan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKelas, selectedSemester, mode])

  useEffect(() => {
    if (mode !== 'per-mapel' || !selectedKelas || !selectedPeganganData) return
    loadPerMapel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedKelas, selectedSemester, selectedPegangan])

  const loadLeger = async () => {
    setLoading(true)
    try {
      setDataLeger(await getLegerData(selectedKelas, Number(selectedSemester)))
    } finally {
      setLoading(false)
    }
  }

  const loadPerMapel = async () => {
    if (!selectedPeganganData) return
    setLoading(true)
    try {
      setPerMapelData(await getDataNilaiPerMapel(selectedKelas, Number(selectedPeganganData.mapel_id), Number(selectedSemester)))
    } finally {
      setLoading(false)
    }
  }

  const loadKepribadian = async () => {
    setLoading(true)
    try {
      setKepribadianData(await getDataKepribadian(selectedKelas, Number(selectedSemester)))
    } finally {
      setLoading(false)
    }
  }

  const loadCatatan = async () => {
    setLoading(true)
    try {
      setCatatanData(await getDataCatatanWali(selectedKelas, Number(selectedSemester)))
    } finally {
      setLoading(false)
    }
  }

  const updateLegerCell = (riwayatId: string, mapelId: string | number, value: string) => {
    setDataLeger((prev: any) => ({
      ...prev,
      siswa: prev.siswa.map((s: any) => s.riwayat_id === riwayatId
        ? { ...s, nilai: { ...s.nilai, [mapelId]: clampNilai(value) } }
        : s
      ),
    }))
  }

  const applyBulkLegerMapel = (mapelId: string | number, value: string) => {
    const nilai = clampNilai(value)
    setDataLeger((prev: any) => prev ? ({
      ...prev,
      siswa: prev.siswa.map((s: any) => ({
        ...s,
        nilai: { ...s.nilai, [mapelId]: nilai },
      })),
    }) : prev)
  }

  const updateRowField = (setter: any, data: any[], idx: number, field: string, value: any) => {
    const next = [...data]
    next[idx] = { ...next[idx], [field]: value }
    setter(next)
  }

  const applyBulkKepribadian = (field: string, value: string) => {
    setKepribadianData(prev => prev.map(row => ({ ...row, [field]: value })))
  }

  const handleSimpanLeger = async () => {
    if (!dataLeger?.siswa?.length) return
    setSaving(true)
    const toastId = toast.loading('Menyimpan nilai leger...')
    try {
      const res = await simpanNilaiMatrix(Number(selectedSemester), dataLeger.siswa.map((s: any) => ({
        riwayat_id: s.riwayat_id,
        nilai: s.nilai,
      })))
      if (res?.error) toast.error(res.error)
      else {
        toast.success('Nilai leger tersimpan.')
        await loadLeger()
      }
    } finally {
      toast.dismiss(toastId)
      setSaving(false)
    }
  }

  const handleSimpanPerMapel = async () => {
    if (!selectedPeganganData || !perMapelData.length) return
    setSaving(true)
    const toastId = toast.loading('Menyimpan nilai mapel...')
    try {
      const res = await simpanNilaiPerMapel(Number(selectedSemester), Number(selectedPeganganData.mapel_id), perMapelData)
      if (res?.error) toast.error(res.error)
      else {
        toast.success('Nilai mapel tersimpan.')
        await loadPerMapel()
      }
    } finally {
      toast.dismiss(toastId)
      setSaving(false)
    }
  }

  const handleSimpanKepribadian = async () => {
    setSaving(true)
    const toastId = toast.loading('Menyimpan kepribadian...')
    try {
      const res = await simpanKepribadian(Number(selectedSemester), kepribadianData)
      if (res?.error) toast.error(res.error)
      else toast.success('Kepribadian tersimpan.')
    } finally {
      toast.dismiss(toastId)
      setSaving(false)
    }
  }

  const handleSimpanCatatan = async () => {
    setSaving(true)
    const toastId = toast.loading('Menyimpan catatan...')
    try {
      const formatted = catatanData.map(d => ({ riwayat_id: d.riwayat_id, catatan: d.catatan_wali_kelas }))
      const res = await simpanCatatanWali(Number(selectedSemester), formatted)
      if (res?.error) toast.error(res.error)
      else toast.success('Catatan wali tersimpan.')
    } finally {
      toast.dismiss(toastId)
      setSaving(false)
    }
  }

  const handleHitung = async () => {
    if (!dataLeger?.siswa?.length) return
    if (!await confirm('Hitung ulang Jumlah, Rata-rata, dan Ranking seluruh siswa di kelas ini?')) return
    setIsCalculating(true)
    const toastId = toast.loading('Mengkalkulasi nilai...')
    try {
      const res = await hitungDanSimpanLeger(selectedKelas, Number(selectedSemester))
      if (res?.error) toast.error('Gagal Hitung', { description: res.error })
      else {
        toast.success('Selesai!', { description: 'Data berhasil diperbarui dan diurutkan.' })
        await loadLeger()
      }
    } finally {
      toast.dismiss(toastId)
      setIsCalculating(false)
    }
  }

  const handleExport = async () => {
    if (!dataLeger?.siswa?.length) return
    setIsExporting(true)
    const toastId = toast.loading('Download Excel...')
    try {
      const XLSX = await import('xlsx')
      const headers = ['No', 'NIS', 'Nama Santri', ...dataLeger.mapel.map((m: any) => m.nama), 'JUMLAH', 'RATA-RATA', 'RANKING']
      const rows = dataLeger.siswa.map((s: any, idx: number) => {
        const rowData: any[] = [idx + 1, s.nis, s.nama]
        dataLeger.mapel.forEach((m: any) => rowData.push(s.nilai[m.id] ?? 0))
        rowData.push(s.jumlah, s.rata, s.rank)
        return rowData
      })
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `Leger ${selectedKelasName}`)
      XLSX.writeFile(wb, `Nilai_Rapor_${selectedKelasName}.xlsx`)
      toast.success('Berhasil export.')
    } catch {
      toast.error('Gagal export.')
    } finally {
      toast.dismiss(toastId)
      setIsExporting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    if (!selectedKelas) return toast.warning('Pilih kelas terlebih dahulu.')
    const mapel = dataLeger?.mapel?.length ? dataLeger.mapel : []
    if (!mapel.length) return toast.warning('Muat data leger dulu agar daftar mapel tersedia.')
    const toastId = toast.loading('Menyiapkan template...')
    try {
      const santriList = await getDataSantriPerKelas(selectedKelas)
      const rows = santriList.map((s: any) => {
        const row: any = { NIS: s.nis, 'NAMA SANTRI': s.nama }
        mapel.forEach((m: any) => { row[m.nama.toUpperCase()] = '' })
        KEPRIBADIAN_FIELDS.forEach(f => { row[f.label.toUpperCase()] = 'B' })
        row['CATATAN WALI KELAS'] = ''
        return row
      })
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Template Nilai')
      XLSX.writeFile(wb, `Template_Nilai_Rapor_${selectedKelasName}.xlsx`)
      toast.success('Template berhasil didownload.')
    } catch {
      toast.error('Gagal download template.')
    } finally {
      toast.dismiss(toastId)
    }
  }

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const toastId = toast.loading('Membaca data Excel...')
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      setExcelPreview(data)
      toast.success(`Berhasil memuat ${data.length} baris.`)
    } catch {
      toast.error('Format file tidak valid.')
    } finally {
      toast.dismiss(toastId)
      e.target.value = ''
    }
  }

  const handleSimpanExcel = async () => {
    if (!excelPreview.length) return
    const mapel = dataLeger?.mapel?.length ? dataLeger.mapel : []
    if (!mapel.length) return toast.warning('Muat data leger dulu agar daftar mapel tersedia.')
    setSaving(true)
    const toastId = toast.loading('Memproses import Excel...')
    try {
      const res = await simpanNilaiExcelMenyeluruh(selectedKelas, Number(selectedSemester), excelPreview, mapel)
      if (res?.error) toast.error(res.error)
      else {
        toast.success('Import Excel berhasil.')
        setExcelPreview([])
        await loadLeger()
      }
    } finally {
      toast.dismiss(toastId)
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <DashboardPageHeader
          title="Nilai Rapor"
          description="Input nilai, leger, kepribadian, catatan wali, dan import Excel dalam satu halaman."
          className="flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button onClick={handleHitung} disabled={isCalculating || !dataLeger} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
            {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            Hitung
          </button>
          <button onClick={handleExport} disabled={isExporting || !dataLeger} className="flex items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 font-bold text-white shadow-sm hover:bg-green-800 disabled:opacity-50">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_180px_56px] xl:items-end">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
              <CalendarDays className="h-3 w-3" /> Tahun Ajaran
            </label>
            <select className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none" value={selectedTA ?? ''} onChange={e => setSelectedTA(Number(e.target.value))}>
              {tahunAjaranList.map(ta => <option key={ta.id} value={ta.id}>{ta.nama}{ta.is_active ? ' (Aktif)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Kelas</label>
            <select className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none" value={selectedKelas} onChange={e => setSelectedKelas(e.target.value)}>
              {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Semester</label>
            <select className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
              <option value="1">Ganjil</option>
              <option value="2">Genap</option>
            </select>
          </div>
          <button onClick={() => mode === 'per-mapel' ? loadPerMapel() : mode === 'kepribadian' ? loadKepribadian() : mode === 'catatan' ? loadCatatan() : loadLeger()} disabled={loading || !selectedKelas} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white disabled:opacity-50 sm:col-span-2 xl:col-span-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-5 w-5" />}
            <span className="xl:hidden">Tampilkan</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2 shadow-sm">
        {MODE_OPTIONS.map(item => {
          const Icon = item.icon
          const active = mode === item.id
          return (
            <button key={item.id} onClick={() => setMode(item.id)} className={`flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors ${active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white py-20 text-center shadow-sm"><Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-500" /></div>
      ) : mode === 'leger' ? (
        <LegerMatrix dataLeger={dataLeger} updateLegerCell={updateLegerCell} applyBulkLegerMapel={applyBulkLegerMapel} onSave={handleSimpanLeger} saving={saving} />
      ) : mode === 'per-mapel' ? (
        <PerMapelPanel
          mapelPegangan={mapelPegangan}
          selectedPegangan={selectedPegangan}
          setSelectedPegangan={setSelectedPegangan}
          data={perMapelData}
          setData={setPerMapelData}
          onSave={handleSimpanPerMapel}
          saving={saving}
        />
      ) : mode === 'kepribadian' ? (
        <KepribadianPanel data={kepribadianData} updateRowField={updateRowField} setData={setKepribadianData} applyBulkKepribadian={applyBulkKepribadian} onSave={handleSimpanKepribadian} saving={saving} />
      ) : mode === 'catatan' ? (
        <CatatanPanel data={catatanData} updateRowField={updateRowField} setData={setCatatanData} onSave={handleSimpanCatatan} saving={saving} />
      ) : (
        <ExcelPanel preview={excelPreview} dataLeger={dataLeger} onDownload={handleDownloadTemplate} onUpload={handleFileUpload} onSave={handleSimpanExcel} saving={saving} />
      )}
    </div>
  )
}

function LegerMatrix({ dataLeger, updateLegerCell, applyBulkLegerMapel, onSave, saving }: any) {
  if (!dataLeger?.siswa?.length) return <EmptyState text="Data leger kosong. Pilih kelas lalu tampilkan data." />
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
        <div className="font-bold text-slate-800">Leger Matrix</div>
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Leger
        </button>
      </div>
      <div className="overflow-x-auto pb-4">
        <table className="w-full table-fixed border-collapse text-left text-xs">
          <thead className="sticky top-0 z-20 bg-slate-800 font-bold text-white shadow-sm">
            <tr>
              <th className="w-9 border border-slate-600 p-1 text-center md:sticky md:left-0 md:z-30 md:bg-slate-800">No</th>
              <th className="w-40 border border-slate-600 p-2 md:sticky md:left-9 md:z-30 md:bg-slate-800 md:shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Nama Santri</th>
              {dataLeger.mapel.map((m: any) => (
                <th key={m.id} className="relative h-40 w-12 border border-slate-600 p-1 align-bottom">
                  <div className="flex h-full w-full flex-col items-center justify-between gap-1">
                    <input
                      inputMode="numeric"
                      type="text"
                      maxLength={3}
                      onChange={e => applyBulkLegerMapel(m.id, e.target.value)}
                      placeholder="0"
                      title={`Set semua ${m.nama}`}
                      className="h-7 w-10 rounded border border-slate-500 bg-slate-700 px-1 text-center font-mono text-[11px] font-bold text-white outline-none placeholder:text-slate-400 focus:border-white focus:bg-slate-600"
                    />
                    <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-[11px] tracking-wide">{m.nama}</span>
                  </div>
                </th>
              ))}
              <th className="w-12 border border-slate-600 bg-orange-700 p-1 text-center">JML</th>
              <th className="w-12 border border-slate-600 bg-blue-700 p-1 text-center">RATA</th>
              <th className="w-12 border border-slate-600 bg-green-700 p-1 text-center">RANK</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {dataLeger.siswa.map((s: any, idx: number) => (
              <tr key={s.id} className="group hover:bg-yellow-50">
                <td className="border p-1 text-center md:sticky md:left-0 md:z-10 md:bg-white md:group-hover:bg-yellow-50">{idx + 1}</td>
                <td className="break-words border p-1.5 font-bold leading-tight text-slate-800 md:sticky md:left-9 md:z-10 md:bg-white md:shadow-[2px_0_5px_rgba(0,0,0,0.1)] md:group-hover:bg-yellow-50">{s.nama}</td>
                {dataLeger.mapel.map((m: any) => (
                  <td key={m.id} className="border p-0.5 text-center">
                    <input
                      inputMode="numeric"
                      type="text"
                      maxLength={3}
                      value={s.nilai[m.id] ?? ''}
                      onChange={e => updateLegerCell(s.riwayat_id, m.id, e.target.value)}
                      placeholder="-"
                      className="h-8 w-10 rounded border border-transparent bg-transparent px-0.5 text-center font-mono text-[11px] font-bold outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                  </td>
                ))}
                <td className="border bg-orange-50 p-1 text-center font-bold text-orange-900">{s.jumlah}</td>
                <td className="border bg-blue-50 p-1 text-center font-bold text-blue-900">{s.rata}</td>
                <td className="border bg-green-50 p-1 text-center font-bold text-green-900">{s.rank <= 3 && <Trophy className="mr-1 inline h-3 w-3 text-yellow-500" />}{s.rank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PerMapelPanel({ mapelPegangan, selectedPegangan, setSelectedPegangan, data, setData, onSave, saving }: any) {
  if (!mapelPegangan.length) return <EmptyState text="Belum ada mapel pegangan untuk kelas ini. Atur dulu di menu Pembagian Kitab Guru." />
  const applyBulkPerMapel = (value: string) => {
    const nilai = clampNilai(value)
    setData(data.map((row: any) => ({ ...row, nilai })))
  }
  return (
    <div className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Kitab Pegangan</label>
          <select value={selectedPegangan} onChange={e => setSelectedPegangan(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none">
            {mapelPegangan.map((item: any) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        <button onClick={onSave} disabled={saving || !data.length} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-bold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Mapel
        </button>
      </div>
      <div className="grid grid-cols-[1fr_84px] items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
        <div className="text-sm font-bold text-blue-900">Set nilai semua santri</div>
        <input
          inputMode="numeric"
          type="text"
          maxLength={3}
          onChange={e => applyBulkPerMapel(e.target.value)}
          placeholder="0"
          className="h-11 w-full rounded-xl border border-blue-200 bg-white px-2 text-center text-base font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <div className="grid gap-3">
        {data.map((row: any, idx: number) => (
          <div key={row.riwayat_id} className="grid grid-cols-[1fr_84px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="min-w-0">
              <div className="break-words font-bold uppercase leading-tight text-slate-800">{idx + 1}. {row.nama}</div>
            </div>
            <input
              inputMode="numeric"
              type="text"
              maxLength={3}
              value={row.nilai ?? ''}
              onChange={e => updateDataNilai(setData, data, idx, e.target.value)}
              placeholder="0"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-center text-base font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function updateDataNilai(setData: any, data: any[], idx: number, value: string) {
  const next = [...data]
  next[idx] = { ...next[idx], nilai: clampNilai(value) }
  setData(next)
}

function KepribadianPanel({ data, updateRowField, setData, applyBulkKepribadian, onSave, saving }: any) {
  if (!data.length) return <EmptyState text="Pilih kelas untuk mengisi kepribadian." />
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
        <div className="font-bold text-slate-800">Kepribadian A-E</div>
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="w-12 px-3 py-2.5 text-center">No</th>
              <th className="min-w-[190px] px-3 py-2.5 text-left">Nama</th>
              {KEPRIBADIAN_FIELDS.map(f => (
                <th key={f.key} className="w-40 border-l px-2 py-2.5 text-center">
                  <div className="space-y-1">
                    <div>{f.label}</div>
                    <select
                      defaultValue=""
                      onChange={e => {
                        if (!e.target.value) return
                        applyBulkKepribadian(f.key, e.target.value)
                      }}
                      className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                      title={`Set semua ${f.label}`}
                    >
                      <option value="">Massal</option>
                      {KEPRIBADIAN_PREDIKAT.map(p => <option key={p.code} value={p.code}>{p.code} - {p.description}</option>)}
                    </select>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((row: any, idx: number) => (
              <tr key={row.riwayat_id} className="hover:bg-blue-50/30">
                <td className="px-3 py-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="font-bold uppercase text-slate-700">{row.nama}</div>
                  <div className="font-mono text-[10px] text-slate-400">{row.nis}</div>
                </td>
                {KEPRIBADIAN_FIELDS.map(f => (
                  <td key={f.key} className="border-l px-2 py-2">
                    <select value={row[f.key] || 'B'} onChange={e => updateRowField(setData, data, idx, f.key, e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100">
                      {KEPRIBADIAN_PREDIKAT.map(p => <option key={p.code} value={p.code}>{p.code} - {p.description}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CatatanPanel({ data, updateRowField, setData, onSave, saving }: any) {
  if (!data.length) return <EmptyState text="Pilih kelas untuk mengisi catatan wali." />
  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
        <div className="font-bold text-slate-800">Catatan Wali Kelas</div>
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
        </button>
      </div>
      <div className="grid gap-3 p-4">
        {data.map((row: any, idx: number) => (
          <div key={row.riwayat_id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[220px_1fr]">
            <div>
              <div className="font-bold text-slate-800">{row.nama}</div>
              <div className="font-mono text-xs text-slate-400">{row.nis}</div>
            </div>
            <textarea value={row.catatan_wali_kelas} onChange={e => updateRowField(setData, data, idx, 'catatan_wali_kelas', e.target.value)} className="min-h-[86px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ExcelPanel({ preview, dataLeger, onDownload, onUpload, onSave, saving }: any) {
  return (
    <div className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onDownload} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">
          <FileSpreadsheet className="h-4 w-4" /> Download Template
        </button>
        <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700">
          <Upload className="h-4 w-4" /> Upload Excel
          <input type="file" accept=".xlsx" onChange={onUpload} className="hidden" />
        </label>
        <button onClick={onSave} disabled={saving || !preview.length} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-bold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Import
        </button>
      </div>
      {!dataLeger && <p className="text-sm font-medium text-amber-700">Muat data leger dulu sebelum membuat template atau import, agar daftar mapel sinkron.</p>}
      {preview.length > 0 ? (
        <div className="overflow-auto rounded-xl border">
          <table className="w-full min-w-[720px] whitespace-nowrap text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="border-b p-3 text-left">Santri</th>
                {(dataLeger?.mapel || []).slice(0, 5).map((m: any) => <th key={m.id} className="border-b p-3 text-center">{m.nama}</th>)}
                <th className="border-b p-3 text-center">Kepribadian</th>
                <th className="border-b p-3 text-left">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {preview.slice(0, 20).map((row: any, i: number) => (
                <tr key={i}>
                  <td className="p-3 font-bold text-slate-700">{row['NAMA SANTRI']}</td>
                  {(dataLeger?.mapel || []).slice(0, 5).map((m: any) => <td key={m.id} className="p-3 text-center font-mono">{row[m.nama.toUpperCase()] ?? '-'}</td>)}
                  <td className="p-3 text-center font-bold">{row['AKHLAK/BUDI PEKERTI'] || '-'}</td>
                  <td className="max-w-[220px] truncate p-3 italic">{row['CATATAN WALI KELAS'] || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState text="Download template atau upload file Excel untuk import massal." />}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border bg-white py-16 text-center text-sm font-medium italic text-slate-400 shadow-sm">{text}</div>
}
