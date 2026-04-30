'use server'

import { query, queryOne, execute, getDB } from '@/lib/db'
import { assertFeature } from '@/lib/auth/feature'
import { revalidatePath } from 'next/cache'

const REVALIDATE = '/dashboard/asrama/mutasi-asrama'
const ASRAMA_LIST = ['AL-FALAH', 'AS-SALAM', 'BAHAGIA', 'ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4', 'AL-BAGHORY']

async function ensureTableExists() {
  const db = await getDB()
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS mutasi_asrama_log (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        santri_id      TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
        asrama_lama    TEXT,
        kamar_lama     TEXT,
        asrama_baru    TEXT NOT NULL,
        kamar_baru     TEXT,
        alasan         TEXT,
        dilakukan_oleh TEXT REFERENCES users(id),
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run()
  } catch (e) {
    // Ignore error if already exists or other issues
  }
}

// ── GET: Semua santri aktif + info asrama/kamar ───────────────────────────────
export async function getSantriUntukMutasi(filter?: {
  asrama?: string | null  // null = santri tanpa asrama, undefined = semua
  search?: string
}) {
  await ensureTableExists()
  let sql = `
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin,
           s.asrama, s.kamar, s.kelas_sekolah, s.sekolah,
           m.nama AS marhalah_nama, k.nama_kelas
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE s.status_global = 'aktif'
  `
  const params: unknown[] = []

  if (filter?.asrama === null) {
    sql += ` AND (s.asrama IS NULL OR s.asrama = '')`
  } else if (filter?.asrama) {
    sql += ` AND s.asrama = ?`
    params.push(filter.asrama)
  }

  if (filter?.search?.trim()) {
    sql += ` AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)`
    const term = `%${filter.search.trim()}%`
    params.push(term, term)
  }

  sql += ` ORDER BY s.asrama NULLS LAST, s.kamar NULLS LAST, s.nama_lengkap`

  return query<any>(sql, params)
}

// ── GET: Daftar kamar dari kamar_config untuk suatu asrama ───────────────────
export async function getKamarListByAsrama(asrama: string) {
  return query<{ nomor_kamar: string; kuota: number; blok: string | null }>(
    `SELECT nomor_kamar, kuota, blok FROM kamar_config WHERE asrama = ? ORDER BY CAST(nomor_kamar AS INTEGER), nomor_kamar`,
    [asrama]
  )
}

// ── GET: Ringkasan jumlah santri per asrama (untuk info di UI) ────────────────
export async function getRingkasanAsrama() {
  const counts = await query<{ asrama: string | null; jumlah: number }>(
    `SELECT asrama, COUNT(*) AS jumlah
     FROM santri
     WHERE status_global = 'aktif'
     GROUP BY asrama`
  )
  // Santri tanpa asrama
  const tanpaAsrama = counts.find(c => !c.asrama)?.jumlah ?? 0
  const perAsrama = ASRAMA_LIST.map(a => ({
    asrama: a,
    jumlah: counts.find(c => c.asrama === a)?.jumlah ?? 0,
  }))
  return { perAsrama, tanpaAsrama }
}

// ── GET: Log riwayat mutasi terbaru ──────────────────────────────────────────
export async function getLogMutasi(limit = 100) {
  await ensureTableExists()
  return query<any>(`
    SELECT mal.*, s.nama_lengkap, s.nis, u.full_name AS nama_operator
    FROM mutasi_asrama_log mal
    JOIN santri s ON s.id = mal.santri_id
    LEFT JOIN users u ON u.id = mal.dilakukan_oleh
    ORDER BY mal.created_at DESC
    LIMIT ?
  `, [limit])
}

