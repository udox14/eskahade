/* eslint-disable @typescript-eslint/no-require-imports -- Real LOCAL workerd HTTP; fixture accounts only, no bank or remote resources. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const out = path.resolve(process.env.ESKAHADE_EVIDENCE_DIR || path.join(__dirname, '../../../output/permanent-isolation-20261020')), results = [], responses = [];
const origins = { production: 'http://127.0.0.1:3100', sandbox: 'http://localhost:3101' };
async function request(mode, route, options = {}) {
  if (!route.startsWith('/') || route.startsWith('//')) throw Error('Local path required');
  const response = await fetch(origins[mode] + route, { ...options, redirect: 'manual', signal: AbortSignal.timeout(45000) });
  responses.push({mode, route, method:options.method || 'GET', status:response.status});
  return response;
}
async function test(name, fn) { try { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); } catch (error) { results.push({ name, status: 'FAIL', error: error.message }); console.error('FAIL ' + name + ': ' + error.message); } }
async function login(mode, email, password) {
  const response = await request(mode, '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function denied(mode, route, cookie, target) {
  const response = await request(mode, route, { headers: { cookie } });
  if (response.status === 307 || response.status === 303) { assert.equal(new URL(response.headers.get('location'), origins[mode]).pathname, target); return; }
  assert.equal(response.status, 200); const html = await response.text(); assert.match(html, /NEXT_REDIRECT|http-equiv="refresh"/); assert.ok(html.includes(target));
}
async function main() {
  const staff = {}, parents = {};
  for (const mode of ['production', 'sandbox']) {
    await test(mode + ' normal staff API login', async () => {
      staff[mode] = await login(mode, 'admin@fixture.test', mode === 'production' ? 'LocalFixture!2026' : 'DemoImpostor!2026'); assert.equal(staff[mode].response.status, 200); assert.ok(staff[mode].cookie);
      const payload = JSON.parse(Buffer.from(staff[mode].cookie.split('=')[1].split('.')[1], 'base64url')); assert.equal(payload.environment, mode);
    });
    for (const route of ['/dashboard', '/dashboard/santri', '/dashboard/master/kelas', '/dashboard/keuangan', '/dashboard/keuangan/status-pembayaran', '/dashboard/koperasi/loket', '/dashboard/keuangan/uang-jajan', '/dashboard/pengaturan/fitur-akses']) await test(mode + ' authenticated ' + route, async () => {
      const r = await request(mode, route, { headers: { cookie: staff[mode]?.cookie || '' } }); assert.equal(r.status, 200); const html = await r.text(); assert.doesNotMatch(html, /Application error:|D1_ERROR|id="__next_error__"/); assert.doesNotMatch(html, /NEXT_REDIRECT/); if (route.endsWith('fitur-akses')) assert.doesNotMatch(html, /Reset Data Demo/);
    });
    await test(mode + ' Portal Ortu login', async () => { const r = await request(mode, '/api/portal-ortu/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nis: '99001', password: 'LocalFixture!2026' }) }); assert.equal(r.status, 200); parents[mode] = r.headers.get('set-cookie').split(';')[0]; });
    for (const route of ['/portal-ortu/beranda', '/portal-ortu/tagihan', '/portal-ortu/riwayat', '/portal-ortu/akun']) await test(mode + ' authenticated ' + route, async () => { const r = await request(mode, route, { headers: { cookie: parents[mode] || '' } }); assert.equal(r.status, 200); assert.doesNotMatch(await r.text(), /Application error:|D1_ERROR|NEXT_REDIRECT|id="__next_error__"/); });
    await test(mode + ' reset retired', async () => { const r = await request(mode, '/api/demo/reset', { method: 'POST', headers: { cookie: staff[mode]?.cookie || '' } }); assert.equal(r.status, 410); assert.match(r.headers.get('cache-control'), /no-store/); });
    await test(mode + ' private proof denies unknown key', async () => { const r = await request(mode, '/api/finance/proofs/proofs/financial/missing.jpg', { headers: { cookie: staff[mode]?.cookie || '' } }); assert.equal(r.status, 404); });
    await test(mode + ' bank inbound disabled without financial write', async () => { const r = await request(mode, '/api/bri/v1.0/transfer-va/payment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); assert.ok([401, 403, 500, 503].includes(r.status)); assert.doesNotMatch(await r.text(), /PRIVATE_KEY|CLIENT_SECRET|Bearer /); });
    await test(mode + ' normal guru login retains admin-page denial', async () => { const guru = await login(mode, 'guru@fixture.test', 'LocalFixture!2026'); assert.equal(guru.response.status, 200); await denied(mode, '/dashboard/pengaturan/fitur-akses', guru.cookie || '', '/dashboard'); });
  }
  let demo;
  await test('sandbox demo login remains available', async () => { demo = await login('sandbox', 'demo@fixture.test', 'LocalFixture!2026'); assert.equal(demo.response.status, 200); });
  await test('sandbox demo dashboard and finance remain available', async () => { for (const route of ['/dashboard', '/dashboard/keuangan']) { const r = await request('sandbox', route, { headers: { cookie: demo?.cookie || '' } }); assert.equal(r.status, 200); assert.doesNotMatch(await r.text(), /Application error:|D1_ERROR|NEXT_REDIRECT/); } });
  await test('production demo login denied with valid synthetic demo password', async () => assert.equal((await login('production', 'demo@fixture.test', 'LocalFixture!2026')).response.status, 401));
  await test('production cannot authenticate sandbox admin credentials', async () => assert.equal((await login('production', 'admin@fixture.test', 'DemoImpostor!2026')).response.status, 401));
  await test('sandbox cannot authenticate primary admin credentials', async () => assert.equal((await login('sandbox', 'admin@fixture.test', 'LocalFixture!2026')).response.status, 401));
  await test('sandbox demo cookie denied by production dashboard and finance', async () => { for (const route of ['/dashboard', '/dashboard/keuangan']) await denied('production', route, demo?.cookie || '', '/login'); });
  await test('sandbox normal cookie denied by production and primary cookie denied by sandbox', async () => { await denied('production', '/dashboard', staff.sandbox?.cookie || '', '/login'); await denied('sandbox', '/dashboard', staff.production?.cookie || '', '/login'); });
  await test('Portal Ortu cross-environment sessions denied', async () => { await denied('production', '/portal-ortu/beranda', parents.sandbox || '', '/portal-ortu/login'); await denied('sandbox', '/portal-ortu/beranda', parents.production || '', '/portal-ortu/login'); });
  const report = { runtime: 'LOCAL workerd, two explicit environments, synthetic all-zero D1 bindings', passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status === 'FAIL').length, results, responses, remoteMutations: 0 };
  fs.writeFileSync(path.join(out, 'http-smoke.json'), JSON.stringify(report, null, 2)); if (report.failed) process.exitCode = 1;
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
