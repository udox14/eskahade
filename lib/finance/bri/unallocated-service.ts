// lib/finance/bri/unallocated-service.ts
// Service for handling Unmatched / Ambiguous Bank Payments (UNALLOCATED Flow)

import crypto from 'node:crypto'
import { query, queryOne, batch, generateId, now } from '@/lib/db'
import { briLog } from './logging'
import type { FinanceBriStatementTransaction } from './statement-types'

export interface RecordUnallocatedStatementInput {
  statementTransactionId: string
  santriId?: string | null
  recordedBy?: string
  reason?: string
}

export interface RecordUnallocatedStatementResult {
  paymentId: string | null
  reconciliationItemId: string
  settlementId: string | null
  amount: number
  alreadyRecorded: boolean
  isIdentifiedStudent: boolean
}

/**
 * Handles unmatched bank statement credits adhering strictly to Anti-Guessing Invariants:
 * 1. KNOWN_STUDENT / KNOWN_VA:
 *    When student identity is proven authoritatively (via active Fixed VA or confirmed student ID):
 *    Materializes payment as PAID + UNALLOCATED (order_id = NULL).
 *    Zero cooperative admin income fabricated without order snapshot.
 *    Settled 1-to-1 against statement transaction.
 *
 * 2. UNIDENTIFIED_BANK_CREDIT:
 *    When student identity cannot be authoritatively established:
 *    DOES NOT fabricate a finance_payments record with a guessed student!
 *    Preserved as raw statement transaction + queued to finance_reconciliation_items (UNMATCHED_EXTERNAL)
 *    for manual authorized operator resolution.
 */
