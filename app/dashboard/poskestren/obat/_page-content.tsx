/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Boxes, ClipboardPlus, Loader2, Package, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { EmptyState, MetricCard, PoskestrenTabs } from '@/components/poskestren/poskestren-shell'
import { toWibDateInputValue } from '@/lib/date/wib'
import type { PoskestrenPageSize } from '@/lib/poskestren/types'

import {
  createManualStockMovement,
  createPurchase,
  deleteMedicine,
  getMedicineCatalog,
  getMedicineMasterOptions,
  getPurchases,
  getStockMovements,
  postPurchasePayment,
  receivePurchase,
  saveMedicine,
  saveSupplier,
  saveUnitConversion,
} from './actions'

type Tab = 'katalog' | 'belanja' | 'pengeluaran'
const TABS = [
  { value: 'katalog' as const, label: 'Katalog & Stok', icon: Package },
  { value: 'belanja' as const, label: 'Belanja', icon: ShoppingCart },
  { value: 'pengeluaran' as const, label: 'Pengeluaran Obat', icon: ClipboardPlus },
]
const inputClass = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

function rupiah(value: number | string | null | undefined) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">{label}</span>{children}</label>
}

function PageSize({ value, setValue, filtered }: { value: PoskestrenPageSize; setValue: (v: PoskestrenPageSize) => void; filtered: boolean }) {
  return (
    <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" value={value}
      onChange={e => setValue(e.target.value === 'all' ? 'all' : Number(e.target.value) as 20 | 50 | 100)}>
      <option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
      <option value="all" disabled={!filtered}>Semua (maks. 1.000)</option>
    </select>
  )
}

export default function PoskestrenObatContent() {
  const params = useSearchParams()
  const router = useRouter()
  const candidate = params.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(TABS.some(item => item.value === candidate) ? candidate! : 'katalog')
  function changeTab(next: Tab) {
    setTab(next)
    const nextParams = new URLSearchParams(params.toString())
    nextParams.set('tab', next)
    router.replace(`/dashboard/poskestren/obat?${nextParams}`, { scroll: false })
  }
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-24">
      <DashboardPageHeader title="Obat" description="Katalog, batch, pembelian, serta kartu stok yang terlacak per referensi." className="border-b pb-4" />
      <PoskestrenTabs tabs={TABS} active={tab} onChange={changeTab} />
      {tab === 'katalog' ? <CatalogTab /> : null}
      {tab === 'belanja' ? <PurchaseTab /> : null}
      {tab === 'pengeluaran' ? <MovementTab /> : null}
    </div>
  )
}

