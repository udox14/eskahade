import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getPortalStudentBilling } from '@/lib/portal/finance'
import { PortalPageHeader } from '../../_components/page-header'
import { TagihanClient } from './_tagihan-client'

export const dynamic = 'force-dynamic'

export default async function TagihanPage() {
  const session = await requirePortalSessionStrict()

  // Ambil tagihan authoritative dari Sistem Keuangan Baru
  const billingData = await getPortalStudentBilling(session.santri_id)

  return (
    <div>
      <PortalPageHeader
        kicker="Keuangan Santri"
        title="Tagihan & Pembayaran"
        subtitle="Pilih tagihan, cicil USPP, isi uang jajan, dan bayar online otomatis via Virtual Account & QRIS."
      />
      <div className="px-4 pt-4 sm:px-5 pb-36">
        <TagihanClient billingData={billingData} />
      </div>
    </div>
  )
}
