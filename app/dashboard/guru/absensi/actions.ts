'use server'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { getGuruIdForSession, getSantriForKelas } from '@/lib/akademik/guru-access'
import { getSession, hasAnyRole, hasRole, isAdmin, type SessionUser } from '@/lib/auth/session'
import { batch, execute, generateId, query, queryOne } from '@/lib/db'
import { toWibDateInputValue } from '@/lib/date/wib'

export const WAKTU_PENGAJIAN = ['shubuh', 'ashar', 'maghrib'] as const
export const STATUS_ABSENSI_PENGAJAR = ['H', 'S', 'I', 'A'] as const
export type WaktuPengajian = typeof WAKTU_PENGAJIAN[number]
export type StatusAbsensiPengajar = typeof STATUS_ABSENSI_PENGAJAR[number]

export type AbsensiPengajarSession = {
  id: string
  tanggal: string
  waktu: WaktuPengajian
  created_by: string
  creator_name: string
  editable: boolean
}

export type AbsensiPengajarStudent = {
  riwayat_id: string
  nama: string
  nis: string | null
  asrama: string | null
  kamar: string | null
}

export type AbsensiPengajarStats = {
  totalSesi: number
  hadir: number
  sakit: number
  izin: number
  alfa: number
  persentaseHadir: number
}

type SessionRow = Omit<AbsensiPengajarSession, 'editable'> & {
  kelas_id?: string
  created_at?: string
}

type StatsRow = {
  total_sesi: number | null
  hadir: number | null
  sakit: number | null
  izin: number | null
  alfa: number | null
  total_detail: number | null
}

type DetailRow = AbsensiPengajarStudent & {
  sesi_id: string
  status: StatusAbsensiPengajar
}

let schemaReady: Promise<void> | null = null

async function ensureSchema() {
  schemaReady ??= (async () => {
    await execute(`CREATE TABLE IF NOT EXISTS absensi_pengajar_sesi (
      id TEXT PRIMARY KEY, kelas_id TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
      guru_id INTEGER REFERENCES data_guru(id) ON DELETE SET NULL,
      tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id) ON DELETE SET NULL,
      tanggal TEXT NOT NULL, waktu TEXT NOT NULL CHECK (waktu IN ('shubuh','ashar','maghrib')),
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(kelas_id, created_by, tanggal, waktu)
    )`)
    await execute(`CREATE TABLE IF NOT EXISTS absensi_pengajar_detail (
      id TEXT PRIMARY KEY, sesi_id TEXT NOT NULL REFERENCES absensi_pengajar_sesi(id) ON DELETE CASCADE,
      riwayat_pendidikan_id TEXT NOT NULL REFERENCES riwayat_pendidikan(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'H' CHECK (status IN ('H','S','I','A')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(sesi_id, riwayat_pendidikan_id)
    )`)
    await execute('CREATE INDEX IF NOT EXISTS idx_absensi_pengajar_sesi_owner ON absensi_pengajar_sesi(created_by, kelas_id, tanggal DESC, created_at DESC)')
    await execute('CREATE INDEX IF NOT EXISTS idx_absensi_pengajar_sesi_kelas ON absensi_pengajar_sesi(kelas_id, tanggal DESC, created_at DESC, id)')
    await execute('CREATE INDEX IF NOT EXISTS idx_absensi_pengajar_detail_sesi ON absensi_pengajar_detail(sesi_id, riwayat_pendidikan_id)')
  })().catch(error => {
    schemaReady = null
    throw error
  })
  await schemaReady
}

function isWaktu(value: unknown): value is WaktuPengajian {
  return WAKTU_PENGAJIAN.includes(value as WaktuPengajian)
}

function isStatus(value: unknown): value is StatusAbsensiPengajar {
  return STATUS_ABSENSI_PENGAJAR.includes(value as StatusAbsensiPengajar)
}

function canViewAll(session: SessionUser) {
  return isAdmin(session) || hasAnyRole(session, ['akademik', 'sekpen'])
}

function sessionScope(session: SessionUser, alias = 'aps') {
  return canViewAll(session) ? { sql: '', params: [] as unknown[] } : { sql: `AND ${alias}.created_by = ?`, params: [session.id] }
}

