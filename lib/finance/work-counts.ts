import { financeQueryOne } from '@/lib/db'

/**
 * Jumlah pekerjaan yang menunggu, dipetakan ke halaman tempat mengerjakannya.
 *
 * Dipakai sebagai badge di navigasi supaya bendahara tahu ada yang menunggu
 * tanpa membuka dua belas halaman satu per satu. Angka nol tidak ditampilkan.
 */
export type FinanceWorkCounts = {
  payout: number
  payroll: number
  operasi: number
  unitKas: number
}

const EMPTY: FinanceWorkCounts = { payout: 0, payroll: 0, operasi: 0, unitKas: 0 }

/**
 * Satu query untuk seluruh angka; navigasi ikut dirender di setiap halaman
 * keuangan, jadi jumlah round-trip-nya dijaga tetap satu.
 *
 * `scope` hanya diterapkan pada payout karena hanya tabel itu yang membawa
 * `asrama_scope`. Angka lain memang bersifat pusat — menampilkannya seolah
 * milik satu asrama akan lebih menyesatkan daripada membiarkannya global.
 */
export async function getFinanceWorkCounts(scope: string | null): Promise<FinanceWorkCounts> {
  try {
    const row = await financeQueryOne<Record<string, number>>(`SELECT
      (SELECT COUNT(*) FROM finance_payouts WHERE status IN ('DIAJUKAN','DISETUJUI','GAGAL')
        ${scope ? 'AND asrama_scope=?' : ''}) payout,
      (SELECT COUNT(*) FROM finance_payroll_periods WHERE status='DIHITUNG') payroll,
      (SELECT COUNT(*) FROM finance_payment_intents WHERE status='PAID' AND review_status='REQUIRED') operasi,
      (SELECT COUNT(*) FROM finance_cash_shifts WHERE status='CLOSED_REVIEW' AND supervisor_id IS NULL) unit_kas`,
      scope ? [scope] : [])
    if (!row) return EMPTY
    return {
      payout: Number(row.payout) || 0,
      payroll: Number(row.payroll) || 0,
      operasi: Number(row.operasi) || 0,
      unitKas: Number(row.unit_kas) || 0,
    }
  } catch {
    // Badge adalah pelengkap. Kegagalan menghitungnya tidak boleh membuat
    // seluruh navigasi keuangan ikut gagal dirender.
    return EMPTY
  }
}
