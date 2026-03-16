'use server'

import { query, execute, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { formatDistance } from 'date-fns'
import { id } from 'date-fns/locale'

// ─── Antrian sidang telat ─────────────────────────────────────────────────────
// Fix: filter langsung di SQL — tidak fetch semua AKTIF lalu saring di JS
// Kriteria telat di SQL:
//   1. Sudah kembali aktual (tgl_kembali_aktual IS NOT NULL) → menunggu sidang
//   2. Belum kembali tapi sudah lewat batas (tgl_selesai_rencana < NOW) → overdue
// Kedua kondisi ini jauh lebih hemat row reads daripada fetch semua AKTIF
export async function getAntrianTelat() {
  const currentNow = new Date().toISOString()

  const rawData = await query<any>(`
    SELECT p.id, p.jenis, p.tgl_mulai, p.tgl_selesai_rencana, p.tgl_kembali_aktual,
           p.alasan, p.pemberi_izin,
           s.id AS santri_id, s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM perizinan p
    JOIN santri s ON s.id = p.santri_id
    WHERE p.status = 'AKTIF'
      AND (
        p.tgl_kembali_aktual IS NOT NULL
        OR p.tgl_selesai_rencana < ?
      )
    ORDER BY p.tgl_selesai_rencana ASC
    LIMIT 200
  `, [currentNow])

  if (!rawData.length) return []

  const list: any[] = []
  rawData.forEach((item: any) => {
    const rencana    = new Date(item.tgl_selesai_rencana.replace(' ', 'T'))
    const aktual     = item.tgl_kembali_aktual
      ? new Date(item.tgl_kembali_aktual.replace(' ', 'T'))
      : null
    const compareTime = aktual || new Date()
    const durasi      = formatDistance(rencana, compareTime, { locale: id, addSuffix: false })

    list.push({
      izin_id:      item.id,
      santri_id:    item.santri_id,
      nama:         item.nama_lengkap,
      info:         `${item.asrama || '-'} / ${item.kamar || '-'}`,
      jenis:        item.jenis === 'PULANG' ? 'IZIN PULANG' : 'KELUAR KOMPLEK',
      alasan:       item.alasan,
      batas_kembali: item.tgl_selesai_rencana,
      tgl_kembali:  item.tgl_kembali_aktual,
      status_label: aktual ? 'SUDAH KEMBALI (Menunggu Sidang)' : 'BELUM KEMBALI (Overdue)',
      durasi_telat: durasi,
    })
  })

  return list
}

export async function simpanVonisTelat(
  izinId: string,
  santriId: string,
  vonis: 'TELAT_MURNI' | 'SAKIT' | 'IZIN_UZUR' | 'MANGKIR'
): Promise<{ success: boolean; message?: string } | { error: string }> {
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
