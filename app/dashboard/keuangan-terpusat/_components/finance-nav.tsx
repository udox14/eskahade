import { getEffectiveRoles, getSession } from '@/lib/auth/session'
import { financeQueryOne } from '@/lib/db'
import { financeAsramaScope } from '@/lib/finance/access'
import { getFinanceWorkCounts } from '@/lib/finance/work-counts'
import { FinanceNavClient } from './finance-ui'
import { FinanceCommandPalette } from './finance-command'

const href={
  home:'/dashboard/keuangan-terpusat',
  cashier:'/dashboard/keuangan-terpusat/loket',
  cashUnits:'/dashboard/keuangan-terpusat/unit-kas',
  credentials:'/dashboard/keuangan-terpusat/kredensial',
  payout:'/dashboard/keuangan-terpusat/payout',
  payroll:'/dashboard/keuangan-terpusat/payroll',
  ledger:'/dashboard/keuangan-terpusat/ledger',
  allocation:'/dashboard/keuangan-terpusat/alokasi',
  control:'/dashboard/keuangan-terpusat/kontrol',
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
  const demo=roles.includes('demo')
  const allowed=new Set<string>()

  // Admin teknis tanpa peran keuangan tidak lagi punya jalan masuk. Break-glass
  // dihapus: kalau admin memang perlu mengurus keuangan, beri dia peran bendahara.
  if(demo)Object.values(href).forEach(item=>allowed.add(item))
  if(central)Object.values(href).forEach(item=>allowed.add(item))
  if(council)[href.home,href.payout,href.payroll,href.ledger,href.allocation,href.control,href.operations,href.tariffs].forEach(item=>allowed.add(item))
  if(dorm)[href.home,href.payout,href.ledger,href.allocation].forEach(item=>allowed.add(item))
  if(operator)allowed.add(href.cashier)

  const counts=await getFinanceWorkCounts(financeAsramaScope(session))

  return <FinanceNavClient
    allowedHrefs={[...allowed]}
    sandbox={demo}
    badges={counts}
    commandPalette={<FinanceCommandPalette allowedHrefs={[...allowed]}/>}
  />
}
