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
  const row = await queryOne<{ nominal: number; tahun_kalender: number; tanggal_tutup_buku: number }>(
    `SELECT nominal, tahun_kalender, COALESCE(tanggal_tutup_buku, 10) as tanggal_tutup_buku
     FROM spp_settings WHERE tahun_kalender = ? AND is_active = 1
     ORDER BY id DESC LIMIT 1`,
    [tahun]
  )
  return row ?? { nominal: 70000, tahun_kalender: tahun, tanggal_tutup_buku: 10 }
}

// ─── Update tanggal tutup buku ────────────────────────────────────────────
export async function updateTanggalTutupBuku(tahun: number, tanggal: number): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session || !['admin', 'dewan_santri', 'bendahara'].includes(session.role)) {
    return { error: 'Akses ditolak' }
  }
  // Cek apakah settings untuk tahun ini sudah ada
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM spp_settings WHERE tahun_kalender = ? AND is_active = 1 LIMIT 1`,
    [tahun]
  )
  if (existing) {
    await execute(
      `UPDATE spp_settings SET tanggal_tutup_buku = ? WHERE tahun_kalender = ? AND is_active = 1`,
      [tanggal, tahun]
    )
  } else {
    await execute(
      `INSERT INTO spp_settings (tahun_kalender, nominal, is_active, tanggal_tutup_buku) VALUES (?, 70000, 1, ?)`,
      [tahun, tanggal]
    )
  }
  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}

// ─── Monitoring setoran per asrama ───────────────────────────────────────
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
    WITH
      bayar_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
      ),
      bayar_lalu AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
      ),
      nominal_asrama AS (
        SELECT s2.asrama, SUM(sl.nominal_bayar) AS total_nominal
        FROM spp_log sl
        INNER JOIN santri s2 ON s2.id = sl.santri_id AND s2.status_global = 'aktif'
        WHERE sl.tahun = ? AND sl.bulan = ?
        GROUP BY s2.asrama
      )
    SELECT
      s.asrama,
      COUNT(*)                                                                          AS total_santri,
      SUM(s.bebas_spp)                                                                  AS bebas_spp,
      COUNT(*) - SUM(s.bebas_spp)                                                       AS wajib_bayar,
      SUM(CASE WHEN s.bebas_spp = 0 AND bi.santri_id IS NOT NULL THEN 1 ELSE 0 END)    AS bayar_bulan_ini,
      SUM(CASE WHEN s.bebas_spp = 0 AND bl.santri_id IS NOT NULL
                                    AND bi.santri_id IS NULL  THEN 1 ELSE 0 END)        AS bayar_tunggakan_lalu,
      COALESCE(na.total_nominal, 0)                                                     AS total_nominal
    FROM santri s
    LEFT JOIN bayar_ini      bi ON bi.santri_id = s.id
    LEFT JOIN bayar_lalu     bl ON bl.santri_id = s.id
    LEFT JOIN nominal_asrama na ON na.asrama    = s.asrama
    WHERE s.status_global = 'aktif'
    GROUP BY s.asrama, na.total_nominal
    ORDER BY s.asrama
  `, [
    tahun, bulan,
    tahunSebelumnya, bulanSebelumnya,
    tahun, bulan,
  ])

  // Ambil data setoran yang sudah dikirim pengurus
  const setoranRows = await query<{
    asrama: string
    tanggal_setor: string | null
    tanggal_terima: string | null
    nama_penyetor: string | null
    jumlah_aktual: number
    jumlah_bulan_ini: number
    jumlah_tunggakan_bayar: number
    orang_bulan_ini: number
    orang_tunggakan: number
    status: string
    konfirmasi_bulan_ini_at: string | null
    konfirmasi_tunggakan_at: string | null
    aktual_bulan_ini: number
    aktual_tunggakan: number
  }>(
    `SELECT asrama, tanggal_setor, tanggal_terima, nama_penyetor, jumlah_aktual,
            COALESCE(jumlah_bulan_ini, 0) as jumlah_bulan_ini,
            COALESCE(jumlah_tunggakan_bayar, 0) as jumlah_tunggakan_bayar,
            COALESCE(orang_bulan_ini, 0) as orang_bulan_ini,
            COALESCE(orang_tunggakan, 0) as orang_tunggakan,
            COALESCE(status, 'terkirim') as status,
            konfirmasi_bulan_ini_at, konfirmasi_tunggakan_at,
            COALESCE(aktual_bulan_ini, 0) as aktual_bulan_ini,
            COALESCE(aktual_tunggakan, 0) as aktual_tunggakan
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
      tanggal_setor: setoran?.tanggal_setor ?? null,
      tanggal_terima: setoran?.tanggal_terima ?? null,
      nama_penyetor: setoran?.nama_penyetor ?? null,
      jumlah_aktual: setoran?.jumlah_aktual ?? null,
      jumlah_bulan_ini: setoran?.jumlah_bulan_ini ?? 0,
      jumlah_tunggakan_bayar: setoran?.jumlah_tunggakan_bayar ?? 0,
      orang_bulan_ini: setoran?.orang_bulan_ini ?? 0,
      orang_tunggakan: setoran?.orang_tunggakan ?? 0,
      status_setoran: setoran?.status ?? null,
      konfirmasi_bulan_ini_at: setoran?.konfirmasi_bulan_ini_at ?? null,
      konfirmasi_tunggakan_at: setoran?.konfirmasi_tunggakan_at ?? null,
      aktual_bulan_ini: setoran?.aktual_bulan_ini ?? 0,
      aktual_tunggakan: setoran?.aktual_tunggakan ?? 0,
    }
  })
}

// ─── Konfirmasi terima setoran (bulan ini atau tunggakan) ─────────────────
export async function konfirmasiSetoran(
  asrama: string,
  tahun: number,
  bulan: number,
  tipe: 'bulan_ini' | 'tunggakan',
  jumlahAktual: number
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM spp_setoran WHERE asrama = ? AND tahun = ? AND bulan = ?`,
    [asrama, tahun, bulan]
  )
  if (!existing) return { error: 'Data setoran tidak ditemukan' }

  if (tipe === 'bulan_ini') {
    await execute(
      `UPDATE spp_setoran SET
        aktual_bulan_ini = ?,
        konfirmasi_bulan_ini_by = ?,
        konfirmasi_bulan_ini_at = datetime('now'),
        tanggal_terima = datetime('now'),
        status = CASE WHEN konfirmasi_tunggakan_at IS NOT NULL THEN 'dikonfirmasi' ELSE status END
       WHERE id = ?`,
      [jumlahAktual, session.id, existing.id]
    )
  } else {
    await execute(
      `UPDATE spp_setoran SET
        aktual_tunggakan = ?,
        konfirmasi_tunggakan_by = ?,
        konfirmasi_tunggakan_at = datetime('now'),
        tanggal_terima = datetime('now'),
        status = CASE WHEN konfirmasi_bulan_ini_at IS NOT NULL THEN 'dikonfirmasi' ELSE status END
       WHERE id = ?`,
      [jumlahAktual, session.id, existing.id]
    )
  }

  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}

