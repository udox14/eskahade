import { assertBillingCollectible } from './billing-legacy'
import { getEffectiveCooperativeAdminFeeRule, COOPERATIVE_FEE_CODES } from './cooperative-admin'
import { getActiveTransferAccount, getTransferSettings, isFlexibleItem, transferAccountSnapshot } from './transfer-config'
// lib/finance/orders.ts
// Modul Payment Order Engine (Fase 3A)
// Mengelola siklus pesanan pembayaran, kalkulasi fee, dan validasi kewajiban

import { query, queryOne, batch, execute, generateId, now } from '@/lib/db'
import { getStudentFixedVa } from '@/lib/finance/va'
import { assertSantriBillable, assertSantriBillableUntukItem } from '@/lib/finance/non-billable-santri'
import { rupiah, sumRupiah } from './money'
import type { FinanceWritePlan } from './write-plan'
import type {
  FinancePaymentOrder,
  FinanceOrderItem,
  PaymentOrderWithItems,
  CreatePaymentOrderInput,
  FinanceOrderStatus,
  FinanceObligation,
} from '@/lib/finance/types'
import { financeNotices, kickNotificationDispatch } from '@/lib/notifications/runtime'
import { transferExpiredNotices } from '@/lib/notifications/finance-events'

function generateSubmissionNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
  return `TRF-${datePart}-${randomSuffix}`
}

/**
 * Picks a random unique code so base+code is not used by any other pending transfer order.
 * The partial unique index uq_finance_payment_orders_transfer_amount is the final guard.
 */
async function pickUniqueTransferCode(baseCharged: number, maxCode: number): Promise<number> {
  await expireStaleTransferOrders()
  const taken = await query<{ total_charged: number }>(
    `SELECT total_charged FROM finance_payment_orders
     WHERE status = 'PENDING' AND payment_method = 'MANUAL_TRANSFER' AND total_charged BETWEEN ? AND ?`,
    [baseCharged + 1, baseCharged + maxCode]
  )
  const used = new Set(taken.map(row => row.total_charged - baseCharged))
  const free: number[] = []
  for (let code = 1; code <= maxCode; code++) if (!used.has(code)) free.push(code)
  if (!free.length) throw new Error('Kode unik untuk nominal ini sedang penuh. Coba beberapa saat lagi atau ubah nominal.')
  const random = new Uint32Array(1)
  crypto.getRandomValues(random)
  return free[random[0] % free.length]
}

/** Replaced transfer orders whose proof was never uploaded close their submission too. */
function replacedTransferSubmissionStatements(santriId: string, timestamp: string) {
  const pending = `SELECT s.id FROM finance_transfer_submissions s JOIN finance_payment_orders o ON o.id = s.order_id
    WHERE o.santri_id = ? AND o.status = 'PENDING' AND s.status = 'MENUNGGU_BUKTI'`
  return [
    {
      sql: `INSERT INTO finance_transfer_submission_events (id, submission_id, action, from_status, to_status, actor_kind, notes, created_at)
            SELECT lower(hex(randomblob(16))), id, 'REPLACED', 'MENUNGGU_BUKTI', 'DIBATALKAN', 'SYSTEM', 'Diganti pembayaran baru', ? FROM (${pending})`,
      params: [timestamp, santriId] as unknown[],
    },
    {
      sql: `UPDATE finance_transfer_submissions SET status = 'DIBATALKAN', updated_at = ? WHERE id IN (${pending})`,
      params: [timestamp, santriId] as unknown[],
    },
  ]
}

/**
 * Transfer orders still waiting for a proof past their deadline become EXPIRED/KEDALUWARSA.
 * Orders whose proof is under review are never touched (money may already be sent).
 */
