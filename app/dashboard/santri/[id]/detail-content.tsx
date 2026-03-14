import { getRiwayatAkademik, getRiwayatPelanggaran, getRiwayatPerizinan, getRiwayatSPP, getRiwayatTabungan } from './actions'
import { SantriProfileView } from './profile-view'
import Link from 'next/link'
import { Pencil } from 'lucide-react'

interface Props {
  santriId: string
  santri: any
  isReadOnly: boolean
}

export async function SantriDetailContent({ santriId, santri, isReadOnly }: Props) {
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
      {!isReadOnly && (
        <div className="flex justify-end">
          <Link
            href={`/dashboard/santri/${santri.id}/edit`}
            className="inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm"
          >
            <Pencil className="w-4 h-4" />
            Edit Data
          </Link>
        </div>
      )}
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
