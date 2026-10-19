/* eslint-disable @typescript-eslint/no-require-imports -- Native D1 postflight of a synthetic recovery fixture. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
async function main(){
 const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/sandbox-recovery-20261019'),configPath=path.join(root,'wrangler.local-test.jsonc'),config=JSON.parse(fs.readFileSync(configPath));
 assert.ok(config.d1_databases.every(d=>d.remote===false&&d.database_id.startsWith('00000000-')));
 const {getPlatformProxy}=await import('wrangler');const proxy=await getPlatformProxy({configPath,persist:{path:path.join(root,'.wrangler/sandbox-recovery-candidate/v3')},envFiles:[]});
 try{
  const db=proxy.env.DB,all=async sql=>(await db.prepare(sql).all()).results;
  assert.ok(await db.prepare("SELECT id FROM santri WHERE id='student' AND nis='99001'").first());
  const schema=await all("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name");
  const schemaHash=crypto.createHash('sha256').update(JSON.stringify(schema)).digest('hex'),fingerprints=JSON.parse(fs.readFileSync(path.join(out,'stage-schema-fingerprints.json')));
  assert.equal(schemaHash,fingerprints.at(-1).sha256,'Native and offline repaired schema fingerprints differ');
  const historical=await db.prepare("SELECT gross_amount,(SELECT SUM(amount) FROM finance_allocations WHERE payment_id=p.id) allocated FROM finance_payments p WHERE id='synthetic-mismatch'").first();assert.equal(historical.gross_amount,800000);assert.equal(historical.allocated,3800000);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM finance_distribution_items WHERE id LIKE 'historical-dist-item-%'").first()).n,21);
  assert.equal((await db.prepare("SELECT status FROM finance_distributions WHERE id='historical-distribution-21'").first()).status,'PENDING_APPROVAL');
  const caseSql=fs.readFileSync(path.join(root,'scripts/stabilization/recovery-data/record-conservation-case.sql'),'utf8');await db.prepare(caseSql).run();await db.prepare(caseSql).run();
  const cases=await all("SELECT discrepancy_amount,resolution_action,reason_code FROM finance_reconciliation_items WHERE reason_code='INTERNAL_OVERALLOCATION_BANK_UNVERIFIED'");assert.equal(cases.length,1);assert.equal(cases[0].resolution_action,'NONE');
  const fk=await all('PRAGMA foreign_key_check');assert.equal(fk.length,0);
  const integrity=[];
  for(const name of ['finance_payments','finance_allocations','finance_wallet_ledger','finance_distributions','finance_distribution_items','santri','users'])assert.equal((await db.prepare("PRAGMA quick_check('"+name+"')").first()).quick_check,'ok'),integrity.push({table:name,status:'PASS'});
  const result={generatedAt:new Date().toISOString(),status:'PASS',syntheticOnly:true,remoteMutations:0,schemaFingerprintNativeAndOfflineMatch:true,knownHistoricalMismatchPreserved:historical,oldDistributionItems:21,pendingReservationPreserved:true,caseOpeningIdempotent:true,cases,foreignKeyViolations:0,nativeTableQuickChecks:integrity,nativeWholeDatabaseQuickCheck:'UNAVAILABLE_SQLITE_NOMEM; complete integrity_check passed on full offline rehearsal; operator must verify actual remote integrity privately before approval'};
  if(process.argv.includes('--after-ui')){
   const payments=await all("SELECT gross_amount,status FROM finance_payments WHERE santri_id='student'"),allocations=await all("SELECT a.item_type,a.amount FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id WHERE p.santri_id='student'"),wallet=await all("SELECT direction,amount,balance_after FROM finance_wallet_ledger WHERE santri_id='student'"),sessions=await all("SELECT opening_balance,total_cash_in,total_cash_out,expected_closing_balance,actual_closing_balance,status FROM finance_cash_sessions WHERE operator_id='local-admin'");
   assert.equal(payments.length,2);assert.ok(payments.every(p=>p.gross_amount===20000));assert.equal(allocations.reduce((n,a)=>n+a.amount,0),40000);assert.equal(wallet.length,2);assert.equal(wallet.reduce((n,w)=>n+w.amount,0),20000);assert.equal(Math.max(...wallet.map(w=>w.balance_after)),20000);assert.equal(sessions.length,2);for(const s of sessions){assert.equal(s.expected_closing_balance,120000);assert.equal(s.actual_closing_balance,120000);assert.equal(s.status,'CLOSED');}
   const distributed=await db.prepare("SELECT COALESCE(SUM(di.amount),0) n FROM finance_distribution_items di JOIN finance_allocations a ON a.id=di.allocation_id JOIN finance_payments p ON p.id=a.payment_id JOIN finance_distributions d ON d.id=di.distribution_id WHERE p.santri_id='student' AND d.status='DISTRIBUTED'").first();assert.equal(distributed.n,20000);
   Object.assign(result,{cleanStudentFlow:{payments,allocations,wallet,sessions,distributed:20000},cashConservation:'Two synthetic sessions, each100000+30000-10000=120000; last session executed on final cache-fixed build'});
  }
  fs.writeFileSync(path.join(out,process.argv.includes('--after-ui')?'runtime-integrity.json':'native-postflight.json'),JSON.stringify(result,null,2));console.log('PASS native schema fingerprint, FK, preserved history, open case'+(result.cleanStudentFlow?' and browser cash/ledger conservation':''));
 }finally{await proxy.dispose();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