async function getAccessibleKelasForAbsensi(session: SessionUser): Promise<{ id: string; nama_kelas: string }[]> {
  if (canViewAll(session)) {
    return query<{ id: string; nama_kelas: string }>(`SELECT k.id, k.nama_kelas
      FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      ORDER BY k.nama_kelas`)
  }

  const guruId = await getGuruIdForSession(session)
  if (!guruId) {
    if (!hasRole(session, 'wali_kelas')) return []
    return query<{ id: string; nama_kelas: string }>(`SELECT k.id, k.nama_kelas
      FROM kelas k
      JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
      WHERE k.wali_kelas_id = ?
      ORDER BY k.nama_kelas`, [session.id])
  }

  return query<{ id: string; nama_kelas: string }>(`SELECT DISTINCT k.id, k.nama_kelas
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN kelas_jadwal_guru_mingguan kj ON kj.kelas_id = k.id AND kj.guru_id = ?
    WHERE kj.id IS NOT NULL
       OR k.guru_shubuh_id = ?
       OR k.guru_ashar_id = ?
       OR k.guru_maghrib_id = ?
       OR k.wali_kelas_id = ?
    ORDER BY k.nama_kelas`, [guruId, guruId, guruId, guruId, session.id])
}

async function canAccessKelasForAbsensi(session: SessionUser, kelasId: string) {
  return (await getAccessibleKelasForAbsensi(session)).some(kelas => kelas.id === kelasId)
}

export async function getAbsensiPengajarInitialData() {
  const session = await getSession()
  if (!session) return { kelas: [], canViewAll: false }
  return { kelas: await getAccessibleKelasForAbsensi(session), canViewAll: canViewAll(session) }
}

export async function openOrCreateAbsensiPengajarSession(kelasId: string, waktu: WaktuPengajian) {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi.' }
  if (!isWaktu(waktu)) return { error: 'Waktu pengajian tidak valid.' }
  if (!(await canAccessKelasForAbsensi(session, kelasId))) return { error: 'Akses kelas ditolak.' }
  await ensureSchema()

  const tanggal = toWibDateInputValue()
  const kelas = await queryOne<{ tahun_ajaran_id: number | null }>('SELECT tahun_ajaran_id FROM kelas WHERE id = ?', [kelasId])
  if (!kelas) return { error: 'Kelas tidak ditemukan.' }

  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM absensi_pengajar_sesi WHERE kelas_id = ? AND created_by = ? AND tanggal = ? AND waktu = ?',
    [kelasId, session.id, tanggal, waktu]
  )
  let sesiId = existing?.id || generateId()
  let created = false

  if (!existing) {
    const guruId = await getGuruIdForSession(session)
    await execute(`INSERT INTO absensi_pengajar_sesi
      (id, kelas_id, guru_id, tahun_ajaran_id, tanggal, waktu, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(kelas_id, created_by, tanggal, waktu) DO NOTHING`,
    [sesiId, kelasId, guruId, kelas.tahun_ajaran_id, tanggal, waktu, session.id])

    const resolved = await queryOne<{ id: string }>(
      'SELECT id FROM absensi_pengajar_sesi WHERE kelas_id = ? AND created_by = ? AND tanggal = ? AND waktu = ?',
      [kelasId, session.id, tanggal, waktu]
    )
    if (!resolved) return { error: 'Sesi absensi gagal dibuat.' }
    created = resolved.id === sesiId
    sesiId = resolved.id
  }

  const santri = created ? await getSantriForKelas(kelasId) : []
  if (created && santri.length) {
    await batch(santri.map(row => ({
      sql: `INSERT OR IGNORE INTO absensi_pengajar_detail
        (id, sesi_id, riwayat_pendidikan_id, status) VALUES (?, ?, ?, 'H')`,
      params: [generateId(), sesiId, row.riwayat_id],
    })))
  }

  if (created) {
    await logActivity({
      actor: actorFromSession(session), module: 'absensi_pengajar', action: 'create',
      fiturHref: '/dashboard/guru/absensi', logKind: 'create', entityType: 'absensi_pengajar_sesi',
      entityId: sesiId, entityLabel: `${tanggal} ${waktu}`,
      summary: `Membuat catatan absensi pengajar ${waktu} tanggal ${tanggal}`,
      details: { kelas_id: kelasId, jumlah_santri: santri.length },
    })
  }
  return getAbsensiPengajarSession(sesiId, kelasId)
}

