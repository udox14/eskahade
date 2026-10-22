import type { BillingStore } from './billing-store'
import { createBillingIssuance, summarizeIssuance, type BillingCandidate } from './billing-issuance'
import { billingClock, ANNUAL_BILLING_ITEMS, MONTHLY_BILLING_ITEMS } from './billing-periods'
import { FINANCE_CUTOVER_START_MONTHLY, FINANCE_CUTOVER_START_ANNUAL } from './legacy-reader'
import { recordBillingIssue } from './billing-job'
import type { FinanceItemType } from './types'

export async function billingFingerprint(candidate: BillingCandidate) {
  const o = candidate.obligation
  const payload = JSON.stringify([candidate.santriId,candidate.itemType,candidate.period,candidate.outcome,
    o?.amount_expected,o?.amount_exempted,o?.tariff_id,o?.provider_id,o?.academic_year_id])
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))].map(b=>b.toString(16).padStart(2,'0')).join('')
}

/** Pure preview: no inserts, updates, or legacy sync. Keyset pagination bounds request work. */
export async function previewBillingBackfill(store: BillingStore, cursor = '', at = new Date()) {
  const students = await store.query<{ id: string; nama_lengkap: string }>(
    "SELECT id,nama_lengkap FROM santri WHERE status_global='aktif' AND id>? ORDER BY id LIMIT 2", [cursor])
  const issuer = createBillingIssuance(store,at)
  const now = billingClock(at)
  const targets: Array<{ itemType: FinanceItemType; period: string }> = []
  for (let p = FINANCE_CUTOVER_START_MONTHLY; p <= now.monthly;) {
    targets.push(...MONTHLY_BILLING_ITEMS.map(itemType => ({ itemType,period:p })))
    p = new Date(Date.UTC(Number(p.slice(0,4)),Number(p.slice(5,7)),1)).toISOString().slice(0,7)
  }
  for (let year = FINANCE_CUTOVER_START_ANNUAL; year <= Number(now.annual); year++) {
    targets.push(...ANNUAL_BILLING_ITEMS.map(itemType => ({ itemType,period:String(year) })))
  }
  targets.push({ itemType:'USPP',period:'LIFETIME' })
  const candidates: Array<BillingCandidate & { name: string; fingerprint: string }> = []
  for (const student of students) for (const target of targets) {
    const candidate = await issuer.assess(student.id,target.itemType,target.period)
    candidates.push({ ...candidate,name:student.nama_lengkap,fingerprint:await billingFingerprint(candidate) })
  }
  return { candidates,nextCursor:students.length===2 ? students.at(-1)!.id : null }
}

export interface ApprovedBillingCandidate {
  santriId: string; itemType: FinanceItemType; period: string; fingerprint: string
}

export async function applyBillingBackfill(store: BillingStore, approved: ApprovedBillingCandidate[], userId: string, at = new Date()) {
  if (!Array.isArray(approved) || !approved.length || approved.length>25) throw new Error('Pilih 1–25 kandidat yang sudah ditinjau.')
  const keys = new Set<string>()
  approved = approved.map(input => {
    if (!input || typeof input.santriId !== 'string' || input.santriId.length>200 || typeof input.period!=='string' ||
      typeof input.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(input.fingerprint)) throw new Error('Kandidat pratinjau tidak valid.')
    const key = `${input.santriId}:${input.itemType}:${input.period}`
    if (keys.has(key)) throw new Error('Kandidat yang sama tidak boleh dipilih dua kali.')
    keys.add(key)
    const now=billingClock(at)
    if ((input.period.length===7 && (input.period<FINANCE_CUTOVER_START_MONTHLY || input.period>now.monthly)) ||
      (input.period.length===4 && (Number(input.period)<FINANCE_CUTOVER_START_ANNUAL || input.period>now.annual))) {
      throw new Error('Pelengkapan historis hanya boleh mencakup periode sejak CUTOVER sampai periode berjalan.')
    }
    return { santriId:input.santriId,itemType:input.itemType,period:input.period,fingerprint:input.fingerprint }
  })
  const issuer = createBillingIssuance(store,at)
  // Validate the whole selection before any write. Client amounts never become financial values.
  for (const input of approved) {
    const candidate = await issuer.assess(input.santriId,input.itemType,input.period)
    if (!['READY','EXEMPTED'].includes(candidate.outcome) || await billingFingerprint(candidate)!==input.fingerprint) {
      throw new Error('Pratinjau berubah atau kandidat belum aman. Muat ulang pratinjau sebelum melengkapi tagihan.')
    }
  }
  const runId = `MANUAL:${crypto.randomUUID()}`
  await store.execute(`INSERT INTO finance_billing_runs(id,business_date,created_by,selection_json)
    VALUES(?,?,?,?)`, [runId,billingClock(at).date,userId,JSON.stringify(approved)])
  const results: BillingCandidate[] = []
  for (const input of approved) {
    // Re-read authoritative data immediately before each insertion, including concurrent legacy payments.
    const fresh = await issuer.assess(input.santriId,input.itemType,input.period)
    if (await billingFingerprint(fresh)!==input.fingerprint) {
      results.push({ ...fresh,outcome:'REVIEW',reason:'Kondisi berubah saat proses berlangsung; perlu pratinjau ulang.' })
    } else {
      try { results.push(await issuer.issue(input.santriId,input.itemType,input.period)) }
      catch (error) { results.push({ ...fresh,outcome:'FAILED',reason:error instanceof Error ? error.message : 'Penerbitan gagal.' }) }
    }
    await recordBillingIssue(store,results.at(-1)!)
  }
  const summary = summarizeIssuance(results)
  await store.execute(`UPDATE finance_billing_runs SET status='COMPLETED',created_count=?,existing_count=?,
    skipped_count=?,review_count=?,failed_count=?,updated_at=? WHERE id=?`,
  [summary.created,summary.existing,summary.skipped,summary.review,summary.failed,new Date().toISOString(),runId])
  return { runId,...summary }
}

