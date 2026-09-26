// lib/finance/distributions.ts
// Modul Fondasi & Engine Penyaluran Dana (Fase 7: PRD Bab 24 s.d. 29, Implementation Plan #3.4 & #8)
// Menjamin:
// 1. Penyaluran dana ke Bendahara Pesantren, Katering, dan Laundry.
// 2. Total penyaluran tidak pernah melebihi dana alokasi yang tersedia.
// 3. Penyaluran parsial bertahap dan multi-alokasi (FIFO) dieksekusi secara atomik (db.batch).
// 4. Histori hak penyaluran provider mengikuti snapshot periode transaksi (finance_allocations.provider_id).
// 5. Metode penyaluran TRANSFER (wajib nomor & bank tujuan) dan CASH.
// 6. Manajemen rekening bank penyedia jasa tanpa membuat master provider baru (mereuse master_jasa).
// 7. Modul rekalkulasi authoritatif (recalculateAllocationDisbursement).

import { query, queryOne, execute, batch, generateId, now } from '@/lib/db'
import { nonBillableSantriSqlPredicate, nonBillableItemSqlPredicate } from '@/lib/finance/non-billable-santri'
import type {
  FinanceDistribution,
  FinanceDistributionRecipientType,
  FinanceProviderAccount,
  DistributionKpiSummary,
  ProviderDistributionSummaryRow,
  BendaharaDistributionSummaryRow,
  CreateDistributionInput,
  CreateProviderAccountInput,
  UpdateProviderAccountInput,
  DistributionDetailWithItems,
  ProviderOperationalDetailRow,
  ProviderOperationalDetailResult,
  ProviderOperationalDetailParams,
  ProviderAccountTemplatePayload,
  ValidatedImportAccountRow,
  ProviderOperationalPaymentStatus,
  BendaharaItemStudentRow,
  BendaharaItemStudentsResult,
} from '@/lib/finance/distribution-types'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'
import { DEFAULT_FINANCE_PAGE_SIZE } from '@/lib/finance/constants'
import { getActiveTariff } from '@/lib/finance/tariffs'

export const BENDAHARA_ITEM_TYPES: FinanceItemType[] = [
  'SPP',
  'USPP',
  'EHB',
  'EKSKUL',
  'KESEHATAN',
]

/**
 * Format nomor referensi unik penyaluran: DIS-YYYYMMDD-XXXX
 */
export function generateDistributionNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `DIS-${datePart}-${randomSuffix}`
}

/**
 * Normalisasi format periode untuk pencocokan kewajiban:
 * - SPP / Makan / Cuci: YYYY-MM (contoh: 2026-09)
 * - USPP: 'LIFETIME'
 * - EHB / Ekskul / Kesehatan: YYYY (contoh: 2026)
 */
export function normalizeObligationPeriod(itemType: string, periodInput: string): string {
  if (itemType === 'USPP') {
    return 'LIFETIME'
  }
  if (['EHB', 'EKSKUL', 'KESEHATAN'].includes(itemType)) {
    return periodInput.slice(0, 4)
  }
  return periodInput
}

/**
 * Memeriksa apakah periode memenuhi syarat untuk fallback assignment santri aktif:
 * - Hanya periode berjalan (current) atau periode mendatang (future) yang diizinkan.
 * - Periode historis masa lalu TIDAK BOLEH merekonstruksi provider dari assignment santri hari ini.
 */
export function isPeriodEligibleForCurrentAssignment(
  period: string,
  overrideDate?: string
): boolean {
  const d = overrideDate ? new Date(overrideDate) : new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  })
  const currentPeriod = formatter.format(d)
  return period >= currentPeriod
}

/**
 * Mengambil ringkasan KPI Penyaluran (Dana Masuk, Disalurkan, Siap Disalurkan, dan Santri).
 */
