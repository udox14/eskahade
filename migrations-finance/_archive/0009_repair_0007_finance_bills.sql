-- Migrasi 0009: catatan pemulihan insiden migrasi 0007 di FINANCE_DB remote
-- (production), 2026-08-16.
--
-- Duduk perkaranya: 0007_service_billing.sql dijalankan lewat
-- `wrangler d1 execute --file`. Bagian DROP TABLE finance_bills sukses, tapi
-- ALTER TABLE finance_bills_new RENAME TO finance_bills tidak sempat commit
-- sebelum sisa statement di file itu berhenti — kemungkinan D1 mengeksekusi
-- statement dalam satu file secara tidak sepenuhnya sekuensial-committed
-- untuk kombinasi DROP+RENAME+CREATE TRIGGER. Akibatnya finance_bills hilang
-- dari skema selama beberapa saat (hanya finance_bills_new yang tersisa),
-- dan trigger trg_finance_allocation_bill_validate sempat berhasil dibuat
-- (CREATE TRIGGER tidak memvalidasi tabel yang cuma disebut di body) tapi
-- jadi "menggantung" — meledak begitu dipicu (INSERT ke
-- finance_allocation_bill_items) atau begitu ALTER TABLE RENAME mencoba
-- memvalidasi ulang seluruh trigger di skema.
--
-- Trigger trg_finance_allocation_bill_apply (dari migrasi lebih lama,
-- 0006_finance_integrity_hardening.sql) ikut menggantung dengan alasan sama.
--
-- Urutan pemulihan yang BENAR-BENAR dijalankan (via `--file` per langkah,
-- BUKAN `--command` tunggal berisi banyak statement — wrangler/D1 memecah
-- teks --command berdasarkan titik koma secara naif, sehingga body trigger
-- yang berisi banyak `;` di dalam BEGIN...END pecah jadi fragmen tidak
-- lengkap ("incomplete input")):
--
--   1. DROP TRIGGER trg_finance_allocation_bill_validate;   (menggantung)
--   2. DROP TRIGGER trg_finance_allocation_bill_apply;      (menggantung)
--   3. ALTER TABLE finance_bills_new RENAME TO finance_bills;
--   4. CREATE INDEX idx_finance_bills_student ...
--   5. Recreate trg_finance_allocation_bill_apply (persis seperti sebelum di-drop)
--   6. Recreate trg_finance_bill_payment_rules (isi identik dengan 0007)
--   7. Recreate trg_finance_allocation_bill_validate (isi identik dengan 0007)
--   8. CREATE TABLE finance_service_tariffs + finance_service_arrears_historis
--      (ekor 0007 yang belum sempat terbentuk) + index masing-masing
--
-- Semua sudah dijalankan & diverifikasi ada di FINANCE_DB remote per
-- 2026-08-16. File ini murni catatan sejarah — TIDAK PERLU dijalankan ulang
-- (aman kalau dijalankan ulang karena semua idempotent, tapi tidak
-- diperlukan). Kalau ada environment lain (mis. DEMO_FINANCE_DB, local dev)
-- yang belum pernah menjalankan 0007 sama sekali, jalankan 0007 seperti
-- biasa di sana — masalah ini spesifik pada state production yang sempat
-- setengah-jalan, bukan bug permanen di file 0007.

DROP TRIGGER IF EXISTS trg_finance_allocation_bill_apply;
CREATE TRIGGER trg_finance_allocation_bill_apply
AFTER INSERT ON finance_allocation_bill_items
BEGIN
  UPDATE finance_bills
  SET paid_rupiah=paid_rupiah+NEW.amount_rupiah,
      status=CASE WHEN paid_rupiah+NEW.amount_rupiah=amount_rupiah THEN 'PAID' ELSE 'PARTIAL' END,
      updated_at=datetime('now')
  WHERE id=NEW.bill_id;
END;

DROP TRIGGER IF EXISTS trg_finance_bill_payment_rules;
CREATE TRIGGER trg_finance_bill_payment_rules
BEFORE UPDATE OF paid_rupiah ON finance_bills
BEGIN
  SELECT CASE WHEN NEW.paid_rupiah>NEW.amount_rupiah THEN RAISE(ABORT,'FINANCE_BILL_OVERPAID') END;
  SELECT CASE WHEN OLD.bill_kind IN ('SPP','NON_SPP','MAKAN','LAUNDRY') AND NEW.paid_rupiah NOT IN (0,NEW.amount_rupiah)
    THEN RAISE(ABORT,'FINANCE_BILL_REQUIRES_FULL_PAYMENT') END;
END;

DROP TRIGGER IF EXISTS trg_finance_allocation_bill_validate;
CREATE TRIGGER trg_finance_allocation_bill_validate
BEFORE INSERT ON finance_allocation_bill_items
BEGIN
  SELECT CASE WHEN COALESCE((SELECT status FROM finance_bills WHERE id=NEW.bill_id),'') NOT IN ('OPEN','PARTIAL')
    THEN RAISE(ABORT,'FINANCE_BILL_NOT_OPEN') END;
  SELECT CASE WHEN
    COALESCE((SELECT santri_id FROM finance_bills WHERE id=NEW.bill_id),'')
    <> COALESCE((SELECT santri_id FROM finance_allocations WHERE id=NEW.allocation_id),'')
    THEN RAISE(ABORT,'FINANCE_BILL_OWNER_MISMATCH') END;
  SELECT CASE WHEN NEW.amount_rupiah>(SELECT amount_rupiah-paid_rupiah FROM finance_bills WHERE id=NEW.bill_id)
    THEN RAISE(ABORT,'FINANCE_BILL_OVERPAID') END;
  SELECT CASE WHEN (SELECT bill_kind FROM finance_bills WHERE id=NEW.bill_id) IN ('SPP','NON_SPP','MAKAN','LAUNDRY')
    AND NEW.amount_rupiah<>(SELECT amount_rupiah-paid_rupiah FROM finance_bills WHERE id=NEW.bill_id)
    THEN RAISE(ABORT,'FINANCE_BILL_REQUIRES_FULL_PAYMENT') END;
END;

CREATE TABLE IF NOT EXISTS finance_service_tariffs (
  id TEXT PRIMARY KEY,
  service_kind TEXT NOT NULL CHECK (service_kind IN ('SPP','MAKAN','LAUNDRY')),
  effective_month TEXT NOT NULL CHECK (effective_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah>0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_finance_service_tariffs ON finance_service_tariffs(service_kind, effective_month);

CREATE TABLE IF NOT EXISTS finance_service_arrears_historis (
  id TEXT PRIMARY KEY,
  santri_id TEXT NOT NULL,
  service_kind TEXT NOT NULL CHECK (service_kind IN ('MAKAN','LAUNDRY')),
  label TEXT NOT NULL,
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah>0),
  status TEXT NOT NULL DEFAULT 'BELUM_LUNAS' CHECK (status IN ('BELUM_LUNAS','LUNAS')),
  catatan TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_finance_service_arrears_santri ON finance_service_arrears_historis(santri_id, service_kind, status);
