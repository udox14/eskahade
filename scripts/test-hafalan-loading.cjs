/* eslint-disable @typescript-eslint/no-require-imports -- Isolated regression harness. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { DatabaseSync } = require('node:sqlite')
const root = path.resolve(__dirname, '..')

function compile(file, stubs, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const mod = { exports: {} }
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, console,
    require(name) { assert.ok(stubs[name], `Missing stub: ${name}`); return stubs[name] },
    ...globals,
  }, { filename: file })
  return mod.exports
}

function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE marhalah(id INTEGER PRIMARY KEY, nama TEXT);
    CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE santri(id TEXT PRIMARY KEY);
    CREATE TABLE kelas(id TEXT PRIMARY KEY, marhalah_id INTEGER);
    CREATE TABLE mapel(id INTEGER PRIMARY KEY);
    CREATE TABLE data_guru(id INTEGER PRIMARY KEY);
    CREATE TABLE tahun_ajaran(id INTEGER PRIMARY KEY);
    CREATE TABLE riwayat_pendidikan(id TEXT PRIMARY KEY, santri_id TEXT, kelas_id TEXT);
    CREATE TABLE fitur_akses(group_name TEXT, title TEXT, href TEXT UNIQUE, icon TEXT,
      roles TEXT, is_active INTEGER, urutan INTEGER, is_bottomnav INTEGER, bottomnav_urutan INTEGER);
    INSERT INTO marhalah VALUES(1, 'Tingkat Satu');
    INSERT INTO santri VALUES('s1');
    INSERT INTO kelas VALUES('k1', 1);
    INSERT INTO riwayat_pendidikan VALUES('r1', 's1', 'k1');
  `)
  const calls = []
  let failProbe = false
  const load = () => compile('lib/akademik/guru-access.ts', {
    '@/lib/db': {
      async queryOne(sql, params = []) {
        calls.push('read')
        if (failProbe) throw new Error('Database unavailable')
        return db.prepare(sql).get(...params) ?? null
      },
      async execute(sql) { calls.push('write'); db.exec(sql) },
      async query(sql, params = []) { return db.prepare(sql).all(...params) },
    },
    '@/lib/auth/session': {},
  })
  return { db, calls, load, setFail(value) { failProbe = value } }
}

function mount(initialAction) {
  const state = [], effects = [], timers = new Map()
  let cursor = 0, first = true, timerId = 0
  const jsx = (type, props) => ({ type, props })
  const page = compile('app/dashboard/guru/hafalan/_page-content.tsx', {
    react: {
      useState(initial) {
        const i = cursor++
        if (first) state[i] = typeof initial === 'function' ? initial() : initial
        return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value }]
      },
      useRef(initial) { const i = cursor++; if (first) state[i] = { current: initial }; return state[i] },
      useMemo(fn) { return fn() },
      useEffect(fn) { if (first) effects.push(fn) },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': new Proxy({}, { get: (_, key) => key }),
    sonner: { toast: { error() {} } },
    '@/components/dashboard/page-header': { DashboardPageHeader: 'Header' },
    './actions': { getHafalanInitialData: initialAction },
  }, {
    window: { history: { state: {}, replaceState() {} }, location: { href: '/hafalan' }, addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: () => '' },
    document: { querySelector: () => null },
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id },
    clearTimeout(id) { timers.delete(id) },
  }).default
  const render = () => { cursor = 0; const tree = page(); first = false; return tree }
  render()
  const cleanup = effects.map(fn => fn())
  return { render, timers, retryEffect: effects[0], cleanup }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve() }

async function run() {
  const migrated = fixture()
  try {
    for (const name of [
      '0076_guru_nilai_harian_hafalan.sql', '0077_hafalan_paket_marhalah.sql',
      '0078_hafalan_progress_santri_scope.sql', '0079_hafalan_blok_ref.sql',
      '0080_hafalan_progress_highlight.sql',
    ]) migrated.db.exec(fs.readFileSync(path.join(root, 'migrations', name), 'utf8'))
    await migrated.load().ensureGuruFeatureSchema()
    assert.deepEqual(migrated.calls, ['read'])
  } finally { migrated.db.close() }
  const empty = fixture()
  try {
    await empty.load().ensureGuruFeatureSchema()
    assert.equal(empty.db.prepare("SELECT COUNT(*) n FROM pragma_table_info('hafalan_progress') WHERE name='highlight'").get().n, 1)
  } finally { empty.db.close() }
  const f = fixture()
  try {
    // A legacy database still receives schema and data backfills.
    f.db.exec(fs.readFileSync(path.join(root, 'migrations/0076_guru_nilai_harian_hafalan.sql'), 'utf8'))
    f.db.exec(`INSERT INTO hafalan_bab(id,jenis,marhalah_id,judul,urutan) VALUES(1,'quran',1,'Al-Fatihah',1);
      INSERT INTO hafalan_blok(id,bab_id,label,urutan) VALUES(1,1,'Ayat 1',1);
      INSERT INTO hafalan_progress(id,blok_id,riwayat_pendidikan_id) VALUES('p1',1,'r1');`)
    await f.load().ensureGuruFeatureSchema()
    const writes = f.calls.filter(c => c === 'write').length
    assert.ok(writes > 30)
    assert.equal(f.db.prepare('SELECT ref FROM hafalan_blok').get().ref, 'quran:1:1')
    assert.equal(f.db.prepare('SELECT santri_id FROM hafalan_progress').get().santri_id, 's1')
    assert.ok(f.db.prepare('SELECT paket_id FROM hafalan_bab').get().paket_id)

    // A fresh Worker against a migrated DB makes one read and no writes.
    f.calls.length = 0
    const ready = f.load()
    await Promise.all([ready.ensureGuruFeatureSchema(), ready.ensureGuruFeatureSchema()])
    await ready.ensureGuruFeatureSchema()
    assert.deepEqual(f.calls, ['read'])

    // Database errors propagate, then retry works; they never trigger DDL.
    f.calls.length = 0
    const retry = f.load()
    f.setFail(true)
    await assert.rejects(retry.ensureGuruFeatureSchema(), /Database unavailable/)
    f.setFail(false)
    await retry.ensureGuruFeatureSchema()
    assert.deepEqual(f.calls, ['read', 'read'])

    // A missing index must take the compatibility path and recreate it.
    f.db.exec('DROP INDEX idx_hafalan_progress_santri')
    await f.load().ensureGuruFeatureSchema()
    assert.ok(f.db.prepare("SELECT name FROM sqlite_master WHERE name='idx_hafalan_progress_santri'").get())
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM hafalan_progress').get().n, 1)
    console.log(`PASS: cold-start DB work reduced from ${writes} write attempts to 1 metadata read; legacy backfill, concurrency, retry and index repair`)
  } finally { f.db.close() }

  let client = mount(async () => ({ kelas: [{ id: 'k1', nama_kelas: 'Kelas 1' }] }))
  await flush()
  assert.ok(nodes(client.render()).some(n => n.props?.children === 'Kelas 1'))
  assert.equal(client.timers.size, 0)
  let fail = true
  client = mount(async () => {
    if (fail) throw new Error('Network failure')
    return { kelas: [{ id: 'k1', nama_kelas: 'Kelas 1' }] }
  })
  await flush()
  assert.ok(nodes(client.render()).some(n => n.props?.role === 'alert'))
  assert.ok(!nodes(client.render()).some(n => n.type === 'Loader2'))
  nodes(client.render()).find(n => n.type === 'button' && n.props.children === 'Coba lagi').props.onClick()
  fail = false
  client.retryEffect()
  await flush()
  assert.ok(nodes(client.render()).some(n => n.props?.children === 'Kelas 1'))

  let resolveLate
  client = mount(() => new Promise(resolve => { resolveLate = resolve }))
  for (const timeout of client.timers.values()) timeout()
  assert.ok(nodes(client.render()).some(n => n.props?.role === 'alert'))
  resolveLate({ kelas: [{ id: 'late', nama_kelas: 'Stale' }] })
  await flush()
  assert.ok(nodes(client.render()).some(n => n.props?.role === 'alert'))
  client = mount(() => new Promise(() => {}))
  client.cleanup.forEach(fn => fn?.())
  assert.equal(client.timers.size, 0)
  console.log('PASS: initial display, failed request, retry, timeout, late response and unmount cleanup')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
