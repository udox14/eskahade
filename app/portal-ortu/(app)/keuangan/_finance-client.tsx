'use client'

import { useState } from 'react'
import { CaretRight, Key, PlusCircle, ShoppingBag, Sliders } from '@phosphor-icons/react'
import { formatRupiah } from '@/lib/portal/format'
import { WalletTopupModal } from './_wallet-topup-modal'
import { LimitModal } from './_limit-modal'
import { PinModal } from './_pin-modal'

type Modal = 'jajan' | 'limit' | 'pin' | null

function limitSummary(limits: { daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null } | null) {
  if (!limits || (!limits.daily_rupiah && !limits.weekly_rupiah && !limits.monthly_rupiah)) return 'Belum diatur'
  const parts: string[] = []
  if (limits.daily_rupiah) parts.push(`Harian ${formatRupiah(limits.daily_rupiah)}`)
  if (limits.weekly_rupiah) parts.push(`Mingguan ${formatRupiah(limits.weekly_rupiah)}`)
  if (limits.monthly_rupiah) parts.push(`Bulanan ${formatRupiah(limits.monthly_rupiah)}`)
  return parts.join(' • ')
}

export function FinanceClient({
  jajanBalance,
  limits,
  hasPin,
}: {
  jajanBalance: number
  limits: { daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null } | null
  hasPin: boolean
}) {
  const [modal, setModal] = useState<Modal>(null)

  return (
    <div className="space-y-3">
      <BigButton
        icon={<ShoppingBag className="w-5 h-5 text-[var(--p-ink)]" />}
        label="Uang Jajan"
        value={formatRupiah(jajanBalance)}
        onClick={() => setModal('jajan')}
        trailing={<PlusCircle className="w-6 h-6 text-[var(--p-red)]" weight="fill" />}
      />
      <BigButton
        icon={<Sliders className="w-5 h-5 text-[var(--p-ink)]" />}
        label="Limit Pencairan Anak"
        value={limitSummary(limits)}
        onClick={() => setModal('limit')}
      />
      <BigButton
        icon={<Key className="w-5 h-5 text-[var(--p-ink)]" />}
        label="Atur PIN Anak"
        value={hasPin ? 'PIN sudah diset' : 'Belum diset'}
        onClick={() => setModal('pin')}
      />

      <WalletTopupModal
        open={modal === 'jajan'}
        onClose={() => setModal(null)}
        destination="JAJAN"
        title="Uang Jajan"
        currentBalance={jajanBalance}
      />
      <LimitModal open={modal === 'limit'} onClose={() => setModal(null)} limits={limits} />
      <PinModal open={modal === 'pin'} onClose={() => setModal(null)} hasPin={hasPin} />
    </div>
  )
}

function BigButton(props: {
  icon: React.ReactNode
  label: string
  value: string
  onClick: () => void
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="portal-card w-full flex items-center gap-3 p-4 text-left transition active:scale-[0.99]"
    >
      <span className="flex w-11 h-11 shrink-0 items-center justify-center bg-[var(--p-paper)] border border-[var(--p-line)]">
        {props.icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">{props.label}</span>
        <span className="block mt-0.5 text-sm font-bold text-[var(--p-ink)] truncate">{props.value}</span>
      </span>
      {props.trailing ?? <CaretRight className="w-4 h-4 shrink-0 text-[var(--p-muted)]" />}
    </button>
  )
}
