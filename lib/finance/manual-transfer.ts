// lib/finance/manual-transfer.ts
// Manual bank transfer channel: parent uploads proof, verifier approves/rejects.
//
// Invariants (enforced here AND by triggers from migration 0198):
// - amount is server-side: total_charged = gross + Koperasi admin fee + unique code;
// - one submission per order, one payment per submission, one proof image per hash;
// - approval is ONE D1 batch: idempotency key + payment + allocations + Koperasi income
//   (admin fee + unique code) + wallet top-up + submission status + audit event;
// - a received amount different from the expected one is never auto-allocated;
// - money under review cannot be expired/replaced; history is never deleted.

import crypto from 'node:crypto'
import { batch, generateId, now, query, queryOne } from '@/lib/db'
import { getEffectiveRoles, type SessionUser } from '@/lib/auth/session'
import { financeWritePlan } from './write-plan'
import { recordOrderPayment } from './payments'
import { getPaymentOrderById } from './orders'
import { walletMutationStatements } from './wallet-statements'
import { operationIdentity, operationReplay, operationStatement } from './operation'
import { resolveFundManagement } from './fund-management'
import { rupiah } from './money'
import { parseAccountSnapshot } from './transfer-config'
import { putPrivateImageBytes } from '@/lib/r2/private-proofs'

export type TransferSubmissionStatus =
  | 'MENUNGGU_BUKTI' | 'MENUNGGU_VERIFIKASI' | 'PERLU_PERBAIKAN'
  | 'DITERIMA' | 'DITOLAK' | 'DIBATALKAN' | 'KEDALUWARSA'

export const REVIEWABLE_STATUSES: TransferSubmissionStatus[] = ['MENUNGGU_VERIFIKASI']
export const PROOF_MAX_BYTES = 2 * 1024 * 1024

export interface TransferSubmissionRow {
  id: string
  submission_number: string
  order_id: string
  order_number: string
  santri_id: string
  santri_nama: string
  santri_nis: string
  asrama: string | null
  kamar: string | null
  destination_snapshot: string
  expected_amount: number
  unique_code: number
  cooperative_admin_fee: number
  gross_amount: number
  fee_mode: 'ADD' | 'DEDUCT'
  status: TransferSubmissionStatus
  proof_object_key: string | null
  sender_name: string | null
  sender_bank: string | null
  transferred_at: string | null
  parent_notes: string | null
  submitted_at: string | null
  reviewed_by: string | null
  reviewer_name: string | null
  reviewed_at: string | null
  review_notes: string | null
  received_amount: number | null
  resolution: 'EXACT' | 'UNALLOCATED' | null
  payment_id: string | null
  expires_at: string
  created_at: string
}

const SUBMISSION_SELECT = `
  SELECT s.id, s.submission_number, s.order_id, o.order_number, s.santri_id,
         st.nama_lengkap AS santri_nama, st.nis AS santri_nis, st.asrama, st.kamar,
         s.destination_snapshot, s.expected_amount, s.unique_code, s.cooperative_admin_fee, o.gross_amount,
         s.fee_mode, s.status, s.proof_object_key, s.sender_name, s.sender_bank, s.transferred_at, s.parent_notes,
         s.submitted_at, s.reviewed_by, u.full_name AS reviewer_name, s.reviewed_at, s.review_notes,
         s.received_amount, s.resolution, s.payment_id, o.expires_at, s.created_at
  FROM finance_transfer_submissions s
  JOIN finance_payment_orders o ON o.id = s.order_id
  JOIN santri st ON st.id = s.santri_id
  LEFT JOIN users u ON u.id = s.reviewed_by`

export async function getTransferSubmission(id: string): Promise<TransferSubmissionRow | null> {
  return queryOne<TransferSubmissionRow>(`${SUBMISSION_SELECT} WHERE s.id = ?`, [id])
}

export async function getTransferSubmissionByOrder(orderId: string): Promise<TransferSubmissionRow | null> {
  return queryOne<TransferSubmissionRow>(`${SUBMISSION_SELECT} WHERE s.order_id = ?`, [orderId])
}

export async function listTransferSubmissionsForStudent(santriId: string, limit = 20): Promise<TransferSubmissionRow[]> {
  return query<TransferSubmissionRow>(`${SUBMISSION_SELECT} WHERE s.santri_id = ? ORDER BY s.created_at DESC LIMIT ?`, [santriId, limit])
}

