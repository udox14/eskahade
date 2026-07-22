import { getFinanceDB as getDB, generateId, financeQueryOne as queryOne } from '@/lib/db'
import { resolveCredential, verifyStudentPin } from './credentials'
import { assertIntegerRupiah, financeError } from './errors'
import { prepareJournalStatements } from './ledger'
import type { CredentialKind } from './types'

export async function withdrawPocketMoney(input: {
  idempotencyKey: string
  credentialKind: CredentialKind
  rawToken: string
  pin: string
  amountRupiah: number
  cashUnitId: string
  shiftId: string
  operatorId: string
  terminalId: string
  identityConfirmed: boolean
}) {
  try {
    assertIntegerRupiah(input.amountRupiah)
    if (!input.identityConfirmed) throw new Error('Operator wajib mengonfirmasi kecocokan foto dan identitas.')
    const credential = await resolveCredential(input.credentialKind, input.rawToken)
    if (!credential) throw new Error('Credential tidak aktif atau tidak sesuai mode saat ini.')
    if (!await verifyStudentPin(credential.santri_id, input.pin)) throw new Error('PIN salah atau sementara diblokir.')

    const withdrawalId = generateId()
    const db = await getDB()
    const journal = prepareJournalStatements(db, {
      idempotencyKey: `withdrawal:${input.idempotencyKey}`,
      description: 'Pencairan uang jajan', sourceType: 'WITHDRAWAL', sourceId: withdrawalId,
      actorType: 'STAFF', actorId: input.operatorId,
      entries: [
        { accountCode: '2105', side: 'DEBIT', amountRupiah: input.amountRupiah, santriId: credential.santri_id },
        { accountCode: '1104', side: 'CREDIT', amountRupiah: input.amountRupiah, santriId: credential.santri_id },
      ],
    })
    await db.batch([
      ...journal.statements,
      db.prepare(`INSERT INTO finance_withdrawals
        (id,idempotency_key,santri_id,credential_id,credential_kind,cash_unit_id,shift_id,operator_id,terminal_id,amount_rupiah,pin_verified_at,identity_confirmed,journal_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,datetime('now'),1,?)`).bind(
          withdrawalId, input.idempotencyKey, credential.santri_id, credential.id, credential.credential_kind,
          input.cashUnitId, input.shiftId, input.operatorId, input.terminalId, input.amountRupiah, journal.journalId,
        ),
      db.prepare(`UPDATE student_credentials SET last_used_at=datetime('now') WHERE id=?`).bind(credential.id),
      db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
      db.prepare(`INSERT INTO finance_outbox(id,event_type,aggregate_type,aggregate_id,payload_json) VALUES(?,?,?,?,?)`).bind(
        generateId(), 'POCKET_MONEY_WITHDRAWN', 'WITHDRAWAL', withdrawalId,
        JSON.stringify({ santriId: credential.santri_id, amountRupiah: input.amountRupiah }),
      ),
    ])
    return { success: true as const, withdrawalId, santriId: credential.santri_id }
  } catch (error) {
    const existing = await queryOne<{ id: string; santri_id: string }>('SELECT id,santri_id FROM finance_withdrawals WHERE idempotency_key=?', [input.idempotencyKey]).catch(() => null)
    if (existing) return { success: true as const, withdrawalId: existing.id, santriId: existing.santri_id, duplicate: true }
    return { success: false as const, ...financeError(error) }
  }
}
