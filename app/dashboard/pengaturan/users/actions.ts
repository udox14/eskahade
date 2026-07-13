'use server'

import { batch, query, queryOne, execute } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { getSession, isAdmin } from '@/lib/auth/session'
import { actorFromSession, diffWhitelistedFields, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { getCachedFiturAkses } from '@/lib/cache/fitur-akses'

const DEFAULT_USER_PASSWORD = 'eskahade2026'
const VALID_USER_ROLES = [
  'admin',
  'demo',
  'tester',
  'bendahara',
  'sekpen',
  'keamanan',
  'dewan_santri',
  'pengurus_asrama',
  'wali_kelas',
  'guru',
]

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
  structural_jabatan?: string | null
}

type LinkedUserCreateResult =
  | { success: true; user_id: string; full_name: string; email: string }
  | { error: string }

type GuruAccountBatchSummary = {
  success: boolean
  created: number
  linked: number
  updated: number
  existing: number
  failed: number
  errors: string[] | null
}

function generateEmail(name: string) {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${cleanName}@sukahideng.or.id`
}

function normalizePersonName(name: string) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(kh|k\.h|ust|ustadz|ustadzah|drs|dr|hj|h)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '')
}

async function getUserById(id: string) {
  await ensureUserManagementColumns()

  return queryOne<{
    id: string
    full_name: string
    email: string
    role: string
    roles: string | null
    asrama_binaan: string | null
    structural_jabatan: string | null
    guru_id: number | null
    santri_id: string | null
    source_type: string | null
    source_ref_id: string | null
  }>(
    'SELECT id, full_name, email, role, roles, asrama_binaan, structural_jabatan, guru_id, santri_id, source_type, source_ref_id FROM users WHERE id = ?',
    [id]
  )
}

// Grant petugas PSB per-user + label untuk log aktivitas. Whitelist nama kolom
// karena diinterpolasi langsung ke SQL.
const PSB_AKSES_LABEL: Record<string, string> = {
  psb_verifikasi_akses: 'verifikasi (kesekretariatan)',
  psb_asrama_akses: 'penempatan asrama',
  psb_bayar_akses: 'pembayaran',
}

function isPsbAksesField(field: string): field is keyof typeof PSB_AKSES_LABEL {
  return field === 'psb_verifikasi_akses' || field === 'psb_asrama_akses' || field === 'psb_bayar_akses'
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

function addRoleUnique(roles: string[], role: string) {
  return roles.includes(role) ? roles : [...roles, role]
}

function normalizeUserRoles(roles: unknown[]) {
  return Array.from(new Set(roles
    .map(role => String(role || '').trim().toLowerCase())
    .filter(role => VALID_USER_ROLES.includes(role))))
}

async function ensureUserSourceColumns() {
  await ensureUserManagementColumns()
}

async function ensureUserManagementColumns() {
  try {
    await execute('ALTER TABLE users ADD COLUMN source_type TEXT')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
      throw error
    }
  }

  try {
    await execute('ALTER TABLE users ADD COLUMN structural_jabatan TEXT')
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

  for (const col of ['psb_verifikasi_akses', 'psb_asrama_akses', 'psb_bayar_akses']) {
    try {
      await execute(`ALTER TABLE users ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`)
    } catch (error: any) {
      if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
        throw error
      }
    }
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
  if (!VALID_USER_ROLES.includes(input.role)) {
    return { error: `Role untuk ${sourceProfile.full_name} tidak valid.` } as const
  }

  if (input.role === 'pengurus_asrama' && !String(input.asrama_binaan || '').trim()) {
    return { error: `Asrama binaan untuk ${sourceProfile.full_name} belum dipilih.` } as const
  }

  const needsStructuralJabatan = roleNeedsStructuralJabatan([input.role])
  const structuralJabatan = needsStructuralJabatan ? normalizeStructuralJabatan(input.structural_jabatan) : null

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
  const userId = crypto.randomUUID()

  await execute(
    `INSERT INTO users (
      id, email, password_hash, full_name, role, roles, asrama_binaan,
      structural_jabatan, source_type, source_ref_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      sourceProfile.email,
      passwordHash,
      sourceProfile.full_name,
      input.role,
      rolesJson,
      input.role === 'pengurus_asrama' ? String(input.asrama_binaan || '').trim() : null,
      needsStructuralJabatan ? structuralJabatan : null,
      input.source_type,
      input.source_ref_id,
      now,
      now,
    ]
  )

  return { success: true, user_id: userId, full_name: sourceProfile.full_name, email: sourceProfile.email } as const
}

