import { financeQuery, query } from '@/lib/db'
/* eslint-disable @typescript-eslint/no-explicit-any */

export type FinanceDashboard = {
  accountBalances: Array<{ code: string; name: string; account_type: string; balance_rupiah: number }>
  walletTotals: Array<{ wallet_kind: string; balance_rupiah: number }>
  recentTransactions: Array<{
    id: string; effective_date: string; description: string; source_type: string; external_reference: string | null; created_at: string
  }>
  alerts: Array<{ kind: string; count: number; amount_rupiah: number }>
}

export async function getFinanceDashboard(asramaScope: string | null): Promise<FinanceDashboard> {
  const scopeFilter = asramaScope ? `AND EXISTS (SELECT 1 FROM finance_journal_entries se WHERE se.journal_id=j.id AND se.asrama_scope=?)` : ''
  const scopeParams = asramaScope ? [asramaScope] : []
  const scopedStudents = asramaScope
    ? await query<{ id: string }>(`SELECT id FROM santri WHERE asrama=? AND status_global='aktif'`, [asramaScope])
    : []
  const walletTotalsPromise = !asramaScope
    ? financeQuery<{ wallet_kind: string; balance_rupiah: number }>(`SELECT wallet_kind,SUM(balance_rupiah) balance_rupiah FROM finance_student_wallets GROUP BY wallet_kind ORDER BY wallet_kind`)
    : Promise.all(Array.from({ length: Math.ceil(scopedStudents.length / 80) }, (_, index) => {
        const ids = scopedStudents.slice(index * 80, index * 80 + 80).map(row => row.id)
        return financeQuery<{ wallet_kind: string; balance_rupiah: number }>(`SELECT wallet_kind,SUM(balance_rupiah) balance_rupiah FROM finance_student_wallets
          WHERE santri_id IN (${ids.map(() => '?').join(',')}) GROUP BY wallet_kind`, ids)
      })).then(chunks => {
        const totals = new Map<string, number>()
        for (const row of chunks.flat()) totals.set(row.wallet_kind, (totals.get(row.wallet_kind) || 0) + Number(row.balance_rupiah))
        return [...totals].map(([wallet_kind,balance_rupiah]) => ({ wallet_kind,balance_rupiah })).sort((a,b) => a.wallet_kind.localeCompare(b.wallet_kind))
      })
  const [accountBalances, walletTotals, recentTransactions, alerts] = await Promise.all([
    financeQuery<{ code: string; name: string; account_type: string; balance_rupiah: number }>(`SELECT a.code,a.name,a.account_type,COALESCE(b.balance_rupiah,0) balance_rupiah
      FROM finance_accounts a LEFT JOIN finance_account_balances b ON b.account_id=a.id
      WHERE a.is_active=1 ORDER BY a.code`),
    walletTotalsPromise,
    financeQuery<any>(`SELECT j.id,j.effective_date,j.description,j.source_type,j.external_reference,j.created_at
      FROM finance_journals j WHERE j.status='POSTED' ${scopeFilter} ORDER BY j.created_at DESC LIMIT 20`, scopeParams),
    financeQuery<{ kind: string; count: number; amount_rupiah: number }>(`SELECT 'LATE_TOPUP' kind,COUNT(*) count,COALESCE(SUM(amount_rupiah),0) amount_rupiah
      FROM finance_payment_intents WHERE review_status='REQUIRED'
      UNION ALL SELECT 'UNMATCHED_BANK',COUNT(*),COALESCE(SUM(ABS(amount_rupiah)),0) FROM finance_bank_transactions WHERE match_status='UNMATCHED'
      UNION ALL SELECT 'PAYOUT_FAILED',COUNT(*),COALESCE(SUM(amount_rupiah),0) FROM finance_payouts WHERE status='FAILED'`),
  ])
  return { accountBalances, walletTotals, recentTransactions, alerts }
}
