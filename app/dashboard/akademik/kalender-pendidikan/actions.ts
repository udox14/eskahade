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

function enumerateDates(start: string, end: string): string[] {
  const out: string[] = []
  const cur = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (cur <= last) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    )
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

// Set libur/lainnya (atau efektif jika sesiList kosong) untuk rentang tanggal [mulai..selesai].
export async function simpanRentang(input: {
  tanggalMulai: string
  tanggalSelesai?: string
  sesiList: string[]
  jenis: string
  keterangan: string
}): Promise<{ success: true; jumlahTanggal: number } | { error: string }> {
  const guard = await assertFeature(FITUR_HREF, 'update')
  if ('error' in guard) return { error: guard.error }
  await ensureKalenderSchema()

  let mulai = String(input.tanggalMulai || '').trim()
  let selesai = String(input.tanggalSelesai || '').trim() || mulai
  if (!isValidDate(mulai)) return { error: 'Tanggal mulai tidak valid.' }
  if (!isValidDate(selesai)) return { error: 'Tanggal selesai tidak valid.' }
  if (mulai > selesai) [mulai, selesai] = [selesai, mulai]

  const jenis = (input.jenis || 'libur') as JenisType
  if (!VALID_JENIS.includes(jenis)) return { error: 'Jenis tidak valid.' }

  const sesiList = (input.sesiList || []).filter((s): s is SessionType =>
    (VALID_SESI as readonly string[]).includes(s)
  )
  const keterangan = String(input.keterangan || '').trim() || null
  const actor = guard.id

  const dates = enumerateDates(mulai, selesai)
  if (dates.length === 0) return { error: 'Rentang tanggal kosong.' }
  if (dates.length > 400) return { error: 'Rentang terlalu panjang (maksimal 400 hari).' }

  const statements = dates.flatMap((tanggal) =>
    VALID_SESI.map((sesi) => {
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
      return {
        sql: `DELETE FROM pengajian_libur_sesi WHERE tanggal = ? AND sesi = ?`,
        params: [tanggal, sesi],
      }
    })
  )

  // Chunk agar tidak melebihi batas batch D1.
  const CHUNK = 90
  for (let i = 0; i < statements.length; i += CHUNK) {
    await batch(statements.slice(i, i + CHUNK))
  }

  const jenisLabel = jenis === 'libur' ? 'Libur' : 'Lainnya'
  const cakupan = sesiList.length === 0
    ? 'Efektif (semua sesi)'
    : sesiList.length === VALID_SESI.length
      ? 'Full hari'
      : sesiList.join(', ')
  const rangeLabel = mulai === selesai ? mulai : `${mulai} s/d ${selesai}`
  await logActivity({
    actor: actorFromSession(guard),
    module: 'akademik_kalender_pendidikan',
    action: 'update',
    fiturHref: FITUR_HREF,
    logKind: 'update',
    entityType: 'kalender_pendidikan',
    entityId: mulai,
    entityLabel: rangeLabel,
    summary: `Kalender pendidikan ${rangeLabel}: ${sesiList.length === 0 ? 'Efektif' : jenisLabel} — ${cakupan}${keterangan ? ` (${keterangan})` : ''}`,
  })

  revalidatePath(FITUR_HREF)
  return { success: true, jumlahTanggal: dates.length }
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
