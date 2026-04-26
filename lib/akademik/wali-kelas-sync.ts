import { batch, query, queryOne } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'

function generateEmail(name: string) {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${cleanName}@sukahideng.com`
}

async function getOrCreateWaliUserForGuru(guruId: number) {
  const guru = await queryOne<{ id: number; nama_lengkap: string }>(
    'SELECT id, nama_lengkap FROM data_guru WHERE id = ?',
    [guruId]
  )
  if (!guru) return null

  const existingByName = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE lower(trim(full_name)) = lower(trim(?)) AND role IN ('wali_kelas', 'sekpen') LIMIT 1",
    [guru.nama_lengkap]
  )
  if (existingByName) return existingByName.id

  const email = generateEmail(guru.nama_lengkap)
  const existingByEmail = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email]
  )
  if (existingByEmail) return existingByEmail.id

  const userId = crypto.randomUUID()
  const hashed = await hashPassword('sukahideng123')
  await query(
    "INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'wali_kelas')",
    [userId, email, hashed, guru.nama_lengkap]
  )
  return userId
}

export async function syncWaliKelasFromGuruMaghrib(kelasIds?: string[]) {
  const params = kelasIds?.filter(Boolean) ?? []
  const where = params.length > 0
    ? `WHERE k.id IN (${params.map(() => '?').join(',')}) AND k.guru_maghrib_id IS NOT NULL`
    : 'WHERE k.guru_maghrib_id IS NOT NULL'

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

