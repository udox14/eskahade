'use server'

import { query, queryOne, execute, batch } from '@/lib/db'
import { authorizeFinanceFeature } from '@/lib/finance/authorization'
import { previewBillingBackfill, applyBillingBackfill, verifyHistoricalProviderEvidence, type HistoricalProviderEvidence, type ApprovedBillingCandidate } from '@/lib/finance/billing-backfill'
import { revalidatePath } from 'next/cache'
import { billingReviewCount } from '@/lib/finance/billing-legacy'
import { executeBackfillLegacyPayments } from '@/lib/finance/bridge'

const PATH = '/dashboard/keuangan/status-pembayaran'

export async function getBillingMonitorAction() {
  const { roles } = await authorizeFinanceFeature(PATH,false)
  const [issues,runs,legacy,providers] = await Promise.all([
    query<{ santri_id: string; name: string; item_type: string; period: string; reason: string }>(
      `SELECT i.santri_id,s.nama_lengkap name,i.item_type,i.period,i.reason FROM finance_billing_issues i
       JOIN santri s ON s.id=i.santri_id WHERE i.status='OPEN' ORDER BY i.updated_at DESC LIMIT 100`),
    query<{ id: string; status: string; cursor: string; failed_count: number; review_count: number }>(
      'SELECT id,status,cursor,failed_count,review_count FROM finance_billing_runs ORDER BY created_at DESC LIMIT 5'),
    billingReviewCount({ query,queryOne,execute }),
    query<{ id: string; nama_jasa: string; jenis: string }>("SELECT id,nama_jasa,jenis FROM master_jasa WHERE jenis IN ('Makan','Cuci') ORDER BY nama_jasa"),
  ])
  return { issues,runs,legacyPending: legacy,providers,canVerifyHistorical:roles.some(r=>r==='admin'||r==='bendahara') }
}

/**
 * Sinkronkan satu potong pembayaran modul lama yang belum tercermin di Keuangan Baru.
 * Memakai jalur idempoten yang sama dengan sinkronisasi per transaksi (external_reference unik).
 * Dipotong kecil karena tiap baris memerlukan ±10 kueri D1 dan satu invocation Worker
 * dibatasi jumlah kuerinya; klien memanggil berulang sampai tidak ada kemajuan.
 */
const LEGACY_SYNC_CHUNK = 40
export async function syncLegacyPaymentsChunkAction() {
  await authorizeFinanceFeature(PATH,true)
  const report = await executeBackfillLegacyPayments({ limit: LEGACY_SYNC_CHUNK })
  const remaining = await billingReviewCount({ query,queryOne,execute })
  revalidatePath(PATH)
  return {
    processed: report.processed, synced: report.synced, excluded: report.excluded, failed: report.failed,
    errors: report.errors.slice(0,5).map(e=>`${e.source}:${e.sourceId} — ${e.error.slice(0,200)}`),
    remaining,
  }
}

export async function verifyHistoricalBillingProviderAction(input: HistoricalProviderEvidence) {
  const { session,roles } = await authorizeFinanceFeature(PATH,true)
  if (!roles.some(r=>r==='admin'||r==='bendahara')) throw new Error('FORBIDDEN: Verifikasi bukti historis memerlukan Admin atau Bendahara.')
  return verifyHistoricalProviderEvidence({ query,queryOne,execute,batch },input,session.id)
}

export async function previewMissingBillingAction(cursor = '') {
  await authorizeFinanceFeature(PATH,false)
  if (typeof cursor !== 'string' || cursor.length>200) throw new Error('Cursor tidak valid.')
  return previewBillingBackfill({ query,queryOne,execute },cursor)
}

export async function applyMissingBillingAction(approved: ApprovedBillingCandidate[]) {
  const { session } = await authorizeFinanceFeature(PATH,true)
  const result = await applyBillingBackfill({ query,queryOne,execute },approved,session.id)
  revalidatePath(PATH)
  return result
}
