import { guardPage } from '@/lib/auth/guard'
import { DashboardPageHeader } from '@/components/dashboard/page-header'
import { TesKlasifikasiTabs } from '../_tabs'

export const dynamic = 'force-dynamic'

export default async function BlankoPenilaianTesKlasifikasiPage() {
  await guardPage('/dashboard/santri/tes-klasifikasi')
  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-16">
      <TesKlasifikasiTabs />
      <DashboardPageHeader
        title="Blanko Penilaian Tes Klasifikasi"
        description="Format cetak penilaian per peserta akan disiapkan setelah penjadwalan selesai."
      />
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-semibold text-slate-500">
        Placeholder fitur berikutnya.
      </div>
    </div>
  )
}
