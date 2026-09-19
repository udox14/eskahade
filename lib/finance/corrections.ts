// lib/finance/corrections.ts
// Modul Koreksi Finansial Non-Destruktif (Fase 8)
// Menangani VOID, REVERSAL, dan REFUND dengan riwayat permanen (tanpa hard delete),
// koreksi parsial/penuh, pembalikan mutasi buku besar uang jajan dua arah yang akurat,
// serta penanganan khusus dana terlanjur disalurkan sebagai Recovery Case (tanpa auto-deduct).

import { query, queryOne, batch, generateId, now } from '@/lib/db'
import { computeObligationStatus } from '@/lib/finance/types'
import { getStudentWalletBalance, recordWalletMutation } from '@/lib/finance/wallet'
import { getCashSessionById } from '@/lib/finance/cash-session'
import type { FinancePaymentChannel } from '@/lib/finance/payment-types'
import type {
  FinanceCorrection,
  FinanceCorrectionItem,
  RecordCorrectionInput,
  CorrectionDetailWithItems,
  ResolveRecoveryCaseInput,
} from '@/lib/finance/reconciliation-types'

function generateCorrectionNumber(type: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  const prefix = type === 'VOID' ? 'VOID' : type === 'REVERSAL' ? 'REV' : 'REF'
  return `${prefix}-${datePart}-${randomSuffix}`
}

/**
 * Mencatat koreksi finansial (VOID, REVERSAL, atau REFUND) secara non-destruktif.
 *
 * Penegakan Aturan Finansial:
 * 1. Data pembayaran asli (finance_payments) TIDAK DIHAPUS dan status 'PAID'/'SETTLED' TIDAK DIUBAH.
 * 2. Status koreksi derived (correction_status) diperbarui: 'PARTIALLY_CORRECTED' atau 'FULLY_CORRECTED'.
 * 3. Koreksi Parsial & Penuh: Jumlah nominal koreksi divalidasi tidak melebihi alokasi dan payment.
 * 4. Pembalikan Uang Jajan:
 *    - Pembatalan Top-Up -> Mutasi 'OUT' dengan tipe 'REVERSAL' (saldo berkurang, saldo tidak boleh negatif).
 * 5. Proteksi Dana Telanjur Disalurkan (Disbursed Funds):
 *    - Jika alokasi yang dikoreksi sudah pernah disalurkan ke vendor (disbursed_amount > 0),
 *      sistem DILARANG melakukan auto-deduct ke penyaluran periode berikutnya.
 *    - Bagian yang sudah disalurkan otomatis ditandai sebagai Recovery Case ('PENDING_RECOVERY')
 *      dan dicatat ke antrean rekonsiliasi untuk investigasi manual.
 * 6. Refund Tunai (method = 'CASH'):
 *    - Wajib ditautkan ke sesi kas aktif; mencatat kas keluar (cash-out) dan memperbarui expected balance.
 * 7. Seluruh mutasi dieksekusi secara atomik dalam db.batch().
 */
