'use server'

import { revalidatePath } from 'next/cache'
import { authorizeFinanceFeature } from '@/lib/finance/authorization'
import {
  TRANSFER_FEATURE_PATH,
  approveTransferAsUnallocated,
  approveTransferSubmission,
  countPendingTransfersForScope,
  getTransferReviewDetail,
  getVerifierScope,
  listTransferQueue,
  rejectTransferSubmission,
  requestTransferProofFix,
  scopeAllows,
  type TransferQueueFilter,
  type TransferSubmissionRow,
  type VerifierScope,
} from '@/lib/finance/manual-transfer'

type Result<T = undefined> = { success: true; data?: T } | { success: false; error: string }

function fail(error: unknown): { success: false; error: string } {
  const message = error instanceof Error ? error.message : 'Terjadi kesalahan.'
  return { success: false, error: message.replace(/^(FORBIDDEN|UNAUTHORIZED):\s*/, '') }
}

async function actor(mutate: boolean) {
  const { session } = await authorizeFinanceFeature(TRANSFER_FEATURE_PATH, mutate)
  const scope = await getVerifierScope(session)
  return { session, scope }
}

export interface TransferQueueData {
  items: TransferSubmissionRow[]
  scope: VerifierScope
  pendingCount: number
  viewerName: string
}

export async function getTransferQueueAction(filter: TransferQueueFilter = {}): Promise<TransferQueueData> {
  const { session, scope } = await actor(false)
  const [items, pendingCount] = await Promise.all([
    listTransferQueue(scope, filter),
    countPendingTransfersForScope(scope),
  ])
  return { items, scope, pendingCount, viewerName: session.full_name || 'Petugas' }
}

export async function getTransferReviewDetailAction(id: string) {
  const { scope } = await actor(false)
  const detail = await getTransferReviewDetail(String(id || ''))
  if (!detail || !scopeAllows(scope, detail.submission.asrama)) throw new Error('Pengajuan tidak ditemukan.')
  const proofs = (detail.events || []).filter(e => e.action === 'PROOF_UPLOADED').length
  return {
    ...detail,
    proofUrl: detail.submission.proof_object_key ? `/api/finance/transfer-proofs/${encodeURIComponent(detail.submission.id)}` : null,
    proofCount: proofs,
    canMutate: scope.canMutate,
  }
}

function done() {
  revalidatePath(TRANSFER_FEATURE_PATH)
  revalidatePath('/portal-ortu/tagihan')
  revalidatePath('/portal-ortu/beranda')
}

export async function approveTransferAction(input: { submissionId: string; receivedAmount: number; notes?: string }): Promise<Result> {
  try {
    await approveTransferSubmission(await actor(true), input)
    done()
    return { success: true }
  } catch (error) { return fail(error) }
}

export async function approveTransferUnallocatedAction(input: { submissionId: string; receivedAmount: number; notes: string }): Promise<Result> {
  try {
    await approveTransferAsUnallocated(await actor(true), input)
    done()
    return { success: true }
  } catch (error) { return fail(error) }
}

export async function rejectTransferAction(input: { submissionId: string; reason: string }): Promise<Result> {
  try {
    await rejectTransferSubmission(await actor(true), input)
    done()
    return { success: true }
  } catch (error) { return fail(error) }
}

export async function requestTransferFixAction(input: { submissionId: string; reason: string }): Promise<Result> {
  try {
    await requestTransferProofFix(await actor(true), input)
    done()
    return { success: true }
  } catch (error) { return fail(error) }
}
