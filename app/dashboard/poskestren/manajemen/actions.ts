/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { canPoskestrenDelete, requirePoskestrenFeature } from '@/lib/poskestren/access'
import {
  assertDate,
  cleanText,
  normalizePoskestrenListQuery,
  parseNonNegativeInteger,
} from '@/lib/poskestren/query'
import {
  POSKESTREN_HREF,
  type PoskestrenJabatan,
  type PoskestrenListQuery,
  type PoskestrenPersonnelType,
} from '@/lib/poskestren/types'

const PATH = POSKESTREN_HREF.management
const refresh = () => {
  revalidatePath(PATH)
  revalidatePath(POSKESTREN_HREF.examination)
  revalidatePath(POSKESTREN_HREF.reports)
}

function parseRoles(value: string | null, fallback: string | null) {
  try {
    const parsed = value ? JSON.parse(value) : []
    if (Array.isArray(parsed)) return parsed.filter(role => typeof role === 'string' && role)
  } catch {}
  return fallback ? [fallback] : []
}

async function audit(session: Awaited<ReturnType<typeof requirePoskestrenFeature>>, action: string, entityType: string, id: string, summary: string, details?: Record<string, unknown>) {
  await logActivity({
    actor: actorFromSession(session),
    module: 'poskestren_manajemen',
    action,
    fiturHref: PATH,
    logKind: action === 'create' ? 'create' : 'update',
    entityType,
    entityId: id,
    summary,
    details,
  })
}

export async function getPersonnel(input: PoskestrenListQuery & { personnelType?: string } = {}) {
  await requirePoskestrenFeature(PATH)
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (input.personnelType) { where.push('p.personnel_type = ?'); params.push(input.personnelType) }
  if (normalized.status === 'active') where.push('p.is_active = 1')
  if (normalized.status === 'inactive') where.push('p.is_active = 0')
  if (normalized.q) {
    const like = `%${normalized.q}%`
    where.push('(p.full_name LIKE ? OR p.profession LIKE ? OR p.position_name LIKE ? OR p.phone LIKE ? OR p.license_number LIKE ? OR u.email LIKE ?)')
    params.push(like, like, like, like, like, like)
  }
  const rows = await query<any>(
    `SELECT p.id, p.user_id, p.personnel_type, p.full_name, p.profession,
            p.position_name, p.phone, p.license_number, p.employment_start,
            p.employment_end, p.is_active, p.notes, p.created_at,
            u.email, u.poskestren_jabatan,
            ch.effective_from, ch.session_rate_rupiah, ch.patient_rate_rupiah,
            ch.monthly_salary_rupiah
     FROM poskestren_personnel p
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN poskestren_compensation_history ch ON ch.id = (
       SELECT inner_ch.id FROM poskestren_compensation_history inner_ch
       WHERE inner_ch.personnel_id = p.id
       ORDER BY inner_ch.effective_from DESC, inner_ch.created_at DESC LIMIT 1
     )
     WHERE ${where.join(' AND ')}
     ORDER BY p.is_active DESC, p.full_name COLLATE NOCASE
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const hasMore = rows.length > normalized.limit
  return { items: rows.slice(0, normalized.limit), hasMore, truncated: normalized.isAll && hasMore }
}

export async function getPersonnelDetail(id: string) {
  await requirePoskestrenFeature(PATH)
  const [personnel, compensationHistory] = await Promise.all([
    queryOne<any>(
      `SELECT p.id, p.user_id, p.personnel_type, p.full_name, p.profession,
              p.position_name, p.phone, p.license_number, p.employment_start,
              p.employment_end, p.is_active, p.notes, u.email, u.poskestren_jabatan
       FROM poskestren_personnel p LEFT JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
      [id]
    ),
    query<any>(
      `SELECT ch.id, ch.effective_from, ch.session_rate_rupiah,
              ch.patient_rate_rupiah, ch.monthly_salary_rupiah, ch.notes,
              ch.created_at, u.full_name AS creator_name
       FROM poskestren_compensation_history ch
       LEFT JOIN users u ON u.id = ch.created_by
       WHERE ch.personnel_id = ?
       ORDER BY ch.effective_from DESC, ch.created_at DESC`,
      [id]
    ),
  ])
  return { personnel, compensationHistory }
}

export async function getUserOptions(q = '') {
  await requirePoskestrenFeature(PATH)
  const search = String(q).trim().slice(0, 80)
  const params: unknown[] = []
  const where = [
    `u.id NOT IN (SELECT user_id FROM poskestren_personnel WHERE user_id IS NOT NULL)`,
    `(u.role = 'poskestren' OR u.roles LIKE '%"poskestren"%')`
  ]
  if (search) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  return query<any>(
    `SELECT u.id, u.full_name, u.email, u.role, u.roles, u.poskestren_jabatan
     FROM users u WHERE ${where.join(' AND ')}
     ORDER BY u.full_name COLLATE NOCASE LIMIT 200`,
    params
  )
}

