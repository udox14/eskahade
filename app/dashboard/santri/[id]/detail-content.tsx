import { getRiwayatAkademik, getRiwayatPelanggaran, getRiwayatPerizinan, getRiwayatSPP, getRiwayatTabungan } from './actions'
import type { SantriDetail } from './actions'
import { SantriProfileView } from './profile-view'
import { DeleteSantriButton } from './delete-santri-button'
import Link from 'next/link'
import { Pencil } from 'lucide-react'

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
    <>
      <div className="flex flex-col justify-end gap-2 sm:flex-row">
        {!isReadOnly && (
          <Link
            href={`/dashboard/santri/${santri.id}/edit`}
            className="inline-flex items-center justify-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm"
          >
            <Pencil className="w-4 h-4" />
            Edit Data
          </Link>
        )}
        {isAdmin && (
          <DeleteSantriButton santriId={santri.id} nama={santri.nama_lengkap} nis={santri.nis} />
        )}
      </div>
      <SantriProfileView
        santri={santri}
        akademik={akademik}
        pelanggaran={pelanggaran}
        perizinan={perizinan}
        spp={spp}
        tabungan={tabungan}
      />
    </>
  )
}