export async function expireStaleTransferOrders(): Promise<void> {
  const timestamp = now()
  const stale = `SELECT o.id FROM finance_payment_orders o JOIN finance_transfer_submissions s ON s.order_id = o.id
    WHERE o.status = 'PENDING' AND o.payment_method = 'MANUAL_TRANSFER' AND o.expires_at < ? AND s.status = 'MENUNGGU_BUKTI'`
  const rows = await query<{ id: string }>(stale + ' LIMIT 1', [timestamp])
  if (!rows.length) return
  // Notifikasi wali dipilih SEBELUM status diubah (submission masih MENUNGGU_BUKTI), batch yang sama.
  const notices = await financeNotices(() => transferExpiredNotices(stale, [timestamp]))
  await batch([
    ...notices,
    {
      sql: `INSERT INTO finance_transfer_submission_events (id, submission_id, action, from_status, to_status, actor_kind, notes, created_at)
            SELECT lower(hex(randomblob(16))), s.id, 'EXPIRED', 'MENUNGGU_BUKTI', 'KEDALUWARSA', 'SYSTEM', 'Bukti transfer tidak diunggah sampai batas waktu', ?
            FROM finance_transfer_submissions s WHERE s.status = 'MENUNGGU_BUKTI' AND s.order_id IN (${stale})`,
      params: [timestamp, timestamp],
    },
    {
      sql: `UPDATE finance_payment_orders SET status = 'EXPIRED', updated_at = ?
            WHERE id IN (${stale})`,
      params: [timestamp, timestamp],
    },
    {
      sql: `UPDATE finance_transfer_submissions SET status = 'KEDALUWARSA', updated_at = ?
            WHERE status = 'MENUNGGU_BUKTI' AND order_id IN (
              SELECT id FROM finance_payment_orders WHERE status = 'EXPIRED' AND payment_method = 'MANUAL_TRANSFER')`,
      params: [timestamp],
    },
  ])
  if (notices.length) await kickNotificationDispatch()
}

/**
 * Penyapu kedaluwarsa yang dipanggil saat halaman dibaca (antrian verifikasi, portal wali), agar
 * order transfer tanpa bukti tidak tertahan PENDING sampai ada checkout transfer berikutnya.
 * Idempoten. Kegagalan (mis. akun baca-saja) dicatat ke log dan tidak menghalangi tampilan;
 * tidak ada nilai finansial yang berubah selain status PENDING → EXPIRED/KEDALUWARSA.
 */
export async function sweepExpiredTransferOrders(context: string): Promise<void> {
  try {
    await expireStaleTransferOrders()
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'transfer_expiry_sweep_failed',
      context,
      message: error instanceof Error ? error.message : String(error),
    }))
  }
}

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
 * 4. Kalkulasi biaya administrasi Koperasi:
 *    - CUSTOMER: total_charged = gross_amount + cooperative_admin_fee
 *    - INSTITUTION: total_charged = gross_amount
 * 5. Jika metode BRI_VA, menyematkan nomor Fixed BRIVA santri jika sudah terdaftar.
 * 6. Maksimum 1 active online order per santri (order lama PENDING diganti menjadi REPLACED).
 * 7. Eksekusi atomik header order + detail items via db.batch().
 */
