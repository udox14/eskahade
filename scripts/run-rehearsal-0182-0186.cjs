/**
 * scripts/run-rehearsal-0182-0186.cjs
 *
 * Runs sequential migration rehearsal of 0182 -> 0183 -> 0184 -> 0185 -> 0186
 * against eskahade-prod-rehearsal-db (isolated production clone).
 * 
 * INVARIANTS:
 * - Target ONLY: eskahade-prod-rehearsal-db (ID: 3de081e2-0225-42e5-993d-151652884335)
 * - Production eskahade-db (ID: a2010f08-f314-46af-88fd-dbb9b4ef1bb1) is NEVER touched.
 */

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const assert = require('assert')

const REHEARSAL_DB = 'eskahade-prod-rehearsal-db'
const REHEARSAL_DB_ID = '3de081e2-0225-42e5-993d-151652884335'

const PROD_DB = 'eskahade-db'
const PROD_DB_ID = 'a2010f08-f314-46af-88fd-dbb9b4ef1bb1'

const DEMO_DB = 'eskahade-demo-db'

assert.notEqual(REHEARSAL_DB, PROD_DB, 'REHEARSAL TARGET CANNOT BE PROD')
assert.notEqual(REHEARSAL_DB_ID, PROD_DB_ID, 'REHEARSAL TARGET ID CANNOT BE PROD ID')

function q(db, sql) {
  const cleanSql = sql.replace(/\s+/g, ' ').trim()
  const stdout = execFileSync(
    'node',
    ['./node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', db, '--remote', `--command=${cleanSql}`],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
  )
  const s = stdout.indexOf('[')
  const e = stdout.lastIndexOf(']')
  return JSON.parse(stdout.substring(s, e + 1))[0]?.results || []
}

function runFile(db, filePath) {
  assert.equal(db, REHEARSAL_DB, 'FILES CAN ONLY BE RUN ON REHEARSAL DB!')
  const t0 = Date.now()
  const stdout = execFileSync(
    'node',
    ['./node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', db, '--remote', `--file=${filePath}`],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
  )
  const durationMs = Date.now() - t0
  return { durationMs, stdout }
}

