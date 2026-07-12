'use server'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from 'next/cache'
import { actorFromSession, logActivity } from '@/lib/activity-log'
import { assertFeature } from '@/lib/auth/feature'
import { execute, query, queryOne } from '@/lib/db'

const PATH = '/dashboard/keuangan/setoran-spp-baru'

export async function getSetoranSppBaru(tahun: number, bulan: number) {
  const access = await assertFeature(PATH)
  if ('error' in access) return access
  const start = `${tahun}-${String(bulan).padStart(2, '0')}-01`
  const nextMonth = bulan === 12 ? 1 : bulan + 1
  const nextYear = bulan === 12 ? tahun + 1 : tahun
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  const rows = await query<any>(`
    WITH ledger AS (
      SELECT COALESCE(NULLIF(TRIM(s.asrama), ''), 'LAINNYA') AS unit_setor,
             COUNT(*) AS jumlah_transaksi, COUNT(DISTINCT sl.santri_id) AS jumlah_santri,
             SUM(sl.nominal_bayar) AS target_sistem
      FROM spp_log sl JOIN santri s ON s.id = sl.santri_id
      WHERE sl.tujuan_setoran = 'BENDAHARA_PUSAT'
        AND sl.tanggal_bayar >= ? AND sl.tanggal_bayar < ?
      GROUP BY COALESCE(NULLIF(TRIM(s.asrama), ''), 'LAINNYA')
    )
    SELECT l.*, ss.id AS setoran_id, ss.jumlah_aktual, ss.nama_penyetor,
           ss.tanggal_setor, ss.tanggal_terima, ss.status, u.full_name AS penerima_nama
    FROM ledger l
    LEFT JOIN spp_setoran ss ON ss.unit_setor = l.unit_setor AND ss.tahun = ? AND ss.bulan = ?
      AND ss.tujuan_setoran = 'BENDAHARA_PUSAT'
    LEFT JOIN users u ON u.id = ss.penerima_id
    ORDER BY l.unit_setor
  `, [start, end, tahun, bulan])

  const details = await query<any>(`
    SELECT sl.id, sl.tahun, sl.bulan, sl.nominal_bayar, sl.tanggal_bayar,
           s.nama_lengkap, s.nis, COALESCE(NULLIF(TRIM(s.asrama), ''), 'LAINNYA') AS unit_setor
    FROM spp_log sl JOIN santri s ON s.id = sl.santri_id
    WHERE sl.tujuan_setoran = 'BENDAHARA_PUSAT'
      AND sl.tanggal_bayar >= ? AND sl.tanggal_bayar < ?
    ORDER BY unit_setor, s.nama_lengkap
  `, [start, end])
  return { rows, details }
}

export async function konfirmasiSetoranPusat(setoranId: string) {
  const access = await assertFeature(PATH, 'update')
  if ('error' in access) return access
  const row = await queryOne<any>(`SELECT * FROM spp_setoran WHERE id = ? AND tujuan_setoran = 'BENDAHARA_PUSAT'`, [setoranId])
  if (!row) return { error: 'Setoran Bendahara Pesantren tidak ditemukan.' }
  if (row.status === 'dikonfirmasi') return { error: 'Setoran sudah dikonfirmasi.' }
  await execute(`UPDATE spp_setoran SET status = 'dikonfirmasi', tanggal_terima = datetime('now'), penerima_id = ? WHERE id = ? AND tujuan_setoran = 'BENDAHARA_PUSAT'`, [access.id, setoranId])
  await logActivity({ actor: actorFromSession(access), module: 'spp_setoran_pusat', action: 'confirm', fiturHref: PATH, logKind: 'update', entityType: 'spp_setoran', entityId: setoranId, entityLabel: row.unit_setor, summary: `Konfirmasi setoran SPP santri baru ${row.unit_setor}`, details: { jumlah: row.jumlah_aktual, tahun: row.tahun, bulan: row.bulan } })
  revalidatePath(PATH); revalidatePath('/dashboard/asrama/spp')
  return { success: true }
}

export async function batalkanKonfirmasiSetoranPusat(setoranId: string, alasan: string) {
  const access = await assertFeature(PATH, 'update')
  if ('error' in access) return access
  const reason = String(alasan ?? '').trim()
  if (reason.length < 5) return { error: 'Alasan pembatalan minimal 5 karakter.' }
  const row = await queryOne<any>(`SELECT * FROM spp_setoran WHERE id = ? AND tujuan_setoran = 'BENDAHARA_PUSAT'`, [setoranId])
  if (!row || row.status !== 'dikonfirmasi') return { error: 'Setoran terkonfirmasi tidak ditemukan.' }
  await execute(`UPDATE spp_setoran SET status = 'menunggu_konfirmasi', tanggal_terima = NULL, penerima_id = NULL WHERE id = ?`, [setoranId])
  await logActivity({ actor: actorFromSession(access), module: 'spp_setoran_pusat', action: 'undo_confirm', fiturHref: PATH, logKind: 'update', entityType: 'spp_setoran', entityId: setoranId, entityLabel: row.unit_setor, summary: `Batalkan konfirmasi setoran SPP santri baru ${row.unit_setor}`, details: { alasan: reason } })
  revalidatePath(PATH); revalidatePath('/dashboard/asrama/spp')
  return { success: true }
}
