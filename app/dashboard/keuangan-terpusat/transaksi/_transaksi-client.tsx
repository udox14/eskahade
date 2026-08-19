'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, ArrowsLeftRight, Books, MagnifyingGlass } from '@phosphor-icons/react'
import { postManualJournalAction, reverseManualJournalAction } from './actions'
import { jenisTransaksi } from '@/lib/finance/postings'
import { RupiahInput } from '../_components/finance-inputs'
import {
  ConfirmAction, EmptyState, FINANCE_FIELD_CLASS as field, FormField, MetricCard,
  FinanceModal, ResultBanner, SectionPanel, StatusBadge, type FinanceResult,
} from '../_components/finance-ui'

const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

/**
 * Layar Transaksi punya dua lapis.
 *
 * Lapis operasional (bawaan, dilihat semua pengurus) memakai bahasa manusia:
 * tanggal, pihak, jenis kejadian, uang masuk atau keluar, nominal. Tidak ada
 * kata "debit", "kredit", atau kode akun di sini.
 *
 * Lapis akuntansi (tombol "Lihat jurnal", hanya bendahara/auditor) menampilkan
 * jurnal aslinya beserta pasangan debit-kredit. Ledger-nya sendiri tidak berubah
 * sama sekali - yang berubah hanya siapa yang perlu melihatnya.
 */
