/* eslint-disable @typescript-eslint/no-require-imports -- D1 native recovery rehearsal with synthetic history only. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const fixture=require('./recovery-fixture.cjs');
async function main(){
 const {root,objects,q,read}=fixture,out=path.resolve(process.env.ESKAHADE_EVIDENCE_DIR||fixture.out),configPath=path.resolve(process.env.ESKAHADE_LOCAL_CONFIG||path.join(root,'wrangler.local-test.jsonc')),config=JSON.parse(fs.readFileSync(configPath));
 assert.ok(config.d1_databases.every(d=>d.remote===false&&d.database_id.startsWith('00000000-')));
 const persistPath=path.resolve(process.env.ESKAHADE_LOCAL_RECOVERY_PERSIST||path.join(root,'.wrangler/sandbox-recovery-candidate/v3'));
 const {getPlatformProxy}=await import('wrangler');const proxy=await getPlatformProxy({configPath,persist:{path:persistPath},envFiles:[]});
 const baseline=fixture.create(),snapshot=fixture.historicalSnapshot(baseline),plan=read('recovery-plan.json'),results=[];
 const passwordSalt=Buffer.from('recovery-synthetic-only'),passwordHash=passwordSalt.toString('hex')+':'+crypto.pbkdf2Sync('LocalFixture!2026',passwordSalt,100000,32,'sha256').toString('hex');
 const h=require('../finance-remediation-fixture.cjs').harness();
 try{
  for(const binding of ['DB','DEMO_DB']){
   const target=proxy.env[binding];if(await target.prepare("SELECT name FROM sqlite_schema WHERE name='users'").first())throw Error('Refusing to overwrite existing recovery fixture '+binding);
   for(const type of ['table','index','view'])for(const o of objects.filter(o=>o.type===type&&o.sql))await target.prepare(o.sql).run();
   const rows=[];
   for(const o of objects.filter(o=>o.type==='table'))for(const row of baseline.prepare('SELECT * FROM '+q(o.name)).all()){const keys=Object.keys(row);rows.push(target.prepare(`INSERT INTO ${q(o.name)}(${keys.map(q).join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).bind(...Object.values(row)));}
   await target.batch([target.prepare('PRAGMA defer_foreign_keys=ON'),...rows]);
   for(const o of objects.filter(o=>o.type==='trigger'&&o.sql))await target.prepare(o.sql).run();
   for(const s of plan.stages){
    if(s.order===2){
     const schemaBefore=JSON.stringify((await target.prepare("SELECT name,sql FROM sqlite_schema ORDER BY name").all()).results);
     const attempt=[...s.statements.slice(0,12),'SELECT * FROM deliberately_missing_native_recovery;',...s.statements.slice(12)];
     await assert.rejects(target.batch(attempt.map(sql=>target.prepare(sql))));
     assert.equal(JSON.stringify((await target.prepare("SELECT name,sql FROM sqlite_schema ORDER BY name").all()).results),schemaBefore);
     results.push({binding,test:'D1 batch injected failure rolls back DDL and migration stamp',status:'PASS'});
    }
    await target.batch(s.statements.map(sql=>target.prepare(sql)));results.push({binding,stage:s.file,status:'PASS',statements:s.statements.length});
   }
   for(const [name,b] of Object.entries(snapshot).filter(([,s])=>s.rows.length)){
    const now=(await target.prepare('SELECT '+b.columns.map(q).join(',')+' FROM '+q(name)).all()).results.map(r=>JSON.stringify(r));
    for(const row of b.rows)assert.ok(now.includes(row),'Historical row changed: '+name);
   }
   assert.equal((await target.prepare('PRAGMA foreign_key_check').all()).results.length,0);
   results.push({binding,test:'Native old rows/roles/money preserved; FK check',status:'PASS'});
   await assert.rejects(target.batch(plan.stages[0].statements.map(sql=>target.prepare(sql))));
   results.push({binding,test:'Recorded migration replay refused',status:'PASS'});
   // These users and accounts exist only in local all-zero bindings.
   const insert=async(sql,...params)=>target.prepare(sql).bind(...params).run();
   for(const role of ['admin','demo','tester','bendahara','admin_koperasi','petugas_koperasi','pimpinan','guru','wali_kelas','pengurus_asrama','sekpen','keamanan','dewan_santri','poskestren']){
    let hash=passwordHash;
    if(binding==='DEMO_DB'&&role==='admin')hash=passwordSalt.toString('hex')+':'+crypto.pbkdf2Sync('DemoImpostor!2026',passwordSalt,100000,32,'sha256').toString('hex');
    await insert('INSERT INTO users(id,email,password_hash,full_name,role,roles,asrama_binaan) VALUES(?,?,?,?,?,?,?)','local-'+role,role+'@fixture.test',hash,'Fixture '+role,role,JSON.stringify([role]),'AL-FALAH');
   }
   await insert("INSERT INTO tahun_ajaran(id,nama,is_active) VALUES(1,'2026/2027',1)");await insert("INSERT INTO marhalah(id,nama,urutan) VALUES(1,'Ibtidaiyyah',1)");
   await insert("INSERT INTO data_guru(id,nama_lengkap,kode_guru) VALUES(1,'Guru Sintetis','TEST-1')");await insert("INSERT INTO kelas(id,tahun_ajaran_id,marhalah_id,nama_kelas,jenis_kelamin,wali_kelas_id,guru_shubuh_id) VALUES('local-kelas',1,1,'Ibtidaiyyah 1A','L','local-wali_kelas',1)");
   for(const [id,nis,asrama,kategori] of [['student','99001','AL-FALAH','REGULER'],['other','99002','BAHAGIA','REGULER'],['exempt','99003','AL-BAGHORY','REGULER'],['sadesa','99004','SADESA','SADESA']]){
    await insert('INSERT INTO santri(id,nis,nama_lengkap,jenis_kelamin,asrama,kamar,kategori_santri) VALUES(?,?,?,?,?,?,?)',id,nis,'Santri Sintetis '+id,'L',asrama,'1',kategori);
    await insert("INSERT INTO riwayat_pendidikan(id,santri_id,kelas_id,status_riwayat) VALUES(?,?,?,'aktif')",'riwayat-'+id,id,'local-kelas');
    await insert('INSERT INTO portal_ortu_credentials(santri_id,password_hash,must_change_password,is_active) VALUES(?,?,0,1)',id,passwordHash);
   }
   require('./core-d1-adapter.cjs').attach(h,target);h.state.session={id:'local-admin',role:'admin',roles:['admin']};
    await h.load('lib/finance/cards.ts').issueCard('student','local-admin');await h.load('lib/finance/pins.ts').setStudentPin('student','123456','local-admin');
    await h.load('lib/finance/tariffs.ts').createTariff({item_type:'SPP',academic_year_id:1,nominal:20000,effective_from:'2026-10-01',created_by:'local-admin'});
    await h.load('lib/finance/fund-management.ts').setKoperasiEffectiveTimestamp('2026-10-01T00:00:00Z','local-admin');
    await h.load('lib/finance/obligations.ts').ensureObligation('student','SPP','2026-10');
   await assert.rejects(target.prepare("INSERT INTO finance_wallet_ledger(id,santri_id,direction,movement_type,amount,balance_before,balance_after) VALUES('bad-native-wallet','student','IN','TOPUP_CASH',1000,0,999)").run(),/INVALID_BALANCE_AFTER/);
   results.push({binding,test:'Actual card/PIN/tariff/obligation engines and wallet guard on repaired demo D1',status:'PASS'});
  }
  fs.writeFileSync(path.join(out,'native-d1-recovery.json'),JSON.stringify({generatedAt:new Date().toISOString(),engine:'LOCAL Cloudflare workerd D1 batch; fresh actual demo schema then 0192–0195, not a production-schema replacement',passed:results.length,failed:0,results,syntheticOnly:true,remoteMutations:0,persistPath,knownSyntheticConservationCases:1},null,2));
  console.log('PASS '+results.length+' native D1 recovery checks; both isolated bindings initialized');
 }finally{h.db.close();baseline.close();await proxy.dispose();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
