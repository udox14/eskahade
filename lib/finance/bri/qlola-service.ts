// lib/finance/bri/qlola-service.ts
// Modul Layanan Penyaluran Dana Non-STP BRI / QLola (Fase BRI-5)
// Menjamin Invariant:
// 1. NON-STP WAJIB: Eskahade submit -> PENDING_APPROVAL -> Signer approve di QLola eksternal -> BRI eksekusi -> Sync
// 2. Maker/Signer Separation: User Eskahade bertindak sebagai Maker, tidak boleh mengemulasi Signer atau menyimpan token
// 3. Snapshot Rekening & Penerima Immutable
// 4. Concurrency Guard: DB Trigger mencegah over-distribusi & over-reservasi (termasuk transfer intent aktif)
// 5. Idempotensi Submit & Outbox Transfer Intent
// 6. Penanganan Pembatalan Aman & Proteksi Switch Provider saat Reservasi Aktif
// 7. Provider Evidence Append-Only & Provenance Guard

import crypto from 'node:crypto'
import { query, queryOne, batch, generateId, now } from '@/lib/db'
import { briLog } from '@/lib/finance/bri/logging'
import {
  isStatusReserving,
  isIntentReserving,
  validateDistributionStatusTransition,
  mapExternalQlolaStatus,
  maskBeneficiaryAccount,
  canAuthorizeManualProof,
} from '@/lib/finance/bri/qlola-policy'
import type {
  BriDistributionStatus,
  BriDistributionMethod,
  BriDistributionRole,
  CreateDistributionBatchInput,
  SubmitDistributionToQlolaInput,
  SubmitDistributionToQlolaResult,
  CancelDistributionInput,
  CancelDistributionResult,
  SyncQlolaStatusInput,
  SyncQlolaStatusResult,
  BriRecipientAccountSnapshot,
  BriProviderEvidenceSource,
  BriProviderEvidenceType,
  BriProviderEvidenceStrength,
  BriSubmissionOutcome,
} from '@/lib/finance/bri/qlola-types'
import {
  DISTRIBUTABLE_ITEM_RECIPIENT_MAP,
  QLOLA_H2H_CONTRACT_STATE,
  QLOLA_REAL_SUBMISSION,
} from '@/lib/finance/bri/qlola-types'
import { getEligibleAllocationsForDistribution, normalizeObligationPeriod } from '@/lib/finance/distributions'

export class BriQlolaDistributionService {
  /**
   * Mengambil snapshot rekening penerima yang aktif dan sah.
   */
  async resolveRecipientAndAccountSnapshot(params: {
    recipientId: string
    accountId?: string | null
    method: BriDistributionMethod
  }): Promise<{
    recipient: {
      id: string
      name: string
      recipient_type: 'PESANTREN' | 'KATERING' | 'LAUNDRY'
      is_active: number
    }
    accountSnapshot: BriRecipientAccountSnapshot | null
  }> {
    const recipient = await queryOne<{
      id: string
      name: string
      recipient_type: 'PESANTREN' | 'KATERING' | 'LAUNDRY'
      is_active: number
    }>(
      `SELECT id, name, recipient_type, is_active FROM finance_distribution_recipients WHERE id = ? LIMIT 1`,
      [params.recipientId]
    )

    if (!recipient) {
      throw new Error(`Penerima distribusi "${params.recipientId}" tidak ditemukan.`)
    }

    if (recipient.is_active !== 1) {
      throw new Error(`Penerima distribusi "${recipient.name}" berstatus nonaktif (tidak dapat digunakan untuk penyaluran baru).`)
    }

    // Untuk CASH, rekening bank opsional / null
    if (params.method === 'CASH') {
      return { recipient, accountSnapshot: null }
    }

    // Untuk BRI_QLOLA dan MANUAL_TRANSFER, rekening bank wajib
    let accountRow: {
      id: string
      recipient_id: string
      bank_code: string
      account_number: string
      account_holder: string
      is_primary: number
      is_active: number
    } | null = null

    if (params.accountId) {
      accountRow = await queryOne(
        `SELECT id, recipient_id, bank_code, account_number, account_holder, is_primary, is_active
         FROM finance_recipient_accounts
         WHERE id = ? AND recipient_id = ? LIMIT 1`,
        [params.accountId, params.recipientId]
      )
      if (!accountRow) {
        throw new Error(`Rekening penerima "${params.accountId}" tidak ditemukan untuk penerima "${recipient.name}".`)
      }
    } else {
      // Ambil rekening primary aktif
      accountRow = await queryOne(
        `SELECT id, recipient_id, bank_code, account_number, account_holder, is_primary, is_active
         FROM finance_recipient_accounts
         WHERE recipient_id = ? AND is_primary = 1 AND is_active = 1 LIMIT 1`,
        [params.recipientId]
      )
      if (!accountRow) {
        // Fallback: ambil rekening aktif pertama
        accountRow = await queryOne(
          `SELECT id, recipient_id, bank_code, account_number, account_holder, is_primary, is_active
           FROM finance_recipient_accounts
           WHERE recipient_id = ? AND is_active = 1 LIMIT 1`,
          [params.recipientId]
        )
      }
    }

    if (!accountRow) {
      throw new Error(`Penerima "${recipient.name}" tidak memiliki rekening bank aktif yang terdaftar untuk metode transfer.`)
    }

    if (accountRow.is_active !== 1) {
      throw new Error(`Rekening tujuan "${accountRow.account_number}" berstatus nonaktif.`)
    }

    const accountSnapshot: BriRecipientAccountSnapshot = {
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientCategory: recipient.recipient_type,
      accountId: accountRow.id,
      bankCode: accountRow.bank_code,
      accountNumber: accountRow.account_number,
      accountHolder: accountRow.account_holder,
      isPrimary: accountRow.is_primary === 1,
      isActive: true,
    }

    return { recipient, accountSnapshot }
  }

