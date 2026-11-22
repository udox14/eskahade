import { guardPage } from '@/lib/auth/guard'
import { getKasBankData } from './actions'
import KasBankContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function KasBankPage() {
  await guardPage('/dashboard/koperasi/kas-bank')
  const initialData = await getKasBankData()
  return <KasBankContent initialData={initialData} />
}
