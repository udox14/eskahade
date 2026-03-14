import { guardPage } from '@/lib/auth/guard'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { getAllFiturForAdmin } from './actions'
import { FiturAksesClient } from './client'

export const dynamic = 'force-dynamic'

export default async function FiturAksesPage() {
  await guardPage('/dashboard/pengaturan/fitur-akses')
  const session = await getSession()
  if (!session || session.role !== 'admin') redirect('/dashboard')

  const fiturList = await getAllFiturForAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Manajemen Fitur</h1>
        <p className="text-gray-500 text-sm mt-1">
          Kelola akses fitur per role pengguna. Perubahan berlaku dalam ~5 menit (cache).
        </p>
      </div>
      <FiturAksesClient fiturList={fiturList} />
    </div>
  )
}
