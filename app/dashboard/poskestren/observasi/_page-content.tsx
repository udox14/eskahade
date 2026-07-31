/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Bed, Check, Loader2, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { EmptyState, MetricCard } from '@/components/poskestren/poskestren-shell'

import { getMedicineOptions } from '../pemeriksaan/actions'
import { searchHealthSantri } from '../pemeriksaan/clinical-actions'
import {
  addObservationMedicine,
  closeObservation,
  createObservation,
  getObservationDetail,
  getObservations,
} from './actions'

const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

function nowLocal() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

export default function PageContent() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [medicines, setMedicines] = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getObservations({ q, status, limit: 100 })
      setRows(result.items)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat observasi.')
    } finally {
      setLoading(false)
    }
  }, [q, status])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    void getMedicineOptions().then(setMedicines).catch(() => setMedicines([]))
  }, [])

  async function openDetail(id: string) {
    try { setDetail(await getObservationDetail(id)) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal membuka observasi.') }
  }

  const activeCount = rows.filter(row => row.status === 'ACTIVE').length
  const referredCount = rows.filter(row => row.status === 'REFERRED').length

  return (
    <div className="space-y-5 p-4 md:p-8">
      <DashboardPageHeader
        title="Observasi"
        description="Pantau pasien observasi dan riwayat pemberian obat."
        action={<button className={primary} onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Pasien observasi</button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Data tampil" value={rows.length} />
        <MetricCard label="Masih observasi" value={activeCount} tone="amber" />
        <MetricCard label="Dirujuk" value={referredCount} tone="rose" />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b bg-slate-50 p-4 md:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={event => setQ(event.target.value)} placeholder="Nama, NIS, kode pasien, asrama, gejala..." className={`${input} pl-9`} />
          </div>
          <select value={status} onChange={event => setStatus(event.target.value)} className={input}>
            <option value="">Semua status</option><option value="ACTIVE">Aktif</option><option value="RECOVERED">Sembuh</option><option value="REFERRED">Dirujuk</option>
          </select>
        </div>
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : rows.length ? (
          <>
            <div className="space-y-2 p-3 md:hidden">
              {rows.map(row => <button key={row.id} onClick={() => void openDetail(row.id)} className="w-full rounded-lg border p-3 text-left">
                <div className="flex items-start justify-between gap-2"><div><p className="font-bold">{row.nama_lengkap}</p><p className="text-[11px] text-slate-500">{row.poskestren_code} · {row.asrama || '—'} / {row.kamar || '—'}</p></div><Status value={row.status} /></div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{row.symptoms}</p>
                <p className="mt-1 text-[11px] text-slate-400">{String(row.admitted_at).slice(0,16).replace('T',' ')} · {row.medicine_count} pemberian obat</p>
              </button>)}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Pasien</th><th className="px-4 py-3">Masuk</th><th className="px-4 py-3">Gejala</th><th className="px-4 py-3 text-center">Obat</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3"><p className="font-bold">{row.nama_lengkap}</p><p className="text-xs text-slate-500">{row.poskestren_code} · {row.nis} · {row.asrama || '—'} / {row.kamar || '—'}</p></td>
                  <td className="px-4 py-3">{String(row.admitted_at).slice(0,16).replace('T',' ')}</td>
                  <td className="max-w-md px-4 py-3 text-slate-600">{row.symptoms}</td>
                  <td className="px-4 py-3 text-center font-bold">{row.medicine_count}</td><td className="px-4 py-3"><Status value={row.status} /></td>
                  <td className="px-4 py-3 text-right"><button className={secondary} onClick={() => void openDetail(row.id)}>Buka</button></td>
                </tr>)}</tbody>
              </table>
            </div>
          </>
        ) : <EmptyState title="Belum ada observasi" description="Tambahkan pasien yang perlu dipantau di ruang observasi." />}
      </section>

      {showCreate ? <CreateModal pending={pending} onClose={() => setShowCreate(false)} onSave={(data: any) => startTransition(async () => {
        try {
          const result = await createObservation(data)
          if (!result.success) { toast.error(result.error); return }
          toast.success('Pasien masuk observasi.')
          setShowCreate(false)
          await load()
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyimpan observasi.') }
      })} /> : null}

      {detail ? <DetailModal detail={detail} medicines={medicines} pending={pending} onClose={() => setDetail(null)} onReload={async () => setDetail(await getObservationDetail(detail.observation.id))} onChanged={load} startTransition={startTransition} /> : null}
    </div>
  )
}

function Status({ value }: { value: string }) {
  const cls = value === 'ACTIVE' ? 'bg-amber-100 text-amber-800' : value === 'REFERRED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black ${cls}`}>{value}</span>
}

