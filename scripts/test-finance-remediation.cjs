const assert=require('node:assert/strict');const {harness}=require('./finance-remediation-fixture.cjs');
const h=harness();let count=0;
async function test(name,fn){await fn();count++;console.log(`PASS ${name}`)}
function seedWallet(){h.db.exec(`INSERT INTO finance_payments(id,payment_number,santri_id,channel,method,gross_amount,net_amount,paid_at)
 VALUES('payment','PAY-TEST','student','CASH','CASH',10000,10000,'2026-10-18T00:00:00.000Z');
 INSERT INTO finance_allocations(id,payment_id,target_type,item_type,amount) VALUES('allocation','payment','UANG_JAJAN','UANG_JAJAN',10000);
 INSERT INTO finance_wallet_ledger(id,santri_id,direction,movement_type,amount,balance_before,balance_after) VALUES('topup','student','IN','TOPUP_CASH',10000,0,10000);`)}
const input={paymentId:'payment',correctionType:'VOID',reason:'Test correction',createdBy:'admin',idempotencyKey:'correction-1',items:[{allocationId:'allocation',amount:5000}]};
async function main(){
 await test('0187 preserves actual pre-remediation wallet schema',()=>{const cols=h.db.prepare('PRAGMA table_info(finance_wallet_ledger)').all().map(x=>x.name);assert(cols.includes('movement_type'));assert(!cols.includes('source'));assert.equal(h.db.prepare('PRAGMA foreign_key_check').all().length,0)});
 const corrections=h.load('lib/finance/corrections.ts');
 await test('A01 correction and wallet roll back at every statement',async()=>{
  for(let i=0;i<8;i++){h.reset();seedWallet();h.fault(i);let failed=false;try{await corrections.recordCorrection(input)}catch(e){assert.match(e.message,/INJECTED_BATCH_FAILURE/);failed=true}
   if(failed){assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_corrections').get().n,0);assert.equal(h.db.prepare('SELECT SUM(CASE direction WHEN \'IN\' THEN amount ELSE -amount END) n FROM finance_wallet_ledger').get().n,10000)}
  }h.fault(-1);
 });
 await test('A01 partial correction sequential replay and collision',async()=>{h.reset();seedWallet();const a=await corrections.recordCorrection(input);const b=await corrections.recordCorrection(input);assert.equal(a.correction.id,b.correction.id);assert.equal(h.db.prepare("SELECT SUM(CASE direction WHEN 'IN' THEN amount ELSE -amount END) n FROM finance_wallet_ledger").get().n,5000);await assert.rejects(()=>corrections.recordCorrection({...input,items:[{allocationId:'allocation',amount:4000}]}),/IDEMPOTENCY_CONFLICT/)});
 await test('A10 read actions reject anonymous',async()=>{const actions=h.load('app/dashboard/keuangan/rekonsiliasi/actions.ts');h.state.session=null;await assert.rejects(()=>actions.getStudentUnpaidObligations('student'),/UNAUTHORIZED/);await assert.rejects(()=>actions.getSettlementDetailAction('x'),/UNAUTHORIZED/);h.state.session={id:'admin',role:'admin',roles:['admin']}});
 await test('A15 database failure is ERROR rather than green',async()=>{const {auditReportService}=h.load('lib/finance/bri/audit-report-service.ts');h.queryFault(true);const r=await auditReportService.verifyFinancialReportInvariants();h.queryFault(false);assert.equal(r.isConsistent,false);assert(r.checks.some(c=>c.status==='ERROR'))});
 const loket=h.load('app/dashboard/koperasi/loket/actions.ts');
 function seedSession(){h.db.exec(`INSERT INTO finance_cash_sessions(id,session_code,operator_id,opened_at,opening_balance,expected_closing_balance) VALUES('session','SES-TEST','admin','2026-10-18T00:00:00Z',50000,50000);`)}
 await test('A02 deposit actual action durable replay/concurrent replay and cash consistency',async()=>{h.reset();seedSession();const req={santriId:'student',idempotencyKey:'deposit-1',items:[{itemType:'UANG_JAJAN',amount:10000}]};const [a,b]=await Promise.all([loket.executeLoketDepositOrPayment(req),loket.executeLoketDepositOrPayment(req)]);assert.equal(a.receiptNumber,b.receiptNumber);assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_wallet_ledger').get().n,1);assert.equal(h.db.prepare("SELECT expected_closing_balance n FROM finance_cash_sessions WHERE id='session'").get().n,60000);assert.equal((await loket.executeLoketDepositOrPayment(req)).receiptNumber,a.receiptNumber);await assert.rejects(()=>loket.executeLoketDepositOrPayment({...req,items:[{itemType:'UANG_JAJAN',amount:5000}]}),/IDEMPOTENCY_CONFLICT/)});
 await test('A02 deposit every critical write rolls back',async()=>{for(let i=0;i<4;i++){h.reset();seedSession();h.fault(i);await assert.rejects(()=>loket.executeLoketDepositOrPayment({santriId:'student',idempotencyKey:'fault',items:[{itemType:'UANG_JAJAN',amount:10000}]}),/INJECTED_BATCH_FAILURE/);assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_wallet_ledger').get().n,0);assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_idempotency_keys').get().n,0)}h.fault(-1)});
 await test('A03 actual distribution action respects disabled flags, draft INSERT guard',async()=>{h.reset();process.env.BRI_DIST_CASH_ENABLED='false';const actions=h.load('app/dashboard/keuangan/penyaluran/actions.ts');await assert.rejects(()=>actions.recordDistributionAction({recipientType:'BENDAHARA',itemType:'SPP',period:'2026-10',amount:10000,method:'CASH',idempotencyKey:'dist',receivingPersonName:'Penerima'}),/dinonaktifkan/);assert.throws(()=>h.db.exec(`INSERT INTO finance_distributions(id,distribution_number,recipient_type,recipient_id,item_type,period,total_amount,method,status) VALUES('unsafe','DIS-UNSAFE','PESANTREN','rec_pesantren','SPP','2026-10',10000,'CASH','DISTRIBUTED')`),/DISTRIBUTION_MUST_START_DRAFT/)});
 await test('A04 public financial proofs blocked; unrelated public assets remain reachable',async()=>{const route=h.load('app/api/file/[...key]/route.ts');h.state.bucket={get:async()=>({body:'image',httpEtag:'test',writeHttpMetadata:()=>{}})};for(const key of [['penyaluran-proofs','old.png'],['proofs','financial','new.png']]){const r=await route.GET(new Request('https://test/api/file'),{params:Promise.resolve({key})});assert.equal(r.status,404);assert.equal(r.headers.get('cache-control'),'no-store')}const asset=await route.GET(new Request('https://test/api/file'),{params:Promise.resolve({key:['foto-santri','public.png']})});assert.equal(asset.status,200)});
 await test('A04 private proof retrieval denies anonymous and unrelated resource',async()=>{const route=h.load('app/api/finance/proofs/[...key]/route.ts');h.state.session=null;assert.equal((await route.GET(new Request('https://test'),{params:Promise.resolve({key:['proofs','financial','x.png']})})).status,404);h.state.session={id:'admin',role:'admin',roles:['admin']};assert.equal((await route.GET(new Request('https://test'),{params:Promise.resolve({key:['proofs','financial','x.png']})})).status,404)});
 await test('A02 withdrawal consumes PIN atomically, concurrent and closed-session replay',async()=>{
  h.reset();seedWallet();seedSession();const token='pin-test',hash=require('node:crypto').createHash('sha256').update(token).digest('hex');
  h.db.prepare("INSERT INTO finance_credentials(id,santri_id,card_token,issued_at) VALUES('card','student','card-token',?)").run(new Date().toISOString());
  h.db.prepare("INSERT INTO finance_pin_authorizations(token_hash,santri_id,operator_id,expires_at,created_at) VALUES(?,'student','admin',?,?)").run(hash,new Date(Date.now()+300000).toISOString(),new Date().toISOString());
  const req={santriId:'student',amount:5000,idempotencyKey:'withdraw',verificationToken:token};
  const [a,b]=await Promise.all([loket.executeLoketWithdrawal(req),loket.executeLoketWithdrawal(req)]);assert.equal(a.receiptNumber,b.receiptNumber);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_wallet_ledger WHERE direction='OUT'").get().n,1);
  assert(h.db.prepare('SELECT consumed_by FROM finance_pin_authorizations').get().consumed_by);
  h.db.exec("UPDATE finance_cash_sessions SET status='CLOSED'");assert.equal((await loket.executeLoketWithdrawal(req)).receiptNumber,a.receiptNumber);
 });
 await test('A02 withdrawal fault never consumes PIN or cash independently',async()=>{
  for(let i=0;i<4;i++){h.reset();seedWallet();seedSession();const hash=require('node:crypto').createHash('sha256').update('pin').digest('hex');
   h.db.prepare("INSERT INTO finance_credentials(id,santri_id,card_token,issued_at) VALUES('card','student','card-token',?)").run(new Date().toISOString());
   h.db.prepare("INSERT INTO finance_pin_authorizations(token_hash,santri_id,operator_id,expires_at,created_at) VALUES(?,'student','admin',?,?)").run(hash,new Date(Date.now()+300000).toISOString(),new Date().toISOString());
   h.fault(i);await assert.rejects(()=>loket.executeLoketWithdrawal({santriId:'student',amount:5000,idempotencyKey:'fault',verificationToken:'pin'}),/INJECTED_BATCH_FAILURE/);
   assert.equal(h.db.prepare('SELECT consumed_by FROM finance_pin_authorizations').get().consumed_by,null);assert.equal(h.db.prepare('SELECT total_cash_out n FROM finance_cash_sessions').get().n,0);
  }h.fault(-1);
 });
 await test('A03 actual cash workflow produces evidence, receipt and one cash effect',async()=>{
  h.reset();seedSession();delete process.env.BRI_DIST_CASH_ENABLED;
  h.db.exec(`INSERT INTO finance_obligations(id,santri_id,item_type,period,amount_expected,amount_paid,status) VALUES('ob','student','SPP','2026-10',20000,20000,'PAID');
   INSERT INTO finance_payments(id,payment_number,santri_id,channel,method,gross_amount,net_amount,paid_at) VALUES('pay','PAY-DIST','student','CASH','CASH',20000,20000,'2026-10-18T00:00:00Z');
   INSERT INTO finance_allocations(id,payment_id,obligation_id,target_type,item_type,amount) VALUES('alloc','pay','ob','OBLIGATION','SPP',20000);`);
  const actions=h.load('app/dashboard/keuangan/penyaluran/actions.ts'),req={recipientType:'BENDAHARA',itemType:'SPP',period:'2026-10',amount:10000,method:'CASH',idempotencyKey:'cash-ok',receivingPersonName:'Penerima resmi'};
  const {data:result}=await actions.recordDistributionAction(req);assert.equal(result.status,'DISTRIBUTED');
  assert.equal((await actions.recordDistributionAction(req)).data.id,result.id);assert.equal(h.db.prepare('SELECT total_cash_out n FROM finance_cash_sessions').get().n,10000);
  assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_cash_manual_evidence WHERE evidence_type='CASH_HANDOVER_RECEIPT'").get().n,1);
  await assert.rejects(()=>actions.recordDistributionAction({...req,idempotencyKey:'overdraw',amount:15000}),/melebihi|mencukupi|tersedia/i);
 });
 console.log(`ALL ${count} REMEDIATION TESTS PASSED`)
}
main().catch(e=>{console.error(e);process.exitCode=1});
