'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Bank, Buildings, CalendarBlank, CaretLeft, CaretRight, CaretRight as ChevronRight, CheckCircle,
  CircleNotch, Clock, Copy, ForkKnife, Lightning, Money, QrCode, Receipt, TShirt, X,
} from '@phosphor-icons/react'
import type { PortalPaymentChannels } from '@/lib/portal/data'
import type { SppMonthCell, SppMonthStatus } from '@/lib/spp/tunggakan'
import type { NonSppOutstanding, NonSppOutstandingItem, NonSppJenis } from '@/lib/keuangan/non-spp-outstanding'
import { formatRupiah } from '@/lib/portal/format'
import { BottomSheet } from '../../_components/bottom-sheet'
import { RupiahInput } from '../../_components/rupiah-input'
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

export type ServiceBillSummary = {
  items: TagihanItem[]
  totalOutstanding: number
  exempted: boolean
}

type Kategori = 'SPP' | 'NON_SPP'
type Step = 1 | 2 | 3
type ModalKind = 'spp' | 'uspp' | 'makan' | 'laundry' | null

const NON_SPP_LABEL: Record<NonSppJenis, string> = {
  BANGUNAN: 'Uang Bangunan',
  KESEHATAN: 'Kesehatan',
  EHB: 'EHB (Evaluasi Hasil Belajar)',
  EKSKUL: 'Ekstrakurikuler',
}

function statusChipMeta(status: SppMonthStatus | 'LUNAS' | 'BELUM_LUNAS') {
  switch (status) {
    case 'LUNAS':
      return { label: 'Lunas', cls: 'portal-badge-success' }
    case 'DIBEBASKAN':
      return { label: 'Dibebaskan', cls: 'portal-badge-neutral' }
    case 'DITIADAKAN':
      return { label: 'Ditiadakan', cls: 'portal-badge-neutral' }
    case 'BELUM_ADA_TAGIHAN':
      return { label: 'Belum ada tagihan', cls: 'portal-badge-neutral' }
    default:
      return { label: 'Belum Lunas', cls: 'portal-badge-warning' }
  }
}

