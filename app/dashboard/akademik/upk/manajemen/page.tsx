import { guardPage } from '@/lib/auth/guard'
import { getSession, isAdmin as checkAdmin } from '@/lib/auth/session'
import ManajemenUPKClient from './manajemen-client'

export const dynamic = 'force-dynamic'

export default async function ManajemenUPKPage() {
  await guardPage('/dashboard/akademik/upk/manajemen')
  const session = await getSession()
  const userIsAdmin = checkAdmin(session)
  return <ManajemenUPKClient isAdmin={userIsAdmin} />
}
