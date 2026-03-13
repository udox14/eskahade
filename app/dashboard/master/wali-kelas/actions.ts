'use server'

import { query, queryOne, batch } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getCachedDataGuru } from '@/lib/cache/master'

function generateEmail(name: string) {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${cleanName}@sukahideng.com`
}

export async function getDataMaster() {
  const kelas = await query<any>(`
    SELECT
      k.id, k.nama_kelas,
      m.nama as marhalah_nama,
      gs.id as guru_shubuh_id, gs.nama_lengkap as guru_shubuh_nama,
      ga.id as guru_ashar_id, ga.nama_lengkap as guru_ashar_nama,
      gm.id as guru_maghrib_id, gm.nama_lengkap as guru_maghrib_nama,
      u.full_name as wali_kelas_nama
    FROM kelas k
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
    LEFT JOIN data_guru gs ON k.guru_shubuh_id = gs.id
    LEFT JOIN data_guru ga ON k.guru_ashar_id = ga.id
    LEFT JOIN data_guru gm ON k.guru_maghrib_id = gm.id
    LEFT JOIN users u ON k.wali_kelas_id = u.id
  `)

  const guru = await getCachedDataGuru()

  const sortedKelas = kelas.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )

  return { kelasList: sortedKelas, guruList: guru }
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
  const used = await queryOne<any>(
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
  const usedCheck = await query<any>(
    `SELECT id FROM kelas WHERE guru_shubuh_id IN (${placeholders}) OR guru_ashar_id IN (${placeholders}) OR guru_maghrib_id IN (${placeholders}) LIMIT 1`,
    [...ids, ...ids, ...ids]
  )
  if (usedCheck.length > 0) return { error: 'Beberapa guru masih terdaftar sebagai pengajar aktif di kelas.' }

  await query(`DELETE FROM data_guru WHERE id IN (${placeholders})`, ids)
  revalidateTag('data-guru', 'everything')
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: ids.length }
}

export async function importGuruMassal(dataExcel: any[]): Promise<{ success: boolean; count: number; skipped: number } | { error: string }> {
  if (!dataExcel.length) return { error: 'Data kosong.' }

  const existing = await query<{ nama_lengkap: string }>('SELECT nama_lengkap FROM data_guru')
  const existingNames = new Set(existing.map((g: any) => g.nama_lengkap.toLowerCase().trim()))

  const toInsert: any[] = []
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

  for (const row of toInsert) {
    await query('INSERT INTO data_guru (nama_lengkap, gelar, kode_guru) VALUES (?, ?, ?)', row)
  }

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

  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: payload.length }
}

export async function setWaliKelas(kelasId: string, userId: string | null) {
  await query('UPDATE kelas SET wali_kelas_id = ? WHERE id = ?', [userId, kelasId])
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
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function getUsersForWaliKelas() {
  return query<any>("SELECT id, full_name FROM users WHERE role IN ('wali_kelas', 'sekpen') ORDER BY full_name")
}

export async function buatAkunGuruOtomatis(guruId: number): Promise<{ success: boolean; email?: string } | { error: string }> {
  const guru = await queryOne<any>('SELECT * FROM data_guru WHERE id = ?', [guruId])
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