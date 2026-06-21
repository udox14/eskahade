'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { getGuruOptionsForRekap, getMarhalahList, getRekapDetailGuru, getRekapKinerjaGuru, getTahunAjaranList } from './actions'
import { useReactToPrint } from '@/lib/pdf/client'
import { AlertTriangle, Filter, Search, Loader2, Printer, Palette, Circle, Users, UserRound } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

type TabMode = 'semua' | 'per_guru'
type PrintMode = 'colorful' | 'bw'
type GuruSession = 'shubuh' | 'ashar' | 'maghrib'
type StatusFilter = 'semua' | 'H' | 'B' | 'A' | 'A_B'

const SESI_OPTIONS = [
  { value: 'semua',          label: 'Semua Sesi' },
  { value: 'shubuh',         label: 'Shubuh Saja' },
  { value: 'ashar',          label: 'Ashar Saja' },
  { value: 'maghrib',        label: 'Maghrib Saja' },
  { value: 'shubuh_maghrib', label: 'Shubuh & Maghrib' },
  { value: 'shubuh_ashar',   label: 'Shubuh & Ashar' },
  { value: 'ashar_maghrib',  label: 'Ashar & Maghrib' },
  { value: 'lengkap',        label: 'Ketiga Sesi' },
]

const SORT_OPTIONS = [
  { value: 'nama',     label: 'Nama Guru' },
  { value: 'kelas',    label: 'Kelas / Marhalah' },
  { value: 'performa', label: 'Performa (Terendah)' },
  { value: 'hadir',    label: 'Hadir (Terbanyak)' },
  { value: 'badal',    label: 'Badal (Terbanyak)' },
  { value: 'kosong',   label: 'Alfa/Kosong (Terbanyak)' },
]

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'semua', label: 'Semua Status' },
  { value: 'H', label: 'Hadir Saja' },
  { value: 'B', label: 'Badal Saja' },
  { value: 'A', label: 'Alfa Saja' },
  { value: 'A_B', label: 'Alfa + Badal' },
]

const SESSION_LABEL: Record<GuruSession, string> = {
  shubuh: 'Shubuh',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
}

const SESSION_COLORS: Record<GuruSession, string> = {
  shubuh: 'border-sky-100 bg-sky-50 text-sky-700',
  ashar: 'border-orange-100 bg-orange-50 text-orange-700',
  maghrib: 'border-violet-100 bg-violet-50 text-violet-700',
}

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function getColorPerforma(p: number) {
  if (p >= 90) return '#16a34a'
  if (p >= 75) return '#2563eb'
  if (p >= 50) return '#ea580c'
  return '#dc2626'
}

function statusClass(status: string) {
  if (status === 'A') return 'bg-red-50 text-red-700 border-red-100'
  if (status === 'B') return 'bg-yellow-50 text-yellow-700 border-yellow-100'
  return 'bg-green-50 text-green-700 border-green-100'
}

function statusPrintColor(status: string, isBW: boolean) {
  if (isBW) return { bg: '#ffffff', color: '#000000' }
  if (status === 'A') return { bg: '#fef2f2', color: '#dc2626' }
  if (status === 'B') return { bg: '#fffbeb', color: '#d97706' }
  return { bg: '#f0fdf4', color: '#16a34a' }
}

function sourceLabel(row: any) {
  if (row?.sumber_guru === 'snapshot') return 'Snapshot'
  return 'Jadwal'
}

function filterDetailRows(detail: any | null, statusFilter: StatusFilter) {
  if (!detail) return null
  if (statusFilter === 'semua') return detail

  const allowed = statusFilter === 'A_B' ? new Set(['A', 'B']) : new Set([statusFilter])
  return {
    ...detail,
    detail: (detail.detail || []).filter((row: any) => allowed.has(row.status)),
  }
}

