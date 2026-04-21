'use server'

import { query } from '@/lib/db'
import { getCachedTahunAjaranAktif } from '@/lib/cache/master'

export async function getDataRapor(kelasId: string, semester: number) {
  const listSantri = await query<any>(`
    SELECT rp.id, rp.grade_lanjutan,
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

  const marhalahId = listSantri[0]?.marhalah_id
  let listKitab: any[] = []
  if (marhalahId) {
    listKitab = await query<any>(
      'SELECT mapel_id, nama_kitab FROM kitab WHERE marhalah_id = ?', [marhalahId]
    )
  }

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
    const nilainya = nilaiAkademik.filter((n: any) => n.riwayat_pendidikan_id === s.id)
    const absen = absenMap.get(s.id) ?? { sakit: 0, izin: 0, alfa: 0 }

    return {
      id: s.id,
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
      nilai: nilainya.map((n: any) => {
        const kitabData = listKitab.find((k: any) => k.mapel_id === n.mapel_id)
        return { 
          mapel: n.mapel_nama || 'Tanpa Nama', 
          kitab: kitabData?.nama_kitab || '-', 
          angka: n.nilai,
          rata_kelas: mapelRataKelas[n.mapel_id] ?? 0,
        }
      }),
      absen: { sakit: absen.sakit, izin: absen.izin, alfa: absen.alfa },
      kepribadian: akhlakMap.get(s.id) || [],
    }
  })
}

function angkaKePredikat(angka: number): string {
  if (angka >= 90) return 'Sangat Baik'
  if (angka >= 75) return 'Baik'
  if (angka >= 60) return 'Cukup'
  return 'Kurang'
}

export async function getKelasList() {
  const data = await query<any>('SELECT id, nama_kelas FROM kelas', [])
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