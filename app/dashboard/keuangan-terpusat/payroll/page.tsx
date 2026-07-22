import { guardPage } from '@/lib/auth/guard'
import { getPayrollData } from './actions'
import { PayrollClient } from './_payroll-client'
import { FinanceGuide, FinanceNav, FinancePageHeader, SectionPanel, StatusBadge } from '../_components/finance-ui'

export const dynamic = 'force-dynamic'

export default async function PayrollPage() {
  await guardPage('/dashboard/keuangan-terpusat/payroll')
  const data = await getPayrollData()

  return <main className="space-y-4 sm:space-y-5">
    <FinancePageHeader title="Payroll Guru" description="Proses gaji tetap dan honor mengajar dari absensi terverifikasi sampai payout per guru." eyebrow="Submodul terpisah · ledger bersama" meta="Formula dan tarif mengikuti versi kebijakan pada periode" />
    <FinanceNav />
    <FinanceGuide purpose="Menghitung payroll secara konsisten dari data kehadiran yang sudah dikunci akademik." prerequisites={["Semua sesi mengajar sudah memiliki guru aktual dan status.", "Absensi periode sudah diverifikasi.", "Tarif dan kebijakan efektif tersedia."]} steps={["Buat periode dan kunci absensi.", "Hitung payroll lalu periksa hasil per guru.", "Checker menyetujui batch; payout diproses per guru."]} notes={["Data absensi kosong tidak dianggap hadir.", "Persetujuan batch tidak menyamakan status payout tiap guru.", "Perubahan kebijakan tidak mengubah periode lama."]} />
    <PayrollClient periods={data.periods} />
    <SectionPanel title="Rincian payroll per guru" description="Nilai bersih dan status terakhir untuk audit serta tindak lanjut payout.">
      <div className="divide-y divide-slate-100 sm:hidden">{data.items.length ? data.items.map((item: any) => <article key={item.id} className="space-y-2 px-4 py-3 text-xs"><div className="flex items-start justify-between gap-3"><p className="min-w-0 break-words font-semibold text-slate-800">{item.teacher_name || item.teacher_id}</p><StatusBadge tone={item.status === 'PAID' ? 'emerald' : item.status === 'APPROVED' ? 'blue' : 'amber'}>{item.status}</StatusBadge></div><p className="font-bold tabular-nums text-slate-900">Rp {Number(item.net_rupiah).toLocaleString('id-ID')}</p></article>) : <p className="px-4 py-10 text-center text-sm text-slate-500">Belum ada payroll yang dihitung.</p>}</div>
      <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[560px] text-xs"><thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2.5">Guru</th><th className="px-4 py-2.5 text-right">Gaji bersih</th><th className="px-4 py-2.5">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data.items.length ? data.items.map((item: any) => <tr key={item.id}><td className="px-4 py-3 font-semibold">{item.teacher_name || item.teacher_id}</td><td className="px-4 py-3 text-right font-bold tabular-nums">Rp {Number(item.net_rupiah).toLocaleString('id-ID')}</td><td className="px-4 py-3"><StatusBadge tone={item.status === 'PAID' ? 'emerald' : item.status === 'APPROVED' ? 'blue' : 'amber'}>{item.status}</StatusBadge></td></tr>) : <tr><td colSpan={3} className="p-10 text-center text-sm text-slate-500">Belum ada payroll yang dihitung.</td></tr>}</tbody></table></div>
    </SectionPanel>
  </main>
}
