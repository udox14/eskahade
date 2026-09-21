import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPortalStudentBilling } from '@/lib/portal/finance'
import { TagihanClient } from './_tagihan-client'

export const dynamic = 'force-dynamic'

export default async function TagihanPage() {
  const session = await requirePortalSessionStrict()

  // Ambil tagihan authoritative dari Sistem Keuangan Baru
  const billingData = await getPortalStudentBilling(session.santri_id)

  return (
    <div className="px-5 pt-5 pb-40 space-y-4">
      {/* Header Halaman Bersih */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-950">Tagihan</h1>
      </div>

      <TagihanClient billingData={billingData} />
    </div>
  )
}