export async function recordCorrection(
  input: RecordCorrectionInput
): Promise<CorrectionDetailWithItems> {
  if (!input.items || input.items.length === 0) {
    throw new Error('Koreksi finansial harus menentukan minimal satu target alokasi.')
  }

  const reason = input.reason ? input.reason.trim() : ''
  if (!reason) {
    throw new Error('Alasan koreksi transaksi finansial wajib diisi.')
  }

  // 1. Ambil dan validasi transaksi pembayaran target
  const payment = await queryOne<{
    id: string
    payment_number: string
    santri_id: string
    channel: string
    gross_amount: number
    status: string
    correction_status: string
    cash_session_id: string | null
  }>(
    `SELECT id, payment_number, santri_id, channel, gross_amount, status, correction_status, cash_session_id
     FROM finance_payments
     WHERE id = ?`,
    [input.paymentId]
  )

  if (!payment) {
    throw new Error(`Pembayaran dengan ID "${input.paymentId}" tidak ditemukan.`)
  }

  if (payment.correction_status === 'FULLY_CORRECTED') {
    throw new Error(`Pembayaran "${payment.payment_number}" sudah berstatus FULLY_CORRECTED dan tidak dapat dikoreksi lagi.`)
  }

  // 2. Cek akumulasi koreksi terdahulu terhadap payment ini
  const prevCorrRow = await queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(total_amount), 0) AS total
     FROM finance_corrections
     WHERE target_payment_id = ?`,
    [payment.id]
  )
  const previousTotalCorrected = prevCorrRow?.total ?? 0

  // 3. Validasi alokasi yang ditargetkan
  let totalCorrectionAmount = 0
  let isRecoveryCase = 0
  let totalRecoveryAmount = 0

  interface PreparedCorrectionItem {
    id: string
    allocationId: string
    obligationId: string | null
    targetType: 'OBLIGATION' | 'UANG_JAJAN'
    itemType: string
    amount: number
    isDisbursedPortion: number
    newObligationPaid?: number
    newObligationStatus?: string
  }

  const preparedItems: PreparedCorrectionItem[] = []

  for (const itm of input.items) {
    const amount = Math.floor(itm.amount)
    if (amount <= 0 || !Number.isFinite(amount)) {
      throw new Error('Nominal item koreksi harus bernilai lebih besar dari 0.')
    }

    const alloc = await queryOne<{
      id: string
      payment_id: string
      obligation_id: string | null
      target_type: 'OBLIGATION' | 'UANG_JAJAN'
      item_type: string
      amount: number
      disbursed_amount: number
      distribution_status: string
    }>(
      `SELECT id, payment_id, obligation_id, target_type, item_type, amount,
              disbursed_amount, distribution_status
       FROM finance_allocations
       WHERE id = ?`,
      [itm.allocationId]
    )

    if (!alloc || alloc.payment_id !== payment.id) {
      throw new Error(`Alokasi dengan ID "${itm.allocationId}" tidak valid atau tidak termasuk dalam pembayaran ini.`)
    }

    // Periksa akumulasi koreksi terdahulu untuk alokasi ini
    const prevAllocCorr = await queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM finance_correction_items
       WHERE target_allocation_id = ?`,
      [alloc.id]
    )
    const prevAllocAmount = prevAllocCorr?.total ?? 0
    const remainingAlloc = alloc.amount - prevAllocAmount

    if (amount > remainingAlloc) {
      throw new Error(
        `Nominal koreksi Rp ${amount.toLocaleString('id-ID')} melebihi sisa alokasi ${alloc.item_type} yang tersedia (Rp ${remainingAlloc.toLocaleString('id-ID')}).`
      )
    }

    // Evaluasi apakah alokasi ini sudah terlanjur disalurkan (disbursed_amount > 0)
    // Sisa dana yang belum disalurkan pada alokasi ini:
    const availableUndisbursed = Math.max(0, alloc.amount - alloc.disbursed_amount)
    let isDisbursedPortion = 0

    if (amount > availableUndisbursed) {
      // Porsi koreksi menyentuh dana yang sudah disalurkan ke vendor!
      isRecoveryCase = 1
      const disbursedExcess = amount - availableUndisbursed
      totalRecoveryAmount += disbursedExcess
      isDisbursedPortion = 1
    }

    // Evaluasi efek terhadap kewajiban atau uang jajan
    let newObligationPaid: number | undefined
    let newObligationStatus: string | undefined

    if (alloc.target_type === 'OBLIGATION' && alloc.obligation_id) {
      // Net Authoritative: Gross allocation dikurangi seluruh correction items yang relevan
      const allocSumRes = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM finance_allocations
         WHERE obligation_id = ?`,
        [alloc.obligation_id]
      )
      const grossAlloc = allocSumRes?.total ?? 0

      const corrSumRes = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM finance_correction_items
         WHERE obligation_id = ?`,
        [alloc.obligation_id]
      )
      const existingDbCorr = corrSumRes?.total ?? 0

      // Perhitungkan juga koreksi yang sedang diproses dalam batch ini untuk obligation yang sama
      const alreadyPreparedInBatch = preparedItems
        .filter((pi) => pi.obligationId === alloc.obligation_id)
        .reduce((sum, pi) => sum + pi.amount, 0)

      const totalCorrAfterThis = existingDbCorr + alreadyPreparedInBatch + amount
      const netAuthoritativePaid = Math.max(0, grossAlloc - totalCorrAfterThis)

      const obligation = await queryOne<{
        id: string
        amount_expected: number
        amount_exempted: number
        status: string
      }>(
        `SELECT id, amount_expected, amount_exempted, status
         FROM finance_obligations
         WHERE id = ?`,
        [alloc.obligation_id]
      )

      if (obligation) {
        newObligationPaid = netAuthoritativePaid
        newObligationStatus = computeObligationStatus(
          obligation.amount_expected,
          obligation.amount_exempted,
          newObligationPaid
        )
      }
    } else if (alloc.target_type === 'UANG_JAJAN') {
      // Validasi bahwa saldo santri mencukupi untuk pembalikan top-up
      const { balance } = await getStudentWalletBalance(payment.santri_id)
      if (balance < amount) {
        throw new Error(
          `Saldo uang jajan santri saat ini (Rp ${balance.toLocaleString('id-ID')}) tidak mencukupi untuk pembalikan top-up sebesar Rp ${amount.toLocaleString('id-ID')}.`
        )
      }
    }

    totalCorrectionAmount += amount
    preparedItems.push({
      id: generateId(),
      allocationId: alloc.id,
      obligationId: alloc.obligation_id,
      targetType: alloc.target_type,
      itemType: alloc.item_type,
      amount,
      isDisbursedPortion,
      newObligationPaid,
      newObligationStatus,
    })
  }

  // 4. Validasi total akumulasi koreksi terhadap pembayaran
  const grandTotalCorrected = previousTotalCorrected + totalCorrectionAmount
  if (grandTotalCorrected > payment.gross_amount) {
    throw new Error(
      `Akumulasi koreksi (Rp ${grandTotalCorrected.toLocaleString('id-ID')}) melebihi nilai bruto pembayaran (Rp ${payment.gross_amount.toLocaleString('id-ID')}).`
    )
  }

  // 5. Validasi sesi kas jika koreksi/refund dilakukan tunai (CASH)
  const cashSessionId = input.cashSessionId || null
  if (input.method === 'CASH') {
    if (!cashSessionId) {
      throw new Error('Koreksi dengan metode tunai (CASH) wajib menyertakan ID sesi kas aktif (cashSessionId) yang mencatat pengeluaran kas fisik.')
    }
    const session = await getCashSessionById(cashSessionId)
    if (!session || session.status !== 'OPEN') {
      throw new Error('Sesi kas untuk koreksi tunai tidak ditemukan atau sudah berstatus ditutup (CLOSED).')
    }
  }

  // 6. Siapkan batch statements
  const correctionId = generateId()
  const correctionNumber = generateCorrectionNumber(input.correctionType)
  const createdAt = now()
  const recoveryStatus = isRecoveryCase === 1 ? 'PENDING_RECOVERY' : 'NONE'
  const newCorrectionStatus = grandTotalCorrected >= payment.gross_amount ? 'FULLY_CORRECTED' : 'PARTIALLY_CORRECTED'

  const statements: Array<{ sql: string; params: unknown[] }> = []

  // A. Insert Header Koreksi
  statements.push({
    sql: `
      INSERT INTO finance_corrections (
        id, correction_number, correction_type, target_payment_id, total_amount,
        method, reason, is_recovery_case, recovery_amount, recovery_status,
        recovery_notes, cash_session_id, approved_by, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      correctionId,
      correctionNumber,
      input.correctionType,
      payment.id,
      totalCorrectionAmount,
      input.method || null,
      reason,
      isRecoveryCase,
      totalRecoveryAmount,
      recoveryStatus,
      input.recoveryNotes || null,
      cashSessionId,
      input.approvedBy || null,
      input.createdBy,
      createdAt,
    ],
  })

  // B. Insert Correction Items & Update Obligasi
  for (const item of preparedItems) {
    statements.push({
      sql: `
        INSERT INTO finance_correction_items (
          id, correction_id, target_allocation_id, obligation_id, target_type,
          amount, is_disbursed_portion, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        item.id,
        correctionId,
        item.allocationId,
        item.obligationId,
        item.targetType,
        item.amount,
        item.isDisbursedPortion,
        createdAt,
      ],
    })
  }

  // Deduplicate and apply final net authoritative obligation updates
  const obligationUpdates = new Map<string, { paid: number; status: string }>()
  for (const item of preparedItems) {
    if (item.targetType === 'OBLIGATION' && item.obligationId && item.newObligationPaid !== undefined && item.newObligationStatus !== undefined) {
      obligationUpdates.set(item.obligationId, {
        paid: item.newObligationPaid,
        status: item.newObligationStatus,
      })
    }
  }

  for (const [obId, u] of obligationUpdates.entries()) {
    statements.push({
      sql: `
        UPDATE finance_obligations
        SET amount_paid = ?,
            status = ?,
            updated_at = ?
        WHERE id = ?
      `,
      params: [u.paid, u.status, createdAt, obId],
    })
  }

  // C. Update Derived Cache pada Payment (Histori asli tidak di-drop/di-update status historisnya)
  statements.push({
    sql: `UPDATE finance_payments SET correction_status = ? WHERE id = ?`,
    params: [newCorrectionStatus, payment.id],
  })

  // D. Jika koreksi tunai (CASH), kurangi expected physical cash pada sesi kas aktif
  if (input.method === 'CASH' && cashSessionId) {
    statements.push({
      sql: `
        UPDATE finance_cash_sessions
        SET total_cash_out = total_cash_out + ?,
            expected_closing_balance = expected_closing_balance - ?,
            updated_at = ?
        WHERE id = ?
      `,
      params: [totalCorrectionAmount, totalCorrectionAmount, createdAt, cashSessionId],
    })
  }

  // E. Jika terjadi Kasus Dana Terlanjur Disalurkan (Recovery Case), catat ke antrean rekonsiliasi
  if (isRecoveryCase === 1) {
    const recItemId = generateId()
    statements.push({
      sql: `
        INSERT INTO finance_reconciliation_items (
          id, reconciliation_id, payment_id, settlement_id, cash_session_id,
          external_reference, internal_amount, external_amount, discrepancy_amount,
          match_status, resolution_action, resolution_notes, resolved_by,
          resolved_at, created_at
        ) VALUES (?, NULL, ?, NULL, ?, ?, ?, 0, ?, 'AMOUNT_MISMATCH', 'ADJUSTMENT', ?, NULL, NULL, ?)
      `,
      params: [
        recItemId,
        payment.id,
        cashSessionId,
        correctionNumber,
        totalRecoveryAmount,
        totalRecoveryAmount,
        `Kasus Pemulihan Dana (Recovery Case) dari koreksi ${correctionNumber}: Alokasi sebesar Rp ${totalRecoveryAmount.toLocaleString('id-ID')} telah disalurkan ke vendor. Sistem memblokir auto-deduct; wajib investigasi manual dan klaim pemulihan kas pihak ketiga.`,
        createdAt,
      ],
    })
  }

  // Eksekusi batch mutasi D1
  await batch(statements)

  // 7. Jika ada item UANG_JAJAN, mutasikan buku besar uang jajan santri secara presisi
  // Pembalikan top-up -> mutasi OUT dengan movement_type 'REVERSAL'
  for (const item of preparedItems) {
    if (item.targetType === 'UANG_JAJAN') {
      await recordWalletMutation({
        santriId: payment.santri_id,
        direction: 'OUT',
        movementType: 'REVERSAL',
        amount: item.amount,
        referenceId: correctionNumber,
        cashSessionId,
        operatorId: input.createdBy,
        notes: `Pembalikan top-up uang jajan karena koreksi ${input.correctionType} (${correctionNumber}) pada pembayaran ${payment.payment_number}`,
      })
    }
  }

  const detail = await getCorrectionDetail(correctionId)
  if (!detail) {
    throw new Error('Gagal memuat rincian koreksi setelah pencatatan.')
  }

  return detail
}

