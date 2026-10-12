// scripts/test-migration-0183.cjs
// Standalone migration 0183 verification test suite

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const root = path.resolve(__dirname, '..')
const db = new DatabaseSync(':memory:')
db.exec('PRAGMA foreign_keys = ON;')

console.log('--- Setting up prerequisite schema for Migration 0183 ---')
db.exec(`
  CREATE TABLE santri (id TEXT PRIMARY KEY, nama TEXT);
  CREATE TABLE users (id TEXT PRIMARY KEY);
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
      channel TEXT NOT NULL,
      method TEXT NOT NULL,
      gross_amount INTEGER NOT NULL,
      cooperative_admin_fee INTEGER NOT NULL DEFAULT 0,
      bri_fee_amount INTEGER,
      net_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PAID',
      correction_status TEXT NOT NULL DEFAULT 'NONE',
      allocation_status TEXT NOT NULL DEFAULT 'ALLOCATED',
      paid_at TEXT NOT NULL,
      bri_payment_request_id TEXT,
      bri_trx_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

console.log('Applying Migration 0183...')
const migSql = fs.readFileSync(path.join(root, 'migrations', '0183_briva_collection_metadata.sql'), 'utf8')
db.exec(migSql)
console.log('Migration 0183 applied successfully!\n')

console.log('--- Running Migration 0183 Invariant Tests ---')

// Seed base records
db.prepare("INSERT INTO santri (id, nama) VALUES ('san-1', 'Ahmad'), ('san-2', 'Budi');").run()
db.prepare(`
  INSERT INTO finance_payment_orders (id, order_number, santri_id, gross_amount, cooperative_admin_fee, total_charged, payment_method, status, expires_at)
  VALUES
    ('ord-1', 'ORD-001', 'san-1', 100000, 3000, 103000, 'BRI_VA', 'PENDING', '2026-10-31T23:59:59Z'),
    ('ord-cancelled', 'ORD-002', 'san-1', 100000, 3000, 103000, 'BRI_VA', 'CANCELLED', '2026-10-31T23:59:59Z');
`).run()

// Test 1: Guard blocks payment when target order is CANCELLED (CASH race)
assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at)
      VALUES ('pay-err-1', 'PAY-ERR-001', 'ord-cancelled', 'san-1', 'BRI', 'BRI_VA', 100000, 3000, 100000, 'PAID', datetime('now'));
    `).run()
  },
  /BRIVA_GUARD_ABORT/,
  'Must block payment on CANCELLED order'
)
console.log('✓ 1. trg_finance_payments_briva_guard blocks payment on CANCELLED order.')

// Test 2: Guard blocks payment on student mismatch
assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at)
      VALUES ('pay-err-2', 'PAY-ERR-002', 'ord-1', 'san-2', 'BRI', 'BRI_VA', 100000, 3000, 100000, 'PAID', datetime('now'));
    `).run()
  },
  /BRIVA_GUARD_ABORT/,
  'Must block payment on student mismatch'
)
console.log('✓ 2. trg_finance_payments_briva_guard blocks payment on student mismatch.')

// Test 3: Guard blocks payment on total_charged mismatch
assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at)
      VALUES ('pay-err-3', 'PAY-ERR-003', 'ord-1', 'san-1', 'BRI', 'BRI_VA', 90000, 3000, 90000, 'PAID', datetime('now'));
    `).run()
  },
  /BRIVA_GUARD_ABORT/,
  'Must block payment on amount mismatch'
)
console.log('✓ 3. trg_finance_payments_briva_guard blocks payment on total amount mismatch.')

// Test 4: Guard allows valid payment on active PENDING order
db.prepare(`
  INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at)
  VALUES ('pay-ok-1', 'PAY-OK-001', 'ord-1', 'san-1', 'BRI', 'BRI_VA', 100000, 3000, 100000, 'PAID', datetime('now'));
`).run()
console.log('✓ 4. trg_finance_payments_briva_guard allows valid payment on PENDING order.')

// Test 5: Guard blocks duplicate payment for the same order
assert.throws(
  () => {
    db.prepare(`
      INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at)
      VALUES ('pay-err-dup', 'PAY-ERR-DUP', 'ord-1', 'san-1', 'BRI', 'BRI_VA', 100000, 3000, 100000, 'PAID', datetime('now'));
    `).run()
  },
  /BRIVA_GUARD_ABORT: Payment already materialized for this order/,
  'Must block duplicate payment on same order'
)
console.log('✓ 5. trg_finance_payments_briva_guard blocks second payment on already materialized order.')

// Test 6: Order transition guard blocks transitioning CANCELLED order to PAID
assert.throws(
  () => {
    db.prepare("UPDATE finance_payment_orders SET status = 'PAID' WHERE id = 'ord-cancelled'").run()
  },
  /BRIVA_GUARD_ABORT: Cannot transition order to PAID when it is not in PENDING state/,
  'Must block transition of CANCELLED order to PAID'
)
console.log('✓ 6. trg_finance_orders_prevent_paid_if_not_pending blocks invalid transition to PAID.')

// Test 7: Inquiry evidence and reconciliation metadata tables exist
db.prepare(`
  INSERT INTO finance_briva_inquiries (id, inquiry_request_id, partner_service_id, customer_no, virtual_account_no, santri_id, order_id, total_amount, expires_at)
  VALUES ('inq-1', 'INQ-REQ-001', '   12345', '00001001', '1234500001001', 'san-1', 'ord-1', 103000, '2026-10-31T23:59:59Z');
`).run()
const inqCheck = db.prepare("SELECT inquiry_request_id FROM finance_briva_inquiries WHERE id = 'inq-1'").get()
assert.strictEqual(inqCheck.inquiry_request_id, 'INQ-REQ-001')
console.log('✓ 7. finance_briva_inquiries stores inquiry correlation evidence.')

db.prepare(`
  INSERT INTO finance_briva_reconciliation_metadata (id, payment_id, order_id, virtual_account_no, partner_service_id, customer_no, paid_amount, payment_request_id, body_hash)
  VALUES ('rec-1', 'pay-ok-1', 'ord-1', '1234500001001', '   12345', '00001001', 103000, 'INQ-REQ-001', 'hash123');
`).run()
const recCheck = db.prepare("SELECT paid_amount FROM finance_briva_reconciliation_metadata WHERE id = 'rec-1'").get()
assert.strictEqual(recCheck.paid_amount, 103000)
console.log('✓ 8. finance_briva_reconciliation_metadata stores durable evidence for BRI-4.')

console.log('\n======================================================')
console.log('SUCCESS: ALL MIGRATION 0183 INVARIANT TESTS PASSED!')
console.log('======================================================')
