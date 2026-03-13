import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import PerpindahanClient from './client'

export const dynamic = 'force-dynamic'

export default async function PerpindahanKamarPage() {
  const session = await getSession()
  if (!session || !['admin', 'pengurus_asrama'].includes(session.role)) {
    redirect('/dashboard')
  }
  return <PerpindahanClient userRole={session.role} asramaBinaan={session.asrama_binaan ?? null} />
}
