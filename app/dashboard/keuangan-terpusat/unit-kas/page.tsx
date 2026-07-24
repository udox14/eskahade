import { guardPage } from '@/lib/auth/guard'
import { FinanceGuide, FinanceNav, FinancePageHeader, MetricCard } from '../_components/finance-ui'
import { getCashUnitManagementData } from './actions'
import { CashUnitClient } from './_cash-unit-client'

export const dynamic = 'force-dynamic'

export default async function CashUnitPage() {
  await guardPage('/dashboard/keuangan-terpusat/unit-kas')
  const data = await getCashUnitManagementData()
  const activeUnits = data.units.filter(unit => Number(unit.is_active) === 1).length
  const openShifts = data.shifts.filter(shift => shift.status === 'OPEN').length
  const pendingReview = data.shifts.filter(shift => shift.status === 'CLOSED_REVIEW' && !shift.supervisor_id).length
  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Unit Kas" description="Atur lokasi kas, saldo tetap, operator, dan review penutupan shift." eyebrow="Khusus bendahara" meta="Operator hanya dapat memakai unit yang ditugaskan" />
    <FinanceNav showCashUnits />
    <FinanceGuide purpose="Menentukan siapa yang boleh memegang kas fisik dan memastikan setiap shift dapat dipertanggungjawabkan." prerequisites={["Tambahkan role Operator Loket pada akun petugas.","Tentukan scope asrama untuk unit lokal.","Tetapkan saldo kas tetap sebagai acuan pembukaan."]} steps={["Buat Unit Kas.","Tugaskan operator yang berwenang.","Pantau shift dan review setiap selisih."]} notes={["Unit dan assignment dengan shift aktif tidak dapat dinonaktifkan.","Operator tetap wajib menghitung kas fisik.","Review bendahara tidak mengubah nilai selisih."]} />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Unit aktif" value={String(activeUnits)} detail={`${data.units.length} total Unit Kas`} icon="wallet" />
      <MetricCard label="Operator tersedia" value={String(data.operators.length)} detail="Memiliki role Operator Loket" icon="layers" tone="blue" />
      <MetricCard label="Shift terbuka" value={String(openShifts)} detail="Sedang memegang kas" icon="receipt" tone={openShifts ? 'emerald' : 'slate'} />
      <MetricCard label="Perlu review" value={String(pendingReview)} detail="Selisih belum diperiksa" icon="listChecks" tone={pendingReview ? 'amber' : 'emerald'} />
    </section>
    <CashUnitClient data={data} />
  </main>
}
