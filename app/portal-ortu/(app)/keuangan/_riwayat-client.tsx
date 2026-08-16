'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, CircleNotch, Clock, Lightning, Money, Question, XCircle } from '@phosphor-icons/react'
import { formatRupiah, formatTanggalId } from '@/lib/portal/format'
import { cancelSubmission } from './tagihan-actions'
import { UploadBukti } from './_upload-bukti'

export type SubmissionRiwayatItem = {
  source: 'submission'
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

export type AllocationRiwayatItem = {
  source: 'allocation'
  id: string
  destinationKind: 'SPP' | 'USPP' | 'NON_SPP' | 'MAKAN' | 'LAUNDRY' | 'JAJAN'
  jumlah: number
  status: 'RESERVED' | 'COMMITTED' | 'DISBURSED' | 'RETURNED'
  createdAt: string
}

export type RiwayatItem = SubmissionRiwayatItem | AllocationRiwayatItem

export type WithdrawalItem = {
  id: string
  amountRupiah: number
  credentialKind: string
  createdAt: string
}

const STATUS_META = {
  menunggu_konfirmasi: { label: 'Menunggu Konfirmasi', cls: 'portal-badge-warning', icon: Clock },
  terkonfirmasi: { label: 'Terkonfirmasi', cls: 'portal-badge-success', icon: CheckCircle },
  ditolak: { label: 'Ditolak', cls: 'portal-badge-danger', icon: XCircle },
  dibatalkan: { label: 'Dibatalkan', cls: 'portal-badge-neutral', icon: XCircle },
} as const

const ALLOCATION_STATUS_META = {
  RESERVED: { label: 'Menunggu Diambil', cls: 'portal-badge-warning' },
  COMMITTED: { label: 'Berhasil', cls: 'portal-badge-success' },
  DISBURSED: { label: 'Sudah Dicairkan', cls: 'portal-badge-success' },
  RETURNED: { label: 'Dikembalikan', cls: 'portal-badge-neutral' },
} as const

const DESTINATION_LABEL: Record<AllocationRiwayatItem['destinationKind'], string> = {
  SPP: 'Bayar Cepat SPP',
  NON_SPP: 'Bayar Cepat Non-SPP',
  USPP: 'Bayar USPP',
  MAKAN: 'Top Up Uang Makan',
  LAUNDRY: 'Top Up Uang Laundry',
  JAJAN: 'Top Up Uang Jajan',
}

export function RiwayatClient({ feed, withdrawals }: { feed: RiwayatItem[]; withdrawals: WithdrawalItem[] }) {
  const [view, setView] = useState<'pembayaran' | 'pencairan'>('pembayaran')

  return (
    <div>
      <div className="flex gap-1 rounded-[var(--p-radius-md)] border border-[var(--p-line)] bg-white p-1.5">
        <button
          type="button"
          onClick={() => setView('pembayaran')}
          className={`flex-1 rounded-[var(--p-radius-sm)] px-3 py-2 text-xs font-bold transition ${
            view === 'pembayaran' ? 'bg-[var(--p-ink)] text-white' : 'text-[var(--p-muted)]'
          }`}
        >
          Alokasi/Pembayaran
        </button>
        <button
          type="button"
          onClick={() => setView('pencairan')}
          className={`flex-1 rounded-[var(--p-radius-sm)] px-3 py-2 text-xs font-bold transition ${
            view === 'pencairan' ? 'bg-[var(--p-ink)] text-white' : 'text-[var(--p-muted)]'
          }`}
        >
          Pencairan
        </button>
      </div>

      <div className="mt-4">
        {view === 'pembayaran' ? <PembayaranFeed items={feed} /> : <PencairanFeed items={withdrawals} />}
      </div>
    </div>
  )
}

function PembayaranFeed({ items }: { items: RiwayatItem[] }) {
  if (items.length === 0) {
    return (
      <div className="portal-rise portal-rise-1 portal-card flex items-center gap-3 px-5 py-6">
        <Question className="w-6 h-6 shrink-0 text-[var(--p-muted)]" />
        <p className="text-xs font-semibold text-[var(--p-muted)]">
          Belum ada pengajuan pembayaran.{' '}
          <Link href="/portal-ortu/keuangan?tab=tagihan" className="underline decoration-[var(--p-muted)] underline-offset-2">
            Buka tab Tagihan
          </Link>{' '}
          untuk mulai membayar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) =>
        item.source === 'submission' ? (
          <SubmissionCard key={item.id} item={item} rise={index < 4 ? index + 1 : null} />
        ) : (
          <AllocationCard key={item.id} item={item} rise={index < 4 ? index + 1 : null} />
        )
      )}
    </div>
  )
}

