'use client'

import { cn } from '@/lib/utils'
import { CalendarDays, Loader2, Search, X } from 'lucide-react'
import { nomorAntrian, rupiah, type Antrian } from './types'

function tanggalAntrian(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function AntrianList({
  search,
  onSearchChange,
  tanggal,
  onTanggalChange,
  onSearch,
  list,
  selectedId,
  onPick,
  loading,
}: {
  search: string
  onSearchChange: (v: string) => void
  tanggal: string
  onTanggalChange: (v: string) => void
  onSearch: () => void
  list: Antrian[]
  selectedId: string | null
  onPick: (id: string) => void
  loading: boolean
}) {
  return (
    <section className="flex h-full flex-col">
      <h2 className="mb-3 text-sm font-bold text-slate-800">Antrian Aktif</h2>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="Nomor / nama / NIS"
          inputMode="search"
        />
        <button onClick={onSearch} className="rounded-lg bg-slate-100 px-3 hover:bg-slate-200">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            value={tanggal}
            onChange={(e) => onTanggalChange(e.target.value)}
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-emerald-200"
            aria-label="Filter tanggal antrian"
          />
        </div>
        {tanggal && (
          <button
            type="button"
            onClick={() => onTanggalChange('')}
            className="flex w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            title="Tampilkan semua tanggal"
            aria-label="Hapus filter tanggal"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-1 text-[10px] text-slate-400">
        {tanggal ? 'Filter tanggal aktif.' : 'Menampilkan antrean aktif dari semua tanggal.'}
      </p>

      <div className="mt-3 flex-1 divide-y overflow-y-auto overflow-hidden rounded-lg border">
        {!loading && list.length === 0 && <div className="py-10 text-center text-sm text-slate-400">Belum ada antrian.</div>}
        {list.map((a) => (
          <button
            key={a.id}
            onClick={() => onPick(a.id)}
            className={cn('w-full p-3 text-left hover:bg-slate-50', selectedId === a.id && 'bg-emerald-50')}
          >
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-2xl font-extrabold leading-none text-slate-800">{nomorAntrian(a.nomor)}</p>
                <p className="mt-1 text-[10px] font-medium text-slate-400">{tanggalAntrian(a.tanggal)}</p>
              </div>
              <p className="text-sm font-bold text-emerald-700">{rupiah(a.total_tagihan)}</p>
            </div>
            <p className="text-sm font-bold text-slate-800">{a.nama_santri}</p>
            <p className="text-xs text-slate-500">
              {a.nis || '-'} - {a.marhalah_nama || '-'}
            </p>
          </button>
        ))}
      </div>
    </section>
  )
}
