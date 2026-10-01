/* eslint-disable @typescript-eslint/no-require-imports -- Existing SQLite server-action harness pattern. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { DatabaseSync } = require('node:sqlite')
const root = path.resolve(__dirname, '..')
const db = new DatabaseSync(':memory:')
db.exec(`
 CREATE TABLE santri(id TEXT PRIMARY KEY,nis TEXT,nama_lengkap TEXT,asrama TEXT,kamar TEXT,status_global TEXT,kategori_santri TEXT);
 CREATE TABLE kelas(id TEXT PRIMARY KEY,nama_kelas TEXT,marhalah_id TEXT);
 CREATE TABLE riwayat_pendidikan(id TEXT PRIMARY KEY,santri_id TEXT,kelas_id TEXT,status_riwayat TEXT);
 CREATE TABLE absensi_harian(id TEXT PRIMARY KEY,riwayat_pendidikan_id TEXT,tanggal TEXT,created_at TEXT,shubuh TEXT,ashar TEXT,maghrib TEXT,verif_shubuh TEXT,verif_ashar TEXT,verif_maghrib TEXT);
 CREATE TABLE pelanggaran(id TEXT PRIMARY KEY,santri_id TEXT,tanggal TEXT,jenis TEXT,deskripsi TEXT,poin INTEGER,penindak_id TEXT);
 CREATE TABLE absensi_verifikasi_periode(tanggal_mulai TEXT,tanggal_selesai TEXT,status TEXT);
 INSERT INTO kelas VALUES('k','Ibtidaiyyah 1-1','m');
 INSERT INTO santri VALUES('s1','001','Ahmad','A','1','aktif','REGULER'),('s2','001','Budi','B','2','aktif','SADESA');
 INSERT INTO riwayat_pendidikan VALUES('r1','s1','k','aktif'),('r2','s2','k','aktif');
`)
require('./discipline-fixture.cjs').prepare(db)
require('./discipline-fixture.cjs').migrate(db)
let session = { id: 'admin', roles: ['admin'] }
let race = null
const logs = []
const stubs = {
 '@/lib/auth/feature': { async assertFeature() { return session || { error: 'Akses ditolak' } } },
 '@/lib/auth/session': { async getSession() { return session }, hasRole(s, role) { return s.roles.includes(role) } },
 '@/lib/cache/master': { async getCachedMarhalahList() { return [] } },
 '@/lib/activity-log': { actorFromSession(s) { return s }, async logActivity(entry) { logs.push(entry) } },
 'next/cache': { revalidatePath() {}, revalidateTag() {} },
 '@/lib/db': {
  async query(sql, params = []) { return db.prepare(sql).all(...params) },
  async queryOne(sql, params = []) { return db.prepare(sql).get(...params) },
  async execute(sql, params = []) { db.prepare(sql).run(...params) },
  generateId() { return crypto.randomUUID() }, now() { return new Date().toISOString() },
  async batch(statements) {
   if (race) { race(); race = null }
   db.exec('BEGIN')
   try {
    for (const s of statements) db.prepare(s.sql).run(...(s.params || []))
    db.exec('COMMIT')
   } catch (error) { db.exec('ROLLBACK'); throw error }
  },
 },
}
const cache = new Map()
function load(name) {
 if (stubs[name]) return stubs[name]
 if (cache.has(name)) return cache.get(name)
 const filename = path.join(root, name.startsWith('@/') ? name.slice(2) + '.ts' : name)
 const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
 const exports = {}
 cache.set(name, exports)
 vm.runInNewContext(`(function(require,exports){${code}\n})`, { console, Date, Map, Set, Intl, Error })(load, exports)
 return exports
}
const helper = load('@/lib/absensi/pemanggilan')
const cetak = load('app/dashboard/akademik/absensi/cetak/actions.ts')
const verif = load('app/dashboard/akademik/absensi/verifikasi/actions.ts')
function insert(id, tanggal, verifStatus = null, riwayat = 'r1', created = '2026-09-30 17:30:00', status = 'A') {
 db.prepare('INSERT INTO absensi_harian VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, riwayat, tanggal, created, status, 'H', 'H', verifStatus, null, null)
}
function payload(id, tanggal, vonis = 'KESALAHAN', santriId = 's1', status_verif = null) {
 return { santriId, vonis, items: [{ absen_id: id, tanggal, sesi: 'shubuh', status_verif }] }
}
async function run() {
 assert.deepEqual(JSON.parse(JSON.stringify(helper.getAbsensiWeek('2026-09-30'))), { start: '2026-09-30', end: '2026-10-06' })
 assert.equal(helper.getAbsensiWeek('2026-10-06').start, '2026-09-30')
 assert.equal(helper.getAbsensiWeek('2026-10-07').start, '2026-10-07')
 assert.throws(() => helper.getAbsensiWeek('2026-02-30'))
 assert.equal(helper.tanggalInputWib('2026-09-30 16:59:59'), '30/09/2026')
 assert.equal(helper.tanggalInputWib('2026-09-30T17:00:00Z'), '01/10/2026')
 insert('old', '2026-01-07', 'BELUM')
 insert('last', '2026-09-23', 'BELUM')
 insert('current', '2026-09-30')
 insert('current2', '2026-10-01', null, 'r1', '2026-09-29 17:30:00')
 insert('resolved', '2026-09-24', 'OK')
 insert('unmarked-old', '2026-09-25')
 insert('future', '2026-10-07', 'BELUM')
 insert('not-alfa', '2026-09-26', 'BELUM', 'r1', '2026-09-30 17:30:00', 'S')
 insert('sadesa', '2026-09-30', null, 'r2')
 const rows = await cetak.getRekapAlfaMingguan('2026-09-30')
 assert.equal(rows.length, 4)
 const current = rows.find(r => r.santri_id === 's1' && r.pekan.start === '2026-09-30')
 assert.equal(current.total, 2)
 assert.equal(current.kelas, 'Ibtidaiyyah 1-1')
 assert.equal(helper.tanggalInputWib(current.tanggal_input), '30/09/2026')
 const only = await cetak.getRekapAlfaMingguan('2026-09-30', true)
 assert.equal(only.length, 2)
 assert.ok(only.some(r => r.pekan.start === '2026-01-07'))
 assert.equal((await verif.getAntrianVerifikasi('2026-09-30', { kategori: 'REGULER' })).length, 1)
 assert.equal((await verif.getAntrianVerifikasi('2026-09-30', { kategori: 'SADESA' }))[0].santri_id, 's2')
 assert.equal((await verif.getAntrianVerifikasi('2026-09-30', { kategori: 'SADESA', asrama: 'A' })).length, 0)
 assert.ok((await verif.simpanVerifikasiMassal([payload('old','2026-01-07')], '2026-09-30')).error)
 assert.ok((await verif.simpanVerifikasiMassal([payload('current','2026-09-30'), payload('sadesa','2026-09-30','KESALAHAN','s2')])).error)
 assert.equal((await verif.simpanVerifikasiMassal([payload('current','2026-09-30','KESALAHAN','s2')], '2026-09-30')).code, 'STALE')
 assert.equal((await verif.simpanVerifikasiMassal([payload('current','2026-09-30','BOGUS')], '2026-09-30')).error, 'Data vonis tidak valid')
 session = null
 assert.ok((await verif.simpanVerifikasiMassal([payload('current','2026-09-30')], '2026-09-30')).error)
 await assert.rejects(cetak.getRekapAlfaMingguan('2026-09-30'))
 session = { id: 'teacher', roles: ['pengajar'] }
 assert.ok((await verif.simpanVerifikasiMassal([payload('current','2026-09-30')], '2026-09-30')).error)
 session = { id: 'admin', roles: ['admin'] }
 race = () => db.prepare("UPDATE absensi_harian SET verif_shubuh='OK' WHERE id='sadesa'").run()
 assert.equal((await verif.simpanVerifikasiMassal([payload('current','2026-09-30'), payload('sadesa','2026-09-30','KESALAHAN','s2')], '2026-09-30')).code, 'STALE')
 assert.equal(db.prepare("SELECT shubuh FROM absensi_harian WHERE id='current'").get().shubuh, 'A')
 assert.equal((await verif.simpanVerifikasiMassal([payload('current','2026-09-30','ALFA_MURNI')], '2026-09-30')).success, true)
 assert.equal((await verif.simpanVerifikasiMassal([payload('current','2026-09-30','ALFA_MURNI')], '2026-09-30')).code, 'STALE')
 assert.equal(db.prepare('SELECT count(*) n FROM pelanggaran').get().n, 1)
 assert.equal(db.prepare('SELECT poin FROM pelanggaran').get().poin, 0)
 assert.equal(db.prepare('SELECT count(*) n FROM pelanggaran_sessions').get().n,1)
 assert.equal((await verif.simpanVerifikasiMassal([payload('current2','2026-10-01')], '2026-09-30')).success, true)
 assert.equal(db.prepare("SELECT shubuh FROM absensi_harian WHERE id='current2'").get().shubuh, 'H')
 for (const [id, verdict, expected] of [['sakit','SAKIT','S'],['izin','IZIN','I'],['mangkir','BELUM','A']]) {
  insert(id, '2026-10-02')
  assert.equal((await verif.simpanVerifikasiMassal([payload(id,'2026-10-02',verdict)], '2026-09-30')).success, true)
  assert.equal(db.prepare('SELECT shubuh FROM absensi_harian WHERE id=?').get(id).shubuh, expected)
 }
 db.exec("INSERT INTO absensi_verifikasi_periode VALUES('2026-09-30','2026-10-06','FINAL')")
 assert.equal((await verif.simpanVerifikasiMassal([payload('mangkir','2026-10-02','KESALAHAN','s1','BELUM')], '2026-09-30')).code, 'STALE')
 db.exec('DELETE FROM absensi_verifikasi_periode; DELETE FROM absensi_harian')
 for (let i=0;i<2105;i++) insert('bulk'+i,'2026-09-30')
 for (let i=0;i<45;i++) {
  db.prepare('INSERT INTO santri VALUES(?,?,?,?,?,?,?)').run('extra'+i,'x'+i,'Santri '+i,'A','1','aktif','REGULER')
  db.prepare('INSERT INTO riwayat_pendidikan VALUES(?,?,?,?)').run('rx'+i,'extra'+i,'k','aktif')
  insert('extra-absen'+i,'2026-09-30',null,'rx'+i)
 }
 insert('outside-filter','2026-09-30',null,'r2')
 insert('outside-week','2026-09-23','BELUM')
 const queue = await verif.getAntrianVerifikasi('2026-09-30',{kategori:'REGULER',kelasId:'k',marhalahId:'m',asrama:'A'})
 assert.equal(queue.length, 46)
 assert.equal(queue.find(q => q.santri_id === 's1').items.length, 2105)
 assert.equal((await verif.simpanVerifikasiMassal(queue.map(q => ({santriId:q.santri_id,items:q.items,vonis:'KESALAHAN'})), '2026-09-30')).success, true)
 assert.equal(db.prepare("SELECT count(*) n FROM absensi_harian WHERE shubuh='A'").get().n, 2)
 assert.equal(logs.at(-1).details.total_sesi, 2150)
 console.log('PASS: print periods, all old mangkir, first input/WIB, categories, 2105 rows, verdicts, auth, stale rollback and replay protection')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
