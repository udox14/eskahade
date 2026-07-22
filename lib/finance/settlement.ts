import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
import { assertIntegerRupiah, financeError } from './errors'
import { prepareJournalStatements } from './ledger'

export async function reconcileGatewaySettlement(input:{
  idempotencyKey:string;grossRupiah:number;netRupiah:number;providerFeeRupiah:number
  bankReference:string;actorId:string;effectiveDate?:string
}){
  try{
    assertIntegerRupiah(input.grossRupiah,'Settlement bruto');assertIntegerRupiah(input.netRupiah,'Settlement neto')
    if(!Number.isSafeInteger(input.providerFeeRupiah)||input.providerFeeRupiah<0||input.netRupiah+input.providerFeeRupiah!==input.grossRupiah)throw new Error('Neto ditambah biaya harus sama dengan bruto.')
    const db=await getDB();const settlementId=generateId()
    const journal=prepareJournalStatements(db,{
      idempotencyKey:`settlement:${input.idempotencyKey}`,effectiveDate:input.effectiveDate,description:`Settlement gateway ${input.bankReference}`,
      sourceType:'GATEWAY_SETTLEMENT',sourceId:settlementId,externalReference:input.bankReference,actorType:'STAFF',actorId:input.actorId,
      entries:[
        {accountCode:'1101',side:'DEBIT',amountRupiah:input.netRupiah},
        ...(input.providerFeeRupiah>0?[{accountCode:'5101' as const,side:'DEBIT' as const,amountRupiah:input.providerFeeRupiah}]:[]),
        {accountCode:'1102',side:'CREDIT',amountRupiah:input.grossRupiah},
      ],
    })
    await db.batch([...journal.statements,db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId)])
    return{success:true as const,journalId:journal.journalId}
  }catch(error){
    const existing=await queryOne<{id:string}>(`SELECT id FROM finance_journals WHERE idempotency_key=?`,[`settlement:${input.idempotencyKey}`]).catch(()=>null)
    if(existing)return{success:true as const,journalId:existing.id,duplicate:true}
    return{success:false as const,...financeError(error)}
  }
}
