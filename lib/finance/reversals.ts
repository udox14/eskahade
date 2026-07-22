import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
import { financeError } from './errors'
import { prepareJournalStatements, prepareWalletStatements } from './ledger'

export async function handleProviderReversal(input:{paymentIntentId:string;providerReference:string;actorId:string}){
  try{
    const intent=await queryOne<{id:string;merchant_order_id:string;santri_id:string;amount_rupiah:number;gateway_fee_rupiah:number;charged_amount_rupiah:number;status:string}>(`SELECT id,merchant_order_id,santri_id,amount_rupiah,gateway_fee_rupiah,charged_amount_rupiah,status FROM finance_payment_intents WHERE id=?`,[input.paymentIntentId])
    if(!intent||intent.status!=='PAID')throw new Error('Top-up PAID tidak ditemukan.')
    const wallet=await queryOne<{balance_rupiah:number}>(`SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id=? AND wallet_kind='TITIPAN'`,[intent.santri_id])
    const recoverable=Math.min(Number(wallet?.balance_rupiah||0),Number(intent.amount_rupiah)),shortfall=Number(intent.amount_rupiah)-recoverable
    const db=await getDB();const journal=prepareJournalStatements(db,{
      idempotencyKey:`provider-reversal:${intent.id}`,description:`Reversal provider ${intent.merchant_order_id}`,sourceType:'PROVIDER_REVERSAL',sourceId:intent.id,
      externalReference:input.providerReference,actorType:'STAFF',actorId:input.actorId,metadata:{recoverableRupiah:recoverable,receivableRupiah:shortfall},
      entries:[
        ...(recoverable>0?[{accountCode:'2101' as const,side:'DEBIT' as const,amountRupiah:recoverable,santriId:intent.santri_id}]:[]),
        ...(shortfall>0?[{accountCode:'1201' as const,side:'DEBIT' as const,amountRupiah:shortfall,santriId:intent.santri_id}]:[]),
        ...(intent.gateway_fee_rupiah>0?[{accountCode:'4104' as const,side:'DEBIT' as const,amountRupiah:intent.gateway_fee_rupiah,santriId:intent.santri_id}]:[]),
        {accountCode:'1102',side:'CREDIT',amountRupiah:intent.charged_amount_rupiah,santriId:intent.santri_id},
      ],
    })
    await db.batch([
      ...journal.statements,
      ...(recoverable>0?prepareWalletStatements(db,journal.journalId,[{idempotencyKey:`provider-reversal-wallet:${intent.id}`,santriId:intent.santri_id,walletKind:'TITIPAN',amountRupiah:-recoverable,movementType:'PROVIDER_REVERSAL',referenceType:'PAYMENT_INTENT',referenceId:intent.id}]):[]),
      db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
      db.prepare(`UPDATE finance_payment_intents SET status='REVERSED',updated_at=datetime('now') WHERE id=? AND status='PAID'`).bind(intent.id),
      ...(shortfall>0?[db.prepare(`UPDATE finance_student_wallets SET frozen_at=datetime('now'),freeze_reason='PROVIDER_REVERSAL_RECEIVABLE' WHERE santri_id=?`).bind(intent.santri_id)]:[]),
      db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json) VALUES(?,?,?,?,?)`).bind(generateId(),'ACCOUNT_FROZEN_PROVIDER_REVERSAL','PAYMENT_INTENT',intent.id,JSON.stringify({santriId:intent.santri_id,receivableRupiah:shortfall})),
    ])
    return{success:true as const,journalId:journal.journalId,receivableRupiah:shortfall,frozen:shortfall>0}
  }catch(error){return{success:false as const,...financeError(error)}}
}
