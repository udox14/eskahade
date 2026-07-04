'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CalendarClock, CheckCircle2, FileDown, Loader2, Plus, Printer, RefreshCw, Save, Trash2, UserPlus } from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useReactToPrint } from '@/lib/pdf/client'
import { TesKlasifikasiTabs } from '../_tabs'
import {
  autoPlotting,
  createEvent,
  getCetakJadwalData,
  getPenjadwalanData,
  getPlottingRows,
  getUnplottedSantri,
  hapusPlotting,
  resetPlotting,
  saveRulesAndPetugas,
  saveRuangan,
  saveSesi,
  setActiveEvent,
  tambahPesertaManual,
  type LevelSekolah,
  type RuanganInput,
  type SesiInput,
} from './actions'

type TabKey = 'event' | 'struktur' | 'petugas' | 'plotting' | 'cetak'
type PrintMode = 'all' | 'sesi' | 'ruangan'

const today = new Date().toISOString().slice(0, 10)
const levelOptions: LevelSekolah[] = ['SLTA', 'SLTP']

function formatDate(date: string) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function formatTime(row: { waktu_mulai?: string | null; waktu_selesai?: string | null }) {
  return `${row.waktu_mulai || '-'} - ${row.waktu_selesai || '-'}`
}

function keyOf(sesiId: number, ruanganId: number) {
  return `${sesiId}:${ruanganId}`
}

function parseKey(key: string) {
  const [sesiId, ruanganId] = key.split(':').map(Number)
  return { sesiId, ruanganId }
}

function cleanNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
        active ? 'bg-emerald-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function PrintSheet({ event, rows, mode, selectedSesi, selectedRuangan }: { event: any; rows: any[]; mode: PrintMode; selectedSesi: string; selectedRuangan: string }) {
  if (!event) return null
  const filtered = rows.filter(row => {
    if (mode === 'sesi' && selectedSesi) return String(row.sesi_id) === selectedSesi
    if (mode === 'ruangan' && selectedRuangan) return String(row.ruangan_id) === selectedRuangan
    return true
  })
  const groupsMap = new Map<string, any[]>()
  filtered.forEach(row => {
    const key = `${row.tanggal}|${row.sesi_id}|${row.ruangan_id}`
    groupsMap.set(key, [...(groupsMap.get(key) || []), row])
  })
  const groups = Array.from(groupsMap.values())

  return (
    <div>
      {groups.map((items, groupIndex) => {
        const first = items[0]
        return (
          <div
            key={`${first.sesi_id}-${first.ruangan_id}-${groupIndex}`}
            style={{
              width: '210mm',
              minHeight: '330mm',
              padding: '8mm',
              boxSizing: 'border-box',
              fontFamily: '"Arial Narrow", Arial, sans-serif',
              fontSize: '11pt',
              color: '#000',
              background: '#fff',
              breakAfter: 'page',
            }}
          >
            <h1 style={{ textAlign: 'center', fontWeight: 700, fontSize: '13pt', margin: '0 0 4mm', lineHeight: 1.2 }}>
              JADWAL PESERTA TES KLASIFIKASI TAHUN AJARAN {event.tahun_ajaran_nama || '____/____'}
            </h1>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1mm 8mm', marginBottom: '4mm', fontSize: '11pt' }}>
              <div><b>Tanggal:</b> {formatDate(first.tanggal)}</div>
              <div><b>Waktu:</b> {formatTime(first)}</div>
              <div><b>Ruangan:</b> {first.nama_ruangan}</div>
              <div><b>Tempat:</b> {first.tempat || '-'}</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '10mm' }} />
                <col />
                <col style={{ width: '29mm' }} />
                <col style={{ width: '31mm' }} />
                <col style={{ width: '25mm' }} />
                <col style={{ width: '24mm' }} />
                <col style={{ width: '27mm' }} />
              </colgroup>
              <thead>
                <tr>
                  {['NO', 'Nama Lengkap', 'Asrama/Kamar', 'Tanggal tes', 'Waktu', 'Ruangan', 'Tempat'].map(label => (
                    <th key={label} style={printTh}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => (
                  <tr key={row.id}>
                    <td style={{ ...printTd, textAlign: 'center' }}>{index + 1}</td>
                    <td style={printTd}>{row.nama_lengkap}</td>
                    <td style={printTd}>{row.asrama || '-'}/{row.kamar || '-'}</td>
                    <td style={printTd}>{formatDate(row.tanggal)}</td>
                    <td style={printTd}>{formatTime(row)}</td>
                    <td style={printTd}>{row.nama_ruangan}</td>
                    <td style={printTd}>{row.tempat || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

const printTh: React.CSSProperties = {
  border: '1pt solid #000',
  padding: '1.2mm',
  textAlign: 'center',
  fontWeight: 700,
  lineHeight: 1.1,
}

const printTd: React.CSSProperties = {
  border: '1pt solid #000',
  padding: '1.1mm',
  verticalAlign: 'middle',
  lineHeight: 1.12,
}

export default function PenjadwalanTesKlasifikasiPage() {
  const [tab, setTab] = useState<TabKey>('event')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<any>(null)
  const [newEvent, setNewEvent] = useState({ tahun_ajaran_id: 0, nama: '' })
  const [sesiList, setSesiList] = useState<SesiInput[]>([])
  const [ruanganList, setRuanganList] = useState<RuanganInput[]>([])
  const [rules, setRules] = useState<Record<string, { jenis_kelamin: 'L' | 'P'; levels: LevelSekolah[] }>>({})
  const [petugas, setPetugas] = useState<Record<string, { pengetes_guru_id: string; pendamping_guru_id: string }>>({})
  const [filters, setFilters] = useState({ search: '', jenis_kelamin: '', level: '', asrama: '' })
  const [manualTarget, setManualTarget] = useState({ santri_id: '', sesi_id: '', ruangan_id: '' })
  const [plottingRows, setPlottingRows] = useState<any[]>([])
  const [plottingFilters, setPlottingFilters] = useState({ sesi_id: '', ruangan_id: '', asrama: '' })
  const [loadingPlotting, setLoadingPlotting] = useState(false)
  const [unplottedPage, setUnplottedPage] = useState(1)
  const [unplottedPageSize, setUnplottedPageSize] = useState<'10' | '25' | '50' | '100' | 'all'>('25')
  const [printMode, setPrintMode] = useState<PrintMode>('all')
  const [selectedSesi, setSelectedSesi] = useState('')
  const [selectedRuangan, setSelectedRuangan] = useState('')
  const [printData, setPrintData] = useState<{ event: any; rows: any[] } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Jadwal Tes Klasifikasi',
    filename: 'jadwal-tes-klasifikasi.pdf',
    pageStyle: `
      @page { size: 210mm 330mm; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  })

  const activeEvent = data?.activeEvent
  const guruList = data?.guruList || []
  const plotting = plottingRows
  const unplotted = data?.unplotted || []
  const unplottedCount = data?.unplottedCount ?? unplotted.length

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const loaded = await getPenjadwalanData()
      setData(loaded)
      setSesiList(loaded.sesiList.length ? loaded.sesiList : [{ tanggal: today, nomor_sesi: 1, label: 'Sesi 1', waktu_mulai: '', waktu_selesai: '' }])
      setRuanganList(loaded.ruanganList.length ? loaded.ruanganList : [{ nomor_ruangan: 1, nama_ruangan: 'Ruang 1', tempat: '', kapasitas: 20 }])
      setRules(Object.fromEntries((loaded.rules || []).map((rule: any) => [keyOf(rule.sesi_id, rule.ruangan_id), { jenis_kelamin: rule.jenis_kelamin, levels: rule.levels }])))
      setPetugas(Object.fromEntries((loaded.petugas || []).map((row: any) => [keyOf(row.sesi_id, row.ruangan_id), {
        pengetes_guru_id: row.pengetes_guru_id ? String(row.pengetes_guru_id) : '',
        pendamping_guru_id: row.pendamping_guru_id ? String(row.pendamping_guru_id) : '',
      }])))
      setPrintData(null)
    } catch (error: any) {
      toast.error('Gagal memuat data penjadwalan', { description: error?.message })
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const asramaOptions = useMemo(() => {
    const values = new Set<string>()
    ;[...unplotted, ...plotting].forEach((row: any) => {
      if (row.asrama) values.add(row.asrama)
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'id-ID', { numeric: true }))
  }, [unplotted, plotting])

  const filteredUnplotted = useMemo(() => {
    return unplotted.filter((row: any) => {
      if (filters.search && !`${row.nama_lengkap} ${row.nis}`.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.jenis_kelamin && row.jenis_kelamin !== filters.jenis_kelamin) return false
      if (filters.level && row.level !== filters.level) return false
      if (filters.asrama && row.asrama !== filters.asrama) return false
      return true
    })
  }, [filters, unplotted])

  const unplottedPagination = useMemo(() => {
    const pageSize = unplottedPageSize === 'all' ? filteredUnplotted.length || 1 : Number(unplottedPageSize)
    const pageCount = Math.max(1, Math.ceil(filteredUnplotted.length / pageSize))
    const currentPage = Math.min(unplottedPage, pageCount)
    const start = (currentPage - 1) * pageSize
    const end = Math.min(start + pageSize, filteredUnplotted.length)
    return {
      currentPage,
      pageCount,
      start,
      end,
      rows: filteredUnplotted.slice(start, end),
    }
  }, [filteredUnplotted, unplottedPage, unplottedPageSize])

  useEffect(() => {
    setUnplottedPage(1)
    setManualTarget(prev => ({ ...prev, santri_id: '' }))
  }, [filters, unplottedPageSize])

  useEffect(() => {
    if (unplottedPage > unplottedPagination.pageCount) setUnplottedPage(unplottedPagination.pageCount)
  }, [unplottedPage, unplottedPagination.pageCount])

  const stats = useMemo(() => ({
    sesi: data?.sesiList?.length || 0,
    ruangan: data?.ruanganList?.length || 0,
    plotting: plotting.length,
    unplotted: unplottedCount,
  }), [data, plotting.length, unplottedCount])

  const saveEvent = async () => {
    setSaving(true)
    const res = await createEvent(newEvent)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success('Event dibuat dan diaktifkan')
    setNewEvent({ tahun_ajaran_id: 0, nama: '' })
    loadData(false)
  }

  const saveStruktur = async () => {
    if (!activeEvent) return
    setSaving(true)
    const sesiRes = await saveSesi(activeEvent.id, sesiList)
    if ('error' in sesiRes) {
      setSaving(false)
      return toast.error(sesiRes.error)
    }
    const ruangRes = await saveRuangan(activeEvent.id, ruanganList)
    setSaving(false)
    if ('error' in ruangRes) return toast.error(ruangRes.error)
    toast.success('Sesi dan ruangan tersimpan')
    loadData(false)
  }

  const saveMatrix = async () => {
    if (!activeEvent) return
    setSaving(true)
    const ruleRows = Object.entries(rules).map(([key, value]) => {
      const parsed = parseKey(key)
      return { sesi_id: parsed.sesiId, ruangan_id: parsed.ruanganId, jenis_kelamin: value.jenis_kelamin, levels: value.levels }
    })
    const petugasRows = Object.entries(petugas).map(([key, value]) => {
      const parsed = parseKey(key)
      return {
        sesi_id: parsed.sesiId,
        ruangan_id: parsed.ruanganId,
        pengetes_guru_id: value.pengetes_guru_id ? Number(value.pengetes_guru_id) : null,
        pendamping_guru_id: value.pendamping_guru_id ? Number(value.pendamping_guru_id) : null,
      }
    })
    const res = await saveRulesAndPetugas(activeEvent.id, ruleRows, petugasRows)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success('Rule dan petugas tersimpan')
    loadData(false)
  }

  const runAutoPlot = async () => {
    if (!activeEvent) return
    if (!window.confirm('Auto plotting akan menghapus plotting lama pada event ini. Lanjutkan?')) return
    setSaving(true)
    const res = await autoPlotting(activeEvent.id)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success(`Auto plotting selesai: ${res.count} peserta terplot`)
    await loadData(false)
    await refreshUnplotted()
    await refreshPlotting()
  }

  const runResetPlotting = async () => {
    if (!activeEvent) return
    if (!window.confirm('Kosongkan semua hasil plotting?')) return
    setSaving(true)
    const res = await resetPlotting(activeEvent.id)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success('Plotting dikosongkan')
    await loadData(false)
    await refreshUnplotted()
    await refreshPlotting()
  }

  const addManual = async () => {
    if (!activeEvent || !manualTarget.santri_id || !manualTarget.sesi_id || !manualTarget.ruangan_id) return toast.error('Pilih santri, sesi, dan ruangan dulu.')
    setSaving(true)
    const res = await tambahPesertaManual(activeEvent.id, Number(manualTarget.sesi_id), Number(manualTarget.ruangan_id), manualTarget.santri_id)
    setSaving(false)
    if ('error' in res) return toast.error(res.error)
    toast.success('Santri ditambahkan ke ruangan')
    setManualTarget(prev => ({ ...prev, santri_id: '' }))
    await loadData(false)
    await refreshUnplotted()
    await refreshPlotting()
  }

  const removePlotting = async (id: number) => {
    if (!window.confirm('Keluarkan santri ini dari plotting?')) return
    const res = await hapusPlotting(id)
    if ('error' in res) return toast.error(res.error)
    toast.success('Peserta dikeluarkan dari plotting')
    await loadData(false)
    await refreshUnplotted()
    await refreshPlotting()
  }

  const refreshUnplotted = async () => {
    if (!activeEvent) return
    const rows = await getUnplottedSantri(activeEvent.id, filters)
    const hasFilter = Boolean(filters.search || filters.jenis_kelamin || filters.level || filters.asrama)
    setData((prev: any) => ({ ...prev, unplotted: rows, unplottedCount: hasFilter ? prev?.unplottedCount : rows.length }))
  }

  const refreshPlotting = async () => {
    if (!activeEvent) return
    setLoadingPlotting(true)
    try {
      const rows = await getPlottingRows(activeEvent.id, plottingFilters)
      setPlottingRows(rows)
    } finally {
      setLoadingPlotting(false)
    }
  }

  useEffect(() => {
    if (tab === 'plotting' && activeEvent && unplotted.length === 0 && unplottedCount > 0) {
      refreshUnplotted()
    }
  }, [tab, activeEvent?.id])

  const updateRule = (sesiId: number, ruanganId: number, patch: Partial<{ jenis_kelamin: 'L' | 'P'; levels: LevelSekolah[] }>) => {
    const key = keyOf(sesiId, ruanganId)
    setRules(prev => ({ ...prev, [key]: { jenis_kelamin: prev[key]?.jenis_kelamin || 'L', levels: prev[key]?.levels || ['SLTA'], ...patch } }))
  }

  const updatePetugas = (sesiId: number, ruanganId: number, patch: Partial<{ pengetes_guru_id: string; pendamping_guru_id: string }>) => {
    const key = keyOf(sesiId, ruanganId)
    setPetugas(prev => ({ ...prev, [key]: { pengetes_guru_id: prev[key]?.pengetes_guru_id || '', pendamping_guru_id: prev[key]?.pendamping_guru_id || '', ...patch } }))
  }

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20">
      <DashboardPageHeader
        title="Penjadwalan Tes Klasifikasi"
        description="Atur sesi, ruangan, petugas, plotting peserta, dan cetak jadwal."
      />
      <TesKlasifikasiTabs />

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'event'} onClick={() => setTab('event')}>1. Event</TabButton>
        <TabButton active={tab === 'struktur'} onClick={() => setTab('struktur')}>2. Sesi & Ruangan</TabButton>
        <TabButton active={tab === 'petugas'} onClick={() => setTab('petugas')}>3. Rule & Petugas</TabButton>
        <TabButton active={tab === 'plotting'} onClick={() => setTab('plotting')}>4. Plotting</TabButton>
      </div>

      {activeEvent && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Sesi" value={stats.sesi} />
          <Stat label="Ruangan" value={stats.ruangan} />
          <Stat label="Terplot" value={stats.plotting} />
          <Stat label="Belum Terplot" value={stats.unplotted} tone={stats.unplotted ? 'amber' : 'emerald'} />
        </div>
      )}

      {tab === 'event' && (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><CalendarClock className="h-4 w-4" /> Event Aktif</div>
          {activeEvent ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-bold text-emerald-900">{activeEvent.nama}</p>
              <p className="text-sm text-emerald-700">Tahun ajaran {activeEvent.tahun_ajaran_nama || '-'}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              Belum ada event aktif.
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <select
              value={newEvent.tahun_ajaran_id}
              onChange={e => setNewEvent(prev => ({ ...prev, tahun_ajaran_id: Number(e.target.value) }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value={0}>Pilih tahun ajaran</option>
              {(data?.tahunAjaranList || []).map((ta: any) => <option key={ta.id} value={ta.id}>{ta.nama}{ta.is_active ? ' (aktif)' : ''}</option>)}
            </select>
            <input
              value={newEvent.nama}
              onChange={e => setNewEvent(prev => ({ ...prev, nama: e.target.value }))}
              placeholder="Contoh: Tes Klasifikasi Santri Baru"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button onClick={saveEvent} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <Plus className="h-4 w-4" /> Buat Event
            </button>
          </div>
          {(data?.allEvents || []).length > 0 && (
            <div className="space-y-2">
              {(data.allEvents || []).map((event: any) => (
                <div key={event.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                  <div>
                    <p className="font-bold text-slate-800">{event.nama}</p>
                    <p className="text-xs text-slate-500">{event.tahun_ajaran_nama || '-'}</p>
                  </div>
                  <button
                    onClick={async () => { await setActiveEvent(event.id); toast.success('Event aktif diubah'); loadData(false) }}
                    disabled={event.is_active === 1}
                    className="rounded-lg border px-3 py-1.5 text-xs font-bold disabled:bg-emerald-50 disabled:text-emerald-700"
                  >
                    {event.is_active === 1 ? 'Aktif' : 'Aktifkan'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'struktur' && (
        <section className="space-y-5">
          {!activeEvent ? <NeedEvent /> : (
            <>
              <div className="rounded-xl border bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Sesi Tes</h3>
                  <button onClick={() => setSesiList(prev => [...prev, { tanggal: today, nomor_sesi: prev.length + 1, label: `Sesi ${prev.length + 1}`, waktu_mulai: '', waktu_selesai: '' }])} className="rounded-lg border px-3 py-1.5 text-xs font-bold"><Plus className="mr-1 inline h-3.5 w-3.5" />Tambah</button>
                </div>
                <div className="space-y-3">
                  {sesiList.map((sesi, index) => (
                    <div key={sesi.id || index} className="grid gap-2 md:grid-cols-[140px_100px_1fr_120px_120px_44px]">
                      <input type="date" value={sesi.tanggal} onChange={e => setSesiList(prev => prev.map((s, i) => i === index ? { ...s, tanggal: e.target.value } : s))} className="rounded-lg border px-3 py-2 text-sm" />
                      <input type="number" value={sesi.nomor_sesi} onChange={e => setSesiList(prev => prev.map((s, i) => i === index ? { ...s, nomor_sesi: cleanNumber(e.target.value, index + 1) } : s))} className="rounded-lg border px-3 py-2 text-sm" />
                      <input value={sesi.label} onChange={e => setSesiList(prev => prev.map((s, i) => i === index ? { ...s, label: e.target.value } : s))} className="rounded-lg border px-3 py-2 text-sm" />
                      <input type="time" value={sesi.waktu_mulai} onChange={e => setSesiList(prev => prev.map((s, i) => i === index ? { ...s, waktu_mulai: e.target.value } : s))} className="rounded-lg border px-3 py-2 text-sm" />
                      <input type="time" value={sesi.waktu_selesai} onChange={e => setSesiList(prev => prev.map((s, i) => i === index ? { ...s, waktu_selesai: e.target.value } : s))} className="rounded-lg border px-3 py-2 text-sm" />
                      <button onClick={() => setSesiList(prev => prev.filter((_, i) => i !== index))} className="rounded-lg border text-red-600"><Trash2 className="mx-auto h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Ruangan</h3>
                  <button onClick={() => setRuanganList(prev => [...prev, { nomor_ruangan: prev.length + 1, nama_ruangan: `Ruang ${prev.length + 1}`, tempat: '', kapasitas: 20 }])} className="rounded-lg border px-3 py-1.5 text-xs font-bold"><Plus className="mr-1 inline h-3.5 w-3.5" />Tambah</button>
                </div>
                <div className="space-y-3">
                  {ruanganList.map((room, index) => (
                    <div key={room.id || index} className="grid gap-2 md:grid-cols-[100px_1fr_1fr_120px_44px]">
                      <input type="number" value={room.nomor_ruangan} onChange={e => setRuanganList(prev => prev.map((r, i) => i === index ? { ...r, nomor_ruangan: cleanNumber(e.target.value, index + 1) } : r))} className="rounded-lg border px-3 py-2 text-sm" />
                      <input value={room.nama_ruangan} onChange={e => setRuanganList(prev => prev.map((r, i) => i === index ? { ...r, nama_ruangan: e.target.value } : r))} className="rounded-lg border px-3 py-2 text-sm" />
                      <input value={room.tempat} onChange={e => setRuanganList(prev => prev.map((r, i) => i === index ? { ...r, tempat: e.target.value } : r))} placeholder="Tempat" className="rounded-lg border px-3 py-2 text-sm" />
                      <input type="number" value={room.kapasitas} onChange={e => setRuanganList(prev => prev.map((r, i) => i === index ? { ...r, kapasitas: cleanNumber(e.target.value, 20) } : r))} className="rounded-lg border px-3 py-2 text-sm" />
                      <button onClick={() => setRuanganList(prev => prev.filter((_, i) => i !== index))} className="rounded-lg border text-red-600"><Trash2 className="mx-auto h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={saveStruktur} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                <Save className="h-4 w-4" /> Simpan Sesi & Ruangan
              </button>
            </>
          )}
        </section>
      )}

      {tab === 'petugas' && (
        <section className="rounded-xl border bg-white p-5">
          {!activeEvent ? <NeedEvent /> : data.sesiList.length === 0 || data.ruanganList.length === 0 ? (
            <NeedStructure />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">Rule Plotting & Petugas</h3>
                  <p className="text-xs text-slate-500">Setiap kombinasi sesi-ruangan perlu jenis kelamin dan level peserta.</p>
                </div>
                <button onClick={saveMatrix} disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Simpan</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                      <th className="p-3">Sesi</th>
                      <th className="p-3">Ruangan</th>
                      <th className="p-3">JK</th>
                      <th className="p-3">Level</th>
                      <th className="p-3">Pengetes</th>
                      <th className="p-3">Pendamping</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.sesiList.flatMap((sesi: any) => data.ruanganList.map((room: any) => {
                      const key = keyOf(sesi.id, room.id)
                      const currentRule = rules[key] || { jenis_kelamin: 'L', levels: [] }
                      const currentPetugas = petugas[key] || { pengetes_guru_id: '', pendamping_guru_id: '' }
                      return (
                        <tr key={key}>
                          <td className="p-3 font-semibold">{formatDate(sesi.tanggal)}<br /><span className="text-xs text-slate-400">{sesi.label} ({formatTime(sesi)})</span></td>
                          <td className="p-3 font-semibold">{room.nama_ruangan}<br /><span className="text-xs text-slate-400">{room.tempat || '-'} · {room.kapasitas} peserta</span></td>
                          <td className="p-3">
                            <select value={currentRule.jenis_kelamin} onChange={e => updateRule(sesi.id, room.id, { jenis_kelamin: e.target.value as 'L' | 'P' })} className="rounded-lg border px-2 py-1.5">
                              <option value="L">Laki-laki</option>
                              <option value="P">Perempuan</option>
                            </select>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              {levelOptions.map(level => (
                                <label key={level} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold">
                                  <input
                                    type="checkbox"
                                    checked={currentRule.levels.includes(level)}
                                    onChange={e => {
                                      const next = e.target.checked ? [...currentRule.levels, level] : currentRule.levels.filter(item => item !== level)
                                      updateRule(sesi.id, room.id, { levels: levelOptions.filter(item => next.includes(item)) })
                                    }}
                                  />
                                  {level}
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="p-3">
                            <select value={currentPetugas.pengetes_guru_id} onChange={e => updatePetugas(sesi.id, room.id, { pengetes_guru_id: e.target.value })} className="w-full rounded-lg border px-2 py-1.5">
                              <option value="">-</option>
                              {guruList.map((guru: any) => <option key={guru.id} value={guru.id}>{guru.nama}</option>)}
                            </select>
                          </td>
                          <td className="p-3">
                            <select value={currentPetugas.pendamping_guru_id} onChange={e => updatePetugas(sesi.id, room.id, { pendamping_guru_id: e.target.value })} className="w-full rounded-lg border px-2 py-1.5">
                              <option value="">-</option>
                              {guruList.map((guru: any) => <option key={guru.id} value={guru.id}>{guru.nama}</option>)}
                            </select>
                          </td>
                        </tr>
                      )
                    }))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'plotting' && (
        <section className="space-y-5">
          {!activeEvent ? <NeedEvent /> : (
            <>
              <div className="flex flex-wrap gap-2">
                <button onClick={runAutoPlot} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Auto Plotting</button>
                <button onClick={runResetPlotting} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Reset Plotting</button>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <h3 className="mb-3 font-bold text-slate-800">Tambah Manual dari Santri Belum Terplot</h3>
                <div className="grid gap-2 md:grid-cols-5">
                  <input value={filters.search} onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))} placeholder="Cari nama/NIS" className="rounded-lg border px-3 py-2 text-sm" />
                  <select value={filters.jenis_kelamin} onChange={e => setFilters(prev => ({ ...prev, jenis_kelamin: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Semua JK</option><option value="L">Laki-laki</option><option value="P">Perempuan</option>
                  </select>
                  <select value={filters.level} onChange={e => setFilters(prev => ({ ...prev, level: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Semua Level</option><option value="SLTA">SLTA</option><option value="SLTP">SLTP</option><option value="LAINNYA">LAINNYA</option>
                  </select>
                  <select value={filters.asrama} onChange={e => setFilters(prev => ({ ...prev, asrama: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Semua Asrama</option>{asramaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <button onClick={refreshUnplotted} className="rounded-lg border px-3 py-2 text-sm font-bold">Refresh</button>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-[1.3fr_1fr_1fr_auto]">
                  <select value={manualTarget.santri_id} onChange={e => setManualTarget(prev => ({ ...prev, santri_id: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih santri ({filteredUnplotted.length})</option>
                    {unplottedPagination.rows.map((row: any) => <option key={row.id} value={row.id}>{row.nama_lengkap} · {row.jenis_kelamin} · {row.level} · {row.asrama || '-'}/{row.kamar || '-'}</option>)}
                  </select>
                  <select value={manualTarget.sesi_id} onChange={e => setManualTarget(prev => ({ ...prev, sesi_id: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih sesi</option>
                    {data.sesiList.map((sesi: any) => <option key={sesi.id} value={sesi.id}>{formatDate(sesi.tanggal)} · {sesi.label}</option>)}
                  </select>
                  <select value={manualTarget.ruangan_id} onChange={e => setManualTarget(prev => ({ ...prev, ruangan_id: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Pilih ruangan</option>
                    {data.ruanganList.map((room: any) => <option key={room.id} value={room.id}>{room.nama_ruangan} · {room.tempat || '-'}</option>)}
                  </select>
                  <button onClick={addManual} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><UserPlus className="h-4 w-4" /> Tambah</button>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  <div>
                    Menampilkan {filteredUnplotted.length === 0 ? 0 : unplottedPagination.start + 1}-{unplottedPagination.end} dari {filteredUnplotted.length} santri belum terplot
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Per halaman</span>
                    <select
                      value={unplottedPageSize}
                      onChange={e => setUnplottedPageSize(e.target.value as '10' | '25' | '50' | '100' | 'all')}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="all">Semua</option>
                    </select>
                    <button
                      onClick={() => setUnplottedPage(page => Math.max(1, page - 1))}
                      disabled={unplottedPagination.currentPage <= 1 || unplottedPageSize === 'all'}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 font-bold disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span>Hal {unplottedPagination.currentPage}/{unplottedPagination.pageCount}</span>
                    <button
                      onClick={() => setUnplottedPage(page => Math.min(unplottedPagination.pageCount, page + 1))}
                      disabled={unplottedPagination.currentPage >= unplottedPagination.pageCount || unplottedPageSize === 'all'}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 font-bold disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Hasil Plotting</h3>
                </div>
                <div className="mb-4 grid gap-2 md:grid-cols-4">
                  <select value={plottingFilters.sesi_id} onChange={e => setPlottingFilters(prev => ({ ...prev, sesi_id: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Semua Sesi</option>
                    {data.sesiList.map((sesi: any) => <option key={sesi.id} value={sesi.id}>{formatDate(sesi.tanggal)} · {sesi.label}</option>)}
                  </select>
                  <select value={plottingFilters.ruangan_id} onChange={e => setPlottingFilters(prev => ({ ...prev, ruangan_id: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Semua Ruangan</option>
                    {data.ruanganList.map((room: any) => <option key={room.id} value={room.id}>{room.nama_ruangan}</option>)}
                  </select>
                  <select value={plottingFilters.asrama} onChange={e => setPlottingFilters(prev => ({ ...prev, asrama: e.target.value }))} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="">Semua Asrama</option>
                    {asramaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <button onClick={refreshPlotting} disabled={loadingPlotting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {loadingPlotting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tampilkan'}
                  </button>
                </div>
                <div className="max-h-[520px] overflow-auto rounded-xl border">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                      <tr><th className="p-3">No</th><th className="p-3">Santri</th><th className="p-3">Asrama/Kamar</th><th className="p-3">Sesi</th><th className="p-3">Ruangan</th><th className="p-3"></th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {plotting.map((row: any, index: number) => (
                        <tr key={row.id}>
                          <td className="p-3">{index + 1}</td>
                          <td className="p-3 font-semibold">{row.nama_lengkap}<br /><span className="text-xs text-slate-400">{row.nis} · {row.jenis_kelamin} · {row.sekolah || '-'}</span></td>
                          <td className="p-3">{row.asrama || '-'}/{row.kamar || '-'}</td>
                          <td className="p-3">{formatDate(row.tanggal)}<br /><span className="text-xs text-slate-400">{row.sesi_label} · {formatTime(row)}</span></td>
                          <td className="p-3">{row.nama_ruangan}<br /><span className="text-xs text-slate-400">{row.tempat || '-'}</span></td>
                          <td className="p-3 text-right"><button onClick={() => removePlotting(row.id)} className="rounded-lg border border-red-200 p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                        </tr>
                      ))}
                      {plotting.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">Belum ada peserta terplot.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'cetak' && (
        <section className="space-y-5 rounded-xl border bg-white p-5">
          {!activeEvent ? <NeedEvent /> : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Mode Cetak</label>
                  <select value={printMode} onChange={e => setPrintMode(e.target.value as PrintMode)} className="rounded-lg border px-3 py-2 text-sm">
                    <option value="all">Semua</option>
                    <option value="sesi">Per Sesi</option>
                    <option value="ruangan">Per Ruangan</option>
                  </select>
                </div>
                {printMode === 'sesi' && (
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Sesi</label>
                    <select value={selectedSesi} onChange={e => setSelectedSesi(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                      <option value="">Pilih sesi</option>
                      {data.sesiList.map((sesi: any) => <option key={sesi.id} value={sesi.id}>{formatDate(sesi.tanggal)} · {sesi.label}</option>)}
                    </select>
                  </div>
                )}
                {printMode === 'ruangan' && (
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Ruangan</label>
                    <select value={selectedRuangan} onChange={e => setSelectedRuangan(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                      <option value="">Pilih ruangan</option>
                      {data.ruanganList.map((room: any) => <option key={room.id} value={room.id}>{room.nama_ruangan}</option>)}
                    </select>
                  </div>
                )}
                <button
                  onClick={async () => {
                    const loaded = await getCetakJadwalData(activeEvent.id)
                    setPrintData(loaded)
                    window.setTimeout(() => handlePrint(), 100)
                  }}
                  disabled={plotting.length === 0 || (printMode === 'sesi' && !selectedSesi) || (printMode === 'ruangan' && !selectedRuangan)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
                >
                  <Printer className="h-4 w-4" /> Cetak / PDF
                </button>
              </div>
              <div className="rounded-xl border bg-slate-100 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-600"><FileDown className="h-4 w-4" /> Preview kecil</div>
                <div className="max-h-[640px] overflow-auto">
                  <div style={{ zoom: 0.36 }} className="origin-top-left bg-white shadow">
                    <PrintSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} />
                  </div>
                </div>
              </div>
              <div className="hidden">
                <div ref={printRef}>
                  <PrintSheet event={printData?.event} rows={printData?.rows || []} mode={printMode} selectedSesi={selectedSesi} selectedRuangan={selectedRuangan} />
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'amber' | 'emerald' }) {
  const cls = tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-800' : tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-800'
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-xs font-bold uppercase opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  )
}

function NeedEvent() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      Buat atau aktifkan event terlebih dahulu.
    </div>
  )
}

function NeedStructure() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      Simpan sesi dan ruangan terlebih dahulu.
    </div>
  )
}
