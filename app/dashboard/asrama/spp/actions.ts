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
  const row = await queryOne<{ nominal: number }>(
    `SELECT nominal FROM spp_settings WHERE tahun_kalender = ? AND is_active = 1 ORDER BY id DESC LIMIT 1`,
    [new Date().getFullYear()]
  )
  return row?.nominal ?? 70000
}

// ─── Ambil tanggal tutup buku dari settings ───────────────────────────────
export async function getTanggalTutupBuku(tahun: number): Promise<number> {
  const row = await queryOne<{ tanggal_tutup_buku: number }>(
    `SELECT COALESCE(tanggal_tutup_buku, 10) as tanggal_tutup_buku
     FROM spp_settings WHERE tahun_kalender = ? AND is_active = 1 ORDER BY id DESC LIMIT 1`,
    [tahun]
  )
  return row?.tanggal_tutup_buku ?? 10
}

// ─── Preview setoran: hitung siapa saja yang akan disetor ────────────────
export async function getPreviewSetoran(asrama: string, tahun: number, bulan: number) {
  const bulanSebelumnya = bulan === 1 ? 12 : bulan - 1
  const tahunSebelumnya = bulan === 1 ? tahun - 1 : tahun

  // Santri yang bayar bulan ini (bukan tunggakan)
  const bayarBulanIni = await query<{ santri_id: string; nominal_bayar: number }>(
    `SELECT sl.santri_id, sl.nominal_bayar
     FROM spp_log sl
     INNER JOIN santri s ON s.id = sl.santri_id AND s.asrama = ? AND s.status_global = 'aktif'
     WHERE sl.tahun = ? AND sl.bulan = ?`,
    [asrama, tahun, bulan]
  )

  // Santri yang bayar tunggakan bulan lalu (di bulan ini, tapi untuk bulan sebelumnya)
  const bayarTunggakan = await query<{ santri_id: string; nominal_bayar: number }>(
    `SELECT sl.santri_id, sl.nominal_bayar
     FROM spp_log sl
     INNER JOIN santri s ON s.id = sl.santri_id AND s.asrama = ? AND s.status_global = 'aktif'
     WHERE sl.tahun = ? AND sl.bulan = ?
       AND sl.santri_id NOT IN (
         SELECT santri_id FROM spp_log
         WHERE tahun = ? AND bulan = ?
           AND santri_id IN (SELECT id FROM santri WHERE asrama = ?)
       )`,
    [asrama, tahunSebelumnya, bulanSebelumnya, tahun, bulan, asrama]
  )

  const nominalBulanIni = bayarBulanIni.reduce((a, r) => a + r.nominal_bayar, 0)
  const nominalTunggakan = bayarTunggakan.reduce((a, r) => a + r.nominal_bayar, 0)

  return {
    orang_bulan_ini: bayarBulanIni.length,
    nominal_bulan_ini: nominalBulanIni,
    orang_tunggakan: bayarTunggakan.length,
    nominal_tunggakan: nominalTunggakan,
    detail_bulan_ini: bayarBulanIni,
    detail_tunggakan: bayarTunggakan,
  }
}

