'use server'

import { query, queryOne, execute, batch } from '@/lib/db'
import { assertCrud } from '@/lib/auth/crud'
import { revalidatePath } from 'next/cache'

const PAGE_SIZE = 30

export type FilterSantri = {
  search?: string
  asrama?: string
  sekolah?: string
  kelas_sekolah?: string
  kelas_pesantren?: string
  tahun_masuk?: number
  page?: number
}

export async function getSantriAktifUntukArsip(filter: FilterSantri = {}) {
  const { search, asrama, sekolah, kelas_sekolah, kelas_pesantren, tahun_masuk, page = 1 } = filter
  const offset = (page - 1) * PAGE_SIZE

  const clauses = ["s.status_global = 'aktif'"]
  const params: any[] = []

  if (search)         { clauses.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
  if (asrama)         { clauses.push('s.asrama = ?');                            params.push(asrama) }
  if (sekolah)        { clauses.push('s.sekolah = ?');                           params.push(sekolah) }
  if (kelas_sekolah)  { clauses.push('s.kelas_sekolah LIKE ?');                 params.push(`%${kelas_sekolah}%`) }
  if (kelas_pesantren){ clauses.push('LOWER(k.nama_kelas) = LOWER(?)');         params.push(kelas_pesantren) }
  if (tahun_masuk)    { clauses.push('s.tahun_masuk = ?');                       params.push(tahun_masuk) }

  const needKelas = !!kelas_pesantren
  const joinKelas = needKelas
    ? `LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON rp.kelas_id = k.id`
    : `LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
       LEFT JOIN kelas k ON rp.kelas_id = k.id`

  const where = clauses.join(' AND ')

  // Count dulu — 1 query ringan
  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri s
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON rp.kelas_id = k.id
     WHERE ${where}`,
    params
  )
  const total = countRow?.total ?? 0

  // Data dengan LIMIT/OFFSET langsung di SQL — tidak fetch semua lalu slice
  const data = await query<any>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar,
            s.sekolah, s.kelas_sekolah, s.tahun_masuk,
            k.nama_kelas AS kelas_pesantren_nama
     FROM santri s
     LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
     LEFT JOIN kelas k ON rp.kelas_id = k.id
     WHERE ${where}
     ORDER BY s.nama_lengkap
     LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, offset]
  )

  return { data, total, page, hasMore: offset + PAGE_SIZE < total }
}

export async function getFilterOptionsSantri() {
  const [asramaRows, sekolahRows, kelasRows, tahunRows] = await Promise.all([
    query<{ asrama: string }>(`SELECT DISTINCT asrama FROM santri WHERE status_global = 'aktif' AND asrama IS NOT NULL ORDER BY asrama`),
    query<{ sekolah: string }>(`SELECT DISTINCT sekolah FROM santri WHERE status_global = 'aktif' AND sekolah IS NOT NULL ORDER BY sekolah`),
    query<{ nama_kelas: string }>('SELECT DISTINCT nama_kelas FROM kelas ORDER BY nama_kelas'),
    query<{ tahun_masuk: number }>(`SELECT DISTINCT tahun_masuk FROM santri WHERE status_global = 'aktif' AND tahun_masuk IS NOT NULL ORDER BY tahun_masuk DESC`),
  ])

  return {
    asramaList:  asramaRows.map(r => r.asrama),
    sekolahList: sekolahRows.map(r => r.sekolah),
    kelasList:   kelasRows.map(r => r.nama_kelas).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
    tahunList:   tahunRows.map(r => r.tahun_masuk),
  }
}

export async function getGrupArsip() {
  // Aggregate langsung di SQL — tidak fetch semua baris lalu group di memory
  const rows = await query<{
    angkatan: number | null
    catatan: string | null
    tanggal_arsip: string
    jumlah: number
    asrama_list: string
  }>(`
    SELECT
      angkatan,
      catatan,
      DATE(tanggal_arsip) AS tanggal_arsip,
      COUNT(*) AS jumlah,
      GROUP_CONCAT(DISTINCT asrama) AS asrama_list
    FROM santri_arsip
    GROUP BY angkatan, catatan, DATE(tanggal_arsip)
    ORDER BY tanggal_arsip DESC
  `)

  return rows.map(r => ({
    key:          `${r.angkatan ?? 'null'}__${r.catatan ?? ''}__${r.tanggal_arsip}`,
    angkatan:     r.angkatan,
    catatan:      r.catatan,
    tanggal_arsip: r.tanggal_arsip,
    jumlah:       r.jumlah,
    asramaList:   r.asrama_list ? r.asrama_list.split(',').filter(Boolean) : [],
  }))
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

  const clauses = ['DATE(tanggal_arsip) = ?']
  const params: any[] = [tanggalArsip]

  if (angkatan !== null) { clauses.push('angkatan = ?');  params.push(angkatan) }
  else                     clauses.push('angkatan IS NULL')

  if (catatan) { clauses.push('catatan = ?');  params.push(catatan) }
  else           clauses.push('catatan IS NULL')

  if (search) { clauses.push('(nama_lengkap LIKE ? OR nis LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
  if (asrama) { clauses.push('asrama = ?'); params.push(asrama) }

  const where = clauses.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM santri_arsip WHERE ${where}`, params
  )
  const total = countRow?.total ?? 0

  const data = await query<any>(
    `SELECT id, nis, nama_lengkap, asrama, tanggal_arsip, catatan, angkatan
     FROM santri_arsip WHERE ${where}
     ORDER BY nama_lengkap LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, offset]
  )

  return { data, total, page, hasMore: offset + PAGE_SIZE < total }
}

export async function arsipkanSantri(santriIds: string[], catatan: string): Promise<{ success: boolean; berhasil: number; gagal: number; errors: string[] } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'delete')
  if ('error' in access) return access
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

      await execute(
        `INSERT INTO santri_arsip (id, santri_id_asli, nis, nama_lengkap, angkatan, asrama, catatan, snapshot, tanggal_arsip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), santriId, profil.nis, profil.nama_lengkap, isNaN(angkatan as number) ? null : angkatan, profil.asrama, catatan || null, snapshot, now]
      )

      // Hapus semua data relasi dalam 1 batch
      const deleteOps: { sql: string; params: any[] }[] = []
      if (riwayatIds.length > 0) {
        const ph = riwayatIds.map(() => '?').join(',')
        deleteOps.push({ sql: `DELETE FROM nilai_akademik WHERE riwayat_pendidikan_id IN (${ph})`, params: riwayatIds })
        deleteOps.push({ sql: `DELETE FROM absensi_harian WHERE riwayat_pendidikan_id IN (${ph})`, params: riwayatIds })
        deleteOps.push({ sql: 'DELETE FROM riwayat_pendidikan WHERE santri_id = ?', params: [santriId] })
      }
      deleteOps.push({ sql: 'DELETE FROM pelanggaran WHERE santri_id = ?', params: [santriId] })
      deleteOps.push({ sql: 'DELETE FROM spp_log WHERE santri_id = ?', params: [santriId] })
      deleteOps.push({ sql: 'DELETE FROM tabungan_log WHERE santri_id = ?', params: [santriId] })
      deleteOps.push({ sql: 'DELETE FROM santri WHERE id = ?', params: [santriId] })
      await batch(deleteOps)

      berhasil++
    } catch (err: any) {
      gagal++; errorList.push(`ID ${santriId}: ${err.message}`)
    }
  }

  revalidatePath('/dashboard/santri/arsip')
  revalidatePath('/dashboard/santri')
  return { success: true, berhasil, gagal, errors: errorList }
}

