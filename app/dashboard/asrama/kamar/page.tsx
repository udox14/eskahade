import { guardPage } from '@/lib/auth/guard'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import KamarClient from './client'

export const dynamic = 'force-dynamic'

export default async function KamarPage() {
  await guardPage('/dashboard/asrama/kamar')
  const session = await getSession()
  if (!session) {
    redirect('/dashboard')
  }
  return <KamarClient userRole={session.role} asramaBinaan={session.asrama_binaan ?? null} />
}
