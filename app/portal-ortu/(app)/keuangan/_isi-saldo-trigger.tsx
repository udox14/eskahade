'use client'

import { useState } from 'react'
import { PlusCircle } from '@phosphor-icons/react'
import { TopupModal } from './_topup-modal'

export function IsiSaldoTrigger({
  methods,
  qrisMethod,
}: {
  methods: string[]
  qrisMethod: string | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-1 flex items-center gap-1.5 rounded-[var(--p-radius-sm)] bg-[var(--p-red)] px-3 py-1.5 text-[11px] font-bold text-white shrink-0 active:scale-95 transition"
      >
        <PlusCircle className="w-3.5 h-3.5" weight="fill" />
        Isi Saldo
      </button>
      <TopupModal open={open} onClose={() => setOpen(false)} methods={methods} qrisMethod={qrisMethod} />
    </>
  )
}
