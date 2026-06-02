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
  const value = row?.value ?? '2026-01'
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
  wajib_bayar: number
  bayar_bulan_ini: number
  bayar_tunggakan_lalu: number
  total_nominal: number
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
          bebas_spp,
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
      bayar_lalu AS (
        SELECT DISTINCT santri_id
        FROM spp_log
        WHERE tahun = ? AND bulan = ?
      ),
      nominal_unit AS (
        SELECT bs.unit_setor, SUM(sl.nominal_bayar) AS total_nominal
        FROM base_santri bs
        JOIN spp_log sl ON sl.santri_id = bs.id
        WHERE sl.tahun = ? AND sl.bulan = ?
        GROUP BY bs.unit_setor
      )
    SELECT
      bs.unit_setor,
      COUNT(*) AS total_santri,
      SUM(bs.bebas_spp) AS bebas_spp,
      COUNT(*) - SUM(bs.bebas_spp) AS wajib_bayar,
      SUM(CASE WHEN bs.bebas_spp = 0 AND bi.santri_id IS NOT NULL THEN 1 ELSE 0 END) AS bayar_bulan_ini,
      SUM(CASE WHEN bs.bebas_spp = 0 AND bl.santri_id IS NOT NULL AND bi.santri_id IS NULL THEN 1 ELSE 0 END) AS bayar_tunggakan_lalu,
      COALESCE(nu.total_nominal, 0) AS total_nominal
    FROM base_santri bs
    LEFT JOIN bayar_ini bi ON bi.santri_id = bs.id
    LEFT JOIN bayar_lalu bl ON bl.santri_id = bs.id
    LEFT JOIN nominal_unit nu ON nu.unit_setor = bs.unit_setor
    GROUP BY bs.unit_setor, nu.total_nominal
    ORDER BY CASE WHEN bs.unit_setor = ? THEN 1 ELSE 0 END, bs.unit_setor
  `, [
    SADESA_CATEGORY, SADESA_UNIT,
    tahun, bulan,
    tahunSebelumnya, bulanSebelumnya,
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

  return baseRows.map(r => {
    const setoran = setoranMap.get(r.unit_setor)
    const penunggak = isBeforeBillingStart ? 0 : Math.max(0, r.wajib_bayar - r.bayar_bulan_ini)
    const persentase = isBeforeBillingStart || r.wajib_bayar <= 0 ? 0 : Math.round((r.bayar_bulan_ini / r.wajib_bayar) * 100)
    return {
      unit_setor: r.unit_setor,
      total_santri: r.total_santri,
      bebas_spp: r.bebas_spp,
      wajib_bayar: isBeforeBillingStart ? 0 : r.wajib_bayar,
      bayar_bulan_ini: isBeforeBillingStart ? 0 : r.bayar_bulan_ini,
      bayar_tunggakan_lalu: isBeforeBillingStart ? 0 : r.bayar_tunggakan_lalu,
      penunggak,
      total_nominal: isBeforeBillingStart ? 0 : r.total_nominal,
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
