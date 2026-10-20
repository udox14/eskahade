/* eslint-disable @typescript-eslint/no-require-imports -- Actual historical production DDL, synthetic rows, no pending migrations. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'output/autonomous-delivery-20261020'),dir=path.join(out,'production-hotfix');
async function main(){
 const assetDir=path.join(dir,'assets');fs.mkdirSync(assetDir,{recursive:true});
 const config={name:'eskahade-hotfix-local-only',preview_urls:false,main:path.join(dir,'worker.js'),compatibility_date:'2025-04-01',compatibility_flags:['nodejs_compat'],assets:{directory:assetDir,binding:'ASSETS'},services:[{binding:'WORKER_SELF_REFERENCE',service:'eskahade-hotfix-local-only'}],d1_databases:[{binding:'DB',database_name:'synthetic-actual-production-ddl',database_id:'00000000-0000-0000-0000-000000000003',remote:false}],kv_namespaces:[{binding:'NEXT_INC_CACHE_KV',id:'00000000000000000000000000000003',remote:false}],r2_buckets:[{binding:'R2_BUCKET',bucket_name:'synthetic-hotfix-media',remote:false}],vars:{JWT_SECRET:'synthetic-shared-secret-tests-realm-isolation',BRI_ENV:'sandbox',BRI_OUTBOUND_ENABLED:'false',BRI_BRIVA_OUTBOUND_ENABLED:'false',BRI_BRIVA_INBOUND_ENABLED:'false',BRI_STATEMENT_SYNC_ENABLED:'false'}};
 const configPath=path.join(dir,'preview.json');fs.writeFileSync(configPath,JSON.stringify(config,null,2));
 const persist=path.join(root,'.wrangler/delivery-hotfix/v3');
 const {getPlatformProxy}=await import('wrangler');const proxy=await getPlatformProxy({configPath,persist:{path:persist},envFiles:[]});
 try{
  const db=proxy.env.DB;if(await db.prepare("SELECT name FROM sqlite_schema WHERE name='users'").first()){console.log('Existing synthetic hotfix fixture preserved');return;}
  const raw=JSON.parse(fs.readFileSync(path.join(root,'output/stabilization-20261019/production-schema-readonly.json'),'utf8').replace(/^\uFEFF/,''))[0].results;
  const virtual=raw.filter(x=>/CREATE VIRTUAL TABLE/.test(x.sql||'')).map(x=>x.name),objects=raw.filter(x=>x.sql&&!virtual.some(n=>x.name.startsWith(n+'_')));
  for(const type of ['table','index','view','trigger'])for(const o of objects.filter(x=>x.type===type))await db.prepare(o.sql).run();
  const salt=Buffer.from('actual-schema-hotfix-only'),hash=salt.toString('hex')+':'+crypto.pbkdf2Sync('LocalFixture!2026',salt,100000,32,'sha256').toString('hex');
  for(const role of ['admin','guru','demo','tester'])await db.prepare('INSERT INTO users(id,email,password_hash,full_name,role,roles,asrama_binaan) VALUES(?,?,?,?,?,?,?)').bind('local-'+role,role+'@fixture.test',hash,'Fixture '+role,role,JSON.stringify([role]),'AL-FALAH').run();
  await db.prepare("INSERT INTO tahun_ajaran(id,nama,is_active) VALUES(1,'2026/2027',1)").run();
  await db.prepare("INSERT INTO santri(id,nis,nama_lengkap,jenis_kelamin,asrama,kamar,kategori_santri) VALUES('student','99001','Santri Sintetis student','L','AL-FALAH','1','REGULER')").run();
  await db.prepare('INSERT INTO portal_ortu_credentials(santri_id,password_hash,must_change_password,is_active) VALUES(?,?,0,1)').bind('student',hash).run();
  const [features,permissions]=JSON.parse(fs.readFileSync(path.join(root,'output/stabilization-20261019/production-feature-config-readonly.json'),'utf8'));
  for(const [table,rows]of [['fitur_akses',features.results],['role_fitur_crud_permission',permissions.results]])for(const row of rows){const keys=Object.keys(row);await db.prepare(`INSERT OR REPLACE INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).bind(...Object.values(row)).run();}
  const fk=(await db.prepare('PRAGMA foreign_key_check').all()).results;if(fk.length)throw Error('Synthetic fixture FK');
  fs.writeFileSync(path.join(out,'hotfix-fixture.json'),JSON.stringify({source:'Historical actual production schema-only snapshot',productionSnapshotFile:'output/stabilization-20261019/production-schema-readonly.json',objects:objects.length,pendingMigrationsApplied:[],nativeD1:true,foreignKeyViolations:0,syntheticOnly:true,latestSchemaRevalidation:'BLOCKED Cloudflare7403',remoteMutations:0},null,2));console.log('Prepared hotfix LOCAL D1 on production DDL, zero pending migrations');
 }finally{await proxy.dispose();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
