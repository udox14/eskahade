'use server'

import { query, execute, generateId, now } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getMarhalahList() {
  return query<any>('SELECT id, nama FROM marhalah ORDER BY urutan', [])
}

export async function getKelasByMarhalah(marhalahId: string) {
  if (!marhalahId) return []
  const data = await query<any>(
    'SELECT id, nama_kelas FROM kelas WHERE marhalah_id = ?', [marhalahId]
  )
  return data.sort((a: any, b: any) =>
    a.nama_kelas.localeCompare(b.nama_kelas, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export async function getSantriForKenaikan(marhalahId: string, kelasId: string) {
  let kelasIds: string[] = []

  if (kelasId) {
    kelasIds = [kelasId]
  } else if (marhalahId) {
    const listKelas = await query<any>(
      'SELECT id FROM kelas WHERE marhalah_id = ?', [marhalahId]
    )
    kelasIds = listKelas.map((k: any) => k.id)
  }

  if (!kelasIds.length) return []

  const ph = kelasIds.map(() => '?').join(',')
  const listSantriRaw = await query<any>(`
    SELECT rp.id, rp.grade_lanjutan,
           s.id AS santri_id, s.nama_lengkap, s.nis,
           k.nama_kelas,
           r.rata_rata, r.predikat
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN ranking r ON r.riwayat_pendidikan_id = rp.id
    WHERE rp.kelas_id IN (${ph}) AND rp.status_riwayat = 'aktif'
    ORDER BY s.nama_lengkap
  `, kelasIds)

  return listSantriRaw.map((item: any) => ({
    riwayat_id: item.id,
    santri_id: item.santri_id,
    nis: item.nis,
    nama: item.nama_lengkap,
    kelas_sekarang: item.nama_kelas,
    grade_lanjutan: item.grade_lanjutan || 'Belum Di-Grading',
    rata_rata: item.rata_rata || 0,
    predikat: item.predikat || '-',
  }))
}

export async function importKenaikanKelas(dataExcel: any[]) {
  if (!dataExcel || !dataExcel.length) return { error: 'Data kosong.' }

  const allClasses = await query<any>('SELECT id, nama_kelas FROM kelas', [])
  const mapKelas = new Map<string, string>()
  allClasses.forEach((k: any) => mapKelas.set(k.nama_kelas.trim().toLowerCase(), k.id))

  const allActiveSantri = await query<any>(`
    SELECT rp.id, s.nis
    FROM riwayat_pendidikan rp
    JOIN santri s ON s.id = rp.santri_id
    WHERE rp.status_riwayat = 'aktif'
  `, [])

  const mapNisToRiwayat = new Map<string, string>()
  allActiveSantri.forEach((r: any) => {
    if (r.nis) mapNisToRiwayat.set(String(r.nis).trim(), r.id)
  })

  const errors: string[] = []
  for (let i = 0; i < dataExcel.length; i++) {
    const row = dataExcel[i]
    const nis = String(row['NIS'] || row['nis'] || '').trim()
    const targetKelasNama = String(row['TARGET KELAS'] || row['target kelas'] || '').trim()
    if (!targetKelasNama) continue

    if (!mapNisToRiwayat.get(nis)) errors.push(`Baris ${i + 2}: Santri NIS ${nis} tidak ditemukan.`)
    else if (!mapKelas.get(targetKelasNama.toLowerCase())) errors.push(`Baris ${i + 2}: Kelas '${targetKelasNama}' tidak ditemukan.`)
  }

  if (errors.length > 0) return { error: `Ditemukan masalah:\n${errors.slice(0, 5).join('\n')}` }

  const mapNisToFullData = new Map<string, { riwayat_id: string; santri_id: string }>()
  allActiveSantri.forEach((r: any) => {
    if (r.nis) mapNisToFullData.set(String(r.nis).trim(), { riwayat_id: r.id, santri_id: r.santri_id })
  })

  const recordsToUpdate: string[] = []
  const recordsToInsert: any[] = []

  for (const row of dataExcel) {
    const targetName = String(row['TARGET KELAS'] || row['target kelas'] || '').trim()
    if (!targetName) continue
    const nis = String(row['NIS'] || row['nis'] || '').trim()
    const santriData = mapNisToFullData.get(nis)
    const targetId = mapKelas.get(targetName.toLowerCase())

    if (santriData && targetId) {
      recordsToUpdate.push(santriData.riwayat_id)
      recordsToInsert.push({ santri_id: santriData.santri_id, kelas_id: targetId })
    }
  }

  if (!recordsToInsert.length) return { error: 'Tidak ada data valid untuk diproses.' }

  const phUpdate = recordsToUpdate.map(() => '?').join(',')
  await execute(
    `UPDATE riwayat_pendidikan SET status_riwayat = 'naik' WHERE id IN (${phUpdate})`,
    recordsToUpdate
  )

  for (const rec of recordsToInsert) {
    await execute(`
      INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat, created_at)
      VALUES (?, ?, ?, 'aktif', ?)
    `, [generateId(), rec.santri_id, rec.kelas_id, now()])
  }

  revalidatePath('/dashboard/akademik/kenaikan')
  return { success: true, count: recordsToInsert.length }
}