function CatalogTab() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('active')
  const [limit, setLimit] = useState<PoskestrenPageSize>(20)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [truncated, setTruncated] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [conversion, setConversion] = useState<any>(null)
  const [confirmDelete, setConfirmDelete] = useState<any>(null)
  const [pending, startTransition] = useTransition()
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getMedicineCatalog({ q, status, limit })
      setRows(result.items)
      setTruncated(Boolean(result.truncated))
    }
    finally { setLoading(false) }
  }, [q, status, limit])
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer) }, [load])
  const total = rows.reduce((sum, row) => sum + Number(row.total_stock_base), 0)
  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Obat tampil" value={rows.length} />
        <MetricCard label="Total unit dasar" value={total.toLocaleString('id-ID')} tone="blue" />
        <MetricCard label="Stok kritis" value={rows.filter(row => Number(row.total_stock_base) <= Number(row.minimum_stock_base)).length} tone="amber" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className={`${inputClass} pl-9`} value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama, generik, kategori, bentuk..." /></div>
          <select className={inputClass} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="active">Aktif</option><option value="low">Stok kritis</option><option value="empty">Kosong</option><option value="inactive">Nonaktif</option>
          </select>
          <PageSize value={limit} setValue={setLimit} filtered={Boolean(q || status)} />
          <button className={primary} onClick={() => setEditing({})}><Plus className="h-4 w-4" /> Tambah obat</button>
        </div>
      </div>
      {truncated ? <LimitNotice /> : null}
      {loading ? <Loading /> : rows.length === 0 ? <EmptyState title="Belum ada obat" description="Tambah katalog obat atau ubah filter pencarian." /> : (
        <>
          <div className="space-y-2 md:hidden">
            {rows.map(row => <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-black">{row.name}</h3><p className="truncate text-[11px] text-slate-500">{[row.generic_name, row.form, row.strength].filter(Boolean).join(' · ') || 'Tanpa detail'}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${Number(row.total_stock_base) <= Number(row.minimum_stock_base) ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{row.total_stock_base} {row.base_unit}</span></div>
              <p className="mt-2 text-[11px] text-slate-500">Min. {row.minimum_stock_base} · {row.active_batch_count} batch · ED {row.nearest_expiry || '—'}</p>
              <div className="mt-2 flex gap-2"><button className={secondary} onClick={() => setEditing(row)}>Edit</button><button className={secondary} onClick={() => setConversion(row)}>Konversi</button><button className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50" onClick={() => setConfirmDelete(row)}><Trash2 className="h-3.5 w-3.5" />Hapus</button></div>
            </article>)}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3 font-bold">Obat</th><th className="px-4 py-3 font-bold">Kategori/Bentuk</th><th className="px-4 py-3 text-right font-bold">Stok</th><th className="px-4 py-3 text-right font-bold">Minimum</th><th className="px-4 py-3 text-center font-bold">Batch</th><th className="px-4 py-3 font-bold">ED terdekat</th><th className="px-4 py-3 font-bold">Konversi</th><th className="px-4 py-3 text-right font-bold">Aksi</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3"><p className="font-bold">{row.name}</p><p className="text-xs text-slate-500">{row.generic_name || '—'}{row.strength ? ` · ${row.strength}` : ''}</p></td>
                <td className="px-4 py-3 text-slate-600">{[row.category, row.form].filter(Boolean).join(' · ') || '—'}</td>
                <td className={`px-4 py-3 text-right font-black ${Number(row.total_stock_base) <= Number(row.minimum_stock_base) ? 'text-amber-700' : 'text-emerald-700'}`}>{Number(row.total_stock_base).toLocaleString('id-ID')} {row.base_unit}</td>
                <td className="px-4 py-3 text-right">{row.minimum_stock_base} {row.base_unit}</td><td className="px-4 py-3 text-center">{row.active_batch_count}</td><td className="px-4 py-3">{row.nearest_expiry || '—'}</td><td className="max-w-xs px-4 py-3 text-xs text-slate-600">{row.conversions || '—'}</td>
                <td className="px-4 py-3"><div className="flex justify-end gap-2"><button className={secondary} onClick={() => setEditing(row)}>Edit</button><button className={secondary} onClick={() => setConversion(row)}>Konversi</button><button className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50" onClick={() => setConfirmDelete(row)}><Trash2 className="h-4 w-4" /> Hapus</button></div></td>
              </tr>)}</tbody>
            </table>
          </div>
        </>)}
      {editing ? <MedicineModal medicine={editing} pending={pending} onClose={() => setEditing(null)} onSave={(data: any) => startTransition(async () => {
        try { const result = await saveMedicine(data); if (!result.success) { toast.error(result.error); return }; toast.success('Katalog obat disimpan.'); setEditing(null); await load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.') }
      })} /> : null}
      {conversion ? <ConversionModal medicine={conversion} pending={pending} onClose={() => setConversion(null)} onSave={(data: any) => startTransition(async () => {
        try { const result = await saveUnitConversion(data); if (!result.success) { toast.error(result.error); return }; toast.success('Konversi disimpan.'); setConversion(null); await load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.') }
      })} /> : null}
      {confirmDelete ? <ConfirmDeleteModal title={`Hapus obat "${confirmDelete.name}"?`} description={`Seluruh data batch dan konversi satuan akan dihapus permanen. Obat hanya dapat dihapus jika stok sudah nol. Aksi ini tidak dapat dibatalkan.`} pending={pending} onClose={() => setConfirmDelete(null)} onConfirm={() => startTransition(async () => { try { const result = await deleteMedicine(confirmDelete.id); if (!result.success) { toast.error(result.error); return }; toast.success('Obat berhasil dihapus.'); setConfirmDelete(null); await load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menghapus obat.') } })} /> : null}
    </section>
  )
}

function MedicineModal({ medicine, pending, onClose, onSave }: any) {
  return <Modal title={medicine.id ? 'Edit obat' : 'Tambah obat'} onClose={onClose}><form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ id: medicine.id, name: f.get('name'), genericName: f.get('generic'), category: f.get('category'), form: f.get('form'), strength: f.get('strength'), baseUnit: f.get('unit'), minimumStockBase: Number(f.get('minimum')), notes: f.get('notes'), isActive: f.get('active') === 'on' }) }}>
    <Field label="Nama obat *"><input name="name" className={inputClass} defaultValue={medicine.name} required /></Field>
    <Field label="Nama generik"><input name="generic" className={inputClass} defaultValue={medicine.generic_name} /></Field>
    <Field label="Kategori"><input name="category" className={inputClass} defaultValue={medicine.category} /></Field>
    <Field label="Bentuk"><input name="form" className={inputClass} defaultValue={medicine.form} placeholder="Tablet, sirup..." /></Field>
    <Field label="Kekuatan"><input name="strength" className={inputClass} defaultValue={medicine.strength} placeholder="500 mg" /></Field>
    <Field label="Satuan dasar *"><input name="unit" className={inputClass} defaultValue={medicine.base_unit || 'tablet'} required /></Field>
    <Field label="Stok minimum"><input name="minimum" type="number" min="0" className={inputClass} defaultValue={medicine.minimum_stock_base || 0} /></Field>
    <label className="flex items-center gap-2 pt-7 text-sm font-bold"><input name="active" type="checkbox" defaultChecked={medicine.is_active !== 0} /> Aktif</label>
    <div className="sm:col-span-2"><Field label="Catatan"><textarea name="notes" className={inputClass} defaultValue={medicine.notes} /></Field></div>
    <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className={secondary} onClick={onClose}>Batal</button><button className={primary} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan</button></div>
  </form></Modal>
}

function ConversionModal({ medicine, pending, onClose, onSave }: any) {
  return <Modal title={`Konversi ${medicine.name}`} onClose={onClose}><form className="space-y-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ medicineId: medicine.id, unitName: f.get('unit'), factorToBase: Number(f.get('factor')) }) }}>
    <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">Tetapkan berapa <strong>{medicine.base_unit}</strong> dalam satu kemasan.</p>
    <Field label="Nama kemasan"><input name="unit" className={inputClass} placeholder="strip / box / botol" required /></Field>
    <Field label={`Isi dalam ${medicine.base_unit}`}><input name="factor" type="number" min="1" className={inputClass} required /></Field>
    <div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={onClose}>Batal</button><button className={primary} disabled={pending}>Simpan</button></div>
  </form></Modal>
}

function PurchaseTab() {
  const [rows, setRows] = useState<any[]>([])
  const [masters, setMasters] = useState<any>({ medicines: [], suppliers: [], accounts: [] })
  const [filter, setFilter] = useState({ q: '', status: '', from: '', to: '', limit: 20 as PoskestrenPageSize })
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [show, setShow] = useState(false)
  const [pending, startTransition] = useTransition()
  const load = useCallback(async (cursor = '', append = false) => {
    const [purchases, options] = await Promise.all([getPurchases({ ...filter, cursor }), getMedicineMasterOptions()])
    setRows(previous => append ? [...previous, ...purchases.items] : purchases.items)
    setNextCursor(purchases.nextCursor || null)
    setHasMore(purchases.hasMore)
    setTruncated(Boolean(purchases.truncated))
    setMasters(options)
  }, [filter])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])
  const act = (promise: Promise<any>, success: string) => startTransition(async () => {
    try { const result = await promise; if (!result.success) { toast.error(result.error); return }; toast.success(success); await load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Aksi gagal.') }
  })
  return <section className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="grid gap-3 md:grid-cols-7">
        <input className={`${inputClass} md:col-span-2`} value={filter.q} onChange={e => setFilter(v => ({ ...v, q: e.target.value }))} placeholder="Cari supplier atau obat..." />
        <input type="date" className={inputClass} value={filter.from} onChange={e => setFilter(v => ({ ...v, from: e.target.value }))} />
        <input type="date" className={inputClass} value={filter.to} onChange={e => setFilter(v => ({ ...v, to: e.target.value }))} />
        <select className={inputClass} value={filter.status} onChange={e => setFilter(v => ({ ...v, status: e.target.value }))}><option value="">Semua status</option><option>DRAFT</option><option>RECEIVED</option><option>UNPOSTED</option><option>POSTED</option></select>
        <PageSize value={filter.limit} setValue={limit => setFilter(v => ({ ...v, limit }))} filtered={Boolean(filter.q || filter.status || filter.from || filter.to)} />
        <button className={primary} onClick={() => setShow(true)}><Plus className="h-4 w-4" /> Draft belanja</button>
      </div>
    </div>
    {truncated ? <LimitNotice /> : null}
    {rows.length === 0 ? <EmptyState title="Belum ada pembelian" description="Buat draft pembelian untuk mencatat penerimaan batch obat." /> : <>
      <div className="space-y-2 md:hidden">{rows.map(row => <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex justify-between gap-2"><div className="min-w-0"><p className="text-[10px] font-bold text-slate-400">{row.purchase_date}</p><h3 className="truncate text-sm font-black">{row.supplier_name}</h3><p className="truncate text-[11px] text-slate-500">{row.item_summary}</p></div><div className="shrink-0 text-right"><p className="text-sm font-black text-emerald-700">{rupiah(row.total_rupiah)}</p><p className="text-[10px] font-bold text-slate-500">{row.status} · {row.payment_status}</p></div></div><div className="mt-2 flex flex-wrap gap-2">{row.status === 'DRAFT' ? <button className={primary} disabled={pending} onClick={() => act(receivePurchase(row.id), 'Pembelian diterima dan stok bertambah.')}>Terima</button> : null}{row.status === 'RECEIVED' && row.payment_status === 'UNPOSTED' ? masters.accounts.map((account: any) => <button key={account.id} className={secondary} disabled={pending} onClick={() => act(postPurchasePayment({ purchaseId: row.id, accountId: account.id }), `Pembayaran diposting dari ${account.name}.`)}>Bayar {account.name}</button>) : null}</div></article>)}</div>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3 font-bold">Tanggal</th><th className="px-4 py-3 font-bold">Supplier</th><th className="px-4 py-3 font-bold">Item</th><th className="px-4 py-3 text-center font-bold">Jumlah item</th><th className="px-4 py-3 text-right font-bold">Total</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 text-right font-bold">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.id} className="hover:bg-slate-50/70"><td className="px-4 py-3">{row.purchase_date}</td><td className="px-4 py-3 font-bold">{row.supplier_name}</td><td className="max-w-sm px-4 py-3 text-xs text-slate-600">{row.item_summary}</td><td className="px-4 py-3 text-center">{row.item_count}</td><td className="px-4 py-3 text-right font-black text-emerald-700">{rupiah(row.total_rupiah)}</td><td className="px-4 py-3 text-xs font-bold">{row.status} · {row.payment_status}</td><td className="px-4 py-3"><div className="flex justify-end gap-2">{row.status === 'DRAFT' ? <button className={primary} disabled={pending} onClick={() => act(receivePurchase(row.id), 'Pembelian diterima dan stok bertambah.')}>Terima</button> : null}{row.status === 'RECEIVED' && row.payment_status === 'UNPOSTED' ? masters.accounts.map((account: any) => <button key={account.id} className={secondary} disabled={pending} onClick={() => act(postPurchasePayment({ purchaseId: row.id, accountId: account.id }), `Pembayaran diposting dari ${account.name}.`)}>Bayar {account.name}</button>) : null}</div></td></tr>)}</tbody></table></div>
    </>}
    {hasMore && nextCursor ? <button className={`${secondary} w-full`} onClick={() => load(nextCursor, true)}>Muat berikutnya</button> : null}
    {show ? <PurchaseModal masters={masters} pending={pending} onClose={() => setShow(false)} onSave={(data: any) => startTransition(async () => {
      try { const result = await createPurchase(data); if (!result.success) { toast.error(result.error); return }; toast.success('Draft pembelian dibuat.'); setShow(false); await load() } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal membuat draft.') }
    })} onSupplier={(data: any) => act(saveSupplier(data), 'Supplier ditambahkan.')} /> : null}
  </section>
}

function PurchaseModal({ masters, pending, onClose, onSave, onSupplier }: any) {
  const [items, setItems] = useState<any[]>([{ medicineId: '', unitName: '', factorToBase: 1, quantityPackage: 1, unitPrice: 0, batchNumber: '', expiresOn: '' }])
  const [supplierName, setSupplierName] = useState('')
  return <Modal title="Draft belanja obat" onClose={onClose} wide><form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ purchaseDate: f.get('date'), supplierId: f.get('supplier') || undefined, supplierName, notes: f.get('notes'), items }) }}>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Tanggal"><input name="date" type="date" className={inputClass} defaultValue={toWibDateInputValue()} required /></Field><Field label="Supplier"><select name="supplier" className={inputClass}><option value="">Supplier baru/manual</option>{masters.suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></div>
    <div className="flex gap-2"><input className={inputClass} value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Nama supplier jika belum ada" /><button type="button" className={secondary} onClick={() => supplierName && onSupplier({ name: supplierName })}>Simpan supplier</button></div>
    <div className="space-y-3">{items.map((item, index) => <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-7">
      <select className={`${inputClass} md:col-span-2`} value={item.medicineId} onChange={e => setItems(v => v.map((x, i) => i === index ? { ...x, medicineId: e.target.value } : x))}><option value="">Pilih obat</option>{masters.medicines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      <input className={inputClass} placeholder="Kemasan" value={item.unitName} onChange={e => setItems(v => v.map((x, i) => i === index ? { ...x, unitName: e.target.value } : x))} />
      <input type="number" min="1" className={inputClass} title="Faktor" value={item.factorToBase} onChange={e => setItems(v => v.map((x, i) => i === index ? { ...x, factorToBase: Number(e.target.value) } : x))} />
      <input type="number" min="1" className={inputClass} title="Jumlah" value={item.quantityPackage} onChange={e => setItems(v => v.map((x, i) => i === index ? { ...x, quantityPackage: Number(e.target.value) } : x))} />
      <input type="number" min="0" className={inputClass} title="Harga" value={item.unitPrice} onChange={e => setItems(v => v.map((x, i) => i === index ? { ...x, unitPrice: Number(e.target.value) } : x))} />
      <div className="flex gap-1"><input className={inputClass} placeholder="No. batch" value={item.batchNumber} onChange={e => setItems(v => v.map((x, i) => i === index ? { ...x, batchNumber: e.target.value } : x))} />{items.length > 1 ? <button type="button" className="px-2 text-rose-600" onClick={() => setItems(v => v.filter((_, i) => i !== index))}>×</button> : null}</div>
      <input type="date" className={`${inputClass} md:col-start-6 md:col-span-2`} value={item.expiresOn} onChange={e => setItems(v => v.map((x, i) => i === index ? { ...x, expiresOn: e.target.value } : x))} />
    </div>)}</div>
    <button type="button" className={secondary} onClick={() => setItems(v => [...v, { medicineId: '', unitName: '', factorToBase: 1, quantityPackage: 1, unitPrice: 0, batchNumber: '', expiresOn: '' }])}><Plus className="h-4 w-4" /> Item</button>
    <Field label="Catatan"><textarea name="notes" className={inputClass} /></Field>
    <div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={onClose}>Batal</button><button className={primary} disabled={pending}>Simpan draft</button></div>
  </form></Modal>
}

