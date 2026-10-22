// Behavioral checks against the real finance migrations and the explicit-DB issuance runtime.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./finance-remediation-fixture.cjs');
const h=harness();
const {createBillingIssuance}=h.load('lib/finance/billing-issuance.ts');
const periods=h.load('lib/finance/billing-periods.ts');
const {assertBillingCollectible,collectibleBillingSql}=h.load('lib/finance/billing-legacy.ts');
const {previewBillingBackfill,applyBillingBackfill,billingFingerprint,verifyHistoricalProviderEvidence}=h.load('lib/finance/billing-backfill.ts');
const {runBillingJob}=h.load('lib/finance/billing-job.ts');
const at=new Date('2026-10-15T12:00:00+07:00');let count=0;
function setup(){
 h.reset();h.db.exec(fs.readFileSync('migrations/0196_finance_billing_issuance.sql','utf8'));
 h.db.exec(`UPDATE santri SET tanggal_masuk='2026-07-01',created_at='2026-07-01',tahun_masuk=2026;
 INSERT INTO app_settings(key,value) VALUES('spp_tagihan_mulai','2026-07');`);
 for(const item of ['SPP','UANG_MAKAN','UANG_NYUCI','EHB','EKSKUL','KESEHATAN']){
  if(!h.db.prepare('SELECT id FROM finance_tariffs WHERE item_type=? AND academic_year_id=2').get(item))
   h.db.prepare(`INSERT INTO finance_tariffs(id,item_type,academic_year_id,nominal,effective_from)
     VALUES(?,?,2,70000,'2026-07-01')`).run('tariff-'+item,item);
 }
}
function issuer(){return createBillingIssuance(h.adapter,at)}
async function test(name,fn){setup();await fn();count++;console.log('PASS '+name)}
function snapshot(){return JSON.stringify(h.db.prepare('SELECT * FROM finance_obligations ORDER BY id').all())}
async function main(){
 await test('meal and laundry wait for operational cutover including advance payment and direct engine calls',async()=>{
  h.db.exec("DELETE FROM app_settings WHERE key='finance_koperasi_effective_at';DELETE FROM finance_tariffs WHERE item_type IN ('UANG_MAKAN','UANG_NYUCI')");
  const r=await issuer().ensureStudent('student','2026-11');assert.equal(r.failed,0);assert.equal(r.created,6);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE item_type IN ('UANG_MAKAN','UANG_NYUCI')").get().n,0);
  await assert.rejects(()=>h.load('lib/finance/obligation-engine.ts').createObligationEngine(h.adapter,at).ensureObligation('student','UANG_MAKAN','2026-10'),/cutover/);
 });
 await test('effective instant activates both services at the applicable full monthly tariff without pre-cutover debt',async()=>{
  h.db.exec("UPDATE app_settings SET value='2026-10-15T19:00:00+07:00' WHERE key='finance_koperasi_effective_at'");
  const before=createBillingIssuance(h.adapter,new Date('2026-10-15T11:59:59Z'));
  assert.equal((await before.issue('student','UANG_MAKAN','2026-11')).outcome,'SKIPPED');
  const after=createBillingIssuance(h.adapter,new Date('2026-10-15T12:00:00Z'));
  for(const item of ['UANG_MAKAN','UANG_NYUCI']){
   const r=await after.issue('student',item,'2026-10');assert.equal(r.created,true);assert.equal(r.obligation.amount_expected,70000);
   assert.equal((await after.assess('student',item,'2026-09')).outcome,'SKIPPED');
  }
 });
 await test('cutover starts a new persisted sweep after an already completed daily run and replays safely',async()=>{
  h.db.exec("DELETE FROM app_settings WHERE key='finance_koperasi_effective_at'");
  assert.equal((await runBillingJob(h.adapter,at,10)).status,'COMPLETED');
  assert.equal((await runBillingJob(h.adapter,at,10)).status,'IDLE');
  h.db.exec("INSERT INTO app_settings(key,value) VALUES('finance_koperasi_effective_at','2026-10-15T00:00:00+07:00')");
  const r=await runBillingJob(h.adapter,at,10);assert.equal(r.status,'COMPLETED');assert.equal(r.created,2);
  const before=snapshot();assert.equal((await runBillingJob(h.adapter,at,10)).status,'IDLE');assert.equal(snapshot(),before);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_billing_runs WHERE id LIKE 'DAILY:%'").get().n,2);
 });
 await test('cutover gating hides existing service snapshots and blocks payment without mutating history',async()=>{
  await issuer().ensureStudent('student');const before=snapshot();
  h.db.exec("DELETE FROM app_settings WHERE key='finance_koperasi_effective_at'");
  assert.equal(h.db.prepare(`SELECT COUNT(*) n FROM finance_obligations o WHERE ${collectibleBillingSql()} AND item_type IN ('UANG_MAKAN','UANG_NYUCI')`).get().n,0);
  const o=h.db.prepare("SELECT id FROM finance_obligations WHERE item_type='UANG_MAKAN'").get();
  await assert.rejects(()=>assertBillingCollectible(h.adapter,o.id),/cutover/);assert.equal(snapshot(),before);
 });
 await test('invalid cutover is reported and post-cutover missing tariffs remain failures',async()=>{
  h.db.exec("UPDATE app_settings SET value='invalid' WHERE key='finance_koperasi_effective_at'");
  await assert.rejects(()=>runBillingJob(h.adapter,at,10),/tidak valid/);
  assert.equal((await issuer().ensureStudent('student')).failed,2);
  h.db.exec("UPDATE app_settings SET value='2026-10-01T00:00:00+07:00' WHERE key='finance_koperasi_effective_at';DELETE FROM finance_tariffs WHERE item_type='UANG_MAKAN'");
  assert.equal((await issuer().issue('student','UANG_MAKAN','2026-10')).outcome,'FAILED');
 });
 await test('warm request wrapper observes changed cutover instead of caching the prior request setting',async()=>{
  const service=h.load('lib/finance/obligations.ts');
  h.db.exec("DELETE FROM app_settings WHERE key='finance_koperasi_effective_at'");
  await assert.rejects(()=>service.ensureObligation('student','UANG_MAKAN','2026-10'),/cutover/);
  h.db.exec("INSERT INTO app_settings(key,value) VALUES('finance_koperasi_effective_at','2026-10-01T00:00:00+07:00')");
  assert.equal((await service.ensureObligation('student','UANG_MAKAN','2026-10')).amount_expected,70000);
 });
 await test('portal select-all excludes future bills and cancel-all clears explicitly selected future bills',()=>{
  const ts=require('typescript'),vm=require('node:vm');
  const file='app/portal-ortu/(app)/tagihan/_tagihan-client.tsx';
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let handler;
  function visit(node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='selectAllActive')handler=node.initializer;ts.forEachChild(node,visit)}
  visit(source);assert(handler,'Actual portal handler must exist');
  const code=ts.transpileModule('const invoke = '+handler.getText(source)+';invoke();',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const activeObligations=[{id:'current'},{id:'annual'}];
  function run(ids){let result;const selectedIds=new Set(ids);vm.runInNewContext(code,{Set,activeObligations,selectedIds,setSelectedIds:value=>{result=value}},{timeout:1000});assert.deepEqual([...selectedIds],ids,'Input selection mutated');return [...result].sort()}
  assert.deepEqual(run([]),['annual','current']);
  assert.deepEqual(run(['current','annual','future']),[]);
 });
 await test('month and academic-year boundaries use WIB, not request time zone',()=>{
  assert.equal(periods.billingPhase('SPP','2026-10',new Date('2026-09-30T16:59:59Z')),'UPCOMING');
  assert.equal(periods.billingPhase('SPP','2026-10',new Date('2026-09-30T17:00:00Z')),'CURRENT');
  assert.equal(periods.billingPhase('SPP','2026-09',at),'PAST');
  assert.equal(periods.billingPhase('EHB','2026',new Date('2027-06-30T16:59:59Z')),'CURRENT');
  assert.equal(periods.billingPhase('EHB','2026',new Date('2027-06-30T17:00:00Z')),'PAST');
  assert.equal(periods.billingPhase('USPP','LIFETIME',at),'CURRENT');
 });
 await test('santri without any portal account gets only current monthly, annual obligations',async()=>{
  const result=await issuer().ensureStudent('student');assert.equal(result.failed,0);
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_obligations WHERE santri_id=?').get('student').n,7);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE length(period)=7 AND period<>'2026-10'").get().n,0);
 });
 await test('repeated and concurrent issuance preserves canonical snapshots',async()=>{
  await issuer().ensureStudent('student');const before=snapshot();
  await Promise.all(Array.from({length:4},()=>issuer().ensureStudent('student')));
  assert.equal(snapshot(),before);assert.equal(h.db.prepare('PRAGMA foreign_key_check').all().length,0);
 });
 await test('concurrent first issuance reports only the actual insert winners',async()=>{
  const results=await Promise.all(Array.from({length:3},()=>issuer().ensureStudent('student')));
  assert.equal(results.reduce((sum,r)=>sum+r.created,0),7);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE santri_id='student'").get().n,7);
 });
 await test('AL-BAGHORY fully excluded; SADESA only excludes makan/nyuci',async()=>{
  h.db.exec("UPDATE santri SET asrama='AL-BAGHORY' WHERE id='student'");await issuer().ensureStudent('student');
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_obligations').get().n,0);
  h.db.exec("UPDATE santri SET asrama='ASRAMA A',kategori_santri='SADESA' WHERE id='student'");await issuer().ensureStudent('student');
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE item_type IN ('UANG_MAKAN','UANG_NYUCI')").get().n,0);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE item_type='SPP'").get().n,1);
 });
 await test('existing per-item and ALL exemptions remain unchanged',async()=>{
  const service=h.load('lib/finance/exemptions.ts');
  await service.grantExemption({santri_id:'student',item_type:'SPP',reason:'existing per-item',academic_year_id:2});
  const before=JSON.stringify(h.db.prepare('SELECT * FROM finance_exemptions').all());await issuer().ensureStudent('student');
  assert.equal(h.db.prepare("SELECT status FROM finance_obligations WHERE item_type='SPP'").get().status,'EXEMPTED');
  assert.equal(JSON.stringify(h.db.prepare('SELECT * FROM finance_exemptions').all()),before);
  await service.grantExemption({santri_id:'other',item_type:'ALL',reason:'existing full'});await issuer().ensureStudent('other');
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE santri_id='other' AND status<>'EXEMPTED'").get().n,0);
 });
 await test('legacy permanent SPP exemption and waived months stay authoritative without changing settings',async()=>{
  h.db.exec("UPDATE santri SET bebas_spp=1 WHERE id='student'");await issuer().ensureStudent('student');
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE santri_id='student' AND item_type='SPP'").get().n,0);
  h.db.exec("UPDATE santri SET bebas_spp=0 WHERE id='student';INSERT INTO spp_tagihan_ditiadakan VALUES('waived','student',2026,10,1)");
  await issuer().ensureStudent('student');assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE santri_id='student' AND item_type='SPP'").get().n,0);
  assert.equal(h.db.prepare('SELECT is_active FROM spp_tagihan_ditiadakan').get().is_active,1);
 });
 await test('explicit future payment is materialized but excluded from due/arrears',async()=>{
  await issuer().ensureStudent('student');await issuer().ensureStudent('student','2026-11');
  const due=h.db.prepare(`SELECT COUNT(*) n FROM finance_obligations o WHERE ${periods.dueBillingSql('o',at)}`).get().n;
  const future=h.db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE period='2026-11'").get().n;
  assert.equal(due,7);assert.equal(future,3);
  assert.equal(h.db.prepare(`SELECT COUNT(*) n FROM finance_obligations o WHERE ${periods.overdueBillingSql('o',at)}`).get().n,0);
  await assert.rejects(()=>issuer().ensureStudent('student','2099-01'),/rentang/);
 });
 await test('legacy payment not mirrored blocks both new debt and collection of existing debt',async()=>{
  await issuer().ensureStudent('student');const ob=h.db.prepare("SELECT * FROM finance_obligations WHERE item_type='SPP'").get();
  h.db.exec("INSERT INTO spp_log(id,santri_id,bulan,tahun,nominal_bayar) VALUES('legacy','student',10,2026,70000)");
  assert.equal((await issuer().assess('student','SPP','2026-10')).outcome,'REVIEW');
  await assert.rejects(()=>assertBillingCollectible(h.adapter,ob.id),/Perlu Pemeriksaan/);
  const orders=h.load('lib/finance/orders.ts');await assert.rejects(()=>orders.createPaymentOrder({santriId:'student',payerType:'LOKET',paymentMethod:'CASH',items:[{obligationId:ob.id,itemType:'SPP',amount:70000}]}),/Perlu Pemeriksaan/);
 });
 await test('legacy coexistence bridge resolves pending evidence without reposting on repeats',async()=>{
  h.db.exec("INSERT INTO spp_log(id,santri_id,bulan,tahun,nominal_bayar) VALUES('legacy','student',10,2026,70000)");
  const bridge=h.load('lib/finance/bridge.ts');await bridge.syncLegacyPayment('SPP_LOG','legacy');
  const before=snapshot();assert.notEqual((await issuer().assess('student','SPP','2026-10')).outcome,'REVIEW');
  await issuer().ensureStudent('student');await bridge.syncLegacyPayment('SPP_LOG','legacy');
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_payments WHERE external_reference='LEGACY_SPP_LOG:legacy'").get().n,1);
  const paid=JSON.parse(before).find(o=>o.item_type==='SPP');assert.equal(JSON.stringify(h.db.prepare('SELECT * FROM finance_obligations WHERE id=?').get(paid.id)),JSON.stringify(paid));
 });
 await test('legacy annual partial payment, unsynced edits and voids cannot look unpaid or settled silently',async()=>{
  h.db.exec("INSERT INTO pembayaran_tahunan(id,santri_id,jenis_biaya,tahun_tagihan,tahun_ajaran_id,nominal_bayar) VALUES('annual','student','EHB',2026,2,10000)");
  const bridge=h.load('lib/finance/bridge.ts');await bridge.syncLegacyPayment('PEMBAYARAN_TAHUNAN','annual');
  const ob=h.db.prepare("SELECT * FROM finance_obligations WHERE item_type='EHB'").get();
  await assertBillingCollectible(h.adapter,ob.id);
  h.db.exec("UPDATE pembayaran_tahunan SET nominal_bayar=15000 WHERE id='annual'");await assert.rejects(()=>assertBillingCollectible(h.adapter,ob.id),/Perlu Pemeriksaan/);
  h.db.exec("UPDATE pembayaran_tahunan SET nominal_bayar=10000,status='VOID' WHERE id='annual'");await assert.rejects(()=>assertBillingCollectible(h.adapter,ob.id),/Perlu Pemeriksaan/);
  await bridge.syncLegacyPaymentReversal('PEMBAYARAN_TAHUNAN','annual','test reversal','admin');await assertBillingCollectible(h.adapter,ob.id);
 });
 await test('deleted legacy source with unreversed mirror is flagged rather than assumed valid',async()=>{
  h.db.exec("INSERT INTO spp_log(id,santri_id,bulan,tahun,nominal_bayar) VALUES('deleted','student',10,2026,70000)");
  await h.load('lib/finance/bridge.ts').syncLegacyPayment('SPP_LOG','deleted');
  const ob=h.db.prepare("SELECT id FROM finance_obligations WHERE item_type='SPP'").get();
  h.db.exec("DELETE FROM spp_log WHERE id='deleted'");await assert.rejects(()=>assertBillingCollectible(h.adapter,ob.id),/Perlu Pemeriksaan/);
 });
 await test('bank/payment evidence arriving after an unsynced legacy payment is held UNALLOCATED',async()=>{
  await issuer().ensureStudent('student');const ob=h.db.prepare("SELECT * FROM finance_obligations WHERE item_type='SPP'").get();
  const order=await h.load('lib/finance/orders.ts').createPaymentOrder({santriId:'student',payerType:'LOKET',paymentMethod:'CASH',items:[{obligationId:ob.id,itemType:'SPP',amount:70000}]});
  h.db.exec("INSERT INTO spp_log(id,santri_id,bulan,tahun,nominal_bayar) VALUES('race','student',10,2026,70000)");
  const payment=await h.load('lib/finance/payments.ts').recordOrderPayment({orderId:order.id,channel:'CASH',method:'CASH',externalReference:'evidence-after-legacy'});
  assert.equal(payment.allocation_status,'UNALLOCATED');assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_allocations WHERE obligation_id=?').get(ob.id).n,0);
 });
 await test('backfill preview is read only; only explicitly approved unchanged candidates are inserted',async()=>{
  const before=snapshot(),preview=await previewBillingBackfill(h.adapter,'',at);assert.equal(snapshot(),before);
  const candidate=preview.candidates.find(c=>c.santriId==='student'&&c.itemType==='SPP'&&c.period==='2026-09');assert.equal(candidate.outcome,'READY');
  const selected=[candidate];const result=await applyBillingBackfill(h.adapter,selected,'admin',at);assert.equal(result.created,1);
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_obligations').get().n,1);
  assert.equal(h.db.prepare('SELECT created_by FROM finance_billing_runs WHERE id=?').get(result.runId).created_by,'admin');
  const next=await previewBillingBackfill(h.adapter,'',at);assert.equal(next.candidates.find(c=>c.santriId==='student'&&c.itemType==='UANG_MAKAN'&&c.period==='2026-09').outcome,'REVIEW');
 });
 await test('backfill revalidates changed preview and preserves configured SPP start and CUTOVER',async()=>{
  const preview=await previewBillingBackfill(h.adapter,'',at);const c=preview.candidates.find(c=>c.itemType==='SPP'&&c.period==='2026-09');
  h.db.exec("UPDATE app_settings SET value='2026-10' WHERE key='spp_tagihan_mulai'");
  await assert.rejects(()=>applyBillingBackfill(h.adapter,[c],'admin',at),/Pratinjau berubah/);
  assert.equal((await issuer().assess('student','SPP','2026-06')).outcome,'SKIPPED');
  assert.equal((await issuer().assess('student','EHB','2025')).outcome,'SKIPPED');
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_obligations').get().n,0);
 });
 await test('missing dates/inactive history and historical providers require inspection',async()=>{
  h.db.exec("UPDATE santri SET tanggal_masuk=NULL WHERE id='student'");assert.equal((await issuer().assess('student','SPP','2026-09')).outcome,'REVIEW');
  h.db.exec("UPDATE santri SET tanggal_masuk='2026-07-01' WHERE id='student';INSERT INTO santri_nonaktif_log VALUES('pause','student','2026-09-01','2026-10-01')");
  assert.equal((await issuer().assess('student','SPP','2026-09')).outcome,'REVIEW');
 });
 await test('verified historical provider becomes reviewable without using or changing current membership',async()=>{
  h.db.exec("INSERT INTO master_jasa(id,nama_jasa,jenis) VALUES('historical-provider','Katering Lama','Makan');UPDATE santri SET tempat_makan_id=NULL WHERE id='student'");
  const input={santriId:'student',itemType:'UANG_MAKAN',period:'2026-09',providerId:'historical-provider',note:'Daftar keanggotaan September, dokumen 001'};
  assert.equal((await issuer().assess('student','UANG_MAKAN','2026-09')).outcome,'REVIEW');
  await verifyHistoricalProviderEvidence(h.adapter,input,'admin',at);
  await verifyHistoricalProviderEvidence(h.adapter,{...input,note:'Verifikasi ulang daftar September, dokumen 002'},'admin',at);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_billing_runs WHERE id LIKE 'EVIDENCE:%'").get().n,2);
  const candidate=await issuer().assess('student','UANG_MAKAN','2026-09');assert.equal(candidate.outcome,'READY');assert.equal(candidate.obligation.provider_id,'historical-provider');
  const result=await applyBillingBackfill(h.adapter,[{...candidate,fingerprint:await billingFingerprint(candidate)}],'admin',at);assert.equal(result.created,1);
  assert.equal(h.db.prepare("SELECT tempat_makan_id FROM santri WHERE id='student'").get().tempat_makan_id,null);
  assert.equal(h.db.prepare("SELECT provider_id FROM finance_obligations WHERE period='2026-09'").get().provider_id,'historical-provider');
 });
 await test('provider evidence and operator audit roll back together at either write failure',async()=>{
  const input={santriId:'student',itemType:'UANG_MAKAN',period:'2026-09',providerId:'provider-meal',note:'Bukti daftar layanan September 2026'};
  for(const i of [0,1]){
   h.fault(i);await assert.rejects(()=>verifyHistoricalProviderEvidence(h.adapter,input,'admin',at),/INJECTED_BATCH_FAILURE/);
   assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_billing_runs').get().n,0);assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_billing_issues').get().n,0);
  }h.fault(-1);
 });
 await test('historical proof rejects wrong provider type and cannot replace an existing snapshot',async()=>{
  const input={santriId:'student',itemType:'UANG_MAKAN',period:'2026-09',providerId:'provider-wash',note:'Bukti September ditinjau petugas'};
  await assert.rejects(()=>verifyHistoricalProviderEvidence(h.adapter,input,'admin',at),/jenis provider/);
  h.db.exec("INSERT INTO finance_obligations(id,santri_id,item_type,period,amount_expected,provider_id) VALUES('frozen','student','UANG_MAKAN','2026-09',70000,'provider-meal')");
  const before=snapshot();await assert.rejects(()=>verifyHistoricalProviderEvidence(h.adapter,{...input,providerId:'provider-meal'},'admin',at),/snapshot existing/);assert.equal(snapshot(),before);
 });
 await test('lifetime USPP never reissued to legacy students without authoritative liability',async()=>{
  h.db.exec("UPDATE santri SET tanggal_masuk='2020-07-01',created_at='2020-07-01',tahun_masuk=2020 WHERE id='student'");
  assert.equal((await issuer().assess('student','USPP','LIFETIME')).outcome,'SKIPPED');
 });
 await test('an explicitly configured zero lifetime tariff cannot become a hardcoded legacy fallback debt',async()=>{
  h.db.exec("UPDATE finance_tariffs SET nominal=0 WHERE item_type='USPP'");
  const result=await issuer().issue('student','USPP','LIFETIME');assert.equal(result.obligation.amount_expected,0);assert.equal(result.obligation.status,'EXEMPTED');
 });
 await test('tariff override honors nominal snapshot without invalid FK or altering tariff configuration',async()=>{
  h.db.exec("INSERT INTO finance_tariff_overrides(id,item_type,period,nominal,academic_year_id) VALUES('override','UANG_MAKAN','2026-10',30000,2)");
  const result=await issuer().issue('student','UANG_MAKAN','2026-10');assert.equal(result.obligation.amount_expected,30000);
  assert.equal(h.db.prepare('PRAGMA foreign_key_check').all().length,0);
 });
 await test('missing tariff and query/write failure are reported, never treated as empty success',async()=>{
  h.db.exec("DELETE FROM finance_tariffs WHERE item_type='UANG_MAKAN'");const result=await issuer().ensureStudent('student');assert(result.failed>=1);
  h.queryFault(true);await assert.rejects(()=>issuer().assess('student','SPP','2026-10'),/INJECTED/);h.queryFault(false);
 });
 await test('scheduled cursor survives interruption; repeated invocation never duplicates obligations',async()=>{
  await runBillingJob(h.adapter,at,1);const first=h.db.prepare('SELECT cursor FROM finance_billing_runs').get().cursor;assert(first);
  const original=h.adapter.execute;let failed=false;
  h.adapter.execute=async(sql,p)=>{if(!failed&&sql.startsWith('UPDATE finance_billing_runs SET cursor')){failed=true;throw Error('INTERRUPTED')}return original(sql,p)};
  await assert.rejects(()=>runBillingJob(h.adapter,new Date(at.getTime()+5*60_000),1),/INTERRUPTED/);h.adapter.execute=original;
  assert.equal(h.db.prepare('SELECT cursor FROM finance_billing_runs').get().cursor,first);
  await runBillingJob(h.adapter,new Date(at.getTime()+10*60_000),1);const before=snapshot();await runBillingJob(h.adapter,new Date(at.getTime()+15*60_000),1);assert.equal(snapshot(),before);
 });
 await test('cashier forms generate current obligations without portal login and leave future unselected',async()=>{
  const cash=await h.load('app/dashboard/keuangan/status-pembayaran/actions.ts').getUnpaidObligationsForCashPayment('student');
  assert(cash.obligations.some(o=>o.itemType==='SPP'));assert(cash.obligations.every(o=>o.billingPhase!=='UPCOMING'));
  const loket=await h.load('app/dashboard/koperasi/loket/actions.ts').getStudentLoketAccountData('student','2026-11');
  assert(loket.unpaidObligations.some(o=>o.period==='2026-11'&&o.billingPhase==='UPCOMING'));
 });
 await test('portal totals agree with cashier current balances and do not include advance obligations',async()=>{
  const portal=h.load('lib/portal/finance.ts');const before=await portal.getPortalStudentBilling('student');
  const due=[...before.obligations.past,...before.obligations.current,...before.obligations.annual];
  assert.equal(before.obligations.totalRemaining,due.reduce((sum,o)=>sum+o.remaining,0)+(before.obligations.uspp?.remaining??0));
  await h.load('lib/finance/billing.ts').ensureStudentBilling('student','2026-11');
  const after=await portal.getPortalStudentBilling('student');assert.equal(after.obligations.totalRemaining,before.obligations.totalRemaining);
  assert(after.obligations.upcoming.some(o=>o.period==='2026-11'));assert.equal(after.billingWarnings.length,0);
 });
 await test('status payment arrears includes monthly and prior academic year, excludes current year and USPP',async()=>{
  h.db.exec(`INSERT INTO finance_obligations(id,santri_id,item_type,period,amount_expected) VALUES
   ('old-month','student','SPP','2026-09',70000),('old-year','student','EHB','2025',100000),
   ('current-year','student','KESEHATAN','2026',200000),('lifetime','student','USPP','LIFETIME',1000000),
   ('future','student','SPP','2026-11',70000)`);
  const result=await h.load('app/dashboard/keuangan/status-pembayaran/actions.ts').getStatusPembayaranData({tab:'TUNGGAKAN',period:'ALL',currentDateOverride:'2026-10-15'});
  assert.deepEqual(result.tunggakanItems.map(o=>o.obligationId).sort(),['old-month','old-year']);assert.equal(result.tabKpi.tunggakan.totalTunggakanNominal,170000);
  assert.equal(result.kpi.totalTunggakanNominal,170000);
  h.db.exec("INSERT INTO finance_payments(id,payment_number,santri_id,channel,method,gross_amount,net_amount,allocation_status,paid_at,source,fund_management) VALUES('history-preserved','HISTORY-PRESERVED','student','CASH','CASH',10000,10000,'UNALLOCATED','2026-09-01T00:00:00Z','LEGACY','PRE_KOPERASI')");
  const detail=await h.load('app/dashboard/keuangan/status-pembayaran/actions.ts').getStudentPaymentDetail('student');
  assert(detail.drilldown.bulanan.every(o=>['SPP','UANG_MAKAN','UANG_NYUCI'].includes(o.itemType)));
  assert(detail.drilldown.tahunan.every(o=>['EHB','EKSKUL','KESEHATAN'].includes(o.itemType)));
  assert.equal(detail.summary.grandTotalTunggakan,170000);
  assert(detail.drilldown.riwayatBayar.some(p=>p.id==='history-preserved'));
 });
 await test('client-imported finance action modules retain the server-only boundary',()=>{
  const ts=require('typescript');
  for(const file of ['app/dashboard/keuangan/status-pembayaran/actions.ts','app/dashboard/keuangan/status-pembayaran/billing-actions.ts',
    'app/dashboard/koperasi/loket/actions.ts','app/portal-ortu/(app)/tagihan/actions.ts']){
   const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
   assert(ts.isExpressionStatement(source.statements[0])&&ts.isStringLiteral(source.statements[0].expression)&&source.statements[0].expression.text==='use server',file+' must be a server-action module');
  }
 });
 await test('atomic database guards reject a legacy payment appearing between order validation and commit',async()=>{
  await issuer().ensureStudent('student');const ob=h.db.prepare("SELECT id FROM finance_obligations WHERE item_type='SPP'").get();
  const original=h.adapter.batch;let injected=false;
  h.adapter.batch=async ss=>{if(!injected){injected=true;h.db.exec("INSERT INTO spp_log(id,santri_id,bulan,tahun,nominal_bayar) VALUES('late','student',10,2026,70000)")}return original(ss)};
  try {await assert.rejects(()=>h.load('lib/finance/orders.ts').createPaymentOrder({santriId:'student',payerType:'LOKET',paymentMethod:'CASH',items:[{obligationId:ob.id,itemType:'SPP',amount:70000}]}),/BILLING_REVIEW_REQUIRED/)}finally{h.adapter.batch=original}
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_payment_orders').get().n,0);
 });
 await test('billing audit actions reject anonymous and read-only mutation before touching data',async()=>{
  const actions=h.load('app/dashboard/keuangan/status-pembayaran/billing-actions.ts');const session=h.state.session;
  h.state.session=null;await assert.rejects(()=>actions.previewMissingBillingAction(),/UNAUTHORIZED/);await assert.rejects(()=>actions.getBillingMonitorAction(),/UNAUTHORIZED/);
  await assert.rejects(()=>actions.verifyHistoricalBillingProviderAction({}),/UNAUTHORIZED/);
  h.state.session={id:'viewer',roles:['pimpinan'],role:'pimpinan'};await assert.rejects(()=>actions.applyMissingBillingAction([]),/FORBIDDEN/);h.state.session=session;
  h.state.session={id:'cashier',role:'petugas_koperasi',roles:['petugas_koperasi']};await assert.rejects(()=>actions.verifyHistoricalBillingProviderAction({}),/FORBIDDEN/);h.state.session=session;
 });
 await test('worker is disabled by default and fails closed on missing environment when enabled',async()=>{
  const worker=h.load('workers/finance-billing.ts').default;
  await worker.scheduled({scheduledTime:at.getTime()},{FINANCE_BILLING_AUTO_ENABLED:'false'});
  await assert.rejects(()=>worker.scheduled({scheduledTime:at.getTime()},{FINANCE_BILLING_AUTO_ENABLED:'true'}),/Environment/);
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_billing_runs').get().n,0);
 });
 await test('duplicate scheduler invocations acquire one durable lease',async()=>{
  const results=await Promise.all([runBillingJob(h.adapter,at,1),runBillingJob(h.adapter,at,1)]);
  assert.equal(results.filter(r=>r.status==='IDLE').length,1);
  assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_obligations').get().n,5);
 });
 await test('failed obligation insertion creates no partial finance state',async()=>{
  const broken={...h.adapter,execute:async(sql,p)=>{if(sql.includes('INSERT OR IGNORE INTO finance_obligations'))throw Error('INSERT_FAILURE');return h.adapter.execute(sql,p)}};
  const result=await createBillingIssuance(broken,at).ensureStudent('student');assert(result.failed>0);
  for(const table of ['finance_obligations','finance_payments','finance_allocations'])assert.equal(h.db.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);
 });
 await test('student eligibility is revalidated by the engine despite the per-student initial snapshot',async()=>{
  let changed=false;
  const store={...h.adapter,execute:async(sql,p)=>{
   const result=await h.adapter.execute(sql,p);
   if(!changed&&sql.includes('INSERT OR IGNORE INTO finance_obligations')){
    changed=true;h.db.prepare("UPDATE santri SET kategori_santri='SADESA' WHERE id='student'").run();
   }
   return result;
  }};
  await createBillingIssuance(store,at).ensureStudent('student');
  assert(changed);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_obligations WHERE santri_id='student' AND item_type IN ('UANG_MAKAN','UANG_NYUCI')").get().n,0);
 });
 await test('Worker budget models 2500 students daily at 300ms per query and stays below query limits',async()=>{
  for(let i=0;i<100;i++)h.db.prepare(`INSERT INTO santri(id,nis,nama_lengkap,asrama,kategori_santri,
   tempat_makan_id,tempat_mencuci_id,tanggal_masuk,created_at,tahun_masuk)
   SELECT ?,?,nama_lengkap,asrama,kategori_santri,tempat_makan_id,tempat_mencuci_id,tanggal_masuk,created_at,tahun_masuk FROM santri WHERE id='student'`)
   .run('batch-'+String(i).padStart(3,'0'),'BATCH-'+i);
  let queries=0,clock=0;
  const db={prepare(sql){let params=[];return{bind(...p){params=p;return this},
   async first(){queries++;clock+=300;return h.db.prepare(sql).get(...params)||null},
   async all(){queries++;clock+=300;return{success:true,results:h.db.prepare(sql).all(...params)}},
   async run(){queries++;clock+=300;h.db.prepare(sql).run(...params);return{success:true}}}}};
  const originalNow=Date.now,originalLog=console.log;Date.now=()=>clock;console.log=()=>{};
  try{await h.load('workers/finance-billing.ts').default.scheduled({scheduledTime:at.getTime()},
   {DB:db,DEMO_DB:db,ESKAHADE_ENV:'sandbox',FINANCE_BILLING_AUTO_ENABLED:'true'})}
  finally{Date.now=originalNow;console.log=originalLog}
  const run=h.db.prepare("SELECT * FROM finance_billing_runs WHERE id LIKE 'DAILY:2026-10-15%'").get();
  const processed=(run.created_count+run.existing_count+run.skipped_count+run.review_count+run.failed_count)/7;
  assert(processed>=Math.ceil(2500/288),'Insufficient daily throughput: '+processed+' students/tick');
  assert(queries<1000,'D1 query ceiling exceeded: '+queries);assert(clock<300000,'Five-minute tick overlap');
  assert.equal(run.failed_count,0);assert.equal(run.lease_until,null);
  console.log('Worker budget model: '+processed+' students, '+queries+' queries, '+clock+'ms at 300ms/query');
 });
 await test('additive schema leaves every existing financial row untouched',()=>{
  h.reset();h.db.exec(`INSERT INTO finance_obligations(id,santri_id,item_type,period,amount_expected) VALUES('existing','student','SPP','2026-09',70000);
   INSERT INTO finance_payments(id,payment_number,santri_id,channel,method,gross_amount,net_amount,paid_at,source,fund_management)
    VALUES('legacy-existing','KEEP-EXISTING','student','CASH','CASH',70000,70000,'2026-09-02T00:00:00Z','LEGACY','PRE_KOPERASI');
   INSERT INTO finance_allocations(id,payment_id,obligation_id,target_type,item_type,amount) VALUES('allocation-existing','legacy-existing','existing','OBLIGATION','SPP',70000);`);
  const tables=h.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'finance_%'").all().map(r=>r.name);
  const before=tables.map(table=>[table,JSON.stringify(h.db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all())]);
  h.db.exec(fs.readFileSync('migrations/0196_finance_billing_issuance.sql','utf8'));
  for(const [table,json] of before)assert.equal(JSON.stringify(h.db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()),json,table+' mutated');
  assert.equal(h.db.prepare('PRAGMA foreign_key_check').all().length,0);
 });
 console.log(`ALL ${count} BILLING TESTS PASSED`)
}
main().catch(error=>{console.error(error);process.exitCode=1});
