'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  X,
  Wallet,
  RefreshCw,
  SlidersHorizontal,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
import { publicMediaUrl } from '@/lib/r2/references'
import { formatFinanceDate } from '@/lib/finance/date-format'
import {
  getStudentWalletDetail,
  recalculateStudentWalletAction,
  saveParentLimitsAction,
  type StudentWalletDetailResponse,
} from './actions'

interface WalletDetailDrawerProps {
  santriId: string | null
  canMutate: boolean
  onClose: () => void
  onBalanceUpdated?: () => void
}

function formatRupiah(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return 'Rp0'
  return `Rp${Math.round(val).toLocaleString('id-ID')}`
}

function formatReferenceShort(rawRef?: string | null): string {
  if (!rawRef) return ''
  const trimmed = rawRef.trim()
  if (trimmed.startsWith('LOKET_DEPOSIT:')) {
    const shortId = (trimmed.split(':')[1] || '').replace(/-/g, '').slice(0, 6).toUpperCase()
    return shortId ? `LOKET-${shortId}` : 'LOKET-SETOR'
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return `REF-${trimmed.slice(0, 8).toUpperCase()}`
  }
  return trimmed.length > 22 ? `${trimmed.slice(0, 19)}…` : trimmed
}

const MOVEMENT_LABELS: Record<string, string> = {
  TOPUP_ONLINE: 'Top-Up Online (BRIVA)',
  TOPUP_CASH: 'Setor Tunai (Loket)',
  TOPUP_TRANSFER: 'Top-Up Transfer Manual',
  WITHDRAWAL_LOKET: 'Pencairan Loket',
  WITHDRAWAL_KOLEKTIF: 'Pencairan Kolektif',
  WITHDRAWAL_KOLEKTIF_RETURN: 'Pengembalian Pencairan Batal',
  REVERSAL: 'Koreksi / Reversal',
}

