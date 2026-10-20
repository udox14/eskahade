/* eslint-disable @typescript-eslint/no-require-imports -- Read-only native D1 verification of final synthetic browser flow. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const root=path.resolve(__dirname,'../../..'),out=path.join(root,'output/autonomous-delivery-20261020'),{getPlatformProxy}=await import('wrangler'),report={syntheticOnly:true,remoteMutations:0,results:[]};
 for(const mode of ['production','sandbox']){
  const configPath=path.join(out,'preview-'+mode+'.json'),config=JSON.parse(fs.readFileSync(configPath));assert.ok(config.d1_databases.every(d=>d.remote===false&&d.database_id.startsWith('00000000-')));
  const persist=path.join(root,'.wrangler',mode==='production'?'delivery-production':'delivery-recovery','v3'),proxy=await getPlatformProxy({configPath,persist:{path:persist},envFiles:[]});
  try{
   const db=proxy.env.DB,all=async(sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
   const payments=await all("SELECT gross_amount,status FROM finance_payments WHERE santri_id='student'"),allocations=await all("SELECT a.item_type,a.amount FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id WHERE p.santri_id='student'"),wallet=await all("SELECT direction,amount,balance_after FROM finance_wallet_ledger WHERE santri_id='student'"),sessions=await all("SELECT opening_balance,total_cash_in,total_cash_out,expected_closing_balance,actual_closing_balance,status FROM finance_cash_sessions WHERE operator_id='local-admin'");
   if(mode==='production'){assert.equal(payments.length,0);assert.equal(allocations.length,0);assert.equal(wallet.length,0);assert.equal(sessions.length,0);}
   else{
    assert.equal(payments.length,1);assert.equal(payments[0].gross_amount,20000);assert.equal(payments[0].status,'PAID');assert.equal(allocations.length,1);assert.equal(allocations[0].item_type,'SPP');assert.equal(allocations[0].amount,20000);
    assert.equal(wallet.length,1);assert.equal(wallet[0].direction,'IN');assert.equal(wallet[0].amount,10000);assert.equal(wallet[0].balance_after,10000);
    assert.equal(sessions.length,1);const s=sessions[0];assert.equal(s.opening_balance,100000);assert.equal(s.total_cash_in,30000);assert.equal(s.total_cash_out,0);assert.equal(s.expected_closing_balance,130000);assert.equal(s.actual_closing_balance,130000);assert.equal(s.status,'CLOSED');
    const mismatch=await db.prepare("SELECT gross_amount,(SELECT SUM(amount) FROM finance_allocations WHERE payment_id=p.id) allocated FROM finance_payments p WHERE id='synthetic-mismatch'").first();assert.equal(mismatch.gross_amount,800000);assert.equal(mismatch.allocated,3800000);
    assert.equal((await db.prepare("SELECT COUNT(*) n FROM finance_distribution_items WHERE id LIKE 'historical-dist-item-%'").first()).n,21);
    assert.equal((await db.prepare("SELECT status FROM finance_distributions WHERE id='historical-distribution-21'").first()).status,'PENDING_APPROVAL');report.knownMismatchPreserved=mismatch;
   }
   const fk=await all('PRAGMA foreign_key_check');assert.equal(fk.length,0);
   for(const table of ['finance_payments','finance_allocations','finance_wallet_ledger','finance_cash_sessions'])assert.equal((await db.prepare("PRAGMA quick_check('"+table+"')").first()).quick_check,'ok');
   report.results.push({mode,status:'PASS',payments,allocations,wallet,sessions,foreignKeyViolations:0,coreTableQuickChecks:'PASS'});
  }finally{await proxy.dispose();}
 }
 report.passed=report.results.length;report.failed=0;fs.writeFileSync(path.join(out,'final-native-postflight.json'),JSON.stringify(report,null,2));console.log('PASS sandbox browser money conservation, old mismatch/reservations, zero production synthetic postings, native FK/core integrity');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