async function main() {
  console.log('======================================================================')
  console.log('MIGRATION REHEARSAL ON PRODUCTION CLONE')
  console.log(`Database Target: ${REHEARSAL_DB} (${REHEARSAL_DB_ID})`)
  console.log('======================================================================\n')

  // Pre-rehearsal baseline
  console.log('--- PRE-REHEARSAL BASELINE ---')
  const prePayments = q(REHEARSAL_DB, 'SELECT COUNT(*) as c, SUM(gross_amount) as gross, SUM(net_amount) as net FROM finance_payments;')[0]
  const preAllocations = q(REHEARSAL_DB, 'SELECT COUNT(*) as c, SUM(amount) as s, SUM(disbursed_amount) as d FROM finance_allocations;')[0]
  const preObligations = q(REHEARSAL_DB, 'SELECT COUNT(*) as c, SUM(amount_expected) as s, SUM(amount_paid) as p FROM finance_obligations;')[0]
  const preOrders = q(REHEARSAL_DB, 'SELECT COUNT(*) as c FROM finance_payment_orders;')[0]?.c ?? 0
  const preOrderItems = q(REHEARSAL_DB, 'SELECT COUNT(*) as c FROM finance_order_items;')[0]?.c ?? 0
  const preSantri = q(REHEARSAL_DB, 'SELECT COUNT(*) as c FROM santri;')[0]?.c ?? 0
  const preUsers = q(REHEARSAL_DB, 'SELECT COUNT(*) as c FROM users;')[0]?.c ?? 0

  console.log(`Santri: ${preSantri}`)
  console.log(`Users: ${preUsers}`)
  console.log(`Payments: ${prePayments.c} rows, Gross: Rp${prePayments.gross?.toLocaleString()}, Net: Rp${prePayments.net?.toLocaleString()}`)
  console.log(`Allocations: ${preAllocations.c} rows, Sum: Rp${preAllocations.s?.toLocaleString()}, Disbursed: Rp${preAllocations.d?.toLocaleString()}`)
  console.log(`Obligations: ${preObligations.c} rows, Expected: Rp${preObligations.s?.toLocaleString()}, Paid: Rp${preObligations.p?.toLocaleString()}`)
  console.log(`Orders: ${preOrders}, Order Items: ${preOrderItems}`)

  const MIGRATIONS = [
    { num: '0182', file: 'migrations/0182_bri_foundation.sql' },
    { num: '0183', file: 'migrations/0183_briva_collection_metadata.sql' },
    { num: '0184', file: 'migrations/0184_bri_settlement_and_recovery.sql' },
    { num: '0185', file: 'migrations/0185_bri_qlola_distribution.sql' },
    { num: '0186', file: 'migrations/0186_cash_manual_distribution_hardening.sql' }
  ]

  const timings = {}

  console.log('\n--- EXECUTING MIGRATIONS SEQUENTIALLY ---')
  for (const m of MIGRATIONS) {
    const fullPath = path.resolve(__dirname, '..', m.file)
    console.log(`\nExecuting ${m.num} (${m.file})...`)
    const res = runFile(REHEARSAL_DB, fullPath)
    timings[m.num] = res.durationMs
    console.log(`-> SUCCESS: ${m.num} completed in ${(res.durationMs / 1000).toFixed(2)}s`)
  }

  console.log('\n======================================================================')
  console.log('POST-REHEARSAL INTEGRITY & CONSERVATION CHECKS')
  console.log('======================================================================\n')

  const postPayments = q(REHEARSAL_DB, 'SELECT COUNT(*) as c, SUM(gross_amount) as gross, SUM(net_amount) as net FROM finance_payments;')[0]
  const postAllocations = q(REHEARSAL_DB, 'SELECT COUNT(*) as c, SUM(amount) as s, SUM(disbursed_amount) as d FROM finance_allocations;')[0]
  const postObligations = q(REHEARSAL_DB, 'SELECT COUNT(*) as c, SUM(amount_expected) as s, SUM(amount_paid) as p FROM finance_obligations;')[0]
  const postOrders = q(REHEARSAL_DB, 'SELECT COUNT(*) as c FROM finance_payment_orders;')[0]?.c ?? 0
  const postOrderItems = q(REHEARSAL_DB, 'SELECT COUNT(*) as c FROM finance_order_items;')[0]?.c ?? 0
  const postSantri = q(REHEARSAL_DB, 'SELECT COUNT(*) as c FROM santri;')[0]?.c ?? 0
  const postUsers = q(REHEARSAL_DB, 'SELECT COUNT(*) as c FROM users;')[0]?.c ?? 0

  console.log('Data Preservation Verification:')
  console.log(`- Santri: Pre=${preSantri}, Post=${postSantri} -> ${preSantri === postSantri ? 'PASS' : 'FAIL'}`)
  console.log(`- Users: Pre=${preUsers}, Post=${postUsers} -> ${preUsers === postUsers ? 'PASS' : 'FAIL'}`)
  console.log(`- Payments Count: Pre=${prePayments.c}, Post=${postPayments.c} -> ${prePayments.c === postPayments.c ? 'PASS' : 'FAIL'}`)
  console.log(`- Payments Gross Sum: Pre=${prePayments.gross}, Post=${postPayments.gross} -> ${prePayments.gross === postPayments.gross ? 'PASS' : 'FAIL'}`)
  console.log(`- Allocations Count: Pre=${preAllocations.c}, Post=${postAllocations.c} -> ${preAllocations.c === postAllocations.c ? 'PASS' : 'FAIL'}`)
  console.log(`- Allocations Sum: Pre=${preAllocations.s}, Post=${postAllocations.s} -> ${preAllocations.s === postAllocations.s ? 'PASS' : 'FAIL'}`)
  console.log(`- Obligations Count: Pre=${preObligations.c}, Post=${postObligations.c} -> ${preObligations.c === postObligations.c ? 'PASS' : 'FAIL'}`)
  console.log(`- Obligations Paid Sum: Pre=${preObligations.p}, Post=${postObligations.p} -> ${preObligations.p === postObligations.p ? 'PASS' : 'FAIL'}`)
  console.log(`- Orders Cleanup: Pre=${preOrders}, Post=${postOrders} (expected 0) -> ${postOrders === 0 ? 'PASS' : 'FAIL'}`)
  console.log(`- Order Items Cleanup: Pre=${preOrderItems}, Post=${postOrderItems} (expected 0) -> ${postOrderItems === 0 ? 'PASS' : 'FAIL'}`)

  assert.equal(postPayments.c, prePayments.c, 'Payments row count must match!')
  assert.equal(postPayments.gross, prePayments.gross, 'Payments gross amount must match!')
  assert.equal(postAllocations.c, preAllocations.c, 'Allocations row count must match!')
  assert.equal(postAllocations.s, preAllocations.s, 'Allocations amount must match!')
  assert.equal(postObligations.c, preObligations.c, 'Obligations row count must match!')
  assert.equal(postObligations.p, preObligations.p, 'Obligations paid amount must match!')
  assert.equal(postOrders, 0, 'Expired test orders must be cleaned up!')
  assert.equal(postOrderItems, 0, 'Expired test order items must be cleaned up!')

  // Check the target obligation of the deleted orders
  const targetObligation = q(REHEARSAL_DB, "SELECT * FROM finance_obligations WHERE id = '67212d1d-9774-4e51-9e27-fbd34d3e2a55';")[0]
  console.log('\nTarget Obligation Verification (67212d1d-9774-4e51-9e27-fbd34d3e2a55):')
  console.log(`- Exists: ${Boolean(targetObligation)}`)
  console.log(`- Status: ${targetObligation?.status} (expected UNPAID)`)
  console.log(`- Amount Paid: ${targetObligation?.amount_paid} (expected 0)`)
  assert.ok(targetObligation, 'Obligation must exist')
  assert.equal(targetObligation.status, 'UNPAID')
  assert.equal(targetObligation.amount_paid, 0)

  // PRAGMA foreign_key_check
  console.log('\n--- FOREIGN KEY INTEGRITY CHECK ---')
  const fkChecks = q(REHEARSAL_DB, 'PRAGMA foreign_key_check;')
  console.log(`PRAGMA foreign_key_check violations: ${fkChecks.length}`)
  if (fkChecks.length > 0) {
    console.error('Violations found:', JSON.stringify(fkChecks, null, 2))
  }
  assert.equal(fkChecks.length, 0, 'Foreign key check must return 0 violations!')

  // Schema Parity vs Demo
  console.log('\n--- SCHEMA PARITY CHECK VS DEMO DB ---')
  const rehMaster = q(REHEARSAL_DB, "SELECT name, type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type, name;")
  const demoMaster = q(DEMO_DB, "SELECT name, type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type, name;")

  const rehSet = new Set(rehMaster.map(o => `${o.type}:${o.name}`))
  const demoSet = new Set(demoMaster.map(o => `${o.type}:${o.name}`))

  const missingInRehearsal = [...demoSet].filter(x => !rehSet.has(x))
  const extraInRehearsal = [...rehSet].filter(x => !demoSet.has(x))

  console.log(`Objects in Demo: ${demoSet.size}`)
  console.log(`Objects in Rehearsal: ${rehSet.size}`)
  console.log(`Missing in Rehearsal: ${missingInRehearsal.length}`)
  if (missingInRehearsal.length > 0) console.log('  ->', missingInRehearsal)
  console.log(`Extra in Rehearsal (e.g. core prod tables like poskestren if any): ${extraInRehearsal.length}`)

  // Specific check for all 0182-0186 objects in rehearsal
  const auditResult = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'production_schema_audit_result.json'), 'utf8'))
  let allExpectedPresent = true
  for (const mKey of ['0182', '0183', '0184', '0185', '0186']) {
    const expected = auditResult.migrations[mKey].expected
    for (const tbl of expected.tables) {
      if (!rehSet.has(`table:${tbl}`)) {
        console.error(`Rehearsal missing table ${tbl} from ${mKey}`)
        allExpectedPresent = false
      }
    }
    for (const idx of expected.indexes) {
      if (!rehSet.has(`index:${idx}`)) {
        console.error(`Rehearsal missing index ${idx} from ${mKey}`)
        allExpectedPresent = false
      }
    }
    for (const trg of expected.triggers) {
      if (!rehSet.has(`trigger:${trg}`)) {
        console.error(`Rehearsal missing trigger ${trg} from ${mKey}`)
        allExpectedPresent = false
      }
    }
  }
  console.log(`All 0182-0186 Schema Objects in Rehearsal: ${allExpectedPresent ? '100% PRESENT (PASS)' : 'FAIL'}`)
  assert.ok(allExpectedPresent, 'All 0182-0186 objects must be present in rehearsal!')

  const summary = {
    target: { name: REHEARSAL_DB, id: REHEARSAL_DB_ID },
    timings,
    preBaseline: {
      santri: preSantri,
      users: preUsers,
      payments: { count: prePayments.c, gross: prePayments.gross, net: prePayments.net },
      allocations: { count: preAllocations.c, sum: preAllocations.s },
      obligations: { count: preObligations.c, expected: preObligations.s, paid: preObligations.p },
      orders: preOrders,
      orderItems: preOrderItems
    },
    postBaseline: {
      santri: postSantri,
      users: postUsers,
      payments: { count: postPayments.c, gross: postPayments.gross, net: postPayments.net },
      allocations: { count: postAllocations.c, sum: postAllocations.s },
      obligations: { count: postObligations.c, expected: postObligations.s, paid: postObligations.p },
      orders: postOrders,
      orderItems: postOrderItems
    },
    fkViolations: fkChecks.length,
    parity: {
      demoObjectCount: demoSet.size,
      rehearsalObjectCount: rehSet.size,
      all0182_0186Present: allExpectedPresent
    }
  }

  fs.writeFileSync(path.resolve(__dirname, '..', 'rehearsal_result_summary.json'), JSON.stringify(summary, null, 2), 'utf8')
  console.log('\nREHEARSAL SUMMARY SAVED TO rehearsal_result_summary.json')
  console.log('REHEARSAL EXECUTION: 100% SUCCESS')
}

main().catch(err => {
  console.error('\nREHEARSAL FAILED:', err)
  process.exit(1)
})
