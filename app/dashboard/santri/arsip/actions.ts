'use server'

import { query, queryOne } from '@/lib/db'
import { revalidatePath } from 'next/cache'

const PAGE_SIZE = 30

export type FilterSantri = {
  search?: string
  asrama?: string
  sekolah?: string
  kelas_sekolah?: string
  kelas_pesantren?: string
  page?: number
}

export async function getSantriAktifUntukArsip(filter: FilterSantri = {}) {
  const { search, asrama, sekolah, kelas_sekolah, kelas_pesantren, page = 1 } = filter
  const offset = (page - 1) * PAGE_SIZE

  let sql = `
    SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, s.sekolah, s.kelas_sekolah,
      k.nama_kelas as kelas_pesantren_nama
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON rp.kelas_id = k.id
    WHERE s.status_global = 'aktif'
  `
  const params: any[] = []

  if (search) { sql += ` AND (s.nama_lengkap LIKE ? OR s.nis LIKE ?)`; params.push(`%${search}%`, `%${search}%`) }
  if (asrama) { sql += ' AND s.asrama = ?'; params.push(asrama) }
  if (sekolah) { sql += ' AND s.sekolah = ?'; params.push(sekolah) }
  if (kelas_sekolah) { sql += ' AND s.kelas_sekolah LIKE ?'; params.push(`%${kelas_sekolah}%`) }
  if (kelas_pesantren) { sql += ' AND LOWER(k.nama_kelas) = LOWER(?)'; params.push(kelas_pesantren) }

  sql += ' ORDER BY s.nama_lengkap'

  const allData = await query<any>(sql, params)
  const total = allData.length
  const data = allData.slice(offset, offset + PAGE_SIZE)

  return { data, total, page, hasMore: offset + PAGE_SIZE < total }
}

export async function getFilterOptionsSantri() {
  const [asramaRows, sekolahRows, kelasRows] = await Promise.all([
    query<{ asrama: string }>(`SELECT DISTINCT asrama FROM santri WHERE status_global = 'aktif' AND asrama IS NOT NULL`),
    query<{ sekolah: string }>(`SELECT DISTINCT sekolah FROM santri WHERE status_global = 'aktif' AND sekolah IS NOT NULL`),
    query<{ nama_kelas: string }>('SELECT nama_kelas FROM kelas'),
  ])

  return {
    asramaList: asramaRows.map(r => r.asrama).sort(),
    sekolahList: sekolahRows.map(r => r.sekolah).sort(),
    kelasList: kelasRows.map(r => r.nama_kelas).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  }
}

export async function getGrupArsip() {
  const data = await query<any>(
    'SELECT angkatan, catatan, tanggal_arsip, asrama FROM santri_arsip ORDER BY tanggal_arsip DESC'
  )

  const grupMap = new Map<string, any>()
  for (const row of data) {
    const tgl = row.tanggal_arsip?.split('T')[0] ?? ''
    const key = `${row.angkatan ?? 'null'}__${row.catatan ?? ''}__${tgl}`
    if (grupMap.has(key)) {
      const g = grupMap.get(key)!
      g.jumlah++
      if (row.asrama && !g.asramaList.includes(row.asrama)) g.asramaList.push(row.asrama)
    } else {
      grupMap.set(key, { key, angkatan: row.angkatan, catatan: row.catatan, tanggal_arsip: tgl, jumlah: 1, asramaList: row.asrama ? [row.asrama] : [] })
    }
  }
  return Array.from(grupMap.values())
}

export type FilterSantriArsip = { search?: string; asrama?: string; page?: number }