// ── ACTION: Mutasi satu santri ────────────────────────────────────────────────
export async function mutasiSantri(payload: {
  santriId: string
  asramaBaru: string
  kamarBaru: string | null
  alasan?: string
}) {
  const access = await assertFeature('/dashboard/asrama/mutasi-asrama')
  if ('error' in access) return access
  const session = access

  await ensureTableExists()

  // Pengurus asrama hanya bisa memindahkan KE asrama binaannya
  if (session.role === 'pengurus_asrama' && session.asrama_binaan) {
    if (payload.asramaBaru !== session.asrama_binaan) {
      return { error: 'Anda hanya bisa memindahkan santri ke asrama binaan Anda' }
    }
  }

  // Ambil data lama
  const santri = await queryOne<{ asrama: string | null; kamar: string | null }>(
    `SELECT asrama, kamar FROM santri WHERE id = ?`,
    [payload.santriId]
  )
  if (!santri) return { error: 'Santri tidak ditemukan' }

  const db = await getDB()
  try {
    await db.batch([
      // Update data santri
      db.prepare(`UPDATE santri SET asrama = ?, kamar = ? WHERE id = ?`)
        .bind(payload.asramaBaru, payload.kamarBaru ?? null, payload.santriId),
      // Catat log
      db.prepare(`
        INSERT INTO mutasi_asrama_log (santri_id, asrama_lama, kamar_lama, asrama_baru, kamar_baru, alasan, dilakukan_oleh)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        payload.santriId,
        santri.asrama ?? null,
        santri.kamar ?? null,
        payload.asramaBaru,
        payload.kamarBaru ?? null,
        payload.alasan ?? null,
        session.id ?? null
      ),
    ])
    revalidatePath(REVALIDATE)
    return { success: true }
  } catch (e: any) {
    console.error('[mutasiSantri] Error:', e)
    return { error: e.message || 'Terjadi kesalahan pada server' }
  }
}

// ── ACTION: Mutasi batch (banyak santri sekaligus) ────────────────────────────
export async function mutasiBatch(payload: {
  santriIds: string[]
  asramaBaru: string
  kamarBaru: string | null
  alasan?: string
}) {
  const access = await assertFeature('/dashboard/asrama/mutasi-asrama')
  if ('error' in access) return access
  const session = access

  await ensureTableExists()

  if (session.role === 'pengurus_asrama' && session.asrama_binaan) {
    if (payload.asramaBaru !== session.asrama_binaan) {
      return { error: 'Anda hanya bisa memindahkan santri ke asrama binaan Anda' }
    }
  }

  if (!payload.santriIds.length) return { error: 'Tidak ada santri dipilih' }

  // Ambil data lama semua santri sekaligus (Chunked to avoid SQL variable limit)
  const santriLama: { id: string; asrama: string | null; kamar: string | null }[] = []
  const chunkSize = 100
  for (let i = 0; i < payload.santriIds.length; i += chunkSize) {
    const chunk = payload.santriIds.slice(i, i + chunkSize)
    const placeholders = chunk.map(() => '?').join(',')
    const results = await query<{ id: string; asrama: string | null; kamar: string | null }>(
      `SELECT id, asrama, kamar FROM santri WHERE id IN (${placeholders})`,
      chunk
    )
    santriLama.push(...results)
  }

  const db = await getDB()
  try {
    const updateStmts = payload.santriIds.map(id =>
      db.prepare(`UPDATE santri SET asrama = ?, kamar = ? WHERE id = ?`)
        .bind(payload.asramaBaru, payload.kamarBaru ?? null, id)
    )
    const logStmts = santriLama.map(s =>
      db.prepare(`
        INSERT INTO mutasi_asrama_log (santri_id, asrama_lama, kamar_lama, asrama_baru, kamar_baru, alasan, dilakukan_oleh)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        s.id,
        s.asrama ?? null,
        s.kamar ?? null,
        payload.asramaBaru,
        payload.kamarBaru ?? null,
        payload.alasan ?? null,
        session.id
      )
    )

    // Batch max 100 per round
    const allStmts = [...updateStmts, ...logStmts]
    for (let i = 0; i < allStmts.length; i += 100) {
      await db.batch(allStmts.slice(i, i + 100))
    }

    revalidatePath(REVALIDATE)
    return { success: true, count: payload.santriIds.length }
  } catch (e: any) {
    console.error('[mutasiBatch] Error:', e)
    return { error: e.message || 'Terjadi kesalahan pada server' }
  }
}
