-- SANDBOX ONLY. Explicit operator approval, frozen preflight and backup required.
-- Never use d1 migrations apply, never apply to production, never replay a partial stage.
SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM d1_migrations WHERE name='0193_sandbox_compatibility_columns.sql') THEN 'true' ELSE 'STOP_MIGRATION_ALREADY_RECORDED' END);

SELECT json(CASE WHEN (SELECT COUNT(*)=0 FROM "psb_payment_receipt") THEN 'true' ELSE 'STOP_NONEMPTY_psb_payment_receipt' END);

SELECT json(CASE WHEN (SELECT COUNT(*)=0 FROM "tabungan_log") THEN 'true' ELSE 'STOP_NONEMPTY_tabungan_log' END);

SELECT json(CASE WHEN (SELECT COUNT(*)=0 FROM "upk_pemasukan") THEN 'true' ELSE 'STOP_NONEMPTY_upk_pemasukan' END);

SELECT json(CASE WHEN (SELECT COUNT(*)=0 FROM "spp_setoran") THEN 'true' ELSE 'STOP_NONEMPTY_spp_setoran' END);

SELECT json(CASE WHEN (SELECT COUNT(*)=0 FROM "pembayaran_tahunan") THEN 'true' ELSE 'STOP_NONEMPTY_pembayaran_tahunan' END);

SELECT json(CASE WHEN (SELECT COUNT(*)=0 FROM "ehb_pengawas") THEN 'true' ELSE 'STOP_NONEMPTY_ehb_pengawas' END);

ALTER TABLE "ehb_pengawas" ADD COLUMN jenis_kelamin TEXT NOT NULL DEFAULT 'L';

ALTER TABLE "hasil_tes_klasifikasi" ADD COLUMN tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id);

ALTER TABLE "kelas" ADD COLUMN km_id TEXT REFERENCES santri(id);

ALTER TABLE "kelas" ADD COLUMN wakil_km_id TEXT REFERENCES santri(id);

ALTER TABLE "kelas" ADD COLUMN sekretaris_id TEXT REFERENCES santri(id);

ALTER TABLE "kelas" ADD COLUMN wakil_sekretaris_id TEXT REFERENCES santri(id);

ALTER TABLE "pelanggaran" ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled'));

ALTER TABLE "pelanggaran" ADD COLUMN review_state TEXT NOT NULL DEFAULT 'resolved' CHECK(review_state IN ('pending','resolved'));

ALTER TABLE "pelanggaran" ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "pelanggaran" ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE "pelanggaran" ADD COLUMN updated_at TEXT;

ALTER TABLE "pelanggaran" ADD COLUMN reason TEXT NOT NULL DEFAULT '';

ALTER TABLE "pembayaran_tahunan" ADD COLUMN portal_submission_id TEXT REFERENCES portal_payment_submission(id);

ALTER TABLE "pengajian_libur_sesi" ADD COLUMN jenis TEXT NOT NULL DEFAULT 'libur';

ALTER TABLE "pengajian_libur_sesi" ADD COLUMN keterangan TEXT;

ALTER TABLE "psb_flow" ADD COLUMN payment_note TEXT;

ALTER TABLE "psb_flow" ADD COLUMN verification_items TEXT;

ALTER TABLE "psb_payment_receipt" ADD COLUMN is_void INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "psb_payment_receipt" ADD COLUMN void_reason TEXT;

ALTER TABLE "psb_payment_receipt" ADD COLUMN voided_by TEXT;

ALTER TABLE "psb_payment_receipt" ADD COLUMN voided_at TEXT;

ALTER TABLE "psb_payment_receipt" ADD COLUMN metode TEXT NOT NULL DEFAULT 'TUNAI';

ALTER TABLE "santri" ADD COLUMN saldo_tabungan INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "santri" ADD COLUMN alasan_keluar TEXT;

ALTER TABLE "santri" ADD COLUMN poskestren_code TEXT;

ALTER TABLE "spp_log" ADD COLUMN psb_receipt_id TEXT REFERENCES psb_payment_receipt(id);

