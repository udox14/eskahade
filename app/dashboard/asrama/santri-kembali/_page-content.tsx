'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Home, Loader2, Lock, LogIn, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAsramaListSantriKembali,
  getSantriBelumKembali,
  getSantriKembaliSession,
  tandaiSantriKembali,
  tandaiSantriKembaliBulk,
  type SantriKembaliRow,
  type SessionInfo,
} from './actions'
import { formatWibDate, toWibDateInputValue } from '@/lib/date/wib'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'

function formatDateTime(value: string) {
  return formatWibDate(value)
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
  const [totalRows, setTotalRows] = useState(0)
  const [overdueTotal, setOverdueTotal] = useState(0)
  const [selectedRow, setSelectedRow] = useState<SantriKembaliRow | null>(null)
  const [waktuDatang, setWaktuDatang] = useState(toWibDateInputValue())
  const [pending, startTransition] = useTransition()

  // Pagination states
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  // Selection states
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [waktuDatangBulk, setWaktuDatangBulk] = useState(toWibDateInputValue())
  const [pendingBulk, startTransitionBulk] = useTransition()

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

  const loadRows = useCallback(async () => {
    setLoading(true)
    const offset = (currentPage - 1) * pageSize
    const data = await getSantriBelumKembali({
      asrama: selectedAsrama,
      search,
      limit: pageSize,
      offset,
    })

    setRows(data.rows)
    setTotalRows(data.total)
    setOverdueTotal(data.overdueTotal)
    setLoading(false)
  }, [currentPage, pageSize, search, selectedAsrama])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRows()
  }, [loadRows])

  // Reset page & selection on filter change
  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds([])
  }, [search, selectedAsrama, pageSize])

  const loadedOverdueCount = useMemo(() => rows.filter(isOverdue).length, [rows])

  const openConfirm = (row: SantriKembaliRow) => {
    setSelectedRow(row)
    setWaktuDatang(toWibDateInputValue())
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
      await loadRows()
    })
  }

  const handleBulkConfirm = () => {
    if (selectedIds.length === 0) return

    startTransitionBulk(async () => {
      const res = await tandaiSantriKembaliBulk(selectedIds, waktuDatangBulk)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setSelectedIds([])
      await loadRows()
    })
  }

  const pageIds = rows.map(r => r.id)
  const isAllSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)))
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
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
                <th className="px-4 py-3 text-left font-bold w-12">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left font-bold min-w-[240px]">Santri</th>
                <th className="px-4 py-3 text-left font-bold w-40">Asrama</th>
                <th className="px-4 py-3 text-left font-bold min-w-[220px]">Izin Pulang</th>
                <th className="px-4 py-3 text-left font-bold min-w-[180px]">Batas Kembali</th>
                <th className="px-4 py-3 text-right font-bold w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">Tidak ada izin pulang yang belum kembali.</td></tr>
              ) : rows.map(row => {
                const late = isOverdue(row)
                const isSelected = selectedIds.includes(row.id)
                return (
                  <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-emerald-50/30' : ''}`}>
                    <td className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(row.id)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <SantriPhotoAvatar
                          src={row.foto_url}
                          name={row.nama}
                          alt={`Foto ${row.nama}`}
                          size="sm"
                          className="shrink-0"
                        />
                        <div>
                          <p className="font-bold text-slate-800">{row.nama}</p>
                          <p className="text-xs text-slate-400">{row.nis || '-'} - Kamar {row.kamar || '-'}</p>
                        </div>
                      </div>
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

        {/* PAGINATION CONTROLS */}
        <div className="border-t bg-slate-50 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="bg-white border rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-100 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={9999}>Semua</option>
            </select>
            <span className="text-xs text-slate-500 font-medium">data per halaman</span>
          </div>

          <div className="text-xs text-slate-500 font-semibold uppercase">
            Menampilkan {totalRows > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, totalRows)} dari {totalRows}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1 || loading}
              className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Sebelumnya
            </button>
            <span className="text-xs font-bold text-slate-700 px-1">
              Halaman {currentPage} dari {Math.max(1, Math.ceil(totalRows / pageSize))}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, Math.max(1, Math.ceil(totalRows / pageSize))))}
              disabled={currentPage >= Math.max(1, Math.ceil(totalRows / pageSize)) || loading}
              className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Selanjutnya
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {selectedRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <SantriPhotoAvatar
                  src={selectedRow.foto_url}
                  name={selectedRow.nama}
                  alt={`Foto ${selectedRow.nama}`}
                  size="sm"
                  className="shrink-0"
                />
                <div>
                  <h2 className="font-bold text-slate-800">Tandai Kembali</h2>
                  <p className="text-sm text-slate-500">{selectedRow.nama}</p>
                </div>
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
                <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Datang Aktual</label>
                <div className="relative mt-1">
                  <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={waktuDatang}
                    onChange={e => setWaktuDatang(e.target.value)}
                    className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Tanggal diproses dalam WIB.</p>
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

      {/* FLOATING BULK TOOLBAR */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] lg:w-auto lg:min-w-[550px] bg-slate-950 text-white px-6 py-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 z-40 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-emerald-500 w-8 h-8 rounded-full flex items-center justify-center font-black text-slate-950 text-sm">
              {selectedIds.length}
            </div>
            <div>
              <p className="font-bold text-sm">Santri terpilih</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Konfirmasi kedatangan secara massal.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-40">
              <Clock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={waktuDatangBulk}
                onChange={e => setWaktuDatangBulk(e.target.value)}
                className="w-full bg-slate-850 border border-slate-700 rounded-xl pl-8 pr-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            <button
              onClick={handleBulkConfirm}
              disabled={pendingBulk}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 active:scale-95 disabled:opacity-50 text-xs shrink-0 cursor-pointer"
            >
              {pendingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Proses ({selectedIds.length})
            </button>
            
            <button
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-white font-semibold text-xs px-2 py-2 cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
