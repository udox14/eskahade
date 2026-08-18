/* eslint-disable @typescript-eslint/no-explicit-any */
import { guardPage } from '@/lib/auth/guard'
import { getPayoutData } from './actions'
import { PayoutClient } from './_payout-client'
import { FINANCE_GLOSSARY, FinanceGuide, FinancePageHeader, StatusBadge } from '../_components/finance-ui'
import { FinanceNav } from '../_components/finance-nav'

export const dynamic = 'force-dynamic'

export default async function PayoutPage() {
  await guardPage('/dashboard/keuangan-terpusat/payout')
  const data = await getPayoutData()
  const pending = data.payouts.filter((p: any) => !['RECONCILED', 'FAILED'].includes(p.status)).length

  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Payout" description="Kelola pengiriman dana melalui alur maker, checker, executor, dan rekonsiliasi." eyebrow="Pemisahan tugas wajib" meta="Payout baru final setelah sukses provider dan cocok dengan mutasi bank" />
    <FinanceNav />
    <FinanceGuide
      purpose="Mengirim dana makan, laundry, payroll, atau refund dengan persetujuan berlapis dan jejak audit."
      prerequisites={["Rekening penerima sudah didaftarkan dan diverifikasi petugas lain.", "Nomor rekening sudah dikonfirmasi ulang langsung ke pemiliknya.", "Pembuat, pemeriksa, dan pelaksana adalah tiga orang berbeda."]}
      steps={[
        "Maker mengajukan payout beserta nominal dan metode.",
        "Checker memeriksa penerima, nominal, dan biaya, lalu meloloskan.",
        "Executor mengirim dana — via API atau transfer manual dengan nomor bukti.",
        "Setelah cocok dengan mutasi rekening, tandai direkonsiliasi.",
      ]}
      notes={[
        "Status sukses provider belum berarti final — payout baru selesai setelah direkonsiliasi.",
        "Transfer manual dan tunai wajib memiliki nomor referensi atau kuitansi.",
        "Database menolak bila pembuat, pemeriksa, atau pelaksana adalah orang yang sama.",
      ]}
      commonMistakes={[
        "Menandai direkonsiliasi hanya karena provider bilang sukses, tanpa mencocokkan ke mutasi rekening.",
        "Mendaftarkan rekening dengan nomor hasil salah ketik. Nomor disimpan terenkripsi dan hanya tampil tersamar, jadi salah ketik sulit terlihat belakangan.",
        "Menyerahkan uang tunai sebelum eksekusi tercatat, sehingga jurnal dan kas tidak sinkron.",
      ]}
      glossary={[
        FINANCE_GLOSSARY.makerChecker,
        { term: 'BI-Fast', meaning: 'Kanal transfer antarbank yang dipakai payout API. Berjalan langsung dan tidak bisa dibatalkan dari aplikasi.' },
        { term: 'Rekonsiliasi payout', meaning: 'Menandai bahwa dana yang keluar sudah terlihat di mutasi rekening yang sebenarnya.' },
      ]}
    />
    <div className="flex flex-wrap gap-2 text-xs"><StatusBadge tone={pending ? 'amber' : 'emerald'}>{pending} payout berjalan</StatusBadge><StatusBadge tone="blue">{data.recipients.filter((r: any) => r.status === 'ACTIVE').length} penerima aktif</StatusBadge></div>
    <PayoutClient payouts={data.payouts} recipients={data.recipients} apiFeeRupiah={data.apiFeeRupiah} capabilities={data.capabilities} nowMs={data.nowMs} />
  </main>
}
