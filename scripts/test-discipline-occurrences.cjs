/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const {DatabaseSync}=require('node:sqlite')
const {prepare,migrate}=require('./discipline-fixture.cjs')
const root=path.join(__dirname,'..'),db=new DatabaseSync(':memory:')
db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE santri(id TEXT PRIMARY KEY,nama_lengkap TEXT,nis TEXT,asrama TEXT,kamar TEXT,foto_url TEXT,status_global TEXT,nama_ayah TEXT,alamat TEXT);
 INSERT INTO santri VALUES('s1','Ahmad','001','A','1',NULL,'aktif','Ayah','Alamat'),('s2','Budi','002','B','2',NULL,'aktif','Ayah','Alamat');
 CREATE TABLE kelas(id TEXT PRIMARY KEY,nama_kelas TEXT);INSERT INTO kelas VALUES('k','Kelas');
 CREATE TABLE riwayat_pendidikan(id TEXT PRIMARY KEY,santri_id TEXT,kelas_id TEXT,status_riwayat TEXT);
 INSERT INTO riwayat_pendidikan VALUES('r1','s1','k','aktif'),('r2','s2','k','aktif');`)
prepare(db)
db.exec(`
 INSERT INTO absensi_harian VALUES('a1','r1','2026-09-30','A','A','A',NULL,NULL,NULL);
 INSERT INTO pelanggaran(id,santri_id,tanggal,jenis,deskripsi,poin,created_at) VALUES
 ('general1','s1','2026-09-29','RINGAN','Umum 1',50,'2026-09-29'),
 ('general2','s1','2026-09-29','BERAT','Umum 2',100,'2026-09-29'),
 ('absensi-verifikasi:s1:a1:shubuh|a1:ashar|a1:maghrib','s1','2026-10-01','ALFA_PENGAJIAN','Akumulasi Alfa Pengajian (3 Sesi). Detail: 30 Sep (shubuh), 30 Sep (ashar), 30 Sep (maghrib)',30,'2026-10-01'),
 ('duplicate','s1','2026-10-01','ALFA_PENGAJIAN','Alfa Pengajian. Detail: 2026-09-30 (shubuh)',10,'2026-10-01'),
 ('uncertain','s2','2026-10-01','ALFA_PENGAJIAN','Akumulasi Alfa Pengajian (5 Sesi). Detail: 30 Sep (shubuh)',50,'2026-10-01');
 INSERT INTO pengajian_violations VALUES('general1','s1','Tidur','2026-09-29T23:00:00Z','shubuh','','active','admin','2026-10-01'),
 ('manual2','s1','Kitab','2026-09-30T11:00:00Z','maghrib','Tidak bawa','active','admin','2026-10-01'),
 ('cancelled','s1','Tidur','2026-09-30T11:00:00Z','maghrib','','cancelled','admin','2026-10-01');
 INSERT INTO surat_pernyataan VALUES('old-letter','s1','["general1","duplicate"]','2026-10-01','admin','2026-10-01');
 CREATE TABLE perizinan(id TEXT PRIMARY KEY,santri_id TEXT,status TEXT);
 INSERT INTO perizinan VALUES('i1','s1','AKTIF'),('i2','s1','AKTIF');
 CREATE TABLE perpulangan_log(id TEXT PRIMARY KEY,santri_id TEXT,status_datang TEXT,tgl_datang TEXT,updated_by TEXT);
 INSERT INTO perpulangan_log VALUES('p1','s1','TELAT',NULL,NULL);`)
migrate(db)
let session={id:'admin',roles:['admin'],role:'admin'},race=null
const invalidations=[]
const stubs={
 'next/cache':{revalidatePath(p){invalidations.push(p)},revalidateTag(){}},
 '@/lib/pimpinan/helpers':{currentMonthWib(){return '2026-10'},monthPeriod(month){return {month,from:month+'-01',to:month+'-31'}},safeNumber(n){return Number(n)||0}},
 '@/lib/auth/feature':{async assertFeature(){return session??{error:'Denied'}}},
 '@/lib/auth/session':{async getSession(){return session},getEffectiveRoles(s){return s.roles}},
 '@/lib/activity-log':{actorFromSession(s){return s},async logActivity(){},diffWhitelistedFields(){return {}}},
 '@/lib/absensi/pengajian':{},'@/lib/date/wib':{},
 '@/lib/db':{
  query:async(sql,p=[])=>{assert.ok(p.length<=100,'D1 bind limit');return db.prepare(sql).all(...p)},queryOne:async(sql,p=[])=>{assert.ok(p.length<=100,'D1 bind limit');return db.prepare(sql).get(...p)??null},
  execute:async(sql,p=[])=>{db.prepare(sql).run(...p);return{success:true}},generateId:()=>crypto.randomUUID(),now:()=> '2026-10-01T10:00:00.000Z',
  async batch(statements){if(race){race();race=null}db.exec('BEGIN');try{for(const s of statements)db.prepare(s.sql).run(...s.params??[]);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}
 }
}
const cache=new Map()
function load(name){
 if(stubs[name])return stubs[name]
 if(cache.has(name))return cache.get(name)
 const file=path.join(root,name.replace(/^@\//,'')+'.ts')
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
 const mod={exports:{}};cache.set(name,mod.exports)
 vm.runInThisContext(`(function(require,module,exports){${js}\n})`,{filename:file})(n=>load(n.startsWith('.')?'@/'+path.posix.normalize(path.posix.join(path.posix.dirname(name.slice(2)),n)):n),mod,mod.exports)
 cache.set(name,mod.exports);return mod.exports
}
const data=load('@/lib/discipline/data'),portal=load('@/lib/portal/data'),letters=load('@/app/dashboard/surat-santri/actions'),security=load('@/app/dashboard/keamanan/actions'),review=load('@/app/dashboard/keamanan/history-actions'),final=load('@/app/dashboard/keamanan/verifikasi-panggilan/final-vonis'),late=load('@/lib/discipline/late')
async function run(){
 assert.equal((await data.getIncidentTotals('s1')).jumlah,7)
 assert.equal((await data.getIncidentTotals('s2')).pending,1)
 assert.equal(db.prepare('SELECT poin FROM pelanggaran WHERE id=?').get('general1').poin,50)
 assert.equal(db.prepare("SELECT COUNT(*) n FROM pelanggaran_sessions WHERE source='pengajian'").get().n,3)
 assert.equal(db.prepare("SELECT SUM(jumlah_kejadian) n FROM discipline_incidents WHERE santri_id='s1' AND status='active' AND substr(tanggal,1,7)='2026-09'").get().n,7)
 assert.equal(db.prepare("SELECT COUNT(*) n FROM discipline_incidents WHERE santri_id='s1' AND status='active' AND substr(tanggal,1,7)='2026-10'").get().n,0)
 const evidence=load('@/lib/discipline/evidence')
 assert.deepEqual(evidence.descriptionEvidence('Akumulasi Alfa Pengajian (2 Sesi). Detail: 2026-09-30 (shubuh), 2026-10-01 (ashar)','pengajian'),[{tanggal:'2026-09-30',sesi:'shubuh'},{tanggal:'2026-10-01',sesi:'ashar'}])
 assert.equal(evidence.descriptionEvidence('Akumulasi Alfa Pengajian (3 Sesi). Detail: 2026-09-30 (shubuh)','pengajian').length,0)
 const rows=await data.getStudentIncidents('s1');assert.equal(new Set(rows.map(r=>r.id)).size,rows.length)
 assert.ok(rows.some(r=>r.id==='umum:general1'));assert.ok(rows.some(r=>r.id==='pengajian:general1'))
 assert.equal((await security.getDaftarPelanggar({})).rows[0].jumlah_pelanggaran,7)
 assert.equal((await security.getDetailSantri('s1')).pelanggaran.length,7)
 assert.equal((await security.getDataExportPelanggaran({tanggalMulai:'2026-09-01',tanggalSelesai:'2026-09-30'})).rows.length,7)
 assert.equal((await load('@/lib/pimpinan/disiplin').getDisiplinMonitoring({month:'2026-09'})).total.total,7)
 assert.equal((await letters.getDataPreviewSurat('old-letter','pernyataan')).pelanggaran.length,2)
 await assert.rejects(data.saveIncidentLetter('s2',['umum:general1'],'2026-10-01','admin'))
 await assert.rejects(data.saveIncidentLetter('s1',['pengajian:cancelled'],'2026-10-01','admin'))
 const newId=await data.saveIncidentLetter('s1',['umum:general1','pengajian:general1'],'2026-10-01','admin')
 const snapshot=(await letters.getDataPreviewSurat(newId,'pernyataan')).pelanggaran
 db.prepare("UPDATE pengajian_violations SET note='CHANGED',status='cancelled' WHERE id='general1'").run()
 assert.equal((await security.hapusPelanggaran('umum:general1')).success,true)
 assert.deepEqual((await letters.getDataPreviewSurat(newId,'pernyataan')).pelanggaran,snapshot)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM surat_pernyataan WHERE id=?').get(newId).n,1)
 assert.equal(db.prepare("SELECT COUNT(*) n FROM pelanggaran WHERE id='general1'").get().n,1)
 assert.ok(db.prepare("SELECT COUNT(*) n FROM pelanggaran_revisions WHERE pelanggaran_id='general1'").get().n>0)
 race=()=>db.exec("UPDATE pelanggaran SET status='cancelled' WHERE id='general2'")
 await assert.rejects(data.saveIncidentLetter('s1',['umum:general2'],'2026-10-01','admin'))
 assert.equal(db.prepare('SELECT COUNT(*) n FROM surat_pernyataan').get().n,2)
 for(let i=0;i<225;i++)db.prepare('INSERT INTO pelanggaran(id,santri_id,tanggal,jenis,deskripsi,poin) VALUES(?,?,?,?,?,?)').run('bulk'+i,'s2','2026-09-30','RINGAN','Kasus',99)
 assert.equal((await portal.getPelanggaranAnak('s2')).length,200)
 assert.equal((await portal.getPelanggaranAnak('s2',2)).length,26)
 assert.equal((await portal.getTotalPelanggaranAnak('s2')).jumlah,225)
 assert.equal((await portal.getTotalPelanggaranAnak('s2')).pending,1)
 assert.equal((await data.resolveLetterIncidents('s2',Array.from({length:150},(_,i)=>'umum:bulk'+i))).length,150)
 assert.equal('foto_url' in (await portal.getPelanggaranAnak('s1'))[0],false)
 session={id:'admin',roles:['guru'],role:'guru'}
 assert.equal((await review.getHistoryReviews()).denied,true)
 assert.ok((await review.verifyHistory('uncertain',1,[{tanggal:'2026-09-30',sesi:'shubuh'}],'Bukti hadir')).error)
 session={id:'admin',roles:['admin'],role:'admin'}
 const pending=(await review.getHistoryReviews()).rows.find(r=>r.id==='uncertain');assert.equal(pending.suggestions.length,0)
 assert.ok((await review.verifyHistory('uncertain',pending.version,[{tanggal:'2026-02-30',sesi:'shubuh'}],'Bukti hadir')).error)
 assert.equal((await review.verifyHistory('uncertain',pending.version,[{tanggal:'2026-09-30',sesi:'shubuh'}],'Buku catatan petugas')).success,true)
 assert.equal((await portal.getTotalPelanggaranAnak('s2')).jumlah,226)
 assert.ok((await review.verifyHistory('uncertain',pending.version,[{tanggal:'2026-09-30',sesi:'shubuh'}],'Buku catatan petugas')).error)
 const events=[{source:'pengajian',tanggal:'2026-09-30',sesi:'shubuh'},{source:'berjamaah',tanggal:'2026-09-30',sesi:'isya'}]
 db.prepare('INSERT INTO verifikasi_panggilan VALUES(?,?,?,?,?,?)').run('call','s1','2026-09-30','2026-10-06','DIPANGGIL',JSON.stringify({events}))
 const item={panggilanId:'call',santriId:'s1',periodeAwal:'2026-09-30',periodeAkhir:'2026-10-06',source:'pengajian',tanggal:'2026-09-30',sesi:'shubuh',status:'ALFA'}
 assert.equal((await final.simpanFinalVonis([item])).success,true)
 assert.equal(db.prepare("SELECT COUNT(*) n FROM pelanggaran_sessions WHERE santri_id='s1' AND source='pengajian'").get().n,3)
 assert.equal((await final.simpanFinalVonis([item])).success,true)
 const before=(await data.getIncidentTotals('s1')).jumlah
 assert.equal((await final.simpanFinalVonis([{...item,status:'HADIR',catatan:'Koreksi bukti hadir'}])).success,true)
 assert.equal((await data.getIncidentTotals('s1')).jumlah,before-1)
 assert.equal((await final.simpanFinalVonis([item])).success,true)
 assert.equal((await data.getIncidentTotals('s1')).jumlah,before)
 assert.ok((await final.simpanFinalVonis([{...item,santriId:'s2'}])).error)
 db.exec("CREATE TRIGGER fail_session BEFORE INSERT ON pelanggaran_sessions WHEN NEW.source='berjamaah' BEGIN SELECT RAISE(ABORT,'audit failed');END;")
 await assert.rejects(final.simpanFinalVonis([{...item,source:'berjamaah',sesi:'isya'}]))
 assert.equal(db.prepare("SELECT COUNT(*) n FROM absen_berjamaah").get().n,0)
 assert.equal(db.prepare("SELECT COUNT(*) n FROM pelanggaran WHERE jenis='ALFA_BERJAMAAH'").get().n,0)
 db.exec('DROP TRIGGER fail_session')
 await late.saveLateVerdict({source:'perizinan',id:'i1',santriId:'s1',vonis:'TELAT_MURNI',actor:'admin'})
 await assert.rejects(late.saveLateVerdict({source:'perizinan',id:'i1',santriId:'s1',vonis:'TELAT_MURNI',actor:'admin'}))
 await assert.rejects(late.saveLateVerdict({source:'perizinan',id:'i2',santriId:'s2',vonis:'TELAT_MURNI',actor:'admin'}))
 assert.equal(db.prepare("SELECT COUNT(*) n FROM pelanggaran WHERE id='telat:perizinan:i1'").get().n,1)
 db.exec("CREATE TRIGGER fail_late BEFORE UPDATE ON perpulangan_log BEGIN SELECT RAISE(ABORT,'failed');END;")
 await assert.rejects(late.saveLateVerdict({source:'perpulangan',id:'p1',santriId:'s1',vonis:'TELAT_MURNI',actor:'admin'}))
 assert.equal(db.prepare("SELECT COUNT(*) n FROM pelanggaran WHERE id='telat:perpulangan:p1'").get().n,0)
 // Old template points must be ignored, including invalid values; updates preserve points.
 await security.tambahMasterPelanggaran({kategori:'RINGAN',nama:'Jenis baru'})
 const master=db.prepare('SELECT * FROM master_pelanggaran').get();assert.equal(master.poin,0)
 db.prepare('UPDATE master_pelanggaran SET poin=77 WHERE id=?').run(master.id)
 const imported=await security.importMasterPelanggaranMassal([{kategori:'RINGAN',nama:'Jenis baru',poin:'invalid old column'}]);assert.equal(imported.success,true)
 assert.equal(db.prepare('SELECT poin FROM master_pelanggaran WHERE id=?').get(master.id).poin,77)
 assert.ok(invalidations.includes('/portal-ortu/beranda'))
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0)
 console.log('PASS: migration, 7 incidents, historical points, exact dates, dedup aliases, summaries/export, portal >200, ownership, immutable letters, audit/cancellation, review roles/version, verdict correction/replay, atomic rollback and old Excel templates.')
}
run().catch(e=>{console.error(e);process.exitCode=1})

// Incomplete or contradictory historical evidence must remain pending.
{
 const edge=new DatabaseSync(':memory:');edge.exec("CREATE TABLE santri(id TEXT PRIMARY KEY);INSERT INTO santri VALUES('e');");prepare(edge)
 edge.exec(`INSERT INTO riwayat_pendidikan(id,santri_id) VALUES('r','e');
 INSERT INTO absensi_harian(id,riwayat_pendidikan_id,tanggal) VALUES('a','r','2026-09-30');
 INSERT INTO pelanggaran(id,santri_id,jenis,deskripsi) VALUES
 ('absensi-verifikasi:e:a:shubuh|missing:ashar','e','ALFA_PENGAJIAN',''),
 ('partial-detail','e','ALFA_PENGAJIAN','Akumulasi Alfa Pengajian (2 Sesi). Detail: 2026-09-30 (ashar)'),
 ('partial-verdict','e','ALFA_PENGAJIAN',''),
 ('conflict-a','e','ALFA_BERJAMAAH',''),('conflict-b','e','ALFA_BERJAMAAH','');
 INSERT INTO verifikasi_panggilan_vonis(id,pelanggaran_id,santri_id,source,tanggal,sesi,status_final) VALUES
 ('v1','partial-verdict','e','pengajian','2026-09-30','shubuh','ALFA'),
 ('v2','partial-verdict','e','pengajian','bad-date','ashar','ALFA'),
 ('v3','conflict-a','e','berjamaah','2026-09-30','isya','ALFA'),
 ('v4','conflict-b','e','berjamaah','2026-09-30','isya','HADIR');`)
 migrate(edge)
 assert.equal(edge.prepare("SELECT SUM(jumlah_kejadian) n FROM discipline_incidents WHERE status='active'").get().n,0)
 assert.equal(edge.prepare("SELECT COUNT(*) n FROM pelanggaran WHERE review_state='pending'").get().n,5)
 edge.close();console.log('PASS incomplete attendance, detail count mismatch, incomplete verdict and conflicting evidence')
}

// Round-trip the actual export mapping through the existing XLSX library.
{
 const XLSX=require('xlsx'),ui=fs.readFileSync(path.join(root,'app/dashboard/keamanan/_page-content.tsx'),'utf8')
 const mapping=ui.match(/const rows = res\.rows\.map\(\(row: any, index: number\) => \(\{([\s\S]*?)\}\)\)/)
 assert.ok(mapping,'Actual export mapping available')
 const rows=new Function('res',`return res.rows.map((row,index)=>({${mapping[1]}}))`)({rows:db.prepare("SELECT * FROM discipline_incidents WHERE santri_id='s1' AND status='active'").all()})
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Pelanggaran')
 const decoded=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer'})
 const actual=XLSX.utils.sheet_to_json(decoded.Sheets.Pelanggaran)
 assert.equal(actual.length,rows.length);assert.ok(actual.some(r=>r.Sumber==='Pengajian'))
 assert.ok(actual.every(r=>!Object.keys(r).some(k=>/poin/i.test(k))))
 assert.ok(actual.every(r=>typeof r['Jumlah Kejadian']==='number'))
 console.log('PASS actual XLSX export mapping and workbook round-trip without points')
}
