'use server'

import { batch } from '@/lib/db'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getSession, getEffectiveRoles, isAdmin } from '@/lib/auth/session'
import { getFiturForRoles } from '@/lib/cache/fitur-akses'
import { getDashboardWidgetKeys } from '@/lib/dashboard/config'
import { loadDashboardWidgets } from '@/lib/dashboard/data'

export async function saveDashboardShortcuts(ids: number[]) {
  const session = await getSession()
  if (!session) throw new Error('Sesi berakhir. Silakan masuk kembali.')
  if (!Array.isArray(ids) || ids.length > 8 || new Set(ids).size !== ids.length ||
      ids.some(id => !Number.isInteger(id))) throw new Error('Pilih maksimal delapan pintasan unik.')
  const allowed = await getFiturForRoles(getEffectiveRoles(session), session.id)
  const allowedIds = new Set(allowed.filter(item => item.is_active && item.href !== '/dashboard' && (isAdmin(session) || item.href !== '/dashboard/pengaturan/dashboard')).map(item => item.id))
  if (ids.some(id => !allowedIds.has(id))) throw new Error('Ada pintasan yang tidak diizinkan.')
  const statements = [
    { sql: 'DELETE FROM dashboard_user_shortcuts WHERE user_id = ?', params: [session.id] },
    { sql: "INSERT INTO dashboard_user_shortcut_state (user_id, updated_at) VALUES (?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET updated_at = excluded.updated_at", params: [session.id] },
    ...ids.map((id, position) => ({
      sql: 'INSERT INTO dashboard_user_shortcuts (user_id, fitur_id, position) VALUES (?, ?, ?)',
      params: [session.id, id, position],
    })),
  ]
  const roles = getEffectiveRoles(session)
  if (roles.includes('tester') && !roles.includes('admin') && !roles.includes('demo')) {
    // Tester remains read-only for domain data; personal menu preferences are the only exception.
    const { env } = await getCloudflareContext({ async: true })
    await env.DB.batch(statements.map(statement => env.DB.prepare(statement.sql).bind(...statement.params)))
  } else {
    await batch(statements)
  }
  return { success: true }
}

export async function refreshDashboardWidgets() {
  const session = await getSession()
  if (!session) throw new Error('Sesi berakhir. Silakan masuk kembali.')
  const roles = getEffectiveRoles(session)
  const allowed = await getFiturForRoles(roles, session.id)
  const keys = await getDashboardWidgetKeys(roles, allowed)
  return loadDashboardWidgets(session, new Set(allowed.map(item => item.href)), keys, true)
}
