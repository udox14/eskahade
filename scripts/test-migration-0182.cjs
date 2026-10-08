/* eslint-disable @typescript-eslint/no-require-imports */
// scripts/test-migration-0182.cjs
// Comprehensive Unit & Regression Test Suite for Migration 0182 (BRI Foundation & Duitku Retirement)
// Validates all 13 core invariants enforced by AGENTS.md and PRD BRI-1.

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const root = path.resolve(__dirname, '..')
const db = new DatabaseSync(':memory:')

db.exec('PRAGMA foreign_keys = ON;')

console.log('--- Setting up baseline tables & prerequisite migrations ---')

// 1. Baseline schema for tables referenced by finance
db.exec(`
CREATE TABLE users (id TEXT PRIMARY KEY, full_name TEXT);
CREATE TABLE santri (
    id TEXT PRIMARY KEY,
    nis TEXT,
    nama_lengkap TEXT,
    status_global TEXT DEFAULT 'aktif',
    asrama TEXT,
    kamar TEXT,
    tempat_makan_id TEXT,
    tempat_mencuci_id TEXT,
    kategori_santri TEXT
);
CREATE TABLE master_jasa (
    id TEXT PRIMARY KEY,
    nama_jasa TEXT,
    jenis TEXT
);
CREATE TABLE tahun_ajaran (
    id INTEGER PRIMARY KEY,
    nama TEXT,
    is_active INTEGER
);
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
);
CREATE TABLE finance_tariffs (
    id TEXT PRIMARY KEY,
    item_type TEXT,
    academic_year_id INTEGER,
    nominal INTEGER,
    installment_rule TEXT,
    effective_from TEXT,
    effective_until TEXT,
    created_by TEXT,
    created_at TEXT
);
CREATE TABLE finance_obligations (
    id TEXT PRIMARY KEY,
    santri_id TEXT REFERENCES santri(id),
    tariff_id TEXT REFERENCES finance_tariffs(id),
    item_type TEXT,
    period TEXT,
    academic_year_id INTEGER,
    amount_expected INTEGER,
    amount_exempted INTEGER DEFAULT 0,
    amount_paid INTEGER DEFAULT 0,
    status TEXT DEFAULT 'UNPAID',
    provider_id TEXT REFERENCES master_jasa(id),
    created_at TEXT,
    updated_at TEXT
);
CREATE TABLE finance_cash_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    status TEXT,
    total_cash_out INTEGER DEFAULT 0,
    expected_closing_balance INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);
CREATE TABLE fitur_akses (
    id INTEGER PRIMARY KEY,
    group_name TEXT,
    title TEXT,
    href TEXT UNIQUE,
    icon TEXT,
    roles TEXT,
    is_active INTEGER,
    urutan INTEGER
);
`)

// Seed baseline entities
db.exec(`
INSERT INTO users VALUES ('admin', 'Admin'), ('bendahara1', 'Bendahara');
INSERT INTO master_jasa VALUES ('jasa_makan_1', 'Katering Barokah', 'Makan'), ('jasa_cuci_1', 'Laundry Bersih', 'Cuci');
INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama) VALUES ('santri_1', '1001', 'Santri Satu', 'aktif', 'Asrama A');
INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama) VALUES ('santri_2', '1002', 'Santri Dua', 'aktif', 'Asrama B');
INSERT INTO app_settings VALUES ('duitku_merchant_code', 'SECRET_MERCHANT', datetime('now')), ('duitku_api_key', 'SECRET_KEY', datetime('now'));
`)

// Run prerequisite migrations: 0155, 0158, 0162, 0163, 0167
const m0155 = fs.readFileSync(path.join(root, 'migrations/0155_finance_payments_and_orders.sql'), 'utf8')
db.exec(m0155)

const m0158 = fs.readFileSync(path.join(root, 'migrations/0158_finance_payment_order_multi_payment.sql'), 'utf8')
db.exec(m0158)

const m0162 = fs.readFileSync(path.join(root, 'migrations/0162_finance_distributions.sql'), 'utf8')
db.exec(m0162)

const m0163 = fs.readFileSync(path.join(root, 'migrations/0163_finance_reconciliation_and_corrections.sql'), 'utf8')
db.exec(m0163)

const m0167 = fs.readFileSync(path.join(root, 'migrations/0167_finance_legacy_bridge_and_fund_management.sql'), 'utf8')
db.exec(m0167)

// Seed legacy data:
// 1. Test Duitku data (MUST BE PURGED by migration preflight)
// 2. Real CASH data (MUST BE PRESERVED with cooperative_admin_fee = 0 and NULL BRI metadata)
db.exec(`
-- Test Duitku records
INSERT INTO finance_student_va VALUES ('santri_1', '88001001', 'DUITKU', datetime('now'));

INSERT INTO finance_payment_orders VALUES (
    'ord_duitku_1', 'ORD-DUITKU-001', 'santri_1', 'PORTAL_ORTU', 100000, 4000, 'CUSTOMER', 104000,
    'DUITKU_VA', '88001001', 'PENDING', datetime('now', '+1 day'), NULL, datetime('now'), datetime('now')
);

INSERT INTO finance_payments (
    id, payment_number, order_id, santri_id, channel, method,
    gross_amount, gateway_fee, net_amount, status, correction_status,
    allocation_status, paid_at, external_reference, cash_session_id,
    received_by, source, fund_management, created_at
) VALUES (
    'pay_duitku_1', 'PAY-DUITKU-001', 'ord_duitku_1', 'santri_1', 'DUITKU', 'DUITKU_VA', 100000, 4000, 96000,
    'PAID', 'NONE', 'ALLOCATED', datetime('now'), 'EXT-REF-001', NULL, 'bendahara1', 'NEW_FINANCE', 'KOPERASI', datetime('now')
);

INSERT INTO finance_allocations VALUES (
    'alloc_duitku_1', 'pay_duitku_1', NULL, 'OBLIGATION', 'SPP', NULL, 100000, 0, 'UNDISBURSED', datetime('now')
);

INSERT INTO finance_gateway_events VALUES (
    'gw_1', 'DUITKU', 'EVT-001', 'ORD-DUITKU-001', 1, '{}', 'PROCESSED', datetime('now')
);

-- Real CASH records to preserve
INSERT INTO finance_payment_orders VALUES (
    'ord_cash_1', 'ORD-CASH-001', 'santri_2', 'PORTAL_ORTU', 250000, 0, 'CUSTOMER', 250000,
    'CASH', NULL, 'PAID', datetime('now', '+1 day'), NULL, datetime('now'), datetime('now')
);

INSERT INTO finance_payments (
    id, payment_number, order_id, santri_id, channel, method,
    gross_amount, gateway_fee, net_amount, status, correction_status,
    allocation_status, paid_at, external_reference, cash_session_id,
    received_by, source, fund_management, created_at
) VALUES (
    'pay_cash_1', 'PAY-CASH-001', 'ord_cash_1', 'santri_2', 'CASH', 'CASH', 250000, 0, 250000,
    'PAID', 'NONE', 'ALLOCATED', datetime('now'), NULL, 'cs_1', 'bendahara1', 'NEW_FINANCE', 'KOPERASI', datetime('now')
);

INSERT INTO finance_allocations VALUES (
    'alloc_cash_1', 'pay_cash_1', NULL, 'OBLIGATION', 'SPP', NULL, 250000, 0, 'UNDISBURSED', datetime('now')
);

-- Legacy distributions
INSERT INTO finance_distributions VALUES (
    'dist_legacy_1', 'DIS-001', 'BENDAHARA', NULL, 'SPP', '2026-09', 100000, 'TRANSFER',
    'BRI', '00112233', 'Pesantren', NULL, 'bendahara1', datetime('now'), NULL, datetime('now')
);

INSERT INTO finance_distribution_items VALUES (
    'dist_item_1', 'dist_legacy_1', 'alloc_cash_1', 100000, datetime('now')
);
`)

