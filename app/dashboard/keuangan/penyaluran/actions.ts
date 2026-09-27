'use server'

import {
  getSession,
  getEffectiveRoles,
  hasFinanceMutateRole,
  isDemoSandboxRequest,
} from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import {
  getDistributionSummary,
  getProviderDistributionList,
  getBendaharaDistributionList,
  executeDistribution,
  getProviderAccounts,
  createProviderAccount,
  updateProviderAccount,
  deleteProviderAccount,
  getDistributionHistory,
  getDistributionById,
  getProviderOperationalDetail,
  getProviderAccountTemplateData,
  importProviderAccounts,
  getBendaharaStudentsByItem,
} from '@/lib/finance/distributions'
import type {
  FinanceDistributionRecipientType,
  DistributionKpiSummary,
  ProviderDistributionSummaryRow,
  BendaharaDistributionSummaryRow,
  FinanceDistribution,
  FinanceProviderAccount,
  CreateDistributionInput,
  CreateProviderAccountInput,
  UpdateProviderAccountInput,
  DistributionDetailWithItems,
  ProviderOperationalDetailParams,
  ProviderOperationalDetailResult,
  ProviderAccountTemplatePayload,
  ValidatedImportAccountRow,
  BendaharaItemStudentsResult,
} from '@/lib/finance/distribution-types'
export interface UserPenyaluranPermissions {
  canView: boolean
  canDisburse: boolean
  role: string
}

export interface PeriodOption {
  value: string
  label: string
}