export interface HistoricalProviderEvidence {
  santriId: string; itemType: 'UANG_MAKAN' | 'UANG_NYUCI'; period: string; providerId: string; note: string
}

/** Append an operator attestation to the run audit and save period-specific evidence atomically. */
export async function verifyHistoricalProviderEvidence(store: BillingStore, input: HistoricalProviderEvidence, userId: string, at=new Date()) {
  if (!input || !['UANG_MAKAN','UANG_NYUCI'].includes(input.itemType) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period) || input.period<FINANCE_CUTOVER_START_MONTHLY || input.period>=billingClock(at).monthly ||
    typeof input.note!=='string' || input.note.trim().length<10 || input.note.length>1000) throw new Error('Bukti periode/provider historis dan referensi pemeriksaan wajib valid.')
  const student=await store.queryOne<{ id: string }>("SELECT id FROM santri WHERE id=? AND status_global='aktif'",[input.santriId])
  const provider=await store.queryOne<{ id: string }>('SELECT id FROM master_jasa WHERE id=? AND jenis=?',
    [input.providerId,input.itemType==='UANG_MAKAN'?'Makan':'Cuci'])
  if (!student || !provider) throw new Error('Santri atau jenis provider tidak sesuai.')
  if (await store.queryOne('SELECT id FROM finance_obligations WHERE santri_id=? AND item_type=? AND period=?',
    [input.santriId,input.itemType,input.period])) throw new Error('Tagihan sudah tersedia; snapshot existing tidak boleh diganti.')
  if (!store.batch) throw new Error('Database tidak mendukung pencatatan bukti atomik.')
  const runId=`EVIDENCE:${crypto.randomUUID()}`,timestamp=new Date().toISOString()
  await store.batch([
    { sql:`INSERT INTO finance_billing_runs(id,business_date,created_by,selection_json,status) VALUES(?,?,?,?,'COMPLETED')`,
      params:[runId,billingClock(at).date,userId,JSON.stringify({...input,note:input.note.trim()})] },
    { sql:`INSERT INTO finance_billing_issues(santri_id,item_type,period,status,reason,evidence_provider_id,evidence_note,evidence_verified_by,evidence_verified_at,updated_at)
      VALUES(?,?,?,'OPEN','Bukti provider historis diverifikasi; muat ulang pratinjau.',?,?,?,?,?)
      ON CONFLICT(santri_id,item_type,period) DO UPDATE SET evidence_provider_id=excluded.evidence_provider_id,
        evidence_note=excluded.evidence_note,evidence_verified_by=excluded.evidence_verified_by,evidence_verified_at=excluded.evidence_verified_at,
        status='OPEN',reason=excluded.reason,updated_at=excluded.updated_at`,
      params:[input.santriId,input.itemType,input.period,input.providerId,input.note.trim(),userId,timestamp,timestamp] },
  ])
  return { runId }
}
