import {
  getRiwayatAkademik,
  getRiwayatPelanggaran,
  getRiwayatPerizinan,
  getRiwayatSPP,
  getRiwayatTabungan,
} from './actions'
import type { SantriDetail } from './actions'
import { SantriProfileView } from './profile-view'

interface Props {
  santriId: string
  santri: SantriDetail
  isReadOnly: boolean
  isAdmin: boolean
}

export async function SantriDetailContent({ santriId, santri, isReadOnly, isAdmin }: Props) {
  // Fetch semua data parallel
  const [akademik, pelanggaran, perizinan, spp, tabungan] = await Promise.all([
    getRiwayatAkademik(santriId),
    getRiwayatPelanggaran(santriId),
    getRiwayatPerizinan(santriId),
    getRiwayatSPP(santriId),
    getRiwayatTabungan(santriId),
  ])

  return (
    <SantriProfileView
      santri={santri}
      akademik={akademik}
      pelanggaran={pelanggaran}
      perizinan={perizinan}
      spp={spp}
      tabungan={tabungan}
      isReadOnly={isReadOnly}
      isAdmin={isAdmin}
    />
  )
}