export async function createPaymentOrder(
  input: CreatePaymentOrderInput,
  plan?: FinanceWritePlan
): Promise<PaymentOrderWithItems> {
  const santriId = input.santriId
  const payerType = input.payerType
  if(input.cooperativeAdminFee!==undefined)rupiah(input.cooperativeAdminFee,'Biaya Koperasi',true)
  const feePayer = input.paymentMethod==='CASH' ? input.feePayer ?? 'CUSTOMER' : 'CUSTOMER'
  const paymentMethod = input.paymentMethod ?? 'BRI_VA'
  const isTransfer = paymentMethod === 'MANUAL_TRANSFER'
  const isOnline = paymentMethod === 'BRI_VA' || isTransfer
  const feeRule= paymentMethod==='BRI_VA'
    ? await getEffectiveCooperativeAdminFeeRule()
    : isTransfer ? await getEffectiveCooperativeAdminFeeRule(COOPERATIVE_FEE_CODES.TRANSFER, new Date().toISOString(), 'TRANSFER') : null
  const cooperativeAdminFee=feeRule ? rupiah(feeRule.amount,'Biaya Koperasi',true) : 0
  const feeSnapshot=JSON.stringify(feeRule || {is_enabled:0,amount:0})
  const transferSettings = isTransfer ? await getTransferSettings() : null
  const expiresInHours = isTransfer ? transferSettings!.proofDeadlineHours : input.expiresInHours ?? 24
  const feeMode = isTransfer ? input.feeMode ?? 'ADD' : null
  if (isTransfer && feeMode !== 'ADD' && feeMode !== 'DEDUCT') throw new Error('Cara pembebanan biaya admin tidak valid.')
  if (isTransfer && feeMode === 'DEDUCT' && !transferSettings!.feeDeductEnabled) throw new Error('Opsi potong biaya admin sedang tidak tersedia.')
  if (isTransfer && !input.destinationAccountId) throw new Error('Pilih rekening tujuan transfer.')
  const destinationAccount = isTransfer ? await getActiveTransferAccount(input.destinationAccountId!) : null
  if (isTransfer && !destinationAccount) throw new Error('Rekening tujuan tidak tersedia. Pilih rekening lain.')
  const cashSessionId = input.cashSessionId ?? null
  if(!Number.isFinite(expiresInHours) || expiresInHours<=0 || expiresInHours>168)throw new Error('Masa berlaku order tidak valid.')

  if (!input.items || input.items.length === 0) {
    throw new Error('Pesanan pembayaran wajib memuat minimal 1 item pembayaran.')
  }

  // 1. Validasi Santri Aktif
  const student = await queryOne<{ id: string; status_global: string; asrama: string | null; nama_lengkap: string; kategori_santri: string | null }>(
    `SELECT id, status_global, asrama, nama_lengkap, kategori_santri FROM santri WHERE id = ?`,
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
  assertSantriBillable(student.asrama, student.nama_lengkap, student.kategori_santri)

  // 2. Validasi Item-Item & Kewajiban
  let grossAmount = 0
  const preparedOrderItems: Array<{
    id: string
    obligationId: string | null
    itemType: string
    amount: number
    flexible: boolean
  }> = []
  const seenObligationIds = new Set<string>()

  for (const item of input.items) {
    const amount = rupiah(item.amount)
    if (amount <= 0) {
      throw new Error(`Nominal item "${item.itemType}" harus lebih besar dari 0.`)
    }

    // Guard per item: SADESA tidak boleh ditagih UANG_MAKAN & UANG_NYUCI
    assertSantriBillableUntukItem(
      {
        asrama: student.asrama,
        kategoriSantri: student.kategori_santri,
        namaSantri: student.nama_lengkap,
      },
      item.itemType
    )

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
      assertSantriBillableUntukItem({asrama:student.asrama,kategoriSantri:student.kategori_santri,namaSantri:student.nama_lengkap},obligation.item_type)
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

      await assertBillingCollectible({ query,queryOne,execute }, obligation.id)

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
        flexible: !isDisallowed && isFlexibleItem(obligation.item_type, obligation.installment_rule),
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
        flexible: true,
      })
    }

    grossAmount = sumRupiah([grossAmount,amount])
  }

  // 2b. Fee mode DEDUCT (manual transfer): the admin fee is taken from ONE flexible item
  // (Uang Jajan first, otherwise the largest installment item). Internally the order is
  // still gross + fee + unique code; only the allocation of that item becomes smaller.
  if (feeMode === 'DEDUCT' && cooperativeAdminFee > 0) {
    const candidates = preparedOrderItems.filter(item => item.flexible && item.amount > cooperativeAdminFee)
    const target = candidates.find(item => item.itemType === 'UANG_JAJAN')
      || candidates.sort((a, b) => b.amount - a.amount)[0]
    if (!target) {
      throw new Error('Biaya admin hanya bisa dipotong dari Uang Jajan atau cicilan yang nominalnya lebih besar dari biaya admin. Pilih "Tambahkan biaya admin".')
    }
    target.amount = target.amount - cooperativeAdminFee
    grossAmount = grossAmount - cooperativeAdminFee
  }

  // 3. Kalkulasi Total Tagihan (Gross + Biaya Operasional Koperasi [+ kode unik transfer])
  const baseCharged = sumRupiah(feePayer === 'CUSTOMER' ? [grossAmount,cooperativeAdminFee] : [grossAmount])
  const uniqueCode = isTransfer ? await pickUniqueTransferCode(baseCharged, transferSettings!.uniqueCodeMax) : 0
  const totalCharged = sumRupiah([baseCharged, uniqueCode])

  // 4. Fixed BRIVA Lookup jika metode BRI_VA
  let fixedVaNumber: string | null = null
  if (paymentMethod === 'BRI_VA') {
    const studentVa = await getStudentFixedVa(santriId)
    if (!studentVa || studentVa.status!=='ACTIVE')throw new Error('Fixed BRIVA aktif belum tersedia.')
    if (studentVa) {
      fixedVaNumber = studentVa.va_number
    }
  }

  const destinationSnapshot = destinationAccount ? transferAccountSnapshot(destinationAccount) : null
  const orderId = generateId()
  const orderNumber = generateOrderNumber()
  const timestamp = now()
  const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()

  // 5. Batch Insert Atomik
  const statements: Array<{ sql: string; params: unknown[] }> = []

  // Hard Rule: Maksimum 1 active online order per santri (BRIVA atau transfer manual).
  // Order lama PENDING diganti menjadi REPLACED, KECUALI bukti transfernya sedang diperiksa:
  // uang wali mungkin sudah terkirim, jadi checkout baru ditolak (trigger DB juga menolak).
  if (isOnline) {
    const inReview = await queryOne<{ id: string }>(
      `SELECT s.id FROM finance_transfer_submissions s
       JOIN finance_payment_orders o ON o.id = s.order_id
       WHERE o.santri_id = ? AND o.status = 'PENDING' AND s.status IN ('MENUNGGU_VERIFIKASI', 'PERLU_PERBAIKAN')
       LIMIT 1`,
      [santriId]
    )
    if (inReview) throw new Error('Masih ada bukti transfer yang sedang dicek petugas. Tunggu hasilnya sebelum membuat pembayaran baru.')
    statements.push(...replacedTransferSubmissionStatements(santriId, timestamp))
    statements.push({
      sql: `
        UPDATE finance_payment_orders
        SET status = 'REPLACED', updated_at = ?
        WHERE santri_id = ? AND status = 'PENDING' AND payment_method IN ('BRI_VA', 'MANUAL_TRANSFER')
      `,
      params: [timestamp, santriId],
    })
  }

  statements.push({
    sql: `
      INSERT INTO finance_payment_orders (
        id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee,
        fee_payer, total_charged, payment_method, fixed_va_number, status,
        expires_at, cash_session_id, created_at, updated_at, cooperative_fee_rule_id, cooperative_fee_snapshot,
        unique_code, fee_mode, destination_account_id, destination_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      orderId,
      orderNumber,
      santriId,
      payerType,
      grossAmount,
      cooperativeAdminFee,
      feePayer,
      totalCharged,
      paymentMethod,
      fixedVaNumber,
      expiresAt,
      cashSessionId,
      timestamp,
      timestamp,
      feeRule?.id||null,
      feeSnapshot,
      uniqueCode,
      feeMode,
      destinationAccount?.id || null,
      destinationSnapshot,
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

  // Manual transfer: the submission (proof slot) is born with the order, in the same batch.
  if (isTransfer) {
    const submissionId = generateId()
    statements.push({
      sql: `INSERT INTO finance_transfer_submissions (
              id, submission_number, order_id, santri_id, destination_account_id, destination_snapshot,
              expected_amount, unique_code, cooperative_admin_fee, fee_mode, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MENUNGGU_BUKTI', ?, ?)`,
      params: [submissionId, generateSubmissionNumber(), orderId, santriId, destinationAccount!.id, destinationSnapshot,
        totalCharged, uniqueCode, cooperativeAdminFee, feeMode, timestamp, timestamp],
    })
    statements.push({
      sql: `INSERT INTO finance_transfer_submission_events (id, submission_id, action, from_status, to_status, actor_kind, actor_id, notes, created_at)
            VALUES (?, ?, 'CREATED', NULL, 'MENUNGGU_BUKTI', ?, NULL, ?, ?)`,
      params: [generateId(), submissionId, input.createdByKind === 'STAFF' ? 'STAFF' : 'PARENT',
        `Order ${orderNumber}: transfer Rp${totalCharged} (kode unik ${uniqueCode}, biaya admin ${feeMode})`, timestamp],
    })
  }

  if (plan) {
    const staged: PaymentOrderWithItems = {
      id:orderId,order_number:orderNumber,santri_id:santriId,payer_type:payerType,gross_amount:grossAmount,
      cooperative_fee_rule_id:feeRule?.id||null,cooperative_fee_snapshot:feeSnapshot,
      cooperative_admin_fee:cooperativeAdminFee,fee_payer:feePayer,total_charged:totalCharged,payment_method:paymentMethod,
      unique_code:uniqueCode,fee_mode:feeMode,destination_account_id:destinationAccount?.id||null,destination_snapshot:destinationSnapshot,
      fixed_va_number:fixedVaNumber,status:'PENDING',expires_at:expiresAt,cash_session_id:cashSessionId,created_at:timestamp,updated_at:timestamp,
      items:preparedOrderItems.map(item=>({id:item.id,order_id:orderId,obligation_id:item.obligationId,item_type:item.itemType,amount:item.amount})),
    }
    plan.statements.push(...statements)
    plan.orders.set(orderId,staged)
    return staged
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
    `SELECT id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, cooperative_fee_rule_id, cooperative_fee_snapshot,
            fee_payer, total_charged, payment_method, fixed_va_number, status,
            expires_at, cash_session_id, created_at, updated_at,
            unique_code, fee_mode, destination_account_id, destination_snapshot
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
    `SELECT id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, cooperative_fee_rule_id, cooperative_fee_snapshot,
            fee_payer, total_charged, payment_method, fixed_va_number, status,
            expires_at, cash_session_id, created_at, updated_at,
            unique_code, fee_mode, destination_account_id, destination_snapshot
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
    `SELECT id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, cooperative_fee_rule_id, cooperative_fee_snapshot,
            fee_payer, total_charged, payment_method, fixed_va_number, status,
            expires_at, cash_session_id, created_at, updated_at,
            unique_code, fee_mode, destination_account_id, destination_snapshot
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
  await expireStaleTransferOrders()
  const expiredOrders = await query<{ id: string }>(
    `SELECT id FROM finance_payment_orders
     WHERE status = 'PENDING' AND expires_at < ? AND payment_method IS NOT 'MANUAL_TRANSFER'`,
    [currentTime]
  )

  if (expiredOrders.length === 0) {
    return { expiredCount: 0 }
  }

  await execute(
    `UPDATE finance_payment_orders
     SET status = 'EXPIRED', updated_at = ?
     WHERE status = 'PENDING' AND expires_at < ? AND payment_method IS NOT 'MANUAL_TRANSFER'`,
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
    `SELECT id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, cooperative_fee_rule_id, cooperative_fee_snapshot,
            fee_payer, total_charged, payment_method, fixed_va_number, status,
            expires_at, cash_session_id, created_at, updated_at,
            unique_code, fee_mode, destination_account_id, destination_snapshot
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