export async function getDistributionSummary(
  recipientType: FinanceDistributionRecipientType,
  period: string,
  providerId?: string | null
): Promise<DistributionKpiSummary> {
  if (recipientType === 'BENDAHARA') {
    const itemTypes = BENDAHARA_ITEM_TYPES
    const inPlaceholders = itemTypes.map(() => '?').join(', ')
    const yearPrefix = period.slice(0, 4)

    // Agregasi dana bendahara net correction
    const fundAggPromise = queryOne<{
      total_amount: number
      total_disbursed: number
    }>(
      `
      SELECT
        COALESCE(SUM(
          a.amount - COALESCE((SELECT SUM(fci.amount) FROM finance_correction_items fci WHERE fci.target_allocation_id = a.id), 0)
        ), 0) AS total_amount,
        COALESCE(SUM(
          (SELECT COALESCE(SUM(di.amount), 0)
           FROM finance_distribution_items di
           WHERE di.allocation_id = a.id)
        ), 0) AS total_disbursed
      FROM finance_allocations a
      JOIN finance_payments p ON a.payment_id = p.id
      JOIN finance_obligations o ON a.obligation_id = o.id
      WHERE a.target_type = 'OBLIGATION'
        AND p.fund_management = 'KOPERASI'
        AND p.correction_status != 'FULLY_CORRECTED'
        AND a.item_type IN (${inPlaceholders})
        AND a.provider_id IS NULL
        AND (
          (a.item_type = 'SPP' AND o.period = ?)
          OR (a.item_type IN ('EHB', 'EKSKUL', 'KESEHATAN') AND o.period = ?)
          OR (a.item_type = 'USPP' AND o.period = 'LIFETIME')
        )
      `,
      [...itemTypes, period, yearPrefix]
    )

    const santriAggPromise = queryOne<{
      total_santri: number
      sudah_bayar: number
      bebas: number
    }>(
      `
      SELECT
        COUNT(DISTINCT o.santri_id) AS total_santri,
        COUNT(DISTINCT CASE 
          WHEN (o.amount_expected - o.amount_exempted) <= (
            CASE 
              WHEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) > 0 
              THEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) 
              ELSE 0 
            END
          ) AND (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) > 0 
          THEN o.santri_id 
        END) AS sudah_bayar,
        COUNT(DISTINCT CASE 
          WHEN o.amount_exempted >= o.amount_expected 
           AND (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) <= 0 
          THEN o.santri_id 
        END) AS bebas
      FROM finance_obligations o
      LEFT JOIN (
        SELECT fa.obligation_id, SUM(fa.amount) AS gross_paid
        FROM finance_allocations fa
        JOIN finance_payments fp ON fp.id = fa.payment_id
        WHERE fa.obligation_id IS NOT NULL AND fp.status IN ('PAID', 'SETTLED')
        GROUP BY fa.obligation_id
      ) alloc ON alloc.obligation_id = o.id
      LEFT JOIN (
        SELECT fci.obligation_id, SUM(fci.amount) AS total_corr
        FROM finance_correction_items fci
        WHERE fci.obligation_id IS NOT NULL
        GROUP BY fci.obligation_id
      ) corr ON corr.obligation_id = o.id
      WHERE o.item_type IN (${inPlaceholders})
        AND o.provider_id IS NULL
        AND (
          (o.item_type = 'SPP' AND o.period = ?)
          OR (o.item_type IN ('EHB', 'EKSKUL', 'KESEHATAN') AND o.period = ?)
          OR (o.item_type = 'USPP' AND o.period = 'LIFETIME')
        )
        AND ${nonBillableItemSqlPredicate(
          '(SELECT s.asrama FROM santri s WHERE s.id = o.santri_id)',
          '(SELECT s.kategori_santri FROM santri s WHERE s.id = o.santri_id)',
          'o.item_type'
        )}
      `,
      [...itemTypes, period, yearPrefix]
    )

    const [fundAgg, santriAgg] = await Promise.all([fundAggPromise, santriAggPromise])

    const totalDanaMasuk = fundAgg?.total_amount ?? 0
    const totalSudahDisalurkan = fundAgg?.total_disbursed ?? 0
    const totalSiapDisalurkan = Math.max(0, totalDanaMasuk - totalSudahDisalurkan)

    const totalSantriTerdaftar = santriAgg?.total_santri ?? 0
    const totalSantriSudahBayar = santriAgg?.sudah_bayar ?? 0
    const totalSantriBebas = santriAgg?.bebas ?? 0
    const totalSantriBelumBayar = Math.max(0, totalSantriTerdaftar - totalSantriSudahBayar - totalSantriBebas)

    return {
      totalDanaMasuk,
      totalSudahDisalurkan,
      totalSiapDisalurkan,
      totalSantriTerdaftar,
      totalSantriSudahBayar,
      totalSantriBelumBayar,
      totalSantriBebas,
    }
  }

  // KATERING atau LAUNDRY (Authoritative assignment + net allocations)
  const targetItemType = recipientType === 'KATERING' ? 'UANG_MAKAN' : 'UANG_NYUCI'
  const serviceCol = recipientType === 'KATERING' ? 's.tempat_makan_id' : 's.tempat_mencuci_id'

  const fundParams: unknown[] = [targetItemType]
  let fundProviderFilter = 'AND a.provider_id IS NOT NULL'
  if (providerId) {
    fundProviderFilter = 'AND a.provider_id = ?'
    fundParams.push(providerId)
  }
  fundParams.push(period)

  const fundAggPromise = queryOne<{
    total_amount: number
    total_disbursed: number
  }>(
    `
    SELECT
      COALESCE(SUM(
        a.amount - COALESCE((SELECT SUM(fci.amount) FROM finance_correction_items fci WHERE fci.target_allocation_id = a.id), 0)
      ), 0) AS total_amount,
      COALESCE(SUM(
        (SELECT COALESCE(SUM(di.amount), 0)
         FROM finance_distribution_items di
         WHERE di.allocation_id = a.id)
      ), 0) AS total_disbursed
    FROM finance_allocations a
    JOIN finance_payments p ON a.payment_id = p.id
    JOIN finance_obligations o ON a.obligation_id = o.id
    WHERE a.target_type = 'OBLIGATION'
      AND p.fund_management = 'KOPERASI'
      AND p.correction_status != 'FULLY_CORRECTED'
      AND a.item_type = ?
      ${fundProviderFilter}
      AND o.period = ?
    `,
    fundParams
  )

  const allowCurrentAssignmentFallback = isPeriodEligibleForCurrentAssignment(period)

  // Santri Stats via CTE (Snapshot historis + current assignment aktif)
  const santriParams: unknown[] = [targetItemType, period]
  let provClauseA = ''
  let provClauseB = ''
  if (providerId) {
    provClauseA = 'AND o.provider_id = ?'
    santriParams.push(providerId)
    provClauseB = `AND ${serviceCol} = ?`
  }
  santriParams.push(targetItemType, period)
  if (providerId) {
    santriParams.push(providerId)
  }

  const santriAggPromise = queryOne<{
    total_santri: number
    sudah_bayar: number
    bebas: number
    belum_bayar: number
  }>(
    `
    WITH assigned_students AS (
      -- A: Dari obligations yang sudah ada
      SELECT
        o.provider_id,
        o.santri_id,
        o.id AS obligation_id,
        o.amount_expected,
        o.amount_exempted,
        (CASE 
           WHEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) > 0 
           THEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) 
           ELSE 0 
         END) AS effective_paid
      FROM finance_obligations o
      LEFT JOIN (
        SELECT fa.obligation_id, SUM(fa.amount) AS gross_paid
        FROM finance_allocations fa
        JOIN finance_payments fp ON fp.id = fa.payment_id
        WHERE fa.obligation_id IS NOT NULL AND fp.status IN ('PAID', 'SETTLED')
        GROUP BY fa.obligation_id
      ) alloc ON alloc.obligation_id = o.id
      LEFT JOIN (
        SELECT fci.obligation_id, SUM(fci.amount) AS total_corr
        FROM finance_correction_items fci
        WHERE fci.obligation_id IS NOT NULL
        GROUP BY fci.obligation_id
      ) corr ON corr.obligation_id = o.id
      WHERE o.item_type = ? AND o.period = ? ${provClauseA}

      UNION ALL

      -- B: Santri aktif tanpa obligation untuk periode ini (hanya jika periode diizinkan)
      SELECT
        ${serviceCol} AS provider_id,
        s.id AS santri_id,
        NULL AS obligation_id,
        0 AS amount_expected,
        0 AS amount_exempted,
        0 AS effective_paid
      FROM santri s
      WHERE s.status_global = 'aktif'
        AND ${nonBillableSantriSqlPredicate('s.asrama')}
        AND ${nonBillableItemSqlPredicate('s.asrama', 's.kategori_santri', recipientType === 'KATERING' ? 'UANG_MAKAN' : 'UANG_NYUCI')}
        AND ${allowCurrentAssignmentFallback ? '1=1' : '1=0'}
        AND ${serviceCol} IS NOT NULL ${provClauseB}
        AND NOT EXISTS (
          SELECT 1 FROM finance_obligations fo
          WHERE fo.santri_id = s.id
            AND fo.item_type = ?
            AND fo.period = ?
        )
    )
    SELECT
      COUNT(DISTINCT santri_id) AS total_santri,
      COUNT(DISTINCT CASE 
        WHEN obligation_id IS NOT NULL 
         AND (amount_expected - amount_exempted) <= effective_paid 
         AND effective_paid > 0 
        THEN santri_id 
      END) AS sudah_bayar,
      COUNT(DISTINCT CASE 
        WHEN obligation_id IS NOT NULL 
         AND amount_exempted >= amount_expected 
         AND effective_paid = 0 
        THEN santri_id 
      END) AS bebas,
      COUNT(DISTINCT CASE 
        WHEN obligation_id IS NULL 
          OR (amount_expected - amount_exempted) > effective_paid 
        THEN santri_id 
      END) AS belum_bayar
    FROM assigned_students
    `,
    santriParams
  )

  const [fundAgg, santriAgg] = await Promise.all([fundAggPromise, santriAggPromise])

  const totalDanaMasuk = fundAgg?.total_amount ?? 0
  const totalSudahDisalurkan = fundAgg?.total_disbursed ?? 0
  const totalSiapDisalurkan = Math.max(0, totalDanaMasuk - totalSudahDisalurkan)

  const totalSantriTerdaftar = santriAgg?.total_santri ?? 0
  const totalSantriSudahBayar = santriAgg?.sudah_bayar ?? 0
  const totalSantriBebas = santriAgg?.bebas ?? 0
  const totalSantriBelumBayar = santriAgg?.belum_bayar ?? (totalSantriTerdaftar - totalSantriSudahBayar - totalSantriBebas)

  return {
    totalDanaMasuk,
    totalSudahDisalurkan,
    totalSiapDisalurkan,
    totalSantriTerdaftar,
    totalSantriSudahBayar,
    totalSantriBelumBayar,
    totalSantriBebas,
  }
}

/**
 * Mengambil daftar penyedia katering / laundry beserta status hak penyalurannya.
 * Dieksekusi secara batched (0 N+1 query loop).
 */
