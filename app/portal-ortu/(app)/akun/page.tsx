import { requirePortalSession } from '@/lib/portal/session'
import { getParentWalletLimits, getGlobalDailyLimit } from '@/lib/finance/wallet'
import { getStudentPinStatus } from '@/lib/finance/pins'
import { AkunClient } from './_akun-client'
import { PortalPageHeader } from '../../_components/page-header'

export const dynamic = 'force-dynamic'

export default async function AkunPage() {
  const session = await requirePortalSession()

  const [parentLimits, globalDailyLimit, pinStatus] = await Promise.all([
    getParentWalletLimits(session.santri_id).catch(() => null),
    getGlobalDailyLimit().catch(() => 100000),
    getStudentPinStatus(session.santri_id).catch(() => null),
  ])

  return (
    <div className="pb-32">
      <PortalPageHeader title="Akun" />
      <div className="px-5 pt-5"><AkunClient
        mustChangePassword={session.must_change_password}
        nis={session.nis}
        session={session}
        parentLimits={parentLimits}
        globalDailyLimit={globalDailyLimit}
        pinStatus={pinStatus}
      /></div>
    </div>
  )
}
