'use server'

import { revalidatePath } from 'next/cache'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getSession } from '@/lib/auth/session'
import { batch, execute, query, queryOne } from '@/lib/db'

const FEATURE_PATH = '/dashboard/santri/tes-klasifikasi'
const PAGE_PATH = '/dashboard/santri/tes-klasifikasi/penjadwalan'

export type LevelSekolah = 'SLTA' | 'SLTP'
export type JenisKelamin = 'L' | 'P'

export type SesiInput = {
  id?: number
  tanggal: string
  nomor_sesi: number
  label: string
  waktu_mulai: string
  waktu_selesai: string
}

export type RuanganInput = {
  id?: number
  nomor_ruangan: number
  nama_ruangan: string
  tempat: string
  kapasitas: number
}

export type RuleInput = {
  sesi_id: number
  ruangan_id: number
  jenis_kelamin: JenisKelamin
  levels: LevelSekolah[]
}

export type PetugasInput = {
  sesi_id: number
  ruangan_id: number
  pengetes_guru_id: number | null
  pendamping_guru_id: number | null
}

type SantriPlotRow = {
  id: string
  nis: string
  nama_lengkap: string
  jenis_kelamin: JenisKelamin
  sekolah: string | null
  asrama: string | null
  kamar: string | null
  level: LevelSekolah | 'LAINNYA'
  asrama_rank: number
}

const ASRAMA_ORDER = ['AL-FALAH', 'AS-SALAM', 'BAHAGIA', 'ASY-SYIFA 1', 'ASY-SYIFA 2', 'ASY-SYIFA 3', 'ASY-SYIFA 4']

function normalizeJk(value: unknown): JenisKelamin {
  return String(value).toUpperCase() === 'P' ? 'P' : 'L'
}

function normalizeLevels(value: unknown): LevelSekolah[] {
  const raw = Array.isArray(value) ? value : []
  const unique = new Set<LevelSekolah>()
  raw.forEach(item => {
    const level = String(item).toUpperCase()
    if (level === 'SLTA' || level === 'SLTP') unique.add(level)
  })
  return Array.from(unique)
}

function getLevelSekolah(sekolah: string | null | undefined): SantriPlotRow['level'] {
  const value = String(sekolah || '').toUpperCase().trim()
  if (['MAN', 'SMK', 'SMA'].includes(value)) return 'SLTA'
  if (['MTSU', 'MTSN', 'SMP'].includes(value)) return 'SLTP'
  return 'LAINNYA'
}

function getAsramaRank(asrama: string | null | undefined) {
  const value = String(asrama || '').toUpperCase().trim()
  const index = ASRAMA_ORDER.indexOf(value)
  return index === -1 ? ASRAMA_ORDER.length : index
}

function parseLevelsJson(value: string | null | undefined): LevelSekolah[] {
  try {
    return normalizeLevels(JSON.parse(value || '[]'))
  } catch {
    return []
  }
}

function compareSantri(a: SantriPlotRow, b: SantriPlotRow) {
  if (a.asrama_rank !== b.asrama_rank) return a.asrama_rank - b.asrama_rank
  const asramaCompare = String(a.asrama || '').localeCompare(String(b.asrama || ''), 'id-ID', { sensitivity: 'base', numeric: true })
  if (asramaCompare !== 0) return asramaCompare
  return a.nama_lengkap.localeCompare(b.nama_lengkap, 'id-ID', { sensitivity: 'base', numeric: true })
}

