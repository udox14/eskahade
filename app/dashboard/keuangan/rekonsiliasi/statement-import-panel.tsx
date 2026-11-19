'use client'

import { useState } from 'react'
import { confirmStatementImportAction, previewStatementImportAction } from './import-actions'
import type { StatementImportPreview } from '@/lib/finance/statement-import'
import type { StatementColumnMapping, StatementDateOrder } from '@/lib/finance/statement-csv'

type Mapping = Partial<StatementColumnMapping>
const NONE = ''

const FIELDS: Array<{ key: keyof StatementColumnMapping; label: string; hint?: string }> = [
  { key: 'date', label: 'Tanggal' },
  { key: 'time', label: 'Jam (jika terpisah)' },
  { key: 'description', label: 'Keterangan' },
  { key: 'credit', label: 'Kredit (uang masuk)', hint: 'Mode dua kolom' },
  { key: 'debit', label: 'Debit (uang keluar)', hint: 'Mode dua kolom' },
  { key: 'amount', label: 'Nominal', hint: 'Mode satu kolom' },
  { key: 'type', label: 'Tipe (CR/DB)', hint: 'Untuk mode satu kolom' },
  { key: 'balanceBefore', label: 'Saldo awal', hint: 'Untuk verifikasi otomatis' },
  { key: 'balance', label: 'Saldo akhir' },
  { key: 'reference', label: 'No. referensi' },
]

const rp = (n: number) => `Rp${n.toLocaleString('id-ID')}`

