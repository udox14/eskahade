'use server'

import { query, queryOne, execute, batch, generateId, now } from '@/lib/db'
import { getSession, hasRole } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { sessionStatement, sessionLinkStatement } from '@/lib/discipline/data'
import { revalidateDiscipline } from '@/lib/discipline/revalidate'
import { getCachedMarhalahList } from '@/lib/cache/master'
import { assertFeature } from '@/lib/auth/feature'
import { getAbsensiWeek } from '@/lib/absensi/pemanggilan'

function getWeekRange(date: Date) {
  const week = getAbsensiWeek(date.toISOString().slice(0, 10))
  return { start: new Date(`${week.start}T12:00:00Z`), end: new Date(`${week.end}T12:00:00Z`) }
}

// ─── Antrian verifikasi absen ─────────────────────────────────────────────────
// Fix row reads:
// 1. Tambah filter verif IS NULL atau verif = 'BELUM' — tidak fetch yang sudah OK
// 2. Tambah LIMIT 3 bulan terakhir — tidak scan data lama yang harusnya sudah diverifikasi
// 3. Pakai INNER JOIN ke santri aktif — tidak fetch data santri yang sudah arsip
export async function getAntrianVerifikasi(tanggalRef?: string, filters: { kelasId?: string, asrama?: string, marhalahId?: string, kategori?: 'REGULER' | 'SADESA' } = {}) {
  const access = await assertFeature('/dashboard/akademik/absensi/verifikasi')
  if ('error' in access) throw new Error(access.error)
  const whereClauses = []
  const params = []

  if (tanggalRef) {
    const { start, end } = getAbsensiWeek(tanggalRef)
    whereClauses.push("ah.tanggal >= ? AND ah.tanggal <= ?")
    params.push(start, end)
  } else {
    const batas = new Date()
    batas.setMonth(batas.getMonth() - 3)
    whereClauses.push("ah.tanggal >= ?")
    params.push(batas.toISOString().slice(0, 10))
  }

  if (filters.kelasId) {
    whereClauses.push("rp.kelas_id = ?")
    params.push(filters.kelasId)
  }
  if (filters.asrama) {
    whereClauses.push("s.asrama = ?")
    params.push(filters.asrama)
  }
  if (filters.marhalahId) {
    whereClauses.push("k.marhalah_id = ?")
    params.push(filters.marhalahId)
  }

  if (filters.kategori) {
    if (!['REGULER', 'SADESA'].includes(filters.kategori)) throw new Error('Kategori tidak valid')
    whereClauses.push("UPPER(TRIM(COALESCE(s.kategori_santri, 'REGULER'))) = ?")
    params.push(filters.kategori)
  }

  const whereSql = whereClauses.join(" AND ")

  const sql = `
    SELECT ah.id, ah.tanggal,
           ah.shubuh, ah.ashar, ah.maghrib,
           ah.verif_shubuh, ah.verif_ashar, ah.verif_maghrib,
           s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM absensi_harian ah
    INNER JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
      AND rp.status_riwayat = 'aktif'
    INNER JOIN santri s ON s.id = rp.santri_id
      AND s.status_global = 'aktif'
    INNER JOIN kelas k ON k.id = rp.kelas_id
    WHERE ${whereSql}
      AND (
        (ah.shubuh  = 'A' AND (ah.verif_shubuh  IS NULL OR ah.verif_shubuh  = 'BELUM'))
        OR
        (ah.ashar   = 'A' AND (ah.verif_ashar   IS NULL OR ah.verif_ashar   = 'BELUM'))
        OR
        (ah.maghrib = 'A' AND (ah.verif_maghrib IS NULL OR ah.verif_maghrib = 'BELUM'))
      )
    ORDER BY ah.tanggal DESC, s.nama_lengkap ASC, ah.id ASC
    LIMIT ? OFFSET ?
  `
  const rawData: {
    id: string; tanggal: string; santri_id: string; nama_lengkap: string; nis: string; asrama: string | null; kamar: string | null
    shubuh: string; ashar: string; maghrib: string
    verif_shubuh: string | null; verif_ashar: string | null; verif_maghrib: string | null
  }[] = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const page = await query<typeof rawData[number]>(sql, [...params, pageSize, offset])
    rawData.push(...page)
    if (page.length < pageSize) break
  }

  type QueueItem = {
    santri_id: string; nama: string; nis: string; info: string
    items: { absen_id: string; tanggal: string; sesi: string; status_verif: string | null }[]
  }
  const groupedMap = new Map<string, QueueItem>()

  rawData.forEach(row => {
    const sessions = ['shubuh', 'ashar', 'maghrib'] as const
    sessions.forEach(sess => {
      const isAlfa    = row[sess] === 'A'
      const belumVerif = row[`verif_${sess}`] == null || row[`verif_${sess}`] === 'BELUM'
      if (isAlfa && belumVerif) {
        if (!groupedMap.has(row.santri_id)) {
          groupedMap.set(row.santri_id, {
            santri_id: row.santri_id,
            nama:      row.nama_lengkap,
            nis:       row.nis,
            info:      `${row.asrama || '-'} / ${row.kamar || '-'}`,
            items:     [],
          })
        }
        groupedMap.get(row.santri_id)!.items.push({
          absen_id:    row.id,
          tanggal:     row.tanggal,
          sesi:        sess,
          status_verif: row[`verif_${sess}`],
        })
      }
    })
  })

  return Array.from(groupedMap.values())
}

