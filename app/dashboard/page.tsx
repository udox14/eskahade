import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { AdminDashboard } from './dashboards/admin-dashboard'
import { AsramaDashboard } from './dashboards/asrama-dashboard'
import { KeamananDashboard } from './dashboards/keamanan-dashboard'
import { AkademikDashboard } from './dashboards/akademik-dashboard'
import { DewanSantriDashboard } from './dashboards/dewan-santri-dashboard'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const role = session.role || 'wali_kelas'

  if (role === 'pengurus_asrama') {
    if (!session.asrama_binaan) {
      return <div className="p-10 text-center text-gray-500">Anda belum ditugaskan ke asrama manapun. Hubungi Admin.</div>
    }
    return <AsramaDashboard asrama={session.asrama_binaan} />
  }

  if (role === 'dewan_santri') return <DewanSantriDashboard />
  if (role === 'keamanan') return <KeamananDashboard />
  if (role === 'sekpen' || role === 'wali_kelas') return <AkademikDashboard role={role} />

  return <AdminDashboard />
}