export async function getProviderDistributionList(
  recipientType: 'KATERING' | 'LAUNDRY',
  period: string
): Promise<ProviderDistributionSummaryRow[]> {
  const providerJenis = recipientType === 'KATERING' ? 'Makan' : 'Cuci'
  const targetItemType = recipientType === 'KATERING' ? 'UANG_MAKAN' : 'UANG_NYUCI'
  const serviceCol = recipientType === 'KATERING' ? 's.tempat_makan_id' : 's.tempat_mencuci_id'

  // 1. Ambil master vendor existing dari master_jasa
  const providers = await query<{
    id: string
    nama_jasa: string
    jenis: string
  }>(
    `
    SELECT id, nama_jasa, jenis
    FROM master_jasa
    WHERE jenis = ?
    ORDER BY nama_jasa ASC
    `,
    [providerJenis]
  )

  if (providers.length === 0) {
    return []
  }

  // 2. Query 2: Agregasi alokasi dana snapshot vendor untuk seluruh provider pada periode ini (0 N+1)
  const funds = await query<{
    provider_id: string
    total_amount: number
    total_disbursed: number
  }>(
    `
    SELECT
      a.provider_id,
      COALESCE(SUM(
        a.amount - COALESCE((SELECT SUM(fci.amount) FROM finance_correction_items fci WHERE fci.target_allocation_id = a.id), 0)
      ), 0) AS total_amount,
      COALESCE(SUM(
        (SELECT COALESCE(SUM(di.amount), 0)
         FROM finance_distribution_items di
         WHERE di.allocation_id = a.id)
      ), 0) AS total_disbursed
    FROM finance_allocations a
    JOIN finance_payments p ON a.payment_id = p.id
    JOIN finance_obligations o ON a.obligation_id = o.id
    WHERE a.target_type = 'OBLIGATION'
      AND p.fund_management = 'KOPERASI'
      AND p.correction_status != 'FULLY_CORRECTED'
      AND a.item_type = ?
      AND o.period = ?
      AND a.provider_id IS NOT NULL
    GROUP BY a.provider_id
    `,
    [targetItemType, period]
  )

  const fundMap = new Map<string, { totalDanaMasuk: number; sudahDisalurkan: number }>()
  for (const f of funds) {
    fundMap.set(f.provider_id, {
      totalDanaMasuk: f.total_amount,
      sudahDisalurkan: f.total_disbursed,
    })
  }

  // 3. Query 3: Agregasi santri terdaftar, sudah bayar, belum bayar, dan pembebasan seluruh provider (0 N+1)
  const allowCurrentAssignmentFallback = isPeriodEligibleForCurrentAssignment(period)

  const santriStats = await query<{
    provider_id: string
    total_santri: number
    sudah_bayar: number
    bebas: number
    belum_bayar: number
  }>(
    `
    WITH assigned_students AS (
      -- A: Dari obligations yang sudah ada
      SELECT
        o.provider_id,
        o.santri_id,
        o.id AS obligation_id,
        o.amount_expected,
        o.amount_exempted,
        (CASE 
           WHEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) > 0 
           THEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) 
           ELSE 0 
         END) AS effective_paid
      FROM finance_obligations o
      LEFT JOIN (
        SELECT fa.obligation_id, SUM(fa.amount) AS gross_paid
        FROM finance_allocations fa
        JOIN finance_payments fp ON fp.id = fa.payment_id
        WHERE fa.obligation_id IS NOT NULL AND fp.status IN ('PAID', 'SETTLED')
        GROUP BY fa.obligation_id
      ) alloc ON alloc.obligation_id = o.id
      LEFT JOIN (
        SELECT fci.obligation_id, SUM(fci.amount) AS total_corr
        FROM finance_correction_items fci
        WHERE fci.obligation_id IS NOT NULL
        GROUP BY fci.obligation_id
      ) corr ON corr.obligation_id = o.id
      WHERE o.item_type = ? AND o.period = ? AND o.provider_id IS NOT NULL

      UNION ALL

      -- B: Dari santri aktif yang belum punya obligation untuk periode ini (hanya jika periode diizinkan)
      SELECT
        ${serviceCol} AS provider_id,
        s.id AS santri_id,
        NULL AS obligation_id,
        0 AS amount_expected,
        0 AS amount_exempted,
        0 AS effective_paid
      FROM santri s
      WHERE s.status_global = 'aktif'
        AND ${nonBillableSantriSqlPredicate('s.asrama')}
        AND ${nonBillableItemSqlPredicate('s.asrama', 's.kategori_santri', recipientType === 'KATERING' ? 'UANG_MAKAN' : 'UANG_NYUCI')}
        AND ${allowCurrentAssignmentFallback ? '1=1' : '1=0'}
        AND ${serviceCol} IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM finance_obligations fo
          WHERE fo.santri_id = s.id
            AND fo.item_type = ?
            AND fo.period = ?
        )
    )
    SELECT
      provider_id,
      COUNT(DISTINCT santri_id) AS total_santri,
      COUNT(DISTINCT CASE 
        WHEN obligation_id IS NOT NULL 
         AND (amount_expected - amount_exempted) <= effective_paid 
         AND effective_paid > 0 
        THEN santri_id 
      END) AS sudah_bayar,
      COUNT(DISTINCT CASE 
        WHEN obligation_id IS NOT NULL 
         AND amount_exempted >= amount_expected 
         AND effective_paid = 0 
        THEN santri_id 
      END) AS bebas,
      COUNT(DISTINCT CASE 
        WHEN obligation_id IS NULL 
          OR (amount_expected - amount_exempted) > effective_paid 
        THEN santri_id 
      END) AS belum_bayar
    FROM assigned_students
    GROUP BY provider_id
    `,
    [targetItemType, period, targetItemType, period]
  )

  const santriMap = new Map<
    string,
    {
      totalSantri: number
      sudahBayar: number
      bebas: number
      belumBayar: number
    }
  >()
  for (const s of santriStats) {
    santriMap.set(s.provider_id, {
      totalSantri: s.total_santri,
      sudahBayar: s.sudah_bayar,
      bebas: s.bebas,
      belumBayar: s.belum_bayar,
    })
  }

  // 4. Query 4: Ambil seluruh rekening penyedia dalam satu batch (0 N+1)
  const allAccounts = await query<FinanceProviderAccount>(
    `
    SELECT id, provider_id, bank_name, account_number, account_holder, is_primary, notes, created_at, updated_at
    FROM finance_provider_accounts
    ORDER BY is_primary DESC, created_at ASC
    `
  )

  const accountMap = new Map<string, FinanceProviderAccount[]>()
  for (const acc of allAccounts) {
    const list = accountMap.get(acc.provider_id) || []
    list.push(acc)
    accountMap.set(acc.provider_id, list)
  }

  // 5. Rakit hasil agregasi
  const result: ProviderDistributionSummaryRow[] = []

  for (const p of providers) {
    const f = fundMap.get(p.id) || { totalDanaMasuk: 0, sudahDisalurkan: 0 }
    const s = santriMap.get(p.id) || { totalSantri: 0, sudahBayar: 0, bebas: 0, belumBayar: 0 }
    const accs = accountMap.get(p.id) || []
    const primaryAccount = accs.find((a) => a.is_primary === 1) || accs[0] || null

    const totalDanaMasuk = f.totalDanaMasuk
    const sudahDisalurkan = f.sudahDisalurkan
    const sisaSiapSalur = Math.max(0, totalDanaMasuk - sudahDisalurkan)

    result.push({
      providerId: p.id,
      providerName: p.nama_jasa,
      providerType: p.jenis as 'Makan' | 'Cuci',
      santriTerdaftar: s.totalSantri,
      santriSudahBayar: s.sudahBayar,
      santriBelumBayar: s.belumBayar,
      santriBebas: s.bebas,
      totalDanaMasuk,
      sudahDisalurkan,
      sisaSiapSalur,
      primaryAccount,
      accountsCount: accs.length,
    })
  }

  return result
}

/**
 * Mengambil ringkasan penyaluran per pos item untuk Bendahara Pesantren.
 */
export async function getBendaharaDistributionList(
  period: string
): Promise<BendaharaDistributionSummaryRow[]> {
  const result: BendaharaDistributionSummaryRow[] = []

  for (const itemType of BENDAHARA_ITEM_TYPES) {
    const periodForObligation = normalizeObligationPeriod(itemType, period)

    const fundAgg = await queryOne<{
      total_amount: number
      total_disbursed: number
    }>(
      `
      SELECT
        COALESCE(SUM(a.amount), 0) AS total_amount,
        COALESCE(SUM(
          (SELECT COALESCE(SUM(di.amount), 0)
           FROM finance_distribution_items di
           WHERE di.allocation_id = a.id)
        ), 0) AS total_disbursed
      FROM finance_allocations a
      JOIN finance_payments p ON a.payment_id = p.id
      JOIN finance_obligations o ON a.obligation_id = o.id
      WHERE a.target_type = 'OBLIGATION'
        AND p.fund_management = 'KOPERASI'
        AND p.correction_status != 'FULLY_CORRECTED'
        AND a.item_type = ?
        AND a.provider_id IS NULL
        AND o.period = ?
      `,
      [itemType, periodForObligation]
    )

    const totalDanaMasuk = fundAgg?.total_amount ?? 0
    const sudahDisalurkan = fundAgg?.total_disbursed ?? 0
    const sisaSiapSalur = Math.max(0, totalDanaMasuk - sudahDisalurkan)

    const santriAgg = await queryOne<{
      total_santri: number
      sudah_bayar: number
    }>(
      `
      SELECT
        COUNT(DISTINCT o.santri_id) AS total_santri,
        COUNT(DISTINCT CASE WHEN o.status = 'PAID' OR o.amount_paid > 0 THEN o.santri_id END) AS sudah_bayar
      FROM finance_obligations o
      WHERE o.item_type = ?
        AND o.provider_id IS NULL
        AND o.period = ?
        AND ${nonBillableItemSqlPredicate(
          '(SELECT s.asrama FROM santri s WHERE s.id = o.santri_id)',
          '(SELECT s.kategori_santri FROM santri s WHERE s.id = o.santri_id)',
          'o.item_type'
        )}
      `,
      [itemType, periodForObligation]
    )

    const santriTerdaftar = santriAgg?.total_santri ?? 0
    const santriSudahBayar = santriAgg?.sudah_bayar ?? 0
    const santriBelumBayar = Math.max(0, santriTerdaftar - santriSudahBayar)

    result.push({
      itemType,
      itemLabel: FINANCE_ITEM_LABELS[itemType] || itemType,
      period: periodForObligation,
      santriTerdaftar,
      santriSudahBayar,
      santriBelumBayar,
      totalDanaMasuk,
      sudahDisalurkan,
      sisaSiapSalur,
    })
  }

  return result
}

