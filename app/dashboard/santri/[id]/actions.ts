'use server'

import { query, queryOne } from '@/lib/db'

export async function getSantriDetail(id: string) {
  const data = await queryOne<any>('SELECT * FROM santri WHERE id = ?', [id])
  if (!data) return null

  const riwayat = await query<any>(`
    SELECT rp.id, rp.status_riwayat,
      k.id as kelas_id, k.nama_kelas,
      m.nama as marhalah_nama
    FROM riwayat_pendidikan rp
    LEFT JOIN kelas k ON rp.kelas_id = k.id
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    WHERE rp.santri_id = ?
  `, [id])

  const kelasAktif = riwayat.find((r: any) => r.status_riwayat === 'aktif')
  const infoKelas = kelasAktif ? kelasAktif.nama_kelas : 'Belum Masuk Kelas'

  return { ...data, riwayat_pendidikan: riwayat, info_kelas: infoKelas }
}

export async function getRiwayatAkademik(santriId: string) {
  const riwayat = await query<any>(`
    SELECT rp.id, rp.status_riwayat,
      k.nama_kelas, m.nama as marhalah_nama, ta.nama as tahun_ajaran_nama,
      r.ranking_kelas, r.predikat, r.rata_rata
    FROM riwayat_pendidikan rp
    LEFT JOIN kelas k ON rp.kelas_id = k.id
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN tahun_ajaran ta ON k.tahun_ajaran_id = ta.id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id
    WHERE rp.santri_id = ?
    ORDER BY rp.created_at DESC
  `, [santriId])

  const result = await Promise.all(riwayat.map(async (r: any) => {
    const nilai = await query<any>(`
      SELECT mp.nama as mapel_nama, na.nilai, na.semester
      FROM nilai_akademik na
      LEFT JOIN mapel mp ON na.mapel_id = mp.id
      WHERE na.riwayat_pendidikan_id = ?
      ORDER BY na.semester
    `, [r.id])
    return { ...r, nilai_detail: nilai }
  }))

  return result
}

export async function getRiwayatPelanggaran(santriId: string) {
  return await query(
    'SELECT id, tanggal, jenis, deskripsi, poin FROM pelanggaran WHERE santri_id = ? ORDER BY tanggal DESC',
    [santriId]
  )
}

export async function getRiwayatPerizinan(santriId: string) {
  return await query(
    'SELECT id, created_at, status, jenis, alasan, tgl_mulai, tgl_selesai_rencana, tgl_kembali_aktual FROM perizinan WHERE santri_id = ? ORDER BY created_at DESC',
    [santriId]
  )
}

export async function getRiwayatSPP(santriId: string) {
  return await query<any>(`
    SELECT sl.id, sl.bulan, sl.tahun, sl.nominal_bayar, sl.tanggal_bayar, u.full_name as penerima_nama
    FROM spp_log sl
    LEFT JOIN users u ON sl.penerima_id = u.id
    WHERE sl.santri_id = ?
    ORDER BY sl.tahun DESC, sl.bulan DESC
  `, [santriId])
}

export async function getRiwayatTabungan(santriId: string) {
  return await query(
    'SELECT * FROM tabungan_log WHERE santri_id = ? ORDER BY created_at DESC',
    [santriId]
  )
}