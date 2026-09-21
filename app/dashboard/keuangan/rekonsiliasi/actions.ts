'use server'

// app/dashboard/keuangan/rekonsiliasi/actions.ts
// Server actions untuk antarmuka modul Rekonsiliasi & Koreksi (Fase 8)

import { getSession, getEffectiveRoles, type SessionUser } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import { query } from '@/lib/db'
import {
  getReconciliationOverview,
  getUnallocatedReconciliationItems,
  resolveUnallocatedManualAllocation,
  getCashSessionReconciliationList,
  getPendingRecoveryCases,
} from '@/lib/finance/reconciliation'
import {
  getCandidatePaymentsForSettlement,
  createSettlementBatch,
  getSettlementsList,
  getSettlementDetail,
} from '@/lib/finance/settlement'
import {
  recordCorrection,
  getCorrectionHistory,
  getCorrectionDetail,
  resolveRecoveryCase,
} from '@/lib/finance/corrections'
import {
  previewLegacySync,
  executeBackfillLegacyPayments,
  type LegacySyncPreviewSummary,
  type LegacyBackfillReport,
  type LegacySourceType,
} from '@/lib/finance/bridge'
import type {
  ReconciliationKpiOverview,
  UnallocatedReconciliationRow,
  CashSessionReconciliationSummary,
  FinanceSettlement,
  FinanceCorrection,
  SettlementPaymentCandidate,
  CreateSettlementBatchInput,
  RecordCorrectionInput,
  ResolveManualAllocationInput,
  ResolveRecoveryCaseInput,
} from '@/lib/finance/reconciliation-types'

export interface UserReconciliationPermissions {
  canView: boolean
  canMutate: boolean
  role: string
}

export interface PeriodOption {
  value: string
  label: string
}

export interface ReconciliationPageData {
  activeTab: 'SETTLEMENT' | 'KAS_LOKET' | 'UNALLOCATED' | 'KOREKSI' | 'LEGACY_BRIDGE'
  selectedPeriod: string
  kpi: ReconciliationKpiOverview
  settlementData?: {
    candidates: SettlementPaymentCandidate[]
    history: {
      settlements: Array<FinanceSettlement & { verifier_name: string | null }>
      totalCount: number
      totalPages: number
      page: number
      pageSize: number
    }
  }
  cashData?: {
    sessions: CashSessionReconciliationSummary[]
    totalCount: number
    totalPages: number
    page: number
    pageSize: number
  }
  unallocatedData?: {
    items: UnallocatedReconciliationRow[]
    totalCount: number
    totalPages: number
    page: number
    pageSize: number
    recoveryCases: Array<
      FinanceCorrection & {
        creator_name: string | null
        payment_number: string
        santri_name: string
        nis: string
      }
    >
  }
  correctionData?: {
    corrections: Array<
      FinanceCorrection & {
        creator_name: string | null
        payment_number: string
        santri_name: string
        nis: string
      }
    >
    totalCount: number
    totalPages: number
    page: number
    pageSize: number
  }
  legacyBridgeData?: {
    preview: LegacySyncPreviewSummary
  }
  periodOptions: PeriodOption[]
  userPermissions: UserReconciliationPermissions
}

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function formatPeriodLabel(period: string): string {
  const parts = period.split('-')
  if (parts.length !== 2) return period
  const year = parseInt(parts[0], 10)
  const monthIdx = parseInt(parts[1], 10) - 1
  const monthName = BULAN_NAMES[monthIdx] ?? `Bulan ${parts[1]}`
  return `${monthName} ${year}`
}

function getDefaultPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function generatePeriodOptions(): PeriodOption[] {
  const options: PeriodOption[] = []
  const baseDate = new Date()
  for (let offset = 3; offset >= -12; offset--) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const val = `${y}-${m}`
    options.push({
      value: val,
      label: formatPeriodLabel(val),
    })
  }
  return options
}

