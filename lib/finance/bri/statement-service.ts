import { assertBankStatementSyncEnabled } from './feature-flags'
import { sumRupiah } from '../money'
// lib/finance/bri/statement-service.ts
// SNAP BI v2.1 Bank Statement Ingestion, Persistence & Deduplication Service

import crypto from 'node:crypto'
import { query, queryOne, batch, generateId, now } from '@/lib/db'
import { BriClient } from './client'
import { loadBriConfig } from './config'
import { BriError } from './errors'
import { briLog, maskAccount } from './logging'
import { parseBrivaMoney } from './money'
import { BRI_BANK_STATEMENT_POLICY } from './statement-policy'
import {
  BRI_ENDPOINT_EXTERNAL_ID_POLICIES,
  type BriClientResult,
  type BriConfig,
} from './types'
import type {
  BriBankStatementDetailData,
  BriBankStatementRequest,
  BriBankStatementResponse,
  BriIdentityStrength,
  BriTypeNormalized,
  FinanceBriStatementFetch,
  FinanceBriStatementTransaction,
} from './statement-types'

export interface FetchBankStatementOptions {
  accountNo: string
  fromDateTime: string // ISO-8601 with offset, e.g. "2026-10-08T00:00:00+07:00"
  toDateTime: string // ISO-8601 with offset, e.g. "2026-10-08T23:59:59+07:00"
  partnerReferenceNo?: string
  additionalInfo?: Record<string, unknown>
  configOverride?: BriConfig
  customClient?: BriClient
}

export interface StatementIngestSummary {
  fetchId: string
  fetchReferenceNo: string
  accountNo: string
  totalFetched: number
  newTransactionsCount: number
  dedupedCount: number
  creditsCount: number
  creditsTotalAmount: number
  debitsCount: number
  debitsTotalAmount: number
  rawResponseHash: string
  cursorAdvanced: boolean
  hasDiscrepancy: boolean
}

/**
 * Validates ISO-8601 datetime strings with timezone offset
 * e.g. "2026-10-08T00:00:00+07:00" or "2026-10-08T00:00:00Z"
 */
export function isValidIsoDateTimeWithOffset(dtStr: string): boolean {
  if (typeof dtStr !== 'string') return false
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
  if(!isoRegex.test(dtStr.trim()) || !Number.isFinite(Date.parse(dtStr)))return false
  const [year,month,day,hour,minute,second]=dtStr.trim().slice(0,19).split(/[-T:]/).map(Number)
  const days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31]
  return month>=1&&month<=12&&day>=1&&day<=days[month-1]&&hour<24&&minute<60&&second<60
}

/**
 * Normalizes an ISO datetime string into UTC ISO string if valid, else returns null
 */
export function normalizeToUtc(isoStr: string): string | null {
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}

/**
 * Normalizes statement transaction type case-insensitively to canonical CREDIT or DEBIT.
 * Fails closed on unknown / ambiguous types.
 */
export function normalizeStatementType(typeRaw: string): BriTypeNormalized {
  if (typeof typeRaw !== 'string') {
    throw new Error(`Invalid statement type: expected string, received ${typeof typeRaw}`)
  }
  const clean = typeRaw.trim().toUpperCase()
  if (clean === 'CREDIT') return 'CREDIT'
  if (clean === 'DEBIT') return 'DEBIT'
  throw new Error(`Unrecognized statement transaction type "${typeRaw}". Must be exact CREDIT or DEBIT (abbreviations CR, DB, DR are strictly disallowed).`)
}

/**
 * Generates deterministic composite dedup key for a statement transaction line.
 * Implements Identity Strength:
 * - STRONG: When transactionId is present: accountNo + transactionId (dedupKey = hash, weakFingerprint = null)
 * - WEAK: When transactionId is absent: canonical fingerprint of all transaction evidence fields
 */
