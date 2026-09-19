// lib/finance/obligations.ts
// Obligation Engine - Sistem Keuangan Baru Pesantren (Fase 2B)

import { query, queryOne, execute, generateId, now } from '@/lib/db'
import { getActiveTariff } from '@/lib/finance/tariffs'
import { checkExemption } from '@/lib/finance/exemptions'
import { checkLegacySettlement, checkLegacyUsppStatus } from '@/lib/finance/legacy'
import { computeObligationStatus } from '@/lib/finance/types'
import type {
  FinanceObligation,
  FinanceItemType,
  EnsureObligationOptions,
  StudentObligationsFilter,
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

interface SantriSnapshotRow {
  id: string
  nama_lengkap: string
  status_global: string
  tempat_makan_id: string | null
  tempat_mencuci_id: string | null
}

/**
 * Validasi format periode berdasarkan item type dan mapping Tahun Ajaran (Juli–Juni).
 * - Bulanan (SPP, UANG_MAKAN, UANG_NYUCI): Wajib 'YYYY-MM'
 *   - Bulan 07 s.d. 12: TA dimulai tahun YYYY -> nama TA: 'YYYY/YYYY+1'
 *   - Bulan 01 s.d. 06: TA dimulai tahun YYYY - 1 -> nama TA: 'YYYY-1/YYYY'
 * - Tahunan (EHB, EKSKUL, KESEHATAN): Wajib 'YYYY' (tahun awal TA) -> nama TA: 'YYYY/YYYY+1'
 * - Lifetime (USPP): Wajib 'LIFETIME'
 */
export function validateAndMapPeriod(
  itemType: FinanceItemType,
  period: string
): { targetAcademicYearName: string | null } {
  if (itemType === 'USPP') {
    if (period !== 'LIFETIME') {
      throw new Error(
        `Periode untuk USPP wajib bernilai 'LIFETIME', diterima: "${period}".`
      )
    }
    return { targetAcademicYearName: null }
  }

  if (itemType === 'SPP' || itemType === 'UANG_MAKAN' || itemType === 'UANG_NYUCI') {
    const match = period.match(/^(\d{4})-(\d{2})$/)
    if (!match) {
      throw new Error(
        `Format periode untuk tagihan bulanan (${itemType}) wajib YYYY-MM (contoh: 2026-07), diterima: "${period}".`
      )
    }
    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)
    if (month < 1 || month > 12) {
      throw new Error(`Bulan pada periode tidak valid: "${period}".`)
    }
    // Mapping Tahun Ajaran Pesantren: Juli (07) s.d. Juni (06)
    const startYear = month >= 7 ? year : year - 1
    return { targetAcademicYearName: `${startYear}/${startYear + 1}` }
  }

  if (itemType === 'EHB' || itemType === 'EKSKUL' || itemType === 'KESEHATAN') {
    const match = period.match(/^(\d{4})$/)
    if (!match) {
      throw new Error(
        `Format periode untuk tagihan tahunan (${itemType}) wajib YYYY (tahun awal TA, contoh: 2026), diterima: "${period}".`
      )
    }
    const startYear = parseInt(match[1], 10)
    return { targetAcademicYearName: `${startYear}/${startYear + 1}` }
  }

  throw new Error(`Tipe item tidak dikenali: "${itemType}".`)
}

/**
 * Memastikan record kewajiban santri telah terbentuk (materialized) secara on-demand & idempotent.
 * Penegakan aturan bisnis:
 * 1. Validasi period berdasarkan item type & mapping TA Juli–Juni.
 * 2. Hanya santri berstatus 'aktif' yang dapat dimaterialisasi.
 * 3. Wajib provider valid di master_jasa untuk Makan ('Makan') dan Nyuci ('Cuci').
 * 4. Resolusi tarif ketat tanpa fallback lintas tahun ajaran.
 * 5. Re-query obligation canonical setelah INSERT OR IGNORE untuk menjamin concurrency safety.
 */