export type BendaharaUnpaidStudentRow = BendaharaItemStudentRow
export type BendaharaUnpaidStudentsResult = BendaharaItemStudentsResult

/**
 * Rincian santri pada satu pos Bendahara Pesantren untuk periode tertentu,
 * dengan penanda siapa yang belum membayar. Dipakai untuk drill-down dari
 * ringkasan "Santri Bayar / Terdaftar" pada modul Penyaluran.
 *
 * Santri bebas tagihan (AL-BAGHORY / kategori SADESA) selalu dikecualikan.
 */
export async function getBendaharaStudentsByItem(
  params: {
    itemType: string
    period: string
    status?: 'ALL' | 'BELUM_BAYAR' | 'SUDAH_BAYAR'
    search?: string
    page?: number
    pageSize?: number
  }
): Promise<BendaharaUnpaidStudentsResult> {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, Math.min(200, params.pageSize ?? 25))
  const offset = (page - 1) * pageSize
  const periodForObligation = normalizeObligationPeriod(params.itemType, params.period)

  const netPaidSql = `MAX(
    0,
    (SELECT COALESCE(SUM(a.amount), 0) FROM finance_allocations a WHERE a.obligation_id = o.id)
    - (SELECT COALESCE(SUM(fci.amount), 0) FROM finance_correction_items fci WHERE fci.obligation_id = o.id)
  )`
  const remainingSql = `MAX(0, (o.amount_expected - o.amount_exempted) - ${netPaidSql})`

  // Definisi "sudah bayar" WAJIB identik dengan agregat pada getBendaharaDistributionList
  // (o.status = 'PAID' OR o.amount_paid > 0) agar jumlah pada tabel dan drill-down selalu sama.
  const sudahBayarSql = `(o.status = 'PAID' OR o.amount_paid > 0)`
  const statusBayarSql = `CASE
    WHEN ${sudahBayarSql} THEN 'SUDAH_BAYAR'
    WHEN ${remainingSql} <= 0 THEN 'SUDAH_BAYAR'
    ELSE 'BELUM_BAYAR'
  END`

  const conditions: string[] = [
    'o.item_type = ?',
    'o.period = ?',
    'o.provider_id IS NULL',
    // AL-BAGHORY (bebas total) dan SADESA (bebas UANG_MAKAN/UANG_NYUCI) tidak muncul
    nonBillableSantriSqlPredicate('s.asrama'),
    nonBillableItemSqlPredicate('s.asrama', 's.kategori_santri', 'o.item_type'),
  ]
  const queryParams: unknown[] = [params.itemType, periodForObligation]

  const statusFilter = params.status ?? 'ALL'
  if (statusFilter === 'BELUM_BAYAR') {
    conditions.push(`(${statusBayarSql}) = 'BELUM_BAYAR'`)
  } else if (statusFilter === 'SUDAH_BAYAR') {
    conditions.push(`(${statusBayarSql}) = 'SUDAH_BAYAR'`)
  }

  const search = (params.search ?? '').trim()
  if (search) {
    conditions.push('(s.nama_lengkap LIKE ? OR s.nis LIKE ?)')
    queryParams.push(`%${search}%`, `%${search}%`)
  }

  const whereSql = conditions.join(' AND ')
  const fromSql = `
    FROM finance_obligations o
    JOIN santri s ON s.id = o.santri_id
    LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
    LEFT JOIN kelas k ON k.id = rp.kelas_id
  `

  const countRow = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total ${fromSql} WHERE ${whereSql}`,
    queryParams
  )
  const totalCount = countRow?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const rows = await query<{
    santri_id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    kelas: string | null
    status: string
    amount_expected: number
    amount_exempted: number
    amount_paid: number
    net_paid: number
    status_bayar: string
  }>(
    `SELECT
       s.id AS santri_id,
       s.nis,
       s.nama_lengkap,
       s.asrama,
       s.kamar,
       COALESCE(k.nama_kelas, s.kelas_sekolah) AS kelas,
       o.status,
       o.amount_expected,
       o.amount_exempted,
       o.amount_paid,
       ${netPaidSql} AS net_paid,
       ${statusBayarSql} AS status_bayar
     ${fromSql}
     WHERE ${whereSql}
     ORDER BY s.nama_lengkap ASC
     LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  )

  const items: BendaharaUnpaidStudentRow[] = rows.map((r) => ({
    santriId: r.santri_id,
    nis: r.nis,
    namaLengkap: r.nama_lengkap,
    asrama: r.asrama,
    kamar: r.kamar,
    kelas: r.kelas,
    status: r.status,
    statusBayar: r.status_bayar === 'SUDAH_BAYAR' ? 'SUDAH_BAYAR' : 'BELUM_BAYAR',
    amountExpected: r.amount_expected ?? 0,
    amountExempted: r.amount_exempted ?? 0,
    amountPaid: r.net_paid ?? 0,
    remaining: Math.max(0, (r.amount_expected ?? 0) - (r.amount_exempted ?? 0) - (r.net_paid ?? 0)),
  }))

  return { items, totalCount, page, pageSize, totalPages }
}

/**
 * Mengambil alokasi dana yang siap disalurkan (UNDISBURSED atau PARTIALLY_DISBURSED)
 * untuk slicing penyaluran FIFO.
 */
export async function getEligibleAllocationsForDistribution(params: {
  recipientType: FinanceDistributionRecipientType
  itemType: string
  period: string
  providerId?: string | null
}): Promise<
  Array<{
    id: string
    payment_id: string
    obligation_id: string
    item_type: string
    amount: number
    disbursed_amount: number
    available_amount: number
    distribution_status: string
    created_at: string
  }>
> {
  const normPeriod = normalizeObligationPeriod(params.itemType, params.period)
  const queryParams: unknown[] = [params.itemType, normPeriod]

  let providerClause = ''
  if (params.recipientType !== 'BENDAHARA' && params.providerId) {
    providerClause = 'AND a.provider_id = ?'
    queryParams.push(params.providerId)
  } else {
    providerClause = 'AND a.provider_id IS NULL'
  }

  const rows = await query<{
    id: string
    payment_id: string
    obligation_id: string
    item_type: string
    amount: number
    disbursed_amount: number
    available_amount: number
    distribution_status: string
    created_at: string
  }>(
    `
    SELECT
      a.id,
      a.payment_id,
      a.obligation_id,
      a.item_type,
      (a.amount - COALESCE((
        SELECT SUM(fci.amount)
        FROM finance_correction_items fci
        WHERE fci.target_allocation_id = a.id
      ), 0)) AS amount,
      COALESCE((
        SELECT SUM(di.amount)
        FROM finance_distribution_items di
        WHERE di.allocation_id = a.id
      ), 0) AS disbursed_amount,
      ((a.amount - COALESCE((
        SELECT SUM(fci.amount)
        FROM finance_correction_items fci
        WHERE fci.target_allocation_id = a.id
      ), 0)) - COALESCE((
        SELECT SUM(di.amount)
        FROM finance_distribution_items di
        WHERE di.allocation_id = a.id
      ), 0)) AS available_amount,
      a.distribution_status,
      a.created_at
    FROM finance_allocations a
    JOIN finance_payments p ON a.payment_id = p.id
    JOIN finance_obligations o ON a.obligation_id = o.id
    WHERE a.target_type = 'OBLIGATION'
      AND p.fund_management = 'KOPERASI'
      AND p.correction_status != 'FULLY_CORRECTED'
      AND a.item_type = ?
      AND o.period = ?
      AND ((a.amount - COALESCE((
        SELECT SUM(fci.amount)
        FROM finance_correction_items fci
        WHERE fci.target_allocation_id = a.id
      ), 0)) - COALESCE((
        SELECT SUM(di.amount)
        FROM finance_distribution_items di
        WHERE di.allocation_id = a.id
      ), 0)) > 0
      ${providerClause}
    ORDER BY a.created_at ASC, a.id ASC
    `,
    queryParams
  )

  return rows
}

