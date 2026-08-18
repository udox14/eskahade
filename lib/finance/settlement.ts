import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
import { assertIntegerRupiah, financeError } from './errors'
import { contentKey, duplicateOf } from './idempotency'
import { prepareJournalStatements } from './ledger'
import { settlementGateway } from './postings'

export async function reconcileGatewaySettlement(input:{
  idempotencyKey:string;grossRupiah:number;netRupiah:number;providerFeeRupiah:number
  bankReference:string;actorId:string;effectiveDate?:string
}){
  // Referensi bank saja tidak cukup unik: settlement berbeda dengan nomor
  // referensi yang sama akan saling menelan. Sidik jari isi membuat hanya
  // kiriman yang benar-benar identik yang ter-dedup.
  const key=await contentKey('settlement',input.idempotencyKey,{
    gross:input.grossRupiah,net:input.netRupiah,fee:input.providerFeeRupiah,date:input.effectiveDate||null,
  })
  try{
    assertIntegerRupiah(input.grossRupiah,'Settlement bruto');assertIntegerRupiah(input.netRupiah,'Settlement neto')
    if(!Number.isSafeInteger(input.providerFeeRupiah)||input.providerFeeRupiah<0||input.netRupiah+input.providerFeeRupiah!==input.grossRupiah)throw new Error('Neto ditambah biaya harus sama dengan bruto.')
    const db=await getDB();const settlementId=generateId()
    const journal=prepareJournalStatements(db,{
      idempotencyKey:key,effectiveDate:input.effectiveDate,description:`Settlement gateway ${input.bankReference}`,
      sourceType:'GATEWAY_SETTLEMENT',sourceId:settlementId,externalReference:input.bankReference,actorType:'STAFF',actorId:input.actorId,
      ...settlementGateway({brutoRupiah:input.grossRupiah,netoRupiah:input.netRupiah,biayaProviderRupiah:input.providerFeeRupiah}),
    })
    await db.batch([...journal.statements,db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId)])
    return{success:true as const,journalId:journal.journalId}
  }catch(error){
    const existing=await duplicateOf(error,()=>queryOne<{id:string}>(`SELECT id FROM finance_journals WHERE idempotency_key=?`,[key]))
    if(existing)return{success:true as const,journalId:existing.id,duplicate:true}
    return{success:false as const,...financeError(error)}
  }
}
