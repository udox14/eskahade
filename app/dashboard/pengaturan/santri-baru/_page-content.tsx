'use client'

import { useState, useTransition } from 'react'
import { CalendarDays, Loader2, Save, Settings } from 'lucide-react'
import { toast } from 'sonner'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { simpanPengaturanSantriBaru } from './actions'

type Props = {
  mulaiBerlaku: string
  durasiBulan: number
}

export default function PengaturanSantriBaruContent({ mulaiBerlaku, durasiBulan }: Props) {
  const [mulai, setMulai] = useState(mulaiBerlaku)
  const [durasi, setDurasi] = useState(String(durasiBulan))
  const [pending, startTransition] = useTransition()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await simpanPengaturanSantriBaru({
        mulaiBerlaku: mulai,
        durasiBulan: Number(durasi),
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setMulai(result.mulaiBerlaku)
      setDurasi(String(result.durasiBulan))
      toast.success('Pengaturan santri baru disimpan')
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-20">
      <DashboardPageHeader
        title="Masa Santri Baru"
        description="Atur kapan label BARU mulai berlaku dan berapa lama santri ditandai sebagai BARU."
      />

      <form onSubmit={handleSubmit} className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Pengaturan Label BARU</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Data santri yang dibuat sebelum tanggal mulai tidak akan dianggap BARU, cocok untuk data hasil migrasi lama.
          </p>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Mulai Berlaku</span>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={mulai}
                onChange={(event) => setMulai(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Durasi</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={24}
                value={durasi}
                onChange={(event) => setDurasi(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <span className="shrink-0 text-sm font-semibold text-slate-500">bulan</span>
            </div>
          </label>
        </div>

        <div className="border-t bg-slate-50 px-5 py-4">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Pengaturan
          </button>
        </div>
      </form>
    </div>
  )
}
