'use client'

import React, { useState } from 'react'
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
  isSubmitting: boolean
  onWithdraw: (amount: number, notes?: string) => Promise<void>
  onDepositOrPay: (items: LoketPaymentItemInput[], notes?: string) => Promise<void>
}

const WITHDRAW_QUICK_CHIPS = [10000, 20000, 50000, 100000]
const TOPUP_QUICK_CHIPS = [20000, 50000, 100000, 200000]

export default function PosActionPanel({
  financials,
  isSubmitting,
  onWithdraw,
  onDepositOrPay,
}: PosActionPanelProps) {
  const [activeTab, setActiveTab] = useState<'WITHDRAW' | 'DEPOSIT_PAY'>('WITHDRAW')

  // State Penarikan Uang Jajan
  const [withdrawAmount, setWithdrawAmount] = useState<number>(20000)
  const [withdrawNotes, setWithdrawNotes] = useState<string>('')

  // State Setoran Uang Jajan Tunai
  const [topupAmount, setTopupAmount] = useState<number>(0)
  // State Pilihan Bayar Tagihan
  const [selectedObligations, setSelectedObligations] = useState<Record<string, number>>({})
  const [depositNotes, setDepositNotes] = useState<string>('')

  const formatRupiah = (val: number) => `Rp${Math.max(0, val).toLocaleString('id-ID')}`

  const maxAllowedWithdrawal = Math.min(
    financials.balance,
    financials.limits.remainingDailyQuota
  )

  const isWithdrawExceedsBalance = withdrawAmount > financials.balance
  const isWithdrawExceedsLimit = withdrawAmount > financials.limits.remainingDailyQuota
  const isWithdrawValid =
    withdrawAmount > 0 &&
    !isWithdrawExceedsBalance &&
    !isWithdrawExceedsLimit &&
    !isSubmitting

  // Hitung total setoran / pembayaran
  const obligationsTotal = Object.values(selectedObligations).reduce((a, b) => a + b, 0)
  const totalDepositOrPay = topupAmount + obligationsTotal
  const isDepositOrPayValid = totalDepositOrPay > 0 && !isSubmitting

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isWithdrawValid) return
    await onWithdraw(withdrawAmount, withdrawNotes)
  }

  const handleToggleObligation = (ob: (typeof financials.unpaidObligations)[0]) => {
    setSelectedObligations((prev) => {
      const next = { ...prev }
      if (next[ob.id]) {
        delete next[ob.id]
      } else {
        next[ob.id] = ob.remaining
      }
      return next
    })
  }

  const handleObligationAmountChange = (obId: string, val: number) => {
    setSelectedObligations((prev) => ({
      ...prev,
      [obId]: Math.max(0, val),
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
              amount: amt,
            })
        }
      }
    }

    await onDepositOrPay(payloadItems, depositNotes)
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Tab Switcher POS */}
      <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('WITHDRAW')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'WITHDRAW'
              ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          <span>Tarik Uang Jajan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DEPOSIT_PAY')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'DEPOSIT_PAY'
              ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 text-blue-600" />
          <span>Setor / Bayar Tagihan</span>
          {financials.unpaidObligations.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
              {financials.unpaidObligations.length}
            </span>
          )}
        </button>
      </div>

      {/* ─── TAB 1: TARIK UANG JAJAN ─── */}
      {activeTab === 'WITHDRAW' && (
        <form onSubmit={handleWithdrawSubmit} className="p-4 sm:p-6 space-y-5">
          {/* 4 Cards Saldo & Limit Santri */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Saldo Uang Jajan</span>
              <strong className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 block">
                {formatRupiah(financials.balance)}
              </strong>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Limit Hari Ini</span>
              <strong className="text-sm sm:text-base font-bold text-slate-900 mt-0.5 block">
                {formatRupiah(financials.limits.effectiveDailyLimit)}
              </strong>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Sudah Ditarik Hari Ini</span>
              <strong className="text-sm sm:text-base font-bold text-slate-700 mt-0.5 block">
                {formatRupiah(financials.limits.withdrawnToday)}
              </strong>
            </div>

            <div
              className={`rounded-xl p-3 border ${
                financials.limits.remainingDailyQuota > 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <span className="text-[11px] font-semibold opacity-80 block">Sisa Kuota Hari Ini</span>
              <strong className="text-sm sm:text-base font-bold mt-0.5 block">
                {formatRupiah(financials.limits.remainingDailyQuota)}
              </strong>
            </div>
          </div>

          {/* Input Nominal Penarikan */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Nominal Penarikan Tunai
            </label>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500 font-bold text-lg pointer-events-none">
                Rp
              </span>
              <input
                type="number"
                min="1000"
                step="1000"
                required
                disabled={isSubmitting || maxAllowedWithdrawal <= 0}
                value={withdrawAmount || ''}
                onChange={(e) => setWithdrawAmount(Number(e.target.value) || 0)}
                placeholder="0"
                className={`w-full pl-12 pr-4 py-3.5 bg-white border-2 rounded-2xl text-slate-900 font-extrabold text-xl sm:text-2xl outline-hidden transition-all ${
                  isWithdrawExceedsBalance || isWithdrawExceedsLimit
                    ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                    : 'border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                }`}
              />
            </div>

            {/* Quick Chips Penarikan */}
            <div className="flex flex-wrap gap-2 pt-1">
              {WITHDRAW_QUICK_CHIPS.map((amt) => {
                const disabled = amt > maxAllowedWithdrawal
                return (
                  <button
                    key={amt}
                    type="button"
                    disabled={disabled || isSubmitting}
                    onClick={() => setWithdrawAmount(amt)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      withdrawAmount === amt
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : disabled
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
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
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    withdrawAmount === maxAllowedWithdrawal
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  Maksimal ({formatRupiah(maxAllowedWithdrawal)})
                </button>
              )}
            </div>

            {/* Error Feedback jika melebihi saldo atau kuota limit */}
            {isWithdrawExceedsBalance && (
              <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 pt-1">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Nominal melebihi saldo uang jajan santri ({formatRupiah(financials.balance)}).</span>
              </p>
            )}

            {!isWithdrawExceedsBalance && isWithdrawExceedsLimit && (
              <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 pt-1">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Nominal melebihi sisa kuota penarikan hari ini (Maksimal{' '}
                  {formatRupiah(financials.limits.remainingDailyQuota)}).
                </span>
              </p>
            )}
          </div>

          {/* Catatan Penarikan Opsional */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Catatan Penarikan (Opsional)
            </label>
            <input
              type="text"
              value={withdrawNotes}
              onChange={(e) => setWithdrawNotes(e.target.value)}
              placeholder="Contoh: Titip beli kitab, keperluan asrama..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
            />
          </div>

          {/* CTA Penarikan */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isWithdrawValid}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memproses Penarikan Kasir...</span>
                </>
              ) : (
                <>
                  <ArrowDownLeft className="w-5 h-5" />
                  <span>Cairkan Uang Jajan {withdrawAmount > 0 ? formatRupiah(withdrawAmount) : ''}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ─── TAB 2: SETOR / BAYAR TAGIHAN ─── */}
      {activeTab === 'DEPOSIT_PAY' && (
        <form onSubmit={handleDepositOrPaySubmit} className="p-4 sm:p-6 space-y-6">
          {/* Sub-section 1: Setor Tunai Uang Jajan (Top-up Cash) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                <Coins className="w-4 h-4 text-emerald-600" />
                <span>Tambah / Setor Saldo Uang Jajan</span>
              </label>
              <span className="text-[11px] text-slate-500">
                Saldo saat ini: <strong className="text-slate-900">{formatRupiah(financials.balance)}</strong>
              </span>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 font-bold text-base pointer-events-none">
                Rp
              </span>
              <input
                type="number"
                min="0"
                step="1000"
                disabled={isSubmitting}
                value={topupAmount || ''}
                onChange={(e) => setTopupAmount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold text-lg focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {TOPUP_QUICK_CHIPS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setTopupAmount(amt)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                    topupAmount === amt
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  +{formatRupiah(amt)}
                </button>
              ))}
              {topupAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setTopupAmount(0)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Batal Setor Jajan
                </button>
              )}
            </div>
          </div>

          {/* Sub-section 2: Bayar Kewajiban Tagihan Sekolah */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span>Pilih Kewajiban Tagihan Santri</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {financials.unpaidObligations.length} tagihan belum lunas
              </span>
            </div>

            {financials.unpaidObligations.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Seluruh kewajiban tagihan santri telah lunas penuh.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {financials.unpaidObligations.map((ob) => {
                  const isSelected = selectedObligations[ob.id] !== undefined
                  const currentAmount = selectedObligations[ob.id] ?? ob.remaining
                  const isDisallowed = ob.installmentRule === 'DISALLOWED'

                  return (
                    <div
                      key={ob.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-200'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id={`ob-${ob.id}`}
                          checked={isSelected}
                          onChange={() => handleToggleObligation(ob)}
                          disabled={isSubmitting}
                          className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <label
                            htmlFor={`ob-${ob.id}`}
                            className="text-xs font-bold text-slate-900 cursor-pointer"
                          >
                            {ob.itemLabel}{' '}
                            <span className="text-slate-500 font-normal">({ob.period})</span>
                          </label>
                          <p className="text-[11px] text-slate-500">
                            Sisa: <strong className="text-slate-800">{formatRupiah(ob.remaining)}</strong>
                            {ob.installmentRule === 'ALLOWED' ? (
                              <span className="text-amber-700 ml-1.5 font-medium">(Bisa dicicil)</span>
                            ) : (
                              <span className="text-slate-400 ml-1.5">(Wajib lunas penuh)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Input Nominal jika dipilih */}
                      {isSelected && (
                        <div className="sm:w-44 pl-6 sm:pl-0">
                          {isDisallowed ? (
                            <span className="text-xs font-bold text-slate-900 block sm:text-right">
                              {formatRupiah(ob.remaining)}
                            </span>
                          ) : (
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400 text-xs">
                                Rp
                              </span>
                              <input
                                type="number"
                                min="1000"
                                max={ob.remaining}
                                step="1000"
                                disabled={isSubmitting}
                                value={currentAmount || ''}
                                onChange={(e) =>
                                  handleObligationAmountChange(ob.id, Number(e.target.value) || 0)
                                }
                                className="w-full pl-7 pr-2 py-1 text-xs font-bold text-right bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden"
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

          {/* Rincian Total Setoran / Pembayaran */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Setor Uang Jajan Tunai:</span>
              <span className="font-semibold text-slate-900">{formatRupiah(topupAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Pembayaran Tagihan Sekolah:</span>
              <span className="font-semibold text-slate-900">{formatRupiah(obligationsTotal)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-slate-900">
              <span>Total Uang Tunai Diterima:</span>
              <span className="text-blue-700 text-base">{formatRupiah(totalDepositOrPay)}</span>
            </div>
          </div>

          {/* Catatan Setoran / Pembayaran Opsional */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Catatan Transaksi (Opsional)
            </label>
            <input
              type="text"
              value={depositNotes}
              onChange={(e) => setDepositNotes(e.target.value)}
              placeholder="Contoh: Titipan orang tua saat sambangan..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden transition-all"
            />
          </div>

          {/* CTA Setor / Bayar */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={!isDepositOrPayValid}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memproses Pembayaran Kasir...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-5 h-5" />
                  <span>
                    Terima Setoran & Pembayaran {totalDepositOrPay > 0 ? formatRupiah(totalDepositOrPay) : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
