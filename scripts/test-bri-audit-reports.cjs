// Finance schema is reconstructed from the actual applied migrations, plus local remediation migrations.
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
let sqliteDb = new DatabaseSync(':memory:')
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

function initFullSchema(){sqliteDb.close();sqliteDb=require('./finance-remediation-fixture.cjs').createDatabase(189,false)}


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
  seedUatFixtures(sqliteDb,'local-uat')
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

  // Tests 9-14: guards remain enabled. Inject corrupt read results to exercise the
  // monitor against pre-existing damaged data; do not disable constraints to create it.
  assert.throws(()=>sqliteDb.exec(`INSERT INTO finance_distributions(id,distribution_number,recipient_type,recipient_id,item_type,period,method,total_amount,status) VALUES('unsafe','UNSAFE','PESANTREN','rec_pesantren','SPP','2026-10','CASH',9999999,'PROCESSING')`),/DISTRIBUTION_MUST_START_DRAFT/)
  const readCases=[
   ['OVER_DISTRIBUTION_DETECTED','HAVING total_distributed_or_reserved',[{allocation_id:'damaged',allocation_amount:1,total_distributed_or_reserved:2}]],
   ['OVER_ALLOCATION_DETECTED','HAVING total_allocated',[{payment_id:'damaged',payment_amount:1,total_allocated:2}]],
   ['UNLINKED_SETTLED_PAYMENT',"WHERE p.status = 'SETTLED'",[{id:'damaged',payment_number:'DAMAGED',amount:10000}]],
   ['UANG_JAJAN_DISTRIBUTION_LEAK',"WHERE a.target_type = 'UANG_JAJAN'",[{id:'damaged',distribution_id:'damaged-dist',amount:10000}]],
   ['CASH_SESSION_OVER_RESERVED',"cs.expected_closing_balance",[{id:'damaged',session_code:'DAMAGED',expected_closing_balance:1,live_prepared_amount:2}]],
   ['ACTIVE_DUITKU_PAYMENT_FOUND',"WHERE method LIKE '%DUITKU%'",[{id:'damaged',payment_number:'DAMAGED',method:'DUITKU_VA'}]]
  ]
  for(const [code,predicate,rows] of readCases){
    const originalQuery=mockDb.query
    try {mockDb.query=async(sql,params)=>sql.includes(predicate)?rows:originalQuery(sql,params)
      const result=await auditReportService.verifyFinancialReportInvariants()
      assert.equal(result.isConsistent,false)
      assert.ok(result.violations.some(v=>v.code===code),code+' must be detected')
    } finally {mockDb.query=originalQuery}
    console.log('PASS Corrupt read fixture detected: '+code)
  }

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

  sqliteDb.exec("INSERT INTO users(id,full_name,role) VALUES('usr-pimpinan-1','Pimpinan','pimpinan')")
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
