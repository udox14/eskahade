'use server'

import { query, queryOne, batch, execute } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getCachedDataGuru } from '@/lib/cache/master'
import { syncWaliKelasFromGuruMaghrib } from '@/lib/akademik/wali-kelas-sync'

function generateEmail(name: string) {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${cleanName}@sukahideng.or.id`
}

type KelasMasterRow = {
  id: string
  nama_kelas: string
  marhalah_nama: string | null
  guru_shubuh_id: number | null
  guru_shubuh_nama: string | null
  guru_ashar_id: number | null
  guru_ashar_nama: string | null
  guru_maghrib_id: number | null
  guru_maghrib_nama: string | null
  wali_kelas_nama: string | null
}

type ImportGuruRow = Record<string, unknown>

async function ensureKelasCetakColumns() {
  try {
    await execute('ALTER TABLE kelas ADD COLUMN tempat TEXT')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
      throw error
    }
  }

  try {
    await execute('ALTER TABLE kelas ADD COLUMN grade TEXT')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
      throw error
    }
  }

  try {
    await execute('ALTER TABLE kelas ADD COLUMN baru_lama TEXT')
  } catch (error: any) {
    if (!String(error?.message || '').toLowerCase().includes('duplicate column name')) {
      throw error
    }
  }
}

function getJenjangDominan(row: {
  jumlah_sltp: number
  jumlah_slta: number
  jumlah_kuliah: number
  jumlah_tidak_sekolah: number
}) {
  const options = [
    { label: 'SLTP', value: Number(row.jumlah_sltp || 0) },
    { label: 'SLTA', value: Number(row.jumlah_slta || 0) },
    { label: 'KULIAH', value: Number(row.jumlah_kuliah || 0) },
    { label: 'TIDAK SEKOLAH', value: Number(row.jumlah_tidak_sekolah || 0) },
  ].sort((a, b) => b.value - a.value)

  return options[0]?.value ? options[0].label : '-'
}

export async function getDataMaster() {
  await ensureKelasCetakColumns()
  await syncWaliKelasFromGuruMaghrib()

  const kelas = await query<KelasMasterRow>(`
    SELECT
      k.id, k.nama_kelas,
      m.nama as marhalah_nama,
      gs.id as guru_shubuh_id, gs.nama_lengkap as guru_shubuh_nama,
      ga.id as guru_ashar_id, ga.nama_lengkap as guru_ashar_nama,
      gm.id as guru_maghrib_id, gm.nama_lengkap as guru_maghrib_nama,
      u.full_name as wali_kelas_nama
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN data_guru gs ON k.guru_shubuh_id = gs.id
    LEFT JOIN data_guru ga ON k.guru_ashar_id = ga.id
    LEFT JOIN data_guru gm ON k.guru_maghrib_id = gm.id
    LEFT JOIN users u ON k.wali_kelas_id = u.id
  `)

  const guru = await getCachedDataGuru()

  const sortedKelas = kelas.sort((a, b) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )

  return { kelasList: sortedKelas, guruList: guru }
}

export type PembagianTugasMengajarRow = {
  id: string
  nama_kelas: string
  marhalah_nama: string | null
  tahun_ajaran_nama: string
  tempat: string | null
  grade: string | null
  baru_lama: string | null
  jenis_kelamin: string
  guru_shubuh_nama: string | null
  guru_ashar_nama: string | null
  guru_maghrib_nama: string | null
  total_putra: number
  total_putri: number
  total_santri: number
  jumlah_sltp: number
  jumlah_slta: number
  jumlah_kuliah: number
  jumlah_tidak_sekolah: number
  tingkat_label: string
  lp_label: string
  bl_label: string
}

export async function getPembagianTugasMengajarData() {
  await ensureKelasCetakColumns()
  const rows = await query<Omit<PembagianTugasMengajarRow, 'tingkat_label' | 'lp_label' | 'bl_label'>>(`
    SELECT
      k.id,
      k.nama_kelas,
      m.nama as marhalah_nama,
      ta.nama as tahun_ajaran_nama,
      k.tempat,
      k.grade,
      k.baru_lama,
      k.jenis_kelamin,
      gs.nama_lengkap as guru_shubuh_nama,
      ga.nama_lengkap as guru_ashar_nama,
      gm.nama_lengkap as guru_maghrib_nama,
      SUM(CASE WHEN s.status_global = 'aktif' AND s.jenis_kelamin = 'L' THEN 1 ELSE 0 END) as total_putra,
      SUM(CASE WHEN s.status_global = 'aktif' AND s.jenis_kelamin = 'P' THEN 1 ELSE 0 END) as total_putri,
      SUM(CASE WHEN s.status_global = 'aktif' THEN 1 ELSE 0 END) as total_santri,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND (s.kategori_santri = 'SADESA'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%MTS%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%SMP%')
        THEN 1 ELSE 0 END) as jumlah_sltp,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND (UPPER(COALESCE(s.sekolah, '')) LIKE '%MA%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%SMA%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%SMK%')
        THEN 1 ELSE 0 END) as jumlah_slta,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND (UPPER(COALESCE(s.sekolah, '')) LIKE '%KULIAH%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%UNIVERSITAS%'
           OR UPPER(COALESCE(s.sekolah, '')) LIKE '%ST%')
        THEN 1 ELSE 0 END) as jumlah_kuliah,
      SUM(CASE
        WHEN s.status_global = 'aktif'
         AND COALESCE(TRIM(s.sekolah), '') = ''
        THEN 1 ELSE 0 END) as jumlah_tidak_sekolah
    FROM kelas k
    JOIN tahun_ajaran ta ON ta.id = k.tahun_ajaran_id AND ta.is_active = 1
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN data_guru gs ON k.guru_shubuh_id = gs.id
    LEFT JOIN data_guru ga ON k.guru_ashar_id = ga.id
    LEFT JOIN data_guru gm ON k.guru_maghrib_id = gm.id
    LEFT JOIN riwayat_pendidikan rp ON rp.kelas_id = k.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN santri s ON s.id = rp.santri_id
    GROUP BY
      k.id, k.nama_kelas, m.nama, ta.nama, k.tempat, k.grade, k.baru_lama, k.jenis_kelamin,
      gs.nama_lengkap, ga.nama_lengkap, gm.nama_lengkap
  `)

  return rows
    .map((row) => ({
      ...row,
      tingkat_label: getJenjangDominan(row),
      lp_label: row.jenis_kelamin === 'L' ? 'Pa' : row.jenis_kelamin === 'P' ? 'Pi' : 'C',
      bl_label: row.baru_lama || '-',
    }))
    .sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' }))
}

export async function tambahGuruManual(nama: string, gelar: string, kode: string): Promise<{ success: boolean } | { error: string }> {
  await query(
    'INSERT INTO data_guru (nama_lengkap, gelar, kode_guru) VALUES (?, ?, ?)',
    [nama, gelar, kode]
  )
  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function hapusGuru(id: number): Promise<{ success: boolean } | { error: string }> {
  const used = await queryOne<{ id: string }>(
    'SELECT id FROM kelas WHERE guru_shubuh_id = ? OR guru_ashar_id = ? OR guru_maghrib_id = ? LIMIT 1',
    [id, id, id]
  )
  if (used) return { error: 'Guru ini masih terdaftar sebagai pengajar di salah satu kelas.' }

  await query('DELETE FROM data_guru WHERE id = ?', [id])
  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function hapusGuruMassal(ids: number[]): Promise<{ success: boolean; count: number } | { error: string }> {
  if (!ids.length) return { error: 'Tidak ada data.' }
  const placeholders = ids.map(() => '?').join(',')
  const usedCheck = await query<{ id: string }>(
    `SELECT id FROM kelas WHERE guru_shubuh_id IN (${placeholders}) OR guru_ashar_id IN (${placeholders}) OR guru_maghrib_id IN (${placeholders}) LIMIT 1`,
    [...ids, ...ids, ...ids]
  )
  if (usedCheck.length > 0) return { error: 'Beberapa guru masih terdaftar sebagai pengajar aktif di kelas.' }

  await query(`DELETE FROM data_guru WHERE id IN (${placeholders})`, ids)
  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: ids.length }
}

export async function importGuruMassal(dataExcel: ImportGuruRow[]): Promise<{ success: boolean; count: number; skipped: number } | { error: string }> {
  if (!dataExcel.length) return { error: 'Data kosong.' }

  const existing = await query<{ nama_lengkap: string }>('SELECT nama_lengkap FROM data_guru')
  const existingNames = new Set(existing.map(g => g.nama_lengkap.toLowerCase().trim()))

  const toInsert: [string, string, string][] = []
  let skipped = 0

  for (const row of dataExcel) {
    const nama = String(row['NAMA'] || row['NAMA LENGKAP'] || row['nama'] || '').trim()
    const gelar = String(row['GELAR'] || row['gelar'] || '').trim()
    const kode = String(row['KODE'] || row['kode'] || '').trim()
    if (!nama) { skipped++; continue }
    if (existingNames.has(nama.toLowerCase())) { skipped++; continue }
    toInsert.push([nama, gelar, kode])
    existingNames.add(nama.toLowerCase())
  }

  if (!toInsert.length) return { error: `Semua data dilewati (${skipped} duplikat atau kosong).` }

  await batch(toInsert.map(row => ({
    sql: 'INSERT INTO data_guru (nama_lengkap, gelar, kode_guru) VALUES (?, ?, ?)',
    params: row,
  })))

  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: toInsert.length, skipped }
}

export async function simpanJadwalBatch(
  payload: { kelasId: string; shubuhId: number; asharId: number; maghribId: number }[]
): Promise<{ success: boolean; count: number } | { error: string }> {
  if (!payload.length) return { error: 'Tidak ada data.' }

  await batch(
    payload.map(p => ({
      sql: `UPDATE kelas SET guru_shubuh_id = ?, guru_ashar_id = ?, guru_maghrib_id = ? WHERE id = ?`,
      params: [
        p.shubuhId || null,
        p.asharId || null,
        p.maghribId || null,
        p.kelasId,
      ],
    }))
  )
  await syncWaliKelasFromGuruMaghrib(payload.map(p => p.kelasId))

  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: payload.length }
}

export async function setWaliKelas(kelasId: string, userId: string | null) {
  await query('UPDATE kelas SET wali_kelas_id = ? WHERE id = ?', [userId, kelasId])
  await syncWaliKelasFromGuruMaghrib([kelasId])
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function setGuruKelas(
  kelasId: string,
  guruShubuhId: string | null,
  guruAsharId: string | null,
  guruMaghribId: string | null
) {
  await query(
    'UPDATE kelas SET guru_shubuh_id = ?, guru_ashar_id = ?, guru_maghrib_id = ? WHERE id = ?',
    [guruShubuhId, guruAsharId, guruMaghribId, kelasId]
  )
  await syncWaliKelasFromGuruMaghrib([kelasId])
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function getUsersForWaliKelas() {
  return query<{ id: string; full_name: string | null }>(`
    SELECT id, full_name
    FROM users
    WHERE role IN ('wali_kelas', 'sekpen')
       OR EXISTS (
         SELECT 1
         FROM json_each(COALESCE(users.roles, '[]'))
         WHERE value IN ('wali_kelas', 'sekpen')
       )
    ORDER BY full_name
  `)
}

export async function buatAkunGuruOtomatis(guruId: number): Promise<{ success: boolean; email?: string } | { error: string }> {
  const guru = await queryOne<{ id: number; nama_lengkap: string }>('SELECT id, nama_lengkap FROM data_guru WHERE id = ?', [guruId])
  if (!guru) return { error: 'Data guru tidak ditemukan.' }

  const email = generateEmail(guru.nama_lengkap)
  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email])
  if (existing) return { error: `Akun dengan email ${email} sudah ada.` }

  const hashed = await hashPassword('sukahideng123')
  await query(
    "INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, 'wali_kelas')",
    [crypto.randomUUID(), email, hashed, guru.nama_lengkap]
  )

  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, email }
}