export async function ensureObligation(
  santriId: string,
  itemType: FinanceItemType,
  period: string,
  options?: EnsureObligationOptions
): Promise<FinanceObligation> {
  // 1. Validasi format periode dan tentukan target nama Tahun Ajaran
  const { targetAcademicYearName } = validateAndMapPeriod(itemType, period)

  // 2. Cek apakah record kewajiban sudah ada di database (Idempotent)
  const existing = await queryOne<FinanceObligation>(
    `SELECT id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id, created_at, updated_at
     FROM finance_obligations
     WHERE santri_id = ? AND item_type = ? AND period = ?`,
    [santriId, itemType, period]
  )

  if (existing) {
    return existing
  }

  // 2b. Cutover / Legacy Guard: Cegah pembuatan kewajiban baru untuk periode/item historis legacy
  const legacyCheck = await checkLegacySettlement(santriId, itemType, period)
  if (legacyCheck.isLegacyManaged) {
    throw new Error(
      `Pembuatan kewajiban ${itemType} periode "${period}" ditolak: ${legacyCheck.reason} (Cegah duplicate debt).`
    )
  }

  // 3. Ambil data santri existing untuk verifikasi status aktif dan snapshot provider
  const santri = await queryOne<SantriSnapshotRow>(
    `SELECT id, nama_lengkap, status_global, tempat_makan_id, tempat_mencuci_id
     FROM santri
     WHERE id = ?`,
    [santriId]
  )

  if (!santri) {
    throw new Error(`Santri dengan ID "${santriId}" tidak ditemukan.`)
  }

  // Hanya santri aktif yang boleh dimaterialisasi
  if (santri.status_global !== 'aktif') {
    throw new Error(
      `Hanya santri berstatus 'aktif' yang dapat dimaterialisasi kewajibannya. Santri "${santri.nama_lengkap}" berstatus '${santri.status_global}'.`
    )
  }

  // Wajibkan provider valid untuk Makan dan Nyuci dari master_jasa
  let providerId: string | null = null
  if (itemType === 'UANG_MAKAN') {
    if (!santri.tempat_makan_id) {
      throw new Error(
        `Santri "${santri.nama_lengkap}" belum memiliki tempat makan/katering (tempat_makan_id kosong).`
      )
    }
    const validProvider = await queryOne<{ id: string }>(
      `SELECT id FROM master_jasa WHERE id = ? AND jenis = 'Makan'`,
      [santri.tempat_makan_id]
    )
    if (!validProvider) {
      throw new Error(
        `Tempat makan santri "${santri.tempat_makan_id}" tidak valid pada master_jasa (wajib jenis 'Makan').`
      )
    }
    providerId = santri.tempat_makan_id
  } else if (itemType === 'UANG_NYUCI') {
    if (!santri.tempat_mencuci_id) {
      throw new Error(
        `Santri "${santri.nama_lengkap}" belum memiliki tempat cuci/laundry (tempat_mencuci_id kosong).`
      )
    }
    const validProvider = await queryOne<{ id: string }>(
      `SELECT id FROM master_jasa WHERE id = ? AND jenis = 'Cuci'`,
      [santri.tempat_mencuci_id]
    )
    if (!validProvider) {
      throw new Error(
        `Tempat cuci santri "${santri.tempat_mencuci_id}" tidak valid pada master_jasa (wajib jenis 'Cuci').`
      )
    }
    providerId = santri.tempat_mencuci_id
  }

  // 4. Validasi konsistensi academic_year_id dengan hasil mapping kalender Juli–Juni
  let academicYearId: number | null = null

  if (targetAcademicYearName) {
    const expectedTA = await queryOne<{ id: number; nama: string }>(
      `SELECT id, nama FROM tahun_ajaran WHERE nama = ? LIMIT 1`,
      [targetAcademicYearName]
    )
    if (!expectedTA) {
      throw new Error(
        `Tahun ajaran "${targetAcademicYearName}" untuk periode "${period}" (kalender Juli–Juni) belum terdaftar di master tahun_ajaran.`
      )
    }

    if (options?.academicYearId !== undefined && options?.academicYearId !== null) {
      if (options.academicYearId !== expectedTA.id) {
        const providedTA = await queryOne<{ id: number; nama: string }>(
          `SELECT id, nama FROM tahun_ajaran WHERE id = ?`,
          [options.academicYearId]
        )
        const providedName = providedTA ? providedTA.nama : `ID ${options.academicYearId} (tidak ditemukan)`
        throw new Error(
          `academic_year_id ${options.academicYearId} (${providedName}) tidak konsisten dengan periode "${period}" yang berada pada Tahun Ajaran ${expectedTA.nama} (kalender Juli–Juni).`
        )
      }
      academicYearId = options.academicYearId
    } else {
      academicYearId = expectedTA.id
    }
  } else {
    // USPP ('LIFETIME')
    if (options?.academicYearId !== undefined && options?.academicYearId !== null) {
      const providedTA = await queryOne<{ id: number }>(
        `SELECT id FROM tahun_ajaran WHERE id = ?`,
        [options.academicYearId]
      )
      if (!providedTA) {
        throw new Error(`Tahun ajaran dengan ID ${options.academicYearId} tidak ditemukan.`)
      }
      academicYearId = options.academicYearId
    } else {
      const activeYear = await queryOne<{ id: number }>(
        `SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1`
      )
      academicYearId = activeYear ? activeYear.id : null
    }
  }

  // 5. Resolusi tarif aktif (Snapshot Tarif) - Ketat pada TA yang ditentukan
  const tariff = await getActiveTariff(itemType, period, academicYearId)
  if (!tariff) {
    throw new Error(
      `Tarif untuk item "${itemType}" periode "${period}" (Tahun Ajaran ID: ${academicYearId ?? 'Global'}) belum dikonfigurasi.`
    )
  }

  // 6. Resolusi pembebasan biaya santri (Exemption Engine)
  const exemption = await checkExemption(
    santriId,
    itemType,
    period,
    academicYearId
  )

  // 6b. Legacy Adapter untuk USPP/BANGUNAN:
  // Hitung total kewajiban historis dan pembayaran legacy yang sudah masuk.
  // Jika baru dibayar sebagian, bawa nilai pembayaran historis ke amount_paid TANPA membuat payment baru.
  let amountExpected = tariff.nominal
  let initialAmountPaid = 0

  if (itemType === 'USPP') {
    const usppStatus = await checkLegacyUsppStatus(santriId)
    if (usppStatus.totalTariff > 0) {
      amountExpected = usppStatus.totalTariff
    }
    if (usppStatus.legacyPaid > 0 && !usppStatus.isFullySettled) {
      initialAmountPaid = usppStatus.legacyPaid
    }
  }

  const amountExempted = exemption ? amountExpected : 0
  const amountPaid = initialAmountPaid
  const status = computeObligationStatus(amountExpected, amountExempted, amountPaid)

  const id = generateId()
  const timestamp = now()

  // 7. Simpan kewajiban ke database (gunakan INSERT OR IGNORE untuk mencegah race conditions)
  await execute(
    `INSERT OR IGNORE INTO finance_obligations (
      id, santri_id, item_type, academic_year_id, period,
      tariff_id, amount_expected, amount_exempted, amount_paid,
      status, provider_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      santriId,
      itemType,
      tariff.academic_year_id ?? academicYearId,
      period,
      tariff.id,
      amountExpected,
      amountExempted,
      amountPaid,
      status,
      providerId,
      timestamp,
      timestamp,
    ]
  )

  // 8. Re-query canonical row untuk concurrency safety
  const canonical = await queryOne<FinanceObligation>(
    `SELECT id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id, created_at, updated_at
     FROM finance_obligations
     WHERE santri_id = ? AND item_type = ? AND period = ?`,
    [santriId, itemType, period]
  )

  if (!canonical) {
    throw new Error(
      `Gagal mengambil record kewajiban kanonikal untuk santri "${santriId}", item "${itemType}", periode "${period}".`
    )
  }

  return canonical
}

/**
 * Memastikan paket tagihan bulanan (SPP, Uang Makan, Uang Nyuci) telah terbentuk untuk santri.
 */
export async function ensureMonthlyObligations(
  santriId: string,
  period: string, // YYYY-MM
  options?: EnsureObligationOptions
): Promise<FinanceObligation[]> {
  const results: FinanceObligation[] = []
  for (const itemType of MONTHLY_ITEM_TYPES) {
    const obligation = await ensureObligation(santriId, itemType, period, options)
    results.push(obligation)
  }
  return results
}

/**
 * Memastikan paket tagihan tahunan (EHB, Ekskul, Kesehatan) telah terbentuk untuk santri.
 */
export async function ensureAnnualObligations(
  santriId: string,
  period: string, // YYYY
  options?: EnsureObligationOptions
): Promise<FinanceObligation[]> {
  const results: FinanceObligation[] = []
  for (const itemType of ANNUAL_ITEM_TYPES) {
    const obligation = await ensureObligation(santriId, itemType, period, options)
    results.push(obligation)
  }
  return results
}

/**
 * Memastikan tagihan USPP (Uang Pangkal Bangunan) dengan periode 'LIFETIME' telah terbentuk.
 */
export async function ensureLifetimeObligations(
  santriId: string,
  options?: EnsureObligationOptions
): Promise<FinanceObligation> {
  return ensureObligation(santriId, 'USPP', 'LIFETIME', options)
}

/**
 * Mengambil daftar kewajiban santri dengan filter opsional.
 * Jika opsi autoEnsure aktif dan filter.period diberikan, kewajiban otomatis dimaterialisasikan.
 */
export async function getStudentObligations(
  santriId: string,
  filter?: StudentObligationsFilter
): Promise<FinanceObligation[]> {
  if (filter?.autoEnsure && filter?.period) {
    if (/^\d{4}-\d{2}$/.test(filter.period)) {
      await ensureMonthlyObligations(santriId, filter.period)
    } else if (/^\d{4}$/.test(filter.period)) {
      await ensureAnnualObligations(santriId, filter.period)
    }
  }

  const conditions: string[] = ['santri_id = ?']
  const params: unknown[] = [santriId]

  if (filter?.period) {
    conditions.push('period = ?')
    params.push(filter.period)
  }

  if (filter?.itemType) {
    conditions.push('item_type = ?')
    params.push(filter.itemType)
  }

  if (filter?.status) {
    conditions.push('status = ?')
    params.push(filter.status)
  }

  return query<FinanceObligation>(
    `SELECT id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id, created_at, updated_at
     FROM finance_obligations
     WHERE ${conditions.join(' AND ')}
     ORDER BY period DESC, item_type ASC`,
    params
  )
}

/**
 * Menghitung ulang saldo terbayar (amount_paid) dan status kewajiban
 * dari akumulasi alokasi pembayaran aktif (PRD Section 5.1 & Implementation Plan 2.1).
 *
 * PENTING: Dilarang dipanggil sebelum tabel finance_allocations tersedia di database.
 */
export async function recalculateObligation(
  obligationId: string
): Promise<FinanceObligation> {
  // Cegah pemanggilan sebelum tabel finance_allocations tersedia di database
  const allocationTable = await queryOne<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='finance_allocations'`
  )

  if (!allocationTable) {
    throw new Error(
      'recalculateObligation tidak dapat dijalankan sebelum tabel finance_allocations tersedia di database.'
    )
  }

  const obligation = await queryOne<FinanceObligation>(
    `SELECT id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id, created_at, updated_at
     FROM finance_obligations
     WHERE id = ?`,
    [obligationId]
  )

  if (!obligation) {
    throw new Error(`Kewajiban dengan ID "${obligationId}" tidak ditemukan.`)
  }

  const sumResult = await queryOne<{ total: number | null }>(
    `SELECT SUM(amount) AS total
     FROM finance_allocations
     WHERE obligation_id = ?`,
    [obligationId]
  )
  const allocationsPaid = sumResult?.total ?? 0

  // Periksa apakah ada pembayaran legacy yang terbawa pada kewajiban ini (khusus USPP)
  let legacyPaid = 0
  if (obligation.item_type === 'USPP') {
    const usppStatus = await checkLegacyUsppStatus(obligation.santri_id)
    if (!usppStatus.isFullySettled && usppStatus.legacyPaid > 0) {
      legacyPaid = usppStatus.legacyPaid
    }
  }

  const totalPaid = legacyPaid + allocationsPaid

  // Hitung status derived baru
  const newStatus = computeObligationStatus(
    obligation.amount_expected,
    obligation.amount_exempted,
    totalPaid
  )

  const timestamp = now()
  await execute(
    `UPDATE finance_obligations
     SET amount_paid = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    [totalPaid, newStatus, timestamp, obligationId]
  )

  const updated = await queryOne<FinanceObligation>(
    `SELECT id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id, created_at, updated_at
     FROM finance_obligations
     WHERE id = ?`,
    [obligationId]
  )

  if (!updated) {
    throw new Error('Gagal mengambil data kewajiban setelah rekalkulasi.')
  }

  return updated
}
