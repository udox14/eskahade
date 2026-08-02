import { guardPage } from '@/lib/auth/guard'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PoskestrenLaporanPage() {
  await guardPage('/dashboard/poskestren/cetak')
  redirect('/dashboard/poskestren/cetak')
}
