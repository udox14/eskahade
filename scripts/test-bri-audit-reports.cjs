// scripts/test-bri-audit-reports.cjs
// Comprehensive Test Suite for BRI-7 (Reports, Cleanup, UAT & Go-Live)
// Covers: Feature Flags, Proof Storage, UAT Seeder, Audit Reporting Engine, and Automated Invariant Asserter

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { DatabaseSync } = require('node:sqlite')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')

// Setup in-memory SQLite database
const sqliteDb = new DatabaseSync(':memory:')
sqliteDb.exec('PRAGMA foreign_keys = OFF;') // Relax during dynamic test table creations

// Bridge mock for @/lib/db
const mockDb = {
  query: async (sql, params = []) => {
    return sqliteDb.prepare(sql).all(...params)
  },
  queryOne: async (sql, params = []) => {
    return sqliteDb.prepare(sql).get(...params) || null
  },
  execute: async (sql, params = []) => {
    sqliteDb.prepare(sql).run(...params)
    return { success: true }
  },
  batch: async (statements) => {
    sqliteDb.exec('BEGIN;')
    try {
      for (const { sql, params = [] } of statements) {
        sqliteDb.prepare(sql).run(...params)
      }
      sqliteDb.exec('COMMIT;')
    } catch (err) {
      sqliteDb.exec('ROLLBACK;')
      throw err
    }
  },
  generateId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
  today: () => new Date().toISOString().split('T')[0],
}

// Module interception for @/ imports and TypeScript compilation
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === '@/lib/db' || request.endsWith('/lib/db') || request.endsWith('/lib/db/index')) {
    return mockDb
  }
  if (request.startsWith('@/')) {
    request = path.join(root, request.slice(2))
  }
  return originalLoad.call(this, request, parent, isMain)
}

require.extensions['.ts'] = (mod, file) => {
  const content = fs.readFileSync(file, 'utf8')
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  return mod._compile(transpiled, file)
}

