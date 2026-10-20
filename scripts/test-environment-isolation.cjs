/* eslint-disable @typescript-eslint/no-require-imports -- Actual modules, synthetic SQLite bindings and concurrent request contexts only. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks'), { DatabaseSync } = require('node:sqlite'), ts = require('typescript');
const root = path.resolve(__dirname, '..'), context = new AsyncLocalStorage(), results = [];
process.env.JWT_SECRET = 'synthetic-environment-isolation-only';
function database(label) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,password_hash TEXT,full_name TEXT,role TEXT,roles TEXT,asrama_binaan TEXT,structural_jabatan TEXT,avatar_url TEXT,psb_verifikasi_akses INTEGER,psb_asrama_akses INTEGER,psb_bayar_akses INTEGER,upk_panitia_akses INTEGER,guru_id INTEGER,santri_id TEXT);
    CREATE TABLE santri(id TEXT PRIMARY KEY,nis TEXT,nama_lengkap TEXT,status_global TEXT,tanggal_lahir TEXT,asrama TEXT,kamar TEXT,bebas_spp INTEGER,kategori_santri TEXT,foto_url TEXT);
    INSERT INTO santri VALUES('student','99001','Synthetic','aktif',NULL,'AL-FALAH','1',0,'REGULER',NULL);
    CREATE TABLE portal_ortu_credentials(santri_id TEXT PRIMARY KEY,password_hash TEXT,is_active INTEGER,must_change_password INTEGER,token_version INTEGER,last_login_at TEXT,updated_at TEXT);
    CREATE TABLE portal_login_throttle(santri_id TEXT PRIMARY KEY,failed_attempts INTEGER,locked_until TEXT,updated_at TEXT);
    CREATE TABLE synthetic_payment(id TEXT PRIMARY KEY,amount INTEGER CHECK(amount>0));
    CREATE TABLE synthetic_allocation(id TEXT PRIMARY KEY,payment_id TEXT REFERENCES synthetic_payment(id),amount INTEGER CHECK(amount>0));`);
  // Real finance DDL/guards from repository migrations, without copying any records.
  const financeSchema = require('./finance-remediation-fixture.cjs').createDatabase();
  for (const row of financeSchema.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND (name LIKE 'finance_%' OR name='app_settings')").all()) sql.exec(row.sql);
  for (const row of financeSchema.prepare("SELECT sql FROM sqlite_schema WHERE type='trigger' AND tbl_name='finance_wallet_ledger'").all()) sql.exec(row.sql);
  financeSchema.close();
  sql.exec('ALTER TABLE santri ADD COLUMN saldo_uang_jajan INTEGER NOT NULL DEFAULT 0; ALTER TABLE santri ADD COLUMN updated_at TEXT;');
  let writes = 0;
  const binding = { label, sql, get writes() { return writes; }, prepare(text) {
    let p = [];
    const s = { bind(...args) { p = args; return s; }, async first() { return sql.prepare(text).get(...p) || null; }, async all() { return { results: sql.prepare(text).all(...p) }; }, perform() { const r = sql.prepare(text).run(...p); writes += Number(r.changes); return { success: true }; }, async run() { return s.perform(); } }; return s;
  }, async batch(statements) { sql.exec('BEGIN'); try { const r = statements.map(s => s.perform()); sql.exec('COMMIT'); return r; } catch (e) { sql.exec('ROLLBACK'); throw e; } } };
  return binding;
}
const primary = database('PRIMARY'), sandbox = database('SANDBOX');
const environments = { production: { ESKAHADE_ENV: 'production', DB: primary }, sandbox: { ESKAHADE_ENV: 'sandbox', DB: sandbox, DEMO_DB: sandbox } };
const original = Module._load;
Module._load = function(r, p, m) {
  if (r === '@opennextjs/cloudflare') return { getCloudflareContext: async () => ({ env: context.getStore().env }) };
  if (r === 'react') return { ...original.call(this, r, p, m), cache: fn => fn };
  if (r === 'next/headers') return { cookies: async () => ({ get: key => { const v = context.getStore().cookies[key]; return v ? { value: v } : undefined; }, set: item => { context.getStore().cookies[item.name] = item.value; }, delete: key => { delete context.getStore().cookies[key]; } }) };
  if (r === 'next/navigation') return { redirect: url => { throw Error('NEXT_REDIRECT ' + url); } };
  if (r === '@/lib/activity-log') return { logActivity: async () => {}, getRequestAuditContext: async () => ({}) };
  if (r === '@/lib/auth/feature') return { canAccessFeatureForSession: async () => true };
  if (r.startsWith('@/')) r = path.join(root, r.slice(2));
  return original.call(this, r, p, m);
};
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const db = require('../lib/db/index.ts'), policy = require('../lib/db/environment.ts'), session = require('../lib/auth/session.ts'), portal = require('../lib/portal/session.ts');
const login = require('../app/api/auth/login/route.ts'), guard = require('../lib/auth/guard.ts'), finance = require('../lib/finance/authorization.ts');
const reset = require('../app/api/demo/reset/route.ts'), proofs = require('../lib/r2/private-proofs.ts');
const run = (mode, cookies, fn, env = environments[mode]) => context.run({ env, cookies: { ...cookies } }, fn);
async function test(name, fn) { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
const request = body => new Request('http://synthetic.invalid/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function main() {
  const { hashPassword } = require('../lib/auth/password.ts');
  for (const [binding, password] of [[primary, 'SyntheticPrimary!2026'], [sandbox, 'SyntheticSandbox!2026']]) {
    const hash = await hashPassword(password);
    for (const [id, role, roles] of [['normal', 'bendahara', '["bendahara"]'], ['demo', 'demo', '["demo"]'], ['mixed', 'admin', '["admin","demo"]']]) binding.sql.prepare('INSERT INTO users(id,email,password_hash,full_name,role,roles) VALUES(?,?,?,?,?,?)').run(id, id + '@synthetic.invalid', hash, binding.label, role, roles);
    binding.sql.prepare('INSERT INTO portal_ortu_credentials(santri_id,password_hash,is_active,must_change_password,token_version) VALUES(?,?,1,0,1)').run('student', hash);
  }
  let primaryCookie, sandboxCookie, demoCookie;
  await test('Normal production API login uses only primary credentials and stamps environment', async () => {
    await run('production', {}, async () => { const r = await login.POST(request({ email: 'normal@synthetic.invalid', password: 'SyntheticPrimary!2026' })); assert.equal(r.status, 200); primaryCookie = r.headers.get('set-cookie').split(';')[0].split('=')[1]; const s = await session.verifyJWTToken(primaryCookie); assert.equal(s.environment, 'production'); });
  });
  await test('Sandbox normal and demo login use only sandbox credentials', async () => {
    await run('sandbox', {}, async () => { for (const who of ['normal', 'demo']) { const r = await login.POST(request({ email: who + '@synthetic.invalid', password: 'SyntheticSandbox!2026' })); assert.equal(r.status, 200); const token = r.headers.get('set-cookie').split(';')[0].split('=')[1]; if (who === 'normal') sandboxCookie = token; else demoCookie = token; assert.equal((await session.verifyJWTToken(token)).environment, 'sandbox'); } });
  });
  await test('Production rejects demo and admin+demo stored roles without deleting users', async () => {
    const count = primary.sql.prepare('SELECT COUNT(*) n FROM users').get().n;
    await run('production', {}, async () => { for (const who of ['demo', 'mixed']) assert.equal((await login.POST(request({ email: who + '@synthetic.invalid', password: 'SyntheticPrimary!2026' }))).status, 401); });
    assert.equal(primary.sql.prepare('SELECT COUNT(*) n FROM users').get().n, count);
  });
  await test('Missing accounts/invalid credentials never fall back to the other database', async () => {
    await run('production', {}, async () => assert.equal((await login.POST(request({ email: 'normal@synthetic.invalid', password: 'SyntheticSandbox!2026' }))).status, 401));
    await run('sandbox', {}, async () => assert.equal((await login.POST(request({ email: 'normal@synthetic.invalid', password: 'SyntheticPrimary!2026' }))).status, 401));
  });
  await test('Normal staff sessions hydrate on their own Worker and guard dashboard/finance', async () => {
    for (const [mode, token] of [['production', primaryCookie], ['sandbox', sandboxCookie]]) await run(mode, { eskahade_session: token }, async () => { assert.equal((await session.getSession()).full_name, mode === 'production' ? 'PRIMARY' : 'SANDBOX'); assert.ok(await guard.guardPage('/dashboard/keuangan')); assert.ok(await finance.authorizeFinanceFeature('/dashboard/keuangan', true)); });
  });
  await test('Signed demo, legacy demo and sandbox sessions cannot use production DB or proof reader', async () => {
    const legacy = await session.createJWTToken({ id: 'demo', role: 'demo', roles: ['demo'], demoSandbox: true });
    const before = primary.writes;
    for (const token of [demoCookie, sandboxCookie, legacy]) await run('production', { eskahade_session: token }, async () => { assert.equal(await session.getSession(), null); assert.equal(await session.getSessionFromCookieString('eskahade_session=' + token), null); await assert.rejects(() => db.getDB(), /Sesi/); await assert.rejects(() => finance.authorizeFinanceFeature('/dashboard/keuangan', true), /UNAUTHORIZED|Unauthorized|FORBIDDEN|autentikasi|login/i); });
    assert.equal(primary.writes, before);
  });
  await test('Unscoped legacy sessions require re-login; cross-environment tokens are denied', async () => {
    const legacy = await session.createJWTToken({ id: 'normal', role: 'bendahara', roles: ['bendahara'] });
    await run('production', { eskahade_session: legacy }, async () => assert.equal(await session.getSession(), null));
    await run('sandbox', { eskahade_session: primaryCookie }, async () => { assert.equal(await session.getSession(), null); await assert.rejects(() => db.getDB(), /Sesi/); });
  });
  await test('40 concurrent financial batches stay on primary/sandbox with no cookie-driven routing', async () => {
    await Promise.all(Array.from({ length: 40 }, (_, i) => { const mode = i % 2 ? 'sandbox' : 'production', token = i % 2 ? demoCookie : primaryCookie; return run(mode, { eskahade_session: token }, async () => { await finance.authorizeFinanceFeature('/dashboard/keuangan', true); await db.batch([{ sql: 'INSERT INTO synthetic_payment VALUES(?,100)', params: [String(i)] }, { sql: 'INSERT INTO synthetic_allocation VALUES(?,?,100)', params: [String(i), String(i)] }]); }); }));
    for (const binding of [primary, sandbox]) assert.equal(binding.sql.prepare('SELECT COUNT(*) n,SUM(amount) total FROM synthetic_payment').get().total, 2000);
  });
  await test('Actual wallet engine posts ledger/projection atomically to each Worker DB only', async () => {
    const wallet = require('../lib/finance/wallet.ts');
    for (const [mode, token, amount, expectedOther] of [['production', primaryCookie, 700, 0], ['sandbox', demoCookie, 900, 700]]) {
      await run(mode, { eskahade_session: token }, async () => { await finance.authorizeFinanceFeature('/dashboard/keuangan', true); const entry = await wallet.recordWalletMutation({ santriId: 'student', direction: 'IN', movementType: 'TOPUP_CASH', amount, operatorId: 'normal' }); assert.equal(entry.amount, amount); });
      const target = mode === 'production' ? primary : sandbox, other = mode === 'production' ? sandbox : primary;
      assert.equal(target.sql.prepare('SELECT SUM(amount) n FROM finance_wallet_ledger').get().n, amount);
      assert.equal(target.sql.prepare("SELECT saldo_uang_jajan n FROM santri WHERE id='student'").get().n, amount);
      assert.equal(other.sql.prepare('SELECT COALESCE(SUM(amount),0) n FROM finance_wallet_ledger').get().n, expectedOther);
    }
    const before = primary.writes;
    await run('production', { eskahade_session: demoCookie }, async () => { await assert.rejects(() => wallet.recordWalletMutation({ santriId: 'student', direction: 'IN', movementType: 'TOPUP_CASH', amount: 1 }), /Sesi/); });
    assert.equal(primary.writes, before);
  });
  await test('Production account changed to demo invalidates old normal token before financial writes', async () => {
    primary.sql.exec(`UPDATE users SET roles='["demo"]' WHERE id='normal'`);
    await run('production', { eskahade_session: primaryCookie }, async () => { assert.equal(await session.getSession(), null); await assert.rejects(() => db.getDB(), /memverifikasi/); });
    primary.sql.exec(`UPDATE users SET roles='["bendahara"]' WHERE id='normal'`);
  });
  await test('Revoked or corrupt stored roles never recover authority from an old signed token', async () => {
    for (const [mode, binding, token] of [['production', primary, primaryCookie], ['sandbox', sandbox, sandboxCookie]]) {
      for (const [role, roles] of [[null, null], ['', null], ['bendahara', '[]'], ['bendahara', '{broken'], ['bendahara', '["bendahara",null]'], ['bendahara', '["admin"]']]) {
        binding.sql.prepare("UPDATE users SET role=?,roles=? WHERE id='normal'").run(role, roles);
        const before = binding.writes;
        await run(mode, { eskahade_session: token }, async () => {
          assert.equal(await session.getSession(), null);
          assert.equal(await require('../lib/r2/read-session.ts').readProofStaffSession(), null);
          await assert.rejects(() => db.getDB(), /memverifikasi/);
          await assert.rejects(() => finance.authorizeFinanceFeature('/dashboard/keuangan', true));
        });
        assert.equal(binding.writes, before);
        await run(mode, {}, async () => assert.equal((await login.POST(request({ email: 'normal@synthetic.invalid', password: mode === 'production' ? 'SyntheticPrimary!2026' : 'SyntheticSandbox!2026' }))).status, 401));
      }
      binding.sql.prepare("UPDATE users SET role='bendahara',roles='[\"bendahara\"]' WHERE id='normal'").run();
    }
  });
  await test('Legacy null roles and exact observed tester encoding use only the current stored role', async () => {
    for (const [role, roles] of [['bendahara', null], ['tester', '[tester]']]) {
      primary.sql.prepare("UPDATE users SET role=?,roles=? WHERE id='normal'").run(role, roles);
      await run('production', { eskahade_session: primaryCookie }, async () => assert.deepEqual((await session.getSession()).roles, [role]));
      await run('production', {}, async () => assert.equal((await login.POST(request({ email: 'normal@synthetic.invalid', password: 'SyntheticPrimary!2026' }))).status, 200));
    }
    primary.sql.prepare("UPDATE users SET role=NULL WHERE id='normal'").run();
    await run('production', { eskahade_session: primaryCookie }, async () => assert.equal(await session.getSession(), null));
    primary.sql.prepare("UPDATE users SET role='bendahara',roles='[\"bendahara\"]' WHERE id='normal'").run();
  });
  await test('Missing mode/DB/sandbox binding and unexpected production DEMO_DB fail closed', async () => {
    for (const env of [{ DB: primary }, { ESKAHADE_ENV: 'sandbox', DEMO_DB: sandbox }, { ESKAHADE_ENV: 'sandbox', DB: sandbox }, { ESKAHADE_ENV: 'production' }, { ESKAHADE_ENV: 'production', DB: primary, DEMO_DB: sandbox }]) {
      assert.throws(() => policy.environmentDatabase(env));
      await run('production', {}, async () => { await assert.rejects(() => db.getDB()); assert.equal((await login.POST(request({ email: 'normal@synthetic.invalid', password: 'SyntheticPrimary!2026' }))).status, 500); }, env);
    }
  });
  await test('Portal Ortu login/session work separately and reject cross-environment portal token', async () => {
    const portalLogin = require('../app/api/portal-ortu/login/route.ts'); let token;
    for (const [mode, password] of [['production', 'SyntheticPrimary!2026'], ['sandbox', 'SyntheticSandbox!2026']]) await run(mode, {}, async () => {
      const r = await portalLogin.POST(new Request('http://synthetic.invalid/portal', { method: 'POST', body: JSON.stringify({ nis: '99001', password }) })); assert.equal(r.status, 200);
      token = r.headers.get('set-cookie').split(';')[0].split('=')[1]; context.getStore().cookies.eskahade_portal_session = token; assert.equal((await portal.getPortalSession()).santri_id, 'student');
    });
    await run('production', { eskahade_portal_session: token }, async () => assert.equal(await portal.getPortalSession(), null));
  });
  await test('Parent login discards rejected sandbox staff cookie without using it as parent identity', async () => {
    const portalLogin = require('../app/api/portal-ortu/login/route.ts');
    await run('production', { eskahade_session: demoCookie }, async () => {
      const r = await portalLogin.POST(new Request('http://synthetic.invalid/portal', { method: 'POST', body: JSON.stringify({ nis: '99001', password: 'SyntheticPrimary!2026' }) }));
      assert.equal(r.status, 200); assert.equal(context.getStore().cookies.eskahade_session, undefined);
      const token = r.headers.get('set-cookie').split(';')[0].split('=')[1]; assert.equal((await session.verifyJWTToken(token)).environment, 'production');
    });
  });
  await test('Proof metadata uses Worker environment even for sandbox staff without demo role', async () => {
    await run('production', {}, async () => assert.equal(await proofs.proofDataset(), 'production'));
    await run('sandbox', {}, async () => assert.equal(await proofs.proofDataset(), 'demo'));
  });
  await test('Reset endpoint is 410 in both environments with zero DB access/writes', async () => {
    const before = [primary.writes, sandbox.writes];
    for (const mode of ['production', 'sandbox']) await run(mode, {}, async () => { const r = await reset.POST(); assert.equal(r.status, 410); assert.equal(r.headers.get('cache-control'), 'no-store'); });
    assert.deepEqual([primary.writes, sandbox.writes], before);
  });
  const dir = path.resolve(root, process.env.ESKAHADE_EVIDENCE_DIR || 'output/permanent-isolation-20261020'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'isolation-unit.json'), JSON.stringify({ passed: results.length, failed: 0, results, localOnly: true, remoteMutations: 0 }, null, 2));
  primary.sql.close(); sandbox.sql.close();
}
main().catch(e => { console.error(e); process.exitCode = 1; });
