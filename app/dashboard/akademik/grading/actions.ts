'use server'

import { query, execute, batch } from '@/lib/db'
import { getCachedMapelAll, getCachedMarhalahList } from '@/lib/cache/master'
import { getSession, hasRole, hasAnyRole } from '@/lib/auth/session'
import { assertCrud } from '@/lib/auth/crud'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { normalizeGrade, gradeLabel, type Grade } from '@/lib/akademik/grade'
import { revalidatePath } from 'next/cache'

const FITUR_HREF = '/dashboard/akademik/grading'

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export async function getMarhalahList() {
  return getCachedMarhalahList()
}

export type GradingKelasStat = {
  kelas_id: string
  nama_kelas: string
  total_santri: number
  grade_a: number
  grade_b: number
  grade_c: number
  sudah_grading: number
  belum_grading: number
}

export async function getStatistikGradingMarhalah(marhalahId: string): Promise<GradingKelasStat[]> {
  if (!marhalahId) return []

  const rows = await query<any>(`
    SELECT
      k.id AS kelas_id,
      k.nama_kelas,
      COUNT(rp.id) AS total_santri,
      COALESCE(SUM(CASE
        WHEN UPPER(TRIM(COALESCE(rp.grade_lanjutan, ''))) = 'A'
          OR UPPER(COALESCE(rp.grade_lanjutan, '')) LIKE '%GRADE A%'
        THEN 1 ELSE 0 END), 0) AS grade_a,
      COALESCE(SUM(CASE
        WHEN UPPER(TRIM(COALESCE(rp.grade_lanjutan, ''))) = 'B'
          OR UPPER(COALESCE(rp.grade_lanjutan, '')) LIKE '%GRADE B%'
        THEN 1 ELSE 0 END), 0) AS grade_b,
      COALESCE(SUM(CASE
        WHEN UPPER(TRIM(COALESCE(rp.grade_lanjutan, ''))) = 'C'
          OR UPPER(COALESCE(rp.grade_lanjutan, '')) LIKE '%GRADE C%'
        THEN 1 ELSE 0 END), 0) AS grade_c
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN riwayat_pendidikan rp
      ON rp.kelas_id = k.id
     AND rp.status_riwayat = 'aktif'
    WHERE k.marhalah_id = ?
    GROUP BY k.id, k.nama_kelas
  `, [marhalahId])

  return rows
    .map((row: any) => {
      const gradeA = Number(row.grade_a || 0)
      const gradeB = Number(row.grade_b || 0)
      const gradeC = Number(row.grade_c || 0)
      const total = Number(row.total_santri || 0)
      const sudah = gradeA + gradeB + gradeC
      return {
        kelas_id: row.kelas_id,
        nama_kelas: row.nama_kelas,
        total_santri: total,
        grade_a: gradeA,
        grade_b: gradeB,
        grade_c: gradeC,
        sudah_grading: sudah,
        belum_grading: Math.max(total - sudah, 0),
      }
    })
    .sort((a, b) => naturalCompare(a.nama_kelas, b.nama_kelas))
}

export async function getKelasList() {
  const session = await getSession()

  let sql = `
    SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
  `
  const params: any[] = []

  // Admin/Sekpen/Akademik = akses semua kelas,
  // Wali kelas = hanya kelas binaannya
  if (!hasAnyRole(session, ['admin', 'sekpen', 'akademik']) && hasRole(session, 'wali_kelas') && session?.id) {
    sql += ' WHERE k.wali_kelas_id = ?'
    params.push(session.id)
  }

  sql += ' ORDER BY k.nama_kelas'
  return query<any>(sql, params)
}

