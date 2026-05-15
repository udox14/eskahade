'use server'

import { query } from '@/lib/db'
import { formatDistance } from 'date-fns'
import { id } from 'date-fns/locale'

export async function getSantriTelatPerpulangan(tanggalRef: string) {
  const rows = await query<any>(`
    SELECT pl.id, pl.santri_id, pl.keterangan,
           pp.nama_periode, pp.tgl_selesai_datang,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM perpulangan_log pl
    JOIN perpulangan_periode pp ON pp.id = pl.periode_id
    JOIN santri s ON s.id = pl.santri_id
    WHERE pl.status_datang = 'TELAT'
      AND pp.tgl_selesai_datang <= ?
      AND UPPER(TRIM(COALESCE(s.asrama, ''))) != 'AL-BAGHORY'
    ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
  `, [tanggalRef])

  if (!rows.length) return null

  const list = rows.map((item: any) => {
    const batas = new Date(`${item.tgl_selesai_datang}T23:59:59+07:00`)
    return {
      nama: item.nama_lengkap,
      nis: item.nis,
      asrama: item.asrama || 'NON-ASRAMA',
      kamar: item.kamar || '-',
      jenis: 'PERPULANGAN',
      periode: item.nama_periode,
      rencana_kembali: item.tgl_selesai_datang,
      durasi_telat: formatDistance(batas, new Date(), { locale: id, addSuffix: false }),
    }
  })

  return list.reduce((groups: Record<string, any[]>, item: any) => {
    if (!groups[item.asrama]) groups[item.asrama] = []
    groups[item.asrama].push(item)
    return groups
  }, {})
}
