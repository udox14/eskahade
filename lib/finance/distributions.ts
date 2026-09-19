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
} from '@/lib/finance/distribution-types'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'

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
 * Mengambil ringkasan KPI Penyaluran (Dana Masuk, Disalurkan, Siap Disalurkan, dan Santri).
 */
export async function getDistributionSummary(
  recipientType: FinanceDistributionRecipientType,
  period: string,
  providerId?: string | null
): Promise<DistributionKpiSummary> {
  let itemTypes: string[] = []
  if (recipientType === 'BENDAHARA') {
    itemTypes = BENDAHARA_ITEM_TYPES
  } else if (recipientType === 'KATERING') {
    itemTypes = ['UANG_MAKAN']
  } else if (recipientType === 'LAUNDRY') {
    itemTypes = ['UANG_NYUCI']
  }

  const inPlaceholders = itemTypes.map(() => '?').join(', ')
  const params: unknown[] = [...itemTypes]

  // Filter provider jika katering/laundry
  let providerFilter = ''
  if (recipientType !== 'BENDAHARA' && providerId) {
    providerFilter = 'AND a.provider_id = ?'
    params.push(providerId)
  } else if (recipientType === 'BENDAHARA') {
    providerFilter = 'AND a.provider_id IS NULL'
  }

  // Filter periode dinamis per item
  let periodCondition = ''
  if (recipientType === 'BENDAHARA') {
    const yearPrefix = period.slice(0, 4)
    periodCondition = `
      AND (
        (a.item_type = 'SPP' AND o.period = ?)
        OR (a.item_type IN ('EHB', 'EKSKUL', 'KESEHATAN') AND o.period = ?)
        OR (a.item_type = 'USPP' AND o.period = 'LIFETIME')
      )
    `
    params.push(period, yearPrefix)
  } else {
    periodCondition = 'AND o.period = ?'
    params.push(period)
  }

  // 1. Agregasi Dana Alokasi & Penyaluran
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
    JOIN finance_obligations o ON a.obligation_id = o.id
    WHERE a.target_type = 'OBLIGATION'
      AND a.item_type IN (${inPlaceholders})
      ${providerFilter}
      ${periodCondition}
    `,
    params
  )

  const totalDanaMasuk = fundAgg?.total_amount ?? 0
  const totalSudahDisalurkan = fundAgg?.total_disbursed ?? 0
  const totalSiapDisalurkan = Math.max(0, totalDanaMasuk - totalSudahDisalurkan)

  // 2. Agregasi Santri (Terdaftar, Sudah Bayar, Belum Bayar)
  const santriParams: unknown[] = [...itemTypes]
  let santriProviderFilter = ''
  if (recipientType !== 'BENDAHARA' && providerId) {
    santriProviderFilter = 'AND o.provider_id = ?'
    santriParams.push(providerId)
  } else if (recipientType === 'BENDAHARA') {
    santriProviderFilter = 'AND o.provider_id IS NULL'
  }

  let santriPeriodCondition = ''
  if (recipientType === 'BENDAHARA') {
    const yearPrefix = period.slice(0, 4)
    santriPeriodCondition = `
      AND (
        (o.item_type = 'SPP' AND o.period = ?)
        OR (o.item_type IN ('EHB', 'EKSKUL', 'KESEHATAN') AND o.period = ?)
        OR (o.item_type = 'USPP' AND o.period = 'LIFETIME')
      )
    `
    santriParams.push(period, yearPrefix)
  } else {
    santriPeriodCondition = 'AND o.period = ?'
    santriParams.push(period)
  }

  const santriAgg = await queryOne<{
    total_santri: number
    sudah_bayar: number
  }>(
    `
    SELECT
      COUNT(DISTINCT o.santri_id) AS total_santri,
      COUNT(DISTINCT CASE WHEN o.status = 'PAID' OR o.amount_paid > 0 THEN o.santri_id END) AS sudah_bayar
    FROM finance_obligations o
    WHERE o.item_type IN (${inPlaceholders})
      ${santriProviderFilter}
      ${santriPeriodCondition}
    `,
    santriParams
  )

  const totalSantriTerdaftar = santriAgg?.total_santri ?? 0
  const totalSantriSudahBayar = santriAgg?.sudah_bayar ?? 0
  const totalSantriBelumBayar = Math.max(0, totalSantriTerdaftar - totalSantriSudahBayar)

  return {
    totalDanaMasuk,
    totalSudahDisalurkan,
    totalSiapDisalurkan,
    totalSantriTerdaftar,
    totalSantriSudahBayar,
    totalSantriBelumBayar,
  }
}

/**
 * Mengambil daftar penyedia katering / laundry beserta status hak penyalurannya.
 */
export async function getProviderDistributionList(
  recipientType: 'KATERING' | 'LAUNDRY',
  period: string
): Promise<ProviderDistributionSummaryRow[]> {
  const providerJenis = recipientType === 'KATERING' ? 'Makan' : 'Cuci'
  const targetItemType = recipientType === 'KATERING' ? 'UANG_MAKAN' : 'UANG_NYUCI'

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

  const result: ProviderDistributionSummaryRow[] = []

  for (const p of providers) {
    // 2. Ambil agregasi alokasi dana snapshot vendor ini pada periode terkait
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
      JOIN finance_obligations o ON a.obligation_id = o.id
      WHERE a.target_type = 'OBLIGATION'
        AND a.item_type = ?
        AND a.provider_id = ?
        AND o.period = ?
      `,
      [targetItemType, p.id, period]
    )

    const totalDanaMasuk = fundAgg?.total_amount ?? 0
    const sudahDisalurkan = fundAgg?.total_disbursed ?? 0
    const sisaSiapSalur = Math.max(0, totalDanaMasuk - sudahDisalurkan)

    // 3. Ambil statistik santri terdaftar pada kewajiban periode terkait
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
        AND o.provider_id = ?
        AND o.period = ?
      `,
      [targetItemType, p.id, period]
    )

    const santriTerdaftar = santriAgg?.total_santri ?? 0
    const santriSudahBayar = santriAgg?.sudah_bayar ?? 0
    const santriBelumBayar = Math.max(0, santriTerdaftar - santriSudahBayar)

    // 4. Ambil rekening utama penyedia
    const accounts = await query<FinanceProviderAccount>(
      `
      SELECT id, provider_id, bank_name, account_number, account_holder, is_primary, notes, created_at, updated_at
      FROM finance_provider_accounts
      WHERE provider_id = ?
      ORDER BY is_primary DESC, created_at ASC
      `,
      [p.id]
    )

    const primaryAccount = accounts.find((acc) => acc.is_primary === 1) || accounts[0] || null

    result.push({
      providerId: p.id,
      providerName: p.nama_jasa,
      providerType: p.jenis as 'Makan' | 'Cuci',
      santriTerdaftar,
      santriSudahBayar,
      santriBelumBayar,
      totalDanaMasuk,
      sudahDisalurkan,
      sisaSiapSalur,
      primaryAccount,
      accountsCount: accounts.length,
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
      JOIN finance_obligations o ON a.obligation_id = o.id
      WHERE a.target_type = 'OBLIGATION'
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
      a.amount,
      COALESCE((
        SELECT SUM(di.amount)
        FROM finance_distribution_items di
        WHERE di.allocation_id = a.id
      ), 0) AS disbursed_amount,
      (a.amount - COALESCE((
        SELECT SUM(di.amount)
        FROM finance_distribution_items di
        WHERE di.allocation_id = a.id
      ), 0)) AS available_amount,
      a.distribution_status,
      a.created_at
    FROM finance_allocations a
    JOIN finance_obligations o ON a.obligation_id = o.id
    WHERE a.target_type = 'OBLIGATION'
      AND a.item_type = ?
      AND o.period = ?
      AND (a.amount - COALESCE((
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
  const pageSize = Math.max(1, filter.pageSize || 20)
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
