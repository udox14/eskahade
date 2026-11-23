// Resolusi penerima. Berjalan tanpa sesi (cron Worker), jadi role efektif dan akses
// halaman dihitung langsung dari tabel users / fitur_akses / user_fitur_override,
// mengikuti aturan yang sama dengan getEffectiveRoles + canAccessHref.

import { storedUserRoles } from '../auth/stored-roles'
import { rolesCanAccessFeature } from '../auth/role-access'
import { TEST_RECIPIENT_KEY } from './outbox'
import type { EffectiveEventConfig, NotifPayload, NotifStore, RecipientKind } from './types'

const STRUCTURAL_ROLE_VALUES = ['pengurus_asrama', 'sekpen', 'dewan_santri', 'keamanan']
const DEFAULT_STRUCTURAL_JABATAN = 'anggota'
/** Akun uji/demo tidak menerima notifikasi operasional kecuali role-nya dipilih eksplisit. */
const NON_OPERATIONAL_ROLES = ['tester', 'demo']
const VERIFIER_ALL_SCOPE_ROLES = ['admin', 'bendahara', 'admin_koperasi', 'pimpinan']

export interface ResolvedRecipient {
  kind: RecipientKind
  id: string
  /** Tautan per penerima: null bila penerima eksplisit tidak punya akses ke halaman. */
  link: string | null
}

interface UserRow {
  id: string
  role: string | null
  roles: string | null
  structural_jabatan: string | null
  asrama_binaan: string | null
}

/** Cerminan getEffectiveRoles() untuk baris users (tanpa sesi). */
export function effectiveRolesForUser(row: Pick<UserRow, 'role' | 'roles' | 'structural_jabatan'>): string[] {
  const base = storedUserRoles(row.role, row.roles)
  if (!base) return []
  const expanded = new Set<string>()
  for (const role of base) {
    expanded.add(role)
    const parts = role.split(':')
    if (parts.length === 2 && STRUCTURAL_ROLE_VALUES.includes(parts[0]) && parts[1] !== '') {
      expanded.add(parts[0])
      expanded.add(`jabatan:${parts[1]}`)
    }
  }
  const needsJabatan = [...expanded].some(r => STRUCTURAL_ROLE_VALUES.includes(r))
  const jabatan = needsJabatan ? (row.structural_jabatan || DEFAULT_STRUCTURAL_JABATAN) : row.structural_jabatan
  if (jabatan) {
    expanded.add(`jabatan:${jabatan}`)
    for (const role of [...expanded]) if (STRUCTURAL_ROLE_VALUES.includes(role)) expanded.add(`${role}:${jabatan}`)
  }
  return [...expanded]
}

const norm = (v: unknown) => String(v ?? '').trim().toUpperCase()

interface FeatureRow { id: number; roles: string | null; is_active: number }

