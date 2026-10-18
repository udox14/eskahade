'use server'

import { authorizeFinanceFeature } from '@/lib/finance/authorization'
import { query,queryOne,execute,now } from '@/lib/db'
import { getBriFeatureFlags,assertBankStatementSyncEnabled } from '@/lib/finance/bri/feature-flags'
import { fetchBankStatement,persistBankStatementTransactions } from '@/lib/finance/bri/statement-service'
import { matchStatementTransaction } from '@/lib/finance/bri/matching-engine'
import { executeSettlementTransition } from '@/lib/finance/bri/settlement-service'
import { recoverMissedPaymentFromStatement } from '@/lib/finance/bri/recovery-service'
import { recordUnallocatedStatementPayment } from '@/lib/finance/bri/unallocated-service'
import type { FinanceBriStatementTransaction } from '@/lib/finance/bri/statement-types'

async function operator(){
 const auth=await authorizeFinanceFeature('/dashboard/keuangan/rekonsiliasi',true)
 if(!auth.roles.some(r=>['admin','bendahara'].includes(r)))throw new Error('FORBIDDEN')
 return auth.session
}

export async function getBriReconciliationWorkbench(){
 await authorizeFinanceFeature('/dashboard/keuangan/rekonsiliasi')
 const statements=await query<FinanceBriStatementTransaction>(`SELECT st.* FROM finance_bri_statement_transactions st JOIN finance_bri_statement_fetches f ON f.id=st.fetch_id WHERE f.status='SUCCESS' AND st.type_normalized='CREDIT' AND st.matched_payment_id IS NULL ORDER BY st.created_at DESC LIMIT 100`)
 const matches=await Promise.all(statements.map(st=>matchStatementTransaction(st)))
 const targets=await query<{id:string;label:string;kind:'PAYMENT'|'ORDER'}>(`SELECT p.id,p.payment_number||' · '||s.nama_lengkap||' · Rp'||(p.gross_amount+p.cooperative_admin_fee) label,'PAYMENT' kind FROM finance_payments p JOIN santri s ON s.id=p.santri_id WHERE p.channel='BRI' AND p.status='PAID' UNION ALL SELECT o.id,o.order_number||' · '||s.nama_lengkap||' · Rp'||o.total_charged,'ORDER' FROM finance_payment_orders o JOIN santri s ON s.id=o.santri_id WHERE o.payment_method='BRI_VA' AND o.status='PENDING' AND NOT EXISTS(SELECT 1 FROM finance_payments p WHERE p.order_id=o.id) LIMIT 200`)
 return {statements:statements.map((st,i)=>({id:st.id,amount:st.amount,date:st.transaction_date_raw,reference:st.transaction_id,remark:st.remark,classification:matches[i].classification})),targets,syncEnabled:getBriFeatureFlags().bankStatementSyncEnabled}
}

export async function syncBriStatementAction(input:{fromDateTime:string;toDateTime:string}){
 await operator();assertBankStatementSyncEnabled()
 const accountNo=process.env.BRI_COLLECTION_ACCOUNT_NO?.trim()
 if(!accountNo)throw new Error('Rekening collection belum dikonfigurasi.')
 const result=await fetchBankStatement({...input,accountNo})
 return persistBankStatementTransactions({...input,accountNo,response:result.data,rawResponseJson:JSON.stringify(result.data)})
}

export async function resolveBriStatementAction(input:{statementId:string;targetId?:string;kind:'PAYMENT'|'ORDER'|'UNALLOCATED';notes:string}){
 const user=await operator()
 if(input.notes.trim().length<10)throw new Error('Catatan pemeriksaan bukti bank wajib diisi.')
 const st=await queryOne<FinanceBriStatementTransaction>('SELECT * FROM finance_bri_statement_transactions WHERE id=?',[input.statementId])
 if(!st)throw new Error('Bukti bank tidak ditemukan.')
 if(input.kind==='UNALLOCATED')return recordUnallocatedStatementPayment({statementTransactionId:st.id,recordedBy:user.id,reason:input.notes})
 if(!input.targetId)throw new Error('Pilih pembayaran/order yang telah diverifikasi.')
 const reviewId='bri-review-'+st.id+'-'+input.targetId
 await execute(`INSERT OR IGNORE INTO finance_reconciliation_items(id,external_reference,external_amount,match_status,created_at) VALUES(?,?,?,'UNMATCHED_EXTERNAL',?)`,[reviewId,st.id,st.amount,now()])
 if(input.kind==='ORDER')return recoverMissedPaymentFromStatement({statementTransactionId:st.id,orderId:input.targetId,recoveredBy:user.id,recoveryNotes:input.notes,reconciliationItemId:reviewId})
 return executeSettlementTransition({statementTransactionId:st.id,paymentId:input.targetId,matchStrength:'MANUAL_RESOLVED',matchMethod:'OPERATOR_BANK_STATEMENT_REVIEW',reconciliationItemId:reviewId,verifiedBy:user.id,resolutionNotes:input.notes})
}