export function TagihanClient(props: {
  tahun: number
  bulan: number
  tampilkanSpp: boolean
  sppCell: SppMonthCell | null
  sppItems: TagihanItem[]
  sppTunggakanTotal: number
  nonSppItems: TagihanItem[]
  nonSppOutstanding: NonSppOutstanding | null
  nonSppTahunanJenis: readonly NonSppJenis[]
  usppItems: UsppTagihanItem[]
  makanSummary: ServiceBillSummary
  laundrySummary: ServiceBillSummary
  channels: PortalPaymentChannels
  walletBalance: number
  pendingSpp: boolean
  pendingSppSudahUpload: boolean
  pendingNonSpp: boolean
  pendingNonSppSudahUpload: boolean
}) {
  const [modal, setModal] = useState<ModalKind>(null)
  const [nonSppJenisModal, setNonSppJenisModal] = useState<NonSppJenis | null>(null)
  const [wizard, setWizard] = useState<Kategori | null>(null)

  const tahunanItems = props.nonSppOutstanding?.items.filter(item => props.nonSppTahunanJenis.includes(item.jenis)) || []
  const bangunanItem = props.nonSppOutstanding?.items.find(item => item.jenis === 'BANGUNAN') || null
  const nonSppOpenItem = props.nonSppOutstanding?.items.find(item => item.jenis === nonSppJenisModal) || null

  function openWizard(kategori: Kategori) {
    setModal(null)
    setWizard(kategori)
  }

  function closeWizard() {
    setWizard(null)
    setNonSppJenisModal(null)
  }

  return (
    <div className="space-y-4">
      {props.tampilkanSpp && (
        <MonthSelector tahun={props.tahun} bulan={props.bulan} />
      )}

      {/* Grup Bulanan */}
      <GroupCard index="01" title="Bulanan" subtitle="SPP, uang makan, dan laundry">
        {props.tampilkanSpp && props.sppCell && (
          <TagihanRow
            icon={<Money className="w-4.5 h-4.5 text-[var(--p-ink)]" />}
            label={`SPP ${props.sppCell.nama_bulan} ${props.tahun}`}
            status={statusChipMeta(props.sppCell.status)}
            value={props.sppCell.status === 'LUNAS' || props.sppCell.status === 'BELUM_LUNAS' ? formatRupiah(props.sppCell.nominal) : null}
            onClick={() => setModal('spp')}
          />
        )}
        <TagihanRow
          icon={<ForkKnife className="w-4.5 h-4.5 text-[var(--p-ink)]" />}
          label="Uang Makan"
          status={statusChipMeta(props.makanSummary.exempted ? 'DIBEBASKAN' : props.makanSummary.totalOutstanding > 0 ? 'BELUM_LUNAS' : 'LUNAS')}
          value={!props.makanSummary.exempted && props.makanSummary.totalOutstanding > 0 ? formatRupiah(props.makanSummary.totalOutstanding) : null}
          onClick={() => setModal('makan')}
        />
        <TagihanRow
          icon={<TShirt className="w-4.5 h-4.5 text-[var(--p-ink)]" />}
          label="Uang Laundry"
          status={statusChipMeta(props.laundrySummary.exempted ? 'DIBEBASKAN' : props.laundrySummary.totalOutstanding > 0 ? 'BELUM_LUNAS' : 'LUNAS')}
          value={!props.laundrySummary.exempted && props.laundrySummary.totalOutstanding > 0 ? formatRupiah(props.laundrySummary.totalOutstanding) : null}
          onClick={() => setModal('laundry')}
        />
      </GroupCard>

      {/* Grup Tahunan — tiap jenis independen, bisa dibayar satu-satu */}
      <GroupCard index="02" title="Tahunan" subtitle="Kesehatan, EHB, Ekstrakurikuler">
        {tahunanItems.length > 0 ? (
          tahunanItems.map(item => (
            <TagihanRow
              key={item.jenis}
              icon={<Buildings className="w-4.5 h-4.5 text-[var(--p-ink)]" />}
              label={NON_SPP_LABEL[item.jenis]}
              status={statusChipMeta(item.exempted ? 'DIBEBASKAN' : item.sisa > 0 ? 'BELUM_LUNAS' : 'LUNAS')}
              value={!item.exempted ? formatRupiah(item.sisa > 0 ? item.sisa : item.tarif) : null}
              onClick={() => setNonSppJenisModal(item.jenis)}
            />
          ))
        ) : (
          <p className="px-1 py-3 text-xs text-[var(--p-muted)]">Belum ada tagihan tahunan aktif.</p>
        )}
      </GroupCard>

      {/* Grup Lainnya */}
      {(bangunanItem || props.usppItems.length > 0) && (
        <GroupCard index="03" title="Lainnya" subtitle="Uang bangunan & USPP">
          {bangunanItem && (
            <TagihanRow
              icon={<Buildings className="w-4.5 h-4.5 text-[var(--p-red)]" />}
              label={NON_SPP_LABEL.BANGUNAN}
              status={statusChipMeta(bangunanItem.exempted ? 'DIBEBASKAN' : bangunanItem.sisa > 0 ? 'BELUM_LUNAS' : 'LUNAS')}
              value={!bangunanItem.exempted ? formatRupiah(bangunanItem.sisa > 0 ? bangunanItem.sisa : bangunanItem.tarif) : null}
              onClick={() => setNonSppJenisModal('BANGUNAN')}
            />
          )}
          {props.usppItems.length > 0 && (
            <TagihanRow
              icon={<Receipt className="w-4.5 h-4.5 text-[var(--p-ink)]" />}
              label="USPP"
              status={statusChipMeta('BELUM_LUNAS')}
              value={formatRupiah(props.usppItems.reduce((sum, item) => sum + item.sisaRupiah, 0))}
              onClick={() => setModal('uspp')}
            />
          )}
        </GroupCard>
      )}

      {/* Modal SPP */}
      {props.tampilkanSpp && props.sppCell && (
        <SppDetailModal
          open={modal === 'spp'}
          onClose={() => setModal(null)}
          cell={props.sppCell}
          tunggakanTotal={props.sppTunggakanTotal}
          walletBalance={props.walletBalance}
          pending={props.pendingSpp}
          pendingSudahUpload={props.pendingSppSudahUpload}
          onOpenWizard={() => openWizard('SPP')}
        />
      )}

      {/* Modal Non-SPP — satu jenis per modal, bisa dibayar terpisah */}
      <NonSppItemDetailModal
        open={!!nonSppJenisModal}
        onClose={() => setNonSppJenisModal(null)}
        item={nonSppOpenItem}
        walletBalance={props.walletBalance}
        pending={props.pendingNonSpp}
        pendingSudahUpload={props.pendingNonSppSudahUpload}
        onOpenWizard={() => openWizard('NON_SPP')}
      />

      {/* Modal USPP */}
      <UsppDetailModal
        open={modal === 'uspp'}
        onClose={() => setModal(null)}
        items={props.usppItems}
        walletBalance={props.walletBalance}
      />

      {/* Modal tagihan Makan / Laundry */}
      <ServiceBillDetailModal
        open={modal === 'makan'}
        onClose={() => setModal(null)}
        title="Uang Makan"
        destination="MAKAN"
        summary={props.makanSummary}
        walletBalance={props.walletBalance}
      />
      <ServiceBillDetailModal
        open={modal === 'laundry'}
        onClose={() => setModal(null)}
        title="Uang Laundry"
        destination="LAUNDRY"
        summary={props.laundrySummary}
        walletBalance={props.walletBalance}
      />

      {wizard && (
        <WizardModal
          kategori={wizard}
          items={
            wizard === 'SPP'
              ? props.sppItems
              : nonSppJenisModal
                ? props.nonSppItems.filter(item => item.label === NON_SPP_LABEL[nonSppJenisModal])
                : props.nonSppItems
          }
          channels={props.channels}
          onClose={closeWizard}
        />
      )}
    </div>
  )
}