export function generateStatementTransactionDedupKey(params: {
  accountNo: string
  transactionId?: string | null
  trxDateTimeRaw: string
  amountRaw: string
  typeNormalized: BriTypeNormalized
  currency?: string
  remark?: string | null
  remarkCustom?: string | null
  startBalanceRaw?: string | null
  endBalanceRaw?: string | null
}): { dedupKey: string; identityStrength: BriIdentityStrength; weakFingerprint: string | null } {
  const accountClean = params.accountNo.trim()

  if (params.transactionId && params.transactionId.trim().length > 0) {
    const txIdClean = params.transactionId.trim()
    const rawKey = `STRONG|${accountClean}|${txIdClean}`
    return {
      dedupKey: crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex'),
      identityStrength: 'STRONG',
      weakFingerprint: null,
    }
  }

  const timeClean = params.trxDateTimeRaw.trim()
  const amtClean = params.amountRaw.trim()
  const typeClean = params.typeNormalized
  const currClean = (params.currency || 'IDR').trim().toUpperCase()
  const remarkClean = (params.remark || '').trim()
  const remarkCustomClean = (params.remarkCustom || '').trim()
  const startBalClean = (params.startBalanceRaw || '').trim()
  const endBalClean = (params.endBalanceRaw || '').trim()

  const rawKey = `WEAK|${accountClean}|${timeClean}|${typeClean}|${amtClean}|${currClean}|${remarkClean}|${remarkCustomClean}|${startBalClean}|${endBalClean}`
  const weakFingerprint = crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex')
  return {
    dedupKey: weakFingerprint,
    identityStrength: 'WEAK',
    weakFingerprint,
  }
}

/**
 * Extracts possible Virtual Account number or reference from transaction remark
 */
export function extractVaAndReferenceFromRemark(remark?: string | null): {
  vaNumber?: string
  briTrxId?: string
} {
  if (!remark || typeof remark !== 'string') return {}

  const res: { vaNumber?: string; briTrxId?: string } = {}

  // Look for 13-18 digit numeric strings (typical BRIVA format: partnerServiceId + customerNo)
  const vaMatch = remark.match(/\b(\d{13,18})\b/)
  if (vaMatch) {
    res.vaNumber = vaMatch[1]
  }

  // Look for TRX or REF patterns e.g. "TRX-12345" or "REF-12345"
  const refMatch = remark.match(/\b(TRX-?[A-Za-z0-9]+|REF-?[A-Za-z0-9]+)\b/i)
  if (refMatch) {
    res.briTrxId = refMatch[1]
  }

  return res
}

/**
 * Fetches Bank Statement from BRI via official SNAP BI v2.1 contract.
 * Path: POST /snap/v2.1/bank-statement
 * External ID: Numeric 9-digit
 * Service Code: 14
 */
export async function fetchBankStatement(
  options: FetchBankStatementOptions
): Promise<BriClientResult<BriBankStatementResponse>> {
  assertBankStatementSyncEnabled()
  const startTime = Date.now()
  const config = options.configOverride || loadBriConfig()

  // 1. Operational Outbound Kill Switch Guard (fail-closed with zero network calls)
  if (!config.outboundEnabled) {
    briLog('warn', 'BRI_BANK_STATEMENT_DISABLED', {
      details: { account: maskAccount(options.accountNo) },
    })
    throw new BriError(
      'CONFIG_ERROR',
      'BRI outbound operations are disabled by operational kill switch (BRI_OUTBOUND_ENABLED=false).'
    )
  }

  // 1b. Validate Account Binding against Configured Collection Account
  if (config.collectionAccountNo && options.accountNo.trim() !== config.collectionAccountNo.trim()) {
    throw new BriError(
      'CONFIG_ERROR',
      `Requested accountNo "${options.accountNo}" does not match configured collection account (${config.collectionAccountNo}).`
    )
  }

  // 2. Validate Mandatory DateTime Arguments per SNAP BI v2.1
  if (!options.fromDateTime || !options.toDateTime) {
    throw new BriError(
      'CONFIG_ERROR',
      'fromDateTime and toDateTime are strictly mandatory for SNAP BI v2.1 Bank Statement.'
    )
  }

  if (!isValidIsoDateTimeWithOffset(options.fromDateTime)) {
    throw new BriError(
      'CONFIG_ERROR',
      `Invalid fromDateTime format: "${options.fromDateTime}". Must be ISO-8601 with timezone offset (e.g. 2026-10-08T00:00:00+07:00).`
    )
  }

  if (!isValidIsoDateTimeWithOffset(options.toDateTime)) {
    throw new BriError(
      'CONFIG_ERROR',
      `Invalid toDateTime format: "${options.toDateTime}". Must be ISO-8601 with timezone offset (e.g. 2026-10-08T23:59:59+07:00).`
    )
  }

  // 3. Prepare Request Payload
  const dateStr = now().slice(0, 10).replace(/-/g, '')
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  const partnerReferenceNo = options.partnerReferenceNo || `BS-${dateStr}-${randomSuffix}`

  const requestBody: BriBankStatementRequest = {
    partnerReferenceNo,
    accountNo: options.accountNo.trim(),
    fromDateTime: options.fromDateTime.trim(),
    toDateTime: options.toDateTime.trim(),
    additionalInfo: options.additionalInfo,
  }

  const client = options.customClient || new BriClient({ config })

  // 4. Execute Signed Request with 9-digit External-ID Policy
  briLog('info', 'BRI_BANK_STATEMENT_FETCH_INITIATED', {
    endpoint: '/snap/v2.1/bank-statement',
    details: {
      account: maskAccount(options.accountNo),
      from: options.fromDateTime,
      to: options.toDateTime,
      partnerReferenceNo,
    },
  })

  const result = await client.executeSignedRequest<BriBankStatementResponse>({
    method: 'POST',
    endpointPath: '/snap/v2.1/bank-statement',
    body: requestBody,
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT,
    responsePolicy: BRI_BANK_STATEMENT_POLICY,
  })

  briLog('info', 'BRI_BANK_STATEMENT_FETCH_COMPLETED', {
    endpoint: '/snap/v2.1/bank-statement',
    durationMs: Date.now() - startTime,
    externalId: result.externalId,
    details: {
      account: maskAccount(options.accountNo),
      responseCode: result.data.responseCode,
      itemsCount: result.data.detailData?.length || 0,
    },
  })

  return result
}

