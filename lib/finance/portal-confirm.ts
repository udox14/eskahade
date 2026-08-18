// lib/finance/portal-confirm.ts
//
// Konfirmasi pengajuan pembayaran Portal Ortu (bukti transfer/QRIS) — seluruhnya
// lewat Keuangan Terpusat. Uang yang dikonfirmasi petugas dicatat sebagai
// penerimaan manual ke saldo Titipan wali (pola sama dengan callback Duitku di
// processDuitkuCallback, hanya sumbernya offline), lalu langsung dialokasikan
// penuh ke tagihan terkait lewat allocateStudentFunds — pola yang identik
// dengan tombol "Lunasi seluruh SPP/Non-SPP" di tab Saldo portal.
//
// Tidak ada baris yang ditulis ke spp_log atau pembayaran_tahunan di sini.

import { execute, query, queryOne, financeQuery, financeQueryOne, getFinanceDB as getDB } from '@/lib/db'
import { prepareJournalStatements, prepareWalletStatements } from './ledger'
import { financeError } from './errors'
import { duplicateOf } from './idempotency'
import { allocateStudentFunds } from './wallet'
import { isAsramaTanpaKamar } from '@/lib/asrama'
import type { PortalBillDetailItem } from '@/app/portal-ortu/(app)/keuangan/tagihan-actions'
import { topupManual } from './postings'

export type PortalSubmissionRow = {
  id: string
  santri_id: string
  nama_lengkap: string
  nis: string | null
  asrama: string | null
  kamar: string | null
  kategori_santri: string | null
  bebas_spp: number | null
  detail_json: string
  jumlah: number
  metode: string
  bank_tujuan: string | null
  bukti_url: string | null
  status: string
  catatan_ortu: string | null
  reject_reason: string | null
  confirmed_at: string | null
  confirmed_by_nama: string | null
  rejected_at: string | null
  created_at: string
  updated_at: string
}

export async function listPortalSubmissions(
  kategori: 'SPP' | 'NON_SPP',
  statusFilter: string,
  scopeWhere: string,
  scopeParams: unknown[],
): Promise<PortalSubmissionRow[]> {
  const params: unknown[] = [kategori, ...scopeParams]
  let statusWhere = ''
  if (statusFilter && statusFilter !== 'SEMUA') {
    statusWhere = 'AND ps.status = ?'
    params.push(statusFilter)
  }
  return query<PortalSubmissionRow>(`
    SELECT ps.id, ps.santri_id, ps.detail_json, ps.jumlah, ps.metode, ps.bank_tujuan,
           ps.bukti_url, ps.status, ps.catatan_ortu, ps.reject_reason,
           ps.confirmed_at, ps.rejected_at, ps.created_at, ps.updated_at,
           s.nama_lengkap, s.nis, s.asrama, s.kamar, s.kategori_santri,
           u.full_name AS confirmed_by_nama
    FROM portal_payment_submission ps
    JOIN santri s ON s.id = ps.santri_id
    LEFT JOIN users u ON u.id = ps.confirmed_by
    WHERE ps.kategori = ? ${scopeWhere} ${statusWhere}
    ORDER BY CASE ps.status WHEN 'menunggu_konfirmasi' THEN 0 ELSE 1 END, datetime(ps.created_at) DESC
    LIMIT 200
  `, params)
}

async function loadSubmission(submissionId: string, kategori: 'SPP' | 'NON_SPP') {
  const row = await queryOne<PortalSubmissionRow>(`
    SELECT ps.*, s.nama_lengkap, s.nis, s.asrama, s.kamar, s.kategori_santri, COALESCE(s.bebas_spp, 0) AS bebas_spp
    FROM portal_payment_submission ps
    JOIN santri s ON s.id = ps.santri_id
    WHERE ps.id = ? AND ps.kategori = ?
  `, [submissionId, kategori])
  if (!row) throw new Error('Pengajuan tidak ditemukan.')
  return row
}

function parseDetail(detailJson: string): PortalBillDetailItem[] {
  const parsed = JSON.parse(detailJson)
  if (!Array.isArray(parsed)) throw new Error('Detail pengajuan rusak.')
  return parsed
}

async function recordManualReceipt(input: {
  submissionId: string
  santriId: string
  amountRupiah: number
  metode: string
  actorId: string
}) {
  const idempotencyKey = `portal-manual-receipt:${input.submissionId}`
  try {
    const db = await getDB()
    const journal = prepareJournalStatements(db, {
      idempotencyKey,
      description: `Terima ${input.metode === 'QRIS' ? 'QRIS' : 'transfer'} portal ortu`,
      sourceType: 'PORTAL_MANUAL_RECEIPT',
      sourceId: input.submissionId,
      actorType: 'STAFF',
      actorId: input.actorId,
      ...topupManual({ santriId: input.santriId, nominalRupiah: input.amountRupiah }),
    })
    await db.batch([
      ...journal.statements,
      ...prepareWalletStatements(db, journal.journalId, [{
        idempotencyKey: `${idempotencyKey}:topup`,
        santriId: input.santriId,
        walletKind: 'TITIPAN',
        amountRupiah: input.amountRupiah,
        movementType: 'TOPUP',
        referenceType: 'PORTAL_SUBMISSION',
        referenceId: input.submissionId,
      }]),
      db.prepare(`UPDATE finance_journals SET status='POSTED',posted_at=datetime('now') WHERE id=? AND status='DRAFT'`).bind(journal.journalId),
    ])
    return { success: true as const, journalId: journal.journalId }
  } catch (error) {
    const existing = await duplicateOf(error, () =>
      financeQueryOne<{ id: string }>(`SELECT id FROM finance_journals WHERE idempotency_key=?`, [idempotencyKey]))
    if (existing) return { success: true as const, journalId: existing.id, duplicate: true }
    return { success: false as const, ...financeError(error) }
  }
}

