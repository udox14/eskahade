// Pembangun notifikasi untuk event Sistem Keuangan (NOTIF-4).
//
// Aturan pemasangan di modul keuangan:
// 1. Statement dari sini DISISIPKAN ke batch D1 yang sama dengan financial write.
// 2. Setiap statement dijaga EXISTS pada baris yang dibuat batch itu (audit event / payment /
//    item) → notifikasi ada jika dan hanya jika kejadian finansialnya ada.
// 3. Dibungkus safeNotices(): skema belum siap atau error pembangunan payload → [] dan dicatat;
//    TIDAK PERNAH menggagalkan transaksi uang.
// 4. Nominal = integer Rupiah dari server (tidak pernah dari klien).

import { notifyStatement } from './outbox'
import type { NotifStore, SqlStatement } from './types'

type ReadyStore = Pick<NotifStore, 'queryOne'>

let schemaReady = false
let lastNegativeCheck = 0
const NEGATIVE_RECHECK_MS = 60_000

/** Tabel outbox tersedia? Hasil positif di-cache per isolate; negatif dicek ulang tiap menit. */
export async function notificationSchemaReady(store: ReadyStore): Promise<boolean> {
  if (schemaReady) return true
  if (Date.now() - lastNegativeCheck < NEGATIVE_RECHECK_MS) return false
  try {
    const row = await store.queryOne<{ ok: number }>(
      "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'notif_outbox'")
    schemaReady = !!row
  } catch {
    schemaReady = false
  }
  if (!schemaReady) lastNegativeCheck = Date.now()
  return schemaReady
}

/** Hanya untuk test. */
export function resetNotificationSchemaCache() {
  schemaReady = false
  lastNegativeCheck = 0
}

