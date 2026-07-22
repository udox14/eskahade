import { guardPage } from '@/lib/auth/guard'
import { getPayoutData } from './actions'
import { PayoutClient } from './_payout-client'
import { FinanceGuide, FinanceNav, FinancePageHeader, StatusBadge } from '../_components/finance-ui'

export const dynamic = 'force-dynamic'

export default async function PayoutPage() {
  await guardPage('/dashboard/keuangan-terpusat/payout')
  const data = await getPayoutData()
  const pending = data.payouts.filter((p: any) => !['RECONCILED', 'FAILED'].includes(p.status)).length

  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Payout" description="Kelola pengiriman dana melalui alur maker, checker, executor, dan rekonsiliasi." eyebrow="Pemisahan tugas wajib" meta="Payout baru final setelah sukses provider dan cocok dengan mutasi bank" />
    <FinanceNav />
    <FinanceGuide purpose="Mengirim dana makan, laundry, payroll, atau refund dengan persetujuan berlapis dan jejak audit." prerequisites={["Rekening penerima harus aktif dan melewati cooling period 24 jam.", "Maker dan checker wajib orang berbeda."]} steps={["Maker mengajukan payout.", "Checker memeriksa penerima dan nominal.", "Bendahara mengeksekusi lalu merekonsiliasi."]} notes={["Status sukses provider belum berarti final.", "Transfer manual adalah fallback dan wajib memiliki referensi.", "Tidak ada self-approval."]} />
    <div className="flex flex-wrap gap-2 text-xs"><StatusBadge tone={pending ? 'amber' : 'emerald'}>{pending} payout berjalan</StatusBadge><StatusBadge tone="blue">{data.recipients.filter((r: any) => r.status === 'ACTIVE').length} penerima aktif</StatusBadge></div>
    <PayoutClient payouts={data.payouts} recipients={data.recipients} />
  </main>
}
