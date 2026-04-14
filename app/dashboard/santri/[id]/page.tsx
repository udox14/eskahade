import { Suspense } from 'react'
import { guardRole } from '@/lib/auth/guard'
import { getSession, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'
import { getSantriDetail } from './actions'
import { SantriDetailContent } from './detail-content'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DetailSkeleton } from '@/components/ui/skeletons'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const santri = await getSantriDetail(id)
  return { title: santri ? `${santri.nama_lengkap} - Data Santri` : 'Tidak Ditemukan' }
}

export default async function SantriDetailPage({ params }: Props) {
  const session = await guardRole()
  const { id } = await params

  // Fetch santri dulu (ringan, 1 query) — untuk validasi akses
  const santri = await getSantriDetail(id)
  if (!santri) return notFound()

  // Pengurus asrama hanya boleh lihat santri asrama binaannya
  if (hasRole(session, 'pengurus_asrama')) {
    if (!session.asrama_binaan || santri.asrama !== session.asrama_binaan) {
      redirect('/dashboard/santri')
    }
  }

  const isReadOnly = hasRole(session, 'pengurus_asrama')

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header — langsung tampil */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/santri"
            className="p-2 bg-white border hover:bg-gray-50 rounded-full transition-colors shadow-sm text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{santri.nama_lengkap}</h1>
            <p className="text-slate-500 text-xs mt-0.5 font-mono">{santri.nis}</p>
          </div>
        </div>
      </div>

      {/* Detail content — di-suspend */}
      <Suspense fallback={<DetailSkeleton />}>
        <SantriDetailContent
          santriId={id}
          santri={santri}
          isReadOnly={isReadOnly}
        />
      </Suspense>
    </div>
  )
}