// ── Komponen tampilan ───────────────────────────────────────

function GroupCard(props: { index: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="portal-card p-4">
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="portal-index text-[var(--p-muted)]">{props.index}</span>
        <div>
          <h2 className="portal-display text-base leading-tight text-[var(--p-ink)]">{props.title}</h2>
          <p className="text-[10px] text-[var(--p-muted)]">{props.subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-[var(--p-line)]">{props.children}</div>
    </div>
  )
}

function TagihanRow(props: {
  icon: React.ReactNode
  label: string
  status: { label: string; cls: string }
  value: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="w-full flex items-center gap-3 py-3 px-1 text-left transition active:scale-[0.99]"
    >
      <span className="flex w-9 h-9 shrink-0 items-center justify-center bg-[var(--p-paper)] border border-[var(--p-line)]">
        {props.icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-bold text-[var(--p-ink)] truncate">{props.label}</span>
        <span className={`portal-badge ${props.status.cls} mt-1 !py-0.5 !px-2 !text-[9px]`}>{props.status.label}</span>
      </span>
      {props.value && <span className="text-xs font-extrabold text-[var(--p-ink)] shrink-0">{props.value}</span>}
      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[var(--p-muted)]" />
    </button>
  )
}

function MonthSelector({ tahun, bulan }: { tahun: number; bulan: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function go(delta: number) {
    let nextBulan = bulan + delta
    let nextTahun = tahun
    if (nextBulan < 1) { nextBulan = 12; nextTahun -= 1 }
    if (nextBulan > 12) { nextBulan = 1; nextTahun += 1 }
    startTransition(() => {
      router.push(`/portal-ortu/keuangan?tab=tagihan&bulan=${nextTahun}-${String(nextBulan).padStart(2, '0')}`)
    })
  }

  const label = new Date(tahun, bulan - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  return (
    <div className="flex items-center justify-between rounded-[var(--p-radius-md)] border border-[var(--p-line)] bg-white px-3 py-2.5">
      <button type="button" onClick={() => go(-1)} disabled={pending} className="p-1.5 disabled:opacity-40" aria-label="Bulan sebelumnya">
        <CaretLeft className="w-4 h-4 text-[var(--p-ink)]" />
      </button>
      <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--p-ink)]">
        {pending ? <CircleNotch className="w-3.5 h-3.5 animate-spin" /> : <CalendarBlank className="w-3.5 h-3.5" />}
        {label}
      </span>
      <button type="button" onClick={() => go(1)} disabled={pending} className="p-1.5 disabled:opacity-40" aria-label="Bulan berikutnya">
        <CaretRight className="w-4 h-4 text-[var(--p-ink)]" />
      </button>
    </div>
  )
}

// ── Modal detail SPP ─────────────────────────────────────────

function SppDetailModal(props: {
  open: boolean
  onClose: () => void
  cell: SppMonthCell
  tunggakanTotal: number
  walletBalance: number
  pending: boolean
  pendingSudahUpload: boolean
  onOpenWizard: () => void
}) {
  const router = useRouter()
  const [paying, startPay] = useTransition()
  const belumLunas = props.cell.status === 'BELUM_LUNAS'
  const cukupSaldo = props.walletBalance >= props.tunggakanTotal

  function bayarCepat() {
    if (paying) return
    startPay(async () => {
      const result = await allocatePortalFunds({ destination: 'SPP', amountRupiah: props.tunggakanTotal, requestKey: crypto.randomUUID() })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('SPP berhasil dilunasi dari saldo titipan.')
      props.onClose()
      router.refresh()
    })
  }

  return (
    <BottomSheet open={props.open} onClose={props.onClose} title={`SPP ${props.cell.nama_bulan}`}>
      <div className={`rounded-[var(--p-radius-md)] border px-4 py-3 ${belumLunas ? 'border-[#f0dcae] bg-[var(--p-warning-soft)]' : 'border-[var(--p-line)] bg-[var(--p-paper)]'}`}>
        <p className={`portal-badge ${statusChipMeta(props.cell.status).cls}`}>{statusChipMeta(props.cell.status).label}</p>
        {(props.cell.status === 'LUNAS' || belumLunas) && (
          <p className="portal-display mt-2 text-2xl leading-none text-[var(--p-ink)]">{formatRupiah(props.cell.nominal)}</p>
        )}
        {props.cell.status === 'LUNAS' && props.cell.tanggalBayar && (
          <p className="mt-1 text-[11px] text-[var(--p-muted)]">Dibayar {new Date(props.cell.tanggalBayar).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        )}
        {props.cell.status === 'DIBEBASKAN' && (
          <p className="mt-1 text-[11px] text-[var(--p-muted)]">Dibebaskan dari SPP — tidak ada tagihan.</p>
        )}
      </div>

      {belumLunas && (
        <>
          {props.tunggakanTotal > props.cell.nominal && (
            <p className="mt-3 text-[11px] text-[var(--p-muted)] leading-relaxed">
              Ada tunggakan SPP bulan lain juga. Total keseluruhan tunggakan SPP: <span className="font-bold text-[var(--p-ink)]">{formatRupiah(props.tunggakanTotal)}</span>. Bayar Cepat akan melunasi semuanya sekaligus.
            </p>
          )}

          {props.pending ? (
            <div className="mt-4 rounded-[var(--p-radius-md)] bg-[var(--p-warning-soft)] border border-[#f0dcae] px-4 py-3 text-xs font-semibold text-[var(--p-ink)]">
              <Clock className="w-3.5 h-3.5 inline mr-1.5" />
              {props.pendingSudahUpload ? 'Menunggu konfirmasi petugas.' : 'Pengajuan dibuat, lanjutkan upload bukti di tab Riwayat.'}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <button
                onClick={bayarCepat}
                disabled={paying || !cukupSaldo}
                className="portal-btn portal-btn-accent w-full disabled:opacity-40"
              >
                {paying ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Lightning className="w-4 h-4" />}
                Bayar Cepat {formatRupiah(props.tunggakanTotal)}
              </button>
              {!cukupSaldo && (
                <p className="text-center text-[10px] text-[var(--p-muted)]">Saldo titipan tidak cukup untuk Bayar Cepat.</p>
              )}
              <button onClick={props.onOpenWizard} className="portal-btn portal-btn-outline w-full">
                Transfer Bank / QRIS
              </button>
            </div>
          )}
        </>
      )}
    </BottomSheet>
  )
}

// ── Modal detail Non-SPP — satu jenis (Bangunan/Kesehatan/EHB/Ekskul) per
// modal, bisa dibayar terpisah dari jenis lain ────────────────────────────

function NonSppItemDetailModal(props: {
  open: boolean
  onClose: () => void
  item: NonSppOutstandingItem | null
  walletBalance: number
  pending: boolean
  pendingSudahUpload: boolean
  onOpenWizard: () => void
}) {
  const router = useRouter()
  const [paying, startPay] = useTransition()
  const item = props.item
  const sisa = item?.sisa ?? 0
  const exempted = item?.exempted ?? false
  const cukupSaldo = props.walletBalance >= sisa

  function bayarCepat() {
    if (paying || !item || sisa <= 0) return
    startPay(async () => {
      const result = await allocatePortalFunds({ destination: 'NON_SPP', jenis: item.jenis, amountRupiah: sisa, requestKey: crypto.randomUUID() })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${NON_SPP_LABEL[item.jenis]} berhasil dilunasi dari saldo titipan.`)
      props.onClose()
      router.refresh()
    })
  }

  return (
    <BottomSheet open={props.open} onClose={props.onClose} title={item ? NON_SPP_LABEL[item.jenis] : 'Tagihan Non-SPP'}>
      {!item ? (
        <p className="text-xs text-[var(--p-muted)]">Tidak ada tagihan.</p>
      ) : exempted ? (
        <p className="rounded-[var(--p-radius-md)] bg-[var(--p-success-soft)] border border-[#cde3d4] px-4 py-3 text-xs font-semibold text-[var(--p-success)]">
          Dibebaskan dari {NON_SPP_LABEL[item.jenis].toLowerCase()} — tidak ada tagihan.
        </p>
      ) : sisa <= 0 ? (
        <p className="rounded-[var(--p-radius-md)] bg-[var(--p-success-soft)] border border-[#cde3d4] px-4 py-3 text-xs font-semibold text-[var(--p-success)]">
          Alhamdulillah, {NON_SPP_LABEL[item.jenis].toLowerCase()} sudah lunas.
        </p>
      ) : (
        <>
          <div className="rounded-[var(--p-radius-md)] border border-[var(--p-line)] bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Sisa Tagihan</p>
            <p className="portal-display mt-1 text-2xl leading-none text-[var(--p-ink)]">{formatRupiah(sisa)}</p>
          </div>
          {props.pending ? (
            <div className="mt-4 rounded-[var(--p-radius-md)] bg-[var(--p-warning-soft)] border border-[#f0dcae] px-4 py-3 text-xs font-semibold text-[var(--p-ink)]">
              <Clock className="w-3.5 h-3.5 inline mr-1.5" />
              {props.pendingSudahUpload ? 'Menunggu konfirmasi petugas.' : 'Pengajuan dibuat, lanjutkan upload bukti di tab Riwayat.'}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <button
                onClick={bayarCepat}
                disabled={paying || !cukupSaldo}
                className="portal-btn portal-btn-accent w-full disabled:opacity-40"
              >
                {paying ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Lightning className="w-4 h-4" />}
                Bayar Cepat {formatRupiah(sisa)}
              </button>
              {!cukupSaldo && (
                <p className="text-center text-[10px] text-[var(--p-muted)]">Saldo titipan tidak cukup untuk Bayar Cepat.</p>
              )}
              <button onClick={props.onOpenWizard} className="portal-btn portal-btn-outline w-full">
                Transfer Bank / QRIS
              </button>
            </div>
          )}
        </>
      )}
    </BottomSheet>
  )
}

// ── Modal detail tagihan Makan / Laundry (lunas penuh per bulan) ──

function ServiceBillDetailModal(props: {
  open: boolean
  onClose: () => void
  title: string
  destination: 'MAKAN' | 'LAUNDRY'
  summary: ServiceBillSummary
  walletBalance: number
}) {
  const router = useRouter()
  const [paying, startPay] = useTransition()
  const belumLunas = !props.summary.exempted && props.summary.totalOutstanding > 0
  const cukupSaldo = props.walletBalance >= props.summary.totalOutstanding

  function bayarCepat() {
    if (paying || !belumLunas) return
    startPay(async () => {
      const result = await allocatePortalFunds({
        destination: props.destination,
        amountRupiah: props.summary.totalOutstanding,
        requestKey: crypto.randomUUID(),
      })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`${props.title} berhasil dilunasi dari saldo titipan.`)
      props.onClose()
      router.refresh()
    })
  }

  return (
    <BottomSheet open={props.open} onClose={props.onClose} title={props.title}>
      {belumLunas ? (
        <>
          <div className="divide-y divide-[var(--p-line)] rounded-[var(--p-radius-md)] border border-[var(--p-line)] bg-white px-4">
            {props.summary.items.map(item => (
              <div key={item.key} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--p-ink)] truncate">{item.label}</p>
                  {item.sublabel && <p className="text-[10px] text-[var(--p-muted)]">{item.sublabel}</p>}
                </div>
                <p className="text-xs font-extrabold text-[var(--p-ink)] shrink-0 ml-3">{formatRupiah(item.nominal)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <button
              onClick={bayarCepat}
              disabled={paying || !cukupSaldo}
              className="portal-btn portal-btn-accent w-full disabled:opacity-40"
            >
              {paying ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Lightning className="w-4 h-4" />}
              Bayar Cepat {formatRupiah(props.summary.totalOutstanding)}
            </button>
            {!cukupSaldo && (
              <p className="text-center text-[10px] text-[var(--p-muted)]">Saldo titipan tidak cukup untuk Bayar Cepat.</p>
            )}
          </div>
        </>
      ) : (
        <p className="rounded-[var(--p-radius-md)] bg-[var(--p-success-soft)] border border-[#cde3d4] px-4 py-3 text-xs font-semibold text-[var(--p-success)]">
          {props.summary.exempted
            ? `Dibebaskan dari ${props.title.toLowerCase()} — tidak ada tagihan.`
            : `Alhamdulillah, ${props.title.toLowerCase()} sudah lunas.`}
        </p>
      )}
    </BottomSheet>
  )
}

// ── Modal detail USPP: bisa dilunasi penuh atau dicicil ───────

function UsppDetailModal(props: { open: boolean; onClose: () => void; items: UsppTagihanItem[]; walletBalance: number }) {
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
      const result = await allocatePortalFunds({ destination: 'USPP', amountRupiah: amount, requestKey: crypto.randomUUID() })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Pembayaran USPP berhasil diproses dari saldo titipan.')
      setCicilOpen(false)
      setCicilAmount(0)
      props.onClose()
      router.refresh()
    })
  }

  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="USPP">
      <div className="divide-y divide-[var(--p-line)] rounded-[var(--p-radius-md)] border border-[var(--p-line)] bg-white px-4">
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

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Sisa Tagihan</p>
          <p className="portal-display text-xl leading-none text-[var(--p-ink)]">{formatRupiah(sisaTotal)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCicilOpen(v => !v)} className="portal-btn portal-btn-outline !py-2.5 !px-3.5 !text-xs">
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
      </div>
      {!cukupSaldo && (
        <p className="mt-1.5 text-right text-[10px] text-[var(--p-muted)]">Saldo titipan kurang {formatRupiah(sisaTotal - props.walletBalance)} untuk lunas sekaligus.</p>
      )}

      {cicilOpen && (
        <div className="mt-3.5 rounded-[var(--p-radius-md)] border border-[var(--p-line)] bg-white p-3.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--p-muted)]">Nominal Cicilan</label>
          <div className="mt-1.5 flex gap-2">
            <RupiahInput value={cicilAmount} onChange={setCicilAmount} max={sisaTotal} placeholder="Nominal yang ingin dibayar..." />
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
    </BottomSheet>
  )
}

// ── Wizard 3 langkah (transfer/QRIS manual) ───────────────────

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
