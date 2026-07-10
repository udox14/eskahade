import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal/session'

export const dynamic = 'force-dynamic'

export default async function PortalOrtuIndexPage() {
  const session = await getPortalSession()
  redirect(session ? '/portal-ortu/beranda' : '/portal-ortu/login')
}
