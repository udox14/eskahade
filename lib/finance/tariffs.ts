// lib/finance/tariffs.ts
// Modul manajemen tarif Sistem Keuangan Baru

import { query, queryOne, execute, generateId } from '@/lib/db'
import type {
  FinanceTariff,
  FinanceItemType,
  CreateTariffInput,
} from '@/lib/finance/types'

/**
 * Membuat data tarif baru dengan penegakan aturan bisnis PRD
 * dan pencegahan overlapping tariff version.
 */
export async function createTariff(input: CreateTariffInput): Promise<FinanceTariff> {
  if (input.nominal < 0) {
    throw new Error('Nominal tarif tidak boleh bernilai negatif.')
  }

  // Aturan kaku PRD: SPP tidak boleh dicicil; USPP selalu boleh dicicil
  let installmentRule = input.installment_rule ?? 'DISALLOWED'
  if (input.item_type === 'SPP') {
    installmentRule = 'DISALLOWED'
  } else if (input.item_type === 'USPP') {
    installmentRule = 'ALLOWED'
  }

  const effectiveUntil = input.effective_until ?? null
  const academicYearId = input.academic_year_id ?? null
  const checkUntil = effectiveUntil ?? '9999-12-31'
  const id = generateId()
  const nowStr = new Date().toISOString()
  const createdBy = input.created_by ?? null

  // ATOMIC INSERTION: Menggunakan conditional INSERT yang dieksekusi atomik di engine database
  // sehingga tidak mungkin tembus race condition (concurrency-safe), diperkuat oleh database trigger.
  const atomicInsertSql = `
    INSERT INTO finance_tariffs (
      id, item_type, academic_year_id, nominal, installment_rule,
      effective_from, effective_until, created_by, created_at
    )
    SELECT
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM finance_tariffs
      WHERE item_type = ?
        AND (
          (academic_year_id = ? AND ? IS NOT NULL) OR
          (academic_year_id IS NULL AND ? IS NULL)
        )
        AND effective_from <= ?
        AND (effective_until IS NULL OR effective_until >= ?)
    )
  `

  try {
    await execute(atomicInsertSql, [
      id,
      input.item_type,
      academicYearId,
      Math.floor(input.nominal),
      installmentRule,
      input.effective_from,
      effectiveUntil,
      createdBy,
      nowStr,
      input.item_type,
      academicYearId,
      academicYearId,
      academicYearId,
      checkUntil,
      input.effective_from,
    ])
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.toLowerCase().includes('tumpang tindih') || errMsg.toLowerCase().includes('overlapping')) {
      throw new Error(
        `Tarif versi baru tumpang tindih (overlapping) dengan tarif yang sudah ada untuk item "${input.item_type}".`
      )
    }
    throw err
  }

  const created = await getTariffById(id)
  if (!created) {
    throw new Error(
      `Tarif versi baru tumpang tindih (overlapping) dengan tarif yang sudah ada untuk item "${input.item_type}".`
    )
  }

  return created
}

/**
 * Mengambil tarif berdasarkan ID.
 */
export async function getTariffById(id: string): Promise<FinanceTariff | null> {
  return queryOne<FinanceTariff>(
    `SELECT id, item_type, academic_year_id, nominal, installment_rule,
            effective_from, effective_until, created_by, created_at
     FROM finance_tariffs WHERE id = ?`,
    [id]
  )
}

/**
 * Mengambil tarif aktif yang berlaku untuk item type pada periode atau tanggal tertentu.
 * Aturan ketat: TIDAK ADA FALLBACK LINTAS TAHUN AJARAN.
 * Jika academicYearId ditentukan, query hanya mencari tarif pada tahun ajaran tersebut.
 */
export async function getActiveTariff(
  itemType: FinanceItemType,
  dateOrPeriod: string,
  academicYearId?: number | null
): Promise<FinanceTariff | null> {
  let dateLower = dateOrPeriod
  let dateUpper = dateOrPeriod

  if (dateOrPeriod === 'LIFETIME') {
    const today = new Date().toISOString().split('T')[0]
    dateLower = today
    dateUpper = today
  } else if (/^\d{4}-\d{2}$/.test(dateOrPeriod)) {
    // Bulanan YYYY-MM
    dateLower = `${dateOrPeriod}-01`
    dateUpper = `${dateOrPeriod}-31`
  } else if (/^\d{4}$/.test(dateOrPeriod)) {
    // Tahunan YYYY
    dateLower = `${dateOrPeriod}-01-01`
    dateUpper = `${dateOrPeriod}-12-31`
  }

  // Jika academicYearId diberikan: HANYA cari pada tahun ajaran tersebut (TANPA fallback lintas TA)
  if (academicYearId !== undefined && academicYearId !== null) {
    return queryOne<FinanceTariff>(
      `SELECT id, item_type, academic_year_id, nominal, installment_rule,
              effective_from, effective_until, created_by, created_at
       FROM finance_tariffs
       WHERE item_type = ?
         AND academic_year_id = ?
         AND effective_from <= ?
         AND (effective_until IS NULL OR effective_until >= ?)
       ORDER BY effective_from DESC, created_at DESC
       LIMIT 1`,
      [itemType, academicYearId, dateUpper, dateLower]
    )
  }

  // Jika academicYearId tidak ditentukan (misal untuk item tanpa ikatan TA khusus / USPP global),
  // cari tarif yang academic_year_id IS NULL
  return queryOne<FinanceTariff>(
    `SELECT id, item_type, academic_year_id, nominal, installment_rule,
            effective_from, effective_until, created_by, created_at
     FROM finance_tariffs
     WHERE item_type = ?
       AND academic_year_id IS NULL
       AND effective_from <= ?
       AND (effective_until IS NULL OR effective_until >= ?)
     ORDER BY effective_from DESC, created_at DESC
     LIMIT 1`,
    [itemType, dateUpper, dateLower]
  )
}

/**
 * Mengambil daftar seluruh tarif dengan filter opsional.
 */
export async function listTariffs(filter?: {
  itemType?: FinanceItemType
  academicYearId?: number | null
}): Promise<FinanceTariff[]> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter?.itemType) {
    conditions.push('item_type = ?')
    params.push(filter.itemType)
  }

  if (filter?.academicYearId !== undefined) {
    if (filter.academicYearId === null) {
      conditions.push('academic_year_id IS NULL')
    } else {
      conditions.push('academic_year_id = ?')
      params.push(filter.academicYearId)
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return query<FinanceTariff>(
    `SELECT id, item_type, academic_year_id, nominal, installment_rule,
            effective_from, effective_until, created_by, created_at
     FROM finance_tariffs
     ${whereClause}
     ORDER BY item_type ASC, effective_from DESC, created_at DESC`,
    params
  )
}
