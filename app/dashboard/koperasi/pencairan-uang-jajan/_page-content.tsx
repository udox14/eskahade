'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowClockwise, HandCoins, Printer, Warning, X, CheckCircle } from '@phosphor-icons/react'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { useConfirm } from '@/components/ui/confirm-dialog'
import {
  createPayoutAction,
  getPayoutCandidatesAction,
  getPayoutDetailAction,
  getPencairanInitialData,
  settlePayoutAction,
} from './actions'
import type { PayoutBatchRow, PayoutCandidate } from '@/lib/finance/wallet-payout'

type InitialData = Awaited<ReturnType<typeof getPencairanInitialData>>
type Detail = Awaited<ReturnType<typeof getPayoutDetailAction>>

const rupiah = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID')
const wib = (iso: string | null) => iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
const newKey = () => crypto.randomUUID()

export default function PencairanContent({ initialData }: { initialData: InitialData }) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [settling, setSettling] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)

  const reload = () => startTransition(async () => {
    try { setData(await getPencairanInitialData()) } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat.') }
  })

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        title="Pencairan Uang Jajan"
        description="Uang jajan diserahkan ke perwakilan kamar/lantai. Setiap santri harus berakhir Diterima atau Dibatalkan (uang kembali ke loket)."
        action={
          <button type="button" onClick={reload} disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 disabled:opacity-50">
            <ArrowClockwise className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} weight="bold" /> Segarkan
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white text-sm">
        {data.cashSession ? (
          <>
            <span className="text-slate-600">Sesi kas <b className="font-mono">{data.cashSession.code}</b></span>
            <span className="text-slate-600">Uang tersedia di laci: <b className="font-mono">{rupiah(data.cashSession.available)}</b></span>
          </>
        ) : (
          <span className="flex items-center gap-2 text-amber-800"><Warning className="w-4 h-4" weight="bold" /> Sesi kas belum dibuka.
            <Link href="/dashboard/koperasi/loket" className="font-semibold underline">Buka di Loket Kasir</Link></span>
        )}
      </div>

      {data.openBatches.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Sedang dibawa perwakilan ({data.openBatches.length})</h2>
          <p className="text-xs text-slate-500">Selesaikan setelah perwakilan kembali. Sesi kas tidak bisa ditutup selama masih ada pencairan di sini.</p>
          <div className="bg-white border border-amber-200 rounded-xl divide-y divide-amber-100">
            {data.openBatches.map(batch => (
              <BatchRow key={batch.id} batch={batch} onView={() => setViewing(batch.id)}
                action={!data.isViewOnly ? <button type="button" onClick={() => setSettling(batch.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg">Selesaikan</button> : null} />
            ))}
          </div>
        </section>
      )}

      {!data.isViewOnly && <CreatePayout data={data} onCreated={id => { reload(); setViewing(id) }} />}

      {data.todayBatches.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Selesai hari ini</h2>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {data.todayBatches.map(batch => <BatchRow key={batch.id} batch={batch} onView={() => setViewing(batch.id)} />)}
          </div>
        </section>
      )}

      {settling && <SettleDialog batchId={settling} onClose={() => setSettling(null)} onDone={() => { setSettling(null); reload() }} />}
      {viewing && <DetailDialog batchId={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function BatchRow({ batch, onView, action }: { batch: PayoutBatchRow; onView: () => void; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
        <div className="text-sm font-semibold text-slate-900">{batch.representative_name} · {batch.asrama}{batch.scope_label ? ` · ${batch.scope_label}` : ''}</div>
        <div className="text-xs text-slate-500">{batch.batch_number} · {batch.item_count} santri · {wib(batch.created_at)} · {batch.operator_name || '-'}</div>
      </button>
      <div className="text-right text-sm">
        <div className="font-mono font-semibold">{rupiah(batch.total_amount)}</div>
        {batch.status === 'SELESAI' && (
          <div className="text-xs text-slate-500">Diterima {rupiah(batch.total_delivered)}{batch.total_returned ? ` · kembali ${rupiah(batch.total_returned)}` : ''}</div>
        )}
      </div>
      {action}
    </div>
  )
}

function CreatePayout({ data, onCreated }: { data: InitialData; onCreated: (batchId: string) => void }) {
  const confirm = useConfirm()
  const [asrama, setAsrama] = useState('')
  const [kamar, setKamar] = useState('')
  const [blok, setBlok] = useState('')
  const [rooms, setRooms] = useState<string[]>([])
  const [blocks, setBlocks] = useState<string[]>([])
  const [candidates, setCandidates] = useState<PayoutCandidate[]>([])
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [defaultAmount, setDefaultAmount] = useState(20000)
  const [repId, setRepId] = useState('')
  const [repName, setRepName] = useState('')
  const [scopeLabel, setScopeLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(newKey)

  const load = async (next: { asrama: string; kamar?: string; blok?: string }) => {
    if (!next.asrama) { setCandidates([]); return }
    setLoading(true)
    try {
      const res = await getPayoutCandidatesAction({ asrama: next.asrama, kamar: next.kamar || null, blok: next.blok || null })
      setCandidates(res.candidates); setRooms(res.rooms); setBlocks(res.blocks)
      const eligible = res.candidates.filter(c => !c.blocked_reason)
      setPicked(new Set(eligible.map(c => c.id)))
      setAmounts(Object.fromEntries(eligible.map(c => [c.id, Math.min(defaultAmount, c.balance, c.remaining_quota)])))
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat santri.') }
    finally { setLoading(false) }
  }

  const maxFor = (c: PayoutCandidate) => Math.min(c.balance, c.remaining_quota)
  const rows = candidates.map(c => {
    const amount = amounts[c.id] ?? 0
    const invalid = picked.has(c.id) && (amount <= 0 || amount > maxFor(c))
    return { c, amount, invalid }
  })
  const chosen = rows.filter(r => picked.has(r.c.id) && !r.c.blocked_reason)
  const total = chosen.reduce((sum, r) => sum + r.amount, 0)
  const hasInvalid = chosen.some(r => r.invalid)
  const overCash = data.cashSession ? total > data.cashSession.available : true

  const applyDefault = () => setAmounts(Object.fromEntries(candidates.filter(c => !c.blocked_reason).map(c => [c.id, Math.min(defaultAmount, maxFor(c))])))

  const submit = async () => {
    if (!repName.trim()) { toast.error('Isi nama perwakilan.'); return }
    if (!chosen.length) { toast.error('Pilih minimal satu santri.'); return }
    if (hasInvalid) { toast.error('Ada nominal yang kosong atau melebihi saldo/limit.'); return }
    if (!await confirm(`Serahkan ${rupiah(total)} untuk ${chosen.length} santri kepada ${repName}? Saldo santri langsung berkurang. Santri yang tidak hadir nanti dibatalkan dan uangnya wajib dikembalikan ke loket.`,
      { title: 'Serahkan uang ke perwakilan', confirmLabel: 'Ya, serahkan', variant: 'warning' })) return
    setSaving(true)
    const res = await createPayoutAction({
      idempotencyKey, asrama, scopeLabel, representativeSantriId: repId || null, representativeName: repName,
      items: chosen.map(r => ({ santriId: r.c.id, amount: r.amount })),
    })
    setSaving(false)
    if (!res.success) { toast.error(res.error); return }
    toast.success(`Pencairan ${res.data!.batchNumber} dibuat. Cetak daftar untuk perwakilan.`)
    setIdempotencyKey(newKey()); setCandidates([]); setPicked(new Set()); setRepId(''); setRepName(''); setScopeLabel('')
    onCreated(res.data!.batchId)
  }

  const inputClass = 'text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white'
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><HandCoins className="w-4 h-4 text-emerald-700" /> Buat pencairan baru</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Asrama</span>
          <select className={inputClass + ' w-full'} value={asrama} onChange={e => { setAsrama(e.target.value); setKamar(''); setBlok(''); load({ asrama: e.target.value }) }}>
            <option value="">Pilih asrama</option>
            {data.asramaOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select></label>
        {blocks.length > 0 && (
          <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Blok / lantai</span>
            <select className={inputClass + ' w-full'} value={blok} onChange={e => { setBlok(e.target.value); load({ asrama, kamar, blok: e.target.value }) }}>
              <option value="">Semua</option>
              {blocks.map(b => <option key={b} value={b}>{b}</option>)}
            </select></label>
        )}
        <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Kamar</span>
          <select className={inputClass + ' w-full'} value={kamar} disabled={!asrama} onChange={e => { setKamar(e.target.value); load({ asrama, kamar: e.target.value, blok }) }}>
            <option value="">Semua kamar</option>
            {rooms.map(r => <option key={r} value={r}>Kamar {r}</option>)}
          </select></label>
        <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Nominal per santri</span>
          <div className="flex gap-2">
            <input type="number" min={0} step={1000} className={inputClass + ' w-full font-mono'} value={defaultAmount} onChange={e => setDefaultAmount(Math.max(0, parseInt(e.target.value, 10) || 0))} />
            <button type="button" onClick={applyDefault} disabled={!candidates.length} className="px-3 text-xs font-semibold border border-slate-200 rounded-lg disabled:opacity-50">Terapkan</button>
          </div></label>
      </div>

      {asrama && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Perwakilan (santri)</span>
            <select className={inputClass + ' w-full'} value={repId} onChange={e => {
              setRepId(e.target.value)
              const c = candidates.find(x => x.id === e.target.value)
              if (c) setRepName(c.nama_lengkap)
            }}>
              <option value="">Pilih dari daftar (opsional)</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.nama_lengkap} · Kamar {c.kamar || '-'}</option>)}
            </select></label>
          <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Nama perwakilan</span>
            <input className={inputClass + ' w-full'} value={repName} onChange={e => setRepName(e.target.value)} placeholder="Wajib diisi" /></label>
          <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Cakupan (opsional)</span>
            <input className={inputClass + ' w-full'} value={scopeLabel} onChange={e => setScopeLabel(e.target.value)} placeholder="Contoh: Kamar 3 / Lantai 2" /></label>
        </div>
      )}

      {loading && <p className="text-xs text-slate-500">Memuat santri…</p>}
      {candidates.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 sticky top-0">
                <tr>
                  <th className="p-2 w-8"><input type="checkbox" aria-label="Pilih semua"
                    checked={candidates.filter(c => !c.blocked_reason).every(c => picked.has(c.id))}
                    onChange={e => setPicked(e.target.checked ? new Set(candidates.filter(c => !c.blocked_reason).map(c => c.id)) : new Set())} /></th>
                  <th className="p-2 text-left">Santri</th><th className="p-2 text-left">Kamar</th>
                  <th className="p-2 text-right">Saldo</th><th className="p-2 text-right">Sisa limit</th><th className="p-2 text-right w-36">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ c, amount, invalid }) => (
                  <tr key={c.id} className={c.blocked_reason ? 'text-slate-400' : ''}>
                    <td className="p-2"><input type="checkbox" disabled={!!c.blocked_reason} checked={picked.has(c.id) && !c.blocked_reason} aria-label={`Pilih ${c.nama_lengkap}`}
                      onChange={e => { const next = new Set(picked); if (e.target.checked) next.add(c.id); else next.delete(c.id); setPicked(next) }} /></td>
                    <td className="p-2"><div className="font-medium text-slate-800">{c.nama_lengkap}</div>{c.blocked_reason && <div className="text-[11px]">{c.blocked_reason}</div>}</td>
                    <td className="p-2">{c.kamar || '-'}</td>
                    <td className="p-2 text-right font-mono">{rupiah(c.balance)}</td>
                    <td className="p-2 text-right font-mono">{rupiah(c.remaining_quota)}</td>
                    <td className="p-2 text-right">
                      {!c.blocked_reason && (
                        <input type="number" min={0} step={1000} value={amount || ''} aria-label={`Nominal ${c.nama_lengkap}`}
                          onChange={e => setAmounts({ ...amounts, [c.id]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                          className={`w-28 text-right font-mono border rounded px-2 py-1 ${invalid ? 'border-red-400 bg-red-50' : 'border-slate-200'}`} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-3">
            <div className="text-sm">{chosen.length} santri · <b className="font-mono">{rupiah(total)}</b>
              {overCash && data.cashSession && <span className="ml-2 text-xs text-red-600">Melebihi uang di laci.</span>}
            </div>
            <button type="button" onClick={submit} disabled={saving || !data.cashSession || !chosen.length || hasInvalid || overCash}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? 'Menyimpan…' : 'Serahkan ke perwakilan'}
            </button>
          </div>
        </div>
      )}
      {asrama && !loading && candidates.length === 0 && <p className="text-xs text-slate-500">Tidak ada santri aktif pada pilihan ini.</p>}
    </section>
  )
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button type="button" aria-label="Tutup" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

function useDetail(batchId: string) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { getPayoutDetailAction(batchId).then(setDetail).catch(e => setError(e instanceof Error ? e.message : 'Gagal memuat.')) }, [batchId])
  return { detail, error }
}

function printChecklist(detail: Detail) {
  const h = detail.header
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!))
  const rows = detail.items.map((item, i) => `<tr><td>${i + 1}</td><td>${esc(item.nama_lengkap)}</td><td>${esc(item.kamar || '-')}</td><td style="text-align:right">${rupiah(item.amount)}</td><td></td></tr>`).join('')
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) { toast.error('Izinkan pop-up untuk mencetak.'); return }
  win.document.write(`<!doctype html><html><head><title>${esc(h.batch_number)}</title><style>
    body{font-family:system-ui,sans-serif;font-size:12px;padding:24px}table{width:100%;border-collapse:collapse}
    td,th{border:1px solid #999;padding:6px}th{background:#f1f5f9}h1{font-size:16px;margin:0 0 4px}</style></head><body>
    <h1>Daftar Pencairan Uang Jajan</h1>
    <div>${esc(h.batch_number)} · ${esc(h.payout_date)} · ${esc(h.asrama)}${h.scope_label ? ' · ' + esc(h.scope_label) : ''}</div>
    <div>Perwakilan: <b>${esc(h.representative_name)}</b> · Petugas: ${esc(h.operator_name || '-')} · Total ${rupiah(h.total_amount)} (${h.item_count} santri)</div>
    <p>Santri yang tidak hadir: jangan diberikan, kembalikan uangnya ke loket.</p>
    <table><thead><tr><th>No</th><th>Nama</th><th>Kamar</th><th>Nominal</th><th>Paraf penerima</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="margin-top:32px">Perwakilan: ____________________ &nbsp;&nbsp;&nbsp; Petugas loket: ____________________</p>
    <script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}

function DetailDialog({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const { detail, error } = useDetail(batchId)
  return (
    <Modal title={detail ? `${detail.header.batch_number} · ${detail.header.representative_name}` : 'Memuat…'} onClose={onClose}
      footer={detail && <button type="button" onClick={() => printChecklist(detail)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-200 rounded-lg"><Printer className="w-4 h-4" /> Cetak daftar</button>}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {detail && (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-500">{detail.header.asrama}{detail.header.scope_label ? ` · ${detail.header.scope_label}` : ''} · {wib(detail.header.created_at)} · {detail.header.status === 'DIBAWA' ? 'Sedang dibawa' : `Selesai ${wib(detail.header.settled_at)}`}</p>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs">
            {detail.items.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>{item.nama_lengkap} <span className="text-slate-500">· Kamar {item.kamar || '-'}</span>{item.cancel_reason ? <span className="block text-slate-500">Dibatalkan: {item.cancel_reason}</span> : null}</span>
                <span className="text-right"><span className="font-mono">{rupiah(item.amount)}</span><span className="block text-slate-500">{item.status === 'DIBAWA' ? 'Dibawa' : item.status === 'DITERIMA' ? 'Diterima' : 'Dibatalkan'}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}

function SettleDialog({ batchId, onClose, onDone }: { batchId: string; onClose: () => void; onDone: () => void }) {
  const confirm = useConfirm()
  const { detail, error } = useDetail(batchId)
  const [absent, setAbsent] = useState<Record<string, string>>({})
  const [returned, setReturned] = useState('')
  const [saving, setSaving] = useState(false)
  const [idempotencyKey] = useState(newKey)

  const cancelled = detail ? detail.items.filter(i => i.id in absent) : []
  const cancelledTotal = cancelled.reduce((sum, i) => sum + i.amount, 0)
  const returnedAmount = Number(returned.replace(/\D/g, '')) || 0
  const missingReason = cancelled.some(i => (absent[i.id] || '').trim().length < 3)
  const cashMismatch = returnedAmount !== cancelledTotal

  const submit = async () => {
    if (!detail) return
    if (missingReason) { toast.error('Isi alasan untuk setiap santri yang dibatalkan.'); return }
    if (cashMismatch) { toast.error(`Uang yang dikembalikan harus ${rupiah(cancelledTotal)}.`); return }
    if (!await confirm(`${detail.items.length - cancelled.length} santri diterima (${rupiah(detail.header.total_amount - cancelledTotal)}), ${cancelled.length} dibatalkan dan ${rupiah(cancelledTotal)} kembali ke laci. Lanjutkan?`,
      { title: 'Selesaikan pencairan', confirmLabel: 'Ya, selesaikan', variant: 'success' })) return
    setSaving(true)
    const res = await settlePayoutAction({ batchId, idempotencyKey, returnedCash: returnedAmount,
      cancelled: cancelled.map(i => ({ itemId: i.id, reason: absent[i.id] })) })
    setSaving(false)
    if (!res.success) { toast.error(res.error); return }
    toast.success('Pencairan diselesaikan.')
    onDone()
  }

  return (
    <Modal title="Selesaikan pencairan" onClose={() => !saving && onClose()}
      footer={detail && (
        <button type="button" onClick={submit} disabled={saving || missingReason || cashMismatch}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg disabled:opacity-50">
          <CheckCircle className="w-4 h-4" /> {saving ? 'Menyimpan…' : 'Selesaikan'}
        </button>
      )}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {detail && (
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-600">Hilangkan centang untuk santri yang <b>tidak menerima</b> (misal pulang). Haknya dibatalkan, saldo kembali ke santri, dan uangnya harus diterima kembali di loket.</p>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs">
            {detail.items.map(item => {
              const isAbsent = item.id in absent
              return (
                <li key={item.id} className={`px-3 py-2 space-y-1.5 ${isAbsent ? 'bg-red-50/60' : ''}`}>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={!isAbsent} onChange={e => {
                      const next = { ...absent }
                      if (e.target.checked) delete next[item.id]; else next[item.id] = ''
                      setAbsent(next)
                    }} />
                    <span className="flex-1">{item.nama_lengkap} <span className="text-slate-500">· Kamar {item.kamar || '-'}</span></span>
                    <span className="font-mono">{rupiah(item.amount)}</span>
                  </label>
                  {isAbsent && (
                    <input value={absent[item.id]} onChange={e => setAbsent({ ...absent, [item.id]: e.target.value })} placeholder="Alasan (contoh: pulang ke rumah)"
                      className="w-full border border-red-200 rounded px-2 py-1 bg-white" aria-label={`Alasan pembatalan ${item.nama_lengkap}`} />
                  )}
                </li>
              )
            })}
          </ul>
          <div className="rounded-lg border border-slate-200 p-3 space-y-2">
            <div className="flex justify-between"><span>Hak dibatalkan</span><span className="font-mono font-semibold">{rupiah(cancelledTotal)}</span></div>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 mb-1">Uang yang dikembalikan perwakilan (hitung fisik)</span>
              <input inputMode="numeric" value={returned} placeholder="0"
                onChange={e => setReturned(e.target.value.replace(/\D/g, '') ? Number(e.target.value.replace(/\D/g, '')).toLocaleString('id-ID') : '')}
                className={`w-full font-mono border rounded-lg px-3 py-2 ${returned !== '' && cashMismatch ? 'border-red-400' : 'border-slate-300'}`} />
              {cashMismatch && <span className="block text-xs text-red-600 mt-1">Harus sama dengan {rupiah(cancelledTotal)}. Jika uang kurang, selesaikan dulu dengan perwakilan.</span>}
            </label>
          </div>
        </div>
      )}
    </Modal>
  )
}
