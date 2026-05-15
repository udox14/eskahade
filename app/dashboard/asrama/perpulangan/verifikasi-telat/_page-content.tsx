'use client'

import { useCallback, useState } from 'react'
import {
  AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Gavel,
  Loader2, RefreshCw, Users
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { getAntrianTelatPerpulangan, simpanVonisTelatPerpulangan, type TelatPerpulanganItem } from './actions'

type VonisType = 'TELAT_MURNI' | 'SAKIT' | 'IZIN_UZUR' | 'MANGKIR'
const PAGE_SIZE = 25

function fmtTgl(s: string) {
  try {
    return new Date(`${s}T12:00:00Z`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return s
  }
}

function BarisTelat({
  item,
  no,
  onVonis,
}: {
  item: TelatPerpulanganItem
  no: number
  onVonis: (logId: string, santriId: string, v: VonisType) => Promise<void>
}) {
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  const handle = async (v: VonisType) => {
    if (v === 'TELAT_MURNI' && !await confirm(`Vonis TELAT kepada ${item.nama}? (+25 poin)`)) return
    setBusy(true)
    await onVonis(item.log_id, item.santri_id, v)
    setBusy(false)
  }

  const tombol = busy ? (
    <div className="flex items-center gap-1.5 text-xs text-slate-400">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memproses...
    </div>
  ) : (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => handle('TELAT_MURNI')} className="px-2.5 py-1.5 bg-rose-600 text-white rounded-lg text-[11px] font-bold hover:bg-rose-700">Telat</button>
      <button onClick={() => handle('SAKIT')} className="px-2.5 py-1.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold hover:bg-amber-200">Sakit</button>
      <button onClick={() => handle('IZIN_UZUR')} className="px-2.5 py-1.5 bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-[11px] font-bold hover:bg-blue-200">Izin</button>
      <button onClick={() => handle('MANGKIR')} className="px-2.5 py-1.5 bg-slate-100 text-slate-600 border border-slate-300 rounded-lg text-[11px] font-bold hover:bg-slate-200">Mangkir</button>
    </div>
  )

  return (
    <>
      <tr className="hidden sm:table-row border-b border-slate-100 hover:bg-slate-50/50">
        <td className="px-3 py-2.5 text-xs text-slate-300 text-center">{no}</td>
        <td className="px-3 py-2.5">
          <p className="font-semibold text-slate-800 text-sm leading-tight">{item.nama}</p>
          <p className="text-xs text-slate-400">{item.info}</p>
        </td>
        <td className="px-3 py-2.5 text-xs text-slate-600">{item.periode}</td>
        <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{fmtTgl(item.batas_kembali)}</td>
        <td className="px-3 py-2.5">
          <span className="text-xs font-bold text-rose-600">{item.durasi_telat}</span>
          <span className="ml-1.5 text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">Belum balik</span>
        </td>
        <td className="px-3 py-2.5">{tombol}</td>
      </tr>
      <div className="sm:hidden bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-slate-900 text-sm">{item.nama}</p>
            <p className="text-xs text-slate-400">{item.info}</p>
          </div>
          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">PERPULANGAN</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
            <p className="text-slate-400 text-[10px] font-medium mb-0.5">Batas Kembali</p>
            <p className="font-semibold text-slate-700">{fmtTgl(item.batas_kembali)}</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-2 border border-rose-100">
            <p className="text-rose-400 text-[10px] font-medium mb-0.5">Durasi Telat</p>
            <p className="font-bold text-rose-700">{item.durasi_telat}</p>
          </div>
        </div>
        {tombol}
      </div>
    </>
  )
}

export default function VerifikasiTelatPerpulanganPage() {
  const [list, setList] = useState<TelatPerpulanganItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [page, setPage] = useState(1)
  const [filterAsrama, setFilterAsrama] = useState('SEMUA')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      setList(await getAntrianTelatPerpulangan())
      setHasLoaded(true)
      setPage(1)
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleVonis(logId: string, santriId: string, v: VonisType) {
    const res = await simpanVonisTelatPerpulangan(logId, santriId, v)
    if ('error' in res) {
      toast.error('Gagal', { description: res.error })
      return
    }
    toast.success(v === 'MANGKIR' ? 'Ditandai mangkir' : 'Vonis tersimpan')
    if (v !== 'MANGKIR') setList((prev) => prev.filter((item) => item.log_id !== logId))
  }

  const asramaList = Array.from(new Set(list.map((item) => item.info.split(' / ')[0]).filter(Boolean))).sort()
  const filtered = list.filter((item) => filterAsrama === 'SEMUA' || item.info.startsWith(filterAsrama))
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Gavel className="w-6 h-6 text-rose-600" /> Sidang Telat Perpulangan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Vonis santri yang terlambat kembali setelah perpulangan libur panjang</p>
        </div>
        <button onClick={loadData} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-60 self-start sm:self-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {hasLoaded ? 'Perbarui' : 'Tampilkan Antrian'}
        </button>
      </div>

      {!hasLoaded && !loading && (
        <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 text-center">
          <Gavel className="w-10 h-10 text-rose-200" />
          <p className="text-slate-500 text-sm">Klik <strong>Tampilkan Antrian</strong> untuk memulai sidang telat perpulangan.</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16 gap-2 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Memuat antrian...</span>
        </div>
      )}

      {hasLoaded && !loading && list.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-2 bg-white rounded-2xl border border-slate-200 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
          <p className="font-bold text-slate-700">Semua Tertib!</p>
          <p className="text-slate-500 text-sm">Tidak ada antrian telat perpulangan.</p>
        </div>
      )}

      {hasLoaded && !loading && list.length > 0 && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600">
                <Users className="w-3.5 h-3.5" /> {list.length} antrian
              </div>
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 text-xs font-bold text-rose-700">
                <AlertTriangle className="w-3 h-3" /> {list.length} belum kembali
              </div>
              <div className="flex-1" />
              {asramaList.length > 1 && (
                <select value={filterAsrama} onChange={(e) => { setFilterAsrama(e.target.value); setPage(1) }} className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-700">
                  <option value="SEMUA">Semua Asrama</option>
                  {asramaList.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase text-center w-8">No</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase text-left">Nama Santri</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase text-left">Periode</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase text-left">Batas Kembali</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase text-left">Durasi</th>
                    <th className="px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase text-left">Vonis</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((item, i) => (
                    <BarisTelat key={item.log_id} item={item} no={(page - 1) * PAGE_SIZE + i + 1} onVonis={handleVonis} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden p-3 space-y-2.5">
              {paged.map((item, i) => (
                <BarisTelat key={item.log_id} item={item} no={(page - 1) * PAGE_SIZE + i + 1} onVonis={handleVonis} />
              ))}
            </div>
          </div>

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
        </>
      )}
    </div>
  )
}
