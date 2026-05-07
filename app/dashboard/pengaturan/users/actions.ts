'use server'

import { query, queryOne, execute } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { revalidatePath } from 'next/cache'
import { getCachedFiturAkses } from '@/lib/cache/fitur-akses'

const DEFAULT_USER_PASSWORD = 'eskahade2026'

type UserSourceType = 'guru' | 'sadesa'

export type UserCreationCandidate = {
  source_type: UserSourceType
  source_ref_id: string
  label: string
  full_name: string
  email: string
  meta: string | null
  has_account: boolean
}

type BatchSourceUserInput = {
  source_type: UserSourceType
  source_ref_id: string
  role: string
  asrama_binaan?: string | null
}

type LinkedUserCreateResult =
  | { success: true; full_name: string; email: string }
  | { error: string }

function generateEmail(name: string) {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${cleanName}@sukahideng.or.id`
}

async function ensureUserSourceColumns() {
  try {
    await execute('ALTER TABLE users ADD COLUMN source_type TEXT')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
      throw error
    }
  }

  try {
    await execute('ALTER TABLE users ADD COLUMN source_ref_id TEXT')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
      throw error
    }
  }

  try {
    await execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_source_unique
      ON users(source_type, source_ref_id)
      WHERE source_type IS NOT NULL AND source_ref_id IS NOT NULL
    `)
  } catch {
    // Abaikan jika engine belum mendukung partial index.
  }
}

async function getSourceProfile(sourceType: UserSourceType, sourceRefId: string) {
  await ensureUserSourceColumns()

  if (sourceType === 'guru') {
    const guru = await queryOne<{ id: number; nama_lengkap: string }>(
      'SELECT id, nama_lengkap FROM data_guru WHERE id = ?',
      [Number(sourceRefId)]
    )
    if (!guru) return null

    return {
      source_type: 'guru' as const,
      source_ref_id: String(guru.id),
      full_name: guru.nama_lengkap,
      email: generateEmail(guru.nama_lengkap),
    }
  }

  const santri = await queryOne<{
    id: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
  }>(
    `SELECT id, nama_lengkap, asrama, kamar
     FROM santri
     WHERE id = ?
       AND status_global = 'aktif'
       AND kategori_santri = 'SADESA'`,
    [sourceRefId]
  )
  if (!santri) return null

  return {
    source_type: 'sadesa' as const,
    source_ref_id: santri.id,
    full_name: santri.nama_lengkap,
    email: generateEmail(santri.nama_lengkap),
  }
}

