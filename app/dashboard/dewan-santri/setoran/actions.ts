'use server'

import { query, queryOne, execute, batch, generateId } from '@/lib/db'
import { getSession, hasAnyRole } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import { SADESA_CATEGORY, SADESA_UNIT } from '@/lib/spp/unit-setor'
import { isAsramaTanpaKamar } from '@/lib/asrama'

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
          AND tanggal_bayar IS NOT NULL
          AND CAST(strftime('%Y', tanggal_bayar) AS INTEGER) = ?
          AND CAST(strftime('%m', tanggal_bayar) AS INTEGER) = ?
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
               COUNT(DISTINCT bt.santri_id) AS jumlah_bayar,
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
    GROUP BY bs.unit_setor, nbi.nominal_bulan_ini, tu.jumlah_bayar
    ORDER BY CASE WHEN bs.unit_setor = ? THEN 1 ELSE 0 END, bs.unit_setor
  `, [
    SADESA_CATEGORY, SADESA_UNIT,
    tahun, bulan,
    tahun, bulan, tahun, bulan,
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
       AND th.tanggal_lunas IS NOT NULL
       AND CAST(strftime('%Y', th.tanggal_lunas) AS INTEGER) = ?
       AND CAST(strftime('%m', th.tanggal_lunas) AS INTEGER) = ?
       AND s.status_global = 'aktif'
       ${EXCLUDE_NON_SPP_ASRAMA_SQL.replaceAll('asrama', 's.asrama')}
     GROUP BY unit_setor`,
    [SADESA_CATEGORY, SADESA_UNIT, tahun, bulan]
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
       AND sl.tanggal_bayar IS NOT NULL
       AND CAST(strftime('%Y', sl.tanggal_bayar) AS INTEGER) = ?
       AND CAST(strftime('%m', sl.tanggal_bayar) AS INTEGER) = ?
       AND s.status_global = 'aktif'
       ${EXCLUDE_NON_SPP_ASRAMA_SQL.replaceAll('asrama', 's.asrama')}
     GROUP BY unit_setor`,
    [SADESA_CATEGORY, SADESA_UNIT, tahun, bulan, tahun, bulan]
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
        sql: `INSERT INTO spp_setoran (id, asrama, unit_setor, jenis_unit_setor, bulan, tahun, tanggal_terima, penerima_id, jumlah_aktual, nama_penyetor)
              VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
              ON CONFLICT(unit_setor, bulan, tahun) DO UPDATE SET
                asrama = excluded.asrama,
                jenis_unit_setor = excluded.jenis_unit_setor,
                tanggal_terima = excluded.tanggal_terima,
                penerima_id = excluded.penerima_id,
                jumlah_aktual = excluded.jumlah_aktual,
                nama_penyetor = excluded.nama_penyetor`,
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
        WHEN s.kategori_santri = ? THEN ?
        ELSE COALESCE(s.asrama, 'LAINNYA')
      END AS unit_setor
    FROM santri s
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
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

