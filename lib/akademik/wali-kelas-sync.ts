import { batch, query, queryOne } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'

function generateEmail(name: string) {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${cleanName}@sukahideng.or.id`
}

function parseRoles(raw: string | null, fallbackRole: string) {
  try {
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[]
    }
  } catch {}
  return fallbackRole ? [fallbackRole] : []
}

async function addRolesToUser(userId: string, currentRole: string, currentRoles: string | null, rolesToAdd: string[]) {
  const roles = parseRoles(currentRoles, currentRole)
  for (const role of rolesToAdd) {
    if (!roles.includes(role)) roles.push(role)
  }
  await query('UPDATE users SET roles = ?, updated_at = datetime(\'now\') WHERE id = ?', [JSON.stringify(roles), userId])
}

async function getOrCreateWaliUserForGuru(guruId: number) {
  const guru = await queryOne<{ id: number; nama_lengkap: string }>(
    'SELECT id, nama_lengkap FROM data_guru WHERE id = ?',
    [guruId]
  )
  if (!guru) return null

  const existingByName = await queryOne<{ id: string; role: string; roles: string | null }>(
    `SELECT id, role, roles
     FROM users
     WHERE lower(trim(full_name)) = lower(trim(?))
       AND (
         role IN ('wali_kelas', 'sekpen')
         OR EXISTS (
           SELECT 1
           FROM json_each(COALESCE(users.roles, '[]'))
           WHERE value IN ('wali_kelas', 'sekpen')
         )
       )
     LIMIT 1`,
    [guru.nama_lengkap]
  )
  if (existingByName) {
    await addRolesToUser(existingByName.id, existingByName.role, existingByName.roles, ['guru'])
    return existingByName.id
  }

  const email = generateEmail(guru.nama_lengkap)
  const existingByEmail = await queryOne<{ id: string; role: string; roles: string | null; source_type: string | null; source_ref_id: string | null }>(
    'SELECT id, role, roles, source_type, source_ref_id FROM users WHERE email = ? LIMIT 1',
    [email]
  )
  if (existingByEmail) {
    await addRolesToUser(existingByEmail.id, existingByEmail.role, existingByEmail.roles, ['wali_kelas', 'guru'])
    if (!existingByEmail.source_type && !existingByEmail.source_ref_id) {
      await query('UPDATE users SET source_type = ?, source_ref_id = ?, updated_at = datetime(\'now\') WHERE id = ?', ['guru', String(guru.id), existingByEmail.id])
    }
    return existingByEmail.id
  }

  const userId = crypto.randomUUID()
  const hashed = await hashPassword('eskahade2026')
  await query(
    `INSERT INTO users (id, email, password_hash, full_name, role, roles, source_type, source_ref_id)
     VALUES (?, ?, ?, ?, 'wali_kelas', ?, 'guru', ?)`,
    [userId, email, hashed, guru.nama_lengkap, JSON.stringify(['wali_kelas', 'guru']), String(guru.id)]
  )
  return userId
}

export async function backfillManualWaliKelasFromGuruMaghrib(kelasIds?: string[]) {
  const params = kelasIds?.filter(Boolean) ?? []
  const where = params.length > 0
    ? `WHERE k.id IN (${params.map(() => '?').join(',')}) AND k.guru_maghrib_id IS NOT NULL AND k.wali_kelas_id IS NULL`
    : 'WHERE k.guru_maghrib_id IS NOT NULL AND k.wali_kelas_id IS NULL'

  const rows = await query<{ kelas_id: string; guru_maghrib_id: number }>(`
    SELECT k.id as kelas_id, k.guru_maghrib_id
    FROM kelas k
    ${where}
  `, params)

  const updates: { sql: string; params?: unknown[] }[] = []
  for (const row of rows) {
    const userId = await getOrCreateWaliUserForGuru(Number(row.guru_maghrib_id))
    if (!userId) continue
    updates.push({
      sql: 'UPDATE kelas SET wali_kelas_id = ? WHERE id = ?',
      params: [userId, row.kelas_id],
    })
  }

  if (updates.length > 0) await batch(updates)
  return { synced: updates.length }
}

export async function syncWaliKelasFromGuruMaghrib(kelasIds?: string[]) {
  return backfillManualWaliKelasFromGuruMaghrib(kelasIds)
}
