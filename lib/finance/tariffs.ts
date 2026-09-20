// lib/finance/tariffs.ts
// Modul manajemen tarif Sistem Keuangan Baru

import { query, queryOne, execute, generateId } from '@/lib/db'
import type {
  FinanceTariff,
  FinanceTariffOverride,
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

  // 1. PRESIDENSI KANONIKAL TERTINGGI: Cek apakah ada Tarif Khusus Periode (Override)
  // Berlaku untuk tagihan bulanan (YYYY-MM) seperti UANG_MAKAN Ramadan/Libur, UANG_NYUCI, dll.
  if (/^\d{4}-\d{2}$/.test(dateOrPeriod)) {
    const override = await getTariffOverride(itemType, dateOrPeriod)
    if (override) {
      return {
        id: override.id,
        item_type: override.item_type,
        academic_year_id: override.academic_year_id,
        nominal: override.nominal,
        installment_rule: itemType === 'USPP' ? 'ALLOWED' : 'DISALLOWED',
        effective_from: `${override.period}-01`,
        effective_until: `${override.period}-31`,
        created_by: override.created_by,
        created_at: override.created_at,
      }
    }
  }

  // 2. FALLBACK: Cari tarif dasar/normal pada finance_tariffs
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

// ─── PERIOD-SPECIFIC TARIFF OVERRIDES ────────────────────────────────────────

/**
 * Mengambil tarif khusus untuk periode tertentu jika ada.
 */
export async function getTariffOverride(
  itemType: FinanceItemType,
  period: string
): Promise<FinanceTariffOverride | null> {
  try {
    return await queryOne<FinanceTariffOverride>(
      `SELECT id, item_type, period, nominal, academic_year_id, notes,
              created_by, created_at, updated_at
       FROM finance_tariff_overrides
       WHERE item_type = ? AND period = ? LIMIT 1`,
      [itemType, period]
    )
  } catch {
    return null
  }
}

/**
 * Menyimpan atau memperbarui tarif khusus periode secara idempoten (upsert).
 */
export async function setTariffOverride(input: {
  item_type: FinanceItemType
  period: string // YYYY-MM
  nominal: number
  academic_year_id?: number | null
  notes?: string | null
  created_by?: string | null
}): Promise<FinanceTariffOverride> {
  if (input.nominal < 0) {
    throw new Error('Nominal tarif khusus tidak boleh negatif.')
  }
  if (!/^\d{4}-\d{2}$/.test(input.period)) {
    throw new Error(`Format periode wajib YYYY-MM (diterima: "${input.period}").`)
  }

  const existing = await getTariffOverride(input.item_type, input.period)
  const nowStr = new Date().toISOString()
  const academicYearId = input.academic_year_id ?? null
  const notes = input.notes ?? null
  const createdBy = input.created_by ?? null

  if (existing) {
    await execute(
      `UPDATE finance_tariff_overrides
       SET nominal = ?, academic_year_id = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [Math.floor(input.nominal), academicYearId, notes, nowStr, existing.id]
    )
    const updated = await getTariffOverride(input.item_type, input.period)
    return updated!
  }

  const id = generateId()
  await execute(
    `INSERT INTO finance_tariff_overrides (
       id, item_type, period, nominal, academic_year_id, notes,
       created_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.item_type,
      input.period,
      Math.floor(input.nominal),
      academicYearId,
      notes,
      createdBy,
      nowStr,
      nowStr,
    ]
  )

  const created = await getTariffOverride(input.item_type, input.period)
  if (!created) {
    throw new Error('Gagal memverifikasi pembentukan tarif khusus periode.')
  }
  return created
}

/**
 * Menghapus tarif khusus periode sehingga tagihan kembali menggunakan tarif dasar.
 */
export async function deleteTariffOverride(idOrItemType: string, period?: string): Promise<boolean> {
  if (period) {
    await execute(`DELETE FROM finance_tariff_overrides WHERE item_type = ? AND period = ?`, [idOrItemType, period])
  } else {
    await execute(`DELETE FROM finance_tariff_overrides WHERE id = ?`, [idOrItemType])
  }
  return true
}

/**
 * Mengambil daftar seluruh tarif khusus periode.
 */
export async function listTariffOverrides(filter?: {
  itemType?: FinanceItemType
  academicYearId?: number | null
}): Promise<FinanceTariffOverride[]> {
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

  try {
    return await query<FinanceTariffOverride>(
      `SELECT id, item_type, period, nominal, academic_year_id, notes,
              created_by, created_at, updated_at
       FROM finance_tariff_overrides
       ${whereClause}
       ORDER BY period DESC, item_type ASC`,
      params
    )
  } catch {
    return []
  }
}
