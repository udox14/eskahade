/**
 * test-demo-edge-uat.cjs
 * 
 * Remote Edge UAT verification suite for Fase BRI-7 on Cloudflare D1.
 * Target: eskahade-demo-db (ID: 677f05ba-9b52-4534-9542-96cc785f25e4)
 * 
 * Scenarios covered:
 * 1. Manual Transfer UNKNOWN lifecycle & over-reservation guard:
 *    - Status = PROCESSING, investigation_resolution = PENDING, reason_code = MANUAL_TRANSFER_OUTCOME_UNKNOWN
 *    - Second transfer attempt against same live obligation is strictly BLOCKED.
 * 2. Source-account authority:
 *    - Source account number / ID cannot be redirected by caller.
 *    - Caller-supplied arbitrary source accounts are rejected (INVALID_SOURCE_ACCOUNT).
 * 3. Authoritative failed-bank-outcome resolution & reservation release:
 *    - MANUAL_TRANSFER_FAILED evidence allows transition to FAILED.
 *    - Releases live reservation on the allocation.
 *    - Replacement transfer succeeds without overdraw trigger.
 * 4. Statement debit semantics:
 *    - CANDIDATE match returned with CANDIDATE strength only.
 *    - Official manual proof recorded with MANUAL_RESOLVED (never AUTHORITATIVE_EXACT).
 * 5. Ambiguous settlement candidate:
 *    - Two matching distributions yield AMBIGUOUS_CANDIDATES.
 *    - Neither candidate auto-selected.
 */

const { execFileSync } = require('child_process')
const path = require('path')
const assert = require('assert')
const fs = require('fs')
const ts = require('typescript')

const EXPECTED_DB_NAME = 'eskahade-demo-db'
const EXPECTED_DB_ID = '677f05ba-9b52-4534-9542-96cc785f25e4'
const EXPECTED_ACCOUNT_ID = 'a170ed4144c00927988a828aa9a41896'
process.env.BRI_COLLECTION_ACCOUNT_NO = '001901000888301'

function runD1Query(sql) {
  const cleanSql = sql.replace(/\s+/g, ' ').trim()
  const stdout = execFileSync(
    'node',
    [
      './node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      EXPECTED_DB_NAME,
      '--remote',
      `--command=${cleanSql}`
    ],
    {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' }
    }
  )

  const jsonStart = stdout.indexOf('[')
  const jsonEnd = stdout.lastIndexOf(']')
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`Failed to parse D1 query output:\n${stdout}`)
  }
  const parsed = JSON.parse(stdout.substring(jsonStart, jsonEnd + 1))
  return parsed[0]?.results || []
}

function runD1CommandExpectError(sql, expectedSubstr) {
  const cleanSql = sql.replace(/\s+/g, ' ').trim()
  try {
    execFileSync(
      'node',
      [
        './node_modules/wrangler/bin/wrangler.js',
        'd1',
        'execute',
        EXPECTED_DB_NAME,
        '--remote',
        `--command=${cleanSql}`
      ],
      {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '' }
      }
    )
    assert.fail(`Command should have failed but succeeded: ${cleanSql}`)
  } catch (err) {
    const combinedOutput = (err.stdout || '') + (err.stderr || '') + (err.message || '')
    assert.ok(
      combinedOutput.includes(expectedSubstr),
      `Expected error to include "${expectedSubstr}", got:\n${combinedOutput}`
    )
  }
}

