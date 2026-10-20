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
  const context = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'udox14/eskahade', ESKAHADE_CONFIRM_WORKER: worker, CLOUDFLARE_ENV: target === 'production' ? '' : 'sandbox' };
  test(target + ' explicit manual confirmation accepts correct isolated target', () => validate(config, target, context));
  for (const patch of [{ GITHUB_EVENT_NAME: 'push' }, { GITHUB_REF: 'refs/heads/unreviewed' }, { GITHUB_REPOSITORY: 'untrusted/fork' }, { ESKAHADE_CONFIRM_WORKER: '' }, { ESKAHADE_CONFIRM_WORKER: target === 'production' ? 'eskahade-sandbox' : 'eskahade' }, { CLOUDFLARE_ENV: target === 'production' ? 'sandbox' : '' }, { CLOUDFLARE_ACCOUNT_ID: 'unexpected' }]) test(target + ' rejects ' + Object.keys(patch)[0] + ' override ' + Object.values(patch)[0], () => assert.throws(() => validate(config, target, { ...context, ...patch })));
  test(target + ' rejects cross-environment DB', () => { const bad = structuredClone(config); (target === 'production' ? bad : bad.env.sandbox).d1_databases[0].database_id = target === 'production' ? config.env.sandbox.d1_databases[0].database_id : config.d1_databases[0].database_id; assert.throws(() => validate(bad, target, context)); });
  test(target + ' rejects bank activation', () => { const bad = structuredClone(config); (target === 'production' ? bad : bad.env.sandbox).vars.BRI_OUTBOUND_ENABLED = 'true'; assert.throws(() => validate(bad, target, context)); });
  test(target + ' rejects historical preview activation', () => { const bad = structuredClone(config); (target === 'production' ? bad : bad.env.sandbox).preview_urls = true; assert.throws(() => validate(bad, target, context)); });
  test(target + ' workflow has no automatic triggers or SQL', () => {
    const file = '.github/workflows/' + (target === 'production' ? 'deploy.yml' : 'deploy-sandbox.yml');
    const workflow = yaml.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
    assert.equal(workflow.on.workflow_dispatch.inputs.confirm_worker.required, true);
    assert.deepEqual(workflow.permissions, { contents: 'read' });
    const job = Object.values(workflow.jobs)[0];
    assert.equal(job.if, "github.ref == 'refs/heads/main'");
    assert.equal(job.env.CLOUDFLARE_ENV, target === 'production' ? '' : 'sandbox');
    const commands = job.steps.map(s => s.run || '').join('\n');
    assert.equal(job.steps.filter(s => s.run === 'node scripts/validate-manual-deploy.cjs ' + target).length, 2);
    assert.doesNotMatch(commands, /d1\s+(execute|migrations)|workflow\s+run|git\s+push|rm\s+-rf/);
    const deploy = job.steps.find(s => s.name?.startsWith('Deploy existing')).run;
    assert.match(deploy, /--config wrangler\.jsonc/);
    assert.ok(deploy.includes(target === 'production' ? '--env ""' : '--env sandbox'));
    assert.match(deploy, /--keep-vars/);assert.match(deploy, /--experimental-provision=false/);assert.match(deploy, /--experimental-auto-create=false/);
  });
}
test('production refuses any DEMO_DB binding', () => { const bad = structuredClone(config); bad.d1_databases.push(bad.env.sandbox.d1_databases[1]); assert.throws(() => validate(bad, 'production', {})); });
test('missing environment never defaults to production', () => assert.throws(() => validate(config, undefined, {})));
console.log(JSON.stringify({ passed, failed: 0, remoteOperations: 0 }));
