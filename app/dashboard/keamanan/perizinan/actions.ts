'use server'

import { query, queryOne, execute, generateId } from '@/lib/db'
import { assertFeature } from '@/lib/auth/feature'
import { getSession, hasAnyRole } from '@/lib/auth/session'
import { actorFromSession, diffWhitelistedFields, logActivity } from '@/lib/activity-log'
import { parseWibDate, parseWibDateTime } from '@/lib/date/wib'
import { revalidatePath } from 'next/cache'

const DEFAULT_PAGE_SIZE = 10
const ALASAN_IZIN_KEY = 'keamanan_perizinan_alasan'
const DEFAULT_ALASAN_IZIN = [
  "SAKIT", "BEROBAT", "KONTROL", "ACARA KELUARGA", "ACARA",
  "SURVEI SEKOLAH / KULIAH", "TEST SEKOLAH / KULIAH",
  "MEMBUAT PERSYARATAN", "ORANGTUA MENINGGAL", "KELUARGA MENINGGAL"
]

function isValidDateValue(value: Date) {
  return !Number.isNaN(value.getTime())
}

function buildIzinPayload(formData: FormData): {
  jenis: string
  alasan_final: string
  pemberi_izin: string
  tgl_mulai: string
  tgl_selesai_rencana: string
} | { error: string } {
  const jenis = String(formData.get('jenis') ?? '').trim()
  const alasan_dropdown = String(formData.get('alasan_dropdown') ?? '').trim()
  const deskripsi = String(formData.get('deskripsi') ?? '').trim()
  const pemberi_izin = String(formData.get('pemberi_izin') ?? '').trim()

  if (!jenis) return { error: 'Jenis izin wajib dipilih.' }
  if (!alasan_dropdown) return { error: 'Keperluan dasar wajib dipilih.' }
  if (!pemberi_izin) return { error: 'Pemberi izin wajib dipilih.' }

  const alasan_final = deskripsi ? `${alasan_dropdown} - ${deskripsi}` : alasan_dropdown

  let mulai: Date
  let selesai: Date

  if (jenis === 'PULANG') {
    const dStart = String(formData.get('date_start') ?? '').trim()
    const dEnd = String(formData.get('date_end') ?? '').trim()

    if (!dStart || !dEnd) return { error: 'Tanggal pulang dan batas kembali wajib diisi.' }

    mulai = parseWibDate(dStart, 'start')
    selesai = parseWibDate(dEnd, 'end')
  } else if (jenis === 'KELUAR_KOMPLEK') {
    const date = String(formData.get('date_single') ?? '').trim()
    const tStart = String(formData.get('time_start') ?? '').trim()
    const tEnd = String(formData.get('time_end') ?? '').trim()

    if (!date || !tStart || !tEnd) return { error: 'Tanggal dan jam izin wajib diisi lengkap.' }

    mulai = new Date(`${date}T${tStart}:00+07:00`)
    selesai = new Date(`${date}T${tEnd}:00+07:00`)
  } else {
    return { error: 'Jenis izin tidak dikenali.' }
  }

  if (!isValidDateValue(mulai) || !isValidDateValue(selesai)) {
    return { error: 'Format tanggal atau jam izin tidak valid.' }
  }

  if (selesai < mulai) {
    return { error: 'Batas kembali tidak boleh lebih awal dari waktu mulai izin.' }
  }

  return {
    jenis,
    alasan_final,
    pemberi_izin,
    tgl_mulai: mulai.toISOString(),
    tgl_selesai_rencana: selesai.toISOString(),
  }
}

async function ensureAppSettingsTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
}

function normalizeAlasanList(items: unknown[]) {
  return [...new Set(
    items
      .map(item => String(item ?? '').trim().toUpperCase())
      .filter(Boolean)
  )]
}

export async function getAlasanIzinList() {
  await ensureAppSettingsTable()
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [ALASAN_IZIN_KEY]
  )

  if (!row?.value) return DEFAULT_ALASAN_IZIN

  try {
    const parsed = JSON.parse(row.value)
    if (!Array.isArray(parsed)) return DEFAULT_ALASAN_IZIN
    const normalized = normalizeAlasanList(parsed)
    return normalized.length ? normalized : DEFAULT_ALASAN_IZIN
  } catch {
    return DEFAULT_ALASAN_IZIN
  }
}

