import { batch, execute, query, queryOne } from '@/lib/db'
import {
  getHariIndexFromDate,
} from '@/lib/akademik/guru-jadwal'

export const GURU_KITAB_SESSIONS = ['shubuh', 'ashar', 'maghrib'] as const
export type GuruKitabSession = typeof GURU_KITAB_SESSIONS[number]

export type GuruKitabAssignmentRow = {
  id: number
  tahun_ajaran_id: number
  kelas_id: string
  sesi: GuruKitabSession
  hari_index: number | null
  guru_id: number
  guru_nama: string
  kitab_id: number
  kitab_nama: string
  mapel_id: number
  mapel_nama: string
  marhalah_id: number
  source: 'auto' | 'manual'
  is_active: number
}

export type GuruKitabResolvedRow = {
  ehb_event_id: number
  tanggal: string
  sesi_id: number
  sesi_label: string
  sesi: GuruKitabSession
  hari_index: number
  kelas_id: string
  nama_kelas: string
  marhalah_id: number
  marhalah_nama: string
  mapel_id: number
  mapel_nama: string
  kitab_id: number
  kitab_nama: string
  guru_id: number
  guru_nama: string
  jumlah_santri: number
  source: string
}

const DEFAULT_MAPEL: Record<'ibtidaiyyah' | 'mutawassithah', Record<GuruKitabSession, string[]>> = {
  ibtidaiyyah: {
    maghrib: ['Nahwu', 'Sharaf'],
    ashar: ['Fikih', 'Akidah', 'Bahasa Arab'],
    shubuh: ['Al-Quran', 'Hadits', 'Tarikh'],
  },
  mutawassithah: {
    maghrib: ['Nahwu', 'Balaghah', 'Bahasa Arab'],
    ashar: ['Fikih', 'Akidah', 'Akhlak'],
    shubuh: ['Al-Quran', 'Hadits'],
  },
}

let guruKitabSchemaReady: Promise<void> | null = null

export async function ensureGuruKitabSchema() {
  guruKitabSchemaReady ??= ensureGuruKitabSchemaOnce().catch(error => {
    guruKitabSchemaReady = null
    throw error
  })
  await guruKitabSchemaReady
}

