import { ensureStudentBilling } from '@/lib/finance/billing'
import { createBillingIssuance } from '@/lib/finance/billing-issuance'
import { collectibleBillingSql } from '@/lib/finance/billing-legacy'
import { billingPhase, advanceBillingPeriods } from '@/lib/finance/billing-periods'
import { rupiah } from '@/lib/finance/money'
// lib/portal/finance.ts
// Modul Integrasi Finansial Portal Orang Tua ke Sistem Keuangan Baru
// Menggabungkan pembacaan tagihan authoritative, kalkulasi cicilan,
// pembuatan payment order online BRI (payer_type = 'PORTAL_ORTU'),
// top-up uang jajan, batas limit dompet, dan riwayat transaksi terpadu.

import { cache } from 'react'
import { query, queryOne, execute } from '@/lib/db'
import { createPaymentOrder, getPaymentOrderById, sweepExpiredTransferOrders } from '@/lib/finance/orders'
import { getStudentFixedVa } from '@/lib/finance/va'
import { getEffectiveCooperativeAdminFee, COOPERATIVE_FEE_CODES } from '@/lib/finance/cooperative-admin'
import { getTransferSettings, listTransferAccounts, parseAccountSnapshot, type PaymentChannelMode } from '@/lib/finance/transfer-config'
import { listTransferSubmissionsForStudent, type TransferSubmissionStatus } from '@/lib/finance/manual-transfer'
import {
  getStudentWalletBalance,
  getParentWalletLimits,
  setParentWalletLimits,
  getGlobalDailyLimit,
} from '@/lib/finance/wallet'
import { isAsramaBebasTagihan } from '@/lib/finance/non-billable-santri'
import { FINANCE_ITEM_LABELS, type FinanceItemType } from '@/lib/finance/types'
import { toWibDateInputValue } from '@/lib/date/wib'

export interface PortalObligationItem {
  id: string
  itemType: FinanceItemType
  itemLabel: string
  period: string
  periodLabel: string
  academicYearId: number | null
  academicYearName?: string | null
  amountExpected: number
  amountExempted: number
  amountPaid: number
  remaining: number
  installmentRule: 'ALLOWED' | 'DISALLOWED'
  providerName?: string | null
  periodType: 'PAST' | 'CURRENT' | 'UPCOMING'
  isTunggakan: boolean
}

export interface PortalStudentBillingData {
  billingWarnings: string[]
  advancePeriods: string[]
  santri: {
    id: string
    nis: string
    nama: string
    asrama: string | null
    kamar: string | null
    tempatMakan: string | null
    tempatMencuci: string | null
  }
  wallet: {
    balance: number
    globalDailyLimit: number
    parentDailyLimit: number | null
    parentWeeklyLimit: number | null
    parentMonthlyLimit: number | null
    effectiveDailyLimit: number
  }
  fixedVa: {
    vaNumber: string
    bankCode: string
  } | null
  obligations: {
    past: PortalObligationItem[]
    current: PortalObligationItem[]
    upcoming: PortalObligationItem[]
    monthly: PortalObligationItem[]
    annual: PortalObligationItem[]
    uspp: PortalObligationItem | null
    totalRemaining: number
  }
  pendingOrders: Array<{
    id: string
    orderNumber: string
    grossAmount: number
    cooperativeAdminFee: number
    totalCharged: number
    paymentMethod: string | null
    expiresAt: string
    createdAt: string
    items: Array<{ itemType: string; amount: number }>
  }>
  cooperativeFee: number
  paymentChannels: PortalPaymentChannels
  transfers: PortalTransferSummary[]
  gatewayInfo?: {
    isOnlineAvailable?: boolean
    unavailableReason?: string
    enabledChannels: Array<'BRI_VA' | 'MANUAL_TRANSFER'>
    feePayer: 'CUSTOMER' | 'INSTITUTION'
    defaultVaFee: number
    defaultQrisFeePercent: number
  }
}

export interface PortalTransferAccount {
  id: string
  bankName: string
  accountNumber: string
  accountHolder: string
  notes: string | null
}

export interface PortalPaymentChannels {
  mode: PaymentChannelMode
  briva: { enabled: boolean; available: boolean; reason: string; fee: number }
  transfer: {
    enabled: boolean
    available: boolean
    reason: string
    fee: number
    feeDeductEnabled: boolean
    proofDeadlineHours: number
    accounts: PortalTransferAccount[]
  }
}

/** A manual transfer as the parent sees it (status card + history). */
export interface PortalTransferSummary {
  submissionId: string
  submissionNumber: string
  orderId: string
  status: TransferSubmissionStatus
  expectedAmount: number
  uniqueCode: number
  cooperativeAdminFee: number
  grossAmount: number
  feeMode: 'ADD' | 'DEDUCT'
  destination: { bankName: string; accountNumber: string; accountHolder: string } | null
  expiresAt: string
  submittedAt: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  receivedAmount: number | null
  resolution: 'EXACT' | 'UNALLOCATED' | null
  createdAt: string
  hasProof: boolean
  items: Array<{ itemType: string; amount: number }>
}

