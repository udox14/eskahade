'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowsCounterClockwise, CheckCircle, MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react'
import { MetricCard, SectionPanel, StatusBadge } from '../_components/finance-ui'
import { postManualJournalAction, reverseManualJournalAction } from './actions'

const field = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500'
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())

type Line = { key: number; side: 'DEBIT' | 'CREDIT' }

export function LedgerClient({ data, initialSearch = '' }: { data: any; initialSearch?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialSearch)
  const [source, setSource] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [lines, setLines] = useState<Line[]>([{ key: 1, side: 'DEBIT' }, { key: 2, side: 'CREDIT' }])
  const sources = useMemo(() => [...new Set<string>(data.journals.map((row: any) => row.source_type))].sort(), [data.journals])
  const entriesByJournal = useMemo(() => {
    const result = new Map<string, any[]>()
    for (const entry of data.entries) result.set(entry.journal_id, [...(result.get(entry.journal_id) || []), entry])
    return result
  }, [data.entries])
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return data.journals.filter((row: any) => {
      if (source !== 'ALL' && row.source_type !== source) return false
      if (status !== 'ALL' && row.status !== status) return false
      if (from && row.effective_date < from) return false
      if (to && row.effective_date > to) return false
      return !needle || [row.description, row.external_reference, row.id, row.source_id, row.source_type].some(value => String(value || '').toLowerCase().includes(needle))
    })
  }, [data.journals, from, search, source, status, to])

  function mutate(work: () => Promise<any>, success: string) {
    startTransition(async () => {
      try {
        const result = await work()
        if (!result?.success) { toast.error(result?.error || 'Tindakan gagal diproses.'); return }
        toast.success(result.duplicate ? 'Permintaan ini sudah pernah diproses.' : success)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Tindakan gagal diproses.')
      }
    })
  }

  return <div className="space-y-4 sm:space-y-5">
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Jurnal dimuat" value={String(data.journals.length)} detail="250 jurnal terbaru sesuai scope" icon="fileSpreadsheet" tone="blue" />
      <MetricCard label="Terposting" value={String(data.totals.posted?.count || 0)} detail="Seluruh jurnal berstatus posted" icon="checkCircle" tone="emerald" />
      <MetricCard label="Draft" value={String(data.totals.draft?.count || 0)} detail="Harus bersih sebelum tutup buku" icon="listChecks" tone={data.totals.draft?.count ? 'amber' : 'slate'} />
      <MetricCard label="Scope" value={data.scope || 'Global'} detail="Batas data yang sedang ditampilkan" icon="layers" tone="slate" />
    </section>

    {data.canExecute ? <SectionPanel title="Posting jurnal manual" description="Gunakan hanya untuk penyesuaian akuntansi yang memiliki dokumen sumber; debit dan kredit wajib seimbang.">
      <details>
        <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-emerald-700">Buka formulir jurnal manual</summary>
        <form action={form => mutate(() => postManualJournalAction(form), 'Jurnal manual berhasil diposting.')} className="space-y-4 border-t border-slate-100 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-bold">Tanggal efektif<input name="effectiveDate" type="date" required defaultValue={today} className={`mt-1.5 ${field}`} /></label>
            <label className="text-xs font-bold">Referensi dokumen<input name="externalReference" required minLength={3} placeholder="Contoh: ADJ-2026-001" className={`mt-1.5 ${field}`} /></label>
            <label className="text-xs font-bold md:col-span-1">Keterangan<input name="description" required minLength={5} placeholder="Tujuan penyesuaian" className={`mt-1.5 ${field}`} /></label>
          </div>
          <div className="space-y-2">{lines.map((line, index) => <div key={line.key} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[160px_1fr_180px_140px_140px_1fr_auto] md:items-end">
            <label className="text-[11px] font-bold">Posisi<select name="side" value={line.side} onChange={event => setLines(current => current.map(item => item.key === line.key ? { ...item, side: event.target.value as Line['side'] } : item))} className={`mt-1 ${field}`}><option value="DEBIT">Debit</option><option value="CREDIT">Kredit</option></select></label>
            <label className="text-[11px] font-bold">Akun<select name="accountCode" required defaultValue="" className={`mt-1 ${field}`}><option value="" disabled>Pilih akun</option>{data.accounts.map((account: any) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}</select></label>
            <label className="text-[11px] font-bold">Nominal<input name="amountRupiah" type="number" required min={1} className={`mt-1 ${field}`} /></label>
            <label className="text-[11px] font-bold">NIS opsional<input name="nis" placeholder="NIS" className={`mt-1 ${field}`} /></label>
            <label className="text-[11px] font-bold">Scope opsional<input name="asramaScope" placeholder="Asrama" className={`mt-1 ${field}`} /></label>
            <label className="text-[11px] font-bold">Memo<input name="memo" placeholder={`Baris ${index + 1}`} className={`mt-1 ${field}`} /></label>
            <button type="button" aria-label="Hapus baris" disabled={lines.length <= 2} onClick={() => setLines(current => current.filter(item => item.key !== line.key))} className="grid min-h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-30"><Trash /></button>
          </div>)}</div>
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <button type="button" onClick={() => setLines(current => [...current, { key: Math.max(...current.map(item => item.key)) + 1, side: current.at(-1)?.side === 'DEBIT' ? 'CREDIT' : 'DEBIT' }])} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold"><Plus />Tambah baris</button>
            <button disabled={pending} className="min-h-11 rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-50">Validasi & posting jurnal</button>
          </div>
        </form>
      </details>
    </SectionPanel> : null}

    <SectionPanel title="Ledger jurnal" description="Filter dan buka satu jurnal untuk melihat baris debit/kredit, scope, santri, serta relasi reversal.">
      <div className="grid gap-2 border-b border-slate-100 p-3 md:grid-cols-[1fr_180px_140px_150px_150px]">
        <label className="relative"><MagnifyingGlass className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari keterangan, referensi, atau ID" className={`${field} pl-9`} /></label>
        <select value={source} onChange={event => setSource(event.target.value)} className={field}><option value="ALL">Semua sumber</option>{sources.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <select value={status} onChange={event => setStatus(event.target.value)} className={field}><option value="ALL">Semua status</option><option value="POSTED">POSTED</option><option value="DRAFT">DRAFT</option></select>
        <input type="date" aria-label="Tanggal mulai" value={from} onChange={event => setFrom(event.target.value)} className={field} />
        <input type="date" aria-label="Tanggal akhir" value={to} onChange={event => setTo(event.target.value)} className={field} />
      </div>
      <div className="divide-y divide-slate-100">
        {filtered.length ? filtered.map((journal: any) => {
          const entries = entriesByJournal.get(journal.id) || []
          const canReverse = data.canExecute && journal.status === 'POSTED' && journal.source_type === 'MANUAL' && !journal.reversal_of_id && !journal.reversed_by_id
          return <details key={journal.id}>
            <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 text-xs hover:bg-slate-50 sm:grid-cols-[100px_1fr_130px_160px_110px] sm:items-center">
              <span className="tabular-nums text-slate-500">{journal.effective_date}</span>
              <span className="min-w-0"><strong className="block truncate text-slate-800">{journal.description}</strong><span className="font-mono text-[10px] text-slate-400">{journal.external_reference || journal.id}</span></span>
              <span><StatusBadge tone={journal.source_type === 'REVERSAL' ? 'amber' : 'blue'}>{journal.source_type}</StatusBadge></span>
              <strong className="tabular-nums sm:text-right">{rupiah(journal.debit_rupiah)}</strong>
              <span className="sm:text-right"><StatusBadge tone={journal.status === 'POSTED' ? 'emerald' : 'amber'}>{journal.status}</StatusBadge></span>
            </summary>
            <div className="border-t border-slate-100 bg-slate-50/60 p-4">
              <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-500"><span>ID: <code>{journal.id}</code></span><span>Dibuat: {journal.created_at}</span>{journal.reversal_of_id ? <span>Reversal dari: <code>{journal.reversal_of_id}</code></span> : null}{journal.reversed_by_id ? <span>Direversal oleh: <code>{journal.reversed_by_id}</code></span> : null}</div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[720px] text-xs"><thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Akun</th><th className="px-3 py-2">Memo</th><th className="px-3 py-2">Santri / scope</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Kredit</th></tr></thead><tbody className="divide-y divide-slate-100">{entries.map(entry => <tr key={entry.id}><td className="px-3 py-2"><strong>{entry.account_code}</strong><span className="ml-1 text-slate-500">{entry.account_name}</span></td><td className="px-3 py-2 text-slate-600">{entry.memo || '—'}</td><td className="px-3 py-2"><span>{entry.student_name || entry.nis || '—'}</span><span className="block text-[10px] text-slate-400">{entry.asrama_scope || 'Scope global'}</span></td><td className="px-3 py-2 text-right font-bold tabular-nums">{entry.side === 'DEBIT' ? rupiah(entry.amount_rupiah) : '—'}</td><td className="px-3 py-2 text-right font-bold tabular-nums">{entry.side === 'CREDIT' ? rupiah(entry.amount_rupiah) : '—'}</td></tr>)}</tbody></table></div>
              {canReverse ? <form action={form => mutate(() => reverseManualJournalAction(form), 'Jurnal manual berhasil direversal.')} className="mt-3 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 sm:flex-row">
                <input type="hidden" name="journalId" value={journal.id} />
                <input name="reason" required minLength={10} placeholder="Alasan reversal dan referensi koreksi" className={field} />
                <button disabled={pending} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-xs font-bold text-white disabled:opacity-50"><ArrowsCounterClockwise />Reversal jurnal</button>
              </form> : null}
            </div>
          </details>
        }) : <div className="p-12 text-center text-sm text-slate-500"><CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-500" />Tidak ada jurnal yang sesuai filter.</div>}
      </div>
    </SectionPanel>
  </div>
}
