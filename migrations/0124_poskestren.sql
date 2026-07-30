-- ============================================================
-- Migration 0124: POSKESTREN
-- Klinik santri, stok obat, kas mandiri, personel dan penggajian.
-- Seluruh tabel berada di DB utama karena berelasi dengan santri.
-- ============================================================

ALTER TABLE users ADD COLUMN poskestren_jabatan TEXT;

CREATE INDEX IF NOT EXISTS idx_users_poskestren_jabatan
  ON users(poskestren_jabatan);

CREATE TABLE IF NOT EXISTS poskestren_patient (
  id                 TEXT PRIMARY KEY,
  santri_id          TEXT NOT NULL UNIQUE REFERENCES santri(id),
  medical_record_no  TEXT NOT NULL UNIQUE,
  blood_type         TEXT,
  allergies          TEXT,
  special_conditions TEXT,
  routine_medicines  TEXT,
  emergency_contact  TEXT,
  notes              TEXT,
  created_by         TEXT REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT
);

CREATE TABLE IF NOT EXISTS poskestren_personnel (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  personnel_type      TEXT NOT NULL CHECK (personnel_type IN ('MEDICAL','EMPLOYEE')),
  full_name           TEXT NOT NULL,
  profession          TEXT,
  position_name       TEXT,
  phone               TEXT,
  license_number      TEXT,
  employment_start    TEXT,
  employment_end      TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  notes               TEXT,
  created_by          TEXT REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT
);