ALTER TABLE "spp_log" ADD COLUMN portal_submission_id TEXT REFERENCES portal_payment_submission(id);

ALTER TABLE "spp_log" ADD COLUMN tujuan_setoran TEXT NOT NULL DEFAULT 'DEWAN_SANTRI'
  CHECK (tujuan_setoran IN ('DEWAN_SANTRI', 'BENDAHARA_PUSAT'));

ALTER TABLE "spp_setoran" ADD COLUMN tujuan_setoran TEXT NOT NULL DEFAULT 'DEWAN_SANTRI'
  CHECK (tujuan_setoran IN ('DEWAN_SANTRI', 'BENDAHARA_PUSAT'));

ALTER TABLE "surat_pernyataan" ADD COLUMN incident_snapshot TEXT;

ALTER TABLE "tabungan_log" ADD COLUMN dompet TEXT NOT NULL DEFAULT 'JAJAN';

ALTER TABLE "tabungan_log" ADD COLUMN source TEXT NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "tabungan_log" ADD COLUMN transfer_group_id TEXT;

ALTER TABLE "tabungan_log" ADD COLUMN auto_rule_id TEXT;

ALTER TABLE "tabungan_log" ADD COLUMN run_date TEXT;

ALTER TABLE "upk_katalog" ADD COLUMN prioritas_stok TEXT NOT NULL DEFAULT 'LAMA';

ALTER TABLE "upk_pemasukan" ADD COLUMN lembar_100            INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "upk_pemasukan" ADD COLUMN lembar_50             INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "upk_pemasukan" ADD COLUMN nominal_tambahan      INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "users" ADD COLUMN poskestren_jabatan TEXT;

UPDATE santri SET saldo_tabungan=COALESCE((SELECT SUM(CASE jenis WHEN 'MASUK' THEN nominal ELSE -nominal END) FROM tabungan_log t WHERE t.santri_id=santri.id AND t.dompet='TABUNGAN'),0);

UPDATE spp_log SET tujuan_setoran='BENDAHARA_PUSAT' WHERE bulan=7 AND EXISTS(SELECT 1 FROM psb_flow pf WHERE pf.santri_id=spp_log.santri_id) AND EXISTS(SELECT 1 FROM santri s WHERE s.id=spp_log.santri_id AND COALESCE(NULLIF(CAST(s.tahun_masuk AS INTEGER),0),CAST(substr(s.tanggal_masuk,1,4) AS INTEGER))=spp_log.tahun);

WITH ranked AS (SELECT id,CASE WHEN UPPER(SUBSTR(TRIM(nama_lengkap),1,1)) GLOB '[A-Z]' THEN UPPER(SUBSTR(TRIM(nama_lengkap),1,1)) ELSE 'X' END AS initial_letter,ROW_NUMBER() OVER(PARTITION BY CASE WHEN UPPER(SUBSTR(TRIM(nama_lengkap),1,1)) GLOB '[A-Z]' THEN UPPER(SUBSTR(TRIM(nama_lengkap),1,1)) ELSE 'X' END ORDER BY created_at,id) AS sequence_number FROM santri) UPDATE santri SET poskestren_code=(SELECT initial_letter||'-'||sequence_number FROM ranked WHERE ranked.id=santri.id) WHERE poskestren_code IS NULL OR poskestren_code='';

INSERT INTO poskestren_patient_code_sequence(initial_letter,next_number) SELECT SUBSTR(poskestren_code,1,1),MAX(CAST(SUBSTR(poskestren_code,INSTR(poskestren_code,'-')+1) AS INTEGER))+1 FROM santri WHERE poskestren_code IS NOT NULL AND poskestren_code<>'' GROUP BY SUBSTR(poskestren_code,1,1) ON CONFLICT(initial_letter) DO UPDATE SET next_number=MAX(next_number,excluded.next_number);

INSERT INTO d1_migrations(name) VALUES('0193_sandbox_compatibility_columns.sql');
