'use server'

import { query, queryOne } from '@/lib/db'

export async function getDataRapor(kelasId: string, semester: number) {
  const listSantri = await query<any>(`
    SELECT rp.id,
           s.nama_lengkap, s.nis, s.nama_ayah,
           k.id AS kelas_id, k.nama_kelas,
           m.id AS marhalah_id, m.nama AS marhalah_nama,
           u.full_name AS wali_kelas_nama,
           r.ranking_kelas, r.predikat, r.rata_rata, r.catatan_wali_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN users u ON u.id = k.wali_kelas_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [semester, kelasId])

  if (!listSantri.length) return []

  const riwayatIds = listSantri.map((s: any) => s.id)
  const ph = riwayatIds.map(() => '?').join(',')

  const nilaiAkademik = await query<any>(`
    SELECT na.riwayat_pendidikan_id, na.mapel_id, mp.nama AS mapel_nama, na.nilai
    FROM nilai_akademik na
    JOIN mapel mp ON mp.id = na.mapel_id
    WHERE na.riwayat_pendidikan_id IN (${ph}) AND na.semester = ?
    ORDER BY mp.nama
  `, [...riwayatIds, semester])

  const absensi = await query<any>(`
    SELECT riwayat_pendidikan_id, shubuh, ashar, maghrib
    FROM absensi_harian
    WHERE riwayat_pendidikan_id IN (${ph})
  `, riwayatIds)

  const marhalahId = listSantri[0]?.marhalah_id
  let listKitab: any[] = []
  if (marhalahId) {
    listKitab = await query<any>(
      'SELECT mapel_id, nama_kitab FROM kitab WHERE marhalah_id = ?', [marhalahId]
    )
  }

  return listSantri.map((s: any) => {
    const nilainya = nilaiAkademik.filter((n: any) => n.riwayat_pendidikan_id === s.id)
    const absennya = absensi.filter((a: any) => a.riwayat_pendidikan_id === s.id)

    let sakit = 0, izin = 0, alfa = 0
    absennya.forEach((row: any) => {
      if (row.shubuh === 'S') sakit++; if (row.shubuh === 'I') izin++; if (row.shubuh === 'A') alfa++
      if (row.ashar === 'S') sakit++;  if (row.ashar === 'I') izin++;  if (row.ashar === 'A') alfa++
      if (row.maghrib === 'S') sakit++; if (row.maghrib === 'I') izin++; if (row.maghrib === 'A') alfa++
    })

    return {
      id: s.id,
      santri: { nama_lengkap: s.nama_lengkap, nis: s.nis, nama_ayah: s.nama_ayah },
      kelas: { id: s.kelas_id, nama_kelas: s.nama_kelas, marhalah: { id: s.marhalah_id, nama: s.marhalah_nama } },
      wali_kelas_nama: s.wali_kelas_nama || '..........................',
      ranking: {
        ranking_kelas: s.ranking_kelas ?? '-',
        predikat: s.predikat ?? '-',
        rata_rata: s.rata_rata ?? 0,
        catatan_wali_kelas: s.catatan_wali_kelas ?? '',
      },
      nilai: nilainya.map((n: any) => {
        const kitabData = listKitab.find((k: any) => k.mapel_id === n.mapel_id)
        return { mapel: n.mapel_nama || 'Tanpa Nama', kitab: kitabData?.nama_kitab || '-', angka: n.nilai }
      }),
      absen: { sakit, izin, alfa },
    }
  })
}

export async function getKelasList() {
  const data = await query<any>('SELECT id, nama_kelas FROM kelas', [])
  return data.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}