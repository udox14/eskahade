import { execute, queryOne } from '@/lib/db'

export type PengawasGender = 'L' | 'P'
export type PengawasTag = 'senior' | 'junior'

export type PengawasRuleConfig = {
  senior_allowed_sesi: number[]
  senior_blocked_sesi: number[]
  senior_avoid_last_session: boolean
}

type PengawasRuleRow = {
  senior_allowed_sesi: string | null
  senior_blocked_sesi: string | null
  senior_avoid_last_session: number | null
}

export function normalizeJenisKelamin(value: string | null | undefined): PengawasGender {
  return String(value || '').toUpperCase() === 'P' ? 'P' : 'L'
}

export function normalizePengawasTag(value: string | null | undefined): PengawasTag {
  return String(value || '').toLowerCase() === 'senior' ? 'senior' : 'junior'
}

function normalizeSesiList(values: unknown): number[] {
  if (!Array.isArray(values)) return []
  const unique = new Set<number>()

  for (const value of values) {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed > 0) unique.add(parsed)
  }

  return Array.from(unique).sort((a, b) => a - b)
}

function parseSesiList(raw: string | null | undefined): number[] {
  if (!raw) return []

  try {
    return normalizeSesiList(JSON.parse(raw))
  } catch {
    return normalizeSesiList(
      raw
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    )
  }
}

export function serializeSesiList(values: number[]) {
  return JSON.stringify(normalizeSesiList(values))
}

export function getDefaultPengawasRuleConfig(): PengawasRuleConfig {
  return {
    senior_allowed_sesi: [],
    senior_blocked_sesi: [],
    senior_avoid_last_session: true,
  }
}

export function hydratePengawasRuleConfig(row?: PengawasRuleRow | null): PengawasRuleConfig {
  const defaults = getDefaultPengawasRuleConfig()
  if (!row) return defaults

  return {
    senior_allowed_sesi: parseSesiList(row.senior_allowed_sesi),
    senior_blocked_sesi: parseSesiList(row.senior_blocked_sesi),
    senior_avoid_last_session: row.senior_avoid_last_session !== 0,
  }
}

export async function ensurePengawasSchema() {
  try {
    await execute(`ALTER TABLE ehb_pengawas ADD COLUMN jenis_kelamin TEXT NOT NULL DEFAULT 'L'`)
  } catch {
    // Kolom sudah tersedia.
  }

  await execute(`
    CREATE TABLE IF NOT EXISTS ehb_pengawas_config (
      ehb_event_id                 INTEGER PRIMARY KEY REFERENCES ehb_event(id) ON DELETE CASCADE,
      senior_allowed_sesi          TEXT,
      senior_blocked_sesi          TEXT,
      senior_avoid_last_session    INTEGER NOT NULL DEFAULT 1,
      updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export async function getPengawasRuleConfig(eventId: number) {
  await ensurePengawasSchema()

  const row = await queryOne<PengawasRuleRow>(`
    SELECT senior_allowed_sesi, senior_blocked_sesi, senior_avoid_last_session
    FROM ehb_pengawas_config
    WHERE ehb_event_id = ?
  `, [eventId])

  return hydratePengawasRuleConfig(row)
}

export async function upsertPengawasRuleConfig(eventId: number, input: Partial<PengawasRuleConfig>) {
  await ensurePengawasSchema()

  const current = await getPengawasRuleConfig(eventId)
  const next: PengawasRuleConfig = {
    senior_allowed_sesi: normalizeSesiList(input.senior_allowed_sesi ?? current.senior_allowed_sesi),
    senior_blocked_sesi: normalizeSesiList(input.senior_blocked_sesi ?? current.senior_blocked_sesi),
    senior_avoid_last_session: typeof input.senior_avoid_last_session === 'boolean'
      ? input.senior_avoid_last_session
      : current.senior_avoid_last_session,
  }

  await execute(`
    INSERT INTO ehb_pengawas_config (
      ehb_event_id, senior_allowed_sesi, senior_blocked_sesi, senior_avoid_last_session, updated_at
    )
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(ehb_event_id) DO UPDATE SET
      senior_allowed_sesi = excluded.senior_allowed_sesi,
      senior_blocked_sesi = excluded.senior_blocked_sesi,
      senior_avoid_last_session = excluded.senior_avoid_last_session,
      updated_at = datetime('now')
  `, [
    eventId,
    serializeSesiList(next.senior_allowed_sesi),
    serializeSesiList(next.senior_blocked_sesi),
    next.senior_avoid_last_session ? 1 : 0,
  ])

  return next
}

export function getSeniorRuleViolation(config: PengawasRuleConfig, nomorSesi: number, isLastSession: boolean) {
  if (config.senior_allowed_sesi.length > 0 && !config.senior_allowed_sesi.includes(nomorSesi)) {
    return `Pengawas senior hanya boleh di sesi ${config.senior_allowed_sesi.join(', ')}.`
  }

  if (config.senior_blocked_sesi.includes(nomorSesi)) {
    return `Pengawas senior tidak boleh diplot di sesi ${nomorSesi}.`
  }

  if (config.senior_avoid_last_session && isLastSession) {
    return 'Pengawas senior tidak boleh diplot di sesi terakhir pada hari tersebut.'
  }

  return null
}
