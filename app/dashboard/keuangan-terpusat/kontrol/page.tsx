import { guardPage } from '@/lib/auth/guard'
import { FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getFinanceControlData } from './actions'
import { FinanceControlClient } from './_control-client'

export const dynamic='force-dynamic'

export default async function FinanceControlPage(){
  await guardPage('/dashboard/keuangan-terpusat/kontrol')
  const data=await getFinanceControlData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Kontrol & Audit" description="Pantau audit trail, pengaturan runtime, outbox, MFA, sesi staf, dan percobaan autentikasi." eyebrow="Kontrol internal" meta="Akses tindakan mengikuti pemisahan bendahara dan checker"/>
    <FinanceNav/>
    <FinanceGuide purpose="Menyatukan kontrol operasional dan bukti audit tanpa mengekspos secret keamanan." prerequisites={['Pastikan perubahan setting telah disetujui.','Tinjau event outbox gagal sebelum retry.']} steps={['Periksa indikator kontrol.','Tindak lanjuti setting, outbox, atau sesi.', 'Checker menelusuri audit trail.']} notes={['Secret MFA dan hash identitas tidak tampil.','Retry tidak menandai event sebagai SENT.','Semua perubahan kontrol diaudit.']}/>
    <FinanceControlClient data={data}/>
  </main>
}