export async function safeNotices(store: ReadyStore, build: () => SqlStatement[]): Promise<SqlStatement[]> {
  try {
    if (!(await notificationSchemaReady(store))) return []
    return build()
  } catch (error) {
    console.error(JSON.stringify({
      event: 'notif_build_failed',
      message: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
    }))
    return []
  }
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** "2026-12" → "Desember 2026"; "2026/2027" dibiarkan. */
export function periodLabel(period: string | null | undefined): string {
  const m = String(period ?? '').match(/^(\d{4})-(\d{2})$/)
  if (!m) return String(period ?? '')
  return `${BULAN[Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

// ── Transfer manual ─────────────────────────────────────────────────────

export interface TransferNoticeSubject {
  id: string
  santri_id: string
  santri_nama: string
  asrama: string | null
  submission_number: string
  expected_amount: number
}

const eventGuard = (eventId: string) => ({
  sql: 'SELECT 1 FROM finance_transfer_submission_events WHERE id = ?',
  params: [eventId],
})

export function transferProofUploadedNotices(sub: TransferNoticeSubject, proofHash: string, eventId: string): SqlStatement[] {
  return [notifyStatement('STAFF_TRANSFER_MENUNGGU_VERIFIKASI', `TRF_PROOF:${sub.id}:${proofHash.slice(0, 16)}`, {
    santri_id: sub.santri_id, nama_santri: sub.santri_nama, asrama: sub.asrama ?? '-',
    nomor: sub.submission_number, nominal: sub.expected_amount,
  }, eventGuard(eventId))]
}

export function transferApprovedNotices(sub: TransferNoticeSubject, receivedAmount: number, eventId: string): SqlStatement[] {
  return [notifyStatement('PORTAL_TRANSFER_DITERIMA', `TRF_APPROVED:${sub.id}`, {
    santri_id: sub.santri_id, nama_santri: sub.santri_nama, nomor: sub.submission_number, nominal: receivedAmount,
  }, eventGuard(eventId))]
}

export function transferUnallocatedNotices(sub: TransferNoticeSubject, receivedAmount: number, eventId: string): SqlStatement[] {
  return [notifyStatement('PORTAL_TRANSFER_BELUM_TERALOKASI', `TRF_UNALLOCATED:${sub.id}`, {
    santri_id: sub.santri_id, nama_santri: sub.santri_nama, nomor: sub.submission_number, nominal: receivedAmount,
  }, eventGuard(eventId))]
}

export function transferClosedNotices(sub: TransferNoticeSubject, kind: 'REJECT' | 'FIX', reason: string, eventId: string): SqlStatement[] {
  const code = kind === 'REJECT' ? 'PORTAL_TRANSFER_DITOLAK' : 'PORTAL_TRANSFER_PERLU_PERBAIKAN'
  // Perbaikan bisa diminta berkali-kali: dedupe per event audit.
  return [notifyStatement(code, `TRF_${kind}:${sub.id}:${eventId}`, {
    santri_id: sub.santri_id, nama_santri: sub.santri_nama, nomor: sub.submission_number, alasan: reason,
  }, eventGuard(eventId))]
}

/**
 * Kedaluwarsa set-based: HARUS diletakkan sebelum UPDATE status di batch yang sama, karena
 * memilih submission yang masih MENUNGGU_BUKTI pada order yang lewat batas waktu.
 */
export function transferExpiredNotices(staleOrdersSql: string, staleParams: unknown[]): SqlStatement[] {
  return [{
    sql: `INSERT OR IGNORE INTO notif_outbox (id, event_code, dedupe_key, payload_json)
          SELECT lower(hex(randomblob(16))), 'PORTAL_TRANSFER_KEDALUWARSA', 'TRF_EXPIRED:' || s.id,
                 json_object('santri_id', s.santri_id, 'nama_santri', st.nama_lengkap, 'nomor', s.submission_number)
          FROM finance_transfer_submissions s JOIN santri st ON st.id = s.santri_id
          WHERE s.status = 'MENUNGGU_BUKTI' AND s.order_id IN (${staleOrdersSql})`,
    params: staleParams,
  }]
}

// ── Pembayaran ─────────────────────────────────────────────────────────

export interface PaymentNoticeInput {
  paymentId: string
  santriId: string
  namaSantri: string
  /** Total yang dibayar wali (termasuk biaya admin), integer Rupiah. */
  nominal: number
  metode: string
  waktu: string
  /** Seluruh pembayaran hanya untuk uang jajan → kirim "Uang Jajan Masuk", bukan "Pembayaran Diterima". */
  walletOnly: boolean
  saldoSetelah?: number | null
}

/** Satu notifikasi per pembayaran, dijaga keberadaan baris finance_payments. */
export function paymentReceivedNotices(input: PaymentNoticeInput): SqlStatement[] {
  const guard = { sql: 'SELECT 1 FROM finance_payments WHERE id = ?', params: [input.paymentId] }
  if (input.walletOnly) {
    return [notifyStatement('PORTAL_UANG_JAJAN_MASUK', `PAY:${input.paymentId}`, {
      santri_id: input.santriId, nama_santri: input.namaSantri, nominal: input.nominal,
      saldo: input.saldoSetelah ?? null,
    }, guard)]
  }
  return [notifyStatement('PORTAL_PEMBAYARAN_DITERIMA', `PAY:${input.paymentId}`, {
    santri_id: input.santriId, nama_santri: input.namaSantri, nominal: input.nominal,
    metode: input.metode, waktu: input.waktu,
  }, guard)]
}

/** Setoran uang jajan tunai tanpa pembayaran tagihan (tidak ada baris finance_payments). */
export function cashTopupNotices(input: { ledgerId: string; santriId: string; namaSantri: string; nominal: number; saldoSetelah: number | null }): SqlStatement[] {
  return [notifyStatement('PORTAL_UANG_JAJAN_MASUK', `TOPUP:${input.ledgerId}`, {
    santri_id: input.santriId, nama_santri: input.namaSantri, nominal: input.nominal, saldo: input.saldoSetelah,
  }, { sql: 'SELECT 1 FROM finance_wallet_ledger WHERE id = ?', params: [input.ledgerId] })]
}

// ── Pencairan kolektif ────────────────────────────────────────────────

const payoutItemGuard = (itemId: string, status: string, updatedAt: string) => ({
  sql: 'SELECT 1 FROM finance_wallet_payout_items WHERE id = ? AND status = ? AND updated_at = ?',
  params: [itemId, status, updatedAt],
})

export function payoutTakenNotices(item: { itemId: string; santriId: string; namaSantri: string; amount: number; updatedAt: string }, representative: string): SqlStatement[] {
  return [notifyStatement('PORTAL_PENCAIRAN_DIBAWA', `PAYOUT_TAKEN:${item.itemId}`, {
    santri_id: item.santriId, nama_santri: item.namaSantri, nominal: item.amount, perwakilan: representative,
  }, payoutItemGuard(item.itemId, 'DIBAWA', item.updatedAt))]
}

export function payoutSettledNotices(item: { itemId: string; santriId: string; namaSantri: string; amount: number }, outcome: 'DITERIMA' | 'DIBATALKAN', updatedAt: string, reason?: string): SqlStatement[] {
  const code = outcome === 'DITERIMA' ? 'PORTAL_PENCAIRAN_DITERIMA' : 'PORTAL_PENCAIRAN_DIBATALKAN'
  return [notifyStatement(code, `PAYOUT_${outcome}:${item.itemId}`, {
    santri_id: item.santriId, nama_santri: item.namaSantri, nominal: item.amount, alasan: reason ?? null,
  }, payoutItemGuard(item.itemId, outcome, updatedAt))]
}

// ── Kas & tagihan ──────────────────────────────────────────────────────

export function cashDifferenceNotices(session: { id: string; operatorId: string; operatorName: string; difference: number; closedAt: string }): SqlStatement[] {
  if (session.difference === 0) return []
  return [notifyStatement('STAFF_SELISIH_KAS', `CASH_DIFF:${session.id}`, {
    petugas: session.operatorName, selisih: session.difference, actor_user_id: session.operatorId,
  }, { sql: "SELECT 1 FROM finance_cash_sessions WHERE id = ? AND status = 'CLOSED' AND closed_at = ?", params: [session.id, session.closedAt] })]
}

export function billIssuedNotices(input: { santriId: string; namaSantri: string; businessDate: string; periods: string[]; count: number; total: number }): SqlStatement[] {
  if (input.count <= 0) return []
  const periods = [...new Set(input.periods)].sort()
  return [notifyStatement('PORTAL_TAGIHAN_TERBIT', `BILL:${input.santriId}:${input.businessDate}`, {
    santri_id: input.santriId, nama_santri: input.namaSantri, jumlah: input.count, total: input.total,
    periode: periods.map(periodLabel).join(', ') || '-',
  })]
}
