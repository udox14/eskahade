// scripts/test-migration-0186.cjs
// Test Suite for Migration 0186: CASH & MANUAL DISTRIBUTION HARDENING

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const root = path.resolve(__dirname, '..')
const sqliteDb = new DatabaseSync(':memory:')
sqliteDb.exec('PRAGMA foreign_keys = ON;')

console.log('--- Setting up prerequisite schema for Migration 0186 ---')

sqliteDb.exec(`
  CREATE TABLE users (id TEXT PRIMARY KEY, full_name TEXT, role TEXT, username TEXT);
  CREATE TABLE master_jasa (id TEXT PRIMARY KEY, nama_jasa TEXT, jenis TEXT);
  CREATE TABLE santri (id TEXT PRIMARY KEY, nama TEXT);

  CREATE TABLE finance_cash_sessions (
      id TEXT PRIMARY KEY,
      session_code TEXT NOT NULL UNIQUE,
      operator_id TEXT NOT NULL REFERENCES users(id),
      opened_at TEXT NOT NULL,
      opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
      total_cash_in INTEGER NOT NULL DEFAULT 0 CHECK (total_cash_in >= 0),
      total_cash_out INTEGER NOT NULL DEFAULT 0 CHECK (total_cash_out >= 0),
      expected_closing_balance INTEGER NOT NULL DEFAULT 0 CHECK (expected_closing_balance >= 0),
      actual_closing_balance INTEGER,
      difference INTEGER,
      difference_notes TEXT,
      closed_at TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

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

  CREATE TABLE finance_bri_statement_fetches (
      id TEXT PRIMARY KEY,
      fetch_reference_no TEXT NOT NULL UNIQUE,
      account_no TEXT NOT NULL,
      from_date_time TEXT NOT NULL,
      to_date_time TEXT NOT NULL,
      total_items_fetched INTEGER NOT NULL DEFAULT 0,
      total_credits_count INTEGER NOT NULL DEFAULT 0,
      total_credits_amount INTEGER NOT NULL DEFAULT 0,
      total_debits_count INTEGER NOT NULL DEFAULT 0,
      total_debits_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'SUCCESS',
      body_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE finance_bri_statement_transactions (
      id TEXT PRIMARY KEY,
      fetch_id TEXT NOT NULL REFERENCES finance_bri_statement_fetches(id),
      account_no TEXT NOT NULL,
      transaction_id TEXT,
      identity_strength TEXT NOT NULL DEFAULT 'WEAK' CHECK (identity_strength IN ('STRONG', 'WEAK')),
      dedup_key TEXT NOT NULL,
      weak_fingerprint TEXT,
      transaction_date_raw TEXT NOT NULL,
      transaction_date_utc TEXT,
      type_raw TEXT NOT NULL,
      type_normalized TEXT NOT NULL CHECK (type_normalized IN ('CREDIT', 'DEBIT')),
      amount INTEGER NOT NULL CHECK (amount >= 0),
      amount_raw TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IDR',
      remark TEXT,
      remark_custom TEXT,
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

  CREATE TABLE finance_reconciliation_items (
      id TEXT PRIMARY KEY,
      reconciliation_id TEXT,
      payment_id TEXT,
      settlement_id TEXT,
      cash_session_id TEXT,
      external_reference TEXT,
      internal_amount INTEGER NOT NULL DEFAULT 0,
      external_amount INTEGER NOT NULL DEFAULT 0,
      discrepancy_amount INTEGER NOT NULL DEFAULT 0,
      match_status TEXT NOT NULL,
      resolution_action TEXT NOT NULL DEFAULT 'NONE',
      resolution_notes TEXT,
      resolved_by TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Seed users & recipients
sqliteDb.exec(`
  INSERT INTO users (id, full_name, role, username) VALUES
  ('usr-admin', 'Admin Finance', 'admin', 'admin_fin'),
  ('usr-bendahara', 'Bendahara', 'bendahara', 'bendahara'),
  ('usr-petugas', 'Petugas Kasir', 'petugas_koperasi', 'petugas'),
  ('usr-tester', 'Tester Read Only', 'tester', 'tester');

  INSERT INTO finance_distribution_recipients (id, recipient_type, name, is_active, allowed_methods)
  VALUES ('rec_pesantren', 'PESANTREN', 'Pesantren Sukahideng', 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER');

  INSERT INTO finance_recipient_allowed_methods (recipient_id, method) VALUES
  ('rec_pesantren', 'BRI_QLOLA'),
  ('rec_pesantren', 'CASH'),
  ('rec_pesantren', 'MANUAL_TRANSFER');

  INSERT INTO finance_recipient_accounts (id, recipient_id, bank_code, account_number, account_holder, is_primary, is_active)
  VALUES ('acc-1', 'rec_pesantren', '002', '001901000999301', 'Yayasan Pesantren', 1, 1);
`)

// Apply Migration 0185
console.log('Applying Migration 0185...')
const m0185 = fs.readFileSync(path.join(root, 'migrations', '0185_bri_qlola_distribution.sql'), 'utf8')
sqliteDb.exec(m0185)
console.log('Migration 0185 applied successfully!')

// Apply Migration 0186
console.log('Applying Migration 0186...')
const m0186 = fs.readFileSync(path.join(root, 'migrations', '0186_cash_manual_distribution_hardening.sql'), 'utf8')
sqliteDb.exec(m0186)
console.log('Migration 0186 applied successfully!')

console.log('\n--- Running Migration 0186 Invariant Tests ---')

// Test 1: Snapshot and tracking columns persisted on finance_distributions
const distColumns = sqliteDb.prepare("PRAGMA table_info(finance_distributions)").all()
const columnNames = distColumns.map(c => c.name)
assert(columnNames.includes('cash_session_id'), 'Column cash_session_id must exist')
assert(columnNames.includes('cash_prepared_at'), 'Column cash_prepared_at must exist')
assert(columnNames.includes('cash_handed_over_at'), 'Column cash_handed_over_at must exist')
assert(columnNames.includes('cash_receiver_name'), 'Column cash_receiver_name must exist')
assert(columnNames.includes('cash_returned_at'), 'Column cash_returned_at must exist')
assert(columnNames.includes('cash_return_reason'), 'Column cash_return_reason must exist')
assert(columnNames.includes('source_account_id'), 'Column source_account_id must exist')
assert(columnNames.includes('source_account_number'), 'Column source_account_number must exist')
assert(columnNames.includes('source_bank_code'), 'Column source_bank_code must exist')
assert(columnNames.includes('source_account_holder'), 'Column source_account_holder must exist')
assert(columnNames.includes('manual_transfer_initiated_at'), 'Column manual_transfer_initiated_at must exist')
assert(columnNames.includes('manual_transfer_executed_at'), 'Column manual_transfer_executed_at must exist')
assert(columnNames.includes('statement_transaction_id'), 'Column statement_transaction_id must exist')
console.log('✓ 1. Snapshot and tracking columns on finance_distributions verified.')

const reconColumns = sqliteDb.prepare("PRAGMA table_info(finance_reconciliation_items)").all()
const reconColNames = reconColumns.map(c => c.name)
assert(reconColNames.includes('reason_code'), 'Column reason_code must exist on finance_reconciliation_items')
assert(reconColNames.includes('investigation_resolution'), 'Column investigation_resolution must exist on finance_reconciliation_items')
console.log('✓ 1b. Investigation semantic columns on finance_reconciliation_items verified.')

// Test 2: finance_cash_manual_evidence exists and enforces append-only triggers
sqliteDb.exec(`
  INSERT INTO finance_distributions (
    id, distribution_number, recipient_type, recipient_id, item_type,
    period, total_amount, method, status, currency
  ) VALUES (
    'dist-mig-1', 'DIS-MIG-001', 'PESANTREN', 'rec_pesantren', 'SPP',
    '2026-10', 100000, 'CASH', 'DRAFT', 'IDR'
  );
`)

sqliteDb.exec(`
  INSERT INTO finance_cash_manual_evidence (
    id, distribution_id, evidence_type, evidence_strength, source,
    reference_number, raw_evidence_hash, observed_at, recorded_at,
    operator_id, operator_role_snapshot, created_at
  ) VALUES (
    'ev-1', 'dist-mig-1', 'CASH_PREPARED', 'AUTHORITATIVE_EXACT', 'CASH_DESK',
    'SES-001', 'hash1', '2026-10-09T00:00:00Z', '2026-10-09T00:00:00Z',
    'usr-petugas', 'petugas_koperasi', '2026-10-09T00:00:00Z'
  );
`)

assert.throws(() => {
  sqliteDb.exec(`UPDATE finance_cash_manual_evidence SET reference_number = 'TAMPERED' WHERE id = 'ev-1';`)
}, /append-only.*UPDATE dilarang/i)
console.log('✓ 2. Trigger trg_finance_cash_manual_evidence_immutable_update blocks UPDATE.')

assert.throws(() => {
  sqliteDb.exec(`DELETE FROM finance_cash_manual_evidence WHERE id = 'ev-1';`)
}, /append-only.*DELETE dilarang/i)
console.log('✓ 3. Trigger trg_finance_cash_manual_evidence_immutable_delete blocks DELETE.')

// Test 4: Operator and role validation for MANUAL_OFFICIAL_PROOF
assert.throws(() => {
  sqliteDb.exec(`
    INSERT INTO finance_cash_manual_evidence (
      id, distribution_id, evidence_type, evidence_strength, source,
      reference_number, raw_evidence_hash, observed_at, recorded_at,
      operator_id, operator_role_snapshot, created_at
    ) VALUES (
      'ev-spoofed-user', 'dist-mig-1', 'MANUAL_OFFICIAL_PROOF', 'AUTHORITATIVE_EXACT', 'MANUAL_OFFICIAL_PROOF',
      'REF-1', 'hash2', '2026-10-09T00:00:00Z', '2026-10-09T00:00:00Z',
      'usr-non-existent', 'admin', '2026-10-09T00:00:00Z'
    );
  `)
}, /operator_id tidak valid/i)
console.log('✓ 4. Non-existent operator rejected on evidence insert.')

assert.throws(() => {
  sqliteDb.exec(`
    INSERT INTO finance_cash_manual_evidence (
      id, distribution_id, evidence_type, evidence_strength, source,
      reference_number, raw_evidence_hash, observed_at, recorded_at,
      operator_id, operator_role_snapshot, created_at
    ) VALUES (
      'ev-unauth-role', 'dist-mig-1', 'MANUAL_OFFICIAL_PROOF', 'AUTHORITATIVE_EXACT', 'MANUAL_OFFICIAL_PROOF',
      'REF-1', 'hash3', '2026-10-09T00:00:00Z', '2026-10-09T00:00:00Z',
      'usr-petugas', 'petugas_koperasi', '2026-10-09T00:00:00Z'
    );
  `)
}, /Hanya role admin atau bendahara yang berwenang/i)
console.log('✓ 5. Non-admin/bendahara role rejected for MANUAL_OFFICIAL_PROOF.')

// Test 6: Inactive recipient blocked
sqliteDb.exec(`
  INSERT INTO finance_distribution_recipients (
    id, recipient_type, name, is_active, allowed_methods
  ) VALUES ('rec-inactive', 'PESANTREN', 'Inactive Recipient', 0, 'CASH,MANUAL_TRANSFER');
`)

assert.throws(() => {
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, item_type,
      period, total_amount, method, status, currency
    ) VALUES (
      'dist-mig-inact', 'DIS-MIG-INACT', 'PESANTREN', 'rec-inactive', 'SPP',
      '2026-10', 50000, 'CASH', 'DRAFT', 'IDR'
    );
  `)
}, /Penerima tidak aktif/i)
console.log('✓ 6. Inactive recipient blocked from new distribution creation.')

