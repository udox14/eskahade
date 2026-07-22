import { guardPage } from '@/lib/auth/guard'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCashierBootstrap } from './actions'
import { CashierClient } from './_cashier-client'

export const dynamic = 'force-dynamic'

export default async function CashierPage() {
  await guardPage('/dashboard/keuangan-terpusat/loket')
  const data = await getCashierBootstrap()
  return <main className="space-y-6 p-4 md:p-8"><header><p className="text-sm font-semibold text-emerald-700">Online only · PIN wajib</p><h1 className="text-2xl font-bold">Loket Pencairan</h1></header>
    <CashierClient units={data.units} shift={data.shift} />
    <section><h2 className="mb-3 font-bold">20 transaksi terakhir operator</h2><div className="overflow-hidden rounded-2xl border bg-white">{data.history.length ? data.history.map((row: any) => <div key={row.id} className="flex justify-between border-b px-4 py-3 text-sm last:border-0"><span>{row.nama_lengkap} · {row.nis}</span><strong>Rp {Number(row.amount_rupiah).toLocaleString('id-ID')}</strong></div>) : <p className="p-4 text-sm text-slate-500">Belum ada pencairan.</p>}</div></section>
  </main>
}
