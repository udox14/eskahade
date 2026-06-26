'use server'

import { batch, execute, generateId, now, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { assertCrud } from '@/lib/auth/crud'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { getGrupArsip, restoreSantri } from '../arsip/actions'
import { aktifkanKembaliSantri } from '../nonaktif/actions'

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
  payload: PayloadKeluar
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

  const santri = await queryOne<{ nama_lengkap: string | null }>(
    'SELECT nama_lengkap FROM santri WHERE id = ?',
    [pengajuan.santri_id]
  )

  // tetapkanKeluarBulk juga menandai pengajuan pending → disetujui.
  const result = await tetapkanKeluarBulk({ santriIds: [pengajuan.santri_id], payload: params.payload })
  if ('error' in result) return result
  if (result.berhasil === 0) {
    return { error: result.errors[0] || 'Gagal memproses pengajuan' }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'santri',
    action: 'approval',
    fiturHref: '/dashboard/santri',
    logKind: 'update',
    entityType: 'santri',
    entityId: pengajuan.santri_id,
    entityLabel: santri?.nama_lengkap || pengajuan.santri_id,
    summary: `Menyetujui pengajuan keluar untuk ${santri?.nama_lengkap || pengajuan.santri_id} (jenis: ${params.payload.jenis})`,
    details: { pengajuan_id: params.pengajuanId, jenis: params.payload.jenis },
  })

  revalidatePath('/dashboard/santri/keluar')
  revalidatePath('/dashboard/asrama/kamar')
  return { success: true, santriNama: santri?.nama_lengkap || undefined }
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

// ════════════════════════════════════════════════════════════════════════════
// FITUR TERPADU "SANTRI KELUAR" — 3 jenis: alumni | berhenti | nonaktif
// ════════════════════════════════════════════════════════════════════════════

export type JenisKeluar = 'alumni' | 'berhenti' | 'nonaktif'

const STATUS_BY_JENIS: Record<JenisKeluar, string> = {
  alumni: 'arsip',
  berhenti: 'keluar',
  nonaktif: 'nonaktif_sementara',
}

function jenisFromStatus(status: string | null): JenisKeluar | null {
  if (status === 'arsip') return 'alumni'
  if (status === 'keluar') return 'berhenti'
  if (status === 'nonaktif_sementara') return 'nonaktif'
  return null
}

type ProfilRow = Record<string, any>

function getAngkatanFromProfil(profil: ProfilRow): number | null {
  const fromNis = profil.nis ? parseInt(String(profil.nis).substring(0, 4), 10) : NaN
  if (!Number.isNaN(fromNis)) return fromNis
  const fromTahun = Number(profil.tahun_masuk)
  return Number.isFinite(fromTahun) ? fromTahun : null
}

function buildAlumniSnapshot(profil: ProfilRow) {
  return JSON.stringify({
    schema_version: 3,
    mode: 'soft_archive',
    archived_at: now(),
    profil,
    note: 'Data historis tetap tersimpan di tabel asal. Snapshot menyimpan profil saat santri dijadikan alumni.',
  })
}

// Payload penetapan/perubahan jenis keluar (discriminated by `jenis`)
export type PayloadKeluar =
  | { jenis: 'berhenti'; tanggalKeluar: string; alasanKeluar: string; buatSurat: boolean }
  | { jenis: 'nonaktif'; tanggalMulai: string; tanggalRencanaAktif?: string; alasan: string; catatan?: string }
  | {
      jenis: 'alumni'
      grup:
        | { mode: 'new'; catatan: string; tanggalArsip?: string }
        | { mode: 'existing'; angkatan: number | null; catatan: string | null; tanggal_arsip: string }
    }

type Stmt = { sql: string; params: any[] }

function validatePayload(payload: PayloadKeluar): string | null {
  if (payload.jenis === 'berhenti') {
    if (!payload.tanggalKeluar) return 'Tanggal keluar wajib diisi'
  } else if (payload.jenis === 'nonaktif') {
    if (!payload.tanggalMulai) return 'Tanggal mulai nonaktif wajib diisi'
    if (!payload.alasan?.trim()) return 'Alasan nonaktif wajib diisi'
  } else if (payload.jenis === 'alumni') {
    if (payload.grup.mode === 'new' && !payload.grup.catatan?.trim()) {
      return 'Nama/keterangan grup angkatan wajib diisi'
    }
  }
  return null
}

