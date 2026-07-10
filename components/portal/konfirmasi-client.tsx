'use client'

// UI generik halaman konfirmasi pembayaran Portal Ortu (dipakai SPP & Non-SPP).
// Server actions di-inject dari _page-content masing-masing halaman.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2, Clock3, ImageOff, Loader2, RotateCcw, Search, XCircle, ZoomIn,
} from 'lucide-react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'

export type KonfirmasiRow = {
  id: string
  santri_id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  detail_json: string
  jumlah: number
  metode: string
  bank_tujuan: string | null
  bukti_url: string | null
  status: string
  catatan_ortu: string | null
  reject_reason: string | null
  confirmed_at: string | null
  confirmed_by_nama: string | null
  rejected_at: string | null
  created_at: string
}

type ActionResult = { success: true } | { error: string }
type ListResult = { rows: KonfirmasiRow[] } | { error: string }

const STATUS_FILTERS = [
  { value: 'menunggu_konfirmasi', label: 'Menunggu' },
  { value: 'terkonfirmasi', label: 'Terkonfirmasi' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'SEMUA', label: 'Semua' },
]

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  menunggu_konfirmasi: { label: 'Menunggu Konfirmasi', cls: 'bg-amber-100 text-amber-800' },
  terkonfirmasi: { label: 'Terkonfirmasi', cls: 'bg-emerald-100 text-emerald-800' },
  ditolak: { label: 'Ditolak', cls: 'bg-rose-100 text-rose-800' },
  dibatalkan: { label: 'Dibatalkan Ortu', cls: 'bg-slate-100 text-slate-600' },
}

