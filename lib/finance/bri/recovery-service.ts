// lib/finance/bri/recovery-service.ts
// Recovery Service: Transaction Status Inquiry Seam & Missed-Webhook Recovery Engine

import crypto from 'node:crypto'
import { query, queryOne, batch, generateId, now } from '@/lib/db'
import { briLog } from './logging'
import {
  BRIVA_STATUS_INQUIRY_CONTRACT_STATE,
  type BriTransactionStatusInquiryRequest,
  type BriTransactionStatusInquiryResponse,
  type FinanceBriRecoveryQueueItem,
  type FinanceBriStatementTransaction,
} from './statement-types'

export interface RecoverMissedWebhookInput {
  statementTransactionId: string
  orderId: string
  recoveredBy?: string
  recoveryNotes?: string
}

export interface RecoverMissedWebhookResult {
  paymentId: string
  settlementId: string
  orderId: string
  recoveryQueueId?: string
  status: 'RECOVERED_AND_SETTLED'
  alreadyRecovered: boolean
}

/**
 * Transaction Status Inquiry Abstraction
 * Officially marked per PRD: BRIVA TRANSACTION STATUS INQUIRY CONTRACT: TBD / BLOCKED BY BRI CONTRACT.
 * Does not make fake network requests, guess endpoints, or invent fake response codes.
 */
export class BriTransactionStatusInquiryService {
  /**
   * Status Inquiry Contract Status
   */
  static readonly contractState = BRIVA_STATUS_INQUIRY_CONTRACT_STATE

  /**
   * Queries status of an in-flight transaction at BRI.
   * Fail-safes cleanly as TBD until exact endpoint and body contract are provided.
   */
  async queryTransactionStatus(
    _request: BriTransactionStatusInquiryRequest
  ): Promise<BriTransactionStatusInquiryResponse> {
    briLog('warn', 'BRI_STATUS_INQUIRY_CONTRACT_TBD', {
      details: {
        contractState: BRIVA_STATUS_INQUIRY_CONTRACT_STATE,
        message: 'Transaction Status Inquiry transport is pending official BRI contract specification.',
      },
    })

    return {
      status: BRIVA_STATUS_INQUIRY_CONTRACT_STATE,
      message: 'BRIVA TRANSACTION STATUS INQUIRY CONTRACT: TBD / BLOCKED BY BRI CONTRACT',
    }
  }
}

/**
 * Recovers a payment that succeeded at the bank but whose webhook was lost or timed out,
 * using Bank Statement as the authoritative independent evidence.
 *
 * Enforces Hard Guards:
 * 1. Statement transaction must be CREDIT.
 * 2. Order must be PENDING (if CANCELLED, e.g. from CASH payment, automated allocation is blocked to prevent double posting).
 * 3. Exact-amount matching between order total_charged and statement amount.
 * 4. Atomic batch insertion: allocations, wallet ledger, coop income, settlement item, and transition to SETTLED.
 */
