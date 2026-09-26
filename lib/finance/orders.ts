// lib/finance/orders.ts
// Modul Payment Order Engine (Fase 3A)
// Mengelola siklus pesanan pembayaran, kalkulasi fee, dan validasi kewajiban

import { query, queryOne, batch, execute, generateId, now } from '@/lib/db'
import { getStudentFixedVa } from '@/lib/finance/va'
import { assertSantriBillable } from '@/lib/finance/non-billable-santri'
import type {
  FinancePaymentOrder,
  FinanceOrderItem,
  PaymentOrderWithItems,
  CreatePaymentOrderInput,
  FinanceOrderStatus,
  FinanceObligation,
} from '@/lib/finance/types'

function generateOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${datePart}-${randomSuffix}`
}

/**
 * Membuat Payment Order (checkout pembayaran) baru.
 * Penegakan aturan bisnis PRD:
 * 1. Santri harus terdaftar dan berstatus aktif.
 * 2. Item order tidak boleh kosong dan nominal > 0.
 * 3. Untuk item kewajiban (obligation):
 *    - Harus milik santri yang bersangkutan.
 *    - Status bukan 'PAID' atau 'EXEMPTED'.
 *    - Nominal tidak boleh melebihi sisa tagihan (effective_expected - amount_paid).
 *    - Jika installment_rule = 'DISALLOWED' (misal SPP), nominal wajib lunas penuh sisa tagihan.
 * 4. Kalkulasi biaya gateway:
 *    - CUSTOMER: total_charged = gross_amount + gateway_fee
 *    - INSTITUTION: total_charged = gross_amount (disubsidi pesantren)
 * 5. Jika metode DUITKU_VA, menyematkan nomor Fixed VA santri jika sudah terdaftar.
 * 6. Eksekusi atomik header order + detail items via db.batch().
 */
export async function createPaymentOrder(
  input: CreatePaymentOrderInput
): Promise<PaymentOrderWithItems> {
  const santriId = input.santriId
  const payerType = input.payerType
  const feePayer = input.feePayer ?? 'CUSTOMER'
  const gatewayFee = Math.max(0, Math.floor(input.gatewayFee ?? 0))
  const expiresInHours = input.expiresInHours ?? 24
  const paymentMethod = input.paymentMethod ?? null
  const cashSessionId = input.cashSessionId ?? null

  if (!input.items || input.items.length === 0) {
    throw new Error('Pesanan pembayaran wajib memuat minimal 1 item pembayaran.')
  }

  // 1. Validasi Santri Aktif
  const student = await queryOne<{ id: string; status_global: string; asrama: string | null; nama_lengkap: string }>(
    `SELECT id, status_global, asrama, nama_lengkap FROM santri WHERE id = ?`,
    [santriId]
  )
  if (!student) {
    throw new Error(`Santri dengan ID "${santriId}" tidak ditemukan.`)
  }
  if (student.status_global !== 'aktif') {
    throw new Error(
      `Tidak dapat membuat order pembayaran untuk santri berstatus "${student.status_global}".`
    )
  }
  assertSantriBillable(student.asrama, student.nama_lengkap)

  // 2. Validasi Item-Item & Kewajiban
  let grossAmount = 0
  const preparedOrderItems: Array<{
    id: string
    obligationId: string | null
    itemType: string
    amount: number
  }> = []
  const seenObligationIds = new Set<string>()

  for (const item of input.items) {
    const amount = Math.floor(item.amount)
    if (amount <= 0) {
      throw new Error(`Nominal item "${item.itemType}" harus lebih besar dari 0.`)
    }

    if (item.obligationId) {
      const obligation = await queryOne<
        FinanceObligation & { installment_rule?: string }
      >(
        `SELECT o.id, o.santri_id, o.item_type, o.amount_expected, o.amount_exempted,
                o.amount_paid, o.status, t.installment_rule
         FROM finance_obligations o
         LEFT JOIN finance_tariffs t ON o.tariff_id = t.id
         WHERE o.id = ?`,
        [item.obligationId]
      )

      if (!obligation) {
        throw new Error(`Kewajiban dengan ID "${item.obligationId}" tidak ditemukan.`)
      }
      if (obligation.santri_id !== santriId) {
        throw new Error(
          `Kewajiban "${obligation.item_type}" (${obligation.id}) bukan milik santri yang dituju.`
        )
      }
      if (obligation.status === 'PAID') {
        throw new Error(
          `Kewajiban "${obligation.item_type}" sudah berstatus LUNAS (PAID).`
        )
      }
      if (obligation.status === 'EXEMPTED') {
        throw new Error(
          `Kewajiban "${obligation.item_type}" sudah dibebaskan penuh (EXEMPTED).`
        )
      }

      const effectiveExpected = Math.max(0, obligation.amount_expected - obligation.amount_exempted)
      const remaining = Math.max(0, effectiveExpected - obligation.amount_paid)

      if (seenObligationIds.has(obligation.id)) {
        throw new Error(
          `Kewajiban "${obligation.item_type}" (${obligation.id}) tercantum lebih dari satu kali dalam pesanan yang sama.`
        )
      }
      seenObligationIds.add(obligation.id)

      if (amount > remaining) {
        throw new Error(
          `Nominal pembayaran Rp ${amount.toLocaleString('id-ID')} melebihi sisa tagihan Rp ${remaining.toLocaleString('id-ID')} untuk ${obligation.item_type}.`
        )
      }

      // Aturan kaku PRD: SPP / DISALLOWED tidak boleh dicicil
      const isDisallowed = obligation.installment_rule === 'DISALLOWED' || obligation.item_type === 'SPP'
      if (isDisallowed && amount !== remaining) {
        throw new Error(
          `Kewajiban "${obligation.item_type}" tidak dapat dicicil. Nominal pembayaran wajib lunas penuh sebesar sisa tagihan (Rp ${remaining.toLocaleString('id-ID')}).`
        )
      }

      preparedOrderItems.push({
        id: generateId(),
        obligationId: obligation.id,
        itemType: obligation.item_type,
        amount,
      })
    } else {
      // Top-up Uang Jajan atau item tanpa obligation ID
      if (item.itemType !== 'UANG_JAJAN') {
        throw new Error(
          `Item tanpa obligation_id hanya diizinkan untuk tipe 'UANG_JAJAN', diterima: "${item.itemType}".`
        )
      }

      // Guard: Pastikan tabel authoritative finance_wallet_ledger sudah tersedia (Fase 5)
      const walletLedgerTable = await queryOne<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='finance_wallet_ledger'`
      )
      if (!walletLedgerTable) {
        throw new Error(
          'Top-up Uang Jajan ditangguhkan (deferred): modul dompet santri dan authoritative ledger (finance_wallet_ledger) baru tersedia pada Fase 5.'
        )
      }

      preparedOrderItems.push({
        id: generateId(),
        obligationId: null,
        itemType: 'UANG_JAJAN',
        amount,
      })
    }

    grossAmount += amount
  }

  // 3. Kalkulasi Total Tagihan (Gross + Fee)
  const totalCharged = feePayer === 'CUSTOMER' ? grossAmount + gatewayFee : grossAmount

  // 4. Fixed VA Lookup jika metode DUITKU_VA
  let fixedVaNumber: string | null = null
  if (paymentMethod === 'DUITKU_VA') {
    const studentVa = await getStudentFixedVa(santriId)
    if (studentVa) {
      fixedVaNumber = studentVa.va_number
    }
  }

  const orderId = generateId()
  const orderNumber = generateOrderNumber()
  const timestamp = now()
  const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()

  // 5. Batch Insert Atomik
  const statements: Array<{ sql: string; params: unknown[] }> = []

  statements.push({
    sql: `
      INSERT INTO finance_payment_orders (
        id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
        fee_payer, total_charged, payment_method, fixed_va_number, status,
        expires_at, cash_session_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
    `,
    params: [
      orderId,
      orderNumber,
      santriId,
      payerType,
      grossAmount,
      gatewayFee,
      feePayer,
      totalCharged,
      paymentMethod,
      fixedVaNumber,
      expiresAt,
      cashSessionId,
      timestamp,
      timestamp,
    ],
  })

  for (const item of preparedOrderItems) {
    statements.push({
      sql: `
        INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
        VALUES (?, ?, ?, ?, ?)
      `,
      params: [item.id, orderId, item.obligationId, item.itemType, item.amount],
    })
  }

  await batch(statements)

  const createdOrder = await getPaymentOrderById(orderId)
  if (!createdOrder) {
    throw new Error('Gagal mengambil data pesanan pembayaran setelah pembuatan.')
  }

  return createdOrder
}

