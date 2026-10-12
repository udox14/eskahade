// scripts/test-migration-0184.cjs
// Standalone migration 0184 verification test suite (BRI-4 Settlement & Recovery)

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const root = path.resolve(__dirname, '..')
const db = new DatabaseSync(':memory:')
db.exec('PRAGMA foreign_keys = ON;')

console.log('--- Setting up prerequisite schema for Migration 0184 ---')
db.exec(`
  CREATE TABLE santri (id TEXT PRIMARY KEY, nama TEXT);
  CREATE TABLE users (id TEXT PRIMARY KEY, full_name TEXT);
  CREATE TABLE finance_payment_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      santri_id TEXT NOT NULL REFERENCES santri(id),
      gross_amount INTEGER NOT NULL,
      cooperative_admin_fee INTEGER NOT NULL DEFAULT 0,
      total_charged INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      expires_at TEXT NOT NULL
  );
  CREATE TABLE finance_payments (
      id TEXT PRIMARY KEY,
      payment_number TEXT NOT NULL UNIQUE,
      order_id TEXT REFERENCES finance_payment_orders(id),
      santri_id TEXT NOT NULL REFERENCES santri(id),
      channel TEXT NOT NULL CHECK (channel IN ('BRI', 'CASH')),
      method TEXT NOT NULL,
      gross_amount INTEGER NOT NULL,
      cooperative_admin_fee INTEGER NOT NULL DEFAULT 0,
      bri_fee_amount INTEGER,
      net_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'SETTLED')),
      correction_status TEXT NOT NULL DEFAULT 'NONE',
      allocation_status TEXT NOT NULL DEFAULT 'ALLOCATED',
      paid_at TEXT NOT NULL,
      bri_payment_request_id TEXT,
      bri_trx_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE finance_reconciliation_items (
      id TEXT PRIMARY KEY,
      payment_id TEXT,
      settlement_id TEXT,
      cash_session_id TEXT,
      external_reference TEXT,
      internal_amount INTEGER,
      external_amount INTEGER,
      discrepancy_amount INTEGER,
      match_status TEXT,
      resolution_action TEXT,
      resolution_notes TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

console.log('Applying Migration 0184...')
const migSql = fs.readFileSync(path.join(root, 'migrations', '0184_bri_settlement_and_recovery.sql'), 'utf8')
db.exec(migSql)
console.log('Migration 0184 applied successfully!\n')

console.log('--- Running Migration 0184 Invariant Tests ---')

// Seed base records
db.prepare("INSERT INTO santri (id, nama) VALUES ('san-1', 'Ahmad'), ('san-2', 'Budi');").run()
db.prepare("INSERT INTO users (id, full_name) VALUES ('usr-1', 'Operator Keuangan');").run()
db.prepare(`
  INSERT INTO finance_payment_orders (id, order_number, santri_id, gross_amount, cooperative_admin_fee, total_charged, payment_method, status, expires_at)
  VALUES ('ord-1', 'ORD-001', 'san-1', 150000, 3000, 153000, 'BRI_VA', 'PAID', '2026-10-31T23:59:59Z');
`).run()
db.prepare(`
  INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at, bri_trx_id)
  VALUES ('pay-1', 'PAY-001', 'ord-1', 'san-1', 'BRI', 'BRI_VA', 150000, 3000, 150000, 'PAID', '2026-10-08T10:00:00Z', 'TRX-101');
`).run()

// 1. Insert Statement Fetch (Service code 14)
db.prepare(`
  INSERT INTO finance_bri_statement_fetches (
    id, fetch_reference_no, account_no, from_date_time, to_date_time,
    total_items_fetched, total_credits_count, total_credits_amount,
    total_debits_count, total_debits_amount, status, response_code, cursor_advanced, body_hash
  ) VALUES (
    'fetch-1', 'BS-20261008-001', '001901000123301', '2026-10-08T00:00:00+07:00', '2026-10-08T23:59:59+07:00',
    2, 1, 153000, 1, 50000, 'SUCCESS', '2001400', 1, 'mock_hash_1'
  );
