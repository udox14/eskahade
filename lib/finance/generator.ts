// lib/finance/generator.ts
// Active Students Obligation Generator - Sistem Keuangan Baru Pesantren (Fase 2C)

import { query } from '@/lib/db'
import {
  ensureObligation,
  ensureLifetimeObligations,
} from '@/lib/finance/obligations'
import { checkLegacySettlement } from '@/lib/finance/legacy'
import type {
  FinanceItemType,
  BatchGenerationResult,
  BatchGenerationError,
} from '@/lib/finance/types'

const MONTHLY_ITEM_TYPES: readonly FinanceItemType[] = [
  'SPP',
  'UANG_MAKAN',
  'UANG_NYUCI',
] as const

const ANNUAL_ITEM_TYPES: readonly FinanceItemType[] = [
  'EHB',
  'EKSKUL',
  'KESEHATAN',
] as const

interface ActiveSantriRow {
  id: string
  nama_lengkap: string
  status_global: string
  tempat_makan_id: string | null
  tempat_mencuci_id: string | null
  asrama: string | null
}

/**
 * Menghasilkan / menyinkronkan kewajiban bulanan (SPP, Uang Makan, Uang Nyuci)
 * untuk seluruh santri aktif secara massal dan aman (idempotent).
 * Dilengkapi dengan Cutover/Legacy Guard untuk mencegah timbulnya duplicate debt
 * pada periode yang sudah dikelola oleh sistem legacy (spp_log).
 */
