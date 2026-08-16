'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowsLeftRight, CircleNotch } from '@phosphor-icons/react'
import { BottomSheet } from '../../_components/bottom-sheet'
import { RupiahInput } from '../../_components/rupiah-input'
import { formatRupiah } from '@/lib/portal/format'
import { allocatePortalFunds } from './actions'

type WalletDestination = 'JAJAN' | 'MAKAN' | 'LAUNDRY'

export function WalletTopupModal({
  open,
  onClose,
  destination,
  title,
  currentBalance,
}: {
  open: boolean
  onClose: () => void
  destination: WalletDestination
  title: string
  currentBalance: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(0)

  function handleSubmit() {
    if (pending || amount <= 0) return
    startTransition(async () => {
      const result = await allocatePortalFunds({
        destination,
        amountRupiah: amount,
        requestKey: crypto.randomUUID(),
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${title} berhasil ditambah ${formatRupiah(amount)}.`)
      setAmount(0)
      onClose()
      router.refresh()
    })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <p className="text-xs text-[var(--p-muted)] leading-relaxed">
        Saldo saat ini: <span className="font-bold text-[var(--p-ink)]">{formatRupiah(currentBalance)}</span>. Dana diambil dari Saldo Titipan Utama.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Nominal Top Up</label>
          <div className="mt-1.5">
            <RupiahInput value={amount} onChange={setAmount} placeholder="Ketik nominal..." autoFocus />
          </div>
        </div>

        <button
          disabled={pending || amount <= 0}
          onClick={handleSubmit}
          className="portal-btn portal-btn-accent w-full"
        >
          {pending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <ArrowsLeftRight className="w-4 h-4" />}
          {pending ? 'Memproses...' : `Top Up ${amount > 0 ? formatRupiah(amount) : ''}`}
        </button>
      </div>
    </BottomSheet>
  )
}
