import { financeQuery, financeQueryOne, query } from '@/lib/db'
import { AKUN_TITIPAN_WALI, AKUN_KAS_MASUK } from './postings'
/* eslint-disable @typescript-eslint/no-explicit-any */

export type FinanceDashboard = {
  accountBalances: Array<{ code: string; name: string; account_type: string; balance_rupiah: number }>
  walletTotals: Array<{ wallet_kind: string; balance_rupiah: number }>
  recentTransactions: Array<{
    id: string; effective_date: string; description: string; source_type: string; external_reference: string | null; created_at: string
  }>
  alerts: Array<{ kind: string; count: number; amount_rupiah: number }>
  softAlerts: Array<{ kind: string; count: number; amount_rupiah: number }>
  cashTrend: Array<{ day: string; inflow_rupiah: number; outflow_rupiah: number }>
}

export async function getFinanceDashboard(asramaScope: string | null): Promise<FinanceDashboard> {
  const scopeFilter = asramaScope ? `AND EXISTS (SELECT 1 FROM finance_journal_entries se WHERE se.journal_id=j.id AND se.asrama_scope=?)` : ''
  const scopeParams = asramaScope ? [asramaScope] : []
  const scopedStudents = asramaScope
    ? await query<{ id: string }>(`SELECT id FROM santri WHERE asrama=? AND status_global='aktif'`, [asramaScope])
    : []
  let softConfig={topup_rupiah:5000000,student_balance_rupiah:10000000,aggregate_float_rupiah:500000000}
  try{softConfig={...softConfig,...JSON.parse((await financeQueryOne<{value:string}>(`SELECT value FROM finance_settings WHERE key='finance_soft_alerts'`))?.value||'{}')}}catch{}
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
  const alertsPromise = !asramaScope
    ? financeQuery<{ kind: string; count: number; amount_rupiah: number }>(`SELECT 'LATE_TOPUP' kind,COUNT(*) count,COALESCE(SUM(amount_rupiah),0) amount_rupiah
        FROM finance_payment_intents WHERE review_status='REQUIRED'
        UNION ALL SELECT 'SELISIH_BANK',COUNT(*),COALESCE(SUM(ABS(difference_rupiah)),0) FROM finance_reconciliation_checks WHERE difference_rupiah<>0
        UNION ALL SELECT 'PAYOUT_GAGAL',COUNT(*),COALESCE(SUM(amount_rupiah),0) FROM finance_payouts WHERE status='GAGAL'`)
    : financeQuery<{ kind: string; count: number; amount_rupiah: number }>(`SELECT 'LATE_TOPUP' kind,COUNT(*) count,COALESCE(SUM(p.amount_rupiah),0) amount_rupiah
        FROM finance_payment_intents p JOIN finance_student_snapshots s ON s.santri_id=p.santri_id
        WHERE p.review_status='REQUIRED' AND s.asrama=?
        UNION ALL SELECT 'SELISIH_BANK',0,0
        UNION ALL SELECT 'PAYOUT_GAGAL',COUNT(*),COALESCE(SUM(amount_rupiah),0) FROM finance_payouts WHERE status='GAGAL' AND asrama_scope=?`,
      [asramaScope, asramaScope])
  const accountBalancesPromise = !asramaScope
    ? financeQuery<{ code: string; name: string; account_type: string; balance_rupiah: number }>(`SELECT a.code,a.name,a.account_type,COALESCE(b.balance_rupiah,0) balance_rupiah
        FROM finance_accounts a LEFT JOIN finance_account_balances b ON b.account_id=a.id
        WHERE a.is_active=1 ORDER BY a.code`)
    : financeQuery<{ code: string; name: string; account_type: string; balance_rupiah: number }>(`SELECT a.code,a.name,a.account_type,
        COALESCE(SUM(CASE WHEN j.id IS NULL THEN 0 WHEN e.side=a.normal_balance THEN e.amount_rupiah ELSE -e.amount_rupiah END),0) balance_rupiah
        FROM finance_accounts a
        LEFT JOIN finance_journal_entries e ON e.account_id=a.id AND e.asrama_scope=?
        LEFT JOIN finance_journals j ON j.id=e.journal_id AND j.status='POSTED'
        WHERE a.is_active=1 GROUP BY a.id ORDER BY a.code`, [asramaScope])
  const softAlertsPromise=!asramaScope
    ?financeQuery<{kind:string;count:number;amount_rupiah:number}>(`SELECT 'LARGE_TOPUP' kind,COUNT(*) count,COALESCE(SUM(amount_rupiah),0) amount_rupiah FROM finance_payment_intents WHERE status='PAID' AND datetime(paid_at)>=datetime('now','-30 days') AND amount_rupiah>=?
      UNION ALL SELECT 'HIGH_STUDENT_BALANCE',COUNT(*),COALESCE(SUM(amount_rupiah),0) FROM (SELECT santri_id,SUM(balance_rupiah) amount_rupiah FROM finance_student_wallets GROUP BY santri_id HAVING SUM(balance_rupiah)>=?)
      UNION ALL SELECT 'HIGH_FLOAT',CASE WHEN COALESCE(b.balance_rupiah,0)>=? THEN 1 ELSE 0 END,COALESCE(b.balance_rupiah,0) FROM finance_accounts a LEFT JOIN finance_account_balances b ON b.account_id=a.id WHERE a.code=?`,
      [softConfig.topup_rupiah,softConfig.student_balance_rupiah,softConfig.aggregate_float_rupiah,AKUN_TITIPAN_WALI])
    :financeQuery<{kind:string;count:number;amount_rupiah:number}>(`SELECT 'LARGE_TOPUP' kind,COUNT(*) count,COALESCE(SUM(p.amount_rupiah),0) amount_rupiah FROM finance_payment_intents p JOIN finance_student_snapshots s ON s.santri_id=p.santri_id WHERE p.status='PAID' AND datetime(p.paid_at)>=datetime('now','-30 days') AND p.amount_rupiah>=? AND s.asrama=?
      UNION ALL SELECT 'HIGH_STUDENT_BALANCE',COUNT(*),COALESCE(SUM(amount_rupiah),0) FROM (SELECT w.santri_id,SUM(w.balance_rupiah) amount_rupiah FROM finance_student_wallets w JOIN finance_student_snapshots s ON s.santri_id=w.santri_id WHERE s.asrama=? GROUP BY w.santri_id HAVING SUM(w.balance_rupiah)>=?)
      UNION ALL SELECT 'HIGH_FLOAT',CASE WHEN COALESCE(SUM(CASE WHEN e.side=a.normal_balance THEN e.amount_rupiah ELSE -e.amount_rupiah END),0)>=? THEN 1 ELSE 0 END,COALESCE(SUM(CASE WHEN e.side=a.normal_balance THEN e.amount_rupiah ELSE -e.amount_rupiah END),0) FROM finance_journal_entries e JOIN finance_accounts a ON a.id=e.account_id AND a.code=? JOIN finance_journals j ON j.id=e.journal_id AND j.status='POSTED' WHERE e.asrama_scope=?`,
      [softConfig.topup_rupiah,asramaScope,asramaScope,softConfig.student_balance_rupiah,softConfig.aggregate_float_rupiah,AKUN_TITIPAN_WALI,asramaScope])
  const [accountBalances, walletTotals, recentTransactions, alerts, softAlerts, cashTrend] = await Promise.all([
    accountBalancesPromise,
    walletTotalsPromise,
    financeQuery<any>(`SELECT j.id,j.effective_date,j.description,j.source_type,j.external_reference,j.created_at
      FROM finance_journals j WHERE j.status='POSTED' ${scopeFilter} ORDER BY j.created_at DESC LIMIT 20`, scopeParams),
    alertsPromise,
    softAlertsPromise,
    financeQuery<{ day: string; inflow_rupiah: number; outflow_rupiah: number }>(`SELECT j.effective_date day,
      COALESCE(SUM(CASE WHEN e.side='DEBIT' THEN e.amount_rupiah ELSE 0 END),0) inflow_rupiah,
      COALESCE(SUM(CASE WHEN e.side='CREDIT' THEN e.amount_rupiah ELSE 0 END),0) outflow_rupiah
      FROM finance_journal_entries e
      JOIN finance_journals j ON j.id=e.journal_id AND j.status='POSTED'
      JOIN finance_accounts a ON a.id=e.account_id AND a.code IN (?,?)
      WHERE date(j.effective_date)>=date('now','-29 days')
      ${asramaScope ? `AND e.asrama_scope=?` : ''}
      GROUP BY j.effective_date ORDER BY j.effective_date`, asramaScope ? [...AKUN_KAS_MASUK, asramaScope] : [...AKUN_KAS_MASUK]),
  ])
  return { accountBalances, walletTotals, recentTransactions, alerts, softAlerts, cashTrend }
}