export async function generateMonthlyObligationsForActiveStudents(
  period: string, // YYYY-MM
  options?: {
    academicYearId?: number
    asrama?: string
  }
): Promise<BatchGenerationResult> {
  const conditions: string[] = ["status_global = 'aktif'"]
  const params: unknown[] = []

  if (options?.asrama) {
    conditions.push('asrama = ?')
    params.push(options.asrama)
  }

  const students = await query<ActiveSantriRow>(
    `SELECT id, nama_lengkap, status_global, tempat_makan_id, tempat_mencuci_id, asrama
     FROM santri
     WHERE ${conditions.join(' AND ')}
     ORDER BY nama_lengkap ASC`,
    params
  )

  const errors: BatchGenerationError[] = []
  let createdCount = 0
  let alreadyExistsCount = 0
  let exemptedCount = 0
  let skippedLegacyCount = 0
  let failedCount = 0

  for (const student of students) {
    for (const itemType of MONTHLY_ITEM_TYPES) {
      // Cutover / Legacy Guard
      const legacyCheck = await checkLegacySettlement(student.id, itemType, period)
      if (legacyCheck.isLegacyManaged) {
        skippedLegacyCount++
        continue
      }

      try {
        const obligation = await ensureObligation(
          student.id,
          itemType,
          period,
          { academicYearId: options?.academicYearId }
        )

        // Indikator apakah baru dibuat atau sudah ada
        const isFresh = obligation.created_at === obligation.updated_at
        if (isFresh) {
          createdCount++
          if (obligation.status === 'EXEMPTED') {
            exemptedCount++
          }
        } else {
          alreadyExistsCount++
        }
      } catch (err: unknown) {
        failedCount++
        errors.push({
          santriId: student.id,
          namaSantri: student.nama_lengkap,
          itemType,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return {
    period,
    totalStudents: students.length,
    processedCount: students.length * MONTHLY_ITEM_TYPES.length,
    createdCount,
    alreadyExistsCount,
    exemptedCount,
    skippedLegacyCount,
    failedCount,
    errors,
  }
}

/**
 * Menghasilkan / menyinkronkan kewajiban tahunan (EHB, Ekskul, Kesehatan)
 * untuk seluruh santri aktif pada tahun ajaran terkait.
 */
export async function generateAnnualObligationsForActiveStudents(
  period: string, // YYYY
  options?: {
    academicYearId?: number
    asrama?: string
  }
): Promise<BatchGenerationResult> {
  const conditions: string[] = ["status_global = 'aktif'"]
  const params: unknown[] = []

  if (options?.asrama) {
    conditions.push('asrama = ?')
    params.push(options.asrama)
  }

  const students = await query<ActiveSantriRow>(
    `SELECT id, nama_lengkap, status_global, tempat_makan_id, tempat_mencuci_id, asrama
     FROM santri
     WHERE ${conditions.join(' AND ')}
     ORDER BY nama_lengkap ASC`,
    params
  )

  const errors: BatchGenerationError[] = []
  let createdCount = 0
  let alreadyExistsCount = 0
  let exemptedCount = 0
  let skippedLegacyCount = 0
  let failedCount = 0

  for (const student of students) {
    for (const itemType of ANNUAL_ITEM_TYPES) {
      // Cutover / Legacy Guard
      const legacyCheck = await checkLegacySettlement(student.id, itemType, period)
      if (legacyCheck.isLegacyManaged) {
        skippedLegacyCount++
        continue
      }

      try {
        const obligation = await ensureObligation(
          student.id,
          itemType,
          period,
          { academicYearId: options?.academicYearId }
        )

        const isFresh = obligation.created_at === obligation.updated_at
        if (isFresh) {
          createdCount++
          if (obligation.status === 'EXEMPTED') {
            exemptedCount++
          }
        } else {
          alreadyExistsCount++
        }
      } catch (err: unknown) {
        failedCount++
        errors.push({
          santriId: student.id,
          namaSantri: student.nama_lengkap,
          itemType,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return {
    period,
    totalStudents: students.length,
    processedCount: students.length * ANNUAL_ITEM_TYPES.length,
    createdCount,
    alreadyExistsCount,
    exemptedCount,
    skippedLegacyCount,
    failedCount,
    errors,
  }
}

/**
 * Menghasilkan kewajiban USPP (Uang Pangkal Bangunan, periode 'LIFETIME')
 * untuk santri aktif baru yang belum memilikinya dan belum memiliki data di legacy.
 */
export async function generateLifetimeObligationsForNewStudents(
  options?: {
    academicYearId?: number
    asrama?: string
  }
): Promise<BatchGenerationResult> {
  const conditions: string[] = [
    "status_global = 'aktif'",
    `NOT EXISTS (
      SELECT 1 FROM finance_obligations
      WHERE santri_id = santri.id AND item_type = 'USPP' AND period = 'LIFETIME'
    )`,
  ]
  const params: unknown[] = []

  if (options?.asrama) {
    conditions.push('asrama = ?')
    params.push(options.asrama)
  }

  const students = await query<ActiveSantriRow>(
    `SELECT id, nama_lengkap, status_global, tempat_makan_id, tempat_mencuci_id, asrama
     FROM santri
     WHERE ${conditions.join(' AND ')}
     ORDER BY nama_lengkap ASC`,
    params
  )

  const errors: BatchGenerationError[] = []
  let createdCount = 0
  let skippedLegacyCount = 0
  let failedCount = 0

  for (const student of students) {
    // Cutover / Legacy Guard
    const legacyCheck = await checkLegacySettlement(student.id, 'USPP', 'LIFETIME')
    if (legacyCheck.isLegacyManaged) {
      skippedLegacyCount++
      continue
    }

    try {
      await ensureLifetimeObligations(student.id, {
        academicYearId: options?.academicYearId,
      })
      createdCount++
    } catch (err: unknown) {
      failedCount++
      errors.push({
        santriId: student.id,
        namaSantri: student.nama_lengkap,
        itemType: 'USPP',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    period: 'LIFETIME',
    totalStudents: students.length,
    processedCount: students.length,
    createdCount,
    alreadyExistsCount: 0,
    exemptedCount: 0,
    skippedLegacyCount,
    failedCount,
    errors,
  }
}
