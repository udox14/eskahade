import { generateId, now } from '@/lib/db'
import { rupiah } from './money'
import type { RecordWalletMutationInput } from './wallet'

/** Read balance inside the committing batch. Shared by BRI, corrections and loket. */
export function walletMutationStatements(input: RecordWalletMutationInput) {
  const amount = rupiah(input.amount)
  const id = generateId()
  const timestamp = now()
  const delta = input.direction === 'IN' ? amount : -amount
  if (input.direction !== 'IN' && input.direction !== 'OUT') throw new Error('Arah ledger tidak valid.')
  return { id, timestamp, statements: [
    { sql: `INSERT INTO finance_wallet_ledger
       (id,santri_id,direction,movement_type,amount,balance_before,balance_after,reference_id,cash_session_id,operator_id,notes,created_at)
       SELECT ?,?,?,?,?,balance,balance+?,?,?,?,?,? FROM
       (SELECT COALESCE(SUM(CASE direction WHEN 'IN' THEN amount ELSE -amount END),0) balance FROM finance_wallet_ledger WHERE santri_id=?)`,
      params: [id,input.santriId,input.direction,input.movementType,amount,delta,input.referenceId || null,
        input.cashSessionId || null,input.operatorId || null,input.notes || null,timestamp,input.santriId] },
    { sql: `UPDATE santri SET saldo_uang_jajan=(SELECT COALESCE(SUM(CASE direction WHEN 'IN' THEN amount ELSE -amount END),0)
       FROM finance_wallet_ledger WHERE santri_id=?), updated_at=? WHERE id=?`, params:[input.santriId,timestamp,input.santriId] },
  ] }
}
