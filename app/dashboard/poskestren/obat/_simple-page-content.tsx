/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { MedicineCombobox } from '@/components/poskestren/medicine-combobox'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRightLeft,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { EmptyState, MetricCard, PoskestrenTabs } from '@/components/poskestren/poskestren-shell'
import { toWibDateInputValue } from '@/lib/date/wib'
import type { PoskestrenPageSize } from '@/lib/poskestren/types'

import { deleteMedicine, saveSupplier } from './actions'
import { createSimpleStockAdjustment } from './adjustment-actions'
import {
  createAndReceiveSimplePurchase,
  getSimpleMedicineCatalog,
  getSimpleMedicineMasters,
  getSimplePurchases,
  getSimpleStockMovements,
  importMedicineRows,
  saveSimpleMedicine,
  type MedicineImportRow,
} from './simple-actions'
import {
  createBulkStocktake,
  createDormStockTransfer,
  createMedicineOrder,
  createQuickMedicineIssue,
  getMedicineOrderForReceiving,
  getMedicineLocationBalances,
  getMedicineOrders,
  getMedicinePlanning,
  getMedicineWorkflowMasters,
  receiveMedicineOrder,
  setMedicineOrderStatus,
} from './workflow-actions'

type Tab = 'katalog' | 'transaksi' | 'planning' | 'belanja' | 'pengeluaran'

const tabs = [
  { value: 'katalog' as const, label: 'Katalog dan Stok', icon: PackagePlus },
  { value: 'transaksi' as const, label: 'Transaksi', icon: ArrowRightLeft },
  { value: 'planning' as const, label: 'Pemakaian & Pemesanan', icon: ClipboardList },
  { value: 'belanja' as const, label: 'Belanja', icon: ShoppingCart },
  { value: 'pengeluaran' as const, label: 'Kartu Stok', icon: Upload },
]
const input = 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

function Modal({ title, onClose, children, wide = false }: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
    <div className={`max-h-[94vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-xl ${wide ? 'sm:max-w-5xl' : 'sm:max-w-xl'}`}>
      <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
        <h2 className="font-black text-slate-800">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-200"><X className="h-4 w-4" /></button>
      </div>
      <div className="max-h-[calc(94vh-56px)] overflow-y-auto p-4">{children}</div>
    </div>
  </div>
}

function PageSize({ value, onChange, canAll }: { value: PoskestrenPageSize; onChange: (value: PoskestrenPageSize) => void; canAll: boolean }) {
  return <select value={value} onChange={event => onChange(event.target.value === 'all' ? 'all' : Number(event.target.value) as 20 | 50 | 100)} className={input}>
    <option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
    <option value="all" disabled={!canAll}>Semua (maks. 1.000)</option>
  </select>
}

export default function SimpleMedicinePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initial = searchParams.get('tab') as Tab | null
  const [active, setActive] = useState<Tab>(tabs.some(tab => tab.value === initial) ? initial! : 'katalog')

  function changeTab(tab: Tab) {
    setActive(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`/dashboard/poskestren/obat?${params.toString()}`, { scroll: false })
  }

  return <div className="mx-auto max-w-7xl space-y-6 pb-24">
    <DashboardPageHeader title="Obat" description="Katalog, stok pusat/asrama, transaksi cepat, perencanaan pemakaian, dan penerimaan belanja." className="border-b pb-4" />
    <PoskestrenTabs tabs={tabs} active={active} onChange={changeTab} />
    {active === 'katalog' ? <CatalogTab /> : null}
    {active === 'transaksi' ? <TransactionTab /> : null}
    {active === 'planning' ? <PlanningTab /> : null}
    {active === 'belanja' ? <PurchaseTab /> : null}
    {active === 'pengeluaran' ? <MovementTab /> : null}
  </div>
}

