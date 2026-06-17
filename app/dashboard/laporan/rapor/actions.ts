'use server'

import { batch, execute, query, queryOne } from '@/lib/db'
import { getCachedTahunAjaranAktif } from '@/lib/cache/master'
import { getSession, hasAnyRole, hasRole } from '@/lib/auth/session'
import { actorFromSession, diffWhitelistedFields, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'

export async function getTahunAjaranList() {
  return query<any>('SELECT id, nama, is_active FROM tahun_ajaran ORDER BY id DESC')
}

// D1 batasi maksimal 100 bound parameter per query. Pecah IN (...) jadi chunk
// agar kelas dengan banyak santri tidak kena "too many SQL variables".
const SQL_VAR_CHUNK = 90

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Jalankan query ber-IN secara chunk lalu gabung hasilnya.
// build(ph, ids) mengembalikan { sql, params } untuk satu chunk.
async function queryChunkedByIds<T = any>(
  ids: string[],
  build: (ph: string, ids: string[]) => { sql: string; params: unknown[] }
): Promise<T[]> {
  if (!ids.length) return []
  const out: T[] = []
  for (const part of chunk(ids, SQL_VAR_CHUNK)) {
    const ph = part.map(() => '?').join(',')
    const { sql, params } = build(ph, part)
    out.push(...await query<T>(sql, params))
  }
  return out
}

type RaporMapel = {
  id: string
  nama: string
  nama_kitab: string
}

async function getRaporMapel(kelasId: string, marhalahId?: string | null) {
  const kelas = await queryOne<any>(
    'SELECT marhalah_id, tahun_ajaran_id FROM kelas WHERE id = ? LIMIT 1', [kelasId]
  )
  const tahunAjaranIdKelas = kelas?.tahun_ajaran_id ?? null
  const effMarhalahId = marhalahId || kelas?.marhalah_id || null

  if (effMarhalahId && tahunAjaranIdKelas) {
    // Satu baris per mapel. Kalau ada pilihan kitab utk kelas ini -> pakai itu,
    // kalau belum dipilih -> gabung semua judul kitab (default aman).
    const listKitab = await query<any>(`
      SELECT mp.id, mp.nama,
        COALESCE(
          (SELECT kt2.nama_kitab FROM kitab kt2
             JOIN rapor_kitab_pilihan rkp ON rkp.kitab_id = kt2.id
             WHERE rkp.kelas_id = ? AND rkp.mapel_id = mp.id LIMIT 1),
          REPLACE(GROUP_CONCAT(DISTINCT kt.nama_kitab), ',', ', ')
        ) AS nama_kitab
      FROM kitab kt
      JOIN mapel mp ON mp.id = kt.mapel_id
      WHERE kt.marhalah_id = ? AND kt.tahun_ajaran_id = ?
      GROUP BY mp.id, mp.nama
      ORDER BY mp.nama ASC
    `, [kelasId, effMarhalahId, tahunAjaranIdKelas])

    if (listKitab.length) {
      return listKitab.map((m: any) => ({
        id: m.id,
        nama: m.nama || 'Tanpa Nama',
        nama_kitab: m.nama_kitab || '-',
      })) as RaporMapel[]
    }
  }

  return query<any>(`
    SELECT mp.id, mp.nama,
      COALESCE(REPLACE(GROUP_CONCAT(DISTINCT kt.nama_kitab), ',', ', '), '-') AS nama_kitab
    FROM nilai_akademik na
    JOIN mapel mp ON mp.id = na.mapel_id
    JOIN riwayat_pendidikan rp ON rp.id = na.riwayat_pendidikan_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN kitab kt ON kt.mapel_id = mp.id
      AND kt.marhalah_id = COALESCE(k.marhalah_id, ?)
      AND kt.tahun_ajaran_id = COALESCE(k.tahun_ajaran_id, ?)
    WHERE rp.kelas_id = ?
    GROUP BY mp.id, mp.nama
    ORDER BY mp.nama ASC
  `, [effMarhalahId || '', tahunAjaranIdKelas || 0, kelasId]).then(rows => rows.map((m: any) => ({
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
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, [kelasId])

  if (!listSantri.length) return { mapel: [], siswa: [] }

  const mapel = await getRaporMapel(kelasId, listSantri[0]?.marhalah_id)
  const totalMapel = mapel.length
  const riwayatIds = listSantri.map((s: any) => s.riwayat_id)
  const nilaiRows = await queryChunkedByIds(riwayatIds, (ph, ids) => ({
    sql: `
      SELECT riwayat_pendidikan_id, mapel_id, nilai
      FROM nilai_akademik
      WHERE riwayat_pendidikan_id IN (${ph}) AND semester = ?
    `,
    params: [...ids, semester],
  }))

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
           m.id AS marhalah_id, m.nama AS marhalah_nama, m.urutan AS marhalah_urutan,
           u.full_name AS wali_kelas_nama,
           r.ranking_kelas, r.predikat, r.rata_rata, r.jumlah_nilai,
           r.catatan_wali_kelas
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN users u ON u.id = k.wali_kelas_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id AND r.semester = ?
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, [semester, kelasId])

  if (!listSantri.length) return []

  // Hitung total santri di kelas ini untuk info ranking
  const totalSantri = listSantri.length

  // "Naik Ke Marhalah": khusus semester genap diisi otomatis marhalah
  // berikutnya berdasarkan urutan. Marhalah terakhir => "Lulus".
  const marhalahList = await query<any>('SELECT nama, urutan FROM marhalah ORDER BY urutan ASC')
  const marhalahByUrutan = new Map<number, string>()
  let marhalahUrutanMax = 0
  marhalahList.forEach((m: any) => {
    marhalahByUrutan.set(Number(m.urutan), m.nama)
    if (Number(m.urutan) > marhalahUrutanMax) marhalahUrutanMax = Number(m.urutan)
  })
  const hitungNaik = (urutan: number | null, gradeLanjutan: string | null) => {
    if (semester !== 2) return gradeLanjutan || '-'
    if (urutan == null) return gradeLanjutan || '-'
    if (urutan >= marhalahUrutanMax) return 'Lulus'
    return marhalahByUrutan.get(urutan + 1) || gradeLanjutan || '-'
  }

  const riwayatIds = listSantri.map((s: any) => s.id)

  const nilaiAkademik = await queryChunkedByIds(riwayatIds, (ph, ids) => ({
    sql: `
      SELECT na.riwayat_pendidikan_id, na.mapel_id, mp.nama AS mapel_nama, na.nilai
      FROM nilai_akademik na
      JOIN mapel mp ON mp.id = na.mapel_id
      WHERE na.riwayat_pendidikan_id IN (${ph}) AND na.semester = ?
      ORDER BY mp.nama ASC
    `,
    params: [...ids, semester],
  }))

  const absensiAgg = await queryChunkedByIds(riwayatIds, (ph, ids) => ({
    sql: `
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
    `,
    params: ids,
  }))

  // Build map untuk lookup O(1)
  const absenMap = new Map<string, { sakit: number; izin: number; alfa: number }>()
  absensiAgg.forEach((a: any) => {
    absenMap.set(a.riwayat_pendidikan_id, {
      sakit: a.total_sakit ?? 0,
      izin:  a.total_izin  ?? 0,
      alfa:  a.total_alfa  ?? 0,
    })
  })

  const nilaiAkhlak = await queryChunkedByIds(riwayatIds, (ph, ids) => ({
    sql: `
      SELECT riwayat_pendidikan_id, kedisiplinan, kebersihan, kesopanan, ibadah, kemandirian
      FROM nilai_akhlak
      WHERE riwayat_pendidikan_id IN (${ph}) AND semester = ?
    `,
    params: [...ids, semester],
  }))

  const akhlakMap = new Map<string, any>()
  nilaiAkhlak.forEach((a: any) => {
    akhlakMap.set(a.riwayat_pendidikan_id, [
      { label: 'Akhlak/Budi Pekerti', predikat: angkaKePredikat(a.kedisiplinan) },
      { label: 'Ketekunan Ibadah',    predikat: angkaKePredikat(a.ibadah) },
      { label: 'Kerapihan',           predikat: angkaKePredikat(a.kesopanan) },
      { label: 'Kebersihan',          predikat: angkaKePredikat(a.kebersihan) },
    ])
  })

  const raporMapelAll = await getRaporMapel(kelasId, listSantri[0]?.marhalah_id)

  // Mapel yang tidak diujiankan (tidak ada satupun nilai > 0 dari seluruh
  // santri di kelas ini) tidak disertakan dalam rapor.
  const mapelDiujikan = new Set<string>()
  nilaiAkademik.forEach((n: any) => {
    if (Number(n.nilai) > 0) mapelDiujikan.add(String(n.mapel_id))
  })
  const raporMapel = raporMapelAll.filter((m) => mapelDiujikan.has(String(m.id)))

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
        naik_marhalah: hitungNaik(s.marhalah_urutan ?? null, s.grade_lanjutan || null),
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
           s.no_wa_ortu,
           k.nama_kelas, ta.nama AS tahun_ajaran
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
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
    no_wa_ortu: s.no_wa_ortu,
    kelas: s.nama_kelas,
    tahun_ajaran: s.tahun_ajaran,
  }))
}

