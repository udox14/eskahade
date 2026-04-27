'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession, hasRole, hasAnyRole, isAdmin } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getClientRestriction() {
  const session = await getSession()
  if (!session) return null
  if (hasRole(session, 'pengurus_asrama')) return session.asrama_binaan ?? null
  return null
}

export async function getNominalSPP() {
  return 70000
}


export async function getSppBillingStart() {
  const row = await queryOne<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'spp_tagihan_mulai'`
  )
  const value = row?.value ?? '2026-01'
  const [tahunMulai, bulanMulai] = value.split('-').map(Number)
  return {
    tahun: Number.isFinite(tahunMulai) ? tahunMulai : 2026,
    bulan: Number.isFinite(bulanMulai) ? bulanMulai : 1,
    value,
  }
}

// Hanya ambil daftar kamar — dipanggil saat halaman pertama dibuka
export async function getKamarsSPP(tahun: number, asrama: string) {
  const rows = await query<{ kamar: string }>(
    `SELECT DISTINCT kamar
     FROM santri
     WHERE status_global = 'aktif'
       AND asrama = ?
       AND kamar IS NOT NULL
       AND TRIM(kamar) <> ''
     ORDER BY CAST(kamar AS INTEGER), kamar`,
    [asrama]
  )
  return rows.map(r => r.kamar).filter(Boolean)
}

// Ambil santri + status SPP hanya untuk 1 kamar
export async function getDashboardSPPKamar(tahun: number, asrama: string, kamar: string) {
  const billingStart = await getSppBillingStart()
  const currentMonth = new Date().getMonth() + 1
  const maxCheck = tahun < new Date().getFullYear() ? 12 : currentMonth
  const startMonth = tahun === billingStart.tahun ? billingStart.bulan : (tahun < billingStart.tahun ? 13 : 1)
  const billableCount = Math.max(0, maxCheck - startMonth + 1)

  // Gunakan CTE flat — tidak ada correlated subquery per baris santri
  const rows = await query<any>(`
    WITH
      bayar_tahun AS (
        SELECT santri_id, COUNT(*) AS jumlah_bayar
        FROM spp_log
        WHERE tahun = ? AND bulan BETWEEN ? AND ?
        GROUP BY santri_id
      ),
      bayar_bulan_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
      )
    SELECT
      s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
      COALESCE(bt.jumlah_bayar, 0) AS jumlah_bayar,
      CASE WHEN bbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bulan_ini_lunas
    FROM santri s
    LEFT JOIN bayar_tahun bt ON bt.santri_id = s.id
    LEFT JOIN bayar_bulan_ini bbi ON bbi.santri_id = s.id
    WHERE s.status_global = 'aktif'
      AND s.asrama = ?
      AND s.kamar = ?
    ORDER BY s.nama_lengkap
  `, [tahun, startMonth, maxCheck, tahun, currentMonth, asrama, kamar])

  return rows.map((s: any) => ({
    ...s,
    bulan_ini_lunas: s.bulan_ini_lunas === 1,
    jumlah_tunggakan: Math.max(0, billableCount - (s.jumlah_bayar ?? 0)),
  }))
}

export async function searchDashboardSPP(tahun: number, asrama: string, keyword: string) {
  const q = keyword.trim()
  if (q.length < 2) return []

  const billingStart = await getSppBillingStart()
  const currentMonth = new Date().getMonth() + 1
  const maxCheck = tahun < new Date().getFullYear() ? 12 : currentMonth
  const startMonth = tahun === billingStart.tahun ? billingStart.bulan : (tahun < billingStart.tahun ? 13 : 1)
  const billableCount = Math.max(0, maxCheck - startMonth + 1)
  const like = `%${q}%`

  const rows = await query<any>(`
    WITH
      bayar_tahun AS (
        SELECT santri_id, COUNT(*) AS jumlah_bayar
        FROM spp_log
        WHERE tahun = ? AND bulan BETWEEN ? AND ?
        GROUP BY santri_id
      ),
      bayar_bulan_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
      )
    SELECT
      s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.foto_url,
      COALESCE(bt.jumlah_bayar, 0) AS jumlah_bayar,
      CASE WHEN bbi.santri_id IS NOT NULL THEN 1 ELSE 0 END AS bulan_ini_lunas
    FROM santri s
    LEFT JOIN bayar_tahun bt ON bt.santri_id = s.id
    LEFT JOIN bayar_bulan_ini bbi ON bbi.santri_id = s.id
    WHERE s.status_global = 'aktif'
      AND s.asrama = ?
      AND (s.nama_lengkap LIKE ? OR s.nis LIKE ? OR s.kamar LIKE ?)
    ORDER BY CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
    LIMIT 50
  `, [tahun, startMonth, maxCheck, tahun, currentMonth, asrama, like, like, like])

  return rows.map((s: any) => ({
    ...s,
    bulan_ini_lunas: s.bulan_ini_lunas === 1,
    jumlah_tunggakan: Math.max(0, billableCount - (s.jumlah_bayar ?? 0)),
  }))
}

export async function getStatusSPP(santriId: string, tahun: number) {
  return query<any>(
    `SELECT id, bulan, tahun, nominal_bayar, tanggal_bayar
     FROM spp_log WHERE santri_id = ? AND tahun = ?`,
    [santriId, tahun]
  )
}

export async function bayarSPP(santriId: string, tahun: number, bulans: number[], nominalPerBulan: number): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  const billingStart = await getSppBillingStart()
  const invalidMonth = bulans.some(b => (tahun * 100 + b) < (billingStart.tahun * 100 + billingStart.bulan))
  if (invalidMonth) return { error: 'Bulan tersebut belum memiliki tagihan SPP.' }

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

export async function batalkanPembayaranSPP(
  logId: string
): Promise<{ success: boolean } | { error: string }> {
  if (!logId) return { error: 'Data pembayaran tidak valid.' }

  const current = await queryOne<{ id: string }>(
    `SELECT id FROM spp_log WHERE id = ?`,
    [logId]
  )
  if (!current) return { error: 'Data pembayaran tidak ditemukan.' }

  await execute(
    `DELETE FROM spp_log WHERE id = ?`,
    [logId]
  )

  revalidatePath('/dashboard/asrama/spp')
  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}

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

// Fungsi lama — dipertahankan untuk kompatibilitas fungsi lain yang mungkin masih pakai
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
