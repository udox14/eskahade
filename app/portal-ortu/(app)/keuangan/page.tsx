import { requirePortalSessionStrict } from '@/lib/portal/session'
import { financeQuery as query } from '@/lib/db'
import { syncFinanceStudentSnapshot, syncFinanceStudentsByIds, financeStudentIdsForGuardian } from '@/lib/finance/snapshots'
import { FinanceClient } from './_finance-client'
import { switchPortalStudent } from './switch-actions'
import { PortalPageHeader } from '../../_components/page-header'
import { formatRupiah } from '@/lib/portal/format'
import { ClockCounterClockwise, ForkKnife, ShoppingBag, TShirt, Wallet } from '@phosphor-icons/react/dist/ssr'

export const dynamic = 'force-dynamic'

export default async function PortalFinancePage() {
  const session = await requirePortalSessionStrict()
  await syncFinanceStudentSnapshot(session.santri_id)

  const balances = await query<{ wallet_kind: string; balance_rupiah: number }>(
    `SELECT wallet_kind,balance_rupiah FROM finance_student_wallets WHERE santri_id=? ORDER BY wallet_kind`,
    [session.santri_id]
  )
  const methods = (process.env.DUITKU_PAYMENT_METHODS || '').split(',').map(x => x.trim()).filter(Boolean)
  const limits = (await query<{ daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null }>(
    `SELECT daily_rupiah,weekly_rupiah,monthly_rupiah FROM finance_withdrawal_limits WHERE santri_id=?`,
    [session.santri_id]
  ))[0] || null
  const withdrawals = await query<{ id: string; amount_rupiah: number; credential_kind: string; created_at: string }>(
    `SELECT id,amount_rupiah,credential_kind,created_at FROM finance_withdrawals WHERE santri_id=? AND status='SUCCESS' ORDER BY created_at DESC LIMIT 30`,
    [session.santri_id]
  )
  if (session.guardian_id) await syncFinanceStudentsByIds(await financeStudentIdsForGuardian(session.guardian_id))

  const children = session.guardian_id
    ? await query<{ id: string; nama_lengkap: string }>(
        `SELECT s.santri_id id,s.full_name nama_lengkap FROM finance_guardian_students gs JOIN finance_student_snapshots s ON s.santri_id=gs.santri_id WHERE gs.guardian_id=? AND s.status_global='aktif' ORDER BY s.full_name`,
        [session.guardian_id]
      )
    : []

  const titipanBalance = Number(balances.find(row => row.wallet_kind === 'TITIPAN')?.balance_rupiah || 0)
  const jajanBalance = Number(balances.find(row => row.wallet_kind === 'JAJAN')?.balance_rupiah || 0)
  const makanBalance = Number(balances.find(row => row.wallet_kind === 'MAKAN')?.balance_rupiah || 0)
  const laundryBalance = Number(balances.find(row => row.wallet_kind === 'LAUNDRY')?.balance_rupiah || 0)

  return (
    <div>
      <PortalPageHeader
        kicker="Dompet & Tabungan Santri"
        title="Saldo & Alokasi"
        subtitle={`Keuangan ${session.nama}${session.nis ? ` • NIS ${session.nis}` : ''}`}
      >
        {children.length > 1 && (
          <form action={switchPortalStudent} className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 p-1.5 backdrop-blur-sm">
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
            <button className="shrink-0 rounded-xl bg-white/20 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/30 active:scale-95 transition">
              Ganti Anak
            </button>
          </form>
        )}
      </PortalPageHeader>

      <div className="px-5 -mt-9 space-y-4 pb-28">
        {/* Main Hero Card: Saldo Titipan & Sub Wallet */}
        <div className="portal-rise portal-rise-1 rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] p-5 shadow-[0_18px_40px_-18px_rgba(11,94,63,0.3)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--p-muted)] flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[var(--p-emerald)]" /> Saldo Titipan Utama
              </p>
              <p className="portal-display mt-1 text-[1.85rem] leading-none text-[var(--p-emerald-deep)]">
                {formatRupiah(titipanBalance)}
              </p>
            </div>
            <span className="rounded-full bg-[var(--p-gold-soft)] px-3 py-1 text-[11px] font-bold text-[#7a5a17]">
              Utama
            </span>
          </div>

          <p className="mt-2 text-xs text-[var(--p-muted)] leading-relaxed">
            Dapat dialokasikan ke Uang Jajan, Uang Makan, Laundry, SPP &amp; Non-SPP.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-[var(--p-cream)] p-3 border border-[var(--p-line)]/50">
              <div className="flex items-center justify-center gap-1 text-[var(--p-muted)]">
                <ShoppingBag className="w-3.5 h-3.5 text-[var(--p-gold)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Jajan</span>
              </div>
              <p className="portal-display mt-1.5 text-xs font-bold text-[var(--p-ink)] truncate">
                {formatRupiah(jajanBalance)}
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--p-cream)] p-3 border border-[var(--p-line)]/50">
              <div className="flex items-center justify-center gap-1 text-[var(--p-muted)]">
                <ForkKnife className="w-3.5 h-3.5 text-[var(--p-gold)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Makan</span>
              </div>
              <p className="portal-display mt-1.5 text-xs font-bold text-[var(--p-ink)] truncate">
                {formatRupiah(makanBalance)}
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--p-cream)] p-3 border border-[var(--p-line)]/50">
              <div className="flex items-center justify-center gap-1 text-[var(--p-muted)]">
                <TShirt className="w-3.5 h-3.5 text-[var(--p-gold)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Laundry</span>
              </div>
              <p className="portal-display mt-1.5 text-xs font-bold text-[var(--p-ink)] truncate">
                {formatRupiah(laundryBalance)}
              </p>
            </div>
          </div>
        </div>

        {/* Finance Client Section */}
        <FinanceClient methods={methods} limits={limits} />

        {/* Riwayat Pencairan */}
        <div className="portal-rise portal-rise-4 rounded-3xl bg-[var(--p-card)] border border-[var(--p-line)] p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <ClockCounterClockwise className="w-4 h-4 text-[var(--p-emerald)]" />
            <h2 className="portal-display text-lg text-[var(--p-emerald-deep)]">Riwayat Pencairan</h2>
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
                    <span className="inline-block mt-0.5 rounded-full bg-[var(--p-cream)] px-2 py-0.5 text-[10px] font-bold text-[var(--p-muted)] uppercase tracking-wider">
                      {item.credential_kind}
                    </span>
                  </div>
                  <p className="portal-display text-sm text-[var(--p-emerald-deep)] font-bold">
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
    </div>
  )
}
