'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Wallet, Plus, Copy, Check, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { formatPortalTimeWib, formatRupiah, formatThousands, parseRupiahDigits } from '@/lib/portal/format'
import { BottomSheet } from '../../_components/bottom-sheet'
import { WalletLimitCard } from '../akun/_wallet-limit-card'
import { createPortalCheckoutAction } from '../tagihan/actions'
import { TransferSheet } from '../tagihan/_transfer-panel'
import type { PortalCheckoutResponse, PortalStudentBillingData, PortalTransferSummary } from '@/lib/portal/finance'

interface ParentLimits {
  parentDailyLimit: number | null
  parentWeeklyLimit: number | null
  parentMonthlyLimit: number | null
  globalDailyLimit: number
}

interface BerandaWalletCardProps {
  santriId: string
  balance: number
  effectiveDailyLimit: number
  parentLimits: ParentLimits
  gatewayInfo?: PortalStudentBillingData['gatewayInfo'] | null
  fixedVa?: PortalStudentBillingData['fixedVa'] | null
  paymentChannels?: PortalStudentBillingData['paymentChannels'] | null
  transferInReview?: boolean
}

export function BerandaWalletCard({
  santriId,
  balance,
  effectiveDailyLimit,
  parentLimits,
  gatewayInfo,
  fixedVa,
  paymentChannels,
  transferInReview = false,
}: BerandaWalletCardProps) {
  const router = useRouter()

  // Drawer states
  const [isLimitOpen, setIsLimitOpen] = useState(false)
  const [isTopUpOpen, setIsTopUpOpen] = useState(false)

  // Top Up form states
  const [topUpAmount, setTopUpAmount] = useState<number>(100000)
  const availableMethods = [
    ...(paymentChannels?.transfer.available ? ['MANUAL_TRANSFER' as const] : []),
    ...(paymentChannels?.briva.available ? ['BRI_VA' as const] : []),
  ]
  const [chosenMethod, setChosenMethod] = useState<'BRI_VA' | 'MANUAL_TRANSFER' | null>(null)
  const paymentMethod = chosenMethod && availableMethods.includes(chosenMethod) ? chosenMethod : availableMethods[0] ?? null
  const accounts = paymentChannels?.transfer.accounts ?? []
  const [accountId, setAccountId] = useState<string | null>(null)
  const destinationAccountId = accountId && accounts.some(a => a.id === accountId) ? accountId : accounts[0]?.id ?? null
  const [deductFee, setDeductFee] = useState(false)
  const [transferSheet, setTransferSheet] = useState<PortalTransferSummary | null>(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<PortalCheckoutResponse | null>(null)
  const [copied, setCopied] = useState(false)

  // Fee calculation
  const isTransfer = paymentMethod === 'MANUAL_TRANSFER'
  const cooperativeFee = isTransfer ? paymentChannels?.transfer.fee ?? 0 : paymentChannels?.briva.fee ?? gatewayInfo?.defaultVaFee ?? 0
  const canDeduct = isTransfer && !!paymentChannels?.transfer.feeDeductEnabled && cooperativeFee > 0 && topUpAmount > cooperativeFee
  const deducting = canDeduct && deductFee
  const totalCharged = topUpAmount > 0 ? (deducting ? topUpAmount : topUpAmount + cooperativeFee) : 0

  const uniqueCodeMax = paymentChannels?.transfer.uniqueCodeMax ?? 999

  const handleCopyVa = (vaText: string) => {
    navigator.clipboard.writeText(vaText).then(() => {
      setCopied(true)
      toast.success('Nomor Virtual Account disalin!')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      toast.error('Gagal menyalin. Silakan salin manual.')
    })
  }

  const handleProceedTopUp = async () => {
    if (topUpAmount < 10000) {
      toast.error('Nominal top-up minimal Rp10.000.')
      return
    }

    setIsCheckingOut(true)
    try {
      if (!paymentMethod) {
        toast.error('Belum ada cara pembayaran online yang tersedia.')
        return
      }
      const res = await createPortalCheckoutAction({
        santriId,
        paymentMethod,
        feeMode: deducting ? 'DEDUCT' : 'ADD',
        destinationAccountId: isTransfer ? destinationAccountId || undefined : undefined,
        items: [
          {
            obligationId: null,
            itemType: 'UANG_JAJAN',
            period: null,
            amount: topUpAmount,
          },
        ],
      })

      if ('error' in res) {
        toast.error(res.error)
        return
      }

      if (isTransfer) {
        setIsTopUpOpen(false)
        setTopUpAmount(100000)
        setTransferSheet(res.checkout.transfer || null)
      } else {
        setCheckoutResult(res)
      }
      router.refresh()
    } catch {
      toast.error('Terjadi kesalahan koneksi saat memproses checkout.')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const handleCloseTopUpDrawer = () => {
    if (isCheckingOut) return
    setIsTopUpOpen(false)
    setCheckoutResult(null)
    setTopUpAmount(100000)
  }

  return (
    <>
      {/* 1. HERO UTAMA: SALDO UANG JAJAN SANTRI */}
      <div className="rounded-[22px] bg-gradient-to-br from-[#065f46] to-[#064e3b] text-white shadow-[0_8px_24px_rgba(6,78,59,0.16)] relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5" />
        <div aria-hidden className="pointer-events-none absolute -right-2 top-14 h-20 w-20 rounded-full bg-white/[0.04]" />

        <div className="relative z-10 p-5 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
              <Wallet className="h-4 w-4 text-[#bef264]" />
            </span>
            <span className="text-sm font-semibold text-emerald-50">Uang Jajan</span>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-emerald-200/80">Saldo tersedia</p>
            <p className="mt-0.5 text-4xl font-black font-mono tracking-tight text-white">
              {formatRupiah(balance)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsTopUpOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#bef264] px-4 py-3 text-sm font-bold text-[#064e3b] shadow-xs hover:bg-[#a3e635] active:scale-[0.99] transition cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
            <span>Isi Saldo</span>
          </button>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-3 border-t border-white/10 bg-black/10 px-5 py-3">
          <p className="text-xs text-emerald-100/80 font-medium">
            Limit Uang Jajan Harian{' '}
            <span className="font-bold font-mono text-white">{formatRupiah(effectiveDailyLimit)}</span>
          </p>
          <button
            type="button"
            onClick={() => setIsLimitOpen(true)}
            className="shrink-0 rounded-lg px-2 py-1 -mr-2 text-xs font-semibold text-[#bef264] hover:bg-white/10 active:scale-95 transition cursor-pointer"
          >
            Atur limit
          </button>
        </div>
      </div>

      {/* 2. DRAWER ATUR LIMIT LANGSUNG DI BERANDA */}
      <BottomSheet
        open={isLimitOpen}
        onClose={() => setIsLimitOpen(false)}
        title="Batas Limit Uang Jajan"
        subtitle="Atur batas pencairan uang jajan harian, mingguan, atau bulanan"
        icon={<Wallet className="h-5 w-5 text-emerald-600" />}
      >
        <WalletLimitCard
          initialDaily={parentLimits.parentDailyLimit}
          initialWeekly={parentLimits.parentWeeklyLimit}
          initialMonthly={parentLimits.parentMonthlyLimit}
          globalDailyLimit={parentLimits.globalDailyLimit}
          isModal
          onSuccess={() => {
            setIsLimitOpen(false)
            router.refresh()
          }}
        />
      </BottomSheet>

      {/* 3. DRAWER TOP-UP UANG JAJAN LANGSUNG DI BERANDA */}
      <BottomSheet
        open={isTopUpOpen}
        onClose={handleCloseTopUpDrawer}
        title={checkoutResult ? 'Petunjuk Pembayaran' : 'Top-Up Uang Jajan'}
        subtitle={
          checkoutResult
            ? 'Menunggu pembayaran — transfer sesuai instruksi di bawah'
            : undefined
        }
        icon={
          checkoutResult ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <Wallet className="h-5 w-5 text-emerald-600" />
          )
        }
        footer={
          checkoutResult ? (
            <button
              type="button"
              onClick={handleCloseTopUpDrawer}
              className="w-full min-h-[44px] rounded-xl bg-[#064e3b] hover:bg-[#047857] py-2.5 px-3 text-xs font-bold text-[#bef264] shadow-xs cursor-pointer active:scale-95 transition"
            >
              Selesai
            </button>
          ) : transferInReview ? (
              <div className="w-full rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200 text-left">
                Masih ada bukti transfer yang sedang dicek petugas. Isi saldo baru bisa dibuat setelah hasilnya keluar.
              </div>
          ) : !paymentMethod ? (
              <div className="w-full space-y-2">
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200 text-left">
                  <p className="font-semibold">Top-Up Online Belum Tersedia</p>
                  <p className="mt-1 text-[11px] leading-relaxed">
                    {gatewayInfo?.unavailableReason || 'Top-up online belum dibuka. Setor titipan uang jajan dilayani secara tunai di loket kasir pesantren.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTopUpOpen(false)}
                  className="w-full min-h-12 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 active:scale-[0.98] transition cursor-pointer"
                >
                  Mengerti
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isCheckingOut || topUpAmount < 10000}
                onClick={handleProceedTopUp}
                className="w-full min-h-12 flex items-center justify-center gap-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] px-4 py-3 text-sm font-bold text-[#bef264] shadow-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#bef264]" />
                    <span>Memproses pembayaran…</span>
                  </>
                ) : isTransfer ? (
                  `Lanjut transfer ${formatRupiah(totalCharged)} + kode unik`
                ) : (
                  `Buat Pembayaran ${formatRupiah(totalCharged)}`
                )}
              </button>
            )
        }
      >
        {!checkoutResult ? (
          /* FORM TOP-UP */
          <div className="space-y-5 text-sm">
            {/* Saldo saat ini */}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Saldo saat ini{' '}
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatRupiah(balance)}</span>
            </p>

            {/* Nominal: input utama + pilihan cepat */}
            <div className="space-y-2.5">
              <label htmlFor="topup-amount" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Nominal top-up
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400 dark:text-slate-500 font-mono">
                  Rp
                </span>
                <input
                  id="topup-amount"
                  type="text"
                  inputMode="numeric"
                  value={formatThousands(topUpAmount)}
                  onChange={e => setTopUpAmount(parseRupiahDigits(e.target.value))}
                  placeholder="0"
                  className="w-full pl-12 pr-4 py-3.5 text-2xl font-mono font-black tabular-nums border border-slate-300 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-hidden placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[50000, 100000, 200000, 500000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTopUpAmount(val)}
                    className={`py-2 text-xs font-bold rounded-xl border transition active:scale-95 cursor-pointer ${
                      topUpAmount === val
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {val >= 1000000 ? `${val / 1000000}jt` : `${val / 1000}rb`}
                  </button>
                ))}
              </div>
              {topUpAmount > 0 && topUpAmount < 10000 && (
                <p className="text-[11px] text-red-600 dark:text-red-400">Minimal top-up Rp10.000</p>
              )}
            </div>

            {/* Cara Pembayaran */}
            {availableMethods.length > 0 && (
            <div className="space-y-2.5 pt-5 border-t border-slate-100 dark:border-slate-800">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">Cara pembayaran</span>
              {availableMethods.map(method => {
                const active = paymentMethod === method
                return (
                  <label key={method} className={`flex items-start gap-3 rounded-xl border p-3 ${availableMethods.length > 1 ? 'cursor-pointer' : ''} ${active ? 'border-emerald-700 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/60' : 'border-slate-200 dark:border-slate-700'}`}>
                    {availableMethods.length > 1 && (
                      <input type="radio" name="topup-method" className="mt-1 accent-emerald-700" checked={active} onChange={() => setChosenMethod(method)} />
                    )}
                    <span>
                      <span className="block text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        {method === 'MANUAL_TRANSFER' ? 'Transfer bank + unggah bukti' : 'Virtual Account BRI (BRIVA)'}
                      </span>
                      <span className="block text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                        {method === 'MANUAL_TRANSFER' ? 'Transfer ke rekening Koperasi lalu kirim foto bukti.' : 'Transfer via BRImo, ATM BRI, AgenBRILink, atau Bank Lain'}
                      </span>
                    </span>
                  </label>
                )
              })}
              {isTransfer && accounts.length > 1 && (
                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Rekening tujuan</span>
                  <div className="grid gap-2" role="radiogroup" aria-label="Rekening tujuan">
                    {accounts.map(a => {
                      const active = destinationAccountId === a.id
                      return (
                        <label
                          key={a.id}
                          className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer ${
                            active
                              ? 'border-emerald-700 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/60'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="topup-destination-account"
                            className="mt-0.5 accent-emerald-700"
                            checked={active}
                            onChange={() => setAccountId(a.id)}
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                              {a.bankName} · <span className="font-mono">{a.accountNumber}</span>
                            </span>
                            <span className="block text-[11px] text-slate-600 dark:text-slate-400">
                              a.n. {a.accountHolder}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {isTransfer && canDeduct && (
                <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input type="checkbox" className="mt-0.5 accent-emerald-700" checked={deductFee} onChange={e => setDeductFee(e.target.checked)} />
                  <span>Potong biaya admin dari nominal (transfer {formatRupiah(topUpAmount)}, saldo masuk {formatRupiah(topUpAmount - cooperativeFee)})</span>
                </label>
              )}
            </div>
            )}

            {/* Rincian Subtotal & Biaya */}
            {paymentMethod && (
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Nominal Top-Up</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatRupiah(topUpAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Biaya Admin Koperasi{deducting ? ' (dipotong)' : ''}</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{deducting ? '−' : ''}{formatRupiah(cooperativeFee)}</span>
              </div>
              {isTransfer && (
                <div className="flex justify-between">
                  <span>Kode unik</span>
                  <span className="text-slate-500">ditambahkan sistem (Rp1–Rp{uniqueCodeMax.toLocaleString('id-ID')})</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-1 font-bold text-slate-950 dark:text-slate-100 text-sm">
                <span>Total Pembayaran</span>
                <span className="font-mono text-emerald-800 dark:text-emerald-400">{formatRupiah(totalCharged)}</span>
              </div>
            </div>
            )}
          </div>
        ) : (
          /* RESULT PETUNJUK PEMBAYARAN */
          <div className="space-y-4">
            {/* Total Transfer */}
            <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 p-4 border border-slate-200/80 dark:border-slate-700 text-center space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total yang Harus Ditransfer
              </p>
              <p className="text-2xl font-black text-slate-950 dark:text-slate-100 font-mono tracking-tight">
                {formatRupiah(checkoutResult.order.totalCharged)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Termasuk biaya admin Koperasi {formatRupiah(checkoutResult.order.cooperativeAdminFee)}
              </p>
            </div>

            {/* Virtual Account Number */}
            {checkoutResult.checkout.vaNumber && (
              <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/40 p-4 text-center space-y-2">
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">Nomor Virtual Account BRI (BRIVA)</span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-100 tracking-wider whitespace-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-0.5">
                    {checkoutResult.checkout.vaNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyVa(checkoutResult.checkout.vaNumber!)}
                    className="rounded-lg bg-white dark:bg-slate-800 p-1.5 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700 shadow-2xs cursor-pointer active:scale-95 transition"
                    aria-label="Salin nomor Virtual Account"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Berlaku 24 jam (sampai {formatPortalTimeWib(checkoutResult.order.expiresAt)})
                  </span>
                </div>
              </div>
            )}

            {/* Petunjuk Pembayaran Singkat */}
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <p className="font-bold text-slate-900 dark:text-slate-200">Langkah Pembayaran:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                <li>Buka aplikasi <strong>BRImo</strong> atau transfer dari ATM / m-Banking lain.</li>
                <li>Pilih menu <strong>Bayar &gt; BRIVA</strong> (atau Transfer Antar-Bank kode 002 jika dari bank lain).</li>
                <li>Masukkan nomor BRIVA di atas.</li>
                <li>Pastikan nominal transfer tepat sama.</li>
                <li>Saldo uang jajan bertambah otomatis setelah pembayaran berhasil.</li>
              </ul>
            </div>
          </div>
        )}
      </BottomSheet>
      <TransferSheet transfer={transferSheet} open={Boolean(transferSheet)} onClose={() => setTransferSheet(null)} />
    </>
  )
}
