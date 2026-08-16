import { requirePortalSessionStrict } from '@/lib/portal/session'
import { financeQuery as query, financeQueryOne as queryOne, query as mainQuery } from '@/lib/db'
import { syncFinanceStudentSnapshot, syncFinanceStudentsByIds, financeStudentIdsForGuardian } from '@/lib/finance/snapshots'
import {
  syncPortalSppBills, syncPortalNonSppBills, getPortalOpenBills, getPortalOpenUsppBills,
} from '@/lib/finance/portal-bills-sync'
import { getOpenServiceBills, getServiceArrearsHistoris } from '@/lib/finance/service-billing'
import { getPaymentChannels, getPendingSubmission, getRiwayatSubmissions } from '@/lib/portal/data'
import { getPortalAllocationHistory } from '@/lib/finance/portal-history'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { getSppMonthlyGrid, getTunggakanSppSantri } from '@/lib/spp/tunggakan'
import { getExemptionsForSantri } from '@/lib/finance/exemptions'
import { getNonSppOutstandingSantri, NON_SPP_JENIS_TAHUNAN } from '@/lib/keuangan/non-spp-outstanding'
import { FinanceClient } from './_finance-client'
import { TagihanClient, type TagihanItem, type UsppTagihanItem, type ServiceBillSummary } from './_tagihan-client'
import { RiwayatClient, type RiwayatItem, type WithdrawalItem } from './_riwayat-client'
import { KeuanganTabBar, type KeuanganTab } from './_tab-bar'
import { switchPortalStudent } from './switch-actions'
import { SwitchStudentButton } from './_switch-student-button'
import { IsiSaldoTrigger } from './_isi-saldo-trigger'
import { PortalPageHeader } from '../../_components/page-header'
import { formatRupiah } from '@/lib/portal/format'
import { Wallet } from '@phosphor-icons/react/dist/ssr'

export const dynamic = 'force-dynamic'

function parseDetail(detailJson: string): string[] {
  try {
    const parsed = JSON.parse(detailJson)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item: any) => String(item.title || item.jenis_biaya || ''))
  } catch {
    return []
  }
}

export default async function PortalKeuanganPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; bulan?: string }>
}) {
  const { tab: rawTab, bulan: rawBulan } = await searchParams
  const tab: KeuanganTab = rawTab === 'tagihan' || rawTab === 'riwayat' ? rawTab : 'saldo'

  const now = new Date()
  const bulanMatch = /^(\d{4})-(\d{2})$/.exec(rawBulan || '')
  const selectedTahun = bulanMatch ? Number(bulanMatch[1]) : now.getFullYear()
  const selectedBulan = bulanMatch ? Number(bulanMatch[2]) : now.getMonth() + 1

  const session = await requirePortalSessionStrict()
  await syncFinanceStudentSnapshot(session.santri_id)

  const balances = await query<{ wallet_kind: string; balance_rupiah: number }>(
    `SELECT wallet_kind,balance_rupiah FROM finance_student_wallets WHERE santri_id=? ORDER BY wallet_kind`,
    [session.santri_id]
  )
  const balanceOf = (kind: string) => Number(balances.find(row => row.wallet_kind === kind)?.balance_rupiah || 0)
  const titipanBalance = balanceOf('TITIPAN')
  const jajanBalance = balanceOf('JAJAN')

  const methods = (process.env.DUITKU_PAYMENT_METHODS || '').split(',').map(x => x.trim()).filter(Boolean)
  const qrisMethod = process.env.DUITKU_QRIS_METHOD || null

  if (session.guardian_id) await syncFinanceStudentsByIds(await financeStudentIdsForGuardian(session.guardian_id))

  const children = session.guardian_id
    ? await query<{ id: string; nama_lengkap: string }>(
        `SELECT s.santri_id id,s.full_name nama_lengkap FROM finance_guardian_students gs JOIN finance_student_snapshots s ON s.santri_id=gs.santri_id WHERE gs.guardian_id=? AND s.status_global='aktif' ORDER BY s.full_name`,
        [session.guardian_id]
      )
    : []

  // Badge murah untuk tab bar — dihitung tanpa side-effect sync, aman dipanggil selalu.
  const [openBillCount, pendingCount] = await Promise.all([
    query<{ count: number }>(
      `SELECT COUNT(*) count FROM finance_bills WHERE santri_id=? AND status='OPEN' AND period_key LIKE 'PORTAL_%'`,
      [session.santri_id]
    ).then(rows => Number(rows[0]?.count || 0)),
    mainQuery<{ count: number }>(
      `SELECT COUNT(*) count FROM portal_payment_submission WHERE santri_id=? AND status='menunggu_konfirmasi'`,
      [session.santri_id]
    ).then(rows => Number(rows[0]?.count || 0)),
  ])

  return (
    <div>
      <PortalPageHeader
        index="03"
        kicker="Dompet & Pembayaran"
        title="Keuangan"
        subtitle={`Keuangan ${session.nama}${session.nis ? ` • NIS ${session.nis}` : ''}`}
        tabs={<KeuanganTabBar active={tab} badges={{ tagihan: openBillCount, riwayat: pendingCount }} />}
      >
        {children.length > 1 && (
          <form action={switchPortalStudent} className="mt-4 flex items-center gap-2 rounded-[var(--p-radius-md)] bg-white/10 border border-white/15 p-1.5">
            <select
              name="santriId"
              defaultValue={session.santri_id}
              className="w-full bg-transparent px-3 py-1.5 text-xs font-semibold text-white outline-none cursor-pointer [&>option]:text-slate-900 [&>option]:bg-white"
            >
              {children.map(child => (
                <option key={child.id} value={child.id}>
                  {child.nama_lengkap}
                </option>
              ))}
            </select>
            <SwitchStudentButton />
          </form>
        )}
      </PortalPageHeader>

      <div className="pb-28">
        {tab === 'saldo' && (
          <SaldoTab
            santriId={session.santri_id}
            titipanBalance={titipanBalance}
            jajanBalance={jajanBalance}
            methods={methods}
            qrisMethod={qrisMethod}
          />
        )}
        {tab === 'tagihan' && (
          <TagihanTab
            santriId={session.santri_id}
            asrama={session.asrama}
            titipanBalance={titipanBalance}
            tahun={selectedTahun}
            bulan={selectedBulan}
          />
        )}
        {tab === 'riwayat' && <RiwayatTab santriId={session.santri_id} />}
      </div>
    </div>
  )
}