async function ensureGuruKitabSchemaOnce() {
  await execute(`
    CREATE TABLE IF NOT EXISTS guru_kitab_assignment (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      tahun_ajaran_id  INTEGER NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
      kelas_id         TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
      sesi             TEXT NOT NULL,
      hari_index       INTEGER,
      guru_id          INTEGER NOT NULL REFERENCES data_guru(id),
      kitab_id         INTEGER NOT NULL REFERENCES kitab(id),
      source           TEXT NOT NULL DEFAULT 'manual',
      is_active        INTEGER NOT NULL DEFAULT 1,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT
    )
  `)
  await execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_guru_kitab_assignment_unique
    ON guru_kitab_assignment(tahun_ajaran_id, kelas_id, sesi, COALESCE(hari_index, -1), kitab_id)
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_guru_kitab_assignment_lookup
    ON guru_kitab_assignment(tahun_ajaran_id, kelas_id, sesi, hari_index, is_active)
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_guru_kitab_assignment_guru
    ON guru_kitab_assignment(guru_id, tahun_ajaran_id, is_active)
  `)
  await execute(`
    INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
    VALUES ('Master Data', 'Pembagian Kitab Guru', '/dashboard/master/guru-kitab', 'BookOpen', '["admin"]', 1, 6)
  `)
}

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bal\s+qur\s*an\b/g, 'al quran')
    .replace(/\bal\s+quran\b/g, 'al quran')
    .replace(/\bqur\s*an\b/g, 'al quran')
    .replace(/\bquran\b/g, 'al quran')
    .replace(/\bshorof\b/g, 'sharaf')
    .replace(/\bshorf\b/g, 'sharaf')
    .replace(/\bfiqih\b/g, 'fikih')
    .replace(/\baqidah\b/g, 'akidah')
    .replace(/\s+/g, ' ')
    .trim()
}

function mapelKey(value: string) {
  const normalized = normalizeText(value)
  const aliases: Record<string, string> = {
    'al quran': 'al-quran',
    'alquran': 'al-quran',
    'bahasa arab': 'bahasa-arab',
    shorof: 'sharaf',
    sharaf: 'sharaf',
    fiqih: 'fikih',
    fikih: 'fikih',
    aqidah: 'akidah',
    akidah: 'akidah',
  }
  return aliases[normalized] || normalized.replace(/\s+/g, '-')
}

export function getDefaultMapelKeys(marhalahName: string, sesi: GuruKitabSession) {
  const normalized = normalizeText(marhalahName)
  if (normalized.includes('tamhidiyah') || normalized.includes('tamhidiyyah')) return []
  if (normalized.includes('ibtidaiyyah') || normalized.includes('ibtidaiyah')) return DEFAULT_MAPEL.ibtidaiyyah[sesi].map(mapelKey)
  if (normalized.includes('mutawassithah') || normalized.includes('mutawasit')) return DEFAULT_MAPEL.mutawassithah[sesi].map(mapelKey)
  return []
}

function defaultGuruIdForSession(kelas: Record<string, any>, sesi: GuruKitabSession) {
  if (sesi === 'shubuh') return Number(kelas.guru_shubuh_id || 0) || null
  if (sesi === 'ashar') return Number(kelas.guru_ashar_id || 0) || null
  return Number(kelas.guru_maghrib_id || 0) || null
}

export async function generateGuruKitabDefaultAssignments(tahunAjaranId: number) {
  await ensureGuruKitabSchema()
  const [kelasRows, kitabRows, existingRows] = await Promise.all([
    query<any>(`
      SELECT k.id, k.nama_kelas, k.marhalah_id, m.nama AS marhalah_nama,
             k.guru_shubuh_id, k.guru_ashar_id, k.guru_maghrib_id
      FROM kelas k
      JOIN marhalah m ON m.id = k.marhalah_id
      WHERE k.tahun_ajaran_id = ?
      ORDER BY m.urutan, k.nama_kelas
    `, [tahunAjaranId]),
    query<any>(`
      SELECT k.id, k.marhalah_id, k.mapel_id, mp.nama AS mapel_nama
      FROM kitab k
      JOIN mapel mp ON mp.id = k.mapel_id
      WHERE k.tahun_ajaran_id = ?
    `, [tahunAjaranId]),
    query<{ id: number; kelas_id: string; sesi: GuruKitabSession; hari_index: number | null; kitab_id: number; source: string }>(`
      SELECT id, kelas_id, sesi, hari_index, kitab_id, source
      FROM guru_kitab_assignment
      WHERE tahun_ajaran_id = ?
    `, [tahunAjaranId]),
  ])

  const kitabByMarhalah = new Map<number, any[]>()
  for (const kitab of kitabRows) {
    const list = kitabByMarhalah.get(Number(kitab.marhalah_id)) || []
    list.push({ ...kitab, mapel_key: mapelKey(kitab.mapel_nama || '') })
    kitabByMarhalah.set(Number(kitab.marhalah_id), list)
  }

  const existingMap = new Map(existingRows.map(row => [
    `${row.kelas_id}|${row.sesi}|${row.hari_index ?? 'default'}|${row.kitab_id}`,
    row,
  ]))
  const statements: { sql: string; params?: unknown[] }[] = []
  let inserted = 0
  let updated = 0

  for (const kelas of kelasRows) {
    for (const sesi of GURU_KITAB_SESSIONS) {
      const guruId = defaultGuruIdForSession(kelas, sesi)
      if (!guruId) continue
      const defaultKeys = new Set(getDefaultMapelKeys(kelas.marhalah_nama || '', sesi))
      if (defaultKeys.size === 0) continue

      const kitabList = (kitabByMarhalah.get(Number(kelas.marhalah_id)) || [])
        .filter(kitab => defaultKeys.has(kitab.mapel_key))

      for (const kitab of kitabList) {
        const key = `${kelas.id}|${sesi}|default|${kitab.id}`
        const existing = existingMap.get(key)
        if (!existing) {
          statements.push({
            sql: `
              INSERT OR IGNORE INTO guru_kitab_assignment
                (tahun_ajaran_id, kelas_id, sesi, hari_index, guru_id, kitab_id, source, is_active, updated_at)
              VALUES (?, ?, ?, NULL, ?, ?, 'auto', 1, datetime('now'))
            `,
            params: [tahunAjaranId, kelas.id, sesi, guruId, kitab.id],
          })
          inserted += 1
        } else if (existing.source === 'auto') {
          statements.push({
            sql: `
              UPDATE guru_kitab_assignment
              SET guru_id = ?, is_active = 1, updated_at = datetime('now')
              WHERE id = ?
            `,
            params: [guruId, existing.id],
          })
          updated += 1
        }
      }
    }
  }

  if (statements.length > 0) await batch(statements)
  return { inserted, updated }
}

export async function getGuruKitabAssignments(tahunAjaranId: number, kelasIds?: string[]) {
  await ensureGuruKitabSchema()
  const cleanedIds = (kelasIds || []).filter(Boolean)
  const kelasClause = cleanedIds.length > 0 ? `AND a.kelas_id IN (${cleanedIds.map(() => '?').join(',')})` : ''
  return query<GuruKitabAssignmentRow>(`
    SELECT
      a.id, a.tahun_ajaran_id, a.kelas_id, a.sesi, a.hari_index, a.guru_id,
      dg.nama_lengkap AS guru_nama,
      a.kitab_id, kb.nama_kitab AS kitab_nama,
      mp.id AS mapel_id, mp.nama AS mapel_nama,
      kb.marhalah_id,
      a.source, a.is_active
    FROM guru_kitab_assignment a
    JOIN data_guru dg ON dg.id = a.guru_id
    JOIN kitab kb ON kb.id = a.kitab_id
    JOIN mapel mp ON mp.id = kb.mapel_id
    WHERE a.tahun_ajaran_id = ? ${kelasClause}
    ORDER BY a.kelas_id,
      CASE a.sesi WHEN 'shubuh' THEN 0 WHEN 'ashar' THEN 1 ELSE 2 END,
      COALESCE(a.hari_index, -1),
      mp.nama, kb.nama_kitab
  `, [tahunAjaranId, ...cleanedIds])
}

export function buildAssignmentLookup(rows: GuruKitabAssignmentRow[]) {
  const map = new Map<string, GuruKitabAssignmentRow[]>()
  for (const row of rows) {
    if (!row.is_active) continue
    const key = `${row.kelas_id}|${row.sesi}|${row.hari_index ?? 'default'}`
    map.set(key, [...(map.get(key) || []), row])
  }
  return map
}

function getAssignmentsForEhbSlot(
  lookup: Map<string, GuruKitabAssignmentRow[]>,
  kelasId: string,
  hariIndex: number,
  mapelId: number
) {
  const harian = GURU_KITAB_SESSIONS.flatMap(sesi => lookup.get(`${kelasId}|${sesi}|${hariIndex}`) || [])
  const defaults = GURU_KITAB_SESSIONS.flatMap(sesi => lookup.get(`${kelasId}|${sesi}|default`) || [])
  const rows = (harian.length > 0 ? harian : defaults)
    .filter(item => Number(item.mapel_id) === Number(mapelId))

  if (rows.length > 0 || harian.length === 0) return dedupeAssignmentsForHonor(rows)

  return dedupeAssignmentsForHonor(defaults.filter(item => Number(item.mapel_id) === Number(mapelId)))
}

function dedupeAssignmentsForHonor(rows: GuruKitabAssignmentRow[]) {
  const seen = new Set<string>()
  const deduped: GuruKitabAssignmentRow[] = []

  for (const row of rows) {
    const key = `${row.guru_id}|${row.mapel_id}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(row)
  }

  return deduped
}

