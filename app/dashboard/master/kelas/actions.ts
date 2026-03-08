'use server'

import { query, queryOne } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getMarhalahList() {
  return await query('SELECT * FROM marhalah ORDER BY urutan')
}

export async function getKelasList() {
  const data = await query<any>(`
    SELECT k.*, m.nama as marhalah_nama
    FROM kelas k
    LEFT JOIN marhalah m ON k.marhalah_id = m.id
  `)
  return data.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export async function tambahKelas(formData: FormData) {
  const namaKelas = formData.get('nama_kelas') as string
  const marhalahId = formData.get('marhalah_id') as string
  const jenisKelamin = formData.get('jenis_kelamin') as string

  const tahunAktif = await queryOne<{ id: string }>(
    'SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  )
  if (!tahunAktif) return { error: 'Tidak ada tahun ajaran aktif.' }

  const exist = await queryOne(
    'SELECT id FROM kelas WHERE nama_kelas = ? AND marhalah_id = ? AND tahun_ajaran_id = ?',
    [namaKelas, marhalahId, tahunAktif.id]
  )
  if (exist) return { error: 'Kelas dengan nama ini sudah ada di marhalah tersebut.' }

  await query(
    'INSERT INTO kelas (id, nama_kelas, marhalah_id, jenis_kelamin, tahun_ajaran_id) VALUES (?, ?, ?, ?, ?)',
    [crypto.randomUUID(), namaKelas, marhalahId, jenisKelamin, tahunAktif.id]
  )

  revalidatePath('/dashboard/master/kelas')
  return { success: true }
}

export async function hapusKelas(kelasId: string) {
  const rows = await query<{ count: number }>(
    'SELECT COUNT(*) as count FROM riwayat_pendidikan WHERE kelas_id = ? AND status_riwayat = ?',
    [kelasId, 'aktif']
  )
  const count = rows[0]?.count ?? 0
  if (count > 0) return { error: 'Gagal hapus: Masih ada santri aktif di kelas ini. Kosongkan dulu.' }

  await query('DELETE FROM kelas WHERE id = ?', [kelasId])

  revalidatePath('/dashboard/master/kelas')
  return { success: true }
}

export async function importKelasMassal(dataExcel: any[]) {
  const tahunAktif = await queryOne<{ id: string }>(
    'SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1'
  )
  if (!tahunAktif) return { error: 'Tidak ada tahun ajaran aktif.' }

  const marhalahList = await query<{ id: string; nama: string }>('SELECT id, nama FROM marhalah')
  const mapMarhalah = new Map(marhalahList.map(m => [m.nama.toLowerCase().trim(), m.id]))

  const existingClasses = await query<{ nama_kelas: string; marhalah_id: string }>(
    'SELECT nama_kelas, marhalah_id FROM kelas WHERE tahun_ajaran_id = ?',
    [tahunAktif.id]
  )
  const existingSet = new Set(existingClasses.map(c => `${c.nama_kelas.toLowerCase().trim()}-${c.marhalah_id}`))

  const inserts: any[] = []
  const errors: string[] = []
  let duplicates = 0

  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    const rowNum = i + 2
    const namaKelas = String(row['NAMA KELAS'] || row['nama kelas'] || '').trim()
    const namaMarhalah = String(row['MARHALAH'] || row['marhalah'] || '').trim()
    const jkRaw = String(row['JENIS KELAMIN'] || row['jenis kelamin'] || 'L').toUpperCase().trim()

    if (!namaKelas || !namaMarhalah) continue

    const marhalahId = mapMarhalah.get(namaMarhalah.toLowerCase())
    if (!marhalahId) {
      errors.push(`Baris ${rowNum}: Marhalah '${namaMarhalah}' tidak ditemukan di sistem.`)
      continue
    }

    const keyCheck = `${namaKelas.toLowerCase()}-${marhalahId}`
    if (existingSet.has(keyCheck)) { duplicates++; continue }

    let jk = 'L'
    if (jkRaw === 'P' || jkRaw === 'PUTRI' || jkRaw === 'PEREMPUAN') jk = 'P'
    else if (jkRaw === 'C' || jkRaw === 'CAMPURAN') jk = 'C'

    inserts.push([crypto.randomUUID(), namaKelas, marhalahId, jk, tahunAktif.id])
    existingSet.add(keyCheck)
  }

  if (errors.length > 0) return { error: `Gagal sebagian:\n${errors.slice(0, 5).join('\n')}` }
  if (inserts.length === 0) {
    if (duplicates > 0) return { error: `Semua data (${duplicates}) dilewati karena kelas sudah ada.` }
    return { error: 'Tidak ada data valid untuk disimpan.' }
  }

  for (const row of inserts) {
    await query(
      'INSERT INTO kelas (id, nama_kelas, marhalah_id, jenis_kelamin, tahun_ajaran_id) VALUES (?, ?, ?, ?, ?)',
      row
    )
  }

  revalidatePath('/dashboard/master/kelas')
  return { success: true, count: inserts.length, skipped: duplicates }
}