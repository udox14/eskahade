'use server'

import { query, queryOne, execute, generateId, getDB } from '@/lib/db'
import { assertFeature } from '@/lib/auth/feature'
import { getSession, getEffectiveRoles, hasAnyRole, isSuperAccess, type SessionUser } from '@/lib/auth/session'
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
const PEMBERI_IZIN_KEY = 'keamanan_perizinan_pemberi_izin'
const PERIZINAN_HREF = '/dashboard/keamanan/perizinan'
const DEFAULT_PEMBERI_IZIN = [
  "Muhammad Fakhri", "Gungun T. Aminullah", "Yusup Fallo",
  "Ryan M. Ridwan", "M. Jihad Robbani", "Wahid Hasyim", "Abdul Halim"
]

type PerizinanScope = {
  session: SessionUser
  asrama: string | null
  isAsrama: boolean
  isDewan: boolean
  isUnrestricted: boolean
}

/** Resolve the data boundary used by every read in this module. */
async function resolvePerizinanScope(
  requestedAsrama?: string,
  options: { allowUnselectedDewan?: boolean } = {}
): Promise<PerizinanScope | { error: string }> {
  const access = await assertFeature(PERIZINAN_HREF, 'read')
  if ('error' in access) return access

  const session = access
  const roles = getEffectiveRoles(session)
  const isUnrestricted = isSuperAccess(session) || roles.includes('admin')
  const isDewan = !isUnrestricted && roles.includes('dewan_santri')
  const isAsrama = !isUnrestricted && !isDewan && roles.includes('pengurus_asrama')
  const requested = String(requestedAsrama ?? '').trim()

  if (isAsrama) {
    if (!session.asrama_binaan) return { error: 'Akun Anda belum memiliki asrama binaan.' }
    return { session, asrama: session.asrama_binaan, isAsrama, isDewan, isUnrestricted }
  }

  if (isDewan && (!requested || requested === 'SEMUA')) {
    if (options.allowUnselectedDewan) {
      return { session, asrama: null, isAsrama, isDewan, isUnrestricted }
    }
    return { error: 'Pilih asrama terlebih dahulu.' }
  }

  if (isDewan) {
    const selected = await queryOne<{ asrama: string }>(
      `SELECT asrama FROM santri
       WHERE status_global = 'aktif' AND asrama = ?
       LIMIT 1`,
      [requested]
    )
    if (!selected) return { error: 'Asrama yang dipilih tidak valid.' }
  }

  return {
    session,
    asrama: requested && requested !== 'SEMUA' ? requested : null,
    isAsrama,
    isDewan,
    isUnrestricted,
  }
}

