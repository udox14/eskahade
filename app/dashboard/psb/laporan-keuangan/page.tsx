import { guardPage } from '@/lib/auth/guard'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import PsbLaporanKeuanganContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function PsbLaporanKeuanganPage() {
  await guardPage('/dashboard/psb/laporan-keuangan')

  return (
    <div className="space-y-5 pb-10">
      <DashboardPageHeader
        title="Laporan Keuangan PSB"
        description="Ringkasan dan rincian pembayaran PSB santri baru."
      />
      <PsbLaporanKeuanganContent />
    </div>
  )
}