export async function getAbsensiPengajarSession(sesiId: string, kelasId: string) {
  const session = await getSession()
  if (!session || !(await canAccessKelasForAbsensi(session, kelasId))) return { error: 'Akses ditolak.' }
  await ensureSchema()
  const scope = sessionScope(session)
  const sesi = await queryOne<SessionRow>(`SELECT aps.id, aps.kelas_id, aps.tanggal, aps.waktu, aps.created_by,
      COALESCE(u.full_name, u.email, 'Pengajar') AS creator_name
    FROM absensi_pengajar_sesi aps LEFT JOIN users u ON u.id = aps.created_by
    WHERE aps.id = ? AND aps.kelas_id = ? ${scope.sql}`, [sesiId, kelasId, ...scope.params])
  if (!sesi) return { error: 'Sesi tidak ditemukan.' }
  const rows = await query<AbsensiPengajarStudent & { status: StatusAbsensiPengajar }>(`
    SELECT apd.riwayat_pendidikan_id AS riwayat_id, s.nama_lengkap AS nama, s.nis, s.asrama, s.kamar, apd.status
    FROM absensi_pengajar_detail apd
    JOIN riwayat_pendidikan rp ON rp.id = apd.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    WHERE apd.sesi_id = ? ORDER BY s.nama_lengkap`, [sesiId])
  return {
    success: true as const,
    session: { ...sesi, editable: sesi.created_by === session.id || isAdmin(session) } as AbsensiPengajarSession,
    students: rows.map(row => ({ riwayat_id: row.riwayat_id, nama: row.nama, nis: row.nis, asrama: row.asrama, kamar: row.kamar })),
    statuses: Object.fromEntries(rows.map(row => [row.riwayat_id, row.status])) as Record<string, StatusAbsensiPengajar>,
  }
}

export async function saveAbsensiPengajarChanges(payload: {
  sesiId: string
  kelasId: string
  changes: { riwayatId: string; status: StatusAbsensiPengajar }[]
}) {
  const session = await getSession()
  if (!session || !(await canAccessKelasForAbsensi(session, payload.kelasId))) return { error: 'Akses ditolak.' }
  await ensureSchema()
  const sesi = await queryOne<{ id: string; created_by: string }>(
    'SELECT id, created_by FROM absensi_pengajar_sesi WHERE id = ? AND kelas_id = ?',
    [payload.sesiId, payload.kelasId]
  )
  if (!sesi) return { error: 'Sesi tidak ditemukan.' }
  if (sesi.created_by !== session.id && !isAdmin(session)) return { error: 'Sesi ini hanya dapat dibaca.' }

  const clean = payload.changes.filter(change => change.riwayatId && isStatus(change.status))
  if (!clean.length) return { success: true, count: 0 }
  const allowedRows = await query<{ riwayat_pendidikan_id: string }>(
    `SELECT riwayat_pendidikan_id FROM absensi_pengajar_detail WHERE sesi_id = ?
     AND riwayat_pendidikan_id IN (${clean.map(() => '?').join(',')})`,
    [payload.sesiId, ...clean.map(change => change.riwayatId)]
  )
  const allowed = new Set(allowedRows.map(row => row.riwayat_pendidikan_id))
  const updates = clean.filter(change => allowed.has(change.riwayatId))
  if (updates.length) {
    await batch(updates.map(change => ({
      sql: `UPDATE absensi_pengajar_detail SET status = ?, updated_at = datetime('now')
            WHERE sesi_id = ? AND riwayat_pendidikan_id = ?`,
      params: [change.status, payload.sesiId, change.riwayatId],
    })))
    await execute("UPDATE absensi_pengajar_sesi SET updated_at = datetime('now') WHERE id = ?", [payload.sesiId])
    await logActivity({
      actor: actorFromSession(session), module: 'absensi_pengajar', action: 'update',
      fiturHref: '/dashboard/guru/absensi', logKind: 'update', entityType: 'absensi_pengajar_sesi',
      entityId: payload.sesiId, entityLabel: payload.sesiId,
      summary: `Memperbarui ${updates.length} catatan absensi pengajar`, details: { kelas_id: payload.kelasId },
    })
  }
  return { success: true, count: updates.length }
}

