import { Suspense } from 'react'

import { guardPage } from '@/lib/auth/guard'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import PsbPageContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function PsbPage() {
  await guardPage('/dashboard/psb')

  return (
    <div className="space-y-5 pb-10">
      <DashboardPageHeader
        title="Daftar Ulang PSB"
        description="Alur terpadu daftar ulang santri baru dari sekretariat sampai pembayaran."
      />
      <Suspense fallback={null}>
        <PsbPageContent />
      </Suspense>
    </div>
  )
}
