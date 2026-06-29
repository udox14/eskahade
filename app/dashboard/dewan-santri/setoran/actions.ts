'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession, hasAnyRole } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { SADESA_CATEGORY, SADESA_UNIT } from '@/lib/spp/unit-setor'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import { BULAN_SPP } from '@/lib/spp/tunggakan'

const EXCLUDE_NON_SPP_ASRAMA_SQL = "AND UPPER(TRIM(COALESCE(asrama, ''))) <> 'AL-BAGHORY'"

function assertMonitoringAccess(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session || !hasAnyRole(session, ['admin', 'dewan_santri'])) {
    throw new Error('Akses ditolak')
  }
}

export async function getClientRestriction() {
  const session = await getSession()
  if (!session) return null
  return null
}

export async function getSppSettings(tahun: number) {
  const row = await queryOne<{ nominal: number; tahun_kalender: number }>(
    `SELECT nominal, tahun_kalender FROM spp_settings
     WHERE tahun_kalender = ? AND is_active = 1
     ORDER BY id DESC LIMIT 1`,
    [tahun]
  )
  return row ?? { nominal: 70000, tahun_kalender: tahun }
}

export async function getSppBillingStart() {
  const row = await queryOne<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'spp_tagihan_mulai'`
  )
  const value = row?.value ?? '2026-06'
  const [tahunMulai, bulanMulai] = value.split('-').map(Number)
  return {
    tahun: Number.isFinite(tahunMulai) ? tahunMulai : 2026,
    bulan: Number.isFinite(bulanMulai) ? bulanMulai : 1,
    value,
  }
}

export async function getMonitoringPrintMeta() {
  const session = await getSession()
  assertMonitoringAccess(session)

  const tahunAjaran = await queryOne<{ nama: string }>(
    `SELECT nama
     FROM tahun_ajaran
     WHERE is_active = 1
     ORDER BY id DESC
     LIMIT 1`
  )

  return {
    tahunAjaranNama: tahunAjaran?.nama ?? null,
  }
}

export async function simpanSppBillingStart(value: string): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  try {
    assertMonitoringAccess(session)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return { error: 'Periode mulai tagihan tidak valid.' }

    await execute(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('spp_tagihan_mulai', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [value]
    )

    revalidatePath('/dashboard/dewan-santri/setoran')
    revalidatePath('/dashboard/asrama/spp')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menyimpan awal tagihan.' }
  }
}

type MonitoringRow = {
  unit_setor: string
  total_santri: number
  bebas_spp: number
  tidak_ada_tagihan: number
  wajib_bayar: number
  bayar_bulan_ini: number
  bayar_tunggakan_lalu: number
  nominal_bulan_ini: number
}

export async function getMonitoringSetoran(tahun: number, bulan: number) {
  const session = await getSession()
  assertMonitoringAccess(session)

  const billingStart = await getSppBillingStart()
  const isBeforeBillingStart = (tahun * 100 + bulan) < (billingStart.tahun * 100 + billingStart.bulan)
  const bulanSebelumnya = bulan === 1 ? 12 : bulan - 1
  const tahunSebelumnya = bulan === 1 ? tahun - 1 : tahun

  const monthStart = `${tahun}-${String(bulan).padStart(2, '0')}-01`
  const nextMo = bulan === 12 ? 1 : bulan + 1
  const nextYr = bulan === 12 ? tahun + 1 : tahun
  const monthEnd = `${nextYr}-${String(nextMo).padStart(2, '0')}-01`

  const baseRows = await query<MonitoringRow>(`
    WITH
      base_santri AS (
        SELECT
          id,
          COALESCE(bebas_spp, 0) AS bebas_spp,
          CASE
            WHEN kategori_santri = ? THEN ?
            ELSE COALESCE(asrama, 'LAINNYA')
          END AS unit_setor
        FROM santri
        WHERE status_global = 'aktif'
          ${EXCLUDE_NON_SPP_ASRAMA_SQL}
      ),
      bayar_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
      ),
      bayar_tunggakan AS (
        SELECT santri_id, COUNT(*) AS jumlah_bayar, SUM(nominal_bayar) AS total_nominal
        FROM spp_log
        WHERE (tahun * 100 + bulan) < (? * 100 + ?)
          AND tanggal_bayar >= ? AND tanggal_bayar < ?
        GROUP BY santri_id
      ),
      ditiadakan_ini AS (
        SELECT DISTINCT santri_id
        FROM spp_tagihan_ditiadakan
        WHERE tahun = ? AND bulan = ? AND is_active = 1
      ),
      nominal_bulan_ini AS (
        SELECT bs.unit_setor, SUM(sl.nominal_bayar) AS nominal_bulan_ini
        FROM base_santri bs
        JOIN spp_log sl ON sl.santri_id = bs.id
        WHERE sl.tahun = ? AND sl.bulan = ?
        GROUP BY bs.unit_setor
      ),
      tunggakan_unit AS (
        SELECT bs.unit_setor,
               SUM(bt.jumlah_bayar) AS jumlah_bayar,
               SUM(bt.total_nominal) AS total_nominal
        FROM base_santri bs
        JOIN bayar_tunggakan bt ON bt.santri_id = bs.id
        GROUP BY bs.unit_setor
      )
    SELECT
      bs.unit_setor,
      COUNT(*) AS total_santri,
      SUM(bs.bebas_spp) AS bebas_spp,
      SUM(CASE WHEN bs.bebas_spp = 0 AND di.santri_id IS NOT NULL THEN 1 ELSE 0 END) AS tidak_ada_tagihan,
      COUNT(*) - SUM(bs.bebas_spp) - SUM(CASE WHEN bs.bebas_spp = 0 AND di.santri_id IS NOT NULL THEN 1 ELSE 0 END) AS wajib_bayar,
      SUM(CASE WHEN bs.bebas_spp = 0 AND di.santri_id IS NULL AND bi.santri_id IS NOT NULL THEN 1 ELSE 0 END) AS bayar_bulan_ini,
      COALESCE(tu.jumlah_bayar, 0) AS bayar_tunggakan_lalu,
      COALESCE(nbi.nominal_bulan_ini, 0) AS nominal_bulan_ini
    FROM base_santri bs
    LEFT JOIN bayar_ini bi ON bi.santri_id = bs.id
    LEFT JOIN ditiadakan_ini di ON di.santri_id = bs.id
    LEFT JOIN nominal_bulan_ini nbi ON nbi.unit_setor = bs.unit_setor
    LEFT JOIN tunggakan_unit tu ON tu.unit_setor = bs.unit_setor
    GROUP BY bs.unit_setor
    ORDER BY CASE WHEN bs.unit_setor = ? THEN 1 ELSE 0 END, bs.unit_setor
  `, [
    SADESA_CATEGORY, SADESA_UNIT,
    tahun, bulan,
    tahun, bulan, monthStart, monthEnd,
    tahun, bulan,
    tahun, bulan,
    SADESA_UNIT,
  ])

  const setoranRows = await query<{
    effective_unit_setor: string | null
    tanggal_terima: string
    nama_penyetor: string | null
    jumlah_aktual: number
  }>(
    `SELECT COALESCE(NULLIF(TRIM(unit_setor), ''), asrama) AS effective_unit_setor,
            tanggal_terima,
            nama_penyetor,
            jumlah_aktual
     FROM spp_setoran
     WHERE tahun = ? AND bulan = ?
       AND UPPER(TRIM(COALESCE(NULLIF(TRIM(unit_setor), ''), asrama, ''))) <> 'AL-BAGHORY'`,
    [tahun, bulan]
  )
  const setoranMap = new Map(setoranRows.map(r => [r.effective_unit_setor || '', r]))
  const historisPaidRows = await query<{
    unit_setor: string
    jumlah_bayar: number
    total_nominal: number
  }>(
    `SELECT
        CASE
          WHEN s.kategori_santri = ? THEN ?
          ELSE COALESCE(s.asrama, 'LAINNYA')
        END AS unit_setor,
        COUNT(*) AS jumlah_bayar,
        COALESCE(SUM(th.nominal_tagihan), 0) AS total_nominal
     FROM spp_tunggakan_historis th
     JOIN santri s ON s.id = th.santri_id
     WHERE th.status = 'LUNAS'
       AND th.tanggal_lunas >= ? AND th.tanggal_lunas < ?
       AND s.status_global = 'aktif'
       ${EXCLUDE_NON_SPP_ASRAMA_SQL.replaceAll('asrama', 's.asrama')}
     GROUP BY unit_setor`,
    [SADESA_CATEGORY, SADESA_UNIT, monthStart, monthEnd]
  )
  const historisPaidMap = new Map(historisPaidRows.map(r => [r.unit_setor, r]))
  const tunggakanPaidRows = await query<{
    unit_setor: string
    total_nominal: number
  }>(
    `SELECT
        CASE
          WHEN s.kategori_santri = ? THEN ?
          ELSE COALESCE(s.asrama, 'LAINNYA')
        END AS unit_setor,
        COALESCE(SUM(sl.nominal_bayar), 0) AS total_nominal
     FROM spp_log sl
     JOIN santri s ON s.id = sl.santri_id
     WHERE (sl.tahun * 100 + sl.bulan) < (? * 100 + ?)
       AND sl.tanggal_bayar >= ? AND sl.tanggal_bayar < ?
       AND s.status_global = 'aktif'
       ${EXCLUDE_NON_SPP_ASRAMA_SQL.replaceAll('asrama', 's.asrama')}
     GROUP BY unit_setor`,
    [SADESA_CATEGORY, SADESA_UNIT, tahun, bulan, monthStart, monthEnd]
  )
  const tunggakanPaidMap = new Map(tunggakanPaidRows.map(r => [r.unit_setor, r.total_nominal]))

  return baseRows.map(r => {
    const setoran = setoranMap.get(r.unit_setor)
    const historisPaid = historisPaidMap.get(r.unit_setor)
    const penunggak = isBeforeBillingStart ? 0 : Math.max(0, r.wajib_bayar - r.bayar_bulan_ini)
    const persentase = isBeforeBillingStart || r.wajib_bayar <= 0 ? 0 : Math.round((r.bayar_bulan_ini / r.wajib_bayar) * 100)
    const bayarTunggakan = (isBeforeBillingStart ? 0 : r.bayar_tunggakan_lalu) + (historisPaid?.jumlah_bayar ?? 0)
    const nominalBulanIni = isBeforeBillingStart ? 0 : r.nominal_bulan_ini
    const nominalTunggakanBerjalan = isBeforeBillingStart ? 0 : (tunggakanPaidMap.get(r.unit_setor) ?? 0)
    const nominalTunggakanHistoris = historisPaid?.total_nominal ?? 0
    const totalNominal = nominalBulanIni + nominalTunggakanBerjalan + nominalTunggakanHistoris
    return {
      unit_setor: r.unit_setor,
      total_santri: r.total_santri,
      bebas_spp: r.bebas_spp,
      tidak_ada_tagihan: isBeforeBillingStart ? 0 : r.tidak_ada_tagihan,
      wajib_bayar: isBeforeBillingStart ? 0 : r.wajib_bayar,
      bayar_bulan_ini: isBeforeBillingStart ? 0 : r.bayar_bulan_ini,
      bayar_tunggakan_lalu: bayarTunggakan,
      penunggak,
      total_nominal: totalNominal,
      nominal_bulan_ini: nominalBulanIni,
      nominal_tunggakan_lalu: nominalTunggakanBerjalan + nominalTunggakanHistoris,
      nominal_tunggakan_berjalan: nominalTunggakanBerjalan,
      nominal_tunggakan_historis: nominalTunggakanHistoris,
      persentase,
      tanggal_setor: setoran?.tanggal_terima ?? null,
      nama_penyetor: setoran?.nama_penyetor ?? null,
      jumlah_aktual: setoran?.jumlah_aktual ?? null,
      belum_ada_tagihan: isBeforeBillingStart,
      is_sadesa: r.unit_setor === SADESA_UNIT,
    }
  })
}

export async function simpanSetoran(
  unitSetor: string,
  tahun: number,
  bulan: number,
  jumlahAktual: number,
  namaPenyetor: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  try {
    assertMonitoringAccess(session)
    const cleanUnit = String(unitSetor ?? '').trim().toUpperCase()
    if (!cleanUnit) return { error: 'Unit setor tidak valid.' }
    if (isAsramaTanpaKamar(cleanUnit)) {
      return { error: 'Asrama ini tidak memiliki kewajiban SPP.' }
    }

    await batch([
      {
        sql: `UPDATE spp_setoran
              SET unit_setor = asrama,
                  jenis_unit_setor = CASE
                    WHEN UPPER(TRIM(asrama)) = ? THEN 'SADESA'
                    ELSE 'ASRAMA'
                  END
              WHERE unit_setor IS NULL OR TRIM(unit_setor) = ''`,
        params: [SADESA_UNIT],
      },
      {
        sql: `INSERT INTO spp_setoran (id, asrama, unit_setor, jenis_unit_setor, bulan, tahun, tanggal_terima, penerima_id, jumlah_aktual, nama_penyetor, status)
              VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, 'dikonfirmasi')
              ON CONFLICT(unit_setor, bulan, tahun) DO UPDATE SET
                asrama = excluded.asrama,
                jenis_unit_setor = excluded.jenis_unit_setor,
                tanggal_terima = excluded.tanggal_terima,
                penerima_id = excluded.penerima_id,
                jumlah_aktual = excluded.jumlah_aktual,
                nama_penyetor = excluded.nama_penyetor,
                status = 'dikonfirmasi'`,
        params: [
          generateId(),
          cleanUnit,
          cleanUnit,
          cleanUnit === SADESA_UNIT ? 'SADESA' : 'ASRAMA',
          bulan,
          tahun,
          session?.id ?? null,
          jumlahAktual,
          namaPenyetor,
        ],
      },
    ])

    revalidatePath('/dashboard/dewan-santri/setoran')
    revalidatePath('/dashboard/asrama/status-setoran')
    revalidatePath('/dashboard/asrama/spp')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menyimpan setoran.' }
  }
}

export async function getDaftarPenunggak(tahun: number, bulan: number, unitSetor?: string) {
  const session = await getSession()
  assertMonitoringAccess(session)

  const settings = await getSppSettings(tahun)
  const nominal = settings.nominal

  const rows = await query<{
    id: string
    nama_lengkap: string
    nis: string | null
    asrama: string | null
    kamar: string | null
    bebas_spp: number
    kategori_santri: string | null
    unit_setor: string
    tunggakan_historis_bulan: number
    tunggakan_berjalan_bulan: number
    total_tunggakan_bulan: number
    total_tunggakan_nominal: number
  }>(`
    WITH
      billing_start AS (
        SELECT COALESCE(value, '2026-06') AS val FROM app_settings WHERE key = 'spp_tagihan_mulai' LIMIT 1
      ),
      consts AS (
        SELECT
          CAST(SUBSTR(val, 1, 4) AS INTEGER) AS start_yr,
          CAST(SUBSTR(val, 6, 2) AS INTEGER) AS start_mo,
          ? AS cur_yr,
          ? AS cur_mo
        FROM billing_start
      ),
      billable_calc AS (
        SELECT
          start_yr,
          start_mo,
          cur_yr,
          cur_mo,
          CASE
            WHEN (cur_yr * 100 + cur_mo) < (start_yr * 100 + start_mo) THEN 0
            ELSE (cur_yr - start_yr) * 12 + (cur_mo - start_mo) + 1
          END AS billable_months
        FROM consts
      ),
      bayar_range AS (
        SELECT sl.santri_id, COUNT(*) AS jml_bayar
        FROM spp_log sl
        CROSS JOIN billable_calc bc
        WHERE (sl.tahun * 100 + sl.bulan) BETWEEN (bc.start_yr * 100 + bc.start_mo) AND (bc.cur_yr * 100 + bc.cur_mo)
        GROUP BY sl.santri_id
      ),
      waive_range AS (
        SELECT std.santri_id, COUNT(*) AS jml_waive
        FROM spp_tagihan_ditiadakan std
        CROSS JOIN billable_calc bc
        WHERE std.is_active = 1
          AND (std.tahun * 100 + std.bulan) BETWEEN (bc.start_yr * 100 + bc.start_mo) AND (bc.cur_yr * 100 + bc.cur_mo)
        GROUP BY std.santri_id
      ),
      historis_tunggakan AS (
        SELECT santri_id, COUNT(*) AS jml_historis, SUM(nominal_tagihan) AS nominal_historis
        FROM spp_tunggakan_historis
        WHERE status = 'BELUM_LUNAS'
        GROUP BY santri_id
      ),
      santri_bill AS (
        SELECT
          s.id,
          s.nama_lengkap,
          s.nis,
          s.asrama,
          s.kamar,
          s.bebas_spp,
          s.kategori_santri,
          CASE
            WHEN s.kategori_santri = ? THEN ?
            ELSE COALESCE(s.asrama, 'LAINNYA')
          END AS unit_setor,
          COALESCE(br.jml_bayar, 0) AS jml_bayar,
          COALESCE(wr.jml_waive, 0) AS jml_waive,
          COALESCE(ht.jml_historis, 0) AS jml_historis,
          COALESCE(ht.nominal_historis, 0) AS nominal_historis,
          bc.billable_months
        FROM santri s
        CROSS JOIN billable_calc bc
        LEFT JOIN bayar_range br ON br.santri_id = s.id
        LEFT JOIN waive_range wr ON wr.santri_id = s.id
        LEFT JOIN historis_tunggakan ht ON ht.santri_id = s.id
        WHERE s.status_global = 'aktif'
          AND UPPER(TRIM(COALESCE(s.asrama, ''))) <> 'AL-BAGHORY'
      )
    SELECT
      id,
      nama_lengkap,
      nis,
      asrama,
      kamar,
      bebas_spp,
      kategori_santri,
      unit_setor,
      jml_historis AS tunggakan_historis_bulan,
      CASE
        WHEN bebas_spp = 1 THEN 0
        ELSE MAX(0, billable_months - jml_bayar - jml_waive)
      END AS tunggakan_berjalan_bulan,
      jml_historis + CASE WHEN bebas_spp = 1 THEN 0 ELSE MAX(0, billable_months - jml_bayar - jml_waive) END AS total_tunggakan_bulan,
      nominal_historis + (CASE WHEN bebas_spp = 1 THEN 0 ELSE MAX(0, billable_months - jml_bayar - jml_waive) END * ?) AS total_tunggakan_nominal
    FROM santri_bill
    WHERE (jml_historis + CASE WHEN bebas_spp = 1 THEN 0 ELSE MAX(0, billable_months - jml_bayar - jml_waive) END) > 0
    ORDER BY nama_lengkap ASC
  `, [
    tahun,
    bulan,
    SADESA_CATEGORY,
    SADESA_UNIT,
    nominal,
  ])

  if (unitSetor && unitSetor !== 'SEMUA') {
    return rows.filter(r => r.unit_setor === unitSetor)
  }
  return rows
}

export async function getDaftarBebasSpp(unitSetor?: string) {
  const session = await getSession()
  assertMonitoringAccess(session)

  const rows = await query<{
    id: string
    nama_lengkap: string
    nis: string | null
    asrama: string | null
    kamar: string | null
    sekolah: string | null
    kelas_sekolah: string | null
    kelas_pesantren: string | null
    tempat_makan: string | null
    unit_setor: string
  }>(`
    SELECT
      s.id,
      s.nama_lengkap,
      s.nis,
      s.asrama,
      s.kamar,
      COALESCE(s.sekolah, '-') AS sekolah,
      COALESCE(s.kelas_sekolah, '-') AS kelas_sekolah,
      COALESCE(k.nama_kelas, '-') AS kelas_pesantren,
      CASE
        WHEN s.tempat_makan_id IS NULL THEN 'Belum diatur'
        WHEN mj.id IS NULL THEN 'Penyedia terhapus'
        ELSE mj.nama_jasa
      END AS tempat_makan,
      CASE
        WHEN s.kategori_santri = ? THEN ?
        ELSE COALESCE(s.asrama, 'LAINNYA')
      END AS unit_setor
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    LEFT JOIN master_jasa mj ON mj.id = s.tempat_makan_id
    WHERE s.status_global = 'aktif'
      AND s.bebas_spp = 1
      ${EXCLUDE_NON_SPP_ASRAMA_SQL.replaceAll('asrama', 's.asrama')}
    ORDER BY s.nama_lengkap ASC
  `, [SADESA_CATEGORY, SADESA_UNIT])

  if (unitSetor && unitSetor !== 'SEMUA') {
    return rows.filter(r => r.unit_setor === unitSetor)
  }
  return rows
}

export async function getSppSetoranWindow(tahun: number, bulan: number) {
  const row = await queryOne<{ tanggal_mulai: string }>(
    `SELECT tanggal_mulai FROM spp_setoran_window WHERE tahun = ? AND bulan = ?`,
    [tahun, bulan]
  )
  return row?.tanggal_mulai ?? null
}

export async function simpanSppSetoranWindow(
  tahun: number,
  bulan: number,
  tanggalMulai: string
): Promise<{ success: boolean } | { error: string }> {
  const session = await getSession()
  try {
    assertMonitoringAccess(session)
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(tanggalMulai)) {
      return { error: 'Format tanggal tidak valid (YYYY-MM-DD).' }
    }
    await execute(
      `INSERT INTO spp_setoran_window (tahun, bulan, tanggal_mulai, created_by, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(tahun, bulan) DO UPDATE SET
         tanggal_mulai = excluded.tanggal_mulai,
         updated_at    = datetime('now')`,
      [tahun, bulan, tanggalMulai, session?.id ?? null]
    )
    revalidatePath('/dashboard/dewan-santri/setoran')
    revalidatePath('/dashboard/asrama/spp')
    return { success: true }
  } catch (error: any) {
    return { error: error?.message || 'Gagal menyimpan tanggal mulai setoran.' }
  }
}

export async function getPenunggakExportData(
  targetTahun: number,
  targetBulan: number,
  selectedAsrama: string,
  periodeFilter: 'BULAN_INI' | 'SEMUA_BULAN'
) {
  const session = await getSession()
  assertMonitoringAccess(session)

  const billingStart = await getSppBillingStart()
  const targetYm = targetTahun * 100 + targetBulan

  let asramaSql = ''
  let extraParams: any[] = []
  if (selectedAsrama && selectedAsrama !== 'SEMUA') {
    asramaSql = `
      AND (
        CASE
          WHEN s.kategori_santri = ? THEN ?
          ELSE COALESCE(s.asrama, 'LAINNYA')
        END
      ) = ?
    `
    extraParams = [SADESA_CATEGORY, SADESA_UNIT, selectedAsrama]
  }

  const rows = await query<any>(`
    SELECT
      s.id,
      s.nama_lengkap,
      s.asrama,
      s.kamar,
      COALESCE(s.sekolah, '-') AS sekolah,
      COALESCE(s.kelas_sekolah, '-') AS kelas_sekolah,
      COALESCE(k.nama_kelas, '-') AS kelas_pesantren,
      s.bebas_spp,
      s.kategori_santri,
      CASE
        WHEN s.kategori_santri = ? THEN ?
        ELSE COALESCE(s.asrama, 'LAINNYA')
      END AS unit_setor
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
    WHERE s.status_global = 'aktif'
      AND UPPER(TRIM(COALESCE(s.asrama, ''))) <> 'AL-BAGHORY'
      ${asramaSql}
  `, [SADESA_CATEGORY, SADESA_UNIT, ...extraParams])

  if (rows.length === 0) return []

  const payments = await query<any>(`
    SELECT sl.santri_id, sl.tahun, sl.bulan
    FROM spp_log sl
    INNER JOIN santri s ON s.id = sl.santri_id
    WHERE (sl.tahun * 100 + sl.bulan) <= ?
      AND s.status_global = 'aktif'
      AND UPPER(TRIM(COALESCE(s.asrama, ''))) <> 'AL-BAGHORY'
      ${asramaSql}
  `, [targetYm, ...extraParams])

  const paymentsMap = new Map<string, Set<string>>()
  payments.forEach(p => {
    if (!paymentsMap.has(p.santri_id)) {
      paymentsMap.set(p.santri_id, new Set())
    }
    paymentsMap.get(p.santri_id)!.add(`${p.tahun}-${p.bulan}`)
  })

  const waives = await query<any>(`
    SELECT std.santri_id, std.tahun, std.bulan
    FROM spp_tagihan_ditiadakan std
    INNER JOIN santri s ON s.id = std.santri_id
    WHERE std.is_active = 1
      AND (std.tahun * 100 + std.bulan) <= ?
      AND s.status_global = 'aktif'
      AND UPPER(TRIM(COALESCE(s.asrama, ''))) <> 'AL-BAGHORY'
      ${asramaSql}
  `, [targetYm, ...extraParams])

  const waivesMap = new Map<string, Set<string>>()
  waives.forEach(w => {
    if (!waivesMap.has(w.santri_id)) {
      waivesMap.set(w.santri_id, new Set())
    }
    waivesMap.get(w.santri_id)!.add(`${w.tahun}-${w.bulan}`)
  })

  const historis = await query<any>(`
    SELECT sth.santri_id, sth.tahun, sth.bulan
    FROM spp_tunggakan_historis sth
    INNER JOIN santri s ON s.id = sth.santri_id
    WHERE sth.status = 'BELUM_LUNAS'
      AND s.status_global = 'aktif'
      AND UPPER(TRIM(COALESCE(s.asrama, ''))) <> 'AL-BAGHORY'
      ${asramaSql}
  `, extraParams)

  const historisMap = new Map<string, { tahun: number; bulan: number }[]>()
  historis.forEach(h => {
    if (!historisMap.has(h.santri_id)) {
      historisMap.set(h.santri_id, [])
    }
    historisMap.get(h.santri_id)!.push({ tahun: h.tahun, bulan: h.bulan })
  })

  const result: any[] = []

  const allBerjalanMonths: { tahun: number; bulan: number }[] = []
  let currYr = billingStart.tahun
  let currMo = billingStart.bulan
  while ((currYr * 100 + currMo) <= targetYm) {
    allBerjalanMonths.push({ tahun: currYr, bulan: currMo })
    currMo++
    if (currMo > 12) {
      currMo = 1
      currYr++
    }
  }

  rows.forEach(s => {
    const studentUnpaid: { tahun: number; bulan: number }[] = []

    const histList = historisMap.get(s.id) ?? []
    histList.forEach(h => studentUnpaid.push(h))

    if (s.bebas_spp !== 1) {
      const studentPayments = paymentsMap.get(s.id) ?? new Set<string>()
      const studentWaives = waivesMap.get(s.id) ?? new Set<string>()

      allBerjalanMonths.forEach(m => {
        const key = `${m.tahun}-${m.bulan}`
        if (!studentPayments.has(key) && !studentWaives.has(key)) {
          studentUnpaid.push(m)
        }
      })
    }

    if (studentUnpaid.length > 0) {
      if (periodeFilter === 'BULAN_INI') {
        const hasCurrentMonthUnpaid = studentUnpaid.some(
          m => m.tahun === targetTahun && m.bulan === targetBulan
        )
        if (!hasCurrentMonthUnpaid) return
      }

      result.push({
        ...s,
        unpaidMonths: studentUnpaid,
      })
    }
  })

  return result
}

// ===========================================================================
// REKAP SETORAN KEUANGAN SPP ASRAMA — laporan per-asrama (PDF F4 landscape)
// Snapshot-cached: cetak ulang baca payload tersimpan selama data tak berubah.
// ===========================================================================

export type RekapAsramaPayload = {
  meta: {
    unit_setor: string
    nama_asrama: string
    tahun: number
    bulan: number
    nama_bulan: string
    tahun_ajaran_nama: string | null
    tarif: number
    generated_at: string
  }
  penduduk_kamar: { nomor_kamar: string; jumlah: number }[]
  digratiskan: { nama: string; kamar: string | null; ket: string }[]
  penunggak: { nama: string; kamar: string | null; tunggakan_label: string }[]
  mutasi: { nama: string; kamar: string | null; ket: string }[]
  ringkasan: {
    jumlah_penduduk: number
    jml_gratis: number
    jml_wajib_bayar: number
    jml_penunggak: number
    jml_bayar: number
    tarif: number
    total: number
    bayar_tunggakan_bln_lalu: number
    tanggal_stor: string | null
    nama_penyetor: string | null
  }
}

type SetoranGateRow = {
  status: string | null
  tanggal_terima: string | null
  nama_penyetor: string | null
  jumlah_aktual: number | null
  orang_tunggakan: number | null
}

function tunggakanRangeLabel(months: { tahun: number; bulan: number }[], tahunLaporan: number): string {
  if (months.length === 0) return '-'
  const sorted = [...months].sort((a, b) => (a.tahun * 100 + a.bulan) - (b.tahun * 100 + b.bulan))
  const fmt = (m: { tahun: number; bulan: number }) => {
    const nama = BULAN_SPP[m.bulan - 1] ?? `Bulan ${m.bulan}`
    return m.tahun === tahunLaporan ? nama : `${nama} ${m.tahun}`
  }
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (sorted.length === 1) return fmt(first)
  return `${fmt(first)} - ${fmt(last)}`
}

async function buildRekapAsramaPayload(
  unitSetor: string,
  tahun: number,
  bulan: number,
  setoran: SetoranGateRow | null,
  generatedAt: string
): Promise<RekapAsramaPayload> {
  const targetYm = tahun * 100 + bulan
  const monthStart = `${tahun}-${String(bulan).padStart(2, '0')}-01`
  const nextMo = bulan === 12 ? 1 : bulan + 1
  const nextYr = bulan === 12 ? tahun + 1 : tahun
  const monthEnd = `${nextYr}-${String(nextMo).padStart(2, '0')}-01`

  const settings = await getSppSettings(tahun)
  const tarif = settings.nominal
  const billingStart = await getSppBillingStart()
  const tahunAjaran = await queryOne<{ nama: string }>(
    `SELECT nama FROM tahun_ajaran WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
  )

  // --- Penduduk per kamar (fisik, semua santri aktif di asrama) ---
  const pendudukKamar = await query<{ nomor_kamar: string; jumlah: number }>(
    `SELECT kamar.nomor_kamar, COUNT(s.id) AS jumlah
     FROM (
       SELECT nomor_kamar FROM kamar_config WHERE asrama = ?
       UNION
       SELECT TRIM(kamar) AS nomor_kamar
       FROM santri
       WHERE status_global = 'aktif' AND asrama = ?
         AND COALESCE(kategori_santri, '') <> ?
         AND kamar IS NOT NULL AND TRIM(kamar) <> ''
     ) kamar
     LEFT JOIN santri s
       ON s.asrama = ? AND s.status_global = 'aktif'
      AND COALESCE(s.kategori_santri, '') <> ?
      AND TRIM(COALESCE(s.kamar, '')) = kamar.nomor_kamar
     GROUP BY kamar.nomor_kamar
     ORDER BY CAST(kamar.nomor_kamar AS INTEGER), kamar.nomor_kamar`,
    [unitSetor, unitSetor, SADESA_CATEGORY, unitSetor, SADESA_CATEGORY]
  )

  // --- Daftar santri aktif (untuk hitung penduduk, gratis, penunggak) ---
  const santriList = await query<{ id: string; nama_lengkap: string; kamar: string | null; bebas_spp: number }>(
    `SELECT id, nama_lengkap, kamar, COALESCE(bebas_spp, 0) AS bebas_spp
     FROM santri
     WHERE status_global = 'aktif' AND asrama = ?
       AND COALESCE(kategori_santri, '') <> ?`,
    [unitSetor, SADESA_CATEGORY]
  )
  const jumlahPenduduk = santriList.length

  // --- Tagihan ditiadakan bulan ini (non bebas) ---
  const ditiadakanRows = await query<{ santri_id: string; nama_lengkap: string; kamar: string | null }>(
    `SELECT d.santri_id, s.nama_lengkap, s.kamar
     FROM spp_tagihan_ditiadakan d
     JOIN santri s ON s.id = d.santri_id
     WHERE d.is_active = 1 AND d.tahun = ? AND d.bulan = ?
       AND s.status_global = 'aktif' AND s.asrama = ? AND COALESCE(s.bebas_spp, 0) = 0
       AND COALESCE(s.kategori_santri, '') <> ?`,
    [tahun, bulan, unitSetor, SADESA_CATEGORY]
  )
  const ditiadakanSet = new Set(ditiadakanRows.map(r => r.santri_id))

  // --- Daftar digratiskan = bebas_spp (KET Bebas) + ditiadakan bulan ini (KET Ditiadakan) ---
  const digratiskan: RekapAsramaPayload['digratiskan'] = [
    ...santriList
      .filter(s => s.bebas_spp === 1)
      .map(s => ({ nama: s.nama_lengkap, kamar: s.kamar, ket: 'Bebas' })),
    ...ditiadakanRows.map(r => ({ nama: r.nama_lengkap, kamar: r.kamar, ket: 'Ditiadakan' })),
  ].sort((a, b) => a.nama.localeCompare(b.nama))
  const jmlGratis = digratiskan.length
  const jmlWajibBayar = Math.max(0, jumlahPenduduk - jmlGratis)

  // --- Pembayaran, waive, historis (scope asrama) untuk hitung penunggak ---
  const payments = await query<{ santri_id: string; tahun: number; bulan: number }>(
    `SELECT sl.santri_id, sl.tahun, sl.bulan
     FROM spp_log sl JOIN santri s ON s.id = sl.santri_id
     WHERE s.asrama = ? AND s.status_global = 'aktif'
       AND COALESCE(s.kategori_santri, '') <> ?
       AND (sl.tahun * 100 + sl.bulan) <= ?`,
    [unitSetor, SADESA_CATEGORY, targetYm]
  )
  const paymentsMap = new Map<string, Set<number>>()
  payments.forEach(p => {
    if (!paymentsMap.has(p.santri_id)) paymentsMap.set(p.santri_id, new Set())
    paymentsMap.get(p.santri_id)!.add(p.tahun * 100 + p.bulan)
  })

  const waives = await query<{ santri_id: string; tahun: number; bulan: number }>(
    `SELECT std.santri_id, std.tahun, std.bulan
     FROM spp_tagihan_ditiadakan std JOIN santri s ON s.id = std.santri_id
     WHERE s.asrama = ? AND s.status_global = 'aktif' AND std.is_active = 1
       AND COALESCE(s.kategori_santri, '') <> ?
       AND (std.tahun * 100 + std.bulan) <= ?`,
    [unitSetor, SADESA_CATEGORY, targetYm]
  )
  const waivesMap = new Map<string, Set<number>>()
  waives.forEach(w => {
    if (!waivesMap.has(w.santri_id)) waivesMap.set(w.santri_id, new Set())
    waivesMap.get(w.santri_id)!.add(w.tahun * 100 + w.bulan)
  })

  const historis = await query<{ santri_id: string; tahun: number; bulan: number }>(
    `SELECT th.santri_id, th.tahun, th.bulan
     FROM spp_tunggakan_historis th JOIN santri s ON s.id = th.santri_id
     WHERE s.asrama = ? AND s.status_global = 'aktif' AND th.status = 'BELUM_LUNAS'
       AND COALESCE(s.kategori_santri, '') <> ?`,
    [unitSetor, SADESA_CATEGORY]
  )
  const historisMap = new Map<string, { tahun: number; bulan: number }[]>()
  historis.forEach(h => {
    if (!historisMap.has(h.santri_id)) historisMap.set(h.santri_id, [])
    historisMap.get(h.santri_id)!.push({ tahun: h.tahun, bulan: h.bulan })
  })

  // Bulan tagihan berjalan dari awal tagihan s/d periode laporan
  const berjalanMonths: { tahun: number; bulan: number }[] = []
  let curYr = billingStart.tahun
  let curMo = billingStart.bulan
  while ((curYr * 100 + curMo) <= targetYm) {
    berjalanMonths.push({ tahun: curYr, bulan: curMo })
    curMo++
    if (curMo > 12) { curMo = 1; curYr++ }
  }

  // Penunggak = santri wajib bayar yang BELUM bayar bulan ini (selaras rincian stor),
  // daftar memuat rincian seluruh bulan tunggakannya.
  const penunggak: RekapAsramaPayload['penunggak'] = []
  for (const s of santriList) {
    if (s.bebas_spp === 1) continue
    if (ditiadakanSet.has(s.id)) continue
    const paid = paymentsMap.get(s.id) ?? new Set<number>()
    const waived = waivesMap.get(s.id) ?? new Set<number>()
    const currentUnpaid = !paid.has(targetYm) && !waived.has(targetYm)
    if (!currentUnpaid) continue
    const unpaid: { tahun: number; bulan: number }[] = [...(historisMap.get(s.id) ?? [])]
    berjalanMonths.forEach(m => {
      const key = m.tahun * 100 + m.bulan
      if (!paid.has(key) && !waived.has(key)) unpaid.push(m)
    })
    penunggak.push({
      nama: s.nama_lengkap,
      kamar: s.kamar,
      tunggakan_label: tunggakanRangeLabel(unpaid, tahun),
    })
  }
  penunggak.sort((a, b) => a.nama.localeCompare(b.nama))
  const jmlPenunggak = penunggak.length
  const jmlBayar = Math.max(0, jmlWajibBayar - jmlPenunggak)

  // --- Mutasi: santri keluar bulan ini ---
  const mutasiRows = await query<{ nama_lengkap: string; kamar: string | null }>(
    `SELECT nama_lengkap, kamar
     FROM santri
     WHERE asrama = ? AND status_global = 'keluar'
       AND COALESCE(kategori_santri, '') <> ?
       AND tanggal_keluar IS NOT NULL
       AND tanggal_keluar >= ? AND tanggal_keluar < ?
     ORDER BY nama_lengkap ASC`,
    [unitSetor, SADESA_CATEGORY, monthStart, monthEnd]
  )
  const mutasi = mutasiRows.map(r => ({ nama: r.nama_lengkap, kamar: r.kamar, ket: 'Keluar' }))

  return {
    meta: {
      unit_setor: unitSetor,
      nama_asrama: unitSetor,
      tahun,
      bulan,
      nama_bulan: BULAN_SPP[bulan - 1] ?? `Bulan ${bulan}`,
      tahun_ajaran_nama: tahunAjaran?.nama ?? null,
      tarif,
      generated_at: generatedAt,
    },
    penduduk_kamar: pendudukKamar,
    digratiskan,
    penunggak,
    mutasi,
    ringkasan: {
      jumlah_penduduk: jumlahPenduduk,
      jml_gratis: jmlGratis,
      jml_wajib_bayar: jmlWajibBayar,
      jml_penunggak: jmlPenunggak,
      jml_bayar: jmlBayar,
      tarif,
      total: jmlBayar * tarif,
      bayar_tunggakan_bln_lalu: setoran?.orang_tunggakan ?? 0,
      tanggal_stor: setoran?.tanggal_terima ?? null,
      nama_penyetor: setoran?.nama_penyetor ?? null,
    },
  }
}

