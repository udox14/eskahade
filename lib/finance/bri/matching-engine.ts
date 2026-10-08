// lib/finance/bri/matching-engine.ts
// Deterministic Matching Engine for Bank Statement Transactions vs Internal Ledger

import { query, queryOne } from '@/lib/db'
import type {
  BriMatchResult,
  BriMatchingStrength,
  FinanceBriStatementTransaction,
} from './statement-types'

/**
 * Cross-Product Contract Declaration
 * Public BRI Bank Statement contract does NOT establish that detailData.transactionId == BRIVA Payment trxId.
 * Marked explicitly as CONTRACT_TBD.
 */
export const BANK_STATEMENT_CROSS_PRODUCT_STATE = 'CONTRACT_TBD' as const

/**
 * Bank Statement Student Identity Declaration
 * Public BRI Bank Statement contract does NOT document virtualAccountNo or customerNo.
 * Regex parsing of remarks cannot authoritatively establish student identity.
 * Marked explicitly as CONTRACT_TBD.
 */
export const BANK_STATEMENT_STUDENT_AUTO_IDENTITY = 'CONTRACT_TBD' as const

export interface CandidatePaymentSummary {
  id: string
  payment_number: string
  santri_id: string
  order_id: string | null
  status: 'PAID' | 'SETTLED'
  gross_amount: number
  cooperative_admin_fee: number
  total_charged: number
  paid_at: string
  bri_trx_id: string | null
  bri_payment_request_id: string | null
}

export interface MatchStatementOptions {
  authoritativeCrossProductLink?: boolean
}

/**
 * Deterministically matches a single Bank Statement transaction to internal payments.
 * Strictly adheres to Matching Strength Separation:
 * - AUTHORITATIVE_EXACT: Only when an authoritative cross-product identifier link is proven by official contract.
 * - CANDIDATE: Matching candidates exist based on candidate signals (amount, time, remark), but identity is not authoritative.
 * - AMBIGUOUS: Multiple candidates exist with identical amounts or ambiguous signals. Never guessed!
 * - NO_MATCH: Zero candidates found.
 */
