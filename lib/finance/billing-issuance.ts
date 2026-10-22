import type { BillingStore } from './billing-store'
import type { FinanceItemType, FinanceObligation } from './types'
import { createObligationEngine } from './obligation-engine'
import { FINANCE_CUTOVER_START_ANNUAL, FINANCE_CUTOVER_START_MONTHLY } from './legacy-reader'
import { billingClock, billingPhase, currentBillingTargets, advanceBillingPeriods } from './billing-periods'
import { isSantriBebasItem } from './non-billable-santri'
import { legacyBillingEvidence, legacyReviewSql, legacyExemptSql } from './billing-legacy'
import { createServiceBillingGate } from './billing-cutover'

export type BillingOutcome = 'READY' | 'EXISTING' | 'EXEMPTED' | 'LEGACY' | 'SKIPPED' | 'REVIEW' | 'FAILED' | 'CREATED'
export interface BillingCandidate {
  santriId: string
  itemType: FinanceItemType
  period: string
  outcome: BillingOutcome
  reason?: string
  obligation?: FinanceObligation
  created?: boolean
  providerSnapshotId?: string
}
interface BillingStudent {
  id: string; status_global: string; asrama: string | null; kategori_santri: string | null
  tempat_makan_id: string | null; tempat_mencuci_id: string | null
  tanggal_masuk: string | null; created_at: string | null; tahun_masuk: number | null
}
export interface IssuanceResult {
  created: number; existing: number; skipped: number; review: number; failed: number
  candidates: BillingCandidate[]
}

