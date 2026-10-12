// lib/finance/va.ts
// Modul manajemen Fixed Virtual Account permanen santri (Fase BRI-1)
// Mendukung 1 Fixed BRIVA permanen per santri billable, dengan customer_no dan status aktif/inaktif.
// partnerServiceId adalah konfigurasi institusi di level sistem/app_settings, bukan per santri.

import { query, queryOne, execute, now } from '@/lib/db'
import { assertSantriBillable } from '@/lib/finance/non-billable-santri'
import type { FinanceStudentVa } from '@/lib/finance/payment-types'

/**
 * Mengambil Fixed BRIVA santri berdasarkan santri_id.
 */
export async function getStudentFixedVa(santriId: string): Promise<FinanceStudentVa | null> {
  return queryOne<FinanceStudentVa>(
    `SELECT santri_id, va_number, customer_no, status, created_at, updated_at
     FROM finance_student_va
     WHERE santri_id = ?`,
    [santriId]
  )
}

/**
 * Mencari data Fixed BRIVA berdasarkan nomor VA lengkap.
 */
export async function findStudentByFixedVa(vaNumber: string): Promise<FinanceStudentVa | null> {
  const trimmed = vaNumber.trim()
  return queryOne<FinanceStudentVa>(
    `SELECT santri_id, va_number, customer_no, status, created_at, updated_at
     FROM finance_student_va
     WHERE va_number = ?`,
    [trimmed]
  )
}

/**
 * Mencari data Fixed BRIVA berdasarkan customer_no santri.
 */
export async function findStudentByCustomerNo(customerNo: string): Promise<FinanceStudentVa | null> {
  const trimmed = customerNo.trim()
  return queryOne<FinanceStudentVa>(
    `SELECT santri_id, va_number, customer_no, status, created_at, updated_at
     FROM finance_student_va
     WHERE customer_no = ?`,
    [trimmed]
  )
}

/**
 * Mendaftarkan atau memperbarui Fixed BRIVA santri secara atomik.
 * Menegakkan aturan:
 * 1. Santri harus terdaftar dan berstatus billable (bukan AL-BAGHORY).
 * 2. va_number dan customer_no unik secara global across santri.
 * 3. partnerServiceId tidak disimpan di row santri ini (institusi/app_settings).
 */
export async function assignStudentFixedVa(
  santriId: string,
  vaNumber: string,
  customerNo?: string,
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'
): Promise<FinanceStudentVa> {
  const cleanVa = vaNumber.trim()

  if (!cleanVa) {
    throw new Error('Nomor Virtual Account tidak boleh kosong.')
  }

  // Validasi santri terdaftar & billable
  const student = await queryOne<{
    id: string
    status_global: string
    asrama: string | null
    nama_lengkap: string
    kategori_santri: string | null
    nis: string | null
  }>(
    `SELECT id, status_global, asrama, nama_lengkap, kategori_santri, nis FROM santri WHERE id = ?`,
    [santriId]
  )
  if (!student) {
    throw new Error(`Santri dengan ID "${santriId}" tidak ditemukan.`)
  }
  assertSantriBillable(student.asrama, student.nama_lengkap, student.kategori_santri)

  const cleanCustomerNo = (customerNo || student.nis || santriId.replace(/\D/g, '')).trim()
  if (!cleanCustomerNo) {
    throw new Error('Customer number tidak boleh kosong.')
  }

  // Periksa keunikan va_number
  const existingVa = await findStudentByFixedVa(cleanVa)
  if (existingVa && existingVa.santri_id !== santriId) {
    throw new Error(`Nomor Virtual Account "${cleanVa}" sudah terdaftar untuk santri lain.`)
  }

  // Periksa keunikan customer_no
  const existingCust = await findStudentByCustomerNo(cleanCustomerNo)
  if (existingCust && existingCust.santri_id !== santriId) {
    throw new Error(`Customer number "${cleanCustomerNo}" sudah terdaftar untuk santri lain.`)
  }

  const timestamp = now()

  await execute(
    `INSERT INTO finance_student_va (santri_id, va_number, customer_no, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(santri_id) DO UPDATE SET
       va_number = excluded.va_number,
       customer_no = excluded.customer_no,
       status = excluded.status,
       updated_at = excluded.updated_at`,
    [santriId, cleanVa, cleanCustomerNo, status, timestamp, timestamp]
  )

  const saved = await getStudentFixedVa(santriId)
  if (!saved) {
    throw new Error('Gagal mengambil data Fixed VA setelah penyimpanan.')
  }
  return saved
}

/**
 * Mengambil daftar seluruh Fixed BRIVA yang terdaftar.
 */
export async function listStudentFixedVa(filter?: {
  status?: 'ACTIVE' | 'INACTIVE'
}): Promise<FinanceStudentVa[]> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter?.status) {
    conditions.push('status = ?')
    params.push(filter.status)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return query<FinanceStudentVa>(
    `SELECT santri_id, va_number, customer_no, status, created_at, updated_at
     FROM finance_student_va
     ${whereClause}
     ORDER BY created_at DESC`,
    params
  )
}