export async function simpanAlasanIzinList(items: string[]) {
  const access = await assertFeature('/dashboard/keamanan/perizinan')
  if ('error' in access) return access
  const session = await getSession()

  const normalized = normalizeAlasanList(items)
  if (normalized.length === 0) return { error: 'Minimal harus ada 1 alasan izin.' }

  await ensureAppSettingsTable()
  await execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [ALASAN_IZIN_KEY, JSON.stringify(normalized)]
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan_perizinan',
    action: 'update',
    fiturHref: '/dashboard/keamanan/perizinan',
    logKind: 'update',
    entityType: 'app_setting',
    entityId: ALASAN_IZIN_KEY,
    entityLabel: 'Alasan izin',
    summary: 'Memperbarui daftar alasan izin',
    details: {
      total_alasan: normalized.length,
    },
  })

  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true, rows: normalized }
}

// ─── Helper asrama list ───────────────────────────────────────────────────────
export async function getAsramaList() {
  const rows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama FROM santri
     WHERE status_global = 'aktif' AND asrama IS NOT NULL ORDER BY asrama`
  )
  return rows.map(r => r.asrama)
}

// ─── Helper: Build Where Clauses array ────────────────────────────────────────
function buildWhereClauses(params: {
  search?: string
  asrama?: string
  tglAwal?: string
  tglAkhir?: string
  statusFilter?: string
}) {
  const clauses: string[] = []
  const baseParams: any[] = []

  if (params.asrama && params.asrama !== 'SEMUA') {
    clauses.push('s.asrama = ?')
    baseParams.push(params.asrama)
  }

  if (params.search) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    baseParams.push(`%${params.search}%`, `%${params.search}%`)
  }

  if (params.tglAwal && params.tglAkhir) {
    const startWindow = new Date(`${params.tglAwal}T00:00:00+07:00`).toISOString()
    const endWindow = new Date(`${params.tglAkhir}T23:59:59+07:00`).toISOString()
    clauses.push(`p.tgl_mulai <= ? AND (p.status = 'AKTIF' OR p.tgl_kembali_aktual >= ?)`)
    baseParams.push(endWindow, startWindow)
  } else if (params.tglAwal) {
    const startWindow = new Date(`${params.tglAwal}T00:00:00+07:00`).toISOString()
    clauses.push(`(p.status = 'AKTIF' OR p.tgl_kembali_aktual >= ?)`)
    baseParams.push(startWindow)
  } else if (params.tglAkhir) {
    const endWindow = new Date(`${params.tglAkhir}T23:59:59+07:00`).toISOString()
    clauses.push(`p.tgl_mulai <= ?`)
    baseParams.push(endWindow)
  }

  if (params.statusFilter === 'BELUM_KEMBALI') {
    clauses.push("p.status = 'AKTIF'")
  } else if (params.statusFilter === 'SUDAH_KEMBALI') {
    clauses.push("p.status = 'KEMBALI'")
  } else if (params.statusFilter === 'TERLAMBAT') {
    clauses.push(`((p.status = 'KEMBALI' AND p.tgl_kembali_aktual > p.tgl_selesai_rencana) OR (p.status = 'AKTIF' AND p.tgl_selesai_rencana < ?))`)
    baseParams.push(new Date().toISOString())
  } else if (params.statusFilter === 'TEPAT_WAKTU') {
    clauses.push("p.status = 'KEMBALI' AND p.tgl_kembali_aktual <= p.tgl_selesai_rencana")
  }

  return { clauses, baseParams }
}

// ─── Get Perizinan List (Paginated & Filtered) ───────────────────────────────
export async function getPerizinanList(params: {
  page?: number
  pageSize?: number
  search?: string
  asrama?: string
  tglAwal?: string
  tglAkhir?: string
  statusFilter?: 'SEMUA' | 'BELUM_KEMBALI' | 'SUDAH_KEMBALI' | 'TERLAMBAT' | 'TEPAT_WAKTU'
}) {
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, ...filters } = params
  const offset = (page - 1) * pageSize

  const { clauses, baseParams } = buildWhereClauses(filters)
  const where = clauses.length > 0 ? clauses.join(' AND ') : '1=1'

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM perizinan p JOIN santri s ON s.id = p.santri_id WHERE ${where}`,
    baseParams
  )
  const total = countRow?.total ?? 0

  const rows = await query<any>(
    `SELECT p.id, p.created_at, p.status, p.jenis, p.alasan, p.pemberi_izin,
            p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual,
            s.nama_lengkap AS nama, s.nis, s.asrama, s.kamar
     FROM perizinan p
     JOIN santri s ON s.id = p.santri_id
     WHERE ${where}
     ORDER BY p.status ASC, p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...baseParams, pageSize, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / pageSize) }
}

// ─── Export Data Izin ────────────────────────────────────────────────────────
export async function exportDataIzin(params: {
  search?: string
  asrama?: string
  tglAwal?: string
  tglAkhir?: string
  statusFilter?: string
}) {
  const { clauses, baseParams } = buildWhereClauses(params)
  const where = clauses.length > 0 ? clauses.join(' AND ') : '1=1'

  return query<any>(`
    SELECT s.nama_lengkap, s.nis, s.asrama, s.kamar,
           p.jenis, p.alasan, p.pemberi_izin, p.status,
           p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${where}
    ORDER BY p.status ASC, p.tgl_mulai DESC
  `, baseParams)
}

// ─── Get Analitik Izin ───────────────────────────────────────────────────────
export async function getAnalitikIzin(params: { 
  asrama?: string
  tglAwal?: string
  tglAkhir?: string 
}) {
  const { clauses, baseParams } = buildWhereClauses({ ...params })
  const where = clauses.length > 0 ? clauses.join(' AND ') : '1=1'

  const statsRow = await queryOne<any>(`
    SELECT 
      COUNT(p.id) as total_izin,
      SUM(CASE WHEN p.jenis = 'PULANG' THEN 1 ELSE 0 END) as izin_pulang,
      SUM(CASE WHEN p.jenis = 'KELUAR_KOMPLEK' THEN 1 ELSE 0 END) as izin_keluar,
      SUM(CASE WHEN p.status = 'AKTIF' THEN 1 ELSE 0 END) as belum_kembali,
      SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual <= p.tgl_selesai_rencana THEN 1 ELSE 0 END) as tepat_waktu,
      SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual > p.tgl_selesai_rencana THEN 1 ELSE 0 END) as terlambat_kembali
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${where}
  `, baseParams)

  return {
    total: statsRow?.total_izin || 0,
    pulang: statsRow?.izin_pulang || 0,
    keluar: statsRow?.izin_keluar || 0,
    aktif: statsRow?.belum_kembali || 0,
    tepat: statsRow?.tepat_waktu || 0,
    telat: statsRow?.terlambat_kembali || 0,
  }
}

// ─── Get Top Santri Izin ───────────────────────────────────────────────────────
export async function getTopSantriIzin(params: { asrama?: string, tglAwal?: string, tglAkhir?: string }) {
  const { clauses, baseParams } = buildWhereClauses({ ...params })
  const where = clauses.length > 0 ? clauses.join(' AND ') : '1=1'

  return query<any>(`
    SELECT s.id, s.nama_lengkap, s.asrama, s.kamar, COUNT(p.id) as total_izin,
           SUM(CASE WHEN p.status = 'KEMBALI' AND p.tgl_kembali_aktual > p.tgl_selesai_rencana THEN 1 ELSE 0 END) as total_telat
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${where}
    GROUP BY s.id, s.nama_lengkap, s.asrama, s.kamar
    HAVING total_izin > 0
    ORDER BY total_izin DESC, total_telat DESC
    LIMIT 5
  `, baseParams)
}

// ─── Update Izin ─────────────────────────────────────────────────────────────
export async function updateIzin(id: string, formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan/perizinan')
  if ('error' in access) return access
  const session = await getSession()
  const beforeIzin = await queryOne<Record<string, unknown>>(
    `SELECT p.id, p.jenis, p.tgl_mulai, p.tgl_selesai_rencana, p.alasan, p.pemberi_izin, s.nama_lengkap
     FROM perizinan p
     LEFT JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,
    [id]
  )
  if (!beforeIzin) return { error: 'Data izin tidak ditemukan.' }

  const payload = buildIzinPayload(formData)
  if ('error' in payload) return payload

  const { jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin } = payload

  await execute(`
    UPDATE perizinan 
    SET jenis = ?, tgl_mulai = ?, tgl_selesai_rencana = ?, alasan = ?, pemberi_izin = ?
    WHERE id = ? AND status = 'AKTIF'
  `, [jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin, id])

  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan_perizinan',
    action: 'update',
    fiturHref: '/dashboard/keamanan/perizinan',
    logKind: 'update',
    entityType: 'perizinan',
    entityId: id,
    entityLabel: String(beforeIzin.nama_lengkap || id),
    summary: `Memperbarui izin untuk ${String(beforeIzin.nama_lengkap || id)}`,
    details: {
      changed_fields: diffWhitelistedFields(
        beforeIzin,
        { jenis, tgl_mulai, tgl_selesai_rencana, alasan: alasan_final, pemberi_izin },
        ['jenis', 'tgl_mulai', 'tgl_selesai_rencana', 'alasan', 'pemberi_izin']
      ),
    },
  })

  revalidatePath('/dashboard/keamanan/perizinan')
  revalidatePath('/dashboard/asrama/absen-malam')
  return { success: true }
}