async function createAccessChecker(store: NotifStore, href: string | null) {
  if (!href) return async () => false
  const path = href.split(/[?#]/)[0]
  const feature = await store.queryOne<FeatureRow>('SELECT id, roles, is_active FROM fitur_akses WHERE href = ?', [path])
  let featureRoles: string[] = []
  try { featureRoles = feature?.roles ? JSON.parse(feature.roles) : [] } catch { featureRoles = [] }
  return async (userId: string, roles: string[]) => {
    if (!feature || Number(feature.is_active) !== 1) return false
    if (roles.includes('admin')) return true
    const override = await store.queryOne<{ action: string }>(
      'SELECT action FROM user_fitur_override WHERE user_id = ? AND fitur_id = ?', [userId, feature.id])
    if (override) return override.action === 'grant'
    return Array.isArray(featureRoles) && rolesCanAccessFeature(featureRoles, roles)
  }
}

async function filterMuted(store: NotifStore, config: EffectiveEventConfig, recipients: ResolvedRecipient[]) {
  if (config.mandatory || !recipients.length) return recipients
  const kept: ResolvedRecipient[] = []
  for (const r of recipients) {
    const pref = await store.queryOne<{ in_app_enabled: number }>(
      'SELECT in_app_enabled FROM notif_preferences WHERE owner_kind = ? AND owner_id = ? AND category = ?',
      [r.kind, r.id, config.definition.category])
    if (pref && Number(pref.in_app_enabled) === 0) continue
    kept.push(r)
  }
  return kept
}

export async function resolveRecipients(
  store: NotifStore,
  config: EffectiveEventConfig,
  payload: NotifPayload,
  link: string | null,
): Promise<ResolvedRecipient[]> {
  const def = config.definition

  // Kirim uji dari modul pengaturan: hanya ke admin yang meminta.
  const testValue = payload[TEST_RECIPIENT_KEY]
  const testUserId = typeof testValue === 'string' ? testValue : null
  if (testUserId) {
    const user = await store.queryOne<{ id: string }>('SELECT id FROM users WHERE id = ?', [testUserId])
    return user ? [{ kind: 'USER', id: user.id, link: def.audience === 'STAFF' ? link : null }] : []
  }

  if (def.audience === 'PARENT') {
    const santriId = typeof payload.santri_id === 'string' ? payload.santri_id : null
    if (!santriId) return []
    const santri = await store.queryOne<{ id: string }>('SELECT id FROM santri WHERE id = ?', [santriId])
    return filterMuted(store, config, santri ? [{ kind: 'SANTRI', id: santri.id, link }] : [])
  }

  const rule = config.recipients
  if (!rule) return []
  const actorId = typeof payload.actor_user_id === 'string' ? payload.actor_user_id : null
  const users = await store.query<UserRow>('SELECT id, role, roles, structural_jabatan, asrama_binaan FROM users')
  const canAccess = await createAccessChecker(store, link)
  const targetAsrama = norm(payload.asrama)
  const verifierScopes = rule.scope === 'TRANSFER_VERIFIER'
    ? new Set((await store.query<{ user_id: string }>(
        'SELECT user_id FROM finance_transfer_verifier_scopes WHERE UPPER(TRIM(asrama)) = ?', [targetAsrama])).map(r => r.user_id))
    : new Set<string>()

  const result = new Map<string, ResolvedRecipient>()
  const explicit = new Set<string>([...rule.includeUserIds, ...(rule.notifyActor && actorId ? [actorId] : [])])

  for (const user of users) {
    const roles = effectiveRolesForUser(user)
    if (!roles.length) continue
    if (rule.excludeUserIds.includes(user.id)) continue
    if (rule.excludeActor && !rule.notifyActor && actorId === user.id) continue

    if (explicit.has(user.id)) {
      result.set(user.id, { kind: 'USER', id: user.id, link: await canAccess(user.id, roles) ? link : null })
      continue
    }

    if (!roles.some(r => rule.roles.includes(r))) continue
    if (roles.some(r => NON_OPERATIONAL_ROLES.includes(r)) && !rule.roles.some(r => NON_OPERATIONAL_ROLES.includes(r))) continue

    if (rule.scope === 'TRANSFER_VERIFIER') {
      // Cerminan getVerifierScope(): role lintas asrama melihat semua, lainnya per scope tersimpan.
      // Pimpinan hanya baca → tidak diberi tugas verifikasi kecuali dipilih eksplisit di roles.
      const allScope = roles.some(r => VERIFIER_ALL_SCOPE_ROLES.includes(r))
      if (!allScope && !verifierScopes.has(user.id)) continue
    } else if (rule.scope === 'ASRAMA_BINAAN') {
      if (!roles.includes('admin') && (!targetAsrama || norm(user.asrama_binaan) !== targetAsrama)) continue
    }

    if (link && !(await canAccess(user.id, roles))) continue
    result.set(user.id, { kind: 'USER', id: user.id, link })
  }

  return filterMuted(store, config, [...result.values()])
}