/**
 * Mengambil Payment Order beserta item-itemnya berdasarkan order ID.
 */
export async function getPaymentOrderById(
  orderId: string
): Promise<PaymentOrderWithItems | null> {
  const order = await queryOne<FinancePaymentOrder>(
    `SELECT id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, payment_method, fixed_va_number, status,
            expires_at, cash_session_id, created_at, updated_at
     FROM finance_payment_orders
     WHERE id = ?`,
    [orderId]
  )

  if (!order) return null

  const items = await query<FinanceOrderItem>(
    `SELECT id, order_id, obligation_id, item_type, amount
     FROM finance_order_items
     WHERE order_id = ?
     ORDER BY rowid ASC`,
    [orderId]
  )

  return {
    ...order,
    items,
  }
}

/**
 * Mencari Payment Order berdasarkan order_number.
 */
export async function getPaymentOrderByNumber(
  orderNumber: string
): Promise<PaymentOrderWithItems | null> {
  const order = await queryOne<FinancePaymentOrder>(
    `SELECT id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, payment_method, fixed_va_number, status,
            expires_at, cash_session_id, created_at, updated_at
     FROM finance_payment_orders
     WHERE order_number = ?`,
    [orderNumber]
  )

  if (!order) return null

  const items = await query<FinanceOrderItem>(
    `SELECT id, order_id, obligation_id, item_type, amount
     FROM finance_order_items
     WHERE order_id = ?
     ORDER BY rowid ASC`,
    [order.id]
  )

  return {
    ...order,
    items,
  }
}