async function checkUserPermissions(): Promise<{
  session: SessionUser | null
  perms: UserReconciliationPermissions
}> {
  const session = await getSession()
  if (!session) {
    return {
      session: null,
      perms: { canView: false, canMutate: false, role: 'anonymous' },
    }
  }

  const effectiveRoles = getEffectiveRoles(session)
  const primaryRole = effectiveRoles[0] || session.role || 'santri'

  const hasFeatureAccess = await canAccessFeatureForSession(
    session,
    '/dashboard/keuangan/rekonsiliasi'
  )

  const isPimpinan = effectiveRoles.includes('pimpinan')
  const isTester = effectiveRoles.includes('tester')
  const isBendaharaOrAdmin =
    effectiveRoles.includes('bendahara') ||
    effectiveRoles.includes('admin') ||
    session.role === 'admin'

  const canView = hasFeatureAccess || isPimpinan || isTester || isBendaharaOrAdmin
  const canMutate = canView && isBendaharaOrAdmin && !isPimpinan && !isTester

  return {
    session,
    perms: {
      canView,
      canMutate,
      role: primaryRole,
    },
  }
}

/**
 * Mengambil data halaman Rekonsiliasi & Koreksi sesuai tab aktif dan filter.
 */
export async function getReconciliationPageData(params?: {
  tab?: 'SETTLEMENT' | 'KAS_LOKET' | 'UNALLOCATED' | 'KOREKSI' | 'LEGACY_BRIDGE'
  period?: string
  page?: number
  search?: string
  status?: string
}): Promise<ReconciliationPageData> {
  const { perms } = await checkUserPermissions()
  const activeTab = params?.tab || 'SETTLEMENT'
  const selectedPeriod = params?.period || getDefaultPeriod()
  const periodOptions = generatePeriodOptions()

  const kpiPromise = getReconciliationOverview(selectedPeriod)

  let settlementData
  let cashData
  let unallocatedData
  let correctionData
  let legacyBridgeData

  if (activeTab === 'SETTLEMENT') {
    const [candidates, history] = await Promise.all([
      getCandidatePaymentsForSettlement(selectedPeriod),
      getSettlementsList({
        period: selectedPeriod,
        page: params?.page ?? 1,
        pageSize: 10,
      }),
    ])
    settlementData = { candidates, history }
  } else if (activeTab === 'KAS_LOKET') {
    cashData = await getCashSessionReconciliationList({
      period: selectedPeriod,
      status: params?.status,
      page: params?.page ?? 1,
      pageSize: 10,
    })
  } else if (activeTab === 'UNALLOCATED') {
    const [itemsRes, recoveryCases] = await Promise.all([
      getUnallocatedReconciliationItems({
        period: selectedPeriod,
        resolved: params?.status === 'ALL' || params?.status === 'RESOLVED' ? params.status : 'UNRESOLVED',
        search: params?.search,
        page: params?.page ?? 1,
        pageSize: 10,
      }),
      getPendingRecoveryCases({
        period: selectedPeriod,
      }),
    ])
    unallocatedData = {
      items: itemsRes.items,
      totalCount: itemsRes.totalCount,
      totalPages: itemsRes.totalPages,
      page: itemsRes.page,
      pageSize: itemsRes.pageSize,
      recoveryCases,
    }
  } else if (activeTab === 'KOREKSI') {
    correctionData = await getCorrectionHistory({
      type: params?.status,
      search: params?.search,
      page: params?.page ?? 1,
      pageSize: 10,
    })
  } else if (activeTab === 'LEGACY_BRIDGE') {
    const preview = await previewLegacySync()
    legacyBridgeData = { preview }
  }

  const kpi = await kpiPromise

  return {
    activeTab,
    selectedPeriod,
    kpi,
    settlementData,
    cashData,
    unallocatedData,
    correctionData,
    legacyBridgeData,
    periodOptions,
    userPermissions: perms,
  }
}

/**
 * Server Action: Eksekusi Batch Settlement Bank
 */
export async function createSettlementBatchAction(
  input: Omit<CreateSettlementBatchInput, 'verifiedBy'>
): Promise<{ success: boolean; message: string; settlementId?: string }> {
  const { session, perms } = await checkUserPermissions()
  if (!perms.canMutate || !session) {
    return {
      success: false,
      message: 'Akses ditolak: Anda tidak memiliki wewenang untuk mencatat settlement bank.',
    }
  }

  try {
    const res = await createSettlementBatch({
      ...input,
      verifiedBy: session.id,
    })
    return {
      success: true,
      message: `Batch settlement ${res.settlement.settlement_number} berhasil dicatat (${res.itemsCount} pembayaran di-settle).`,
      settlementId: res.settlement.id,
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Terjadi kesalahan saat mencatat settlement.',
    }
  }
}