export interface PenyaluranPageData {
  activeTab: FinanceDistributionRecipientType | 'RIWAYAT'
  selectedPeriod: string
  summary: DistributionKpiSummary
  bendaharaRows: BendaharaDistributionSummaryRow[]
  providerRows: ProviderDistributionSummaryRow[]
  history: {
    items: Array<FinanceDistribution & { recipient_name: string; operator_name: string }>
    totalItems: number
    totalPages: number
    page: number
    pageSize: number
  }
  periodOptions: PeriodOption[]
  userPermissions: UserPenyaluranPermissions
}

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function formatPeriodLabel(period: string): string {
  if (period === 'LIFETIME') return 'Sepanjang Masa (USPP)'
  const parts = period.split('-')
  if (parts.length === 1) return `Tahun ${period}`
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

  // 12 bulan ke belakang sampai 6 bulan ke depan
  for (let offset = 6; offset >= -12; offset--) {
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

/**
 * Audit & Otorisasi Server Action Penyaluran:
 * - Memastikan sesi valid.
 * - Memeriksa akses rute /dashboard/keuangan/penyaluran.
 * - Pimpinan & Tester SELALU view-only (canDisburse = false).
 * - Mutasi hanya dapat dilakukan oleh Admin dan Bendahara.
 */
export async function authorizeUser(): Promise<{
  userId: string
  roles: string[]
  permissions: UserPenyaluranPermissions
}> {
  const session = await getSession()
  if (!session) {
    throw new Error('Sesi telah berakhir. Silakan masuk kembali.')
  }

  const roles = getEffectiveRoles(session)
  if (roles.length === 0) {
    throw new Error('Akses ditolak: Pengguna tidak memiliki role yang valid.')
  }

  const hasAccess = await canAccessFeatureForSession(session, '/dashboard/keuangan/penyaluran')
  const isAllowedRole = roles.some((r) =>
    ['admin', 'bendahara', 'pimpinan', 'tester', 'demo'].includes(r)
  )

  if (!hasAccess && !isAllowedRole) {
    throw new Error('Akses ditolak: Anda tidak memiliki hak akses untuk membuka modul Penyaluran Dana.')
  }

  // Role 'demo' hanya boleh menulis bila request benar-benar dilayani DEMO_DB.
  const demoRunsInSandbox = isDemoSandboxRequest(session)
  const isViewOnly = roles.includes('pimpinan') || roles.includes('tester')
  const canDisburse = !isViewOnly && hasFinanceMutateRole(roles, demoRunsInSandbox)

  return {
    userId: session.id,
    roles,
    permissions: {
      canView: true,
      canDisburse,
      role: roles[0] || 'bendahara',
    },
  }
}

export async function getPenyaluranPageData(params?: {
  tab?: string
  period?: string
  historyPage?: number
  historyPageSize?: number
  historySearch?: string
  historyRecipientType?: string
  historyItemType?: string
}): Promise<PenyaluranPageData> {
  const { permissions } = await authorizeUser()

  const activeTab: FinanceDistributionRecipientType | 'RIWAYAT' =
    params?.tab === 'KATERING' || params?.tab === 'LAUNDRY' || params?.tab === 'RIWAYAT'
      ? params.tab
      : 'BENDAHARA'

  const selectedPeriod = params?.period?.trim() || getDefaultPeriod()
  const periodOptions = generatePeriodOptions()

  let summary: DistributionKpiSummary = {
    totalDanaMasuk: 0,
    totalSudahDisalurkan: 0,
    totalSiapDisalurkan: 0,
    totalSantriTerdaftar: 0,
    totalSantriSudahBayar: 0,
    totalSantriBelumBayar: 0,
  }

  let bendaharaRows: BendaharaDistributionSummaryRow[] = []
  let providerRows: ProviderDistributionSummaryRow[] = []

  const historyPromise = getDistributionHistory({
    page: params?.historyPage || 1,
    pageSize: params?.historyPageSize || 50,
    search: params?.historySearch || undefined,
    recipientType:
      params?.historyRecipientType && params.historyRecipientType !== 'ALL'
        ? (params.historyRecipientType as FinanceDistributionRecipientType)
        : undefined,
    itemType: params?.historyItemType && params.historyItemType !== 'ALL' ? params.historyItemType : undefined,
  })

  let history: {
    items: Array<FinanceDistribution & { recipient_name: string; operator_name: string }>
    totalItems: number
    totalPages: number
    page: number
    pageSize: number
  }

  if (activeTab === 'BENDAHARA') {
    const [summaryRes, rowsRes, historyRes] = await Promise.all([
      getDistributionSummary('BENDAHARA', selectedPeriod),
      getBendaharaDistributionList(selectedPeriod),
      historyPromise,
    ])
    summary = summaryRes
    bendaharaRows = rowsRes
    history = historyRes
  } else if (activeTab === 'KATERING') {
    const [summaryRes, rowsRes, historyRes] = await Promise.all([
      getDistributionSummary('KATERING', selectedPeriod),
      getProviderDistributionList('KATERING', selectedPeriod),
      historyPromise,
    ])
    summary = summaryRes
    providerRows = rowsRes
    history = historyRes
  } else if (activeTab === 'LAUNDRY') {
    const [summaryRes, rowsRes, historyRes] = await Promise.all([
      getDistributionSummary('LAUNDRY', selectedPeriod),
      getProviderDistributionList('LAUNDRY', selectedPeriod),
      historyPromise,
    ])
    summary = summaryRes
    providerRows = rowsRes
    history = historyRes
  } else {
    const [summaryRes, historyRes] = await Promise.all([
      getDistributionSummary('BENDAHARA', selectedPeriod),
      historyPromise,
    ])
    summary = summaryRes
    history = historyRes
  }

  return {
    activeTab,
    selectedPeriod,
    summary,
    bendaharaRows,
    providerRows,
    history,
    periodOptions,
    userPermissions: permissions,
  }
}

export async function recordDistributionAction(
  input: Omit<CreateDistributionInput, 'transferredBy'>
): Promise<{ success: boolean; data: FinanceDistribution }> {
  const { userId, permissions } = await authorizeUser()

  if (!permissions.canDisburse) {
    throw new Error(
      'Akses ditolak: Pimpinan dan akun peninjau hanya memiliki hak baca (view-only) dan dilarang mencatat penyaluran dana.'
    )
  }

  const result = await executeDistribution({
    ...input,
    transferredBy: userId,
  })

  return {
    success: true,
    data: result,
  }
}

export async function getProviderAccountsAction(
  providerId: string
): Promise<FinanceProviderAccount[]> {
  await authorizeUser()
  return getProviderAccounts(providerId)
}

export async function saveProviderAccountAction(
  input: CreateProviderAccountInput
): Promise<{ success: boolean; data: FinanceProviderAccount }> {
  const { permissions } = await authorizeUser()

  if (!permissions.canDisburse) {
    throw new Error('Akses ditolak: Anda tidak memiliki izin untuk mengelola rekening penyedia.')
  }

  const result = await createProviderAccount(input)
  return {
    success: true,
    data: result,
  }
}

export async function updateProviderAccountAction(
  input: UpdateProviderAccountInput
): Promise<{ success: boolean; data: FinanceProviderAccount }> {
  const { permissions } = await authorizeUser()

  if (!permissions.canDisburse) {
    throw new Error('Akses ditolak: Anda tidak memiliki izin untuk mengelola rekening penyedia.')
  }

  const result = await updateProviderAccount(input)
  return {
    success: true,
    data: result,
  }
}

export async function deleteProviderAccountAction(
  id: string
): Promise<{ success: boolean }> {
  const { permissions } = await authorizeUser()

  if (!permissions.canDisburse) {
    throw new Error('Akses ditolak: Anda tidak memiliki izin untuk mengelola rekening penyedia.')
  }

  await deleteProviderAccount(id)
  return { success: true }
}

export async function getDistributionReceiptAction(
  id: string
): Promise<DistributionDetailWithItems | null> {
  await authorizeUser()
  return getDistributionById(id)
}

export async function getProviderOperationalDetailAction(
  params: ProviderOperationalDetailParams
): Promise<ProviderOperationalDetailResult> {
  await authorizeUser()
  return getProviderOperationalDetail(params)
}

/**
 * Drill-down daftar santri pada satu pos Bendahara Pesantren beserta status bayarnya.
 * Dipakai saat pengguna mengklik angka "Santri Bayar / Terdaftar" di modul Penyaluran.
 */
export async function getBendaharaStudentsByItemAction(params: {
  itemType: string
  period: string
  status?: 'ALL' | 'BELUM_BAYAR' | 'SUDAH_BAYAR'
  search?: string
  page?: number
  pageSize?: number
}): Promise<BendaharaItemStudentsResult> {
  await authorizeUser()
  return getBendaharaStudentsByItem(params)
}

export async function getProviderAccountTemplateDataAction(): Promise<ProviderAccountTemplatePayload> {
  await authorizeUser()
  return getProviderAccountTemplateData()
}

export async function importProviderAccountsAction(
  rows: ValidatedImportAccountRow[]
): Promise<{ success: boolean; insertedCount: number; skippedCount: number; invalidCount: number }> {
  const { permissions } = await authorizeUser()

  if (!permissions.canDisburse) {
    throw new Error(
      'Akses ditolak: Pimpinan dan akun peninjau hanya memiliki hak baca (view-only) dan dilarang mengimpor rekening penyedia.'
    )
  }

  return importProviderAccounts(rows)
}