export interface PortalCheckoutInput {
  santriId: string
  paymentMethod?: 'BRI_VA' | 'MANUAL_TRANSFER'
  feeMode?: 'ADD' | 'DEDUCT'
  destinationAccountId?: string
  topUpAmount?: number
  items: Array<{
    obligationId?: string | null
    itemType: string
    period?: string | null
    amount: number
  }>
}

export interface PortalCheckoutResponse {
  success: true
  order: {
    id: string
    orderNumber: string
    grossAmount: number
    cooperativeAdminFee: number
    totalCharged: number
    paymentMethod: string | null
    expiresAt: string
    fixedVaNumber: string | null
  }
  checkout: {
    paymentUrl?: string | null
    vaNumber?: string | null
    bankCode?: string
    instructions?: string[]
    transfer?: PortalTransferSummary | null
  }
}

export interface PortalTransactionHistoryItem {
  id: string
  type: 'PAYMENT' | 'TOPUP' | 'WITHDRAWAL' | 'ORDER_PENDING'
  category: 'TAGIHAN' | 'UANG_JAJAN'
  title: string
  referenceNumber: string
  amount: number
  grossAmount?: number
  cooperativeAdminFee?: number
  gatewayFee?: number
  channel?: string | null
  method?: string | null
  status: 'PAID' | 'PENDING' | 'EXPIRED' | 'CANCELLED' | 'COMPLETED'
  createdAt: string
  items?: Array<{
    itemType: string
    itemLabel: string
    amount: number
    period?: string | null
  }>
}

function formatPeriodLabel(period: string, itemType?: string): string {
  if (period === 'LIFETIME' || itemType === 'USPP') return 'USPP / Bangunan (Sekali Masuk)'
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-').map(Number)
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]
    return `${months[m - 1] || period} ${y}`
  }
  if (/^\d{4}$/.test(period)) {
    const startYear = parseInt(period, 10)
    return `Tahun Ajaran ${startYear}/${startYear + 1}`
  }
  return period
}

/**
 * Mengambil tagihan aktif dan status finansial santri untuk Portal Orang Tua.
 * Menjamin kewajiban bulan berjalan dan tahun berjalan termaterialisasi on-demand.
 */
