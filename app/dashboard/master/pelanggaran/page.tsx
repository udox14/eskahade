import { guardPage } from '@/lib/auth/guard'
import { getCachedMasterPelanggaran } from '@/lib/cache/master'
import MasterPelanggaranContent from './_page-content'

export default async function MasterPelanggaranPage() {
  await guardPage('/dashboard/master/pelanggaran')
  const initialData = await getCachedMasterPelanggaran()

  return <MasterPelanggaranContent initialData={initialData} />
}