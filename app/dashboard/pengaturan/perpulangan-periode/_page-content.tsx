'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  aktifkanPeriode,
  getAllPeriode,
  hapusPeriode,
  nonaktifkanPeriode,
  perpanjangTglDatang,
  tambahPeriode,
} from './actions'
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Button, TextInput, Modal } from '@mantine/core'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useConfirm } from '@/components/ui/confirm-dialog'

type PeriodeRow = {
  id: number
  nama_periode: string
  tgl_mulai_pulang: string
  tgl_selesai_pulang: string
  tgl_mulai_datang: string
  tgl_selesai_datang: string
  is_active: number
  created_at: string
}

function fmtTgl(value: string) {
  try {
    return format(new Date(value), 'dd MMM yyyy', { locale: localeId })
  } catch {
    return value
  }
}

function StatsCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: number
  tone?: 'slate' | 'emerald' | 'amber'
}) {
  const toneMap = {
    slate: 'bg-white border-slate-200 text-slate-800',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
  } as const

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneMap[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function FormTambah({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => Promise<void> | void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nama_periode: '',
    tgl_mulai_pulang: today,
    tgl_selesai_pulang: today,
    tgl_mulai_datang: today,
    tgl_selesai_datang: today,
  })

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    const res = await tambahPeriode(form)
    setLoading(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }

    toast.success('Periode berhasil ditambahkan.')
    setForm({
      nama_periode: '',
      tgl_mulai_pulang: today,
      tgl_selesai_pulang: today,
      tgl_mulai_datang: today,
      tgl_selesai_datang: today,
    })
    onClose()
    await onSuccess()
  }

  return (
    <Modal opened={open} onClose={onClose} title="Tambah Periode Baru" size="xl" centered>
      <p className="mb-4 text-sm text-slate-500">
        Atur jadwal perpulangan dan jendela kedatangan untuk satu periode aktif.
      </p>

      <div className="space-y-4">
        <TextInput
          label="Nama Periode"
          value={form.nama_periode}
          onChange={(e) => updateField('nama_periode', e.target.value)}
          placeholder="Contoh: Liburan Semester Ganjil 2026"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-bold text-amber-800">Jadwal Perpulangan</p>
            </div>
            <div className="grid gap-3">
              <TextInput
                label="Mulai"
                type="date"
                value={form.tgl_mulai_pulang}
                onChange={(e) => updateField('tgl_mulai_pulang', e.target.value)}
              />
              <TextInput
                label="Selesai"
                type="date"
                value={form.tgl_selesai_pulang}
                onChange={(e) => updateField('tgl_selesai_pulang', e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-bold text-emerald-800">Jadwal Kedatangan</p>
            </div>
            <div className="grid gap-3">
              <TextInput
                label="Mulai"
                type="date"
                value={form.tgl_mulai_datang}
                onChange={(e) => updateField('tgl_mulai_datang', e.target.value)}
              />
              <TextInput
                label="Selesai"
                type="date"
                value={form.tgl_selesai_datang}
                onChange={(e) => updateField('tgl_selesai_datang', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="default" onClick={onClose}>Batal</Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!form.nama_periode.trim()}
            color="teal"
            leftSection={!loading ? <Plus className="h-4 w-4" /> : undefined}
          >
            Simpan Periode
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function PeriodCard({
  periode,
  onRefresh,
}: {
  periode: PeriodeRow
  onRefresh: () => Promise<void> | void
}) {
  const confirm = useConfirm()
  const [loadingToggle, setLoadingToggle] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [loadingExtend, setLoadingExtend] = useState(false)
  const [showExtend, setShowExtend] = useState(false)
  const [tglBaru, setTglBaru] = useState(periode.tgl_selesai_datang)

  const handleToggle = async () => {
    const ok = await confirm(
      periode.is_active
        ? `Nonaktifkan periode "${periode.nama_periode}"?\nHalaman operasional perpulangan akan kehilangan periode aktif.`
        : `Aktifkan periode "${periode.nama_periode}"?\nPeriode aktif sebelumnya akan otomatis dinonaktifkan.`,
      {
        title: periode.is_active ? 'Nonaktifkan Periode' : 'Aktifkan Periode',
        variant: periode.is_active ? 'warning' : 'success',
        confirmLabel: periode.is_active ? 'Nonaktifkan' : 'Aktifkan',
      }
    )
    if (!ok) return

    setLoadingToggle(true)
    const res = periode.is_active
      ? await nonaktifkanPeriode(periode.id)
      : await aktifkanPeriode(periode.id)
    setLoadingToggle(false)

    if ('error' in res) {
      toast.error(res.error)
      return
    }

    toast.success(periode.is_active ? 'Periode dinonaktifkan.' : 'Periode diaktifkan.')
    await onRefresh()
  }

  const handleDelete = async () => {
    const ok = await confirm(
      `Hapus periode "${periode.nama_periode}"?\nData log perpulangan santri pada periode ini juga akan ikut dihapus.`,
      {
        title: 'Hapus Periode',
        variant: 'danger',
        confirmLabel: 'Hapus',
      }
    )
    if (!ok) return

    setLoadingDelete(true)
    const res = await hapusPeriode(periode.id)
    setLoadingDelete(false)

    if ('error' in res) {
      toast.error(res.error)
      return
    }

    toast.success('Periode dihapus.')
    await onRefresh()
  }

  const handleExtend = async () => {
    setLoadingExtend(true)
    const res = await perpanjangTglDatang(periode.id, tglBaru)
    setLoadingExtend(false)

    if ('error' in res) {
      toast.error(res.error)
      return
    }

    toast.success('Batas kedatangan diperbarui.')
    setShowExtend(false)
    await onRefresh()
  }

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white ${periode.is_active ? 'border-emerald-200' : 'border-slate-200'}`}>
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-slate-800">{periode.nama_periode}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${periode.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {periode.is_active ? 'AKTIF' : 'NONAKTIF'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Dibuat pada {fmtTgl(periode.created_at)}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleToggle}
              loading={loadingToggle}
              variant={periode.is_active ? 'default' : 'filled'}
              color={periode.is_active ? undefined : 'teal'}
              size="xs"
              leftSection={!loadingToggle ? (periode.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />) : undefined}
            >
              {periode.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>

            <Button
              onClick={() => setShowExtend((prev) => !prev)}
              variant="light"
              color="blue"
              size="xs"
              leftSection={<CalendarClock className="h-4 w-4" />}
            >
              Perpanjang Datang
            </Button>

            {!periode.is_active ? (
              <Button
                onClick={handleDelete}
                loading={loadingDelete}
                color="pink"
                variant="light"
                size="xs"
                leftSection={!loadingDelete ? <Trash2 className="h-4 w-4" /> : undefined}
              >
                Hapus
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Perpulangan</p>
            <p className="mt-2 text-sm font-semibold text-amber-900">{fmtTgl(periode.tgl_mulai_pulang)}</p>
            <p className="text-sm text-amber-700">s/d {fmtTgl(periode.tgl_selesai_pulang)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Kedatangan</p>
            <p className="mt-2 text-sm font-semibold text-emerald-900">{fmtTgl(periode.tgl_mulai_datang)}</p>
            <p className="text-sm text-emerald-700">s/d {fmtTgl(periode.tgl_selesai_datang)}</p>
          </div>
        </div>

        {showExtend ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <TextInput
                label="Selesai Kedatangan Baru"
                type="date"
                value={tglBaru}
                onChange={(e) => setTglBaru(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleExtend}
                loading={loadingExtend}
                color="blue"
                leftSection={!loadingExtend ? <CalendarClock className="h-4 w-4" /> : undefined}
                className="self-end"
              >
                Simpan
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default function PeriodePerpulanganPage() {
  const [list, setList] = useState<PeriodeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openTambah, setOpenTambah] = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await getAllPeriode()
    setList(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const activeCount = useMemo(() => list.filter((item) => item.is_active).length, [list])

  return (
    <div className="space-y-6 pb-24">
      <DashboardPageHeader
        title="Periode Perpulangan"
        description="Kelola jadwal perpulangan dan kedatangan santri. Hanya satu periode yang boleh aktif pada saat yang sama."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatsCard label="Total Periode" value={list.length} />
        <StatsCard label="Periode Aktif" value={activeCount} tone="emerald" />
        <StatsCard label="Riwayat Nonaktif" value={Math.max(list.length - activeCount, 0)} tone="amber" />
      </section>

      <div className="flex justify-end">
        <Button
          onClick={() => setOpenTambah(true)}
          color="teal"
          leftSection={<Plus className="h-4 w-4" />}
        >
          Tambah Periode
        </Button>
      </div>

      <FormTambah
        open={openTambah}
        onClose={() => setOpenTambah(false)}
        onSuccess={load}
      />

      <section className="space-y-4">
        {loading ? (
          <div className="flex justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-14 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat periode...</span>
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center text-sm text-slate-400">
            Belum ada periode perpulangan. Tambahkan periode pertama dari form di atas.
          </div>
        ) : (
          list.map((periode) => (
            <PeriodCard
              key={periode.id}
              periode={periode}
              onRefresh={load}
            />
          ))
        )}
      </section>
    </div>
  )
}
