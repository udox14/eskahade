import { guardPage } from '@/lib/auth/guard'
import { FINANCE_GLOSSARY, FinanceGuide, FinancePageHeader, MetricCard } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'
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
    <FinanceNav />
    <FinanceGuide
      purpose="Menentukan siapa yang boleh memegang kas fisik dan memastikan setiap shift dapat dipertanggungjawabkan."
      prerequisites={['Tambahkan role Operator Loket pada akun petugas lebih dulu.', 'Tentukan scope asrama untuk unit yang melayani satu asrama saja.', 'Tetapkan saldo kas tetap sebagai acuan pembukaan shift.']}
      steps={[
        'Buat satu Unit Kas untuk tiap loket fisik.',
        'Tugaskan operator yang berwenang memegang kasnya.',
        'Pantau shift berjalan dari daftar riwayat.',
        'Review setiap shift yang ditutup dengan selisih.',
      ]}
      notes={[
        'Unit dan penugasan dengan shift terbuka tidak dapat dinonaktifkan.',
        'Operator tetap wajib menghitung kas fisik saat buka dan tutup shift.',
        'Review bendahara mencatat pemeriksaan, tidak mengubah nilai selisih.',
      ]}
      commonMistakes={[
        'Membuat satu Unit Kas untuk beberapa loket sekaligus. Selisih jadi tidak bisa ditelusuri ke laci kas mana.',
        'Menugaskan operator tanpa memberi role Operator Loket lebih dulu — penugasannya akan ditolak.',
        'Mengosongkan scope asrama pada unit yang sebenarnya hanya melayani satu asrama, sehingga santri luar asrama ikut bisa dilayani.',
        'Menganggap review selisih memperbaiki angka kas. Review hanya mencatat bahwa selisihnya sudah diperiksa.',
      ]}
      glossary={[
        { term: 'Unit Kas', meaning: 'Satu titik layanan loket dengan laci kas sendiri. Menjadi dasar penelusuran setiap rupiah yang keluar.' },
        { term: 'Saldo kas tetap', meaning: 'Jumlah uang yang biasanya disiapkan di laci saat loket dibuka. Hanya acuan — operator tetap mengisi hasil hitung nyata.' },
        { term: 'Shift', meaning: 'Satu sesi layanan oleh satu operator di satu terminal. Satu operator hanya boleh punya satu shift terbuka.' },
        FINANCE_GLOSSARY.makerChecker,
      ]}
    />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Unit aktif" value={String(activeUnits)} detail={`${data.units.length} total Unit Kas`} icon="wallet" />
      <MetricCard label="Operator tersedia" value={String(data.operators.length)} detail="Memiliki role Operator Loket" icon="layers" tone="blue" />
      <MetricCard label="Shift terbuka" value={String(openShifts)} detail="Sedang memegang kas" icon="receipt" tone={openShifts ? 'emerald' : 'slate'} />
      <MetricCard label="Perlu review" value={String(pendingReview)} detail="Selisih belum diperiksa" icon="listChecks" tone={pendingReview ? 'amber' : 'emerald'} />
    </section>
    <CashUnitClient data={data} />
  </main>
}
