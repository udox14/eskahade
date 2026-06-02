'use server'

import { query } from '@/lib/db'
import { getCachedTahunAjaranAktif } from '@/lib/cache/master'

export async function getTahunAjaranList() {
  return query<any>('SELECT id, nama, is_active FROM tahun_ajaran ORDER BY id DESC')
}

type RaporMapel = {
  id: string
  nama: string
  nama_kitab: string
}

async function getRaporMapel(kelasId: string, marhalahId?: string | null) {
  const tahunAjaranIdKelas = await query<any>(
    'SELECT tahun_ajaran_id FROM kelas WHERE id = ? LIMIT 1', [kelasId]
  ).then(r => r[0]?.tahun_ajaran_id ?? null)

  if (marhalahId && tahunAjaranIdKelas) {
    const listKitab = await query<any>(`
      SELECT mp.id, mp.nama, kt.nama_kitab
      FROM kitab kt
      JOIN mapel mp ON mp.id = kt.mapel_id
      WHERE kt.marhalah_id = ? AND kt.tahun_ajaran_id = ?
      ORDER BY mp.nama ASC
    `, [marhalahId, tahunAjaranIdKelas])

    if (listKitab.length) {
      return listKitab.map((m: any) => ({
        id: m.id,
        nama: m.nama || 'Tanpa Nama',
        nama_kitab: m.nama_kitab || '-',
      })) as RaporMapel[]
    }
  }

  return query<any>(`
    SELECT DISTINCT mp.id, mp.nama, '-' AS nama_kitab
    FROM nilai_akademik na
    JOIN mapel mp ON mp.id = na.mapel_id
    JOIN riwayat_pendidikan rp ON rp.id = na.riwayat_pendidikan_id
    WHERE rp.kelas_id = ?
    ORDER BY mp.nama ASC
  `, [kelasId]).then(rows => rows.map((m: any) => ({
    id: m.id,
    nama: m.nama || 'Tanpa Nama',
    nama_kitab: m.nama_kitab || '-',
  })))
}

