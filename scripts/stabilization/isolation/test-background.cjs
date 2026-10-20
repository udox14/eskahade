/* eslint-disable @typescript-eslint/no-require-imports -- Actual scheduled entrypoints with synthetic binding sentinels. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..'), calls = [], results = [];
const original = Module._load;
Module._load = function(r, p, m) {
  if (r === '../lib/uang-jajan/auto-potong') return { runUangJajanAutoPotong: async db => { calls.push(db); return {}; } };
  if (r === '../lib/pengajian-violations/photo-cleanup') return { cleanupEvidencePhotos: async (db, bucket, namespace) => { calls.push(db); assert.equal(namespace, 'prod'); return { failed: 0 }; } };
  return original.call(this, r, p, m);
};
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
(async () => {
  const primary = { marker: 'SYNTHETIC_PRIMARY' }, demo = { marker: 'SYNTHETIC_DEMO' };
  for (const file of ['pengajian-photo-cleanup', 'uang-jajan-auto']) {
    const worker = require(path.join(root, 'workers', file + '.ts')).default;
    const pending = [], start = calls.length;
    await worker.scheduled({ scheduledTime: 0, cron: 'synthetic' }, { ESKAHADE_ENV: 'production', DB: primary }, { waitUntil: p => pending.push(p) }); await Promise.all(pending);
    assert.deepEqual(calls.slice(start), [primary]); results.push({ name: file + ' uses only primary binding', status: 'PASS' });
    for (const env of [{ ESKAHADE_ENV: 'production', DB: primary, DEMO_DB: demo }, { ESKAHADE_ENV: 'sandbox', DB: demo, DEMO_DB: demo }, { ESKAHADE_ENV: 'production' }]) {
      const before = calls.length; await assert.rejects(() => worker.scheduled({ scheduledTime: 0 }, env, { waitUntil: p => pending.push(p) })); assert.equal(calls.length, before);
    }
    results.push({ name: file + ' rejects sandbox/cross-binding/missing DB before work', status: 'PASS' });
  }
  fs.writeFileSync(path.join(root, 'output/permanent-isolation-20261020/background-tests.json'), JSON.stringify({ passed: results.length, failed: 0, results, localOnly: true }, null, 2)); console.log('PASS 4 background entrypoint isolation checks');
})().catch(e => { console.error(e); process.exitCode = 1; });
