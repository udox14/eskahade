-- Unit kerja memakai core transaksi yang sama. module_code adalah boundary
-- RBAC dan pelaporan, bukan cabang atau lokasi organisasi.
ALTER TABLE finance_coop_bills ADD COLUMN module_code TEXT
  CHECK(module_code IS NULL OR module_code IN ('UANG_JAJAN','MAKAN','LAUNDRY','SPP','BANGUNAN','BIAYA_TAHUNAN'));
ALTER TABLE finance_coop_bills ADD COLUMN due_at TEXT;

UPDATE finance_coop_bills SET module_code=CASE
  WHEN kind='SPP' THEN 'SPP'
  WHEN kind='MAKAN' THEN 'MAKAN'
  WHEN kind='LAUNDRY' THEN 'LAUNDRY'
  WHEN kind='NON_SPP' AND category_code='BANGUNAN' THEN 'BANGUNAN'
  WHEN kind='NON_SPP' AND category_code IN ('EHB','EKSKUL','KESEHATAN') THEN 'BIAYA_TAHUNAN'
  ELSE NULL END;

UPDATE finance_coop_bills
SET due_at=date(substr(period_key,1,7)||'-01','+1 month','-1 day')
WHERE module_code IN ('SPP','MAKAN','LAUNDRY')
  AND period_key GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]*';

ALTER TABLE finance_coop_tariffs ADD COLUMN module_code TEXT
  CHECK(module_code IS NULL OR module_code IN ('UANG_JAJAN','MAKAN','LAUNDRY','SPP','BANGUNAN','BIAYA_TAHUNAN'));
UPDATE finance_coop_tariffs SET module_code=CASE
  WHEN kind='SPP' THEN 'SPP' WHEN kind='MAKAN' THEN 'MAKAN'
  WHEN kind='LAUNDRY' THEN 'LAUNDRY' ELSE NULL END;

ALTER TABLE finance_order_items ADD COLUMN module_code TEXT
  CHECK(module_code IS NULL OR module_code IN ('UANG_JAJAN','MAKAN','LAUNDRY','SPP','BANGUNAN','BIAYA_TAHUNAN'));
UPDATE finance_order_items SET module_code=CASE
  WHEN kind='JAJAN' THEN 'UANG_JAJAN' WHEN kind='SPP' THEN 'SPP'
  WHEN kind='MAKAN' THEN 'MAKAN' WHEN kind='LAUNDRY' THEN 'LAUNDRY'
  WHEN bill_id IS NOT NULL THEN (SELECT module_code FROM finance_coop_bills WHERE id=finance_order_items.bill_id)
  ELSE NULL END;

ALTER TABLE finance_distributions ADD COLUMN module_code TEXT
  CHECK(module_code IS NULL OR module_code IN ('UANG_JAJAN','MAKAN','LAUNDRY','SPP','BANGUNAN','BIAYA_TAHUNAN'));
UPDATE finance_distributions SET module_code=CASE
  WHEN (SELECT kind FROM finance_coop_recipients WHERE id=finance_distributions.recipient_id)='MAKAN' THEN 'MAKAN'
  WHEN (SELECT kind FROM finance_coop_recipients WHERE id=finance_distributions.recipient_id)='LAUNDRY' THEN 'LAUNDRY'
  ELSE NULL END;
ALTER TABLE finance_audit_log ADD COLUMN module_code TEXT
  CHECK(module_code IS NULL OR module_code IN ('UANG_JAJAN','MAKAN','LAUNDRY','SPP','BANGUNAN','BIAYA_TAHUNAN'));

CREATE TABLE IF NOT EXISTS finance_module_access (
  user_id TEXT NOT NULL,
  module_code TEXT NOT NULL CHECK(module_code IN ('UANG_JAJAN','MAKAN','LAUNDRY','SPP','BANGUNAN','BIAYA_TAHUNAN')),
  permissions_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  PRIMARY KEY(user_id,module_code)
);

CREATE TABLE IF NOT EXISTS finance_module_settings (
  module_code TEXT PRIMARY KEY CHECK(module_code IN ('UANG_JAJAN','MAKAN','LAUNDRY','SPP','BANGUNAN','BIAYA_TAHUNAN')),
  active_period TEXT,
  due_day INTEGER CHECK(due_day IS NULL OR due_day BETWEEN 1 AND 31),
  settings_json TEXT NOT NULL DEFAULT '{}',
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_module_help_progress (
  user_id TEXT NOT NULL,
  module_code TEXT NOT NULL CHECK(module_code IN ('UANG_JAJAN','MAKAN','LAUNDRY','SPP','BANGUNAN','BIAYA_TAHUNAN')),
  step_code TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  PRIMARY KEY(user_id,module_code,step_code)
);

CREATE TABLE IF NOT EXISTS finance_module_migration_reconciliation (
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, reason TEXT NOT NULL,
  resolved_module_code TEXT, resolved_by TEXT, resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  PRIMARY KEY(entity_type,entity_id)
);

INSERT OR IGNORE INTO finance_module_migration_reconciliation(entity_type,entity_id,reason)
SELECT 'BILL',id,'Tagihan NON_SPP lama tidak memiliki kategori yang dapat menentukan unit kerja.'
FROM finance_coop_bills WHERE module_code IS NULL;

INSERT OR IGNORE INTO finance_module_migration_reconciliation(entity_type,entity_id,reason)
SELECT 'TARIFF',id,'Tarif NON_SPP lama tidak menyimpan kategori Bangunan atau Biaya Tahunan.'
FROM finance_coop_tariffs WHERE module_code IS NULL;

INSERT OR IGNORE INTO finance_module_migration_reconciliation(entity_type,entity_id,reason)
SELECT 'DISTRIBUTION',id,'Penyaluran lama ke pesantren tidak menyimpan unit kerja asal penerimaan.'
FROM finance_distributions WHERE module_code IS NULL;

CREATE INDEX IF NOT EXISTS finance_bills_module_period ON finance_coop_bills(module_code,period_key,status);
CREATE INDEX IF NOT EXISTS finance_order_items_module ON finance_order_items(module_code,order_id);
CREATE INDEX IF NOT EXISTS finance_distributions_module ON finance_distributions(module_code,status,created_at);
CREATE INDEX IF NOT EXISTS finance_audit_module ON finance_audit_log(module_code,created_at);
