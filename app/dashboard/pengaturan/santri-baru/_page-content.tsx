'use client'

import { useState, useTransition } from 'react'
import { CalendarDays, Save, Settings } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button, TextInput, NumberInput } from '@mantine/core'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { simpanPengaturanSantriBaru } from './actions'

type Props = {
  mulaiBerlaku: string
  durasiBulan: number
}

export default function PengaturanSantriBaruContent({ mulaiBerlaku, durasiBulan }: Props) {
  const [mulai, setMulai] = useState(mulaiBerlaku)
  const [durasi, setDurasi] = useState(durasiBulan)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await simpanPengaturanSantriBaru({
        mulaiBerlaku: mulai,
        durasiBulan: durasi,
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setMulai(result.mulaiBerlaku)
      setDurasi(result.durasiBulan)
      toast.success('Pengaturan santri baru disimpan')
    })
  }

  return (
    <div className="space-y-5 pb-20">
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
          <TextInput
            label="Mulai Berlaku"
            type="date"
            value={mulai}
            onChange={e => setMulai(e.target.value)}
            leftSection={<CalendarDays className="h-4 w-4" />}
            required
          />
          <NumberInput
            label="Durasi"
            value={durasi}
            onChange={v => setDurasi(Number(v))}
            min={1}
            max={24}
            suffix=" bulan"
            required
          />
        </div>

        <div className="border-t bg-slate-50 px-5 py-4">
          <Button type="submit" loading={pending} color="indigo" leftSection={!pending ? <Save className="h-4 w-4" /> : undefined}>
            Simpan Pengaturan
          </Button>
        </div>
      </form>
    </div>
  )
}