/**
 * Eksekusi Penyaluran Dana (Atomik & Concurrency-Safe).
 * Memotong alokasi secara FIFO, memvalidasi limit dana siap salur,
 * dan merangkai mutasi ke finance_distributions & finance_distribution_items.
 */
export async function executeDistribution(
  input: CreateDistributionInput
): Promise<FinanceDistribution> {
  const amountToDisburse = Math.floor(input.amount)
  if (amountToDisburse <= 0 || !Number.isFinite(amountToDisburse)) {
    throw new Error('Nominal penyaluran harus berupa bilangan bulat positif lebih besar dari 0.')
  }

  if (!['TRANSFER', 'CASH'].includes(input.method)) {
    throw new Error(`Metode penyaluran tidak valid: "${input.method}". Wajib 'TRANSFER' atau 'CASH'.`)
  }

  if (input.method === 'TRANSFER') {
    if (!input.destinationBank || input.destinationBank.trim().length === 0) {
      throw new Error('Penyaluran via TRANSFER wajib mencantumkan nama bank tujuan.')
    }
    if (!input.destinationAccount || input.destinationAccount.trim().length === 0) {
      throw new Error('Penyaluran via TRANSFER wajib mencantumkan nomor rekening tujuan.')
    }
    if (!input.accountHolderName || input.accountHolderName.trim().length === 0) {
      throw new Error('Penyaluran via TRANSFER wajib mencantumkan nama pemilik rekening tujuan.')
    }
  }

  // Validasi Recipient
  if (input.recipientType === 'BENDAHARA') {
    if (!BENDAHARA_ITEM_TYPES.includes(input.itemType as FinanceItemType)) {
      throw new Error(`Item "${input.itemType}" bukan merupakan pos dana Bendahara Pesantren.`)
    }
  } else {
    if (!input.recipientId) {
      throw new Error(`Penyaluran ke ${input.recipientType} wajib menyertakan ID penyedia.`)
    }
    const expectedJenis = input.recipientType === 'KATERING' ? 'Makan' : 'Cuci'
    const expectedItem = input.recipientType === 'KATERING' ? 'UANG_MAKAN' : 'UANG_NYUCI'

    if (input.itemType !== expectedItem) {
      throw new Error(
        `Item "${input.itemType}" tidak sesuai untuk penyedia ${input.recipientType} (wajib "${expectedItem}").`
      )
    }

    const provider = await queryOne<{ id: string; nama_jasa: string }>(
      `SELECT id, nama_jasa FROM master_jasa WHERE id = ? AND jenis = ?`,
      [input.recipientId, expectedJenis]
    )
    if (!provider) {
      throw new Error(`Penyedia jasa "${input.recipientId}" tidak ditemukan atau jenisnya bukan "${expectedJenis}".`)
    }
  }

  // Ambil alokasi eligible (FIFO)
  const normPeriod = normalizeObligationPeriod(input.itemType, input.period)
  const eligibleAllocations = await getEligibleAllocationsForDistribution({
    recipientType: input.recipientType,
    itemType: input.itemType,
    period: normPeriod,
    providerId: input.recipientType !== 'BENDAHARA' ? input.recipientId : null,
  })

  const totalAvailable = eligibleAllocations.reduce((acc, row) => acc + row.available_amount, 0)
  if (amountToDisburse > totalAvailable) {
    throw new Error(
      `Nominal penyaluran (Rp ${amountToDisburse.toLocaleString('id-ID')}) melebihi total dana siap salur yang tersedia (Rp ${totalAvailable.toLocaleString('id-ID')}).`
    )
  }

  const distributionId = generateId()
  const distributionNumber = generateDistributionNumber()
  const transferredAt = input.transferredAt || now()
  const createdAt = now()

  const destinationBank = input.method === 'TRANSFER' ? input.destinationBank!.trim() : null
  const destinationAccount = input.method === 'TRANSFER' ? input.destinationAccount!.trim() : null
  const accountHolderName = input.method === 'TRANSFER' ? input.accountHolderName!.trim() : null

  const statements: Array<{ sql: string; params?: unknown[] }> = []

  // 1. Insert header finance_distributions
  statements.push({
    sql: `
      INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id,
        item_type, period, total_amount, method,
        destination_bank, destination_account, account_holder_name,
        proof_attachment_url, transferred_by, transferred_at, notes, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      distributionId,
      distributionNumber,
      input.recipientType,
      input.recipientType !== 'BENDAHARA' ? input.recipientId : null,
      input.itemType,
      normPeriod,
      amountToDisburse,
      input.method,
      destinationBank,
      destinationAccount,
      accountHolderName,
      input.proofAttachmentUrl || null,
      input.transferredBy,
      transferredAt,
      input.notes || null,
      createdAt,
    ],
  })

  // 2. Slicing alokasi secara FIFO
  let remainingAmount = amountToDisburse

  for (const alloc of eligibleAllocations) {
    if (remainingAmount <= 0) break

    const slice = Math.min(remainingAmount, alloc.available_amount)
    const itemId = generateId()

    // Insert distribution item
    statements.push({
      sql: `
        INSERT INTO finance_distribution_items (
          id, distribution_id, allocation_id, amount, created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      params: [itemId, distributionId, alloc.id, slice, transferredAt],
    })

    // Update allocation (disbursed_amount & distribution_status) secara authoritatif
    statements.push({
      sql: `
        UPDATE finance_allocations
        SET disbursed_amount = (
              SELECT COALESCE(SUM(amount), 0)
              FROM finance_distribution_items
              WHERE allocation_id = ?
            ),
            distribution_status = CASE
              WHEN (
                SELECT COALESCE(SUM(amount), 0)
                FROM finance_distribution_items
                WHERE allocation_id = ?
              ) >= amount THEN 'DISBURSED'
              WHEN (
                SELECT COALESCE(SUM(amount), 0)
                FROM finance_distribution_items
                WHERE allocation_id = ?
              ) > 0 THEN 'PARTIALLY_DISBURSED'
              ELSE 'UNDISBURSED'
            END
        WHERE id = ?
      `,
      params: [alloc.id, alloc.id, alloc.id, alloc.id],
    })

    remainingAmount -= slice
  }

  // Eksekusi atomik seluruh mutasi batch
  await batch(statements)

  return {
    id: distributionId,
    distribution_number: distributionNumber,
    recipient_type: input.recipientType,
    recipient_id: input.recipientType !== 'BENDAHARA' ? input.recipientId ?? null : null,
    item_type: input.itemType,
    period: normPeriod,
    total_amount: amountToDisburse,
    method: input.method,
    destination_bank: destinationBank,
    destination_account: destinationAccount,
    account_holder_name: accountHolderName,
    proof_attachment_url: input.proofAttachmentUrl || null,
    transferred_by: input.transferredBy,
    transferred_at: transferredAt,
    notes: input.notes || null,
    created_at: createdAt,
  }
}

/**
 * Rekalkulasi Authoritatif Status Penyaluran Alokasi.
 * Menjamin derived cache disbursed_amount dan distribution_status
 * selalu identik dengan SUM(finance_distribution_items.amount).
 */
export async function recalculateAllocationDisbursement(
  allocationId: string
): Promise<{
  allocationId: string
  amount: number
  authoritativeDisbursed: number
  newStatus: string
}> {
  const allocation = await queryOne<{
    id: string
    amount: number
  }>(`SELECT id, amount FROM finance_allocations WHERE id = ?`, [allocationId])

  if (!allocation) {
    throw new Error(`Alokasi dengan ID "${allocationId}" tidak ditemukan.`)
  }

  const itemSum = await queryOne<{ total: number }>(
    `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM finance_distribution_items
    WHERE allocation_id = ?
    `,
    [allocationId]
  )

  const authoritativeDisbursed = itemSum?.total ?? 0
  let newStatus = 'UNDISBURSED'
  if (authoritativeDisbursed >= allocation.amount) {
    newStatus = 'DISBURSED'
  } else if (authoritativeDisbursed > 0) {
    newStatus = 'PARTIALLY_DISBURSED'
  }

  await execute(
    `
    UPDATE finance_allocations
    SET disbursed_amount = ?,
        distribution_status = ?
    WHERE id = ?
    `,
    [authoritativeDisbursed, newStatus, allocationId]
  )

  return {
    allocationId,
    amount: allocation.amount,
    authoritativeDisbursed,
    newStatus,
  }
}

// ─── REKENING BANK PENYEDIA (PROVIDER ACCOUNTS) ─────────────────────────────

