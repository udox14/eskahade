'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Wallet,
  Copy,
  CheckCircle2,
  Clock,
  X,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Calendar,
  Sparkles,
} from 'lucide-react'
import type {
  PortalStudentBillingData,
  PortalCheckoutResponse,
  PortalObligationItem,
} from '@/lib/portal/finance'
import { createPortalCheckoutAction } from './actions'

function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Rp0'
  return `Rp${Math.round(amount).toLocaleString('id-ID')}`
}

interface TagihanClientProps {
  billingData: PortalStudentBillingData
}

type PeriodFilterTab = 'ALL' | 'PAST' | 'CURRENT' | 'UPCOMING' | 'ANNUAL'

export function TagihanClient({ billingData }: TagihanClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<PeriodFilterTab>('ALL')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // USPP (Cicilan)
  const [usppAmount, setUsppAmount] = useState<number>(
    billingData.obligations.uspp ? billingData.obligations.uspp.remaining : 0
  )
  const [isUsppSelected, setIsUsppSelected] = useState<boolean>(false)

  // Top-Up Uang Jajan
  const [isTopUpSelected, setIsTopUpSelected] = useState<boolean>(false)
  const [topUpAmount, setTopUpAmount] = useState<number>(100000)

  // Payment Channels Whitelist from Settings
  const enabledChannels = useMemo(() => {
    return billingData.gatewayInfo?.enabledChannels || ['DUITKU_VA', 'DUITKU_QRIS']
  }, [billingData.gatewayInfo?.enabledChannels])
  const isVaEnabled = enabledChannels.includes('DUITKU_VA')
  const isQrisEnabled = enabledChannels.includes('DUITKU_QRIS')

  // Checkout state
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false)
  const [paymentMethod, setPaymentMethod] = useState<'DUITKU_VA' | 'DUITKU_QRIS'>(() => {
    if (isVaEnabled) return 'DUITKU_VA'
    if (isQrisEnabled) return 'DUITKU_QRIS'
    return 'DUITKU_VA'
  })
  const [vaBank, setVaBank] = useState<string>('BR') // default BRI
  const [checkoutResult, setCheckoutResult] = useState<PortalCheckoutResponse | null>(null)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)

  // Ambil semua daftar kewajiban
  const allObligations = useMemo(() => {
    return [
      ...billingData.obligations.monthly,
      ...billingData.obligations.annual,
    ]
  }, [billingData.obligations])

  // Toggle selection kewajiban biasa
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  // Pilih semua item dalam kelompok tertentu
  const selectGroup = (items: PortalObligationItem[]) => {
    const next = new Set(selectedIds)
    const allGroupSelected = items.every(it => next.has(it.id))
    if (allGroupSelected) {
      items.forEach(it => next.delete(it.id))
    } else {
      items.forEach(it => next.add(it.id))
    }
    setSelectedIds(next)
  }

  // Pilih semua / batal pilih semua
  const selectAll = () => {
    if (selectedIds.size === allObligations.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allObligations.map(o => o.id)))
    }
  }

  // Hitung subtotal & total
  const selectedItemsSummary = useMemo(() => {
    const items: Array<{
      obligationId?: string | null
      itemType: string
      period?: string | null
      label: string
      periodLabel: string
      periodType?: 'PAST' | 'CURRENT' | 'UPCOMING'
      amount: number
    }> = []

    let countPast = 0
    let countUpcoming = 0

    for (const ob of allObligations) {
      if (selectedIds.has(ob.id)) {
        if (ob.periodType === 'PAST') countPast++
        if (ob.periodType === 'UPCOMING') countUpcoming++

        items.push({
          obligationId: ob.id,
          itemType: ob.itemType,
          period: ob.period,
          label: ob.itemLabel,
          periodLabel: ob.periodLabel,
          periodType: ob.periodType,
          amount: ob.remaining,
        })
      }
    }

    if (isUsppSelected && billingData.obligations.uspp && usppAmount > 0) {
      items.push({
        obligationId: billingData.obligations.uspp.id,
        itemType: 'USPP',
        label: 'Cicilan USPP / Bangunan',
        periodLabel: 'Sekali Masuk',
        amount: Math.min(usppAmount, billingData.obligations.uspp.remaining),
      })
    }

    if (isTopUpSelected && topUpAmount > 0) {
      items.push({
        obligationId: null,
        itemType: 'UANG_JAJAN',
        label: 'Top-Up Uang Jajan (Dana Titipan)',
        periodLabel: 'Dompet Santri',
        amount: topUpAmount,
      })
    }

    const grossAmount = items.reduce((sum, it) => sum + it.amount, 0)
    const gatewayFee = paymentMethod === 'DUITKU_VA' ? 4000 : Math.ceil(grossAmount * 0.007)
    const totalCharged = grossAmount > 0 ? grossAmount + gatewayFee : 0

    return {
      items,
      count: items.length,
      countPast,
      countUpcoming,
      grossAmount,
      gatewayFee,
      totalCharged,
    }
  }, [
    allObligations,
    selectedIds,
    isUsppSelected,
    usppAmount,
    billingData.obligations.uspp,
    isTopUpSelected,
    topUpAmount,
    paymentMethod,
  ])

  // Salin nomor VA
  const handleCopyVa = (vaText: string) => {
    navigator.clipboard.writeText(vaText)
    setCopied(true)
    toast.success('Nomor Virtual Account disalin ke clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  // Handle Checkout submission
  const handleProceedCheckout = async () => {
    if (selectedItemsSummary.count === 0) {
      toast.error('Pilih minimal satu item tagihan atau masukkan top-up uang jajan.')
      return
    }

    setIsCheckingOut(true)
    try {
      const payloadItems = selectedItemsSummary.items.map(it => ({
        obligationId: it.obligationId || null,
        itemType: it.itemType,
        period: it.period || null,
        amount: it.amount,
      }))

      const res = await createPortalCheckoutAction({
        santriId: billingData.santri.id,
        paymentMethod,
        vaBank,
        items: payloadItems,
      })

      if ('error' in res) {
        toast.error(res.error)
        return
      }

      setCheckoutResult(res)
      setIsModalOpen(true)
      setSelectedIds(new Set())
      setIsUsppSelected(false)
      setIsTopUpSelected(false)
      router.refresh()
    } catch {
      toast.error('Terjadi kesalahan koneksi saat memproses checkout.')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const pastObligations = billingData.obligations.past
  const currentObligations = billingData.obligations.current
  const upcomingObligations = billingData.obligations.upcoming
  const annualObligations = billingData.obligations.annual

  const pastAllSelected =
    pastObligations.length > 0 && pastObligations.every(it => selectedIds.has(it.id))

  return (
    <div className="space-y-4 pb-44">
      {/* 1. Header Identitas & Dompet Uang Jajan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Ringkasan Santri */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Profil Santri
          </span>
          <h2 className="portal-display mt-0.5 text-xl font-bold text-slate-900">
            {billingData.santri.nama}
          </h2>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            NIS: {billingData.santri.nis}
            {billingData.santri.asrama ? ` · Asrama ${billingData.santri.asrama}` : ''}
            {billingData.santri.kamar ? ` (Kamar ${billingData.santri.kamar})` : ''}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-600">
            <span>Katering: {billingData.santri.tempatMakan || '—'}</span>
            <span>Laundry: {billingData.santri.tempatMencuci || '—'}</span>
          </div>
        </div>

        {/* Status Dompet & Fixed VA */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Saldo Uang Jajan (Titipan)
              </span>
              <p className="portal-display text-2xl font-bold text-slate-900 font-mono">
                {formatRupiah(billingData.wallet.balance)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Limit harian: {formatRupiah(billingData.wallet.effectiveDailyLimit)}
              </p>
            </div>
            {billingData.fixedVa && (
              <button
                type="button"
                onClick={() => handleCopyVa(billingData.fixedVa!.vaNumber)}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-2xs hover:bg-emerald-100 cursor-pointer"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Tersalin' : 'Salin VA'}</span>
              </button>
            )}
          </div>
          <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
            Nomor VA santri permanen dapat disimpan di m-Banking Anda.
          </p>
        </div>
      </div>

      {/* 2. Banner Pesanan Menunggu Pembayaran (Jika Ada) */}
      {billingData.pendingOrders.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-900">
                Ada {billingData.pendingOrders.length} Pesanan Menunggu Pembayaran
              </h4>
              <p className="mt-0.5 text-xs text-amber-800">
                Pesanan #{billingData.pendingOrders[0].orderNumber} sebesar{' '}
                <strong className="font-bold">{formatRupiah(billingData.pendingOrders[0].totalCharged)}</strong>.
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const po = billingData.pendingOrders[0]
                    setCheckoutResult({
                      success: true,
                      order: {
                        id: po.id,
                        orderNumber: po.orderNumber,
                        grossAmount: po.grossAmount,
                        gatewayFee: po.gatewayFee,
                        totalCharged: po.totalCharged,
                        paymentMethod: po.paymentMethod,
                        expiresAt: po.expiresAt,
                        fixedVaNumber: billingData.fixedVa?.vaNumber || null,
                      },
                      checkout: {
                        vaNumber: billingData.fixedVa?.vaNumber || null,
                        instructions: [
                          'Selesaikan pembayaran sebelum batas waktu berakhir.',
                          'Transfer sesuai nominal yang tertera agar terverifikasi otomatis.',
                        ],
                      },
                    })
                    setIsModalOpen(true)
                  }}
                  className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 transition-colors cursor-pointer"
                >
                  Lihat Petunjuk Bayar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Filter Tab Periode Tagihan */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`shrink-0 rounded-lg px-3 py-1.5 transition cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Semua ({allObligations.length})
        </button>

        {pastObligations.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('PAST')}
            className={`shrink-0 rounded-lg px-3 py-1.5 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'PAST'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Tunggakan ({pastObligations.length})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('CURRENT')}
          className={`shrink-0 rounded-lg px-3 py-1.5 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'CURRENT'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Bulan Ini ({currentObligations.length})</span>
        </button>

        {upcomingObligations.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('UPCOMING')}
            className={`shrink-0 rounded-lg px-3 py-1.5 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'UPCOMING'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Bayar di Muka ({upcomingObligations.length})</span>
          </button>
        )}

        {annualObligations.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('ANNUAL')}
            className={`shrink-0 rounded-lg px-3 py-1.5 transition cursor-pointer ${
              activeTab === 'ANNUAL'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Tahunan ({annualObligations.length})
          </button>
        )}
      </div>

      {/* 4. SEKSI: Tunggakan Periode Sebelumnya (Jika Ada) */}
      {(activeTab === 'ALL' || activeTab === 'PAST') && pastObligations.length > 0 && (
        <div className="rounded-xl border border-rose-200/90 bg-rose-50/40 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-rose-200/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-950">
                  Tunggakan Periode Sebelumnya
                </h3>
                <p className="text-[11px] text-rose-700 font-medium">
                  Kewajiban bulan lalu yang belum diselesaikan. SPP wajib dibayar penuh per periode.
                </p>
              </div>
            </div>
            <button
              onClick={() => selectGroup(pastObligations)}
              className="text-xs font-bold text-rose-700 hover:text-rose-900 underline"
            >
              {pastAllSelected ? 'Batal Pilih' : 'Pilih Semua'}
            </button>
          </div>

          <div className="divide-y divide-rose-100">
            {pastObligations.map(ob => {
              const isChecked = selectedIds.has(ob.id)
              return (
                <label
                  key={ob.id}
                  className={`flex cursor-pointer items-center justify-between py-3 px-2.5 rounded-xl transition-colors ${
                    isChecked ? 'bg-rose-100/60' : 'hover:bg-rose-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(ob.id)}
                      className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {ob.itemLabel}
                        </p>
                        <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                          {ob.periodLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Periode: {ob.periodLabel}
                        {ob.providerName && ` · ${ob.providerName}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-rose-900">
                      {formatRupiah(ob.remaining)}
                    </p>
                    <p className="text-[10px] text-rose-600 font-semibold">Tunggakan</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* 5. SEKSI: Periode Berjalan (Bulan Ini) */}
      {(activeTab === 'ALL' || activeTab === 'CURRENT') && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">Tagihan Bulan Ini</h3>
              </div>
              <p className="text-xs text-slate-500">
                Kewajiban rutin untuk periode berjalan.
              </p>
            </div>
            {activeTab === 'ALL' && (
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                {selectedIds.size === allObligations.length ? 'Batal Semua' : 'Pilih Semua'}
              </button>
            )}
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {currentObligations.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Alhamdulillah, seluruh tagihan bulan ini sudah lunas.
              </div>
            ) : (
              currentObligations.map(ob => {
                const isChecked = selectedIds.has(ob.id)
                return (
                  <label
                    key={ob.id}
                    className={`flex cursor-pointer items-center justify-between py-2.5 px-2 rounded-lg transition-colors ${
                      isChecked ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(ob.id)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {ob.itemLabel}
                          </p>
                          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            Bulan Ini
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Periode: {ob.periodLabel}
                          {ob.providerName && ` · ${ob.providerName}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900 font-mono">
                        {formatRupiah(ob.remaining)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">Lunas penuh</p>
                    </div>
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* 6. SEKSI: Bayar di Muka (Periode Mendatang) */}
      {(activeTab === 'ALL' || activeTab === 'UPCOMING') && upcomingObligations.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Bayar di Muka (Periode Mendatang)
                </h3>
                <p className="text-xs text-slate-500">
                  Anda dapat melunasi SPP bulan mendatang lebih awal.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => selectGroup(upcomingObligations)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              {upcomingObligations.every(it => selectedIds.has(it.id)) ? 'Batal Pilih' : 'Pilih Semua'}
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {upcomingObligations.map(ob => {
              const isChecked = selectedIds.has(ob.id)
              return (
                <label
                  key={ob.id}
                  className={`flex cursor-pointer items-center justify-between py-2.5 px-2 rounded-lg transition-colors ${
                    isChecked ? 'bg-slate-100/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(ob.id)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {ob.itemLabel}
                        </p>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {ob.periodLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Periode: {ob.periodLabel}
                        {ob.providerName && ` · ${ob.providerName}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 font-mono">
                      {formatRupiah(ob.remaining)}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">Bayar di Muka</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* 7. SEKSI: Iuran Tahunan */}
      {(activeTab === 'ALL' || activeTab === 'ANNUAL') && annualObligations.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Iuran Tahunan</h3>
            <p className="text-xs text-slate-500">Evaluasi Belajar, Ekstrakurikuler, dan Kesehatan.</p>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {annualObligations.map(ob => {
              const isChecked = selectedIds.has(ob.id)
              return (
                <label
                  key={ob.id}
                  className={`flex cursor-pointer items-center justify-between py-2.5 px-2 rounded-lg transition-colors ${
                    isChecked ? 'bg-slate-100/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(ob.id)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{ob.itemLabel}</p>
                      <p className="text-xs text-slate-500">{ob.periodLabel}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 font-mono">{formatRupiah(ob.remaining)}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* 8. SEKSI: USPP / Uang Bangunan (Mendukung Cicilan Parsial) */}
      {(activeTab === 'ALL' || activeTab === 'ANNUAL') && billingData.obligations.uspp && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">USPP / Uang Bangunan</h3>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Boleh Dicicil
                </span>
              </div>
              <p className="text-xs text-slate-500">Dibayar sekali selama mondok. Bebas menentukan besar cicilan.</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-emerald-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isUsppSelected}
                onChange={e => setIsUsppSelected(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Ikutkan USPP</span>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-slate-500 font-medium">Total Beban</span>
              <p className="mt-0.5 font-bold text-slate-900 font-mono">
                {formatRupiah(billingData.obligations.uspp.amountExpected)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-slate-500 font-medium">Sudah Terbayar</span>
              <p className="mt-0.5 font-bold text-emerald-700 font-mono">
                {formatRupiah(billingData.obligations.uspp.amountPaid)}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <span className="text-slate-500 font-medium">Sisa Kewajiban</span>
              <p className="mt-0.5 font-bold text-slate-900 font-mono">
                {formatRupiah(billingData.obligations.uspp.remaining)}
              </p>
            </div>
          </div>

          {isUsppSelected && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <label className="block text-xs font-semibold text-slate-700">
                Tentukan Besar Cicilan yang Ingin Dibayar:
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={10000}
                  max={billingData.obligations.uspp.remaining}
                  step={50000}
                  value={usppAmount || ''}
                  onChange={e => setUsppAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-hidden"
                  placeholder="Contoh: 500000"
                />
                <button
                  type="button"
                  onClick={() => setUsppAmount(billingData.obligations.uspp!.remaining)}
                  className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Lunaskan Penuh
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 9. SEKSI: Top-Up Uang Jajan Online */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Top-Up Uang Jajan</h3>
              <p className="text-xs text-slate-500">Dana titipan belanja santri di koperasi.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-emerald-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isTopUpSelected}
              onChange={e => setIsTopUpSelected(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Tambah Top-Up</span>
          </label>
        </div>

        {isTopUpSelected && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[50000, 100000, 200000, 500000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTopUpAmount(val)}
                  className={`rounded-lg border py-2 text-xs font-semibold transition-all cursor-pointer ${
                    topUpAmount === val
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {formatRupiah(val)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-slate-500">Nominal Lain:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  min={10000}
                  step={10000}
                  value={topUpAmount || ''}
                  onChange={e => setTopUpAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-hidden"
                  placeholder="Nominal custom"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 10. Floating Bottom Bar Checkout Summary — Posisi aman di atas BottomNav (P0 Fix) */}
      {selectedItemsSummary.count > 0 && (
        <div className="fixed bottom-[calc(58px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-3 pb-2 transition-all portal-rise">
          <div className="rounded-2xl border border-slate-200/90 bg-white/98 p-3.5 shadow-xl backdrop-blur-md space-y-2.5">
            {/* Pilihan Metode Bayar & Rincian Periode */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium text-xs">Metode:</span>
                {isVaEnabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('DUITKU_VA')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      paymentMethod === 'DUITKU_VA'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Virtual Account
                  </button>
                )}
                {isQrisEnabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('DUITKU_QRIS')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      paymentMethod === 'DUITKU_QRIS'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    QRIS
                  </button>
                )}
                {isVaEnabled && paymentMethod === 'DUITKU_VA' && (
                  <select
                    value={vaBank}
                    onChange={e => setVaBank(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="BR">BRI</option>
                    <option value="NC">BNI</option>
                    <option value="M2">Mandiri</option>
                    <option value="BT">Permata</option>
                    <option value="BC">BCA</option>
                  </select>
                )}
              </div>

              {/* Indikator Lintas Periode */}
              {(selectedItemsSummary.countPast > 0 || selectedItemsSummary.countUpcoming > 0) && (
                <div className="flex items-center gap-1 text-[10px]">
                  {selectedItemsSummary.countPast > 0 && (
                    <span className="rounded-md bg-rose-100 text-rose-800 px-1.5 py-0.5 font-bold">
                      {selectedItemsSummary.countPast} Tunggakan
                    </span>
                  )}
                  {selectedItemsSummary.countUpcoming > 0 && (
                    <span className="rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 font-bold">
                      {selectedItemsSummary.countUpcoming} Di Muka
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium">
                  {selectedItemsSummary.count} Item Terpilih
                </p>
                <p className="text-lg font-bold text-slate-900 font-mono truncate">
                  {formatRupiah(selectedItemsSummary.grossAmount)}
                </p>
              </div>

              <button
                type="button"
                disabled={selectedItemsSummary.count === 0 || isCheckingOut}
                onClick={handleProceedCheckout}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all cursor-pointer"
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>Lanjut Bayar</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Modal Instruksi Pembayaran Duitku */}
      {isModalOpen && checkoutResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Instruksi Pembayaran</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total yang Harus Ditransfer
              </p>
              <p className="text-2xl font-black text-indigo-950">
                {formatRupiah(checkoutResult.order.totalCharged)}
              </p>
              <p className="text-[11px] text-slate-500">
                Termasuk biaya transaksi {formatRupiah(checkoutResult.order.gatewayFee)}
              </p>
            </div>

            {/* Tampilan Virtual Account */}
            {checkoutResult.checkout.vaNumber ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-center space-y-2">
                <span className="text-xs font-bold text-indigo-900">Nomor Virtual Account</span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl font-black text-indigo-950 tracking-wider">
                    {checkoutResult.checkout.vaNumber}
                  </span>
                  <button
                    onClick={() => handleCopyVa(checkoutResult.checkout.vaNumber!)}
                    className="rounded-lg bg-white p-1.5 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-2xs"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-indigo-700">
                  Berlaku sampai {new Date(checkoutResult.order.expiresAt).toLocaleString('id-ID')}
                </p>
              </div>
            ) : checkoutResult.checkout.paymentUrl ? (
              <div className="text-center py-2">
                <a
                  href={checkoutResult.checkout.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-xs hover:bg-indigo-700"
                >
                  Buka Halaman Pembayaran Duitku
                </a>
              </div>
            ) : null}

            {/* Petunjuk Transfer */}
            <div className="text-xs text-slate-600 space-y-1.5 border-t border-slate-100 pt-3">
              <p className="font-bold text-slate-800">Petunjuk Pembayaran:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-500">
                <li>Buka aplikasi m-Banking atau ATM bank pilihan Anda.</li>
                <li>Pilih menu Transfer Virtual Account / Bayar Tagihan.</li>
                <li>Masukkan nomor Virtual Account di atas.</li>
                <li>Pastikan nominal transfer sama persis dengan total tagihan.</li>
                <li>Setelah berhasil, sistem akan mengupdate status dalam 1-2 menit.</li>
              </ul>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  router.push('/portal-ortu/riwayat')
                }}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Lihat di Riwayat
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
