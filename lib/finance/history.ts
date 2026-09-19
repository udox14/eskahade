// lib/finance/history.ts
// Modul Read Model: Riwayat Transaksi Global Terpadu (Fase 9: PRD Bab 30)
// Menggabungkan seluruh transaksi historis lintas sistem keuangan:
// 1. Pembayaran Online & Tunai (finance_payments)
// 2. Top-Up Uang Jajan & Penarikan Loket (finance_wallet_ledger)
// 3. Penyaluran Dana ke Vendor & Bendahara (finance_distributions)
// 4. Koreksi Finansial: Void, Reversal, Refund (finance_corrections)
// Mendukung Search, Multi-Filter, Sorting, Server-Side Pagination, & Detail Audit Drawer.

import { query, queryOne } from '@/lib/db'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'

export type TransactionCategory =
  | 'PAYMENT'
  | 'TOPUP'
  | 'WITHDRAWAL'
  | 'DISTRIBUTION'
  | 'CORRECTION'

export type FundType = 'PESANTREN' | 'TITIPAN_SANTRI'
export type MoneyDirection = 'IN' | 'OUT'

export interface GlobalTransactionRow {
  id: string
  sourceTable: 'PAYMENT' | 'WALLET' | 'DISTRIBUTION' | 'CORRECTION'
  transactionNumber: string
  category: TransactionCategory
  categoryLabel: string
  fundType: FundType
  direction: MoneyDirection
  amount: number
  grossAmount: number
  gatewayFee: number
  netAmount: number
  channel: string
  method: string
  status: string
  itemType: string | null
  itemLabel: string | null
  santriId: string | null
  santriName: string | null
  santriNis: string | null
  santriAsrama: string | null
  santriKamar: string | null
  recipientInfo: string | null
  operatorName: string | null
  externalReference: string | null
  notes: string | null
  createdAt: string
}

