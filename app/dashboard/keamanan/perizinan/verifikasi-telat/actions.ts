'use server'

import { query, execute, generateId, now } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { assertFeature } from '@/lib/auth/feature'
import { saveLateVerdict } from '@/lib/discipline/late'
import { revalidateDiscipline } from '@/lib/discipline/revalidate'
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
      AND UPPER(TRIM(COALESCE(s.asrama, ''))) != 'AL-BAGHORY'
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
      jenis:         'IZIN PULANG',
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
  const access=await assertFeature('/dashboard/keamanan/perizinan/verifikasi-telat','update');if('error' in access)return access
  const session=access
  try { await saveLateVerdict({source:sumber,id:izinId,santriId,vonis,actor:session.id}) }
  catch { return {error:'Data sudah diproses, tidak sesuai santri, atau gagal disimpan. Muat ulang antrean.'} }
  if(vonis==='MANGKIR')return {success:true,message:'Ditandai mangkir. Data tetap muncul di antrean.'}
  await logActivity({
    actor: actorFromSession(session),
    module: 'keamanan_verifikasi_telat',
    action: 'approval',
    fiturHref: '/dashboard/keamanan/perizinan/verifikasi-telat',
    logKind: 'update',
    entityType: sumber === 'perpulangan' ? 'perpulangan_log' : 'perizinan',
    entityId: izinId,
    entityLabel: santriId,
    summary: `Memberi vonis telat ${vonis.toLowerCase().replaceAll('_', ' ')}`,
    details: { santri_id: santriId, vonis, sumber },
  })

  revalidatePath('/dashboard/keamanan/perizinan/verifikasi-telat')
  revalidateDiscipline(santriId)
  return { success: true }
}
