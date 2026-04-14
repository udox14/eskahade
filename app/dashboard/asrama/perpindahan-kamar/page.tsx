import { guardPage } from '@/lib/auth/guard'
import { getSession, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import PerpindahanClient from './client'

export const dynamic = 'force-dynamic'

export default async function PerpindahanKamarPage() {
  await guardPage('/dashboard/asrama/perpindahan-kamar')
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama'])) {
    redirect('/dashboard')
  }
  return <PerpindahanClient userRole={session.role} asramaBinaan={session.asrama_binaan ?? null} />
}
