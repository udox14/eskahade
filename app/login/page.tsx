// Server Component — cek session server-side, redirect kalau sudah login
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import LoginClient from './login-client'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export default async function LoginPage() {
  const session = await getSession()
  if (session) {
    redirect('/dashboard')
  }
  return <LoginClient />
}