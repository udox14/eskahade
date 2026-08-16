import { requirePortalSessionStrict } from '@/lib/portal/session'
import { financeQuery as query, financeQueryOne as queryOne, query as mainQuery } from '@/lib/db'
import { syncFinanceStudentSnapshot, syncFinanceStudentsByIds, financeStudentIdsForGuardian } from '@/lib/finance/snapshots'
import {
  syncPortalSppBills, syncPortalNonSppBills, getPortalOpenBills, getPortalOpenUsppBills,
  sppBillSublabel, nonSppBillSublabel,
} from '@/lib/finance/portal-bills-sync'
import { getPaymentChannels, getPendingSubmission, getRiwayatSubmissions } from '@/lib/portal/data'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { FinanceClient } from './_finance-client'
import { TagihanClient, type TagihanItem, type UsppTagihanItem } from './_tagihan-client'
import { RiwayatClient, type RiwayatItem } from './_riwayat-client'
import { KeuanganTabBar, type KeuanganTab } from './_tab-bar'
import { switchPortalStudent } from './switch-actions'
import { PortalPageHeader } from '../../_components/page-header'
import { formatRupiah } from '@/lib/portal/format'
import { ClockCounterClockwise, ForkKnife, ShoppingBag, TShirt, Wallet } from '@phosphor-icons/react/dist/ssr'

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
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: rawTab } = await searchParams
  const tab: KeuanganTab = rawTab === 'tagihan' || rawTab === 'riwayat' ? rawTab : 'saldo'

  const session = await requirePortalSessionStrict()
  await syncFinanceStudentSnapshot(session.santri_id)

  const titipan = await queryOne<{ balance_rupiah: number }>(
    `SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id=? AND wallet_kind='TITIPAN'`,
    [session.santri_id]
  )
  const titipanBalance = Number(titipan?.balance_rupiah || 0)

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
            <button className="shrink-0 rounded-[var(--p-radius-sm)] bg-white/20 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/30 active:scale-95 transition">
              Ganti Anak
            </button>
          </form>
        )}
      </PortalPageHeader>

      <div className="pb-28">
        {tab === 'saldo' && <SaldoTab santriId={session.santri_id} titipanBalance={titipanBalance} />}
        {tab === 'tagihan' && (
          <TagihanTab
            santriId={session.santri_id}
            bebasSpp={session.bebas_spp}
            asrama={session.asrama}
            titipanBalance={titipanBalance}
          />
        )}
        {tab === 'riwayat' && <RiwayatTab santriId={session.santri_id} />}
      </div>
    </div>
  )
}