export default function StatementImportPanel({ onImported }: { onImported: () => void }) {
  const [csvText, setCsvText] = useState('')
  const [filename, setFilename] = useState('')
  const [dateOrder, setDateOrder] = useState<StatementDateOrder>('DMY')
  const [mapping, setMapping] = useState<Mapping>({})
  const [headerRowIndex, setHeaderRowIndex] = useState<number | undefined>(undefined)
  const [preview, setPreview] = useState<StatementImportPreview | null>(null)
  const [expectedCount, setExpectedCount] = useState('')
  const [expectedTotal, setExpectedTotal] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  type PreviewArgs = { mapping: Mapping; headerRowIndex: number | undefined; dateOrder: StatementDateOrder; text: string; name: string }

  async function runPreview(overrides: Partial<PreviewArgs> = {}, fresh = false) {
    const args: PreviewArgs = { mapping, headerRowIndex, dateOrder, text: csvText, name: filename, ...overrides }
    setBusy(true)
    setMessage('')
    try {
      const p = await previewStatementImportAction({
        csvText: args.text,
        filename: args.name,
        mapping: Object.keys(args.mapping).length ? (args.mapping as StatementColumnMapping) : undefined,
        headerRowIndex: args.headerRowIndex,
        dateOrder: args.dateOrder,
      })
      setPreview(p)
      if (fresh) {
        setMapping(p.mapping)
        setHeaderRowIndex(p.headerRowIndex)
      }
    } catch (e) {
      setPreview(null)
      setMessage(e instanceof Error ? e.message : 'Pratinjau gagal.')
    } finally {
      setBusy(false)
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    if (file.size > 900_000) {
      setMessage('Berkas terlalu besar (maks ±900 KB). Unduh mutasi per bulan.')
      return
    }
    const text = await file.text()
    setCsvText(text)
    setFilename(file.name)
    setExpectedCount('')
    setExpectedTotal('')
    await runPreview({ text, name: file.name, mapping: {}, headerRowIndex: undefined }, true)
  }

  function setField(key: keyof StatementColumnMapping, value: string) {
    const next: Mapping = { ...mapping }
    if (value === NONE) delete next[key]
    else next[key] = Number(value)
    setMapping(next)
    void runPreview({ mapping: next })
  }

  const canConfirm =
    preview?.ok &&
    (preview.balanceVerified ||
      (expectedCount.trim() !== '' &&
        expectedTotal.trim() !== '' &&
        Number(expectedCount) === preview.creditCount &&
        Number(expectedTotal) === preview.creditTotal))

  async function confirm() {
    if (!preview) return
    setBusy(true)
    setMessage('')
    try {
      const r = await confirmStatementImportAction({
        csvText,
        filename,
        mapping: mapping as StatementColumnMapping,
        headerRowIndex,
        dateOrder,
        expectedCreditCount: preview.balanceVerified ? undefined : Number(expectedCount),
        expectedCreditTotal: preview.balanceVerified ? undefined : Number(expectedTotal),
      })
      setMessage(`Mutasi diimpor: ${r.newTransactionsCount} baris baru, ${r.dedupedCount} sudah pernah diimpor.`)
      setCsvText('')
      setFilename('')
      setPreview(null)
      setMapping({})
      onImported()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Impor gagal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <h4 className="font-semibold text-slate-800">Impor Mutasi dari Internet Banking (CSV)</h4>
        <p className="text-slate-600">
          Unduh mutasi rekening collection dari internet banking, lalu unggah di sini. Berkas yang tumpang-tindih aman diimpor ulang.
          Impor hanya menyediakan bukti bank; pembayaran tetap <strong>Menunggu Rekonsiliasi</strong> sampai Anda memeriksa dan menyelesaikannya.
        </p>
      </div>

      <input type="file" accept=".csv,text/csv,text/plain" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
      {message && <p role="status" className="text-amber-800">{message}</p>}

      {preview && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block">
              Baris judul kolom
              <select
                className="block w-full rounded border p-2"
                value={headerRowIndex ?? -1}
                onChange={(e) => { const v = Number(e.target.value); setHeaderRowIndex(v); void runPreview({ headerRowIndex: v }) }}
              >
                <option value={-1}>Tanpa judul</option>
                {preview.sampleRows.slice(0, 6).map((r, i) => (
                  <option key={i} value={i}>Baris {i + 1}: {r.slice(0, 3).join(' | ')}</option>
                ))}
              </select>
            </label>
            <label className="block">
              Format tanggal
              <select
                className="block w-full rounded border p-2"
                value={dateOrder}
                onChange={(e) => { const v = e.target.value as StatementDateOrder; setDateOrder(v); void runPreview({ dateOrder: v }) }}
              >
                <option value="DMY">Hari/Bulan/Tahun (19/11/2026)</option>
                <option value="MDY">Bulan/Hari/Tahun (11/19/2026)</option>
              </select>
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                {f.label}{f.hint ? <span className="text-slate-400"> · {f.hint}</span> : null}
                <select
                  className="block w-full rounded border p-2"
                  value={mapping[f.key] === undefined ? NONE : String(mapping[f.key])}
                  onChange={(e) => setField(f.key, e.target.value)}
                >
                  <option value={NONE}>— tidak dipakai —</option>
                  {Array.from({ length: preview.columnCount }, (_, i) => (
                    <option key={i} value={i}>
                      Kolom {i + 1}{preview.headers[i] ? `: ${preview.headers[i]}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {preview.errors.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-red-700">
              {preview.errors.map((er, i) => (
                <li key={i}>{er.row > 0 ? `Baris ${er.row}: ` : ''}{er.message}</li>
              ))}
            </ul>
          )}

          {preview.ok && (
            <>
              <div className="rounded border bg-white p-3">
                <p>
                  Rekening {preview.accountNoMasked} · {preview.fromDate} s/d {preview.toDate} ·{' '}
                  <strong>{preview.creditCount}</strong> kredit ({rp(preview.creditTotal)}) · {preview.debitCount} debit ({rp(preview.debitTotal)})
                  {preview.ignoredRows > 0 ? ` · ${preview.ignoredRows} baris pembatas diabaikan` : ''}
                  {preview.alreadyImportedCount > 0 ? ` · ${preview.alreadyImportedCount} baris sudah pernah diimpor` : ''}
                </p>
                <table className="mt-2 w-full text-left">
                  <thead><tr><th>Baris</th><th>Tanggal</th><th>Tipe</th><th>Nominal</th><th>Keterangan</th></tr></thead>
                  <tbody>
                    {preview.preview.map((l) => (
                      <tr key={l.row} className="border-t">
                        <td>{l.row}</td><td>{l.date.slice(0, 16).replace('T', ' ')}</td>
                        <td>{l.type === 'CREDIT' ? 'Kredit' : 'Debit'}</td><td>{rp(l.amount)}</td><td className="max-w-xs truncate">{l.remark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.balanceVerified ? (
                <div className="rounded border border-emerald-300 bg-emerald-50 p-3">
                  <p className="mb-2">
                    Keutuhan berkas terverifikasi otomatis: setiap baris dan antar-baris cocok dengan kolom saldo awal/akhir (tidak ada baris hilang atau ganda).
                  </p>
                  <button className="rounded border bg-white p-2 disabled:opacity-50" disabled={busy || !canConfirm} onClick={confirm}>
                    Impor Mutasi
                  </button>
                </div>
              ) : (
                <div className="rounded border border-amber-300 bg-amber-50 p-3">
                  <p className="mb-2">
                    Berkas tidak memiliki kolom saldo awal/akhir untuk verifikasi otomatis. Pemeriksaan keutuhan: ketik <strong>jumlah mutasi kredit</strong> dan{' '}
                    <strong>total kredit</strong> persis seperti tampil di internet banking untuk rentang yang sama. Jika tidak cocok, impor tidak dapat dilanjutkan.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label>Jumlah kredit
                      <input className="block rounded border p-2" inputMode="numeric" value={expectedCount} onChange={(e) => setExpectedCount(e.target.value.replace(/\D/g, ''))} />
                    </label>
                    <label>Total kredit (Rp)
                      <input className="block rounded border p-2" inputMode="numeric" value={expectedTotal} onChange={(e) => setExpectedTotal(e.target.value.replace(/\D/g, ''))} />
                    </label>
                    <button className="rounded border bg-white p-2 disabled:opacity-50" disabled={busy || !canConfirm} onClick={confirm}>
                      Impor Mutasi
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
