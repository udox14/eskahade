/* eslint-disable @typescript-eslint/no-require-imports -- Standalone SQLite regression harness. */
const assert = require('node:assert/strict');
const RealDate = Date, fixed = Date.parse('2026-10-18T11:00:00Z');
global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } };
const h = require('./finance-remediation-fixture.cjs').harness();
async function main() {
  delete process.env.BRI_DIST_CASH_ENABLED;
  h.db.exec(`INSERT INTO finance_cash_sessions(id,session_code,operator_id,opened_at,opening_balance,expected_closing_balance) VALUES('session','SES-REPORT','admin','2026-10-18T00:00:00Z',50000,50000);
    INSERT INTO finance_obligations(id,santri_id,item_type,period,amount_expected,amount_paid,status) VALUES('ob','student','SPP','2026-10',20000,20000,'PAID');
    INSERT INTO finance_payments(id,payment_number,santri_id,channel,method,gross_amount,net_amount,paid_at) VALUES('pay','PAY-REPORT','student','CASH','CASH',20000,20000,'2026-10-18T00:00:00Z');
    INSERT INTO finance_allocations(id,payment_id,obligation_id,target_type,item_type,amount) VALUES('alloc','pay','ob','OBLIGATION','SPP',20000);`);
  const action = h.load('app/dashboard/keuangan/penyaluran/actions.ts');
  const { data: paid } = await action.recordDistributionAction({ recipientType: 'BENDAHARA', itemType: 'SPP', period: '2026-10', amount: 10000, method: 'CASH', idempotencyKey: 'report-cash', receivingPersonName: 'Penerima Sintetis' });
  for (const [id, at, method] of [['draft', '2026-10-18 12:00:00', 'BRI_QLOLA'], ['last-ms', '2026-10-18T23:59:59.999Z', 'MANUAL_TRANSFER'], ['tomorrow', '2026-10-19T00:00:00Z', 'CASH']]) {
    h.db.prepare("INSERT INTO finance_distributions(id,distribution_number,recipient_type,item_type,period,total_amount,method,status,created_at) VALUES(?,?,'PESANTREN','SPP','2026-10',1000,?,'DRAFT',?)").run(id, 'DIST-' + id, method, at);
  }
  const reports = h.load('lib/finance/reports.ts');
  const result = await reports.getDistributionsReport({ startDate: '2026-10-18', endDate: '2026-10-18' });
  assert.deepEqual(result.items.map(i => i.id).sort(), [paid.id, 'draft', 'last-ms'].sort());
  assert.equal(result.kpi.totalDisbursed, 10000);
  assert.equal(result.kpi.totalBendahara, 10000);
  assert.equal(result.items.find(i => i.id === 'draft').status, 'DRAFT');
  assert.ok(result.items.find(i => i.id === paid.id).reportDate);
  assert.equal(result.items.find(i => i.id === paid.id).transferReference, null);
  for (const [method, id] of [['CASH', paid.id], ['BRI_QLOLA', 'draft'], ['MANUAL_TRANSFER', 'last-ms']]) {
    const filtered = await reports.getDistributionsReport({ startDate: '2026-10-18', endDate: '2026-10-18', method });
    assert.deepEqual(filtered.items.map(i => i.id), [id]);
  }
  const format = h.load('lib/finance/date-format.ts').formatFinanceDate;
  assert.equal(format('2026-10-18 00:00:00', true), format('2026-10-18T00:00:00Z', true));
  assert.equal(format(null), '-');
  assert.equal(format(new Date('invalid')), '-');
  assert.equal(h.db.prepare('PRAGMA foreign_key_check').all().length, 0);
  console.log('PASS actual cash evidence workflow, pending excluded from totals, three method filters, mixed timestamp/date boundaries, fractional last second, bank reference semantics, Jakarta formatting and foreign keys');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