// Test 7: CASH State Machine: DRAFT -> DISTRIBUTED without handover evidence blocked
assert.throws(() => {
  sqliteDb.exec(`UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist-mig-1';`)
}, /Penyaluran CASH dari DRAFT hanya boleh beralih ke PROCESSING/i)
console.log('✓ 7. Direct DRAFT -> DISTRIBUTED for CASH blocked by state machine trigger.')

// DRAFT -> PROCESSING allowed
sqliteDb.exec(`UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist-mig-1';`)

// PROCESSING -> DISTRIBUTED without CASH_HANDOVER_RECEIPT blocked
assert.throws(() => {
  sqliteDb.exec(`UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist-mig-1';`)
}, /Peralihan status ke DISTRIBUTED untuk CASH wajib memiliki bukti serah terima/i)
console.log('✓ 8. CASH PROCESSING -> DISTRIBUTED without handover evidence blocked.')

// Provide CASH_HANDOVER_RECEIPT evidence
sqliteDb.exec(`
  INSERT INTO finance_cash_manual_evidence (
    id, distribution_id, evidence_type, evidence_strength, source,
    reference_number, raw_evidence_hash, observed_at, recorded_at,
    operator_id, operator_role_snapshot, receiving_person_name, created_at
  ) VALUES (
    'ev-handover', 'dist-mig-1', 'CASH_HANDOVER_RECEIPT', 'AUTHORITATIVE_EXACT', 'PHYSICAL_RECEIPT',
    'RCP-001', 'hash-rcp', '2026-10-09T00:00:00Z', '2026-10-09T00:00:00Z',
    'usr-petugas', 'petugas_koperasi', 'Ust. Ahmad', '2026-10-09T00:00:00Z'
  );
`)

