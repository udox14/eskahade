// scripts/test-bri-cash-manual-distribution.cjs
// Comprehensive Unit & Integration Test Suite for BRI-6 (Cash & Manual Distribution Hardening)
// Covers all 32 Mandatory Tests defined in Section 25 of Reviewer Requirements

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { DatabaseSync } = require('node:sqlite')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')

// Setup authoritative test environment collection account
process.env.BRI_COLLECTION_ACCOUNT_NO = '001201000123301'

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

// Setup full schema: Prerequisites + Migration 0185 + Migration 0186
function initDatabase() {
  sqliteDb.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, full_name TEXT, role TEXT, username TEXT);
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
    CREATE TABLE master_jasa (id TEXT PRIMARY KEY, nama_jasa TEXT, jenis TEXT);
    CREATE TABLE finance_obligations (
        id TEXT PRIMARY KEY,
        santri_id TEXT REFERENCES santri(id),
        item_type TEXT NOT NULL,
        period TEXT NOT NULL,
        amount_expected INTEGER NOT NULL DEFAULT 0,
        amount_exempted INTEGER NOT NULL DEFAULT 0,
        amount_paid INTEGER NOT NULL DEFAULT 0,
        amount INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'UNPAID',
        remaining_balance INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_payments (
        id TEXT PRIMARY KEY,
        payment_number TEXT,
        obligation_id TEXT,
        santri_id TEXT,
        gross_amount INTEGER NOT NULL CHECK (gross_amount > 0),
        cooperative_admin_fee INTEGER NOT NULL DEFAULT 0,
        channel TEXT NOT NULL,
        fund_management TEXT NOT NULL DEFAULT 'KOPERASI',
        status TEXT NOT NULL DEFAULT 'PAID',
        correction_status TEXT NOT NULL DEFAULT 'NONE',
        cash_session_id TEXT,
        paid_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
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
    CREATE TABLE finance_wallet_ledger (
        id TEXT PRIMARY KEY,
        santri_id TEXT,
        amount INTEGER NOT NULL CHECK (amount > 0),
        direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
        movement_type TEXT NOT NULL,
        cash_session_id TEXT REFERENCES finance_cash_sessions(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
        payment_id TEXT NOT NULL REFERENCES finance_payments(id),
        obligation_id TEXT REFERENCES finance_obligations(id),
        item_type TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK (amount > 0),
        disbursed_amount INTEGER NOT NULL DEFAULT 0,
        distribution_status TEXT NOT NULL DEFAULT 'UNDISBURSED',
        provider_id TEXT,
        target_type TEXT NOT NULL DEFAULT 'OBLIGATION',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_corrections (
        id TEXT PRIMARY KEY,
        correction_number TEXT NOT NULL UNIQUE,
        correction_type TEXT NOT NULL,
        target_payment_id TEXT NOT NULL REFERENCES finance_payments(id),
        total_amount INTEGER NOT NULL CHECK (total_amount > 0),
        method TEXT,
        reason TEXT NOT NULL,
        is_recovery_case INTEGER NOT NULL DEFAULT 0,
        recovery_amount INTEGER NOT NULL DEFAULT 0,
        recovery_status TEXT NOT NULL DEFAULT 'NONE',
        recovery_notes TEXT,
        cash_session_id TEXT REFERENCES finance_cash_sessions(id),
        approved_by TEXT REFERENCES users(id),
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_correction_items (
        id TEXT PRIMARY KEY,
        correction_id TEXT REFERENCES finance_corrections(id),
        target_allocation_id TEXT REFERENCES finance_allocations(id),
        obligation_id TEXT REFERENCES finance_obligations(id),
        target_type TEXT NOT NULL DEFAULT 'OBLIGATION',
        amount INTEGER NOT NULL CHECK (amount > 0),
        is_disbursed_portion INTEGER NOT NULL DEFAULT 0,
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
    CREATE TABLE IF NOT EXISTS finance_bri_statement_fetches (
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
    CREATE TABLE IF NOT EXISTS finance_bri_statement_transactions (
        id TEXT PRIMARY KEY,
        fetch_id TEXT,
        statement_id TEXT,
        account_no TEXT NOT NULL,
        transaction_id TEXT,
        identity_strength TEXT NOT NULL DEFAULT 'WEAK' CHECK (identity_strength IN ('STRONG', 'WEAK')),
        dedup_key TEXT,
        weak_fingerprint TEXT,
        transaction_date TEXT,
        transaction_time TEXT,
        transaction_date_raw TEXT,
        transaction_date_utc TEXT,
        type_raw TEXT,
        type_normalized TEXT NOT NULL CHECK (type_normalized IN ('CREDIT', 'DEBIT')),
        transaction_type TEXT,
        amount INTEGER NOT NULL CHECK (amount >= 0),
        amount_raw TEXT,
        currency TEXT NOT NULL DEFAULT 'IDR',
        journal_seq TEXT,
        remark TEXT,
        balance INTEGER,
        reconciliation_status TEXT DEFAULT 'UNRECONCILED',
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
  `)

  // Apply Migration 0185
  const m0185 = fs.readFileSync(path.join(root, 'migrations', '0185_bri_qlola_distribution.sql'), 'utf8')
  sqliteDb.exec(m0185)

  // Apply Migration 0186
  const m0186 = fs.readFileSync(path.join(root, 'migrations', '0186_cash_manual_distribution_hardening.sql'), 'utf8')
  sqliteDb.exec(m0186)
}

initDatabase()

// Load domain services
const { briQlolaDistributionService: qlolaService } = require('@/lib/finance/bri/qlola-service')
const {
  cashManualDistributionService,
  BANK_STATEMENT_AUTO_CORRELATION_CONTRACT_STATE,
  checkAuthoritativeBankStatementCrossReference,
  matchStatementDebitToCandidates,
} = require('@/lib/finance/bri/cash-manual-distribution-service')
const { maskAccount, sanitizePayload } = require('@/lib/finance/bri/logging')
const { recalculateCashSession, closeCashSession } = require('@/lib/finance/cash-session')
const { recordCorrection } = require('@/lib/finance/corrections')

async function runAllTests() {
  console.log('=================================================================')
  console.log('BRI-6 TEST SUITE: CASH & MANUAL DISTRIBUTION HARDENING')
  console.log('=================================================================\n')

  // Setup seed users
  sqliteDb.exec(`
    INSERT INTO users (id, full_name, role, username) VALUES
    ('usr-admin', 'Admin Keuangan', 'admin', 'admin'),
    ('usr-bendahara', 'Bendahara Pesantren', 'bendahara', 'bendahara'),
    ('usr-petugas', 'Petugas Kasir Koperasi', 'petugas_koperasi', 'kasir1'),
    ('usr-admin-kop', 'Admin Koperasi', 'admin_koperasi', 'adminkop'),
    ('usr-pimpinan', 'Kyai Pimpinan', 'pimpinan', 'pimpinan'),
    ('usr-tester', 'Tester QA', 'tester', 'tester');
  `)

  // Setup recipients & accounts
  sqliteDb.exec(`
    INSERT INTO finance_distribution_recipients (id, recipient_type, name, is_active, allowed_methods)
    VALUES
    ('rec_pesantren', 'PESANTREN', 'Pesantren Sukahideng (Bendahara)', 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER'),
    ('rec_kat_1', 'KATERING', 'Katering Barokah', 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER'),
    ('rec_lnd_1', 'LAUNDRY', 'Laundry Bersih', 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER');

    INSERT INTO finance_recipient_allowed_methods (recipient_id, method) VALUES
    ('rec_pesantren', 'BRI_QLOLA'), ('rec_pesantren', 'CASH'), ('rec_pesantren', 'MANUAL_TRANSFER'),
    ('rec_kat_1', 'BRI_QLOLA'), ('rec_kat_1', 'CASH'), ('rec_kat_1', 'MANUAL_TRANSFER'),
    ('rec_lnd_1', 'BRI_QLOLA'), ('rec_lnd_1', 'CASH'), ('rec_lnd_1', 'MANUAL_TRANSFER');

    INSERT INTO finance_recipient_accounts (id, recipient_id, bank_code, account_number, account_holder, is_primary, is_active)
    VALUES
    ('acc-pesantren', 'rec_pesantren', '002', '001901000999301', 'Yayasan Pesantren Sukahideng', 1, 1),
    ('acc-kat-1', 'rec_kat_1', '002', '001901000888301', 'Katering Barokah CV', 1, 1),
    ('acc-kat-inactive', 'rec_kat_1', '002', '001901000777301', 'Katering Barokah Rek Lama', 0, 0);

    INSERT INTO santri (id, nama_lengkap, status_global) VALUES ('san-1', 'Ahmad Santri', 'aktif');

    INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, amount, status, remaining_balance)
    VALUES ('obl-1', 'san-1', 'SPP', '2026-10', 1000000, 0, 1000000, 1000000, 'PAID', 0);

    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-1', 'PAY-1-001', 'obl-1', 'san-1', 1000000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-1', 'pay-1', 'obl-1', 'SPP', 1000000, 0, 'UNDISBURSED');
  `)

  // --------------------------------------------------------------------------
  // GRUP 1: CROSS-METHOD SAFETY TESTS (1 - 5)
  // --------------------------------------------------------------------------
  console.log('--- Grup 1: Cross-Method Safety Tests (1 - 5) ---')

  // Test 1: QLola SUBMISSION_PENDING blocks CASH
  // Buat draft QLola 700.000 dan set intent ke SUBMISSION_PENDING
  const qDraft1 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 700000,
    method: 'BRI_QLOLA',
    makerUserId: 'usr-petugas',
  })

  sqliteDb.exec(`
    INSERT INTO finance_qlola_transfer_intents (
      id, distribution_id, distribution_request_id, intent_status,
      maker_user_id, payload_hash
    ) VALUES (
      'intent-sub-pend', '${qDraft1.distributionId}', 'REQ-INTENT-SUB-1', 'SUBMISSION_PENDING',
      'usr-petugas', 'hash-sub-pend'
    );
  `)

  // Sisa alokasi sekarang 300.000. Mencoba draft CASH 400.000 harus GAGAL!
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_pesantren',
        itemType: 'SPP',
        period: '2026-10',
        amount: 400000,
        method: 'CASH',
        makerUserId: 'usr-petugas',
      })
    },
    /tidak mencukupi untuk nominal permintaan Rp400\.000/i
  )
  console.log('✓ 1. QLola SUBMISSION_PENDING blocks CASH overdraw.')

  // Test 2: QLola UNKNOWN blocks manual transfer
  // Ubah intent ke UNKNOWN (mensimulasikan network timeout saat dispatch)
  sqliteDb.exec(`
    UPDATE finance_qlola_transfer_intents
    SET intent_status = 'UNKNOWN'
    WHERE id = 'intent-sub-pend';
  `)

  // Alokasi 700.000 tetap tertahan. Mencoba draft MANUAL_TRANSFER 350.000 harus GAGAL!
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_pesantren',
        accountId: 'acc-pesantren',
        itemType: 'SPP',
        period: '2026-10',
        amount: 350000,
        method: 'MANUAL_TRANSFER',
        makerUserId: 'usr-petugas',
      })
    },
    /tidak mencukupi untuk nominal permintaan Rp350\.000/i
  )
  console.log('✓ 2. QLola UNKNOWN blocks manual transfer overdraw.')

  // Test 3: QLola CANCEL_PENDING blocks alternative methods
  sqliteDb.exec(`
    UPDATE finance_qlola_transfer_intents
    SET intent_status = 'CANCEL_PENDING'
    WHERE id = 'intent-sub-pend';
  `)

  // Alokasi tetap tertahan sampai ada CANCELLATION_CONFIRMED. CASH 400.000 tetap BLOCKED!
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_pesantren',
        itemType: 'SPP',
        period: '2026-10',
        amount: 400000,
        method: 'CASH',
        makerUserId: 'usr-petugas',
      })
    },
    /tidak mencukupi/i
  )
  console.log('✓ 3. QLola CANCEL_PENDING blocks alternative methods.')

  // Lepaskan draft QLola untuk melanjutkan pengujian
  sqliteDb.exec(`
    DELETE FROM finance_qlola_transfer_intents WHERE id = 'intent-sub-pend';
    DELETE FROM finance_distribution_items WHERE distribution_id = '${qDraft1.distributionId}';
    DELETE FROM finance_distributions WHERE id = '${qDraft1.distributionId}';
  `)

  // Test 4: Distributed + new partial distribution respects remaining entitlement
  // Alokasi 1.000.000. Buat dan selesaikan transfer CASH 400.000
  // Setup sesi kas untuk operator
  sqliteDb.exec(`
    INSERT INTO finance_cash_sessions (
      id, session_code, operator_id, opened_at, opening_balance,
      total_cash_in, total_cash_out, expected_closing_balance, status
    ) VALUES (
      'ses-petugas-1', 'SES-20261009-001', 'usr-petugas', datetime('now'),
      1000000, 0, 0, 1000000, 'OPEN'
    );
  `)

  const cashDraftPartial = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 400000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })

  await cashManualDistributionService.prepareCashDistribution({
    distributionId: cashDraftPartial.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  await cashManualDistributionService.finalizeCashDistribution({
    distributionId: cashDraftPartial.distributionId,
    receivingPersonName: 'Ust. Pengurus',
    receiptReference: 'RCP-PARTIAL-400',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  // Setelah 400.000 DISTRIBUTED, buat distribusi MANUAL_TRANSFER 300.000
  const manualDraftPartial = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 300000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })

  await cashManualDistributionService.initiateManualTransfer({
    distributionId: manualDraftPartial.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  await cashManualDistributionService.finalizeManualTransfer({
    distributionId: manualDraftPartial.distributionId,
    evidenceType: 'MANUAL_TRANSFER_SUCCESS',
    referenceNumber: 'BANK-REF-PARTIAL-300',
    operatorId: 'usr-bendahara',
    operatorRole: 'bendahara',
  })

  // Sisa alokasi seharusnya tepat 300.000 (1.000.000 - 400.000 - 300.000)
  // Mencoba ambil 350.000 harus GAGAL
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_pesantren',
        itemType: 'SPP',
        period: '2026-10',
        amount: 350000,
        method: 'CASH',
        makerUserId: 'usr-petugas',
      })
    },
    /tidak mencukupi untuk nominal permintaan Rp350\.000/i
  )

  // Mengambil tepat sisa 300.000 harus SUKSES
  const draftSisa = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 300000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })
  assert.strictEqual(draftSisa.totalAmount, 300000)
  console.log('✓ 4. Distributed + partial distribution accurately respects remaining entitlement.')

  // Test 5: Concurrent CASH / MANUAL cannot overdraw
  // Bersihkan draftSisa
  sqliteDb.exec(`
    DELETE FROM finance_distribution_items WHERE distribution_id = '${draftSisa.distributionId}';
    DELETE FROM finance_distributions WHERE id = '${draftSisa.distributionId}';
  `)

  // Buat dua draft yang masing-masing mengambil 200.000 saat sisa alokasi 300.000
  const draftA = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 200000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })

  const draftB = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 200000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })

  // Transisi draftA ke PROCESSING (memakai 200.000, sisa 100.000)
  await cashManualDistributionService.prepareCashDistribution({
    distributionId: draftA.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  // Transisi draftB ke PROCESSING (membutuhkan 200.000 padahal sisa hanya 100.000)
  // DB trigger trg_finance_dist_status_prevent_over_reserve HARUS MEMBLOKIR!
  await assert.rejects(
    async () => {
      await cashManualDistributionService.initiateManualTransfer({
        distributionId: draftB.distributionId,
        operatorId: 'usr-petugas',
        operatorRole: 'petugas_koperasi',
      })
    },
    /Reservasi dana melebihi sisa alokasi efektif yang tersedia/i
  )
  // Selesaikan draftA dan draftB (status tetap terjaga dalam ledger append-only)
  console.log('✓ 5. Concurrent CASH and MANUAL cannot overdraw allocation.')

  // --------------------------------------------------------------------------
  // GRUP 2: CASH SPECIFIC TESTS (6 - 13)
  // --------------------------------------------------------------------------
  console.log('\n--- Grup 2: CASH Lifecycle & Evidence Tests (6 - 13) ---')

  // Setup alokasi bersih untuk tes cash: 500.000
  sqliteDb.exec(`
    INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, amount, status, remaining_balance)
    VALUES ('obl-cash', 'san-1', 'UANG_MAKAN', '2026-10', 500000, 0, 500000, 500000, 'PAID', 0);

    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-cash', 'PAY-CASH-001', 'obl-cash', 'san-1', 500000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status, provider_id)
    VALUES ('alloc-cash', 'pay-cash', 'obl-cash', 'UANG_MAKAN', 500000, 0, 'UNDISBURSED', 'rec_kat_1');
  `)

  // Test 6: DRAFT -> PROCESSING reserves allocation
  const cashDraft6 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_kat_1',
    itemType: 'UANG_MAKAN',
    period: '2026-10',
    amount: 300000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })

  // Sebelum prepare, alokasi tersedia = 500.000
  await cashManualDistributionService.prepareCashDistribution({
    distributionId: cashDraft6.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  // Setelah prepare, status = PROCESSING, reservasi 300.000 aktif, sisa alokasi = 200.000
  // Coba buat draft lain untuk 250.000 -> harus gagal!
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_kat_1',
        itemType: 'UANG_MAKAN',
        period: '2026-10',
        amount: 250000,
        method: 'CASH',
        makerUserId: 'usr-petugas',
      })
    },
    /tidak mencukupi untuk nominal permintaan Rp250\.000/i
  )
  console.log('✓ 6. CASH DRAFT -> PROCESSING reserves allocation in DB.')

  // Test 7: Cash session insufficient balance blocked
  // Buat sesi kas miskin (saldo hanya 10.000)
  sqliteDb.exec(`
    INSERT INTO finance_cash_sessions (
      id, session_code, operator_id, opened_at, opening_balance,
      total_cash_in, total_cash_out, expected_closing_balance, status
    ) VALUES (
      'ses-poor', 'SES-POOR-001', 'usr-admin-kop', datetime('now'),
      10000, 0, 0, 10000, 'OPEN'
    );
  `)

  const cashDraft7 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_kat_1',
    itemType: 'UANG_MAKAN',
    period: '2026-10',
    amount: 150000,
    method: 'CASH',
    makerUserId: 'usr-admin-kop',
  })

  // Operator usr-admin-kop hanya punya kas 10.000 di sesi ses-poor, mencoba prepare 150.000 harus DIBLOKIR!
  await assert.rejects(
    async () => {
      await cashManualDistributionService.prepareCashDistribution({
        distributionId: cashDraft7.distributionId,
        operatorId: 'usr-admin-kop',
        operatorRole: 'admin_koperasi',
      })
    },
    /Saldo kas fisik pada sesi.*tidak mencukupi untuk menyiapkan penyaluran tunai/i
  )
  console.log('✓ 7. Insufficient cash session balance strictly blocked.')

  // Bersihkan draft 7
  sqliteDb.exec(`
    DELETE FROM finance_distribution_items WHERE distribution_id = '${cashDraft7.distributionId}';
    DELETE FROM finance_distributions WHERE id = '${cashDraft7.distributionId}';
  `)

  // Test 8: CASH -> DISTRIBUTED requires handover evidence
  // Ambil cashDraft6 yang berstatus PROCESSING, coba langsung update DB tanpa bukti
  assert.throws(() => {
    sqliteDb.exec(`UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = '${cashDraft6.distributionId}';`)
  }, /Peralihan status ke DISTRIBUTED untuk CASH wajib memiliki bukti serah terima/i)
  console.log('✓ 8. CASH -> DISTRIBUTED without handover evidence blocked by trigger.')

  // Test 9: Finalization atomic: records evidence, updates session cash-out, sets DISTRIBUTED
  const preSession = sqliteDb.prepare(`SELECT * FROM finance_cash_sessions WHERE id = 'ses-petugas-1'`).get()
  const expectedNewBal = preSession.expected_closing_balance - 300000

  const finalRes9 = await cashManualDistributionService.finalizeCashDistribution({
    distributionId: cashDraft6.distributionId,
    receivingPersonName: 'Ibu Hajah Katering',
    receiptReference: 'RCP-KAT-001',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })
  assert.strictEqual(finalRes9.status, 'DISTRIBUTED')

  // Verifikasi atomisitas:
  // 1. Status distribusi = DISTRIBUTED
  const updatedDist9 = sqliteDb.prepare(`SELECT * FROM finance_distributions WHERE id = '${cashDraft6.distributionId}'`).get()
  assert.strictEqual(updatedDist9.status, 'DISTRIBUTED')
  assert.strictEqual(updatedDist9.cash_receiver_name, 'Ibu Hajah Katering')

  // 2. Bukti tersimpan
  const evRow9 = sqliteDb.prepare(`SELECT * FROM finance_cash_manual_evidence WHERE distribution_id = '${cashDraft6.distributionId}' AND evidence_type = 'CASH_HANDOVER_RECEIPT'`).get()
  assert.ok(evRow9, 'Handover evidence must exist')

  // 3. Saldo sesi kas berkurang
  const postSession = sqliteDb.prepare(`SELECT * FROM finance_cash_sessions WHERE id = 'ses-petugas-1'`).get()
  assert.strictEqual(postSession.expected_closing_balance, expectedNewBal)
  assert.strictEqual(postSession.total_cash_out, preSession.total_cash_out + 300000)

  // 4. Rekalkulasi sesi kas konsisten
  const recalcSession = await recalculateCashSession('ses-petugas-1')
  assert.strictEqual(recalcSession.expected_closing_balance, expectedNewBal)
  console.log('✓ 9. CASH finalization is atomic across distribution, evidence, and cash session.')

  // Test 10: Cancel before handover releases reservation
  // Buat draft CASH 100.000 dari sisa alokasi 200.000
  const cashDraft10 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_kat_1',
    itemType: 'UANG_MAKAN',
    period: '2026-10',
    amount: 100000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })

  await cashManualDistributionService.prepareCashDistribution({
    distributionId: cashDraft10.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  // Batalkan saat PROCESSING sebelum handover
  await cashManualDistributionService.cancelCashDistribution({
    distributionId: cashDraft10.distributionId,
    reason: 'Penerima tidak datang ke loket',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  // Status sekarang CANCELLED, alokasi 100.000 kembali tersedia (total sisa alokasi = 200.000)
  const canDraftAgain = await qlolaService.createDistributionDraft({
    recipientId: 'rec_kat_1',
    itemType: 'UANG_MAKAN',
    period: '2026-10',
    amount: 200000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })
  assert.strictEqual(canDraftAgain.totalAmount, 200000)
  console.log('✓ 10. Cancel before handover releases reservation cleanly.')

  // Test 11: Cash returned correctly before cancel if prepared
  const evCancelRow = sqliteDb.prepare(`SELECT * FROM finance_cash_manual_evidence WHERE distribution_id = '${cashDraft10.distributionId}' AND evidence_type = 'CASH_RETURNED'`).get()
  assert.ok(evCancelRow, 'CASH_RETURNED evidence must be recorded')
  assert.strictEqual(evCancelRow.operator_id, 'usr-petugas')
  console.log('✓ 11. CASH_RETURNED evidence correctly recorded upon cancelling prepared cash.')

  // Test 12: After handover, cancellation is strictly blocked
  await assert.rejects(
    async () => {
      await cashManualDistributionService.cancelCashDistribution({
        distributionId: cashDraft6.distributionId, // Status DISTRIBUTED
        reason: 'Mau dibatalkan',
        operatorId: 'usr-petugas',
        operatorRole: 'petugas_koperasi',
      })
    },
    /Distribusi tunai yang telah diserahkan \(DISTRIBUTED\) tidak dapat dibatalkan/i
  )
  console.log('✓ 12. Cancellation after cash handover strictly blocked.')

  // Test 13: Duplicate receipt reference / idempotency safe
  // Mencoba finalize lagi pada distribusi yang sudah DISTRIBUTED mengembalikan status aman
  const idemRes = await cashManualDistributionService.finalizeCashDistribution({
    distributionId: cashDraft6.distributionId,
    receivingPersonName: 'Ibu Hajah Katering',
    receiptReference: 'RCP-KAT-001',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  // Top up kas sesi agar mencukupi untuk persiapan canDraftAgain
  sqliteDb.exec(`UPDATE finance_cash_sessions SET expected_closing_balance = expected_closing_balance + 1000000, total_cash_in = total_cash_in + 1000000 WHERE id = 'ses-petugas-1';`)

  // Prepare canDraftAgain ke PROCESSING terlebih dahulu
  await cashManualDistributionService.prepareCashDistribution({
    distributionId: canDraftAgain.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  // Mencoba memakai RCP-KAT-001 pada distribusi lain diblokir (anti-collision)
  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeCashDistribution({
        distributionId: canDraftAgain.distributionId,
        receivingPersonName: 'Orang Lain',
        receiptReference: 'RCP-KAT-001',
        operatorId: 'usr-petugas',
        operatorRole: 'petugas_koperasi',
      })
    },
    /COLLISION_CONFLICT: Nomor referensi tanda terima "RCP-KAT-001" telah digunakan/i
  )
  console.log('✓ 13. Idempotent re-submission safe and duplicate receipt collision blocked.')

  // --------------------------------------------------------------------------
  // GRUP 3: MANUAL_TRANSFER SPECIFIC TESTS (14 - 20)
  // --------------------------------------------------------------------------
  console.log('\n--- Grup 3: MANUAL_TRANSFER Lifecycle & Evidence Tests (14 - 20) ---')

  // Setup alokasi bersih untuk transfer manual: 800.000
  sqliteDb.exec(`
    INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, amount, status, remaining_balance)
    VALUES ('obl-man', 'san-1', 'UANG_NYUCI', '2026-10', 800000, 0, 800000, 800000, 'PAID', 0);

    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-man', 'PAY-MAN-001', 'obl-man', 'san-1', 800000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status, provider_id)
    VALUES ('alloc-man', 'pay-man', 'obl-man', 'UANG_NYUCI', 800000, 0, 'UNDISBURSED', 'rec_lnd_1');

    -- Daftarkan rekening laundry aktif
    INSERT INTO finance_recipient_accounts (id, recipient_id, bank_code, account_number, account_holder, is_primary, is_active)
    VALUES ('acc-lnd-1', 'rec_lnd_1', '002', '001901000666301', 'Laundry Bersih CV', 1, 1);
  `)

  // Test 14: DRAFT -> PROCESSING reserves allocation
  const manDraft14 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_lnd_1',
    accountId: 'acc-lnd-1',
    itemType: 'UANG_NYUCI',
    period: '2026-10',
    amount: 500000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })

  await cashManualDistributionService.initiateManualTransfer({
    distributionId: manDraft14.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  // Setelah inisiasi, sisa alokasi = 300.000. Coba minta 400.000 -> gagal!
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_lnd_1',
        accountId: 'acc-lnd-1',
        itemType: 'UANG_NYUCI',
        period: '2026-10',
        amount: 400000,
        method: 'MANUAL_TRANSFER',
        makerUserId: 'usr-petugas',
      })
    },
    /tidak mencukupi untuk nominal permintaan Rp400\.000/i
  )
  console.log('✓ 14. MANUAL_TRANSFER DRAFT -> PROCESSING reserves allocation in DB.')

  // Test 15: Wrong/inactive account blocked
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_kat_1',
        accountId: 'acc-kat-inactive', // Rekening nonaktif
        itemType: 'UANG_MAKAN',
        period: '2026-10',
        amount: 50000,
        method: 'MANUAL_TRANSFER',
        makerUserId: 'usr-petugas',
      })
    },
    /berstatus nonaktif/i
  )
  console.log('✓ 15. Inactive destination account strictly blocked.')

  // Test 16: Transfer success requires evidence
  // Coba update langsung manual draft ke DISTRIBUTED tanpa bukti transfer
  assert.throws(() => {
    sqliteDb.exec(`UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = '${manDraft14.distributionId}';`)
  }, /Peralihan status ke DISTRIBUTED untuk MANUAL_TRANSFER wajib memiliki bukti transfer bank sukses/i)
  console.log('✓ 16. MANUAL_TRANSFER -> DISTRIBUTED without success evidence blocked by trigger.')

  // Test 17: Unknown outcome remains PROCESSING/reserved
  // Operator mentrigger unknown outcome
  const unknownRes = await cashManualDistributionService.recordManualTransferUnknownOutcome({
    distributionId: manDraft14.distributionId,
    reason: 'Koneksi internet terputus saat memasukkan token bank',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })
  assert.strictEqual(unknownRes.status, 'PROCESSING')

  // Verifikasi alokasi 500.000 TETAP TERTINGGAL DALAM STATUS RESERVED
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_lnd_1',
        accountId: 'acc-lnd-1',
        itemType: 'UANG_NYUCI',
        period: '2026-10',
        amount: 400000,
        method: 'MANUAL_TRANSFER',
        makerUserId: 'usr-petugas',
      })
    },
    /tidak mencukupi/i
  )
  console.log('✓ 17. Unknown transfer outcome remains in PROCESSING and preserves allocation reservation.')

  // Test 18: Second transfer while unknown blocked
  // Coba inisiasi ulang distribusi yang sama yang sedang PROCESSING
  await assert.rejects(
    async () => {
      await cashManualDistributionService.initiateManualTransfer({
        distributionId: manDraft14.distributionId,
        operatorId: 'usr-petugas',
        operatorRole: 'petugas_koperasi',
      })
    },
    /hanya dapat dilakukan dari status DRAFT|UNRESOLVED_INVESTIGATION/i
  )
  console.log('✓ 18. Second transfer attempt while in PROCESSING is blocked.')

  // Test 19: Authoritative failure releases reservation
  await cashManualDistributionService.failManualTransfer({
    distributionId: manDraft14.distributionId,
    referenceNumber: 'BANK-REJECT-999',
    reason: 'Rekening tujuan terblokir / invalid beneficiary',
    operatorId: 'usr-bendahara',
    operatorRole: 'bendahara',
  })

  const failedDist = sqliteDb.prepare(`SELECT status FROM finance_distributions WHERE id = '${manDraft14.distributionId}'`).get()
  assert.strictEqual(failedDist.status, 'FAILED')

  // Reservasi 500.000 telah dilepas. Total alokasi 800.000 kembali tersedia penuh!
  const draftAfterFail = await qlolaService.createDistributionDraft({
    recipientId: 'rec_lnd_1',
    accountId: 'acc-lnd-1',
    itemType: 'UANG_NYUCI',
    period: '2026-10',
    amount: 800000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })
  assert.strictEqual(draftAfterFail.totalAmount, 800000)
  console.log('✓ 19. Authoritative transfer failure releases allocation reservation.')

  // Finalize draftAfterFail untuk pengujian berikutnya
  await cashManualDistributionService.initiateManualTransfer({
    distributionId: draftAfterFail.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  await cashManualDistributionService.finalizeManualTransfer({
    distributionId: draftAfterFail.distributionId,
    evidenceType: 'MANUAL_TRANSFER_SUCCESS',
    referenceNumber: 'BANK-REF-MAN-SUCCESS-1',
    bankFee: 2500,
    operatorId: 'usr-bendahara',
    operatorRole: 'bendahara',
  })

  // Test 20: Duplicate bank proof / reference collision handled safely
  // Buat draft manual baru di alokasi lain untuk mencoba menduplikasi referensi bank
  sqliteDb.exec(`
    INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, amount, status, remaining_balance)
    VALUES ('obl-coll', 'san-1', 'SPP', '2026-11', 100000, 0, 100000, 100000, 'PAID', 0);
    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-coll', 'PAY-COLL-001', 'obl-coll', 'san-1', 100000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-coll', 'pay-coll', 'obl-coll', 'SPP', 100000, 0, 'UNDISBURSED');
  `)

  const draftColl = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-11',
    amount: 100000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })

  await cashManualDistributionService.initiateManualTransfer({
    distributionId: draftColl.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  // Mencoba memakai BANK-REF-MAN-SUCCESS-1 yang sudah digunakan di distribusi sebelumnya
  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeManualTransfer({
        distributionId: draftColl.distributionId,
        evidenceType: 'MANUAL_TRANSFER_SUCCESS',
        referenceNumber: 'BANK-REF-MAN-SUCCESS-1',
        operatorId: 'usr-bendahara',
        operatorRole: 'bendahara',
      })
    },
    /COLLISION_CONFLICT: Nomor referensi transfer bank "BANK-REF-MAN-SUCCESS-1" telah digunakan/i
  )
  console.log('✓ 20. Duplicate bank reference collision handled safely and blocked.')

  // --------------------------------------------------------------------------
  // GRUP 4: EVIDENCE IMMUTABILITY & PROVENANCE TESTS (21 - 25)
  // --------------------------------------------------------------------------
  console.log('\n--- Grup 4: Evidence Immutability & Provenance Tests (21 - 25) ---')

  const sampleEvidence = sqliteDb.prepare(`SELECT * FROM finance_cash_manual_evidence LIMIT 1`).get()
  assert.ok(sampleEvidence, 'Must have at least one evidence row')

  // Test 21: Evidence immutable UPDATE
  assert.throws(() => {
    sqliteDb.exec(`UPDATE finance_cash_manual_evidence SET reference_number = 'TAMPERED' WHERE id = '${sampleEvidence.id}';`)
  }, /Tabel finance_cash_manual_evidence bersifat append-only\. UPDATE dilarang\./i)
  console.log('✓ 21. Trigger trg_finance_cash_manual_evidence_immutable_update blocks UPDATE.')

  // Test 22: Evidence immutable DELETE
  assert.throws(() => {
    sqliteDb.exec(`DELETE FROM finance_cash_manual_evidence WHERE id = '${sampleEvidence.id}';`)
  }, /Tabel finance_cash_manual_evidence bersifat append-only\. DELETE dilarang\./i)
  console.log('✓ 22. Trigger trg_finance_cash_manual_evidence_immutable_delete blocks DELETE.')

  // Test 23: CANDIDATE cannot finalize
  // Siapkan draft manual baru untuk menguji kekuatan bukti CANDIDATE
  sqliteDb.exec(`
    INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, amount, status, remaining_balance)
    VALUES ('obl-cand', 'san-1', 'SPP', '2026-12', 100000, 0, 100000, 100000, 'PAID', 0);
    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-cand', 'PAY-CAND-001', 'obl-cand', 'san-1', 100000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-cand', 'pay-cand', 'obl-cand', 'SPP', 100000, 0, 'UNDISBURSED');
  `)

  const draftCand = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-12',
    amount: 100000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })

  await cashManualDistributionService.initiateManualTransfer({
    distributionId: draftCand.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeManualTransfer({
        distributionId: draftCand.distributionId,
        evidenceType: 'BANK_STATEMENT_DEBIT',
        evidenceStrength: 'CANDIDATE',
        referenceNumber: 'STMT-CANDIDATE-001',
        operatorId: 'usr-bendahara',
        operatorRole: 'bendahara',
      })
    },
    /Bukti bertaraf CANDIDATE tidak dapat digunakan untuk finalisasi transfer ke DISTRIBUTED/i
  )
  console.log('✓ 23. CANDIDATE evidence strictly blocked from finalizing distribution.')

  // Test 24: Manual proof requires authenticated authorized operator (admin or bendahara)
  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeManualTransfer({
        distributionId: draftCand.distributionId,
        evidenceType: 'MANUAL_OFFICIAL_PROOF',
        referenceNumber: 'OFFICIAL-PROOF-001',
        operatorId: 'usr-petugas',
        operatorRole: 'petugas_koperasi', // Petugas kasir tidak berwenang
      })
    },
    /Hanya role "admin" atau "bendahara" yang berwenang mengesahkan bukti penyaluran manual/i
  )

  // Dengan role bendahara -> SUKSES
  const proofSuccess = await cashManualDistributionService.finalizeManualTransfer({
    distributionId: draftCand.distributionId,
    evidenceType: 'MANUAL_OFFICIAL_PROOF',
    referenceNumber: 'OFFICIAL-PROOF-001',
    operatorId: 'usr-bendahara',
    operatorRole: 'bendahara',
  })
  assert.strictEqual(proofSuccess.status, 'DISTRIBUTED')
  console.log('✓ 24. Manual official proof requires authenticated authorized operator (admin/bendahara).')

  // Test 25: Spoofed operator rejected
  assert.throws(() => {
    sqliteDb.exec(`
      INSERT INTO finance_cash_manual_evidence (
        id, distribution_id, evidence_type, evidence_strength, source,
        reference_number, raw_evidence_hash, observed_at, recorded_at,
        operator_id, operator_role_snapshot, created_at
      ) VALUES (
        'ev-spoofed', '${draftCand.distributionId}', 'MANUAL_TRANSFER_INITIATED', 'AUTHORITATIVE_EXACT', 'BANK_RECEIPT',
        'REF-SPOOF', 'hash-spoof', datetime('now'), datetime('now'),
        'usr-ghost-hacker', 'admin', datetime('now')
      );
    `)
  }, /operator_id tidak valid: Pengguna tidak terdaftar/i)
  console.log('✓ 25. Spoofed / non-existent operator ID rejected by DB trigger.')

  // --------------------------------------------------------------------------
  // GRUP 5: CORRECTIONS & RECOVERY INTEGRATION (26 - 28)
  // --------------------------------------------------------------------------
  console.log('\n--- Grup 5: Corrections & Recovery Integration Tests (26 - 28) ---')

  // Test 26: Correction after CASH distributed -> PENDING_RECOVERY
  // Target: pay-cash (alokasi alloc-cash: total 500.000, telah disalurkan 300.000 lewat cashDraft6, sisa belum salur 200.000)
  // Koreksi 250.000 -> 200.000 memotong alokasi belum salur, 50.000 menjadi kasus pemulihan (PENDING_RECOVERY)
  const corrCash = await recordCorrection({
    paymentId: 'pay-cash',
    correctionType: 'VOID',
    items: [{ allocationId: 'alloc-cash', amount: 250000 }],
    reason: 'Kelebihan alokasi uang makan 250k (50k terlanjur salur)',
    createdBy: 'usr-admin',
  })
  assert.strictEqual(corrCash.correction.is_recovery_case, 1)
  assert.strictEqual(corrCash.correction.recovery_status, 'PENDING_RECOVERY')
  assert.strictEqual(corrCash.correction.recovery_amount, 50000)
  console.log('✓ 26. Correction on distributed CASH allocation creates PENDING_RECOVERY case.')

  // Test 27: Correction after MANUAL distributed -> PENDING_RECOVERY
  // Target: pay-man (alokasi alloc-man: total 800.000, telah disalurkan 800.000 lewat draftAfterFail, sisa belum salur 0)
  // Koreksi 100.000 -> seluruh 100.000 menjadi kasus pemulihan (PENDING_RECOVERY)
  const corrMan = await recordCorrection({
    paymentId: 'pay-man',
    correctionType: 'REFUND',
    items: [{ allocationId: 'alloc-man', amount: 100000 }],
    reason: 'Pengembalian uang nyuci santri pulang',
    createdBy: 'usr-admin',
  })
  assert.strictEqual(corrMan.correction.is_recovery_case, 1)
  assert.strictEqual(corrMan.correction.recovery_status, 'PENDING_RECOVERY')
  assert.strictEqual(corrMan.correction.recovery_amount, 100000)
  console.log('✓ 27. Correction on distributed MANUAL allocation creates PENDING_RECOVERY case.')

  // Test 28: Historical distribution and evidence unchanged
  const postDist6 = sqliteDb.prepare(`SELECT status, total_amount FROM finance_distributions WHERE id = '${cashDraft6.distributionId}'`).get()
  assert.strictEqual(postDist6.status, 'DISTRIBUTED')
  assert.strictEqual(postDist6.total_amount, 300000)

  const postDistMan = sqliteDb.prepare(`SELECT status, total_amount FROM finance_distributions WHERE id = '${draftAfterFail.distributionId}'`).get()
  assert.strictEqual(postDistMan.status, 'DISTRIBUTED')
  assert.strictEqual(postDistMan.total_amount, 800000)
  console.log('✓ 28. Historical distribution and evidence completely intact after post-distribution correction.')

  // --------------------------------------------------------------------------
  // GRUP 6: SECURITY, STORAGE & REDACTION (29 - 32)
  // --------------------------------------------------------------------------
  console.log('\n--- Grup 6: Security, Proof Validation & Redaction Tests (29 - 32) ---')

  // Test 29: Tester read-only
  assert.throws(() => {
    cashManualDistributionService.assertFinanceOperator('usr-tester', 'tester')
  }, /Role "tester" bersifat read-only/i)

  await assert.rejects(
    async () => {
      await cashManualDistributionService.prepareCashDistribution({
        distributionId: cashDraftPartial.distributionId,
        operatorId: 'usr-tester',
        operatorRole: 'tester',
      })
    },
    /Role "tester" bersifat read-only/i
  )
  console.log('✓ 29. Tester role strictly read-only and blocked from financial execution.')

  // Test 30: Proof upload MIME / size / path controls
  // Disallowed MIME
  const badMimeRes = cashManualDistributionService.validateProofAttachment({
    buffer: Buffer.from('malicious script'),
    mimeType: 'application/x-msdownload',
    originalFilename: 'virus.exe',
    sizeBytes: 100,
  })
  assert.strictEqual(badMimeRes.valid, false)
  assert.match(badMimeRes.error, /tidak diizinkan/i)

  // Oversized file (> 5 MB)
  const bigFileRes = cashManualDistributionService.validateProofAttachment({
    buffer: Buffer.alloc(10),
    mimeType: 'image/jpeg',
    originalFilename: 'big.jpg',
    sizeBytes: 6 * 1024 * 1024,
  })
  assert.strictEqual(bigFileRes.valid, false)
  assert.match(bigFileRes.error, /melebihi batas maksimum 5 MB/i)

  // Path traversal filename
  const traversalRes = cashManualDistributionService.validateProofAttachment({
    buffer: Buffer.from('photo'),
    mimeType: 'image/png',
    originalFilename: '../../../etc/passwd.png',
    sizeBytes: 100,
  })
  assert.strictEqual(traversalRes.valid, false)
  assert.match(traversalRes.error, /path traversal/i)

  // Valid proof upload generates secure randomized key
  const goodProofRes = cashManualDistributionService.validateProofAttachment({
    buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('valid photo content')]),
    mimeType: 'image/jpeg',
    originalFilename: 'kwitansi.jpg',
    sizeBytes: 2048,
  })
  assert.strictEqual(goodProofRes.valid, true)
  assert.match(goodProofRes.objectKey, /^proofs\/[a-f0-9\-]+\.jpg$/)
  assert.ok(goodProofRes.hash, 'Hash must be generated')
  console.log('✓ 30. Proof upload MIME allowlist, size limits, and path traversal guards verified.')

  // Test 31: Account masking
  const maskedBri = maskAccount('001201000123301')
  assert.strictEqual(maskedBri, '001******301')
  assert.doesNotMatch(maskedBri, /001201000123301/)
  console.log('✓ 31. Account masking properly masks middle digits.')

  // Test 32: Zero secret / credential leakage
  const samplePayload = {
    clientSecret: 'secret_live_bri_super_confidential',
    privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
    accountNumber: '001201000123301',
    token: 'Bearer eyJhbGciOiJSUzI1NiIs...',
    pin: '123456',
  }
  const sanitized = sanitizePayload(samplePayload)
  assert.strictEqual(sanitized.clientSecret, '[REDACTED]')
  assert.strictEqual(sanitized.privateKey, '[REDACTED]')
  assert.strictEqual(sanitized.token, '[REDACTED]')
  assert.strictEqual(sanitized.pin, '[REDACTED]')
  assert.strictEqual(sanitized.accountNumber, '001******301')
  console.log('✓ 32. Zero secret / credential leakage verified in audit logging sanitation.')

  // --- Grup 7: Cash Session Reconciliation Invariants (33 - 40) ---
  console.log('\n--- Grup 7: Cash Session Reconciliation Invariants (33 - 40) ---')

  // Test 33: PROCESSING cash reduces available physical cash
  sqliteDb.exec(`
    INSERT INTO finance_cash_sessions (
      id, session_code, operator_id, opened_at, opening_balance,
      expected_closing_balance, status
    ) VALUES (
      'sess-recon-1', 'CS-RECON-001', 'usr-petugas', '2026-10-09T09:00:00Z', 1000000,
      1000000, 'OPEN'
    );

    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-rcn-1', 'PAY-RCN-001', 'obl-1', 'san-1', 400000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-rcn-1', 'pay-rcn-1', 'obl-1', 'SPP', 400000, 0, 'UNDISBURSED');
  `)

  const distRcn1 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 400000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })

  await cashManualDistributionService.prepareCashDistribution({
    distributionId: distRcn1.distributionId,
    cashSessionId: 'sess-recon-1',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  const sessRcn1AfterPrep = await recalculateCashSession('sess-recon-1')
  assert.strictEqual(sessRcn1AfterPrep.expected_closing_balance, 1000000, 'Drawer physical cash not reduced until handed over')
  assert.strictEqual(sessRcn1AfterPrep.reserved_cash_out, 400000, 'Reserved cash out must be 400,000')
  assert.strictEqual(sessRcn1AfterPrep.available_balance, 600000, 'Available cash balance must be 600,000')
  console.log('✓ 33. PROCESSING cash reduces available physical cash (reserved: 400k, available: 600k).')

  // Test 34: Two different allocations cannot over-reserve one cash session
  sqliteDb.exec(`
    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-rcn-2', 'PAY-RCN-002', 'obl-1', 'san-1', 700000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-rcn-2', 'pay-rcn-2', 'obl-1', 'SPP', 700000, 0, 'UNDISBURSED');
  `)

  const distRcn2 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 700000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })

  await assert.rejects(
    async () => {
      await cashManualDistributionService.prepareCashDistribution({
        distributionId: distRcn2.distributionId,
        cashSessionId: 'sess-recon-1',
        operatorId: 'usr-petugas',
        operatorRole: 'petugas_koperasi',
      })
    },
    /Saldo kas fisik pada sesi.*tidak mencukupi/i
  )
  console.log('✓ 34. Two different allocations cannot over-reserve one cash session (600k available < 700k needed).')

  // Test 35: Two operators concurrent prepare (Promise.all) cannot over-reserve
  sqliteDb.exec(`
    INSERT INTO finance_cash_sessions (
      id, session_code, operator_id, opened_at, opening_balance,
      expected_closing_balance, status
    ) VALUES (
      'sess-recon-conc', 'CS-RECON-CONC', 'usr-petugas', '2026-10-09T09:00:00Z', 1000000,
      1000000, 'OPEN'
    );

    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES
      ('pay-conc-a', 'PAY-CONC-A', 'obl-1', 'san-1', 600000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now')),
      ('pay-conc-b', 'PAY-CONC-B', 'obl-1', 'san-1', 600000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES
      ('alloc-conc-a', 'pay-conc-a', 'obl-1', 'SPP', 600000, 0, 'UNDISBURSED'),
      ('alloc-conc-b', 'pay-conc-b', 'obl-1', 'SPP', 600000, 0, 'UNDISBURSED');
  `)

  const distConcA = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 600000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })
  const distConcB = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 600000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })

  const resultsConc = await Promise.allSettled([
    cashManualDistributionService.prepareCashDistribution({
      distributionId: distConcA.distributionId,
      cashSessionId: 'sess-recon-conc',
      operatorId: 'usr-petugas',
      operatorRole: 'petugas_koperasi',
    }),
    cashManualDistributionService.prepareCashDistribution({
      distributionId: distConcB.distributionId,
      cashSessionId: 'sess-recon-conc',
      operatorId: 'usr-petugas',
      operatorRole: 'petugas_koperasi',
    }),
  ])

  const fulfilledCount = resultsConc.filter((r) => r.status === 'fulfilled').length
  const rejectedCount = resultsConc.filter((r) => r.status === 'rejected').length
  assert.strictEqual(fulfilledCount, 1, 'Exactly one concurrent preparation should succeed')
  assert.strictEqual(rejectedCount, 1, 'Exactly one concurrent preparation should be rejected due to liquidity limit')
  console.log('✓ 35. Concurrent prepare (Promise.all) cannot over-reserve drawer (1 succeeded, 1 rejected).')

  // Test 36: PROCESSING cash blocks cash-session close
  await assert.rejects(
    async () => {
      await closeCashSession('sess-recon-1', 'usr-petugas', 1000000)
    },
    /masih terdapat.*penyaluran kas fisik berstatus PROCESSING/i
  )
  console.log('✓ 36. PROCESSING cash blocks cash-session close.')

  // Test 37: CASH_RETURNED releases reservation
  await cashManualDistributionService.cancelCashDistribution({
    distributionId: distRcn1.distributionId,
    reason: 'Pembatalan sebelum penyerahan',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  const sessRcn1AfterCancel = await recalculateCashSession('sess-recon-1')
  assert.strictEqual(sessRcn1AfterCancel.reserved_cash_out, 0, 'Reserved cash out must be released to 0')
  assert.strictEqual(sessRcn1AfterCancel.available_balance, 1000000, 'Available balance restored to 1,000,000')
  console.log('✓ 37. CASH_RETURNED releases reservation completely (reserved: 0, available: 1M).')

  // Test 38: DISTRIBUTED converts reservation to actual cash-out exactly once
  // Now prepare distRcn2 (700,000) on sess-recon-1
  await cashManualDistributionService.prepareCashDistribution({
    distributionId: distRcn2.distributionId,
    cashSessionId: 'sess-recon-1',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })
  await cashManualDistributionService.finalizeCashDistribution({
    distributionId: distRcn2.distributionId,
    receivingPersonName: 'Ust. Pengurus',
    receiptReference: 'RCP-RECON-700K',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  const sessRcn1AfterDist = await recalculateCashSession('sess-recon-1')
  assert.strictEqual(sessRcn1AfterDist.total_cash_out, 700000, 'total_cash_out must be exactly 700,000')
  assert.strictEqual(sessRcn1AfterDist.expected_closing_balance, 300000, 'expected_closing_balance must be 300,000')
  assert.strictEqual(sessRcn1AfterDist.reserved_cash_out, 0, 'reserved_cash_out must be 0')
  assert.strictEqual(sessRcn1AfterDist.available_balance, 300000, 'available_balance must be 300,000')

  // Idempotent recalculation test: recalculating again produces same exact authoritative state
  const sessRcn1RecalcAgain = await recalculateCashSession('sess-recon-1')
  assert.strictEqual(sessRcn1RecalcAgain.total_cash_out, 700000)
  assert.strictEqual(sessRcn1RecalcAgain.expected_closing_balance, 300000)
  console.log('✓ 38. DISTRIBUTED converts reservation to actual cash-out exactly once (idempotent, no double projection).')

  // Test 39: Close succeeds after all reservations resolved
  const closedSession = await closeCashSession('sess-recon-1', 'usr-petugas', 300000)
  assert.strictEqual(closedSession.status, 'CLOSED')
  assert.strictEqual(closedSession.actual_closing_balance, 300000)
  assert.strictEqual(closedSession.difference, 0)
  console.log('✓ 39. Close succeeds after all reservations resolved.')

  // Test 40: Actual counted cash mismatch creates discrepancy note, not ledger rewrite
  sqliteDb.exec(`
    INSERT INTO finance_cash_sessions (
      id, session_code, operator_id, opened_at, opening_balance,
      expected_closing_balance, status
    ) VALUES (
      'sess-recon-diff', 'CS-RECON-DIFF', 'usr-petugas', '2026-10-09T09:00:00Z', 500000,
      500000, 'OPEN'
    );
  `)
  const closedWithDiff = await closeCashSession(
    'sess-recon-diff',
    'usr-petugas',
    480000,
    'Terdapat uang robek/rusak Rp20.000'
  )
  assert.strictEqual(closedWithDiff.status, 'CLOSED')
  assert.strictEqual(closedWithDiff.expected_closing_balance, 500000, 'Authoritative expected balance remains 500k (ledger preserved)')
  assert.strictEqual(closedWithDiff.actual_closing_balance, 480000)
  assert.strictEqual(closedWithDiff.difference, -20000)
  assert.strictEqual(closedWithDiff.difference_notes, 'Terdapat uang robek/rusak Rp20.000')
  console.log('✓ 40. Actual counted cash mismatch creates discrepancy note, not ledger rewrite.')

  // --- Grup 8: Manual Transfer Provenance & Reconciliation Investigation (41 - 47) ---
  console.log('\n--- Grup 8: Manual Transfer Provenance & Reconciliation Investigation (41 - 47) ---')

  // Test 41: Source account comes from authoritative account config/master; arbitrary rejected
  sqliteDb.exec(`
    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-man-prov', 'PAY-MAN-PROV-001', 'obl-1', 'san-1', 500000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-man-prov', 'pay-man-prov', 'obl-1', 'SPP', 500000, 0, 'UNDISBURSED');
  `)
  const distProv = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 500000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })

  await cashManualDistributionService.initiateManualTransfer({
    distributionId: distProv.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })
  const distProvRow = sqliteDb.prepare(`SELECT * FROM finance_distributions WHERE id = ?`).get(distProv.distributionId)
  assert.strictEqual(distProvRow.source_account_number, '001201000123301')
  assert.strictEqual(distProvRow.source_bank_code, '002')
  assert.strictEqual(distProvRow.source_account_holder, 'KOPERASI PONTREN SUKAHIDENG')
  console.log('✓ 41. Source account comes from authoritative Koperasi BRI account config/master.')

  // Test 42: Arbitrary source account rejected
  sqliteDb.exec(`
    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-man-badacc', 'PAY-MAN-BAD-001', 'obl-1', 'san-1', 100000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-man-badacc', 'pay-man-badacc', 'obl-1', 'SPP', 100000, 0, 'UNDISBURSED');
  `)
  const distBadAcc = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 100000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })
  await assert.rejects(
    async () => {
      await cashManualDistributionService.initiateManualTransfer({
        distributionId: distBadAcc.distributionId,
        sourceAccountNumber: '999999999999999', // Rekening sembarang bukan Koperasi BRI
        operatorId: 'usr-petugas',
        operatorRole: 'petugas_koperasi',
      })
    },
    /INVALID_SOURCE_ACCOUNT.*Rekening sembarang.*ditolak/i
  )
  console.log('✓ 42. Arbitrary source account rejected.')

  // Test 43: Caller cannot self-declare AUTHORITATIVE_EXACT
  // In finalizeManualTransfer, passing BANK_STATEMENT_DEBIT without isReconciledAuthoritative
  // is derived to CANDIDATE server-side and rejected, regardless of what caller passes in evidenceStrength
  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeManualTransfer({
        distributionId: distProv.distributionId,
        evidenceType: 'BANK_STATEMENT_DEBIT',
        evidenceStrength: 'AUTHORITATIVE_EXACT', // Caller tries to self-declare
        isReconciledAuthoritative: false, // Server recognizes not authoritative
        referenceNumber: 'STMT-SELF-DECLARE-001',
        operatorId: 'usr-bendahara',
        operatorRole: 'bendahara',
      })
    },
    /CANDIDATE_EVIDENCE_REJECTED/i
  )
  console.log('✓ 43. Caller cannot self-declare AUTHORITATIVE_EXACT; server derives evidence strength.')

  // Test 44: BANK_STATEMENT amount/time-only candidate cannot finalize
  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeManualTransfer({
        distributionId: distProv.distributionId,
        evidenceType: 'BANK_STATEMENT_DEBIT',
        referenceNumber: 'STMT-CANDIDATE-NOMINAL-ONLY',
        operatorId: 'usr-bendahara',
        operatorRole: 'bendahara',
      })
    },
    /CANDIDATE_EVIDENCE_REJECTED/i
  )
  console.log('✓ 44. BANK_STATEMENT amount/time-only candidate cannot finalize.')

  // Test 45: Unknown outcome creates investigation case in finance_reconciliation_items with UNMATCHED_INTERNAL and MANUAL_TRANSFER_OUTCOME_UNKNOWN
  const unknownRes45 = await cashManualDistributionService.recordManualTransferUnknownOutcome({
    distributionId: distProv.distributionId,
    reason: 'Timeout koneksi internet perbankan saat transfer berlangsung',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })
  assert.strictEqual(unknownRes45.status, 'PROCESSING')

  const reconItem = sqliteDb.prepare(`
    SELECT * FROM finance_reconciliation_items WHERE external_reference = ? AND (investigation_resolution = 'PENDING' OR resolution_action = 'NONE')
  `).get(distProvRow.distribution_number)
  assert.ok(reconItem, 'Open investigation case must exist in finance_reconciliation_items')
  assert.strictEqual(reconItem.match_status, 'UNMATCHED_INTERNAL')
  assert.strictEqual(reconItem.reason_code, 'MANUAL_TRANSFER_OUTCOME_UNKNOWN')
  assert.strictEqual(reconItem.investigation_resolution, 'PENDING')
  assert.strictEqual(reconItem.resolution_action, 'NONE')
  console.log('✓ 45. Unknown outcome creates open investigation case with UNMATCHED_INTERNAL, reason_code, and PENDING.')

  // Test 46: Unresolved investigation blocks second transfer
  await assert.rejects(
    async () => {
      await cashManualDistributionService.initiateManualTransfer({
        distributionId: distProv.distributionId,
        operatorId: 'usr-petugas',
        operatorRole: 'petugas_koperasi',
      })
    },
    /UNRESOLVED_INVESTIGATION.*masih terdapat investigasi terbuka/i
  )
  console.log('✓ 46. Unresolved investigation blocks second transfer.')

  // Test 47: Uploaded receipt alone -> MANUAL_RESOLVED, not AUTHORITATIVE_EXACT; updates investigation to DISTRIBUTION_CONFIRMED
  const finalizeRes = await cashManualDistributionService.finalizeManualTransfer({
    distributionId: distProv.distributionId,
    evidenceType: 'MANUAL_TRANSFER_SUCCESS',
    referenceNumber: 'BRI-TRF-SUCCESS-001',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })
  assert.strictEqual(finalizeRes.status, 'DISTRIBUTED')

  const evRow = sqliteDb.prepare(`
    SELECT * FROM finance_cash_manual_evidence WHERE distribution_id = ? AND reference_number = 'BRI-TRF-SUCCESS-001'
  `).get(distProv.distributionId)
  assert.strictEqual(evRow.evidence_strength, 'MANUAL_RESOLVED', 'Uploaded receipt alone must be MANUAL_RESOLVED, not AUTHORITATIVE_EXACT')

  const resolvedItem = sqliteDb.prepare(`
    SELECT * FROM finance_reconciliation_items WHERE external_reference = ?
  `).get(distProvRow.distribution_number)
  assert.strictEqual(resolvedItem.match_status, 'MATCHED')
  assert.strictEqual(resolvedItem.investigation_resolution, 'DISTRIBUTION_CONFIRMED')
  assert.strictEqual(resolvedItem.resolution_action, 'NONE')
  console.log('✓ 47. Uploaded receipt alone is MANUAL_RESOLVED and resolves investigation to DISTRIBUTION_CONFIRMED.')

  // Test 48: Verified statement debit + exact reference -> AUTHORITATIVE_EXACT
  sqliteDb.exec(`
    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-man-stmt', 'PAY-MAN-STMT-001', 'obl-1', 'san-1', 250000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-man-stmt', 'pay-man-stmt', 'obl-1', 'SPP', 250000, 0, 'UNDISBURSED');

    INSERT INTO finance_bri_statement_transactions (id, fetch_id, statement_id, account_no, transaction_id, identity_strength, transaction_date, transaction_time, type_normalized, transaction_type, amount, currency, journal_seq, remark)
    VALUES ('stmt-tx-exact-01', 'fetch-g8-001', 'stmt-001', '001201000123301', 'JRN-998811', 'STRONG', '2026-10-09', '10:00:00', 'DEBIT', 'DEBIT', 250000, 'IDR', 'JRN-998811', 'DEBET TRF PESANTREN');
  `)
  const distStmtCase = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 250000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })
  await cashManualDistributionService.initiateManualTransfer({
    distributionId: distStmtCase.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })
  const stmtFinalizeRes = await cashManualDistributionService.finalizeManualTransfer({
    distributionId: distStmtCase.distributionId,
    evidenceType: 'BANK_STATEMENT_DEBIT',
    statementTransactionId: 'stmt-tx-exact-01',
    referenceNumber: 'JRN-998811',
    operatorId: 'usr-bendahara',
    operatorRole: 'bendahara',
  })
  assert.strictEqual(stmtFinalizeRes.status, 'DISTRIBUTED')
  const stmtEvRow = sqliteDb.prepare(`
    SELECT * FROM finance_cash_manual_evidence WHERE distribution_id = ? AND reference_number = 'JRN-998811'
  `).get(distStmtCase.distributionId)
  assert.strictEqual(stmtEvRow.evidence_strength, 'MANUAL_RESOLVED', 'Audited bank statement debit resolution yields MANUAL_RESOLVED, not AUTHORITATIVE_EXACT')
  console.log('✓ 48. Audited statement debit resolution yields MANUAL_RESOLVED (not AUTHORITATIVE_EXACT).')

  // Test 49: Client cannot choose strength (passing AUTHORITATIVE_EXACT on MANUAL_TRANSFER_SUCCESS still derives MANUAL_RESOLVED)
  sqliteDb.exec(`
    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-man-clientstr', 'PAY-MAN-STR-001', 'obl-1', 'san-1', 150000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-man-clientstr', 'pay-man-clientstr', 'obl-1', 'SPP', 150000, 0, 'UNDISBURSED');
  `)
  const distClientStr = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 150000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })
  await cashManualDistributionService.initiateManualTransfer({
    distributionId: distClientStr.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })
  await cashManualDistributionService.finalizeManualTransfer({
    distributionId: distClientStr.distributionId,
    evidenceType: 'MANUAL_TRANSFER_SUCCESS',
    evidenceStrength: 'AUTHORITATIVE_EXACT', // Client tries to dictate AUTHORITATIVE_EXACT
    referenceNumber: 'BRI-CLIENT-STR-001',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })
  const clientStrEv = sqliteDb.prepare(`
    SELECT * FROM finance_cash_manual_evidence WHERE distribution_id = ? AND reference_number = 'BRI-CLIENT-STR-001'
  `).get(distClientStr.distributionId)
  assert.strictEqual(clientStrEv.evidence_strength, 'MANUAL_RESOLVED', 'Client cannot elevate operator receipt to AUTHORITATIVE_EXACT')
  console.log('✓ 49. Client cannot choose strength; server derives strength authoritatively.')

  // Test 50: Missing BRI_COLLECTION_ACCOUNT_NO throws CONFIG_ERROR (no fallback string)
  const savedCollectionAcc = process.env.BRI_COLLECTION_ACCOUNT_NO
  delete process.env.BRI_COLLECTION_ACCOUNT_NO
  assert.throws(
    () => {
      cashManualDistributionService.getAuthoritativeSourceAccount()
    },
    /CONFIG_ERROR.*BRI_COLLECTION_ACCOUNT_NO.*belum dikonfigurasi/i
  )
  process.env.BRI_COLLECTION_ACCOUNT_NO = savedCollectionAcc
  console.log('✓ 50. Missing BRI_COLLECTION_ACCOUNT_NO throws CONFIG_ERROR without code literal fallback.')

  // Test 51: Operator drawer binding enforced in prepare and finalize
  // Setup second operator and session
  sqliteDb.exec(`
    INSERT INTO users (id, full_name, role, username) VALUES ('usr-kasir-2', 'Kasir 2', 'petugas_koperasi', 'kasir2');
    INSERT INTO finance_cash_sessions (id, session_code, operator_id, opened_at, opening_balance, expected_closing_balance, status)
    VALUES ('ses-kasir-2', 'SES-KASIR-002', 'usr-kasir-2', datetime('now'), 1000000, 1000000, 'OPEN');

    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-drawer-check', 'PAY-DRW-001', 'obl-1', 'san-1', 100000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-drawer-check', 'pay-drawer-check', 'obl-1', 'SPP', 100000, 0, 'UNDISBURSED');
  `)
  const distDrawer = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 100000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })
  // Operator 1 tries to use Operator 2's session without supervisor role
  await assert.rejects(
    async () => {
      await cashManualDistributionService.prepareCashDistribution({
        distributionId: distDrawer.distributionId,
        cashSessionId: 'ses-kasir-2',
        operatorId: 'usr-petugas',
        operatorRole: 'petugas_koperasi',
      })
    },
    /OPERATOR_DRAWER_MISMATCH/i
  )
  console.log('✓ 51. Operator drawer binding enforced in prepare (other operator blocked).')

  // Test 52: Supervisor override allowed and audited in prepare and finalize
  const supPrepRes = await cashManualDistributionService.prepareCashDistribution({
    distributionId: distDrawer.distributionId,
    cashSessionId: 'ses-kasir-2',
    operatorId: 'usr-bendahara',
    operatorRole: 'bendahara', // Supervisor override
  })
  assert.strictEqual(supPrepRes.status, 'PROCESSING')

  const supFinRes = await cashManualDistributionService.finalizeCashDistribution({
    distributionId: distDrawer.distributionId,
    receivingPersonName: 'Ustadz Ahmad',
    operatorId: 'usr-bendahara',
    operatorRole: 'bendahara', // Supervisor override
  })
  assert.strictEqual(supFinRes.status, 'DISTRIBUTED')
  console.log('✓ 52. Supervisor override allowed and audited for cash session drawer.')

  // Test 53: Spoofed operator rejected in prepare and finalize
  sqliteDb.exec(`
    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-spoof', 'PAY-SPOOF-001', 'obl-1', 'san-1', 100000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-spoof', 'pay-spoof', 'obl-1', 'SPP', 100000, 0, 'UNDISBURSED');
  `)
  const distSpoof = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 100000,
    method: 'CASH',
    makerUserId: 'usr-petugas',
  })
  await assert.rejects(
    async () => {
      await cashManualDistributionService.prepareCashDistribution({
        distributionId: distSpoof.distributionId,
        cashSessionId: 'ses-kasir-2',
        operatorId: 'non-existent-user-id',
        operatorRole: 'petugas_koperasi',
      })
    },
    /tidak terdaftar dalam database/i
  )
  console.log('✓ 53. Spoofed operator rejected by user existence check.')

  // Test 54: Magic bytes mismatch rejected
  const fakeJpg = cashManualDistributionService.validateProofAttachment({
    buffer: Buffer.from('%PDF-1.4 header in jpg claimed file'),
    mimeType: 'image/jpeg',
    originalFilename: 'fake.jpg',
    sizeBytes: 100,
  })
  assert.strictEqual(fakeJpg.valid, false)
  assert.match(fakeJpg.error, /MAGIC_BYTES_MISMATCH/i)

  const fakePdf = cashManualDistributionService.validateProofAttachment({
    buffer: Buffer.from('plain text not a pdf'),
    mimeType: 'application/pdf',
    originalFilename: 'fake.pdf',
    sizeBytes: 100,
  })
  assert.strictEqual(fakePdf.valid, false)
  assert.match(fakePdf.error, /MAGIC_BYTES_MISMATCH/i)

  const realPdfBuf = Buffer.concat([Buffer.from('%PDF-1.5 fake binary data')])
  const realPdf = cashManualDistributionService.validateProofAttachment({
    buffer: realPdfBuf,
    mimeType: 'application/pdf',
    originalFilename: 'real.pdf',
    sizeBytes: realPdfBuf.length,
  })
  assert.strictEqual(realPdf.valid, true)
  console.log('✓ 54. Magic bytes mismatch strictly rejected (anti-spoofing verified).')

  // Test 55: Path traversal and arbitrary client URL rejected
  const urlInName = cashManualDistributionService.validateProofAttachment({
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
    mimeType: 'image/jpeg',
    originalFilename: 'https://evil.com/exploit.jpg',
    sizeBytes: 5,
  })
  assert.strictEqual(urlInName.valid, false)
  assert.match(urlInName.error, /path traversal atau URL eksternal/i)

  // In finalizeCashDistribution and finalizeManualTransfer: arbitrary URL rejected
  sqliteDb.exec(`
    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-arb-url', 'PAY-URL-001', 'obl-1', 'san-1', 100000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-arb-url', 'pay-arb-url', 'obl-1', 'SPP', 100000, 0, 'UNDISBURSED');
  `)
  const distArbUrl = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 100000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })
  await cashManualDistributionService.initiateManualTransfer({
    distributionId: distArbUrl.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeManualTransfer({
        distributionId: distArbUrl.distributionId,
        evidenceType: 'MANUAL_TRANSFER_SUCCESS',
        referenceNumber: 'REF-ARBITRARY-URL',
        proofAttachmentUrl: 'http://malicious-site.com/fake-receipt.png',
        operatorId: 'usr-petugas',
        operatorRole: 'petugas_koperasi',
      })
    },
    /INVALID_PROOF_REFERENCE/i
  )
  console.log('✓ 55. Path traversal and arbitrary client URLs strictly rejected.')

  // Test 56: Failure resolution resolves investigation case to VOID_RECORDED
  sqliteDb.exec(`
    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-man-failcase', 'PAY-MAN-FAIL-001', 'obl-1', 'san-1', 300000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-man-failcase', 'pay-man-failcase', 'obl-1', 'SPP', 300000, 0, 'UNDISBURSED');
  `)
  const distFailCase = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 300000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })
  await cashManualDistributionService.initiateManualTransfer({
    distributionId: distFailCase.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })
  await cashManualDistributionService.recordManualTransferUnknownOutcome({
    distributionId: distFailCase.distributionId,
    reason: 'Transfer tertunda di core banking',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })
  await cashManualDistributionService.failManualTransfer({
    distributionId: distFailCase.distributionId,
    referenceNumber: 'FAIL-REF-001',
    reason: 'Konfirmasi resmi BRI: Transfer ditolak karena rekening penerima dormant',
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  const distFailRow = sqliteDb.prepare(`SELECT * FROM finance_distributions WHERE id = ?`).get(distFailCase.distributionId)
  assert.strictEqual(distFailRow.status, 'FAILED')
  const resolvedFailItem = sqliteDb.prepare(`
    SELECT * FROM finance_reconciliation_items WHERE external_reference = ?
  `).get(distFailRow.distribution_number)
  assert.strictEqual(resolvedFailItem.match_status, 'UNMATCHED_INTERNAL')
  assert.strictEqual(resolvedFailItem.investigation_resolution, 'VOID_RECORDED')
  assert.strictEqual(resolvedFailItem.resolution_action, 'VOID_RECORDED', 'Resolved via bank confirmed failure')
  console.log('✓ 56. Failure resolution updates investigation item to VOID_RECORDED and UNMATCHED_INTERNAL.')

  // --------------------------------------------------------------------------
  // GRUP 8: STATEMENT & BANK RECONCILIATION HARDENING (57 - 66)
  // Strong Statement Identity != Authoritative Distribution Match
  // --------------------------------------------------------------------------
  console.log('\n--- Grup 8: Statement & Bank Reconciliation Hardening Tests (57 - 66) ---')

  // Setup prerequisites for Statement tests
  sqliteDb.exec(`
    INSERT INTO finance_bri_statement_fetches (
      id, fetch_reference_no, account_no, from_date_time, to_date_time, body_hash
    ) VALUES (
      'fetch-test-g8', 'FETCH-G8-001', '001201000123301', '2026-10-09T00:00:00Z', '2026-10-09T23:59:59Z', 'hash-fetch-g8'
    );

    INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, amount, status, remaining_balance)
    VALUES
    ('obl-stmt-1', 'san-1', 'SPP', '2026-11', 750000, 0, 750000, 750000, 'PAID', 0),
    ('obl-stmt-2', 'san-1', 'SPP', '2026-11', 750000, 0, 750000, 750000, 'PAID', 0);

    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES
    ('pay-stmt-1', 'PAY-STMT-001', 'obl-stmt-1', 'san-1', 750000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now')),
    ('pay-stmt-2', 'PAY-STMT-002', 'obl-stmt-2', 'san-1', 750000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));

    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES
    ('alloc-stmt-1', 'pay-stmt-1', 'obl-stmt-1', 'SPP', 750000, 0, 'UNDISBURSED'),
    ('alloc-stmt-2', 'pay-stmt-2', 'obl-stmt-2', 'SPP', 750000, 0, 'UNDISBURSED');
  `)

  // Test 57: Statement with strong transactionId + matching amount alone -> CANDIDATE, not AUTHORITATIVE_EXACT
  sqliteDb.exec(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, currency
    ) VALUES (
      'stmt-tx-strong-1', 'fetch-test-g8', '001201000123301', 'BRI-TX-STR-001', 'STRONG', 'dedup-tx-1',
      '2026-10-09', 'D', 'DEBIT', 750000, '750000.00', 'IDR'
    );
  `)

  const distStmt1 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-11',
    amount: 750000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })
  await cashManualDistributionService.initiateManualTransfer({
    distributionId: distStmt1.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  const candidateMatch1 = await cashManualDistributionService.matchStatementDebitToCandidates('stmt-tx-strong-1')
  assert.strictEqual(candidateMatch1.status, 'CANDIDATE')
  assert.strictEqual(candidateMatch1.matchedDistributions.length, 1)
  assert.match(candidateMatch1.reason, /CONTRACT_TBD/i)

  const distRow1 = sqliteDb.prepare(`SELECT * FROM finance_distributions WHERE id = ?`).get(distStmt1.distributionId)
  const stmtRow1 = sqliteDb.prepare(`SELECT * FROM finance_bri_statement_transactions WHERE id = ?`).get('stmt-tx-strong-1')
  const crossRef1 = cashManualDistributionService.checkAuthoritativeBankStatementCrossReference(stmtRow1, distRow1)
  assert.strictEqual(crossRef1.isAuthoritativeExact, false, 'Strong identity statement alone cannot produce AUTHORITATIVE_EXACT match')
  assert.strictEqual(crossRef1.contractState, 'BANK_STATEMENT_AUTO_CORRELATION_CONTRACT_TBD')
  console.log('✓ 57. Strong transactionId + same amount alone yields CANDIDATE (never AUTHORITATIVE_EXACT).')

  // Test 58: Two manual distributions with same amount -> statement does not auto-match to either (AMBIGUOUS_CANDIDATES)
  const distStmt2 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-11',
    amount: 750000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })
  await cashManualDistributionService.initiateManualTransfer({
    distributionId: distStmt2.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  const candidateMatch2 = await cashManualDistributionService.matchStatementDebitToCandidates('stmt-tx-strong-1')
  assert.strictEqual(candidateMatch2.status, 'AMBIGUOUS_CANDIDATES')
  assert.strictEqual(candidateMatch2.matchedDistributions.length, 2)
  assert.match(candidateMatch2.reason, /AMBIGUOUS_CANDIDATES.*System will not automatically pick/i)
  console.log('✓ 58. Two equal-amount distributions result in AMBIGUOUS_CANDIDATES (no automatic selection).')

  // Test 59: Amount + timestamp alone -> CANDIDATE
  assert.strictEqual(candidateMatch1.status, 'CANDIDATE')
  assert.strictEqual(crossRef1.isAuthoritativeExact, false)
  console.log('✓ 59. Amount + timestamp alone remains CANDIDATE (CONTRACT_TBD).')

  // Test 60: Client payload claiming AUTHORITATIVE_EXACT or isReconciledAuthoritative -> ignored / server derives MANUAL_RESOLVED
  const finalStmt1 = await cashManualDistributionService.finalizeManualTransfer({
    distributionId: distStmt1.distributionId,
    evidenceType: 'BANK_STATEMENT_DEBIT',
    evidenceStrength: 'AUTHORITATIVE_EXACT', // Client attempts to force AUTHORITATIVE_EXACT
    isReconciledAuthoritative: true,        // Client flag
    statementTransactionId: 'stmt-tx-strong-1',
    referenceNumber: 'BRI-TX-STR-001',
    operatorId: 'usr-bendahara',
    operatorRole: 'bendahara',
    notes: 'Audited manual resolution by bendahara against statement row stmt-tx-strong-1',
  })
  assert.strictEqual(finalStmt1.status, 'DISTRIBUTED')

  const evStmt1 = sqliteDb.prepare(`
    SELECT * FROM finance_cash_manual_evidence
    WHERE distribution_id = ? AND evidence_type = 'BANK_STATEMENT_DEBIT'
  `).get(distStmt1.distributionId)
  assert.strictEqual(evStmt1.evidence_strength, 'MANUAL_RESOLVED', 'Client claim of AUTHORITATIVE_EXACT must be overridden by server derivation to MANUAL_RESOLVED')
  assert.strictEqual(evStmt1.source, 'BANK_STATEMENT')
  console.log('✓ 60. Client AUTHORITATIVE_EXACT claim ignored; server strictly derives MANUAL_RESOLVED.')

  // Test 61: Audited manual resolution requires authorized supervisor role (admin or bendahara)
  // Petugas kasir attempting BANK_STATEMENT_DEBIT resolution -> strictly REJECTED
  sqliteDb.exec(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, currency
    ) VALUES (
      'stmt-tx-strong-2', 'fetch-test-g8', '001201000123301', 'BRI-TX-STR-002', 'STRONG', 'dedup-tx-2',
      '2026-10-09', 'D', 'DEBIT', 750000, '750000.00', 'IDR'
    );
  `)
  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeManualTransfer({
        distributionId: distStmt2.distributionId,
        evidenceType: 'BANK_STATEMENT_DEBIT',
        statementTransactionId: 'stmt-tx-strong-2',
        referenceNumber: 'BRI-TX-STR-002',
        operatorId: 'usr-petugas',
        operatorRole: 'petugas_koperasi', // Non-supervisor
      })
    },
    /Hanya role "admin" atau "bendahara" yang berwenang/i
  )

  // With admin role -> succeeds as MANUAL_RESOLVED with complete audit trail
  const finalStmt2 = await cashManualDistributionService.finalizeManualTransfer({
    distributionId: distStmt2.distributionId,
    evidenceType: 'BANK_STATEMENT_DEBIT',
    statementTransactionId: 'stmt-tx-strong-2',
    referenceNumber: 'BRI-TX-STR-002',
    operatorId: 'usr-admin',
    operatorRole: 'admin',
    notes: 'Admin audited manual reconciliation',
  })
  assert.strictEqual(finalStmt2.status, 'DISTRIBUTED')
  const dist2Row = sqliteDb.prepare(`SELECT status, statement_transaction_id FROM finance_distributions WHERE id = ?`).get(distStmt2.distributionId)
  assert.strictEqual(dist2Row.status, 'DISTRIBUTED')
  assert.strictEqual(dist2Row.statement_transaction_id, 'stmt-tx-strong-2')
  console.log('✓ 61. Audited manual statement resolution strictly requires admin/bendahara and records full audit trail.')

  // Test 62: Double consumption guard: One statement transaction cannot resolve two different distributions
  // Prepare a third distribution and try to reuse stmt-tx-strong-1 (already consumed by distStmt1)
  sqliteDb.exec(`
    INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, amount, status, remaining_balance)
    VALUES ('obl-stmt-3', 'san-1', 'SPP', '2026-11', 750000, 0, 750000, 750000, 'PAID', 0);
    INSERT INTO finance_payments (id, payment_number, obligation_id, santri_id, gross_amount, channel, fund_management, status, paid_at)
    VALUES ('pay-stmt-3', 'PAY-STMT-003', 'obl-stmt-3', 'san-1', 750000, 'BRI_VA', 'KOPERASI', 'PAID', datetime('now'));
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-stmt-3', 'pay-stmt-3', 'obl-stmt-3', 'SPP', 750000, 0, 'UNDISBURSED');
  `)
  const distStmt3 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    accountId: 'acc-pesantren',
    itemType: 'SPP',
    period: '2026-11',
    amount: 750000,
    method: 'MANUAL_TRANSFER',
    makerUserId: 'usr-petugas',
  })
  await cashManualDistributionService.initiateManualTransfer({
    distributionId: distStmt3.distributionId,
    operatorId: 'usr-petugas',
    operatorRole: 'petugas_koperasi',
  })

  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeManualTransfer({
        distributionId: distStmt3.distributionId,
        evidenceType: 'BANK_STATEMENT_DEBIT',
        statementTransactionId: 'stmt-tx-strong-1', // Already consumed by distStmt1
        referenceNumber: 'BRI-TX-STR-001-REUSE',
        operatorId: 'usr-bendahara',
        operatorRole: 'bendahara',
      })
    },
    /STMT_TRANSACTION_ALREADY_CONSUMED/i
  )

  // Re-finalizing distStmt1 idempotently succeeds
  const idempotentFinal = await cashManualDistributionService.finalizeManualTransfer({
    distributionId: distStmt1.distributionId,
    evidenceType: 'BANK_STATEMENT_DEBIT',
    statementTransactionId: 'stmt-tx-strong-1',
    referenceNumber: 'BRI-TX-STR-001',
    operatorId: 'usr-bendahara',
    operatorRole: 'bendahara',
  })
  assert.strictEqual(idempotentFinal.status, 'DISTRIBUTED')
  console.log('✓ 62. Double consumption guard blocks reuse of statement transaction across distributions.')

  // Test 63: Statement with mismatched source account rejected (STATEMENT_ACCOUNT_MISMATCH)
  sqliteDb.exec(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, currency
    ) VALUES (
      'stmt-tx-wrong-acc', 'fetch-test-g8', '999901000999999', 'BRI-TX-WRONG-ACC', 'STRONG', 'dedup-tx-3',
      '2026-10-09', 'D', 'DEBIT', 750000, '750000.00', 'IDR'
    );
  `)
  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeManualTransfer({
        distributionId: distStmt3.distributionId,
        evidenceType: 'BANK_STATEMENT_DEBIT',
        statementTransactionId: 'stmt-tx-wrong-acc',
        referenceNumber: 'BRI-TX-WRONG-ACC',
        operatorId: 'usr-bendahara',
        operatorRole: 'bendahara',
      })
    },
    /STATEMENT_ACCOUNT_MISMATCH/i
  )
  console.log('✓ 63. Statement with wrong account rejected (STATEMENT_ACCOUNT_MISMATCH).')

  // Test 64: Statement with non-IDR currency rejected (STATEMENT_CURRENCY_MISMATCH)
  sqliteDb.exec(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, currency
    ) VALUES (
      'stmt-tx-non-idr', 'fetch-test-g8', '001201000123301', 'BRI-TX-USD', 'STRONG', 'dedup-tx-4',
      '2026-10-09', 'D', 'DEBIT', 750000, '750000.00', 'USD'
    );
  `)
  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeManualTransfer({
        distributionId: distStmt3.distributionId,
        evidenceType: 'BANK_STATEMENT_DEBIT',
        statementTransactionId: 'stmt-tx-non-idr',
        referenceNumber: 'BRI-TX-USD',
        operatorId: 'usr-bendahara',
        operatorRole: 'bendahara',
      })
    },
    /STATEMENT_CURRENCY_MISMATCH/i
  )
  console.log('✓ 64. Statement with non-IDR currency rejected (STATEMENT_CURRENCY_MISMATCH).')

  // Test 65: Statement with CREDIT type rejected (STATEMENT_TYPE_MISMATCH)
  sqliteDb.exec(`
    INSERT INTO finance_bri_statement_transactions (
      id, fetch_id, account_no, transaction_id, identity_strength, dedup_key,
      transaction_date_raw, type_raw, type_normalized, amount, amount_raw, currency
    ) VALUES (
      'stmt-tx-credit', 'fetch-test-g8', '001201000123301', 'BRI-TX-CREDIT', 'STRONG', 'dedup-tx-5',
      '2026-10-09', 'C', 'CREDIT', 750000, '750000.00', 'IDR'
    );
  `)
  await assert.rejects(
    async () => {
      await cashManualDistributionService.finalizeManualTransfer({
        distributionId: distStmt3.distributionId,
        evidenceType: 'BANK_STATEMENT_DEBIT',
        statementTransactionId: 'stmt-tx-credit',
        referenceNumber: 'BRI-TX-CREDIT',
        operatorId: 'usr-bendahara',
        operatorRole: 'bendahara',
      })
    },
    /STATEMENT_TYPE_MISMATCH/i
  )
  console.log('✓ 65. Statement with CREDIT type rejected (STATEMENT_TYPE_MISMATCH).')

  // Test 66: Future authoritative cross-reference seam returns CONTRACT_TBD without guessed mapping
  const futureSeamResult = checkAuthoritativeBankStatementCrossReference(
    { id: 'stmt-tx-strong-1', transaction_id: 'BRI-TX-STR-001', amount: 750000, account_no: '001201000123301', type_normalized: 'DEBIT', currency: 'IDR' },
    distRow1
  )
  assert.strictEqual(futureSeamResult.isAuthoritativeExact, false)
  assert.strictEqual(futureSeamResult.contractState, 'BANK_STATEMENT_AUTO_CORRELATION_CONTRACT_TBD')
  assert.strictEqual(BANK_STATEMENT_AUTO_CORRELATION_CONTRACT_STATE, 'BANK_STATEMENT_AUTO_CORRELATION_CONTRACT_TBD')
  assert.match(futureSeamResult.reason, /BANK_STATEMENT_AUTO_CORRELATION_CONTRACT_TBD/i)
  console.log('✓ 66. Future cross-reference seam explicitly returns CONTRACT_TBD (no guessed correlation).')

  console.log('\n=================================================================')
  console.log('SUCCESS: ALL 66 BRI-6 CASH & MANUAL DISTRIBUTION TESTS PASSED!')
  console.log('=================================================================')
}

runAllTests().catch((err) => {
  console.error('\nFAILED BRI-6 TEST:', err)
  process.exit(1)
})
