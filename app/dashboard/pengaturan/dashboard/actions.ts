'use server'

import { revalidatePath } from 'next/cache'
import { batch, execute, query } from '@/lib/db'
import { getSession, isAdmin } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { DASHBOARD_ROLES, DASHBOARD_WIDGETS, isWidgetKey, type DashboardWidgetKey } from '@/lib/dashboard/catalog'
import { getDashboardAppearance, parseHeroConfig, parseTickerConfig, type Crop } from '@/lib/dashboard/config'

async function assertAdmin() {
  const session = await getSession()
  if (!session || !isAdmin(session)) throw new Error('Akses ditolak')
  return session
}

function contrast(hexA: string, hexB: string) {
  const lum = (hex: string) => {
    const values = [1, 3, 5].map(pos => parseInt(hex.slice(pos, pos + 2), 16) / 255)
    const linear = values.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  const a = lum(hexA)
  const b = lum(hexB)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export async function saveDashboardTicker(input: { text: string; backgroundColor: string; textColor: string }) {
  const session = await assertAdmin()
  if (typeof input.text !== 'string' || input.text.length > 500) throw new Error('Teks maksimal 500 karakter.')
  if (!/^#[0-9a-f]{6}$/i.test(input.backgroundColor) || !/^#[0-9a-f]{6}$/i.test(input.textColor)) {
    throw new Error('Warna tidak valid.')
  }
  if (input.text.trim() && contrast(input.backgroundColor, input.textColor) < 4.5) {
    throw new Error('Kontras warna teks dan latar harus memenuhi WCAG AA.')
  }
  const before = (await getDashboardAppearance()).ticker
  const after = parseTickerConfig(JSON.stringify({ ...input, text: input.text.trim() }))
  await execute(
    "INSERT INTO app_settings (key, value, updated_at) VALUES ('dashboard_ticker', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [JSON.stringify(after)]
  )
  await logActivity({ actor: actorFromSession(session), module: 'dashboard', action: 'update',
    entityType: 'app_setting', entityId: 'dashboard_ticker', entityLabel: 'Running text dashboard',
    summary: 'Mengubah running text dashboard', details: { before, after } })
  revalidatePath('/dashboard')
  return after
}

export async function saveDashboardHero(input: { textColor: 'white' | 'black'; desktop: Crop; mobile: Crop }) {
  const session = await assertAdmin()
  if (input.textColor !== 'white' && input.textColor !== 'black') throw new Error('Warna teks tidak valid.')
  const before = (await getDashboardAppearance()).hero
  const after = parseHeroConfig(JSON.stringify({ ...before, ...input }))
  await execute(
    "INSERT INTO app_settings (key, value, updated_at) VALUES ('dashboard_hero', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [JSON.stringify(after)]
  )
  await logActivity({ actor: actorFromSession(session), module: 'dashboard', action: 'update',
    entityType: 'app_setting', entityId: 'dashboard_hero', entityLabel: 'Hero dashboard',
    summary: 'Mengubah crop atau warna teks hero dashboard', details: { before, after } })
  revalidatePath('/dashboard')
  return after
}

export async function getDashboardRoleWidgetsForAdmin() {
  await assertAdmin()
  return query<{ role: string; widget_key: string; position: number; enabled: number }>(
    'SELECT role, widget_key, position, enabled FROM dashboard_role_widgets ORDER BY role, position'
  )
}

export async function saveDashboardRoleWidgets(role: string, keys: DashboardWidgetKey[]) {
  const session = await assertAdmin()
  if (!DASHBOARD_ROLES.some(value => value === role)) throw new Error('Role tidak valid.')
  if (!Array.isArray(keys) || keys.some(key => !isWidgetKey(key)) || new Set(keys).size !== keys.length) {
    throw new Error('Pilihan widget tidak valid.')
  }
  const before = await query<{ widget_key: string; enabled: number; position: number }>(
    'SELECT widget_key, enabled, position FROM dashboard_role_widgets WHERE role = ? ORDER BY position', [role]
  )
  await batch([
    { sql: 'DELETE FROM dashboard_role_widgets WHERE role = ?', params: [role] },
    ...DASHBOARD_WIDGETS.map((widget, index) => ({
      sql: `INSERT INTO dashboard_role_widgets (role, widget_key, position, enabled, updated_at, updated_by)
            VALUES (?, ?, ?, ?, datetime('now'), ?)`,
      params: [role, widget.key, keys.includes(widget.key) ? keys.indexOf(widget.key) : 100 + index,
        keys.includes(widget.key) ? 1 : 0, session.id],
    })),
  ])
  await logActivity({ actor: actorFromSession(session), module: 'dashboard', action: 'access_change',
    entityType: 'dashboard_role_widgets', entityId: role, entityLabel: role,
    summary: `Mengubah widget dashboard untuk role ${role}`, details: { before, after: keys } })
  revalidatePath('/dashboard')
  return { success: true }
}