// Now PROCESSING -> DISTRIBUTED succeeds!
sqliteDb.exec(`UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist-mig-1';`)
const finalDist = sqliteDb.prepare(`SELECT status FROM finance_distributions WHERE id = 'dist-mig-1'`).get()
assert.strictEqual(finalDist.status, 'DISTRIBUTED')
console.log('✓ 9. CASH PROCESSING -> DISTRIBUTED succeeds with authoritative handover receipt.')

// Test 10: DISTRIBUTED status immutability
assert.throws(() => {
  sqliteDb.exec(`UPDATE finance_distributions SET status = 'CANCELLED' WHERE id = 'dist-mig-1';`)
}, /Pembatalan dilarang.*Penyaluran tunai telah diserahkan \(DISTRIBUTED\)|Distribusi tunai yang telah DISTRIBUTED bersifat final/i)
console.log('✓ 10. CASH DISTRIBUTED status is immutable.')

// Test 11: Collision detection for receipt / reference
sqliteDb.exec(`
  INSERT INTO finance_distributions (
    id, distribution_number, recipient_type, recipient_id, item_type,
    period, total_amount, method, status, currency
  ) VALUES (
    'dist-mig-2', 'DIS-MIG-002', 'PESANTREN', 'rec_pesantren', 'SPP',
    '2026-10', 100000, 'CASH', 'DRAFT', 'IDR'
  );
`)

