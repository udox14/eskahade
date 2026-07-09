'use server'

import { query, execute, batch } from '@/lib/db'
import { assertFeature } from '@/lib/auth/feature'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

const FITUR_HREF = '/dashboard/akademik/kalender-pendidikan'
const VALID_SESI = ['shubuh', 'ashar', 'maghrib'] as const
type SessionType = typeof VALID_SESI[number]
const VALID_JENIS = ['libur', 'lainnya'] as const
type JenisType = typeof VALID_JENIS[number]

export type KalenderRow = {
  tanggal: string
  sesi: SessionType
  jenis: JenisType
  keterangan: string | null
}

async function ensureKalenderSchema() {
  await execute(`
    CREATE TABLE IF NOT EXISTS pengajian_libur_sesi (
      tanggal    TEXT NOT NULL,
      sesi       TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (tanggal, sesi)
    )
  `)
  // Kolom baru bisa saja belum ada di DB lama — tambahkan defensif.
  try {
    await execute(`ALTER TABLE pengajian_libur_sesi ADD COLUMN jenis TEXT NOT NULL DEFAULT 'libur'`)
  } catch {
    // kolom sudah ada
  }
  try {
    await execute(`ALTER TABLE pengajian_libur_sesi ADD COLUMN keterangan TEXT`)
  } catch {
    // kolom sudah ada
  }
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

function monthRange(tahun: number, bulan: number) {
  // bulan: 1..12
  const start = `${tahun}-${String(bulan).padStart(2, '0')}-01`
  const lastDay = new Date(tahun, bulan, 0).getDate() // hari terakhir bulan
  const end = `${tahun}-${String(bulan).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export async function getKalenderBulan(tahun: number, bulan: number): Promise<KalenderRow[]> {
  const guard = await assertFeature(FITUR_HREF, 'read')
  if ('error' in guard) return []
  await ensureKalenderSchema()

  if (!Number.isInteger(tahun) || bulan < 1 || bulan > 12) return []
  const { start, end } = monthRange(tahun, bulan)

  return query<KalenderRow>(
    `SELECT tanggal, sesi, jenis, keterangan
     FROM pengajian_libur_sesi
     WHERE tanggal >= ? AND tanggal <= ?
     ORDER BY tanggal, sesi`,
    [start, end]
  )
}

export async function simpanTanggal(input: {
  tanggal: string
  sesiList: string[]
  jenis: string
  keterangan: string
}): Promise<{ success: true } | { error: string }> {
  const guard = await assertFeature(FITUR_HREF, 'update')
  if ('error' in guard) return { error: guard.error }
  await ensureKalenderSchema()

  const tanggal = String(input.tanggal || '').trim()
  if (!isValidDate(tanggal)) return { error: 'Tanggal tidak valid.' }

  const jenis = (input.jenis || 'libur') as JenisType
  if (!VALID_JENIS.includes(jenis)) return { error: 'Jenis tidak valid.' }

  const sesiList = (input.sesiList || []).filter((s): s is SessionType =>
    (VALID_SESI as readonly string[]).includes(s)
  )
  const keterangan = String(input.keterangan || '').trim() || null
  const actor = guard.id

  const statements = VALID_SESI.map((sesi) => {
    if (sesiList.includes(sesi)) {
      return {
        sql: `
          INSERT INTO pengajian_libur_sesi (tanggal, sesi, jenis, keterangan, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(tanggal, sesi) DO UPDATE SET
            jenis = excluded.jenis,
            keterangan = excluded.keterangan,
            updated_at = datetime('now')
        `,
        params: [tanggal, sesi, jenis, keterangan, actor],
      }
    }
    // Sesi tak dipilih → jadikan efektif (hapus baris jika ada).
    return {
      sql: `DELETE FROM pengajian_libur_sesi WHERE tanggal = ? AND sesi = ?`,
      params: [tanggal, sesi],
    }
  })

  await batch(statements)

  const jenisLabel = jenis === 'libur' ? 'Libur' : 'Lainnya'
  const cakupan = sesiList.length === 0
    ? 'Efektif (semua sesi)'
    : sesiList.length === VALID_SESI.length
      ? 'Full hari'
      : sesiList.join(', ')
  await logActivity({
    actor: actorFromSession(guard),
    module: 'akademik_kalender_pendidikan',
    action: 'update',
    fiturHref: FITUR_HREF,
    logKind: 'update',
    entityType: 'kalender_pendidikan',
    entityId: tanggal,
    entityLabel: tanggal,
    summary: `Kalender pendidikan ${tanggal}: ${jenisLabel} — ${cakupan}${keterangan ? ` (${keterangan})` : ''}`,
  })

  revalidatePath(FITUR_HREF)
  return { success: true }
}

export async function hapusTanggal(tanggalInput: string): Promise<{ success: true } | { error: string }> {
  const guard = await assertFeature(FITUR_HREF, 'delete')
  if ('error' in guard) return { error: guard.error }
  await ensureKalenderSchema()

  const tanggal = String(tanggalInput || '').trim()
  if (!isValidDate(tanggal)) return { error: 'Tanggal tidak valid.' }

  await execute(`DELETE FROM pengajian_libur_sesi WHERE tanggal = ?`, [tanggal])

  await logActivity({
    actor: actorFromSession(guard),
    module: 'akademik_kalender_pendidikan',
    action: 'delete',
    fiturHref: FITUR_HREF,
    logKind: 'delete',
    entityType: 'kalender_pendidikan',
    entityId: tanggal,
    entityLabel: tanggal,
    summary: `Reset kalender pendidikan ${tanggal} menjadi efektif`,
  })

  revalidatePath(FITUR_HREF)
  return { success: true }
}
