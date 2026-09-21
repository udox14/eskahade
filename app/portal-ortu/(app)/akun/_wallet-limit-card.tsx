'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Wallet, ShieldCheck, Loader2 } from 'lucide-react'
import { formatRupiah } from '@/lib/portal/format'
import { updateParentLimitsAction } from '../tagihan/actions'

interface WalletLimitCardProps {
  initialDaily: number | null
  initialWeekly: number | null
  initialMonthly: number | null
  globalDailyLimit: number
  isModal?: boolean
  onSuccess?: () => void
}

export function WalletLimitCard({
  initialDaily,
  initialWeekly,
  initialMonthly,
  globalDailyLimit,
  isModal = false,
  onSuccess,
}: WalletLimitCardProps) {
  const router = useRouter()
  const [daily, setDaily] = useState<string>(initialDaily !== null ? String(initialDaily) : '')
  const [weekly, setWeekly] = useState<string>(initialWeekly !== null ? String(initialWeekly) : '')
  const [monthly, setMonthly] = useState<string>(initialMonthly !== null ? String(initialMonthly) : '')
  const [isSaving, setIsSaving] = useState(false)

  const effectiveDaily = daily !== '' && !isNaN(Number(daily))
    ? Math.min(globalDailyLimit, Math.max(0, Number(daily)))
    : globalDailyLimit

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    try {
      const parsedDaily = daily.trim() !== '' ? Math.max(0, parseInt(daily, 10)) : null
      const parsedWeekly = weekly.trim() !== '' ? Math.max(0, parseInt(weekly, 10)) : null
      const parsedMonthly = monthly.trim() !== '' ? Math.max(0, parseInt(monthly, 10)) : null

      const res = await updateParentLimitsAction({
        daily: parsedDaily,
        weekly: parsedWeekly,
        monthly: parsedMonthly,
      })

      if ('error' in res) {
        toast.error(res.error)
        return
      }

      toast.success('Batas limit uang jajan berhasil diperbarui!')
      onSuccess?.()
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan limit.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={isModal ? 'space-y-4' : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4'}>
      {!isModal && (
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Limit Penarikan Uang Jajan</h3>
            <p className="text-xs text-slate-500">Batasi penarikan uang saku santri di loket koperasi.</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 text-xs text-slate-700 space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-emerald-950">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <span>Aturan Limit Efektif</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          Pesantren memberlakukan batas maksimal harian <strong className="text-slate-900">{formatRupiah(globalDailyLimit)}</strong>.
          Sistem akan menggunakan batas terkecil antara limit Anda dan limit pesantren.
        </p>
        <p className="pt-0.5 font-bold text-emerald-800">
          Limit Harian Efektif Saat Ini: {formatRupiah(effectiveDaily)}/hari
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-3 pt-1">
        <div>
          <label className="block text-xs font-bold text-slate-700">
            Batas Penarikan Harian (Rp)
          </label>
          <input
            type="number"
            min={0}
            step={5000}
            value={daily}
            onChange={e => setDaily(e.target.value)}
            placeholder={`Kosongkan untuk ikut limit pesantren (${formatRupiah(globalDailyLimit)})`}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden transition"
          />
          <p className="mt-1 text-[11px] text-slate-400">Contoh: 30000 untuk maksimal Rp30.000/hari</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700">
            Batas Penarikan Mingguan (Rp) — Opsional
          </label>
          <input
            type="number"
            min={0}
            step={10000}
            value={weekly}
            onChange={e => setWeekly(e.target.value)}
            placeholder="Tidak dibatasi mingguan"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700">
            Batas Penarikan Bulanan (Rp) — Opsional
          </label>
          <input
            type="number"
            min={0}
            step={50000}
            value={monthly}
            onChange={e => setMonthly(e.target.value)}
            placeholder="Tidak dibatasi bulanan"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-hidden transition"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] py-2.5 text-xs font-bold text-[#bef264] shadow-xs disabled:opacity-50 active:scale-95 transition cursor-pointer"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin text-[#bef264]" /> : null}
          <span>Simpan Batas Limit</span>
        </button>
      </form>
    </div>
  )
}
