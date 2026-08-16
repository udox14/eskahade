import { getEffectiveRoles, getSession } from '@/lib/auth/session'
import { financeQueryOne } from '@/lib/db'
import { FinanceNavClient } from './finance-ui'

const href={
  home:'/dashboard/keuangan-terpusat',
  cashier:'/dashboard/keuangan-terpusat/loket',
  cashUnits:'/dashboard/keuangan-terpusat/unit-kas',
  credentials:'/dashboard/keuangan-terpusat/kredensial',
  payout:'/dashboard/keuangan-terpusat/payout',
  payroll:'/dashboard/keuangan-terpusat/payroll',
  ledger:'/dashboard/keuangan-terpusat/ledger',
  allocation:'/dashboard/keuangan-terpusat/alokasi',
  incident:'/dashboard/keuangan-terpusat/insiden',
  control:'/dashboard/keuangan-terpusat/kontrol',
  breakGlass:'/dashboard/keuangan-terpusat/break-glass',
  operations:'/dashboard/keuangan-terpusat/operasi',
  tariffs:'/dashboard/keuangan-terpusat/tarif-layanan',
} as const

export async function FinanceNav(){
  const session=await getSession()
  if(!session)return null
  const roles=getEffectiveRoles(session)
  const central=roles.includes('bendahara')
  const council=roles.includes('dewan_santri')&&roles.includes('jabatan:bendahara')
  const dorm=roles.includes('pengurus_asrama')&&roles.includes('jabatan:bendahara')
  const operator=roles.includes('operator_loket')
  const admin=roles.includes('admin')
  const demo=roles.includes('demo')
  const native=central||council||dorm
  const activeBreakGlass=admin&&!native?Boolean(await financeQueryOne<{id:string}>(`SELECT id FROM finance_break_glass WHERE user_id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime('now') LIMIT 1`,[session.id])):false
  const allowed=new Set<string>()

  if(demo)Object.values(href).forEach(item=>allowed.add(item))
  if(central||activeBreakGlass){
    Object.values(href).forEach(item=>allowed.add(item))
    if(!admin)allowed.delete(href.breakGlass)
  }
  if(council)[href.home,href.payout,href.payroll,href.ledger,href.allocation,href.incident,href.control,href.breakGlass,href.operations,href.tariffs].forEach(item=>allowed.add(item))
  if(dorm)[href.home,href.payout,href.ledger,href.allocation,href.incident].forEach(item=>allowed.add(item))
  if(operator)allowed.add(href.cashier)
  if(admin)allowed.add(href.breakGlass)

  return <FinanceNavClient allowedHrefs={[...allowed]} sandbox={demo}/>
}
