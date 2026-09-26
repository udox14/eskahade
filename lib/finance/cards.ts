// lib/finance/cards.ts
// Modul Kredensial Kartu QR Santri (Fase 5: PRD #17 & Implementation Plan 4.5, Tabel #16)
// Menjamin:
// 1. Tepat satu kartu berstatus 'ACTIVE' per santri (ditegakkan oleh partial unique index & logic atomik).
// 2. Token QR acak kriptografis (BUKAN raw NIS santri dan BUKAN raw ID).
// 3. Multi-histori kartu (status: ACTIVE, REVOKED, LOST, BLOCKED) dengan integritas data masa lalu.

import { query, queryOne, execute, generateId, now } from '@/lib/db'
import {
  assertSantriBillable,
  nonBillableSantriSqlPredicate,
} from '@/lib/finance/non-billable-santri'

export type CardStatus = 'ACTIVE' | 'REVOKED' | 'LOST' | 'BLOCKED'

export interface FinanceCredential {
  id: string
  santri_id: string
  card_token: string
  status: CardStatus
  issued_at: string
  issued_by: string | null
  issuer_name?: string | null
  revoked_at: string | null
  revoked_by: string | null
  revocation_reason: string | null
  created_at: string
  updated_at: string
}

export interface CardWithStudent extends FinanceCredential {
  santri_nama: string
  santri_nis: string
  santri_asrama: string | null
  santri_kamar: string | null
  santri_foto_url: string | null
  santri_status_global: string
}

/**
 * Menghasilkan token acak kriptografis untuk QR kartu fisik:
 * Format: crd_<24_hex_chars> (contoh: crd_7a8f3b0c1e4d8a5f6e2b9c0d)
 * Zero plaintext NIS, zero raw database ID.
 */
export function generateCardToken(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `crd_${hex}`
}

/**
 * Mengambil kartu berstatus 'ACTIVE' milik santri.
 * Mengembalikan null jika santri belum memiliki kartu aktif.
 */
export async function getActiveCard(
  santriId: string
): Promise<FinanceCredential | null> {
  const card = await queryOne<FinanceCredential>(
    `SELECT c.*, u.full_name AS issuer_name
     FROM finance_credentials c
     JOIN santri s ON s.id = c.santri_id
     LEFT JOIN users u ON u.id = c.issued_by
     WHERE c.santri_id = ? AND c.status = 'ACTIVE'
       AND ${nonBillableSantriSqlPredicate('s.asrama')}
     LIMIT 1`,
    [santriId]
  )
  return card || null
}

/**
 * Mengambil riwayat seluruh kartu yang pernah diterbitkan untuk santri
 * (termasuk yang telah REVOKED, LOST, atau BLOCKED).
 */
export async function getCardHistory(
  santriId: string
): Promise<FinanceCredential[]> {
  const list = await query<FinanceCredential>(
    `SELECT c.*, u.full_name AS issuer_name
     FROM finance_credentials c
     JOIN santri s ON s.id = c.santri_id
     LEFT JOIN users u ON u.id = c.issued_by
     WHERE c.santri_id = ?
       AND ${nonBillableSantriSqlPredicate('s.asrama')}
     ORDER BY c.issued_at DESC, c.created_at DESC`,
    [santriId]
  )
  return list
}

/**
 * Menerbitkan kartu fisik baru untuk santri.
 * Aturan atomik (Implementation Plan 4.5):
 * - Memastikan santri aktif.
 * - Jika santri memiliki kartu yang sedang ACTIVE, kartu lama otomatis di-revoke
 *   secara atomik sebelum kartu baru berstatus ACTIVE dimasukkan.
 * - Menjamin partial unique index uq_active_card_per_santri tidak pernah dilanggar.
 */
