'use server'

import { batch, execute, generateId, now, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { assertCrud } from '@/lib/auth/crud'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

const DEFAULT_PAGE_SIZE = 30

async function ensureKeluarTandaiSchema() {
  await execute(`
    CREATE TABLE IF NOT EXISTS santri_keluar_tandai (
      id                TEXT PRIMARY KEY,
      santri_id         TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
      asrama            TEXT NOT NULL,
      kamar             TEXT,
      tanggal_tandai    TEXT NOT NULL,
      catatan           TEXT,
      status            TEXT NOT NULL DEFAULT 'pending',
      ditandai_oleh     TEXT REFERENCES users(id),
      diproses_oleh     TEXT REFERENCES users(id),
      diproses_at       TEXT,
      keputusan_catatan TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT
    )
  `)
}

async function tetapkanKeluarInternal(params: {
  santriId: string
  tanggalKeluar: string
  alasanKeluar: string
  buatSurat: boolean
  actorId: string
}) {
  await ensureKeluarTandaiSchema()

  const santri = await queryOne<{ id: string; nama_lengkap: string; status_global: string }>(
    'SELECT id, nama_lengkap, status_global FROM santri WHERE id = ?',
    [params.santriId]
  )
  if (!santri) return { error: 'Santri tidak ditemukan' }
  if (santri.status_global !== 'aktif') return { error: 'Santri sudah tidak aktif' }

  const stamp = now()
  await batch([
    {
      sql: `UPDATE santri
            SET status_global = 'keluar',
                tanggal_keluar = ?,
                alasan_keluar  = ?
            WHERE id = ?`,
      params: [params.tanggalKeluar, params.alasanKeluar, params.santriId],
    },
    {
      sql: `UPDATE santri_keluar_tandai
            SET status = 'disetujui',
                diproses_oleh = ?,
                diproses_at = ?,
                keputusan_catatan = COALESCE(NULLIF(keputusan_catatan, ''), 'Dieksekusi dari fitur Santri Keluar'),
                updated_at = ?
            WHERE santri_id = ? AND status = 'pending'`,
      params: [params.actorId, stamp, stamp, params.santriId],
    },
  ])

  if (params.buatSurat) {
    await execute(
      `INSERT INTO riwayat_surat (id, santri_id, jenis_surat, detail_info, created_by, created_at)
       VALUES (?, ?, 'BERHENTI', ?, ?, ?)`,
      [generateId(), params.santriId, `Keluar per ${params.tanggalKeluar}. ${params.alasanKeluar}`, params.actorId, stamp]
    )
  }

  revalidatePath('/dashboard/santri/keluar')
  revalidatePath('/dashboard/santri')
  revalidatePath('/dashboard/dewan-santri/surat')
  revalidatePath('/dashboard/asrama/kamar')
  return { success: true, santriNama: santri.nama_lengkap }
}

export async function getAsramaList() {
  await ensureKeluarTandaiSchema()
  const rows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama
     FROM santri
     WHERE status_global = 'aktif' AND asrama IS NOT NULL
     ORDER BY asrama`
  )
  return rows.map((row) => row.asrama)
}

export async function getSantriAktif(params: {
  search?: string
  asrama?: string
  page?: number
  pageSize?: number
}) {
  await ensureKeluarTandaiSchema()
  const { search, asrama, page = 1, pageSize = DEFAULT_PAGE_SIZE } = params
  const offset = (page - 1) * pageSize

  const clauses = ["s.status_global = 'aktif'"]
  const baseParams: any[] = []

  if (asrama) { clauses.push('s.asrama = ?'); baseParams.push(asrama) }
  if (search) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    baseParams.push(`%${search}%`, `%${search}%`)
  }
  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s WHERE ${where}`,
    baseParams
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows: [], total: 0, page: 1, totalPages: 0 }

  const rows = await query<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    tahun_masuk: number | null
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, s.tahun_masuk
     FROM santri s
     WHERE ${where}
     ORDER BY s.asrama, s.nama_lengkap
     LIMIT ? OFFSET ?`,
    [...baseParams, pageSize, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / pageSize) }
}

export async function getSantriKeluar(params: {
  search?: string
  asrama?: string
  page?: number
  pageSize?: number
}) {
  await ensureKeluarTandaiSchema()
  const { search, asrama, page = 1, pageSize = DEFAULT_PAGE_SIZE } = params
  const offset = (page - 1) * pageSize

  const clauses = ["s.status_global = 'keluar'"]
  const baseParams: any[] = []

  if (asrama) { clauses.push('s.asrama = ?'); baseParams.push(asrama) }
  if (search) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    baseParams.push(`%${search}%`, `%${search}%`)
  }
  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s WHERE ${where}`,
    baseParams
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows: [], total: 0, page: 1, totalPages: 0 }

  const rows = await query<{
    id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    tanggal_keluar: string | null
    alasan_keluar: string | null
    tahun_masuk: number | null
    ada_surat: number
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar,
            s.tanggal_keluar, s.alasan_keluar, s.tahun_masuk,
            (
              SELECT COUNT(*)
              FROM riwayat_surat rs
              WHERE rs.santri_id = s.id AND rs.jenis_surat = 'BERHENTI'
              LIMIT 1
            ) AS ada_surat
     FROM santri s
     WHERE ${where}
     ORDER BY s.tanggal_keluar DESC, s.nama_lengkap
     LIMIT ? OFFSET ?`,
    [...baseParams, pageSize, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / pageSize) }
}

export async function getPengajuanKeluar(params: {
  search?: string
  asrama?: string
  page?: number
  pageSize?: number
}) {
  await ensureKeluarTandaiSchema()
  const { search, asrama, page = 1, pageSize = DEFAULT_PAGE_SIZE } = params
  const offset = (page - 1) * pageSize

  const clauses = ["sk.status = 'pending'"]
  const baseParams: any[] = []

  if (asrama) { clauses.push('sk.asrama = ?'); baseParams.push(asrama) }
  if (search) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    baseParams.push(`%${search}%`, `%${search}%`)
  }
  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM santri_keluar_tandai sk
     LEFT JOIN santri s ON s.id = sk.santri_id
     WHERE ${where}`,
    baseParams
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows: [], total: 0, page: 1, totalPages: 0 }

  const rows = await query<{
    id: string
    santri_id: string
    nis: string | null
    nama_lengkap: string | null
    asrama: string
    kamar: string | null
    tanggal_tandai: string
    catatan: string | null
    status_global: string | null
    penanda_nama: string | null
  }>(
    `SELECT sk.id, sk.santri_id, s.nis, s.nama_lengkap, sk.asrama, sk.kamar,
            sk.tanggal_tandai, sk.catatan, s.status_global, u.full_name AS penanda_nama
     FROM santri_keluar_tandai sk
     LEFT JOIN santri s ON s.id = sk.santri_id
     LEFT JOIN users u ON u.id = sk.ditandai_oleh
     WHERE ${where}
     ORDER BY sk.tanggal_tandai DESC, COALESCE(s.nama_lengkap, '')
     LIMIT ? OFFSET ?`,
    [...baseParams, pageSize, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / pageSize) }
}

