import { requirePortalSessionStrict } from '@/lib/portal/session'
import { financeQuery as query } from '@/lib/db'
import { syncFinanceStudentSnapshot, syncFinanceStudentsByIds, financeStudentIdsForGuardian } from '@/lib/finance/snapshots'
import { FinanceClient } from './_finance-client'
import { switchPortalStudent } from './switch-actions'

export const dynamic = 'force-dynamic'
const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

export default async function PortalFinancePage() {
  const session = await requirePortalSessionStrict()
  await syncFinanceStudentSnapshot(session.santri_id)
  const balances = await query<{ wallet_kind: string; balance_rupiah: number }>(`SELECT wallet_kind,balance_rupiah FROM finance_student_wallets WHERE santri_id=? ORDER BY wallet_kind`, [session.santri_id])
  const methods = (process.env.DUITKU_PAYMENT_METHODS || '').split(',').map(x => x.trim()).filter(Boolean)
  const limits = (await query<{ daily_rupiah: number | null; weekly_rupiah: number | null; monthly_rupiah: number | null }>(`SELECT daily_rupiah,weekly_rupiah,monthly_rupiah FROM finance_withdrawal_limits WHERE santri_id=?`, [session.santri_id]))[0] || null
  const withdrawals = await query<{ id:string; amount_rupiah:number; credential_kind:string; created_at:string }>(`SELECT id,amount_rupiah,credential_kind,created_at FROM finance_withdrawals WHERE santri_id=? AND status='SUCCESS' ORDER BY created_at DESC LIMIT 30`,[session.santri_id])
  if (session.guardian_id) await syncFinanceStudentsByIds(await financeStudentIdsForGuardian(session.guardian_id))
  const children = session.guardian_id ? await query<{ id: string; nama_lengkap: string }>(`SELECT s.santri_id id,s.full_name nama_lengkap FROM finance_guardian_students gs JOIN finance_student_snapshots s ON s.santri_id=gs.santri_id WHERE gs.guardian_id=? AND s.status_global='aktif' ORDER BY s.full_name`, [session.guardian_id]) : []
  return <main className="space-y-5 bg-slate-50 p-4 pb-28">
    <header><p className="text-sm text-emerald-700">Keuangan {session.nama}</p><h1 className="text-2xl font-bold">Saldo & alokasi</h1>{children.length>1&&<form action={switchPortalStudent} className="mt-3"><select name="santriId" defaultValue={session.santri_id} className="w-full rounded-xl border bg-white px-3 py-2" onChange={undefined}>{children.map(child=><option key={child.id} value={child.id}>{child.nama_lengkap}</option>)}</select><button className="mt-2 rounded-lg border px-3 py-1 text-sm">Ganti anak</button></form>}</header>
    <section className="grid grid-cols-2 gap-3">
      {(['TITIPAN','JAJAN','MAKAN','LAUNDRY'] as const).map(kind => {
        const value = Number(balances.find(row => row.wallet_kind === kind)?.balance_rupiah || 0)
        return <div key={kind} className="rounded-2xl bg-emerald-900 p-4 text-white"><p className="text-xs text-emerald-200">{kind}</p><p className="mt-1 font-bold">{rupiah(value)}</p></div>
      })}
    </section>
    <FinanceClient methods={methods} limits={limits} />
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><h2 className="font-bold">Riwayat pencairan</h2>{withdrawals.length?withdrawals.map(item=><div key={item.id} className="flex justify-between border-b py-3 text-sm last:border-0"><span>{new Date(item.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})}<small className="block text-slate-500">{item.credential_kind}</small></span><strong>Rp {Number(item.amount_rupiah).toLocaleString('id-ID')}</strong></div>):<p className="mt-3 text-sm text-slate-500">Belum ada pencairan.</p>}</section>
  </main>
}
