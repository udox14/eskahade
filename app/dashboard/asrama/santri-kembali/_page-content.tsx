'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Home, Loader2, Lock, LogIn, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAsramaListSantriKembali,
  getSantriBelumKembali,
  getSantriKembaliSession,
  tandaiSantriKembali,
  type SantriKembaliRow,
  type SessionInfo,
} from './actions'

const PAGE_SIZE = 30

function localInputNow() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isOverdue(row: SantriKembaliRow) {
  return new Date() > new Date(row.tgl_selesai_rencana)
}

export default function SantriKembaliPageContent() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [asramaList, setAsramaList] = useState<string[]>([])
  const [selectedAsrama, setSelectedAsrama] = useState('SEMUA')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<SantriKembaliRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalRows, setTotalRows] = useState(0)
  const [overdueTotal, setOverdueTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [selectedRow, setSelectedRow] = useState<SantriKembaliRow | null>(null)
  const [waktuDatang, setWaktuDatang] = useState(localInputNow())
  const [pending, startTransition] = useTransition()

  const loadBootstrap = async () => {
    const [info, asramas] = await Promise.all([getSantriKembaliSession(), getAsramaListSantriKembali()])
    setSessionInfo(info)
    setAsramaList(asramas)
    setSelectedAsrama(info?.asrama_binaan || 'SEMUA')
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBootstrap()
  }, [])

  const loadRows = useCallback(async (append = false, offset = 0) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    const data = await getSantriBelumKembali({
      asrama: selectedAsrama,
      search,
      limit: PAGE_SIZE,
      offset,
    })

    setRows(prev => append ? [...prev, ...data.rows] : data.rows)
    setTotalRows(data.total)
    setOverdueTotal(data.overdueTotal)
    setHasMore(data.hasMore)
    setLoading(false)
    setLoadingMore(false)
  }, [search, selectedAsrama])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRows(false)
  }, [loadRows])

  const loadedOverdueCount = useMemo(() => rows.filter(isOverdue).length, [rows])

  const openConfirm = (row: SantriKembaliRow) => {
    setSelectedRow(row)
    setWaktuDatang(localInputNow())
  }

  const handleConfirm = () => {
    if (!selectedRow) return

    startTransition(async () => {
      const res = await tandaiSantriKembali(selectedRow.id, waktuDatang)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setSelectedRow(null)
      await loadRows(false)
    })
  }

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Santri Kembali</h1>
          <p className="text-sm text-slate-500 mt-1">Konfirmasi kedatangan santri yang izin pulang ke asrama.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <div className="bg-white border rounded-2xl px-4 py-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase">Belum Kembali</p>
            <p className="text-xl font-bold text-slate-800">{totalRows}</p>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
            <p className="text-[11px] font-bold text-rose-500 uppercase">Lewat Batas</p>
            <p className="text-xl font-bold text-rose-700">{overdueTotal}</p>
          </div>
        </div>
      </div>

      <section className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-slate-50 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-800">Izin Pulang Belum Kembali</h2>
            <p className="text-sm text-slate-500">
              Yang tampil hanya perizinan dengan jenis izin pulang. Memuat {rows.length} dari {totalRows} data.
              {loadedOverdueCount > 0 ? ` ${loadedOverdueCount} yang terlihat sudah lewat batas.` : ''}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className={`border rounded-xl px-3 py-2 bg-white flex items-center gap-2 ${sessionInfo?.asrama_binaan ? 'border-emerald-200 bg-emerald-50' : ''}`}>
              {sessionInfo?.asrama_binaan ? <Lock className="w-4 h-4 text-emerald-700" /> : <Home className="w-4 h-4 text-slate-400" />}
              <select
                value={selectedAsrama}
                onChange={e => setSelectedAsrama(e.target.value)}
                disabled={Boolean(sessionInfo?.asrama_binaan)}
                className="bg-transparent outline-none text-sm font-bold text-slate-700 disabled:cursor-not-allowed"
              >
                {!sessionInfo?.asrama_binaan ? <option value="SEMUA">Semua Asrama</option> : null}
                {asramaList.map(asrama => <option key={asrama} value={asrama}>{asrama}</option>)}
              </select>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama, NIS, kamar"
                className="w-full sm:w-64 pl-9 pr-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-bold min-w-[240px]">Santri</th>
                <th className="px-4 py-3 text-left font-bold w-40">Asrama</th>
                <th className="px-4 py-3 text-left font-bold min-w-[220px]">Izin Pulang</th>
                <th className="px-4 py-3 text-left font-bold min-w-[180px]">Batas Kembali</th>
                <th className="px-4 py-3 text-right font-bold w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">Tidak ada izin pulang yang belum kembali.</td></tr>
              ) : rows.map(row => {
                const late = isOverdue(row)
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{row.nama}</p>
                      <p className="text-xs text-slate-400">{row.nis || '-'} - Kamar {row.kamar || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.asrama || '-'}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">{row.alasan}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Mulai {formatDateTime(row.tgl_mulai)} - via {row.pemberi_izin}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className={`font-bold ${late ? 'text-rose-700' : 'text-emerald-700'}`}>{formatDateTime(row.tgl_selesai_rencana)}</p>
                      {late ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full mt-1">
                          <AlertTriangle className="w-3 h-3" /> Lewat batas
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openConfirm(row)}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-xl"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Kembali
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && hasMore ? (
          <div className="border-t bg-slate-50 px-5 py-4 flex justify-center">
            <button
              onClick={() => loadRows(true, rows.length)}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Muat Lagi
            </button>
          </div>
        ) : null}
      </section>

      {selectedRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800">Tandai Kembali</h2>
                <p className="text-sm text-slate-500">{selectedRow.nama}</p>
              </div>
              <button onClick={() => setSelectedRow(null)} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="border rounded-2xl p-4 bg-slate-50">
                <p className="font-bold text-slate-800">{selectedRow.asrama || '-'} / Kamar {selectedRow.kamar || '-'}</p>
                <p className="text-xs text-slate-500 mt-1">Batas kembali: {formatDateTime(selectedRow.tgl_selesai_rencana)}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Waktu Datang Aktual</label>
                <div className="relative mt-1">
                  <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="datetime-local"
                    value={waktuDatang}
                    onChange={e => setWaktuDatang(e.target.value)}
                    className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                  />
                </div>
              </div>
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Simpan Kedatangan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
