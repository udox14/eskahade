'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Banknote, Building2, CheckCircle2, ChevronRight, Clock3, Copy, Landmark, Loader2,
  QrCode, X,
} from 'lucide-react'
import type { PortalPaymentChannels } from '@/lib/portal/data'
import { formatRupiah } from '@/lib/portal/format'
import { createSubmission } from './actions'
import { UploadBukti } from './_upload-bukti'

export type TagihanItem = {
  key: string
  label: string
  sublabel: string | null
  nominal: number
}

type Kategori = 'SPP' | 'NON_SPP'
type Step = 1 | 2 | 3

export function TagihanClient(props: {
  tampilkanSpp: boolean
  sppItems: TagihanItem[]
  nonSppItems: TagihanItem[]
  channels: PortalPaymentChannels
  pendingSpp: boolean
  pendingSppSudahUpload: boolean
  pendingNonSpp: boolean
  pendingNonSppSudahUpload: boolean
}) {
  const [wizard, setWizard] = useState<Kategori | null>(null)

  return (
    <div className="space-y-4">
      {props.tampilkanSpp && (
        <BillCard
          rise="portal-rise-1"
          icon={<Banknote className="w-5 h-5 text-[var(--p-emerald)]" />}
          title="SPP Bulanan"
          subtitle="Syahriah pengajian & asrama"
          items={props.sppItems}
          pending={props.pendingSpp}
          pendingSudahUpload={props.pendingSppSudahUpload}
          onPay={() => setWizard('SPP')}
          emptyText="Alhamdulillah, SPP sudah lunas sampai bulan ini."
        />
      )}

      <BillCard
        rise="portal-rise-2"
        icon={<Building2 className="w-5 h-5 text-[var(--p-gold)]" />}
        title="Biaya Tahunan (Non-SPP)"
        subtitle="Bangunan, kesehatan, EHB, ekskul"
        items={props.nonSppItems}
        pending={props.pendingNonSpp}
        pendingSudahUpload={props.pendingNonSppSudahUpload}
        onPay={() => setWizard('NON_SPP')}
        emptyText="Tidak ada tagihan Non-SPP tersisa. Jazakumullah khairan."
      />

      {wizard && (
        <WizardModal
          kategori={wizard}
          items={wizard === 'SPP' ? props.sppItems : props.nonSppItems}
          channels={props.channels}
          onClose={() => setWizard(null)}
        />
      )}
    </div>
  )
}

