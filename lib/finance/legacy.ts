// lib/finance/legacy.ts
// Modul Cutover & Legacy Guard - Sistem Keuangan Baru Pesantren (Fase 2C Patch)

import { queryOne } from '@/lib/db'
import type { FinanceItemType } from '@/lib/finance/types'

/**
 * Batas periode cutover Sistem Keuangan Baru.
 * - Bulanan (SPP, UANG_MAKAN, UANG_NYUCI): Mulai berlaku periode 2026-07 (Tahun Ajaran 2026/2027).
 * - Tahunan (EHB, EKSKUL, KESEHATAN): Mulai berlaku tahun tagihan 2026.
 * Segala periode sebelum cutover dikelola oleh sistem legacy (spp_log, pembayaran_tahunan).
 */
export const FINANCE_CUTOVER_START_MONTHLY = '2026-07'
export const FINANCE_CUTOVER_START_ANNUAL = 2026

export interface LegacySettlementCheckResult {
  isLegacyManaged: boolean
  reason?: string
}

export interface LegacyUsppStatus {
  totalTariff: number
  legacyPaid: number
  isExempted: boolean
  isFullySettled: boolean
  remainingAmount: number
}

/**
 * Menghitung total kewajiban USPP historis yang berlaku untuk santri.
 * Mengutamakan tabel legacy biaya_settings (BANGUNAN) berdasarkan tahun angkatan santri,
 * kemudian fallback ke tabel modern finance_tariffs ('USPP').
 */
export async function getHistoricalUsppTariff(santriId: string): Promise<number> {
  const santri = await queryOne<{
    tahun_masuk: number | null
    tanggal_masuk: string | null
    created_at: string | null
  }>(
    `SELECT tahun_masuk, tanggal_masuk, created_at FROM santri WHERE id = ?`,
    [santriId]
  ).catch(() => null)

  let tahunAngkatan: number | null = santri?.tahun_masuk ?? null
  if (!tahunAngkatan && santri?.tanggal_masuk) {
    const yr = parseInt(santri.tanggal_masuk.slice(0, 4), 10)
    if (!isNaN(yr) && yr > 0) tahunAngkatan = yr
  }
  if (!tahunAngkatan && santri?.created_at) {
    const yr = new Date(santri.created_at).getFullYear()
    if (!isNaN(yr) && yr > 0) tahunAngkatan = yr
  }

  // 1. Cek biaya_settings legacy berdasarkan angkatan
  if (tahunAngkatan) {
    const legacyTarif = await queryOne<{ nominal: number }>(
      `SELECT nominal FROM biaya_settings WHERE jenis_biaya = 'BANGUNAN' AND tahun_angkatan = ? LIMIT 1`,
      [tahunAngkatan]
    ).catch(() => null)

    if (legacyTarif && legacyTarif.nominal > 0) {
      return legacyTarif.nominal
    }
  }

  // Fallback biaya_settings tanpa angkatan spesifik
  const legacyDefault = await queryOne<{ nominal: number }>(
    `SELECT nominal FROM biaya_settings WHERE jenis_biaya = 'BANGUNAN' ORDER BY tahun_angkatan DESC LIMIT 1`
  ).catch(() => null)

  if (legacyDefault && legacyDefault.nominal > 0) {
    return legacyDefault.nominal
  }

  // 2. Fallback ke finance_tariffs sistem baru
  const modernTariff = await queryOne<{ nominal: number }>(
    `SELECT nominal FROM finance_tariffs WHERE item_type = 'USPP' ORDER BY effective_from DESC LIMIT 1`
  ).catch(() => null)

  if (modernTariff && modernTariff.nominal > 0) {
    return modernTariff.nominal
  }

  return 5000000
}

/**
 * Menghitung akumulasi pembayaran USPP/BANGUNAN yang sudah masuk pada sistem legacy
 * dan mengevaluasi status kelunasannya secara aman tanpa menduplikasi data.
 */
export async function checkLegacyUsppStatus(santriId: string): Promise<LegacyUsppStatus> {
  const totalTariff = await getHistoricalUsppTariff(santriId)

  let legacyPaid = 0
  let isExempted = false

  try {
    const paidRow = await queryOne<{ total: number; has_exemption: number }>(
      `SELECT COALESCE(SUM(nominal_bayar), 0) AS total,
              MAX(CASE WHEN nominal_bayar = 0 THEN 1 ELSE 0 END) AS has_exemption
       FROM pembayaran_tahunan
       WHERE santri_id = ?
         AND jenis_biaya = 'BANGUNAN'
         AND COALESCE(status, 'AKTIF') != 'VOID'`,
      [santriId]
    )

    if (paidRow) {
      legacyPaid = paidRow.total ?? 0
      isExempted = (paidRow.has_exemption ?? 0) === 1
    }
  } catch {
    // Tabel pembayaran_tahunan mungkin tidak ada pada env terisolasi
  }

  const isFullySettled = isExempted || (totalTariff > 0 && legacyPaid >= totalTariff)
  const remainingAmount = isFullySettled ? 0 : Math.max(0, totalTariff - legacyPaid)

  return {
    totalTariff,
    legacyPaid,
    isExempted,
    isFullySettled,
    remainingAmount,
  }
}

