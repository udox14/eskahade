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
db.exec("ALTER TABLE santri ADD COLUMN foto_url TEXT; UPDATE santri SET foto_url='/api/file/santri-photo.jpg' WHERE id='s1'")
const migration = fs.readFileSync(path.join(root,'migrations/0174_pelanggaran_pengajian.sql'),'utf8')
db.exec(migration)
db.exec(fs.readFileSync(path.join(root,'migrations/0175_pengajian_violation_photos.sql'),'utf8'))
let session = {id:'admin',role:'admin',roles:['admin'],full_name:'Admin'}
let permissions = new Set(['read','create','update','delete'])
let ownClasses = ['a']
const logs=[],errors=[]
const objects=new Map();let failUpload=false,clock=null
const stubs={
 '@opennextjs/cloudflare':{async getCloudflareContext(){return{env:{R2_BUCKET:{async put(key,bytes){if(failUpload)throw new Error('R2 unavailable');objects.set(key,bytes)},async get(key){const bytes=objects.get(key);return bytes?{body:new Blob([bytes]).stream()}:null}}}}}},
 '@/lib/auth/demo-context':{async isDemoRequest(){return session?.roles.includes('demo')??false}},
 'next/cache':{revalidatePath(){},revalidateTag(){}},
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
  now(){return clock??new Date().toISOString()},
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
const {inferSession}=load('@/lib/pengajian-violations/session')
const user=(id,roles)=>{session={id,role:roles[0],roles,full_name:id};permissions=new Set(['read','create','update','delete'])}
const newInput=(santriId='s1',extra={})=>({id:crypto.randomUUID(),requestId:crypto.randomUUID(),santriId,typeId:'terlambat',occurredAt:'2026-09-01T00:10',session:'shubuh',note:'Catatan',...extra})
async function ok(result){const r=await result;assert.equal(r.error,undefined,r.error);return r.data}
async function denied(result,pattern){const r=await result;assert.ok(r.error);if(pattern)assert.match(r.error,pattern);return r}
function revisions(id){return db.prepare('SELECT * FROM pengajian_violation_revisions WHERE violation_id=? ORDER BY id').all(id)}
async function run(){
 for(const [time,expected] of [['03:59',''],['04:00','shubuh'],['07:59','shubuh'],['08:00',''],['14:59',''],['15:00','ashar'],['17:59','ashar'],['18:00','maghrib'],['21:59','maghrib'],['22:00','']])assert.equal(inferSession('2026-09-30T'+time),expected,time)
 assert.equal(inferSession('2026-09-30T04:60'),'');assert.equal(inferSession('invalid'),'')
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
 assert.equal(history.rows.find(r=>r.santri_id==='s1').foto_url,'/api/file/santri-photo.jpg')
 assert.equal((await ok(actions.getRecap())).rows.find(r=>r.santri_id==='s1').foto_url,'/api/file/santri-photo.jpg')
 assert.equal((await ok(actions.getStudentDetail('s1'))).student.foto_url,'/api/file/santri-photo.jpg')
 assert.equal((await ok(actions.searchSantri('Ahmad')))[0].foto_url,'/api/file/santri-photo.jpg')
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
 assert.equal(a.recurring[0].foto_url,'/api/file/santri-photo.jpg')
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
 // Server derives the session from the local UTC+7 time, even for stale client values.
 for(const [time,expected] of [['04:00','shubuh'],['07:59','shubuh'],['15:00','ashar'],['17:59','ashar'],['18:00','maghrib'],['21:59','maghrib']]){
  const input=newInput('s2',{occurredAt:'2026-09-30T'+time,session:'invalid-client-value'});await ok(actions.saveIncident(input));await ok(actions.saveIncident(input))
  assert.equal(db.prepare('SELECT session FROM pengajian_violations WHERE id=?').get(input.id).session,expected)
  const correction={...input,requestId:crypto.randomUUID(),version:1,occurredAt:'2026-09-30T15:30',reason:'Ubah waktu'};await ok(actions.saveIncident(correction))
  assert.equal(JSON.parse(revisions(input.id)[1].after_json).session,'ashar')
 }
 await denied(actions.saveIncident(newInput('s2',{occurredAt:'2026-09-30T08:00',session:''})),/sesi/)
 const manual=newInput('s2',{occurredAt:'2026-09-30T22:00',session:'maghrib'});await ok(actions.saveIncident(manual))
 assert.equal(db.prepare('SELECT session FROM pengajian_violations WHERE id=?').get(manual.id).session,'maghrib')
 // Optional private evidence: bounded upload, retries, ownership, expiry and read scope.
 const photoBytes=new Uint8Array(30),photoView=new DataView(photoBytes.buffer)
 photoBytes.set(Buffer.from('RIFF'),0);photoView.setUint32(4,22,true);photoBytes.set(Buffer.from('WEBPVP8 '),8);photoView.setUint32(16,10,true);photoBytes.set([0x9d,1,0x2a],23);photoView.setUint16(26,640,true);photoView.setUint16(28,480,true)
 const photoForm=(bytes=photoBytes,mime='image/webp')=>{const form=new FormData();form.set('photo',new File([bytes],'foto.webp',{type:mime}));return form}
 clock='2026-09-30T12:00:00.000Z'
 const withPhoto=newInput('s2',{occurredAt:'2026-09-30T23:30'});await ok(actions.saveIncident(withPhoto))
 await denied(actions.attachIncidentPhoto(withPhoto.id,withPhoto.requestId,photoForm(photoBytes,'image/png')),/WebP/)
 await denied(actions.attachIncidentPhoto(withPhoto.id,withPhoto.requestId,photoForm(new Uint8Array(130000))),/120 KB/)
 await denied(actions.attachIncidentPhoto(withPhoto.id,withPhoto.requestId,photoForm(new Uint8Array(30))),/WebP/)
 failUpload=true;await denied(actions.attachIncidentPhoto(withPhoto.id,withPhoto.requestId,photoForm()))
 assert.equal(db.prepare('SELECT state FROM pengajian_violation_photos WHERE violation_id=?').get(withPhoto.id).state,'pending')
 failUpload=false;const uploaded=await ok(actions.attachIncidentPhoto(withPhoto.id,withPhoto.requestId,photoForm()))
 assert.equal(uploaded.expiresAt,'2026-10-30T12:00:00.000Z');assert.equal(objects.size,1)
 await ok(actions.attachIncidentPhoto(withPhoto.id,withPhoto.requestId,photoForm()));assert.equal(objects.size,1)
 await denied(actions.attachIncidentPhoto(withPhoto.id,crypto.randomUUID(),photoForm()),/Foto lain/)
 const changed=photoBytes.slice();changed[20]=2;await denied(actions.attachIncidentPhoto(withPhoto.id,withPhoto.requestId,photoForm(changed)),/Foto lain/)
 assert.ok((await ok(actions.getHistory())).rows.find(r=>r.id===withPhoto.id).evidence_url)
 assert.ok((await ok(actions.getIncidentPhotoKey(withPhoto.id))).key.startsWith('pengajian-evidence/prod/'))
 const photoRoute=load('@/app/api/pengajian-violations/photo/[id]/route'),publicRoute=load('@/app/api/file/[...key]/route')
 const photoResponse=await photoRoute.GET(new Request('https://example.test'),{params:Promise.resolve({id:withPhoto.id})})
 assert.equal(photoResponse.status,200);assert.equal(photoResponse.headers.get('Cache-Control'),'private, no-store');assert.equal((await photoResponse.arrayBuffer()).byteLength,30)
 assert.equal((await publicRoute.GET(new Request('https://example.test'),{params:Promise.resolve({key:['pengajian-evidence','prod','file.webp']})})).status,404)
 user('teacher',['guru']);await denied(actions.getIncidentPhotoKey(withPhoto.id),/cakupan/);await denied(actions.attachIncidentPhoto(withPhoto.id,withPhoto.requestId,photoForm()),/cakupan/)
 user('security',['keamanan']);await ok(actions.getIncidentPhotoKey(withPhoto.id));await denied(actions.attachIncidentPhoto(withPhoto.id,withPhoto.requestId,photoForm()),/milik/)
 user('admin',['admin']);clock='2026-10-30T12:00:00.000Z';await denied(actions.getIncidentPhotoKey(withPhoto.id),/30 hari/);await denied(actions.attachIncidentPhoto(withPhoto.id,withPhoto.requestId,photoForm()),/berakhir/)
 assert.equal((await photoRoute.GET(new Request('https://example.test'),{params:Promise.resolve({id:withPhoto.id})})).status,404)
 assert.equal((await ok(actions.getStudentDetail('s2'))).history.rows.find(r=>r.id===withPhoto.id)?.evidence_url??null,null)
 clock=null
 user('teacher',['guru']);ownClasses=['b'];const teacherPhoto=newInput('s2');await ok(actions.saveIncident(teacherPhoto));await ok(actions.attachIncidentPhoto(teacherPhoto.id,teacherPhoto.requestId,photoForm()));await ok(actions.getIncidentPhotoKey(teacherPhoto.id));ownClasses=[];await denied(actions.getIncidentPhotoKey(teacherPhoto.id),/cakupan/)
 user('admin',['admin','demo']);const demoPhoto=newInput('s2');await ok(actions.saveIncident(demoPhoto));await ok(actions.attachIncidentPhoto(demoPhoto.id,demoPhoto.requestId,photoForm()));assert.ok((await ok(actions.getIncidentPhotoKey(demoPhoto.id))).key.startsWith('pengajian-evidence/demo/'));await denied(actions.getIncidentPhotoKey(teacherPhoto.id),/tidak tersedia/)
 user('admin',['admin'])
 permissions=new Set(['read']);await denied(actions.saveIncident(newInput('s2')));assert.equal((await ok(actions.getCapabilities())).create,false)
 session=null;await denied(actions.getHistory());await denied(actions.getOptions());await denied(actions.getAnalytics())
 assert.throws(()=>query.validateFilters({start:'2026-02-30'}),/Tanggal/)
 assert.ok(logs.length>0)
 assert.equal(errors.length,2,'Only the injected audit and R2 outages should log server errors')
 db.close();console.log('PASS: migration, real action SQL, roles/scope/ownership, validation, idempotency, version conflicts, atomic audit, archive, filters, analytics and pagination.')
}
run().catch(error=>{console.error(error);process.exitCode=1})
