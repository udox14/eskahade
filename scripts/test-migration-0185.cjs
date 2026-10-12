// scripts/test-migration-0185.cjs
// Standalone migration 0185 verification test suite (BRI-5 QLola Non-STP Distribution)

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const root = path.resolve(__dirname, '..')
const db = new DatabaseSync(':memory:')
db.exec('PRAGMA foreign_keys = ON;')

console.log('--- Setting up prerequisite schema for Migration 0185 ---')
db.exec(`
  CREATE TABLE users (id TEXT PRIMARY KEY, full_name TEXT);
  CREATE TABLE master_jasa (id TEXT PRIMARY KEY, nama_jasa TEXT, jenis TEXT);
  CREATE TABLE santri (id TEXT PRIMARY KEY, nama TEXT);

  CREATE TABLE finance_distribution_recipients (
      id TEXT PRIMARY KEY,
      recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PESANTREN', 'KATERING', 'LAUNDRY')),
      name TEXT NOT NULL,
      provider_id TEXT REFERENCES master_jasa(id),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      allowed_methods TEXT NOT NULL DEFAULT 'BRI_QLOLA,CASH,MANUAL_TRANSFER',
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE finance_recipient_accounts (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL REFERENCES finance_distribution_recipients(id),
      bank_code TEXT NOT NULL,
      account_number TEXT NOT NULL,
      account_holder TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE finance_recipient_allowed_methods (
      recipient_id TEXT NOT NULL REFERENCES finance_distribution_recipients(id) ON DELETE CASCADE,
      method TEXT NOT NULL CHECK (method IN ('BRI_QLOLA', 'CASH', 'MANUAL_TRANSFER')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (recipient_id, method)
  );

  CREATE TABLE finance_allocations (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL,
      obligation_id TEXT,
      item_type TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      disbursed_amount INTEGER NOT NULL DEFAULT 0,
      distribution_status TEXT NOT NULL DEFAULT 'UNDISBURSED',
      provider_id TEXT,
      target_type TEXT NOT NULL DEFAULT 'OBLIGATION',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE finance_correction_items (
      id TEXT PRIMARY KEY,
      target_allocation_id TEXT REFERENCES finance_allocations(id),
      obligation_id TEXT,
      amount INTEGER NOT NULL CHECK (amount > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE finance_distributions (
      id TEXT PRIMARY KEY,
      distribution_number TEXT NOT NULL UNIQUE,
      recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PESANTREN', 'KATERING', 'LAUNDRY')),
      recipient_id TEXT REFERENCES finance_distribution_recipients(id),
      item_type TEXT NOT NULL,
      period TEXT NOT NULL,
      total_amount INTEGER NOT NULL CHECK (total_amount > 0),
      method TEXT NOT NULL CHECK (method IN ('BRI_QLOLA', 'CASH', 'MANUAL_TRANSFER')),
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
          'DRAFT', 'PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING',
          'DISTRIBUTED', 'FAILED', 'REJECTED', 'CANCELLED'
      )),
      destination_bank TEXT,
      destination_account TEXT,
      account_holder_name TEXT,
      external_reference TEXT,
      proof_attachment_url TEXT,
      submitted_by TEXT REFERENCES users(id),
      submitted_at TEXT,
      transferred_by TEXT REFERENCES users(id),
      transferred_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE finance_distribution_items (
      id TEXT PRIMARY KEY,
      distribution_id TEXT NOT NULL REFERENCES finance_distributions(id) ON DELETE CASCADE,
      allocation_id TEXT NOT NULL REFERENCES finance_allocations(id),
      amount INTEGER NOT NULL CHECK (amount > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Triggers dari 0182
  CREATE TRIGGER trg_finance_dist_enforce_qlola_insert
  BEFORE INSERT ON finance_distributions
  FOR EACH ROW
  WHEN NEW.method = 'BRI_QLOLA' AND NEW.status NOT IN ('DRAFT', 'PENDING_APPROVAL')
  BEGIN
      SELECT RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP baru wajib berstatus DRAFT atau PENDING_APPROVAL.');
  END;

  CREATE TRIGGER trg_finance_dist_enforce_qlola_transitions
  BEFORE UPDATE OF status ON finance_distributions
  FOR EACH ROW
  WHEN NEW.method = 'BRI_QLOLA'
  BEGIN
      SELECT CASE
          WHEN OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'PENDING_APPROVAL', 'CANCELLED')
          THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari DRAFT hanya boleh diajukan ke PENDING_APPROVAL atau dibatalkan ke CANCELLED.')
      END;

      SELECT CASE
          WHEN OLD.status = 'PENDING_APPROVAL' AND NEW.status NOT IN ('PENDING_APPROVAL', 'PROCESSING', 'REJECTED', 'CANCEL_PENDING', 'CANCELLED')
          THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari PENDING_APPROVAL hanya boleh beralih ke PROCESSING, REJECTED, CANCEL_PENDING, atau CANCELLED.')
      END;

      SELECT CASE
          WHEN OLD.status = 'PROCESSING' AND NEW.status NOT IN ('PROCESSING', 'DISTRIBUTED', 'FAILED', 'CANCEL_PENDING')
          THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari PROCESSING hanya boleh beralih ke DISTRIBUTED, FAILED, atau CANCEL_PENDING.')
      END;

      SELECT CASE
          WHEN OLD.status = 'CANCEL_PENDING' AND NEW.status NOT IN ('CANCEL_PENDING', 'CANCELLED', 'DISTRIBUTED', 'FAILED', 'PROCESSING')
          THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari CANCEL_PENDING hanya boleh beralih ke CANCELLED, DISTRIBUTED, FAILED, atau PROCESSING.')
      END;

      SELECT CASE
          WHEN OLD.status IN ('DISTRIBUTED', 'FAILED', 'REJECTED', 'CANCELLED') AND NEW.status != OLD.status
          THEN RAISE(ABORT, 'Penyaluran dengan status terminal bersifat final dan tidak dapat diubah.')
      END;
  END;

  CREATE TRIGGER trg_finance_dist_header_financial_fields_immutable
  BEFORE UPDATE ON finance_distributions
  FOR EACH ROW
  WHEN OLD.status != 'DRAFT'
  BEGIN
      SELECT
          CASE
              WHEN NEW.recipient_type != OLD.recipient_type
                OR NEW.recipient_id IS NOT OLD.recipient_id
                OR NEW.item_type != OLD.item_type
                OR NEW.period != OLD.period
                OR NEW.total_amount != OLD.total_amount
                OR NEW.method != OLD.method
                OR NEW.destination_bank IS NOT OLD.destination_bank
                OR NEW.destination_account IS NOT OLD.destination_account
                OR NEW.account_holder_name IS NOT OLD.account_holder_name
              THEN RAISE(ABORT, 'Field finansial instruksi penyaluran bersifat immutable setelah pengajuan.')
          END;
  END;
`)

