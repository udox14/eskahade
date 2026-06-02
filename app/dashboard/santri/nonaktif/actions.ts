'use server'

import { batch, generateId, now, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { assertCrud } from '@/lib/auth/crud'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

const DEFAULT_PAGE_SIZE = 30
const BULK_CHUNK_SIZE = 80

type ListParams = {
  search?: string
  asrama?: string
  kamar?: string
  kelasSekolah?: string
  page?: number
  pageSize?: number
}

type SantriStatus = 'aktif' | 'nonaktif_sementara'

function chunkArray<T>(items: T[], size = BULK_CHUNK_SIZE) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export async function getFilterOptions() {
  const [asramaRows, kamarRows, kelasRows] = await Promise.all([
    query<{ v: string }>(
      `SELECT DISTINCT asrama AS v FROM santri
       WHERE status_global IN ('aktif', 'nonaktif_sementara')
         AND asrama IS NOT NULL AND asrama <> ''
       ORDER BY asrama`
    ),
    query<{ v: string }>(
      `SELECT DISTINCT kamar AS v FROM santri
       WHERE status_global IN ('aktif', 'nonaktif_sementara')
         AND kamar IS NOT NULL AND TRIM(kamar) <> ''
       ORDER BY CAST(kamar AS INTEGER), kamar`
    ),
    query<{ v: string }>(
      `SELECT DISTINCT kelas_sekolah AS v FROM santri
       WHERE status_global IN ('aktif', 'nonaktif_sementara')
         AND kelas_sekolah IS NOT NULL AND kelas_sekolah <> ''
       ORDER BY CAST(kelas_sekolah AS INTEGER), kelas_sekolah`
    ),
  ])

  return {
    asramaList: asramaRows.map(r => r.v),
    kamarList: kamarRows.map(r => r.v),
    kelasSekolahList: kelasRows.map(r => r.v),
  }
}

function buildWhere(status: SantriStatus, params: ListParams) {
  const clauses = ['s.status_global = ?']
  const values: unknown[] = [status]

  if (params.asrama) {
    clauses.push('s.asrama = ?')
    values.push(params.asrama)
  }
  if (params.kamar === 'TANPA_KAMAR') {
    clauses.push("(s.kamar IS NULL OR TRIM(s.kamar) = '')")
  } else if (params.kamar) {
    clauses.push('s.kamar = ?')
    values.push(params.kamar)
  }
  if (params.kelasSekolah) {
    clauses.push('s.kelas_sekolah = ?')
    values.push(params.kelasSekolah)
  }
  if (params.search) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    values.push(`%${params.search}%`, `%${params.search}%`)
  }

  return { where: clauses.join(' AND '), values }
}

export async function getSantriAktif(params: ListParams) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const showAll = pageSize === 0
  const offset = showAll ? 0 : (page - 1) * pageSize
  const { where, values } = buildWhere('aktif', params)

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s WHERE ${where}`,
    values
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows: [], total: 0, page: 1, totalPages: 0 }

  const limitClause = showAll ? '' : 'LIMIT ? OFFSET ?'
  const listValues = showAll ? values : [...values, pageSize, offset]
  const rows = await query<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    kelas_sekolah: string | null
    sekolah: string | null
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, s.kelas_sekolah, s.sekolah
     FROM santri s
     WHERE ${where}
     ORDER BY CAST(s.kelas_sekolah AS INTEGER), s.kelas_sekolah, s.nama_lengkap
     ${limitClause}`,
    listValues
  )

  return { rows, total, page: showAll ? 1 : page, totalPages: showAll ? 1 : Math.ceil(total / pageSize) }
}

export async function getSantriNonaktif(params: ListParams) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const showAll = pageSize === 0
  const offset = showAll ? 0 : (page - 1) * pageSize
  const { where, values } = buildWhere('nonaktif_sementara', params)

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s WHERE ${where}`,
    values
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows: [], total: 0, page: 1, totalPages: 0 }

  const limitClause = showAll ? '' : 'LIMIT ? OFFSET ?'
  const listValues = showAll ? values : [...values, pageSize, offset]
  const rows = await query<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    kelas_sekolah: string | null
    sekolah: string | null
    tanggal_mulai: string | null
    tanggal_rencana_aktif: string | null
    alasan: string | null
    catatan: string | null
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, s.kelas_sekolah, s.sekolah,
            l.tanggal_mulai, l.tanggal_rencana_aktif, l.alasan, l.catatan
     FROM santri s
     LEFT JOIN santri_nonaktif_log l
       ON l.santri_id = s.id AND l.status = 'AKTIF'
     WHERE ${where}
     ORDER BY COALESCE(l.tanggal_mulai, s.created_at) DESC, s.nama_lengkap
     ${limitClause}`,
    listValues
  )

  return { rows, total, page: showAll ? 1 : page, totalPages: showAll ? 1 : Math.ceil(total / pageSize) }
}

export async function getSantriIdsByStatus(status: SantriStatus, params: ListParams) {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access

  const { where, values } = buildWhere(status, params)
  const rows = await query<{ id: string }>(
    `SELECT s.id
     FROM santri s
     WHERE ${where}
     ORDER BY CAST(s.kelas_sekolah AS INTEGER), s.kelas_sekolah, s.nama_lengkap`,
    values
  )

  return { ids: rows.map(row => row.id) }
}