async function assertManagedMutation(
  action: 'create' | 'update' | 'delete'
): Promise<SessionUser | { error: string }> {
  const access = await assertFeature(PERIZINAN_HREF, action)
  if ('error' in access) return access

  const roles = getEffectiveRoles(access)
  const isReadOnlyAsrama = roles.includes('pengurus_asrama') &&
    !roles.includes('dewan_santri') &&
    !isSuperAccess(access) &&
    !roles.includes('admin')

  if (isReadOnlyAsrama) {
    return { error: 'Pengurus asrama hanya dapat membaca, mengekspor, dan mengajukan izin.' }
  }

  return access
}

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
  if (!['PULANG', 'KELUAR_KOMPLEK'].includes(jenis)) return { error: 'Jenis izin tidak dikenali.' }
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
  } else {
    const date = String(formData.get('date_single') ?? '').trim()
    const tStart = String(formData.get('time_start') ?? '').trim()
    const tEnd = String(formData.get('time_end') ?? '').trim()
    if (!date || !tStart || !tEnd) return { error: 'Tanggal dan jam izin wajib diisi lengkap.' }
    mulai = new Date(`${date}T${tStart}:00+07:00`)
    selesai = new Date(`${date}T${tEnd}:00+07:00`)
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

async function findOverlappingIzin(santriId: string, mulai: string, selesai: string, excludeId?: string) {
  const excludeClause = excludeId ? 'AND id != ?' : ''
  return queryOne<{ id: string }>(`
    SELECT id FROM perizinan
    WHERE santri_id = ? AND status = 'AKTIF' AND tgl_kembali_aktual IS NULL
      AND tgl_mulai <= ? AND tgl_selesai_rencana >= ? ${excludeClause}
    LIMIT 1
  `, excludeId ? [santriId, selesai, mulai, excludeId] : [santriId, selesai, mulai])
}

function normalizePemberiIzinName(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function pemberiIzinKey(value: unknown) {
  return normalizePemberiIzinName(value).toLocaleLowerCase()
}

function normalizePemberiIzinList(items: unknown[]) {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const item of items) {
    const name = normalizePemberiIzinName(item)
    const key = pemberiIzinKey(name)
    if (!name || seen.has(key)) continue
    seen.add(key)
    normalized.push(name)
  }

  return normalized
}

export async function getAlasanIzinList() {
  const access = await assertFeature(PERIZINAN_HREF, 'read')
  if ('error' in access) return []
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
  const access = await assertManagedMutation('update')
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

export async function getPemberiIzinList() {
  const access = await assertFeature(PERIZINAN_HREF, 'read')
  if ('error' in access) return []
  await ensureAppSettingsTable()
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [PEMBERI_IZIN_KEY]
  )

  if (!row?.value) return DEFAULT_PEMBERI_IZIN

  try {
    const parsed = JSON.parse(row.value)
    if (!Array.isArray(parsed)) return DEFAULT_PEMBERI_IZIN
    const normalized = normalizePemberiIzinList(parsed)
    return normalized.length ? normalized : DEFAULT_PEMBERI_IZIN
  } catch {
    return DEFAULT_PEMBERI_IZIN
  }
}

async function validatePemberiIzin(value: string) {
  const options = await getPemberiIzinList()
  if (!options.some(option => pemberiIzinKey(option) === pemberiIzinKey(value))) {
    return { error: 'Pemberi izin tidak tersedia di Pengaturan. Muat ulang daftar lalu pilih nama yang valid.' }
  }
  return null
}

export async function simpanPemberiIzinList(items: string[]) {
  const access = await assertManagedMutation('update')
  if ('error' in access) return access
  const session = await getSession()

  const rawItems = Array.isArray(items) ? items : []
  const normalized = normalizePemberiIzinList(rawItems)
  if (normalized.length === 0) return { error: 'Minimal harus ada 1 pemberi izin.' }
  if (normalized.some(name => name.length < 2 || name.length > 100)) {
    return { error: 'Nama pemberi izin harus terdiri dari 2 sampai 100 karakter.' }
  }

  const current = await getPemberiIzinList()
  const nextKeys = new Set(normalized.map(pemberiIzinKey))
  const removed = current.filter(name => !nextKeys.has(pemberiIzinKey(name)))

  if (removed.length > 0) {
    await ensurePengajuanTable()
    const placeholders = removed.map(() => '?').join(', ')
    const usedRows = await query<{ pemberi_izin: string }>(
      `SELECT DISTINCT pemberi_izin FROM (
         SELECT pemberi_izin FROM perizinan
         UNION ALL
         SELECT pemberi_izin FROM perizinan_pengajuan
       )
       WHERE pemberi_izin IS NOT NULL
         AND LOWER(TRIM(pemberi_izin)) IN (${placeholders})`,
      removed.map(pemberiIzinKey)
    )

    if (usedRows.length > 0) {
      const usedNames = usedRows
        .map(row => normalizePemberiIzinName(row.pemberi_izin))
        .filter(Boolean)
        .slice(0, 3)
        .join(', ')
      return {
        error: `Pemberi izin ${usedNames} masih dipakai pada riwayat atau pengajuan. Tambahkan kembali nama tersebut sebelum menyimpan.`,
      }
    }
  }

  await ensureAppSettingsTable()
  await execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [PEMBERI_IZIN_KEY, JSON.stringify(normalized)]
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan_perizinan',
    action: 'update',
    fiturHref: '/dashboard/keamanan/perizinan',
    logKind: 'update',
    entityType: 'app_setting',
    entityId: PEMBERI_IZIN_KEY,
    entityLabel: 'Pemberi izin',
    summary: 'Memperbarui daftar pemberi izin',
    details: {
      total_pemberi_izin: normalized.length,
    },
  })

  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true, rows: normalized }
}

