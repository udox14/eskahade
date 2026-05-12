import { execute, query } from '@/lib/db'
import { backfillManualWaliKelasFromGuruMaghrib } from '@/lib/akademik/wali-kelas-sync'

export const GURU_JADWAL_SESSIONS = ['shubuh', 'ashar', 'maghrib'] as const
export type GuruJadwalSession = typeof GURU_JADWAL_SESSIONS[number]

export const HARI_INDEX_LABEL: Record<number, string> = {
  0: 'Ahad',
  1: 'Sen',
  2: 'Sel',
  3: 'Rab',
  4: 'Kam',
  5: 'Jum',
  6: 'Sab',
}

const HARI_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
const HARI_POSITION_MAP = new Map<number, number>(HARI_DISPLAY_ORDER.map((hari, index) => [hari, index]))

export type WeeklyGuruRule = {
  id?: number
  kelas_id: string
  sesi: GuruJadwalSession
  hari_index: number
  guru_id: number
  guru_nama?: string | null
}

export type KelasGabunganPengajian = {
  id: number
  group_key: string
  nama: string
  sesi: GuruJadwalSession
  tempat: string | null
  tahun_ajaran_id: number | null
  kelas_id: string
  nama_kelas: string
}

export type KelasGabunganInput = {
  sesi: GuruJadwalSession
  groupKey: string | null
  tempat?: string | null
}

export type KelasGuruBase = {
  id: string
  nama_kelas?: string | null
  guru_shubuh_id: number | null
  guru_shubuh_nama?: string | null
  guru_ashar_id: number | null
  guru_ashar_nama?: string | null
  guru_maghrib_id: number | null
  guru_maghrib_nama?: string | null
}

export type ResolvedGuru = {
  id: number | null
  nama: string | null
  source: 'default' | 'override'
}

export type ResolvedGuruBySession = Record<GuruJadwalSession, ResolvedGuru>

let guruJadwalSchemaReady: Promise<void> | null = null

export async function ensureGuruJadwalSchema() {
  guruJadwalSchemaReady ??= ensureGuruJadwalSchemaOnce().catch(error => {
    guruJadwalSchemaReady = null
    throw error
  })
  await guruJadwalSchemaReady
}

