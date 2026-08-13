import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
import { assertIntegerRupiah, financeError } from './errors'
import { contentKey, duplicateOf } from './idempotency'
import { prepareJournalStatements, prepareWalletStatements } from './ledger'

export async function openIncidentMode(input:{reason:string;channels:Array<'CASH'|'EMERGENCY_TRANSFER'>;startsAt:string;endsAt:string;openedBy:string;approvedBy:string}){
  try{
    if(input.reason.trim().length<15)throw new Error('Alasan incident mode minimal 15 karakter.')
    const startsAt=new Date(input.startsAt).getTime(),endsAt=new Date(input.endsAt).getTime()
    if(!input.channels.length||!Number.isFinite(startsAt)||!Number.isFinite(endsAt)||endsAt<=startsAt||endsAt-startsAt>24*3600_000)throw new Error('Incident mode maksimal 24 jam dan harus memiliki channel.')
    if(input.openedBy===input.approvedBy)throw new Error('Pembuka dan penyetuju incident mode harus berbeda.')
    const overlap=await queryOne<{id:string}>(`SELECT id FROM finance_incident_modes WHERE status='ACTIVE' AND datetime(ends_at)>datetime(?) AND datetime(starts_at)<datetime(?) LIMIT 1`,[input.startsAt,input.endsAt])
    if(overlap)throw new Error('Sudah ada incident mode aktif pada rentang waktu tersebut.')
    const id=generateId(),db=await getDB()
    await db.batch([
      db.prepare(`INSERT INTO finance_incident_modes(id,reason,allowed_channels_json,starts_at,ends_at,opened_by,approved_by) VALUES(?,?,?,?,?,?,?)`).bind(id,input.reason.trim(),JSON.stringify(input.channels),input.startsAt,input.endsAt,input.openedBy,input.approvedBy),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'OPEN_INCIDENT_MODE','INCIDENT_MODE',?,?)`).bind(generateId(),input.approvedBy,id,JSON.stringify({reason:input.reason.trim(),channels:input.channels,startsAt:input.startsAt,endsAt:input.endsAt,openedBy:input.openedBy})),
    ])
    return{success:true as const,id}
  }catch(error){return{success:false as const,...financeError(error)}}
}

export async function recordIncidentTopup(input:{
  idempotencyKey:string;incidentId:string;santriId:string;channel:'CASH'|'EMERGENCY_TRANSFER';amountRupiah:number
  receivedBy:string;shiftId?:string|null;bankReference?:string|null;asramaScope?:string|null
}){
  // Kasus paling berisiko: uang tunai sudah diterima fisik. Kunci berbasis
  // nomor kuitansi saja membuat penerimaan kedua ditelan sebagai duplikat dan
  // saldo santri tidak pernah bertambah.
  const key=await contentKey('incident-topup',input.idempotencyKey,{
    incidentId:input.incidentId,santriId:input.santriId,channel:input.channel,amount:input.amountRupiah,
  })
  try{
    assertIntegerRupiah(input.amountRupiah)
    const incident=await queryOne<{allowed_channels_json:string}>(`SELECT allowed_channels_json FROM finance_incident_modes WHERE id=? AND status='ACTIVE' AND datetime(starts_at)<=datetime('now') AND datetime(ends_at)>datetime('now')`,[input.incidentId])
    if(!incident||!(JSON.parse(incident.allowed_channels_json) as string[]).includes(input.channel))throw new Error('Incident mode/channel tidak aktif.')
    if(input.channel==='CASH'&&!input.shiftId)throw new Error('Penerimaan cash wajib terkait shift kas.')
    if(input.channel==='EMERGENCY_TRANSFER'&&!input.bankReference)throw new Error('Transfer darurat wajib memiliki referensi bank.')
    if(input.channel==='CASH'){
      const shift=await queryOne<{id:string}>(`SELECT id FROM finance_cash_shifts WHERE id=? AND status='OPEN'`,[input.shiftId])
      if(!shift)throw new Error('Shift kas tidak ditemukan atau sudah ditutup.')
    }
    const db=await getDB(),receiptId=generateId(),receiptNumber=`INC-${Date.now()}-${receiptId.slice(0,6).toUpperCase()}`
    const journal=prepareJournalStatements(db,{
      idempotencyKey:key,description:`Penerimaan ${input.channel} ${receiptNumber}`,sourceType:'INCIDENT_TOPUP',sourceId:receiptId,
      externalReference:input.bankReference||receiptNumber,actorType:'STAFF',actorId:input.receivedBy,
      entries:[
        {accountCode:input.channel==='CASH'?'1103':'1101',side:'DEBIT',amountRupiah:input.amountRupiah,santriId:input.santriId,asramaScope:input.asramaScope},
        {accountCode:'2101',side:'CREDIT',amountRupiah:input.amountRupiah,santriId:input.santriId,asramaScope:input.asramaScope},
      ],
    })
    await db.batch([
      ...journal.statements,
      ...prepareWalletStatements(db,journal.journalId,[{idempotencyKey:`wallet:${key}`,santriId:input.santriId,walletKind:'TITIPAN',amountRupiah:input.amountRupiah,movementType:'INCIDENT_TOPUP',referenceType:'INCIDENT_RECEIPT',referenceId:receiptId}]),
      db.prepare(`INSERT INTO finance_incident_receipts(id,receipt_number,incident_id,santri_id,channel,amount_rupiah,received_by,shift_id,bank_reference,journal_id) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(receiptId,receiptNumber,input.incidentId,input.santriId,input.channel,input.amountRupiah,input.receivedBy,input.shiftId||null,input.bankReference||null,journal.journalId),
      db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,asrama_scope,after_json) VALUES(?,'STAFF',?,'RECORD_INCIDENT_TOPUP','INCIDENT_RECEIPT',?,?,?)`).bind(generateId(),input.receivedBy,receiptId,input.asramaScope||null,JSON.stringify({receiptNumber,incidentId:input.incidentId,channel:input.channel,amountRupiah:input.amountRupiah})),
    ])
    return{success:true as const,receiptId,receiptNumber,journalId:journal.journalId}
  }catch(error){
    const existingJournal=await duplicateOf(error,()=>queryOne<{id:string}>(`SELECT id FROM finance_journals WHERE idempotency_key=?`,[key]))
    if(existingJournal){
      const existingReceipt=await queryOne<{id:string;receipt_number:string}>(`SELECT id,receipt_number FROM finance_incident_receipts WHERE journal_id=?`,[existingJournal.id]).catch(()=>null)
      if(existingReceipt)return{success:true as const,receiptId:existingReceipt.id,receiptNumber:existingReceipt.receipt_number,journalId:existingJournal.id,duplicate:true}
    }
    return{success:false as const,...financeError(error)}
  }
}

export async function closeIncidentMode(input:{incidentId:string;actorId:string;reason:string}){
  try{
    const reason=input.reason.trim()
    if(reason.length<10)throw new Error('Catatan penutupan minimal 10 karakter.')
    const db=await getDB()
    const result=await db.prepare(`UPDATE finance_incident_modes SET status='ENDED',closed_at=datetime('now') WHERE id=? AND status='ACTIVE'`).bind(input.incidentId).run()
    if(!result.meta?.changes)throw new Error('Incident mode sudah ditutup atau tidak ditemukan.')
    await db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json) VALUES(?,'STAFF',?,'CLOSE_INCIDENT_MODE','INCIDENT_MODE',?,?)`).bind(generateId(),input.actorId,input.incidentId,JSON.stringify({reason})).run()
    return{success:true as const}
  }catch(error){return{success:false as const,...financeError(error)}}
}