// ─── Helper asrama list ───────────────────────────────────────────────────────
export async function getAsramaList() {
  const scope = await resolvePerizinanScope(undefined, { allowUnselectedDewan: true })
  if ('error' in scope) return []
  if (scope.asrama) return [scope.asrama]

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
  jenisFilter?: string
}, scopeAsrama?: string | null) {
  const clauses: string[] = []
  const baseParams: any[] = []

  if (scopeAsrama) {
    clauses.push('s.asrama = ?')
    baseParams.push(scopeAsrama)
  } else if (params.asrama && params.asrama !== 'SEMUA') {
    clauses.push('s.asrama = ?')
    baseParams.push(params.asrama)
  }

  if (params.jenisFilter && params.jenisFilter !== 'SEMUA') {
    clauses.push('p.jenis = ?')
    baseParams.push(params.jenisFilter)
  }


  if (params.search) {
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    baseParams.push(`%${params.search}%`, `%${params.search}%`)
  }

  if (params.tglAwal && params.tglAkhir) {
    const startWindow = new Date(`${params.tglAwal}T00:00:00+07:00`).toISOString()
    const endWindow = new Date(`${params.tglAkhir}T23:59:59+07:00`).toISOString()
    clauses.push(`p.tgl_mulai <= ? AND ((p.status = 'AKTIF' AND p.tgl_kembali_aktual IS NULL) OR p.tgl_kembali_aktual >= ?)`)
    baseParams.push(endWindow, startWindow)
  } else if (params.tglAwal) {
    const startWindow = new Date(`${params.tglAwal}T00:00:00+07:00`).toISOString()
    clauses.push(`((p.status = 'AKTIF' AND p.tgl_kembali_aktual IS NULL) OR p.tgl_kembali_aktual >= ?)`)
    baseParams.push(startWindow)
  } else if (params.tglAkhir) {
    const endWindow = new Date(`${params.tglAkhir}T23:59:59+07:00`).toISOString()
    clauses.push(`p.tgl_mulai <= ?`)
    baseParams.push(endWindow)
  }

  if (params.statusFilter === 'BELUM_KEMBALI') {
    clauses.push("p.status = 'AKTIF' AND p.tgl_kembali_aktual IS NULL")
  } else if (params.statusFilter === 'SUDAH_KEMBALI') {
    clauses.push("(p.status = 'KEMBALI' OR p.tgl_kembali_aktual IS NOT NULL)")
  } else if (params.statusFilter === 'TERLAMBAT') {
    clauses.push(`((p.tgl_kembali_aktual IS NOT NULL AND p.tgl_kembali_aktual > p.tgl_selesai_rencana) OR (p.status = 'AKTIF' AND p.tgl_kembali_aktual IS NULL AND p.tgl_selesai_rencana < ?))`)
    baseParams.push(new Date().toISOString())
  } else if (params.statusFilter === 'TEPAT_WAKTU') {
    clauses.push("p.tgl_kembali_aktual IS NOT NULL AND p.tgl_kembali_aktual <= p.tgl_selesai_rencana")
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
  jenisFilter?: 'SEMUA' | 'PULANG' | 'KELUAR_KOMPLEK'
}) {
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, ...filters } = params
  const offset = (page - 1) * pageSize

  const scope = await resolvePerizinanScope(filters.asrama)
  if ('error' in scope) {
    return { rows: [], total: 0, page, totalPages: 0, error: scope.error }
  }

  const { clauses, baseParams } = buildWhereClauses(filters, scope.asrama)
  const where = clauses.length > 0 ? clauses.join(' AND ') : '1=1'

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM perizinan p JOIN santri s ON s.id = p.santri_id
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     WHERE ${where}`,
    baseParams
  )
  const total = countRow?.total ?? 0

  const rows = await query<any>(
    `SELECT p.id, p.created_at, p.status, p.jenis, p.alasan, p.pemberi_izin,
            p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual,
            s.nama_lengkap AS nama, s.nis, s.asrama, s.kamar,
            k.nama_kelas AS kelas
     FROM perizinan p
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     WHERE ${where}
     ORDER BY 
       CASE 
         WHEN p.status = 'AKTIF' AND p.tgl_kembali_aktual IS NULL THEN 0
         WHEN p.status = 'AKTIF' AND p.tgl_kembali_aktual IS NOT NULL THEN 1
         ELSE 2 
       END ASC,
       p.created_at DESC
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
  jenisFilter?: string
}) {
  const scope = await resolvePerizinanScope(params.asrama)
  if ('error' in scope) return []

  const { clauses, baseParams } = buildWhereClauses(params, scope.asrama)
  const where = clauses.length > 0 ? clauses.join(' AND ') : '1=1'

  return query<any>(`
    SELECT s.nama_lengkap, s.nis, s.asrama, s.kamar,
           k.nama_kelas AS kelas,
           p.jenis, p.alasan, p.pemberi_izin, p.status,
           p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE ${where}
    ORDER BY 
      CASE 
        WHEN p.status = 'AKTIF' AND p.tgl_kembali_aktual IS NULL THEN 0
        WHEN p.status = 'AKTIF' AND p.tgl_kembali_aktual IS NOT NULL THEN 1
        ELSE 2 
      END ASC,
      p.tgl_mulai DESC
  `, baseParams)
}

