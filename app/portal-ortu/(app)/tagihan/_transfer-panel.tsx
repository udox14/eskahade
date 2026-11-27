'use client'

// Transfer manual di Portal Wali: kartu status, instruksi transfer, dan form unggah bukti.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, Check, Clock, Upload, AlertCircle, CheckCircle2, Landmark, XCircle } from 'lucide-react'
import type { PortalTransferSummary } from '@/lib/portal/finance'
import { formatPortalDateTimeWib, parsePortalTimestamp } from '@/lib/portal/format'
import { BottomSheet } from '../../_components/bottom-sheet'
import { uploadTransferProofAction, cancelTransferAction } from './actions'

export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Rp0'
  return `Rp${Math.round(amount).toLocaleString('id-ID')}`
}

function formatWib(iso: string | null): string {
  return formatPortalDateTimeWib(iso)
}

/** Amount with the last three digits (unique code) emphasised: Rp505.<b>020</b>. */
export function TransferAmount({ amount, className = '' }: { amount: number; className?: string }) {
  const text = Math.round(amount).toLocaleString('id-ID')
  const cut = text.length - 3
  return (
    <span className={`font-mono ${className}`}>
      Rp{text.slice(0, cut)}<span className="rounded bg-amber-200/80 dark:bg-amber-700/60 px-0.5 text-amber-950 dark:text-amber-50">{text.slice(cut)}</span>
    </span>
  )
}

export const TRANSFER_STATUS_LABEL: Record<PortalTransferSummary['status'], string> = {
  MENUNGGU_BUKTI: 'Menunggu Bukti Transfer',
  MENUNGGU_VERIFIKASI: 'Sedang Dicek Petugas',
  PERLU_PERBAIKAN: 'Perlu Unggah Ulang',
  DITERIMA: 'Pembayaran Diterima',
  DITOLAK: 'Ditolak',
  DIBATALKAN: 'Dibatalkan',
  KEDALUWARSA: 'Kedaluwarsa',
}

export function isTransferOpen(t: PortalTransferSummary): boolean {
  if (t.status === 'MENUNGGU_VERIFIKASI' || t.status === 'PERLU_PERBAIKAN') return true
  const exp = parsePortalTimestamp(t.expiresAt)
  return t.status === 'MENUNGGU_BUKTI' && !!exp && exp.getTime() > Date.now()
}

/** Show open transfers, plus results from the last 3 days so parents see the outcome. */
export function visibleTransfers(transfers: PortalTransferSummary[]): PortalTransferSummary[] {
  const recent = Date.now() - 3 * 24 * 3600 * 1000
  return transfers.filter(t => {
    if (isTransferOpen(t)) return true
    if (t.status === 'DITERIMA' || t.status === 'DITOLAK') {
      const ts = parsePortalTimestamp(t.reviewedAt || t.createdAt)
      return !!ts && ts.getTime() > recent
    }
    return false
  }).slice(0, 2)
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (key: string, value: string, label: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key); toast.success(`${label} disalin`)
      setTimeout(() => setCopied(null), 2000)
    }).catch(() => toast.error('Gagal menyalin. Salin manual.'))
  }
  return { copied, copy }
}

