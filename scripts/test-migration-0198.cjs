// Migration 0198 must rebuild finance tables with live child rows under the
// same conditions as D1: foreign keys enforced and one transaction per file.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createDatabase } = require('./finance-remediation-fixture.cjs')

const root = path.resolve(__dirname, '..')
const read = name => fs.readFileSync(path.join(root, 'migrations', name), 'utf8')

function seeded() {
  const db = createDatabase(189, true, false)
  db.exec(read('0196_finance_billing_issuance.sql'))
  db.exec(`
    INSERT INTO finance_cash_sessions(id,session_code,operator_id,opened_at,opening_balance,status)
      VALUES('ses','SES-1','cashier','2026-07-10T01:00:00Z',0,'OPEN');
    INSERT INTO finance_payment_orders(id,order_number,santri_id,payer_type,gross_amount,cooperative_admin_fee,fee_payer,total_charged,payment_method,status,expires_at,created_at,updated_at)
      VALUES('ord','ORD-1','student','LOKET',50000,0,'CUSTOMER',50000,'CASH','PENDING','2026-07-11T00:00:00Z','2026-07-10T01:00:00Z','2026-07-10T01:00:00Z');
    INSERT INTO finance_order_items(id,order_id,obligation_id,item_type,amount) VALUES('oi','ord',NULL,'UANG_JAJAN',50000);
    UPDATE finance_payment_orders SET status='PAID' WHERE id='ord';
    INSERT INTO finance_payments(id,payment_number,order_id,santri_id,channel,method,gross_amount,net_amount,paid_at,cash_session_id)
      VALUES('pay','PAY-1','ord','student','CASH','CASH',50000,50000,'2026-07-10T01:00:00Z','ses');
    INSERT INTO finance_allocations(id,payment_id,obligation_id,target_type,item_type,amount,disbursed_amount,distribution_status,created_at)
      VALUES('al','pay',NULL,'UANG_JAJAN','UANG_JAJAN',50000,0,'UNDISBURSED','2026-07-10T01:00:00Z');
    INSERT INTO finance_cooperative_income(id,income_number,entry_type,payment_id,order_id,amount,rule_id,created_at)
      VALUES('inc','INC-1','INCOME','pay','ord',1000,'rule_default_online_v1','2026-07-10T01:00:00Z');
    INSERT INTO finance_wallet_ledger(id,santri_id,direction,movement_type,amount,balance_before,balance_after,reference_id,cash_session_id,operator_id,created_at)
      VALUES('led1','student','IN','TOPUP_CASH',50000,0,50000,'pay','ses','cashier','2026-07-10T01:00:00Z'),
            ('led2','student','OUT','WITHDRAWAL_LOKET',20000,50000,30000,NULL,'ses','cashier','2026-07-10T02:00:00Z');
  `)
  return db
}

const counts = db => Object.fromEntries(['finance_payment_orders', 'finance_payments', 'finance_wallet_ledger',
  'finance_cooperative_admin_fee_rules', 'finance_allocations', 'finance_cooperative_income', 'finance_order_items']
  .map(t => [t, db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n]))

const triggerNames = db => db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all().map(r => r.name)