function CatalogTab() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [pageSize, setPageSize] = useState<PoskestrenPageSize>(50)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getSimpleMedicineCatalog({ q, status, limit: pageSize })
      setRows(result.items)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat katalog.')
    } finally {
      setLoading(false)
    }
  }, [pageSize, q, status])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])

  const stock = rows.reduce((sum, row) => sum + Number(row.total_stock_base), 0)
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <MetricCard label="Obat tampil" value={rows.length} />
      <MetricCard label="Total unit stok" value={stock.toLocaleString('id-ID')} tone="blue" />
      <MetricCard label="Saldo pusat" value={rows.reduce((sum, row) => sum + Number(row.central_stock_base || 0), 0).toLocaleString('id-ID')} tone="blue" />
      <MetricCard label="Saldo asrama" value={rows.reduce((sum, row) => sum + Number(row.dorm_stock_base || 0), 0).toLocaleString('id-ID')} tone="blue" />
      <MetricCard label="Stok kosong" value={rows.filter(row => Number(row.total_stock_base) === 0).length} tone="amber" />
    </div>
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="grid gap-3 border-b bg-slate-50 p-4 lg:grid-cols-[1fr_170px_120px_auto_auto]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={event => setQ(event.target.value)} placeholder="Cari nama, bentuk, atau kekuatan..." className={`${input} pl-9`} /></div>
        <select value={status} onChange={event => setStatus(event.target.value)} className={input}><option value="">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="empty">Stok kosong</option></select>
        <PageSize value={pageSize} onChange={setPageSize} canAll={Boolean(q || status)} />
        <button onClick={() => setShowImport(true)} className={secondary}><FileSpreadsheet className="h-4 w-4" /> Import Excel</button>
        <button onClick={() => { setEditing(null); setShowForm(true) }} className={primary}><Plus className="h-4 w-4" /> Obat</button>
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : rows.length ? <>
        <div className="space-y-2 p-3 md:hidden">{rows.map(row => <article key={row.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-bold">{row.name}</p><p className="text-[11px] text-slate-500">{row.form} {row.strength ? `· ${row.strength}` : ''}</p></div><span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{row.total_stock_base} {row.form}</span></div>
          <div className="mt-2 flex gap-2"><button onClick={() => { setEditing(row); setShowForm(true) }} className={secondary}><Pencil className="h-3.5 w-3.5" /> Edit</button><button onClick={() => removeMedicine(row)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-bold text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Hapus</button></div>
        </article>)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Nama obat</th><th className="px-4 py-3">Bentuk</th><th className="px-4 py-3">Kekuatan</th><th className="px-4 py-3 text-right">Stok aktual</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-bold">{row.name}</td><td className="px-4 py-3">{row.form}</td><td className="px-4 py-3">{row.strength || '—'}</td><td className="px-4 py-3 text-right font-black text-emerald-700">{Number(row.total_stock_base).toLocaleString('id-ID')} {row.form}</td><td className="px-4 py-3 text-center"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black">{row.is_active ? 'AKTIF' : 'NONAKTIF'}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button title="Edit" onClick={() => { setEditing(row); setShowForm(true) }} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button><button title="Hapus" onClick={() => removeMedicine(row)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>
      </> : <div className="p-4"><EmptyState title="Katalog kosong" description="Tambahkan obat manual atau import dari Excel." /></div>}
    </section>
    {showForm ? <MedicineModal row={editing} pending={pending} onClose={() => setShowForm(false)} onSave={(payload: any) => startTransition(async () => {
      try {
        const result = await saveSimpleMedicine(payload)
        if (!result.success) { toast.error(result.error); return }
        toast.success('Obat disimpan.')
        setShowForm(false)
        await load()
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyimpan obat.') }
    })} /> : null}
    {showImport ? <ImportModal onClose={() => setShowImport(false)} onImported={load} /> : null}
  </div>

  function removeMedicine(row: any) {
    if (!window.confirm(`Hapus obat "${row.name}"? Obat hanya dapat dihapus jika belum mempunyai transaksi dan stoknya nol.`)) return
    startTransition(async () => {
      try {
        const result = await deleteMedicine(row.id)
        if (!result.success) { toast.error(result.error); return }
        toast.success('Obat dihapus.')
        await load()
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menghapus obat.') }
    })
  }
}

function MedicineModal({ row, pending, onClose, onSave }: any) {
  return <Modal title={row ? 'Edit obat' : 'Tambah obat'} onClose={onClose}>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ id: row?.id, name: data.get('name'), form: data.get('form'), strength: data.get('strength'), isActive: data.get('active') === 'on' }) }}>
      <label className="block text-xs font-bold">Nama Obat *<input required name="name" defaultValue={row?.name || ''} className={`${input} mt-1`} /></label>
      <label className="block text-xs font-bold">Bentuk *<input required name="form" defaultValue={row?.form || ''} placeholder="Tablet, kapsul, sirup..." className={`${input} mt-1`} /></label>
      <label className="block text-xs font-bold">Kekuatan<input name="strength" defaultValue={row?.strength || ''} placeholder="500 mg, 5 mg/ml..." className={`${input} mt-1`} /></label>
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="active" defaultChecked={row ? Boolean(row.is_active) : true} /> Aktif</label>
      <button disabled={pending} className={`${primary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan</button>
    </form>
  </Modal>
}

type PreviewRow = MedicineImportRow & { status: 'BARU' | 'PEMBARUAN' | 'DUPLIKAT' | 'INVALID'; message?: string }

function medicineKey(name?: string, form?: string, strength?: string) {
  return [name, form, strength].map(value => String(value || '').trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ')).join('|')
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [pending, startTransition] = useTransition()

  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const sheet = XLSX.utils.aoa_to_sheet([
      ['ID Obat', 'Nama Obat', 'Bentuk', 'Kekuatan'],
      ['', 'Paracetamol', 'Tablet', '500 mg'],
    ])
    sheet['!cols'] = [{ wch: 38 }, { wch: 32 }, { wch: 20 }, { wch: 18 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Template Obat')
    XLSX.writeFile(workbook, 'template-import-obat-poskestren.xlsx')
  }

  async function readFile(file?: File) {
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      if (raw.length > 1000) { toast.error('Maksimal 1.000 baris.'); return }
      const masters = await getSimpleMedicineMasters()
      const byId = new Map(masters.medicines.map((item: any) => [String(item.id), item]))
      const byKey = new Map(masters.medicines.map((item: any) => [medicineKey(item.name, item.form, item.strength), item]))
      const seenId = new Set<string>()
      const seenKey = new Set<string>()
      const pick = (record: Record<string, unknown>, names: string[]) => {
        const entry = Object.entries(record).find(([key]) => names.includes(key.trim().toLocaleLowerCase('id-ID')))
        return String(entry?.[1] || '').trim()
      }
      setRows(raw.map((record, index) => {
        const id = pick(record, ['id obat', 'id'])
        const name = pick(record, ['nama obat', 'nama'])
        const form = pick(record, ['bentuk'])
        const strength = pick(record, ['kekuatan'])
        const key = medicineKey(name, form, strength)
        const base = { rowNumber: index + 2, id, name, form, strength }
        if (!name || !form) return { ...base, status: 'INVALID' as const, message: 'Nama dan Bentuk wajib diisi.' }
        if ((id && seenId.has(id)) || seenKey.has(key)) return { ...base, status: 'DUPLIKAT' as const, message: 'Duplikat di dalam file.' }
        if (id) seenId.add(id)
        seenKey.add(key)
        if (id && !byId.has(id)) return { ...base, status: 'INVALID' as const, message: 'ID tidak ditemukan.' }
        return { ...base, status: (id ? 'PEMBARUAN' : byKey.has(key) ? 'PEMBARUAN' : 'BARU') as PreviewRow['status'] }
      }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'File Excel tidak dapat dibaca.')
    }
  }

  const counts = useMemo(() => ({
    new: rows.filter(row => row.status === 'BARU').length,
    update: rows.filter(row => row.status === 'PEMBARUAN').length,
    duplicate: rows.filter(row => row.status === 'DUPLIKAT').length,
    invalid: rows.filter(row => row.status === 'INVALID').length,
  }), [rows])
  return <Modal title="Import Excel Obat" onClose={onClose} wide>
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><button onClick={() => void downloadTemplate()} className={secondary}><Download className="h-4 w-4" /> Unduh template</button><button onClick={() => fileRef.current?.click()} className={primary}><Upload className="h-4 w-4" /> Pilih Excel</button><input ref={fileRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={event => void readFile(event.target.files?.[0])} /></div>
      {rows.length ? <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><MetricCard label="Baru" value={counts.new} /><MetricCard label="Pembaruan" value={counts.update} tone="blue" /><MetricCard label="Duplikat" value={counts.duplicate} tone="amber" /><MetricCard label="Invalid" value={counts.invalid} tone="rose" /></div>
        <div className="max-h-96 overflow-auto rounded-lg border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100 uppercase"><tr><th className="p-2">Baris</th><th className="p-2">ID</th><th className="p-2">Nama</th><th className="p-2">Bentuk</th><th className="p-2">Kekuatan</th><th className="p-2">Status</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.rowNumber}><td className="p-2">{row.rowNumber}</td><td className="p-2">{row.id || '—'}</td><td className="p-2 font-bold">{row.name || '—'}</td><td className="p-2">{row.form || '—'}</td><td className="p-2">{row.strength || '—'}</td><td className="p-2"><span className="font-black">{row.status}</span>{row.message ? <small className="block text-rose-600">{row.message}</small> : null}</td></tr>)}</tbody></table></div>
        <button disabled={pending || counts.invalid > 0 || counts.duplicate > 0} onClick={() => startTransition(async () => {
          try {
            const result = await importMedicineRows(rows)
            if (!result.success) { toast.error(result.error); return }
            toast.success(`Import selesai: ${result.created} baru, ${result.updated} diperbarui.`)
            await onImported()
            onClose()
          } catch (error) { toast.error(error instanceof Error ? error.message : 'Import gagal.') }
        })} className={`${primary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Import {counts.new + counts.update} baris</button>
      </> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Kolom template: ID Obat (opsional), Nama Obat, Bentuk, dan Kekuatan. Maksimal 1.000 baris.</p>}
    </div>
  </Modal>
}

function PurchaseTab() {
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [masters, setMasters] = useState<any>({ medicines: [], suppliers: [] })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [pending, startTransition] = useTransition()
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [result, options] = await Promise.all([getSimplePurchases({ q, from, to, limit: 100 }), getSimpleMedicineMasters()])
      setRows(result.items); setMasters(options)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal memuat belanja.') }
    finally { setLoading(false) }
  }, [from, q, to])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])
  return <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
    <div className="grid gap-3 border-b bg-slate-50 p-4 md:grid-cols-[1fr_160px_160px_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={event => setQ(event.target.value)} placeholder="Cari supplier atau obat..." className={`${input} pl-9`} /></div><input type="date" value={from} onChange={event => setFrom(event.target.value)} className={input} /><input type="date" value={to} onChange={event => setTo(event.target.value)} className={input} /><button onClick={() => setShowForm(true)} className={primary}><Plus className="h-4 w-4" /> Belanja</button></div>
    {loading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div> : rows.length ? <>
      <div className="space-y-2 p-3 md:hidden">{rows.map(row => <article key={row.id} className="rounded-lg border p-3"><div className="flex justify-between gap-2"><div><p className="font-bold">{row.supplier_name}</p><p className="text-[11px] text-slate-500">{row.purchase_date} · {row.item_count} item</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">{row.status}</span></div><p className="mt-2 text-xs">{row.item_summary}</p>{row.notes ? <p className="mt-1 text-[11px] text-slate-500">{row.notes}</p> : null}</article>)}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Obat dan jumlah</th><th className="px-4 py-3 text-center">Item</th><th className="px-4 py-3">Catatan</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.id}><td className="px-4 py-3">{row.purchase_date}</td><td className="px-4 py-3 font-bold">{row.supplier_name}</td><td className="max-w-lg px-4 py-3">{row.item_summary}</td><td className="px-4 py-3 text-center">{row.item_count}</td><td className="max-w-xs px-4 py-3 text-xs text-slate-500">{row.notes || '—'}</td><td className="px-4 py-3 text-xs font-black">{row.status}</td></tr>)}</tbody></table></div>
    </> : <div className="p-4"><EmptyState title="Belum ada belanja" description="Catat penerimaan obat tanpa harga, batch, atau ED." /></div>}
    {showForm ? <PurchaseModal masters={masters} pending={pending} onClose={() => setShowForm(false)} onAddSupplier={async () => {
      const name = window.prompt('Nama supplier baru:')
      if (!name) return
      const result = await saveSupplier({ name })
      if (!result.success) toast.error(result.error); else { toast.success('Supplier ditambahkan.'); await load() }
    }} onSave={(payload: any) => startTransition(async () => {
      try {
        const result = await createAndReceiveSimplePurchase(payload)
        if (!result.success) { toast.error(result.error); return }
        toast.success('Belanja diterima dan stok bertambah.')
        setShowForm(false); await load()
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyimpan belanja.') }
    })} /> : null}
  </section>
}

function PurchaseModal({ masters, pending, onClose, onSave, onAddSupplier }: any) {
  const [items, setItems] = useState<Array<{ medicineId: string; quantity: number }>>([{ medicineId: '', quantity: 1 }])
  return <Modal title="Belanja Obat" onClose={onClose} wide><form className="space-y-4" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ purchaseDate: data.get('date'), supplierId: data.get('supplierId'), supplierName: data.get('supplierName'), notes: data.get('notes'), items }) }}>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Tanggal *<input required type="date" name="date" defaultValue={toWibDateInputValue()} className={`${input} mt-1`} /></label><label className="text-xs font-bold">Supplier tersimpan<select name="supplierId" className={`${input} mt-1`}><option value="">Pilih / tulis baru</option>{masters.suppliers.map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="text-xs font-bold">Supplier baru<input name="supplierName" placeholder="Diisi jika belum ada di master" className={`${input} mt-1`} /></label><div className="flex items-end"><button type="button" onClick={onAddSupplier} className={secondary}>+ Master supplier</button></div></div>
    <div className="rounded-lg border"><div className="flex items-center justify-between border-b bg-slate-50 p-3"><b>Obat yang diterima</b><button type="button" onClick={() => setItems(rows => [...rows, { medicineId: '', quantity: 1 }])} className={secondary}><Plus className="h-4 w-4" /> Item</button></div><div className="space-y-2 p-3">{items.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_160px_auto]"><MedicineCombobox required value={item.medicineId} onChange={event => setItems(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, medicineId: event.target.value } : row))} className={input}><option value="">Pilih obat</option>{masters.medicines.map((medicine: any) => <option key={medicine.id} value={medicine.id}>{medicine.name} · {medicine.form} · stok {medicine.total_stock_base}</option>)}</MedicineCombobox><input required type="number" min={1} value={item.quantity} onChange={event => setItems(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(event.target.value) } : row))} placeholder="Jumlah" className={input} /><button type="button" disabled={items.length === 1} onClick={() => setItems(rows => rows.filter((_, rowIndex) => rowIndex !== index))} className="rounded-lg p-3 text-rose-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div>)}</div></div>
    <textarea name="notes" placeholder="Catatan belanja (opsional)" className={`${input} min-h-20`} />
    <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">Penyimpanan langsung menandai obat diterima dan menambah stok. Tidak ada harga maupun posting ke Keuangan.</p>
    <button disabled={pending} className={`${primary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan dan terima</button>
  </form></Modal>
}

function MovementTab() {
  const [filter, setFilter] = useState({ q: '', from: '', to: '', medicineId: '', movementType: '' })
  const [rows, setRows] = useState<any[]>([])
  const [masters, setMasters] = useState<any>({ medicines: [] })
  const [loading, setLoading] = useState(true)
  const [showAdjust, setShowAdjust] = useState(false)
  const [pending, startTransition] = useTransition()
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [result, options] = await Promise.all([getSimpleStockMovements({ ...filter, limit: 100 }), getSimpleMedicineMasters()])
      setRows(result.items); setMasters(options)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal memuat kartu stok.') }
    finally { setLoading(false) }
  }, [filter])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])
  return <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
    <div className="grid gap-3 border-b bg-slate-50 p-4 lg:grid-cols-[1fr_200px_150px_150px_170px_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={filter.q} onChange={event => setFilter(value => ({ ...value, q: event.target.value }))} placeholder="Cari obat atau referensi..." className={`${input} pl-9`} /></div><MedicineCombobox value={filter.medicineId} onChange={event => setFilter(value => ({ ...value, medicineId: event.target.value }))} className={input}><option value="">Semua obat</option>{masters.medicines.map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</MedicineCombobox><select value={filter.movementType} onChange={event => setFilter(value => ({ ...value, movementType: event.target.value }))} className={input}><option value="">Semua jenis</option>{['PURCHASE','PATIENT','PREVENTIVE','TRANSFER','ADJUSTMENT_IN','ADJUSTMENT_OUT','EXPIRED','DAMAGED','LOST','REVERSAL'].map(value => <option key={value}>{value}</option>)}</select><input type="date" value={filter.from} onChange={event => setFilter(value => ({ ...value, from: event.target.value }))} className={input} /><input type="date" value={filter.to} onChange={event => setFilter(value => ({ ...value, to: event.target.value }))} className={input} /><button onClick={() => setShowAdjust(true)} className={primary}>Penyesuaian</button></div>
    {loading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div> : rows.length ? <>
      <div className="space-y-2 p-3 md:hidden">{rows.map(row => <article key={row.id} className="rounded-lg border p-3"><div className="flex justify-between gap-2"><div><p className="font-bold">{row.medicine_name}</p><p className="text-[11px] text-slate-500">{row.movement_date} · {row.movement_type}</p></div><span className={`font-black ${Number(row.quantity_delta) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{Number(row.quantity_delta) > 0 ? '+' : ''}{row.quantity_delta} {row.form}</span></div><p className="mt-1 text-[11px] text-slate-500">Saldo {row.stock_before} → {row.stock_after} · {row.notes || row.reference_type}</p></article>)}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Obat</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3 text-right">Mutasi</th><th className="px-4 py-3 text-right">Sebelum</th><th className="px-4 py-3 text-right">Sesudah</th><th className="px-4 py-3">Catatan/Referensi</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.id}><td className="px-4 py-3">{row.movement_date}</td><td className="px-4 py-3 font-bold">{row.medicine_name}</td><td className="px-4 py-3 text-xs font-black">{row.movement_type}</td><td className={`px-4 py-3 text-right font-black ${Number(row.quantity_delta) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{Number(row.quantity_delta) > 0 ? '+' : ''}{row.quantity_delta} {row.form}</td><td className="px-4 py-3 text-right">{row.stock_before}</td><td className="px-4 py-3 text-right">{row.stock_after}</td><td className="max-w-sm px-4 py-3 text-xs text-slate-500">{row.notes || `${row.reference_type}: ${row.reference_id}`}</td></tr>)}</tbody></table></div>
    </> : <div className="p-4"><EmptyState title="Kartu stok kosong" description="Penerimaan dan pemakaian obat akan muncul di sini." /></div>}
    {showAdjust ? <AdjustmentModal medicines={masters.medicines} locations={masters.locations || []} pending={pending} onClose={() => setShowAdjust(false)} onSave={(payload: any) => startTransition(async () => {
      try {
        const result = await createSimpleStockAdjustment(payload)
        if (!result.success) { toast.error(result.error); return }
        toast.success('Stok disesuaikan.'); setShowAdjust(false); await load()
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyesuaikan stok.') }
    })} /> : null}
  </section>
}

