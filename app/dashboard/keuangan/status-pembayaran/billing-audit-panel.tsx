'use client'

import { useState } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'
import {
  previewMissingBillingAction,
  applyMissingBillingAction,
  getBillingMonitorAction,
  verifyHistoricalBillingProviderAction,
} from './billing-actions'

type Preview = Awaited<ReturnType<typeof previewMissingBillingAction>>

const OUTCOME_LABELS: Record<string, string> = {
  READY: 'Aman dibuat',
  EXISTING: 'Sudah tersedia',
  EXEMPTED: 'Dibebaskan',
  LEGACY: 'Pembayaran modul lama',
  SKIPPED: 'Dilewati',
  REVIEW: 'Perlu pemeriksaan',
  FAILED: 'Konfigurasi belum lengkap',
}

function formatItemLabel(itemType: string): string {
  return FINANCE_ITEM_LABELS[itemType as FinanceItemType] || itemType.replace(/_/g, ' ')
}

export function BillingAuditPanel({
  canApply,
  onUpdated,
}: {
  canApply: boolean
  onUpdated: () => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [monitor, setMonitor] = useState<Awaited<ReturnType<typeof getBillingMonitorAction>> | null>(null)
  const [currentCursor, setCurrentCursor] = useState('')

  async function load(cursor = '') {
    setPending(true)
    setMessage('')
    setSelected(new Set())
    try {
      const [next, health] = await Promise.all([
        previewMissingBillingAction(cursor),
        getBillingMonitorAction(),
      ])
      setPreview(next)
      setMonitor(health)
      setCurrentCursor(cursor)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pratinjau belum dapat dimuat. Coba lagi.')
    } finally {
      setPending(false)
    }
  }

  async function apply() {
    if (!preview || !selected.size) return
    setPending(true)
    setMessage('')
    try {
      const result = await applyMissingBillingAction(
        [...selected].map((i) => preview.candidates[i])
      )
      setSelected(new Set())
      setPreview(null)
      setMessage(
        `${result.created} tagihan ditambahkan, ${result.review} perlu pemeriksaan, ${result.failed} gagal (Ref: ${result.runId}).`
      )
      onUpdated()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pelengkapan tagihan gagal diproses.')
    } finally {
      setPending(false)
    }
  }

  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-2xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-50/70 rounded-xl transition-colors [&::-webkit-details-marker]:hidden">
        <div>
          <span>Pemeriksaan Penerbitan Tagihan</span>
          <span className="mt-0.5 block text-xs font-normal text-slate-500">
            Cek tagihan yang belum terbentuk sejak peralihan sistem keuangan baru
          </span>
        </div>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="border-t border-slate-100 px-5 py-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-600 text-pretty max-w-2xl">
            Pembayaran modul lama, tarif aktif, dan status pembebasan diperiksa terlebih dahulu sebelum kandidat tagihan dapat dipilih untuk dilengkapi.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => load()}
            className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{pending ? 'Memeriksa…' : 'Muat Pratinjau'}</span>
          </button>
        </div>

        {message && (
          <p
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900"
          >
            {message}
          </p>
        )}

        {monitor && (
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs text-slate-600 space-y-2">
            <p>
              <strong className="text-slate-800">{monitor.legacyPending}</strong> kewajiban memiliki bukti pembayaran modul lama yang perlu pemeriksaan.{' '}
              {monitor.runs.length
                ? `Proses terakhir: ${
                    monitor.runs[0].status === 'COMPLETED' ? 'Selesai diproses' : 'Sedang memproses'
                  } (${monitor.runs[0].failed_count} gagal, ${monitor.runs[0].review_count} perlu pemeriksaan).`
                : 'Belum ada proses penerbitan otomatis.'}
            </p>
            {monitor.issues.length > 0 && (
              <details>
                <summary className="cursor-pointer font-semibold text-slate-700">
                  Kasus pemeriksaan penerbitan ({monitor.issues.length} terbaru)
                </summary>
                <ul className="mt-2 space-y-1 pl-4 list-disc">
                  {monitor.issues.map((i) => (
                    <li key={`${i.santri_id}:${i.item_type}:${i.period}`}>
                      <span className="font-medium text-slate-800">{i.name}</span> · {formatItemLabel(i.item_type)} ({i.period}): {i.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">Pilih</th>
                    <th className="px-3 py-2.5">Santri</th>
                    <th className="px-3 py-2.5">Pos &amp; Periode</th>
                    <th className="px-3 py-2.5 text-right">Nominal</th>
                    <th className="px-3 py-2.5">Hasil Pemeriksaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.candidates.map((c, i) => (
                    <tr key={`${c.santriId}:${c.itemType}:${c.period}`} className="align-top">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Lengkapi ${c.name} ${formatItemLabel(c.itemType)} ${c.period}`}
                          checked={selected.has(i)}
                          disabled={
                            pending ||
                            !canApply ||
                            !['READY', 'EXEMPTED'].includes(c.outcome) ||
                            (!selected.has(i) && selected.size >= 25)
                          }
                          onChange={() =>
                            setSelected((old) => {
                              const next = new Set(old)
                              if (next.has(i)) next.delete(i)
                              else next.add(i)
                              return next
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{c.name}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-800">{formatItemLabel(c.itemType)}</div>
                        <div className="text-[11px] text-slate-500">{c.period}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums font-medium text-slate-800">
                        {c.obligation
                          ? `Rp${c.obligation.amount_expected.toLocaleString('id-ID')}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-slate-800">
                          {OUTCOME_LABELS[c.outcome] ?? c.outcome}
                        </span>
                        {c.reason && <p className="mt-0.5 text-slate-500">{c.reason}</p>}
                        {c.outcome === 'REVIEW' &&
                          monitor?.canVerifyHistorical &&
                          (c.itemType === 'UANG_MAKAN' || c.itemType === 'UANG_NYUCI') && (
                            <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                              <summary className="cursor-pointer font-semibold text-slate-700">
                                Catat hasil verifikasi penyedia periode ini
                              </summary>
                              <form
                                className="mt-2.5 space-y-2"
                                onSubmit={async (e) => {
                                  e.preventDefault()
                                  const form = new FormData(e.currentTarget)
                                  setPending(true)
                                  setMessage('')
                                  try {
                                    await verifyHistoricalBillingProviderAction({
                                      santriId: c.santriId,
                                      itemType: c.itemType as 'UANG_MAKAN' | 'UANG_NYUCI',
                                      period: c.period,
                                      providerId: String(form.get('provider') ?? ''),
                                      note: String(form.get('note') ?? ''),
                                    })
                                    await load(currentCursor)
                                  } catch (error) {
                                    setMessage(
                                      error instanceof Error ? error.message : 'Verifikasi gagal disimpan.'
                                    )
                                    setPending(false)
                                  }
                                }}
                              >
                                <select
                                  name="provider"
                                  required
                                  aria-label="Penyedia layanan historis terverifikasi"
                                  className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"
                                >
                                  <option value="">Pilih penyedia berdasarkan bukti</option>
                                  {monitor.providers
                                    .filter((p) => p.jenis === (c.itemType === 'UANG_MAKAN' ? 'Makan' : 'Cuci'))
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.nama_jasa}
                                      </option>
                                    ))}
                                </select>
                                <textarea
                                  name="note"
                                  required
                                  minLength={10}
                                  maxLength={1000}
                                  aria-label="Referensi bukti keanggotaan historis"
                                  placeholder="Referensi dokumen/rekaman keanggotaan yang sudah diperiksa"
                                  className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"
                                />
                                <button
                                  type="submit"
                                  disabled={pending}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                                >
                                  Simpan verifikasi &amp; muat ulang
                                </button>
                              </form>
                            </details>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canApply && (
                <button
                  type="button"
                  disabled={pending || !selected.size}
                  onClick={apply}
                  className="inline-flex min-h-[38px] items-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Lengkapi {selected.size} kandidat terpilih
                </button>
              )}
              {preview.nextCursor && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => load(preview.nextCursor!)}
                  className="inline-flex min-h-[38px] items-center rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Santri berikutnya
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  )
}
