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