export async function getDataGrading(kelasId: string) {
  const listSantri = await query<any>(`
    SELECT rp.id, rp.grade_lanjutan, s.nama_lengkap, s.nis
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [kelasId])

  if (!listSantri.length) return []

  const riwayatIds = listSantri.map((s: any) => s.id)
  const ph = riwayatIds.map(() => '?').join(',')

  const mapelRef = await getCachedMapelAll()
  const mapelIlmuAlatIds = mapelRef
    .filter((m: any) => m.nama.toLowerCase().includes('nahwu') || m.nama.toLowerCase().includes('sharaf'))
    .map((m: any) => m.id)

  let listNilai: any[] = []
  if (mapelIlmuAlatIds.length > 0) {
    const phm = mapelIlmuAlatIds.map(() => '?').join(',')
    listNilai = await query<any>(`
      SELECT riwayat_pendidikan_id, mapel_id, nilai, semester
      FROM nilai_akademik
      WHERE riwayat_pendidikan_id IN (${ph})
        AND mapel_id IN (${phm})
    `, [...riwayatIds, ...mapelIlmuAlatIds])
  }

  return listSantri.map((s: any) => {
    const myGrades = listNilai.filter((n: any) => n.riwayat_pendidikan_id === s.id)
    let totalNilai = 0, countNilai = 0
    myGrades.forEach((n: any) => {
      if (n.nilai !== null && n.nilai !== undefined) { totalNilai += Number(n.nilai); countNilai++ }
    })
    const rata = countNilai > 0 ? totalNilai / countNilai : 0
    const rekomendasi = rata >= 70 ? 'Grade A' : rata >= 50 ? 'Grade B' : countNilai === 0 ? '-' : 'Grade C'

    return {
      riwayat_id: s.id,
      nis: s.nis,
      nama: s.nama_lengkap,
      rata_rata: Number(rata.toFixed(1)),
      jumlah_komponen_nilai: countNilai,
      rekomendasi,
      grade_final: s.grade_lanjutan || (rekomendasi !== '-' ? rekomendasi : 'Grade C'),
    }
  })
}

// ── View Sekpen: 3 kolom A/B/C, simpan per-item (bukan batch) ──

export type GradingSekpenItem = {
  riwayat_id: string
  santri_id: string
  nis: string
  nama: string
  grade: Grade | null
  urutan: number | null
}

// Kolom grade_urutan menyimpan urutan manual santri dalam kolom grade (kecil = atas).
let gradeUrutanReady = false
async function ensureGradeUrutanColumn() {
  if (gradeUrutanReady) return
  try {
    await execute('ALTER TABLE riwayat_pendidikan ADD COLUMN grade_urutan INTEGER')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) throw error
  }
  gradeUrutanReady = true
}

export async function getGradingSekpen(kelasId: string): Promise<GradingSekpenItem[]> {
  if (!kelasId) return []
  await ensureGradeUrutanColumn()
  const rows = await query<any>(`
    SELECT rp.id AS riwayat_id, rp.grade_lanjutan, rp.grade_urutan,
           s.id AS santri_id, s.nis, s.nama_lengkap
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY (rp.grade_urutan IS NULL), rp.grade_urutan, s.nama_lengkap
  `, [kelasId])

  return rows.map((r: any) => ({
    riwayat_id: r.riwayat_id,
    santri_id: r.santri_id,
    nis: r.nis,
    nama: r.nama_lengkap,
    grade: normalizeGrade(r.grade_lanjutan),
    urutan: r.grade_urutan ?? null,
  }))
}

// Masukkan banyak santri (mis. "sisa yang belum") ke satu grade sekaligus.
export async function setGradeBanyak(riwayatIds: string[], grade: Grade) {
  const session = await assertCrud(FITUR_HREF, 'update')
  if ('error' in session) return { error: session.error }
  if (!hasAnyRole(session, ['admin', 'sekpen'])) return { error: 'Khusus sekpen.' }
  await ensureGradeUrutanColumn()
  const ids = (riwayatIds || []).filter(Boolean)
  if (ids.length === 0) return { error: 'Tidak ada santri.' }

  const value = gradeLabel(grade)
  try {
    const CHUNK = 200
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      const ph = chunk.map(() => '?').join(',')
      await execute(`UPDATE riwayat_pendidikan SET grade_lanjutan = ? WHERE id IN (${ph})`, [value, ...chunk])
    }
  } catch {
    return { error: 'Gagal menyimpan grade.' }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_grading',
    action: 'update',
    fiturHref: FITUR_HREF,
    logKind: 'update',
    entityType: 'grading_sekpen_massal',
    entityId: 'sisa',
    entityLabel: value,
    summary: `Sekpen memasukkan ${ids.length} santri ke ${value}`,
    details: { count: ids.length, grade: value },
  })

  revalidatePath(FITUR_HREF)
  return { success: true, count: ids.length }
}

// Simpan urutan manual santri dalam satu kolom grade (orderedIds urut atas->bawah).
export async function simpanUrutanGrade(orderedIds: string[]) {
  const session = await assertCrud(FITUR_HREF, 'update')
  if ('error' in session) return { error: session.error }
  if (!hasAnyRole(session, ['admin', 'sekpen'])) return { error: 'Khusus sekpen.' }
  await ensureGradeUrutanColumn()
  const ids = (orderedIds || []).filter(Boolean)
  if (ids.length === 0) return { success: true }

  try {
    await batch(ids.map((id, idx) => ({
      sql: 'UPDATE riwayat_pendidikan SET grade_urutan = ? WHERE id = ?',
      params: [idx, id],
    })))
  } catch {
    return { error: 'Gagal menyimpan urutan.' }
  }

  revalidatePath(FITUR_HREF)
  return { success: true }
}

// Simpan grade satu santri seketika (override vonis wali kelas). Eksklusif admin/sekpen.
// grade null = hapus grade (santri kembali ke kolom "belum").
export async function setGradeSantri(riwayatId: string, grade: Grade | null) {
  const session = await assertCrud(FITUR_HREF, 'update')
  if ('error' in session) return { error: session.error }
  if (!hasAnyRole(session, ['admin', 'sekpen'])) return { error: 'Khusus sekpen.' }
  if (!riwayatId) return { error: 'Data tidak valid.' }
  await ensureGradeUrutanColumn()

  const value = grade ? gradeLabel(grade) : null
  try {
    await execute(
      'UPDATE riwayat_pendidikan SET grade_lanjutan = ?, grade_urutan = CASE WHEN ? IS NULL THEN NULL ELSE grade_urutan END WHERE id = ?',
      [value, value, riwayatId]
    )
  } catch {
    return { error: 'Gagal menyimpan grade.' }
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_grading',
    action: 'update',
    fiturHref: FITUR_HREF,
    logKind: 'update',
    entityType: 'grading_sekpen',
    entityId: riwayatId,
    entityLabel: value || 'kosong',
    summary: `Sekpen mengatur grade santri menjadi ${value || 'kosong'}`,
    details: { riwayat_id: riwayatId, grade: value },
  })

  revalidatePath(FITUR_HREF)
  return { success: true }
}

export async function simpanGradingBatch(payload: { riwayat_id: string; grade: string }[]) {
  const session = await getSession()
  if (payload.length === 0) return { success: true }

  for (const item of payload) {
    await execute(
      'UPDATE riwayat_pendidikan SET grade_lanjutan = ? WHERE id = ?',
      [item.grade, item.riwayat_id]
    )
  }

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_grading',
    action: 'update',
    fiturHref: '/dashboard/akademik/grading',
    logKind: 'update',
    entityType: 'grading_batch',
    entityId: 'grading-batch',
    entityLabel: 'Grading lanjutan',
    summary: `Menyimpan grading lanjutan untuk ${payload.length} santri`,
    details: {
      total_santri: payload.length,
      grades: Array.from(new Set(payload.map((item) => item.grade))).slice(0, 10),
    },
  })

  revalidatePath('/dashboard/akademik/grading')
  return { success: true, count: payload.length }
}
