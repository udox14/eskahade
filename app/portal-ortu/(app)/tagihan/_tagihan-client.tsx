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
  AlertCircle,
  Building2,
} from 'lucide-react'
import type {
  PortalStudentBillingData,
  PortalCheckoutResponse,
} from '@/lib/portal/finance'
import { createPortalCheckoutAction } from './actions'

function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Rp0'
  return `Rp${Math.round(amount).toLocaleString('id-ID')}`
}

interface TagihanClientProps {
  billingData: PortalStudentBillingData
}

export function TagihanClient({ billingData }: TagihanClientProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Default: pilih seluruh tagihan yang perlu segera dibayar (tunggakan) dan bulan ini
    const initial = new Set<string>()
    billingData.obligations.past.forEach(ob => initial.add(ob.id))
    billingData.obligations.current.forEach(ob => initial.add(ob.id))
    return initial
  })

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

  // Daftar seluruh kewajiban standar yang aktif (past, current, annual)
  // CATATAN: upcoming/bayar di muka sengaja TIDAK diikutkan di portal ortu sesuai aturan.
  const activeObligations = useMemo(() => {
    return [
      ...billingData.obligations.past,
      ...billingData.obligations.current,
      ...billingData.obligations.annual,
    ]
  }, [billingData.obligations])

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const selectAllActive = () => {
    const allSelected = activeObligations.every(ob => selectedIds.has(ob.id))
    const next = new Set(selectedIds)
    if (allSelected) {
      activeObligations.forEach(ob => next.delete(ob.id))
    } else {
      activeObligations.forEach(ob => next.add(ob.id))
    }
    setSelectedIds(next)
  }

  // Hitung subtotal & total
  const selectedItemsSummary = useMemo(() => {
    const items: Array<{
      obligationId?: string | null
      itemType: string
      period?: string | null
      label: string
      periodLabel: string
      amount: number
    }> = []

    for (const ob of activeObligations) {
      if (selectedIds.has(ob.id)) {
        items.push({
          obligationId: ob.id,
          itemType: ob.itemType,
          period: ob.period,
          label: ob.itemLabel,
          periodLabel: ob.periodLabel,
          amount: ob.remaining,
        })
      }
    }

    if (isUsppSelected && billingData.obligations.uspp && usppAmount > 0) {
      items.push({
        obligationId: billingData.obligations.uspp.id,
        itemType: 'USPP',
        label: 'Cicilan USPP / Uang Bangunan',
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
      grossAmount,
      gatewayFee,
      totalCharged,
    }
  }, [
    activeObligations,
    selectedIds,
    isUsppSelected,
    usppAmount,
    billingData.obligations.uspp,
    isTopUpSelected,
    topUpAmount,
    paymentMethod,
  ])

  const handleCopyVa = (vaText: string) => {
    navigator.clipboard.writeText(vaText)
    setCopied(true)
    toast.success('Nomor Virtual Account disalin!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProceedCheckout = async () => {
    if (selectedItemsSummary.count === 0) {
      toast.error('Pilih minimal satu tagihan untuk melanjutkan.')
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
  const annualObligations = billingData.obligations.annual

  const allActiveSelected =
    activeObligations.length > 0 && activeObligations.every(it => selectedIds.has(it.id))

  const isSelectionActive = selectedItemsSummary.count > 0

  return (
    <div className="space-y-6">
      {/* 1. TOP FEATURE SURFACE: HERO TOTAL / STATUS PEMILIHAN (Color-Blocked Surface) */}
      <div className="rounded-[22px] bg-[#064e3b] p-5 text-white shadow-[0_8px_24px_rgba(6,78,59,0.16)] relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-emerald-500/15 blur-xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#bef264]">
              {isSelectionActive ? 'Total Dipilih' : 'Yang Perlu Dibayar'}
            </span>
            {activeObligations.length > 0 && (
              <button
                type="button"
                onClick={selectAllActive}
                className="text-xs font-bold text-white/90 hover:text-white bg-white/15 hover:bg-white/20 px-2.5 py-1 rounded-lg transition active:scale-95 cursor-pointer"
              >
                {allActiveSelected ? 'Batal Semua' : 'Pilih Semua'}
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            <p className="text-3xl font-black font-mono tracking-tight text-white">
              {formatRupiah(isSelectionActive ? selectedItemsSummary.totalCharged : billingData.obligations.totalRemaining)}
            </p>
            <p className="text-xs text-emerald-100/80 font-medium">
              {isSelectionActive
                ? `${selectedItemsSummary.count} item dipilih untuk dibayar`
                : billingData.obligations.totalRemaining > 0
                ? `${activeObligations.length} tagihan aktif menunggu penyelesaian`
                : 'Alhamdulillah, seluruh tagihan telah lunas'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. BANNER PESANAN MENUNGGU PEMBAYARAN (Jika Ada) */}
      {billingData.pendingOrders.length > 0 && (
        <div className="rounded-[20px] bg-amber-500/10 p-4 border border-amber-500/20 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Pesanan Menunggu Pembayaran</span>
              </div>
              <p className="text-base font-black font-mono text-amber-950">
                {formatRupiah(billingData.pendingOrders[0].totalCharged)}
              </p>
              <p className="text-[11px] text-amber-800 truncate">
                No. Pesanan: #{billingData.pendingOrders[0].orderNumber}
              </p>
            </div>
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
              className="shrink-0 rounded-xl bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800 transition active:scale-95 cursor-pointer shadow-xs"
            >
              Lihat Petunjuk Bayar
            </button>
          </div>
        </div>
      )}

      {/* 3. GROUP 1: PERLU SEGERA DIBAYAR (Tunggakan Periode Sebelumnya) */}
      {pastObligations.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 pb-1">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-rose-950">
                Perlu Segera Dibayar
              </h2>
              <p className="text-[11px] text-rose-700">
                Kewajiban periode sebelumnya yang belum diselesaikan.
              </p>
            </div>
          </div>

          <div className="divide-y divide-rose-100/80 rounded-2xl bg-rose-50/50 p-2">
            {pastObligations.map(ob => {
              const isChecked = selectedIds.has(ob.id)
              return (
                <label
                  key={ob.id}
                  className={`flex min-h-[54px] cursor-pointer items-center justify-between py-3 px-3 rounded-xl transition active:bg-rose-100/60 ${
                    isChecked ? 'bg-rose-100/50' : 'hover:bg-rose-100/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(ob.id)}
                      className="h-5 w-5 rounded-md border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {ob.itemLabel}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {ob.periodLabel}
                        {ob.providerName && ` · ${ob.providerName}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-rose-900 font-mono">
                      {formatRupiah(ob.remaining)}
                    </p>
                    <span className="text-[10px] font-bold text-rose-700">Belum dibayar</span>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. GROUP 2: BULAN INI (FLAT LIST, Tanpa Outer Card Pembungkus) */}
      <div className="space-y-2 pt-1">
        <div className="pb-1">
          <h2 className="text-sm font-bold text-slate-900">
            Bulan ini
          </h2>
          <p className="text-xs text-slate-500">
            Kewajiban rutin untuk periode berjalan.
          </p>
        </div>

        {currentObligations.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400">
            Alhamdulillah, seluruh tagihan bulan ini sudah lunas.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {currentObligations.map(ob => {
              const isChecked = selectedIds.has(ob.id)
              return (
                <label
                  key={ob.id}
                  className={`flex min-h-[54px] cursor-pointer items-center justify-between py-3 px-2 rounded-xl transition active:bg-slate-100 ${
                    isChecked ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(ob.id)}
                      className="h-5 w-5 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {ob.itemLabel}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {ob.periodLabel}
                        {ob.providerName && ` · ${ob.providerName}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 font-mono">
                      {formatRupiah(ob.remaining)}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* 5. GROUP 3: TAGIHAN LAINNYA (Iuran Tahunan & USPP) */}
      {(annualObligations.length > 0 || billingData.obligations.uspp) && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="pb-1">
            <h2 className="text-sm font-bold text-slate-900">
              Tagihan lainnya
            </h2>
            <p className="text-xs text-slate-500">
              Iuran tahunan dan dana pembangunan pesantren.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {/* Iuran Tahunan */}
            {annualObligations.map(ob => {
              const isChecked = selectedIds.has(ob.id)
              return (
                <label
                  key={ob.id}
                  className={`flex min-h-[54px] cursor-pointer items-center justify-between py-3 px-2 rounded-xl transition active:bg-slate-100 ${
                    isChecked ? 'bg-slate-100/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(ob.id)}
                      className="h-5 w-5 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{ob.itemLabel}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{ob.periodLabel}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 font-mono">{formatRupiah(ob.remaining)}</p>
                  </div>
                </label>
              )
            })}

            {/* USPP / Uang Bangunan */}
            {billingData.obligations.uspp && (
              <div className="py-3 px-2 space-y-3">
                <label className="flex min-h-[44px] cursor-pointer items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <input
                      type="checkbox"
                      checked={isUsppSelected}
                      onChange={e => setIsUsppSelected(e.target.checked)}
                      className="h-5 w-5 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        <p className="text-sm font-bold text-slate-900 truncate">Cicilan USPP / Uang Bangunan</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        Sisa kewajiban: {formatRupiah(billingData.obligations.uspp.remaining)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 shrink-0">
                    {isUsppSelected ? 'Dipilih' : 'Ikutkan'}
                  </span>
                </label>

                {isUsppSelected && (
                  <div className="rounded-2xl bg-slate-50 p-3 space-y-2 border border-slate-100">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nominal Cicilan yang Ingin Dibayar:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={10000}
                        max={billingData.obligations.uspp.remaining}
                        step={50000}
                        value={usppAmount || ''}
                        onChange={e => setUsppAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold font-mono text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-hidden"
                        placeholder="Besar cicilan"
                      />
                      <button
                        type="button"
                        onClick={() => setUsppAmount(billingData.obligations.uspp!.remaining)}
                        className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer active:scale-95 transition"
                      >
                        Lunas Penuh
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. GROUP 4: TOP-UP UANG JAJAN (DANA TITIPAN) */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <label className="flex min-h-[44px] cursor-pointer items-center justify-between px-2 py-1">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isTopUpSelected}
              onChange={e => setIsTopUpSelected(e.target.checked)}
              className="h-5 w-5 rounded-md border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer shrink-0"
            />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Tambah Top-Up Uang Jajan</p>
                <p className="text-xs text-slate-500">Saldo titipan belanja santri di loket.</p>
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-cyan-800">
            {isTopUpSelected ? 'Dipilih' : 'Tambah'}
          </span>
        </label>

        {isTopUpSelected && (
          <div className="space-y-2.5 rounded-2xl bg-cyan-50/50 p-3.5 border border-cyan-100">
            <div className="grid grid-cols-4 gap-2">
              {[50000, 100000, 200000, 500000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTopUpAmount(val)}
                  className={`rounded-xl py-2 text-xs font-bold font-mono transition active:scale-95 cursor-pointer ${
                    topUpAmount === val
                      ? 'bg-cyan-700 text-white shadow-xs'
                      : 'bg-white border border-cyan-200/80 text-cyan-900 hover:bg-cyan-100/50'
                  }`}
                >
                  {formatRupiah(val)}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={10000}
              step={10000}
              value={topUpAmount || ''}
              onChange={e => setTopUpAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold font-mono text-slate-900 shadow-2xs focus:border-cyan-500 focus:outline-hidden"
              placeholder="Nominal custom lainnya"
            />
          </div>
        )}
      </div>

      {/* 7. STICKY PAYMENT CTA BAR (Hasil Eksplisit & Native Touch Target) */}
      <div className="fixed bottom-[calc(60px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-3 pb-2">
        <div className="rounded-[22px] bg-white/95 backdrop-blur-lg border border-slate-200/70 p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] space-y-2.5">
          {/* Pemilih Metode Pembayaran */}
          <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Metode:</span>
              {isVaEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod('DUITKU_VA')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer active:scale-95 ${
                    paymentMethod === 'DUITKU_VA'
                      ? 'bg-[#064e3b] text-white shadow-2xs'
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer active:scale-95 ${
                    paymentMethod === 'DUITKU_QRIS'
                      ? 'bg-[#064e3b] text-white shadow-2xs'
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
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700 outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  <option value="BR">BRI</option>
                  <option value="NC">BNI</option>
                  <option value="M2">Mandiri</option>
                  <option value="BT">Permata</option>
                  <option value="BC">BCA</option>
                </select>
              )}
            </div>

            <span className="text-[11px] font-semibold text-slate-500">
              {selectedItemsSummary.count} item dipilih
            </span>
          </div>

          {/* Primary Payment CTA Button */}
          <button
            type="button"
            disabled={selectedItemsSummary.count === 0 || isCheckingOut}
            onClick={handleProceedCheckout}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] py-3 text-sm font-bold text-[#bef264] shadow-xs active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isCheckingOut ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#bef264]" />
                <span>Memproses Pembayaran…</span>
              </>
            ) : selectedItemsSummary.count > 0 ? (
              <>
                <span>Bayar {formatRupiah(selectedItemsSummary.totalCharged)}</span>
                <ArrowRight className="h-4 w-4 text-[#bef264]" />
              </>
            ) : (
              <span>Pilih Tagihan Terlebih Dahulu</span>
            )}
          </button>
        </div>
      </div>

      {/* 8. MODAL INSTRUKSI PEMBAYARAN DUITKU */}
      {isModalOpen && checkoutResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[22px] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Petunjuk Pembayaran</h3>
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
              <p className="text-2xl font-black text-slate-900 font-mono">
                {formatRupiah(checkoutResult.order.totalCharged)}
              </p>
              <p className="text-[11px] text-slate-500">
                Termasuk biaya admin {formatRupiah(checkoutResult.order.gatewayFee)}
              </p>
            </div>

            {/* Virtual Account / Payment Link */}
            {checkoutResult.checkout.vaNumber ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-center space-y-2">
                <span className="text-xs font-bold text-emerald-900">Nomor Virtual Account</span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl font-black text-emerald-950 tracking-wider">
                    {checkoutResult.checkout.vaNumber}
                  </span>
                  <button
                    onClick={() => handleCopyVa(checkoutResult.checkout.vaNumber!)}
                    className="rounded-lg bg-white p-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-2xs cursor-pointer active:scale-95 transition"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Berlaku 24 jam (sampai {new Date(checkoutResult.order.expiresAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)
                </p>
              </div>
            ) : checkoutResult.checkout.paymentUrl ? (
              <div className="text-center py-2">
                <a
                  href={checkoutResult.checkout.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full rounded-xl bg-[#064e3b] py-3 text-sm font-bold text-[#bef264] shadow-xs hover:bg-[#047857]"
                >
                  Buka Halaman Pembayaran Duitku
                </a>
              </div>
            ) : null}

            {/* Petunjuk Pembayaran */}
            <div className="text-xs text-slate-600 space-y-1 border-t border-slate-100 pt-3">
              <p className="font-bold text-slate-800">Langkah Pembayaran:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-500">
                <li>Buka aplikasi m-Banking atau ATM bank Anda.</li>
                <li>Pilih menu Transfer Virtual Account / Bayar Tagihan.</li>
                <li>Masukkan nomor Virtual Account di atas.</li>
                <li>Pastikan nominal transfer sama persis dengan total tagihan.</li>
                <li>Status pembayaran akan terupdate otomatis dalam 1-2 menit.</li>
              </ul>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  router.push('/portal-ortu/riwayat')
                }}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer active:scale-95 transition"
              >
                Lihat di Riwayat
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer active:scale-95 transition"
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
