'use client'

import { useId, useState } from 'react'
import { CheckCircle2, FileSpreadsheet, Upload, AlertCircle } from 'lucide-react'
import { confirmStatementImportAction, previewStatementImportAction } from './import-actions'
import type { StatementImportPreview } from '@/lib/finance/statement-import'
import type { StatementColumnMapping, StatementDateOrder } from '@/lib/finance/statement-csv'
import { formatFinanceDate } from '@/lib/finance/date-format'

type Mapping = Partial<StatementColumnMapping>
const NONE = ''

const FIELDS: Array<{ key: keyof StatementColumnMapping; label: string; hint?: string }> = [
  { key: 'date', label: 'Tanggal' },
  { key: 'time', label: 'Jam (jika terpisah)' },
  { key: 'description', label: 'Keterangan' },
  { key: 'credit', label: 'Kredit (uang masuk)', hint: 'Mode dua kolom' },
  { key: 'debit', label: 'Debit (uang keluar)', hint: 'Mode dua kolom' },
  { key: 'amount', label: 'Nominal', hint: 'Mode satu kolom' },
  { key: 'type', label: 'Tipe (CR/DB)', hint: 'Mode satu kolom' },
  { key: 'balanceBefore', label: 'Saldo awal', hint: 'Verifikasi otomatis' },
  { key: 'balance', label: 'Saldo akhir' },
  { key: 'reference', label: 'No. referensi' },
]

