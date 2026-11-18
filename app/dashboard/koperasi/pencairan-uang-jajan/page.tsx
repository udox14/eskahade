import { guardPage } from '@/lib/auth/guard'
import { getPencairanInitialData } from './actions'
import PencairanContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function PencairanUangJajanPage() {
  await guardPage('/dashboard/koperasi/pencairan-uang-jajan')
  const initialData = await getPencairanInitialData()
  return <PencairanContent initialData={initialData} />
}
