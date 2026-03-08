'use server'

import { clearSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signOut() {
  await clearSession()
  revalidatePath('/', 'layout')
  redirect('/login')
}