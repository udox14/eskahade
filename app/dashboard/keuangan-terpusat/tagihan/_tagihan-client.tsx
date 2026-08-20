'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle, Receipt, Warning } from '@phosphor-icons/react'
import { getBillItemStudents, type BillItem, type BillStudentRow } from './actions'
import { ExportButton } from '../_components/finance-inputs'
import {
  EmptyState, FINANCE_FIELD_CLASS, FinanceTabs, MetricCard, SectionPanel, StatusBadge,
} from '../_components/finance-ui'

const KIND_LABEL: Record<string, string> = {
  SPP: 'SPP', USPP: 'USPP', NON_SPP: 'Non-SPP', MAKAN: 'Uang Makan', LAUNDRY: 'Laundry',
}
const STATUS_LABEL: Record<string, string> = {
  PAID: 'Lunas', PARTIAL: 'Nyicil', OPEN: 'Belum bayar', VOID: 'Ditiadakan',
}
const PAGE_SIZE = 50
const field = FINANCE_FIELD_CLASS
const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const itemKey = (item: BillItem) => `${item.bill_kind}|${item.period_key}|${item.title}`
const kindLabel = (kind: string) => KIND_LABEL[kind] || kind

type Tab = 'SEMUA' | 'OPEN' | 'PARTIAL' | 'PAID' | 'VOID'