export async function createAllGuruAccounts(): Promise<GuruAccountBatchSummary> {
  await ensureUserSourceColumns()
  const session = await getSession()
  const [guruRows, userRows] = await Promise.all([
    query<{ id: number; nama_lengkap: string }>('SELECT id, nama_lengkap FROM data_guru ORDER BY nama_lengkap ASC'),
    query<{
      id: string
      email: string
      full_name: string | null
      role: string
      roles: string | null
      source_type: string | null
      source_ref_id: string | null
    }>('SELECT id, email, full_name, role, roles, source_type, source_ref_id FROM users'),
  ])

  const summary: GuruAccountBatchSummary = {
    success: false,
    created: 0,
    linked: 0,
    updated: 0,
    existing: 0,
    failed: 0,
    errors: null,
  }
  const errors: string[] = []
  const passwordHash = await hashPassword(DEFAULT_USER_PASSWORD)
  const now = new Date().toISOString()
  const statements: { sql: string; params?: unknown[] }[] = []
  const usedUserIds = new Set<string>()
  const usersByGuruSource = new Map<string, typeof userRows[number]>()
  const usersByEmail = new Map<string, typeof userRows[number]>()
  const usersByName = new Map<string, typeof userRows[number][]>()
  const plannedEmails = new Set<string>()

  for (const user of userRows) {
    if (user.source_type === 'guru' && user.source_ref_id) {
      usersByGuruSource.set(String(user.source_ref_id), user)
    }
    usersByEmail.set(String(user.email || '').toLowerCase().trim(), user)

    const nameKey = normalizePersonName(user.full_name || '')
    if (nameKey) {
      const existing = usersByName.get(nameKey) || []
      existing.push(user)
      usersByName.set(nameKey, existing)
    }
  }

  function queueUserUpdate(user: typeof userRows[number], guruId: string, shouldAttachSource: boolean, currentRoles: string[]) {
    const nextRoles = addRoleUnique(currentRoles, 'guru')
    const rolesChanged = nextRoles.length > currentRoles.length
    const sourceChanged = shouldAttachSource && !user.source_type && !user.source_ref_id

    if (!rolesChanged && !sourceChanged) {
      summary.existing += 1
      return
    }

    statements.push({
      sql: `UPDATE users
            SET roles = ?,
                source_type = CASE WHEN source_type IS NULL AND source_ref_id IS NULL THEN 'guru' ELSE source_type END,
                source_ref_id = CASE WHEN source_type IS NULL AND source_ref_id IS NULL THEN ? ELSE source_ref_id END,
                updated_at = ?
            WHERE id = ?`,
      params: [JSON.stringify(nextRoles), guruId, now, user.id],
    })

    if (sourceChanged) summary.linked += 1
    else summary.updated += 1
    usedUserIds.add(user.id)
  }

  for (const guru of guruRows) {
    const guruId = String(guru.id)
    const email = generateEmail(guru.nama_lengkap)

    try {
      const existingBySource = usersByGuruSource.get(guruId)

      if (existingBySource) {
        queueUserUpdate(existingBySource, guruId, false, parseRoles(existingBySource.roles, existingBySource.role))
        continue
      }

      const existingByEmail = usersByEmail.get(email.toLowerCase())

      if (existingByEmail) {
        queueUserUpdate(existingByEmail, guruId, true, parseRoles(existingByEmail.roles, existingByEmail.role))
        continue
      }

      const nameMatches = (usersByName.get(normalizePersonName(guru.nama_lengkap)) || [])
        .filter(user => !usedUserIds.has(user.id))

      if (nameMatches.length === 1) {
        const existingByName = nameMatches[0]
        queueUserUpdate(existingByName, guruId, true, parseRoles(existingByName.roles, existingByName.role))
        usersByGuruSource.set(guruId, existingByName)
        continue
      }

      if (nameMatches.length > 1) {
        summary.failed += 1
        errors.push(`${guru.nama_lengkap}: ditemukan lebih dari satu user dengan nama sama, perlu digabung manual.`)
        continue
      }

      const emailKey = email.toLowerCase()
      if (plannedEmails.has(emailKey)) {
        summary.failed += 1
        errors.push(`${guru.nama_lengkap}: email ${email} bentrok dengan data guru lain, perlu review manual.`)
        continue
      }
      plannedEmails.add(emailKey)

      statements.push({
        sql: `INSERT INTO users (
          id, email, password_hash, full_name, role, roles, asrama_binaan,
          source_type, source_ref_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'guru', ?, NULL, 'guru', ?, ?, ?)`,
        params: [
          crypto.randomUUID(),
          email,
          passwordHash,
          guru.nama_lengkap,
          JSON.stringify(['guru']),
          guruId,
          now,
          now,
        ],
      })
      summary.created += 1
    } catch (error: any) {
      summary.failed += 1
      errors.push(`${guru.nama_lengkap}: ${String(error?.message || 'gagal diproses')}`)
    }
  }

  if (statements.length > 0) {
    for (let i = 0; i < statements.length; i += 100) {
      await batch(statements.slice(i, i + 100))
    }
  }

  if (summary.created + summary.linked + summary.updated > 0) {
    await logActivity({
      actor: actorFromSession(session),
      module: 'pengaturan_users',
      action: 'create',
      fiturHref: '/dashboard/pengaturan/users',
      logKind: 'create',
      entityType: 'user_batch',
      entityId: 'guru-batch',
      entityLabel: 'Pembuatan akun guru',
      summary: `Sinkron akun guru: ${summary.created} dibuat, ${summary.linked} ditautkan, ${summary.updated} diperbarui`,
      details: summary,
    })
  }

  revalidatePath('/dashboard/pengaturan/users')
  summary.success = summary.created + summary.linked + summary.updated + summary.existing > 0
  summary.errors = errors.length > 0 ? errors : null
  return summary
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
      u.structural_jabatan,
      u.psb_verifikasi_akses,
      u.psb_asrama_akses,
      u.psb_bayar_akses,
      u.source_type,
      u.source_ref_id,
      u.created_at,
      GROUP_CONCAT(k.nama_kelas, ', ') AS kelas_binaan
    FROM users u
    LEFT JOIN kelas k ON k.wali_kelas_id = u.id AND k.tahun_ajaran_id IN (SELECT id FROM tahun_ajaran WHERE is_active = 1)
    GROUP BY
      u.id, u.email, u.full_name, u.role, u.roles, u.asrama_binaan,
      u.structural_jabatan, u.psb_verifikasi_akses, u.psb_asrama_akses,
      u.psb_bayar_akses, u.source_type, u.source_ref_id, u.created_at
    ORDER BY u.created_at DESC`
  )
}

// Set salah satu grant petugas PSB (verifikasi / asrama / bayar) untuk 1 user.
export async function setUserPsbAkses(id: string, field: string, granted: boolean): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!isAdmin(session)) return { error: 'Akses ditolak' }
  if (!isPsbAksesField(field)) return { error: 'Jenis akses PSB tidak valid.' }
  await ensureUserManagementColumns()

  const user = await getUserById(id)
  if (!user) return { error: 'User tidak ditemukan.' }

  await execute(`UPDATE users SET ${field} = ?, updated_at = ? WHERE id = ?`, [granted ? 1 : 0, new Date().toISOString(), id])

  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_users',
    action: 'access_change',
    fiturHref: '/dashboard/pengaturan/users',
    logKind: 'update',
    entityType: 'user',
    entityId: id,
    entityLabel: user.full_name || user.email,
    summary: `${granted ? 'Memberikan' : 'Mencabut'} akses ${PSB_AKSES_LABEL[field]} PSB untuk ${user.full_name || user.email}`,
    details: { field, granted },
  })

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
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
  asrama?: string,
  structuralJabatanInput?: string
): Promise<{ success: boolean } | { error: string }> {
  const normalizedRoles = normalizeUserRoles(newRoles || [])
  if (normalizedRoles.length === 0) return { error: 'Minimal satu role valid harus dipilih.' }
  await ensureUserManagementColumns()

  const session = await getSession()
  const beforeUser = await getUserById(id)
  if (!beforeUser) return { error: 'User tidak ditemukan.' }

  const primaryRole = normalizedRoles[0]
  const asramaBinaan = normalizedRoles.includes('pengurus_asrama') ? (asrama || null) : null
  const needsStructuralJabatan = roleNeedsStructuralJabatan(normalizedRoles)
  const structuralJabatan = needsStructuralJabatan ? normalizeStructuralJabatan(structuralJabatanInput) : null
  const rolesJson = JSON.stringify(normalizedRoles)

  await execute(
    'UPDATE users SET role = ?, roles = ?, asrama_binaan = ?, structural_jabatan = ?, updated_at = ? WHERE id = ?',
    [primaryRole, rolesJson, asramaBinaan, structuralJabatan, new Date().toISOString(), id]
  )

    await logActivity({
      actor: actorFromSession(session),
      module: 'pengaturan_users',
      action: 'access_change',
      fiturHref: '/dashboard/pengaturan/users',
      logKind: 'update',
      entityType: 'user',
    entityId: id,
    entityLabel: beforeUser.full_name || beforeUser.email,
    summary: `Mengubah role user ${beforeUser.full_name || beforeUser.email}`,
    details: {
      changed_fields: diffWhitelistedFields(
        {
          role: beforeUser.role,
          roles: parseRoles(beforeUser.roles, beforeUser.role),
          asrama_binaan: beforeUser.asrama_binaan,
          structural_jabatan: beforeUser.structural_jabatan,
        },
        {
          role: primaryRole,
          roles: normalizedRoles,
          asrama_binaan: asramaBinaan,
          structural_jabatan: structuralJabatan,
        },
        ['role', 'roles', 'asrama_binaan', 'structural_jabatan']
      ),
    },
  })

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function updateUserRole(id: string, newRole: string, asrama?: string): Promise<{ success: boolean } | { error: string }> {
  return updateUserRoles(id, [newRole], asrama)
}

export async function createUser(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  await ensureUserSourceColumns()
  const session = await getSession()

  const emailInput = String(formData.get('email') || '').toLowerCase().trim()
  const passwordInput = String(formData.get('password') || '')
  const fullNameInput = String(formData.get('full_name') || '').trim()
  const role = String(formData.get('role') || '')
  const asrama = String(formData.get('asrama_binaan') || '')
  const structuralJabatan = normalizeStructuralJabatan(String(formData.get('structural_jabatan') || ''))
  const sourceTypeRaw = String(formData.get('source_type') || '').trim().toLowerCase()
  const sourceRefId = String(formData.get('source_ref_id') || '').trim()
  const sourceType = sourceTypeRaw === 'guru' || sourceTypeRaw === 'sadesa' ? sourceTypeRaw : null

  if (sourceType && sourceRefId) {
    const result = await createLinkedUserFromSource({
      source_type: sourceType,
      source_ref_id: sourceRefId,
      role,
      asrama_binaan: asrama || null,
      structural_jabatan: structuralJabatan,
    })
    if ('error' in result) return { error: result.error }

    await logActivity({
      actor: actorFromSession(session),
      module: 'pengaturan_users',
      action: 'create',
      fiturHref: '/dashboard/pengaturan/users',
      logKind: 'create',
      entityType: 'user',
      entityId: result.user_id,
      entityLabel: result.full_name,
      summary: `Membuat akun user ${result.full_name}`,
      details: {
        email: result.email,
        role,
        source_type: sourceType,
        source_ref_id: sourceRefId,
        asrama_binaan: role === 'pengurus_asrama' ? asrama || null : null,
        structural_jabatan: roleNeedsStructuralJabatan([role]) ? structuralJabatan : null,
      },
    })

    revalidatePath('/dashboard/pengaturan/users')
    return { success: true }
  }

  const fullName = fullNameInput
  const email = emailInput

  if (!fullName) return { error: 'Nama lengkap wajib diisi.' }
  if (!email) return { error: 'Email login wajib diisi.' }
  if (!role) return { error: 'Role wajib dipilih.' }
  if (!VALID_USER_ROLES.includes(role)) return { error: 'Role tidak valid.' }

  const exist = await queryOne('SELECT id FROM users WHERE email = ?', [email])
  if (exist) return { error: 'Email sudah digunakan.' }

  const password = passwordInput.trim() || DEFAULT_USER_PASSWORD
  if (password.length < 6) return { error: 'Password minimal 6 karakter.' }

  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()
  const rolesJson = JSON.stringify([role])
  const userId = crypto.randomUUID()

  await execute(
    `INSERT INTO users (
      id, email, password_hash, full_name, role, roles, asrama_binaan,
      structural_jabatan, source_type, source_ref_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      email,
      passwordHash,
      fullName,
      role,
      rolesJson,
      role === 'pengurus_asrama' ? asrama : null,
      roleNeedsStructuralJabatan([role]) ? structuralJabatan : null,
      sourceType,
      sourceRefId || null,
      now,
      now,
    ]
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_users',
    action: 'create',
    fiturHref: '/dashboard/pengaturan/users',
    logKind: 'create',
    entityType: 'user',
    entityId: userId,
    entityLabel: fullName,
    summary: `Membuat akun user ${fullName}`,
    details: {
      email,
      role,
      asrama_binaan: role === 'pengurus_asrama' ? asrama || null : null,
      structural_jabatan: roleNeedsStructuralJabatan([role]) ? structuralJabatan : null,
      source_type: sourceType,
      source_ref_id: sourceRefId || null,
    },
  })

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function createUsersFromSourcesBatch(items: BatchSourceUserInput[]) {
  await ensureUserSourceColumns()
  const session = await getSession()

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

  if (successCount > 0) {
    await logActivity({
      actor: actorFromSession(session),
      module: 'pengaturan_users',
      action: 'create',
      fiturHref: '/dashboard/pengaturan/users',
      logKind: 'create',
      entityType: 'user_batch',
      entityId: 'linked-batch',
      entityLabel: 'Pembuatan user tertaut',
      summary: `Membuat ${successCount} akun tertaut secara batch`,
      details: {
        count: successCount,
        failed_count: errors.length,
      },
    })
  }

  revalidatePath('/dashboard/pengaturan/users')
  return {
    success: successCount > 0,
    count: successCount,
    errors: errors.length > 0 ? errors : null,
  }
}