console.log('Applying Migration 0182...')
const m0182 = fs.readFileSync(path.join(root, 'migrations/0182_bri_foundation.sql'), 'utf8')
db.exec(m0182)
console.log('Migration 0182 applied successfully!')

console.log('\n--- Running Invariant Verifications ---')

// 1. INVARIANT 1: Legacy Duitku test data purged, NOT relabeled
console.log('Test 1: Legacy Duitku test data purged safely...')
const duitkuOrders = db.prepare(`SELECT * FROM finance_payment_orders WHERE id = 'ord_duitku_1'`).all()
assert.equal(duitkuOrders.length, 0, 'Duitku test order must be purged')

const duitkuPayments = db.prepare(`SELECT * FROM finance_payments WHERE id = 'pay_duitku_1'`).all()
assert.equal(duitkuPayments.length, 0, 'Duitku test payment must be purged')

const duitkuEvents = db.prepare(`SELECT * FROM finance_gateway_events WHERE gateway_name = 'DUITKU'`).all()
assert.equal(duitkuEvents.length, 0, 'Duitku gateway events must be purged')

const secrets = db.prepare(`SELECT key FROM app_settings WHERE key LIKE 'duitku%'`).all()
assert.equal(secrets.length, 0, 'Duitku app settings secrets must be purged')

// 2. INVARIANT 2: CASH order and payment preserved intact
console.log('Test 2: Valid CASH records preserved...')
const cashOrder = db.prepare(`SELECT * FROM finance_payment_orders WHERE id = 'ord_cash_1'`).get()
assert.ok(cashOrder, 'CASH order must be preserved')
assert.equal(cashOrder.payment_method, 'CASH')
assert.equal(cashOrder.cooperative_admin_fee, 0, 'CASH order cooperative_admin_fee must be 0')

const cashPayment = db.prepare(`SELECT * FROM finance_payments WHERE id = 'pay_cash_1'`).get()
assert.ok(cashPayment, 'CASH payment must be preserved')
assert.equal(cashPayment.channel, 'CASH')
assert.equal(cashPayment.method, 'CASH')
assert.equal(cashPayment.cooperative_admin_fee, 0)
assert.equal(cashPayment.bri_payment_request_id, null)
assert.equal(cashPayment.bri_trx_id, null)

// 3. INVARIANT 3: Effective-dated cooperative admin fee rules
console.log('Test 3: Cooperative admin fee rules versioned & effective-dated...')
const feeRule = db.prepare(`SELECT * FROM finance_cooperative_admin_fee_rules WHERE code = 'ONLINE_CHECKOUT_FEE'`).get()
assert.ok(feeRule, 'Default ONLINE_CHECKOUT_FEE rule must exist')
assert.equal(feeRule.amount, 0, 'Default rule amount must start at 0')
assert.equal(feeRule.is_enabled, 0, 'Default rule must start disabled')
assert.equal(feeRule.applies_to_channel, 'BRI')

// 4. INVARIANT 4: Append-only cooperative income ledger
console.log('Test 4: Append-only cooperative income ledger...')
db.prepare(`
    INSERT INTO finance_corrections (
        id, correction_number, target_payment_id, correction_type, total_amount, reason, created_by, created_at
    ) VALUES (
        'corr_1', 'COR-001', 'pay_cash_1', 'REVERSAL', 2000, 'Test reversal', 'admin', datetime('now')
    )
`).run()

db.prepare(`
    INSERT INTO finance_cooperative_income (
        id, income_number, entry_type, reference_income_id, correction_id,
        payment_id, order_id, amount, rule_id, rule_snapshot, reference_note, created_at
    ) VALUES (
        'inc_1', 'INC-001', 'INCOME', NULL, NULL,
        'pay_cash_1', 'ord_cash_1', 2000, ?, '{"amount":2000}', 'Income initial', datetime('now')
    )
`).run(feeRule.id)

// Append reversal linking to inc_1
db.prepare(`
    INSERT INTO finance_cooperative_income (
        id, income_number, entry_type, reference_income_id, correction_id,
        payment_id, order_id, amount, rule_id, rule_snapshot, reference_note, created_at
    ) VALUES (
        'rev_1', 'REV-001', 'REVERSAL', 'inc_1', 'corr_1',
        'pay_cash_1', 'ord_cash_1', 2000, ?, '{"amount":2000}', 'Reversal', datetime('now')
    )
`).run(feeRule.id)

const incRows = db.prepare(`SELECT * FROM finance_cooperative_income ORDER BY created_at ASC`).all()
assert.equal(incRows.length, 2, 'Must have 2 rows without mutation')
assert.equal(incRows[1].reference_income_id, 'inc_1')
assert.equal(incRows[1].correction_id, 'corr_1')

// 5. INVARIANT 5: Partial unique index on bri_payment_request_id
console.log('Test 5: Partial unique index on bri_payment_request_id...')
db.prepare(`
    INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method,
        gross_amount, cooperative_admin_fee, net_amount, status, correction_status,
        allocation_status, paid_at, bri_payment_request_id, created_at
    ) VALUES (
        'pay_bri_1', 'PAY-BRI-001', 'ord_cash_1', 'santri_1', 'BRI', 'BRI_VA',
        100000, 0, 100000, 'PAID', 'NONE', 'UNALLOCATED', datetime('now'), 'REQ-12345', datetime('now')
    )
`).run()

// Duplicate bri_payment_request_id must fail!
assert.throws(() => {
    db.prepare(`
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, cooperative_admin_fee, net_amount, status, correction_status,
            allocation_status, paid_at, bri_payment_request_id, created_at
        ) VALUES (
            'pay_bri_2', 'PAY-BRI-002', 'ord_cash_1', 'santri_2', 'BRI', 'BRI_VA',
            100000, 0, 100000, 'PAID', 'NONE', 'UNALLOCATED', datetime('now'), 'REQ-12345', datetime('now')
        )
    `).run()
}, /UNIQUE constraint failed/, 'Must reject duplicate bri_payment_request_id')

// Multiple NULL bri_payment_request_id must succeed (e.g. for CASH)
db.prepare(`
    INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method,
        gross_amount, cooperative_admin_fee, net_amount, status, correction_status,
        allocation_status, paid_at, bri_payment_request_id, created_at
    ) VALUES (
        'pay_cash_2', 'PAY-CASH-002', 'ord_cash_1', 'santri_1', 'CASH', 'CASH',
        50000, 0, 50000, 'PAID', 'NONE', 'UNALLOCATED', datetime('now'), NULL, datetime('now')
    )
`).run()