type IdentitasForm = {
  riwayat_id: string
  santri_id: string
  nis: string
  nama_lengkap: string
  nik?: string | null
  tempat_lahir?: string | null
  tanggal_lahir?: string | null
  jenis_kelamin?: string | null
  nama_ayah?: string | null
  nama_ibu?: string | null
  no_wa_ortu?: string | null
  alamat?: string | null
  alamat_lengkap?: string | null
  kecamatan?: string | null
  kab_kota?: string | null
  provinsi?: string | null
  asrama?: string | null
  kamar?: string | null
  tahun_masuk?: string | number | null
}

function cleanText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function cleanYear(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const year = Number(text)
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return NaN
  return year
}

export async function updateIdentitasSantriRapor(payload: IdentitasForm) {
  const session = await getSession()
  if (!session) return { error: 'Sesi login tidak ditemukan.' }

  const row = await queryOne<any>(`
    SELECT rp.id AS riwayat_id, rp.kelas_id, rp.santri_id,
           k.wali_kelas_id, k.nama_kelas, ta.nama AS tahun_ajaran,
           s.nama_lengkap, s.nis, s.nik, s.tempat_lahir, s.tanggal_lahir,
           s.jenis_kelamin, s.nama_ayah, s.nama_ibu, s.no_wa_ortu,
           s.alamat, s.alamat_lengkap, s.kecamatan, s.kab_kota, s.provinsi,
           s.asrama, s.kamar, s.tahun_masuk
    FROM riwayat_pendidikan rp
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.id = ? AND rp.santri_id = ? AND rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
    LIMIT 1
  `, [payload.riwayat_id, payload.santri_id])

  if (!row) return { error: 'Data santri aktif tidak ditemukan.' }

  const fullAccess = hasAnyRole(session, ['admin', 'sekpen', 'akademik'])
  const waliOwnClass = hasRole(session, 'wali_kelas') && row.wali_kelas_id === session.id
  if (!fullAccess && !waliOwnClass) {
    return { error: 'Anda tidak punya akses mengedit identitas santri ini.' }
  }

  const nis = String(payload.nis ?? '').trim()
  const namaLengkap = String(payload.nama_lengkap ?? '').trim()
  if (!nis) return { error: 'NIS wajib diisi.' }
  if (!namaLengkap) return { error: 'Nama lengkap wajib diisi.' }

  const tahunMasuk = cleanYear(payload.tahun_masuk)
  if (Number.isNaN(tahunMasuk)) return { error: 'Tahun masuk harus berupa angka tahun yang valid.' }

  const duplicateNis = await queryOne<{ id: string }>(
    'SELECT id FROM santri WHERE nis = ? AND id <> ? LIMIT 1',
    [nis, payload.santri_id]
  )
  if (duplicateNis) return { error: 'NIS sudah digunakan santri lain.' }

  const after = {
    nis,
    nama_lengkap: namaLengkap,
    nik: cleanText(payload.nik),
    tempat_lahir: cleanText(payload.tempat_lahir),
    tanggal_lahir: cleanText(payload.tanggal_lahir),
    jenis_kelamin: cleanText(payload.jenis_kelamin) || 'L',
    nama_ayah: cleanText(payload.nama_ayah),
    nama_ibu: cleanText(payload.nama_ibu),
    no_wa_ortu: cleanText(payload.no_wa_ortu),
    alamat: cleanText(payload.alamat),
    alamat_lengkap: cleanText(payload.alamat_lengkap),
    kecamatan: cleanText(payload.kecamatan),
    kab_kota: cleanText(payload.kab_kota),
    provinsi: cleanText(payload.provinsi),
    asrama: cleanText(payload.asrama),
    kamar: cleanText(payload.kamar),
    tahun_masuk: tahunMasuk,
  }

  await execute(`
    UPDATE santri SET
      nis = ?, nama_lengkap = ?, nik = ?, tempat_lahir = ?, tanggal_lahir = ?,
      jenis_kelamin = ?, nama_ayah = ?, nama_ibu = ?, no_wa_ortu = ?,
      alamat = ?, alamat_lengkap = ?, kecamatan = ?, kab_kota = ?, provinsi = ?,
      asrama = ?, kamar = ?, tahun_masuk = ?, updated_at = ?
    WHERE id = ?
  `, [
    after.nis,
    after.nama_lengkap,
    after.nik,
    after.tempat_lahir,
    after.tanggal_lahir,
    after.jenis_kelamin,
    after.nama_ayah,
    after.nama_ibu,
    after.no_wa_ortu,
    after.alamat,
    after.alamat_lengkap,
    after.kecamatan,
    after.kab_kota,
    after.provinsi,
    after.asrama,
    after.kamar,
    after.tahun_masuk,
    new Date().toISOString(),
    payload.santri_id,
  ])

  const changedFields = diffWhitelistedFields(row, after, [
    'nis',
    'nama_lengkap',
    'nik',
    'tempat_lahir',
    'tanggal_lahir',
    'jenis_kelamin',
    'nama_ayah',
    'nama_ibu',
    'no_wa_ortu',
    'alamat',
    'alamat_lengkap',
    'kecamatan',
    'kab_kota',
    'provinsi',
    'asrama',
    'kamar',
    'tahun_masuk',
  ])

  await logActivity({
    actor: actorFromSession(session),
    module: 'laporan_rapor',
    action: 'update',
    fiturHref: '/dashboard/laporan/rapor',
    logKind: 'update',
    entityType: 'santri',
    entityId: payload.santri_id,
    entityLabel: namaLengkap,
    summary: `Memperbarui identitas santri ${namaLengkap} dari menu cetak rapor`,
    details: { changed_fields: changedFields, riwayat_id: payload.riwayat_id, kelas_id: row.kelas_id },
  })

  revalidatePath('/dashboard/laporan/rapor')
  revalidatePath('/dashboard/santri')
  revalidatePath(`/dashboard/santri/${payload.santri_id}`)

  return {
    success: true,
    data: {
      riwayat_id: row.riwayat_id,
      santri_id: row.santri_id,
      ...after,
      kelas: row.nama_kelas,
      tahun_ajaran: row.tahun_ajaran,
    },
  }
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
    WHERE rp.kelas_id = ? AND rp.status_riwayat = 'aktif' AND s.status_global = 'aktif'
    ORDER BY s.nama_lengkap
  `, [semester, kelasId])

  if (!siswaList.length) return { mapel: daftar.mapel, siswa: [] }

  const riwayatIds = siswaList.map((s: any) => s.riwayat_id)
  const nilaiRows = await queryChunkedByIds(riwayatIds, (ph, ids) => ({
    sql: `
      SELECT riwayat_pendidikan_id, mapel_id, nilai
      FROM nilai_akademik
      WHERE riwayat_pendidikan_id IN (${ph}) AND semester = ?
    `,
    params: [...ids, semester],
  }))

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

// ─── TITIMANGSA RAPOR (universal) ───────────────────────────────────────────

export async function getRaporTitimangsa(): Promise<{ tempat: string; tanggal: string }> {
  const rows = await query<any>(
    `SELECT key, value FROM app_settings WHERE key IN ('rapor_titimangsa_tempat', 'rapor_titimangsa_tanggal')`
  )
  const map = new Map<string, string>(rows.map((r: any) => [r.key, r.value]))
  return {
    tempat: map.get('rapor_titimangsa_tempat') || 'Sukahideng',
    tanggal: map.get('rapor_titimangsa_tanggal') || '',   // '' = pakai tanggal hari ini
  }
}

export async function saveRaporTitimangsa(tempat: string, tanggal: string) {
  const session = await getSession()
  if (!session) return { error: 'Sesi login tidak ditemukan.' }
  if (!hasAnyRole(session, ['admin', 'sekpen', 'akademik'])) {
    return { error: 'Anda tidak punya akses mengatur titimangsa rapor.' }
  }

  const tempatClean = String(tempat ?? '').trim() || 'Sukahideng'
  const tanggalClean = String(tanggal ?? '').trim()   // YYYY-MM-DD atau ''
  if (tanggalClean && !/^\d{4}-\d{2}-\d{2}$/.test(tanggalClean)) {
    return { error: 'Format tanggal tidak valid.' }
  }

  await batch([
    {
      sql: `INSERT INTO app_settings (key, value, updated_at)
            VALUES ('rapor_titimangsa_tempat', ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      params: [tempatClean],
    },
    {
      sql: `INSERT INTO app_settings (key, value, updated_at)
            VALUES ('rapor_titimangsa_tanggal', ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      params: [tanggalClean],
    },
  ])

  await logActivity({
    actor: actorFromSession(session),
    module: 'laporan_rapor',
    action: 'update',
    fiturHref: '/dashboard/laporan/rapor',
    logKind: 'update',
    entityType: 'rapor_titimangsa',
    entityId: 'global',
    entityLabel: 'Titimangsa rapor',
    summary: `Mengatur titimangsa rapor: ${tempatClean}${tanggalClean ? `, ${tanggalClean}` : ' (tanggal cetak)'}`,
    details: { tempat: tempatClean, tanggal: tanggalClean },
  })

  revalidatePath('/dashboard/laporan/rapor')
  return { success: true, data: { tempat: tempatClean, tanggal: tanggalClean } }
}

// ─── TANDA TANGAN RAPOR ─────────────────────────────────────────────────────

type TtdSetting = { url: string; x: number; y: number; w: number }

export async function getRaporTtdPimpinan(): Promise<TtdSetting> {
  const rows = await query<any>(
    `SELECT key, value FROM app_settings WHERE key IN
      ('rapor_ttd_pimpinan_url','rapor_ttd_pimpinan_x','rapor_ttd_pimpinan_y','rapor_ttd_pimpinan_w')`
  )
  const map = new Map<string, string>(rows.map((r: any) => [r.key, r.value]))
  return {
    url: map.get('rapor_ttd_pimpinan_url') || '',
    x: Number(map.get('rapor_ttd_pimpinan_x') ?? 0) || 0,
    y: Number(map.get('rapor_ttd_pimpinan_y') ?? 0) || 0,
    w: Number(map.get('rapor_ttd_pimpinan_w') ?? 100) || 100,
  }
}

export async function saveRaporTtdPimpinan(s: TtdSetting) {
  const session = await getSession()
  if (!session) return { error: 'Sesi login tidak ditemukan.' }
  if (!hasAnyRole(session, ['admin', 'sekpen', 'akademik'])) {
    return { error: 'Anda tidak punya akses mengatur tanda tangan pimpinan.' }
  }
  const url = String(s.url ?? '').trim()
  const x = Math.trunc(Number(s.x) || 0)
  const y = Math.trunc(Number(s.y) || 0)
  const w = Math.max(20, Math.min(400, Math.trunc(Number(s.w) || 100)))

  await batch([
    ['rapor_ttd_pimpinan_url', url],
    ['rapor_ttd_pimpinan_x', String(x)],
    ['rapor_ttd_pimpinan_y', String(y)],
    ['rapor_ttd_pimpinan_w', String(w)],
  ].map(([key, value]) => ({
    sql: `INSERT INTO app_settings (key, value, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    params: [key, value],
  })))

  await logActivity({
    actor: actorFromSession(session),
    module: 'laporan_rapor',
    action: 'update',
    fiturHref: '/dashboard/laporan/rapor',
    logKind: 'update',
    entityType: 'rapor_ttd_pimpinan',
    entityId: 'global',
    entityLabel: 'TTD Pimpinan',
    summary: 'Mengatur tanda tangan pimpinan rapor',
    details: { url, x, y, w },
  })

  revalidatePath('/dashboard/laporan/rapor')
  return { success: true, data: { url, x, y, w } }
}

