'use server'

import { execute, generateId, now, query } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { formatDistance } from 'date-fns'
import { id } from 'date-fns/locale'

export type TelatPerpulanganItem = {
  log_id: string
  santri_id: string
  nama: string
  info: string
  periode: string
  batas_kembali: string
  status_label: string
  durasi_telat: string
  alasan: string
}

export async function getAntrianTelatPerpulangan(): Promise<TelatPerpulanganItem[]> {
  const rows = await query<any>(`
    SELECT pl.id, pl.santri_id, pl.keterangan, pl.status_datang,
           pp.tgl_selesai_datang, pp.nama_periode,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM perpulangan_log pl
    JOIN perpulangan_periode pp ON pp.id = pl.periode_id
    JOIN santri s ON s.id = pl.santri_id
    WHERE pl.status_datang = 'TELAT'
      AND UPPER(TRIM(COALESCE(s.asrama, ''))) != 'AL-BAGHORY'
    ORDER BY pp.tgl_selesai_datang ASC, s.asrama, s.nama_lengkap
    LIMIT 500
  `)

  return rows.map((item: any) => {
    const batas = new Date(`${item.tgl_selesai_datang}T23:59:59+07:00`)
    return {
      log_id: item.id,
      santri_id: item.santri_id,
      nama: item.nama_lengkap,
      info: `${item.asrama || '-'} / ${item.kamar || '-'}`,
      periode: item.nama_periode,
      batas_kembali: item.tgl_selesai_datang,
      status_label: 'BELUM KEMBALI (Telat Perpulangan)',
      durasi_telat: formatDistance(batas, new Date(), { locale: id, addSuffix: false }),
      alasan: item.keterangan || `Periode: ${item.nama_periode}`,
    }
  })
}

export async function simpanVonisTelatPerpulangan(
  logId: string,
  santriId: string,
  vonis: 'TELAT_MURNI' | 'SAKIT' | 'IZIN_UZUR' | 'MANGKIR'
): Promise<{ success: boolean; message?: string } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  if (vonis === 'MANGKIR') {
    return { success: true, message: 'Ditandai mangkir. Data tetap muncul di antrian.' }
  }

  if (vonis === 'TELAT_MURNI') {
    await execute(`
      INSERT INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin, penindak_id)
      VALUES (?, ?, ?, 'SEDANG', 'Terlambat kembali ke pondok setelah perpulangan libur panjang.', 25, ?)
    `, [generateId(), santriId, now(), session.id])
  }

  const newStatus = vonis === 'TELAT_MURNI' ? 'VONIS' : 'SUDAH'
  await execute(
    `UPDATE perpulangan_log SET status_datang = ?, tgl_datang = ?, updated_by = ? WHERE id = ?`,
    [newStatus, now(), session.id, logId]
  )

  await logActivity({
    actor: actorFromSession(session),
    module: 'asrama_perpulangan_verifikasi_telat',
    action: 'approval',
    fiturHref: '/dashboard/asrama/perpulangan/verifikasi-telat',
    logKind: 'update',
    entityType: 'perpulangan_log',
    entityId: logId,
    entityLabel: santriId,
    summary: `Memberi vonis telat perpulangan ${vonis.toLowerCase().replaceAll('_', ' ')}`,
    details: { santri_id: santriId, vonis },
  })

  revalidatePath('/dashboard/asrama/perpulangan')
  revalidatePath('/dashboard/asrama/perpulangan/monitoring')
  revalidatePath('/dashboard/asrama/perpulangan/verifikasi-telat')
  revalidatePath('/dashboard/keamanan')
  return { success: true }
}