function formatRupiah(value: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(value || 0)}`
}

function parseBank(bankJson: string | null) {
  try {
    const bank = bankJson ? JSON.parse(bankJson) : null
    return bank ? `${bank.bank} • ${bank.nomor} (a.n. ${bank.atas_nama})` : null
  } catch {
    return null
  }
}

export function KonfirmasiPortalClient({
  title,
  description,
  renderRincian,
  getList,
  approve,
  reject,
  undo,
}: {
  title: string
  description: string
  renderRincian: (detailJson: string) => string[]
  getList: (statusFilter: string) => Promise<ListResult>
  approve: (id: string) => Promise<ActionResult>
  reject: (id: string, reason: string) => Promise<ActionResult>
  undo: (id: string, reason: string) => Promise<ActionResult>
}) {
  const [statusFilter, setStatusFilter] = useState('menunggu_konfirmasi')
  const [rows, setRows] = useState<KonfirmasiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [zoomUrl, setZoomUrl] = useState<string | null>(null)

  const load = useCallback(async (filter: string) => {
    setLoading(true)
    const res = await getList(filter)
    setLoading(false)
    if ('error' in res) {
      toast.error(res.error)
      setRows([])
      return
    }
    setRows(res.rows)
  }, [getList])

  useEffect(() => {
    load(statusFilter)
  }, [load, statusFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row =>
      row.nama_lengkap.toLowerCase().includes(q) || (row.nis || '').toLowerCase().includes(q)
    )
  }, [rows, search])

  async function runAction(id: string, fn: () => Promise<ActionResult>, successMsg: string) {
    if (busyId) return
    setBusyId(id)
    const res = await fn()
    setBusyId(null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success(successMsg)
    load(statusFilter)
  }

  function handleApprove(row: KonfirmasiRow) {
    if (!window.confirm(`Konfirmasi pembayaran ${formatRupiah(row.jumlah)} dari ortu ${row.nama_lengkap}? Tagihan akan langsung ditandai LUNAS.`)) return
    runAction(row.id, () => approve(row.id), 'Pembayaran terkonfirmasi.')
  }

  function handleReject(row: KonfirmasiRow) {
    const reason = window.prompt(`Alasan penolakan pengajuan ${row.nama_lengkap} (min. 5 karakter):`)
    if (reason === null) return
    runAction(row.id, () => reject(row.id, reason), 'Pengajuan ditolak. Ortu bisa upload ulang.')
  }

  function handleUndo(row: KonfirmasiRow) {
    const reason = window.prompt(`Batalkan konfirmasi ${row.nama_lengkap}? Pembayaran yang tercatat akan dihapus. Alasan (min. 5 karakter):`)
    if (reason === null) return
    runAction(row.id, () => undo(row.id, reason), 'Konfirmasi dibatalkan.')
  }

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={title} description={description} />

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              statusFilter === f.value
                ? 'bg-emerald-700 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama / NIS…"
            className="w-40 text-sm outline-none"
          />
        </div>
      </div>

      {/* Daftar */}
      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-10 justify-center text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat pengajuan…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
          Tidak ada pengajuan pada filter ini.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map(row => {
            const badge = STATUS_BADGE[row.status] || STATUS_BADGE.dibatalkan
            const bank = parseBank(row.bank_tujuan)
            const rincian = renderRincian(row.detail_json)
            const busy = busyId === row.id

            return (
              <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{row.nama_lengkap}</p>
                    <p className="text-xs text-slate-500">
                      NIS {row.nis || '-'}
                      {row.asrama ? ` • ${row.asrama}` : ''}
                      {row.kamar ? ` • Kamar ${row.kamar}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="mt-3 flex gap-4">
                  {/* Bukti */}
                  <div className="shrink-0">
                    {row.bukti_url ? (
                      <button
                        onClick={() => setZoomUrl(row.bukti_url)}
                        className="group relative block w-24 h-24 overflow-hidden rounded-xl border border-slate-200"
                        aria-label="Perbesar bukti"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={row.bukti_url} alt="Bukti pembayaran" className="w-full h-full object-cover" />
                        <span className="absolute inset-0 hidden items-center justify-center bg-black/30 group-hover:flex">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </span>
                      </button>
                    ) : (
                      <div className="flex w-24 h-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                        <ImageOff className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">Belum ada bukti</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-extrabold text-emerald-800">{formatRupiah(row.jumlah)}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{rincian.join(', ')}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {row.metode === 'TRANSFER' ? (bank ? `Transfer • ${bank}` : 'Transfer bank') : 'QRIS'}
                    </p>
                    <p className="text-[11px] text-slate-400">Diajukan {row.created_at?.slice(0, 16).replace('T', ' ')}</p>
                    {row.catatan_ortu && (
                      <p className="mt-1 text-[11px] italic text-slate-500">Catatan ortu: {row.catatan_ortu}</p>
                    )}
                    {row.status === 'ditolak' && row.reject_reason && (
                      <p className="mt-1 text-[11px] text-rose-600">Alasan ditolak: {row.reject_reason}</p>
                    )}
                    {row.status === 'terkonfirmasi' && (
                      <p className="mt-1 text-[11px] text-emerald-600">
                        Dikonfirmasi {row.confirmed_by_nama ? `oleh ${row.confirmed_by_nama} ` : ''}
                        {row.confirmed_at ? `• ${row.confirmed_at.slice(0, 16).replace('T', ' ')}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Aksi */}
                <div className="mt-4 flex gap-2">
                  {row.status === 'menunggu_konfirmasi' && (
                    <>
                      <button
                        disabled={busy || !row.bukti_url}
                        onClick={() => handleApprove(row)}
                        title={!row.bukti_url ? 'Ortu belum mengunggah bukti' : undefined}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Konfirmasi
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => handleReject(row)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Tolak
                      </button>
                    </>
                  )}
                  {row.status === 'terkonfirmasi' && (
                    <button
                      disabled={busy}
                      onClick={() => handleUndo(row)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      Batalkan Konfirmasi
                    </button>
                  )}
                  {row.status === 'menunggu_konfirmasi' && !row.bukti_url && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-600">
                      <Clock3 className="w-3.5 h-3.5" /> Menunggu bukti dari ortu
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Zoom bukti */}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setZoomUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomUrl} alt="Bukti pembayaran" className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </div>
  )
}
