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

export async function getRekapAlfaMingguan(tanggalRef: string, onlyMangkir: boolean = false) {
  const { start, end } = getWeekRange(new Date(tanggalRef))
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  let sql = `
    SELECT ah.id, ah.tanggal,
           ah.shubuh, ah.ashar, ah.maghrib,
           ah.verif_shubuh, ah.verif_ashar, ah.verif_maghrib,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM absensi_harian ah
    JOIN riwayat_pendidikan rp ON rp.id = ah.riwayat_pendidikan_id
    JOIN santri s ON s.id = rp.santri_id
    WHERE 
  `
  let params = []

  if (onlyMangkir) {
    // Ambil data mangkir (BELUM) dalam 3 bulan terakhir
    const batas = new Date()
    batas.setMonth(batas.getMonth() - 3)
    const batasStr = batas.toISOString().slice(0, 10)
    
    sql += `
      ah.tanggal >= ? 
      AND (ah.verif_shubuh = 'BELUM' OR ah.verif_ashar = 'BELUM' OR ah.verif_maghrib = 'BELUM')
    `
    params.push(batasStr)
  } else {
    // Normal: Pekan ini (termasuk yang mangkir jika ada di database)
    sql += `
      ah.tanggal >= ? AND ah.tanggal <= ?
      AND (ah.shubuh = 'A' OR ah.ashar = 'A' OR ah.maghrib = 'A')
    `
    params.push(startStr, endStr)
  }

  const rawData = await query<any>(sql, params)
  if (!rawData.length) return []

  const rekapMap = new Map<string, any>()

  rawData.forEach((row: any) => {
    // Jika onlyMangkir, kita hanya hitung yang statusnya 'BELUM'
    // Jika normal, kita hitung semua yang 'A' dan belum 'OK' (termasuk 'BELUM' dan yang NULL)
    
    let isHitungShubuh = false
    let isHitungAshar  = false
    let isHitungMaghrib = false

    if (onlyMangkir) {
      isHitungShubuh = row.verif_shubuh === 'BELUM'
      isHitungAshar  = row.verif_ashar === 'BELUM'
      isHitungMaghrib = row.verif_maghrib === 'BELUM'
    } else {
      isHitungShubuh = row.shubuh === 'A' && row.verif_shubuh !== 'OK'
      isHitungAshar  = row.ashar === 'A'  && row.verif_ashar !== 'OK'
      isHitungMaghrib = row.maghrib === 'A' && row.verif_maghrib !== 'OK'
    }

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