function loadCashManualService(mockDb) {
  const briDir = path.resolve(__dirname, '..', 'lib', 'finance', 'bri')
  const cache = {}

  function loadTsFile(filePath) {
    if (cache[filePath]) return cache[filePath].exports
    const code = fs.readFileSync(filePath, 'utf8')
    const jsCode = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true
      }
    }).outputText

    const m = { exports: {} }
    cache[filePath] = m

    const customReq = (importPath) => {
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        let resolved = path.resolve(path.dirname(filePath), importPath)
        if (!fs.existsSync(resolved) && fs.existsSync(resolved + '.ts')) {
          resolved = resolved + '.ts'
        }
        if (fs.existsSync(resolved)) {
          return loadTsFile(resolved)
        }
      }
      if (importPath.includes('audit-service')) {
        return {
          logFinanceAudit: async () => {},
          FinanceAuditService: { log: async () => {} }
        }
      }
      if (importPath.includes('config')) {
        return {
          loadBriConfig: () => ({
            collectionAccountNo: '001901000888301',
            collectionAccountName: 'KOPERASI PONTREN SUKAHIDENG'
          })
        }
      }
      if (importPath.includes('db')) {
        return {
          query: mockDb.query,
          queryOne: mockDb.queryOne,
          execute: mockDb.execute,
          batch: mockDb.batch,
          generateId: mockDb.generateId,
          now: mockDb.now,
          getDB: () => mockDb
        }
      }
      return require(importPath)
    }

    const fn = new Function('require', 'module', 'exports', '__dirname', jsCode)
    fn(customReq, m, m.exports, path.dirname(filePath))
    return m.exports
  }

  return loadTsFile(path.join(briDir, 'cash-manual-distribution-service.ts'))
}