`).run()

// 1b. Provider failure 4041401 fetch record (cursor_advanced = 0, status = 'FAILED')
db.prepare(`
  INSERT INTO finance_bri_statement_fetches (
    id, fetch_reference_no, account_no, from_date_time, to_date_time,
    total_items_fetched, total_credits_count, total_credits_amount,
    total_debits_count, total_debits_amount, status, response_code, cursor_advanced, body_hash
  ) VALUES (
    'fetch-err', 'BS-20261008-ERR', '001901000123301', '2026-10-08T00:00:00+07:00', '2026-10-08T23:59:59+07:00',
    0, 0, 0, 0, 0, 'FAILED', '4041401', 0, 'mock_hash_err'
  );
`).run()
const errFetch = db.prepare("SELECT status, cursor_advanced FROM finance_bri_statement_fetches WHERE id = 'fetch-err'").get()
assert.strictEqual(errFetch.status, 'FAILED')
assert.strictEqual(errFetch.cursor_advanced, 0)
console.log('✓ 1. Statement fetch record inserted successfully (2001400 advances cursor; 4041401 marked FAILED with cursor=0).')

// 2. Insert Statement Transactions (CREDIT and DEBIT, STRONG and WEAK identity)
db.prepare(`
  INSERT INTO finance_bri_statement_transactions (
    id, fetch_id, account_no, transaction_id, identity_strength, dedup_key, weak_fingerprint,
    transaction_date_raw, type_raw, type_normalized, amount, amount_raw, currency, remark, bri_trx_id,
    raw_evidence_hash, first_seen_at, last_seen_at, raw_json
  ) VALUES (
    'tx-cr-1', 'fetch-1', '001901000123301', 'TXN-101', 'STRONG', 'dedup_cr_1', NULL,
    '2026-10-08T10:05:00+07:00', 'Credit', 'CREDIT', 153000, '153000.00', 'IDR', 'BRIVA 1234500001001', 'TRX-101',
    'hash_cr_1', '2026-10-08T10:06:00Z', '2026-10-08T10:06:00Z', '{}'
  ), (
    'tx-db-1', 'fetch-1', '001901000123301', NULL, 'WEAK', 'dedup_db_1', 'fingerprint_db_1',
    '2026-10-08T11:00:00+07:00', 'Debit', 'DEBIT', 50000, '50000.00', 'IDR', 'BIAYA ADM', NULL,
    'hash_db_1', '2026-10-08T11:01:00Z', '2026-10-08T11:01:00Z', '{}'
  );
`).run()
console.log('✓ 2. Statement transactions (Credit & Debit, Strong & Weak identity) inserted successfully.')

// 3. STRONG Statement Dedup Key Uniqueness (enforced by uq_bri_stmt_tx_strong_dedup)
assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_bri_statement_transactions (
        id, fetch_id, account_no, transaction_id, identity_strength, dedup_key, weak_fingerprint,
        transaction_date_raw, type_raw, type_normalized, amount, amount_raw, currency,
        raw_evidence_hash, first_seen_at, last_seen_at, raw_json
      ) VALUES (
        'tx-cr-dup', 'fetch-1', '001901000123301', 'TXN-DUP', 'STRONG', 'dedup_cr_1', NULL,
        '2026-10-08T10:05:00+07:00', 'Credit', 'CREDIT', 153000, '153000.00', 'IDR',
        'hash_cr_dup', '2026-10-08T10:06:00Z', '2026-10-08T10:06:00Z', '{}'
      );
    `).run()
  },
  /UNIQUE constraint failed/,
  'Must enforce unique dedup_key for STRONG identity statement transactions'
)

