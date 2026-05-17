import { redirect } from 'next/navigation'

import { guardPage } from '@/lib/auth/guard'
import { getSession, isAdmin } from '@/lib/auth/session'
import SetupTahunAjaranContent from './_page-content'
import { getSetupTahunAjaranState } from './actions'

export const dynamic = 'force-dynamic'

export default async function SetupTahunAjaranPage() {
  await guardPage('/dashboard/setup-tahun-ajaran')
  const session = await getSession()
  if (!session || !isAdmin(session)) redirect('/dashboard')

  const state = await getSetupTahunAjaranState()
  if ('error' in state) redirect('/dashboard')

  return <SetupTahunAjaranContent state={state} />
}