// Apply Migration 0185
console.log('Applying Migration 0185...')
const migration0185Sql = fs.readFileSync(path.join(root, 'migrations', '0185_bri_qlola_distribution.sql'), 'utf8')
db.exec(migration0185Sql)
console.log('Migration 0185 applied successfully!')

// Seed prerequisite test data
db.exec(`
  INSERT INTO users (id, full_name) VALUES ('usr-1', 'Admin Keuangan');
  INSERT INTO finance_distribution_recipients (id, recipient_type, name, is_active, allowed_methods)
  VALUES ('rec_pesantren', 'PESANTREN', 'Pesantren Sukahideng', 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER');
  INSERT INTO finance_recipient_accounts (id, recipient_id, bank_code, account_number, account_holder, is_primary, is_active)
  VALUES ('acc-1', 'rec_pesantren', '002', '001901000999301', 'Yayasan Pesantren', 1, 1);
  INSERT INTO finance_allocations (id, payment_id, item_type, amount)
  VALUES ('alloc-1', 'pay-1', 'SPP', 500000);
`)

console.log('\n--- Running Migration 0185 Invariant Tests ---')

// 1. Snapshot and tracking fields exist on finance_distributions
db.prepare(`
  INSERT INTO finance_distributions (
    id, distribution_number, recipient_type, recipient_id,
    recipient_name, recipient_category, item_type, period, total_amount, method, status,
    destination_bank, destination_bank_code, destination_account, destination_account_holder,
    account_holder_name, account_id, distribution_request_id, batch_reference, maker_reference,
    currency, bank_fee_amount, bank_fee_bearer
  ) VALUES (
    'dist-1', 'DIS-20261008-0001', 'PESANTREN', 'rec_pesantren',
    'Pesantren Sukahideng', 'PESANTREN', 'SPP', '2026-10', 500000, 'BRI_QLOLA', 'DRAFT',
    '002', '002', '001901000999301', 'Yayasan Pesantren',
    'Yayasan Pesantren', 'acc-1', 'REQ-DIST-001', 'BATCH-001', 'usr-1',
    'IDR', NULL, 'KOPERASI'
  );
`).run()
const distRow = db.prepare("SELECT * FROM finance_distributions WHERE id = 'dist-1'").get()
assert.strictEqual(distRow.recipient_name, 'Pesantren Sukahideng')
assert.strictEqual(distRow.recipient_category, 'PESANTREN')
assert.strictEqual(distRow.currency, 'IDR')
assert.strictEqual(distRow.distribution_request_id, 'REQ-DIST-001')
assert.strictEqual(distRow.batch_reference, 'BATCH-001')
console.log('✓ 1. Snapshot and tracking columns persisted successfully.')

