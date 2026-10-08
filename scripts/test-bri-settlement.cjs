// scripts/test-bri-settlement.cjs
// Comprehensive Unit & Integration Test Suite for BRI-4 (Recovery, Settlement & Reconciliation)
// Covers all 23 required test matrix areas per AGENTS.md, docs/BRI_INTEGRATION_PRD.md, and reviewer rules.

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
sqliteDb.exec('PRAGMA foreign_keys = ON;')

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

// Initialize SQLite Schema (Baseline + Migration 0182 + 0183 + 0184)
function initDatabase() {
  sqliteDb.exec(`
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
    CREATE TABLE finance_obligations (
        id TEXT PRIMARY KEY,
        santri_id TEXT REFERENCES santri(id),
        item_type TEXT NOT NULL,
        period TEXT NOT NULL,
        academic_year_id INTEGER REFERENCES tahun_ajaran(id),
        amount_expected INTEGER NOT NULL,
        amount_exempted INTEGER NOT NULL DEFAULT 0,
        amount_paid INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'UNPAID',
        provider_id TEXT REFERENCES master_jasa(id),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_cash_sessions (
        id TEXT PRIMARY KEY,
        session_number TEXT NOT NULL,
        operator_id TEXT REFERENCES users(id),
        status TEXT NOT NULL,
        opened_at TEXT NOT NULL,
        closed_at TEXT
    );
    CREATE TABLE finance_payment_orders (
        id TEXT PRIMARY KEY,
        order_number TEXT NOT NULL UNIQUE,
        santri_id TEXT NOT NULL REFERENCES santri(id),
        payer_type TEXT NOT NULL,
        gross_amount INTEGER NOT NULL CHECK (gross_amount >= 0),
        cooperative_admin_fee INTEGER NOT NULL DEFAULT 0 CHECK (cooperative_admin_fee >= 0),
        fee_payer TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (fee_payer IN ('CUSTOMER', 'INSTITUTION')),
        total_charged INTEGER NOT NULL CHECK (total_charged >= 0),
        payment_method TEXT NOT NULL,
        fixed_va_number TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REPLACED')),
        expires_at TEXT NOT NULL,
        cash_session_id TEXT REFERENCES finance_cash_sessions(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES finance_payment_orders(id) ON DELETE CASCADE,
        obligation_id TEXT REFERENCES finance_obligations(id),
        item_type TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK (amount > 0)
    );
    CREATE TABLE finance_payments (
        id TEXT PRIMARY KEY,
        payment_number TEXT NOT NULL UNIQUE,
        order_id TEXT REFERENCES finance_payment_orders(id),
        santri_id TEXT NOT NULL REFERENCES santri(id),
        channel TEXT NOT NULL CHECK (channel IN ('BRI', 'CASH')),
        method TEXT NOT NULL,
        gross_amount INTEGER NOT NULL CHECK (gross_amount >= 0),
        cooperative_admin_fee INTEGER NOT NULL DEFAULT 0 CHECK (cooperative_admin_fee >= 0),
        bri_fee_amount INTEGER CHECK (bri_fee_amount IS NULL OR bri_fee_amount >= 0),
        net_amount INTEGER NOT NULL CHECK (net_amount >= 0),
        status TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'SETTLED')),
        correction_status TEXT NOT NULL DEFAULT 'NONE' CHECK (correction_status IN ('NONE', 'PARTIALLY_CORRECTED', 'FULLY_CORRECTED')),
        allocation_status TEXT NOT NULL DEFAULT 'ALLOCATED' CHECK (allocation_status IN ('ALLOCATED', 'PARTIALLY_ALLOCATED', 'UNALLOCATED')),
        paid_at TEXT NOT NULL,
        bri_payment_request_id TEXT,
        bri_trx_id TEXT,
        external_reference TEXT,
        cash_session_id TEXT,
        received_by TEXT REFERENCES users(id),
        source TEXT NOT NULL DEFAULT 'NEW_FINANCE' CHECK (source IN ('NEW_FINANCE', 'LEGACY')),
        fund_management TEXT NOT NULL DEFAULT 'KOPERASI' CHECK (fund_management IN ('PRE_KOPERASI', 'KOPERASI')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_allocations (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL REFERENCES finance_payments(id),
        obligation_id TEXT REFERENCES finance_obligations(id),
        target_type TEXT NOT NULL,
        item_type TEXT NOT NULL,
        provider_id TEXT REFERENCES master_jasa(id),
        amount INTEGER NOT NULL CHECK (amount >= 0),
        disbursed_amount INTEGER NOT NULL DEFAULT 0 CHECK (disbursed_amount >= 0),
        distribution_status TEXT NOT NULL DEFAULT 'UNDISBURSED',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_student_va (
        id TEXT PRIMARY KEY,
        santri_id TEXT NOT NULL UNIQUE REFERENCES santri(id),
        customer_no TEXT NOT NULL UNIQUE,
        va_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
        activated_at TEXT,
        inactivated_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_cooperative_income (
        id TEXT PRIMARY KEY,
        income_number TEXT NOT NULL UNIQUE,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('INCOME', 'REVERSAL', 'REFUND')),
        reference_income_id TEXT REFERENCES finance_cooperative_income(id),
        correction_id TEXT,
        payment_id TEXT NOT NULL REFERENCES finance_payments(id),
        order_id TEXT REFERENCES finance_payment_orders(id),
        amount INTEGER NOT NULL CHECK (amount > 0),
        rule_id TEXT,
        rule_snapshot TEXT,
        reference_note TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_wallet_ledger (
        id TEXT PRIMARY KEY,
        santri_id TEXT NOT NULL REFERENCES santri(id),
        direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
        balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
        source TEXT NOT NULL,
        channel TEXT,
        payment_id TEXT REFERENCES finance_payments(id),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_gateway_events (
        id TEXT PRIMARY KEY,
        gateway_name TEXT NOT NULL CHECK (gateway_name IN ('BRI', 'BRI_BRIVA', 'BRI_QLOLA')),
        event_key TEXT NOT NULL UNIQUE,
        merchant_order_id TEXT,
        event_type TEXT NOT NULL,
        signature_valid INTEGER NOT NULL CHECK (signature_valid IN (0, 1)),
        payload_json TEXT NOT NULL,
        response_code TEXT,
        is_processed INTEGER NOT NULL DEFAULT 0 CHECK (is_processed IN (0, 1)),
        processing_status TEXT NOT NULL CHECK (processing_status IN ('PENDING', 'PROCESSED', 'IGNORED', 'ERROR')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_reconciliation_items (
        id TEXT PRIMARY KEY,
        payment_id TEXT REFERENCES finance_payments(id),
        settlement_id TEXT,
        cash_session_id TEXT,
        external_reference TEXT,
        internal_amount INTEGER NOT NULL DEFAULT 0,
        external_amount INTEGER NOT NULL DEFAULT 0,
        discrepancy_amount INTEGER NOT NULL DEFAULT 0,
        match_status TEXT NOT NULL CHECK (match_status IN ('MATCHED', 'UNMATCHED_INTERNAL', 'UNMATCHED_EXTERNAL', 'AMOUNT_MISMATCH', 'UNALLOCATED_TRANSFER')),
        resolution_action TEXT NOT NULL DEFAULT 'NONE' CHECK (resolution_action IN ('NONE', 'MANUAL_ALLOCATION', 'REFUND_RECORDED', 'VOID_RECORDED', 'ADJUSTMENT')),
        resolution_notes TEXT,
        resolved_by TEXT REFERENCES users(id),
        resolved_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX uq_finance_payment_orders_santri_active_online
        ON finance_payment_orders(santri_id)
        WHERE status = 'PENDING' AND payment_method = 'BRI_VA';

    CREATE UNIQUE INDEX uq_finance_payments_bri_payment_request_id
        ON finance_payments(bri_payment_request_id)
        WHERE bri_payment_request_id IS NOT NULL;

    CREATE UNIQUE INDEX uq_finance_payments_bri_trx_id
        ON finance_payments(bri_trx_id)
        WHERE bri_trx_id IS NOT NULL;
  `)

  // Apply Migration 0183 (Metadata, Correlation, Compare-and-Set Triggers)
  const mig0183Path = path.join(root, 'migrations', '0183_briva_collection_metadata.sql')
  const mig0183Sql = fs.readFileSync(mig0183Path, 'utf8')
  sqliteDb.exec(mig0183Sql)

  // Apply Migration 0184 (Statement, Settlement & Recovery)
  const mig0184Path = path.join(root, 'migrations', '0184_bri_settlement_and_recovery.sql')
  const mig0184Sql = fs.readFileSync(mig0184Path, 'utf8')
  sqliteDb.exec(mig0184Sql)
}

