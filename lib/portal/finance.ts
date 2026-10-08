// lib/portal/finance.ts
// Modul Integrasi Finansial Portal Orang Tua ke Sistem Keuangan Baru
// Menggabungkan pembacaan tagihan authoritative, kalkulasi cicilan,
// pembuatan payment order online BRI (payer_type = 'PORTAL_ORTU'),
// top-up uang jajan, batas limit dompet, dan riwayat transaksi terpadu.

import { cache } from 'react'
import { query, queryOne } from '@/lib/db'
import { createPaymentOrder, getPaymentOrderById } from '@/lib/finance/orders'
import { getStudentFixedVa } from '@/lib/finance/va'
import { getEffectiveCooperativeAdminFee } from '@/lib/finance/cooperative-admin'
import {
  getStudentWalletBalance,
  getParentWalletLimits,
  setParentWalletLimits,
  getGlobalDailyLimit,
} from '@/lib/finance/wallet'
import { ensureObligation } from '@/lib/finance/obligations'
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
  gatewayInfo?: {
    isOnlineAvailable?: boolean
    unavailableReason?: string
    enabledChannels: Array<'BRI_VA'>
    feePayer: 'CUSTOMER' | 'INSTITUTION'
    defaultVaFee: number
    defaultQrisFeePercent: number
  }
}

export interface PortalCheckoutInput {
  santriId: string
  paymentMethod?: 'BRI_VA'
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

  // 2. On-demand materialisasi kewajiban (past, current, upcoming) secara aman & idempotent
  const todayWib = toWibDateInputValue()
  const currentMonthlyPeriod = todayWib.slice(0, 7) // 'YYYY-MM'
  const currentYear = parseInt(todayWib.slice(0, 4), 10)
  const currentMonth = parseInt(todayWib.slice(5, 7), 10)
  const currentAcademicStartYear = currentMonth >= 7 ? currentYear : currentYear - 1
  const currentAcademicEndYear = currentAcademicStartYear + 1
  const currentAnnualPeriod = String(currentAcademicStartYear)

  // Kumpulkan daftar periode bulanan relevan:
  // - Seluruh bulan dalam Tahun Ajaran berjalan (Juli s.d. Juni)
  // - Serta hingga 6 bulan mendatang dari bulan berjalan
  const candidatePeriods: string[] = []
  for (let m = 7; m <= 12; m++) {
    candidatePeriods.push(`${currentAcademicStartYear}-${String(m).padStart(2, '0')}`)
  }
  for (let m = 1; m <= 6; m++) {
    candidatePeriods.push(`${currentAcademicEndYear}-${String(m).padStart(2, '0')}`)
  }
  for (let i = 1; i <= 6; i++) {
    let nextM = currentMonth + i
    let nextY = currentYear
    if (nextM > 12) {
      nextM -= 12
      nextY += 1
    }
    const p = `${nextY}-${String(nextM).padStart(2, '0')}`
    if (!candidatePeriods.includes(p)) {
      candidatePeriods.push(p)
    }
  }
  candidatePeriods.sort()

  // Ambil record kewajiban santri yang sudah ada secara batch (1 query)
  // untuk menghindari 58 query berurutan yang memicu latensi tinggi.
  const existingRecords = await query<{ item_type: string; period: string }>(
    `SELECT item_type, period FROM finance_obligations WHERE santri_id = ?`,
    [santriId]
  )
  const existingSet = new Set(existingRecords.map(r => `${r.item_type}:${r.period}`))

  const missingTasks: Array<Promise<unknown>> = []
  // Santri bebas tagihan (penduduk setempat, AL-BAGHORY) tidak boleh memiliki
  // kewajiban apa pun, sehingga materialisasi kewajiban dilewati sepenuhnya.
  const bisaDimaterialisasi = !santriBebasTagihan

  // Hanya jalankan ensureObligation untuk kewajiban yang BELUM ada di database
  for (const p of candidatePeriods) {
    if (bisaDimaterialisasi && !existingSet.has(`SPP:${p}`)) {
      missingTasks.push(ensureObligation(santriId, 'SPP', p).catch(() => null))
    }
    if (bisaDimaterialisasi && santri.tempat_makan_id && !existingSet.has(`UANG_MAKAN:${p}`)) {
      missingTasks.push(ensureObligation(santriId, 'UANG_MAKAN', p).catch(() => null))
    }
    if (bisaDimaterialisasi && santri.tempat_mencuci_id && !existingSet.has(`UANG_NYUCI:${p}`)) {
      missingTasks.push(ensureObligation(santriId, 'UANG_NYUCI', p).catch(() => null))
    }
  }