assert.throws(() => {
  sqliteDb.exec(`
    INSERT INTO finance_cash_manual_evidence (
      id, distribution_id, evidence_type, evidence_strength, source,
      reference_number, raw_evidence_hash, observed_at, recorded_at,
      operator_id, operator_role_snapshot, receiving_person_name, created_at
    ) VALUES (
      'ev-coll', 'dist-mig-2', 'CASH_HANDOVER_RECEIPT', 'AUTHORITATIVE_EXACT', 'PHYSICAL_RECEIPT',
      'RCP-001', 'hash-coll', '2026-10-09T00:00:00Z', '2026-10-09T00:00:00Z',
      'usr-petugas', 'petugas_koperasi', 'Ust. Ahmad', '2026-10-09T00:00:00Z'
    );
  `)
}, /COLLISION_CONFLICT/i)
console.log('✓ 11. Duplicate reference collision detected and blocked by trigger.')

// Test 12: DB Guard - Cash Session Over-Reservation Blocked (trg_finance_dist_enforce_cash_session_balance)
sqliteDb.exec(`
  INSERT INTO finance_cash_sessions (
    id, session_code, operator_id, opened_at, opening_balance,
    expected_closing_balance, status
  ) VALUES (
    'sess-mig-1', 'CS-MIG-001', 'usr-petugas', '2026-10-09T08:00:00Z', 1000000,
    1000000, 'OPEN'
  );

  INSERT INTO finance_distributions (
    id, distribution_number, recipient_type, recipient_id, item_type,
    period, total_amount, method, status, cash_session_id, currency
  ) VALUES (
    'dist-mig-sess-a', 'DIS-MIG-SESS-A', 'PESANTREN', 'rec_pesantren', 'SPP',
    '2026-10', 700000, 'CASH', 'DRAFT', 'sess-mig-1', 'IDR'
  ), (
    'dist-mig-sess-b', 'DIS-MIG-SESS-B', 'PESANTREN', 'rec_pesantren', 'SPP',
    '2026-10', 400000, 'CASH', 'DRAFT', 'sess-mig-1', 'IDR'
  );
`)