export function TransaksiClient({ data, initialSearch = '' }: { data: any; initialSearch?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<FinanceResult | null>(null)
  const [lapisJurnal, setLapisJurnal] = useState(false)
  const [modalManual, setModalManual] = useState(false)
  const [cari, setCari] = useState(initialSearch)
  const [arahFilter, setArahFilter] = useState<'SEMUA' | 'MASUK' | 'KELUAR'>('SEMUA')
  const [reverseTarget, setReverseTarget] = useState<any>(null)
  const [alasan, setAlasan] = useState('')
  const [konfirmasiBatal, setKonfirmasiBatal] = useState(false)

  const entriesByJournal = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const entry of data.entries) {
      const list = map.get(entry.journal_id) || []
      list.push(entry)
      map.set(entry.journal_id, list)
    }
    return map
  }, [data.entries])

  const baris = useMemo(() => data.journals.map((journal: any) => {
    const jenis = jenisTransaksi(journal.source_type)
    return {
      ...journal,
      jenisLabel: jenis.label,
      arah: jenis.arah,
      // Nominal transaksi = sisi debit-nya. Untuk jurnal seimbang keduanya sama,
      // jadi angka ini selalu mewakili besar transaksi, bukan setengahnya.
      nominal: Number(journal.debit_rupiah || 0),
      pihak: journal.santri_name || journal.counterparty_id || '—',
    }
  }), [data.journals])

  const terlihat = useMemo(() => {
    const needle = cari.trim().toLowerCase()
    return baris.filter((row: any) => {
      if (arahFilter !== 'SEMUA' && row.arah !== arahFilter) return false
      if (!needle) return true
      return [row.description, row.jenisLabel, row.pihak, row.external_reference]
        .some(value => String(value || '').toLowerCase().includes(needle))
    })
  }, [baris, cari, arahFilter])

  const totalMasuk = baris.filter((r: any) => r.arah === 'MASUK').reduce((s: number, r: any) => s + r.nominal, 0)
  const totalKeluar = baris.filter((r: any) => r.arah === 'KELUAR').reduce((s: number, r: any) => s + r.nominal, 0)

  const act = (work: () => Promise<any>, success: string) => startTransition(async () => {
    try {
      const outcome = await work()
      if (!outcome?.success) {
        const message = outcome?.error || 'Tindakan gagal.'
        setResult({ tone: 'error', message }); toast.error(message); return
      }
      setResult({ tone: 'success', message: success }); toast.success(success); router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tindakan gagal.'
      setResult({ tone: 'error', message }); toast.error(message)
    }
  })

  const ikonArah = (arah: string) => arah === 'MASUK'
    ? <ArrowDown className="h-4 w-4 text-emerald-700" />
    : arah === 'KELUAR' ? <ArrowUp className="h-4 w-4 text-red-700" />
      : <ArrowsLeftRight className="h-4 w-4 text-slate-400" />

  return <div className="space-y-4 sm:space-y-5">
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Uang masuk" value={rupiah(totalMasuk)} detail="250 transaksi terakhir" icon="listChecks" tone="emerald" />
      <MetricCard label="Uang keluar" value={rupiah(totalKeluar)} detail="250 transaksi terakhir" icon="listChecks" tone="amber" />
      <MetricCard label="Transaksi tercatat" value={String(data.totals.posted?.count ?? 0)} detail="Seluruh periode" icon="fileSpreadsheet" tone="blue" />
      <MetricCard label="Belum selesai" value={String(data.totals.draft?.count ?? 0)} detail="Harus dibereskan sebelum tutup buku" icon="checkCircle" tone={Number(data.totals.draft?.count) ? 'amber' : 'emerald'} />
    </section>

    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <SectionPanel
      title="Daftar transaksi"
      description="Semua pergerakan uang, terbaru di atas. Klik satu baris untuk melihat rinciannya."
      action={data.canConfigure
        ? <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setLapisJurnal(value => !value)}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${lapisJurnal ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}>
          <Books className="h-4 w-4" />{lapisJurnal ? 'Sembunyikan jurnal' : 'Lihat jurnal'}
        </button>
        {lapisJurnal ? <button type="button" onClick={() => setModalManual(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold">
          Catatan manual
        </button> : null}
      </div>
        : null}>

      <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
          {(['SEMUA', 'MASUK', 'KELUAR'] as const).map(nilai => <button key={nilai} type="button" onClick={() => setArahFilter(nilai)}
            className={`min-h-9 rounded-md px-3 ${arahFilter === nilai ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            {nilai === 'SEMUA' ? 'Semua' : nilai === 'MASUK' ? 'Uang masuk' : 'Uang keluar'}
          </button>)}
        </div>
        <label className="relative block sm:w-80">
          <MagnifyingGlass className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input value={cari} onChange={event => setCari(event.target.value)} placeholder="Cari nama santri, jenis, atau keterangan" className={`${field} pl-9`} />
        </label>
      </div>

      {lapisJurnal ? <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] leading-5 text-amber-900">
        Lapis akuntansi aktif. Kolom debit dan kredit di bawah adalah jurnal asli — dipakai untuk audit dan tutup buku,
        bukan untuk pekerjaan harian.
      </p> : null}

      <div className="divide-y divide-slate-100">
        {terlihat.length ? terlihat.map((row: any) => {
          const entries = entriesByJournal.get(row.id) || []
          return <details key={row.id} className="group">
            <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 text-xs hover:bg-slate-50 sm:grid-cols-[110px_1fr_180px_140px] sm:items-center">
              <span className="tabular-nums text-slate-500">{row.effective_date}</span>
              <span className="min-w-0">
                <strong className="block truncate text-slate-800">{row.jenisLabel}</strong>
                <span className="block truncate text-slate-500">{row.pihak}</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">{ikonArah(row.arah)}
                {row.arah === 'MASUK' ? 'Uang masuk' : row.arah === 'KELUAR' ? 'Uang keluar' : 'Pindah antar pos'}</span>
              <strong className={`tabular-nums sm:text-right ${row.arah === 'MASUK' ? 'text-emerald-700' : row.arah === 'KELUAR' ? 'text-red-700' : 'text-slate-700'}`}>
                {rupiah(row.nominal)}
              </strong>
            </summary>

            <div className="border-t border-slate-100 bg-slate-50/60 p-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <p><span className="text-slate-500">Keterangan</span><strong className="mt-1 block">{row.description}</strong></p>
                <p><span className="text-slate-500">Referensi</span><strong className="mt-1 block font-mono">{row.external_reference || '—'}</strong></p>
                <p><span className="text-slate-500">Dicatat</span><strong className="mt-1 block">{row.created_at}</strong></p>
              </div>

              {row.reversed_by_id
                ? <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-amber-900">Transaksi ini sudah dikoreksi dengan transaksi lawan.</p>
                : null}

              {lapisJurnal ? <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[34rem] text-xs">
                  <thead className="bg-slate-50 text-left uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Akun</th>
                      <th className="px-3 py-2">Untuk</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Kredit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.map((entry: any) => <tr key={entry.id}>
                      <td className="px-3 py-2">{entry.account_name}</td>
                      <td className="px-3 py-2 text-slate-500">{entry.student_name || entry.memo || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{entry.side === 'DEBIT' ? rupiah(entry.amount_rupiah) : ''}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{entry.side === 'CREDIT' ? rupiah(entry.amount_rupiah) : ''}</td>
                    </tr>)}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold">
                    <tr>
                      <td className="px-3 py-2" colSpan={2}>Jumlah</td>
                      <td className="px-3 py-2 text-right tabular-nums">{rupiah(row.debit_rupiah)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{rupiah(row.credit_rupiah)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div> : null}

              {data.canConfigure && row.source_type === 'MANUAL' && !row.reversed_by_id && row.status === 'POSTED'
                ? <div className="mt-4 grid gap-2 rounded-lg border border-red-200 bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <FormField label="Alasan pembatalan" hint="Minimal 10 karakter, tercatat permanen">
                    <input
                      value={reverseTarget?.id === row.id ? alasan : ''}
                      onChange={event => { setReverseTarget(row); setAlasan(event.target.value) }}
                      minLength={10} placeholder="Kenapa transaksi ini dibatalkan?" className={field} />
                  </FormField>
                  <button type="button"
                    disabled={pending || reverseTarget?.id !== row.id || alasan.trim().length < 10}
                    onClick={() => setKonfirmasiBatal(true)}
                    className="min-h-11 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 disabled:opacity-50">Batalkan transaksi ini</button>
                </div>
                : null}
            </div>
          </details>
        }) : <EmptyState title="Belum ada transaksi yang cocok" description="Ubah filter atau kata kunci pencarian." />}
      </div>
    </SectionPanel>

    <FinanceModal
      open={modalManual}
      title="Catatan manual bendahara"
      description="Hanya untuk hal yang tidak punya jalur sendiri, misalnya koreksi pembukuan. Transaksi harian tidak perlu diketik di sini."
      size="lg"
      onClose={() => setModalManual(false)}>
      <form action={form => { setModalManual(false); act(() => postManualJournalAction(form), 'Catatan manual tersimpan.') }} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Tanggal berlaku" required><input type="date" name="effectiveDate" required className={field} /></FormField>
          <FormField label="Nomor dokumen" required hint="Minimal 3 karakter"><input name="externalReference" required minLength={3} className={field} /></FormField>
          <FormField label="Keterangan" required hint="Minimal 5 karakter"><input name="description" required minLength={5} className={field} /></FormField>
        </div>
        {[0, 1].map(index => <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_120px_1fr_1fr]">
          <FormField label={`Akun baris ${index + 1}`} required>
            <select name="accountCode" required defaultValue="" className={field}>
              <option value="" disabled>Pilih akun</option>
              {data.accounts.map((account: any) => <option key={account.code} value={account.code}>{account.name}</option>)}
            </select>
          </FormField>
          <FormField label="Sisi" required>
            <select name="side" required className={field}><option value="DEBIT">Debit</option><option value="CREDIT">Kredit</option></select>
          </FormField>
          <FormField label="Nominal" required><RupiahInput name="amountRupiah" min={1} /></FormField>
          <FormField label="NIS santri" hint="Kosongkan bila bukan per santri"><input name="nis" className={field} /></FormField>
          <input type="hidden" name="memo" value="" />
          <input type="hidden" name="asramaScope" value="" />
        </div>)}
        <div><button disabled={pending} className="min-h-11 rounded-xl bg-slate-900 px-5 font-bold text-white disabled:opacity-50">Simpan catatan manual</button></div>
      </form>
    </FinanceModal>

    <ConfirmAction
      open={konfirmasiBatal}
      tone="red"
      title="Batalkan transaksi ini?"
      description={`${reverseTarget?.jenisLabel ?? ''} · ${rupiah(reverseTarget?.nominal ?? 0)}`}
      impact={[
        'Transaksi asli tidak dihapus. Sistem membuat transaksi lawan yang membatalkannya.',
        'Keduanya tetap terlihat di daftar ini beserta alasan pembatalan.',
        'Pembatalan tidak dapat dibatalkan lagi.',
      ]}
      confirmLabel="Batalkan transaksi"
      pending={pending}
      onCancel={() => setKonfirmasiBatal(false)}
      onConfirm={() => {
        const target = reverseTarget
        const form = new FormData()
        form.set('journalId', target.id)
        form.set('reason', alasan.trim())
        setKonfirmasiBatal(false)
        setReverseTarget(null)
        act(() => reverseManualJournalAction(form), 'Transaksi dibatalkan lewat transaksi lawan.')
      }}
    />
  </div>
}