async function createLinkedUserFromSource(input: BatchSourceUserInput): Promise<LinkedUserCreateResult> {
  const sourceProfile = await getSourceProfile(input.source_type, input.source_ref_id)
  if (!sourceProfile) {
    return { error: 'Data sumber akun tidak ditemukan atau sudah tidak aktif.' } as const
  }

  if (!input.role) {
    return { error: `Role untuk ${sourceProfile.full_name} belum dipilih.` } as const
  }

  if (input.role === 'pengurus_asrama' && !String(input.asrama_binaan || '').trim()) {
    return { error: `Asrama binaan untuk ${sourceProfile.full_name} belum dipilih.` } as const
  }

  const existingSourceUser = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE source_type = ? AND source_ref_id = ? LIMIT 1',
    [input.source_type, input.source_ref_id]
  )
  if (existingSourceUser) {
    return { error: `${sourceProfile.full_name} sudah memiliki akun.` } as const
  }

  const existingEmailUser = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [sourceProfile.email]
  )
  if (existingEmailUser) {
    return { error: `Email ${sourceProfile.email} sudah digunakan.` } as const
  }

  const passwordHash = await hashPassword(DEFAULT_USER_PASSWORD)
  const now = new Date().toISOString()
  const rolesJson = JSON.stringify([input.role])

  await execute(
    `INSERT INTO users (
      id, email, password_hash, full_name, role, roles, asrama_binaan,
      source_type, source_ref_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      sourceProfile.email,
      passwordHash,
      sourceProfile.full_name,
      input.role,
      rolesJson,
      input.role === 'pengurus_asrama' ? String(input.asrama_binaan || '').trim() : null,
      input.source_type,
      input.source_ref_id,
      now,
      now,
    ]
  )

  return { success: true, full_name: sourceProfile.full_name, email: sourceProfile.email } as const
}

export async function getUsersList() {
  await ensureUserSourceColumns()

  return await query<any>(
    `SELECT
      u.id,
      u.email,
      u.full_name,
      u.role,
      u.roles,
      u.asrama_binaan,
      u.source_type,
      u.source_ref_id,
      u.created_at,
      GROUP_CONCAT(k.nama_kelas, ', ') AS kelas_binaan
    FROM users u
    LEFT JOIN kelas k ON k.wali_kelas_id = u.id
    GROUP BY
      u.id, u.email, u.full_name, u.role, u.roles, u.asrama_binaan,
      u.source_type, u.source_ref_id, u.created_at
    ORDER BY u.created_at DESC`
  )
}

export async function getUserCreationCandidates(): Promise<UserCreationCandidate[]> {
  await ensureUserSourceColumns()

  const guruRows = await query<{ id: number; nama_lengkap: string }>(
    'SELECT id, nama_lengkap FROM data_guru ORDER BY nama_lengkap ASC'
  )

  const sadesaRows = await query<{
    id: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
  }>(
    `SELECT id, nama_lengkap, asrama, kamar
     FROM santri
     WHERE status_global = 'aktif'
       AND kategori_santri = 'SADESA'
     ORDER BY nama_lengkap ASC`
  )

  const guruCandidates = await Promise.all(
    guruRows.map(async (row) => {
      const email = generateEmail(row.nama_lengkap)
      const existing = await queryOne<{ id: string }>(
        `SELECT id
         FROM users
         WHERE (source_type = 'guru' AND source_ref_id = ?)
            OR lower(trim(email)) = lower(trim(?))
         LIMIT 1`,
        [String(row.id), email]
      )

      return {
        source_type: 'guru' as const,
        source_ref_id: String(row.id),
        label: row.nama_lengkap,
        full_name: row.nama_lengkap,
        email,
        meta: 'Data Guru',
        has_account: Boolean(existing),
      }
    })
  )

  const sadesaCandidates = await Promise.all(
    sadesaRows.map(async (row) => {
      const email = generateEmail(row.nama_lengkap)
      const existing = await queryOne<{ id: string }>(
        `SELECT id
         FROM users
         WHERE (source_type = 'sadesa' AND source_ref_id = ?)
            OR lower(trim(email)) = lower(trim(?))
         LIMIT 1`,
        [row.id, email]
      )

      return {
        source_type: 'sadesa' as const,
        source_ref_id: row.id,
        label: row.nama_lengkap,
        full_name: row.nama_lengkap,
        email,
        meta: [row.asrama, row.kamar].filter(Boolean).join(' • ') || 'Santri SADESA',
        has_account: Boolean(existing),
      }
    })
  )

  return [...guruCandidates, ...sadesaCandidates]
}

export async function updateUserRoles(
  id: string,
  newRoles: string[],
  asrama?: string
): Promise<{ success: boolean } | { error: string }> {
  if (!newRoles || newRoles.length === 0) return { error: 'Minimal satu role harus dipilih.' }

  const primaryRole = newRoles[0]
  const asramaBinaan = newRoles.includes('pengurus_asrama') ? (asrama || null) : null
  const rolesJson = JSON.stringify(newRoles)

  await execute(
    'UPDATE users SET role = ?, roles = ?, asrama_binaan = ?, updated_at = ? WHERE id = ?',
    [primaryRole, rolesJson, asramaBinaan, new Date().toISOString(), id]
  )

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function updateUserRole(id: string, newRole: string, asrama?: string): Promise<{ success: boolean } | { error: string }> {
  return updateUserRoles(id, [newRole], asrama)
}

export async function createUser(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  await ensureUserSourceColumns()

  const emailInput = String(formData.get('email') || '').toLowerCase().trim()
  const passwordInput = String(formData.get('password') || '')
  const fullNameInput = String(formData.get('full_name') || '').trim()
  const role = String(formData.get('role') || '')
  const asrama = String(formData.get('asrama_binaan') || '')
  const sourceTypeRaw = String(formData.get('source_type') || '').trim().toLowerCase()
  const sourceRefId = String(formData.get('source_ref_id') || '').trim()
  const sourceType = sourceTypeRaw === 'guru' || sourceTypeRaw === 'sadesa' ? sourceTypeRaw : null

  if (sourceType && sourceRefId) {
    const result = await createLinkedUserFromSource({
      source_type: sourceType,
      source_ref_id: sourceRefId,
      role,
      asrama_binaan: asrama || null,
    })
    if ('error' in result) return { error: result.error }

    revalidatePath('/dashboard/pengaturan/users')
    return { success: true }
  }

  const fullName = fullNameInput
  const email = emailInput

  if (!fullName) return { error: 'Nama lengkap wajib diisi.' }
  if (!email) return { error: 'Email login wajib diisi.' }
  if (!role) return { error: 'Role wajib dipilih.' }

  const exist = await queryOne('SELECT id FROM users WHERE email = ?', [email])
  if (exist) return { error: 'Email sudah digunakan.' }

  const password = passwordInput.trim() || DEFAULT_USER_PASSWORD
  if (password.length < 6) return { error: 'Password minimal 6 karakter.' }

  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()
  const rolesJson = JSON.stringify([role])

  await execute(
    `INSERT INTO users (
      id, email, password_hash, full_name, role, roles, asrama_binaan,
      source_type, source_ref_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      email,
      passwordHash,
      fullName,
      role,
      rolesJson,
      role === 'pengurus_asrama' ? asrama : null,
      sourceType,
      sourceRefId || null,
      now,
      now,
    ]
  )

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function createUsersFromSourcesBatch(items: BatchSourceUserInput[]) {
  await ensureUserSourceColumns()

  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, count: 0, errors: ['Tidak ada data yang dipilih.'] }
  }

  let successCount = 0
  const errors: string[] = []

  for (const item of items) {
    const result = await createLinkedUserFromSource(item)
    if ('error' in result) {
      errors.push(result.error)
      continue
    }
    successCount++
  }

  revalidatePath('/dashboard/pengaturan/users')
  return {
    success: successCount > 0,
    count: successCount,
    errors: errors.length > 0 ? errors : null,
  }
}