export interface GlobalTransactionQueryParams {
  search?: string
  startDate?: string
  endDate?: string
  category?: string
  itemType?: string
  channel?: string
  status?: string
  asrama?: string
  sortBy?: 'createdAt' | 'amount' | 'transactionNumber'
  sortDirection?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface GlobalTransactionHistoryResponse {
  items: GlobalTransactionRow[]
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
  summary: {
    totalInPesantren: number
    totalInTitipan: number
    totalOutPesantren: number
    totalOutTitipan: number
  }
}

export interface FilterOptionsData {
  asramaList: string[]
  categoryList: Array<{ value: string; label: string }>
  itemTypeList: Array<{ value: string; label: string }>
  channelList: Array<{ value: string; label: string }>
  statusList: Array<{ value: string; label: string }>
}

export const CATEGORY_MAP: Record<TransactionCategory, string> = {
  PAYMENT: 'Pembayaran Tagihan',
  TOPUP: 'Top-Up Uang Jajan',
  WITHDRAWAL: 'Penarikan Loket',
  DISTRIBUTION: 'Penyaluran Dana',
  CORRECTION: 'Koreksi Finansial',
}

/**
 * Mengambil histori transaksi global terpadu dengan search, filter, sorting, dan pagination server-side.
 */
export async function getGlobalTransactionHistory(
  params: GlobalTransactionQueryParams
): Promise<GlobalTransactionHistoryResponse> {
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize || 20))
  const offset = (page - 1) * pageSize
  const sortBy = params.sortBy || 'createdAt'
  const sortDir = params.sortDirection === 'asc' ? 'ASC' : 'DESC'

  // Susun klausa filter dinamis
  const whereClauses: string[] = ['1 = 1']
  const queryParams: unknown[] = []

  // 1. Filter Pencarian Teks (Search)
  if (params.search && params.search.trim() !== '') {
    const term = `%${params.search.trim()}%`
    whereClauses.push(
      `(t.transaction_number LIKE ? OR t.santri_name LIKE ? OR t.santri_nis LIKE ? OR t.external_reference LIKE ? OR t.recipient_info LIKE ? OR t.operator_name LIKE ?)`
    )
    queryParams.push(term, term, term, term, term, term)
  }

  // 2. Filter Rentang Tanggal
  if (params.startDate && params.startDate.trim() !== '') {
    whereClauses.push(`t.created_at >= ?`)
    queryParams.push(`${params.startDate.trim()} 00:00:00`)
  }
  if (params.endDate && params.endDate.trim() !== '') {
    whereClauses.push(`t.created_at <= ?`)
    queryParams.push(`${params.endDate.trim()} 23:59:59`)
  }

  // 3. Filter Kategori Transaksi
  if (params.category && params.category !== 'ALL') {
    whereClauses.push(`t.category = ?`)
    queryParams.push(params.category)
  }

  // 4. Filter Item / Pos Tagihan
  if (params.itemType && params.itemType !== 'ALL') {
    whereClauses.push(`t.item_type LIKE ?`)
    queryParams.push(`%${params.itemType}%`)
  }

  // 5. Filter Kanal / Metode
  if (params.channel && params.channel !== 'ALL') {
    whereClauses.push(`t.channel = ?`)
    queryParams.push(params.channel)
  }

  // 6. Filter Status
  if (params.status && params.status !== 'ALL') {
    whereClauses.push(`t.status = ?`)
    queryParams.push(params.status)
  }

  // 7. Filter Asrama Santri
  if (params.asrama && params.asrama !== 'ALL') {
    whereClauses.push(`t.santri_asrama = ?`)
    queryParams.push(params.asrama)
  }

  const whereSql = whereClauses.join(' AND ')

  // Kolom pengurutan SQL
  let sortColumn = 't.created_at'
  if (sortBy === 'amount') sortColumn = 't.amount'
  if (sortBy === 'transactionNumber') sortColumn = 't.transaction_number'

  // Subquery CTE / Union All Transaksi
  const baseUnionSql = `
    WITH all_transactions AS (
      -- 1. Payments (Tagihan Pesantren & Top-Up Uang Jajan Online/Tunai)
      SELECT
        p.id,
        'PAYMENT' AS source_table,
        p.payment_number AS transaction_number,
        CASE
          WHEN EXISTS (SELECT 1 FROM finance_allocations a WHERE a.payment_id = p.id AND a.target_type = 'UANG_JAJAN') THEN 'TOPUP'
          ELSE 'PAYMENT'
        END AS category,
        CASE
          WHEN EXISTS (SELECT 1 FROM finance_allocations a WHERE a.payment_id = p.id AND a.target_type = 'UANG_JAJAN') THEN 'TITIPAN_SANTRI'
          ELSE 'PESANTREN'
        END AS fund_type,
        'IN' AS direction,
        p.gross_amount AS amount,
        p.gross_amount,
        p.gateway_fee,
        p.net_amount,
        p.channel,
        p.method,
        CASE
          WHEN p.channel = 'DUITKU' AND EXISTS (SELECT 1 FROM finance_settlement_items si WHERE si.payment_id = p.id) THEN 'SETTLED'
          ELSE p.status
        END AS status,
        (SELECT GROUP_CONCAT(DISTINCT a.item_type) FROM finance_allocations a WHERE a.payment_id = p.id) AS item_type,
        s.id AS santri_id,
        s.nama_lengkap AS santri_name,
        s.nis AS santri_nis,
        s.asrama AS santri_asrama,
        s.kamar AS santri_kamar,
        NULL AS recipient_info,
        u.full_name AS operator_name,
        p.external_reference,
        NULL AS notes,
        p.paid_at AS created_at
      FROM finance_payments p
      LEFT JOIN santri s ON s.id = p.santri_id
      LEFT JOIN users u ON u.id = p.received_by

      UNION ALL

      -- 2. Wallet Ledger Movements (Withdrawals, Standalone Top-Up, & Wallet Reversals)
      SELECT
        wl.id,
        'WALLET' AS source_table,
        COALESCE(wl.reference_id, 'WLT-' || SUBSTR(wl.id, 1, 8)) AS transaction_number,
        CASE
          WHEN wl.movement_type = 'WITHDRAWAL_LOKET' THEN 'WITHDRAWAL'
          WHEN wl.movement_type = 'REVERSAL' THEN 'CORRECTION'
          ELSE 'TOPUP'
        END AS category,
        'TITIPAN_SANTRI' AS fund_type,
        wl.direction,
        wl.amount,
        wl.amount AS gross_amount,
        0 AS gateway_fee,
        wl.amount AS net_amount,
        CASE WHEN wl.movement_type = 'TOPUP_ONLINE' THEN 'DUITKU' ELSE 'CASH' END AS channel,
        CASE WHEN wl.movement_type = 'TOPUP_ONLINE' THEN 'DUITKU' ELSE 'CASH' END AS method,
        CASE
          WHEN wl.movement_type = 'REVERSAL' THEN 'REVERSAL'
          ELSE 'COMPLETED'
        END AS status,
        'UANG_JAJAN' AS item_type,
        s.id AS santri_id,
        s.nama_lengkap AS santri_name,
        s.nis AS santri_nis,
        s.asrama AS santri_asrama,
        s.kamar AS santri_kamar,
        NULL AS recipient_info,
        u.full_name AS operator_name,
        wl.reference_id AS external_reference,
        wl.notes,
        wl.created_at
      FROM finance_wallet_ledger wl
      LEFT JOIN santri s ON s.id = wl.santri_id
      LEFT JOIN users u ON u.id = wl.operator_id
      WHERE
        (wl.direction = 'OUT' AND wl.movement_type = 'WITHDRAWAL_LOKET')
        OR
        (wl.direction = 'IN' AND wl.movement_type IN ('TOPUP_CASH', 'TOPUP_ONLINE')
         AND NOT EXISTS (SELECT 1 FROM finance_payments p WHERE p.id = wl.reference_id OR p.payment_number = wl.reference_id))
        OR
        (wl.movement_type = 'REVERSAL'
         AND NOT EXISTS (SELECT 1 FROM finance_corrections c WHERE c.id = wl.reference_id OR c.correction_number = wl.reference_id))

      UNION ALL

      -- 3. Penyaluran Dana (Distributions ke Vendor Katering/Laundry/Bendahara)
      SELECT
        d.id,
        'DISTRIBUTION' AS source_table,
        d.distribution_number AS transaction_number,
        'DISTRIBUTION' AS category,
        'PESANTREN' AS fund_type,
        'OUT' AS direction,
        d.total_amount AS amount,
        d.total_amount AS gross_amount,
        0 AS gateway_fee,
        d.total_amount AS net_amount,
        d.method AS channel,
        d.method,
        'COMPLETED' AS status,
        d.item_type,
        NULL AS santri_id,
        NULL AS santri_name,
        NULL AS santri_nis,
        NULL AS santri_asrama,
        NULL AS santri_kamar,
        COALESCE(j.nama_jasa, d.recipient_type) AS recipient_info,
        u.full_name AS operator_name,
        d.destination_account AS external_reference,
        d.notes,
        d.transferred_at AS created_at
      FROM finance_distributions d
      LEFT JOIN master_jasa j ON j.id = d.recipient_id
      LEFT JOIN users u ON u.id = d.transferred_by

      UNION ALL

      -- 4. Koreksi Finansial (Void, Reversal, Refund)
      SELECT
        c.id,
        'CORRECTION' AS source_table,
        c.correction_number AS transaction_number,
        'CORRECTION' AS category,
        'PESANTREN' AS fund_type,
        'OUT' AS direction,
        c.total_amount AS amount,
        c.total_amount AS gross_amount,
        0 AS gateway_fee,
        c.total_amount AS net_amount,
        COALESCE(c.method, 'SYSTEM') AS channel,
        COALESCE(c.method, 'SYSTEM') AS method,
        c.correction_type AS status,
        'KOREKSI' AS item_type,
        s.id AS santri_id,
        s.nama_lengkap AS santri_name,
        s.nis AS santri_nis,
        s.asrama AS santri_asrama,
        s.kamar AS santri_kamar,
        NULL AS recipient_info,
        u.full_name AS operator_name,
        p.payment_number AS external_reference,
        c.reason AS notes,
        c.created_at
      FROM finance_corrections c
      JOIN finance_payments p ON p.id = c.target_payment_id
      LEFT JOIN santri s ON s.id = p.santri_id
      LEFT JOIN users u ON u.id = c.created_by
    )
  `

  // Hitung Total Records & Summary Agregat
  const countRow = await queryOne<{
    total_count: number
    in_pesantren: number
    in_titipan: number
    out_pesantren: number
    out_titipan: number
  }>(
    `
    ${baseUnionSql}
    SELECT
      COUNT(*) AS total_count,
      COALESCE(SUM(CASE WHEN t.direction = 'IN' AND t.fund_type = 'PESANTREN' THEN t.amount ELSE 0 END), 0) AS in_pesantren,
      COALESCE(SUM(CASE WHEN t.direction = 'IN' AND t.fund_type = 'TITIPAN_SANTRI' THEN t.amount ELSE 0 END), 0) AS in_titipan,
      COALESCE(SUM(CASE WHEN t.direction = 'OUT' AND t.fund_type = 'PESANTREN' THEN t.amount ELSE 0 END), 0) AS out_pesantren,
      COALESCE(SUM(CASE WHEN t.direction = 'OUT' AND t.fund_type = 'TITIPAN_SANTRI' THEN t.amount ELSE 0 END), 0) AS out_titipan
    FROM all_transactions t
    WHERE ${whereSql}
    `,
    queryParams
  )

  const totalRecords = countRow?.total_count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))

  // Ambil Data Halaman Ini
  const rows = await query<{
    id: string
    source_table: 'PAYMENT' | 'WALLET' | 'DISTRIBUTION' | 'CORRECTION'
    transaction_number: string
    category: TransactionCategory
    fund_type: FundType
    direction: MoneyDirection
    amount: number
    gross_amount: number
    gateway_fee: number
    net_amount: number
    channel: string
    method: string
    status: string
    item_type: string | null
    santri_id: string | null
    santri_name: string | null
    santri_nis: string | null
    santri_asrama: string | null
    santri_kamar: string | null
    recipient_info: string | null
    operator_name: string | null
    external_reference: string | null
    notes: string | null
    created_at: string
  }>(
    `
    ${baseUnionSql}
    SELECT *
    FROM all_transactions t
    WHERE ${whereSql}
    ORDER BY ${sortColumn} ${sortDir}
    LIMIT ? OFFSET ?
    `,
    [...queryParams, pageSize, offset]
  )

  const items: GlobalTransactionRow[] = rows.map((r) => ({
    id: r.id,
    sourceTable: r.source_table,
    transactionNumber: r.transaction_number,
    category: r.category,
    categoryLabel: CATEGORY_MAP[r.category] || r.category,
    fundType: r.fund_type,
    direction: r.direction,
    amount: r.amount,
    grossAmount: r.gross_amount,
    gatewayFee: r.gateway_fee,
    netAmount: r.net_amount,
    channel: r.channel,
    method: r.method,
    status: r.status,
    itemType: r.item_type,
    itemLabel: r.item_type
      ? (FINANCE_ITEM_LABELS[r.item_type as FinanceItemType] || r.item_type)
      : null,
    santriId: r.santri_id,
    santriName: r.santri_name,
    santriNis: r.santri_nis,
    santriAsrama: r.santri_asrama,
    santriKamar: r.santri_kamar,
    recipientInfo: r.recipient_info,
    operatorName: r.operator_name,
    externalReference: r.external_reference,
    notes: r.notes,
    createdAt: r.created_at,
  }))

  return {
    items,
    pagination: {
      currentPage: page,
      pageSize,
      totalRecords,
      totalPages,
    },
    summary: {
      totalInPesantren: countRow?.in_pesantren ?? 0,
      totalInTitipan: countRow?.in_titipan ?? 0,
      totalOutPesantren: countRow?.out_pesantren ?? 0,
      totalOutTitipan: countRow?.out_titipan ?? 0,
    },
  }
}

