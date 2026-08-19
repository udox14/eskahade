-- Migrasi keuangan 0001c — TABEL tagihan, wali, dan gateway pembayaran.
-- Struktur payment_intents dan gateway_events TIDAK diubah: itu titik rawan
-- duplikasi/replay uang sungguhan dan sengaja dibiarkan apa adanya.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS finance_guardians (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  password_hash TEXT NOT NULL,
  pin_hash TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','BLOCKED','MIGRATION_PENDING')),
  legacy_santri_id TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Perubahan: kolom access_level dihapus. Tiga tingkat akses (PRIMARY_FINANCE/
-- VIEW/NOTIFY) memaksa pengurus memutuskan per pasangan wali-santri siapa yang
-- boleh membayar — keputusan tanpa dasar operasional yang hampir pasti diisi asal.
-- Relasi banyak-anak DIPERTAHANKAN: satu wali tetap satu login untuk semua anaknya.
CREATE TABLE IF NOT EXISTS finance_guardian_students (
  guardian_id TEXT NOT NULL REFERENCES finance_guardians(id),
  santri_id TEXT NOT NULL,
  relationship TEXT,
  linked_by TEXT,
  verified_at TEXT,
  verified_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(guardian_id, santri_id)
);

CREATE TABLE IF NOT EXISTS finance_payment_intents (
  id TEXT PRIMARY KEY,
  merchant_order_id TEXT NOT NULL UNIQUE,
  santri_id TEXT NOT NULL,
  guardian_id TEXT,
  provider TEXT NOT NULL DEFAULT 'DUITKU',
  payment_method TEXT NOT NULL,
  amount_rupiah INTEGER NOT NULL CHECK (typeof(amount_rupiah)='integer' AND amount_rupiah > 0),
  gateway_fee_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (gateway_fee_rupiah >= 0),
  charged_amount_rupiah INTEGER NOT NULL CHECK (charged_amount_rupiah > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','EXPIRED','CANCELLED','REVERSED')),
  payment_url TEXT,
  va_number TEXT,
  qr_string TEXT,
  expires_at TEXT NOT NULL,
  paid_at TEXT,
  late_paid INTEGER NOT NULL DEFAULT 0 CHECK (late_paid IN (0,1)),
  review_status TEXT NOT NULL DEFAULT 'NONE' CHECK (review_status IN ('NONE','REQUIRED','CLEARED')),
  provider_reference TEXT,
  provider_payload_json TEXT,
  journal_id TEXT REFERENCES finance_journals(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_gateway_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  merchant_order_id TEXT,
  signature_valid INTEGER NOT NULL CHECK (signature_valid IN (0,1)),
  payload_json TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (processing_status IN ('RECEIVED','PROCESSED','IGNORED','FAILED')),
  error_message TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  UNIQUE(provider, event_key)
);

CREATE TABLE IF NOT EXISTS finance_bills (
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

CREATE TABLE IF NOT EXISTS finance_allocations (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  santri_id TEXT NOT NULL,
  destination_kind TEXT NOT NULL CHECK (destination_kind IN ('SPP','USPP','NON_SPP','MAKAN','LAUNDRY','JAJAN')),
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah > 0),
  billing_reference TEXT,
  status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','COMMITTED','DISBURSED','RETURNED')),
  cutoff_at TEXT,
  journal_id TEXT NOT NULL REFERENCES finance_journals(id),
  created_by_type TEXT NOT NULL,
  created_by_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  committed_at TEXT,
  disbursed_at TEXT,
  returned_at TEXT
);

CREATE TABLE IF NOT EXISTS finance_allocation_bill_items (
  allocation_id TEXT NOT NULL REFERENCES finance_allocations(id),
  bill_id TEXT NOT NULL REFERENCES finance_bills(id),
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah>0),
  PRIMARY KEY(allocation_id,bill_id)
);

CREATE TABLE IF NOT EXISTS finance_service_tariffs (
  id TEXT PRIMARY KEY,
  service_kind TEXT NOT NULL CHECK (service_kind IN ('SPP','MAKAN','LAUNDRY')),
  effective_month TEXT NOT NULL CHECK (effective_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah>0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE IF NOT EXISTS finance_service_bill_skip (
  id          TEXT PRIMARY KEY,
  santri_id   TEXT NOT NULL,
  service_kind TEXT NOT NULL CHECK (service_kind IN ('MAKAN','LAUNDRY')),
  tahun       INTEGER NOT NULL,
  bulan       INTEGER NOT NULL,
  alasan      TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(santri_id, service_kind, tahun, bulan)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_guardian_phone ON finance_guardians(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_guardian_email ON finance_guardians(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_active_intent_student ON finance_payment_intents(santri_id) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS idx_finance_intent_status ON finance_payment_intents(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_finance_bills_student ON finance_bills(santri_id,status,due_date);
CREATE INDEX IF NOT EXISTS idx_finance_service_tariffs ON finance_service_tariffs(service_kind, effective_month);
CREATE INDEX IF NOT EXISTS idx_finance_service_arrears_santri ON finance_service_arrears_historis(santri_id, service_kind, status);
