/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node verification tooling. */
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..'), out = path.resolve(root, process.env.ESKAHADE_EVIDENCE_DIR || 'output/stabilization-20261019');
const base = 'http://localhost:3100';
async function main() {
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@fixture.test', password: 'LocalFixture!2026' }) });
  if (!login.ok) throw Error('Synthetic login failed: ' + login.status);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw Error('Missing synthetic session cookie');
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'output/stabilization-20261019/application-inventory.json'), 'utf8'));
  const pages = [...new Set(inventory.routes.filter(r => r.kind === 'page' && !r.route.includes('[') && !r.route.startsWith('/portal-ortu/')).map(r => r.route))];
  const results = [];
  // Sequential compilation avoids concurrent webpack memory spikes on Windows.
  for (const route of pages) {
    const started = Date.now();
    let row;
    try {
      const response = await fetch(base + route, { headers: { cookie }, signal: AbortSignal.timeout(120000) });
      const html = await response.text();
      const errors = [...html.matchAll(/(?:Error:|D1_ERROR|no such (?:table|column)|Application error:|Internal Server Error)[^<\n]{0,180}/g)].map(m => m[0]).filter(m => !m.includes('duplicate column name:'));
      row = { route, status: response.status, finalUrl: response.url, durationMs: Date.now() - started, errors: [...new Set(errors)].slice(0, 5), result: response.ok && !errors.length ? 'PASS_SSR' : 'FAIL' };
    } catch (e) { row = { route, result: 'FAIL', error: e.message, durationMs: Date.now() - started }; }
    results.push(row);
    fs.writeFileSync(path.join(out, 'http-smoke.json'), JSON.stringify({ generatedAt: new Date().toISOString(), mode: 'Actual Next.js HTTP pages, synthetic admin; not browser hydration or role authorization coverage', planned: pages.length, results }, null, 2));
    console.log(row.result + ' ' + route + ' ' + row.status + ' ' + row.durationMs + 'ms');
  }
  process.exitCode = results.some(r => r.result === 'FAIL') ? 1 : 0;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
