import { query, queryOne } from '@/lib/db'
import type { FiturAkses } from '@/lib/cache/fitur-akses'
import { DASHBOARD_ROLES, DASHBOARD_WIDGETS, defaultWidgetsForRole, isWidgetKey, widgetIsAllowed, type DashboardWidgetKey } from './catalog'

export type Crop = { x: number; y: number; zoom: number }
export type HeroConfig = {
  imageUrl: string
  textColor: 'white' | 'black'
  desktop: Crop
  mobile: Crop
}
export type TickerConfig = { text: string; backgroundColor: string; textColor: string }

export const DEFAULT_HERO: HeroConfig = {
  imageUrl: '/dashboard-hero-default.webp',
  textColor: 'white',
  desktop: { x: 50, y: 50, zoom: 1 },
  mobile: { x: 56, y: 50, zoom: 1 },
}
export const DEFAULT_TICKER: TickerConfig = {
  text: 'Selamat datang di ESKAHADE. Pantau kegiatan pesantren dan tindak lanjuti hal yang perlu perhatian.', backgroundColor: '#12372a', textColor: '#ffffff',
}

function crop(value: unknown, fallback: Crop): Crop {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Crop>
  return {
    x: Number.isFinite(raw.x) ? Math.min(100, Math.max(0, Number(raw.x))) : fallback.x,
    y: Number.isFinite(raw.y) ? Math.min(100, Math.max(0, Number(raw.y))) : fallback.y,
    zoom: Number.isFinite(raw.zoom) ? Math.min(2.5, Math.max(1, Number(raw.zoom))) : fallback.zoom,
  }
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

export function parseHeroConfig(value: string | null): HeroConfig {
  try {
    const raw = JSON.parse(value || '{}') as Partial<HeroConfig>
    return {
      imageUrl: typeof raw.imageUrl === 'string' && (raw.imageUrl.startsWith('/api/file/dashboard/') || raw.imageUrl === DEFAULT_HERO.imageUrl)
        ? raw.imageUrl : DEFAULT_HERO.imageUrl,
      textColor: raw.textColor === 'black' ? 'black' : 'white',
      desktop: crop(raw.desktop, DEFAULT_HERO.desktop),
      mobile: crop(raw.mobile, DEFAULT_HERO.mobile),
    }
  } catch { return DEFAULT_HERO }
}

export function parseTickerConfig(value: string | null): TickerConfig {
  try {
    const raw = JSON.parse(value || '{}') as Partial<TickerConfig>
    return {
      text: typeof raw.text === 'string' ? raw.text.slice(0, 500) : DEFAULT_TICKER.text,
      backgroundColor: color(raw.backgroundColor, DEFAULT_TICKER.backgroundColor),
      textColor: color(raw.textColor, DEFAULT_TICKER.textColor),
    }
  } catch { return DEFAULT_TICKER }
}

export async function getDashboardAppearance() {
  try {
    const rows = await query<{ key: string; value: string }>(
      "SELECT key, value FROM app_settings WHERE key IN ('dashboard_hero', 'dashboard_ticker')"
    )
    const values = new Map(rows.map(row => [row.key, row.value]))
    return {
      hero: parseHeroConfig(values.get('dashboard_hero') ?? null),
      ticker: parseTickerConfig(values.get('dashboard_ticker') ?? null),
    }
  } catch { return { hero: DEFAULT_HERO, ticker: DEFAULT_TICKER } }
}

export async function getDashboardShortcuts(userId: string, allowed: FiturAkses[]) {
  const menu = allowed.filter(item => item.is_active && item.href !== '/dashboard')
  const byId = new Map(menu.map(item => [item.id, item]))
  try {
    const configured = await queryOne<{ user_id: string }>(
      'SELECT user_id FROM dashboard_user_shortcut_state WHERE user_id = ?', [userId]
    )
    if (configured) {
      const rows = await query<{ fitur_id: number }>(
        'SELECT fitur_id FROM dashboard_user_shortcuts WHERE user_id = ? ORDER BY position', [userId]
      )
      return rows.map(row => byId.get(row.fitur_id)).filter((item): item is FiturAkses => !!item).slice(0, 8)
    }
  } catch { /* Migration pending: use menu-derived defaults. */ }
  const pinned = menu.filter(item => item.is_bottomnav).sort((a, b) => a.bottomnav_urutan - b.bottomnav_urutan)
  return [...new Map([...pinned, ...menu].map(item => [item.id, item])).values()].slice(0, 8)
}

type RoleWidgetRow = { role: string; widget_key: string; position: number; enabled: number }

export async function getDashboardWidgetKeys(roles: string[], allowed: FiturAkses[]): Promise<DashboardWidgetKey[]> {
  const uniqueRoles = [...new Set(roles.filter(role => DASHBOARD_ROLES.some(configurable => configurable === role)))]
  if (uniqueRoles.length === 0) return []
  let rows: RoleWidgetRow[] = []
  try {
    rows = await query<RoleWidgetRow>(
      `SELECT role, widget_key, position, enabled FROM dashboard_role_widgets WHERE role IN (${uniqueRoles.map(() => '?').join(',')})`,
      uniqueRoles
    )
  } catch { /* Migration pending: use catalog defaults. */ }
  const scores = new Map<DashboardWidgetKey, number>()
  uniqueRoles.forEach((role, roleIndex) => {
    const configured = rows.filter(row => row.role === role)
    const selected = configured.length
      ? configured.filter(row => row.enabled === 1 && isWidgetKey(row.widget_key)).map(row => ({ key: row.widget_key as DashboardWidgetKey, order: row.position }))
      : defaultWidgetsForRole(role).map((key, order) => ({ key, order }))
    selected.forEach(({ key, order }) => scores.set(key, Math.min(scores.get(key) ?? Infinity, roleIndex * 100 + order)))
  })
  const allowedHrefs = new Set(allowed.map(item => item.href))
  return [...scores.keys()]
    .filter(key => widgetIsAllowed(key, allowedHrefs))
    .sort((a, b) => (scores.get(a)! - scores.get(b)!) || DASHBOARD_WIDGETS.findIndex(w => w.key === a) - DASHBOARD_WIDGETS.findIndex(w => w.key === b))
}
