/* eslint-disable @typescript-eslint/no-require-imports -- Isolated regression harness. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { DatabaseSync } = require('node:sqlite')
const root = path.resolve(__dirname, '..')
const db = new DatabaseSync(':memory:')
db.exec(`
  CREATE TABLE users(id TEXT PRIMARY KEY, full_name TEXT, role TEXT, roles TEXT);
  CREATE TABLE data_guru(id INTEGER PRIMARY KEY, nama_lengkap TEXT, gelar TEXT, kode_guru TEXT);
  CREATE TABLE tahun_ajaran(id INTEGER PRIMARY KEY, is_active INTEGER);
  CREATE TABLE marhalah(id INTEGER PRIMARY KEY, nama TEXT, urutan INTEGER);
  CREATE TABLE kelas(id TEXT PRIMARY KEY, nama_kelas TEXT, tahun_ajaran_id INTEGER, marhalah_id INTEGER,
    wali_kelas_id TEXT, guru_shubuh_id INTEGER, guru_ashar_id INTEGER, guru_maghrib_id INTEGER);
  CREATE TABLE absensi_guru(id TEXT PRIMARY KEY);
  INSERT INTO users VALUES('wali','Wali','wali_kelas',NULL),('multi','Sekpen','guru','["sekpen"]'),
    ('empty','Kosong','guru',''),('bad','Rusak','guru','invalid');
  INSERT INTO data_guru VALUES(1,'Guru Satu','','G1'),(2,'Guru Dua','','G2');
  INSERT INTO tahun_ajaran VALUES(1,1),(2,0);
  INSERT INTO marhalah VALUES(1,'Tingkat Satu',1),(2,'Tingkat Dua',2);
  INSERT INTO kelas VALUES('a','Kelas 1',1,1,'wali',1,2,1),('b','Kelas 2',1,2,'wali',2,1,2),
    ('old','Kelas Lama',2,1,'wali',1,1,1);
`)
const sqlStubs = {
  '@/lib/db': {
    async query(sql, params = []) { return db.prepare(sql).all(...params) },
    async queryOne(sql, params = []) { return db.prepare(sql).get(...params) ?? null },
    async execute(sql, params = []) { db.prepare(sql).run(...params); return { success: true } },
    async batch(statements) { for (const s of statements) db.prepare(s.sql).run(...(s.params ?? [])) },
  },
  '@/lib/auth/password': { async hashPassword() { throw new Error('Read must reuse existing wali') } },
  '@/lib/auth/session': {},
  '@/lib/activity-log': {},
  'next/cache': { unstable_cache: fn => fn, revalidatePath() {} },
}
function compile(file, requireFn, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const mod = { exports: {} }
  const context = vm.createContext({ require: requireFn, module: mod, exports: mod.exports, console, ...globals })
  vm.runInContext(source, context, { filename: file })
  return mod.exports
}
const modules = new Map()
function load(name) {
  if (sqlStubs[name]) return sqlStubs[name]
  if (!modules.has(name)) modules.set(name, compile(name.replace(/^@\//, '') + '.ts', load))
  return modules.get(name)
}
const actions = load('@/app/dashboard/master/wali-kelas/actions')

// Run the actual client component with minimal hooks and deferred Server Actions.
function mount(overrides = {}) {
  const state = [], effects = [], timers = new Map()
  let cursor = 0, first = true, nextTimer = 0
  const api = {
    async getJadwalFilterOptions() { return { guruList: [{ id: 1, nama_lengkap: 'Guru Satu' }], marhalahList: [], waliUserList: [] } },
    async getTahunAjaranList() { return [] },
    async getKelasJadwalByMarhalah() { return [{ id: 'a', nama_kelas: 'Kelas 1', guru_shubuh_id: 1 }] },
    ...overrides,
  }
  const react = {
    useState(initial) {
      const index = cursor++
      if (first) state[index] = typeof initial === 'function' ? initial() : initial
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
    },
    useRef(initial) { const index = cursor++; if (first) state[index] = { current: initial }; return state[index] },
    useMemo(fn) { return fn() },
    useEffect(fn) { if (first) effects.push(fn) },
  }
  const jsx = (type, props) => ({ type, props })
  const stubs = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    './actions': api,
    'lucide-react': new Proxy({}, { get: (_, key) => key }),
    sonner: { toast: { error() {} } },
    '@/components/ui/pagination': { default: 'Pagination', usePagination: list => ({ paged: list, totalPages: 1, safePage: 1 }) },
    '@/components/ui/confirm-dialog': { useConfirm: () => async () => true },
    '@/components/dashboard/page-header': { DashboardPageHeader: 'Header' },
    'next/link': { default: 'Link' },
  }
  const page = compile('app/dashboard/master/wali-kelas/_page-content.tsx', name => {
    assert.ok(stubs[name], `Missing stub ${name}`); return stubs[name]
  }, {
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id },
    clearTimeout(id) { timers.delete(id) },
    console: { ...console, error() {} },
  }).default
  const render = () => { cursor = 0; const tree = page(); first = false; return tree }
  render(); effects.forEach(fn => fn())
  return { state, render, timers }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
async function run() {
  // Reproduce why malformed roles could hide valid teacher data.
  assert.throws(() => db.prepare("SELECT value FROM users, json_each(COALESCE(users.roles, '[]'))").all(), /malformed JSON/)
  const options = await actions.getJadwalFilterOptions()
  assert.equal(options.guruList.length, 2)
  assert.deepEqual(options.waliUserList.map(u => u.id).sort(), ['multi', 'wali'])
  assert.equal(options.guruList[0].assigned_classes, 'Kelas 1,Kelas 2')
  db.exec("INSERT INTO kelas_jadwal_guru_mingguan(kelas_id,sesi,hari_index,guru_id) VALUES('a','shubuh',1,2)")
  const all = await actions.getKelasJadwalByMarhalah('SEMUA')
  assert.equal(all.length, 2)
  assert.equal(all[0].guru_shubuh_id, 1)
  assert.equal(all[0].weekly_rules[0].guru_id, 2)
  assert.equal((await actions.getKelasJadwalByMarhalah('2'))[0].id, 'b')
  assert.equal((await actions.getKelasJadwalByMarhalah('99')).length, 0)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM data_guru').get().n, 2)

  let client = mount(); await flush()
  assert.ok(nodes(client.render()).some(n => n.props?.children === 'Kelas 1'))
  assert.equal(client.timers.size, 0)
  let failOptions = true
  client = mount({ async getJadwalFilterOptions() {
    if (failOptions) throw new Error('DB failed')
    return { guruList: [{ id: 1, nama_lengkap: 'Guru Satu' }], marhalahList: [], waliUserList: [] }
  } }); await flush()
  assert.ok(nodes(client.render()).some(n => n.props?.role === 'alert'))
  assert.ok(!nodes(client.render()).some(n => n.type === 'Loader2'))
  failOptions = false
  await nodes(client.render()).find(n => n.type === 'button' && n.props.children === 'Coba lagi').props.onClick()
  await flush()
  assert.ok(!nodes(client.render()).some(n => n.props?.role === 'alert'))
  assert.ok(client.state.some(v => Array.isArray(v) && v[0]?.nama_lengkap === 'Guru Satu'))
  client = mount({ async getTahunAjaranList() { throw new Error('Cache failed') } }); await flush()
  assert.ok(client.state.some(v => Array.isArray(v) && v[0]?.nama_lengkap === 'Guru Satu'))
  client = mount({ getKelasJadwalByMarhalah: () => new Promise(() => {}) }); await flush()
  for (const timeout of client.timers.values()) timeout()
  await flush()
  assert.ok(nodes(client.render()).some(n => n.props?.role === 'alert'))
  assert.ok(!nodes(client.render()).some(n => n.type === 'Loader2'))

  const first = deferred(), second = deferred()
  client = mount({ getKelasJadwalByMarhalah: id => id === 'SEMUA' ? first.promise : second.promise })
  const select = nodes(client.render()).find(n => n.type === 'select' && n.props.value === 'SEMUA')
  const change = select.props.onChange({ target: { value: '2' } })
  second.resolve([{ id: 'b', nama_kelas: 'Kelas 2' }]); await change; await flush()
  first.resolve([{ id: 'a', nama_kelas: 'Kelas 1' }]); await flush()
  assert.ok(nodes(client.render()).some(n => n.props?.children === 'Kelas 2'))
  assert.ok(!nodes(client.render()).some(n => n.props?.children === 'Kelas 1'))
  console.log('PASS: teacher/schedule SQL, legacy roles, initial load, failure, timeout, and filter race')
}
run().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => db.close())
