'use server'

import { query, execute } from '@/lib/db'
import { getCachedBiayaSettings } from '@/lib/cache/master'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function getDaftarTarif() {
  const data = await getCachedBiayaSettings()
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

export async function simpanTarif(tahun: number, tarifData: any): Promise<{ success: boolean } | { error: string }> {
  const tahunAngkatan = Number(tahun)
  if (!Number.isInteger(tahunAngkatan) || tahunAngkatan <= 0) {
    return { error: 'Tahun angkatan tidak valid.' }
  }

  const items = [
    { jenis: 'BANGUNAN', nominal: Number(tarifData.BANGUNAN) || 0 },
    { jenis: 'KESEHATAN', nominal: Number(tarifData.KESEHATAN) || 0 },
    { jenis: 'EHB', nominal: Number(tarifData.EHB) || 0 },
    { jenis: 'EKSKUL', nominal: Number(tarifData.EKSKUL) || 0 },
  ]

  try {
    for (const item of items) {
      await execute(`
        INSERT INTO biaya_settings (tahun_angkatan, jenis_biaya, nominal)
        VALUES (?, ?, ?)
        ON CONFLICT(tahun_angkatan, jenis_biaya) DO UPDATE SET nominal = excluded.nominal
      `, [tahunAngkatan, item.jenis, item.nominal])
    }

    revalidateTag('biaya-settings')
    revalidatePath('/dashboard/keuangan/tarif')
    return { success: true }
  } catch (error) {
    console.error('Gagal menyimpan tarif:', error)
    return { error: 'Tarif gagal disimpan.' }
  }
}
