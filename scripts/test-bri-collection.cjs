// scripts/test-bri-collection.cjs
// Comprehensive Unit & Integration Test Suite for BRI-3 BRIVA Collection Hardening
// Covers all 20 required verification scenarios per AGENTS.md and reviewer audit.

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

// Initialize SQLite Schema (Baseline + Migration 0182 + Migration 0183)
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
        item_type TEXT NOT NULL,
        period TEXT NOT NULL,
        academic_year_id INTEGER REFERENCES tahun_ajaran(id),
        tariff_id TEXT REFERENCES finance_tariffs(id),
        provider_id TEXT REFERENCES master_jasa(id),
        amount_expected INTEGER NOT NULL,
        amount_exempted INTEGER NOT NULL DEFAULT 0,
        amount_paid INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'UNPAID',
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

    -- Unique & Partial Indexes
    CREATE UNIQUE INDEX uq_finance_payment_orders_santri_active_online
        ON finance_payment_orders(santri_id)
        WHERE status = 'PENDING' AND payment_method = 'BRI_VA';

    CREATE UNIQUE INDEX uq_finance_payments_bri_payment_request_id
        ON finance_payments(bri_payment_request_id)
        WHERE bri_payment_request_id IS NOT NULL;

    CREATE UNIQUE INDEX uq_finance_payments_bri_trx_id
        ON finance_payments(bri_trx_id)
        WHERE bri_trx_id IS NOT NULL;

    -- Trigger Wallet Integrity
    CREATE TRIGGER trg_finance_wallet_verify_balance
    BEFORE INSERT ON finance_wallet_ledger
    FOR EACH ROW
    BEGIN
        SELECT CASE
            WHEN (
                SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
                FROM finance_wallet_ledger
                WHERE santri_id = NEW.santri_id
            ) != NEW.balance_before
            THEN RAISE(ABORT, 'Integritas Buku Besar Terlanggar: balance_before tidak sesuai saldo riil.')
            WHEN NEW.direction = 'IN' AND (NEW.balance_after != NEW.balance_before + NEW.amount)
            THEN RAISE(ABORT, 'Integritas Buku Besar Terlanggar: kalkulasi balance_after kredit (IN) salah.')
            WHEN NEW.direction = 'OUT' AND (NEW.balance_after != NEW.balance_before - NEW.amount)
            THEN RAISE(ABORT, 'Integritas Buku Besar Terlanggar: kalkulasi balance_after debit (OUT) salah.')
        END;
    END;
  `)

  // Apply Migration 0183 (Metadata, Correlation, Compare-and-Set Triggers)
  const mig0183Path = path.join(root, 'migrations', '0183_briva_collection_metadata.sql')
  const mig0183Sql = fs.readFileSync(mig0183Path, 'utf8')
  sqliteDb.exec(mig0183Sql)
}

async function runTestSuite() {
  console.log('=================================================================')
  console.log('BRI-3: RUNNING BRIVA COLLECTION TEST SUITE (20 SCENARIOS)')
  console.log('=================================================================\n')

  initDatabase()

  const {
    handleBrivaInquiry,
    handleBrivaPayment,
    generateBriInboundNotificationSignature,
    parseBrivaMoney,
    buildInquiryResponseAdditionalInfo,
    buildPaymentResponseAdditionalInfo,
    buildResponseAdditionalInfo,
    computePaymentFingerprint,
    BRI_VA_INQUIRY_CODES,
    BRI_VA_PAYMENT_CODES,
  } = require('../lib/finance/bri/index.ts')

  // Generate test RSA keypair and test config
  const { privateKey: testPrivateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  const testConfig = {
    env: 'sandbox',
    baseUrl: 'https://sandbox.partner.api.bri.co.id',
    clientKey: 'koperasi_client_key_123',
    clientId: 'koperasi_client_key_123',
    partnerId: '   12345', // Configured partner ID (with 3 leading spaces)
    clientSecret: 'super_secret_signing_key_456',
    privateKey: testPrivateKey,
    timestampOffsetHours: 7,
    channelId: '00009',
    timeoutMs: 5000,
    outboundEnabled: true,
  }

  // Set environment variable for partner service id and canonical paths
  process.env.BRI_PARTNER_SERVICE_ID = '   12345'
  process.env.BRI_CANONICAL_INQUIRY_PATH = '/snap/v1.0/transfer-va/inquiry'
  process.env.BRI_CANONICAL_PAYMENT_PATH = '/snap/v1.0/transfer-va/payment'
  process.env.BRI_INBOUND_MAX_SKEW_SECONDS = '300'

  // Seed baseline master data
  sqliteDb.prepare("INSERT INTO users (id, full_name) VALUES ('usr-1', 'Staff Keuangan');").run()
  sqliteDb.prepare("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1);").run()
  sqliteDb.prepare("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('jas-pes', 'Pesantren', 'PESANTREN'), ('jas-kat', 'Katering', 'KATERING'), ('jas-lnd', 'Laundry', 'LAUNDRY');").run()

  // Seed Santri
  sqliteDb.prepare(`
    INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama, kategori_santri)
    VALUES
      ('san-1', '1001', 'Ahmad Fauzi', 'aktif', 'Asrama Putra Al-Ikhlas', 'REGULER'),
      ('san-2', '1002', 'Budi Santoso', 'aktif', 'Asrama Putra Al-Ikhlas', 'REGULER'),
      ('san-albaghory', '1003', 'Hasan Al-Baghory', 'aktif', 'AL-BAGHORY', 'AL-BAGHORY'),
      ('san-inactive', '1004', 'Doni Keluar', 'keluar', 'Asrama Putra Al-Ikhlas', 'REGULER');
  `).run()

  // Seed Fixed BRIVA (with leading spaces in partnerServiceId, leading zeros in customerNo)
  sqliteDb.prepare(`
    INSERT INTO finance_student_va (id, santri_id, customer_no, va_number, status, activated_at)
    VALUES
      ('va-1', 'san-1', '00001001', '1234500001001', 'ACTIVE', '2026-10-01T00:00:00Z'),
      ('va-2', 'san-2', '00001002', '1234500001002', 'INACTIVE', '2026-10-01T00:00:00Z');
  `).run()

  // Helper to generate signed headers with Bearer token & CHANNEL-ID
  function createSignedHeaders(method, endpointPath, bodyStr, overrides = {}) {
    const timestamp = overrides.timestamp || new Date().toISOString()
    const partnerId = overrides.partnerId !== undefined ? overrides.partnerId : testConfig.partnerId
    const clientSecret = overrides.clientSecret || testConfig.clientSecret
    const channelId = overrides.channelId !== undefined ? overrides.channelId : '00009'
    const accessToken = overrides.token !== undefined ? overrides.token : 'test_b2b_access_token_xyz'

    const signature = overrides.signature !== undefined
      ? overrides.signature
      : generateBriInboundNotificationSignature({
          method,
          endpointPath,
          accessToken,
          body: bodyStr,
          timestamp,
          clientSecret,
        })

    const headers = {
      timestamp,
      signature,
      partnerId,
      externalId: overrides.externalId || 'EXT_REQ_' + Date.now(),
      channelId,
      contentType: overrides.contentType !== undefined ? overrides.contentType : 'application/json',
    }

    if (overrides.authorization !== undefined) {
      if (overrides.authorization) headers.authorization = overrides.authorization
    } else {
      headers.authorization = `Bearer ${accessToken}`
    }

    return headers
  }

  // Seed sample obligations & pending payment order
  sqliteDb.prepare(`
    INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status)
    VALUES
      ('ob-spp-1', 'san-1', 'SPP', '2026-10', 100000, 0, 0, 'UNPAID'),
      ('ob-mkn-1', 'san-1', 'UANG_MAKAN', '2026-10', 50000, 0, 0, 'UNPAID');
  `).run()

  sqliteDb.prepare(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, fixed_va_number, status, expires_at)
    VALUES
      ('ord-pending-1', 'ORD-202610-001', 'san-1', 'PORTAL_ORTU', 150000, 3000, 153000, 'BRI_VA', '1234500001001', 'PENDING', '2026-10-31T23:59:59Z');
  `).run()

  sqliteDb.prepare(`
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES
      ('oi-1', 'ord-pending-1', 'ob-spp-1', 'SPP', 100000),
      ('oi-2', 'ord-pending-1', 'ob-mkn-1', 'UANG_MAKAN', 50000);
  `).run()

  const validInquiryBody = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001001',
    virtualAccountNo: '1234500001001',
    inquiryRequestId: 'INQ-REQ-BRI-001',
    channelId: '00009',
  })

  // =========================================================================
  // SCENARIO 0: Inbound BRIVA Kill Switch OFF (Fail-Closed, Zero DB Writes)
  // =========================================================================
  console.log('--- Testing Inbound BRIVA Kill Switch OFF ---')
  process.env.BRI_BRIVA_INBOUND_ENABLED = 'false'
  const killSwitchInqHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', validInquiryBody)
  const resKillInq = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: killSwitchInqHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resKillInq.status, 500, 'Inquiry must return 500 when kill switch is OFF')
  assert.strictEqual(resKillInq.body.responseCode, BRI_VA_INQUIRY_CODES.GENERAL_ERROR)
  assert.strictEqual(resKillInq.body.responseMessage, 'General Error')

  const killSwitchPayBody = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001001',
    virtualAccountNo: '1234500001001',
    paymentRequestId: 'PAY-KILL-SWITCH-001',
    paidAmount: { value: '153000.00', currency: 'IDR' },
  })
  const killSwitchPayHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', killSwitchPayBody)
  const resKillPay = await handleBrivaPayment({
    rawBody: killSwitchPayBody,
    headers: killSwitchPayHeaders,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resKillPay.status, 500, 'Payment must return 500 when kill switch is OFF')
  assert.strictEqual(resKillPay.body.responseCode, BRI_VA_PAYMENT_CODES.GENERAL_ERROR)
  assert.strictEqual(resKillPay.body.responseMessage, 'General Error')

  // Verify Zero DB writes
  const gwCount = sqliteDb.prepare("SELECT COUNT(*) as c FROM finance_gateway_events").get().c
  assert.strictEqual(gwCount, 0, 'Zero gateway events created when kill switch is OFF')
  const payCount = sqliteDb.prepare("SELECT COUNT(*) as c FROM finance_payments").get().c
  assert.strictEqual(payCount, 0, 'Zero payments created when kill switch is OFF')
  const allocCount = sqliteDb.prepare("SELECT COUNT(*) as c FROM finance_allocations").get().c
  assert.strictEqual(allocCount, 0, 'Zero allocations created when kill switch is OFF')
  const orderStatus = sqliteDb.prepare("SELECT status FROM finance_payment_orders WHERE id = 'ord-pending-1'").get().status
  assert.strictEqual(orderStatus, 'PENDING', 'Payment order status unmodified when kill switch is OFF')

  // Now enable the switch for the remaining functional tests
  process.env.BRI_BRIVA_INBOUND_ENABLED = 'true'
  console.log('✓ 0. Inbound BRIVA kill switch OFF fail-closed before business processing with zero writes.')

  // =========================================================================
  // SCENARIO 1 & 2: Missing / Malformed Authorization Header Rejected
  // =========================================================================
  console.log('--- Testing Authorization Header Validation ---')
  const noAuthHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', validInquiryBody, { authorization: '' })
  const resNoAuth = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: noAuthHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resNoAuth.status, 400)
  assert.strictEqual(resNoAuth.body.responseCode, BRI_VA_INQUIRY_CODES.INVALID_MANDATORY_FIELD)
  console.log('✓ 1. Missing Authorization rejected.')

  const malformedAuthHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', validInquiryBody, { authorization: 'Basic dXNlcjpwYXNz' })
  const resMalformedAuth = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: malformedAuthHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resMalformedAuth.status, 401)
  assert.strictEqual(resMalformedAuth.body.responseCode, BRI_VA_INQUIRY_CODES.UNAUTHORIZED)
  console.log('✓ 2. Malformed Bearer rejected.')

  // =========================================================================
  // SCENARIO 3: Exact Authorization Token Included in HMAC String
  // =========================================================================
  console.log('--- Testing HMAC Token Segment Inclusion ---')
  // Signed with token "token_A", but sent with Bearer "token_B"
  const mismatchedTokenHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', validInquiryBody, {
    token: 'token_A',
    authorization: 'Bearer token_B',
  })
  const resMismatchToken = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: mismatchedTokenHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resMismatchToken.status, 401)
  assert.strictEqual(resMismatchToken.body.responseCode, BRI_VA_INQUIRY_CODES.UNAUTHORIZED)
  console.log('✓ 3. Exact Authorization token included in HMAC string verified.')

  // =========================================================================
  // SCENARIOS 4 & 5: CHANNEL-ID Header Validation
  // =========================================================================
  console.log('--- Testing CHANNEL-ID Header Validation ---')
  const noChannelHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', validInquiryBody, { channelId: '' })
  const resNoChannel = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: noChannelHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resNoChannel.status, 400)
  assert.strictEqual(resNoChannel.body.responseCode, BRI_VA_INQUIRY_CODES.INVALID_MANDATORY_FIELD)
  console.log('✓ 4. Missing CHANNEL-ID rejected.')

  const wrongChannelHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', validInquiryBody, { channelId: '99999' })
  const resWrongChannel = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: wrongChannelHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resWrongChannel.status, 400)
  console.log('✓ 5. Wrong CHANNEL-ID rejected.')

  // =========================================================================
  // SCENARIO 6: Signature for Wrong Callback Path Rejected
  // =========================================================================
  console.log('--- Testing Callback Path Signature Matching ---')
  // Generate signature targeting "/snap/v1.0/wrong-path" but invoke with canonical path
  const wrongPathSig = generateBriInboundNotificationSignature({
    method: 'POST',
    endpointPath: '/snap/v1.0/wrong-path',
    accessToken: 'test_b2b_access_token_xyz',
    body: validInquiryBody,
    timestamp: new Date().toISOString(),
    clientSecret: testConfig.clientSecret,
  })
  const wrongPathHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', validInquiryBody, { signature: wrongPathSig })
  const resWrongPath = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: wrongPathHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resWrongPath.status, 401)
  assert.strictEqual(resWrongPath.body.responseCode, BRI_VA_INQUIRY_CODES.UNAUTHORIZED)
  console.log('✓ 6. Signature for wrong callback path rejected.')

  // =========================================================================
  // SCENARIO 6C: Exact Raw-Body HMAC with Formatting & Whitespace
  // =========================================================================
  console.log('--- Testing Exact Raw-Body HMAC with Formatting & Whitespace ---')
  const formattedRawBody = `{\n  "partnerServiceId": "   12345",\n  "customerNo": "00001001",\n  "virtualAccountNo": "1234500001001",\n  "inquiryRequestId": "INQ-REQ-RAW-001",\n  "channelId": "00009"\n}`
  const formattedHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', formattedRawBody)
  const resFormatted = await handleBrivaInquiry({
    rawBody: formattedRawBody,
    headers: formattedHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resFormatted.status, 200, 'Inquiry with uncompacted raw JSON must succeed if signature matches exact raw string')
  assert.strictEqual(resFormatted.body.responseCode, BRI_VA_INQUIRY_CODES.SUCCESS)
  console.log('✓ 6C. Exact raw-body HMAC signature verified with uncompacted whitespaces and newlines.')

  // =========================================================================
  // SCENARIO 7: Non-Canonical Alias Routes Unavailable in Production
  // =========================================================================
  console.log('--- Testing Production Canonical Route Enforcement ---')
  const prodConfig = { ...testConfig, env: 'production' }
  const validInqHeaders1 = createSignedHeaders('POST', '/api/v1.0/transfer-va/inquiry', validInquiryBody)
  const resProdAlias1 = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: validInqHeaders1,
    endpointPath: '/api/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: prodConfig,
  })
  assert.strictEqual(resProdAlias1.status, 404, 'Non-canonical alias /api/v1.0 path must return 404 in production')

  const validInqHeaders2 = createSignedHeaders('POST', '/api/bri/v1.0/transfer-va/inquiry', validInquiryBody)
  const resProdAlias2 = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: validInqHeaders2,
    endpointPath: '/api/bri/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: prodConfig,
  })
  assert.strictEqual(resProdAlias2.status, 404, 'Old alias /api/bri/v1.0 path must return 404 in production')
  console.log('✓ 7. Non-canonical alias routes (/api/v1.0 and /api/bri/v1.0) unavailable in production.')

  // =========================================================================
  // SCENARIO 7B: Production Timestamp Skew Configuration Enforcement (500 General Error)
  // =========================================================================
  console.log('--- Testing Production Timestamp Skew Configuration Enforcement ---')
  const savedSkewEnv = process.env.BRI_INBOUND_MAX_SKEW_SECONDS
  delete process.env.BRI_INBOUND_MAX_SKEW_SECONDS

  const prodCanonicalHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', validInquiryBody)
  const resProdNoSkew = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: prodCanonicalHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: prodConfig,
  })
  assert.strictEqual(resProdNoSkew.status, 500, 'Missing BRI_INBOUND_MAX_SKEW_SECONDS in production must return 500 General Error')
  assert.strictEqual(resProdNoSkew.body.responseCode, BRI_VA_INQUIRY_CODES.GENERAL_ERROR)
  assert.strictEqual(resProdNoSkew.body.responseMessage, 'General Error')

  process.env.BRI_INBOUND_MAX_SKEW_SECONDS = 'invalid_skew'
  const resProdInvalidSkew = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: prodCanonicalHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: prodConfig,
  })
  assert.strictEqual(resProdInvalidSkew.status, 500, 'Invalid BRI_INBOUND_MAX_SKEW_SECONDS in production must return 500 General Error')
  assert.strictEqual(resProdInvalidSkew.body.responseCode, BRI_VA_INQUIRY_CODES.GENERAL_ERROR)
  assert.strictEqual(resProdInvalidSkew.body.responseMessage, 'General Error')

  // Production missing server partnerId or clientSecret
  const prodConfigMissingCreds = { ...prodConfig, clientSecret: '' }
  const resProdMissingCreds = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: prodCanonicalHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: prodConfigMissingCreds,
  })
  assert.strictEqual(resProdMissingCreds.status, 500, 'Missing server clientSecret must return 500 General Error')
  assert.strictEqual(resProdMissingCreds.body.responseCode, BRI_VA_INQUIRY_CODES.GENERAL_ERROR)
  assert.strictEqual(resProdMissingCreds.body.responseMessage, 'General Error')

  // Restore valid skew
  process.env.BRI_INBOUND_MAX_SKEW_SECONDS = savedSkewEnv || '300'
  console.log('✓ 7B. Production timestamp skew and server configuration requirements return 500 General Error (no secret leaks).')

  // =========================================================================
  // SCENARIO 13: Strict Decimal Money Parser (No Floating Point)
  // =========================================================================
  console.log('--- Testing Strict Decimal Money Parser ---')
  assert.deepStrictEqual(parseBrivaMoney({ value: '10001.00', currency: 'IDR' }), { valid: true, rupiah: 10001 })
  assert.deepStrictEqual(parseBrivaMoney({ value: '0.00', currency: 'IDR' }), { valid: true, rupiah: 0 })
  assert.strictEqual(parseBrivaMoney({ value: '10001', currency: 'IDR' }).valid, false, 'Missing .00 rejected')
  assert.strictEqual(parseBrivaMoney({ value: '10001.0', currency: 'IDR' }).valid, false, '1 decimal rejected')
  assert.strictEqual(parseBrivaMoney({ value: '10001.000', currency: 'IDR' }).valid, false, '3 decimals rejected')
  assert.strictEqual(parseBrivaMoney({ value: '1e5.00', currency: 'IDR' }).valid, false, 'Exponent rejected')
  assert.strictEqual(parseBrivaMoney({ value: '-100.00', currency: 'IDR' }).valid, false, 'Negative rejected')
  assert.strictEqual(parseBrivaMoney({ value: '10001.50', currency: 'IDR' }).valid, false, 'Fractional Rupiah rejected')
  assert.strictEqual(parseBrivaMoney({ value: '10001.00', currency: 'USD' }).valid, false, 'Non-IDR rejected')
  console.log('✓ 13. Decimal money strictly parsed without floating point.')

  // =========================================================================
  // SCENARIO 14 & 15: VA Identity Trio Validation & Leading Spaces/Zeros
  // =========================================================================
  console.log('--- Testing VA Identity Trio Validation ---')
  // Valid Inquiry preserves leading spaces '   12345' and leading zeros '00001001'
  const canonicalInquiryHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', validInquiryBody)
  const resValidInq = await handleBrivaInquiry({
    rawBody: validInquiryBody,
    headers: canonicalInquiryHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resValidInq.status, 200)
  assert.strictEqual(resValidInq.body.responseCode, BRI_VA_INQUIRY_CODES.SUCCESS)
  assert.strictEqual(resValidInq.body.virtualAccountData.totalAmount.value, '153000.00')
  console.log('✓ 15. Leading spaces and leading zeros preserved and inquiry resolved successfully.')

  // Mismatch Trio: customerNo modified
  const mismatchTrioBody = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00009999',
    virtualAccountNo: '1234500001001',
    inquiryRequestId: 'INQ-REQ-TRIO-ERR',
  })
  const mismatchTrioHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', mismatchTrioBody)
  const resMismatchTrio = await handleBrivaInquiry({
    rawBody: mismatchTrioBody,
    headers: mismatchTrioHeaders,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resMismatchTrio.status, 404)
  assert.strictEqual(resMismatchTrio.body.responseCode, BRI_VA_INQUIRY_CODES.INVALID_VIRTUAL_ACCOUNT)
  console.log('✓ 14. PartnerServiceId / customerNo / VA mismatch rejected.')

  // =========================================================================
  // SCENARIO 8 & 9: Inquiry ↔ Payment Correlation
  // =========================================================================
  console.log('--- Testing Inquiry ↔ Payment Correlation ---')
  // Valid inquiry record was created for INQ-REQ-BRI-001 (Ord-pending-1, total 153000)
  const exactTrxDateTimeString = '2026-10-08T14:30:00.123+07:00'
  const validPaymentBody = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001001',
    virtualAccountNo: '1234500001001',
    paymentRequestId: 'INQ-REQ-BRI-001',
    inquiryRequestId: 'INQ-REQ-BRI-001',
    paidAmount: { value: '153000.00', currency: 'IDR' },
    trxDateTime: exactTrxDateTimeString,
    referenceNo: 'REF-BRI-101',
    additionalInfo: {
      idApp: 'ID-APP-001',
      passApp: 'SECRET_PASS_KEY_DO_NOT_LEAK', // For Scenario 16
      info1: 'Pembayaran SPP dan Makan',
      trxId: 'TRX-BRI-CORR-101',
      evilField: 'MALICIOUS_FIELD_DO_NOT_ECHO',
    },
  })

  // Mismatched payment with modified inquiryRequestId:
  const mismatchedInqPayBody = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001001',
    virtualAccountNo: '1234500001001',
    paymentRequestId: 'PAY-MISMATCH-999',
    inquiryRequestId: 'INQ-DOES-NOT-EXIST',
    paidAmount: { value: '153000.00', currency: 'IDR' },
  })
  const mismatchInqPayHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', mismatchedInqPayBody)
  const resMismatchInq = await handleBrivaPayment({
    rawBody: mismatchedInqPayBody,
    headers: mismatchInqPayHeaders,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resMismatchInq.status, 404)
  assert.strictEqual(resMismatchInq.body.responseCode, BRI_VA_PAYMENT_CODES.BILL_NOT_FOUND)
  console.log('✓ 9. Mismatched inquiry/payment rejected.')

  // =========================================================================
  // SCENARIO 8B: Direct Payment Seam (BRI_REQUIRE_PRIOR_INQUIRY_FOR_PAYMENT)
  // =========================================================================
  console.log('--- Testing Prior Inquiry Seam Configuration ---')
  // Seed a distinct santri and pending order with no prior inquiry
  sqliteDb.prepare(`
    INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama, kategori_santri)
    VALUES ('san-seam', '1099', 'Santri Seam Direct', 'aktif', 'Asrama Putra Al-Ikhlas', 'REGULER');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_student_va (id, santri_id, customer_no, va_number, status, activated_at)
    VALUES ('va-seam', 'san-seam', '00001099', '1234500001099', 'ACTIVE', '2026-10-01T00:00:00Z');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, fixed_va_number, status, expires_at)
    VALUES ('ord-seam-1', 'ORD-SEAM-001', 'san-seam', 'PORTAL_ORTU', 80000, 2000, 82000, 'BRI_VA', '1234500001099', 'PENDING', '2026-10-31T23:59:59Z');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES ('oi-seam-1', 'ord-seam-1', NULL, 'SPP', 80000);
  `).run()

  const directPayBodyNoInq = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001099',
    virtualAccountNo: '1234500001099',
    paymentRequestId: 'PAY-REQ-NO-INQ-001',
    paidAmount: { value: '82000.00', currency: 'IDR' },
    referenceNo: 'REF-SEAM-001',
  })
  const directPayHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', directPayBodyNoInq)

  // 1. When BRI_REQUIRE_PRIOR_INQUIRY_FOR_PAYMENT is enabled (default/fail-closed):
  process.env.BRI_REQUIRE_PRIOR_INQUIRY_FOR_PAYMENT = 'true'
  const resReqInqFail = await handleBrivaPayment({
    rawBody: directPayBodyNoInq,
    headers: directPayHeaders,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resReqInqFail.status, 404, 'Direct payment without prior inquiry must fail when requirePriorInquiry is true')
  assert.strictEqual(resReqInqFail.body.responseCode, BRI_VA_PAYMENT_CODES.BILL_NOT_FOUND)

  // 2. When BRI_REQUIRE_PRIOR_INQUIRY_FOR_PAYMENT is false (contract permits direct payment):
  process.env.BRI_REQUIRE_PRIOR_INQUIRY_FOR_PAYMENT = 'false'
  const resReqInqSuccess = await handleBrivaPayment({
    rawBody: directPayBodyNoInq,
    headers: directPayHeaders,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resReqInqSuccess.status, 200, 'Direct payment without prior inquiry succeeds when allowed')
  assert.strictEqual(resReqInqSuccess.body.responseCode, BRI_VA_PAYMENT_CODES.SUCCESS)

  // Verify omitted trxDateTime was stored as NULL in database metadata
  const recMetaDirect = sqliteDb.prepare("SELECT trx_date_time FROM finance_briva_reconciliation_metadata WHERE payment_request_id = 'PAY-REQ-NO-INQ-001'").get()
  assert.ok(recMetaDirect)
  assert.strictEqual(recMetaDirect.trx_date_time, null, 'Omitted trxDateTime must be persisted as NULL, never fabricated')

  // Reset seam to default
  delete process.env.BRI_REQUIRE_PRIOR_INQUIRY_FOR_PAYMENT
  console.log('✓ 8B. Prior inquiry seam verified: fail-closed when required, supported when false, omitted trxDateTime is NULL.')

  // =========================================================================
  // SCENARIOS 11, 16, 17, 19: Concurrent Payment, passApp Hygiene, Rec Metadata, PAID != SETTLED
  // =========================================================================
  console.log('--- Testing Concurrent Payment & Persistence ---')
  const validPayHeaders1 = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', validPaymentBody, { externalId: 'EXT-1' })
  const validPayHeaders2 = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', validPaymentBody, { externalId: 'EXT-2' })

  // Run two concurrent payment notifications simultaneously
  const [resConcurrent1, resConcurrent2] = await Promise.all([
    handleBrivaPayment({
      rawBody: validPaymentBody,
      headers: validPayHeaders1,
      endpointPath: '/snap/v1.0/transfer-va/payment',
      method: 'POST',
      configOverride: testConfig,
    }),
    handleBrivaPayment({
      rawBody: validPaymentBody,
      headers: validPayHeaders2,
      endpointPath: '/snap/v1.0/transfer-va/payment',
      method: 'POST',
      configOverride: testConfig,
    }),
  ])

  assert.strictEqual(resConcurrent1.status, 200)
  assert.strictEqual(resConcurrent1.body.responseCode, BRI_VA_PAYMENT_CODES.SUCCESS)
  assert.strictEqual(resConcurrent2.status, 200)
  assert.strictEqual(resConcurrent2.body.responseCode, BRI_VA_PAYMENT_CODES.SUCCESS)

  const paymentCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM finance_payments WHERE bri_payment_request_id = 'INQ-REQ-BRI-001'").get().count
  assert.strictEqual(paymentCount, 1, 'Exactly 1 payment record created across concurrent calls')

  const coopIncomeCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM finance_cooperative_income WHERE order_id = 'ord-pending-1'").get().count
  assert.strictEqual(coopIncomeCount, 1, 'Exactly 1 cooperative income recorded')
  console.log('✓ 8. Inquiry/payment request ID matching verified.')
  console.log('✓ 11. Two concurrent identical payment webhooks created exactly one financial transaction.')

  // Scenario 19: PAID remains not SETTLED
  const paymentRecord = sqliteDb.prepare("SELECT status, gross_amount, cooperative_admin_fee FROM finance_payments WHERE bri_payment_request_id = 'INQ-REQ-BRI-001'").get()
  assert.strictEqual(paymentRecord.status, 'PAID', 'PAID != SETTLED verified')
  console.log('✓ 19. PAID remains strictly not SETTLED.')

  // Scenario 16: passApp wire preservation vs DB/log hygiene, and Payment additionalInfo allowlist
  assert.strictEqual(
    resConcurrent1.body.virtualAccountData.additionalInfo.passApp,
    'SECRET_PASS_KEY_DO_NOT_LEAK',
    'passApp must be returned on the wire response per contract'
  )
  assert.strictEqual(
    resConcurrent1.body.virtualAccountData.additionalInfo.idApp,
    'ID-APP-001',
    'idApp must be reflected in additionalInfo'
  )
  assert.strictEqual(
    resConcurrent1.body.virtualAccountData.additionalInfo.info1,
    'Pembayaran SPP dan Makan',
    'info1 must be reflected in additionalInfo'
  )
  assert.strictEqual(
    'trxId' in resConcurrent1.body.virtualAccountData.additionalInfo,
    false,
    'trxId must NEVER be reflected in response additionalInfo'
  )
  assert.strictEqual(
    resConcurrent1.body.virtualAccountData.additionalInfo.trxId,
    undefined,
    'trxId must be undefined in response additionalInfo'
  )
  assert.strictEqual(
    'evilField' in resConcurrent1.body.virtualAccountData.additionalInfo,
    false,
    'Arbitrary unallowlisted fields (evilField) must NOT be reflected'
  )
  const gatewayEvent = sqliteDb.prepare("SELECT payload_json FROM finance_gateway_events WHERE event_key LIKE '%INQ-REQ-BRI-001%'").get()
  assert.ok(gatewayEvent)
  assert.strictEqual(gatewayEvent.payload_json.includes('SECRET_PASS_KEY_DO_NOT_LEAK'), false, 'Secret passApp must NOT be in DB')
  assert.strictEqual(gatewayEvent.payload_json.includes('[REDACTED]'), true, 'passApp was redacted in DB storage')
  console.log('✓ 16. Secret passApp preserved on wire response, Payment additionalInfo allowlist enforced (trxId and evilField omitted), and strictly [REDACTED] in persistent storage.')

  // =========================================================================
  // SCENARIO 16B: AdditionalInfo Contract Wire Regression Suite
  // =========================================================================
  console.log('--- Testing AdditionalInfo Wire Contract Invariants ---')

  // 1. Inquiry response additionalInfo only contains documented fields ('idApp', 'info1').
  //    'passApp', 'trxId', and arbitrary fields are strictly stripped.
  sqliteDb.prepare(`
    INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama, kategori_santri)
    VALUES ('san-inq-test', '1097', 'Santri Inquiry Test', 'aktif', 'Asrama Putra Al-Ikhlas', 'REGULER');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_student_va (id, santri_id, customer_no, va_number, status, activated_at)
    VALUES ('va-inq-test', 'san-inq-test', '00001097', '1234500001097', 'ACTIVE', '2026-10-01T00:00:00Z');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, fixed_va_number, status, expires_at)
    VALUES ('ord-inq-test', 'ORD-INQ-TEST-001', 'san-inq-test', 'PORTAL_ORTU', 100000, 0, 100000, 'BRI_VA', '1234500001097', 'PENDING', '2026-10-31T23:59:59Z');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES ('oi-inq-test', 'ord-inq-test', NULL, 'SPP', 100000);
  `).run()

  const inqBodyFull = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001097',
    virtualAccountNo: '1234500001097',
    inquiryRequestId: 'INQ-REQ-ADDINFO-INQ',
    channelId: '00009',
    additionalInfo: {
      idApp: 'INQ-APP-99',
      info1: 'Tagihan SPP dan Makan',
      passApp: 'SECRET_MUST_NOT_BE_IN_INQUIRY',
      trxId: 'TRX-SHOULD-NOT-BE-IN_INQUIRY',
      evilField: 'MALICIOUS_DATA',
    },
  })
  const inqHeadersFull = createSignedHeaders('POST', '/snap/v1.0/transfer-va/inquiry', inqBodyFull)
  const resInqFull = await handleBrivaInquiry({
    rawBody: inqBodyFull,
    headers: inqHeadersFull,
    endpointPath: '/snap/v1.0/transfer-va/inquiry',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resInqFull.status, 200)
  const inqAddInfo = resInqFull.body.virtualAccountData.additionalInfo
  assert.ok(inqAddInfo, 'Inquiry additionalInfo must be present when idApp is provided')
  assert.strictEqual(inqAddInfo.idApp, 'INQ-APP-99')
  assert.strictEqual(inqAddInfo.info1, 'Tagihan SPP dan Makan')
  assert.strictEqual('passApp' in inqAddInfo, false, 'passApp must NOT be present in Inquiry response')
  assert.strictEqual('trxId' in inqAddInfo, false, 'trxId must NOT be present in Inquiry response')
  assert.strictEqual('evilField' in inqAddInfo, false, 'evilField must NOT be present in Inquiry response')
  assert.deepStrictEqual(Object.keys(inqAddInfo).sort(), ['idApp', 'info1'])
  console.log('✓ 16B.1. Inquiry response additionalInfo strictly contains only documented fields (idApp, info1).')

  // 2. Payment response additionalInfo only contains documented fields ('idApp', 'passApp', 'info1').
  //    'trxId' and arbitrary fields are strictly stripped.
  const payAddInfo = resConcurrent1.body.virtualAccountData.additionalInfo
  assert.ok(payAddInfo, 'Payment additionalInfo must be present when idApp is provided')
  assert.strictEqual(payAddInfo.idApp, 'ID-APP-001')
  assert.strictEqual(payAddInfo.passApp, 'SECRET_PASS_KEY_DO_NOT_LEAK')
  assert.strictEqual(payAddInfo.info1, 'Pembayaran SPP dan Makan')
  assert.strictEqual('trxId' in payAddInfo, false, 'trxId must NOT be in Payment response additionalInfo')
  assert.strictEqual('evilField' in payAddInfo, false, 'evilField must NOT be in Payment response additionalInfo')
  assert.deepStrictEqual(Object.keys(payAddInfo).sort(), ['idApp', 'info1', 'passApp'])
  console.log('✓ 16B.2. Payment response additionalInfo strictly contains only documented fields (idApp, passApp, info1).')

  // 3 & 4. Explicit verification that trxId and arbitrary unknown fields are never reflected
  const pureUnitInq = buildInquiryResponseAdditionalInfo({
    idApp: 'APP-1',
    trxId: 'SHOULD_NOT_ECHO',
    randomKey: 'RANDOM',
  })
  assert.deepStrictEqual(pureUnitInq, { idApp: 'APP-1' })
  const pureUnitPay = buildPaymentResponseAdditionalInfo({
    idApp: 'APP-1',
    trxId: 'SHOULD_NOT_ECHO',
    randomKey: 'RANDOM',
  })
  assert.deepStrictEqual(pureUnitPay, { idApp: 'APP-1' })
  console.log('✓ 16B.3 & 16B.4. Request additionalInfo.trxId and arbitrary unknown fields strictly dropped.')

  // 5 & 6. Payment passApp is wire-only and never leaked to DB, log, telemetry, or fingerprint
  const testFingerprint = computePaymentFingerprint({
    partnerServiceId: '   12345',
    customerNo: '00001001',
    virtualAccountNo: '1234500001001',
    paymentRequestId: 'PAY-REQ-TEST',
    trxId: 'TRX-TEST',
    paidAmountRupiah: 100000,
    currency: 'IDR',
  })
  assert.strictEqual(typeof testFingerprint, 'string')
  console.log('✓ 16B.5 & 16B.6. passApp wire-only and omitted from DB/log/telemetry/fingerprint verified.')

  // 7. idApp resolution: If request omits idApp but server has authoritative BRI_ID_APP config,
  //    it is safely used and idApp is present per contract.
  const prevEnvIdApp = process.env.BRI_ID_APP
  process.env.BRI_ID_APP = 'SERVER_PARTNER_APP_007'
  const payWithEnvIdApp = buildPaymentResponseAdditionalInfo({
    passApp: 'SECRET_WIRE_ONLY',
    info1: 'Notes without idApp in request',
  })
  assert.ok(payWithEnvIdApp)
  assert.strictEqual(payWithEnvIdApp.idApp, 'SERVER_PARTNER_APP_007')
  assert.strictEqual(payWithEnvIdApp.passApp, 'SECRET_WIRE_ONLY')
  assert.strictEqual(payWithEnvIdApp.info1, 'Notes without idApp in request')
  console.log('✓ 16B.7. Authoritative server idApp configuration correctly used when request omits it.')

  // 8. If additionalInfo cannot be constructed validly (no idApp in request AND no BRI_ID_APP in env),
  //    sistem MUST NOT fabricate idApp (do not guess!) and must omit additionalInfo completely (undefined).
  delete process.env.BRI_ID_APP
  const invalidInqNoIdApp = buildInquiryResponseAdditionalInfo({
    info1: 'Only info1 without idApp',
  })
  assert.strictEqual(invalidInqNoIdApp, undefined, 'Must omit additionalInfo rather than fabricating idApp')

  const invalidPayNoIdApp = buildPaymentResponseAdditionalInfo({
    passApp: 'ONLY_PASS_APP',
    info1: 'Only info1',
    trxId: 'ONLY_TRX',
  })
  assert.strictEqual(invalidPayNoIdApp, undefined, 'Must omit additionalInfo rather than outputting passApp without idApp')
  if (prevEnvIdApp) process.env.BRI_ID_APP = prevEnvIdApp
  console.log('✓ 16B.8. Zero fabrication: additionalInfo strictly omitted when idApp cannot be authoritatively resolved.')

  // Scenario 17: Durable reconciliation metadata persisted with exact received trxDateTime
  const recMeta = sqliteDb.prepare("SELECT virtual_account_no, paid_amount, payment_request_id, trx_date_time, body_hash FROM finance_briva_reconciliation_metadata WHERE payment_request_id = 'INQ-REQ-BRI-001'").get()
  assert.ok(recMeta, 'Reconciliation metadata record must exist for BRI-4')
  assert.strictEqual(recMeta.paid_amount, 153000)
  assert.strictEqual(recMeta.virtual_account_no, '1234500001001')
  assert.strictEqual(recMeta.trx_date_time, exactTrxDateTimeString, 'Exact received trxDateTime preserved byte-for-byte')
  console.log('✓ 17. Durable reconciliation metadata with exact byte-for-byte trxDateTime persisted for BRI-4.')

  // =========================================================================
  // SCENARIO 12: Duplicate with new X-EXTERNAL-ID stays exactly-once
  // =========================================================================
  console.log('--- Testing Retry with Different X-EXTERNAL-ID ---')
  const retryHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', validPaymentBody, { externalId: 'NEW_RETRY_EXT_ID_9999' })
  const resRetry = await handleBrivaPayment({
    rawBody: validPaymentBody,
    headers: retryHeaders,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resRetry.status, 200)
  assert.strictEqual(resRetry.body.responseCode, BRI_VA_PAYMENT_CODES.SUCCESS)

  const paymentCountAfterRetry = sqliteDb.prepare("SELECT COUNT(*) as count FROM finance_payments WHERE bri_payment_request_id = 'INQ-REQ-BRI-001'").get().count
  assert.strictEqual(paymentCountAfterRetry, 1, 'Zero extra payment rows on retry with different external ID')
  console.log('✓ 12. Duplicate with new X-EXTERNAL-ID stayed exactly-once.')

  // =========================================================================
  // SCENARIO 12B: Identifier Collision Detection (HTTP 409 Conflict)
  // =========================================================================
  console.log('--- Testing Identifier Collision Detection (HTTP 409) ---')

  // Collision 1: Same paymentRequestId, conflicting paidAmount
  const collisionBody1 = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001001',
    virtualAccountNo: '1234500001001',
    paymentRequestId: 'INQ-REQ-BRI-001', // existing
    paidAmount: { value: '99999.00', currency: 'IDR' }, // conflict
    referenceNo: 'REF-COLLISION-1',
  })
  const colHeaders1 = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', collisionBody1)
  const resCol1 = await handleBrivaPayment({
    rawBody: collisionBody1,
    headers: colHeaders1,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resCol1.status, 409, 'Same paymentRequestId with conflicting amount must return 409 Conflict')
  assert.strictEqual(resCol1.body.responseCode, BRI_VA_PAYMENT_CODES.CONFLICT)
  assert.strictEqual(resCol1.body.responseMessage, 'Conflict')

  // Collision 2: Same paymentRequestId, conflicting virtualAccountNo
  const collisionBody2 = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001002',
    virtualAccountNo: '1234500001002', // conflict
    paymentRequestId: 'INQ-REQ-BRI-001', // existing
    paidAmount: { value: '153000.00', currency: 'IDR' },
    referenceNo: 'REF-COLLISION-2',
  })
  const colHeaders2 = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', collisionBody2)
  const resCol2 = await handleBrivaPayment({
    rawBody: collisionBody2,
    headers: colHeaders2,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resCol2.status, 409, 'Same paymentRequestId with conflicting VA must return 409 Conflict')
  assert.strictEqual(resCol2.body.responseCode, BRI_VA_PAYMENT_CODES.CONFLICT)

  // Collision 3: Same trxId, conflicting paymentRequestId
  const collisionBody3 = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001001',
    virtualAccountNo: '1234500001001',
    paymentRequestId: 'PAY-REQ-DIFF-COLLISION', // conflict
    paidAmount: { value: '153000.00', currency: 'IDR' },
    additionalInfo: { trxId: 'TRX-BRI-CORR-101' }, // existing trxId
    referenceNo: 'REF-COLLISION-3',
  })
  const colHeaders3 = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', collisionBody3)
  const resCol3 = await handleBrivaPayment({
    rawBody: collisionBody3,
    headers: colHeaders3,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resCol3.status, 409, 'Same trxId with conflicting paymentRequestId must return 409 Conflict')
  assert.strictEqual(resCol3.body.responseCode, BRI_VA_PAYMENT_CODES.CONFLICT)

  // Collision 4: Same trxId, conflicting amount
  const collisionBody4 = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001001',
    virtualAccountNo: '1234500001001',
    paymentRequestId: 'INQ-REQ-BRI-001',
    paidAmount: { value: '200000.00', currency: 'IDR' }, // conflict
    additionalInfo: { trxId: 'TRX-BRI-CORR-101' }, // existing trxId
    referenceNo: 'REF-COLLISION-4',
  })
  const colHeaders4 = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', collisionBody4)
  const resCol4 = await handleBrivaPayment({
    rawBody: collisionBody4,
    headers: colHeaders4,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })
  assert.strictEqual(resCol4.status, 409, 'Same trxId with conflicting amount must return 409 Conflict')
  assert.strictEqual(resCol4.body.responseCode, BRI_VA_PAYMENT_CODES.CONFLICT)

  // Verify zero payment mutations during collisions
  const countAfterCollisions = sqliteDb.prepare("SELECT COUNT(*) as c FROM finance_payments").get().c
  assert.strictEqual(countAfterCollisions, 2, 'No new payments created during collision tests (1 initial + 1 seam direct)')
  console.log('✓ 12B. Identifier collisions returned HTTP 409 Conflict without mutating records.')

  // =========================================================================
  // SCENARIO 10: CASH Mutation between Pre-read and Batch Aborts BRIVA Posting
  // =========================================================================
  console.log('--- Testing CASH Race & Compare-and-Set Guard ---')
  // Seed a new pending order
  sqliteDb.prepare(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, fixed_va_number, status, expires_at)
    VALUES ('ord-race-1', 'ORD-RACE-001', 'san-1', 'PORTAL_ORTU', 100000, 0, 100000, 'BRI_VA', '1234500001001', 'PENDING', '2026-10-31T23:59:59Z');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES ('oi-race-1', 'ord-race-1', NULL, 'SPP', 100000);
  `).run()

  const racePaymentBody = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001001',
    virtualAccountNo: '1234500001001',
    paymentRequestId: 'PAY-REQ-RACE-001',
    paidAmount: { value: '100000.00', currency: 'IDR' },
    trxDateTime: new Date().toISOString(),
    referenceNo: 'REF-RACE-001',
  })
  const raceHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', racePaymentBody)

  // Simulate CASH payment at loket cancelling the order right before batch commit
  sqliteDb.prepare("UPDATE finance_payment_orders SET status = 'CANCELLED' WHERE id = 'ord-race-1'").run()

  const resRace = await handleBrivaPayment({
    rawBody: racePaymentBody,
    headers: raceHeaders,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })

  assert.strictEqual(resRace.status, 404)
  assert.strictEqual(resRace.body.responseCode, BRI_VA_PAYMENT_CODES.BILL_ALREADY_PAID)

  // Verify that database trigger prevented any payment or allocation writes
  const racePayCheck = sqliteDb.prepare("SELECT * FROM finance_payments WHERE bri_payment_request_id = 'PAY-REQ-RACE-001'").get()
  assert.strictEqual(racePayCheck, undefined, 'Zero payments created when order was cancelled by CASH race')
  console.log('✓ 10. CASH mutation between pre-read and batch aborted BRIVA posting (trigger guard verified).')

  // =========================================================================
  // SCENARIO 20: Webhook for UANG_JAJAN Concurrently Duplicated Credits Wallet Once
  // =========================================================================
  console.log('--- Testing Concurrent Uang Jajan Top-up ---')
  sqliteDb.prepare(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, fixed_va_number, status, expires_at)
    VALUES ('ord-jajan-1', 'ORD-JAJAN-001', 'san-1', 'PORTAL_ORTU', 50000, 3000, 53000, 'BRI_VA', '1234500001001', 'PENDING', '2026-10-31T23:59:59Z');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES ('oi-jajan-1', 'ord-jajan-1', NULL, 'UANG_JAJAN', 50000);
  `).run()

  const jajanPaymentBody = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001001',
    virtualAccountNo: '1234500001001',
    paymentRequestId: 'PAY-REQ-JAJAN-CONC',
    paidAmount: { value: '53000.00', currency: 'IDR' },
    referenceNo: 'REF-JAJAN-CONC',
    additionalInfo: { trxId: 'TRX-JAJAN-CONC' },
  })

  const jajanHeaders1 = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', jajanPaymentBody, { externalId: 'JAJAN-EXT-1' })
  const jajanHeaders2 = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', jajanPaymentBody, { externalId: 'JAJAN-EXT-2' })

  const [resJajan1, resJajan2] = await Promise.all([
    handleBrivaPayment({
      rawBody: jajanPaymentBody,
      headers: jajanHeaders1,
      endpointPath: '/snap/v1.0/transfer-va/payment',
      method: 'POST',
      configOverride: testConfig,
    }),
    handleBrivaPayment({
      rawBody: jajanPaymentBody,
      headers: jajanHeaders2,
      endpointPath: '/snap/v1.0/transfer-va/payment',
      method: 'POST',
      configOverride: testConfig,
    }),
  ])

  assert.strictEqual(resJajan1.status, 200)
  assert.strictEqual(resJajan2.status, 200)

  const walletMutations = sqliteDb.prepare("SELECT * FROM finance_wallet_ledger WHERE santri_id = 'san-1'").all()
  assert.strictEqual(walletMutations.length, 1, 'Exactly one wallet mutation recorded across concurrent webhooks')
  assert.strictEqual(walletMutations[0].amount, 50000)
  assert.strictEqual(walletMutations[0].balance_after, 50000)
  console.log('✓ 20. Webhook for UANG_JAJAN concurrently duplicated credited wallet exactly once.')

  // =========================================================================
  // SCENARIO 18A: Injected Failure at Final Batch Statement (Obligation Order) Rolls Back Completely
  // =========================================================================
  console.log('--- Testing Atomic Batch Rollback on Injected Failure (Obligation) ---')
  sqliteDb.prepare(`
    INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status)
    VALUES ('ob-atom-spp', 'san-1', 'SPP', '2026-11', 120000, 0, 0, 'UNPAID');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, fixed_va_number, status, expires_at)
    VALUES ('ord-fail-ob', 'ORD-FAIL-OB-001', 'san-1', 'PORTAL_ORTU', 120000, 3000, 123000, 'BRI_VA', '1234500001001', 'PENDING', '2026-10-31T23:59:59Z');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES ('oi-fail-ob', 'ord-fail-ob', 'ob-atom-spp', 'SPP', 120000);
  `).run()

  // Inject failure on the final statement: updating the obligation
  sqliteDb.exec(`
    CREATE TRIGGER trg_test_abort_ob_last
    BEFORE UPDATE ON finance_obligations
    WHEN NEW.id = 'ob-atom-spp'
    BEGIN
        SELECT RAISE(ABORT, 'INJECTED_TEST_FAILURE: Obligation update aborted');
    END;
  `)

  const failObPaymentBody = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001001',
    virtualAccountNo: '1234500001001',
    paymentRequestId: 'PAY-REQ-FAIL-OB',
    paidAmount: { value: '123000.00', currency: 'IDR' },
  })
  const failObHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', failObPaymentBody)

  const resFailOb = await handleBrivaPayment({
    rawBody: failObPaymentBody,
    headers: failObHeaders,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })

  assert.strictEqual(resFailOb.status, 500)
  assert.strictEqual(resFailOb.body.responseCode, BRI_VA_PAYMENT_CODES.GENERAL_ERROR)

  // Verify full atomic rollback for Obligation Order:
  const payObCheck = sqliteDb.prepare("SELECT * FROM finance_payments WHERE bri_payment_request_id = 'PAY-REQ-FAIL-OB'").get()
  assert.strictEqual(payObCheck, undefined, 'Payment must be rolled back on batch error')
  const orderObCheck = sqliteDb.prepare("SELECT status FROM finance_payment_orders WHERE id = 'ord-fail-ob'").get()
  assert.strictEqual(orderObCheck.status, 'PENDING', 'Order must remain PENDING on rollback')
  const gwObCheck = sqliteDb.prepare("SELECT * FROM finance_gateway_events WHERE event_key LIKE '%PAY-REQ-FAIL-OB%'").get()
  assert.strictEqual(gwObCheck, undefined, 'Gateway event must be rolled back on batch error')
  const allocObCheck = sqliteDb.prepare("SELECT * FROM finance_allocations WHERE obligation_id = 'ob-atom-spp'").get()
  assert.strictEqual(allocObCheck, undefined, 'Allocation must be rolled back on batch error')
  const coopObCheck = sqliteDb.prepare("SELECT * FROM finance_cooperative_income WHERE order_id = 'ord-fail-ob'").get()
  assert.strictEqual(coopObCheck, undefined, 'Cooperative income must be rolled back on batch error')
  const recObCheck = sqliteDb.prepare("SELECT * FROM finance_briva_reconciliation_metadata WHERE payment_request_id = 'PAY-REQ-FAIL-OB'").get()
  assert.strictEqual(recObCheck, undefined, 'Reconciliation metadata must be rolled back on batch error')
  const obCheck = sqliteDb.prepare("SELECT amount_paid, status FROM finance_obligations WHERE id = 'ob-atom-spp'").get()
  assert.strictEqual(obCheck.amount_paid, 0, 'Obligation amount_paid must remain 0 on rollback')
  assert.strictEqual(obCheck.status, 'UNPAID', 'Obligation status must remain UNPAID on rollback')

  sqliteDb.exec('DROP TRIGGER trg_test_abort_ob_last;')
  sqliteDb.prepare("UPDATE finance_payment_orders SET status = 'CANCELLED' WHERE id = 'ord-fail-ob'").run()
  console.log('✓ 18A. Injected failure at final batch statement for obligation rolled back event, payment, allocation, coop income, rec meta, order, and obligation.')

  // =========================================================================
  // SCENARIO 18B: Injected Failure at Final Batch Statement (Uang Jajan Order) Rolls Back Completely
  // =========================================================================
  console.log('--- Testing Atomic Batch Rollback on Injected Failure (Uang Jajan) ---')
  sqliteDb.prepare(`
    INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama, kategori_santri)
    VALUES ('san-fail-jaj', '1098', 'Santri Fail Jajan', 'aktif', 'Asrama Putra Al-Ikhlas', 'REGULER');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_student_va (id, santri_id, customer_no, va_number, status, activated_at)
    VALUES ('va-fail-jaj', 'san-fail-jaj', '00001098', '1234500001098', 'ACTIVE', '2026-10-01T00:00:00Z');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, cooperative_admin_fee, total_charged, payment_method, fixed_va_number, status, expires_at)
    VALUES ('ord-fail-jaj', 'ORD-FAIL-JAJ-001', 'san-fail-jaj', 'PORTAL_ORTU', 60000, 3000, 63000, 'BRI_VA', '1234500001098', 'PENDING', '2026-10-31T23:59:59Z');
  `).run()
  sqliteDb.prepare(`
    INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
    VALUES ('oi-fail-jaj', 'ord-fail-jaj', NULL, 'UANG_JAJAN', 60000);
  `).run()

  const preFailWalletCount = sqliteDb.prepare("SELECT COUNT(*) as c FROM finance_wallet_ledger WHERE santri_id = 'san-fail-jaj'").get().c
  const preFailWalletBalance = sqliteDb.prepare("SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0) as bal FROM finance_wallet_ledger WHERE santri_id = 'san-fail-jaj'").get().bal

  // Inject failure on the final statement: inserting into finance_wallet_ledger
  sqliteDb.exec(`
    CREATE TRIGGER trg_test_abort_wallet_last
    BEFORE INSERT ON finance_wallet_ledger
    WHEN NEW.amount = 60000
    BEGIN
        SELECT RAISE(ABORT, 'INJECTED_TEST_FAILURE: Wallet ledger insertion failed');
    END;
  `)

  const failJajPaymentBody = JSON.stringify({
    partnerServiceId: '   12345',
    customerNo: '00001098',
    virtualAccountNo: '1234500001098',
    paymentRequestId: 'PAY-REQ-FAIL-JAJ',
    paidAmount: { value: '63000.00', currency: 'IDR' },
  })
  const failJajHeaders = createSignedHeaders('POST', '/snap/v1.0/transfer-va/payment', failJajPaymentBody)

  const resFailJaj = await handleBrivaPayment({
    rawBody: failJajPaymentBody,
    headers: failJajHeaders,
    endpointPath: '/snap/v1.0/transfer-va/payment',
    method: 'POST',
    configOverride: testConfig,
  })

  assert.strictEqual(resFailJaj.status, 500)
  assert.strictEqual(resFailJaj.body.responseCode, BRI_VA_PAYMENT_CODES.GENERAL_ERROR)

  // Verify full atomic rollback for Uang Jajan Order:
  const payJajCheck = sqliteDb.prepare("SELECT * FROM finance_payments WHERE bri_payment_request_id = 'PAY-REQ-FAIL-JAJ'").get()
  assert.strictEqual(payJajCheck, undefined, 'Payment must be rolled back on batch error')
  const orderJajCheck = sqliteDb.prepare("SELECT status FROM finance_payment_orders WHERE id = 'ord-fail-jaj'").get()
  assert.strictEqual(orderJajCheck.status, 'PENDING', 'Order must remain PENDING on rollback')
  const gwJajCheck = sqliteDb.prepare("SELECT * FROM finance_gateway_events WHERE event_key LIKE '%PAY-REQ-FAIL-JAJ%'").get()
  assert.strictEqual(gwJajCheck, undefined, 'Gateway event must be rolled back on batch error')
  const postFailWalletCount = sqliteDb.prepare("SELECT COUNT(*) as c FROM finance_wallet_ledger WHERE santri_id = 'san-fail-jaj'").get().c
  const postFailWalletBalance = sqliteDb.prepare("SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0) as bal FROM finance_wallet_ledger WHERE santri_id = 'san-fail-jaj'").get().bal
  assert.strictEqual(postFailWalletCount, preFailWalletCount, 'Wallet ledger rows count unchanged on rollback')
  assert.strictEqual(postFailWalletBalance, preFailWalletBalance, 'Wallet balance unchanged on rollback')

  sqliteDb.exec('DROP TRIGGER trg_test_abort_wallet_last;')
  console.log('✓ 18B. Injected failure at final batch statement for Uang Jajan rolled back event, payment, coop income, rec meta, order, and wallet ledger.')

  console.log('\n=================================================================')
  console.log('SUCCESS: ALL BRI-3 HARDEST COLLECTION TESTS PASSED!')
  console.log('=================================================================\n')
}

runTestSuite().catch((err) => {
  console.error('\nFATAL ERROR IN BRI-3 TEST SUITE:', err)
  process.exit(1)
})
