'use server'

import { revalidatePath } from 'next/cache'
import { assertFeature } from '@/lib/auth/feature'
import {
  OPERASIONAL_BENDAHARA_FEATURE,
  deleteOperasionalTransaksi,
  getOperasionalDashboard,
  getOperasionalLedger,
  getOperasionalPrintData,
  getOperasionalPrintPreferences,
  getOperasionalScope,
  postOperasionalAlokasi,
  cancelOperasionalAlokasi,
  saveOperasionalAlokasi,
  saveOperasionalPrintPreferences,
  saveOperasionalTransaksi,
  type OperasionalPrintPreference,
  type SaveOperasionalAlokasiPayload,
  type SaveOperasionalTransaksiPayload,
} from '@/lib/operasional'

const MONITORING_PATH = '/dashboard/keuangan/operasional'
const PRINT_PATH = '/dashboard/keuangan/operasional/cetak'

async function assertBendaharaRead() {
  const access = await assertFeature(OPERASIONAL_BENDAHARA_FEATURE)
  if ('error' in access) throw new Error(access.error)
  return access
}

async function assertBendaharaWrite(action: 'create' | 'update' | 'delete' = 'update') {
  const access = await assertFeature(OPERASIONAL_BENDAHARA_FEATURE, action)
  if ('error' in access) throw new Error(access.error)
  return access
}

export async function getBendaharaOperasionalPageData(tahun: number, bulan: number, unitId?: string | null) {
  const session = await assertBendaharaRead()
  const scope = await getOperasionalScope(session)
  if (!scope) throw new Error('Scope bendahara operasional tidak ditemukan.')
  const activeUnitId = unitId || scope.defaultUnitId

  const [dashboard, ledger, printPreferences] = await Promise.all([
    getOperasionalDashboard({ tahun, bulan, unitId: undefined }),
    activeUnitId ? getOperasionalLedger({ tahun, bulan, unitId: activeUnitId }) : null,
    activeUnitId ? getOperasionalPrintPreferences({
      unitId: activeUnitId,
      reportType: 'bendahara',
      scopeKey: `bendahara:${activeUnitId}`,
    }) : null,
  ])

  return {
    scope,
    activeUnitId,
    dashboard,
    ledger,
    printPreferences,
  }
}

export async function getBendaharaPrintData(tahun: number, bulan: number, unitId: string) {
  await assertBendaharaRead()
  return getOperasionalPrintData({
    tahun,
    bulan,
    unitId,
    reportType: 'bendahara',
    scopeKey: `bendahara:${unitId}`,
  })
}

export async function saveBendaharaAlokasi(payload: SaveOperasionalAlokasiPayload) {
  await assertBendaharaWrite('update')
  const result = await saveOperasionalAlokasi(payload)
  if ('success' in result) {
    revalidatePath(MONITORING_PATH)
    revalidatePath(PRINT_PATH)
  }
  return result
}

export async function postBendaharaAlokasi(id: string) {
  await assertBendaharaWrite('update')
  const result = await postOperasionalAlokasi(id)
  if ('success' in result) {
    revalidatePath(MONITORING_PATH)
    revalidatePath(PRINT_PATH)
  }
  return result
}

export async function cancelBendaharaAlokasi(id: string) {
  await assertBendaharaWrite('update')
  const result = await cancelOperasionalAlokasi(id)
  if ('success' in result) {
    revalidatePath(MONITORING_PATH)
    revalidatePath(PRINT_PATH)
  }
  return result
}

export async function saveBendaharaTransaksi(payload: SaveOperasionalTransaksiPayload) {
  await assertBendaharaWrite('update')
  const result = await saveOperasionalTransaksi(payload)
  if ('success' in result) {
    revalidatePath(MONITORING_PATH)
    revalidatePath(PRINT_PATH)
  }
  return result
}

export async function deleteBendaharaTransaksi(id: string) {
  await assertBendaharaWrite('delete')
  const result = await deleteOperasionalTransaksi(id)
  if ('success' in result) {
    revalidatePath(MONITORING_PATH)
    revalidatePath(PRINT_PATH)
  }
  return result
}

export async function saveBendaharaPrintPrefs(payload: OperasionalPrintPreference) {
  await assertBendaharaWrite('update')
  const result = await saveOperasionalPrintPreferences(payload)
  revalidatePath(MONITORING_PATH)
  revalidatePath(PRINT_PATH)
  return result
}