export async function nonaktifkanSantri(params: {
  santriIds: string[]
  tanggalMulai: string
  tanggalRencanaAktif?: string
  alasan: string
  catatan?: string
}): Promise<{ success: boolean; count: number } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const ids = [...new Set(params.santriIds.filter(Boolean))]
  if (ids.length === 0) return { error: 'Pilih minimal satu santri' }
  if (!params.tanggalMulai) return { error: 'Tanggal mulai wajib diisi' }
  if (!params.alasan.trim()) return { error: 'Alasan wajib diisi' }

  try {
    const activeRows: { id: string }[] = []
    for (const chunk of chunkArray(ids)) {
      const placeholders = chunk.map(() => '?').join(',')
      activeRows.push(...await query<{ id: string }>(
        `SELECT id FROM santri WHERE status_global = 'aktif' AND id IN (${placeholders})`,
        chunk
      ))
    }
    if (activeRows.length === 0) return { error: 'Tidak ada santri aktif yang valid untuk dinonaktifkan' }

    const activeIds = activeRows.map(r => r.id)
    const timestamp = now()
    for (const chunk of chunkArray(activeIds)) {
      const placeholders = chunk.map(() => '?').join(',')
      await batch([
        {
          sql: `UPDATE santri SET status_global = 'nonaktif_sementara', updated_at = ? WHERE id IN (${placeholders})`,
          params: [timestamp, ...chunk],
        },
        ...chunk.map(id => ({
          sql: `UPDATE santri_nonaktif_log
                SET status = 'SELESAI',
                    tanggal_aktif_aktual = COALESCE(tanggal_aktif_aktual, ?),
                    closed_by = ?,
                    updated_at = ?
                WHERE santri_id = ? AND status = 'AKTIF'`,
          params: [params.tanggalMulai, session.id, timestamp, id],
        })),
        ...chunk.map(id => ({
          sql: `INSERT INTO santri_nonaktif_log
                (id, santri_id, tanggal_mulai, tanggal_rencana_aktif, alasan, catatan, status, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'AKTIF', ?, ?, ?)`,
          params: [
            generateId(),
            id,
            params.tanggalMulai,
            params.tanggalRencanaAktif || null,
            params.alasan.trim(),
            params.catatan?.trim() || null,
            session.id,
            timestamp,
            timestamp,
          ],
        })),
      ])
    }
    try {
      await logActivity({
        actor: actorFromSession(session),
        module: 'santri',
        action: 'update',
        fiturHref: '/dashboard/santri',
        logKind: 'update',
        entityType: 'santri_nonaktif_batch',
        entityId: 'nonaktifkan',
        entityLabel: 'Nonaktifkan santri',
        summary: `Menonaktifkan sementara ${activeIds.length} santri`,
        details: {
          count: activeIds.length,
          tanggal_mulai: params.tanggalMulai,
          tanggal_rencana_aktif: params.tanggalRencanaAktif || null,
          alasan: params.alasan.trim(),
          catatan: params.catatan?.trim() || null,
        },
      })
    } catch (logError) {
      console.error('[santri_nonaktif] log nonaktifkan gagal:', logError)
    }
    revalidatePath('/dashboard/santri/nonaktif')
    revalidatePath('/dashboard/santri')
    return { success: true, count: activeIds.length }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal menonaktifkan santri' }
  }
}

export async function aktifkanKembaliSantri(params: {
  santriIds: string[]
  tanggalAktif: string
}): Promise<{ success: boolean; count: number } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const ids = [...new Set(params.santriIds.filter(Boolean))]
  if (ids.length === 0) return { error: 'Pilih minimal satu santri' }
  if (!params.tanggalAktif) return { error: 'Tanggal aktif kembali wajib diisi' }

  try {
    const rows: { id: string }[] = []
    for (const chunk of chunkArray(ids)) {
      const placeholders = chunk.map(() => '?').join(',')
      rows.push(...await query<{ id: string }>(
        `SELECT id FROM santri WHERE status_global = 'nonaktif_sementara' AND id IN (${placeholders})`,
        chunk
      ))
    }
    if (rows.length === 0) return { error: 'Tidak ada santri nonaktif yang valid untuk diaktifkan' }

    const validIds = rows.map(r => r.id)
    const updatedAt = now()
    for (const chunk of chunkArray(validIds)) {
      const placeholders = chunk.map(() => '?').join(',')
      await batch([
        {
          sql: `UPDATE santri SET status_global = 'aktif', updated_at = ? WHERE id IN (${placeholders})`,
          params: [updatedAt, ...chunk],
        },
        {
          sql: `UPDATE santri_nonaktif_log
                SET status = 'SELESAI',
                    tanggal_aktif_aktual = ?,
                    closed_by = ?,
                    updated_at = ?
                WHERE status = 'AKTIF' AND santri_id IN (${placeholders})`,
          params: [params.tanggalAktif, session.id, updatedAt, ...chunk],
        },
      ])
    }

    try {
      await logActivity({
        actor: actorFromSession(session),
        module: 'santri',
        action: 'update',
        fiturHref: '/dashboard/santri',
        logKind: 'update',
        entityType: 'santri_nonaktif_batch',
        entityId: 'aktifkan-kembali',
        entityLabel: 'Aktifkan kembali santri',
        summary: `Mengaktifkan kembali ${validIds.length} santri`,
        details: {
          count: validIds.length,
          tanggal_aktif: params.tanggalAktif,
        },
      })
    } catch (logError) {
      console.error('[santri_nonaktif] log aktifkan kembali gagal:', logError)
    }

    revalidatePath('/dashboard/santri/nonaktif')
    revalidatePath('/dashboard/santri')
    return { success: true, count: validIds.length }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal mengaktifkan kembali santri' }
  }
}