async function ensureSchema() {
  await execute(`
    CREATE TABLE IF NOT EXISTS tes_klasifikasi_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id),
      nama TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS tes_klasifikasi_sesi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
      tanggal TEXT NOT NULL,
      nomor_sesi INTEGER NOT NULL,
      label TEXT NOT NULL,
      waktu_mulai TEXT,
      waktu_selesai TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(event_id, tanggal, nomor_sesi)
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS tes_klasifikasi_ruangan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
      nomor_ruangan INTEGER NOT NULL,
      nama_ruangan TEXT NOT NULL,
      tempat TEXT,
      kapasitas INTEGER NOT NULL DEFAULT 20,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(event_id, nomor_ruangan)
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS tes_klasifikasi_ruangan_petugas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
      sesi_id INTEGER NOT NULL REFERENCES tes_klasifikasi_sesi(id) ON DELETE CASCADE,
      ruangan_id INTEGER NOT NULL REFERENCES tes_klasifikasi_ruangan(id) ON DELETE CASCADE,
      pengetes_guru_id INTEGER REFERENCES data_guru(id),
      pendamping_guru_id INTEGER REFERENCES data_guru(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(event_id, sesi_id, ruangan_id)
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS tes_klasifikasi_plotting_rule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
      sesi_id INTEGER NOT NULL REFERENCES tes_klasifikasi_sesi(id) ON DELETE CASCADE,
      ruangan_id INTEGER NOT NULL REFERENCES tes_klasifikasi_ruangan(id) ON DELETE CASCADE,
      jenis_kelamin TEXT NOT NULL,
      levels_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(event_id, sesi_id, ruangan_id)
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS tes_klasifikasi_plotting (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
      sesi_id INTEGER NOT NULL REFERENCES tes_klasifikasi_sesi(id) ON DELETE CASCADE,
      ruangan_id INTEGER NOT NULL REFERENCES tes_klasifikasi_ruangan(id) ON DELETE CASCADE,
      santri_id TEXT NOT NULL REFERENCES santri(id),
      nomor_urut INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(event_id, santri_id)
    )
  `)
  await batch([
    { sql: 'CREATE INDEX IF NOT EXISTS idx_tk_sesi_event ON tes_klasifikasi_sesi(event_id)' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_tk_ruangan_event ON tes_klasifikasi_ruangan(event_id)' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_tk_petugas_event ON tes_klasifikasi_ruangan_petugas(event_id)' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_tk_rule_event ON tes_klasifikasi_plotting_rule(event_id)' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_tk_plotting_event ON tes_klasifikasi_plotting(event_id)' },
    { sql: 'CREATE INDEX IF NOT EXISTS idx_tk_plotting_santri ON tes_klasifikasi_plotting(santri_id)' },
  ])
}

async function getSantriBaruRows(eventId: number, includePlotted = false) {
  const plottedClause = includePlotted ? '' : 'AND p.id IS NULL'
  const rows = await query<Omit<SantriPlotRow, 'level' | 'asrama_rank'>>(`
    SELECT s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.sekolah, s.asrama, s.kamar
    FROM santri s
    LEFT JOIN tes_klasifikasi_plotting p ON p.santri_id = s.id AND p.event_id = ?
    WHERE s.status_global = 'aktif'
      AND NOT EXISTS (
        SELECT 1 FROM riwayat_pendidikan rp
        WHERE rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
      )
      ${plottedClause}
  `, [eventId])

  return rows.map(row => ({
    ...row,
    jenis_kelamin: normalizeJk(row.jenis_kelamin),
    level: getLevelSekolah(row.sekolah),
    asrama_rank: getAsramaRank(row.asrama),
  })).sort(compareSantri)
}

