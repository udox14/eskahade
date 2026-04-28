'use server'

import { batch, execute, generateId, now, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const DEFAULT_PAGE_SIZE = 30

type ListParams = {
  search?: string
  asrama?: string
  kelasSekolah?: string
  page?: number
  pageSize?: number
}

export async function getFilterOptions() {
  const [asramaRows, kelasRows] = await Promise.all([
    query<{ v: string }>(
      `SELECT DISTINCT asrama AS v FROM santri
       WHERE status_global IN ('aktif', 'nonaktif_sementara')
         AND asrama IS NOT NULL AND asrama <> ''
       ORDER BY asrama`
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
    kelasSekolahList: kelasRows.map(r => r.v),
  }
}

function buildWhere(status: 'aktif' | 'nonaktif_sementara', params: ListParams) {
  const clauses = ['s.status_global = ?']
  const values: unknown[] = [status]

  if (params.asrama) {
    clauses.push('s.asrama = ?')
    values.push(params.asrama)
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
  const offset = (page - 1) * pageSize
  const { where, values } = buildWhere('aktif', params)

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s WHERE ${where}`,
    values
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows: [], total: 0, page: 1, totalPages: 0 }

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
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / pageSize) }
}

export async function getSantriNonaktif(params: ListParams) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const offset = (page - 1) * pageSize
  const { where, values } = buildWhere('nonaktif_sementara', params)

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s WHERE ${where}`,
    values
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows: [], total: 0, page: 1, totalPages: 0 }

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
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / pageSize) }
}

export async function nonaktifkanSantri(params: {
  santriIds: string[]
  tanggalMulai: string
  tanggalRencanaAktif?: string
  alasan: string
  catatan?: string
}): Promise<{ success: boolean; count: number } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const ids = [...new Set(params.santriIds.filter(Boolean))]
  if (ids.length === 0) return { error: 'Pilih minimal satu santri' }
  if (!params.tanggalMulai) return { error: 'Tanggal mulai wajib diisi' }
  if (!params.alasan.trim()) return { error: 'Alasan wajib diisi' }

  const placeholders = ids.map(() => '?').join(',')
  const activeRows = await query<{ id: string }>(
    `SELECT id FROM santri WHERE status_global = 'aktif' AND id IN (${placeholders})`,
    ids
  )
  if (activeRows.length === 0) return { error: 'Tidak ada santri aktif yang valid untuk dinonaktifkan' }

  const activeIds = activeRows.map(r => r.id)
  const statements = [
    {
      sql: `UPDATE santri SET status_global = 'nonaktif_sementara' WHERE id IN (${activeIds.map(() => '?').join(',')})`,
      params: activeIds,
    },
    ...activeIds.map(id => ({
      sql: `UPDATE santri_nonaktif_log
            SET status = 'SELESAI',
                tanggal_aktif_aktual = COALESCE(tanggal_aktif_aktual, ?),
                closed_by = ?,
                updated_at = ?
            WHERE santri_id = ? AND status = 'AKTIF'`,
      params: [params.tanggalMulai, session.id, now(), id],
    })),
    ...activeIds.map(id => ({
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
        now(),
        now(),
      ],
    })),
  ]

  await batch(statements)
  revalidatePath('/dashboard/santri/nonaktif')
  revalidatePath('/dashboard/santri')
  return { success: true, count: activeIds.length }
}

export async function aktifkanKembaliSantri(params: {
  santriIds: string[]
  tanggalAktif: string
}): Promise<{ success: boolean; count: number } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const ids = [...new Set(params.santriIds.filter(Boolean))]
  if (ids.length === 0) return { error: 'Pilih minimal satu santri' }
  if (!params.tanggalAktif) return { error: 'Tanggal aktif kembali wajib diisi' }

  const placeholders = ids.map(() => '?').join(',')
  const rows = await query<{ id: string }>(
    `SELECT id FROM santri WHERE status_global = 'nonaktif_sementara' AND id IN (${placeholders})`,
    ids
  )
  if (rows.length === 0) return { error: 'Tidak ada santri nonaktif yang valid untuk diaktifkan' }

  const validIds = rows.map(r => r.id)
  await batch([
    {
      sql: `UPDATE santri SET status_global = 'aktif' WHERE id IN (${validIds.map(() => '?').join(',')})`,
      params: validIds,
    },
    ...validIds.map(id => ({
      sql: `UPDATE santri_nonaktif_log
            SET status = 'SELESAI',
                tanggal_aktif_aktual = ?,
                closed_by = ?,
                updated_at = ?
            WHERE santri_id = ? AND status = 'AKTIF'`,
      params: [params.tanggalAktif, session.id, now(), id],
    })),
  ])

  revalidatePath('/dashboard/santri/nonaktif')
  revalidatePath('/dashboard/santri')
  return { success: true, count: validIds.length }
}