// ─── Get Analitik Izin ───────────────────────────────────────────────────────
export async function getAnalitikIzin(params: { 
  asrama?: string
  tglAwal?: string
  tglAkhir?: string 
  jenisFilter?: string
}) {
  const scope = await resolvePerizinanScope(params.asrama)
  if ('error' in scope) {
    return { total: 0, pulang: 0, keluarKomplek: 0, aktif: 0, tepat: 0, telat: 0, error: scope.error }
  }

  const { clauses, baseParams } = buildWhereClauses({ ...params }, scope.asrama)
  const where = clauses.length > 0 ? clauses.join(' AND ') : '1=1'

  const statsRow = await queryOne<any>(`
    SELECT 
      COUNT(p.id) as total_izin,
      SUM(CASE WHEN p.jenis = 'PULANG' THEN 1 ELSE 0 END) as izin_pulang,
      SUM(CASE WHEN p.jenis = 'KELUAR_KOMPLEK' THEN 1 ELSE 0 END) as izin_keluar_komplek,
      SUM(CASE WHEN p.status = 'AKTIF' AND p.tgl_kembali_aktual IS NULL THEN 1 ELSE 0 END) as belum_kembali,
      SUM(CASE WHEN p.tgl_kembali_aktual IS NOT NULL AND p.tgl_kembali_aktual <= p.tgl_selesai_rencana THEN 1 ELSE 0 END) as tepat_waktu,
      SUM(CASE WHEN p.tgl_kembali_aktual IS NOT NULL AND p.tgl_kembali_aktual > p.tgl_selesai_rencana THEN 1 ELSE 0 END) as terlambat_kembali
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE ${where}
  `, baseParams)

  return {
    total: statsRow?.total_izin || 0,
    pulang: statsRow?.izin_pulang || 0,
    keluarKomplek: statsRow?.izin_keluar_komplek || 0,
    aktif: statsRow?.belum_kembali || 0,
    tepat: statsRow?.tepat_waktu || 0,
    telat: statsRow?.terlambat_kembali || 0,
  }
}