// 3b. Non-destructive WEAK dedup: multiple identical weak rows MUST both be preserved!
db.prepare(`
  INSERT INTO finance_bri_statement_transactions (
    id, fetch_id, account_no, transaction_id, identity_strength, dedup_key, weak_fingerprint,
    transaction_date_raw, type_raw, type_normalized, amount, amount_raw, currency, remark,
    raw_evidence_hash, first_seen_at, last_seen_at, raw_json
  ) VALUES (
    'tx-weak-dup-1', 'fetch-1', '001901000123301', NULL, 'WEAK', 'weak_same_fp', 'weak_same_fp',
    '2026-10-08T10:00:00+07:00', 'Credit', 'CREDIT', 75000, '75000.00', 'IDR', 'SPP',
    'hash_w1', '2026-10-08T10:00:00Z', '2026-10-08T10:00:00Z', '{}'
  ), (
    'tx-weak-dup-2', 'fetch-1', '001901000123301', NULL, 'WEAK', 'weak_same_fp', 'weak_same_fp',
    '2026-10-08T10:00:00+07:00', 'Credit', 'CREDIT', 75000, '75000.00', 'IDR', 'SPP',
    'hash_w2', '2026-10-08T10:00:00Z', '2026-10-08T10:00:00Z', '{}'
  );
`).run()
const weakCount = db.prepare("SELECT COUNT(*) AS c FROM finance_bri_statement_transactions WHERE weak_fingerprint = 'weak_same_fp'").get().c
assert.strictEqual(weakCount, 2, 'Both duplicate weak rows must be preserved non-destructively!')
console.log('✓ 3. Dedup verified: STRONG identity enforces unique dedup; WEAK identity preserves multiple identical rows non-destructively.')

// 4. Guard 1: trg_finance_payments_prevent_invalid_settled blocks PAID -> SETTLED without settlement item evidence!
db.prepare(`
  INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at, bri_trx_id)
  VALUES ('pay-no-item-test', 'PAY-NO-ITEM-001', 'ord-1', 'san-1', 'BRI', 'BRI_VA', 10000, 0, 10000, 'PAID', '2026-10-08T10:00:00Z', 'TRX-NO-ITEM-1');
`).run()

assert.throws(
  () => {
    // Attempting direct update to SETTLED without settlement item
    db.prepare("UPDATE finance_payments SET status = 'SETTLED' WHERE id = 'pay-no-item-test';").run()
  },
  /SETTLEMENT_GUARD_ABORT: Payment cannot transition to SETTLED without valid Bank Statement settlement item evidence/,
  'Must abort when transitioning to SETTLED without valid settlement item evidence'
)
console.log('✓ 4. trg_finance_payments_prevent_invalid_settled blocks transitioning to SETTLED without settlement item evidence.')

// 5. Guard 2: trg_finance_bri_settlement_items_guard rejects DEBIT transaction
db.prepare(`
  INSERT INTO finance_bri_settlements (
    id, settlement_number, account_no, settlement_date,
    total_payments_count, total_gross_amount, total_cooperative_admin_fee, total_net_amount, status
  ) VALUES (
    'stl-1', 'STL-20261008-001', '001901000123301', '2026-10-08',
    1, 150000, 3000, 150000, 'COMPLETED'
  );
`).run()

assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_bri_settlement_items (
        id, settlement_id, payment_id, statement_transaction_id,
        gross_amount, cooperative_admin_fee, net_amount,
        match_strength, match_method, currency, settled_at
      ) VALUES (
        'stli-err-db', 'stl-1', 'pay-1', 'tx-db-1',
        150000, 3000, 150000,
        'AUTHORITATIVE_EXACT', 'CROSS_PRODUCT_EXACT', 'IDR', datetime('now')
      );
    `).run()
  },
  /SETTLEMENT_GUARD_ABORT: Statement transaction must be CREDIT IDR and amount must match total charged amount/,
  'Must reject settlement item referencing a DEBIT transaction'
)
console.log('✓ 5. trg_finance_bri_settlement_items_guard rejects DEBIT statement lines.')

// 6. Attempt to settle with amount mismatch
assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_bri_settlement_items (
        id, settlement_id, payment_id, statement_transaction_id,
        gross_amount, cooperative_admin_fee, net_amount,
        match_strength, match_method, currency, settled_at
      ) VALUES (
        'stli-err-amt', 'stl-1', 'pay-1', 'tx-cr-1',
        100000, 3000, 100000,
        'AUTHORITATIVE_EXACT', 'CROSS_PRODUCT_EXACT', 'IDR', datetime('now')
      );
    `).run()
  },
  /SETTLEMENT_GUARD_ABORT/,
  'Must reject settlement item when gross + fee does not match statement amount'
)
console.log('✓ 6. trg_finance_bri_settlement_items_guard rejects mismatched settlement item amounts.')