export async function getDaftarCetakRapor(kelasId: string, semester: number) {
  const listSantri = await query<any>(`
    SELECT rp.id AS riwayat_id, rp.santri_id,
           s.nama_lengkap, s.nis,
           k.id AS kelas_id, k.nama_kelas,
           m.id AS marhalah_id, m.nama AS marhalah_nama
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [kelasId])

  if (!listSantri.length) return { mapel: [], siswa: [] }

  const mapel = await getRaporMapel(kelasId, listSantri[0]?.marhalah_id)
  const totalMapel = mapel.length
  const riwayatIds = listSantri.map((s: any) => s.riwayat_id)
  const ph = riwayatIds.map(() => '?').join(',')
  const nilaiRows = await query<any>(`
    SELECT riwayat_pendidikan_id, mapel_id, nilai
    FROM nilai_akademik
    WHERE riwayat_pendidikan_id IN (${ph}) AND semester = ?
  `, [...riwayatIds, semester])

  const nilaiMap = new Map<string, number>()
  nilaiRows.forEach((n: any) => {
    nilaiMap.set(`${n.riwayat_pendidikan_id}:${n.mapel_id}`, Number(n.nilai) || 0)
  })

  return {
    mapel,
    siswa: listSantri.map((s: any) => {
      const terisi = mapel.reduce((total, m) => {
        return total + ((nilaiMap.get(`${s.riwayat_id}:${m.id}`) ?? 0) > 0 ? 1 : 0)
      }, 0)

      return {
        riwayat_id: s.riwayat_id,
        santri_id: s.santri_id,
        nis: s.nis || '-',
        nama: s.nama_lengkap || 'Tanpa Nama',
        kelas: {
          id: s.kelas_id,
          nama_kelas: s.nama_kelas,
          marhalah: { id: s.marhalah_id, nama: s.marhalah_nama },
        },
        status_nilai: {
          terisi,
          total: totalMapel,
          lengkap: totalMapel > 0 && terisi >= totalMapel,
        },
      }
    }),
  }
}

export async function getDataRapor(kelasId: string, semester: number) {
  const listSantri = await query<any>(`
    SELECT rp.id, rp.santri_id, rp.grade_lanjutan,
           s.nama_lengkap, s.nis, s.nama_ayah,
           k.id AS kelas_id, k.nama_kelas,
           m.id AS marhalah_id, m.nama AS marhalah_nama,
           u.full_name AS wali_kelas_nama,
           r.ranking_kelas, r.predikat, r.rata_rata, r.jumlah_nilai,
           r.catatan_wali_kelas
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

  // Hitung total santri di kelas ini untuk info ranking
  const totalSantri = listSantri.length

  const riwayatIds = listSantri.map((s: any) => s.id)
  const ph = riwayatIds.map(() => '?').join(',')

  const nilaiAkademik = await query<any>(`
    SELECT na.riwayat_pendidikan_id, na.mapel_id, mp.nama AS mapel_nama, na.nilai
    FROM nilai_akademik na
    JOIN mapel mp ON mp.id = na.mapel_id
    WHERE na.riwayat_pendidikan_id IN (${ph}) AND na.semester = ?
    ORDER BY mp.nama ASC
  `, [...riwayatIds, semester])

  const absensiAgg = await query<any>(`
    SELECT
      riwayat_pendidikan_id,
      SUM(CASE WHEN shubuh  = 'S' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN ashar   = 'S' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN maghrib = 'S' THEN 1 ELSE 0 END) AS total_sakit,
      SUM(CASE WHEN shubuh  = 'I' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN ashar   = 'I' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN maghrib = 'I' THEN 1 ELSE 0 END) AS total_izin,
      SUM(CASE WHEN shubuh  = 'A' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN ashar   = 'A' THEN 1 ELSE 0 END) +
      SUM(CASE WHEN maghrib = 'A' THEN 1 ELSE 0 END) AS total_alfa
    FROM absensi_harian
    WHERE riwayat_pendidikan_id IN (${ph})
    GROUP BY riwayat_pendidikan_id
  `, riwayatIds)

  // Build map untuk lookup O(1)
  const absenMap = new Map<string, { sakit: number; izin: number; alfa: number }>()
  absensiAgg.forEach((a: any) => {
    absenMap.set(a.riwayat_pendidikan_id, {
      sakit: a.total_sakit ?? 0,
      izin:  a.total_izin  ?? 0,
      alfa:  a.total_alfa  ?? 0,
    })
  })

  const nilaiAkhlak = await query<any>(`
    SELECT riwayat_pendidikan_id, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian
    FROM nilai_akhlak
    WHERE riwayat_pendidikan_id IN (${ph}) AND semester = ?
  `, [...riwayatIds, semester])

  const akhlakMap = new Map<string, any>()
  nilaiAkhlak.forEach((a: any) => {
    akhlakMap.set(a.riwayat_pendidikan_id, [
      { label: 'Akhlak/Budi Pekerti', predikat: angkaKePredikat(a.kedisiplinan) },
      { label: 'Ketekunan Ibadah',    predikat: angkaKePredikat(a.ibadah) },
      { label: 'Kerapihan',           predikat: angkaKePredikat(a.kesopanan) },
      { label: 'Kebersihan',          predikat: angkaKePredikat(a.kebersihan) },
    ])
  })

  const raporMapel = await getRaporMapel(kelasId, listSantri[0]?.marhalah_id)

  // Ambil rata-rata kelas per mapel untuk kolom "Rata-rata Kelas"
  // Hitung manual dari nilaiAkademik
  const mapelRataKelas: Record<string, number> = {}
  const mapelCount: Record<string, number> = {}
  nilaiAkademik.forEach((n: any) => {
    if (!mapelRataKelas[n.mapel_id]) {
      mapelRataKelas[n.mapel_id] = 0
      mapelCount[n.mapel_id] = 0
    }
    if (n.nilai > 0) {
      mapelRataKelas[n.mapel_id] += n.nilai
      mapelCount[n.mapel_id]++
    }
  })
  Object.keys(mapelRataKelas).forEach(id => {
    mapelRataKelas[id] = mapelCount[id] > 0
      ? parseFloat((mapelRataKelas[id] / mapelCount[id]).toFixed(2))
      : 0
  })

  return listSantri.map((s: any) => {
    const nilaiMap = new Map(
      nilaiAkademik
        .filter((n: any) => n.riwayat_pendidikan_id === s.id)
        .map((n: any) => [n.mapel_id, n])
    )
    const absen = absenMap.get(s.id) ?? { sakit: 0, izin: 0, alfa: 0 }

    return {
      id: s.id,
      santri_id: s.santri_id,
      santri: { nama_lengkap: s.nama_lengkap, nis: s.nis, nama_ayah: s.nama_ayah },
      kelas: { 
        id: s.kelas_id, 
        nama_kelas: s.nama_kelas, 
        grade_lanjutan: s.grade_lanjutan || null,
        marhalah: { id: s.marhalah_id, nama: s.marhalah_nama } 
      },
      wali_kelas_nama: s.wali_kelas_nama || '..........................',
      ranking: {
        ranking_kelas: s.ranking_kelas ?? '-',
        total_santri: totalSantri,
        predikat: s.predikat ?? '-',
        rata_rata: s.rata_rata ?? 0,
        jumlah_nilai: s.jumlah_nilai ?? 0,
        catatan_wali_kelas: s.catatan_wali_kelas ?? '',
      },
      nilai: raporMapel.map((m) => {
        const n: any = nilaiMap.get(m.id)
        return { 
          mapel: m.nama || 'Tanpa Nama',
          kitab: m.nama_kitab || '-',
          angka: n?.nilai ?? 0,
          rata_kelas: mapelRataKelas[m.id] ?? 0,
        }
      }),
      absen: { sakit: absen.sakit, izin: absen.izin, alfa: absen.alfa },
      kepribadian: akhlakMap.get(s.id) || [],
    }
  })
}

export async function getDataIdentitas(kelasId: string) {
  const rows = await query<any>(`
    SELECT rp.id AS riwayat_id, rp.santri_id,
           s.nama_lengkap, s.nis, s.nik, s.tempat_lahir, s.tanggal_lahir,
           s.jenis_kelamin, s.nama_ayah, s.nama_ibu, s.alamat, s.alamat_lengkap,
           s.kecamatan, s.kab_kota, s.provinsi, s.asrama, s.kamar, s.tahun_masuk,
           k.nama_kelas, ta.nama AS tahun_ajaran
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [kelasId])

  return rows.map((s: any) => ({
    riwayat_id: s.riwayat_id,
    santri_id: s.santri_id,
    nama_lengkap: s.nama_lengkap,
    nis: s.nis,
    nik: s.nik,
    tempat_lahir: s.tempat_lahir,
    tanggal_lahir: s.tanggal_lahir,
    jenis_kelamin: s.jenis_kelamin,
    nama_ayah: s.nama_ayah,
    nama_ibu: s.nama_ibu,
    alamat: s.alamat,
    alamat_lengkap: s.alamat_lengkap,
    kecamatan: s.kecamatan,
    kab_kota: s.kab_kota,
    provinsi: s.provinsi,
    asrama: s.asrama,
    kamar: s.kamar,
    tahun_masuk: s.tahun_masuk,
    kelas: s.nama_kelas,
    tahun_ajaran: s.tahun_ajaran,
  }))
}

export async function getLegerRaporData(kelasId: string, semester: number) {
  const daftar = await getDaftarCetakRapor(kelasId, semester)
  const siswaList = await query<any>(`
    SELECT rp.id AS riwayat_id,
           s.nis, s.nama_lengkap,
           r.jumlah_nilai, r.rata_rata, r.ranking_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, [semester, kelasId])

  if (!siswaList.length) return { mapel: daftar.mapel, siswa: [] }

  const riwayatIds = siswaList.map((s: any) => s.riwayat_id)
  const ph = riwayatIds.map(() => '?').join(',')
  const nilaiRows = await query<any>(`
    SELECT riwayat_pendidikan_id, mapel_id, nilai
    FROM nilai_akademik
    WHERE riwayat_pendidikan_id IN (${ph}) AND semester = ?
  `, [...riwayatIds, semester])

  const nilaiMap = new Map<string, number>()
  nilaiRows.forEach((n: any) => {
    nilaiMap.set(`${n.riwayat_pendidikan_id}:${n.mapel_id}`, Number(n.nilai) || 0)
  })

  return {
    mapel: daftar.mapel,
    siswa: siswaList.map((s: any) => {
      const nilai: Record<string, number> = {}
      daftar.mapel.forEach((m: RaporMapel) => {
        nilai[m.id] = nilaiMap.get(`${s.riwayat_id}:${m.id}`) ?? 0
      })

      return {
        id: s.riwayat_id,
        nis: s.nis || '-',
        nama: s.nama_lengkap || 'Tanpa Nama',
        nilai,
        jumlah: s.jumlah_nilai || 0,
        rata: s.rata_rata || 0,
        rank: s.ranking_kelas || '-',
      }
    }),
  }
}

function angkaKePredikat(angka: number): string {
  if (angka >= 90) return 'Sangat Baik'
  if (angka >= 75) return 'Baik'
  if (angka >= 60) return 'Cukup'
  return 'Kurang'
}

export async function getKelasList(tahunAjaranId?: number) {
  let taId = tahunAjaranId
  if (!taId) {
    const aktif = await getCachedTahunAjaranAktif()
    taId = aktif?.id
  }

  const data = taId
    ? await query<any>('SELECT id, nama_kelas FROM kelas WHERE tahun_ajaran_id = ?', [taId])
    : await query<any>('SELECT id, nama_kelas FROM kelas', [])

  return data.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export async function getTahunAjaran(): Promise<string> {
  try {
    const ta = await getCachedTahunAjaranAktif()
    if (ta?.nama) return ta.nama
  } catch {}

  // Fallback: hitung otomatis berdasarkan bulan
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month >= 7) return `${year}/${year + 1}`
  return `${year - 1}/${year}`
}
