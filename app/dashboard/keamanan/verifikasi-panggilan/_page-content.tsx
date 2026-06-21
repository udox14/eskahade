'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Filter, RefreshCw, Search, Save, Loader2, CheckCircle, AlertTriangle,
  LayoutGrid, Table2, Printer, FileText, Users, ChevronDown, CalendarDays
} from 'lucide-react'
import { useReactToPrint } from '@/lib/pdf/client'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { Button, TextInput, NativeSelect, SegmentedControl } from '@mantine/core'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getAntrianPanggilan,
  getAsramaList,
  getCetakPanggilan,
  getKelasList,
  getMarhalahList,
  simpanVerifikasiPanggilan,
  type FilterStatusPanggilan,
  type KeputusanPanggilan,
  type VerifikasiPanggilanItem,
} from './actions'
import { EksekutorLandscapePrintView, TempelanAsramaPrintView } from './print-views'

type ViewMode = 'kartu' | 'tabel'
type Draft = { keputusan: KeputusanPanggilan; catatan: string }

const STATUS_OPTIONS: { value: FilterStatusPanggilan; label: string }[] = [
  { value: 'BELUM', label: 'Belum Diverifikasi' },
  { value: 'DIPANGGIL', label: 'Dipanggil' },
  { value: 'TIDAK_DIPANGGIL', label: 'Tidak Dipanggil' },
  { value: 'SEMUA', label: 'Semua' },
]

const SOURCE_LABEL = { pengajian: 'Ngaji', berjamaah: 'Jamaah' } as const

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })
}

function decisionClass(value?: KeputusanPanggilan | null) {
  return value === 'DIPANGGIL'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
}

