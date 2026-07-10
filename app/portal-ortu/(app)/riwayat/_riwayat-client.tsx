'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Clock3, FileQuestion, Loader2, XCircle } from 'lucide-react'
import { formatRupiah, formatTanggalId } from '@/lib/portal/format'
import { cancelSubmission } from '../tagihan/actions'
import { UploadBukti } from '../tagihan/_upload-bukti'

export type RiwayatItem = {
  id: string
  kategori: 'SPP' | 'NON_SPP'
  rincian: string[]
  jumlah: number
  metode: 'TRANSFER' | 'QRIS'
  bank: string | null
  buktiUrl: string | null
  status: 'menunggu_konfirmasi' | 'terkonfirmasi' | 'ditolak' | 'dibatalkan'
  rejectReason: string | null
  createdAt: string
}

const STATUS_META = {
  menunggu_konfirmasi: {
    label: 'Menunggu Konfirmasi',
    cls: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: Clock3,
  },
  terkonfirmasi: {
    label: 'Terkonfirmasi',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: CheckCircle2,
  },
  ditolak: {
    label: 'Ditolak',
    cls: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: XCircle,
  },
  dibatalkan: {
    label: 'Dibatalkan',
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: XCircle,
  },
} as const

export function RiwayatClient({ items }: { items: RiwayatItem[] }) {
  const router = useRouter()
  const [uploadFor, setUploadFor] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  async function handleCancel(id: string) {
    if (cancelling) return
    if (!window.confirm('Batalkan pengajuan ini? Anda bisa membuat pengajuan baru setelahnya.')) return
    setCancelling(id)
    const res = await cancelSubmission(id)
    setCancelling(null)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('Pengajuan dibatalkan.')
    router.refresh()
  }

  if (items.length === 0) {
    return (
      <div className="portal-rise portal-rise-1 flex items-center gap-3 rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] px-5 py-6 shadow-sm">
        <FileQuestion className="w-6 h-6 shrink-0 text-[var(--p-muted)]" />
        <p className="text-xs font-semibold text-[var(--p-muted)]">
          Belum ada pengajuan pembayaran. Buka menu Tagihan untuk mulai membayar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const meta = STATUS_META[item.status]
        const StatusIcon = meta.icon
        const bisaBatal = item.status === 'menunggu_konfirmasi' || item.status === 'ditolak'
        const bisaUpload =
          (item.status === 'ditolak') ||
          (item.status === 'menunggu_konfirmasi' && !item.buktiUrl)

        return (
          <div
            key={item.id}
            className={`portal-rise ${index < 4 ? `portal-rise-${index + 1}` : ''} rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] p-5 shadow-sm`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-[var(--p-cream)] px-2.5 py-1 text-[10px] font-bold text-[var(--p-muted)]">
                {item.kategori === 'SPP' ? 'SPP Bulanan' : 'Non-SPP'}
              </span>
              <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${meta.cls}`}>
                <StatusIcon className="w-3 h-3" />
                {meta.label}
              </span>
            </div>

            <p className="portal-display mt-3 text-xl leading-none text-[var(--p-emerald-deep)]">
              {formatRupiah(item.jumlah)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--p-muted)]">
              {item.rincian.join(', ')}
            </p>
            <p className="mt-1.5 text-[10px] text-[var(--p-muted)]">
              {item.metode === 'TRANSFER' ? (item.bank ? `Transfer • ${item.bank}` : 'Transfer bank') : 'QRIS'}
              {' • '}Diajukan {formatTanggalId(item.createdAt)}
            </p>

            {item.status === 'ditolak' && item.rejectReason && (
              <p className="mt-2.5 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-[11px] leading-relaxed text-rose-800">
                <span className="font-bold">Alasan ditolak:</span> {item.rejectReason}
              </p>
            )}

            {item.status === 'menunggu_konfirmasi' && !item.buktiUrl && (
              <p className="mt-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-800">
                Bukti pembayaran belum diunggah. Petugas baru bisa memeriksa setelah bukti dikirim.
              </p>
            )}

            {(bisaUpload || bisaBatal) && (
              <div className="mt-3.5 space-y-2.5">
                {bisaUpload && uploadFor === item.id ? (
                  <UploadBukti
                    submissionId={item.id}
                    buttonLabel={item.status === 'ditolak' ? 'Kirim Ulang Bukti' : 'Kirim Bukti Pembayaran'}
                    onDone={() => {
                      setUploadFor(null)
                      router.refresh()
                    }}
                  />
                ) : (
                  <div className="flex gap-2">
                    {bisaUpload && (
                      <button
                        onClick={() => setUploadFor(item.id)}
                        className="flex-1 rounded-2xl bg-[var(--p-emerald)] py-3 text-xs font-bold text-white active:scale-[0.98] transition"
                      >
                        {item.status === 'ditolak' ? 'Upload Ulang Bukti' : 'Upload Bukti'}
                      </button>
                    )}
                    {bisaBatal && (
                      <button
                        onClick={() => handleCancel(item.id)}
                        disabled={cancelling === item.id}
                        className="flex-1 rounded-2xl border border-rose-200 bg-rose-50 py-3 text-xs font-bold text-rose-700 active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-1.5"
                      >
                        {cancelling === item.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Batalkan
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
