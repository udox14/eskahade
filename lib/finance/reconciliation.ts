// lib/finance/reconciliation.ts
// Modul Rekonsiliasi Finansial & Resolusi Transaksi Unmatched/Unallocated (Fase 8)
// Sesuai PRD Bab 32 & Aturan Non-Menebak Alokasi

import { query, queryOne, batch, generateId, now } from '@/lib/db'
import { computeObligationStatus } from '@/lib/finance/types'
import { recordWalletMutation } from '@/lib/finance/wallet'
import type {
  ReconciliationKpiOverview,
  UnallocatedReconciliationRow,
  ResolveManualAllocationInput,
  CashSessionReconciliationSummary,
  FinanceCorrection,
} from '@/lib/finance/reconciliation-types'

/**
 * Mengambil ringkasan KPI eksekutif untuk halaman Rekonsiliasi.
 */
export async function getReconciliationOverview(
  period?: string
): Promise<ReconciliationKpiOverview> {
  const periodPrefix = period ? `${period}%` : '%'

  // 1. Data Online Payment & Settlement
  const onlineRow = await queryOne<{
    total_gross: number
    settled_gross: number
    pending_net: number
    pending_count: number
  }>(
    `SELECT
       COALESCE(SUM(p.gross_amount), 0) AS total_gross,
       COALESCE(SUM(CASE WHEN p.status = 'SETTLED' THEN p.gross_amount ELSE 0 END), 0) AS settled_gross,
       COALESCE(SUM(CASE WHEN p.status = 'PAID' AND p.channel = 'DUITKU' AND p.correction_status != 'FULLY_CORRECTED' THEN p.net_amount ELSE 0 END), 0) AS pending_net,
       COALESCE(SUM(CASE WHEN p.status = 'PAID' AND p.channel = 'DUITKU' AND p.correction_status != 'FULLY_CORRECTED' THEN 1 ELSE 0 END), 0) AS pending_count
     FROM finance_payments p
     WHERE p.channel = 'DUITKU' AND p.paid_at LIKE ?`,
    [periodPrefix]
  )

  // 2. Transaksi Unallocated / Ambigu
  const unallocRow = await queryOne<{
    total_amount: number
    count_items: number
  }>(
    `SELECT
       COALESCE(SUM(ri.discrepancy_amount), 0) AS total_amount,
       COUNT(*) AS count_items
     FROM finance_reconciliation_items ri
     WHERE ri.resolution_action = 'NONE'
       AND ri.match_status IN ('UNALLOCATED_TRANSFER', 'AMOUNT_MISMATCH')
       AND ri.created_at LIKE ?`,
    [periodPrefix]
  )

  // 3. Selisih Kas Sesi Loket
  const cashRow = await queryOne<{
    total_diff: number
    discrepancy_count: number
  }>(
    `SELECT
       COALESCE(SUM(ABS(s.difference)), 0) AS total_diff,
       COUNT(*) AS discrepancy_count
     FROM finance_cash_sessions s
     WHERE s.status = 'CLOSED'
       AND s.difference IS NOT NULL
       AND s.difference != 0
       AND s.opened_at LIKE ?`,
    [periodPrefix]
  )

  // 4. Kasus Pemulihan Dana (Recovery Cases) Pending
  const recoveryRow = await queryOne<{
    total_recovery: number
    recovery_count: number
  }>(
    `SELECT
       COALESCE(SUM(recovery_amount), 0) AS total_recovery,
       COUNT(*) AS recovery_count
     FROM finance_corrections
     WHERE is_recovery_case = 1
       AND recovery_status = 'PENDING_RECOVERY'
       AND created_at LIKE ?`,
    [periodPrefix]
  )

  return {
    totalOnlinePaidAmount: onlineRow?.total_gross ?? 0,
    totalSettledAmount: onlineRow?.settled_gross ?? 0,
    totalPendingSettlementAmount: onlineRow?.pending_net ?? 0,
    pendingSettlementCount: onlineRow?.pending_count ?? 0,
    totalUnallocatedAmount: unallocRow?.total_amount ?? 0,
    unallocatedCount: unallocRow?.count_items ?? 0,
    totalCashDifference: cashRow?.total_diff ?? 0,
    discrepancySessionsCount: cashRow?.discrepancy_count ?? 0,
    totalRecoveryPendingAmount: recoveryRow?.total_recovery ?? 0,
    recoveryPendingCount: recoveryRow?.recovery_count ?? 0,
  }
}

