const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {harness}=require('./finance-remediation-fixture.cjs');const h=harness();let count=0;
async function test(name,fn){await fn();console.log('PASS '+name);count++}
function obligation(){h.db.exec("INSERT INTO finance_obligations(id,santri_id,item_type,period,academic_year_id,amount_expected) VALUES('ob','student','SPP','2026-10',2,10000)")}
async function main(){
 await test('A10 every finance action export rejects unauthenticated invocation before use',async()=>{
  h.state.session=null;let checked=0;
  const dirs=['kredensial','laporan','penyaluran','rekonsiliasi','riwayat','status-pembayaran','tarif','uang-jajan'];
  for(const dir of dirs)for(const file of dir==='rekonsiliasi'?['actions.ts','bri-actions.ts']:['actions.ts']){
   const relative='app/dashboard/keuangan/'+dir+'/'+file,source=ts.createSourceFile(relative,fs.readFileSync(path.resolve(relative),'utf8'),ts.ScriptTarget.Latest,true);
   const actions=h.load(relative);
   for(const node of source.statements)if(ts.isFunctionDeclaration(node)&&node.name&&node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){
    const name=node.name.text;await assert.rejects(()=>actions[name](),/UNAUTHORIZED|Sesi|login|Akses ditolak|autentikasi/i,relative+' '+name);checked++;
   }
  }assert(checked>=90);h.state.session={id:'admin',role:'admin',roles:['admin']};console.log('  authorized entrypoints checked:',checked);
 });
 await test('A10 view-only and missing feature permission cannot mutate',async()=>{
  h.state.session={id:'viewer',role:'pimpinan',roles:['pimpinan']};await assert.rejects(()=>h.load('app/dashboard/keuangan/tarif/actions.ts').updateGlobalDailyLimitAction(2000),/FORBIDDEN|baca/);
  h.state.session={id:'cashier',role:'petugas_koperasi',roles:['petugas_koperasi']};h.state.feature=false;await assert.rejects(()=>h.load('app/dashboard/keuangan/riwayat/actions.ts').getInitialHistoryData(),/FORBIDDEN/);h.state.feature=true;h.state.session={id:'admin',role:'admin',roles:['admin']};
 });
 await test('A11 Fixed VA history is permanent, inactive retains ownership',async()=>{
  h.reset();const va=h.load('lib/finance/va.ts');await va.assignStudentFixedVa('student','777770001','0001');await va.assignStudentFixedVa('student','777770001','0001','INACTIVE');
  await assert.rejects(()=>va.assignStudentFixedVa('student','777770002','0002'),/IMMUTABLE/);await assert.rejects(()=>va.assignStudentFixedVa('other','777770001','0001'),/santri lain/);assert.throws(()=>h.db.exec('DELETE FROM finance_student_va'),/IMMUTABLE/);
  h.db.exec("UPDATE santri SET asrama='AL-BAGHORY' WHERE id='other'");await assert.rejects(()=>va.assignStudentFixedVa('other','777770002','0002'),/bebas/);
 });
 await test('A12 both beneficiary interfaces explicitly unverified; no fabricated bank reference',async()=>{
  for(const result of [await new (h.load('lib/finance/bri/account-inquiry-service.ts').BriAccountInquiryService)().verifyBeneficiaryAccount({bankCode:'002',accountNumber:'123456789',expectedAccountHolder:'Expected'}),await h.load('lib/finance/bri/qlola-service.ts').briQlolaDistributionService.inquiryBeneficiaryAccount({bankCode:'002',accountNumber:'123456789'})]){assert.equal(result.status,'NOT_VERIFIED');assert.equal(result.isMatched,false);assert.equal(result.inquiryReference,'');assert.equal(result.accountHolderName,'')}
 });
 await test('A17 invalid Rupiah rejected across order/tariff/fee/wallet/config services',async()=>{
  h.reset();const order=h.load('lib/finance/orders.ts'),tariff=h.load('lib/finance/tariffs.ts'),fee=h.load('lib/finance/cooperative-admin.ts'),wallet=h.load('lib/finance/wallet.ts');
  for(const amount of [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){await assert.rejects(()=>order.createPaymentOrder({santriId:'student',payerType:'LOKET',paymentMethod:'CASH',items:[{itemType:'UANG_JAJAN',amount}]}));await assert.rejects(()=>fee.setCooperativeAdminFeeRule({amount}));await assert.rejects(()=>tariff.createTariff({item_type:'SPP',nominal:amount,effective_from:'2026-01-01',created_by:'admin'}));await assert.rejects(()=>wallet.setGlobalDailyLimit(amount))}
 });
 await test('A17 fee is server-derived once, snapshot survives changed tariff and config read failure aborts',async()=>{
  h.reset();const fee=h.load('lib/finance/cooperative-admin.ts'),orders=h.load('lib/finance/orders.ts');
  await h.load('lib/finance/va.ts').assignStudentFixedVa('student','777770001','0001');const rule=await fee.setCooperativeAdminFeeRule({amount:2500,createdBy:'admin'});
  const order=await orders.createPaymentOrder({santriId:'student',payerType:'PORTAL_ORTU',paymentMethod:'BRI_VA',cooperativeAdminFee:1,items:[{itemType:'UANG_JAJAN',amount:10000},{itemType:'UANG_JAJAN',amount:20000}]});
  assert.equal(order.cooperative_admin_fee,2500);assert.equal(order.total_charged,32500);assert.equal(order.cooperative_fee_rule_id,rule.id);
  await fee.setCooperativeAdminFeeRule({amount:5000,createdBy:'admin'});assert.equal((await orders.getPaymentOrderById(order.id)).cooperative_admin_fee,2500);
  assert.throws(()=>h.db.exec("UPDATE finance_payment_orders SET cooperative_admin_fee=0"),/IMMUTABLE/);
  h.queryFault(true);await assert.rejects(()=>orders.createPaymentOrder({santriId:'student',payerType:'PORTAL_ORTU',items:[{itemType:'UANG_JAJAN',amount:10000}]}),/INJECTED_QUERY_FAILURE/);h.queryFault(false);
 });
 await test('A17 exemption/obligation grant and revoke roll back together; academic-year scoping',async()=>{
  const service=h.load('lib/finance/exemptions.ts'),req={santri_id:'student',item_type:'SPP',academic_year_id:2,period_start:'2026-10',period_end:'2026-11',reason:'Test exemption',created_by:'admin'};
  for(let i=0;i<2;i++){h.reset();obligation();h.fault(i);await assert.rejects(()=>service.grantExemption(req),/INJECTED_BATCH_FAILURE/);assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_exemptions').get().n,0);assert.equal(h.db.prepare('SELECT amount_exempted n FROM finance_obligations').get().n,0)}
  h.reset();obligation();h.db.exec("INSERT INTO tahun_ajaran VALUES(3,'2027/2028',0);INSERT INTO finance_obligations(id,santri_id,item_type,period,academic_year_id,amount_expected) VALUES('other-year','student','SPP','2026-11',3,10000)");const granted=await service.grantExemption(req);assert.equal(h.db.prepare("SELECT amount_exempted n FROM finance_obligations WHERE id='ob'").get().n,10000);assert.equal(h.db.prepare("SELECT amount_exempted n FROM finance_obligations WHERE id='other-year'").get().n,0);
  for(let i=0;i<3;i++){h.fault(i);await assert.rejects(()=>service.revokeExemption(granted.id,{revokedBy:'admin',reason:'Test revoke'}),/INJECTED_BATCH_FAILURE/);assert.equal(h.db.prepare('SELECT status FROM finance_exemptions').get().status,'ACTIVE')}h.fault(-1);await service.revokeExemption(granted.id,{revokedBy:'admin',reason:'Test revoke'});assert.equal(h.db.prepare("SELECT status FROM finance_obligations WHERE id='ob'").get().status,'UNPAID');
 });
 await test('A13 workbench read entrypoint and disabled sync; A16 cancellation reads current schema',async()=>{
  h.reset();const actions=h.load('app/dashboard/keuangan/rekonsiliasi/bri-actions.ts');assert.equal((await actions.getBriReconciliationWorkbench()).syncEnabled,false);await assert.rejects(()=>actions.syncBriStatementAction({fromDateTime:'2026-10-18T00:00:00+07:00',toDateTime:'2026-10-18T23:59:59+07:00'}),/dinonaktifkan/);
  const orders=h.load('lib/finance/orders.ts');const order=await orders.createPaymentOrder({santriId:'student',payerType:'LOKET',paymentMethod:'CASH',items:[{itemType:'UANG_JAJAN',amount:10000}]});assert.equal((await orders.cancelPaymentOrder(order.id)).status,'CANCELLED');
 });
 await test('A18 forward migrations preserve every existing financial value and FK',()=>{
  const db=require('./finance-remediation-fixture.cjs').createDatabase(186);db.exec("INSERT INTO finance_payments(id,payment_number,santri_id,channel,method,gross_amount,net_amount,paid_at,source,fund_management) VALUES('legacy','LEGACY-PRESERVE','student','CASH','CASH',70000,70000,'2020-01-01T00:00:00Z','LEGACY','PRE_KOPERASI')");
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'finance_%'").all().map(r=>r.name),snapshots=[];
  for(const table of tables){const cols=db.prepare('PRAGMA table_info('+table+')').all().map(r=>r.name);snapshots.push({table,cols,json:JSON.stringify(db.prepare('SELECT '+cols.join(',')+' FROM '+table+' ORDER BY rowid').all())})}
  for(const prefix of ['0187_','0188_','0189_'])db.exec(fs.readFileSync(path.join('migrations',fs.readdirSync('migrations').find(f=>f.startsWith(prefix))),'utf8'));
  for(const row of snapshots)assert.equal(JSON.stringify(db.prepare('SELECT '+row.cols.join(',')+' FROM '+row.table+' ORDER BY rowid').all()),row.json,row.table+' historical data changed');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);db.close();
 });
 await test('A02 fresh process replays committed cash receipt after lost response and closed session',async()=>{
  h.reset();h.db.exec("INSERT INTO finance_cash_sessions(id,session_code,operator_id,opened_at,opening_balance,expected_closing_balance) VALUES('session','CROSS-PROCESS','admin',datetime('now'),50000,50000)");
  const req={santriId:'student',idempotencyKey:'cross-process',items:[{itemType:'UANG_JAJAN',amount:10000}]};const receipt=await h.load('app/dashboard/koperasi/loket/actions.ts').executeLoketDepositOrPayment(req);
  h.db.exec("UPDATE finance_cash_sessions SET status='CLOSED'");const file=path.resolve('output/remediation-regression/cross-process.sqlite');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  await require('node:sqlite').backup(h.db,file);
  const child=require('node:child_process').spawnSync(process.execPath,['-e',`const h=require('./scripts/finance-remediation-fixture.cjs').harness();h.openFile(${JSON.stringify(file)});h.load('app/dashboard/koperasi/loket/actions.ts').executeLoketDepositOrPayment(${JSON.stringify(req)}).then(r=>process.stdout.write(r.receiptNumber)).catch(e=>{console.error(e);process.exitCode=1})`],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,receipt.receiptNumber);
 });
 await test('A10 cashier cannot read another operator cash drawer',async()=>{
  h.reset();h.db.exec("INSERT INTO finance_cash_sessions(id,session_code,operator_id,opened_at,opening_balance,expected_closing_balance) VALUES('session','PRIVATE-DRAWER','admin',datetime('now'),50000,50000)");h.state.session={id:'cashier',role:'petugas_koperasi',roles:['petugas_koperasi']};
  await assert.rejects(()=>h.load('app/dashboard/koperasi/loket/actions.ts').getLoketCurrentSessionTransactions('session'),/FORBIDDEN/);h.state.session={id:'admin',role:'admin',roles:['admin']};
 });
 await test('A18 actual DB selector routes signed demo session exclusively to DEMO_DB and tester cannot write',async()=>{
  const crypto=require('node:crypto');process.env.JWT_SECRET='local-isolation-test-only';
  function token(role){const data=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({id:'isolated-user',role,roles:[role],environment:role==='demo'?'sandbox':'production'})).toString('base64url');return data+'.'+crypto.createHmac('sha256',process.env.JWT_SECRET).update(data).digest('base64url')}
  h.state.demoDB={name:'DEMO',prepare:()=>({bind(){return this},first:async()=>({role:'demo',roles:'["demo"]'})})};h.state.productionDB={name:'PRODUCTION'};h.state.environment='sandbox';h.state.cookieToken=token('demo');const actual=h.load('lib/db/index.ts');assert.equal(await actual.getDB(),h.state.demoDB);
  h.state.demoDB=undefined;await assert.rejects(()=>actual.getDB(),/Database|isolasi/);h.state.environment='production';
  let writes=0;h.state.productionDB={prepare:()=>({bind(){return this},first:async()=>({role:'tester',roles:'["tester"]'}),run:async()=>{writes++;return {success:true}}})};h.state.cookieToken=token('tester');
  const readOnly=await actual.getDB();assert.throws(()=>readOnly.prepare('INSERT INTO finance_payments(id) VALUES(?)').bind('unsafe').run(),/hanya boleh membaca/);assert.equal(writes,0);h.state.cookieToken=undefined;
 });
 console.log(`ALL ${count} OPERATIONS REMEDIATION TESTS PASSED`)
}
main().catch(e=>{console.error(e);process.exitCode=1});
