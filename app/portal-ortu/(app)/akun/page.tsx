import { requirePortalSession } from '@/lib/portal/session'
import { getParentWalletLimits, getGlobalDailyLimit } from '@/lib/finance/wallet'
import { PortalPageHeader } from '../../_components/page-header'
import { AkunClient } from './_akun-client'
import { WalletLimitCard } from './_wallet-limit-card'

export const dynamic = 'force-dynamic'

export default async function AkunPage() {
  const session = await requirePortalSession()

  const [parentLimits, globalDailyLimit] = await Promise.all([
    getParentWalletLimits(session.santri_id).catch(() => null),
    getGlobalDailyLimit().catch(() => 100000),
  ])

  return (
    <div>
      <PortalPageHeader
        index="06"
        kicker="Pengaturan Akun"
        title={session.nama}
        subtitle={`NIS ${session.nis}${session.asrama ? ` • Asrama ${session.asrama}` : ''}${session.kamar ? ` • Kamar ${session.kamar}` : ''}`}
      />
      <div className="px-5 pt-5 space-y-5 pb-16">
        {/* Kartu Limit Penarikan Uang Jajan */}
        <WalletLimitCard
          initialDaily={parentLimits?.parent_daily_limit ?? null}
          initialWeekly={parentLimits?.parent_weekly_limit ?? null}
          initialMonthly={parentLimits?.parent_monthly_limit ?? null}
          globalDailyLimit={globalDailyLimit}
        />

        {/* Kartu Ganti Password */}
        <AkunClient mustChangePassword={session.must_change_password} nis={session.nis} />
      </div>
    </div>
  )
}
