import io, json

T = json.load(io.open('C:/DATA/eskahade/tmp/tables.json', encoding='utf-8'))
IDX = [l for l in io.open('C:/DATA/eskahade/tmp/indexes.sql', encoding='utf-8').read().split('\n') if l.strip()]
OUT = 'C:/DATA/eskahade/migrations-finance/'


def verbatim(n):
    b = T[n]
    for pat in ('CREATE TABLE IF NOT EXISTS "%s"' % n, 'CREATE TABLE "%s"' % n, 'CREATE TABLE %s' % n):
        b = b.replace(pat, 'CREATE TABLE IF NOT EXISTS %s' % n)
    return b


def idx_for(names):
    out = []
    for l in IDX:
        if 'access_level' in l:
            continue
        if any((' ON %s(' % x) in l or (' ON %s (' % x) in l for x in names):
            out.append(l if l.rstrip().endswith(';') else l + ';')
    return out


def write(fn, header, tables, custom=None):
    custom = custom or {}
    out = [header, '', 'PRAGMA foreign_keys = ON;', '']
    for n in tables:
        out.append(custom[n] if n in custom else verbatim(n))
        out.append('')
    out += idx_for(tables)
    io.open(OUT + fn, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(fn, 'ok')


POLICY = """-- Perubahan: mode HYBRID dan BOTH_TRANSITION dihapus beserta tiga kolom transisi.
-- Satu metode aktif saja. Kolom mode dipertahankan (bukan dihapus) supaya
-- penambahan RFID kelak cukup melonggarkan satu CHECK, tanpa migrasi tabel.
CREATE TABLE IF NOT EXISTS finance_credential_policy (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id=1),
  mode TEXT NOT NULL DEFAULT 'QR' CHECK (mode = 'QR'),
  denomination_rupiah INTEGER NOT NULL DEFAULT 5000 CHECK (denomination_rupiah > 0),
  per_transaction_cap_rupiah INTEGER NOT NULL DEFAULT 200000 CHECK (per_transaction_cap_rupiah > 0),
  pin_max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (pin_max_attempts > 0),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);"""

CREDS = """-- Perubahan: credential_kind dipersempit ke QR_STATIC; status SUSPENDED_BY_POLICY
-- dibuang karena hanya dipakai mekanisme transisi RFID<->QR yang sudah dihapus.
-- LOST dan REVOKED tetap ada dan tetap tidak pernah bisa diaktifkan kembali.
CREATE TABLE IF NOT EXISTS student_credentials (
  id TEXT PRIMARY KEY,
  santri_id TEXT NOT NULL,
  credential_kind TEXT NOT NULL DEFAULT 'QR_STATIC' CHECK (credential_kind = 'QR_STATIC'),
  token_hmac TEXT NOT NULL,
  token_encrypted TEXT,
  token_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','BLOCKED','LOST','EXPIRED','REVOKED')),
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  blocked_reason TEXT,
  replacement_credential_id TEXT REFERENCES student_credentials(id),
  physically_verified_at TEXT,
  physically_verified_by TEXT,
  last_used_at TEXT,
  created_by TEXT,
  card_number TEXT,
  print_count INTEGER NOT NULL DEFAULT 0,
  last_printed_at TEXT,
  UNIQUE(credential_kind, token_hmac, token_version)
);"""

RECIPIENTS = """-- Perubahan: kolom usable_after (cooling period 24 jam) dan status FROZEN dihapus.
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
);"""

PAYOUTS = """-- Perubahan: peran executor dihapus (maker-checker-executor menjadi maker-checker),
-- dan delapan status dipangkas menjadi enam berbahasa Indonesia. Larangan
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
    CHECK (status IN ('DRAFT','DIAJUKAN','DISETUJUI','DIBAYAR','GAGAL','DIBATALKAN')),
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
);"""

PAYROLL = """-- Payroll disederhanakan: gaji tetap bulanan dengan potongan opsional per hari
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
);"""

withdrawals = verbatim('finance_withdrawals').replace(
    "credential_kind TEXT NOT NULL CHECK (credential_kind IN ('RFID_UID','QR_STATIC')),",
    "credential_kind TEXT NOT NULL DEFAULT 'QR_STATIC' CHECK (credential_kind = 'QR_STATIC'),")

write('0001d_tables_loket.sql',
      '-- Migrasi keuangan 0001d - TABEL kredensial santri, unit kas, dan penarikan loket.\n'
      '-- finance_withdrawal_limits dipertahankan UTUH: tiga limit harian/mingguan/bulanan.',
      ['finance_credential_policy', 'student_credentials', 'finance_credential_batches',
       'finance_credential_batch_items', 'finance_student_security', 'finance_withdrawal_limits',
       'finance_cash_units', 'finance_cash_unit_operators', 'finance_cash_shifts', 'finance_withdrawals'],
      {'finance_credential_policy': POLICY, 'student_credentials': CREDS, 'finance_withdrawals': withdrawals})

io.open(OUT + '0001e_tables_payout.sql', 'w', encoding='utf-8').write('\n'.join([
    '-- Migrasi keuangan 0001e - TABEL pencairan, payroll, dan rekonsiliasi.', '',
    'PRAGMA foreign_keys = ON;', '', RECIPIENTS, '', PAYOUTS, '', PAYROLL, '']) + '\n')
print('0001e_tables_payout.sql ok')

write('0001f_tables_support.sql',
      '-- Migrasi keuangan 0001f - TABEL pendukung: jejak audit, setelan, snapshot master.\n'
      '-- finance_staff_snapshots dihapus: nama staf di-resolve saat render dari DB utama.',
      ['finance_audit_log', 'finance_settings', 'finance_student_snapshots', 'finance_teacher_snapshots'])