// 1. Applies in one transaction with enforced FKs and keeps every row.
{
  const db = seeded()
  const before = counts(db)
  const triggersBefore = triggerNames(db)
  db.exec('BEGIN')
  db.exec(read('0198_manual_transfer_and_collective_payout.sql'))
  db.exec('COMMIT')
  const after = counts(db)
  before.finance_cooperative_admin_fee_rules += 1 // seeded TRANSFER rule
  assert.deepEqual(after, before)
  assert.deepEqual(db.prepare('SELECT * FROM pragma_foreign_key_check').all(), [])
  for (const name of triggersBefore) assert.ok(triggerNames(db).includes(name), 'trigger recreated: ' + name)
  assert.equal(db.prepare("SELECT income_source FROM finance_cooperative_income WHERE id='inc'").get().income_source, 'ADMIN_FEE')
  assert.equal(db.prepare("SELECT unique_code FROM finance_payment_orders WHERE id='ord'").get().unique_code, 0)
  assert.equal(db.prepare("SELECT value FROM app_settings WHERE key='payment_channel_mode'").get().value, 'TRANSFER')
  assert.equal(db.prepare("SELECT is_active FROM fitur_akses WHERE href='/dashboard/keuangan/kredensial'").get()?.is_active ?? 0, 0)

  // Existing guards still fire after the rebuild.
  assert.throws(() => db.exec(`INSERT INTO finance_wallet_ledger(id,santri_id,direction,movement_type,amount,balance_before,balance_after,created_at)
    VALUES('bad','student','OUT','WITHDRAWAL_LOKET',1,0,0,'2026-07-10T03:00:00Z')`), /STALE_BALANCE_DETECTED/)
  assert.throws(() => db.exec(`INSERT INTO finance_payments(id,payment_number,order_id,santri_id,channel,method,gross_amount,net_amount,paid_at)
    VALUES('bri','PAY-B','ord','student','BRI','BRI_VA',50000,50000,'2026-07-10T01:00:00Z')`), /BRIVA_GUARD_ABORT/)
  assert.throws(() => db.exec(`UPDATE finance_payment_orders SET gross_amount=1 WHERE id='ord'`), /ORDER_SNAPSHOT_IMMUTABLE/)
  // Limit now nets loket + collective withdrawals (default global limit 100000).
  db.exec("INSERT OR REPLACE INTO app_settings(key,value) VALUES('uang_jajan_global_daily_limit','40000')")
  assert.throws(() => db.exec(`INSERT INTO finance_wallet_ledger(id,santri_id,direction,movement_type,amount,balance_before,balance_after,created_at)
    VALUES('big','student','OUT','WITHDRAWAL_LOKET',30000,30000,0,'2026-07-10T03:00:00Z')`), /DAILY_LIMIT_EXCEEDED/)
  // New CHECKs reject malformed manual transfer orders.
  assert.throws(() => db.exec(`INSERT INTO finance_payment_orders(id,order_number,santri_id,payer_type,gross_amount,total_charged,payment_method,expires_at)
    VALUES('mt','ORD-MT','student','PORTAL_ORTU',100,100,'MANUAL_TRANSFER','2026-07-11T00:00:00Z')`), /CHECK constraint failed/)
  db.close()
}

// 1b. Sandbox shape: sandbox-recovery/0194 triggers reference finance_payments/ledger.
{
  const db = seeded()
  const restore = read('../scripts/sandbox/0198_restore_recovery_triggers.sql').replace(/IF NOT EXISTS /g, '')
  db.exec(restore) // install the three sandbox-only triggers as they exist on eskahade-demo-db
  db.exec('BEGIN')
  db.exec(read('0198_manual_transfer_and_collective_payout.sql'))
  db.exec('COMMIT')
  db.exec(read('../scripts/sandbox/0198_restore_recovery_triggers.sql'))
  for (const name of ['trg_sandbox_recovery_wallet_arithmetic', 'trg_sandbox_recovery_quarantine_dist_insert', 'trg_sandbox_recovery_quarantine_dist_update']) {
    assert.ok(triggerNames(db).includes(name), 'sandbox trigger restored: ' + name)
  }
  assert.deepEqual(db.prepare('SELECT * FROM pragma_foreign_key_check').all(), [])
  db.close()
}

// 2. A failure inside the file rolls everything back (no half-migrated schema).
{
  const db = seeded()
  db.exec("CREATE TABLE finance_transfer_accounts(id TEXT)") // forces a conflict mid-file
  db.exec('BEGIN')
  assert.throws(() => db.exec(read('0198_manual_transfer_and_collective_payout.sql')))
  db.exec('ROLLBACK')
  assert.ok(db.prepare("SELECT sql FROM sqlite_master WHERE name='finance_payments'").get().sql.includes("IN ('BRI', 'CASH')"))
  assert.ok(triggerNames(db).includes('trg_finance_payments_briva_guard'))
  db.close()
}

console.log('migration 0198: ok')