type TtdWali = TtdSetting & { user_id: string | null; nama: string | null }

export async function getRaporTtdWali(kelasId: string): Promise<TtdWali | null> {
  const kelas = await queryOne<any>(
    `SELECT k.wali_kelas_id, u.full_name AS wali_nama
     FROM kelas k LEFT JOIN users u ON u.id = k.wali_kelas_id
     WHERE k.id = ? LIMIT 1`, [kelasId]
  )
  if (!kelas?.wali_kelas_id) return null

  const row = await queryOne<any>(
    'SELECT ttd_url, pos_x, pos_y, width FROM rapor_ttd_wali WHERE user_id = ? LIMIT 1',
    [kelas.wali_kelas_id]
  )
  return {
    user_id: kelas.wali_kelas_id,
    nama: kelas.wali_nama || null,
    url: row?.ttd_url || '',
    x: Number(row?.pos_x ?? 0) || 0,
    y: Number(row?.pos_y ?? 0) || 0,
    w: Number(row?.width ?? 100) || 100,
  }
}

export async function saveRaporTtdWali(kelasId: string, s: TtdSetting) {
  const session = await getSession()
  if (!session) return { error: 'Sesi login tidak ditemukan.' }

  const kelas = await queryOne<any>(
    'SELECT wali_kelas_id FROM kelas WHERE id = ? LIMIT 1', [kelasId]
  )
  if (!kelas?.wali_kelas_id) return { error: 'Kelas ini belum punya wali kelas.' }

  const fullAccess = hasAnyRole(session, ['admin', 'sekpen', 'akademik'])
  const isOwnWali = hasRole(session, 'wali_kelas') && kelas.wali_kelas_id === session.id
  if (!fullAccess && !isOwnWali) {
    return { error: 'Anda hanya bisa mengatur tanda tangan untuk kelas yang Anda wali-i.' }
  }

  const url = String(s.url ?? '').trim()
  const x = Math.trunc(Number(s.x) || 0)
  const y = Math.trunc(Number(s.y) || 0)
  const w = Math.max(20, Math.min(400, Math.trunc(Number(s.w) || 100)))

  await execute(`
    INSERT INTO rapor_ttd_wali (user_id, ttd_url, pos_x, pos_y, width, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      ttd_url = excluded.ttd_url, pos_x = excluded.pos_x,
      pos_y = excluded.pos_y, width = excluded.width, updated_at = excluded.updated_at
  `, [kelas.wali_kelas_id, url, x, y, w])

  await logActivity({
    actor: actorFromSession(session),
    module: 'laporan_rapor',
    action: 'update',
    fiturHref: '/dashboard/laporan/rapor',
    logKind: 'update',
    entityType: 'rapor_ttd_wali',
    entityId: kelas.wali_kelas_id,
    entityLabel: 'TTD Wali Kelas',
    summary: `Mengatur tanda tangan wali kelas (kelas ${kelasId})`,
    details: { kelas_id: kelasId, url, x, y, w },
  })

  revalidatePath('/dashboard/laporan/rapor')
  return { success: true, data: { url, x, y, w } }
}

