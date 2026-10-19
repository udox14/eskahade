/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node verification tooling. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const state = { token: null, row: { email: 'test@fixture.test', full_name: 'Synthetic', role: 'tester', roles: '["tester"]' }, fail: false };
const sql = new DatabaseSync(':memory:');
sql.exec("CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT,roles TEXT); INSERT INTO users VALUES('actor','tester','[\"tester\"]'); CREATE TABLE examples(id INTEGER PRIMARY KEY,value INTEGER); INSERT INTO examples VALUES(1,10)");
const raw = { prepare(text) { let params = []; const statement = { bind(...p) { params = p; return statement; }, async first() { if (state.fail) throw Error('DB_OFFLINE'); return sql.prepare(text).get(...params); }, async all() { return { results: sql.prepare(text).all(...params) }; }, async run() { sql.prepare(text).run(...params); return { success: true }; } }; return statement; }, async batch(ss) { for (const s of ss) await s.run(); }, async exec(text) { sql.exec(text); } };
const dbStub = { execute: async () => ({ success: true }), query: async () => ['structural_jabatan', 'psb_verifikasi_akses', 'psb_asrama_akses', 'psb_bayar_akses', 'upk_panitia_akses', 'guru_id', 'santri_id'].map(name => ({ name })), queryOne: async () => { if (state.fail) throw Error('DB_OFFLINE'); return state.row; } };
const original = Module._load;
Module._load = function(request, parent, main) {
  if (request === '@/lib/db') return dbStub;
  if (request === '@/lib/auth/demo-context') return { isDemoRequest: async () => false };
  if (request === '@/lib/auth/feature') return { canAccessFeatureForSession: async () => { throw Error('PERMISSION_LOOKUP_FAILED'); } };
  if (request === '@/lib/finance/bri') return { loadBriConfig: () => { throw Error('SYNTHETIC_CONFIG_FAILURE'); }, BRI_VA_INQUIRY_CODES: { GENERAL_ERROR: '5002400' }, BRI_VA_PAYMENT_CODES: { GENERAL_ERROR: '5002500' } };
  if (request === 'next/navigation') return { redirect: url => { throw Error('NEXT_REDIRECT '+url); } };
  if (request === 'react') return { ...original.call(this, request, parent, main), cache: fn => fn };
  if (request === 'next/headers') return { cookies: async () => ({ get: () => state.token ? { value: state.token } : undefined }) };
  if (request === '@opennextjs/cloudflare') return { getCloudflareContext: async () => ({ env: state.identityEnv || { DB: raw, DEMO_DB: { wrong: true } } }) };
  if (request.startsWith('@/')) request = path.join(root, request.slice(2));
  return original.call(this, request, parent, main);
};
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const load = name => require(path.join(root, name));
async function main() {
  let passed = 0;
  async function test(name, run) { await run(); console.log('PASS ' + name); passed++; }
  process.env.JWT_SECRET = 'synthetic-security-regression-only';
  const auth = load('lib/auth/session.ts');
  const db = load('lib/db/index.ts');
  state.token = await auth.createJWTToken({ id: 'actor', role: 'admin', roles: ['admin'] });
  await test('stored revoked role replaces stale admin token', async () => assert.equal((await auth.getSession()).role, 'tester'));
  await test('DB outage cannot restore stale admin permission', async () => { state.fail = true; assert.equal(await auth.getSession(), null); state.fail = false; });
  await test('deleted account invalidates signed session', async () => { const previous = state.row; state.row = null; assert.equal(await auth.getSession(), null); state.row = previous; });
  await test('role changes across production/demo datasets require a fresh login', async () => { const row=state.row,token=state.token; try { state.row={...row,role:'demo',roles:'["demo"]'}; assert.equal(await auth.getSession(),null); state.row={...row,role:'admin',roles:'["admin"]'}; state.token=await auth.createJWTToken({id:'actor',role:'demo',roles:['demo'],demoSandbox:true}); assert.equal(await auth.getSession(),null); } finally {state.row=row;state.token=token;} });
  await test('expired and tampered sessions fail closed', async () => { const token = state.token; state.token = await auth.createJWTToken({ id: 'actor' }, -5); assert.equal(await auth.getSession(), null); state.token = token.slice(0, -4) + 'xxxx'; assert.equal(await auth.getSession(), null); state.token = token; });
  await test('tester role downgrade enforced even with old admin token', async () => { const target = await db.getDB(); await assert.rejects(async () => target.prepare('UPDATE examples SET value=11').run(), /hanya boleh membaca/); });
  for (const text of ["/* misleading prefix */ UPDATE examples SET value=20", "-- comment\nDELETE FROM examples", "WITH seed AS (SELECT 1) UPDATE examples SET value=30", "SELECT 1; DELETE FROM examples", 'SELECT 1; PRAGMA writable_schema=ON', 'PRAGMA writable_schema=ON', 'ATTACH DATABASE :memory: AS other']) {
    await test('tester denies SQL bypass: ' + text.split('\n').pop(), async () => { const target = await db.getDB(); await assert.rejects(async () => target.exec(text), /hanya boleh membaca/); });
  }
  await test('tester can read CTEs, literal keywords and schema introspection', async () => { const target = await db.getDB(); assert.equal((await target.prepare("WITH c AS (SELECT value FROM examples) SELECT * FROM c").first()).value, 10); assert.equal((await target.prepare("SELECT 'UPDATE' AS word").first()).word, 'UPDATE'); assert.ok((await target.prepare('PRAGMA table_info(examples)').all()).results.length); });
  await test('tester DB role lookup error denies access', async () => { state.fail = true; await assert.rejects(() => db.getDB(), /memverifikasi/); state.fail = false; });
  await test('retired unauthenticated maintenance routes cannot mutate DB', async () => { for (const name of ['migrate', 'update-db']) { const route = load('app/api/' + name + '/route.ts'); const result = await route.GET(); assert.equal(result.status, 410); assert.equal(result.headers.get('Cache-Control'), 'no-store'); } assert.equal(sql.prepare('SELECT value FROM examples').get().value, 10); });
  await test('noncanonical BRIVA aliases sanitize missing configuration without unhandled exception', async () => { for(const kind of ['inquiry','payment']) { const route=load('app/api/v1.0/transfer-va/'+kind+'/route.ts');const r=await route.POST(new Request('https://synthetic.test',{method:'POST',body:'{}'}));assert.equal(r.status,500);assert.equal(r.headers.get('Cache-Control'),'no-store');const b=await r.json();assert.equal(b.responseCode,kind==='inquiry'?'5002400':'5002500');assert.equal(b.responseMessage,'General Error'); } });
  await test('credential forms cannot leak passwords through default GET before hydration', async () => { for (const file of ['app/login/login-form.tsx', 'app/portal-ortu/login/_login-form.tsx']) assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /<form\s+method="post"/); });
  await test('permission lookup failure cannot grant page access', async () => { const guard=load('lib/auth/guard.ts'); await assert.rejects(()=>guard.guardPage('/dashboard/pengaturan/users'),/NEXT_REDIRECT \/dashboard/); });
  await test('login ignores existing demo session routing and cannot mint a production admin from demo credentials', async () => {
    const login=load('lib/auth/login-account.ts');
    const primary={id:'shared-id',email:'admin@fixture.test',role:'admin',roles:'["admin"]',password_hash:'synthetic-primary-hash'};
    const demo={...primary,password_hash:'synthetic-demo-hash'};
    const binding=row=>({prepare:()=>({bind:()=>({first:async()=>row})})});
    try{
      state.identityEnv={DB:binding(primary),DEMO_DB:binding(demo)};
      assert.equal((await login.findLoginAccount(primary.email)).user.password_hash,primary.password_hash);
      state.identityEnv={DB:binding(null),DEMO_DB:binding(demo)};
      assert.equal(await login.findLoginAccount(primary.email),null);
      state.identityEnv={DB:binding({...primary,role:'demo',roles:'["demo"]'}),DEMO_DB:binding({...demo,role:'demo',roles:'["demo"]'})};
      const account=await login.findLoginAccount(primary.email);assert.equal(account.demoSandbox,true);assert.equal(account.user.password_hash,demo.password_hash);
      for(const file of ['app/login/actions.ts','app/api/auth/login/route.ts'])assert.match(fs.readFileSync(path.join(root,file),'utf8'),/findLoginAccount\(normalizedEmail\)/);
    } finally {delete state.identityEnv;}
  });
  await test('staff and parent APIs reject malformed JSON and non-string credentials as validation errors', async () => {
    for (const name of ['auth', 'portal-ortu']) {
      const route=load('app/api/'+name+'/login/route.ts');
      for(const body of ['{', 'null', '[]', '{}', '{"email":42,"nis":42,"password":{}}']) {
        const response=await route.POST(new Request('https://synthetic.test/login',{method:'POST',headers:{'content-type':'application/json'},body}));
        assert.equal(response.status,400);
      }
    }
  });
  console.log('ALL ' + passed + ' SECURITY REGRESSION CASES PASSED');
  sql.close();
}
main().catch(e => { console.error(e); process.exitCode = 1; });
