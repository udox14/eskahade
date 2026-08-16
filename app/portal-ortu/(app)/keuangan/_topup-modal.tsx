'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CircleNotch, PlusCircle } from '@phosphor-icons/react'
import { BottomSheet } from '../../_components/bottom-sheet'
import { RupiahInput } from '../../_components/rupiah-input'
import { formatRupiah } from '@/lib/portal/format'
import { createPortalTopup } from './actions'
import { PaymentMethodPicker } from './_payment-method-picker'

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000]

export function TopupModal({
  open,
  onClose,
  methods,
  qrisMethod,
}: {
  open: boolean
  onClose: () => void
  methods: string[]
  qrisMethod: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(100000)
  const [method, setMethod] = useState(methods[0] || '')

  function handleSubmit() {
    if (pending || !method || amount <= 0) return
    startTransition(async () => {
      const result = await createPortalTopup({ amountRupiah: amount, paymentMethod: method })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl
        return
      }
      toast.success('Instruksi pembayaran dibuat.')
      onClose()
    })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Isi Saldo Titipan">
      <p className="text-xs text-[var(--p-muted)] leading-relaxed">
        Dana masuk ke saldo titipan terlebih dahulu. Biaya payment gateway ditambahkan saat proses pembayaran.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Pilih / Isi Nominal</label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={`rounded-[var(--p-radius-sm)] border py-2 text-xs font-bold transition active:scale-95 ${
                  amount === preset
                    ? 'border-[var(--p-ink)] bg-[var(--p-ink)] text-white'
                    : 'border-[var(--p-line)] bg-white text-[var(--p-ink)] hover:bg-[var(--p-paper)]'
                }`}
              >
                {preset >= 1000000 ? `${preset / 1000000} Jt` : `${preset / 1000}rb`}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <RupiahInput value={amount} onChange={setAmount} placeholder="Atau ketik nominal custom..." />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Metode Pembayaran</label>
          <PaymentMethodPicker methods={methods} qrisMethod={qrisMethod} value={method} onChange={setMethod} />
        </div>

        <button
          disabled={pending || !method || amount <= 0}
          onClick={handleSubmit}
          className="portal-btn portal-btn-accent w-full"
        >
          {pending ? <CircleNotch className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
          {pending ? 'Memproses...' : `Bayar ${formatRupiah(amount)}`}
        </button>
      </div>
    </BottomSheet>
  )
}