export async function restoreSantri(arsipIds: string[]): Promise<{ success: boolean; berhasil: number; gagal: number; errors: string[] } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'create')
  if ('error' in access) return access
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

export async function getArsipForDownload(arsipIds?: string[]): Promise<{ data: any[] } | { error: string }> {
  if (arsipIds && arsipIds.length > 0) {
    const ph = arsipIds.map(() => '?').join(',')
    const data = await query(`SELECT id, nis, nama_lengkap, asrama, angkatan, catatan, tanggal_arsip FROM santri_arsip WHERE id IN (${ph}) ORDER BY angkatan DESC, nama_lengkap`, arsipIds)
    return { data }
  }
  const data = await query('SELECT id, nis, nama_lengkap, asrama, angkatan, catatan, tanggal_arsip FROM santri_arsip ORDER BY angkatan DESC, nama_lengkap')
  return { data }
}

export async function hapusArsipPermanen(arsipId: string): Promise<{ success: boolean } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'delete')
  if ('error' in access) return access
  await query('DELETE FROM santri_arsip WHERE id = ?', [arsipId])
  revalidatePath('/dashboard/santri/arsip')
  return { success: true }
}

export async function hapusArsipMassal(arsipIds: string[]): Promise<{ success: boolean; count: number } | { error: string }> {
  const access = await assertCrud('/dashboard/santri', 'delete')
  if ('error' in access) return access
  if (!arsipIds || arsipIds.length === 0) return { error: 'Pilih minimal 1 data' }
  const ph = arsipIds.map(() => '?').join(',')
  await query(`DELETE FROM santri_arsip WHERE id IN (${ph})`, arsipIds)
  revalidatePath('/dashboard/santri/arsip')
  return { success: true, count: arsipIds.length }
}
