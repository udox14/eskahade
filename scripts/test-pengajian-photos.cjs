/* eslint-disable @typescript-eslint/no-require-imports -- Isolated SQLite harness. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const {DatabaseSync}=require('node:sqlite')
const root=path.resolve(__dirname,'..'),cache=new Map()
function load(name){
 if(cache.has(name))return cache.get(name)
 const file=path.join(root,name.replace(/^@\//,'')+'.ts'),loadedModule={exports:{}}
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
 vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename:file})(dep=>load(dep.startsWith('.')?'@/'+path.posix.join(path.posix.dirname(name.slice(2)),dep):dep),loadedModule,loadedModule.exports)
 cache.set(name,loadedModule.exports);return loadedModule.exports
}
const {validateEvidenceWebP,PHOTO_RETENTION_MS,PHOTO_MAX_BYTES}=load('@/lib/pengajian-violations/photo')
const {cleanupEvidencePhotos}=load('@/lib/pengajian-violations/photo-cleanup')
function header(width=640,height=480){const bytes=new Uint8Array(30);const set=(offset,value)=>bytes.set(Buffer.from(value,'binary'),offset);const view=new DataView(bytes.buffer);set(0,'RIFF');view.setUint32(4,22,true);set(8,'WEBP');set(12,'VP8 ');view.setUint32(16,10,true);set(23,'\x9d\x01\x2a');view.setUint16(26,width,true);view.setUint16(28,height,true);return bytes}
async function run(){
 validateEvidenceWebP(header());assert.throws(()=>validateEvidenceWebP(header(961)),/Dimensi/)
 assert.throws(()=>validateEvidenceWebP(new Uint8Array(PHOTO_MAX_BYTES+1)),/WebP/)
 const bad=header();bad[0]=0;assert.throws(()=>validateEvidenceWebP(bad),/WebP/)
 const truncated=header().slice(0,29);assert.throws(()=>validateEvidenceWebP(truncated),/WebP/)
 const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON; CREATE TABLE pengajian_violations(id TEXT PRIMARY KEY); INSERT INTO pengajian_violations VALUES('expired'),('pending'),('recent'),('future'),('foreign'),('boundary');")
 db.exec(fs.readFileSync(path.join(root,'migrations/0175_pengajian_violation_photos.sql'),'utf8'))
 const timestamp='2026-09-30T10:00:00.000Z',created=new Date(Date.parse(timestamp)-PHOTO_RETENTION_MS).toISOString()
 const insert=db.prepare('INSERT INTO pengajian_violation_photos VALUES(?,?,?,?,?,?,?,?,NULL)')
 for(const [id,expiry,state,namespace] of [['expired','2026-09-30T09:59:59.000Z','attached','prod'],['pending',timestamp,'pending','prod'],['recent','2026-10-01T10:00:00.000Z','attached','prod'],['future','2026-10-30T10:00:00.000Z','attached','prod'],['foreign',timestamp,'attached','demo'],['boundary',timestamp,'attached','prod']])insert.run(id,id,`pengajian-evidence/${namespace}/${id}.webp`,'hash',100,created,expiry,state)
 const adapter={prepare(sql){return{bind(...params){return{async all(){return{results:db.prepare(sql).all(...params)}},async run(){return db.prepare(sql).run(...params)}}}}}}
 const deleted=[],bucket={async delete(key){if(key.endsWith('/expired.webp'))throw new Error('Injected R2 outage');deleted.push(key)}}
 let result=await cleanupEvidencePhotos(adapter,bucket,'prod',timestamp);assert.equal(result.deleted,2);assert.equal(result.failed,2)
 assert.equal(db.prepare("SELECT state FROM pengajian_violation_photos WHERE violation_id='expired'").get().state,'attached')
 assert.equal(db.prepare("SELECT state FROM pengajian_violation_photos WHERE violation_id='boundary'").get().state,'deleted')
 assert.equal(deleted.some(key=>key.includes('recent')||key.includes('future')||key.includes('/demo/')),false)
 bucket.delete=async key=>deleted.push(key);result=await cleanupEvidencePhotos(adapter,bucket,'prod',timestamp);assert.equal(result.deleted,1)
 result=await cleanupEvidencePhotos(adapter,bucket,'demo',timestamp);assert.equal(result.deleted,1)
 result=await cleanupEvidencePhotos(adapter,bucket,'prod',timestamp);assert.equal(result.deleted,0)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM pengajian_violations').get().n,6)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM pengajian_violation_photos').get().n,6)
 db.prepare("DELETE FROM pengajian_violations WHERE id='future'").run()
 assert.equal(db.prepare("SELECT violation_id FROM pengajian_violation_photos WHERE request_id='future'").get().violation_id,null)
 result=await cleanupEvidencePhotos(adapter,bucket,'prod','2026-10-30T10:00:00.000Z');assert.equal(result.deleted,2)
 db.close();console.log('PASS: WebP validation, photo migration, exact 30-day boundary, active/expired/pending photos, namespace isolation, R2 failure/retry and incident preservation.')
}
run().catch(error=>{console.error(error);process.exitCode=1})
