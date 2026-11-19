// lib/finance/bri/statement-service.ts
// SNAP BI v2.1 Bank Statement FETCH (protokol BRIAPI). Persistensi/dedup ada di bank-statement/statement-ingest.ts.

import crypto from 'node:crypto'
import { now } from '@/lib/db'
import { assertBankStatementSyncEnabled } from './feature-flags'
import { isValidIsoDateTimeWithOffset } from '../bank-statement/statement-ingest'
import { BriClient } from './client'
import { loadBriConfig } from './config'
import { BriError } from './errors'
import { briLog, maskAccount } from '../finance-log'
import { BRI_BANK_STATEMENT_POLICY } from './statement-policy'
import {
  BRI_ENDPOINT_EXTERNAL_ID_POLICIES,
  type BriClientResult,
  type BriConfig,
} from './types'
import type { BriBankStatementRequest, BriBankStatementResponse } from '../bank-statement/statement-types'

// Kompatibilitas: pemanggil lama mengimpor persistensi dari modul ini.
export * from '../bank-statement/statement-ingest'

export interface FetchBankStatementOptions {
  accountNo: string
  fromDateTime: string // ISO-8601 with offset, e.g. "2026-10-08T00:00:00+07:00"
  toDateTime: string // ISO-8601 with offset, e.g. "2026-10-08T23:59:59+07:00"
  partnerReferenceNo?: string
  additionalInfo?: Record<string, unknown>
  configOverride?: BriConfig
  customClient?: BriClient
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