// ─── PILIHAN KITAB RAPOR ────────────────────────────────────────────────────

type KitabOpsi = { kitab_id: number; nama_kitab: string }
type MapelKitabPilihan = {
  mapel_id: number
  mapel_nama: string
  selected_kitab_id: number | null   // null = gabung semua judul (default)
  opsi: KitabOpsi[]
}

// Daftar mapel yang punya >1 kitab utk kelas ini, beserta pilihan saat ini.
// Dipakai modal "Atur Kitab Rapor". Mapel berkitab tunggal tidak perlu diatur.
export async function getKitabPilihanOptions(kelasId: string): Promise<MapelKitabPilihan[]> {
  const kelas = await queryOne<any>(
    'SELECT marhalah_id, tahun_ajaran_id FROM kelas WHERE id = ? LIMIT 1', [kelasId]
  )
  if (!kelas?.marhalah_id || !kelas?.tahun_ajaran_id) return []

  const rows = await query<any>(`
    SELECT mp.id AS mapel_id, mp.nama AS mapel_nama,
           kt.id AS kitab_id, kt.nama_kitab,
           rkp.kitab_id AS selected_kitab_id
    FROM kitab kt
    JOIN mapel mp ON mp.id = kt.mapel_id
    LEFT JOIN rapor_kitab_pilihan rkp
      ON rkp.kelas_id = ? AND rkp.mapel_id = mp.id
    WHERE kt.marhalah_id = ? AND kt.tahun_ajaran_id = ?
    ORDER BY mp.nama ASC, kt.nama_kitab ASC
  `, [kelasId, kelas.marhalah_id, kelas.tahun_ajaran_id])

  const map = new Map<number, MapelKitabPilihan>()
  for (const r of rows) {
    let m = map.get(r.mapel_id)
    if (!m) {
      m = {
        mapel_id: r.mapel_id,
        mapel_nama: r.mapel_nama || 'Tanpa Nama',
        selected_kitab_id: r.selected_kitab_id ?? null,
        opsi: [],
      }
      map.set(r.mapel_id, m)
    }
    m.opsi.push({ kitab_id: r.kitab_id, nama_kitab: r.nama_kitab || '-' })
  }

  // Hanya mapel berkitab ganda yang butuh diatur.
  return Array.from(map.values()).filter(m => m.opsi.length > 1)
}