/**
 * Mengambil riwayat koreksi transaksi finansial dengan filter dan pagination.
 */
export async function getCorrectionHistory(filters?: {
  type?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<{
  corrections: Array<FinanceCorrection & {
    creator_name: string | null
    payment_number: string
    santri_name: string
    nis: string
  }>
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
}> {
  const page = Math.max(1, filters?.page ?? 1)
  const pageSize = Math.max(1, filters?.pageSize ?? 10)
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  const params: unknown[] = []

  if (filters?.type && filters.type !== 'ALL') {
    conditions.push(`c.correction_type = ?`)
    params.push(filters.type)
  }

  if (filters?.search) {
    const q = `%${filters.search.trim()}%`
    conditions.push(`(c.correction_number LIKE ? OR p.payment_number LIKE ? OR s.nama_lengkap LIKE ? OR s.nis LIKE ?)`)
    params.push(q, q, q, q)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM finance_corrections c
     JOIN finance_payments p ON p.id = c.target_payment_id
     JOIN santri s ON s.id = p.santri_id
     ${whereClause}`,
    params
  )
  const totalCount = countRow?.total ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)

  const rows = await query<
    FinanceCorrection & {
      creator_name: string | null
      payment_number: string
      santri_name: string
      nis: string
    }
  >(
    `SELECT
       c.*,
       u.full_name AS creator_name,
       p.payment_number,
       s.nama_lengkap AS santri_name,
       s.nis
     FROM finance_corrections c
     JOIN finance_payments p ON p.id = c.target_payment_id
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN users u ON u.id = c.created_by
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  return {
    corrections: rows || [],
    totalCount,
    totalPages,
    page,
    pageSize,
  }
}

/**
 * Mengambil detail lengkap suatu transaksi koreksi beserta item per alokasi dan referensi santri.
 */
export async function getCorrectionDetail(
  correctionId: string
): Promise<CorrectionDetailWithItems | null> {
  const correction = await queryOne<
    FinanceCorrection & {
      creator_name: string | null
      approver_name: string | null
      payment_number: string
      paid_at: string
      channel: FinancePaymentChannel
      santri_id: string
      santri_name: string
      nis: string
    }
  >(
    `SELECT
       c.*,
       u.full_name AS creator_name,
       appr.full_name AS approver_name,
       p.payment_number,
       p.paid_at,
       p.channel,
       s.id AS santri_id,
       s.nama_lengkap AS santri_name,
       s.nis
     FROM finance_corrections c
     JOIN finance_payments p ON p.id = c.target_payment_id
     JOIN santri s ON s.id = p.santri_id
     LEFT JOIN users u ON u.id = c.created_by
     LEFT JOIN users appr ON appr.id = c.approved_by
     WHERE c.id = ?`,
    [correctionId]
  )

  if (!correction) {
    return null
  }

  const items = await query<
    FinanceCorrectionItem & {
      item_type: string
      provider_name: string | null
      obligation_period: string | null
    }
  >(
    `SELECT
       ci.*,
       fa.item_type,
       mj.nama_jasa AS provider_name,
       fo.period AS obligation_period
     FROM finance_correction_items ci
     JOIN finance_allocations fa ON fa.id = ci.target_allocation_id
     LEFT JOIN master_jasa mj ON mj.id = fa.provider_id
     LEFT JOIN finance_obligations fo ON fo.id = ci.obligation_id
     WHERE ci.correction_id = ?
     ORDER BY ci.created_at ASC`,
    [correctionId]
  )

  return {
    correction,
    items: items || [],
  }
}

/**
 * Menyelesaikan kasus pemulihan dana (Recovery Case) secara manual dengan audit trail.
 * Dipakai saat dana yang telanjur disalurkan ke vendor telah dikembalikan/diselesaikan oleh Bendahara.
 */
export async function resolveRecoveryCase(
  input: ResolveRecoveryCaseInput
): Promise<FinanceCorrection> {
  const correction = await queryOne<FinanceCorrection>(
    `SELECT * FROM finance_corrections WHERE id = ?`,
    [input.correctionId]
  )

  if (!correction) {
    throw new Error(`Koreksi dengan ID "${input.correctionId}" tidak ditemukan.`)
  }

  if (correction.is_recovery_case !== 1) {
    throw new Error('Transaksi koreksi ini bukan merupakan Kasus Pemulihan Dana (Recovery Case).')
  }

  if (correction.recovery_status === 'RECOVERED') {
    throw new Error('Kasus Pemulihan Dana ini sudah berstatus RECOVERED.')
  }

  const notes = input.notes ? input.notes.trim() : ''
  if (!notes) {
    throw new Error('Catatan resolusi pemulihan dana wajib disertakan.')
  }

  const updatedNotes = correction.recovery_notes
    ? `${correction.recovery_notes} | [Penyelesaian]: ${notes}`
    : notes

  await query(
    `UPDATE finance_corrections
     SET recovery_status = 'RECOVERED',
         recovery_notes = ?,
         approved_by = ?
     WHERE id = ?`,
    [updatedNotes, input.resolvedBy, correction.id]
  )

  const updated = await queryOne<FinanceCorrection>(
    `SELECT * FROM finance_corrections WHERE id = ?`,
    [correction.id]
  )

  return updated!
}
