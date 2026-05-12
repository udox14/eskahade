import { redirect } from 'next/navigation'
import { guardPage } from '@/lib/auth/guard'
import { getSession } from '@/lib/auth/session'
import PlottingKamarManualClient from './client'

export const dynamic = 'force-dynamic'

export default async function PlottingKamarManualPage() {
  await guardPage('/dashboard/asrama/plotting-kamar-manual')
  const session = await getSession()
  if (!session) redirect('/dashboard')

  return (
    <PlottingKamarManualClient
      userRole={session.role}
      asramaBinaan={session.asrama_binaan ?? null}
    />
  )
}
