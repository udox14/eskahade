'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowsCounterClockwise, CheckCircle, MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react'
import {
  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS, FinanceTour, MetricCard, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'
import { postManualJournalAction, reverseManualJournalAction } from './actions'
import { ExportButton, RupiahInput } from '../_components/finance-inputs'
import { useDraft } from '../_components/use-draft'
import { ALL_ASRAMA_LIST } from '@/lib/asrama'

const field = FINANCE_FIELD_CLASS
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())

/**
 * Seluruh isi baris disimpan di state (bukan sebagian saja) supaya draf yang
 * dipulihkan utuh — dulu nominal ada di state sementara akun, memo, NIS, dan
 * scope hanya hidup di DOM, sehingga tidak ada cara memulihkannya.
 */
type Line = {
  key: number
  side: 'DEBIT' | 'CREDIT'
  accountCode: string
  amount: number
  nis: string
  asramaScope: string
  memo: string
}

type JournalDraft = { effectiveDate: string; reference: string; description: string; lines: Line[] }

const emptyLine = (key: number, side: Line['side']): Line =>
  ({ key, side, accountCode: '', amount: 0, nis: '', asramaScope: '', memo: '' })

const emptyJournal = (): JournalDraft => ({
  effectiveDate: today,
  reference: '',
  description: '',
  lines: [emptyLine(1, 'DEBIT'), emptyLine(2, 'CREDIT')],
})

const TOUR: TourStep[] = [
  { target: '[data-tour="journal-form"]', title: 'Jurnal manual hanya untuk penyesuaian', body: 'Transaksi biasa sudah membuat jurnalnya sendiri. Formulir ini untuk koreksi akuntansi yang punya dokumen sumber.' },
  { target: '[data-tour="balance"]', title: 'Pantau keseimbangan langsung', body: 'Total debit harus sama persis dengan total kredit. Tombol posting terkunci selama belum seimbang, sehingga Anda tidak perlu menebak.' },
  { target: '[data-tour="filters"]', title: 'Telusuri jurnal', body: 'Saring berdasarkan sumber, status, dan rentang tanggal. Buka satu baris untuk melihat seluruh entri debit dan kreditnya.' },
  { target: '[data-tour="ledger-list"]', title: 'Jurnal tidak pernah dihapus', body: 'Jurnal yang sudah diposting bersifat permanen. Koreksi dilakukan dengan reversal — jurnal lawan yang menetralkan, bukan penghapusan.' },
]