/**
 * Memeriksa apakah suatu kewajiban santri (item_type & period) sudah dikelola atau
 * telah diselesaikan pada sistem legacy (spp_log, pembayaran_tahunan, USPP legacy).
 * Digunakan sebagai guard untuk mencegah timbulnya duplicate debt.
 */
export async function checkLegacySettlement(
  santriId: string,
  itemType: FinanceItemType,
  period: string
): Promise<LegacySettlementCheckResult> {
  // 1. Cek periode historis sebelum cutover resmi Sistem Keuangan Baru
  if (itemType === 'SPP' || itemType === 'UANG_MAKAN' || itemType === 'UANG_NYUCI') {
    if (period < FINANCE_CUTOVER_START_MONTHLY) {
      return {
        isLegacyManaged: true,
        reason: `Periode tagihan bulanan "${period}" sebelum cutover (${FINANCE_CUTOVER_START_MONTHLY}) dikelola oleh sistem legacy.`,
      }
    }
  } else if (itemType === 'EHB' || itemType === 'EKSKUL' || itemType === 'KESEHATAN') {
    const year = parseInt(period, 10)
    if (!isNaN(year) && year < FINANCE_CUTOVER_START_ANNUAL) {
      return {
        isLegacyManaged: true,
        reason: `Periode tagihan tahunan "${period}" sebelum cutover (${FINANCE_CUTOVER_START_ANNUAL}) dikelola oleh sistem legacy.`,
      }
    }
  }

  // 2. Cek histori pembayaran pada tabel legacy spp_log
  if (itemType === 'SPP') {
    const match = period.match(/^(\d{4})-(\d{2})$/)
    if (match) {
      const year = parseInt(match[1], 10)
      const month = parseInt(match[2], 10)

      try {
        const legacySpp = await queryOne<{ id: string; nominal_bayar: number }>(
          `SELECT id, nominal_bayar
           FROM spp_log
           WHERE santri_id = ? AND tahun = ? AND bulan = ? AND nominal_bayar > 0
           LIMIT 1`,
          [santriId, year, month]
        )

        if (legacySpp) {
          return {
            isLegacyManaged: true,
            reason: `Santri sudah memiliki histori pembayaran SPP sebesar Rp ${legacySpp.nominal_bayar.toLocaleString('id-ID')} pada spp_log (ID: ${legacySpp.id}).`,
          }
        }
      } catch {
        // Tabel spp_log mungkin tidak ada di environment pengujian terisolasi
      }
    }
  }

  // 3. Cek histori pembayaran pada tabel legacy pembayaran_tahunan
  if (itemType === 'EHB' || itemType === 'EKSKUL' || itemType === 'KESEHATAN') {
    const year = parseInt(period, 10)
    if (!isNaN(year)) {
      try {
        const legacyTahunan = await queryOne<{ id: string; nominal_bayar: number }>(
          `SELECT id, nominal_bayar
           FROM pembayaran_tahunan
           WHERE santri_id = ?
             AND jenis_biaya = ?
             AND (tahun_tagihan = ? OR tahun_tagihan IS NULL)
             AND COALESCE(status, 'AKTIF') != 'VOID'
           LIMIT 1`,
          [santriId, itemType, year]
        )

        if (legacyTahunan) {
          return {
            isLegacyManaged: true,
            reason: `Santri sudah memiliki histori pembayaran ${itemType} pada pembayaran_tahunan legacy (ID: ${legacyTahunan.id}).`,
          }
        }
      } catch {
        // Tabel pembayaran_tahunan mungkin tidak ada di environment pengujian terisolasi
      }
    }
  }

  // 4. Cek histori USPP (pada legacy dicatat sebagai jenis_biaya = 'BANGUNAN' di pembayaran_tahunan)
  // Keberadaan record pembayaran BANGUNAN saja TIDAK berarti kewajiban USPP sudah selesai;
  // HANYA jika sudah lunas sepenuhnya (atau dibebaskan), maka pembuatan kewajiban baru ditolak.
  if (itemType === 'USPP') {
    const usppStatus = await checkLegacyUsppStatus(santriId)
    if (usppStatus.isFullySettled) {
      return {
        isLegacyManaged: true,
        reason: `Kewajiban USPP santri sudah lunas sepenuhnya pada sistem legacy (Terbayar: Rp ${usppStatus.legacyPaid.toLocaleString('id-ID')} dari total tarif Rp ${usppStatus.totalTariff.toLocaleString('id-ID')}).`,
      }
    }
    // Jika belum pernah bayar atau baru dibayar sebagian, isLegacyManaged = false.
    // Sistem baru akan mematerialisasi sisa kewajiban santri secara akurat.
    return { isLegacyManaged: false }
  }

  return { isLegacyManaged: false }
}
