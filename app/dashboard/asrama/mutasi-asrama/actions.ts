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

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS kamar_config (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        asrama        TEXT NOT NULL,
        nomor_kamar   TEXT NOT NULL,
        kuota         INTEGER NOT NULL DEFAULT 10,
        reserved_baru INTEGER NOT NULL DEFAULT 0,
        blok          TEXT,
        created_at    TEXT DEFAULT (datetime('now')),
        UNIQUE(asrama, nomor_kamar)
      )
    `).run()
  } catch (e) {
    // Ignore error if already exists or other issues
  }

  try {
    const kamarConfigColumns = await query<{ name: string }>('PRAGMA table_info(kamar_config)')
    if (!kamarConfigColumns.some(col => col.name === 'blok')) {
      await execute('ALTER TABLE kamar_config ADD COLUMN blok TEXT')
    }
    if (!kamarConfigColumns.some(col => col.name === 'reserved_baru')) {
      await execute('ALTER TABLE kamar_config ADD COLUMN reserved_baru INTEGER NOT NULL DEFAULT 0')
    }
  } catch (e) {
    // Ignore schema sync issue and let downstream query surface if needed
  }
}

// ── GET: Semua santri aktif + info asrama/kamar ───────────────────────────────
export async function getSantriUntukMutasi(filter?: {
  asrama?: string | null  // null = santri tanpa asrama, undefined = semua
  search?: string
  tanpaKamar?: boolean
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

  if (filter?.tanpaKamar) {
    sql += ` AND (s.kamar IS NULL OR s.kamar = '')`
  }

  sql += ` ORDER BY s.asrama NULLS LAST, s.kamar NULLS LAST, s.nama_lengkap`

  return query<any>(sql, params)
}

// ── GET: Daftar kamar dari kamar_config untuk suatu asrama ───────────────────
export async function getKamarListByAsrama(asrama: string) {
  await ensureTableExists()
  return query<{
    nomor_kamar: string
    kuota: number
    reserved_baru: number
    blok: string | null
    terisi: number
    slot_kosong_fisik: number
    slot_efektif_lama: number
    sisa_slot_baru: number
  }>(
    `SELECT
       kc.nomor_kamar,
       kc.kuota,
       COALESCE(kc.reserved_baru, 0) AS reserved_baru,
       kc.blok,
       COUNT(s.id) AS terisi,
       MAX(0, kc.kuota - COUNT(s.id)) AS slot_kosong_fisik,
       MAX(0, kc.kuota - COALESCE(kc.reserved_baru, 0)) AS slot_efektif_lama,
       MIN(COALESCE(kc.reserved_baru, 0), MAX(0, kc.kuota - COUNT(s.id))) AS sisa_slot_baru
     FROM kamar_config kc
     LEFT JOIN santri s
       ON s.asrama = kc.asrama
      AND s.kamar = kc.nomor_kamar
      AND s.status_global = 'aktif'
     WHERE kc.asrama = ?
     GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru, kc.blok
     ORDER BY CAST(kc.nomor_kamar AS INTEGER), kc.nomor_kamar`,
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
  const tanpaKamarRow = await queryOne<{ jumlah: number }>(
    `SELECT COUNT(*) AS jumlah
     FROM santri
     WHERE status_global = 'aktif'
       AND (kamar IS NULL OR kamar = '')`
  )
  // Santri tanpa asrama
  const tanpaAsrama = counts.find(c => !c.asrama)?.jumlah ?? 0
  const perAsrama = ASRAMA_LIST.map(a => ({
    asrama: a,
    jumlah: counts.find(c => c.asrama === a)?.jumlah ?? 0,
  }))
  return { perAsrama, tanpaAsrama, tanpaKamar: tanpaKamarRow?.jumlah ?? 0 }
}

async function validateTargetKamar(params: {
  asramaBaru: string
  kamarBaru: string | null
  santriSaatIni: Array<{ asrama: string | null; kamar: string | null }>
  overrideKapasitas?: boolean
}) {
  await ensureTableExists()
  if (!params.kamarBaru) return null

  const kamar = await queryOne<{
    nomor_kamar: string
    kuota: number
    reserved_baru: number
    terisi: number
    sisa_slot_baru: number
  }>(
    `SELECT
       kc.nomor_kamar,
       kc.kuota,
       COALESCE(kc.reserved_baru, 0) AS reserved_baru,
       COUNT(s.id) AS terisi,
       MIN(COALESCE(kc.reserved_baru, 0), MAX(0, kc.kuota - COUNT(s.id))) AS sisa_slot_baru
     FROM kamar_config kc
     LEFT JOIN santri s
       ON s.asrama = kc.asrama
      AND s.kamar = kc.nomor_kamar
      AND s.status_global = 'aktif'
     WHERE kc.asrama = ? AND kc.nomor_kamar = ?
     GROUP BY kc.asrama, kc.nomor_kamar, kc.kuota, kc.reserved_baru`,
    [params.asramaBaru, params.kamarBaru]
  )
  if (!kamar) return { error: 'Kamar tujuan belum dikonfigurasi di asrama ini' }

  const currentInTarget = params.santriSaatIni.filter(
    s => s.asrama === params.asramaBaru && s.kamar === params.kamarBaru
  ).length
  const incomingTotal = params.santriSaatIni.length - currentInTarget
  const incomingBaru = params.santriSaatIni.filter(
    s => (s.kamar == null || s.kamar === '') && !(s.asrama === params.asramaBaru && s.kamar === params.kamarBaru)
  ).length
  const slotKosongFisik = Math.max(0, Number(kamar.kuota) - Number(kamar.terisi))
  const sisaSlotBaru = Math.min(Number(kamar.reserved_baru ?? 0), slotKosongFisik)

  if (incomingTotal > slotKosongFisik && !params.overrideKapasitas) {
    return {
      needsOverride: true,
      error: `Kamar ${params.kamarBaru} hanya tersisa ${slotKosongFisik} slot fisik, tetapi akan menerima ${incomingTotal} santri.`,
    }
  }

  if (incomingBaru > sisaSlotBaru && !params.overrideKapasitas) {
    return {
      needsOverride: true,
      error: `Kamar ${params.kamarBaru} hanya punya ${sisaSlotBaru} sisa slot santri baru, tetapi akan menerima ${incomingBaru} santri baru.`,
    }
  }

  return {
    nomor_kamar: kamar.nomor_kamar,
    kuota: Number(kamar.kuota),
    reserved_baru: Number(kamar.reserved_baru ?? 0),
    terisi: Number(kamar.terisi),
    slot_kosong_fisik: slotKosongFisik,
    sisa_slot_baru: sisaSlotBaru,
  }
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
  overrideKapasitas?: boolean
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

  const validasiKamar = await validateTargetKamar({
    asramaBaru: payload.asramaBaru,
    kamarBaru: payload.kamarBaru,
    santriSaatIni: [santri],
    overrideKapasitas: payload.overrideKapasitas,
  })
  if (validasiKamar && 'error' in validasiKamar) return validasiKamar

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
  overrideKapasitas?: boolean
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

  const validasiKamar = await validateTargetKamar({
    asramaBaru: payload.asramaBaru,
    kamarBaru: payload.kamarBaru,
    santriSaatIni: santriLama,
    overrideKapasitas: payload.overrideKapasitas,
  })
  if (validasiKamar && 'error' in validasiKamar) return validasiKamar

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