function initFullSchema() {
  sqliteDb.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, full_name TEXT, role TEXT, username TEXT);
    CREATE TABLE santri (
        id TEXT PRIMARY KEY,
        nis TEXT,
        nama TEXT,
        nama_lengkap TEXT,
        asrama TEXT,
        status TEXT DEFAULT 'AKTIF',
        status_global TEXT DEFAULT 'aktif',
        status_santri TEXT DEFAULT 'REGULER',
        kategori_santri TEXT DEFAULT 'REGULER',
        jenis_kelamin TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE master_jasa (
        id TEXT PRIMARY KEY,
        nama TEXT,
        kategori TEXT,
        status TEXT
    );
    CREATE TABLE finance_distribution_recipients (
        id TEXT PRIMARY KEY,
        recipient_type TEXT NOT NULL,
        provider_id TEXT,
        display_name TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_recipient_accounts (
        id TEXT PRIMARY KEY,
        recipient_id TEXT,
        bank_code TEXT,
        account_number TEXT,
        account_holder_name TEXT,
        is_primary INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_recipient_allowed_methods (
        id TEXT PRIMARY KEY,
        recipient_id TEXT,
        method TEXT,
        is_allowed INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_cooperative_admin_fee_rules (
        id TEXT PRIMARY KEY,
        rule_name TEXT,
        fee_amount INTEGER DEFAULT 2500,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_student_va (
        id TEXT PRIMARY KEY,
        santri_id TEXT,
        va_number TEXT UNIQUE,
        bank_code TEXT,
        status TEXT DEFAULT 'ACTIVE',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_payment_orders (
        id TEXT PRIMARY KEY,
        order_number TEXT UNIQUE,
        santri_id TEXT,
        va_number TEXT,
        total_amount INTEGER,
        status TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_cooperative_income (
        id TEXT PRIMARY KEY,
        source_type TEXT,
        source_id TEXT,
        amount INTEGER,
        recorded_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_payments (
        id TEXT PRIMARY KEY,
        payment_number TEXT,
        santri_id TEXT,
        order_id TEXT,
        method TEXT,
        channel TEXT,
        amount INTEGER,
        admin_fee INTEGER DEFAULT 0,
        total_amount INTEGER,
        status TEXT,
        allocation_status TEXT,
        cooperative_admin_fee INTEGER DEFAULT 0,
        bri_bank_fee INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_allocations (
        id TEXT PRIMARY KEY,
        payment_id TEXT,
        obligation_id TEXT,
        target_type TEXT,
        item_type TEXT,
        provider_id TEXT,
        amount INTEGER,
        disbursed_amount INTEGER DEFAULT 0,
        distribution_status TEXT DEFAULT 'UNDISBURSED',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_cash_sessions (
        id TEXT PRIMARY KEY,
        session_code TEXT UNIQUE,
        opened_by TEXT,
        status TEXT,
        opening_balance INTEGER DEFAULT 0,
        cash_in_amount INTEGER DEFAULT 0,
        cash_out_amount INTEGER DEFAULT 0,
        live_prepared_amount INTEGER DEFAULT 0,
        expected_closing_balance INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_distributions (
        id TEXT PRIMARY KEY,
        distribution_number TEXT UNIQUE,
        recipient_type TEXT,
        recipient_id TEXT,
        disbursement_method TEXT,
        total_amount INTEGER,
        status TEXT,
        cash_session_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_distribution_items (
        id TEXT PRIMARY KEY,
        distribution_id TEXT,
        allocation_id TEXT,
        amount INTEGER
    );
    CREATE TABLE finance_cash_manual_evidence (
        id TEXT PRIMARY KEY,
        distribution_id TEXT,
        evidence_type TEXT,
        evidence_strength TEXT,
        source TEXT,
        reference_number TEXT,
        raw_evidence_hash TEXT,
        observed_at TEXT,
        recorded_at TEXT,
        operator_id TEXT,
        operator_role_snapshot TEXT,
        receiving_person_name TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_bri_statement_fetches (
        id TEXT PRIMARY KEY,
        account_no TEXT,
        start_date TEXT,
        end_date TEXT,
        total_records INTEGER,
        status TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_bri_statement_transactions (
        id TEXT PRIMARY KEY,
        fetch_id TEXT,
        bri_trx_id TEXT,
        account_no TEXT,
        amount INTEGER,
        type_normalized TEXT,
        description TEXT,
        settlement_status TEXT,
        raw_evidence_hash TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_bri_settlements (
        id TEXT PRIMARY KEY,
        settlement_number TEXT,
        statement_fetch_id TEXT,
        total_amount INTEGER,
        total_count INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_bri_settlement_items (
        id TEXT PRIMARY KEY,
        settlement_id TEXT,
        payment_id TEXT,
        statement_transaction_id TEXT,
        matched_amount INTEGER,
        match_rule TEXT,
        match_strength TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_reconciliation_items (
        id TEXT PRIMARY KEY,
        reconciliation_id TEXT,
        external_reference TEXT,
        internal_amount INTEGER DEFAULT 0,
        external_amount INTEGER DEFAULT 0,
        match_status TEXT,
        resolution_action TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_qlola_transfer_intents (
        id TEXT PRIMARY KEY,
        distribution_id TEXT,
        intent_state TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

async function runTests() {
  console.log('--- STARTING BRI-7 COMPREHENSIVE TEST SUITE ---')

  // 1. Initialize schema
  initFullSchema()

  // Import services under test
  const {
    getBriFeatureFlags,
    assertBriCoreEnabled,
    assertBrivaInboundEnabled,
    assertDistributionMethodEnabled,
    QLOLA_H2H_CONTRACT_STATE,
    QLOLA_REAL_SUBMISSION_STATE,
  } = require('../lib/finance/bri/feature-flags.ts')

  const { proofStorageService } = require('../lib/finance/bri/proof-storage-service.ts')
  const { auditReportService } = require('../lib/finance/bri/audit-report-service.ts')
  const { seedUatFixtures } = require('./seed-uat-fixtures.cjs')

  // TEST 1: Feature Flags Fail-Closed Matrix
  console.log('Test 1: Feature Flags Fail-Closed Defaults')
  const defaultFlags = getBriFeatureFlags({})
  assert.equal(defaultFlags.briCoreEnabled, false, 'briCoreEnabled must default to false')
  assert.equal(defaultFlags.distributionQlolaEnabled, false, 'distributionQlolaEnabled must strictly be false')
  assert.equal(QLOLA_H2H_CONTRACT_STATE, 'QLOLA_H2H_CONTRACT_TBD')
  assert.equal(QLOLA_REAL_SUBMISSION_STATE, 'DISABLED')

  assert.throws(
    () => assertBriCoreEnabled({}),
    /Operational Kill Switch/i,
    'assertBriCoreEnabled must throw when disabled'
  )

  assert.throws(
    () => assertDistributionMethodEnabled('BRI_QLOLA', {}),
    /QLOLA_INTEGRATION_DISABLED/i,
    'assertDistributionMethodEnabled must throw for BRI_QLOLA'
  )
  console.log('✓ Test 1 Passed: Feature flags are strictly fail-closed')

  // TEST 2: Proof Storage Service Integrity & RBAC
  console.log('Test 2: Proof Storage Validation, Magic Bytes & RBAC')
  // Corrupted / fake JPEG (magic bytes mismatch)
  const fakeJpg = Buffer.from('NOT_A_REAL_JPEG_IMAGE_DATA')
  const fakeVal = proofStorageService.validateProofInput({
    buffer: fakeJpg,
    mimeType: 'image/jpeg',
    originalFilename: 'fake.jpg',
    sizeBytes: fakeJpg.length,
  })
  assert.equal(fakeVal.valid, false, 'Must reject mismatched magic bytes')
  assert.match(fakeVal.error, /MAGIC_BYTES_MISMATCH/i)

  // Real JPEG magic bytes: FF D8 FF
  const validJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
  const validRes = await proofStorageService.storeFinancialProof({
    buffer: validJpg,
    mimeType: 'image/jpeg',
    originalFilename: 'kwitansi.jpg',
    operatorId: 'op-1',
    operatorRole: 'bendahara',
  })
  assert.equal(validRes.success, true, 'Store proof should succeed')
  assert.equal(validRes.storageMode, 'REFERENCE_FALLBACK', 'Fallback mode used when R2 absent')
  assert.ok(validRes.hash.length === 64, 'SHA-256 hash generated')

  // RBAC retrieval rejection
  const getForbidden = await proofStorageService.getFinancialProof({
    objectKey: validRes.objectKey,
    operatorId: 'wali-1',
    operatorRole: 'wali',
  })
  assert.equal(getForbidden.success, false)
  assert.match(getForbidden.error, /UNAUTHORIZED_ACCESS/i)
  console.log('✓ Test 2 Passed: Proof storage security & RBAC validated')

  // TEST 3: Seed UAT Fixtures
  console.log('Test 3: Seeding UAT Fixtures')
  seedUatFixtures(sqliteDb)
  console.log('✓ Test 3 Passed: Fixtures populated deterministically')

  // TEST 4: Collection Audit Summary
  console.log('Test 4: Collection Audit Summary')
  const collectionSummary = await auditReportService.getCollectionAuditSummary()
  assert.equal(collectionSummary.totalPaymentsCount, 3)
  assert.equal(collectionSummary.totalPaymentsAmount, 1400000) // 800k + 500k + 100k
  assert.equal(collectionSummary.paidPaymentsCount, 3) // 2 PAID + 1 SETTLED
  assert.equal(collectionSummary.settledPaymentsCount, 1) // PAY-002
  assert.equal(collectionSummary.unsettledPaymentsCount, 2) // PAY-001 + PAY-003
  assert.equal(collectionSummary.cooperativeAdminFeeTotal, 5000) // 2500 + 2500
  assert.equal(collectionSummary.briBankFeeTotal, 2000) // 1000 + 1000
  assert.equal(collectionSummary.uangJajanTopupsCount, 1)
  assert.equal(collectionSummary.uangJajanTopupsAmount, 100000)
  assert.equal(collectionSummary.billableSantriStats.totalSantri, 3)
  assert.equal(collectionSummary.billableSantriStats.alBaghoryExemptCount, 1)
  assert.equal(collectionSummary.billableSantriStats.sadesaExemptPartialCount, 1)
  console.log('✓ Test 4 Passed: Collection metrics match authoritative ground truth')

  // TEST 5: Accounting Audit Summary
  console.log('Test 5: Accounting Audit Summary')
  const acctSummary = await auditReportService.getAccountingAuditSummary()
  assert.equal(acctSummary.pesantrenTotal, 1000000) // 500k + 500k
  assert.equal(acctSummary.kateringTotal, 200000)
  assert.equal(acctSummary.laundryTotal, 100000)
  assert.equal(acctSummary.uangJajanTitipanTotal, 100000) // Strictly Titipan Santri
  assert.equal(acctSummary.cooperativeIncomeTotal, 5000)
  console.log('✓ Test 5 Passed: Accounting entitlement breakdown verified')

  // TEST 6: Distribution Audit Summary & Cash Desk Liquidity
  console.log('Test 6: Distribution Audit Summary')
  const distSummary = await auditReportService.getDistributionAuditSummary()
  assert.equal(distSummary.byMethod.CASH.count, 2)
  assert.equal(distSummary.byMethod.CASH.distributedAmount, 200000)
  assert.equal(distSummary.byMethod.CASH.reservedAmount, 100000)
  assert.equal(distSummary.byMethod.MANUAL_TRANSFER.distributedAmount, 500000)
  assert.equal(distSummary.byMethod.BRI_QLOLA.count, 1)
  assert.equal(distSummary.byMethod.BRI_QLOLA.distributedAmount, 0) // DRAFT
  assert.equal(distSummary.totalCommittedDistributed, 700000) // 200k cash + 500k manual
  assert.equal(distSummary.physicalCashDesk.totalCashDistributed, 200000)
  assert.equal(distSummary.physicalCashDesk.totalLivePreparedCash, 100000)
  assert.equal(distSummary.physicalCashDesk.authoritativeCashAvailable, 800000) // 1m - 200k
  console.log('✓ Test 6 Passed: Cross-method distribution and cash liquidity audited')

  // TEST 7: Reconciliation Audit Summary
  console.log('Test 7: Reconciliation Audit Summary')
  const recSummary = await auditReportService.getReconciliationAuditSummary()
  assert.equal(recSummary.bankStatement.totalTransactions, 3)
  assert.equal(recSummary.bankStatement.settledCount, 1)
  assert.equal(recSummary.bankStatement.unallocatedCreditCount, 1)
  assert.equal(recSummary.bankStatement.unallocatedCreditAmount, 150000)
  assert.equal(recSummary.evidenceStrengthCounts.manualResolvedCount, 2)
  assert.equal(recSummary.recoveryQueue.pendingCount, 1)
  console.log('✓ Test 7 Passed: Reconciliation audit metrics verified')

  // TEST 8: Automated Invariant Verifier Baseline
  console.log('Test 8: Baseline Invariant Check')
  const baselineInvariants = await auditReportService.verifyFinancialReportInvariants()
  assert.equal(baselineInvariants.isConsistent, true, 'Seeded state must have 0 invariant violations')
  assert.equal(baselineInvariants.violations.length, 0)
  console.log('✓ Test 8 Passed: Zero violations on valid state')

  // TEST 9: Invariant Chaos Injection - Over-Distribution
  console.log('Test 9: Invariant Chaos Injection - Over-Distribution')
  sqliteDb.prepare(`
    INSERT INTO finance_distributions (id, distribution_number, recipient_type, recipient_id, disbursement_method, total_amount, status)
    VALUES ('DIST-CHAOS-OVER', 'DIS-CHAOS-01', 'PESANTREN', 'REC-PESANTREN', 'CASH', 9999999, 'PROCESSING')
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('ITEM-CHAOS-OVER', 'DIST-CHAOS-OVER', 'ALC-SPP-001', 9999999)
  `).run()

  const chaos1 = await auditReportService.verifyFinancialReportInvariants()
  assert.equal(chaos1.isConsistent, false)
  assert.ok(chaos1.violations.some(v => v.code === 'OVER_DISTRIBUTION_DETECTED'))
  console.log('✓ Test 9 Passed: Over-distribution accurately detected')

  // Revert Chaos 1
  sqliteDb.prepare(`DELETE FROM finance_distribution_items WHERE id = 'ITEM-CHAOS-OVER'`).run()
  sqliteDb.prepare(`DELETE FROM finance_distributions WHERE id = 'DIST-CHAOS-OVER'`).run()

  // TEST 10: Invariant Chaos Injection - Double Allocation
  console.log('Test 10: Invariant Chaos Injection - Over-Allocation')
  sqliteDb.prepare(`
    INSERT INTO finance_allocations (id, payment_id, target_type, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('ALC-CHAOS-OVER', 'PAY-003', 'UANG_JAJAN', 'UANG_JAJAN', 9999999, 0, 'UNDISBURSED')
  `).run()
  const chaos2 = await auditReportService.verifyFinancialReportInvariants()
  assert.equal(chaos2.isConsistent, false)
  assert.ok(chaos2.violations.some(v => v.code === 'OVER_ALLOCATION_DETECTED'))
  console.log('✓ Test 10 Passed: Over-allocation accurately detected')

  // Revert Chaos 2
  sqliteDb.prepare(`DELETE FROM finance_allocations WHERE id = 'ALC-CHAOS-OVER'`).run()

  // TEST 11: Invariant Chaos Injection - Unlinked SETTLED Payment
  console.log('Test 11: Invariant Chaos Injection - Unlinked SETTLED Payment')
  sqliteDb.prepare(`
    INSERT INTO finance_payments (id, payment_number, santri_id, method, channel, amount, total_amount, status, allocation_status)
    VALUES ('PAY-CHAOS-SETTLED', 'PAY-CHAOS-001', 'SAN-BILLABLE-001', 'BRIVA', 'BRIVA_ONLINE', 100000, 100000, 'SETTLED', 'UNALLOCATED')
  `).run()
  const chaos3 = await auditReportService.verifyFinancialReportInvariants()
  assert.equal(chaos3.isConsistent, false)
  assert.ok(chaos3.violations.some(v => v.code === 'UNLINKED_SETTLED_PAYMENT'))
  console.log('✓ Test 11 Passed: Unlinked SETTLED payment violation accurately detected')

  // Revert Chaos 3
  sqliteDb.prepare(`DELETE FROM finance_payments WHERE id = 'PAY-CHAOS-SETTLED'`).run()

  // TEST 12: Invariant Chaos Injection - Leaked Uang Jajan Distribution
  console.log('Test 12: Invariant Chaos Injection - Leaked Uang Jajan Distribution')
  sqliteDb.prepare(`
    INSERT INTO finance_distributions (id, distribution_number, recipient_type, recipient_id, disbursement_method, total_amount, status)
    VALUES ('DIST-CHAOS-JAJAN', 'DIS-CHAOS-02', 'PESANTREN', 'REC-PESANTREN', 'CASH', 50000, 'PROCESSING')
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('ITEM-CHAOS-JAJAN', 'DIST-CHAOS-JAJAN', 'ALC-JAJAN-003', 50000)
  `).run()
  const chaos4 = await auditReportService.verifyFinancialReportInvariants()
  assert.equal(chaos4.isConsistent, false)
  assert.ok(chaos4.violations.some(v => v.code === 'UANG_JAJAN_DISTRIBUTION_LEAK'))
  console.log('✓ Test 12 Passed: Leaked Uang Jajan accurately detected')

  // Revert Chaos 4
  sqliteDb.prepare(`DELETE FROM finance_distribution_items WHERE id = 'ITEM-CHAOS-JAJAN'`).run()
  sqliteDb.prepare(`DELETE FROM finance_distributions WHERE id = 'DIST-CHAOS-JAJAN'`).run()

  // TEST 13: Invariant Chaos Injection - Cash Session Over-Reservation
  console.log('Test 13: Invariant Chaos Injection - Cash Session Over-Reservation')
  sqliteDb.prepare(`
    UPDATE finance_cash_sessions
    SET live_prepared_amount = 9999999
    WHERE id = 'CS-SESSION-001'
  `).run()
  const chaos5 = await auditReportService.verifyFinancialReportInvariants()
  assert.equal(chaos5.isConsistent, false)
  assert.ok(chaos5.violations.some(v => v.code === 'CASH_SESSION_OVER_RESERVED'))
  console.log('✓ Test 13 Passed: Cash session over-reservation accurately detected')

  // Revert Chaos 5
  sqliteDb.prepare(`
    UPDATE finance_cash_sessions
    SET live_prepared_amount = 100000
    WHERE id = 'CS-SESSION-001'
  `).run()

  // TEST 14: Invariant Chaos Injection - Active Duitku Payment
  console.log('Test 14: Invariant Chaos Injection - Active Duitku Payment')
  sqliteDb.prepare(`
    INSERT INTO finance_payments (id, payment_number, santri_id, method, channel, amount, total_amount, status, allocation_status)
    VALUES ('PAY-CHAOS-DUITKU', 'PAY-DUITKU-001', 'SAN-BILLABLE-001', 'DUITKU_VA', 'DUITKU', 50000, 50000, 'PAID', 'UNALLOCATED')
  `).run()
  const chaos6 = await auditReportService.verifyFinancialReportInvariants()
  assert.equal(chaos6.isConsistent, false)
  assert.ok(chaos6.violations.some(v => v.code === 'ACTIVE_DUITKU_PAYMENT_FOUND'))
  console.log('✓ Test 14 Passed: Active Duitku payment accurately detected')

  // Revert Chaos 6
  sqliteDb.prepare(`DELETE FROM finance_payments WHERE id = 'PAY-CHAOS-DUITKU'`).run()

  // TEST 15: Operational Entrypoint Feature Flag Enforcement
  console.log('Test 15: Operational Entrypoint Feature Flag Enforcement')
  const { cashManualDistributionService } = require('../lib/finance/bri/cash-manual-distribution-service.ts')
  const { assertBankStatementSyncEnabled } = require('../lib/finance/bri/feature-flags.ts')

  // 15.1 CASH entrypoint disabled
  process.env.BRI_DIST_CASH_ENABLED = 'false'
  await assert.rejects(
    async () => {
      await cashManualDistributionService.prepareCashDistribution({
        distributionId: 'DIST-CASH-001',
        operatorId: 'usr-kasir-1',
        operatorRole: 'bendahara',
      })
    },
    /Metode penyaluran tunai \(CASH\) sedang dinonaktifkan/i,
    'CASH prepare must be blocked when flag is false'
  )
  delete process.env.BRI_DIST_CASH_ENABLED

  // 15.2 MANUAL_TRANSFER entrypoint disabled
  process.env.BRI_DIST_MANUAL_ENABLED = 'false'
  await assert.rejects(
    async () => {
      await cashManualDistributionService.initiateManualTransfer({
        distributionId: 'DIST-MAN-001',
        operatorId: 'usr-kasir-1',
        operatorRole: 'bendahara',
      })
    },
    /Metode penyaluran transfer manual \(MANUAL_TRANSFER\) sedang dinonaktifkan/i,
    'MANUAL_TRANSFER initiate must be blocked when flag is false'
  )
  delete process.env.BRI_DIST_MANUAL_ENABLED

  // 15.3 Statement sync disabled
  assert.throws(
    () => assertBankStatementSyncEnabled({ BRI_STATEMENT_SYNC_ENABLED: 'false' }),
    /Sinkronisasi otomatis Rekening Koran BRI sedang dinonaktifkan/i,
    'Statement sync must be blocked when flag is false'
  )

  // 15.4 Inbound webhook disabled
  assert.throws(
    () => assertBrivaInboundEnabled({ BRI_BRIVA_INBOUND_ENABLED: 'false' }),
    /Penerimaan callback webhook BRIVA sedang dinonaktifkan/i,
    'Inbound webhook callback must be blocked when flag is false'
  )
  console.log('✓ Test 15 Passed: Server-side entrypoint feature flag enforcement verified')

  // TEST 16: RBAC Role Drift Audit & Production R2 Fail-Closed
  console.log('Test 16: RBAC Role Drift Audit & Production R2 Fail-Closed')
  // 16.1 superadmin role must NOT be authorized (it is not an authoritative Eskahade role)
  const superadminAccess = await proofStorageService.getFinancialProof({
    objectKey: 'proofs/financial/test.jpg',
    operatorId: 'fake-superadmin',
    operatorRole: 'superadmin',
  })
  assert.equal(superadminAccess.success, false)
  assert.match(superadminAccess.error, /UNAUTHORIZED_ACCESS/i)

  // 16.2 pimpinan is read-only and must be rejected from mutating/finalizing distribution
  await assert.rejects(
    async () => {
      await cashManualDistributionService.prepareCashDistribution({
        distributionId: 'DIST-CASH-001',
        operatorId: 'usr-pimpinan-1',
        operatorRole: 'pimpinan',
      })
    },
    /Role "pimpinan" bersifat read-only/i,
    'pimpinan must not have mutation permissions'
  )

  // 16.3 Production proof storage without R2 binding must FAIL CLOSED (no fallback allowed)
  process.env.BRI_ENV = 'production'
  const prodProofResult = await proofStorageService.storeFinancialProof({
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
    mimeType: 'image/jpeg',
    originalFilename: 'prod_kwitansi.jpg',
    operatorId: 'usr-kasir-1',
    operatorRole: 'bendahara',
  })
  assert.equal(prodProofResult.success, false, 'Production store proof must fail closed without R2')
  assert.match(prodProofResult.error, /R2_BUCKET_UNAVAILABLE.*lingkungan produksi/i)
  delete process.env.BRI_ENV
  console.log('✓ Test 16 Passed: RBAC drift eliminated and production R2 fail-closed verified')

  // Final Invariant Check
  const finalCheck = await auditReportService.verifyFinancialReportInvariants()
  assert.equal(finalCheck.isConsistent, true, 'System must be consistent after reverting all chaos tests')

  console.log('\n======================================================')
  console.log('ALL 16 BRI-7 AUDIT & INVARIANT TESTS PASSED PERFECTLY!')
  console.log('======================================================')
}

runTests().catch(err => {
  console.error('\nFAILED TEST IN BRI-7 SUITE:', err)
  process.exit(1)
})