async function computeRekapSignature(
  unitSetor: string,
  tahun: number,
  bulan: number,
  setoran: SetoranGateRow | null
): Promise<string> {
  const targetYm = tahun * 100 + bulan
  const settings = await getSppSettings(tahun)
  const billingStart = await getSppBillingStart()

  const santriSig = await queryOne<{ c: number; m: string | null }>(
    `SELECT COUNT(*) AS c, MAX(updated_at) AS m
     FROM santri WHERE asrama = ? AND status_global IN ('aktif','keluar')
       AND COALESCE(kategori_santri, '') <> ?`,
    [unitSetor, SADESA_CATEGORY]
  )
  const logSig = await queryOne<{ c: number; m: string | null }>(
    `SELECT COUNT(*) AS c, MAX(sl.tanggal_bayar) AS m
     FROM spp_log sl JOIN santri s ON s.id = sl.santri_id
     WHERE s.asrama = ? AND COALESCE(s.kategori_santri, '') <> ?
       AND (sl.tahun * 100 + sl.bulan) <= ?`,
    [unitSetor, SADESA_CATEGORY, targetYm]
  )
  const ditSig = await queryOne<{ c: number; m: string | null }>(
    `SELECT COUNT(*) AS c, MAX(d.updated_at) AS m
     FROM spp_tagihan_ditiadakan d JOIN santri s ON s.id = d.santri_id
     WHERE s.asrama = ? AND d.is_active = 1 AND COALESCE(s.kategori_santri, '') <> ?`,
    [unitSetor, SADESA_CATEGORY]
  )
  const histSig = await queryOne<{ c: number; m: string | null }>(
    `SELECT COUNT(*) AS c, MAX(h.updated_at) AS m
     FROM spp_tunggakan_historis h JOIN santri s ON s.id = h.santri_id
     WHERE s.asrama = ? AND COALESCE(s.kategori_santri, '') <> ?`,
    [unitSetor, SADESA_CATEGORY]
  )

  return [
    `tarif:${settings.nominal}`,
    `start:${billingStart.value}`,
    `santri:${santriSig?.c ?? 0}/${santriSig?.m ?? ''}`,
    `log:${logSig?.c ?? 0}/${logSig?.m ?? ''}`,
    `dit:${ditSig?.c ?? 0}/${ditSig?.m ?? ''}`,
    `hist:${histSig?.c ?? 0}/${histSig?.m ?? ''}`,
    `setor:${setoran?.status ?? ''}|${setoran?.tanggal_terima ?? ''}|${setoran?.nama_penyetor ?? ''}|${setoran?.jumlah_aktual ?? ''}|${setoran?.orang_tunggakan ?? ''}`,
  ].join(';')
}

