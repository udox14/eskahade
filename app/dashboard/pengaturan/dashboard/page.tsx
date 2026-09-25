import { redirect } from 'next/navigation'
import { guardPage } from '@/lib/auth/guard'
import { getSession, isAdmin } from '@/lib/auth/session'
import { getDashboardAppearance } from '@/lib/dashboard/config'
import { DASHBOARD_ROLES, defaultWidgetsForRole, isWidgetKey, type DashboardWidgetKey } from '@/lib/dashboard/catalog'
import { getDashboardRoleWidgetsForAdmin } from './actions'
import { DashboardSettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export default async function DashboardSettingsPage() {
  await guardPage('/dashboard/pengaturan/dashboard')
  const session = await getSession()
  if (!session || !isAdmin(session)) redirect('/dashboard')
  const [appearance, rows] = await Promise.all([
    getDashboardAppearance(), getDashboardRoleWidgetsForAdmin().catch(() => []),
  ])
  const selections: Record<string, DashboardWidgetKey[]> = {}
  for (const role of DASHBOARD_ROLES) {
    const configured = rows.filter(row => row.role === role)
    selections[role] = configured.length
      ? configured.filter(row => row.enabled === 1 && isWidgetKey(row.widget_key))
          .sort((a, b) => a.position - b.position).map(row => row.widget_key as DashboardWidgetKey)
      : defaultWidgetsForRole(role)
  }
  return <DashboardSettingsClient appearance={appearance} selections={selections} />
}