function AllocationCard({ item, rise }: { item: AllocationRiwayatItem; rise: number | null }) {
  const meta = ALLOCATION_STATUS_META[item.status]
  return (
    <div className={`portal-rise ${rise ? `portal-rise-${rise}` : ''} portal-card p-5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--p-paper)] border border-[var(--p-line)] px-2.5 py-1 text-[10px] font-bold text-[var(--p-muted)]">
          <Lightning className="w-3 h-3" weight="fill" /> Instan dari Saldo
        </span>
        <span className={`portal-badge ${meta.cls}`}>{meta.label}</span>
      </div>
      <p className="mt-2.5 text-xs font-bold text-[var(--p-ink)]">{DESTINATION_LABEL[item.destinationKind]}</p>
      <p className="portal-display mt-1 text-xl leading-none text-[var(--p-ink)]">{formatRupiah(item.jumlah)}</p>
      <p className="mt-1.5 text-[10px] text-[var(--p-muted)]">{formatTanggalId(item.createdAt)}</p>
    </div>
  )
}

function SubmissionCard({ item, rise }: { item: SubmissionRiwayatItem; rise: number | null }) {
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

  const meta = STATUS_META[item.status]
  const StatusIcon = meta.icon
  const bisaBatal = item.status === 'menunggu_konfirmasi' || item.status === 'ditolak'
  const bisaUpload = item.status === 'ditolak' || (item.status === 'menunggu_konfirmasi' && !item.buktiUrl)

  return (
    <div className={`portal-rise ${rise ? `portal-rise-${rise}` : ''} portal-card p-5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-[var(--p-paper)] border border-[var(--p-line)] px-2.5 py-1 text-[10px] font-bold text-[var(--p-muted)]">
          {item.kategori === 'SPP' ? 'SPP Bulanan' : 'Non-SPP'}
        </span>
        <span className={`portal-badge ${meta.cls}`}>
          <StatusIcon className="w-3 h-3" />
          {meta.label}
        </span>
      </div>

      <p className="portal-display mt-3 text-xl leading-none text-[var(--p-ink)]">
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
        <p className="mt-2.5 rounded-[var(--p-radius-sm)] border-l-4 border-[var(--p-red)] bg-[var(--p-danger-soft)] px-3.5 py-2.5 text-[11px] leading-relaxed text-[var(--p-ink)]">
          <span className="font-bold">Alasan ditolak:</span> {item.rejectReason}
        </p>
      )}

      {item.status === 'menunggu_konfirmasi' && !item.buktiUrl && (
        <p className="mt-2.5 rounded-[var(--p-radius-sm)] border-l-4 border-[var(--p-warning)] bg-[var(--p-warning-soft)] px-3.5 py-2.5 text-[11px] leading-relaxed text-[var(--p-ink)]">
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
                  className="portal-btn portal-btn-primary flex-1"
                >
                  {item.status === 'ditolak' ? 'Upload Ulang Bukti' : 'Upload Bukti'}
                </button>
              )}
              {bisaBatal && (
                <button
                  onClick={() => handleCancel(item.id)}
                  disabled={cancelling === item.id}
                  className="portal-btn portal-btn-danger-outline flex-1"
                >
                  {cancelling === item.id && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                  Batalkan
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PencairanFeed({ items }: { items: WithdrawalItem[] }) {
  if (items.length === 0) {
    return (
      <div className="portal-rise portal-rise-1 portal-card flex items-center gap-3 px-5 py-6">
        <Money className="w-6 h-6 shrink-0 text-[var(--p-muted)]" />
        <p className="text-xs font-semibold text-[var(--p-muted)]">Belum ada riwayat pencairan saldo santri.</p>
      </div>
    )
  }

  return (
    <div className="portal-card divide-y divide-[var(--p-line)] p-2">
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between px-3 py-3.5 text-xs">
          <div>
            <p className="font-semibold text-[var(--p-ink)]">
              {new Date(item.createdAt).toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })} WIB
            </p>
            <span className="inline-block mt-0.5 rounded-full bg-[var(--p-paper)] border border-[var(--p-line)] px-2 py-0.5 text-[10px] font-bold text-[var(--p-muted)] uppercase tracking-wider">
              {item.credentialKind}
            </span>
          </div>
          <p className="portal-display text-sm text-[var(--p-ink)] font-bold">
            {formatRupiah(item.amountRupiah)}
          </p>
        </div>
      ))}
    </div>
  )
}
