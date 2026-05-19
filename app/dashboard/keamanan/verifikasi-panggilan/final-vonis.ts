'use server'

import { batch, execute, generateId, now, query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

type SourceType = 'pengajian' | 'berjamaah'
export type FinalStatus = 'ALFA' | 'IZIN' | 'SAKIT' | 'HADIR' | 'MANGKIR'
export type FinalFilterStatus = 'BELUM' | 'MANGKIR' | 'SELESAI' | 'SEMUA'

export type FinalVonisItem = {
  key: string
  panggilan_id: string
  santri_id: string
  nama: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  periode_awal: string
  periode_akhir: string
  source: SourceType
  tanggal: string
  sesi: string
  catatan_panggilan: string | null
  final_status: FinalStatus | null
  final_catatan: string | null
}

type SnapshotEvent = {
  source: SourceType
  tanggal: string
  sesi: string
  counted?: boolean
}

type SaveFinalPayload = {
  panggilanId: string
  santriId: string
  periodeAwal: string
  periodeAkhir: string
  source: SourceType
  tanggal: string
  sesi: string
  status: FinalStatus
  catatan?: string
}

const SOURCE_PATH: Record<SourceType, string> = {
  pengajian: '/dashboard/akademik/absensi/verifikasi',
  berjamaah: '/dashboard/keamanan/verifikasi-berjamaah',
}

const PENGAJIAN_SESI = ['shubuh', 'ashar', 'maghrib'] as const
const BERJAMAAH_SESI = ['shubuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as const

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

async function ensureFinalVonisTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS verifikasi_panggilan_vonis (
      id TEXT PRIMARY KEY,
      panggilan_id TEXT NOT NULL REFERENCES verifikasi_panggilan(id),
      periode_awal TEXT NOT NULL,
      periode_akhir TEXT NOT NULL,
      santri_id TEXT NOT NULL REFERENCES santri(id),
      source TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      sesi TEXT NOT NULL,
      status_final TEXT NOT NULL,
      catatan TEXT,
      pelanggaran_id TEXT REFERENCES pelanggaran(id),
      verified_by TEXT REFERENCES users(id),
      verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(panggilan_id, source, tanggal, sesi)
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_periode ON verifikasi_panggilan_vonis(periode_awal, periode_akhir, source)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_status ON verifikasi_panggilan_vonis(status_final)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_verifikasi_panggilan_vonis_santri ON verifikasi_panggilan_vonis(santri_id)`)

  try {
    await execute(`ALTER TABLE absen_berjamaah ADD COLUMN dzuhur TEXT`)
  } catch {
    // Kolom sudah tersedia pada database yang sudah termigrasi.
  }
}

function parseSnapshot(value: string) {
  try {
    return JSON.parse(value) as {
      nama?: string
      nis?: string | null
      asrama?: string | null
      kamar?: string | null
      events?: SnapshotEvent[]
    }
  } catch {
    return { events: [] }
  }
}

function eventKey(panggilanId: string, source: SourceType, tanggal: string, sesi: string) {
  return `${panggilanId}|${source}|${tanggal}|${sesi}`
}

async function getPengajianAbsensiId(santriId: string, tanggal: string) {
  const row = await queryOne<{ id: string }>(`
    SELECT ah.id
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    WHERE rp.santri_id = ? AND rp.status_riwayat = 'aktif' AND ah.tanggal = ?
    LIMIT 1
  `, [santriId, tanggal])
  return row?.id || null
}

function pengajianColumns(sesi: string) {
  if (!PENGAJIAN_SESI.includes(sesi as any)) throw new Error(`Sesi pengajian tidak valid: ${sesi}`)
  return { statusColumn: sesi, verifColumn: `verif_${sesi}` }
}

function berjamaahColumn(sesi: string) {
  if (!BERJAMAAH_SESI.includes(sesi as any)) throw new Error(`Waktu berjamaah tidak valid: ${sesi}`)
  return sesi
}

async function applyPengajianStatus(payload: SaveFinalPayload) {
  const absenId = await getPengajianAbsensiId(payload.santriId, payload.tanggal)
  if (!absenId) return

  const { statusColumn, verifColumn } = pengajianColumns(payload.sesi)
  if (payload.status === 'MANGKIR') return
  if (payload.status === 'ALFA') {
    await execute(`UPDATE absensi_harian SET ${verifColumn} = 'OK' WHERE id = ?`, [absenId])
    return
  }

  const nextStatus = payload.status === 'IZIN' ? 'I' : payload.status === 'SAKIT' ? 'S' : 'H'
  await execute(`UPDATE absensi_harian SET ${statusColumn} = ?, ${verifColumn} = NULL WHERE id = ?`, [nextStatus, absenId])
}

async function applyBerjamaahStatus(payload: SaveFinalPayload) {
  if (payload.status === 'MANGKIR' || payload.status === 'ALFA') return
  const column = berjamaahColumn(payload.sesi)

  if (payload.status === 'HADIR') {
    await execute(`UPDATE absen_berjamaah SET ${column} = NULL WHERE santri_id = ? AND tanggal = ?`, [payload.santriId, payload.tanggal])
    await execute(`
      DELETE FROM absen_berjamaah
      WHERE santri_id = ? AND tanggal = ?
        AND shubuh IS NULL AND dzuhur IS NULL AND ashar IS NULL AND maghrib IS NULL AND isya IS NULL
    `, [payload.santriId, payload.tanggal])
    return
  }

  const nextStatus = payload.status === 'IZIN' ? 'P' : 'S'
  const session = await getSession()
  await execute(`
    INSERT INTO absen_berjamaah (santri_id, tanggal, ${column}, created_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(santri_id, tanggal) DO UPDATE SET ${column} = excluded.${column}
  `, [payload.santriId, payload.tanggal, nextStatus, session?.id ?? null])
}

async function createPelanggaranIfNeeded(payload: SaveFinalPayload, existingPelanggaranId: string | null) {
  if (payload.status !== 'ALFA') return existingPelanggaranId
  if (existingPelanggaranId) return existingPelanggaranId

  const session = await getSession()
  const id = generateId()
  const jenis = payload.source === 'pengajian' ? 'ALFA_PENGAJIAN' : 'ALFA_BERJAMAAH'
  const label = payload.source === 'pengajian' ? 'Alfa Pengajian' : 'Alfa Berjamaah'
  const detail = `${payload.tanggal} (${payload.sesi})`

  await execute(`
    INSERT INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin, penindak_id)
    VALUES (?, ?, ?, ?, ?, 10, ?)
  `, [id, payload.santriId, now(), jenis, `${label}.\nDetail: ${detail}`, session?.id ?? null])

  return id
}

export async function getFinalVonisQueue(
  source: SourceType,
  tanggalRef: string,
  filters: { status?: FinalFilterStatus; search?: string; asrama?: string } = {}
) {
  await ensureFinalVonisTable()
  const { start, end } = getWeekRangeFromRef(tanggalRef)
  const rows = await query<any>(`
    SELECT vp.id AS panggilan_id, vp.periode_awal, vp.periode_akhir, vp.santri_id,
           vp.snapshot_json, vp.catatan AS catatan_panggilan,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM verifikasi_panggilan vp
    JOIN santri s ON s.id = vp.santri_id
    WHERE vp.periode_awal = ? AND vp.periode_akhir = ? AND vp.keputusan = 'DIPANGGIL'
    ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
  `, [start, end])

  if (!rows.length) return { periode: { start, end }, rows: [] as FinalVonisItem[] }

  const panggilanIds = rows.map((row: any) => row.panggilan_id)
  const ph = panggilanIds.map(() => '?').join(',')
  const existing = await query<any>(`
    SELECT panggilan_id, source, tanggal, sesi, status_final, catatan
    FROM verifikasi_panggilan_vonis
    WHERE panggilan_id IN (${ph}) AND source = ?
  `, [...panggilanIds, source])
  const existingMap = new Map(existing.map((row: any) => [eventKey(row.panggilan_id, row.source, row.tanggal, row.sesi), row]))

  const list: FinalVonisItem[] = []
  for (const row of rows) {
    const snapshot = parseSnapshot(row.snapshot_json)
    const events = (snapshot.events || []).filter((event) => event.source === source && event.counted !== false)
    for (const event of events) {
      const key = eventKey(row.panggilan_id, source, event.tanggal, event.sesi)
      const final = existingMap.get(key)
      list.push({
        key,
        panggilan_id: row.panggilan_id,
        santri_id: row.santri_id,
        nama: snapshot.nama || row.nama_lengkap,
        nis: snapshot.nis ?? row.nis ?? null,
        asrama: snapshot.asrama ?? row.asrama ?? null,
        kamar: snapshot.kamar ?? row.kamar ?? null,
        periode_awal: row.periode_awal,
        periode_akhir: row.periode_akhir,
        source,
        tanggal: event.tanggal,
        sesi: event.sesi,
        catatan_panggilan: row.catatan_panggilan ?? null,
        final_status: final?.status_final ?? null,
        final_catatan: final?.catatan ?? null,
      })
    }
  }

  const status = filters.status || 'BELUM'
  const search = (filters.search || '').trim().toLowerCase()
  const filtered = list.filter((item) => {
    if (filters.asrama && item.asrama !== filters.asrama) return false
    if (search && !item.nama.toLowerCase().includes(search) && !(item.nis || '').includes(search)) return false
    if (status === 'BELUM') return !item.final_status
    if (status === 'MANGKIR') return item.final_status === 'MANGKIR'
    if (status === 'SELESAI') return !!item.final_status && item.final_status !== 'MANGKIR'
    return true
  })

  return { periode: { start, end }, rows: filtered }
}

export async function simpanFinalVonis(daftar: SaveFinalPayload[]) {
  await ensureFinalVonisTable()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!daftar.length) return { error: 'Tidak ada vonis untuk disimpan.' }

  const savedAt = now()
  const statements: { sql: string; params: unknown[] }[] = []

  for (const item of daftar) {
    const existing = await queryOne<{ id: string; pelanggaran_id: string | null }>(`
      SELECT id, pelanggaran_id
      FROM verifikasi_panggilan_vonis
      WHERE panggilan_id = ? AND source = ? AND tanggal = ? AND sesi = ?
    `, [item.panggilanId, item.source, item.tanggal, item.sesi])

    if (item.source === 'pengajian') await applyPengajianStatus(item)
    else await applyBerjamaahStatus(item)

    const pelanggaranId = await createPelanggaranIfNeeded(item, existing?.pelanggaran_id ?? null)

    statements.push({
      sql: `
        INSERT INTO verifikasi_panggilan_vonis
          (id, panggilan_id, periode_awal, periode_akhir, santri_id, source, tanggal, sesi,
           status_final, catatan, pelanggaran_id, verified_by, verified_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(panggilan_id, source, tanggal, sesi) DO UPDATE SET
          status_final = excluded.status_final,
          catatan = excluded.catatan,
          pelanggaran_id = excluded.pelanggaran_id,
          verified_by = excluded.verified_by,
          verified_at = excluded.verified_at,
          updated_at = excluded.updated_at
      `,
      params: [
        generateId(),
        item.panggilanId,
        item.periodeAwal,
        item.periodeAkhir,
        item.santriId,
        item.source,
        item.tanggal,
        item.sesi,
        item.status,
        item.catatan?.trim() || null,
        pelanggaranId,
        session.id,
        savedAt,
        savedAt,
      ],
    })
  }

  for (let i = 0; i < statements.length; i += 50) {
    await batch(statements.slice(i, i + 50))
  }

  const source = daftar[0]?.source || 'pengajian'
  await logActivity({
    actor: actorFromSession(session),
    module: source === 'pengajian' ? 'akademik_absensi_vonis_final' : 'keamanan_berjamaah_vonis_final',
    action: 'approval',
    fiturHref: SOURCE_PATH[source],
    logKind: 'update',
    entityType: 'verifikasi_panggilan_vonis_batch',
    entityId: `${source}:${savedAt}`,
    entityLabel: source === 'pengajian' ? 'Vonis final pengajian' : 'Vonis final berjamaah',
    summary: `Menyimpan ${daftar.length} vonis final ${source}`,
    details: {
      total: daftar.length,
      alfa: daftar.filter((item) => item.status === 'ALFA').length,
      izin: daftar.filter((item) => item.status === 'IZIN').length,
      sakit: daftar.filter((item) => item.status === 'SAKIT').length,
      hadir: daftar.filter((item) => item.status === 'HADIR').length,
      mangkir: daftar.filter((item) => item.status === 'MANGKIR').length,
    },
  })

  revalidatePath(SOURCE_PATH[source])
  revalidatePath('/dashboard/keamanan/verifikasi-panggilan')
  revalidatePath('/dashboard/keamanan')
  return { success: true, count: daftar.length }
}