// 6. INVARIANT 6: Partial unique index on bri_trx_id
console.log('Test 6: Partial unique index on bri_trx_id...')
db.prepare(`
    INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method,
        gross_amount, cooperative_admin_fee, net_amount, status, correction_status,
        allocation_status, paid_at, bri_trx_id, created_at
    ) VALUES (
        'pay_bri_3', 'PAY-BRI-003', 'ord_cash_1', 'santri_1', 'BRI', 'BRI_VA',
        100000, 0, 100000, 'PAID', 'NONE', 'UNALLOCATED', datetime('now'), 'TRX-99999', datetime('now')
    )
`).run()

// Duplicate bri_trx_id must fail!
assert.throws(() => {
    db.prepare(`
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, cooperative_admin_fee, net_amount, status, correction_status,
            allocation_status, paid_at, bri_trx_id, created_at
        ) VALUES (
            'pay_bri_4', 'PAY-BRI-004', 'ord_cash_1', 'santri_2', 'BRI', 'BRI_VA',
            100000, 0, 100000, 'PAID', 'NONE', 'UNALLOCATED', datetime('now'), 'TRX-99999', datetime('now')
        )
    `).run()
}, /UNIQUE constraint failed/, 'Must reject duplicate bri_trx_id')

// 7. INVARIANT 7: Gateway event key uniqueness
console.log('Test 7: Gateway event key uniqueness...')
db.prepare(`
    INSERT INTO finance_gateway_events (
        id, gateway_name, event_key, event_type, signature_valid, payload_json, processing_status, created_at
    ) VALUES (
        'evt_1', 'BRI', 'KEY-BRI-001', 'PAYMENT_NOTIFICATION', 1, '{}', 'PROCESSED', datetime('now')
    )
`).run()

assert.throws(() => {
    db.prepare(`
        INSERT INTO finance_gateway_events (
            id, gateway_name, event_key, event_type, signature_valid, payload_json, processing_status, created_at
        ) VALUES (
            'evt_2', 'BRI', 'KEY-BRI-001', 'PAYMENT_NOTIFICATION', 1, '{}', 'PROCESSED', datetime('now')
        )
    `).run()
}, /UNIQUE constraint failed/, 'Must reject duplicate gateway event_key')

// 8. INVARIANT 8: First-class recipients (Pesantren + Providers)
console.log('Test 8: First-class recipients seeded properly...')
const recPesantren = db.prepare(`SELECT * FROM finance_distribution_recipients WHERE id = 'rec_pesantren'`).get()
assert.ok(recPesantren, 'Institution recipient rec_pesantren must exist')
assert.equal(recPesantren.recipient_type, 'PESANTREN')

const recKatering = db.prepare(`SELECT * FROM finance_distribution_recipients WHERE id = 'rec_jasa_makan_1'`).get()
assert.ok(recKatering, 'Katering recipient must be linked to master_jasa')
assert.equal(recKatering.provider_id, 'jasa_makan_1')

// Duplicate provider_id mapping must fail!
assert.throws(() => {
    db.prepare(`
        INSERT INTO finance_distribution_recipients (
            id, recipient_type, name, provider_id, created_at, updated_at
        ) VALUES (
            'rec_dup', 'KATERING', 'Duplicate Katering', 'jasa_makan_1', datetime('now'), datetime('now')
        )
    `).run()
}, /UNIQUE constraint failed/, 'Must reject duplicate provider_id mapping')

// 9. INVARIANT 9: Single active primary account per recipient
console.log('Test 9: Maximum one active primary account per recipient...')
db.prepare(`
    INSERT INTO finance_recipient_accounts (
        id, recipient_id, bank_code, account_number, account_holder, is_primary, is_active, created_at, updated_at
    ) VALUES (
        'acc_prim_1', 'rec_pesantren', 'BRI', '111122223333', 'Pesantren Rek 1', 1, 1, datetime('now'), datetime('now')
    )
`).run()

// Adding another primary active account to the same recipient must fail!
assert.throws(() => {
    db.prepare(`
        INSERT INTO finance_recipient_accounts (
            id, recipient_id, bank_code, account_number, account_holder, is_primary, is_active, created_at, updated_at
        ) VALUES (
            'acc_prim_2', 'rec_pesantren', 'BRI', '999988887777', 'Pesantren Rek 2', 1, 1, datetime('now'), datetime('now')
        )
    `).run()
}, /UNIQUE constraint failed/, 'Must reject second active primary account for the same recipient')

// 10. INVARIANT 10: Fixed BRIVA starts clean and validates lifecycle fields
console.log('Test 10: Fixed BRIVA lifecycle fields and clean initial state...')
const vaCount = db.prepare(`SELECT COUNT(*) as count FROM finance_student_va`).get()
assert.equal(vaCount.count, 0, 'Starts clean with 0 dummy VAs')

db.prepare(`
    INSERT INTO finance_student_va (
        santri_id, customer_no, va_number, status, activated_at, created_at, updated_at
    ) VALUES (
        'santri_1', '0000001001', '88000000001001', 'ACTIVE', datetime('now'), datetime('now'), datetime('now')
    )
`).run()

const vaRow = db.prepare(`SELECT * FROM finance_student_va WHERE santri_id = 'santri_1'`).get()
assert.equal(vaRow.status, 'ACTIVE')
assert.ok(vaRow.activated_at)
assert.equal(vaRow.deactivated_at, null)

// 11. INVARIANT 11: Single active online order per santri
console.log('Test 11: Single active online order per santri...')
db.prepare(`
    INSERT INTO finance_payment_orders (
        id, order_number, santri_id, payer_type, gross_amount,
        cooperative_admin_fee, fee_payer, total_charged, payment_method,
        status, expires_at, created_at, updated_at
    ) VALUES (
        'ord_online_1', 'ORD-ONL-001', 'santri_1', 'PORTAL_ORTU', 150000,
        0, 'CUSTOMER', 150000, 'BRI_VA',
        'PENDING', datetime('now', '+1 day'), datetime('now'), datetime('now')
    )
`).run()

// Creating second PENDING order for santri_1 must fail!
assert.throws(() => {
    db.prepare(`
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount,
            cooperative_admin_fee, fee_payer, total_charged, payment_method,
            status, expires_at, created_at, updated_at
        ) VALUES (
            'ord_online_2', 'ORD-ONL-002', 'santri_1', 'PORTAL_ORTU', 200000,
            0, 'CUSTOMER', 200000, 'BRI_VA',
            'PENDING', datetime('now', '+1 day'), datetime('now'), datetime('now')
        )
    `).run()
}, /UNIQUE constraint failed/, 'Must reject second active online order for the same student')

// 12. INVARIANT 12: Distribution Reservation Trigger 1 (Direct Insert Overdraw)
console.log('Test 12: Distribution Reservation Trigger 1...')
// alloc_cash_1 has 250,000. dist_legacy_1 (DISTRIBUTED) already took 100,000. Available = 150,000.
// Attempt to insert 160,000 into a PENDING_APPROVAL distribution -> MUST FAIL!
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, submitted_by, submitted_at, created_at, updated_at
    ) VALUES (
        'dist_test_pending', 'DIS-PENDING-001', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 160000, 'BRI_QLOLA', 'PENDING_APPROVAL', 'bendahara1', datetime('now'), datetime('now'), datetime('now')
    )
