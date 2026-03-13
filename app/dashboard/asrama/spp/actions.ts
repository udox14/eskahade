'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getClientRestriction() {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null
}

export async function getNominalSPP() {
  return 70000
}

// FIX #1: Ganti 2 full table scan + JS loop -> 1 query SQL agregasi
export async function getRingkasanTunggakan(asramaFilter?: string) {
  const tahun = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const asramaClause = (asramaFilter && asramaFilter !== 'SEMUA') ? 'AND s.asrama = ?' : ''
  const params: any[] = [tahun, currentMonth, currentMonth]
  if (asramaFilter && asramaFilter !== 'SEMUA') params.push(asramaFilter)

  const result = await queryOne<{ penunggak: number }>(`
    SELECT COUNT(*) AS penunggak
    FROM santri s
    WHERE s.status_global = 'aktif'
      ${asramaClause}
      AND (
        SELECT COUNT(DISTINCT sl.bulan)
        FROM spp_log sl
        WHERE sl.santri_id = s.id
          AND sl.tahun = ?
          AND sl.bulan BETWEEN 1 AND ?
      ) < ?
  `, params)

  return result?.penunggak ?? 0
}

// FIX #2: Ganti fetch semua baris + JS loop -> SQL agregasi per santri
export async function getDashboardSPP(tahun: number, asrama: string) {
  const currentMonth = new Date().getMonth() + 1
  const maxCheck = tahun < new Date().getFullYear() ? 12 : currentMonth

  const asramaClause = (asrama && asrama !== 'SEMUA') ? 'AND s.asrama = ?' : ''
  const params: any[] = []
  if (asrama && asrama !== 'SEMUA') params.push(asrama)
  params.push(tahun, maxCheck, tahun, currentMonth)

  const rows = await query<any>(`
    SELECT
      s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
      CAST(s.kamar AS INTEGER) AS kamar_num,
      (
        SELECT COUNT(*)
        FROM spp_log sl
        WHERE sl.santri_id = s.id
          AND sl.tahun = ?
          AND sl.bulan BETWEEN 1 AND ?
      ) AS jumlah_bayar,
      CASE WHEN EXISTS (
        SELECT 1 FROM spp_log sl2
        WHERE sl2.santri_id = s.id
          AND sl2.tahun = ?
          AND sl2.bulan = ?
      ) THEN 1 ELSE 0 END AS bulan_ini_lunas
    FROM santri s
    WHERE s.status_global = 'aktif'
      ${asramaClause}
    ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
  `, params)

  return rows.map((s: any) => ({
    ...s,
    bulan_ini_lunas: s.bulan_ini_lunas === 1,
    jumlah_tunggakan: Math.max(0, maxCheck - (s.jumlah_bayar ?? 0)),
    kamar_num: s.kamar_num || 999,
  }))
}

export async function getStatusSPP(santriId: string, tahun: number) {
  return query<any>(
    `SELECT id, bulan, tahun, nominal_bayar, tanggal_bayar
     FROM spp_log WHERE santri_id = ? AND tahun = ?`,
    [santriId, tahun]
  )
}

// FIX #7a: Ganti for...of await execute -> batch()
export async function bayarSPP(santriId: string, tahun: number, bulans: number[], nominalPerBulan: number): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  const ph = bulans.map(() => '?').join(',')

  const exist = await query<any>(
    `SELECT bulan FROM spp_log WHERE santri_id = ? AND tahun = ? AND bulan IN (${ph})`,
    [santriId, tahun, ...bulans]
  )
  if (exist.length > 0) return { error: 'Beberapa bulan sudah dibayar sebelumnya.' }

  await batch(bulans.map(b => ({
    sql: `INSERT INTO spp_log (id, santri_id, tahun, bulan, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
          VALUES (?, ?, ?, ?, ?, ?, 'Pembayaran Manual', date('now'))`,
    params: [generateId(), santriId, tahun, b, nominalPerBulan, session?.id ?? null],
  })))

  revalidatePath('/dashboard/asrama/spp')
  return { success: true }
}

// FIX #7b: Ganti for...of await execute -> batch()
export async function simpanSppBatch(listTransaksi: any[]): Promise<{ success: boolean; count: number } | { error: string }> {
  const session = await getSession()
  if (!listTransaksi.length) return { error: 'Tidak ada data.' }

  await batch(listTransaksi.map(item => ({
    sql: `INSERT INTO spp_log (id, santri_id, bulan, tahun, nominal_bayar, penerima_id, keterangan, tanggal_bayar)
          VALUES (?, ?, ?, ?, ?, ?, 'Pembayaran Cepat', date('now'))`,
    params: [generateId(), item.santriId, item.bulan, item.tahun, item.nominal, session?.id ?? null],
  })))

  revalidatePath('/dashboard/asrama/spp')
  return { success: true, count: listTransaksi.length }
}