export function TagihanClient({ items, scope }: { items: BillItem[]; scope: string | null }) {
  const [pending, startTransition] = useTransition()
  const [selectedKey, setSelectedKey] = useState<string>(items[0] ? itemKey(items[0]) : '')
  const [rows, setRows] = useState<BillStudentRow[]>([])
  const [tab, setTab] = useState<Tab>('OPEN')
  const [q, setQ] = useState('')
  const [asrama, setAsrama] = useState('')
  const [page, setPage] = useState(1)

  const selected = items.find(item => itemKey(item) === selectedKey) || null

  useEffect(() => {
    if (!selected) { setRows([]); return }
    let stale = false
    startTransition(async () => {
      const outcome = await getBillItemStudents({
        billKind: selected.bill_kind, periodKey: selected.period_key, title: selected.title,
      })
      if (stale) return
      if ('error' in outcome) { toast.error(outcome.error); setRows([]); return }
      setRows(outcome.rows)
    })
    return () => { stale = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey])

  // Filter dan pencarian dilakukan di klien: seluruh baris satu item sudah
  // diambil sekali, jadi berpindah antar status terasa seketika.
  const asramaOptions = useMemo(
    () => [...new Set(rows.map(row => row.asrama).filter(Boolean) as string[])].sort(),
    [rows])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter(row => {
      if (tab !== 'SEMUA' && row.status !== tab) return false
      if (asrama && row.asrama !== asrama) return false
      if (!needle) return true
      return (row.full_name || '').toLowerCase().includes(needle) || (row.nis || '').toLowerCase().includes(needle)
    })
  }, [rows, tab, asrama, q])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [selectedKey, tab, asrama, q])

  const counts = useMemo(() => ({
    SEMUA: rows.length,
    OPEN: rows.filter(row => row.status === 'OPEN').length,
    PARTIAL: rows.filter(row => row.status === 'PARTIAL').length,
    PAID: rows.filter(row => row.status === 'PAID').length,
    VOID: rows.filter(row => row.status === 'VOID').length,
  }), [rows])

  const sisa = selected ? Number(selected.amount_rupiah) - Number(selected.paid_rupiah) : 0
  const persen = selected && Number(selected.amount_rupiah) > 0
    ? Math.round((Number(selected.paid_rupiah) / Number(selected.amount_rupiah)) * 100) : 0

  if (!items.length) {
    return <SectionPanel title="Rekap tagihan" description="Pilih satu item pembayaran untuk melihat siapa yang sudah lunas, nyicil, dan belum bayar.">
      <EmptyState icon={Receipt} title="Belum ada tagihan sama sekali"
        description="Rekap muncul setelah ada tagihan yang dibuat — lewat generate tagihan bulanan di Tarif Layanan, sinkronisasi SPP, atau input manual di halaman Operasi." />
    </SectionPanel>
  }

  return <div className="space-y-4">
    <SectionPanel title="Pilih item pembayaran" description={scope ? `Angka di bawah hanya mencakup santri asrama ${scope}.` : 'Satu item = satu jenis tagihan pada satu periode.'}>
      <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="text-xs font-bold text-slate-700">Item tagihan
          <select value={selectedKey} onChange={event => setSelectedKey(event.target.value)} className={`mt-1.5 ${field}`}>
            {Object.keys(KIND_LABEL).filter(kind => items.some(item => item.bill_kind === kind)).map(kind =>
              <optgroup key={kind} label={kindLabel(kind)}>
                {items.filter(item => item.bill_kind === kind).map(item =>
                  <option key={itemKey(item)} value={itemKey(item)}>{item.title} — {item.total} santri</option>)}
              </optgroup>)}
          </select>
        </label>
        <ExportButton
          filename={`tagihan-${selected?.title || 'item'}`.replace(/[^\w-]+/g, '-').toLowerCase()}
          sheetName="Tagihan"
          disabled={pending || !filtered.length}
          label={`Unduh ${filtered.length} baris`}
          rows={() => filtered.map(row => ({
            NIS: row.nis || '', Nama: row.full_name || '', Asrama: row.asrama || '',
            Tagihan: Number(row.amount_rupiah), Dibayar: Number(row.paid_rupiah),
            Sisa: Number(row.amount_rupiah) - Number(row.paid_rupiah),
            Status: STATUS_LABEL[row.status] || row.status, 'Jatuh tempo': row.due_date || '',
          }))}
        />
      </div>
    </SectionPanel>

    {selected ? <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Lunas" value={String(selected.lunas)} detail={`dari ${selected.total} santri`} icon="listChecks" />
      <MetricCard label="Nyicil" value={String(selected.nyicil)} detail="baru bayar sebagian" icon="receipt" tone={selected.nyicil ? 'amber' : 'slate'} />
      <MetricCard label="Belum bayar" value={String(selected.belum)} detail={selected.ditiadakan ? `${selected.ditiadakan} ditiadakan` : 'belum ada pembayaran'} icon="wallet" tone={selected.belum ? 'amber' : 'emerald'} />
      <MetricCard label="Terkumpul" value={rupiah(selected.paid_rupiah)} detail={`${persen}% · sisa ${rupiah(sisa)}`} icon="layers" tone="blue" />
    </section> : null}

    <FinanceTabs
      label="Status pembayaran"
      active={tab}
      onChange={id => setTab(id as Tab)}
      tabs={[
        { id: 'OPEN', label: 'Belum bayar', hint: 'Belum ada rupiah yang masuk untuk item ini', badge: counts.OPEN },
        { id: 'PARTIAL', label: 'Nyicil', hint: 'Sudah bayar sebagian, masih ada sisa', badge: counts.PARTIAL },
        { id: 'PAID', label: 'Lunas', hint: 'Tagihan sudah tertutup penuh', badge: 0 },
        { id: 'SEMUA', label: 'Semua', hint: 'Seluruh santri yang punya tagihan ini', badge: 0 },
      ]}
    />

    <SectionPanel
      title={selected ? selected.title : 'Daftar santri'}
      description={`${filtered.length} santri${asrama ? ` di ${asrama}` : ''}${q ? ` cocok dengan "${q}"` : ''}.`}>
      <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2">
        <input value={q} onChange={event => setQ(event.target.value)} placeholder="Cari nama atau NIS" className={field} />
        <select value={asrama} onChange={event => setAsrama(event.target.value)} className={field}>
          <option value="">Semua asrama</option>
          {asramaOptions.map(value => <option key={value}>{value}</option>)}
        </select>
      </div>

      {pending ? <p className="p-10 text-center text-sm text-slate-500">Memuat daftar santri...</p>
        : !filtered.length ? <EmptyState
          icon={tab === 'OPEN' || tab === 'PARTIAL' ? CheckCircle : Warning}
          title={tab === 'OPEN' ? 'Tidak ada yang belum bayar' : tab === 'PARTIAL' ? 'Tidak ada yang nyicil' : 'Tidak ada santri sesuai filter'}
          description={tab === 'OPEN' ? 'Semua santri pada item ini sudah membayar, penuh atau sebagian.' : 'Coba longgarkan pencarian atau filter asramanya.'} />
        : <>
          <div className="divide-y divide-slate-100 sm:hidden">{visible.map(row => <article key={row.id} className="space-y-2 px-4 py-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><strong className="block truncate text-slate-900">{row.full_name || '—'}</strong><p className="text-slate-500">{row.nis || 'NIS —'} · {row.asrama || 'Tanpa asrama'}</p></div>
              <StatusBadge tone={row.status === 'PAID' ? 'emerald' : row.status === 'PARTIAL' ? 'amber' : row.status === 'VOID' ? 'slate' : 'red'}>{STATUS_LABEL[row.status]}</StatusBadge>
            </div>
            <dl className="grid grid-cols-2 gap-1 tabular-nums">
              <dt className="text-slate-500">Tagihan</dt><dd className="text-right">{rupiah(row.amount_rupiah)}</dd>
              <dt className="text-slate-500">Dibayar</dt><dd className="text-right">{rupiah(row.paid_rupiah)}</dd>
              <dt className="font-bold text-slate-700">Sisa</dt><dd className="text-right font-bold">{rupiah(Number(row.amount_rupiah) - Number(row.paid_rupiah))}</dd>
            </dl>
          </article>)}</div>

          <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px] text-xs">
            <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr>
              <th className="px-4 py-2.5">Santri</th><th className="px-4 py-2.5">Asrama</th>
              <th className="px-4 py-2.5 text-right">Tagihan</th><th className="px-4 py-2.5 text-right">Dibayar</th>
              <th className="px-4 py-2.5 text-right">Sisa</th><th className="px-4 py-2.5">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{visible.map(row => <tr key={row.id}>
              <td className="px-4 py-3"><strong className="text-slate-900">{row.full_name || '—'}</strong><span className="block text-slate-500">{row.nis || 'NIS —'}</span></td>
              <td className="px-4 py-3 text-slate-500">{row.asrama || '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">{rupiah(row.amount_rupiah)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{rupiah(row.paid_rupiah)}</td>
              <td className="px-4 py-3 text-right font-bold tabular-nums">{rupiah(Number(row.amount_rupiah) - Number(row.paid_rupiah))}</td>
              <td className="px-4 py-3"><StatusBadge tone={row.status === 'PAID' ? 'emerald' : row.status === 'PARTIAL' ? 'amber' : row.status === 'VOID' ? 'slate' : 'red'}>{STATUS_LABEL[row.status]}</StatusBadge></td>
            </tr>)}</tbody>
          </table></div>

          {totalPages > 1 ? <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs">
            <span className="text-slate-500">Halaman {currentPage} dari {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="min-h-9 rounded-lg border border-slate-200 px-3 font-bold disabled:opacity-40">Sebelumnya</button>
              <button disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} className="min-h-9 rounded-lg border border-slate-200 px-3 font-bold disabled:opacity-40">Berikutnya</button>
            </div>
          </div> : null}
        </>}
    </SectionPanel>
  </div>
}
