-- Migrasi keuangan 0001e - TABEL pencairan, payroll, dan rekonsiliasi.

PRAGMA foreign_keys = ON;

-- Perubahan: kolom usable_after (cooling period 24 jam) dan status FROZEN dihapus.
-- Verifikasi oleh petugas berbeda tetap menjadi syarat rekening bisa dipakai.
CREATE TABLE IF NOT EXISTS finance_recipients (
  id TEXT PRIMARY KEY,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('MEAL_MANAGER','LAUNDRY_MANAGER','TEACHER','OTHER')),
  name TEXT NOT NULL,
  asrama_scope TEXT,
  bank_code TEXT,
  account_number_encrypted TEXT,
  account_number_masked TEXT,
  account_holder_name TEXT,
  verified_at TEXT,
  verified_by TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (status IN ('PENDING_VERIFICATION','ACTIVE','INACTIVE')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Perubahan: peran executor dihapus (maker-checker-executor menjadi maker-checker),
-- dan delapan status dipangkas menjadi tujuh berbahasa Indonesia. DIPROSES hanya
-- dipakai metode API selama menunggu jawaban provider - tanpa status itu, dua
-- klik beruntun mengirim dua transfer sungguhan. Larangan
-- self-approval (maker <> checker) TETAP, ditegakkan trigger di 0001g.
CREATE TABLE IF NOT EXISTS finance_payouts (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  recipient_id TEXT NOT NULL REFERENCES finance_recipients(id),
  payout_type TEXT NOT NULL CHECK (payout_type IN ('MEAL','LAUNDRY','PAYROLL','REFUND','OTHER')),
  asrama_scope TEXT,
  amount_rupiah INTEGER NOT NULL CHECK (amount_rupiah > 0),
  fee_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (fee_rupiah >= 0),
  method TEXT NOT NULL CHECK (method IN ('API','MANUAL_TRANSFER','CASH')),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','DIAJUKAN','DISETUJUI','DIPROSES','DIBAYAR','GAGAL','DIBATALKAN')),
  maker_id TEXT NOT NULL,
  checker_id TEXT,
  provider_reference TEXT,
  provider_payload_json TEXT,
  proof_url TEXT,
  journal_id TEXT REFERENCES finance_journals(id),
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked_at TEXT,
  paid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payroll disederhanakan: gaji tetap bulanan dengan potongan opsional per hari
-- alfa (tanpa keterangan) dan per hari badal (diganti guru lain). Tarif potongan 0
-- berarti guru dibayar penuh. finance_payroll_policies dan
-- finance_teaching_attendance dihapus seluruhnya.
CREATE TABLE IF NOT EXISTS finance_teacher_compensation (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  monthly_salary_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (monthly_salary_rupiah >= 0),
  alfa_deduction_per_day_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (alfa_deduction_per_day_rupiah >= 0),
  badal_deduction_per_day_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (badal_deduction_per_day_rupiah >= 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(teacher_id, effective_from)
);

CREATE TABLE IF NOT EXISTS finance_payroll_periods (
  id TEXT PRIMARY KEY,
  period_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','DIHITUNG','DISETUJUI','DIBAYAR')),
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_payroll_items (
  id TEXT PRIMARY KEY,
  payroll_period_id TEXT NOT NULL REFERENCES finance_payroll_periods(id),
  teacher_id TEXT NOT NULL,
  monthly_salary_rupiah INTEGER NOT NULL DEFAULT 0,
  alfa_days INTEGER NOT NULL DEFAULT 0 CHECK (alfa_days >= 0),
  badal_days INTEGER NOT NULL DEFAULT 0 CHECK (badal_days >= 0),
  deduction_rupiah INTEGER NOT NULL DEFAULT 0 CHECK (deduction_rupiah >= 0),
  net_rupiah INTEGER NOT NULL CHECK (net_rupiah >= 0),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'DIHITUNG'
    CHECK (status IN ('DIHITUNG','DISETUJUI','DIBAYAR','GAGAL')),
  payout_id TEXT REFERENCES finance_payouts(id),
  journal_id TEXT REFERENCES finance_journals(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(payroll_period_id, teacher_id)
);

-- Rekonsiliasi bank: checklist bulanan manual, menggantikan import berkas +
-- auto-matching per baris (finance_reconciliation_imports, finance_bank_transactions).
CREATE TABLE IF NOT EXISTS finance_reconciliation_checks (
  id TEXT PRIMARY KEY,
  period_key TEXT NOT NULL,
  bank_account_label TEXT NOT NULL,
  system_total_rupiah INTEGER NOT NULL,
  statement_total_rupiah INTEGER NOT NULL,
  difference_rupiah INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COCOK','SELISIH','DIJELASKAN')),
  note TEXT,
  checked_by TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(period_key, bank_account_label)
);