export async function approvePortalSubmission(input: {
  submissionId: string
  kategori: 'SPP' | 'NON_SPP'
  actorId: string
  assertAccess: (row: PortalSubmissionRow) => void
}): Promise<{ success: true; submission: PortalSubmissionRow } | { success: false; error: string }> {
  try {
    const submission = await loadSubmission(input.submissionId, input.kategori)
    input.assertAccess(submission)
    if (submission.status !== 'menunggu_konfirmasi') return { success: false, error: 'Pengajuan ini sudah diproses.' }
    if (!submission.bukti_url) return { success: false, error: 'Ortu belum mengunggah bukti pembayaran.' }
    // Status santri bisa berubah sejak pengajuan dibuat (mis. dibebaskan SPP
    // atau pindah ke asrama tanpa kamar setelahnya) — jangan lanjut konfirmasi.
    if (input.kategori === 'SPP' && (Number(submission.bebas_spp) === 1 || isAsramaTanpaKamar(submission.asrama))) {
      return { success: false, error: 'Santri ini kini tidak memiliki kewajiban SPP. Tolak pengajuan ini agar ortu mengajukan ulang.' }
    }

    const detail = parseDetail(submission.detail_json)
    if (!detail.length) return { success: false, error: 'Detail pengajuan kosong.' }

    // Re-validasi live terhadap finance_bills — bisa saja berubah sejak
    // pengajuan dibuat (dilunasi lewat jalur lain, atau tarif berubah).
    const ids = detail.map(item => item.billId)
    const placeholders = ids.map(() => '?').join(',')
    const liveBills = await financeQuery<{ id: string; status: string; amount_rupiah: number; paid_rupiah: number }>(
      `SELECT id,status,amount_rupiah,paid_rupiah FROM finance_bills WHERE id IN (${placeholders}) AND santri_id=? AND bill_kind=?`,
      [...ids, submission.santri_id, input.kategori],
    )
    const liveById = new Map(liveBills.map(b => [b.id, b]))
    const conflicts: string[] = []
    for (const item of detail) {
      const live = liveById.get(item.billId)
      if (!live || live.status !== 'OPEN' || Number(live.amount_rupiah) - Number(live.paid_rupiah) !== item.amountRupiah) {
        conflicts.push(`${item.title} (tagihan berubah atau sudah tidak terbuka)`)
      }
    }
    if (conflicts.length > 0) {
      return { success: false, error: `Tidak bisa dikonfirmasi: ${conflicts.join(', ')}. Tolak pengajuan ini agar ortu mengajukan ulang dengan tagihan terbaru.` }
    }

    const receipt = await recordManualReceipt({
      submissionId: submission.id,
      santriId: submission.santri_id,
      amountRupiah: submission.jumlah,
      metode: submission.metode,
      actorId: input.actorId,
    })
    if (!receipt.success) return { success: false, error: receipt.error }

    const allocation = await allocateStudentFunds({
      idempotencyKey: `portal-confirm:${submission.id}`,
      santriId: submission.santri_id,
      destination: input.kategori,
      amountRupiah: submission.jumlah,
      fullOutstandingRupiah: submission.jumlah,
      billingReference: `PORTAL:${submission.id}`,
      billItems: detail.map(item => ({ billId: item.billId, amountRupiah: item.amountRupiah })),
      actorType: 'STAFF',
      actorId: input.actorId,
    })
    if (!allocation.success) return { success: false, error: allocation.error }

    await execute(`
      UPDATE portal_payment_submission
      SET status = 'terkonfirmasi', confirmed_by = ?, confirmed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND status = 'menunggu_konfirmasi'
    `, [input.actorId, submission.id])

    return { success: true, submission }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Gagal mengonfirmasi pengajuan.' }
  }
}

export async function rejectPortalSubmission(input: {
  submissionId: string
  kategori: 'SPP' | 'NON_SPP'
  actorId: string
  reason: string
  assertAccess: (row: PortalSubmissionRow) => void
}): Promise<{ success: true; submission: PortalSubmissionRow } | { success: false; error: string }> {
  try {
    const submission = await loadSubmission(input.submissionId, input.kategori)
    input.assertAccess(submission)
    const alasan = String(input.reason || '').trim()
    if (alasan.length < 5) return { success: false, error: 'Alasan penolakan minimal 5 karakter.' }
    if (submission.status !== 'menunggu_konfirmasi') return { success: false, error: 'Pengajuan ini sudah diproses.' }

    await execute(`
      UPDATE portal_payment_submission
      SET status = 'ditolak', rejected_by = ?, rejected_at = datetime('now'),
          reject_reason = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'menunggu_konfirmasi'
    `, [input.actorId, alasan, submission.id])

    return { success: true, submission }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Gagal menolak pengajuan.' }
  }
}
