'use client'

// Menu Kas Bank — Mutasi Kas Bank ↔ Tunai lintas sesi (ambil dari / setor ke rekening Koperasi).

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowClockwise, Bank, ArrowCircleDown, ArrowCircleUp, Warning, Plus } from '@phosphor-icons/react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import CashTransferModal from '../loket/cash-transfer-modal'
import { voidLoketCashTransferAction } from '../loket/actions'
import { getKasBankData, type KasBankFilter } from './actions'
import type { CashTransferRow } from '@/lib/finance/cash-transfers'

type Data = Awaited<ReturnType<typeof getKasBankData>>

const rupiah = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID')
const wib = (iso: string | null) => iso
  ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '-'

function accountLabel(snapshot: string): string {
  try {
    const a = JSON.parse(snapshot) as { bank_name?: string; account_number?: string }
    const no = String(a.account_number ?? '')
    return `${a.bank_name ?? ''} ···${no.slice(-4)}`
  } catch { return '-' }
}

function StatusBadge({ row }: { row: CashTransferRow }) {
  if (row.status === 'VOIDED') return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">Dibatalkan</span>
  if (row.statement_transaction_id) return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">Cocok rekening koran</span>
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">Belum dicocokkan</span>
}

export default function KasBankContent({ initialData }: { initialData: Data }) {
  const [data, setData] = useState(initialData)
  const [filter, setFilter] = useState<KasBankFilter>({ direction: 'SEMUA', state: 'SEMUA', fromDate: '', toDate: '' })
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState(false)

  const load = (next: KasBankFilter = filter) => startTransition(async () => {
    try { setData(await getKasBankData({ ...next, offset: 0 })) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat mutasi kas.') }
  })
  const loadMore = () => startTransition(async () => {
    try {
      const more = await getKasBankData({ ...filter, offset: data.items.length })
      setData(d => ({ ...more, items: [...d.items, ...more.items] }))
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat mutasi kas.') }
  })
  const update = (patch: Partial<KasBankFilter>) => { const next = { ...filter, ...patch }; setFilter(next); load(next) }

  const canVoid = (row: CashTransferRow) =>
    !data.viewer.isViewOnly && row.status === 'POSTED' && !row.statement_transaction_id && row.session_status === 'OPEN' &&
    (row.operator_id === data.viewer.id || data.viewer.roles.some(r => r === 'admin' || r === 'bendahara'))

  const voidRow = async (row: CashTransferRow) => {
    const reason = window.prompt(`Batalkan ${row.transfer_number} (${rupiah(row.amount)})? Tulis alasannya:`)
    if (reason === null) return
    const res = await voidLoketCashTransferAction({ id: row.id, reason })
    if (!res.success) { toast.error(res.error); return }
    toast.success('Mutasi kas dibatalkan.')
    load()
  }

  const field = 'px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500'

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        title="Kas Bank"
        description="Uang yang diambil dari rekening Koperasi untuk laci loket, atau disetor kembali ke rekening. Bukan pembayaran atau pendapatan — hanya perpindahan tempat simpan uang."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => load()} disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 disabled:opacity-50">
              <ArrowClockwise className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} weight="bold" /> Segarkan
            </button>
            {!data.viewer.isViewOnly && data.cashSession && (
              <button type="button" onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg">
                <Plus className="w-3.5 h-3.5" weight="bold" /> Catat mutasi kas
              </button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white text-sm">
        {data.cashSession ? (
          <>
            <span className="text-slate-600">Sesi kas <b className="font-mono">{data.cashSession.code}</b></span>
            <span className="text-slate-600">Uang di laci: <b className="font-mono">{rupiah(data.cashSession.available)}</b></span>
          </>
        ) : (
          <span className="flex items-center gap-2 text-amber-800"><Warning className="w-4 h-4" weight="bold" />
            Mutasi kas dicatat di dalam sesi kas. Sesi kas Anda belum dibuka.
            <Link href="/dashboard/koperasi/loket" className="font-semibold underline">Buka di Loket Kasir</Link></span>
        )}
        {!data.viewer.seesAll && <span className="text-xs text-slate-500">Menampilkan mutasi yang Anda catat.</span>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ambil dari rekening', value: rupiah(data.summary.bankIn), icon: ArrowCircleDown, tone: 'text-emerald-700' },
          { label: 'Setor ke rekening', value: rupiah(data.summary.bankOut), icon: ArrowCircleUp, tone: 'text-rose-700' },
          { label: 'Belum dicocokkan', value: String(data.summary.unmatched), icon: Bank, tone: 'text-amber-700' },
          { label: 'Dibatalkan', value: String(data.summary.voided), icon: Warning, tone: 'text-slate-600' },
        ].map(card => (
          <div key={card.label} className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><card.icon className={`w-4 h-4 ${card.tone}`} weight="bold" />{card.label}</div>
            <div className={`mt-1 text-lg font-bold font-mono ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-xs text-slate-500">Ringkasan mengikuti filter. Yang belum dicocokkan diselesaikan Bendahara/Admin di Rekonsiliasi → Rekonsiliasi Bank → panel Mutasi Kas Bank ↔ Tunai.</p>

      <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl border border-slate-200 bg-white">
        <label className="text-xs font-semibold text-slate-600 space-y-1">
          <span className="block">Arah</span>
          <select className={field} value={filter.direction} onChange={e => update({ direction: e.target.value as KasBankFilter['direction'] })}>
            <option value="SEMUA">Semua</option>
            <option value="BANK_TO_CASH">Ambil dari rekening</option>
            <option value="CASH_TO_BANK">Setor ke rekening</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 space-y-1">
          <span className="block">Status</span>
          <select className={field} value={filter.state} onChange={e => update({ state: e.target.value as KasBankFilter['state'] })}>
            <option value="SEMUA">Semua</option>
            <option value="POSTED_UNMATCHED">Belum dicocokkan</option>
            <option value="MATCHED">Cocok rekening koran</option>
            <option value="VOIDED">Dibatalkan</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 space-y-1">
          <span className="block">Dari tanggal (WIB)</span>
          <input type="date" className={field} value={filter.fromDate ?? ''} onChange={e => update({ fromDate: e.target.value })} />
        </label>
        <label className="text-xs font-semibold text-slate-600 space-y-1">
          <span className="block">Sampai</span>
          <input type="date" className={field} value={filter.toDate ?? ''} onChange={e => update({ toDate: e.target.value })} />
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Waktu di bank</th>
              <th className="text-left px-4 py-2.5">Mutasi</th>
              <th className="text-right px-4 py-2.5">Nominal</th>
              <th className="text-left px-4 py-2.5">Rekening</th>
              <th className="text-left px-4 py-2.5">Petugas</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">Belum ada mutasi kas pada filter ini.</td></tr>
            ) : data.items.map(row => (
              <tr key={row.id} className={row.status === 'VOIDED' ? 'opacity-60' : ''}>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">{wib(row.bank_transacted_at)}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{row.direction === 'BANK_TO_CASH' ? 'Ambil dari rekening' : 'Setor ke rekening'}</div>
                  <div className="text-xs text-slate-500 font-mono">{row.transfer_number} · sesi {row.session_code}</div>
                  {row.bank_reference && <div className="text-xs text-slate-500">Ref {row.bank_reference}</div>}
                  {row.status === 'VOIDED' && row.void_reason && <div className="text-xs text-rose-700">Alasan batal: {row.void_reason}</div>}
                </td>
                <td className={`px-4 py-3 text-right font-mono font-semibold whitespace-nowrap ${row.direction === 'BANK_TO_CASH' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {row.direction === 'BANK_TO_CASH' ? '+' : '−'}{rupiah(row.amount)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">{accountLabel(row.account_snapshot)}</td>
                <td className="px-4 py-3 text-slate-700">
                  <div>{row.handled_by_name}</div>
                  <div className="text-xs text-slate-500">dicatat {row.operator_name ?? '-'}</div>
                </td>
                <td className="px-4 py-3"><StatusBadge row={row} /></td>
                <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                  <a className="text-xs font-semibold text-sky-700 underline" href={`/api/finance/cash-transfer-proofs/${encodeURIComponent(row.id)}`} target="_blank" rel="noreferrer">Bukti</a>
                  {canVoid(row) && (
                    <button type="button" onClick={() => voidRow(row)} className="text-xs font-semibold text-rose-700 border border-rose-200 rounded-lg px-2 py-1 hover:bg-rose-50">Batalkan</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.items.length < data.total && (
        <div className="text-center">
          <button type="button" onClick={loadMore} disabled={isPending}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
            Tampilkan lebih banyak ({data.items.length} dari {data.total})
          </button>
        </div>
      )}

      <CashTransferModal
        isOpen={modalOpen}
        sessionId={data.cashSession?.id ?? null}
        drawerBalance={data.cashSession?.available ?? 0}
        operatorName={data.viewer.name}
        accounts={data.accounts}
        onClose={() => setModalOpen(false)}
        onChanged={() => load()}
      />
    </div>
  )
}