// 6b. Provenance Guard: reject CANDIDATE / AMBIGUOUS / NO_MATCH
assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_bri_settlement_items (
        id, settlement_id, payment_id, statement_transaction_id,
        gross_amount, cooperative_admin_fee, net_amount,
        match_strength, match_method, currency, settled_at
      ) VALUES (
        'stli-err-cand', 'stl-1', 'pay-1', 'tx-cr-1',
        150000, 3000, 150000,
        'CANDIDATE', 'VA_REGEX', 'IDR', datetime('now')
      );
    `).run()
  },
  /SETTLEMENT_GUARD_ABORT: match_strength must be strictly AUTHORITATIVE_EXACT or MANUAL_RESOLVED|CHECK constraint failed/,
  'Must reject CANDIDATE match strength at database level'
)
console.log('✓ 6b. trg_finance_bri_settlement_items_guard blocks CANDIDATE / AMBIGUOUS match strength.')

// 6c. Provenance Guard: MANUAL_RESOLVED requires full provenance audit fields
assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_bri_settlement_items (
        id, settlement_id, payment_id, statement_transaction_id,
        gross_amount, cooperative_admin_fee, net_amount,
        match_strength, match_method, currency, settled_at
      ) VALUES (
        'stli-err-man-audit', 'stl-1', 'pay-1', 'tx-cr-1',
        150000, 3000, 150000,
        'MANUAL_RESOLVED', 'OPERATOR_OVERRIDE', 'IDR', datetime('now')
      );
    `).run()
  },
  /SETTLEMENT_GUARD_ABORT: MANUAL_RESOLVED settlement requires reconciliation_item_id, resolved_by, resolved_at, and resolution_notes/,
  'Must reject MANUAL_RESOLVED without complete audit fields'
)
console.log('✓ 6c. trg_finance_bri_settlement_items_guard enforces audit fields on MANUAL_RESOLVED.')

// 6d. Currency Guard: reject non-IDR
assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_bri_settlement_items (
        id, settlement_id, payment_id, statement_transaction_id,
        gross_amount, cooperative_admin_fee, net_amount,
        match_strength, match_method, currency, settled_at
      ) VALUES (
        'stli-err-curr', 'stl-1', 'pay-1', 'tx-cr-1',
        150000, 3000, 150000,
        'AUTHORITATIVE_EXACT', 'CROSS_PRODUCT_EXACT', 'USD', datetime('now')
      );
    `).run()
  },
  /SETTLEMENT_GUARD_ABORT: Currency must strictly be IDR|CHECK constraint failed/,
  'Must reject non-IDR currency'
)
console.log('✓ 6d. trg_finance_bri_settlement_items_guard rejects non-IDR currency.')

// 6e. Account Binding Guard: reject settlement batch with different account_no
db.prepare(`
  INSERT INTO finance_bri_settlements (
    id, settlement_number, account_no, settlement_date,
    total_payments_count, total_gross_amount, total_cooperative_admin_fee, total_net_amount, status
  ) VALUES (
    'stl-diff-acc', 'STL-20261008-DIFF', '999901000999999', '2026-10-08',
    1, 150000, 3000, 150000, 'COMPLETED'
  );
`).run()

assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_bri_settlement_items (
        id, settlement_id, payment_id, statement_transaction_id,
        gross_amount, cooperative_admin_fee, net_amount,
        match_strength, match_method, currency, settled_at
      ) VALUES (
        'stli-err-acc', 'stl-diff-acc', 'pay-1', 'tx-cr-1',
        150000, 3000, 150000,
        'AUTHORITATIVE_EXACT', 'CROSS_PRODUCT_EXACT', 'IDR', datetime('now')
      );
    `).run()
  },
  /SETTLEMENT_GUARD_ABORT: Settlement batch account_no must match statement transaction account_no/,
  'Must reject settlement item when batch account_no does not match statement transaction account_no'
)
console.log('✓ 6e. trg_finance_bri_settlement_items_guard enforces collection account binding.')