export async function recoverMissedPaymentFromStatement(
  input: RecoverMissedWebhookInput
): Promise<RecoverMissedWebhookResult> {
  const { statementTransactionId, orderId, recoveredBy, recoveryNotes } = input
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
    throw new Error(`Cannot recover payment from a non-CREDIT statement transaction (${statementTransactionId}, type: ${statementTx.type_normalized}).`)
  }

  // 2. Fetch target order
  const order = await queryOne<{
    id: string
    order_number: string
    santri_id: string
    status: string
    gross_amount: number
    cooperative_admin_fee: number
    total_charged: number
    payment_method: string
  }>(
    `SELECT id, order_number, santri_id, status, gross_amount, cooperative_admin_fee, total_charged, payment_method
     FROM finance_payment_orders
     WHERE id = ?
     LIMIT 1`,
    [orderId]
  )

  if (!order) {
    throw new Error(`Order ${orderId} not found.`)
  }

  // Idempotency check: If order is already PAID, check if payment already materialized
  if (order.status === 'PAID') {
    const existingPayment = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM finance_payments WHERE order_id = ? LIMIT 1`,
      [order.id]
    )
    if (existingPayment) {
      briLog('info', 'BRI_RECOVERY_ORDER_ALREADY_PAID', {
        details: { orderId: order.id, paymentId: existingPayment.id },
      })
      return {
        paymentId: existingPayment.id,
        settlementId: 'EXISTING',
        orderId: order.id,
        status: 'RECOVERED_AND_SETTLED',
        alreadyRecovered: true,
      }
    }
  }

  // Hard Guard: If order was CANCELLED (e.g. parent paid with CASH at loket),
  // DO NOT recreate original allocation automatically! Flag discrepancy and abort.
  if (order.status === 'CANCELLED' || order.status === 'EXPIRED' || order.status === 'REPLACED') {
    // Record into recovery queue as DISCREPANCY for manual investigation
    const queueId = generateId()
    await query(
      `INSERT INTO finance_bri_recovery_queue (
         id, order_id, santri_id, virtual_account_no,
         expected_amount, recovery_status, statement_transaction_id,
         reason, notes, created_at
       ) VALUES (
         ?, ?, ?, ?,
         ?, 'DISCREPANCY', ?,
         'ORDER_STATUS_NOT_PENDING', ?, ?
       )`,
      [
        queueId,
        order.id,
        order.santri_id,
        statementTx.va_number || 'UNKNOWN',
        order.total_charged,
        statementTransactionId,
        `Order was in ${order.status} state when bank statement credit arrived (possible cash payment race). Automated allocation blocked.`,
        timestamp,
      ]
    )

    throw new Error(
      `RECOVERY_GUARD_ABORT: Target order ${order.id} is in ${order.status} status. Automated allocation blocked to prevent double allocation.`
    )
  }

  if (order.status !== 'PENDING') {
    throw new Error(`Target order ${order.id} is not in PENDING status (current status: ${order.status}).`)
  }

  if (order.payment_method !== 'BRI_VA') {
    throw new Error(`Target order ${order.id} payment method is ${order.payment_method}, expected BRI_VA.`)
  }

  if (order.total_charged !== statementTx.amount) {
    throw new Error(
      `Amount mismatch: order total_charged is ${order.total_charged}, but statement transaction amount is ${statementTx.amount}.`
    )
  }

  // 3. Load order items
  const orderItems = await query<{
    id: string
    obligation_id: string | null
    item_type: string
    amount: number
  }>(
    `SELECT id, obligation_id, item_type, amount FROM finance_order_items WHERE order_id = ?`,
    [order.id]
  )

  // 4. Check UANG_JAJAN presence and current balance
  const hasUangJajan = orderItems.some((item) => item.item_type === 'UANG_JAJAN')
  let currentWalletBalance = 0
  if (hasUangJajan) {
    const balanceRow = await queryOne<{ balance: number }>(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0) as balance
       FROM finance_wallet_ledger
       WHERE santri_id = ?`,
      [order.santri_id]
    )
    currentWalletBalance = balanceRow?.balance || 0
  }

  // 5. Construct Atomic Financial Batch
  const paymentId = generateId()
  const dateStr = timestamp.slice(0, 10).replace(/-/g, '')
  const randPayment = crypto.randomBytes(3).toString('hex').toUpperCase()
  const paymentNumber = `PAY-BRI-${dateStr}-${randPayment}`
  const briTrxId = statementTx.bri_trx_id || statementTx.transaction_id || `STMT-${statementTx.id}`
  const briPaymentRequestId = `REC-${statementTx.id}`
  const recMetaId = generateId()
  const eventId = generateId()
  const settlementId = generateId()
  const settlementItemId = generateId()
  const randSettlement = crypto.randomBytes(3).toString('hex').toUpperCase()
  const settlementNumber = `STL-BRI-${dateStr}-${randSettlement}`

  const statements: Array<{ sql: string; params: unknown[] }> = []

  // Step A: Gateway Event
  statements.push({
    sql: `
      INSERT INTO finance_gateway_events (
        id, gateway_name, event_key, merchant_order_id, event_type,
        signature_valid, payload_json, response_code, is_processed,
        processing_status, created_at
      ) VALUES (?, 'BRI', ?, ?, 'STATEMENT_RECOVERY', 1, ?, '2001400', 1, 'PROCESSED', ?)
    `,
    params: [
      eventId,
      `briva_rec_${statementTx.id}`,
      order.order_number,
      JSON.stringify({
        recoveredFromStatementId: statementTx.id,
        statementAmount: statementTx.amount,
        dedupKey: statementTx.dedup_key,
        recoveredBy: recoveredBy || 'SYSTEM',
        notes: recoveryNotes || 'Recovered from authoritative Bank Statement',
      }),
      timestamp,
    ],
  })

  // Step B: Payment Record (Created with status 'PAID', then transitioned to 'SETTLED')
  statements.push({
    sql: `
      INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method,
        gross_amount, cooperative_admin_fee, bri_fee_amount, net_amount,
        status, correction_status, allocation_status, paid_at,
        bri_payment_request_id, bri_trx_id, external_reference,
        source, fund_management, created_at
      ) VALUES (
        ?, ?, ?, ?, 'BRI', 'BRI_VA',
        ?, ?, NULL, ?,
        'PAID', 'NONE', 'ALLOCATED', ?,
        ?, ?, ?,
        'NEW_FINANCE', 'KOPERASI', ?
      )
    `,
    params: [
      paymentId,
      paymentNumber,
      order.id,
      order.santri_id,
      order.gross_amount,
      order.cooperative_admin_fee,
      order.gross_amount,
      timestamp,
      briPaymentRequestId,
      briTrxId,
      statementTx.transaction_id || statementTx.id,
      timestamp,
    ],
  })

  // Step C: Reconciliation Metadata
  statements.push({
    sql: `
      INSERT INTO finance_briva_reconciliation_metadata (
        id, payment_id, order_id, virtual_account_no, partner_service_id,
        customer_no, paid_amount, trx_date_time, payment_request_id,
        bri_trx_id, reference_no, source_bank_code, channel_code,
        body_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '002', 'STATEMENT', ?, ?)
    `,
    params: [
      recMetaId,
      paymentId,
      order.id,
      statementTx.va_number || 'UNKNOWN_VA',
      '001901',
      order.santri_id,
      statementTx.amount,
      statementTx.transaction_date_raw,
      briPaymentRequestId,
      briTrxId,
      statementTx.transaction_id || statementTx.id,
      statementTx.dedup_key,
      timestamp,
    ],
  })

  // Step D: Payment Allocations
  for (const item of orderItems) {
    const allocId = generateId()
    if (item.obligation_id) {
      statements.push({
        sql: `
          INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type,
            provider_id, amount, disbursed_amount, distribution_status, created_at
          )
          SELECT
            ?, ?, ?, 'OBLIGATION', ?, provider_id, ?, 0, 'UNDISBURSED', ?
          FROM finance_obligations
          WHERE id = ?
        `,
        params: [
          allocId,
          paymentId,
          item.obligation_id,
          item.item_type,
          item.amount,
          timestamp,
          item.obligation_id,
        ],
      })

      statements.push({
        sql: `
          UPDATE finance_obligations
          SET amount_paid = amount_paid + ?,
              status = CASE
                WHEN (amount_paid + ?) >= amount_expected THEN 'PAID'
                ELSE 'PARTIALLY_PAID'
              END,
              updated_at = ?
          WHERE id = ?
        `,
        params: [item.amount, item.amount, timestamp, item.obligation_id],
      })
    } else {
      statements.push({
        sql: `
          INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type,
            provider_id, amount, disbursed_amount, distribution_status, created_at
          ) VALUES (?, ?, NULL, 'UANG_JAJAN', 'UANG_JAJAN', NULL, ?, 0, 'UNDISBURSED', ?)
        `,
        params: [allocId, paymentId, item.amount, timestamp],
      })
    }

    if (item.item_type === 'UANG_JAJAN') {
      const ledgerId = generateId()
      const newBal = currentWalletBalance + item.amount
      statements.push({
        sql: `
          INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, amount, balance_before,
            balance_after, source, channel, payment_id, notes, created_at
          ) VALUES (?, ?, 'IN', ?, ?, ?, 'TOPUP_BRIVA', 'BRI', ?, 'Top-up saldo Uang Jajan (Recovered dari Rekening Koran)', ?)
        `,
        params: [ledgerId, order.santri_id, item.amount, currentWalletBalance, newBal, paymentId, timestamp],
      })
      currentWalletBalance = newBal
    }
  }

  // Step E: Cooperative Admin Income
  if (order.cooperative_admin_fee > 0) {
    const incomeId = generateId()
    const incomeNumber = `INC-KOP-${timestamp.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    statements.push({
      sql: `
        INSERT INTO finance_cooperative_income (
          id, income_number, entry_type, reference_income_id, correction_id,
          payment_id, order_id, amount, rule_id, rule_snapshot,
          reference_note, created_by, created_at
        ) VALUES (?, ?, 'INCOME', NULL, NULL, ?, ?, ?, NULL, NULL, ?, NULL, ?)
      `,
      params: [
        incomeId,
        incomeNumber,
        paymentId,
        order.id,
        order.cooperative_admin_fee,
        'Pendapatan Biaya Operasional Koperasi atas pembayaran BRIVA (Recovered)',
        timestamp,
      ],
    })
  }

  // Step F: Update Order to PAID
  statements.push({
    sql: `
      UPDATE finance_payment_orders
      SET status = 'PAID', updated_at = ?
      WHERE id = ? AND status = 'PENDING'
    `,
    params: [timestamp, order.id],
  })

  // Step G: Create Settlement Batch & Item FIRST
  statements.push({
    sql: `
      INSERT INTO finance_bri_settlements (
        id, settlement_number, account_no, settlement_date,
        total_payments_count, total_gross_amount, total_cooperative_admin_fee, total_net_amount,
        status, notes, verified_by, created_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'COMPLETED', ?, ?, ?)
    `,
    params: [
      settlementId,
      settlementNumber,
      statementTx.account_no,
      timestamp.slice(0, 10),
      order.gross_amount,
      order.cooperative_admin_fee,
      order.gross_amount,
      'Recovered from Bank Statement match',
      recoveredBy || null,
      timestamp,
    ],
  })

  statements.push({
    sql: `
      INSERT INTO finance_bri_settlement_items (
        id, settlement_id, payment_id, statement_transaction_id,
        gross_amount, cooperative_admin_fee, net_amount,
        match_strength, match_method, reconciliation_item_id, currency,
        resolved_by, resolution_notes, resolved_at,
        settled_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'AUTHORITATIVE_EXACT', 'RECOVERY_BANK_STATEMENT_MATCH', NULL, 'IDR', ?, ?, ?, ?, ?)
    `,
    params: [
      settlementItemId,
      settlementId,
      paymentId,
      statementTransactionId,
      order.gross_amount,
      order.cooperative_admin_fee,
      order.gross_amount,
      recoveredBy || null,
      recoveryNotes || 'Recovered from authoritative Bank Statement match',
      timestamp,
      timestamp,
      timestamp,
    ],
  })

  // Step H: Update Payment to SETTLED (Trigger verifies settlement item exists!)
  statements.push({
    sql: `
      UPDATE finance_payments
      SET status = 'SETTLED'
      WHERE id = ? AND status = 'PAID'
    `,
    params: [paymentId],
  })

  // Step I: Update Statement Transaction
  statements.push({
    sql: `
      UPDATE finance_bri_statement_transactions
      SET match_status = 'MATCHED', matched_payment_id = ?
      WHERE id = ?
    `,
    params: [paymentId, statementTransactionId],
  })

  // Execute entire batch atomically
  await batch(statements)

  briLog('info', 'BRI_MISSED_PAYMENT_RECOVERED_AND_SETTLED', {
    details: {
      orderId: order.id,
      paymentId,
      statementTransactionId,
      settlementId,
      totalCharged: order.total_charged,
    },
  })

  return {
    paymentId,
    settlementId,
    orderId: order.id,
    status: 'RECOVERED_AND_SETTLED',
    alreadyRecovered: false,
  }
}