// ------------------------------------------------------------------
// Verifier scope (pembagian kerja per asrama)
// ------------------------------------------------------------------

export const TRANSFER_FEATURE_PATH = '/dashboard/keuangan/verifikasi-transfer'
const ALL_SCOPE_ROLES = ['admin', 'bendahara', 'admin_koperasi', 'pimpinan']

export interface VerifierScope {
  all: boolean
  asrama: string[]
  canMutate: boolean
}

export async function getVerifierScope(session: SessionUser): Promise<VerifierScope> {
  const roles = getEffectiveRoles(session)
  const canMutate = !roles.includes('pimpinan') && roles.some(r => ['admin', 'bendahara', 'admin_koperasi', 'petugas_koperasi'].includes(r))
  if (roles.some(r => ALL_SCOPE_ROLES.includes(r))) return { all: true, asrama: [], canMutate }
  const rows = await query<{ asrama: string }>(`SELECT asrama FROM finance_transfer_verifier_scopes WHERE user_id = ? ORDER BY asrama`, [session.id])
  return { all: false, asrama: rows.map(r => r.asrama), canMutate }
}

export function scopeAllows(scope: VerifierScope, asrama: string | null): boolean {
  if (scope.all) return true
  const target = (asrama || '').trim().toUpperCase()
  return scope.asrama.some(a => a.trim().toUpperCase() === target)
}

export interface TransferQueueFilter {
  status?: TransferSubmissionStatus | 'SEMUA'
  asrama?: string
  search?: string
  limit?: number
}

export async function listTransferQueue(scope: VerifierScope, filter: TransferQueueFilter = {}) {
  const where: string[] = []
  const params: unknown[] = []
  const status = filter.status && filter.status !== 'SEMUA' ? filter.status : null
  if (status) { where.push('s.status = ?'); params.push(status) }
  else where.push("s.status IN ('MENUNGGU_VERIFIKASI','PERLU_PERBAIKAN','DITERIMA','DITOLAK')")
  if (!scope.all) {
    if (!scope.asrama.length) return []
    where.push(`UPPER(TRIM(COALESCE(st.asrama, ''))) IN (${scope.asrama.map(() => '?').join(',')})`)
    params.push(...scope.asrama.map(a => a.trim().toUpperCase()))
  }
  if (filter.asrama) { where.push('UPPER(TRIM(COALESCE(st.asrama, \'\'))) = ?'); params.push(filter.asrama.trim().toUpperCase()) }
  if (filter.search?.trim()) {
    const term = `%${filter.search.trim().slice(0, 60)}%`
    where.push('(st.nama_lengkap LIKE ? OR st.nis LIKE ? OR s.submission_number LIKE ? OR s.sender_name LIKE ? OR CAST(s.expected_amount AS TEXT) LIKE ?)')
    params.push(term, term, term, term, term)
  }
  const order = status === 'MENUNGGU_VERIFIKASI' || !status ? 'ORDER BY CASE s.status WHEN \'MENUNGGU_VERIFIKASI\' THEN 0 ELSE 1 END, s.submitted_at ASC' : 'ORDER BY s.updated_at DESC'
  params.push(Math.min(Math.max(filter.limit ?? 100, 1), 300))
  return query<TransferSubmissionRow>(`${SUBMISSION_SELECT} WHERE ${where.join(' AND ')} ${order} LIMIT ?`, params)
}