export async function getPenjadwalanData() {
  await ensureSchema()
  const [activeEvent, allEvents, tahunAjaranList, guruList] = await Promise.all([
    queryOne<any>(`
      SELECT e.*, ta.nama AS tahun_ajaran_nama
      FROM tes_klasifikasi_event e
      LEFT JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
      WHERE e.is_active = 1
      ORDER BY e.id DESC
      LIMIT 1
    `),
    query<any>(`
      SELECT e.*, ta.nama AS tahun_ajaran_nama
      FROM tes_klasifikasi_event e
      LEFT JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
      ORDER BY e.id DESC
    `),
    query<any>('SELECT id, nama, is_active FROM tahun_ajaran ORDER BY id DESC'),
    query<any>('SELECT id, nama_lengkap AS nama FROM data_guru ORDER BY nama_lengkap'),
  ])

  if (!activeEvent) {
    return { activeEvent, allEvents, tahunAjaranList, guruList, sesiList: [], ruanganList: [], rules: [], petugas: [], plotting: [], unplotted: [] }
  }

  const [sesiList, ruanganList, rulesRaw, petugas, plotting, unplotted] = await Promise.all([
    query<any>('SELECT * FROM tes_klasifikasi_sesi WHERE event_id = ? ORDER BY tanggal, nomor_sesi', [activeEvent.id]),
    query<any>(`
      SELECT r.*,
        (SELECT COUNT(*) FROM tes_klasifikasi_plotting p WHERE p.ruangan_id = r.id) AS total_peserta
      FROM tes_klasifikasi_ruangan r
      WHERE r.event_id = ?
      ORDER BY r.nomor_ruangan
    `, [activeEvent.id]),
    query<any>('SELECT * FROM tes_klasifikasi_plotting_rule WHERE event_id = ?', [activeEvent.id]),
    query<any>('SELECT * FROM tes_klasifikasi_ruangan_petugas WHERE event_id = ?', [activeEvent.id]),
    getPlottingRows(activeEvent.id),
    getUnplottedSantri(activeEvent.id, {}),
  ])

  const rules = rulesRaw.map(rule => ({ ...rule, levels: parseLevelsJson(rule.levels_json) }))
  return { activeEvent, allEvents, tahunAjaranList, guruList, sesiList, ruanganList, rules, petugas, plotting, unplotted }
}

export async function createEvent(input: { tahun_ajaran_id: number; nama: string }) {
  await ensureSchema()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const nama = input.nama.trim()
  if (!nama) return { error: 'Nama event wajib diisi.' }
  if (!input.tahun_ajaran_id) return { error: 'Tahun ajaran wajib dipilih.' }

  await execute('UPDATE tes_klasifikasi_event SET is_active = 0, updated_at = datetime(\'now\')')
  await execute(
    'INSERT INTO tes_klasifikasi_event (tahun_ajaran_id, nama, is_active) VALUES (?, ?, 1)',
    [input.tahun_ajaran_id, nama]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'tes_klasifikasi_penjadwalan',
    action: 'create',
    fiturHref: FEATURE_PATH,
    logKind: 'create',
    entityType: 'tes_klasifikasi_event',
    entityLabel: nama,
    summary: `Membuat event tes klasifikasi ${nama}`,
  })
  revalidatePath(PAGE_PATH)
  return { success: true }
}

export async function setActiveEvent(eventId: number) {
  await ensureSchema()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await execute('UPDATE tes_klasifikasi_event SET is_active = 0, updated_at = datetime(\'now\')')
  await execute('UPDATE tes_klasifikasi_event SET is_active = 1, updated_at = datetime(\'now\') WHERE id = ?', [eventId])
  revalidatePath(PAGE_PATH)
  return { success: true }
}

