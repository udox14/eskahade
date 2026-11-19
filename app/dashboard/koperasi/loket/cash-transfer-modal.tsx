'use client'

// Mutasi Kas Bank ↔ Tunai: catat uang yang diambil dari rekening Koperasi untuk laci loket,
// atau uang tunai yang disetor kembali ke rekening. Bukan pembayaran/pendapatan.

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { X, Landmark, AlertTriangle, Upload, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
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

function formatWib(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
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

  const load = async () => {
    const res = await listLoketCashTransfersAction(sessionId)
    if (res.success) setTransfers(res.data ?? [])
  }
  useEffect(() => {
    let active = true
    listLoketCashTransfersAction(sessionId).then(res => { if (active && res.success) setTransfers(res.data ?? []) })
    return () => { active = false }
  }, [sessionId])

  const numericAmount = parseInt(amount.replace(/\D/g, '') || '0', 10)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!accounts.length) { setError('Belum ada rekening Koperasi aktif. Tambahkan di Pengaturan Keuangan → Jalur Pembayaran.'); return }
    if (numericAmount <= 0) { setError('Isi nominal lebih dari Rp0.'); return }
    if (direction === 'CASH_TO_BANK' && numericAmount > drawerBalance) { setError(`Uang di laci hanya ${formatRupiah(drawerBalance)}.`); return }
    if (handledByName.trim().length < 2) { setError('Isi nama petugas yang ke bank.'); return }
    if (!file) { setError('Unggah foto struk/slip bank.'); return }
    if (!file.type.startsWith('image/')) { setError('Bukti harus berupa foto/gambar.'); return }
    if (file.size > 3 * 1024 * 1024) { setError('Ukuran foto bukti maksimal 3 MB.'); return }
    const form = new FormData()
    form.set('idempotencyKey', idempotencyKey)
    form.set('direction', direction)
    form.set('amount', String(numericAmount))
    form.set('accountId', accountId)
    form.set('handledByName', handledByName)
    form.set('bankTransactedAt', new Date(transactedAt + ':00+07:00').toISOString())
    form.set('bankReference', bankReference)
    form.set('notes', notes)
    form.set('bukti', file)
    setSubmitting(true)
    const res = await recordLoketCashTransferAction(form)
    setSubmitting(false)
    if (!res.success) { setError(res.error); return }
    toast.success(`Mutasi kas ${res.data?.transferNumber ?? ''} tercatat.`)
    setAmount(''); setBankReference(''); setNotes(''); setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setIdempotencyKey(crypto.randomUUID())
    await load()
    await onChanged()
  }

  const voidTransfer = async (row: CashTransferRow) => {
    const reason = window.prompt(`Batalkan ${row.transfer_number} (${formatRupiah(row.amount)})? Tulis alasannya:`)
    if (reason === null) return
    const res = await voidLoketCashTransferAction({ id: row.id, reason })
    if (!res.success) { toast.error(res.error); return }
    toast.success('Mutasi kas dibatalkan.')
    await load()
    await onChanged()
  }

  const field = 'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-100 text-sky-700"><Landmark className="w-5 h-5" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Kas Bank — Mutasi Rekening ↔ Laci</h2>
              <p className="text-xs text-slate-500">Uang laci sekarang: {formatRupiah(drawerBalance)}. Bukan pembayaran atau pendapatan.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4 text-sm">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {([['BANK_TO_CASH', 'Ambil dari rekening', 'Uang masuk laci', ArrowDownToLine], ['CASH_TO_BANK', 'Setor ke rekening', 'Uang keluar laci', ArrowUpFromLine]] as const).map(([value, label, hint, Icon]) => (
              <button key={value} type="button" onClick={() => setDirection(value)}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left transition ${direction === value ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                <Icon className="w-5 h-5 shrink-0" />
                <span><span className="block text-sm font-semibold">{label}</span><span className="block text-[11px] text-slate-500">{hint}</span></span>
              </button>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Nominal</span>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 font-semibold text-sm">Rp</span>
              <input inputMode="numeric" value={numericAmount ? numericAmount.toLocaleString('id-ID') : ''} onChange={e => setAmount(e.target.value)}
                className={field + ' pl-10 font-mono font-bold'} placeholder="0" />
            </div>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Rekening Koperasi</span>
            {accounts.length ? (
              <select value={accountId} onChange={e => setAccountId(e.target.value)} className={field}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            ) : <p className="text-xs text-amber-800">Belum ada rekening Koperasi aktif (Pengaturan Keuangan → Jalur Pembayaran).</p>}
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Petugas yang ke bank</span>
              <input value={handledByName} onChange={e => setHandledByName(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Waktu transaksi di bank (WIB)</span>
              <input type="datetime-local" value={transactedAt} onChange={e => setTransactedAt(e.target.value)} className={field} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">No. referensi struk/slip (opsional)</span>
            <input value={bankReference} maxLength={80} onChange={e => setBankReference(e.target.value)} className={field} />
          </label>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-700">Foto struk ATM / slip teller</span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 p-3 text-xs text-slate-600 inline-flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> {file ? file.name : 'Pilih foto bukti (maks 3 MB)'}
            </button>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700">Catatan (opsional)</span>
            <input value={notes} maxLength={300} onChange={e => setNotes(e.target.value)} className={field} placeholder="Contoh: untuk pencairan uang jajan pekan ini" />
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl">Tutup</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
              {submitting ? 'Menyimpan…' : direction === 'BANK_TO_CASH' ? 'Catat uang masuk laci' : 'Catat setoran ke rekening'}
            </button>
          </div>
        </form>

        <div className="px-6 pb-6">
          <h3 className="text-xs font-bold text-slate-700 mb-2">Mutasi kas sesi ini</h3>
          {transfers.length === 0 ? <p className="text-xs text-slate-500">Belum ada.</p> : (
            <ul className="space-y-2">
              {transfers.map(t => (
                <li key={t.id} className="p-3 rounded-xl border border-slate-200 text-xs flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {t.direction === 'BANK_TO_CASH' ? 'Ambil dari rekening' : 'Setor ke rekening'} · {formatRupiah(t.amount)}
                    </p>
                    <p className="text-slate-500">{t.transfer_number} · {t.handled_by_name} · {formatWib(t.bank_transacted_at)}</p>
                    {t.status === 'VOIDED' && <p className="text-rose-700">Dibatalkan: {t.void_reason}</p>}
                    {t.statement_transaction_id && <p className="text-emerald-700">Sudah cocok dengan rekening koran</p>}
                    <a className="text-sky-700 underline" href={`/api/finance/cash-transfer-proofs/${encodeURIComponent(t.id)}`} target="_blank" rel="noreferrer">Lihat bukti</a>
                  </div>
                  {t.status === 'POSTED' && !t.statement_transaction_id && (
                    <button type="button" onClick={() => voidTransfer(t)} className="shrink-0 px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50">Batalkan</button>
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