  // Materialisasi tahunan periode berjalan jika belum ada
  if (bisaDimaterialisasi && !existingSet.has(`EHB:${currentAnnualPeriod}`)) {
    missingTasks.push(ensureObligation(santriId, 'EHB', currentAnnualPeriod).catch(() => null))
  }
  if (bisaDimaterialisasi && !existingSet.has(`EKSKUL:${currentAnnualPeriod}`)) {
    missingTasks.push(ensureObligation(santriId, 'EKSKUL', currentAnnualPeriod).catch(() => null))
  }
  if (bisaDimaterialisasi && !existingSet.has(`KESEHATAN:${currentAnnualPeriod}`)) {
    missingTasks.push(ensureObligation(santriId, 'KESEHATAN', currentAnnualPeriod).catch(() => null))
  }

  // Materialisasi USPP (Lifetime) jika belum ada
  if (bisaDimaterialisasi && !existingSet.has('USPP:LIFETIME')) {
    missingTasks.push(ensureObligation(santriId, 'USPP', 'LIFETIME').catch(() => null))
  }

  // Eksekusi pembuatan kewajiban yang belum ada secara paralel (bukan sekuensial)
  if (missingTasks.length > 0) {
    await Promise.all(missingTasks)
  }

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
     WHERE o.santri_id = ? AND o.status NOT IN ('PAID', 'EXEMPTED')
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

    let periodType: 'PAST' | 'CURRENT' | 'UPCOMING' = 'CURRENT'
    let isTunggakan = false

    if (r.item_type === 'USPP') {
      periodType = 'CURRENT'
      isTunggakan = false
    } else if (r.item_type === 'EHB' || r.item_type === 'EKSKUL' || r.item_type === 'KESEHATAN') {
      if (r.period < currentAnnualPeriod) {
        periodType = 'PAST'
        isTunggakan = true
      } else if (r.period === currentAnnualPeriod) {
        periodType = 'CURRENT'
        isTunggakan = false
      } else {
        periodType = 'UPCOMING'
        isTunggakan = false
      }
    } else {
      // Bulanan (SPP, UANG_MAKAN, UANG_NYUCI)
      if (r.period < currentMonthlyPeriod) {
        periodType = 'PAST'
        isTunggakan = true
      } else if (r.period === currentMonthlyPeriod) {
        periodType = 'CURRENT'
        isTunggakan = false
      } else {
        periodType = 'UPCOMING'
        isTunggakan = false
      }
    }

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
    } else if (r.item_type === 'EHB' || r.item_type === 'EKSKUL' || r.item_type === 'KESEHATAN') {
      annual.push(item)
      totalRemaining += remaining
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
     WHERE santri_id = ? AND status = 'PENDING' AND datetime(expires_at) > datetime('now')
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

  const effectiveCoopFee = await getEffectiveCooperativeAdminFee().catch(() => 0)

    const brivaGate = await isOnlineBrivaAvailable(santriId)

    return {
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
      gatewayInfo: {
        isOnlineAvailable: brivaGate.available,
        unavailableReason: brivaGate.reason,
        enabledChannels: brivaGate.available ? ['BRI_VA'] : [],
        feePayer: 'CUSTOMER',
        defaultVaFee: effectiveCoopFee,
        defaultQrisFeePercent: 0,
      },
    }
  }
)

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
  const gate = await isOnlineBrivaAvailable(santriId)
  if (!gate.available) {
    throw new Error(gate.reason)
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
    const amount = Math.floor(item.amount)
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
      const ensured = await ensureObligation(santriId, item.itemType as FinanceItemType, item.period)
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

  // 2. Tentukan metode pembayaran & biaya administrasi koperasi
  const method = 'BRI_VA'
  const cooperativeAdminFee = await getEffectiveCooperativeAdminFee().catch(() => 0)

  // 3. Buat Payment Order via Engine Locked
  const orderWithItems = await createPaymentOrder({
    santriId,
    payerType: 'PORTAL_ORTU',
    items: orderItems,
    paymentMethod: method,
    cooperativeAdminFee,
    expiresInHours: 24,
  })

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
  }>(
    `SELECT id, order_number, gross_amount, cooperative_admin_fee, total_charged, payment_method, expires_at, created_at
     FROM finance_payment_orders
     WHERE santri_id = ? AND status = 'PENDING' AND datetime(expires_at) > datetime('now')
     ORDER BY created_at DESC LIMIT 5`,
    [santriId]
  )

  for (const po of pendingOrders) {
    history.push({
      id: po.id,
      type: 'ORDER_PENDING',
      category: 'TAGIHAN',
      title: 'Menunggu Pembayaran',
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
