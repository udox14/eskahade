import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import LoginForm from './login-form'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Login Pengurus — ESKAHADE',
  description: 'Akses pengurus Pondok Pesantren Sukahideng ke dashboard ESKAHADE.',
}

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')
  return <LoginForm />
}
