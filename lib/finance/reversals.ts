import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
import { financeError } from './errors'
import { prepareJournalStatements, prepareWalletStatements } from './ledger'
import { topupDibatalkanProvider } from './postings'

export async function handleProviderReversal(input:{paymentIntentId:string;providerReference:string;actorId:string}){
  try{
    const intent=await queryOne<{id:string;merchant_order_id:string;santri_id:string;amount_rupiah:number;gateway_fee_rupiah:number;charged_amount_rupiah:number;status:string}>(`SELECT id,merchant_order_id,santri_id,amount_rupiah,gateway_fee_rupiah,charged_amount_rupiah,status FROM finance_payment_intents WHERE id=?`,[input.paymentIntentId])
    if(!intent||intent.status!=='PAID')throw new Error('Top-up PAID tidak ditemukan.')
    const wallet=await queryOne<{balance_rupiah:number}>(`SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id=? AND wallet_kind='TITIPAN'`,[intent.santri_id])
    const recoverable=Math.min(Number(wallet?.balance_rupiah||0),Number(intent.amount_rupiah)),shortfall=Number(intent.amount_rupiah)-recoverable
    const db=await getDB();const journal=prepareJournalStatements(db,{
      idempotencyKey:`provider-reversal:${intent.id}`,description:`Reversal provider ${intent.merchant_order_id}`,sourceType:'PROVIDER_REVERSAL',sourceId:intent.id,
      externalReference:input.providerReference,actorType:'STAFF',actorId:input.actorId,metadata:{recoverableRupiah:recoverable,receivableRupiah:shortfall},
      ...topupDibatalkanProvider({
        santriId:intent.santri_id,
        dapatDitarikRupiah:recoverable,
        piutangRupiah:shortfall,
        biayaGatewayRupiah:Number(intent.gateway_fee_rupiah),
        totalDibayarRupiah:Number(intent.charged_amount_rupiah),
      }),
    })
    await db.batch([
      ...journal.statements,
      ...(recoverable>0?prepareWalletStatements(db,journal.journalId,[{idempotencyKey:`provider-reversal-wallet:${intent.id}`,santriId:intent.santri_id,walletKind:'TITIPAN',amountRupiah:-recoverable,movementType:'PROVIDER_REVERSAL',referenceType:'PAYMENT_INTENT',referenceId:intent.id}]):[]),
      db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
      db.prepare(`UPDATE finance_payment_intents SET status='REVERSED',updated_at=datetime('now') WHERE id=? AND status='PAID'`).bind(intent.id),
      // Beku hanya dompet titipan. Membekukan SPP/MAKAN/LAUNDRY ikut memutus
      // layanan yang sudah dibayar dan tidak berkaitan dengan piutang ini.
      ...(shortfall>0?[db.prepare(`UPDATE finance_student_wallets SET frozen_at=datetime('now'),freeze_reason='PROVIDER_REVERSAL_RECEIVABLE' WHERE santri_id=? AND wallet_kind='TITIPAN'`).bind(intent.santri_id)]:[]),
      ...(shortfall>0?[db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'FREEZE_WALLET','PAYMENT_INTENT',?,?)`).bind(generateId(),input.actorId,intent.id,JSON.stringify({santriId:intent.santri_id,receivableRupiah:shortfall,reason:'PROVIDER_REVERSAL_RECEIVABLE'}))]:[]),
    ])
    return{success:true as const,journalId:journal.journalId,receivableRupiah:shortfall,frozen:shortfall>0}
  }catch(error){return{success:false as const,...financeError(error)}}
}

/**
 * Buka kembali dompet titipan yang dibekukan reversal provider setelah piutang
 * diselesaikan. Tanpa ini, pembekuan tidak punya jalan keluar dari aplikasi.
 */
export async function unfreezeStudentWallet(input:{santriId:string;actorId:string;reason:string}){
  try{
    const reason=input.reason.trim()
    if(reason.length<10)throw new Error('Alasan pembukaan blokir minimal 10 karakter.')
    const db=await getDB()
    const result=await db.prepare(`UPDATE finance_student_wallets SET frozen_at=NULL,freeze_reason=NULL,updated_at=datetime('now')
      WHERE santri_id=? AND frozen_at IS NOT NULL`).bind(input.santriId).run()
    if(!result.meta?.changes)throw new Error('Tidak ada dompet santri ini yang sedang dibekukan.')
    await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'UNFREEZE_WALLET','STUDENT',?,?)`)
      .bind(generateId(),input.actorId,input.santriId,JSON.stringify({reason})).run()
    return{success:true as const}
  }catch(error){return{success:false as const,...financeError(error)}}
}
