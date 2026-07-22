import * as XLSX from 'xlsx'
import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
import { financeError } from './errors'

function normalized(record:Record<string,unknown>,names:string[]):unknown{
  const entries=Object.entries(record).map(([key,value])=>[key.toLowerCase().replace(/[^a-z0-9]/g,''),value] as const)
  for(const name of names){const found=entries.find(([key])=>key===name);if(found)return found[1]}
  return undefined
}

function amount(value:unknown):number{
  if(typeof value==='number')return Math.round(value)
  const raw=String(value||'').trim().replace(/\s/g,'')
  if(!raw)return 0
  const negative=raw.startsWith('-')||raw.startsWith('(')
  const digits=raw.replace(/[^0-9]/g,'')
  return (negative?-1:1)*Number(digits||0)
}

function dateText(value:unknown):string{
  if(value instanceof Date)return value.toISOString()
  if(typeof value==='number')return XLSX.SSF.parse_date_code(value) ? new Date(Date.UTC(XLSX.SSF.parse_date_code(value).y,XLSX.SSF.parse_date_code(value).m-1,XLSX.SSF.parse_date_code(value).d)).toISOString() : String(value)
  return String(value||'').trim()
}

async function fileHash(buffer:ArrayBuffer):Promise<string>{const d=await crypto.subtle.digest('SHA-256',buffer);return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('')}

export async function importBankStatement(input:{file:File;bankAccountLabel:string;actorId:string}){
  let importId:string|undefined
  try{
    if(input.file.size<=0||input.file.size>10*1024*1024)throw new Error('Berkas mutasi harus berukuran 1 byte–10 MB.')
    const buffer=await input.file.arrayBuffer(),hash=await fileHash(buffer)
    const duplicate=await queryOne<{id:string}>(`SELECT id FROM finance_reconciliation_imports WHERE file_hash=?`,[hash])
    if(duplicate)return{success:true as const,importId:duplicate.id,duplicate:true}
    const workbook=XLSX.read(buffer,{type:'array',cellDates:true}),sheet=workbook.Sheets[workbook.SheetNames[0]]
    const rawRows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:''})
    const rows=rawRows.map((row,index)=>{
      const credit=amount(normalized(row,['credit','kredit','masuk'])),debit=amount(normalized(row,['debit','keluar']))
      const direct=amount(normalized(row,['amount','nominal','jumlah','nilai']))
      return{rowNumber:index+2,transactionAt:dateText(normalized(row,['date','tanggal','transactiondate','waktu'])),amountRupiah:direct||credit-Math.abs(debit),reference:String(normalized(row,['reference','referensi','ref','nomorreferensi'])||'').trim()||null,description:String(normalized(row,['description','deskripsi','keterangan','uraian'])||'').trim()||null,raw:row}
    }).filter(row=>row.transactionAt&&row.amountRupiah!==0)
    if(!rows.length)throw new Error('Tidak ada baris mutasi valid.')
    importId=generateId();const db=await getDB()
    await db.prepare(`INSERT INTO finance_reconciliation_imports(id,bank_account_label,source_filename,file_hash,imported_by,row_count,status) VALUES(?,?,?,?,?,?,'IMPORTING')`).bind(importId,input.bankAccountLabel,input.file.name,hash,input.actorId,rows.length).run()
    for(let offset=0;offset<rows.length;offset+=75){
      const chunk=rows.slice(offset,offset+75)
      await db.batch(chunk.map(row=>db.prepare(`INSERT INTO finance_bank_transactions(id,import_id,row_number,transaction_at,amount_rupiah,bank_reference,description,raw_json) VALUES(?,?,?,?,?,?,?,?)`).bind(generateId(),importId,row.rowNumber,row.transactionAt,row.amountRupiah,row.reference,row.description,JSON.stringify(row.raw))))
    }
    await db.batch([
      db.prepare(`UPDATE finance_bank_transactions SET match_status='AUTO_MATCHED',matched_type='JOURNAL',matched_id=(SELECT j.id FROM finance_journals j WHERE j.external_reference=finance_bank_transactions.bank_reference AND j.status='POSTED' LIMIT 1),matched_at=datetime('now') WHERE import_id=? AND bank_reference IS NOT NULL AND EXISTS(SELECT 1 FROM finance_journals j WHERE j.external_reference=finance_bank_transactions.bank_reference AND j.status='POSTED')`).bind(importId),
      db.prepare(`UPDATE finance_reconciliation_imports SET status='READY' WHERE id=?`).bind(importId),
    ])
    return{success:true as const,importId,rowCount:rows.length}
  }catch(error){if(importId)await (await getDB()).prepare(`UPDATE finance_reconciliation_imports SET status='FAILED',error_message=? WHERE id=?`).bind(error instanceof Error?error.message:String(error),importId).run().catch(()=>null);return{success:false as const,...financeError(error)}}
}

export async function manuallyMatchBankTransaction(input:{bankTransactionId:string;matchedType:string;matchedId:string;actorId:string}){
  try{const result=await (await getDB()).prepare(`UPDATE finance_bank_transactions SET match_status='MANUAL_MATCHED',matched_type=?,matched_id=?,matched_by=?,matched_at=datetime('now') WHERE id=? AND match_status='UNMATCHED'`).bind(input.matchedType,input.matchedId,input.actorId,input.bankTransactionId).run();if(!result.meta?.changes)throw new Error('Mutasi sudah dicocokkan.');return{success:true as const}}catch(error){return{success:false as const,...financeError(error)}}
}
