'use server'

// app/dashboard/keuangan/riwayat/actions.ts
// Server Actions untuk Riwayat Transaksi Global (Fase 9: PRD Bab 30)

import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import {
  getGlobalTransactionHistory,
  getTransactionDetail as fetchTransactionDetail,
  getHistoryFilterOptions,
  type GlobalTransactionQueryParams,
  type GlobalTransactionHistoryResponse,
  type FilterOptionsData,
} from '@/lib/finance/history'

export interface UserHistoryPermissions {
  canView: boolean
  role: string
}

export interface HistoryActionResponse {
  history: GlobalTransactionHistoryResponse
  filterOptions: FilterOptionsData
  userPermissions: UserHistoryPermissions
}

export async function getGlobalHistoryData(
  params: GlobalTransactionQueryParams
): Promise<GlobalTransactionHistoryResponse> {
  const session = await getSession()
  if (!session) {
    throw new Error('Sesi autentikasi telah berakhir. Silakan login kembali.')
  }

  const roles = getEffectiveRoles(session)
  const isPrivileged =
    roles.includes('admin') ||
    roles.includes('bendahara') ||
    roles.includes('pimpinan') ||
    roles.includes('demo') ||
    roles.includes('tester')

  const hasFeatureAccess = await canAccessFeatureForSession(
    session,
    '/dashboard/keuangan/riwayat'
  ).catch(() => false)

  if (!isPrivileged && !hasFeatureAccess) {
    throw new Error('Anda tidak memiliki izin untuk mengakses Riwayat Transaksi.')
  }

  return await getGlobalTransactionHistory(params)
}

export async function getInitialHistoryData(): Promise<HistoryActionResponse> {
  const session = await getSession()
  if (!session) {
    throw new Error('Sesi autentikasi telah berakhir. Silakan login kembali.')
  }

  const roles = getEffectiveRoles(session)
  const isPrivileged =
    roles.includes('admin') ||
    roles.includes('bendahara') ||
    roles.includes('pimpinan') ||
    roles.includes('demo') ||
    roles.includes('tester')

  const hasFeatureAccess = await canAccessFeatureForSession(
    session,
    '/dashboard/keuangan/riwayat'
  ).catch(() => false)

  if (!isPrivileged && !hasFeatureAccess) {
    throw new Error('Anda tidak memiliki izin untuk mengakses Riwayat Transaksi.')
  }

  const [history, filterOptions] = await Promise.all([
    getGlobalTransactionHistory({ page: 1, pageSize: 20 }),
    getHistoryFilterOptions(),
  ])

  return {
    history,
    filterOptions,
    userPermissions: {
      canView: true,
      role: session.role || roles[0] || 'bendahara',
    },
  }
}

export async function getTransactionDetail(
  id: string,
  sourceTable: 'PAYMENT' | 'WALLET' | 'DISTRIBUTION' | 'CORRECTION'
) {
  const session = await getSession()
  if (!session) {
    throw new Error('Sesi autentikasi telah berakhir. Silakan login kembali.')
  }

  return await fetchTransactionDetail(id, sourceTable)
}
