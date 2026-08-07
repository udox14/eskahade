import { financeQuery, query } from '@/lib/db'
import { currentMonthWib, monthPeriod, safeNumber, type MonthPeriod } from './helpers'

export type KeuanganMonitoring = {
  period: MonthPeriod
  saldoAkun: Array<{ code: string; name: string; balance_rupiah: number }>
  totalSaldo: number
  arusKasBulan: { masuk: number; keluar: number; selisih: number }
  alert: Array<{ kind: string; label: string; count: number; amount_rupiah: number }>
  spp: {
    santri_belum_lunas: number
    estimasi_nominal: number
    nominal_spp: number
    transaksi_bulan: number
    total_bayar_bulan: number
  }
  psbBulan: { transaksi: number; total_bayar: number }
}

async function getSaldoAkun(): Promise<Array<{ code: string; name: string; balance_rupiah: number }>> {
  try {
    return await financeQuery<{ code: string; name: string; balance_rupiah: number }>(
      `SELECT a.code, a.name, COALESCE(b.balance_rupiah, 0) AS balance_rupiah
       FROM finance_accounts a
       LEFT JOIN finance_account_balances b ON b.account_id = a.id
       WHERE a.is_active = 1
       ORDER BY a.code`
    )
  } catch {
    return []
  }
}

async function getArusKas(period: MonthPeriod): Promise<{ masuk: number; keluar: number; selisih: number }> {
  try {
    const rows = await financeQuery<{ masuk: number; keluar: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN e.side = 'DEBIT' THEN e.amount_rupiah ELSE 0 END), 0) AS masuk,
         COALESCE(SUM(CASE WHEN e.side = 'CREDIT' THEN e.amount_rupiah ELSE 0 END), 0) AS keluar
       FROM finance_journal_entries e
       JOIN finance_journals j ON j.id = e.journal_id AND j.status = 'POSTED'
       WHERE date(j.effective_date) BETWEEN ? AND ?`,
      [period.from, period.to]
    )
    const row = rows[0]
    const masuk = safeNumber(row?.masuk)
    const keluar = safeNumber(row?.keluar)
    return { masuk, keluar, selisih: masuk - keluar }
  } catch {
    return { masuk: 0, keluar: 0, selisih: 0 }
  }
}

export async function getFinanceAlerts(): Promise<KeuanganMonitoring['alert']> {
  try {
    const rows = await financeQuery<{ kind: string; count: number; amount_rupiah: number }>(
      `SELECT 'LATE_TOPUP' AS kind, COUNT(*) AS count, COALESCE(SUM(amount_rupiah), 0) AS amount_rupiah
       FROM finance_payment_intents WHERE review_status = 'REQUIRED'
       UNION ALL
       SELECT 'UNMATCHED_BANK', COUNT(*), COALESCE(SUM(ABS(amount_rupiah)), 0)
       FROM finance_bank_transactions WHERE match_status = 'UNMATCHED'
       UNION ALL
       SELECT 'PAYOUT_FAILED', COUNT(*), COALESCE(SUM(amount_rupiah), 0)
       FROM finance_payouts WHERE status = 'FAILED'`
    )
    const labelMap: Record<string, string> = {
      LATE_TOPUP: 'Topup perlu review',
      UNMATCHED_BANK: 'Transaksi bank belum dipasangkan',
      PAYOUT_FAILED: 'Payout gagal',
    }
    return rows
      .map(row => ({
        kind: row.kind,
        label: labelMap[row.kind] ?? row.kind,
        count: safeNumber(row.count),
        amount_rupiah: safeNumber(row.amount_rupiah),
      }))
      .filter(row => row.count > 0)
  } catch {
    return []
  }
}

async function getSppBulan(period: MonthPeriod): Promise<KeuanganMonitoring['spp']> {
  try {
    const [belumRows, bayarRows, nominalRows] = await Promise.all([
      query<{ total: number }>(
        `SELECT COUNT(*) AS total
         FROM santri s
         WHERE s.status_global = 'aktif'
           AND COALESCE(s.bebas_spp, 0) = 0
           AND NOT EXISTS (
             SELECT 1 FROM spp_log sl
             WHERE sl.santri_id = s.id AND sl.tahun = ? AND sl.bulan = ?
           )
           AND NOT EXISTS (
             SELECT 1 FROM spp_tagihan_ditiadakan w
             WHERE w.santri_id = s.id AND w.tahun = ? AND w.bulan = ? AND w.is_active = 1
           )
           AND (s.tanggal_masuk IS NULL OR s.tanggal_masuk <= ?)`,
        [period.year, period.monthNum, period.year, period.monthNum, period.to]
      ),
      query<{ transaksi: number; total_bayar: number }>(
        `SELECT COUNT(*) AS transaksi, COALESCE(SUM(nominal_bayar), 0) AS total_bayar
         FROM spp_log
         WHERE tahun = ? AND bulan = ?`,
        [period.year, period.monthNum]
      ),
      query<{ nominal: number }>(
        `SELECT nominal FROM spp_settings
         WHERE tahun_kalender = ? AND is_active = 1
         ORDER BY id DESC LIMIT 1`,
        [period.year]
      ),
    ])
    const belum = safeNumber(belumRows[0]?.total)
    const nominalSpp = safeNumber(nominalRows[0]?.nominal) || 70000
    return {
      santri_belum_lunas: belum,
      estimasi_nominal: belum * nominalSpp,
      nominal_spp: nominalSpp,
      transaksi_bulan: safeNumber(bayarRows[0]?.transaksi),
      total_bayar_bulan: safeNumber(bayarRows[0]?.total_bayar),
    }
  } catch {
    return {
      santri_belum_lunas: 0,
      estimasi_nominal: 0,
      nominal_spp: 0,
      transaksi_bulan: 0,
      total_bayar_bulan: 0,
    }
  }
}

async function getPsbBulan(period: MonthPeriod): Promise<KeuanganMonitoring['psbBulan']> {
  try {
    const rows = await query<{ transaksi: number; total_bayar: number }>(
      `SELECT COUNT(*) AS transaksi, COALESCE(SUM(nominal_bayar), 0) AS total_bayar
       FROM pembayaran_tahunan
       WHERE date(tanggal_bayar) BETWEEN ? AND ?
         AND COALESCE(status, 'AKTIF') != 'VOID'`,
      [period.from, period.to]
    )
    return {
      transaksi: safeNumber(rows[0]?.transaksi),
      total_bayar: safeNumber(rows[0]?.total_bayar),
    }
  } catch {
    return { transaksi: 0, total_bayar: 0 }
  }
}

export async function getKeuanganMonitoring(
  input: { month?: string } = {}
): Promise<KeuanganMonitoring> {
  const period = monthPeriod(input.month || currentMonthWib())
  const [saldoAkun, arusKasBulan, alert, spp, psbBulan] = await Promise.all([
    getSaldoAkun(),
    getArusKas(period),
    getFinanceAlerts(),
    getSppBulan(period),
    getPsbBulan(period),
  ])

  const totalSaldo = saldoAkun.reduce((sum, row) => sum + safeNumber(row.balance_rupiah), 0)

  return {
    period,
    saldoAkun,
    totalSaldo,
    arusKasBulan,
    alert,
    spp,
    psbBulan,
  }
}
