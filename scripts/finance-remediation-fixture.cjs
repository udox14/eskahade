// Actual finance migration SQL, not hand-written finance tables. No remote access.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite'); const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function createDatabase(through=189,seed=true){
 const db=new DatabaseSync(':memory:');
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE users(id TEXT PRIMARY KEY,full_name TEXT,username TEXT,role TEXT,roles TEXT,email TEXT,password_hash TEXT);
 CREATE TABLE santri(id TEXT PRIMARY KEY,nis TEXT,nama_lengkap TEXT,status_global TEXT DEFAULT 'aktif',asrama TEXT,kamar TEXT,
   tempat_makan_id TEXT,tempat_mencuci_id TEXT,kategori_santri TEXT,jenis_kelamin TEXT DEFAULT 'L',foto_url TEXT,
   kelas_sekolah TEXT,saldo_uang_jajan INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT);
 CREATE TABLE master_jasa(id TEXT PRIMARY KEY,nama_jasa TEXT,jenis TEXT,created_at TEXT);
 CREATE TABLE tahun_ajaran(id INTEGER PRIMARY KEY,nama TEXT,is_active INTEGER);
 CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT);
 CREATE TABLE fitur_akses(id INTEGER PRIMARY KEY,group_name TEXT,title TEXT,href TEXT UNIQUE,icon TEXT,roles TEXT,is_active INTEGER,urutan INTEGER);
 `);
 db.exec(`INSERT INTO tahun_ajaran VALUES(2,'2026/2027',1);`);
 if(seed)db.exec(`
 INSERT INTO users(id,full_name,role,roles) VALUES('admin','Admin','admin','["admin"]'),('cashier','Kasir','petugas_koperasi','["petugas_koperasi"]'),('viewer','Pimpinan','pimpinan','["pimpinan"]');
 INSERT INTO master_jasa(id,nama_jasa,jenis) VALUES('provider-meal','Katering','Makan'),('provider-wash','Laundry','Cuci');
 INSERT INTO santri(id,nis,nama_lengkap,asrama,kategori_santri,tempat_makan_id,tempat_mencuci_id) VALUES('student','1001','Santri','ASRAMA A','REGULER','provider-meal','provider-wash'),('other','1002','Lain','ASRAMA B','REGULER',NULL,NULL);`);
 const numbers=[152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,171,172,173,182,183,184,185,186,187,188,189];
 for(const n of numbers.filter(n=>n<=through)) {
  const name=fs.readdirSync(path.join(root,'migrations')).find(f=>f.startsWith(String(n).padStart(4,'0')+'_'));
  try{db.exec(fs.readFileSync(path.join(root,'migrations',name),'utf8'))}catch(e){throw new Error(`Migration ${name}: ${e.message}`,{cause:e})}
 }
 db.exec('PRAGMA foreign_keys=ON');return db;
}
function harness(){
 let db=createDatabase(); let failAt=-1; let failQuery=false;
 const state={session:{id:'admin',role:'admin',roles:['admin'],full_name:'Admin'},feature:true,bucket:null};
 const adapter={
 query:async(sql,p=[])=>{if(failQuery)throw new Error('INJECTED_QUERY_FAILURE');return db.prepare(sql).all(...p)},
 queryOne:async(sql,p=[])=>{if(failQuery)throw new Error('INJECTED_QUERY_FAILURE');return db.prepare(sql).get(...p)||null},
 execute:async(sql,p=[])=>{db.prepare(sql).run(...p);return{success:true}},
 batch:async ss=>{state.lastBatchLength=ss.length;db.exec('BEGIN');try{for(let i=0;i<ss.length;i++){if(i===failAt)throw new Error('INJECTED_BATCH_FAILURE');db.prepare(ss[i].sql).run(...(ss[i].params||[]))}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}},
 generateId:()=>crypto.randomUUID(),now:()=>new Date().toISOString(),today:()=>new Date().toISOString().slice(0,10)};
 const original=Module._load;
 Module._load=function(request,parent,main){
  if(request==='@/lib/db')return adapter;
  if(request==='@/lib/auth/session')return{getSession:async()=>state.session,getEffectiveRoles:s=>s?.roles||[],isDemoSandboxRequest:s=>s?.role==='demo',hasFinanceMutateRole:(roles,demo)=>roles.some(r=>['admin','bendahara','admin_koperasi','petugas_koperasi'].includes(r))||(demo&&roles.includes('demo'))};
  if(request==='@/lib/auth/feature')return{canAccessFeatureForSession:async()=>state.feature};
  if(request==='next/headers')return{cookies:async()=>({get:()=>state.cookieToken?{value:state.cookieToken}:undefined})};
  if(request==='@opennextjs/cloudflare')return{getCloudflareContext:async()=>({env:state.environment==='sandbox'?{ESKAHADE_ENV:'sandbox',R2_BUCKET:state.bucket,DB:state.demoDB,DEMO_DB:state.demoDB}:{ESKAHADE_ENV:'production',R2_BUCKET:state.bucket,DB:state.productionDB}})};
  if(request.startsWith('@/'))request=path.join(root,request.slice(2));return original.call(this,request,parent,main);
 };
 require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
 return {get db(){return db},state,adapter,reset:()=>{db.close();db=createDatabase();failAt=-1;failQuery=false},fault:i=>{failAt=i},queryFault:b=>{failQuery=b},openFile:file=>{db.close();db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON')},load:p=>require(path.join(root,p))};
}
module.exports={createDatabase,harness};
