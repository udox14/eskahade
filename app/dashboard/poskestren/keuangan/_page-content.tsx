/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Landmark, Loader2, Plus, Search, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { EmptyState, MetricCard, PoskestrenTabs } from '@/components/poskestren/poskestren-shell'
import { toWibDateInputValue } from '@/lib/date/wib'
import type { PoskestrenPageSize } from '@/lib/poskestren/types'

import {
  createFinanceTransaction,
  createTransfer,
  getFinanceMasters,
  getFinanceSummary,
  getLedger,
  saveCashAccount,
  saveFinanceCategory,
  voidFinanceTransaction,
} from './actions'

type Tab = 'pemasukan' | 'pengeluaran'
const TABS = [
  { value: 'pemasukan' as const, label: 'Pemasukan', icon: ArrowDownLeft },
  { value: 'pengeluaran' as const, label: 'Pengeluaran', icon: ArrowUpRight },
]
const inputClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
const primary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50'
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50'

function rupiah(value: unknown) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0))
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-bold text-slate-600">{label}</span>{children}</label>
}

export default function PoskestrenKeuanganContent() {
  const params = useSearchParams()
  const router = useRouter()
  const initial = params.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(initial === 'pengeluaran' ? initial : 'pemasukan')
  function changeTab(next: Tab) {
    setTab(next)
    const nextParams = new URLSearchParams(params.toString()); nextParams.set('tab', next)
    router.replace(`/dashboard/poskestren/keuangan?${nextParams}`, { scroll: false })
  }
  return <div className="space-y-5">
    <DashboardPageHeader title="Keuangan POSKESTREN" description="Ledger sederhana yang menjaga saldo awal, transfer berpasangan, bukti, dan riwayat reversal." />
    <PoskestrenTabs tabs={TABS} active={tab} onChange={changeTab} />
    <LedgerTab direction={tab === 'pemasukan' ? 'INCOME' : 'EXPENSE'} />
  </div>
}