export async function savePersonnel(input: {
  id?: string
  userId?: string | null
  personnelType: PoskestrenPersonnelType
  fullName: string
  profession?: string
  positionName?: string
  phone?: string
  licenseNumber?: string
  employmentStart?: string
  employmentEnd?: string
  notes?: string
  isActive?: boolean
  poskestrenJabatan?: PoskestrenJabatan | null
}) {
  const session = await requirePoskestrenFeature(PATH, input.id ? 'update' : 'create')
  const fullName = cleanText(input.fullName, 150)
  if (!fullName) return { success: false as const, error: 'Nama personel wajib diisi.' }
  if (!['MEDICAL', 'EMPLOYEE'].includes(input.personnelType)) return { success: false as const, error: 'Jenis personel tidak valid.' }
  const employmentStart = input.employmentStart ? assertDate(input.employmentStart, 'Tanggal mulai') : null
  const employmentEnd = input.employmentEnd ? assertDate(input.employmentEnd, 'Tanggal berakhir') : null
  if (employmentStart && employmentEnd && employmentEnd < employmentStart) return { success: false as const, error: 'Tanggal berakhir mendahului tanggal mulai.' }
  const user = input.userId ? await queryOne<{ id: string; role: string; roles: string | null }>(
    'SELECT id, role, roles FROM users WHERE id = ?',
    [input.userId]
  ) : null
  if (input.userId && !user) return { success: false as const, error: 'Akun pengguna tidak ditemukan.' }
  if (input.poskestrenJabatan && !['ketua', 'bendahara', 'sekretaris'].includes(input.poskestrenJabatan)) {
    return { success: false as const, error: 'Jabatan POSKESTREN tidak valid.' }
  }
  const id = input.id || generateId()
  const db = await getDB()
  const statements: any[] = []
  if (input.id) {
    const exists = await queryOne<{ id: string }>('SELECT id FROM poskestren_personnel WHERE id = ?', [id])
    if (!exists) return { success: false as const, error: 'Personel tidak ditemukan.' }
    statements.push(db.prepare(
      `UPDATE poskestren_personnel
       SET user_id = ?, personnel_type = ?, full_name = ?, profession = ?,
           position_name = ?, phone = ?, license_number = ?, employment_start = ?,
           employment_end = ?, is_active = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      user?.id || null, input.personnelType, fullName, cleanText(input.profession, 100),
      cleanText(input.positionName, 100), cleanText(input.phone, 80), cleanText(input.licenseNumber, 100),
      employmentStart, employmentEnd, input.isActive === false ? 0 : 1, cleanText(input.notes), id
    ))
  } else {
    statements.push(db.prepare(
      `INSERT INTO poskestren_personnel(
         id, user_id, personnel_type, full_name, profession, position_name,
         phone, license_number, employment_start, employment_end, is_active,
         notes, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, user?.id || null, input.personnelType, fullName, cleanText(input.profession, 100),
      cleanText(input.positionName, 100), cleanText(input.phone, 80), cleanText(input.licenseNumber, 100),
      employmentStart, employmentEnd, input.isActive === false ? 0 : 1, cleanText(input.notes), session.id
    ))
  }
  if (user) {
    const roles = parseRoles(user.roles, user.role).filter(role => role !== 'poskestren' && !role.startsWith('poskestren:'))
    roles.push('poskestren')
    if (input.poskestrenJabatan) roles.push(`poskestren:${input.poskestrenJabatan}`)
    statements.push(db.prepare(
      `UPDATE users SET roles = ?, poskestren_jabatan = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(JSON.stringify([...new Set(roles)]), input.poskestrenJabatan || null, user.id))
  }
  try {
    await db.batch(statements)
  } catch (error) {
    if (String(error).includes('UNIQUE')) return { success: false as const, error: 'Akun tersebut sudah ditautkan ke personel lain.' }
    throw error
  }
  await audit(session, input.id ? 'update' : 'create', 'poskestren_personnel', id, `${input.id ? 'Memperbarui' : 'Menambah'} personel ${fullName}`, {
    personnel_type: input.personnelType,
    user_id: user?.id || null,
    poskestren_jabatan: input.poskestrenJabatan || null,
  })
  refresh()
  revalidatePath('/dashboard')
  return { success: true as const, id }
}

export async function appendCompensation(input: {
  personnelId: string
  effectiveFrom: string
  sessionRateRupiah?: number
  patientRateRupiah?: number
  monthlySalaryRupiah?: number
  notes?: string
}) {
  const session = await requirePoskestrenFeature(PATH, 'update')
  const effectiveFrom = assertDate(input.effectiveFrom, 'Tanggal efektif')
  const personnel = await queryOne<{ id: string; full_name: string; personnel_type: PoskestrenPersonnelType }>(
    'SELECT id, full_name, personnel_type FROM poskestren_personnel WHERE id = ?',
    [input.personnelId]
  )
  if (!personnel) return { success: false as const, error: 'Personel tidak ditemukan.' }
  const sessionRate = parseNonNegativeInteger(input.sessionRateRupiah || 0, 'Tarif sesi')
  const patientRate = parseNonNegativeInteger(input.patientRateRupiah || 0, 'Tarif pasien')
  const monthlySalary = parseNonNegativeInteger(input.monthlySalaryRupiah || 0, 'Gaji bulanan')
  if (personnel.personnel_type === 'MEDICAL' && sessionRate === 0 && patientRate === 0) {
    return { success: false as const, error: 'Minimal salah satu tarif tenaga medis harus diisi.' }
  }
  if (personnel.personnel_type === 'EMPLOYEE' && monthlySalary === 0) {
    return { success: false as const, error: 'Gaji bulanan wajib lebih dari nol.' }
  }
  const id = generateId()
  try {
    await (await getDB()).prepare(
      `INSERT INTO poskestren_compensation_history(
         id, personnel_id, effective_from, session_rate_rupiah,
         patient_rate_rupiah, monthly_salary_rupiah, notes, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, personnel.id, effectiveFrom,
      personnel.personnel_type === 'MEDICAL' ? sessionRate : null,
      personnel.personnel_type === 'MEDICAL' ? patientRate : null,
      personnel.personnel_type === 'EMPLOYEE' ? monthlySalary : null,
      cleanText(input.notes), session.id
    ).run()
  } catch (error) {
    if (String(error).includes('UNIQUE')) return { success: false as const, error: 'Sudah ada tarif pada tanggal efektif tersebut.' }
    throw error
  }
  await audit(session, 'create', 'poskestren_compensation_history', id, `Menambah riwayat kompensasi ${personnel.full_name}`, {
    personnel_id: personnel.id,
    effective_from: effectiveFrom,
    session_rate_rupiah: sessionRate,
    patient_rate_rupiah: patientRate,
    monthly_salary_rupiah: monthlySalary,
  })
  refresh()
  return { success: true as const, id }
}

export async function deletePersonnel(id: string) {
  const session = await requirePoskestrenFeature(PATH, 'update')
  if (!canPoskestrenDelete(session)) {
    return { success: false as const, error: 'Hanya Admin, Ketua, Sekretaris, atau Bendahara POSKESTREN yang dapat menghapus personel.' }
  }
  const personnel = await queryOne<{ id: string; full_name: string; user_id: string | null; personnel_type: string }>(
    'SELECT id, full_name, user_id, personnel_type FROM poskestren_personnel WHERE id = ?',
    [id]
  )
  if (!personnel) return { success: false as const, error: 'Personel tidak ditemukan.' }

  // Cek apakah personel punya riwayat pemeriksaan atau transaksi keuangan
  const hasVisit = await queryOne<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM poskestren_visit WHERE personnel_id = ?',
    [id]
  )
  if (hasVisit && Number(hasVisit.cnt) > 0) {
    return { success: false as const, error: `Personel ini memiliki ${hasVisit.cnt} riwayat pemeriksaan dan tidak dapat dihapus. Nonaktifkan saja.` }
  }

  const db = await getDB()
  const statements: any[] = []

  // Hapus riwayat kompensasi
  statements.push(db.prepare('DELETE FROM poskestren_compensation_history WHERE personnel_id = ?').bind(id))

  // Lepas role poskestren dari user jika ditautkan
  if (personnel.user_id) {
    const user = await queryOne<{ role: string; roles: string | null }>(
      'SELECT role, roles FROM users WHERE id = ?',
      [personnel.user_id]
    )
    if (user) {
      let roles: string[]
      try {
        roles = user.roles ? JSON.parse(user.roles) : []
        if (!Array.isArray(roles)) roles = [user.role].filter(Boolean)
      } catch { roles = [user.role].filter(Boolean) }
      const cleaned = roles.filter(r => r !== 'poskestren' && !r.startsWith('poskestren:'))
      statements.push(db.prepare(
        `UPDATE users SET roles = ?, poskestren_jabatan = NULL, updated_at = datetime('now') WHERE id = ?`
      ).bind(JSON.stringify(cleaned), personnel.user_id))
    }
  }

  // Hapus personel
  statements.push(db.prepare('DELETE FROM poskestren_personnel WHERE id = ?').bind(id))

  await db.batch(statements)

  await logActivity({
    actor: actorFromSession(session),
    module: 'poskestren_manajemen',
    action: 'delete',
    fiturHref: PATH,
    logKind: 'delete',
    entityType: 'poskestren_personnel',
    entityId: id,
    summary: `Menghapus personel ${personnel.full_name}`,
    details: { personnel_type: personnel.personnel_type },
  })
  refresh()
  revalidatePath('/dashboard')
  return { success: true as const }
}