export async function saveSesi(eventId: number, sesiList: SesiInput[]) {
  await ensureSchema()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const clean = sesiList
    .map((s, index) => ({
      ...s,
      nomor_sesi: Number(s.nomor_sesi || index + 1),
      tanggal: String(s.tanggal || '').trim(),
      label: String(s.label || `Sesi ${index + 1}`).trim(),
      waktu_mulai: String(s.waktu_mulai || '').trim(),
      waktu_selesai: String(s.waktu_selesai || '').trim(),
    }))
    .filter(s => s.tanggal)
  if (clean.length === 0) return { error: 'Minimal satu sesi bertanggal wajib diisi.' }

  const oldRows = await query<{ id: number }>('SELECT id FROM tes_klasifikasi_sesi WHERE event_id = ?', [eventId])
  const currentIds = new Set(clean.map(s => s.id).filter(Boolean))
  const deletedIds = oldRows.map(r => r.id).filter(id => !currentIds.has(id))
  const stmts: { sql: string; params?: unknown[] }[] = deletedIds.flatMap(id => ([
    { sql: 'DELETE FROM tes_klasifikasi_plotting WHERE event_id = ? AND sesi_id = ?', params: [eventId, id] },
    { sql: 'DELETE FROM tes_klasifikasi_ruangan_petugas WHERE event_id = ? AND sesi_id = ?', params: [eventId, id] },
    { sql: 'DELETE FROM tes_klasifikasi_plotting_rule WHERE event_id = ? AND sesi_id = ?', params: [eventId, id] },
    { sql: 'DELETE FROM tes_klasifikasi_sesi WHERE event_id = ? AND id = ?', params: [eventId, id] },
  ]))

  clean.forEach(s => {
    if (s.id) {
      stmts.push({
        sql: `UPDATE tes_klasifikasi_sesi
              SET tanggal = ?, nomor_sesi = ?, label = ?, waktu_mulai = ?, waktu_selesai = ?, updated_at = datetime('now')
              WHERE id = ? AND event_id = ?`,
        params: [s.tanggal, s.nomor_sesi, s.label, s.waktu_mulai, s.waktu_selesai, s.id, eventId],
      })
    } else {
      stmts.push({
        sql: `INSERT INTO tes_klasifikasi_sesi (event_id, tanggal, nomor_sesi, label, waktu_mulai, waktu_selesai)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [eventId, s.tanggal, s.nomor_sesi, s.label, s.waktu_mulai, s.waktu_selesai],
      })
    }
  })

  await batch(stmts)
  await logActivity({
    actor: actorFromSession(session),
    module: 'tes_klasifikasi_penjadwalan',
    action: 'update',
    fiturHref: FEATURE_PATH,
    logKind: 'update',
    entityType: 'tes_klasifikasi_sesi_batch',
    entityId: String(eventId),
    entityLabel: 'Sesi tes klasifikasi',
    summary: `Menyimpan ${clean.length} sesi tes klasifikasi`,
  })
  revalidatePath(PAGE_PATH)
  return { success: true }
}

export async function saveRuangan(eventId: number, ruanganList: RuanganInput[]) {
  await ensureSchema()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const clean = ruanganList
    .map((r, index) => ({
      ...r,
      nomor_ruangan: Number(r.nomor_ruangan || index + 1),
      nama_ruangan: String(r.nama_ruangan || `Ruang ${index + 1}`).trim(),
      tempat: String(r.tempat || '').trim(),
      kapasitas: Math.max(1, Number(r.kapasitas || 1)),
    }))
    .filter(r => r.nama_ruangan)
  if (clean.length === 0) return { error: 'Minimal satu ruangan wajib diisi.' }

  const oldRows = await query<{ id: number }>('SELECT id FROM tes_klasifikasi_ruangan WHERE event_id = ?', [eventId])
  const currentIds = new Set(clean.map(r => r.id).filter(Boolean))
  const deletedIds = oldRows.map(r => r.id).filter(id => !currentIds.has(id))
  const stmts: { sql: string; params?: unknown[] }[] = deletedIds.flatMap(id => ([
    { sql: 'DELETE FROM tes_klasifikasi_plotting WHERE event_id = ? AND ruangan_id = ?', params: [eventId, id] },
    { sql: 'DELETE FROM tes_klasifikasi_ruangan_petugas WHERE event_id = ? AND ruangan_id = ?', params: [eventId, id] },
    { sql: 'DELETE FROM tes_klasifikasi_plotting_rule WHERE event_id = ? AND ruangan_id = ?', params: [eventId, id] },
    { sql: 'DELETE FROM tes_klasifikasi_ruangan WHERE event_id = ? AND id = ?', params: [eventId, id] },
  ]))

  clean.forEach(r => {
    if (r.id) {
      stmts.push({
        sql: `UPDATE tes_klasifikasi_ruangan
              SET nomor_ruangan = ?, nama_ruangan = ?, tempat = ?, kapasitas = ?, updated_at = datetime('now')
              WHERE id = ? AND event_id = ?`,
        params: [r.nomor_ruangan, r.nama_ruangan, r.tempat, r.kapasitas, r.id, eventId],
      })
    } else {
      stmts.push({
        sql: `INSERT INTO tes_klasifikasi_ruangan (event_id, nomor_ruangan, nama_ruangan, tempat, kapasitas)
              VALUES (?, ?, ?, ?, ?)`,
        params: [eventId, r.nomor_ruangan, r.nama_ruangan, r.tempat, r.kapasitas],
      })
    }
  })

  await batch(stmts)
  revalidatePath(PAGE_PATH)
  return { success: true }
}

export async function saveRulesAndPetugas(eventId: number, rules: RuleInput[], petugas: PetugasInput[]) {
  await ensureSchema()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const stmts: { sql: string; params?: unknown[] }[] = [
    { sql: 'DELETE FROM tes_klasifikasi_plotting_rule WHERE event_id = ?', params: [eventId] },
    { sql: 'DELETE FROM tes_klasifikasi_ruangan_petugas WHERE event_id = ?', params: [eventId] },
  ]

  rules.forEach(rule => {
    const levels = normalizeLevels(rule.levels)
    if (!rule.sesi_id || !rule.ruangan_id || levels.length === 0) return
    stmts.push({
      sql: `INSERT INTO tes_klasifikasi_plotting_rule (event_id, sesi_id, ruangan_id, jenis_kelamin, levels_json)
            VALUES (?, ?, ?, ?, ?)`,
      params: [eventId, rule.sesi_id, rule.ruangan_id, normalizeJk(rule.jenis_kelamin), JSON.stringify(levels)],
    })
  })

  petugas.forEach(row => {
    if (!row.sesi_id || !row.ruangan_id) return
    stmts.push({
      sql: `INSERT INTO tes_klasifikasi_ruangan_petugas
              (event_id, sesi_id, ruangan_id, pengetes_guru_id, pendamping_guru_id)
            VALUES (?, ?, ?, ?, ?)`,
      params: [eventId, row.sesi_id, row.ruangan_id, row.pengetes_guru_id || null, row.pendamping_guru_id || null],
    })
  })

  await batch(stmts)
  await logActivity({
    actor: actorFromSession(session),
    module: 'tes_klasifikasi_penjadwalan',
    action: 'update',
    fiturHref: FEATURE_PATH,
    logKind: 'update',
    entityType: 'tes_klasifikasi_rule_petugas_batch',
    entityId: String(eventId),
    entityLabel: 'Rule dan petugas tes klasifikasi',
    summary: 'Menyimpan rule plotting dan petugas tes klasifikasi',
  })
  revalidatePath(PAGE_PATH)
  return { success: true }
}

export async function resetPlotting(eventId: number) {
  await ensureSchema()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await execute('DELETE FROM tes_klasifikasi_plotting WHERE event_id = ?', [eventId])
  revalidatePath(PAGE_PATH)
  return { success: true }
}

export async function autoPlotting(eventId: number) {
  await ensureSchema()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const [rulesRaw, rooms] = await Promise.all([
    query<any>(`
      SELECT pr.*, s.tanggal, s.nomor_sesi, r.nomor_ruangan, r.kapasitas
      FROM tes_klasifikasi_plotting_rule pr
      JOIN tes_klasifikasi_sesi s ON s.id = pr.sesi_id
      JOIN tes_klasifikasi_ruangan r ON r.id = pr.ruangan_id
      WHERE pr.event_id = ?
      ORDER BY s.tanggal, s.nomor_sesi, r.nomor_ruangan
    `, [eventId]),
    query<any>('SELECT id FROM tes_klasifikasi_ruangan WHERE event_id = ?', [eventId]),
  ])
  if (rulesRaw.length === 0 || rooms.length === 0) return { error: 'Atur sesi, ruangan, dan rule plotting dulu.' }

  await execute('DELETE FROM tes_klasifikasi_plotting WHERE event_id = ?', [eventId])
  const santri = await getSantriBaruRows(eventId, false)
  const buckets = new Map<string, SantriPlotRow[]>()
  ;(['L', 'P'] as JenisKelamin[]).forEach(jk => {
    ;(['SLTA', 'SLTP', 'LAINNYA'] as SantriPlotRow['level'][]).forEach(level => {
      buckets.set(`${jk}:${level}`, santri.filter(row => row.jenis_kelamin === jk && row.level === level).sort(compareSantri))
    })
  })

  const stmts: { sql: string; params: unknown[] }[] = []
  let nomorUrut = 1
  for (const rule of rulesRaw) {
    const levels = parseLevelsJson(rule.levels_json)
    let terisi = 0
    for (const level of levels) {
      const bucket = buckets.get(`${normalizeJk(rule.jenis_kelamin)}:${level}`) || []
      while (bucket.length > 0 && terisi < Number(rule.kapasitas || 0)) {
        const picked = bucket.shift()
        if (!picked) break
        stmts.push({
          sql: `INSERT INTO tes_klasifikasi_plotting (event_id, sesi_id, ruangan_id, santri_id, nomor_urut)
                VALUES (?, ?, ?, ?, ?)`,
          params: [eventId, rule.sesi_id, rule.ruangan_id, picked.id, nomorUrut++],
        })
        terisi++
      }
      if (terisi >= Number(rule.kapasitas || 0)) break
    }
  }

  if (stmts.length > 0) await batch(stmts)
  await logActivity({
    actor: actorFromSession(session),
    module: 'tes_klasifikasi_penjadwalan',
    action: 'update',
    fiturHref: FEATURE_PATH,
    logKind: 'update',
    entityType: 'tes_klasifikasi_plotting_batch',
    entityId: String(eventId),
    entityLabel: 'Auto plotting tes klasifikasi',
    summary: `Auto plotting ${stmts.length} peserta tes klasifikasi`,
  })
  revalidatePath(PAGE_PATH)
  return { success: true, count: stmts.length }
}

export async function getUnplottedSantri(eventId: number, filters: { search?: string; jenis_kelamin?: string; level?: string; asrama?: string }) {
  await ensureSchema()
  let rows = await getSantriBaruRows(eventId, false)
  const search = String(filters.search || '').trim().toLowerCase()
  const jk = String(filters.jenis_kelamin || '').toUpperCase()
  const level = String(filters.level || '').toUpperCase()
  const asrama = String(filters.asrama || '').toUpperCase()

  if (search) rows = rows.filter(row => row.nama_lengkap.toLowerCase().includes(search) || row.nis.toLowerCase().includes(search))
  if (jk === 'L' || jk === 'P') rows = rows.filter(row => row.jenis_kelamin === jk)
  if (level) rows = rows.filter(row => row.level === level)
  if (asrama) rows = rows.filter(row => String(row.asrama || '').toUpperCase() === asrama)
  return rows.slice(0, 100)
}

export async function tambahPesertaManual(eventId: number, sesiId: number, ruanganId: number, santriId: string) {
  await ensureSchema()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const [santri, existing, rule, room] = await Promise.all([
    queryOne<any>(`
      SELECT s.id, s.nama_lengkap, s.jenis_kelamin, s.sekolah
      FROM santri s
      WHERE s.id = ?
        AND s.status_global = 'aktif'
        AND NOT EXISTS (
          SELECT 1 FROM riwayat_pendidikan rp
          WHERE rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        )
    `, [santriId]),
    queryOne<any>('SELECT id FROM tes_klasifikasi_plotting WHERE event_id = ? AND santri_id = ?', [eventId, santriId]),
    queryOne<any>('SELECT * FROM tes_klasifikasi_plotting_rule WHERE event_id = ? AND sesi_id = ? AND ruangan_id = ?', [eventId, sesiId, ruanganId]),
    queryOne<any>('SELECT * FROM tes_klasifikasi_ruangan WHERE event_id = ? AND id = ?', [eventId, ruanganId]),
  ])

  if (!santri) return { error: 'Santri tidak ditemukan atau sudah punya kelas.' }
  if (existing) return { error: 'Santri ini sudah terplot.' }
  if (!rule) return { error: 'Ruangan/sesi tujuan belum punya rule plotting.' }
  if (!room) return { error: 'Ruangan tujuan tidak ditemukan.' }
  if (normalizeJk(santri.jenis_kelamin) !== normalizeJk(rule.jenis_kelamin)) return { error: 'Jenis kelamin santri tidak cocok dengan ruangan tujuan.' }

  const capacity = Number(room.kapasitas || 0)
  const count = await queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM tes_klasifikasi_plotting WHERE event_id = ? AND sesi_id = ? AND ruangan_id = ?',
    [eventId, sesiId, ruanganId]
  )
  if (Number(count?.total || 0) >= capacity) return { error: 'Ruangan tujuan sudah penuh.' }

  const maxNo = await queryOne<{ nomor_urut: number | null }>('SELECT MAX(nomor_urut) AS nomor_urut FROM tes_klasifikasi_plotting WHERE event_id = ?', [eventId])
  await execute(
    `INSERT INTO tes_klasifikasi_plotting (event_id, sesi_id, ruangan_id, santri_id, nomor_urut)
     VALUES (?, ?, ?, ?, ?)`,
    [eventId, sesiId, ruanganId, santriId, Number(maxNo?.nomor_urut || 0) + 1]
  )
  await logActivity({
    actor: actorFromSession(session),
    module: 'tes_klasifikasi_penjadwalan',
    action: 'create',
    fiturHref: FEATURE_PATH,
    logKind: 'create',
    entityType: 'tes_klasifikasi_plotting',
    entityId: `${eventId}:${santriId}`,
    entityLabel: santri.nama_lengkap,
    summary: `Menambahkan ${santri.nama_lengkap} ke plotting tes klasifikasi`,
    details: { sesi_id: sesiId, ruangan_id: ruanganId },
  })
  revalidatePath(PAGE_PATH)
  return { success: true }
}

export async function hapusPlotting(plottingId: number) {
  await ensureSchema()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  await execute('DELETE FROM tes_klasifikasi_plotting WHERE id = ?', [plottingId])
  revalidatePath(PAGE_PATH)
  return { success: true }
}

export async function getPlottingRows(eventId: number) {
  await ensureSchema()
  return query<any>(`
    SELECT p.*, s.tanggal, s.nomor_sesi, s.label AS sesi_label, s.waktu_mulai, s.waktu_selesai,
           r.nomor_ruangan, r.nama_ruangan, r.tempat, r.kapasitas,
           san.nis, san.nama_lengkap, san.jenis_kelamin, san.sekolah, san.asrama, san.kamar
    FROM tes_klasifikasi_plotting p
    JOIN tes_klasifikasi_sesi s ON s.id = p.sesi_id
    JOIN tes_klasifikasi_ruangan r ON r.id = p.ruangan_id
    JOIN santri san ON san.id = p.santri_id
    WHERE p.event_id = ?
    ORDER BY s.tanggal, s.nomor_sesi, r.nomor_ruangan, p.nomor_urut
  `, [eventId])
}

export async function getCetakJadwalData(eventId: number) {
  await ensureSchema()
  const event = await queryOne<any>(`
    SELECT e.*, ta.nama AS tahun_ajaran_nama
    FROM tes_klasifikasi_event e
    LEFT JOIN tahun_ajaran ta ON ta.id = e.tahun_ajaran_id
    WHERE e.id = ?
  `, [eventId])
  const rows = await getPlottingRows(eventId)
  return { event, rows }
}
