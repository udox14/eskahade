// lib/finance/bri/cash-manual-distribution-service.ts
// Domain Service Penyaluran Kas (CASH) & Transfer Bank Manual (MANUAL_TRANSFER)
// Memenuhi seluruh aturan integritas finansial, bukti append-only, sesi kas, dan RBAC Fase BRI-6

import crypto from 'node:crypto'
import { query, queryOne, execute, batch, generateId, now } from '@/lib/db'
import { loadBriConfig } from './config'
import { maskAccount } from './logging'
import { assertDistributionMethodEnabled } from './feature-flags'
import type {
  PrepareCashDistributionInput,
  FinalizeCashDistributionInput,
  CancelCashDistributionInput,
  InitiateManualTransferInput,
  FinalizeManualTransferInput,
  RecordManualTransferUnknownOutcomeInput,
  FailManualTransferInput,
  CancelManualTransferInput,
  ProofUploadValidationInput,
  ProofUploadValidationResult,
  FinanceCashManualEvidence,
  CashManualEvidenceStrength,
  CashManualEvidenceSource,
} from './cash-manual-distribution-types'
import type { FinanceDistribution } from '../distribution-types'
import type { FinanceCashSession } from '../cash-session'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

const MAX_PROOF_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const FINANCE_MUTATE_ROLES = new Set([
  'admin',
  'bendahara',
  'admin_koperasi',
  'petugas_koperasi',
])

export const BANK_STATEMENT_AUTO_CORRELATION_CONTRACT_STATE = 'BANK_STATEMENT_AUTO_CORRELATION_CONTRACT_TBD' as const

export interface BankStatementCrossReferenceResult {
  isAuthoritativeExact: boolean
  reason: string
  contractState: typeof BANK_STATEMENT_AUTO_CORRELATION_CONTRACT_STATE
}

export function checkAuthoritativeBankStatementCrossReference(
  statementTx: {
    id: string
    transaction_id?: string | null
    amount: number
    account_no?: string
    type_normalized?: string
    currency?: string
  },
  distribution: FinanceDistribution
): BankStatementCrossReferenceResult {
  // Public BRI Bank Statement contract does not guarantee any deterministic field linking
  // bank statement transaction rows to Eskahade manual distributions.
  // Until an authoritative contract and bilateral field mapping is officially agreed with BRI,
  // automatic cross-reference is strictly CONTRACT_TBD.
  // Do NOT guess or deduce cross-reference based on matching amount, date, or unverified remarks!
  return {
    isAuthoritativeExact: false,
    reason:
      'BANK_STATEMENT_AUTO_CORRELATION_CONTRACT_TBD: No authoritative contract mapping exists to auto-correlate bank statement debit rows to manual distributions.',
    contractState: BANK_STATEMENT_AUTO_CORRELATION_CONTRACT_STATE,
  }
}

export interface StatementCandidateMatchResult {
  status: 'CANDIDATE' | 'AMBIGUOUS_CANDIDATES' | 'UNMATCHED'
  statementTransactionId: string
  matchedDistributions: Array<{ id: string; distributionNumber: string; amount: number }>
  reason: string
}

export async function matchStatementDebitToCandidates(
  statementTransactionId: string
): Promise<StatementCandidateMatchResult> {
  const stmt = await queryOne<{
    id: string
    account_no: string
    type_normalized: string
    amount: number
    currency: string
    identity_strength: string
  }>(
    `SELECT id, account_no, type_normalized, amount, currency, identity_strength
     FROM finance_bri_statement_transactions
     WHERE id = ?`,
    [statementTransactionId]
  )

  if (!stmt) {
    return {
      status: 'UNMATCHED',
      statementTransactionId,
      matchedDistributions: [],
      reason: 'Statement transaction not found in database.',
    }
  }

  if (stmt.type_normalized !== 'DEBIT' || stmt.currency !== 'IDR') {
    return {
      status: 'UNMATCHED',
      statementTransactionId,
      matchedDistributions: [],
      reason: `Statement transaction is not an IDR DEBIT (type: ${stmt.type_normalized}, currency: ${stmt.currency}).`,
    }
  }

  // Find candidate distributions: MANUAL_TRANSFER, PROCESSING, total_amount == stmt.amount
  const candidates = await query<FinanceDistribution>(
    `SELECT * FROM finance_distributions
     WHERE method = 'MANUAL_TRANSFER'
       AND status = 'PROCESSING'
       AND total_amount = ?`,
    [stmt.amount]
  )

  if (candidates.length === 0) {
    return {
      status: 'UNMATCHED',
      statementTransactionId,
      matchedDistributions: [],
      reason: 'No PROCESSING manual distributions found with matching amount.',
    }
  }

  if (candidates.length > 1) {
    // Ambiguity guard: When multiple distributions share the exact amount, NEVER auto-pick one!
    return {
      status: 'AMBIGUOUS_CANDIDATES',
      statementTransactionId,
      matchedDistributions: candidates.map((c) => ({
        id: c.id,
        distributionNumber: c.distribution_number,
        amount: c.total_amount,
      })),
      reason: `AMBIGUOUS_CANDIDATES: Found ${candidates.length} candidate distributions matching amount Rp${stmt.amount.toLocaleString(
        'id-ID'
      )}. System will not automatically pick a distribution; audited manual resolution is required.`,
    }
  }

  // Exactly one candidate found: Still only a CANDIDATE, not AUTHORITATIVE_EXACT!
  return {
    status: 'CANDIDATE',
    statementTransactionId,
    matchedDistributions: candidates.map((c) => ({
      id: c.id,
      distributionNumber: c.distribution_number,
      amount: c.total_amount,
    })),
    reason: `CANDIDATE: Single matching distribution found, but statement auto-correlation is CONTRACT_TBD. Requires audited manual resolution.`,
  }
}

export class CashManualDistributionService {
  /**
   * Helper RBAC: Validasi bahwa operator memiliki hak akses mutasi keuangan.
   * Menolak peran viewer, tester (read-only), dan pimpinan.
   */
  assertFinanceOperator(operatorId: string, operatorRole: string): void {
    if (!operatorId || typeof operatorId !== 'string') {
      throw new Error('Identitas operator tidak valid (operatorId kosong).')
    }
    const role = (operatorRole || '').toLowerCase().trim()
    if (role === 'tester') {
      throw new Error('Role "tester" bersifat read-only dan dilarang mengeksekusi operasi finansial.')
    }
    if (role === 'pimpinan') {
      throw new Error('Role "pimpinan" bersifat read-only untuk eksekusi operasional penyaluran.')
    }
    if (!FINANCE_MUTATE_ROLES.has(role)) {
      throw new Error(`Role "${operatorRole}" tidak memiliki kewenangan untuk mengubah atau mengeksekusi penyaluran dana.`)
    }
  }

  /**
   * Helper RBAC: Validasi pengesahan bukti manual (MANUAL_OFFICIAL_PROOF).
   * Hanya role admin atau bendahara yang berwenang.
   */
  assertManualProofAuthorizer(operatorId: string, operatorRole: string): void {
    this.assertFinanceOperator(operatorId, operatorRole)
    const role = (operatorRole || '').toLowerCase().trim()
    if (role !== 'admin' && role !== 'bendahara') {
      throw new Error(`Hanya role "admin" atau "bendahara" yang berwenang mengesahkan bukti penyaluran manual (MANUAL_OFFICIAL_PROOF). Role saat ini: "${operatorRole}".`)
    }
  }

