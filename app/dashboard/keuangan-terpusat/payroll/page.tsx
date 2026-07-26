import { guardPage } from '@/lib/auth/guard'
import { FinanceGuide, FinancePageHeader } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
import { getPayrollData } from './actions'
import { PayrollClient } from './_payroll-client'

export const dynamic = 'force-dynamic'

export default async function PayrollPage() {
  await guardPage('/dashboard/keuangan-terpusat/payroll')
  const data = await getPayrollData()
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Payroll Guru" description="Kelola kebijakan, kompensasi, absensi terverifikasi, perhitungan, dan akrual payroll." eyebrow="Submodul terpisah · ledger bersama" meta="Tarif mengikuti versi efektif pada periode" />
    <FinanceNav />
    <FinanceGuide purpose="Menghitung payroll secara konsisten dari master kompensasi dan data kehadiran yang sudah diverifikasi." prerequisites={['Snapshot guru dan tarif efektif tersedia.', 'Semua sesi memiliki guru terjadwal serta status.', 'Checker siap memverifikasi absensi dan batch.']} steps={['Buat kebijakan, kompensasi, dan periode.', 'Catat lalu verifikasi absensi.', 'Kunci, hitung, periksa, dan setujui batch.']} notes={['Absensi kosong tidak dianggap hadir.', 'Versi kebijakan lama tidak ditimpa.', 'Perubahan tarif memakai tanggal efektif baru.']} />
    <PayrollClient data={data} />
  </main>
}