// 7. Valid settlement insertion + transition to SETTLED (item inserted FIRST, then payment updated to SETTLED)
db.prepare(`
  INSERT INTO finance_bri_settlement_items (
    id, settlement_id, payment_id, statement_transaction_id,
    gross_amount, cooperative_admin_fee, net_amount,
    match_strength, match_method, currency, settled_at
  ) VALUES (
    'stli-1', 'stl-1', 'pay-1', 'tx-cr-1',
    150000, 3000, 150000,
    'AUTHORITATIVE_EXACT', 'CROSS_PRODUCT_EXACT', 'IDR', datetime('now')
  );
`).run()

db.prepare(`
  UPDATE finance_payments
  SET status = 'SETTLED'
  WHERE id = 'pay-1' AND status = 'PAID';
`).run()

db.prepare(`
  UPDATE finance_bri_statement_transactions
  SET match_status = 'MATCHED', matched_payment_id = 'pay-1'
  WHERE id = 'tx-cr-1';
`).run()

const updatedPayment = db.prepare("SELECT status FROM finance_payments WHERE id = 'pay-1'").get()
assert.strictEqual(updatedPayment.status, 'SETTLED')
console.log('✓ 7. Valid atomic settlement transition to SETTLED succeeded.')

// 8. Prevent settling same payment twice (unique constraint on payment_id)
assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_bri_settlement_items (
        id, settlement_id, payment_id, statement_transaction_id,
        gross_amount, cooperative_admin_fee, net_amount,
        match_strength, match_method, currency, settled_at
      ) VALUES (
        'stli-dup-pay', 'stl-1', 'pay-1', 'tx-cr-1',
        150000, 3000, 150000,
        'AUTHORITATIVE_EXACT', 'CROSS_PRODUCT_EXACT', 'IDR', datetime('now')
      );
    `).run()
  },
  /SETTLEMENT_GUARD_ABORT|UNIQUE constraint failed/,
  'Payment cannot be settled twice'
)
console.log('✓ 8. Settling payment twice is blocked (unique constraint on payment_id).')

// 9. Prevent statement transaction from settling a second payment (unique constraint on statement_transaction_id)
db.prepare(`
  INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at, bri_trx_id)
  VALUES ('pay-2', 'PAY-002', 'ord-1', 'san-1', 'BRI', 'BRI_VA', 150000, 3000, 150000, 'PAID', '2026-10-08T10:00:00Z', 'TRX-102');
`).run()

assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_bri_settlement_items (
        id, settlement_id, payment_id, statement_transaction_id,
        gross_amount, cooperative_admin_fee, net_amount,
        match_strength, match_method, currency, settled_at
      ) VALUES (
        'stli-dup-tx', 'stl-1', 'pay-2', 'tx-cr-1',
        150000, 3000, 150000,
        'AUTHORITATIVE_EXACT', 'CROSS_PRODUCT_EXACT', 'IDR', datetime('now')
      );
    `).run()
  },
  /UNIQUE constraint failed/,
  'Statement transaction cannot settle multiple payments'
)
console.log('✓ 9. 1-to-1 unique constraint prevents double-spending statement transaction.')

// 10. Guard 3: trg_finance_bri_statement_tx_prevent_double_match
assert.throws(
  () => {
    db.prepare(`
      UPDATE finance_bri_statement_transactions
      SET matched_payment_id = 'pay-2'
      WHERE id = 'tx-cr-1';
    `).run()
  },
  /SETTLEMENT_GUARD_ABORT: Statement transaction is already matched to another payment/,
  'Cannot overwrite matched_payment_id once matched'
)
console.log('✓ 10. trg_finance_bri_statement_tx_prevent_double_match blocks overriding matched_payment_id.')

