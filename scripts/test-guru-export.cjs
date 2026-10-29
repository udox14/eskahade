/* eslint-disable @typescript-eslint/no-require-imports -- Isolated regression harness. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const XLSX = require('xlsx')
const { DatabaseSync } = require('node:sqlite')
const root = path.resolve(__dirname, '..')
function compile(file, stubs, globals = {}, suffix = '') {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8') + suffix, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const mod = { exports: {} }
  vm.runInNewContext(source, { module: mod, exports: mod.exports, console,
    require(name) { assert.ok(stubs[name], `Missing stub ${name}`); return stubs[name] }, ...globals }, { filename: file })
  return mod.exports
}
const model = compile('lib/akademik/guru-export.ts', {})
const workbook = compile('lib/akademik/guru-export-workbook.ts', { xlsx: XLSX })
const db = new DatabaseSync(':memory:')
db.exec(`
 CREATE TABLE users(id TEXT PRIMARY KEY);
 CREATE TABLE santri(id TEXT PRIMARY KEY, nis TEXT, nama_lengkap TEXT, asrama TEXT, kamar TEXT, status_global TEXT);
 CREATE TABLE riwayat_pendidikan(id TEXT PRIMARY KEY, santri_id TEXT, kelas_id TEXT, status_riwayat TEXT);
 CREATE TABLE kelas(id TEXT PRIMARY KEY, nama_kelas TEXT, tahun_ajaran_id INTEGER, marhalah_id INTEGER);
 CREATE TABLE tahun_ajaran(id INTEGER PRIMARY KEY,nama TEXT,is_active INTEGER);
 CREATE TABLE marhalah(id INTEGER PRIMARY KEY,nama TEXT);
 CREATE TABLE mapel(id INTEGER PRIMARY KEY,nama TEXT);
 CREATE TABLE data_guru(id INTEGER PRIMARY KEY,nama_lengkap TEXT);
 CREATE TABLE fitur_akses(group_name TEXT,title TEXT,href TEXT UNIQUE,icon TEXT,roles TEXT,is_active INTEGER,urutan INTEGER,is_bottomnav INTEGER,bottomnav_urutan INTEGER);
 INSERT INTO users VALUES('u');
 INSERT INTO tahun_ajaran VALUES(1,'2026/2027',1);
 INSERT INTO marhalah VALUES(1,'Awal'),(2,'Saat Ini');
 INSERT INTO kelas VALUES('k1','Kelas 01',1,2),('other','Kelas Lain',1,1),('empty','Kosong',1,2);
 INSERT INTO santri VALUES('s1','00123','=SUM(1,2)','Asrama A','01','aktif'),('s2','00002','Santri Dua',NULL,NULL,'aktif'),('s3','003','Arsip',NULL,NULL,'arsip');
 INSERT INTO riwayat_pendidikan VALUES('r1','s1','k1','aktif'),('r2','s2','k1','aktif'),('r3','s3','k1','aktif'),('old-r1','s1','other','selesai');
 INSERT INTO mapel VALUES(1,'Fiqih'),(2,'Nahwu'),(3,'Luar');
 INSERT INTO data_guru VALUES(1,'Guru');
`)
for (const name of ['0076_guru_nilai_harian_hafalan.sql', '0077_hafalan_paket_marhalah.sql', '0078_hafalan_progress_santri_scope.sql', '0079_hafalan_blok_ref.sql', '0080_hafalan_progress_highlight.sql']) db.exec(fs.readFileSync(path.join(root, 'migrations', name), 'utf8'))
db.exec(`
 INSERT INTO nilai_harian_sesi(id,kelas_id,mapel_id,guru_id,tanggal,nama_sesi,kkm) VALUES
 ('a','k1',1,1,'2026-10-01','Sesi A',70),('b','k1',1,1,'2026-10-02','Sesi B',90),
 ('c','k1',2,1,'2026-10-03','Sesi C',60),('x','other',3,1,'2026-10-04','Rahasia',50);
 INSERT INTO nilai_harian_detail(id,sesi_id,riwayat_pendidikan_id,nilai) VALUES
 ('d1','a','r1',0),('d2','b','r1',80),('d3','c','r1',70),('d4','a','r2',100),('dx','x','r1',99);
 INSERT INTO hafalan_paket(id,jenis,nama,is_active) VALUES(1,'quran','Saat ini',1),(2,'quran','Lama',1),(3,'jurumiyah','Jurumiyah',1),(4,'hadits','Nonaktif',0),(5,'amtsilah','Amtsilah',1);
 INSERT INTO hafalan_paket_marhalah(paket_id,marhalah_id,jenis) VALUES(1,2,'quran'),(2,1,'quran'),(3,2,'jurumiyah'),(4,2,'hadits'),(5,2,'amtsilah');
 INSERT INTO hafalan_bab(id,jenis,marhalah_id,paket_id,judul,urutan,is_active) VALUES
 (1,'quran',2,1,'Al-Fatihah',1,1),(2,'quran',1,2,'Lama',1,1),(3,'jurumiyah',2,3,'Kalam',1,1),
 (4,'hadits',2,4,'Nonaktif',1,1),(5,'quran',2,1,'Bab Nonaktif',2,0),(6,'amtsilah',2,5,'Wazan',1,1);
 INSERT INTO hafalan_blok(id,bab_id,label,urutan,ref,is_active) VALUES
 (1,1,'Ayat 1',1,'quran:1:1',1),(2,2,'Lama',1,NULL,1),(3,3,'Kalam',1,'jurumiyah:kalam',1),
 (4,4,'Hadits Nonaktif',1,NULL,1),(5,5,'Bab Nonaktif',1,NULL,1),(6,1,'Blok Nonaktif',2,NULL,0),(7,6,'Wazan',1,NULL,1);
 INSERT INTO hafalan_progress(id,blok_id,riwayat_pendidikan_id,santri_id,marhalah_id,status,highlight) VALUES
 ('p1',1,'old-r1','s1',1,'hafal',NULL),('p2',2,'old-r1','s1',1,'hafal',NULL),
 ('p3',3,'r1','s1',2,'hafal','[0,1,1,-1,99,1.5,"2"]'),('p4',3,'old-r1','s1',1,'hafal','[1,2]'),
 ('p5',3,'r2','s2',2,'hafal','[0,1,2,3]'),('p6',7,'r1','s1',2,'proses',NULL);
`)
let featureAllowed = true, session = { id: 'u' }, failQuery = false
const reads = []
const dbApi = {
 async query(sql, params = []) { reads.push(sql); if (failQuery) throw new Error('private database detail'); return db.prepare(sql).all(...params) },
 async queryOne(sql, params = []) { reads.push(sql); return db.prepare(sql).get(...params) ?? null },
}
const access = compile('lib/akademik/guru-access.ts', { '@/lib/db': dbApi, '@/lib/auth/session': {} })
const actions = compile('lib/akademik/guru-export-actions.ts', {
 '@/lib/auth/session': { async getSession() { return session } },
 '@/lib/auth/feature': { async canAccessFeatureForSession(_s, href) { assert.ok(['/dashboard/guru/hafalan','/dashboard/guru/nilai-harian'].includes(href)); return featureAllowed } },
 '@/lib/db': dbApi,
 './guru-access': { ...access, async ensureGuruFeatureSchema() {}, async canAccessKelas(_s, id) { return id === 'k1' || id === 'empty' } },
 '@/lib/hafalan/text': { resolveHafalanText: () => ({ arab: 'واحد اثنان ثلاثة أربعة' }) },
 './guru-export': model,
})
const rowObject = (sheet, row) => Object.fromEntries(sheet.headers.map((h, i) => [h, row[i]]))
const rows = sheet => sheet.rows.map(r => rowObject(sheet, r))
const request = (scope, extra = {}) => ({ module: 'nilai', kelasId: 'k1', scope, ...extra })
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function nodes(tree) {
 if (!tree || typeof tree !== 'object') return []
 if (Array.isArray(tree)) return tree.flatMap(nodes)
 return [tree, ...nodes(tree.props?.children)]
}

function mount(props, api) {
 const state = [], effects = [], imports = [], cleanup = [], loaded = []
 let cursor = 0
 const jsx = (type, props) => ({ type, props })
 const stubs = {
  react: {
   useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], v => { state[i] = typeof v === 'function' ? v(state[i]) : v }] },
   useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i] },
   useEffect(fn, deps) { const i = cursor++; if (!state[i] || deps.some((v, n) => v !== state[i][n])) { state[i] = deps; effects.push(() => { cleanup[i]?.(); cleanup[i] = fn() }) } },
  },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'lucide-react': new Proxy({}, { get: (_, key) => key }),
  '@/lib/akademik/guru-export-actions': api,
  '@/lib/akademik/guru-export-workbook': { async downloadGuruWorkbook(doc, canDownload) { if (!canDownload()) return false; imports.push(doc); return true } },
 }
 const trackedStubs = new Proxy(stubs, { get(target, key) { loaded.push(key); return target[key] } })
 const component = compile('components/akademik/guru-export-button.tsx', trackedStubs, {}, '\nexport { ExportDialog };').ExportDialog
 const render = () => {
  cursor = 0
  const tree = component(props)
  const node = nodes(tree).find(n => n.type === 'dialog')
  node.props.ref.current = { showModal() {}, close() {} }
  effects.splice(0).forEach(fn => fn())
  return tree
 }
 render()
 return { render, imports, loaded, cleanup: () => cleanup.forEach(fn => fn?.()) }
}
async function run() {
 const options = await actions.getGuruExportOptions('nilai', 'k1')
 assert.equal(options.data.mapel.length, 2); assert.equal(options.data.sesi.length, 3)
 const all = await actions.getGuruExportData(request('semua'))
 assert.ok(all.ok); assert.equal(all.data.detail.rows.length, 6); assert.equal(all.data.rekap.rows.length, 4)
 const recap = rows(all.data.rekap)
 const fiqih = recap.find(r => r.NIS === '00123' && r.Mapel === 'Fiqih')
 assert.equal(fiqih['Rata-rata'], 40); assert.equal(fiqih['Nilai Terisi'], 2); assert.equal(fiqih['Tidak Tuntas'], 2)
 const nahwuEmpty = recap.find(r => r.NIS === '00002' && r.Mapel === 'Nahwu')
 assert.equal(nahwuEmpty['Rata-rata'], null); assert.equal(nahwuEmpty['Tidak Tuntas'], 0)
 const perMapel = await actions.getGuruExportData(request('mapel', { mapelId: 1 }))
 assert.ok(perMapel.ok); assert.equal(perMapel.data.detail.rows.length, 4)
 const perSesi = await actions.getGuruExportData(request('sesi', { mapelId: 1, sesiId: 'a' }))
 assert.ok(perSesi.ok); assert.equal(perSesi.data.detail.rows.length, 2)
 for (const req of [request('sesi', { mapelId: 1, sesiId: 'c' }), request('sesi', { mapelId: 3, sesiId: 'x' }), request('mapel', { mapelId: 3 }), request('invalid')]) assert.equal((await actions.getGuruExportData(req)).ok, false)
 const hfOptions = await actions.getGuruExportOptions('hafalan','k1')
 assert.equal(hfOptions.data.jenis.length, 3)
 const hf = await actions.getGuruExportData({ module: 'hafalan', kelasId: 'k1', scope: 'semua' })
 assert.ok(hf.ok); assert.equal(hf.data.detail.rows.length, 6)
 const hfRows = rows(hf.data.detail)
 assert.equal(hfRows.find(r => r.NIS === '00123' && r['Jenis Hafalan'] === 'Hafalan Jurumiyah')['Kata Dihafal'], 3)
 assert.equal(hfRows.find(r => r.NIS === '00123' && r['Jenis Hafalan'] === 'Hafalan Jurumiyah').Status, 'Proses')
 assert.equal(hfRows.find(r => r.NIS === '00002' && r['Jenis Hafalan'] === 'Hafalan Jurumiyah').Status, 'Hafal')
 assert.equal(hfRows.find(r => r.NIS === '00123' && r['Jenis Hafalan'] === "Hafalan Al-Qur'an").Status, 'Hafal')
 assert.ok(hfRows.every(r => !String(r['Bagian/Ayat']).includes('Nonaktif') && r['Bagian/Ayat'] !== 'Lama'))
 const one = await actions.getGuruExportData({ module:'hafalan',kelasId:'k1',scope:'jenis',jenis:'quran' })
 assert.ok(one.ok); assert.equal(one.data.detail.rows.length, 2)
 for (const jenis of ['hadits','unknown']) assert.equal((await actions.getGuruExportData({ module:'hafalan',kelasId:'k1',scope:'jenis',jenis })).ok, false)
 db.exec('UPDATE hafalan_paket SET is_active=1 WHERE id=4')
 assert.ok((await actions.getGuruExportData({ module:'hafalan',kelasId:'k1',scope:'jenis',jenis:'hadits' })).ok)
 db.exec('UPDATE hafalan_paket SET is_active=0 WHERE id=4')
 assert.equal((await actions.getGuruExportData({ ...request('semua'), kelasId:'empty' })).ok, false)
 assert.equal((await actions.getGuruExportData({ ...request('semua'), kelasId:'other' })).ok, false)
 session = null; assert.equal((await actions.getGuruExportData(request('semua'))).ok, false); session = { id:'u' }
 featureAllowed = false; assert.equal((await actions.getGuruExportOptions('nilai','k1')).ok, false); assert.equal((await actions.getGuruExportData(request('semua'))).ok, false); featureAllowed = true
 failQuery = true
 const failed = await actions.getGuruExportData(request('semua'))
 assert.equal(failed.ok, false); assert.ok(!failed.error.includes('private')); failQuery = false

 for (const doc of [all.data, hf.data]) {
  const built = workbook.buildGuruWorkbook(XLSX, doc)
  const read = XLSX.read(XLSX.write(built, { type:'buffer', bookType:'xlsx' }), { type:'buffer' })
  assert.deepEqual(read.SheetNames, ['Rekap','Detail'])
  assert.equal(read.Sheets.Detail.B8.t, 's'); assert.equal(read.Sheets.Detail.B8.v, '00123')
  assert.equal(read.Sheets.Detail.C8.t, 's'); assert.equal(read.Sheets.Detail.C8.v, '=SUM(1,2)'); assert.equal(read.Sheets.Detail.C8.f, undefined)
  assert.equal(read.Sheets.Detail.A8.t, 'n')
  assert.equal(read.Sheets.Rekap.B3.v, '2026/2027')
  assert.ok(!/[<>:"/\\|?*]/.test(workbook.safeExportFilename(doc)))
 }
 assert.equal(XLSX.utils.sheet_to_json(workbook.buildGuruWorkbook(XLSX, perSesi.data).Sheets.Detail, { range:6 })[0].Nilai, 0)
 console.log('PASS: server scopes, authorization, class isolation, zero/missing grades, KKM, historical/current hafalan, word highlights, empty/failure, XLSX readback and text cells')

 let blocked = false, calls = 0, closed = 0
 const waiting = deferred()
 const props = { module:'nilai',kelasId:'k1',kelasNama:'Kelas 01',tahunAjaran:'2026/2027',mapelId:1,sesiId:'a',getBlocked:() => blocked,onClose:() => closed++ }
 const client = mount(props, { getGuruExportOptions:async () => options, getGuruExportData:async () => { calls++; return waiting.promise } })
 await flush()
 assert.ok(!client.loaded.includes('@/lib/akademik/guru-export-workbook'))
 let tree = client.render()
 const selects = nodes(tree).filter(n => n.type === 'select')
 assert.equal(selects[0].props.value, 'sesi'); assert.equal(selects[1].props.value,'1'); assert.equal(selects[2].props.value,'a')
 const button = () => nodes(client.render()).find(n => n.type === 'button' && n.props.children?.includes?.('Unduh Excel'))
 blocked = true; assert.equal(button().props.disabled,true); await button().props.onClick(); assert.equal(calls,0)
 blocked = false
 const clickDownload = button().props.onClick
 const download = clickDownload(); clickDownload(); assert.equal(calls,1)
 waiting.resolve(perSesi); await download; await flush(); assert.equal(client.imports.length,1); assert.equal(closed,1)
 client.cleanup()

 const late = deferred()
 const cancelled = mount({ ...props }, { getGuruExportOptions:async () => options,getGuruExportData:async () => late.promise })
 await flush()
 const downloading = nodes(cancelled.render()).find(n => n.type === 'button' && n.props.children?.includes?.('Unduh Excel')).props.onClick()
 cancelled.cleanup(); late.resolve(perSesi); await downloading; assert.equal(cancelled.imports.length,0)
 let failOptions = true
 const retry = mount(props, { getGuruExportOptions:async () => { if (failOptions) throw Error('network'); return options },getGuruExportData:async () => ({ ok:false,error:'Data kosong' }) })
 await flush(); assert.ok(nodes(retry.render()).some(n => n.props?.role === 'alert'))
 failOptions = false
 nodes(retry.render()).find(n => n.props?.children === 'Coba lagi').props.onClick(); retry.render(); await flush()
 const retryDownload = nodes(retry.render()).find(n => n.type === 'button' && n.props.children?.includes?.('Unduh Excel'))
 await retryDownload.props.onClick(); assert.ok(nodes(retry.render()).some(n => n.props?.role === 'alert' && n.props.children === 'Data kosong'))
 retry.cleanup()
 for (const [defaults, expected] of [
  [{ module:'nilai',mapelId:null,sesiId:null },'semua'],
  [{ module:'nilai',mapelId:1,sesiId:null },'mapel'],
  [{ module:'hafalan',jenis:'jurumiyah' },'jenis'],
  [{ module:'hafalan',jenis:null },'semua'],
 ]) {
  const modal = mount({ ...props, ...defaults }, { getGuruExportOptions:async () => defaults.module === 'hafalan' ? hfOptions : options })
  await flush()
  assert.equal(nodes(modal.render()).find(n => n.type === 'select').props.value, expected)
  modal.cleanup()
 }
 console.log('PASS: modal defaults, blocked saves, duplicate clicks, cancelled download, option retry and export failure')
}
run().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => db.close())
