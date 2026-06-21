'use client'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import type { UnitUPK } from './types'

export function UnitPicker({ onPick }: { onPick: (unit: UnitUPK) => void }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <DashboardPageHeader
        title="Kasir UPK"
        description="Pilih unit untuk memulai pencatatan dan pembayaran."
        className="border-b pb-4"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          onClick={() => onPick('PUTRA')}
          className="rounded-xl border bg-white p-8 text-left transition-colors hover:border-green-300 hover:bg-green-50"
        >
          <p className="text-3xl font-extrabold text-green-700">UPK Putra</p>
          <p className="mt-2 text-sm text-slate-500">Menampilkan santri putra saja.</p>
        </button>
        <button
          onClick={() => onPick('PUTRI')}
          className="rounded-xl border bg-white p-8 text-left transition-colors hover:border-rose-300 hover:bg-rose-50"
        >
          <p className="text-3xl font-extrabold text-rose-700">UPK Putri</p>
          <p className="mt-2 text-sm text-slate-500">Menampilkan santri putri saja.</p>
        </button>
      </div>
    </div>
  )
}
