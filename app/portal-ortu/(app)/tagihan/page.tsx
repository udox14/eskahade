import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPortalStudentBilling } from '@/lib/portal/finance'
import { TagihanClient } from './_tagihan-client'
import { PortalPageHeader } from '../../_components/page-header'

export const dynamic = 'force-dynamic'

export default async function TagihanPage() {
  const session = await requirePortalSessionStrict()

  // Ambil tagihan authoritative dari Sistem Keuangan Baru
  const billingData = await getPortalStudentBilling(session.santri_id)

  return (
    <div className="pb-40">
      <PortalPageHeader title="Tagihan" />
      <div className="px-5 pt-5"><TagihanClient billingData={billingData} /></div>
    </div>
  )
}
