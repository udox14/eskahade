'use server'

import { query, execute } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getDaftarTarif() {
  const data = await query<any>(
    'SELECT * FROM biaya_settings ORDER BY tahun_angkatan DESC', []
  )
  if (!data.length) return []

  const grouped: Record<number, any> = {}
  data.forEach((item: any) => {
    if (!grouped[item.tahun_angkatan]) grouped[item.tahun_angkatan] = { tahun: item.tahun_angkatan }
    grouped[item.tahun_angkatan][item.jenis_biaya] = item.nominal
  })

  return Object.values(grouped).sort((a: any, b: any) => b.tahun - a.tahun)
}

export async function getTarifByTahun(tahun: number) {
  const data = await query<any>(
    'SELECT jenis_biaya, nominal FROM biaya_settings WHERE tahun_angkatan = ?', [tahun]
  )
  const result: any = { BANGUNAN: 0, KESEHATAN: 0, EHB: 0, EKSKUL: 0 }
  data.forEach((d: any) => { result[d.jenis_biaya] = d.nominal })
  return result
}

export async function simpanTarif(tahun: number, tarifData: any) {
  const items = [
    { jenis: 'BANGUNAN', nominal: tarifData.BANGUNAN },
    { jenis: 'KESEHATAN', nominal: tarifData.KESEHATAN },
    { jenis: 'EHB', nominal: tarifData.EHB },
    { jenis: 'EKSKUL', nominal: tarifData.EKSKUL },
  ]

  for (const item of items) {
    await execute(`
      INSERT INTO biaya_settings (tahun_angkatan, jenis_biaya, nominal)
      VALUES (?, ?, ?)
      ON CONFLICT(tahun_angkatan, jenis_biaya) DO UPDATE SET nominal = excluded.nominal
    `, [tahun, item.jenis, item.nominal])
  }

  revalidatePath('/dashboard/keuangan/tarif')
  return { success: true }
}