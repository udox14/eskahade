'use server'

import { query, queryOne } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { revalidatePath } from 'next/cache'

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

  const guru = await query('SELECT id, nama_lengkap, gelar FROM data_guru ORDER BY nama_lengkap')

  const sortedKelas = kelas.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )

  return { kelasList: sortedKelas, guruList: guru }
}

export async function tambahGuruManual(nama: string, gelar: string, kode: string): Promise<{ success: boolean } | { error: string }> {
  await query(
    'INSERT INTO data_guru (nama_lengkap, gelar, kode_guru) VALUES (?, ?, ?)',
    [nama, gelar, kode || null]
  )
  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true }
}

export async function hapusGuru(id: string): Promise<{ success: boolean } | { error: string }> {
  try {
    await query('DELETE FROM data_guru WHERE id = ?', [id])
    revalidatePath('/dashboard/master/wali-kelas')
    return { success: true }
  } catch {
    return { error: 'Gagal menghapus (Mungkin sedang dipakai di jadwal?)' }
  }
}

export async function hapusGuruBatch(ids: string[]): Promise<{ success: boolean; count: number } | { error: string }> {
  if (!ids || ids.length === 0) return { error: 'Pilih minimal 1 guru' }
  try {
    const placeholders = ids.map(() => '?').join(',')
    await query(`DELETE FROM data_guru WHERE id IN (${placeholders})`, ids)
    revalidatePath('/dashboard/master/wali-kelas')
    return { success: true, count: ids.length }
  } catch {
    return { error: 'Gagal menghapus (Mungkin sedang dipakai di jadwal?)' }
  }
}

export async function importDataGuru(dataExcel: any[]): Promise<{ success: boolean; count: number; skipped: number; allDuplicate?: boolean } | { error: string }> {
  if (!dataExcel || dataExcel.length === 0) return { error: 'Data kosong' }

  const parsed = dataExcel.map(row => ({
    nama_lengkap: String(row['NAMA LENGKAP'] || row['nama'] || row['Nama'] || '').trim(),
    gelar: row['GELAR'] || row['gelar'] || '',
    kode_guru: row['KODE'] || row['kode'] || null
  })).filter(d => d.nama_lengkap)

  if (parsed.length === 0) return { error: 'Tidak ada data guru valid' }

  const existing = await query<{ nama_lengkap: string }>('SELECT nama_lengkap FROM data_guru')
  const existingNames = new Set(existing.map(g => g.nama_lengkap.toLowerCase().trim()))

  const newOnly = parsed.filter(d => !existingNames.has(d.nama_lengkap.toLowerCase()))
  const skippedCount = parsed.length - newOnly.length

  if (newOnly.length === 0) {
    return { success: true, count: 0, skipped: skippedCount, allDuplicate: true }
  }

  for (const g of newOnly) {
    await query(
      'INSERT INTO data_guru (nama_lengkap, gelar, kode_guru) VALUES (?, ?, ?)',
      [g.nama_lengkap, g.gelar, g.kode_guru]
    )
  }

  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: newOnly.length, skipped: skippedCount }
}

export async function simpanJadwalBatch(listJadwal: any[]) {
  let successCount = 0

  for (const item of listJadwal) {
    const { kelasId, shubuhId, asharId, maghribId } = item

    try {
      // A. Update jadwal guru di kelas
      await query(
        'UPDATE kelas SET guru_shubuh_id = ?, guru_ashar_id = ?, guru_maghrib_id = ? WHERE id = ?',
        [shubuhId || null, asharId || null, maghribId || null, kelasId]
      )

      // B. Auto wali kelas dari guru maghrib
      if (maghribId) {
        const guruData = await queryOne<{ nama_lengkap: string }>(
          'SELECT nama_lengkap FROM data_guru WHERE id = ?',
          [maghribId]
        )

        if (guruData) {
          const email = generateEmail(guruData.nama_lengkap)

          // Cek apakah user sudah ada
          let user = await queryOne<{ id: string }>(
            'SELECT id FROM users WHERE full_name = ? LIMIT 1',
            [guruData.nama_lengkap]
          )

          if (!user) {
            // Buat user baru dengan password default
            const passwordHash = await hashPassword('password123')
            const newId = crypto.randomUUID()
            const now = new Date().toISOString()

            await query(
              'INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [newId, email, passwordHash, guruData.nama_lengkap, 'wali_kelas', now, now]
            )
            user = { id: newId }
          }

          await query('UPDATE kelas SET wali_kelas_id = ? WHERE id = ?', [user.id, kelasId])
        }
      } else {
        await query('UPDATE kelas SET wali_kelas_id = NULL WHERE id = ?', [kelasId])
      }

      successCount++
    } catch (err) {
      console.error('Error simpanJadwal untuk kelas', kelasId, err)
    }
  }

  revalidatePath('/dashboard/master/wali-kelas')
  return { success: true, count: successCount }
}