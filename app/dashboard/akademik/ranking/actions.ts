'use server'

import { query } from '@/lib/db'

export async function getJuaraUmum(semester: number) {
  const allKelas = await query<any>(`
    SELECT k.id, k.nama_kelas,
           ta.nama AS tahun_ajaran,
           m.nama AS marhalah_nama, m.urutan AS marhalah_urutan,
           u.full_name AS wali_kelas
    FROM kelas k
    LEFT JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN users u ON u.id = k.wali_kelas_id
  `, [])

  const rankingData = await query<any>(`
    SELECT r.ranking_kelas, r.jumlah_nilai, r.rata_rata,
           rp.kelas_id,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM ranking r
    JOIN riwayat_pendidikan rp ON rp.id = r.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    WHERE r.semester = ? AND r.ranking_kelas <= 3
  `, [semester])

  const formattedKelas = allKelas.map((k: any) => ({
    kelas_id: k.id,
    kelas_nama: k.nama_kelas,
    tahun_ajaran: k.tahun_ajaran || null,
    marhalah_nama: k.marhalah_nama || '-',
    marhalah_urutan: k.marhalah_urutan || 999,
    wali_kelas: k.wali_kelas || '-',
  }))

  formattedKelas.sort((a: any, b: any) => {
    if (a.marhalah_urutan !== b.marhalah_urutan) return a.marhalah_urutan - b.marhalah_urutan
    return a.kelas_nama.localeCompare(b.kelas_nama, undefined, { numeric: true, sensitivity: 'base' })
  })

  const result: any[] = []

  formattedKelas.forEach((kelas: any) => {
    const ranksForClass = rankingData.filter((r: any) => r.kelas_id === kelas.kelas_id)

    for (let i = 1; i <= 3; i++) {
      const foundRank = ranksForClass.find((r: any) => r.ranking_kelas === i)
      if (foundRank) {
        result.push({
          rank: i,
          jumlah: foundRank.jumlah_nilai,
          rata: foundRank.rata_rata,
          kelas_nama: kelas.kelas_nama,
          tahun_ajaran: kelas.tahun_ajaran,
          marhalah_nama: kelas.marhalah_nama,
          marhalah_urutan: kelas.marhalah_urutan,
          wali_kelas: kelas.wali_kelas,
          santri_nama: foundRank.nama_lengkap,
          nis: foundRank.nis,
          asrama: foundRank.asrama || '',
          kamar: foundRank.kamar || '',
        })
      } else {
        result.push({
          rank: i, jumlah: '', rata: '',
          kelas_nama: kelas.kelas_nama,
          tahun_ajaran: kelas.tahun_ajaran,
          marhalah_nama: kelas.marhalah_nama,
          marhalah_urutan: kelas.marhalah_urutan,
          wali_kelas: kelas.wali_kelas,
          santri_nama: '', nis: '', asrama: '', kamar: '',
        })
      }
    }
  })

  return result
}