type VonisItem = {
  santriId: string
  items: { absen_id: string; sesi: string; tanggal: string; status_verif: string | null }[]
  vonis: 'ALFA_MURNI' | 'SAKIT' | 'IZIN' | 'KESALAHAN' | 'BELUM'
}

const VALID_SESI = ['shubuh', 'ashar', 'maghrib'] as const
export type SesiPengajian = typeof VALID_SESI[number]
function isSesiPengajian(s: string): s is SesiPengajian {
  return (VALID_SESI as readonly string[]).includes(s)
}

function getVerifColumn(sesi: string): string {
  if (!isSesiPengajian(sesi)) throw new Error(`Sesi tidak valid: ${sesi}`)
  return `verif_${sesi}`
}
function getSesiColumn(sesi: string): string {
  if (!isSesiPengajian(sesi)) throw new Error(`Sesi tidak valid: ${sesi}`)
  return sesi
}

export async function simpanVerifikasiMassal(daftarVonis: VonisItem[], tanggalRef?: string) {
  const session = await assertFeature('/dashboard/akademik/absensi/verifikasi')
  if ('error' in session) return session
  if (!hasRole(session, 'admin') && !hasRole(session, 'sekpen') && !hasRole(session, 'demo')) return { error: 'Akses ditolak' }
  if (!Array.isArray(daftarVonis) || daftarVonis.length === 0) return { error: 'Tidak ada data untuk disimpan' }
  if (daftarVonis.length > 1 && !tanggalRef) return { error: 'Pilih satu pekan untuk vonis massal' }
  let week: ReturnType<typeof getAbsensiWeek> | undefined
  try { if (tanggalRef) week = getAbsensiWeek(tanggalRef) }
  catch { return { error: 'Tanggal pekan tidak valid' } }
  const seen = new Set<string>()
  const checks: { sql: string; params: unknown[] }[] = []
  for (const data of daftarVonis) {
    if (!data || typeof data.santriId !== 'string' || !['ALFA_MURNI', 'SAKIT', 'IZIN', 'KESALAHAN', 'BELUM'].includes(data.vonis)
      || !Array.isArray(data.items) || !data.items.length) return { error: 'Data vonis tidak valid' }
    for (const item of data.items) {
      if (!item || typeof item.absen_id !== 'string' || !isSesiPengajian(item.sesi)
        || (item.status_verif !== null && item.status_verif !== 'BELUM')) return { error: 'Data sesi tidak valid' }
      try { getAbsensiWeek(item.tanggal) } catch { return { error: 'Tanggal absensi tidak valid' } }
      if (week && (item.tanggal < week.start || item.tanggal > week.end)) return { error: 'Absensi berada di luar pekan terpilih' }
      const key = `${item.absen_id}:${item.sesi}`
      if (seen.has(key)) return { error: 'Sesi absensi duplikat' }
      seen.add(key)
      const condition = `SELECT 1 FROM absensi_harian ah
        JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id AND rp.status_riwayat = 'aktif'
        JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
        WHERE ah.id = ? AND s.id = ? AND ah.tanggal = ? AND ah.${getSesiColumn(item.sesi)} = 'A'
          AND ah.${getVerifColumn(item.sesi)} IS ?
          AND NOT EXISTS (SELECT 1 FROM absensi_verifikasi_periode p
            WHERE p.status = 'FINAL' AND ah.tanggal BETWEEN p.tanggal_mulai AND p.tanggal_selesai)`
      const params = [item.absen_id, data.santriId, item.tanggal, item.status_verif]
      // The assertion runs within the same atomic batch as all writes. Invalid JSON
      // aborts the transaction if a concurrent verification changed the snapshot.
      checks.push({ sql: `SELECT json(CASE WHEN EXISTS (${condition}) THEN 'true' ELSE 'absensi_stale' END)`, params })
    }
  }

  const violationsToInsert: {
    id: string; santri_id: string; tanggal: string; jenis: string; deskripsi: string; poin: number; penindak_id: string | null
  }[] = []
  const statements: { sql: string; params?: unknown[] }[] = []

  for (const data of daftarVonis) {
    const { santriId, items, vonis } = data

    if (vonis === 'ALFA_MURNI') {
      const totalSesi  = items.length
      const detailString = items
        .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
        .map(i => {
          const tgl = new Date(i.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
          return `${tgl} (${i.sesi})`
        })
        .join(', ')

      const violationId = `absensi-verifikasi:${santriId}:${items
        .map(item => `${item.absen_id}:${item.sesi}`)
        .sort()
        .join('|')}`
      violationsToInsert.push({
        id:         violationId,
        santri_id:  santriId,
        tanggal:    now(),
        jenis:      'ALFA_PENGAJIAN',
        deskripsi:  `Akumulasi Alfa Pengajian (${totalSesi} Sesi).\nDetail: ${detailString}`,
        poin:       0,
        penindak_id: session?.id ?? null,
      })

      for (const item of items) statements.push(sessionStatement({parentId:violationId,santriId,source:'pengajian',tanggal:item.tanggal,sesi:item.sesi,ref:item.absen_id,actor:session.id,reason:'Vonis alfa murni'}))
      for (const item of items) statements.push(sessionLinkStatement(violationId,'pengajian',santriId,item.tanggal,item.sesi))
      for (const item of items) statements.push({
        sql: `UPDATE absensi_harian SET ${getVerifColumn(item.sesi)} = 'OK' WHERE id = ?`,
        params: [item.absen_id],
      })
    } else if (vonis === 'BELUM') {
      for (const item of items) statements.push({
        sql: `UPDATE absensi_harian SET ${getVerifColumn(item.sesi)} = 'BELUM' WHERE id = ?`,
        params: [item.absen_id],
      })
    } else {
      const newStatus = vonis === 'SAKIT' ? 'S' : vonis === 'IZIN' ? 'I' : 'H'
      for (const item of items) statements.push({
        sql: `UPDATE absensi_harian SET ${getSesiColumn(item.sesi)} = ?, ${getVerifColumn(item.sesi)} = NULL WHERE id = ?`,
        params: [newStatus, item.absen_id],
      })
    }
  }

  for (const v of violationsToInsert) {
    statements.push({
      sql: `INSERT OR IGNORE INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin, penindak_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [v.id, v.santri_id, v.tanggal, v.jenis, v.deskripsi, v.poin, v.penindak_id],
    })
  }
  try {
    await batch([...checks,...statements.filter(s=>s.sql.includes('INSERT OR IGNORE INTO pelanggaran (')),...statements.filter(s=>!s.sql.includes('INSERT OR IGNORE INTO pelanggaran ('))])
  } catch (error) {
    if (error instanceof Error && /malformed JSON|absensi_stale/i.test(error.message)) {
      return { error: 'Data absensi sudah berubah, tidak sesuai santri, atau periode sudah final. Muat ulang antrean.', code: 'STALE' }
    }
    throw error
  }

  const alfaCount = daftarVonis.filter((item) => item.vonis === 'ALFA_MURNI').length
  const sakitCount = daftarVonis.filter((item) => item.vonis === 'SAKIT').length
  const izinCount = daftarVonis.filter((item) => item.vonis === 'IZIN').length
  const resetCount = daftarVonis.filter((item) => item.vonis === 'KESALAHAN').length
  const belumCount = daftarVonis.filter((item) => item.vonis === 'BELUM').length
  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_absensi_verifikasi',
    action: 'approval',
    fiturHref: '/dashboard/akademik/absensi/verifikasi',
    logKind: 'update',
    entityType: 'verifikasi_absensi_batch',
    entityId: 'verifikasi-massal',
    entityLabel: 'Verifikasi absensi',
    summary: `Memverifikasi absensi massal untuk ${daftarVonis.length} santri`,
    details: {
      total_santri: daftarVonis.length,
      pekan: week ?? null,
      total_sesi: seen.size,
      total_pelanggaran: violationsToInsert.length,
      alfa_murni: alfaCount,
      sakit: sakitCount,
      izin: izinCount,
      kesalahan: resetCount,
      belum: belumCount,
    },
  })

  revalidatePath('/dashboard/akademik/absensi/verifikasi')
  revalidateDiscipline()
  revalidatePath('/dashboard/akademik/absensi/cetak')
  return { success: true, count: daftarVonis.length }
}

export async function getKelasList() {
  const data = await query<{ id: string; nama_kelas: string; marhalah_id: string }>(`
    SELECT k.id, k.nama_kelas, k.marhalah_id
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    ORDER BY k.nama_kelas
  `)
  return data.sort((a, b) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export async function getAsramaList() {
  const data = await query<{ asrama: string }>(`
    SELECT DISTINCT asrama 
    FROM santri 
    WHERE status_global = 'aktif'
      AND asrama IS NOT NULL AND asrama != '' 
    ORDER BY asrama
  `)
  return data.map(d => d.asrama)
}

export async function getMarhalahList() {
  return getCachedMarhalahList()
}

// ─── Period-Level Finalization & Reopen Model ──────────────────────────────
// Semantics:
// 1. Sekretaris kelas mencatat absensi santri secara manual di blanko.
// 2. Setiap malam Selasa, Seksi Pengajaran menginput absensi ke Modul ABSENSI PENGAJIAN.
// 3. Yang diinput ke sistem HANYA santri yang tidak hadir (Sakit, Izin, Alfa).
// 4. Santri yang Hadir TIDAK diinput / tidak memiliki exception row.
// 5. Setelah input selesai, Seksi Pengajaran melakukan VERIFIKASI ABSENSI.
// 6. Action "Selesaikan Verifikasi" memastikan seluruh Alfa pada periode tersebut
//    telah diputus (tidak ada lagi yang verif NULL atau BELUM).
// 7. Periode yang berstatus 'FINAL' menjadi sumber penentu data kehadiran sah di Portal Orang Tua.
// 8. Ketiadaan row pada periode yang FINAL berarti HADIR.
// 9. Action "Buka Kembali" mengubah status menjadi 'REOPENED' sehingga Portal Orang Tua
//    tidak menghitung periode tersebut hingga difinalisasi kembali.

export type PeriodeVerifikasiItem = {
  tanggalMulai: string
  tanggalSelesai: string
  status: 'FINAL' | 'REOPENED' | 'BELUM'
  unresolvedAlfaCount: number
  verifiedBy: string | null
  verifiedAt: string | null
  reopenedBy: string | null
  reopenedAt: string | null
  reopenReason: string | null
}

export async function ensureAbsensiVerifikasiPeriodeTable() {
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS absensi_verifikasi_periode (
        id TEXT PRIMARY KEY,
        tanggal_mulai TEXT NOT NULL,
        tanggal_selesai TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'FINAL' CHECK(status IN ('FINAL', 'REOPENED')),
        verified_by TEXT REFERENCES users(id),
        verified_at TEXT NOT NULL,
        reopened_by TEXT REFERENCES users(id),
        reopened_at TEXT,
        reopen_reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(tanggal_mulai, tanggal_selesai)
      )
    `)
    await execute(`CREATE INDEX IF NOT EXISTS idx_absensi_verif_periode_lookup ON absensi_verifikasi_periode(tanggal_mulai, tanggal_selesai, status)`)
    await execute(`CREATE INDEX IF NOT EXISTS idx_absensi_verif_periode_status ON absensi_verifikasi_periode(status, tanggal_mulai)`)
  } catch {
    // noop
  }
}

export async function getUnresolvedAlfaCount(tanggalMulai: string, tanggalSelesai: string): Promise<number> {
  const row = await queryOne<{ count: number }>(`
    SELECT
      COALESCE(SUM(
        (CASE WHEN ah.shubuh = 'A' AND (ah.verif_shubuh IS NULL OR ah.verif_shubuh = 'BELUM') THEN 1 ELSE 0 END) +
        (CASE WHEN ah.ashar = 'A' AND (ah.verif_ashar IS NULL OR ah.verif_ashar = 'BELUM') THEN 1 ELSE 0 END) +
        (CASE WHEN ah.maghrib = 'A' AND (ah.verif_maghrib IS NULL OR ah.verif_maghrib = 'BELUM') THEN 1 ELSE 0 END)
      ), 0) as count
    FROM absensi_harian ah
    INNER JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id AND rp.status_riwayat = 'aktif'
    INNER JOIN santri s ON s.id = rp.santri_id AND s.status_global = 'aktif'
    WHERE ah.tanggal >= ? AND ah.tanggal <= ?
  `, [tanggalMulai, tanggalSelesai])
  return Number(row?.count || 0)
}

export async function getStatusVerifikasiPeriode(tanggalRef?: string): Promise<PeriodeVerifikasiItem> {
  await ensureAbsensiVerifikasiPeriodeTable()
  const d = tanggalRef ? new Date(tanggalRef) : new Date()
  const { start, end } = getWeekRange(d)
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  type PeriodeRow = {
    status: 'FINAL' | 'REOPENED'
    verified_by: string | null
    verified_at: string | null
    reopened_by: string | null
    reopened_at: string | null
    reopen_reason: string | null
  }
  const row = await queryOne<PeriodeRow>(`
    SELECT status, verified_by, verified_at, reopened_by, reopened_at, reopen_reason
    FROM absensi_verifikasi_periode
    WHERE tanggal_mulai = ? AND tanggal_selesai = ?
  `, [startStr, endStr]).catch(() => null)

  const unresolved = await getUnresolvedAlfaCount(startStr, endStr)

  return {
    tanggalMulai: startStr,
    tanggalSelesai: endStr,
    status: row ? row.status : 'BELUM',
    unresolvedAlfaCount: unresolved,
    verifiedBy: row?.verified_by ?? null,
    verifiedAt: row?.verified_at ?? null,
    reopenedBy: row?.reopened_by ?? null,
    reopenedAt: row?.reopened_at ?? null,
    reopenReason: row?.reopen_reason ?? null,
  }
}

export async function selesaikanVerifikasiPeriode(tanggalMulai: string, tanggalSelesai: string) {
  await ensureAbsensiVerifikasiPeriodeTable()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!hasRole(session, 'admin') && !hasRole(session, 'sekpen')) {
    return { error: 'Hanya Sekpen atau Admin yang memiliki wewenang menyelesaikan verifikasi absensi.' }
  }

  const unresolved = await getUnresolvedAlfaCount(tanggalMulai, tanggalSelesai)
  if (unresolved > 0) {
    return { error: `Masih ada ${unresolved} absensi Alfa yang perlu diverifikasi.` }
  }

  const recordId = generateId()
  const timestamp = now()

  await execute(`
    INSERT INTO absensi_verifikasi_periode
      (id, tanggal_mulai, tanggal_selesai, status, verified_by, verified_at, updated_at)
    VALUES (?, ?, ?, 'FINAL', ?, ?, ?)
    ON CONFLICT(tanggal_mulai, tanggal_selesai) DO UPDATE SET
      status = 'FINAL',
      verified_by = excluded.verified_by,
      verified_at = excluded.verified_at,
      reopened_by = NULL,
      reopened_at = NULL,
      reopen_reason = NULL,
      updated_at = excluded.updated_at
  `, [recordId, tanggalMulai, tanggalSelesai, session.id, timestamp, timestamp])

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_absensi_verifikasi',
    action: 'approval',
    fiturHref: '/dashboard/akademik/absensi/verifikasi',
    logKind: 'update',
    entityType: 'absensi_verifikasi_periode',
    entityId: `${tanggalMulai}:${tanggalSelesai}`,
    entityLabel: `Finalisasi periode ${tanggalMulai} - ${tanggalSelesai}`,
    summary: `Menyelesaikan verifikasi pengajian periode ${tanggalMulai} s/d ${tanggalSelesai}`,
  })

  revalidatePath('/dashboard/akademik/absensi/verifikasi')
  revalidatePath('/dashboard/akademik/absensi')
  revalidatePath('/dashboard/akademik/absensi/rekap')
  revalidatePath('/portal-ortu/aktivitas')
  revalidatePath('/portal-ortu/beranda')

  return { success: true }
}