// ─── Simpan Izin ─────────────────────────────────────────────────────────────
export async function simpanIzin(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan/perizinan')
  if ('error' in access) return access
  const session = access

  const santri_id = String(formData.get('santri_id') ?? '').trim()
  if (!santri_id) return { error: 'Santri wajib dipilih terlebih dahulu.' }

  const payload = buildIzinPayload(formData)
  if ('error' in payload) return payload

  const { jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin } = payload
  const izinId = generateId()
  const actorSession = await getSession()
  const santri = await queryOne<{ nama_lengkap: string | null; nis: string | null }>(
    'SELECT nama_lengkap, nis FROM santri WHERE id = ?',
    [santri_id]
  )

  await execute(`
    INSERT INTO perizinan (id, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan, pemberi_izin, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?)
  `, [izinId, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin, session?.id ?? null])

  await logActivity({
    actor: actorFromSession(actorSession),
    module: 'keamanan_perizinan',
    action: 'create',
    fiturHref: '/dashboard/keamanan/perizinan',
    logKind: 'create',
    entityType: 'perizinan',
    entityId: izinId,
    entityLabel: santri?.nama_lengkap || santri?.nis || santri_id,
    summary: `Mencatat izin untuk ${santri?.nama_lengkap || santri?.nis || santri_id}`,
    details: {
      jenis,
      alasan: alasan_final,
      pemberi_izin,
      tgl_mulai,
      tgl_selesai_rencana,
    },
  })

  revalidatePath('/dashboard/keamanan/perizinan')
  revalidatePath('/dashboard/asrama/absen-malam')
  return { success: true }
}

