/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { revalidatePath } from 'next/cache'

import { actorFromSession, logActivity } from '@/lib/activity-log'
import { generateId, getDB, query, queryOne } from '@/lib/db'
import { isPoskestrenBendahara, requirePoskestrenFeature } from '@/lib/poskestren/access'
import {
  assertDate,
  cleanText,
  decodeCursor,
  encodeCursor,
  normalizePoskestrenListQuery,
  parsePositiveInteger,
  toFtsPrefixQuery,
} from '@/lib/poskestren/query'
import { POSKESTREN_HREF, type PoskestrenListQuery } from '@/lib/poskestren/types'

const PATH = POSKESTREN_HREF.finance
const refresh = () => {
  revalidatePath(PATH)
  revalidatePath(POSKESTREN_HREF.reports)
}

async function requireTreasurer(action: 'read' | 'create' | 'update' = 'read') {
  const session = await requirePoskestrenFeature(PATH, action)
  if (!isPoskestrenBendahara(session)) throw new Error('Hanya Bendahara POSKESTREN dan admin yang dapat mengakses keuangan.')
  return session
}

async function audit(session: Awaited<ReturnType<typeof requireTreasurer>>, action: string, id: string, summary: string, details?: Record<string, unknown>) {
  await logActivity({
    actor: actorFromSession(session),
    module: 'poskestren_keuangan',
    action,
    fiturHref: PATH,
    logKind: action === 'create' ? 'create' : 'update',
    entityType: 'poskestren_finance_transaction',
    entityId: id,
    summary,
    details,
  })
}

export async function getFinanceMasters() {
  await requireTreasurer()
  const [accounts, categories] = await Promise.all([
    query<any>(
      `SELECT a.id, a.name, a.account_type, a.is_active,
              COALESCE(SUM(
                CASE
                  WHEN t.transaction_type IN ('INCOME','OPENING','TRANSFER_IN') THEN t.amount_rupiah
                  WHEN t.transaction_type IN ('EXPENSE','TRANSFER_OUT') THEN -t.amount_rupiah
                  WHEN t.transaction_type = 'REVERSAL' AND original.transaction_type IN ('EXPENSE','TRANSFER_OUT') THEN t.amount_rupiah
                  WHEN t.transaction_type = 'REVERSAL' THEN -t.amount_rupiah
                  ELSE 0
                END
              ), 0) AS balance
       FROM poskestren_cash_account a
       LEFT JOIN poskestren_finance_transaction t ON t.account_id = a.id
       LEFT JOIN poskestren_finance_transaction original ON original.id = t.linked_transaction_id
       GROUP BY a.id
       ORDER BY a.is_active DESC, a.name`
    ),
    query<any>(
      `SELECT id, name, direction, is_system, is_active
       FROM poskestren_finance_category
       ORDER BY direction, is_system DESC, name`
    ),
  ])
  return { accounts, categories }
}

