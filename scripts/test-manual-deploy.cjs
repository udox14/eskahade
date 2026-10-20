/* Configuration-only negative tests. Never builds or deploys a Worker. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const yaml = require('yaml');
const ts = require('typescript');
const { validateManualDeployment: validate } = require('./validate-manual-deploy.cjs');
const config = ts.parseConfigFileTextToJson('wrangler.jsonc', fs.readFileSync('wrangler.jsonc', 'utf8')).config;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
for (const target of ['production', 'sandbox']) {
  const worker = target === 'production' ? 'eskahade' : 'eskahade-sandbox';
  const context = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'udox14/eskahade', GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567', ESKAHADE_AUTOMATED_RELEASE: 'true', CLOUDFLARE_ENV: target === 'production' ? '' : 'sandbox' };
  test(target + ' accepts automated main release with exact commit SHA', () => validate(config, target, context));
  for (const patch of [{ GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/heads/unreviewed' }, { GITHUB_REPOSITORY: 'untrusted/fork' }, { GITHUB_SHA: 'short' }, { CLOUDFLARE_ENV: target === 'production' ? 'sandbox' : '' }, { CLOUDFLARE_ACCOUNT_ID: 'unexpected' }]) test(target + ' rejects ' + Object.keys(patch)[0] + ' override ' + Object.values(patch)[0], () => assert.throws(() => validate(config, target, { ...context, ...patch })));
  test(target + ' rejects cross-environment DB', () => { const bad = structuredClone(config); (target === 'production' ? bad : bad.env.sandbox).d1_databases[0].database_id = target === 'production' ? config.env.sandbox.d1_databases[0].database_id : config.d1_databases[0].database_id; assert.throws(() => validate(bad, target, context)); });
  test(target + ' rejects bank activation', () => { const bad = structuredClone(config); (target === 'production' ? bad : bad.env.sandbox).vars.BRI_OUTBOUND_ENABLED = 'true'; assert.throws(() => validate(bad, target, context)); });
  test(target + ' rejects historical preview activation', () => { const bad = structuredClone(config); (target === 'production' ? bad : bad.env.sandbox).preview_urls = true; assert.throws(() => validate(bad, target, context)); });
}
test('one main push workflow serializes sandbox then production from one immutable build', () => {
  const workflow = yaml.parse(fs.readFileSync('.github/workflows/release.yml', 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.concurrency, { group: 'eskahade-main-release', 'cancel-in-progress': false });
  assert.deepEqual(Object.keys(workflow.jobs), ['validate-build-test', 'deploy-sandbox', 'deploy-production']);
  assert.equal(workflow.jobs['deploy-production'].needs, 'deploy-sandbox');
  assert.equal(workflow.jobs['deploy-sandbox'].needs, 'validate-build-test');
  const content = fs.readFileSync('.github/workflows/release.yml', 'utf8');
  assert.doesNotMatch(content, /workflow_dispatch/);
  assert.match(content, /scripts\/ci\/smoke-http\.cjs sandbox/);
  assert.match(content, /scripts\/ci\/smoke-http\.cjs production/);
  assert.match(content, /--experimental-provision=false/);
  assert.match(content, /--experimental-auto-create=false/);
  assert.doesNotMatch(content, /d1\s+(execute|migrations)/);
  assert.doesNotMatch(content, /environment:/); // No required-reviewer gate on normal releases.
});
test('production refuses any DEMO_DB binding', () => { const bad = structuredClone(config); bad.d1_databases.push(bad.env.sandbox.d1_databases[1]); assert.throws(() => validate(bad, 'production', {})); });
test('missing environment never defaults to production', () => assert.throws(() => validate(config, undefined, {})));
console.log(JSON.stringify({ passed, failed: 0, remoteOperations: 0 }));