export async function getGuruKitabResolvedForEhb(eventId: number): Promise<GuruKitabResolvedRow[]> {
  await ensureGuruKitabSchema()
  const event = await queryOne<{ tahun_ajaran_id: number }>('SELECT tahun_ajaran_id FROM ehb_event WHERE id = ?', [eventId])
  if (!event?.tahun_ajaran_id) return []

  const jadwalRows = await query<any>(`
    SELECT
      j.ehb_event_id, j.tanggal, j.sesi_id, j.kelas_id, j.mapel_id,
      s.label AS sesi_label, s.jam_group,
      k.nama_kelas, k.marhalah_id, m.nama AS marhalah_nama,
      mp.nama AS mapel_nama,
      COALESCE(NULLIF((
        SELECT COUNT(DISTINCT ps.santri_id)
        FROM ehb_plotting_santri ps
        JOIN riwayat_pendidikan rp ON rp.santri_id = ps.santri_id
          AND rp.kelas_id = j.kelas_id
          AND rp.status_riwayat = 'aktif'
        WHERE ps.ehb_event_id = j.ehb_event_id
      ), 0), (
        SELECT COUNT(DISTINCT rp.santri_id)
        FROM riwayat_pendidikan rp
        JOIN santri s ON s.id = rp.santri_id
        WHERE rp.kelas_id = j.kelas_id
          AND rp.status_riwayat = 'aktif'
          AND s.status_global IN ('aktif', 'nonaktif_sementara')
      )) AS jumlah_santri
    FROM ehb_jadwal j
    JOIN ehb_sesi s ON s.id = j.sesi_id
    JOIN kelas k ON k.id = j.kelas_id
    JOIN marhalah m ON m.id = k.marhalah_id
    JOIN mapel mp ON mp.id = j.mapel_id
    WHERE j.ehb_event_id = ?
    ORDER BY j.tanggal, s.nomor_sesi, m.urutan, k.nama_kelas
  `, [eventId])

  const kelasIds = Array.from(new Set(jadwalRows.map(row => String(row.kelas_id)).filter(Boolean)))
  const assignments = await getGuruKitabAssignments(event.tahun_ajaran_id, kelasIds)
  const lookup = buildAssignmentLookup(assignments)
  const resolved: GuruKitabResolvedRow[] = []
  const resolvedPackages = new Set<string>()

  for (const jadwal of jadwalRows) {
    const hariIndex = getHariIndexFromDate(jadwal.tanggal)
    const candidates = getAssignmentsForEhbSlot(
      lookup,
      jadwal.kelas_id,
      hariIndex,
      Number(jadwal.mapel_id)
    )

    const seenGuru = new Set<number>()
    for (const item of candidates) {
      if (seenGuru.has(item.guru_id)) continue
      const packageKey = `${jadwal.kelas_id}|${jadwal.mapel_id}|${item.guru_id}`
      if (resolvedPackages.has(packageKey)) continue
      seenGuru.add(item.guru_id)
      resolvedPackages.add(packageKey)
      resolved.push({
        ehb_event_id: eventId,
        tanggal: jadwal.tanggal,
        sesi_id: Number(jadwal.sesi_id),
        sesi_label: jadwal.sesi_label || '',
        sesi: item.sesi,
        hari_index: hariIndex,
        kelas_id: jadwal.kelas_id,
        nama_kelas: jadwal.nama_kelas,
        marhalah_id: Number(jadwal.marhalah_id),
        marhalah_nama: jadwal.marhalah_nama,
        mapel_id: Number(jadwal.mapel_id),
        mapel_nama: jadwal.mapel_nama,
        kitab_id: item.kitab_id,
        kitab_nama: item.kitab_nama,
        guru_id: item.guru_id,
        guru_nama: item.guru_nama,
        jumlah_santri: Number(jadwal.jumlah_santri || 0),
        source: item.hari_index == null ? item.source : 'override',
      })
    }
  }

  return resolved
}

export function normalizeEhbSession(value: unknown): GuruKitabSession | null {
  const normalized = normalizeText(String(value || ''))
  if (normalized.includes('shubuh') || normalized.includes('subuh')) return 'shubuh'
  if (normalized.includes('ashar') || normalized.includes('asar')) return 'ashar'
  if (normalized.includes('maghrib') || normalized.includes('malam')) return 'maghrib'
  if (GURU_KITAB_SESSIONS.includes(value as GuruKitabSession)) return value as GuruKitabSession
  return null
}
