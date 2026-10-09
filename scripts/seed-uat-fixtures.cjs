// scripts/seed-uat-fixtures.cjs
// Deterministic Fixture Seeder for UAT, Demo Database, and Regression Testing (Fase BRI-7)
// Populates full financial model according to BRI-0 through BRI-6 specifications

const crypto = require('node:crypto')

function generateId() {
  return crypto.randomUUID()
}

function now() {
  return new Date().toISOString()
}

function assertDemoDatabaseSafety(targetName) {
  const normalized = (targetName || process.env.D1_DATABASE_NAME || '').trim().toLowerCase()
  if (normalized === 'eskahade-db' || normalized === 'prod' || normalized.includes('production')) {
    throw new Error('HARD_SAFETY_VIOLATION: Refusing to seed fixtures on production database! Target must strictly be demo/sandbox.')
  }
}

/**
 * Seeds a deterministic set of financial UAT fixtures into the provided SQLite database connection.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} [targetDbName]
 */
function seedUatFixtures(db, targetDbName) {
  assertDemoDatabaseSafety(targetDbName)
  const ts = now()

  // 0. Deterministic Reset of UAT-owned fixtures only
  try {
    db.prepare(`DELETE FROM finance_distribution_items WHERE distribution_id LIKE 'DIST-%'`).run()
    db.prepare(`DELETE FROM finance_distributions WHERE id LIKE 'DIST-%'`).run()
    db.prepare(`DELETE FROM finance_cash_manual_evidence WHERE id LIKE 'EVI-%'`).run()
    db.prepare(`DELETE FROM finance_bri_settlement_items WHERE id LIKE 'SETTLE-ITEM-%'`).run()
    db.prepare(`DELETE FROM finance_bri_settlements WHERE id LIKE 'SETTLE-%'`).run()
    db.prepare(`DELETE FROM finance_bri_statement_transactions WHERE id LIKE 'STMT-TX-%'`).run()
    db.prepare(`DELETE FROM finance_bri_statement_fetches WHERE id LIKE 'FETCH-%'`).run()
    db.prepare(`DELETE FROM finance_allocations WHERE id LIKE 'ALC-%'`).run()
    db.prepare(`DELETE FROM finance_payments WHERE id LIKE 'PAY-%'`).run()
    db.prepare(`DELETE FROM finance_cooperative_income WHERE id LIKE 'INC-%'`).run()
    db.prepare(`DELETE FROM finance_payment_orders WHERE id LIKE 'ORD-%'`).run()
    db.prepare(`DELETE FROM finance_student_va WHERE id LIKE 'VA-%'`).run()
    db.prepare(`DELETE FROM finance_cash_sessions WHERE id LIKE 'CS-SESSION-%'`).run()
    db.prepare(`DELETE FROM finance_reconciliation_items WHERE id LIKE 'REC-ITEM-%'`).run()
  } catch {
    // ignore if tables not yet populated
  }

  // 1. Master Santri
  // Santri A: Regular Billable
  // Santri B: AL-BAGHORY (Fully exempt from tagihan and VA - lib/finance/non-billable-santri.ts)
  // Santri C: SADESA (Exempt from UANG_MAKAN and UANG_NYUCI only - 0052_santri_kategori_sadesa.sql)
  try {
    db.prepare(`
      INSERT OR REPLACE INTO santri (id, nis, nama, nama_lengkap, asrama, status, status_global, status_santri, kategori_santri, jenis_kelamin, created_at)
      VALUES
        ('SAN-BILLABLE-001', 'NIS001', 'Ahmad Billable', 'Ahmad Billable', 'Asrama Abu Bakar', 'AKTIF', 'aktif', 'REGULER', 'REGULER', 'L', ?),
        ('SAN-ALBAGHORY-002', 'NIS002', 'Budi Al-Baghory', 'Budi Al-Baghory', 'AL-BAGHORY', 'AKTIF', 'aktif', 'REGULER', 'REGULER', 'L', ?),
        ('SAN-SADESA-003', 'NIS003', 'Cecep Sadesa', 'Cecep Sadesa', 'Asrama Umar', 'AKTIF', 'aktif', 'SADESA', 'SADESA', 'L', ?)
    `).run(ts, ts, ts)
  } catch {
    db.prepare(`
      INSERT OR REPLACE INTO santri (id, nis, nama, asrama, status, status_santri, jenis_kelamin, created_at)
      VALUES
        ('SAN-BILLABLE-001', 'NIS001', 'Ahmad Billable', 'Asrama Abu Bakar', 'AKTIF', 'REGULER', 'L', ?),
        ('SAN-ALBAGHORY-002', 'NIS002', 'Budi Al-Baghory', 'AL-BAGHORY', 'AKTIF', 'REGULER', 'L', ?),
        ('SAN-SADESA-003', 'NIS003', 'Cecep Sadesa', 'Asrama Umar', 'AKTIF', 'SADESA', 'L', ?)
    `).run(ts, ts, ts)
  }

  // 2. Cooperative Admin Fee Config
  db.prepare(`
    INSERT OR REPLACE INTO finance_cooperative_admin_fee_rules (id, rule_name, fee_amount, is_active, created_at)
    VALUES ('RULE-DEFAULT', 'STANDAR_KOPERASI', 2500, 1, ?)
  `).run(ts)

  // 3. Distribution Recipients & Master Jasa
  db.prepare(`
    INSERT OR REPLACE INTO master_jasa (id, nama, kategori, status)
    VALUES
      ('VEND-PESANTREN', 'Pesantren Pusat', 'PESANTREN', 'AKTIF'),
      ('VEND-KATERING', 'Berkah Boga Katering', 'KATERING', 'AKTIF'),
      ('VEND-LAUNDRY', 'Resik Bersih Laundry', 'LAUNDRY', 'AKTIF')
  `).run()

  db.prepare(`
    INSERT OR REPLACE INTO finance_distribution_recipients (id, recipient_type, provider_id, display_name, is_active, created_at)
    VALUES
      ('REC-PESANTREN', 'PESANTREN', 'VEND-PESANTREN', 'Pondok Pesantren Eskahade', 1, ?),
      ('REC-KATERING', 'KATERING', 'VEND-KATERING', 'Katering Barokah', 1, ?),
      ('REC-LAUNDRY', 'LAUNDRY', 'VEND-LAUNDRY', 'Laundry Resik', 1, ?)
  `).run(ts, ts, ts)

  db.prepare(`
    INSERT OR REPLACE INTO finance_recipient_accounts (id, recipient_id, bank_code, account_number, account_holder_name, is_primary, is_active, created_at)
    VALUES
      ('ACC-PESANTREN', 'REC-PESANTREN', 'BRI', '001901000999501', 'Yayasan Pondok Pesantren Eskahade', 1, 1, ?),
      ('ACC-KATERING', 'REC-KATERING', 'BRI', '001901000888502', 'Berkah Boga Katering CV', 1, 1, ?),
      ('ACC-LAUNDRY', 'REC-LAUNDRY', 'BRI', '001901000777503', 'Resik Bersih Laundry CV', 1, 1, ?)
  `).run(ts, ts, ts)

  db.prepare(`
    INSERT OR REPLACE INTO finance_recipient_allowed_methods (id, recipient_id, method, is_allowed, created_at)
    VALUES
      ('MTH-PES-QLOLA', 'REC-PESANTREN', 'BRI_QLOLA', 1, ?),
      ('MTH-PES-MANUAL', 'REC-PESANTREN', 'MANUAL_TRANSFER', 1, ?),
      ('MTH-PES-CASH', 'REC-PESANTREN', 'CASH', 1, ?),
      ('MTH-KAT-QLOLA', 'REC-KATERING', 'BRI_QLOLA', 1, ?),
      ('MTH-KAT-MANUAL', 'REC-KATERING', 'MANUAL_TRANSFER', 1, ?),
      ('MTH-KAT-CASH', 'REC-KATERING', 'CASH', 1, ?),
      ('MTH-LAU-QLOLA', 'REC-LAUNDRY', 'BRI_QLOLA', 1, ?),
      ('MTH-LAU-MANUAL', 'REC-LAUNDRY', 'MANUAL_TRANSFER', 1, ?),
      ('MTH-LAU-CASH', 'REC-LAUNDRY', 'CASH', 1, ?)
  `).run(ts, ts, ts, ts, ts, ts, ts, ts, ts)

  // 4. Fixed BRIVA Numbers (Al-Baghory must NOT have VA)
  db.prepare(`
    INSERT OR REPLACE INTO finance_student_va (id, santri_id, va_number, bank_code, status, is_active, created_at)
    VALUES
      ('VA-BILLABLE-001', 'SAN-BILLABLE-001', '1280081234567890', 'BRI', 'ACTIVE', 1, ?),
      ('VA-SADESA-003', 'SAN-SADESA-003', '1280081234567891', 'BRI', 'ACTIVE', 1, ?)
  `).run(ts, ts)

  // 5. Payment Orders
  db.prepare(`
    INSERT OR REPLACE INTO finance_payment_orders (id, order_number, santri_id, va_number, total_amount, status, created_at)
    VALUES
      ('ORD-001', 'PO-2026-0001', 'SAN-BILLABLE-001', '1280081234567890', 802500, 'PAID', ?),
      ('ORD-002', 'PO-2026-0002', 'SAN-BILLABLE-001', '1280081234567890', 500000, 'PAID', ?)
  `).run(ts, ts)

  // 6. Cooperative Income (Admin Fee snapshot)
  db.prepare(`
    INSERT OR REPLACE INTO finance_cooperative_income (id, source_type, source_id, amount, recorded_at, created_at)
    VALUES
      ('INC-001', 'PAYMENT_ORDER', 'ORD-001', 2500, ?, ?),
      ('INC-002', 'PAYMENT_ORDER', 'ORD-002', 2500, ?, ?)
  `).run(ts, ts, ts, ts)

  // 7. Finance Payments
  // Payment 1: PAID (not settled yet)
  // Payment 2: SETTLED (linked to Bank Statement transaction)
  // Payment 3: Uang Jajan Topup
  db.prepare(`
    INSERT OR REPLACE INTO finance_payments (
      id, payment_number, santri_id, order_id, method, channel,
      amount, admin_fee, total_amount, status, allocation_status,
      cooperative_admin_fee, bri_bank_fee, created_at
    )
    VALUES
      ('PAY-001', 'PAY-2026-0001', 'SAN-BILLABLE-001', 'ORD-001', 'BRIVA', 'BRIVA_ONLINE', 800000, 2500, 802500, 'PAID', 'ALLOCATED', 2500, 1000, ?),
      ('PAY-002', 'PAY-2026-0002', 'SAN-BILLABLE-001', 'ORD-002', 'BRIVA', 'BRIVA_ONLINE', 500000, 2500, 502500, 'SETTLED', 'ALLOCATED', 2500, 1000, ?),
      ('PAY-003', 'PAY-2026-0003', 'SAN-BILLABLE-001', NULL, 'BRIVA', 'BRIVA_ONLINE', 100000, 0, 100000, 'PAID', 'ALLOCATED', 0, 0, ?)
  `).run(ts, ts, ts)

  // 8. Allocations
  // PAY-001: 500k SPP (Pesantren) + 200k Uang Makan (Katering) + 100k Uang Nyuci (Laundry) = 800k
  // PAY-002: 500k SPP (Pesantren) = 500k
  // PAY-003: 100k UANG_JAJAN (Titipan Santri) = 100k
  db.prepare(`
    INSERT OR REPLACE INTO finance_allocations (id, payment_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at)
    VALUES
      ('ALC-SPP-001', 'PAY-001', 'OBLIGATION', 'SPP', 500000, 200000, 'PARTIALLY_DISBURSED', ?),
      ('ALC-MAKAN-001', 'PAY-001', 'OBLIGATION', 'UANG_MAKAN', 200000, 0, 'UNDISBURSED', ?),
      ('ALC-NYUCI-001', 'PAY-001', 'OBLIGATION', 'UANG_NYUCI', 100000, 0, 'UNDISBURSED', ?),
      ('ALC-SPP-002', 'PAY-002', 'OBLIGATION', 'SPP', 500000, 500000, 'DISBURSED', ?),
      ('ALC-JAJAN-003', 'PAY-003', 'UANG_JAJAN', 'UANG_JAJAN', 100000, 0, 'UNDISBURSED', ?)
  `).run(ts, ts, ts, ts, ts)

  // 9. Bank Statement Transactions & Settlements (BRI-4)
  db.prepare(`
    INSERT OR REPLACE INTO finance_bri_statement_fetches (id, account_no, start_date, end_date, total_records, status, created_at)
    VALUES ('FETCH-001', '001201000123301', '2026-10-01', '2026-10-01', 3, 'COMPLETED', ?)
  `).run(ts)

  db.prepare(`
    INSERT OR REPLACE INTO finance_bri_statement_transactions (
      id, fetch_id, bri_trx_id, account_no, amount, type_normalized,
      description, settlement_status, raw_evidence_hash, created_at
    )
    VALUES
      ('STMT-TX-001', 'FETCH-001', 'BRITRX-20261001-001', '001201000123301', 502500, 'CREDIT', 'BRIVA PAYMENT PAY-002', 'SETTLED', 'hash-stmt-001', ?),
      ('STMT-TX-002', 'FETCH-001', 'BRITRX-20261001-002', '001201000123301', 150000, 'CREDIT', 'UNKNOWN TRANSFER', 'UNALLOCATED', 'hash-stmt-002', ?),
      ('STMT-TX-003', 'FETCH-001', 'BRITRX-20261001-003', '001201000123301', 200000, 'DEBIT', 'TRANSFER KAS OPERASIONAL', 'UNSETTLED', 'hash-stmt-003', ?)
  `).run(ts, ts, ts)

  db.prepare(`
    INSERT OR REPLACE INTO finance_bri_settlements (id, settlement_number, statement_fetch_id, total_amount, total_count, created_at)
    VALUES ('SETTLE-001', 'STL-20261001-001', 'FETCH-001', 500000, 1, ?)
  `).run(ts)

  db.prepare(`
    INSERT OR REPLACE INTO finance_bri_settlement_items (id, settlement_id, payment_id, statement_transaction_id, matched_amount, match_rule, match_strength, created_at)
    VALUES ('SETTLE-ITEM-001', 'SETTLE-001', 'PAY-002', 'STMT-TX-001', 500000, 'EXACT_MATCH', 'AUTHORITATIVE_EXACT', ?)
  `).run(ts)

  // 10. Cash Session & Desk Liquidity (BRI-6)
  // Opening: 1,000,000. Cash In: 0. Cash Out: 200,000. Live Prepared: 100,000.
  // Available physical cash: 1,000,000 - 200,000 - 100,000 = 700,000.
  db.prepare(`
    INSERT OR REPLACE INTO finance_cash_sessions (
      id, session_code, opened_by, status, opening_balance,
      cash_in_amount, cash_out_amount, live_prepared_amount,
      expected_closing_balance, created_at
    )
    VALUES ('CS-SESSION-001', 'CS-2026-10-01-A', 'usr-kasir-1', 'OPEN', 1000000, 0, 200000, 100000, 800000, ?)
  `).run(ts)

  // 11. Distributions & Items (CASH, MANUAL, QLOLA)
  // Distribution 1: CASH DISTRIBUTED (200k from ALC-SPP-001)
  db.prepare(`
    INSERT OR REPLACE INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id,
      disbursement_method, total_amount, status, cash_session_id, created_at
    )
    VALUES ('DIST-CASH-001', 'DIS-2026-0001', 'PESANTREN', 'REC-PESANTREN', 'CASH', 200000, 'DISTRIBUTED', 'CS-SESSION-001', ?)
  `).run(ts)

  db.prepare(`
    INSERT OR REPLACE INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('DIST-ITEM-001', 'DIST-CASH-001', 'ALC-SPP-001', 200000)
  `).run()

  // Distribution 2: CASH PROCESSING / PREPARED (100k reserved from ALC-SPP-001)
  db.prepare(`
    INSERT OR REPLACE INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id,
      disbursement_method, total_amount, status, cash_session_id, created_at
    )
    VALUES ('DIST-CASH-002', 'DIS-2026-0002', 'PESANTREN', 'REC-PESANTREN', 'CASH', 100000, 'PROCESSING', 'CS-SESSION-001', ?)
  `).run(ts)

  db.prepare(`
    INSERT OR REPLACE INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('DIST-ITEM-002', 'DIST-CASH-002', 'ALC-SPP-001', 100000)
  `).run()

  // Distribution 3: MANUAL TRANSFER DISTRIBUTED (500k from ALC-SPP-002)
  db.prepare(`
    INSERT OR REPLACE INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id,
      disbursement_method, total_amount, status, created_at
    )
    VALUES ('DIST-MAN-001', 'DIS-2026-0003', 'PESANTREN', 'REC-PESANTREN', 'MANUAL_TRANSFER', 500000, 'DISTRIBUTED', ?)
  `).run(ts)

  db.prepare(`
    INSERT OR REPLACE INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('DIST-ITEM-003', 'DIST-MAN-001', 'ALC-SPP-002', 500000)
  `).run()

  // Distribution 4: BRI_QLOLA DRAFT (100k from ALC-MAKAN-001)
  db.prepare(`
    INSERT OR REPLACE INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id,
      disbursement_method, total_amount, status, created_at
    )
    VALUES ('DIST-QLO-001', 'DIS-2026-0004', 'KATERING', 'REC-KATERING', 'BRI_QLOLA', 100000, 'DRAFT', ?)
  `).run(ts)

  db.prepare(`
    INSERT OR REPLACE INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('DIST-ITEM-004', 'DIST-QLO-001', 'ALC-MAKAN-001', 100000)
  `).run()

  // 12. Cash Manual Evidence
  db.prepare(`
    INSERT OR REPLACE INTO finance_cash_manual_evidence (
      id, distribution_id, evidence_type, evidence_strength, source,
      reference_number, raw_evidence_hash, observed_at, recorded_at,
      operator_id, operator_role_snapshot, receiving_person_name, created_at
    )
    VALUES
      ('EVI-001', 'DIST-CASH-001', 'CASH_HANDOVER_RECEIPT', 'MANUAL_RESOLVED', 'PHYSICAL_RECEIPT', 'KWITANSI-001', 'hash-evi-001', ?, ?, 'usr-kasir-1', 'bendahara', 'Ust. Maimun', ?),
      ('EVI-002', 'DIST-MAN-001', 'MANUAL_TRANSFER_SUCCESS', 'MANUAL_RESOLVED', 'BANK_RECEIPT', 'TRX-MAN-99881', 'hash-evi-002', ?, ?, 'usr-kasir-1', 'bendahara', 'Pimpinan Pesantren', ?)
  `).run(ts, ts, ts, ts, ts, ts)

  // 13. Reconciliation Items (Unallocated external credit in queue)
  db.prepare(`
    INSERT OR REPLACE INTO finance_reconciliation_items (
      id, reconciliation_id, external_reference, external_amount, match_status, resolution_action, created_at
    )
    VALUES ('REC-ITEM-001', NULL, 'BRITRX-20261001-002', 150000, 'UNALLOCATED_TRANSFER', 'NONE', ?)
  `).run(ts)
}

module.exports = { seedUatFixtures }