async function SaldoTab({
  santriId,
  titipanBalance,
  jajanBalance,
  methods,
  qrisMethod,
}: {
  santriId: string
  titipanBalance: number
  jajanBalance: number
  methods: string[]
  qrisMethod: string | null
}) {
  const limits = (await query<{ daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null }>(
    `SELECT daily_rupiah,weekly_rupiah,monthly_rupiah FROM finance_withdrawal_limits WHERE santri_id=?`,
    [santriId]
  ))[0] || null
  const security = await queryOne<{ has_pin: number }>(
    `SELECT (pin_hash IS NOT NULL) AS has_pin FROM finance_student_security WHERE santri_id=?`,
    [santriId]
  )
  const hasPin = !!security?.has_pin

  return (
    <>
      {/* Strip saldo utama: full-bleed, langsung menyambung dari header */}
      <div className="portal-rise portal-rise-1 bg-[var(--p-ink)] px-5 pt-5 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50 flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" /> Saldo Titipan Utama
        </p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="portal-display text-[2.1rem] leading-none text-white">
            {formatRupiah(titipanBalance)}
          </p>
          <IsiSaldoTrigger methods={methods} qrisMethod={qrisMethod} />
        </div>
      </div>

      <p className="portal-section-label px-5 mt-5 mb-3">02 — Alokasi &amp; Pengaturan</p>
      <div className="px-5 space-y-4">
        <FinanceClient jajanBalance={jajanBalance} limits={limits} hasPin={hasPin} />
      </div>
    </>
  )
}