async function ensureGuruJadwalSchemaOnce() {
  await execute(`
    CREATE TABLE IF NOT EXISTS kelas_jadwal_guru_mingguan (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kelas_id    TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
      sesi        TEXT NOT NULL,
      hari_index  INTEGER NOT NULL,
      guru_id     INTEGER NOT NULL REFERENCES data_guru(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(kelas_id, sesi, hari_index)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_kelas_jadwal_guru_mingguan_lookup
    ON kelas_jadwal_guru_mingguan(kelas_id, sesi, hari_index)
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_kelas_jadwal_guru_mingguan_guru
    ON kelas_jadwal_guru_mingguan(guru_id, sesi, hari_index)
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS kelas_gabungan_pengajian (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      group_key        TEXT NOT NULL,
      nama             TEXT NOT NULL,
      sesi             TEXT NOT NULL,
      tempat           TEXT,
      tahun_ajaran_id  INTEGER REFERENCES tahun_ajaran(id) ON DELETE CASCADE,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tahun_ajaran_id, sesi, group_key)
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS kelas_gabungan_pengajian_anggota (
      group_id    INTEGER NOT NULL REFERENCES kelas_gabungan_pengajian(id) ON DELETE CASCADE,
      kelas_id    TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, kelas_id)
    )
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_kelas_gabungan_pengajian_lookup
    ON kelas_gabungan_pengajian(tahun_ajaran_id, sesi, group_key)
  `)
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_kelas_gabungan_pengajian_anggota_kelas
    ON kelas_gabungan_pengajian_anggota(kelas_id)
  `)

  const snapshotColumns = [
    'ALTER TABLE absensi_guru ADD COLUMN guru_shubuh_id_snapshot INTEGER REFERENCES data_guru(id)',
    'ALTER TABLE absensi_guru ADD COLUMN guru_shubuh_nama_snapshot TEXT',
    'ALTER TABLE absensi_guru ADD COLUMN guru_ashar_id_snapshot INTEGER REFERENCES data_guru(id)',
    'ALTER TABLE absensi_guru ADD COLUMN guru_ashar_nama_snapshot TEXT',
    'ALTER TABLE absensi_guru ADD COLUMN guru_maghrib_id_snapshot INTEGER REFERENCES data_guru(id)',
    'ALTER TABLE absensi_guru ADD COLUMN guru_maghrib_nama_snapshot TEXT',
  ]

  for (const sql of snapshotColumns) {
    try {
      await execute(sql)
    } catch (error: any) {
      if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
        throw error
      }
    }
  }

  await backfillManualWaliKelasFromGuruMaghrib()
}

export function normalizeGabunganKey(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export async function getKelasGabunganPengajian(kelasIds?: string[]) {
  await ensureGuruJadwalSchema()

  const cleanedIds = (kelasIds || []).filter(Boolean)
  const whereClause = cleanedIds.length > 0
    ? `WHERE a.kelas_id IN (${cleanedIds.map(() => '?').join(',')})`
    : ''

  return query<KelasGabunganPengajian>(`
    SELECT
      g.id,
      g.group_key,
      g.nama,
      g.sesi,
      g.tempat,
      g.tahun_ajaran_id,
      a.kelas_id,
      k.nama_kelas
    FROM kelas_gabungan_pengajian g
    JOIN kelas_gabungan_pengajian_anggota a ON a.group_id = g.id
    JOIN kelas k ON k.id = a.kelas_id
    ${whereClause}
    ORDER BY g.sesi, g.group_key, k.nama_kelas
  `, cleanedIds)
}

export function buildGabunganByKelas(groups: KelasGabunganPengajian[]) {
  const map = new Map<string, KelasGabunganPengajian>()
  for (const group of groups) {
    map.set(`${group.kelas_id}|${group.sesi}`, group)
  }
  return map
}

export function buildGabunganMembersByGroup(groups: KelasGabunganPengajian[]) {
  const map = new Map<number, KelasGabunganPengajian[]>()
  for (const group of groups) {
    if (!map.has(group.id)) map.set(group.id, [])
    map.get(group.id)!.push(group)
  }
  for (const members of map.values()) {
    members.sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' }))
  }
  return map
}

export async function saveKelasGabunganPengajian(
  kelasId: string,
  tahunAjaranId: number | null,
  inputs: KelasGabunganInput[]
) {
  await ensureGuruJadwalSchema()

  for (const input of inputs) {
    if (!GURU_JADWAL_SESSIONS.includes(input.sesi)) continue

    await execute(`
      DELETE FROM kelas_gabungan_pengajian_anggota
      WHERE kelas_id = ?
        AND group_id IN (SELECT id FROM kelas_gabungan_pengajian WHERE sesi = ? AND tahun_ajaran_id IS ?)
    `, [kelasId, input.sesi, tahunAjaranId])

    const groupKey = normalizeGabunganKey(input.groupKey)
    if (!groupKey) continue

    const tempat = String(input.tempat || '').trim() || null
    await execute(`
      INSERT INTO kelas_gabungan_pengajian (group_key, nama, sesi, tempat, tahun_ajaran_id, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(tahun_ajaran_id, sesi, group_key) DO UPDATE SET
        nama = excluded.nama,
        tempat = COALESCE(excluded.tempat, kelas_gabungan_pengajian.tempat),
        updated_at = excluded.updated_at
    `, [groupKey, groupKey, input.sesi, tempat, tahunAjaranId])

    const group = await query<{ id: number }>(`
      SELECT id
      FROM kelas_gabungan_pengajian
      WHERE tahun_ajaran_id IS ? AND sesi = ? AND group_key = ?
      LIMIT 1
    `, [tahunAjaranId, input.sesi, groupKey])

    const groupId = group[0]?.id
    if (!groupId) continue
    await execute(`
      INSERT OR IGNORE INTO kelas_gabungan_pengajian_anggota (group_id, kelas_id)
      VALUES (?, ?)
    `, [groupId, kelasId])
  }

  await execute(`
    DELETE FROM kelas_gabungan_pengajian
    WHERE id NOT IN (SELECT DISTINCT group_id FROM kelas_gabungan_pengajian_anggota)
  `)
}

export function isPengajianLiburByHariIndex(hariIndex: number, sesi: GuruJadwalSession) {
  if (hariIndex === 2 && sesi === 'maghrib') return true
  if (hariIndex === 4 && sesi === 'maghrib') return true
  if (hariIndex === 5 && (sesi === 'shubuh' || sesi === 'ashar')) return true
  return false
}

export function getHariIndexFromDate(dateInput: string | Date) {
  const date = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput)
  return date.getDay()
}

export async function getWeeklyGuruRules(kelasIds?: string[]) {
  await ensureGuruJadwalSchema()

  const cleanedIds = (kelasIds || []).filter(Boolean)
  const whereClause = cleanedIds.length > 0
    ? `WHERE r.kelas_id IN (${cleanedIds.map(() => '?').join(',')})`
    : ''

  return query<WeeklyGuruRule>(`
    SELECT
      r.id,
      r.kelas_id,
      r.sesi,
      r.hari_index,
      r.guru_id,
      g.nama_lengkap as guru_nama
    FROM kelas_jadwal_guru_mingguan r
    JOIN data_guru g ON g.id = r.guru_id
    ${whereClause}
    ORDER BY r.kelas_id, r.sesi, r.hari_index
  `, cleanedIds)
}

export function buildWeeklyGuruRuleMap(rules: WeeklyGuruRule[]) {
  return new Map<string, WeeklyGuruRule>(
    rules.map(rule => [`${rule.kelas_id}|${rule.sesi}|${rule.hari_index}`, rule])
  )
}

export function buildWeeklyGuruRulesByKelas(rules: WeeklyGuruRule[]) {
  const map = new Map<string, WeeklyGuruRule[]>()
  for (const rule of rules) {
    if (!map.has(rule.kelas_id)) map.set(rule.kelas_id, [])
    map.get(rule.kelas_id)!.push(rule)
  }
  return map
}

function resolveDefaultGuru(kelas: KelasGuruBase, sesi: GuruJadwalSession): ResolvedGuru {
  if (sesi === 'shubuh') {
    return {
      id: kelas.guru_shubuh_id ?? null,
      nama: kelas.guru_shubuh_nama ?? null,
      source: 'default',
    }
  }

  if (sesi === 'ashar') {
    return {
      id: kelas.guru_ashar_id ?? null,
      nama: kelas.guru_ashar_nama ?? null,
      source: 'default',
    }
  }

  return {
    id: kelas.guru_maghrib_id ?? null,
    nama: kelas.guru_maghrib_nama ?? null,
    source: 'default',
  }
}

export function resolveGuruForHariIndex(
  kelas: KelasGuruBase,
  hariIndex: number,
  ruleMap: Map<string, WeeklyGuruRule>
): ResolvedGuruBySession {
  const resolved = {} as ResolvedGuruBySession

  for (const sesi of GURU_JADWAL_SESSIONS) {
    const override = ruleMap.get(`${kelas.id}|${sesi}|${hariIndex}`)
    if (override) {
      resolved[sesi] = {
        id: override.guru_id,
        nama: override.guru_nama ?? null,
        source: 'override',
      }
      continue
    }

    resolved[sesi] = resolveDefaultGuru(kelas, sesi)
  }

  return resolved
}

export function resolveGuruForDate(
  kelas: KelasGuruBase,
  tanggal: string | Date,
  ruleMap: Map<string, WeeklyGuruRule>
) {
  return resolveGuruForHariIndex(kelas, getHariIndexFromDate(tanggal), ruleMap)
}

export function buildWeekSchedule(
  kelas: KelasGuruBase,
  dates: string[],
  ruleMap: Map<string, WeeklyGuruRule>
) {
  return dates.map(tanggal => ({
    tanggal,
    hari_index: getHariIndexFromDate(tanggal),
    guru: resolveGuruForDate(kelas, tanggal, ruleMap),
  }))
}

function formatHariRanges(hariIndexes: number[]) {
  const sorted = [...hariIndexes].sort((a, b) => (HARI_POSITION_MAP.get(a) ?? 0) - (HARI_POSITION_MAP.get(b) ?? 0))
  const ranges: number[][] = []

  for (const hari of sorted) {
    const position = HARI_POSITION_MAP.get(hari) ?? 0
    const lastRange = ranges[ranges.length - 1]
    if (!lastRange) {
      ranges.push([hari])
      continue
    }

    const lastHari = lastRange[lastRange.length - 1]
    const lastPosition = HARI_POSITION_MAP.get(lastHari) ?? 0
    if (position === lastPosition + 1) {
      lastRange.push(hari)
    } else {
      ranges.push([hari])
    }
  }

  return ranges
    .map(range => {
      const first = HARI_INDEX_LABEL[range[0]]
      const last = HARI_INDEX_LABEL[range[range.length - 1]]
      return range.length === 1 ? first : `${first}-${last}`
    })
    .join(', ')
}

export function summarizeWeeklyGuruSession(
  kelas: KelasGuruBase,
  sesi: GuruJadwalSession,
  ruleMap: Map<string, WeeklyGuruRule>,
  options?: { skipStructuralLibur?: boolean }
) {
  const skipStructuralLibur = options?.skipStructuralLibur ?? true
  const guruDays = new Map<string, { nama: string; hari: number[] }>()

  for (const hariIndex of HARI_DISPLAY_ORDER) {
    if (skipStructuralLibur && isPengajianLiburByHariIndex(hariIndex, sesi)) continue

    const resolved = resolveGuruForHariIndex(kelas, hariIndex, ruleMap)[sesi]
    if (!resolved.id || !resolved.nama) continue

    const key = `${resolved.id}`
    if (!guruDays.has(key)) {
      guruDays.set(key, { nama: resolved.nama, hari: [] })
    }
    guruDays.get(key)!.hari.push(hariIndex)
  }

  if (guruDays.size === 0) return '-'

  return Array.from(guruDays.values())
    .map(item => `${item.nama} (${formatHariRanges(item.hari)})`)
    .join(', ')
}

export function summarizeWeeklyGuruAssignments(
  kelas: KelasGuruBase,
  ruleMap: Map<string, WeeklyGuruRule>,
  options?: { skipStructuralLibur?: boolean }
) {
  return {
    shubuh: summarizeWeeklyGuruSession(kelas, 'shubuh', ruleMap, options),
    ashar: summarizeWeeklyGuruSession(kelas, 'ashar', ruleMap, options),
    maghrib: summarizeWeeklyGuruSession(kelas, 'maghrib', ruleMap, options),
  }
}

export function summarizeWeeklyGuruSessionNames(
  kelas: KelasGuruBase,
  sesi: GuruJadwalSession,
  ruleMap: Map<string, WeeklyGuruRule>,
  options?: { skipStructuralLibur?: boolean; separator?: string }
) {
  const skipStructuralLibur = options?.skipStructuralLibur ?? true
  const separator = options?.separator ?? '\n'
  const seen = new Set<string>()
  const names: string[] = []

  for (const hariIndex of HARI_DISPLAY_ORDER) {
    if (skipStructuralLibur && isPengajianLiburByHariIndex(hariIndex, sesi)) continue

    const resolved = resolveGuruForHariIndex(kelas, hariIndex, ruleMap)[sesi]
    if (!resolved.id || !resolved.nama) continue

    const key = `${resolved.id}`
    if (seen.has(key)) continue
    seen.add(key)
    names.push(resolved.nama)
  }

  return names.length > 0 ? names.join(separator) : '-'
}

export function summarizeWeeklyGuruAssignmentNames(
  kelas: KelasGuruBase,
  ruleMap: Map<string, WeeklyGuruRule>,
  options?: { skipStructuralLibur?: boolean; separator?: string }
) {
  return {
    shubuh: summarizeWeeklyGuruSessionNames(kelas, 'shubuh', ruleMap, options),
    ashar: summarizeWeeklyGuruSessionNames(kelas, 'ashar', ruleMap, options),
    maghrib: summarizeWeeklyGuruSessionNames(kelas, 'maghrib', ruleMap, options),
  }
}
