// Real local D1 binding via Miniflare; no remote database or bank calls.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {Miniflare}=require('miniflare');
const {harness}=require('./finance-remediation-fixture.cjs');
const h=harness();
async function main(){
 h.db.exec(fs.readFileSync('migrations/0196_finance_billing_issuance.sql','utf8'));
 h.db.exec("UPDATE santri SET tanggal_masuk='2026-07-01',created_at='2026-07-01',tahun_masuk=2026");
 for(const item of ['UANG_MAKAN','UANG_NYUCI'])h.db.prepare("INSERT INTO finance_tariffs(id,item_type,academic_year_id,nominal,effective_from) VALUES(?,?,2,70000,'2026-07-01')").run('d1-'+item,item);
 const mf=new Miniflare({modules:true,script:'export default { fetch() { return new Response("local billing test"); } }',
  compatibilityDate:'2026-06-02', // Installed local workerd ceiling; deployment config keeps its own date.
 d1Databases:{DB:'billing-test'}});
 try {
  const db=await mf.getD1Database('DB');
  const schema=h.db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'view' THEN 1 WHEN 'index' THEN 2 ELSE 3 END,rowid").all();
  for(const row of schema)await db.prepare(row.sql).run();
  const inserts=[];
  for(const table of schema.filter(s=>s.type==='table'))for(const row of h.db.prepare('SELECT * FROM '+table.name).all()){
   const keys=Object.keys(row);inserts.push(db.prepare('INSERT INTO '+table.name+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').bind(...keys.map(k=>row[k])));
  }
  await db.batch([db.prepare('PRAGMA defer_foreign_keys=ON'),...inserts]);
  const {billingStore}=h.load('lib/finance/billing-store.ts');
  const {createBillingIssuance}=h.load('lib/finance/billing-issuance.ts');
  const {runBillingJob}=h.load('lib/finance/billing-job.ts');
  const store=billingStore(db),at=new Date('2026-10-21T08:00:00Z');
  const result=await createBillingIssuance(store,at).ensureStudent('student');assert.equal(result.failed,0);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE santri_id='student'").first()).n,7);
  console.log('PASS D1 current issuance works without Next.js or portal/session context');
  const before=JSON.stringify((await db.prepare('SELECT * FROM finance_obligations ORDER BY id').all()).results);
  await Promise.all(Array.from({length:3},()=>createBillingIssuance(store,at).ensureStudent('student')));
  assert.equal(JSON.stringify((await db.prepare('SELECT * FROM finance_obligations ORDER BY id').all()).results),before);
  console.log('PASS D1 concurrent issuance preserves one canonical obligation and snapshots');
  const jobs=await Promise.all([runBillingJob(store,at,1),runBillingJob(store,at,1)]);
  assert.equal(jobs.filter(j=>j.status==='IDLE').length,1);
  console.log('PASS D1 UPDATE RETURNING lease excludes duplicate scheduler execution');
  await h.load('lib/finance/billing-backfill.ts').verifyHistoricalProviderEvidence(store,
    {santriId:'student',itemType:'UANG_MAKAN',period:'2026-09',providerId:'provider-meal',note:'Daftar layanan September diverifikasi pada dokumen uji D1'},'admin',at);
  const historical=await createBillingIssuance(store,at).assess('student','UANG_MAKAN','2026-09');
  assert.equal(historical.outcome,'READY');assert.equal(historical.obligation.provider_id,'provider-meal');
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM finance_billing_runs WHERE id LIKE 'EVIDENCE:%'").first()).n,1);
  console.log('PASS D1 historical provider verification and operator audit commit together');
  const ob=await db.prepare("SELECT id FROM finance_obligations WHERE santri_id='student' AND item_type='SPP'").first();
  await db.prepare("INSERT INTO spp_log(id,santri_id,bulan,tahun,nominal_bayar) VALUES('d1-legacy','student',10,2026,70000)").run();
  await assert.rejects(()=>db.batch([
   db.prepare("INSERT INTO finance_payment_orders(id,order_number,santri_id,payer_type,gross_amount,total_charged,payment_method,expires_at) VALUES('d1-order','D1-ORDER','student','LOKET',70000,70000,'CASH','2099-01-01T00:00:00Z')"),
   db.prepare("INSERT INTO finance_order_items(id,order_id,obligation_id,item_type,amount) VALUES('d1-item','d1-order',?,'SPP',70000)").bind(ob.id),
  ]),/BILLING_REVIEW_REQUIRED/);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM finance_payment_orders WHERE id='d1-order'").first()).n,0);
  assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
  console.log('PASS D1 batch rolls back header and items on late legacy conflict; foreign keys intact');
  await db.prepare("DELETE FROM app_settings WHERE key='finance_koperasi_effective_at'").run();
  const gated=await createBillingIssuance(store,at).ensureStudent('student','2026-11');
  assert.equal(gated.failed,0);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE period='2026-11' AND item_type IN ('UANG_MAKAN','UANG_NYUCI')").first()).n,0);
  const {collectibleBillingSql}=h.load('lib/finance/billing-legacy.ts');
  assert.equal((await db.prepare(`SELECT COUNT(*) n FROM finance_obligations o WHERE ${collectibleBillingSql()} AND item_type IN ('UANG_MAKAN','UANG_NYUCI')`).first()).n,0);
  await db.prepare("INSERT INTO app_settings(key,value) VALUES('finance_koperasi_effective_at','2026-10-21T00:00:00+07:00')").run();
  const enabled=await createBillingIssuance(store,at).ensureStudent('student','2026-11');assert.equal(enabled.failed,0);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE period='2026-11' AND item_type IN ('UANG_MAKAN','UANG_NYUCI')").first()).n,2);
  console.log('PASS D1 operational cutover gates service creation and collection without deleting snapshots');
  console.log('ALL 6 LOCAL D1 BILLING TESTS PASSED');
 }finally{await mf.dispose()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