export function LedgerClient({ data, initialSearch = '' }: { data: any; initialSearch?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialSearch)
  const [source, setSource] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const draft = useDraft<JournalDraft>('ledger-journal', emptyJournal())
  const { lines, reference } = draft.value
  const setLines = (next: (current: Line[]) => Line[]) => draft.setValue(current => ({ ...current, lines: next(current.lines) }))
  const patch = (changes: Partial<JournalDraft>) => draft.setValue(current => ({ ...current, ...changes }))
  const patchLine = (key: number, changes: Partial<Line>) =>
    setLines(current => current.map(item => item.key === key ? { ...item, ...changes } : item))
  const [result, setResult] = useState<FinanceResult | null>(null)
  const [reverseTarget, setReverseTarget] = useState<{ id: string; reason: string } | null>(null)
  const [confirmReverse, setConfirmReverse] = useState(false)
  const tour = useFinanceTour('ledger')

  const debitTotal = lines.filter(line => line.side === 'DEBIT').reduce((sum, line) => sum + line.amount, 0)
  const creditTotal = lines.filter(line => line.side === 'CREDIT').reduce((sum, line) => sum + line.amount, 0)
  const balanced = debitTotal > 0 && debitTotal === creditTotal
  /**
   * Referensi dokumen boleh dipakai ulang — kunci idempotensi mengikat isi
   * jurnal, bukan sekadar nomornya. Tetap diperingatkan agar bendahara sadar
   * satu nomor dokumen akan mewakili lebih dari satu jurnal.
   */
  const referenceReuse = useMemo(() => {
    const needle = reference.trim().toLowerCase()
    if (needle.length < 3) return 0
    return data.journals.filter((row: any) => String(row.external_reference || '').toLowerCase() === needle).length
  }, [data.journals, reference])
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

  function mutate(work: () => Promise<any>, success: string, onSuccess?: (outcome: any) => void) {
    startTransition(async () => {
      try {
        const outcome = await work()
        if (!outcome?.success) {
          const message = outcome?.error || 'Tindakan gagal diproses.'
          setResult({ tone: 'error', message })
          toast.error(message)
          return
        }
        if (outcome.duplicate) {
          // Jurnal yang identik tidak diposting ulang. Ini bukan keberhasilan
          // baru dan tidak boleh terlihat seperti transaksi tambahan.
          setResult({ tone: 'duplicate', message: 'Jurnal dengan isi persis sama sudah pernah diposting — tidak ada jurnal baru yang dibuat.' })
          toast.info('Jurnal duplikat, tidak diposting ulang.')
        } else {
          setResult({
            tone: 'success',
            message: success,
            detail: outcome.referenceReuseCount
              ? `Perhatian: nomor referensi ini kini dipakai ${outcome.referenceReuseCount + 1} jurnal berbeda.`
              : undefined,
          })
          toast.success(success)
        }
        onSuccess?.(outcome)
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tindakan gagal diproses.'
        setResult({ tone: 'error', message })
        toast.error(message)
      }
    })
  }

  return <div className="space-y-4 sm:space-y-5">
    <FinanceTour steps={TOUR} running={tour.running} onFinish={tour.finish} />
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Jurnal dimuat" value={String(data.journals.length)} detail="250 jurnal terbaru sesuai scope" icon="fileSpreadsheet" tone="blue" />
      <MetricCard label="Terposting" value={String(data.totals.posted?.count || 0)} detail="Seluruh jurnal berstatus posted" icon="checkCircle" tone="emerald" />
      <MetricCard label="Draft" value={String(data.totals.draft?.count || 0)} detail="Harus bersih sebelum tutup buku" icon="listChecks" tone={data.totals.draft?.count ? 'amber' : 'slate'} />
      <MetricCard label="Scope" value={data.scope || 'Global'} detail="Batas data yang sedang ditampilkan" icon="layers" tone="slate" />
    </section>

    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    {data.canConfigure ? <SectionPanel title="Posting jurnal manual" description="Gunakan hanya untuk penyesuaian akuntansi yang memiliki dokumen sumber; debit dan kredit wajib seimbang.">
      <details data-tour="journal-form">
        <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-emerald-700">Buka formulir jurnal manual</summary>
        <form action={form => mutate(() => postManualJournalAction(form), 'Jurnal manual berhasil diposting.', () => draft.clear())} className="space-y-4 border-t border-slate-100 p-4">
          {draft.restored ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
            <span>Draf jurnal yang belum diposting dipulihkan. Periksa lagi sebelum memposting.</span>
            <div className="flex gap-2">
              <button type="button" onClick={draft.dismissRestored} className="font-bold underline">Lanjutkan</button>
              <button type="button" onClick={draft.clear} className="font-bold underline">Kosongkan</button>
            </div>
          </div> : null}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-bold">Tanggal efektif<input name="effectiveDate" type="date" required value={draft.value.effectiveDate} onChange={event => patch({ effectiveDate: event.target.value })} className={`mt-1.5 ${field}`} /><span className="mt-1 block text-[11px] font-normal text-slate-500">Periode yang sudah ditutup akan menolak jurnal ini.</span></label>
            <label className="text-xs font-bold">Referensi dokumen<input name="externalReference" required minLength={3} value={reference} onChange={event => patch({ reference: event.target.value })} placeholder="Contoh: ADJ-2026-001" className={`mt-1.5 ${field}`} />
              {referenceReuse
                ? <span className="mt-1 block text-[11px] font-semibold text-amber-800">Nomor ini sudah dipakai {referenceReuse} jurnal lain. Jurnal tetap akan diposting selama isinya berbeda.</span>
                : <span className="mt-1 block text-[11px] font-normal text-slate-500">Nomor dokumen sumber; dipakai juga untuk pencocokan mutasi bank.</span>}
            </label>
            <label className="text-xs font-bold md:col-span-1">Keterangan<input name="description" required minLength={5} value={draft.value.description} onChange={event => patch({ description: event.target.value })} placeholder="Tujuan penyesuaian" className={`mt-1.5 ${field}`} /></label>
          </div>
          <div className="space-y-2">{lines.map((line, index) => <div key={line.key} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[160px_1fr_180px_140px_140px_1fr_auto] md:items-end">
            <label className="text-[11px] font-bold">Posisi<select name="side" value={line.side} onChange={event => patchLine(line.key, { side: event.target.value as Line['side'] })} className={`mt-1 ${field}`}><option value="DEBIT">Debit</option><option value="CREDIT">Kredit</option></select></label>
            <label className="text-[11px] font-bold">Akun<select name="accountCode" required value={line.accountCode} onChange={event => patchLine(line.key, { accountCode: event.target.value })} className={`mt-1 ${field}`}><option value="" disabled>Pilih akun</option>{data.accounts.map((account: any) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}</select></label>
            <label className="text-[11px] font-bold">Nominal<div className="mt-1"><RupiahInput name="amountRupiah" value={line.amount} onValueChange={next => patchLine(line.key, { amount: next })} min={1} /></div></label>
            <label className="text-[11px] font-bold">NIS opsional<input name="nis" value={line.nis} onChange={event => patchLine(line.key, { nis: event.target.value })} placeholder="NIS" className={`mt-1 ${field}`} /></label>
            {/* Scope dipilih dari daftar resmi; dulu diketik bebas sehingga salah
                ejaan asrama membuat jurnal tidak pernah cocok saat ditelusuri. */}
            <label className="text-[11px] font-bold">Scope opsional<select name="asramaScope" value={line.asramaScope} onChange={event => patchLine(line.key, { asramaScope: event.target.value })} className={`mt-1 ${field}`}><option value="">Global</option>{ALL_ASRAMA_LIST.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="text-[11px] font-bold">Memo<input name="memo" value={line.memo} onChange={event => patchLine(line.key, { memo: event.target.value })} placeholder={`Baris ${index + 1}`} className={`mt-1 ${field}`} /></label>
            <button type="button" aria-label="Hapus baris" disabled={lines.length <= 2} onClick={() => setLines(current => current.filter(item => item.key !== line.key))} className="grid min-h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-30"><Trash /></button>
          </div>)}</div>

          {/* Keseimbangan dihitung langsung; tombol terkunci selama belum sama. */}
          <div data-tour="balance" className={`grid gap-2 rounded-lg border p-3 text-xs sm:grid-cols-3 ${balanced ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <p><span className="text-slate-600">Total debit</span><strong className="mt-0.5 block tabular-nums">{rupiah(debitTotal)}</strong></p>
            <p><span className="text-slate-600">Total kredit</span><strong className="mt-0.5 block tabular-nums">{rupiah(creditTotal)}</strong></p>
            <p className={balanced ? 'text-emerald-900' : 'text-amber-900'}>
              <span>Status</span>
              <strong className="mt-0.5 block">{balanced ? 'Seimbang, siap diposting' : debitTotal === 0 && creditTotal === 0 ? 'Isi nominal tiap baris' : `Selisih ${rupiah(Math.abs(debitTotal - creditTotal))}`}</strong>
            </p>
          </div>

          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <button type="button" onClick={() => setLines(current => [...current, emptyLine(Math.max(...current.map(item => item.key)) + 1, current.at(-1)?.side === 'DEBIT' ? 'CREDIT' : 'DEBIT')])} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold"><Plus />Tambah baris</button>
            <button disabled={pending || !balanced} className="min-h-11 rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-50">Posting jurnal</button>
          </div>
          <p className="text-[11px] leading-4 text-slate-500">Jurnal yang sudah diposting tidak dapat diubah atau dihapus. Koreksi dilakukan dengan reversal, dan hanya jurnal manual yang tidak menyentuh dompet santri yang boleh direversal dari layar ini.</p>
        </form>
      </details>
    </SectionPanel> : null}

    <SectionPanel
      title="Ledger jurnal"
      description="Filter dan buka satu jurnal untuk melihat baris debit/kredit, scope, santri, serta relasi reversal."
      action={<ExportButton
        filename={`ledger-${today}`}
        sheetName="Jurnal"
        label={`Unduh ${filtered.length} jurnal`}
        disabled={!filtered.length}
        rows={() => filtered.map((row: any) => ({
          Tanggal: row.effective_date,
          Keterangan: row.description,
          Referensi: row.external_reference || '',
          Sumber: row.source_type,
          Status: row.status,
          Debit: Number(row.debit_rupiah) || 0,
          'ID jurnal': row.id,
        }))}
      />}
    >
      <div data-tour="filters" className="grid gap-2 border-b border-slate-100 p-3 md:grid-cols-[1fr_180px_140px_150px_150px]">
        <label className="relative"><MagnifyingGlass className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari keterangan, referensi, atau ID" className={`${field} pl-9`} /></label>
        <select value={source} onChange={event => setSource(event.target.value)} className={field}><option value="ALL">Semua sumber</option>{sources.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <select value={status} onChange={event => setStatus(event.target.value)} className={field}><option value="ALL">Semua status</option><option value="POSTED">POSTED</option><option value="DRAFT">DRAFT</option></select>
        <input type="date" aria-label="Tanggal mulai" value={from} onChange={event => setFrom(event.target.value)} className={field} />
        <input type="date" aria-label="Tanggal akhir" value={to} onChange={event => setTo(event.target.value)} className={field} />
      </div>
      <div data-tour="ledger-list" className="divide-y divide-slate-100">
        {filtered.length ? filtered.map((journal: any) => {
          const entries = entriesByJournal.get(journal.id) || []
          const canReverse = data.canConfigure && journal.status === 'POSTED' && journal.source_type === 'MANUAL' && !journal.reversal_of_id && !journal.reversed_by_id
          return <details key={journal.id}>
            <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 text-xs hover:bg-slate-50 sm:grid-cols-[100px_1fr_130px_160px_110px] sm:items-center">
              <span className="tabular-nums text-slate-500">{journal.effective_date}</span>
              <span className="min-w-0"><strong className="block truncate text-slate-800">{journal.description}</strong><span className="font-mono text-xs text-slate-400">{journal.external_reference || journal.id}</span></span>
              <span><StatusBadge tone={journal.source_type === 'REVERSAL' ? 'amber' : 'blue'}>{journal.source_type}</StatusBadge></span>
              <strong className="tabular-nums sm:text-right">{rupiah(journal.debit_rupiah)}</strong>
              <span className="sm:text-right"><StatusBadge tone={journal.status === 'POSTED' ? 'emerald' : 'amber'}>{journal.status}</StatusBadge></span>
            </summary>
            <div className="border-t border-slate-100 bg-slate-50/60 p-4">
              <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-500"><span>ID: <code>{journal.id}</code></span><span>Dibuat: {journal.created_at}</span>{journal.reversal_of_id ? <span>Reversal dari: <code>{journal.reversal_of_id}</code></span> : null}{journal.reversed_by_id ? <span>Direversal oleh: <code>{journal.reversed_by_id}</code></span> : null}</div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[720px] text-xs"><thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Akun</th><th className="px-3 py-2">Memo</th><th className="px-3 py-2">Santri / scope</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Kredit</th></tr></thead><tbody className="divide-y divide-slate-100">{entries.map(entry => <tr key={entry.id}><td className="px-3 py-2"><strong>{entry.account_code}</strong><span className="ml-1 text-slate-500">{entry.account_name}</span></td><td className="px-3 py-2 text-slate-600">{entry.memo || '—'}</td><td className="px-3 py-2"><span>{entry.student_name || entry.nis || '—'}</span><span className="block text-[10px] text-slate-400">{entry.asrama_scope || 'Scope global'}</span></td><td className="px-3 py-2 text-right font-bold tabular-nums">{entry.side === 'DEBIT' ? rupiah(entry.amount_rupiah) : '—'}</td><td className="px-3 py-2 text-right font-bold tabular-nums">{entry.side === 'CREDIT' ? rupiah(entry.amount_rupiah) : '—'}</td></tr>)}</tbody></table></div>
              {canReverse ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-[11px] leading-4 text-red-900">Reversal membuat jurnal lawan yang menetralkan jurnal ini. Jurnal aslinya tetap ada dan tidak berubah — keduanya akan terlihat di ledger.</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={reverseTarget?.id === journal.id ? reverseTarget?.reason ?? '' : ''}
                    onChange={event => setReverseTarget({ id: journal.id, reason: event.target.value })}
                    minLength={10} placeholder="Alasan reversal dan referensi koreksi (min. 10 karakter)" className={field} />
                  <button type="button"
                    disabled={pending || reverseTarget?.id !== journal.id || (reverseTarget?.reason.trim().length ?? 0) < 10}
                    onClick={() => setConfirmReverse(true)}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-xs font-bold text-white disabled:opacity-50"><ArrowsCounterClockwise />Reversal jurnal</button>
                </div>
              </div> : journal.status === 'POSTED' && journal.source_type !== 'MANUAL' ? <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600">Jurnal ini dihasilkan modul {journal.source_type}. Koreksinya harus dilakukan dari modul asalnya, bukan dari layar ledger.</p>
                : journal.reversed_by_id ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">Jurnal ini sudah pernah direversal, sehingga tidak dapat direversal lagi.</p>
                  : null}
            </div>
          </details>
        }) : <EmptyState icon={CheckCircle} title="Tidak ada jurnal yang sesuai filter" description="Longgarkan filter tanggal, sumber, atau status untuk melihat lebih banyak jurnal." />}
      </div>
    </SectionPanel>

    <ConfirmAction
      open={confirmReverse && Boolean(reverseTarget)}
      tone="red"
      title="Posting jurnal reversal?"
      description="Jurnal lawan akan diposting untuk menetralkan jurnal ini. Keduanya tetap tersimpan permanen."
      impact={[
        'Jurnal asli tidak dihapus dan tidak berubah.',
        'Setiap jurnal hanya boleh direversal satu kali.',
        'Saldo akun kembali seperti sebelum jurnal asli diposting.',
      ]}
      confirmLabel="Posting reversal"
      pending={pending}
      onCancel={() => setConfirmReverse(false)}
      onConfirm={() => {
        if (!reverseTarget) return
        const target = reverseTarget
        const form = new FormData()
        form.set('journalId', target.id)
        form.set('reason', target.reason.trim())
        setConfirmReverse(false)
        setReverseTarget(null)
        mutate(() => reverseManualJournalAction(form), 'Jurnal reversal berhasil diposting.')
      }}
    />
  </div>
}