/** Everything a verifier needs to decide, in one call. */
export async function getTransferReviewDetail(id: string) {
  const submission = await getTransferSubmission(id)
  if (!submission) return null
  const [items, events, history, sameAmount, sameSender] = await Promise.all([
    query<{ item_type: string; amount: number; period: string | null }>(
      `SELECT oi.item_type, oi.amount, ob.period FROM finance_order_items oi
       LEFT JOIN finance_obligations ob ON ob.id = oi.obligation_id WHERE oi.order_id = ? ORDER BY oi.rowid`,
      [submission.order_id]),
    query<{ action: string; from_status: string | null; to_status: string; actor_kind: string; actor_name: string | null; notes: string | null; created_at: string }>(
      `SELECT e.action, e.from_status, e.to_status, e.actor_kind, u.full_name AS actor_name, e.notes, e.created_at
       FROM finance_transfer_submission_events e LEFT JOIN users u ON u.id = e.actor_id
       WHERE e.submission_id = ? ORDER BY e.created_at ASC`, [id]),
    query<{ submission_number: string; expected_amount: number; status: string; created_at: string }>(
      `SELECT submission_number, expected_amount, status, created_at FROM finance_transfer_submissions
       WHERE santri_id = ? AND id != ? AND status NOT IN ('MENUNGGU_BUKTI') ORDER BY created_at DESC LIMIT 6`,
      [submission.santri_id, id]),
    query<{ submission_number: string; santri_nama: string; status: string }>(
      `SELECT s.submission_number, st.nama_lengkap AS santri_nama, s.status FROM finance_transfer_submissions s
       JOIN santri st ON st.id = s.santri_id
       WHERE s.expected_amount = ? AND s.id != ? AND s.status IN ('MENUNGGU_VERIFIKASI','PERLU_PERBAIKAN','DITERIMA')
         AND s.created_at >= datetime(?, '-7 days') LIMIT 5`,
      [submission.expected_amount, id, submission.created_at]),
    submission.sender_name ? query<{ submission_number: string; santri_nama: string; expected_amount: number }>(
      `SELECT s.submission_number, st.nama_lengkap AS santri_nama, s.expected_amount FROM finance_transfer_submissions s
       JOIN santri st ON st.id = s.santri_id
       WHERE LOWER(TRIM(s.sender_name)) = LOWER(TRIM(?)) AND s.id != ? AND s.santri_id != ?
         AND s.status IN ('MENUNGGU_VERIFIKASI','PERLU_PERBAIKAN') LIMIT 5`,
      [submission.sender_name, id, submission.santri_id]) : Promise.resolve([]),
  ])
  return { submission, destination: parseAccountSnapshot(submission.destination_snapshot), items, events, history, warnings: { sameAmount, sameSender } }
}

// ------------------------------------------------------------------
// Parent: upload proof / cancel
// ------------------------------------------------------------------

export interface SubmitProofInput {
  santriId: string
  submissionId: string
  bytes: Uint8Array
  mimeType: string
  senderName: string
  senderBank: string
  transferredAt: string
  notes?: string | null
}

function cleanText(value: string | null | undefined, max: number): string {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
}