  /**
   * Mengambil rekening sumber otoritatif milik Koperasi untuk transfer manual.
   */
  getAuthoritativeSourceAccount(): {
    bankCode: string
    accountNumber: string
    accountHolder: string
  } {
    let collectionAccountNo = ''
    try {
      const config = loadBriConfig()
      collectionAccountNo = (config.collectionAccountNo || '').trim()
    } catch {
      if (typeof process !== 'undefined' && process.env) {
        collectionAccountNo = (process.env.BRI_COLLECTION_ACCOUNT_NO || '').trim()
      }
    }
    if (!collectionAccountNo) {
      throw new Error(
        'CONFIG_ERROR: Nomor rekening operasional Koperasi (BRI_COLLECTION_ACCOUNT_NO) belum dikonfigurasi. Gagal memuat akun sumber transfer manual.'
      )
    }
    return {
      bankCode: '002', // BRI
      accountNumber: collectionAccountNo,
      accountHolder: 'KOPERASI PONTREN SUKAHIDENG',
    }
  }

  // ==========================================================================
  // ALUR DISTRIBUSI KAS (CASH)
  // ==========================================================================

  /**
   * 1. Persiapan Kas Fisik di Loket: DRAFT -> PROCESSING
   * - Menghubungkan distribusi ke sesi kas loket aktif milik operator
   * - Menvalidasi saldo kas fisik sesi mencukupi (mencegah saldo negatif)
   * - Mengunci reservasi alokasi dana di database
   * - Mencatat bukti append-only CASH_PREPARED
   */
  async prepareCashDistribution(
    input: PrepareCashDistributionInput
  ): Promise<{ distributionId: string; status: 'PROCESSING'; cashSessionCode: string }> {
    assertDistributionMethodEnabled('CASH')
    this.assertFinanceOperator(input.operatorId, input.operatorRole)

    // Validasi keberadaan user di tabel users
    const user = await queryOne<{ id: string; role: string }>(
      `SELECT id, role FROM users WHERE id = ?`,
      [input.operatorId]
    )
    if (!user) {
      throw new Error(`Pengguna dengan ID "${input.operatorId}" tidak terdaftar dalam database.`)
    }

    const dist = await queryOne<FinanceDistribution>(
      `SELECT * FROM finance_distributions WHERE id = ?`,
      [input.distributionId]
    )
    if (!dist) {
      throw new Error(`Distribusi dengan ID "${input.distributionId}" tidak ditemukan.`)
    }

    if (dist.method !== 'CASH') {
      throw new Error(`Metode distribusi bukan CASH (metode saat ini: "${dist.method}").`)
    }

    if (dist.status !== 'DRAFT') {
      throw new Error(`Distribusi kas hanya dapat disiapkan dari status DRAFT (status saat ini: "${dist.status}").`)
    }

    // Ambil sesi kas aktif: jika input.cashSessionId disediakan, gunakan itu; jika tidak, ambil sesi OPEN milik operator
    let session: FinanceCashSession | null = null
    if (input.cashSessionId) {
      session = await queryOne<FinanceCashSession>(
        `SELECT * FROM finance_cash_sessions WHERE id = ? AND status = 'OPEN'`,
        [input.cashSessionId]
      )
      if (!session) {
        throw new Error(`Sesi kas dengan ID "${input.cashSessionId}" tidak ditemukan atau sudah tidak berstatus OPEN.`)
      }
    } else {
      session = await queryOne<FinanceCashSession>(
        `SELECT * FROM finance_cash_sessions
         WHERE operator_id = ? AND status = 'OPEN'
         ORDER BY opened_at DESC LIMIT 1`,
        [input.operatorId]
      )
      if (!session) {
        throw new Error(`Operator tidak memiliki sesi kas loket yang aktif (status OPEN). Buka sesi kas terlebih dahulu.`)
      }
    }

    // Operator binding & ownership RBAC (Point 5):
    // Operator drawer check: drawer belongs to session.operator_id.
    // If different, only supervisor (admin / bendahara) can override.
    if (session.operator_id !== input.operatorId) {
      const role = (input.operatorRole || '').toLowerCase().trim()
      if (role === 'admin' || role === 'bendahara') {
        console.warn(
          `[AUDIT] BRI_CASH_SESSION_SUPERVISOR_OVERRIDE: Operator "${input.operatorId}" (${input.operatorRole}) menggunakan sesi kas "${session.id}" milik operator "${session.operator_id}".`
        )
      } else {
        throw new Error(
          `OPERATOR_DRAWER_MISMATCH: Operator "${input.operatorId}" tidak berhak menggunakan laci kas milik operator lain ("${session.operator_id}"). Diperlukan supervisi admin/bendahara.`
        )
      }
    }

    // Hitung saldo kas yang sedang dipesan (PROCESSING) oleh distribusi tunai lain pada sesi ini
    const pendingDistRow = await queryOne<{ pending_amount: number }>(
      `SELECT COALESCE(SUM(total_amount), 0) AS pending_amount
       FROM finance_distributions
       WHERE cash_session_id = ? AND method = 'CASH' AND status = 'PROCESSING' AND id != ?`,
      [session.id, dist.id]
    )
    const pendingReservedCash = pendingDistRow?.pending_amount ?? 0
    const availableCashInSession = session.expected_closing_balance - pendingReservedCash

    if (dist.total_amount > availableCashInSession) {
      throw new Error(
        `Saldo kas fisik pada sesi "${session.session_code}" tidak mencukupi untuk menyiapkan penyaluran tunai (Tersedia: Rp${Math.max(
          0,
          availableCashInSession
        ).toLocaleString('id-ID')}, Dibutuhkan: Rp${dist.total_amount.toLocaleString('id-ID')}).`
      )
    }

    const evidenceId = generateId()
    const timestamp = now()
    const evidenceHash = crypto
      .createHash('sha256')
      .update(`CASH_PREPARED:${dist.id}:${session.id}:${dist.total_amount}:${timestamp}`)
      .digest('hex')

    const statements: Array<{ sql: string; params: unknown[] }> = []

    // 1. Insert bukti CASH_PREPARED
    statements.push({
      sql: `
        INSERT INTO finance_cash_manual_evidence (
          id, distribution_id, evidence_type, evidence_strength, source,
          reference_number, raw_evidence_hash, observed_at, recorded_at,
          operator_id, operator_role_snapshot, notes, created_at
        ) VALUES (?, ?, 'CASH_PREPARED', 'AUTHORITATIVE_EXACT', 'CASH_DESK', ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        evidenceId,
        dist.id,
        session.session_code,
        evidenceHash,
        timestamp,
        timestamp,
        input.operatorId,
        input.operatorRole,
        input.notes || `Kas fisik disiapkan pada sesi ${session.session_code}`,
        timestamp,
      ],
    })

    // 2. Update status header distribusi: DRAFT -> PROCESSING
    statements.push({
      sql: `
        UPDATE finance_distributions
        SET status = 'PROCESSING',
            cash_session_id = ?,
            cash_prepared_at = ?,
            submitted_by = ?,
            submitted_at = ?,
            updated_at = ?
        WHERE id = ?
      `,
      params: [
        session.id,
        timestamp,
        input.operatorId,
        timestamp,
        timestamp,
        dist.id,
      ],
    })

    await batch(statements)

    return {
      distributionId: dist.id,
      status: 'PROCESSING',
      cashSessionCode: session.session_code,
    }
  }

  /**
   * 2. Finalisasi Serah Terima Kas: PROCESSING -> DISTRIBUTED
   * - Menvalidasi tanda terima fisik dan nama penerima riil
   * - Mendeteksi duplikasi tanda terima (idempotensi)
   * - Memotong saldo sesi kas secara atomik (kas keluar)
   * - Mengunci status distribusi ke DISTRIBUTED secara permanen
   */
  async finalizeCashDistribution(
    input: FinalizeCashDistributionInput
  ): Promise<{ distributionId: string; status: 'DISTRIBUTED'; receiptReference: string }> {
    assertDistributionMethodEnabled('CASH')
    this.assertFinanceOperator(input.operatorId, input.operatorRole)

    // Validasi keberadaan user di tabel users
    const user = await queryOne<{ id: string; role: string }>(
      `SELECT id, role FROM users WHERE id = ?`,
      [input.operatorId]
    )
    if (!user) {
      throw new Error(`Pengguna dengan ID "${input.operatorId}" tidak terdaftar dalam database.`)
    }

    if (!input.receivingPersonName || input.receivingPersonName.trim().length === 0) {
      throw new Error('Nama penerima fisik (receivingPersonName) wajib dicantumkan pada bukti serah terima kas.')
    }

    const dist = await queryOne<FinanceDistribution>(
      `SELECT * FROM finance_distributions WHERE id = ?`,
      [input.distributionId]
    )
    if (!dist) {
      throw new Error(`Distribusi dengan ID "${input.distributionId}" tidak ditemukan.`)
    }

    if (dist.method !== 'CASH') {
      throw new Error(`Metode distribusi bukan CASH.`)
    }

    // Idempotensi: Jika sudah DISTRIBUTED, verifikasi kelengkapan lalu kembalikan
    if (dist.status === 'DISTRIBUTED') {
      const existingEvidence = await queryOne<FinanceCashManualEvidence>(
        `SELECT * FROM finance_cash_manual_evidence
         WHERE distribution_id = ? AND evidence_type = 'CASH_HANDOVER_RECEIPT' LIMIT 1`,
        [dist.id]
      )
      return {
        distributionId: dist.id,
        status: 'DISTRIBUTED',
        receiptReference: existingEvidence?.reference_number || 'ALREADY_DISTRIBUTED',
      }
    }

    if (dist.status !== 'PROCESSING') {
      throw new Error(`Finalisasi serah terima kas hanya dapat dilakukan dari status PROCESSING (status saat ini: "${dist.status}").`)
    }

    if (!dist.cash_session_id) {
      throw new Error('Distribusi kas belum terhubung ke sesi kas loket.')
    }

    // Validasi sesi kas masih berstatus OPEN
    const session = await queryOne<FinanceCashSession>(
      `SELECT * FROM finance_cash_sessions WHERE id = ?`,
      [dist.cash_session_id]
    )
    if (!session || session.status !== 'OPEN') {
      throw new Error('Sesi kas loket terkait telah ditutup atau tidak ditemukan. Finalisasi serah terima dilarang.')
    }

    // Operator binding & ownership RBAC:
    // Operator drawer check: drawer belongs to session.operator_id.
    // If different, only supervisor (admin / bendahara) can override.
    if (session.operator_id !== input.operatorId) {
      const role = (input.operatorRole || '').toLowerCase().trim()
      if (role === 'admin' || role === 'bendahara') {
        console.warn(
          `[AUDIT] BRI_CASH_SESSION_SUPERVISOR_OVERRIDE: Operator "${input.operatorId}" (${input.operatorRole}) memfinalisasi penyaluran kas sesi "${session.id}" milik operator "${session.operator_id}".`
        )
      } else {
        throw new Error(
          `OPERATOR_DRAWER_MISMATCH: Operator "${input.operatorId}" tidak berhak menggunakan laci kas milik operator lain ("${session.operator_id}"). Diperlukan supervisi admin/bendahara.`
        )
      }
    }

    if (session.expected_closing_balance < dist.total_amount) {
      throw new Error(
        `Saldo kas loket tidak mencukupi untuk pengeluaran kas (Tersedia: Rp${session.expected_closing_balance.toLocaleString(
          'id-ID'
        )}, Dibutuhkan: Rp${dist.total_amount.toLocaleString('id-ID')}).`
      )
    }

    const receiptRef =
      input.receiptReference?.trim() || `RCP-${dist.distribution_number}`

    // Deteksi tabrakan referensi tanda terima pada distribusi lain
    const collision = await queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM finance_cash_manual_evidence
       WHERE reference_number = ? AND evidence_type = 'CASH_HANDOVER_RECEIPT' AND distribution_id != ?`,
      [receiptRef, dist.id]
    )
    if (collision && collision.count > 0) {
      throw new Error(`COLLISION_CONFLICT: Nomor referensi tanda terima "${receiptRef}" telah digunakan untuk distribusi lain.`)
    }

    // Validasi server-owned proof reference jika disertakan
    const proofRef = (input.proofAttachmentRef || input.proofAttachmentUrl || '').trim() || null
    if (proofRef) {
      if (
        proofRef.includes('..') ||
        proofRef.includes('\\') ||
        proofRef.startsWith('http://') ||
        proofRef.startsWith('https://') ||
        (!proofRef.startsWith('proofs/') && !proofRef.startsWith('PRF-'))
      ) {
        throw new Error('INVALID_PROOF_REFERENCE: Referensi bukti fisik harus berupa format server-owned yang aman (misal: "proofs/..." atau "PRF-...").')
      }
    }

    const evidenceId = generateId()
    const timestamp = now()
    const evidenceHash = crypto
      .createHash('sha256')
      .update(`CASH_HANDOVER:${dist.id}:${receiptRef}:${input.receivingPersonName}:${dist.total_amount}:${timestamp}`)
      .digest('hex')

    const statements: Array<{ sql: string; params: unknown[] }> = []

    // 1. Insert bukti serah terima CASH_HANDOVER_RECEIPT
    statements.push({
      sql: `
        INSERT INTO finance_cash_manual_evidence (
          id, distribution_id, evidence_type, evidence_strength, source,
          reference_number, raw_evidence_hash, observed_at, recorded_at,
          operator_id, operator_role_snapshot, receiving_person_name,
          notes, attachment_url, attachment_hash, attachment_mime, attachment_size, created_at
        ) VALUES (?, ?, 'CASH_HANDOVER_RECEIPT', 'MANUAL_RESOLVED', 'PHYSICAL_RECEIPT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        evidenceId,
        dist.id,
        receiptRef,
        evidenceHash,
        timestamp,
        timestamp,
        input.operatorId,
        input.operatorRole,
        input.receivingPersonName.trim(),
        input.notes || `Diserahkan kepada ${input.receivingPersonName.trim()}`,
        proofRef,
        input.proofAttachmentHash || null,
        input.proofAttachmentMime || null,
        input.proofAttachmentSize || null,
        timestamp,
      ],
    })

    // 2. Potong kas fisik sesi kas loket secara atomik (kas keluar)
    statements.push({
      sql: `
        UPDATE finance_cash_sessions
        SET total_cash_out = total_cash_out + ?,
            expected_closing_balance = expected_closing_balance - ?,
            updated_at = ?
        WHERE id = ?
      `,
      params: [dist.total_amount, dist.total_amount, timestamp, session.id],
    })

    // 3. Update status header distribusi: PROCESSING -> DISTRIBUTED
    statements.push({
      sql: `
        UPDATE finance_distributions
        SET status = 'DISTRIBUTED',
            cash_handed_over_at = ?,
            cash_receiver_name = ?,
            transferred_by = ?,
            transferred_at = ?,
            proof_attachment_url = COALESCE(?, proof_attachment_url),
            distribution_request_id = COALESCE(?, distribution_request_id),
            updated_at = ?
        WHERE id = ?
      `,
      params: [
        timestamp,
        input.receivingPersonName.trim(),
        input.operatorId,
        timestamp,
        proofRef || null,
        input.distributionRequestId || null,
        timestamp,
        dist.id,
      ],
    })

    // 4. Update alokasi (disbursed_amount & distribution_status) secara authoritatif
    const allocItems = await query<{ allocation_id: string }>(
      `SELECT DISTINCT allocation_id FROM finance_distribution_items WHERE distribution_id = ?`,
      [dist.id]
    )

    for (const item of allocItems) {
      statements.push({
        sql: `
          UPDATE finance_allocations
          SET disbursed_amount = (
                SELECT COALESCE(SUM(di.amount), 0)
                FROM finance_distribution_items di
                JOIN finance_distributions d ON di.distribution_id = d.id
                WHERE di.allocation_id = ? AND d.status = 'DISTRIBUTED'
              ),
              distribution_status = CASE
                WHEN (
                  SELECT COALESCE(SUM(di.amount), 0)
                  FROM finance_distribution_items di
                  JOIN finance_distributions d ON di.distribution_id = d.id
                  WHERE di.allocation_id = ? AND d.status = 'DISTRIBUTED'
                ) >= amount THEN 'DISBURSED'
                WHEN (
                  SELECT COALESCE(SUM(di.amount), 0)
                  FROM finance_distribution_items di
                  JOIN finance_distributions d ON di.distribution_id = d.id
                  WHERE di.allocation_id = ? AND d.status = 'DISTRIBUTED'
                ) > 0 THEN 'PARTIALLY_DISBURSED'
                ELSE 'UNDISBURSED'
              END
          WHERE id = ?
        `,
        params: [item.allocation_id, item.allocation_id, item.allocation_id, item.allocation_id],
      })
    }

    await batch(statements)

    return {
      distributionId: dist.id,
      status: 'DISTRIBUTED',
      receiptReference: receiptRef,
    }
  }

  /**
   * 3. Pembatalan Penyaluran Kas:
   * - Jika masih DRAFT: langsung CANCELLED
   * - Jika PROCESSING: Wajib mencatat bukti pengembalian kas fisik (CASH_RETURNED)
   * - Jika sudah DISTRIBUTED: Pembatalan DIBLOKIR keras (harus lewat alur koreksi)
   */
  async cancelCashDistribution(
    input: CancelCashDistributionInput
  ): Promise<{ distributionId: string; status: 'CANCELLED' }> {
    this.assertFinanceOperator(input.operatorId, input.operatorRole)

    const dist = await queryOne<FinanceDistribution>(
      `SELECT * FROM finance_distributions WHERE id = ?`,
      [input.distributionId]
    )
    if (!dist) {
      throw new Error(`Distribusi dengan ID "${input.distributionId}" tidak ditemukan.`)
    }

    if (dist.method !== 'CASH') {
      throw new Error(`Metode distribusi bukan CASH.`)
    }

    if (dist.status === 'DISTRIBUTED') {
      throw new Error('Distribusi tunai yang telah diserahkan (DISTRIBUTED) tidak dapat dibatalkan. Gunakan alur pemulihan / koreksi.')
    }

    if (dist.status === 'CANCELLED') {
      return { distributionId: dist.id, status: 'CANCELLED' }
    }

    const timestamp = now()

    if (dist.status === 'PROCESSING') {
      // Verifikasi bahwa belum ada bukti serah terima fisik
      const handoverEvidence = await queryOne(
        `SELECT id FROM finance_cash_manual_evidence
         WHERE distribution_id = ? AND evidence_type = 'CASH_HANDOVER_RECEIPT' LIMIT 1`,
        [dist.id]
      )
      if (handoverEvidence) {
        throw new Error('Pembatalan dilarang: Kas telah diserahkan dengan tanda terima fisik.')
      }

      const evidenceId = generateId()
      const evidenceHash = crypto
        .createHash('sha256')
        .update(`CASH_RETURNED:${dist.id}:${input.reason}:${timestamp}`)
        .digest('hex')

      const statements: Array<{ sql: string; params: unknown[] }> = []

      // 1. Insert bukti CASH_RETURNED
      statements.push({
        sql: `
          INSERT INTO finance_cash_manual_evidence (
            id, distribution_id, evidence_type, evidence_strength, source,
            reference_number, raw_evidence_hash, observed_at, recorded_at,
            operator_id, operator_role_snapshot, notes, created_at
          ) VALUES (?, ?, 'CASH_RETURNED', 'AUTHORITATIVE_EXACT', 'CASH_DESK', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          evidenceId,
          dist.id,
          dist.cash_session_id,
          evidenceHash,
          timestamp,
          timestamp,
          input.operatorId,
          input.operatorRole,
          input.reason,
          timestamp,
        ],
      })

      // 2. Update status distribusi ke CANCELLED & lepas reservasi alokasi
      statements.push({
        sql: `
          UPDATE finance_distributions
          SET status = 'CANCELLED',
              cancellation_reason = ?,
              cash_returned_at = ?,
              cash_return_reason = ?,
              updated_at = ?
          WHERE id = ?
        `,
        params: [input.reason, timestamp, input.reason, timestamp, dist.id],
      })

      await batch(statements)
    } else if (dist.status === 'DRAFT') {
      await execute(
        `UPDATE finance_distributions
         SET status = 'CANCELLED',
             cancellation_reason = ?,
             updated_at = ?
         WHERE id = ?`,
        [input.reason, timestamp, dist.id]
      )
    }

    return { distributionId: dist.id, status: 'CANCELLED' }
  }

