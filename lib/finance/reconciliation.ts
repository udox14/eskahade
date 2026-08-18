import { getFinanceDB as getDB, generateId, financeQuery as query, financeQueryOne as queryOne } from '@/lib/db'
import { financeError } from './errors'
import { AKUN, AKUN_KAS_MASUK } from './postings'

/**
 * Rekonsiliasi bank: checklist bulanan manual.
 *
 * Menggantikan impor rekening koran + pencocokan otomatis per baris. Alasannya
 * bukan karena pencocokan otomatis salah, tapi karena hasilnya harus tetap
 * diperiksa manusia, dan pengurus di sini tidak punya cara menilai apakah
 * pasangan yang dipilih mesin itu benar. Yang mereka bisa lakukan - dan memang
 * biasa lakukan - adalah membandingkan satu angka total.
 *
 * Alurnya: sistem menghitung saldo akun kas menurut pembukuan, operator
 * mengetik saldo akhir dari rekening koran, sistem menghitung selisihnya.
 * Selisih bukan nol wajib diberi catatan penjelasan sebelum periode ditutup.
 */

export type ReconciliationTarget = { accountId: string; code: string; label: string; systemTotalRupiah: number }

/** Saldo akun kas/bank menurut pembukuan, untuk dibandingkan dengan rekening koran. */
export async function reconciliationTargets(): Promise<ReconciliationTarget[]> {
  const rows = await query<{ id: string; code: string; balance_rupiah: number }>(
    `SELECT a.id,a.code,COALESCE(b.balance_rupiah,0) balance_rupiah
     FROM finance_accounts a LEFT JOIN finance_account_balances b ON b.account_id=a.id
     WHERE a.code IN (${AKUN_KAS_MASUK.map(() => '?').join(',')}) ORDER BY a.code`, AKUN_KAS_MASUK)
  return rows.map(row => ({
    accountId: row.id,
    code: row.code,
    label: AKUN[row.code as keyof typeof AKUN]?.label || row.code,
    systemTotalRupiah: Number(row.balance_rupiah || 0),
  }))
}

export async function recordReconciliationCheck(input: {
  periodKey: string
  bankAccountLabel: string
  systemTotalRupiah: number
  statementTotalRupiah: number
  note?: string | null
  actorId: string
}) {
  try {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.periodKey)) throw new Error('Format periode tidak valid.')
    if (!Number.isSafeInteger(input.statementTotalRupiah)) throw new Error('Saldo rekening koran harus rupiah bulat.')
    const selisih = input.statementTotalRupiah - input.systemTotalRupiah
    const catatan = input.note?.trim() || null
    // Selisih wajib dijelaskan. Tanpa syarat ini, checklist berubah jadi
    // formalitas: operator mengetik angka apa saja lalu periode bisa ditutup.
    if (selisih !== 0 && (catatan?.length || 0) < 10) {
      throw new Error('Ada selisih dengan rekening koran. Isi catatan penjelasan minimal 10 karakter.')
    }
    const status = selisih === 0 ? 'COCOK' : 'DIJELASKAN'
    const db = await getDB()
    await db.batch([
      db.prepare(`INSERT INTO finance_reconciliation_checks
        (id,period_key,bank_account_label,system_total_rupiah,statement_total_rupiah,difference_rupiah,status,note,checked_by)
        VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(period_key,bank_account_label) DO UPDATE SET
          system_total_rupiah=excluded.system_total_rupiah,
          statement_total_rupiah=excluded.statement_total_rupiah,
          difference_rupiah=excluded.difference_rupiah,
          status=excluded.status,note=excluded.note,
          checked_by=excluded.checked_by,checked_at=datetime('now')`).bind(
        generateId(), input.periodKey, input.bankAccountLabel, input.systemTotalRupiah,
        input.statementTotalRupiah, selisih, status, catatan, input.actorId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'RECONCILE','FINANCE_PERIOD',?,?)`)
        .bind(generateId(), input.actorId, input.periodKey, JSON.stringify({
          bankAccountLabel: input.bankAccountLabel,
          systemTotalRupiah: input.systemTotalRupiah,
          statementTotalRupiah: input.statementTotalRupiah,
          differenceRupiah: selisih, note: catatan,
        })),
    ])
    return { success: true as const, differenceRupiah: selisih, status }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}

export async function reconciliationChecks(periodKey: string) {
  return query<any>(`SELECT * FROM finance_reconciliation_checks WHERE period_key=? ORDER BY bank_account_label`, [periodKey])
}

/** Berapa akun kas yang belum dicek pada periode ini; dipakai prasyarat tutup buku. */
export async function unreconciledAccountCount(periodKey: string): Promise<number> {
  const targets = await reconciliationTargets()
  const done = await queryOne<{ count: number }>(
    `SELECT COUNT(*) count FROM finance_reconciliation_checks WHERE period_key=?`, [periodKey])
  return Math.max(0, targets.length - Number(done?.count || 0))
}