// A prepares 700,000 -> succeeds
sqliteDb.exec(`UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist-mig-sess-a';`)
console.log('✓ 12a. First distribution A (700,000) enters PROCESSING on 1,000,000 session.')

// B tries to prepare 400,000 (700k + 400k = 1.1M > 1.0M) -> DB trigger BLOCKS it!
assert.throws(() => {
  sqliteDb.exec(`UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist-mig-sess-b';`)
}, /Saldo kas fisik pada sesi loket tidak mencukupi untuk menyiapkan penyaluran tunai/i)
console.log('✓ 12b. DB trigger trg_finance_dist_enforce_cash_session_balance blocks concurrent over-reservation (400k on remaining 300k).')

// Test 13: DB Guard - Cash Session cannot close with live reservations (trg_finance_cash_session_prevent_close_with_live_reservations)
assert.throws(() => {
  sqliteDb.exec(`UPDATE finance_cash_sessions SET status = 'CLOSED' WHERE id = 'sess-mig-1';`)
}, /masih terdapat penyaluran kas fisik berstatus PROCESSING/i)
console.log('✓ 13a. DB trigger trg_finance_cash_session_prevent_close_with_live_reservations blocks closing session with active PROCESSING distribution.')

// When A is cancelled, session close succeeds!
sqliteDb.exec(`
  INSERT INTO finance_cash_manual_evidence (
    id, distribution_id, evidence_type, evidence_strength, source,
    reference_number, raw_evidence_hash, observed_at, recorded_at,
    operator_id, operator_role_snapshot, notes, created_at
  ) VALUES (
    'ev-cancel-a', 'dist-mig-sess-a', 'CASH_RETURNED', 'AUTHORITATIVE_EXACT', 'CASH_DESK',
    'sess-mig-1', 'hash-cancel-a', '2026-10-09T08:30:00Z', '2026-10-09T08:30:00Z',
    'usr-petugas', 'petugas_koperasi', 'Dibatalkan', '2026-10-09T08:30:00Z'
  );

  UPDATE finance_distributions SET status = 'CANCELLED' WHERE id = 'dist-mig-sess-a';
  UPDATE finance_cash_sessions SET status = 'CLOSED' WHERE id = 'sess-mig-1';
`)
const closedSess = sqliteDb.prepare(`SELECT status FROM finance_cash_sessions WHERE id = 'sess-mig-1'`).get()
assert.strictEqual(closedSess.status, 'CLOSED')
console.log('✓ 13b. Sesi kas berhasil ditutup setelah reservasi kas selesai/dibatalkan.')

// Test 14: Statement transaction double consumption guard
sqliteDb.exec(`
  INSERT INTO finance_bri_statement_fetches (
    id, fetch_reference_no, account_no, from_date_time, to_date_time, body_hash
  ) VALUES (
    'fetch-mig-1', 'FETCH-MIG-001', '001201000123301', '2026-10-09T00:00:00Z', '2026-10-09T23:59:59Z', 'hash-fetch-1'
  );

  INSERT INTO finance_bri_statement_transactions (
    id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
    transaction_date_raw, type_raw, type_normalized, amount, amount_raw, currency
  ) VALUES (
    'stmt-tx-mig-1', 'fetch-mig-1', '001201000123301', 'BRI-STMT-TX-001', 'STRONG', 'dedup-1',
    '2026-10-09', 'D', 'DEBIT', 500000, '500000.00', 'IDR'
  );

  INSERT INTO finance_distributions (
    id, distribution_number, recipient_type, recipient_id, item_type,
    period, total_amount, method, status, currency
  ) VALUES (
    'dist-stmt-a', 'DIS-STMT-A', 'PESANTREN', 'rec_pesantren', 'SPP',
    '2026-10', 500000, 'MANUAL_TRANSFER', 'PROCESSING', 'IDR'
  ), (
    'dist-stmt-b', 'DIS-STMT-B', 'PESANTREN', 'rec_pesantren', 'SPP',
    '2026-10', 500000, 'MANUAL_TRANSFER', 'PROCESSING', 'IDR'
  );
`)

