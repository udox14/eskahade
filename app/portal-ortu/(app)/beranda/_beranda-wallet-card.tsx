'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Wallet, Copy, Check, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { formatRupiah } from '@/lib/portal/format'
import { BottomSheet } from '../../_components/bottom-sheet'
import { WalletLimitCard } from '../akun/_wallet-limit-card'
import { createPortalCheckoutAction } from '../tagihan/actions'
import type { PortalCheckoutResponse, PortalStudentBillingData } from '@/lib/portal/finance'

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
}

const VA_BANKS = [
  { code: 'BR', label: 'BRI' },
  { code: 'NC', label: 'BNI' },
  { code: 'M2', label: 'Mandiri' },
  { code: 'BT', label: 'Permata' },
  { code: 'BC', label: 'BCA' },
]

export function BerandaWalletCard({
  santriId,
  balance,
  effectiveDailyLimit,
  parentLimits,
  gatewayInfo,
  fixedVa,
}: BerandaWalletCardProps) {
  const router = useRouter()

  // Drawer states
  const [isLimitOpen, setIsLimitOpen] = useState(false)
  const [isTopUpOpen, setIsTopUpOpen] = useState(false)

  // Top Up form states
  const [topUpAmount, setTopUpAmount] = useState<number>(100000)
  const enabledChannels = gatewayInfo?.enabledChannels || ['DUITKU_VA', 'DUITKU_QRIS']
  const isVaEnabled = enabledChannels.includes('DUITKU_VA')
  const isQrisEnabled = enabledChannels.includes('DUITKU_QRIS')

  const [paymentMethod, setPaymentMethod] = useState<'DUITKU_VA' | 'DUITKU_QRIS'>(() => {
    if (isVaEnabled) return 'DUITKU_VA'
    if (isQrisEnabled) return 'DUITKU_QRIS'
    return 'DUITKU_VA'
  })
  const [vaBank, setVaBank] = useState<string>('BR')
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<PortalCheckoutResponse | null>(null)
  const [copied, setCopied] = useState(false)

  // Fee calculation
  const configuredFee = paymentMethod === 'DUITKU_VA'
    ? (gatewayInfo?.defaultVaFee ?? 4000)
    : Math.ceil(topUpAmount * ((gatewayInfo?.defaultQrisFeePercent ?? 0.7) / 100))
  const gatewayFee = gatewayInfo?.feePayer === 'INSTITUTION' ? 0 : configuredFee
  const totalCharged = topUpAmount > 0 ? topUpAmount + gatewayFee : 0

  const handleCopyVa = (vaText: string) => {
    navigator.clipboard.writeText(vaText)
    setCopied(true)
    toast.success('Nomor Virtual Account disalin!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProceedTopUp = async () => {
    if (topUpAmount < 10000) {
      toast.error('Nominal top-up minimal Rp10.000.')
      return
    }

    setIsCheckingOut(true)
    try {
      const res = await createPortalCheckoutAction({
        santriId,
        paymentMethod,
        vaBank,
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

      setCheckoutResult(res)
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
      <div className="rounded-[22px] bg-[#064e3b] p-5 text-white shadow-[0_8px_24px_rgba(6,78,59,0.16)] relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#bef264]">
              Dompet Uang Jajan
            </span>
            <span className="text-[11px] text-emerald-200/90 font-medium">
              Saldo di loket
            </span>
          </div>

          <div className="space-y-0.5">
            <p className="text-3xl font-black font-mono tracking-tight text-white">
              {formatRupiah(balance)}
            </p>
            <p className="text-xs text-emerald-100/80 font-medium">
              Limit belanja hari ini:{' '}
              <span className="font-bold font-mono text-[#bef264]">
                {formatRupiah(effectiveDailyLimit)}
              </span>
            </p>
          </div>

          {/* Aksi Langsung pada Hero: Isi Saldo & Atur Limit (Membuka BottomSheet / Drawer) */}
          <div className="pt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTopUpOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#bef264] px-4 py-2.5 text-xs font-bold text-[#064e3b] shadow-xs hover:bg-[#a3e635] active:scale-[0.98] transition cursor-pointer"
            >
              <span>+ Isi saldo jajan</span>
            </button>
            <button
              type="button"
              onClick={() => setIsLimitOpen(true)}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-800/80 px-3.5 py-2.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-800 hover:text-white active:scale-[0.98] transition cursor-pointer"
            >
              <span>Atur limit</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. DRAWER ATUR LIMIT LANGSUNG DI BERANDA */}
      <BottomSheet
        open={isLimitOpen}
        onClose={() => setIsLimitOpen(false)}
        title="Batas Limit Uang Jajan"
        subtitle="Atur batas belanja & penarikan di koperasi"
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
            : 'Saldo titipan belanja & jajan santri di pesantren'
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
          ) : (
            <button
              type="button"
              disabled={isCheckingOut || topUpAmount < 10000 || (!isVaEnabled && !isQrisEnabled)}
              onClick={handleProceedTopUp}
              className="w-full min-h-12 flex items-center justify-center gap-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] px-4 py-3 text-sm font-bold text-[#bef264] shadow-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#bef264]" />
                  <span>Memproses pembayaran…</span>
                </>
              ) : (
                `Buat Pembayaran ${formatRupiah(totalCharged)}`
              )}
            </button>
          )
        }
      >
        {!checkoutResult ? (
          /* FORM TOP-UP */
          <div className="space-y-4 text-sm">
            {/* Informasi Saldo Saat Ini */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs">
              <span className="text-emerald-950 dark:text-emerald-200 font-semibold">Saldo Dompet Saat Ini</span>
              <span className="font-mono font-bold text-emerald-900 dark:text-emerald-300 text-sm">{formatRupiah(balance)}</span>
            </div>

            {/* Pilihan Cepat Nominal */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Pilih Nominal Top-Up
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[50000, 100000, 200000, 500000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTopUpAmount(val)}
                    className={`py-2 text-xs font-bold font-mono rounded-xl border transition active:scale-95 cursor-pointer ${
                      topUpAmount === val
                        ? 'bg-emerald-800 text-white border-emerald-800 dark:bg-emerald-600 dark:border-emerald-500 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {val >= 1000000 ? `${val / 1000000}jt` : `${val / 1000}rb`}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Nominal Manual */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Atau Masukkan Nominal Lainnya
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 dark:text-slate-500 font-mono">
                  Rp
                </span>
                <input
                  type="number"
                  min={10000}
                  step={10000}
                  value={topUpAmount > 0 ? topUpAmount : ''}
                  onChange={e => {
                    const parsed = parseInt(e.target.value, 10) || 0
                    setTopUpAmount(Math.max(0, parsed))
                  }}
                  placeholder="isi nominal (min. Rp10.000)"
                  className="w-full pl-10 pr-4 py-2.5 text-sm font-mono font-bold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-850 dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-hidden placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Metode Pembayaran */}
            <fieldset className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <legend className="text-xs font-bold text-slate-700 dark:text-slate-300">Metode Pembayaran</legend>
              <div className="grid grid-cols-2 gap-2">
                {isVaEnabled && (
                  <button
                    type="button"
                    aria-pressed={paymentMethod === 'DUITKU_VA'}
                    onClick={() => setPaymentMethod('DUITKU_VA')}
                    className={`min-h-11 rounded-xl border px-2 text-xs font-bold transition cursor-pointer ${
                      paymentMethod === 'DUITKU_VA'
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60'
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
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    QRIS
                  </button>
                )}
              </div>

              {/* Pilihan Bank jika Virtual Account */}
              {paymentMethod === 'DUITKU_VA' && isVaEnabled && (
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {VA_BANKS.map(bank => (
                    <button
                      key={bank.code}
                      type="button"
                      aria-pressed={vaBank === bank.code}
                      onClick={() => setVaBank(bank.code)}
                      className={`min-h-10 rounded-xl border px-2 text-xs font-bold transition cursor-pointer active:scale-95 ${
                        vaBank === bank.code
                          ? 'border-emerald-700 bg-emerald-800 text-white dark:border-emerald-500 dark:bg-emerald-600'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50 bg-white dark:border-slate-700 dark:text-slate-300 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                      }`}
                    >
                      {bank.label}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>

            {/* Rincian Subtotal & Biaya */}
            <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Nominal Top-Up</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatRupiah(topUpAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Biaya Admin</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatRupiah(gatewayFee)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2 font-bold text-slate-950 dark:text-slate-100 text-sm">
                <span>Total Pembayaran</span>
                <span className="font-mono text-emerald-800 dark:text-emerald-400">{formatRupiah(totalCharged)}</span>
              </div>
            </div>
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
                Termasuk biaya admin {formatRupiah(checkoutResult.order.gatewayFee)}
              </p>
            </div>

            {/* Virtual Account Number */}
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
                    {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Berlaku 24 jam (sampai{' '}
                    {new Date(checkoutResult.order.expiresAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    WIB)
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

            {/* Petunjuk Pembayaran Singkat */}
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <p className="font-bold text-slate-900 dark:text-slate-200">Langkah Pembayaran:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                <li>Buka m-Banking atau ATM bank Anda.</li>
                <li>Pilih menu <strong>Transfer Virtual Account / Bayar Tagihan</strong>.</li>
                <li>Masukkan nomor Virtual Account di atas.</li>
                <li>Pastikan nominal transfer tepat sama.</li>
                <li>Saldo uang jajan bertambah otomatis setelah pembayaran berhasil.</li>
              </ul>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  )
}
