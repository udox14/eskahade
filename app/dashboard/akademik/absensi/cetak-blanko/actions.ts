'use server'

import { query, queryOne } from '@/lib/db'
import { getCachedMarhalahList, getCachedTahunAjaranAktif } from '@/lib/cache/master'

export async function getKelasForCetak() {
  const aktif = await getCachedTahunAjaranAktif()
  const data = await query<any>(`
    SELECT k.id, k.nama_kelas, m.nama AS marhalah_nama
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE k.tahun_ajaran_id = ?
  `, [aktif?.id ?? 0])
  return data.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export async function getMarhalahForCetak() {
  return getCachedMarhalahList()
}

export async function getDataBlanko(kelasId: string) {
  const kelas = await queryOne<any>(`
    SELECT k.nama_kelas,
           m.nama AS marhalah_nama,
           gs.nama_lengkap AS guru_shubuh,
           ga.nama_lengkap AS guru_ashar,
           gm.nama_lengkap AS guru_maghrib
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN data_guru gs ON gs.id = k.guru_shubuh_id
    LEFT JOIN data_guru ga ON ga.id = k.guru_ashar_id
    LEFT JOIN data_guru gm ON gm.id = k.guru_maghrib_id
    WHERE k.id = ?
  `, [kelasId])

  if (!kelas) return { error: 'Kelas tidak ditemukan' }

  const santriList = await query<any>(`
    SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.jenis_kelamin
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [kelasId])

  return { kelas, santriList }
}

export async function getDataBlankoMassal(marhalahId: string) {
  const aktif = await getCachedTahunAjaranAktif()
  const kelasList = await query<any>(`
    SELECT k.id, k.nama_kelas,
           m.nama AS marhalah_nama,
           gs.nama_lengkap AS guru_shubuh,
           ga.nama_lengkap AS guru_ashar,
           gm.nama_lengkap AS guru_maghrib
    FROM kelas k
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN data_guru gs ON gs.id = k.guru_shubuh_id
    LEFT JOIN data_guru ga ON ga.id = k.guru_ashar_id
    LEFT JOIN data_guru gm ON gm.id = k.guru_maghrib_id
    WHERE k.marhalah_id = ? AND k.tahun_ajaran_id = ?
    ORDER BY k.nama_kelas
  `, [marhalahId, aktif?.id ?? 0])

  const sorted = kelasList.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )

  if (!sorted.length) return { error: 'Tidak ada kelas di tingkat ini.' }

  const result = await Promise.all(sorted.map(async (kelas: any) => {
    const santriList = await query<any>(`
      SELECT s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah, s.jenis_kelamin
      FROM riwayat_pendidikan rp
      JOIN santri s ON s.id = rp.santri_id
      WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
      ORDER BY s.nama_lengkap
    `, [kelas.id])
    return { kelas, santriList }
  }))

  return { massal: result }
}