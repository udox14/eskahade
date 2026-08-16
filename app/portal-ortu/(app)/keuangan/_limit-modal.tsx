'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleNotch, Sliders } from '@phosphor-icons/react'
import { BottomSheet } from '../../_components/bottom-sheet'
import { RupiahInput } from '../../_components/rupiah-input'
import { updatePortalWithdrawalLimits } from './actions'

export function LimitModal({
  open,
  onClose,
  limits,
}: {
  open: boolean
  onClose: () => void
  limits: { daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null } | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [daily, setDaily] = useState(limits?.daily_rupiah || 0)
  const [weekly, setWeekly] = useState(limits?.weekly_rupiah || 0)
  const [monthly, setMonthly] = useState(limits?.monthly_rupiah || 0)
  const [reauth, setReauth] = useState('')

  function handleSubmit() {
    if (pending) return
    startTransition(async () => {
      const result = await updatePortalWithdrawalLimits({
        dailyRupiah: daily || null,
        weeklyRupiah: weekly || null,
        monthlyRupiah: monthly || null,
        reauthSecret: reauth,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Limit pencairan berhasil diperbarui.')
      setReauth('')
      onClose()
      router.refresh()
    })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Limit Pencairan Anak">
      <p className="text-xs text-[var(--p-muted)] leading-relaxed">
        Batas pencairan saldo jajan/makan di pesantren (RFID/QR). Isi 0 untuk tidak memberlakukan limit pada periode tersebut.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Harian</label>
          <div className="mt-1"><RupiahInput value={daily} onChange={setDaily} placeholder="0" /></div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Mingguan</label>
          <div className="mt-1"><RupiahInput value={weekly} onChange={setWeekly} placeholder="0" /></div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Bulanan</label>
          <div className="mt-1"><RupiahInput value={monthly} onChange={setMonthly} placeholder="0" /></div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Password / PIN Konfirmasi</label>
          <input
            type="password"
            value={reauth}
            onChange={e => setReauth(e.target.value)}
            placeholder="Wajib diisi jika menaikkan limit..."
            className="portal-field"
          />
        </div>

        <button
          disabled={pending}
          onClick={handleSubmit}
          className="portal-btn portal-btn-accent w-full"
        >
          {pending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Sliders className="w-4 h-4" />}
          {pending ? 'Menyimpan...' : 'Simpan Limit Pencairan'}
        </button>
      </div>
    </BottomSheet>
  )
}
