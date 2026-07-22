import { guardPage } from '@/lib/auth/guard'
import { getPayoutData } from './actions'
import { PayoutClient } from './_payout-client'
export const dynamic='force-dynamic'
export default async function PayoutPage(){await guardPage('/dashboard/keuangan-terpusat/payout');const data=await getPayoutData();return <main className="space-y-5 p-4 md:p-8"><header><p className="text-sm font-semibold text-emerald-700">Maker · checker · executor</p><h1 className="text-2xl font-bold">Payout</h1><p className="text-sm text-slate-500">Final hanya setelah sukses provider dan rekonsiliasi.</p></header><PayoutClient payouts={data.payouts} recipients={data.recipients}/></main>}