function CreateModal({ pending, onClose, onSave }: any) {
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  useEffect(() => {
    if (search.trim().length < 2 || selected) return
    const timer = setTimeout(() => void searchHealthSantri(search).then(setOptions), 250)
    return () => clearTimeout(timer)
  }, [search, selected])
  return <Modal title="Pasien Observasi Baru" onClose={onClose}><form className="space-y-4" onSubmit={event => {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    onSave({ santriId: selected?.id, admittedAt: f.get('admittedAt'), symptoms: f.get('symptoms'), notes: f.get('notes') })
  }}>
    <label className="block text-xs font-bold text-slate-600">Cari santri<input value={search} onChange={event => { setSearch(event.target.value); setSelected(null); setOptions([]) }} className={`${input} mt-1`} placeholder="Nama, NIS, kode pasien..." /></label>
    {options.length ? <div className="max-h-44 overflow-y-auto rounded-lg border">{options.map(row => <button type="button" key={row.id} onClick={() => { setSelected(row); setSearch(row.nama_lengkap) }} className="block w-full border-b p-3 text-left text-sm hover:bg-emerald-50"><strong>{row.nama_lengkap}</strong><small className="block text-slate-500">{row.poskestren_code} · {row.asrama || '—'} / {row.kamar || '—'}</small></button>)}</div> : null}
    <label className="block text-xs font-bold text-slate-600">Tanggal masuk<input required type="datetime-local" name="admittedAt" defaultValue={nowLocal()} className={`${input} mt-1`} /></label>
    <label className="block text-xs font-bold text-slate-600">Gejala<textarea required name="symptoms" className={`${input} mt-1 min-h-24`} /></label>
    <label className="block text-xs font-bold text-slate-600">Catatan<textarea name="notes" className={`${input} mt-1 min-h-20`} /></label>
    <button disabled={pending || !selected} className={`${primary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bed className="h-4 w-4" />} Mulai observasi</button>
  </form></Modal>
}

function DetailModal({ detail, medicines, pending, onClose, onReload, onChanged, startTransition }: any) {
  const [sourceType, setSourceType] = useState<'STOCK'|'EXTERNAL'>('STOCK')
  const observation = detail.observation
  return <Modal title={`${observation.nama_lengkap} · ${observation.poskestren_code}`} onClose={onClose} wide>
    <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3"><p><b>Asrama:</b><br />{observation.asrama || '—'} / {observation.kamar || '—'}</p><p><b>Masuk:</b><br />{String(observation.admitted_at).slice(0,16).replace('T',' ')}</p><p><b>Status:</b><br /><Status value={observation.status} /></p></div>
    <div><p className="text-xs font-bold uppercase text-slate-400">Gejala</p><p className="mt-1 text-sm">{observation.symptoms}</p></div>
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-slate-50 px-3 py-2 font-bold">Riwayat Pemberian Obat</div>
      {detail.medicines.length ? <div className="divide-y">{detail.medicines.map((row: any) => <div key={row.id} className="p-3 text-sm"><div className="flex justify-between gap-3"><b>{row.medicine_name}</b><span className="text-xs text-slate-400">{String(row.administered_at).slice(0,16).replace('T',' ')}</span></div><p className="text-xs text-slate-500">{row.source_type === 'STOCK' ? `${row.quantity_base} unit stok` : 'Obat eksternal'} · {row.dosage || 'tanpa dosis'} · {row.created_by_name || '—'}</p></div>)}</div> : <p className="p-4 text-center text-sm text-slate-400">Belum ada pemberian obat.</p>}
    </div>
    {observation.status === 'ACTIVE' ? <>
      <form className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2" onSubmit={event => {
        event.preventDefault(); const f = new FormData(event.currentTarget)
        startTransition(async () => {
          const result = await addObservationMedicine({ observationId: observation.id, administeredAt: String(f.get('administeredAt')), medicine: { sourceType, medicineId: String(f.get('medicineId') || ''), medicineName: String(f.get('medicineName') || ''), quantityBase: Number(f.get('quantity') || 0), dosage: String(f.get('dosage') || '') } })
          if (!result.success) { toast.error(result.error); return }; toast.success('Pemberian obat dicatat.'); await onReload(); await onChanged()
        })
      }}>
        <select value={sourceType} onChange={event => setSourceType(event.target.value as any)} className={input}><option value="STOCK">Stok POSKESTREN</option><option value="EXTERNAL">Obat eksternal</option></select>
        <input required type="datetime-local" name="administeredAt" defaultValue={nowLocal()} className={input} />
        {sourceType === 'STOCK' ? <><select required name="medicineId" className={input}><option value="">Pilih obat</option>{medicines.map((row: any) => <option key={row.id} value={row.id}>{row.name} · stok {row.total_stock_base} {row.base_unit}</option>)}</select><input required min={1} type="number" name="quantity" placeholder="Jumlah" className={input} /></> : <input required name="medicineName" placeholder="Nama obat dari luar" className={`${input} sm:col-span-2`} />}
        <input name="dosage" placeholder="Dosis/aturan pakai" className={input} />
        <button disabled={pending} className={primary}><Plus className="h-4 w-4" /> Catat obat</button>
      </form>
      <form className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 sm:grid-cols-2" onSubmit={event => {
        event.preventDefault(); const f = new FormData(event.currentTarget)
        startTransition(async () => {
          const result = await closeObservation({ observationId: observation.id, dischargedAt: String(f.get('dischargedAt')), result: String(f.get('result')) as any, referralDestination: String(f.get('referralDestination') || '') })
          if (!result.success) { toast.error(result.error); return }; toast.success('Observasi diselesaikan.'); await onReload(); await onChanged()
        })
      }}>
        <input required type="datetime-local" name="dischargedAt" defaultValue={nowLocal()} className={input} />
        <select required name="result" className={input}><option value="RECOVERED">SEMBUH</option><option value="REFERRED">DIRUJUK</option></select>
        <input name="referralDestination" placeholder="Tujuan rujukan jika dirujuk" className={input} />
        <button disabled={pending} className={primary}><Check className="h-4 w-4" /> Selesaikan observasi</button>
      </form>
    </> : null}
  </Modal>
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"><div className={`max-h-[94vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-xl sm:rounded-xl ${wide ? 'max-w-4xl' : 'max-w-xl'}`}><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-slate-50 px-5 py-4"><h2 className="font-bold">{title}</h2><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-200"><X className="h-4 w-4" /></button></div><div className="space-y-4 p-5">{children}</div></div></div>
}

