import { guardPage } from '@/lib/auth/guard'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import PendaftarPageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function PendaftarPage() {
  await guardPage('/dashboard/pendaftar')

  return (
    <div className="space-y-5 pb-10">
      <DashboardPageHeader
        title="Pendaftar (Calon Santri)"
        description="Verifikasi berkas & pembayaran calon santri dari web PSB, lalu terima menjadi santri baru."
      />
      <PendaftarPageContent />
    </div>
  )
}