export default function RekapAbsensiGuruPage() {
  const [activeTab, setActiveTab] = useState<TabMode>('semua')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([])
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState('')
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  const [badalAsHadir, setBadalAsHadir] = useState(true)
  const [sortBy, setSortBy] = useState('performa')
  const [filterSesi, setFilterSesi] = useState('semua')
  const [printMode, setPrintMode] = useState<PrintMode>('colorful')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua')

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const [guruOptions, setGuruOptions] = useState<any[]>([])
  const [selectedGuru, setSelectedGuru] = useState('')
  const [guruDetail, setGuruDetail] = useState<any | null>(null)
  const [guruLoading, setGuruLoading] = useState(false)
  const [guruOptionsLoading, setGuruOptionsLoading] = useState(false)
  const [guruHasSearched, setGuruHasSearched] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: activeTab === 'per_guru' && guruDetail?.guru?.nama
      ? `Rekap Absen ${guruDetail.guru.nama} ${startDate} sd ${endDate}`
      : `Rekap Absen Guru ${startDate} sd ${endDate}`,
  })

  useEffect(() => {
    const now = new Date()
    setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'))
    setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'))
    Promise.all([getMarhalahList(), getTahunAjaranList()]).then(([marhalah, tahunAjaran]) => {
      setMarhalahList(marhalah || [])
      setTahunAjaranList(tahunAjaran || [])
      const active = (tahunAjaran || []).find((item: any) => Number(item.is_active) === 1)
      if (active) setSelectedTahunAjaran(String(active.id))
    })
  }, [])

  useEffect(() => {
    setGuruOptionsLoading(true)
    getGuruOptionsForRekap(selectedMarhalah, selectedTahunAjaran, startDate, endDate)
      .then(list => {
        setGuruOptions(list || [])
        setSelectedGuru(current => {
          if (!current) return current
          return (list || []).some((item: any) => String(item.id) === String(current)) ? current : ''
        })
      })
      .finally(() => setGuruOptionsLoading(false))
  }, [selectedMarhalah, selectedTahunAjaran, startDate, endDate])

  const handleCariSemua = async () => {
    setLoading(true)
    setHasSearched(true)
    const res = await getRekapKinerjaGuru(startDate, endDate, selectedMarhalah, badalAsHadir, selectedTahunAjaran)
    setData(res || [])
    setLoading(false)
  }

  const handleCariPerGuru = async () => {
    if (!selectedGuru) return
    setGuruLoading(true)
    setGuruHasSearched(true)
    const res = await getRekapDetailGuru(startDate, endDate, selectedGuru, selectedMarhalah, badalAsHadir, selectedTahunAjaran)
    setGuruDetail(res)
    setGuruLoading(false)
  }

  const setRange = (type: 'THIS_WEEK' | 'THIS_MONTH') => {
    const now = new Date()
    if (type === 'THIS_MONTH') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'))
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'))
    } else {
      setStartDate(format(subDays(now, 7), 'yyyy-MM-dd'))
      setEndDate(format(now, 'yyyy-MM-dd'))
    }
  }

  const hasSesi = (row: any, sesi: string) => {
    if (sesi === 'semua') return true
    const kelas = row.kelas_ajar as string
    const hasS = kelas.includes('(Shubuh)')
    const hasA = kelas.includes('(Ashar)')
    const hasM = kelas.includes('(Maghrib)')
    if (sesi === 'shubuh') return hasS && !hasA && !hasM
    if (sesi === 'ashar') return !hasS && hasA && !hasM
    if (sesi === 'maghrib') return !hasS && !hasA && hasM
    if (sesi === 'shubuh_maghrib') return hasS && !hasA && hasM
    if (sesi === 'shubuh_ashar') return hasS && hasA && !hasM
    if (sesi === 'ashar_maghrib') return !hasS && hasA && hasM
    if (sesi === 'lengkap') return hasS && hasA && hasM
    return true
  }

  const processedData = useMemo(() => {
    const filtered = data.filter(row => hasSesi(row, filterSesi))
    return [...filtered].sort((a, b) => {
      if (sortBy === 'nama') return naturalSort(a.nama, b.nama)
      if (sortBy === 'kelas') return naturalSort(a.kelas_ajar, b.kelas_ajar)
      if (sortBy === 'performa') return a.persentase - b.persentase
      if (sortBy === 'hadir') return b.hadir - a.hadir
      if (sortBy === 'badal') return b.badal - a.badal
      if (sortBy === 'kosong') return b.kosong - a.kosong
      return 0
    })
  }, [data, sortBy, filterSesi])

  const fmtDate = (d: string) => {
    if (!d) return ''
    try { return format(new Date(d), 'd MMMM yyyy', { locale: localeId }) }
    catch { return d }
  }

  const namaMarhalah = selectedMarhalah
    ? marhalahList.find(m => String(m.id) === String(selectedMarhalah))?.nama || ''
    : 'Semua Tingkat'
  const namaTahunAjaran = selectedTahunAjaran
    ? tahunAjaranList.find(ta => String(ta.id) === String(selectedTahunAjaran))?.nama || 'Tahun Ajaran'
    : 'Tahun Ajaran Aktif'
  const statusFilterLabel = STATUS_FILTER_OPTIONS.find(option => option.value === statusFilter)?.label || 'Semua Status'
  const filteredGuruDetail = useMemo(() => filterDetailRows(guruDetail, statusFilter), [guruDetail, statusFilter])

  const isBW = printMode === 'bw'
  const S = {
    headerBg: isBW ? '#000000' : '#1e1b4b',
    headerBorder: isBW ? '#000000' : '#312e81',
    hadirBg: isBW ? '#ffffff' : '#f0fdf4',
    hadirColor: isBW ? '#000000' : '#16a34a',
    hadirPctColor: isBW ? '#000000' : '#86efac',
    badalBg: isBW ? '#ffffff' : '#fffbeb',
    badalColor: isBW ? '#000000' : '#d97706',
    badalPctColor: isBW ? '#000000' : '#fcd34d',
    kosongBg: isBW ? '#ffffff' : '#fef2f2',
    kosongColor: isBW ? '#000000' : '#dc2626',
    kosongPctColor: isBW ? '#000000' : '#fca5a5',
    stripeBg: isBW ? '#ffffff' : '#f8f7ff',
    titleColor: isBW ? '#000000' : '#1e1b4b',
    subColor: isBW ? '#000000' : '#374151',
    metaColor: isBW ? '#000000' : '#6b7280',
    borderColor: isBW ? '#000000' : '#e5e7eb',
    perfColor: (p: number) => isBW ? '#000000' : getColorPerforma(p),
  }

  const canPrintSemua = activeTab === 'semua' && hasSearched && !loading && processedData.length > 0
  const canPrintGuru = activeTab === 'per_guru' && guruHasSearched && !guruLoading && Boolean(filteredGuruDetail)
  const canPrint = canPrintSemua || canPrintGuru

  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-4 border-b pb-4">
        <DashboardPageHeader
          title="Rekap Kinerja Guru"
          description="Evaluasi kehadiran pengajar berdasarkan jadwal kelas."
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-fit">
            <button
              onClick={() => setActiveTab('semua')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition sm:flex-none ${activeTab === 'semua' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Users className="h-4 w-4" />
              Semua Guru
            </button>
            <button
              onClick={() => setActiveTab('per_guru')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition sm:flex-none ${activeTab === 'per_guru' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserRound className="h-4 w-4" />
              Per Guru
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setRange('THIS_WEEK')} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">7 Hari Terakhir</button>
            <button onClick={() => setRange('THIS_MONTH')} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">Bulan Ini</button>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
        <div className={`grid grid-cols-1 gap-4 ${activeTab === 'per_guru' ? 'md:grid-cols-7' : 'md:grid-cols-5'}`}>
          <div className="md:col-span-2 flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Dari</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Sampai</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Tahun Ajaran</label>
            <select value={selectedTahunAjaran} onChange={e => setSelectedTahunAjaran(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-sm bg-white">
              {tahunAjaranList.length === 0 && <option value="">Aktif</option>}
              {tahunAjaranList.map(ta => (
                <option key={ta.id} value={ta.id}>{ta.nama}{Number(ta.is_active) === 1 ? ' (Aktif)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Filter Tingkat</label>
            <select value={selectedMarhalah} onChange={e => setSelectedMarhalah(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-sm bg-white">
              <option value="">Semua Tingkat</option>
              {marhalahList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </div>
          {activeTab === 'per_guru' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Guru</label>
              <select value={selectedGuru} onChange={e => setSelectedGuru(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-sm bg-white" disabled={guruOptionsLoading}>
                <option value="">{guruOptionsLoading ? 'Memuat guru...' : 'Pilih guru'}</option>
                {guruOptions.map(guru => <option key={guru.id} value={guru.id}>{guru.nama}</option>)}
              </select>
            </div>
          )}
          {activeTab === 'per_guru' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Status Tampil</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} className="w-full p-2 border border-slate-200 rounded-xl text-sm bg-white">
                {STATUS_FILTER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button
              onClick={activeTab === 'per_guru' ? handleCariPerGuru : handleCariSemua}
              disabled={activeTab === 'per_guru' ? (guruLoading || !selectedGuru) : loading}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 h-[38px]"
            >
              {(activeTab === 'per_guru' ? guruLoading : loading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Tampilkan Rekap
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
            <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Filter className="w-4 h-4" /> Opsi Perhitungan:</span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="badalOpt" checked={badalAsHadir === true} onChange={() => setBadalAsHadir(true)} className="accent-indigo-600 w-4 h-4" />
                <span className="text-sm text-slate-600">Badal = <b className="text-green-600">Terisi (Hadir)</b></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="badalOpt" checked={badalAsHadir === false} onChange={() => setBadalAsHadir(false)} className="accent-red-600 w-4 h-4" />
                <span className="text-sm text-slate-600">Badal = <b className="text-red-600">Kosong (Alfa)</b></span>
              </label>
            </div>
          </div>

          {canPrint && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white rounded-lg p-1 gap-1 border border-slate-200">
                <button
                  onClick={() => setPrintMode('colorful')}
                  title="Cetak Berwarna"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${printMode === 'colorful' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Palette className="w-3.5 h-3.5" /> Berwarna
                </button>
                <button
                  onClick={() => setPrintMode('bw')}
                  title="Cetak Hitam Putih"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${printMode === 'bw' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Circle className="w-3.5 h-3.5" /> Hitam Putih
                </button>
              </div>
              <button onClick={() => handlePrint()} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 transition-colors text-sm">
                <Printer className="w-4 h-4" /> Cetak
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'semua' ? (
        <SemuaGuruView
          data={data}
          loading={loading}
          hasSearched={hasSearched}
          processedData={processedData}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filterSesi={filterSesi}
          setFilterSesi={setFilterSesi}
        />
      ) : (
        <PerGuruView
          detail={filteredGuruDetail}
          rawDetail={guruDetail}
          loading={guruLoading}
          hasSearched={guruHasSearched}
          selectedGuru={selectedGuru}
          statusFilterLabel={statusFilterLabel}
        />
      )}

      <div className="hidden">
        <div ref={printRef}>
          <style>{`
            @page { size: F4 portrait; margin: 10mm 8mm 10mm 8mm; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `}</style>

          {activeTab === 'per_guru' && guruDetail ? (
            <PrintPerGuru
              detail={filteredGuruDetail}
              fmtDate={fmtDate}
              startDate={startDate}
              endDate={endDate}
              namaTahunAjaran={namaTahunAjaran}
              namaMarhalah={namaMarhalah}
              badalAsHadir={badalAsHadir}
              statusFilterLabel={statusFilterLabel}
              isBW={isBW}
              S={S}
            />
          ) : (
            <PrintSemuaGuru
              processedData={processedData}
              fmtDate={fmtDate}
              startDate={startDate}
              endDate={endDate}
              namaTahunAjaran={namaTahunAjaran}
              namaMarhalah={namaMarhalah}
              filterSesi={filterSesi}
              sortBy={sortBy}
              badalAsHadir={badalAsHadir}
              isBW={isBW}
              S={S}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SemuaGuruView({
  data,
  loading,
  hasSearched,
  processedData,
  sortBy,
  setSortBy,
  filterSesi,
  setFilterSesi,
}: {
  data: any[]
  loading: boolean
  hasSearched: boolean
  processedData: any[]
  sortBy: string
  setSortBy: (value: string) => void
  filterSesi: string
  setFilterSesi: (value: string) => void
}) {
  return (
    <>
      {hasSearched && !loading && data.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Urutkan:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Sesi:</span>
              <select value={filterSesi} onChange={e => setFilterSesi(e.target.value)} className="text-sm border border-slate-200 rounded-xl px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500">
                {SESI_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <span className="text-xs text-slate-400">{processedData.length} guru</span>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center h-full py-32 text-slate-400">
            <Search className="w-16 h-16 mb-4 text-slate-200" />
            <p>Silakan atur filter dan klik <b>Tampilkan Rekap</b>.</p>
          </div>
        ) : loading ? (
          <div className="py-32 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500" /></div>
        ) : processedData.length === 0 ? (
          <div className="py-32 text-center text-slate-400">Tidak ada data untuk filter yang dipilih.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-indigo-900 text-white font-bold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-tl-xl">No</th>
                  <th className="px-4 py-3">Nama Guru</th>
                  <th className="px-4 py-3">Jadwal</th>
                  <th className="px-4 py-3 text-center">Waktu Wajib</th>
                  <th className="px-4 py-3 text-center bg-green-700/50">Hadir</th>
                  <th className="px-4 py-3 text-center bg-yellow-600/50">Badal</th>
                  <th className="px-4 py-3 text-center bg-red-700/50">Kosong/Alfa</th>
                  <th className="px-4 py-3 text-right rounded-tr-xl w-40">Performa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedData.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{row.nama}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-500 max-w-xs">{row.kelas_ajar}</td>
                    <td className="px-4 py-3 text-center">
                      <p className="font-bold text-slate-700">{row.total_wajib}</p>
                      {row.snapshot_berbeda > 0 && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700" title="Ada snapshot guru yang berbeda dari jadwal saat ini">
                          <AlertTriangle className="h-3 w-3" />
                          {row.snapshot_berbeda}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center bg-green-50/30">
                      <p className="font-bold text-green-600">{row.hadir}</p>
                      <p className="text-[10px] text-green-400">{row.pct_hadir}%</p>
                    </td>
                    <td className="px-4 py-3 text-center bg-yellow-50/30">
                      <p className="font-bold text-yellow-600">{row.badal}</p>
                      <p className="text-[10px] text-yellow-400">{row.pct_badal}%</p>
                    </td>
                    <td className="px-4 py-3 text-center bg-red-50/30">
                      <p className="font-bold text-red-600">{row.kosong}</p>
                      <p className="text-[10px] text-red-400">{row.pct_kosong}%</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-lg font-extrabold" style={{ color: getColorPerforma(row.persentase) }}>
                          {row.persentase}%
                        </span>
                        <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${row.persentase}%`, backgroundColor: getColorPerforma(row.persentase) }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function PerGuruView({ detail, rawDetail, loading, hasSearched, selectedGuru, statusFilterLabel }: {
  detail: any | null
  rawDetail: any | null
  loading: boolean
  hasSearched: boolean
  selectedGuru: string
  statusFilterLabel: string
}) {
  if (!selectedGuru && !hasSearched) {
    return (
      <div className="bg-white border rounded-xl shadow-sm min-h-[400px] flex flex-col items-center justify-center py-28 text-slate-400">
        <UserRound className="w-16 h-16 mb-4 text-slate-200" />
        <p>Pilih guru, rentang tanggal, lalu klik <b>Tampilkan Rekap</b>.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white border rounded-xl shadow-sm py-32 text-center">
        <Loader2 className="w-10 h-10 animate-spin mx-auto text-indigo-500" />
      </div>
    )
  }

  if (!hasSearched) {
    return (
      <div className="bg-white border rounded-xl shadow-sm min-h-[400px] flex flex-col items-center justify-center py-28 text-slate-400">
        <Search className="w-16 h-16 mb-4 text-slate-200" />
        <p>Klik <b>Tampilkan Rekap</b> untuk melihat absensi guru ini.</p>
      </div>
    )
  }

  if (!detail) {
    return <div className="bg-white border rounded-xl shadow-sm py-32 text-center text-slate-400">Tidak ada data untuk guru dan filter yang dipilih.</div>
  }

  const rawDetailCount = rawDetail?.detail?.length ?? detail.detail.length
  const snapshotMismatchCount = (rawDetail?.detail || detail.detail || []).filter((row: any) => row.snapshot_berbeda).length

  return (
    <div className="space-y-4">
      {snapshotMismatchCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-black">Ada {snapshotMismatchCount} waktu dengan snapshot guru berbeda dari jadwal saat ini.</p>
            <p className="mt-1 text-xs text-amber-700">Rekap tetap memakai snapshot agar histori lintas tahun ajaran tidak berubah saat jadwal baru dibuat.</p>
          </div>
        </div>
      )}
      <div className="bg-white border rounded-xl shadow-sm p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Rekap Per Guru</p>
            <h2 className="text-2xl font-black text-slate-900 mt-1">{detail.guru.nama}</h2>
            <p className="text-sm text-slate-500 mt-1">{detail.kelas_ajar || 'Tidak ada jadwal aktif dalam rentang ini'}</p>
          </div>
          <div className="text-left lg:text-right">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Performa</p>
            <p className="text-4xl font-black mt-1" style={{ color: getColorPerforma(detail.total.persentase) }}>{detail.total.persentase}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryBox label="Waktu Wajib" value={detail.total.wajib} />
        <SummaryBox label="Hadir" value={detail.total.hadir} pct={detail.total.pct_hadir} color="text-green-600" bg="bg-green-50" />
        <SummaryBox label="Badal" value={detail.total.badal} pct={detail.total.pct_badal} color="text-yellow-600" bg="bg-yellow-50" />
        <SummaryBox label="Kosong/Alfa" value={detail.total.kosong} pct={detail.total.pct_kosong} color="text-red-600" bg="bg-red-50" />
        <SummaryBox label="Persentase" value={`${detail.total.persentase}%`} color="text-indigo-700" bg="bg-indigo-50" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {(['shubuh', 'ashar', 'maghrib'] as GuruSession[]).map(session => {
          const item = detail.per_sesi[session]
          return (
            <div key={session} className="bg-white border rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className={`rounded-lg border px-3 py-1 text-xs font-black uppercase ${SESSION_COLORS[session]}`}>{SESSION_LABEL[session]}</span>
                <span className="text-xl font-black" style={{ color: getColorPerforma(item.persentase) }}>{item.persentase}%</span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-3 text-center">
                <MiniStat label="Wajib" value={item.wajib} />
                <MiniStat label="Hadir" value={item.hadir} pct={item.pct_hadir} />
                <MiniStat label="Badal" value={item.badal} pct={item.pct_badal} />
                <MiniStat label="Alfa" value={item.kosong} pct={item.pct_kosong} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <p className="font-black text-slate-800">Detail Tanggal dan Waktu</p>
          <p className="text-xs text-slate-400 mt-1">
            Status tampil: {statusFilterLabel} - {detail.detail.length} dari {rawDetailCount} waktu wajib dalam rentang ini
          </p>
        </div>
        {detail.detail.length === 0 ? (
          <div className="py-16 text-center text-slate-400">Tidak ada detail dengan status {statusFilterLabel.toLowerCase()} pada rentang yang dipilih.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Kelas/Gabungan</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Sumber</th>
                  <th className="px-4 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.detail.map((row: any) => (
                  <tr key={`${row.tanggal}-${row.sesi}-${row.kelas}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{row.hari}</p>
                      <p className="text-xs text-slate-400">{row.tanggal}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${SESSION_COLORS[row.sesi as GuruSession]}`}>{row.sesi_label}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.kelas}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-black ${statusClass(row.status)}`}>{row.status_label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-black ${row.snapshot_berbeda ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                        {sourceLabel(row)}
                      </span>
                      {row.snapshot_berbeda && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          Snapshot: {row.snapshot_guru_nama || '-'}; jadwal: {row.jadwal_guru_nama || '-'}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.catatan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryBox({ label, value, pct, color = 'text-slate-800', bg = 'bg-white' }: {
  label: string
  value: number | string
  pct?: number
  color?: string
  bg?: string
}) {
  return (
    <div className={`${bg} border rounded-xl p-4 shadow-sm`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
      {typeof pct === 'number' && <p className="text-xs text-slate-400 mt-1">{pct}% dari wajib</p>}
    </div>
  )
}

function MiniStat({ label, value, pct }: { label: string; value: number; pct?: number }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="font-black text-slate-800">{value}</p>
      {typeof pct === 'number' && <p className="text-[10px] text-slate-400">{pct}%</p>}
    </div>
  )
}

function PrintSemuaGuru({ processedData, fmtDate, startDate, endDate, namaTahunAjaran, namaMarhalah, filterSesi, sortBy, badalAsHadir, isBW, S }: any) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000' }}>
      <PrintHeader
        title="REKAP ABSEN GURU"
        subtitle={`${fmtDate(startDate)} - ${fmtDate(endDate)}`}
        meta={`T.A.: ${namaTahunAjaran} | Tingkat: ${namaMarhalah} | Sesi: ${SESI_OPTIONS.find(o => o.value === filterSesi)?.label} | Badal: ${badalAsHadir ? 'Hadir' : 'Kosong'} | Urut: ${SORT_OPTIONS.find(o => o.value === sortBy)?.label}`}
        S={S}
        isBW={isBW}
      />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: S.headerBg, color: '#ffffff' }}>
            <th style={{ padding: '5px 4px', textAlign: 'center', width: '24px', border: `1px solid ${S.headerBorder}` }}>No</th>
            <th style={{ padding: '5px 6px', textAlign: 'left', width: '130px', border: `1px solid ${S.headerBorder}` }}>Nama Guru</th>
            <th style={{ padding: '5px 6px', textAlign: 'left', border: `1px solid ${S.headerBorder}` }}>Jadwal</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', width: '48px', border: `1px solid ${S.headerBorder}` }}>Wajib</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', width: '52px', border: `1px solid ${S.headerBorder}`, backgroundColor: isBW ? '#000' : '#14532d' }}>Hadir</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', width: '52px', border: `1px solid ${S.headerBorder}`, backgroundColor: isBW ? '#000' : '#78350f' }}>Badal</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', width: '52px', border: `1px solid ${S.headerBorder}`, backgroundColor: isBW ? '#000' : '#7f1d1d' }}>Alfa</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', width: '55px', border: `1px solid ${S.headerBorder}` }}>Performa</th>
          </tr>
        </thead>
        <tbody>
          {processedData.map((row: any, idx: number) => (
            <tr key={row.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : S.stripeBg }}>
              <td style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}`, color: isBW ? '#000' : '#9ca3af' }}>{idx + 1}</td>
              <td style={{ padding: '4px 6px', fontWeight: 'bold', border: `1px solid ${S.borderColor}` }}>{row.nama}</td>
              <td style={{ padding: '4px 6px', color: S.metaColor, fontSize: '9px', border: `1px solid ${S.borderColor}` }}>{row.kelas_ajar}</td>
              <td style={{ padding: '4px', textAlign: 'center', fontWeight: 'bold', border: `1px solid ${S.borderColor}` }}>{row.total_wajib}</td>
              <td style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}`, backgroundColor: S.hadirBg }}><b style={{ color: S.hadirColor }}>{row.hadir}</b><div style={{ fontSize: '8px', color: S.hadirPctColor }}>{row.pct_hadir}%</div></td>
              <td style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}`, backgroundColor: S.badalBg }}><b style={{ color: S.badalColor }}>{row.badal}</b><div style={{ fontSize: '8px', color: S.badalPctColor }}>{row.pct_badal}%</div></td>
              <td style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}`, backgroundColor: S.kosongBg }}><b style={{ color: S.kosongColor }}>{row.kosong}</b><div style={{ fontSize: '8px', color: S.kosongPctColor }}>{row.pct_kosong}%</div></td>
              <td style={{ padding: '4px', textAlign: 'center', border: `1px solid ${S.borderColor}` }}><b style={{ fontSize: '12px', color: S.perfColor(row.persentase) }}>{row.persentase}%</b></td>
            </tr>
          ))}
        </tbody>
      </table>

      <PrintFooter total={`Total: ${processedData.length} guru`} S={S} />
    </div>
  )
}

function PrintPerGuru({ detail, fmtDate, startDate, endDate, namaTahunAjaran, namaMarhalah, badalAsHadir, statusFilterLabel, isBW, S }: any) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000' }}>
      <PrintHeader
        title="REKAP ABSEN PER GURU"
        subtitle={`${detail.guru.nama} | ${fmtDate(startDate)} - ${fmtDate(endDate)}`}
        meta={`T.A.: ${namaTahunAjaran} | Tingkat: ${namaMarhalah} | Status tampil: ${statusFilterLabel} | Badal: ${badalAsHadir ? 'Hadir' : 'Kosong'} | Jadwal: ${detail.kelas_ajar || '-'}`}
        S={S}
        isBW={isBW}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '10px' }}>
        <PrintSummary label="Wajib" value={detail.total.wajib} S={S} />
        <PrintSummary label="Hadir" value={`${detail.total.hadir} (${detail.total.pct_hadir}%)`} S={S} />
        <PrintSummary label="Badal" value={`${detail.total.badal} (${detail.total.pct_badal}%)`} S={S} />
        <PrintSummary label="Alfa" value={`${detail.total.kosong} (${detail.total.pct_kosong}%)`} S={S} />
        <PrintSummary label="Performa" value={`${detail.total.persentase}%`} S={S} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: S.headerBg, color: '#ffffff' }}>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}`, textAlign: 'left' }}>Waktu</th>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}` }}>Wajib</th>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}` }}>Hadir</th>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}` }}>Badal</th>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}` }}>Alfa</th>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}` }}>Performa</th>
          </tr>
        </thead>
        <tbody>
          {(['shubuh', 'ashar', 'maghrib'] as GuruSession[]).map(session => {
            const item = detail.per_sesi[session]
            return (
              <tr key={session}>
                <td style={{ padding: '5px', border: `1px solid ${S.borderColor}`, fontWeight: 'bold' }}>{SESSION_LABEL[session]}</td>
                <td style={{ padding: '5px', border: `1px solid ${S.borderColor}`, textAlign: 'center' }}>{item.wajib}</td>
                <td style={{ padding: '5px', border: `1px solid ${S.borderColor}`, textAlign: 'center' }}>{item.hadir} ({item.pct_hadir}%)</td>
                <td style={{ padding: '5px', border: `1px solid ${S.borderColor}`, textAlign: 'center' }}>{item.badal} ({item.pct_badal}%)</td>
                <td style={{ padding: '5px', border: `1px solid ${S.borderColor}`, textAlign: 'center' }}>{item.kosong} ({item.pct_kosong}%)</td>
                <td style={{ padding: '5px', border: `1px solid ${S.borderColor}`, textAlign: 'center', fontWeight: 'bold', color: S.perfColor(item.persentase) }}>{item.persentase}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
        <thead>
          <tr style={{ backgroundColor: S.headerBg, color: '#ffffff' }}>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}`, textAlign: 'left' }}>Tanggal</th>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}` }}>Waktu</th>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}`, textAlign: 'left' }}>Kelas/Gabungan</th>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}` }}>Status</th>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}` }}>Sumber</th>
            <th style={{ padding: '5px', border: `1px solid ${S.headerBorder}`, textAlign: 'left' }}>Catatan</th>
          </tr>
        </thead>
        <tbody>
          {detail.detail.map((row: any, idx: number) => {
            const statusColor = statusPrintColor(row.status, isBW)
            return (
              <tr key={`${row.tanggal}-${row.sesi}-${row.kelas}`} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : S.stripeBg }}>
                <td style={{ padding: '4px', border: `1px solid ${S.borderColor}` }}>{row.hari}, {row.tanggal}</td>
                <td style={{ padding: '4px', border: `1px solid ${S.borderColor}`, textAlign: 'center' }}>{row.sesi_label}</td>
                <td style={{ padding: '4px', border: `1px solid ${S.borderColor}` }}>{row.kelas}</td>
                <td style={{ padding: '4px', border: `1px solid ${S.borderColor}`, textAlign: 'center', backgroundColor: statusColor.bg, color: statusColor.color, fontWeight: 'bold' }}>{row.status_label}</td>
                <td style={{ padding: '4px', border: `1px solid ${S.borderColor}`, textAlign: 'center' }}>{sourceLabel(row)}{row.snapshot_berbeda ? '*' : ''}</td>
                <td style={{ padding: '4px', border: `1px solid ${S.borderColor}` }}>{row.catatan}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <PrintFooter total={`Total ditampilkan: ${detail.detail.length} waktu`} S={S} />
    </div>
  )
}

function PrintHeader({ title, subtitle, meta, S, isBW }: any) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: isBW ? '2px solid #000' : '2px solid #1e1b4b', paddingBottom: '8px' }}>
      <div style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', color: S.titleColor }}>{title}</div>
      <div style={{ fontSize: '11px', marginTop: '3px', color: S.subColor }}>{subtitle}</div>
      <div style={{ fontSize: '10px', marginTop: '2px', color: S.metaColor }}>{meta}</div>
    </div>
  )
}

function PrintSummary({ label, value, S }: any) {
  return (
    <div style={{ border: `1px solid ${S.borderColor}`, padding: '6px', backgroundColor: '#ffffff' }}>
      <div style={{ fontSize: '8px', color: S.metaColor, fontWeight: 'bold', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '2px' }}>{value}</div>
    </div>
  )
}

function PrintFooter({ total, S }: any) {
  return (
    <div style={{ marginTop: '10px', fontSize: '9px', color: S.metaColor, display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${S.borderColor}`, paddingTop: '6px' }}>
      <span>{total}</span>
      <span>Dicetak: {format(new Date(), 'd MMMM yyyy HH:mm', { locale: localeId })}</span>
    </div>
  )
}
