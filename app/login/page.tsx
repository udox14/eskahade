import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')
  return <LoginForm />
}