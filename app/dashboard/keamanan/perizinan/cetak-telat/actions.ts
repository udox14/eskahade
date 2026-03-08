'use server'

import { query } from '@/lib/db'
import { formatDistance } from 'date-fns'
import { id } from 'date-fns/locale'

export async function getSantriTelat(tanggalRef: string) {
  const now = new Date()

  const rawData = await query<any>(`
    SELECT p.id, p.jenis, p.tgl_selesai_rencana, p.tgl_kembali_aktual,
           s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE p.status = 'AKTIF'
    ORDER BY s.asrama, s.nama_lengkap
  `, [])

  if (!rawData.length) return null

  const list: any[] = []

  rawData.forEach((item: any) => {
    const rencana = new Date(item.tgl_selesai_rencana)
    const aktual = item.tgl_kembali_aktual ? new Date(item.tgl_kembali_aktual) : null

    let isTarget = false
    let compareTime = now

    if (aktual) {
      if (aktual > rencana) { isTarget = true; compareTime = aktual }
    } else {
      if (now > rencana) { isTarget = true; compareTime = now }
    }

    if (isTarget) {
      const telat = formatDistance(rencana, compareTime, { locale: id, addSuffix: false })
      list.push({
        nama: item.nama_lengkap,
        nis: item.nis,
        asrama: item.asrama || 'NON-ASRAMA',
        kamar: item.kamar || '-',
        jenis: item.jenis === 'PULANG' ? 'IZIN PULANG' : 'KELUAR KOMPLEK',
        rencana_kembali: item.tgl_selesai_rencana,
        durasi_telat: telat,
      })
    }
  })

  if (!list.length) return null

  return list.reduce((groups: any, item: any) => {
    const key = item.asrama
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
    return groups
  }, {})
}