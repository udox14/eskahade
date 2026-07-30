import { POSKESTREN_ALL_LIMIT, type PoskestrenListQuery } from './types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function normalizePoskestrenListQuery(input: PoskestrenListQuery = {}) {
  const q = String(input.q || '').trim().slice(0, 80)
  const from = DATE_RE.test(String(input.from || '')) ? String(input.from) : ''
  const to = DATE_RE.test(String(input.to || '')) ? String(input.to) : ''
  const requested = input.limit ?? 20
  const allAllowed = requested === 'all' && Boolean(q || from || to || input.status)
  const limit = allAllowed
    ? POSKESTREN_ALL_LIMIT
    : requested === 50 || requested === 100
      ? requested
      : 20

  return {
    q,
    from,
    to,
    status: String(input.status || '').trim().slice(0, 32),
    cursor: String(input.cursor || '').trim().slice(0, 200),
    limit,
    isAll: allAllowed,
  }
}

export function encodeCursor(parts: Array<string | number | null | undefined>) {
  return btoa(JSON.stringify(parts)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeCursor(value: string) {
  if (!value) return null
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
    const parsed = JSON.parse(atob(padded))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function toFtsPrefixQuery(value: string) {
  const tokens = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
  return tokens.map(token => `"${token.replace(/"/g, '""')}"*`).join(' AND ')
}

export function parseNonNegativeInteger(value: unknown, label: string) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${label} tidak valid.`)
  }
  return number
}

export function parsePositiveInteger(value: unknown, label: string) {
  const number = parseNonNegativeInteger(value, label)
  if (number <= 0) throw new Error(`${label} harus lebih dari 0.`)
  return number
}

export function cleanText(value: unknown, max = 500) {
  const result = String(value ?? '').trim()
  return result ? result.slice(0, max) : null
}

export function assertDate(value: unknown, label = 'Tanggal') {
  const result = String(value || '')
  if (!DATE_RE.test(result)) throw new Error(`${label} tidak valid.`)
  return result
}