export async function getProviderAccounts(
  providerId: string
): Promise<FinanceProviderAccount[]> {
  return query<FinanceProviderAccount>(
    `
    SELECT
      a.id, a.provider_id, a.bank_name, a.account_number, a.account_holder,
      a.is_primary, a.notes, a.created_at, a.updated_at,
      j.nama_jasa AS provider_name, j.jenis AS provider_type
    FROM finance_provider_accounts a
    JOIN master_jasa j ON a.provider_id = j.id
    WHERE a.provider_id = ?
    ORDER BY a.is_primary DESC, a.created_at ASC
    `,
    [providerId]
  )
}

export async function createProviderAccount(
  input: CreateProviderAccountInput
): Promise<FinanceProviderAccount> {
  const provider = await queryOne<{ id: string; nama_jasa: string; jenis: string }>(
    `SELECT id, nama_jasa, jenis FROM master_jasa WHERE id = ?`,
    [input.providerId]
  )
  if (!provider) {
    throw new Error(`Penyedia dengan ID "${input.providerId}" tidak ditemukan pada master_jasa.`)
  }

  if (!input.bankName || input.bankName.trim().length === 0) {
    throw new Error('Nama bank wajib diisi.')
  }
  if (!input.accountNumber || input.accountNumber.trim().length === 0) {
    throw new Error('Nomor rekening wajib diisi.')
  }
  if (!input.accountHolder || input.accountHolder.trim().length === 0) {
    throw new Error('Nama pemilik rekening wajib diisi.')
  }

  const id = generateId()
  const currentNow = now()
  const isPrimaryVal = input.isPrimary ? 1 : 0

  const statements: Array<{ sql: string; params?: unknown[] }> = []

  // Jika diset primary, reset primary existing untuk provider ini
  if (isPrimaryVal === 1) {
    statements.push({
      sql: `UPDATE finance_provider_accounts SET is_primary = 0 WHERE provider_id = ?`,
      params: [input.providerId],
    })
  }

  statements.push({
    sql: `
      INSERT INTO finance_provider_accounts (
        id, provider_id, bank_name, account_number, account_holder,
        is_primary, notes, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      id,
      input.providerId,
      input.bankName.trim(),
      input.accountNumber.trim(),
      input.accountHolder.trim(),
      isPrimaryVal,
      input.notes?.trim() || null,
      currentNow,
      currentNow,
    ],
  })

  await batch(statements)

  return {
    id,
    provider_id: input.providerId,
    provider_name: provider.nama_jasa,
    provider_type: provider.jenis,
    bank_name: input.bankName.trim(),
    account_number: input.accountNumber.trim(),
    account_holder: input.accountHolder.trim(),
    is_primary: isPrimaryVal,
    notes: input.notes?.trim() || null,
    created_at: currentNow,
    updated_at: currentNow,
  }
}

export async function updateProviderAccount(
  input: UpdateProviderAccountInput
): Promise<FinanceProviderAccount> {
  const existing = await queryOne<FinanceProviderAccount>(
    `SELECT * FROM finance_provider_accounts WHERE id = ?`,
    [input.id]
  )
  if (!existing) {
    throw new Error(`Rekening dengan ID "${input.id}" tidak ditemukan.`)
  }

  if (!input.bankName || input.bankName.trim().length === 0) {
    throw new Error('Nama bank wajib diisi.')
  }
  if (!input.accountNumber || input.accountNumber.trim().length === 0) {
    throw new Error('Nomor rekening wajib diisi.')
  }
  if (!input.accountHolder || input.accountHolder.trim().length === 0) {
    throw new Error('Nama pemilik rekening wajib diisi.')
  }

  const currentNow = now()
  const isPrimaryVal = input.isPrimary ? 1 : 0
  const statements: Array<{ sql: string; params?: unknown[] }> = []

  if (isPrimaryVal === 1) {
    statements.push({
      sql: `UPDATE finance_provider_accounts SET is_primary = 0 WHERE provider_id = ?`,
      params: [existing.provider_id],
    })
  }

  statements.push({
    sql: `
      UPDATE finance_provider_accounts
      SET bank_name = ?,
          account_number = ?,
          account_holder = ?,
          is_primary = ?,
          notes = ?,
          updated_at = ?
      WHERE id = ?
    `,
    params: [
      input.bankName.trim(),
      input.accountNumber.trim(),
      input.accountHolder.trim(),
      isPrimaryVal,
      input.notes?.trim() || null,
      currentNow,
      input.id,
    ],
  })

  await batch(statements)

  return {
    ...existing,
    bank_name: input.bankName.trim(),
    account_number: input.accountNumber.trim(),
    account_holder: input.accountHolder.trim(),
    is_primary: isPrimaryVal,
    notes: input.notes?.trim() || null,
    updated_at: currentNow,
  }
}

export async function deleteProviderAccount(id: string): Promise<void> {
  await execute(`DELETE FROM finance_provider_accounts WHERE id = ?`, [id])
}

// ─── RIWAYAT PENYALURAN & BUKTI SLIP ────────────────────────────────────────

export interface DistributionHistoryFilter {
  recipientType?: FinanceDistributionRecipientType | 'ALL'
  itemType?: string
  period?: string
  search?: string
  page?: number
  pageSize?: number
}

export async function getDistributionHistory(filter: DistributionHistoryFilter = {}): Promise<{
  items: Array<FinanceDistribution & { recipient_name: string; operator_name: string }>
  totalItems: number
  totalPages: number
  page: number
  pageSize: number
}> {
  const page = Math.max(1, filter.page || 1)
  const pageSize = Math.max(1, filter.pageSize || DEFAULT_FINANCE_PAGE_SIZE)
  const offset = (page - 1) * pageSize

  const conditions: string[] = ['1=1']
  const params: unknown[] = []

  if (filter.recipientType && filter.recipientType !== 'ALL') {
    conditions.push('d.recipient_type = ?')
    params.push(filter.recipientType)
  }

  if (filter.itemType && filter.itemType !== 'ALL') {
    conditions.push('d.item_type = ?')
    params.push(filter.itemType)
  }

  if (filter.period) {
    conditions.push('d.period = ?')
    params.push(filter.period)
  }

  if (filter.search && filter.search.trim().length > 0) {
    const s = `%${filter.search.trim().toLowerCase()}%`
    conditions.push(`(
      LOWER(d.distribution_number) LIKE ?
      OR LOWER(COALESCE(j.nama_jasa, 'Bendahara Pesantren')) LIKE ?
      OR LOWER(COALESCE(u.full_name, '')) LIKE ?
      OR LOWER(COALESCE(d.destination_bank, '')) LIKE ?
      OR LOWER(COALESCE(d.destination_account, '')) LIKE ?
      OR LOWER(COALESCE(d.account_holder_name, '')) LIKE ?
    )`)
    params.push(s, s, s, s, s, s)
  }

  const whereClause = conditions.join(' AND ')

  const countRow = await queryOne<{ total: number }>(
    `
    SELECT COUNT(*) AS total
    FROM finance_distributions d
    LEFT JOIN master_jasa j ON d.recipient_id = j.id
    LEFT JOIN users u ON d.transferred_by = u.id
    WHERE ${whereClause}
    `,
    params
  )

  const totalItems = countRow?.total ?? 0
  const totalPages = Math.ceil(totalItems / pageSize) || 1

  const rows = await query<FinanceDistribution & { recipient_name: string; operator_name: string }>(
    `
    SELECT
      d.id,
      d.distribution_number,
      d.recipient_type,
      d.recipient_id,
      d.item_type,
      d.period,
      d.total_amount,
      d.method,
      d.destination_bank,
      d.destination_account,
      d.account_holder_name,
      d.proof_attachment_url,
      d.transferred_by,
      d.transferred_at,
      d.notes,
      d.created_at,
      CASE
        WHEN d.recipient_type = 'BENDAHARA' THEN 'Bendahara Pesantren'
        ELSE COALESCE(j.nama_jasa, d.recipient_type)
      END AS recipient_name,
      COALESCE(u.full_name, d.transferred_by) AS operator_name
    FROM finance_distributions d
    LEFT JOIN master_jasa j ON d.recipient_id = j.id
    LEFT JOIN users u ON d.transferred_by = u.id
    WHERE ${whereClause}
    ORDER BY d.transferred_at DESC, d.created_at DESC
    LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset]
  )

  return {
    items: rows,
    totalItems,
    totalPages,
    page,
    pageSize,
  }
}