export async function tetapkanKeluar(params: {
  santriId: string
  tanggalKeluar: string
  alasanKeluar: string
  buatSurat: boolean
}): Promise<{ success: boolean; santriNama?: string } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const result = await tetapkanKeluarInternal({
    ...params,
    actorId: session.id,
  })
  if ('error' in result) return result

  await logActivity({
    actor: actorFromSession(session),
    module: 'santri',
    action: 'update',
    fiturHref: '/dashboard/santri',
    logKind: 'update',
    entityType: 'santri',
    entityId: params.santriId,
    entityLabel: result.santriNama || params.santriId,
    summary: `Menetapkan status keluar untuk ${result.santriNama || params.santriId}`,
    details: {
      tanggal_keluar: params.tanggalKeluar,
      alasan_keluar: params.alasanKeluar,
      buat_surat: params.buatSurat,
    },
  })

  return result
}

export async function setujuiPengajuanKeluar(params: {
  pengajuanId: string
  tanggalKeluar: string
  alasanKeluar: string
  buatSurat: boolean
}): Promise<{ success: boolean; santriNama?: string } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  await ensureKeluarTandaiSchema()

  const pengajuan = await queryOne<{ id: string; santri_id: string }>(
    `SELECT id, santri_id
     FROM santri_keluar_tandai
     WHERE id = ? AND status = 'pending'`,
    [params.pengajuanId]
  )
  if (!pengajuan) return { error: 'Pengajuan tidak ditemukan atau sudah diproses' }

  const result = await tetapkanKeluarInternal({
    santriId: pengajuan.santri_id,
    tanggalKeluar: params.tanggalKeluar,
    alasanKeluar: params.alasanKeluar,
    buatSurat: params.buatSurat,
    actorId: session.id,
  })
  if ('error' in result) return result

  await execute(
    `UPDATE santri_keluar_tandai
     SET status = 'disetujui',
         diproses_oleh = ?,
         diproses_at = ?,
         keputusan_catatan = ?,
         updated_at = ?
     WHERE id = ?`,
    [session.id, now(), 'Disetujui dari tab pengajuan asrama', now(), params.pengajuanId]
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'santri',
    action: 'approval',
    fiturHref: '/dashboard/santri',
    logKind: 'update',
    entityType: 'santri',
    entityId: pengajuan.santri_id,
    entityLabel: result.santriNama || pengajuan.santri_id,
    summary: `Menyetujui pengajuan keluar untuk ${result.santriNama || pengajuan.santri_id}`,
    details: {
      pengajuan_id: params.pengajuanId,
      tanggal_keluar: params.tanggalKeluar,
      alasan_keluar: params.alasanKeluar,
      buat_surat: params.buatSurat,
    },
  })

  revalidatePath('/dashboard/santri/keluar')
  revalidatePath('/dashboard/asrama/kamar')
  return result
}

