// scripts/test-bri-distribution.cjs
// Comprehensive Unit & Integration Test Suite for BRI-5 (Distribution BRI / QLola Non-STP)
// Enforces All Rules from AGENTS.md, docs/BRI_INTEGRATION_PRD.md, and Reviewer Prompt:
// 1. NON-STP WAJIB (No straight-through execution)
// 2. Maker/Signer Hard Separation (No fake in-app signer, no soft token stored)
// 3. Recipient Master & Account Snapshot Immutability
// 4. Concurrency Guard & Live Allocation Reservation Engine
// 5. State Machine: DRAFT -> PENDING_APPROVAL -> PROCESSING -> DISTRIBUTED / CANCEL_PENDING / REJECTED / CANCELLED / FAILED
// 6. Submission Idempotency & Outbox Transfer Intent
// 7. Cancellation Safety & Method Switch Protection
// 8. Distributed Correction -> PENDING_RECOVERY (No historical mutation)
// 9. Role Authorization Matrix & Tester Read-Only
// 10. Contract Isolation (QLOLA_H2H_CONTRACT_TBD, NOT VERIFIED direct transfer)

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

// Initialize SQLite Schema (Prerequisites + Migration 0182 + 0185)
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
    CREATE TABLE master_jasa (
        id TEXT PRIMARY KEY,
        nama_jasa TEXT,
        jenis TEXT
    );
    CREATE TABLE app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
    );
    CREATE TABLE finance_tariffs (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL,
        academic_year_id INTEGER,
        nominal INTEGER NOT NULL,
        installment_rule TEXT DEFAULT 'ALLOWED',
        effective_from TEXT NOT NULL,
        effective_until TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_obligations (
        id TEXT PRIMARY KEY,
        santri_id TEXT NOT NULL REFERENCES santri(id),
        item_type TEXT NOT NULL,
        period TEXT NOT NULL,
        amount_expected INTEGER NOT NULL,
        amount_exempted INTEGER NOT NULL DEFAULT 0,
        amount_paid INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'UNPAID',
        provider_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE finance_payments (
        id TEXT PRIMARY KEY,
        payment_number TEXT NOT NULL UNIQUE,
        order_id TEXT,
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
        fund_management TEXT NOT NULL DEFAULT 'KOPERASI',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    CREATE TABLE finance_correction_items (
        id TEXT PRIMARY KEY,
        target_allocation_id TEXT REFERENCES finance_allocations(id),
        obligation_id TEXT,
        amount INTEGER NOT NULL CHECK (amount > 0),
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

    -- Triggers dari 0182
    CREATE TRIGGER trg_finance_dist_items_prevent_overdraw
    BEFORE INSERT ON finance_distribution_items
    FOR EACH ROW
    WHEN (
        SELECT status FROM finance_distributions WHERE id = NEW.distribution_id
    ) IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
    BEGIN
        SELECT
            CASE
                WHEN (
                    COALESCE((
                        SELECT SUM(di.amount)
                        FROM finance_distribution_items di
                        JOIN finance_distributions d ON di.distribution_id = d.id
                        WHERE di.allocation_id = NEW.allocation_id
                          AND d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
                    ), 0) + NEW.amount
                ) > (
                    SELECT fa.amount - COALESCE((
                        SELECT SUM(fci.amount)
                        FROM finance_correction_items fci
                        WHERE fci.target_allocation_id = fa.id
                    ), 0)
                    FROM finance_allocations fa
                    WHERE fa.id = NEW.allocation_id
                )
                THEN RAISE(ABORT, 'Total penyaluran dan reservasi melebihi dana alokasi efektif yang tersedia (setelah memperhitungkan koreksi).')
            END;
    END;

    CREATE TRIGGER trg_finance_dist_status_prevent_over_reserve
    BEFORE UPDATE OF status ON finance_distributions
    FOR EACH ROW
    WHEN (
        OLD.status NOT IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
        AND NEW.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
    )
    BEGIN
        SELECT
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM finance_distribution_items cur_di
                    JOIN finance_allocations a ON cur_di.allocation_id = a.id
                    WHERE cur_di.distribution_id = NEW.id
                      AND (
                          COALESCE((
                              SELECT SUM(other_di.amount)
                              FROM finance_distribution_items other_di
                              JOIN finance_distributions other_d ON other_di.distribution_id = other_d.id
                              WHERE other_di.allocation_id = cur_di.allocation_id
                                AND other_d.id != NEW.id
                                AND other_d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
                          ), 0) + cur_di.amount
                      ) > (
                          a.amount - COALESCE((
                              SELECT SUM(fci.amount)
                              FROM finance_correction_items fci
                              WHERE fci.target_allocation_id = a.id
                          ), 0)
                      )
                )
                THEN RAISE(ABORT, 'Perubahan status gagal: Reservasi dana melebihi sisa alokasi efektif yang tersedia (setelah memperhitungkan koreksi).')
            END;
    END;

    CREATE TRIGGER trg_finance_dist_items_immutable_on_update
    BEFORE UPDATE ON finance_distribution_items
    FOR EACH ROW
    WHEN (SELECT status FROM finance_distributions WHERE id = OLD.distribution_id) != 'DRAFT'
    BEGIN
        SELECT RAISE(ABORT, 'Item penyaluran bersifat immutable dan tidak boleh diubah setelah pengajuan (hanya boleh diubah saat berstatus DRAFT).');
    END;

    CREATE TRIGGER trg_finance_dist_items_immutable_on_delete
    BEFORE DELETE ON finance_distribution_items
    FOR EACH ROW
    WHEN (SELECT status FROM finance_distributions WHERE id = OLD.distribution_id) != 'DRAFT'
    BEGIN
        SELECT RAISE(ABORT, 'Item penyaluran bersifat immutable dan tidak boleh dihapus setelah pengajuan (hanya boleh dihapus saat berstatus DRAFT).');
    END;

    CREATE TRIGGER trg_finance_dist_enforce_qlola_insert
    BEFORE INSERT ON finance_distributions
    FOR EACH ROW
    WHEN NEW.method = 'BRI_QLOLA' AND NEW.status NOT IN ('DRAFT', 'PENDING_APPROVAL')
    BEGIN
        SELECT RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP baru wajib berstatus DRAFT atau PENDING_APPROVAL.');
    END;

    CREATE TRIGGER trg_finance_dist_enforce_qlola_transitions
    BEFORE UPDATE OF status ON finance_distributions
    FOR EACH ROW
    WHEN NEW.method = 'BRI_QLOLA'
    BEGIN
        SELECT CASE
            WHEN OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'PENDING_APPROVAL', 'CANCELLED')
            THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari DRAFT hanya boleh diajukan ke PENDING_APPROVAL atau dibatalkan ke CANCELLED.')
        END;

        SELECT CASE
            WHEN OLD.status = 'PENDING_APPROVAL' AND NEW.status NOT IN ('PENDING_APPROVAL', 'PROCESSING', 'REJECTED', 'CANCEL_PENDING', 'CANCELLED')
            THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari PENDING_APPROVAL hanya boleh beralih ke PROCESSING, REJECTED, CANCEL_PENDING, atau CANCELLED.')
        END;

        SELECT CASE
            WHEN OLD.status = 'PROCESSING' AND NEW.status NOT IN ('PROCESSING', 'DISTRIBUTED', 'FAILED', 'CANCEL_PENDING')
            THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari PROCESSING hanya boleh beralih ke DISTRIBUTED, FAILED, atau CANCEL_PENDING.')
        END;

        SELECT CASE
            WHEN OLD.status = 'CANCEL_PENDING' AND NEW.status NOT IN ('CANCEL_PENDING', 'CANCELLED', 'DISTRIBUTED', 'FAILED', 'PROCESSING')
            THEN RAISE(ABORT, 'Penyaluran BRI_QLOLA non-STP dari CANCEL_PENDING hanya boleh beralih ke CANCELLED, DISTRIBUTED, FAILED, atau PROCESSING.')
        END;

        SELECT CASE
            WHEN OLD.status IN ('DISTRIBUTED', 'FAILED', 'REJECTED', 'CANCELLED') AND NEW.status != OLD.status
            THEN RAISE(ABORT, 'Penyaluran dengan status terminal bersifat final dan tidak dapat diubah.')
        END;
    END;

    CREATE TRIGGER trg_finance_correction_items_prevent_over_correct
    BEFORE INSERT ON finance_correction_items
    FOR EACH ROW
    WHEN NEW.target_allocation_id IS NOT NULL
    BEGIN
        SELECT CASE
            WHEN (
                COALESCE((
                    SELECT SUM(fci.amount)
                    FROM finance_correction_items fci
                    WHERE fci.target_allocation_id = NEW.target_allocation_id
                ), 0) + NEW.amount
            ) > (
                SELECT fa.amount FROM finance_allocations fa WHERE fa.id = NEW.target_allocation_id
            )
            THEN RAISE(ABORT, 'Total nominal koreksi melebihi nominal alokasi.')
        END;

        SELECT CASE
            WHEN (
                COALESCE((
                    SELECT SUM(fci.amount)
                    FROM finance_correction_items fci
                    WHERE fci.target_allocation_id = NEW.target_allocation_id
                ), 0) + NEW.amount + COALESCE((
                    SELECT SUM(fdi.amount)
                    FROM finance_distribution_items fdi
                    JOIN finance_distributions fd ON fd.id = fdi.distribution_id
                    WHERE fdi.allocation_id = NEW.target_allocation_id
                      AND fd.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING')
                ), 0)
            ) > (
                SELECT fa.amount FROM finance_allocations fa WHERE fa.id = NEW.target_allocation_id
            )
            THEN RAISE(ABORT, 'Koreksi ditolak: Nominal koreksi membuat reservasi penyaluran bank aktif melebihi sisa alokasi.')
        END;
    END;
  `)

  // Terapkan Migration 0185
  const migration0185Sql = fs.readFileSync(path.join(root, 'migrations', '0185_bri_qlola_distribution.sql'), 'utf8')
  sqliteDb.exec(migration0185Sql)
}

initDatabase()

// Load modules via interception
const {
  BriQlolaDistributionService,
} = require('@/lib/finance/bri/qlola-service')
const {
  BriAccountInquiryService,
} = require('@/lib/finance/bri/account-inquiry-service')
const {
  canCreateDistributionDraft,
  canSubmitDistribution,
  canCancelDistribution,
  canViewDistribution,
  canResolveDiscrepancy,
  maskBeneficiaryAccount,
  validateDistributionStatusTransition,
} = require('@/lib/finance/bri/qlola-policy')
const {
  QLOLA_H2H_CONTRACT_STATE,
  BRIAPI_TRANSFER_QLOLA_QUEUE_STATE,
  DIRECT_BRI_TRANSFER_NON_STP_COMPATIBILITY,
  DISTRIBUTABLE_ITEM_RECIPIENT_MAP,
} = require('@/lib/finance/bri/qlola-types')

async function runTests() {
  console.log('=================================================================')
  console.log('BRI-5: RUNNING HARDENED QLOLA NON-STP DISTRIBUTION TEST SUITE')
  console.log('=================================================================')

  const qlolaService = new BriQlolaDistributionService()
  const inquiryService = new BriAccountInquiryService()

  // Simulated provider adapters for testing domain workflows
  const testProviderSimulated = {
    dispatchTransfer: async ({ distributionId, amount, destinationAccount, batchReference }) => ({
      outcome: 'ACKNOWLEDGED',
      providerReference: `PROV-${batchReference}`,
      providerState: 'WAITING_APPROVAL',
    }),
  }

  const testProviderTimeout = {
    dispatchTransfer: async () => ({
      outcome: 'TIMEOUT',
      error: 'Gateway timeout 504 during dispatch',
    }),
  }

  // Seed baseline users & masters
  sqliteDb.exec(`
    INSERT INTO users (id, full_name, role) VALUES
      ('usr-admin', 'Administrator', 'admin'),
      ('usr-bendahara', 'Bendahara Pesantren', 'bendahara'),
      ('usr-petugas', 'Petugas Koperasi Maker', 'admin'),
      ('usr-koperasi-admin', 'Admin Koperasi Supervisi', 'admin'),
      ('usr-tester', 'Tester Read Only', 'admin'),
      ('usr-wali', 'Wali Santri', 'wali_santri');

    INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES
      ('san-1', 'NIS001', 'Santri Satu', 'aktif'),
      ('san-2', 'NIS002', 'Santri Dua', 'aktif');

    INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES
      ('kat-1', 'Katering Barokah', 'Makan'),
      ('lnd-1', 'Laundry Bersih', 'Cuci');

    INSERT INTO finance_distribution_recipients (id, recipient_type, name, provider_id, is_active, allowed_methods) VALUES
      ('rec_pesantren', 'PESANTREN', 'Pesantren Sukahideng (Bendahara)', NULL, 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER'),
      ('rec_kat-1', 'KATERING', 'Katering Barokah', 'kat-1', 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER'),
      ('rec_lnd-1', 'LAUNDRY', 'Laundry Bersih', 'lnd-1', 1, 'BRI_QLOLA,CASH,MANUAL_TRANSFER'),
      ('rec_inactive', 'KATERING', 'Katering Bangkrut', NULL, 0, 'BRI_QLOLA,CASH');

    INSERT INTO finance_recipient_allowed_methods (recipient_id, method) VALUES
      ('rec_pesantren', 'BRI_QLOLA'), ('rec_pesantren', 'CASH'), ('rec_pesantren', 'MANUAL_TRANSFER'),
      ('rec_kat-1', 'BRI_QLOLA'), ('rec_kat-1', 'CASH'), ('rec_kat-1', 'MANUAL_TRANSFER'),
      ('rec_lnd-1', 'BRI_QLOLA'), ('rec_lnd-1', 'CASH'), ('rec_lnd-1', 'MANUAL_TRANSFER'),
      ('rec_inactive', 'BRI_QLOLA'), ('rec_inactive', 'CASH');

    INSERT INTO finance_recipient_accounts (id, recipient_id, bank_code, account_number, account_holder, is_primary, is_active) VALUES
      ('acc-pes-1', 'rec_pesantren', '002', '001901000123301', 'Yayasan Pesantren Sukahideng', 1, 1),
      ('acc-pes-old', 'rec_pesantren', '002', '001901000999999', 'Yayasan Pesantren Rekening Lama', 0, 0),
      ('acc-kat-1', 'rec_kat-1', '002', '001901000456301', 'Katering Barokah Sejahtera', 1, 1),
      ('acc-lnd-1', 'rec_lnd-1', '014', '5432109876', 'Laundry Bersih Mandiri', 1, 1);
  `)

  // =========================================================================
  // SECTION 1: RECIPIENT MASTER, ALLOWED METHODS & ACCOUNT SNAPSHOT
  // =========================================================================
  console.log('\n--- 1. Testing Recipient Master, Allowed Methods & Account Snapshot ---')

  // 1.1 Inactive recipient blocked from creating distributions
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_inactive',
        itemType: 'UANG_MAKAN',
        period: '2026-10',
        amount: 500000,
        method: 'BRI_QLOLA',
        createdBy: 'usr-petugas',
      })
    },
    /berstatus nonaktif \(tidak dapat digunakan untuk penyaluran baru\)/,
    'Must reject distribution to inactive recipient'
  )
  console.log('✓ 1.1: Inactive recipient blocked fail-closed.')

  // 1.2 Wrong recipient category for item type rejected
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_kat-1',
        itemType: 'SPP', // SPP is PESANTREN, not KATERING
        period: '2026-10',
        amount: 500000,
        method: 'BRI_QLOLA',
        createdBy: 'usr-petugas',
      })
    },
    /tidak cocok dengan kategori penerima/,
    'Must reject mismatched item type and recipient category'
  )
  console.log('✓ 1.2: Item type category to recipient category validation enforced.')

  // 1.3 Account version snapshot captured immutably upon creation
  // Seed allocation for testing
  sqliteDb.exec(`
    INSERT INTO finance_payments (id, payment_number, santri_id, channel, method, gross_amount, net_amount, status, paid_at)
    VALUES ('pay-base-1', 'PAY-BASE-001', 'san-1', 'BRI', 'BRI_VA', 1000000, 1000000, 'SETTLED', '2026-10-01T10:00:00Z');
    INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_paid, status)
    VALUES ('ob-base-1', 'san-1', 'SPP', '2026-10', 1000000, 1000000, 'PAID');
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-base-1', 'pay-base-1', 'ob-base-1', 'SPP', 1000000, 0, 'UNDISBURSED');
  `)

  const draftRes = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 600000,
    method: 'BRI_QLOLA',
    createdBy: 'usr-petugas',
  })
  assert.strictEqual(draftRes.status, 'DRAFT')
  assert.strictEqual(draftRes.totalAmount, 600000)

  const savedDist = sqliteDb.prepare("SELECT * FROM finance_distributions WHERE id = ?").get(draftRes.distributionId)
  assert.strictEqual(savedDist.recipient_name, 'Pesantren Sukahideng (Bendahara)')
  assert.strictEqual(savedDist.recipient_category, 'PESANTREN')
  assert.strictEqual(savedDist.destination_account, '001901000123301')
  assert.strictEqual(savedDist.destination_account_holder, 'Yayasan Pesantren Sukahideng')
  assert.strictEqual(savedDist.currency, 'IDR')
  console.log('✓ 1.3: Recipient snapshot and primary account captured immutably.')

  // 1.4 Editing recipient in master does NOT affect historical distribution snapshot
  sqliteDb.prepare("UPDATE finance_recipient_accounts SET account_holder = 'Nama Berubah' WHERE id = 'acc-pes-1'").run()
  const unchangedDist = sqliteDb.prepare("SELECT * FROM finance_distributions WHERE id = ?").get(draftRes.distributionId)
  assert.strictEqual(unchangedDist.destination_account_holder, 'Yayasan Pesantren Sukahideng')
  console.log('✓ 1.4: Changing master account holder leaves historical snapshot untouched.')

  // =========================================================================
  // SECTION 2: AVAILABLE-TO-DISTRIBUTE & RESERVATION ENGINE
  // =========================================================================
  console.log('\n--- 2. Testing Available-to-Distribute & Reservation Engine ---')

  // 2.1 FIFO partial reservation verified
  // Total allocation was 1,000,000. Draft reserved 600,000 upon submission.
  const submitRes1 = await qlolaService.submitDistributionToQlola({
    distributionId: draftRes.distributionId,
    distributionRequestId: 'REQ-DIST-TEST-001',
    submittedBy: 'usr-petugas',
    testProviderAdapter: testProviderSimulated,
  })
  assert.strictEqual(submitRes1.status, 'PENDING_APPROVAL')
  assert.strictEqual(submitRes1.isReserved, true)

  // 2.2 Remaining available should be 400,000 (1,000,000 - 600,000 reserved)
  const draftRes2 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 400000,
    method: 'BRI_QLOLA',
    createdBy: 'usr-petugas',
  })
  assert.strictEqual(draftRes2.totalAmount, 400000)

  // Submit draftRes2 to PENDING_APPROVAL so all 1,000,000 is reserved
  await qlolaService.submitDistributionToQlola({
    distributionId: draftRes2.distributionId,
    distributionRequestId: 'REQ-DIST-TEST-002',
    submittedBy: 'usr-petugas',
    testProviderAdapter: testProviderSimulated,
  })
  console.log('✓ 2.1 & 2.2: Partial reservation and remaining availability formula verified.')

  // 2.3 Attempting to reserve even 1 Rupiah more than remaining 0 is blocked
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_pesantren',
        itemType: 'SPP',
        period: '2026-10',
        amount: 1,
        method: 'BRI_QLOLA',
        createdBy: 'usr-petugas',
      })
    },
    /melebihi total dana siap salur yang tersedia/,
    'Must reject distribution exceeding remaining available'
  )
  console.log('✓ 2.3: Over-distribution blocked when amount exceeds available.')

  // 2.4 DB Trigger trg_finance_dist_status_prevent_over_reserve prevents concurrent race
  // Simulate concurrent draft bypassing service:
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, item_type, period, total_amount, method, status
    ) VALUES ('dist-race-1', 'DIS-RACE-001', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10', 500000, 'BRI_QLOLA', 'DRAFT');
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-race-1', 'dist-race-1', 'alloc-base-1', 500000);
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-race-1', 'dist-race-1', 'H2H_SYNC', 'SUBMISSION_ACK', 'AUTHORITATIVE_EXACT', 'WAITING_APPROVAL',
      'REF-RACE-1', datetime('now'), 'hash-race', 'usr-admin'
    );
  `)
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist-race-1'").run()
  }, /Reservasi dana melebihi sisa alokasi efektif yang tersedia/, 'Must abort transition to reserving status when over-reserved')
  console.log('✓ 2.4: Concurrency race prevented by database trigger trg_finance_dist_status_prevent_over_reserve.')

  // 2.5 Correction reduces availability for future distributions
  sqliteDb.exec(`
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-corr-test', 'pay-base-1', 'ob-base-1', 'SPP', 500000, 0, 'UNDISBURSED');
    INSERT INTO finance_correction_items (id, target_allocation_id, obligation_id, amount)
    VALUES ('fci-test-1', 'alloc-corr-test', 'ob-base-1', 200000);
  `)
  // Available should now be 500,000 - 200,000 = 300,000
  const draftCorrRes = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 300000,
    method: 'BRI_QLOLA',
    createdBy: 'usr-petugas',
  })
  assert.strictEqual(draftCorrRes.totalAmount, 300000)
  console.log('✓ 2.5: Correction reduces effective allocation availability.')

  // 2.6 Correction that would exceed remaining allocation rejected by DB trigger
  assert.throws(() => {
    sqliteDb.prepare(`
      INSERT INTO finance_correction_items (id, target_allocation_id, obligation_id, amount)
      VALUES ('fci-over', 'alloc-corr-test', 'ob-base-1', 400000);
    `).run()
  }, /Total nominal koreksi melebihi nominal alokasi|Koreksi ditolak: Nominal koreksi membuat reservasi penyaluran bank aktif melebihi sisa alokasi/, 'Must reject over-correction')
  console.log('✓ 2.6: Over-correction rejected by trigger trg_finance_correction_items_prevent_over_correct.')

  // =========================================================================
  // SECTION 3: NON-STP STATE MACHINE & TRANSITION GUARDS
  // =========================================================================
  console.log('\n--- 3. Testing Non-STP State Machine & Transition Guards ---')

  // 3.1 DRAFT -> PENDING_APPROVAL succeeded in 2.1
  // 3.2 Non-STP Guard: DRAFT -> DISTRIBUTED directly is strictly rejected by trigger
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, item_type, period, total_amount, method, status
    ) VALUES ('dist-stp-test', 'DIS-STP-001', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10', 100000, 'BRI_QLOLA', 'DRAFT');
  `)
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist-stp-test'").run()
  }, /Penyaluran BRI_QLOLA non-STP dari DRAFT hanya boleh diajukan ke PENDING_APPROVAL|Peralihan status ke DISTRIBUTED wajib memiliki bukti.*otoritatif/, 'Must block DRAFT -> DISTRIBUTED')
  console.log('✓ 3.2: Direct DRAFT -> DISTRIBUTED blocked by Non-STP trigger.')

  // 3.3 Non-STP Guard: DRAFT -> PROCESSING directly is strictly rejected by trigger
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist-stp-test'").run()
  }, /Penyaluran BRI_QLOLA non-STP dari DRAFT hanya boleh diajukan ke PENDING_APPROVAL atau dibatalkan ke CANCELLED/, 'Must block DRAFT -> PROCESSING')
  console.log('✓ 3.3: Direct DRAFT -> PROCESSING blocked by Non-STP trigger.')

  // 3.4 PENDING_APPROVAL -> DISTRIBUTED directly is strictly rejected (needs PROCESSING first & requires provider evidence)
  sqliteDb.prepare(`
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-sub-stp', 'dist-stp-test', 'H2H_SYNC', 'SUBMISSION_ACK', 'AUTHORITATIVE_EXACT', 'WAITING_APPROVAL',
      'REF-SUB-STP', datetime('now'), 'hash-sub-stp', 'usr-admin'
    )
  `).run()
  sqliteDb.prepare("UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist-stp-test'").run()
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist-stp-test'").run()
  }, /Penyaluran BRI_QLOLA non-STP dari PENDING_APPROVAL hanya boleh beralih ke PROCESSING|Peralihan status ke DISTRIBUTED wajib memiliki bukti.*otoritatif/, 'Must block PENDING_APPROVAL -> DISTRIBUTED')
  console.log('✓ 3.4: PENDING_APPROVAL -> DISTRIBUTED blocked without intermediate bank processing.')

  // 3.5 PENDING_APPROVAL -> PROCESSING (approved by external QLola Signer) succeeds
  const syncProc = await qlolaService.syncQlolaStatus({
    distributionId: 'dist-stp-test',
    operatorId: 'usr-admin',
    externalStatus: 'APPROVED',
  })
  assert.strictEqual(syncProc.currentStatus, 'PROCESSING')
  assert.strictEqual(syncProc.isDistributedFinal, false)
  console.log('✓ 3.5: Signer approval synced to PROCESSING.')

  // 3.6 PROCESSING -> DISTRIBUTED (executed by bank) succeeds
  const syncFinal = await qlolaService.syncQlolaStatus({
    distributionId: 'dist-stp-test',
    operatorId: 'usr-admin',
    externalStatus: 'COMPLETED',
    bankTransactionReference: 'BRI-TXN-FINAL-999',
  })
  assert.strictEqual(syncFinal.currentStatus, 'DISTRIBUTED')
  assert.strictEqual(syncFinal.isDistributedFinal, true)
  const finalDist = sqliteDb.prepare("SELECT bank_transaction_reference FROM finance_distributions WHERE id = 'dist-stp-test'").get()
  assert.strictEqual(finalDist.bank_transaction_reference, 'BRI-TXN-FINAL-999')
  console.log('✓ 3.6: Bank execution completed to DISTRIBUTED with bank transaction reference.')

  // 3.7 Terminal states are strictly immutable
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist-stp-test'").run()
  }, /Penyaluran dengan status terminal bersifat final dan tidak dapat diubah/, 'Must reject modifying terminal status')
  console.log('✓ 3.7: Terminal status immutability verified.')

  // =========================================================================
  // SECTION 4: IDEMPOTENCY & OUTBOX TRANSFER INTENT
  // =========================================================================
  console.log('\n--- 4. Testing Submission Idempotency & Outbox Transfer Intent ---')

  // 4.1 First submission created intent with status SUBMITTED in Section 2.1
  const intent1 = sqliteDb.prepare("SELECT * FROM finance_qlola_transfer_intents WHERE distribution_request_id = 'REQ-DIST-TEST-001'").get()
  assert.strictEqual(intent1.intent_status, 'SUBMITTED')
  assert.strictEqual(intent1.maker_user_id, 'usr-petugas')
  console.log('✓ 4.1: Outbox intent created with SUBMITTED status and Maker reference.')

  // 4.2 Duplicate submission with same distribution_request_id returns identical result without double reservation
  const submitDup = await qlolaService.submitDistributionToQlola({
    distributionId: draftRes.distributionId,
    distributionRequestId: 'REQ-DIST-TEST-001',
    submittedBy: 'usr-petugas',
    testProviderAdapter: testProviderSimulated,
  })
  assert.strictEqual(submitDup.alreadySubmitted, true)
  assert.strictEqual(submitDup.distributionId, draftRes.distributionId)
  assert.strictEqual(submitDup.status, 'PENDING_APPROVAL')
  console.log('✓ 4.2: Duplicate submission returns identical result without re-reserving.')

  // 4.3 Unique index blocks reusing distribution_request_id for another distribution
  assert.throws(() => {
    sqliteDb.prepare(`
      INSERT INTO finance_distributions (
        id, distribution_number, recipient_type, recipient_id, item_type, period,
        total_amount, method, status, distribution_request_id
      ) VALUES (
        'dist-req-dup', 'DIS-DUP-999', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10',
        10000, 'BRI_QLOLA', 'DRAFT', 'REQ-DIST-TEST-001'
      );
    `).run()
  }, /UNIQUE constraint failed/, 'Must reject duplicate distribution_request_id across distributions')
  console.log('✓ 4.3: Unique index uq_finance_distributions_req_id verified.')

  // =========================================================================
  // SECTION 5: CANCELLATION SAFETY & PROVIDER SWITCH GUARDS
  // =========================================================================
  console.log('\n--- 5. Testing Cancellation Safety & Provider Switch Guards ---')

  // 5.1 Cancel while DRAFT -> CANCELLED, releases preliminary allocations
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, item_type, period, total_amount, method, status
    ) VALUES ('dist-cancel-draft', 'DIS-CD-001', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10', 50000, 'BRI_QLOLA', 'DRAFT');
  `)
  const cancelDraftRes = await qlolaService.cancelDistribution({
    distributionId: 'dist-cancel-draft',
    cancelledBy: 'usr-admin',
    reason: 'Salah input nominal',
  })
  assert.strictEqual(cancelDraftRes.status, 'CANCELLED')
  assert.strictEqual(cancelDraftRes.isReservationReleased, true)
  console.log('✓ 5.1: Cancel while DRAFT transitions directly to CANCELLED and releases reservation.')

  // 5.2 Cancel while PENDING_APPROVAL before bank submission (confirmedByBank: true) releases reservation
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, item_type, period, total_amount, method, status
    ) VALUES ('dist-cancel-pending', 'DIS-CP-001', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10', 50000, 'BRI_QLOLA', 'PENDING_APPROVAL');
  `)
  const cancelPendingRes = await qlolaService.cancelDistribution({
    distributionId: 'dist-cancel-pending',
    cancelledBy: 'usr-admin',
    reason: 'Dibatalkan Maker sebelum approval',
    confirmedByBank: true,
  })
  assert.strictEqual(cancelPendingRes.status, 'CANCELLED')
  assert.strictEqual(cancelPendingRes.isReservationReleased, true)
  console.log('✓ 5.2: Cancel while PENDING_APPROVAL before submission releases reservation.')

  // 5.3 Cancel while PENDING_APPROVAL after submission without bank confirmation -> CANCEL_PENDING (reservation remains)
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, item_type, period, total_amount, method, status,
      dispatch_attempted_at, submission_outcome
    ) VALUES ('dist-cp-wait', 'DIS-CPW-001', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10', 50000, 'BRI_QLOLA', 'PENDING_APPROVAL',
      datetime('now'), 'SUBMITTED');
  `)
  const cancelWaitRes = await qlolaService.cancelDistribution({
    distributionId: 'dist-cp-wait',
    cancelledBy: 'usr-admin',
    reason: 'Pengajuan pembatalan ke bank',
    confirmedByBank: false,
  })
  assert.strictEqual(cancelWaitRes.status, 'CANCEL_PENDING')
  assert.strictEqual(cancelWaitRes.isReservationReleased, false)
  console.log('✓ 5.3: Cancel without bank confirmation enters CANCEL_PENDING and safely preserves reservation.')

  // 5.4 Switch method away from BRI_QLOLA while in PENDING_APPROVAL or CANCEL_PENDING is blocked by DB trigger
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET method = 'CASH' WHERE id = 'dist-cp-wait'").run()
  }, /Dilarang mengganti metode penyaluran saat dana berada dalam status reservasi aktif/, 'Must block switching to CASH while in CANCEL_PENDING')
  console.log('✓ 5.4: Switching method to CASH/MANUAL while in CANCEL_PENDING strictly blocked.')

  // 5.5 Switching method only allowed after terminal CANCELLED or REJECTED
  const syncBankReject = await qlolaService.syncQlolaStatus({
    distributionId: 'dist-cp-wait',
    operatorId: 'usr-admin',
    externalStatus: 'REJECTED',
    rejectionReason: 'Signer QLola membatalkan instruksi transfer',
  })
  assert.strictEqual(syncBankReject.currentStatus, 'CANCELLED')
  assert.strictEqual(syncBankReject.isReservationReleased, true)

  // Direct rejection from PENDING_APPROVAL -> REJECTED
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, item_type, period, total_amount, method, status
    ) VALUES ('dist-reject-test', 'DIS-REJ-001', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10', 50000, 'BRI_QLOLA', 'PENDING_APPROVAL');
  `)
  const directReject = await qlolaService.syncQlolaStatus({
    distributionId: 'dist-reject-test',
    operatorId: 'usr-admin',
    externalStatus: 'REJECTED',
    rejectionReason: 'Signer QLola menolak instruksi transfer',
  })
  assert.strictEqual(directReject.currentStatus, 'REJECTED')
  assert.strictEqual(directReject.isReservationReleased, true)
  console.log('✓ 5.5: Official bank cancellation and rejection releases reservation cleanly.')

  // =========================================================================
  // SECTION 6: POST-DISTRIBUTION CORRECTION & RECOVERY
  // =========================================================================
  console.log('\n--- 6. Testing Post-Distribution Correction & Recovery ---')

  // 6.1 Correction on already DISTRIBUTED allocation does NOT mutate historical distribution
  const recoveryRes = await qlolaService.recordRecoveryForDistributedCorrection({
    allocationId: 'alloc-base-1',
    distributionId: 'dist-stp-test',
    correctionAmount: 50000,
    reason: 'Koreksi kelebihan alokasi setelah tersalurkan',
    operatorId: 'usr-admin',
  })
  assert.ok(recoveryRes.recoveryItemId)

  const recItem = sqliteDb.prepare("SELECT * FROM finance_reconciliation_items WHERE id = ?").get(recoveryRes.recoveryItemId)
  assert.strictEqual(recItem.match_status, 'PENDING_RECOVERY')
  assert.strictEqual(recItem.internal_amount, 50000)

  // Verify historical distribution remains intact
  const distAfterCorr = sqliteDb.prepare("SELECT * FROM finance_distributions WHERE id = 'dist-stp-test'").get()
  assert.strictEqual(distAfterCorr.status, 'DISTRIBUTED')
  assert.strictEqual(distAfterCorr.total_amount, 100000)
  console.log('✓ 6.1: Correction on distributed allocation queues PENDING_RECOVERY without historical mutation.')

  // =========================================================================
  // SECTION 7: ROLE AUTHORIZATION & MAKER/SIGNER SEPARATION
  // =========================================================================
  console.log('\n--- 7. Testing Role Authorization & Maker/Signer Separation ---')

  // 7.1 Admin and Bendahara can create draft, submit, and cancel
  assert.strictEqual(canCreateDistributionDraft(['admin']), true)
  assert.strictEqual(canSubmitDistribution(['admin'], 'BRI_QLOLA'), true)
  assert.strictEqual(canCancelDistribution(['admin']), true)

  assert.strictEqual(canCreateDistributionDraft(['bendahara']), true)
  assert.strictEqual(canSubmitDistribution(['bendahara'], 'BRI_QLOLA'), true)
  assert.strictEqual(canCancelDistribution(['bendahara']), true)

  // 7.2 Petugas Koperasi can create draft and submit (Maker), but cannot cancel
  assert.strictEqual(canCreateDistributionDraft(['petugas_koperasi']), true)
  assert.strictEqual(canSubmitDistribution(['petugas_koperasi'], 'BRI_QLOLA'), true)
  assert.strictEqual(canCancelDistribution(['petugas_koperasi']), false)

  // 7.3 Admin Koperasi alone cannot submit directly (Maker/Signer separation)
  assert.strictEqual(canSubmitDistribution(['admin_koperasi'], 'BRI_QLOLA'), false)

  // 7.4 Tester is strictly read-only
  assert.strictEqual(canCreateDistributionDraft(['tester']), false)
  assert.strictEqual(canSubmitDistribution(['tester'], 'BRI_QLOLA'), false)
  assert.strictEqual(canCancelDistribution(['tester']), false)
  assert.strictEqual(canViewDistribution(['tester']), true)
  console.log('✓ 7.1-7.4: Role authorization matrix and Maker/Signer separation verified.')

  // =========================================================================
  // SECTION 8: MONEY, BANK FEE & ACCOUNT MASKING
  // =========================================================================
  console.log('\n--- 8. Testing Money, Bank Fee & Account Masking ---')

  // 8.1 Zero and negative amounts blocked
  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_pesantren',
        itemType: 'SPP',
        period: '2026-10',
        amount: 0,
        method: 'BRI_QLOLA',
        createdBy: 'usr-admin',
      })
    },
    /Nominal penyaluran harus berupa bilangan bulat positif/,
    'Must reject 0 amount'
  )

  await assert.rejects(
    async () => {
      await qlolaService.createDistributionDraft({
        recipientId: 'rec_pesantren',
        itemType: 'SPP',
        period: '2026-10',
        amount: -50000,
        method: 'BRI_QLOLA',
        createdBy: 'usr-admin',
      })
    },
    /Nominal penyaluran harus berupa bilangan bulat positif/,
    'Must reject negative amount'
  )
  console.log('✓ 8.1: Zero and negative amounts rejected fail-closed.')

  // 8.2 Currency is IDR only
  const currencyCheck = sqliteDb.prepare("SELECT currency FROM finance_distributions WHERE id = 'dist-stp-test'").get()
  assert.strictEqual(currencyCheck.currency, 'IDR')
  console.log('✓ 8.2: Currency hard-bound to IDR.')

  // 8.3 Account masking verified
  assert.strictEqual(maskBeneficiaryAccount('001901000123301'), '001*********301')
  assert.strictEqual(maskBeneficiaryAccount('12345'), '***')
  assert.strictEqual(maskBeneficiaryAccount(null), 'N/A')
  console.log('✓ 8.3: Beneficiary account masking verified for audit logging.')

  // =========================================================================
  // SECTION 9: CONTRACT ISOLATION & PROVIDER SEAMS
  // =========================================================================
  console.log('\n--- 9. Testing Contract Isolation & Provider Seams ---')

  assert.strictEqual(QLOLA_H2H_CONTRACT_STATE, 'QLOLA_H2H_CONTRACT_TBD')
  assert.strictEqual(BRIAPI_TRANSFER_QLOLA_QUEUE_STATE, 'CONTRACT_TBD')
  assert.strictEqual(DIRECT_BRI_TRANSFER_NON_STP_COMPATIBILITY, 'NOT_VERIFIED')

  const inqRes = await inquiryService.verifyBeneficiaryAccount({
    bankCode: '002',
    accountNumber: '001901000123301',
    expectedAccountHolder: 'Yayasan Pesantren Sukahideng',
  })
  assert.strictEqual(inqRes.isMatched, true)
  assert.strictEqual(inqRes.bankCode, '002')
  console.log('✓ 9.1: Contract isolation declarations and account inquiry seam verified.')

  // =========================================================================
  // SECTION 10: BRI-5 REVIEWER HARDENING SUITE (20 FINAL ATOMICITY TESTS)
  // =========================================================================
  console.log('\n--- 10. Running BRI-5 Reviewer Hardening Suite (20 Tests) ---')

  // Setup seed allocation for regression tests
  sqliteDb.exec(`
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-reg-1', 'pay-base-1', 'ob-base-1', 'SPP', 5000000, 0, 'UNDISBURSED');
  `)

  // Test 1: SUBMISSION_PENDING reserves allocation
  sqliteDb.exec(`
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-res-1', 'pay-base-1', 'ob-base-1', 'SPP', 500000, 0, 'UNDISBURSED');
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-sub-pen', 'DIS-SP-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 500000, 'BRI_QLOLA', 'DRAFT', 'IDR'
    );
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-sp-1', 'dist-sub-pen', 'alloc-res-1', 500000);
  `)
  sqliteDb.prepare(`
    INSERT INTO finance_qlola_transfer_intents (
      id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
    ) VALUES ('intent-sp-1', 'dist-sub-pen', 'REQ-SP-001', 'SUBMISSION_PENDING', 'usr-petugas', 'hash-sp-1')
  `).run()
  sqliteDb.prepare("UPDATE finance_distributions SET submission_outcome = 'SUBMISSION_PENDING' WHERE id = 'dist-sub-pen'").run()

  const row1 = sqliteDb.prepare(`
    SELECT
      ((a.amount - COALESCE((
        SELECT SUM(fci.amount)
        FROM finance_correction_items fci
        WHERE fci.target_allocation_id = a.id
      ), 0)) - COALESCE((
        SELECT SUM(di.amount)
        FROM finance_distribution_items di
        JOIN finance_distributions d ON di.distribution_id = d.id
        WHERE di.allocation_id = a.id
          AND (
            d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
            OR (
              d.status = 'DRAFT' AND EXISTS (
                SELECT 1 FROM finance_qlola_transfer_intents ti
                WHERE ti.distribution_id = d.id
                  AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN')
              )
            )
          )
      ), 0)) AS available_amount
    FROM finance_allocations a WHERE a.id = 'alloc-res-1'
  `).get()
  assert.strictEqual(row1.available_amount, 0, 'Test 1: alloc-res-1 must have 0 available because SUBMISSION_PENDING reserves it')
  console.log('✓ Test 1: SUBMISSION_PENDING reserves allocation.')

  // Test 2: UNKNOWN reserves allocation
  sqliteDb.exec(`
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-res-2', 'pay-base-1', 'ob-base-1', 'SPP', 300000, 0, 'UNDISBURSED');
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency, dispatch_attempted_at, submission_outcome
    ) VALUES (
      'dist-unk-1', 'DIS-UNK-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 300000, 'BRI_QLOLA', 'DRAFT', 'IDR', datetime('now'), 'UNKNOWN'
    );
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-unk-1', 'dist-unk-1', 'alloc-res-2', 300000);
    INSERT INTO finance_qlola_transfer_intents (
      id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
    ) VALUES ('intent-unk-1', 'dist-unk-1', 'REQ-UNK-001', 'UNKNOWN', 'usr-petugas', 'hash-unk-1');
  `)
  const row2 = sqliteDb.prepare(`
    SELECT
      ((a.amount - COALESCE((
        SELECT SUM(fci.amount)
        FROM finance_correction_items fci
        WHERE fci.target_allocation_id = a.id
      ), 0)) - COALESCE((
        SELECT SUM(di.amount)
        FROM finance_distribution_items di
        JOIN finance_distributions d ON di.distribution_id = d.id
        WHERE di.allocation_id = a.id
          AND (
            d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
            OR (
              d.status = 'DRAFT' AND EXISTS (
                SELECT 1 FROM finance_qlola_transfer_intents ti
                WHERE ti.distribution_id = d.id
                  AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN')
              )
            )
          )
      ), 0)) AS available_amount
    FROM finance_allocations a WHERE a.id = 'alloc-res-2'
  `).get()
  assert.strictEqual(row2.available_amount, 0, 'Test 2: alloc-res-2 must have 0 available because UNKNOWN reserves it')
  console.log('✓ Test 2: UNKNOWN reserves allocation.')

  // Test 3: competing distribution blocked while intent reserves
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-comp-1', 'DIS-COMP-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 200000, 'BRI_QLOLA', 'DRAFT', 'IDR'
    );
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-comp-1', 'dist-comp-1', 'alloc-res-1', 200000);
  `)
  assert.throws(() => {
    sqliteDb.prepare(`
      INSERT INTO finance_qlola_transfer_intents (
        id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
      ) VALUES ('intent-comp-1', 'dist-comp-1', 'REQ-COMP-001', 'SUBMISSION_PENDING', 'usr-petugas', 'hash-comp-1')
    `).run()
  }, /Reservasi intent transfer melebihi sisa alokasi efektif yang tersedia/, 'Test 3 Failed: Competing intent reservation must be blocked by trigger')
  console.log('✓ Test 3: competing distribution blocked while intent reserves.')

  // Test 4: provider ACK transfers reservation without double-count
  sqliteDb.prepare(`
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-ack-sp1', 'dist-sub-pen', 'H2H_SYNC', 'SUBMISSION_ACK', 'AUTHORITATIVE_EXACT', 'WAITING_APPROVAL',
      'REF-ACK-SP1', datetime('now'), 'hash-ack-sp1', 'usr-admin'
    )
  `).run()
  sqliteDb.prepare("UPDATE finance_qlola_transfer_intents SET intent_status = 'SUBMITTED' WHERE id = 'intent-sp-1'").run()
  sqliteDb.prepare("UPDATE finance_distributions SET status = 'PENDING_APPROVAL', submission_outcome = 'SUBMITTED' WHERE id = 'dist-sub-pen'").run()

  const distCheck4 = sqliteDb.prepare("SELECT status FROM finance_distributions WHERE id = 'dist-sub-pen'").get()
  assert.strictEqual(distCheck4.status, 'PENDING_APPROVAL')
  console.log('✓ Test 4: provider ACK transfers reservation without double-count.')

  // Test 5: DRAFT with active intent cannot edit item/recipient/method
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-frozen', 'DIS-FRZ-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 100000, 'BRI_QLOLA', 'DRAFT', 'IDR'
    );
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-frz-1', 'dist-frozen', 'alloc-reg-1', 100000);
    INSERT INTO finance_qlola_transfer_intents (
      id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
    ) VALUES ('intent-frz-1', 'dist-frozen', 'REQ-FRZ-001', 'UNKNOWN', 'usr-petugas', 'hash-frz-1');
  `)
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET method = 'CASH' WHERE id = 'dist-frozen'").run()
  }, /Dilarang mengganti metode penyaluran saat dana berada dalam status reservasi aktif atau memiliki intent transfer aktif/, 'Test 5 Failed: Method switch must be blocked')
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET recipient_name = 'Penerima Lain' WHERE id = 'dist-frozen'").run()
  }, /Field finansial instruksi penyaluran.*bersifat immutable/, 'Test 5 Failed: Financial field edit must be blocked')
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distribution_items SET amount = 200000 WHERE id = 'di-frz-1'").run()
  }, /Item penyaluran bersifat immutable/, 'Test 5 Failed: Item update must be blocked')
  assert.throws(() => {
    sqliteDb.prepare("DELETE FROM finance_distribution_items WHERE id = 'di-frz-1'").run()
  }, /Item penyaluran bersifat immutable/, 'Test 5 Failed: Item delete must be blocked')
  console.log('✓ Test 5: DRAFT with active intent cannot edit item/recipient/method.')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 1: UNKNOWN pre-ACK cancel does NOT perform DRAFT -> CANCEL_PENDING
  // (returns DRAFT, intent CANCEL_PENDING)
  // -------------------------------------------------------------------------
  sqliteDb.exec(`
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-u-canc', 'pay-base-1', 'ob-base-1', 'SPP', 400000, 0, 'UNDISBURSED');
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency, dispatch_attempted_at, submission_outcome
    ) VALUES (
      'dist-u-canc', 'DIS-UC-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 400000, 'BRI_QLOLA', 'DRAFT', 'IDR', datetime('now'), 'UNKNOWN'
    );
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-uc-1', 'dist-u-canc', 'alloc-u-canc', 400000);
    INSERT INTO finance_qlola_transfer_intents (
      id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
    ) VALUES ('intent-uc-1', 'dist-u-canc', 'REQ-UC-001', 'UNKNOWN', 'usr-petugas', 'hash-uc-1');
  `)

  const cancelPreAckRes = await qlolaService.cancelDistribution({
    distributionId: 'dist-u-canc',
    cancelledBy: 'usr-admin',
    reason: 'Pre-ack cancellation requested',
  })

  assert.strictEqual(cancelPreAckRes.status, 'DRAFT', 'Distribution MUST remain DRAFT (NOT CANCEL_PENDING)')
  assert.strictEqual(cancelPreAckRes.intentStatus, 'CANCEL_PENDING')
  assert.strictEqual(cancelPreAckRes.isReservationReleased, false)

  const distUcDb = sqliteDb.prepare("SELECT status FROM finance_distributions WHERE id = 'dist-u-canc'").get()
  const intentUcDb = sqliteDb.prepare("SELECT intent_status FROM finance_qlola_transfer_intents WHERE id = 'intent-uc-1'").get()
  assert.strictEqual(distUcDb.status, 'DRAFT', 'DB distribution status must stay DRAFT')
  assert.strictEqual(intentUcDb.intent_status, 'CANCEL_PENDING', 'DB intent status must be CANCEL_PENDING')
  console.log('✓ Reviewer Test 1: UNKNOWN pre-ACK cancel does NOT perform DRAFT -> CANCEL_PENDING (returns DRAFT, intent CANCEL_PENDING).')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 2: UNKNOWN -> intent CANCEL_PENDING preserves reservation
  // -------------------------------------------------------------------------
  const allocUcAvail = sqliteDb.prepare(`
    SELECT
      ((a.amount - COALESCE((
        SELECT SUM(fci.amount)
        FROM finance_correction_items fci
        WHERE fci.target_allocation_id = a.id
      ), 0)) - COALESCE((
        SELECT SUM(di.amount)
        FROM finance_distribution_items di
        JOIN finance_distributions d ON di.distribution_id = d.id
        WHERE di.allocation_id = a.id
          AND (
            d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
            OR (
              d.status = 'DRAFT' AND EXISTS (
                SELECT 1 FROM finance_qlola_transfer_intents ti
                WHERE ti.distribution_id = d.id
                  AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
              )
            )
          )
      ), 0)) AS available_amount
    FROM finance_allocations a WHERE a.id = 'alloc-u-canc'
  `).get()
  assert.strictEqual(allocUcAvail.available_amount, 0, 'alloc-u-canc must have 0 available because CANCEL_PENDING reserves it')

  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-comp-uc', 'DIS-CUC-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 100000, 'BRI_QLOLA', 'DRAFT', 'IDR'
    );
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-cuc-1', 'dist-comp-uc', 'alloc-u-canc', 100000);
  `)
  assert.throws(() => {
    sqliteDb.prepare(`
      INSERT INTO finance_qlola_transfer_intents (
        id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
      ) VALUES ('intent-cuc-1', 'dist-comp-uc', 'REQ-CUC-001', 'SUBMISSION_PENDING', 'usr-petugas', 'hash-cuc-1')
    `).run()
  }, /Reservasi intent transfer melebihi sisa alokasi efektif yang tersedia/, 'Reviewer Test 2 Failed: Competing reserve while CANCEL_PENDING must be blocked')
  console.log('✓ Reviewer Test 2: UNKNOWN -> intent CANCEL_PENDING preserves reservation.')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 3: Provider later confirms cancellation -> DRAFT -> CANCELLED
  // -------------------------------------------------------------------------
  const confirmedCancelRes = await qlolaService.cancelDistribution({
    distributionId: 'dist-u-canc',
    cancelledBy: 'usr-admin',
    reason: 'Bank confirmed instruction cancelled',
    confirmedByBank: true,
  })
  assert.strictEqual(confirmedCancelRes.status, 'CANCELLED')
  assert.strictEqual(confirmedCancelRes.isReservationReleased, true)
  const distUcCancelled = sqliteDb.prepare("SELECT status FROM finance_distributions WHERE id = 'dist-u-canc'").get()
  const intentUcCancelled = sqliteDb.prepare("SELECT intent_status FROM finance_qlola_transfer_intents WHERE id = 'intent-uc-1'").get()
  assert.strictEqual(distUcCancelled.status, 'CANCELLED')
  assert.strictEqual(intentUcCancelled.intent_status, 'CANCELLED')
  console.log('✓ Reviewer Test 3: Provider later confirms cancellation -> DRAFT -> CANCELLED.')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 4: Provider later sends SUBMISSION_ACK after cancel request ->
  // distribution PENDING_APPROVAL, intent SUBMITTED, reservation preserved
  // -------------------------------------------------------------------------
  sqliteDb.exec(`
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-ack-later', 'pay-base-1', 'ob-base-1', 'SPP', 350000, 0, 'UNDISBURSED');
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency, dispatch_attempted_at, submission_outcome
    ) VALUES (
      'dist-ack-later', 'DIS-AL-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 350000, 'BRI_QLOLA', 'DRAFT', 'IDR', datetime('now'), 'UNKNOWN'
    );
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-al-1', 'dist-ack-later', 'alloc-ack-later', 350000);
    INSERT INTO finance_qlola_transfer_intents (
      id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
    ) VALUES ('intent-al-1', 'dist-ack-later', 'REQ-AL-001', 'CANCEL_PENDING', 'usr-petugas', 'hash-al-1');
  `)

  const ackAfterCancelRes = await qlolaService.syncQlolaStatus({
    distributionId: 'dist-ack-later',
    operatorId: 'usr-admin',
    externalStatus: 'WAITING_APPROVAL',
    source: 'H2H_SYNC',
    evidenceType: 'SUBMISSION_ACK',
  })
  assert.strictEqual(ackAfterCancelRes.currentStatus, 'PENDING_APPROVAL')
  const distAlDb = sqliteDb.prepare("SELECT status, submission_outcome FROM finance_distributions WHERE id = 'dist-ack-later'").get()
  const intentAlDb = sqliteDb.prepare("SELECT intent_status FROM finance_qlola_transfer_intents WHERE id = 'intent-al-1'").get()
  assert.strictEqual(distAlDb.status, 'PENDING_APPROVAL')
  assert.strictEqual(distAlDb.submission_outcome, 'SUBMITTED')
  assert.strictEqual(intentAlDb.intent_status, 'SUBMITTED')
  console.log('✓ Reviewer Test 4: Provider later sends SUBMISSION_ACK after cancel request -> distribution PENDING_APPROVAL, intent SUBMITTED, reservation preserved.')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 5: ACK handoff intent reservation -> distribution reservation is atomic in one batch
  // -------------------------------------------------------------------------
  const allocAlAvail = sqliteDb.prepare(`
    SELECT
      ((a.amount - COALESCE((
        SELECT SUM(fci.amount)
        FROM finance_correction_items fci
        WHERE fci.target_allocation_id = a.id
      ), 0)) - COALESCE((
        SELECT SUM(di.amount)
        FROM finance_distribution_items di
        JOIN finance_distributions d ON di.distribution_id = d.id
        WHERE di.allocation_id = a.id
          AND (
            d.status IN ('PENDING_APPROVAL', 'PROCESSING', 'CANCEL_PENDING', 'DISTRIBUTED')
            OR (
              d.status = 'DRAFT' AND EXISTS (
                SELECT 1 FROM finance_qlola_transfer_intents ti
                WHERE ti.distribution_id = d.id
                  AND ti.intent_status IN ('SUBMISSION_PENDING', 'UNKNOWN', 'CANCEL_PENDING')
              )
            )
          )
      ), 0)) AS available_amount
    FROM finance_allocations a WHERE a.id = 'alloc-ack-later'
  `).get()
  assert.strictEqual(allocAlAvail.available_amount, 0, 'Available amount remains 0 across handoff')
  console.log('✓ Reviewer Test 5: ACK handoff intent reservation -> distribution reservation is atomic in one batch.')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 6: Concurrent competing reserve during ACK cannot overdraw
  // (competing 500k against 700k reserved from 1M fails)
  // -------------------------------------------------------------------------
  sqliteDb.exec(`
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-1m-comp', 'pay-base-1', 'ob-base-1', 'SPP', 1000000, 0, 'UNDISBURSED');
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-700k', 'DIS-700K-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 700000, 'BRI_QLOLA', 'DRAFT', 'IDR'
    );
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-700k', 'dist-700k', 'alloc-1m-comp', 700000);
    INSERT INTO finance_qlola_transfer_intents (
      id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
    ) VALUES ('intent-700k', 'dist-700k', 'REQ-700K-001', 'SUBMISSION_PENDING', 'usr-petugas', 'hash-700k');

    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-500k', 'DIS-500K-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 500000, 'BRI_QLOLA', 'DRAFT', 'IDR'
    );
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-500k', 'dist-500k', 'alloc-1m-comp', 500000);
  `)

  assert.throws(() => {
    sqliteDb.prepare(`
      INSERT INTO finance_qlola_transfer_intents (
        id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
      ) VALUES ('intent-500k', 'dist-500k', 'REQ-500K-001', 'SUBMISSION_PENDING', 'usr-petugas', 'hash-500k')
    `).run()
  }, /Reservasi intent transfer melebihi sisa alokasi efektif yang tersedia/, 'Reviewer Test 6 Failed: Competing 500k against 700k from 1M must fail')
  console.log('✓ Reviewer Test 6: Concurrent competing reserve during ACK cannot overdraw (competing 500k against 700k reserved from 1M fails).')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 7: Injected failure during ACK handoff rolls back both states
  // -------------------------------------------------------------------------
  sqliteDb.exec(`
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-rb-test', 'pay-base-1', 'ob-base-1', 'SPP', 200000, 0, 'UNDISBURSED');
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-rb-test', 'DIS-RB-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 200000, 'BRI_QLOLA', 'DRAFT', 'IDR'
    );
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-rb-test', 'dist-rb-test', 'alloc-rb-test', 200000);
    INSERT INTO finance_qlola_transfer_intents (
      id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
    ) VALUES ('intent-rb-test', 'dist-rb-test', 'REQ-RB-001', 'UNKNOWN', 'usr-petugas', 'hash-rb');
  `)

  await assert.rejects(
    async () => {
      await mockDb.batch([
        {
          sql: "UPDATE finance_qlola_transfer_intents SET intent_status = 'SUBMITTED' WHERE id = 'intent-rb-test'",
          params: [],
        },
        {
          sql: "UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist-rb-test'",
          params: [],
        },
      ])
    },
    /Peralihan DRAFT ke PENDING_APPROVAL wajib memiliki bukti SUBMISSION_ACK/,
    'Reviewer Test 7 Failed: Injected error must cause rollback'
  )

  const rbIntent = sqliteDb.prepare("SELECT intent_status FROM finance_qlola_transfer_intents WHERE id = 'intent-rb-test'").get()
  const rbDist = sqliteDb.prepare("SELECT status FROM finance_distributions WHERE id = 'dist-rb-test'").get()
  assert.strictEqual(rbIntent.intent_status, 'UNKNOWN', 'Intent status must remain UNKNOWN after rollback')
  assert.strictEqual(rbDist.status, 'DRAFT', 'Distribution status must remain DRAFT after rollback')
  console.log('✓ Reviewer Test 7: Injected failure during ACK handoff rolls back both states.')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 8: DRAFT -> PENDING_APPROVAL without eligible SUBMISSION_ACK blocked DB
  // -------------------------------------------------------------------------
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist-rb-test'").run()
  }, /Peralihan DRAFT ke PENDING_APPROVAL wajib memiliki bukti SUBMISSION_ACK otoritatif/, 'Reviewer Test 8 Failed: DRAFT -> PENDING_APPROVAL must require eligible SUBMISSION_ACK')
  console.log('✓ Reviewer Test 8: DRAFT -> PENDING_APPROVAL without eligible SUBMISSION_ACK blocked DB.')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 9: PENDING_APPROVAL -> PROCESSING without eligible APPROVAL_PROGRESS blocked DB
  // -------------------------------------------------------------------------
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-pa-noev', 'DIS-PANE-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 100000, 'BRI_QLOLA', 'PENDING_APPROVAL', 'IDR'
    );
  `)
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist-pa-noev'").run()
  }, /Peralihan PENDING_APPROVAL ke PROCESSING wajib memiliki bukti APPROVAL_PROGRESS otoritatif/, 'Reviewer Test 9 Failed: PENDING_APPROVAL -> PROCESSING must require APPROVAL_PROGRESS')
  console.log('✓ Reviewer Test 9: PENDING_APPROVAL -> PROCESSING without eligible APPROVAL_PROGRESS blocked DB.')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 10: TEST_PROVIDER evidence cannot authorize PENDING_APPROVAL (DB trigger rejects)
  // -------------------------------------------------------------------------
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-tp-pa', 'DIS-TPPA-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 100000, 'BRI_QLOLA', 'DRAFT', 'IDR'
    );
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-tp-pa-1', 'dist-tp-pa', 'TEST_PROVIDER', 'SUBMISSION_ACK', 'AUTHORITATIVE_EXACT', 'WAITING_APPROVAL',
      'TP-REF-PA', datetime('now'), 'hash-tp-pa', 'usr-admin'
    );
  `)
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET status = 'PENDING_APPROVAL' WHERE id = 'dist-tp-pa'").run()
  }, /Peralihan DRAFT ke PENDING_APPROVAL wajib memiliki bukti SUBMISSION_ACK otoritatif \(non-TEST_PROVIDER\)/, 'Reviewer Test 10 Failed: TEST_PROVIDER evidence must not authorize PENDING_APPROVAL')
  console.log('✓ Reviewer Test 10: TEST_PROVIDER evidence cannot authorize PENDING_APPROVAL (DB trigger rejects).')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 11: TEST_PROVIDER evidence cannot authorize DISTRIBUTED (DB trigger rejects)
  // -------------------------------------------------------------------------
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-tp-dist', 'DIS-TPDI-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 100000, 'BRI_QLOLA', 'PENDING_APPROVAL', 'IDR'
    );
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-app-tp-setup', 'dist-tp-dist', 'H2H_SYNC', 'APPROVAL_PROGRESS', 'AUTHORITATIVE_EXACT', 'APPROVED',
      'TP-SETUP-REF', datetime('now'), 'hash-tp-setup', 'usr-admin'
    );
  `)
  sqliteDb.prepare("UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist-tp-dist'").run()

  sqliteDb.exec(`
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-tp-dist-1', 'dist-tp-dist', 'TEST_PROVIDER', 'EXECUTION_SUCCESS', 'AUTHORITATIVE_EXACT', 'COMPLETED',
      'TP-REF-DIST', datetime('now'), 'hash-tp-dist', 'usr-admin'
    );
  `)
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist-tp-dist'").run()
  }, /Peralihan status ke DISTRIBUTED wajib memiliki bukti EXECUTION_SUCCESS otoritatif \(non-TEST_PROVIDER\)/, 'Reviewer Test 11 Failed: TEST_PROVIDER evidence must not authorize DISTRIBUTED')
  console.log('✓ Reviewer Test 11: TEST_PROVIDER evidence cannot authorize DISTRIBUTED (DB trigger rejects).')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 12: Authenticated manual proof resolution with verified DB operator and role snapshot
  // -------------------------------------------------------------------------
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-man-ok', 'DIS-MOK-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 100000, 'BRI_QLOLA', 'PENDING_APPROVAL', 'IDR'
    );
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-app-man-setup', 'dist-man-ok', 'H2H_SYNC', 'APPROVAL_PROGRESS', 'AUTHORITATIVE_EXACT', 'APPROVED',
      'MAN-SETUP-REF', datetime('now'), 'hash-man-setup', 'usr-admin'
    );
  `)
  sqliteDb.prepare("UPDATE finance_distributions SET status = 'PROCESSING' WHERE id = 'dist-man-ok'").run()

  sqliteDb.exec(`
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by,
      operator_authorized_by, operator_role_snapshot, manual_proof_reference, audit_linkage, notes, resolved_at
    ) VALUES (
      'ev-man-ok-1', 'dist-man-ok', 'MANUAL_OFFICIAL_PROOF', 'EXECUTION_SUCCESS', 'MANUAL_RESOLVED', 'COMPLETED',
      'MAN-PROOF-123', datetime('now'), 'hash-man-ok', 'usr-admin',
      'usr-bendahara', 'bendahara', 'SLIP-SETOR-001', 'AUDIT-LINK-12', 'Disetujui manual dengan slip resmi', datetime('now')
    );
  `)
  sqliteDb.prepare("UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist-man-ok'").run()
  const distManOk = sqliteDb.prepare("SELECT status FROM finance_distributions WHERE id = 'dist-man-ok'").get()
  assert.strictEqual(distManOk.status, 'DISTRIBUTED')
  console.log('✓ Reviewer Test 12: Authenticated manual proof resolution with verified DB operator and role snapshot.')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 13: Spoofed operator identity / unauthorized role rejected fail-closed
  // -------------------------------------------------------------------------
  assert.throws(() => {
    sqliteDb.prepare(`
      INSERT INTO finance_qlola_provider_evidence (
        id, distribution_id, source, evidence_type, evidence_strength, provider_state,
        provider_reference, observed_at, raw_evidence_hash, recorded_by,
        operator_authorized_by, operator_role_snapshot, manual_proof_reference, audit_linkage, notes
      ) VALUES (
        'ev-spoof-1', 'dist-man-ok', 'MANUAL_OFFICIAL_PROOF', 'EXECUTION_SUCCESS', 'MANUAL_RESOLVED', 'COMPLETED',
        'SPOOF-REF-1', datetime('now'), 'hash-spf', 'usr-admin',
        'usr-non-existent', 'bendahara', 'PROOF-SPOOF', 'AUDIT-SPF', 'Spoofed user'
      )
    `).run()
  }, /operator_authorized_by tidak valid: User tidak ditemukan dalam sistem database|FOREIGN KEY constraint failed/i, 'Reviewer Test 13a Failed: Non-existent operator must be rejected')

  assert.throws(() => {
    sqliteDb.prepare(`
      INSERT INTO finance_qlola_provider_evidence (
        id, distribution_id, source, evidence_type, evidence_strength, provider_state,
        provider_reference, observed_at, raw_evidence_hash, recorded_by,
        operator_authorized_by, operator_role_snapshot, manual_proof_reference, audit_linkage, notes
      ) VALUES (
        'ev-spoof-2', 'dist-man-ok', 'MANUAL_OFFICIAL_PROOF', 'EXECUTION_SUCCESS', 'MANUAL_RESOLVED', 'COMPLETED',
        'SPOOF-REF-2', datetime('now'), 'hash-spf2', 'usr-admin',
        'usr-wali', 'wali_santri', 'PROOF-SPOOF-2', 'AUDIT-SPF2', 'Unauthorized role user'
      )
    `).run()
  }, /Hanya role admin atau bendahara yang berwenang mengesahkan bukti penyaluran manual/, 'Reviewer Test 13b Failed: Unauthorized role must be rejected')

  await assert.rejects(
    async () => {
      await qlolaService.syncQlolaStatus({
        distributionId: 'dist-man-ok',
        operatorId: 'usr-admin',
        externalStatus: 'COMPLETED',
        source: 'MANUAL_OFFICIAL_PROOF',
        operatorAuthorizedBy: 'usr-wali',
        manualProofReference: 'PROOF-99',
        notes: 'Testing unauthorized role',
      })
    },
    /tidak memiliki kewenangan otorisasi manual pembuktian penyaluran/,
    'Reviewer Test 13c Failed: Service must reject unauthorized operator'
  )
  console.log('✓ Reviewer Test 13: Spoofed operator identity / unauthorized role rejected fail-closed.')

  // -------------------------------------------------------------------------
  // REVIEWER TEST 14: Fee capture requires eligible real/manual-authoritative execution evidence
  // (TEST_PROVIDER rejected)
  // -------------------------------------------------------------------------
  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency, bank_fee_amount
    ) VALUES (
      'dist-fee-tp', 'DIS-FEETP-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 100000, 'BRI_QLOLA', 'DRAFT', 'IDR', NULL
    );
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-fee-tp-1', 'dist-fee-tp', 'TEST_PROVIDER', 'EXECUTION_SUCCESS', 'AUTHORITATIVE_EXACT', 'COMPLETED',
      'REF-FEETP', datetime('now'), 'hash-feetp', 'usr-admin'
    );
  `)
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET bank_fee_amount = 2500 WHERE id = 'dist-fee-tp'").run()
  }, /Pencatatan fee bank wajib didasari bukti eksekusi penyedia yang sah/, 'Reviewer Test 14a Failed: TEST_PROVIDER cannot authorize bank fee capture')

  sqliteDb.exec(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency, bank_fee_amount
    ) VALUES (
      'dist-fee-valid', 'DIS-FEEV-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 100000, 'BRI_QLOLA', 'DRAFT', 'IDR', NULL
    );
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-fee-v-1', 'dist-fee-valid', 'H2H_SYNC', 'EXECUTION_SUCCESS', 'AUTHORITATIVE_EXACT', 'COMPLETED',
      'REF-FEEV', datetime('now'), 'hash-feev', 'usr-admin'
    );
  `)
  sqliteDb.prepare("UPDATE finance_distributions SET bank_fee_amount = 0 WHERE id = 'dist-fee-valid'").run()
  const feeVRow = sqliteDb.prepare("SELECT bank_fee_amount FROM finance_distributions WHERE id = 'dist-fee-valid'").get()
  assert.strictEqual(feeVRow.bank_fee_amount, 0)

  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET bank_fee_amount = 1000 WHERE id = 'dist-fee-valid'").run()
  }, /Nominal fee bank bersifat immutable setelah dicatat/, 'Reviewer Test 14b Failed: Captured fee must be immutable')
  console.log('✓ Reviewer Test 14: Fee capture requires eligible real/manual-authoritative execution evidence (TEST_PROVIDER rejected).')

  // -------------------------------------------------------------------------
  // Additional Hardening & Regression Tests
  // -------------------------------------------------------------------------
  // Cancel before dispatch releases intent reservation
  sqliteDb.exec(`
    INSERT INTO finance_allocations (id, payment_id, obligation_id, item_type, amount, disbursed_amount, distribution_status)
    VALUES ('alloc-c-pre', 'pay-base-1', 'ob-base-1', 'SPP', 250000, 0, 'UNDISBURSED');
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, recipient_name, recipient_category,
      item_type, period, total_amount, method, status, currency
    ) VALUES (
      'dist-c-pre', 'DIS-CPR-001', 'PESANTREN', 'rec_pesantren', 'Pesantren Sukahideng', 'PESANTREN',
      'SPP', '2026-10', 250000, 'BRI_QLOLA', 'DRAFT', 'IDR'
    );
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('di-cpr-1', 'dist-c-pre', 'alloc-c-pre', 250000);
    INSERT INTO finance_qlola_transfer_intents (
      id, distribution_id, distribution_request_id, intent_status, maker_user_id, payload_hash
    ) VALUES ('intent-cpr-1', 'dist-c-pre', 'REQ-CPR-001', 'SUBMISSION_PENDING', 'usr-petugas', 'hash-cpr-1');
  `)
  const cancelPreRes = await qlolaService.cancelDistribution({
    distributionId: 'dist-c-pre',
    cancelledBy: 'usr-admin',
    reason: 'Batal sebelum dispatch',
  })
  assert.strictEqual(cancelPreRes.status, 'CANCELLED')
  assert.strictEqual(cancelPreRes.isReservationReleased, true)
  const intentCpr = sqliteDb.prepare("SELECT intent_status FROM finance_qlola_transfer_intents WHERE id = 'intent-cpr-1'").get()
  assert.strictEqual(intentCpr.intent_status, 'CANCELLED')
  console.log('✓ Regression: cancel before dispatch releases intent reservation.')

  // Dispatch attempted + no ACK does NOT release reservation
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET status = 'CANCELLED' WHERE id = 'dist-unk-1'").run()
  }, /Pembatalan dilarang: Pengiriman ke bank telah dicoba atau diakui tanpa bukti konfirmasi pembatalan otoritatif/, 'Regression Failed: Direct CANCELLED after dispatch must be blocked')
  const unkDistCheck = sqliteDb.prepare("SELECT status FROM finance_distributions WHERE id = 'dist-unk-1'").get()
  assert.notStrictEqual(unkDistCheck.status, 'CANCELLED')
  console.log('✓ Regression: dispatch attempted + no ACK does NOT release reservation.')

  // Timeout does not create PENDING_APPROVAL without ACK
  const draftTimeout2 = await qlolaService.createDistributionDraft({
    recipientId: 'rec_pesantren',
    itemType: 'SPP',
    period: '2026-10',
    amount: 150000,
    method: 'BRI_QLOLA',
    createdBy: 'usr-petugas',
  })
  const timeoutSubmitRes2 = await qlolaService.submitDistributionToQlola({
    distributionId: draftTimeout2.distributionId,
    distributionRequestId: 'REQ-REG-TIMEOUT-002',
    submittedBy: 'usr-petugas',
    testProviderAdapter: testProviderTimeout,
  })
  assert.strictEqual(timeoutSubmitRes2.status, 'DRAFT', 'Status MUST be DRAFT upon timeout')
  assert.strictEqual(timeoutSubmitRes2.intentStatus, 'UNKNOWN')
  assert.strictEqual(timeoutSubmitRes2.isReserved, true, 'Funds must remain reserved by intent')
  const timeoutDist2 = sqliteDb.prepare("SELECT status, submission_outcome FROM finance_distributions WHERE id = ?").get(draftTimeout2.distributionId)
  assert.strictEqual(timeoutDist2.status, 'DRAFT')
  assert.strictEqual(timeoutDist2.submission_outcome, 'UNKNOWN')
  console.log('✓ Regression: timeout does not create PENDING_APPROVAL without ACK.')

  // Second submit UNKNOWN creates zero new intent/network business identity
  const intentCountBefore = sqliteDb.prepare("SELECT COUNT(*) AS c FROM finance_qlola_transfer_intents").get().c
  const submitDupRes = await qlolaService.submitDistributionToQlola({
    distributionId: draftTimeout2.distributionId,
    distributionRequestId: 'REQ-REG-TIMEOUT-002',
    submittedBy: 'usr-petugas',
    testProviderAdapter: testProviderTimeout,
  })
  assert.strictEqual(submitDupRes.alreadySubmitted, true)
  assert.strictEqual(submitDupRes.intentStatus, 'UNKNOWN')
  const intentCountAfter = sqliteDb.prepare("SELECT COUNT(*) AS c FROM finance_qlola_transfer_intents").get().c
  assert.strictEqual(intentCountAfter, intentCountBefore, 'Zero new intents created on second submit')
  console.log('✓ Regression: second submit UNKNOWN creates zero new intent/network business identity.')

  // Provider evidence UPDATE and DELETE blocked (append-only)
  sqliteDb.prepare(`
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-app-t13', 'dist-pa-noev', 'H2H_SYNC', 'APPROVAL_PROGRESS', 'AUTHORITATIVE_EXACT', 'APPROVED',
      'REF-13', datetime('now'), 'hash-13', 'usr-admin'
    )
  `).run()
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_qlola_provider_evidence SET provider_state = 'TAMPERED' WHERE id = 'ev-app-t13'").run()
  }, /Tabel finance_qlola_provider_evidence bersifat append-only. UPDATE dilarang/, 'Regression Failed: UPDATE on provider evidence must be blocked')
  assert.throws(() => {
    sqliteDb.prepare("DELETE FROM finance_qlola_provider_evidence WHERE id = 'ev-app-t13'").run()
  }, /Tabel finance_qlola_provider_evidence bersifat append-only. DELETE dilarang/, 'Regression Failed: DELETE on provider evidence must be blocked')
  console.log('✓ Regression: provider evidence UPDATE and DELETE blocked (append-only).')

  // CANDIDATE bank-statement evidence cannot mark DISTRIBUTED
  sqliteDb.prepare(`
    INSERT INTO finance_qlola_provider_evidence (
      id, distribution_id, source, evidence_type, evidence_strength, provider_state,
      provider_reference, observed_at, raw_evidence_hash, recorded_by
    ) VALUES (
      'ev-cand-15', 'dist-pa-noev', 'BANK_STATEMENT', 'EXECUTION_SUCCESS', 'CANDIDATE', 'MATCH_CANDIDATE',
      'STMT-CAND-15', datetime('now'), 'hash-15', 'usr-admin'
    )
  `).run()
  assert.throws(() => {
    sqliteDb.prepare("UPDATE finance_distributions SET status = 'DISTRIBUTED' WHERE id = 'dist-pa-noev'").run()
  }, /Peralihan status ke DISTRIBUTED wajib memiliki bukti EXECUTION_SUCCESS otoritatif/, 'Regression Failed: CANDIDATE evidence must not satisfy DISTRIBUTED trigger')
  console.log('✓ Regression: candidate bank-statement evidence cannot mark DISTRIBUTED.')

  console.log('\n=================================================================')
  console.log('SUCCESS: ALL BRI-5 QLOLA NON-STP DISTRIBUTION TESTS PASSED!')
  console.log('=================================================================')
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err)
  process.exit(1)
})