async function TagihanTab({
  santriId,
  asrama,
  titipanBalance,
  tahun,
  bulan,
}: {
  santriId: string
  asrama: string | null
  titipanBalance: number
  tahun: number
  bulan: number
}) {
  // bebasSpp TIDAK lagi menyembunyikan tab — santri tetap melihat barisnya
  // dengan badge "Dibebaskan" (lihat getSppMonthlyGrid, status DIBEBASKAN).
  // isAsramaTanpaKamar tetap menyembunyikan karena itu bukan pembebasan,
  // melainkan santri asrama ini memang tidak punya kewajiban SPP sama sekali.
  const tampilkanSpp = !isAsramaTanpaKamar(asrama)

  await Promise.all([
    syncPortalSppBills(santriId, tampilkanSpp),
    syncPortalNonSppBills(santriId),
  ])

  const [
    sppBills, nonSppBills, usppBills, channels, pendingSpp, pendingNonSpp, sppGrid, sppTunggakan, nonSppOutstanding,
    makanBills, laundryBills, makanArrears, laundryArrears, exemptions,
  ] = await Promise.all([
    tampilkanSpp ? getPortalOpenBills(santriId, 'SPP') : Promise.resolve([]),
    getPortalOpenBills(santriId, 'NON_SPP'),
    getPortalOpenUsppBills(santriId),
    getPaymentChannels(),
    getPendingSubmission(santriId, 'SPP'),
    getPendingSubmission(santriId, 'NON_SPP'),
    tampilkanSpp ? getSppMonthlyGrid(santriId, tahun) : Promise.resolve([]),
    tampilkanSpp ? getTunggakanSppSantri(santriId) : Promise.resolve(null),
    getNonSppOutstandingSantri(santriId),
    getOpenServiceBills(santriId, 'MAKAN'),
    getOpenServiceBills(santriId, 'LAUNDRY'),
    getServiceArrearsHistoris(santriId, 'MAKAN'),
    getServiceArrearsHistoris(santriId, 'LAUNDRY'),
    getExemptionsForSantri(santriId),
  ])

  const sppItems: TagihanItem[] = sppBills.map(bill => ({
    key: bill.id,
    label: bill.title,
    sublabel: null,
    nominal: Number(bill.amount_rupiah),
  }))

  const nonSppItems: TagihanItem[] = nonSppBills.map(bill => ({
    key: bill.id,
    label: bill.title,
    sublabel: null,
    nominal: Number(bill.amount_rupiah),
  }))

  const usppItems: UsppTagihanItem[] = usppBills.map(bill => ({
    key: bill.id,
    label: bill.title,
    sublabel: null,
    nominal: Number(bill.amount_rupiah),
    sisaRupiah: Number(bill.amount_rupiah) - Number(bill.paid_rupiah),
    status: bill.status,
  }))

  function buildServiceSummary(
    bills: { id: string; title: string; amount_rupiah: number; paid_rupiah: number }[],
    arrears: { id: string; label: string; amount_rupiah: number; status: 'BELUM_LUNAS' | 'LUNAS' }[],
    exempted: boolean
  ): ServiceBillSummary {
    const billItems: TagihanItem[] = bills.map(bill => ({
      key: bill.id,
      label: bill.title,
      sublabel: null,
      nominal: Number(bill.amount_rupiah) - Number(bill.paid_rupiah),
    }))
    const arrearsItems: TagihanItem[] = arrears
      .filter(row => row.status === 'BELUM_LUNAS')
      .map(row => ({ key: row.id, label: row.label, sublabel: 'Tunggakan lama', nominal: Number(row.amount_rupiah) }))
    const items = [...billItems, ...arrearsItems]
    return { items, totalOutstanding: items.reduce((sum, item) => sum + item.nominal, 0), exempted }
  }

  const makanSummary = buildServiceSummary(makanBills, makanArrears, exemptions.MAKAN)
  const laundrySummary = buildServiceSummary(laundryBills, laundryArrears, exemptions.LAUNDRY)

  const sppCell = sppGrid.find(cell => cell.bulan === bulan) || null

  return (
    <div className="px-5 pt-5">
      <TagihanClient
        tahun={tahun}
        bulan={bulan}
        tampilkanSpp={tampilkanSpp}
        sppCell={sppCell}
        sppItems={sppItems}
        sppTunggakanTotal={sppTunggakan?.total || 0}
        nonSppItems={nonSppItems}
        nonSppOutstanding={nonSppOutstanding}
        nonSppTahunanJenis={NON_SPP_JENIS_TAHUNAN}
        usppItems={usppItems}
        makanSummary={makanSummary}
        laundrySummary={laundrySummary}
        channels={channels}
        walletBalance={titipanBalance}
        pendingSpp={!!pendingSpp}
        pendingSppSudahUpload={!!pendingSpp?.bukti_url}
        pendingNonSpp={!!pendingNonSpp}
        pendingNonSppSudahUpload={!!pendingNonSpp?.bukti_url}
      />
    </div>
  )
}

async function RiwayatTab({ santriId }: { santriId: string }) {
  const [rows, allocationRows, withdrawalRows] = await Promise.all([
    getRiwayatSubmissions(santriId),
    getPortalAllocationHistory(santriId),
    query<{ id: string; amount_rupiah: number; credential_kind: string; created_at: string }>(
      `SELECT id,amount_rupiah,credential_kind,created_at FROM finance_withdrawals WHERE santri_id=? AND status='SUCCESS' ORDER BY created_at DESC LIMIT 30`,
      [santriId]
    ),
  ])

  const submissionItems: RiwayatItem[] = rows.map(row => ({
    source: 'submission',
    id: row.id,
    kategori: row.kategori,
    rincian: parseDetail(row.detail_json),
    jumlah: row.jumlah,
    metode: row.metode,
    bank: (() => {
      try {
        const bank = row.bank_tujuan ? JSON.parse(row.bank_tujuan) : null
        return bank ? `${bank.bank} • ${bank.nomor}` : null
      } catch {
        return null
      }
    })(),
    buktiUrl: row.bukti_url,
    status: row.status,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
  }))

  const allocationItems: RiwayatItem[] = allocationRows.map(row => ({
    source: 'allocation',
    id: row.id,
    destinationKind: row.destination_kind,
    jumlah: Number(row.amount_rupiah),
    status: row.status,
    createdAt: row.created_at,
  }))

  const feed = [...submissionItems, ...allocationItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const withdrawals: WithdrawalItem[] = withdrawalRows.map(row => ({
    id: row.id,
    amountRupiah: Number(row.amount_rupiah),
    credentialKind: row.credential_kind,
    createdAt: row.created_at,
  }))

  return (
    <div className="px-5 pt-5">
      <RiwayatClient feed={feed} withdrawals={withdrawals} />
    </div>
  )
}
