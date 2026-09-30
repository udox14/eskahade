/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness follows existing test scripts. */
/* Execute the real TypeScript Server Actions against isolated SQLite. No remote DB. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { DatabaseSync } = require('node:sqlite')
const root = path.resolve(__dirname, '..')
const db = new DatabaseSync(':memory:')
db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE users(id TEXT PRIMARY KEY,full_name TEXT);
 CREATE TABLE santri(id TEXT PRIMARY KEY,nis TEXT,nama_lengkap TEXT,asrama TEXT,kamar TEXT,jenis_kelamin TEXT,status_global TEXT);
 CREATE TABLE tahun_ajaran(id INTEGER PRIMARY KEY,is_active INTEGER);
 CREATE TABLE kelas(id TEXT PRIMARY KEY,nama_kelas TEXT,tahun_ajaran_id INTEGER);
 CREATE TABLE riwayat_pendidikan(id TEXT PRIMARY KEY,santri_id TEXT,kelas_id TEXT,status_riwayat TEXT);
 CREATE TABLE pelanggaran(id TEXT PRIMARY KEY,jenis TEXT);
 INSERT INTO pelanggaran VALUES('legacy','ALFA_PENGAJIAN');
 CREATE TABLE fitur_akses(id INTEGER PRIMARY KEY,group_name TEXT,title TEXT,href TEXT UNIQUE,icon TEXT,roles TEXT,is_active INTEGER,urutan INTEGER);
 CREATE TABLE role_fitur_crud_permission(fitur_href TEXT,role TEXT,can_create INTEGER,can_update INTEGER,can_delete INTEGER,UNIQUE(fitur_href,role));
 INSERT INTO users VALUES('admin','Admin'),('teacher','Guru'),('other','Guru Lain'),('sekpen','Sekpen'),('security','Keamanan');
 INSERT INTO tahun_ajaran VALUES(1,1),(2,0);
 INSERT INTO kelas VALUES('a','Kelas A',1),('b','Kelas B',1),('old','Kelas Lama',2);
 INSERT INTO santri VALUES('s1','001','Ahmad','A','1','L','aktif'),('s2','002','Budi','B','2','L','aktif'),('s3','003','Citra','A','1','P','aktif');
 INSERT INTO riwayat_pendidikan VALUES('r1','s1','a','aktif'),('r2','s1','a','aktif'),('r3','s2','b','aktif'),('r4','s3','old','selesai');`)
const migration = fs.readFileSync(path.join(root,'migrations/0174_pelanggaran_pengajian.sql'),'utf8')
db.exec(migration)
let session = {id:'admin',role:'admin',roles:['admin'],full_name:'Admin'}
let permissions = new Set(['read','create','update','delete'])
let ownClasses = ['a']
const logs=[],errors=[]
const stubs={
 'next/cache':{revalidatePath(){}},
 '@/lib/auth/feature':{
  async assertFeature(_href,action){return session && permissions.has(action)?session:{error:'Akses ditolak'}},
  async canFeatureForSession(_session,_href,action){return permissions.has(action)},
 },
 '@/lib/auth/session':{getEffectiveRoles(s){return s.roles}},
 '@/lib/akademik/guru-access':{async getOwnKelasIds(){return ownClasses}},
 '@/lib/activity-log':{actorFromSession(s){return s},async logActivity(input){logs.push(input)}},
 '@/lib/db':{
  async query(sql,params=[]){return db.prepare(sql).all(...params)},
  async queryOne(sql,params=[]){return db.prepare(sql).get(...params)??null},
  now(){return new Date().toISOString()},
  async getDB(){return {prepare(sql){return {bind(...params){return {async run(){return {meta:db.prepare(sql).run(...params)}}}}}}}},
  async batch(statements){db.exec('BEGIN');try{for(const s of statements)db.prepare(s.sql).run(...s.params??[]);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}},
 },
}
const modules=new Map()
function load(name){
 if(stubs[name])return stubs[name]
 if(modules.has(name))return modules.get(name)
 const file=path.join(root,name.replace(/^@\//,'')+'.ts')
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
 const mod={exports:{}};modules.set(name,mod.exports)
 vm.runInThisContext(`(function(require,module,exports,console){${source}\n})`,{filename:file})(load,mod,mod.exports,{...console,error(...args){errors.push(args)}})
 modules.set(name,mod.exports);return mod.exports
}
const actions=load('@/app/dashboard/akademik/pelanggaran-pengajian/actions')
const query=load('@/lib/pengajian-violations/query')
const user=(id,roles)=>{session={id,role:roles[0],roles,full_name:id};permissions=new Set(['read','create','update','delete'])}
const newInput=(santriId='s1',extra={})=>({id:crypto.randomUUID(),requestId:crypto.randomUUID(),santriId,typeId:'terlambat',occurredAt:'2026-09-01T00:10',session:'shubuh',note:'Catatan',...extra})
async function ok(result){const r=await result;assert.equal(r.error,undefined,r.error);return r.data}
async function denied(result,pattern){const r=await result;assert.ok(r.error);if(pattern)assert.match(r.error,pattern);return r}
function revisions(id){return db.prepare('SELECT * FROM pengajian_violation_revisions WHERE violation_id=? ORDER BY id').all(id)}
async function run(){
 assert.equal(db.prepare('SELECT COUNT(*) n FROM pengajian_violation_types').get().n,4)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM role_fitur_crud_permission').get().n,5)
 assert.equal(db.prepare('SELECT jenis FROM pelanggaran').get().jenis,'ALFA_PENGAJIAN')
 const first=newInput();await ok(actions.saveIncident(first));await ok(actions.saveIncident(first));assert.equal(revisions(first.id).length,1)
 const other=newInput('s2',{occurredAt:'2026-09-02T08:00',session:'ashar'});await ok(actions.saveIncident(other))
 await denied(actions.saveIncident({...first,note:'Different'}),/telah digunakan/)
 await denied(actions.saveIncident(newInput('s1',{occurredAt:'2026-02-30T12:00'})),/tidak valid/)
 await denied(actions.saveIncident(newInput('s1',{session:'isya'})),/sesi/)
 await denied(actions.saveIncident(newInput('s1',{note:'x'.repeat(2001)})),/panjang/)
 let history=await ok(actions.getHistory());assert.equal(history.total,2)
 assert.equal((await ok(actions.getRecap())).rows[0].count,1) // duplicate rp cannot double the count
 assert.equal((await ok(actions.getHistory({start:'2026-09-01',end:'2026-09-01'}))).total,1)
 assert.equal((await ok(actions.getAnalytics({start:'2026-09-01',end:'2026-09-01'}))).trend[0].key,'2026-09-01')
 assert.equal((await ok(actions.getAnalytics())).weekly[0].key,'2026-08-31')
 await denied(actions.getHistory({start:'2026-09-30',end:'2026-09-01'}),/awal/)
 await denied(actions.getRecap({min:3,max:1}),/minimum/)
 await denied(actions.getHistory({sort:'id;DELETE'}),/Urutan/)
 user('teacher',['guru']);history=await ok(actions.getHistory());assert.equal(history.total,1)
 assert.equal((await ok(actions.getAnalytics())).total,1)
 assert.equal((await ok(actions.getOptions())).actors.some(r=>r.id==='security'),false)
 assert.equal((await ok(actions.getOptions())).classes.length,1)
 await denied(actions.getStudentDetail('s2'),/cakupan/)
 await denied(actions.saveIncident(newInput('s2')),/Santri/)
 await denied(actions.cancelIncident(first.id,1,'Salah',crypto.randomUUID()),/sendiri/)
 await denied(actions.saveType({id:'terlambat',name:'X',description:'',position:1,active:1,version:1}),/sekpen/)
 const own=newInput();await ok(actions.saveIncident(own))
 const correction={...own,requestId:crypto.randomUUID(),version:1,note:'Koreksi',reason:'Salah catatan'}
 await ok(actions.saveIncident(correction));await ok(actions.saveIncident(correction))
 await ok(actions.saveIncident(own)) // retry original request after a later correction
 await denied(actions.saveIncident({...correction,note:'Different'}),/telah digunakan/)
 assert.equal(revisions(own.id).length,2)
 assert.equal(JSON.parse(revisions(own.id)[1].before_json).note,'Catatan')
 await denied(actions.saveIncident({...own,requestId:crypto.randomUUID(),version:1,reason:'Versi lama'}),/berubah/)
 ownClasses=[];assert.equal((await ok(actions.getHistory())).total,0);assert.equal((await ok(actions.getOptions())).classes.length,0);await denied(actions.getStudentDetail('s1'))
 ownClasses=['a'];user('teacher',['guru','pengurus_asrama']);assert.equal((await ok(actions.getHistory())).total,2)
 user('teacher',['guru','keamanan']);assert.equal((await ok(actions.getHistory())).total,3)
 user('sekpen',['sekpen']);assert.equal((await ok(actions.getCapabilities())).manage,true)
 await ok(actions.saveType({id:'terlambat',name:'Terlambat datang',description:'Baru',position:1,active:0,version:1}))
 assert.equal(db.prepare('SELECT type_name FROM pengajian_violations WHERE id=?').get(first.id).type_name,'Terlambat')
 await denied(actions.saveIncident(newInput()),/jenis/)
 user('teacher',['wali_kelas']);await ok(actions.saveIncident({...own,requestId:crypto.randomUUID(),version:2,note:'Koreksi kedua',reason:'Lengkapi catatan'}))
 const cancelRequest=crypto.randomUUID();await ok(actions.cancelIncident(own.id,3,'Kesalahan input',cancelRequest));await ok(actions.cancelIncident(own.id,3,'Kesalahan input',cancelRequest))
 assert.equal(revisions(own.id).length,4)
 assert.equal((await ok(actions.getHistory())).total,1)
 assert.equal((await ok(actions.getHistory({status:'all'}))).total,2)
 assert.equal((await ok(actions.getHistory({status:'cancelled'}))).total,1)
 assert.equal((await ok(actions.getRecap({status:'all'}))).total,1)
 assert.equal((await ok(actions.getAnalytics({status:'cancelled'}))).total,1)
 await denied(actions.cancelIncident(first.id,1,'',crypto.randomUUID()))
 user('admin',['admin']);await ok(actions.saveType({id:'terlambat',name:'Terlambat datang',description:'',position:1,active:1,version:2}))
 const extra=newInput();await ok(actions.saveIncident(extra))
 const recap=await ok(actions.getRecap({min:2,max:2}));assert.equal(recap.total,1);assert.equal(recap.rows[0].count,2)
 const a=await ok(actions.getAnalytics());assert.equal(a.total,3);assert.equal(a.students,2);assert.equal(a.repeat,1);assert.equal(a.classes.find(r=>r.key==='a').count,2)
 assert.equal((await ok(actions.getHistory({gender:'L',asrama:'A',kamar:'1',kelasId:'a',typeId:'terlambat',session:'shubuh',actorId:'admin'}))).total,2)
 const type={id:crypto.randomUUID(),name:'Jenis baru',description:'',position:5,active:1,version:1};await ok(actions.saveType(type));await denied(actions.saveType({...type,id:crypto.randomUUID()}),/sudah digunakan/)
 // Archive keeps the original santri row: existing history persists; new entries rejected.
 db.prepare("UPDATE santri SET status_global='arsip' WHERE id='s1'").run()
 assert.equal((await ok(actions.getStudentDetail('s1'))).history.total,2)
 await denied(actions.saveIncident(newInput()),/aktif/)
 assert.equal((await ok(actions.searchSantri('Ahmad'))).length,0)
 assert.throws(()=>db.prepare("DELETE FROM users WHERE id='teacher'").run(),/FOREIGN KEY/)
 // Audit write failure must roll back the incident mutation.
 db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON pengajian_violation_revisions BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;")
 const failure=newInput('s2');await denied(actions.saveIncident(failure));assert.equal(db.prepare('SELECT COUNT(*) n FROM pengajian_violations WHERE id=?').get(failure.id).n,0)
 db.exec('DROP TRIGGER fail_audit')
 db.exec("UPDATE santri SET asrama=NULL WHERE id='s2'")
 assert.equal((await ok(actions.getHistory({asrama:'__unassigned__'}))).total,1)
 assert.equal((await ok(actions.getAnalytics())).dorms.find(r=>r.key==='__unassigned__').count,1)
 // Pagination remains bounded, with deterministic tie ordering.
 for(let i=0;i<34;i++)await ok(actions.saveIncident(newInput('s2')))
 const p1=await ok(actions.getHistory({sort:'time',direction:'asc'},1));const p2=await ok(actions.getHistory({sort:'time',direction:'asc'},2));assert.equal(p1.rows.length,30);assert.ok(p2.rows.length>0);assert.equal(new Set([...p1.rows,...p2.rows].map(r=>r.id)).size,p1.rows.length+p2.rows.length)
 permissions=new Set(['read']);await denied(actions.saveIncident(newInput('s2')));assert.equal((await ok(actions.getCapabilities())).create,false)
 session=null;await denied(actions.getHistory());await denied(actions.getOptions());await denied(actions.getAnalytics())
 assert.throws(()=>query.validateFilters({start:'2026-02-30'}),/Tanggal/)
 assert.ok(logs.length>0)
 assert.equal(errors.length,1,'Only the injected audit outage should log a server error')
 db.close();console.log('PASS: migration, real action SQL, roles/scope/ownership, validation, idempotency, version conflicts, atomic audit, archive, filters, analytics and pagination.')
}
run().catch(error=>{console.error(error);process.exitCode=1})
