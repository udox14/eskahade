import type { BillingStore } from './billing-store'
import { nonBillableItemSqlPredicate, nonBillableSantriSqlPredicate } from './non-billable-santri'
import { FINANCE_CUTOVER_START_ANNUAL, FINANCE_CUTOVER_START_MONTHLY } from './legacy-reader'

/** Authoritative legacy sources. Never infer an annual period from a payment date. */
export const legacyBillingEvidence = `
 SELECT sl.santri_id,'SPP' AS item_type,printf('%04d-%02d',sl.tahun,sl.bulan) AS period,
   sl.nominal_bayar AS amount,0 AS voided,('LEGACY_SPP_LOG:'||sl.id) AS reference
 FROM spp_log sl
 UNION ALL
 SELECT pt.santri_id,CASE WHEN pt.jenis_biaya='BANGUNAN' THEN 'USPP' ELSE pt.jenis_biaya END,
   CASE WHEN pt.jenis_biaya='BANGUNAN' THEN 'LIFETIME'
     ELSE COALESCE(CAST(pt.tahun_tagihan AS TEXT),substr(ta.nama,1,4)) END,
   pt.nominal_bayar,CASE WHEN pt.status='VOID' THEN 1 ELSE 0 END,
   ('LEGACY_PEMBAYARAN_TAHUNAN:'||pt.id)
 FROM pembayaran_tahunan pt LEFT JOIN tahun_ajaran ta ON ta.id=pt.tahun_ajaran_id
 WHERE pt.jenis_biaya IN ('BANGUNAN','EHB','EKSKUL','KESEHATAN')`

/** Read existing legacy waivers; never rewrite them or manufacture a new exemption. */
export function legacyExemptSql(alias = 'o'): string {
  return `(${alias}.item_type='SPP' AND (EXISTS(SELECT 1 FROM santri bs
    WHERE bs.id=${alias}.santri_id AND COALESCE(bs.bebas_spp,0)=1)
    OR EXISTS(SELECT 1 FROM spp_tagihan_ditiadakan td WHERE td.santri_id=${alias}.santri_id
      AND printf('%04d-%02d',td.tahun,td.bulan)=${alias}.period AND td.is_active=1)))`
}

/** A missing mirror, changed amount, ambiguous period, or unreversed void blocks collection. */
export function legacyReviewSql(alias = 'o'): string {
  return `(EXISTS (SELECT 1 FROM (${legacyBillingEvidence}) be
    WHERE be.santri_id=${alias}.santri_id AND be.item_type=${alias}.item_type
      AND (be.period=${alias}.period OR be.period IS NULL)
      AND (be.period IS NULL OR (be.voided=0 AND (be.amount<=0 OR
        be.amount<>COALESCE((SELECT SUM(a.amount-COALESCE((SELECT SUM(ci.amount)
          FROM finance_correction_items ci WHERE ci.target_allocation_id=a.id),0))
          FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id
          WHERE p.channel='CASH' AND p.external_reference=be.reference AND a.obligation_id=${alias}.id),0)))
        OR (be.voided=1 AND COALESCE((SELECT SUM(a.amount-COALESCE((SELECT SUM(ci.amount)
          FROM finance_correction_items ci WHERE ci.target_allocation_id=a.id),0))
          FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id
          WHERE p.channel='CASH' AND p.external_reference=be.reference AND a.obligation_id=${alias}.id),0)>0)))
    OR EXISTS(SELECT 1 FROM finance_allocations oa JOIN finance_payments op ON op.id=oa.payment_id
      WHERE oa.obligation_id=${alias}.id AND op.source='LEGACY'
        AND oa.amount-COALESCE((SELECT SUM(ci.amount) FROM finance_correction_items ci WHERE ci.target_allocation_id=oa.id),0)>0
        AND (op.external_reference LIKE 'LEGACY_SPP_LOG:%' OR op.external_reference LIKE 'LEGACY_PEMBAYARAN_TAHUNAN:%')
        AND NOT EXISTS(SELECT 1 FROM (${legacyBillingEvidence}) oe WHERE oe.reference=op.external_reference)))`
}

export function collectibleBillingSql(alias = 'o'): string {
  const billable = `EXISTS(SELECT 1 FROM santri bstudent WHERE bstudent.id=${alias}.santri_id
    AND ${nonBillableSantriSqlPredicate('bstudent.asrama')}
    AND (${alias}.item_type NOT IN ('UANG_MAKAN','UANG_NYUCI') OR
      ${nonBillableItemSqlPredicate('bstudent.asrama','bstudent.kategori_santri','UANG_MAKAN')}))`
  return `(NOT (${legacyReviewSql(alias)}) AND NOT ${legacyExemptSql(alias)} AND ${billable})`
}

export function orderBillingConflictSql(): string {
  return `SELECT 1 FROM finance_order_items boi JOIN finance_obligations o ON o.id=boi.obligation_id
    WHERE boi.order_id=? AND NOT ${collectibleBillingSql('o')}`
}

export async function billingReviewCount(store: BillingStore, santriId?: string) {
  const row = await store.queryOne<{ count: number }>(`SELECT COUNT(*) count FROM (${legacyBillingEvidence}) be
    JOIN santri bs ON bs.id=be.santri_id
    LEFT JOIN finance_obligations o ON o.santri_id=be.santri_id AND o.item_type=be.item_type AND o.period=be.period
    WHERE bs.status_global='aktif' AND ${nonBillableSantriSqlPredicate('bs.asrama')}
      ${santriId ? 'AND be.santri_id=?' : ''}
      AND (be.period IS NULL OR be.period='LIFETIME' OR (length(be.period)=7 AND be.period>='${FINANCE_CUTOVER_START_MONTHLY}')
        OR (length(be.period)=4 AND CAST(be.period AS INTEGER)>=${FINANCE_CUTOVER_START_ANNUAL}))
      AND ((be.voided=0 AND o.id IS NULL) OR (o.id IS NOT NULL AND ${legacyReviewSql('o')}))`,santriId ? [santriId] : [])
  const orphan = await store.queryOne<{ count: number }>(`SELECT COUNT(*) count FROM finance_obligations o
    JOIN santri bs ON bs.id=o.santri_id WHERE bs.status_global='aktif'
    AND ${nonBillableSantriSqlPredicate('bs.asrama')} ${santriId ? 'AND o.santri_id=?' : ''}
    AND ${legacyReviewSql('o')} AND NOT EXISTS(SELECT 1 FROM (${legacyBillingEvidence}) be
      WHERE be.santri_id=o.santri_id AND be.item_type=o.item_type AND (be.period=o.period OR be.period IS NULL))`,santriId ? [santriId] : [])
  return (row?.count ?? 0) + (orphan?.count ?? 0)
}

export async function assertBillingCollectible(store: BillingStore, obligationId: string): Promise<void> {
  const row = await store.queryOne<{ review: number; exempted: number }>(
    `SELECT (${legacyReviewSql('o')}) AS review,${legacyExemptSql('o')} AS exempted FROM finance_obligations o WHERE o.id=?`, [obligationId])
  if (!row) throw new Error('Tagihan tidak ditemukan.')
  if (row.review) throw new Error('Perlu Pemeriksaan: pembayaran modul lama untuk tagihan ini belum sesuai. Pembayaran ulang ditahan.')
  if (row.exempted) throw new Error('Tagihan SPP ini dibebaskan/ditiadakan pada pengaturan existing.')
}
