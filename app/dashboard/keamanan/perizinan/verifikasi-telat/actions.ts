'use server'

import { query, execute, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { formatDistance } from 'date-fns'
import { id } from 'date-fns/locale'

export async function getAntrianTelat() {
  const currentNow = new Date()

  const rawData = await query<any>(`
    SELECT p.id, p.jenis, p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual,
           p.alasan, p.pemberi_izin,
           s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE p.status = 'AKTIF'
    ORDER BY p.tgl_selesai_rencana ASC
  `, [])

  if (!rawData.length) return []

  const list: any[] = []

  rawData.forEach((item: any) => {
    const rencana = new Date(item.tgl_selesai_rencana)
    const aktual = item.tgl_kembali_aktual ? new Date(item.tgl_kembali_aktual) : null

    let isTarget = false
    let statusLabel = ''

    if (aktual) {
      isTarget = true
      statusLabel = 'SUDAH KEMBALI (Menunggu Sidang)'
    } else if (rencana < currentNow) {
      isTarget = true
      statusLabel = 'BELUM KEMBALI (Overdue)'
    }

    if (isTarget) {
      const compareTime = aktual || currentNow
      const durasi = formatDistance(rencana, compareTime, { locale: id, addSuffix: false })

      list.push({
        izin_id: item.id,
        santri_id: item.santri_id,
        nama: item.nama_lengkap,
        info: `${item.asrama || '-'} / ${item.kamar || '-'}`,
        jenis: item.jenis === 'PULANG' ? 'IZIN PULANG' : 'KELUAR KOMPLEK',
        alasan: item.alasan,
        batas_kembali: item.tgl_selesai_rencana,
        tgl_kembali: item.tgl_kembali_aktual,
        status_label: statusLabel,
        durasi_telat: durasi,
      })
    }
  })

  return list
}

export async function simpanVonisTelat(
  izinId: string,
  santriId: string,
  vonis: 'TELAT_MURNI' | 'SAKIT' | 'IZIN_UZUR' | 'MANGKIR'
) {
  const session = await getSession()

  if (vonis === 'MANGKIR') {
    return { success: true, message: 'Ditandai Mangkir. Akan muncul lagi nanti.' }
  }

  if (vonis === 'TELAT_MURNI') {
    await execute(`
      INSERT INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin, penindak_id)
      VALUES (?, ?, ?, 'SEDANG', 'Terlambat kembali ke pondok (Melebihi batas izin).', 25, ?)
    `, [generateId(), santriId, now(), session?.id ?? null])
  }

  await execute(
    `UPDATE perizinan SET status = 'KEMBALI' WHERE id = ?`,
    [izinId]
  )

  revalidatePath('/dashboard/keamanan/perizinan/verifikasi-telat')
  revalidatePath('/dashboard/keamanan')
  return { success: true }
}