// 11. Immutability Guards: raw statement evidence fields cannot be updated
assert.throws(
  () => {
    db.prepare("UPDATE finance_bri_statement_transactions SET amount = 999999 WHERE id = 'tx-cr-1';").run()
  },
  /STATEMENT_IMMUTABLE_ABORT: Raw bank statement financial evidence fields are strictly immutable/,
  'Raw statement financial fields must be immutable'
)

assert.throws(
  () => {
    db.prepare("UPDATE finance_bri_statement_transactions SET type_normalized = 'DEBIT' WHERE id = 'tx-cr-1';").run()
  },
  /STATEMENT_IMMUTABLE_ABORT: Raw bank statement financial evidence fields are strictly immutable/,
  'Raw statement type must be immutable'
)

assert.throws(
  () => {
    db.prepare("DELETE FROM finance_bri_statement_transactions WHERE id = 'tx-cr-1';").run()
  },
  /STATEMENT_IMMUTABLE_ABORT: Statement transactions cannot be deleted/,
  'Statement transactions cannot be deleted'
)
console.log('✓ 11. Statement transactions raw evidence immutability verified (UPDATE and DELETE blocked).')

// 12. Immutability Guards: settlement items cannot be updated or deleted
assert.throws(
  () => {
    db.prepare("UPDATE finance_bri_settlement_items SET gross_amount = 50000 WHERE id = 'stli-1';").run()
  },
  /SETTLEMENT_IMMUTABLE_ABORT: Settlement items are strictly immutable/,
  'Settlement items must be immutable'
)

assert.throws(
  () => {
    db.prepare("DELETE FROM finance_bri_settlement_items WHERE id = 'stli-1';").run()
  },
  /SETTLEMENT_IMMUTABLE_ABORT: Settlement items cannot be deleted/,
  'Settlement items cannot be deleted'
)
console.log('✓ 12. Settlement items immutability verified (UPDATE and DELETE blocked).')

// 13. Recovery Queue lifecycle states
db.prepare(`
  INSERT INTO finance_bri_recovery_queue (
    id, order_id, santri_id, virtual_account_no, bri_trx_id, expected_amount, recovery_status, reason
  ) VALUES (
    'rec-1', 'ord-1', 'san-1', '1234500001001', 'TRX-REC-1', 153000, 'OPEN', 'Callback timeout'
  );
`).run()

db.prepare(`
  UPDATE finance_bri_recovery_queue
  SET recovery_status = 'INQUIRY_PENDING', attempt_count = 1, last_attempt_at = datetime('now')
  WHERE id = 'rec-1';
`).run()

db.prepare(`
  UPDATE finance_bri_recovery_queue
  SET recovery_status = 'STATEMENT_MATCHED', statement_transaction_id = 'tx-cr-1', resolved_at = datetime('now')
  WHERE id = 'rec-1';
`).run()

const recRow = db.prepare("SELECT recovery_status, attempt_count FROM finance_bri_recovery_queue WHERE id = 'rec-1'").get()
assert.strictEqual(recRow.recovery_status, 'STATEMENT_MATCHED')
assert.strictEqual(recRow.attempt_count, 1)
console.log('✓ 13. Recovery queue lifecycle transitions verified.')

// 14. Reconciliation session creation
db.prepare(`
  INSERT INTO finance_bri_reconciliation_sessions (
    id, session_code, period, account_no, started_at, completed_at,
    fetched_count, matched_count, unmatched_count, ambiguous_count, discrepancy_amount, status, conducted_by
  ) VALUES (
    'ses-1', 'REC-202610-001', '2026-10', '001901000123301', '2026-10-08T12:00:00Z', '2026-10-08T12:05:00Z',
    2, 1, 0, 0, 0, 'BALANCED', 'usr-1'
  );
`).run()
const sesRow = db.prepare("SELECT status FROM finance_bri_reconciliation_sessions WHERE id = 'ses-1'").get()
assert.strictEqual(sesRow.status, 'BALANCED')
console.log('✓ 14. Reconciliation session created and marked BALANCED.')

console.log('\n======================================================')
console.log('SUCCESS: ALL MIGRATION 0184 TESTS PASSED!')
console.log('======================================================')
