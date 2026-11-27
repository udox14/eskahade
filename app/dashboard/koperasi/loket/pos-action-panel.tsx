'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { BILLING_PHASE_LABELS } from '@/lib/finance/billing-periods'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import {
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import type { StudentLoketFinancials, LoketPaymentItemInput, LoketItemType } from './actions'

interface PosActionPanelProps {
  financials: StudentLoketFinancials
  onSelectBillingPeriod: (period: string) => Promise<void>
  isSubmitting: boolean
  /** Undefined: tarik tunai individual dinonaktifkan (pencairan via perwakilan). */
  onWithdraw?: (amount: number, notes?: string) => Promise<void>
  onDepositOrPay: (items: LoketPaymentItemInput[], notes?: string) => Promise<void>
}

const WITHDRAW_QUICK_CHIPS = [10000, 20000, 50000, 100000]
const TOPUP_QUICK_CHIPS = [20000, 50000, 100000, 200000]
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatRupiah(val: number): string {
  return `Rp${Math.max(0, Math.round(val)).toLocaleString('id-ID')}`
}

function formatPeriodShort(period: string): string {
  if (period === 'LIFETIME') return 'Sekali Bayar'
  const match = period.match(/^(\d{4})-(\d{2})$/)
  if (!match) return period
  const [, y, m] = match
  const idx = Number(m) - 1
  return idx >= 0 && idx < 12 ? `${MONTH_SHORT[idx]} ${y}` : period
}