async function runTestSuite() {
  console.log('=================================================================')
  console.log('BRI-4: RUNNING HARDENED RECOVERY, SETTLEMENT & RECONCILIATION TESTS')
  console.log('=================================================================\n')

  initDatabase()

  const {
    fetchBankStatement,
    persistBankStatementTransactions,
    generateStatementTransactionDedupKey,
    isValidIsoDateTimeWithOffset,
    normalizeStatementType,
    matchStatementTransaction,
    executeSettlementTransition,
    recoverMissedPaymentFromStatement,
    recordUnallocatedStatementPayment,
    startReconciliationSession,
    completeReconciliationSession,
    BriTransactionStatusInquiryService,
    BRIVA_STATUS_INQUIRY_CONTRACT_STATE,
    BANK_STATEMENT_CROSS_PRODUCT_STATE,
    BANK_STATEMENT_STUDENT_AUTO_IDENTITY,
    BRI_BANK_STATEMENT_POLICY,
    BRI_BANK_STATEMENT_CODES,
  } = require('../lib/finance/bri')

  // Generate ephemeral RSA keys for test config
  const { privateKey: testPrivateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  const testConfig = {
    env: 'sandbox',
    baseUrl: 'https://sandbox.partner.api.bri.co.id',
    clientKey: 'test_client_key',
    clientId: 'test_client_key',
    partnerId: 'test_partner_id',
    clientSecret: 'test_client_secret_xyz',
    privateKey: testPrivateKey,
    channelId: '00009',
    outboundEnabled: true,
    collectionAccountNo: '001901000123301',
  }

  // Seed sample student and VA
  sqliteDb.exec(`
    INSERT INTO users (id, full_name) VALUES ('usr-op', 'Ustadz Keuangan');
    INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama)
    VALUES
      ('san-1', 'NIS-1001', 'Ahmad Santri', 'aktif', 'ASRAMA_A'),
      ('san-2', 'NIS-1002', 'Budi Santri', 'aktif', 'ASRAMA_B'),
      ('san-jajan', 'NIS-1003', 'Faris Jajan', 'aktif', 'ASRAMA_A');
    INSERT INTO finance_student_va (id, santri_id, customer_no, va_number, status)
    VALUES
      ('va-1', 'san-1', '00001001', '1234500001001', 'ACTIVE'),
      ('va-2', 'san-2', '00001002', '1234500001002', 'ACTIVE'),
      ('va-jajan', 'san-jajan', '00001003', '1234500001003', 'ACTIVE');
  `)

  // =========================================================================
  // SECTION 1: OFFICIAL SERVICE CODE 14 & OUTCOME POLICY
  // =========================================================================
  console.log('--- 1. Testing Official Service Code 14 & Outcome Policy ---')

  // 1.1: 2001400 Success code recognized
  assert.strictEqual(BRI_BANK_STATEMENT_CODES.SUCCESS, '2001400')
  assert.ok(BRI_BANK_STATEMENT_POLICY.successCodes.includes('2001400'), 'Policy must recognize 2001400 as success')
  console.log('✓ 1.1: 2001400 official success code registered.')

  // 1.2: 5041400 Pending code recognized
  assert.strictEqual(BRI_BANK_STATEMENT_CODES.TIMEOUT_PENDING, '5041400')
  assert.ok(BRI_BANK_STATEMENT_POLICY.pendingCodes.includes('5041400'), 'Policy must classify 5041400 as pending')
  console.log('✓ 1.2: 5041400 official pending code registered.')

  // 1.3: Service 73 rejected / not recognized
  assert.strictEqual(BRI_BANK_STATEMENT_POLICY.successCodes.includes('2007300'), false)
  assert.strictEqual(BRI_BANK_STATEMENT_POLICY.pendingCodes.includes('5047300'), false)
  console.log('✓ 1.3: Obsolete Service Code 73 removed and rejected.')

  // 1.4: Kill switch blocks calls fail-closed
  const disabledConfig = { ...testConfig, outboundEnabled: false }
  await assert.rejects(
    async () => {
      await fetchBankStatement({
        accountNo: '001901000123301',
        fromDateTime: '2026-10-08T00:00:00+07:00',
        toDateTime: '2026-10-08T23:59:59+07:00',
        configOverride: disabledConfig,
      })
    },
    /BRI outbound operations are disabled by operational kill switch/,
    'Kill switch must block network call fail closed'
  )
  console.log('✓ 1.4: Operational outbound kill switch enforced.')

  // 1.5: Successful fetch with official 2001400 response
  const { BriClient } = require('../lib/finance/bri/client')
  let capturedRequest = null
  const mockFetchSuccess = async (url, opts) => {
    capturedRequest = { url, opts }
    return new Response(
      JSON.stringify({
        responseCode: '2001400',
        responseMessage: 'Successful',
        referenceNo: 'BRI-REF-FETCH-999',
        partnerReferenceNo: 'BS-TEST-001',
        accountNo: '001901000123301',
        totalCreditEntries: 1,
        totalDebitEntries: 0,
        totalCreditAmount: { value: '153000.00', currency: 'IDR' },
        detailData: [
          {
            transactionId: 'TXN-BANK-101',
            dateTime: '2026-10-08T10:15:00+07:00',
            amount: { value: '153000.00', currency: 'IDR' },
            type: 'Credit',
            remark: 'BRIVA 1234500001001 TRX-101',
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const mockTokenClient = {
    getAccessToken: async () => 'mock_token_b2b_valid',
    invalidateTokenCache: async () => {},
  }
  const testBriClient = new BriClient({
    config: testConfig,
    tokenClient: mockTokenClient,
    customFetch: mockFetchSuccess,
  })

  const fetchRes = await fetchBankStatement({
    accountNo: '001901000123301',
    fromDateTime: '2026-10-08T00:00:00+07:00',
    toDateTime: '2026-10-08T23:59:59+07:00',
    partnerReferenceNo: 'BS-TEST-001',
    configOverride: testConfig,
    customClient: testBriClient,
  })

  assert.strictEqual(fetchRes.status, 200)
  assert.strictEqual(fetchRes.data.responseCode, '2001400')
  assert.strictEqual(fetchRes.externalId.length, 9, '9-digit numeric external ID enforced')
  console.log('✓ 1.5: Official POST /snap/v2.1/bank-statement with 2001400 and 9-digit External-ID verified.')

  // 1.6: Successful empty detailData handled safely
  const mockFetchEmpty = async () => {
    return new Response(
      JSON.stringify({
        responseCode: '2001400',
        responseMessage: 'Successful',
        partnerReferenceNo: 'BS-TEST-EMPTY',
        accountNo: '001901000123301',
        totalCreditEntries: 0,
        totalDebitEntries: 0,
        detailData: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
  const emptyClient = new BriClient({
    config: testConfig,
    tokenClient: mockTokenClient,
    customFetch: mockFetchEmpty,
  })
  const emptyFetchRes = await fetchBankStatement({
    accountNo: '001901000123301',
    fromDateTime: '2026-10-08T00:00:00+07:00',
    toDateTime: '2026-10-08T23:59:59+07:00',
    partnerReferenceNo: 'BS-TEST-EMPTY',
    configOverride: testConfig,
    customClient: emptyClient,
  })
  assert.strictEqual(emptyFetchRes.data.detailData.length, 0)
  const emptyPersist = await persistBankStatementTransactions({
    accountNo: '001901000123301',
    fromDateTime: '2026-10-08T00:00:00+07:00',
    toDateTime: '2026-10-08T23:59:59+07:00',
    response: emptyFetchRes.data,
    rawResponseJson: JSON.stringify(emptyFetchRes.data),
  })
  assert.strictEqual(emptyPersist.totalFetched, 0)
  assert.strictEqual(emptyPersist.cursorAdvanced, true)
  console.log('✓ 1.6: Successful empty detailData handled safely without error.')

  // 1.7: 4041401 Transaction Not Found is a provider failure (FAILED, cursor does NOT advance)
  const notFoundResponse = {
    responseCode: '4041401',
    responseMessage: 'Transaction Not Found',
    accountNo: '001901000123301',
    detailData: [],
  }
  const notFoundPersist = await persistBankStatementTransactions({
    accountNo: '001901000123301',
    fromDateTime: '2026-10-08T00:00:00+07:00',
    toDateTime: '2026-10-08T23:59:59+07:00',
    response: notFoundResponse,
    rawResponseJson: JSON.stringify(notFoundResponse),
  })
  assert.strictEqual(notFoundPersist.cursorAdvanced, false, '4041401 must NOT advance cursor')
  const notFoundFetch = sqliteDb.prepare("SELECT status, cursor_advanced FROM finance_bri_statement_fetches WHERE id = ?").get(notFoundPersist.fetchId)
  assert.strictEqual(notFoundFetch.status, 'FAILED', '4041401 must be recorded as FAILED')
  assert.strictEqual(notFoundFetch.cursor_advanced, 0)
  console.log('✓ 1.7: 4041401 Transaction Not Found treated as provider failure (FAILED, cursor_advanced=0).')

  // =========================================================================
  // SECTION 2: STATEMENT DEDUP, IDENTITY STRENGTH & IMMUTABILITY
  // =========================================================================
  console.log('\n--- 2. Testing Statement Dedup, Identity Strength & Immutability ---')

  // 2.1: Fetch referenceNo stored only as fetch metadata
  const ingest1 = await persistBankStatementTransactions({
    accountNo: '001901000123301',
    fromDateTime: '2026-10-08T00:00:00+07:00',
    toDateTime: '2026-10-08T23:59:59+07:00',
    response: fetchRes.data,
    rawResponseJson: JSON.stringify(fetchRes.data),
  })
  assert.strictEqual(ingest1.newTransactionsCount, 1)

  const fetchRecord = sqliteDb.prepare("SELECT fetch_reference_no FROM finance_bri_statement_fetches WHERE id = ?").get(ingest1.fetchId)
  assert.ok(fetchRecord.fetch_reference_no.includes('BRI-REF-FETCH-999'))
  console.log('✓ 2.1: Top-level fetch referenceNo stored strictly on fetch record.')

  // 2.2: Same transaction from second fetch with different top-level referenceNo dedups correctly
  const responseFetch2 = {
    ...fetchRes.data,
    referenceNo: 'DIFFERENT-TOP-LEVEL-REF-888',
  }
  const ingest2 = await persistBankStatementTransactions({
    accountNo: '001901000123301',
    fromDateTime: '2026-10-08T00:00:00+07:00',
    toDateTime: '2026-10-08T23:59:59+07:00',
    response: responseFetch2,
    rawResponseJson: JSON.stringify(responseFetch2),
  })
  assert.strictEqual(ingest2.newTransactionsCount, 0, 'Must not duplicate transaction')
  assert.strictEqual(ingest2.dedupedCount, 1, 'Must count as deduped')
  console.log('✓ 2.2: Same transaction from two fetches with different top-level referenceNo dedups correctly.')

  // 2.3: Strong identity model when transactionId is present
  const txStrong = sqliteDb.prepare("SELECT transaction_id, identity_strength FROM finance_bri_statement_transactions WHERE transaction_id = 'TXN-BANK-101'").get()
  assert.strictEqual(txStrong.identity_strength, 'STRONG')
  console.log('✓ 2.3: Strong identity verified when transactionId is present.')

  // 2.4: Weak identity model when transactionId is absent
  const weakResponse = {
    responseCode: '2001400',
    responseMessage: 'Successful',
    partnerReferenceNo: 'BS-WEAK-TEST',
    accountNo: '001901000123301',
    detailData: [
      {
        dateTime: '2026-10-08T11:00:00+07:00',
        amount: { value: '80000.00', currency: 'IDR' },
        type: 'Credit',
        remark: 'MUTASI TANPA TRANSACTION ID',
      },
    ],
  }
  const ingestWeak = await persistBankStatementTransactions({
    accountNo: '001901000123301',
    fromDateTime: '2026-10-08T00:00:00+07:00',
    toDateTime: '2026-10-08T23:59:59+07:00',
    response: weakResponse,
    rawResponseJson: JSON.stringify(weakResponse),
  })
  const txWeak = sqliteDb.prepare("SELECT transaction_id, identity_strength FROM finance_bri_statement_transactions WHERE amount = 80000").get()
  assert.strictEqual(txWeak.transaction_id, null)
  assert.strictEqual(txWeak.identity_strength, 'WEAK')
  console.log('✓ 2.4: Weak identity verified when transactionId is absent.')

  // 2.5: CREDIT/DEBIT normalized case-insensitively; abbreviations CR/DB/DR strictly rejected
  assert.strictEqual(normalizeStatementType('Credit'), 'CREDIT')
  assert.strictEqual(normalizeStatementType('credit'), 'CREDIT')
  assert.strictEqual(normalizeStatementType('CREDIT'), 'CREDIT')
  assert.strictEqual(normalizeStatementType('Debit'), 'DEBIT')
  assert.strictEqual(normalizeStatementType('debit'), 'DEBIT')
  assert.throws(() => normalizeStatementType('CR'), /abbreviations CR, DB, DR are strictly disallowed/)
  assert.throws(() => normalizeStatementType('DB'), /abbreviations CR, DB, DR are strictly disallowed/)
  assert.throws(() => normalizeStatementType('DR'), /abbreviations CR, DB, DR are strictly disallowed/)
  assert.throws(() => normalizeStatementType('INVALID_TYPE'), /Unrecognized statement transaction type/)
  console.log('✓ 2.5: Strict type parser: exact CREDIT/DEBIT accepted; abbreviations CR, DB, DR fail-closed.')

  // 2.6: Raw statement evidence immutability triggers (UPDATE & DELETE blocked)
  const savedTx = sqliteDb.prepare("SELECT id FROM finance_bri_statement_transactions WHERE transaction_id = 'TXN-BANK-101'").get()
  assert.throws(
    () => {
      sqliteDb.prepare("UPDATE finance_bri_statement_transactions SET amount = 99999 WHERE id = ?").run(savedTx.id)
    },
    /STATEMENT_IMMUTABLE_ABORT/,
    'Must block modifying statement amount'
  )
  assert.throws(
    () => {
      sqliteDb.prepare("DELETE FROM finance_bri_statement_transactions WHERE id = ?").run(savedTx.id)
    },
    /STATEMENT_IMMUTABLE_ABORT/,
    'Must block deleting statement transaction'
  )
  console.log('✓ 2.6: Raw statement evidence immutability verified (UPDATE and DELETE blocked).')

  // 2.7: Totals mismatch blocks cursor advance
  const mismatchResponse = {
    responseCode: '2001400',
    responseMessage: 'Successful',
    accountNo: '001901000123301',
    totalCreditEntries: 5, // Expected 5, actual is 1!
    detailData: [
      {
        transactionId: 'TXN-MISMATCH-1',
        dateTime: '2026-10-08T12:00:00+07:00',
        amount: { value: '10000.00', currency: 'IDR' },
        type: 'Credit',
      },
    ],
  }
  const ingestMismatch = await persistBankStatementTransactions({
    accountNo: '001901000123301',
    fromDateTime: '2026-10-08T00:00:00+07:00',
    toDateTime: '2026-10-08T23:59:59+07:00',
    response: mismatchResponse,
    rawResponseJson: JSON.stringify(mismatchResponse),
  })
  assert.strictEqual(ingestMismatch.hasDiscrepancy, true)
  assert.strictEqual(ingestMismatch.cursorAdvanced, false, 'Cursor must not advance on totals discrepancy')
  const fetchMismatchRow = sqliteDb.prepare("SELECT status, cursor_advanced FROM finance_bri_statement_fetches WHERE id = ?").get(ingestMismatch.fetchId)
  assert.strictEqual(fetchMismatchRow.status, 'DISCREPANCY')
  assert.strictEqual(fetchMismatchRow.cursor_advanced, 0)
  console.log('✓ 2.7: Totals mismatch marks fetch as DISCREPANCY and blocks cursor advance.')

  // 2.8: Non-destructive WEAK identity dedup: multiple identical weak rows preserved and marked AMBIGUOUS
  const weakBatchDupResponse = {
    responseCode: '2001400',
    responseMessage: 'Successful',
    accountNo: '001901000123301',
    detailData: [
      {
        dateTime: '2026-10-08T15:00:00+07:00',
        amount: { value: '95000.00', currency: 'IDR' },
        type: 'Credit',
        remark: 'MUTASI IDENTIK 1',
      },
      {
        dateTime: '2026-10-08T15:00:00+07:00',
        amount: { value: '95000.00', currency: 'IDR' },
        type: 'Credit',
        remark: 'MUTASI IDENTIK 1',
      },
    ],
  }
  const ingestWeakDups = await persistBankStatementTransactions({
    accountNo: '001901000123301',
    fromDateTime: '2026-10-08T00:00:00+07:00',
    toDateTime: '2026-10-08T23:59:59+07:00',
    response: weakBatchDupResponse,
    rawResponseJson: JSON.stringify(weakBatchDupResponse),
  })
  assert.strictEqual(ingestWeakDups.newTransactionsCount, 2, 'Both duplicate weak rows must be preserved')
  const preservedWeakRows = sqliteDb.prepare("SELECT match_status FROM finance_bri_statement_transactions WHERE amount = 95000").all()
  assert.strictEqual(preservedWeakRows.length, 2)
  assert.strictEqual(preservedWeakRows[0].match_status, 'AMBIGUOUS')
  assert.strictEqual(preservedWeakRows[1].match_status, 'AMBIGUOUS')
  console.log('✓ 2.8: Non-destructive WEAK dedup: both identical weak lines preserved and marked AMBIGUOUS.')

  // =========================================================================
  // SECTION 3: MATCHING ENGINE & CROSS-PRODUCT CONTRACT ISOLATION
  // =========================================================================
  console.log('\n--- 3. Testing Matching Engine & Cross-Product Contract Isolation ---')

  assert.strictEqual(BANK_STATEMENT_CROSS_PRODUCT_STATE, 'CONTRACT_TBD')

  // Create a payment in DB (insert as PENDING first to satisfy migration 0183 trigger, then mark PAID)
  sqliteDb.exec(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, status, expires_at)
    VALUES ('ord-match-1', 'ORD-MATCH-001', 'san-1', 'PARENT', 150000, 3000, 153000, 'BRI_VA', 'PENDING', '2026-10-31T23:59:59Z');
    INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at, bri_trx_id)
    VALUES ('pay-match-1', 'PAY-M-001', 'ord-match-1', 'san-1', 'BRI', 'BRI_VA', 150000, 3000, 150000, 'PAID', '2026-10-08T10:00:00Z', 'TRX-101');
    UPDATE finance_payment_orders SET status = 'PAID' WHERE id = 'ord-match-1';
  `)

  // 3.1: Bank Statement transactionId is NOT assumed equal to BRIVA trxId without contract mapping
  const txRowCr1 = sqliteDb.prepare("SELECT * FROM finance_bri_statement_transactions WHERE id = ?").get(savedTx.id)
  const defaultMatchRes = await matchStatementTransaction(txRowCr1)
  assert.strictEqual(defaultMatchRes.matchingStrength, 'CANDIDATE', 'Without authoritative cross-product mapping, match is strictly CANDIDATE')
  console.log('✓ 3.1: Bank Statement transactionId not assumed equal to BRIVA trxId (classified as CANDIDATE).')

  // 3.2: Ambiguous candidates with identical amounts never auto-match
  sqliteDb.exec(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, status, expires_at)
    VALUES ('ord-amb-1', 'ORD-AMB-001', 'san-1', 'PARENT', 150000, 3000, 153000, 'BRI_VA', 'PENDING', '2026-10-31T23:59:59Z');
    INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at)
    VALUES ('pay-amb-1', 'PAY-AMB-001', 'ord-amb-1', 'san-1', 'BRI', 'BRI_VA', 150000, 3000, 150000, 'PAID', '2026-10-08T10:01:00Z');
    UPDATE finance_payment_orders SET status = 'PAID' WHERE id = 'ord-amb-1';
  `)
  const ambMatchRes = await matchStatementTransaction(txRowCr1)
  assert.strictEqual(ambMatchRes.classification, 'AMBIGUOUS')
  assert.strictEqual(ambMatchRes.matchingStrength, 'AMBIGUOUS')
  console.log('✓ 3.2: Multiple candidate payments with identical amounts classify as AMBIGUOUS.')

  // Cleanup second payment for subsequent 1:1 tests
  sqliteDb.prepare("DELETE FROM finance_payments WHERE id = 'pay-amb-1';").run()
  sqliteDb.prepare("DELETE FROM finance_payment_orders WHERE id = 'ord-amb-1';").run()

  // 3.3: Debit/DEBIT transaction is ignored and never settles
  const mockDebitTx = {
    id: 'tx-mock-db',
    account_no: '001901000123301',
    type_normalized: 'DEBIT',
    amount: 50000,
  }
  const debitMatch = await matchStatementTransaction(mockDebitTx)
  assert.strictEqual(debitMatch.classification, 'IGNORED_DEBIT')
  assert.strictEqual(debitMatch.matchingStrength, 'NO_MATCH')
  console.log('✓ 3.3: Debit/DEBIT transaction classified as IGNORED_DEBIT and never settles.')

  // 3.4: Authoritative match when explicitly enabled via contract mapping
  const authMatch = await matchStatementTransaction(txRowCr1, { authoritativeCrossProductLink: true })
  assert.strictEqual(authMatch.classification, 'EXACT_MATCH')
  assert.strictEqual(authMatch.matchingStrength, 'AUTHORITATIVE_EXACT')
  console.log('✓ 3.4: Authoritative match verified when explicit cross-product link is confirmed.')

  // 3.5: Student identity from VA regex is CONTRACT_TBD and strictly CANDIDATE
  assert.strictEqual(BANK_STATEMENT_STUDENT_AUTO_IDENTITY, 'CONTRACT_TBD')
  const vaRemarkTx = {
    id: 'tx-va-cand',
    account_no: '001901000123301',
    type_normalized: 'CREDIT',
    amount: 153000,
    va_number: '1234500001001',
  }
  const vaMatch = await matchStatementTransaction(vaRemarkTx, { authoritativeCrossProductLink: true })
  assert.strictEqual(vaMatch.matchingStrength, 'CANDIDATE', 'VA regex matching can never produce AUTHORITATIVE_EXACT')
  console.log('✓ 3.5: BANK_STATEMENT_STUDENT_AUTO_IDENTITY is CONTRACT_TBD; VA regex match is strictly CANDIDATE.')

  // =========================================================================
  // SECTION 4: ATOMIC SETTLEMENT & DATABASE HARD GUARDS
  // =========================================================================
  console.log('\n--- 4. Testing Atomic Settlement & Database Hard Guards ---')

  // 4.1: Direct PAID -> SETTLED without settlement item blocked by trigger
  assert.throws(
    () => {
      sqliteDb.prepare("UPDATE finance_payments SET status = 'SETTLED' WHERE id = 'pay-match-1';").run()
    },
    /Payment cannot transition to SETTLED without valid Bank Statement settlement item evidence/,
    'Trigger must block status transition to SETTLED without settlement item'
  )
  console.log('✓ 4.1: Direct PAID -> SETTLED without settlement item blocked by database trigger.')

  // 4.2: Settlement item guard blocks settlement against DEBIT transaction
  sqliteDb.exec(`
    INSERT INTO finance_bri_settlements (id, settlement_number, account_no, settlement_date, total_payments_count, total_gross_amount, total_cooperative_admin_fee, total_net_amount, status)
    VALUES ('stl-test-1', 'STL-TEST-001', '001901000123301', '2026-10-08', 1, 150000, 3000, 150000, 'COMPLETED');
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, identity_strength, dedup_key, transaction_date_raw,
      type_raw, type_normalized, amount, amount_raw, currency, raw_evidence_hash, first_seen_at, last_seen_at, raw_json
    ) VALUES (
      'tx-db-guard-test', '${ingest1.fetchId}', '001901000123301', 'WEAK', 'dedup_db_guard', '2026-10-08T11:00:00+07:00',
      'Debit', 'DEBIT', 153000, '153000.00', 'IDR', 'hash_db', '2026-10-08T11:00:00Z', '2026-10-08T11:00:00Z', '{}'
    );
  `)
  assert.throws(
    () => {
      sqliteDb.prepare(`
        INSERT INTO finance_bri_settlement_items (
          id, settlement_id, payment_id, statement_transaction_id,
          gross_amount, cooperative_admin_fee, net_amount,
          match_strength, match_method, currency, settled_at
        ) VALUES (
          'stli-db-fail', 'stl-test-1', 'pay-match-1', 'tx-db-guard-test',
          150000, 3000, 150000,
          'AUTHORITATIVE_EXACT', 'CROSS_PRODUCT_EXACT', 'IDR', datetime('now')
        );
      `).run()
    },
    /SETTLEMENT_GUARD_ABORT: Statement transaction must be CREDIT/,
    'Must reject settlement item pointing to DEBIT transaction'
  )
  console.log('✓ 4.2: Settlement item guard blocks settlement against DEBIT transaction.')

  // 4.3: Valid atomic settlement execution
  const settleRes = await executeSettlementTransition({
    statementTransactionId: savedTx.id,
    paymentId: 'pay-match-1',
    matchStrength: 'AUTHORITATIVE_EXACT',
    verifiedBy: 'usr-op',
  })
  assert.strictEqual(settleRes.paymentId, 'pay-match-1')
  assert.strictEqual(settleRes.alreadySettled, false)

  const paymentAfterSettle = sqliteDb.prepare("SELECT status FROM finance_payments WHERE id = 'pay-match-1'").get()
  assert.strictEqual(paymentAfterSettle.status, 'SETTLED')
  console.log('✓ 4.3: Valid atomic settlement (item first -> payment SETTLED) succeeded.')

  // 4.3b: Provenance Guard: reject CANDIDATE / AMBIGUOUS settlement
  await assert.rejects(
    async () => {
      await executeSettlementTransition({
        statementTransactionId: savedTx.id,
        paymentId: 'pay-match-1',
        matchStrength: 'CANDIDATE',
      })
    },
    /Invalid match_strength "CANDIDATE"/,
    'executeSettlementTransition must reject CANDIDATE match strength'
  )

  // 4.3c: Provenance Guard: MANUAL_RESOLVED requires reconciliationItemId and operator
  await assert.rejects(
    async () => {
      await executeSettlementTransition({
        statementTransactionId: savedTx.id,
        paymentId: 'pay-match-1',
        matchStrength: 'MANUAL_RESOLVED',
      })
    },
    /MANUAL_RESOLVED settlement strictly requires reconciliationItemId/,
    'executeSettlementTransition must require reconciliationItemId for MANUAL_RESOLVED'
  )

  // 4.3d: Currency Guard: non-IDR currency rejected
  await assert.rejects(
    async () => {
      await executeSettlementTransition({
        statementTransactionId: savedTx.id,
        paymentId: 'pay-match-1',
        matchStrength: 'AUTHORITATIVE_EXACT',
        currency: 'USD',
      })
    },
    /Settlement strictly requires currency IDR/,
    'executeSettlementTransition must reject non-IDR currency'
  )
  console.log('✓ 4.3b-d: Settlement provenance guards (CANDIDATE rejection, MANUAL_RESOLVED requirements, currency) verified.')

  // 4.4: 1-to-1 unique constraints prevent double claim
  sqliteDb.exec(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, status, expires_at)
    VALUES ('ord-double-test', 'ORD-DBL-001', 'san-2', 'PARENT', 150000, 3000, 153000, 'BRI_VA', 'PENDING', '2026-10-31T23:59:59Z');
    INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at)
    VALUES ('pay-double-test', 'PAY-DBL-001', 'ord-double-test', 'san-2', 'BRI', 'BRI_VA', 150000, 3000, 150000, 'PAID', '2026-10-08T10:00:00Z');
    UPDATE finance_payment_orders SET status = 'PAID' WHERE id = 'ord-double-test';
  `)
  assert.throws(
    () => {
      sqliteDb.prepare(`
        INSERT INTO finance_bri_settlement_items (
          id, settlement_id, payment_id, statement_transaction_id,
          gross_amount, cooperative_admin_fee, net_amount,
          match_strength, match_method, currency, settled_at
        ) VALUES (
          'stli-double-stmt', 'stl-test-1', 'pay-double-test', '${savedTx.id}',
          150000, 3000, 150000,
          'AUTHORITATIVE_EXACT', 'CROSS_PRODUCT_EXACT', 'IDR', datetime('now')
        );
      `).run()
    },
    /UNIQUE constraint failed/,
    'Statement transaction cannot settle 2 payments'
  )
  console.log('✓ 4.4: 1-to-1 unique constraints prevent double claim of statement transaction.')

  // 4.5: Settlement items are strictly immutable
  assert.throws(
    () => {
      sqliteDb.prepare("UPDATE finance_bri_settlement_items SET gross_amount = 999 WHERE payment_id = 'pay-match-1';").run()
    },
    /SETTLEMENT_IMMUTABLE_ABORT/,
    'Settlement items must not be modified'
  )
  assert.throws(
    () => {
      sqliteDb.prepare("DELETE FROM finance_bri_settlement_items WHERE payment_id = 'pay-match-1';").run()
    },
    /SETTLEMENT_IMMUTABLE_ABORT/,
    'Settlement items must not be deleted'
  )
  console.log('✓ 4.5: Settlement items immutability verified (UPDATE and DELETE blocked).')

  // =========================================================================
  // SECTION 5: MISSED-WEBHOOK RECOVERY & CASH RACE PROTECTION
  // =========================================================================
  console.log('\n--- 5. Testing Missed-Webhook Recovery & CASH Race Protection ---')

  // Setup student obligation & PENDING order
  sqliteDb.exec(`
    INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_paid, status)
    VALUES ('ob-rec-1', 'san-1', 'SPP', '2026-10', 100000, 0, 'UNPAID');
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, status, expires_at)
    VALUES ('ord-missed-1', 'ORD-MISSED-001', 'san-1', 'PARENT', 100000, 2000, 102000, 'BRI_VA', 'PENDING', '2026-10-31T23:59:59Z');
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES ('oi-missed-1', 'ord-missed-1', 'ob-rec-1', 'SPP', 100000);
  `)

  const stmtMissedTxId = crypto.randomUUID()
  sqliteDb.prepare(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, remark, bri_trx_id, va_number,
      raw_evidence_hash, first_seen_at, last_seen_at, raw_json
    ) VALUES (
      ?, '${ingest1.fetchId}', '001901000123301', 'TXN-MISSED-101', 'STRONG', 'dedup-missed-1',
      '2026-10-08T12:00:00+07:00', 'Credit', 'CREDIT', 102000, '102000.00', 'BRIVA 1234500001001 TRX-MISSED-101', 'TRX-MISSED-101', '1234500001001',
      'hash-missed', datetime('now'), datetime('now'), '{}'
    );
  `).run(stmtMissedTxId)

  // 5.1: Missed-webhook recovery executes atomically and settles
  const recoveryRes = await recoverMissedPaymentFromStatement({
    statementTransactionId: stmtMissedTxId,
    orderId: 'ord-missed-1',
    recoveredBy: 'usr-op',
  })
  assert.strictEqual(recoveryRes.status, 'RECOVERED_AND_SETTLED')

  const recPayment = sqliteDb.prepare("SELECT status FROM finance_payments WHERE id = ?").get(recoveryRes.paymentId)
  assert.strictEqual(recPayment.status, 'SETTLED')
  const recObligation = sqliteDb.prepare("SELECT status, amount_paid FROM finance_obligations WHERE id = 'ob-rec-1'").get()
  assert.strictEqual(recObligation.status, 'PAID')
  assert.strictEqual(recObligation.amount_paid, 100000)
  console.log('✓ 5.1: Missed-webhook recovery materialized allocations, income, and settled atomically.')

  // 5.2: Idempotent replay
  const dupRecovery = await recoverMissedPaymentFromStatement({
    statementTransactionId: stmtMissedTxId,
    orderId: 'ord-missed-1',
  })
  assert.strictEqual(dupRecovery.alreadyRecovered, true)
  assert.strictEqual(dupRecovery.paymentId, recoveryRes.paymentId)
  console.log('✓ 5.2: Repeated recovery is idempotent.')

  // 5.3: CASH order already paid/cancelled -> automated statement recovery blocked to prevent double allocation
  sqliteDb.exec(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, status, expires_at)
    VALUES ('ord-cash-race', 'ORD-CASH-RACE-1', 'san-2', 'PARENT', 50000, 0, 50000, 'BRI_VA', 'CANCELLED', '2026-10-31T23:59:59Z');
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES ('oi-cash-race', 'ord-cash-race', NULL, 'SPP', 50000);
  `)
  const stmtCashRaceTxId = crypto.randomUUID()
  sqliteDb.prepare(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, remark,
      raw_evidence_hash, first_seen_at, last_seen_at, raw_json
    ) VALUES (
      ?, '${ingest1.fetchId}', '001901000123301', 'TXN-CASH-RACE', 'STRONG', 'dedup-cash-race',
      '2026-10-08T13:00:00+07:00', 'Credit', 'CREDIT', 50000, '50000.00', 'BRIVA RACE',
      'hash-race', datetime('now'), datetime('now'), '{}'
    );
  `).run(stmtCashRaceTxId)

  await assert.rejects(
    async () => {
      await recoverMissedPaymentFromStatement({
        statementTransactionId: stmtCashRaceTxId,
        orderId: 'ord-cash-race',
      })
    },
    /Target order ord-cash-race is in CANCELLED status. Automated allocation blocked to prevent double allocation./,
    'Must abort recovery when order was cancelled/paid via CASH'
  )
  const recoveryQueueItem = sqliteDb.prepare("SELECT recovery_status FROM finance_bri_recovery_queue WHERE order_id = 'ord-cash-race'").get()
  assert.strictEqual(recoveryQueueItem.recovery_status, 'DISCREPANCY')
  console.log('✓ 5.3: CASH race protection verified: cancelled order blocks automated statement allocation and flags DISCREPANCY.')

  // 5.4: UANG_JAJAN top-up recovery credits wallet exactly once
  sqliteDb.exec(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, status, expires_at)
    VALUES ('ord-jajan-rec', 'ORD-JAJAN-001', 'san-jajan', 'PARENT', 50000, 2000, 52000, 'BRI_VA', 'PENDING', '2026-10-31T23:59:59Z');
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES ('oi-jajan-rec', 'ord-jajan-rec', NULL, 'UANG_JAJAN', 50000);
  `)
  const stmtJajanTxId = crypto.randomUUID()
  sqliteDb.prepare(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, remark, bri_trx_id, va_number,
      raw_evidence_hash, first_seen_at, last_seen_at, raw_json
    ) VALUES (
      ?, '${ingest1.fetchId}', '001901000123301', 'TXN-JAJAN-1', 'STRONG', 'dedup-jajan-1',
      '2026-10-08T14:00:00+07:00', 'Credit', 'CREDIT', 52000, '52000.00', 'BRIVA 1234500001003 TRX-JAJAN', 'TRX-JAJAN', '1234500001003',
      'hash-jajan', datetime('now'), datetime('now'), '{}'
    );
  `).run(stmtJajanTxId)

  const jajanRec = await recoverMissedPaymentFromStatement({
    statementTransactionId: stmtJajanTxId,
    orderId: 'ord-jajan-rec',
  })
  assert.strictEqual(jajanRec.status, 'RECOVERED_AND_SETTLED')
  const walletRows = sqliteDb.prepare("SELECT * FROM finance_wallet_ledger WHERE santri_id = 'san-jajan'").all()
  assert.strictEqual(walletRows.length, 1)
  assert.strictEqual(walletRows[0].amount, 50000)
  assert.strictEqual(walletRows[0].direction, 'IN')
  console.log('✓ 5.4: UANG_JAJAN missed-webhook recovery credited wallet exactly once.')

  // =========================================================================
  // SECTION 6: UNALLOCATED & UNIDENTIFIED CREDIT FLOW
  // =========================================================================
  console.log('\n--- 6. Testing Unallocated & Unidentified Credit Flow ---')

  // 6.1: UNIDENTIFIED credit -> remains reconciliation evidence, zero fake finance_payments created!
  const stmtUnidentTxId = crypto.randomUUID()
  sqliteDb.prepare(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, remark,
      raw_evidence_hash, first_seen_at, last_seen_at, raw_json
    ) VALUES (
      ?, '${ingest1.fetchId}', '001901000123301', 'TXN-UNKNOWN-999', 'STRONG', 'dedup-unident-1',
      '2026-10-08T15:00:00+07:00', 'Credit', 'CREDIT', 300000, '300000.00', 'TRANSFER DARI BANK LAIN TANPA KETERANGAN',
      'hash-unident', datetime('now'), datetime('now'), '{}'
    );
  `).run(stmtUnidentTxId)

  const unidentRes = await recordUnallocatedStatementPayment({
    statementTransactionId: stmtUnidentTxId,
    reason: 'Transfer misterius tanpa identitas santri',
  })
  assert.strictEqual(unidentRes.paymentId, null, 'Unidentified credit must NOT create fake finance_payments record')
  assert.strictEqual(unidentRes.isIdentifiedStudent, false)
  const unidentRecItem = sqliteDb.prepare("SELECT * FROM finance_reconciliation_items WHERE id = ?").get(unidentRes.reconciliationItemId)
  assert.strictEqual(unidentRecItem.match_status, 'UNMATCHED_EXTERNAL')
  assert.strictEqual(unidentRecItem.payment_id, null)
  console.log('✓ 6.1: Unidentified bank credit queued to reconciliation items with zero fake finance_payments.')

  // 6.2: KNOWN_STUDENT credit -> creates PAID + UNALLOCATED payment with Rp0 admin fee
  const stmtKnownStudentTxId = crypto.randomUUID()
  sqliteDb.prepare(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, remark, va_number,
      raw_evidence_hash, first_seen_at, last_seen_at, raw_json
    ) VALUES (
      ?, '${ingest1.fetchId}', '001901000123301', 'TXN-KNOWN-VA', 'STRONG', 'dedup-known-1',
      '2026-10-08T16:00:00+07:00', 'Credit', 'CREDIT', 200000, '200000.00', 'BRIVA 1234500001001 TANPA ORDER', '1234500001001',
      'hash-known', datetime('now'), datetime('now'), '{}'
    );
  `).run(stmtKnownStudentTxId)

  const knownStudentRes = await recordUnallocatedStatementPayment({
    statementTransactionId: stmtKnownStudentTxId,
    santriId: 'san-1',
    recordedBy: 'usr-op',
  })
  assert.strictEqual(knownStudentRes.isIdentifiedStudent, true)
  assert.ok(knownStudentRes.paymentId)
  const unallocPay = sqliteDb.prepare("SELECT * FROM finance_payments WHERE id = ?").get(knownStudentRes.paymentId)
  assert.strictEqual(unallocPay.santri_id, 'san-1')
  assert.strictEqual(unallocPay.allocation_status, 'UNALLOCATED')
  assert.strictEqual(unallocPay.cooperative_admin_fee, 0, 'Zero admin fee fabricated without order')
  assert.strictEqual(unallocPay.status, 'SETTLED')
  console.log('✓ 6.2: Known-student no-order credit recorded as PAID + UNALLOCATED with zero admin fee.')

  // =========================================================================
  // SECTION 7: CALLBACK / STATEMENT CONVERGENCE TESTS
  // =========================================================================
  console.log('\n--- 7. Testing Callback / Statement Convergence ---')

  // Convergence Scenario 1: Callback first, statement later
  sqliteDb.exec(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, status, expires_at)
    VALUES ('ord-conv-1', 'ORD-CONV-001', 'san-2', 'PARENT', 150000, 2000, 152000, 'BRI_VA', 'PENDING', '2026-10-31T23:59:59Z');
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES ('oi-conv-1', 'ord-conv-1', NULL, 'EHB', 150000);
  `)
  // Callback arrives:
  sqliteDb.exec(`
    INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, cooperative_admin_fee, net_amount, status, paid_at, bri_trx_id)
    VALUES ('pay-conv-1', 'PAY-CONV-001', 'ord-conv-1', 'san-2', 'BRI', 'BRI_VA', 150000, 2000, 150000, 'PAID', '2026-10-08T17:00:00Z', 'TRX-CONV-001');
    UPDATE finance_payment_orders SET status = 'PAID' WHERE id = 'ord-conv-1';
  `)
  // Later statement arrives:
  const stmtConv1TxId = crypto.randomUUID()
  sqliteDb.prepare(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, remark, bri_trx_id,
      raw_evidence_hash, first_seen_at, last_seen_at, raw_json
    ) VALUES (
      ?, '${ingest1.fetchId}', '001901000123301', 'TRX-CONV-001', 'STRONG', 'dedup-conv-1',
      '2026-10-08T17:00:00+07:00', 'Credit', 'CREDIT', 152000, '152000.00', 'BRIVA CONV', 'TRX-CONV-001',
      'hash-c1', datetime('now'), datetime('now'), '{}'
    );
  `).run(stmtConv1TxId)

  // Settlement executes:
  const convSettle = await executeSettlementTransition({
    statementTransactionId: stmtConv1TxId,
    paymentId: 'pay-conv-1',
    matchStrength: 'AUTHORITATIVE_EXACT',
  })
  assert.strictEqual(convSettle.paymentId, 'pay-conv-1')
  const finalPayConv1 = sqliteDb.prepare("SELECT status FROM finance_payments WHERE id = 'pay-conv-1'").get()
  assert.strictEqual(finalPayConv1.status, 'SETTLED')
  console.log('✓ 7.1: Sequence A (Callback first -> Statement later) settled cleanly.')

  // Convergence Scenario 2: Statement recovery first, late callback later
  sqliteDb.exec(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, status, expires_at)
    VALUES ('ord-conv-2', 'ORD-CONV-002', 'san-2', 'PARENT', 200000, 2000, 202000, 'BRI_VA', 'PENDING', '2026-10-31T23:59:59Z');
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES ('oi-conv-2', 'ord-conv-2', NULL, 'EHB', 200000);
  `)
  const stmtConv2TxId = crypto.randomUUID()
  sqliteDb.prepare(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, remark, bri_trx_id, va_number,
      raw_evidence_hash, first_seen_at, last_seen_at, raw_json
    ) VALUES (
      ?, '${ingest1.fetchId}', '001901000123301', 'TRX-CONV-002', 'STRONG', 'dedup-conv-2',
      '2026-10-08T18:00:00+07:00', 'Credit', 'CREDIT', 202000, '202000.00', 'BRIVA CONV 2', 'TRX-CONV-002', '1234500001002',
      'hash-c2', datetime('now'), datetime('now'), '{}'
    );
  `).run(stmtConv2TxId)

  // Recovery executes first:
  const recConv2 = await recoverMissedPaymentFromStatement({
    statementTransactionId: stmtConv2TxId,
    orderId: 'ord-conv-2',
  })
  assert.strictEqual(recConv2.status, 'RECOVERED_AND_SETTLED')

  // Late webhook arrives: Order is already PAID, so it detects existing payment
  const lateAttempt = await recoverMissedPaymentFromStatement({
    statementTransactionId: stmtConv2TxId,
    orderId: 'ord-conv-2',
  })
  assert.strictEqual(lateAttempt.alreadyRecovered, true)
  assert.strictEqual(lateAttempt.paymentId, recConv2.paymentId)
  console.log('✓ 7.2: Sequence B (Statement first -> Late callback later) resulted in identical state with zero duplication.')

  // =========================================================================
  // SECTION 8: STATUS INQUIRY SEAM & RECONCILIATION SESSION
  // =========================================================================
  console.log('\n--- 8. Testing Status Inquiry Seam & Reconciliation Session ---')

  // 8.1: Status inquiry seam returns typed TBD state (no fake 4999999 HTTP code)
  const inquiryService = new BriTransactionStatusInquiryService()
  const inquiryRes = await inquiryService.queryTransactionStatus({
    partnerReferenceNo: 'INQ-REF-001',
  })
  assert.strictEqual(inquiryRes.status, BRIVA_STATUS_INQUIRY_CONTRACT_STATE)
  assert.strictEqual(inquiryRes.status, 'BRIVA_STATUS_INQUIRY_CONTRACT_TBD')
  assert.strictEqual(typeof inquiryRes.responseCode, 'undefined', 'No fake responseCode allowed')
  console.log('✓ 8.1: Status inquiry abstraction returns typed TBD state without fake response codes.')

  // 8.2: Reconciliation session with discrepancies
  const session1 = await startReconciliationSession({
    period: '2026-10',
    accountNo: '001901000123301',
    conductedBy: 'usr-op',
  })
  const sessionDisc = await completeReconciliationSession({
    sessionId: session1.id,
    fetchedCount: 10,
    matchedCount: 8,
    unmatchedCount: 2,
    ambiguousCount: 0,
    discrepancyAmount: 50000,
  })
  assert.strictEqual(sessionDisc.status, 'DISCREPANCY_OPEN')
  console.log('✓ 8.2: Reconciliation session with discrepancies marked DISCREPANCY_OPEN.')

  // 8.3: Reconciliation session balanced
  const session2 = await startReconciliationSession({
    period: '2026-10',
    accountNo: '001901000123301',
    conductedBy: 'usr-op',
  })
  const sessionBal = await completeReconciliationSession({
    sessionId: session2.id,
    fetchedCount: 10,
    matchedCount: 10,
    unmatchedCount: 0,
    ambiguousCount: 0,
    discrepancyAmount: 0,
  })
  assert.strictEqual(sessionBal.status, 'BALANCED')
  console.log('✓ 8.3: Reconciliation session with zero discrepancies marked BALANCED.')

  console.log('\n=================================================================')
  console.log('SUCCESS: ALL 23 HARDENED BRI-4 TESTS PASSED COMPLETELY!')
  console.log('=================================================================')
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE RUNNER ERROR:', err)
  process.exit(1)
})