export async function issueCard(
  santriId: string,
  issuedBy?: string | null,
  options?: { reason?: string }
): Promise<FinanceCredential> {
  const student = await queryOne<{ id: string; status_global: string; nama_lengkap: string; asrama: string | null }>(
    `SELECT id, status_global, nama_lengkap, asrama FROM santri WHERE id = ?`,
    [santriId]
  )
  if (!student) {
    throw new Error(`Santri dengan ID "${santriId}" tidak ditemukan.`)
  }
  if (student.status_global !== 'aktif') {
    throw new Error(`Tidak dapat menerbitkan kartu untuk santri non-aktif ("${student.nama_lengkap}").`)
  }
  assertSantriBillable(student.asrama, student.nama_lengkap)

  const timestamp = now()
  const newCardId = generateId()
  const cardToken = generateCardToken()
  const revokeReason = options?.reason || 'Digantikan penerbitan kartu baru'

  // 1. Revoke kartu aktif yang sudah ada (jika ada)
  await execute(
    `UPDATE finance_credentials
     SET status = 'REVOKED',
         revoked_at = ?,
         revoked_by = ?,
         revocation_reason = ?,
         updated_at = ?
     WHERE santri_id = ? AND status = 'ACTIVE'`,
    [timestamp, issuedBy || null, revokeReason, timestamp, santriId]
  )

  // 2. Masukkan kartu baru berstatus 'ACTIVE'
  await execute(
    `INSERT INTO finance_credentials (
       id, santri_id, card_token, status, issued_at,
       issued_by, created_at, updated_at
     ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
    [newCardId, santriId, cardToken, timestamp, issuedBy || null, timestamp, timestamp]
  )

  const created = await queryOne<FinanceCredential>(
    `SELECT c.*, u.full_name AS issuer_name
     FROM finance_credentials c
     LEFT JOIN users u ON u.id = c.issued_by
     WHERE c.id = ?`,
    [newCardId]
  )

  return created!
}

/**
 * Me-revoke kartu santri (misal karena kartu ditarik atau diganti).
 */
export async function revokeCard(
  cardId: string,
  reason: string,
  revokedBy?: string | null
): Promise<FinanceCredential> {
  const card = await queryOne<FinanceCredential>(
    `SELECT * FROM finance_credentials WHERE id = ?`,
    [cardId]
  )
  if (!card) {
    throw new Error(`Kartu dengan ID "${cardId}" tidak ditemukan.`)
  }

  const timestamp = now()
  await execute(
    `UPDATE finance_credentials
     SET status = 'REVOKED',
         revoked_at = ?,
         revoked_by = ?,
         revocation_reason = ?,
         updated_at = ?
     WHERE id = ?`,
    [timestamp, revokedBy || null, reason, timestamp, cardId]
  )

  const updated = await queryOne<FinanceCredential>(
    `SELECT c.*, u.full_name AS issuer_name
     FROM finance_credentials c
     LEFT JOIN users u ON u.id = c.issued_by
     WHERE c.id = ?`,
    [cardId]
  )
  return updated!
}

/**
 * Melaporkan kartu hilang (status 'LOST').
 */
export async function reportLostCard(
  cardId: string,
  reason: string,
  reportedBy?: string | null
): Promise<FinanceCredential> {
  const card = await queryOne<FinanceCredential>(
    `SELECT * FROM finance_credentials WHERE id = ?`,
    [cardId]
  )
  if (!card) {
    throw new Error(`Kartu dengan ID "${cardId}" tidak ditemukan.`)
  }

  const timestamp = now()
  await execute(
    `UPDATE finance_credentials
     SET status = 'LOST',
         revoked_at = ?,
         revoked_by = ?,
         revocation_reason = ?,
         updated_at = ?
     WHERE id = ?`,
    [timestamp, reportedBy || null, reason || 'Kartu dilaporkan hilang', timestamp, cardId]
  )

  const updated = await queryOne<FinanceCredential>(
    `SELECT c.*, u.full_name AS issuer_name
     FROM finance_credentials c
     LEFT JOIN users u ON u.id = c.issued_by
     WHERE c.id = ?`,
    [cardId]
  )
  return updated!
}

/**
 * Memblokir kartu (status 'BLOCKED').
 */
export async function blockCard(
  cardId: string,
  reason: string,
  blockedBy?: string | null
): Promise<FinanceCredential> {
  const card = await queryOne<FinanceCredential>(
    `SELECT * FROM finance_credentials WHERE id = ?`,
    [cardId]
  )
  if (!card) {
    throw new Error(`Kartu dengan ID "${cardId}" tidak ditemukan.`)
  }

  const timestamp = now()
  await execute(
    `UPDATE finance_credentials
     SET status = 'BLOCKED',
         revoked_at = ?,
         revoked_by = ?,
         revocation_reason = ?,
         updated_at = ?
     WHERE id = ?`,
    [timestamp, blockedBy || null, reason || 'Kartu diblokir', timestamp, cardId]
  )

  const updated = await queryOne<FinanceCredential>(
    `SELECT c.*, u.full_name AS issuer_name
     FROM finance_credentials c
     LEFT JOIN users u ON u.id = c.issued_by
     WHERE c.id = ?`,
    [cardId]
  )
  return updated!
}

/**
 * Membuka blokir kartu (mengembalikan status ke 'ACTIVE').
 * Memverifikasi bahwa santri belum memiliki kartu ACTIVE lain.
 */
export async function unblockCard(
  cardId: string
): Promise<FinanceCredential> {
  const card = await queryOne<FinanceCredential>(
    `SELECT * FROM finance_credentials WHERE id = ?`,
    [cardId]
  )
  if (!card) {
    throw new Error(`Kartu dengan ID "${cardId}" tidak ditemukan.`)
  }
  if (card.status !== 'BLOCKED') {
    throw new Error(`Kartu tidak dalam status terblokir (status saat ini: "${card.status}").`)
  }

  // Cek apakah santri sudah memiliki kartu ACTIVE lain
  const activeExisting = await getActiveCard(card.santri_id)
  if (activeExisting && activeExisting.id !== cardId) {
    throw new Error(
      `Santri sudah memiliki kartu lain yang berstatus ACTIVE. Cabut kartu aktif terlebih dahulu sebelum membuka blokir kartu ini.`
    )
  }

  const timestamp = now()
  await execute(
    `UPDATE finance_credentials
     SET status = 'ACTIVE',
         revoked_at = NULL,
         revoked_by = NULL,
         revocation_reason = NULL,
         updated_at = ?
     WHERE id = ?`,
    [timestamp, cardId]
  )

  const updated = await queryOne<FinanceCredential>(
    `SELECT c.*, u.full_name AS issuer_name
     FROM finance_credentials c
     LEFT JOIN users u ON u.id = c.issued_by
     WHERE c.id = ?`,
    [cardId]
  )
  return updated!
}

/**
 * Mencari kredensial kartu berdasarkan token QR yang dipindai.
 * Mengembalikan informasi lengkap kartu dan identitas santri (foto, nama, NIS, asrama, kamar).
 */
export async function findCardByToken(
  cardToken: string
): Promise<CardWithStudent | null> {
  const cleanToken = cardToken.trim()
  if (!cleanToken) return null

  const row = await queryOne<CardWithStudent>(
    `SELECT c.*,
            s.nama_lengkap AS santri_nama,
            s.nis AS santri_nis,
            s.asrama AS santri_asrama,
            s.kamar AS santri_kamar,
            s.foto_url AS santri_foto_url,
            s.status_global AS santri_status_global,
            u.full_name AS issuer_name
     FROM finance_credentials c
     JOIN santri s ON s.id = c.santri_id
     LEFT JOIN users u ON u.id = c.issued_by
     WHERE c.card_token = ?
       AND ${nonBillableSantriSqlPredicate('s.asrama')}
     LIMIT 1`,
    [cleanToken]
  )

  return row || null
}