// ─── Simpan setoran manual (legacy / fallback) ───────────────────────────
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
      sql: `INSERT INTO spp_setoran (id, asrama, bulan, tahun, tanggal_terima, penerima_id, jumlah_aktual, nama_penyetor, status, tanggal_setor)
            VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, 'dikonfirmasi', datetime('now'))`,
      params: [generateId(), asrama, bulan, tahun, session?.id ?? null, jumlahAktual, namaPenyetor],
    },
  ])
  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}

// ─── Daftar penunggak bulan tertentu ─────────────────────────────────────
export async function getDaftarPenunggak(
  tahun: number,
  bulan: number,
  asramaFilter?: string,
  kamarFilter?: string
) {
  const params: any[] = [tahun, bulan]
  let asramaClause = ''
  let kamarClause = ''

  if (asramaFilter && asramaFilter !== 'SEMUA') {
    asramaClause = 'AND s.asrama = ?'
    params.push(asramaFilter)
  }
  if (kamarFilter && kamarFilter !== 'SEMUA') {
    kamarClause = 'AND s.kamar = ?'
    params.push(kamarFilter)
  }

  const rows = await query<{
    id: string
    nama_lengkap: string
    nis: string
    asrama: string
    kamar: string
    sekolah: string | null
    kelas_sekolah: string | null
    nama_kelas: string | null
    marhalah_nama: string | null
    alasan: string | null
  }>(`
    SELECT
      s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
      s.sekolah, s.kelas_sekolah,
      k.nama_kelas,
      m.nama AS marhalah_nama,
      ta.alasan
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN marhalah m ON m.id = k.marhalah_id
    LEFT JOIN spp_tunggakan_alasan ta ON ta.santri_id = s.id AND ta.bulan = ? AND ta.tahun = ?
    WHERE s.status_global = 'aktif'
      AND s.bebas_spp = 0
      ${asramaClause}
      ${kamarClause}
      AND NOT EXISTS (
        SELECT 1 FROM spp_log sl
        WHERE sl.santri_id = s.id AND sl.tahun = ? AND sl.bulan = ?
      )
    ORDER BY s.asrama, CAST(s.kamar AS INTEGER), s.kamar, s.nama_lengkap
  `, [bulan, tahun, ...params.slice(2), tahun, bulan])

  return rows
}

// ─── Daftar asrama untuk filter ──────────────────────────────────────────
export async function getAsramaList() {
  const rows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama FROM santri WHERE status_global = 'aktif' AND asrama IS NOT NULL ORDER BY asrama`
  )
  return rows.map(r => r.asrama)
}

// ─── Daftar kamar per asrama untuk filter ────────────────────────────────
export async function getKamarList(asrama: string) {
  const rows = await query<{ kamar: string }>(
    `SELECT DISTINCT kamar FROM santri WHERE status_global = 'aktif' AND asrama = ? ORDER BY CAST(kamar AS INTEGER), kamar`,
    [asrama]
  )
  return rows.map(r => r.kamar)
}

// ─── Simpan/update alasan penunggak ──────────────────────────────────────
export async function simpanAlasanPenunggak(
  santriId: string,
  tahun: number,
  bulan: number,
  alasan: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  await execute(
    `INSERT INTO spp_tunggakan_alasan (id, santri_id, bulan, tahun, alasan, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(santri_id, bulan, tahun) DO UPDATE SET
       alasan = excluded.alasan,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at`,
    [generateId(), santriId, bulan, tahun, alasan, session.id]
  )
  return { success: true }
}

// ─── Fungsi lama ──────────────────────────────────────────────────────────
export async function getNominalSPP() {
  const s = await getSppSettings(new Date().getFullYear())
  return s.nominal
}

export async function getStatusSPP(santriId: string, tahun: number) {
  return query<any>(
    `SELECT id, bulan, tahun, nominal_bayar, tanggal_bayar FROM spp_log WHERE santri_id = ? AND tahun = ?`,
    [santriId, tahun]
  )
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
