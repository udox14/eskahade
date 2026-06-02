'use server'

import { execute, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

const FEATURE_PATH = '/dashboard/ehb/absensi-menghafal'
const REKAP_PATH = '/dashboard/ehb/absensi-menghafal/rekap'
const TANPA_BLOK_KEY = '__TANPA_BLOK__'
const VALID_STATUSES = ['H', 'A', 'I', 'S']

export type SesiMenghafal = {
  tanggal: string
  sesi_id: number
  nomor_sesi: number
  label: string
  jam_group: string
  waktu_mulai: string | null
  waktu_selesai: string | null
}

export type BlokMenghafal = {
  blok_key: string
  blok_label: string
  jumlah_kamar: number
  jumlah_santri: number
}

export type KamarMenghafal = {
  asrama: string
  kamar: string
  blok_key: string
  blok_label: string
  jumlah_santri: number
  kelas_list: string
}

export type PesertaMenghafal = {
  santri_id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  blok: string | null
  nama_kelas: string
  marhalah_nama: string | null
  jam_group: string
  status_absen: string | null
}

export type RekapMenghafalRow = PesertaMenghafal & {
  tanggal: string
  sesi_id: number
  nomor_sesi: number
  sesi_label: string
  waktu_mulai: string | null
  waktu_selesai: string | null
  updated_at: string | null
  created_at: string
}

async function ensureSchema() {
  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_absensi_menghafal (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
      santri_id      TEXT NOT NULL REFERENCES santri(id),
      tanggal        TEXT NOT NULL,
      sesi_id        INTEGER NOT NULL REFERENCES ehb_sesi(id),
      status_absen   TEXT NOT NULL,
      asrama         TEXT,
      blok           TEXT,
      kamar          TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT,
      UNIQUE(ehb_event_id, santri_id, tanggal, sesi_id)
    )
  `)
  await execute('CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_event ON ehb_absensi_menghafal(ehb_event_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_santri ON ehb_absensi_menghafal(santri_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_jadwal ON ehb_absensi_menghafal(tanggal, sesi_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_status ON ehb_absensi_menghafal(status_absen)')
  await execute('CREATE INDEX IF NOT EXISTS idx_ehb_absensi_menghafal_asrama_kamar ON ehb_absensi_menghafal(asrama, blok, kamar)')
}

function splitJamGroups(jamGroup: string) {
  return String(jamGroup || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function buildMenghafalWhere(jamGroup: string, prefix = 'WHERE') {
  const currentJamGroups = splitJamGroups(jamGroup)
  if (currentJamGroups.length === 0) {
    return { sql: `${prefix} 1 = 0`, params: [] as unknown[] }
  }

  return {
    sql: `${prefix} kj.jam_group NOT IN (${currentJamGroups.map(() => '?').join(',')})`,
    params: currentJamGroups as unknown[],
  }
}

function normalizeBlokLabel(value: string | null | undefined) {
  const clean = String(value ?? '').trim()
  return clean || 'Tanpa Blok'
}

function normalizeBlokKey(value: string | null | undefined) {
  const clean = String(value ?? '').trim()
  return clean || TANPA_BLOK_KEY
}

function blokFilterSql(blokKey: string) {
  return blokKey === TANPA_BLOK_KEY
    ? `(kc.blok IS NULL OR TRIM(kc.blok) = '')`
    : `TRIM(kc.blok) = ?`
}

function blokFilterParams(blokKey: string) {
  return blokKey === TANPA_BLOK_KEY ? [] : [blokKey]
}

export async function getActiveEventLight() {
  return queryOne<{ id: number, nama: string }>(`SELECT id, nama FROM ehb_event WHERE is_active = 1 LIMIT 1`)
}

export async function getJadwalMenghafalList(eventId: number) {
  return query<SesiMenghafal>(`
    SELECT DISTINCT
      j.tanggal,
      j.sesi_id,
      s.nomor_sesi,
      s.label,
      s.jam_group,
      s.waktu_mulai,
      s.waktu_selesai
    FROM ehb_jadwal j
    JOIN ehb_sesi s ON s.id = j.sesi_id
    WHERE j.ehb_event_id = ?
      AND s.nomor_sesi BETWEEN 1 AND 4
    ORDER BY j.tanggal, s.nomor_sesi
  `, [eventId])
}

export async function getBlokForMenghafal(eventId: number, tanggal: string, sesiId: number, jamGroup: string) {
  await ensureSchema()
  const opposite = buildMenghafalWhere(jamGroup, 'AND')
  const rows = await query<{
    blok: string | null
    jumlah_kamar: number
    jumlah_santri: number
  }>(`
    SELECT
      NULLIF(TRIM(kc.blok), '') AS blok,
      COUNT(DISTINCT s.asrama || ':' || TRIM(COALESCE(s.kamar, ''))) AS jumlah_kamar,
      COUNT(DISTINCT s.id) AS jumlah_santri
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
    LEFT JOIN kamar_config kc ON kc.asrama = s.asrama AND kc.nomor_kamar = TRIM(COALESCE(s.kamar, ''))
    WHERE s.status_global = 'aktif'
      AND s.asrama IS NOT NULL AND TRIM(s.asrama) <> ''
      AND s.kamar IS NOT NULL AND TRIM(s.kamar) <> ''
      ${opposite.sql}
    GROUP BY NULLIF(TRIM(kc.blok), '')
    ORDER BY CASE WHEN blok IS NULL THEN 1 ELSE 0 END, blok
  `, [eventId, ...opposite.params])

  return rows.map(row => ({
    blok_key: normalizeBlokKey(row.blok),
    blok_label: normalizeBlokLabel(row.blok),
    jumlah_kamar: Number(row.jumlah_kamar ?? 0),
    jumlah_santri: Number(row.jumlah_santri ?? 0),
  }))
}

export async function getKamarForMenghafal(eventId: number, tanggal: string, sesiId: number, jamGroup: string, blokKey: string) {
  await ensureSchema()
  const opposite = buildMenghafalWhere(jamGroup, 'AND')
  const rows = await query<{
    asrama: string
    kamar: string
    blok: string | null
    jumlah_santri: number
    kelas_list: string | null
  }>(`
    SELECT
      s.asrama,
      TRIM(COALESCE(s.kamar, '')) AS kamar,
      NULLIF(TRIM(kc.blok), '') AS blok,
      COUNT(DISTINCT s.id) AS jumlah_santri,
      GROUP_CONCAT(DISTINCT k.nama_kelas) AS kelas_list
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
    LEFT JOIN kamar_config kc ON kc.asrama = s.asrama AND kc.nomor_kamar = TRIM(COALESCE(s.kamar, ''))
    WHERE s.status_global = 'aktif'
      AND s.asrama IS NOT NULL AND TRIM(s.asrama) <> ''
      AND s.kamar IS NOT NULL AND TRIM(s.kamar) <> ''
      ${opposite.sql}
      AND ${blokFilterSql(blokKey)}
    GROUP BY s.asrama, TRIM(COALESCE(s.kamar, '')), NULLIF(TRIM(kc.blok), '')
    ORDER BY s.asrama, CAST(TRIM(COALESCE(s.kamar, '')) AS INTEGER), TRIM(COALESCE(s.kamar, ''))
  `, [eventId, ...opposite.params, ...blokFilterParams(blokKey)])

  return rows.map(row => ({
    asrama: row.asrama,
    kamar: row.kamar,
    blok_key: normalizeBlokKey(row.blok),
    blok_label: normalizeBlokLabel(row.blok),
    jumlah_santri: Number(row.jumlah_santri ?? 0),
    kelas_list: row.kelas_list || '',
  }))
}

export async function getPesertaForMenghafal(
  eventId: number,
  tanggal: string,
  sesiId: number,
  jamGroup: string,
  asrama: string,
  kamar: string
) {
  await ensureSchema()
  const opposite = buildMenghafalWhere(jamGroup, 'AND')
  return query<PesertaMenghafal>(`
    SELECT
      s.id AS santri_id,
      s.nama_lengkap,
      s.nis,
      s.asrama,
      TRIM(COALESCE(s.kamar, '')) AS kamar,
      NULLIF(TRIM(kc.blok), '') AS blok,
      k.nama_kelas,
      m.nama AS marhalah_nama,
      kj.jam_group,
      COALESCE(a.status_absen, 'H') AS status_absen
    FROM santri s
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = ?
    LEFT JOIN kamar_config kc ON kc.asrama = s.asrama AND kc.nomor_kamar = TRIM(COALESCE(s.kamar, ''))
    LEFT JOIN ehb_absensi_menghafal a
      ON a.santri_id = s.id
     AND a.ehb_event_id = ?
     AND a.tanggal = ?
     AND a.sesi_id = ?
    WHERE s.status_global = 'aktif'
      AND s.asrama = ?
      AND TRIM(COALESCE(s.kamar, '')) = ?
      ${opposite.sql}
    ORDER BY s.nama_lengkap
  `, [eventId, eventId, tanggal, sesiId, asrama, kamar, ...opposite.params])
}

export async function saveAbsensiMenghafalInput(
  eventId: number,
  tanggal: string,
  sesiId: number,
  santriId: string,
  status: string
) {
  await ensureSchema()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    const cleanStatus = VALID_STATUSES.includes(status) ? status : 'H'
    const santri = await queryOne<{
      asrama: string | null
      kamar: string | null
      blok: string | null
      nama_lengkap: string | null
    }>(`
      SELECT s.asrama, s.kamar, kc.blok, s.nama_lengkap
      FROM santri s
      LEFT JOIN kamar_config kc ON kc.asrama = s.asrama AND kc.nomor_kamar = TRIM(COALESCE(s.kamar, ''))
      WHERE s.id = ?
      LIMIT 1
    `, [santriId])

    await execute(`
      INSERT INTO ehb_absensi_menghafal (ehb_event_id, santri_id, tanggal, sesi_id, status_absen, asrama, blok, kamar, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(ehb_event_id, santri_id, tanggal, sesi_id)
      DO UPDATE SET
        status_absen = excluded.status_absen,
        asrama = excluded.asrama,
        blok = excluded.blok,
        kamar = excluded.kamar,
        updated_at = datetime('now')
    `, [
      eventId,
      santriId,
      tanggal,
      sesiId,
      cleanStatus,
      santri?.asrama ?? null,
      santri?.blok ?? null,
      santri?.kamar ?? null,
    ])

    await logActivity({
      actor: actorFromSession(session),
      module: 'ehb_absensi_menghafal',
      action: 'update',
      fiturHref: FEATURE_PATH,
      logKind: 'update',
      entityType: 'ehb_absensi_menghafal',
      entityId: `${eventId}:${tanggal}:${sesiId}:${santriId}`,
      entityLabel: santri?.nama_lengkap || 'Absensi menghafal EHB',
      summary: `Menyimpan absensi menghafal EHB: ${cleanStatus}`,
      details: { event_id: eventId, tanggal, sesi_id: sesiId, santri_id: santriId, status: cleanStatus },
    })
    revalidatePath(FEATURE_PATH)
    revalidatePath(REKAP_PATH)
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}

export async function getRekapMenghafalTidakHadir(params: {
  eventId: number
  tanggal?: string
  sesiId?: number | ''
  blokKey?: string
  kamar?: string
  status?: string
}) {
  await ensureSchema()
  const where = [
    'a.ehb_event_id = ?',
    "a.status_absen IN ('A', 'I', 'S')",
    'sesi.nomor_sesi BETWEEN 1 AND 4',
  ]
  const queryParams: unknown[] = [params.eventId]

  if (params.tanggal) {
    where.push('a.tanggal = ?')
    queryParams.push(params.tanggal)
  }
  if (params.sesiId) {
    where.push('a.sesi_id = ?')
    queryParams.push(params.sesiId)
  }
  if (params.blokKey) {
    if (params.blokKey === TANPA_BLOK_KEY) {
      where.push("(a.blok IS NULL OR TRIM(a.blok) = '')")
    } else {
      where.push('TRIM(a.blok) = ?')
      queryParams.push(params.blokKey)
    }
  }
  if (params.kamar) {
    where.push('TRIM(COALESCE(a.kamar, \'\')) = ?')
    queryParams.push(params.kamar)
  }
  if (params.status && ['A', 'I', 'S'].includes(params.status)) {
    where.push('a.status_absen = ?')
    queryParams.push(params.status)
  }

  return query<RekapMenghafalRow>(`
    SELECT
      a.santri_id,
      s.nama_lengkap,
      s.nis,
      COALESCE(a.asrama, s.asrama) AS asrama,
      COALESCE(a.kamar, s.kamar) AS kamar,
      a.blok,
      k.nama_kelas,
      m.nama AS marhalah_nama,
      kj.jam_group,
      a.status_absen,
      a.tanggal,
      a.sesi_id,
      sesi.nomor_sesi,
      sesi.label AS sesi_label,
      sesi.waktu_mulai,
      sesi.waktu_selesai,
      a.updated_at,
      a.created_at
    FROM ehb_absensi_menghafal a
    JOIN santri s ON s.id = a.santri_id
    JOIN ehb_sesi sesi ON sesi.id = a.sesi_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN ehb_kelas_jam kj ON kj.kelas_id = k.id AND kj.ehb_event_id = a.ehb_event_id
    WHERE ${where.join(' AND ')}
    ORDER BY a.tanggal DESC, sesi.nomor_sesi, COALESCE(a.asrama, s.asrama), COALESCE(a.blok, ''), COALESCE(a.kamar, ''), s.nama_lengkap
  `, queryParams)
}

export async function getRekapFilterOptions(eventId: number) {
  await ensureSchema()
  const [sesiList, tanggalList, blokList, kamarList] = await Promise.all([
    getJadwalMenghafalList(eventId),
    query<{ tanggal: string }>(`
      SELECT DISTINCT j.tanggal
      FROM ehb_jadwal j
      JOIN ehb_sesi s ON s.id = j.sesi_id
      WHERE j.ehb_event_id = ? AND s.nomor_sesi BETWEEN 1 AND 4
      ORDER BY j.tanggal DESC
    `, [eventId]),
    query<{ blok: string | null }>(`
      SELECT blok
      FROM (
        SELECT DISTINCT NULLIF(TRIM(blok), '') AS blok
        FROM kamar_config
      ) daftar_blok
      ORDER BY CASE WHEN blok IS NULL THEN 1 ELSE 0 END, blok
    `),
    query<{ kamar: string }>(`
      SELECT DISTINCT TRIM(kamar) AS kamar
      FROM santri
      WHERE status_global = 'aktif'
        AND kamar IS NOT NULL
        AND TRIM(kamar) <> ''
      ORDER BY CAST(TRIM(kamar) AS INTEGER), TRIM(kamar)
    `),
  ])

  return {
    sesiList,
    tanggalList: tanggalList.map(row => row.tanggal),
    blokList: blokList.map(row => ({
      blok_key: normalizeBlokKey(row.blok),
      blok_label: normalizeBlokLabel(row.blok),
    })),
    kamarList: kamarList.map(row => row.kamar),
  }
}