export async function submitTransferProof(input: SubmitProofInput) {
  const submission = await getTransferSubmission(input.submissionId)
  if (!submission || submission.santri_id !== input.santriId) throw new Error('Pembayaran tidak ditemukan.')
  if (submission.status !== 'MENUNGGU_BUKTI' && submission.status !== 'PERLU_PERBAIKAN') {
    throw new Error('Bukti untuk pembayaran ini sudah diterima atau sudah ditutup.')
  }
  if (submission.status === 'MENUNGGU_BUKTI' && new Date(submission.expires_at).getTime() < Date.now()) {
    throw new Error('Batas waktu unggah bukti sudah lewat. Buat pembayaran baru, atau hubungi Koperasi bila Anda sudah mentransfer.')
  }
  if (!input.bytes.length || input.bytes.length > PROOF_MAX_BYTES) throw new Error('Ukuran foto bukti maksimal 2 MB.')
  const senderName = cleanText(input.senderName, 80)
  const senderBank = cleanText(input.senderBank, 60)
  if (senderName.length < 2) throw new Error('Nama pemilik rekening pengirim wajib diisi.')
  if (senderBank.length < 2) throw new Error('Bank pengirim wajib diisi.')
  const transferredAt = new Date(input.transferredAt)
  if (Number.isNaN(transferredAt.getTime())) throw new Error('Waktu transfer tidak valid.')
  if (transferredAt.getTime() > Date.now() + 10 * 60 * 1000) throw new Error('Waktu transfer tidak boleh di masa depan.')
  if (transferredAt.getTime() < new Date(submission.created_at).getTime() - 24 * 3600 * 1000) {
    throw new Error('Waktu transfer jauh sebelum pembayaran dibuat. Pastikan bukti sesuai pembayaran ini.')
  }

  const hash = crypto.createHash('sha256').update(input.bytes).digest('hex')
  const reused = await queryOne<{ submission_id: string }>(`SELECT submission_id FROM finance_transfer_proofs WHERE content_hash = ?`, [hash])
  if (reused) throw new Error('Foto bukti ini sudah pernah diunggah. Unggah bukti transfer yang sesuai pembayaran ini.')

  const objectKey = await putPrivateImageBytes(input.bytes, input.mimeType, 'bukti-transfer', {
    ownerId: input.santriId, submissionId: submission.id,
  })
  const timestamp = now()
  const fromStatus = submission.status
  try {
    await batch([
      {
        sql: `INSERT INTO finance_transfer_proofs (content_hash, object_key, submission_id, mime_type, size_bytes, uploaded_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [hash, objectKey, submission.id, input.mimeType, input.bytes.length, timestamp],
      },
      {
        sql: `UPDATE finance_transfer_submissions SET status = 'MENUNGGU_VERIFIKASI', proof_object_key = ?, proof_hash = ?,
                sender_name = ?, sender_bank = ?, transferred_at = ?, parent_notes = ?, submitted_at = ?, updated_at = ?
              WHERE id = ? AND status = ?`,
        params: [objectKey, hash, senderName, senderBank, transferredAt.toISOString(), cleanText(input.notes, 300) || null,
          timestamp, timestamp, submission.id, fromStatus],
      },
      {
        sql: `INSERT INTO finance_transfer_submission_events (id, submission_id, action, from_status, to_status, actor_kind, actor_id, proof_hash, notes, created_at)
              SELECT ?, ?, 'PROOF_UPLOADED', ?, 'MENUNGGU_VERIFIKASI', 'PARENT', NULL, ?, ?, ?
              WHERE EXISTS (SELECT 1 FROM finance_transfer_submissions WHERE id = ? AND status = 'MENUNGGU_VERIFIKASI' AND proof_hash = ?)`,
        params: [generateId(), submission.id, fromStatus, hash, `Pengirim ${senderName} (${senderBank})`, timestamp, submission.id, hash],
      },
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('finance_transfer_proofs.content_hash') || message.includes('UNIQUE')) {
      throw new Error('Foto bukti ini sudah pernah diunggah. Unggah bukti transfer yang sesuai pembayaran ini.')
    }
    throw error
  }
  const updated = await getTransferSubmission(submission.id)
  if (updated?.status !== 'MENUNGGU_VERIFIKASI' || updated.proof_object_key !== objectKey) {
    throw new Error('Status pembayaran berubah saat unggah bukti. Muat ulang halaman.')
  }
  return updated
}

export async function cancelTransferByParent(santriId: string, submissionId: string) {
  const submission = await getTransferSubmission(submissionId)
  if (!submission || submission.santri_id !== santriId) throw new Error('Pembayaran tidak ditemukan.')
  if (submission.status !== 'MENUNGGU_BUKTI') throw new Error('Pembayaran yang buktinya sudah dikirim tidak dapat dibatalkan.')
  const timestamp = now()
  await batch([
    { sql: `UPDATE finance_transfer_submissions SET status = 'DIBATALKAN', updated_at = ? WHERE id = ? AND status = 'MENUNGGU_BUKTI'`,
      params: [timestamp, submissionId] },
    { sql: `INSERT INTO finance_transfer_submission_events (id, submission_id, action, from_status, to_status, actor_kind, notes, created_at)
            SELECT ?, ?, 'CANCELLED', 'MENUNGGU_BUKTI', 'DIBATALKAN', 'PARENT', 'Dibatalkan wali', ?
            WHERE EXISTS (SELECT 1 FROM finance_transfer_submissions WHERE id = ? AND status = 'DIBATALKAN')`,
      params: [generateId(), submissionId, timestamp, submissionId] },
    { sql: `UPDATE finance_payment_orders SET status = 'CANCELLED', updated_at = ?
            WHERE id = ? AND status = 'PENDING' AND EXISTS (SELECT 1 FROM finance_transfer_submissions WHERE order_id = ? AND status = 'DIBATALKAN')`,
      params: [timestamp, submission.order_id, submission.order_id] },
  ])
}

// ------------------------------------------------------------------
// Verifier actions
// ------------------------------------------------------------------

export interface ReviewActor {
  session: SessionUser
  scope: VerifierScope
}

async function loadReviewable(actor: ReviewActor, submissionId: string, allowed: TransferSubmissionStatus[]) {
  if (!actor.scope.canMutate) throw new Error('FORBIDDEN: Akun hanya memiliki hak baca.')
  const submission = await getTransferSubmission(submissionId)
  if (!submission) throw new Error('Pengajuan transfer tidak ditemukan.')
  if (!scopeAllows(actor.scope, submission.asrama)) throw new Error('FORBIDDEN: Asrama ini bukan bagian tugas Anda.')
  if (!allowed.includes(submission.status)) throw new Error(alreadyHandledMessage(submission))
  return submission
}

function alreadyHandledMessage(submission: TransferSubmissionRow) {
  const who = submission.reviewer_name ? ` oleh ${submission.reviewer_name}` : ''
  if (submission.status === 'DITERIMA') return `Pembayaran ini sudah diterima${who}.`
  if (submission.status === 'DITOLAK') return `Pembayaran ini sudah ditolak${who}.`
  if (submission.status === 'PERLU_PERBAIKAN') return 'Pembayaran ini sedang menunggu wali mengunggah ulang bukti.'
  return 'Status pembayaran sudah berubah. Muat ulang antrian.'
}

function concurrencyError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error)
  if (/TRANSFER_GUARD_ABORT|TRANSFER_INVALID_TRANSITION|TRANSFER_SUBMISSION_FINAL|UNIQUE|IDEMPOTENCY_CONFLICT|BRIVA_GUARD_ABORT/.test(message)) {
    throw new Error('Pembayaran ini baru saja diproses petugas lain atau statusnya berubah. Muat ulang antrian.')
  }
  if (/BILLING_REVIEW_REQUIRED|overpayment/i.test(message)) {
    throw new Error('Tagihan pada pembayaran ini perlu pemeriksaan (data modul lama / sudah terbayar). Gunakan "Terima sebagai dana belum teralokasi".')
  }
  throw error instanceof Error ? error : new Error(message)
}

/** Exact match: allocates to the order items and posts Koperasi income in one batch. */
export async function approveTransferSubmission(actor: ReviewActor, input: { submissionId: string; receivedAmount: number; notes?: string }) {
  const receivedAmount = rupiah(input.receivedAmount, 'Nominal diterima')
  const identity = operationIdentity('TRANSFER_REVIEW', actor.session.id, input.submissionId, ['APPROVE', input.submissionId, receivedAmount])
  const replay = await operationReplay<{ paymentId: string }>(identity)
  if (replay) return replay
  const submission = await loadReviewable(actor, input.submissionId, ['MENUNGGU_VERIFIKASI'])
  if (receivedAmount !== submission.expected_amount) {
    throw new Error(`Nominal di mutasi (Rp${receivedAmount.toLocaleString('id-ID')}) tidak sama dengan nominal seharusnya (Rp${submission.expected_amount.toLocaleString('id-ID')}). Gunakan "Terima sebagai dana belum teralokasi" atau tolak.`)
  }
  const order = await getPaymentOrderById(submission.order_id)
  if (!order || order.status !== 'PENDING' || order.payment_method !== 'MANUAL_TRANSFER') throw new Error(alreadyHandledMessage(submission))

  const timestamp = now()
  const plan = financeWritePlan()
  plan.orders.set(order.id, order)
  let payment
  try {
    payment = await recordOrderPayment({
      orderId: order.id, channel: 'TRANSFER', method: 'MANUAL_TRANSFER', externalReference: submission.submission_number,
      receivedBy: actor.session.id, paidAt: timestamp,
    }, plan)
  } catch (error) { concurrencyError(error) }

  const walletTopup = payment.allocations.filter(a => a.target_type === 'UANG_JAJAN').reduce((sum, a) => sum + a.amount, 0)
  const walletStatements = walletTopup > 0 ? walletMutationStatements({
    santriId: submission.santri_id, direction: 'IN', movementType: 'TOPUP_TRANSFER', amount: walletTopup,
    referenceId: payment.id, operatorId: actor.session.id,
    notes: `Isi uang jajan via transfer ${submission.submission_number}`,
  }).statements : []
  const notes = cleanText(input.notes, 300) || null
  const result = { paymentId: payment.id }
  try {
    await batch([
      operationStatement(identity, result, { santriId: submission.santri_id, amount: receivedAmount }),
      ...plan.statements,
      ...walletStatements,
      {
        sql: `UPDATE finance_transfer_submissions SET status = 'DITERIMA', payment_id = ?, received_amount = ?, resolution = 'EXACT',
                reviewed_by = ?, reviewed_at = ?, review_notes = ?, updated_at = ?
              WHERE id = ? AND status = 'MENUNGGU_VERIFIKASI'`,
        params: [payment.id, receivedAmount, actor.session.id, timestamp, notes, timestamp, submission.id],
      },
      {
        sql: `INSERT INTO finance_transfer_submission_events (id, submission_id, action, from_status, to_status, actor_kind, actor_id, notes, created_at)
              SELECT ?, ?, 'APPROVED', 'MENUNGGU_VERIFIKASI', 'DITERIMA', 'STAFF', ?, ?, ?
              WHERE EXISTS (SELECT 1 FROM finance_transfer_submissions WHERE id = ? AND status = 'DITERIMA' AND payment_id = ?)`,
        params: [generateId(), submission.id, actor.session.id, notes || `Diterima Rp${receivedAmount}`, timestamp, submission.id, payment.id],
      },
      // A second verifier loses at the payment insert: the transfer guard requires MENUNGGU_VERIFIKASI.
    ])
  } catch (error) { concurrencyError(error) }
  const check = await getTransferSubmission(submission.id)
  if (check?.status !== 'DITERIMA' || check.payment_id !== payment.id) throw new Error('Pembayaran ini baru saja diproses petugas lain. Muat ulang antrian.')
  return result
}

/** Amount differs or bills are no longer payable: keep the money, allocate nothing, open reconciliation. */
export async function approveTransferAsUnallocated(actor: ReviewActor, input: { submissionId: string; receivedAmount: number; notes: string }) {
  const receivedAmount = rupiah(input.receivedAmount, 'Nominal diterima')
  if (receivedAmount <= 0) throw new Error('Nominal diterima harus lebih dari Rp0.')
  const notes = cleanText(input.notes, 300)
  if (notes.length < 10) throw new Error('Jelaskan alasan (minimal 10 karakter), misalnya selisih nominal di mutasi.')
  const identity = operationIdentity('TRANSFER_REVIEW', actor.session.id, input.submissionId, ['UNALLOCATED', input.submissionId, receivedAmount])
  const replay = await operationReplay<{ paymentId: string }>(identity)
  if (replay) return replay
  const submission = await loadReviewable(actor, input.submissionId, ['MENUNGGU_VERIFIKASI'])
  const timestamp = now()
  const paymentId = generateId()
  const paymentNumber = `PAY-${timestamp.slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
  const fundManagement = await resolveFundManagement(timestamp, 'NEW_FINANCE')
  const result = { paymentId }
  try {
    await batch([
      operationStatement(identity, result, { santriId: submission.santri_id, amount: receivedAmount }),
      {
        sql: `INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee,
                bri_fee_amount, net_amount, status, correction_status, allocation_status, paid_at, external_reference, received_by,
                source, fund_management, created_at, unique_code_amount)
              VALUES (?, ?, NULL, ?, 'TRANSFER', 'MANUAL_TRANSFER', ?, 0, NULL, ?, 'PAID', 'NONE', 'UNALLOCATED', ?, ?, ?, 'NEW_FINANCE', ?, ?, 0)`,
        params: [paymentId, paymentNumber, submission.santri_id, receivedAmount, receivedAmount, timestamp, submission.submission_number,
          actor.session.id, fundManagement, timestamp],
      },
      {
        sql: `INSERT INTO finance_reconciliation_items (id, reconciliation_id, payment_id, settlement_id, cash_session_id, external_reference,
                internal_amount, external_amount, discrepancy_amount, match_status, resolution_action, resolution_notes, created_at)
              VALUES (?, NULL, ?, NULL, NULL, ?, 0, ?, ?, 'UNALLOCATED_TRANSFER', 'NONE', ?, ?)`,
        params: [generateId(), paymentId, submission.submission_number, receivedAmount, receivedAmount,
          `Transfer manual ${submission.submission_number}: seharusnya Rp${submission.expected_amount}, diterima Rp${receivedAmount}. ${notes}`, timestamp],
      },
      {
        sql: `UPDATE finance_transfer_submissions SET status = 'DITERIMA', payment_id = ?, received_amount = ?, resolution = 'UNALLOCATED',
                reviewed_by = ?, reviewed_at = ?, review_notes = ?, updated_at = ?
              WHERE id = ? AND status = 'MENUNGGU_VERIFIKASI'`,
        params: [paymentId, receivedAmount, actor.session.id, timestamp, notes, timestamp, submission.id],
      },
      {
        sql: `INSERT INTO finance_transfer_submission_events (id, submission_id, action, from_status, to_status, actor_kind, actor_id, notes, created_at)
              SELECT ?, ?, 'APPROVED_UNALLOCATED', 'MENUNGGU_VERIFIKASI', 'DITERIMA', 'STAFF', ?, ?, ?
              WHERE EXISTS (SELECT 1 FROM finance_transfer_submissions WHERE id = ? AND payment_id = ?)`,
        params: [generateId(), submission.id, actor.session.id, notes, timestamp, submission.id, paymentId],
      },
      {
        sql: `UPDATE finance_payment_orders SET status = 'CANCELLED', updated_at = ?
              WHERE id = ? AND status = 'PENDING' AND EXISTS (SELECT 1 FROM finance_transfer_submissions WHERE order_id = ? AND payment_id = ?)`,
        params: [timestamp, submission.order_id, submission.order_id, paymentId],
      },
    ])
  } catch (error) { concurrencyError(error) }
  const check = await getTransferSubmission(submission.id)
  if (check?.payment_id !== paymentId) throw new Error('Pembayaran ini baru saja diproses petugas lain. Muat ulang antrian.')
  return result
}

async function closeWithoutPayment(actor: ReviewActor, input: { submissionId: string; reason: string }, kind: 'REJECT' | 'FIX') {
  const reason = cleanText(input.reason, 300)
  if (reason.length < 5) throw new Error('Alasan wajib diisi agar wali tahu yang harus diperbaiki.')
  const allowed: TransferSubmissionStatus[] = kind === 'REJECT' ? ['MENUNGGU_VERIFIKASI', 'PERLU_PERBAIKAN'] : ['MENUNGGU_VERIFIKASI']
  const submission = await loadReviewable(actor, input.submissionId, allowed)
  const timestamp = now()
  const toStatus = kind === 'REJECT' ? 'DITOLAK' : 'PERLU_PERBAIKAN'
  const statements = [
    {
      sql: `UPDATE finance_transfer_submissions SET status = ?, reviewed_by = ?, reviewed_at = ?, review_notes = ?, updated_at = ?
            WHERE id = ? AND status = ?`,
      params: [toStatus, actor.session.id, timestamp, reason, timestamp, submission.id, submission.status] as unknown[],
    },
    {
      sql: `INSERT INTO finance_transfer_submission_events (id, submission_id, action, from_status, to_status, actor_kind, actor_id, notes, created_at)
            SELECT ?, ?, ?, ?, ?, 'STAFF', ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM finance_transfer_submissions WHERE id = ? AND status = ? AND reviewed_at = ?)`,
      params: [generateId(), submission.id, kind === 'REJECT' ? 'REJECTED' : 'FIX_REQUESTED', submission.status, toStatus,
        actor.session.id, reason, timestamp, submission.id, toStatus, timestamp] as unknown[],
    },
  ]
  if (kind === 'REJECT') {
    statements.push({
      sql: `UPDATE finance_payment_orders SET status = 'CANCELLED', updated_at = ?
            WHERE id = ? AND status = 'PENDING' AND EXISTS (SELECT 1 FROM finance_transfer_submissions WHERE order_id = ? AND status = 'DITOLAK')`,
      params: [timestamp, submission.order_id, submission.order_id],
    })
  }
  try { await batch(statements) } catch (error) { concurrencyError(error) }
  const check = await getTransferSubmission(submission.id)
  if (check?.status !== toStatus || check.reviewed_at !== timestamp) throw new Error('Status pembayaran baru saja berubah. Muat ulang antrian.')
}

export const rejectTransferSubmission = (actor: ReviewActor, input: { submissionId: string; reason: string }) => closeWithoutPayment(actor, input, 'REJECT')
export const requestTransferProofFix = (actor: ReviewActor, input: { submissionId: string; reason: string }) => closeWithoutPayment(actor, input, 'FIX')

export async function countPendingTransfersForScope(scope: VerifierScope): Promise<number> {
  if (!scope.all && !scope.asrama.length) return 0
  const params: unknown[] = []
  let clause = ''
  if (!scope.all) {
    clause = ` AND UPPER(TRIM(COALESCE(st.asrama, ''))) IN (${scope.asrama.map(() => '?').join(',')})`
    params.push(...scope.asrama.map(a => a.trim().toUpperCase()))
  }
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM finance_transfer_submissions s JOIN santri st ON st.id = s.santri_id
     WHERE s.status = 'MENUNGGU_VERIFIKASI'${clause}`, params)
  return row?.n ?? 0
}