export async function saveCashAccount(input: { id?: string; name: string; accountType: 'CASH' | 'BANK' | 'EWALLET'; isActive?: boolean }) {
  const session = await requireTreasurer(input.id ? 'update' : 'create')
  const name = cleanText(input.name, 100)
  if (!name) return { success: false as const, error: 'Nama akun wajib diisi.' }
  if (!['CASH', 'BANK', 'EWALLET'].includes(input.accountType)) return { success: false as const, error: 'Jenis akun tidak valid.' }
  const id = input.id || generateId()
  const db = await getDB()
  try {
    if (input.id) {
      await db.prepare(
        `UPDATE poskestren_cash_account
         SET name = ?, account_type = ?, is_active = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).bind(name, input.accountType, input.isActive === false ? 0 : 1, id).run()
    } else {
      await db.prepare(
        `INSERT INTO poskestren_cash_account(id, name, account_type, created_by)
         VALUES (?, ?, ?, ?)`
      ).bind(id, name, input.accountType, session.id).run()
    }
  } catch (error) {
    if (String(error).includes('UNIQUE')) return { success: false as const, error: 'Nama akun sudah digunakan.' }
    throw error
  }
  await audit(session, input.id ? 'update' : 'create', id, `${input.id ? 'Memperbarui' : 'Menambah'} akun ${name}`)
  refresh()
  return { success: true as const, id }
}

export async function saveFinanceCategory(input: { name: string; direction: 'INCOME' | 'EXPENSE' }) {
  const session = await requireTreasurer('create')
  const name = cleanText(input.name, 100)
  if (!name) return { success: false as const, error: 'Nama kategori wajib diisi.' }
  if (!['INCOME', 'EXPENSE'].includes(input.direction)) return { success: false as const, error: 'Arah kategori tidak valid.' }
  const id = generateId()
  try {
    await (await getDB()).prepare(
      `INSERT INTO poskestren_finance_category(id, name, direction, created_by)
       VALUES (?, ?, ?, ?)`
    ).bind(id, name, input.direction, session.id).run()
  } catch (error) {
    if (String(error).includes('UNIQUE')) return { success: false as const, error: 'Kategori tersebut sudah ada.' }
    throw error
  }
  await audit(session, 'create', id, `Menambah kategori ${input.direction === 'INCOME' ? 'pemasukan' : 'pengeluaran'} ${name}`)
  refresh()
  return { success: true as const, id }
}

export async function getLedger(input: PoskestrenListQuery & { accountId?: string; categoryId?: string; transactionType?: string } = {}) {
  await requireTreasurer()
  const normalized = normalizePoskestrenListQuery(input)
  const where = ['1=1']
  const params: unknown[] = []
  if (normalized.from) { where.push('t.transaction_date >= ?'); params.push(normalized.from) }
  if (normalized.to) { where.push('t.transaction_date <= ?'); params.push(normalized.to) }
  if (normalized.status) { where.push('t.status = ?'); params.push(normalized.status) }
  if (input.accountId) { where.push('t.account_id = ?'); params.push(input.accountId) }
  if (input.categoryId) { where.push('t.category_id = ?'); params.push(input.categoryId) }
  if (input.transactionType === 'INCOME') {
    where.push(`(
      t.transaction_type IN ('INCOME','OPENING','TRANSFER_IN')
      OR (t.transaction_type = 'REVERSAL' AND original.transaction_type IN ('EXPENSE','TRANSFER_OUT'))
    )`)
  } else if (input.transactionType === 'EXPENSE') {
    where.push(`(
      t.transaction_type IN ('EXPENSE','TRANSFER_OUT')
      OR (t.transaction_type = 'REVERSAL' AND original.transaction_type IN ('INCOME','OPENING','TRANSFER_IN'))
    )`)
  } else if (input.transactionType) {
    where.push('t.transaction_type = ?')
    params.push(input.transactionType)
  }
  if (normalized.q) {
    const fts = toFtsPrefixQuery(normalized.q)
    if (fts) {
      where.push(`t.id IN (
        SELECT entity_id FROM poskestren_search_fts
        WHERE entity_type = 'FINANCE' AND poskestren_search_fts MATCH ?
      )`)
      params.push(fts)
    }
  }
  const cursor = decodeCursor(normalized.cursor)
  if (cursor && cursor.length === 3) {
    where.push(`(
      t.transaction_date < ? OR
      (t.transaction_date = ? AND t.created_at < ?) OR
      (t.transaction_date = ? AND t.created_at = ? AND t.id < ?)
    )`)
    params.push(cursor[0], cursor[0], cursor[1], cursor[0], cursor[1], cursor[2])
  }
  const rows = await query<any>(
    `SELECT t.id, t.transaction_date, t.transaction_type, t.amount_rupiah,
            t.counterparty, t.description, t.receipt_url, t.status, t.void_reason,
            t.transfer_group_id, t.linked_transaction_id, t.source_type, t.created_at,
            a.name AS account_name, a.account_type,
            c.name AS category_name, u.full_name AS creator_name
     FROM poskestren_finance_transaction t
     JOIN poskestren_cash_account a ON a.id = t.account_id
     LEFT JOIN poskestren_finance_transaction original ON original.id = t.linked_transaction_id
     LEFT JOIN poskestren_finance_category c ON c.id = t.category_id
     LEFT JOIN users u ON u.id = t.created_by
     WHERE ${where.join(' AND ')}
     ORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC
     LIMIT ?`,
    [...params, normalized.limit + 1]
  )
  const hasMore = rows.length > normalized.limit
  const items = rows.slice(0, normalized.limit)
  const last = items.at(-1)
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor([last.transaction_date, last.created_at, last.id]) : null,
    truncated: normalized.isAll && hasMore,
  }
}

export async function getFinanceSummary(input: { from?: string; to?: string; accountId?: string } = {}) {
  await requireTreasurer()
  const where = [`t.status = 'POSTED'`]
  const params: unknown[] = []
  if (input.from) { where.push('t.transaction_date >= ?'); params.push(assertDate(input.from)) }
  if (input.to) { where.push('t.transaction_date <= ?'); params.push(assertDate(input.to)) }
  if (input.accountId) { where.push('t.account_id = ?'); params.push(input.accountId) }
  return queryOne<any>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.transaction_type = 'INCOME' THEN t.amount_rupiah ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN t.transaction_type = 'EXPENSE' THEN t.amount_rupiah ELSE 0 END), 0) AS expense,
       COALESCE(SUM(CASE WHEN t.transaction_type = 'OPENING' THEN t.amount_rupiah ELSE 0 END), 0) AS opening,
       COUNT(CASE WHEN t.transaction_type IN ('INCOME','EXPENSE') THEN 1 END) AS operational_count
     FROM poskestren_finance_transaction t
     WHERE ${where.join(' AND ')}`,
    params
  )
}

export async function createFinanceTransaction(input: {
  transactionDate: string
  transactionType: 'INCOME' | 'EXPENSE' | 'OPENING'
  accountId: string
  categoryId?: string
  amountRupiah: number
  counterparty?: string
  description: string
  receiptUrl?: string
}) {
  const session = await requireTreasurer('create')
  const date = assertDate(input.transactionDate)
  const amount = parsePositiveInteger(input.amountRupiah, 'Nominal')
  const description = cleanText(input.description, 500)
  if (!description) return { success: false as const, error: 'Uraian wajib diisi.' }
  if (!['INCOME', 'EXPENSE', 'OPENING'].includes(input.transactionType)) return { success: false as const, error: 'Jenis transaksi tidak valid.' }
  const account = await queryOne<{ id: string; name: string }>(
    `SELECT id, name FROM poskestren_cash_account WHERE id = ? AND is_active = 1`,
    [input.accountId]
  )
  if (!account) return { success: false as const, error: 'Akun kas tidak valid.' }
  let categoryId: string | null = null
  if (input.transactionType !== 'OPENING') {
    const category = await queryOne<{ id: string }>(
      `SELECT id FROM poskestren_finance_category
       WHERE id = ? AND direction = ? AND is_active = 1`,
      [input.categoryId, input.transactionType]
    )
    if (!category) return { success: false as const, error: 'Kategori transaksi tidak valid.' }
    categoryId = category.id
  }
  const id = generateId()
  const db = await getDB()
  await db.batch([
    db.prepare(
      `INSERT INTO poskestren_finance_transaction(
         id, transaction_date, transaction_type, account_id, category_id,
         amount_rupiah, counterparty, description, receipt_url, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, date, input.transactionType, account.id, categoryId, amount,
      cleanText(input.counterparty, 150), description, cleanText(input.receiptUrl, 500), session.id
    ),
    db.prepare(
      `INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content)
       VALUES ('FINANCE', ?, ?)`
    ).bind(id, [description, input.counterparty, account.name].filter(Boolean).join(' ')),
  ])
  await audit(session, 'create', id, `Mencatat ${input.transactionType.toLowerCase()} ${description}`, { amount_rupiah: amount, account: account.name })
  refresh()
  return { success: true as const, id }
}

export async function createTransfer(input: {
  transactionDate: string
  fromAccountId: string
  toAccountId: string
  amountRupiah: number
  description?: string
}) {
  const session = await requireTreasurer('create')
  const date = assertDate(input.transactionDate)
  const amount = parsePositiveInteger(input.amountRupiah, 'Nominal')
  if (input.fromAccountId === input.toAccountId) return { success: false as const, error: 'Akun asal dan tujuan harus berbeda.' }
  const accounts = await query<{ id: string; name: string }>(
    `SELECT id, name FROM poskestren_cash_account
     WHERE is_active = 1 AND id IN (?, ?)`,
    [input.fromAccountId, input.toAccountId]
  )
  if (accounts.length !== 2) return { success: false as const, error: 'Akun transfer tidak valid.' }
  const from = accounts.find(a => a.id === input.fromAccountId)!
  const to = accounts.find(a => a.id === input.toAccountId)!
  const groupId = generateId()
  const outId = generateId()
  const inId = generateId()
  const description = cleanText(input.description, 500) || `Transfer ${from.name} ke ${to.name}`
  const db = await getDB()
  await db.batch([
    db.prepare(
      `INSERT INTO poskestren_finance_transaction(
         id, transaction_date, transaction_type, account_id, amount_rupiah,
         counterparty, description, transfer_group_id, linked_transaction_id, created_by
       ) VALUES (?, ?, 'TRANSFER_OUT', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(outId, date, from.id, amount, to.name, description, groupId, inId, session.id),
    db.prepare(
      `INSERT INTO poskestren_finance_transaction(
         id, transaction_date, transaction_type, account_id, amount_rupiah,
         counterparty, description, transfer_group_id, linked_transaction_id, created_by
       ) VALUES (?, ?, 'TRANSFER_IN', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(inId, date, to.id, amount, from.name, description, groupId, outId, session.id),
    db.prepare(`INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content) VALUES ('FINANCE', ?, ?)`).bind(outId, description),
    db.prepare(`INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content) VALUES ('FINANCE', ?, ?)`).bind(inId, description),
  ])
  await audit(session, 'create', groupId, `Transfer ${from.name} ke ${to.name}`, { amount_rupiah: amount, out_id: outId, in_id: inId })
  refresh()
  return { success: true as const, id: groupId }
}

export async function voidFinanceTransaction(input: { transactionId: string; reason: string }) {
  const session = await requireTreasurer('update')
  const reason = cleanText(input.reason, 500)
  if (!reason) return { success: false as const, error: 'Alasan void wajib diisi.' }
  const original = await queryOne<any>(
    `SELECT id, transaction_date, transaction_type, account_id, amount_rupiah,
            description, status, transfer_group_id
     FROM poskestren_finance_transaction WHERE id = ?`,
    [input.transactionId]
  )
  if (!original || original.status !== 'POSTED' || original.transaction_type === 'REVERSAL') {
    return { success: false as const, error: 'Transaksi tidak dapat di-void.' }
  }
  const originals = original.transfer_group_id
    ? await query<any>(
      `SELECT id, transaction_date, transaction_type, account_id, amount_rupiah, description
       FROM poskestren_finance_transaction
       WHERE transfer_group_id = ? AND status = 'POSTED' AND transaction_type <> 'REVERSAL'`,
      [original.transfer_group_id]
    )
    : [original]
  const db = await getDB()
  const now = new Date().toISOString()
  const statements: any[] = []
  const reversalIds: string[] = []
  for (const row of originals) {
    const reversalId = generateId()
    reversalIds.push(reversalId)
    statements.push(
      db.prepare(
        `UPDATE poskestren_finance_transaction
         SET status = 'VOID', void_reason = ?, voided_by = ?, voided_at = ?
         WHERE id = ? AND status = 'POSTED'`
      ).bind(reason, session.id, now, row.id),
      db.prepare(
        `INSERT INTO poskestren_finance_transaction(
           id, transaction_date, transaction_type, account_id, amount_rupiah,
           description, transfer_group_id, linked_transaction_id, created_by
         ) VALUES (?, ?, 'REVERSAL', ?, ?, ?, ?, ?, ?)`
      ).bind(
        reversalId, row.transaction_date, row.account_id, row.amount_rupiah,
        `Reversal: ${row.description} — ${reason}`, row.transfer_group_id, row.id, session.id
      ),
      db.prepare(`INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content) VALUES ('FINANCE', ?, ?)`).bind(reversalId, `Reversal ${row.description} ${reason}`)
    )
  }
  await db.batch(statements)
  await audit(session, 'void', original.id, `Void transaksi ${original.description}`, { reason, reversal_ids: reversalIds })
  refresh()
  return { success: true as const, reversalIds }
}
