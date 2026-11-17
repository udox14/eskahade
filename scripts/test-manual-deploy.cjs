/* Configuration-only negative tests. Never builds or deploys a Worker. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const yaml = require('yaml');
const ts = require('typescript');
const { validateManualDeployment: validate } = require('./validate-manual-deploy.cjs');
const { prepareMigrationConfig, validateMigrationChanges } = require('./ci/release-migrations.cjs');
const config = ts.parseConfigFileTextToJson('wrangler.jsonc', fs.readFileSync('wrangler.jsonc', 'utf8')).config;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
for (const target of ['production', 'sandbox']) {
  const worker = target === 'production' ? 'eskahade' : 'eskahade-sandbox';
  const context = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'udox14/eskahade', GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567', ESKAHADE_AUTOMATED_RELEASE: 'true', CLOUDFLARE_ENV: target === 'production' ? '' : 'sandbox' };
  test(target + ' accepts automated main release with exact commit SHA', () => validate(config, target, context));
  test(target + ' accepts validation-only PR targeting main', () => validate(config, target, { ...context, GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/pull/6/merge', GITHUB_BASE_REF: 'main' }));
  for (const patch of [{ GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/heads/unreviewed' }, { GITHUB_REPOSITORY: 'untrusted/fork' }, { GITHUB_SHA: 'short' }, { CLOUDFLARE_ENV: target === 'production' ? 'sandbox' : '' }, { CLOUDFLARE_ACCOUNT_ID: 'unexpected' }]) test(target + ' rejects ' + Object.keys(patch)[0] + ' override ' + Object.values(patch)[0], () => assert.throws(() => validate(config, target, { ...context, ...patch })));
  test(target + ' rejects cross-environment DB', () => { const bad = structuredClone(config); (target === 'production' ? bad : bad.env.sandbox).d1_databases[0].database_id = target === 'production' ? config.env.sandbox.d1_databases[0].database_id : config.d1_databases[0].database_id; assert.throws(() => validate(bad, target, context)); });
  test(target + ' rejects bank activation', () => { const bad = structuredClone(config); (target === 'production' ? bad : bad.env.sandbox).vars.BRI_OUTBOUND_ENABLED = 'true'; assert.throws(() => validate(bad, target, context)); });
  test(target + ' rejects historical preview activation', () => { const bad = structuredClone(config); (target === 'production' ? bad : bad.env.sandbox).preview_urls = true; assert.throws(() => validate(bad, target, context)); });
}
test('one main push workflow serializes sandbox then production from one immutable build', () => {
  const workflow = yaml.parse(fs.readFileSync('.github/workflows/release.yml', 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.deepEqual(workflow.on.pull_request.branches, ['main']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.concurrency, { group: 'eskahade-main-release', 'cancel-in-progress': false });
  assert.deepEqual(Object.keys(workflow.jobs), ['validate-build-test', 'deploy-sandbox', 'deploy-production']);
  assert.equal(workflow.jobs['deploy-production'].needs, 'deploy-sandbox');
  assert.equal(workflow.jobs['deploy-sandbox'].needs, 'validate-build-test');
  assert.equal(workflow.jobs['deploy-sandbox'].if, "github.event_name == 'push'");
  assert.equal(workflow.jobs['deploy-production'].if, "github.event_name == 'push'");
  for (const target of ['sandbox', 'production']) {
    const steps = workflow.jobs['deploy-' + target].steps;
    const migrate = steps.findIndex(step => step.run === 'node scripts/ci/release-migrations.cjs --apply ' + target);
    const deploy = steps.findIndex(step => step.run?.includes('/dist/cli/index.js deploy'));
    const smoke = steps.findIndex(step => step.run?.startsWith('node scripts/ci/smoke-http.cjs ' + target + ' '));
    assert.ok(migrate >= 0 && migrate < deploy && deploy < smoke);
  }
  assert.ok(workflow.jobs['validate-build-test'].steps.some(step => step.run === 'node scripts/ci/release-migrations.cjs --check'));
  const content = fs.readFileSync('.github/workflows/release.yml', 'utf8');
  assert.doesNotMatch(content, /workflow_dispatch/);
  assert.match(content, /scripts\/ci\/smoke-http\.cjs sandbox/);
  assert.match(content, /scripts\/ci\/smoke-http\.cjs production/);
  assert.match(content, /--experimental-provision=false/);
  assert.match(content, /--experimental-auto-create=false/);
  assert.doesNotMatch(content, /d1\s+(execute|migrations)/);
  assert.doesNotMatch(content, /environment:/); // No required-reviewer gate on normal releases.
});
test('release rejects unreviewed migrations, sandbox recovery SQL, and edits to existing migrations', () => {
  validateMigrationChanges([['A', 'migrations/0197_ehb_rab_autosave.sql']]);
  for (const change of [
    ['A', 'migrations/0198_unreviewed.sql'],
    ['A', 'migrations/sandbox-recovery/0197_ehb_rab_autosave.sql'],
    ['M', 'migrations/0197_ehb_rab_autosave.sql'],
    ['D', 'migrations/0196_finance_billing_issuance.sql'],
  ]) assert.throws(() => validateMigrationChanges([change]), /reviewed new file/);
});
test('both targets give Wrangler only the reviewed migration and their own DB', () => {
  for (const target of ['sandbox', 'production']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eskahade-d1-config-test-'));
    const { filename, database } = prepareMigrationConfig(config, target, dir);
    const selected = target === 'sandbox' ? config.env.sandbox : config;
    const binding = selected.d1_databases.find(d => d.binding === 'DB');
    assert.equal(database, binding.database_name);
    const prepared = JSON.parse(fs.readFileSync(filename, 'utf8'));
    assert.deepEqual(prepared.d1_databases, [{
      binding: 'DB',
      database_name: binding.database_name,
      database_id: binding.database_id,
      migrations_dir: 'release-migrations',
      migrations_table: 'd1_migrations',
    }]);
    const migrationDir = path.join(dir, prepared.d1_databases[0].migrations_dir);
    assert.deepEqual(fs.readdirSync(migrationDir), ['0197_ehb_rab_autosave.sql']);
    fs.unlinkSync(path.join(migrationDir, '0197_ehb_rab_autosave.sql'));
    fs.rmdirSync(migrationDir);
    fs.unlinkSync(filename);
    fs.rmdirSync(dir);
  }
});
test('production refuses any DEMO_DB binding', () => { const bad = structuredClone(config); bad.d1_databases.push(bad.env.sandbox.d1_databases[1]); assert.throws(() => validate(bad, 'production', {})); });
test('missing environment never defaults to production', () => assert.throws(() => validate(config, undefined, {})));
console.log(JSON.stringify({ passed, failed: 0, remoteOperations: 0 }));

