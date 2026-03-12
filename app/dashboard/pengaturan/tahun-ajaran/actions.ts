'use server'

import { query, queryOne, execute } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getTahunAjaranList() {
  return await query<any>(`
    SELECT 
      t.*,
      (SELECT COUNT(*) FROM kelas WHERE tahun_ajaran_id = t.id) as jumlah_kelas,
      (SELECT COUNT(DISTINCT rp.santri_id) FROM riwayat_pendidikan rp
       JOIN kelas k ON rp.kelas_id = k.id
       WHERE k.tahun_ajaran_id = t.id AND rp.status_riwayat = 'aktif') as jumlah_santri
    FROM tahun_ajaran t
    ORDER BY t.id DESC
  `)
}

export async function getTahunAjaranAktif() {
  return await queryOne<any>('SELECT * FROM tahun_ajaran WHERE is_active = 1 LIMIT 1')
}

export async function tambahTahunAjaran(nama: string) {
  nama = nama.trim()
  if (!nama) return { error: 'Nama tahun ajaran tidak boleh kosong.' }

  const existing = await queryOne('SELECT id FROM tahun_ajaran WHERE nama = ?', [nama])
  if (existing) return { error: `Tahun ajaran "${nama}" sudah ada.` }

  await execute(
    'INSERT INTO tahun_ajaran (nama, is_active) VALUES (?, 0)',
    [nama]
  )

  revalidatePath('/dashboard/pengaturan/tahun-ajaran')
  revalidatePath('/dashboard/master/kelas')
  return { success: true }
}

export async function aktifkanTahunAjaran(id: number): Promise<{ success: boolean } | { error: string }> {
  // Nonaktifkan semua dulu
  await execute('UPDATE tahun_ajaran SET is_active = 0', [])
  // Aktifkan yang dipilih
  await execute('UPDATE tahun_ajaran SET is_active = 1 WHERE id = ?', [id])

  revalidatePath('/dashboard/pengaturan/tahun-ajaran')
  revalidatePath('/dashboard/master/kelas')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function hapusTahunAjaran(id: number): Promise<{ success: boolean } | { error: string }> {
  // Cek apakah aktif
  const ta = await queryOne<any>('SELECT * FROM tahun_ajaran WHERE id = ?', [id])
  if (!ta) return { error: 'Tahun ajaran tidak ditemukan.' }
  if (ta.is_active) return { error: 'Tidak bisa menghapus tahun ajaran yang sedang aktif.' }

  // Cek apakah ada kelas terkait
  const kelasCount = await queryOne<{ c: number }>(
    'SELECT COUNT(*) as c FROM kelas WHERE tahun_ajaran_id = ?', [id]
  )
  if ((kelasCount?.c ?? 0) > 0) return { error: `Tidak bisa dihapus: masih ada ${kelasCount?.c} kelas terkait tahun ajaran ini.` }

  await execute('DELETE FROM tahun_ajaran WHERE id = ?', [id])

  revalidatePath('/dashboard/pengaturan/tahun-ajaran')
  return { success: true }
}
