import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
import { assertIntegerRupiah, financeError } from './errors'
import { prepareJournalStatements, prepareWalletStatements } from './ledger'
import type { WalletKind } from './types'

const DESTINATION_ACCOUNT = {
  SPP: '4101', USPP: '4102', NON_SPP: '4103', MAKAN: '2102', LAUNDRY: '2103', JAJAN: '2105',
} as const

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
    if ((input.destination === 'SPP' || input.destination === 'NON_SPP')) {
      if (!Number.isSafeInteger(input.fullOutstandingRupiah) || input.fullOutstandingRupiah !== input.amountRupiah) {
        throw new Error('SPP dan Non-SPP harus dialokasikan lunas penuh.')
      }
      if (!input.billingReference) throw new Error('Referensi tagihan wajib diisi.')
    }
    if(['SPP','USPP','NON_SPP'].includes(input.destination)){
      const billed=(input.billItems||[]).reduce((sum,item)=>sum+Number(item.amountRupiah),0)
      if(billed!==input.amountRupiah)throw new Error('Alokasi tagihan harus terkait item tagihan yang sama nominalnya.')
    }

    const db = await getDB()
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
          input.billingReference || null, initialStatus, input.cutoffAt || null, journal.journalId,
          input.actorType, input.actorId || null, initialStatus,
        ),
      ...(input.billItems||[]).flatMap(item=>[
        db.prepare(`INSERT INTO finance_allocation_bill_items(allocation_id,bill_id,amount_rupiah) VALUES(?,?,?)`).bind(allocationId,item.billId,item.amountRupiah),
        db.prepare(`UPDATE finance_bills SET paid_rupiah=paid_rupiah+?,status=CASE WHEN paid_rupiah+?=amount_rupiah THEN 'PAID' ELSE 'PARTIAL' END,updated_at=datetime('now') WHERE id=? AND santri_id=? AND status IN ('OPEN','PARTIAL') AND amount_rupiah-paid_rupiah>=?`).bind(item.amountRupiah,item.amountRupiah,item.billId,input.santriId,item.amountRupiah),
      ]),
      db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
      db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json)
        VALUES(?,?,?,?,?)`).bind(generateId(), 'ALLOCATION_CREATED', 'ALLOCATION', allocationId, JSON.stringify({ santriId: input.santriId, destination: input.destination, amountRupiah: input.amountRupiah })),
    ])
    return { success: true as const, allocationId, journalId: journal.journalId }
  } catch (error) {
    const existing = await queryOne<{ id: string; journal_id: string }>('SELECT id,journal_id FROM finance_allocations WHERE idempotency_key=?', [input.idempotencyKey]).catch(() => null)
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
      status: string; cutoff_at: string | null
    }>(`SELECT id,santri_id,destination_kind,amount_rupiah,status,cutoff_at FROM finance_allocations WHERE id=?`, [input.allocationId])
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
        { accountCode: account, side: 'DEBIT', amountRupiah: allocation.amount_rupiah, santriId: allocation.santri_id },
        { accountCode: '2101', side: 'CREDIT', amountRupiah: allocation.amount_rupiah, santriId: allocation.santri_id },
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
    ])
    return { success: true as const, journalId: journal.journalId }
  } catch (error) {
    return { success: false as const, ...financeError(error) }
  }
}
