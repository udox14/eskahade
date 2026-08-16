import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
import { assertIntegerRupiah, financeError } from './errors'
import { duplicateOf } from './idempotency'
import { prepareJournalStatements, prepareWalletStatements } from './ledger'
import type { WalletKind } from './types'

const DESTINATION_ACCOUNT = {
  SPP: '4101', USPP: '4102', NON_SPP: '4103', MAKAN: '2102', LAUNDRY: '2103', JAJAN: '2105',
} as const

async function configuredCutoff(destination:'MAKAN'|'LAUNDRY'):Promise<string|null>{
  const key=destination==='MAKAN'?'finance_meal_cutoff':'finance_laundry_cutoff'
  const setting=await queryOne<{value:string}>(`SELECT value FROM finance_settings WHERE key=?`,[key])
  if(!setting)return null
  try{
    const parsed=JSON.parse(setting.value) as {day:number;time:string}
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
    const part=(type:string)=>Number(parts.find(item=>item.type===type)?.value||0)
    let year=part('year'),month=part('month')
    const make=()=>{
      const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate()
      const day=Math.min(Number(parsed.day),lastDay)
      return new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${parsed.time}:00+07:00`)
    }
    let cutoff=make()
    if(cutoff.getTime()<=Date.now()){month+=1;if(month>12){month=1;year+=1}cutoff=make()}
    return cutoff.toISOString()
  }catch{return null}
}

export async function allocateStudentFunds(input: {
  idempotencyKey: string
  santriId: string
  destination: Exclude<WalletKind, 'TITIPAN'>
  amountRupiah: number
  fullOutstandingRupiah?: number | null
  billingReference?: string | null
  cutoffAt?: string | null
  billItems?: Array<{ billId: string; amountRupiah: number }>
  actorType: 'GUARDIAN' | 'STAFF'
  actorId?: string | null
  asramaScope?: string | null
}) {
  try {
    assertIntegerRupiah(input.amountRupiah)
    if (['SPP', 'NON_SPP', 'MAKAN', 'LAUNDRY'].includes(input.destination)) {
      if (!Number.isSafeInteger(input.fullOutstandingRupiah) || input.fullOutstandingRupiah !== input.amountRupiah) {
        throw new Error('Tagihan bulanan harus dialokasikan lunas penuh.')
      }
      if (!input.billingReference) throw new Error('Referensi tagihan wajib diisi.')
    }
    if(['SPP','USPP','NON_SPP','MAKAN','LAUNDRY'].includes(input.destination)){
      const billed=(input.billItems||[]).reduce((sum,item)=>sum+Number(item.amountRupiah),0)
      if(billed!==input.amountRupiah)throw new Error('Alokasi tagihan harus terkait item tagihan yang sama nominalnya.')
      // Pertahanan berlapis di atas trg_finance_allocation_bill_validate: tagihan
      // yang dialokasikan harus milik santri yang sama.
      const billIds=(input.billItems||[]).map(item=>item.billId)
      if(billIds.length){
        const foreign=await queryOne<{count:number}>(`SELECT COUNT(*) count FROM finance_bills
          WHERE id IN (${billIds.map(()=>'?').join(',')}) AND santri_id<>?`,[...billIds,input.santriId])
        if(Number(foreign?.count||0)>0)throw new Error('Tagihan yang dipilih bukan milik santri ini.')
      }
    }

    const db = await getDB()
    const cutoffAt=input.cutoffAt||(['MAKAN','LAUNDRY'].includes(input.destination)?await configuredCutoff(input.destination as 'MAKAN'|'LAUNDRY'):null)
    const allocationId = generateId()
    const journal = prepareJournalStatements(db, {
      idempotencyKey: `allocation:${input.idempotencyKey}`,
      description: `Alokasi ${input.destination}`,
      sourceType: 'ALLOCATION', sourceId: allocationId,
      actorType: input.actorType, actorId: input.actorId,
      metadata: { billingReference: input.billingReference || null },
      entries: [
        { accountCode: '2101', side: 'DEBIT', amountRupiah: input.amountRupiah, santriId: input.santriId, asramaScope: input.asramaScope },
        { accountCode: DESTINATION_ACCOUNT[input.destination], side: 'CREDIT', amountRupiah: input.amountRupiah, santriId: input.santriId, asramaScope: input.asramaScope },
      ],
    })
    const wallet = prepareWalletStatements(db, journal.journalId, [
      { idempotencyKey: `${input.idempotencyKey}:out`, santriId: input.santriId, walletKind: 'TITIPAN', amountRupiah: -input.amountRupiah, movementType: 'ALLOCATION_OUT', referenceType: 'ALLOCATION', referenceId: allocationId },
      { idempotencyKey: `${input.idempotencyKey}:in`, santriId: input.santriId, walletKind: input.destination, amountRupiah: input.amountRupiah, movementType: 'ALLOCATION_IN', referenceType: 'ALLOCATION', referenceId: allocationId },
    ])
    const initialStatus = ['MAKAN', 'LAUNDRY'].includes(input.destination) ? 'RESERVED' : 'COMMITTED'
    await db.batch([
      ...journal.statements,
      ...wallet,
      db.prepare(`INSERT INTO finance_allocations
        (id,idempotency_key,santri_id,destination_kind,amount_rupiah,billing_reference,status,cutoff_at,journal_id,created_by_type,created_by_id,committed_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,CASE WHEN ?='COMMITTED' THEN datetime('now') ELSE NULL END)`).bind(
          allocationId, input.idempotencyKey, input.santriId, input.destination, input.amountRupiah,
          input.billingReference || null, initialStatus, cutoffAt, journal.journalId,
          input.actorType, input.actorId || null, initialStatus,
        ),
      // paid_rupiah/status tagihan diterapkan oleh trg_finance_allocation_bill_apply
      // agar validasi dan penerapannya tidak bisa terpisah.
      ...(input.billItems||[]).map(item=>
        db.prepare(`INSERT INTO finance_allocation_bill_items(allocation_id,bill_id,amount_rupiah) VALUES(?,?,?)`).bind(allocationId,item.billId,item.amountRupiah)),
      db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
      db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json)
        VALUES(?,?,?,?,?)`).bind(generateId(), 'ALLOCATION_CREATED', 'ALLOCATION', allocationId, JSON.stringify({ santriId: input.santriId, destination: input.destination, amountRupiah: input.amountRupiah })),
    ])
    return { success: true as const, allocationId, journalId: journal.journalId }
  } catch (error) {
    // Hanya kiriman ulang yang identik yang boleh dilaporkan sebagai duplikat.
    // Error lain (saldo kurang, periode tertutup, tagihan tidak valid) harus
    // sampai ke pengguna apa adanya.
    const existing = await duplicateOf(
      error,
      () => queryOne<{ id: string; journal_id: string; santri_id: string; destination_kind: string; amount_rupiah: number }>(
        'SELECT id,journal_id,santri_id,destination_kind,amount_rupiah FROM finance_allocations WHERE idempotency_key=?', [input.idempotencyKey]),
      row => row.santri_id === input.santriId
        && row.destination_kind === input.destination
        && Number(row.amount_rupiah) === input.amountRupiah,
    )
    if (existing) return { success: true as const, allocationId: existing.id, journalId: existing.journal_id, duplicate: true }
    return { success: false as const, ...financeError(error) }
  }
}

