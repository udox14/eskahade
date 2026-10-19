/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic fixture preparation using actual finance engines. */
const fs=require('node:fs'),path=require('node:path');
async function main(){
  const root=path.resolve(__dirname,'../..'),configPath=path.join(root,'wrangler.local-test.jsonc');
  const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
  if(config.d1_databases.some(d=>d.remote!==false||!d.database_id.startsWith('00000000-')))throw Error('Local isolation assertion failed');
  const {getPlatformProxy}=await import('wrangler');
  const proxy=await getPlatformProxy({configPath,persist:{path:path.join(root,'.wrangler/stabilization-local/v3')},envFiles:[]});
  const h=require('../finance-remediation-fixture.cjs').harness();
  try{
    const target=proxy.env.DB;
    if(!(await target.prepare("SELECT id FROM santri WHERE id='student' AND nis='99001' AND nama_lengkap='Santri Sintetis student'").first()))throw Error('Synthetic identity missing');
    require('./core-d1-adapter.cjs').attach(h,target);h.state.session={id:'local-admin',role:'admin',roles:['admin']};
    // Schema-only snapshots omit migration seed rows. Restore this dictionary
    // entry only in the verified synthetic database; bank methods stay disabled.
    await target.prepare("INSERT OR IGNORE INTO finance_distribution_recipients(id,recipient_type,name,is_active,allowed_methods,created_by) VALUES('rec_pesantren','PESANTREN','Pesantren Sintetis',1,'BRI_QLOLA,CASH,MANUAL_TRANSFER','local-admin')").run();
    await target.prepare("INSERT OR IGNORE INTO finance_recipient_allowed_methods(recipient_id,method) VALUES('rec_pesantren','CASH')").run();
    // Deliberately different dummy credentials on the matching DEMO_DB admin
    // identity reproduce the historical cross-dataset login escalation safely.
    const demo=proxy.env.DEMO_DB;
    if(!await demo.prepare("SELECT id FROM users WHERE id='local-admin' AND email='admin@fixture.test'").first())throw Error('Synthetic demo admin missing');
    const dummyHash=await h.load('lib/auth/password.ts').hashPassword('DemoImpostor!2026');
    await demo.prepare("UPDATE users SET password_hash=? WHERE id='local-admin'").bind(dummyHash).run();
    const cards=h.load('lib/finance/cards.ts'),pins=h.load('lib/finance/pins.ts');
    if(!await cards.getActiveCard('student'))await cards.issueCard('student','local-admin');
    if(!(await pins.getStudentPinStatus('student')).hasPin)await pins.setStudentPin('student','123456','local-admin');
    const tariffs=h.load('lib/finance/tariffs.ts');
    if(!await h.adapter.queryOne("SELECT id FROM finance_tariffs WHERE item_type='SPP'"))await tariffs.createTariff({item_type:'SPP',academic_year_id:1,nominal:20000,effective_from:'2026-10-01',created_by:'local-admin'});
    await h.load('lib/finance/fund-management.ts').setKoperasiEffectiveTimestamp('2026-10-01T00:00:00Z','local-admin');
    const obligation=await h.load('lib/finance/obligations.ts').ensureObligation('student','SPP','2026-10');
    const again=await h.load('lib/finance/obligations.ts').ensureObligation('student','SPP','2026-10');
    if(again.id!==obligation.id)throw Error('Obligation replay mismatch');
    fs.writeFileSync(path.join(root,'output/stabilization-20261019/finance-fixture-evidence.json'),JSON.stringify({engine:'actual tariff/card/PIN/obligation services over LOCAL D1',syntheticOnly:true,obligationCreated:true,idempotentObligationReplay:true,amount:obligation.amount_expected,period:obligation.period,remoteMutations:0},null,2));
    console.log('Synthetic card, PIN and obligation prepared through actual services; obligation replay matched.');
  }finally{h.db.close();await proxy.dispose();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