// Statement-statement untuk MASUK ke sebuah jenis (santri & baris pendukung).
// Mengasumsikan state lama sudah dibersihkan (lihat cleanupStatements).
function enterStatements(
  profil: ProfilRow,
  payload: PayloadKeluar,
  session: { id: string },
  stamp: string
): Stmt[] {
  const santriId = profil.id
  const stmts: Stmt[] = []

  if (payload.jenis === 'berhenti') {
    stmts.push({
      sql: `UPDATE santri SET status_global = 'keluar', tanggal_keluar = ?, alasan_keluar = ?, updated_at = ? WHERE id = ?`,
      params: [payload.tanggalKeluar, payload.alasanKeluar?.trim() || null, stamp, santriId],
    })
    if (payload.buatSurat) {
      stmts.push({
        sql: `INSERT INTO riwayat_surat (id, santri_id, jenis_surat, detail_info, created_by, created_at)
              VALUES (?, ?, 'BERHENTI', ?, ?, ?)`,
        params: [generateId(), santriId, `Keluar per ${payload.tanggalKeluar}. ${payload.alasanKeluar ?? ''}`.trim(), session.id, stamp],
      })
    }
  } else if (payload.jenis === 'nonaktif') {
    stmts.push({
      sql: `UPDATE santri SET status_global = 'nonaktif_sementara', updated_at = ? WHERE id = ?`,
      params: [stamp, santriId],
    })
    // Defensif: tutup log AKTIF yang mungkin masih tersisa.
    stmts.push({
      sql: `UPDATE santri_nonaktif_log
            SET status = 'SELESAI', tanggal_aktif_aktual = COALESCE(tanggal_aktif_aktual, ?), closed_by = ?, updated_at = ?
            WHERE santri_id = ? AND status = 'AKTIF'`,
      params: [stamp, session.id, stamp, santriId],
    })
    stmts.push({
      sql: `INSERT INTO santri_nonaktif_log
            (id, santri_id, tanggal_mulai, tanggal_rencana_aktif, alasan, catatan, status, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'AKTIF', ?, ?, ?)`,
      params: [
        generateId(), santriId, payload.tanggalMulai, payload.tanggalRencanaAktif || null,
        payload.alasan.trim(), payload.catatan?.trim() || null, session.id, stamp, stamp,
      ],
    })
  } else {
    // alumni → arsip (soft archive)
    const angkatan = payload.grup.mode === 'existing' ? payload.grup.angkatan : getAngkatanFromProfil(profil)
    const catatan = payload.grup.mode === 'existing' ? payload.grup.catatan : payload.grup.catatan.trim()
    const tanggalArsip = payload.grup.mode === 'existing'
      ? `${payload.grup.tanggal_arsip} 00:00:00`
      : (payload.grup.tanggalArsip ? `${payload.grup.tanggalArsip} 00:00:00` : now())
    // Bersihkan baris arsip lama (idempoten) sebelum insert.
    stmts.push({ sql: `DELETE FROM santri_arsip WHERE santri_id_asli = ?`, params: [santriId] })
    stmts.push({
      sql: `INSERT INTO santri_arsip (id, santri_id_asli, nis, nama_lengkap, angkatan, asrama, catatan, snapshot, tanggal_arsip)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [generateId(), santriId, profil.nis, profil.nama_lengkap, angkatan, profil.asrama, catatan || null, buildAlumniSnapshot(profil), tanggalArsip],
    })
    stmts.push({
      sql: `UPDATE santri SET status_global = 'arsip', updated_at = ? WHERE id = ?`,
      params: [stamp, santriId],
    })
  }

  return stmts
}

// Statement untuk membersihkan state status LAMA (saat pindah jenis / aktifkan).
function cleanupStatements(santriId: string, oldStatus: string | null, session: { id: string }, stamp: string): Stmt[] {
  const stmts: Stmt[] = []
  if (oldStatus === 'keluar') {
    stmts.push({
      sql: `UPDATE santri SET tanggal_keluar = NULL, alasan_keluar = NULL WHERE id = ?`,
      params: [santriId],
    })
  } else if (oldStatus === 'nonaktif_sementara') {
    stmts.push({
      sql: `UPDATE santri_nonaktif_log
            SET status = 'SELESAI', tanggal_aktif_aktual = COALESCE(tanggal_aktif_aktual, ?), closed_by = ?, updated_at = ?
            WHERE santri_id = ? AND status = 'AKTIF'`,
      params: [stamp, session.id, stamp, santriId],
    })
  } else if (oldStatus === 'arsip') {
    stmts.push({ sql: `DELETE FROM santri_arsip WHERE santri_id_asli = ?`, params: [santriId] })
  }
  return stmts
}

/** Tetapkan banyak santri AKTIF jadi keluar (jenis bebas). */
export async function tetapkanKeluarBulk(params: {
  santriIds: string[]
  payload: PayloadKeluar
}): Promise<{ success: boolean; berhasil: number; gagal: number; errors: string[] } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  await ensureKeluarTandaiSchema()

  const vErr = validatePayload(params.payload)
  if (vErr) return { error: vErr }

  const ids = Array.from(new Set((params.santriIds ?? []).filter(Boolean)))
  if (ids.length === 0) return { error: 'Pilih minimal 1 santri' }

  const profiles = await query<ProfilRow>(`SELECT * FROM santri WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
  const profileMap = new Map(profiles.map(p => [p.id, p]))

  const stamp = now()
  const statements: Stmt[] = []
  const processedIds: string[] = []
  let gagal = 0
  const errors: string[] = []

  for (const santriId of ids) {
    const profil = profileMap.get(santriId)
    if (!profil) { gagal++; errors.push(`ID ${santriId}: data tidak ditemukan`); continue }
    if (profil.status_global !== 'aktif') {
      gagal++; errors.push(`${profil.nama_lengkap ?? santriId}: status saat ini ${profil.status_global}, bukan aktif`); continue
    }
    statements.push(...enterStatements(profil, params.payload, session, stamp))
    processedIds.push(santriId)
  }

  if (processedIds.length > 0) {
    // Tandai pengajuan asrama (jika ada) sebagai disetujui.
    statements.push({
      sql: `UPDATE santri_keluar_tandai
            SET status = 'disetujui', diproses_oleh = ?, diproses_at = ?,
                keputusan_catatan = COALESCE(NULLIF(keputusan_catatan, ''), 'Dieksekusi dari fitur Santri Keluar'), updated_at = ?
            WHERE status = 'pending' AND santri_id IN (${processedIds.map(() => '?').join(',')})`,
      params: [session.id, stamp, stamp, ...processedIds],
    })
    await batch(statements)
    await logActivity({
      actor: actorFromSession(session),
      module: 'santri', action: 'update', fiturHref: '/dashboard/santri/keluar', logKind: 'update',
      entityType: 'santri_keluar_batch', entityId: 'tetapkan', entityLabel: `Tetapkan keluar (${params.payload.jenis})`,
      summary: `Menetapkan ${processedIds.length} santri keluar (jenis: ${params.payload.jenis})`,
      details: { jenis: params.payload.jenis, berhasil: processedIds.length, gagal },
    })
  }

  revalidatePath('/dashboard/santri/keluar')
  revalidatePath('/dashboard/santri')
  return { success: true, berhasil: processedIds.length, gagal, errors }
}

/** Ubah jenis / edit data santri yang sudah keluar (memaafkan kesalahan). */
export async function ubahDataKeluar(params: {
  santriId: string
  payload: PayloadKeluar
}): Promise<{ success: boolean } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }
  await ensureKeluarTandaiSchema()

  const vErr = validatePayload(params.payload)
  if (vErr) return { error: vErr }

  const profil = await queryOne<ProfilRow>('SELECT * FROM santri WHERE id = ?', [params.santriId])
  if (!profil) return { error: 'Santri tidak ditemukan' }
  const oldStatus = profil.status_global as string
  if (!jenisFromStatus(oldStatus)) {
    return { error: `Santri berstatus ${oldStatus}, bukan santri keluar` }
  }

  const stamp = now()
  const statements: Stmt[] = [
    ...cleanupStatements(params.santriId, oldStatus, session, stamp),
    ...enterStatements(profil, params.payload, session, stamp),
  ]
  await batch(statements)

  await logActivity({
    actor: actorFromSession(session),
    module: 'santri', action: 'update', fiturHref: '/dashboard/santri/keluar', logKind: 'update',
    entityType: 'santri', entityId: params.santriId, entityLabel: profil.nama_lengkap || params.santriId,
    summary: `Mengubah data keluar ${profil.nama_lengkap || params.santriId} → ${params.payload.jenis}`,
    details: { dari_status: oldStatus, ke_jenis: params.payload.jenis },
  })

  revalidatePath('/dashboard/santri/keluar')
  revalidatePath('/dashboard/santri')
  return { success: true }
}

/** Aktifkan kembali santri keluar (jenis apa pun) menjadi aktif. */
export async function aktifkanKembaliKeluar(santriId: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'update')
  if ('error' in access) return access
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const santri = await queryOne<{ status_global: string; nama_lengkap: string | null }>(
    'SELECT status_global, nama_lengkap FROM santri WHERE id = ?',
    [santriId]
  )
  if (!santri) return { error: 'Santri tidak ditemukan' }

  if (santri.status_global === 'keluar') {
    return aktifkanKembali(santriId)
  }
  if (santri.status_global === 'nonaktif_sementara') {
    const res = await aktifkanKembaliSantri({ santriIds: [santriId], tanggalAktif: now().slice(0, 10) })
    if ('error' in res) return res
    return { success: true }
  }
  if (santri.status_global === 'arsip') {
    const arsip = await queryOne<{ id: string }>('SELECT id FROM santri_arsip WHERE santri_id_asli = ? LIMIT 1', [santriId])
    if (!arsip) {
      // Tidak ada baris arsip → cukup balikkan status.
      await execute(`UPDATE santri SET status_global = 'aktif', updated_at = ? WHERE id = ?`, [now(), santriId])
      return { success: true }
    }
    const res = await restoreSantri([arsip.id])
    if ('error' in res) return res
    return { success: true }
  }
  return { error: 'Santri bukan berstatus keluar' }
}

