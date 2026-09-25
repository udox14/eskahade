import { guardRole } from '@/lib/auth/guard'
import { getSession, getEffectiveRoles, isAdmin } from '@/lib/auth/session'
import { getFiturForRoles } from '@/lib/cache/fitur-akses'
import { getDashboardAppearance, getDashboardShortcuts, getDashboardWidgetKeys } from '@/lib/dashboard/config'
import { loadDashboardWidgets } from '@/lib/dashboard/data'
import { capitalizeEachWord } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { HomeClient } from './home-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  await guardRole()
  const session = await getSession()
  if (!session) redirect('/login')

  const roles = getEffectiveRoles(session)
  const menu = (await getFiturForRoles(roles, session.id)).filter(item => isAdmin(session) || item.href !== '/dashboard/pengaturan/dashboard')
  const [appearance, shortcuts, keys] = await Promise.all([
    getDashboardAppearance(),
    getDashboardShortcuts(session.id, menu),
    getDashboardWidgetKeys(roles, menu),
  ])
  const widgets = await loadDashboardWidgets(session, new Set(menu.map(item => item.href)), keys)
  const now = new Date()
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(now))
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam'
  const dateLabel = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)

  return <HomeClient
    userName={capitalizeEachWord(session.full_name || 'Pengguna')}
    greeting={greeting}
    dateLabel={dateLabel}
    isAdmin={isAdmin(session)}
    menu={menu}
    initialShortcuts={shortcuts}
    initialWidgets={widgets}
    hero={appearance.hero}
    ticker={appearance.ticker}
  />
}