export async function recordUnallocatedStatementPayment(
  input: RecordUnallocatedStatementInput
): Promise<RecordUnallocatedStatementResult> {
  const { statementTransactionId, recordedBy, reason } = input
  const timestamp = now()

  // 1. Fetch statement transaction
  const statementTx = await queryOne<FinanceBriStatementTransaction>(
    `SELECT * FROM finance_bri_statement_transactions WHERE id = ? LIMIT 1`,
    [statementTransactionId]
  )

  if (!statementTx) {
    throw new Error(`Statement transaction ${statementTransactionId} not found.`)
  }

  if (statementTx.type_normalized !== 'CREDIT') {
    throw new Error(`Cannot record an UNALLOCATED payment for a non-CREDIT transaction (${statementTransactionId}).`)
  }

  // Idempotency: check if already recorded
  if (statementTx.match_status === 'UNALLOCATED_RECORDED' && statementTx.matched_payment_id) {
    const existingPayment = await queryOne<{ id: string }>(
      `SELECT id FROM finance_payments WHERE id = ? LIMIT 1`,
      [statementTx.matched_payment_id]
    )
    if (existingPayment) {
      const existingRecItem = await queryOne<{ id: string }>(
        `SELECT id FROM finance_reconciliation_items WHERE payment_id = ? LIMIT 1`,
        [existingPayment.id]
      )
      return {
        paymentId: existingPayment.id,
        reconciliationItemId: existingRecItem?.id || '',
        settlementId: 'EXISTING',
        amount: statementTx.amount,
        alreadyRecorded: true,
        isIdentifiedStudent: true,
      }
    }
  }

  // 2. Resolve target student authoritatively
  // Per BRI-4 contract invariant: BANK_STATEMENT -> STUDENT AUTO IDENTITY = CONTRACT_TBD.
  // Student identity cannot be inferred from statement remark regex; strictly requires operator input.
  let resolvedSantriId: string | null = null
  if (input.santriId) {
    const student = await queryOne<{ id: string }>(
      `SELECT id FROM santri WHERE id = ? LIMIT 1`,
      [input.santriId]
    )
    if (student) resolvedSantriId = student.id
  }

  const statements: Array<{ sql: string; params: unknown[] }> = []
  const reconciliationItemId = generateId()

  // Case A: UNIDENTIFIED_BANK_CREDIT (No authoritative student identity)
  if (!resolvedSantriId) {
    // Check if reconciliation item already queued
    const existingUnmatchedRec = await queryOne<{ id: string }>(
      `SELECT id FROM finance_reconciliation_items
       WHERE external_reference = ? AND match_status = 'UNMATCHED_EXTERNAL' LIMIT 1`,
      [statementTx.transaction_id || statementTx.id]
    )

    if (existingUnmatchedRec) {
      return {
        paymentId: null,
        reconciliationItemId: existingUnmatchedRec.id,
        settlementId: null,
        amount: statementTx.amount,
        alreadyRecorded: true,
        isIdentifiedStudent: false,
      }
    }

    // Queue to finance_reconciliation_items WITHOUT creating a fake finance_payments row
    statements.push({
      sql: `
        INSERT INTO finance_reconciliation_items (
          id, payment_id, settlement_id, cash_session_id, external_reference,
          internal_amount, external_amount, discrepancy_amount,
          match_status, resolution_action, resolution_notes, resolved_by, created_at
        ) VALUES (
          ?, NULL, NULL, NULL, ?,
          0, ?, ?,
          'UNMATCHED_EXTERNAL', 'NONE', ?, ?, ?
        )
      `,
      params: [
        reconciliationItemId,
        statementTx.transaction_id || statementTx.id,
        statementTx.amount,
        statementTx.amount,
        reason || 'Unidentified bank statement credit line awaiting authorized manual identification',
        recordedBy || null,
        timestamp,
      ],
    })

    statements.push({
      sql: `UPDATE finance_bri_statement_transactions SET match_status = 'AMBIGUOUS' WHERE id = ?`,
      params: [statementTransactionId],
    })

    await batch(statements)

    briLog('info', 'BRI_UNIDENTIFIED_STATEMENT_CREDIT_QUEUED', {
      details: {
        statementTransactionId,
        reconciliationItemId,
        amount: statementTx.amount,
      },
    })

    return {
      paymentId: null,
      reconciliationItemId,
      settlementId: null,
      amount: statementTx.amount,
      alreadyRecorded: false,
      isIdentifiedStudent: false,
    }
  }

  // Case B: KNOWN_STUDENT (Authoritative student identity confirmed by authorized operator)
  const paymentId = generateId()
  const dateStr = timestamp.slice(0, 10).replace(/-/g, '')
  const randSuffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  const paymentNumber = `PAY-BRI-UNALLOC-${dateStr}-${randSuffix}`
  const briTrxId = statementTx.bri_trx_id || statementTx.transaction_id || `UNALLOC-${statementTx.id}`
  const settlementId = generateId()
  const settlementItemId = generateId()
  const settlementNumber = `STL-BRI-${dateStr}-${randSuffix}`

  // Step 1: Payment record (order_id = NULL, allocation_status = 'UNALLOCATED', status = 'PAID')
  statements.push({
    sql: `
      INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method,
        gross_amount, cooperative_admin_fee, bri_fee_amount, net_amount,
        status, correction_status, allocation_status, paid_at,
        bri_payment_request_id, bri_trx_id, external_reference,
        source, fund_management, created_at
      ) VALUES (
        ?, ?, NULL, ?, 'BRI', 'BRI_VA',
        ?, 0, NULL, ?,
        'PAID', 'NONE', 'UNALLOCATED', ?,
        ?, ?, ?,
        'NEW_FINANCE', 'KOPERASI', ?
      )
    `,
    params: [
      paymentId,
      paymentNumber,
      resolvedSantriId,
      statementTx.amount,
      statementTx.amount,
      timestamp,
      `UNALLOC-${statementTx.id}`,
      briTrxId,
      statementTx.transaction_id || statementTx.id,
      timestamp,
    ],
  })

  // Step 2: Settlement Batch Header
  statements.push({
    sql: `
      INSERT INTO finance_bri_settlements (
        id, settlement_number, account_no, settlement_date,
        total_payments_count, total_gross_amount, total_cooperative_admin_fee, total_net_amount,
        status, notes, verified_by, created_at
      ) VALUES (?, ?, ?, ?, 1, ?, 0, ?, 'COMPLETED', ?, ?, ?)
    `,
    params: [
      settlementId,
      settlementNumber,
      statementTx.account_no,
      timestamp.slice(0, 10),
      statementTx.amount,
      statementTx.amount,
      'Settlement for identified student unallocated payment',
      recordedBy || null,
      timestamp,
    ],
  })

  // Step 3: Insert reconciliation item FIRST (so settlement_items can reference it if FK checked)
  statements.push({
    sql: `
      INSERT INTO finance_reconciliation_items (
        id, payment_id, settlement_id, cash_session_id, external_reference,
        internal_amount, external_amount, discrepancy_amount,
        match_status, resolution_action, resolution_notes, resolved_by, created_at
      ) VALUES (
        ?, ?, ?, NULL, ?,
        ?, ?, ?,
        'UNALLOCATED_TRANSFER', 'NONE', ?, ?, ?
      )
    `,
    params: [
      reconciliationItemId,
      paymentId,
      settlementId,
      statementTx.transaction_id || statementTx.id,
      statementTx.amount,
      statementTx.amount,
      statementTx.amount,
      reason || 'Identified student payment without order snapshot awaiting manual allocation',
      recordedBy || null,
      timestamp,
    ],
  })

  // Step 4: Insert settlement item with MANUAL_RESOLVED provenance
  statements.push({
    sql: `
      INSERT INTO finance_bri_settlement_items (
        id, settlement_id, payment_id, statement_transaction_id,
        gross_amount, cooperative_admin_fee, net_amount,
        match_strength, match_method, reconciliation_item_id, currency,
        resolved_by, resolution_notes, resolved_at,
        settled_at, created_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, 'MANUAL_RESOLVED', 'MANUAL_UNALLOCATED_IDENTIFICATION', ?, 'IDR', ?, ?, ?, ?, ?)
    `,
    params: [
      settlementItemId,
      settlementId,
      paymentId,
      statementTransactionId,
      statementTx.amount,
      statementTx.amount,
      reconciliationItemId,
      recordedBy || null,
      reason || 'Manual operator resolution of unallocated statement credit',
      timestamp,
      timestamp,
      timestamp,
    ],
  })

  // Step 5: Transition Payment to SETTLED
  statements.push({
    sql: `UPDATE finance_payments SET status = 'SETTLED' WHERE id = ? AND status = 'PAID'`,
    params: [paymentId],
  })

  // Step 6: Update Statement Transaction
  statements.push({
    sql: `
      UPDATE finance_bri_statement_transactions
      SET match_status = 'UNALLOCATED_RECORDED', matched_payment_id = ?
      WHERE id = ?
    `,
    params: [paymentId, statementTransactionId],
  })

  // Execute in atomic database batch
  await batch(statements)

  briLog('info', 'BRI_UNALLOCATED_PAYMENT_RECORDED', {
    details: {
      paymentId,
      reconciliationItemId,
      statementTransactionId,
      amount: statementTx.amount,
      santriId: resolvedSantriId,
    },
  })

  return {
    paymentId,
    reconciliationItemId,
    settlementId,
    amount: statementTx.amount,
    alreadyRecorded: false,
    isIdentifiedStudent: true,
  }
}
