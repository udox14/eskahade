'use client'

// Rekonsiliasi Mutasi Kas Bank ↔ Tunai: hubungkan uang yang diambil/disetor petugas loket
// dengan baris debit/kredit rekening koran, dan tampilkan mutasi keluar yang belum dijelaskan.

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ExternalLink } from 'lucide-react'
import { formatFinanceDate } from '@/lib/finance/date-format'
import { getCashTransferReconciliationAction, linkCashTransferAction } from './cash-transfer-actions'

type Data = Awaited<ReturnType<typeof getCashTransferReconciliationAction>>

const rp = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`

export default function CashTransferPanel({ canMutate }: { canMutate: boolean }) {
  const [data, setData] = useState<Data | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')

  async function refresh() {
    try {
      setData(await getCashTransferReconciliationAction())
    } catch {
      setMessage({
        tone: 'error',
        text: 'Data mutasi kas belum dapat dimuat. Coba segarkan halaman.',
      })
    }
  }

  useEffect(() => {
    let active = true
    getCashTransferReconciliationAction()
      .then((result) => {
        if (active) setData(result)
      })
      .catch(() => {
        if (active) {
          setMessage({
            tone: 'error',
            text: 'Data mutasi kas belum dapat dimuat. Coba segarkan halaman.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [])

  async function link(transferId: string) {
    setBusy(transferId)
    setMessage(null)
    const res = await linkCashTransferAction({
      cashTransferId: transferId,
      statementTransactionId: choice[transferId] || '',
      notes: notes[transferId] || '',
    })
    setBusy('')
    if (!res.success) {
      setMessage({ tone: 'error', text: res.error })
      return
    }
    setMessage({ tone: 'success', text: 'Mutasi kas berhasil dicocokkan dengan rekening koran.' })
    await refresh()
  }

  const pendingCount = data?.pending.length ?? 0
  const unexplainedCount = data?.unexplainedDebits.length ?? 0
  const allBalanced = data !== null && pendingCount === 0 && unexplainedCount === 0

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Mutasi Kas Bank &harr; Tunai</h3>
            {allBalanced && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Seimbang
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 text-pretty">
            Penarikan dana dari rekening Koperasi ke laci loket (debit) atau penyetoran tunai kembali ke rekening (kredit). Bukan pembayaran wali dan bukan pendapatan.
          </p>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium ${
            message.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {message.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tampilan Ringkas saat Semua Seimbang */}
      {allBalanced ? (
        <p className="text-xs text-slate-600">
          Tidak ada mutasi kas yang menunggu pencocokan dan tidak ada mutasi keluar (debit) bank yang belum dijelaskan.
        </p>
      ) : (
        <>
          {/* Daftar Menunggu Dicocokkan */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800">
              Menunggu dicocokkan ({pendingCount})
            </h4>
            {pendingCount === 0 ? (
              <p className="text-xs text-slate-500">Tidak ada mutasi kas yang menunggu.</p>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3.5 py-2.5">Mutasi Kas</th>
                      <th className="px-3.5 py-2.5 text-right">Nominal</th>
                      <th className="px-3.5 py-2.5">Baris Rekening Koran</th>
                      <th className="px-3.5 py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.pending.map(({ transfer: t, candidates }) => (
                      <tr key={t.id} className="align-top">
                        <td className="px-3.5 py-3">
                          <div className="font-semibold text-slate-900">
                            {t.direction === 'BANK_TO_CASH' ? 'Ambil dari rekening' : 'Setor ke rekening'}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            <span className="font-mono">{t.transfer_number}</span> · sesi {t.session_code}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                            {t.handled_by_name} · {formatFinanceDate(t.bank_transacted_at, true)}
                            {t.bank_reference ? ` · ref ${t.bank_reference}` : ''}
                          </div>
                          <a
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                            href={`/api/finance/cash-transfer-proofs/${encodeURIComponent(t.id)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span>Lihat bukti</span>
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        </td>
                        <td className="px-3.5 py-3 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                          {rp(t.amount)}
                        </td>
                        <td className="px-3.5 py-3 min-w-[240px]">
                          {candidates.length === 0 ? (
                            <span className="text-slate-500">
                              Belum ada baris {t.direction === 'BANK_TO_CASH' ? 'debit' : 'kredit'} bernominal sama. Impor mutasi rekening terbaru.
                            </span>
                          ) : canMutate ? (
                            <div className="space-y-2">
                              <select
                                className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"
                                value={choice[t.id] || ''}
                                onChange={(e) => setChoice((c) => ({ ...c, [t.id]: e.target.value }))}
                              >
                                <option value="">
                                  Pilih baris {t.direction === 'BANK_TO_CASH' ? 'debit' : 'kredit'}…
                                </option>
                                {candidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {formatFinanceDate(c.date, false)} · {rp(c.amount)} ·{' '}
                                    {c.reference || c.remark || 'tanpa ref'}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"
                                placeholder="Catatan pemeriksaan (min. 10 karakter)"
                                value={notes[t.id] || ''}
                                onChange={(e) => setNotes((n) => ({ ...n, [t.id]: e.target.value }))}
                              />
                            </div>
                          ) : (
                            <span className="font-medium text-slate-700">{candidates.length} kandidat</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-right whitespace-nowrap">
                          {canMutate && candidates.length > 0 && (
                            <button
                              type="button"
                              className="inline-flex min-h-[36px] items-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                              disabled={
                                busy === t.id || !choice[t.id] || (notes[t.id] || '').trim().length < 10
                              }
                              onClick={() => link(t.id)}
                            >
                              {busy === t.id ? 'Menyimpan…' : 'Cocokkan'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mutasi Keluar Belum Dijelaskan */}
          {unexplainedCount > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Mutasi keluar (debit) belum dijelaskan ({unexplainedCount})
                </h4>
                <p className="mt-0.5 text-xs text-slate-500 text-pretty">
                  Dapat berupa penarikan tunai yang belum dicatat di Loket Kasir &rarr; Kas Bank, penyaluran transfer, atau biaya bank.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3.5 py-2.5">Tanggal</th>
                      <th className="px-3.5 py-2.5 text-right">Nominal</th>
                      <th className="px-3.5 py-2.5">Referensi</th>
                      <th className="px-3.5 py-2.5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.unexplainedDebits.map((d) => (
                      <tr key={d.id}>
                        <td className="px-3.5 py-2.5 whitespace-nowrap tabular-nums">
                          {formatFinanceDate(d.date, false)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                          {rp(d.amount)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px]">{d.reference || '—'}</td>
                        <td className="px-3.5 py-2.5 text-slate-500">{d.remark || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!!data?.recentMatched.length && (
        <details className="group border-t border-slate-100 pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 [&::-webkit-details-marker]:hidden">
            <span>Sudah dicocokkan ({data.recentMatched.length} terakhir)</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="mt-2.5 divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
            {data.recentMatched.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                <div>
                  <span className="font-mono font-semibold text-slate-800">{t.transfer_number}</span>
                  <span className="text-slate-600">
                    {' '}· {t.direction === 'BANK_TO_CASH' ? 'Ambil' : 'Setor'} <strong>{rp(t.amount)}</strong>
                  </span>
                  {t.match_notes && <span className="block text-[11px] text-slate-500">{t.match_notes}</span>}
                </div>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {t.matched_at ? formatFinanceDate(t.matched_at, true) : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