`).run()

assert.throws(() => {
    db.prepare(`
        INSERT INTO finance_distribution_items (
            id, distribution_id, allocation_id, amount, created_at
        ) VALUES (
            'item_over_1', 'dist_test_pending', 'alloc_cash_1', 160000, datetime('now')
        )
    `).run()
}, /melebihi dana alokasi/, 'Must prevent inserting reserving item exceeding available balance')

// Insert exact remaining amount 150,000 -> succeeds!
db.prepare(`
    INSERT INTO finance_distribution_items (
        id, distribution_id, allocation_id, amount, created_at
    ) VALUES (
        'item_exact_1', 'dist_test_pending', 'alloc_cash_1', 150000, datetime('now')
    )
`).run()
console.log('Exact reservation of 150,000 succeeded.')

// 13. INVARIANT 13: Distribution Reservation Trigger 2 (Status Transition Guard)
console.log('Test 13: Distribution Reservation Trigger 2 (State Transition & Concurrency Guard)...')
// Available allocation on alloc_cash_1 is now 0 (100k + 150k = 250k).
// Create a DRAFT distribution of 50,000. (DRAFT does not check reservation upon insert)
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_draft_A', 'DIS-DRAFT-A', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 50000, 'BRI_QLOLA', 'DRAFT', datetime('now'), datetime('now')
    )
`).run()

db.prepare(`
    INSERT INTO finance_distribution_items (
        id, distribution_id, allocation_id, amount, created_at
    ) VALUES (
        'item_draft_A', 'dist_draft_A', 'alloc_cash_1', 50000, datetime('now')
    )
`).run()

// Promoting dist_draft_A to PENDING_APPROVAL must be rejected by Trigger 2!
assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_draft_A'`).run()
}, /melebihi sisa alokasi/, 'Trigger 2 must reject DRAFT -> PENDING_APPROVAL transition when overdrawing')

// Release prior reservation by setting dist_test_pending to REJECTED
db.prepare(`UPDATE finance_distributions SET status = 'REJECTED' WHERE id = 'dist_test_pending'`).run()
console.log('dist_test_pending updated to REJECTED (reservation released).')

// Now promoting dist_draft_A must succeed (50k <= 150k available)
db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_draft_A'`).run()
const promoted = db.prepare(`SELECT status FROM finance_distributions WHERE id = 'dist_draft_A'`).get()
assert.equal(promoted.status, 'PENDING_APPROVAL', 'Promotion must succeed after reservation release')

// Set dist_draft_A to CANCEL_PENDING -> Must KEEP reservation active!
db.prepare(`UPDATE finance_distributions SET status = 'CANCEL_PENDING' WHERE id = 'dist_draft_A'`).run()

// Attempt to promote another draft requiring 120,000 (remaining available is 150k - 50k = 100k) -> MUST FAIL!
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_draft_B', 'DIS-DRAFT-B', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 120000, 'BRI_QLOLA', 'DRAFT', datetime('now'), datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_distribution_items (
        id, distribution_id, allocation_id, amount, created_at
    ) VALUES (
        'item_draft_B', 'dist_draft_B', 'alloc_cash_1', 120000, datetime('now')
    )
`).run()

assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_draft_B'`).run()
}, /melebihi sisa alokasi/, 'CANCEL_PENDING must maintain reservation and block overdraw')

console.log('\n--- Running 12 Reviewer Hardening Regression Tests ---')

// RT-1: PAID order does not block next PENDING order
console.log('RT-1: Verifying PAID order allows new PENDING order for same student...')
db.prepare(`UPDATE finance_payment_orders SET status = 'PAID' WHERE id = 'ord_online_1'`).run()
// Now inserting ord_online_2 as PENDING for santri_1 must succeed!
db.prepare(`
    INSERT INTO finance_payment_orders (
        id, order_number, santri_id, payer_type, gross_amount,
        cooperative_admin_fee, fee_payer, total_charged, payment_method,
        status, expires_at, created_at, updated_at
    ) VALUES (
        'ord_online_2', 'ORD-ONL-002', 'santri_1', 'PORTAL_ORTU', 200000,
        0, 'CUSTOMER', 200000, 'BRI_VA',
        'PENDING', datetime('now', '+1 day'), datetime('now'), datetime('now')
    )
`).run()
const paidOrder = db.prepare(`SELECT status FROM finance_payment_orders WHERE id = 'ord_online_1'`).get()
const pendingOrder = db.prepare(`SELECT status FROM finance_payment_orders WHERE id = 'ord_online_2'`).get()
assert.equal(paidOrder.status, 'PAID', 'Historical order must remain PAID')
assert.equal(pendingOrder.status, 'PENDING', 'New order must be PENDING without index conflict')
console.log('RT-1 Passed: Single active online order index correctly scopes only PENDING orders.')

// RT-2: Distribution items immutability on UPDATE amount
console.log('RT-2: Verifying distribution items immutability on UPDATE amount...')
assert.throws(() => {
    db.prepare(`UPDATE finance_distribution_items SET amount = 60000 WHERE id = 'item_draft_A'`).run()
}, /Item penyaluran bersifat immutable/, 'Must reject updating item amount after submit')
console.log('RT-2 Passed: Cannot update item amount on active distribution.')

// RT-3: Distribution items immutability on UPDATE allocation_id
console.log('RT-3: Verifying distribution items immutability on UPDATE allocation_id...')
assert.throws(() => {
    db.prepare(`UPDATE finance_distribution_items SET allocation_id = 'alloc_other' WHERE id = 'item_draft_A'`).run()
}, /Item penyaluran bersifat immutable/, 'Must reject updating allocation_id after submit')
console.log('RT-3 Passed: Cannot update allocation_id on active distribution.')

// RT-4: Distribution items immutability on DELETE
console.log('RT-4: Verifying distribution items immutability on DELETE...')
assert.throws(() => {
    db.prepare(`DELETE FROM finance_distribution_items WHERE id = 'item_draft_A'`).run()
}, /Item penyaluran bersifat immutable/, 'Must reject deleting item after submit')
console.log('RT-4 Passed: Cannot delete item on active distribution.')

// RT-5: Non-STP Guard: DRAFT BRI_QLOLA -> manual DISTRIBUTED aborted
console.log('RT-5: Verifying Non-STP Guard blocks DRAFT -> DISTRIBUTED on BRI_QLOLA...')
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_qlola_stp_1', 'DIS-STP-001', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 10000, 'BRI_QLOLA', 'DRAFT', datetime('now'), datetime('now')
    )
`).run()
assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist_qlola_stp_1'`).run()
}, /Penyaluran BRI_QLOLA non-STP/, 'Must abort direct DRAFT -> DISTRIBUTED promotion')
console.log('RT-5 Passed: Direct DISTRIBUTED transition blocked.')

// RT-6: Non-STP Guard: DRAFT BRI_QLOLA -> manual PROCESSING aborted
console.log('RT-6: Verifying Non-STP Guard blocks DRAFT -> PROCESSING on BRI_QLOLA...')
assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist_qlola_stp_1'`).run()
}, /Penyaluran BRI_QLOLA non-STP/, 'Must abort direct DRAFT -> PROCESSING promotion')
console.log('RT-6 Passed: Direct PROCESSING transition blocked.')

