'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { formatRupiah } from '@/lib/portal/format'
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
  isModal = false,
  onSuccess,
  onCancel,
}: WalletLimitCardProps) {
  const router = useRouter()
  const formId = useId()
  const [daily, setDaily] = useState<string>(initialDaily !== null ? String(initialDaily) : '')
  const [isSaving, setIsSaving] = useState(false)

  const effectiveDaily = daily !== '' && !isNaN(Number(daily))
    ? Math.min(globalDailyLimit, Math.max(0, Number(daily)))
    : globalDailyLimit

  function setPreset(amount: number) {
    setDaily(String(amount))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    try {
      const parsedDaily = daily.trim() !== '' ? Math.max(0, parseInt(daily, 10)) : null

      const res = await updateParentLimitsAction({
        daily: parsedDaily,
        weekly: initialWeekly,
        monthly: initialMonthly,
      })

      if ('error' in res) {
        toast.error(res.error)
        return
      }

      toast.success('Limit uang jajan harian berhasil diperbarui!')
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
      {/* Metric Display Card (Tanpa tulisan "Limit Aktif Santri", Bersih & Menonjol) */}
      <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3.5 flex items-center justify-between">
        <div>
          <p className="text-2xl font-extrabold text-emerald-950 font-mono tracking-tight">
            {formatRupiah(effectiveDaily)}{' '}
            <span className="text-xs font-semibold text-emerald-700 font-sans">/hari</span>
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-slate-700 border border-emerald-200/60 font-mono shadow-2xs">
            Maksimal {formatRupiah(globalDailyLimit)}
          </span>
        </div>
      </div>

      {/* Quick Preset Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-700 block">Pilihan Cepat:</span>
        <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
          {[20000, 30000, 50000, 100000].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => setPreset(val)}
              className="py-2 rounded-xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 font-bold text-slate-700 transition active:scale-95 cursor-pointer text-center"
            >
              {val >= 1000 ? `${val / 1000}rb` : val}
            </button>
          ))}
        </div>
      </div>

      {/* Input Manual Nominal */}
      <div>
        <label htmlFor={`${formId}-daily`} className="block font-bold text-slate-700 text-xs mb-1">
          Nominal Batas Harian (Rp)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
            Rp
          </span>
          <input
            id={`${formId}-daily`}
            type="number"
            step="5000"
            min="0"
            max={globalDailyLimit}
            value={daily}
            onChange={e => setDaily(e.target.value)}
            placeholder={String(globalDailyLimit)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-sm font-bold font-mono text-slate-950 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden transition"
          />
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Kosongkan untuk mengikuti batas maksimal yang ditetapkan pesantren ({formatRupiah(globalDailyLimit)}).
        </p>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer active:scale-95 transition"
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 min-h-[44px] rounded-xl bg-[#064e3b] hover:bg-[#047857] text-[#bef264] text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-[#bef264]" /> : null}
          <span>Simpan Limit</span>
        </button>
      </div>
    </form>
  )
}
