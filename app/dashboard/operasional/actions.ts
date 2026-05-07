'use server'

import { revalidatePath } from 'next/cache'
import { assertFeature } from '@/lib/auth/feature'
import {
  OPERASIONAL_RECIPIENT_FEATURE,
  deleteOperasionalTransaksi,
  getOperasionalDashboard,
  getOperasionalLedger,
  getOperasionalPrintData,
  getOperasionalPrintPreferences,
  getOperasionalScope,
  saveOperasionalPrintPreferences,
  saveOperasionalTransaksi,
  type OperasionalPrintPreference,
  type SaveOperasionalTransaksiPayload,
} from '@/lib/operasional'

const RECIPIENT_PATH = '/dashboard/operasional'
const PRINT_PATH = '/dashboard/operasional/cetak'

async function assertRecipientRead() {
  const access = await assertFeature(OPERASIONAL_RECIPIENT_FEATURE)
  if ('error' in access) throw new Error(access.error)
  return access
}

async function assertRecipientWrite() {
  const access = await assertFeature(OPERASIONAL_RECIPIENT_FEATURE)
  if ('error' in access) throw new Error(access.error)
  return access
}

export async function getRecipientPageData(tahun: number, bulan: number, unitId?: string | null) {
  await assertRecipientRead()
  const scope = await getOperasionalScope()
  if (!scope) throw new Error('Scope operasional tidak ditemukan.')
  const activeUnitId = unitId || scope.lockedUnitId || scope.defaultUnitId
  if (!activeUnitId) throw new Error('Unit operasional belum tersedia.')

  const [dashboard, ledger, printPreferences] = await Promise.all([
    getOperasionalDashboard({ tahun, bulan, unitId: activeUnitId }),
    getOperasionalLedger({ tahun, bulan, unitId: activeUnitId }),
    getOperasionalPrintPreferences({
      unitId: activeUnitId,
      reportType: 'recipient',
      scopeKey: `recipient:${activeUnitId}`,
    }),
  ])

  return {
    scope,
    activeUnitId,
    dashboard,
    ledger,
    printPreferences,
  }
}

export async function getRecipientPrintData(tahun: number, bulan: number, unitId: string) {
  await assertRecipientRead()
  return getOperasionalPrintData({
    tahun,
    bulan,
    unitId,
    reportType: 'recipient',
    scopeKey: `recipient:${unitId}`,
  })
}

export async function saveRecipientTransaksi(payload: SaveOperasionalTransaksiPayload) {
  await assertRecipientWrite()
  const result = await saveOperasionalTransaksi(payload)
  if ('success' in result) {
    revalidatePath(RECIPIENT_PATH)
    revalidatePath(PRINT_PATH)
  }
  return result
}

export async function deleteRecipientTransaksi(id: string) {
  await assertRecipientWrite()
  const result = await deleteOperasionalTransaksi(id)
  if ('success' in result) {
    revalidatePath(RECIPIENT_PATH)
    revalidatePath(PRINT_PATH)
  }
  return result
}

export async function saveRecipientPrintPrefs(payload: OperasionalPrintPreference) {
  await assertRecipientRead()
  const result = await saveOperasionalPrintPreferences(payload)
  revalidatePath(RECIPIENT_PATH)
  revalidatePath(PRINT_PATH)
  return result
}
