'use server'

import { batch, execute, generateId, now, query } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { getCachedMarhalahList } from '@/lib/cache/master'

const FEATURE_PATH = '/dashboard/keamanan/verifikasi-panggilan'
const PENGAJIAN_SESI = ['shubuh', 'ashar', 'maghrib'] as const
const BERJAMAAH_SESI = ['shubuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as const
const SICK_REASON_RE = /(SAKIT|BEROBAT|KONTROL)/i

export type KeputusanPanggilan = 'DIPANGGIL' | 'TIDAK_DIPANGGIL'
export type FilterStatusPanggilan = 'BELUM' | 'DIPANGGIL' | 'TIDAK_DIPANGGIL' | 'SEMUA'

export type AlfaEvent = {
  source: 'pengajian' | 'berjamaah'
  tanggal: string
  sesi: string
  label: string
  counted: boolean
  gugur_karena: string | null
}

export type IzinContext = {
  id: string
  alasan: string
  mulai: string
  selesai_rencana: string
  kembali_aktual: string | null
  status: string
  is_sakit: boolean
}

export type SakitContext = {
  id: string
  sakit_apa: string | null
  mulai_at: string | null
  sembuh_at: string | null
  status_sakit: string | null
}

export type VerifikasiPanggilanItem = {
  santri_id: string
  nama: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  kelas: string | null
  suggested: KeputusanPanggilan
  existing_decision: KeputusanPanggilan | null
  existing_catatan: string | null
  jumlah_alfa_pengajian: number
  jumlah_alfa_berjamaah: number
  total_alfa: number
  total_mentah: number
  events: AlfaEvent[]
  izin: IzinContext[]
  sakit: SakitContext[]
}

type SavePayload = {
  santriId: string
  keputusan: KeputusanPanggilan
  catatan?: string
  snapshot: VerifikasiPanggilanItem
}

function dateFromYmd(dateStr: string) {
  return new Date(`${dateStr}T12:00:00.000Z`)
}

function ymdFromDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number) {
  const d = dateFromYmd(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return ymdFromDate(d)
}

function getWeekRangeFromRef(tanggalRef: string) {
  const ref = dateFromYmd(tanggalRef)
  const day = ref.getUTCDay()
  const diff = day >= 3 ? day - 3 : day + 4
  ref.setUTCDate(ref.getUTCDate() - diff)
  const start = ymdFromDate(ref)
  return { start, end: addDays(start, 6) }
}

function datePartsInWib(value: string | null | undefined) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

async function ensureVerifikasiTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS verifikasi_panggilan (
      id TEXT PRIMARY KEY,
      periode_awal TEXT NOT NULL,
      periode_akhir TEXT NOT NULL,
      santri_id TEXT NOT NULL REFERENCES santri(id),
      keputusan TEXT NOT NULL,
      jumlah_alfa_pengajian INTEGER NOT NULL DEFAULT 0,
      jumlah_alfa_berjamaah INTEGER NOT NULL DEFAULT 0,
      total_alfa INTEGER NOT NULL DEFAULT 0,
      snapshot_json TEXT NOT NULL,
      catatan TEXT,
      verified_by TEXT REFERENCES users(id),
      verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(periode_awal, periode_akhir, santri_id)
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_periode ON verifikasi_panggilan(periode_awal, periode_akhir)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_keputusan ON verifikasi_panggilan(keputusan)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_santri ON verifikasi_panggilan(santri_id)`)
}

function placeholders(ids: string[]) {
  return ids.map(() => '?').join(',')
}

function buildStudentWhere(filters: { kelasId?: string; asrama?: string; marhalahId?: string }) {
  const clauses = [`s.status_global = 'aktif'`, `rp.status_riwayat = 'aktif'`]
  const params: unknown[] = []
  if (filters.kelasId) {
    clauses.push('rp.kelas_id = ?')
    params.push(filters.kelasId)
  }
  if (filters.asrama) {
    clauses.push('s.asrama = ?')
    params.push(filters.asrama)
  }
  if (filters.marhalahId) {
    clauses.push('k.marhalah_id = ?')
    params.push(filters.marhalahId)
  }
  return { where: clauses.join(' AND '), params }
}

function getIzinExcuse(eventDate: string, izinList: IzinContext[]) {
  for (const izin of izinList) {
    const mulai = datePartsInWib(izin.mulai)
    const selesai = datePartsInWib(izin.selesai_rencana)
    const kembali = datePartsInWib(izin.kembali_aktual)
    if (!mulai || !selesai || eventDate < mulai) continue

    const plannedEnd = kembali && kembali < selesai ? kembali : selesai
    if (eventDate <= plannedEnd) return `Izin pulang: ${izin.alasan}`

    if (izin.is_sakit) {
      if (!kembali || eventDate <= kembali) return `Izin sakit: ${izin.alasan}`
    }
  }
  return null
}

function emptyItem(row: any): VerifikasiPanggilanItem {
  return {
    santri_id: row.santri_id,
    nama: row.nama_lengkap,
    nis: row.nis ?? null,
    asrama: row.asrama ?? null,
    kamar: row.kamar ?? null,
    kelas: row.nama_kelas ?? null,
    suggested: 'TIDAK_DIPANGGIL',
    existing_decision: null,
    existing_catatan: null,
    jumlah_alfa_pengajian: 0,
    jumlah_alfa_berjamaah: 0,
    total_alfa: 0,
    total_mentah: 0,
    events: [],
    izin: [],
    sakit: [],
  }
}

function collectEvents(row: any, source: 'pengajian' | 'berjamaah') {
  const sesiList = source === 'pengajian' ? PENGAJIAN_SESI : BERJAMAAH_SESI
  return sesiList
    .filter((sesi) => row[sesi] === 'A')
    .map((sesi) => ({
      source,
      tanggal: row.tanggal,
      sesi,
      label: sesi,
      counted: true,
      gugur_karena: null,
    } satisfies AlfaEvent))
}

export async function getAntrianPanggilan(
  tanggalRef: string,
  filters: { kelasId?: string; asrama?: string; marhalahId?: string; status?: FilterStatusPanggilan } = {}
) {
  await ensureVerifikasiTable()
  const { start, end } = getWeekRangeFromRef(tanggalRef)
  const studentFilter = buildStudentWhere(filters)
  const status = filters.status || 'BELUM'

  const pengajianRows = await query<any>(`
    SELECT s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar, k.nama_kelas,
           ah.tanggal, ah.shubuh, ah.ashar, ah.maghrib
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE ${studentFilter.where}
      AND ah.tanggal >= ? AND ah.tanggal <= ?
      AND (ah.shubuh = 'A' OR ah.ashar = 'A' OR ah.maghrib = 'A')
    ORDER BY s.nama_lengkap, ah.tanggal
  `, [...studentFilter.params, start, end])

  const berjamaahRows = await query<any>(`
    SELECT s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar, k.nama_kelas,
           ab.tanggal, ab.shubuh, ab.dzuhur, ab.ashar, ab.maghrib, ab.isya
    FROM absen_berjamaah ab
    JOIN santri s ON s.id = ab.santri_id
    JOIN riwayat_pendidikan rp ON rp.santri_id = s.id
    JOIN kelas k ON k.id = rp.kelas_id
    WHERE ${studentFilter.where}
      AND ab.tanggal >= ? AND ab.tanggal <= ?
      AND (ab.shubuh = 'A' OR ab.dzuhur = 'A' OR ab.ashar = 'A' OR ab.maghrib = 'A' OR ab.isya = 'A')
    ORDER BY s.nama_lengkap, ab.tanggal
  `, [...studentFilter.params, start, end])

  const itemMap = new Map<string, VerifikasiPanggilanItem>()
  for (const row of [...pengajianRows, ...berjamaahRows]) {
    if (!itemMap.has(row.santri_id)) itemMap.set(row.santri_id, emptyItem(row))
  }

  const santriIds = Array.from(itemMap.keys())
  if (santriIds.length === 0) return { periode: { start, end }, rows: [] as VerifikasiPanggilanItem[] }

  const ph = placeholders(santriIds)
  const startIso = `${start}T00:00:00.000Z`
  const endIso = `${end}T23:59:59.999Z`

  const decisions = await query<any>(`
    SELECT santri_id, keputusan, catatan, snapshot_json
    FROM verifikasi_panggilan
    WHERE periode_awal = ? AND periode_akhir = ? AND santri_id IN (${ph})
  `, [start, end, ...santriIds])
  const decisionMap = new Map(decisions.map((d: any) => [d.santri_id, d]))

  const izinRows = await query<any>(`
    SELECT id, santri_id, alasan, tgl_mulai, tgl_selesai_rencana, tgl_kembali_aktual, status
    FROM perizinan
    WHERE jenis = 'PULANG'
      AND santri_id IN (${ph})
      AND tgl_mulai <= ?
      AND (tgl_selesai_rencana >= ? OR tgl_kembali_aktual >= ? OR status = 'AKTIF')
    ORDER BY tgl_mulai
  `, [...santriIds, endIso, startIso, startIso])

  const sakitRows = await query<any>(`
    SELECT id, santri_id, sakit_apa, status_sakit, mulai_at, sembuh_at
    FROM absen_sakit
    WHERE santri_id IN (${ph})
      AND COALESCE(mulai_at, tanggal || 'T00:00:00.000Z') <= ?
      AND (sembuh_at IS NULL OR sembuh_at >= ? OR status_sakit = 'SAKIT')
    ORDER BY COALESCE(mulai_at, tanggal)
  `, [...santriIds, endIso, startIso])

  const izinBySantri = new Map<string, IzinContext[]>()
  for (const row of izinRows) {
    const ctx: IzinContext = {
      id: row.id,
      alasan: row.alasan || '-',
      mulai: row.tgl_mulai,
      selesai_rencana: row.tgl_selesai_rencana,
      kembali_aktual: row.tgl_kembali_aktual ?? null,
      status: row.status,
      is_sakit: SICK_REASON_RE.test(row.alasan || ''),
    }
    izinBySantri.set(row.santri_id, [...(izinBySantri.get(row.santri_id) || []), ctx])
  }

  const sakitBySantri = new Map<string, SakitContext[]>()
  for (const row of sakitRows) {
    const ctx: SakitContext = {
      id: row.id,
      sakit_apa: row.sakit_apa ?? null,
      mulai_at: row.mulai_at ?? null,
      sembuh_at: row.sembuh_at ?? null,
      status_sakit: row.status_sakit ?? null,
    }
    sakitBySantri.set(row.santri_id, [...(sakitBySantri.get(row.santri_id) || []), ctx])
  }

  for (const row of pengajianRows) itemMap.get(row.santri_id)!.events.push(...collectEvents(row, 'pengajian'))
  for (const row of berjamaahRows) itemMap.get(row.santri_id)!.events.push(...collectEvents(row, 'berjamaah'))

  const rows = Array.from(itemMap.values()).map((item) => {
    item.izin = izinBySantri.get(item.santri_id) || []
    item.sakit = sakitBySantri.get(item.santri_id) || []
    item.events = item.events
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.source.localeCompare(b.source) || a.sesi.localeCompare(b.sesi))
      .map((event) => {
        const excuse = getIzinExcuse(event.tanggal, item.izin)
        return { ...event, counted: !excuse, gugur_karena: excuse }
      })
    item.jumlah_alfa_pengajian = item.events.filter((e) => e.source === 'pengajian' && e.counted).length
    item.jumlah_alfa_berjamaah = item.events.filter((e) => e.source === 'berjamaah' && e.counted).length
    item.total_alfa = item.jumlah_alfa_pengajian + item.jumlah_alfa_berjamaah
    item.total_mentah = item.events.length
    item.suggested = item.total_alfa > 0 ? 'DIPANGGIL' : 'TIDAK_DIPANGGIL'
    const decision = decisionMap.get(item.santri_id)
    if (decision) {
      item.existing_decision = decision.keputusan
      item.existing_catatan = decision.catatan
    }
    return item
  })

  const filtered = rows.filter((item) => {
    if (status === 'BELUM') return !item.existing_decision
    if (status === 'SEMUA') return true
    return item.existing_decision === status
  })

  return { periode: { start, end }, rows: filtered }
}

export async function simpanVerifikasiPanggilan(
  periode: { start: string; end: string },
  daftar: SavePayload[]
) {
  await ensureVerifikasiTable()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!daftar.length) return { error: 'Tidak ada keputusan untuk disimpan.' }

  const verifiedAt = now()
  const statements = daftar.map((item) => ({
    sql: `
      INSERT INTO verifikasi_panggilan
        (id, periode_awal, periode_akhir, santri_id, keputusan,
         jumlah_alfa_pengajian, jumlah_alfa_berjamaah, total_alfa,
         snapshot_json, catatan, verified_by, verified_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(periode_awal, periode_akhir, santri_id) DO UPDATE SET
        keputusan = excluded.keputusan,
        jumlah_alfa_pengajian = excluded.jumlah_alfa_pengajian,
        jumlah_alfa_berjamaah = excluded.jumlah_alfa_berjamaah,
        total_alfa = excluded.total_alfa,
        snapshot_json = excluded.snapshot_json,
        catatan = excluded.catatan,
        verified_by = excluded.verified_by,
        verified_at = excluded.verified_at,
        updated_at = excluded.updated_at
    `,
    params: [
      generateId(),
      periode.start,
      periode.end,
      item.santriId,
      item.keputusan,
      item.snapshot.jumlah_alfa_pengajian,
      item.snapshot.jumlah_alfa_berjamaah,
      item.snapshot.total_alfa,
      JSON.stringify({ ...item.snapshot, final_decision: item.keputusan, final_catatan: item.catatan || '' }),
      item.catatan?.trim() || null,
      session.id,
      verifiedAt,
      verifiedAt,
    ],
  }))

  for (let i = 0; i < statements.length; i += 50) {
    await batch(statements.slice(i, i + 50))
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan_verifikasi_panggilan',
    action: 'approval',
    fiturHref: FEATURE_PATH,
    logKind: 'update',
    entityType: 'verifikasi_panggilan_batch',
    entityId: `${periode.start}:${periode.end}`,
    entityLabel: `Verifikasi panggilan ${periode.start} s/d ${periode.end}`,
    summary: `Menyimpan ${daftar.length} keputusan verifikasi panggilan`,
    details: {
      periode,
      dipanggil: daftar.filter((item) => item.keputusan === 'DIPANGGIL').length,
      tidak_dipanggil: daftar.filter((item) => item.keputusan === 'TIDAK_DIPANGGIL').length,
    },
  })

  revalidatePath(FEATURE_PATH)
  revalidatePath('/dashboard/keamanan')
  return { success: true, count: daftar.length }
}

export async function getCetakPanggilan(tanggalRef: string) {
  await ensureVerifikasiTable()
  const { start, end } = getWeekRangeFromRef(tanggalRef)
  const rows = await query<any>(`
    SELECT vp.*, s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM verifikasi_panggilan vp
    JOIN santri s ON s.id = vp.santri_id
    WHERE vp.periode_awal = ? AND vp.periode_akhir = ? AND vp.keputusan = 'DIPANGGIL'
    ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
  `, [start, end])

  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const grouped: Record<string, any[]> = {}

  for (const row of rows) {
    let snapshot: VerifikasiPanggilanItem | null = null
    try { snapshot = JSON.parse(row.snapshot_json) } catch { snapshot = null }
    const item = {
      id: row.id,
      santri_id: row.santri_id,
      nama: snapshot?.nama || row.nama_lengkap,
      nis: snapshot?.nis || row.nis,
      asrama: snapshot?.asrama || row.asrama || 'NON-ASRAMA',
      kamar: snapshot?.kamar || row.kamar || '-',
      jumlah_alfa_pengajian: row.jumlah_alfa_pengajian,
      jumlah_alfa_berjamaah: row.jumlah_alfa_berjamaah,
      total_alfa: row.total_alfa,
      catatan: row.catatan,
      events: snapshot?.events || [],
    }
    if (!grouped[item.asrama]) grouped[item.asrama] = []
    grouped[item.asrama].push(item)
  }

  return { periode: { start, end }, days, grouped }
}

export async function getKelasList() {
  const data = await query<any>(`
    SELECT k.id, k.nama_kelas, k.marhalah_id
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    ORDER BY k.nama_kelas
  `)
  return data.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export async function getAsramaList() {
  const data = await query<any>(`
    SELECT DISTINCT asrama
    FROM santri
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL AND asrama != ''
    ORDER BY asrama
  `)
  return data.map((d: any) => d.asrama)
}

export async function getMarhalahList() {
  return getCachedMarhalahList()
}
