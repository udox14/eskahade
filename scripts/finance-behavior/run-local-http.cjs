// Local loopback only. Never accepts a remote URL or bank credentials.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
async function main() {
  const url = 'http://127.0.0.1:8797';
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'wrangler.local.json'), 'utf8'));
  const headers = { Authorization: 'Bearer ' + config.vars.TEST_AUTH_TOKEN };
  const output = path.resolve(__dirname, '../../output/final-behavioral-gate-66449217');
  const denied = await fetch(url + '/run', { method: 'POST' });
  assert.equal(denied.status, 401);
  const run = await fetch(url + '/run', { method: 'POST', headers });
  const result = await run.json();
  fs.writeFileSync(path.join(output, 'd1-local-workerd.json'), JSON.stringify({
    execution: 'LOCAL workerd/Miniflare D1 only; NOT remote Cloudflare D1',
    httpStatus: run.status, unauthorizedStatus: denied.status, result,
  }, null, 2) + '\n');
  assert.equal(run.status, 200);
  assert.equal(result.failed, 0);
  const replay = await fetch(url + '/run', { method: 'POST', headers });
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), result);
  const status = await fetch(url + '/status', { headers });
  assert.deepEqual(await status.json(), result);
  fs.writeFileSync(path.join(output, 'd1-local-http-checks.json'), JSON.stringify({
    unauthorized: 401, run: 200, replay: 200, storedStatus: status.status,
    identicalStoredResult: true, remoteProvisioned: false,
  }, null, 2) + '\n');
  console.log(`Local workerd D1: ${result.passed}/${result.plannedCases} PASS; auth and replay PASS.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
