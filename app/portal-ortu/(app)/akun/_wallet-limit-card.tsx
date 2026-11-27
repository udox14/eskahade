'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronDown, Loader2 } from 'lucide-react'
import { formatRupiah, formatThousands, parseRupiahDigits } from '@/lib/portal/format'
import { updateParentLimitsAction } from '../tagihan/actions'

interface WalletLimitCardProps {
  initialDaily: number | null
  initialWeekly?: number | null
  initialMonthly?: number | null
  globalDailyLimit: number
  isModal?: boolean
  onSuccess?: () => void
  onCancel?: () => void
}

export function WalletLimitCard({
  initialDaily,
  initialWeekly = null,
  initialMonthly = null,
  globalDailyLimit,
  onSuccess,
  onCancel,
}: WalletLimitCardProps) {
  const router = useRouter()
  const formId = useId()
  const [daily, setDaily] = useState<number | null>(initialDaily)
  const [weekly, setWeekly] = useState<number | null>(initialWeekly)
  const [monthly, setMonthly] = useState<number | null>(initialMonthly)
  const [showAdvanced, setShowAdvanced] = useState(
    initialWeekly !== null || initialMonthly !== null
  )
  const [isSaving, setIsSaving] = useState(false)

  const effectiveDaily =
    daily !== null ? Math.min(globalDailyLimit, Math.max(0, daily)) : globalDailyLimit
  const exceedsGlobal = daily !== null && daily > globalDailyLimit

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (exceedsGlobal) {
      toast.error(`Batas harian tidak boleh melebihi batas pesantren (${formatRupiah(globalDailyLimit)}).`)
      return
    }
    setIsSaving(true)
    try {
      const res = await updateParentLimitsAction({
        daily: daily !== null ? Math.max(0, daily) : null,
        weekly: weekly !== null ? Math.max(0, weekly) : null,
        monthly: monthly !== null ? Math.max(0, monthly) : null,
      })

      if ('error' in res) {
        toast.error(res.error)
        return
      }

      toast.success('Pengaturan limit uang jajan berhasil diperbarui!')
      onSuccess?.()
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan limit.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 pt-1">
      {/* Metric Display Card */}
      <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 p-3.5 flex items-center justify-between gap-2">
        <div>
          <p className="text-2xl font-extrabold text-emerald-950 dark:text-emerald-200 font-mono tracking-tight tabular-nums">
            {formatRupiah(effectiveDaily)}{' '}
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 font-sans">/hari</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-emerald-200/60 dark:border-slate-700 font-mono shadow-2xs tabular-nums">
            Maks. {formatRupiah(globalDailyLimit)}
          </span>
        </div>
      </div>

      {/* Quick Preset Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
          Pilihan Cepat Harian:
        </span>
        <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
          {[20000, 30000, 50000, 100000]
            .filter(val => val <= globalDailyLimit)
            .map(val => {
              const active = daily === val
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDaily(val)}
                  className={`py-2 rounded-xl font-bold transition active:scale-95 cursor-pointer text-center border ${
                    active
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-slate-100 dark:bg-slate-800 border-transparent hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:text-emerald-900 dark:hover:text-emerald-200 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {val >= 1000 ? `${val / 1000}rb` : val}
                </button>
              )
            })}
        </div>
      </div>

      {/* Input Nominal Harian */}
      <div>
        <label htmlFor={`${formId}-daily`} className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1">
          Nominal Batas Harian (Rp)
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 dark:text-slate-500 text-xs">
            Rp
          </span>
          <input
            id={`${formId}-daily`}
            type="text"
            inputMode="numeric"
            value={daily !== null ? (daily === 0 ? '0' : formatThousands(daily)) : ''}
            onChange={e => {
              const raw = e.target.value.replace(/\D/g, '')
              setDaily(raw === '' ? null : Number(raw))
            }}
            placeholder={formatThousands(globalDailyLimit)}
            className={`w-full rounded-xl border bg-white dark:bg-slate-950 pl-10 pr-3.5 py-2.5 text-sm font-bold font-mono tabular-nums text-slate-950 dark:text-white focus:outline-hidden transition ${
              exceedsGlobal
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                : 'border-slate-200 dark:border-slate-800 focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-1 focus:ring-emerald-600'
            }`}
          />
        </div>
        {exceedsGlobal ? (
          <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
            Melebihi batas maksimal pesantren ({formatRupiah(globalDailyLimit)}).
          </p>
        ) : (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Kosongkan untuk mengikuti batas maksimal pesantren ({formatRupiah(globalDailyLimit)}/hari).
          </p>
        )}
      </div>

      {/* Opsional: Limit Mingguan & Bulanan */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
        >
          <span>Batas Mingguan &amp; Bulanan (Opsional)</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced && (
          <div className="p-3.5 space-y-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label htmlFor={`${formId}-weekly`} className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
                Batas Mingguan (Rp)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
                  Rp
                </span>
                <input
                  id={`${formId}-weekly`}
                  type="text"
                  inputMode="numeric"
                  value={weekly !== null ? (weekly === 0 ? '0' : formatThousands(weekly)) : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '')
                    setWeekly(raw === '' ? null : parseRupiahDigits(raw))
                  }}
                  placeholder="Tidak dibatasi"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-10 pr-3.5 py-2 text-sm font-bold font-mono tabular-nums text-slate-950 dark:text-white focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${formId}-monthly`} className="block font-semibold text-slate-700 dark:text-slate-300 text-xs mb-1">
                Batas Bulanan (Rp)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
                  Rp
                </span>
                <input
                  id={`${formId}-monthly`}
                  type="text"
                  inputMode="numeric"
                  value={monthly !== null ? (monthly === 0 ? '0' : formatThousands(monthly)) : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '')
                    setMonthly(raw === '' ? null : parseRupiahDigits(raw))
                  }}
                  placeholder="Tidak dibatasi"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 pl-10 pr-3.5 py-2 text-sm font-bold font-mono tabular-nums text-slate-950 dark:text-white focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Kosongkan bila tidak ingin membatasi per minggu atau per bulan.
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer active:scale-95 transition"
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving || exceedsGlobal}
          className="flex-1 min-h-[44px] rounded-xl bg-[#064e3b] hover:bg-[#047857] text-[#bef264] text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-[#bef264]" /> : null}
          <span>Simpan Limit</span>
        </button>
      </div>
    </form>
  )
}
