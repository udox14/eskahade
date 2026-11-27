'use client'

// Mutasi Kas Bank ↔ Tunai: catat uang yang diambil dari rekening Koperasi untuk laci loket,
// atau uang tunai yang disetor kembali ke rekening. Bukan pembayaran/pendapatan.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { X, Landmark, AlertTriangle, Upload, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { SelectPicker, type SelectPickerOption } from '@/components/ui/select-picker'
import { formatFinanceDate } from '@/lib/finance/date-format'
import {
  listLoketCashTransfersAction,
  recordLoketCashTransferAction,
  voidLoketCashTransferAction,
  type LoketCashAccountOption,
} from './actions'
import type { CashTransferRow } from '@/lib/finance/cash-transfers'

interface CashTransferModalProps {
  isOpen: boolean
  sessionId: string | null
  drawerBalance: number
  operatorName: string
  accounts: LoketCashAccountOption[]
  onClose: () => void
  onChanged: () => Promise<void> | void
}

const formatRupiah = (val: number) => `Rp${Math.max(0, Math.round(val)).toLocaleString('id-ID')}`

function nowLocalWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 16)
}

export default function CashTransferModal(props: CashTransferModalProps) {
  if (!props.isOpen || !props.sessionId) return null
  return <CashTransferForm {...props} sessionId={props.sessionId} />
}

