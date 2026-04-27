'use server'

import { query, queryOne, execute, generateId } from '@/lib/db'
import { getSession, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const DEFAULT_PAGE_SIZE = 10
const ALASAN_IZIN_KEY = 'keamanan_perizinan_alasan'
const DEFAULT_ALASAN_IZIN = [
  "SAKIT", "BEROBAT", "KONTROL", "ACARA KELUARGA", "ACARA",
  "SURVEI SEKOLAH / KULIAH", "TEST SEKOLAH / KULIAH",
  "MEMBUAT PERSYARATAN", "ORANGTUA MENINGGAL", "KELUARGA MENINGGAL"
]

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
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'keamanan', 'dewan_santri'])) {
    return { error: 'Akses ditolak' }
  }

  const normalized = normalizeAlasanList(items)
  if (normalized.length === 0) return { error: 'Minimal harus ada 1 alasan izin.' }

  await ensureAppSettingsTable()
  await execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [ALASAN_IZIN_KEY, JSON.stringify(normalized)]
  )

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
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'keamanan', 'dewan_santri'])) {
    return { error: 'Akses ditolak' }
  }

  const jenis = formData.get('jenis') as string
  const alasan_dropdown = formData.get('alasan_dropdown') as string
  const deskripsi = formData.get('deskripsi') as string
  const pemberi_izin = formData.get('pemberi_izin') as string

  const alasan_final = deskripsi.trim() ? `${alasan_dropdown} - ${deskripsi.trim()}` : alasan_dropdown

  let tgl_mulai: string, tgl_selesai_rencana: string

  if (jenis === 'PULANG') {
    const dStart = formData.get('date_start') as string
    const dEnd = formData.get('date_end') as string
    tgl_mulai = new Date(`${dStart}T08:00:00+07:00`).toISOString()
    tgl_selesai_rencana = new Date(`${dEnd}T17:00:00+07:00`).toISOString()
  } else {
    const date = formData.get('date_single') as string
    const tStart = formData.get('time_start') as string
    const tEnd = formData.get('time_end') as string
    tgl_mulai = new Date(`${date}T${tStart}:00+07:00`).toISOString()
    tgl_selesai_rencana = new Date(`${date}T${tEnd}:00+07:00`).toISOString()
  }

  await execute(`
    UPDATE perizinan 
    SET jenis = ?, tgl_mulai = ?, tgl_selesai_rencana = ?, alasan = ?, pemberi_izin = ?
    WHERE id = ? AND status = 'AKTIF'
  `, [jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin, id])

  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true }
}

// ─── Simpan Izin ─────────────────────────────────────────────────────────────
export async function simpanIzin(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()

  const santri_id = formData.get('santri_id') as string
  const jenis = formData.get('jenis') as string
  const alasan_dropdown = formData.get('alasan_dropdown') as string
  const deskripsi = formData.get('deskripsi') as string
  const pemberi_izin = formData.get('pemberi_izin') as string

  const alasan_final = deskripsi.trim() ? `${alasan_dropdown} - ${deskripsi.trim()}` : alasan_dropdown

  let tgl_mulai: string, tgl_selesai_rencana: string

  if (jenis === 'PULANG') {
    const dStart = formData.get('date_start') as string
    const dEnd = formData.get('date_end') as string
    tgl_mulai = new Date(`${dStart}T08:00:00+07:00`).toISOString()
    tgl_selesai_rencana = new Date(`${dEnd}T17:00:00+07:00`).toISOString()
  } else {
    const date = formData.get('date_single') as string
    const tStart = formData.get('time_start') as string
    const tEnd = formData.get('time_end') as string
    tgl_mulai = new Date(`${date}T${tStart}:00+07:00`).toISOString()
    tgl_selesai_rencana = new Date(`${date}T${tEnd}:00+07:00`).toISOString()
  }

  await execute(`
    INSERT INTO perizinan (id, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan, pemberi_izin, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?)
  `, [generateId(), santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin, session?.id ?? null])

  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true }
}

export async function setSudahDatang(id: string, waktuDatang: string): Promise<{ success: boolean; message: string } | { error: string }> {
  const izin = await queryOne<{ tgl_selesai_rencana: string }>(
    'SELECT tgl_selesai_rencana FROM perizinan WHERE id = ?', [id]
  )
  if (!izin) return { error: 'Data izin tidak ditemukan.' }

  const aktual = new Date(waktuDatang)
  const rencana = new Date(izin.tgl_selesai_rencana)
  const isTelat = aktual > rencana
  const statusFinal = isTelat ? 'AKTIF' : 'KEMBALI'

  await execute(
    'UPDATE perizinan SET status = ?, tgl_kembali_aktual = ? WHERE id = ?',
    [statusFinal, aktual.toISOString(), id]
  )

  revalidatePath('/dashboard/keamanan/perizinan')

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

export async function hapusIzin(id: string): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session || !hasAnyRole(session, ['admin', 'keamanan', 'dewan_santri'])) {
    return { error: 'Akses ditolak' }
  }
  await execute('DELETE FROM perizinan WHERE id = ?', [id])
  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true }
}
