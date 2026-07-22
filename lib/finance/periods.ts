import { getFinanceDB as getDB, generateId, financeQuery as query, financeQueryOne as queryOne } from '@/lib/db'
import { financeError } from './errors'

async function sha256(value: string): Promise<string> {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
}

export async function closeFinancePeriod(periodKey:string,actorId:string){
  try{
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey))throw new Error('Format periode tidak valid.')
    const blockers=await queryOne<{drafts:number;unmatched:number;pending_payouts:number;suspense:number}>(`SELECT
      (SELECT COUNT(*) FROM finance_journals WHERE status='DRAFT' AND substr(effective_date,1,7)=?) drafts,
      (SELECT COUNT(*) FROM finance_bank_transactions WHERE match_status='UNMATCHED' AND substr(transaction_at,1,7)=?) unmatched,
      (SELECT COUNT(*) FROM finance_payouts WHERE status IN ('EXECUTING','PROVIDER_SUCCESS')) pending_payouts,
      COALESCE((SELECT balance_rupiah FROM finance_account_balances WHERE account_id='fa-suspense'),0) suspense`,[periodKey,periodKey])
    if(!blockers||Number(blockers.drafts)>0||Number(blockers.unmatched)>0||Number(blockers.pending_payouts)>0||Number(blockers.suspense)!==0)throw new Error('Tutup buku ditolak: masih ada draft, mutasi belum cocok, payout belum final, atau saldo suspense.')
    const totals=await query<{account_id:string;balance_rupiah:number}>(`SELECT account_id,balance_rupiah FROM finance_account_balances ORDER BY account_id`)
    const lastJournal=await queryOne<{id:string;created_at:string}>(`SELECT id,created_at FROM finance_journals WHERE status='POSTED' AND substr(effective_date,1,7)<=? ORDER BY effective_date DESC,created_at DESC,id DESC LIMIT 1`,[periodKey])
    const closeHash=await sha256(JSON.stringify({periodKey,totals,lastJournal}))
    const db=await getDB()
    await db.prepare(`INSERT INTO finance_periods(period_key,status,closed_at,closed_by,close_hash) VALUES(?,'CLOSED',datetime('now'),?,?)
      ON CONFLICT(period_key) DO UPDATE SET status='CLOSED',closed_at=datetime('now'),closed_by=excluded.closed_by,close_hash=excluded.close_hash`).bind(periodKey,actorId,closeHash).run()
    return{success:true as const,closeHash}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function approvePeriodReopen(periodKey:string,actorId:string,reason:string){
  try{
    if(reason.trim().length<10)throw new Error('Alasan pembukaan kembali minimal 10 karakter.')
    await (await getDB()).prepare(`INSERT INTO finance_period_reopen_approvals(id,period_key,approver_id,reason) VALUES(?,?,?,?)`).bind(generateId(),periodKey,actorId,reason.trim()).run()
    const count=(await queryOne<{count:number}>(`SELECT COUNT(DISTINCT approver_id) count FROM finance_period_reopen_approvals WHERE period_key=?`,[periodKey]))?.count||0
    return{success:true as const,approvalCount:Number(count),ready:Number(count)>=2}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function reopenFinancePeriod(periodKey:string,actorId:string,reason:string){
  try{
    const db=await getDB()
    await db.batch([
      db.prepare(`UPDATE finance_periods SET status='OPEN',reopened_at=datetime('now'),reopen_reason=? WHERE period_key=? AND status='CLOSED'`).bind(reason,periodKey),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'REOPEN','FINANCE_PERIOD',?,?)`).bind(generateId(),actorId,periodKey,JSON.stringify({reason})),
    ])
    return{success:true as const}
  }catch(error){return{success:false as const,...financeError(error)}}
}
