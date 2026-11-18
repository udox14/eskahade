import { guardPage } from '@/lib/auth/guard'
import { getTransferQueueAction } from './actions'
import VerifikasiTransferContent from './_page-content'

export const dynamic = 'force-dynamic'

export default async function VerifikasiTransferPage() {
  await guardPage('/dashboard/keuangan/verifikasi-transfer')
  const initialData = await getTransferQueueAction({ status: 'MENUNGGU_VERIFIKASI' })
  return <VerifikasiTransferContent initialData={initialData} />
}