function CashTransferForm({
  sessionId,
  drawerBalance,
  operatorName,
  accounts,
  onClose,
  onChanged,
}: CashTransferModalProps & { sessionId: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [direction, setDirection] = useState<'BANK_TO_CASH' | 'CASH_TO_BANK'>('BANK_TO_CASH')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [handledByName, setHandledByName] = useState(operatorName)
  const [transactedAt, setTransactedAt] = useState(nowLocalWib)
  const [bankReference, setBankReference] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transfers, setTransfers] = useState<CashTransferRow[]>([])

  // Inline void form (menggantikan window.prompt)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [isVoidSubmitting, setIsVoidSubmitting] = useState(false)

  const accountOptions = useMemo<SelectPickerOption[]>(
    () => accounts.map((a) => ({ value: a.id, label: a.label })),
    [accounts]
  )

  const load = async () => {
    const res = await listLoketCashTransfersAction(sessionId)
    if (res.success) setTransfers(res.data ?? [])
  }

  useEffect(() => {
    let active = true
    listLoketCashTransfersAction(sessionId).then((res) => {
      if (active && res.success) setTransfers(res.data ?? [])
    })
    return () => {
      active = false
    }
  }, [sessionId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting && !isVoidSubmitting) {
        if (voidingId) setVoidingId(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [submitting, isVoidSubmitting, voidingId, onClose])

  const numericAmount = parseInt(amount.replace(/\D/g, '') || '0', 10)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!accounts.length) {
      setError('Belum ada rekening Koperasi aktif. Tambahkan di Pengaturan Keuangan → Jalur Pembayaran.')
      return
    }
    if (numericAmount <= 0) {
      setError('Isi nominal lebih dari Rp0.')
      return
    }
    if (direction === 'CASH_TO_BANK' && numericAmount > drawerBalance) {
      setError(`Uang tersedia di laci hanya ${formatRupiah(drawerBalance)}.`)
      return
    }
    if (handledByName.trim().length < 2) {
      setError('Isi nama petugas yang ke bank.')
      return
    }
    if (!file) {
      setError('Unggah foto struk/slip bank.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Bukti harus berupa foto/gambar.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Ukuran foto bukti maksimal 3 MB.')
      return
    }

    const form = new FormData()
    form.set('idempotencyKey', idempotencyKey)
    form.set('direction', direction)
    form.set('amount', String(numericAmount))
    form.set('accountId', accountId)
    form.set('handledByName', handledByName)
    form.set('bankTransactedAt', new Date(`${transactedAt}:00+07:00`).toISOString())
    form.set('bankReference', bankReference)
    form.set('notes', notes)
    form.set('bukti', file)

    setSubmitting(true)
    const res = await recordLoketCashTransferAction(form)
    setSubmitting(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    toast.success(`Mutasi kas ${res.data?.transferNumber ?? ''} tercatat.`)
    setAmount('')
    setBankReference('')
    setNotes('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setIdempotencyKey(crypto.randomUUID())
    await load()
    await onChanged()
  }

  const handleConfirmVoid = async (id: string) => {
    if (voidReason.trim().length < 5) {
      toast.error('Alasan pembatalan minimal 5 karakter.')
      return
    }
    setIsVoidSubmitting(true)
    const res = await voidLoketCashTransferAction({ id, reason: voidReason.trim() })
    setIsVoidSubmitting(false)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success('Mutasi kas dibatalkan.')
    setVoidingId(null)
    setVoidReason('')
    await load()
    await onChanged()
  }

  const field =
    'min-h-[38px] w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-transfer-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting && !isVoidSubmitting) onClose()
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-5 py-4 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="cash-transfer-modal-title" className="text-sm sm:text-base font-bold text-slate-900">
                Kas Bank — Mutasi Rekening ↔ Laci
              </h2>
              <p className="text-xs text-slate-500 tabular-nums">
                Kas bebas di laci: {formatRupiah(drawerBalance)}. Bukan pembayaran atau pendapatan.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup modal"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5 text-xs">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['BANK_TO_CASH', 'Ambil dari Rekening', 'Uang masuk laci', ArrowDownToLine],
                ['CASH_TO_BANK', 'Setor ke Rekening', 'Uang keluar laci', ArrowUpFromLine],
              ] as const
            ).map(([value, label, hint, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDirection(value)}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                  direction === value
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="block text-xs font-semibold">{label}</span>
                  <span className="block text-[11px] text-slate-500">{hint}</span>
                </span>
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Nominal</span>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-semibold text-slate-400">
                Rp
              </span>
              <input
                inputMode="numeric"
                value={numericAmount ? numericAmount.toLocaleString('id-ID') : ''}
                onChange={(e) => setAmount(e.target.value)}
                className={`${field} pl-9 text-sm font-bold tabular-nums`}
                placeholder="0"
              />
            </div>
          </label>

          <div className="space-y-1">
            <span className="block font-semibold text-slate-700">Rekening Koperasi</span>
            {accounts.length > 0 ? (
              <SelectPicker
                value={accountId}
                options={accountOptions}
                onChange={setAccountId}
                ariaLabel="Pilih rekening Koperasi"
                align="left"
                className="w-full [&>button]:w-full"
              />
            ) : (
              <p className="text-xs text-amber-800">
                Belum ada rekening Koperasi aktif (tambahkan di Pengaturan Keuangan → Jalur Pembayaran).
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700">Petugas yang ke Bank</span>
              <input value={handledByName} onChange={(e) => setHandledByName(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700">Waktu Transaksi Bank (WIB)</span>
              <input
                type="datetime-local"
                value={transactedAt}
                onChange={(e) => setTransactedAt(e.target.value)}
                className={field}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">No. Referensi Struk / Slip (Opsional)</span>
            <input
              value={bankReference}
              maxLength={80}
              onChange={(e) => setBankReference(e.target.value)}
              className={field}
            />
          </label>

          <div className="space-y-1">
            <span className="block font-semibold text-slate-700">Foto Struk ATM / Slip Teller</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-600 hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors cursor-pointer"
            >
              <Upload className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="truncate">{file ? file.name : 'Pilih foto bukti (maks 3 MB)'}</span>
            </button>
          </div>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700">Catatan (Opsional)</span>
            <input
              value={notes}
              maxLength={300}
              onChange={(e) => setNotes(e.target.value)}
              className={field}
              placeholder="Contoh: untuk pencairan uang jajan pekan ini"
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[38px] rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {submitting
                ? 'Menyimpan…'
                : direction === 'BANK_TO_CASH'
                  ? 'Catat Uang Masuk Laci'
                  : 'Catat Setoran ke Rekening'}
            </button>
          </div>
        </form>

        {/* Daftar Mutasi Kas Sesi Ini */}
        <div className="border-t border-slate-100 px-5 py-4">
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-600">
            Mutasi Kas Bank Sesi Ini ({transfers.length})
          </h3>
          {transfers.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada mutasi kas bank pada sesi ini.</p>
          ) : (
            <ul className="space-y-2">
              {transfers.map((t) => (
                <li key={t.id} className="rounded-xl border border-slate-200 p-3 text-xs space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold text-slate-900 tabular-nums">
                        {t.direction === 'BANK_TO_CASH' ? 'Ambil dari Rekening' : 'Setor ke Rekening'} ·{' '}
                        {formatRupiah(t.amount)}
                      </p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        <span className="font-mono">{t.transfer_number}</span> · {t.handled_by_name} ·{' '}
                        {formatFinanceDate(t.bank_transacted_at, true)}
                      </p>
                      {t.status === 'VOIDED' && (
                        <p className="text-[11px] font-medium text-rose-700">Dibatalkan: {t.void_reason}</p>
                      )}
                      {t.statement_transaction_id && (
                        <p className="text-[11px] font-medium text-emerald-700">Cocok dengan rekening koran</p>
                      )}
                      <a
                        className="inline-block text-[11px] font-semibold text-sky-700 underline"
                        href={`/api/finance/cash-transfer-proofs/${encodeURIComponent(t.id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Lihat Foto Bukti
                      </a>
                    </div>

                    {t.status === 'POSTED' && !t.statement_transaction_id && voidingId !== t.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setVoidingId(t.id)
                          setVoidReason('')
                        }}
                        className="shrink-0 rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                      >
                        Batalkan
                      </button>
                    )}
                  </div>

                  {voidingId === t.id && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-2.5 space-y-2">
                      <input
                        type="text"
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        placeholder="Alasan pembatalan (minimal 5 karakter)…"
                        className="min-h-[34px] w-full rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setVoidingId(null)}
                          disabled={isVoidSubmitting}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmVoid(t.id)}
                          disabled={isVoidSubmitting}
                          className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                        >
                          {isVoidSubmitting ? 'Memproses…' : 'Konfirmasi Batalkan'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