/**
 * Server Action: Eksekusi Resolusi Alokasi Manual untuk Transaksi Unallocated
 */
export async function resolveUnallocatedManualAction(
  input: Omit<ResolveManualAllocationInput, 'resolvedBy'>
): Promise<{ success: boolean; message: string }> {
  const { session, perms } = await checkUserPermissions()
  if (!perms.canMutate || !session) {
    return {
      success: false,
      message: 'Akses ditolak: Anda tidak memiliki wewenang untuk menyelesaikan transaksi tak bertuan.',
    }
  }

  try {
    await resolveUnallocatedManualAllocation({
      ...input,
      resolvedBy: session.id,
    })
    return {
      success: true,
      message: 'Alokasi manual transaksi berhasil dieksekusi secara atomik.',
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengeksekusi alokasi manual.',
    }
  }
}

/**
 * Server Action: Eksekusi Koreksi Finansial (VOID, REVERSAL, REFUND)
 */
export async function recordCorrectionAction(
  input: Omit<RecordCorrectionInput, 'createdBy'>
): Promise<{ success: boolean; message: string; correctionNumber?: string }> {
  const { session, perms } = await checkUserPermissions()
  if (!perms.canMutate || !session) {
    return {
      success: false,
      message: 'Akses ditolak: Anda tidak memiliki hak akses untuk mengoreksi transaksi finansial.',
    }
  }

  try {
    const detail = await recordCorrection({
      ...input,
      createdBy: session.id,
    })
    const corr = detail.correction
    const recoveryNote = corr.is_recovery_case === 1 ? ' [Peringatan: Kasus Pemulihan Dana dicatat karena alokasi telah disalurkan]' : ''
    return {
      success: true,
      message: `Koreksi ${corr.correction_type} (${corr.correction_number}) berhasil dieksekusi secara non-destruktif.${recoveryNote}`,
      correctionNumber: corr.correction_number,
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses koreksi finansial.',
    }
  }
}

/**
 * Server Action: Resolusi Kasus Pemulihan Dana (Recovery Case)
 */
export async function resolveRecoveryCaseAction(
  input: Omit<ResolveRecoveryCaseInput, 'resolvedBy'>
): Promise<{ success: boolean; message: string }> {
  const { session, perms } = await checkUserPermissions()
  if (!perms.canMutate || !session) {
    return {
      success: false,
      message: 'Akses ditolak: Anda tidak memiliki wewenang untuk menyelesaikan kasus pemulihan dana.',
    }
  }

  try {
    await resolveRecoveryCase({
      ...input,
      resolvedBy: session.id,
    })
    return {
      success: true,
      message: 'Kasus Pemulihan Dana berhasil ditandai selesai (RECOVERED).',
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Gagal menyelesaikan kasus pemulihan dana.',
    }
  }
}

/**
 * Mengambil kewajiban santri yang belum lunas untuk opsi pilihan alokasi manual
 */
export async function getStudentUnpaidObligations(santriId: string): Promise<
  Array<{
    id: string
    item_type: string
    period: string
    amount_expected: number
    amount_paid: number
    amount_exempted: number
    remaining: number
  }>
> {
  const rows = await query<{
    id: string
    item_type: string
    period: string
    amount_expected: number
    amount_paid: number
    amount_exempted: number
  }>(
    `SELECT id, item_type, period, amount_expected, amount_paid, amount_exempted
     FROM finance_obligations
     WHERE santri_id = ?
       AND status IN ('UNPAID', 'PARTIALLY_PAID')
     ORDER BY period ASC, item_type ASC`,
    [santriId]
  )

  return (rows || []).map((r) => {
    const effective = Math.max(0, r.amount_expected - r.amount_exempted)
    const remaining = Math.max(0, effective - r.amount_paid)
    return {
      ...r,
      remaining,
    }
  })
}

/**
 * Mengambil alokasi dari suatu pembayaran untuk keperluan modal koreksi
 */
