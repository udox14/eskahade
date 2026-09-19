'use client'

import React, { useEffect, useState, useTransition } from 'react'
import {
  X,
  Wallet,
  RefreshCw,
  SlidersHorizontal,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import { SantriPhotoAvatar } from '@/components/ui/santri-photo-avatar'
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

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    })
  } catch {
    return dateStr
  }
}

const MOVEMENT_LABELS: Record<string, string> = {
  TOPUP_ONLINE: 'Top-Up Online (Duitku)',
  TOPUP_CASH: 'Setor Tunai (Loket)',
  WITHDRAWAL_LOKET: 'Pencairan Loket',
  REVERSAL: 'Pembalikan / Reversal',
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

  // Keyboard navigation: Escape to close
  useEffect(() => {
    if (!santriId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [santriId, onClose])

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
          setParentDailyLimitInput(res.limits.parentDailyLimit !== null ? String(res.limits.parentDailyLimit) : '')
          setParentWeeklyLimitInput(res.limits.parentWeeklyLimit !== null ? String(res.limits.parentWeeklyLimit) : '')
          setParentMonthlyLimitInput(res.limits.parentMonthlyLimit !== null ? String(res.limits.parentMonthlyLimit) : '')
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Gagal memuat rincian dompet santri.'
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
    if (!santriId || !canMutate) return
    setIsRecalculating(true)
    try {
      await recalculateStudentWalletAction(santriId)
      // Reload detail
      const res = await getStudentWalletDetail(santriId)
      setDetail(res)
      if (onBalanceUpdated) onBalanceUpdated()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal melakukan rekalkulasi.')
    } finally {
      setIsRecalculating(false)
    }
  }

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!santriId || !canMutate) return
    setIsSavingLimit(true)
    try {
      const daily = parentDailyLimitInput.trim() !== '' ? parseInt(parentDailyLimitInput, 10) : null
      const weekly = parentWeeklyLimitInput.trim() !== '' ? parseInt(parentWeeklyLimitInput, 10) : null
      const monthly = parentMonthlyLimitInput.trim() !== '' ? parseInt(parentMonthlyLimitInput, 10) : null

      await saveParentLimitsAction(santriId, { daily, weekly, monthly })
      const res = await getStudentWalletDetail(santriId)
      setDetail(res)
      setIsLimitModalOpen(false)
      if (onBalanceUpdated) onBalanceUpdated()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyimpan limit.')
    } finally {
      setIsSavingLimit(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Buku Besar Uang Jajan
                  </h2>
                  <p className="text-xs text-slate-500">
                    Dana titipan santri & riwayat mutasi authoritative
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Tutup drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isPending && !detail ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-20 bg-slate-100 rounded-xl" />
                  <div className="h-32 bg-slate-100 rounded-xl" />
                  <div className="h-48 bg-slate-100 rounded-xl" />
                </div>
              ) : errorMessage ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                  <p>{errorMessage}</p>
                </div>
              ) : detail ? (
                <>
                  {/* Identity Card */}
                  <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                    <SantriPhotoAvatar
                      src={detail.santri.fotoUrl}
                      name={detail.santri.namaLengkap}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-900 truncate">
                        {detail.santri.namaLengkap}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        NIS: <span className="font-medium text-slate-700">{detail.santri.nis}</span>
                        {detail.santri.asrama && (
                          <> • Asrama: <span className="font-medium text-slate-700">{detail.santri.asrama}</span></>
                        )}
                        {detail.santri.kamar && <> / Kamar {detail.santri.kamar}</>}
                      </p>
                    </div>
                  </div>

                  {/* Saldo Authoritative Card */}
                  <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-emerald-100/30 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                          Saldo Dana Titipan (Authoritative)
                        </span>
                        <div className="text-3xl font-extrabold text-emerald-950 mt-1">
                          {formatRupiah(detail.balance.authoritative)}
                        </div>
                      </div>
                      {canMutate && (
                        <button
                          type="button"
                          onClick={handleRecalculate}
                          disabled={isRecalculating}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs hover:bg-emerald-50 disabled:opacity-60 transition"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                          {isRecalculating ? 'Menghitung...' : 'Rekalkulasi Saldo'}
                        </button>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>
                        Buku besar sinkron dengan cache santri ({formatRupiah(detail.balance.cached)}).
                      </span>
                    </div>
                  </div>

                  {/* Limit Section Card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                        <h4 className="text-sm font-bold text-slate-900">
                          Limit Pencairan
                        </h4>
                      </div>
                      {canMutate && (
                        <button
                          type="button"
                          onClick={() => setIsLimitModalOpen(true)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          Atur Limit Ortu
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-xs">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <span className="text-slate-500">Limit Efektif Harian</span>
                        <p className="mt-1 font-bold text-slate-900 text-sm">
                          {formatRupiah(detail.limits.effectiveDailyLimit)}
                        </p>
                        <span className="text-[10px] text-slate-400">Paling ketat</span>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <span className="text-slate-500">Ditarik Hari Ini</span>
                        <p className="mt-1 font-bold text-rose-600 text-sm">
                          {formatRupiah(detail.limits.withdrawnToday)}
                        </p>
                        <span className="text-[10px] text-slate-400">Loket koperasi</span>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 col-span-2 sm:col-span-1">
                        <span className="text-slate-500">Sisa Kuota Harian</span>
                        <p className="mt-1 font-bold text-emerald-600 text-sm">
                          {formatRupiah(detail.limits.remainingDailyQuota)}
                        </p>
                        <span className="text-[10px] text-slate-400">Dapat dicairkan</span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Limit Global Pesantren:</span>
                        <span className="font-medium text-slate-700">{formatRupiah(detail.limits.globalDailyLimit)}/hari</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Limit Khusus Orang Tua:</span>
                        <span className="font-medium text-slate-700">
                          {detail.limits.parentDailyLimit !== null ? `${formatRupiah(detail.limits.parentDailyLimit)}/hari` : 'Mengikuti Global'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mutasi Ledger Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-slate-900">
                        Histori Mutasi Buku Besar ({detail.totalLedgerCount})
                      </h4>
                    </div>

                    {detail.ledgerHistory.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs">
                        Belum ada mutasi buku besar untuk santri ini.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-xs">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-3 py-2.5 text-left font-semibold">Waktu & Tipe</th>
                              <th className="px-3 py-2.5 text-right font-semibold">Nominal</th>
                              <th className="px-3 py-2.5 text-right font-semibold">Saldo Akhir</th>
                              <th className="px-3 py-2.5 text-left font-semibold">Petugas / Ref</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {detail.ledgerHistory.map((entry) => {
                              const isIncoming = entry.direction === 'IN'
                              return (
                                <tr key={entry.id} className="hover:bg-slate-50/50">
                                  <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                      {isIncoming ? (
                                        <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                      ) : (
                                        <ArrowUpRight className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                      )}
                                      <span className="font-medium text-slate-900">
                                        {MOVEMENT_LABELS[entry.movement_type] || entry.movement_type}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      {formatDateDisplay(entry.created_at)}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-semibold">
                                    <span className={isIncoming ? 'text-emerald-700' : 'text-rose-700'}>
                                      {isIncoming ? '+' : '-'}{formatRupiah(entry.amount)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                                    {formatRupiah(entry.balance_after)}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-500">
                                    <div className="truncate max-w-[120px] font-medium text-slate-700">
                                      {entry.operator_name || '-'}
                                    </div>
                                    {entry.reference_id && (
                                      <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                        Ref: {entry.reference_id}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={() => setIsLimitModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">
                Atur Limit Pencairan Orang Tua
              </h3>
              <button
                type="button"
                onClick={() => setIsLimitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLimits} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Limit Harian (Rupiah)
                </label>
                <input
                  type="number"
                  placeholder="Kosongkan jika mengikuti limit global"
                  value={parentDailyLimitInput}
                  onChange={(e) => setParentDailyLimitInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
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
                  placeholder="Opsional"
                  value={parentWeeklyLimitInput}
                  onChange={(e) => setParentWeeklyLimitInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Limit Bulanan (Opsional)
                </label>
                <input
                  type="number"
                  placeholder="Opsional"
                  value={parentMonthlyLimitInput}
                  onChange={(e) => setParentMonthlyLimitInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLimitModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingLimit}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isSavingLimit ? 'Menyimpan...' : 'Simpan Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