/**
 * Persists and deduplicates fetched bank statement transactions into Cloudflare D1.
 * Enforces:
 * 1. Independent fetch_reference_no on fetches (never used as transaction dedup identity).
 * 2. Identity strength: STRONG for transactionId, WEAK for canonical fingerprint.
 * 3. CREDIT/DEBIT normalized values.
 * 4. Statement totals cross-check: discrepancies block cursor advancement.
 * 5. Safe handling of empty detailData success.
 */
export async function persistBankStatementTransactions(params: {
  accountNo: string
  fromDateTime: string
  toDateTime: string
  response: BriBankStatementResponse
  rawResponseJson: string
}): Promise<StatementIngestSummary> {
  const { accountNo, fromDateTime, toDateTime, response, rawResponseJson } = params
  const fetchId = generateId()
  const timestamp = now()
  const rawResponseHash = crypto.createHash('sha256').update(rawResponseJson, 'utf8').digest('hex')

  const dateStr = timestamp.slice(0, 10).replace(/-/g, '')
  const randHex = crypto.randomBytes(3).toString('hex').toUpperCase()
  // Store fetch reference strictly on the fetch record
  const fetchReferenceNo = response.referenceNo || response.partnerReferenceNo
    ? `${response.referenceNo || response.partnerReferenceNo}-${randHex}`
    : `BS-${dateStr}-${randHex}`

  let validationError=false
  const items = Array.isArray(response.detailData) ? response.detailData : []
  if(response.detailData!==undefined && !Array.isArray(response.detailData))validationError=true
  if(response.accountNo && response.accountNo!==accountNo)validationError=true
  if(!isValidIsoDateTimeWithOffset(fromDateTime) || !isValidIsoDateTimeWithOffset(toDateTime) || Date.parse(fromDateTime)>Date.parse(toDateTime))throw new Error('Invalid statement window')
  const seenIds=new Set<string>()
  for(const item of items) {
    if(!item || typeof item!=='object' || !isValidIsoDateTimeWithOffset(item.transactionDate) || typeof item.remark!=='string' ||
       Date.parse(item.transactionDate)<Date.parse(fromDateTime) || Date.parse(item.transactionDate)>Date.parse(toDateTime) ||
       !parseBrivaMoney(item.amount).valid || (item.detailInfo!==undefined && typeof item.detailInfo?.remarkCustom!=='string'))validationError=true
    try { normalizeStatementType(item?.type) } catch {validationError=true}
    if(item?.transactionId) {
      if(typeof item.transactionId!=='string' || seenIds.has(item.transactionId))validationError=true
      seenIds.add(item.transactionId)
      const old=await queryOne<{amount:number;currency:string;transaction_date_raw:string;type_normalized:string}>(`SELECT amount,currency,transaction_date_raw,type_normalized FROM finance_bri_statement_transactions WHERE account_no=? AND transaction_id=? AND identity_strength='STRONG'`,[accountNo,item.transactionId])
      if(old && (old.amount!==parseBrivaMoney(item.amount).rupiah || old.currency!==item.amount.currency || Date.parse(old.transaction_date_raw)!==Date.parse(item.transactionDate) || old.type_normalized!==normalizeStatementType(item.type)))validationError=true
    }
    for(const balance of [item?.detailBalance?.startAmount,item?.detailBalance?.endAmount])if(balance!==undefined && (!Array.isArray(balance) || balance.some(v=>!parseBrivaMoney(v?.amount).valid)))validationError=true
  }
  let creditsCount = 0
  let creditsTotalAmount = 0
  let debitsCount = 0
  let debitsTotalAmount = 0

  const processedLines: Array<{
    id: string
    transactionId: string | null
    identityStrength: BriIdentityStrength
    dedupKey: string
    weakFingerprint: string | null
    trxDateTimeRaw: string
    trxDateTimeUtc: string | null
    typeRaw: string
    typeNormalized: BriTypeNormalized
    amount: number
    amountRaw: string
    currency: string
    remark: string | null
    remarkCustom: string | null
    startBalanceRaw: string | null
    endBalanceRaw: string | null
    briTrxId: string | null
    vaNumber: string | null
    rawJson: string
    rawEvidenceHash: string
    matchStatus: string
  }> = []

  for (const item of validationError ? [] : items) {
    const typeNormalized = normalizeStatementType(item.type)
    const moneyParsed = parseBrivaMoney(item.amount)

    if (!moneyParsed.valid) {
      briLog('warn', 'BRI_STATEMENT_ITEM_AMOUNT_PARSE_ERROR', {
        details: {
          error: moneyParsed.error,
          rawValue: item.amount?.value,
          currency: item.amount?.currency,
        },
      })
      throw new Error('Malformed statement amount')
    }

    const amountRupiah = moneyParsed.rupiah
    if (typeNormalized === 'CREDIT') {
      creditsCount++
      creditsTotalAmount = sumRupiah([creditsTotalAmount,amountRupiah])
    } else {
      debitsCount++
      debitsTotalAmount = sumRupiah([debitsTotalAmount,amountRupiah])
    }

    const startBalRaw = item.detailBalance?.startAmount?.[0]?.amount.value || null
    const endBalRaw = item.detailBalance?.endAmount?.[0]?.amount.value || null
    const remarkCustom = typeof item.detailInfo?.remarkCustom === 'string' ? item.detailInfo.remarkCustom : null

    const { dedupKey, identityStrength, weakFingerprint } = generateStatementTransactionDedupKey({
      accountNo,
      transactionId: item.transactionId,
      trxDateTimeRaw: item.transactionDate,
      amountRaw: item.amount.value,
      typeNormalized,
      currency: item.amount.currency,
      remark: item.remark,
      remarkCustom,
      startBalanceRaw: startBalRaw,
      endBalanceRaw: endBalRaw,
    })

    const extracted = extractVaAndReferenceFromRemark(item.remark)
    const briTrxId = null // Statement transactionId/remark reference is NOT the BRIVA trxId
    const vaNumber = extracted.vaNumber || null

    const rawJson = JSON.stringify(item)
    const rawEvidenceHash = crypto.createHash('sha256').update(rawJson, 'utf8').digest('hex')

    processedLines.push({
      id: generateId(),
      transactionId: item.transactionId || null,
      identityStrength,
      dedupKey,
      weakFingerprint,
      trxDateTimeRaw: item.transactionDate,
      trxDateTimeUtc: normalizeToUtc(item.transactionDate),
      typeRaw: item.type,
      typeNormalized,
      amount: amountRupiah,
      amountRaw: item.amount.value,
      currency: item.amount.currency || 'IDR',
      remark: item.remark || null,
      remarkCustom,
      startBalanceRaw: startBalRaw,
      endBalanceRaw: endBalRaw,
      briTrxId,
      vaNumber,
      rawJson,
      rawEvidenceHash,
      matchStatus: typeNormalized === 'DEBIT' ? 'IGNORED_DEBIT' : 'UNMATCHED',
    })
  }

  // 1. Cross-check Statement Totals Consistency (Finding #14)
  let hasDiscrepancy=validationError
  for(const [totals,count,amount] of [[response.totalCreditEntries,creditsCount,creditsTotalAmount],[response.totalDebitEntries,debitsCount,debitsTotalAmount]] as const) {
    if(totals!==undefined) {
      const parsed=parseBrivaMoney(totals?.amount)
      if(!totals || typeof totals!=='object' || !parsed.valid || parsed.rupiah!==amount)hasDiscrepancy=true
      if(totals?.numberOfEntries!==undefined && (!/^\d+$/.test(String(totals.numberOfEntries)) || !Number.isSafeInteger(Number(totals.numberOfEntries)) || Number(totals.numberOfEntries)!==count))hasDiscrepancy=true
    }
  }

  // Response code 2001400 is strictly required for success and cursor advance.
  // 4041401 (Transaction Not Found) or errors are provider failures: status FAILED, cursor does NOT advance.
  const isSuccess200 = response.responseCode === '2001400'
  const cursorAdvanced = !hasDiscrepancy && isSuccess200
  const fetchStatus = hasDiscrepancy ? 'DISCREPANCY' : (isSuccess200 ? 'SUCCESS' : 'FAILED')

  // 2. Insert Fetch Audit Row
  const statements: Array<{ sql: string; params: unknown[] }> = [
    {
      sql: `
        INSERT INTO finance_bri_statement_fetches (
          id, fetch_reference_no, account_no, from_date_time, to_date_time,
          total_items_fetched, total_credits_count, total_credits_amount,
          total_debits_count, total_debits_amount, status,
          response_code, response_message, cursor_advanced, body_hash, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        fetchId,
        fetchReferenceNo,
        accountNo,
        fromDateTime,
        toDateTime,
        isSuccess200 ? items.length : 0,
        isSuccess200 ? creditsCount : 0,
        isSuccess200 ? creditsTotalAmount : 0,
        isSuccess200 ? debitsCount : 0,
        isSuccess200 ? debitsTotalAmount : 0,
        fetchStatus,
        response.responseCode,
        response.responseMessage,
        cursorAdvanced ? 1 : 0,
        rawResponseHash,
        timestamp,
      ],
    },
  ]

  // If fetch failed (e.g. 4041401 Transaction Not Found), abort processing lines: zero transactions, zero settlement
  if (!isSuccess200 || hasDiscrepancy) {
    await batch(statements)
    return {
      fetchId,
      fetchReferenceNo,
      accountNo,
      totalFetched: 0,
      newTransactionsCount: 0,
      dedupedCount: 0,
      creditsCount: 0,
      creditsTotalAmount: 0,
      debitsCount: 0,
      debitsTotalAmount: 0,
      rawResponseHash,
      cursorAdvanced: false,
      hasDiscrepancy,
    }
  }

  // 3. Process Lines: Non-Destructive WEAK Identity & Strong Unique Dedup
  let dedupedCount = 0
  let newTransactionsCount = 0

  // Count occurrences of weak fingerprints within the current batch
  const batchWeakCounts = new Map<string, number>()
  for (const line of processedLines) {
    if (line.identityStrength === 'WEAK' && line.weakFingerprint) {
      batchWeakCounts.set(line.weakFingerprint, (batchWeakCounts.get(line.weakFingerprint) || 0) + 1)
    }
  }

  for (const line of processedLines) {
    if (line.identityStrength === 'STRONG') {
      // STRONG identity: hard unique dedup by accountNo + transactionId
      const existing = await queryOne<{ id: string; observation_count: number }>(
        `SELECT id, observation_count FROM finance_bri_statement_transactions WHERE identity_strength = 'STRONG' AND dedup_key = ? LIMIT 1`,
        [line.dedupKey]
      )

      if (existing) {
        dedupedCount++
        statements.push({
          sql: `UPDATE finance_bri_statement_transactions
                SET last_seen_at = ?, observation_count = observation_count + 1
                WHERE id = ?`,
          params: [timestamp, existing.id],
        })
      } else {
        newTransactionsCount++
        statements.push({
          sql: `
            INSERT INTO finance_bri_statement_transactions (
              id, fetch_id, account_no, transaction_id, identity_strength, dedup_key, weak_fingerprint,
              transaction_date_raw, transaction_date_utc, type_raw, type_normalized,
              amount, amount_raw, currency, remark, remark_custom,
              start_balance_raw, end_balance_raw,
              bri_trx_id, va_number, observation_count, raw_evidence_hash,
              match_status, matched_payment_id,
              first_seen_at, last_seen_at, raw_json, created_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?,
              ?, ?, 1, ?,
              ?, NULL,
              ?, ?, ?, ?
            )
          `,
          params: [
            line.id,
            fetchId,
            accountNo,
            line.transactionId,
            line.identityStrength,
            line.dedupKey,
            null, // weak_fingerprint is NULL for STRONG
            line.trxDateTimeRaw,
            line.trxDateTimeUtc,
            line.typeRaw,
            line.typeNormalized,
            line.amount,
            line.amountRaw,
            line.currency,
            line.remark,
            line.remarkCustom,
            line.startBalanceRaw,
            line.endBalanceRaw,
            line.briTrxId,
            line.vaNumber,
            line.rawEvidenceHash,
            line.matchStatus,
            timestamp,
            timestamp,
            line.rawJson,
            timestamp,
          ],
        })
      }
    } else {
      // WEAK identity: Non-destructive preservation
      // Check if identical weak fingerprint exists from prior fetches
      const existingPriorWeak = await query<{ id: string; match_status: string }>(
        `SELECT id, match_status FROM finance_bri_statement_transactions WHERE identity_strength = 'WEAK' AND weak_fingerprint = ?`,
        [line.weakFingerprint]
      )

      const hasBatchDuplicate = (batchWeakCounts.get(line.weakFingerprint!) || 0) > 1
      const hasPriorDuplicate = (existingPriorWeak?.length || 0) > 0

      // If duplicate weak fingerprint exists in current batch OR across windows,
      // it is AMBIGUOUS: both rows must be preserved, never destructive-merged, never auto-settled!
      let weakMatchStatus = line.typeNormalized === 'DEBIT' ? 'IGNORED_DEBIT' : 'UNMATCHED'
      if (hasBatchDuplicate || hasPriorDuplicate) {
        weakMatchStatus = line.typeNormalized === 'DEBIT' ? 'IGNORED_DEBIT' : 'AMBIGUOUS'
        if (hasPriorDuplicate && line.typeNormalized === 'CREDIT') {
          // Flag prior matching weak rows as AMBIGUOUS as well
          statements.push({
            sql: `UPDATE finance_bri_statement_transactions
                  SET match_status = 'AMBIGUOUS'
                  WHERE identity_strength = 'WEAK' AND weak_fingerprint = ? AND match_status = 'UNMATCHED'`,
            params: [line.weakFingerprint],
          })
        }
      }

      newTransactionsCount++
      statements.push({
        sql: `
          INSERT INTO finance_bri_statement_transactions (
            id, fetch_id, account_no, transaction_id, identity_strength, dedup_key, weak_fingerprint,
            transaction_date_raw, transaction_date_utc, type_raw, type_normalized,
            amount, amount_raw, currency, remark, remark_custom,
            start_balance_raw, end_balance_raw,
            bri_trx_id, va_number, observation_count, raw_evidence_hash,
            match_status, matched_payment_id,
            first_seen_at, last_seen_at, raw_json, created_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, 1, ?,
            ?, NULL,
            ?, ?, ?, ?
          )
        `,
        params: [
          line.id,
          fetchId,
          accountNo,
          line.transactionId,
          line.identityStrength,
          line.dedupKey,
          line.weakFingerprint,
          line.trxDateTimeRaw,
          line.trxDateTimeUtc,
          line.typeRaw,
          line.typeNormalized,
          line.amount,
          line.amountRaw,
          line.currency,
          line.remark,
          line.remarkCustom,
          line.startBalanceRaw,
          line.endBalanceRaw,
          line.briTrxId,
          line.vaNumber,
          line.rawEvidenceHash,
          weakMatchStatus,
          timestamp,
          timestamp,
          line.rawJson,
          timestamp,
        ],
      })
    }
  }

  // Execute in atomic database batch
  await batch(statements)

  return {
    fetchId,
    fetchReferenceNo,
    accountNo,
    totalFetched: items.length,
    newTransactionsCount,
    dedupedCount,
    creditsCount,
    creditsTotalAmount,
    debitsCount,
    debitsTotalAmount,
    rawResponseHash,
    cursorAdvanced,
    hasDiscrepancy,
  }
}