export const getPortalStudentBilling = cache(async function getPortalStudentBilling(santriId: string): Promise<PortalStudentBillingData> {
  // 1. Ambil data santri aktif
  const santri = await queryOne<{
    id: string
    nis: string
    nama_lengkap: string
    status_global: string
    asrama: string | null
    kamar: string | null
    tempat_makan_id: string | null
    tempat_mencuci_id: string | null
    tempat_makan: string | null
    tempat_mencuci: string | null
  }>(
    `SELECT s.id, s.nis, s.nama_lengkap, s.status_global, s.asrama, s.kamar,
            s.tempat_makan_id, s.tempat_mencuci_id,
            m1.nama_jasa AS tempat_makan, m2.nama_jasa AS tempat_mencuci
     FROM santri s
     LEFT JOIN master_jasa m1 ON s.tempat_makan_id = m1.id
     LEFT JOIN master_jasa m2 ON s.tempat_mencuci_id = m2.id
     WHERE s.id = ?`,
    [santriId]
  )

  if (!santri || santri.status_global !== 'aktif') {
    throw new Error('Data santri tidak ditemukan atau santri sudah tidak berstatus aktif.')
  }

  // Guard bebas tagihan: santri penduduk setempat (AL-BAGHORY) tidak memiliki
  // kewajiban apa pun, sehingga materialisasi kewajiban tidak perlu dijalankan.
  const santriBebasTagihan = isAsramaBebasTagihan(santri.asrama)

  // Only issue the current period here. Future obligations are materialized on explicit selection.
  const issuance = await ensureStudentBilling(santriId)

  // 3. Query seluruh kewajiban aktif santri yang belum lunas
  const rawObligations = await query<{
    id: string
    item_type: string
    academic_year_id: number | null
    academic_year_name: string | null
    period: string
    amount_expected: number
    amount_exempted: number
    amount_paid: number
    status: string
    installment_rule: string | null
    provider_name: string | null
  }>(
    `SELECT o.id, o.item_type, o.academic_year_id, ta.nama AS academic_year_name,
            o.period, o.amount_expected, o.amount_exempted, o.amount_paid,
            o.status, t.installment_rule, m.nama_jasa AS provider_name
     FROM finance_obligations o
     LEFT JOIN finance_tariffs t ON o.tariff_id = t.id
     LEFT JOIN tahun_ajaran ta ON o.academic_year_id = ta.id
     LEFT JOIN master_jasa m ON o.provider_id = m.id
     WHERE o.santri_id = ? AND o.status NOT IN ('PAID', 'EXEMPTED') AND ${collectibleBillingSql('o')}
     ORDER BY o.period ASC, o.item_type ASC`,
    [santriId]
  )

  const past: PortalObligationItem[] = []
  const current: PortalObligationItem[] = []
  const upcoming: PortalObligationItem[] = []
  const monthly: PortalObligationItem[] = []
  const annual: PortalObligationItem[] = []
  let uspp: PortalObligationItem | null = null
  let totalRemaining = 0

  for (const r of rawObligations) {
    const expected = r.amount_expected ?? 0
    const exempted = r.amount_exempted ?? 0
    const paid = r.amount_paid ?? 0
    const remaining = Math.max(0, expected - exempted - paid)
    if (remaining <= 0) continue

    const rule = r.item_type === 'USPP'
      ? 'ALLOWED'
      : r.item_type === 'SPP'
      ? 'DISALLOWED'
      : ((r.installment_rule as 'ALLOWED' | 'DISALLOWED') || 'DISALLOWED')

    const periodType = billingPhase(r.item_type, r.period)
    const isTunggakan = periodType === 'PAST'

    const item: PortalObligationItem = {
      id: r.id,
      itemType: r.item_type as FinanceItemType,
      itemLabel: FINANCE_ITEM_LABELS[r.item_type as keyof typeof FINANCE_ITEM_LABELS] || r.item_type,
      period: r.period,
      periodLabel: formatPeriodLabel(r.period, r.item_type),
      academicYearId: r.academic_year_id,
      academicYearName: r.academic_year_name,
      amountExpected: expected,
      amountExempted: exempted,
      amountPaid: paid,
      remaining,
      installmentRule: rule,
      providerName: r.provider_name,
      periodType,
      isTunggakan,
    }

    if (r.item_type === 'USPP') {
      uspp = item
      totalRemaining += remaining
    } else if (r.item_type === 'EHB' || r.item_type === 'EKSKUL' || r.item_type === 'KESEHATAN') {
      annual.push(item)
      if (periodType !== 'UPCOMING') totalRemaining += remaining
      else upcoming.push(item)
    } else {
      monthly.push(item)
      if (periodType === 'PAST') {
        past.push(item)
        totalRemaining += remaining
      } else if (periodType === 'CURRENT') {
        current.push(item)
        totalRemaining += remaining
      } else {
        upcoming.push(item)
      }
    }
  }

  // 4. Saldo & Limit Dompet Uang Jajan
  const [walletBal, parentLimits, globalDailyLimit, fixedVa] = await Promise.all([
    getStudentWalletBalance(santriId).catch(() => ({ balance: 0, cachedBalance: 0 })),
    getParentWalletLimits(santriId).catch(() => null),
    getGlobalDailyLimit().catch(() => 100000),
    getStudentFixedVa(santriId).catch(() => null),
  ])

  const parentDaily = parentLimits?.parent_daily_limit ?? null
  const effectiveDailyLimit = parentDaily !== null ? Math.min(globalDailyLimit, parentDaily) : globalDailyLimit

  // 5. Query pending payment orders
  const pendingOrders = await query<{
    id: string
    order_number: string
    gross_amount: number
    cooperative_admin_fee: number
    total_charged: number
    payment_method: string | null
    expires_at: string
    created_at: string
  }>(
    `SELECT id, order_number, gross_amount, cooperative_admin_fee, total_charged, payment_method, expires_at, created_at
     FROM finance_payment_orders
     WHERE santri_id = ? AND status = 'PENDING' AND payment_method = 'BRI_VA' AND datetime(expires_at) > datetime('now')
     ORDER BY created_at DESC LIMIT 5`,
    [santriId]
  )

  let pendingWithItems: Array<{
    id: string
    orderNumber: string
    grossAmount: number
    cooperativeAdminFee: number
    totalCharged: number
    paymentMethod: string | null
    expiresAt: string
    createdAt: string
    items: Array<{ itemType: string; amount: number }>
  }> = []

  if (pendingOrders.length > 0) {
    const orderIds = pendingOrders.map(po => po.id)
    const placeholders = orderIds.map(() => '?').join(',')
    const allOrderItems = await query<{ order_id: string; item_type: string; amount: number }>(
      `SELECT order_id, item_type, amount FROM finance_order_items WHERE order_id IN (${placeholders})`,
      orderIds
    )
    const itemsMap = new Map<string, Array<{ itemType: string; amount: number }>>()
    for (const oi of allOrderItems) {
      let list = itemsMap.get(oi.order_id)
      if (!list) {
        list = []
        itemsMap.set(oi.order_id, list)
      }
      list.push({ itemType: oi.item_type, amount: oi.amount })
    }
    pendingWithItems = pendingOrders.map(po => ({
      id: po.id,
      orderNumber: po.order_number,
      grossAmount: po.gross_amount,
      cooperativeAdminFee: po.cooperative_admin_fee,
      totalCharged: po.total_charged,
      paymentMethod: po.payment_method,
      expiresAt: po.expires_at,
      createdAt: po.created_at,
      items: itemsMap.get(po.id) || [],
    }))
  }

  const effectiveCoopFee = await getEffectiveCooperativeAdminFee()

    const brivaGate = await isOnlineBrivaAvailable(santriId)
    const paymentChannels = await getPortalPaymentChannels(santriId, brivaGate, santriBebasTagihan)
    const transfers = await getPortalTransferSummaries(santriId)

    return {
      billingWarnings: issuance.warnings.length ? ['Sebagian tagihan perlu diperiksa petugas. Hubungi bagian keuangan untuk memastikan jumlah yang harus dibayar.'] : [],
      advancePeriods: advanceBillingPeriods(),
      santri: {
        id: santri.id,
        nis: santri.nis,
        nama: santri.nama_lengkap,
        asrama: santri.asrama,
        kamar: santri.kamar,
        tempatMakan: santri.tempat_makan,
        tempatMencuci: santri.tempat_mencuci,
      },
      wallet: {
        balance: walletBal.balance,
        globalDailyLimit,
        parentDailyLimit: parentLimits?.parent_daily_limit ?? null,
        parentWeeklyLimit: parentLimits?.parent_weekly_limit ?? null,
        parentMonthlyLimit: parentLimits?.parent_monthly_limit ?? null,
        effectiveDailyLimit,
      },
      fixedVa: fixedVa && brivaGate.available
        ? {
            vaNumber: fixedVa.va_number,
            bankCode: 'BRI',
          }
        : null,
      obligations: {
        past,
        current,
        upcoming,
        monthly,
        annual,
        uspp,
        totalRemaining,
      },
      pendingOrders: pendingWithItems,
      cooperativeFee: effectiveCoopFee,
      paymentChannels,
      transfers,
      gatewayInfo: {
        isOnlineAvailable: paymentChannels.briva.available || paymentChannels.transfer.available,
        unavailableReason: paymentChannels.briva.available || paymentChannels.transfer.available ? '' : (paymentChannels.transfer.enabled ? paymentChannels.transfer.reason : paymentChannels.briva.reason),
        enabledChannels: [
          ...(paymentChannels.briva.available ? ['BRI_VA' as const] : []),
          ...(paymentChannels.transfer.available ? ['MANUAL_TRANSFER' as const] : []),
        ],
        feePayer: 'CUSTOMER',
        defaultVaFee: effectiveCoopFee,
        defaultQrisFeePercent: 0,
      },
    }
  }
)

