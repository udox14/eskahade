// lib/finance/va.ts
// Modul manajemen Fixed Virtual Account permanen santri (Fase 3A)

import { query, queryOne, execute, now } from '@/lib/db'
import { assertSantriBillable } from '@/lib/finance/non-billable-santri'
import type { FinanceStudentVa } from '@/lib/finance/types'

/**
 * Mengambil Fixed VA santri berdasarkan santri_id.
 */
export async function getStudentFixedVa(santriId: string): Promise<FinanceStudentVa | null> {
  return queryOne<FinanceStudentVa>(
    `SELECT santri_id, va_number, bank_code, created_at
     FROM finance_student_va
     WHERE santri_id = ?`,
    [santriId]
  )
}

/**
 * Mencari data Fixed VA berdasarkan nomor VA.
 */
export async function findStudentByFixedVa(vaNumber: string): Promise<FinanceStudentVa | null> {
  const trimmed = vaNumber.trim()
  return queryOne<FinanceStudentVa>(
    `SELECT santri_id, va_number, bank_code, created_at
     FROM finance_student_va
     WHERE va_number = ?`,
    [trimmed]
  )
}

/**
 * Mendaftarkan atau memperbarui Fixed VA santri secara atomik.
 * Menegakkan validasi:
 * 1. Santri harus terdaftar di master santri.
 * 2. Nomor VA unik global (tidak boleh dipakai santri lain).
 */
export async function assignStudentFixedVa(
  santriId: string,
  vaNumber: string,
  bankCode: string
): Promise<FinanceStudentVa> {
  const cleanVa = vaNumber.trim()
  const cleanBank = bankCode.trim().toUpperCase()

  if (!cleanVa) {
    throw new Error('Nomor Virtual Account tidak boleh kosong.')
  }
  if (!cleanBank) {
    throw new Error('Kode bank tidak boleh kosong.')
  }

  // Validasi santri terdaftar
  const student = await queryOne<{ id: string; status_global: string; asrama: string | null; nama_lengkap: string; kategori_santri: string | null }>(
    `SELECT id, status_global, asrama, nama_lengkap, kategori_santri FROM santri WHERE id = ?`,
    [santriId]
  )
  if (!student) {
    throw new Error(`Santri dengan ID "${santriId}" tidak ditemukan.`)
  }
  assertSantriBillable(student.asrama, student.nama_lengkap, student.kategori_santri)

  // Periksa apakah nomor VA sudah dipakai oleh santri lain
  const existingVa = await findStudentByFixedVa(cleanVa)
  if (existingVa && existingVa.santri_id !== santriId) {
    throw new Error(
      `Nomor Virtual Account "${cleanVa}" sudah terdaftar untuk santri lain.`
    )
  }

  const timestamp = now()

  await execute(
    `INSERT INTO finance_student_va (santri_id, va_number, bank_code, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(santri_id) DO UPDATE SET
       va_number = excluded.va_number,
       bank_code = excluded.bank_code`,
    [santriId, cleanVa, cleanBank, timestamp]
  )

  const saved = await getStudentFixedVa(santriId)
  if (!saved) {
    throw new Error('Gagal mengambil data Fixed VA setelah penyimpanan.')
  }
  return saved
}

/**
 * Mengambil daftar seluruh Fixed VA yang terdaftar.
 */
export async function listStudentFixedVa(filter?: {
  bankCode?: string
}): Promise<FinanceStudentVa[]> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter?.bankCode) {
    conditions.push('bank_code = ?')
    params.push(filter.bankCode.trim().toUpperCase())
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return query<FinanceStudentVa>(
    `SELECT santri_id, va_number, bank_code, created_at
     FROM finance_student_va
     ${whereClause}
     ORDER BY created_at DESC`,
    params
  )
}
