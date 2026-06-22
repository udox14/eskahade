'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Filter, Gavel,
  Loader2, RefreshCw, Save, Search, Users
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import {
  getFinalVonisQueue,
  simpanFinalVonis,
  type FinalFilterStatus,
  type FinalStatus,
  type FinalVonisItem,
} from './final-vonis'

type SourceType = 'pengajian' | 'berjamaah'
type Draft = { status: FinalStatus; catatan: string }

const STATUS_OPTIONS: { value: FinalFilterStatus; label: string }[] = [
  { value: 'BELUM', label: 'Belum Divonis' },
  { value: 'MANGKIR', label: 'Mangkir/Susulan' },
  { value: 'SELESAI', label: 'Selesai' },
  { value: 'SEMUA', label: 'Semua' },
]

const FINAL_BUTTONS: { value: FinalStatus; label: string; className: string }[] = [
  { value: 'ALFA', label: 'Alfa', className: 'bg-rose-600 text-white hover:bg-rose-700' },
  { value: 'IZIN', label: 'Izin', className: 'bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200' },
  { value: 'SAKIT', label: 'Sakit', className: 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200' },
  { value: 'HADIR', label: 'Hadir', className: 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200' },
  { value: 'MANGKIR', label: 'Mangkir', className: 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200' },
]

const FINAL_BADGE: Record<FinalStatus, string> = {
  ALFA: 'bg-rose-50 text-rose-700 border-rose-200',
  IZIN: 'bg-blue-50 text-blue-700 border-blue-200',
  SAKIT: 'bg-amber-50 text-amber-700 border-amber-200',
  HADIR: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MANGKIR: 'bg-slate-100 text-slate-700 border-slate-300',
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

function sourceLabel(source: SourceType) {
  return source === 'pengajian' ? 'Pengajian' : 'Berjamaah'
}

function sessionLabel(source: SourceType, sesi: string) {
  if (source === 'pengajian') {
    const map: Record<string, string> = { shubuh: 'Shubuh', ashar: 'Ashar', maghrib: 'Maghrib' }
    return map[sesi] || sesi
  }
  const map: Record<string, string> = { shubuh: 'Shubuh', dzuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya' }
  return map[sesi] || sesi
}

function VonisButtons({
  value,
  onChange,
}: {
  value?: FinalStatus | null
  onChange: (status: FinalStatus) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FINAL_BUTTONS.map((button) => (
        <button
          key={button.value}
          type="button"
          onClick={() => onChange(button.value)}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition active:scale-95 ${
            value === button.value ? button.className : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {button.label}
        </button>
      ))}
    </div>
  )
}

function VonisCard({
  item,
  draft,
  onStatus,
  onNote,
  source,
}: {
  item: FinalVonisItem
  draft?: Draft
  onStatus: (item: FinalVonisItem, status: FinalStatus) => void
  onNote: (item: FinalVonisItem, catatan: string) => void
  source: SourceType
}) {
  const status = draft?.status || item.final_status

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-slate-900">{item.nama}</h3>
            {status ? (
              <span className={`text-[10px] font-black uppercase border rounded-full px-2 py-0.5 ${FINAL_BADGE[status]}`}>
                {status}
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase border rounded-full px-2 py-0.5 bg-rose-50 text-rose-700 border-rose-200">
                Belum Final
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {item.nis || '-'} - {item.asrama || '-'} / {item.kamar || '-'}
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs font-black text-slate-800">{fmtDate(item.tanggal)}</p>
          <p className="text-[11px] text-slate-500">{sourceLabel(source)} - {sessionLabel(source, item.sesi)}</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {item.catatan_panggilan && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
            <p className="text-[10px] font-black uppercase text-blue-500">Catatan Panggilan</p>
            <p className="text-xs text-blue-900 font-medium mt-0.5">{item.catatan_panggilan}</p>
          </div>
        )}
        <VonisButtons value={status} onChange={(next) => onStatus(item, next)} />
        <input
          value={draft?.catatan ?? item.final_catatan ?? ''}
          onChange={(e) => onNote(item, e.target.value)}
          placeholder="Catatan vonis final"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}

export default function FinalVonisPage({
  source,
  title,
  description,
}: {
  source: SourceType
  title: string
  description: string
}) {
  const confirm = useConfirm()
  const [tanggalRef, setTanggalRef] = useState(todayYmd())
  const [status, setStatus] = useState<FinalFilterStatus>('BELUM')
  const [search, setSearch] = useState('')
  const [asrama, setAsrama] = useState('')
  const [rows, setRows] = useState<FinalVonisItem[]>([])
  const [periode, setPeriode] = useState<{ start: string; end: string } | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [page, setPage] = useState(1)

  const loadData = useCallback(async () => {
    setLoading(true)
    setDrafts({})
    try {
      const res = await getFinalVonisQueue(source, tanggalRef, { status, search, asrama })
      setRows(res.rows)
      setPeriode(res.periode)
      setHasLoaded(true)
      setPage(1)
    } catch (err: any) {
      toast.error('Gagal memuat data', { description: err?.message || 'Terjadi kesalahan.' })
    } finally {
      setLoading(false)
    }
  }, [source, tanggalRef, status, search, asrama])

  const asramaList = useMemo(() => Array.from(new Set(rows.map((item) => item.asrama).filter(Boolean) as string[])).sort(), [rows])
  const totalPages = Math.ceil(rows.length / 20)
  const paged = rows.slice((page - 1) * 20, page * 20)
  const totalDrafts = Object.keys(drafts).length

  function setDraftStatus(item: FinalVonisItem, finalStatus: FinalStatus) {
    setDrafts((prev) => ({
      ...prev,
      [item.key]: {
        status: finalStatus,
        catatan: prev[item.key]?.catatan ?? item.final_catatan ?? '',
      },
    }))
  }

  function setDraftNote(item: FinalVonisItem, catatan: string) {
    setDrafts((prev) => ({
      ...prev,
      [item.key]: {
        status: prev[item.key]?.status ?? item.final_status ?? 'ALFA',
        catatan,
      },
    }))
  }

  async function handleSave() {
    const keys = Object.keys(drafts)
    if (!keys.length) return
    if (!await confirm(`Simpan vonis final untuk ${keys.length} data?`)) return

    setSaving(true)
    try {
      const payload = keys.map((key) => {
        const item = rows.find((row) => row.key === key)
        if (!item) throw new Error('Data vonis tidak ditemukan.')
        return {
          panggilanId: item.panggilan_id,
          santriId: item.santri_id,
          periodeAwal: item.periode_awal,
          periodeAkhir: item.periode_akhir,
          source: item.source,
          tanggal: item.tanggal,
          sesi: item.sesi,
          status: drafts[key].status,
          catatan: drafts[key].catatan,
        }
      })
      const res = await simpanFinalVonis(payload)
      if ('error' in res) {
        toast.error('Gagal menyimpan', { description: res.error })
        return
      }
      toast.success('Vonis final tersimpan', { description: `${res.count} data berhasil diproses.` })
      if (status === 'BELUM') setRows((prev) => prev.filter((item) => !drafts[item.key]))
      setDrafts({})
    } catch (err: any) {
      toast.error('Gagal menyimpan', { description: err?.message || 'Terjadi kesalahan.' })
    } finally {
      setSaving(false)
    }
  }

  const counts = {
    alfa: rows.filter((item) => (drafts[item.key]?.status || item.final_status) === 'ALFA').length,
    mangkir: rows.filter((item) => (drafts[item.key]?.status || item.final_status) === 'MANGKIR').length,
  }

  return (
    <div className="max-w-7xl mx-auto pb-28 space-y-5">
      <DashboardPageHeader
        title={title}
        description={description}
        action={
          <button onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {hasLoaded ? 'Perbarui' : 'Tampilkan'}
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-black text-slate-700">
          <Filter className="w-4 h-4" /> Filter Vonis
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">Tanggal Referensi</span>
            <input type="date" value={tanggalRef} onChange={(e) => setTanggalRef(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as FinalFilterStatus)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">Asrama</span>
            <select value={asrama} onChange={(e) => setAsrama(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Semua Asrama</option>
              {asramaList.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase text-slate-400">Cari</span>
            <div className="relative mt-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nama/NIS" className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </label>
        </div>
      </div>

      {hasLoaded && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs font-black text-blue-700"><Users className="w-3.5 h-3.5" /> {rows.length} antrian</span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs font-black text-rose-700"><AlertTriangle className="w-3.5 h-3.5" /> {counts.alfa} alfa</span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">{counts.mangkir} mangkir</span>
          {periode && <span className="inline-flex rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500">{periode.start} s/d {periode.end}</span>}
          {totalDrafts > 0 && <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs font-black text-emerald-700"><CheckCircle className="w-3.5 h-3.5" /> {totalDrafts} draft</span>}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-20 text-center text-slate-400">
          <Loader2 className="w-8 h-8 mx-auto animate-spin mb-3 text-blue-500" />
          <p className="font-bold">Memuat antrian vonis...</p>
        </div>
      ) : !hasLoaded ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-20 text-center">
          <Gavel className="w-12 h-12 mx-auto text-slate-200 mb-3" />
          <p className="font-black text-slate-700">Data belum ditampilkan</p>
          <p className="text-sm text-slate-500 mt-1">Pilih filter lalu tekan Tampilkan.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-20 text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
          <p className="font-black text-slate-700">Tidak ada antrian sesuai filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paged.map((item) => (
            <VonisCard key={item.key} item={item} draft={drafts[item.key]} source={source} onStatus={setDraftStatus} onNote={setDraftNote} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="flex items-center gap-1.5 px-4 py-2 font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Sebelumnya
          </button>
          <span className="text-slate-500 text-xs">Hal {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex items-center gap-1.5 px-4 py-2 font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            Berikutnya <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {totalDrafts > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
          <button onClick={handleSave} disabled={saving} className="w-full rounded-2xl bg-slate-950 text-white px-5 py-4 shadow-2xl ring-4 ring-white flex items-center justify-between hover:bg-black disabled:opacity-60">
            <span className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black">{totalDrafts}</span>
              <span className="text-left">
                <span className="block text-sm font-black">Simpan Vonis Final</span>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Status absensi akan dikoreksi</span>
              </span>
            </span>
            {saving ? <Loader2 className="w-5 h-5 animate-spin text-emerald-400" /> : <Save className="w-5 h-5 text-emerald-400" />}
          </button>
        </div>
      )}
    </div>
  )
}
