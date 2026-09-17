-- Metadata kategori membuat NON_SPP tetap kompatibel sambil memisahkan itemnya.
ALTER TABLE finance_coop_bills ADD COLUMN category_code TEXT
  CHECK(category_code IS NULL OR category_code IN ('BANGUNAN','KESEHATAN','EHB','EKSKUL'));
ALTER TABLE finance_coop_bills ADD COLUMN academic_year_id INTEGER;
ALTER TABLE finance_coop_bills ADD COLUMN academic_year_label TEXT;
ALTER TABLE finance_coop_bills ADD COLUMN cohort_year INTEGER;
ALTER TABLE finance_coop_bills ADD COLUMN exemption_rule_id TEXT;
ALTER TABLE finance_coop_bills ADD COLUMN exempted_at TEXT;
ALTER TABLE finance_coop_bills ADD COLUMN exempted_by TEXT;
ALTER TABLE finance_coop_bills ADD COLUMN exemption_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS finance_coop_bill_building_lifetime
  ON finance_coop_bills(santri_id, category_code)
  WHERE kind='NON_SPP' AND category_code='BANGUNAN';

CREATE UNIQUE INDEX IF NOT EXISTS finance_coop_bill_annual_category
  ON finance_coop_bills(santri_id, category_code, academic_year_id)
  WHERE kind='NON_SPP' AND category_code IN ('KESEHATAN','EHB','EKSKUL');

CREATE TABLE IF NOT EXISTS finance_bill_exemptions (
  id TEXT PRIMARY KEY,
  santri_id TEXT NOT NULL,
  item_code TEXT NOT NULL CHECK(item_code IN ('SPP','MAKAN','LAUNDRY','BANGUNAN','KESEHATAN','EHB','EKSKUL')),
  scope TEXT NOT NULL CHECK(scope IN ('PERMANENT','PERIOD')),
  period_key TEXT,
  reason TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  CHECK((scope='PERMANENT' AND period_key IS NULL) OR (scope='PERIOD' AND period_key IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_bill_exemption_identity
  ON finance_bill_exemptions(santri_id,item_code,scope,COALESCE(period_key,''));
CREATE INDEX IF NOT EXISTS finance_bill_exemption_active
  ON finance_bill_exemptions(santri_id,item_code,is_active,period_key);

ALTER TABLE finance_coop_recipients ADD COLUMN bank_code TEXT;
