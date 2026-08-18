import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { assertIntegerRupiah, financeError } from './errors'
import { duplicateOf } from './idempotency'
import { prepareJournalStatements } from './ledger'
import { decryptFinanceValue, encryptFinanceValue } from './encryption'
import { startDuitkuBifastTransfer, verifyDuitkuDisbursementCallback } from './disbursement/duitku'
import { pencairan } from './postings'

type PayoutType = 'MEAL' | 'LAUNDRY' | 'PAYROLL' | 'REFUND' | 'OTHER'

export async function registerFinanceRecipient(input:{recipientType:'MEAL_MANAGER'|'LAUNDRY_MANAGER'|'TEACHER'|'OTHER';name:string;asramaScope?:string|null;bankCode:string;accountNumber:string;accountHolderName:string;actorId:string}){
  try{
    const account=input.accountNumber.replace(/\s/g,'');if(!/^\d{6,24}$/.test(account))throw new Error('Nomor rekening tidak valid.')
    const id=generateId(),masked=`${'*'.repeat(Math.max(0,account.length-4))}${account.slice(-4)}`
    await (await getDB()).prepare(`INSERT INTO finance_recipients(id,recipient_type,name,asrama_scope,bank_code,account_number_encrypted,account_number_masked,account_holder_name,usable_after,status,created_by) VALUES(?,?,?,?,?,?,?,?,datetime('now','+24 hours'),'PENDING_VERIFICATION',?)`).bind(id,input.recipientType,input.name.trim(),input.asramaScope||null,input.bankCode,await encryptFinanceValue(account),masked,input.accountHolderName.trim(),input.actorId).run()
    return{success:true as const,recipientId:id,usableAfterHours:24}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function verifyFinanceRecipient(recipientId:string,verifierId:string){
  try{const result=await (await getDB()).prepare(`UPDATE finance_recipients SET status='ACTIVE',verified_at=datetime('now'),verified_by=?,updated_at=datetime('now') WHERE id=? AND status='PENDING_VERIFICATION' AND created_by<>?`).bind(verifierId,recipientId,verifierId).run();if(!result.meta?.changes)throw new Error('Rekening harus diverifikasi petugas berbeda.');return{success:true as const}}catch(error){return{success:false as const,...financeError(error)}}
}

export async function createPayoutRequest(input: {
  idempotencyKey: string; recipientId: string; payoutType: PayoutType; amountRupiah: number
  feeRupiah?: number; method: 'API' | 'MANUAL_TRANSFER' | 'CASH'; makerId: string; asramaScope?: string | null
}) {
  try {
    assertIntegerRupiah(input.amountRupiah)
    const id = generateId()
    await (await getDB()).prepare(`INSERT INTO finance_payouts
      (id,idempotency_key,recipient_id,payout_type,asrama_scope,amount_rupiah,fee_rupiah,method,status,maker_id)
      VALUES(?,?,?,?,?,?,?,?, 'SUBMITTED',?)`).bind(
        id, input.idempotencyKey, input.recipientId, input.payoutType, input.asramaScope || null,
        input.amountRupiah, input.feeRupiah || 0, input.method, input.makerId,
      ).run()
    return { success: true as const, payoutId: id }
  } catch (error) {
    // requestKey datang dari client, jadi kunci yang sama dengan penerima atau
    // nominal berbeda tidak boleh dibalas sebagai duplikat yang berhasil.
    const existing = await duplicateOf(
      error,
      () => queryOne<{ id: string; recipient_id: string; amount_rupiah: number; payout_type: string }>(
        'SELECT id,recipient_id,amount_rupiah,payout_type FROM finance_payouts WHERE idempotency_key=?', [input.idempotencyKey]),
      row => row.recipient_id === input.recipientId
        && row.payout_type === input.payoutType
        && Number(row.amount_rupiah) === input.amountRupiah,
    )
    if (existing) return { success: true as const, payoutId: existing.id, duplicate: true }
    return { success: false as const, ...financeError(error) }
  }
}

export async function checkPayout(payoutId: string, checkerId: string) {
  try {
    const result = await (await getDB()).prepare(`UPDATE finance_payouts SET status='CHECKED',checker_id=?,checked_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status='SUBMITTED'`).bind(checkerId, payoutId).run()
    if (!result.meta?.changes) throw new Error('Payout tidak dalam status menunggu pemeriksaan.')
    return { success: true as const }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}

export async function executeManualPayout(input: { payoutId: string; executorId: string; bankReference: string; proofUrl?: string | null }) {
  try {
    const payout = await queryOne<{ id: string; idempotency_key: string; payout_type: PayoutType; amount_rupiah: number; fee_rupiah: number; method: string; status: string; asrama_scope: string | null }>(`SELECT id,idempotency_key,payout_type,amount_rupiah,fee_rupiah,method,status,asrama_scope FROM finance_payouts WHERE id=?`, [input.payoutId])
    if (!payout || payout.status !== 'CHECKED' || payout.method === 'API') throw new Error('Payout manual belum siap dieksekusi.')
    if (!input.bankReference.trim()) throw new Error('Referensi transfer/kuitansi wajib diisi.')
    const total = Number(payout.amount_rupiah) + Number(payout.fee_rupiah)
    const db = await getDB()
    const journal = prepareJournalStatements(db, {
      idempotencyKey: `payout:${payout.idempotency_key}`,
      description: `Payout ${payout.payout_type}`, sourceType: 'PAYOUT', sourceId: payout.id,
      externalReference: input.bankReference, actorType: 'STAFF', actorId: input.executorId,
      ...pencairan({
        jenis: payout.payout_type,
        nominalRupiah: Number(payout.amount_rupiah),
        biayaRupiah: Number(payout.fee_rupiah),
        sumberDana: payout.method === 'CASH' ? 'TUNAI' : 'BANK',
        asramaScope: payout.asrama_scope,
      }),
    })
    await db.batch([
      db.prepare(`UPDATE finance_payouts SET status='EXECUTING',executor_id=?,executed_at=datetime('now'),provider_reference=?,proof_url=?,updated_at=datetime('now') WHERE id=? AND status='CHECKED'`).bind(
        input.executorId, input.bankReference, input.proofUrl || null, payout.id,
      ),
      ...journal.statements,
      db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
      db.prepare(`UPDATE finance_payouts SET status='PROVIDER_SUCCESS',journal_id=?,updated_at=datetime('now') WHERE id=? AND status='EXECUTING'`).bind(journal.journalId, payout.id),
    ])
    return { success: true as const, journalId: journal.journalId }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}

export async function executeApiPayout(input:{payoutId:string;executorId:string}){
  try{
    const payout=await queryOne<any>(`SELECT p.*,r.name recipient_name,r.bank_code,r.account_number_encrypted,r.account_holder_name,r.status recipient_status,r.usable_after FROM finance_payouts p JOIN finance_recipients r ON r.id=p.recipient_id WHERE p.id=?`,[input.payoutId])
    if(!payout||payout.status!=='CHECKED'||payout.method!=='API'||payout.recipient_status!=='ACTIVE'||new Date(payout.usable_after||'9999-12-31').getTime()>Date.now())throw new Error('Payout API atau rekening penerima belum siap.')
    const db=await getDB()
    const locked=await db.prepare(`UPDATE finance_payouts SET status='EXECUTING',executor_id=?,executed_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status='CHECKED'`).bind(input.executorId,payout.id).run()
    if(!locked.meta?.changes)throw new Error('Payout sedang diproses oleh eksekutor lain.')
    try{
      const bankAccount=await decryptFinanceValue(payout.account_number_encrypted)
      const result=await startDuitkuBifastTransfer({bankCode:payout.bank_code,bankAccount,accountName:payout.account_holder_name||payout.recipient_name,amountRupiah:Number(payout.amount_rupiah),purpose:`Payout ${payout.payout_type} ${payout.id}`,senderId:payout.id.replace(/-/g,'').slice(0,12),senderName:'Pesantren Sukahideng'})
      if(result.sandbox){
        const total=Number(payout.amount_rupiah)+Number(payout.fee_rupiah)
        const journal=prepareJournalStatements(db,{
          idempotencyKey:`payout:${payout.idempotency_key}`,
          description:`Payout API sandbox ${payout.payout_type}`,
          sourceType:'PAYOUT',sourceId:payout.id,externalReference:result.disburseId,
          actorType:'GATEWAY',actorId:'DUITKU_SANDBOX',
          ...pencairan({
            jenis:payout.payout_type,
            nominalRupiah:Number(payout.amount_rupiah),
            biayaRupiah:Number(payout.fee_rupiah),
            sumberDana:'GATEWAY',
            asramaScope:payout.asrama_scope,
          }),
        })
        await db.batch([
          db.prepare(`UPDATE finance_payouts SET provider_reference=?,provider_payload_json=?,updated_at=datetime('now') WHERE id=? AND status='EXECUTING'`).bind(result.disburseId,JSON.stringify(result),payout.id),
          ...journal.statements,
          db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
          db.prepare(`UPDATE finance_payouts SET status='PROVIDER_SUCCESS',journal_id=?,updated_at=datetime('now') WHERE id=? AND status='EXECUTING'`).bind(journal.journalId,payout.id),
        ])
        return{success:true as const,pendingCallback:false,sandbox:true,providerReference:result.disburseId,journalId:journal.journalId}
      }
      await db.prepare(`UPDATE finance_payouts SET provider_reference=?,provider_payload_json=?,updated_at=datetime('now') WHERE id=? AND status='EXECUTING'`).bind(result.disburseId,JSON.stringify(result),payout.id).run()
      return{success:true as const,pendingCallback:true,providerReference:result.disburseId}
    }catch(error){await db.prepare(`UPDATE finance_payouts SET status='FAILED',failure_reason=?,updated_at=datetime('now') WHERE id=? AND status='EXECUTING'`).bind(error instanceof Error?error.message:String(error),payout.id).run();throw error}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function processDuitkuPayoutCallback(payload:Record<string,string>){
  try{
    const payout=await queryOne<any>(`SELECT p.*,r.account_number_encrypted FROM finance_payouts p JOIN finance_recipients r ON r.id=p.recipient_id WHERE p.provider_reference=?`,[payload.disburseId])
    if(!payout)throw new Error('Payout callback tidak ditemukan.')
    const bankAccount=await decryptFinanceValue(payout.account_number_encrypted)
    if(!verifyDuitkuDisbursementCallback(payload,bankAccount))return{success:false as const,status:401,error:'Signature callback payout tidak valid.'}
    const code=String(payload.statusCode||'')
    if(code==='68')return{success:true as const,pending:true}
    const db=await getDB()
    if(code!=='00'){await db.prepare(`UPDATE finance_payouts SET status='FAILED',failure_reason=?,provider_payload_json=?,updated_at=datetime('now') WHERE id=? AND status='EXECUTING'`).bind(payload.errorMessage||payload.statusDesc||code,JSON.stringify(payload),payout.id).run();return{success:true as const,failed:true}}
    const total=Number(payout.amount_rupiah)+Number(payout.fee_rupiah),journal=prepareJournalStatements(db,{
      idempotencyKey:`payout:${payout.idempotency_key}`,description:`Payout API ${payout.payout_type}`,sourceType:'PAYOUT',sourceId:payout.id,externalReference:payload.disburseId,actorType:'GATEWAY',actorId:'DUITKU',
      ...pencairan({jenis:payout.payout_type,nominalRupiah:Number(payout.amount_rupiah),biayaRupiah:Number(payout.fee_rupiah),sumberDana:'GATEWAY',asramaScope:payout.asrama_scope}),
    })
    await db.batch([...journal.statements,db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),db.prepare(`UPDATE finance_payouts SET status='PROVIDER_SUCCESS',journal_id=?,provider_payload_json=?,updated_at=datetime('now') WHERE id=? AND status='EXECUTING'`).bind(journal.journalId,JSON.stringify(payload),payout.id)])
    return{success:true as const,journalId:journal.journalId}
  }catch(error){return{success:false as const,status:500,...financeError(error)}}
}

export async function reconcilePayout(payoutId: string, actorId: string) {
  try {
    const result = await (await getDB()).prepare(`UPDATE finance_payouts SET status='RECONCILED',reconciled_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status='PROVIDER_SUCCESS'`).bind(payoutId).run()
    if (!result.meta?.changes) throw new Error('Payout belum sukses di provider.')
    await (await getDB()).prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id) VALUES(?,'STAFF',?,'RECONCILE','PAYOUT',?)`).bind(generateId(), actorId, payoutId).run()
    return { success: true as const }
  } catch (error) { return { success: false as const, ...financeError(error) } }
}