export async function getRekapAsramaSnapshot(
  unitSetor: string,
  tahun: number,
  bulan: number
): Promise<{ payload: RekapAsramaPayload; cached: boolean } | { error: string }> {
  const session = await getSession()
  try {
    assertMonitoringAccess(session)
    const cleanUnit = String(unitSetor ?? '').trim().toUpperCase()
    if (!cleanUnit) return { error: 'Unit setor tidak valid.' }
    if (isAsramaTanpaKamar(cleanUnit)) {
      return { error: 'Asrama ini tidak memiliki kewajiban SPP.' }
    }

    // Gate: setoran harus ada & dikonfirmasi
    const setoran = await queryOne<SetoranGateRow>(
      `SELECT status, tanggal_terima, nama_penyetor, jumlah_aktual, orang_tunggakan
       FROM spp_setoran
       WHERE tahun = ? AND bulan = ?
         AND UPPER(TRIM(COALESCE(NULLIF(TRIM(unit_setor), ''), asrama, ''))) = ?
       LIMIT 1`,
      [tahun, bulan, cleanUnit]
    )
    if (!setoran || setoran.status !== 'dikonfirmasi') {
      return { error: 'Laporan hanya bisa dicetak setelah setoran dikonfirmasi di Monitoring SPP.' }
    }

    const signature = await computeRekapSignature(cleanUnit, tahun, bulan, setoran)

    const existing = await queryOne<{ source_signature: string; payload_json: string }>(
      `SELECT source_signature, payload_json FROM spp_rekap_snapshot
       WHERE unit_setor = ? AND tahun = ? AND bulan = ?`,
      [cleanUnit, tahun, bulan]
    )
    if (existing && existing.source_signature === signature) {
      return { payload: JSON.parse(existing.payload_json) as RekapAsramaPayload, cached: true }
    }

    const generatedAt = new Date().toISOString()
    const payload = await buildRekapAsramaPayload(cleanUnit, tahun, bulan, setoran, generatedAt)

    await execute(
      `INSERT INTO spp_rekap_snapshot (unit_setor, tahun, bulan, source_signature, payload_json, generated_by, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(unit_setor, tahun, bulan) DO UPDATE SET
         source_signature = excluded.source_signature,
         payload_json     = excluded.payload_json,
         generated_by     = excluded.generated_by,
         generated_at     = excluded.generated_at`,
      [cleanUnit, tahun, bulan, signature, JSON.stringify(payload), session?.id ?? null, generatedAt]
    )

    return { payload, cached: false }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membuat laporan rekap.' }
  }
}