function EventPills({ item }: { item: VerifikasiPanggilanItem }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {item.events.map((event, idx) => (
        <span
          key={`${event.source}-${event.tanggal}-${event.sesi}-${idx}`}
          title={event.gugur_karena || undefined}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${
            event.counted
              ? event.source === 'pengajian'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
          }`}
        >
          <span>{fmtDate(event.tanggal)}</span>
          <span>{SOURCE_LABEL[event.source]}</span>
          <span>{event.sesi.toUpperCase()}</span>
        </span>
      ))}
    </div>
  )
}

function DecisionButtons({
  value,
  onChange,
}: {
  value?: KeputusanPanggilan
  onChange: (value: KeputusanPanggilan) => void
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
      <button
        type="button"
        onClick={() => onChange('DIPANGGIL')}
        className={`px-3 py-1.5 text-[11px] font-black rounded-lg transition ${
          value === 'DIPANGGIL' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
        }`}
      >
        Dipanggil
      </button>
      <button
        type="button"
        onClick={() => onChange('TIDAK_DIPANGGIL')}
        className={`px-3 py-1.5 text-[11px] font-black rounded-lg transition ${
          value === 'TIDAK_DIPANGGIL' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
        }`}
      >
        Tidak
      </button>
    </div>
  )
}

function StudentCard({
  item,
  draft,
  onDecision,
  onNote,
}: {
  item: VerifikasiPanggilanItem
  draft?: Draft
  onDecision: (id: string, value: KeputusanPanggilan) => void
  onNote: (id: string, value: string) => void
}) {
  const decision = draft?.keputusan || item.existing_decision || item.suggested
  const counted = item.events.filter((event) => event.counted)
  const excused = item.events.filter((event) => !event.counted)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/70">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-slate-900">{item.nama}</h3>
            <span className={`text-[10px] font-black uppercase border rounded-full px-2 py-0.5 ${decisionClass(decision)}`}>
              {decision === 'DIPANGGIL' ? 'Dipanggil' : 'Tidak Dipanggil'}
            </span>
            {item.existing_decision && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">Sudah tersimpan</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {item.nis || '-'} - {item.asrama || '-'} / {item.kamar || '-'} - {item.kelas || '-'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DecisionButtons value={draft?.keputusan || item.existing_decision || item.suggested} onChange={(v) => onDecision(item.santri_id, v)} />
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 text-center">
        <div className="p-3">
          <p className="text-lg font-black text-rose-600">{item.jumlah_alfa_pengajian}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Tidak Ngaji</p>
        </div>
        <div className="p-3">
          <p className="text-lg font-black text-orange-600">{item.jumlah_alfa_berjamaah}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Tidak Jamaah</p>
        </div>
        <div className="p-3">
          <p className="text-lg font-black text-slate-800">{item.total_alfa}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Dihitung</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="mb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rincian Alfa</p>
          <EventPills item={item} />
        </div>

        {(item.izin.length > 0 || item.sakit.length > 0) && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
              <p className="text-[10px] font-black uppercase text-blue-500 mb-1">Izin Terkait</p>
              {item.izin.length === 0 ? <p className="text-xs text-blue-400">Tidak ada izin pulang.</p> : item.izin.map((izin) => (
                <p key={izin.id} className="text-xs text-blue-900 font-semibold">
                  {izin.alasan} {izin.is_sakit ? '(sakit)' : ''} - {izin.status}
                </p>
              ))}
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-[10px] font-black uppercase text-amber-500 mb-1">Data Sakit</p>
              {item.sakit.length === 0 ? <p className="text-xs text-amber-500">Tidak ada data sakit overlap.</p> : item.sakit.map((sakit) => (
                <p key={sakit.id} className="text-xs text-amber-900 font-semibold">
                  {sakit.sakit_apa || 'Sakit'} - {sakit.status_sakit || '-'}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="text-xs text-slate-500 flex-1">
            {counted.length} alfa dihitung, {excused.length} alfa gugur oleh izin/sakit.
          </div>
          <input
            value={draft?.catatan ?? item.existing_catatan ?? ''}
            onChange={(e) => onNote(item.santri_id, e.target.value)}
            placeholder="Catatan verifikator"
            className="w-full md:w-80 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  )
}

function TableView({
  rows,
  drafts,
  days,
  onDecision,
  onNote,
}: {
  rows: VerifikasiPanggilanItem[]
  drafts: Record<string, Draft>
  days: string[]
  onDecision: (id: string, value: KeputusanPanggilan) => void
  onNote: (id: string, value: string) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
      <table className="w-full min-w-[1080px] text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-3 py-3 text-left text-[10px] font-black text-slate-400 uppercase">Santri</th>
            <th className="px-3 py-3 text-center text-[10px] font-black text-slate-400 uppercase">Ngaji</th>
            <th className="px-3 py-3 text-center text-[10px] font-black text-slate-400 uppercase">Jamaah</th>
            {days.map((day) => (
              <th key={day} className="px-3 py-3 text-left text-[10px] font-black text-slate-400 uppercase min-w-32">{fmtDate(day)}</th>
            ))}
            <th className="px-3 py-3 text-left text-[10px] font-black text-slate-400 uppercase">Keputusan</th>
            <th className="px-3 py-3 text-left text-[10px] font-black text-slate-400 uppercase">Catatan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((item) => {
            const draft = drafts[item.santri_id]
            return (
              <tr key={item.santri_id} className="align-top hover:bg-slate-50/50">
                <td className="px-3 py-3 min-w-56">
                  <p className="font-bold text-slate-900 leading-tight">{item.nama}</p>
                  <p className="text-xs text-slate-400">{item.asrama || '-'} / {item.kamar || '-'} - {item.kelas || '-'}</p>
                </td>
                <td className="px-3 py-3 text-center font-black text-rose-600">{item.jumlah_alfa_pengajian}</td>
                <td className="px-3 py-3 text-center font-black text-orange-600">{item.jumlah_alfa_berjamaah}</td>
                {days.map((day) => {
                  const dayEvents = item.events.filter((event) => event.tanggal === day)
                  return (
                    <td key={`${item.santri_id}-${day}`} className="px-3 py-3">
                      {dayEvents.length === 0 ? (
                        <span className="text-slate-300">-</span>
                      ) : (
                        <div className="space-y-1">
                          {dayEvents.map((event, idx) => (
                            <p
                              key={`${event.source}-${event.sesi}-${idx}`}
                              title={event.gugur_karena || undefined}
                              className={`text-[11px] font-bold ${event.counted ? 'text-slate-800' : 'text-slate-400 line-through'}`}
                            >
                              {SOURCE_LABEL[event.source]}: {event.sesi.toUpperCase()}
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="px-3 py-3 min-w-44">
                  <DecisionButtons value={draft?.keputusan || item.existing_decision || item.suggested} onChange={(v) => onDecision(item.santri_id, v)} />
                </td>
                <td className="px-3 py-3 min-w-56">
                  <input
                    value={draft?.catatan ?? item.existing_catatan ?? ''}
                    onChange={(e) => onNote(item.santri_id, e.target.value)}
                    placeholder="Catatan"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function VerifikasiPanggilanPage() {
  const confirm = useConfirm()
  const [tanggalRef, setTanggalRef] = useState(todayYmd())
  const [tglPanggil, setTglPanggil] = useState(todayYmd())
  const [status, setStatus] = useState<FilterStatusPanggilan>('BELUM')
  const [viewMode, setViewMode] = useState<ViewMode>('kartu')
  const [selectedAsrama, setSelectedAsrama] = useState('')
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedMarhalah, setSelectedMarhalah] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<VerifikasiPanggilanItem[]>([])
  const [periode, setPeriode] = useState<{ start: string; end: string } | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [kelasList, setKelasList] = useState<any[]>([])
  const [asramaList, setAsramaList] = useState<string[]>([])
  const [marhalahList, setMarhalahList] = useState<any[]>([])
  const [printData, setPrintData] = useState<any | null>(null)

  const tempelanRef = useRef<HTMLDivElement>(null)
  const eksekutorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getKelasList().then(setKelasList)
    getAsramaList().then(setAsramaList)
    getMarhalahList().then(setMarhalahList)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setDrafts({})
    try {
      const res = await getAntrianPanggilan(tanggalRef, {
        asrama: selectedAsrama,
        kelasId: selectedKelas,
        marhalahId: selectedMarhalah,
        status,
      })
      setRows(res.rows)
      setPeriode(res.periode)
      setHasLoaded(true)
    } catch (err: any) {
      toast.error('Gagal memuat data', { description: err?.message || 'Terjadi kesalahan.' })
    } finally {
      setLoading(false)
    }
  }, [tanggalRef, selectedAsrama, selectedKelas, selectedMarhalah, status])

  const days = useMemo(() => {
    if (!periode) return []
    const result: string[] = []
    const current = new Date(`${periode.start}T12:00:00Z`)
    for (let i = 0; i < 7; i++) {
      result.push(current.toISOString().slice(0, 10))
      current.setUTCDate(current.getUTCDate() + 1)
    }
    return result
  }, [periode])

  const filteredRows = rows.filter((item) => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return true
    return item.nama.toLowerCase().includes(keyword) || (item.nis || '').includes(keyword)
  })

  const stats = {
    total: filteredRows.length,
    suggestedDipanggil: filteredRows.filter((item) => item.suggested === 'DIPANGGIL').length,
    drafts: Object.keys(drafts).length,
  }

  function setDecision(santriId: string, keputusan: KeputusanPanggilan) {
    const item = rows.find((row) => row.santri_id === santriId)
    setDrafts((prev) => ({
      ...prev,
      [santriId]: {
        keputusan,
        catatan: prev[santriId]?.catatan ?? item?.existing_catatan ?? '',
      },
    }))
  }

  function setNote(santriId: string, catatan: string) {
    const item = rows.find((row) => row.santri_id === santriId)
    setDrafts((prev) => ({
      ...prev,
      [santriId]: {
        keputusan: prev[santriId]?.keputusan ?? item?.existing_decision ?? item?.suggested ?? 'TIDAK_DIPANGGIL',
        catatan,
      },
    }))
  }

  function applySuggestions() {
    const next: Record<string, Draft> = {}
    filteredRows.forEach((item) => {
      next[item.santri_id] = { keputusan: item.suggested, catatan: item.existing_catatan || '' }
    })
    setDrafts((prev) => ({ ...prev, ...next }))
  }

  async function saveDrafts() {
    if (!periode) return
    const ids = Object.keys(drafts)
    if (ids.length === 0) return
    if (!await confirm(`Simpan keputusan untuk ${ids.length} santri?`)) return
    setSaving(true)
    try {
      const payload = ids.map((id) => {
        const item = rows.find((row) => row.santri_id === id)
        if (!item) throw new Error('Data santri tidak ditemukan.')
        return {
          santriId: id,
          keputusan: drafts[id].keputusan,
          catatan: drafts[id].catatan,
          snapshot: item,
        }
      })
      const res = await simpanVerifikasiPanggilan(periode, payload)
      if ('error' in res) {
        toast.error('Gagal menyimpan', { description: res.error })
        return
      }
      toast.success('Keputusan tersimpan', { description: `${res.count} santri berhasil diproses.` })
      setRows((prev) => status === 'BELUM' ? prev.filter((item) => !drafts[item.santri_id]) : prev)
      setDrafts({})
    } catch (err: any) {
      toast.error('Gagal menyimpan', { description: err?.message || 'Terjadi kesalahan.' })
    } finally {
      setSaving(false)
    }
  }

  const printTempelan = useReactToPrint({
    contentRef: tempelanRef,
    documentTitle: `Tempelan_Panggilan_${periode?.start || tanggalRef}`,
  })
  const printEksekutor = useReactToPrint({
    contentRef: eksekutorRef,
    documentTitle: `Eksekutor_Panggilan_${periode?.start || tanggalRef}`,
  })

  async function preparePrint(kind: 'tempelan' | 'eksekutor') {
    const data = await getCetakPanggilan(tanggalRef)
    setPrintData(data)
    const total = Object.values(data.grouped).reduce((acc: number, list: any) => acc + list.length, 0)
    if (total === 0) {
      toast.info('Belum ada keputusan DIPANGGIL untuk periode ini.')
      return
    }
    setTimeout(() => {
      if (kind === 'tempelan') printTempelan()
      else printEksekutor()
    }, 100)
  }

  return (
    <div className="pb-28 space-y-5">
      <DashboardPageHeader
        title="Verifikasi Panggilan"
        description="Gabungkan alfa pengajian, berjamaah, izin pulang, dan sakit sebelum menentukan daftar panggilan."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => preparePrint('tempelan')} variant="default" leftSection={<Printer className="w-4 h-4" />}>Cetak Tempelan</Button>
            <Button onClick={() => preparePrint('eksekutor')} variant="default" leftSection={<FileText className="w-4 h-4" />}>Cetak Eksekutor</Button>
            <Button onClick={loadData} loading={loading} leftSection={<RefreshCw className="w-4 h-4" />} color="blue">{hasLoaded ? 'Perbarui' : 'Tampilkan'}</Button>
          </div>
        }
      />

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-black text-slate-700">
          <Filter className="w-4 h-4" /> Filter
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">Tanggal Referensi</span>
            <input type="date" value={tanggalRef} onChange={(e) => setTanggalRef(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">Tanggal Panggil</span>
            <input type="date" value={tglPanggil} onChange={(e) => setTglPanggil(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as FilterStatusPanggilan)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">Asrama</span>
            <select value={selectedAsrama} onChange={(e) => setSelectedAsrama(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Semua Asrama</option>
              {asramaList.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">Marhalah</span>
            <select value={selectedMarhalah} onChange={(e) => { setSelectedMarhalah(e.target.value); setSelectedKelas('') }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Semua Marhalah</option>
              {marhalahList.map((m: any) => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">Kelas</span>
            <select value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Semua Kelas</option>
              {kelasList.filter((k) => !selectedMarhalah || String(k.marhalah_id) === String(selectedMarhalah)).map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
            </select>
          </label>
        </div>
      </div>

      {hasLoaded && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"><CalendarDays className="w-3.5 h-3.5" /> {periode?.start} s/d {periode?.end}</span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs font-black text-blue-700">{stats.total} santri</span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs font-black text-rose-700"><AlertTriangle className="w-3.5 h-3.5" /> {stats.suggestedDipanggil} saran dipanggil</span>
            {stats.drafts > 0 && <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs font-black text-emerald-700"><CheckCircle className="w-3.5 h-3.5" /> {stats.drafts} draft</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama/NIS" className="w-56 rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              <button onClick={() => setViewMode('kartu')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${viewMode === 'kartu' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutGrid className="w-3.5 h-3.5" /> Kartu</button>
              <button onClick={() => setViewMode('tabel')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${viewMode === 'tabel' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}><Table2 className="w-3.5 h-3.5" /> Tabel</button>
            </div>
            <button onClick={applySuggestions} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
              <ChevronDown className="w-4 h-4" /> Terapkan Saran
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-20 text-center text-slate-400">
          <Loader2 className="w-8 h-8 mx-auto animate-spin mb-3 text-blue-500" />
          <p className="font-bold">Memuat data verifikasi...</p>
        </div>
      ) : !hasLoaded ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-20 text-center">
          <Users className="w-12 h-12 mx-auto text-slate-200 mb-3" />
          <p className="font-black text-slate-700">Data belum ditampilkan</p>
          <p className="text-sm text-slate-500 mt-1">Pilih filter lalu tekan Tampilkan.</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-20 text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
          <p className="font-black text-slate-700">Tidak ada antrian sesuai filter.</p>
        </div>
      ) : viewMode === 'kartu' ? (
        <div className="space-y-4">
          {filteredRows.map((item) => (
            <StudentCard key={item.santri_id} item={item} draft={drafts[item.santri_id]} onDecision={setDecision} onNote={setNote} />
          ))}
        </div>
      ) : (
        <TableView rows={filteredRows} drafts={drafts} days={days} onDecision={setDecision} onNote={setNote} />
      )}

      {Object.keys(drafts).length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
          <button onClick={saveDrafts} disabled={saving} className="w-full rounded-2xl bg-slate-950 text-white px-5 py-4 shadow-2xl ring-4 ring-white flex items-center justify-between hover:bg-black disabled:opacity-60">
            <span className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black">{Object.keys(drafts).length}</span>
              <span className="text-left">
                <span className="block text-sm font-black">Simpan Keputusan</span>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Daftar panggilan akan diperbarui</span>
              </span>
            </span>
            {saving ? <Loader2 className="w-5 h-5 animate-spin text-emerald-400" /> : <Save className="w-5 h-5 text-emerald-400" />}
          </button>
        </div>
      )}

      <div className="fixed left-[-10000px] top-0 bg-white">
        <div ref={tempelanRef}>
          {printData && <TempelanAsramaPrintView data={printData} tglPanggil={tglPanggil} />}
        </div>
        <div ref={eksekutorRef}>
          {printData && <EksekutorLandscapePrintView data={printData} />}
        </div>
      </div>
    </div>
  )
}
