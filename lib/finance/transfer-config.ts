// lib/finance/transfer-config.ts
// Payment channel settings and destination accounts for manual bank transfer.
// Values live in app_settings / finance_transfer_accounts; every reader fails closed.

import { query, queryOne } from '@/lib/db'

export type PaymentChannelMode = 'BRIVA' | 'TRANSFER' | 'BOTH'

export interface TransferAccount {
  id: string
  bank_name: string
  account_number: string
  account_holder: string
  notes: string | null
  is_active: number
  sort_order: number
}

export interface TransferSettings {
  channelMode: PaymentChannelMode
  uniqueCodeMax: number
  proofDeadlineHours: number
  feeDeductEnabled: boolean
}

export const TRANSFER_SETTING_KEYS = {
  channelMode: 'payment_channel_mode',
  uniqueCodeMax: 'transfer_unique_code_max',
  proofDeadlineHours: 'transfer_proof_deadline_hours',
  feeDeductEnabled: 'transfer_fee_deduct_enabled',
} as const

export const UNIQUE_CODE_MAX_LIMIT = 999
export const UNIQUE_CODE_MIN_LIMIT = 99

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !/^\d+$/.test(value.trim())) return fallback
  const parsed = Number(value.trim())
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

export function parseChannelMode(value: string | null | undefined): PaymentChannelMode {
  return value === 'BRIVA' || value === 'TRANSFER' || value === 'BOTH' ? value : 'TRANSFER'
}

export async function getTransferSettings(): Promise<TransferSettings> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM app_settings WHERE key IN (?, ?, ?, ?)`,
    Object.values(TRANSFER_SETTING_KEYS)
  )
  const map = new Map(rows.map(row => [row.key, row.value]))
  return {
    channelMode: parseChannelMode(map.get(TRANSFER_SETTING_KEYS.channelMode)),
    uniqueCodeMax: boundedInteger(map.get(TRANSFER_SETTING_KEYS.uniqueCodeMax), 999, UNIQUE_CODE_MIN_LIMIT, UNIQUE_CODE_MAX_LIMIT),
    proofDeadlineHours: boundedInteger(map.get(TRANSFER_SETTING_KEYS.proofDeadlineHours), 24, 1, 168),
    feeDeductEnabled: map.get(TRANSFER_SETTING_KEYS.feeDeductEnabled) !== '0',
  }
}

export async function listTransferAccounts(options?: { activeOnly?: boolean }): Promise<TransferAccount[]> {
  return query<TransferAccount>(
    `SELECT id, bank_name, account_number, account_holder, notes, is_active, sort_order
     FROM finance_transfer_accounts
     ${options?.activeOnly ? 'WHERE is_active = 1' : ''}
     ORDER BY is_active DESC, sort_order ASC, bank_name ASC`
  )
}

export async function getActiveTransferAccount(id: string): Promise<TransferAccount | null> {
  return queryOne<TransferAccount>(
    `SELECT id, bank_name, account_number, account_holder, notes, is_active, sort_order
     FROM finance_transfer_accounts WHERE id = ? AND is_active = 1`,
    [id]
  )
}

/** Immutable copy stored on the order/submission; later edits to the account never change it. */
export function transferAccountSnapshot(account: TransferAccount): string {
  return JSON.stringify({
    id: account.id,
    bank_name: account.bank_name,
    account_number: account.account_number,
    account_holder: account.account_holder,
  })
}

export function parseAccountSnapshot(snapshot: string | null | undefined): {
  bank_name: string; account_number: string; account_holder: string
} | null {
  if (!snapshot) return null
  try {
    const value = JSON.parse(snapshot) as Record<string, unknown>
    if (typeof value.bank_name !== 'string' || typeof value.account_number !== 'string' || typeof value.account_holder !== 'string') return null
    return { bank_name: value.bank_name, account_number: value.account_number, account_holder: value.account_holder }
  } catch {
    return null
  }
}

/** Items whose amount may absorb the admin fee (fee mode DEDUCT). SPP and full-payment bills never do. */
export function isFlexibleItem(itemType: string, installmentRule: string | null | undefined): boolean {
  if (itemType === 'UANG_JAJAN') return true
  if (itemType === 'SPP') return false
  if (itemType === 'USPP') return true
  return installmentRule === 'ALLOWED'
}