/** Daftar gabungan semua santri keluar (alumni + berhenti + nonaktif). */
export async function getDaftarKeluar(params: {
  jenis?: JenisKeluar | 'semua'
  search?: string
  asrama?: string
  page?: number
  pageSize?: number
}) {
  const { search, asrama, jenis = 'semua', page = 1, pageSize = DEFAULT_PAGE_SIZE } = params
  const offset = (page - 1) * pageSize

  const statuses = jenis === 'semua'
    ? ['keluar', 'nonaktif_sementara', 'arsip']
    : [STATUS_BY_JENIS[jenis]]

  const clauses = [`s.status_global IN (${statuses.map(() => '?').join(',')})`]
  const baseParams: any[] = [...statuses]
  if (asrama) { clauses.push('s.asrama = ?'); baseParams.push(asrama) }
  if (search) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    baseParams.push(`%${search}%`, `%${search}%`)
  }
  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s WHERE ${where}`, baseParams
  )
  const total = countRow?.total ?? 0
  if (total === 0) return { rows: [], total: 0, page: 1, totalPages: 0 }

  const rows = await query<any>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, s.tahun_masuk, s.status_global,
            s.tanggal_keluar, s.alasan_keluar,
            l.tanggal_mulai, l.tanggal_rencana_aktif, l.alasan AS alasan_nonaktif, l.catatan AS catatan_nonaktif,
            a.id AS arsip_id, a.catatan AS grup_alumni, a.angkatan, a.tanggal_arsip,
            (SELECT COUNT(*) FROM riwayat_surat rs WHERE rs.santri_id = s.id AND rs.jenis_surat = 'BERHENTI') AS ada_surat
     FROM santri s
     LEFT JOIN santri_nonaktif_log l ON l.santri_id = s.id AND l.status = 'AKTIF'
     LEFT JOIN santri_arsip a ON a.santri_id_asli = s.id
     WHERE ${where}
     ORDER BY COALESCE(s.tanggal_keluar, l.tanggal_mulai, a.tanggal_arsip, s.created_at) DESC, s.nama_lengkap
     LIMIT ? OFFSET ?`,
    [...baseParams, pageSize, offset]
  )

  const mapped = rows.map(r => ({ ...r, jenis: jenisFromStatus(r.status_global) }))
  return { rows: mapped, total, page, totalPages: Math.ceil(total / pageSize) }
}

/** Daftar asrama dari seluruh santri keluar (untuk filter tab Daftar). */
export async function getAsramaSemuaKeluar() {
  const rows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama FROM santri
     WHERE status_global IN ('keluar', 'nonaktif_sementara', 'arsip') AND asrama IS NOT NULL AND TRIM(asrama) <> ''
     ORDER BY asrama`
  )
  return rows.map(r => r.asrama)
}

/** Grup angkatan alumni (untuk dropdown pilih grup saat menetapkan/ubah alumni). */
export async function getGrupAlumni() {
  return getGrupArsip()
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
