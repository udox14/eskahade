'use server'

import { execute, generateId, now, query } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { revalidatePath } from 'next/cache'
import { assertFeature } from '@/lib/auth/feature'
import { saveLateVerdict } from '@/lib/discipline/late'
import { revalidateDiscipline } from '@/lib/discipline/revalidate'
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
  const access=await assertFeature('/dashboard/asrama/perpulangan/verifikasi-telat','update');if('error' in access)return access
  const session=access
  try { await saveLateVerdict({source:'perpulangan',id:logId,santriId,vonis,actor:session.id}) }
  catch { return {error:'Data sudah diproses, tidak sesuai santri, atau gagal disimpan. Muat ulang antrean.'} }
  if(vonis==='MANGKIR')return {success:true,message:'Ditandai mangkir. Data tetap muncul di antrean.'}
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
  revalidateDiscipline(santriId)
  return { success: true }
}
