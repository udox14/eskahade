import { requirePortalSessionStrict } from '@/lib/portal/session'
import {
  syncPortalSppBills, syncPortalNonSppBills, getPortalOpenBills, sppBillSublabel, nonSppBillSublabel,
} from '@/lib/finance/portal-bills-sync'
import { getPaymentChannels, getPendingSubmission } from '@/lib/portal/data'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { PortalPageHeader } from '../../_components/page-header'
import { TagihanClient, type TagihanItem } from './_tagihan-client'

export const dynamic = 'force-dynamic'

export default async function TagihanPage() {
  const session = await requirePortalSessionStrict()
  const tampilkanSpp = !session.bebas_spp && !isAsramaTanpaKamar(session.asrama)

  await Promise.all([
    syncPortalSppBills(session.santri_id, tampilkanSpp),
    syncPortalNonSppBills(session.santri_id),
  ])

  const [sppBills, nonSppBills, channels, pendingSpp, pendingNonSpp] = await Promise.all([
    tampilkanSpp ? getPortalOpenBills(session.santri_id, 'SPP') : Promise.resolve([]),
    getPortalOpenBills(session.santri_id, 'NON_SPP'),
    getPaymentChannels(),
    getPendingSubmission(session.santri_id, 'SPP'),
    getPendingSubmission(session.santri_id, 'NON_SPP'),
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

  return (
    <div>
      <PortalPageHeader
        index="03"
        kicker="Pembayaran"
        title="Tagihan"
        subtitle="Bayar via transfer bank atau QRIS, lalu unggah bukti untuk diperiksa petugas."
      />
      <div className="px-5 pt-5">
        <TagihanClient
          tampilkanSpp={tampilkanSpp}
          sppItems={sppItems}
          nonSppItems={nonSppItems}
          channels={channels}
          pendingSpp={!!pendingSpp}
          pendingSppSudahUpload={!!pendingSpp?.bukti_url}
          pendingNonSpp={!!pendingNonSpp}
          pendingNonSppSudahUpload={!!pendingNonSpp?.bukti_url}
        />
      </div>
    </div>
  )
}