// ─── Get Top Santri Izin ───────────────────────────────────────────────────────
export async function getTopSantriIzin(params: { asrama?: string, tglAwal?: string, tglAkhir?: string, jenisFilter?: string }) {
  const scope = await resolvePerizinanScope(params.asrama)
  if ('error' in scope) return []

  const { clauses, baseParams } = buildWhereClauses({ ...params }, scope.asrama)
  const where = clauses.length > 0 ? clauses.join(' AND ') : '1=1'

  return query<any>(`
    SELECT s.id, s.nama_lengkap, s.asrama, s.kamar, COUNT(p.id) as total_izin,
           SUM(CASE WHEN p.tgl_kembali_aktual IS NOT NULL AND p.tgl_kembali_aktual > p.tgl_selesai_rencana THEN 1 ELSE 0 END) as total_telat
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
export async function updateIzin(id: string, formData: FormData, requestedAsrama?: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertManagedMutation('update')
  if ('error' in access) return access
  const session = await getSession()
  const scope = await resolvePerizinanScope(requestedAsrama)
  if ('error' in scope) return scope
  const scopeClause = scope.asrama ? ' AND s.asrama = ?' : ''
  const scopeParams = scope.asrama ? [scope.asrama] : []
  const beforeIzin = await queryOne<Record<string, unknown>>(
    `SELECT p.id, p.santri_id, p.jenis, p.tgl_mulai, p.tgl_selesai_rencana, p.alasan, p.pemberi_izin, s.nama_lengkap
     FROM perizinan p
     LEFT JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?${scopeClause}`,
    [id, ...scopeParams]
  )
  if (!beforeIzin) return { error: 'Data izin tidak ditemukan.' }

  const payload = buildIzinPayload(formData)
  if ('error' in payload) return payload

  const { jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin } = payload
  const pemberiIzinError = await validatePemberiIzin(pemberi_izin)
  if (pemberiIzinError) return pemberiIzinError
  const overlap = await findOverlappingIzin(String(beforeIzin.santri_id), tgl_mulai, tgl_selesai_rencana, id)
  if (overlap) return { error: 'Santri sudah memiliki izin aktif pada rentang waktu tersebut.' }

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
export async function simpanIzin(formData: FormData, requestedAsrama?: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertManagedMutation('create')
  if ('error' in access) return access
  const session = access
  const scope = await resolvePerizinanScope(requestedAsrama)
  if ('error' in scope) return scope

  const santri_id = String(formData.get('santri_id') ?? '').trim()
  if (!santri_id) return { error: 'Santri wajib dipilih terlebih dahulu.' }

  const payload = buildIzinPayload(formData)
  if ('error' in payload) return payload

  const { jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin } = payload
  const pemberiIzinError = await validatePemberiIzin(pemberi_izin)
  if (pemberiIzinError) return pemberiIzinError
  const overlap = await findOverlappingIzin(santri_id, tgl_mulai, tgl_selesai_rencana)
  if (overlap) return { error: 'Santri sudah memiliki izin aktif pada rentang waktu tersebut.' }
  const izinId = generateId()
  const actorSession = await getSession()
  const santri = await queryOne<{ nama_lengkap: string | null; nis: string | null; asrama: string | null }>(
    'SELECT nama_lengkap, nis, asrama FROM santri WHERE id = ?',
    [santri_id]
  )
  if (!santri) return { error: 'Santri tidak ditemukan.' }
  if (scope.asrama && santri.asrama !== scope.asrama) {
    return { error: 'Santri ini berada di luar cakupan asrama yang dipilih.' }
  }

  await execute(`
    INSERT INTO perizinan (id, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan, pemberi_izin, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?)
  `, [izinId, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin, session?.id ?? null])

  // Hapus record absen_malam_v2 (non-MANUAL_OVERRIDE) yang tercakup dalam periode izin
  // agar absen malam langsung sinkron — tidak perlu menunggu query berikutnya.
  try {
    const mulaiDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(tgl_mulai))
    const selesaiDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(tgl_selesai_rencana))
    await execute(
      `DELETE FROM absen_malam_v2 WHERE santri_id = ? AND tanggal >= ? AND tanggal <= ? AND (sumber_status IS NULL OR sumber_status != 'MANUAL_OVERRIDE')`,
      [santri_id, mulaiDate, selesaiDate]
    )
  } catch { /* non-fatal */ }

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
  revalidatePath('/dashboard/keamanan/rekap-absen-malam')
  return { success: true }
}

export async function setSudahDatang(id: string, waktuDatang: string, requestedAsrama?: string): Promise<{ success: boolean; message: string } | { error: string }> {
  const access = await assertManagedMutation('update')
  if ('error' in access) return access
  const session = await getSession()
  const scope = await resolvePerizinanScope(requestedAsrama)
  if ('error' in scope) return scope
  const scopeClause = scope.asrama ? ' AND s.asrama = ?' : ''
  const scopeParams = scope.asrama ? [scope.asrama] : []

  const izin = await queryOne<{ santri_id: string; jenis: string; tgl_selesai_rencana: string; tgl_kembali_aktual: string | null; santri_nama: string | null }>(
    `SELECT p.santri_id, p.jenis, p.tgl_selesai_rencana, p.tgl_kembali_aktual, s.nama_lengkap AS santri_nama
     FROM perizinan p
     LEFT JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?${scopeClause}`,
    [id, ...scopeParams]
  )
  if (!izin) return { error: 'Data izin tidak ditemukan.' }
  if (izin.tgl_kembali_aktual) return { error: 'Kedatangan santri sudah pernah tercatat.' }

  const aktual = waktuDatang.includes('T') ? parseWibDateTime(waktuDatang) : parseWibDate(waktuDatang, 'start')
  if (!isValidDateValue(aktual)) return { error: 'Waktu datang tidak valid.' }

  const rencana = new Date(izin.tgl_selesai_rencana)
  const isTelat = aktual > rencana
  const statusFinal = isTelat ? 'AKTIF' : 'KEMBALI'

  // Hitung tanggal hari ini WIB (untuk sinkronisasi absen malam)
  const tanggalHariIni = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(aktual)

  const db = await getDB()
  await db.batch([
    // Update status perizinan
    db.prepare('UPDATE perizinan SET status = ?, tgl_kembali_aktual = ? WHERE id = ? AND tgl_kembali_aktual IS NULL')
      .bind(statusFinal, aktual.toISOString(), id),
    // Hapus record absen malam hari ini untuk santri ini (non-MANUAL_OVERRIDE)
    // agar absen malam otomatis kembali ke HADIR / default saat di-refresh
    db.prepare(
      `DELETE FROM absen_malam_v2 WHERE tanggal = ? AND santri_id = ? AND (sumber_status IS NULL OR sumber_status != 'MANUAL_OVERRIDE')`
    ).bind(tanggalHariIni, izin.santri_id),
  ])

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
  revalidatePath('/dashboard/keamanan/rekap-absen-malam')

  if (isTelat) return { success: true, message: 'Terlambat! Masuk antrian verifikasi.' }
  return { success: true, message: 'Tepat waktu. Izin selesai.' }
}

export async function cariSantri(keyword: string, requestedAsrama?: string) {
  const scope = await resolvePerizinanScope(requestedAsrama)
  if ('error' in scope) return []

  const scopeClause = scope.asrama ? ' AND s.asrama = ?' : ''
  const params = scope.asrama
    ? [`%${keyword}%`, `%${keyword}%`, scope.asrama]
    : [`%${keyword}%`, `%${keyword}%`]
  return query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
           k.nama_kelas AS kelas
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE (s.nama_lengkap LIKE ? OR s.nis LIKE ?)${scopeClause}
    LIMIT 5
  `, params)
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

// ─── Cari Santri terbatas ke asrama binaan ───────────────────────────────────
export async function cariSantriAsrama(keyword: string, asramaBinaan: string) {
  const scope = await resolvePerizinanScope(asramaBinaan)
  if ('error' in scope || !scope.asrama) return []
  return query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
           k.nama_kelas AS kelas
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE s.nama_lengkap LIKE ? AND s.asrama = ? AND s.status_global = 'aktif'
    LIMIT 5
  `, [`%${keyword}%`, scope.asrama])
}

// ─── Ajukan Izin Pulang (oleh pengurus asrama) ────────────────────────────────
export async function ajukanIzinAsrama(formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const access = await assertFeature('/dashboard/keamanan/perizinan', 'create')
  if ('error' in access) return access
  const session = await getSession()

  if (!session?.asrama_binaan) return { error: 'Akun Anda belum memiliki asrama binaan.' }

  const santri_id = String(formData.get('santri_id') ?? '').trim()
  if (!santri_id) return { error: 'Santri wajib dipilih.' }

  const payload = buildIzinPayload(formData)
  if ('error' in payload) return payload

  const { jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin } = payload
  const pemberiIzinError = await validatePemberiIzin(pemberi_izin)
  if (pemberiIzinError) return pemberiIzinError

  const santri = await queryOne<{ nama_lengkap: string | null; nis: string | null; asrama: string | null }>(
    'SELECT nama_lengkap, nis, asrama FROM santri WHERE id = ?',
    [santri_id]
  )

  if (santri?.asrama !== session.asrama_binaan) {
    return { error: 'Santri ini bukan dari asrama binaan Anda.' }
  }

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
    summary: `Mengajukan ${jenis === 'PULANG' ? 'izin pulang' : 'izin keluar kompleks'} untuk ${santri?.nama_lengkap || santri?.nis || santri_id}`,
    details: { jenis, alasan: alasan_final, pemberi_izin, tgl_mulai, tgl_selesai_rencana },
  })

  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true }
}

// ─── Riwayat Pengajuan (ter-scope, terfilter, dan berpaginasi) ───────────────
export async function getRiwayatPengajuan(params: {
  page?: number
  pageSize?: number
  search?: string
  asrama?: string
  tglAwal?: string
  tglAkhir?: string
  statusFilter?: 'SEMUA' | 'PENDING' | 'APPROVED' | 'REJECTED'
  jenisFilter?: 'SEMUA' | 'PULANG' | 'KELUAR_KOMPLEK'
  exportAll?: boolean
} = {}) {
  const page = Math.max(1, Number(params.page) || 1)
  // The on-screen table remains small, while export can request the complete
  // filtered result set without bypassing the same scope and WHERE clauses.
  const pageSize = Math.min(10000, Math.max(1, Number(params.pageSize) || 10))
  const scope = await resolvePerizinanScope(params.asrama)
  if ('error' in scope) return { rows: [], total: 0, page, totalPages: 0, error: scope.error }
  await ensurePengajuanTable()

  const clauses: string[] = []
  const values: any[] = []
  if (scope.asrama) {
    clauses.push('s.asrama = ?')
    values.push(scope.asrama)
  } else if (params.asrama && params.asrama !== 'SEMUA') {
    clauses.push('s.asrama = ?')
    values.push(params.asrama)
  }
  if (params.search?.trim()) {
    const search = `%${params.search.trim()}%`
    clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ? OR pq.alasan LIKE ?)')
    values.push(search, search, search)
  }

  if (params.jenisFilter && params.jenisFilter !== 'SEMUA') {
    clauses.push('pq.jenis = ?')
    values.push(params.jenisFilter)
  }
  if (params.statusFilter && params.statusFilter !== 'SEMUA') {
    clauses.push('pq.status = ?')
    values.push(params.statusFilter)
  }
  if (params.tglAwal) {
    clauses.push('pq.tgl_mulai >= ?')
    values.push(new Date(`${params.tglAwal}T00:00:00+07:00`).toISOString())
  }
  if (params.tglAkhir) {
    clauses.push('pq.tgl_mulai <= ?')
    values.push(new Date(`${params.tglAkhir}T23:59:59+07:00`).toISOString())
  }

  const where = clauses.length ? clauses.join(' AND ') : '1=1'
  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM perizinan_pengajuan pq
     JOIN santri s ON s.id = pq.santri_id
     WHERE ${where}`,
    values
  )
  const total = Number(countRow?.total || 0)
  const offset = (page - 1) * pageSize
  const rows = await query<any>(
    `SELECT pq.id, pq.created_at, pq.jenis, pq.alasan, pq.pemberi_izin,
            pq.tgl_mulai, pq.tgl_selesai_rencana, pq.status, pq.reviewed_at,
            pq.santri_id,
            s.nama_lengkap AS nama, s.nis, s.asrama, s.kamar,
            k.nama_kelas AS kelas,
            u.full_name AS submitted_by_name,
            reviewer.full_name AS reviewed_by_name
     FROM perizinan_pengajuan pq
     JOIN santri s ON s.id = pq.santri_id
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON k.id = rp.kelas_id
     LEFT JOIN users u ON u.id = pq.submitted_by
     LEFT JOIN users reviewer ON reviewer.id = pq.reviewed_by
     WHERE ${where}
     ORDER BY pq.created_at DESC
     ${params.exportAll ? '' : 'LIMIT ? OFFSET ?'}`,
    params.exportAll ? values : [...values, pageSize, offset]
  )

  return { rows, total, page, totalPages: Math.ceil(total / pageSize) }
}

