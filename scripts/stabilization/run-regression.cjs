/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node verification tooling. */
// Local-only release gate. Never discovers or runs remote UAT/seed scripts.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, process.env.ESKAHADE_EVIDENCE_DIR || 'output/stabilization-20261019', 'regression');
fs.mkdirSync(out, { recursive: true });
const excluded = {
  'test-demo-edge-uat.cjs': 'Remote D1 mutation requires separate approval',
  'test-poskestren-ui.cjs': 'Browser interactions run through the browser tool',
  'test-discipline-ui.cjs': 'Long-running standalone fixture, covered separately',
  'test-finance-d1-behavior-local.cjs': 'Separate D1 behavioral gate',
};
const files = fs.readdirSync(path.join(root, 'scripts')).filter(f => /^test-.*\.(cjs|mjs|py)$/.test(f));
const results = [];
for (const file of files) {
  if (excluded[file]) { results.push({ file, status: 'NOT_RUN', reason: excluded[file] }); continue; }
  const source = fs.readFileSync(path.join(root, 'scripts', file), 'utf8');
  if (/--remote/.test(source)) throw Error('Remote command found in ' + file);
  const start = Date.now();
  const result = spawnSync(file.endsWith('.py') ? 'python' : process.execPath,
    [path.join(root, 'scripts', file)], {
      cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', NODE_OPTIONS: '',
        BRI_OUTBOUND_ENABLED: 'false', BRI_BRIVA_INBOUND_ENABLED: 'false',
        BRI_BRIVA_OUTBOUND_ENABLED: 'false', BRI_STATEMENT_SYNC_ENABLED: 'false' },
    });
  const log = (result.stdout || '') + '\n' + (result.stderr || '');
  fs.writeFileSync(path.join(out, file + '.log'), log);
  // Some legacy suites print failures without setting a failing exit status.
  const printedFailure = /^\s*(?:FAIL(?:ED)?\b|[❌✗]\s)|\b[1-9]\d*\s+(?:tests?\s+)?failed\b/im.test(log);
  const status = result.status === 0 && !result.error && !printedFailure ? 'PASS' : 'FAIL';
  const row = { file, status, exitCode: result.status, durationMs: Date.now() - start,
    ...(printedFailure ? { printedFailure: true } : {}), ...(result.error ? { error: result.error.message } : {}) };
  results.push(row);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(status + ' ' + file + ' (' + row.durationMs + 'ms)');
}
const summary = { passed: results.filter(r => r.status === 'PASS').length,
  failed: results.filter(r => r.status === 'FAIL').length, notRun: results.filter(r => r.status === 'NOT_RUN').length };
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2));
console.log(JSON.stringify(summary));
process.exitCode = summary.failed ? 1 : 0;
