import { requireFinanceAccess,financeRoles } from '@/lib/finance/access'
import { CoopNav } from './cooperative-ui'
export async function FinanceNav(){const session=await requireFinanceAccess('VIEW'),r=financeRoles(session);return <CoopNav write={r.admin||r.operator} configure={r.admin}/>}