const OFFLINE_REASON = 'Pembayaran online belum dibuka. Pembayaran tagihan dan titipan uang jajan saat ini dilayani secara tunai di loket pesantren.'

/**
 * Jalur pembayaran yang terlihat oleh wali: gabungan pengaturan admin (BRIVA/Transfer/Keduanya)
 * dan gate teknis masing-masing jalur. Fail-closed: jalur yang tidak siap tidak ditawarkan.
 */
export async function getPortalPaymentChannels(
  santriId: string,
  brivaGate?: { available: boolean; reason: string },
  bebasTagihan = false
): Promise<PortalPaymentChannels> {
  const [settings, accounts, transferFee, brivaFee, gate] = await Promise.all([
    getTransferSettings(),
    listTransferAccounts({ activeOnly: true }),
    getEffectiveCooperativeAdminFee(COOPERATIVE_FEE_CODES.TRANSFER, new Date().toISOString(), 'TRANSFER'),
    getEffectiveCooperativeAdminFee(),
    brivaGate ? Promise.resolve(brivaGate) : isOnlineBrivaAvailable(santriId),
  ])
  const brivaEnabled = settings.channelMode === 'BRIVA' || settings.channelMode === 'BOTH'
  const transferEnabled = settings.channelMode === 'TRANSFER' || settings.channelMode === 'BOTH'
  const blocked = bebasTagihan ? 'Santri ini tidak memiliki layanan pembayaran online.' : ''
  const transferReason = blocked || (!transferEnabled ? '' : accounts.length ? '' : 'Rekening tujuan transfer belum disiapkan Koperasi. Silakan bayar di loket.')
  return {
    mode: settings.channelMode,
    briva: {
      enabled: brivaEnabled,
      available: !blocked && brivaEnabled && gate.available,
      reason: blocked || (!brivaEnabled ? '' : gate.available ? '' : gate.reason || OFFLINE_REASON),
      fee: brivaFee,
    },
    transfer: {
      enabled: transferEnabled,
      available: !blocked && transferEnabled && accounts.length > 0,
      reason: transferReason,
      fee: transferFee,
      feeDeductEnabled: settings.feeDeductEnabled,
      proofDeadlineHours: settings.proofDeadlineHours,
      accounts: accounts.map(account => ({
        id: account.id, bankName: account.bank_name, accountNumber: account.account_number,
        accountHolder: account.account_holder, notes: account.notes,
      })),
    },
  }
}