/**
 * Mengambil detail mendalam satu transaksi untuk Detail Slide-over Drawer.
 */
export async function getTransactionDetail(
  id: string,
  sourceTable: 'PAYMENT' | 'WALLET' | 'DISTRIBUTION' | 'CORRECTION'
): Promise<{
  transaction: GlobalTransactionRow
  allocations: Array<{
    id: string
    itemType: string
    itemLabel: string
    amount: number
    disbursedAmount: number
    distributionStatus: string
  }>
  auditTrail: {
    orderNumber?: string | null
    payerType?: string | null
    gatewayFee?: number
    netAmount?: number
    externalReference?: string | null
    cashSessionCode?: string | null
    reason?: string | null
    approvedBy?: string | null
    bankDestination?: string | null
    accountNumber?: string | null
    accountHolder?: string | null
    proofAttachmentUrl?: string | null
    recoveryStatus?: string | null
  }
} | null> {
  if (sourceTable === 'PAYMENT') {
    const p = await queryOne<{
      id: string
      payment_number: string
      order_id: string | null
      order_number: string | null
      payer_type: string | null
      santri_id: string | null
      santri_name: string | null
      santri_nis: string | null
      santri_asrama: string | null
      santri_kamar: string | null
      channel: string
      method: string
      gross_amount: number
      gateway_fee: number
      net_amount: number
      status: string
      correction_status: string
      allocation_status: string
      paid_at: string
      external_reference: string | null
      cash_session_id: string | null
      session_code: string | null
      operator_name: string | null
    }>(
      `SELECT
         p.*,
         o.order_number,
         o.payer_type,
         s.nama_lengkap AS santri_name,
         s.nis AS santri_nis,
         s.asrama AS santri_asrama,
         s.kamar AS santri_kamar,
         cs.session_code,
         u.full_name AS operator_name
       FROM finance_payments p
       LEFT JOIN finance_payment_orders o ON o.id = p.order_id
       LEFT JOIN santri s ON s.id = p.santri_id
       LEFT JOIN finance_cash_sessions cs ON cs.id = p.cash_session_id
       LEFT JOIN users u ON u.id = p.received_by
       WHERE p.id = ?`,
      [id]
    )

    if (!p) return null

    const hasSettlement = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM finance_settlement_items WHERE payment_id = ?`,
      [id]
    )
    const paymentStatus =
      p.channel === 'DUITKU' && (hasSettlement?.cnt ?? 0) > 0 ? 'SETTLED' : p.status

    const allocations = await query<{
      id: string
      item_type: string
      amount: number
      disbursed_amount: number
      distribution_status: string
    }>(
      `SELECT
         a.id,
         a.item_type,
         a.amount,
         COALESCE((
           SELECT SUM(di.amount)
           FROM finance_distribution_items di
           WHERE di.allocation_id = a.id
         ), 0) AS disbursed_amount,
         CASE
           WHEN COALESCE((
             SELECT SUM(di.amount)
             FROM finance_distribution_items di
             WHERE di.allocation_id = a.id
           ), 0) >= a.amount THEN 'DISBURSED'
           WHEN COALESCE((
             SELECT SUM(di.amount)
             FROM finance_distribution_items di
             WHERE di.allocation_id = a.id
           ), 0) > 0 THEN 'PARTIALLY_DISBURSED'
           ELSE 'UNDISBURSED'
         END AS distribution_status
       FROM finance_allocations a
       WHERE a.payment_id = ?`,
      [id]
    )

    const isTopup = allocations.some((a) => a.item_type === 'UANG_JAJAN')
    const category: TransactionCategory = isTopup ? 'TOPUP' : 'PAYMENT'
    const fundType: FundType = isTopup ? 'TITIPAN_SANTRI' : 'PESANTREN'

    return {
      transaction: {
        id: p.id,
        sourceTable: 'PAYMENT',
        transactionNumber: p.payment_number,
        category,
        categoryLabel: CATEGORY_MAP[category],
        fundType,
        direction: 'IN',
        amount: p.gross_amount,
        grossAmount: p.gross_amount,
        gatewayFee: p.gateway_fee,
        netAmount: p.net_amount,
        channel: p.channel,
        method: p.method,
        status: paymentStatus,
        itemType: allocations.map((a) => a.item_type).join(', '),
        itemLabel: allocations
          .map((a) => FINANCE_ITEM_LABELS[a.item_type as FinanceItemType] || a.item_type)
          .join(', '),
        santriId: p.santri_id,
        santriName: p.santri_name,
        santriNis: p.santri_nis,
        santriAsrama: p.santri_asrama,
        santriKamar: p.santri_kamar,
        recipientInfo: null,
        operatorName: p.operator_name,
        externalReference: p.external_reference,
        notes: null,
        createdAt: p.paid_at,
      },
      allocations: allocations.map((a) => ({
        id: a.id,
        itemType: a.item_type,
        itemLabel: FINANCE_ITEM_LABELS[a.item_type as FinanceItemType] || a.item_type,
        amount: a.amount,
        disbursedAmount: a.disbursed_amount,
        distributionStatus: a.distribution_status,
      })),
      auditTrail: {
        orderNumber: p.order_number,
        payerType: p.payer_type,
        gatewayFee: p.gateway_fee,
        netAmount: p.net_amount,
        externalReference: p.external_reference,
        cashSessionCode: p.session_code,
      },
    }
  }

  if (sourceTable === 'WALLET') {
    const wl = await queryOne<{
      id: string
      santri_id: string
      santri_name: string | null
      santri_nis: string | null
      santri_asrama: string | null
      santri_kamar: string | null
      direction: 'IN' | 'OUT'
      movement_type: string
      amount: number
      balance_before: number
      balance_after: number
      reference_id: string | null
      cash_session_id: string | null
      session_code: string | null
      operator_name: string | null
      notes: string | null
      created_at: string
    }>(
      `SELECT
         wl.*,
         s.nama_lengkap AS santri_name,
         s.nis AS santri_nis,
         s.asrama AS santri_asrama,
         s.kamar AS santri_kamar,
         cs.session_code,
         u.full_name AS operator_name
       FROM finance_wallet_ledger wl
       LEFT JOIN santri s ON s.id = wl.santri_id
       LEFT JOIN finance_cash_sessions cs ON cs.id = wl.cash_session_id
       LEFT JOIN users u ON u.id = wl.operator_id
       WHERE wl.id = ?`,
      [id]
    )

    if (!wl) return null

    let category: TransactionCategory
    let status = 'COMPLETED'
    if (wl.movement_type === 'WITHDRAWAL_LOKET') {
      category = 'WITHDRAWAL'
    } else if (wl.movement_type === 'REVERSAL') {
      category = 'CORRECTION'
      status = 'REVERSAL'
    } else {
      category = 'TOPUP'
    }

    const channel = wl.movement_type === 'TOPUP_ONLINE' ? 'DUITKU' : 'CASH'
    const itemLabel =
      wl.movement_type === 'REVERSAL'
        ? `Pembalikan Mutasi Dompet (Saldo: Rp${wl.balance_before.toLocaleString('id-ID')} -> Rp${wl.balance_after.toLocaleString('id-ID')})`
        : wl.movement_type === 'WITHDRAWAL_LOKET'
        ? `Penarikan Uang Jajan Tunai (Saldo: Rp${wl.balance_before.toLocaleString('id-ID')} -> Rp${wl.balance_after.toLocaleString('id-ID')})`
        : `Top-Up Uang Jajan Tunai (Saldo: Rp${wl.balance_before.toLocaleString('id-ID')} -> Rp${wl.balance_after.toLocaleString('id-ID')})`

    return {
      transaction: {
        id: wl.id,
        sourceTable: 'WALLET',
        transactionNumber: COALESCE_REF(wl.reference_id, wl.id),
        category,
        categoryLabel: CATEGORY_MAP[category],
        fundType: 'TITIPAN_SANTRI',
        direction: wl.direction,
        amount: wl.amount,
        grossAmount: wl.amount,
        gatewayFee: 0,
        netAmount: wl.amount,
        channel,
        method: channel,
        status,
        itemType: 'UANG_JAJAN',
        itemLabel: 'Uang Jajan Santri',
        santriId: wl.santri_id,
        santriName: wl.santri_name,
        santriNis: wl.santri_nis,
        santriAsrama: wl.santri_asrama,
        santriKamar: wl.santri_kamar,
        recipientInfo: null,
        operatorName: wl.operator_name,
        externalReference: wl.reference_id,
        notes: wl.notes,
        createdAt: wl.created_at,
      },
      allocations: [
        {
          id: wl.id,
          itemType: 'UANG_JAJAN',
          itemLabel,
          amount: wl.amount,
          disbursedAmount: 0,
          distributionStatus: 'N/A',
        },
      ],
      auditTrail: {
        cashSessionCode: wl.session_code,
        externalReference: wl.reference_id,
      },
    }
  }

  if (sourceTable === 'DISTRIBUTION') {
    const d = await queryOne<{
      id: string
      distribution_number: string
      recipient_type: string
      recipient_id: string | null
      recipient_name: string | null
      item_type: string
      period: string
      total_amount: number
      method: string
      destination_bank: string | null
      destination_account: string | null
      account_holder_name: string | null
      proof_attachment_url: string | null
      transferred_at: string
      operator_name: string | null
      notes: string | null
    }>(
      `SELECT
         d.*,
         j.nama_jasa AS recipient_name,
         u.full_name AS operator_name
       FROM finance_distributions d
       LEFT JOIN master_jasa j ON j.id = d.recipient_id
       LEFT JOIN users u ON u.id = d.transferred_by
       WHERE d.id = ?`,
      [id]
    )

    if (!d) return null

    const items = await query<{
      id: string
      amount: number
      santri_name: string | null
      santri_nis: string | null
      payment_number: string | null
    }>(
      `SELECT
         di.id,
         di.amount,
         s.nama_lengkap AS santri_name,
         s.nis AS santri_nis,
         p.payment_number
       FROM finance_distribution_items di
       JOIN finance_allocations a ON a.id = di.allocation_id
       JOIN finance_payments p ON p.id = a.payment_id
       LEFT JOIN santri s ON s.id = p.santri_id
       WHERE di.distribution_id = ?`,
      [id]
    )

    return {
      transaction: {
        id: d.id,
        sourceTable: 'DISTRIBUTION',
        transactionNumber: d.distribution_number,
        category: 'DISTRIBUTION',
        categoryLabel: CATEGORY_MAP.DISTRIBUTION,
        fundType: 'PESANTREN',
        direction: 'OUT',
        amount: d.total_amount,
        grossAmount: d.total_amount,
        gatewayFee: 0,
        netAmount: d.total_amount,
        channel: d.method,
        method: d.method,
        status: 'COMPLETED',
        itemType: d.item_type,
        itemLabel: FINANCE_ITEM_LABELS[d.item_type as FinanceItemType] || d.item_type,
        santriId: null,
        santriName: null,
        santriNis: null,
        santriAsrama: null,
        santriKamar: null,
        recipientInfo: d.recipient_name || d.recipient_type,
        operatorName: d.operator_name,
        externalReference: d.destination_account,
        notes: d.notes,
        createdAt: d.transferred_at,
      },
      allocations: items.map((it) => ({
        id: it.id,
        itemType: d.item_type,
        itemLabel: `Alokasi Santri: ${it.santri_name || '-'} (${it.santri_nis || '-'}) - ${it.payment_number || '-'}`,
        amount: it.amount,
        disbursedAmount: it.amount,
        distributionStatus: 'DISBURSED',
      })),
      auditTrail: {
        bankDestination: d.destination_bank,
        accountNumber: d.destination_account,
        accountHolder: d.account_holder_name,
        proofAttachmentUrl: d.proof_attachment_url,
      },
    }
  }

  if (sourceTable === 'CORRECTION') {
    const c = await queryOne<{
      id: string
      correction_number: string
      correction_type: string
      target_payment_id: string
      payment_number: string
      santri_id: string | null
      santri_name: string | null
      santri_nis: string | null
      santri_asrama: string | null
      santri_kamar: string | null
      total_amount: number
      method: string | null
      reason: string
      cash_session_id: string | null
      session_code: string | null
      is_recovery_case: number
      recovery_status: string | null
      created_by: string
      creator_name: string | null
      approved_by: string | null
      approver_name: string | null
      created_at: string
    }>(
      `SELECT
         c.*,
         p.payment_number,
         s.id AS santri_id,
         s.nama_lengkap AS santri_name,
         s.nis AS santri_nis,
         s.asrama AS santri_asrama,
         s.kamar AS santri_kamar,
         cs.session_code,
         u1.full_name AS creator_name,
         u2.full_name AS approver_name
       FROM finance_corrections c
       JOIN finance_payments p ON p.id = c.target_payment_id
       LEFT JOIN santri s ON s.id = p.santri_id
       LEFT JOIN finance_cash_sessions cs ON cs.id = c.cash_session_id
       LEFT JOIN users u1 ON u1.id = c.created_by
       LEFT JOIN users u2 ON u2.id = c.approved_by
       WHERE c.id = ?`,
      [id]
    )

    if (!c) return null

    const items = await query<{
      id: string
      target_type: string
      amount: number
      item_type: string | null
    }>(
      `SELECT
         ci.id,
         ci.target_type,
         ci.amount,
         o.item_type
       FROM finance_correction_items ci
       LEFT JOIN finance_obligations o ON o.id = ci.obligation_id
       WHERE ci.correction_id = ?`,
      [id]
    )

    return {
      transaction: {
        id: c.id,
        sourceTable: 'CORRECTION',
        transactionNumber: c.correction_number,
        category: 'CORRECTION',
        categoryLabel: CATEGORY_MAP.CORRECTION,
        fundType: 'PESANTREN',
        direction: 'OUT',
        amount: c.total_amount,
        grossAmount: c.total_amount,
        gatewayFee: 0,
        netAmount: c.total_amount,
        channel: c.method || 'SYSTEM',
        method: c.method || 'SYSTEM',
        status: c.correction_type,
        itemType: 'KOREKSI',
        itemLabel: `Koreksi ${c.correction_type}`,
        santriId: c.santri_id,
        santriName: c.santri_name,
        santriNis: c.santri_nis,
        santriAsrama: c.santri_asrama,
        santriKamar: c.santri_kamar,
        recipientInfo: null,
        operatorName: c.creator_name,
        externalReference: c.payment_number,
        notes: c.reason,
        createdAt: c.created_at,
      },
      allocations: items.map((it) => ({
        id: it.id,
        itemType: it.item_type || it.target_type,
        itemLabel: `Pembalikan Alokasi: ${it.item_type || it.target_type}`,
        amount: it.amount,
        disbursedAmount: 0,
        distributionStatus: 'N/A',
      })),
      auditTrail: {
        reason: c.reason,
        approvedBy: c.approver_name,
        cashSessionCode: c.session_code,
        recoveryStatus: c.is_recovery_case ? (c.recovery_status || 'PENDING_RECOVERY') : null,
      },
    }
  }

  return null
}

/**
 * Mengambil daftar opsi filter (asrama, kategori, kanal, status) untuk toolbar UI.
 */
export async function getHistoryFilterOptions(): Promise<FilterOptionsData> {
  const asramaRows = await query<{ asrama: string }>(
    `SELECT DISTINCT asrama FROM santri WHERE asrama IS NOT NULL AND TRIM(asrama) != '' ORDER BY asrama ASC`,
    []
  )

  return {
    asramaList: asramaRows.map((r) => r.asrama),
    categoryList: [
      { value: 'ALL', label: 'Semua Kategori' },
      { value: 'PAYMENT', label: 'Pembayaran Tagihan' },
      { value: 'TOPUP', label: 'Top-Up Uang Jajan' },
      { value: 'WITHDRAWAL', label: 'Penarikan Loket' },
      { value: 'DISTRIBUTION', label: 'Penyaluran Dana' },
      { value: 'CORRECTION', label: 'Koreksi (Void/Refund/Reversal)' },
    ],
    itemTypeList: [
      { value: 'ALL', label: 'Semua Pos Biaya' },
      { value: 'SPP', label: 'SPP' },
      { value: 'UANG_MAKAN', label: 'Uang Makan' },
      { value: 'UANG_NYUCI', label: 'Uang Nyuci' },
      { value: 'USPP', label: 'USPP' },
      { value: 'EHB', label: 'EHB' },
      { value: 'EKSKUL', label: 'Ekstrakurikuler' },
      { value: 'KESEHATAN', label: 'Kesehatan' },
      { value: 'UANG_JAJAN', label: 'Uang Jajan Santri' },
    ],
    channelList: [
      { value: 'ALL', label: 'Semua Kanal & Metode' },
      { value: 'DUITKU', label: 'Online Duitku' },
      { value: 'CASH', label: 'Tunai Loket' },
      { value: 'TRANSFER', label: 'Transfer Bank' },
    ],
    statusList: [
      { value: 'ALL', label: 'Semua Status' },
      { value: 'PAID', label: 'PAID (Berhasil)' },
      { value: 'SETTLED', label: 'SETTLED (Masuk Rekening)' },
      { value: 'COMPLETED', label: 'COMPLETED (Tuntas)' },
      { value: 'VOID', label: 'VOID (Batal)' },
      { value: 'REVERSAL', label: 'REVERSAL (Dibalikkan)' },
      { value: 'REFUND', label: 'REFUND (Dikembalikan)' },
    ],
  }
}

function COALESCE_REF(ref: string | null, id: string): string {
  if (ref && ref.trim() !== '') return ref
  return `WLT-${id.slice(0, 8).toUpperCase()}`
}
