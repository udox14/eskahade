/* eslint-disable @typescript-eslint/no-require-imports */
// Real server actions, SQL triggers, instrument and queue against isolated SQLite.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const {DatabaseSync}=require('node:sqlite'),{webcrypto}=require('node:crypto')
const db=new DatabaseSync(':memory:'),root=path.resolve(__dirname,'..')
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE users(id TEXT PRIMARY KEY,full_name TEXT);
CREATE TABLE tahun_ajaran(id INTEGER PRIMARY KEY,nama TEXT,is_active INTEGER);
CREATE TABLE data_guru(id INTEGER PRIMARY KEY,nama_lengkap TEXT,gelar TEXT);
CREATE TABLE kelas(id TEXT PRIMARY KEY,nama_kelas TEXT,tahun_ajaran_id INTEGER,guru_shubuh_id INTEGER,guru_ashar_id INTEGER,guru_maghrib_id INTEGER);
CREATE TABLE fitur_akses(id INTEGER PRIMARY KEY,group_name TEXT,title TEXT,href TEXT UNIQUE,icon TEXT,roles TEXT,is_active INTEGER,urutan INTEGER);
CREATE TABLE sidebar_groups(group_name TEXT PRIMARY KEY,label TEXT,urutan INTEGER,is_active INTEGER);
CREATE TABLE user_fitur_override(user_id TEXT,fitur_id INTEGER,action TEXT,UNIQUE(user_id,fitur_id));
INSERT INTO users VALUES('admin','Admin'),('a','Petugas A'),('b','Petugas B'),('c','Koordinator'),('sekpen','Sekpen');
INSERT INTO tahun_ajaran VALUES(1,'2026/2027',1),(2,'2025/2026',0);
INSERT INTO data_guru VALUES(1,'Guru Satu',NULL),(2,'Guru Dua',NULL),(3,'Guru Jadwal',NULL);
INSERT INTO kelas VALUES('k1','Kelas A',1,1,2,1),('k2','Kelas B',1,1,2,1),('old','Kelas Lama',2,1,NULL,NULL);`)
const migration=fs.readFileSync(path.join(root,'migrations/0179_supervisi.sql'),'utf8');db.exec(migration);db.exec(migration)
db.exec(`INSERT INTO user_fitur_override SELECT 'a',id,'grant' FROM fitur_akses;INSERT INTO user_fitur_override SELECT 'b',id,'grant' FROM fitur_akses;INSERT INTO user_fitur_override SELECT 'c',id,'grant' FROM fitur_akses;INSERT INTO supervisi_user_permission VALUES('c',1);`)
let session={id:'admin',full_name:'Admin',roles:['admin'],role:'admin'}
function as(id,roles=['sekpen']){session=id?{id,full_name:id,roles,role:roles[0]}:null}
const assignments=[{id:1,tahun_ajaran_id:1,kelas_id:'k1',sesi:'shubuh',hari_index:null,guru_id:1,kitab_id:1,kitab_nama:'Kitab A',mapel_nama:'Mapel A',is_active:1,source:'manual'}, {id:2,tahun_ajaran_id:1,kelas_id:'k2',sesi:'ashar',hari_index:2,guru_id:2,kitab_id:2,kitab_nama:'Kitab B',mapel_nama:'Mapel B',is_active:1,source:'manual'}]
const stubs={
 '@/lib/db':{
  async query(sql,p=[]){return db.prepare(sql).all(...p)},
  async queryOne(sql,p=[]){return db.prepare(sql).get(...p)??null},
  async execute(sql,p=[]){db.prepare(sql).run(...p);return{success:true}},
  async batch(list){db.exec('BEGIN');try{for(const s of list)db.prepare(s.sql).run(...s.params??[]);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}},
  async getDB(){return {prepare(sql){return {bind(...p){return {async run(){const r=db.prepare(sql).run(...p);return {meta:{changes:r.changes}}}}}}}}},
 },
 '@/lib/auth/session':{async getSession(){return session},getEffectiveRoles(s){return s?.roles??[]},isAdmin(s){return s?.roles.includes('admin')??false},isDemoSandboxRequest(s){return s?.demoSandbox===true}},
 '@/lib/akademik/guru-kitab':{async getGuruKitabAssignments(year){return assignments.filter(a=>a.tahun_ajaran_id===year)}},
 '@/lib/akademik/guru-jadwal':{GURU_JADWAL_SESSIONS:['shubuh','ashar','maghrib'],HARI_INDEX_LABEL:{0:'Ahad',1:'Sen',2:'Sel',3:'Rab',4:'Kam',5:'Jum',6:'Sab'},async getWeeklyGuruRules(){return[{kelas_id:'k2',sesi:'maghrib',hari_index:1,guru_id:3}]},buildWeeklyGuruRuleMap(r){return new Map(r.map(x=>[`${x.kelas_id}|${x.sesi}|${x.hari_index}`,x]))},resolveGuruForHariIndex(k,d,m){return Object.fromEntries(['shubuh','ashar','maghrib'].map(s=>[s,{id:m.get(`${k.id}|${s}|${d}`)?.guru_id??k[`guru_${s}_id`]}]))}},
 'next/cache':{revalidatePath(){}},'@/lib/activity-log':{actorFromSession(s){return s},async logActivity(){}},
}
const modules=new Map()
function load(name){if(stubs[name])return stubs[name];if(modules.has(name))return modules.get(name).exports;const file=path.join(root,name.replace(/^@\//,'')+'.ts'),mod={exports:{}};modules.set(name,mod);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(source,{exports:mod.exports,module:mod,require:load,crypto:webcrypto,console:{error(){}},setTimeout,clearTimeout},{filename:file});return mod.exports}
const actions=load('@/app/dashboard/sekpen/supervisi/actions'),instrument=load('@/lib/supervisi/instrument'),{AutosaveQueue}=load('@/lib/supervisi/autosave')
let checks=0;function check(v){assert.ok(v);checks++}
async function main(){
 check(instrument.ITEMS.length===53);check(instrument.ITEMS.filter(i=>i.kind==='score').length===28)
 check(!instrument.isAnswered(instrument.ITEMS[0],{unknown:true,note:''}));check(instrument.isAnswered(instrument.ITEMS[0],{unknown:true,note:'Tidak ada pengalaman'}))
 assert.throws(()=>instrument.normalizeAnswers({s1:{score:5}}));assert.throws(()=>instrument.normalizeAnswers({bad:{text:'x'}}));assert.throws(()=>instrument.normalizeAnswers({d1:{text:'x'.repeat(10001)}}))
 const created=await actions.createActivity('Supervisi Oktober',1,[1,2,3]);check(created.ok);const activity=created.data
 const candidates=await actions.getTeacherCandidates(1);check(candidates.length===3);check(candidates.find(t=>t.id===1).kelas.length===2);check(candidates.find(t=>t.id===3).contexts.length===0)
 check((await actions.updateActivityTargets(activity,[1,2])).ok);check((await actions.changeActivityStatus(activity,'terbuka',1)).ok)
 check(!(await actions.updateActivityTargets(activity,[1])).ok)
 assert.throws(()=>db.prepare('DELETE FROM supervisi_target WHERE kegiatan_id=?').run(activity))
 as('sekpen');await assert.rejects(actions.getSupervisiHome());as(null);await assert.rejects(actions.getSupervisiHome());as('a',['tester']);await assert.rejects(actions.getSupervisiHome());as('a',['demo']);await assert.rejects(actions.getSupervisiHome())
 as('a');const key=candidates.find(t=>t.id===1).contexts[0].key
 check(!(await actions.startInterview(activity,1,'forged','2026-10-05')).ok)
 check(!(await actions.startInterview(activity,1,key,'2026-02-30')).ok)
 const started=await actions.startInterview(activity,1,key,'2026-10-05');check(started.ok);const id=started.data
 const same=await actions.startInterview(activity,1,key,'2026-10-05');check(same.ok&&same.data===id)
 as('b');check(!(await actions.startInterview(activity,1,key,'2026-10-05')).ok);await assert.rejects(actions.getInterview(id));const cov=await actions.getCoverage(activity);check(cov.rows.find(r=>r.guru_id===1).interview_id===null);check(!JSON.stringify(cov).includes('owner_id'))
 check(!(await actions.saveInterview({id,revision:0,operationId:'b',patch:{s1:{score:4}}})).ok)
 as('a');const p={id,revision:0,operationId:'first',patch:{s1:{score:4}}};const saved=await actions.saveInterview(p);check(saved.ok&&saved.data.revision===1);const replay=await actions.saveInterview(p);check(replay.ok&&replay.data.replayed);check(db.prepare('SELECT COUNT(*) n FROM supervisi_history WHERE wawancara_id=?').get(id).n===2)
 check(!(await actions.saveInterview({...p,operationId:'stale'})).ok)
 check(!(await actions.saveInterview({id,revision:1,operationId:'empty-date',patch:{},tanggal:''})).ok)
 check(!(await actions.saveInterview({id,revision:1,operationId:'incomplete',patch:{},action:'submit'})).ok)
 as('c');check((await actions.getInterview(id)).editable);check((await actions.saveInterview({id,revision:1,operationId:'coordinator',patch:{s2:{unknown:true,note:'Tidak diketahui'}}})).ok)
 const full=Object.fromEntries(instrument.ITEMS.map(i=>[i.id,i.kind==='score'?{score:3}:{text:'Tidak ada temuan tambahan.'}]));full.s2={unknown:true,note:'Tidak dapat dinilai'}
 as('a');check((await actions.saveInterview({id,revision:2,operationId:'complete',patch:full,action:'submit'})).ok)
 check(!(await actions.saveInterview({id,revision:3,operationId:'locked',patch:{s1:{score:1}}})).ok)
 check(!(await actions.saveInterview({id,revision:3,operationId:'reopen-denied',patch:{},action:'reopen',reason:'Koreksi'})).ok)
 const personal=await actions.getSupervisiAnalytics(activity);check(personal.count===1);check(personal.sections[0].rated===2);check(personal.sections[0].unknown===1);check(personal.sections[0].average===3)
 as('b');check((await actions.getSupervisiAnalytics(activity)).count===0)
 as('admin',['admin']);check(!(await actions.saveInterview({id,revision:3,operationId:'no-reason',patch:{},action:'reopen'})).ok)
 check((await actions.saveInterview({id,revision:3,operationId:'reopen',patch:{},action:'reopen',reason:'Koreksi hasil wawancara'})).ok)
 const act=await actions.getSupervisiHome();check((await actions.changeActivityStatus(activity,'ditutup',act.activities[0].revision)).ok)
 check(!(await actions.saveInterview({id,revision:4,operationId:'closed',patch:{s1:{score:1}}})).ok)
 const closed=await actions.getSupervisiHome();check(!(await actions.changeActivityStatus(activity,'terbuka',closed.activities[0].revision)).ok);check((await actions.changeActivityStatus(activity,'terbuka',closed.activities[0].revision,'Koreksi')).ok)
 db.prepare("UPDATE data_guru SET nama_lengkap='Nama baru' WHERE id=1").run();check((await actions.getInterview(id)).identity.guru_nama==='Guru Satu')
 assert.throws(()=>db.prepare('DELETE FROM supervisi_wawancara WHERE id=?').run(id));assert.throws(()=>db.prepare('UPDATE supervisi_history SET action=? WHERE wawancara_id=?').run('tamper',id))
 db.prepare("UPDATE user_fitur_override SET action='revoke' WHERE user_id='a'").run();as('a');await assert.rejects(actions.getInterview(id));check(!(await actions.saveInterview({id,revision:4,operationId:'revoked',patch:{s1:{score:1}}})).ok)
 as('b');check(!(await actions.setSupervisiUserPermission('b',true)).ok);as('admin',['admin']);check((await actions.setSupervisiUserPermission('b',true)).ok);as('b');check((await actions.getInterview(id)).editable)
 // In-flight changes, ambiguous network failure, same operation retry, and explicit conflict resolution.
 let release,requests=[];const q=new AutosaveQueue('q',0,async p=>{requests.push(structuredClone(p));if(requests.length===1)return await new Promise(r=>release=r);return{ok:true,data:{revision:p.revision+1,replayed:false}}},()=>{})
 q.edit('s1',{score:1});const saving=q.flush();q.edit('s1',{score:4});check(q.saving);release({ok:true,data:{revision:1,replayed:false}});check(await saving);check(requests.length===2&&requests[1].patch.s1.score===4&&q.revision===2&&!q.dirty)
 let failure=true,ops=[];const retry=new AutosaveQueue('retry',0,async p=>{ops.push(p.operationId);if(failure){failure=false;throw Error('network')}return{ok:true,data:{revision:1,replayed:true}}},()=>{});retry.edit('s1',{score:3});check(!await retry.flush());check(retry.dirty);check(await retry.flush());check(ops[0]===ops[1])
 let conflict=true;const cq=new AutosaveQueue('conflict',0,async p=>conflict?{ok:false,error:'CONFLICT: changed'}:{ok:true,data:{revision:p.revision+1,replayed:false}},()=>{});cq.edit('s1',{score:2});check(!await cq.flush());check(cq.conflict);cq.edit('d1',{text:'Local'});cq.rebase(5);conflict=false;check(await cq.flush());check(cq.revision===6)
 // Parallel requests share the same observed revision; exactly one CAS may commit.
 const live=await actions.getInterview(id),parallel=await Promise.all([actions.saveInterview({id,revision:live.revision,operationId:'parallel-one',patch:{s3:{score:1}}}),actions.saveInterview({id,revision:live.revision,operationId:'parallel-two',patch:{s3:{score:4}}})]);check(parallel.filter(r=>r.ok).length===1)
 const noScores=instrument.summarize([Object.fromEntries(instrument.ITEMS.filter(i=>i.kind==='score').map(i=>[i.id,{unknown:true,note:'Tidak dapat dinilai'}]))]);check(noScores.every(s=>s.average===null&&s.rated===0))
 check(!(await actions.updateInterviewIdentity(id,(await actions.getInterview(id)).revision,1,key)).ok)
 as('admin',['admin']);const correction=await actions.createActivity('Koreksi identitas',1,[1,2]);check(correction.ok);check((await actions.changeActivityStatus(correction.data,'terbuka',0)).ok)
 as('b');const blank=await actions.startInterview(correction.data,1,key,'2026-10-05');check(blank.ok)
 const secondKey=candidates.find(t=>t.id===2).contexts[0].key
 check((await actions.updateInterviewIdentity(blank.data,0,2,secondKey)).ok)
 const moved=await actions.getInterview(blank.data);check(moved.guru_id===2&&moved.identity.kitab_nama==='Kitab B');check((await actions.getCoverage(correction.data)).rows.find(r=>r.guru_id===1).status==='belum')
 check(!(await actions.updateInterviewIdentity(blank.data,0,1,key)).ok)
 check((await actions.saveInterview({id:blank.data,revision:1,operationId:'answer-lock',patch:{s1:{score:3}}})).ok)
 check(!(await actions.updateInterviewIdentity(blank.data,2,1,key)).ok)
 const identityHistory=db.prepare("SELECT before_json,after_json FROM supervisi_history WHERE wawancara_id=? AND action='identity'").get(blank.data);check(JSON.parse(identityHistory.before_json).guru_id===1&&JSON.parse(identityHistory.after_json).guru_id===2)
 console.log(`Supervisi: ${checks} assertions passed; authorization, lifecycle, CAS/idempotency, history, analytics and autosave queue.`)
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.close())