export async function tolakPengajuanKeluar(params: {
  pengajuanId: string
  keputusanCatatan?: string
}): Promise<{ success: boolean } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  await ensureKeluarTandaiSchema()

  const pengajuan = await queryOne<{ id: string; santri_id: string }>(
    `SELECT id, santri_id
     FROM santri_keluar_tandai
     WHERE id = ? AND status = 'pending'`,
    [params.pengajuanId]
  )
  if (!pengajuan) return { error: 'Pengajuan tidak ditemukan atau sudah diproses' }

  await execute(
    `UPDATE santri_keluar_tandai
     SET status = 'ditolak',
         diproses_oleh = ?,
         diproses_at = ?,
         keputusan_catatan = ?,
         updated_at = ?
     WHERE id = ?`,
    [session.id, now(), String(params.keputusanCatatan ?? '').trim() || null, now(), params.pengajuanId]
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'santri',
    action: 'approval',
    fiturHref: '/dashboard/santri',
    logKind: 'update',
    entityType: 'santri_keluar_pengajuan',
    entityId: params.pengajuanId,
    entityLabel: params.pengajuanId,
    summary: 'Menolak pengajuan keluar santri',
    details: {
      pengajuan_id: params.pengajuanId,
      santri_id: pengajuan.santri_id,
      keputusan_catatan: String(params.keputusanCatatan ?? '').trim() || null,
    },
  })

  revalidatePath('/dashboard/santri/keluar')
  revalidatePath('/dashboard/asrama/kamar')
  return { success: true }
}

