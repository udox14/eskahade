-- Finance migration 0007: tagihan bulanan Uang Makan & Laundry (bill_kind baru)
-- + tabel tarif effective-dated (dipakai bareng oleh SPP/Makan/Laundry) + tabel
-- backfill tunggakan lama Makan/Laundry.
--
-- SQLite tidak bisa ALTER CHECK constraint langsung — finance_bills di-recreate
-- dengan CHECK bill_kind yang diperluas, lalu index & trigger yang ikut hilang
-- saat DROP TABLE dibuat ulang. Data existing dipindah apa adanya.

PRAGMA foreign_keys=OFF;

CREATE TABLE finance_bills_new (
  id TEXT PRIMARY KEY,
  santri_id TEXT NOT NULL,
  bill_kind TEXT NOT NULL CHECK (bill_kind IN ('SPP','USPP','NON_SPP','MAKAN','LAUNDRY')),
  title TEXT NOT NULL,
  period_key TEXT,
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah>0),
  paid_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (paid_rupiah>=0 AND paid_rupiah<=amount_rupiah),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PARTIAL','PAID','VOID')),
  due_date TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO finance_bills_new (id,santri_id,bill_kind,title,period_key,amount_rupiah,paid_rupiah,status,due_date,created_by,created_at,updated_at)
SELECT id,santri_id,bill_kind,title,period_key,amount_rupiah,paid_rupiah,status,due_date,created_by,created_at,updated_at
FROM finance_bills;

DROP TABLE finance_bills;
ALTER TABLE finance_bills_new RENAME TO finance_bills;

CREATE INDEX IF NOT EXISTS idx_finance_bills_student ON finance_bills(santri_id,status,due_date);

DROP TRIGGER IF EXISTS trg_finance_bill_payment_rules;
CREATE TRIGGER trg_finance_bill_payment_rules
BEFORE UPDATE OF paid_rupiah ON finance_bills
BEGIN
  SELECT CASE WHEN NEW.paid_rupiah>NEW.amount_rupiah THEN RAISE(ABORT,'FINANCE_BILL_OVERPAID') END;
  SELECT CASE WHEN OLD.bill_kind IN ('SPP','NON_SPP','MAKAN','LAUNDRY') AND NEW.paid_rupiah NOT IN (0,NEW.amount_rupiah)
    THEN RAISE(ABORT,'FINANCE_BILL_REQUIRES_FULL_PAYMENT') END;
END;

PRAGMA foreign_keys=ON;

-- trg_finance_allocation_bill_validate (migrations-finance/0006) juga menegakkan
-- full-only payment untuk SPP/NON_SPP di titik lain (validasi INSERT ke
-- finance_allocation_bill_items) — samakan supaya MAKAN/LAUNDRY konsisten.
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

-- Tarif effective-dated, dipakai bareng SPP + Makan + Laundry. Tarif untuk
-- suatu bulan = baris terbaru dengan effective_month <= bulan itu — ganti
-- tarif tidak pernah menimpa bill yang sudah dibuat (amount_rupiah bill
-- disimpan sendiri di finance_bills, cuma bill BARU yang ikut tarif terbaru).
CREATE TABLE IF NOT EXISTS finance_service_tariffs (
  id TEXT PRIMARY KEY,
  service_kind TEXT NOT NULL CHECK (service_kind IN ('SPP','MAKAN','LAUNDRY')),
  effective_month TEXT NOT NULL CHECK (effective_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah>0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_finance_service_tariffs ON finance_service_tariffs(service_kind, effective_month);

-- Backfill tunggakan lama Makan/Laundry dari sebelum fitur ini ada — bentuk
-- fleksibel (label bebas, bukan tahun+bulan presisi) karena data lama
-- kemungkinan tidak tercatat rapi per bulan. SPP sudah punya tabel historis
-- sendiri (spp_tunggakan_historis di DB utama), tidak diduplikasi di sini.
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
