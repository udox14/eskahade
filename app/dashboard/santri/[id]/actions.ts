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

  if (!riwayat.length) return []

  // Ambil semua nilai sekaligus — 1 query, bukan N+1
  const riwayatIds = riwayat.map((r: any) => r.id)
  const ph = riwayatIds.map(() => '?').join(',')
  const semuaNilai = await query<any>(`
    SELECT na.riwayat_pendidikan_id, mp.nama as mapel_nama, na.nilai, na.semester
    FROM nilai_akademik na
    LEFT JOIN mapel mp ON na.mapel_id = mp.id
    WHERE na.riwayat_pendidikan_id IN (${ph})
    ORDER BY na.semester
  `, riwayatIds)

  // Group nilai per riwayat_pendidikan_id di memory
  const nilaiByRiwayat = new Map<string, any[]>()
  semuaNilai.forEach((n: any) => {
    if (!nilaiByRiwayat.has(n.riwayat_pendidikan_id)) nilaiByRiwayat.set(n.riwayat_pendidikan_id, [])
    nilaiByRiwayat.get(n.riwayat_pendidikan_id)!.push(n)
  })

  return riwayat.map((r: any) => ({
    ...r,
    nilai_detail: nilaiByRiwayat.get(r.id) ?? [],
  }))
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