export async function aktifkanKembali(
  santriId: string
): Promise<{ success: boolean } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const santri = await queryOne<{ status_global: string; nama_lengkap: string | null }>(
    'SELECT status_global, nama_lengkap FROM santri WHERE id = ?',
    [santriId]
  )
  if (!santri) return { error: 'Santri tidak ditemukan' }
  if (santri.status_global !== 'keluar') return { error: 'Santri bukan berstatus keluar' }

  await execute(
    `UPDATE santri
     SET status_global  = 'aktif',
         tanggal_keluar = NULL,
         alasan_keluar  = NULL
     WHERE id = ?`,
    [santriId]
  )

  const kelasAktif = await queryOne<{ id: string }>(
    `SELECT id
     FROM riwayat_pendidikan
     WHERE santri_id = ? AND status_riwayat = 'aktif'
     LIMIT 1`,
    [santriId]
  )

  if (!kelasAktif) {
    const kelasTerakhir = await queryOne<{ id: string }>(
      `SELECT id
       FROM riwayat_pendidikan
       WHERE santri_id = ? AND status_riwayat = 'pindah'
       ORDER BY created_at DESC
       LIMIT 1`,
      [santriId]
    )

    if (kelasTerakhir) {
      await execute(
        `UPDATE riwayat_pendidikan
         SET status_riwayat = 'aktif'
         WHERE id = ?`,
        [kelasTerakhir.id]
      )
    }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'santri',
    action: 'update',
    fiturHref: '/dashboard/santri',
    logKind: 'update',
    entityType: 'santri',
    entityId: santriId,
    entityLabel: santri.nama_lengkap || santriId,
    summary: `Mengaktifkan kembali santri keluar ${santri.nama_lengkap || santriId}`,
    details: {
      from_status: 'keluar',
      to_status: 'aktif',
    },
  })

  revalidatePath('/dashboard/santri/keluar')
  revalidatePath('/dashboard/santri')
  return { success: true }
}

export async function getDataSuratBerhenti(santriId: string) {
  return queryOne<{
    id: string
    nama_lengkap: string
    nis: string
    tempat_lahir: string | null
    tanggal_lahir: string | null
    asrama: string | null
    kamar: string | null
    nama_ayah: string | null
    alamat: string | null
    tanggal_keluar: string | null
    alasan_keluar: string | null
    tahun_masuk: number | null
  }>(
    `SELECT id, nama_lengkap, nis, tempat_lahir, tanggal_lahir,
            asrama, kamar, nama_ayah, alamat,
            tanggal_keluar, alasan_keluar, tahun_masuk
     FROM santri WHERE id = ?`,
    [santriId]
  )
}

export async function catatSuratBerhenti(
  santriId: string,
  keterangan: string
): Promise<{ success: boolean } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'create')
  if ('error' in access) return access
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const existing = await queryOne<{ id: string }>(
    `SELECT id
     FROM riwayat_surat
     WHERE santri_id = ? AND jenis_surat = 'BERHENTI'
     LIMIT 1`,
    [santriId]
  )
  if (existing) return { success: true }

  await execute(
    `INSERT INTO riwayat_surat (id, santri_id, jenis_surat, detail_info, created_by, created_at)
     VALUES (?, ?, 'BERHENTI', ?, ?, ?)`,
    [generateId(), santriId, keterangan, session.id, now()]
  )
  const santri = await queryOne<{ nama_lengkap: string | null }>(
    'SELECT nama_lengkap FROM santri WHERE id = ?',
    [santriId]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'santri',
    action: 'create',
    fiturHref: '/dashboard/santri',
    logKind: 'create',
    entityType: 'riwayat_surat',
    entityId: santriId,
    entityLabel: santri?.nama_lengkap || santriId,
    summary: `Mencatat surat berhenti untuk ${santri?.nama_lengkap || santriId}`,
    details: {
      jenis_surat: 'BERHENTI',
      keterangan,
    },
  })
  revalidatePath('/dashboard/dewan-santri/surat')
  return { success: true }
}