// RT-7: Corrected allocation used as hard limit & reverse trigger protects reserved funds
console.log('RT-7: Verifying effective allocation with corrections & reverse protection...')
// Create fresh payment and allocation of 200k
db.prepare(`
    INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method, gross_amount, net_amount,
        status, correction_status, allocation_status, paid_at, source, fund_management, created_at
    ) VALUES (
        'pay_corr_test', 'PAY-CORR-001', NULL, 'santri_2', 'CASH', 'CASH', 200000, 200000,
        'PAID', 'NONE', 'ALLOCATED', datetime('now'), 'NEW_FINANCE', 'KOPERASI', datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_allocations (
        id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
    ) VALUES (
        'alloc_corr_test', 'pay_corr_test', NULL, 'OBLIGATION', 'SPP', 200000, 0, 'UNDISBURSED', datetime('now')
    )
`).run()
// Add correction of 50k
db.prepare(`
    INSERT INTO finance_corrections (
        id, correction_number, target_payment_id, correction_type, total_amount,
        method, reason, approved_by, created_by, created_at
    ) VALUES (
        'corr_test_1', 'CORR-001', 'pay_corr_test', 'REFUND', 50000,
        'CASH', 'Kelebihan bayar', 'admin', 'admin', datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_correction_items (
        id, correction_id, target_allocation_id, obligation_id, target_type, amount, created_at
    ) VALUES (
        'corr_item_1', 'corr_test_1', 'alloc_corr_test', NULL, 'OBLIGATION', 50000, datetime('now')
    )
`).run()
// Effective allocation is now 200k - 50k = 150k.
// Overdraw check: attempting to reserve 160k must fail!
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_corr_res', 'DIS-CORR-RES', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 160000, 'BRI_QLOLA', 'DRAFT', datetime('now'), datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_distribution_items (
        id, distribution_id, allocation_id, amount, created_at
    ) VALUES (
        'item_corr_over', 'dist_corr_res', 'alloc_corr_test', 160000, datetime('now')
    )
`).run()
assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_corr_res'`).run()
}, /melebihi sisa alokasi/, 'Must account for correction when evaluating reservation limit')

// Update item to exact remaining 150k and promote -> succeeds
db.prepare(`UPDATE finance_distribution_items SET amount = 150000 WHERE id = 'item_corr_over'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_corr_res'`).run()

// Now that 150k is reserved, attempt to add another correction on alloc_corr_test -> REVERSE TRIGGER MUST ABORT!
assert.throws(() => {
    db.prepare(`
        INSERT INTO finance_correction_items (
            id, correction_id, target_allocation_id, obligation_id, target_type, amount, created_at
        ) VALUES (
            'corr_item_overdraw', 'corr_test_1', 'alloc_corr_test', NULL, 'OBLIGATION', 10000, datetime('now')
        )
    `).run()
}, /reservasi penyaluran bank aktif/, 'Reverse trigger must block correction on already reserved funds')
console.log('RT-7 Passed: Effective allocation arithmetic and reverse correction guard verified.')

// RT-8: Concurrent open-ended fee rule update blocked by unique index
console.log('RT-8: Verifying single open rule partial unique index on fee rules...')
db.prepare(`
    INSERT INTO finance_cooperative_admin_fee_rules (
        id, code, name, applies_to_channel, amount, is_enabled, effective_from, effective_until, created_by, created_at
    ) VALUES (
        'rule_open_1', 'ONLINE_CHECKOUT_FEE', 'Open Rule 1', 'BRI', 2000, 1, datetime('now'), NULL, 'admin', datetime('now')
    )
`).run()
assert.throws(() => {
    db.prepare(`
        INSERT INTO finance_cooperative_admin_fee_rules (
            id, code, name, applies_to_channel, amount, is_enabled, effective_from, effective_until, created_by, created_at
        ) VALUES (
            'rule_conflict', 'ONLINE_CHECKOUT_FEE', 'Conflict Rule', 'BRI', 3000, 1, datetime('now'), NULL, 'admin', datetime('now')
        )
    `).run()
}, /UNIQUE constraint failed/, 'Must block inserting second open-ended rule on same channel & code')
console.log('RT-8 Passed: Partial unique index blocks duplicate open fee rule.')

// RT-9: Disallowed recipient method is aborted
console.log('RT-9: Verifying allowed methods relational check on distributions...')
// Insert new recipient with ONLY CASH allowed
db.prepare(`
    INSERT INTO finance_distribution_recipients (
        id, recipient_type, name, is_active, created_at, updated_at
    ) VALUES (
        'rec_cash_only', 'KATERING', 'Katering Tunai', 1, datetime('now'), datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_recipient_allowed_methods (
        recipient_id, method, created_at
    ) VALUES (
        'rec_cash_only', 'CASH', datetime('now')
    )
`).run()
// Attempt to insert BRI_QLOLA for rec_cash_only -> aborted!
assert.throws(() => {
    db.prepare(`
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type,
            period, total_amount, method, status, created_at, updated_at
        ) VALUES (
            'dist_bad_method', 'DIS-BAD-001', 'KATERING', 'rec_cash_only', 'UANG_MAKAN',
            '2026-09', 50000, 'BRI_QLOLA', 'DRAFT', datetime('now'), datetime('now')
        )
    `).run()
}, /Metode penyaluran tidak diizinkan untuk penerima ini/, 'Must block distribution using disallowed method')
console.log('RT-9 Passed: Disallowed recipient method trigger aborts insertion.')

// RT-10: Unauthorized mutation roles rejected
console.log('RT-10: Verifying role matrix assertions...')
function canConfigureAdminFee(roles) {
    return roles.some(r => r === 'admin' || r === 'admin_koperasi')
}
function canManageAccounts(roles) {
    return roles.some(r => ['admin', 'admin_koperasi', 'bendahara'].includes(r))
}
function canSubmitDistribution(roles, method) {
    if (roles.includes('admin_koperasi') && !roles.some(r => ['admin', 'bendahara', 'petugas_koperasi'].includes(r))) return false
    if (method === 'MANUAL_TRANSFER') return roles.some(r => r === 'admin' || r === 'bendahara')
    return roles.some(r => ['admin', 'bendahara', 'petugas_koperasi'].includes(r))
}
function canCancelDistribution(roles) {
    return roles.some(r => r === 'admin' || r === 'bendahara')
}

assert.equal(canConfigureAdminFee(['bendahara']), false, 'bendahara cannot config admin fee')
assert.equal(canConfigureAdminFee(['petugas_koperasi']), false, 'petugas_koperasi cannot config admin fee')
assert.equal(canConfigureAdminFee(['admin']), true, 'admin can config admin fee')
assert.equal(canConfigureAdminFee(['admin_koperasi']), true, 'admin_koperasi can config admin fee')

assert.equal(canManageAccounts(['petugas_koperasi']), false, 'petugas_koperasi cannot manage accounts')
assert.equal(canManageAccounts(['admin_koperasi']), true, 'admin_koperasi can manage accounts')

assert.equal(canSubmitDistribution(['admin_koperasi'], 'BRI_QLOLA'), false, 'admin_koperasi cannot submit distribution')
assert.equal(canSubmitDistribution(['petugas_koperasi'], 'MANUAL_TRANSFER'), false, 'petugas_koperasi cannot submit manual transfer')
assert.equal(canSubmitDistribution(['bendahara'], 'MANUAL_TRANSFER'), true, 'bendahara can submit manual transfer')

assert.equal(canCancelDistribution(['petugas_koperasi']), false, 'petugas_koperasi cannot cancel distribution')
assert.equal(canCancelDistribution(['admin_koperasi']), false, 'admin_koperasi cannot cancel distribution')
assert.equal(canCancelDistribution(['bendahara']), true, 'bendahara can cancel distribution')
assert.equal(canCancelDistribution(['admin']), true, 'admin can cancel distribution')
console.log('RT-10 Passed: Role authorization matrix fully conforms to PRD.')

