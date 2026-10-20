/* eslint-disable @typescript-eslint/no-require-imports -- Negative configuration tests, no remote access. */
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), assert = require('node:assert/strict'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..'), out = path.join(root, 'output/permanent-isolation-20261020'); fs.mkdirSync(out, { recursive: true });
const config = ts.parseConfigFileTextToJson('wrangler.jsonc', fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8')).config;
const cases = [
  ['valid permanent topology', () => {}, true],
  ['production DEMO_DB reintroduced', c => c.d1_databases.push(c.env.sandbox.d1_databases[1])],
  ['production DB points to demo', c => { c.d1_databases[0] = c.env.sandbox.d1_databases[0]; }],
  ['sandbox DB points to production', c => { c.env.sandbox.d1_databases[0] = c.d1_databases[0]; }],
  ['missing sandbox DEMO_DB', c => c.env.sandbox.d1_databases.pop()],
  ['missing explicit environment', c => { delete c.vars.ESKAHADE_ENV; }],
  ['BRI enabled', c => { c.env.sandbox.vars.BRI_OUTBOUND_ENABLED = 'true'; }],
  ['preview route enabled', c => { c.preview_urls = true; }],
  ['sandbox service invokes production', c => { c.env.sandbox.services[0].service = 'eskahade'; }],
  ['unsafe binding inheritance', c => { c.unsafe = { metadata: { keep_bindings: ['d1'] } }; }],
  ['unknown proxy service from sandbox', c => { c.env.sandbox.services.push({ binding: 'PROXY', service: 'other-worker' }); }],
];
const results = [];
for (const [name, mutate, valid = false] of cases) {
  const copy = structuredClone(config); mutate(copy); const file = path.join(out, 'config-negative-fixture.json'); fs.writeFileSync(file, JSON.stringify(copy));
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/validate-sandbox-config.cjs'), file], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status === 0, valid, name + ': ' + r.stdout + r.stderr);
  results.push({ name, expected: valid ? 'PASS' : 'DENY', status: 'PASS' }); console.log('PASS ' + name);
}
const workflows = ['deploy.yml', 'deploy-sandbox.yml'];
for (const file of workflows) { const source = fs.readFileSync(path.join(root, '.github/workflows', file), 'utf8'); const triggers = source.split('jobs:')[0]; assert.match(triggers, /workflow_dispatch:/); assert.doesNotMatch(triggers, /\b(push|pull_request|schedule):/); assert.match(source, /validate-sandbox-config/); }
results.push({ name: 'Both deployment workflows require manual dispatch and isolation validation', status: 'PASS' });
for (const file of fs.readdirSync(path.join(root, 'migrations/sandbox-recovery'))) {
  const { execFileSync } = require('node:child_process');
  const git = execFileSync('git', ['-c', 'core.fsmonitor=false', 'show', 'ade5b89b837a82fe824f9f61aff055d50f893674:migrations/sandbox-recovery/' + file], { cwd: root, encoding: 'utf8' });
  const current = fs.readFileSync(path.join(root, 'migrations/sandbox-recovery', file), 'utf8');
  const packed = fs.readFileSync(path.join(root, 'output/eskahade-sandbox-recovery-ade5b89b-20261019/sandbox-sql', file), 'utf8');
  assert.equal(current.replaceAll('\r\n', '\n'), git.replaceAll('\r\n', '\n')); assert.equal(current.replaceAll('\r\n', '\n'), packed.replaceAll('\r\n', '\n'));
}
results.push({ name: '0192–0195 equal exact original Git and approved package SQL after EOL-only normalization', status: 'PASS' });
fs.writeFileSync(path.join(out, 'config-tests.json'), JSON.stringify({ passed: results.length, failed: 0, results, remoteMutations: 0 }, null, 2));