export async function getAbsensiPengajarStats(kelasId: string): Promise<AbsensiPengajarStats | { error: string }> {
  const session = await getSession()
  if (!session || !(await canAccessKelasForAbsensi(session, kelasId))) return { error: 'Akses ditolak.' }
  await ensureSchema()
  const scope = sessionScope(session)
  const row = await queryOne<StatsRow>(`SELECT COUNT(DISTINCT aps.id) AS total_sesi,
      SUM(CASE WHEN apd.status = 'H' THEN 1 ELSE 0 END) AS hadir,
      SUM(CASE WHEN apd.status = 'S' THEN 1 ELSE 0 END) AS sakit,
      SUM(CASE WHEN apd.status = 'I' THEN 1 ELSE 0 END) AS izin,
      SUM(CASE WHEN apd.status = 'A' THEN 1 ELSE 0 END) AS alfa, COUNT(apd.id) AS total_detail
    FROM absensi_pengajar_sesi aps LEFT JOIN absensi_pengajar_detail apd ON apd.sesi_id = aps.id
    WHERE aps.kelas_id = ? ${scope.sql}`, [kelasId, ...scope.params])
  const total = Number(row?.total_detail || 0)
  const hadir = Number(row?.hadir || 0)
  return { totalSesi: Number(row?.total_sesi || 0), hadir, sakit: Number(row?.sakit || 0),
    izin: Number(row?.izin || 0), alfa: Number(row?.alfa || 0),
    persentaseHadir: total ? Math.round((hadir / total) * 1000) / 10 : 0 }
}

export async function getAbsensiPengajarRecapPage(kelasId: string, cursor?: string | null, limit = 8) {
  const session = await getSession()
  if (!session || !(await canAccessKelasForAbsensi(session, kelasId))) return { error: 'Akses ditolak.' }
  await ensureSchema()
  const scope = sessionScope(session)
  const pageSize = Math.max(1, Math.min(16, Math.round(limit)))
  const cursorClause = cursor ? 'AND (aps.tanggal || char(31) || aps.created_at || char(31) || aps.id) < ?' : ''
  const rows = await query<SessionRow>(`SELECT aps.id, aps.tanggal, aps.waktu, aps.created_by, aps.created_at,
      COALESCE(u.full_name, u.email, 'Pengajar') AS creator_name
    FROM absensi_pengajar_sesi aps LEFT JOIN users u ON u.id = aps.created_by
    WHERE aps.kelas_id = ? ${scope.sql} ${cursorClause}
    ORDER BY aps.tanggal DESC, aps.created_at DESC, aps.id DESC LIMIT ?`,
    [kelasId, ...scope.params, ...(cursor ? [cursor] : []), pageSize + 1])
  const hasMore = rows.length > pageSize
  const pageRows = rows.slice(0, pageSize)
  const ids = pageRows.map(row => row.id)
  const details = ids.length ? await query<DetailRow>(`SELECT apd.sesi_id, apd.riwayat_pendidikan_id AS riwayat_id,
      apd.status, s.nama_lengkap AS nama, s.nis, s.asrama, s.kamar
    FROM absensi_pengajar_detail apd
    JOIN riwayat_pendidikan rp ON rp.id = apd.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    WHERE apd.sesi_id IN (${ids.map(() => '?').join(',')}) ORDER BY s.nama_lengkap`, ids) : []
  const studentsById = new Map<string, AbsensiPengajarStudent>()
  const statusBySession: Record<string, Record<string, StatusAbsensiPengajar>> = {}
  for (const detail of details) {
    studentsById.set(detail.riwayat_id, { riwayat_id: detail.riwayat_id, nama: detail.nama,
      nis: detail.nis, asrama: detail.asrama, kamar: detail.kamar })
    const sessionStatuses = statusBySession[detail.sesi_id] ||= {}
    sessionStatuses[detail.riwayat_id] = detail.status
  }
  const last = pageRows.at(-1)
  return {
    sessions: pageRows.map(row => ({ ...row, editable: row.created_by === session.id || isAdmin(session) })) as AbsensiPengajarSession[],
    students: [...studentsById.values()], statusBySession,
    nextCursor: hasMore && last ? `${last.tanggal}\u001f${last.created_at}\u001f${last.id}` : null,
    hasMore,
  }
}
