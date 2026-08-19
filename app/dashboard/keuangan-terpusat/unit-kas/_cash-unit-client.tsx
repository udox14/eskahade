'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle, Gear, PencilSimple, Plus, Power, UserPlus, Warning } from '@phosphor-icons/react'
import { createCashUnit, reviewCashDiscrepancy, setCashUnitActive, setCashUnitOperator, updateCashUnit } from './actions'
import { ALL_ASRAMA_LIST } from '@/lib/asrama'
import { RupiahInput } from '../_components/finance-inputs'
import {
  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS, FinanceModal, FinanceTabs, FinanceTour, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'

const TOUR: TourStep[] = [
  { target: '[data-tour="units"]', title: 'Unit Kas adalah loket fisik', body: 'Satu unit mewakili satu titik layanan dengan laci kasnya sendiri. Scope asrama unit menentukan santri mana yang boleh dilayani dari situ.' },
  { target: '[data-tour="operators"]', title: 'Tugaskan operator', body: 'Hanya akun ber-role Operator Loket yang muncul. Tanpa penugasan, operator tidak bisa membuka shift di unit ini.' },
  { target: '[data-tour="reviews"]', title: 'Review selisih kas', body: 'Shift yang ditutup dengan selisih masuk ke sini. Review mencatat bahwa bendahara sudah memeriksa — angka kasnya tidak diubah.' },
]

/** Nilai kosong berarti unit pusat yang melayani seluruh asrama. */
const ASRAMA = ['', ...ALL_ASRAMA_LIST]
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const field = FINANCE_FIELD_CLASS

export function CashUnitClient({ data }: { data: { units: any[]; operators: any[]; assignments: any[]; shifts: any[] } }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [tab, setTab] = useState<'selisih' | 'unit' | 'riwayat'>('selisih')
  const [selectedId, setSelectedId] = useState<string | null>(data.units[0]?.id || null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [result, setResult] = useState<FinanceResult | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<any>(null)
  const tour = useFinanceTour('unit-kas')
  const selected = data.units.find(unit => unit.id === selectedId)
  const assigned = useMemo(() => new Set(data.assignments.filter(row => row.cash_unit_id === selectedId && Number(row.is_active) === 1).map(row => row.operator_id)), [data.assignments, selectedId])
  const pendingReviews = data.shifts.filter(shift => shift.status === 'CLOSED_REVIEW' && !shift.supervisor_id)

  function mutate(work: () => Promise<any>, success: string) {
    startTransition(async () => {
      const outcome = await work()
      if (outcome && 'error' in outcome) {
        setResult({ tone: 'error', message: outcome.error })
        toast.error(outcome.error)
        return
      }
      setResult({ tone: 'success', message: success })
      toast.success(success)
      router.refresh()
    })
  }

  return <div className="space-y-4">
    <FinanceTour steps={TOUR} running={tour.running} onFinish={tour.finish} />
    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <FinanceTabs
      label="Kelompok pekerjaan unit kas"
      active={tab}
      onChange={id => setTab(id as typeof tab)}
      tabs={[
        { id: 'selisih', label: 'Antrean selisih', hint: 'Pekerjaan harian: review selisih kas saat shift ditutup', badge: pendingReviews.length },
        { id: 'unit', label: 'Unit & operator', hint: 'Data setup: unit kas dan penugasan operator', badge: 0 },
        { id: 'riwayat', label: 'Riwayat shift', hint: '60 shift terbaru dari seluruh unit', badge: 0 },
      ]}
    />

    {tab === 'unit' ? <>
    <SectionPanel title="Daftar Unit Kas" description="Pilih unit untuk mengubah detail dan penugasan operator." action={<button onClick={() => setShowCreate(value => !value)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white"><Plus className="h-4 w-4" />Buat Unit Kas</button>}>
      <div data-tour="units" className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">{data.units.length ? data.units.map(unit => <button key={unit.id} onClick={() => setSelectedId(unit.id)} className={`rounded-xl border p-3 text-left transition ${selectedId === unit.id ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-200' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
        <div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-slate-900">{unit.name}</strong><p className="mt-1 text-xs text-slate-500">{unit.asrama_scope || 'Pusat / semua asrama'}</p></div><StatusBadge tone={Number(unit.is_active) ? 'emerald' : 'slate'}>{Number(unit.is_active) ? 'Aktif' : 'Nonaktif'}</StatusBadge></div>
        <div className="mt-3 flex gap-3 text-[11px] text-slate-500"><span>{unit.operator_count} operator</span><span>{unit.open_shift_count} shift terbuka</span><span>{rupiah(unit.fixed_float_rupiah)}</span></div>
      </button>) : <div className="col-span-full"><EmptyState icon={Gear} title="Belum ada Unit Kas" description="Buat satu Unit Kas untuk tiap loket fisik, lalu tugaskan operatornya. Tanpa ini, loket tidak dapat dibuka." /></div>}</div>
    </SectionPanel>

    <FinanceModal
      open={showCreate}
      title="Buat Unit Kas"
      description="Satu Unit Kas mewakili satu loket fisik. Saldo tetap menjadi nilai awal saat operator membuka shift."
      size="lg"
      onClose={() => setShowCreate(false)}>
      <form className="grid gap-3 sm:grid-cols-2" action={form => mutate(() => createCashUnit({ name: String(form.get('name')), asramaScope: String(form.get('scope') || '') || null, fixedFloatRupiah: Number(form.get('float')) }), 'Unit Kas dibuat.')}>
        <label className="text-xs font-bold text-slate-700">Nama unit<input name="name" required minLength={3} placeholder="Contoh: Loket Putra" className={`mt-1.5 ${field}`} /></label>
        <label className="text-xs font-bold text-slate-700">Scope asrama<select name="scope" className={`mt-1.5 ${field}`}>{ASRAMA.map(value => <option key={value || 'pusat'} value={value}>{value || 'Pusat / semua'}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-700">Saldo kas tetap<div className="mt-1.5"><RupiahInput name="float" min={0} hint="Nilai awal yang disarankan saat operator membuka shift." /></div></label>
        <button disabled={pending} className="min-h-11 self-end rounded-lg bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">Simpan unit</button>
      </form>
    </FinanceModal>


    {selected ? <section className="grid gap-4 xl:grid-cols-2">
      <SectionPanel title="Detail Unit Kas" description="Saldo tetap menjadi nilai awal saat operator membuka shift." action={<button onClick={() => setEditingId(editingId === selected.id ? null : selected.id)} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold"><PencilSimple />Ubah</button>}>
        {editingId === selected.id ? <form className="grid gap-3 p-4" action={form => mutate(() => updateCashUnit({ id: selected.id, name: String(form.get('name')), asramaScope: String(form.get('scope') || '') || null, fixedFloatRupiah: Number(form.get('float')) }), 'Unit Kas diperbarui.')}>
          <label className="text-xs font-bold">Nama<input name="name" defaultValue={selected.name} required minLength={3} className={`mt-1.5 ${field}`} /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Scope asrama<select name="scope" defaultValue={selected.asrama_scope || ''} className={`mt-1.5 ${field}`}>{ASRAMA.map(value => <option key={value || 'pusat'} value={value}>{value || 'Pusat / semua'}</option>)}</select></label><label className="text-xs font-bold">Saldo kas tetap<div className="mt-1.5"><RupiahInput name="float" defaultValue={Number(selected.fixed_float_rupiah) || 0} min={0} /></div></label></div>
          <button disabled={pending} className="min-h-11 rounded-lg bg-emerald-700 text-sm font-bold text-white">Simpan perubahan</button>
        </form> : <div className="grid gap-3 p-4 text-sm sm:grid-cols-3"><div><span className="text-xs text-slate-500">Lokasi/scope</span><strong className="mt-1 block">{selected.asrama_scope || 'Pusat / semua'}</strong></div><div><span className="text-xs text-slate-500">Saldo tetap</span><strong className="mt-1 block tabular-nums">{rupiah(selected.fixed_float_rupiah)}</strong></div><div><span className="text-xs text-slate-500">Status</span><strong className="mt-1 block">{Number(selected.is_active) ? 'Aktif' : 'Nonaktif'}</strong></div></div>}
        <div className="border-t border-slate-100 p-4">
          <button disabled={pending} onClick={() => Number(selected.is_active) ? setConfirmDeactivate(selected) : mutate(() => setCashUnitActive(selected.id, true), 'Unit diaktifkan.')} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold ${Number(selected.is_active) ? 'border border-amber-300 bg-amber-50 text-amber-900' : 'bg-emerald-700 text-white'}`}><Power />{Number(selected.is_active) ? 'Nonaktifkan unit' : 'Aktifkan unit'}</button>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">{Number(selected.is_active) ? 'Unit nonaktif tidak dapat dipakai membuka shift baru. Riwayat dan shift yang sudah tertutup tetap tersimpan.' : 'Aktifkan kembali agar operator yang ditugaskan dapat membuka shift di unit ini.'}</p>
        </div>
      </SectionPanel>

      <SectionPanel title="Penugasan operator" description="Hanya akun dengan role Operator Loket yang dapat ditugaskan." action={<Link href="/dashboard/pengaturan/users" className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold"><UserPlus />Atur role</Link>}>
        <div data-tour="operators" className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">{data.operators.length ? data.operators.map(operator => {
          const checked = assigned.has(operator.id)
          return <label key={operator.id} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50"><div className="min-w-0"><strong className="block truncate">{operator.full_name || operator.email}</strong><span className="text-xs text-slate-500">{operator.email}{operator.asrama_binaan ? ` · ${operator.asrama_binaan}` : ''}</span></div><input type="checkbox" checked={checked} disabled={pending} onChange={event => mutate(() => setCashUnitOperator(selected.id, operator.id, event.target.checked), event.target.checked ? 'Operator ditugaskan.' : 'Penugasan dicabut.')} className="h-5 w-5 shrink-0 accent-emerald-700" /></label>
        }) : <EmptyState icon={Gear} title="Belum ada Operator Loket" description="Tambahkan role Operator Loket pada akun pengguna lebih dulu, baru tugaskan ke unit ini." action={<Link href="/dashboard/pengaturan/users" className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold">Atur role pengguna</Link>} />}</div>
      </SectionPanel>
    </section> : null}

    </> : null}

    {tab === 'selisih' ? <SectionPanel title="Antrean review selisih" description="Shift sudah tertutup; review mencatat pemeriksaan bendahara tanpa mengubah angka kas.">
      <div data-tour="reviews" className="divide-y divide-slate-100">{pendingReviews.length ? pendingReviews.map(shift => <article key={shift.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_minmax(260px,.7fr)] lg:items-center">
        <div><div className="flex flex-wrap items-center gap-2"><Warning className="h-5 w-5 text-amber-600" /><strong className="text-sm">{shift.unit_name}</strong><StatusBadge tone="amber">Selisih {rupiah(shift.discrepancy_rupiah)}</StatusBadge></div><p className="mt-1 text-xs text-slate-500">{shift.operator_name} · Ditutup {shift.closed_at}</p><p className="mt-2 text-xs text-slate-700">Catatan operator: {shift.operator_closing_note || '—'}</p></div>
        <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Seharusnya</span><strong className="block">{rupiah(shift.expected_closing_rupiah)}</strong></div><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Fisik</span><strong className="block">{rupiah(shift.actual_closing_rupiah)}</strong></div></div>
        <form className="flex gap-2" action={form => mutate(() => reviewCashDiscrepancy(shift.id, String(form.get('note'))), 'Selisih sudah direview.')}><input name="note" required minLength={5} placeholder="Catatan hasil review" className={field} /><button disabled={pending} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white"><CheckCircle />Review</button></form>
      </article>) : <EmptyState icon={CheckCircle} title="Tidak ada selisih yang menunggu review" description="Semua shift ditutup tanpa selisih, atau selisihnya sudah diperiksa bendahara." />}</div>
    </SectionPanel> : null}

    {tab === 'riwayat' ? <SectionPanel title="Riwayat shift" description="60 shift terbaru dari seluruh Unit Kas.">
      <div className="divide-y divide-slate-100 sm:hidden">{data.shifts.length ? data.shifts.map(shift => <article key={shift.id} className="space-y-2 px-4 py-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <div><strong>{shift.unit_name}</strong><p className="text-slate-500">{shift.operator_name}</p></div>
          <StatusBadge tone={shift.status === 'OPEN' ? 'emerald' : shift.status === 'CLOSED_REVIEW' && !shift.supervisor_id ? 'amber' : 'slate'}>{shift.status === 'CLOSED_REVIEW' && shift.supervisor_id ? 'REVIEWED' : shift.status}</StatusBadge>
        </div>
        <p className="text-slate-500">Dibuka {shift.opened_at}</p>
        <dl className="grid grid-cols-2 gap-1 tabular-nums">
          <dt className="text-slate-500">Kas awal</dt><dd className="text-right">{rupiah(shift.opening_cash_rupiah)}</dd>
          <dt className="text-slate-500">Pencairan</dt><dd className="text-right">{rupiah(shift.paid_rupiah)}</dd>
          <dt className="font-bold text-slate-700">Selisih</dt><dd className="text-right font-bold">{shift.discrepancy_rupiah == null ? '—' : rupiah(shift.discrepancy_rupiah)}</dd>
        </dl>
      </article>) : <EmptyState icon={CheckCircle} title="Belum ada riwayat shift" description="Riwayat muncul setelah operator membuka shift pertama di salah satu Unit Kas." />}</div>
      <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Unit / operator</th><th className="px-4 py-2.5">Dibuka</th><th className="px-4 py-2.5 text-right">Kas awal</th><th className="px-4 py-2.5 text-right">Pencairan</th><th className="px-4 py-2.5 text-right">Selisih</th><th className="px-4 py-2.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data.shifts.length ? data.shifts.map(shift => <tr key={shift.id}><td className="px-4 py-3"><strong>{shift.unit_name}</strong><span className="block text-slate-500">{shift.operator_name}</span></td><td className="px-4 py-3 text-slate-500">{shift.opened_at}</td><td className="px-4 py-3 text-right tabular-nums">{rupiah(shift.opening_cash_rupiah)}</td><td className="px-4 py-3 text-right tabular-nums">{rupiah(shift.paid_rupiah)}</td><td className="px-4 py-3 text-right font-bold tabular-nums">{shift.discrepancy_rupiah == null ? '—' : rupiah(shift.discrepancy_rupiah)}</td><td className="px-4 py-3"><StatusBadge tone={shift.status === 'OPEN' ? 'emerald' : shift.status === 'CLOSED_REVIEW' && !shift.supervisor_id ? 'amber' : 'slate'}>{shift.status === 'CLOSED_REVIEW' && shift.supervisor_id ? 'REVIEWED' : shift.status}</StatusBadge></td></tr>) : <tr><td colSpan={6}><EmptyState icon={CheckCircle} title="Belum ada riwayat shift" description="Riwayat muncul setelah operator membuka shift pertama di salah satu Unit Kas." /></td></tr>}</tbody></table></div>
    </SectionPanel> : null}

    <ConfirmAction
      open={Boolean(confirmDeactivate)}
      title={`Nonaktifkan ${confirmDeactivate?.name ?? 'unit ini'}?`}
      description="Operator tidak akan bisa membuka shift baru di unit ini sampai diaktifkan kembali."
      impact={[
        'Shift yang sedang terbuka menahan penonaktifan — tutup dulu shift-nya.',
        'Riwayat shift dan pencairan yang sudah ada tetap tersimpan.',
        'Penugasan operator tidak dihapus, hanya tidak bisa dipakai.',
      ]}
      confirmLabel="Nonaktifkan unit"
      pending={pending}
      onCancel={() => setConfirmDeactivate(null)}
      onConfirm={() => {
        const target = confirmDeactivate
        setConfirmDeactivate(null)
        mutate(() => setCashUnitActive(target.id, false), 'Unit dinonaktifkan.')
      }}
    />
  </div>
}