export default function PosActionPanel({
  financials,
  onSelectBillingPeriod,
  isSubmitting,
  onWithdraw,
  onDepositOrPay,
}: PosActionPanelProps) {
  const [billingPeriod, setBillingPeriod] = useState('')
  const [billingError, setBillingError] = useState('')
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [activeTab, setActiveTab] = useState<'WITHDRAW' | 'DEPOSIT_PAY'>(
    onWithdraw ? 'WITHDRAW' : 'DEPOSIT_PAY'
  )

  // State Penarikan Uang Jajan (jika diaktifkan kembali)
  const [withdrawAmount, setWithdrawAmount] = useState<number>(20000)
  const [withdrawNotes, setWithdrawNotes] = useState<string>('')

  // State Setoran Uang Jajan Tunai & Bayar Tagihan
  const [topupAmount, setTopupAmount] = useState<number>(0)
  const [selectedObligations, setSelectedObligations] = useState<Record<string, number>>({})
  const [depositNotes, setDepositNotes] = useState<string>('')

  const periodOptions = useMemo<SelectPickerOption[]>(
    () => [
      { value: '', label: 'Tagihan berjalan & tunggakan' },
      ...financials.advancePeriods.map((p) => ({
        value: p,
        label: `Bayar di muka: ${formatPeriodShort(p)}`,
      })),
    ],
    [financials.advancePeriods]
  )

  const maxAllowedWithdrawal = Math.min(financials.balance, financials.limits.remainingDailyQuota)
  const isWithdrawExceedsBalance = withdrawAmount > financials.balance
  const isWithdrawExceedsLimit = withdrawAmount > financials.limits.remainingDailyQuota
  const isWithdrawValid =
    withdrawAmount > 0 && !isWithdrawExceedsBalance && !isWithdrawExceedsLimit && !isSubmitting

  const obligationsTotal = Object.values(selectedObligations).reduce((a, b) => a + b, 0)
  const totalDepositOrPay = topupAmount + obligationsTotal
  const isDepositOrPayValid = totalDepositOrPay > 0 && !isSubmitting && !loadingBilling

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isWithdrawValid || !onWithdraw) return
    await onWithdraw(withdrawAmount, withdrawNotes)
  }

  const handleToggleObligation = (ob: (typeof financials.unpaidObligations)[0]) => {
    setSelectedObligations((prev) => {
      const next = { ...prev }
      if (next[ob.id] !== undefined) {
        delete next[ob.id]
      } else {
        next[ob.id] = ob.remaining
      }
      return next
    })
  }

  const handleObligationAmountChange = (obId: string, val: number, maxRemaining: number) => {
    const clamped = Math.max(0, Math.min(maxRemaining, val))
    setSelectedObligations((prev) => ({
      ...prev,
      [obId]: clamped,
    }))
  }

  const handleDepositOrPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isDepositOrPayValid) return

    const payloadItems: LoketPaymentItemInput[] = []

    if (topupAmount > 0) {
      payloadItems.push({
        obligationId: null,
        itemType: 'UANG_JAJAN',
        amount: topupAmount,
      })
    }

    for (const [obId, amt] of Object.entries(selectedObligations)) {
      if (amt > 0) {
        const ob = financials.unpaidObligations.find((o) => o.id === obId)
        if (ob) {
          payloadItems.push({
            obligationId: ob.id,
            itemType: ob.itemType as LoketItemType,
            amount: Math.min(amt, ob.remaining),
          })
        }
      }
    }

    await onDepositOrPay(payloadItems, depositNotes)
  }

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
      {/* Header Panel */}
      {onWithdraw ? (
        <div className="flex gap-1.5 border-b border-slate-200 bg-slate-50/70 p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('WITHDRAW')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'WITHDRAW'
                ? 'border border-slate-200 bg-white text-emerald-800 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
            }`}
          >
            <ArrowDownLeft className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Tarik Uang Jajan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DEPOSIT_PAY')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'DEPOSIT_PAY'
                ? 'border border-slate-200 bg-white text-emerald-800 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Setor &amp; Bayar Tagihan</span>
            {financials.unpaidObligations.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 tabular-nums">
                {financials.unpaidObligations.length}
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">Setor Uang Jajan &amp; Bayar Tagihan Tunai</h3>
          </div>
          <p className="text-xs text-slate-500">
            Pencairan uang jajan dilakukan via{' '}
            <Link
              href="/dashboard/koperasi/pencairan-uang-jajan"
              className="font-semibold text-emerald-700 underline hover:text-emerald-800"
            >
              Pencairan Kolektif
            </Link>
            .
          </p>
        </div>
      )}

      {/* TAB 1: TARIK UANG JAJAN (jika diaktifkan) */}
      {activeTab === 'WITHDRAW' && onWithdraw && (
        <form onSubmit={handleWithdrawSubmit} className="space-y-5 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="block text-[11px] font-medium text-slate-500">Saldo Uang Jajan</span>
              <strong className="mt-0.5 block text-sm sm:text-base font-bold text-slate-900 tabular-nums">
                {formatRupiah(financials.balance)}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="block text-[11px] font-medium text-slate-500">Limit Hari Ini</span>
              <strong className="mt-0.5 block text-sm sm:text-base font-bold text-slate-900 tabular-nums">
                {formatRupiah(financials.limits.effectiveDailyLimit)}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="block text-[11px] font-medium text-slate-500">Sudah Ditarik</span>
              <strong className="mt-0.5 block text-sm sm:text-base font-bold text-slate-700 tabular-nums">
                {formatRupiah(financials.limits.withdrawnToday)}
              </strong>
            </div>
            <div
              className={`rounded-xl border p-3 ${
                financials.limits.remainingDailyQuota > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              <span className="block text-[11px] font-semibold opacity-80">Sisa Kuota Hari Ini</span>
              <strong className="mt-0.5 block text-sm sm:text-base font-bold tabular-nums">
                {formatRupiah(financials.limits.remainingDailyQuota)}
              </strong>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Nominal Penarikan Tunai
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-base font-bold text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                required
                disabled={isSubmitting || maxAllowedWithdrawal <= 0}
                value={withdrawAmount > 0 ? withdrawAmount.toLocaleString('id-ID') : ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                  setWithdrawAmount(val)
                }}
                placeholder="0"
                className={`w-full rounded-xl border-2 bg-white py-3 pl-12 pr-4 text-xl font-bold text-slate-900 tabular-nums outline-none transition-all ${
                  isWithdrawExceedsBalance || isWithdrawExceedsLimit
                    ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500'
                    : 'border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15'
                }`}
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {WITHDRAW_QUICK_CHIPS.map((amt) => {
                const chipDisabled = amt > maxAllowedWithdrawal
                return (
                  <button
                    key={amt}
                    type="button"
                    disabled={chipDisabled || isSubmitting}
                    onClick={() => setWithdrawAmount(amt)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                      withdrawAmount === amt
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : chipDisabled
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-50'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                    }`}
                  >
                    {formatRupiah(amt)}
                  </button>
                )
              })}
              {maxAllowedWithdrawal > 0 && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setWithdrawAmount(maxAllowedWithdrawal)}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 tabular-nums cursor-pointer"
                >
                  Maksimal ({formatRupiah(maxAllowedWithdrawal)})
                </button>
              )}
            </div>

            {isWithdrawExceedsBalance && (
              <p className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-rose-600">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Nominal melebihi saldo uang jajan santri ({formatRupiah(financials.balance)}).</span>
              </p>
            )}
            {!isWithdrawExceedsBalance && isWithdrawExceedsLimit && (
              <p className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-rose-600">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Nominal melebihi sisa kuota hari ini (Maksimal {formatRupiah(financials.limits.remainingDailyQuota)}).
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Catatan Penarikan (Opsional)</label>
            <input
              type="text"
              value={withdrawNotes}
              onChange={(e) => setWithdrawNotes(e.target.value)}
              placeholder="Contoh: Keperluan asrama…"
              className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!isWithdrawValid}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-40 transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Memproses Penarikan…</span>
              </>
            ) : (
              <>
                <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
                <span>Cairkan Uang Jajan {withdrawAmount > 0 ? formatRupiah(withdrawAmount) : ''}</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* TAB 2: SETOR / BAYAR TAGIHAN */}
      {activeTab === 'DEPOSIT_PAY' && (
        <form onSubmit={handleDepositOrPaySubmit} className="space-y-5 p-4 sm:p-5">
          {/* Sub-section 1: Setor Uang Jajan */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                <Coins className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span>Setor Saldo Uang Jajan</span>
              </label>
              <span className="text-xs text-slate-500 tabular-nums">
                Saldo saat ini: <strong className="text-slate-900">{formatRupiah(financials.balance)}</strong>
              </span>
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                disabled={isSubmitting}
                value={topupAmount > 0 ? topupAmount.toLocaleString('id-ID') : ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                  setTopupAmount(val)
                }}
                placeholder="0"
                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-lg font-bold text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {TOPUP_QUICK_CHIPS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setTopupAmount(amt)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                    topupAmount === amt
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  +{formatRupiah(amt)}
                </button>
              ))}
              {topupAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setTopupAmount(0)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>
          </div>

          {/* Sub-section 2: Pilih Tagihan Pesantren */}
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Tagihan Pesantren ({financials.unpaidObligations.length})
                </span>
              </div>

              {financials.advancePeriods.length > 0 && (
                <SelectPicker
                  value={billingPeriod}
                  options={periodOptions}
                  disabled={isSubmitting || loadingBilling}
                  onChange={async (period) => {
                    setLoadingBilling(true)
                    setBillingError('')
                    try {
                      await onSelectBillingPeriod(period)
                      setBillingPeriod(period)
                      setSelectedObligations({})
                    } catch (error) {
                      setBillingError(error instanceof Error ? error.message : 'Tagihan gagal dimuat.')
                    } finally {
                      setLoadingBilling(false)
                    }
                  }}
                  ariaLabel="Periode pembayaran tagihan"
                  align="right"
                  className="w-full sm:w-64 [&>button]:w-full"
                />
              )}
            </div>

            {(billingError || financials.billingWarnings.length > 0) && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span>{billingError || `Perlu pemeriksaan: ${financials.billingWarnings.join('; ')}`}</span>
              </div>
            )}

            {financials.unpaidObligations.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>Seluruh tagihan santri untuk periode ini sudah lunas.</span>
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
                {financials.unpaidObligations.map((ob) => {
                  const isSelected = selectedObligations[ob.id] !== undefined
                  const currentAmount = selectedObligations[ob.id] ?? ob.remaining
                  const isDisallowed = ob.installmentRule === 'DISALLOWED'

                  return (
                    <div
                      key={ob.id}
                      className={`flex flex-col justify-between gap-2.5 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id={`ob-${ob.id}`}
                          checked={isSelected}
                          onChange={() => handleToggleObligation(ob)}
                          disabled={isSubmitting}
                          className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 accent-emerald-700"
                        />
                        <div>
                          <label htmlFor={`ob-${ob.id}`} className="cursor-pointer text-xs font-semibold text-slate-900">
                            {ob.itemLabel}{' '}
                            <span className="font-normal text-slate-500">
                              ({formatPeriodShort(ob.period)}) · {BILLING_PHASE_LABELS[ob.billingPhase]}
                            </span>
                          </label>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            Sisa: <strong className="text-slate-800">{formatRupiah(ob.remaining)}</strong>
                            {ob.installmentRule === 'ALLOWED' ? (
                              <span className="ml-1.5 font-medium text-amber-700">(Bisa dicicil)</span>
                            ) : (
                              <span className="ml-1.5 text-slate-400">(Wajib penuh)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="pl-6 sm:w-44 sm:pl-0">
                          {isDisallowed ? (
                            <span className="block text-xs font-bold text-slate-900 tabular-nums sm:text-right">
                              {formatRupiah(ob.remaining)}
                            </span>
                          ) : (
                            <div className="relative">
                              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs text-slate-400">
                                Rp
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={isSubmitting}
                                value={currentAmount > 0 ? currentAmount.toLocaleString('id-ID') : ''}
                                onChange={(e) => {
                                  const raw = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                                  handleObligationAmountChange(ob.id, raw, ob.remaining)
                                }}
                                aria-label={`Nominal cicilan ${ob.itemLabel}`}
                                className="min-h-[34px] w-full rounded-lg border border-emerald-400 bg-white py-1 pl-8 pr-2.5 text-right text-xs font-bold text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Ringkasan Total */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-xs tabular-nums">
            <div className="flex justify-between text-slate-600">
              <span>Setor Uang Jajan Tunai</span>
              <span className="font-semibold text-slate-900">{formatRupiah(topupAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Pembayaran Tagihan Pesantren</span>
              <span className="font-semibold text-slate-900">{formatRupiah(obligationsTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
              <span>Total Uang Tunai Diterima</span>
              <span className="text-base text-emerald-700">{formatRupiah(totalDepositOrPay)}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Catatan Transaksi (Opsional)</label>
            <input
              type="text"
              value={depositNotes}
              onChange={(e) => setDepositNotes(e.target.value)}
              placeholder="Contoh: Titipan orang tua saat sambangan…"
              className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!isDepositOrPayValid}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Memproses Pembayaran Kasir…</span>
              </>
            ) : (
              <>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                <span>
                  Terima Setoran &amp; Pembayaran {totalDepositOrPay > 0 ? formatRupiah(totalDepositOrPay) : ''}
                </span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
