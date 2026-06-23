'use server'

import { query, execute, generateId, now } from '@/lib/db'
import { getCachedMarhalahList, getCachedTahunAjaranAktif } from '@/lib/cache/master'
import { assertCrud } from '@/lib/auth/crud'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { normalizeGrade } from '@/lib/akademik/grade'
import { revalidatePath } from 'next/cache'

const FITUR_HREF = '/dashboard/akademik/penempatan'
export type JenjangPenempatan = 'SLTP' | 'SLTA'

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function getJenjangPenempatan(kategoriSantri: string | null | undefined, sekolah: string | null | undefined): JenjangPenempatan | null {
  if (String(kategoriSantri || '').trim().toUpperCase() === 'SADESA') return 'SLTA'

  const value = String(sekolah || '').toUpperCase()
  if (value.includes('MTSN') || value.includes('MTS') || value.includes('SMP')) return 'SLTP'
  if (value.includes('MAN') || value.includes('SMK') || value.includes('SMA')) return 'SLTA'
  return null
}

export async function getMarhalahList() {
  return getCachedMarhalahList()
}

export async function getTahunAjaranAktif() {
  return getCachedTahunAjaranAktif()
}

export type KelasTujuan = {
  id: string
  nama_kelas: string
  grade: string | null
  jenis_kelamin: string
  jumlah: number // santri aktif yang sudah ada di kelas ini
}

// Kolom grade_urutan (urutan manual hasil grading) dipakai juga untuk mengurutkan
// kandidat penempatan. Pastikan kolomnya ada.
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

// Kelas tahun-aktif di marhalah, lengkap komposisi grade.
// jenisKelamin (L/P) opsional: kelas yang muncul hanya yang gender-nya sama ATAU campur (C).
export async function getKelasUntukMarhalah(marhalahId: string, jenisKelamin?: string): Promise<KelasTujuan[]> {
  if (!marhalahId) return []
  const params: any[] = [marhalahId]
  let genderFilter = ''
  if (jenisKelamin === 'L' || jenisKelamin === 'P') {
    genderFilter = " AND (k.jenis_kelamin = ? OR k.jenis_kelamin = 'C')"
    params.push(jenisKelamin)
  }
  const data = await query<KelasTujuan>(`
    SELECT k.id, k.nama_kelas, k.grade, k.jenis_kelamin,
           (SELECT COUNT(*) FROM riwayat_pendidikan rp
            WHERE rp.kelas_id = k.id AND rp.status_riwayat = 'aktif') AS jumlah
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    WHERE k.marhalah_id = ?${genderFilter}
  `, params)
  return data.sort((a, b) => naturalCompare(a.nama_kelas, b.nama_kelas))
}

export type KandidatPenempatan = {
  santri_id: string
  nama: string
  nis: string
  sumber: 'baru' | 'lama'
  grade: 'A' | 'B' | 'C' | null
  asal: string // rekomendasi marhalah (baru) / kelas sekarang (lama)
  jenis_kelamin: string
  sekolah: string | null
  kategori_santri: string | null
  jenjang: JenjangPenempatan | null
  urutan: number | null // urutan manual hasil grading (lama); null untuk baru
  riwayat_lama_id: string | null
}