async function SaldoTab({ santriId, titipanBalance }: { santriId: string; titipanBalance: number }) {
  const balances = await query<{ wallet_kind: string; balance_rupiah: number }>(
    `SELECT wallet_kind,balance_rupiah FROM finance_student_wallets WHERE santri_id=? ORDER BY wallet_kind`,
    [santriId]
  )
  const methods = (process.env.DUITKU_PAYMENT_METHODS || '').split(',').map(x => x.trim()).filter(Boolean)
  const limits = (await query<{ daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null }>(
    `SELECT daily_rupiah,weekly_rupiah,monthly_rupiah FROM finance_withdrawal_limits WHERE santri_id=?`,
    [santriId]
  ))[0] || null
  const withdrawals = await query<{ id: string; amount_rupiah: number; credential_kind: string; created_at: string }>(
    `SELECT id,amount_rupiah,credential_kind,created_at FROM finance_withdrawals WHERE santri_id=? AND status='SUCCESS' ORDER BY created_at DESC LIMIT 30`,
    [santriId]
  )

  const jajanBalance = Number(balances.find(row => row.wallet_kind === 'JAJAN')?.balance_rupiah || 0)
  const makanBalance = Number(balances.find(row => row.wallet_kind === 'MAKAN')?.balance_rupiah || 0)
  const laundryBalance = Number(balances.find(row => row.wallet_kind === 'LAUNDRY')?.balance_rupiah || 0)

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
          <span className="mb-1 rounded-[var(--p-radius-sm)] bg-[var(--p-red)] px-3 py-1 text-[11px] font-bold text-white shrink-0">
            Utama
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[var(--p-line)] border-b border-[var(--p-line)] bg-[var(--p-white)] text-center">
        <div className="p-3">
          <div className="flex items-center justify-center gap-1 text-[var(--p-muted)]">
            <ShoppingBag className="w-3.5 h-3.5 text-[var(--p-ink)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Jajan</span>
          </div>
          <p className="portal-display mt-1.5 text-xs font-bold text-[var(--p-ink)] truncate">
            {formatRupiah(jajanBalance)}
          </p>
        </div>

        <div className="p-3">
          <div className="flex items-center justify-center gap-1 text-[var(--p-muted)]">
            <ForkKnife className="w-3.5 h-3.5 text-[var(--p-ink)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Makan</span>
          </div>
          <p className="portal-display mt-1.5 text-xs font-bold text-[var(--p-ink)] truncate">
            {formatRupiah(makanBalance)}
          </p>
        </div>

        <div className="p-3">
          <div className="flex items-center justify-center gap-1 text-[var(--p-muted)]">
            <TShirt className="w-3.5 h-3.5 text-[var(--p-ink)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Laundry</span>
          </div>
          <p className="portal-display mt-1.5 text-xs font-bold text-[var(--p-ink)] truncate">
            {formatRupiah(laundryBalance)}
          </p>
        </div>
      </div>

      <p className="portal-section-label px-5 mt-5 mb-3">02 — Alokasi &amp; Pengaturan</p>
      <div className="px-5 space-y-4">
        <FinanceClient methods={methods} limits={limits} />

        {/* Riwayat Pencairan */}
        <div className="portal-rise portal-rise-4 portal-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ClockCounterClockwise className="w-4 h-4 text-[var(--p-ink)]" />
            <h2 className="portal-display text-lg text-[var(--p-ink)]">Riwayat Pencairan</h2>
          </div>

          {withdrawals.length > 0 ? (
            <div className="divide-y divide-[var(--p-line)]">
              {withdrawals.map(item => (
                <div key={item.id} className="flex items-center justify-between py-3 text-xs first:pt-1 last:pb-0">
                  <div>
                    <p className="font-semibold text-[var(--p-ink)]">
                      {new Date(item.created_at).toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })} WIB
                    </p>
                    <span className="inline-block mt-0.5 rounded-full bg-[var(--p-paper)] border border-[var(--p-line)] px-2 py-0.5 text-[10px] font-bold text-[var(--p-muted)] uppercase tracking-wider">
                      {item.credential_kind}
                    </span>
                  </div>
                  <p className="portal-display text-sm text-[var(--p-ink)] font-bold">
                    {formatRupiah(Number(item.amount_rupiah))}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--p-muted)]">Belum ada riwayat pencairan saldo santri.</p>
          )}
        </div>
      </div>
    </>
  )
}

async function TagihanTab({
  santriId,
  bebasSpp,
  asrama,
  titipanBalance,
}: {
  santriId: string
  bebasSpp: boolean
  asrama: string | null
  titipanBalance: number
}) {
  const tampilkanSpp = !bebasSpp && !isAsramaTanpaKamar(asrama)

  await Promise.all([
    syncPortalSppBills(santriId, tampilkanSpp),
    syncPortalNonSppBills(santriId),
  ])

  const [sppBills, nonSppBills, usppBills, channels, pendingSpp, pendingNonSpp] = await Promise.all([
    tampilkanSpp ? getPortalOpenBills(santriId, 'SPP') : Promise.resolve([]),
    getPortalOpenBills(santriId, 'NON_SPP'),
    getPortalOpenUsppBills(santriId),
    getPaymentChannels(),
    getPendingSubmission(santriId, 'SPP'),
    getPendingSubmission(santriId, 'NON_SPP'),
  ])

  const sppItems: TagihanItem[] = sppBills.map(bill => ({
    key: bill.id,
    label: bill.title,
    sublabel: sppBillSublabel(bill.period_key),
    nominal: Number(bill.amount_rupiah),
  }))

  const nonSppItems: TagihanItem[] = nonSppBills.map(bill => ({
    key: bill.id,
    label: bill.title,
    sublabel: nonSppBillSublabel(bill.period_key),
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

  return (
    <div className="px-5 pt-5">
      <TagihanClient
        tampilkanSpp={tampilkanSpp}
        sppItems={sppItems}
        nonSppItems={nonSppItems}
        usppItems={usppItems}
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
  const rows = await getRiwayatSubmissions(santriId)

  const items: RiwayatItem[] = rows.map(row => ({
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

  return (
    <div className="px-5 pt-5">
      <RiwayatClient items={items} />
    </div>
  )
}
