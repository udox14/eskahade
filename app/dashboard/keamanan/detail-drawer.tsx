'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  CheckSquare,
  FileCheck,
  ImageIcon,
  Loader2,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { sessionLabel } from '@/lib/discipline/format'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { getDetailSantri, hapusPelanggaran, type DetailSantriResponse } from './actions'
import {
  button,
  KategoriBadge,
  Modal,
  SpBadge,
  useModalHistory,
} from './_components'
import { getDetailSantriCacheKey, keamananCache } from './_cache'

function fmtTgl(s?: string | null) {
  if (!s) return '—'
  try {
    return format(new Date(s.replace(' ', 'T')), 'dd MMM yyyy', { locale: idLocale })
  } catch {
    return s
  }
}

interface DetailDrawerProps {
  santriId: string | null
  onClose: () => void
  onMutated?: () => void
}

export function DetailDrawer({ santriId, onClose, onMutated }: DetailDrawerProps) {
  const confirm = useConfirm()
  const [closing, setClosing] = useState(false)
  const [activeTab, setActiveTab] = useState<'pelanggaran' | 'riwayat'>('pelanggaran')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const initialKey = santriId ? getDetailSantriCacheKey(santriId) : ''
  const [data, setData] = useState<DetailSantriResponse | null>(() =>
    initialKey ? (keamananCache.get(initialKey) as DetailSantriResponse | null) ?? null : null
  )
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      onClose()
    }, 250)
  }, [closing, onClose])

  // Mobile hardware back button interception
  useModalHistory(Boolean(santriId), handleClose)

  // Esc key listener
  useEffect(() => {
    if (!santriId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [santriId, handleClose])

  // Fetch data with SWR caching
  useEffect(() => {
    if (!santriId) return

    let alive = true
    startTransition(async () => {
      const key = getDetailSantriCacheKey(santriId)
      const cached = keamananCache.get<DetailSantriResponse>(key)
      if (cached) {
        setData(cached)
        setLoading(false)
        if (keamananCache.isFresh(key, 60_000)) return
      } else {
        setLoading(true)
      }

      setError('')
      try {
        const res = await getDetailSantri(santriId)
        if (alive) {
          setData(res)
          keamananCache.set(key, res)
        }
      } catch (err: unknown) {
        if (alive && !cached) {
          const msg = err instanceof Error ? err.message : 'Detail santri tidak dapat dimuat.'
          setError(msg)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })

    return () => {
      alive = false
    }
  }, [santriId])

  const handleHapus = async (id: string) => {
    const ok = await confirm('Batalkan catatan pelanggaran ini? Histori dan surat tetap disimpan.')
    if (!ok) return

    setDeletingId(id)
    try {
      const res = await hapusPelanggaran(id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Catatan pelanggaran dibatalkan')
      keamananCache.clear()
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          pelanggaran: prev.pelanggaran.filter((p) => p.id !== id),
        }
      })
      onMutated?.()
    } finally {
      setDeletingId(null)
    }
  }

  if (!santriId) return null

  const totalKejadian =
    data?.pelanggaran?.reduce((a, p) => a + (p.jumlah_kejadian ?? 0), 0) ?? 0
  const pending =
    data?.pelanggaran?.reduce(
      (a, p) => a + (p.perlu_verifikasi ? 1 : 0),
      0
    ) ?? 0

  const spTerakhir =
    data?.suratPerjanjian?.[0]?.level ?? null

  const totalSurat =
    (data?.suratPernyataan?.length ?? 0) + (data?.suratPerjanjian?.length ?? 0)

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-50 overflow-hidden transition-all duration-250',
          closing ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
        aria-labelledby="detail-drawer-title"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop click dismiss */}
        <div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        />

        <div className="absolute inset-y-0 right-0 max-w-full flex pl-3 sm:pl-10 pointer-events-none">
          <div
            className={cn(
              'w-screen max-w-xl md:max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full pointer-events-auto transition-transform duration-250 ease-out',
              closing
                ? 'translate-x-full'
                : 'translate-x-0 animate-in slide-in-from-right duration-250'
            )}
          >
            {/* ─────────────────────────────────────────────────────────────
                1. DRAWER HEADER (Aligned with Status Pembayaran Standard)
               ───────────────────────────────────────────────────────────── */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-3">
              {data?.profil ? (
                <div className="flex items-center gap-3.5 min-w-0">
                  <SantriPhotoAvatar
                    src={data.profil.foto_url}
                    alt={data.profil.nama_lengkap}
                    name={data.profil.nama_lengkap}
                    size="md"
                    clickable={false}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        id="detail-drawer-title"
                        className="text-base sm:text-lg font-bold text-slate-900 truncate"
                      >
                        {data.profil.nama_lengkap}
                      </h3>
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        {data.profil.status_global || 'Aktif'}
                      </span>
                    </div>
                    {/* Baris 2: Asrama / Kamar */}
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {data.profil.asrama ? `${data.profil.asrama}${data.profil.kamar ? ` / ${data.profil.kamar}` : ''}` : 'Non-Asrama'}
                    </p>
                    {/* Baris 3: Kelas */}
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {data.profil.nama_kelas || '-'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-200 rounded-full" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-36 bg-slate-200 rounded" />
                    <div className="h-3 w-28 bg-slate-200 rounded" />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition cursor-pointer"
                aria-label="Tutup laci rincian"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                2. KPI SUMMARY STRIP
               ───────────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-white">
              <div className="p-3.5 sm:p-4 text-center">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Total Kejadian
                </span>
                <span className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 block">
                  {loading ? '…' : totalKejadian}
                </span>
              </div>
              <div className="p-3.5 sm:p-4 text-center">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-500 block">
                  Perlu Verifikasi
                </span>
                <span className="text-lg sm:text-2xl font-bold text-rose-600 mt-0.5 block">
                  {loading ? '…' : pending}
                </span>
              </div>
              <div className="p-3.5 sm:p-4 text-center">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  SP Terakhir
                </span>
                <div className="mt-1 flex items-center justify-center">
                  {loading ? <span className="text-sm text-slate-400">…</span> : <SpBadge level={spTerakhir} />}
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                3. SUB-TABS (Pelanggaran vs Riwayat SP)
               ───────────────────────────────────────────────────────────── */}
            <div className="flex border-b border-slate-200 bg-slate-50/50 px-4 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('pelanggaran')}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer',
                  activeTab === 'pelanggaran'
                    ? 'border-rose-600 text-rose-700 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                )}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Catatan Pelanggaran</span>
                {data?.pelanggaran && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                      activeTab === 'pelanggaran'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-600'
                    )}
                  >
                    {data.pelanggaran.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('riwayat')}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer',
                  activeTab === 'riwayat'
                    ? 'border-rose-600 text-rose-700 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                )}
              >
                <FileCheck className="h-4 w-4" />
                <span>Riwayat SP & Surat</span>
                {totalSurat > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                      activeTab === 'riwayat'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-600'
                    )}
                  >
                    {totalSurat}
                  </span>
                )}
              </button>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                4. SCROLLABLE TAB CONTENT
               ───────────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  <span className="text-xs">Memuat detail riwayat santri…</span>
                </div>
              ) : error ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {error}
                </div>
              ) : activeTab === 'pelanggaran' ? (
                <div className="space-y-3">
                  {!data?.pelanggaran?.length ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Belum ada catatan pelanggaran aktif untuk santri ini.
                    </div>
                  ) : (
                    data.pelanggaran.map((p) => {
                      const isUnverified = Boolean(p.perlu_verifikasi)
                      const isOriginFromOther = p.source === 'pengajian' || Boolean(p.sesi)

                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <KategoriBadge kategori={p.jenis} />
                                <span
                                  className={cn(
                                    'text-[10px] font-bold px-2 py-0.5 rounded-md border',
                                    isUnverified
                                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                                      : 'bg-slate-100 border-slate-200 text-slate-700'
                                  )}
                                >
                                  {isUnverified ? 'Perlu verifikasi' : `${p.jumlah_kejadian ?? 1} kejadian`}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {p.tanggal ? fmtTgl(p.tanggal) : 'Tanggal belum terverifikasi'}
                                </span>
                                <span className="text-[11px] text-slate-400">·</span>
                                <span className="text-[11px] text-slate-500">
                                  {p.source === 'pengajian' ? 'Pengajian' : 'Umum'}
                                  {p.sesi ? ` · ${sessionLabel(p.sesi, p.jenis || '', p.source || '')}` : ''}
                                </span>
                              </div>

                              <p className="text-sm font-semibold text-slate-900 mt-1.5">
                                {p.nama_pelanggaran || p.deskripsi}
                              </p>

                              {p.deskripsi && p.nama_pelanggaran && p.deskripsi !== p.nama_pelanggaran && (
                                <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap leading-relaxed">
                                  {p.deskripsi}
                                </p>
                              )}

                              {p.penindak_nama && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                  Dicatat oleh: <span className="font-medium text-slate-600">{p.penindak_nama}</span>
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 flex items-center gap-1">
                              {p.foto_url && (
                                <button
                                  type="button"
                                  onClick={() => setPhotoPreview(p.foto_url)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                                  title="Lihat foto bukti"
                                >
                                  <ImageIcon className="h-4 w-4 text-slate-500" />
                                </button>
                              )}

                              {isOriginFromOther ? (
                                <a
                                  href={
                                    p.source === 'pengajian'
                                      ? '/dashboard/akademik/pelanggaran-pengajian'
                                      : p.jenis === 'ALFA_BERJAMAAH'
                                      ? '/dashboard/keamanan/verifikasi-berjamaah'
                                      : '/dashboard/akademik/absensi/vonis-final'
                                  }
                                  className="text-[11px] text-emerald-700 hover:underline px-1.5 py-1"
                                >
                                  Modul asal →
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  disabled={deletingId === p.id}
                                  onClick={() => handleHapus(p.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-40 cursor-pointer"
                                  title="Batalkan catatan pelanggaran ini"
                                >
                                  {deletingId === p.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {!totalSurat ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Belum ada surat pernyataan atau perjanjian untuk santri ini.
                    </div>
                  ) : (
                    <>
                      {/* Surat Pernyataan */}
                      {data?.suratPernyataan?.map((sp) => (
                        <div
                          key={sp.id}
                          className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs"
                        >
                          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 text-slate-600">
                            <CheckSquare className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm">Surat Pernyataan</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {fmtTgl(sp.tanggal)} · Dibuat oleh: {sp.dibuat_oleh_nama || '—'}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Surat Perjanjian */}
                      {data?.suratPerjanjian?.map((sp) => (
                        <div
                          key={sp.id}
                          className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs"
                        >
                          <div className="shrink-0 pt-0.5">
                            <SpBadge level={sp.level} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm">
                              {sp.level === 'SK' ? 'SK Pengeluaran' : `Surat Perjanjian ${sp.level}`}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {fmtTgl(sp.tanggal)} · Dibuat oleh: {sp.dibuat_oleh_nama || '—'}
                            </p>
                            {sp.catatan && (
                              <p className="text-xs text-slate-600 mt-1 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                                &ldquo;{sp.catatan}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Photo Preview Modal */}
      {photoPreview && (
        <Modal title="Foto Bukti Kejadian" onClose={() => setPhotoPreview(null)}>
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Foto Bukti Kejadian"
              className="max-h-[65dvh] w-full rounded-xl object-contain bg-slate-950 border border-slate-200"
            />
            <div className="flex justify-end">
              <button
                type="button"
                className={button}
                onClick={() => setPhotoPreview(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