function AdjustmentModal({ medicines, locations, pending, onClose, onSave }: any) {
  return <Modal title="Penyesuaian Stok" onClose={onClose}><form className="space-y-3" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); onSave({ medicineId: data.get('medicineId'), movementDate: data.get('date'), quantityDelta: Number(data.get('quantity')), reason: data.get('reason'), notes: data.get('notes'), locationId: data.get('locationId') }) }}>
    <select required name="locationId" className={input}><option value="">Pilih lokasi stok</option>{locations.map((row: any) => <option key={row.id} value={row.id}>{row.name} · {row.location_type}</option>)}</select>
    <MedicineCombobox required name="medicineId" className={input}><option value="">Pilih obat</option>{medicines.map((row: any) => <option key={row.id} value={row.id}>{row.name} · stok {row.total_stock_base} {row.form}</option>)}</MedicineCombobox>
    <input required type="date" name="date" defaultValue={toWibDateInputValue()} className={input} />
    <select required name="reason" className={input}><option value="ADJUSTMENT">Penyesuaian</option><option value="EXPIRED">Kedaluwarsa</option><option value="DAMAGED">Rusak</option><option value="LOST">Hilang</option></select>
    <input required type="number" name="quantity" placeholder="Jumlah (+ tambah, - kurangi)" className={input} />
    <textarea required name="notes" placeholder="Alasan/catatan wajib" className={`${input} min-h-20`} />
    <button disabled={pending} className={`${primary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan mutasi</button>
  </form></Modal>
}

type WorkflowMode = 'issue' | 'transfer' | 'opname'

function medicineLabel(row: any) {
  return `${row.name} · ${row.form || row.base_unit}${row.strength ? ` · ${row.strength}` : ''}`
}

function TransactionTab() {
  const [mode, setMode] = useState<WorkflowMode>('issue')
  const [masters, setMasters] = useState<any>({ medicines: [], locations: [], santri: [], guru: [], dorms: [] })
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [issueItems, setIssueItems] = useState<Array<{ medicineId: string; quantity: number }>>([{ medicineId: '', quantity: 1 }])
  const [transferItems, setTransferItems] = useState<Array<{ medicineId: string; quantity: number }>>([{ medicineId: '', quantity: 1 }])
  const [stocktakeItems, setStocktakeItems] = useState<Array<{ medicineId: string; countedQuantity: number; recordedQuantity?: number }>>([])
  const [sourceLocationId, setSourceLocationId] = useState('pos-location-central')
  const [recipientType, setRecipientType] = useState<'SANTRI' | 'GURU'>('SANTRI')
  const [santriId, setSantriId] = useState('')
  const [guruId, setGuruId] = useState('')
  const [purpose, setPurpose] = useState<'PRIBADI' | 'RESEP_DOKTER' | 'LAINNYA'>('PRIBADI')
  const [destinationAsrama, setDestinationAsrama] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(toWibDateInputValue())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getMedicineWorkflowMasters()
      setMasters(result)
      setSourceLocationId(current => result.locations.some((row: any) => row.id === current) ? current : result.locations[0]?.id || 'pos-location-central')
      setStocktakeItems(result.medicines.map((row: any) => ({ medicineId: row.id, countedQuantity: Number(row.central_stock_base || 0), recordedQuantity: Number(row.central_stock_base || 0) })))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat master transaksi.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (mode !== 'opname' || !sourceLocationId) return
    void getMedicineLocationBalances(sourceLocationId)
      .then(rows => setStocktakeItems(rows.map((row: any) => ({ medicineId: row.id, countedQuantity: Number(row.counted_quantity || 0), recordedQuantity: Number(row.counted_quantity || 0) }))))
      .catch(error => toast.error(error instanceof Error ? error.message : 'Gagal memuat saldo lokasi.'))
  }, [mode, sourceLocationId])

  const locations = masters.locations || []
  const medicineOptions = masters.medicines || []
  const updateItem = (setter: any, index: number, key: string, value: any) => setter((rows: any[]) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))

  function submitIssue(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const result = await createQuickMedicineIssue({ issueDate: date, recipientType, santriId, guruId: Number(guruId), sourceLocationId, purpose, notes, items: issueItems })
        if (!result.success) { toast.error(result.error); return }
        toast.success('Transaksi obat keluar tersimpan.')
        setIssueItems([{ medicineId: '', quantity: 1 }]); setNotes(''); await load()
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyimpan transaksi.') }
    })
  }
  function submitTransfer(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const result = await createDormStockTransfer({ transferDate: date, sourceLocationId, destinationAsrama, notes, items: transferItems })
        if (!result.success) { toast.error(result.error); return }
        toast.success('Transfer stok asrama tersimpan tanpa mengubah total stok.')
        setTransferItems([{ medicineId: '', quantity: 1 }]); setNotes(''); await load()
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal mentransfer stok.') }
    })
  }
  function submitStocktake(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const result = await createBulkStocktake({ opnameDate: date, locationId: sourceLocationId, notes, items: stocktakeItems })
        if (!result.success) { toast.error(result.error); return }
        toast.success('Opname massal tersimpan; hanya selisih yang dimutasi.')
        await load()
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyimpan opname.') }
    })
  }

  return <section className="space-y-4">
    <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-3 shadow-sm">
      <button type="button" onClick={() => setMode('issue')} className={mode === 'issue' ? primary : secondary}>Obat Keluar</button>
      <button type="button" onClick={() => setMode('transfer')} className={mode === 'transfer' ? primary : secondary}>Transfer Asrama</button>
      <button type="button" onClick={() => setMode('opname')} className={mode === 'opname' ? primary : secondary}>Opname Massal</button>
    </div>
    {loading ? <div className="flex justify-center rounded-xl border bg-white py-16"><Loader2 className="h-5 w-5 animate-spin" /></div> : null}
    {!loading && mode === 'issue' ? <form onSubmit={submitIssue} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold">Tanggal *<input required type="date" value={date} onChange={event => setDate(event.target.value)} className={`${input} mt-1`} /></label><label className="text-xs font-bold">Lokasi sumber *<select required value={sourceLocationId} onChange={event => setSourceLocationId(event.target.value)} className={`${input} mt-1`}>{locations.map((row: any) => <option key={row.id} value={row.id}>{row.name} · {row.location_type}</option>)}</select></label><label className="text-xs font-bold">Tujuan<select value={purpose} onChange={event => setPurpose(event.target.value as any)} className={`${input} mt-1`}><option value="PRIBADI">Pribadi</option><option value="RESEP_DOKTER">Resep dokter</option><option value="LAINNYA">Lainnya</option></select></label></div>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold">Jenis penerima<select value={recipientType} onChange={event => { setRecipientType(event.target.value as any); setSantriId(''); setGuruId('') }} className={`${input} mt-1`}><option value="SANTRI">Santri</option><option value="GURU">Guru</option></select></label>{recipientType === 'SANTRI' ? <label className="text-xs font-bold sm:col-span-2">Santri wajib dipilih<select required value={santriId} onChange={event => setSantriId(event.target.value)} className={`${input} mt-1`}><option value="">Pilih santri</option>{masters.santri.map((row: any) => <option key={row.id} value={row.id}>{row.nama_lengkap} · {row.nis}{row.asrama ? ` · ${row.asrama}` : ''}</option>)}</select></label> : <label className="text-xs font-bold sm:col-span-2">Guru wajib dipilih<select required value={guruId} onChange={event => setGuruId(event.target.value)} className={`${input} mt-1`}><option value="">Pilih guru</option>{masters.guru.map((row: any) => <option key={row.id} value={row.id}>{row.nama_lengkap}{row.gelar ? `, ${row.gelar}` : ''}{row.kode_guru ? ` · ${row.kode_guru}` : ''}</option>)}</select></label>}</div>
      <ItemRows items={issueItems} setItems={setIssueItems} medicines={medicineOptions} updateItem={updateItem} />
      <textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan transaksi (opsional)" className={`${input} min-h-20`} />
      <button disabled={pending} className={`${primary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan obat keluar</button>
    </form> : null}
    {!loading && mode === 'transfer' ? <form onSubmit={submitTransfer} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm"><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-bold">Tanggal *<input required type="date" value={date} onChange={event => setDate(event.target.value)} className={`${input} mt-1`} /></label><label className="text-xs font-bold">Lokasi asal *<select required value={sourceLocationId} onChange={event => setSourceLocationId(event.target.value)} className={`${input} mt-1`}>{locations.map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="text-xs font-bold">Asrama tujuan *<select required value={destinationAsrama} onChange={event => setDestinationAsrama(event.target.value)} className={`${input} mt-1`}><option value="">Pilih asrama</option>{masters.dorms.map((row: any) => <option key={row.name} value={row.name}>{row.name}</option>)}</select></label></div><ItemRows items={transferItems} setItems={setTransferItems} medicines={medicineOptions} updateItem={updateItem} /><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan transfer (opsional)" className={`${input} min-h-20`} /><p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">Transfer hanya memindahkan saldo antar lokasi. Total stok global dan pemakaian bulanan tidak berubah.</p><button disabled={pending} className={`${primary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan transfer</button></form> : null}
    {!loading && mode === 'opname' ? <form onSubmit={submitStocktake} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Tanggal opname *<input required type="date" value={date} onChange={event => setDate(event.target.value)} className={`${input} mt-1`} /></label><label className="text-xs font-bold">Lokasi yang dihitung *<select required value={sourceLocationId} onChange={event => setSourceLocationId(event.target.value)} className={`${input} mt-1`}>{locations.map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label></div><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-xs"><thead className="bg-slate-50"><tr><th className="p-2">Obat</th><th className="p-2">Stok tercatat</th><th className="p-2">Hitung fisik</th></tr></thead><tbody className="divide-y">{stocktakeItems.map((item, index) => { const medicine = medicineOptions.find((row: any) => row.id === item.medicineId); return <tr key={item.medicineId}><td className="p-2 font-bold">{medicine ? medicineLabel(medicine) : item.medicineId}</td><td className="p-2">{item.recordedQuantity ?? item.countedQuantity}</td><td className="p-2"><input type="number" min={0} value={item.countedQuantity} onChange={event => updateItem(setStocktakeItems, index, 'countedQuantity', Number(event.target.value))} className={input} /></td></tr> })}</tbody></table></div><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan sesi opname (opsional)" className={`${input} min-h-20`} /><button disabled={pending} className={`${primary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan opname massal</button></form> : null}
  </section>
}

function ItemRows({ items, setItems, medicines, updateItem }: any) {
  return <div className="rounded-lg border"><div className="flex items-center justify-between border-b bg-slate-50 p-3"><b>Daftar obat</b><button type="button" onClick={() => setItems((rows: any[]) => [...rows, { medicineId: '', quantity: 1 }])} className={secondary}><Plus className="h-4 w-4" /> Item</button></div><div className="space-y-2 p-3">{items.map((item: any, index: number) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_150px_auto]"><MedicineCombobox required value={item.medicineId} onChange={event => updateItem(setItems, index, 'medicineId', event.target.value)} className={input}><option value="">Pilih obat · bentuk · kekuatan</option>{medicines.map((medicine: any) => <option key={medicine.id} value={medicine.id}>{medicineLabel(medicine)} · total {medicine.total_stock_base}</option>)}</MedicineCombobox><input required type="number" min={1} value={item.quantity} onChange={event => updateItem(setItems, index, 'quantity', Number(event.target.value))} className={input} /><button type="button" disabled={items.length === 1} onClick={() => setItems((rows: any[]) => rows.filter((_, rowIndex) => rowIndex !== index))} className="rounded-lg p-3 text-rose-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div>)}</div></div>
}

function PlanningTab() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [orderQty, setOrderQty] = useState<Record<string, number>>({})
  const [supplierName, setSupplierName] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [receivingOrderId, setReceivingOrderId] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [planning, orderRows] = await Promise.all([getMedicinePlanning({ year }), getMedicineOrders({ year })])
      setRows(planning); setOrders(orderRows)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal memuat pemakaian dan pemesanan.') }
    finally { setLoading(false) }
  }, [year])
  useEffect(() => { void load() }, [load])
  function exportExcel() {
    void (async () => {
      const XLSX = await import('xlsx')
      const data = rows.filter(row => Number(orderQty[row.id] || 0) > 0).map((row, index) => ({ NO: index + 1, 'NAMA OBAT': row.name, JUMLAH: Number(orderQty[row.id]), SATUAN: row.base_unit || row.form, KETERANGAN: row.notes || '' }))
      const sheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'PESANAN'); XLSX.writeFile(workbook, `pesanan-obat-${year}.xlsx`)
    })()
  }
  function saveOrder(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const items = rows.filter(row => Number(orderQty[row.id] || 0) > 0).map(row => ({ medicineId: row.id, unitName: row.base_unit || row.form, totalUsage: row.total_usage, caQuantity: row.ca_quantity, dailyAverage: row.daily_average, safetyStock: row.safety_stock, leadTimeStock: row.lead_time_stock, totalStockSnapshot: row.total_stock_base, planningQuantity: row.planning_quantity, orderQuantity: Number(orderQty[row.id]), notes: '' }))
        const result = await createMedicineOrder({ planYear: year, orderDate: toWibDateInputValue(), supplierName, notes, items })
        if (!result.success) { toast.error(result.error); return }
        toast.success('Draft pesanan tersimpan.'); setOrderQty({}); setNotes(''); await load()
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyimpan pesanan.') }
    })
  }
  return <section className="space-y-4"><div className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-[180px_1fr_auto_auto]"><label className="text-xs font-bold">Tahun<select value={year} onChange={event => setYear(Number(event.target.value))} className={`${input} mt-1`}>{[year - 1, year, year + 1].map(value => <option key={value}>{value}</option>)}</select></label><div className="flex items-end"><p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">Rumus Excel: Total = Jan–Des · Ca = Total / 3 · SS = Ca × 20% · waktu tunggu = rata-rata harian × 10 · Perencanaan = Ca + SS + waktu tunggu − stok seluruh lokasi.</p></div><button type="button" onClick={() => window.print()} className={secondary}>Cetak PESANAN</button><button type="button" onClick={exportExcel} className={secondary}><FileSpreadsheet className="h-4 w-4" /> Excel</button></div>{loading ? <div className="flex justify-center rounded-xl border bg-white py-16"><Loader2 className="h-5 w-5 animate-spin" /></div> : <form onSubmit={saveOrder} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black">Pemakaian bulanan dan perencanaan</h3><p className="text-xs text-slate-500">Pemakaian hanya dari PATIENT dan PREVENTIVE. Transfer, belanja, dan opname tidak masuk konsumsi.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Jumlah PEMESANAN diisi manual</span></div><div className="overflow-x-auto rounded-lg border"><table className="min-w-[1080px] w-full text-left text-xs"><thead className="bg-slate-50"><tr><th className="p-2">Obat</th><th className="p-2">Jan</th><th className="p-2">Feb</th><th className="p-2">Mar</th><th className="p-2">Apr</th><th className="p-2">Mei</th><th className="p-2">Jun</th><th className="p-2">Jul</th><th className="p-2">Agu</th><th className="p-2">Sep</th><th className="p-2">Okt</th><th className="p-2">Nov</th><th className="p-2">Des</th><th className="p-2">Total</th><th className="p-2">Ca</th><th className="p-2">Stok</th><th className="p-2">Perencanaan</th><th className="p-2">PEMESANAN</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.id}><td className="p-2 font-bold">{medicineLabel(row)}</td>{row.months.map((value: number, index: number) => <td key={index} className="p-2">{Number(value).toLocaleString('id-ID')}</td>)}<td className="p-2 font-bold">{Number(row.total_usage).toLocaleString('id-ID')}</td><td className="p-2">{Number(row.ca_quantity).toLocaleString('id-ID', { maximumFractionDigits: 4 })}</td><td className="p-2">{row.total_stock_base}</td><td className={`p-2 font-bold ${Number(row.planning_quantity) < 0 ? 'text-slate-400' : 'text-emerald-700'}`}>{Number(row.planning_quantity).toLocaleString('id-ID', { maximumFractionDigits: 4 })}</td><td className="p-2"><input type="number" min={0} value={orderQty[row.id] ?? ''} onChange={event => setOrderQty(current => ({ ...current, [row.id]: Number(event.target.value) }))} className={`${input} min-w-28`} /></td></tr>)}</tbody></table></div><div className="grid gap-3 sm:grid-cols-2"><input value={supplierName} onChange={event => setSupplierName(event.target.value)} placeholder="Supplier (opsional di draft)" className={input} /><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan pesanan" className={`${input} min-h-12`} /></div><button disabled={pending} className={`${primary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan draft pesanan ({Object.values(orderQty).filter(value => Number(value) > 0).length} item)</button></form>}{orders.length ? <section className="rounded-xl border bg-white p-4 shadow-sm"><h3 className="mb-3 font-black">Pesanan tersimpan</h3><div className="space-y-2">{orders.map(order => <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-bold">{order.order_date} · {order.item_count} item · {order.item_summary || '—'}</p><p className="text-xs text-slate-500">Status {order.status} · diterima {order.received_quantity || 0}/{order.order_quantity || 0}{order.supplier_name ? ` · ${order.supplier_name}` : ''}</p></div><div className="flex gap-2">{order.status === 'DRAFT' ? <button type="button" onClick={() => startTransition(async () => { const result = await setMedicineOrderStatus({ orderId: order.id, status: 'ORDERED' }); if (!result.success) toast.error(result.error); else { toast.success('Pesanan ditandai ORDERED.'); await load() } })} className={secondary}>Tandai dipesan</button> : null}{['ORDERED', 'PARTIAL'].includes(order.status) ? <button type="button" onClick={() => setReceivingOrderId(order.id)} className={primary}>Terima barang</button> : null}{!['RECEIVED', 'CANCELLED'].includes(order.status) ? <button type="button" onClick={() => startTransition(async () => { const result = await setMedicineOrderStatus({ orderId: order.id, status: 'CANCELLED' }); if (!result.success) toast.error(result.error); else { toast.success('Pesanan dibatalkan.'); await load() } })} className="rounded-lg px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50">Batal</button> : null}</div></article>)}</div></section> : null}{receivingOrderId ? <ReceiveOrderModal orderId={receivingOrderId} onClose={() => setReceivingOrderId(null)} onSaved={load} /> : null}</section>
}

function ReceiveOrderModal({ orderId, onClose, onSaved }: { orderId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [data, setData] = useState<any>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [supplierName, setSupplierName] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()
  useEffect(() => { void getMedicineOrderForReceiving(orderId).then(result => { setData(result); setSupplierName(result?.order?.supplier_name || '') }).catch(error => toast.error(error instanceof Error ? error.message : 'Gagal memuat pesanan.')) }, [orderId])
  if (!data) return <Modal title="Penerimaan pesanan" onClose={onClose}><div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div></Modal>
  return <Modal title={`Penerimaan pesanan ${data.order.order_date}`} onClose={onClose} wide><form className="space-y-4" onSubmit={event => { event.preventDefault(); startTransition(async () => { try { const result = await receiveMedicineOrder({ orderId, purchaseDate: toWibDateInputValue(), supplierName, notes, items: data.items.map((row: any) => ({ orderItemId: row.id, quantity: Number(quantities[row.id] || 0) })).filter((row: any) => row.quantity > 0) }); if (!result.success) { toast.error(result.error); return }; toast.success('Penerimaan tersimpan; stok pusat bertambah.'); await onSaved(); onClose() } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menerima barang.') } }) }}><label className="text-xs font-bold">Supplier dikonfirmasi *<input required value={supplierName} onChange={event => setSupplierName(event.target.value)} className={`${input} mt-1`} /></label><div className="space-y-2">{data.items.map((row: any) => <div key={row.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_150px_150px]"><div><p className="font-bold">{medicineLabel(row)}</p><p className="text-xs text-slate-500">Pesan {row.order_quantity} · sudah datang {row.received_quantity} · sisa {row.remaining_quantity}</p></div><span className="self-center text-xs font-bold">Datang sekarang</span><input type="number" min={0} max={row.remaining_quantity} value={quantities[row.id] ?? ''} onChange={event => setQuantities(current => ({ ...current, [row.id]: Number(event.target.value) }))} className={input} /></div>)}</div><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Catatan penerimaan" className={`${input} min-h-20`} /><button disabled={pending} className={`${primary} w-full`}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Konfirmasi penerimaan</button></form></Modal>
}