export async function getPaymentAllocationsForCorrection(paymentId: string): Promise<
  Array<{
    id: string
    target_type: 'OBLIGATION' | 'UANG_JAJAN'
    item_type: string
    amount: number
    disbursed_amount: number
    distribution_status: string
    remaining_correctable: number
  }>
> {
  const rows = await query<{
    id: string
    target_type: 'OBLIGATION' | 'UANG_JAJAN'
    item_type: string
    amount: number
    disbursed_amount: number
    distribution_status: string
  }>(
    `SELECT id, target_type, item_type, amount, disbursed_amount, distribution_status
     FROM finance_allocations
     WHERE payment_id = ?`,
    [paymentId]
  )

  const res = []
  for (const r of rows || []) {
    const prevCorr = await query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM finance_correction_items
       WHERE target_allocation_id = ?`,
      [r.id]
    )
    const correctedAmount = prevCorr[0]?.total ?? 0
    const remainingCorrectable = Math.max(0, r.amount - correctedAmount)
    res.push({
      ...r,
      remaining_correctable: remainingCorrectable,
    })
  }

  return res
}

/**
 * Mengambil detail settlement untuk view modal/drawer
 */
export async function getSettlementDetailAction(settlementId: string) {
  return await getSettlementDetail(settlementId)
}

/**
 * Mengambil detail koreksi untuk view modal/drawer
 */
export async function getCorrectionDetailAction(correctionId: string) {
  return await getCorrectionDetail(correctionId)
}

/**
 * Mencari data pembayaran berdasarkan payment_number untuk modal koreksi
 */
export async function findPaymentForCorrection(paymentNumber: string): Promise<{
  success: boolean
  error?: string
  payment?: {
    id: string
    payment_number: string
    gross_amount: number
    channel: string
    santri_name: string
    cash_session_id?: string | null
  }
}> {
  const rows = await query<{
    id: string
    payment_number: string
    gross_amount: number
    channel: string
    status: string
    cash_session_id: string | null
    santri_name: string
  }>(
    `SELECT p.id, p.payment_number, p.gross_amount, p.channel, p.status, p.cash_session_id,
            s.nama_lengkap AS santri_name
     FROM finance_payments p
     JOIN santri s ON p.santri_id = s.id
     WHERE p.payment_number = ?
     LIMIT 1`,
    [paymentNumber.trim()]
  )

  if (!rows || rows.length === 0) {
    return { success: false, error: 'Nomor pembayaran tidak ditemukan.' }
  }

  const p = rows[0]
  if (p.status !== 'PAID') {
    return {
      success: false,
      error: `Pembayaran berstatus ${p.status}. Hanya pembayaran berstatus PAID yang dapat dikoreksi.`,
    }
  }

  return {
    success: true,
    payment: {
      id: p.id,
      payment_number: p.payment_number,
      gross_amount: p.gross_amount,
      channel: p.channel,
      santri_name: p.santri_name,
      cash_session_id: p.cash_session_id,
    },
  }
}

/**
 * Server Action: Ambil pratinjau data sinkronisasi modul lama
 */
export async function getLegacySyncPreviewAction(): Promise<{
  success: boolean
  preview?: LegacySyncPreviewSummary
  error?: string
}> {
  const { perms } = await checkUserPermissions()
  if (!perms.canView) {
    return { success: false, error: 'Akses ditolak.' }
  }
  try {
    const preview = await previewLegacySync()
    return { success: true, preview }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal mengambil pratinjau sinkronisasi modul lama.' }
  }
}

/**
 * Server Action: Eksekusi batch sinkronisasi modul lama (idempoten & non-destruktif)
 */
export async function executeLegacyBackfillAction(options?: {
  limit?: number
  source?: LegacySourceType
}): Promise<{
  success: boolean
  report?: LegacyBackfillReport
  error?: string
}> {
  const { session, perms } = await checkUserPermissions()
  if (!perms.canMutate || !session) {
    return { success: false, error: 'Anda tidak memiliki izin untuk mengeksekusi sinkronisasi modul lama.' }
  }
  try {
    const report = await executeBackfillLegacyPayments(options)
    return { success: true, report }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Gagal mengeksekusi sinkronisasi modul lama.' }
  }
}
