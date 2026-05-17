import { guardPage } from '@/lib/auth/guard'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function GuardedPage() {
  await guardPage('/dashboard/santri/nonaktif')
  redirect('/dashboard/santri/nonaktif?tab=alumni')
}
