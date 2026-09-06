/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { CheckCircle2, Loader2, Pencil, Plus, Search, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState, MetricCard } from '@/components/poskestren/poskestren-shell'
import { getDiagnosisMaster, saveDiagnosis } from '../pemeriksaan/clinical-actions'

const input = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

export function DiagnosisMaster() {
  const [rows, setRows] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await getDiagnosisMaster()) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal memuat diagnosis.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const visibleRows = useMemo(() => rows.filter(row => {
    const matchesSearch = !search.trim() || row.name.toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID'))
    const matchesStatus = status === 'all' || (status === 'active' ? Boolean(row.is_active) : !row.is_active)
    return matchesSearch && matchesStatus
  }), [rows, search, status])
  function resetForm() { setEditing(null); setName('') }
  function submit() {
    startTransition(async () => {
      try {
        const result = await saveDiagnosis({ id: editing?.id, name, isActive: editing ? Boolean(editing.is_active) : true })
        if (!result.success) { toast.error(result.error); return }
        toast.success(editing ? 'Diagnosis diperbarui.' : 'Diagnosis ditambahkan.')
        resetForm(); await load()
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyimpan diagnosis.') }
    })
  }
  function toggle(row: any) {
    startTransition(async () => {
      try {
        const result = await saveDiagnosis({ id: row.id, name: row.name, isActive: !row.is_active })
        if (!result.success) { toast.error(result.error); return }
        toast.success(row.is_active ? 'Diagnosis dinonaktifkan.' : 'Diagnosis diaktifkan.')
        if (editing?.id === row.id) resetForm()
        await load()
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal mengubah status diagnosis.') }
    })
  }
  const activeCount = rows.filter(row => row.is_active).length
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Total diagnosis" value={rows.length} /><MetricCard label="Diagnosis aktif" value={activeCount} /><MetricCard label="Diagnosis nonaktif" value={rows.length - activeCount} tone="slate" /></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="font-black text-slate-900">{editing ? 'Edit diagnosis' : 'Tambah diagnosis'}</h2><p className="mt-1 text-xs text-slate-500">Diagnosis aktif tersedia pada formulir pemeriksaan.</p>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); submit() }}><input required value={name} onChange={event => setName(event.target.value)} placeholder="Nama diagnosis..." className={input} /><button disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 font-bold text-white disabled:opacity-50">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editing ? 'Perbarui' : 'Simpan'}</button>{editing ? <button type="button" onClick={resetForm} className={secondary}>Batal</button> : null}</form>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="font-black text-slate-900">Daftar diagnosis</h2><p className="mt-1 text-xs text-slate-500">Nonaktifkan diagnosis yang tidak lagi digunakan tanpa menghapus riwayatnya.</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari diagnosis..." className={`${input} pl-9 sm:w-64`} /></label><select value={status} onChange={event => setStatus(event.target.value as typeof status)} className={input}><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></div></div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" /></div> : visibleRows.length ? <><div className="space-y-2 md:hidden">{visibleRows.map(row => <article key={row.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><strong className="text-sm text-slate-800">{row.name}</strong><Status active={Boolean(row.is_active)} /></div><div className="mt-3 flex gap-2"><button onClick={() => { setEditing(row); setName(row.name) }} className={`${secondary} flex-1`}><Pencil className="h-4 w-4" /> Edit</button><button disabled={pending} onClick={() => toggle(row)} className={`${secondary} flex-1`}>{row.is_active ? <XCircle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{row.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button></div></article>)}</div><div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Diagnosis</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y">{visibleRows.map(row => <tr key={row.id}><td className="px-4 py-3 font-bold">{row.name}</td><td className="px-4 py-3"><Status active={Boolean(row.is_active)} /></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><button onClick={() => { setEditing(row); setName(row.name) }} className={secondary}><Pencil className="h-4 w-4" /> Edit</button><button disabled={pending} onClick={() => toggle(row)} className={secondary}>{row.is_active ? <XCircle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{row.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button></div></td></tr>)}</tbody></table></div></> : <EmptyState title="Diagnosis tidak ditemukan" description="Ubah pencarian/filter atau tambahkan diagnosis baru." />}
    </section>
  </div>
}

function Status({ active }: { active: boolean }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{active ? 'AKTIF' : 'NONAKTIF'}</span>
}