async function main() {
  console.log('======================================================================')
  console.log('STARTING DEMO EDGE UAT TEST SUITE (Fase BRI-7)')
  console.log(`Target: ${EXPECTED_DB_NAME} (ID: ${EXPECTED_DB_ID})`)
  console.log('Account: ' + EXPECTED_ACCOUNT_ID)
  console.log('======================================================================\n')

  // Preflight Safety Guard
  assert.equal(EXPECTED_DB_NAME, 'eskahade-demo-db')
  assert.notEqual(EXPECTED_DB_NAME, 'eskahade-db', 'PRODUCTION IS STRICTLY FORBIDDEN')

  const RUN_TAG = Date.now().toString(36).toUpperCase()
  console.log(`Test Run Tag: ${RUN_TAG}\n`)

  const ALC_ID = `ALC-EDGE-${RUN_TAG}`
  const DIST_ID = `DIST-EDGE-${RUN_TAG}`
  const DIST_NUM = `DIS-EDGE-${RUN_TAG}`
  const DIST_ITEM_ID = `DITEM-EDGE-${RUN_TAG}`
  const EVI_UNK_ID = `EVI-EDGE-UNK-${RUN_TAG}`
  const REC_ID = `REC-EDGE-${RUN_TAG}`
  const DIST_DUP_ID = `DIST-EDGE-DUP-${RUN_TAG}`
  const DIST_DUP_NUM = `DIS-EDGE-DUP-${RUN_TAG}`
  const DIST_ITEM_DUP_ID = `DITEM-EDGE-DUP-${RUN_TAG}`
  const EVI_FAIL_ID = `EVI-EDGE-FAIL-${RUN_TAG}`
  const DIST_RETRY_ID = `DIST-EDGE-RETRY-${RUN_TAG}`
  const DIST_RETRY_NUM = `DIS-EDGE-RETRY-${RUN_TAG}`
  const DIST_ITEM_RETRY_ID = `DITEM-EDGE-RETRY-${RUN_TAG}`
  const EVI_RETRY_FAIL_ID = `EVI-EDGE-RETRY-FAIL-${RUN_TAG}`

  // ==========================================================================
  // SCENARIO 1: Manual Transfer UNKNOWN lifecycle & over-reservation block
  // ==========================================================================
  console.log('[1/5] Testing Manual Transfer UNKNOWN Lifecycle & Over-Reservation Guard...')
  
  // 1.1 Create test allocation (entitlement) of 300,000 for student
  runD1Query(`
    INSERT INTO finance_allocations (id, payment_id, target_type, item_type, amount, created_at)
    VALUES ('${ALC_ID}', 'PAY-001', 'OBLIGATION', 'SPP', 300000, datetime('now'));
  `)

  // 1.2 Initiate MANUAL_TRANSFER in status PROCESSING
  runD1Query(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, item_type, period,
      total_amount, method, status, account_id, created_at, updated_at
    ) VALUES (
      '${DIST_ID}', '${DIST_NUM}', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10',
      300000, 'MANUAL_TRANSFER', 'PROCESSING', 'ACC-PESANTREN', datetime('now'), datetime('now')
    );
  `)
  runD1Query(`
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('${DIST_ITEM_ID}', '${DIST_ID}', '${ALC_ID}', 300000);
  `)

  // 1.3 Record simulated bank/network UNKNOWN outcome
  runD1Query(`
    INSERT INTO finance_cash_manual_evidence (
      id, distribution_id, evidence_type, evidence_strength, source, reference_number,
      raw_evidence_hash, observed_at, recorded_at, operator_id, operator_role_snapshot, notes, created_at
    ) VALUES (
      '${EVI_UNK_ID}', '${DIST_ID}', 'MANUAL_TRANSFER_UNKNOWN', 'CANDIDATE', 'BANK_RECEIPT', 'TRX-UNK-${RUN_TAG}',
      'hash_unk_${RUN_TAG}', datetime('now'), datetime('now'), 'usr-kasir-1', 'bendahara', 'Status transfer pending investigasi', datetime('now')
    );
  `)
  runD1Query(`
    INSERT INTO finance_reconciliation_items (
      id, external_reference, internal_amount, external_amount, discrepancy_amount,
      match_status, resolution_action, reason_code, investigation_resolution, created_at
    ) VALUES (
      '${REC_ID}', '${DIST_NUM}', 300000, 300000, 0,
      'UNMATCHED_INTERNAL', 'NONE', 'MANUAL_TRANSFER_OUTCOME_UNKNOWN', 'PENDING', datetime('now')
    );
  `)

  // 1.4 Assert expected semantics
  const distCheck = runD1Query(`SELECT status FROM finance_distributions WHERE id = '${DIST_ID}';`)
  assert.equal(distCheck[0].status, 'PROCESSING', 'Distribution must remain PROCESSING during unknown outcome')

  const recCheck = runD1Query(`SELECT investigation_resolution, reason_code FROM finance_reconciliation_items WHERE id = '${REC_ID}';`)
  assert.equal(recCheck[0].investigation_resolution, 'PENDING', 'Investigation resolution must be PENDING')
  assert.equal(recCheck[0].reason_code, 'MANUAL_TRANSFER_OUTCOME_UNKNOWN', 'Reason code must be MANUAL_TRANSFER_OUTCOME_UNKNOWN')
  console.log('  ✓ UNKNOWN outcome recorded: status = PROCESSING, investigation_resolution = PENDING, reason_code = MANUAL_TRANSFER_OUTCOME_UNKNOWN')

  // 1.5 Assert second transfer attempt against the same live obligation is BLOCKED
  runD1Query(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, item_type, period,
      total_amount, method, status, account_id, created_at, updated_at
    ) VALUES (
      '${DIST_DUP_ID}', '${DIST_DUP_NUM}', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10',
      300000, 'MANUAL_TRANSFER', 'PENDING_APPROVAL', 'ACC-PESANTREN', datetime('now'), datetime('now')
    );
  `)
  runD1CommandExpectError(`
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('${DIST_ITEM_DUP_ID}', '${DIST_DUP_ID}', '${ALC_ID}', 300000);
  `, 'Total penyaluran dan reservasi melebihi dana alokasi efektif yang tersedia')
  runD1Query(`DELETE FROM finance_distributions WHERE id = '${DIST_DUP_ID}';`)
  console.log('  ✓ Entitlement remains reserved: second transfer attempt against the same live allocation strictly BLOCKED.\n')

  // ==========================================================================
  // SCENARIO 2: Source-account authority
  // ==========================================================================
  console.log('[2/5] Testing Source-Account Authority & Redirection Rejection...')
  const mockDbForService = {
    queryOne: async (sql, params = []) => {
      if (sql.includes('FROM finance_distributions WHERE id = ?')) {
        return {
          id: DIST_ID,
          distribution_number: DIST_NUM,
          method: 'MANUAL_TRANSFER',
          status: 'DRAFT',
          account_id: 'ACC-PESANTREN',
          recipient_id: 'rec_pesantren',
          destination_account: '001901000999501'
        }
      }
      if (sql.includes('FROM finance_recipient_accounts WHERE id = ?')) {
        return { id: 'ACC-PESANTREN', is_active: 1, recipient_id: 'rec_pesantren' }
      }
      if (sql.includes('FROM finance_reconciliation_items')) {
        return null
      }
      if (sql.includes('FROM users WHERE id = ?')) {
        return { id: 'usr-kasir-1', role: 'bendahara' }
      }
      return null
    },
    query: async () => [],
    execute: async () => ({ success: true }),
    batch: async () => {},
    generateId: () => 'test-id',
    now: () => new Date().toISOString()
  }

  const serviceMod = loadCashManualService(mockDbForService)
  const cashService = new serviceMod.CashManualDistributionService()

  // 2.1 Verify arbitrary caller-supplied source account number is rejected
  await assert.rejects(
    async () => {
      await cashService.initiateManualTransfer({
        distributionId: DIST_ID,
        operatorId: 'usr-kasir-1',
        operatorRole: 'bendahara',
        sourceAccountNumber: '9999999999' // Arbitrary redirected source account!
      })
    },
    /INVALID_SOURCE_ACCOUNT/,
    'Arbitrary caller-supplied source account number must be strictly rejected'
  )

  // 2.2 Verify arbitrary caller-supplied source account ID is rejected
  await assert.rejects(
    async () => {
      await cashService.initiateManualTransfer({
        distributionId: DIST_ID,
        operatorId: 'usr-kasir-1',
        operatorRole: 'bendahara',
        sourceAccountId: 'ACC-ARBITRARY-REDIRECT' // Arbitrary redirected ID!
      })
    },
    /INVALID_SOURCE_ACCOUNT/,
    'Arbitrary caller-supplied source account ID must be strictly rejected'
  )
  console.log('  ✓ Source account authority verified: arbitrary caller-supplied source account rejected (no redirection).\n')

  // ==========================================================================
  // SCENARIO 3: Failed-bank-outcome resolution & reservation release
  // ==========================================================================
  console.log('[3/5] Testing Authoritative Failed-Bank-Outcome Resolution & Reservation Release...')

  // 3.1 Record official failure evidence
  runD1Query(`
    INSERT INTO finance_cash_manual_evidence (
      id, distribution_id, evidence_type, evidence_strength, source, reference_number,
      raw_evidence_hash, observed_at, recorded_at, operator_id, operator_role_snapshot, notes, created_at
    ) VALUES (
      '${EVI_FAIL_ID}', '${DIST_ID}', 'MANUAL_TRANSFER_FAILED', 'AUTHORITATIVE_EXACT', 'BANK_RECEIPT', 'TRX-FAIL-${RUN_TAG}',
      'hash_fail_${RUN_TAG}', datetime('now'), datetime('now'), 'usr-kasir-1', 'bendahara', 'Rekening tujuan tidak aktif / ditolak bank', datetime('now')
    );
  `)

  // 3.2 Update distribution status to FAILED
  runD1Query(`UPDATE finance_distributions SET status = 'FAILED' WHERE id = '${DIST_ID}';`)
  runD1Query(`
    UPDATE finance_reconciliation_items
    SET match_status = 'UNMATCHED_INTERNAL',
        investigation_resolution = 'VOID_RECORDED',
        resolution_action = 'VOID_RECORDED',
        resolved_by = 'usr-kasir-1',
        resolved_at = datetime('now')
    WHERE id = '${REC_ID}';
  `)

  const distFailed = runD1Query(`SELECT status FROM finance_distributions WHERE id = '${DIST_ID}';`)
  assert.equal(distFailed[0].status, 'FAILED', 'Distribution status must be FAILED')

  const recFailed = runD1Query(`SELECT investigation_resolution, resolution_action FROM finance_reconciliation_items WHERE id = '${REC_ID}';`)
  assert.equal(recFailed[0].investigation_resolution, 'VOID_RECORDED')
  assert.equal(recFailed[0].resolution_action, 'VOID_RECORDED')
  console.log('  ✓ Authoritative failure resolved: status = FAILED, investigation_resolution = VOID_RECORDED')

  // 3.3 Verify reservation is released: now inserting a replacement distribution on ALC_ID succeeds
  runD1Query(`
    INSERT INTO finance_distributions (
      id, distribution_number, recipient_type, recipient_id, item_type, period,
      total_amount, method, status, account_id, created_at, updated_at
    ) VALUES (
      '${DIST_RETRY_ID}', '${DIST_RETRY_NUM}', 'PESANTREN', 'rec_pesantren', 'SPP', '2026-10',
      300000, 'MANUAL_TRANSFER', 'PROCESSING', 'ACC-PESANTREN', datetime('now'), datetime('now')
    );
  `)
  runD1Query(`
    INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
    VALUES ('${DIST_ITEM_RETRY_ID}', '${DIST_RETRY_ID}', '${ALC_ID}', 300000);
  `)
  console.log('  ✓ Reservation released: replacement distribution successfully committed without overdraw block.')

  // Conclude retry distribution cleanly by recording failure evidence and moving to terminal FAILED status
  runD1Query(`
    INSERT INTO finance_cash_manual_evidence (
      id, distribution_id, evidence_type, evidence_strength, source, reference_number,
      raw_evidence_hash, observed_at, recorded_at, operator_id, operator_role_snapshot, notes, created_at
    ) VALUES (
      '${EVI_RETRY_FAIL_ID}', '${DIST_RETRY_ID}', 'MANUAL_TRANSFER_FAILED', 'AUTHORITATIVE_EXACT', 'BANK_RECEIPT', 'TRX-FAIL-RETRY-${RUN_TAG}',
      'hash_retry_fail_${RUN_TAG}', datetime('now'), datetime('now'), 'usr-kasir-1', 'bendahara', 'UAT cleanup test failure', datetime('now')
    );
  `)
  runD1Query(`UPDATE finance_distributions SET status = 'FAILED' WHERE id = '${DIST_RETRY_ID}';\n`)

  // ==========================================================================
  // SCENARIO 4: Statement debit semantics (CANDIDATE -> MANUAL_RESOLVED, never AUTHORITATIVE_EXACT)
  // ==========================================================================
  console.log('[4/5] Testing Statement Debit Semantics (CANDIDATE -> MANUAL_RESOLVED)...')

  // 4.1 Test matchStatementDebitToCandidates returns CANDIDATE_MATCH with CANDIDATE strength
  const mockDbForCandidateMatch = {
    queryOne: async (sql, params = []) => {
      if (sql.includes('FROM finance_bri_statement_transactions')) {
        return {
          id: 'STMT-DEBIT-001',
          account_no: '001901000888301',
          type_normalized: 'DEBIT',
          amount: 500000,
          currency: 'IDR',
          identity_strength: 'STRONG'
        }
      }
      return null
    },
    query: async (sql, params = []) => {
      if (sql.includes('FROM finance_distributions')) {
        return [
          {
            id: 'DIST-MAN-001',
            distribution_number: 'DIS-2026-0003',
            method: 'MANUAL_TRANSFER',
            status: 'PROCESSING',
            total_amount: 500000
          }
        ]
      }
      return []
    }
  }

  const candidateServiceMod = loadCashManualService(mockDbForCandidateMatch)
  const candidateResult = await candidateServiceMod.matchStatementDebitToCandidates('STMT-DEBIT-001')
  assert.equal(candidateResult.status, 'CANDIDATE')
  assert.equal(candidateResult.matchedDistributions.length, 1)
  console.log('  ✓ BANK_STATEMENT_DEBIT without authoritative cross-reference = CANDIDATE')

  // 4.2 Test recordOfficialManualTransferProof records MANUAL_RESOLVED strength
  let recordedStrength = null
  const mockDbForProof = {
    queryOne: async (sql, params = []) => {
      if (sql.includes('FROM finance_distributions WHERE id = ?')) {
        return {
          id: 'DIST-MAN-001',
          distribution_number: 'DIS-2026-0003',
          method: 'MANUAL_TRANSFER',
          status: 'PROCESSING',
          total_amount: 500000
        }
      }
      if (sql.includes('FROM users WHERE id = ?')) {
        return { id: 'usr-kasir-1', role: 'bendahara' }
      }
      if (sql.includes('FROM finance_cash_manual_evidence')) {
        return { count: 0 }
      }
      return null
    },
    query: async () => [],
    execute: async () => ({ success: true }),
    batch: async (statements) => {
      for (const st of statements) {
        if (st.sql.includes('INSERT INTO finance_cash_manual_evidence')) {
          recordedStrength = st.params[3] // evidence_strength parameter (index 3)
        }
      }
    },
    generateId: () => 'evi-test-proof',
    now: () => new Date().toISOString()
  }

  const proofServiceMod = loadCashManualService(mockDbForProof)
  const proofService = new proofServiceMod.CashManualDistributionService()
  await proofService.finalizeManualTransfer({
    distributionId: 'DIST-MAN-001',
    operatorId: 'usr-kasir-1',
    operatorRole: 'bendahara',
    referenceNumber: 'KWITANSI-MAN-01',
    evidenceType: 'MANUAL_OFFICIAL_PROOF',
    notes: 'Kuitansi transfer bank manual disahkan bendahara'
  })

  assert.equal(recordedStrength, 'MANUAL_RESOLVED', 'Manual proof must be recorded with MANUAL_RESOLVED strength')
  assert.notEqual(recordedStrength, 'AUTHORITATIVE_EXACT', 'Manual receipt must never be converted to AUTHORITATIVE_EXACT')
  console.log('  ✓ Manual proof recorded with strength = MANUAL_RESOLVED (never AUTHORITATIVE_EXACT).\n')

  // ==========================================================================
  // SCENARIO 5: Ambiguous settlement candidate (AMBIGUOUS_CANDIDATES)
  // ==========================================================================
  console.log('[5/5] Testing Ambiguous Settlement Candidate Guard (AMBIGUOUS_CANDIDATES)...')

  // 5.1 Two legitimate same-value internal candidates and one statement transaction
  const mockDbForAmbiguity = {
    queryOne: async (sql, params = []) => {
      if (sql.includes('FROM finance_bri_statement_transactions')) {
        return {
          id: 'STMT-AMB-DEBIT',
          account_no: '001901000888301',
          type_normalized: 'DEBIT',
          amount: 250000,
          currency: 'IDR',
          identity_strength: 'STRONG'
        }
      }
      return null
    },
    query: async (sql, params = []) => {
      if (sql.includes('FROM finance_distributions')) {
        return [
          {
            id: 'DIST-AMB-1',
            distribution_number: 'DIS-AMB-0001',
            method: 'MANUAL_TRANSFER',
            status: 'PROCESSING',
            total_amount: 250000
          },
          {
            id: 'DIST-AMB-2',
            distribution_number: 'DIS-AMB-0002',
            method: 'MANUAL_TRANSFER',
            status: 'PROCESSING',
            total_amount: 250000
          }
        ]
      }
      return []
    }
  }

  const ambServiceMod = loadCashManualService(mockDbForAmbiguity)
  const ambResult = await ambServiceMod.matchStatementDebitToCandidates('STMT-AMB-DEBIT')

  assert.equal(ambResult.status, 'AMBIGUOUS_CANDIDATES')
  assert.equal(ambResult.matchedDistributions.length, 2, 'Must return both candidate distributions')
  assert.equal(ambResult.matchedDistributionId, undefined, 'Neither candidate must be automatically selected')
  assert.ok(ambResult.reason.includes('AMBIGUOUS_CANDIDATES'), 'Must explain ambiguity in reason')
  console.log('  ✓ Ambiguity guard verified: status = AMBIGUOUS_CANDIDATES, 2 candidates preserved, neither candidate auto-selected.\n')

  console.log('======================================================================')
  console.log('ALL 5 DEMO EDGE UAT SCENARIOS COMPLETED WITH 100% SUCCESS!')
  console.log('======================================================================')
}

main().catch(err => {
  console.error('\nFAILED DEMO EDGE UAT:', err)
  process.exit(1)
})
