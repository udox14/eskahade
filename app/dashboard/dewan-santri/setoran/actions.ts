'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function getClientRestriction() {
  const session = await getSession()
  if (session?.role === 'pengurus_asrama') return session.asrama_binaan ?? null
  return null
}

// ─── Tarif SPP aktif untuk tahun tertentu ────────────────────────────────
export async function getSppSettings(tahun: number) {
  const row = await queryOne<{ nominal: number; tahun_kalender: number }>(
    `SELECT nominal, tahun_kalender FROM spp_settings
     WHERE tahun_kalender = ? AND is_active = 1
     ORDER BY id DESC LIMIT 1`,
    [tahun]
  )
  return row ?? { nominal: 70000, tahun_kalender: tahun }
}

// ─── Monitoring setoran: 1 query agregasi per asrama ─────────────────────
// Rows read: ~santri aktif (2339) + spp_log bulan itu via index
export async function getMonitoringSetoran(tahun: number, bulan: number) {
  const bulanSebelumnya = bulan === 1 ? 12 : bulan - 1
  const tahunSebelumnya = bulan === 1 ? tahun - 1 : tahun

  const rows = await query<{
    asrama: string
    total_santri: number
    bebas_spp: number
    wajib_bayar: number
    bayar_bulan_ini: number
    bayar_tunggakan_lalu: number
    total_nominal: number
  }>(`
    SELECT
      s.asrama,
      COUNT(*)                                                          AS total_santri,
      SUM(s.bebas_spp)                                                  AS bebas_spp,
      COUNT(*) - SUM(s.bebas_spp)                                       AS wajib_bayar,

      SUM(
        CASE WHEN s.bebas_spp = 0
          AND EXISTS (
            SELECT 1 FROM spp_log sl
            WHERE sl.santri_id = s.id
              AND sl.tahun = ? AND sl.bulan = ?
          )
        THEN 1 ELSE 0 END
      ) AS bayar_bulan_ini,

      -- Bayar tunggakan bulan lalu: ada catatan bulan lalu, tapi TIDAK ada bulan ini
      -- (artinya mereka nyicil tunggakan, bukan bayar rutin)
      SUM(
        CASE WHEN s.bebas_spp = 0
          AND EXISTS (
            SELECT 1 FROM spp_log sl
            WHERE sl.santri_id = s.id
              AND sl.tahun = ? AND sl.bulan = ?
          )
          AND NOT EXISTS (
            SELECT 1 FROM spp_log sl2
            WHERE sl2.santri_id = s.id
              AND sl2.tahun = ? AND sl2.bulan = ?
          )
        THEN 1 ELSE 0 END
      ) AS bayar_tunggakan_lalu,

      COALESCE((
        SELECT SUM(sl3.nominal_bayar)
        FROM spp_log sl3
        INNER JOIN santri s2 ON s2.id = sl3.santri_id
        WHERE s2.asrama = s.asrama
          AND s2.status_global = 'aktif'
          AND sl3.tahun = ? AND sl3.bulan = ?
      ), 0) AS total_nominal

    FROM santri s
    WHERE s.status_global = 'aktif'
    GROUP BY s.asrama
    ORDER BY s.asrama
  `, [
    tahun, bulan,
    tahunSebelumnya, bulanSebelumnya,
    tahun, bulan,
    tahun, bulan,
  ])

  const setoranRows = await query<{
    asrama: string
    tanggal_terima: string
    nama_penyetor: string | null
    jumlah_aktual: number
  }>(
    `SELECT asrama, tanggal_terima, nama_penyetor, jumlah_aktual
     FROM spp_setoran WHERE tahun = ? AND bulan = ?`,
    [tahun, bulan]
  )
  const setoranMap = new Map(setoranRows.map(r => [r.asrama, r]))

  return rows.map(r => {
    const penunggak = Math.max(0, r.wajib_bayar - r.bayar_bulan_ini)
    const pct = r.wajib_bayar > 0
      ? Math.round((r.bayar_bulan_ini / r.wajib_bayar) * 100)
      : 0
    const setoran = setoranMap.get(r.asrama)
    return {
      ...r,
      penunggak,
      persentase: pct,
      tanggal_setor: setoran?.tanggal_terima ?? null,
      nama_penyetor: setoran?.nama_penyetor ?? null,
      jumlah_aktual: setoran?.jumlah_aktual ?? null,
    }
  })
}

// ─── Simpan tanggal setoran per asrama ───────────────────────────────────
export async function simpanSetoran(
  asrama: string,
  tahun: number,
  bulan: number,
  jumlahAktual: number,
  namaPenyetor: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  await batch([
    {
      sql: `DELETE FROM spp_setoran WHERE asrama = ? AND tahun = ? AND bulan = ?`,
      params: [asrama, tahun, bulan],
    },
    {
      sql: `INSERT INTO spp_setoran (id, asrama, bulan, tahun, tanggal_terima, penerima_id, jumlah_aktual, nama_penyetor)
            VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?)`,
      params: [generateId(), asrama, bulan, tahun, session?.id ?? null, jumlahAktual, namaPenyetor],
    },
  ])
  revalidatePath('/dashboard/asrama/spp/monitoring')
  return { success: true }
}

// ─── Fungsi lama — tetap untuk halaman input pembayaran ──────────────────

export async function getNominalSPP() {
  const s = await getSppSettings(new Date().getFullYear())
  return s.nominal
}

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
      AND s.bebas_spp = 0
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

export async function getDashboardSPP(tahun: number, asrama: string) {
  const currentMonth = new Date().getMonth() + 1
  const maxCheck = tahun < new Date().getFullYear() ? 12 : currentMonth
  const asramaClause = (asrama && asrama !== 'SEMUA') ? 'AND s.asrama = ?' : ''
  const params: any[] = []
  if (asrama && asrama !== 'SEMUA') params.push(asrama)
  params.push(tahun, maxCheck, tahun, currentMonth)
  const rows = await query<any>(`
    SELECT
      s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.bebas_spp,
      CAST(s.kamar AS INTEGER) AS kamar_num,
      (
        SELECT COUNT(*)
        FROM spp_log sl
        WHERE sl.santri_id = s.id AND sl.tahun = ? AND sl.bulan BETWEEN 1 AND ?
      ) AS jumlah_bayar,
      CASE WHEN EXISTS (
        SELECT 1 FROM spp_log sl2
        WHERE sl2.santri_id = s.id AND sl2.tahun = ? AND sl2.bulan = ?
      ) THEN 1 ELSE 0 END AS bulan_ini_lunas
    FROM santri s
    WHERE s.status_global = 'aktif' ${asramaClause}
    ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
  `, params)
  return rows.map((s: any) => ({
    ...s,
    bulan_ini_lunas: s.bulan_ini_lunas === 1,
    jumlah_tunggakan: s.bebas_spp ? 0 : Math.max(0, maxCheck - (s.jumlah_bayar ?? 0)),
    kamar_num: s.kamar_num || 999,
  }))
}

export async function getStatusSPP(santriId: string, tahun: number) {
  return query<any>(
    `SELECT id, bulan, tahun, nominal_bayar, tanggal_bayar FROM spp_log WHERE santri_id = ? AND tahun = ?`,
    [santriId, tahun]
  )
}

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