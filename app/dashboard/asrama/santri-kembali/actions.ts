'use server'

import { execute, query, queryOne } from '@/lib/db'
import { getSession, hasAnyRole, hasRole, isAdmin } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const FEATURE_PATH = '/dashboard/asrama/santri-kembali'

export type SessionInfo = {
  role: string
  asrama_binaan: string | null
  isAdmin: boolean
}

export type SantriKembaliRow = {
  id: string
  santri_id: string
  nama: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  alasan: string
  pemberi_izin: string
  tgl_mulai: string
  tgl_selesai_rencana: string
  created_at: string
}

export type SantriBelumKembaliResult = {
  rows: SantriKembaliRow[]
  total: number
  overdueTotal: number
  hasMore: boolean
}

async function getAllowedSession() {
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'pengurus_asrama', 'dewan_santri'])) {
    return null
  }
  return session
}

async function getRestrictedAsrama(): Promise<string | null> {
  const session = await getSession()
  if (!session) return null
  if (hasRole(session, 'pengurus_asrama')) return session.asrama_binaan ?? null
  return null
}

export async function getSantriKembaliSession(): Promise<SessionInfo | null> {
  const session = await getSession()
  if (!session) return null
  return {
    role: session.role,
    asrama_binaan: hasRole(session, 'pengurus_asrama') ? session.asrama_binaan ?? null : null,
    isAdmin: isAdmin(session),
  }
}

export async function getAsramaListSantriKembali() {
  const restrictedAsrama = await getRestrictedAsrama()
  if (restrictedAsrama) return [restrictedAsrama]

  const rows = await query<{ asrama: string }>(`
    SELECT DISTINCT asrama
    FROM santri
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL
      AND asrama != ''
    ORDER BY asrama
  `)

  return rows.map(row => row.asrama)
}

export async function getSantriBelumKembali(params: { asrama?: string; search?: string; limit?: number; offset?: number }): Promise<SantriBelumKembaliResult> {
  const session = await getAllowedSession()
  if (!session) return { rows: [], total: 0, overdueTotal: 0, hasMore: false }

  const restrictedAsrama = await getRestrictedAsrama()
  const clauses = ["p.jenis = 'PULANG'", "p.status = 'AKTIF'", "p.tgl_kembali_aktual IS NULL"]
  const bind: unknown[] = []
  const limit = Math.min(Math.max(params.limit ?? 30, 1), 100)
  const offset = Math.max(params.offset ?? 0, 0)

  const targetAsrama = restrictedAsrama || params.asrama
  if (targetAsrama && targetAsrama !== 'SEMUA') {
    clauses.push('s.asrama = ?')
    bind.push(targetAsrama)
  }

  const clean = params.search?.trim()
  if (clean) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ? OR s.kamar LIKE ?)')
    bind.push(`%${clean}%`, `%${clean}%`, `%${clean}%`)
  }

  const where = clauses.join(' AND ')
  const [stats, rows] = await Promise.all([
    queryOne<{ total: number; overdueTotal: number }>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN p.tgl_selesai_rencana < ? THEN 1 ELSE 0 END) AS overdueTotal
      FROM perizinan p
      JOIN santri s ON s.id = p.santri_id
      WHERE ${where}
    `, [new Date().toISOString(), ...bind]),
    query<SantriKembaliRow>(`
    SELECT
      p.id,
      p.santri_id,
      p.alasan,
      p.pemberi_izin,
      p.tgl_mulai,
      p.tgl_selesai_rencana,
      p.created_at,
      s.nama_lengkap AS nama,
      s.nis,
      s.asrama,
      s.kamar
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${where}
    ORDER BY p.tgl_selesai_rencana ASC, s.asrama, s.kamar, s.nama_lengkap
    LIMIT ? OFFSET ?
    `, [...bind, limit + 1, offset]),
  ])

  return {
    rows: rows.slice(0, limit),
    total: stats?.total ?? 0,
    overdueTotal: stats?.overdueTotal ?? 0,
    hasMore: rows.length > limit,
  }
}

export async function tandaiSantriKembali(id: string, waktuDatang: string) {
  const session = await getAllowedSession()
  if (!session) return { error: 'Akses ditolak' }

  const izin = await queryOne<{
    id: string
    jenis: string
    status: string
    tgl_selesai_rencana: string
    asrama: string | null
  }>(`
    SELECT p.id, p.jenis, p.status, p.tgl_selesai_rencana, s.asrama
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE p.id = ?
  `, [id])

  if (!izin) return { error: 'Data izin tidak ditemukan.' }
  if (izin.jenis !== 'PULANG') return { error: 'Hanya izin pulang yang bisa ditandai dari fitur ini.' }
  if (izin.status !== 'AKTIF') return { error: 'Izin ini sudah selesai.' }

  const restrictedAsrama = await getRestrictedAsrama()
  if (restrictedAsrama && izin.asrama !== restrictedAsrama) {
    return { error: 'Pengurus asrama hanya bisa menandai santri asramanya.' }
  }

  const actual = new Date(waktuDatang)
  if (Number.isNaN(actual.getTime())) return { error: 'Waktu datang tidak valid.' }

  const rencana = new Date(izin.tgl_selesai_rencana)
  const isTelat = actual > rencana
  const statusFinal = isTelat ? 'AKTIF' : 'KEMBALI'

  await execute(`
    UPDATE perizinan
    SET status = ?, tgl_kembali_aktual = ?
    WHERE id = ?
  `, [statusFinal, actual.toISOString(), id])

  revalidatePath(FEATURE_PATH)
  revalidatePath('/dashboard/keamanan/perizinan')
  revalidatePath('/dashboard/keamanan/perizinan/verifikasi-telat')

  if (isTelat) {
    return { success: true, telat: true, message: 'Santri ditandai datang terlambat dan masuk verifikasi telat.' }
  }
  return { success: true, telat: false, message: 'Santri sudah ditandai kembali.' }
}
