import type { BillingStore } from './billing-store'
import type { FinanceItemType, FinanceTariff, FinanceTariffOverride } from './types'
export function createTariffReader({ queryOne }: BillingStore, strict = false) {
  async function getActiveTariff(
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

  async function getTariffOverride(
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
    } catch (error) {
      if (strict) throw error
      return null
    }
  }

  return { getActiveTariff, getTariffOverride }
}
