'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle, Gear, PencilSimple, Plus, Power, UserPlus, Warning } from '@phosphor-icons/react'
import { createCashUnit, reviewCashDiscrepancy, setCashUnitActive, setCashUnitOperator, updateCashUnit } from './actions'
import { SectionPanel, StatusBadge } from '../_components/finance-ui'

const ASRAMA = ['', 'AL-FALAH', 'AS-SALAM', 'BAHAGIA', 'ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4', 'AL-BAGHORY']
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const field = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500'

export function CashUnitClient({ data }: { data: { units: any[]; operators: any[]; assignments: any[]; shifts: any[] } }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(data.units.length === 0)
  const [selectedId, setSelectedId] = useState<string | null>(data.units[0]?.id || null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const selected = data.units.find(unit => unit.id === selectedId)
  const assigned = useMemo(() => new Set(data.assignments.filter(row => row.cash_unit_id === selectedId && Number(row.is_active) === 1).map(row => row.operator_id)), [data.assignments, selectedId])
  const pendingReviews = data.shifts.filter(shift => shift.status === 'CLOSED_REVIEW' && !shift.supervisor_id)

  function mutate(work: () => Promise<any>, success: string) {
    startTransition(async () => {
      const result = await work()
      if (result && 'error' in result) { toast.error(result.error); return }
      toast.success(success)
      router.refresh()
    })
  }

  return <div className="space-y-4">
    <SectionPanel title="Daftar Unit Kas" description="Pilih unit untuk mengubah detail dan penugasan operator." action={<button onClick={() => setShowCreate(value => !value)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white"><Plus className="h-4 w-4" />Buat Unit Kas</button>}>
      {showCreate ? <form className="grid gap-3 border-b border-slate-100 bg-emerald-50/40 p-4 md:grid-cols-[1fr_180px_220px_auto]" action={form => mutate(() => createCashUnit({ name: String(form.get('name')), asramaScope: String(form.get('scope') || '') || null, fixedFloatRupiah: Number(form.get('float')) }), 'Unit Kas dibuat.')}>
        <label className="text-xs font-bold text-slate-700">Nama unit<input name="name" required minLength={3} placeholder="Contoh: Loket Putra" className={`mt-1.5 ${field}`} /></label>
        <label className="text-xs font-bold text-slate-700">Scope asrama<select name="scope" className={`mt-1.5 ${field}`}>{ASRAMA.map(value => <option key={value || 'pusat'} value={value}>{value || 'Pusat / semua'}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-700">Saldo kas tetap<input name="float" required type="number" min={0} defaultValue={0} className={`mt-1.5 ${field} tabular-nums`} /></label>
        <button disabled={pending} className="min-h-11 self-end rounded-lg bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">Simpan unit</button>
      </form> : null}
      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">{data.units.length ? data.units.map(unit => <button key={unit.id} onClick={() => setSelectedId(unit.id)} className={`rounded-xl border p-3 text-left transition ${selectedId === unit.id ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-200' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
        <div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-slate-900">{unit.name}</strong><p className="mt-1 text-xs text-slate-500">{unit.asrama_scope || 'Pusat / semua asrama'}</p></div><StatusBadge tone={Number(unit.is_active) ? 'emerald' : 'slate'}>{Number(unit.is_active) ? 'Aktif' : 'Nonaktif'}</StatusBadge></div>
        <div className="mt-3 flex gap-3 text-[11px] text-slate-500"><span>{unit.operator_count} operator</span><span>{unit.open_shift_count} shift terbuka</span><span>{rupiah(unit.fixed_float_rupiah)}</span></div>
      </button>) : <div className="col-span-full py-10 text-center text-sm text-slate-500">Belum ada Unit Kas. Gunakan tombol “Buat Unit Kas” untuk memulai.</div>}</div>
    </SectionPanel>

    {selected ? <section className="grid gap-4 xl:grid-cols-2">
      <SectionPanel title="Detail Unit Kas" description="Saldo tetap menjadi nilai awal saat operator membuka shift." action={<button onClick={() => setEditingId(editingId === selected.id ? null : selected.id)} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold"><PencilSimple />Ubah</button>}>
        {editingId === selected.id ? <form className="grid gap-3 p-4" action={form => mutate(() => updateCashUnit({ id: selected.id, name: String(form.get('name')), asramaScope: String(form.get('scope') || '') || null, fixedFloatRupiah: Number(form.get('float')) }), 'Unit Kas diperbarui.')}>
          <label className="text-xs font-bold">Nama<input name="name" defaultValue={selected.name} required minLength={3} className={`mt-1.5 ${field}`} /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Scope asrama<select name="scope" defaultValue={selected.asrama_scope || ''} className={`mt-1.5 ${field}`}>{ASRAMA.map(value => <option key={value || 'pusat'} value={value}>{value || 'Pusat / semua'}</option>)}</select></label><label className="text-xs font-bold">Saldo kas tetap<input name="float" defaultValue={selected.fixed_float_rupiah} type="number" min={0} required className={`mt-1.5 ${field}`} /></label></div>
          <button disabled={pending} className="min-h-11 rounded-lg bg-emerald-700 text-sm font-bold text-white">Simpan perubahan</button>
        </form> : <div className="grid gap-3 p-4 text-sm sm:grid-cols-3"><div><span className="text-xs text-slate-500">Lokasi/scope</span><strong className="mt-1 block">{selected.asrama_scope || 'Pusat / semua'}</strong></div><div><span className="text-xs text-slate-500">Saldo tetap</span><strong className="mt-1 block tabular-nums">{rupiah(selected.fixed_float_rupiah)}</strong></div><div><span className="text-xs text-slate-500">Status</span><strong className="mt-1 block">{Number(selected.is_active) ? 'Aktif' : 'Nonaktif'}</strong></div></div>}
        <div className="border-t border-slate-100 p-4"><button disabled={pending} onClick={() => mutate(() => setCashUnitActive(selected.id, !Number(selected.is_active)), Number(selected.is_active) ? 'Unit dinonaktifkan.' : 'Unit diaktifkan.')} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold ${Number(selected.is_active) ? 'border border-amber-300 bg-amber-50 text-amber-900' : 'bg-emerald-700 text-white'}`}><Power />{Number(selected.is_active) ? 'Nonaktifkan unit' : 'Aktifkan unit'}</button></div>
      </SectionPanel>

      <SectionPanel title="Penugasan operator" description="Hanya akun dengan role Operator Loket yang dapat ditugaskan." action={<Link href="/dashboard/pengaturan/users" className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold"><UserPlus />Atur role</Link>}>
        <div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">{data.operators.length ? data.operators.map(operator => {
          const checked = assigned.has(operator.id)
          return <label key={operator.id} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50"><div className="min-w-0"><strong className="block truncate">{operator.full_name || operator.email}</strong><span className="text-xs text-slate-500">{operator.email}{operator.asrama_binaan ? ` · ${operator.asrama_binaan}` : ''}</span></div><input type="checkbox" checked={checked} disabled={pending} onChange={event => mutate(() => setCashUnitOperator(selected.id, operator.id, event.target.checked), event.target.checked ? 'Operator ditugaskan.' : 'Penugasan dicabut.')} className="h-5 w-5 shrink-0 accent-emerald-700" /></label>
        }) : <div className="p-8 text-center text-sm text-slate-500"><Gear className="mx-auto mb-2 h-7 w-7 text-slate-300" />Belum ada akun dengan role Operator Loket.</div>}</div>
      </SectionPanel>
    </section> : null}

    <SectionPanel title="Antrean review selisih" description="Shift sudah tertutup; review mencatat pemeriksaan bendahara tanpa mengubah angka kas.">
      <div className="divide-y divide-slate-100">{pendingReviews.length ? pendingReviews.map(shift => <article key={shift.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_minmax(260px,.7fr)] lg:items-center">
        <div><div className="flex flex-wrap items-center gap-2"><Warning className="h-5 w-5 text-amber-600" /><strong className="text-sm">{shift.unit_name}</strong><StatusBadge tone="amber">Selisih {rupiah(shift.discrepancy_rupiah)}</StatusBadge></div><p className="mt-1 text-xs text-slate-500">{shift.operator_name} · Ditutup {shift.closed_at}</p><p className="mt-2 text-xs text-slate-700">Catatan operator: {shift.operator_closing_note || '—'}</p></div>
        <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Seharusnya</span><strong className="block">{rupiah(shift.expected_closing_rupiah)}</strong></div><div className="rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Fisik</span><strong className="block">{rupiah(shift.actual_closing_rupiah)}</strong></div></div>
        <form className="flex gap-2" action={form => mutate(() => reviewCashDiscrepancy(shift.id, String(form.get('note'))), 'Selisih sudah direview.')}><input name="note" required minLength={5} placeholder="Catatan hasil review" className={field} /><button disabled={pending} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white"><CheckCircle />Review</button></form>
      </article>) : <div className="p-10 text-center text-sm text-slate-500"><CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-500" />Tidak ada selisih yang menunggu review.</div>}</div>
    </SectionPanel>

    <SectionPanel title="Riwayat shift" description="60 shift terbaru dari seluruh Unit Kas.">
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Unit / operator</th><th className="px-4 py-2.5">Dibuka</th><th className="px-4 py-2.5 text-right">Kas awal</th><th className="px-4 py-2.5 text-right">Pencairan</th><th className="px-4 py-2.5 text-right">Selisih</th><th className="px-4 py-2.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data.shifts.length ? data.shifts.map(shift => <tr key={shift.id}><td className="px-4 py-3"><strong>{shift.unit_name}</strong><span className="block text-slate-500">{shift.operator_name}</span></td><td className="px-4 py-3 text-slate-500">{shift.opened_at}</td><td className="px-4 py-3 text-right tabular-nums">{rupiah(shift.opening_cash_rupiah)}</td><td className="px-4 py-3 text-right tabular-nums">{rupiah(shift.paid_rupiah)}</td><td className="px-4 py-3 text-right font-bold tabular-nums">{shift.discrepancy_rupiah == null ? '—' : rupiah(shift.discrepancy_rupiah)}</td><td className="px-4 py-3"><StatusBadge tone={shift.status === 'OPEN' ? 'emerald' : shift.status === 'CLOSED_REVIEW' && !shift.supervisor_id ? 'amber' : 'slate'}>{shift.status === 'CLOSED_REVIEW' && shift.supervisor_id ? 'REVIEWED' : shift.status}</StatusBadge></td></tr>) : <tr><td colSpan={6} className="p-10 text-center text-slate-500">Belum ada riwayat shift.</td></tr>}</tbody></table></div>
    </SectionPanel>
  </div>
}