// Simpan pilihan kitab per mapel. kitab_id null/0 = hapus pilihan (gabung semua).
export async function saveKitabPilihan(
  kelasId: string,
  selections: { mapel_id: number; kitab_id: number | null }[]
) {
  const session = await getSession()
  if (!session) return { error: 'Sesi login tidak ditemukan.' }
  if (!hasAnyRole(session, ['admin', 'sekpen', 'akademik']) && !hasRole(session, 'wali_kelas')) {
    return { error: 'Anda tidak punya akses mengatur kitab rapor.' }
  }
  if (!selections.length) return { success: true }

  await batch(selections.map(s =>
    s.kitab_id
      ? {
          sql: `INSERT INTO rapor_kitab_pilihan (kelas_id, mapel_id, kitab_id, updated_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(kelas_id, mapel_id)
                DO UPDATE SET kitab_id = excluded.kitab_id, updated_at = datetime('now')`,
          params: [kelasId, s.mapel_id, s.kitab_id],
        }
      : {
          sql: 'DELETE FROM rapor_kitab_pilihan WHERE kelas_id = ? AND mapel_id = ?',
          params: [kelasId, s.mapel_id],
        }
  ))

  await logActivity({
    actor: actorFromSession(session),
    module: 'laporan_rapor',
    action: 'update',
    fiturHref: '/dashboard/laporan/rapor',
    logKind: 'update',
    entityType: 'rapor_kitab_pilihan',
    entityId: kelasId,
    entityLabel: `Kitab rapor kelas ${kelasId}`,
    summary: `Mengatur pilihan kitab rapor untuk ${selections.length} mapel`,
    details: { kelas_id: kelasId, selections },
  })

  revalidatePath('/dashboard/laporan/rapor')
  return { success: true }
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
