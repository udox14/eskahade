import { requirePortalSession } from '@/lib/portal/session'
import { PortalPageHeader } from '../../_components/page-header'
import { AkunClient } from './_akun-client'

export const dynamic = 'force-dynamic'

export default async function AkunPage() {
  const session = await requirePortalSession()

  return (
    <div>
      <PortalPageHeader
        kicker="Pengaturan Akun"
        title={session.nama}
        subtitle={`NIS ${session.nis}${session.asrama ? ` • Asrama ${session.asrama}` : ''}${session.kamar ? ` • Kamar ${session.kamar}` : ''}`}
      />
      <div className="px-5 -mt-8">
        <AkunClient mustChangePassword={session.must_change_password} />
      </div>
    </div>
  )
}