// First distribution consumes statement transaction -> succeeds
sqliteDb.exec(`
  INSERT INTO finance_cash_manual_evidence (
    id, distribution_id, evidence_type, evidence_strength, source,
    reference_number, raw_evidence_hash, observed_at, recorded_at,
    operator_id, operator_role_snapshot, created_at
  ) VALUES (
    'ev-stmt-a', 'dist-stmt-a', 'BANK_STATEMENT_DEBIT', 'MANUAL_RESOLVED', 'BANK_STATEMENT',
    'BRI-STMT-TX-001', 'hash-stmt-a', '2026-10-09T00:00:00Z', '2026-10-09T00:00:00Z',
    'usr-bendahara', 'bendahara', '2026-10-09T00:00:00Z'
  );

  UPDATE finance_distributions
  SET status = 'DISTRIBUTED', statement_transaction_id = 'stmt-tx-mig-1'
  WHERE id = 'dist-stmt-a';
`)
const distA = sqliteDb.prepare(`SELECT status, statement_transaction_id FROM finance_distributions WHERE id = 'dist-stmt-a'`).get()
assert.strictEqual(distA.status, 'DISTRIBUTED')
assert.strictEqual(distA.statement_transaction_id, 'stmt-tx-mig-1')
console.log('✓ 14a. Distribution A successfully consumes bank statement transaction.')

// Second distribution attempts to consume the SAME statement transaction -> blocked by DB trigger / unique index!
assert.throws(() => {
  sqliteDb.exec(`
    INSERT INTO finance_cash_manual_evidence (
      id, distribution_id, evidence_type, evidence_strength, source,
      reference_number, raw_evidence_hash, observed_at, recorded_at,
      operator_id, operator_role_snapshot, created_at
    ) VALUES (
      'ev-stmt-b', 'dist-stmt-b', 'BANK_STATEMENT_DEBIT', 'MANUAL_RESOLVED', 'BANK_STATEMENT',
      'BRI-STMT-TX-001-ALT', 'hash-stmt-b', '2026-10-09T00:00:00Z', '2026-10-09T00:00:00Z',
      'usr-bendahara', 'bendahara', '2026-10-09T00:00:00Z'
    );

    UPDATE finance_distributions
    SET status = 'DISTRIBUTED', statement_transaction_id = 'stmt-tx-mig-1'
    WHERE id = 'dist-stmt-b';
  `)
}, /STMT_TRANSACTION_ALREADY_CONSUMED|UNIQUE constraint failed: finance_distributions\.statement_transaction_id/i)
console.log('✓ 14b. DB guard strictly blocks second distribution from consuming the same statement transaction.')

// Test 15: statement_transaction_id is immutable after being set
assert.throws(() => {
  sqliteDb.exec(`
    UPDATE finance_distributions
    SET statement_transaction_id = 'stmt-tx-tampered'
    WHERE id = 'dist-stmt-a';
  `)
}, /Field finansial instruksi penyaluran bersifat immutable/i)
console.log('✓ 15. statement_transaction_id on finance_distributions is immutable after being set.')

// Test 16: Collision detection for BANK_STATEMENT_DEBIT reference number
assert.throws(() => {
  sqliteDb.exec(`
    INSERT INTO finance_cash_manual_evidence (
      id, distribution_id, evidence_type, evidence_strength, source,
      reference_number, raw_evidence_hash, observed_at, recorded_at,
      operator_id, operator_role_snapshot, created_at
    ) VALUES (
      'ev-stmt-dup', 'dist-stmt-b', 'BANK_STATEMENT_DEBIT', 'MANUAL_RESOLVED', 'BANK_STATEMENT',
      'BRI-STMT-TX-001', 'hash-stmt-dup', '2026-10-09T00:00:00Z', '2026-10-09T00:00:00Z',
      'usr-bendahara', 'bendahara', '2026-10-09T00:00:00Z'
    );
  `)
}, /COLLISION_CONFLICT/i)
console.log('✓ 16. Collision trigger blocks duplicate reference_number for BANK_STATEMENT_DEBIT across distributions.')

console.log('\n======================================================')
console.log('SUCCESS: ALL MIGRATION 0186 TESTS PASSED!')
console.log('======================================================')
