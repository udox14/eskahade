-- Additive migration 0196. Remote production/sandbox ledger and schema audited 2026-10-21.
-- Production ledger ends at 0190; sandbox includes 0191 and sandbox-only 0192-0195.
-- No existing finance rows, CUTOVER, tariffs, exemptions, or legacy tables are changed.
CREATE TABLE finance_billing_runs (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  selection_json TEXT,
  status TEXT NOT NULL DEFAULT 'RUNNING' CHECK(status IN ('RUNNING','COMPLETED')),
  cursor TEXT NOT NULL DEFAULT '',
  lease_token TEXT,
  lease_until TEXT,
  created_count INTEGER NOT NULL DEFAULT 0,
  existing_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE finance_billing_issues (
  santri_id TEXT NOT NULL REFERENCES santri(id),
  item_type TEXT NOT NULL CHECK(item_type IN ('SPP','UANG_MAKAN','UANG_NYUCI','EHB','EKSKUL','KESEHATAN','USPP')),
  period TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('OPEN','RESOLVED')),
  reason TEXT NOT NULL,
  evidence_provider_id TEXT REFERENCES master_jasa(id),
  evidence_note TEXT,
  evidence_verified_by TEXT REFERENCES users(id),
  evidence_verified_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(santri_id,item_type,period)
);
CREATE INDEX idx_finance_billing_issues_status ON finance_billing_issues(status,updated_at);

-- New indexes only; existing legacy records are unchanged.
CREATE INDEX IF NOT EXISTS idx_billing_legacy_spp ON spp_log(santri_id,tahun,bulan);
CREATE INDEX IF NOT EXISTS idx_billing_legacy_annual ON pembayaran_tahunan(santri_id,jenis_biaya,tahun_tagihan,tahun_ajaran_id);

-- Last-moment protection if legacy evidence changes after the application precheck.
CREATE TRIGGER trg_finance_billing_order_review BEFORE INSERT ON finance_order_items
WHEN NEW.obligation_id IS NOT NULL AND EXISTS(
 SELECT 1 FROM finance_obligations o WHERE o.id=NEW.obligation_id AND NOT (NOT ((EXISTS (SELECT 1 FROM (
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
 WHERE pt.jenis_biaya IN ('BANGUNAN','EHB','EKSKUL','KESEHATAN')) be
    WHERE be.santri_id=o.santri_id AND be.item_type=o.item_type
      AND (be.period=o.period OR be.period IS NULL)
      AND (be.period IS NULL OR (be.voided=0 AND (be.amount<=0 OR
        be.amount<>COALESCE((SELECT SUM(a.amount-COALESCE((SELECT SUM(ci.amount)
          FROM finance_correction_items ci WHERE ci.target_allocation_id=a.id),0))
          FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id
          WHERE p.channel='CASH' AND p.external_reference=be.reference AND a.obligation_id=o.id),0)))
        OR (be.voided=1 AND COALESCE((SELECT SUM(a.amount-COALESCE((SELECT SUM(ci.amount)
          FROM finance_correction_items ci WHERE ci.target_allocation_id=a.id),0))
          FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id
          WHERE p.channel='CASH' AND p.external_reference=be.reference AND a.obligation_id=o.id),0)>0)))
    OR EXISTS(SELECT 1 FROM finance_allocations oa JOIN finance_payments op ON op.id=oa.payment_id
      WHERE oa.obligation_id=o.id AND op.source='LEGACY'
        AND oa.amount-COALESCE((SELECT SUM(ci.amount) FROM finance_correction_items ci WHERE ci.target_allocation_id=oa.id),0)>0
        AND (op.external_reference LIKE 'LEGACY_SPP_LOG:%' OR op.external_reference LIKE 'LEGACY_PEMBAYARAN_TAHUNAN:%')
        AND NOT EXISTS(SELECT 1 FROM (
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
 WHERE pt.jenis_biaya IN ('BANGUNAN','EHB','EKSKUL','KESEHATAN')) oe WHERE oe.reference=op.external_reference)))) AND NOT (o.item_type='SPP' AND (EXISTS(SELECT 1 FROM santri bs
    WHERE bs.id=o.santri_id AND COALESCE(bs.bebas_spp,0)=1)
    OR EXISTS(SELECT 1 FROM spp_tagihan_ditiadakan td WHERE td.santri_id=o.santri_id
      AND printf('%04d-%02d',td.tahun,td.bulan)=o.period AND td.is_active=1))) AND EXISTS(SELECT 1 FROM santri bstudent WHERE bstudent.id=o.santri_id
    AND (UPPER(TRIM(COALESCE(bstudent.asrama, ''))) NOT IN ('AL-BAGHORY'))
    AND (o.item_type NOT IN ('UANG_MAKAN','UANG_NYUCI') OR
      (UPPER(TRIM(COALESCE(bstudent.asrama, ''))) NOT IN ('AL-BAGHORY') AND UPPER(TRIM(COALESCE(bstudent.kategori_santri, 'REGULER'))) NOT IN ('SADESA'))))))
