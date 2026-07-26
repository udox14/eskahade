import { guardPage } from '@/lib/auth/guard'
import { FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getIncidentData } from './actions'
import { IncidentClient } from './_incident-client'

export const dynamic = 'force-dynamic'

export default async function IncidentPage() {
  await guardPage('/dashboard/keuangan-terpusat/insiden')
  const data = await getIncidentData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Incident Keuangan" description="Aktifkan jalur penerimaan darurat dengan dual control dan catat setiap bukti ke ledger." eyebrow={data.scope ? `Scope ${data.scope}` : 'Kontrol pusat'} meta="Maksimal 24 jam · seluruh tindakan diaudit" />
    <FinanceNav />
    <FinanceGuide purpose="Menjaga operasional penerimaan saat jalur normal terganggu tanpa mengorbankan kontrol dan audit." prerequisites={['Pengusul Bendahara dan penyetuju harus berbeda.', 'Tentukan channel dan durasi insiden.', 'Cash wajib memakai shift yang masih terbuka.']} steps={['Checker mengaktifkan incident.', 'Petugas mencatat top-up dan menerbitkan nomor bukti.', 'Bendahara menutup incident setelah kondisi pulih.']} notes={['Transfer wajib memiliki referensi bank.', 'Incident tidak boleh tumpang tindih.', 'Saldo masuk ke wallet Titipan santri.']} />
    <IncidentClient data={data} />
  </main>
}