/**
 * Mengambil data detail lengkap transaksi penyaluran beserta rincian santri per alokasi
 * untuk kebutuhan preview dan pencetakan Bukti Penyaluran (Receipt).
 */
export async function getDistributionById(
  id: string
): Promise<DistributionDetailWithItems | null> {
  const dist = await queryOne<FinanceDistribution & { recipient_name: string; operator_name: string }>(
    `
    SELECT
      d.id,
      d.distribution_number,
      d.recipient_type,
      d.recipient_id,
      d.item_type,
      d.period,
      d.total_amount,
      d.method,
      d.destination_bank,
      d.destination_account,
      d.account_holder_name,
      d.proof_attachment_url,
      d.transferred_by,
      d.transferred_at,
      d.notes,
      d.created_at,
      CASE
        WHEN d.recipient_type = 'BENDAHARA' THEN 'Bendahara Pesantren'
        ELSE COALESCE(j.nama_jasa, d.recipient_type)
      END AS recipient_name,
      COALESCE(u.full_name, d.transferred_by) AS operator_name
    FROM finance_distributions d
    LEFT JOIN master_jasa j ON d.recipient_id = j.id
    LEFT JOIN users u ON d.transferred_by = u.id
    WHERE d.id = ?
    `,
    [id]
  )

  if (!dist) return null

  const items = await query<{
    id: string
    allocation_id: string
    amount: number
    santri_id: string
    santri_name: string
    santri_nis: string
    created_at: string
  }>(
    `
    SELECT
      di.id,
      di.allocation_id,
      di.amount,
      o.santri_id,
      s.nama_lengkap AS santri_name,
      s.nis AS santri_nis,
      di.created_at
    FROM finance_distribution_items di
    JOIN finance_allocations a ON di.allocation_id = a.id
    JOIN finance_obligations o ON a.obligation_id = o.id
    JOIN santri s ON o.santri_id = s.id
    WHERE di.distribution_id = ?
    ORDER BY s.nama_lengkap ASC
    `,
    [id]
  )

  return {
    ...dist,
    items,
  }
}

// ─── POST-RELEASE PATCH C4: DETAIL OPERASIONAL & EXCEL IMPORT ────────────────

/**
 * Mengambil detail operasional penyaluran santri per provider untuk periode terkait.
 * Mendukung server-side pagination (default 50), pencarian (nama & NIS), dan filter status pembayaran.
 */
export async function getProviderOperationalDetail(
  params: ProviderOperationalDetailParams
): Promise<ProviderOperationalDetailResult> {
  const provider = await queryOne<{
    id: string
    nama_jasa: string
    jenis: string
  }>(
    `SELECT id, nama_jasa, jenis FROM master_jasa WHERE id = ?`,
    [params.providerId]
  )

  if (!provider) {
    throw new Error(`Penyedia dengan ID "${params.providerId}" tidak ditemukan pada master_jasa.`)
  }

  const providerType = provider.jenis as 'Makan' | 'Cuci'
  const itemType = providerType === 'Makan' ? 'UANG_MAKAN' : 'UANG_NYUCI'
  const serviceCol = providerType === 'Makan' ? 's.tempat_makan_id' : 's.tempat_mencuci_id'
  const period = params.period

  const page = Math.max(1, params.page || 1)
  const pageSize = Math.max(1, Math.min(200, params.pageSize || 50))
  const offset = (page - 1) * pageSize

  const allowCurrentAssignmentFallback = isPeriodEligibleForCurrentAssignment(period)

  // Cari tarif aktif untuk default nominal kewajiban jika obligation belum dibuat
  const tariff = await getActiveTariff(itemType, period).catch(() => null)
  const defaultTariffNominal = tariff?.nominal ?? 0

  // 1. Ambil KPI summary stats untuk provider ini
  const statsSummary = await getDistributionSummary(
    providerType === 'Makan' ? 'KATERING' : 'LAUNDRY',
    period,
    provider.id
  )

  // 2. Query Detail Items dengan Search & Status Filter
  const baseCte = `
    WITH assigned_students AS (
      -- A: Santri dengan obligation
      SELECT
        o.provider_id,
        o.santri_id,
        o.id AS obligation_id,
        o.period,
        o.amount_expected,
        o.amount_exempted,
        (CASE 
           WHEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) > 0 
           THEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) 
           ELSE 0 
         END) AS effective_paid,
        (CASE 
           WHEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) > 0 
           THEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corr, 0)) 
           ELSE 0 
         END) AS dana_masuk,
        COALESCE(alloc.disbursed, 0) AS dana_disalurkan
      FROM finance_obligations o
      LEFT JOIN (
        SELECT 
          fa.obligation_id, 
          SUM(fa.amount) AS gross_paid,
          SUM(COALESCE((SELECT SUM(fdi.amount) FROM finance_distribution_items fdi WHERE fdi.allocation_id = fa.id), 0)) AS disbursed
        FROM finance_allocations fa
        JOIN finance_payments fp ON fp.id = fa.payment_id
        WHERE fa.obligation_id IS NOT NULL AND fp.status IN ('PAID', 'SETTLED')
        GROUP BY fa.obligation_id
      ) alloc ON alloc.obligation_id = o.id
      LEFT JOIN (
        SELECT fci.obligation_id, SUM(fci.amount) AS total_corr
        FROM finance_correction_items fci
        WHERE fci.obligation_id IS NOT NULL
        GROUP BY fci.obligation_id
      ) corr ON corr.obligation_id = o.id
      WHERE o.item_type = ? AND o.period = ? AND o.provider_id = ?

      UNION ALL

      -- B: Santri aktif tanpa obligation untuk periode ini (hanya jika periode diizinkan)
      SELECT
        ${serviceCol} AS provider_id,
        s.id AS santri_id,
        NULL AS obligation_id,
        ? AS period,
        ? AS amount_expected,
        0 AS amount_exempted,
        0 AS effective_paid,
        0 AS dana_masuk,
        0 AS dana_disalurkan
      FROM santri s
      WHERE s.status_global = 'aktif'
        AND ${nonBillableSantriSqlPredicate('s.asrama')}
        AND ${allowCurrentAssignmentFallback ? '1=1' : '1=0'}
        AND ${serviceCol} = ?
        AND NOT EXISTS (
          SELECT 1 FROM finance_obligations fo
          WHERE fo.santri_id = s.id
            AND fo.item_type = ?
            AND fo.period = ?
        )
    )
  `

  const cteParams: unknown[] = [
    itemType,
    period,
    provider.id,
    period,
    defaultTariffNominal,
    provider.id,
    itemType,
    period,
  ]

  const filterConditions: string[] = ['1=1']
  const filterParams: unknown[] = []

  if (params.search && params.search.trim().length > 0) {
    const term = `%${params.search.trim().toLowerCase()}%`
    filterConditions.push('(LOWER(s.nama_lengkap) LIKE ? OR LOWER(s.nis) LIKE ?)')
    filterParams.push(term, term)
  }

  if (params.statusFilter && params.statusFilter !== 'ALL') {
    if (params.statusFilter === 'PAID') {
      filterConditions.push(
        'a.obligation_id IS NOT NULL AND (a.amount_expected - a.amount_exempted) <= a.effective_paid AND a.effective_paid > 0'
      )
    } else if (params.statusFilter === 'UNPAID') {
      filterConditions.push(
        '(a.obligation_id IS NULL OR (a.effective_paid = 0 AND a.amount_exempted < a.amount_expected))'
      )
    } else if (params.statusFilter === 'PARTIAL') {
      filterConditions.push(
        'a.obligation_id IS NOT NULL AND a.effective_paid > 0 AND (a.amount_expected - a.amount_exempted) > a.effective_paid'
      )
    } else if (params.statusFilter === 'EXEMPTED') {
      filterConditions.push(
        'a.obligation_id IS NOT NULL AND a.amount_exempted >= a.amount_expected AND a.effective_paid = 0'
      )
    }
  }

  const whereSql = filterConditions.join(' AND ')

  // Count total matching items
  const countRow = await queryOne<{ total: number }>(
    `
    ${baseCte}
    SELECT COUNT(*) AS total
    FROM assigned_students a
    JOIN santri s ON s.id = a.santri_id
    WHERE ${whereSql}
      AND ${nonBillableSantriSqlPredicate('s.asrama')}
    `,
    [...cteParams, ...filterParams]
  )

  const totalItems = countRow?.total ?? 0
  const totalPages = Math.ceil(totalItems / pageSize) || 1

  // Fetch paginated rows
  const rawRows = await query<{
    santri_id: string
    nis: string
    nama_lengkap: string
    asrama: string | null
    kamar: string | null
    period: string
    obligation_id: string | null
    amount_expected: number
    amount_exempted: number
    effective_paid: number
    dana_masuk: number
    dana_disalurkan: number
  }>(
    `
    ${baseCte}
    SELECT
      s.id AS santri_id,
      s.nis,
      s.nama_lengkap,
      s.asrama,
      s.kamar,
      a.period,
      a.obligation_id,
      a.amount_expected,
      a.amount_exempted,
      a.effective_paid,
      a.dana_masuk,
      a.dana_disalurkan
    FROM assigned_students a
    JOIN santri s ON s.id = a.santri_id
    WHERE ${whereSql}
      AND ${nonBillableSantriSqlPredicate('s.asrama')}
    ORDER BY s.nama_lengkap COLLATE NOCASE ASC
    LIMIT ? OFFSET ?
    `,
    [...cteParams, ...filterParams, pageSize, offset]
  )

  const items: ProviderOperationalDetailRow[] = rawRows.map((r) => {
    let status: ProviderOperationalPaymentStatus = 'UNPAID'
    let label = 'Belum Bayar'

    const netExpected = Math.max(0, r.amount_expected - r.amount_exempted)
    const effectivePaid = r.effective_paid
    const sisa = Math.max(0, netExpected - effectivePaid)

    if (r.obligation_id) {
      if (r.amount_exempted >= r.amount_expected && effectivePaid === 0) {
        status = 'EXEMPTED'
        label = 'Pembebasan'
      } else if (netExpected <= effectivePaid && effectivePaid > 0) {
        status = 'PAID'
        label = 'Lunas'
      } else if (effectivePaid > 0 && effectivePaid < netExpected) {
        status = 'PARTIAL'
        label = 'Sebagian'
      } else {
        status = 'UNPAID'
        label = 'Belum Bayar'
      }
    } else {
      status = 'UNPAID'
      label = 'Belum Bayar'
    }

    return {
      santriId: r.santri_id,
      nis: r.nis,
      namaLengkap: r.nama_lengkap,
      asrama: r.asrama,
      kamar: r.kamar,
      period: r.period,
      nominalKewajiban: r.amount_expected,
      terbayar: effectivePaid,
      sisa,
      statusPembayaran: status,
      statusLabel: label,
      danaMasuk: r.dana_masuk,
      danaDisalurkan: r.dana_disalurkan,
    }
  })

  return {
    provider: {
      id: provider.id,
      name: provider.nama_jasa,
      type: providerType,
    },
    period,
    stats: {
      totalAssigned: statsSummary.totalSantriTerdaftar,
      totalPaid: statsSummary.totalSantriSudahBayar,
      totalUnpaid: statsSummary.totalSantriBelumBayar,
      totalExempted: statsSummary.totalSantriBebas ?? 0,
      totalDanaMasuk: statsSummary.totalDanaMasuk,
      totalSudahDisalurkan: statsSummary.totalSudahDisalurkan,
      sisaSiapSalur: statsSummary.totalSiapDisalurkan,
    },
    items,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  }
}

