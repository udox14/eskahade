/* eslint-disable @typescript-eslint/no-require-imports -- Read-only assertions against isolated synthetic D1. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const root=path.resolve(__dirname,'../..'),configPath=path.join(root,'wrangler.local-test.jsonc'),config=JSON.parse(fs.readFileSync(configPath));
 assert.ok(config.d1_databases.every(d=>d.remote===false&&d.database_id.startsWith('00000000-')));
 const {getPlatformProxy}=await import('wrangler');
 const proxy=await getPlatformProxy({configPath,persist:{path:path.join(root,'.wrangler/stabilization-local/v3')},envFiles:[]});
 try{
  const db=proxy.env.DB,all=async sql=>(await db.prepare(sql).all()).results;
  assert.ok(await db.prepare("SELECT id FROM santri WHERE id='student' AND nis='99001'").first());
  const payments=await all('SELECT p.id,p.gross_amount,p.status,COALESCE((SELECT SUM(a.amount) FROM finance_allocations a WHERE a.payment_id=p.id),0) AS allocated_amount FROM finance_payments p');
  const allocations=await all('SELECT payment_id,item_type,amount FROM finance_allocations');
  const wallet=await all("SELECT direction,amount,balance_after FROM finance_wallet_ledger WHERE santri_id='student'");
  const distributions=await all('SELECT method,status,total_amount FROM finance_distributions');
  const sessions=await all('SELECT opening_balance,total_cash_in,total_cash_out,expected_closing_balance,actual_closing_balance,status FROM finance_cash_sessions');
  const fk=await all('PRAGMA foreign_key_check');assert.equal(fk.length,0);
  // Cash top-up is a separate wallet ledger movement within the same atomic
  // operation/receipt. Only the school obligation enters finance_payments.
  assert.equal(payments.length,1);assert.equal(payments[0].gross_amount,20000);assert.equal(payments[0].allocated_amount,20000);
  assert.equal(allocations.reduce((s,a)=>s+a.amount,0),20000);assert.equal(allocations.filter(a=>a.item_type==='UANG_JAJAN').length,0);
  assert.equal(wallet.length,1);assert.equal(wallet[0].balance_after,10000);
  assert.equal(distributions.length,1);assert.equal(distributions[0].total_amount,10000);
  assert.equal(sessions[0].expected_closing_balance,120000);
  assert.equal(sessions[0].total_cash_in,payments[0].gross_amount+wallet[0].amount);
  assert.equal(sessions[0].actual_closing_balance,120000);assert.equal(sessions[0].status,'CLOSED');
  const result={generatedAt:new Date().toISOString(),status:'PASS',syntheticOnly:true,remoteMutations:0,payments:payments.map(({id,...p})=>p),allocations:allocations.map(({payment_id,...a})=>a),wallet,distributions,sessions,foreignKeyViolations:fk.length};
  fs.writeFileSync(path.join(root,'output/stabilization-20261019/local-integrity.json'),JSON.stringify(result,null,2));console.log('PASS local payment/allocation/wallet/distribution/cash conservation and foreign keys');
 }finally{await proxy.dispose();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
