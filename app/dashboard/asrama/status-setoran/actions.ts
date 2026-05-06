'use server'

import { query } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { getSppScope, SADESA_UNIT } from '@/lib/spp/unit-setor'

export async function getStatusSetoranSaya(tahun: number) {
  const session = await getSession()
  const scope = getSppScope(session)

  if (!scope || scope.kind === 'ADMIN') {
    return { error: 'Halaman ini hanya untuk pengurus asrama atau dewan santri.' }
  }

  const unitSetor = scope.kind === 'SADESA' ? SADESA_UNIT : scope.defaultUnit
  const data = await query<any>(`
    SELECT ss.bulan, ss.tanggal_terima, u.full_name AS penerima_nama
    FROM spp_setoran ss
    LEFT JOIN users u ON u.id = ss.penerima_id
    WHERE COALESCE(NULLIF(TRIM(ss.unit_setor), ''), ss.asrama) = ? AND ss.tahun = ?
    ORDER BY ss.bulan
  `, [unitSetor, tahun])

  const statusBulan: Record<number, any> = {}
  data.forEach((d: any) => {
    statusBulan[d.bulan] = {
      lunas: true,
      tanggal: d.tanggal_terima,
      penerima: d.penerima_nama || 'Sistem',
    }
  })

  return {
    unitSetor,
    displayName: scope.kind === 'SADESA' ? 'SADESA' : `Asrama ${unitSetor}`,
    isSadesa: scope.kind === 'SADESA',
    data: statusBulan,
  }
}