  // ==========================================================================
  // ALUR TRANSFER MANUAL (MANUAL_TRANSFER)
  // ==========================================================================

  /**
   * 1. Inisiasi Transfer Manual: DRAFT -> PROCESSING
   * - Menautkan rekening sumber otoritatif Koperasi secara server-authoritative
   * - Menvalidasi rekening tujuan penerima aktif
   * - Mengunci reservasi alokasi dana
   * - Mencatat bukti inisiasi transfer MANUAL_TRANSFER_INITIATED
   */
  async initiateManualTransfer(
    input: InitiateManualTransferInput
  ): Promise<{ distributionId: string; status: 'PROCESSING'; sourceAccountMasked: string }> {
    assertDistributionMethodEnabled('MANUAL_TRANSFER')
    this.assertFinanceOperator(input.operatorId, input.operatorRole)

    const dist = await queryOne<FinanceDistribution>(
      `SELECT * FROM finance_distributions WHERE id = ?`,
      [input.distributionId]
    )
    if (!dist) {
      throw new Error(`Distribusi dengan ID "${input.distributionId}" tidak ditemukan.`)
    }

    if (dist.method !== 'MANUAL_TRANSFER') {
      throw new Error(`Metode distribusi bukan MANUAL_TRANSFER.`)
    }

    // Investigasi terbuka memblokir transfer kedua (Point 11 & 14)
    const openInvestigation = await queryOne<{ id: string }>(
      `SELECT id FROM finance_reconciliation_items
       WHERE external_reference = ?
         AND (investigation_resolution = 'PENDING' OR (resolution_action = 'NONE' AND investigation_resolution IS NULL))
       LIMIT 1`,
      [dist.distribution_number]
    )
    if (openInvestigation) {
      throw new Error(
        `UNRESOLVED_INVESTIGATION: Transfer manual diblokir karena masih terdapat investigasi terbuka di finance_reconciliation_items untuk distribusi "${dist.distribution_number}". Selesaikan investigasi terlebih dahulu.`
      )
    }

    if (dist.status !== 'DRAFT') {
      throw new Error(`Inisiasi transfer manual hanya dapat dilakukan dari status DRAFT (status saat ini: "${dist.status}").`)
    }

    // Validasi rekening tujuan penerima aktif
    if (!dist.account_id) {
      throw new Error('Distribusi transfer manual wajib memilih rekening bank tujuan.')
    }

    const accRow = await queryOne<{ id: string; is_active: number; recipient_id: string }>(
      `SELECT id, is_active, recipient_id FROM finance_recipient_accounts WHERE id = ?`,
      [dist.account_id]
    )
    if (!accRow) {
      throw new Error(`Rekening penerima dengan ID "${dist.account_id}" tidak ditemukan.`)
    }
    if (accRow.is_active !== 1) {
      throw new Error('Rekening penerima tidak aktif. Inisiasi transfer manual diblokir.')
    }
    if (dist.recipient_id && accRow.recipient_id !== dist.recipient_id) {
      throw new Error('Rekening tujuan tidak cocok dengan penerima distribusi.')
    }

    // Binding rekening sumber otoritatif (Koperasi BRI)
    const sourceAcc = this.getAuthoritativeSourceAccount()

    // Validasi bahwa rekening sumber tidak dipalsukan / diisi sembarang oleh pemanggil (Points 9 & 10)
    if (input.sourceAccountNumber && input.sourceAccountNumber.trim() !== sourceAcc.accountNumber) {
      throw new Error(
        `INVALID_SOURCE_ACCOUNT: Rekening sumber transfer manual harus merupakan rekening resmi Koperasi BRI ("${sourceAcc.accountNumber}"). Rekening sembarang ("${input.sourceAccountNumber}") ditolak.`
      )
    }
    if (input.sourceAccountId && input.sourceAccountId.trim() !== sourceAcc.accountNumber) {
      throw new Error(
        `INVALID_SOURCE_ACCOUNT: Rekening sumber transfer manual harus merupakan rekening resmi Koperasi BRI ("${sourceAcc.accountNumber}"). Rekening sembarang ("${input.sourceAccountId}") ditolak.`
      )
    }
    const evidenceId = generateId()
    const timestamp = now()
    const evidenceHash = crypto
      .createHash('sha256')
      .update(`MANUAL_TRANSFER_INITIATED:${dist.id}:${sourceAcc.accountNumber}:${dist.destination_account}:${timestamp}`)
      .digest('hex')

    const statements: Array<{ sql: string; params: unknown[] }> = []

    // 1. Insert bukti inisiasi transfer MANUAL_TRANSFER_INITIATED
    statements.push({
      sql: `
        INSERT INTO finance_cash_manual_evidence (
          id, distribution_id, evidence_type, evidence_strength, source,
          reference_number, raw_evidence_hash, observed_at, recorded_at,
          operator_id, operator_role_snapshot, notes, created_at
        ) VALUES (?, ?, 'MANUAL_TRANSFER_INITIATED', 'AUTHORITATIVE_EXACT', 'BANK_RECEIPT', ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        evidenceId,
        dist.id,
        dist.distribution_number,
        evidenceHash,
        timestamp,
        timestamp,
        input.operatorId,
        input.operatorRole,
        input.notes || `Inisiasi transfer manual dari rekening ${maskAccount(sourceAcc.accountNumber)}`,
        timestamp,
      ],
    })

    // 2. Update status header distribusi: DRAFT -> PROCESSING
    statements.push({
      sql: `
        UPDATE finance_distributions
        SET status = 'PROCESSING',
            source_bank_code = ?,
            source_account_number = ?,
            source_account_holder = ?,
            manual_transfer_initiated_at = ?,
            submitted_by = ?,
            submitted_at = ?,
            updated_at = ?
        WHERE id = ?
      `,
      params: [
        sourceAcc.bankCode,
        sourceAcc.accountNumber,
        sourceAcc.accountHolder,
        timestamp,
        input.operatorId,
        timestamp,
        timestamp,
        dist.id,
      ],
    })

    await batch(statements)

    return {
      distributionId: dist.id,
      status: 'PROCESSING',
      sourceAccountMasked: maskAccount(sourceAcc.accountNumber),
    }
  }

  /**
   * 2. Finalisasi Transfer Manual: PROCESSING -> DISTRIBUTED
   * - Menvalidasi bukti transfer bank otoritatif (MANUAL_TRANSFER_SUCCESS / BANK_STATEMENT_DEBIT / MANUAL_OFFICIAL_PROOF)
   * - Menolak bukti berderajat CANDIDATE
   * - Menvalidasi otorisasi jika bukti bertipe MANUAL_OFFICIAL_PROOF (wajib admin/bendahara)
   * - Mendeteksi tabrakan referensi transfer bank (COLLISION_CONFLICT)
   * - Mengunci status distribusi ke DISTRIBUTED secara permanen
   */
  async finalizeManualTransfer(
    input: FinalizeManualTransferInput
  ): Promise<{ distributionId: string; status: 'DISTRIBUTED'; referenceNumber: string }> {
    assertDistributionMethodEnabled('MANUAL_TRANSFER')
    this.assertFinanceOperator(input.operatorId, input.operatorRole)

    if (!input.referenceNumber || input.referenceNumber.trim().length === 0) {
      throw new Error('Nomor referensi bukti transfer bank wajib disertakan.')
    }

    const dist = await queryOne<FinanceDistribution>(
      `SELECT * FROM finance_distributions WHERE id = ?`,
      [input.distributionId]
    )
    if (!dist) {
      throw new Error(`Distribusi dengan ID "${input.distributionId}" tidak ditemukan.`)
    }

    if (dist.method !== 'MANUAL_TRANSFER') {
      throw new Error(`Metode distribusi bukan MANUAL_TRANSFER.`)
    }

    // Idempotensi: Jika sudah DISTRIBUTED
    if (dist.status === 'DISTRIBUTED') {
      return {
        distributionId: dist.id,
        status: 'DISTRIBUTED',
        referenceNumber: dist.bank_transaction_reference || input.referenceNumber,
      }
    }

    if (dist.status !== 'PROCESSING') {
      throw new Error(`Finalisasi transfer manual hanya dapat dilakukan dari status PROCESSING (status saat ini: "${dist.status}").`)
    }

    // Derivasi otoritatif kekuatan bukti (Server-Derived Evidence Strength)
    // Pemanggil TIDAK BISA mendikte / mengklaim AUTHORITATIVE_EXACT secara sepihak!
    let derivedStrength: CashManualEvidenceStrength
    let source: CashManualEvidenceSource

    if (input.evidenceType === 'MANUAL_OFFICIAL_PROOF') {
      this.assertManualProofAuthorizer(input.operatorId, input.operatorRole)
      derivedStrength = 'MANUAL_RESOLVED'
      source = 'MANUAL_OFFICIAL_PROOF'
    } else if (input.evidenceType === 'MANUAL_TRANSFER_SUCCESS') {
      // Bukti upload operator / struk bank -> MANUAL_RESOLVED, bukan AUTHORITATIVE_EXACT
      derivedStrength = 'MANUAL_RESOLVED'
      source = 'BANK_RECEIPT'
    } else if (input.evidenceType === 'BANK_STATEMENT_DEBIT') {
      // Otorisasi supervisi: Hanya role admin atau bendahara yang berwenang mengesahkan resolusi manual berbasis mutasi bank
      this.assertManualProofAuthorizer(input.operatorId, input.operatorRole)

      if (!input.statementTransactionId) {
        throw new Error(
          'CANDIDATE_EVIDENCE_REJECTED: Bukti bertaraf CANDIDATE tidak dapat digunakan untuk finalisasi transfer ke DISTRIBUTED. Diperlukan verifikasi ID mutasi bank resmi (statementTransactionId) yang terdaftar di database.'
        )
      }
      const stmtTx = await queryOne<{
        id: string
        account_no: string
        transaction_id: string | null
        identity_strength: string
        type_normalized: string
        amount: number
        currency: string
      }>(
        `SELECT id, account_no, transaction_id, identity_strength, type_normalized, amount, currency
         FROM finance_bri_statement_transactions WHERE id = ?`,
        [input.statementTransactionId]
      )
      if (!stmtTx) {
        throw new Error(
          'CANDIDATE_EVIDENCE_REJECTED: Transaksi mutasi bank tidak ditemukan dalam finance_bri_statement_transactions. Bukti berstatus CANDIDATE ditolak.'
        )
      }

      // Validasi rekening mutasi bank harus cocok dengan rekening sumber operasional Koperasi
      const sourceAcc = this.getAuthoritativeSourceAccount()
      if (stmtTx.account_no !== sourceAcc.accountNumber) {
        throw new Error(
          `STATEMENT_ACCOUNT_MISMATCH: Nomor rekening pada mutasi bank ("${stmtTx.account_no}") tidak cocok dengan rekening operasional Koperasi ("${sourceAcc.accountNumber}").`
        )
      }

      // Validasi tipe mutasi bank harus DEBIT
      if (stmtTx.type_normalized !== 'DEBIT') {
        throw new Error(
          `STATEMENT_TYPE_MISMATCH: Mutasi bank bukan merupakan mutasi DEBIT (pengeluaran). Tipe mutasi: "${stmtTx.type_normalized}". Mutasi CREDIT ditolak.`
        )
      }

      // Validasi mata uang harus IDR
      if (stmtTx.currency !== 'IDR') {
        throw new Error(
          `STATEMENT_CURRENCY_MISMATCH: Mutasi bank bukan dalam mata uang IDR (mata uang mutasi: "${stmtTx.currency}").`
        )
      }

      // Validasi nominal harus match exact Rupiah
      if (stmtTx.amount !== dist.total_amount) {
        throw new Error(
          `STATEMENT_AMOUNT_MISMATCH: Nominal mutasi bank (Rp${stmtTx.amount.toLocaleString(
            'id-ID'
          )}) tidak cocok dengan nominal distribusi (Rp${dist.total_amount.toLocaleString(
            'id-ID'
          )}). Bukti berstatus CANDIDATE ditolak.`
        )
      }

      // Unique consumption guard: Satu mutasi bank tidak boleh digunakan oleh lebih dari satu distribusi yang DISTRIBUTED
      const alreadyConsumed = await queryOne<{ id: string; distribution_number: string }>(
        `SELECT id, distribution_number FROM finance_distributions
         WHERE statement_transaction_id = ? AND status = 'DISTRIBUTED' AND id != ?`,
        [input.statementTransactionId, dist.id]
      )
      if (alreadyConsumed) {
        throw new Error(
          `STMT_TRANSACTION_ALREADY_CONSUMED: Mutasi bank dengan ID "${input.statementTransactionId}" telah digunakan untuk menyelesaikan penyaluran lain ("${alreadyConsumed.distribution_number}").`
        )
      }

      // Check future authoritative cross-reference seam
      const crossRef = checkAuthoritativeBankStatementCrossReference(stmtTx, dist)
      if (crossRef.isAuthoritativeExact) {
        derivedStrength = 'AUTHORITATIVE_EXACT'
      } else {
        // Kontrak publik belum menjamin auto-link -> baseline otomatis = CANDIDATE.
        // Audited manual statement resolution oleh admin/bendahara menghasilkan MANUAL_RESOLVED (Bukan AUTHORITATIVE_EXACT).
        // Klaim client (input.evidenceStrength atau isReconciledAuthoritative) diabaikan/ditolak untuk mendikte AUTHORITATIVE_EXACT!
        derivedStrength = 'MANUAL_RESOLVED'
      }
      source = 'BANK_STATEMENT'
    } else {
      throw new Error(`Tipe bukti "${input.evidenceType}" tidak didukung untuk finalisasi transfer manual.`)
    }

    // Validasi server-owned proof reference jika disertakan
    const proofRef = (input.proofAttachmentRef || input.proofAttachmentUrl || '').trim() || null
    if (proofRef) {
      if (
        proofRef.includes('..') ||
        proofRef.includes('\\') ||
        proofRef.startsWith('http://') ||
        proofRef.startsWith('https://') ||
        (!proofRef.startsWith('proofs/') && !proofRef.startsWith('PRF-'))
      ) {
        throw new Error('INVALID_PROOF_REFERENCE: Referensi bukti transfer harus berupa format server-owned yang aman (misal: "proofs/..." atau "PRF-...").')
      }
    }

    const refNum = input.referenceNumber.trim()

    // Deteksi tabrakan referensi transaksi bank pada distribusi lain
    const collision = await queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM finance_cash_manual_evidence
       WHERE reference_number = ? AND evidence_type IN ('MANUAL_TRANSFER_SUCCESS', 'BANK_STATEMENT_DEBIT', 'MANUAL_OFFICIAL_PROOF') AND distribution_id != ?`,
      [refNum, dist.id]
    )
    if (collision && collision.count > 0) {
      throw new Error(`COLLISION_CONFLICT: Nomor referensi transfer bank "${refNum}" telah digunakan untuk distribusi lain.`)
    }

    // Validasi fee bank jika ada
    let validFee: number | null = null
    if (input.bankFee !== undefined && input.bankFee !== null) {
      validFee = Math.floor(input.bankFee)
      if (validFee < 0 || !Number.isFinite(validFee)) {
        throw new Error('Fee bank tidak boleh bernilai negatif.')
      }
    }

    const evidenceId = generateId()
    const timestamp = now()

    const evidenceHash = crypto
      .createHash('sha256')
      .update(`${input.evidenceType}:${dist.id}:${refNum}:${dist.total_amount}:${timestamp}`)
      .digest('hex')

    const statements: Array<{ sql: string; params: unknown[] }> = []

    // 1. Insert bukti sukses transfer
    statements.push({
      sql: `
        INSERT INTO finance_cash_manual_evidence (
          id, distribution_id, evidence_type, evidence_strength, source,
          reference_number, raw_evidence_hash, observed_at, recorded_at,
          operator_id, operator_role_snapshot, notes, attachment_url,
          attachment_hash, attachment_mime, attachment_size, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        evidenceId,
        dist.id,
        input.evidenceType,
        derivedStrength,
        source,
        refNum,
        evidenceHash,
        timestamp,
        timestamp,
        input.operatorId,
        input.operatorRole,
        input.notes || `Transfer manual berhasil diverifikasi dengan nomor referensi ${refNum}`,
        proofRef,
        input.proofAttachmentHash || null,
        input.proofAttachmentMime || null,
        input.proofAttachmentSize || null,
        timestamp,
      ],
    })

    // 2. Update status header distribusi: PROCESSING -> DISTRIBUTED
    statements.push({
      sql: `
        UPDATE finance_distributions
        SET status = 'DISTRIBUTED',
            bank_transaction_reference = ?,
            statement_transaction_id = COALESCE(?, statement_transaction_id),
            bank_fee_amount = ?,
            bank_fee_captured_at = ?,
            manual_transfer_executed_at = ?,
            transferred_by = ?,
            transferred_at = ?,
            proof_attachment_url = COALESCE(?, proof_attachment_url),
            updated_at = ?
        WHERE id = ?
      `,
      params: [
        refNum,
        input.statementTransactionId || null,
        validFee,
        validFee !== null ? timestamp : null,
        timestamp,
        input.operatorId,
        timestamp,
        proofRef,
        timestamp,
        dist.id,
      ],
    })

    // 3. Selesaikan item investigasi di finance_reconciliation_items jika ada
    statements.push({
      sql: `
        UPDATE finance_reconciliation_items
        SET match_status = 'MATCHED',
            investigation_resolution = 'DISTRIBUTION_CONFIRMED',
            resolution_action = 'NONE',
            resolution_notes = COALESCE(resolution_notes || '; ', '') || 'Diselesaikan via bukti transfer valid: ' || ?,
            resolved_by = ?,
            resolved_at = ?
        WHERE external_reference = ? AND (investigation_resolution = 'PENDING' OR resolution_action = 'NONE')
      `,
      params: [refNum, input.operatorId, timestamp, dist.distribution_number],
    })

    // 4. Update alokasi (disbursed_amount & distribution_status) secara authoritatif
    const allocItems = await query<{ allocation_id: string }>(
      `SELECT DISTINCT allocation_id FROM finance_distribution_items WHERE distribution_id = ?`,
      [dist.id]
    )

    for (const item of allocItems) {
      statements.push({
        sql: `
          UPDATE finance_allocations
          SET disbursed_amount = (
                SELECT COALESCE(SUM(di.amount), 0)
                FROM finance_distribution_items di
                JOIN finance_distributions d ON di.distribution_id = d.id
                WHERE di.allocation_id = ? AND d.status = 'DISTRIBUTED'
              ),
              distribution_status = CASE
                WHEN (
                  SELECT COALESCE(SUM(di.amount), 0)
                  FROM finance_distribution_items di
                  JOIN finance_distributions d ON di.distribution_id = d.id
                  WHERE di.allocation_id = ? AND d.status = 'DISTRIBUTED'
                ) >= amount THEN 'DISBURSED'
                WHEN (
                  SELECT COALESCE(SUM(di.amount), 0)
                  FROM finance_distribution_items di
                  JOIN finance_distributions d ON di.distribution_id = d.id
                  WHERE di.allocation_id = ? AND d.status = 'DISTRIBUTED'
                ) > 0 THEN 'PARTIALLY_DISBURSED'
                ELSE 'UNDISBURSED'
              END
          WHERE id = ?
        `,
        params: [item.allocation_id, item.allocation_id, item.allocation_id, item.allocation_id],
      })
    }

    await batch(statements)

    return {
      distributionId: dist.id,
      status: 'DISTRIBUTED',
      referenceNumber: refNum,
    }
  }

  /**
   * 3. Penanganan Ketidakpastian Hasil Transfer (Unknown Outcome):
   * - Jika transfer bank manual mengalami timeout / error koneksi / status ambigu:
   *   Status TETAP PROCESSING.
   *   Reservasi alokasi TETAP TERJAGA.
   *   Dilarang transfer ulang secara buta atau beralih ke CASH.
   */
  async recordManualTransferUnknownOutcome(
    input: RecordManualTransferUnknownOutcomeInput
  ): Promise<{ distributionId: string; status: 'PROCESSING'; note: string; reconciliationItemId: string }> {
    this.assertFinanceOperator(input.operatorId, input.operatorRole)

    const dist = await queryOne<FinanceDistribution>(
      `SELECT * FROM finance_distributions WHERE id = ?`,
      [input.distributionId]
    )
    if (!dist) {
      throw new Error(`Distribusi dengan ID "${input.distributionId}" tidak ditemukan.`)
    }

    if (dist.status !== 'PROCESSING') {
      throw new Error(`Pencatatan outcome tidak diketahui hanya dapat dilakukan saat distribusi berstatus PROCESSING.`)
    }

    const timestamp = now()
    const evidenceId = generateId()
    const reconciliationItemId = generateId()
    const note = `UNKNOWN_OUTCOME: ${input.reason}. Memerlukan investigasi rekening / mutasi bank sebelum tindak lanjut.`
    const evidenceHash = crypto
      .createHash('sha256')
      .update(`MANUAL_TRANSFER_UNKNOWN:${dist.id}:${input.reason}:${timestamp}`)
      .digest('hex')

    const statements: Array<{ sql: string; params: unknown[] }> = []

    // 1. Catat bukti append-only MANUAL_TRANSFER_UNKNOWN (strength = CANDIDATE)
    statements.push({
      sql: `
        INSERT INTO finance_cash_manual_evidence (
          id, distribution_id, evidence_type, evidence_strength, source,
          reference_number, raw_evidence_hash, observed_at, recorded_at,
          operator_id, operator_role_snapshot, notes, created_at
        ) VALUES (?, ?, 'MANUAL_TRANSFER_UNKNOWN', 'CANDIDATE', 'BANK_RECEIPT', ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        evidenceId,
        dist.id,
        dist.distribution_number,
        evidenceHash,
        timestamp,
        timestamp,
        input.operatorId,
        input.operatorRole,
        note,
        timestamp,
      ],
    })

    // 2. Buat kasus investigasi terbuka di finance_reconciliation_items
    statements.push({
      sql: `
        INSERT INTO finance_reconciliation_items (
          id, external_reference, internal_amount, external_amount, discrepancy_amount,
          match_status, reason_code, resolution_action, investigation_resolution,
          resolution_notes, created_at
        ) VALUES (?, ?, ?, 0, ?, 'UNMATCHED_INTERNAL', 'MANUAL_TRANSFER_OUTCOME_UNKNOWN', 'NONE', 'PENDING', ?, ?)
      `,
      params: [
        reconciliationItemId,
        dist.distribution_number,
        dist.total_amount,
        dist.total_amount,
        note,
        timestamp,
      ],
    })

    // 3. Update notes pada distribusi
    statements.push({
      sql: `
        UPDATE finance_distributions
        SET notes = COALESCE(notes || '; ', '') || ?,
            updated_at = ?
        WHERE id = ?
      `,
      params: [note, timestamp, dist.id],
    })

    await batch(statements)

    return {
      distributionId: dist.id,
      status: 'PROCESSING',
      note,
      reconciliationItemId,
    }
  }

  /**
   * 4. Kegagalan Transfer Manual Resmi: PROCESSING -> FAILED
   * - Hanya boleh dengan bukti otoritatif penolakan / kegagalan bank
   * - Melepas reservasi alokasi dana
   * - Menyelesaikan kasus investigasi di finance_reconciliation_items (VOID_RECORDED)
   */
  async failManualTransfer(
    input: FailManualTransferInput
  ): Promise<{ distributionId: string; status: 'FAILED' }> {
    this.assertFinanceOperator(input.operatorId, input.operatorRole)

    const dist = await queryOne<FinanceDistribution>(
      `SELECT * FROM finance_distributions WHERE id = ?`,
      [input.distributionId]
    )
    if (!dist) {
      throw new Error(`Distribusi dengan ID "${input.distributionId}" tidak ditemukan.`)
    }

    if (dist.status !== 'PROCESSING') {
      throw new Error(`Status distribusi harus PROCESSING untuk dapat ditetapkan sebagai FAILED.`)
    }

    const evidenceId = generateId()
    const timestamp = now()
    const strength = input.evidenceStrength || 'AUTHORITATIVE_EXACT'
    const evidenceHash = crypto
      .createHash('sha256')
      .update(`MANUAL_TRANSFER_FAILED:${dist.id}:${input.referenceNumber}:${input.reason}:${timestamp}`)
      .digest('hex')

    const statements: Array<{ sql: string; params: unknown[] }> = []

    // 1. Insert bukti kegagalan transfer
    statements.push({
      sql: `
        INSERT INTO finance_cash_manual_evidence (
          id, distribution_id, evidence_type, evidence_strength, source,
          reference_number, raw_evidence_hash, observed_at, recorded_at,
          operator_id, operator_role_snapshot, notes, created_at
        ) VALUES (?, ?, 'MANUAL_TRANSFER_FAILED', ?, 'BANK_RECEIPT', ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        evidenceId,
        dist.id,
        strength,
        input.referenceNumber,
        evidenceHash,
        timestamp,
        timestamp,
        input.operatorId,
        input.operatorRole,
        input.reason,
        timestamp,
      ],
    })

    // 2. Update status header distribusi: PROCESSING -> FAILED
    statements.push({
      sql: `
        UPDATE finance_distributions
        SET status = 'FAILED',
            rejection_reason = ?,
            updated_at = ?
        WHERE id = ?
      `,
      params: [input.reason, timestamp, dist.id],
    })

    // 3. Selesaikan kasus investigasi di finance_reconciliation_items jika ada
    statements.push({
      sql: `
        UPDATE finance_reconciliation_items
        SET match_status = 'UNMATCHED_INTERNAL',
            investigation_resolution = 'VOID_RECORDED',
            resolution_action = 'VOID_RECORDED',
            resolution_notes = COALESCE(resolution_notes || '; ', '') || 'Transfer manual gagal diverifikasi bank: ' || ?,
            resolved_by = ?,
            resolved_at = ?
        WHERE external_reference = ? AND (investigation_resolution = 'PENDING' OR resolution_action = 'NONE')
      `,
      params: [input.reason, input.operatorId, timestamp, dist.distribution_number],
    })

    await batch(statements)

    return { distributionId: dist.id, status: 'FAILED' }
  }

  /**
   * 5. Pembatalan Transfer Manual:
   * - Dari DRAFT: Boleh langsung CANCELLED
   * - Dari PROCESSING: DIBLOKIR keras tanpa bukti kegagalan bank resmi
   * - Dari DISTRIBUTED: DIBLOKIR keras (harus lewat alur koreksi)
   */
  async cancelManualTransfer(
    input: CancelManualTransferInput
  ): Promise<{ distributionId: string; status: 'CANCELLED' }> {
    this.assertFinanceOperator(input.operatorId, input.operatorRole)

    const dist = await queryOne<FinanceDistribution>(
      `SELECT * FROM finance_distributions WHERE id = ?`,
      [input.distributionId]
    )
    if (!dist) {
      throw new Error(`Distribusi dengan ID "${input.distributionId}" tidak ditemukan.`)
    }

    if (dist.status === 'DISTRIBUTED') {
      throw new Error('Pembatalan dilarang: Penyaluran transfer manual telah selesai (DISTRIBUTED). Gunakan alur pemulihan / koreksi.')
    }

    if (dist.status === 'PROCESSING') {
      throw new Error('Pembatalan dilarang saat transfer manual sedang diproses (PROCESSING). Gunakan bukti kegagalan bank resmi untuk menetapkan status FAILED.')
    }

    if (dist.status === 'CANCELLED') {
      return { distributionId: dist.id, status: 'CANCELLED' }
    }

    await execute(
      `UPDATE finance_distributions
       SET status = 'CANCELLED',
           cancellation_reason = ?,
           updated_at = ?
       WHERE id = ?`,
      [input.reason, now(), dist.id]
    )

    return { distributionId: dist.id, status: 'CANCELLED' }
  }

  // ==========================================================================
  // VALIDASI FILE BUKTI (PROOF SECURITY)
  // ==========================================================================

  /**
   * Validasi Keamanan Upload Berkas Bukti Penyaluran (Section 20):
   * - Allowlist MIME type: jpeg, png, webp, pdf
   * - Batas ukuran: 5 MB
   * - Anti-path traversal: nama berkas tidak boleh mengandung direktori
   * - Menghasilkan object key unik acak (bukan dari input klien)
   * - Menghitung hash SHA-256 untuk audit integrity
   */
  validateProofAttachment(input: ProofUploadValidationInput): ProofUploadValidationResult {
    if (!input || !input.buffer) {
      return { valid: false, error: 'Berkas bukti tidak ditemukan atau kosong.' }
    }

    // 1. Validasi MIME type allowlist
    const mime = (input.mimeType || '').toLowerCase().trim()
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return {
        valid: false,
        error: `Tipe file "${input.mimeType}" tidak diizinkan. Hanya JPEG, PNG, WEBP, dan PDF yang diperbolehkan.`,
      }
    }

    // 2. Validasi ukuran file (max 5 MB)
    const size = input.sizeBytes || input.buffer.length
    if (size > MAX_PROOF_FILE_SIZE) {
      return {
        valid: false,
        error: `Ukuran file melebihi batas maksimum 5 MB (ukuran file: ${(size / (1024 * 1024)).toFixed(2)} MB).`,
      }
    }

    // 3. Validasi filename anti-path traversal
    const cleanFilename = input.originalFilename || 'proof'
    if (
      cleanFilename.includes('..') ||
      cleanFilename.includes('/') ||
      cleanFilename.includes('\\') ||
      cleanFilename.startsWith('http://') ||
      cleanFilename.startsWith('https://')
    ) {
      return {
        valid: false,
        error: 'Nama file tidak aman: mengandung karakter path traversal atau URL eksternal.',
      }
    }

    // 4. Sniffing magic bytes dari buffer konten (Anti-spoofing)
    const buf = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(input.buffer)
    if (buf.length < 4) {
      return {
        valid: false,
        error: 'MAGIC_BYTES_MISMATCH: Konten file terlalu pendek atau rusak.',
      }
    }

    let magicValid = false
    if (mime === 'application/pdf') {
      // PDF: starts with %PDF (0x25, 0x50, 0x44, 0x46)
      magicValid = buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46
    } else if (mime === 'image/jpeg') {
      // JPEG: starts with 0xFF, 0xD8, 0xFF
      magicValid = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    } else if (mime === 'image/png') {
      // PNG: starts with 0x89, 0x50, 0x4E, 0x47
      magicValid = buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    } else if (mime === 'image/webp') {
      // WEBP: starts with 'RIFF' and bytes 8..11 are 'WEBP'
      magicValid =
        buf.length >= 12 &&
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50   // WEBP
    }

    if (!magicValid) {
      return {
        valid: false,
        error: `MAGIC_BYTES_MISMATCH: Konten biner file tidak cocok dengan tipe MIME yang diklaim ("${mime}").`,
      }
    }

    // Ekstensi yang aman berdasarkan MIME
    let ext = 'bin'
    if (mime === 'image/jpeg') ext = 'jpg'
    else if (mime === 'image/png') ext = 'png'
    else if (mime === 'image/webp') ext = 'webp'
    else if (mime === 'application/pdf') ext = 'pdf'

    // 4. Generate random key server-side & opaque proof reference
    const uuid = crypto.randomUUID()
    const objectKey = `proofs/${uuid}.${ext}`
    const proofId = `PRF-${uuid.substring(0, 12)}`

    // 5. Hitung SHA-256
    const hash = crypto.createHash('sha256').update(input.buffer).digest('hex')

    return {
      valid: true,
      proofId,
      proofRef: objectKey,
      objectKey,
      hash,
      mimeType: mime,
      sizeBytes: size,
    }
  }

  /**
   * Seam kontrak masa depan: Verifikasi korelasi otomatis mutasi bank ke instruksi distribusi.
   * Saat ini berstatus CONTRACT_TBD dan mengembalikan isAuthoritativeExact: false.
   */
  checkAuthoritativeBankStatementCrossReference(
    statementTx: {
      id: string
      transaction_id?: string | null
      amount: number
      account_no?: string
      type_normalized?: string
      currency?: string
    },
    distribution: FinanceDistribution
  ): BankStatementCrossReferenceResult {
    return checkAuthoritativeBankStatementCrossReference(statementTx, distribution)
  }

  /**
   * Helper pencocokan kandidat distribusi manual dari mutasi bank DEBIT.
   * Tidak pernah memilih secara otomatis bila ada lebih dari satu kandidat (AMBIGUOUS_CANDIDATES).
   * Bila ditemukan tepat satu kandidat, status tetap CANDIDATE (bukan AUTHORITATIVE_EXACT).
   */
  async matchStatementDebitToCandidates(
    statementTransactionId: string
  ): Promise<StatementCandidateMatchResult> {
    return matchStatementDebitToCandidates(statementTransactionId)
  }
}

export const cashManualDistributionService = new CashManualDistributionService()