// Gabungan kandidat untuk marhalah tujuan terpilih:
//  - "baru": santri aktif tanpa riwayat aktif, grade dari tes klasifikasi,
//            target marhalah = rekomendasi_marhalah (match nama).
//  - "lama": santri di kelas marhalah sebelumnya (urutan - 1), grade dari grade_lanjutan.
// jenisKelamin (L/P) opsional untuk memfilter santri per gender.
export async function getPenempatanData(marhalahTargetId: string, jenisKelamin?: string, jenjangPenempatan?: JenjangPenempatan): Promise<KandidatPenempatan[]> {
  if (!marhalahTargetId) return []
  await ensureGradeUrutanColumn()

  const gender = (jenisKelamin === 'L' || jenisKelamin === 'P') ? jenisKelamin : null
  const jenjang = jenjangPenempatan === 'SLTA' ? 'SLTA' : 'SLTP'

  const marhalahList = await getCachedMarhalahList()
  const target = marhalahList.find((m: any) => String(m.id) === String(marhalahTargetId))
  if (!target) return []

  const targetNama = String(target.nama).trim().toLowerCase()
  const sourceMarhalah = marhalahList.find((m: any) => Number(m.urutan) === Number(target.urutan) - 1)

  // ── Santri BARU (hasil tes klasifikasi, belum punya kelas) ──
  const baruParams: any[] = []
  let baruGender = ''
  if (gender) { baruGender = ' AND s.jenis_kelamin = ?'; baruParams.push(gender) }
  const santriBaru = await query<any>(`
    SELECT s.id AS santri_id, s.nis, s.nama_lengkap, s.jenis_kelamin,
           s.sekolah, s.kategori_santri,
           htk.rekomendasi_marhalah, htk.catatan_grade
    FROM santri s
    JOIN hasil_tes_klasifikasi htk ON htk.santri_id = s.id
    WHERE s.status_global = 'aktif'${baruGender}
      AND NOT EXISTS (
        SELECT 1 FROM riwayat_pendidikan rp
        WHERE rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
      )
    ORDER BY s.nama_lengkap
  `, baruParams)

  const kandidatBaru: KandidatPenempatan[] = santriBaru
    .filter((s: any) =>
      String(s.rekomendasi_marhalah || '').trim().toLowerCase() === targetNama &&
      getJenjangPenempatan(s.kategori_santri, s.sekolah) === jenjang
    )
    .map((s: any) => {
      const jenjangSantri = getJenjangPenempatan(s.kategori_santri, s.sekolah)
      return {
        santri_id: s.santri_id,
        nama: s.nama_lengkap,
        nis: s.nis,
        sumber: 'baru' as const,
        grade: normalizeGrade(s.catatan_grade),
        asal: s.rekomendasi_marhalah || '-',
        jenis_kelamin: s.jenis_kelamin,
        sekolah: s.sekolah,
        kategori_santri: s.kategori_santri,
        jenjang: jenjangSantri,
        urutan: null,
        riwayat_lama_id: null,
      }
    })

  // ── Santri LAMA (naik dari marhalah sebelumnya) ──
  let kandidatLama: KandidatPenempatan[] = []
  if (sourceMarhalah) {
    // Sumber santri lama TIDAK difilter tahun aktif: tiap santri hanya punya 1
    // riwayat 'aktif'. Ini agar kenaikan lintas-tahun jalan (kelas asal tahun lalu
    // sudah non-aktif setelah tahun baru diaktifkan). Kelas TUJUAN tetap tahun aktif.
    const lamaParams: any[] = [sourceMarhalah.id]
    let lamaGender = ''
    if (gender) { lamaGender = ' AND s.jenis_kelamin = ?'; lamaParams.push(gender) }
    const santriLama = await query<any>(`
      SELECT rp.id AS riwayat_lama_id, rp.grade_lanjutan, rp.grade_urutan,
             s.id AS santri_id, s.nis, s.nama_lengkap, s.jenis_kelamin,
             s.sekolah, s.kategori_santri,
             k.nama_kelas
      FROM riwayat_pendidikan rp
      JOIN santri s ON s.id = rp.santri_id
      JOIN kelas k ON k.id = rp.kelas_id
      WHERE k.marhalah_id = ? AND rp.status_riwayat = 'aktif'
        AND s.status_global = 'aktif'${lamaGender}
      ORDER BY (rp.grade_urutan IS NULL), rp.grade_urutan, s.nama_lengkap
    `, lamaParams)

    kandidatLama = santriLama
      .filter((s: any) => getJenjangPenempatan(s.kategori_santri, s.sekolah) === jenjang)
      .map((s: any) => {
        const jenjangSantri = getJenjangPenempatan(s.kategori_santri, s.sekolah)
        return {
          santri_id: s.santri_id,
          nama: s.nama_lengkap,
          nis: s.nis,
          sumber: 'lama' as const,
          grade: normalizeGrade(s.grade_lanjutan),
          asal: s.nama_kelas,
          jenis_kelamin: s.jenis_kelamin,
          sekolah: s.sekolah,
          kategori_santri: s.kategori_santri,
          jenjang: jenjangSantri,
          urutan: s.grade_urutan ?? null,
          riwayat_lama_id: s.riwayat_lama_id,
        }
      })
  }

  return [...kandidatBaru, ...kandidatLama]
}

export type PenempatanItem = {
  santri_id: string
  kelas_id: string
  riwayat_lama_id: string | null
}

// Satu jalur untuk santri baru & lama:
//  - baru: hanya INSERT riwayat 'aktif'.
//  - lama: arsipkan riwayat lama ('naik'), lalu INSERT riwayat 'aktif' di kelas tujuan.
export async function simpanPenempatan(payload: PenempatanItem[]) {
  const session = await assertCrud(FITUR_HREF, 'create')
  if ('error' in session) return { error: session.error }

  if (!payload || payload.length === 0) return { error: 'Tidak ada santri untuk ditempatkan.' }

  const valid = payload.filter(p => p.santri_id && p.kelas_id)
  if (valid.length === 0) return { error: 'Data penempatan tidak valid.' }

  const waktu = now()

  try {
    // Arsipkan riwayat lama (chunk 200 agar tidak kena limit variabel SQL).
    const riwayatLamaIds = valid.map(p => p.riwayat_lama_id).filter((id): id is string => !!id)
    const CHUNK = 200
    for (let i = 0; i < riwayatLamaIds.length; i += CHUNK) {
      const chunk = riwayatLamaIds.slice(i, i + CHUNK)
      const ph = chunk.map(() => '?').join(',')
      await execute(
        `UPDATE riwayat_pendidikan SET status_riwayat = 'naik' WHERE id IN (${ph})`,
        chunk
      )
    }

    // Insert riwayat baru ('aktif') untuk semua.
    for (const item of valid) {
      await execute(
        'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
        [generateId(), item.santri_id, item.kelas_id, 'aktif', waktu]
      )
    }
  } catch {
    return { error: 'Gagal menyimpan penempatan. Pastikan santri belum punya kelas aktif.' }
  }

  const jumlahBaru = valid.filter(p => !p.riwayat_lama_id).length
  const jumlahLama = valid.filter(p => p.riwayat_lama_id).length

  await logActivity({
    actor: actorFromSession(session),
    module: 'akademik_penempatan',
    action: 'create',
    fiturHref: FITUR_HREF,
    logKind: 'create',
    entityType: 'penempatan_kelas_batch',
    entityId: 'penempatan',
    entityLabel: 'Penempatan kelas',
    summary: `Menempatkan ${valid.length} santri ke kelas (${jumlahBaru} baru, ${jumlahLama} naik)`,
    details: { total: valid.length, baru: jumlahBaru, naik: jumlahLama },
  })

  revalidatePath(FITUR_HREF)
  return { success: true, count: valid.length }
}
