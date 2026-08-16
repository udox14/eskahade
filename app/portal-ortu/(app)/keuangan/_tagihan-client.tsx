'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Bank, Buildings, CaretRight, CheckCircle, CircleNotch, Clock, Copy, Lightning, Money,
  QrCode, Receipt, X,
} from '@phosphor-icons/react'
import type { PortalPaymentChannels } from '@/lib/portal/data'
import { formatRupiah } from '@/lib/portal/format'
import { createSubmission } from './tagihan-actions'
import { allocatePortalFunds } from './actions'
import { UploadBukti } from './_upload-bukti'

export type TagihanItem = {
  key: string
  label: string
  sublabel: string | null
  nominal: number
}

export type UsppTagihanItem = TagihanItem & {
  sisaRupiah: number
  status: 'OPEN' | 'PARTIAL'
}

type Kategori = 'SPP' | 'NON_SPP'
type Step = 1 | 2 | 3

export function TagihanClient(props: {
  tampilkanSpp: boolean
  sppItems: TagihanItem[]
  nonSppItems: TagihanItem[]
  usppItems: UsppTagihanItem[]
  channels: PortalPaymentChannels
  walletBalance: number
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
          index="01"
          rise="portal-rise-1"
          icon={<Money className="w-5 h-5 text-[var(--p-ink)]" />}
          title="SPP Bulanan"
          subtitle="Syahriah pengajian & asrama"
          kategori="SPP"
          items={props.sppItems}
          walletBalance={props.walletBalance}
          pending={props.pendingSpp}
          pendingSudahUpload={props.pendingSppSudahUpload}
          onPay={() => setWizard('SPP')}
          emptyText="Alhamdulillah, SPP sudah lunas sampai bulan ini."
        />
      )}

      <BillCard
        index={props.tampilkanSpp ? '02' : '01'}
        rise="portal-rise-2"
        icon={<Buildings className="w-5 h-5 text-[var(--p-red)]" />}
        title="Biaya Tahunan (Non-SPP)"
        subtitle="Bangunan, kesehatan, EHB, ekskul"
        kategori="NON_SPP"
        items={props.nonSppItems}
        walletBalance={props.walletBalance}
        pending={props.pendingNonSpp}
        pendingSudahUpload={props.pendingNonSppSudahUpload}
        onPay={() => setWizard('NON_SPP')}
        emptyText="Tidak ada tagihan Non-SPP tersisa. Jazakumullah khairan."
      />

      {props.usppItems.length > 0 && (
        <UsppCard
          index={props.tampilkanSpp ? '03' : '02'}
          items={props.usppItems}
          walletBalance={props.walletBalance}
        />
      )}

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
  index: string
  rise: string
  icon: React.ReactNode
  title: string
  subtitle: string
  kategori: Kategori
  items: TagihanItem[]
  walletBalance: number
  pending: boolean
  pendingSudahUpload: boolean
  onPay: () => void
  emptyText: string
}) {
  const router = useRouter()
  const [quickPaying, startQuickPay] = useTransition()
  const total = props.items.reduce((sum, item) => sum + item.nominal, 0)
  const cukupSaldo = props.walletBalance >= total

  function handleQuickPay() {
    if (quickPaying) return
    startQuickPay(async () => {
      const result = await allocatePortalFunds({
        destination: props.kategori,
        amountRupiah: total,
        requestKey: crypto.randomUUID(),
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${props.title} berhasil dilunasi dari saldo titipan.`)
      router.refresh()
    })
  }

  return (
    <div className={`portal-rise ${props.rise} portal-card p-5`}>
      <div className="flex items-center gap-3">
        <span className="flex w-10 h-10 items-center justify-center bg-[var(--p-paper)] border border-[var(--p-line)] shrink-0">
          {props.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="portal-index text-[var(--p-muted)]">{props.index}</span>
            <h2 className="portal-display text-lg leading-tight text-[var(--p-ink)]">{props.title}</h2>
          </div>
          <p className="text-[11px] text-[var(--p-muted)]">{props.subtitle}</p>
        </div>
      </div>

      {props.items.length === 0 ? (
        <p className="mt-4 rounded-[var(--p-radius-md)] bg-[var(--p-success-soft)] border border-[#cde3d4] px-4 py-3 text-xs font-semibold text-[var(--p-success)]">
          {props.emptyText}
        </p>
      ) : (
        <>
          <div className="mt-4 max-h-44 overflow-y-auto pr-1 divide-y divide-[var(--p-line)]">
            {props.items.map(item => (
              <div key={item.key} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--p-ink)] truncate">{item.label}</p>
                  {item.sublabel && <p className="text-[10px] text-[var(--p-muted)]">{item.sublabel}</p>}
                </div>
                <p className="text-xs font-extrabold text-[var(--p-ink)] shrink-0 ml-3">{formatRupiah(item.nominal)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t-2 border-[var(--p-ink)] pt-3.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Total Tagihan</p>
              <p className="portal-display text-xl leading-none text-[var(--p-ink)]">{formatRupiah(total)}</p>
            </div>
            {props.pending ? (
              <Link
                href="/portal-ortu/keuangan?tab=riwayat"
                className="portal-badge portal-badge-warning !py-2.5 !px-4 !text-xs"
              >
                <Clock className="w-3.5 h-3.5" />
                {props.pendingSudahUpload ? 'Menunggu konfirmasi' : 'Lanjutkan upload'}
              </Link>
            ) : (
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex gap-2">
                  <button
                    onClick={handleQuickPay}
                    disabled={!cukupSaldo || quickPaying}
                    className="portal-btn portal-btn-outline !py-2.5 !px-3.5 !text-xs disabled:opacity-40"
                  >
                    {quickPaying ? <CircleNotch className="w-3.5 h-3.5 animate-spin" /> : <Lightning className="w-3.5 h-3.5" />}
                    Bayar Cepat
                  </button>
                  <button
                    onClick={props.onPay}
                    className="portal-btn portal-btn-accent"
                  >
                    Bayar <CaretRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {!cukupSaldo && (
                  <p className="text-[10px] text-[var(--p-muted)]">
                    Saldo titipan kurang {formatRupiah(total - props.walletBalance)} untuk Bayar Cepat.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Kartu USPP: bisa dilunasi penuh atau dicicil ────────────

function UsppCard(props: { index: string; items: UsppTagihanItem[]; walletBalance: number }) {
  const router = useRouter()
  const [paying, startPay] = useTransition()
  const [cicilOpen, setCicilOpen] = useState(false)
  const [cicilAmount, setCicilAmount] = useState(0)
  const sisaTotal = props.items.reduce((sum, item) => sum + item.sisaRupiah, 0)
  const cukupSaldo = props.walletBalance >= sisaTotal

  function bayar(amount: number) {
    if (paying || amount <= 0) return
    if (amount > sisaTotal) {
      toast.error('Nominal melebihi sisa tagihan USPP.')
      return
    }
    if (amount > props.walletBalance) {
      toast.error('Saldo titipan tidak mencukupi.')
      return
    }
    startPay(async () => {
      const result = await allocatePortalFunds({
        destination: 'USPP',
        amountRupiah: amount,
        requestKey: crypto.randomUUID(),
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Pembayaran USPP berhasil diproses dari saldo titipan.')
      setCicilOpen(false)
      setCicilAmount(0)
      router.refresh()
    })
  }

  return (
    <div className="portal-rise portal-rise-3 portal-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex w-10 h-10 items-center justify-center bg-[var(--p-paper)] border border-[var(--p-line)] shrink-0">
          <Receipt className="w-5 h-5 text-[var(--p-ink)]" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="portal-index text-[var(--p-muted)]">{props.index}</span>
            <h2 className="portal-display text-lg leading-tight text-[var(--p-ink)]">USPP / Uang Bangunan</h2>
          </div>
          <p className="text-[11px] text-[var(--p-muted)]">Bisa dilunasi sekaligus atau dicicil</p>
        </div>
      </div>

      <div className="mt-4 max-h-44 overflow-y-auto pr-1 divide-y divide-[var(--p-line)]">
        {props.items.map(item => (
          <div key={item.key} className="flex items-center justify-between py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--p-ink)] truncate">{item.label}</p>
              {item.status === 'PARTIAL' && (
                <span className="portal-badge portal-badge-warning mt-1 !py-0.5 !px-2 !text-[9px]">Cicilan berjalan</span>
              )}
            </div>
            <p className="text-xs font-extrabold text-[var(--p-ink)] shrink-0 ml-3">{formatRupiah(item.sisaRupiah)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t-2 border-[var(--p-ink)] pt-3.5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Sisa Tagihan</p>
          <p className="portal-display text-xl leading-none text-[var(--p-ink)]">{formatRupiah(sisaTotal)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-2">
            <button
              onClick={() => setCicilOpen(v => !v)}
              className="portal-btn portal-btn-outline !py-2.5 !px-3.5 !text-xs"
            >
              Cicil
            </button>
            <button
              onClick={() => bayar(sisaTotal)}
              disabled={!cukupSaldo || paying}
              className="portal-btn portal-btn-accent disabled:opacity-40"
            >
              {paying ? <CircleNotch className="w-3.5 h-3.5 animate-spin" /> : <Lightning className="w-3.5 h-3.5" />}
              Bayar Cepat
            </button>
          </div>
          {!cukupSaldo && (
            <p className="text-[10px] text-[var(--p-muted)]">
              Saldo titipan kurang {formatRupiah(sisaTotal - props.walletBalance)} untuk lunas sekaligus.
            </p>
          )}
        </div>
      </div>

      {cicilOpen && (
        <div className="mt-3.5 rounded-[var(--p-radius-md)] border border-[var(--p-line)] bg-white p-3.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Nominal Cicilan (Rp)</label>
          <div className="mt-1.5 flex gap-2">
            <input
              type="number"
              min={1000}
              step={1000}
              max={sisaTotal}
              value={cicilAmount || ''}
              onChange={e => setCicilAmount(Number(e.target.value))}
              className="portal-field"
              placeholder="Nominal yang ingin dibayar..."
            />
            <button
              onClick={() => bayar(cicilAmount)}
              disabled={paying || cicilAmount <= 0}
              className="portal-btn portal-btn-primary shrink-0"
            >
              {paying ? <CircleNotch className="w-3.5 h-3.5 animate-spin" /> : 'Bayar'}
            </button>
          </div>
        </div>
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

  function handleLihatRiwayat() {
    onClose()
    router.push('/portal-ortu/keuangan?tab=riwayat')
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
      <button aria-label="Tutup" onClick={handleClose} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div className="portal-theme relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-t-[var(--p-radius-lg)] bg-[var(--p-paper)] p-5 pb-8 portal-rise">
        {/* Header modal */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--p-muted)]">
              {kategori === 'SPP' ? 'Bayar SPP Bulanan' : 'Bayar Non-SPP'}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              {[1, 2, 3].map(n => (
                <span key={n} className="flex items-center gap-1.5">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                      step >= n ? 'bg-[var(--p-ink)] text-white' : 'bg-[var(--p-line)] text-[var(--p-muted)]'
                    }`}
                  >
                    {n}
                  </span>
                  {n < 3 && <span className={`h-[2px] w-4 ${step > n ? 'bg-[var(--p-ink)]' : 'bg-[var(--p-line)]'}`} />}
                </span>
              ))}
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-[var(--p-radius-sm)] bg-white border border-[var(--p-line)]" aria-label="Tutup">
            <X className="w-4 h-4 text-[var(--p-muted)]" />
          </button>
        </div>

        {/* Step 1: pilih item */}
        {step === 1 && (
          <div className="mt-5 portal-step" key="step-1">
            <h3 className="portal-display text-xl text-[var(--p-ink)]">
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
                    className={`w-full flex items-center gap-3 rounded-[var(--p-radius-md)] border px-4 py-3.5 text-left transition ${
                      active
                        ? 'border-[var(--p-ink)] bg-white'
                        : 'border-[var(--p-line)] bg-white/60 opacity-70'
                    }`}
                  >
                    <span
                      className={`flex w-5 h-5 items-center justify-center rounded-[4px] border-2 shrink-0 ${
                        active ? 'border-[var(--p-ink)] bg-[var(--p-ink)]' : 'border-[var(--p-line)]'
                      }`}
                    >
                      {active && <CheckCircle className="w-4 h-4 text-white" weight="fill" />}
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
              className="portal-btn portal-btn-primary w-full mt-3"
            >
              Lanjut Pilih Metode
            </button>
          </div>
        )}

        {/* Step 2: metode */}
        {step === 2 && (
          <div className="mt-5 portal-step" key="step-2">
            <h3 className="portal-display text-xl text-[var(--p-ink)]">Metode pembayaran</h3>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                disabled={!transferAvailable}
                onClick={() => setMetode('TRANSFER')}
                className={`rounded-[var(--p-radius-md)] border p-4 text-left transition disabled:opacity-40 ${
                  metode === 'TRANSFER' ? 'border-[var(--p-ink)] bg-white' : 'border-[var(--p-line)] bg-white/60'
                }`}
              >
                <Bank className="w-5 h-5 text-[var(--p-ink)]" />
                <p className="mt-2 text-sm font-bold text-[var(--p-ink)]">Transfer Bank</p>
                <p className="text-[10px] text-[var(--p-muted)]">Ke rekening pesantren</p>
              </button>
              <button
                disabled={!qrisAvailable}
                onClick={() => setMetode('QRIS')}
                className={`rounded-[var(--p-radius-md)] border p-4 text-left transition disabled:opacity-40 ${
                  metode === 'QRIS' ? 'border-[var(--p-ink)] bg-white' : 'border-[var(--p-line)] bg-white/60'
                }`}
              >
                <QrCode className="w-5 h-5 text-[var(--p-red)]" />
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
                    className={`w-full rounded-[var(--p-radius-md)] border px-4 py-3.5 text-left transition ${
                      bankId === b.id ? 'border-[var(--p-ink)] bg-white' : 'border-[var(--p-line)] bg-white/60'
                    }`}
                  >
                    <p className="text-sm font-extrabold text-[var(--p-ink)]">{b.bank}</p>
                    <p className="text-xs font-semibold text-[var(--p-ink)] tracking-wide">{b.nomor}</p>
                    <p className="text-[10px] text-[var(--p-muted)]">a.n. {b.atas_nama}</p>
                  </button>
                ))}
              </div>
            )}

            {metode === 'QRIS' && channels.qris_url && (
              <div className="mt-4 rounded-[var(--p-radius-md)] bg-white border border-[var(--p-line)] p-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={channels.qris_url} alt="QRIS Pesantren" className="mx-auto max-h-64 rounded-[var(--p-radius-sm)]" />
                <p className="mt-2 text-[11px] text-[var(--p-muted)]">
                  Scan lalu bayar persis sejumlah total di bawah.
                </p>
              </div>
            )}

            <TotalBar total={total} />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="portal-btn portal-btn-outline"
              >
                Kembali
              </button>
              <button
                disabled={creating || (metode === 'TRANSFER' && !bank)}
                onClick={handleCreate}
                className="portal-btn portal-btn-accent flex-1"
              >
                {creating && <CircleNotch className="w-4 h-4 animate-spin" />}
                {creating ? 'Membuat pengajuan…' : 'Buat Pengajuan & Bayar'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: instruksi + upload bukti */}
        {step === 3 && submissionId && !done && (
          <div className="mt-5 portal-step" key="step-3">
            <h3 className="portal-display text-xl text-[var(--p-ink)]">
              Bayar lalu unggah bukti
            </h3>
            <div className="mt-3 rounded-[var(--p-radius-md)] bg-[var(--p-ink)] p-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                Nominal yang harus dibayar
              </p>
              <p className="portal-display mt-1 text-3xl leading-none">{formatRupiah(total)}</p>
              {metode === 'TRANSFER' && bank && (
                <div className="mt-3 flex items-center justify-between rounded-[var(--p-radius-sm)] bg-white/10 px-3.5 py-2.5">
                  <div>
                    <p className="text-xs font-bold">{bank.bank} • {bank.nomor}</p>
                    <p className="text-[10px] text-white/65">a.n. {bank.atas_nama}</p>
                  </div>
                  <button onClick={copyRekening} className="p-2 rounded-[var(--p-radius-sm)] bg-white/10" aria-label="Salin nomor rekening">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
              {metode === 'QRIS' && channels.qris_url && (
                <div className="mt-3 rounded-[var(--p-radius-sm)] bg-white p-3 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={channels.qris_url} alt="QRIS Pesantren" className="mx-auto max-h-52 rounded-[4px]" />
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
              onClick={handleLihatRiwayat}
              className="mt-3 w-full text-center text-[11px] font-bold text-[var(--p-muted)]"
            >
              Unggah nanti lewat tab Riwayat
            </button>
          </div>
        )}

        {/* Selesai */}
        {done && (
          <div className="mt-8 text-center pb-4 portal-step">
            <span className="mx-auto flex w-16 h-16 items-center justify-center rounded-full bg-[var(--p-success-soft)]">
              <CheckCircle className="w-8 h-8 text-[var(--p-success)]" weight="fill" />
            </span>
            <h3 className="portal-display mt-4 text-xl text-[var(--p-ink)]">Bukti terkirim</h3>
            <p className="mt-1.5 text-xs text-[var(--p-muted)] max-w-[17rem] mx-auto leading-relaxed">
              Pengajuan Anda sedang menunggu pemeriksaan petugas. Status bisa dipantau di tab Riwayat.
            </p>
            <button
              onClick={handleClose}
              className="portal-btn portal-btn-primary w-full mt-5"
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
    <div className="mt-4 flex items-center justify-between rounded-[var(--p-radius-md)] border-l-4 border-[var(--p-red)] bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Total Dipilih</p>
      <p className="portal-display text-lg leading-none text-[var(--p-ink)]">{formatRupiah(total)}</p>
    </div>
  )
}