/** Recent manual transfers for status cards; open ones first. */
export async function getPortalTransferSummaries(santriId: string, limit = 10): Promise<PortalTransferSummary[]> {
  await sweepExpiredTransferOrders('portal-ortu')
  const rows = await listTransferSubmissionsForStudent(santriId, limit).catch(() => [])
  if (!rows.length) return []
  const items = await query<{ order_id: string; item_type: string; amount: number }>(
    `SELECT order_id, item_type, amount FROM finance_order_items WHERE order_id IN (${rows.map(() => '?').join(',')}) ORDER BY rowid`,
    rows.map(r => r.order_id)
  )
  return rows.map(row => {
    const destination = parseAccountSnapshot(row.destination_snapshot)
    return {
      submissionId: row.id,
      submissionNumber: row.submission_number,
      orderId: row.order_id,
      status: row.status,
      expectedAmount: row.expected_amount,
      uniqueCode: row.unique_code,
      cooperativeAdminFee: row.cooperative_admin_fee,
      grossAmount: row.gross_amount,
      feeMode: row.fee_mode,
      destination: destination ? { bankName: destination.bank_name, accountNumber: destination.account_number, accountHolder: destination.account_holder } : null,
      expiresAt: row.expires_at,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.status === 'DITOLAK' || row.status === 'PERLU_PERBAIKAN' ? row.review_notes : null,
      receivedAmount: row.received_amount,
      resolution: row.resolution,
      createdAt: row.created_at,
      hasProof: !!row.proof_object_key,
      items: items.filter(i => i.order_id === row.order_id).map(i => ({ itemType: i.item_type, amount: i.amount })),
    }
  })
}

/**
 * Evaluasi ketersediaan kanal pembayaran online (BRIVA) - FAIL-CLOSED FEATURE GATE.
 * Pada BRI-1, integrasi protokol bank belum aktif (dijadwalkan pada BRI-2/3).
 * Kanal online hanya aktif jika flag FEATURE_FLAG_BRIVA_ONLINE diaktifkan dan santri telah memiliki Fixed BRIVA aktif.
 */
export async function isOnlineBrivaAvailable(santriId?: string): Promise<{
  available: boolean
  reason: string
  vaNumber: string | null
}> {
  const isGateOpen = process.env.FEATURE_FLAG_BRIVA_ONLINE === 'true'
  if (!isGateOpen) {
    return {
      available: false,
      reason: 'Layanan pembayaran online (BRIVA) belum dibuka. Pembayaran tagihan dan titipan uang jajan saat ini dilayani secara tunai di loket pesantren.',
      vaNumber: null,
    }
  }

  if (!santriId) {
    return { available: false, reason: 'ID Santri tidak valid.', vaNumber: null }
  }

  const fixedVa = await getStudentFixedVa(santriId).catch(() => null)
  if (!fixedVa || fixedVa.status !== 'ACTIVE' || !fixedVa.va_number) {
    return {
      available: false,
      reason: 'Nomor Virtual Account BRI (BRIVA) santri belum diterbitkan oleh bank. Silakan hubungi bagian keuangan pesantren.',
      vaNumber: null,
    }
  }

  return {
    available: true,
    reason: '',
    vaNumber: fixedVa.va_number,
  }
}

/**
 * Membuat Payment Order online BRI dari Portal Orang Tua.
 * Penegakan aturan bisnis:
 * 1. Otorisasi server-side: hanya wali santri terkait yang dapat membuat pesanan.
 * 2. Fail-closed feature gate: menolak pembuatan order jika kanal BRIVA belum aktif/terverifikasi.
 * 3. SPP tidak boleh dicicil (harus lunas penuh sisa periode tsb).
 * 4. USPP dapat dicicil parsial.
 * 5. Uang Jajan dapat ditambahkan sebagai top-up dana titipan.
 * 6. Membuat finance_payment_orders dengan payer_type = 'PORTAL_ORTU'.
 * 7. Mengaitkan Fixed BRIVA santri dan Biaya Administrasi Koperasi.
 */
