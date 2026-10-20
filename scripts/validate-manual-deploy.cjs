/* Manual workflow gate: no network, SQL or resource provisioning. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const ACCOUNT = 'a170ed4144c00927988a828aa9a41896';

function validateManualDeployment(config, target, context = process.env) {
  assert.ok(['production', 'sandbox'].includes(target), 'Explicit deployment target required');
  const worker = target === 'production' ? 'eskahade' : 'eskahade-sandbox';
  const selected = target === 'production' ? config : config.env?.sandbox;
  assert.equal(config.account_id, ACCOUNT, 'Unexpected account');
  assert.equal(config.vars?.CLOUDFLARE_ACCOUNT_ID, ACCOUNT);
  assert.equal(selected?.name, worker, 'Unexpected Worker');
  assert.equal(selected.vars?.ESKAHADE_ENV, target);
  assert.equal(selected.preview_urls, false, 'Historical previews must remain closed');
  assert.ok(!selected.unsafe, 'Unreviewed binding metadata forbidden');
  const expectedDb = target === 'production' ? 'a2010f08-f314-46af-88fd-dbb9b4ef1bb1' : '677f05ba-9b52-4534-9542-96cc785f25e4';
  const names = target === 'production' ? ['DB'] : ['DB', 'DEMO_DB'];
  assert.deepEqual(selected.d1_databases.map(d => d.binding).sort(), names);
  assert.ok(selected.d1_databases.every(d => d.database_id === expectedDb && d.database_name === (target === 'production' ? 'eskahade-db' : 'eskahade-demo-db')), 'Cross-environment DB forbidden');
  assert.deepEqual(selected.services?.map(s => ({ binding: s.binding, service: s.service })), [{ binding: 'WORKER_SELF_REFERENCE', service: worker }]);
  assert.equal(selected.r2_buckets?.[0]?.bucket_name, target === 'production' ? 'eskahade-foto' : 'eskahade-sandbox-foto');
  for (const flag of ['BRI_OUTBOUND_ENABLED', 'BRI_BRIVA_OUTBOUND_ENABLED', 'BRI_BRIVA_INBOUND_ENABLED', 'BRI_STATEMENT_SYNC_ENABLED']) assert.equal(selected.vars?.[flag], 'false', flag + ' must remain OFF');
  if (context.CLOUDFLARE_ENV !== undefined) assert.equal(context.CLOUDFLARE_ENV, target === 'production' ? '' : 'sandbox', 'CLI environment override forbidden');
  if (context.CLOUDFLARE_ACCOUNT_ID !== undefined) assert.equal(context.CLOUDFLARE_ACCOUNT_ID, ACCOUNT);
  if (context.GITHUB_ACTIONS === 'true') {
    assert.equal(context.GITHUB_REPOSITORY, 'udox14/eskahade');
    if (context.ESKAHADE_AUTOMATED_RELEASE === 'true') {
      assert.ok(['push', 'pull_request'].includes(context.GITHUB_EVENT_NAME), 'Automated release validation must be a push or pull request');
      assert.equal(context.GITHUB_SHA?.length, 40, 'Automated release requires an exact commit SHA');
      if (context.GITHUB_EVENT_NAME === 'push') assert.equal(context.GITHUB_REF, 'refs/heads/main', 'Only main may deploy');
      else assert.equal(context.GITHUB_BASE_REF, 'main', 'Pull request validation must target main');
    } else {
      assert.equal(context.GITHUB_EVENT_NAME, 'workflow_dispatch', 'Manual deploy confirmation required');
      assert.equal(context.GITHUB_REF, 'refs/heads/main', 'Manual deployment must use main');
      assert.equal(context.ESKAHADE_CONFIRM_WORKER, worker, 'Type the exact Worker name to confirm');
    }
  }
  return { target, worker, account: ACCOUNT, bankNetwork: 'OFF' };
}

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..');
    const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
    assert.ok(!parsed.error, 'Invalid Wrangler JSONC');
    const result = validateManualDeployment(parsed.config, process.argv[2]);
    const all = spawnSync(process.execPath, [path.join(__dirname, 'validate-sandbox-config.cjs')], { cwd: root, encoding: 'utf8' });
    assert.equal(all.status, 0, 'Permanent environment isolation validation failed: ' + all.stderr);
    console.log(JSON.stringify({ result: 'PASS', ...result, sqlWrites: 0, remoteOperations: 0 }));
  } catch (error) { console.error('DEPLOYMENT BLOCKED: ' + error.message); process.exitCode = 1; }
}
module.exports = { validateManualDeployment };