/**
 * Mengambil master provider dan rekening existing untuk pengisian template Excel rekening penyedia.
 */
export async function getProviderAccountTemplateData(): Promise<ProviderAccountTemplatePayload> {
  const providers = await query<{
    id: string
    nama_jasa: string
    jenis: string
  }>(
    `SELECT id, nama_jasa, jenis FROM master_jasa ORDER BY jenis ASC, nama_jasa ASC`
  )

  const existingAccounts = await query<{
    provider_id: string
    bank_name: string
    account_number: string
  }>(
    `SELECT provider_id, bank_name, account_number FROM finance_provider_accounts`
  )

  return {
    providers: providers.map((p) => ({
      provider_id: p.id,
      nama_penyedia: p.nama_jasa,
      jenis_layanan: p.jenis,
      bank: '',
      nomor_rekening: '',
      nama_pemilik: '',
      rekening_utama: 'TIDAK',
      catatan: '',
    })),
    existingAccounts,
  }
}

/**
 * Mengimpor rekening penyedia hasil parse Excel secara atomik dan aman.
 * Menjamin:
 * 1. provider_id valid di master_jasa.
 * 2. SKIPPED_DUPLICATE: Rekening dengan kombinasi (provider_id + bank_name + account_number) yang sama
 *    di-skip secara aman tanpa mengubah data existing secara diam-diam.
 * 3. Invariant single-primary per provider jika ditandai sebagai rekening utama.
 * 4. Mencegah partial ambiguous import jika terdapat baris INVALID.
 * 5. Chunked atomic batch execution.
 */
export async function importProviderAccounts(
  rows: ValidatedImportAccountRow[]
): Promise<{ success: boolean; insertedCount: number; skippedCount: number; invalidCount: number }> {
  if (!rows || rows.length === 0) {
    throw new Error('Tidak ada data rekening yang dapat diimpor.')
  }

  // 0. Cegah partial ambiguous import jika ada baris invalid
  const invalidRows = rows.filter((r) => r.status === 'INVALID')
  if (invalidRows.length > 0) {
    throw new Error(
      `Terdapat ${invalidRows.length} baris data yang tidak valid. Perbaiki kesalahan file Excel sebelum melanjutkan untuk mencegah impor data yang ambigu.`
    )
  }

  // 1. Ambil semua provider di master_jasa
  const providers = await query<{ id: string; nama_jasa: string }>(`SELECT id, nama_jasa FROM master_jasa`)
  const validProviderMap = new Map(providers.map((p) => [p.id, p.nama_jasa]))

  // 2. Ambil rekening existing untuk deteksi duplikasi
  const existingAccounts = await query<{
    provider_id: string
    bank_name: string
    account_number: string
  }>(`SELECT provider_id, bank_name, account_number FROM finance_provider_accounts`)

  const existingSet = new Set(
    existingAccounts.map(
      (a) => `${a.provider_id}|${a.bank_name.trim().toUpperCase()}|${a.account_number.trim()}`
    )
  )

  const statements: Array<{ sql: string; params?: unknown[] }> = []
  let insertedCount = 0
  let skippedCount = 0
  const currentNow = now()

  for (const row of rows) {
    // Jika dari preview sudah ditandai SKIPPED_DUPLICATE
    if (row.status === 'SKIPPED_DUPLICATE') {
      skippedCount++
      continue
    }

    if (!validProviderMap.has(row.provider_id)) {
      throw new Error(`Penyedia dengan ID "${row.provider_id}" tidak valid pada master_jasa.`)
    }

    const bankName = row.bank.trim()
    const accountNumber = row.nomor_rekening.trim()
    const accountHolder = row.nama_pemilik.trim()

    if (!bankName || !accountNumber || !accountHolder) {
      throw new Error(
        `Baris #${row.index + 1}: Nama bank, nomor rekening, dan nama pemilik rekening wajib diisi.`
      )
    }

    const key = `${row.provider_id}|${bankName.toUpperCase()}|${accountNumber}`
    if (existingSet.has(key)) {
      // SKIPPED_DUPLICATE: Jangan update row existing secara diam-diam!
      skippedCount++
      continue
    }

    existingSet.add(key) // Cegah duplikasi dalam batch yang sama

    const id = generateId()
    const isPrimaryVal = row.is_primary ? 1 : 0

    if (isPrimaryVal === 1) {
      // Invariant: Nonaktifkan primary existing untuk provider ini
      statements.push({
        sql: `UPDATE finance_provider_accounts SET is_primary = 0 WHERE provider_id = ?`,
        params: [row.provider_id],
      })
    }

    statements.push({
      sql: `
        INSERT INTO finance_provider_accounts (
          id, provider_id, bank_name, account_number, account_holder,
          is_primary, notes, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        id,
        row.provider_id,
        bankName,
        accountNumber,
        accountHolder,
        isPrimaryVal,
        row.catatan?.trim() || null,
        currentNow,
        currentNow,
      ],
    })

    insertedCount++
  }

  if (statements.length > 0) {
    // Eksekusi dalam batch chunked (50 per batch)
    const CHUNK_SIZE = 50
    for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
      const chunk = statements.slice(i, i + CHUNK_SIZE)
      await batch(chunk)
    }
  }

  return {
    success: true,
    insertedCount,
    skippedCount,
    invalidCount: 0,
  }
}
