'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, FileCsv, MagnifyingGlass, Warning, XCircle } from '@phosphor-icons/react'
import {
  approveReopenAction,
  closePeriodAction,
  createBillAction,
  getPeriodReadinessAction,
  importBankAction,
  importBillsAction,
  manualMatchBankAction,
  reopenPeriodAction,
  reviewLateTopupAction,
  settlementAction,
  voidBillAction,
} from './actions'
import type { BillImportRow } from './actions'
import { BulkImport, asDateISO, asInteger, asText } from '../_components/bulk-import'
import { RupiahInput } from '../_components/finance-inputs'
import {
  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS, FinanceTour, MetricCard, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'

const field = FINANCE_FIELD_CLASS
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const shortId = (value: string | null | undefined) => value ? `${value.slice(0, 8)}…` : '—'

type Blocker = { key: string; label: string; detail: string; count: number; href: string }

type OperationsData = {
  periods: any[]
  imports: any[]
  bankTransactions: any[]
  journalCandidates: any[]
  paymentReviews: any[]
  bills: any[]
  capabilities: { view: boolean; create: boolean; check: boolean; configure: boolean; audit: boolean }
  defaultPeriod: string
  readiness: { valid: boolean; blockers: Blocker[] }
}

const TABS = [
  { id: 'antrean', label: 'Antrean pengecualian', hint: 'Pekerjaan yang menunggu keputusan Anda' },
  { id: 'rekonsiliasi', label: 'Rekonsiliasi bank', hint: 'Impor mutasi dan cocokkan ke jurnal' },
  { id: 'tagihan', label: 'Tagihan santri', hint: 'Buat dan batalkan tagihan' },
  { id: 'tutup-buku', label: 'Tutup buku', hint: 'Kunci periode setelah semuanya bersih' },
] as const
type TabId = typeof TABS[number]['id']

/**
 * Tautan dari halaman Ringkasan menunjuk anchor pekerjaan, bukan nama tab.
 * Tanpa peta ini pengguna mendarat di tab bawaan dan anchornya tidak terlihat
 * karena tab yang memuatnya belum aktif.
 */
const ANCHOR_TAB: Record<string, TabId> = {
  review: 'antrean',
  reconciliation: 'rekonsiliasi',
}

const TOUR: TourStep[] = [
  { target: '[data-tour="metrics"]', title: 'Mulai dari angka pengecualian', body: 'Empat kartu ini merangkum pekerjaan yang belum selesai. Selama masih ada yang berwarna kuning, periode belum layak ditutup.' },
  { target: '[data-tour="tabs"]', title: 'Empat kelompok pekerjaan', body: 'Tindakan dipisah per tujuan supaya aksi berat seperti tutup buku tidak bersebelahan dengan pekerjaan harian.' },
  { target: '[data-tour="reviews"]', title: 'Review top-up terlambat', body: 'Top-up yang dibayar setelah kedaluwarsa. Pastikan dana benar-benar masuk dan belum pernah dicatat, lalu tulis hasil pemeriksaan.' },
  { target: '[data-tour="import"]', title: 'Impor mutasi bank', body: 'Berkas yang sama tidak akan diimpor dua kali. Pencocokan otomatis hanya dilakukan bila satu referensi memetakan tepat satu mutasi ke satu jurnal.' },
  { target: '[data-tour="readiness"]', title: 'Checklist sebelum tutup buku', body: 'Setiap baris merah harus jadi hijau lebih dulu. Klik barisnya untuk langsung menuju pekerjaan yang menahan.' },
]

export function OperationsClient({ data }: { data: OperationsData }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tab, setTab] = useState<TabId>('antrean')
  const [bankFilter, setBankFilter] = useState<'UNMATCHED' | 'ALL'>('UNMATCHED')
  const [bankSearch, setBankSearch] = useState('')
  const [result, setResult] = useState<FinanceResult | null>(null)
  const [period, setPeriod] = useState(data.defaultPeriod)
  const [readiness, setReadiness] = useState(data.readiness)
  const [confirmClose, setConfirmClose] = useState(false)
  const [reopenTarget, setReopenTarget] = useState<{ key: string; reason: string } | null>(null)
  const [confirmReopen, setConfirmReopen] = useState(false)
  const tour = useFinanceTour('operasi')

  useEffect(() => {
    const anchor = window.location.hash.slice(1)
    if (!anchor) return
    const target = ANCHOR_TAB[anchor] ?? (TABS.some(item => item.id === anchor) ? anchor as TabId : null)
    if (!target) return
    // Ditunda supaya tidak memanggil setState di badan effect, dan karena panel
    // target baru terpasang setelah tabnya berganti.
    const open = window.setTimeout(() => setTab(target), 0)
    const scroll = window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    }), 60)
    return () => { window.clearTimeout(open); window.clearTimeout(scroll) }
  }, [])

  const closed = data.periods.filter(item => item.status === 'CLOSED').length
  const unmatched = data.bankTransactions.filter(row => row.match_status === 'UNMATCHED')
  const openBills = data.bills.filter(bill => bill.status === 'OPEN' || bill.status === 'PARTIAL')
  const filteredTransactions = useMemo(() => {
    const needle = bankSearch.trim().toLowerCase()
    return data.bankTransactions.filter(row => {
      if (bankFilter === 'UNMATCHED' && row.match_status !== 'UNMATCHED') return false
      if (!needle) return true
      return [row.bank_reference, row.description, row.source_filename, row.bank_account_label]
        .some(value => String(value || '').toLowerCase().includes(needle))
    })
  }, [bankFilter, bankSearch, data.bankTransactions])

  /**
   * Hasil aksi ditampilkan menetap lewat ResultBanner, bukan hanya toast.
   * Nada `duplicate` sengaja dibedakan: transaksi yang tidak jadi diposting
   * karena kiriman ulang tidak boleh terlihat seperti transaksi baru.
   */
  function mutate(work: () => Promise<any>, success: string, duplicateMessage?: string) {
    startTransition(async () => {
      try {
        const outcome = await work()
        if (!outcome?.success) {
          const message = outcome?.error || 'Tindakan tidak dapat diproses.'
          setResult({ tone: 'error', message })
          toast.error(message)
          return
        }
        if (outcome.duplicate) {
          const message = duplicateMessage || 'Data yang sama sudah pernah diproses — tidak ada yang baru diposting.'
          setResult({ tone: 'duplicate', message })
          toast.info(message)
        } else {
          setResult({ tone: 'success', message: success })
          toast.success(success)
        }
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tindakan tidak dapat diproses.'
        setResult({ tone: 'error', message })
        toast.error(message)
      }
    })
  }

  function refreshReadiness(next: string) {
    setPeriod(next)
    if (!/^\d{4}-\d{2}$/.test(next)) return
    startTransition(async () => setReadiness(await getPeriodReadinessAction(next)))
  }

  function candidatesFor(amount: number) {
    const exact = data.journalCandidates.filter(row => Number(row.bank_amount_rupiah) === Number(amount))
    return exact.length ? exact : data.journalCandidates
  }

  const pendingWork = data.paymentReviews.length + unmatched.length

  return <div className="space-y-4 sm:space-y-5">
    <FinanceTour steps={TOUR} running={tour.running} onFinish={tour.finish} />

    <section data-tour="metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Mutasi belum cocok" value={String(unmatched.length)} detail={`${data.bankTransactions.length} mutasi terbaru dimuat`} icon="fileSpreadsheet" tone={unmatched.length ? 'amber' : 'emerald'} />
      <MetricCard label="Top-up perlu review" value={String(data.paymentReviews.length)} detail="Pembayaran diterima setelah kedaluwarsa" icon="listChecks" tone={data.paymentReviews.length ? 'amber' : 'emerald'} />
      <MetricCard label="Tagihan belum lunas" value={String(openBills.length)} detail={`dari ${data.bills.length} tagihan terbaru`} icon="receipt" />
      <MetricCard label="Periode ditutup" value={String(closed)} detail="Riwayat 24 periode terakhir" icon="lock" tone="slate" />
    </section>

    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <nav data-tour="tabs" aria-label="Kelompok pekerjaan operasi" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {TABS.map(item => {
          const active = tab === item.id
          const badge = item.id === 'antrean' ? pendingWork : item.id === 'rekonsiliasi' ? unmatched.length : 0
          return <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={active ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-bold transition ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {item.label}
            {badge ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">{badge}</span> : null}
          </button>
        })}
      </div>
      <p className="mt-2 px-1 text-[11px] text-slate-500">{TABS.find(item => item.id === tab)?.hint}</p>
    </nav>

    {tab === 'antrean' ? <section className="grid gap-4 xl:grid-cols-2">
      <SectionPanel id="review" title="Review top-up terlambat" description="Pastikan dana benar-benar diterima dan tidak terduplikasi sebelum menutup review.">
        <div data-tour="reviews" className="divide-y divide-slate-100">
          {data.paymentReviews.length ? data.paymentReviews.map(row => <article key={row.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><Warning className="h-5 w-5 text-amber-600" /><strong className="text-sm text-slate-900">{row.nama_lengkap || 'Santri tidak tersinkron'}</strong></div>
                <p className="mt-1 text-xs text-slate-500">{row.nis || 'NIS —'} · {row.merchant_order_id}</p>
              </div>
              <div className="text-right"><StatusBadge tone="amber">Menunggu review</StatusBadge><strong className="mt-1 block text-sm tabular-nums">{rupiah(row.amount_rupiah)}</strong></div>
            </div>
            <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-3">
              <p><span className="text-slate-500">Kedaluwarsa</span><strong className="mt-0.5 block">{row.expires_at}</strong></p>
              <p><span className="text-slate-500">Dibayar</span><strong className="mt-0.5 block">{row.paid_at || '—'}</strong></p>
              <p><span className="text-slate-500">Referensi provider</span><strong className="mt-0.5 block break-all font-mono text-xs">{row.provider_reference || '—'}</strong></p>
            </div>
            <p className="text-[11px] leading-4 text-slate-500">Cocokkan referensi provider dengan mutasi rekening sebelum menyelesaikan review. Menyelesaikan review tidak memindahkan dana — hanya menandai sudah diperiksa.</p>
            <form action={form => mutate(() => reviewLateTopupAction(form), 'Top-up ditandai sudah direview.')} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="paymentIntentId" value={row.id} />
              <input name="note" required minLength={10} placeholder="Catatan pemeriksaan dan hasil konfirmasi (min. 10 karakter)" className={field} />
              <button disabled={!data.capabilities.check || pending} className="min-h-11 shrink-0 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white disabled:opacity-50">Selesaikan review</button>
            </form>
            {!data.capabilities.check ? <p className="text-[11px] text-slate-500">Hanya checker (Dewan Santri bidang bendahara) yang dapat menyelesaikan review ini.</p> : null}
          </article>) : <EmptyState icon={CheckCircle} title="Tidak ada top-up yang menunggu review" description="Top-up yang dibayar setelah masa berlaku habis akan muncul di sini untuk diperiksa manual." />}
        </div>
      </SectionPanel>

      <SectionPanel title="Riwayat impor mutasi" description="Status matching per berkas dan hasil deduplikasi impor.">
        <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
          {data.imports.length ? data.imports.map(row => <article key={row.id} className="space-y-2 px-4 py-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><strong className="block truncate text-slate-800">{row.source_filename}</strong><span className="text-slate-500">{row.bank_account_label} · {row.created_at}</span></div>
              <StatusBadge tone={row.status === 'FAILED' ? 'red' : row.status === 'READY' ? 'emerald' : 'amber'}>{row.status}</StatusBadge>
            </div>
            <div className="flex flex-wrap gap-3 text-slate-600"><span>{row.row_count} baris</span><span className="text-emerald-700">{Number(row.matched_count || 0)} cocok</span><span className={Number(row.unmatched_count) ? 'font-bold text-amber-700' : 'text-slate-500'}>{Number(row.unmatched_count || 0)} belum cocok</span></div>
            {row.error_message ? <p className="rounded bg-red-50 p-2 text-red-700">{row.error_message}</p> : null}
          </article>) : <EmptyState icon={FileCsv} title="Belum ada berkas mutasi" description="Impor mutasi rekening dari tab Rekonsiliasi bank untuk mulai mencocokkan." action={<button type="button" onClick={() => setTab('rekonsiliasi')} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold">Buka rekonsiliasi</button>} />}
        </div>
      </SectionPanel>
    </section> : null}

    {tab === 'rekonsiliasi' ? <div className="space-y-4">
      <SectionPanel title="Impor mutasi bank" description="Unggah mutasi resmi rekening, lalu cocokkan baris yang belum terjelaskan.">
        <div data-tour="import" className="grid gap-4 p-4 lg:grid-cols-2">
          <form action={form => mutate(() => importBankAction(form), 'Mutasi berhasil diimpor dan diproses.', 'Berkas ini sudah pernah diimpor — tidak ada baris baru yang ditambahkan.')} className="grid gap-2">
            <label className="text-xs font-bold text-slate-800">Label rekening<input name="bankLabel" required defaultValue="Rekening Utama" className={`mt-1 ${field}`} /></label>
            <label className="text-xs font-bold text-slate-800">Berkas mutasi<input name="file" type="file" accept=".csv,.xls,.xlsx" required className={`mt-1 ${field} p-1.5`} /></label>
            <button disabled={!data.capabilities.configure || pending} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50">Impor &amp; cocokkan otomatis</button>
          </form>
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs leading-5 text-slate-700">
            <p className="font-bold text-slate-900">Yang terjadi setelah impor</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>CSV/XLS/XLSX maksimal 10 MB. Berkas dengan isi identik ditolak sebagai duplikat.</li>
              <li>Kolom dikenali otomatis: tanggal, nominal/debit/kredit, referensi, dan keterangan.</li>
              <li>Pencocokan otomatis hanya jalan bila satu nomor referensi memetakan <strong>tepat satu</strong> mutasi ke <strong>tepat satu</strong> jurnal yang belum terpakai. Sisanya wajib dicocokkan manual agar tidak ada mutasi yang terlihat beres padahal belum dijelaskan.</li>
            </ul>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="Mutasi bank &amp; pencocokan jurnal" description="Buka detail mutasi, lalu cocokkan mutasi yang belum terselesaikan ke satu jurnal terposting.">
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
                <span className="min-w-0"><strong className="block truncate text-slate-800">{row.description || 'Tanpa keterangan'}</strong><span className="font-mono text-xs text-slate-400">{row.bank_reference || 'Tanpa referensi'}</span></span>
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
                  <button disabled={!data.capabilities.configure || pending || !candidates.length} className="min-h-11 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-50">Cocokkan mutasi</button>
                  <p className="text-[11px] text-slate-500 lg:col-span-2">Satu jurnal hanya boleh dipakai untuk satu mutasi. Jika jurnalnya sudah terpakai, sistem akan menolak.</p>
                  {!hasExact ? <p className="text-[11px] font-semibold text-amber-800 lg:col-span-2">Tidak ada kandidat bernominal sama. Pastikan jurnal yang dipilih memang mewakili mutasi ini.</p> : null}
                </form> : null}
              </div>
            </details>
          }) : <EmptyState icon={CheckCircle} title="Tidak ada mutasi yang sesuai filter" description={bankFilter === 'UNMATCHED' ? 'Semua mutasi yang dimuat sudah dicocokkan ke jurnal.' : 'Impor berkas mutasi untuk mulai mencocokkan.'} />}
        </div>
      </SectionPanel>

      <SectionPanel title="Posting settlement gateway" description="Catat pencairan dana gateway ke rekening bank. Bruto harus sama dengan neto ditambah biaya provider.">
        <form action={form => mutate(() => settlementAction(form), 'Settlement berhasil diposting.', 'Settlement dengan referensi dan angka yang sama persis sudah pernah diposting.')} className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-bold text-slate-800 xl:col-span-2">Referensi settlement<input name="reference" required placeholder="Nomor dari dashboard gateway" className={`mt-1 ${field}`} /></label>
          <label className="text-xs font-bold text-slate-800">Tanggal<input name="date" type="date" required className={`mt-1 ${field}`} /></label>
          <label className="text-xs font-bold text-slate-800">Bruto<div className="mt-1"><RupiahInput name="gross" min={1} /></div></label>
          <label className="text-xs font-bold text-slate-800">Biaya provider<div className="mt-1"><RupiahInput name="fee" min={0} /></div></label>
          <label className="text-xs font-bold text-slate-800">Neto diterima<div className="mt-1"><RupiahInput name="net" min={1} /></div></label>
          <button disabled={!data.capabilities.configure || pending} className="min-h-11 self-end rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50">Posting settlement</button>
          <p className="text-[11px] leading-4 text-slate-500 sm:col-span-2 xl:col-span-5">Referensi yang sama boleh dipakai lagi selama angkanya berbeda — sistem membedakan berdasarkan isi, bukan sekadar nomor dokumen.</p>
        </form>
      </SectionPanel>
    </div> : null}

    {tab === 'tagihan' ? <div className="space-y-4">
      <BulkImport<Omit<BillImportRow, 'row'>>
        title="Impor massal tagihan santri"
        description="Buat banyak tagihan sekaligus dari Excel. NIS diterjemahkan ke santri di server; NIS yang keliru ditolak per baris."
        templateName="Template_Tagihan_Santri"
        sheetName="Tagihan"
        disabled={!data.capabilities.configure}
        columns={[
          { key: 'nis', label: 'NIS', example: '2024001' },
          { key: 'jenis', label: 'Jenis tagihan', example: 'SPP' },
          { key: 'nama', label: 'Nama tagihan', example: 'SPP September 2026' },
          { key: 'periode', label: 'Periode (YYYY-MM, opsional)', example: '2026-09' },
          { key: 'nominal', label: 'Nominal', example: 350_000 },
          { key: 'jatuhtempo', label: 'Jatuh tempo (opsional)', example: '2026-09-10' },
        ]}
        note={<>
          <p className="font-bold text-slate-900">Yang perlu diperhatikan</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Jenis tagihan: <strong>SPP</strong> dan <strong>NON_SPP</strong> wajib lunas sekaligus, <strong>USPP</strong> boleh dicicil wali.</li>
            <li>Santri berstatus bebas SPP otomatis ditolak untuk jenis SPP — barisnya disebut beserta alasannya.</li>
            <li>Format kolom NIS sebagai <strong>Teks</strong> di Excel supaya nol di depan tidak hilang.</li>
          </ul>
        </>}
        parseRow={get => {
          const nis = asText(get('nis'))
          if (!nis) return { error: 'NIS wajib diisi.' }
          const kindText = asText(get('jenis')).toUpperCase().replace(/[\s-]/g, '_')
          const kind = kindText === 'SPP' || kindText === 'USPP' || kindText === 'NON_SPP' ? kindText : null
          if (!kind) return { error: `Jenis tagihan "${asText(get('jenis')) || '(kosong)'}" tidak dikenal. Pakai SPP, NON_SPP, atau USPP.` }
          const title = asText(get('nama'))
          if (title.length < 3) return { error: 'Nama tagihan minimal 3 karakter.' }
          const amountRupiah = asInteger(get('nominal'))
          if (!amountRupiah || amountRupiah < 1) return { error: 'Nominal harus angka bulat lebih dari nol.' }
          const periodText = asText(get('periode'))
          if (periodText && !/^\d{4}-\d{2}$/.test(periodText)) return { error: 'Periode harus berformat YYYY-MM atau dikosongkan.' }
          const dueText = asText(get('jatuhtempo'))
          const dueDate = dueText ? asDateISO(dueText) : null
          if (dueText && !dueDate) return { error: 'Jatuh tempo harus berformat YYYY-MM-DD atau dikosongkan.' }
          return { value: { nis, kind, title, periodKey: periodText || null, amountRupiah, dueDate } }
        }}
        onSubmit={values => importBillsAction(values)}
      />

      <SectionPanel title="Buat tagihan santri" description="SPP dan Non-SPP wajib dilunasi sekaligus; USPP boleh dicicil oleh wali.">
        <form action={form => mutate(() => createBillAction(form), 'Tagihan berhasil dibuat.')} className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-bold text-slate-800">NIS santri<input name="nis" required placeholder="Contoh: 2024001" className={`mt-1 ${field}`} /><span className="mt-1 block text-[11px] font-normal text-slate-500">Santri harus berstatus aktif.</span></label>
          <label className="text-xs font-bold text-slate-800">Jenis tagihan<select name="kind" className={`mt-1 ${field}`}><option value="SPP">SPP — wajib lunas sekaligus</option><option value="NON_SPP">Non-SPP — wajib lunas sekaligus</option><option value="USPP">USPP — boleh dicicil</option></select></label>
          <label className="text-xs font-bold text-slate-800">Nama tagihan<input name="title" required placeholder="Contoh: SPP Agustus 2026" className={`mt-1 ${field}`} /></label>
          <label className="text-xs font-bold text-slate-800">Periode<input name="period" placeholder="YYYY-MM (opsional)" className={`mt-1 ${field}`} /></label>
          <label className="text-xs font-bold text-slate-800">Nominal<div className="mt-1"><RupiahInput name="amount" min={1} /></div></label>
          <label className="text-xs font-bold text-slate-800">Jatuh tempo<input name="dueDate" type="date" className={`mt-1 ${field}`} /></label>
          <button disabled={!data.capabilities.configure || pending} className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2 xl:col-span-1">Buat tagihan</button>
          <p className="text-[11px] leading-4 text-slate-500 sm:col-span-2 xl:col-span-2">Santri berstatus bebas SPP otomatis ditolak untuk jenis SPP. Tagihan yang sudah dibayar sebagian tidak dapat dibatalkan.</p>
        </form>
      </SectionPanel>

      <SectionPanel title="Tagihan terbaru" description="Validasi hasil pembuatan dan status pembayaran tagihan.">
        <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[680px] text-xs">
          <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Santri</th><th className="px-4 py-2.5">Tagihan</th><th className="px-4 py-2.5 text-right">Nominal</th><th className="px-4 py-2.5 text-right">Terbayar</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Tindakan</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.bills.length ? data.bills.map(bill => <tr key={bill.id}>
            <td className="px-4 py-3 font-semibold">{bill.nama_lengkap}<span className="block text-xs text-slate-400">{bill.nis}</span></td>
            <td className="px-4 py-3">{bill.title}<span className="block text-xs text-slate-400">{bill.bill_kind}{bill.due_date ? ` · jatuh tempo ${bill.due_date}` : ''}</span></td>
            <td className="px-4 py-3 text-right font-bold tabular-nums">{rupiah(bill.amount_rupiah)}</td>
            <td className="px-4 py-3 text-right tabular-nums text-slate-600">{rupiah(bill.paid_rupiah)}</td>
            <td className="px-4 py-3"><StatusBadge tone={bill.status === 'PAID' ? 'emerald' : bill.status === 'VOID' ? 'slate' : 'amber'}>{bill.status}</StatusBadge></td>
            <td className="px-4 py-3">{bill.status === 'OPEN' && Number(bill.paid_rupiah) === 0
              ? <form action={form => mutate(() => voidBillAction(form), 'Tagihan berhasil dibatalkan.')} className="flex min-w-[260px] gap-2"><input type="hidden" name="billId" value={bill.id} /><input name="reason" required minLength={10} placeholder="Alasan void (min. 10 karakter)" className={`${field} min-h-9`} /><button disabled={!data.capabilities.configure || pending} className="min-h-9 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 font-bold text-red-700 disabled:opacity-50">Void</button></form>
              : <span className="text-[11px] text-slate-400">{bill.status === 'VOID' ? 'Sudah dibatalkan' : Number(bill.paid_rupiah) > 0 ? 'Sudah ada pembayaran' : '—'}</span>}</td>
          </tr>) : <tr><td colSpan={6}><EmptyState icon={CheckCircle} title="Belum ada tagihan" description="Buat tagihan pertama lewat formulir di atas." /></td></tr>}</tbody>
        </table></div>
        <div className="divide-y divide-slate-100 sm:hidden">{data.bills.length ? data.bills.map(bill => <article key={bill.id} className="space-y-2 px-4 py-3 text-xs">
          <div className="flex items-start justify-between gap-3"><div><strong>{bill.nama_lengkap}</strong><p className="text-slate-500">{bill.title}</p></div><StatusBadge tone={bill.status === 'PAID' ? 'emerald' : bill.status === 'VOID' ? 'slate' : 'amber'}>{bill.status}</StatusBadge></div>
          <p className="tabular-nums"><strong>{rupiah(bill.amount_rupiah)}</strong><span className="text-slate-500"> · terbayar {rupiah(bill.paid_rupiah)}</span></p>
          {bill.status === 'OPEN' && Number(bill.paid_rupiah) === 0 ? <form action={form => mutate(() => voidBillAction(form), 'Tagihan berhasil dibatalkan.')} className="grid gap-2"><input type="hidden" name="billId" value={bill.id} /><input name="reason" required minLength={10} placeholder="Alasan void (min. 10 karakter)" className={field} /><button disabled={!data.capabilities.configure || pending} className="min-h-11 rounded-lg border border-red-200 bg-red-50 font-bold text-red-700 disabled:opacity-50">Void tagihan</button></form> : null}
        </article>) : <EmptyState icon={CheckCircle} title="Belum ada tagihan" description="Buat tagihan pertama lewat formulir di atas." />}</div>
      </SectionPanel>
    </div> : null}

    {tab === 'tutup-buku' ? <div className="space-y-4">
      <SectionPanel title="Kesiapan tutup buku" description="Periode hanya dapat dikunci setelah seluruh prasyarat terpenuhi.">
        <div data-tour="readiness" className="space-y-4 p-4">
          <label className="grid max-w-xs gap-1 text-xs font-bold text-slate-800">Periode yang akan ditutup
            <input type="month" value={period} onChange={event => refreshReadiness(event.target.value)} className={field} />
          </label>
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
            {readiness.blockers.map(item => {
              const ok = item.count === 0
              return <li key={item.key} className="flex items-start gap-3 px-3 py-3 text-xs">
                {ok ? <CheckCircle weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
                <div className="min-w-0 flex-1">
                  <p className={`font-bold ${ok ? 'text-slate-700' : 'text-red-800'}`}>{item.label}</p>
                  <p className="mt-0.5 leading-4 text-slate-500">{ok ? 'Sudah bersih.' : item.detail}</p>
                </div>
                {ok ? null : <div className="shrink-0 text-right">
                  <strong className="block tabular-nums text-red-700">{item.key === 'suspense' ? rupiah(item.count) : `${item.count} item`}</strong>
                  {item.href.startsWith('#')
                    ? <button type="button" onClick={() => setTab('rekonsiliasi')} className="mt-1 text-[11px] font-bold text-blue-700 underline">Kerjakan</button>
                    : <Link href={item.href} className="mt-1 block text-[11px] font-bold text-blue-700 underline">Kerjakan</Link>}
                </div>}
              </li>
            })}
          </ol>
          {readiness.valid
            ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">Semua prasyarat terpenuhi. Periode {period} siap dikunci.</p>
            : <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Selesaikan baris merah di atas lebih dulu. Sistem akan menolak penutupan selama masih ada yang tertinggal.</p>}
          <button type="button" disabled={!data.capabilities.configure || !readiness.valid || pending} onClick={() => setConfirmClose(true)}
            className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50">Tutup periode {period}</button>
        </div>
      </SectionPanel>

      <SectionPanel title="Riwayat periode pembukuan" description="Membuka kembali periode tertutup membutuhkan dua persetujuan dari orang berbeda, dan persetujuan itu hanya berlaku sekali.">
        <div className="divide-y divide-slate-100">{data.periods.length ? data.periods.map(item => <article key={item.period_key} className="px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm">{item.period_key}</strong>
            <div className="flex items-center gap-2">
              <StatusBadge tone={item.status === 'CLOSED' ? 'slate' : 'emerald'}>{item.status === 'CLOSED' ? 'Terkunci' : 'Terbuka'}</StatusBadge>
              {item.status === 'CLOSED' ? <StatusBadge tone={Number(item.approval_count) >= 2 ? 'emerald' : 'amber'}>{item.approval_count} dari 2 persetujuan</StatusBadge> : null}
            </div>
          </div>
          {item.closed_at ? <p className="mt-1 text-slate-500">Ditutup {item.closed_at}{item.reopened_at ? ` · pernah dibuka kembali ${item.reopened_at}` : ''}</p> : null}
          {item.status === 'CLOSED' ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <form action={form => mutate(() => approveReopenAction(form), 'Persetujuan reopen dicatat.')} className="grid gap-2 rounded-lg border border-slate-200 p-3">
              <p className="font-bold text-slate-700">1. Kumpulkan persetujuan</p>
              <input type="hidden" name="period" value={item.period_key} />
              <input name="reason" required minLength={10} placeholder="Alasan persetujuan (min. 10 karakter)" className={field} />
              <button disabled={!data.capabilities.check || pending} className="min-h-11 rounded-lg border border-slate-200 px-3 font-bold disabled:opacity-50">Setujui pembukaan</button>
            </form>
            <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <p className="font-bold text-amber-900">2. Buka kembali</p>
              <p className="leading-4 text-amber-800">Butuh minimal dua persetujuan dari orang berbeda. Setelah dibuka, persetujuan tersebut habis terpakai.</p>
              <input
                value={reopenTarget?.key === item.period_key ? reopenTarget?.reason ?? '' : ''}
                onChange={event => setReopenTarget({ key: item.period_key, reason: event.target.value })}
                minLength={10} placeholder="Alasan final pembukaan (min. 10 karakter)" className={field} />
              <button type="button"
                disabled={!data.capabilities.configure || Number(item.approval_count) < 2 || pending
                  || reopenTarget?.key !== item.period_key || (reopenTarget?.reason.trim().length ?? 0) < 10}
                onClick={() => setConfirmReopen(true)}
                className="min-h-11 rounded-lg bg-amber-600 px-3 font-bold text-white disabled:opacity-50">Buka kembali periode</button>
            </div>
          </div> : null}
        </article>) : <EmptyState icon={CheckCircle} title="Belum ada periode pembukuan" description="Periode akan muncul setelah tutup buku pertama dilakukan." />}</div>
      </SectionPanel>
    </div> : null}

    <ConfirmAction
      open={confirmClose}
      title={`Kunci periode ${period}?`}
      description="Setelah dikunci, tidak ada jurnal baru yang dapat diposting pada periode ini."
      impact={[
        'Sidik jari saldo seluruh akun disimpan sebagai bukti penutupan.',
        'Jurnal dengan tanggal efektif di periode ini akan ditolak database.',
        'Membuka kembali memerlukan dua persetujuan dari orang berbeda.',
      ]}
      confirmPhrase="TUTUP BUKU"
      confirmLabel="Kunci periode"
      pending={pending}
      onCancel={() => setConfirmClose(false)}
      onConfirm={() => {
        const form = new FormData()
        form.set('period', period)
        setConfirmClose(false)
        mutate(() => closePeriodAction(form), `Periode ${period} berhasil dikunci.`)
      }}
    />

    <ConfirmAction
      open={confirmReopen && Boolean(reopenTarget)}
      tone="red"
      title={`Buka kembali periode ${reopenTarget?.key ?? ''}?`}
      description="Periode yang dibuka kembali menerima jurnal baru dan sidik jari penutupannya tidak lagi mewakili kondisi akhir."
      impact={[
        'Kedua persetujuan yang terkumpul akan habis terpakai.',
        'Penutupan berikutnya menghasilkan sidik jari saldo yang berbeda.',
        'Seluruh tindakan tercatat di audit log dengan nama Anda.',
      ]}
      confirmPhrase="BUKA KEMBALI"
      confirmLabel="Buka periode"
      pending={pending}
      onCancel={() => setConfirmReopen(false)}
      onConfirm={() => {
        if (!reopenTarget) return
        const target = reopenTarget
        const form = new FormData()
        form.set('period', target.key)
        form.set('reason', target.reason.trim())
        setConfirmReopen(false)
        setReopenTarget(null)
        mutate(() => reopenPeriodAction(form), `Periode ${target.key} dibuka kembali.`)
      }}
    />
  </div>
}
