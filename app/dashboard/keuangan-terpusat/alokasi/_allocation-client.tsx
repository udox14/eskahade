'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowCounterClockwise, CheckCircle, MagnifyingGlass } from '@phosphor-icons/react'
import {
  ConfirmAction, EmptyState, FinanceTour, MetricCard, ResultBanner, SectionPanel, StatusBadge,
  useFinanceTour, type FinanceResult, type TourStep,
} from '../_components/finance-ui'
import { returnAllocationAction } from './actions'

const field = 'min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500'
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const returnableKinds = new Set(['MAKAN', 'LAUNDRY', 'JAJAN'])

const TOUR: TourStep[] = [
  { target: '[data-tour="totals"]', title: 'Baca posisi alokasi', body: 'Reserved berarti dana sudah disisihkan tapi layanan belum menagihnya. Committed berarti sudah menjadi hak tujuan. Hanya Reserved dan Committed yang masih bisa dikembalikan.' },
  { target: '[data-tour="filters"]', title: 'Cari alokasi', body: 'Saring berdasarkan status atau tujuan, atau cari langsung dengan nama santri, NIS, dan referensi tagihan.' },
  { target: '[data-tour="list"]', title: 'Buka detail sebelum mengembalikan', body: 'Periksa cutoff dan saldo tujuan. Pengembalian menambah jurnal lawan — jurnal alokasi aslinya tetap ada.' },
]

