import { Suspense } from 'react'
import { guardPage } from '@/lib/auth/guard'
import { canCrud } from '@/lib/auth/crud'
import { hasRole, isAdmin as isSessionAdmin } from '@/lib/auth/session'
import { getSantriDetail } from './actions'
import { SantriDetailContent } from './detail-content'
import { notFound, redirect } from 'next/navigation'
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
  const session = await guardPage('/dashboard/santri')
  const { id } = await params

  // Fetch santri dulu (ringan, 1 query) — untuk validasi akses
  const santri = await getSantriDetail(id)
  if (!santri) return notFound()

  // Pengurus asrama hanya boleh lihat santri asrama binaannya
  if (hasRole(session, 'pengurus_asrama') && !isSessionAdmin(session)) {
    if (!session.asrama_binaan || santri.asrama !== session.asrama_binaan) {
      redirect('/dashboard/santri')
    }
  }

  const canUpdateSantri = await canCrud('/dashboard/santri', 'update')
  const isReadOnly = hasRole(session, 'pengurus_asrama') || !canUpdateSantri
  const isAdmin = hasRole(session, 'admin')

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Detail content — di-suspend */}
      <Suspense fallback={<DetailSkeleton />}>
        <SantriDetailContent
          santriId={id}
          santri={santri}
          isReadOnly={isReadOnly}
          isAdmin={isAdmin}
        />
      </Suspense>
    </div>
  )
}
