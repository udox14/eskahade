'use server'

import { query, execute, batch, generateId } from '@/lib/db'
import { getCachedMapelList } from '@/lib/cache/master'
import { getSession, hasRole } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

/** 
 * Ambil data referensi (Mapel & Kelas) 
 * Menggunakan logika yang sama dengan Leger Nilai agar terbukti berhasil.
 */
export async function getReferensiData() {
  try {
    const session = await getSession()
    if (!session) {
      console.warn("No session found in getReferensiData");
      return { mapel: [], kelas: [] }
    }

    // Jalankan parallel
    const [mapelRaw, kelasRaw] = await Promise.all([
      // Mapel: Ambil langsung dari DB
      query<any>('SELECT id, nama FROM mapel WHERE aktif = 1 ORDER BY nama').catch(err => {
        console.error("Error Mapel:", err);
        return []
      }),
      // Kelas: Ambil dengan filter Wali Kelas jika perlu (sama seperti Leger)
      (async () => {
        let sql = `
          SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama
          FROM kelas k
          LEFT JOIN marhalah m ON m.id = k.marhalah_id
        `
        const params: any[] = []
        if (hasRole(session, 'wali_kelas')) {
          sql += ' WHERE k.wali_kelas_id = ?'
          params.push(session.id)
        }
        return query<any>(sql, params).catch(err => {
          console.error("Error Kelas:", err);
          return []
        })
      })()
    ])

    const kelas = (kelasRaw || []).sort((a: any, b: any) =>
      String(a.nama_kelas).localeCompare(String(b.nama_kelas), undefined, { numeric: true, sensitivity: 'base' })
    )

    return { 
      mapel: mapelRaw || [], 
      kelas: kelas
    }
  } catch (err) {
    console.error("Fatal error in getReferensiData:", err)
    // Jangan throw ke client agar tidak muncul error toast merah yang kasar, 
    // tapi kembalikan objek kosong
    return { mapel: [], kelas: [] }
  }
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

    const getVal = (col: string) => {
      const v = Number(row[col] || row[col.toLowerCase()])
      return isNaN(v) ? 80 : Math.min(100, Math.max(0, v))
    }

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

    const catatan = String(row['CATATAN WALI KELAS'] || row['catatan_wali_kelas'] || '').trim()
    if (catatan) {
      toUpsertRanking.push({ riwayatId, semester, catatan })
    }
  })

  if (errors.length > 0) return { error: `Ditemukan masalah:\n${errors.slice(0, 5).join('\n')}` }

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
  
  return { success: true }
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