export async function matchStatementTransaction(
  statementTx: FinanceBriStatementTransaction,
  options?: MatchStatementOptions
): Promise<BriMatchResult> {
  // 0. Ignore Debit transactions
  if (statementTx.type_normalized === 'DEBIT') {
    return {
      classification: 'IGNORED_DEBIT',
      matchingStrength: 'NO_MATCH',
      statementTransactionId: statementTx.id,
      candidatePaymentsCount: 0,
      details: {
        statementAmount: statementTx.amount,
        notes: 'Debit transaction (bank fee/outflow) ignored from settlement matching.',
      },
    }
  }

  const isCrossProductAuthoritative = options?.authoritativeCrossProductLink === true

  // 1. Authoritative Cross-Product Match (Only permitted if authoritative contract link is enabled)
  if (isCrossProductAuthoritative && (statementTx.transaction_id || statementTx.bri_trx_id)) {
    const lookupId = statementTx.bri_trx_id || statementTx.transaction_id
    const paymentByTrxId = await queryOne<CandidatePaymentSummary>(
      `SELECT
         p.id, p.payment_number, p.santri_id, p.order_id, p.status,
         p.gross_amount, p.cooperative_admin_fee,
         (p.gross_amount + p.cooperative_admin_fee) AS total_charged,
         p.paid_at, p.bri_trx_id, p.bri_payment_request_id
       FROM finance_payments p
       WHERE p.channel = 'BRI' AND (p.bri_trx_id = ? OR p.external_reference = ?)
       LIMIT 1`,
      [lookupId, lookupId]
    )

    if (paymentByTrxId) {
      if (paymentByTrxId.total_charged !== statementTx.amount) {
        return {
          classification: 'AMOUNT_MISMATCH',
          matchingStrength: 'NO_MATCH',
          statementTransactionId: statementTx.id,
          matchedPaymentId: paymentByTrxId.id,
          candidatePaymentsCount: 1,
          details: {
            statementAmount: statementTx.amount,
            paymentAmount: paymentByTrxId.total_charged,
            briTrxId: lookupId || undefined,
            notes: `Amount mismatch: statement has ${statementTx.amount}, payment has ${paymentByTrxId.total_charged}.`,
          },
        }
      }

      if (paymentByTrxId.status === 'SETTLED') {
        return {
          classification: 'ALREADY_SETTLED',
          matchingStrength: 'AUTHORITATIVE_EXACT',
          statementTransactionId: statementTx.id,
          matchedPaymentId: paymentByTrxId.id,
          candidatePaymentsCount: 1,
          details: {
            statementAmount: statementTx.amount,
            paymentAmount: paymentByTrxId.total_charged,
            briTrxId: lookupId || undefined,
            notes: 'Payment is already settled in database.',
          },
        }
      }

      return {
        classification: 'EXACT_MATCH',
        matchingStrength: 'AUTHORITATIVE_EXACT',
        statementTransactionId: statementTx.id,
        matchedPaymentId: paymentByTrxId.id,
        matchedOrderId: paymentByTrxId.order_id || undefined,
        candidatePaymentsCount: 1,
        details: {
          statementAmount: statementTx.amount,
          paymentAmount: paymentByTrxId.total_charged,
          briTrxId: lookupId || undefined,
          notes: 'Matched authoritatively via confirmed cross-product identifier.',
        },
      }
    }
  }

  // 2. Candidate Search: Match by Virtual Account number + exact amount (Candidate evidence only)
  if (statementTx.va_number) {
    const studentVa = await queryOne<{ santri_id: string; status: string }>(
      `SELECT santri_id, status FROM finance_student_va WHERE va_number = ? LIMIT 1`,
      [statementTx.va_number]
    )

    if (studentVa) {
      const candidates = await query<CandidatePaymentSummary>(
        `SELECT
           p.id, p.payment_number, p.santri_id, p.order_id, p.status,
           p.gross_amount, p.cooperative_admin_fee,
           (p.gross_amount + p.cooperative_admin_fee) AS total_charged,
           p.paid_at, p.bri_trx_id, p.bri_payment_request_id
         FROM finance_payments p
         WHERE p.channel = 'BRI'
           AND p.santri_id = ?
           AND (p.gross_amount + p.cooperative_admin_fee) = ?
         ORDER BY p.paid_at DESC`,
        [studentVa.santri_id, statementTx.amount]
      )

      if (candidates.length === 1) {
        const singleCand = candidates[0]
        if (singleCand.status === 'SETTLED') {
          return {
            classification: 'ALREADY_SETTLED',
            matchingStrength: 'CANDIDATE',
            statementTransactionId: statementTx.id,
            matchedPaymentId: singleCand.id,
            candidatePaymentsCount: 1,
            details: {
              statementAmount: statementTx.amount,
              paymentAmount: singleCand.total_charged,
              vaNumber: statementTx.va_number,
              notes: 'Payment for this candidate VA and amount is already settled.',
            },
          }
        }

        // Without an official authoritative VA field in Bank Statement (CONTRACT_TBD),
        // VA regex correlation is strictly CANDIDATE evidence, never AUTHORITATIVE_EXACT.
        return {
          classification: 'EXACT_MATCH',
          matchingStrength: 'CANDIDATE',
          statementTransactionId: statementTx.id,
          matchedPaymentId: singleCand.id,
          matchedOrderId: singleCand.order_id || undefined,
          candidatePaymentsCount: 1,
          details: {
            statementAmount: statementTx.amount,
            paymentAmount: singleCand.total_charged,
            vaNumber: statementTx.va_number,
            notes: 'Candidate match via VA and amount (BANK_STATEMENT -> STUDENT AUTO IDENTITY = CONTRACT_TBD). Requires verification before settlement.',
          },
        }
      }

      if (candidates.length > 1) {
        // Multiple candidate payments with identical amount: AMBIGUOUS (Never guess!)
        return {
          classification: 'AMBIGUOUS',
          matchingStrength: 'AMBIGUOUS',
          statementTransactionId: statementTx.id,
          candidatePaymentsCount: candidates.length,
          details: {
            statementAmount: statementTx.amount,
            vaNumber: statementTx.va_number,
            notes: `Found ${candidates.length} candidate payments with identical amount for student ${studentVa.santri_id}. Ambiguous resolution required.`,
          },
        }
      }
    }
  }

  // 3. Fallback: No candidate match found
  return {
    classification: 'NO_MATCH',
    matchingStrength: 'NO_MATCH',
    statementTransactionId: statementTx.id,
    candidatePaymentsCount: 0,
    details: {
      statementAmount: statementTx.amount,
      vaNumber: statementTx.va_number || undefined,
      notes: 'No matching payment found for this statement transaction.',
    },
  }
}
