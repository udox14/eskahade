'use server'

import { query, execute, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { formatDistance } from 'date-fns'
import { id } from 'date-fns/locale'

// ─── Antrian sidang telat (perizinan + perpulangan) ──────────────────────────
// Sumber 1 — perizinan: status AKTIF, sudah kembali atau sudah lewat batas
// Sumber 2 — perpulangan_log: status_datang = 'TELAT'
// Kedua sumber digabung di memory, diurutkan by batas_kembali
export async function getAntrianTelat() {
  const currentNow = new Date().toISOString()

  // Query 1: perizinan telat (existing behavior)
  const perizinanData = await query<any>(`
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

  // Query 2: perpulangan telat — santri yang belum kembali setelah periode selesai
  const perpulanganData = await query<any>(`
    SELECT pl.id, pl.santri_id, pl.keterangan,
           pp.tgl_selesai_datang, pp.nama_periode,
           s.nama_lengkap, s.nis, s.asrama, s.kamar
    FROM perpulangan_log pl
    JOIN perpulangan_periode pp ON pp.id = pl.periode_id
    JOIN santri s ON s.id = pl.santri_id
    WHERE pl.status_datang = 'TELAT'
    ORDER BY pp.tgl_selesai_datang ASC
    LIMIT 200
  `)

  const list: any[] = []

  // Format antrian perizinan
  perizinanData.forEach((item: any) => {
    const rencana     = new Date(item.tgl_selesai_rencana.replace(' ', 'T'))
    const aktual      = item.tgl_kembali_aktual
      ? new Date(item.tgl_kembali_aktual.replace(' ', 'T'))
      : null
    const compareTime = aktual || new Date()
    const durasi      = formatDistance(rencana, compareTime, { locale: id, addSuffix: false })

    list.push({
      izin_id:       item.id,
      santri_id:     item.santri_id,
      nama:          item.nama_lengkap,
      info:          `${item.asrama || '-'} / ${item.kamar || '-'}`,
      jenis:         item.jenis === 'PULANG' ? 'IZIN PULANG' : 'KELUAR KOMPLEK',
      sumber:        'perizinan' as const,
      alasan:        item.alasan,
      batas_kembali: item.tgl_selesai_rencana,
      tgl_kembali:   item.tgl_kembali_aktual,
      status_label:  aktual ? 'SUDAH KEMBALI (Menunggu Sidang)' : 'BELUM KEMBALI (Overdue)',
      durasi_telat:  durasi,
    })
  })

  // Format antrian perpulangan
  perpulanganData.forEach((item: any) => {
    const batas  = new Date(item.tgl_selesai_datang)
    const durasi = formatDistance(batas, new Date(), { locale: id, addSuffix: false })

    list.push({
      izin_id:       item.id,   // log_id dari perpulangan_log
      santri_id:     item.santri_id,
      nama:          item.nama_lengkap,
      info:          `${item.asrama || '-'} / ${item.kamar || '-'}`,
      jenis:         'TELAT KEMBALI (PERPULANGAN)',
      sumber:        'perpulangan' as const,
      alasan:        item.keterangan || `Periode: ${item.nama_periode}`,
      batas_kembali: item.tgl_selesai_datang,
      tgl_kembali:   null,
      status_label:  'BELUM KEMBALI (Telat Perpulangan)',
      durasi_telat:  durasi,
    })
  })

  return list
}

// ─── Vonis telat ─────────────────────────────────────────────────────────────
// sumber 'perizinan' → update tabel perizinan (existing)
// sumber 'perpulangan' → update tabel perpulangan_log
export async function simpanVonisTelat(
  izinId: string,
  santriId: string,
  vonis: 'TELAT_MURNI' | 'SAKIT' | 'IZIN_UZUR' | 'MANGKIR',
  sumber: 'perizinan' | 'perpulangan' = 'perizinan'
): Promise<{ success: boolean; message?: string } | { error: string }> {
  const session = await getSession()

  if (vonis === 'MANGKIR') {
    return { success: true, message: 'Ditandai Mangkir. Akan muncul lagi nanti.' }
  }

  if (vonis === 'TELAT_MURNI') {
    const deskripsi = sumber === 'perpulangan'
      ? 'Terlambat kembali ke pondok setelah perpulangan libur semester.'
      : 'Terlambat kembali ke pondok (Melebihi batas izin).'

    await execute(`
      INSERT INTO pelanggaran (id, santri_id, tanggal, jenis, deskripsi, poin, penindak_id)
      VALUES (?, ?, ?, 'SEDANG', ?, 25, ?)
    `, [generateId(), santriId, now(), deskripsi, session?.id ?? null])
  }

  if (sumber === 'perpulangan') {
    // TELAT_MURNI → VONIS (sudah diproses, tetap kelihatan bedanya dari SUDAH tepat waktu)
    // SAKIT / IZIN_UZUR → SUDAH (dianggap kembali dengan keterangan)
    const newStatus = vonis === 'TELAT_MURNI' ? 'VONIS' : 'SUDAH'
    await execute(
      `UPDATE perpulangan_log SET status_datang = ?, tgl_datang = ?, updated_by = ? WHERE id = ?`,
      [newStatus, now(), session?.id ?? null, izinId]
    )
    revalidatePath('/dashboard/asrama/perpulangan/monitoring')
  } else {
    // Existing: update perizinan
    await execute(
      `UPDATE perizinan SET status = 'KEMBALI' WHERE id = ?`,
      [izinId]
    )
  }

  revalidatePath('/dashboard/keamanan/perizinan/verifikasi-telat')
  revalidatePath('/dashboard/keamanan')
  return { success: true }
}
