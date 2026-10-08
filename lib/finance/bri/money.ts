// lib/finance/bri/money.ts
// Strict decimal money parser for SNAP BI BRIVA contracts without floating point arithmetic

export interface BrivaMoneyParseResult {
  valid: boolean
  rupiah: number
  error?: string
}

/**
 * Parses SNAP BI string decimal amounts (e.g. "153000.00") strictly into integer Rupiah.
 *
 * Strict Rules:
 * 1. Must be an object with string value and currency === 'IDR'.
 * 2. Exactly 2 decimal digits formatted as ".00" (no exponent, no negative, no signs).
 * 3. String arithmetic only (NO parseFloat, NO Number arithmetic on decimals).
 * 4. Reject fractional cents (e.g. ".50"), exponential notation ("1e5"), NaN, overflow.
 * 5. Reject leading zeros (e.g. "00100.00") unless the whole value is "0.00".
 */
export function parseBrivaMoney(amount: unknown): BrivaMoneyParseResult {
  if (!amount || typeof amount !== 'object') {
    return { valid: false, rupiah: 0, error: 'Invalid amount object: must be an object.' }
  }

  const amt = amount as { value?: unknown; currency?: unknown }

  if (amt.currency !== 'IDR') {
    return { valid: false, rupiah: 0, error: `Invalid currency "${amt.currency}". Currency must strictly be "IDR".` }
  }

  if (typeof amt.value !== 'string') {
    return { valid: false, rupiah: 0, error: 'Invalid amount value: value must be a string.' }
  }

  const raw = amt.value.trim()

  // Strict regex: integer digits + exactly ".00"
  // Rejects "10001", "10001.0", "10001.000", "1e5", "-100.00", "10001.50", "NaN", etc.
  if (!/^\d+\.00$/.test(raw)) {
    return {
      valid: false,
      rupiah: 0,
      error: 'Invalid amount format. Value must strictly consist of digits followed by exactly two zero decimals (".00").',
    }
  }

  const dotIndex = raw.indexOf('.')
  const integerPartStr = raw.substring(0, dotIndex)

  // Prevent leading zeros, e.g. "0100.00" (except single "0.00")
  if (integerPartStr.length > 1 && integerPartStr.startsWith('0')) {
    return { valid: false, rupiah: 0, error: 'Invalid amount format: leading zeros are not allowed.' }
  }

  // Reject safe integer overflow (JavaScript Number.MAX_SAFE_INTEGER is 9,007,199,254,740,991, 16 digits)
  if (integerPartStr.length > 15) {
    return { valid: false, rupiah: 0, error: 'Amount exceeds safe integer range.' }
  }

  const rupiah = Number(integerPartStr)
  if (!Number.isSafeInteger(rupiah) || rupiah < 0) {
    return { valid: false, rupiah: 0, error: 'Amount is not a safe non-negative integer.' }
  }

  return { valid: true, rupiah }
}