export async function getRiwayatPengajuanAsrama(): Promise<any[]> {
  const result = await getRiwayatPengajuan({ page: 1, pageSize: 100 })
  return result.rows
}

/** Export the complete, filtered submission history using the same resolver as the tab. */
export async function exportRiwayatPengajuan(params: {
  search?: string
  asrama?: string
  tglAwal?: string
  tglAkhir?: string
  statusFilter?: 'SEMUA' | 'PENDING' | 'APPROVED' | 'REJECTED'
  jenisFilter?: 'SEMUA' | 'PULANG' | 'KELUAR_KOMPLEK'
} = {}) {
  const result = await getRiwayatPengajuan({ ...params, page: 1, pageSize: 100, exportAll: true })
  return result.rows
}

// ─── Update Pengajuan PENDING milik asrama ────────────────────────────────────
export async function updatePengajuanAsrama(id: string, formData: FormData): Promise<{ success: boolean } | { error: string }> {
  const access = await assertManagedMutation('update')
  if ('error' in access) return access
  const session = await getSession()
  if (!session?.asrama_binaan) return { error: 'Akun Anda belum memiliki asrama binaan.' }

  const pengajuan = await queryOne<any>(`
    SELECT pq.id FROM perizinan_pengajuan pq
    JOIN santri s ON s.id = pq.santri_id
    WHERE pq.id = ? AND pq.status = 'PENDING' AND s.asrama = ?
  `, [id, session.asrama_binaan])

  if (!pengajuan) return { error: 'Pengajuan tidak ditemukan, sudah diproses, atau bukan milik asrama Anda.' }

  const payload = buildIzinPayload(formData)
  if ('error' in payload) return payload

  const { jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin } = payload
  const pemberiIzinError = await validatePemberiIzin(pemberi_izin)
  if (pemberiIzinError) return pemberiIzinError

  await execute(`
    UPDATE perizinan_pengajuan
    SET jenis = ?, tgl_mulai = ?, tgl_selesai_rencana = ?, alasan = ?, pemberi_izin = ?
    WHERE id = ?
  `, [jenis, tgl_mulai, tgl_selesai_rencana, alasan_final, pemberi_izin, id])

  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true }
}