export async function bukaKembaliVerifikasiPeriode(tanggalMulai: string, tanggalSelesai: string, alasan: string) {
  await ensureAbsensiVerifikasiPeriodeTable()
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!hasRole(session, 'admin') && !hasRole(session, 'sekpen')) {
    return { error: 'Hanya Sekpen atau Admin yang berwenang membuka kembali sesi verifikasi.' }
  }

  const cleanReason = (alasan || '').trim()
  if (!cleanReason) {
    return { error: 'Alasan pembukaan kembali wajib diisi.' }
  }

  const existing = await queryOne<{ status: string }>(`
    SELECT status FROM absensi_verifikasi_periode
    WHERE tanggal_mulai = ? AND tanggal_selesai = ?
  `, [tanggalMulai, tanggalSelesai])

  if (!existing || existing.status !== 'FINAL') {
    return { error: 'Periode ini belum berstatus final.' }
  }

  const timestamp = now()
  await execute(`
    UPDATE absensi_verifikasi_periode SET
      status = 'REOPENED',
      reopened_by = ?,
      reopened_at = ?,
      reopen_reason = ?,
      updated_at = ?
    WHERE tanggal_mulai = ? AND tanggal_selesai = ?
  `, [session.id, timestamp, cleanReason, timestamp, tanggalMulai, tanggalSelesai])

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_absensi_verifikasi',
    action: 'update',
    fiturHref: '/dashboard/akademik/absensi/verifikasi',
    logKind: 'update',
    entityType: 'absensi_verifikasi_periode',
    entityId: `${tanggalMulai}:${tanggalSelesai}`,
    entityLabel: `Buka kembali periode ${tanggalMulai} - ${tanggalSelesai}`,
    summary: `Membuka kembali verifikasi pengajian periode ${tanggalMulai} s/d ${tanggalSelesai}: ${cleanReason}`,
  })

  revalidatePath('/dashboard/akademik/absensi/verifikasi')
  revalidatePath('/dashboard/akademik/absensi')
  revalidatePath('/dashboard/akademik/absensi/rekap')
  revalidatePath('/portal-ortu/aktivitas')
  revalidatePath('/portal-ortu/beranda')

  return { success: true }
}
