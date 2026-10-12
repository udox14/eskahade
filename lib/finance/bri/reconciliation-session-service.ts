// lib/finance/bri/reconciliation-session-service.ts
// Reconciliation Session Management: Tracking Period Runs & Balance Verification

import crypto from 'node:crypto'
import { query, queryOne, generateId, now } from '@/lib/db'
import { briLog } from './logging'
import type {
  BriReconciliationSessionStatus,
  FinanceBriReconciliationSession,
} from './statement-types'

export interface CreateReconciliationSessionInput {
  period: string // YYYY-MM
  accountNo: string
  conductedBy?: string
  notes?: string
}

export interface CompleteReconciliationSessionInput {
  sessionId: string
  fetchedCount: number
  matchedCount: number
  unmatchedCount: number
  ambiguousCount: number
  discrepancyAmount: number
  notes?: string
}

/**
 * Starts a new BRI reconciliation session for a given accounting period and bank account.
 */
export async function startReconciliationSession(
  input: CreateReconciliationSessionInput
): Promise<FinanceBriReconciliationSession> {
  const sessionId = generateId()
  const timestamp = now()
  const randSuffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  const sessionCode = `REC-BRI-${input.period.replace(/-/g, '')}-${randSuffix}`

  await query(
    `INSERT INTO finance_bri_reconciliation_sessions (
       id, session_code, period, account_no, started_at,
       fetched_count, matched_count, unmatched_count, ambiguous_count, discrepancy_amount,
       status, notes, conducted_by, created_at
     ) VALUES (
       ?, ?, ?, ?, ?,
       0, 0, 0, 0, 0,
       'RUNNING', ?, ?, ?
     )`,
    [
      sessionId,
      sessionCode,
      input.period,
      input.accountNo.trim(),
      timestamp,
      input.notes || null,
      input.conductedBy || null,
      timestamp,
    ]
  )

  briLog('info', 'BRI_RECONCILIATION_SESSION_STARTED', {
    details: { sessionId, sessionCode, period: input.period },
  })

  return {
    id: sessionId,
    session_code: sessionCode,
    period: input.period,
    account_no: input.accountNo.trim(),
    started_at: timestamp,
    completed_at: null,
    fetched_count: 0,
    matched_count: 0,
    unmatched_count: 0,
    ambiguous_count: 0,
    discrepancy_amount: 0,
    status: 'RUNNING',
    notes: input.notes || null,
    conducted_by: input.conductedBy || null,
    created_at: timestamp,
  }
}

/**
 * Concludes a reconciliation session, computing whether the run is BALANCED or has DISCREPANCY_OPEN.
 * Never marks BALANCED if there are unmatched credits, ambiguous transactions, or discrepancy amounts!
 */
export async function completeReconciliationSession(
  input: CompleteReconciliationSessionInput
): Promise<FinanceBriReconciliationSession> {
  const timestamp = now()
  const { sessionId, fetchedCount, matchedCount, unmatchedCount, ambiguousCount, discrepancyAmount, notes } = input

  // Invariant: BALANCED requires exactly zero unmatched credits, zero ambiguous items, and zero discrepancy
  const isBalanced = unmatchedCount === 0 && ambiguousCount === 0 && discrepancyAmount === 0
  const finalStatus: BriReconciliationSessionStatus = isBalanced ? 'BALANCED' : 'DISCREPANCY_OPEN'

  await query(
    `UPDATE finance_bri_reconciliation_sessions
     SET completed_at = ?,
         fetched_count = ?,
         matched_count = ?,
         unmatched_count = ?,
         ambiguous_count = ?,
         discrepancy_amount = ?,
         status = ?,
         notes = COALESCE(?, notes)
     WHERE id = ?`,
    [
      timestamp,
      fetchedCount,
      matchedCount,
      unmatchedCount,
      ambiguousCount,
      discrepancyAmount,
      finalStatus,
      notes || null,
      sessionId,
    ]
  )

  const updatedSession = await queryOne<FinanceBriReconciliationSession>(
    `SELECT * FROM finance_bri_reconciliation_sessions WHERE id = ? LIMIT 1`,
    [sessionId]
  )

  if (!updatedSession) {
    throw new Error(`Reconciliation session ${sessionId} not found after completion.`)
  }

  briLog('info', 'BRI_RECONCILIATION_SESSION_COMPLETED', {
    details: {
      sessionId,
      status: finalStatus,
      isBalanced,
      matchedCount,
      unmatchedCount,
      discrepancyAmount,
    },
  })

  return updatedSession
}
