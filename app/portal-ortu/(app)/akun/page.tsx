import { requirePortalSession } from '@/lib/portal/session'
import { getParentWalletLimits, getGlobalDailyLimit } from '@/lib/finance/wallet'
import { getStudentPinStatus } from '@/lib/finance/pins'
import { AkunClient } from './_akun-client'

export const dynamic = 'force-dynamic'

export default async function AkunPage() {
  const session = await requirePortalSession()

  const [parentLimits, globalDailyLimit, pinStatus] = await Promise.all([
    getParentWalletLimits(session.santri_id).catch(() => null),
    getGlobalDailyLimit().catch(() => 100000),
    getStudentPinStatus(session.santri_id).catch(() => null),
  ])

  return (
    <div className="px-5 pt-5 pb-32 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-950">Pengaturan</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Atur limit uang jajan, PIN transaksi, dan keamanan akun portal.
        </p>
      </div>

      <AkunClient
        mustChangePassword={session.must_change_password}
        nis={session.nis}
        session={session}
        parentLimits={parentLimits}
        globalDailyLimit={globalDailyLimit}
        pinStatus={pinStatus}
      />
    </div>
  )
}
