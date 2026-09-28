'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Wallet,
  Copy,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Building2,
} from 'lucide-react'
import type {
  PortalStudentBillingData,
  PortalCheckoutResponse,
} from '@/lib/portal/finance'
import { createPortalCheckoutAction } from './actions'
import { BottomSheet } from '../../_components/bottom-sheet'

function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Rp0'
  return `Rp${Math.round(amount).toLocaleString('id-ID')}`
}

function formatExpiryShort(isoString: string): string {
  try {
    const d = new Date(isoString)
    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    return `Batas ${timeStr} WIB`
  } catch {
    return 'Batas pembayaran aktif'
  }
}

function formatPaymentMethodLabel(method: string | null): string {
  if (method === 'DUITKU_VA') return 'Virtual Account'
  if (method === 'DUITKU_QRIS') return 'QRIS'
  return method || 'Pembayaran Online'
}

interface TagihanClientProps {
  billingData: PortalStudentBillingData
}

export function TagihanClient({ billingData }: TagihanClientProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Default kosong agar orang tua secara sadar memilih tagihan yang ingin dibayar,
    // atau menggunakan tombol 'Pilih Semua' untuk mencentang seluruh tagihan sekaligus.
    return new Set<string>()
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
  const [isReviewOpen, setIsReviewOpen] = useState(false)
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
    const configuredFee = paymentMethod === 'DUITKU_VA'
      ? (billingData.gatewayInfo?.defaultVaFee ?? 4000)
      : Math.ceil(grossAmount * ((billingData.gatewayInfo?.defaultQrisFeePercent ?? 0.7) / 100))
    const gatewayFee = billingData.gatewayInfo?.feePayer === 'INSTITUTION' ? 0 : configuredFee
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
    billingData.gatewayInfo,
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
      setIsReviewOpen(false)
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
              {isSelectionActive ? 'Subtotal Dipilih' : 'Tagihan Dipilih'}
            </span>
            {activeObligations.length > 0 && (
              <button
                type="button"
                onClick={selectAllActive}
                className="min-h-11 text-xs font-bold text-white/90 hover:text-white bg-white/15 hover:bg-white/20 px-3 rounded-lg transition active:scale-95 cursor-pointer"
              >
                {allActiveSelected ? 'Batal Semua' : 'Pilih Semua'}
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-3xl font-black font-mono tracking-tight text-white">
              {formatRupiah(selectedItemsSummary.grossAmount)}
            </p>
            <div className="flex items-center justify-between text-xs text-emerald-100/80 font-medium">
              <span>
                {isSelectionActive
                  ? `${selectedItemsSummary.count} item dipilih untuk dibayar`
                  : (billingData.obligations.totalRemaining > 0 || (billingData.obligations.uspp && billingData.obligations.uspp.remaining > 0))
                  ? 'Belum ada tagihan yang dipilih'
                  : 'Alhamdulillah, seluruh tagihan telah lunas'}
              </span>
              {billingData.obligations.totalRemaining > 0 && (
                <span className="text-emerald-200/90 text-[11px] font-semibold">
                  Tagihan rutin: {formatRupiah(billingData.obligations.totalRemaining)}
                </span>
              )}
            </div>

            {billingData.obligations.uspp && billingData.obligations.uspp.remaining > 0 && (
              <div className="pt-2 mt-0.5 border-t border-white/15 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-emerald-100 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-[#bef264]" />
                  <span>Sisa USPP (Uang Bangunan):</span>
                </div>
                <span className="font-mono font-bold text-white tracking-tight">
                  {formatRupiah(billingData.obligations.uspp.remaining)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. COMPACT STACKED PENDING PAYMENT SURFACE (Jika Ada) */}
      {billingData.pendingOrders.length > 0 && (() => {
        const po = billingData.pendingOrders[0]
        const expiryLabel = formatExpiryShort(po.expiresAt)
        const methodLabel = formatPaymentMethodLabel(po.paymentMethod)

        return (
          <div className="rounded-[22px] bg-amber-50/90 p-4 border border-amber-200/80 shadow-2xs space-y-3">
            {/* Baris 1: Status & Expiry */}
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 px-2.5 py-0.5 text-xs font-bold text-amber-950 shrink-0 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>Menunggu Pembayaran</span>
              </span>
              <span className="text-[11px] font-semibold text-amber-800 shrink-0 whitespace-nowrap">
                {expiryLabel}
              </span>
            </div>

            {/* Baris 2: Nominal & Metode */}
            <div className="space-y-0.5">
              <p className="text-2xl font-black font-mono tracking-tight text-amber-950">
                {formatRupiah(po.totalCharged)}
              </p>
              <p className="text-xs text-amber-800 font-medium">
                {methodLabel}
              </p>
            </div>

            {/* Baris 3: Primary Action Full Width */}
            <button
              type="button"
              onClick={() => {
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
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-800 hover:bg-amber-900 py-2.5 px-4 text-xs font-bold text-white transition active:scale-[0.98] cursor-pointer shadow-xs"
            >
              <span>Lihat Petunjuk Pembayaran</span>
            </button>
          </div>
        )
      })()}

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
          <div className="py-4 text-center text-xs text-slate-600">
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

      {/* 7. Ringkasan pilihan sebelum langkah review */}
      {selectedItemsSummary.count > 0 && (
        <div className="fixed bottom-[calc(60px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-3 pb-2 animate-in slide-in-from-bottom-2 duration-200">
          <div className="rounded-[22px] bg-white/95 backdrop-blur-md border border-slate-200/80 p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.14)] space-y-2.5">
            <div className="flex items-center justify-between gap-3 text-xs text-slate-700">
              <span>{selectedItemsSummary.count} item dipilih</span>
              <span className="font-bold font-mono text-slate-950">{formatRupiah(selectedItemsSummary.grossAmount)}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsReviewOpen(true)}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] py-3 text-sm font-bold text-[#bef264] shadow-xs active:scale-[0.98] transition cursor-pointer"
            >
              Tinjau pembayaran
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <BottomSheet
        open={isReviewOpen}
        onClose={() => { if (!isCheckingOut) setIsReviewOpen(false) }}
        title="Tinjau pembayaran"
        subtitle="Periksa item dan total sebelum membuat pembayaran"
        footer={
          <button
            type="button"
            disabled={isCheckingOut || (!isVaEnabled && !isQrisEnabled)}
            onClick={handleProceedCheckout}
            className="w-full min-h-12 rounded-xl bg-[#064e3b] px-4 py-3 text-sm font-bold text-[#bef264] disabled:opacity-50"
          >
            {isCheckingOut ? 'Membuat pembayaran…' : `Buat pembayaran ${formatRupiah(selectedItemsSummary.totalCharged)}`}
          </button>
        }
      >
        <div className="space-y-5 text-sm">
          <div>
            <h4 className="font-bold text-slate-900">Item yang dipilih</h4>
            <div className="mt-2 divide-y divide-slate-100 border-y border-slate-200">
              {selectedItemsSummary.items.map((item, index) => (
                <div key={`${item.obligationId ?? item.itemType}-${index}`} className="flex justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-600">{item.periodLabel}</p>
                  </div>
                  <span className="shrink-0 font-mono font-semibold text-slate-900">{formatRupiah(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="font-bold text-slate-900">Metode pembayaran</legend>
            <div className="grid grid-cols-2 gap-2">
              {isVaEnabled && <button type="button" aria-pressed={paymentMethod === 'DUITKU_VA'} onClick={() => setPaymentMethod('DUITKU_VA')} className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${paymentMethod === 'DUITKU_VA' ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-300 text-slate-700'}`}>Virtual Account</button>}
              {isQrisEnabled && <button type="button" aria-pressed={paymentMethod === 'DUITKU_QRIS'} onClick={() => setPaymentMethod('DUITKU_QRIS')} className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${paymentMethod === 'DUITKU_QRIS' ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-300 text-slate-700'}`}>QRIS</button>}
            </div>
            {paymentMethod === 'DUITKU_VA' && isVaEnabled && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { code: 'BR', label: 'BRI' }, { code: 'NC', label: 'BNI' },
                  { code: 'M2', label: 'Mandiri' }, { code: 'BT', label: 'Permata' },
                  { code: 'BC', label: 'BCA' },
                ].map(bank => <button key={bank.code} type="button" aria-pressed={vaBank === bank.code} onClick={() => setVaBank(bank.code)} className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${vaBank === bank.code ? 'border-emerald-700 bg-emerald-800 text-white' : 'border-slate-300 text-slate-700'}`}>{bank.label}</button>)}
              </div>
            )}
          </fieldset>
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="flex justify-between text-slate-700"><span>Subtotal</span><span className="font-mono">{formatRupiah(selectedItemsSummary.grossAmount)}</span></div>
            <div className="flex justify-between text-slate-700"><span>Biaya admin (perkiraan)</span><span className="font-mono">{formatRupiah(selectedItemsSummary.gatewayFee)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-950"><span>Total dibayar</span><span className="font-mono">{formatRupiah(selectedItemsSummary.totalCharged)}</span></div>
            <p className="text-xs text-slate-600">Nominal final dikonfirmasi oleh server sebelum instruksi pembayaran diterbitkan.</p>
          </div>
        </div>
      </BottomSheet>

      {/* 8. MODAL INSTRUKSI PEMBAYARAN DUITKU */}
      <BottomSheet
        open={Boolean(isModalOpen && checkoutResult)}
        onClose={() => setIsModalOpen(false)}
        title="Petunjuk Pembayaran"
        subtitle="Menunggu pembayaran — selesaikan sesuai instruksi di bawah"
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false)
                router.push('/portal-ortu/riwayat')
              }}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer active:scale-95 transition"
            >
              Lihat di Riwayat
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 min-h-[44px] rounded-xl bg-[#064e3b] hover:bg-[#047857] py-2.5 px-3 text-xs font-bold text-[#bef264] shadow-xs cursor-pointer active:scale-95 transition"
            >
              Tutup petunjuk
            </button>
          </>
        }
      >
        {checkoutResult && (
          <div className="space-y-4">
            {/* Kartu Total Transfer */}
            <div className="rounded-2xl bg-slate-50/90 p-4 border border-slate-200/80 text-center space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total yang Harus Ditransfer
              </p>
              <p className="text-2xl font-black text-slate-950 font-mono tracking-tight">
                {formatRupiah(checkoutResult.order.totalCharged)}
              </p>
              <p className="text-[11px] text-slate-500">
                Termasuk biaya admin {formatRupiah(checkoutResult.order.gatewayFee)}
              </p>
            </div>

            {/* Virtual Account / Payment Link */}
            {checkoutResult.checkout.vaNumber ? (
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-center space-y-2">
                <span className="text-xs font-bold text-emerald-950">Nomor Virtual Account</span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl font-black text-emerald-950 tracking-wider">
                    {checkoutResult.checkout.vaNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyVa(checkoutResult.checkout.vaNumber!)}
                    className="rounded-lg bg-white p-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 shadow-2xs cursor-pointer active:scale-95 transition"
                    aria-label="Salin nomor Virtual Account"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-800 font-medium">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Berlaku 24 jam (sampai {new Date(checkoutResult.order.expiresAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)
                  </span>
                </div>
              </div>
            ) : checkoutResult.checkout.paymentUrl ? (
              <div className="text-center py-1">
                <a
                  href={checkoutResult.checkout.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full min-h-[44px] rounded-xl bg-[#064e3b] py-3 text-xs font-bold text-[#bef264] shadow-xs hover:bg-[#047857] active:scale-[0.98] transition"
                >
                  Buka Halaman Pembayaran Duitku
                </a>
              </div>
            ) : null}

            {/* Petunjuk Pembayaran */}
            <div className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3.5">
              <p className="font-bold text-slate-900">Langkah Pembayaran:</p>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-600 leading-relaxed">
                <li>Buka aplikasi m-Banking atau ATM bank Anda.</li>
                <li>Pilih menu Transfer Virtual Account / Bayar Tagihan.</li>
                <li>Masukkan nomor Virtual Account di atas.</li>
                <li>Pastikan nominal transfer sama persis dengan total tagihan.</li>
                <li>Status pembayaran akan terupdate otomatis dalam 1-2 menit.</li>
              </ul>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