CREATE TABLE IF NOT EXISTS poskestren_compensation_history (
  id                    TEXT PRIMARY KEY,
  personnel_id          TEXT NOT NULL REFERENCES poskestren_personnel(id),
  effective_from        TEXT NOT NULL,
  session_rate_rupiah   INTEGER CHECK (session_rate_rupiah IS NULL OR session_rate_rupiah >= 0),
  patient_rate_rupiah   INTEGER CHECK (patient_rate_rupiah IS NULL OR patient_rate_rupiah >= 0),
  monthly_salary_rupiah INTEGER CHECK (monthly_salary_rupiah IS NULL OR monthly_salary_rupiah >= 0),
  notes                 TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(personnel_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_pos_compensation_effective
  ON poskestren_compensation_history(personnel_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS poskestren_practice_session (
  id           TEXT PRIMARY KEY,
  personnel_id TEXT NOT NULL REFERENCES poskestren_personnel(id),
  session_date TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  notes        TEXT,
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_practice_one_open
  ON poskestren_practice_session(personnel_id)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_pos_practice_period
  ON poskestren_practice_session(session_date, personnel_id, status);

CREATE TABLE IF NOT EXISTS poskestren_visit (
  id                     TEXT PRIMARY KEY,
  patient_id             TEXT NOT NULL REFERENCES poskestren_patient(id),
  queue_date             TEXT NOT NULL,
  queue_number           INTEGER NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'MENUNGGU'
                           CHECK (status IN ('MENUNGGU','DIPERIKSA','SELESAI','DIRUJUK','BATAL')),
  source_type            TEXT NOT NULL DEFAULT 'MANUAL'
                           CHECK (source_type IN ('MANUAL','DATA_SAKIT')),
  source_episode_id      TEXT UNIQUE,
  source_absen_sakit_id  TEXT REFERENCES absen_sakit(id) ON DELETE SET NULL,
  personnel_id           TEXT REFERENCES poskestren_personnel(id),
  practice_session_id    TEXT REFERENCES poskestren_practice_session(id),
  complaint              TEXT,
  diagnosis              TEXT,
  treatment              TEXT,
  follow_up              TEXT,
  referral_destination   TEXT,
  referral_notes         TEXT,
  revision_no            INTEGER NOT NULL DEFAULT 0,
  registered_by          TEXT REFERENCES users(id),
  started_at             TEXT,
  completed_at           TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT,
  UNIQUE(queue_date, queue_number)
);

CREATE INDEX IF NOT EXISTS idx_pos_visit_queue
  ON poskestren_visit(queue_date, status, queue_number);
CREATE INDEX IF NOT EXISTS idx_pos_visit_patient
  ON poskestren_visit(patient_id, queue_date DESC);
CREATE INDEX IF NOT EXISTS idx_pos_visit_personnel_period
  ON poskestren_visit(personnel_id, queue_date, status);

CREATE TABLE IF NOT EXISTS poskestren_visit_revision (
  id            TEXT PRIMARY KEY,
  visit_id      TEXT NOT NULL REFERENCES poskestren_visit(id),
  revision_no   INTEGER NOT NULL,
  before_json   TEXT NOT NULL,
  reason        TEXT NOT NULL,
  revised_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(visit_id, revision_no)
);

CREATE TABLE IF NOT EXISTS poskestren_preventive_type (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS poskestren_preventive_program (
  id             TEXT PRIMARY KEY,
  type_id        TEXT REFERENCES poskestren_preventive_type(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  program_date   TEXT NOT NULL,
  target_summary TEXT,
  description    TEXT,
  attachment_url TEXT,
  personnel_id   TEXT REFERENCES poskestren_personnel(id),
  status         TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','COMPLETED','CANCELLED')),
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_pos_preventive_period
  ON poskestren_preventive_program(program_date, status, type_id);

CREATE TABLE IF NOT EXISTS poskestren_preventive_participant (
  id          TEXT PRIMARY KEY,
  program_id  TEXT NOT NULL REFERENCES poskestren_preventive_program(id) ON DELETE CASCADE,
  santri_id   TEXT NOT NULL REFERENCES santri(id),
  attendance  TEXT NOT NULL DEFAULT 'PENDING' CHECK (attendance IN ('PENDING','PRESENT','ABSENT')),
  result      TEXT,
  follow_up   TEXT,
  notes       TEXT,
  updated_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT,
  UNIQUE(program_id, santri_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_preventive_participant
  ON poskestren_preventive_participant(program_id, attendance, santri_id);

CREATE TABLE IF NOT EXISTS poskestren_medicine (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  generic_name        TEXT,
  category            TEXT,
  form                TEXT,
  strength            TEXT,
  base_unit           TEXT NOT NULL,
  minimum_stock_base  INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock_base >= 0),
  total_stock_base    INTEGER NOT NULL DEFAULT 0 CHECK (total_stock_base >= 0),
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  notes               TEXT,
  created_by          TEXT REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT
);

CREATE INDEX IF NOT EXISTS idx_pos_medicine_active_name
  ON poskestren_medicine(is_active, name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS poskestren_unit_conversion (
  id             TEXT PRIMARY KEY,
  medicine_id    TEXT NOT NULL REFERENCES poskestren_medicine(id) ON DELETE CASCADE,
  unit_name      TEXT NOT NULL,
  factor_to_base INTEGER NOT NULL CHECK (factor_to_base > 0),
  is_purchase_unit INTEGER NOT NULL DEFAULT 1 CHECK (is_purchase_unit IN (0,1)),
  UNIQUE(medicine_id, unit_name)
);

CREATE TABLE IF NOT EXISTS poskestren_supplier (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  phone      TEXT,
  address    TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS poskestren_purchase (
  id                  TEXT PRIMARY KEY,
  purchase_date       TEXT NOT NULL,
  supplier_id         TEXT REFERENCES poskestren_supplier(id) ON DELETE SET NULL,
  supplier_name       TEXT,
  status              TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','RECEIVED','CANCELLED')),
  payment_status      TEXT NOT NULL DEFAULT 'UNPOSTED' CHECK (payment_status IN ('UNPOSTED','POSTED','VOID')),
  total_rupiah        INTEGER NOT NULL DEFAULT 0 CHECK (total_rupiah >= 0),
  notes               TEXT,
  finance_transaction_id TEXT,
  created_by          TEXT REFERENCES users(id),
  received_by         TEXT REFERENCES users(id),
  received_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT
);

CREATE INDEX IF NOT EXISTS idx_pos_purchase_period
  ON poskestren_purchase(purchase_date, status, payment_status);

CREATE TABLE IF NOT EXISTS poskestren_purchase_item (
  id               TEXT PRIMARY KEY,
  purchase_id      TEXT NOT NULL REFERENCES poskestren_purchase(id) ON DELETE CASCADE,
  medicine_id      TEXT NOT NULL REFERENCES poskestren_medicine(id),
  unit_name        TEXT NOT NULL,
  factor_to_base   INTEGER NOT NULL CHECK (factor_to_base > 0),
  quantity_package INTEGER NOT NULL CHECK (quantity_package > 0),
  quantity_base    INTEGER NOT NULL CHECK (quantity_base > 0),
  unit_price       INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  subtotal_rupiah  INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_rupiah >= 0),
  batch_number     TEXT NOT NULL,
  expires_on       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pos_purchase_item_purchase
  ON poskestren_purchase_item(purchase_id, medicine_id);

CREATE TABLE IF NOT EXISTS poskestren_medicine_batch (
  id                  TEXT PRIMARY KEY,
  medicine_id         TEXT NOT NULL REFERENCES poskestren_medicine(id),
  purchase_item_id    TEXT UNIQUE REFERENCES poskestren_purchase_item(id) ON DELETE SET NULL,
  batch_number        TEXT NOT NULL,
  expires_on          TEXT,
  purchase_price_base INTEGER NOT NULL DEFAULT 0 CHECK (purchase_price_base >= 0),
  initial_quantity    INTEGER NOT NULL CHECK (initial_quantity >= 0),
  remaining_quantity  INTEGER NOT NULL CHECK (remaining_quantity >= 0),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(medicine_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_pos_batch_fefo
  ON poskestren_medicine_batch(medicine_id, expires_on, remaining_quantity);

CREATE TABLE IF NOT EXISTS poskestren_prescription (
  id         TEXT PRIMARY KEY,
  visit_id   TEXT UNIQUE REFERENCES poskestren_visit(id) ON DELETE SET NULL,
  program_id TEXT REFERENCES poskestren_preventive_program(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PARTIAL','DISPENSED','CANCELLED')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  CHECK (visit_id IS NOT NULL OR program_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS poskestren_prescription_item (
  id                      TEXT PRIMARY KEY,
  prescription_id         TEXT NOT NULL REFERENCES poskestren_prescription(id) ON DELETE CASCADE,
  medicine_id             TEXT NOT NULL REFERENCES poskestren_medicine(id),
  dosage                  TEXT,
  requested_quantity_base INTEGER NOT NULL CHECK (requested_quantity_base > 0),
  dispensed_quantity_base INTEGER NOT NULL DEFAULT 0 CHECK (dispensed_quantity_base >= 0),
  notes                   TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pos_prescription_item
  ON poskestren_prescription_item(prescription_id, medicine_id);

CREATE TABLE IF NOT EXISTS poskestren_stock_movement (
  id                 TEXT PRIMARY KEY,
  medicine_id        TEXT NOT NULL REFERENCES poskestren_medicine(id),
  batch_id           TEXT REFERENCES poskestren_medicine_batch(id) ON DELETE SET NULL,
  movement_date      TEXT NOT NULL,
  movement_type      TEXT NOT NULL CHECK (movement_type IN (
                         'PURCHASE','PATIENT','PREVENTIVE','EXPIRED','DAMAGED','LOST','ADJUSTMENT_IN','ADJUSTMENT_OUT','REVERSAL'
                       )),
  quantity_delta     INTEGER NOT NULL CHECK (quantity_delta <> 0),
  stock_before       INTEGER NOT NULL CHECK (stock_before >= 0),
  stock_after        INTEGER NOT NULL CHECK (stock_after >= 0),
  reference_type     TEXT,
  reference_id       TEXT,
  notes              TEXT,
  created_by         TEXT REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pos_stock_movement_period
  ON poskestren_stock_movement(movement_date, medicine_id, movement_type);
CREATE INDEX IF NOT EXISTS idx_pos_stock_movement_reference
  ON poskestren_stock_movement(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS poskestren_cash_account (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL CHECK (account_type IN ('CASH','BANK','EWALLET')),
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS poskestren_finance_category (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  direction        TEXT NOT NULL CHECK (direction IN ('INCOME','EXPENSE')),
  is_system        INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
  is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by       TEXT REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, direction)
);

CREATE TABLE IF NOT EXISTS poskestren_finance_transaction (
  id                    TEXT PRIMARY KEY,
  transaction_date      TEXT NOT NULL,
  transaction_type      TEXT NOT NULL CHECK (transaction_type IN (
                            'INCOME','EXPENSE','TRANSFER_IN','TRANSFER_OUT','OPENING','REVERSAL'
                          )),
  account_id            TEXT NOT NULL REFERENCES poskestren_cash_account(id),
  category_id           TEXT REFERENCES poskestren_finance_category(id) ON DELETE SET NULL,
  amount_rupiah         INTEGER NOT NULL CHECK (amount_rupiah > 0),
  counterparty          TEXT,
  description           TEXT NOT NULL,
  receipt_url           TEXT,
  transfer_group_id     TEXT,
  linked_transaction_id TEXT REFERENCES poskestren_finance_transaction(id) ON DELETE SET NULL,
  source_type           TEXT,
  source_id             TEXT,
  status                TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','VOID')),
  void_reason           TEXT,
  voided_by             TEXT REFERENCES users(id),
  voided_at             TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pos_finance_period
  ON poskestren_finance_transaction(transaction_date, transaction_type, status, account_id);
CREATE INDEX IF NOT EXISTS idx_pos_finance_category
  ON poskestren_finance_transaction(category_id, transaction_date, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_finance_source_unique
  ON poskestren_finance_transaction(source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL AND status = 'POSTED';

INSERT OR IGNORE INTO poskestren_cash_account(id, name, account_type, is_active, created_by)
VALUES ('pos-cash-default', 'Kas Tunai', 'CASH', 1, NULL);

INSERT OR IGNORE INTO poskestren_finance_category(id, name, direction, is_system, is_active)
VALUES
  ('pos-income-other', 'Lainnya', 'INCOME', 0, 1),
  ('pos-expense-other', 'Lainnya', 'EXPENSE', 0, 1),
  ('pos-expense-medicine', 'Belanja Obat', 'EXPENSE', 1, 1);

CREATE VIRTUAL TABLE IF NOT EXISTS poskestren_search_fts USING fts5(
  entity_type UNINDEXED,
  entity_id UNINDEXED,
  text_content,
  tokenize = 'unicode61 remove_diacritics 2'
);

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan)
VALUES
  ('POSKESTREN', 'Pemeriksaan', '/dashboard/poskestren/pemeriksaan', 'Stethoscope', '["admin","poskestren"]', 1, 1, 0, 0),
  ('POSKESTREN', 'Obat', '/dashboard/poskestren/obat', 'Package', '["admin","poskestren"]', 1, 2, 0, 0),
  ('POSKESTREN', 'Keuangan', '/dashboard/poskestren/keuangan', 'Wallet', '["admin","poskestren:bendahara"]', 1, 3, 0, 0),
  ('POSKESTREN', 'Laporan', '/dashboard/poskestren/laporan', 'FileText', '["admin","poskestren"]', 1, 4, 0, 0),
  ('POSKESTREN', 'Manajemen', '/dashboard/poskestren/manajemen', 'UserCog', '["admin","poskestren"]', 1, 5, 0, 0);

INSERT OR IGNORE INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
VALUES
  ('/dashboard/poskestren/pemeriksaan', 'poskestren', 1, 1, 0, datetime('now'), datetime('now')),
  ('/dashboard/poskestren/keuangan', 'poskestren:bendahara', 1, 1, 1, datetime('now'), datetime('now')),
  ('/dashboard/poskestren/laporan', 'poskestren', 0, 0, 0, datetime('now'), datetime('now')),
  ('/dashboard/poskestren/obat', 'poskestren', 1, 1, 0, datetime('now'), datetime('now')),
  ('/dashboard/poskestren/manajemen', 'poskestren', 1, 1, 0, datetime('now'), datetime('now'));

