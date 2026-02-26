import { getSantriDetail, getRiwayatAkademik, getRiwayatPelanggaran, getRiwayatPerizinan, getRiwayatSPP, getRiwayatTabungan } from './actions'
import { SantriProfileView } from './profile-view'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Metadata } from 'next'

// Force dynamic rendering agar data selalu fresh dan menghindari error statis
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const santri = await getSantriDetail(id)
  return {
    title: santri ? `${santri.nama_lengkap} - Data Santri` : 'Tidak Ditemukan'
  }
}

export default async function SantriDetailPage({ params }: Props) {
  // Await params terlebih dahulu (Wajib di Next.js 15)
  const { id } = await params;

  // FETCH SEMUA DATA PARALLEL
  const [santri, akademik, pelanggaran, perizinan, spp, tabungan] = await Promise.all([
    getSantriDetail(id),
    getRiwayatAkademik(id),
    getRiwayatPelanggaran(id),
    getRiwayatPerizinan(id),
    getRiwayatSPP(id),
    getRiwayatTabungan(id)
  ])

  if (!santri) {
    return notFound()
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      
      {/* HEADER PAGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/santri" className="p-2 bg-white border hover:bg-gray-50 rounded-full transition-colors shadow-sm text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Profil Lengkap Santri</h1>
            <p className="text-slate-500 text-sm">Data akademik, disiplin, dan keuangan.</p>
          </div>
        </div>

        <Link 
          href={`/dashboard/santri/${santri.id}/edit`}
          className="inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm"
        >
          <Pencil className="w-4 h-4" />
          Edit Data
        </Link>
      </div>

      {/* RENDER VIEW (CLIENT COMPONENT) */}
      <SantriProfileView 
         santri={santri}
         akademik={akademik}
         pelanggaran={pelanggaran}
         perizinan={perizinan}
         spp={spp}
         tabungan={tabungan}
      />

    </div>
  )
}