BEGIN SELECT RAISE(ABORT,'BILLING_REVIEW_REQUIRED'); END;

CREATE TRIGGER trg_finance_billing_allocation_review BEFORE INSERT ON finance_allocations
WHEN NEW.obligation_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM finance_payments bp WHERE bp.id=NEW.payment_id AND bp.source<>'LEGACY')
 AND EXISTS(SELECT 1 FROM finance_obligations o WHERE o.id=NEW.obligation_id AND NOT (NOT ((EXISTS (SELECT 1 FROM (
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
 WHERE pt.jenis_biaya IN ('BANGUNAN','EHB','EKSKUL','KESEHATAN')) be
    WHERE be.santri_id=o.santri_id AND be.item_type=o.item_type
      AND (be.period=o.period OR be.period IS NULL)
      AND (be.period IS NULL OR (be.voided=0 AND (be.amount<=0 OR
        be.amount<>COALESCE((SELECT SUM(a.amount-COALESCE((SELECT SUM(ci.amount)
          FROM finance_correction_items ci WHERE ci.target_allocation_id=a.id),0))
          FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id
          WHERE p.channel='CASH' AND p.external_reference=be.reference AND a.obligation_id=o.id),0)))
        OR (be.voided=1 AND COALESCE((SELECT SUM(a.amount-COALESCE((SELECT SUM(ci.amount)
          FROM finance_correction_items ci WHERE ci.target_allocation_id=a.id),0))
          FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id
          WHERE p.channel='CASH' AND p.external_reference=be.reference AND a.obligation_id=o.id),0)>0)))
    OR EXISTS(SELECT 1 FROM finance_allocations oa JOIN finance_payments op ON op.id=oa.payment_id
      WHERE oa.obligation_id=o.id AND op.source='LEGACY'
        AND oa.amount-COALESCE((SELECT SUM(ci.amount) FROM finance_correction_items ci WHERE ci.target_allocation_id=oa.id),0)>0
        AND (op.external_reference LIKE 'LEGACY_SPP_LOG:%' OR op.external_reference LIKE 'LEGACY_PEMBAYARAN_TAHUNAN:%')
        AND NOT EXISTS(SELECT 1 FROM (
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
 WHERE pt.jenis_biaya IN ('BANGUNAN','EHB','EKSKUL','KESEHATAN')) oe WHERE oe.reference=op.external_reference)))) AND NOT (o.item_type='SPP' AND (EXISTS(SELECT 1 FROM santri bs
    WHERE bs.id=o.santri_id AND COALESCE(bs.bebas_spp,0)=1)
    OR EXISTS(SELECT 1 FROM spp_tagihan_ditiadakan td WHERE td.santri_id=o.santri_id
      AND printf('%04d-%02d',td.tahun,td.bulan)=o.period AND td.is_active=1))) AND EXISTS(SELECT 1 FROM santri bstudent WHERE bstudent.id=o.santri_id
    AND (UPPER(TRIM(COALESCE(bstudent.asrama, ''))) NOT IN ('AL-BAGHORY'))
    AND (o.item_type NOT IN ('UANG_MAKAN','UANG_NYUCI') OR
      (UPPER(TRIM(COALESCE(bstudent.asrama, ''))) NOT IN ('AL-BAGHORY') AND UPPER(TRIM(COALESCE(bstudent.kategori_santri, 'REGULER'))) NOT IN ('SADESA'))))))
BEGIN SELECT RAISE(ABORT,'BILLING_REVIEW_REQUIRED'); END;
