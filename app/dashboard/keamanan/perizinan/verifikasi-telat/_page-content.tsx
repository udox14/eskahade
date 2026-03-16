'use client'

import { useState, useCallback } from 'react'
import { getAntrianTelat, simpanVonisTelat } from './actions'
import {
  CheckCircle, Gavel, Loader2, AlertTriangle,
  ChevronLeft, ChevronRight, RefreshCw, Users, Filter
} from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { toast } from 'sonner'

type TelatItem = {
  izin_id: string; santri_id: string; nama: string; info: string
  jenis: string; alasan: string; batas_kembali: string
  tgl_kembali: string | null; status_label: string; durasi_telat: string
}
type VonisType   = 'TELAT_MURNI' | 'SAKIT' | 'IZIN_UZUR' | 'MANGKIR'
type FilterStatus = 'SEMUA' | 'KEMBALI' | 'OVERDUE'
const PAGE_SIZE  = 25

function fmtTgl(s: string) {
  try { return format(new Date(s.replace(' ', 'T')), 'dd MMM, HH:mm', { locale: id }) }
  catch { return s }
}

// ── Baris (desktop) / Card (mobile) ──────────────────────────────────────────
function BarisTelat({ item, no, onVonis }: {
  item: TelatItem; no: number
  onVonis: (a: string, b: string, v: VonisType) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const sudahKembali    = !!item.tgl_kembali

  const handle = async (v: VonisType) => {
    if (v === 'TELAT_MURNI' && !confirm(`Vonis TELAT kepada ${item.nama}? (+25 poin)`)) return
    setBusy(true)
    await onVonis(item.izin_id, item.santri_id, v)
    setBusy(false)
  }

  const tombol = busy ? (
    <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs py-1">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memproses...
    </div>
  ) : (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => handle('TELAT_MURNI')}
        className="px-2.5 py-1.5 bg-rose-600 text-white rounded-lg text-[11px] font-bold hover:bg-rose-700 active:scale-95 transition-all">
        Telat
      </button>
      <button onClick={() => handle('SAKIT')}
        className="px-2.5 py-1.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold hover:bg-amber-200 active:scale-95 transition-all">
        Sakit
      </button>
      <button onClick={() => handle('IZIN_UZUR')}
        className="px-2.5 py-1.5 bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-[11px] font-bold hover:bg-blue-200 active:scale-95 transition-all">
        Izin
      </button>
      <button onClick={() => handle('MANGKIR')}
        className="px-2.5 py-1.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-lg text-[11px] font-bold hover:bg-slate-200 active:scale-95 transition-all">
        Mangkir
      </button>
    </div>
  )

  // ── Desktop row ──
  const desktopRow = (
    <tr key={item.izin_id} className="hidden sm:table-row border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="px-3 py-2.5 text-xs text-slate-300 w-8 text-center">{no}</td>
      <td className="px-3 py-2.5">
        <p className="font-semibold text-slate-800 text-sm leading-tight">{item.nama}</p>
        <p className="text-xs text-slate-400">{item.info}</p>
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          item.jenis === 'IZIN PULANG'
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'
        }`}>{item.jenis}</span>
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{fmtTgl(item.batas_kembali)}</td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-bold text-rose-600">{item.durasi_telat}</span>
        {!sudahKembali && (
          <span className="ml-1.5 text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full animate-pulse">
            Belum balik
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">{tombol}</td>
    </tr>
  )

  // ── Mobile card ──
  const mobileCard = (
    <div key={`m-${item.izin_id}`} className="sm:hidden bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900 text-sm">{item.nama}</p>
          <p className="text-xs text-slate-400">{item.info}</p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          item.jenis === 'IZIN PULANG'
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'
        }`}>{item.jenis}</span>
      </div>
      <div className="flex gap-3 text-xs">
        <div className="flex-1 bg-slate-50 rounded-xl p-2 border border-slate-100">
          <p className="text-slate-400 text-[10px] font-medium mb-0.5">Janji Kembali</p>
          <p className="font-semibold text-slate-700">{fmtTgl(item.batas_kembali)}</p>
        </div>
        <div className="flex-1 bg-rose-50 rounded-xl p-2 border border-rose-100">
          <p className="text-rose-400 text-[10px] font-medium mb-0.5">Durasi Telat</p>
          <p className="font-bold text-rose-700">{item.durasi_telat}</p>
          {!sudahKembali && <p className="text-[9px] text-rose-500 font-bold animate-pulse">Belum balik</p>}
        </div>
      </div>
      {tombol}
    </div>
  )

  return <>{desktopRow}{mobileCard}</>
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VerifikasiTelatPage() {
  const [list, setList]           = useState<TelatItem[]>([])
  const [loading, setLoading]     = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [page, setPage]           = useState(1)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('SEMUA')
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')

  const loadData = useCallback(async () => {
    setLoading(true)
    try { setList(await getAntrianTelat()); setHasLoaded(true); setPage(1) }
    finally { setLoading(false) }
  }, [])

  const handleVonis = async (izinId: string, santriId: string, v: VonisType) => {
    const res = await simpanVonisTelat(izinId, santriId, v)
    if ('error' in res) { toast.error('Gagal', { description: (res as any).error }); return }
    toast.success(v === 'MANGKIR' ? 'Ditandai mangkir' : 'Vonis tersimpan')
    setList(prev => prev.filter(i => i.izin_id !== izinId))
  }

  const asramaList = Array.from(new Set(list.map(i => i.info.split(' / ')[0]).filter(Boolean))).sort()

  const filtered = list.filter(i => {
    if (filterAsrama !== 'SEMUA' && !i.info.startsWith(filterAsrama)) return false
    if (filterStatus === 'KEMBALI') return !!i.tgl_kembali
    if (filterStatus === 'OVERDUE') return !i.tgl_kembali
    return true
  })
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Gavel className="w-6 h-6 text-rose-600" /> Sidang Keterlambatan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Vonis santri yang terlambat kembali ke pondok</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-60 transition-colors self-start sm:self-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {hasLoaded ? 'Perbarui' : 'Tampilkan Antrian'}
        </button>
      </div>

      {/* Belum load */}
      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <Gavel className="w-10 h-10 text-rose-200" />
          <p className="text-slate-500 text-sm">Klik <strong>Tampilkan Antrian</strong> untuk memulai sidang</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat antrian...</span>
        </div>
      )}

      {/* Kosong */}
      {hasLoaded && !loading && list.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-2 bg-white rounded-2xl border border-slate-200 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
          <p className="font-bold text-slate-700">Semua Tertib!</p>
          <p className="text-slate-500 text-sm">Tidak ada antrian sidang keterlambatan.</p>
        </div>
      )}

      {/* Konten */}
      {hasLoaded && !loading && list.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <div className="flex flex-wrap items-center gap-2.5">

              {/* Stats */}
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600">
                <Users className="w-3.5 h-3.5" /> {list.length} antrian
              </div>
              {list.filter(i=>!!i.tgl_kembali).length > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-700">
                  {list.filter(i=>!!i.tgl_kembali).length} sudah kembali
                </div>
              )}
              {list.filter(i=>!i.tgl_kembali).length > 0 && (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 text-xs font-bold text-rose-700">
                  <AlertTriangle className="w-3 h-3" /> {list.filter(i=>!i.tgl_kembali).length} overdue
                </div>
              )}

              <div className="flex-1" />

              {/* Filter asrama */}
              {asramaList.length > 1 && (
                <select value={filterAsrama} onChange={e => { setFilterAsrama(e.target.value); setPage(1) }}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-700">
                  <option value="SEMUA">Semua Asrama</option>
                  {asramaList.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}

              {/* Filter status */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {(['SEMUA','KEMBALI','OVERDUE'] as FilterStatus[]).map(f => (
                  <button key={f} onClick={() => { setFilterStatus(f); setPage(1) }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      filterStatus === f ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {f === 'SEMUA' ? 'Semua' : f === 'KEMBALI' ? 'Sudah Kembali' : 'Belum Kembali'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabel desktop + cards mobile */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Tabel — hanya muncul di sm ke atas */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center w-8">No</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Nama Santri</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Tipe Izin</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Janji Kembali</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Durasi Telat</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">Vonis</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((item, i) => (
                    <BarisTelat key={item.izin_id} item={item}
                      no={(page-1)*PAGE_SIZE+i+1} onVonis={handleVonis} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards mobile — hanya di bawah sm */}
            <div className="sm:hidden p-3 space-y-2.5">
              {paged.map((item, i) => (
                <BarisTelat key={item.izin_id} item={item}
                  no={(page-1)*PAGE_SIZE+i+1} onVonis={handleVonis} />
              ))}
            </div>

            {paged.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">
                Tidak ada data dengan filter ini.
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
                className="flex items-center gap-1.5 px-4 py-2 font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <span className="text-slate-500 text-xs">Hal {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}
                className="flex items-center gap-1.5 px-4 py-2 font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                Berikutnya <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
