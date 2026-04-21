'use server'

import { query, execute, batch, generateId } from '@/lib/db'
import { getCachedMapelList } from '@/lib/cache/master'
import { revalidatePath } from 'next/cache'

export async function getReferensiData() {
  const mapel = await getCachedMapelList()
  const kelasRaw = await query<any>(`
    SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
  `, [])
  const kelas = kelasRaw.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
  return { mapel, kelas }
}

export async function getDataSantriPerKelas(kelasId: string) {
  const data = await query<any>(`
    SELECT rp.id, s.nis, s.nama_lengkap
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [kelasId])

  return data.map((d: any) => ({
    riwayat_id: d.id,
    nis: d.nis,
    nama: d.nama_lengkap,
  }))
}

// ─── NILAI AKADEMIK ─────────────────────────────────────────────────────────

/** Ambil nilai santri untuk 1 mapel tertentu */
export async function getDataNilaiPerMapel(kelasId: string, mapelId: number, semester: number) {
  const rows = await query<any>(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap, na.nilai
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN nilai_akademik na ON na.riwayat_pendidikan_id = rp.id 
         AND na.mapel_id = ? AND na.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [mapelId, semester, kelasId])

  return rows.map((r: any) => ({
    riwayat_id: r.riwayat_id,
    nis: r.nis,
    nama: r.nama_lengkap,
    nilai: r.nilai ?? 0
  }))
}

/** Simpan nilai untuk 1 mapel (Direct Input) */
export async function simpanNilaiPerMapel(
  semester: number,
  mapelId: number,
  data: { riwayat_id: string; nilai: number }[]
) {
  if (!data.length) return { error: 'Tidak ada data.' }

  await batch(data.map(item => ({
    sql: `INSERT INTO nilai_akademik (id, riwayat_pendidikan_id, mapel_id, semester, nilai)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(riwayat_pendidikan_id, mapel_id, semester) DO UPDATE SET nilai = excluded.nilai`,
    params: [generateId(), item.riwayat_id, mapelId, semester, item.nilai],
  })))

  revalidatePath('/dashboard/akademik/nilai')
  return { success: true, count: data.length }
}

/** Simpan Nilai Massal (Excel Upload) - Sekarang Include Kepribadian & Catatan */
export async function simpanNilaiExcelMenyeluruh(
  kelasId: string,
  semester: number,
  dataNilai: any[],
  listMapel: { id: number; nama: string }[]
) {
  const dataSantri = await getDataSantriPerKelas(kelasId)
  const mapNisToId = new Map<string, string>()
  dataSantri.forEach((s: any) => mapNisToId.set(String(s.nis).trim(), s.riwayat_id))

  const mapMapel = new Map<string, number>()
  listMapel.forEach(m => mapMapel.set(m.nama.toUpperCase().trim(), m.id))

  const toUpsertAkademik: any[] = []
  const toUpsertAkhlak: any[] = []
  const toUpsertRanking: any[] = []
  const errors: string[] = []

  dataNilai.forEach((row, idx) => {
    const baris = idx + 2
    const nis = String(row['NIS'] || row['nis'] || '').trim()
    const riwayatId = mapNisToId.get(nis)
    if (!riwayatId) { errors.push(`Baris ${baris}: NIS '${nis}' tidak ditemukan.`); return }

    // 1. Proses Nilai Akademik
    Object.keys(row).forEach(key => {
      const namaKolom = key.toUpperCase().trim()
      const mapelId = mapMapel.get(namaKolom)
      if (mapelId) {
        const val = Number(row[key])
        if (!isNaN(val) && val >= 0 && val <= 100) {
          toUpsertAkademik.push({ riwayatId, mapelId, semester, nilai: val })
        }
      }
    })

    // 2. Proses Nilai Kepribadian
    const getVal = (col: string) => {
      const v = Number(row[col] || row[col.toLowerCase()])
      return isNaN(v) ? 80 : Math.min(100, Math.max(0, v))
    }

    // Hanya jika ada salah satu kolom kepribadian
    if (row['KEDISIPLINAN'] !== undefined || row['IBADAH'] !== undefined) {
      toUpsertAkhlak.push({
        riwayatId,
        semester,
        kedisiplinan: getVal('KEDISIPLINAN'),
        kebersihan:   getVal('KEBERSIHAN'),
        kesopanan:    getVal('KESOPANAN'),
        ibadah:       getVal('IBADAH'),
        kemandirian:  getVal('KEMANDIRIAN'),
      })
    }

    // 3. Proses Catatan Wali Kelas
    const catatan = String(row['CATATAN WALI KELAS'] || row['catatan_wali_kelas'] || '').trim()
    if (catatan) {
      toUpsertRanking.push({ riwayatId, semester, catatan })
    }
  })

  if (errors.length > 0) return { error: `Ditemukan masalah:\n${errors.slice(0, 5).join('\n')}` }

  // Batch Executions
  const batches = []

  if (toUpsertAkademik.length > 0) {
    batches.push(...toUpsertAkademik.map(item => ({
      sql: `INSERT INTO nilai_akademik (id, riwayat_pendidikan_id, mapel_id, semester, nilai)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(riwayat_pendidikan_id, mapel_id, semester) DO UPDATE SET nilai = excluded.nilai`,
      params: [generateId(), item.riwayatId, item.mapelId, item.semester, item.nilai],
    })))
  }

  if (toUpsertAkhlak.length > 0) {
    batches.push(...toUpsertAkhlak.map(item => ({
      sql: `INSERT INTO nilai_akhlak (id, riwayat_pendidikan_id, semester, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
              kedisiplinan = excluded.kedisiplinan, kebersihan = excluded.kebersihan,
              kesopanan = excluded.kesopanan, ibadah = excluded.ibadah, kemandirian = excluded.kemandirian`,
      params: [generateId(), item.riwayatId, item.semester, item.kedisiplinan, item.kebersihan, item.kesopanan, item.ibadah, item.kemandirian],
    })))
  }

  // Untuk Ranking (Catatan), kita pakai loop execute karena ranking tabel butuh pengecekan existing atau upsert manual jika kolom lain tidak ada
  if (toUpsertRanking.length > 0) {
    for (const item of toUpsertRanking) {
      await execute(`
        INSERT INTO ranking (id, riwayat_pendidikan_id, semester, catatan_wali_kelas)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET catatan_wali_kelas = excluded.catatan_wali_kelas
      `, [generateId(), item.riwayatId, item.semester, item.catatan])
    }
  }

  if (batches.length > 0) await batch(batches)

  revalidatePath('/dashboard/akademik/nilai')
  revalidatePath('/dashboard/laporan/rapor')
  
  return { success: true, count: toUpsertAkademik.length + toUpsertAkhlak.length + toUpsertRanking.length }
}

// ─── NILAI KEPRIBADIAN ──────────────────────────────────────────────────────

export async function getDataKepribadian(kelasId: string, semester: number) {
  const rows = await query<any>(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap,
           na.kedisiplinan, na.kebersihan, na.kesopanan, na.ibadah, na.kemandirian
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN nilai_akhlak na ON na.riwayat_pendidikan_id = rp.id AND na.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [semester, kelasId])

  return rows.map((r: any) => ({
    riwayat_id:   r.riwayat_id,
    nis:          r.nis,
    nama:         r.nama_lengkap,
    kedisiplinan: r.kedisiplinan ?? 80,
    kebersihan:   r.kebersihan  ?? 80,
    kesopanan:    r.kesopanan   ?? 80,
    ibadah:       r.ibadah      ?? 80,
    kemandirian:  r.kemandirian ?? 80,
  }))
}

export const KEPRIBADIAN_FIELDS = [
  { key: 'kedisiplinan', label: 'Akhlak/Budi Pekerti' },
  { key: 'ibadah',       label: 'Ketekunan Ibadah'    },
  { key: 'kesopanan',    label: 'Kerapihan'            },
  { key: 'kebersihan',   label: 'Kebersihan'           },
  { key: 'kemandirian',  label: 'Kemandirian'          },
] as const

export async function simpanKepribadian(semester: number, data: any[]) {
  if (!data.length) return { error: 'Tidak ada data.' }
  await batch(data.map(item => ({
    sql: `INSERT INTO nilai_akhlak (id, riwayat_pendidikan_id, semester, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET
            kedisiplinan = excluded.kedisiplinan, kebersihan = excluded.kebersihan,
            kesopanan = excluded.kesopanan, ibadah = excluded.ibadah, kemandirian = excluded.kemandirian`,
    params: [generateId(), item.riwayat_id, semester, item.kedisiplinan, item.kebersihan, item.kesopanan, item.ibadah, item.kemandirian],
  })))
  revalidatePath('/dashboard/laporan/rapor')
  return { success: true }
}

// ─── CATATAN WALI KELAS ─────────────────────────────────────────────────────

export async function getDataCatatanWali(kelasId: string, semester: number) {
  const rows = await query<any>(`
    SELECT rp.id AS riwayat_id, s.nis, s.nama_lengkap, r.catatan_wali_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [semester, kelasId])

  return rows.map((r: any) => ({
    riwayat_id: r.riwayat_id,
    nis: r.nis,
    nama: r.nama_lengkap,
    catatan_wali_kelas: r.catatan_wali_kelas ?? '',
  }))
}

export async function simpanCatatanWali(semester: number, data: { riwayat_id: string; catatan: string }[]) {
  if (!data.length) return { error: 'Tidak ada data.' }
  for (const item of data) {
    await execute(`
      INSERT INTO ranking (id, riwayat_pendidikan_id, semester, catatan_wali_kelas)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(riwayat_pendidikan_id, semester) DO UPDATE SET catatan_wali_kelas = excluded.catatan_wali_kelas
    `, [generateId(), item.riwayat_id, semester, item.catatan])
  }
  revalidatePath('/dashboard/laporan/rapor')
  return { success: true }
}
