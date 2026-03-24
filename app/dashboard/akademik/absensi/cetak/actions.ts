'use server'

import { query } from '@/lib/db'

function getWeekRange(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day < 3 ? day + 7 : day) - 3
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  const start = new Date(d)
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  return { start, end }
}

export async function getRekapAlfaMingguan(tanggalRef: string) {
  const { start, end } = getWeekRange(new Date(tanggalRef))
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  // Batasi ke minggu ini + data belum terverifikasi (verif = NULL atau 'BELUM')
  // Filter tanggal di SQL — tidak scan seluruh tabel
  const rawData = await query<any>(`
    SELECT ah.id, ah.tanggal,
           ah.shubuh, ah.ashar, ah.maghrib,
           ah.verif_shubuh, ah.verif_ashar, ah.verif_maghrib,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    WHERE ah.tanggal >= ? AND ah.tanggal <= ?
      AND (ah.shubuh = 'A' OR ah.ashar = 'A' OR ah.maghrib = 'A')
  `, [startStr, endStr])

  if (!rawData.length) return []

  const startDate = start
  const endDate = end
  const rekapMap = new Map<string, any>()

  rawData.forEach((row: any) => {
    const tglRow = new Date(row.tanggal)
    const isThisWeek = tglRow >= startDate && tglRow <= endDate

    const isHitungShubuh = row.shubuh === 'A' && (isThisWeek || row.verif_shubuh === 'BELUM') && row.verif_shubuh !== 'OK'
    const isHitungAshar  = row.ashar === 'A'  && (isThisWeek || row.verif_ashar === 'BELUM')  && row.verif_ashar !== 'OK'
    const isHitungMaghrib = row.maghrib === 'A' && (isThisWeek || row.verif_maghrib === 'BELUM') && row.verif_maghrib !== 'OK'

    if (!isHitungShubuh && !isHitungAshar && !isHitungMaghrib) return

    const nis = row.nis
    if (!rekapMap.has(nis)) {
      rekapMap.set(nis, {
        nama: row.nama_lengkap,
        asrama: row.asrama || '-',
        kamar: row.kamar || '-',
        alfa_shubuh: 0,
        alfa_ashar: 0,
        alfa_maghrib: 0,
        total: 0,
      })
    }

    const curr = rekapMap.get(nis)
    if (isHitungShubuh) { curr.alfa_shubuh++; curr.total++ }
    if (isHitungAshar)  { curr.alfa_ashar++;  curr.total++ }
    if (isHitungMaghrib) { curr.alfa_maghrib++; curr.total++ }
  })

  return Array.from(rekapMap.values()).sort((a, b) => a.nama.localeCompare(b.nama))
}