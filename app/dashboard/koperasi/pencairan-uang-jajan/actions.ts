'use server'

import { revalidatePath } from 'next/cache'
import { query } from '@/lib/db'
import { authorizeLoketOperator } from '../loket/actions'
import { getActiveCashSession, recalculateCashSession } from '@/lib/finance/cash-session'
import {
  createPayoutBatch,
  getPayoutBatchDetail,
  getPayoutCandidates,
  listPayoutBatches,
  settlePayoutBatch,
  wibDate,
  type CreatePayoutInput,
  type SettlePayoutInput,
} from '@/lib/finance/wallet-payout'
import { ALL_ASRAMA_LIST } from '@/lib/asrama'
import { isAsramaBebasTagihan } from '@/lib/finance/non-billable-santri'

const PATH = '/dashboard/koperasi/pencairan-uang-jajan'
type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string }
const fail = (error: unknown): { success: false; error: string } =>
  ({ success: false, error: (error instanceof Error ? error.message : 'Terjadi kesalahan.').replace(/^Akses ditolak:\s*/, '') })

export async function getPencairanInitialData() {
  const { userId, operatorName, isViewOnly } = await authorizeLoketOperator()
  const session = await getActiveCashSession(userId)
  const cash = session ? await recalculateCashSession(session.id) : null
  const [openBatches, todayBatches] = await Promise.all([
    listPayoutBatches({ status: 'DIBAWA' }),
    listPayoutBatches({ date: wibDate() }),
  ])
  return {
    operatorName,
    isViewOnly,
    today: wibDate(),
    cashSession: cash ? { id: cash.id, code: cash.session_code, available: cash.available_balance ?? cash.expected_closing_balance } : null,
    asramaOptions: ALL_ASRAMA_LIST.filter(a => !isAsramaBebasTagihan(a)) as string[],
    openBatches,
    todayBatches: todayBatches.filter(b => b.status === 'SELESAI'),
  }
}

export async function getPayoutCandidatesAction(filter: { asrama: string; kamar?: string | null; blok?: string | null }) {
  await authorizeLoketOperator()
  const [candidates, rooms] = await Promise.all([
    getPayoutCandidates(filter),
    query<{ nomor_kamar: string; blok: string | null }>(
      `SELECT nomor_kamar, blok FROM kamar_config WHERE asrama = ? ORDER BY CAST(nomor_kamar AS INTEGER), nomor_kamar`, [filter.asrama]).catch(() => []),
  ])
  const blocks = [...new Set(rooms.map(r => r.blok).filter(Boolean) as string[])].sort()
  return { candidates, rooms: rooms.map(r => r.nomor_kamar), blocks }
}

export async function createPayoutAction(input: CreatePayoutInput): Promise<Result<{ batchId: string; batchNumber: string }>> {
  try {
    const { userId } = await authorizeLoketOperator(true)
    const result = await createPayoutBatch(userId, input)
    revalidatePath(PATH)
    return { success: true, data: { batchId: result.batchId, batchNumber: result.batchNumber } }
  } catch (error) { return fail(error) }
}

export async function settlePayoutAction(input: SettlePayoutInput): Promise<Result> {
  try {
    const { userId } = await authorizeLoketOperator(true)
    await settlePayoutBatch(userId, input)
    revalidatePath(PATH)
    return { success: true }
  } catch (error) { return fail(error) }
}

export async function getPayoutDetailAction(batchId: string) {
  await authorizeLoketOperator()
  const detail = await getPayoutBatchDetail(String(batchId || ''))
  if (!detail) throw new Error('Pencairan tidak ditemukan.')
  return detail
}

export async function listPayoutHistoryAction(date: string) {
  await authorizeLoketOperator()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tanggal tidak valid.')
  return listPayoutBatches({ date })
}