export function WalletDetailDrawer({
  santriId,
  canMutate,
  onClose,
  onBalanceUpdated,
}: WalletDetailDrawerProps) {
  const [detail, setDetail] = useState<StudentWalletDetailResponse | null>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRecalculating, setIsRecalculating] = useState(false)

  // Modal Atur Limit State
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
  const [parentDailyLimitInput, setParentDailyLimitInput] = useState<string>('')
  const [parentWeeklyLimitInput, setParentWeeklyLimitInput] = useState<string>('')
  const [parentMonthlyLimitInput, setParentMonthlyLimitInput] = useState<string>('')
  const [isSavingLimit, setIsSavingLimit] = useState(false)

  // Keyboard navigation: Escape closes limit modal first, then drawer
  useEffect(() => {
    if (!santriId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLimitModalOpen) setIsLimitModalOpen(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [santriId, isLimitModalOpen, onClose])

  // Fetch student detail when santriId changes
  useEffect(() => {
    if (!santriId) return
    let cancelled = false
    startTransition(async () => {
      try {
        const res = await getStudentWalletDetail(santriId)
        if (!cancelled) {
          setDetail(res)
          setErrorMessage(null)
          setParentDailyLimitInput(
            res.limits.parentDailyLimit !== null ? String(res.limits.parentDailyLimit) : ''
          )
          setParentWeeklyLimitInput(
            res.limits.parentWeeklyLimit !== null ? String(res.limits.parentWeeklyLimit) : ''
          )
          setParentMonthlyLimitInput(
            res.limits.parentMonthlyLimit !== null ? String(res.limits.parentMonthlyLimit) : ''
          )
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Rincian dompet santri belum dapat dimuat.'
          setErrorMessage(msg)
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [santriId])

  if (!santriId) return null

  const handleRecalculate = async () => {
    if (!santriId || !canMutate || isRecalculating) return
    setIsRecalculating(true)
    try {
      const out = await recalculateStudentWalletAction(santriId)
      const res = await getStudentWalletDetail(santriId)
      setDetail(res)
      toast.success(`Saldo berhasil disinkronkan (${formatRupiah(out.newBalance)}).`)
      if (onBalanceUpdated) onBalanceUpdated()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyinkronkan saldo.')
    } finally {
      setIsRecalculating(false)
    }
  }

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!santriId || !canMutate || isSavingLimit) return
    setIsSavingLimit(true)
    try {
      const daily = parentDailyLimitInput.trim() !== '' ? parseInt(parentDailyLimitInput, 10) : null
      const weekly = parentWeeklyLimitInput.trim() !== '' ? parseInt(parentWeeklyLimitInput, 10) : null
      const monthly = parentMonthlyLimitInput.trim() !== '' ? parseInt(parentMonthlyLimitInput, 10) : null

      await saveParentLimitsAction(santriId, { daily, weekly, monthly })
      const res = await getStudentWalletDetail(santriId)
      setDetail(res)
      setIsLimitModalOpen(false)
      toast.success('Limit pencairan santri berhasil disimpan.')
      if (onBalanceUpdated) onBalanceUpdated()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan limit pencairan.')
    } finally {
      setIsSavingLimit(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Buku besar uang jajan santri">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
          <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 truncate">
                    Buku Besar Uang Jajan
                  </h2>
                  <p className="text-xs text-slate-500 truncate">
                    Rincian saldo dana titipan &amp; riwayat mutasi santri
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                aria-label="Tutup panel buku besar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {isPending && !detail ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-20 bg-slate-100 rounded-xl" />
                  <div className="h-32 bg-slate-100 rounded-xl" />
                  <div className="h-48 bg-slate-100 rounded-xl" />
                </div>
              ) : errorMessage ? (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm flex items-start gap-3"
                >
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
                  <p>{errorMessage}</p>
                </div>
              ) : detail ? (
                <>
                  {/* Identity Card */}
                  <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <SantriPhotoAvatar
                      src={publicMediaUrl(detail.santri.fotoUrl)}
                      name={detail.santri.namaLengkap}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 truncate">
                        {detail.santri.namaLengkap}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        NIS <span className="font-medium text-slate-700">{detail.santri.nis}</span>
                        {detail.santri.asrama && (
                          <>
                            {' '}· <span className="font-medium text-slate-700">{detail.santri.asrama}</span>
                          </>
                        )}
                        {detail.santri.kamar && <> / Kamar {detail.santri.kamar}</>}
                      </p>
                    </div>
                  </div>

                  {/* Saldo Buku Besar Card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Saldo Dana Titipan
                        </span>
                        <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                          {formatRupiah(detail.balance.authoritative)}
                        </div>
                      </div>
                      {canMutate && (
                        <button
                          type="button"
                          onClick={handleRecalculate}
                          disabled={isRecalculating}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-60 transition cursor-pointer"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${isRecalculating ? 'animate-spin' : ''}`}
                            aria-hidden="true"
                          />
                          <span>{isRecalculating ? 'Menyinkronkan…' : 'Sinkronkan Saldo'}</span>
                        </button>
                      )}
                    </div>

                    {detail.balance.isSynced ? (
                      <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-emerald-700">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span>Saldo buku besar dan ringkasan santri sinkron.</span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 tabular-nums">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                        <span>
                          Terdapat selisih antara buku besar ({formatRupiah(detail.balance.authoritative)}) dan saldo ringkasan ({formatRupiah(detail.balance.cached)}). Gunakan tombol <strong>Sinkronkan Saldo</strong>.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Limit Section Card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
                        <h4 className="text-sm font-bold text-slate-900">Limit Pencairan</h4>
                      </div>
                      {canMutate && (
                        <button
                          type="button"
                          onClick={() => setIsLimitModalOpen(true)}
                          className="inline-flex min-h-[32px] items-center rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                        >
                          Atur Limit Wali
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <span className="text-slate-500">Limit Efektif Harian</span>
                        <p className="mt-1 text-sm font-bold text-slate-900 tabular-nums">
                          {formatRupiah(detail.limits.effectiveDailyLimit)}
                        </p>
                        <span className="text-[11px] text-slate-500">Batas paling ketat</span>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <span className="text-slate-500">Dicairkan Hari Ini</span>
                        <p className="mt-1 text-sm font-bold text-slate-900 tabular-nums">
                          {formatRupiah(detail.limits.withdrawnToday)}
                        </p>
                        <span className="text-[11px] text-slate-500">Kolektif &amp; loket</span>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 col-span-2 sm:col-span-1">
                        <span className="text-slate-500">Sisa Kuota Hari Ini</span>
                        <p className="mt-1 text-sm font-bold text-emerald-700 tabular-nums">
                          {formatRupiah(detail.limits.remainingDailyQuota)}
                        </p>
                        <span className="text-[11px] text-slate-500">Masih dapat dicairkan</span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500 space-y-1 tabular-nums">
                      <div className="flex justify-between">
                        <span>Limit Global Pesantren</span>
                        <span className="font-medium text-slate-800">
                          {formatRupiah(detail.limits.globalDailyLimit)}/hari
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Limit Khusus Wali</span>
                        <span className="font-medium text-slate-800">
                          {detail.limits.parentDailyLimit !== null
                            ? `${formatRupiah(detail.limits.parentDailyLimit)}/hari`
                            : 'Mengikuti global'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mutasi Ledger Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-sm font-bold text-slate-900 tabular-nums">
                        Histori Mutasi Buku Besar ({detail.totalLedgerCount})
                      </h4>
                    </div>

                    {detail.ledgerHistory.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500 text-xs">
                        Belum ada mutasi buku besar untuk santri ini.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        {/* Mobile List inside Drawer (sm:hidden) */}
                        <div className="divide-y divide-slate-100 sm:hidden">
                          {detail.ledgerHistory.map((entry) => {
                            const isIncoming = entry.direction === 'IN'
                            const refShort = formatReferenceShort(entry.reference_id)
                            return (
                              <div key={`m-le-${entry.id}`} className="p-3.5 space-y-1.5 text-xs">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-900">
                                      {MOVEMENT_LABELS[entry.movement_type] || entry.movement_type}
                                    </div>
                                    <div className="text-[11px] text-slate-500 tabular-nums">
                                      {formatFinanceDate(entry.created_at, true)}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 tabular-nums">
                                    <div className={`font-bold ${isIncoming ? 'text-emerald-700' : 'text-slate-900'}`}>
                                      {isIncoming ? '+' : '-'}{formatRupiah(entry.amount)}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Saldo {formatRupiah(entry.balance_after)}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span>{entry.operator_name || 'Sistem'}</span>
                                  {refShort && (
                                    <span className="font-mono" title={entry.reference_id || undefined}>
                                      {refShort}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Desktop Table inside Drawer (hidden sm:block) */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-xs">
                            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                              <tr>
                                <th className="px-3.5 py-2.5 text-left font-semibold">Waktu &amp; Jenis</th>
                                <th className="px-3.5 py-2.5 text-right font-semibold">Nominal</th>
                                <th className="px-3.5 py-2.5 text-right font-semibold">Saldo Akhir</th>
                                <th className="px-3.5 py-2.5 text-left font-semibold">Petugas &amp; Ref</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {detail.ledgerHistory.map((entry) => {
                                const isIncoming = entry.direction === 'IN'
                                const refShort = formatReferenceShort(entry.reference_id)
                                return (
                                  <tr key={entry.id} className="hover:bg-slate-50/70">
                                    <td className="px-3.5 py-2.5">
                                      <div className="flex items-center gap-1.5">
                                        {isIncoming ? (
                                          <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                                        ) : (
                                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                                        )}
                                        <span className="font-semibold text-slate-900">
                                          {MOVEMENT_LABELS[entry.movement_type] || entry.movement_type}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                        {formatFinanceDate(entry.created_at, true)}
                                      </div>
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right font-bold whitespace-nowrap tabular-nums">
                                      <span className={isIncoming ? 'text-emerald-700' : 'text-slate-900'}>
                                        {isIncoming ? '+' : '-'}{formatRupiah(entry.amount)}
                                      </span>
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right font-medium text-slate-700 whitespace-nowrap tabular-nums">
                                      {formatRupiah(entry.balance_after)}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-slate-500">
                                      <div className="truncate max-w-[140px] font-medium text-slate-700">
                                        {entry.operator_name || 'Sistem'}
                                      </div>
                                      {refShort && (
                                        <div
                                          className="text-[11px] font-mono text-slate-500 truncate max-w-[140px]"
                                          title={entry.reference_id || undefined}
                                        >
                                          {refShort}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Atur Limit Orang Tua */}
      {isLimitModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Atur limit pencairan wali">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setIsLimitModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">Atur Limit Pencairan Wali</h3>
              <button
                type="button"
                aria-label="Tutup modal limit"
                onClick={() => setIsLimitModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveLimits} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Limit Harian (Rupiah)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="Kosongkan jika mengikuti limit global"
                  value={parentDailyLimitInput}
                  onChange={(e) => setParentDailyLimitInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Pesantren membatasi maksimal {formatRupiah(detail?.limits.globalDailyLimit || 100000)}/hari.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Limit Mingguan (Opsional)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="Opsional"
                  value={parentWeeklyLimitInput}
                  onChange={(e) => setParentWeeklyLimitInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Limit Bulanan (Opsional)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="Opsional"
                  value={parentMonthlyLimitInput}
                  onChange={(e) => setParentMonthlyLimitInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLimitModalOpen(false)}
                  className="min-h-[38px] rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingLimit}
                  className="min-h-[38px] rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition cursor-pointer"
                >
                  {isSavingLimit ? 'Menyimpan…' : 'Simpan Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
