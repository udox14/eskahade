// lib/finance/payments.ts
// Modul Payment Execution & Allocation Engine (Fase 3A)
// Mengelola pencatatan pembayaran, alokasi atomik ke kewajiban, dan unallocated transfer

import { query, queryOne, batch, generateId, now } from '@/lib/db'
import { getPaymentOrderById } from '@/lib/finance/orders'
import { resolveFundManagement } from '@/lib/finance/fund-management'
import type {
  FinancePayment,
  FinanceAllocation,
  FinanceReconciliationItem,
  PaymentWithAllocations,
  RecordOrderPaymentInput,
  RecordUnallocatedPaymentInput,
} from '@/lib/finance/types'

function generatePaymentNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `PAY-${datePart}-${randomSuffix}`
}

/**
 * Mencatat pembayaran untuk suatu Payment Order secara atomik.
 * Penegakan aturan finansial:
 * 1. Validasi status order: harus PENDING (jika sudah PAID, idempotent return payment existing).
 * 2. Pembuatan record finance_payments (status PAID, allocation_status ALLOCATED).
 * 3. Pembuatan record finance_allocations untuk setiap order item (disbursed_amount = 0, status UNDISBURSED).
 * 4. Pembaruan derived cache finance_obligations: amount_paid bertambah, status diperbarui secara atomik.
 * 5. Seluruh mutasi dieksekusi dalam satu batch statement D1 (db.batch).
 */
