'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Wallet,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Building2,
} from 'lucide-react'
import { ClockCounterClockwise, CaretRight } from '@phosphor-icons/react'
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

function cleanPeriodLabel(periodLabel: string): string {
  return periodLabel.replace(/^Bulan\s+/i, '').trim()
}

function cleanItemLabel(label: string): string {
  return label.replace(/\s*\(rutin\)/i, '').replace(/\s+rutin/i, '').trim()
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
  const [topUpAmount, setTopUpAmount] = useState<number>(0)

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
      setTopUpAmount(0)
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

  const currentPeriodTitle = useMemo(() => {
    if (currentObligations.length > 0 && currentObligations[0].periodLabel) {
      return cleanPeriodLabel(currentObligations[0].periodLabel)
    }
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date())
  }, [currentObligations])

  const allActiveSelected =
    activeObligations.length > 0 && activeObligations.every(it => selectedIds.has(it.id))

  const isSelectionActive = selectedItemsSummary.count > 0

  return (
    <div className="space-y-6">
      {/* 1. TOP FEATURE SURFACE: HERO TOTAL / STATUS PEMILIHAN + BLENDED RIWAYAT BUTTON */}
      <div className="rounded-[22px] bg-[#064e3b] text-white shadow-[0_8px_24px_rgba(6,78,59,0.16)] overflow-hidden">
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#bef264]">
              {isSelectionActive ? 'Subtotal Dipilih' : 'Tagihan Dipilih'}
            </span>
            {activeObligations.length > 0 && (
              <button
                type="button"
                onClick={selectAllActive}
                className="text-xs font-bold text-white/95 hover:text-white bg-white/15 hover:bg-white/20 px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer"
              >
                {allActiveSelected ? 'Batal Semua' : 'Pilih Semua'}
              </button>
            )}
          </div>

          <div className="space-y-1">
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

        {/* Tautan Riwayat & Kuitansi: Nge-blend di bawah hero tanpa subtitle */}
        <Link
          href="/portal-ortu/riwayat"
          className="flex items-center justify-between px-5 py-3 bg-[#043d2e] hover:bg-[#033226] border-t border-emerald-800/60 text-xs font-semibold text-emerald-100 hover:text-white transition active:bg-[#03291f]"
        >
          <div className="flex items-center gap-2">
            <ClockCounterClockwise className="w-4 h-4 text-[#bef264]" weight="bold" />
            <span>Riwayat Pembayaran & Kuitansi</span>
          </div>
          <CaretRight className="w-4 h-4 text-emerald-300" />
        </Link>
      </div>

      {/* 2. SPLIT CARD: MENUNGGU PEMBAYARAN VA (NOMOR VA TIDAK BOLEH WRAPPED, CORNER BADGE SUDUT KANAN ATAS) */}
      {billingData.pendingOrders.length > 0 && (() => {
        const po = billingData.pendingOrders[0]
        const expiryLabel = formatExpiryShort(po.expiresAt)
        const vaNumber = billingData.fixedVa?.vaNumber || po.orderNumber
        const bankLabel = billingData.fixedVa?.bankCode
          ? `Virtual Account ${billingData.fixedVa.bankCode}`
          : formatPaymentMethodLabel(po.paymentMethod)

        return (
          <div className="rounded-[18px] border border-amber-200/90 dark:border-amber-900/60 overflow-hidden shadow-2xs relative">
            {/* Corner Ribbon Flush Sudut Kanan Atas */}
            <div className="absolute top-0 right-0 bg-amber-600 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-bl-xl tracking-tight shadow-xs z-10">
              Menunggu Bayar
            </div>

            <div className="bg-amber-50/90 dark:bg-amber-950/40 p-4 space-y-2">
              <div className="pr-28">
                <div className="flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-300 font-bold">
                  <span>{bankLabel}</span>
                  <span>·</span>
                  <span className="text-slate-500 dark:text-slate-400 font-normal">{expiryLabel}</span>
                </div>
              </div>

              <div>
                <p className="text-xl sm:text-2xl font-black font-mono tracking-wider text-slate-950 dark:text-slate-100 whitespace-nowrap overflow-x-auto no-scrollbar py-0.5">
                  {vaNumber}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  Total transfer tepat: <strong className="font-mono text-slate-900 dark:text-slate-100">{formatRupiah(po.totalCharged)}</strong> (termasuk biaya admin)
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border-t border-amber-200/80 dark:border-amber-900/60 px-4 py-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleCopyVa(vaNumber)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer ${
                  copied
                    ? 'bg-emerald-700 text-white'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Nomor VA Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Nomor VA</span>
                  </>
                )}
              </button>
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
                className="rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3.5 py-2 text-xs font-semibold active:scale-95 transition shrink-0 cursor-pointer"
              >
                Petunjuk
              </button>
            </div>
          </div>
        )
      })()}

      {/* 3. GROUP 1: TUNGGAKAN (Pure Red, judul simpel 'Tunggakan', item bersih 2 baris tanpa 'tunggakan periode sebelumnya') */}
      {pastObligations.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between pb-0.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-red-700 dark:text-red-400">
                Tunggakan
              </h2>
            </div>
            <span className="text-xs font-bold text-red-700 dark:text-red-400 font-mono">
              {pastObligations.length} Tagihan
            </span>
          </div>

          <div className="divide-y divide-red-100/90 dark:divide-red-950/60 rounded-[18px] bg-red-50/70 dark:bg-red-950/30 border border-red-200/90 dark:border-red-900/50 p-2 shadow-2xs">
            {pastObligations.map(ob => {
              const isChecked = selectedIds.has(ob.id)
              const periodText = cleanPeriodLabel(ob.periodLabel)
              return (
                <label
                  key={ob.id}
                  className={`flex min-h-[58px] cursor-pointer items-center justify-between py-2.5 px-3 rounded-xl transition ${
                    isChecked ? 'bg-red-100/50 dark:bg-red-900/40' : 'hover:bg-red-100/20 dark:hover:bg-red-900/20'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 pr-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(ob.id)}
                      className="mt-1 h-5 w-5 rounded-md border-red-300 dark:border-red-700 text-red-600 focus:ring-red-500 cursor-pointer shrink-0 accent-red-600"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {cleanItemLabel(ob.itemLabel)}
                      </p>
                      <p className="text-xs text-red-900 dark:text-red-300 font-medium mt-0.5 leading-snug">
                        {ob.providerName ? `${ob.providerName} · ${periodText}` : periodText}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-red-950 dark:text-red-200 font-mono">
                      {formatRupiah(ob.remaining)}
                    </p>
                    <span className="text-[10px] font-bold text-red-700 dark:text-red-400">Belum dibayar</span>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. GROUP 2: TAGIHAN BULAN INI (Judul besar, di bawahnya [Bulan] [Tahun], item bersih tanpa bulan/tahun & tanpa 'rutin') */}
      <div className="space-y-2 pt-1">
        <div className="pb-0.5">
          <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-slate-100">
            Tagihan Bulan Ini
          </h2>
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 mt-0.5">
            {currentPeriodTitle}
          </p>
        </div>

        {currentObligations.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-[18px] border border-slate-200/80 dark:border-slate-800">
            Alhamdulillah, seluruh tagihan bulan ini sudah lunas.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-[18px] border border-slate-200/80 dark:border-slate-800 px-3 shadow-2xs">
            {currentObligations.map(ob => {
              const isChecked = selectedIds.has(ob.id)
              return (
                <label
                  key={ob.id}
                  className={`flex min-h-[52px] cursor-pointer items-center justify-between py-3 px-1 rounded-xl transition ${
                    isChecked ? 'bg-emerald-50/50 dark:bg-emerald-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(ob.id)}
                      className="h-5 w-5 rounded-md border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0 accent-emerald-600"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {cleanItemLabel(ob.itemLabel)}
                      </p>
                      {ob.providerName && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {ob.providerName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {formatRupiah(ob.remaining)}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* 5. USPP (UANG BANGUNAN) */}
      {billingData.obligations.uspp && (
        <div className="space-y-2 pt-1">
          <div className="pb-0.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-slate-100">
              USPP (Uang Bangunan)
            </h2>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[18px] border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-3 shadow-2xs">
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <input
                  type="checkbox"
                  checked={isUsppSelected}
                  onChange={e => setIsUsppSelected(e.target.checked)}
                  className="h-5 w-5 rounded-md border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0 accent-emerald-600"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    Bayar sisa USPP
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Sisa kewajiban: {formatRupiah(billingData.obligations.uspp.remaining)}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                {isUsppSelected ? 'Dipilih' : 'Tambah'}
              </span>
            </label>

            {isUsppSelected && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3 space-y-2.5 border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nominal Cicilan yang Ingin Dibayar:
                  </label>
                  <button
                    type="button"
                    onClick={() => setUsppAmount(billingData.obligations.uspp!.remaining)}
                    className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 cursor-pointer"
                  >
                    Lunas Penuh ({formatRupiah(billingData.obligations.uspp!.remaining)})
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {[200000, 500000, 1000000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setUsppAmount(Math.min(val, billingData.obligations.uspp!.remaining))}
                      className={`py-1.5 text-xs font-bold font-mono rounded-lg border transition cursor-pointer active:scale-95 ${
                        usppAmount === val
                          ? 'bg-emerald-800 text-white border-emerald-800 dark:bg-emerald-600 dark:border-emerald-500'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {formatRupiah(val)}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">Rp</span>
                  <input
                    type="number"
                    min={10000}
                    max={billingData.obligations.uspp.remaining}
                    step={50000}
                    value={usppAmount || ''}
                    onChange={e => setUsppAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-emerald-600 dark:focus:border-emerald-500 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                    placeholder="Nominal custom cicilan"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. TAGIHAN TAHUNAN (JIKA ADA) */}
      {annualObligations.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="pb-0.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-slate-100">
              Tagihan Tahunan
            </h2>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-[18px] border border-slate-200/80 dark:border-slate-800 px-3 shadow-2xs">
            {annualObligations.map(ob => {
              const isChecked = selectedIds.has(ob.id)
              const periodText = cleanPeriodLabel(ob.periodLabel)
              return (
                <label
                  key={ob.id}
                  className={`flex min-h-[54px] cursor-pointer items-center justify-between py-3 px-1 rounded-xl transition ${
                    isChecked ? 'bg-slate-100/60 dark:bg-slate-800/60' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 pr-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(ob.id)}
                      className="mt-0.5 h-5 w-5 rounded-md border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0 accent-emerald-600"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">{cleanItemLabel(ob.itemLabel)}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{periodText}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">{formatRupiah(ob.remaining)}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* 7. ISI UANG JAJAN */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between pb-0.5">
          <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-slate-100">
            Isi Uang Jajan
          </h2>
          {topUpAmount > 0 && (
            <button
              type="button"
              onClick={() => {
                setTopUpAmount(0)
                setIsTopUpSelected(false)
              }}
              className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
            >
              Hapus
            </button>
          )}
        </div>

        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 dark:text-slate-500 font-mono">
            Rp
          </span>
          <input
            type="number"
            min={0}
            step={10000}
            value={topUpAmount > 0 ? topUpAmount : ''}
            onChange={e => {
              const val = Math.max(0, parseInt(e.target.value, 10) || 0)
              setTopUpAmount(val)
              setIsTopUpSelected(val > 0)
            }}
            placeholder="isi nominal"
            className="w-full pl-10 pr-4 py-2.5 text-sm font-mono font-bold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-hidden placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* 7. Ringkasan pilihan sebelum langkah review */}
      {selectedItemsSummary.count > 0 && (
        <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-3 pb-2 animate-in slide-in-from-bottom-2 duration-200">
          <div className="rounded-[22px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-2.5">
            <div className="flex items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
              <span>{selectedItemsSummary.count} item dipilih</span>
              <span className="font-bold font-mono text-slate-950 dark:text-slate-100">{formatRupiah(selectedItemsSummary.grossAmount)}</span>
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
            <h4 className="font-bold text-slate-900 dark:text-slate-100">Item yang dipilih</h4>
            <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
              {selectedItemsSummary.items.map((item, index) => (
                <div key={`${item.obligationId ?? item.itemType}-${index}`} className="flex justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{item.periodLabel}</p>
                  </div>
                  <span className="shrink-0 font-mono font-semibold text-slate-900 dark:text-slate-100">{formatRupiah(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="font-bold text-slate-900 dark:text-slate-100">Metode pembayaran</legend>
            <div className="grid grid-cols-2 gap-2">
              {isVaEnabled && (
                <button
                  type="button"
                  aria-pressed={paymentMethod === 'DUITKU_VA'}
                  onClick={() => setPaymentMethod('DUITKU_VA')}
                  className={`min-h-11 rounded-xl border px-2 text-xs font-bold transition cursor-pointer ${
                    paymentMethod === 'DUITKU_VA'
                      ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  Virtual Account
                </button>
              )}
              {isQrisEnabled && (
                <button
                  type="button"
                  aria-pressed={paymentMethod === 'DUITKU_QRIS'}
                  onClick={() => setPaymentMethod('DUITKU_QRIS')}
                  className={`min-h-11 rounded-xl border px-2 text-xs font-bold transition cursor-pointer ${
                    paymentMethod === 'DUITKU_QRIS'
                      ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  QRIS
                </button>
              )}
            </div>
            {paymentMethod === 'DUITKU_VA' && isVaEnabled && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { code: 'BR', label: 'BRI' }, { code: 'NC', label: 'BNI' },
                  { code: 'M2', label: 'Mandiri' }, { code: 'BT', label: 'Permata' },
                  { code: 'BC', label: 'BCA' },
                ].map(bank => (
                  <button
                    key={bank.code}
                    type="button"
                    aria-pressed={vaBank === bank.code}
                    onClick={() => setVaBank(bank.code)}
                    className={`min-h-11 rounded-xl border px-2 text-xs font-bold transition cursor-pointer ${
                      vaBank === bank.code
                        ? 'border-emerald-700 bg-emerald-800 text-white dark:border-emerald-500 dark:bg-emerald-600'
                        : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    {bank.label}
                  </button>
                ))}
              </div>
            )}
          </fieldset>
          <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
            <div className="flex justify-between text-slate-700 dark:text-slate-300"><span>Subtotal</span><span className="font-mono">{formatRupiah(selectedItemsSummary.grossAmount)}</span></div>
            <div className="flex justify-between text-slate-700 dark:text-slate-300"><span>Biaya admin (perkiraan)</span><span className="font-mono">{formatRupiah(selectedItemsSummary.gatewayFee)}</span></div>
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 font-bold text-slate-950 dark:text-slate-100"><span>Total dibayar</span><span className="font-mono">{formatRupiah(selectedItemsSummary.totalCharged)}</span></div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Nominal final dikonfirmasi oleh server sebelum instruksi pembayaran diterbitkan.</p>
          </div>
        </div>
      </BottomSheet>

      {/* 8. MODAL INSTRUKSI PEMBAYARAN DUITKU */}
      <BottomSheet
        open={Boolean(isModalOpen && checkoutResult)}
        onClose={() => setIsModalOpen(false)}
        title="Petunjuk Pembayaran"
        subtitle="Menunggu pembayaran — selesaikan sesuai instruksi di bawah"
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false)
                router.push('/portal-ortu/riwayat')
              }}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer active:scale-95 transition"
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
            <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 p-4 border border-slate-200/80 dark:border-slate-700 text-center space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total yang Harus Ditransfer
              </p>
              <p className="text-2xl font-black text-slate-950 dark:text-slate-100 font-mono tracking-tight">
                {formatRupiah(checkoutResult.order.totalCharged)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Termasuk biaya admin {formatRupiah(checkoutResult.order.gatewayFee)}
              </p>
            </div>

            {/* Virtual Account / Payment Link */}
            {checkoutResult.checkout.vaNumber ? (
              <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/40 p-4 text-center space-y-2">
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">Nomor Virtual Account</span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-100 tracking-wider whitespace-nowrap overflow-x-auto no-scrollbar py-0.5">
                    {checkoutResult.checkout.vaNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyVa(checkoutResult.checkout.vaNumber!)}
                    className="rounded-lg bg-white dark:bg-slate-800 p-1.5 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700 shadow-2xs cursor-pointer active:scale-95 transition"
                    aria-label="Salin nomor Virtual Account"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
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
                  className="inline-flex items-center justify-center w-full min-h-[44px] rounded-xl bg-[#064e3b] hover:bg-[#047857] py-3 text-xs font-bold text-[#bef264] shadow-xs active:scale-[0.98] transition"
                >
                  Buka Halaman Pembayaran Duitku
                </a>
              </div>
            ) : null}

            {/* Petunjuk Pembayaran */}
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3.5">
              <p className="font-bold text-slate-900 dark:text-slate-200">Langkah Pembayaran:</p>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-600 dark:text-slate-400 leading-relaxed">
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