const rp = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`

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
  const [message, setMessage] = useState<{ tone: 'info' | 'success' | 'error'; text: string } | null>(null)

  const fileInputId = useId()

  type PreviewArgs = {
    mapping: Mapping
    headerRowIndex: number | undefined
    dateOrder: StatementDateOrder
    text: string
    name: string
  }

  async function runPreview(overrides: Partial<PreviewArgs> = {}, fresh = false) {
    const args: PreviewArgs = {
      mapping,
      headerRowIndex,
      dateOrder,
      text: csvText,
      name: filename,
      ...overrides,
    }
    setBusy(true)
    setMessage(null)
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
      setMessage({
        tone: 'error',
        text: e instanceof Error ? e.message : 'Pratinjau berkas CSV belum dapat dimuat.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    if (file.size > 900_000) {
      setMessage({
        tone: 'error',
        text: 'Ukuran berkas terlalu besar (maks. 900 KB). Unduh mutasi per bulan dari internet banking.',
      })
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
    setMessage(null)
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
      setMessage({
        tone: 'success',
        text: `Mutasi berhasil diimpor: ${r.newTransactionsCount} baris baru, ${r.dedupedCount} baris sudah pernah tercatat.`,
      })
      setCsvText('')
      setFilename('')
      setPreview(null)
      setMapping({})
      onImported()
    } catch (e) {
      setMessage({
        tone: 'error',
        text: e instanceof Error ? e.message : 'Impor mutasi belum berhasil diproses.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-slate-900">
            Impor Mutasi dari Internet Banking (CSV)
          </h4>
          <p className="mt-0.5 text-xs text-slate-600 text-pretty">
            Unggah mutasi rekening penampungan Koperasi dalam format CSV. Berkas dengan rentang tanggal tumpang-tindih aman diimpor ulang tanpa duplikasi.
          </p>
        </div>

        <label
          htmlFor={fileInputId}
          className={`inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50 transition-colors cursor-pointer ${
            busy ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{busy ? 'Membaca berkas…' : filename ? 'Ganti Berkas CSV' : 'Pilih Berkas CSV'}</span>
          <input
            id={fileInputId}
            type="file"
            accept=".csv,text/csv,text/plain"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="sr-only"
          />
        </label>
      </div>

      {filename && (
        <div className="inline-flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700">
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
          <span>{filename}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium ${
            message.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : message.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-amber-200 bg-amber-50 text-amber-900'
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

      {preview && (
        <div className="space-y-4 border-t border-slate-200/80 pt-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs">
              <span className="font-semibold text-slate-700">Baris judul kolom</span>
              <select
                className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"
                value={headerRowIndex ?? -1}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setHeaderRowIndex(v)
                  void runPreview({ headerRowIndex: v })
                }}
              >
                <option value={-1}>Tanpa judul</option>
                {preview.sampleRows.slice(0, 6).map((r, i) => (
                  <option key={i} value={i}>
                    Baris {i + 1}: {r.slice(0, 3).join(' | ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs">
              <span className="font-semibold text-slate-700">Format tanggal</span>
              <select
                className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"
                value={dateOrder}
                onChange={(e) => {
                  const v = e.target.value as StatementDateOrder
                  setDateOrder(v)
                  void runPreview({ dateOrder: v })
                }}
              >
                <option value="DMY">Hari/Bulan/Tahun (19/11/2026)</option>
                <option value="MDY">Bulan/Hari/Tahun (11/19/2026)</option>
              </select>
            </label>
          </div>

          <details className="rounded-lg border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">
              Sesuaikan pemetaan kolom CSV (opsional — otomatis terdeteksi)
            </summary>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((f) => (
                <label key={f.key} className="block space-y-1 text-xs">
                  <span className="font-medium text-slate-700">
                    {f.label}
                    {f.hint ? <span className="text-slate-400"> · {f.hint}</span> : null}
                  </span>
                  <select
                    className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                    value={mapping[f.key] === undefined ? NONE : String(mapping[f.key])}
                    onChange={(e) => setField(f.key, e.target.value)}
                  >
                    <option value={NONE}>— tidak dipakai —</option>
                    {Array.from({ length: preview.columnCount }, (_, i) => (
                      <option key={i} value={i}>
                        Kolom {i + 1}
                        {preview.headers[i] ? `: ${preview.headers[i]}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>

          {preview.errors.length > 0 && (
            <ul className="list-disc space-y-1 rounded-lg border border-rose-200 bg-rose-50 px-5 py-3 text-xs text-rose-800">
              {preview.errors.map((er, i) => (
                <li key={i}>
                  {er.row > 0 ? `Baris ${er.row}: ` : ''}
                  {er.message}
                </li>
              ))}
            </ul>
          )}

          {preview.ok && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-700 tabular-nums">
                  Rekening <strong>{preview.accountNoMasked}</strong> · {preview.fromDate} s/d {preview.toDate} ·{' '}
                  <strong>{preview.creditCount}</strong> kredit ({rp(preview.creditTotal)}) ·{' '}
                  {preview.debitCount} debit ({rp(preview.debitTotal)})
                  {preview.ignoredRows > 0 ? ` · ${preview.ignoredRows} baris pembatas diabaikan` : ''}
                  {preview.alreadyImportedCount > 0
                    ? ` · ${preview.alreadyImportedCount} baris sudah pernah diimpor`
                    : ''}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Baris</th>
                        <th className="px-3 py-2">Tanggal</th>
                        <th className="px-3 py-2">Tipe</th>
                        <th className="px-3 py-2 text-right">Nominal</th>
                        <th className="px-3 py-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.preview.map((l) => (
                        <tr key={l.row}>
                          <td className="px-3 py-2 tabular-nums text-slate-500">{l.row}</td>
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                            {formatFinanceDate(l.date, true)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium">
                            {l.type === 'CREDIT' ? 'Kredit' : 'Debit'}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-slate-900 tabular-nums">
                            {rp(l.amount)}
                          </td>
                          <td className="px-3 py-2 max-w-xs truncate text-slate-500">{l.remark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {preview.balanceVerified ? (
                <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-emerald-950 text-pretty">
                    <strong>Keutuhan berkas terverifikasi otomatis:</strong> setiap baris cocok dengan saldo awal/akhir tanpa baris hilang atau ganda.
                  </p>
                  <button
                    type="button"
                    className="inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                    disabled={busy || !canConfirm}
                    onClick={confirm}
                  >
                    {busy ? 'Mengimpor…' : 'Impor Mutasi'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                  <p className="text-xs text-amber-950 text-pretty">
                    Berkas tidak memiliki kolom saldo untuk verifikasi otomatis. Ketik ulang{' '}
                    <strong>jumlah mutasi kredit</strong> dan <strong>total nominal kredit</strong> persis seperti di internet banking untuk memastikan berkas utuh.
                  </p>
                  <div className="flex flex-wrap items-end gap-2.5">
                    <label className="space-y-1 text-xs">
                      <span className="block font-semibold text-slate-700">Jumlah kredit</span>
                      <input
                        className="block w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold tabular-nums text-slate-900"
                        inputMode="numeric"
                        value={expectedCount}
                        onChange={(e) => setExpectedCount(e.target.value.replace(/\D/g, ''))}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="block font-semibold text-slate-700">Total kredit (Rp)</span>
                      <input
                        className="block w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold tabular-nums text-slate-900"
                        inputMode="numeric"
                        value={expectedTotal}
                        onChange={(e) => setExpectedTotal(e.target.value.replace(/\D/g, ''))}
                      />
                    </label>
                    <button
                      type="button"
                      className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                      disabled={busy || !canConfirm}
                      onClick={confirm}
                    >
                      {busy ? 'Mengimpor…' : 'Impor Mutasi'}
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