function MovementTab() {
  const [masters, setMasters] = useState<any>({ medicines: [] })
  const [rows, setRows] = useState<any[]>([])
  const [filter, setFilter] = useState({ q: '', medicineId: '', movementType: '', from: '', to: '', limit: 20 as PoskestrenPageSize })
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [movementType, setMovementType] = useState('PREVENTIVE')
  const [pending, startTransition] = useTransition()
  const load = useCallback(async (cursor = '', append = false) => {
    const [result, options] = await Promise.all([getStockMovements({ ...filter, cursor }), getMedicineMasterOptions()])
    setRows(previous => append ? [...previous, ...result.items] : result.items)
    setNextCursor(result.nextCursor || null)
    setHasMore(result.hasMore)
    setTruncated(Boolean(result.truncated))
    setMasters(options)
  }, [filter])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    startTransition(async () => { try { const result = await createManualStockMovement({ medicineId: String(f.get('medicine')), movementDate: String(f.get('date')), movementType: String(f.get('type')) as any, quantityBase: Number(f.get('quantity')), notes: String(f.get('notes')), referenceId: String(f.get('program') || '') || undefined }); if (!result.success) { toast.error(result.error); return }; toast.success('Mutasi stok dicatat.'); e.currentTarget.reset(); setMovementType('PREVENTIVE'); await load() } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal mencatat mutasi.') } })
  }
  return <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
    <form onSubmit={submit} className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><h3 className="font-bold text-slate-800">Mutasi manual</h3><p className="text-xs text-slate-500">Penggunaan pasien tercatat otomatis saat pemeriksaan selesai.</p></div>
      <Field label="Obat"><select name="medicine" className={inputClass} required><option value="">Pilih obat</option>{masters.medicines.map((m: any) => <option key={m.id} value={m.id}>{m.name} · stok {m.total_stock_base}</option>)}</select></Field>
      <Field label="Tanggal"><input name="date" type="date" defaultValue={toWibDateInputValue()} className={inputClass} required /></Field>
      <Field label="Jenis"><select name="type" className={inputClass} value={movementType} onChange={event => setMovementType(event.target.value)} required><option value="PREVENTIVE">Preventif</option><option value="EXPIRED">Kedaluwarsa</option><option value="DAMAGED">Rusak</option><option value="LOST">Hilang</option><option value="ADJUSTMENT_IN">Penyesuaian masuk</option><option value="ADJUSTMENT_OUT">Penyesuaian keluar</option></select></Field>
      {movementType === 'PREVENTIVE' ? <Field label="Program preventif"><select name="program" className={inputClass} required><option value="">Pilih program</option>{(masters.preventivePrograms || []).map((program: any) => <option key={program.id} value={program.id}>{program.program_date} · {program.title}</option>)}</select></Field> : null}
      <Field label="Jumlah satuan dasar"><input name="quantity" type="number" min="1" className={inputClass} required /></Field>
      <Field label="Alasan/catatan"><textarea name="notes" className={inputClass} required /></Field>
      <button className={`${primary} w-full`} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />} Catat mutasi</button>
    </form>
    <div className="space-y-3">
      <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:grid-cols-6">
        <input className={inputClass} value={filter.q} onChange={e => setFilter(v => ({ ...v, q: e.target.value }))} placeholder="Cari obat/batch..." />
        <select className={inputClass} value={filter.medicineId} onChange={e => setFilter(v => ({ ...v, medicineId: e.target.value }))}><option value="">Semua obat</option>{masters.medicines.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <select className={inputClass} value={filter.movementType} onChange={e => setFilter(v => ({ ...v, movementType: e.target.value }))}><option value="">Semua jenis</option><option>PURCHASE</option><option>PATIENT</option><option>PREVENTIVE</option><option>EXPIRED</option><option>DAMAGED</option><option>LOST</option><option>ADJUSTMENT_IN</option><option>ADJUSTMENT_OUT</option></select>
        <input type="date" className={inputClass} value={filter.from} onChange={e => setFilter(v => ({ ...v, from: e.target.value }))} />
        <input type="date" className={inputClass} value={filter.to} onChange={e => setFilter(v => ({ ...v, to: e.target.value }))} />
        <PageSize value={filter.limit} setValue={limit => setFilter(v => ({ ...v, limit }))} filtered={Boolean(filter.q || filter.medicineId || filter.movementType || filter.from || filter.to)} />
      </div>
      {truncated ? <LimitNotice /> : null}
      {rows.length === 0 ? <EmptyState title="Belum ada mutasi" description="Mutasi stok akan tampil lengkap dengan batch dan saldo." /> : <>
        <div className="space-y-2 md:hidden">{rows.map(row => <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-black">{row.medicine_name}</h3><p className="text-[11px] text-slate-500">{row.movement_date} · {row.movement_type} · {row.batch_number || 'tanpa batch'}</p></div><span className={`shrink-0 text-sm font-black ${Number(row.quantity_delta) > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{Number(row.quantity_delta) > 0 ? '+' : ''}{row.quantity_delta} {row.base_unit}</span></div><p className="mt-1 truncate text-[11px] text-slate-500">Saldo {row.stock_before} → {row.stock_after}{row.notes ? ` · ${row.notes}` : ''}</p></article>)}</div>
        <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3 font-bold">Tanggal</th><th className="px-4 py-3 font-bold">Obat</th><th className="px-4 py-3 font-bold">Jenis</th><th className="px-4 py-3 font-bold">Batch</th><th className="px-4 py-3 text-right font-bold">Mutasi</th><th className="px-4 py-3 text-right font-bold">Sebelum</th><th className="px-4 py-3 text-right font-bold">Sesudah</th><th className="px-4 py-3 font-bold">Catatan/Referensi</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.id} className="hover:bg-slate-50/70"><td className="px-4 py-3">{row.movement_date}</td><td className="px-4 py-3 font-bold">{row.medicine_name}</td><td className="px-4 py-3 text-xs font-bold">{row.movement_type}</td><td className="px-4 py-3">{row.batch_number || '—'}</td><td className={`px-4 py-3 text-right font-black ${Number(row.quantity_delta) > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{Number(row.quantity_delta) > 0 ? '+' : ''}{row.quantity_delta} {row.base_unit}</td><td className="px-4 py-3 text-right">{row.stock_before}</td><td className="px-4 py-3 text-right">{row.stock_after}</td><td className="max-w-sm px-4 py-3 text-xs text-slate-600">{row.notes || row.reference_id || '—'}</td></tr>)}</tbody></table></div>
      </>}
      {hasMore && nextCursor ? <button className={`${secondary} w-full`} onClick={() => load(nextCursor, true)}>Muat berikutnya</button> : null}
    </div>
  </section>
}

function LimitNotice() {
  return <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700">Hasil “Semua” dibatasi 1.000 baris. Gunakan filter yang lebih spesifik.</p>
}

function Loading() {
  return <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-12"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
}

function ConfirmDeleteModal({ title, description, pending, onClose, onConfirm }: { title: string; description: string; pending: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Modal title={title} onClose={onClose}>
    <div className="space-y-4">
      <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
        <p className="font-black mb-1">⚠ Peringatan: Aksi ini tidak dapat dibatalkan!</p>
        <p>{description}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={secondary} onClick={onClose} disabled={pending}>Batal</button>
        <button type="button" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50" onClick={onConfirm} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Ya, Hapus Permanen</button>
      </div>
    </div>
  </Modal>
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"><div className={`max-h-[90vh] w-full flex flex-col overflow-hidden rounded-xl bg-white shadow-xl ${wide ? 'max-w-5xl' : 'max-w-xl'}`}><div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4"><h2 className="text-sm font-bold text-slate-800">{title}</h2><button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose}>Tutup</button></div><div className="flex-1 overflow-y-auto p-5">{children}</div></div></div>
}
