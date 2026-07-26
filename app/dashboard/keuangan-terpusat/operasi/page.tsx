import { guardPage } from '@/lib/auth/guard'
import { FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getOperationsData } from './actions'
import { OperationsClient } from './_operations-client'

export const dynamic = 'force-dynamic'

export default async function OperationsPage() {
  await guardPage('/dashboard/keuangan-terpusat/operasi')
  const data = await getOperationsData()

  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader
      title="Operasi & Rekonsiliasi"
      description="Kendalikan tagihan, mutasi bank, settlement gateway, dan tutup buku dari satu workspace."
      eyebrow="Bendahara pusat"
      meta="Selesaikan pengecualian sebelum menutup periode"
    />
    <FinanceNav />
    <FinanceGuide
      purpose="Menjaga kesesuaian catatan aplikasi, settlement gateway, mutasi rekening, dan periode pembukuan."
      prerequisites={['Unduh mutasi resmi dari rekening utama.', 'Siapkan referensi dan tanggal settlement.', 'Pastikan payout gagal sudah ditindaklanjuti.']}
      steps={['Impor mutasi dan periksa hasil matching.', 'Review top-up terlambat dan cocokkan mutasi manual.', 'Tinjau readiness lalu tutup periode bulanan.']}
      notes={['Jangan menutup periode jika masih ada selisih.', 'Reopen membutuhkan dua persetujuan berbeda.', 'Semua review manual masuk audit log.']}
    />
    <OperationsClient data={data} />
  </main>
}
