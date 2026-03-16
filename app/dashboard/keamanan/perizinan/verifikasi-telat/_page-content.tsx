'use client'

import { useState, useCallback } from 'react'
import { getAntrianTelat, simpanVonisTelat } from './actions'
import {
  Clock, CheckCircle, Gavel, Loader2, AlertTriangle,
  ChevronLeft, ChevronRight, Filter, RefreshCw,
  UserX, ShieldCheck, HeartPulse, Users
} from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'

type TelatItem = {
  izin_id: string; santri_id: string; nama: string; info: string
  jenis: string; alasan: string; batas_kembali: string
  tgl_kembali: string | null; status_label: string; durasi_telat: string
}
type VonisType = 'TELAT_MURNI' | 'SAKIT' | 'IZIN_UZUR' | 'MANGKIR'

const PAGE_SIZE = 10

function fmtDate(s: string) {
  try { return format(new Date(s.replace(' ','T')), 'dd MMM HH:mm', { locale: id }) }
  catch { return s }
}

// ── Kartu per santri ──────────────────────────────────────────────────────────
function TelatCard({ item, onVonis }: { item: TelatItem; onVonis: (id: string, santriId: string, v: VonisType) => void }) {
  const [processing, setProcessing] = useState(false)
  const sudahKembali = !!item.tgl_kembali

  const handle = async (v: VonisType) => {
    if (v === 'TELAT_MURNI' && !confirm(`Vonis TELAT kepada ${item.nama}? (+25 poin)`)) return
    setProcessing(true)
    await onVonis(item.izin_id, item.santri_id, v)
    setProcessing(false)
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      sudahKembali ? 'border-amber-200' : 'border-rose-200'
    }`}>
      {/* Garis status atas */}
      <div className={`h-1 w-full ${sudahKembali ? 'bg-amber-400' : 'bg-rose-500'}`} />

      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">

          {/* Info santri */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                sudahKembali ? 'bg-amber-50 border border-amber-200' : 'bg-rose-50 border border-rose-200'
              }`}>
                <Clock className={`w-5 h-5 ${sudahKembali ? 'text-amber-600' : 'text-rose-600'}`} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 text-base leading-tight truncate">{item.nama}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{item.info} · {item.jenis}</p>
              </div>
            </div>

            {/* Status badge */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                sudahKembali
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
              }`}>
                {sudahKembali ? '✓ Sudah Kembali — Menunggu Sidang' : '⚠ Belum Kembali (Overdue)'}
              </span>
            </div>

            {/* Detail */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                <p className="text-slate-400 font-medium mb-0.5">Janji Kembali</p>
                <p className="font-bold text-slate-700">{fmtDate(item.batas_kembali)}</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-2.5 border border-rose-100">
                <p className="text-rose-400 font-medium mb-0.5">Durasi Telat</p>
                <p className="font-bold text-rose-700">{item.durasi_telat}</p>
              </div>
            </div>
            {item.alasan && (
              <p className="mt-2 text-xs text-slate-400 italic truncate">"{item.alasan}"</p>
            )}
          </div>

          {/* Tombol vonis */}
          <div className="flex flex-row sm:flex-col gap-2 sm:w-44 sm:shrink-0">
            {processing ? (
              <div className="flex items-center justify-center gap-2 py-3 text-slate-400 text-sm w-full">
                <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
              </div>
            ) : (
              <>
                {/* Vonis utama */}
                <button onClick={() => handle('TELAT_MURNI')}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-3 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 active:scale-95 transition-all shadow-sm">
                  <Gavel className="w-4 h-4 shrink-0" />
                  <span>Vonis Telat +25</span>
                </button>

                {/* Uzur */}
                <div className="flex gap-2 flex-1 sm:flex-none">
                  <button onClick={() => handle('SAKIT')}
                    className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-100 active:scale-95 transition-all">
                    <HeartPulse className="w-3.5 h-3.5 shrink-0" /> Sakit
                  </button>
                  <button onClick={() => handle('IZIN_UZUR')}
                    className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100 active:scale-95 transition-all">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Uzur
                  </button>
                </div>

                {/* Tunda */}
                <button onClick={() => handle('MANGKIR')}
                  className="sm:flex-none flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 active:scale-95 transition-all">
                  <UserX className="w-3.5 h-3.5" /> Tidak Hadir Sidang
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VerifikasiTelatPage() {
  const [list, setList]         = useState<TelatItem[]>([])
  const [loading, setLoading]   = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [page, setPage]         = useState(1)
  const [filterStatus, setFilterStatus] = useState<'SEMUA' | 'KEMBALI' | 'OVERDUE'>('SEMUA')
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAntrianTelat()
      setList(res)
      setHasLoaded(true)
      setPage(1)
    } finally { setLoading(false) }
  }, [])

  const handleVonis = async (izinId: string, santriId: string, v: VonisType) => {
    const res = await simpanVonisTelat(izinId, santriId, v)
    if ('error' in res) {
      toast.error('Gagal', { description: (res as any).error })
    } else {
      toast.success(v === 'MANGKIR' ? 'Ditandai — Tidak Hadir Sidang' : 'Vonis tersimpan')
      setList(prev => prev.filter(i => i.izin_id !== izinId))
    }
  }

  // Filter
  const filtered = list.filter(i => {
    if (filterAsrama !== 'SEMUA' && !i.info.startsWith(filterAsrama)) return false
    if (filterStatus === 'KEMBALI') return !!i.tgl_kembali
    if (filterStatus === 'OVERDUE') return !i.tgl_kembali
    return true
  })
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const jumlahKembali = list.filter(i => !!i.tgl_kembali).length
  const jumlahOverdue = list.filter(i => !i.tgl_kembali).length
  const asramaList = Array.from(new Set(list.map(i => i.info.split(' / ')[0]).filter(Boolean))).sort()

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Gavel className="w-6 h-6 text-rose-600" />
            Sidang Keterlambatan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Vonis santri yang terlambat kembali ke pondok</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-60 transition-colors self-start sm:self-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {hasLoaded ? 'Refresh' : 'Tampilkan Antrian'}
        </button>
      </div>

      {/* ── Belum load ── */}
      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center py-20 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center">
            <Gavel className="w-7 h-7 text-rose-300" />
          </div>
          <p className="text-slate-500 font-medium">Belum ada data dimuat</p>
          <p className="text-sm text-slate-400">Klik <strong>Tampilkan Antrian</strong> untuk memulai sidang</p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex justify-center py-20 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat antrian...</span>
        </div>
      )}

      {/* ── Kosong ── */}
      {hasLoaded && !loading && list.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400" />
          <p className="font-bold text-slate-700 text-lg">Semua Tertib!</p>
          <p className="text-slate-500 text-sm">Tidak ada antrian sidang keterlambatan saat ini.</p>
        </div>
      )}

      {/* ── Konten ── */}
      {hasLoaded && !loading && list.length > 0 && (
        <>
          {/* Stats + filter */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Stats pills */}
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700">{list.length} antrian</span>
                </div>
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">{jumlahKembali} sudah kembali</span>
                </div>
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-xs font-bold text-rose-700">{jumlahOverdue} overdue</span>
                </div>
              </div>

              {/* Filter asrama */}
              {asramaList.length > 1 && (
                <select value={filterAsrama} onChange={e => { setFilterAsrama(e.target.value); setPage(1) }}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-700">
                  <option value="SEMUA">Semua Asrama</option>
                  {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}

              {/* Filter status */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {(['SEMUA','KEMBALI','OVERDUE'] as const).map(f => (
                  <button key={f} onClick={() => { setFilterStatus(f); setPage(1) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filterStatus === f ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {f === 'SEMUA' ? 'Semua' : f === 'KEMBALI' ? 'Sudah Kembali' : 'Overdue'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          <div className="space-y-3">
            {paged.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                Tidak ada data dengan filter ini.
              </div>
            ) : (
              paged.map(item => (
                <TelatCard key={item.izin_id} item={item} onVonis={handleVonis} />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <span className="text-sm text-slate-500 font-medium">Hal {page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