  /**
   * Membuat Draft Batch Penyaluran Dana (DRAFT).
   */
  async createDistributionDraft(input: CreateDistributionBatchInput): Promise<{
    distributionId: string
    distributionNumber: string
    status: 'DRAFT'
    totalAmount: number
    itemsCount: number
  }> {
    const amountToDisburse = Math.floor(input.amount)
    if (amountToDisburse <= 0 || !Number.isFinite(amountToDisburse)) {
      throw new Error('Nominal penyaluran harus berupa bilangan bulat positif lebih besar dari 0.')
    }

    // 1. Validasi penerima sesuai jenis item
    const expectedRecipientType = DISTRIBUTABLE_ITEM_RECIPIENT_MAP[input.itemType]
    if (!expectedRecipientType) {
      throw new Error(`Item "${input.itemType}" bukan merupakan item penyaluran yang sah.`)
    }

    const { recipient, accountSnapshot } = await this.resolveRecipientAndAccountSnapshot({
      recipientId: input.recipientId,
      accountId: input.accountId,
      method: input.method,
    })

    if (recipient.recipient_type !== expectedRecipientType) {
      throw new Error(
        `Item "${input.itemType}" wajib disalurkan ke "${expectedRecipientType}", bukan "${recipient.recipient_type}" (tidak cocok dengan kategori penerima).`
      )
    }

    // 2. Ambil alokasi yang siap disalurkan (FIFO)
    const normPeriod = normalizeObligationPeriod(input.itemType, input.period)
    const eligibleAllocations = await getEligibleAllocationsForDistribution({
      recipientType: recipient.recipient_type,
      itemType: input.itemType,
      period: normPeriod,
      providerId: recipient.recipient_type !== 'PESANTREN' ? recipient.id : null,
    })

    const totalAvailable = eligibleAllocations.reduce((sum, a) => sum + a.available_amount, 0)
    if (totalAvailable < amountToDisburse) {
      throw new Error(
        `Sisa dana alokasi yang siap disalurkan (Rp${totalAvailable.toLocaleString(
          'id-ID'
        )}) tidak mencukupi untuk nominal permintaan Rp${amountToDisburse.toLocaleString('id-ID')} (melebihi total dana siap salur yang tersedia).`
      )
    }

    const distributionId = generateId()
    const timestamp = now()
    const datePart = timestamp.slice(0, 10).replace(/-/g, '')
    const randSuffix = crypto.randomBytes(3).toString('hex').toUpperCase()
    const distributionNumber = `DIS-${datePart}-${randSuffix}`

    const statements: Array<{ sql: string; params: unknown[] }> = []

    // Header distribusi: DRAFT
    statements.push({
      sql: `
        INSERT INTO finance_distributions (
          id, distribution_number, recipient_type, recipient_id, recipient_name,
          recipient_category, item_type, period, total_amount, method,
          status, destination_bank, destination_bank_code, destination_account,
          account_holder_name, destination_account_holder, account_id,
          currency, bank_fee_amount, notes, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          'DRAFT', ?, ?, ?,
          ?, ?, ?,
          'IDR', NULL, ?, ?, ?
        )
      `,
      params: [
        distributionId,
        distributionNumber,
        recipient.recipient_type,
        recipient.id,
        recipient.name,
        recipient.recipient_type,
        input.itemType,
        normPeriod,
        amountToDisburse,
        input.method,
        accountSnapshot?.bankCode || null,
        accountSnapshot?.bankCode || null,
        accountSnapshot?.accountNumber || null,
        accountSnapshot?.accountHolder || null,
        accountSnapshot?.accountHolder || null,
        accountSnapshot?.accountId || null,
        input.notes || null,
        timestamp,
        timestamp,
      ],
    })

    // Slicing alokasi FIFO
    let remainingAmount = amountToDisburse
    let itemsCount = 0

    for (const alloc of eligibleAllocations) {
      if (remainingAmount <= 0) break
      const slice = Math.min(remainingAmount, alloc.available_amount)
      const itemId = generateId()

      statements.push({
        sql: `
          INSERT INTO finance_distribution_items (
            id, distribution_id, allocation_id, amount, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
        params: [itemId, distributionId, alloc.id, slice, timestamp],
      })

      remainingAmount -= slice
      itemsCount++
    }

    await batch(statements)

    briLog('info', 'BRI_DISTRIBUTION_DRAFT_CREATED', {
      details: {
        distributionId,
        distributionNumber,
        amount: amountToDisburse,
        recipientName: recipient.name,
        method: input.method,
        itemsCount,
      },
    })

    return {
      distributionId,
      distributionNumber,
      status: 'DRAFT',
      totalAmount: amountToDisburse,
      itemsCount,
    }
  }

  /**
   * Mengajukan Penyaluran ke Antrean QLola (Non-STP Submission).
   * Menjamin:
   * 1. ATOMIC DISPATCH PREPARATION: Validasi ketersediaan alokasi, freeze snapshot distribusi, dan create intent SUBMISSION_PENDING (menahan dana) SEBELUM dispatch keluar.
   * 2. PENDING_APPROVAL HANYA diberikan jika provider memberikan SUBMISSION_ACK otoritatif.
   * 3. Jika dispatch timeout/unknown: Intent berstatus UNKNOWN, distribusi tetap DRAFT, DANA TETAP RESERVED.
   * 4. Idempotensi berdasarkan distribution_request_id.
   */
  async submitDistributionToQlola(
    input: SubmitDistributionToQlolaInput
  ): Promise<SubmitDistributionToQlolaResult> {
    const distribution = await queryOne<{
      id: string
      distribution_number: string
      method: BriDistributionMethod
      status: BriDistributionStatus
      total_amount: number
      distribution_request_id: string | null
      batch_reference: string | null
      destination_account: string | null
      destination_bank: string | null
      account_holder_name: string | null
      submitted_by: string | null
      maker_reference: string | null
      dispatch_attempted_at: string | null
      submission_outcome: string | null
    }>(
      `SELECT id, distribution_number, method, status, total_amount,
              distribution_request_id, batch_reference, destination_account,
              destination_bank, account_holder_name, submitted_by, maker_reference,
              dispatch_attempted_at, submission_outcome
       FROM finance_distributions WHERE id = ? LIMIT 1`,
      [input.distributionId]
    )

    if (!distribution) {
      throw new Error(`Instruksi penyaluran "${input.distributionId}" tidak ditemukan.`)
    }

    if (distribution.method !== 'BRI_QLOLA') {
      throw new Error(`Penyaluran ini menggunakan metode "${distribution.method}", bukan "BRI_QLOLA".`)
    }

    // Idempotency Check: Jika intent untuk request_id ini sudah ada, kembalikan hasil existing tanpa duplikasi
    const existingIntent = await queryOne<{
      id: string
      intent_status: string
      provider_status: string | null
    }>(
      `SELECT id, intent_status, provider_status
       FROM finance_qlola_transfer_intents
       WHERE distribution_request_id = ? LIMIT 1`,
      [input.distributionRequestId]
    )

    if (existingIntent) {
      return {
        distributionId: distribution.id,
        distributionNumber: distribution.distribution_number,
        distributionRequestId: input.distributionRequestId,
        status: distribution.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'DRAFT',
        intentStatus: existingIntent.intent_status as any,
        isNonStp: true,
        isReserved: isStatusReserving(distribution.status) || isIntentReserving(existingIntent.intent_status),
        makerReference: distribution.maker_reference || distribution.submitted_by || input.submittedBy,
        batchReference: distribution.batch_reference || '',
        intentId: existingIntent.id,
        alreadySubmitted: true,
        submissionOutcome: (distribution.submission_outcome as any) || (existingIntent.intent_status === 'UNKNOWN' ? 'UNKNOWN' : 'SUBMITTED'),
      }
    }

    // Cek apakah distribusi sudah memiliki intent aktif lain
    const anyActiveIntent = await queryOne<{ id: string; intent_status: string }>(
      `SELECT id, intent_status FROM finance_qlola_transfer_intents
       WHERE distribution_id = ? AND intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'SUBMITTED', 'CONFIRMED') LIMIT 1`,
      [distribution.id]
    )
    if (anyActiveIntent) {
      throw new Error(`Distribusi ini telah memiliki intent transfer aktif (${anyActiveIntent.intent_status}). Pembuatan intent kedua dilarang.`)
    }

    // Validasi bahwa status awal adalah DRAFT
    if (distribution.status !== 'DRAFT') {
      throw new Error(`Penyaluran berstatus "${distribution.status}" tidak dapat diajukan (hanya DRAFT yang dapat diajukan).`)
    }

    const timestamp = now()
    const datePart = timestamp.slice(0, 10).replace(/-/g, '')
    const randSuffix = crypto.randomBytes(3).toString('hex').toUpperCase()
    const batchReference = `BATCH-QLOLA-${datePart}-${randSuffix}`
    const intentId = generateId()

    // Hash payload intent transfer untuk auditabilitas
    const payloadForHash = JSON.stringify({
      distributionId: distribution.id,
      distributionNumber: distribution.distribution_number,
      amount: distribution.total_amount,
      destinationAccount: distribution.destination_account,
      destinationBank: distribution.destination_bank,
      accountHolderName: distribution.account_holder_name,
      makerUserId: input.submittedBy,
      batchReference,
    })
    const payloadHash = crypto.createHash('sha256').update(payloadForHash, 'utf8').digest('hex')

    // STEP 1 ATOMIK: Freeze snapshot distribusi & simpan intent SUBMISSION_PENDING
    // Trigger trg_finance_qlola_intents_prevent_over_reserve_insert memeriksa bahwa reservasi tidak overdraw
    await batch([
      {
        sql: `
          INSERT INTO finance_qlola_transfer_intents (
            id, distribution_id, distribution_request_id, intent_status,
            external_id, maker_user_id, payload_hash,
            provider_status, error_details, created_at, updated_at
          ) VALUES (
            ?, ?, ?, 'SUBMISSION_PENDING',
            NULL, ?, ?,
            'SUBMISSION_PENDING', NULL, ?, ?
          )
        `,
        params: [
          intentId,
          distribution.id,
          input.distributionRequestId,
          input.submittedBy,
          payloadHash,
          timestamp,
          timestamp,
        ],
      },
      {
        sql: `
          UPDATE finance_distributions
          SET submission_outcome = 'SUBMISSION_PENDING',
              provider_request_hash = ?,
              distribution_request_id = ?,
              batch_reference = ?,
              maker_reference = ?,
              submitted_by = ?,
              submitted_at = ?,
              updated_at = ?
          WHERE id = ?
        `,
        params: [
          payloadHash,
          input.distributionRequestId,
          batchReference,
          input.submittedBy,
          input.submittedBy,
          timestamp,
          timestamp,
          distribution.id,
        ],
      },
    ])

    // KASUS 1: PRODUCTION / NO TEST ADAPTER
    // QLOLA_H2H_CONTRACT_STATE = 'QLOLA_H2H_CONTRACT_TBD'
    // QLOLA_REAL_SUBMISSION = 'DISABLED'
    // Produksi fail-closed: outbox intent telah tersimpan sebagai SUBMISSION_PENDING (menahan reservasi di database),
    // distribusi tetap DRAFT (frozen), dan melempar error penolakan pengiriman langsung.
    if (!input.testProviderAdapter) {
      briLog('warn', 'BRI_QLOLA_SUBMISSION_REJECTED_CONTRACT_TBD', {
        details: {
          distributionId: distribution.id,
          distributionRequestId: input.distributionRequestId,
          intentId,
          contractState: QLOLA_H2H_CONTRACT_STATE,
          realSubmission: QLOLA_REAL_SUBMISSION,
        },
      })

      throw new Error(
        `Pengajuan QLola ditolak: Kontrak H2H QLola belum aktif (${QLOLA_H2H_CONTRACT_STATE}). Submission dinonaktifkan di level adapter produksi (${QLOLA_REAL_SUBMISSION}).`
      )
    }

    // KASUS 2: TEST PROVIDER ADAPTER
    // Persist dispatch_attempted_at sesaat sebelum network call keluar
    const dispatchAttemptedAt = now()
    await query(
      `UPDATE finance_distributions SET dispatch_attempted_at = ? WHERE id = ?`,
      [dispatchAttemptedAt, distribution.id]
    )

    let adapterResult: {
      outcome: BriSubmissionOutcome
      providerReference?: string
      providerStatus?: string
      errorCode?: string
      errorMessage?: string
    }

    try {
      const rawResult = await input.testProviderAdapter.dispatchTransfer({
        distributionId: distribution.id,
        amount: distribution.total_amount,
        destinationAccount: distribution.destination_account || '',
        batchReference,
      })

      if (rawResult.outcome === 'ACKNOWLEDGED') {
        adapterResult = {
          outcome: 'SUBMITTED',
          providerReference: rawResult.providerReference,
          providerStatus: rawResult.providerState,
        }
      } else if (rawResult.outcome === 'TIMEOUT') {
        adapterResult = {
          outcome: 'UNKNOWN',
          errorMessage: rawResult.error,
        }
      } else {
        adapterResult = {
          outcome: 'UNKNOWN',
          errorMessage: rawResult.error,
        }
      }
    } catch (err: any) {
      adapterResult = {
        outcome: 'UNKNOWN',
        errorMessage: err?.message || 'Network timeout or connection reset during dispatch',
      }
    }

    const postDispatchTime = now()

    if (adapterResult.outcome === 'SUBMITTED') {
      const evidenceId = generateId()
      const evidenceHash = crypto.createHash('sha256').update(JSON.stringify(adapterResult)).digest('hex')

      await batch([
        // 1. Catat provider evidence SUBMISSION_ACK (AUTHORITATIVE_EXACT)
        {
          sql: `
            INSERT INTO finance_qlola_provider_evidence (
              id, distribution_id, source, evidence_type, evidence_strength, provider_state,
              provider_reference, observed_at, raw_evidence_hash, recorded_by,
              operator_authorized_by, operator_role_snapshot, manual_proof_reference, audit_linkage, notes, resolved_at, created_at
            ) VALUES (
              ?, ?, 'H2H_SYNC', 'SUBMISSION_ACK', 'AUTHORITATIVE_EXACT', ?,
              ?, ?, ?, ?,
              NULL, NULL, NULL, NULL, ?, NULL, ?
            )
          `,
          params: [
            evidenceId,
            distribution.id,
            adapterResult.providerStatus || 'WAITING_APPROVAL',
            adapterResult.providerReference || batchReference,
            postDispatchTime,
            evidenceHash,
            input.submittedBy,
            'Provider acknowledged instruction submission into approval queue',
            postDispatchTime,
          ],
        },
        // 2. Transisi distribusi DRAFT -> PENDING_APPROVAL (Trigger DB memvalidasi bukti SUBMISSION_ACK)
        {
          sql: `
            UPDATE finance_distributions
            SET status = 'PENDING_APPROVAL',
                submission_outcome = 'SUBMITTED',
                provider_status = ?,
                approval_workflow_reference = ?,
                updated_at = ?
            WHERE id = ?
          `,
          params: [
            adapterResult.providerStatus || 'WAITING_APPROVAL',
            adapterResult.providerReference || batchReference,
            postDispatchTime,
            distribution.id,
          ],
        },
        // 3. Update outbox intent ke SUBMITTED (pemindahan reservasi dari intent ke distribusi)
        {
          sql: `
            UPDATE finance_qlola_transfer_intents
            SET intent_status = 'SUBMITTED',
                external_id = ?,
                provider_status = ?,
                updated_at = ?
            WHERE id = ?
          `,
          params: [
            adapterResult.providerReference || batchReference,
            adapterResult.providerStatus || 'WAITING_APPROVAL',
            postDispatchTime,
            intentId,
          ],
        },
      ])

      briLog('info', 'BRI_QLOLA_DISTRIBUTION_SUBMITTED_NON_STP', {
        details: {
          distributionId: distribution.id,
          distributionNumber: distribution.distribution_number,
          distributionRequestId: input.distributionRequestId,
          batchReference,
          makerUser: input.submittedBy,
          totalAmount: distribution.total_amount,
          accountMasked: maskBeneficiaryAccount(distribution.destination_account),
        },
      })

      return {
        distributionId: distribution.id,
        distributionNumber: distribution.distribution_number,
        distributionRequestId: input.distributionRequestId,
        status: 'PENDING_APPROVAL',
        intentStatus: 'SUBMITTED',
        isNonStp: true,
        isReserved: true,
        makerReference: input.submittedBy,
        batchReference,
        intentId,
        alreadySubmitted: false,
        submissionOutcome: 'SUBMITTED',
      }
    } else {
      // outcome === 'UNKNOWN' (Network timeout, lost response, etc.)
      // INVARIANT FINAL:
      // - Distribusi TIDAK BOLEH mengklaim PENDING_APPROVAL (status tetap DRAFT)
      // - submission_outcome = 'UNKNOWN'
      // - intent_status = 'UNKNOWN'
      // - DANA TETAP RESERVED oleh transfer intent
      // - DILARANG: membuat intent kedua, switch CASH/MANUAL, atau melepas reservasi
      await batch([
        {
          sql: `
            UPDATE finance_distributions
            SET submission_outcome = 'UNKNOWN',
                provider_status = 'DISPATCH_TIMEOUT_UNKNOWN',
                updated_at = ?
            WHERE id = ?
          `,
          params: [postDispatchTime, distribution.id],
        },
        {
          sql: `
            UPDATE finance_qlola_transfer_intents
            SET intent_status = 'UNKNOWN',
                provider_status = 'DISPATCH_TIMEOUT_UNKNOWN',
                error_details = ?,
                updated_at = ?
            WHERE id = ?
          `,
          params: [adapterResult.errorMessage || 'Timeout during dispatch', postDispatchTime, intentId],
        },
      ])

      briLog('warn', 'BRI_QLOLA_SUBMISSION_UNKNOWN_TIMEOUT', {
        details: {
          distributionId: distribution.id,
          distributionRequestId: input.distributionRequestId,
          intentId,
          batchReference,
          error: adapterResult.errorMessage,
        },
      })

      return {
        distributionId: distribution.id,
        distributionNumber: distribution.distribution_number,
        distributionRequestId: input.distributionRequestId,
        status: 'DRAFT',
        intentStatus: 'UNKNOWN',
        isNonStp: true,
        isReserved: true,
        makerReference: input.submittedBy,
        batchReference,
        intentId,
        alreadySubmitted: false,
        submissionOutcome: 'UNKNOWN',
        error: adapterResult.errorMessage,
      }
    }
  }

  /**
   * Pembatalan Penyaluran (Cancellation Safety).
   * Aturan PRD & Invariants:
   * 1. Jika dispatch BELUM pernah dicoba (dispatch_attempted_at IS NULL):
   *    - Boleh langsung dibatalkan ke CANCELLED
   *    - Intent dibatalkan, reservasi dana dilepas
   * 2. Jika dispatch SUDAH pernah dicoba (dispatch_attempted_at IS NOT NULL atau outcome UNKNOWN):
   *    - DILARANG transisi langsung ke CANCELLED (diblokir trigger DB)
   *    - Jika belum ada konfirmasi bank, status menjadi/tetap investigasi pembatalan (CANCEL_PENDING / reservasi ditahan)
   *    - Transisi ke CANCELLED WAJIB memiliki bukti otoritatif CANCELLATION_CONFIRMED dari bank
   */
  async cancelDistribution(input: CancelDistributionInput): Promise<CancelDistributionResult> {
    const distribution = await queryOne<{
      id: string
      status: BriDistributionStatus
      method: BriDistributionMethod
      dispatch_attempted_at: string | null
      submission_outcome: string | null
    }>(
      `SELECT id, status, method, dispatch_attempted_at, submission_outcome
       FROM finance_distributions WHERE id = ? LIMIT 1`,
      [input.distributionId]
    )

    if (!distribution) {
      throw new Error(`Penyaluran "${input.distributionId}" tidak ditemukan.`)
    }

    if (['DISTRIBUTED', 'FAILED', 'CANCELLED', 'REJECTED'].includes(distribution.status)) {
      throw new Error(`Penyaluran berstatus "${distribution.status}" bersifat final dan tidak dapat dibatalkan.`)
    }

    // Periksa apakah dispatch pernah dicoba atau distribusi sudah di luar DRAFT
    const hasDispatched =
      distribution.status !== 'DRAFT' ||
      distribution.dispatch_attempted_at !== null ||
      distribution.submission_outcome === 'SUBMITTED' ||
      distribution.submission_outcome === 'UNKNOWN'

    const timestamp = now()

    if (!hasDispatched) {
      // BELUM PERNAH DISPATCH: Boleh langsung CANCELLED & lepas reservasi
      await batch([
        {
          sql: `
            UPDATE finance_qlola_transfer_intents
            SET intent_status = 'CANCELLED', updated_at = ?
            WHERE distribution_id = ? AND intent_status IN ('CREATED', 'SUBMISSION_PENDING')
          `,
          params: [timestamp, distribution.id],
        },
        {
          sql: `
            UPDATE finance_distributions
            SET status = 'CANCELLED',
                cancellation_reason = ?,
                notes = CASE WHEN notes IS NULL THEN ? ELSE notes || ' | ' || ? END,
                updated_at = ?
            WHERE id = ?
          `,
          params: [
            input.reason,
            `Cancelled by: ${input.cancelledBy} (${input.reason})`,
            `Cancelled by: ${input.cancelledBy} (${input.reason})`,
            timestamp,
            distribution.id,
          ],
        },
      ])

      briLog('info', 'BRI_DISTRIBUTION_CANCELLED', {
        details: {
          distributionId: distribution.id,
          fromStatus: distribution.status,
          toStatus: 'CANCELLED',
          isReservationReleased: true,
          reason: input.reason,
        },
      })

      return {
        distributionId: distribution.id,
        status: 'CANCELLED',
        intentStatus: 'CANCELLED',
        isReservationReleased: true,
        cancellationReason: input.reason,
      }
    } else {
      // SUDAH PERNAH DISPATCH:
      if (input.confirmedByBank) {
        // Bank resmi mengonfirmasi pembatalan / instruksi tidak pernah dieksekusi
        const evidenceId = generateId()
        const evidenceHash = crypto.createHash('sha256').update(JSON.stringify({
          action: 'CANCELLATION_CONFIRMED',
          distributionId: distribution.id,
          reason: input.reason,
          cancelledBy: input.cancelledBy,
        })).digest('hex')

        await batch([
          {
            sql: `
              INSERT INTO finance_qlola_provider_evidence (
                id, distribution_id, source, evidence_type, evidence_strength, provider_state,
                provider_reference, observed_at, raw_evidence_hash, recorded_by,
                operator_authorized_by, operator_role_snapshot, manual_proof_reference, audit_linkage, notes, resolved_at, created_at
              ) VALUES (
                ?, ?, 'H2H_SYNC', 'CANCELLATION_CONFIRMED', 'AUTHORITATIVE_EXACT', 'CANCELLED',
                NULL, ?, ?, ?,
                NULL, NULL, 'BANK_CANCELLATION_CONFIRMATION', NULL, ?, NULL, ?
              )
            `,
            params: [
              evidenceId,
              distribution.id,
              timestamp,
              evidenceHash,
              input.cancelledBy,
              `Bank confirmed cancellation: ${input.reason}`,
              timestamp,
            ],
          },
          {
            sql: `
              UPDATE finance_qlola_transfer_intents
              SET intent_status = 'CANCELLED', updated_at = ?
              WHERE distribution_id = ?
            `,
            params: [timestamp, distribution.id],
          },
          {
            sql: `
              UPDATE finance_distributions
              SET status = 'CANCELLED',
                  cancellation_reason = ?,
                  notes = CASE WHEN notes IS NULL THEN ? ELSE notes || ' | ' || ? END,
                  updated_at = ?
              WHERE id = ?
            `,
            params: [
              input.reason,
              `Cancelled by: ${input.cancelledBy} (${input.reason})`,
              `Cancelled by: ${input.cancelledBy} (${input.reason})`,
              timestamp,
              distribution.id,
            ],
          },
        ])

        briLog('info', 'BRI_DISTRIBUTION_CANCELLED', {
          details: {
            distributionId: distribution.id,
            fromStatus: distribution.status,
            toStatus: 'CANCELLED',
            isReservationReleased: true,
            reason: input.reason,
          },
        })

        return {
          distributionId: distribution.id,
          status: 'CANCELLED',
          intentStatus: 'CANCELLED',
          isReservationReleased: true,
          cancellationReason: input.reason,
        }
      } else {
        // Belum ada konfirmasi bank: DILARANG lepas reservasi
        if (distribution.status === 'DRAFT') {
          // Invariant: DRAFT TIDAK BOLEH menjadi CANCEL_PENDING pada finance_distributions!
          // Ketidakpastian pembatalan dimodelkan pada TRANSFER INTENT: UNKNOWN -> CANCEL_PENDING!
          await batch([
            {
              sql: `
                UPDATE finance_qlola_transfer_intents
                SET intent_status = 'CANCEL_PENDING', updated_at = ?
                WHERE distribution_id = ? AND intent_status IN ('UNKNOWN', 'SUBMISSION_PENDING')
              `,
              params: [timestamp, distribution.id],
            },
            {
              sql: `
                UPDATE finance_distributions
                SET provider_status = 'CANCEL_PENDING',
                    cancellation_reason = ?,
                    updated_at = ?
                WHERE id = ?
              `,
              params: [input.reason, timestamp, distribution.id],
            },
          ])

          briLog('info', 'BRI_DISTRIBUTION_CANCELLED', {
            details: {
              distributionId: distribution.id,
              fromStatus: 'DRAFT',
              toStatus: 'DRAFT',
              intentStatus: 'CANCEL_PENDING',
              isReservationReleased: false,
              reason: input.reason,
            },
          })

          return {
            distributionId: distribution.id,
            status: 'DRAFT',
            intentStatus: 'CANCEL_PENDING',
            isReservationReleased: false,
            cancellationReason: input.reason,
          }
        } else {
          // Status PENDING_APPROVAL atau PROCESSING pasca-ACK:
          // Masuk CANCEL_PENDING pada finance_distributions
          await batch([
            {
              sql: `
                UPDATE finance_qlola_transfer_intents
                SET intent_status = 'CANCEL_PENDING', updated_at = ?
                WHERE distribution_id = ? AND intent_status IN ('SUBMITTED', 'UNKNOWN')
              `,
              params: [timestamp, distribution.id],
            },
            {
              sql: `
                UPDATE finance_distributions
                SET status = 'CANCEL_PENDING',
                    cancellation_reason = ?,
                    notes = CASE WHEN notes IS NULL THEN ? ELSE notes || ' | ' || ? END,
                    updated_at = ?
                WHERE id = ?
              `,
              params: [
                input.reason,
                `Cancelled by: ${input.cancelledBy} (${input.reason})`,
                `Cancelled by: ${input.cancelledBy} (${input.reason})`,
                timestamp,
                distribution.id,
              ],
            },
          ])

          briLog('info', 'BRI_DISTRIBUTION_CANCELLED', {
            details: {
              distributionId: distribution.id,
              fromStatus: distribution.status,
              toStatus: 'CANCEL_PENDING',
              isReservationReleased: false,
              reason: input.reason,
            },
          })

          return {
            distributionId: distribution.id,
            status: 'CANCEL_PENDING',
            intentStatus: 'CANCEL_PENDING',
            isReservationReleased: false,
            cancellationReason: input.reason,
          }
        }
      }
    }
  }

  /**
   * Sinkronisasi Status Persetujuan QLola (Approval / Execution Sync).
   * Menerima pembaruan status resmi dari bank atau operator rekonsiliasi.
   * Menegakkan:
   * 1. TEST_PROVIDER dilarang di production.
   * 2. Provenance evidence_strength: hanya AUTHORITATIVE_EXACT atau MANUAL_RESOLVED yang dapat memajukan status.
   * 3. MANUAL_OFFICIAL_PROOF wajib memiliki audit trail lengkap.
   * 4. Fee bank dicatat satu kali dari NULL dan bersifat immutable.
   */
  async syncQlolaStatus(input: SyncQlolaStatusInput): Promise<SyncQlolaStatusResult> {
    const distribution = await queryOne<{
      id: string
      status: BriDistributionStatus
      method: BriDistributionMethod
      total_amount: number
      bank_fee_amount: number | null
    }>(
      `SELECT id, status, method, total_amount, bank_fee_amount FROM finance_distributions WHERE id = ? LIMIT 1`,
      [input.distributionId]
    )

    if (!distribution) {
      throw new Error(`Penyaluran "${input.distributionId}" tidak ditemukan.`)
    }

    // Guard: TEST_PROVIDER dilarang mutlak untuk mengotorisasi status finansial nyata
    const evidenceSource: BriProviderEvidenceSource = input.source || 'H2H_SYNC'
    if (evidenceSource === 'TEST_PROVIDER') {
      throw new Error('TEST_PROVIDER tidak pernah eligible untuk mengotorisasi transisi status finansial nyata.')
    }

    let operatorAuthorizedBy: string | null = null
    let operatorRoleSnapshot: string | null = null
    let resolvedAt: string | null = null

    // Guard: MANUAL_OFFICIAL_PROOF wajib memiliki identitas operator faktual dari database
    if (evidenceSource === 'MANUAL_OFFICIAL_PROOF') {
      if (!input.operatorAuthorizedBy) {
        throw new Error('Bukti MANUAL_OFFICIAL_PROOF wajib menyertakan operatorAuthorizedBy (user ID yang sah).')
      }
      if (!input.manualProofReference || !input.notes) {
        throw new Error('Bukti MANUAL_OFFICIAL_PROOF wajib menyertakan manualProofReference dan notes.')
      }

      const operatorUser = await queryOne<{ id: string; username: string; role: string }>(
        `SELECT id, username, role FROM users WHERE id = ? LIMIT 1`,
        [input.operatorAuthorizedBy]
      )
      if (!operatorUser) {
        throw new Error(`operator_authorized_by tidak valid: User "${input.operatorAuthorizedBy}" tidak ditemukan dalam sistem database.`)
      }

      if (!canAuthorizeManualProof([operatorUser.role as BriDistributionRole])) {
        throw new Error(`Role operator "${operatorUser.role}" tidak memiliki kewenangan otorisasi manual pembuktian penyaluran (wajib admin atau bendahara).`)
      }

      operatorAuthorizedBy = operatorUser.id
      operatorRoleSnapshot = operatorUser.role
      resolvedAt = now()
    }

    const evidenceStrength: BriProviderEvidenceStrength =
      evidenceSource === 'MANUAL_OFFICIAL_PROOF'
        ? 'MANUAL_RESOLVED'
        : (input.evidenceStrength === 'CANDIDATE' ? 'CANDIDATE' : 'AUTHORITATIVE_EXACT')

    const previousStatus = distribution.status
    const internalApproval = mapExternalQlolaStatus(input.externalStatus)
    let nextStatus: BriDistributionStatus = previousStatus
    let isReservationReleased = false
    let isDistributedFinal = false
    let evidenceType: BriProviderEvidenceType = input.evidenceType || 'APPROVAL_PROGRESS'

    switch (internalApproval) {
      case 'WAITING_APPROVAL':
        if (previousStatus === 'DRAFT') {
          nextStatus = 'PENDING_APPROVAL'
          evidenceType = 'SUBMISSION_ACK'
        }
        break

      case 'APPROVED':
        nextStatus = 'PROCESSING'
        evidenceType = 'APPROVAL_PROGRESS'
        break

      case 'COMPLETED':
        nextStatus = 'DISTRIBUTED'
        isDistributedFinal = true
        evidenceType = 'EXECUTION_SUCCESS'
        break

      case 'REJECTED':
        nextStatus = previousStatus === 'CANCEL_PENDING' ? 'CANCELLED' : 'REJECTED'
        isReservationReleased = true
        evidenceType = previousStatus === 'CANCEL_PENDING' ? 'CANCELLATION_CONFIRMED' : 'EXECUTION_REJECTED'
        break

      case 'CANCELLED':
        nextStatus = 'CANCELLED'
        isReservationReleased = true
        evidenceType = 'CANCELLATION_CONFIRMED'
        break

      default:
        if (input.evidenceType === 'SUBMISSION_ACK' && previousStatus === 'DRAFT') {
          nextStatus = 'PENDING_APPROVAL'
          evidenceType = 'SUBMISSION_ACK'
        } else {
          nextStatus = previousStatus
        }
        break
    }

    // Validasi Fee Bank
    if (input.bankFeeAmount !== undefined && input.bankFeeAmount !== null) {
      if (evidenceType !== 'EXECUTION_SUCCESS') {
        throw new Error('Pencatatan fee bank wajib didasari bukti eksekusi penyedia yang sah (EXECUTION_SUCCESS).')
      }
    }

    // Jika tidak ada perubahan status
    if (nextStatus === previousStatus) {
      return {
        distributionId: distribution.id,
        previousStatus,
        currentStatus: nextStatus,
        isReservationReleased: false,
        isDistributedFinal: nextStatus === 'DISTRIBUTED',
      }
    }

    const transition = validateDistributionStatusTransition(
      previousStatus,
      nextStatus,
      distribution.method
    )
    if (!transition.valid) {
      throw new Error(transition.reason)
    }

    const timestamp = now()
    const evidenceId = generateId()
    const evidenceHash = crypto.createHash('sha256').update(JSON.stringify({
      distributionId: distribution.id,
      externalStatus: input.externalStatus,
      bankTransactionReference: input.bankTransactionReference,
      timestamp,
    })).digest('hex')

    const statements: Array<{ sql: string; params: unknown[] }> = []

    // 1. WAJIB INSERT PROVIDER EVIDENCE TERLEBIH DAHULU (sebelum UPDATE status)
    // Trigger trg_finance_dist_require_provider_evidence memeriksa eksistensi bukti ini.
    // Trigger trg_finance_qlola_evidence_prevent_collision memeriksa tabrakan nomor referensi eksekusi bank.
    statements.push({
      sql: `
        INSERT INTO finance_qlola_provider_evidence (
          id, distribution_id, source, evidence_type, evidence_strength, provider_state,
          provider_reference, observed_at, raw_evidence_hash, recorded_by,
          operator_authorized_by, operator_role_snapshot, manual_proof_reference, audit_linkage, notes, resolved_at, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?
        )
      `,
      params: [
        evidenceId,
        distribution.id,
        evidenceSource,
        evidenceType,
        evidenceStrength,
        input.externalStatus,
        input.bankTransactionReference || null,
        timestamp,
        evidenceHash,
        input.operatorId,
        operatorAuthorizedBy,
        operatorRoleSnapshot,
        input.manualProofReference || null,
        input.auditLinkage || null,
        input.notes || `Synced status to ${nextStatus}`,
        resolvedAt,
        timestamp,
      ],
    })

    // 1b. Jika DRAFT beralih ke PENDING_APPROVAL via SUBMISSION_ACK:
    // Update transfer intent ke SUBMITTED secara atomik dalam batch yang sama!
    if (nextStatus === 'PENDING_APPROVAL' && previousStatus === 'DRAFT') {
      statements.push({
        sql: `
          UPDATE finance_qlola_transfer_intents
          SET intent_status = 'SUBMITTED',
              provider_status = ?,
              updated_at = ?
          WHERE distribution_id = ?
            AND intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
        `,
        params: [input.externalStatus, timestamp, distribution.id],
      })
    }

    // 1c. Jika beralih ke CANCELLED, batalkan transfer intent secara atomik
    if (nextStatus === 'CANCELLED') {
      statements.push({
        sql: `
          UPDATE finance_qlola_transfer_intents
          SET intent_status = 'CANCELLED',
              provider_status = ?,
              updated_at = ?
          WHERE distribution_id = ?
            AND intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING', 'SUBMITTED')
        `,
        params: [input.externalStatus, timestamp, distribution.id],
      })
    }

    // 2. Update Header finance_distributions
    // Pengisian fee bank hanya boleh satu kali dari NULL (diatur trigger trg_finance_dist_bank_fee_guard)
    statements.push({
      sql: `
        UPDATE finance_distributions
        SET status = ?,
            submission_outcome = CASE WHEN ? = 'PENDING_APPROVAL' THEN 'SUBMITTED' ELSE submission_outcome END,
            provider_status = ?,
            bank_transaction_reference = COALESCE(?, bank_transaction_reference),
            rejection_reason = COALESCE(?, rejection_reason),
            transferred_at = CASE WHEN ? = 'DISTRIBUTED' THEN ? ELSE transferred_at END,
            transferred_by = CASE WHEN ? = 'DISTRIBUTED' THEN ? ELSE transferred_by END,
            bank_fee_amount = CASE
              WHEN ? = 'DISTRIBUTED' AND (? IS NOT NULL) THEN ?
              ELSE bank_fee_amount
            END,
            bank_fee_captured_at = CASE
              WHEN ? = 'DISTRIBUTED' AND (? IS NOT NULL) THEN ?
              ELSE bank_fee_captured_at
            END,
            bank_fee_bearer = CASE
              WHEN ? = 'DISTRIBUTED' AND (? IS NOT NULL) THEN ?
              ELSE bank_fee_bearer
            END,
            bank_fee_reference = CASE
              WHEN ? = 'DISTRIBUTED' AND (? IS NOT NULL) THEN ?
              ELSE bank_fee_reference
            END,
            updated_at = ?
        WHERE id = ?
      `,
      params: [
        nextStatus,
        nextStatus,
        input.externalStatus,
        input.bankTransactionReference || null,
        input.rejectionReason || null,
        nextStatus,
        timestamp,
        nextStatus,
        input.operatorId,
        nextStatus,
        input.bankFeeAmount ?? null,
        input.bankFeeAmount ?? null,
        nextStatus,
        input.bankFeeAmount ?? null,
        timestamp,
        nextStatus,
        input.bankFeeBearer ?? null,
        input.bankFeeBearer ?? null,
        nextStatus,
        input.bankFeeReference ?? null,
        input.bankFeeReference ?? null,
        timestamp,
        distribution.id,
      ],
    })

    // 3. Jika status beralih ke DISTRIBUTED, perbarui alokasi (disbursed_amount & distribution_status)
    if (nextStatus === 'DISTRIBUTED') {
      const items = await query<{ allocation_id: string }>(
        `SELECT DISTINCT allocation_id FROM finance_distribution_items WHERE distribution_id = ?`,
        [distribution.id]
      )

      for (const item of items) {
        statements.push({
          sql: `
            UPDATE finance_allocations
            SET disbursed_amount = (
                  SELECT COALESCE(SUM(di.amount), 0)
                  FROM finance_distribution_items di
                  JOIN finance_distributions d ON di.distribution_id = d.id
                  WHERE di.allocation_id = ? AND d.status = 'DISTRIBUTED'
                ) + (
                  SELECT COALESCE(SUM(di.amount), 0)
                  FROM finance_distribution_items di
                  WHERE di.allocation_id = ? AND di.distribution_id = ?
                ),
                distribution_status = CASE
                  WHEN (
                    SELECT COALESCE(SUM(di.amount), 0)
                    FROM finance_distribution_items di
                    JOIN finance_distributions d ON di.distribution_id = d.id
                    WHERE di.allocation_id = ? AND d.status = 'DISTRIBUTED'
                  ) + (
                    SELECT COALESCE(SUM(di.amount), 0)
                    FROM finance_distribution_items di
                    WHERE di.allocation_id = ? AND di.distribution_id = ?
                  ) >= amount THEN 'DISBURSED'
                  ELSE 'PARTIALLY_DISBURSED'
                END
            WHERE id = ?
          `,
          params: [
            item.allocation_id,
            item.allocation_id,
            distribution.id,
            item.allocation_id,
            item.allocation_id,
            distribution.id,
            item.allocation_id,
          ],
        })
      }
    }

    await batch(statements)

    briLog('info', 'BRI_QLOLA_STATUS_SYNCED', {
      details: {
        distributionId: distribution.id,
        previousStatus,
        currentStatus: nextStatus,
        externalStatus: input.externalStatus,
        bankRef: input.bankTransactionReference,
      },
    })

    return {
      distributionId: distribution.id,
      previousStatus,
      currentStatus: nextStatus,
      isReservationReleased,
      isDistributedFinal,
      providerEvidenceId: evidenceId,
    }
  }

  /**
   * Mencatat kasus recovery/rekonsiliasi jika terjadi koreksi atas alokasi yang sudah disalurkan (DISTRIBUTED).
   * Menjamin bahwa alokasi atau distribusi historis tidak dimutasi secara destruktif,
   * melainkan membuat item rekonsiliasi PENDING_RECOVERY untuk ditindaklanjuti.
   */
  async recordRecoveryForDistributedCorrection(params: {
    allocationId: string
    distributionId: string
    correctionAmount: number
    reason: string
    operatorId: string
  }): Promise<{ recoveryItemId: string }> {
    const recoveryItemId = generateId()
    const timestamp = now()

    await query(
      `INSERT INTO finance_reconciliation_items (
        id, match_status, internal_amount, resolution_notes, created_at
      ) VALUES (?, 'PENDING_RECOVERY', ?, ?, ?)`,
      [
        recoveryItemId,
        params.correctionAmount,
        `Recovery for distributed allocation ${params.allocationId} (Distribution ${params.distributionId}): ${params.reason}`,
        timestamp,
      ]
    )

    briLog('warn', 'BRI_DISTRIBUTED_ALLOCATION_CORRECTION_RECOVERY_QUEUED', {
      details: {
        recoveryItemId,
        allocationId: params.allocationId,
        distributionId: params.distributionId,
        correctionAmount: params.correctionAmount,
      },
    })

    return { recoveryItemId }
  }

  /**
   * Inquiry Rekening Penerima (Account Name Validation Seam).
   * Saat ini: Deklarasi antarmuka dan mock validation seam.
   */
  async inquiryBeneficiaryAccount(input: {
    bankCode: string
    accountNumber: string
    expectedAccountHolder?: string | null
  }): Promise<{
    bankCode: string
    accountNumber: string
    accountHolderName: string
    isMatched: boolean
    inquiryReference: string
    inquiredAt: string
  }> {
    const timestamp = now()
    const inquiryReference = `INQ-${timestamp.slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

    briLog('info', 'BRI_ACCOUNT_INQUIRY_INITIATED', {
      details: {
        bankCode: input.bankCode,
        accountMasked: maskBeneficiaryAccount(input.accountNumber),
      },
    })

    const simulatedHolder = input.expectedAccountHolder || 'BENDAHARA SUKAHIDENG'
    const isMatched = input.expectedAccountHolder
      ? simulatedHolder.trim().toUpperCase() === input.expectedAccountHolder.trim().toUpperCase()
      : true

    return {
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      accountHolderName: simulatedHolder,
      isMatched,
      inquiryReference,
      inquiredAt: timestamp,
    }
  }
}

export const briQlolaDistributionService = new BriQlolaDistributionService()