/**
 * Mengambil daftar item rekonsiliasi yang memerlukan resolusi (UNALLOCATED_TRANSFER, AMOUNT_MISMATCH, dll).
 */
export async function getUnallocatedReconciliationItems(filters?: {
  resolved?: 'ALL' | 'UNRESOLVED' | 'RESOLVED'
  period?: string
  search?: string
  page?: number
  pageSize?: number
}): Promise<{
  items: UnallocatedReconciliationRow[]
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

  const resolvedFilter = filters?.resolved ?? 'UNRESOLVED'
  if (resolvedFilter === 'UNRESOLVED') {
    conditions.push(`ri.resolution_action = 'NONE'`)
  } else if (resolvedFilter === 'RESOLVED') {
    conditions.push(`ri.resolution_action != 'NONE'`)
  }

  if (filters?.period) {
    conditions.push(`ri.created_at LIKE ?`)
    params.push(`${filters.period}%`)
  }

  if (filters?.search) {
    const q = `%${filters.search.trim()}%`
    conditions.push(`(p.payment_number LIKE ? OR s.nama_lengkap LIKE ? OR s.nis LIKE ? OR ri.external_reference LIKE ?)`)
    params.push(q, q, q, q)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM finance_reconciliation_items ri
     LEFT JOIN finance_payments p ON p.id = ri.payment_id
     LEFT JOIN santri s ON s.id = p.santri_id
     ${whereClause}`,
    params
  )
  const totalCount = countRow?.total ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)

  const rows = await query<UnallocatedReconciliationRow>(
    `SELECT
       ri.id,
       COALESCE(p.id, '') AS payment_id,
       COALESCE(p.payment_number, '-') AS payment_number,
       COALESCE(s.id, '') AS santri_id,
       COALESCE(s.nama_lengkap, '-') AS santri_name,
       COALESCE(s.nis, '-') AS nis,
       s.asrama,
       COALESCE(p.paid_at, ri.created_at) AS paid_at,
       COALESCE(p.channel, 'DUITKU') AS channel,
       COALESCE(p.method, '-') AS method,
       COALESCE(p.gross_amount, ri.external_amount) AS gross_amount,
       COALESCE(p.gateway_fee, 0) AS gateway_fee,
       COALESCE(p.net_amount, ri.external_amount) AS net_amount,
       COALESCE(p.allocation_status, 'UNALLOCATED') AS allocation_status,
       COALESCE(p.correction_status, 'NONE') AS correction_status,
       ri.match_status,
       ri.resolution_action,
       ri.resolution_notes,
       ri.external_reference,
       ri.discrepancy_amount,
       ri.resolved_at,
       u.full_name AS resolved_by_name
     FROM finance_reconciliation_items ri
     LEFT JOIN finance_payments p ON p.id = ri.payment_id
     LEFT JOIN santri s ON s.id = p.santri_id
     LEFT JOIN users u ON u.id = ri.resolved_by
     ${whereClause}
     ORDER BY ri.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  return {
    items: rows || [],
    totalCount,
    totalPages,
    page,
    pageSize,
  }
}

/**
 * Menyelesaikan transaksi UNALLOCATED melalui Alokasi Manual oleh Bendahara.
 *
 * Sesuai PRD Aturan Anti-Menebak Alokasi:
 * 1. Bendahara secara eksplisit menentukan pembagian nominal ke pos kewajiban santri atau ke Uang Jajan.
 * 2. Total nominal alokasi manual wajib sama persis dengan nominal dana yang belum teralokasi.
 * 3. Dibuatkan record finance_allocations baru secara atomik.
 * 4. Status pembayaran beralih menjadi 'ALLOCATED'.
 * 5. Baris finance_reconciliation_items ditandai 'MANUAL_ALLOCATION' dengan catatan resolusi dan audit trail pengguna.
 */
export async function resolveUnallocatedManualAllocation(
  input: ResolveManualAllocationInput
): Promise<void> {
  const recItem = await queryOne<{
    id: string
    payment_id: string | null
    match_status: string
    resolution_action: string
    discrepancy_amount: number
    external_amount: number
  }>(
    `SELECT id, payment_id, match_status, resolution_action, discrepancy_amount, external_amount
     FROM finance_reconciliation_items
     WHERE id = ?`,
    [input.reconciliationItemId]
  )

  if (!recItem) {
    throw new Error(`Item rekonsiliasi dengan ID "${input.reconciliationItemId}" tidak ditemukan.`)
  }

  if (recItem.resolution_action !== 'NONE') {
    throw new Error('Item rekonsiliasi ini sudah pernah diselesaikan sebelumnya.')
  }

  const paymentId = input.paymentId || recItem.payment_id
  if (!paymentId) {
    throw new Error('Item rekonsiliasi tidak memiliki tautan ID pembayaran.')
  }

  const payment = await queryOne<{
    id: string
    santri_id: string
    payment_number: string
    gross_amount: number
    channel: string
    allocation_status: string
  }>(
    `SELECT id, santri_id, payment_number, gross_amount, channel, allocation_status
     FROM finance_payments
     WHERE id = ?`,
    [paymentId]
  )

  if (!payment) {
    throw new Error(`Pembayaran dengan ID "${paymentId}" tidak ditemukan.`)
  }

  if (payment.allocation_status === 'ALLOCATED') {
    throw new Error(`Pembayaran ${payment.payment_number} sudah berstatus ALLOCATED. Resolusi alokasi tidak dapat diulang.`)
  }

  const targetSantriId = input.santriId || payment.santri_id
  if (!targetSantriId) {
    throw new Error('Santri tujuan wajib ditentukan untuk alokasi manual.')
  }

  // Cek apakah mutasi wallet ledger untuk pembayaran/rekonsiliasi ini sudah pernah dicatat
  const existingLedger = await queryOne<{ id: string }>(
    `SELECT id FROM finance_wallet_ledger
     WHERE (reference_id = ? OR reference_id = ?) AND direction = 'IN'`,
    [payment.payment_number, recItem.id]
  )
  if (existingLedger) {
    throw new Error(
      `Mutasi dompet uang jajan untuk pembayaran ${payment.payment_number} sudah pernah dicatat di buku besar. Operasi ditolak demi mencegah duplikasi saldo.`
    )
  }

  // Hitung sisa dana unallocated yang sah
  const targetUnallocatedAmount = recItem.discrepancy_amount > 0 ? recItem.discrepancy_amount : payment.gross_amount

  const totalRequested = input.allocations.reduce((sum, itm) => sum + Math.floor(itm.amount), 0)
  if (totalRequested !== targetUnallocatedAmount) {
    throw new Error(
      `Total alokasi manual (Rp ${totalRequested.toLocaleString('id-ID')}) harus sama persis dengan nominal dana belum dialokasikan (Rp ${targetUnallocatedAmount.toLocaleString('id-ID')}).`
    )
  }

  const resolutionNotes = input.resolutionNotes ? input.resolutionNotes.trim() : ''
  if (!resolutionNotes) {
    throw new Error('Catatan resolusi alokasi manual wajib diisi untuk kebutuhan audit trail.')
  }

  const statements: Array<{ sql: string; params: unknown[] }> = []
  const createdAt = now()

  // Validasi dan siapkan mutasi tiap pos
  interface PreparedAlloc {
    id: string
    targetType: 'OBLIGATION' | 'UANG_JAJAN'
    itemType: string
    obligationId: string | null
    providerId: string | null
    amount: number
    newObligationPaid?: number
    newObligationStatus?: string
  }

  const preparedAllocs: PreparedAlloc[] = []

  for (const allocInput of input.allocations) {
    const amount = Math.floor(allocInput.amount)
    if (amount <= 0) continue

    if (allocInput.targetType === 'OBLIGATION') {
      if (!allocInput.obligationId) {
        throw new Error(`Kewajiban harus ditentukan untuk alokasi jenis OBLIGATION (${allocInput.itemType}).`)
      }

      const obligation = await queryOne<{
        id: string
        santri_id: string
        item_type: string
        amount_expected: number
        amount_exempted: number
        amount_paid: number
        status: string
        provider_id: string | null
      }>(
        `SELECT id, santri_id, item_type, amount_expected, amount_exempted, amount_paid, status, provider_id
         FROM finance_obligations
         WHERE id = ?`,
        [allocInput.obligationId]
      )

      if (!obligation) {
        throw new Error(`Kewajiban dengan ID "${allocInput.obligationId}" tidak ditemukan.`)
      }

      const effectiveExpected = Math.max(0, obligation.amount_expected - obligation.amount_exempted)
      const remainingQuota = Math.max(0, effectiveExpected - obligation.amount_paid)

      if (amount > remainingQuota) {
        throw new Error(
          `Alokasi Rp ${amount.toLocaleString('id-ID')} ke ${obligation.item_type} melebihi sisa tagihan (Rp ${remainingQuota.toLocaleString('id-ID')}).`
        )
      }

      const newPaid = obligation.amount_paid + amount
      const newStatus = computeObligationStatus(
        obligation.amount_expected,
        obligation.amount_exempted,
        newPaid
      )

      preparedAllocs.push({
        id: generateId(),
        targetType: 'OBLIGATION',
        itemType: obligation.item_type,
        obligationId: obligation.id,
        providerId: obligation.provider_id,
        amount,
        newObligationPaid: newPaid,
        newObligationStatus: newStatus,
      })
    } else {
      // UANG_JAJAN
      preparedAllocs.push({
        id: generateId(),
        targetType: 'UANG_JAJAN',
        itemType: 'UANG_JAJAN',
        obligationId: null,
        providerId: null,
        amount,
      })
    }
  }

  // 1. Insert ke finance_allocations
  for (const a of preparedAllocs) {
    statements.push({
      sql: `
        INSERT INTO finance_allocations (
          id, payment_id, obligation_id, target_type, item_type, provider_id,
          amount, disbursed_amount, distribution_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'UNDISBURSED', ?)
      `,
      params: [
        a.id,
        payment.id,
        a.obligationId,
        a.targetType,
        a.itemType,
        a.providerId,
        a.amount,
        createdAt,
      ],
    })

    if (a.targetType === 'OBLIGATION' && a.obligationId && a.newObligationPaid !== undefined) {
      statements.push({
        sql: `
          UPDATE finance_obligations
          SET amount_paid = ?,
              status = ?,
              updated_at = ?
          WHERE id = ?
        `,
        params: [a.newObligationPaid, a.newObligationStatus, createdAt, a.obligationId],
      })
    }
  }

  // 2. Update status alokasi payment (dan santri_id jika sebelumnya kosong)
  statements.push({
    sql: `UPDATE finance_payments SET allocation_status = 'ALLOCATED', santri_id = COALESCE(santri_id, ?) WHERE id = ?`,
    params: [targetSantriId, payment.id],
  })

  // 3. Update status item rekonsiliasi
  statements.push({
    sql: `
      UPDATE finance_reconciliation_items
      SET resolution_action = 'MANUAL_ALLOCATION',
          resolution_notes = ?,
          resolved_by = ?,
          resolved_at = ?
      WHERE id = ?
    `,
    params: [resolutionNotes, input.resolvedBy, createdAt, recItem.id],
  })

  await batch(statements)

  // 4. Mutasikan Uang Jajan jika ada pos UANG_JAJAN melalui wallet ledger yang authoritative
  for (const a of preparedAllocs) {
    if (a.targetType === 'UANG_JAJAN') {
      const movementType = payment.channel === 'CASH' ? 'TOPUP_CASH' : 'TOPUP_ONLINE'
      await recordWalletMutation({
        santriId: targetSantriId,
        direction: 'IN',
        movementType,
        amount: a.amount,
        referenceId: payment.payment_number,
        operatorId: input.resolvedBy,
        notes: `Resolusi manual transaksi unallocated (${payment.payment_number}): ${resolutionNotes}`,
      })
    }
  }
}

/**
 * Menyelesaikan item rekonsiliasi secara administratif (ADJUSTMENT).
 */
export async function resolveReconciliationItemAdjustment(input: {
  reconciliationItemId: string
  notes: string
  resolvedBy: string
}): Promise<void> {
  const notes = input.notes ? input.notes.trim() : ''
  if (!notes) {
    throw new Error('Catatan penyesuaian administratif wajib diisi.')
  }

  await query(
    `UPDATE finance_reconciliation_items
     SET resolution_action = 'ADJUSTMENT',
         resolution_notes = ?,
         resolved_by = ?,
         resolved_at = ?
     WHERE id = ?`,
    [notes, input.resolvedBy, now(), input.reconciliationItemId]
  )
}

/**
 * Mengambil daftar sesi kas loket beserta audit selisih kas fisik (Rekonsiliasi Kas Fisik).
 */
export async function getCashSessionReconciliationList(filters?: {
  period?: string
  status?: string
  page?: number
  pageSize?: number
}): Promise<{
  sessions: CashSessionReconciliationSummary[]
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

  if (filters?.period) {
    conditions.push(`s.opened_at LIKE ?`)
    params.push(`${filters.period}%`)
  }

  if (filters?.status && filters.status !== 'ALL') {
    if (filters.status === 'SEIMBANG') {
      conditions.push(`s.status = 'CLOSED' AND (s.difference = 0 OR s.difference IS NULL)`)
    } else if (filters.status === 'SELISIH') {
      conditions.push(`s.status = 'CLOSED' AND s.difference != 0`)
    } else if (filters.status === 'BELUM_DITUTUP') {
      conditions.push(`s.status = 'OPEN'`)
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM finance_cash_sessions s ${whereClause}`,
    params
  )
  const totalCount = countRow?.total ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)

  const rows = await query<{
    id: string
    session_code: string
    operator_id: string
    operator_name: string | null
    opened_at: string
    closed_at: string | null
    status: 'OPEN' | 'CLOSED'
    opening_balance: number
    total_cash_in: number
    total_cash_out: number
    expected_closing_balance: number
    actual_closing_balance: number | null
    difference: number | null
    difference_notes: string | null
  }>(
    `SELECT
       s.id,
       s.session_code,
       s.operator_id,
       u.full_name AS operator_name,
       s.opened_at,
       s.closed_at,
       s.status,
       s.opening_balance,
       s.total_cash_in,
       s.total_cash_out,
       s.expected_closing_balance,
       s.actual_closing_balance,
       s.difference,
       s.difference_notes
     FROM finance_cash_sessions s
     LEFT JOIN users u ON u.id = s.operator_id
     ${whereClause}
     ORDER BY s.opened_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const mapped: CashSessionReconciliationSummary[] = (rows || []).map((r) => {
    let recStatus: 'SEIMBANG' | 'SELISIH' | 'BELUM_DITUTUP' = 'BELUM_DITUTUP'
    let isBalanced = false

    if (r.status === 'CLOSED') {
      if (r.difference === 0 || r.difference === null) {
        recStatus = 'SEIMBANG'
        isBalanced = true
      } else {
        recStatus = 'SELISIH'
        isBalanced = false
      }
    }

    return {
      sessionId: r.id,
      sessionCode: r.session_code,
      operatorId: r.operator_id,
      operatorName: r.operator_name,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
      status: r.status,
      openingBalance: r.opening_balance,
      totalCashIn: r.total_cash_in,
      totalCashOut: r.total_cash_out,
      expectedClosingBalance: r.expected_closing_balance,
      actualClosingBalance: r.actual_closing_balance,
      difference: r.difference,
      differenceNotes: r.difference_notes,
      isBalanced,
      reconciliationStatus: recStatus,
    }
  })

  return {
    sessions: mapped,
    totalCount,
    totalPages,
    page,
    pageSize,
  }
}

/**
 * Mengambil seluruh Kasus Pemulihan Dana (Recovery Cases) yang pending.
 */
export async function getPendingRecoveryCases(filters?: {
  period?: string
  status?: string
}): Promise<
  Array<
    FinanceCorrection & {
      creator_name: string | null
      payment_number: string
      santri_name: string
      nis: string
    }
  >
> {
  const conditions: string[] = ['c.is_recovery_case = 1']
  const params: unknown[] = []

  if (filters?.status && filters.status !== 'ALL') {
    conditions.push('c.recovery_status = ?')
    params.push(filters.status)
  } else {
    conditions.push("c.recovery_status = 'PENDING_RECOVERY'")
  }

  if (filters?.period) {
    conditions.push('c.created_at LIKE ?')
    params.push(`${filters.period}%`)
  }

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
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.created_at DESC`,
    params
  )

  return rows || []
}