// ─── Setorkan SPP (buat/replace record setoran) ──────────────────────────
export async function setorkanSPP(
  asrama: string,
  tahun: number,
  bulan: number,
  namaPenyetor: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  if (!session) return { error: 'Tidak terautentikasi' }

  const preview = await getPreviewSetoran(asrama, tahun, bulan)
  const totalNominal = preview.nominal_bulan_ini + preview.nominal_tunggakan

  // Hapus setoran lama jika ada
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM spp_setoran WHERE asrama = ? AND tahun = ? AND bulan = ?`,
    [asrama, tahun, bulan]
  )

  if (existing) {
    // Hapus detail lama
    await execute(`DELETE FROM spp_setoran_detail WHERE setoran_id = ?`, [existing.id])
    // Update record
    await execute(
      `UPDATE spp_setoran SET
        nama_penyetor = ?,
        jumlah_aktual = ?,
        jumlah_sistem = ?,
        jumlah_bulan_ini = ?,
        jumlah_tunggakan_bayar = ?,
        orang_bulan_ini = ?,
        orang_tunggakan = ?,
        status = 'terkirim',
        tanggal_setor = datetime('now'),
        tanggal_terima = NULL,
        konfirmasi_bulan_ini_at = NULL,
        konfirmasi_tunggakan_at = NULL,
        aktual_bulan_ini = 0,
        aktual_tunggakan = 0
       WHERE id = ?`,
      [
        namaPenyetor, totalNominal, totalNominal,
        preview.nominal_bulan_ini, preview.nominal_tunggakan,
        preview.orang_bulan_ini, preview.orang_tunggakan,
        existing.id
      ]
    )
    // Insert detail baru
    const detailStatements = [
      ...preview.detail_bulan_ini.map(d => ({
        sql: `INSERT INTO spp_setoran_detail (id, setoran_id, santri_id, bulan_bayar, tahun_bayar, nominal, tipe)
              VALUES (?, ?, ?, ?, ?, ?, 'bulan_ini')`,
        params: [generateId(), existing.id, d.santri_id, bulan, tahun, d.nominal_bayar],
      })),
      ...preview.detail_tunggakan.map(d => ({
        sql: `INSERT INTO spp_setoran_detail (id, setoran_id, santri_id, bulan_bayar, tahun_bayar, nominal, tipe)
              VALUES (?, ?, ?, ?, ?, ?, 'tunggakan')`,
        params: [generateId(), existing.id, d.santri_id, bulan, tahun, d.nominal_bayar],
      })),
    ]
    if (detailStatements.length > 0) await batch(detailStatements)
  } else {
    const newId = generateId()
    await execute(
      `INSERT INTO spp_setoran (id, asrama, bulan, tahun, nama_penyetor, penerima_id,
        jumlah_aktual, jumlah_sistem, jumlah_bulan_ini, jumlah_tunggakan_bayar,
        orang_bulan_ini, orang_tunggakan, status, tanggal_setor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'terkirim', datetime('now'))`,
      [
        newId, asrama, bulan, tahun, namaPenyetor, session.id,
        totalNominal, totalNominal,
        preview.nominal_bulan_ini, preview.nominal_tunggakan,
        preview.orang_bulan_ini, preview.orang_tunggakan,
      ]
    )
    const detailStatements = [
      ...preview.detail_bulan_ini.map(d => ({
        sql: `INSERT INTO spp_setoran_detail (id, setoran_id, santri_id, bulan_bayar, tahun_bayar, nominal, tipe)
              VALUES (?, ?, ?, ?, ?, ?, 'bulan_ini')`,
        params: [generateId(), newId, d.santri_id, bulan, tahun, d.nominal_bayar],
      })),
      ...preview.detail_tunggakan.map(d => ({
        sql: `INSERT INTO spp_setoran_detail (id, setoran_id, santri_id, bulan_bayar, tahun_bayar, nominal, tipe)
              VALUES (?, ?, ?, ?, ?, ?, 'tunggakan')`,
        params: [generateId(), newId, d.santri_id, bulan, tahun, d.nominal_bayar],
      })),
    ]
    if (detailStatements.length > 0) await batch(detailStatements)
  }

  revalidatePath('/dashboard/asrama/spp')
  revalidatePath('/dashboard/dewan-santri/setoran')
  return { success: true }
}

// ─── Status setoran untuk asrama (ditampilkan di halaman SPP) ─────────────
export async function getStatusSetoran(asrama: string, tahun: number, bulan: number) {
  return queryOne<{
    status: string
    tanggal_setor: string | null
    nama_penyetor: string | null
    jumlah_bulan_ini: number
    jumlah_tunggakan_bayar: number
    orang_bulan_ini: number
    orang_tunggakan: number
    konfirmasi_bulan_ini_at: string | null
    konfirmasi_tunggakan_at: string | null
  }>(
    `SELECT COALESCE(status, 'belum') as status, tanggal_setor, nama_penyetor,
            COALESCE(jumlah_bulan_ini, 0) as jumlah_bulan_ini,
            COALESCE(jumlah_tunggakan_bayar, 0) as jumlah_tunggakan_bayar,
            COALESCE(orang_bulan_ini, 0) as orang_bulan_ini,
            COALESCE(orang_tunggakan, 0) as orang_tunggakan,
            konfirmasi_bulan_ini_at, konfirmasi_tunggakan_at
     FROM spp_setoran WHERE asrama = ? AND tahun = ? AND bulan = ?`,
    [asrama, tahun, bulan]
  )
}

// ─── Fungsi lama ──────────────────────────────────────────────────────────
export async function getKamarsSPP(tahun: number, asrama: string) {
  const rows = await query<{ kamar: string }>(
    `SELECT DISTINCT kamar FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
     ORDER BY CAST(kamar AS INTEGER), kamar`,
    [asrama]
  )
  return rows.map(r => r.kamar)
}

export async function getDashboardSPPKamar(tahun: number, asrama: string, kamar: string) {
  const currentMonth = new Date().getMonth() + 1
  const maxCheck = tahun < new Date().getFullYear() ? 12 : currentMonth

  const rows = await query<any>(`
    SELECT
      s.id, s.nama_lengkap, s.nis, s.asrama, s.kamar,
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
    WHERE s.status_global = 'aktif' AND s.asrama = ? AND s.kamar = ?
    ORDER BY s.nama_lengkap
  `, [tahun, maxCheck, tahun, currentMonth, asrama, kamar])

  return rows.map((s: any) => ({
    ...s,
    bulan_ini_lunas: s.bulan_ini_lunas === 1,
    jumlah_tunggakan: Math.max(0, maxCheck - (s.jumlah_bayar ?? 0)),
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

export async function getRingkasanTunggakan(asramaFilter?: string) {
  const tahun = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const asramaClause = (asramaFilter && asramaFilter !== 'SEMUA') ? 'AND s.asrama = ?' : ''
  const params: any[] = [tahun, currentMonth, currentMonth]
  if (asramaFilter && asramaFilter !== 'SEMUA') params.push(asramaFilter)
  const result = await queryOne<{ penunggak: number }>(`
    SELECT COUNT(*) AS penunggak FROM santri s
    WHERE s.status_global = 'aktif' AND s.bebas_spp = 0 ${asramaClause}
      AND (
        SELECT COUNT(DISTINCT sl.bulan) FROM spp_log sl
        WHERE sl.santri_id = s.id AND sl.tahun = ? AND sl.bulan BETWEEN 1 AND ?
      ) < ?
  `, params)
  return result?.penunggak ?? 0
}
