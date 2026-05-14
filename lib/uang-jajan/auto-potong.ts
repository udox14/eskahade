export type AutoPotongResult = {
  date: string
  checkedRules: number
  eligibleSantri: number
  skipped: number
  deducted: number
  totalNominal: number
}

type RuleRow = {
  id: string
  scope_type: 'ASRAMA' | 'KAMAR' | 'SANTRI'
  asrama: string | null
  kamar: string | null
  santri_id: string | null
  nominal: number
  jam: string
  days: string
  updated_at: string | null
}

type SantriRow = {
  id: string
  nama_lengkap: string
  asrama: string | null
  kamar: string | null
  saldo_uang_jajan: number
}

type ExistingLogRow = {
  santri_id: string
}

type SkipRow = {
  santri_id: string
}

type Statement = {
  sql: string
  params: unknown[]
}

const WIB_TIME_ZONE = 'Asia/Jakarta'

function getWibSnapshot(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now)

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const time = `${get('hour')}:${get('minute')}`
  const weekday = get('weekday')
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

  return { date, time, day: weekdayMap[weekday] ?? now.getUTCDay() }
}

function parseDays(days: string) {
  try {
    const parsed = JSON.parse(days) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
  } catch {
    return []
  }
}

function rulePriority(rule: RuleRow) {
  if (rule.scope_type === 'SANTRI') return 3
  if (rule.scope_type === 'KAMAR') return 2
  return 1
}

function ruleMatchesSantri(rule: RuleRow, santri: SantriRow) {
  if (rule.scope_type === 'SANTRI') return rule.santri_id === santri.id
  if (rule.scope_type === 'KAMAR') return rule.asrama === santri.asrama && rule.kamar === santri.kamar
  return rule.scope_type === 'ASRAMA' && rule.asrama === santri.asrama
}

async function queryAll<T>(db: D1Database, sql: string, params: unknown[] = []) {
  const { results } = await db.prepare(sql).bind(...params).all<T>()
  return results ?? []
}

async function runBatch(db: D1Database, statements: Statement[]) {
  const chunkSize = 80
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize)
    await db.batch(chunk.map(stmt => db.prepare(stmt.sql).bind(...stmt.params)))
  }
}

export async function runUangJajanAutoPotong(db: D1Database, now = new Date()): Promise<AutoPotongResult> {
  const wib = getWibSnapshot(now)

  const rules = await queryAll<RuleRow>(
    db,
    `SELECT id, scope_type, asrama, kamar, santri_id, nominal, jam, days, updated_at
     FROM uang_jajan_auto_rule
     WHERE is_active = 1 AND nominal > 0 AND jam <= ?
     ORDER BY updated_at DESC, created_at DESC`,
    [wib.time]
  )

  const activeRules = rules
    .filter(rule => parseDays(rule.days).includes(wib.day))
    .sort((a, b) => rulePriority(b) - rulePriority(a) || String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))

  if (!activeRules.length) {
    return { date: wib.date, checkedRules: rules.length, eligibleSantri: 0, skipped: 0, deducted: 0, totalNominal: 0 }
  }

  const santriRows = await queryAll<SantriRow>(
    db,
    `SELECT id, nama_lengkap, asrama, kamar, COALESCE(saldo_uang_jajan, 0) AS saldo_uang_jajan
     FROM santri
     WHERE status_global = 'aktif' AND asrama IS NOT NULL AND asrama != 'AL-BAGHORY'`
  )

  const skips = new Set(
    (await queryAll<SkipRow>(db, 'SELECT santri_id FROM uang_jajan_auto_skip WHERE skip_date = ?', [wib.date]))
      .map(row => row.santri_id)
  )
  const existingLogs = new Set(
    (await queryAll<ExistingLogRow>(
      db,
      `SELECT santri_id FROM tabungan_log
       WHERE source = 'AUTO_POTONG' AND run_date = ? AND dompet = 'JAJAN'`,
      [wib.date]
    )).map(row => row.santri_id)
  )

  const statements: Statement[] = []
  let eligibleSantri = 0
  let skipped = 0
  let deducted = 0
  let totalNominal = 0
  const nowIso = now.toISOString()

  for (const santri of santriRows) {
    const rule = activeRules.find(item => ruleMatchesSantri(item, santri))
    if (!rule) continue
    eligibleSantri += 1

    if (skips.has(santri.id) || existingLogs.has(santri.id)) {
      skipped += 1
      continue
    }

    const nominal = Math.min(Math.max(0, santri.saldo_uang_jajan), rule.nominal)
    if (nominal <= 0) {
      skipped += 1
      continue
    }

    statements.push({
      sql: `INSERT INTO tabungan_log
            (id, santri_id, jenis, nominal, keterangan, created_by, created_at, dompet, source, auto_rule_id, run_date)
            VALUES (?, ?, 'KELUAR', ?, ?, NULL, ?, 'JAJAN', 'AUTO_POTONG', ?, ?)`,
      params: [crypto.randomUUID(), santri.id, nominal, `Auto potong uang jajan ${wib.date}`, nowIso, rule.id, wib.date],
    })
    statements.push({
      sql: `UPDATE santri
            SET saldo_uang_jajan = MAX(COALESCE(saldo_uang_jajan, 0) - ?, 0)
            WHERE id = ?`,
      params: [nominal, santri.id],
    })

    deducted += 1
    totalNominal += nominal
  }

  if (statements.length > 0) await runBatch(db, statements)

  return {
    date: wib.date,
    checkedRules: rules.length,
    eligibleSantri,
    skipped,
    deducted,
    totalNominal,
  }
}