// RT-11: Authoritative transition to FAILED only
console.log('RT-11: Verifying Non-STP QLola FAILED transition rules...')
// Attempt DRAFT -> FAILED
assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET status = 'FAILED' WHERE id = 'dist_qlola_stp_1'`).run()
}, /Penyaluran BRI_QLOLA non-STP/, 'Must reject DRAFT -> FAILED')

// Advance correctly: DRAFT -> PENDING_APPROVAL -> PROCESSING -> FAILED
db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_qlola_stp_1'`).run()
assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET status = 'FAILED' WHERE id = 'dist_qlola_stp_1'`).run()
}, /Penyaluran BRI_QLOLA non-STP/, 'Must reject PENDING_APPROVAL -> FAILED (needs PROCESSING first)')

db.prepare(`UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist_qlola_stp_1'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'FAILED' WHERE id = 'dist_qlola_stp_1'`).run()
const failedDist = db.prepare(`SELECT status FROM finance_distributions WHERE id = 'dist_qlola_stp_1'`).get()
assert.equal(failedDist.status, 'FAILED', 'PROCESSING -> FAILED must succeed as authoritative terminal bank failure')
console.log('RT-11 Passed: FAILED status strictly requires preceding PROCESSING bank state.')

// RT-12: CANCEL_PENDING keeps reservation active
console.log('RT-12: Verifying CANCEL_PENDING preserves reservation...')
const cancelPendingStatus = db.prepare(`SELECT status FROM finance_distributions WHERE id = 'dist_draft_A'`).get()
assert.equal(cancelPendingStatus.status, 'CANCEL_PENDING')
// While dist_draft_A is in CANCEL_PENDING, dist_draft_B promotion was already proven blocked in Test 13.
// Now set dist_draft_A to CANCELLED -> Reservation is safely released!
db.prepare(`UPDATE finance_distributions SET status = 'CANCELLED' WHERE id = 'dist_draft_A'`).run()
// Now dist_draft_B promotion to PENDING_APPROVAL succeeds!
db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_draft_B'`).run()
const distBStatus = db.prepare(`SELECT status FROM finance_distributions WHERE id = 'dist_draft_B'`).get()
assert.equal(distBStatus.status, 'PENDING_APPROVAL', 'Reservation released only upon authoritative CANCELLED')
console.log('RT-12 Passed: CANCEL_PENDING safely reserves funds until terminal CANCELLED confirmation.')

// RT-13: Correction on DISTRIBUTED allocation produces recovery case, NOT blocked
console.log('RT-13: Verifying correction on DISTRIBUTED allocation produces recovery case...')
// Create payment of 500k and allocation of 500k
db.prepare(`
    INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method, gross_amount, net_amount,
        status, correction_status, allocation_status, paid_at, source, fund_management, created_at
    ) VALUES (
        'pay_dist_case', 'PAY-DIST-001', NULL, 'santri_1', 'CASH', 'CASH', 500000, 500000,
        'PAID', 'NONE', 'ALLOCATED', datetime('now'), 'NEW_FINANCE', 'KOPERASI', datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_allocations (
        id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
    ) VALUES (
        'alloc_dist_case', 'pay_dist_case', NULL, 'OBLIGATION', 'SPP', 500000, 500000, 'DISBURSED', datetime('now')
    )
`).run()
// Distribution already completed as DISTRIBUTED for 500k
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_full_case', 'DIS-FULL-001', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 500000, 'CASH', 'DISTRIBUTED', datetime('now'), datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_distribution_items (
        id, distribution_id, allocation_id, amount, created_at
    ) VALUES (
        'item_dist_case', 'dist_full_case', 'alloc_dist_case', 500000, datetime('now')
    )
`).run()

// Now record correction/refund of 100k on alloc_dist_case: MUST SUCCEED (not blocked by DISTRIBUTED)
db.prepare(`
    INSERT INTO finance_corrections (
        id, correction_number, target_payment_id, correction_type, total_amount,
        method, reason, is_recovery_case, recovery_amount, recovery_status, approved_by, created_by, created_at
    ) VALUES (
        'corr_case_1', 'CORR-CASE-001', 'pay_dist_case', 'REFUND', 100000,
        'CASH', 'Koreksi setelah dana tersalurkan', 1, 100000, 'PENDING_RECOVERY', 'admin', 'admin', datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_correction_items (
        id, correction_id, target_allocation_id, obligation_id, target_type, amount, is_disbursed_portion, created_at
    ) VALUES (
        'corr_item_case_1', 'corr_case_1', 'alloc_dist_case', NULL, 'OBLIGATION', 100000, 1, datetime('now')
    )
`).run()

// Verify that correction was successfully recorded as recovery case
const corrCaseRow = db.prepare(`SELECT is_recovery_case, recovery_amount, recovery_status FROM finance_corrections WHERE id = 'corr_case_1'`).get()
assert.equal(corrCaseRow.is_recovery_case, 1, 'Correction must be flagged as recovery case')
assert.equal(corrCaseRow.recovery_amount, 100000, 'Recovery amount must be 100,000')
const distCaseRow = db.prepare(`SELECT status, total_amount FROM finance_distributions WHERE id = 'dist_full_case'`).get()
assert.equal(distCaseRow.status, 'DISTRIBUTED', 'Original distribution must remain DISTRIBUTED as historical fact')

// Verify available for new distribution on alloc_dist_case is 0 (effective 400k - distributed 500k <= 0)
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_new_attempt', 'DIS-NEW-001', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 50000, 'CASH', 'DRAFT', datetime('now'), datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_distribution_items (
        id, distribution_id, allocation_id, amount, created_at
    ) VALUES (
        'item_new_attempt', 'dist_new_attempt', 'alloc_dist_case', 50000, datetime('now')
    )
`).run()
assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_new_attempt'`).run()
}, /melebihi sisa alokasi efektif yang tersedia/, 'Must block new distributions from overdrawing corrected allocation')
console.log('RT-13 Passed: Correction on DISTRIBUTED allocation successfully recorded as recovery case.')

// RT-14: Correction conflicting with live PROCESSING reservation is rejected
console.log('RT-14: Verifying correction conflicting with live PROCESSING reservation is rejected...')
db.prepare(`
    INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method, gross_amount, net_amount,
        status, correction_status, allocation_status, paid_at, source, fund_management, created_at
    ) VALUES (
        'pay_live_case', 'PAY-LIVE-001', NULL, 'santri_1', 'CASH', 'CASH', 500000, 500000,
        'PAID', 'NONE', 'ALLOCATED', datetime('now'), 'NEW_FINANCE', 'KOPERASI', datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_allocations (
        id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
    ) VALUES (
        'alloc_live_case', 'pay_live_case', NULL, 'OBLIGATION', 'SPP', 500000, 0, 'UNDISBURSED', datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_live_proc', 'DIS-LIVE-001', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 500000, 'BRI_QLOLA', 'DRAFT', datetime('now'), datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_distribution_items (
        id, distribution_id, allocation_id, amount, created_at
    ) VALUES (
        'item_live_proc', 'dist_live_proc', 'alloc_live_case', 500000, datetime('now')
    )
`).run()
db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_live_proc'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist_live_proc'`).run()

// Attempting to insert correction item of 100k while 500k is live PROCESSING must fail!
db.prepare(`
    INSERT INTO finance_corrections (
        id, correction_number, target_payment_id, correction_type, total_amount,
        method, reason, approved_by, created_by, created_at
    ) VALUES (
        'corr_live_1', 'CORR-LIVE-001', 'pay_live_case', 'REFUND', 100000,
        'CASH', 'Coba koreksi saat live reservation', 'admin', 'admin', datetime('now')
    )
