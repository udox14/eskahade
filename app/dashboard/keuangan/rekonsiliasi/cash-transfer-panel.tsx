'use client'

// Rekonsiliasi Mutasi Kas Bank ↔ Tunai: hubungkan uang yang diambil/disetor petugas loket
// dengan baris debit/kredit rekening koran, dan tampilkan mutasi keluar yang belum dijelaskan.

import { useEffect, useState } from 'react'
import { getCashTransferReconciliationAction, linkCashTransferAction } from './cash-transfer-actions'

type Data = Awaited<ReturnType<typeof getCashTransferReconciliationAction>>

const rp = (n: number) => 'Rp' + Math.round(n || 0).toLocaleString('id-ID')
const wib = (iso: string) => {
  try { return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return iso }
}

export default function CashTransferPanel({ canMutate }: { canMutate: boolean }) {
  const [data, setData] = useState<Data | null>(null)
  const [message, setMessage] = useState('')
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')

  async function refresh() {
    try { setData(await getCashTransferReconciliationAction()) }
    catch { setMessage('Data mutasi kas belum dapat dimuat. Pastikan migrasi 0200 sudah diterapkan.') }
  }
  useEffect(() => {
    let active = true
    getCashTransferReconciliationAction()
      .then(result => { if (active) setData(result) })
      .catch(() => { if (active) setMessage('Data mutasi kas belum dapat dimuat. Pastikan migrasi 0200 sudah diterapkan.') })
    return () => { active = false }
  }, [])

  async function link(transferId: string) {
    setBusy(transferId); setMessage('')
    const res = await linkCashTransferAction({ cashTransferId: transferId, statementTransactionId: choice[transferId] || '', notes: notes[transferId] || '' })
    setBusy('')
    if (!res.success) { setMessage(res.error); return }
    setMessage('Mutasi kas dicocokkan dengan rekening koran.')
    await refresh()
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 text-xs">
      <div>
        <h3 className="font-semibold text-slate-800">Mutasi Kas Bank ↔ Tunai</h3>
        <p className="text-slate-600">Uang yang diambil petugas dari rekening Koperasi untuk laci loket (debit di rekening koran), atau disetor kembali (kredit). Bukan pembayaran wali dan bukan pendapatan.</p>
      </div>
      {message && <p role="status" className="text-amber-800">{message}</p>}

      <div>
        <h4 className="font-semibold text-slate-700 mb-2">Menunggu dicocokkan ({data?.pending.length ?? 0})</h4>
        {!data?.pending.length ? <p className="text-slate-500">Tidak ada mutasi kas yang menunggu.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left">
            <thead><tr><th className="p-2">Mutasi kas</th><th>Nominal</th><th>Baris rekening koran</th><th /></tr></thead>
            <tbody>
              {data.pending.map(({ transfer: t, candidates }) => (
                <tr key={t.id} className="border-t align-top">
                  <td className="p-2">
                    <b>{t.direction === 'BANK_TO_CASH' ? 'Ambil dari rekening' : 'Setor ke rekening'}</b><br />
                    {t.transfer_number} · sesi {t.session_code}<br />
                    {t.handled_by_name} · {wib(t.bank_transacted_at)}{t.bank_reference ? ` · ref ${t.bank_reference}` : ''}<br />
                    <a className="text-sky-700 underline" href={`/api/finance/cash-transfer-proofs/${encodeURIComponent(t.id)}`} target="_blank" rel="noreferrer">Lihat bukti</a>
                  </td>
                  <td className="p-2 font-mono">{rp(t.amount)}</td>
                  <td className="p-2">
                    {candidates.length === 0 ? (
                      <span className="text-slate-500">Belum ada baris {t.direction === 'BANK_TO_CASH' ? 'debit' : 'kredit'} bernominal sama. Impor mutasi rekening terbaru.</span>
                    ) : canMutate ? (
                      <div className="space-y-1">
                        <select className="block border rounded p-1.5 w-full" value={choice[t.id] || ''} onChange={e => setChoice(c => ({ ...c, [t.id]: e.target.value }))}>
                          <option value="">Pilih baris {t.direction === 'BANK_TO_CASH' ? 'debit' : 'kredit'}…</option>
                          {candidates.map(c => <option key={c.id} value={c.id}>{c.date} · {rp(c.amount)} · {c.reference || c.remark || 'tanpa ref'}</option>)}
                        </select>
                        <input className="block border rounded p-1.5 w-full" placeholder="Catatan pemeriksaan (min. 10 huruf)" value={notes[t.id] || ''} onChange={e => setNotes(n => ({ ...n, [t.id]: e.target.value }))} />
                      </div>
                    ) : <span>{candidates.length} kandidat</span>}
                  </td>
                  <td className="p-2">
                    {canMutate && candidates.length > 0 && (
                      <button className="border rounded p-2 disabled:opacity-50" disabled={busy === t.id || !choice[t.id] || (notes[t.id] || '').trim().length < 10} onClick={() => link(t.id)}>Cocokkan</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-slate-700 mb-1">Mutasi keluar (debit) yang belum dijelaskan sebagai mutasi kas</h4>
        <p className="text-slate-500 mb-2">Bisa berupa penarikan tunai yang belum dicatat di Loket, penyaluran via transfer, atau biaya bank. Penarikan tunai harus dicatat petugas di Loket Kasir → Kas Bank.</p>
        {!data?.unexplainedDebits.length ? <p className="text-slate-500">Tidak ada.</p> : (
          <table className="w-full text-left"><tbody>
            {data.unexplainedDebits.map(d => (
              <tr key={d.id} className="border-t"><td className="p-2">{d.date}</td><td className="p-2 font-mono">{rp(d.amount)}</td><td className="p-2">{d.reference || '—'}</td><td className="p-2 text-slate-500">{d.remark || ''}</td></tr>
            ))}
          </tbody></table>
        )}
      </div>

      {!!data?.recentMatched.length && (
        <details>
          <summary className="cursor-pointer font-semibold text-slate-700">Sudah dicocokkan (20 terakhir)</summary>
          <ul className="mt-2 space-y-1">
            {data.recentMatched.map(t => (
              <li key={t.id}>{t.transfer_number} · {t.direction === 'BANK_TO_CASH' ? 'ambil' : 'setor'} {rp(t.amount)} · {t.matched_at ? wib(t.matched_at) : ''} · {t.match_notes}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
