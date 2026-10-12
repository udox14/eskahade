// scripts/seed-uat-fixtures.cjs
// Deterministic Fixture Seeder for UAT, Demo Database, and Regression Testing (Fase BRI-7)
// Populates full financial model according to BRI-0 through BRI-6 specifications and exact D1 schema

const crypto = require('node:crypto')

function generateId() {
  return crypto.randomUUID()
}

function now() {
  return new Date().toISOString()
}

function future() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString()
}

function assertDemoDatabaseSafety(targetName) {
  const normalized = (targetName || process.env.D1_DATABASE_NAME || '').trim().toLowerCase()
  if (normalized === 'eskahade-db' || normalized === 'prod' || normalized.includes('production')) {
    throw new Error('HARD_SAFETY_VIOLATION: Refusing to seed fixtures on production database! Target must strictly be demo/sandbox.')
  }
}

function getSeedStatements(ts, futureDate) {
  return [
    // 0. Deterministic Reset of UAT-owned fixtures only
    `DELETE FROM finance_distribution_items WHERE distribution_id LIKE 'DIST-%'`,
    `DELETE FROM finance_distributions WHERE id LIKE 'DIST-%'`,
    `DELETE FROM finance_cash_manual_evidence WHERE id LIKE 'EVI-%'`,
    `DELETE FROM finance_bri_settlement_items WHERE id LIKE 'SETTLE-ITEM-%'`,
    `DELETE FROM finance_bri_settlements WHERE id LIKE 'SETTLE-%'`,
    `DELETE FROM finance_bri_statement_transactions WHERE id LIKE 'STMT-TX-%'`,
    `DELETE FROM finance_bri_statement_fetches WHERE id LIKE 'FETCH-%'`,
    `DELETE FROM finance_allocations WHERE id LIKE 'ALC-%'`,
    `DELETE FROM finance_payments WHERE id LIKE 'PAY-%'`,
    `DELETE FROM finance_cooperative_income WHERE id LIKE 'INC-%'`,
    `DELETE FROM finance_payment_orders WHERE id LIKE 'ORD-%'`,
    `DELETE FROM finance_student_va WHERE id LIKE 'VA-%'`,
    `DELETE FROM finance_cash_sessions WHERE id LIKE 'CS-SESSION-%'`,
    `DELETE FROM finance_reconciliation_items WHERE id LIKE 'REC-ITEM-%'`,
    `DELETE FROM finance_qlola_transfer_intents WHERE id LIKE 'INTENT-%'`,

    // 1. Operator User
    `INSERT OR REPLACE INTO users (id, email, password_hash, full_name, role)
     VALUES ('usr-kasir-1', 'kasir-uat@eskahade.com', 'hash_test', 'Petugas Kasir UAT', 'bendahara')`,

    // 2. Master Santri
    `INSERT OR REPLACE INTO santri (id, nis, nama_lengkap, asrama, status_global, kategori_santri, jenis_kelamin, created_at)
     VALUES
       ('SAN-BILLABLE-001', 'NIS001', 'Ahmad Billable', 'Asrama Abu Bakar', 'aktif', 'REGULER', 'L', '${ts}'),
       ('SAN-ALBAGHORY-002', 'NIS002', 'Budi Al-Baghory', 'AL-BAGHORY', 'aktif', 'REGULER', 'L', '${ts}'),
       ('SAN-SADESA-003', 'NIS003', 'Cecep Sadesa', 'Asrama Umar', 'aktif', 'SADESA', 'L', '${ts}')`,

    // 3. Master Jasa
    `INSERT OR REPLACE INTO master_jasa (id, nama_jasa, jenis, created_at)
     VALUES
       ('VEND-KATERING', 'Berkah Boga Katering', 'Makan', '${ts}'),
       ('VEND-LAUNDRY', 'Resik Bersih Laundry', 'Cuci', '${ts}')`,

    // 4. Distribution Recipients
    `INSERT OR REPLACE INTO finance_distribution_recipients (id, recipient_type, name, provider_id, is_active, allowed_methods, created_at, updated_at)
     VALUES
       ('rec_pesantren', 'PESANTREN', 'Pesantren Sukahideng (Bendahara)', NULL, 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER', '${ts}', '${ts}'),
       ('rec_katering_uat', 'KATERING', 'Katering Barokah UAT', 'VEND-KATERING', 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER', '${ts}', '${ts}'),
       ('rec_laundry_uat', 'LAUNDRY', 'Laundry Resik UAT', 'VEND-LAUNDRY', 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER', '${ts}', '${ts}')`,

    // 5. Recipient Allowed Methods
    `INSERT OR REPLACE INTO finance_recipient_allowed_methods (recipient_id, method, created_at)
     VALUES
       ('rec_pesantren', 'BRI_QLOLA', '${ts}'),
       ('rec_pesantren', 'CASH', '${ts}'),
       ('rec_pesantren', 'MANUAL_TRANSFER', '${ts}'),
       ('rec_katering_uat', 'BRI_QLOLA', '${ts}'),
       ('rec_katering_uat', 'CASH', '${ts}'),
       ('rec_katering_uat', 'MANUAL_TRANSFER', '${ts}'),
       ('rec_laundry_uat', 'BRI_QLOLA', '${ts}'),
       ('rec_laundry_uat', 'CASH', '${ts}'),
       ('rec_laundry_uat', 'MANUAL_TRANSFER', '${ts}')`,

    // 6. Recipient Accounts
    `INSERT OR REPLACE INTO finance_recipient_accounts (id, recipient_id, bank_code, account_number, account_holder, is_primary, is_active, notes, created_at, updated_at)
     VALUES
       ('ACC-PESANTREN', 'rec_pesantren', 'BRI', '001901000999501', 'Yayasan Pondok Pesantren Eskahade', 1, 1, 'Rekening Operasional Pesantren', '${ts}', '${ts}'),
       ('ACC-KATERING', 'rec_katering_uat', 'BRI', '001901000888502', 'Berkah Boga Katering CV', 1, 1, 'Rekening Vendor Katering', '${ts}', '${ts}'),
       ('ACC-LAUNDRY', 'rec_laundry_uat', 'BRI', '001901000777503', 'Resik Bersih Laundry CV', 1, 1, 'Rekening Vendor Laundry', '${ts}', '${ts}')`,

    // 7. Cooperative Admin Fee Rule (active rule for UAT)
    `INSERT OR REPLACE INTO finance_cooperative_admin_fee_rules (id, code, name, is_enabled, amount, applies_to_channel, effective_from, created_at)
     VALUES ('rule_default_online_v1', 'ONLINE_CHECKOUT_FEE', 'Biaya Operasional Koperasi Transaksi Online', 1, 2500, 'BRI', '${ts}', '${ts}')`,

    // 8. Fixed BRIVA Numbers (Al-Baghory must NOT have VA)
    `INSERT OR REPLACE INTO finance_student_va (id, santri_id, customer_no, va_number, status, activated_at, created_at, updated_at)
     VALUES
       ('VA-BILLABLE-001', 'SAN-BILLABLE-001', '81234567890', '1280081234567890', 'ACTIVE', '${ts}', '${ts}', '${ts}'),
       ('VA-SADESA-003', 'SAN-SADESA-003', '81234567891', '1280081234567891', 'ACTIVE', '${ts}', '${ts}', '${ts}')`,

    // 9. Payment Order 1 & Payment 1
    `INSERT OR REPLACE INTO finance_payment_orders (
       id, order_number, santri_id, payer_type, gross_amount,
       cooperative_admin_fee, fee_payer, total_charged, payment_method,
       fixed_va_number, status, expires_at, created_at, updated_at
     )
     VALUES
       ('ORD-001', 'PO-2026-0001', 'SAN-BILLABLE-001', 'PORTAL_ORTU', 800000, 2500, 'CUSTOMER', 802500, 'BRI_VA', '1280081234567890', 'PENDING', '${futureDate}', '${ts}', '${ts}')`,

    `INSERT OR REPLACE INTO finance_payments (
       id, payment_number, order_id, santri_id, channel, method,
       gross_amount, cooperative_admin_fee, bri_fee_amount, net_amount,
       status, correction_status, allocation_status, paid_at,
       bri_payment_request_id, bri_trx_id, created_at
     )
     VALUES
       ('PAY-001', 'PAY-2026-0001', 'ORD-001', 'SAN-BILLABLE-001', 'BRI', 'BRIVA', 800000, 2500, 1000, 800000, 'PAID', 'NONE', 'ALLOCATED', '${ts}', 'REQ-20261001-001', 'BRITRX-20261001-000', '${ts}')`,

    `UPDATE finance_payment_orders SET status = 'PAID' WHERE id = 'ORD-001'`,

    // 10. Payment Order 2 & Payment 2 (Created after ORD-001 is PAID to preserve single-active-order invariant)
    `INSERT OR REPLACE INTO finance_payment_orders (
       id, order_number, santri_id, payer_type, gross_amount,
       cooperative_admin_fee, fee_payer, total_charged, payment_method,
       fixed_va_number, status, expires_at, created_at, updated_at
     )
     VALUES
       ('ORD-002', 'PO-2026-0002', 'SAN-BILLABLE-001', 'PORTAL_ORTU', 500000, 2500, 'CUSTOMER', 502500, 'BRI_VA', '1280081234567890', 'PENDING', '${futureDate}', '${ts}', '${ts}')`,

    `INSERT OR REPLACE INTO finance_payments (
       id, payment_number, order_id, santri_id, channel, method,
       gross_amount, cooperative_admin_fee, bri_fee_amount, net_amount,
       status, correction_status, allocation_status, paid_at,
       bri_payment_request_id, bri_trx_id, created_at
     )
     VALUES
       ('PAY-002', 'PAY-2026-0002', 'ORD-002', 'SAN-BILLABLE-001', 'BRI', 'BRIVA', 500000, 2500, 1000, 500000, 'PAID', 'NONE', 'ALLOCATED', '${ts}', 'REQ-20261001-002', 'BRITRX-20261001-001', '${ts}')`,

    `UPDATE finance_payment_orders SET status = 'PAID' WHERE id = 'ORD-002'`,

    // Payment 3 (CASH, Uang Jajan topup without order)
    `INSERT OR REPLACE INTO finance_payments (
       id, payment_number, order_id, santri_id, channel, method,
       gross_amount, cooperative_admin_fee, bri_fee_amount, net_amount,
       status, correction_status, allocation_status, paid_at,
       bri_payment_request_id, bri_trx_id, created_at
     )
     VALUES
       ('PAY-003', 'PAY-2026-0003', NULL, 'SAN-BILLABLE-001', 'CASH', 'CASH', 100000, 0, NULL, 100000, 'PAID', 'NONE', 'ALLOCATED', '${ts}', NULL, NULL, '${ts}')`,

    // 11. Cooperative Income
    `INSERT OR REPLACE INTO finance_cooperative_income (
       id, income_number, entry_type, payment_id, order_id,
       amount, rule_id, rule_snapshot, reference_note, created_by, created_at
     )
     VALUES
       ('INC-001', 'INC-2026-0001', 'INCOME', 'PAY-001', 'ORD-001', 2500, 'rule_default_online_v1', '{"amount":2500}', 'Biaya Admin Koperasi ORD-001', 'usr-kasir-1', '${ts}'),
       ('INC-002', 'INC-2026-0002', 'INCOME', 'PAY-002', 'ORD-002', 2500, 'rule_default_online_v1', '{"amount":2500}', 'Biaya Admin Koperasi ORD-002', 'usr-kasir-1', '${ts}')`,

    // 12. Allocations
    `INSERT OR REPLACE INTO finance_allocations (
       id, payment_id, obligation_id, target_type, item_type,
       provider_id, amount, disbursed_amount, distribution_status, created_at
     )
     VALUES
       ('ALC-SPP-001', 'PAY-001', NULL, 'OBLIGATION', 'SPP', NULL, 500000, 200000, 'PARTIALLY_DISBURSED', '${ts}'),
       ('ALC-MAKAN-001', 'PAY-001', NULL, 'OBLIGATION', 'UANG_MAKAN', 'VEND-KATERING', 200000, 0, 'UNDISBURSED', '${ts}'),
       ('ALC-NYUCI-001', 'PAY-001', NULL, 'OBLIGATION', 'UANG_NYUCI', 'VEND-LAUNDRY', 100000, 0, 'UNDISBURSED', '${ts}'),
       ('ALC-SPP-002', 'PAY-002', NULL, 'OBLIGATION', 'SPP', NULL, 500000, 500000, 'DISBURSED', '${ts}'),
       ('ALC-JAJAN-003', 'PAY-003', NULL, 'UANG_JAJAN', 'UANG_JAJAN', NULL, 100000, 0, 'UNDISBURSED', '${ts}')`,

    // 13. Bank Statement & Settlements
    `INSERT OR REPLACE INTO finance_bri_statement_fetches (
       id, fetch_reference_no, account_no, from_date_time, to_date_time,
       total_items_fetched, total_credits_count, total_credits_amount,
       total_debits_count, total_debits_amount, status, body_hash, created_at
     )
     VALUES ('FETCH-001', 'FETCH-REF-001', '001901000999501', '2026-10-01T00:00:00Z', '2026-10-01T23:59:59Z', 3, 2, 652500, 1, 200000, 'SUCCESS', 'hash-fetch-001', '${ts}')`,

    `INSERT OR REPLACE INTO finance_bri_statement_transactions (
       id, fetch_id, account_no, transaction_id, identity_strength,
       dedup_key, transaction_date_raw, type_raw, type_normalized,
       amount, amount_raw, currency, remark, bri_trx_id, va_number,
       observation_count, raw_evidence_hash, match_status, matched_payment_id,
       first_seen_at, last_seen_at, raw_json, created_at
     )
     VALUES
       ('STMT-TX-001', 'FETCH-001', '001901000999501', 'TX-001', 'STRONG', 'DEDUP-001', '2026-10-01', 'CR', 'CREDIT', 502500, '502500.00', 'IDR', 'BRIVA PAYMENT PAY-002', 'BRITRX-20261001-001', '1280081234567890', 1, 'hash-stmt-001', 'UNMATCHED', NULL, '${ts}', '${ts}', '{}', '${ts}'),
       ('STMT-TX-002', 'FETCH-001', '001901000999501', 'TX-002', 'STRONG', 'DEDUP-002', '2026-10-01', 'CR', 'CREDIT', 150000, '150000.00', 'IDR', 'UNKNOWN TRANSFER', 'BRITRX-20261001-002', NULL, 1, 'hash-stmt-002', 'UNALLOCATED_RECORDED', NULL, '${ts}', '${ts}', '{}', '${ts}'),
       ('STMT-TX-003', 'FETCH-001', '001901000999501', 'TX-003', 'STRONG', 'DEDUP-003', '2026-10-01', 'DB', 'DEBIT', 200000, '200000.00', 'IDR', 'TRANSFER KAS OPERASIONAL', 'BRITRX-20261001-003', NULL, 1, 'hash-stmt-003', 'UNMATCHED', NULL, '${ts}', '${ts}', '{}', '${ts}')`,

    `INSERT OR REPLACE INTO finance_bri_settlements (
       id, settlement_number, account_no, settlement_date,
       total_payments_count, total_gross_amount, total_cooperative_admin_fee,
       total_net_amount, status, created_at
     )
     VALUES ('SETTLE-001', 'STL-20261001-001', '001901000999501', '2026-10-01', 1, 500000, 2500, 500000, 'COMPLETED', '${ts}')`,

    `INSERT OR REPLACE INTO finance_bri_settlement_items (
       id, settlement_id, payment_id, statement_transaction_id,
       gross_amount, cooperative_admin_fee, net_amount,
       match_strength, match_method, currency, settled_at, created_at
     )
     VALUES ('SETTLE-ITEM-001', 'SETTLE-001', 'PAY-002', 'STMT-TX-001', 500000, 2500, 500000, 'AUTHORITATIVE_EXACT', 'AUTO_BRIVA_EXACT', 'IDR', '${ts}', '${ts}')`,

    // Transition PAY-002 to SETTLED and update statement match
    `UPDATE finance_payments SET status = 'SETTLED' WHERE id = 'PAY-002'`,
    `UPDATE finance_bri_statement_transactions SET match_status = 'MATCHED', matched_payment_id = 'PAY-002' WHERE id = 'STMT-TX-001'`,

    // 14. Cash Session
    `INSERT OR REPLACE INTO finance_cash_sessions (
       id, session_code, operator_id, opened_at, opening_balance,
       total_cash_in, total_cash_out, expected_closing_balance, status, created_at, updated_at
     )
     VALUES ('CS-SESSION-001', 'CS-2026-10-01-A', 'usr-kasir-1', '${ts}', 1000000, 0, 200000, 800000, 'OPEN', '${ts}', '${ts}')`,

    // 15. Distributions & Items
    `INSERT OR REPLACE INTO finance_distributions (
       id, distribution_number, recipient_type, recipient_id,
       item_type, period, total_amount, method, status, cash_session_id, created_at, updated_at
     )
     VALUES
       ('DIST-CASH-001', 'DIS-2026-0001', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10', 200000, 'CASH', 'DISTRIBUTED', 'CS-SESSION-001', '${ts}', '${ts}'),
       ('DIST-CASH-002', 'DIS-2026-0002', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10', 100000, 'CASH', 'PROCESSING', 'CS-SESSION-001', '${ts}', '${ts}')`,

    `INSERT OR REPLACE INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
     VALUES
       ('DIST-ITEM-001', 'DIST-CASH-001', 'ALC-SPP-001', 200000),
       ('DIST-ITEM-002', 'DIST-CASH-002', 'ALC-SPP-001', 100000)`,

    `INSERT OR REPLACE INTO finance_distributions (
       id, distribution_number, recipient_type, recipient_id,
       item_type, period, total_amount, method, status,
       destination_bank, destination_account, account_holder_name, account_id, created_at, updated_at
     )
     VALUES
       ('DIST-MAN-001', 'DIS-2026-0003', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10', 500000, 'MANUAL_TRANSFER', 'DISTRIBUTED', 'BRI', '001901000999501', 'Yayasan Pondok Pesantren Eskahade', 'ACC-PESANTREN', '${ts}', '${ts}'),
       ('DIST-QLO-001', 'DIS-2026-0004', 'KATERING', 'rec_katering_uat', 'UANG_MAKAN', '2026-10', 100000, 'BRI_QLOLA', 'DRAFT', 'BRI', '001901000888502', 'Berkah Boga Katering CV', 'ACC-KATERING', '${ts}', '${ts}')`,

    `INSERT OR REPLACE INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
     VALUES
       ('DIST-ITEM-003', 'DIST-MAN-001', 'ALC-SPP-002', 500000),
       ('DIST-ITEM-004', 'DIST-QLO-001', 'ALC-MAKAN-001', 100000)`,

    // 16. Cash Manual Evidence
    `INSERT OR REPLACE INTO finance_cash_manual_evidence (
       id, distribution_id, evidence_type, evidence_strength, source,
       reference_number, raw_evidence_hash, observed_at, recorded_at,
       operator_id, operator_role_snapshot, receiving_person_name, notes, created_at
     )
     VALUES
       ('EVI-001', 'DIST-CASH-001', 'CASH_HANDOVER_RECEIPT', 'MANUAL_RESOLVED', 'PHYSICAL_RECEIPT', 'KWITANSI-001', 'hash-evi-001', '${ts}', '${ts}', 'usr-kasir-1', 'bendahara', 'Ust. Maimun', 'Tanda terima kas fisik', '${ts}'),
       ('EVI-002', 'DIST-MAN-001', 'MANUAL_TRANSFER_SUCCESS', 'MANUAL_RESOLVED', 'BANK_RECEIPT', 'TRX-MAN-99881', 'hash-evi-002', '${ts}', '${ts}', 'usr-kasir-1', 'bendahara', 'Pimpinan Pesantren', 'Bukti transfer manual teller', '${ts}')`,

    // 17. Reconciliation Items
    `INSERT OR REPLACE INTO finance_reconciliation_items (
       id, reconciliation_id, external_reference, internal_amount, external_amount, match_status, resolution_action, created_at
     )
     VALUES ('REC-ITEM-001', NULL, 'BRITRX-20261001-002', 0, 150000, 'UNALLOCATED_TRANSFER', 'NONE', '${ts}')`,

    // 18. QLola Transfer Intents
    `INSERT OR REPLACE INTO finance_qlola_transfer_intents (
       id, distribution_id, distribution_request_id, intent_status,
       external_id, maker_user_id, payload_hash, provider_status, error_details, created_at, updated_at
     )
     VALUES ('INTENT-QLO-001', 'DIST-QLO-001', 'REQ-QLO-001', 'CREATED', NULL, 'usr-kasir-1', 'hash-payload-qlo-001', 'DRAFT', NULL, '${ts}', '${ts}')`
  ]
}

/**
 * Seeds a deterministic set of financial UAT fixtures into the provided SQLite database connection.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} [targetDbName]
 */
function seedUatFixtures(db, targetDbName) {
  assertDemoDatabaseSafety(targetDbName)
  const ts = now()
  const futureDate = future()
  const statements = getSeedStatements(ts, futureDate)

  for (const sql of statements) {
    try {
      db.prepare(sql).run()
    } catch (err) {
      // In case table doesn't exist yet during dynamic test mocks
      if (!sql.startsWith('DELETE FROM')) {
        throw err
      }
    }
  }
}

/**
 * Generates the full executable SQL script for remote demo seeding.
 * @param {string} targetDbName
 */
function generateSeedSql(targetDbName) {
  assertDemoDatabaseSafety(targetDbName)
  const ts = now()
  const futureDate = future()
  const statements = getSeedStatements(ts, futureDate)
  return statements.join(';\n') + ';\n'
}

module.exports = {
  seedUatFixtures,
  generateSeedSql,
  assertDemoDatabaseSafety,
}