// ─── Hapus Pengajuan PENDING milik asrama ─────────────────────────────────────
export async function hapusPengajuanAsrama(id: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertManagedMutation('delete')
  if ('error' in access) return access
  const session = await getSession()
  if (!session?.asrama_binaan) return { error: 'Akun Anda belum memiliki asrama binaan.' }

  const pengajuan = await queryOne<any>(`
    SELECT pq.id FROM perizinan_pengajuan pq
    JOIN santri s ON s.id = pq.santri_id
    WHERE pq.id = ? AND pq.status = 'PENDING' AND s.asrama = ?
  `, [id, session.asrama_binaan])

  if (!pengajuan) return { error: 'Pengajuan tidak ditemukan, sudah diproses, atau bukan milik asrama Anda.' }

  await execute('DELETE FROM perizinan_pengajuan WHERE id = ?', [id])

  revalidatePath('/dashboard/keamanan/perizinan')
  return { success: true }
}

// ─── Get Pengajuan Pending dari Asrama ────────────────────────────────────────
export async function getPengajuanPendingAsrama(requestedAsrama?: string): Promise<any[]> {
  const scope = await resolvePerizinanScope(requestedAsrama)
  if ('error' in scope) return []
  try {
    await ensurePengajuanTable()
    return await query<any>(`
      SELECT pq.id, pq.created_at, pq.jenis, pq.alasan, pq.pemberi_izin,
             pq.tgl_mulai, pq.tgl_selesai_rencana, pq.status,
             pq.santri_id,
             s.nama_lengkap AS nama, s.nis, s.asrama, s.kamar,
             k.nama_kelas AS kelas,
             u.full_name AS submitted_by_name
      FROM perizinan_pengajuan pq
      JOIN santri s ON s.id = pq.santri_id
      LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
      LEFT JOIN kelas k ON k.id = rp.kelas_id
      LEFT JOIN users u ON u.id = pq.submitted_by
      WHERE pq.status = 'PENDING'${scope.asrama ? ' AND s.asrama = ?' : ''}
      ORDER BY pq.created_at ASC
    `, scope.asrama ? [scope.asrama] : [])
  } catch {
    return []
  }
}

