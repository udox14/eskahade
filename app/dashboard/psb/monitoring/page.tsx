import { guardPage } from '@/lib/auth/guard'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import PsbMonitoringContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function PsbMonitoringPage() {
  await guardPage('/dashboard/psb/monitoring')

  return (
    <div className="space-y-5 pb-10">
      <DashboardPageHeader
        title="Monitoring PSB"
        description="Pantau progress daftar ulang setiap santri baru."
      />
      <PsbMonitoringContent />
    </div>
  )
}
