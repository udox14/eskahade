/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node verification tooling. */
// Explicit read-only remote audit: fixed queries and allowlisted databases only.
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'output/stabilization-20261019');
const file = path.join(root, 'output/eskahade-production-release-c8994bbd-20261019/runbook/04-conservation-counts-readonly.sql');
const source = fs.readFileSync(file, 'utf8').replace(/--[^\r\n]*/g, '').trim();
const code = source.replace(/'(?:''|[^'])*'/g, "''");
if (/\b(insert|update|delete|replace|create|alter|drop|attach|detach|vacuum)\b/i.test(code) || code.split(';').some(s => s.trim() && !/^\s*(WITH|SELECT)\b/i.test(s))) throw Error('Read-only assertion failed');
for (const [label, database] of [['production', 'eskahade-db'], ['demo', 'eskahade-demo-db']]) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', database, '--remote', '--command=' + source, '--json'], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  fs.writeFileSync(path.join(out, label + '-invariants-readonly.json'), result.stdout || '{}');
  if (result.status || result.error) { console.error(label + ' read-only query failed: ' + (result.stderr || result.error?.message || result.status)); process.exitCode = 1; }
  else { const rows = JSON.parse(result.stdout); if (rows.some(r => r.meta?.rows_written !== 0)) throw Error('Unexpected write count'); console.log(label + ': ' + rows.length + ' read-only result sets; zero rows written.'); }
}