export function TransferStatusCard({ transfer, onOpen }: { transfer: PortalTransferSummary; onOpen: () => void }) {
  const tone = transfer.status === 'DITERIMA' ? 'emerald' : transfer.status === 'DITOLAK' ? 'red' : 'amber'
  const toneClass = {
    emerald: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/40',
    red: 'border-red-200 bg-red-50/80 dark:border-red-900/60 dark:bg-red-950/40',
    amber: 'border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/40',
  }[tone]
  const Icon = transfer.status === 'DITERIMA' ? CheckCircle2 : transfer.status === 'DITOLAK' ? XCircle : transfer.status === 'MENUNGGU_VERIFIKASI' ? Clock : Upload
  return (
    <div className={`rounded-[18px] border p-4 space-y-2 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-700 dark:text-slate-200" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{TRANSFER_STATUS_LABEL[transfer.status]}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Transfer <TransferAmount amount={transfer.expectedAmount} className="font-bold text-slate-900 dark:text-slate-100" />
            {transfer.destination ? ` ke ${transfer.destination.bankName}` : ''}
          </p>
          {transfer.status === 'MENUNGGU_BUKTI' && (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">Unggah bukti sebelum {formatWib(transfer.expiresAt)}.</p>
          )}
          {transfer.status === 'MENUNGGU_VERIFIKASI' && (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Bukti dikirim {formatWib(transfer.submittedAt)}. Petugas akan memeriksa mutasi rekening.</p>
          )}
          {(transfer.status === 'PERLU_PERBAIKAN' || transfer.status === 'DITOLAK') && transfer.reviewNotes && (
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">Catatan petugas: {transfer.reviewNotes}</p>
          )}
          {transfer.status === 'DITERIMA' && transfer.resolution === 'UNALLOCATED' && (
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">Dana diterima dengan nominal berbeda. Bagian keuangan akan menghubungi Anda untuk penyesuaian.</p>
          )}
        </div>
      </div>
      {(transfer.status === 'MENUNGGU_BUKTI' || transfer.status === 'PERLU_PERBAIKAN') && (
        <button type="button" onClick={onOpen}
          className="w-full min-h-11 rounded-xl bg-[#064e3b] px-4 py-2.5 text-sm font-bold text-[#bef264] active:scale-[0.98] transition">
          {transfer.status === 'MENUNGGU_BUKTI' ? 'Lihat rekening & unggah bukti' : 'Unggah ulang bukti'}
        </button>
      )}
      {transfer.status === 'MENUNGGU_VERIFIKASI' && (
        <button type="button" onClick={onOpen} className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 underline underline-offset-2">Lihat rincian</button>
      )}
    </div>
  )
}

function nowLocalInput(): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000)
  return d.toISOString().slice(0, 16)
}

export function TransferSheet({ transfer, open, onClose }: { transfer: PortalTransferSummary | null; open: boolean; onClose: () => void }) {
  if (!transfer) return null
  return <TransferSheetInner key={transfer.submissionId} transfer={transfer} open={open} onClose={onClose} />
}

function TransferSheetInner({ transfer, open, onClose }: { transfer: PortalTransferSummary; open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { copied, copy } = useCopy()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [senderName, setSenderName] = useState('')
  const [senderBank, setSenderBank] = useState('')
  const [transferredAt, setTransferredAt] = useState(nowLocalInput)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Bersihkan objectURL saat unmount atau ganti preview (anti memory leak)
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const canUpload = transfer.status === 'MENUNGGU_BUKTI' || transfer.status === 'PERLU_PERBAIKAN'

  const pick = async (selected: File | undefined) => {
    if (!selected) return
    if (!selected.type.startsWith('image/')) { setErrors(e => ({ ...e, file: 'Bukti harus berupa foto/gambar.' })); return }
    try {
      const compressed = await compressImage(selected)
      setFile(compressed)
      setPreview(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(compressed)
      })
      setErrors(e => ({ ...e, file: '' }))
    } catch {
      setErrors(e => ({ ...e, file: 'Foto tidak bisa dibaca. Coba foto lain.' }))
    }
  }

  const submit = async () => {
    const next: Record<string, string> = {}
    if (!file) next.file = 'Pilih foto bukti transfer.'
    if (senderName.trim().length < 2) next.senderName = 'Isi nama pemilik rekening pengirim.'
    if (senderBank.trim().length < 2) next.senderBank = 'Isi bank pengirim.'
    if (!transferredAt) next.transferredAt = 'Isi waktu transfer.'
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    setSubmitting(true)
    const form = new FormData()
    form.set('submissionId', transfer.submissionId)
    form.set('bukti', file!)
    form.set('senderName', senderName)
    form.set('senderBank', senderBank)
    form.set('transferredAt', new Date(transferredAt + ':00+07:00').toISOString())
    form.set('notes', notes)
    const res = await uploadTransferProofAction(form)
    setSubmitting(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Bukti terkirim. Petugas akan memeriksa pembayaran Anda.')
    setFile(null)
    setPreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    onClose()
    router.refresh()
  }

  const cancel = async () => {
    if (cancelling) return
    setCancelling(true)
    const res = await cancelTransferAction(transfer.submissionId)
    setCancelling(false)
    if ('error' in res) { toast.error(res.error); return }
    toast.success('Pembayaran dibatalkan.')
    setConfirmingCancel(false)
    onClose(); router.refresh()
  }

  const fieldClass = 'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden'
  const amountText = String(Math.round(transfer.expectedAmount))

  return (
    <BottomSheet
      open={open}
      onClose={() => { if (!submitting) onClose() }}
      title={canUpload ? 'Transfer & unggah bukti' : TRANSFER_STATUS_LABEL[transfer.status]}
      subtitle={transfer.submissionNumber}
      icon={<Landmark className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />}
      footer={canUpload ? (
        <button type="button" disabled={submitting} onClick={submit}
          className="w-full min-h-12 rounded-xl bg-[#064e3b] px-4 py-3 text-sm font-bold text-[#bef264] disabled:opacity-50">
          {submitting ? 'Mengirim bukti…' : 'Kirim bukti transfer'}
        </button>
      ) : undefined}
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-4 text-center space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Transfer tepat sejumlah</p>
          <div className="flex items-center justify-center gap-2">
            <TransferAmount amount={transfer.expectedAmount} className="text-2xl font-black text-slate-950 dark:text-slate-100" />
            <button type="button" aria-label="Salin nominal transfer" onClick={() => copy('amount', amountText, 'Nominal')}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300">
              {copied === 'amount' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            Tiga digit terakhir ({String(transfer.uniqueCode).padStart(3, '0')}) adalah kode unik agar pembayaran Anda mudah dikenali. Mohon jangan dibulatkan.
          </p>
        </div>

        {transfer.destination && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/40 p-4 space-y-1">
            <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">{transfer.destination.bankName}</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-black tracking-wider text-emerald-950 dark:text-emerald-100">{transfer.destination.accountNumber}</span>
              <button type="button" aria-label="Salin nomor rekening" onClick={() => copy('account', transfer.destination!.accountNumber, 'Nomor rekening')}
                className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 p-1.5 text-emerald-700 dark:text-emerald-300">
                {copied === 'account' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-emerald-900 dark:text-emerald-300">a.n. {transfer.destination.accountHolder}</p>
          </div>
        )}

        <div className="space-y-1 border-y border-slate-200 dark:border-slate-800 py-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex justify-between"><span>Pembayaran (masuk ke tagihan/saldo)</span><span className="font-mono">{formatRupiah(transfer.grossAmount)}</span></div>
          <div className="flex justify-between"><span>Biaya admin Koperasi{transfer.feeMode === 'DEDUCT' ? ' (dipotong)' : ''}</span><span className="font-mono">{formatRupiah(transfer.cooperativeAdminFee)}</span></div>
          <div className="flex justify-between"><span>Kode unik</span><span className="font-mono">{formatRupiah(transfer.uniqueCode)}</span></div>
          <div className="flex justify-between font-bold text-slate-950 dark:text-slate-100 pt-1"><span>Total transfer</span><span className="font-mono">{formatRupiah(transfer.expectedAmount)}</span></div>
        </div>

        {transfer.status === 'MENUNGGU_BUKTI' && (
          <p className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
            <Clock className="h-4 w-4 shrink-0" /> Unggah bukti sebelum {formatWib(transfer.expiresAt)}. Setelah itu pembayaran dibatalkan otomatis.
          </p>
        )}
        {transfer.status === 'PERLU_PERBAIKAN' && transfer.reviewNotes && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0" /> Catatan petugas: {transfer.reviewNotes}
          </p>
        )}
        {transfer.status === 'MENUNGGU_VERIFIKASI' && (
          <p className="text-xs text-slate-600 dark:text-slate-400">Bukti dikirim {formatWib(transfer.submittedAt)}. Anda akan melihat hasilnya di halaman ini setelah petugas memeriksa.</p>
        )}

        {canUpload && (
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-slate-100">Bukti transfer</h4>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-3 text-center text-xs text-slate-600 dark:text-slate-400">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Pratinjau bukti transfer" className="mx-auto max-h-48 rounded-lg object-contain" />
              ) : (
                <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" /> Pilih foto/screenshot bukti</span>
              )}
            </button>
            {preview && <button type="button" onClick={() => fileRef.current?.click()} className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Ganti foto</button>}
            {errors.file && <p className="text-xs text-red-600">{errors.file}</p>}
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama pemilik rekening pengirim</span>
              <input className={fieldClass} value={senderName} onChange={e => setSenderName(e.target.value)} autoComplete="name" />
              {errors.senderName && <span className="text-xs text-red-600">{errors.senderName}</span>}
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bank / e-wallet pengirim</span>
              <input className={fieldClass} value={senderBank} placeholder="Contoh: BRI, BSI, DANA" onChange={e => setSenderBank(e.target.value)} />
              {errors.senderBank && <span className="text-xs text-red-600">{errors.senderBank}</span>}
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Waktu transfer (WIB)</span>
              <input type="datetime-local" className={fieldClass} value={transferredAt} onChange={e => setTransferredAt(e.target.value)} />
              {errors.transferredAt && <span className="text-xs text-red-600">{errors.transferredAt}</span>}
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Catatan (opsional)</span>
              <input className={fieldClass} value={notes} maxLength={300} onChange={e => setNotes(e.target.value)} />
            </label>
            {transfer.status === 'MENUNGGU_BUKTI' && (
              confirmingCancel ? (
                <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40 p-3 space-y-2.5 text-xs">
                  <p className="text-red-900 dark:text-red-200 font-medium leading-relaxed">
                    Batalkan pembayaran ini? <b>Jangan batalkan jika Anda sudah mentransfer uang.</b>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={() => setConfirmingCancel(false)}
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50"
                    >
                      Kembali
                    </button>
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={cancel}
                      className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 py-2 font-bold text-white disabled:opacity-50"
                    >
                      {cancelling ? 'Membatalkan…' : 'Ya, Batalkan'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline cursor-pointer"
                >
                  Batalkan pembayaran ini
                </button>
              )
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

/** Shrink photos to ≤1280px WebP/JPEG under ~1.5 MB so uploads stay within the 2 MB limit. */
async function compressImage(file: File): Promise<File> {
  if (file.size < 600 * 1024 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size <= 1.5 * 1024 * 1024) return new File([blob], 'bukti.jpg', { type: 'image/jpeg' })
  }
  throw new Error('too large')
}
