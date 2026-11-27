'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, RefreshCw, X } from 'lucide-react'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import { formatFinanceDate } from '@/lib/finance/date-format'
import {
  getBriReconciliationWorkbench,
  resolveBriStatementAction,
  syncBriStatementAction,
} from './bri-actions'
import StatementImportPanel from './statement-import-panel'

const CLASSIFICATION_INFO: Record<string, { label: string; className: string }> = {
  EXACT_MATCH: {
    label: 'Kandidat cocok — perlu cek',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  AMBIGUOUS: {
    label: 'Beberapa kandidat',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  NO_MATCH: {
    label: 'Belum ditemukan',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  AMOUNT_MISMATCH: {
    label: 'Nominal berbeda',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  ALREADY_SETTLED: {
    label: 'Sudah direkonsiliasi',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  IGNORED_DEBIT: {
    label: 'Mutasi keluar',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  PENDING_VERIFICATION: {
    label: 'Menunggu verifikasi transfer',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  CASH_DEPOSIT: {
    label: 'Kemungkinan setoran loket',
    className: 'bg-sky-50 text-sky-800 border-sky-200',
  },
}

function formatRupiah(n: number): string {
  return `Rp${Math.round(n || 0).toLocaleString('id-ID')}`
}

export default function BriWorkbench({ canMutate }: { canMutate: boolean }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getBriReconciliationWorkbench>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ tone: 'info' | 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState('')
  const [target, setTarget] = useState('')
  const [notes, setNotes] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [confirm, setConfirm] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      setData(await getBriReconciliationWorkbench())
    } catch {
      setMessage({
        tone: 'error',
        text: 'Data pencocokan rekening koran belum dapat dimuat. Coba segarkan halaman.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const targetOptions = useMemo<SelectPickerOption[]>(() => {
    const base: SelectPickerOption[] = [
      { value: '', label: 'Belum dapat dialokasikan — buka kasus rekonsiliasi' },
    ]
    if (data?.targets) {
      for (const t of data.targets) {
        base.push({ value: t.id, label: t.label })
      }
    }
    return base
  }, [data?.targets])

  const selectedStatement = data?.statements.find((st) => st.id === selected) ?? null

  async function resolve() {
    setBusy(true)
    setMessage(null)
    try {
      const choice = data?.targets.find((t) => t.id === target)
      const result = (await resolveBriStatementAction({
        statementId: selected,
        targetId: choice?.id,
        kind: choice?.kind || 'UNALLOCATED',
        notes,
      })) as { blocked?: string } | undefined

      if (result && typeof result === 'object' && 'blocked' in result && result.blocked) {
        setConfirm(false)
        setMessage({ tone: 'error', text: result.blocked })
        return
      }
      setConfirm(false)
      setSelected('')
      setTarget('')
      setNotes('')
      setMessage({ tone: 'success', text: 'Hasil pemeriksaan berhasil dicatat.' })
      await refresh()
    } catch {
      setMessage({
        tone: 'error',
        text: 'Pemeriksaan belum dapat diselesaikan. Pastikan identitas, nominal, periode, dan bukti bank sesuai.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleSyncStatement() {
    if (!fromDate || !toDate) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await syncBriStatementAction({
        fromDateTime: `${fromDate}T00:00:00+07:00`,
        toDateTime: `${toDate}T23:59:59+07:00`,
      })
      setMessage({
        tone: result.cursorAdvanced ? 'success' : 'info',
        text: result.cursorAdvanced
          ? 'Mutasi bank berhasil dimuat.'
          : 'Mutasi memerlukan pemeriksaan lanjutan sebelum melanjutkan sinkronisasi.',
      })
      await refresh()
    } catch {
      setMessage({
        tone: 'error',
        text: 'Sinkronisasi bank belum dapat dilakukan saat ini. Gunakan impor CSV sementara.',
      })
    } finally {
      setBusy(false)
    }
  }

  const trimmedNotesLen = notes.trim().length

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Rekonsiliasi Rekening Koran (BRIVA &amp; Transfer Manual)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 text-pretty">
            Pembayaran yang diterima tetap menunggu rekonsiliasi. Kesamaan nominal hanya menjadi kandidat—petugas perlu memeriksa identitas dan bukti bank sebelum menyetujui.
          </p>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
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

      {canMutate && <StatementImportPanel onImported={() => void refresh()} />}

      {/* Sinkronisasi API Bank: hanya tampilkan pemilih tanggal jika integrasi aktif */}
      {canMutate && data && (
        data.syncEnabled ? (
          <div className="flex flex-wrap items-end gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs">
            <label className="space-y-1">
              <span className="block font-semibold text-slate-700">Dari tanggal</span>
              <input
                type="date"
                className="block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="block font-semibold text-slate-700">Sampai tanggal</span>
              <input
                type="date"
                className="block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
              disabled={busy || !fromDate || !toDate}
              onClick={handleSyncStatement}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Ambil Mutasi Bank</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3.5 py-2 text-xs text-slate-600">
            <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Tarik mutasi otomatis dari BRIAPI belum diaktifkan. Gunakan <strong>Impor Mutasi CSV</strong> di atas untuk memasukkan rekening koran.
            </span>
          </div>
        )
      )}

      {/* Daftar Kredit Rekening Koran yang Menunggu Pemeriksaan */}
      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-700" aria-hidden="true" />
          <span>Memuat daftar mutasi rekening koran…</span>
        </div>
      ) : data && data.statements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/40 px-4 py-8 text-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 mb-2" aria-hidden="true" />
          <p className="text-xs font-semibold text-slate-800">
            Tidak ada mutasi kredit bank yang menunggu pemeriksaan.
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Impor mutasi rekening koran terbaru untuk memulai pencocokan settlement.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          {/* Mobile List (md:hidden) */}
          <div className="divide-y divide-slate-100 md:hidden">
            {data?.statements.map((st) => {
              const info = CLASSIFICATION_INFO[st.classification] || {
                label: 'Perlu pemeriksaan',
                className: 'bg-slate-100 text-slate-700 border-slate-200',
              }
              const isSelected = selected === st.id
              return (
                <div
                  key={`m-st-${st.id}`}
                  className={`p-3.5 space-y-2 ${isSelected ? 'bg-emerald-50/40' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 tabular-nums">
                        {formatFinanceDate(st.date, false)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">
                        {st.reference || 'Tanpa referensi'}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
                      {formatRupiah(st.amount)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${info.className}`}>
                      {info.label}
                    </span>
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(st.id)
                          setConfirm(false)
                        }}
                        className="inline-flex min-h-[34px] items-center rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {isSelected ? 'Sedang Diperiksa' : 'Periksa Bukti'}
                      </button>
                    )}
                  </div>
                  {(st.classification === 'PENDING_VERIFICATION' || st.classification === 'CASH_DEPOSIT') && st.note && (
                    <p className="text-[11px] text-amber-800">{st.note}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tanggal &amp; Referensi</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-4 py-3">Hasil Pencocokan</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.statements.map((st) => {
                  const info = CLASSIFICATION_INFO[st.classification] || {
                    label: 'Perlu pemeriksaan',
                    className: 'bg-slate-100 text-slate-700 border-slate-200',
                  }
                  const isSelected = selected === st.id
                  return (
                    <tr
                      key={st.id}
                      className={isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50/80 transition-colors'}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 tabular-nums">
                          {formatFinanceDate(st.date, false)}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {st.reference || 'Tanpa ID transaksi'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                        {formatRupiah(st.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${info.className}`}>
                          {info.label}
                        </span>
                        {(st.classification === 'PENDING_VERIFICATION' || st.classification === 'CASH_DEPOSIT') && st.note && (
                          <span className="mt-1 block text-[11px] text-amber-800">{st.note}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canMutate && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(st.id)
                              setConfirm(false)
                            }}
                            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {isSelected ? 'Sedang Diperiksa' : 'Periksa Bukti'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Panel Resolusi Pemeriksaan */}
      {selectedStatement && canMutate && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Catat Hasil Pemeriksaan Bukti Bank
              </h4>
              <p className="mt-0.5 text-xs text-slate-600 tabular-nums">
                Mutasi terpilih: <strong>{formatFinanceDate(selectedStatement.date, false)}</strong> ·{' '}
                <span className="font-mono">{selectedStatement.reference || 'Tanpa referensi'}</span> ·{' '}
                <strong>{formatRupiah(selectedStatement.amount)}</strong>
              </p>
            </div>
            <button
              type="button"
              aria-label="Tutup panel pemeriksaan"
              onClick={() => {
                setSelected('')
                setConfirm(false)
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-1">
            <span className="block text-xs font-semibold text-slate-700">
              Pembayaran / order yang telah diverifikasi
            </span>
            <SelectPicker
              value={target}
              options={targetOptions}
              onChange={(val) => {
                setTarget(val)
                setConfirm(false)
              }}
              ariaLabel="Pilih pembayaran atau order yang cocok"
              align="left"
              className="w-full [&>button]:w-full"
              menuClassName="w-full max-w-xl"
            />
          </div>

          <label className="block space-y-1">
            <span className="block text-xs font-semibold text-slate-700">
              Catatan bukti &amp; alasan pencocokan <span className="text-rose-500">*</span>{' '}
              <span className="font-normal text-slate-500">(min. 10 karakter)</span>
            </span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setConfirm(false)
              }}
              placeholder="Contoh: Cocok dengan mutasi BRI tgl 19 Nov, nominal & pengirim sesuai."
              className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
            {trimmedNotesLen > 0 && trimmedNotesLen < 10 && (
              <span className="text-[11px] text-rose-700">
                Minimal 10 karakter ({trimmedNotesLen}/10).
              </span>
            )}
          </label>

          {!confirm ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelected('')
                  setConfirm(false)
                }}
                className="min-h-[38px] rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={trimmedNotesLen < 10}
                onClick={() => setConfirm(true)}
                className="min-h-[38px] rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Tinjau Hasil Pemeriksaan
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2.5">
              <p className="text-xs text-amber-950 text-pretty">
                Konfirmasi pencatatan berdasarkan bukti bank yang telah Anda periksa. Pilihan pembayaran yang cocok akan mengubah status menjadi <strong>Settled Bank</strong> dengan jejak audit operator.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirm(false)}
                  className="min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-amber-100 cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={resolve}
                  className="min-h-[36px] rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {busy ? 'Menyimpan…' : 'Konfirmasi Hasil Pemeriksaan'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