export async function getSantriDalamGrup(
  angkatan: number | null,
  catatan: string | null,
  tanggalArsip: string,
  filter: FilterSantriArsip = {}
) {
  const { search, asrama, page = 1 } = filter
  const offset = (page - 1) * PAGE_SIZE

  let sql = `SELECT id, nis, nama_lengkap, asrama, tanggal_arsip, catatan, angkatan
    FROM santri_arsip
    WHERE tanggal_arsip >= ? AND tanggal_arsip <= ?`
  const params: any[] = [`${tanggalArsip}T00:00:00`, `${tanggalArsip}T23:59:59`]

  if (angkatan !== null) { sql += ' AND angkatan = ?'; params.push(angkatan) }
  else sql += ' AND angkatan IS NULL'

  if (catatan) { sql += ' AND catatan = ?'; params.push(catatan) }
  else sql += ' AND catatan IS NULL'

  if (search) { sql += ` AND (nama_lengkap LIKE ? OR nis LIKE ?)`; params.push(`%${search}%`, `%${search}%`) }
  if (asrama) { sql += ' AND asrama = ?'; params.push(asrama) }

  sql += ' ORDER BY nama_lengkap'

  const allData = await query<any>(sql, params)
  const total = allData.length
  const data = allData.slice(offset, offset + PAGE_SIZE)

  return { data, total, page, hasMore: offset + PAGE_SIZE < total }
}

