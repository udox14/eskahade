import { guardPage } from '@/lib/auth/guard'
import { getSession, hasAnyRole } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import MutasiAsramaClient from './client'

export const dynamic = 'force-dynamic'

export default async function MutasiAsramaPage() {
  await guardPage('/dashboard/asrama/mutasi-asrama')
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama'])) {
    redirect('/dashboard')
  }
  return (
    <MutasiAsramaClient
      userRole={session.role}
      asramaBinaan={session.asrama_binaan ?? null}
      userId={session.id}
    />
  )
}
