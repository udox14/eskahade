import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { JournalInput, WalletMovementInput } from './types'
import { assertIntegerRupiah, financeError } from './errors'

const ACCOUNT_IDS: Record<string, string> = {
  '1101': 'fa-main-bank', '1102': 'fa-gateway-clearing', '1103': 'fa-central-cash',
  '1104': 'fa-unit-cash', '1201': 'fa-parent-receivable', '2101': 'fa-guardian-float',
  '2102': 'fa-meal-payable', '2103': 'fa-laundry-payable', '2104': 'fa-payroll-payable',
  '2105': 'fa-jajan-liability', '4101': 'fa-spp-revenue', '4102': 'fa-uspp-revenue',
  '4103': 'fa-nonspp-revenue', '4104': 'fa-gateway-fee-revenue',
  '5101': 'fa-gateway-fee-expense', '5102': 'fa-payroll-expense', '9999': 'fa-suspense',
}

export function jakartaDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (type: string) => parts.find(p => p.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function validateJournal(input: JournalInput): void {
  if (!input.idempotencyKey.trim()) throw new Error('Idempotency key wajib diisi.')
  if (input.entries.length < 2) throw new Error('Jurnal minimal memiliki dua baris.')
  let debit = 0
  let credit = 0
  for (const entry of input.entries) {
    assertIntegerRupiah(entry.amountRupiah)
    if (!ACCOUNT_IDS[entry.accountCode]) throw new Error(`Akun ${entry.accountCode} tidak dikenal.`)
    if (entry.side === 'DEBIT') debit += entry.amountRupiah
    else credit += entry.amountRupiah
  }
  if (!Number.isSafeInteger(debit) || debit !== credit) throw new Error('Debit dan kredit harus seimbang.')
}

export function prepareJournalStatements(db: any, input: JournalInput, journalId = generateId()) {
  validateJournal(input)
  const statements = [
    db.prepare(`INSERT INTO finance_journals
      (id,idempotency_key,effective_date,description,source_type,source_id,external_reference,actor_type,actor_id,status,reversal_of_id,metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?,'DRAFT',?,?)`).bind(
        journalId, input.idempotencyKey, input.effectiveDate || jakartaDate(), input.description,
        input.sourceType, input.sourceId || null, input.externalReference || null,
        input.actorType, input.actorId || null, input.reversalOfId || null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ),
    ...input.entries.map(entry => db.prepare(`INSERT INTO finance_journal_entries
      (id,journal_id,account_id,side,amount_rupiah,santri_id,asrama_scope,counterparty_type,counterparty_id,memo)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
        generateId(), journalId, ACCOUNT_IDS[entry.accountCode], entry.side, entry.amountRupiah,
        entry.santriId || null, entry.asramaScope || null, entry.counterpartyType || null,
        entry.counterpartyId || null, entry.memo || null,
      )),
  ]
  return { journalId, statements }
}

export function prepareWalletStatements(db: any, journalId: string, movements: WalletMovementInput[]) {
  return movements.map(movement => {
    if (!Number.isSafeInteger(movement.amountRupiah) || movement.amountRupiah === 0) {
      throw new Error('Pergerakan dompet harus berupa rupiah bulat dan bukan nol.')
    }
    return db.prepare(`INSERT INTO finance_wallet_movements
      (id,idempotency_key,journal_id,santri_id,wallet_kind,amount_rupiah,movement_type,reference_type,reference_id)
      VALUES(?,?,?,?,?,?,?,?,?)`).bind(
        generateId(), movement.idempotencyKey, journalId, movement.santriId, movement.walletKind,
        movement.amountRupiah, movement.movementType, movement.referenceType, movement.referenceId,
      )
  })
}

export async function postJournal(input: JournalInput) {
  try {
    const db = await getDB()
    const { journalId, statements } = prepareJournalStatements(db, input)
    statements.push(db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journalId))
    await db.batch(statements)
    return { success: true as const, journalId, duplicate: false }
  } catch (error) {
    const existing = await queryOne<{ id: string }>('SELECT id FROM finance_journals WHERE idempotency_key=?', [input.idempotencyKey]).catch(() => null)
    if (existing) return { success: true as const, journalId: existing.id, duplicate: true }
    return { success: false as const, ...financeError(error) }
  }
}

export async function reverseJournal(input: {
  journalId: string
  idempotencyKey: string
  actorType: JournalInput['actorType']
  actorId?: string | null
  reason: string
}) {
  const original = await queryOne<{
    id: string; effective_date: string; description: string; source_type: string; source_id: string | null
  }>(`SELECT id,effective_date,description,source_type,source_id FROM finance_journals WHERE id=? AND status='POSTED'`, [input.journalId])
  if (!original) return { success: false as const, error: 'Jurnal asal tidak ditemukan.' }
  const db = await getDB()
  const rows = await db.prepare(`SELECT a.code,e.side,e.amount_rupiah,e.santri_id,e.asrama_scope,e.counterparty_type,e.counterparty_id,e.memo
    FROM finance_journal_entries e JOIN finance_accounts a ON a.id=e.account_id WHERE e.journal_id=?`).bind(input.journalId).all()
  return postJournal({
    idempotencyKey: input.idempotencyKey,
    description: `Reversal: ${original.description}`,
    sourceType: 'REVERSAL', sourceId: original.id, actorType: input.actorType, actorId: input.actorId,
    reversalOfId: original.id, metadata: { reason: input.reason },
    entries: (rows.results || []).map((row: any) => ({
      accountCode: row.code, side: row.side === 'DEBIT' ? 'CREDIT' : 'DEBIT', amountRupiah: Number(row.amount_rupiah),
      santriId: row.santri_id, asramaScope: row.asrama_scope, counterpartyType: row.counterparty_type,
      counterpartyId: row.counterparty_id, memo: row.memo,
    })),
  })
}