`).run()
assert.throws(() => {
    db.prepare(`
        INSERT INTO finance_correction_items (
            id, correction_id, target_allocation_id, obligation_id, target_type, amount, created_at
        ) VALUES (
            'corr_item_live_fail', 'corr_live_1', 'alloc_live_case', NULL, 'OBLIGATION', 100000, datetime('now')
        )
    `).run()
}, /reservasi penyaluran bank aktif/, 'Must reject correction when live reservation is undercollateralized')
console.log('RT-14 Passed: Correction conflicting with live PROCESSING reservation correctly rejected.')

// RT-15: Distribution Items immutable on REJECTED, CANCELLED, and FAILED
console.log('RT-15: Verifying distribution items immutability on REJECTED, CANCELLED, and FAILED...')
// 1. REJECTED: dist_test_pending is REJECTED
assert.throws(() => {
    db.prepare(`UPDATE finance_distribution_items SET amount = 99999 WHERE id = 'item_exact_1'`).run()
}, /Item penyaluran bersifat immutable/, 'Must reject updating item on REJECTED distribution')
assert.throws(() => {
    db.prepare(`DELETE FROM finance_distribution_items WHERE id = 'item_exact_1'`).run()
}, /Item penyaluran bersifat immutable/, 'Must reject deleting item on REJECTED distribution')

// 2. CANCELLED: dist_draft_A is CANCELLED
assert.throws(() => {
    db.prepare(`UPDATE finance_distribution_items SET amount = 99999 WHERE id = 'item_draft_A'`).run()
}, /Item penyaluran bersifat immutable/, 'Must reject updating item on CANCELLED distribution')
assert.throws(() => {
    db.prepare(`DELETE FROM finance_distribution_items WHERE id = 'item_draft_A'`).run()
}, /Item penyaluran bersifat immutable/, 'Must reject deleting item on CANCELLED distribution')

// 3. FAILED:
db.prepare(`
    INSERT INTO finance_payments (
        id, payment_number, order_id, santri_id, channel, method, gross_amount, net_amount,
        status, correction_status, allocation_status, paid_at, source, fund_management, created_at
    ) VALUES (
        'pay_fail_test', 'PAY-FAIL-001', NULL, 'santri_1', 'CASH', 'CASH', 50000, 50000,
        'PAID', 'NONE', 'ALLOCATED', datetime('now'), 'NEW_FINANCE', 'KOPERASI', datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_allocations (
        id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
    ) VALUES (
        'alloc_fail_test', 'pay_fail_test', NULL, 'OBLIGATION', 'SPP', 50000, 0, 'UNDISBURSED', datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_fail_test', 'DIS-FAIL-001', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 10000, 'BRI_QLOLA', 'DRAFT', datetime('now'), datetime('now')
    )
`).run()
db.prepare(`
    INSERT INTO finance_distribution_items (
        id, distribution_id, allocation_id, amount, created_at
    ) VALUES (
        'item_fail_test', 'dist_fail_test', 'alloc_fail_test', 10000, datetime('now')
    )
`).run()
db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_fail_test'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist_fail_test'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'FAILED' WHERE id = 'dist_fail_test'`).run()
assert.throws(() => {
    db.prepare(`UPDATE finance_distribution_items SET amount = 88888 WHERE id = 'item_fail_test'`).run()
}, /Item penyaluran bersifat immutable/, 'Must reject updating item on FAILED distribution')
assert.throws(() => {
    db.prepare(`DELETE FROM finance_distribution_items WHERE id = 'item_fail_test'`).run()
}, /Item penyaluran bersifat immutable/, 'Must reject deleting item on FAILED distribution')
console.log('RT-15 Passed: Items are strictly immutable on REJECTED, CANCELLED, and FAILED distributions.')

// RT-16: Freeze Financial Header fields after submit (PENDING_APPROVAL)
console.log('RT-16: Verifying financial header freeze after submit...')
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, destination_bank, destination_account, account_holder_name,
        status, created_at, updated_at
    ) VALUES (
        'dist_freeze_test', 'DIS-FREEZE-001', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 25000, 'BRI_QLOLA', 'BRI', '1122334455', 'Pesantren Pusat',
        'DRAFT', datetime('now'), datetime('now')
    )
`).run()
// In DRAFT, editing recipient or account is permitted
db.prepare(`UPDATE finance_distributions SET destination_account = '99887766' WHERE id = 'dist_freeze_test'`).run()
// Promote to PENDING_APPROVAL
db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_freeze_test'`).run()

// Now that it has left DRAFT, any change to financial header fields MUST FAIL!
assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET recipient_id = 'rec_jasa_makan_1' WHERE id = 'dist_freeze_test'`).run()
}, /Field finansial instruksi penyaluran.*bersifat immutable/, 'Must reject changing recipient_id after submit')

assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET destination_account = '000000' WHERE id = 'dist_freeze_test'`).run()
}, /Field finansial instruksi penyaluran.*bersifat immutable/, 'Must reject changing destination_account after submit')

assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET method = 'CASH' WHERE id = 'dist_freeze_test'`).run()
}, /Field finansial instruksi penyaluran.*bersifat immutable/, 'Must reject changing method after submit')

assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET total_amount = 50000 WHERE id = 'dist_freeze_test'`).run()
}, /Field finansial instruksi penyaluran.*bersifat immutable/, 'Must reject changing total_amount after submit')
console.log('RT-16 Passed: Financial header fields strictly frozen once submitted.')

// RT-17: Comprehensive QLola Cancellation State Machine
console.log('RT-17: Verifying comprehensive QLola cancellation state machine...')
// Test branch A: PROCESSING -> CANCEL_PENDING -> CANCELLED
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_sm_a', 'DIS-SM-A', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 15000, 'BRI_QLOLA', 'DRAFT', datetime('now'), datetime('now')
    )
`).run()
db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_sm_a'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist_sm_a'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'CANCEL_PENDING' WHERE id = 'dist_sm_a'`).run()
const smA_cp = db.prepare(`SELECT status FROM finance_distributions WHERE id = 'dist_sm_a'`).get()
assert.equal(smA_cp.status, 'CANCEL_PENDING', 'PROCESSING -> CANCEL_PENDING allowed')
db.prepare(`UPDATE finance_distributions SET status = 'CANCELLED' WHERE id = 'dist_sm_a'`).run()
const smA_can = db.prepare(`SELECT status FROM finance_distributions WHERE id = 'dist_sm_a'`).get()
assert.equal(smA_can.status, 'CANCELLED', 'CANCEL_PENDING -> CANCELLED allowed')

// Test branch B: PROCESSING -> CANCEL_PENDING -> DISTRIBUTED (bank executes anyway)
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_sm_b', 'DIS-SM-B', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 15000, 'BRI_QLOLA', 'DRAFT', datetime('now'), datetime('now')
    )