function BillCard(props: {
  rise: string
  icon: React.ReactNode
  title: string
  subtitle: string
  items: TagihanItem[]
  pending: boolean
  pendingSudahUpload: boolean
  onPay: () => void
  emptyText: string
}) {
  const total = props.items.reduce((sum, item) => sum + item.nominal, 0)

  return (
    <div className={`portal-rise ${props.rise} rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] p-5 shadow-[0_18px_40px_-18px_rgba(11,94,63,0.25)]`}>
      <div className="flex items-center gap-3">
        <span className="flex w-10 h-10 items-center justify-center rounded-2xl bg-[var(--p-cream)]">
          {props.icon}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="portal-display text-lg leading-tight text-[var(--p-emerald-deep)]">{props.title}</h2>
          <p className="text-[11px] text-[var(--p-muted)]">{props.subtitle}</p>
        </div>
      </div>

      {props.items.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-800">
          {props.emptyText}
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {props.items.map(item => (
              <div key={item.key} className="flex items-center justify-between rounded-xl bg-[var(--p-cream)] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--p-ink)] truncate">{item.label}</p>
                  {item.sublabel && <p className="text-[10px] text-[var(--p-muted)]">{item.sublabel}</p>}
                </div>
                <p className="text-xs font-extrabold text-[var(--p-ink)] shrink-0 ml-3">{formatRupiah(item.nominal)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-dashed border-[var(--p-line)] pt-3.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Total Tagihan</p>
              <p className="portal-display text-xl leading-none text-[var(--p-emerald-deep)]">{formatRupiah(total)}</p>
            </div>
            {props.pending ? (
              <Link
                href="/portal-ortu/riwayat"
                className="flex items-center gap-1.5 rounded-2xl bg-amber-100 border border-amber-300 px-4 py-2.5 text-xs font-bold text-amber-800"
              >
                <Clock3 className="w-3.5 h-3.5" />
                {props.pendingSudahUpload ? 'Menunggu konfirmasi' : 'Lanjutkan upload'}
              </Link>
            ) : (
              <button
                onClick={props.onPay}
                className="flex items-center gap-1 rounded-2xl bg-[var(--p-emerald)] px-5 py-3 text-xs font-bold text-white shadow-md shadow-emerald-900/15 active:scale-[0.97] transition"
              >
                Bayar <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Wizard 3 langkah ─────────────────────────────────────────

function WizardModal({
  kategori,
  items,
  channels,
  onClose,
}: {
  kategori: Kategori
  items: TagihanItem[]
  channels: PortalPaymentChannels
  onClose: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [selected, setSelected] = useState<Set<string>>(new Set(items.map(i => i.key)))
  const [metode, setMetode] = useState<'TRANSFER' | 'QRIS'>('TRANSFER')
  const [bankId, setBankId] = useState<string>(channels.banks[0]?.id ?? '')
  const [creating, setCreating] = useState(false)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const total = useMemo(
    () => items.filter(i => selected.has(i.key)).reduce((sum, i) => sum + i.nominal, 0),
    [items, selected]
  )
  const bank = channels.banks.find(b => b.id === bankId) || null
  const qrisAvailable = !!channels.qris_url
  const transferAvailable = channels.banks.length > 0

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleCreate() {
    if (creating) return
    if (metode === 'TRANSFER' && !bank) {
      toast.error('Pilih rekening tujuan.')
      return
    }
    setCreating(true)
    const res = await createSubmission({
      kategori,
      itemKeys: Array.from(selected),
      metode,
      bankId: bank?.id ?? null,
    })
    setCreating(false)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setSubmissionId(res.submissionId)
    setStep(3)
  }

  function handleFinish() {
    setDone(true)
    router.refresh()
  }

  function handleClose() {
    onClose()
    router.refresh()
  }

  async function copyRekening() {
    if (!bank) return
    try {
      await navigator.clipboard.writeText(bank.nomor.replace(/\s/g, ''))
      toast.success('Nomor rekening disalin.')
    } catch {
      toast.error('Gagal menyalin.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label="Tutup" onClick={handleClose} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="portal-root relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-t-[2rem] bg-[var(--p-cream)] p-5 pb-8 portal-rise">
        {/* Header modal */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--p-muted)]">
              {kategori === 'SPP' ? 'Bayar SPP Bulanan' : 'Bayar Non-SPP'}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              {[1, 2, 3].map(n => (
                <span
                  key={n}
                  className={`h-1.5 rounded-full transition-all ${
                    step >= n ? 'w-7 bg-[var(--p-emerald)]' : 'w-3.5 bg-[var(--p-line)]'
                  }`}
                />
              ))}
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-xl bg-white border border-[var(--p-line)]" aria-label="Tutup">
            <X className="w-4 h-4 text-[var(--p-muted)]" />
          </button>
        </div>

        {/* Step 1: pilih item */}
        {step === 1 && (
          <div className="mt-5">
            <h3 className="portal-display text-xl text-[var(--p-emerald-deep)]">
              {kategori === 'SPP' ? 'Pilih bulan yang dibayar' : 'Pilih jenis biaya'}
            </h3>
            <p className="mt-1 text-xs text-[var(--p-muted)]">
              Nominal dihitung otomatis sesuai tarif pesantren.
            </p>
            <div className="mt-4 space-y-2">
              {items.map(item => {
                const active = selected.has(item.key)
                return (
                  <button
                    key={item.key}
                    onClick={() => toggle(item.key)}
                    className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                      active
                        ? 'border-[var(--p-emerald)] bg-white shadow-sm'
                        : 'border-[var(--p-line)] bg-white/60 opacity-70'
                    }`}
                  >
                    <span
                      className={`flex w-5 h-5 items-center justify-center rounded-full border-2 shrink-0 ${
                        active ? 'border-[var(--p-emerald)] bg-[var(--p-emerald)]' : 'border-[var(--p-line)]'
                      }`}
                    >
                      {active && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-[var(--p-ink)]">{item.label}</span>
                      {item.sublabel && (
                        <span className="block text-[10px] text-[var(--p-muted)]">{item.sublabel}</span>
                      )}
                    </span>
                    <span className="text-xs font-extrabold text-[var(--p-ink)]">{formatRupiah(item.nominal)}</span>
                  </button>
                )
              })}
            </div>
            <TotalBar total={total} />
            <button
              disabled={selected.size === 0}
              onClick={() => setStep(2)}
              className="mt-3 w-full rounded-2xl bg-[var(--p-emerald)] py-4 text-sm font-bold text-white active:scale-[0.98] transition disabled:opacity-50"
            >
              Lanjut Pilih Metode
            </button>
          </div>
        )}

        {/* Step 2: metode */}
        {step === 2 && (
          <div className="mt-5">
            <h3 className="portal-display text-xl text-[var(--p-emerald-deep)]">Metode pembayaran</h3>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                disabled={!transferAvailable}
                onClick={() => setMetode('TRANSFER')}
                className={`rounded-2xl border p-4 text-left transition disabled:opacity-40 ${
                  metode === 'TRANSFER' ? 'border-[var(--p-emerald)] bg-white shadow-sm' : 'border-[var(--p-line)] bg-white/60'
                }`}
              >
                <Landmark className="w-5 h-5 text-[var(--p-emerald)]" />
                <p className="mt-2 text-sm font-bold text-[var(--p-ink)]">Transfer Bank</p>
                <p className="text-[10px] text-[var(--p-muted)]">Ke rekening pesantren</p>
              </button>
              <button
                disabled={!qrisAvailable}
                onClick={() => setMetode('QRIS')}
                className={`rounded-2xl border p-4 text-left transition disabled:opacity-40 ${
                  metode === 'QRIS' ? 'border-[var(--p-emerald)] bg-white shadow-sm' : 'border-[var(--p-line)] bg-white/60'
                }`}
              >
                <QrCode className="w-5 h-5 text-[var(--p-gold)]" />
                <p className="mt-2 text-sm font-bold text-[var(--p-ink)]">QRIS</p>
                <p className="text-[10px] text-[var(--p-muted)]">Scan dari aplikasi apa pun</p>
              </button>
            </div>

            {metode === 'TRANSFER' && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--p-muted)]">Rekening tujuan</p>
                {channels.banks.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setBankId(b.id)}
                    className={`w-full rounded-2xl border px-4 py-3.5 text-left transition ${
                      bankId === b.id ? 'border-[var(--p-emerald)] bg-white shadow-sm' : 'border-[var(--p-line)] bg-white/60'
                    }`}
                  >
                    <p className="text-sm font-extrabold text-[var(--p-ink)]">{b.bank}</p>
                    <p className="text-xs font-semibold text-[var(--p-emerald)] tracking-wide">{b.nomor}</p>
                    <p className="text-[10px] text-[var(--p-muted)]">a.n. {b.atas_nama}</p>
                  </button>
                ))}
              </div>
            )}

            {metode === 'QRIS' && channels.qris_url && (
              <div className="mt-4 rounded-2xl bg-white border border-[var(--p-line)] p-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={channels.qris_url} alt="QRIS Pesantren" className="mx-auto max-h-64 rounded-xl" />
                <p className="mt-2 text-[11px] text-[var(--p-muted)]">
                  Scan lalu bayar persis sejumlah total di bawah.
                </p>
              </div>
            )}

            <TotalBar total={total} />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="rounded-2xl border border-[var(--p-line)] bg-white px-5 py-4 text-sm font-bold text-[var(--p-muted)]"
              >
                Kembali
              </button>
              <button
                disabled={creating || (metode === 'TRANSFER' && !bank)}
                onClick={handleCreate}
                className="flex-1 rounded-2xl bg-[var(--p-emerald)] py-4 text-sm font-bold text-white active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {creating ? 'Membuat pengajuan…' : 'Buat Pengajuan & Bayar'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: instruksi + upload bukti */}
        {step === 3 && submissionId && !done && (
          <div className="mt-5">
            <h3 className="portal-display text-xl text-[var(--p-emerald-deep)]">
              Bayar lalu unggah bukti
            </h3>
            <div className="mt-3 rounded-2xl bg-[var(--p-emerald-deep)] p-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">
                Nominal yang harus dibayar
              </p>
              <p className="portal-display mt-1 text-3xl leading-none">{formatRupiah(total)}</p>
              {metode === 'TRANSFER' && bank && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-3.5 py-2.5">
                  <div>
                    <p className="text-xs font-bold">{bank.bank} • {bank.nomor}</p>
                    <p className="text-[10px] text-emerald-100/80">a.n. {bank.atas_nama}</p>
                  </div>
                  <button onClick={copyRekening} className="p-2 rounded-lg bg-white/10" aria-label="Salin nomor rekening">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
              {metode === 'QRIS' && channels.qris_url && (
                <div className="mt-3 rounded-xl bg-white p-3 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={channels.qris_url} alt="QRIS Pesantren" className="mx-auto max-h-52 rounded-lg" />
                </div>
              )}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--p-muted)]">
              Transfer <span className="font-bold text-[var(--p-ink)]">persis sejumlah nominal di atas</span>,
              lalu unggah screenshot/foto bukti di bawah ini. Petugas akan memeriksa dan mengonfirmasi.
            </p>
            <div className="mt-4">
              <UploadBukti submissionId={submissionId} onDone={handleFinish} />
            </div>
            <button
              onClick={handleClose}
              className="mt-3 w-full text-center text-[11px] font-bold text-[var(--p-muted)]"
            >
              Unggah nanti lewat menu Riwayat
            </button>
          </div>
        )}

        {/* Selesai */}
        {done && (
          <div className="mt-8 text-center pb-4">
            <span className="mx-auto flex w-16 h-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="w-8 h-8 text-[var(--p-emerald)]" />
            </span>
            <h3 className="portal-display mt-4 text-xl text-[var(--p-emerald-deep)]">Bukti terkirim</h3>
            <p className="mt-1.5 text-xs text-[var(--p-muted)] max-w-[17rem] mx-auto leading-relaxed">
              Pengajuan Anda sedang menunggu pemeriksaan petugas. Status bisa dipantau di menu Riwayat.
            </p>
            <button
              onClick={handleClose}
              className="mt-5 w-full rounded-2xl bg-[var(--p-emerald)] py-4 text-sm font-bold text-white"
            >
              Selesai
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TotalBar({ total }: { total: number }) {
  return (
    <div className="mt-4 flex items-center justify-between rounded-2xl bg-[var(--p-gold-soft)] border border-[var(--p-gold)]/20 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#7a5a17]">Total Dipilih</p>
      <p className="portal-display text-lg leading-none text-[#7a5a17]">{formatRupiah(total)}</p>
    </div>
  )
}