// 2. Unique constraint on distribution_request_id prevents duplicate submission IDs
assert.throws(() => {
  db.prepare(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, item_type, period,
      total_amount, method, status, distribution_request_id
    ) VALUES (
      'dist-dup', 'DIS-20261008-0002', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10',
      500000, 'BRI_QLOLA', 'DRAFT', 'REQ-DIST-001'
    );
  `).run()
}, /UNIQUE constraint failed/, 'Must reject duplicate distribution_request_id')
console.log('✓ 2. Unique index uq_finance_distributions_req_id blocks duplicate request ID.')

// 3. Outbox table finance_qlola_transfer_intents enforces constraints
db.prepare(`
  INSERT INTO finance_qlola_transfer_intents (
    id, distribution_id, distribution_request_id, intent_status,
    external_id, maker_user_id, payload_hash, provider_status
  ) VALUES (
    'intent-1', 'dist-1', 'REQ-DIST-001', 'SUBMITTED',
    'EXT-12345', 'usr-1', 'hash-payload-abc', 'WAITING_APPROVAL'
  );
`).run()
const intentRow = db.prepare("SELECT * FROM finance_qlola_transfer_intents WHERE id = 'intent-1'").get()
assert.strictEqual(intentRow.intent_status, 'SUBMITTED')
assert.strictEqual(intentRow.maker_user_id, 'usr-1')

// Invalid intent_status rejected by CHECK constraint on fresh distribution
db.prepare(`
  INSERT INTO finance_distributions (
    id, distribution_number, recipient_type, recipient_id, item_type, period,
    total_amount, method, status
  ) VALUES (
    'dist-check', 'DIS-CHECK-001', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10',
    500000, 'BRI_QLOLA', 'DRAFT'
  );
`).run()

assert.throws(() => {
  db.prepare(`
    INSERT INTO finance_qlola_transfer_intents (
      id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
    ) VALUES (
      'intent-bad', 'dist-check', 'REQ-DIST-999', 'INVALID_STATUS', 'usr-1', 'hash'
    );
  `).run()
}, /CHECK constraint failed/, 'Must reject invalid intent_status')

// Second active intent on dist-1 rejected by trigger
assert.throws(() => {
  db.prepare(`
    INSERT INTO finance_qlola_transfer_intents (
      id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
    ) VALUES (
      'intent-second', 'dist-1', 'REQ-DIST-999', 'SUBMISSION_PENDING', 'usr-1', 'hash'
    );
  `).run()
}, /Distribusi telah memiliki intent transfer aktif atau telah disubmit/, 'Must reject second active intent')
console.log('✓ 3. Table finance_qlola_transfer_intents stores outbox records with valid state machine & anti-duplication.')

// 3b. Verify CANCEL_PENDING intent is accepted and reserves funds
db.exec(`
  INSERT INTO finance_distributions (
    id, distribution_number, recipient_type, recipient_id, item_type, period,
    total_amount, method, status
  ) VALUES (
    'dist-cp-test', 'DIS-CP-001', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10',
    500000, 'BRI_QLOLA', 'DRAFT'
  );
  INSERT INTO finance_qlola_transfer_intents (
    id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
  ) VALUES (
    'intent-cp-1', 'dist-cp-test', 'REQ-CP-001', 'CANCEL_PENDING', 'usr-1', 'hash-cp'
  );
`)
const intentCpRow = db.prepare("SELECT intent_status FROM finance_qlola_transfer_intents WHERE id = 'intent-cp-1'").get()
assert.strictEqual(intentCpRow.intent_status, 'CANCEL_PENDING')

// 4. Trigger: Header financial fields are frozen once submitted (leaving DRAFT) or when intent is active
// Verify TEST_PROVIDER cannot authorize transition
db.prepare(`
  INSERT INTO finance_qlola_provider_evidence (
    id, distribution_id, source, evidence_type, evidence_strength, provider_state,
    provider_reference, observed_at, raw_evidence_hash, recorded_by
  ) VALUES (
    'ev-tp-sub', 'dist-1', 'TEST_PROVIDER', 'SUBMISSION_ACK', 'AUTHORITATIVE_EXACT', 'WAITING_APPROVAL',
    'TP-BATCH-001', datetime('now'), 'hash-tp-sub', 'usr-1'
  );
`).run()

assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist-1'").run()
}, /Peralihan DRAFT ke PENDING_APPROVAL wajib memiliki bukti SUBMISSION_ACK otoritatif \(non-TEST_PROVIDER\)/, 'Must reject PENDING_APPROVAL based on TEST_PROVIDER evidence')

// Insert eligible H2H_SYNC evidence for dist-1 before updating to PENDING_APPROVAL
db.prepare(`
  INSERT INTO finance_qlola_provider_evidence (
    id, distribution_id, source, evidence_type, evidence_strength, provider_state,
    provider_reference, observed_at, raw_evidence_hash, recorded_by
  ) VALUES (
    'ev-sub-1', 'dist-1', 'H2H_SYNC', 'SUBMISSION_ACK', 'AUTHORITATIVE_EXACT', 'WAITING_APPROVAL',
    'BATCH-001', datetime('now'), 'hash-sub-1', 'usr-1'
  );
`).run()

db.prepare("UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist-1'").run()

assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET recipient_name = 'Hacker Destination' WHERE id = 'dist-1'").run()
}, /Field finansial instruksi penyaluran.*bersifat immutable/, 'Must reject modifying recipient_name after submission')

assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET destination_bank_code = '999' WHERE id = 'dist-1'").run()
}, /Field finansial instruksi penyaluran.*bersifat immutable/, 'Must reject modifying destination_bank_code after submission')

assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET currency = 'USD' WHERE id = 'dist-1'").run()
}, /CHECK constraint failed|Field finansial instruksi penyaluran/, 'Must reject non-IDR currency')
console.log('✓ 4. Extended immutability trigger blocks tampering with recipient snapshots and bank codes after submission.')

// 5. Trigger: Cannot switch method away from BRI_QLOLA while in PENDING_APPROVAL, PROCESSING, or CANCEL_PENDING
assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET method = 'CASH' WHERE id = 'dist-1'").run()
}, /Dilarang mengganti metode penyaluran saat dana berada dalam status reservasi aktif/, 'Must reject switching method while reserving')
console.log('✓ 5. Trigger trg_finance_dist_prevent_method_switch_when_reserving blocks switching to CASH/MANUAL while in PENDING_APPROVAL.')

// Advance to PROCESSING (insert H2H_SYNC APPROVAL_PROGRESS evidence first)
db.prepare(`
  INSERT INTO finance_qlola_provider_evidence (
    id, distribution_id, source, evidence_type, evidence_strength, provider_state,
    provider_reference, observed_at, raw_evidence_hash, recorded_by
  ) VALUES (
    'ev-app-1', 'dist-1', 'H2H_SYNC', 'APPROVAL_PROGRESS', 'AUTHORITATIVE_EXACT', 'APPROVED',
    'BATCH-001', datetime('now'), 'hash-app-1', 'usr-1'
  );
`).run()

db.prepare("UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist-1'").run()
assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET method = 'MANUAL_TRANSFER' WHERE id = 'dist-1'").run()
}, /Dilarang mengganti metode penyaluran saat dana berada dalam status reservasi aktif/, 'Must reject switching method while PROCESSING')

// Advance to CANCEL_PENDING and test method switch again
db.prepare("UPDATE finance_distributions SET status = 'CANCEL_PENDING' WHERE id = 'dist-1'").run()
assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET method = 'CASH' WHERE id = 'dist-1'").run()
}, /Dilarang mengganti metode penyaluran saat dana berada dalam status reservasi aktif/, 'Must reject switching method while CANCEL_PENDING')
console.log('✓ 6. Method switch protection verified across all live reserving states (PENDING_APPROVAL, PROCESSING, CANCEL_PENDING).')

// 7. Trigger: Cannot cancel directly to CANCELLED if dispatch was attempted without bank confirmation evidence
db.prepare(`
  INSERT INTO finance_distributions (
    id, distribution_number, recipient_type, recipient_id,
    recipient_name, recipient_category, item_type, period, total_amount, method, status,
    dispatch_attempted_at, submission_outcome
  ) VALUES (
    'dist-disp', 'DIS-20261008-0003', 'PESANTREN', 'rec_pesantren',
    'Pesantren Sukahideng', 'PESANTREN', 'SPP', '2026-10', 500000, 'BRI_QLOLA', 'PENDING_APPROVAL',
    datetime('now'), 'UNKNOWN'
  );
`).run()

assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET status = 'CANCELLED' WHERE id = 'dist-disp'").run()
}, /Pembatalan dilarang: Pengiriman ke bank telah dicoba atau diakui tanpa bukti konfirmasi pembatalan otoritatif/, 'Must reject CANCELLED when dispatch was attempted')

// CANCEL_PENDING is allowed
db.prepare("UPDATE finance_distributions SET status = 'CANCEL_PENDING' WHERE id = 'dist-disp'").run()
console.log('✓ 7. Trigger trg_finance_dist_prevent_cancel_if_dispatched blocks direct CANCELLED after dispatch attempt.')

// 8. Trigger: Transition to DISTRIBUTED, FAILED, or REJECTED requires authoritative provider evidence
assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist-disp'").run()
}, /Peralihan status ke DISTRIBUTED wajib memiliki bukti EXECUTION_SUCCESS otoritatif/, 'Must reject DISTRIBUTED without provider evidence')

assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET status = 'FAILED' WHERE id = 'dist-disp'").run()
}, /Peralihan status ke FAILED wajib memiliki bukti EXECUTION_FAILED otoritatif/, 'Must reject FAILED without provider evidence')

// Insert valid provider evidence with H2H_SYNC and AUTHORITATIVE_EXACT, then update DISTRIBUTED succeeds
db.prepare(`
  INSERT INTO finance_qlola_provider_evidence (
    id, distribution_id, source, evidence_type, evidence_strength, provider_state,
    provider_reference, observed_at, raw_evidence_hash, recorded_by
  ) VALUES (
    'ev-1', 'dist-disp', 'H2H_SYNC', 'EXECUTION_SUCCESS', 'AUTHORITATIVE_EXACT', 'COMPLETED',
    'BANK-REF-100', datetime('now'), 'hash-ev-1', 'usr-1'
  );
`).run()

db.prepare("UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist-disp'").run()
console.log('✓ 8. Trigger trg_finance_dist_require_provider_evidence enforces authoritative bank evidence.')

// 9. Trigger: Prevent duplicate bank transaction reference across different distributions (collision conflict)
assert.throws(() => {
  db.prepare(`
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-dup', 'dist-1', 'H2H_SYNC', 'EXECUTION_SUCCESS', 'AUTHORITATIVE_EXACT', 'COMPLETED',
      'BANK-REF-100', datetime('now'), 'hash-ev-dup', 'usr-1'
    );
  `).run()
}, /COLLISION_CONFLICT: Nomor referensi eksekusi bank telah digunakan untuk distribusi lain/, 'Must reject collision of execution reference')
console.log('✓ 9. Trigger trg_finance_qlola_evidence_prevent_collision blocks execution reference collision across distributions.')

// 10. Append-Only Provider Evidence (UPDATE and DELETE blocked)
assert.throws(() => {
  db.prepare("UPDATE finance_qlola_provider_evidence SET provider_state = 'TAMPERED' WHERE id = 'ev-1'").run()
}, /Tabel finance_qlola_provider_evidence bersifat append-only. UPDATE dilarang/, 'Must reject UPDATE on provider evidence')

assert.throws(() => {
  db.prepare("DELETE FROM finance_qlola_provider_evidence WHERE id = 'ev-1'").run()
}, /Tabel finance_qlola_provider_evidence bersifat append-only. DELETE dilarang/, 'Must reject DELETE on provider evidence')
console.log('✓ 10. Trigger trg_finance_qlola_evidence_immutable enforces append-only provider evidence.')

// 11. Bank fee capture: NULL -> 0 allowed once, subsequent change blocked
db.prepare(`
  INSERT INTO finance_distributions (
    id, distribution_number, recipient_type, recipient_id,
    recipient_name, recipient_category, item_type, period, total_amount, method, status,
    bank_fee_amount, bank_fee_bearer
  ) VALUES (
    'dist-fee', 'DIS-20261008-0004', 'PESANTREN', 'rec_pesantren',
    'Pesantren Sukahideng', 'PESANTREN', 'SPP', '2026-10', 500000, 'BRI_QLOLA', 'DRAFT',
    NULL, NULL
  );
`).run()

// Without evidence, setting bank_fee_amount is blocked
assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET bank_fee_amount = 0 WHERE id = 'dist-fee'").run()
}, /Pencatatan fee bank wajib didasari bukti eksekusi penyedia yang sah/, 'Must reject setting fee without evidence')

// TEST_PROVIDER evidence does NOT satisfy fee guard
db.prepare(`
  INSERT INTO finance_qlola_provider_evidence (
    id, distribution_id, source, evidence_type, evidence_strength, provider_state,
    provider_reference, observed_at, raw_evidence_hash, recorded_by
  ) VALUES (
    'ev-fee-tp', 'dist-fee', 'TEST_PROVIDER', 'EXECUTION_SUCCESS', 'AUTHORITATIVE_EXACT', 'COMPLETED',
    'BANK-REF-FEE-TP', datetime('now'), 'hash-fee-tp', 'usr-1'
  );
`).run()
assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET bank_fee_amount = 0 WHERE id = 'dist-fee'").run()
}, /Pencatatan fee bank wajib didasari bukti eksekusi penyedia yang sah \(EXECUTION_SUCCESS non-TEST_PROVIDER\)/, 'TEST_PROVIDER must not satisfy fee guard')

// Insert eligible H2H_SYNC EXECUTION_SUCCESS evidence for dist-fee
db.prepare(`
  INSERT INTO finance_qlola_provider_evidence (
    id, distribution_id, source, evidence_type, evidence_strength, provider_state,
    provider_reference, observed_at, raw_evidence_hash, recorded_by
  ) VALUES (
    'ev-fee-1', 'dist-fee', 'H2H_SYNC', 'EXECUTION_SUCCESS', 'AUTHORITATIVE_EXACT', 'COMPLETED',
    'BANK-REF-FEE-001', datetime('now'), 'hash-fee-1', 'usr-1'
  );
`).run()

// Now NULL -> 0 is allowed once
db.prepare("UPDATE finance_distributions SET bank_fee_amount = 0, bank_fee_bearer = 'KOPERASI' WHERE id = 'dist-fee'").run()
const feeRow0 = db.prepare("SELECT bank_fee_amount FROM finance_distributions WHERE id = 'dist-fee'").get()
assert.strictEqual(feeRow0.bank_fee_amount, 0)

// Once set to 0, modifying 0 -> 1000 is strictly blocked
assert.throws(() => {
  db.prepare("UPDATE finance_distributions SET bank_fee_amount = 1000 WHERE id = 'dist-fee'").run()
}, /Nominal fee bank bersifat immutable setelah dicatat/, 'Must reject modifying fee after initial 0 capture')
console.log('✓ 11. Bank fee guard allows NULL -> 0 once with evidence, and strictly blocks subsequent modification.')

console.log('\n======================================================')
console.log('SUCCESS: ALL MIGRATION 0185 TESTS PASSED!')
console.log('======================================================')