export async function createUsersBatch(usersData: any[]) {
  await ensureUserManagementColumns()
  const session = await getSession()
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
      const userRole = VALID_USER_ROLES.includes(String(u.role || '').trim().toLowerCase())
        ? String(u.role).trim().toLowerCase()
        : 'wali_kelas'
      const structuralJabatan = normalizeStructuralJabatan(u.structural_jabatan)
      const rolesJson = JSON.stringify([userRole])

      await execute(
        `INSERT INTO users (
          id, email, password_hash, full_name, role, roles, asrama_binaan,
          structural_jabatan, source_type, source_ref_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          email,
          passwordHash,
          u.full_name,
          userRole,
          rolesJson,
          userRole === 'pengurus_asrama' ? (u.asrama_binaan || null) : null,
          roleNeedsStructuralJabatan([userRole]) ? structuralJabatan : null,
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

  if (successCount > 0) {
    await logActivity({
      actor: actorFromSession(session),
      module: 'pengaturan_users',
      action: 'create',
      fiturHref: '/dashboard/pengaturan/users',
      logKind: 'create',
      entityType: 'user_batch',
      entityId: 'batch',
      entityLabel: 'Import user batch',
      summary: `Membuat ${successCount} akun user secara batch`,
      details: {
        count: successCount,
        failed_count: errors.length,
      },
    })
  }

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true, count: successCount, errors: errors.length > 0 ? errors : null }
}

export async function updateUserDetails(userId: string, fullName: string, email: string): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  const beforeUser = await getUserById(userId)
  if (!beforeUser) return { error: 'User tidak ditemukan.' }

  const emailClean = email.toLowerCase().trim()
  const exist = await queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [emailClean, userId])
  if (exist) return { error: 'Email sudah digunakan user lain.' }

  await execute(
    'UPDATE users SET full_name = ?, email = ?, updated_at = ? WHERE id = ?',
    [fullName, emailClean, new Date().toISOString(), userId]
  )

  const guruId = beforeUser.guru_id || (beforeUser.source_type === 'guru' ? beforeUser.source_ref_id : null)
  if (guruId) {
    await execute('UPDATE data_guru SET nama_lengkap = ? WHERE id = ?', [fullName, guruId])
    
    revalidatePath('/dashboard/master/wali-kelas')
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_users',
    action: 'update',
    fiturHref: '/dashboard/pengaturan/users',
    logKind: 'update',
    entityType: 'user',
    entityId: userId,
    entityLabel: beforeUser.full_name || beforeUser.email,
    summary: `Memperbarui profil user ${beforeUser.full_name || beforeUser.email}`,
    details: {
      changed_fields: diffWhitelistedFields(
        { full_name: beforeUser.full_name, email: beforeUser.email },
        { full_name: fullName, email: emailClean },
        ['full_name', 'email']
      ),
    },
  })

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  const targetUser = await getUserById(userId)
  if (!targetUser) return { error: 'User tidak ditemukan.' }
  const passwordHash = await hashPassword(newPassword)

  await execute(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    [passwordHash, new Date().toISOString(), userId]
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_users',
    action: 'update',
    fiturHref: '/dashboard/pengaturan/users',
    logKind: 'update',
    entityType: 'user',
    entityId: userId,
    entityLabel: targetUser.full_name || targetUser.email,
    summary: `Mereset password user ${targetUser.full_name || targetUser.email}`,
    details: {
      reset_type: newPassword === DEFAULT_USER_PASSWORD ? 'default' : 'manual',
    },
  })

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
  const session = await getSession()
  const targetUser = await getUserById(userId)
  if (!targetUser) return { error: 'User tidak ditemukan.' }

  const usage = await findUserDeleteUsage(userId)
  if (usage) {
    return { error: `User tidak bisa dihapus karena masih dipakai pada ${usage}.` }
  }

  try {
    await execute('DELETE FROM users WHERE id = ?', [userId])
    await logActivity({
      actor: actorFromSession(session),
      module: 'pengaturan_users',
      action: 'delete',
      fiturHref: '/dashboard/pengaturan/users',
      logKind: 'delete',
      entityType: 'user',
      entityId: userId,
      entityLabel: targetUser.full_name || targetUser.email,
      summary: `Menghapus user ${targetUser.full_name || targetUser.email}`,
      details: {
        email: targetUser.email,
        role: targetUser.role,
        roles: parseRoles(targetUser.roles, targetUser.role),
        structural_jabatan: targetUser.structural_jabatan,
      },
    })
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
  const session = await getSession()
  const targetUser = await getUserById(userId)
  const fitur = await queryOne<{ title: string; href: string }>(
    'SELECT title, href FROM fitur_akses WHERE id = ?',
    [fiturId]
  )

  await execute(
    `INSERT INTO user_fitur_override (user_id, fitur_id, action, created_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, fitur_id) DO UPDATE SET action = excluded.action, created_at = excluded.created_at`,
    [userId, fiturId, action]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_users',
    action: 'access_change',
    fiturHref: '/dashboard/pengaturan/users',
    logKind: 'update',
    entityType: 'user',
    entityId: userId,
    entityLabel: targetUser?.full_name || targetUser?.email || userId,
    summary: `${action === 'grant' ? 'Memberi' : 'Mencabut'} override fitur untuk ${targetUser?.full_name || targetUser?.email || userId}`,
    details: {
      fitur_id: fiturId,
      fitur_title: fitur?.title || fitur?.href || String(fiturId),
      override_action: action,
    },
  })
  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function removeUserFiturOverride(
  userId: string,
  fiturId: number
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  const targetUser = await getUserById(userId)
  const fitur = await queryOne<{ title: string; href: string }>(
    'SELECT title, href FROM fitur_akses WHERE id = ?',
    [fiturId]
  )

  await execute(
    'DELETE FROM user_fitur_override WHERE user_id = ? AND fitur_id = ?',
    [userId, fiturId]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_users',
    action: 'access_change',
    fiturHref: '/dashboard/pengaturan/users',
    logKind: 'update',
    entityType: 'user',
    entityId: userId,
    entityLabel: targetUser?.full_name || targetUser?.email || userId,
    summary: `Menghapus override fitur untuk ${targetUser?.full_name || targetUser?.email || userId}`,
    details: {
      fitur_id: fiturId,
      fitur_title: fitur?.title || fitur?.href || String(fiturId),
    },
  })
  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}

export async function getAllActiveFitur() {
  const all = await getCachedFiturAkses()
  return all.filter(f => f.is_active)
}

const STRUCTURAL_ROLE_VALUES = ['pengurus_asrama', 'sekpen', 'dewan_santri', 'keamanan']
const DEFAULT_STRUCTURAL_JABATAN = 'anggota'
const STRUCTURAL_JABATAN_VALUES = [DEFAULT_STRUCTURAL_JABATAN, 'ketua', 'sekretaris', 'bendahara']

function roleNeedsStructuralJabatan(roles: string[]) {
  return roles.some(role => STRUCTURAL_ROLE_VALUES.includes(role))
}

function normalizeStructuralJabatan(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '_')
  return STRUCTURAL_JABATAN_VALUES.includes(normalized) ? normalized : DEFAULT_STRUCTURAL_JABATAN
}

export async function mergeUserAccounts(primaryId: string, secondaryId: string): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (primaryId === secondaryId) return { error: 'Tidak bisa menggabungkan akun yang sama.' }
  
  const primary = await getUserById(primaryId)
  const secondary = await getUserById(secondaryId)
  
  if (!primary || !secondary) return { error: 'Salah satu user tidak ditemukan.' }

  // Combine roles
  const r1 = parseRoles(primary.roles, primary.role)
  const r2 = parseRoles(secondary.roles, secondary.role)
  const combinedRoles = Array.from(new Set([...r1, ...r2]))
  const newRole = combinedRoles[0] || 'User'
  const newRolesStr = JSON.stringify(combinedRoles)

  // Combine flags
  const newAsramaBinaan = primary.asrama_binaan || secondary.asrama_binaan || null
  const newStructural = primary.structural_jabatan || secondary.structural_jabatan || null
  const newGuruId = primary.guru_id || secondary.guru_id || (primary.source_type === 'guru' ? primary.source_ref_id : (secondary.source_type === 'guru' ? secondary.source_ref_id : null))
  const newSantriId = primary.santri_id || secondary.santri_id || (['sadesa', 'santri'].includes(primary.source_type || '') ? primary.source_ref_id : (['sadesa', 'santri'].includes(secondary.source_type || '') ? secondary.source_ref_id : null))

  // Determine source type for backward compat (keep primary unless it's null)
  let newSourceType = primary.source_type
  let newSourceRefId = primary.source_ref_id
  if (!newSourceType && secondary.source_type) {
    newSourceType = secondary.source_type
    newSourceRefId = secondary.source_ref_id
  }

  // Update related records
  await execute('UPDATE kelas SET wali_kelas_id = ? WHERE wali_kelas_id = ?', [primaryId, secondaryId])
  await execute('UPDATE user_fitur_override SET user_id = ? WHERE user_id = ?', [primaryId, secondaryId])
  await execute('UPDATE activity_log SET actor_user_id = ? WHERE actor_user_id = ?', [primaryId, secondaryId])
  
  // Actually perform the update on primary user
  await execute(`
    UPDATE users SET
      role = ?,
      roles = ?,
      asrama_binaan = ?,
      structural_jabatan = ?,
      guru_id = ?,
      santri_id = ?,
      source_type = ?,
      source_ref_id = ?
    WHERE id = ?
  `, [
    newRole, newRolesStr, newAsramaBinaan, newStructural, newGuruId ? Number(newGuruId) : null, newSantriId, newSourceType, newSourceRefId, primaryId
  ])

  // Merge PSB Akses flags (this needs manual read first since we didn't fetch them in getUserById)
  try {
    const psbRows = await queryOne<{ v1: number, a1: number, b1: number, v2: number, a2: number, b2: number }>(`
      SELECT 
        u1.psb_verifikasi_akses as v1, u1.psb_asrama_akses as a1, u1.psb_bayar_akses as b1,
        u2.psb_verifikasi_akses as v2, u2.psb_asrama_akses as a2, u2.psb_bayar_akses as b2
      FROM users u1
      LEFT JOIN users u2 ON u2.id = ?
      WHERE u1.id = ?
    `, [secondaryId, primaryId])
    
    if (psbRows) {
      await execute(`
        UPDATE users SET 
          psb_verifikasi_akses = ?, psb_asrama_akses = ?, psb_bayar_akses = ?
        WHERE id = ?
      `, [
        psbRows.v1 || psbRows.v2 ? 1 : 0,
        psbRows.a1 || psbRows.a2 ? 1 : 0,
        psbRows.b1 || psbRows.b2 ? 1 : 0,
        primaryId
      ])
    }
  } catch (err) {}

  // Delete secondary user
  await execute('DELETE FROM users WHERE id = ?', [secondaryId])

  await logActivity({
    actor: actorFromSession(session),
    module: 'pengaturan_users',
    action: 'update',
    fiturHref: '/dashboard/pengaturan/users',
    logKind: 'update',
    entityType: 'user_merge',
    entityId: primaryId,
    entityLabel: primary.full_name,
    summary: `Menggabungkan akun \${secondary.full_name} ke dalam \${primary.full_name}`,
    details: { secondary_id: secondaryId, combined_roles: combinedRoles }
  })

  revalidatePath('/dashboard/pengaturan/users')
  return { success: true }
}
