'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { getHistoryReviews, verifyHistory } from './history-actions'
import type { SessionEvidence } from '@/lib/discipline/evidence'
import { button, control, primaryRose } from './_components'
import { getHistoryReviewCacheKey, keamananCache } from './_cache'

export function HistoryReview({
  onTotalChange,
  onVerified,
}: {
  onTotalChange?: (total: number) => void
  onVerified?: () => void
}) {
  const [page, setPage] = useState(1)
  const initialKey = getHistoryReviewCacheKey(1)
  const [data, setData] = useState<Awaited<ReturnType<typeof getHistoryReviews>> | undefined>(
    () => keamananCache.get(initialKey) ?? undefined
  )
  const [loading, setLoading] = useState(!data)
  const [selected, setSelected] = useState<string | null>(null)
  const [items, setItems] = useState<SessionEvidence[]>([])
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  const load = useCallback(async (pg = page) => {
    const key = getHistoryReviewCacheKey(pg)
    const cached = keamananCache.get<Awaited<ReturnType<typeof getHistoryReviews>>>(key)
    if (cached) {
      setData(cached)
      onTotalChange?.(cached.total ?? 0)
      setLoading(false)
      if (keamananCache.isFresh(key, 60_000)) return
    } else {
      setLoading(true)
    }

    startTransition(async () => {
      try {
        const res = await getHistoryReviews(pg)
        setData(res)
        keamananCache.set(key, res)
        if (!res.denied && !res.error) {
          onTotalChange?.(res.total ?? 0)
        }
      } finally {
        setLoading(false)
      }
    })
  }, [page, onTotalChange])

  useEffect(() => {
    void load()
  }, [load])

  if (!data && loading) {
    return (
      <div className="rounded-2xl border border-slate-200/90 bg-white p-8 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        <span className="text-xs">Memeriksa histori verifikasi…</span>
      </div>
    )
  }

  if (!data || data.denied) return null

  if (data.error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
        <p>{data.error}</p>
      </div>
    )
  }

  const save = async () => {
    const row = data.rows.find((r) => r.id === selected)
    if (!row) return

    if (!items.length) {
      toast.error('Tambahkan minimal 1 tanggal dan sesi verifikasi.')
      return
    }

    const hasEmpty = items.some((item) => !item.tanggal || !item.sesi)
    if (hasEmpty) {
      toast.error('Lengkapi tanggal dan sesi untuk semua sesi yang diverifikasi.')
      return
    }

    setBusy(true)
    try {
      const result = await verifyHistory(row.id, row.version, items, reason)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Histori pelanggaran berhasil diverifikasi')
      keamananCache.clear()
      setSelected(null)
      onVerified?.()
      await load()
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.ceil(data.total / 30)

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Verifikasi Histori Pelanggaran</h2>
            <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
              {data.total} catatan
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Catatan akumulasi lama yang belum terverifikasi tanggal dan sesinya. Periksa dan verifikasi berdasarkan bukti riil.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            keamananCache.clear()
            load()
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer self-start sm:self-auto"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Segarkan</span>
        </button>
      </div>

      {data.rows.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500/80 mb-2" />
          <p className="text-sm font-semibold text-slate-800">Semua Histori Sudah Terverifikasi</p>
          <p className="text-xs text-slate-500 mt-0.5">Tidak ada catatan lama yang memerlukan verifikasi manual.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {data.rows.map((row) => {
            const isSelected = selected === row.id
            const isPengajian = row.jenis === 'ALFA_PENGAJIAN'

            return (
              <div key={row.id} className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">{row.nama_lengkap}</span>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {isPengajian ? 'Alfa Pengajian' : 'Alfa Berjamaah'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {row.deskripsi}
                    </p>
                  </div>

                  {!isSelected ? (
                    <button
                      type="button"
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer shadow-2xs"
                      onClick={() => {
                        setSelected(row.id)
                        setItems(
                          row.suggestions.length
                            ? row.suggestions
                            : [{ tanggal: '', sesi: 'shubuh' }]
                        )
                        setReason('')
                      }}
                    >
                      <FileCheck className="h-3.5 w-3.5 text-rose-600" />
                      <span>Periksa</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="shrink-0 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                      onClick={() => setSelected(null)}
                      aria-label="Tutup form verifikasi"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {isSelected && (
                  <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-4 space-y-3.5 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-900">
                        Rincian Sesi Verifikasi
                      </span>
                      <span className="text-xs text-rose-700 font-medium">
                        {items.length} sesi
                      </span>
                    </div>

                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200"
                        >
                          <div className="flex-1">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Tanggal Sesi
                            </label>
                            <input
                              type="date"
                              aria-label={`Tanggal sesi ${index + 1}`}
                              value={item.tanggal}
                              onChange={(e) =>
                                setItems(
                                  items.map((r, i) =>
                                    i === index ? { ...r, tanggal: e.target.value } : r
                                  )
                                )
                              }
                              className={control + ' min-h-9 py-1.5 text-xs'}
                            />
                          </div>

                          <div className="flex-1">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Sesi Wajib
                            </label>
                            <select
                              aria-label={`Sesi ${index + 1}`}
                              value={item.sesi}
                              onChange={(e) =>
                                setItems(
                                  items.map((r, i) =>
                                    i === index ? { ...r, sesi: e.target.value } : r
                                  )
                                )
                              }
                              className={control + ' min-h-9 py-1.5 text-xs'}
                            >
                              {(isPengajian
                                ? ['shubuh', 'ashar', 'maghrib']
                                : ['shubuh', 'dzuhur', 'ashar', 'maghrib', 'isya']
                              ).map((s) => (
                                <option key={s} value={s}>
                                  {s === 'maghrib' && isPengajian
                                    ? 'Malam / Ba’da Maghrib'
                                    : s.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:self-end pt-1 sm:pt-0">
                            <button
                              type="button"
                              onClick={() => setItems(items.filter((_, i) => i !== index))}
                              className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-900 p-2 hover:bg-rose-50 rounded-lg transition"
                              title="Hapus baris sesi ini"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sm:hidden">Hapus sesi</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setItems([...items, { tanggal: '', sesi: 'shubuh' }])}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-800 hover:text-rose-950 transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah Sesi Lain</span>
                    </button>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Alasan dan Bukti Verifikasi <span className="text-slate-400 font-normal">(opsional)</span>
                      </label>
                      <textarea
                        rows={2}
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Keterangan dasar verifikasi catatan ini..."
                        className={control + ' text-xs'}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200/60">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={save}
                        className={primaryRose}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
                        <span>{busy ? 'Menyimpan…' : 'Simpan Verifikasi'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setSelected(null)}
                        className={button}
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage(page - 1)}
            className="inline-flex items-center gap-1 font-semibold text-slate-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </button>
          <span>
            Halaman {page} dari {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage(page + 1)}
            className="inline-flex items-center gap-1 font-semibold text-slate-700 disabled:opacity-40"
          >
            Berikutnya
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  )
}
