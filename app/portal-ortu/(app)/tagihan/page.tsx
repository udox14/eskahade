import { requirePortalSessionStrict } from '@/lib/portal/session'
import { getTunggakanSppSantri } from '@/lib/spp/tunggakan'
import { getNonSppOutstandingSantri } from '@/lib/keuangan/non-spp-outstanding'
import { getPaymentChannels, getPendingSubmission } from '@/lib/portal/data'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { PortalPageHeader } from '../../_components/page-header'
import { TagihanClient, type TagihanItem } from './_tagihan-client'

export const dynamic = 'force-dynamic'

const NON_SPP_LABEL: Record<string, string> = {
  BANGUNAN: 'Uang Bangunan',
  KESEHATAN: 'Kesehatan',
  EHB: 'EHB (Evaluasi Hasil Belajar)',
  EKSKUL: 'Ekstrakurikuler',
}

export default async function TagihanPage() {
  const session = await requirePortalSessionStrict()
  const tampilkanSpp = !session.bebas_spp && !isAsramaTanpaKamar(session.asrama)

  const [spp, nonSpp, channels, pendingSpp, pendingNonSpp] = await Promise.all([
    tampilkanSpp ? getTunggakanSppSantri(session.santri_id) : Promise.resolve(null),
    getNonSppOutstandingSantri(session.santri_id),
    getPaymentChannels(),
    getPendingSubmission(session.santri_id, 'SPP'),
    getPendingSubmission(session.santri_id, 'NON_SPP'),
  ])

  const sppItems: TagihanItem[] = (spp?.items ?? []).map(item => ({
    key: item.source === 'HISTORIS' ? `H:${item.id}` : `B:${item.tahun}-${item.bulan}`,
    label: item.label,
    sublabel: item.source === 'HISTORIS' ? 'Tunggakan lama' : null,
    nominal: item.nominal,
  }))

  const nonSppItems: TagihanItem[] = (nonSpp?.items ?? [])
    .filter(item => item.sisa > 0)
    .map(item => ({
      key: item.jenis,
      label: NON_SPP_LABEL[item.jenis] || item.jenis,
      sublabel: item.paid > 0 ? `Sudah dibayar sebagian` : item.jenis === 'BANGUNAN' ? 'Sekali selama mondok' : `Tahun ajaran ${nonSpp?.tahunAjaranNama ?? ''}`,
      nominal: item.sisa,
    }))

  return (
    <div>
      <PortalPageHeader
        kicker="Pembayaran"
        title="Tagihan"
        subtitle="Bayar via transfer bank atau QRIS, lalu unggah bukti untuk diperiksa petugas."
      />
      <div className="px-5 -mt-9">
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
