'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, FileCsv, MagnifyingGlass, Warning } from '@phosphor-icons/react'
import {
  approveReopenAction,
  closePeriodAction,
  createBillAction,
  importBankAction,
  manualMatchBankAction,
  reopenPeriodAction,
  reviewLateTopupAction,
  settlementAction,
  voidBillAction,
} from './actions'
import { MetricCard, SectionPanel, StatusBadge } from '../_components/finance-ui'

const field = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500'
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const shortId = (value: string | null | undefined) => value ? `${value.slice(0, 8)}…` : '—'

type OperationsData = {
  periods: any[]
  imports: any[]
  bankTransactions: any[]
  journalCandidates: any[]
  paymentReviews: any[]
  bills: any[]
}

export function OperationsClient({ data }: { data: OperationsData }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [bankFilter, setBankFilter] = useState<'UNMATCHED' | 'ALL'>('UNMATCHED')
  const [bankSearch, setBankSearch] = useState('')
  const closed = data.periods.filter(period => period.status === 'CLOSED').length
  const unmatched = data.bankTransactions.filter(row => row.match_status === 'UNMATCHED')
  const filteredTransactions = useMemo(() => {
    const needle = bankSearch.trim().toLowerCase()
    return data.bankTransactions.filter(row => {
      if (bankFilter === 'UNMATCHED' && row.match_status !== 'UNMATCHED') return false
      if (!needle) return true
      return [row.bank_reference, row.description, row.source_filename, row.bank_account_label]
        .some(value => String(value || '').toLowerCase().includes(needle))
    })
  }, [bankFilter, bankSearch, data.bankTransactions])

  function mutate(work: () => Promise<any>, success: string) {
    startTransition(async () => {
      try {
        const result = await work()
        if (!result?.success) {
          toast.error(result?.error || 'Tindakan tidak dapat diproses.')
          return
        }
        toast.success(success)
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Tindakan tidak dapat diproses.')
      }
    })
  }

  function candidatesFor(amount: number) {
    const exact = data.journalCandidates.filter(row => Number(row.bank_amount_rupiah) === Number(amount))
    return exact.length ? exact : data.journalCandidates
  }

  return <div className="space-y-4 sm:space-y-5">
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Mutasi belum cocok" value={String(unmatched.length)} detail={`${data.bankTransactions.length} mutasi terbaru dimuat`} icon="fileSpreadsheet" tone={unmatched.length ? 'amber' : 'emerald'} />
      <MetricCard label="Top-up perlu review" value={String(data.paymentReviews.length)} detail="Pembayaran diterima setelah kedaluwarsa" icon="listChecks" tone={data.paymentReviews.length ? 'amber' : 'emerald'} />
      <MetricCard label="Tagihan terbaru" value={String(data.bills.length)} detail="30 tagihan terbaru tersedia" icon="receipt" />
      <MetricCard label="Periode ditutup" value={String(closed)} detail="Riwayat 24 periode terakhir" icon="lock" tone="slate" />
    </section>

    <section id="review" className="scroll-mt-24 grid gap-4 xl:grid-cols-2">
      <SectionPanel title="Review top-up terlambat" description="Pastikan dana benar-benar diterima dan tidak terduplikasi sebelum menutup review.">
        <div className="divide-y divide-slate-100">
          {data.paymentReviews.length ? data.paymentReviews.map(row => <article key={row.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><Warning className="h-5 w-5 text-amber-600" /><strong className="text-sm text-slate-900">{row.nama_lengkap || 'Santri tidak tersinkron'}</strong></div>
                <p className="mt-1 text-xs text-slate-500">{row.nis || 'NIS —'} · {row.merchant_order_id}</p>
              </div>
              <div className="text-right"><StatusBadge tone="amber">REQUIRED</StatusBadge><strong className="mt-1 block text-sm tabular-nums">{rupiah(row.amount_rupiah)}</strong></div>
            </div>
            <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-2">
              <p><span className="text-slate-500">Kedaluwarsa</span><strong className="mt-0.5 block">{row.expires_at}</strong></p>
              <p><span className="text-slate-500">Dibayar</span><strong className="mt-0.5 block">{row.paid_at || '—'}</strong></p>
            </div>
            <form action={form => mutate(() => reviewLateTopupAction(form), 'Top-up ditandai sudah direview.')} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="paymentIntentId" value={row.id} />
              <input name="note" required minLength={10} placeholder="Catatan pemeriksaan dan hasil konfirmasi" className={field} />
              <button disabled={pending} className="min-h-11 shrink-0 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white disabled:opacity-50">Selesaikan review</button>
            </form>
          </article>) : <div className="p-10 text-center text-sm text-slate-500"><CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-500" />Tidak ada top-up terlambat yang menunggu review.</div>}
        </div>
      </SectionPanel>

      <SectionPanel title="Riwayat impor mutasi" description="Status matching per berkas dan hasil deduplikasi impor.">
        <div className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
          {data.imports.length ? data.imports.map(row => <article key={row.id} className="space-y-2 px-4 py-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><strong className="block truncate text-slate-800">{row.source_filename}</strong><span className="text-slate-500">{row.bank_account_label} · {row.created_at}</span></div>
              <StatusBadge tone={row.status === 'FAILED' ? 'red' : row.status === 'READY' ? 'emerald' : 'amber'}>{row.status}</StatusBadge>
            </div>
            <div className="flex flex-wrap gap-3 text-slate-600"><span>{row.row_count} baris</span><span className="text-emerald-700">{Number(row.matched_count || 0)} cocok</span><span className={Number(row.unmatched_count) ? 'font-bold text-amber-700' : 'text-slate-500'}>{Number(row.unmatched_count || 0)} belum cocok</span></div>
            {row.error_message ? <p className="rounded bg-red-50 p-2 text-red-700">{row.error_message}</p> : null}
          </article>) : <div className="p-10 text-center text-sm text-slate-500"><FileCsv className="mx-auto mb-2 h-8 w-8 text-slate-300" />Belum ada berkas mutasi yang diimpor.</div>}
        </div>
      </SectionPanel>
    </section>

    <SectionPanel title="Tindakan operasional" description="Setiap tindakan menampilkan hasil dan memperbarui antrean tanpa menghilangkan error backend.">
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <details className="rounded-lg border border-slate-200 bg-slate-50 open:bg-white">
          <summary className="cursor-pointer p-3 text-sm font-bold">Buat tagihan</summary>
          <form action={form => mutate(() => createBillAction(form), 'Tagihan berhasil dibuat.')} className="grid gap-2 border-t p-3">
            <label className="text-xs font-bold">NIS<input name="nis" required placeholder="NIS santri" className={`mt-1 ${field}`} /></label>
            <label className="text-xs font-bold">Jenis<select name="kind" className={`mt-1 ${field}`}><option value="SPP">SPP — wajib lunas</option><option value="NON_SPP">Non-SPP — wajib lunas</option><option value="USPP">USPP — boleh dicicil</option></select></label>
            <input name="title" required placeholder="Nama tagihan" className={field} />
            <input name="period" placeholder="Periode YYYY-MM" className={field} />
            <input name="amount" type="number" required min={1} placeholder="Nominal rupiah" className={field} />
            <input name="dueDate" type="date" className={field} />
            <button disabled={pending} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50">Buat tagihan</button>
          </form>
        </details>
        <details className="rounded-lg border border-slate-200 bg-slate-50 open:bg-white">
          <summary className="cursor-pointer p-3 text-sm font-bold">Impor mutasi bank</summary>
          <form action={form => mutate(() => importBankAction(form), 'Mutasi berhasil diimpor dan diproses.')} className="grid gap-2 border-t p-3">
            <input name="bankLabel" required defaultValue="Rekening Utama" className={field} />
            <input name="file" type="file" accept=".csv,.xls,.xlsx" required className={`${field} p-1.5`} />
            <p className="text-xs text-slate-500">CSV/XLS/XLSX maksimal 10 MB; berkas sama tidak diimpor dua kali.</p>
            <button disabled={pending} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50">Impor & auto-match</button>
          </form>
        </details>
        <details className="rounded-lg border border-slate-200 bg-slate-50 open:bg-white">
          <summary className="cursor-pointer p-3 text-sm font-bold">Posting settlement</summary>
          <form action={form => mutate(() => settlementAction(form), 'Settlement berhasil diposting.')} className="grid gap-2 border-t p-3">
            <input name="reference" required placeholder="Referensi settlement" className={field} />
            <input name="date" type="date" required className={field} />
            <input name="gross" type="number" required min={1} placeholder="Bruto" className={field} />
            <input name="fee" type="number" required min={0} placeholder="Biaya provider" className={field} />
            <input name="net" type="number" required min={1} placeholder="Neto" className={field} />
            <button disabled={pending} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50">Posting settlement</button>
          </form>
        </details>
        <details className="rounded-lg border border-amber-200 bg-amber-50 open:bg-white">
          <summary className="cursor-pointer p-3 text-sm font-bold text-amber-900">Tutup buku bulanan</summary>
          <form action={form => mutate(() => closePeriodAction(form), 'Periode berhasil ditutup.')} className="grid gap-2 border-t border-amber-100 p-3">
            <input name="period" type="month" required className={field} />
            <p className="text-xs text-amber-800">Mutasi, payout, draft jurnal, dan suspense harus sudah bersih.</p>
            <button disabled={pending} className="min-h-11 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-50">Tutup periode</button>
          </form>
        </details>
      </div>
    </SectionPanel>

    <SectionPanel title="Mutasi bank & pencocokan jurnal" description="Buka detail mutasi, lalu cocokkan mutasi yang belum terselesaikan ke satu jurnal terposting.">
      <div id="reconciliation" className="scroll-mt-24 border-b border-slate-100 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
            <button onClick={() => setBankFilter('UNMATCHED')} className={`min-h-9 rounded-md px-3 ${bankFilter === 'UNMATCHED' ? 'bg-white text-amber-800 shadow-sm' : 'text-slate-500'}`}>Belum cocok ({unmatched.length})</button>
            <button onClick={() => setBankFilter('ALL')} className={`min-h-9 rounded-md px-3 ${bankFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Semua ({data.bankTransactions.length})</button>
          </div>
          <label className="relative block sm:w-80"><MagnifyingGlass className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={bankSearch} onChange={event => setBankSearch(event.target.value)} placeholder="Cari referensi, uraian, atau berkas" className={`${field} pl-9`} /></label>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {filteredTransactions.length ? filteredTransactions.map(row => {
          const candidates = candidatesFor(row.amount_rupiah)
          const hasExact = candidates.some(candidate => Number(candidate.bank_amount_rupiah) === Number(row.amount_rupiah))
          return <details key={row.id} className="group">
            <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 text-xs hover:bg-slate-50 sm:grid-cols-[120px_1fr_150px_120px] sm:items-center">
              <span className="tabular-nums text-slate-500">{row.transaction_at}</span>
              <span className="min-w-0"><strong className="block truncate text-slate-800">{row.description || 'Tanpa keterangan'}</strong><span className="font-mono text-[10px] text-slate-400">{row.bank_reference || 'Tanpa referensi'}</span></span>
              <strong className={`tabular-nums sm:text-right ${Number(row.amount_rupiah) < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{rupiah(row.amount_rupiah)}</strong>
              <span className="sm:text-right"><StatusBadge tone={row.match_status === 'UNMATCHED' ? 'amber' : row.match_status === 'IGNORED' ? 'slate' : 'emerald'}>{row.match_status}</StatusBadge></span>
            </summary>
            <div className="border-t border-slate-100 bg-slate-50/60 p-4">
              <div className="grid gap-3 text-xs sm:grid-cols-4">
                <p><span className="text-slate-500">Sumber</span><strong className="mt-1 block">{row.bank_account_label}</strong></p>
                <p><span className="text-slate-500">Berkas / baris</span><strong className="mt-1 block">{row.source_filename} · {row.row_number}</strong></p>
                <p><span className="text-slate-500">Target saat ini</span><strong className="mt-1 block font-mono">{row.matched_type ? `${row.matched_type} · ${shortId(row.matched_id)}` : '—'}</strong></p>
                <p><span className="text-slate-500">Dicocokkan</span><strong className="mt-1 block">{row.matched_at || '—'}</strong></p>
              </div>
              {row.match_status === 'UNMATCHED' ? <form action={form => mutate(() => manualMatchBankAction(form), 'Mutasi berhasil dicocokkan.')} className="mt-4 grid gap-2 rounded-lg border border-amber-200 bg-white p-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <input type="hidden" name="bankTransactionId" value={row.id} />
                <label className="text-xs font-bold text-slate-700">Jurnal terposting
                  <select name="journalId" required defaultValue="" className={`mt-1.5 ${field}`}>
                    <option value="" disabled>Pilih jurnal {hasExact ? 'dengan nominal yang cocok' : 'secara manual'}</option>
                    {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.effective_date} · {candidate.description} · {rupiah(candidate.bank_amount_rupiah)} · {shortId(candidate.external_reference || candidate.id)}</option>)}
                  </select>
                </label>
                <button disabled={pending || !candidates.length} className="min-h-11 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">Cocokkan mutasi</button>
                {!hasExact ? <p className="text-[11px] text-amber-800 lg:col-span-2">Tidak ada kandidat bernominal sama. Pastikan jurnal yang dipilih memang mewakili mutasi ini.</p> : null}
              </form> : null}
            </div>
          </details>
        }) : <div className="p-10 text-center text-sm text-slate-500"><CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-500" />Tidak ada mutasi yang sesuai filter.</div>}
      </div>
    </SectionPanel>

    <section className="grid gap-4 xl:grid-cols-2">
      <SectionPanel title="Periode pembukuan" description="Reopen membutuhkan dua persetujuan dari orang berbeda.">
        <div className="divide-y divide-slate-100">{data.periods.length ? data.periods.map(period => <article key={period.period_key} className="px-4 py-3 text-xs">
          <div className="flex items-center justify-between"><strong>{period.period_key}</strong><StatusBadge tone={period.status === 'CLOSED' ? 'slate' : 'emerald'}>{period.status}</StatusBadge></div>
          <p className="mt-1 text-slate-500">{period.approval_count} persetujuan reopen</p>
          {period.status === 'CLOSED' ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <form action={form => mutate(() => approveReopenAction(form), 'Persetujuan reopen dicatat.')} className="grid gap-2">
              <input type="hidden" name="period" value={period.period_key} /><input name="reason" required minLength={10} placeholder="Alasan persetujuan" className={field} /><button disabled={pending} className="min-h-11 rounded-lg border border-slate-200 px-3 font-bold disabled:opacity-50">Setujui</button>
            </form>
            <form action={form => mutate(() => reopenPeriodAction(form), 'Periode berhasil dibuka kembali.')} className="grid gap-2">
              <input type="hidden" name="period" value={period.period_key} /><input name="reason" required minLength={10} placeholder="Alasan final" className={field} /><button disabled={pending} className="min-h-11 rounded-lg bg-amber-600 px-3 font-bold text-white disabled:opacity-50">Reopen</button>
            </form>
          </div> : null}
        </article>) : <p className="p-10 text-center text-sm text-slate-500">Belum ada periode pembukuan.</p>}</div>
      </SectionPanel>

      <SectionPanel title="Tagihan terbaru" description="Validasi hasil pembuatan dan status pembayaran tagihan.">
        <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[680px] text-xs"><thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Santri</th><th className="px-4 py-2.5">Tagihan</th><th className="px-4 py-2.5 text-right">Nominal</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Tindakan</th></tr></thead><tbody className="divide-y divide-slate-100">{data.bills.length ? data.bills.map(bill => <tr key={bill.id}><td className="px-4 py-3 font-semibold">{bill.nama_lengkap}<span className="block text-[10px] text-slate-400">{bill.nis}</span></td><td className="px-4 py-3">{bill.title}</td><td className="px-4 py-3 text-right font-bold tabular-nums">{rupiah(bill.amount_rupiah)}</td><td className="px-4 py-3"><StatusBadge tone={bill.status === 'PAID' ? 'emerald' : bill.status === 'VOID' ? 'slate' : 'amber'}>{bill.status}</StatusBadge></td><td className="px-4 py-3">{bill.status === 'OPEN' && Number(bill.paid_rupiah) === 0 ? <form action={form => mutate(() => voidBillAction(form), 'Tagihan berhasil di-void.')} className="flex min-w-[260px] gap-2"><input type="hidden" name="billId" value={bill.id} /><input name="reason" required minLength={10} placeholder="Alasan void" className={`${field} min-h-9`} /><button disabled={pending} className="min-h-9 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 font-bold text-red-700 disabled:opacity-50">Void</button></form> : '—'}</td></tr>) : <tr><td colSpan={5} className="p-10 text-center text-slate-500">Belum ada tagihan baru.</td></tr>}</tbody></table></div>
        <div className="divide-y divide-slate-100 sm:hidden">{data.bills.length ? data.bills.map(bill => <article key={bill.id} className="space-y-2 px-4 py-3 text-xs"><div className="flex items-start justify-between gap-3"><div><strong>{bill.nama_lengkap}</strong><p className="text-slate-500">{bill.title}</p></div><StatusBadge tone={bill.status === 'PAID' ? 'emerald' : bill.status === 'VOID' ? 'slate' : 'amber'}>{bill.status}</StatusBadge></div><strong className="tabular-nums">{rupiah(bill.amount_rupiah)}</strong>{bill.status === 'OPEN' && Number(bill.paid_rupiah) === 0 ? <form action={form => mutate(() => voidBillAction(form), 'Tagihan berhasil di-void.')} className="grid gap-2"><input type="hidden" name="billId" value={bill.id} /><input name="reason" required minLength={10} placeholder="Alasan void" className={field} /><button disabled={pending} className="min-h-11 rounded-lg border border-red-200 bg-red-50 font-bold text-red-700 disabled:opacity-50">Void tagihan</button></form> : null}</article>) : <p className="p-10 text-center text-slate-500">Belum ada tagihan baru.</p>}</div>
      </SectionPanel>
    </section>
  </div>
}
