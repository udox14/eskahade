import { guardPage } from '@/lib/auth/guard'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPayrollData } from './actions'
import { PayrollClient } from './_payroll-client'
export const dynamic='force-dynamic'
export default async function PayrollPage(){await guardPage('/dashboard/keuangan-terpusat/payroll');const data=await getPayrollData();return <main className="space-y-5 p-4 md:p-8"><header><p className="text-sm font-semibold text-emerald-700">Submodul terpisah · ledger bersama</p><h1 className="text-2xl font-bold">Payroll Guru</h1></header><PayrollClient periods={data.periods}/><section className="rounded-2xl border bg-white"><h2 className="border-b p-4 font-bold">Item per guru</h2>{data.items.length?data.items.map((i:any)=><div key={i.id} className="flex justify-between border-b p-4 last:border-0"><span>{i.teacher_name||i.teacher_id}</span><strong>Rp {Number(i.net_rupiah).toLocaleString('id-ID')} · {i.status}</strong></div>):<p className="p-4 text-sm text-slate-500">Belum dihitung.</p>}</section></main>}