export async function arsipkanSantri(santriIds: string[], catatan: string) {
  if (!santriIds || santriIds.length === 0) return { error: 'Pilih minimal 1 santri' }

  let berhasil = 0, gagal = 0
  const errorList: string[] = []

  for (const santriId of santriIds) {
    try {
      const profil = await queryOne<any>('SELECT * FROM santri WHERE id = ?', [santriId])
      if (!profil) { gagal++; errorList.push(`ID ${santriId}: Data tidak ditemukan`); continue }

      const riwayatList = await query<any>(`
        SELECT rp.id, rp.kelas_id, rp.status_riwayat, k.nama_kelas
        FROM riwayat_pendidikan rp LEFT JOIN kelas k ON rp.kelas_id = k.id
        WHERE rp.santri_id = ?
      `, [santriId])

      const riwayatIds = riwayatList.map((r: any) => r.id)

      // Ambil nilai dan absensi
      const nilaiList = riwayatIds.length > 0
        ? await query(`SELECT * FROM nilai_akademik WHERE riwayat_pendidikan_id IN (${riwayatIds.map(() => '?').join(',')})`, riwayatIds)
        : []
      const absensiList = riwayatIds.length > 0
        ? await query(`SELECT * FROM absensi_harian WHERE riwayat_pendidikan_id IN (${riwayatIds.map(() => '?').join(',')})`, riwayatIds)
        : []
      const pelanggaranList = await query('SELECT * FROM pelanggaran WHERE santri_id = ?', [santriId])
      const sppList = await query('SELECT * FROM spp_log WHERE santri_id = ?', [santriId])

      const snapshot = JSON.stringify({ profil, riwayat_pendidikan: riwayatList, absensi: absensiList, pelanggaran: pelanggaranList, spp: sppList, nilai: nilaiList })
      const angkatan = profil.nis ? parseInt(String(profil.nis).substring(0, 4)) || null : null
      const now = new Date().toISOString()

      await query(
        `INSERT INTO santri_arsip (id, santri_id_asli, nis, nama_lengkap, angkatan, asrama, catatan, snapshot, tanggal_arsip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), santriId, profil.nis, profil.nama_lengkap, isNaN(angkatan as number) ? null : angkatan, profil.asrama, catatan || null, snapshot, now]
      )

      // Hapus data relasi
      if (riwayatIds.length > 0) {
        const ph = riwayatIds.map(() => '?').join(',')
        await query(`DELETE FROM nilai_akademik WHERE riwayat_pendidikan_id IN (${ph})`, riwayatIds)
        await query(`DELETE FROM absensi_harian WHERE riwayat_pendidikan_id IN (${ph})`, riwayatIds)
        await query('DELETE FROM riwayat_pendidikan WHERE santri_id = ?', [santriId])
      }
      await query('DELETE FROM pelanggaran WHERE santri_id = ?', [santriId])
      await query('DELETE FROM spp_log WHERE santri_id = ?', [santriId])
      await query('DELETE FROM santri WHERE id = ?', [santriId])

      berhasil++
    } catch (err: any) {
      gagal++; errorList.push(`ID ${santriId}: ${err.message}`)
    }
  }

  revalidatePath('/dashboard/santri/arsip')
  revalidatePath('/dashboard/santri')
  return { success: true, berhasil, gagal, errors: errorList }
}

export async function restoreSantri(arsipIds: string[]) {
  if (!arsipIds || arsipIds.length === 0) return { error: 'Pilih minimal 1 data untuk direstore' }

  let berhasil = 0, gagal = 0
  const errorList: string[] = []

  for (const arsipId of arsipIds) {
    try {
      const arsip = await queryOne<any>('SELECT * FROM santri_arsip WHERE id = ?', [arsipId])
      if (!arsip) { gagal++; errorList.push(`Arsip ID ${arsipId}: Tidak ditemukan`); continue }

      const snap = JSON.parse(arsip.snapshot)
      const profilAsli = { ...snap.profil }
      delete profilAsli.id
      profilAsli.status_global = 'aktif'

      const idBaru = crypto.randomUUID()
      const now = new Date().toISOString()

      await query(
        `INSERT INTO santri (id, nis, nama_lengkap, nik, jenis_kelamin, tempat_lahir, tanggal_lahir,
          nama_ayah, nama_ibu, alamat, status_global, sekolah, kelas_sekolah, asrama, kamar, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [idBaru, profilAsli.nis, profilAsli.nama_lengkap, profilAsli.nik, profilAsli.jenis_kelamin,
         profilAsli.tempat_lahir, profilAsli.tanggal_lahir, profilAsli.nama_ayah, profilAsli.nama_ibu,
         profilAsli.alamat, 'aktif', profilAsli.sekolah, profilAsli.kelas_sekolah, profilAsli.asrama, profilAsli.kamar, now, now]
      )

      // Restore riwayat (kelas dikosongkan)
      const mapRiwayat = new Map<string, string>()
      for (const rw of (snap.riwayat_pendidikan || [])) {
        const rwId = crypto.randomUUID()
        await query(
          'INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at) VALUES (?, ?, ?, ?, ?)',
          [rwId, idBaru, null, rw.status_riwayat || 'aktif', now]
        )
        mapRiwayat.set(rw.id, rwId)

        for (const n of (rw.nilai_akademik || [])) {
          await query(
            'INSERT INTO nilai_akademik (id, riwayat_pendidikan_id, mapel_id, semester, nilai) VALUES (?, ?, ?, ?, ?)',
            [crypto.randomUUID(), rwId, n.mapel_id, n.semester, n.nilai]
          )
        }
      }

      for (const p of (snap.pelanggaran || [])) {
        const { id: _id, santri_id: _old, ...pData } = p
        await query(
          'INSERT INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin) VALUES (?, ?, ?, ?, ?, ?)',
          [crypto.randomUUID(), idBaru, pData.tanggal, pData.jenis, pData.deskripsi, pData.poin]
        )
      }

      await query('DELETE FROM santri_arsip WHERE id = ?', [arsipId])
      berhasil++
    } catch (err: any) {
      gagal++; errorList.push(`Arsip ID ${arsipId}: ${err.message}`)
    }
  }

  revalidatePath('/dashboard/santri/arsip')
  revalidatePath('/dashboard/santri')
  return { success: true, berhasil, gagal, errors: errorList }
}

export async function getArsipForDownload(arsipIds?: string[]) {
  if (arsipIds && arsipIds.length > 0) {
    const ph = arsipIds.map(() => '?').join(',')
    const data = await query(`SELECT id, nis, nama_lengkap, asrama, angkatan, catatan, tanggal_arsip FROM santri_arsip WHERE id IN (${ph}) ORDER BY angkatan DESC, nama_lengkap`, arsipIds)
    return { data }
  }
  const data = await query('SELECT id, nis, nama_lengkap, asrama, angkatan, catatan, tanggal_arsip FROM santri_arsip ORDER BY angkatan DESC, nama_lengkap')
  return { data }
}

export async function hapusArsipPermanen(arsipId: string) {
  await query('DELETE FROM santri_arsip WHERE id = ?', [arsipId])
  revalidatePath('/dashboard/santri/arsip')
  return { success: true }
}

export async function hapusArsipMassal(arsipIds: string[]) {
  if (!arsipIds || arsipIds.length === 0) return { error: 'Pilih minimal 1 data' }
  const ph = arsipIds.map(() => '?').join(',')
  await query(`DELETE FROM santri_arsip WHERE id IN (${ph})`, arsipIds)
  revalidatePath('/dashboard/santri/arsip')
  return { success: true, count: arsipIds.length }
}