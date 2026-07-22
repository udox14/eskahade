import Link from 'next/link'
import { Landmark, ScanLine, SendHorizontal, BadgeDollarSign, AlertTriangle, CreditCard, Settings2 } from 'lucide-react'
import { guardPage } from '@/lib/auth/guard'
import { financeAsramaScope, requireFinanceAccess } from '@/lib/finance/access'
import { getFinanceDashboard } from '@/lib/finance/dashboard'

export const dynamic = 'force-dynamic'

const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

export default async function CentralFinancePage() {
  await guardPage('/dashboard/keuangan-terpusat')
  const session = await requireFinanceAccess('VIEW')
  const scope = financeAsramaScope(session)
  const data = await getFinanceDashboard(scope)
  const totalAlerts = data.alerts.reduce((sum, row) => sum + Number(row.count), 0)

  return <main className="space-y-6 p-4 md:p-8">
    <header>
      <p className="text-sm font-semibold text-emerald-700">Ledger baru · terpisah dari legacy</p>
      <h1 className="text-2xl font-bold text-slate-900">Keuangan Terpusat</h1>
      <p className="mt-1 text-sm text-slate-500">{scope ? `Scope asrama: ${scope}` : 'Scope global'} · nominal integer rupiah · jurnal immutable</p>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { href: '/dashboard/keuangan-terpusat', label: 'Ledger & saldo', icon: Landmark },
        { href: '/dashboard/keuangan-terpusat/loket', label: 'Loket pencairan', icon: ScanLine },
        { href: '/dashboard/keuangan-terpusat/kredensial', label: 'RFID / QR', icon: CreditCard },
        { href: '/dashboard/keuangan-terpusat/operasi', label: 'Operasi & rekonsiliasi', icon: Settings2 },
        { href: '/dashboard/keuangan-terpusat/payout', label: 'Payout', icon: SendHorizontal },
        { href: '/dashboard/keuangan-terpusat/payroll', label: 'Payroll', icon: BadgeDollarSign },
      ].map(item => <Link key={item.href + item.label} href={item.href} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300">
        <item.icon className="h-6 w-6 text-emerald-700" /><span className="font-semibold">{item.label}</span>
      </Link>)}
    </section>

    {totalAlerts > 0 && <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <AlertTriangle className="mt-0.5 h-5 w-5" />
      <div><p className="font-semibold">{totalAlerts} pengecualian perlu ditinjau</p>
        <p className="text-sm">Top-up terlambat, transaksi bank belum cocok, atau payout gagal tidak disembunyikan.</p></div>
    </section>}

    <section>
      <h2 className="mb-3 text-lg font-bold">Saldo chart of accounts</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Akun</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3 text-right">Saldo natural</th></tr></thead>
          <tbody>{data.accountBalances.map(row => <tr key={row.code} className="border-t border-slate-100"><td className="px-4 py-3 font-mono">{row.code}</td><td className="px-4 py-3">{row.name}</td><td className="px-4 py-3 text-slate-500">{row.account_type}</td><td className="px-4 py-3 text-right font-semibold">{rupiah(Number(row.balance_rupiah))}</td></tr>)}</tbody>
        </table></div>
      </div>
    </section>

    <section className="grid gap-6 lg:grid-cols-2">
      <div><h2 className="mb-3 text-lg font-bold">Subledger santri</h2><div className="rounded-2xl border border-slate-200 bg-white p-4">
        {data.walletTotals.length ? data.walletTotals.map(row => <div key={row.wallet_kind} className="flex justify-between border-b border-slate-100 py-2 last:border-0"><span>{row.wallet_kind}</span><strong>{rupiah(Number(row.balance_rupiah))}</strong></div>) : <p className="text-sm text-slate-500">Belum ada saldo di sistem baru.</p>}
      </div></div>
      <div><h2 className="mb-3 text-lg font-bold">Jurnal terbaru</h2><div className="rounded-2xl border border-slate-200 bg-white p-4">
        {data.recentTransactions.length ? data.recentTransactions.map(row => <div key={row.id} className="border-b border-slate-100 py-2 last:border-0"><p className="font-medium">{row.description}</p><p className="text-xs text-slate-500">{row.effective_date} · {row.source_type}</p></div>) : <p className="text-sm text-slate-500">Belum ada jurnal terposting.</p>}
      </div></div>
    </section>
  </main>
}