export async function setSudahDatang(id: string, waktuDatang: string): Promise<{ success: boolean; message: string } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan/perizinan')
  if ('error' in access) return access
  const session = await getSession()

  const izin = await queryOne<{ jenis: string; tgl_selesai_rencana: string; santri_nama: string | null }>(
    `SELECT p.jenis, p.tgl_selesai_rencana, s.nama_lengkap AS santri_nama
     FROM perizinan p
     LEFT JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,
    [id]
  )
  if (!izin) return { error: 'Data izin tidak ditemukan.' }

  const aktual = izin.jenis === 'PULANG'
    ? parseWibDate(waktuDatang, 'start')
    : parseWibDateTime(waktuDatang)
  if (!isValidDateValue(aktual)) return { error: 'Waktu datang tidak valid.' }

  const rencana = new Date(izin.tgl_selesai_rencana)
  const isTelat = aktual > rencana
  const statusFinal = isTelat ? 'AKTIF' : 'KEMBALI'

  await execute(
    'UPDATE perizinan SET status = ?, tgl_kembali_aktual = ? WHERE id = ?',
    [statusFinal, aktual.toISOString(), id]
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan_perizinan',
    action: 'update',
    fiturHref: '/dashboard/keamanan/perizinan',
    logKind: 'update',
    entityType: 'perizinan',
    entityId: id,
    entityLabel: izin.santri_nama || id,
    summary: `Mencatat kedatangan santri izin ${izin.santri_nama || id}`,
    details: {
      waktu_datang: aktual.toISOString(),
      status_final: statusFinal,
      telat: isTelat,
    },
  })

  revalidatePath('/dashboard/keamanan/perizinan')
  revalidatePath('/dashboard/asrama/absen-malam')

  if (isTelat) return { success: true, message: 'Terlambat! Masuk antrian verifikasi.' }
  return { success: true, message: 'Tepat waktu. Izin selesai.' }
}

export async function cariSantri(keyword: string) {
  return query<any>(`
    SELECT id, nama_lengkap, nis, asrama, kamar
    FROM santri
    WHERE nama_lengkap LIKE ?
    LIMIT 5
  `, [`%${keyword}%`])
}

// ─── Ensure perizinan_pengajuan table ────────────────────────────────────────
async function ensurePengajuanTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS perizinan_pengajuan (
      id TEXT PRIMARY KEY,
      santri_id TEXT NOT NULL,
      jenis TEXT NOT NULL DEFAULT 'PULANG',
      tgl_mulai TEXT NOT NULL,
      tgl_selesai_rencana TEXT NOT NULL,
      alasan TEXT NOT NULL,
      pemberi_izin TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      submitted_by TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
}

// ─── Ajukan Izin Pulang (oleh pengurus asrama) ────────────────────────────────
export async function ajukanIzinAsrama(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan/perizinan')
  if ('error' in access) return access
  const session = await getSession()

  const santri_id = String(formData.get('santri_id') ?? '').trim()
  if (!santri_id) return { error: 'Santri wajib dipilih.' }

  // Force jenis PULANG
  formData.set('jenis', 'PULANG')
  const payload = buildIzinPayload(formData)
  if ('error' in payload) return payload

  const { jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin } = payload
  if (jenis !== 'PULANG') return { error: 'Pengajuan dari asrama hanya untuk izin pulang.' }

  const santri = await queryOne<{ nama_lengkap: string | null; nis: string | null }>(
    'SELECT nama_lengkap, nis FROM santri WHERE id = ?',
    [santri_id]
  )

  await ensurePengajuanTable()
  const pengajuanId = generateId()

  await execute(`
    INSERT INTO perizinan_pengajuan (id, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan, pemberi_izin, status, submitted_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `, [pengajuanId, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin, session?.id ?? null])

  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan_perizinan',
    action: 'create',
    fiturHref: '/dashboard/keamanan/perizinan',
    logKind: 'create',
    entityType: 'perizinan_pengajuan',
    entityId: pengajuanId,
    entityLabel: santri?.nama_lengkap || santri?.nis || santri_id,
    summary: `Mengajukan izin pulang untuk ${santri?.nama_lengkap || santri?.nis || santri_id}`,
    details: { jenis, alasan: alasan_final, pemberi_izin, tgl_mulai, tgl_selesai_rencana },
  })

  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true }
}

// ─── Get Pengajuan Pending dari Asrama ────────────────────────────────────────
export async function getPengajuanPendingAsrama(): Promise<any[]> {
  try {
    await ensurePengajuanTable()
    return await query<any>(`
      SELECT pq.id, pq.created_at, pq.jenis, pq.alasan, pq.pemberi_izin,
             pq.tgl_mulai, pq.tgl_selesai_rencana, pq.status,
             pq.santri_id,
             s.nama_lengkap AS nama, s.nis, s.asrama, s.kamar,
             u.full_name AS submitted_by_name
      FROM perizinan_pengajuan pq
      JOIN santri s ON s.id = pq.santri_id
      LEFT JOIN users u ON u.id = pq.submitted_by
      WHERE pq.status = 'PENDING'
      ORDER BY pq.created_at ASC
    `)
  } catch {
    return []
  }
}

// ─── Approve Pengajuan Asrama ─────────────────────────────────────────────────
export async function approveIzinAsrama(id: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan/perizinan')
  if ('error' in access) return access
  const session = await getSession()

  if (!hasAnyRole(session, ['dewan_santri', 'admin'])) {
    return { error: 'Hanya dewan santri yang dapat menyetujui pengajuan.' }
  }

  const pengajuan = await queryOne<any>(`
    SELECT pq.*, s.nama_lengkap, s.nis
    FROM perizinan_pengajuan pq
    JOIN santri s ON s.id = pq.santri_id
    WHERE pq.id = ? AND pq.status = 'PENDING'
  `, [id])

  if (!pengajuan) return { error: 'Pengajuan tidak ditemukan atau sudah diproses.' }

  const izinId = generateId()

  await execute(`
    INSERT INTO perizinan (id, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan, pemberi_izin, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?)
  `, [izinId, pengajuan.santri_id, pengajuan.jenis, pengajuan.tgl_mulai,
      pengajuan.tgl_selesai_rencana, pengajuan.alasan, pengajuan.pemberi_izin,
      session?.id ?? null])

  await execute(`
    UPDATE perizinan_pengajuan
    SET status = 'APPROVED', reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `, [session?.id ?? null, id])

  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan_perizinan',
    action: 'create',
    fiturHref: '/dashboard/keamanan/perizinan',
    logKind: 'create',
    entityType: 'perizinan',
    entityId: izinId,
    entityLabel: pengajuan.nama_lengkap || pengajuan.nis || pengajuan.santri_id,
    summary: `Menyetujui pengajuan izin pulang ${pengajuan.nama_lengkap || pengajuan.santri_id}`,
    details: { dari_pengajuan: id },
  })

  revalidatePath('/dashboard/keamanan/perizinan')
  revalidatePath('/dashboard/asrama/absen-malam')
  return { success: true }
}

// ─── Reject Pengajuan Asrama ──────────────────────────────────────────────────
export async function rejectIzinAsrama(id: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan/perizinan')
  if ('error' in access) return access
  const session = await getSession()

  if (!hasAnyRole(session, ['dewan_santri', 'admin'])) {
    return { error: 'Hanya dewan santri yang dapat menolak pengajuan.' }
  }

  const pengajuan = await queryOne<any>(
    'SELECT id, santri_id FROM perizinan_pengajuan WHERE id = ? AND status = ?',
    [id, 'PENDING']
  )
  if (!pengajuan) return { error: 'Pengajuan tidak ditemukan atau sudah diproses.' }

  await execute(`
    UPDATE perizinan_pengajuan
    SET status = 'REJECTED', reviewed_by = ?, reviewed_at = datetime('now')
    WHERE id = ?
  `, [session?.id ?? null, id])

  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan_perizinan',
    action: 'update',
    fiturHref: '/dashboard/keamanan/perizinan',
    logKind: 'update',
    entityType: 'perizinan_pengajuan',
    entityId: id,
    entityLabel: id,
    summary: `Menolak pengajuan izin asrama`,
    details: {},
  })

  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true }
}

export async function hapusIzin(id: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan/perizinan')
  if ('error' in access) return access
  const session = await getSession()
  const izin = await queryOne<{
    id: string
    jenis: string | null
    alasan: string | null
    nama_lengkap: string | null
  }>(
    `SELECT p.id, p.jenis, p.alasan, s.nama_lengkap
     FROM perizinan p
     LEFT JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?`,
    [id]
  )
  if (!izin) return { error: 'Data izin tidak ditemukan.' }
  await execute('DELETE FROM perizinan WHERE id = ?', [id])
  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan_perizinan',
    action: 'delete',
    fiturHref: '/dashboard/keamanan/perizinan',
    logKind: 'delete',
    entityType: 'perizinan',
    entityId: id,
    entityLabel: izin.nama_lengkap || id,
    summary: `Menghapus data izin ${izin.nama_lengkap || id}`,
    details: {
      jenis: izin.jenis,
      alasan: izin.alasan,
    },
  })
  revalidatePath('/dashboard/keamanan/perizinan')
  revalidatePath('/dashboard/asrama/absen-malam')
  return { success: true }
}