/**
 * Membatalkan Payment Order yang masih PENDING.
 */
export async function cancelPaymentOrder(
  orderId: string,
  _reason?: string
): Promise<FinancePaymentOrder> {
  const order = await queryOne<FinancePaymentOrder>(
    `SELECT id, status FROM finance_payment_orders WHERE id = ?`,
    [orderId]
  )

  if (!order) {
    throw new Error(`Order dengan ID "${orderId}" tidak ditemukan.`)
  }
  if (order.status !== 'PENDING') {
    throw new Error(
      `Hanya pesanan berstatus 'PENDING' yang dapat dibatalkan. Status saat ini: "${order.status}".`
    )
  }

  const timestamp = now()
  await execute(
    `UPDATE finance_payment_orders
     SET status = 'CANCELLED', updated_at = ?
     WHERE id = ? AND status = 'PENDING'`,
    [timestamp, orderId]
  )

  const updated = await queryOne<FinancePaymentOrder>(
    `SELECT id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, payment_method, fixed_va_number, status,
            expires_at, cash_session_id, created_at, updated_at
     FROM finance_payment_orders
     WHERE id = ?`,
    [orderId]
  )

  if (!updated) {
    throw new Error('Gagal mengambil data order setelah pembatalan.')
  }
  return updated
}

/**
 * Menyapu order PENDING yang sudah melewati batas expires_at menjadi EXPIRED.
 */
export async function expirePendingOrders(): Promise<{ expiredCount: number }> {
  const currentTime = now()

  // Dapatkan daftar order yang expired
  const expiredOrders = await query<{ id: string }>(
    `SELECT id FROM finance_payment_orders
     WHERE status = 'PENDING' AND expires_at < ?`,
    [currentTime]
  )

  if (expiredOrders.length === 0) {
    return { expiredCount: 0 }
  }

  await execute(
    `UPDATE finance_payment_orders
     SET status = 'EXPIRED', updated_at = ?
     WHERE status = 'PENDING' AND expires_at < ?`,
    [currentTime, currentTime]
  )

  return { expiredCount: expiredOrders.length }
}

/**
 * Mengambil daftar order pembayaran untuk seorang santri dengan filter status opsional.
 */
export async function listPaymentOrdersByStudent(
  santriId: string,
  filter?: { status?: FinanceOrderStatus }
): Promise<PaymentOrderWithItems[]> {
  const conditions = ['santri_id = ?']
  const params: unknown[] = [santriId]

  if (filter?.status) {
    conditions.push('status = ?')
    params.push(filter.status)
  }

  const orders = await query<FinancePaymentOrder>(
    `SELECT id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, payment_method, fixed_va_number, status,
            expires_at, cash_session_id, created_at, updated_at
     FROM finance_payment_orders
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC`,
    params
  )

  const result: PaymentOrderWithItems[] = []
  for (const order of orders) {
    const items = await query<FinanceOrderItem>(
      `SELECT id, order_id, obligation_id, item_type, amount
       FROM finance_order_items
       WHERE order_id = ?
       ORDER BY rowid ASC`,
      [order.id]
    )
    result.push({
      ...order,
      items,
    })
  }

  return result
}
