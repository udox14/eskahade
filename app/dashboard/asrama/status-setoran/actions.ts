'use server'

import { query } from '@/lib/db'
import { getSession } from '@/lib/auth/session'

export async function getStatusSetoranSaya(tahun: number) {
  const session = await getSession()

  if (session?.role !== 'pengurus_asrama' || !session.asrama_binaan) {
    return { error: 'Anda tidak memiliki akses asrama binaan.' }
  }

  const asrama = session.asrama_binaan

  const data = await query<any>(`
    SELECT ss.bulan, ss.tanggal_terima, u.full_name AS penerima_nama
    FROM spp_setoran ss
    LEFT JOIN users u ON u.id = ss.penerima_id
    WHERE ss.asrama = ? AND ss.tahun = ?
    ORDER BY ss.bulan
  `, [asrama, tahun])

  const statusBulan: Record<number, any> = {}
  data.forEach((d: any) => {
    statusBulan[d.bulan] = {
      lunas: true,
      tanggal: d.tanggal_terima,
      penerima: d.penerima_nama || 'Sistem',
    }
  })

  return { asrama, data: statusBulan }
}