'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listOutboxLog, retryOutboxAction, type OutboxLogRow } from './actions'

const STATUS: Record<OutboxLogRow['status'], { label: string; tone: string }> = {
  PENDING: { label: 'Menunggu', tone: 'bg-sky-50 text-sky-700' },
  PROCESSING: { label: 'Diproses', tone: 'bg-amber-50 text-amber-700' },
  DONE: { label: 'Terkirim', tone: 'bg-emerald-50 text-emerald-700' },
  SKIPPED: { label: 'Dilewati', tone: 'bg-slate-100 text-slate-600' },
  FAILED: { label: 'Gagal', tone: 'bg-rose-50 text-rose-700' },
}
const SKIP_REASON: Record<string, string> = {
  DISABLED: 'jenis notifikasi nonaktif',
  NO_RECIPIENT: 'tidak ada penerima (atau semua mematikan kategori ini)',
  UNKNOWN_EVENT: 'jenis notifikasi tidak dikenal',
}

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
}

export function LogPanel() {
  const [status, setStatus] = useState('')
  const [audience, setAudience] = useState<'' | 'PARENT' | 'STAFF'>('')
  const [rows, setRows] = useState<OutboxLogRow[] | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)

  const load = useCallback(async () => {
    setRows(null)
    const res = await listOutboxLog({ status, audience })
    if (!res.ok) { toast.error(res.error); setRows([]); return }
    setRows(res.data)
  }, [status, audience])
  useEffect(() => { const t = window.setTimeout(load, 0); return () => window.clearTimeout(t) }, [load])

  async function retry(id: string) {
    setRetrying(id)
    const res = await retryOutboxAction(id)
    setRetrying(null)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Dijadwalkan ulang. Penerima yang sudah menerima tidak akan dikirimi dua kali.')
    load()
  }

  const select = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700'
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <select aria-label="Saring status" value={status} onChange={e => setStatus(e.target.value)} className={select}>
          <option value="">Semua status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select aria-label="Saring penerima" value={audience} onChange={e => setAudience(e.target.value as typeof audience)} className={select}>
          <option value="">Wali & pegawai</option>
          <option value="PARENT">Wali santri</option>
          <option value="STAFF">Pegawai</option>
        </select>
        <button type="button" onClick={load} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Muat ulang
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Waktu</th>
              <th className="px-4 py-2.5">Jenis</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Penerima</th>
              <th className="px-4 py-2.5 text-right">Push</th>
              <th className="px-4 py-2.5">Keterangan</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null && <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>}
            {rows?.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-500">Belum ada catatan pengiriman.</td></tr>}
            {rows?.map(r => (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{when(r.created_at)}</td>
                <td className="px-4 py-2.5 text-slate-900">{r.event_label}</td>
                <td className="px-4 py-2.5">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS[r.status].tone)}>{STATUS[r.status].label}</span>
                  {r.attempts > 1 && <span className="ml-1 text-[11px] text-slate-400">×{r.attempts}</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.recipient_count.toLocaleString('id-ID')}</td>
                <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                  <span className="text-emerald-700">{r.push_sent}</span>
                  {r.push_failed > 0 && <span className="text-rose-600"> / {r.push_failed} gagal</span>}
                </td>
                <td className="max-w-[18rem] px-4 py-2.5 text-xs text-slate-500">
                  {r.status === 'SKIPPED' && (SKIP_REASON[r.skip_reason ?? ''] ?? r.skip_reason)}
                  {r.status === 'FAILED' && <span className="text-rose-600">{r.last_error}</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {(r.status === 'FAILED' || r.status === 'SKIPPED') && (
                    <button type="button" onClick={() => retry(r.id)} disabled={retrying === r.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50">
                      {retrying === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Kirim ulang
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">150 catatan terbaru. Data notifikasi lebih dari 180 hari dan log push lebih dari 60 hari dihapus otomatis.</p>
    </section>
  )
}