export async function createPortalPaymentOrder(
  santriId: string,
  input: PortalCheckoutInput
): Promise<PortalCheckoutResponse> {
  const method = input.paymentMethod === 'MANUAL_TRANSFER' ? 'MANUAL_TRANSFER' : 'BRI_VA'
  const channels = await getPortalPaymentChannels(santriId)
  if (method === 'BRI_VA' && !channels.briva.available) {
    throw new Error(channels.briva.reason || 'Pembayaran BRIVA sedang tidak tersedia.')
  }
  if (method === 'MANUAL_TRANSFER' && !channels.transfer.available) {
    throw new Error(channels.transfer.reason || 'Pembayaran transfer sedang tidak tersedia.')
  }
  if (method === 'MANUAL_TRANSFER' && !channels.transfer.accounts.some(a => a.id === input.destinationAccountId)) {
    throw new Error('Pilih rekening tujuan transfer.')
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('Pilih minimal satu item tagihan atau masukkan nominal top-up uang jajan.')
  }

  // 1. Validasi & Format Items
  const orderItems: Array<{
    obligationId?: string | null
    itemType: FinanceItemType | 'UANG_JAJAN'
    amount: number
  }> = []

  for (const item of input.items) {
    const amount = rupiah(item.amount)
    if (amount <= 0) {
      throw new Error(`Nominal item "${item.itemType}" harus lebih besar dari Rp0.`)
    }

    let obligation: {
      id: string
      santri_id: string
      item_type: string
      amount_expected: number
      amount_exempted: number
      amount_paid: number
      status: string
      installment_rule: string | null
    } | null = null

    if (item.obligationId) {
      obligation = await queryOne<{
        id: string
        santri_id: string
        item_type: string
        amount_expected: number
        amount_exempted: number
        amount_paid: number
        status: string
        installment_rule: string | null
      }>(
        `SELECT o.id, o.santri_id, o.item_type, o.amount_expected, o.amount_exempted,
                o.amount_paid, o.status, t.installment_rule
         FROM finance_obligations o
         LEFT JOIN finance_tariffs t ON o.tariff_id = t.id
         WHERE o.id = ?`,
        [item.obligationId]
      )
    } else if (item.itemType !== 'UANG_JAJAN' && item.period) {
      // Dynamic on-demand materialization using locked engine (PRD Section 12)
      const issuer = createBillingIssuance({ query,queryOne,execute })
      if (!advanceBillingPeriods().includes(item.period)) throw new Error('Periode pembayaran tidak tersedia. Muat ulang tagihan.')
      const issued = await issuer.issue(santriId, item.itemType as FinanceItemType, item.period)
      if (!issued.obligation || !['CREATED','EXISTING'].includes(issued.outcome)) throw new Error('Tagihan perlu diperiksa petugas sebelum dibayar.')
      const ensured = issued.obligation
      obligation = await queryOne<{
        id: string
        santri_id: string
        item_type: string
        amount_expected: number
        amount_exempted: number
        amount_paid: number
        status: string
        installment_rule: string | null
      }>(
        `SELECT o.id, o.santri_id, o.item_type, o.amount_expected, o.amount_exempted,
                o.amount_paid, o.status, t.installment_rule
         FROM finance_obligations o
         LEFT JOIN finance_tariffs t ON o.tariff_id = t.id
         WHERE o.id = ?`,
        [ensured.id]
      )
    }

    if (obligation) {
      if (obligation.santri_id !== santriId) {
        throw new Error('Akses ditolak: Tagihan ini bukan milik santri Anda.')
      }
      if (obligation.status === 'PAID') {
        throw new Error(`Tagihan "${item.itemType}" sudah lunas.`)
      }

      const remaining = Math.max(0, obligation.amount_expected - obligation.amount_exempted - obligation.amount_paid)
      if (amount > remaining) {
        throw new Error(
          `Nominal pembayaran Rp${amount.toLocaleString('id-ID')} melebihi sisa tagihan Rp${remaining.toLocaleString('id-ID')}.`
        )
      }

      // Aturan Cicilan: SPP tidak boleh dicicil
      const rule = obligation.item_type === 'USPP'
        ? 'ALLOWED'
        : obligation.item_type === 'SPP'
        ? 'DISALLOWED'
        : ((obligation.installment_rule as 'ALLOWED' | 'DISALLOWED') || 'DISALLOWED')

      if (rule === 'DISALLOWED' && amount < remaining) {
        throw new Error(
          `Pembayaran "${obligation.item_type}" tidak boleh dicicil. Harap bayar lunas sejumlah sisa tagihan (Rp${remaining.toLocaleString('id-ID')}).`
        )
      }

      orderItems.push({
        obligationId: obligation.id,
        itemType: obligation.item_type as FinanceItemType,
        amount,
      })
    } else if (item.itemType === 'UANG_JAJAN') {
      orderItems.push({
        obligationId: null,
        itemType: 'UANG_JAJAN',
        amount,
      })
    } else {
      throw new Error(`Tagihan "${item.itemType}" tidak ditemukan.`)
    }
  }

  // 2-3. Buat Payment Order via engine. Biaya admin & kode unik dihitung server dari snapshot rule.
  let orderWithItems: Awaited<ReturnType<typeof createPaymentOrder>> | null = null
  for (let attempt = 0; attempt < 3 && !orderWithItems; attempt++) {
    try {
      orderWithItems = await createPaymentOrder({
        santriId,
        payerType: 'PORTAL_ORTU',
        items: orderItems,
        paymentMethod: method,
        expiresInHours: 24,
        feeMode: method === 'MANUAL_TRANSFER' ? (input.feeMode === 'DEDUCT' ? 'DEDUCT' : 'ADD') : undefined,
        destinationAccountId: method === 'MANUAL_TRANSFER' ? input.destinationAccountId : undefined,
        createdByKind: 'PARENT',
      })
    } catch (error) {
      // Two parents may race for the same unique code; the partial unique index rejects one. Retry.
      const message = error instanceof Error ? error.message : ''
      if (method === 'MANUAL_TRANSFER' && message.includes('UNIQUE') && message.includes('total_charged') && attempt < 2) continue
      if (message.includes('uq_finance_payment_orders_single_active_online') || message.includes('TRANSFER_IN_REVIEW')) {
        throw new Error('Masih ada pembayaran yang sedang diproses. Muat ulang halaman.')
      }
      throw error
    }
  }
  if (!orderWithItems) throw new Error('Gagal membuat pembayaran. Coba lagi.')

  if (method === 'MANUAL_TRANSFER') {
    const transfer = (await getPortalTransferSummaries(santriId, 3)).find(t => t.orderId === orderWithItems!.id) || null
    return {
      success: true,
      order: {
        id: orderWithItems.id,
        orderNumber: orderWithItems.order_number,
        grossAmount: orderWithItems.gross_amount,
        cooperativeAdminFee: orderWithItems.cooperative_admin_fee,
        totalCharged: orderWithItems.total_charged,
        paymentMethod: orderWithItems.payment_method,
        expiresAt: orderWithItems.expires_at,
        fixedVaNumber: null,
      },
      checkout: { transfer },
    }
  }

  // 4. Instruksi pembayaran Virtual Account BRI (BRIVA)
  const fixedVa = orderWithItems.fixed_va_number || (await getStudentFixedVa(santriId).catch(() => null))?.va_number || null

  const checkoutData = {
    vaNumber: fixedVa,
    bankCode: 'BRI',
    instructions: [
      'Gunakan nomor Virtual Account BRI (BRIVA) santri di atas.',
      'Dapat dibayar melalui aplikasi BRImo, ATM BRI, AgenBRILink, atau Transfer Antar-Bank (Kode Bank 002).',
      'Pastikan nominal transfer sama persis dengan Total Tagihan.',
      'Pembayaran akan diverifikasi secara otomatis oleh sistem setelah dana diterima.',
    ],
  }

  return {
    success: true,
    order: {
      id: orderWithItems.id,
      orderNumber: orderWithItems.order_number,
      grossAmount: orderWithItems.gross_amount,
      cooperativeAdminFee: orderWithItems.cooperative_admin_fee,
      totalCharged: orderWithItems.total_charged,
      paymentMethod: orderWithItems.payment_method,
      expiresAt: orderWithItems.expires_at,
      fixedVaNumber: orderWithItems.fixed_va_number,
    },
    checkout: checkoutData,
  }
}