export async function createUsersBatch(usersData: any[]) {
  let successCount = 0
  const errors: string[] = []

  for (const u of usersData) {
    if (!u.email || !u.password || !u.full_name) {
      errors.push(`Data tidak lengkap untuk ${u.full_name || 'Tanpa Nama'}`)
      continue
    }

    const email = String(u.email).toLowerCase().trim()
    const exist = await queryOne('SELECT id FROM users WHERE email = ?', [email])
    if (exist) {
      errors.push(`Email ${email} sudah digunakan.`)
      continue
    }

    try {
      const passwordHash = await hashPassword(String(u.password))
      const now = new Date().toISOString()
      const userRole = u.role || 'wali_kelas'
      const rolesJson = JSON.stringify([userRole])

      await execute(
        `INSERT INTO users (
          id, email, password_hash, full_name, role, roles, asrama_binaan,
          source_type, source_ref_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          email,
          passwordHash,
          u.full_name,
          userRole,
          rolesJson,
          userRole === 'pengurus_asrama' ? (u.asrama_binaan || null) : null,
          null,
          null,
          now,
          now,
        ]
      )
      successCount++
    } catch (err: any) {
      errors.push(`Gagal buat user ${email}: ${err.message}`)
    }
  }

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true, count: successCount, errors: errors.length > 0 ? errors : null }
}

export async function updateUserDetails(userId: string, fullName: string, email: string): Promise<{ success: boolean } | { error: string }> {
  const emailClean = email.toLowerCase().trim()
  const exist = await queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [emailClean, userId])
  if (exist) return { error: 'Email sudah digunakan user lain.' }

  await execute(
    'UPDATE users SET full_name = ?, email = ?, updated_at = ? WHERE id = ?',
    [fullName, emailClean, new Date().toISOString(), userId]
  )

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean } | { error: string }> {
  const passwordHash = await hashPassword(newPassword)

  await execute(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    [passwordHash, new Date().toISOString(), userId]
  )

  return { success: true }
}

async function findUserDeleteUsage(userId: string): Promise<string | null> {
  const references = [
    { table: 'kelas', column: 'wali_kelas_id', label: 'wali kelas pada data kelas' },
    { table: 'absensi_harian', column: 'created_by', label: 'absensi harian' },
    { table: 'absensi_guru', column: 'updated_by', label: 'absensi guru' },
    { table: 'absen_asrama', column: 'created_by', label: 'absen asrama' },
    { table: 'absen_sakit', column: 'created_by', label: 'absen sakit' },
    { table: 'nilai_akademik', column: 'created_by', label: 'nilai akademik' },
    { table: 'pelanggaran', column: 'penindak_id', label: 'data pelanggaran' },
    { table: 'perizinan', column: 'created_by', label: 'perizinan' },
    { table: 'hasil_tes_klasifikasi', column: 'tester_id', label: 'hasil tes klasifikasi' },
    { table: 'spp_log', column: 'penerima_id', label: 'pembayaran SPP' },
    { table: 'spp_setoran', column: 'penerima_id', label: 'setoran SPP' },
    { table: 'pembayaran_tahunan', column: 'penerima_id', label: 'pembayaran tahunan' },
    { table: 'tabungan_log', column: 'created_by', label: 'tabungan / uang jajan' },
    { table: 'upk_transaksi', column: 'created_by', label: 'transaksi UPK' },
    { table: 'riwayat_surat', column: 'created_by', label: 'riwayat surat' },
    { table: 'user_fitur_override', column: 'user_id', label: 'override fitur user' },
  ]

  for (const ref of references) {
    try {
      const row = await queryOne<{ total: number }>(
        `SELECT COUNT(*) as total FROM ${ref.table} WHERE ${ref.column} = ?`,
        [userId]
      )
      if (Number(row?.total || 0) > 0) {
        return ref.label
      }
    } catch {
      // Abaikan tabel yang belum ada di environment tertentu.
    }
  }

  return null
}

export async function deleteUser(userId: string): Promise<{ success: boolean } | { error: string }> {
  const usage = await findUserDeleteUsage(userId)
  if (usage) {
    return { error: `User tidak bisa dihapus karena masih dipakai pada ${usage}.` }
  }

  try {
    await execute('DELETE FROM users WHERE id = ?', [userId])
    revalidatePath('/dashboard/pengaturan/users')
    return { success: true }
  } catch (error: any) {
    const message = String(error?.message || '')
    if (message.toLowerCase().includes('foreign key')) {
      return { error: 'User tidak bisa dihapus karena masih terhubung dengan data lain.' }
    }
    return { error: message || 'Gagal menghapus user.' }
  }
}

export async function getUserOverrides(userId: string) {
  try {
    return await query<{ id: number; fitur_id: number; action: string }>(
      'SELECT id, fitur_id, action FROM user_fitur_override WHERE user_id = ?',
      [userId]
    )
  } catch {
    return []
  }
}

export async function setUserFiturOverride(
  userId: string,
  fiturId: number,
  action: 'grant' | 'revoke'
): Promise<{ success: boolean } | { error: string }> {
  await execute(
    `INSERT INTO user_fitur_override (user_id, fitur_id, action, created_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, fitur_id) DO UPDATE SET action = excluded.action, created_at = excluded.created_at`,
    [userId, fiturId, action]
  )
  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function removeUserFiturOverride(
  userId: string,
  fiturId: number
): Promise<{ success: boolean } | { error: string }> {
  await execute(
    'DELETE FROM user_fitur_override WHERE user_id = ? AND fitur_id = ?',
    [userId, fiturId]
  )
  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function getAllActiveFitur() {
  const all = await getCachedFiturAkses()
  return all.filter(f => f.is_active)
}