export function createBillingIssuance(store: BillingStore, at = new Date()) {
  const engine = createObligationEngine(store, at)
  const serviceGate = createServiceBillingGate(store,at)

  const readStudent = (santriId: string) => store.queryOne<BillingStudent>(
    `SELECT id,status_global,asrama,kategori_santri,tempat_makan_id,tempat_mencuci_id,
     tanggal_masuk,created_at,tahun_masuk FROM santri WHERE id=?`, [santriId])

  async function assessCandidate(santriId: string, itemType: FinanceItemType, period: string, materialize: boolean,
    studentSnapshot?: BillingStudent | null): Promise<BillingCandidate> {
    const result = (outcome: BillingOutcome, reason?: string, obligation?: FinanceObligation): BillingCandidate =>
      ({ santriId, itemType, period, outcome, reason, obligation })
    engine.validateAndMapPeriod(itemType, period)
    // Existing snapshots are immutable even when today's eligibility/configuration differs.
    const existing = await store.queryOne<FinanceObligation>(
      'SELECT * FROM finance_obligations WHERE santri_id=? AND item_type=? AND period=?', [santriId, itemType, period])
    if (existing) {
      const review = await store.queryOne<{ review: number; exempted: number }>(
        `SELECT (${legacyReviewSql('o')}) review,${legacyExemptSql('o')} exempted FROM finance_obligations o WHERE o.id=?`, [existing.id])
      if (review?.exempted) return result('EXEMPTED','Pembebasan/peniadaan SPP existing.',existing)
      const mirrored = await store.queryOne<{ id: string }>(
        "SELECT p.id FROM finance_payments p JOIN finance_allocations a ON a.payment_id=p.id WHERE a.obligation_id=? AND p.source='LEGACY' LIMIT 1", [existing.id])
      return review?.review ? result('REVIEW', 'Pembayaran modul lama perlu sinkronisasi/pemeriksaan.', existing)
        : result(existing.status === 'EXEMPTED' ? 'EXEMPTED' : mirrored ? 'LEGACY' : 'EXISTING', undefined, existing)
    }
    const cutoverBlock = await serviceGate(itemType,period)
    if (cutoverBlock) return result('SKIPPED',cutoverBlock)
    if ((period.length === 7 && period < FINANCE_CUTOVER_START_MONTHLY) ||
      (period.length === 4 && Number(period) < FINANCE_CUTOVER_START_ANNUAL)) return result('SKIPPED', 'Periode sebelum CUTOVER.')

    const student = studentSnapshot === undefined ? await readStudent(santriId) : studentSnapshot
    if (!student || student.status_global !== 'aktif') return result('SKIPPED', 'Santri tidak aktif.')
    if (isSantriBebasItem({ asrama: student.asrama, kategoriSantri: student.kategori_santri }, itemType)) {
      return result('SKIPPED', 'Pengecualian item/santri existing.')
    }
    const historical = billingPhase(itemType,period,at)==='PAST'
    let historicalProvider: string | undefined
    if (!historical && ((itemType === 'UANG_MAKAN' && !student.tempat_makan_id) ||
        (itemType === 'UANG_NYUCI' && !student.tempat_mencuci_id))) return result('SKIPPED', 'Tidak terdaftar pada layanan.')

    if (itemType === 'SPP') {
      const waived = await store.queryOne<{ exempted: number }>(
        `SELECT ${legacyExemptSql('o')} exempted FROM (SELECT ? santri_id,? item_type,? period) o`, [santriId,itemType,period])
      if (waived?.exempted) return result('SKIPPED','Pembebasan/peniadaan SPP existing.')
    }

    const evidence = await store.queryOne<{ amount: number; period: string | null }>(
      `SELECT amount,period FROM (${legacyBillingEvidence}) be WHERE santri_id=? AND item_type=?
        AND (period=? OR period IS NULL) AND (voided=0 OR amount>0) LIMIT 1`, [santriId, itemType, period])
    if (evidence) return result('REVIEW', 'Ada bukti modul lama; verifikasi sinkronisasi sebelum penerbitan.')

    // Preserve the legacy SPP start rule: later of configured start, admission, and creation.
    const dates = [student.tanggal_masuk, student.created_at].filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}/.test(d))
    if (itemType === 'SPP') {
      const setting = await store.queryOne<{ value: string }>("SELECT value FROM app_settings WHERE key='spp_tagihan_mulai'")
      const start = setting?.value ?? '2026-06'
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(start)) return result('FAILED', 'Pengaturan awal tagihan SPP tidak valid.')
      const earliest = [start, ...dates.map(d => d.slice(0, 7))].sort().at(-1)!
      if (period < earliest) return result('SKIPPED', 'Sebelum awal tagihan efektif santri.')
    }
    if (student.tanggal_masuk && /^\d{4}-\d{2}/.test(student.tanggal_masuk)) {
      const entry = student.tanggal_masuk.slice(0, 7)
      const lastMonth = period.length === 7 ? period : `${Number(period) + 1}-06`
      if (period !== 'LIFETIME' && entry > lastMonth) return result('SKIPPED', 'Sebelum masa masuk santri.')
    }

    if (billingPhase(itemType, period, at) === 'PAST') {
      if (!student.tanggal_masuk || !/^\d{4}-\d{2}-\d{2}$/.test(student.tanggal_masuk)) {
        return result('REVIEW', 'Tanggal masuk historis belum dapat dibuktikan.')
      }
      const end = period.length === 7 ? `${period}-31` : `${Number(period) + 1}-06-30`
      const inactive = await store.queryOne<{ id: string }>(
        `SELECT id FROM santri_nonaktif_log WHERE santri_id=? AND tanggal_mulai<=?
         AND (tanggal_aktif_aktual IS NULL OR tanggal_aktif_aktual>=?) LIMIT 1`,
        [santriId, end, period.length === 7 ? `${period}-01` : `${period}-07-01`])
      if (inactive) return result('REVIEW', 'Ada masa nonaktif pada periode historis.')
      if (itemType === 'UANG_MAKAN' || itemType === 'UANG_NYUCI') {
        const evidence = await store.queryOne<{ evidence_provider_id: string }>(
          `SELECT evidence_provider_id FROM finance_billing_issues WHERE santri_id=? AND item_type=? AND period=?
           AND evidence_verified_by IS NOT NULL AND evidence_note IS NOT NULL AND evidence_provider_id IS NOT NULL`,
          [santriId,itemType,period])
        if (!evidence) return result('REVIEW', 'Provider/keanggotaan layanan historis perlu bukti; provider saat ini tidak diasumsikan berlaku dahulu.')
        historicalProvider=evidence.evidence_provider_id
      }
    }
    if (itemType === 'USPP') {
      // Do not revive lifetime debt for legacy students presumed settled by existing policy.
      const opening = await store.queryOne<{ santri_id: string }>(
        `SELECT santri_id FROM keuangan_non_spp_opening_balance WHERE santri_id=?
         AND jenis_biaya IN ('USPP','BANGUNAN') AND nominal_tagihan>0 AND COALESCE(status,'AKTIF')='AKTIF' LIMIT 1`, [santriId])
      if (opening) return result('REVIEW', 'USPP memiliki saldo awal legacy yang perlu dicocokkan.')
      const psb = await store.queryOne<{ santri_id: string }>('SELECT santri_id FROM psb_flow WHERE santri_id=? LIMIT 1', [santriId])
      const newAdmission = !!student.tanggal_masuk && /^\d{4}-\d{2}-\d{2}$/.test(student.tanggal_masuk) && student.tanggal_masuk >= `${FINANCE_CUTOVER_START_MONTHLY}-01`
      if (!psb && !newAdmission) return result('SKIPPED', 'USPP santri lama tidak diterbitkan ulang tanpa bukti kewajiban.')
    }
    try {
      const options = itemType === 'USPP' ? { academicYearId:null } : { providerSnapshotId:historicalProvider }
      // Preview and issuance share all eligibility checks. Issuance goes straight into
      // the validating engine, avoiding a redundant full tariff/legacy/provider preview
      // followed by the same reads again. No frontend amount or preview is persisted.
      let proposedId: string | undefined
      const obligation = materialize
        ? await engine.ensureObligation(santriId,itemType,period,options,false,id=>{proposedId=id})
        : await engine.previewObligation(santriId,itemType,period,options)
      const created = materialize && obligation.id === proposedId
      const outcome = obligation.status === 'EXEMPTED' ? 'EXEMPTED'
        : !materialize ? 'READY' : created ? 'CREATED' : 'EXISTING'
      return { ...result(outcome,undefined,obligation),providerSnapshotId:historicalProvider,
        ...(materialize ? { created } : {}) }
    } catch (error) {
      return result('FAILED', error instanceof Error ? error.message : 'Konfigurasi tagihan belum lengkap.')
    }
  }

  const assess = (santriId: string,itemType: FinanceItemType,period: string) => assessCandidate(santriId,itemType,period,false)
  const issue = (santriId: string,itemType: FinanceItemType,period: string) => assessCandidate(santriId,itemType,period,true)

  async function ensureStudent(santriId: string, selectedPeriod?: string): Promise<IssuanceResult> {
    let targets = currentBillingTargets(at)
    if (selectedPeriod && selectedPeriod !== billingClock(at).monthly) {
      if (!advanceBillingPeriods(at).includes(selectedPeriod)) throw new Error('Periode bayar di muka di luar rentang yang tersedia.')
      targets = targets.concat(
        ['SPP', 'UANG_MAKAN', 'UANG_NYUCI'].map(itemType => ({ itemType: itemType as FinanceItemType, period: selectedPeriod })))
    }
    const candidates: BillingCandidate[] = []
    // One initial eligibility snapshot per student, not seven identical reads.
    // The obligation engine still validates current active/billable/provider state
    // before every insert; legacy evidence, amounts, and balances are never cached.
    const student = await readStudent(santriId)
    for (const target of targets) {
      try { candidates.push(await assessCandidate(santriId,target.itemType,target.period,true,student)) }
      catch (error) { candidates.push({ santriId, ...target, outcome: 'FAILED', reason: error instanceof Error ? error.message : 'Penerbitan gagal.' }) }
    }
    return summarizeIssuance(candidates)
  }
  return { assess, issue, ensureStudent }
}

export function summarizeIssuance(candidates: BillingCandidate[]): IssuanceResult {
  return {
    candidates, created: candidates.filter(c => c.created).length,
    existing: candidates.filter(c => c.outcome === 'EXISTING' || c.outcome === 'LEGACY' || (c.outcome==='EXEMPTED' && !c.created)).length,
    skipped: candidates.filter(c => c.outcome === 'SKIPPED').length,
    review: candidates.filter(c => c.outcome === 'REVIEW').length,
    failed: candidates.filter(c => c.outcome === 'FAILED').length,
  }
}