function LedgerTab({ direction }: { direction: 'INCOME' | 'EXPENSE' }) {
  const [masters, setMasters] = useState<any>({ accounts: [], categories: [] })
  const [summary, setSummary] = useState<any>({})
  const [rows, setRows] = useState<any[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [filter, setFilter] = useState({ q: '', from: '', to: '', accountId: '', categoryId: '', status: 'POSTED', limit: 20 as PoskestrenPageSize })
  const [modal, setModal] = useState<'transaction' | 'transfer' | 'master' | null>(null)
  const [pending, startTransition] = useTransition()
  const transactionType = direction

  const load = useCallback(async (cursor = '', append = false) => {
    const [ledger, financeMasters, financeSummary] = await Promise.all([
      getLedger({ ...filter, transactionType, cursor }),
      getFinanceMasters(),
      getFinanceSummary({ from: filter.from || undefined, to: filter.to || undefined, accountId: filter.accountId || undefined }),
    ])
    setRows(previous => append ? [...previous, ...ledger.items] : ledger.items)
    setNextCursor(ledger.nextCursor); setHasMore(ledger.hasMore)
    setTruncated(Boolean(ledger.truncated))
    setMasters(financeMasters); setSummary(financeSummary || {})
  }, [filter, transactionType])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])

  const run = (promise: Promise<any>, message: string, close = true) => startTransition(async () => {
    try {
      const result = await promise
      if (!result.success) { toast.error(result.error); return }
      toast.success(message); if (close) setModal(null); await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Aksi keuangan gagal.') }
  })

  return <section className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Pemasukan periode" value={rupiah(summary.income)} />
      <MetricCard label="Pengeluaran periode" value={rupiah(summary.expense)} tone="rose" />
      <MetricCard label="Selisih operasional" value={rupiah(Number(summary.income || 0) - Number(summary.expense || 0))} tone="blue" />
      <MetricCard label="Transaksi operasional" value={summary.operational_count || 0} tone="slate" />
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      {masters.accounts.map((account: any) => <article key={account.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Landmark className="h-5 w-5" /></div><div><p className="text-xs font-bold text-slate-400">{account.account_type}</p><h3 className="font-black">{account.name}</h3></div></div><p className="mt-3 text-xl font-black text-slate-900">{rupiah(account.balance)}</p></article>)}
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid gap-2 md:grid-cols-8">
        <div className="relative md:col-span-2"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${inputClass} pl-9`} value={filter.q} onChange={e => setFilter(v => ({ ...v, q: e.target.value }))} placeholder="Cari uraian atau pihak..." /></div>
        <input type="date" className={inputClass} value={filter.from} onChange={e => setFilter(v => ({ ...v, from: e.target.value }))} />
        <input type="date" className={inputClass} value={filter.to} onChange={e => setFilter(v => ({ ...v, to: e.target.value }))} />
        <select className={inputClass} value={filter.accountId} onChange={e => setFilter(v => ({ ...v, accountId: e.target.value }))}><option value="">Semua akun</option>{masters.accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select className={inputClass} value={filter.categoryId} onChange={e => setFilter(v => ({ ...v, categoryId: e.target.value }))}><option value="">Semua kategori</option>{masters.categories.filter((c: any) => c.direction === direction).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className={inputClass} value={filter.status} onChange={e => setFilter(v => ({ ...v, status: e.target.value }))}><option value="POSTED">Terposting</option><option value="VOID">Void</option><option value="">Semua</option></select>
        <select className={inputClass} value={filter.limit} onChange={e => setFilter(v => ({ ...v, limit: e.target.value === 'all' ? 'all' : Number(e.target.value) as 20 | 50 | 100 }))}>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value="all" disabled={!Boolean(filter.q || filter.from || filter.to || filter.status)}>Semua (maks. 1.000)</option>
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={primary} onClick={() => setModal('transaction')}><Plus className="h-4 w-4" /> Catat {direction === 'INCOME' ? 'pemasukan' : 'pengeluaran'}</button>
        <button className={secondary} onClick={() => setModal('transfer')}><ArrowRightLeft className="h-4 w-4" /> Transfer akun</button>
        <button className={secondary} onClick={() => setModal('master')}><Landmark className="h-4 w-4" /> Akun & kategori</button>
      </div>
    </div>
    {rows.length === 0 ? <EmptyState title="Belum ada transaksi" description="Catat transaksi atau ubah filter ledger." /> : <div className="space-y-3">{rows.map(row => <article key={row.id} className={`rounded-2xl border bg-white p-4 ${row.status === 'VOID' ? 'border-rose-200 opacity-70' : 'border-slate-200'}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-black ${direction === 'INCOME' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{row.transaction_type}</span>{row.status === 'VOID' ? <span className="rounded-full bg-rose-600 px-2 py-1 text-[11px] font-black text-white">VOID</span> : null}<span className="text-xs font-bold text-slate-400">{row.transaction_date}</span></div><h3 className="mt-2 font-black">{row.description}</h3><p className="text-xs text-slate-500">{row.account_name}{row.category_name ? ` · ${row.category_name}` : ''}{row.counterparty ? ` · ${row.counterparty}` : ''}</p>{row.void_reason ? <p className="mt-2 text-xs font-bold text-rose-700">Alasan: {row.void_reason}</p> : null}</div>
        <div className="sm:text-right"><p className={`text-lg font-black ${direction === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'}`}>{rupiah(row.amount_rupiah)}</p>{row.status === 'POSTED' && row.transaction_type !== 'REVERSAL' ? <button className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rose-700" onClick={() => { const reason = window.prompt('Alasan void/reversal:'); if (reason) run(voidFinanceTransaction({ transactionId: row.id, reason }), 'Transaksi dibatalkan dan reversal dibuat.', false) }}><Undo2 className="h-3.5 w-3.5" /> Void</button> : null}</div>
      </div>
    </article>)}</div>}
    {truncated ? <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700">Hasil “Semua” dibatasi 1.000 baris. Gunakan filter yang lebih spesifik.</p> : null}
    {hasMore && nextCursor ? <button className={`${secondary} w-full`} onClick={() => load(nextCursor, true)}>Muat berikutnya</button> : null}
    {modal === 'transaction' ? <TransactionModal direction={direction} masters={masters} pending={pending} onClose={() => setModal(null)} onSave={(data: any) => run(createFinanceTransaction(data), 'Transaksi terposting.')} /> : null}
    {modal === 'transfer' ? <TransferModal masters={masters} pending={pending} onClose={() => setModal(null)} onSave={(data: any) => run(createTransfer(data), 'Transfer antar-akun terposting.')} /> : null}
    {modal === 'master' ? <MasterModal masters={masters} pending={pending} onClose={() => setModal(null)} onAccount={(data: any) => run(saveCashAccount(data), 'Akun disimpan.', false)} onCategory={(data: any) => run(saveFinanceCategory(data), 'Kategori disimpan.', false)} /> : null}
  </section>
}

function TransactionModal({ direction, masters, pending, onClose, onSave }: any) {
  const [type, setType] = useState(direction)
  return <Modal title={`Catat ${direction === 'INCOME' ? 'pemasukan' : 'pengeluaran'}`} onClose={onClose}><form className="space-y-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ transactionDate: f.get('date'), transactionType: type, accountId: f.get('account'), categoryId: f.get('category'), amountRupiah: Number(f.get('amount')), counterparty: f.get('counterparty'), description: f.get('description'), receiptUrl: f.get('receipt') }) }}>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Tanggal"><input name="date" type="date" className={inputClass} defaultValue={toWibDateInputValue()} required /></Field><Field label="Jenis"><select className={inputClass} value={type} onChange={e => setType(e.target.value)}><option value={direction}>{direction === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}</option><option value="OPENING">Saldo awal</option></select></Field></div>
    <Field label="Akun"><select name="account" className={inputClass} required><option value="">Pilih akun</option>{masters.accounts.filter((a: any) => a.is_active).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
    {type !== 'OPENING' ? <Field label="Kategori"><select name="category" className={inputClass} required><option value="">Pilih kategori</option>{masters.categories.filter((c: any) => c.direction === direction && c.is_active).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field> : null}
    <Field label="Nominal"><input name="amount" type="number" min="1" className={inputClass} required /></Field>
    <Field label="Sumber/penerima"><input name="counterparty" className={inputClass} /></Field>
    <Field label="Uraian"><textarea name="description" className={inputClass} required /></Field>
    <Field label="URL bukti"><input name="receipt" type="url" className={inputClass} /></Field>
    <div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={onClose}>Batal</button><button className={primary} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Posting</button></div>
  </form></Modal>
}

function TransferModal({ masters, pending, onClose, onSave }: any) {
  return <Modal title="Transfer antar-akun" onClose={onClose}><form className="space-y-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ transactionDate: f.get('date'), fromAccountId: f.get('from'), toAccountId: f.get('to'), amountRupiah: Number(f.get('amount')), description: f.get('description') }) }}>
    <Field label="Tanggal"><input name="date" type="date" className={inputClass} defaultValue={toWibDateInputValue()} required /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Dari akun"><select name="from" className={inputClass} required><option value="">Pilih</option>{masters.accounts.filter((a: any) => a.is_active).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field><Field label="Ke akun"><select name="to" className={inputClass} required><option value="">Pilih</option>{masters.accounts.filter((a: any) => a.is_active).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></div>
    <Field label="Nominal"><input name="amount" type="number" min="1" className={inputClass} required /></Field>
    <Field label="Uraian"><textarea name="description" className={inputClass} /></Field>
    <div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={onClose}>Batal</button><button className={primary} disabled={pending}>Transfer</button></div>
  </form></Modal>
}

function MasterModal({ masters, pending, onClose, onAccount, onCategory }: any) {
  return <Modal title="Akun dan kategori" onClose={onClose} wide><div className="grid gap-5 md:grid-cols-2">
    <form className="space-y-3 rounded-2xl bg-slate-50 p-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onAccount({ name: f.get('name'), accountType: f.get('type') }) }}><h3 className="font-black">Tambah akun</h3><Field label="Nama"><input name="name" className={inputClass} required /></Field><Field label="Jenis"><select name="type" className={inputClass}><option value="CASH">Kas</option><option value="BANK">Bank</option><option value="EWALLET">E-wallet</option></select></Field><button className={primary} disabled={pending}>Simpan akun</button><div className="space-y-1 text-sm">{masters.accounts.map((a: any) => <p key={a.id} className="flex justify-between rounded-lg bg-white p-2"><span>{a.name}</span><strong>{rupiah(a.balance)}</strong></p>)}</div></form>
    <form className="space-y-3 rounded-2xl bg-slate-50 p-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onCategory({ name: f.get('name'), direction: f.get('direction') }) }}><h3 className="font-black">Tambah kategori</h3><Field label="Nama"><input name="name" className={inputClass} required /></Field><Field label="Arah"><select name="direction" className={inputClass}><option value="INCOME">Pemasukan</option><option value="EXPENSE">Pengeluaran</option></select></Field><button className={primary} disabled={pending}>Simpan kategori</button><div className="space-y-1 text-sm">{masters.categories.map((c: any) => <p key={c.id} className="flex justify-between rounded-lg bg-white p-2"><span>{c.name}</span><span className="text-xs font-bold text-slate-500">{c.direction}{c.is_system ? ' · sistem' : ''}</span></p>)}</div></form>
  </div></Modal>
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"><div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl ${wide ? 'max-w-4xl' : 'max-w-xl'}`}><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><button type="button" className={secondary} onClick={onClose}>Tutup</button></div>{children}</div></div>
}