export async function recordOrderPayment(
  input: RecordOrderPaymentInput
): Promise<PaymentWithAllocations> {
  const order = await getPaymentOrderById(input.orderId)
  if (!order) {
    throw new Error(`Order pembayaran dengan ID "${input.orderId}" tidak ditemukan.`)
  }

  const externalRef = input.externalReference ? input.externalReference.trim() : null

  // 1. Gateway Idempotency: Jika externalReference sudah tercatat pada channel yang sama,
  // kembalikan pembayaran existing secara instan (menjamin deduplikasi callback ulang dari gateway)
  if (externalRef) {
    const existingPayment = await getPaymentByExternalReference(input.channel, externalRef)
    if (existingPayment) {
      return existingPayment
    }
  }

  const paymentId = generateId()
  const paymentNumber = generatePaymentNumber()
  const paidAt = input.paidAt ?? now()
  const gatewayFee = input.gatewayFee !== undefined
    ? Math.max(0, Math.floor(input.gatewayFee))
    : order.gateway_fee
  const grossAmount = order.gross_amount
  const netAmount = Math.max(0, grossAmount - gatewayFee)
  const cashSessionId = input.cashSessionId ?? order.cash_session_id ?? null
  const receivedBy = input.receivedBy ?? null
  const paymentSource = input.source ?? 'NEW_FINANCE'
  const fundManagement = await resolveFundManagement(paidAt, paymentSource, input.fundManagement)

  // 2. Evaluasi status order:
  // - Jika order sudah PAID, EXPIRED, atau CANCELLED:
  //   Uang nyata yang masuk TIDAK BOLEH HILANG. Namun order items TIDAK BOLEH dialokasikan ulang.
  //   Catat pembayaran sebagai UNALLOCATED (tetap ditautkan ke order_id untuk auditability)
  //   dan masukkan seluruh nominal ke finance_reconciliation_items.
  if (order.status === 'PAID' || order.status === 'EXPIRED' || order.status === 'CANCELLED') {
    const reconciliationItemId = generateId()
    const resolutionNotes = order.status === 'PAID'
      ? 'Pembayaran kedua diterima untuk Payment Order yang sudah lunas (status PAID). Dana tidak dialokasikan ulang dan diamankan ke Rekonsiliasi.'
      : `Pembayaran diterima untuk pesanan yang sudah berstatus ${order.status}. Dana dicatat utuh dan diamankan ke Rekonsiliasi.`

    const fallbackStatements: Array<{ sql: string; params: unknown[] }> = [
      {
        sql: `
          INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, cash_session_id,
            received_by, source, fund_management, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', 'NONE', 'UNALLOCATED', ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          paymentId,
          paymentNumber,
          order.id,
          order.santri_id,
          input.channel,
          input.method,
          grossAmount,
          gatewayFee,
          netAmount,
          paidAt,
          externalRef,
          cashSessionId,
          receivedBy,
          paymentSource,
          fundManagement,
          paidAt,
        ],
      },
      {
        sql: `
          INSERT INTO finance_reconciliation_items (
            id, reconciliation_id, payment_id, settlement_id, cash_session_id,
            external_reference, internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes, resolved_by,
            resolved_at, created_at
          ) VALUES (?, NULL, ?, NULL, ?, ?, 0, ?, ?, 'UNALLOCATED_TRANSFER', 'NONE', ?, NULL, NULL, ?)
        `,
        params: [
          reconciliationItemId,
          paymentId,
          cashSessionId,
          externalRef,
          grossAmount,
          grossAmount,
          resolutionNotes,
          paidAt,
        ],
      },
    ]

    try {
      await batch(fallbackStatements)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (
        externalRef &&
        (errMsg.includes('uq_finance_payments_channel_ext_ref') ||
          (errMsg.includes('UNIQUE') && (errMsg.includes('external_reference') || errMsg.includes('channel'))))
      ) {
        const existing = await getPaymentByExternalReference(input.channel, externalRef)
        if (existing) return existing
      }
      throw err
    }

    const created = await getPaymentById(paymentId)
    if (!created) {
      if (externalRef) {
        const existing = await getPaymentByExternalReference(input.channel, externalRef)
        if (existing) return existing
      }
      throw new Error(`Gagal mengambil data pembayaran setelah pencatatan order ${order.status}.`)
    }
    return created
  }

  // 3. Evaluasi kapasitas alokasi tiap item secara dinamis
  // Pisahkan item yang aman dialokasikan dari kelebihan yang tidak aman dialokasikan
  interface SafeAllocItem {
    id: string
    obligationId: string
    itemType: string
    amount: number
  }

  const allocatableItems: SafeAllocItem[] = []
  let unallocatedExcess = 0
  const unallocatedReasons: string[] = []

  for (const item of order.items) {
    if (item.obligation_id) {
      const curObligation = await queryOne<{
        id: string
        item_type: string
        amount_expected: number
        amount_exempted: number
        amount_paid: number
        status: string
        installment_rule?: string
      }>(
        `SELECT o.id, o.item_type, o.amount_expected, o.amount_exempted, o.amount_paid, o.status,
                t.installment_rule
         FROM finance_obligations o
         LEFT JOIN finance_tariffs t ON o.tariff_id = t.id
         WHERE o.id = ?`,
        [item.obligation_id]
      )

      if (!curObligation) {
        unallocatedExcess += item.amount
        unallocatedReasons.push(`Kewajiban ID "${item.obligation_id}" tidak ditemukan`)
        continue
      }

      const effectiveExpected = Math.max(0, curObligation.amount_expected - curObligation.amount_exempted)
      const currentRemaining = Math.max(0, effectiveExpected - curObligation.amount_paid)

      if (currentRemaining <= 0 || curObligation.status === 'PAID' || curObligation.status === 'EXEMPTED') {
        // Obligasi sudah lunas penuh atau dibebaskan: jangan overpay!
        unallocatedExcess += item.amount
        unallocatedReasons.push(`Kewajiban "${curObligation.item_type}" sudah berstatus ${curObligation.status}`)
        continue
      }

      if (currentRemaining >= item.amount) {
        // Kapasitas cukup penuh untuk item ini
        allocatableItems.push({
          id: generateId(),
          obligationId: curObligation.id,
          itemType: curObligation.item_type,
          amount: item.amount,
        })
      } else {
        // Kapasitas tersisa lebih kecil dari item.amount
        const isAllowed = curObligation.installment_rule === 'ALLOWED' && curObligation.item_type !== 'SPP'
        if (isAllowed) {
          // Boleh cicil: alokasikan sisa kapasitas, kelebihannya masuk unallocated
          allocatableItems.push({
            id: generateId(),
            obligationId: curObligation.id,
            itemType: curObligation.item_type,
            amount: currentRemaining,
          })
          const excess = item.amount - currentRemaining
          unallocatedExcess += excess
          unallocatedReasons.push(`Kelebihan alokasi ${curObligation.item_type} sebesar Rp ${excess.toLocaleString('id-ID')}`)
        } else {
          // Tidak boleh cicil (misal SPP): tidak dialokasikan sebagian, seluruhnya masuk unallocated
          unallocatedExcess += item.amount
          unallocatedReasons.push(`Kewajiban ${curObligation.item_type} tidak dapat dicicil parsial (sisa Rp ${currentRemaining.toLocaleString('id-ID')})`)
        }
      }
    } else {
      // Item Uang Jajan: periksa tabel finance_wallet_ledger (Fase 5)
      const walletLedgerTable = await queryOne<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='finance_wallet_ledger'`
      )
      if (!walletLedgerTable) {
        unallocatedExcess += item.amount
        unallocatedReasons.push('Top-up Uang Jajan ditangguhkan karena tabel finance_wallet_ledger belum tersedia (Fase 5)')
      } else {
        // Jika ledger sudah tersedia di masa depan (Fase 5), alokasikan
        allocatableItems.push({
          id: generateId(),
          obligationId: '',
          itemType: 'UANG_JAJAN',
          amount: item.amount,
        })
      }
    }
  }

  // Tentukan status alokasi pembayaran
  const totalAllocated = allocatableItems.reduce((acc, itm) => acc + itm.amount, 0)
  let allocationStatus: 'ALLOCATED' | 'PARTIALLY_ALLOCATED' | 'UNALLOCATED' = 'ALLOCATED'
  if (unallocatedExcess > 0 && totalAllocated > 0) {
    allocationStatus = 'PARTIALLY_ALLOCATED'
  } else if (totalAllocated === 0) {
    allocationStatus = 'UNALLOCATED'
  }

  const statements: Array<{ sql: string; params: unknown[] }> = []

  // 4. Update status order menjadi PAID
  statements.push({
    sql: `
      UPDATE finance_payment_orders
      SET status = 'PAID', updated_at = ?
      WHERE id = ? AND status = 'PENDING'
    `,
    params: [paidAt, order.id],
  })

  // 5. Insert record finance_payments
  statements.push({
    sql: `
      INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method,
        gross_amount, gateway_fee, net_amount, status, correction_status,
        allocation_status, paid_at, external_reference, cash_session_id,
        received_by, source, fund_management, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', 'NONE', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      paymentId,
      paymentNumber,
      order.id,
      order.santri_id,
      input.channel,
      input.method,
      grossAmount,
      gatewayFee,
      netAmount,
      allocationStatus,
      paidAt,
      externalRef,
      cashSessionId,
      receivedBy,
      paymentSource,
      fundManagement,
      paidAt,
    ],
  })

  // 6. Alokasi item yang aman
  for (const alloc of allocatableItems) {
    if (alloc.obligationId) {
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
          alloc.id,
          paymentId,
          alloc.obligationId,
          alloc.itemType,
          alloc.amount,
          paidAt,
          alloc.obligationId,
        ],
      })

      // Atomic increment terhadap nilai database aktual (concurrency-safe)
      statements.push({
        sql: `
          UPDATE finance_obligations
          SET amount_paid = amount_paid + ?,
              status = CASE
                WHEN (amount_paid + ?) >= MAX(0, amount_expected - amount_exempted) THEN 'PAID'
                WHEN (amount_paid + ?) > 0 THEN 'PARTIALLY_PAID'
                ELSE 'UNPAID'
              END,
              updated_at = ?
          WHERE id = ?
            AND (amount_paid + ?) <= MAX(0, amount_expected - amount_exempted)
        `,
        params: [
          alloc.amount,
          alloc.amount,
          alloc.amount,
          paidAt,
          alloc.obligationId,
          alloc.amount,
        ],
      })
    } else {
      // Uang Jajan
      statements.push({
        sql: `
          INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type,
            provider_id, amount, disbursed_amount, distribution_status, created_at
          ) VALUES (?, ?, NULL, 'UANG_JAJAN', 'UANG_JAJAN', NULL, ?, 0, 'UNDISBURSED', ?)
        `,
        params: [
          alloc.id,
          paymentId,
          alloc.amount,
          paidAt,
        ],
      })
    }
  }

  // 7. Jika ada kelebihan/dana tak teralokasi, amankan ke finance_reconciliation_items
  if (unallocatedExcess > 0) {
    const reconciliationItemId = generateId()
    const matchStatus = totalAllocated > 0 ? 'AMOUNT_MISMATCH' : 'UNALLOCATED_TRANSFER'
    const notes = unallocatedReasons.join('; ')

    statements.push({
      sql: `
        INSERT INTO finance_reconciliation_items (
          id, reconciliation_id, payment_id, settlement_id, cash_session_id,
          external_reference, internal_amount, external_amount, discrepancy_amount,
          match_status, resolution_action, resolution_notes, resolved_by,
          resolved_at, created_at
        ) VALUES (?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, 'NONE', ?, NULL, NULL, ?)
      `,
      params: [
        reconciliationItemId,
        paymentId,
        cashSessionId,
        externalRef,
        totalAllocated,
        grossAmount,
        unallocatedExcess,
        matchStatus,
        `Dana tidak dialokasikan otomatis: ${notes}. Memerlukan tindakan rekonsiliasi manual.`,
        paidAt,
      ],
    })
  }

  // 8. Eksekusi batch dengan penanganan race condition
  try {
    await batch(statements)
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)

    // Idempotency: duplicate external_reference
    if (
      externalRef &&
      (errMsg.includes('uq_finance_payments_channel_ext_ref') ||
        (errMsg.includes('UNIQUE') && (errMsg.includes('external_reference') || errMsg.includes('channel'))))
    ) {
      const existingByRef = await getPaymentByExternalReference(input.channel, externalRef)
      if (existingByRef) {
        return existingByRef
      }
    }

    // Jika terjadi microsecond race condition yang memicu trigger overpayment,
    // uang TIDAK BOLEH HILANG. Alihkan seluruh pembayaran ke UNALLOCATED + Rekonsiliasi!
    if (errMsg.toLowerCase().includes('overpayment')) {
      const fallbackRecId = generateId()
      const raceFallbackStatements: Array<{ sql: string; params: unknown[] }> = [
        {
          sql: `UPDATE finance_payment_orders SET status = 'PAID', updated_at = ? WHERE id = ?`,
          params: [paidAt, order.id],
        },
        {
          sql: `
            INSERT INTO finance_payments (
              id, payment_number, order_id, santri_id, channel, method,
              gross_amount, gateway_fee, net_amount, status, correction_status,
              allocation_status, paid_at, external_reference, cash_session_id,
              received_by, source, fund_management, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', 'NONE', 'UNALLOCATED', ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            paymentId,
            paymentNumber,
            order.id,
            order.santri_id,
            input.channel,
            input.method,
            grossAmount,
            gatewayFee,
            netAmount,
            paidAt,
            externalRef,
            cashSessionId,
            receivedBy,
            paymentSource,
            fundManagement,
            paidAt,
          ],
        },
        {
          sql: `
            INSERT INTO finance_reconciliation_items (
              id, reconciliation_id, payment_id, settlement_id, cash_session_id,
              external_reference, internal_amount, external_amount, discrepancy_amount,
              match_status, resolution_action, resolution_notes, resolved_by,
              resolved_at, created_at
            ) VALUES (?, NULL, ?, NULL, ?, ?, 0, ?, ?, 'UNALLOCATED_TRANSFER', 'NONE', ?, NULL, NULL, ?)
          `,
          params: [
            fallbackRecId,
            paymentId,
            cashSessionId,
            externalRef,
            grossAmount,
            grossAmount,
            'Pembayaran diterima secara paralel saat kewajiban telah terpenuhi oleh transaksi lain. Dana diamankan ke Rekonsiliasi.',
            paidAt,
          ],
        },
      ]
      await batch(raceFallbackStatements)
    } else {
      throw err
    }
  }

  const createdPayment = await getPaymentById(paymentId)
  if (!createdPayment) {
    const existing = await getPaymentByOrderId(order.id)
    if (existing) return existing
    throw new Error('Gagal mengambil data pembayaran setelah pencatatan.')
  }

  return createdPayment
}

