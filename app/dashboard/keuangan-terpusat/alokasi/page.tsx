import { guardPage } from '@/lib/auth/guard'
import { FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getAllocationData } from './actions'
import { AllocationClient } from './_allocation-client'

export const dynamic = 'force-dynamic'

export default async function AllocationPage() {
  await guardPage('/dashboard/keuangan-terpusat/alokasi')
  const data = await getAllocationData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Alokasi Dana" description="Telusuri perpindahan Titipan ke kebutuhan santri dan kembalikan dana yang belum digunakan." eyebrow={data.scope ? `Scope ${data.scope}` : 'Scope global'} meta="Return mengikuti cutoff dan saldo aktual" />
    <FinanceNav />
    <FinanceGuide purpose="Memastikan dana Titipan bergerak ke tujuan yang benar dan sisa yang sah dapat dikembalikan." prerequisites={['Pastikan layanan belum mencairkan dana.', 'Periksa cutoff dan saldo wallet tujuan.']} steps={['Cari alokasi berdasarkan santri atau referensi.', 'Buka detail dan periksa status.', 'Kembalikan alokasi yang masih memenuhi syarat.']} notes={['SPP/USPP/Non-SPP tidak dapat direturn dari halaman ini.', 'Return membuat jurnal baru dan tidak menghapus jurnal awal.', 'Saldo tujuan tidak boleh menjadi negatif.']} />
    <AllocationClient data={data} />
  </main>
}