export function AllocationClient({ data }: { data: any }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [destination, setDestination] = useState('ALL')
  const [result, setResult] = useState<FinanceResult | null>(null)
  const [confirmReturn, setConfirmReturn] = useState<any>(null)
  const tour = useFinanceTour('alokasi')
  const now = Number(data.nowMs)
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return data.allocations.filter((row: any) => {
      if (status !== 'ALL' && row.status !== status) return false
      if (destination !== 'ALL' && row.destination_kind !== destination) return false
      return !needle || [row.student_name, row.nis, row.billing_reference, row.id].some(value => String(value || '').toLowerCase().includes(needle))
    })
  }, [data.allocations, destination, search, status])
  const totals = data.allocations.reduce((result: Record<string, number>, row: any) => {
    result[row.status] = (result[row.status] || 0) + Number(row.amount_rupiah)
    return result
  }, {})

  function returnAllocation(row: any) {
    const form = new FormData()
    form.set('allocationId', row.id)
    startTransition(async () => {
      try {
        const outcome = await returnAllocationAction(form)
        if (!outcome?.success) {
          const message = outcome?.error || 'Alokasi tidak dapat dikembalikan.'
          setResult({ tone: 'error', message })
          toast.error(message)
          return
        }
        setResult({
          tone: 'success',
          message: 'Dana alokasi dikembalikan ke Titipan.',
          detail: `${row.student_name || 'Santri'} · ${rupiah(row.amount_rupiah)} dari ${row.destination_kind}. Wali dapat mengalokasikan ulang dari portal.`,
        })
        toast.success('Dana alokasi dikembalikan ke Titipan.')
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Alokasi tidak dapat dikembalikan.'
        setResult({ tone: 'error', message })
        toast.error(message)
      }
    })
  }

  return <div className="space-y-4 sm:space-y-5">
    <FinanceTour steps={TOUR} running={tour.running} onFinish={tour.finish} />
    <section data-tour="totals" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Riwayat dimuat" value={String(data.allocations.length)} detail="300 alokasi terbaru" icon="layers" tone="blue" />
      <MetricCard label="Reserved" value={rupiah(totals.RESERVED || 0)} detail="Belum dicairkan / dikomit" icon="listChecks" tone={totals.RESERVED ? 'amber' : 'slate'} />
      <MetricCard label="Committed" value={rupiah(totals.COMMITTED || 0)} detail="Sudah dialokasikan ke tujuan" icon="checkCircle" tone="emerald" />
      <MetricCard label="Returned" value={rupiah(totals.RETURNED || 0)} detail="Kembali ke wallet Titipan" icon="wallet" tone="slate" />
    </section>

    <ResultBanner result={result} onDismiss={() => setResult(null)} />

    <SectionPanel title="Riwayat &amp; pengembalian alokasi" description="Pengembalian hanya tersedia untuk Makan, Laundry, atau Jajan sebelum cutoff dan sebelum dana dicairkan.">
      <div data-tour="filters" className="grid gap-2 border-b border-slate-100 p-3 md:grid-cols-[1fr_180px_180px]">
        <label className="relative"><MagnifyingGlass className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari santri, NIS, referensi, atau ID" className={`${field} pl-9`} /></label>
        <select value={status} onChange={event => setStatus(event.target.value)} className={field}><option value="ALL">Semua status</option><option value="RESERVED">RESERVED</option><option value="COMMITTED">COMMITTED</option><option value="DISBURSED">DISBURSED</option><option value="RETURNED">RETURNED</option></select>
        <select value={destination} onChange={event => setDestination(event.target.value)} className={field}><option value="ALL">Semua tujuan</option>{['SPP', 'USPP', 'NON_SPP', 'MAKAN', 'LAUNDRY', 'JAJAN'].map(item => <option key={item}>{item}</option>)}</select>
      </div>
      <div data-tour="list" className="divide-y divide-slate-100">
        {filtered.length ? filtered.map((row: any) => {
          const cutoffOpen = !row.cutoff_at || new Date(row.cutoff_at).getTime() > now
          const canReturn = data.canReturn && returnableKinds.has(row.destination_kind) && ['RESERVED', 'COMMITTED'].includes(row.status) && cutoffOpen
          const balanceEnough = Number(row.destination_balance_rupiah) >= Number(row.amount_rupiah)
          return <details key={row.id}>
            <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 text-xs hover:bg-slate-50 sm:grid-cols-[1fr_120px_150px_130px_110px] sm:items-center">
              <span className="min-w-0"><strong className="block truncate text-slate-800">{row.student_name || 'Santri tidak tersinkron'}</strong><span className="text-slate-500">{row.nis || 'NIS —'} · {row.asrama || 'Tanpa asrama'}</span></span>
              <span><StatusBadge tone="blue">{row.destination_kind}</StatusBadge></span>
              <strong className="tabular-nums sm:text-right">{rupiah(row.amount_rupiah)}</strong>
              <span className="tabular-nums text-slate-500 sm:text-right">{row.created_at}</span>
              <span className="sm:text-right"><StatusBadge tone={row.status === 'RETURNED' ? 'slate' : row.status === 'DISBURSED' ? 'blue' : row.status === 'RESERVED' ? 'amber' : 'emerald'}>{row.status}</StatusBadge></span>
            </summary>
            <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4">
              <div className="grid gap-3 text-xs sm:grid-cols-4">
                <p><span className="text-slate-500">Referensi billing</span><strong className="mt-1 block">{row.billing_reference || '—'}</strong></p>
                <p><span className="text-slate-500">Tagihan terkait</span><strong className="mt-1 block">{row.bill_titles || '—'}</strong></p>
                <p><span className="text-slate-500">Cutoff return</span><strong className="mt-1 block">{row.cutoff_at || 'Tidak dibatasi'}</strong></p>
                <p><span className="text-slate-500">Saldo tujuan saat ini</span><strong className="mt-1 block">{rupiah(row.destination_balance_rupiah)}</strong></p>
              </div>
              {canReturn ? <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center"><p className="text-xs text-amber-900">{balanceEnough ? 'Dana akan dipindahkan kembali ke wallet Titipan dan jurnal lawan alokasi diposting.' : 'Saldo tujuan lebih kecil dari nilai alokasi; database akan menolak pengembalian untuk mencegah saldo negatif.'}</p><button disabled={pending || !balanceEnough} onClick={() => setConfirmReturn(row)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-amber-600 px-4 text-xs font-bold text-white disabled:opacity-50"><ArrowCounterClockwise />Kembalikan alokasi</button></div>
                : returnableKinds.has(row.destination_kind) && ['RESERVED', 'COMMITTED'].includes(row.status) && !cutoffOpen
                  ? <p className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600">Cutoff pengembalian sudah lewat, sehingga alokasi ini tidak dapat dikembalikan lagi.</p>
                  : !returnableKinds.has(row.destination_kind)
                    ? <p className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600">Alokasi tagihan (SPP, USPP, Non-SPP) tidak dapat dikembalikan dari halaman ini. Batalkan tagihannya lewat halaman Operasi bila memang keliru.</p>
                    : null}
            </div>
          </details>
        }) : <EmptyState icon={CheckCircle} title="Tidak ada alokasi yang sesuai filter" description="Longgarkan filter status atau tujuan, atau kosongkan kata kunci pencarian." />}
      </div>
    </SectionPanel>

    <ConfirmAction
      open={Boolean(confirmReturn)}
      title="Kembalikan alokasi ke Titipan?"
      description={confirmReturn ? `${rupiah(confirmReturn.amount_rupiah)} akan ditarik dari dompet ${confirmReturn.destination_kind} milik ${confirmReturn.student_name || 'santri ini'}.` : ''}
      impact={[
        'Jurnal lawan diposting; jurnal alokasi aslinya tetap tersimpan.',
        'Dana kembali menjadi Titipan dan dapat dialokasikan ulang oleh wali.',
        'Tindakan ini tidak dapat dibatalkan dari halaman ini.',
      ]}
      confirmLabel="Kembalikan dana"
      pending={pending}
      onCancel={() => setConfirmReturn(null)}
      onConfirm={() => {
        const target = confirmReturn
        setConfirmReturn(null)
        returnAllocation(target)
      }}
    />
  </div>
}