// ─── Approve Pengajuan Asrama ─────────────────────────────────────────────────
export async function approveIzinAsrama(id: string, requestedAsrama?: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertManagedMutation('create')
  if ('error' in access) return access
  const session = await getSession()

  if (!hasAnyRole(session, ['dewan_santri', 'admin'])) {
    return { error: 'Hanya dewan santri yang dapat menyetujui pengajuan.' }
  }

  const scope = await resolvePerizinanScope(requestedAsrama)
  if ('error' in scope) return scope
  const scopeClause = scope.asrama ? ' AND s.asrama = ?' : ''
  const scopeParams = scope.asrama ? [scope.asrama] : []

  const pengajuan = await queryOne<any>(`
    SELECT pq.*, s.nama_lengkap, s.nis
    FROM perizinan_pengajuan pq
    JOIN santri s ON s.id = pq.santri_id
    WHERE pq.id = ? AND pq.status = 'PENDING'${scopeClause}
  `, [id, ...scopeParams])

  if (!pengajuan) return { error: 'Pengajuan tidak ditemukan atau sudah diproses.' }

  const overlap = await findOverlappingIzin(pengajuan.santri_id, pengajuan.tgl_mulai, pengajuan.tgl_selesai_rencana)
  if (overlap) return { error: 'Santri sudah memiliki izin aktif pada rentang waktu tersebut.' }

  const izinId = generateId()

  await execute(`
    INSERT INTO perizinan (id, santri_id, jenis, tgl_mulai, tgl_selesai_rencana, alasan, pemberi_izin, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?)
  `, [izinId, pengajuan.santri_id, pengajuan.jenis, pengajuan.tgl_mulai,
      pengajuan.tgl_selesai_rencana, pengajuan.alasan, pengajuan.pemberi_izin,
      session?.id ?? null])

  // Hapus record absen_malam_v2 (non-MANUAL_OVERRIDE) yang tercakup dalam periode izin
  try {
    const mulaiDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(pengajuan.tgl_mulai))
    const selesaiDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(pengajuan.tgl_selesai_rencana))
    await execute(
      `DELETE FROM absen_malam_v2 WHERE santri_id = ? AND tanggal >= ? AND tanggal <= ? AND (sumber_status IS NULL OR sumber_status != 'MANUAL_OVERRIDE')`,
      [pengajuan.santri_id, mulaiDate, selesaiDate]
    )
  } catch { /* non-fatal */ }

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
    summary: `Menyetujui ${pengajuan.jenis === 'PULANG' ? 'izin pulang' : 'izin keluar kompleks'} ${pengajuan.nama_lengkap || pengajuan.santri_id}`,
    details: { dari_pengajuan: id },
  })

  revalidatePath('/dashboard/keamanan/perizinan')
  revalidatePath('/dashboard/asrama/absen-malam')
  revalidatePath('/dashboard/keamanan/rekap-absen-malam')
  return { success: true }
}

// ─── Reject Pengajuan Asrama ──────────────────────────────────────────────────
export async function rejectIzinAsrama(id: string, requestedAsrama?: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertManagedMutation('update')
  if ('error' in access) return access
  const session = await getSession()

  if (!hasAnyRole(session, ['dewan_santri', 'admin'])) {
    return { error: 'Hanya dewan santri yang dapat menolak pengajuan.' }
  }

  const scope = await resolvePerizinanScope(requestedAsrama)
  if ('error' in scope) return scope
  const scopeClause = scope.asrama ? ' AND s.asrama = ?' : ''
  const scopeParams = scope.asrama ? [scope.asrama] : []

  const pengajuan = await queryOne<any>(
    `SELECT pq.id, pq.santri_id
     FROM perizinan_pengajuan pq
     JOIN santri s ON s.id = pq.santri_id
     WHERE pq.id = ? AND pq.status = ?${scopeClause}`,
    [id, 'PENDING', ...scopeParams]
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

export async function hapusIzin(id: string, requestedAsrama?: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertManagedMutation('delete')
  if ('error' in access) return access
  const session = await getSession()
  const scope = await resolvePerizinanScope(requestedAsrama)
  if ('error' in scope) return scope
  const scopeClause = scope.asrama ? ' AND s.asrama = ?' : ''
  const scopeParams = scope.asrama ? [scope.asrama] : []
  const izin = await queryOne<{
    id: string
    jenis: string | null
    alasan: string | null
    nama_lengkap: string | null
  }>(
    `SELECT p.id, p.jenis, p.alasan, s.nama_lengkap
     FROM perizinan p
     LEFT JOIN santri s ON s.id = p.santri_id
     WHERE p.id = ?${scopeClause}`,
    [id, ...scopeParams]
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