export async function returnUnusedAllocation(input: {
  allocationId: string
  idempotencyKey: string
  actorType: 'GUARDIAN' | 'STAFF'
  actorId?: string | null
}) {
  try {
    const allocation = await queryOne<{
      id: string; santri_id: string; destination_kind: 'MAKAN' | 'LAUNDRY' | 'JAJAN'; amount_rupiah: number
      status: string; cutoff_at: string | null; asrama_scope: string | null
    }>(`SELECT a.id,a.santri_id,a.destination_kind,a.amount_rupiah,a.status,a.cutoff_at,
      (SELECT e.asrama_scope FROM finance_journal_entries e WHERE e.journal_id=a.journal_id AND e.asrama_scope IS NOT NULL LIMIT 1) asrama_scope
      FROM finance_allocations a WHERE a.id=?`, [input.allocationId])
    if (!allocation || !['MAKAN','LAUNDRY','JAJAN'].includes(allocation.destination_kind)) throw new Error('Alokasi tidak dapat dikembalikan.')
    if (!['RESERVED','COMMITTED'].includes(allocation.status)) throw new Error('Alokasi sudah dicairkan atau pernah dikembalikan.')
    if (allocation.cutoff_at && new Date(allocation.cutoff_at).getTime() <= Date.now()) throw new Error('Cutoff pengembalian sudah lewat.')

    const db = await getDB()
    const account = DESTINATION_ACCOUNT[allocation.destination_kind]
    const journal = prepareJournalStatements(db, {
      idempotencyKey: `allocation-return:${input.idempotencyKey}`,
      description: `Pengembalian alokasi ${allocation.destination_kind}`,
      sourceType: 'ALLOCATION_RETURN', sourceId: allocation.id,
      actorType: input.actorType, actorId: input.actorId,
      entries: [
        { accountCode: account, side: 'DEBIT', amountRupiah: allocation.amount_rupiah, santriId: allocation.santri_id, asramaScope: allocation.asrama_scope },
        { accountCode: '2101', side: 'CREDIT', amountRupiah: allocation.amount_rupiah, santriId: allocation.santri_id, asramaScope: allocation.asrama_scope },
      ],
    })
    await db.batch([
      db.prepare(`UPDATE finance_allocations SET status='RETURNED',returned_at=datetime('now') WHERE id=? AND status IN ('RESERVED','COMMITTED') AND (cutoff_at IS NULL OR datetime(cutoff_at)>datetime('now'))`).bind(allocation.id),
      ...journal.statements,
      ...prepareWalletStatements(db, journal.journalId, [
        { idempotencyKey: `${input.idempotencyKey}:out`, santriId: allocation.santri_id, walletKind: allocation.destination_kind, amountRupiah: -allocation.amount_rupiah, movementType: 'RETURN_OUT', referenceType: 'ALLOCATION', referenceId: allocation.id },
        { idempotencyKey: `${input.idempotencyKey}:in`, santriId: allocation.santri_id, walletKind: 'TITIPAN', amountRupiah: allocation.amount_rupiah, movementType: 'RETURN_IN', referenceType: 'ALLOCATION', referenceId: allocation.id },
      ]),
      db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
      db.prepare(`INSERT INTO finance_audit_log(id,actor_type,actor_id,action,entity_type,entity_id,after_json)
        VALUES(?,?,?,?,?,?,?)`).bind(generateId(),input.actorType,input.actorId||null,'RETURN_UNUSED_ALLOCATION','ALLOCATION',allocation.id,JSON.stringify({amountRupiah:allocation.amount_rupiah,destination:allocation.destination_kind})),
    ])
    return { success: true as const, journalId: journal.journalId }
  } catch (error) {
    return { success: false as const, ...financeError(error) }
  }
}
