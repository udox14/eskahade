import type { BillingStore } from './billing-store'
import { createBillingIssuance, summarizeIssuance, type BillingCandidate } from './billing-issuance'
import { billingClock } from './billing-periods'

export async function recordBillingIssue(store: BillingStore, candidate: BillingCandidate) {
  if (candidate.outcome === 'REVIEW' || candidate.outcome === 'FAILED') {
    await store.execute(`INSERT INTO finance_billing_issues(santri_id,item_type,period,status,reason,updated_at)
      VALUES(?,?,?,'OPEN',?,?) ON CONFLICT(santri_id,item_type,period) DO UPDATE
      SET status='OPEN',reason=excluded.reason,updated_at=excluded.updated_at`,
    [candidate.santriId,candidate.itemType,candidate.period,candidate.reason ?? 'Perlu Pemeriksaan',new Date().toISOString()])
  } else {
    await store.execute(`UPDATE finance_billing_issues SET status='RESOLVED',updated_at=?
      WHERE santri_id=? AND item_type=? AND period=? AND status='OPEN'`,
    [new Date().toISOString(),candidate.santriId,candidate.itemType,candidate.period])
  }
}

/** Keyset batches; an interrupted page is safe to replay because obligations have a UNIQUE key. */
export async function runBillingJob(store: BillingStore, at = new Date(), pageSize = 5) {
  const date = billingClock(at).date
  await store.execute('INSERT OR IGNORE INTO finance_billing_runs(id,business_date) VALUES(?,?)', [`DAILY:${date}`,date])
  const oldest = await store.queryOne<{ id: string }>(
    "SELECT id FROM finance_billing_runs WHERE id LIKE 'DAILY:%' AND status='RUNNING' ORDER BY business_date LIMIT 1")
  if (!oldest) return { status:'IDLE' as const,cursor:null }
  const id = oldest.id
  const token = crypto.randomUUID()
  const lease = await store.queryOne<{ cursor: string }>(`UPDATE finance_billing_runs
    SET lease_token=?,lease_until=?,updated_at=? WHERE id=? AND status='RUNNING'
    AND (lease_until IS NULL OR lease_until<?) RETURNING cursor`,
  [token,new Date(at.getTime()+4*60_000).toISOString(),at.toISOString(),id,at.toISOString()])
  if (!lease) return { status: 'IDLE' as const, cursor: null }
  const students = await store.query<{ id: string }>(
    "SELECT id FROM santri WHERE status_global='aktif' AND id>? ORDER BY id LIMIT ?", [lease.cursor,Math.min(10,Math.max(1,pageSize))])
  const issuer = createBillingIssuance(store,at)
  const candidates: BillingCandidate[] = []
  let cursor = lease.cursor
  try {
    for (const student of students) {
      const result = await issuer.ensureStudent(student.id)
      for (const candidate of result.candidates) await recordBillingIssue(store,candidate)
      candidates.push(...result.candidates)
      cursor = student.id
    }
    const summary = summarizeIssuance(candidates)
    const completed = students.length < Math.min(10,Math.max(1,pageSize))
    await store.execute(`UPDATE finance_billing_runs SET cursor=?,status=?,lease_token=NULL,lease_until=NULL,
      created_count=created_count+?,existing_count=existing_count+?,skipped_count=skipped_count+?,
      review_count=review_count+?,failed_count=failed_count+?,updated_at=? WHERE id=? AND lease_token=?`,
    [cursor,completed?'COMPLETED':'RUNNING',summary.created,summary.existing,summary.skipped,summary.review,summary.failed,new Date().toISOString(),id,token])
    return { status: completed ? 'COMPLETED' as const : 'RUNNING' as const, cursor, ...summary }
  } catch (error) {
    // No cursor advance for a partially processed page. Never rewrite existing obligations on replay.
    await store.execute('UPDATE finance_billing_runs SET lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?', [id,token])
    throw error
  }
}