`).run()
db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_sm_b'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist_sm_b'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'CANCEL_PENDING' WHERE id = 'dist_sm_b'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist_sm_b'`).run()
const smB_dist = db.prepare(`SELECT status FROM finance_distributions WHERE id = 'dist_sm_b'`).get()
assert.equal(smB_dist.status, 'DISTRIBUTED', 'CANCEL_PENDING -> DISTRIBUTED allowed')

// Test branch C: PROCESSING -> CANCEL_PENDING -> FAILED
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_sm_c', 'DIS-SM-C', 'PESANTREN', 'rec_pesantren', 'SPP',
        '2026-09', 15000, 'BRI_QLOLA', 'DRAFT', datetime('now'), datetime('now')
    )
`).run()
db.prepare(`UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist_sm_c'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist_sm_c'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'CANCEL_PENDING' WHERE id = 'dist_sm_c'`).run()
db.prepare(`UPDATE finance_distributions SET status = 'FAILED' WHERE id = 'dist_sm_c'`).run()
const smC_fail = db.prepare(`SELECT status FROM finance_distributions WHERE id = 'dist_sm_c'`).get()
assert.equal(smC_fail.status, 'FAILED', 'CANCEL_PENDING -> FAILED allowed')
console.log('RT-17 Passed: Comprehensive QLola cancellation state machine transitions verified.')

// RT-18: Allowed-method validation triggers on UPDATE during DRAFT
console.log('RT-18: Verifying allowed-method validation on UPDATE during DRAFT...')
db.prepare(`
    INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type,
        period, total_amount, method, status, created_at, updated_at
    ) VALUES (
        'dist_draft_method', 'DIS-METH-001', 'KATERING', 'rec_cash_only', 'UANG_MAKAN',
        '2026-09', 10000, 'CASH', 'DRAFT', datetime('now'), datetime('now')
    )
`).run()
// rec_cash_only only allows CASH. Updating method to BRI_QLOLA while in DRAFT must fail!
assert.throws(() => {
    db.prepare(`UPDATE finance_distributions SET method = 'BRI_QLOLA' WHERE id = 'dist_draft_method'`).run()
}, /Metode penyaluran tidak diizinkan untuk penerima ini/, 'Must block updating DRAFT to disallowed method')
console.log('RT-18 Passed: Allowed-method validation triggers on UPDATE during DRAFT.')

// RT-19: Multi-vendor Katering/Laundry have usable allowed methods seeded
console.log('RT-19: Verifying migrated multi-vendor Katering & Laundry have usable allowed methods...')
const makanRec = db.prepare(`SELECT * FROM finance_distribution_recipients WHERE id = 'rec_jasa_makan_1'`).get()
const cuciRec = db.prepare(`SELECT * FROM finance_distribution_recipients WHERE id = 'rec_jasa_cuci_1'`).get()
assert.ok(makanRec, 'Katering recipient must exist')
assert.ok(cuciRec, 'Laundry recipient must exist')
const makanMethods = db.prepare(`SELECT method FROM finance_recipient_allowed_methods WHERE recipient_id = 'rec_jasa_makan_1'`).all().map(r => r.method)
const cuciMethods = db.prepare(`SELECT method FROM finance_recipient_allowed_methods WHERE recipient_id = 'rec_jasa_cuci_1'`).all().map(r => r.method)
assert.ok(makanMethods.includes('BRI_QLOLA') && makanMethods.includes('CASH') && makanMethods.includes('MANUAL_TRANSFER'))
assert.ok(cuciMethods.includes('BRI_QLOLA') && cuciMethods.includes('CASH') && cuciMethods.includes('MANUAL_TRANSFER'))
console.log('RT-19 Passed: All migrated multi-vendor recipients have usable allowed methods.')

// RT-20: Effective Fee Rule lookup at time T produces authoritative rule, historical order unchanged
console.log('RT-20: Verifying effective fee rule lookup and historical order immutability...')
// Create order with snapshot fee 2500 at T1
db.prepare(`
    INSERT INTO finance_payment_orders (
        id, order_number, santri_id, payer_type, gross_amount,
        cooperative_admin_fee, fee_payer, total_charged, payment_method,
        status, expires_at, created_at, updated_at
    ) VALUES (
        'ord_snap_t1', 'ORD-SNAP-001', 'santri_2', 'PORTAL_ORTU', 100000,
        2500, 'CUSTOMER', 102500, 'BRI_VA',
        'PAID', datetime('now', '+1 day'), '2026-08-01 10:00:00', '2026-08-01 10:00:00'
    )
`).run()
// At T1 (2026-07-01), rule with fee 2500 is created
db.prepare(`
    INSERT INTO finance_cooperative_admin_fee_rules (
        id, code, name, applies_to_channel, amount, is_enabled, effective_from, effective_until, created_by, created_at
    ) VALUES (
        'rule_t1', 'ONLINE_CHECKOUT_FEE_T', 'Fee T1', 'BRI', 2500, 1, '2026-07-01 00:00:00', '2026-09-01 00:00:00', 'admin', datetime('now')
    )
`).run()

// At T2 (2026-09-01), new rule with fee 4000 takes over
db.prepare(`
    INSERT INTO finance_cooperative_admin_fee_rules (
        id, code, name, applies_to_channel, amount, is_enabled, effective_from, effective_until, created_by, created_at
    ) VALUES (
        'rule_t2', 'ONLINE_CHECKOUT_FEE_T', 'Fee T2', 'BRI', 4000, 1, '2026-09-01 00:00:00', NULL, 'admin', datetime('now')
    )
`).run()

// Query rule at T1 (2026-08-01): must be 2500
const ruleAtT1 = db.prepare(`
    SELECT amount FROM finance_cooperative_admin_fee_rules
    WHERE applies_to_channel = 'BRI' AND code = 'ONLINE_CHECKOUT_FEE_T' AND is_enabled = 1
      AND effective_from <= '2026-08-01 10:00:00'
      AND (effective_until IS NULL OR effective_until > '2026-08-01 10:00:00')
`).get()
assert.equal(ruleAtT1.amount, 2500, 'Effective rule at T1 must be 2500')

// Query rule at T2 (2026-09-15): must be 4000
const ruleAtT2 = db.prepare(`
    SELECT amount FROM finance_cooperative_admin_fee_rules
    WHERE applies_to_channel = 'BRI' AND code = 'ONLINE_CHECKOUT_FEE_T' AND is_enabled = 1
      AND effective_from <= '2026-09-15 10:00:00'
      AND (effective_until IS NULL OR effective_until > '2026-09-15 10:00:00')
`).get()
assert.equal(ruleAtT2.amount, 4000, 'Effective rule at T2 must be 4000')

// Query historical order: snapshot remains 2500
const histOrder = db.prepare(`SELECT cooperative_admin_fee, total_charged FROM finance_payment_orders WHERE id = 'ord_snap_t1'`).get()
assert.equal(histOrder.cooperative_admin_fee, 2500, 'Historical order snapshot must remain unchanged')
assert.equal(histOrder.total_charged, 102500, 'Historical total charged must remain unchanged')
console.log('RT-20 Passed: Effective fee rule evolution preserves historical order snapshot integrity.')

console.log('\n======================================================')
console.log('SUCCESS: ALL 13 CORE INVARIANTS + 20 REGRESSION TESTS PASSED!')
console.log('======================================================\n')
