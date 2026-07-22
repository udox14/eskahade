import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
import { assertIntegerRupiah, financeError } from './errors'
import { prepareJournalStatements, prepareWalletStatements } from './ledger'

export async function openIncidentMode(input:{reason:string;channels:Array<'CASH'|'EMERGENCY_TRANSFER'>;startsAt:string;endsAt:string;openedBy:string;approvedBy:string}){
  try{
    if(input.reason.trim().length<15)throw new Error('Alasan incident mode minimal 15 karakter.')
    if(!input.channels.length||new Date(input.endsAt).getTime()<=new Date(input.startsAt).getTime()||new Date(input.endsAt).getTime()-new Date(input.startsAt).getTime()>24*3600_000)throw new Error('Incident mode maksimal 24 jam dan harus memiliki channel.')
    if(input.openedBy===input.approvedBy)throw new Error('Pembuka dan penyetuju incident mode harus berbeda.')
    const id=generateId();await (await getDB()).prepare(`INSERT INTO finance_incident_modes(id,reason,allowed_channels_json,starts_at,ends_at,opened_by,approved_by) VALUES(?,?,?,?,?,?,?)`).bind(id,input.reason.trim(),JSON.stringify(input.channels),input.startsAt,input.endsAt,input.openedBy,input.approvedBy).run()
    return{success:true as const,id}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function recordIncidentTopup(input:{
  idempotencyKey:string;incidentId:string;santriId:string;channel:'CASH'|'EMERGENCY_TRANSFER';amountRupiah:number
  receivedBy:string;shiftId?:string|null;bankReference?:string|null
}){
  try{
    assertIntegerRupiah(input.amountRupiah)
    const incident=await queryOne<{allowed_channels_json:string}>(`SELECT allowed_channels_json FROM finance_incident_modes WHERE id=? AND status='ACTIVE' AND datetime(starts_at)<=datetime('now') AND datetime(ends_at)>datetime('now')`,[input.incidentId])
    if(!incident||!(JSON.parse(incident.allowed_channels_json) as string[]).includes(input.channel))throw new Error('Incident mode/channel tidak aktif.')
    if(input.channel==='CASH'&&!input.shiftId)throw new Error('Penerimaan cash wajib terkait shift kas.')
    if(input.channel==='EMERGENCY_TRANSFER'&&!input.bankReference)throw new Error('Transfer darurat wajib memiliki referensi bank.')
    const db=await getDB(),receiptId=generateId(),receiptNumber=`INC-${Date.now()}-${receiptId.slice(0,6).toUpperCase()}`
    const journal=prepareJournalStatements(db,{
      idempotencyKey:`incident-topup:${input.idempotencyKey}`,description:`Penerimaan ${input.channel} ${receiptNumber}`,sourceType:'INCIDENT_TOPUP',sourceId:receiptId,
      externalReference:input.bankReference||receiptNumber,actorType:'STAFF',actorId:input.receivedBy,
      entries:[
        {accountCode:input.channel==='CASH'?'1103':'1101',side:'DEBIT',amountRupiah:input.amountRupiah,santriId:input.santriId},
        {accountCode:'2101',side:'CREDIT',amountRupiah:input.amountRupiah,santriId:input.santriId},
      ],
    })
    await db.batch([
      ...journal.statements,
      ...prepareWalletStatements(db,journal.journalId,[{idempotencyKey:`incident-wallet:${input.idempotencyKey}`,santriId:input.santriId,walletKind:'TITIPAN',amountRupiah:input.amountRupiah,movementType:'INCIDENT_TOPUP',referenceType:'INCIDENT_RECEIPT',referenceId:receiptId}]),
      db.prepare(`INSERT INTO finance_incident_receipts(id,receipt_number,incident_id,santri_id,channel,amount_rupiah,received_by,shift_id,bank_reference,journal_id) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(receiptId,receiptNumber,input.incidentId,input.santriId,input.channel,input.amountRupiah,input.receivedBy,input.shiftId||null,input.bankReference||null,journal.journalId),
      db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
    ])
    return{success:true as const,receiptId,receiptNumber,journalId:journal.journalId}
  }catch(error){return{success:false as const,...financeError(error)}}
}