/**
 * Mencatat pembayaran tanpa order aktif (misal transfer Fixed VA langsung tanpa checkout).
 * Sesuai Blueprint PRD 4.1 & Aturan Non-Menebak Alokasi:
 * 1. JANGAN PERNAH MENEBAK ALOKASI.
 * 2. Catat transaksi ke finance_payments dengan status 'PAID' dan allocation_status 'UNALLOCATED'.
 * 3. Catat baris baru ke finance_reconciliation_items dengan match_status 'UNALLOCATED_TRANSFER'.
 * 4. Transaksi akan muncul di modul Rekonsiliasi Bendahara untuk alokasi manual dengan audit trail.
 */
export async function recordUnallocatedPayment(
  input: RecordUnallocatedPaymentInput
): Promise<PaymentWithAllocations> {
  const amount = Math.floor(input.amount)
  if (amount <= 0) {
    throw new Error('Nominal transfer unallocated harus lebih besar dari 0.')
  }

  const externalRef = input.externalReference ? input.externalReference.trim() : null

  // 0. Idempotensi pre-check: jika externalReference disediakan dan sudah ada payment untuk channel ini
  if (externalRef) {
    const existing = await getPaymentByExternalReference(input.channel, externalRef)
    if (existing) {
      return existing
    }
  }

  // Validasi santri terdaftar
  const student = await queryOne<{ id: string }>(
    `SELECT id FROM santri WHERE id = ?`,
    [input.santriId]
  )
  if (!student) {
    throw new Error(`Santri dengan ID "${input.santriId}" tidak ditemukan.`)
  }

  const paymentId = generateId()
  const paymentNumber = generatePaymentNumber()
  const reconciliationItemId = generateId()
  const paidAt = input.paidAt ?? now()
  const gatewayFee = Math.max(0, Math.floor(input.gatewayFee ?? 0))
  const netAmount = Math.max(0, amount - gatewayFee)
  const cashSessionId = input.cashSessionId ?? null
  const receivedBy = input.receivedBy ?? null
  const paymentSource = input.source ?? 'NEW_FINANCE'
  const fundManagement = await resolveFundManagement(paidAt, paymentSource, input.fundManagement)

  const statements: Array<{ sql: string; params: unknown[] }> = []

  // 1. Catat ke finance_payments dengan allocation_status = 'UNALLOCATED'
  statements.push({
    sql: `
      INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method,
        gross_amount, gateway_fee, net_amount, status, correction_status,
        allocation_status, paid_at, external_reference, cash_session_id,
        received_by, source, fund_management, created_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'PAID', 'NONE', 'UNALLOCATED', ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      paymentId,
      paymentNumber,
      input.santriId,
      input.channel,
      input.method,
      amount,
      gatewayFee,
      netAmount,
      paidAt,
      externalRef,
      cashSessionId,
      receivedBy,
      paymentSource,
      fundManagement,
      paidAt,
    ],
  })

  // 2. Masukkan ke finance_reconciliation_items dengan match_status = 'UNALLOCATED_TRANSFER'
  statements.push({
    sql: `
      INSERT INTO finance_reconciliation_items (
        id, reconciliation_id, payment_id, settlement_id, cash_session_id,
        external_reference, internal_amount, external_amount, discrepancy_amount,
        match_status, resolution_action, resolution_notes, resolved_by,
        resolved_at, created_at
      ) VALUES (?, NULL, ?, NULL, ?, ?, 0, ?, ?, 'UNALLOCATED_TRANSFER', 'NONE', ?, NULL, NULL, ?)
    `,
    params: [
      reconciliationItemId,
      paymentId,
      cashSessionId,
      externalRef,
      amount,
      amount,
      'Transfer dana diterima via Fixed VA tanpa Payment Order aktif. Memerlukan investigasi dan alokasi manual oleh Bendahara.',
      paidAt,
    ],
  })

  // 3. Eksekusi batch dengan penanganan race condition (idempotency fallback)
  try {
    await batch(statements)
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)

    // Idempotency: duplicate channel + external_reference
    if (
      externalRef &&
      (errMsg.includes('uq_finance_payments_channel_ext_ref') ||
        (errMsg.includes('UNIQUE') && (errMsg.includes('external_reference') || errMsg.includes('channel'))))
    ) {
      const existing = await getPaymentByExternalReference(input.channel, externalRef)
      if (existing) {
        return existing
      }
    }

    throw err
  }

  const createdPayment = await getPaymentById(paymentId)
  if (!createdPayment) {
    if (externalRef) {
      const existing = await getPaymentByExternalReference(input.channel, externalRef)
      if (existing) return existing
    }
    throw new Error('Gagal mengambil data pembayaran unallocated setelah pencatatan.')
  }

  return createdPayment
}

/**
 * Mengambil data pembayaran beserta detail alokasinya berdasarkan payment_id.
 */
export async function getPaymentById(
  paymentId: string
): Promise<PaymentWithAllocations | null> {
  const payment = await queryOne<FinancePayment>(
    `SELECT id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, cash_session_id,
            received_by, source, fund_management, created_at
     FROM finance_payments
     WHERE id = ?`,
    [paymentId]
  )

  if (!payment) return null

  const allocations = await query<FinanceAllocation>(
    `SELECT id, payment_id, obligation_id, target_type, item_type,
            provider_id, amount, disbursed_amount, distribution_status, created_at
     FROM finance_allocations
     WHERE payment_id = ?
     ORDER BY rowid ASC`,
    [paymentId]
  )

  return {
    ...payment,
    allocations,
  }
}

/**
 * Mengambil data pembayaran berdasarkan payment_number.
 */
export async function getPaymentByNumber(
  paymentNumber: string
): Promise<PaymentWithAllocations | null> {
  const payment = await queryOne<FinancePayment>(
    `SELECT id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, cash_session_id,
            received_by, source, fund_management, created_at
     FROM finance_payments
     WHERE payment_number = ?`,
    [paymentNumber]
  )

  if (!payment) return null

  const allocations = await query<FinanceAllocation>(
    `SELECT id, payment_id, obligation_id, target_type, item_type,
            provider_id, amount, disbursed_amount, distribution_status, created_at
     FROM finance_allocations
     WHERE payment_id = ?
     ORDER BY rowid ASC`,
    [payment.id]
  )

  return {
    ...payment,
    allocations,
  }
}

/**
 * Mengambil data pembayaran pertama/primer berdasarkan order_id.
 */
export async function getPaymentByOrderId(
  orderId: string
): Promise<PaymentWithAllocations | null> {
  const payment = await queryOne<FinancePayment>(
    `SELECT id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, cash_session_id,
            received_by, source, fund_management, created_at
     FROM finance_payments
     WHERE order_id = ?
     ORDER BY created_at ASC`,
    [orderId]
  )

  if (!payment) return null

  const allocations = await query<FinanceAllocation>(
    `SELECT id, payment_id, obligation_id, target_type, item_type,
            provider_id, amount, disbursed_amount, distribution_status, created_at
     FROM finance_allocations
     WHERE payment_id = ?
     ORDER BY rowid ASC`,
    [payment.id]
  )

  return {
    ...payment,
    allocations,
  }
}

/**
 * Mengambil seluruh riwayat pembayaran yang terkait dengan suatu order_id.
 */
export async function getPaymentsByOrderId(
  orderId: string
): Promise<PaymentWithAllocations[]> {
  const payments = await query<FinancePayment>(
    `SELECT id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, cash_session_id,
            received_by, source, fund_management, created_at
     FROM finance_payments
     WHERE order_id = ?
     ORDER BY created_at ASC`,
    [orderId]
  )

  const result: PaymentWithAllocations[] = []
  for (const p of payments) {
    const allocations = await query<FinanceAllocation>(
      `SELECT id, payment_id, obligation_id, target_type, item_type,
              provider_id, amount, disbursed_amount, distribution_status, created_at
       FROM finance_allocations
       WHERE payment_id = ?
       ORDER BY rowid ASC`,
      [p.id]
    )
    result.push({
      ...p,
      allocations,
    })
  }

  return result
}

/**
 * Mengambil daftar seluruh riwayat pembayaran santri.
 */
export async function listPaymentsByStudent(
  santriId: string
): Promise<PaymentWithAllocations[]> {
  const payments = await query<FinancePayment>(
    `SELECT id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, cash_session_id,
            received_by, source, fund_management, created_at
     FROM finance_payments
     WHERE santri_id = ?
     ORDER BY paid_at DESC`,
    [santriId]
  )

  const result: PaymentWithAllocations[] = []
  for (const p of payments) {
    const allocations = await query<FinanceAllocation>(
      `SELECT id, payment_id, obligation_id, target_type, item_type,
              provider_id, amount, disbursed_amount, distribution_status, created_at
       FROM finance_allocations
       WHERE payment_id = ?
       ORDER BY rowid ASC`,
      [p.id]
    )
    result.push({
      ...p,
      allocations,
    })
  }

  return result
}

/**
 * Mengambil data pembayaran berdasarkan channel dan external_reference.
 * Digunakan untuk idempotensi gateway callback dan pencocokan pembayaran.
 */
export async function getPaymentByExternalReference(
  channel: string,
  externalReference: string
): Promise<PaymentWithAllocations | null> {
  const payment = await queryOne<FinancePayment>(
    `SELECT id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, cash_session_id,
            received_by, source, fund_management, created_at
     FROM finance_payments
     WHERE channel = ? AND external_reference = ?`,
    [channel, externalReference]
  )

  if (!payment) return null

  const allocations = await query<FinanceAllocation>(
    `SELECT id, payment_id, obligation_id, target_type, item_type,
            provider_id, amount, disbursed_amount, distribution_status, created_at
     FROM finance_allocations
     WHERE payment_id = ?
     ORDER BY rowid ASC`,
    [payment.id]
  )

  return {
    ...payment,
    allocations,
  }
}

/**
 * Mengambil seluruh item rekonsiliasi yang terhubung dengan suatu pembayaran.
 */
export async function getReconciliationItemsByPaymentId(
  paymentId: string
): Promise<FinanceReconciliationItem[]> {
  return await query<FinanceReconciliationItem>(
    `SELECT id, reconciliation_id, payment_id, settlement_id, cash_session_id,
            external_reference, internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes, resolved_by,
            resolved_at, created_at
     FROM finance_reconciliation_items
     WHERE payment_id = ?
     ORDER BY rowid ASC`,
    [paymentId]
  )
}

