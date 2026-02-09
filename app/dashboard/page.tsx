import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminDashboard } from './dashboards/admin-dashboard'
import { AsramaDashboard } from './dashboards/asrama-dashboard'
import { KeamananDashboard } from './dashboards/keamanan-dashboard'
import { AkademikDashboard } from './dashboards/akademik-dashboard'
import { DewanSantriDashboard } from './dashboards/dewan-santri-dashboard' // Import Baru

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Ambil Role & Asrama Binaan
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, asrama_binaan')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'wali_kelas'

  // --- LOGIKA DISPATCHER ---
  
  // 1. PENGURUS ASRAMA
  if (role === 'pengurus_asrama') {
    if (!profile?.asrama_binaan) {
      return <div className="p-10 text-center text-gray-500">Anda belum ditugaskan ke asrama manapun. Hubungi Admin.</div>
    }
    return <AsramaDashboard asrama={profile.asrama_binaan} />
  }

  // 2. DEWAN SANTRI (New)
  if (role === 'dewan_santri') {
    return <DewanSantriDashboard />
  }

  // 3. KEAMANAN
  if (role === 'keamanan') {
    return <KeamananDashboard />
  }

  // 4. SEKPEN & WALI KELAS (Akademik)
  if (role === 'sekpen' || role === 'wali_kelas') {
    return <AkademikDashboard role={role} />
  }

  // 5. ADMIN & DEFAULT
  return <AdminDashboard />
}