/**
 * Mengambil detail pembayaran pesanan tertentu untuk orang tua.
 */
export async function getPortalPaymentOrderDetail(
  santriId: string,
  orderId: string
) {
  const order = await getPaymentOrderById(orderId)
  if (!order) throw new Error('Pesanan pembayaran tidak ditemukan.')
  if (order.santri_id !== santriId) {
    throw new Error('Akses ditolak: Pesanan pembayaran ini bukan milik santri Anda.')
  }

  // Cek apakah sudah ada pembayaran sukses
  const payment = await queryOne<{
    id: string
    payment_number: string
    channel: string
    method: string
    paid_at: string
    status: string
  }>(
    `SELECT id, payment_number, channel, method, paid_at, status
     FROM finance_payments
     WHERE order_id = ? AND status = 'PAID' LIMIT 1`,
    [orderId]
  )

  return {
    order,
    payment: payment || null,
  }
}

/**
 * Mengambil riwayat finansial terpadu santri untuk Portal Orang Tua:
 * - Pembayaran tagihan resmi (finance_payments + allocations)
 * - Mutasi buku besar uang jajan (finance_wallet_ledger)
 * - Pesanan pembayaran pending (finance_payment_orders)
 */
export async function getPortalFinancialHistory(
  santriId: string,
  options?: { category?: 'ALL' | 'TAGIHAN' | 'UANG_JAJAN' }
): Promise<PortalTransactionHistoryItem[]> {
  const categoryFilter = options?.category || 'ALL'
  const history: PortalTransactionHistoryItem[] = []

  // 1. Ambil pembayaran resmi finance_payments
  if (categoryFilter === 'ALL' || categoryFilter === 'TAGIHAN') {
    const payments = await query<{
      id: string
      payment_number: string
      gross_amount: number
      cooperative_admin_fee: number
      net_amount: number
      channel: string
      method: string
      status: string
      paid_at: string
      created_at: string
    }>(
      `SELECT id, payment_number, gross_amount, cooperative_admin_fee, net_amount,
              channel, method, status, paid_at, created_at
       FROM finance_payments
       WHERE santri_id = ?
       ORDER BY paid_at DESC, id DESC LIMIT 50`,
      [santriId]
    )

    const paymentIds = payments.map(p => p.id)
    const allocationsMap = new Map<string, Array<{ item_type: string; amount: number; period: string | null }>>()

    if (paymentIds.length > 0) {
      const placeholders = paymentIds.map(() => '?').join(',')
      const allAllocations = await query<{
        payment_id: string
        item_type: string
        amount: number
        period: string | null
      }>(
        `SELECT a.payment_id, a.item_type, a.amount, o.period
         FROM finance_allocations a
         LEFT JOIN finance_obligations o ON a.obligation_id = o.id
         WHERE a.payment_id IN (${placeholders})`,
        paymentIds
      )

      for (const a of allAllocations) {
        let list = allocationsMap.get(a.payment_id)
        if (!list) {
          list = []
          allocationsMap.set(a.payment_id, list)
        }
        list.push({
          item_type: a.item_type,
          amount: a.amount,
          period: a.period,
        })
      }
    }

    for (const p of payments) {
      const allocations = allocationsMap.get(p.id) || []

      history.push({
        id: p.id,
        type: 'PAYMENT',
        category: 'TAGIHAN',
        title: allocations.length === 1
          ? `Pembayaran ${FINANCE_ITEM_LABELS[allocations[0].item_type as keyof typeof FINANCE_ITEM_LABELS] || allocations[0].item_type}`
          : `Pembayaran ${allocations.length} Pos Tagihan`,
        referenceNumber: p.payment_number,
        amount: p.gross_amount,
        grossAmount: p.gross_amount,
        cooperativeAdminFee: p.cooperative_admin_fee,
        gatewayFee: p.cooperative_admin_fee,
        channel: p.channel,
        method: p.method,
        status: p.status === 'PAID' || p.status === 'SETTLED' ? 'PAID' : 'COMPLETED',
        createdAt: p.paid_at || p.created_at,
        items: allocations.map(a => ({
          itemType: a.item_type,
          itemLabel: FINANCE_ITEM_LABELS[a.item_type as keyof typeof FINANCE_ITEM_LABELS] || a.item_type,
          amount: a.amount,
          period: a.period ? formatPeriodLabel(a.period, a.item_type) : null,
        })),
      })
    }
  }

  // 2. Ambil mutasi buku besar Uang Jajan
  if (categoryFilter === 'ALL' || categoryFilter === 'UANG_JAJAN') {
    const mutations = await query<{
      id: string
      direction: 'IN' | 'OUT'
      movement_type: string
      amount: number
      balance_before: number
      balance_after: number
      reference_id: string | null
      notes: string | null
      created_at: string
    }>(
      `SELECT id, direction, movement_type, amount, balance_before, balance_after,
              reference_id, notes, created_at
       FROM finance_wallet_ledger
       WHERE santri_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 50`,
      [santriId]
    )

    for (const m of mutations) {
      let title = 'Mutasi Uang Jajan'
      if (m.movement_type === 'TOPUP_ONLINE') title = 'Top-Up Uang Jajan (Online)'
      else if (m.movement_type === 'TOPUP_CASH') title = 'Setor Uang Jajan (Tunai Loket)'
      else if (m.movement_type === 'WITHDRAWAL_LOKET') title = 'Pencairan Uang Jajan (Loket)'
      else if (m.movement_type === 'REVERSAL') title = 'Koreksi Saldo Uang Jajan'
      else if (m.movement_type === 'TOPUP_TRANSFER') title = 'Isi Uang Jajan (Transfer Bank)'
      else if (m.movement_type === 'WITHDRAWAL_KOLEKTIF') title = 'Pencairan Uang Jajan (via Perwakilan)'
      else if (m.movement_type === 'WITHDRAWAL_KOLEKTIF_RETURN') title = 'Pencairan Dibatalkan — Saldo Dikembalikan'

      history.push({
        id: m.id,
        type: m.direction === 'IN' ? 'TOPUP' : 'WITHDRAWAL',
        category: 'UANG_JAJAN',
        title,
        referenceNumber: m.reference_id || `WLT-${m.id.slice(0, 8).toUpperCase()}`,
        amount: m.amount,
        status: 'COMPLETED',
        createdAt: m.created_at,
        items: [{
          itemType: 'UANG_JAJAN',
          itemLabel: title,
          amount: m.amount,
          period: null,
        }],
      })
    }
  }

  // 3. Ambil pesanan pending
  const pendingOrders = await query<{
    id: string
    order_number: string
    gross_amount: number
    cooperative_admin_fee: number
    total_charged: number
    payment_method: string | null
    expires_at: string
    created_at: string
    transfer_status: string | null
  }>(
    `SELECT o.id, o.order_number, o.gross_amount, o.cooperative_admin_fee, o.total_charged, o.payment_method, o.expires_at, o.created_at,
            s.status AS transfer_status
     FROM finance_payment_orders o
     LEFT JOIN finance_transfer_submissions s ON s.order_id = o.id
     WHERE o.santri_id = ? AND o.status = 'PENDING'
       AND (datetime(o.expires_at) > datetime('now') OR s.status IN ('MENUNGGU_VERIFIKASI', 'PERLU_PERBAIKAN'))
     ORDER BY o.created_at DESC LIMIT 5`,
    [santriId]
  )

  const pendingTitle: Record<string, string> = {
    MENUNGGU_BUKTI: 'Menunggu Bukti Transfer',
    MENUNGGU_VERIFIKASI: 'Sedang Dicek Petugas',
    PERLU_PERBAIKAN: 'Perlu Unggah Ulang Bukti',
  }
  for (const po of pendingOrders) {
    history.push({
      id: po.id,
      type: 'ORDER_PENDING',
      category: 'TAGIHAN',
      title: (po.transfer_status && pendingTitle[po.transfer_status]) || 'Menunggu Pembayaran',
      referenceNumber: po.order_number,
      amount: po.total_charged,
      grossAmount: po.gross_amount,
      cooperativeAdminFee: po.cooperative_admin_fee,
      gatewayFee: po.cooperative_admin_fee,
      method: po.payment_method,
      status: 'PENDING',
      createdAt: po.created_at,
    })
  }

  // Sort descending by createdAt
  history.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))

  return history
}

/**
 * Memperbarui limit uang jajan orang tua.
 */
export async function updatePortalWalletLimits(
  santriId: string,
  limits: {
    daily?: number | null
    weekly?: number | null
    monthly?: number | null
  }
): Promise<void> {
  await setParentWalletLimits(santriId, limits, null)
}
