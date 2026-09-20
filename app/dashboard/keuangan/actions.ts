'use server'

// app/dashboard/keuangan/actions.ts
// Server Actions untuk Dashboard Keuangan (Fase 9)

import { getSession, getEffectiveRoles } from '@/lib/auth/session'
import { canAccessFeatureForSession } from '@/lib/auth/feature'
import {
  getFinanceDashboardFullData,
  type FinanceDashboardData,
} from '@/lib/finance/dashboard'
import {
  getActiveCashSession,
  type FinanceCashSession,
} from '@/lib/finance/cash-session'

export interface UserDashboardPermissions {
  canView: boolean
  role: string
}

export interface DashboardActionResponse {
  data: FinanceDashboardData
  userPermissions: UserDashboardPermissions
  activeCashSession: FinanceCashSession | null
}

export async function getDashboardData(
  period?: string
): Promise<DashboardActionResponse> {
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
    '/dashboard/keuangan'
  ).catch(() => false)

  if (!isPrivileged && !hasFeatureAccess) {
    throw new Error('Anda tidak memiliki izin untuk mengakses Dashboard Keuangan.')
  }

  const [fullData, activeCashSession] = await Promise.all([
    getFinanceDashboardFullData(period),
    getActiveCashSession(session.id),
  ])

  return {
    data: fullData,
    userPermissions: {
      canView: true,
      role: session.role || roles[0] || 'bendahara',
    },
    activeCashSession,
  }
}
