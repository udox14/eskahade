/* eslint-disable @typescript-eslint/no-require-imports -- All-zero local resource IDs, existing synthetic fixture copy only. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..'), out = path.join(root, 'output/permanent-isolation-20261020');
const persist = path.join(root, '.wrangler/permanent-isolation-local/v2');
const source = path.join(root, '.wrangler/sandbox-recovery-candidate/v3');
if (!fs.existsSync(persist)) { fs.mkdirSync(persist, { recursive: true }); fs.cpSync(source, path.join(persist, 'v3'), { recursive: true }); }
for (const mode of ['production', 'sandbox']) {
  const dbId = mode === 'production' ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002';
  const name = 'local-isolation-' + mode;
  const db = { binding: 'DB', database_name: mode === 'production' ? 'local-synthetic-main' : 'local-synthetic-demo', database_id: dbId, remote: false };
  const config = { name, preview_urls: false, main: path.join(root, '.open-next/worker.js'), compatibility_date: '2025-04-01', compatibility_flags: ['nodejs_compat'],
    assets: { directory: path.join(root, '.open-next/assets'), binding: 'ASSETS' }, services: [{ binding: 'WORKER_SELF_REFERENCE', service: name }],
    d1_databases: mode === 'production' ? [db] : [db, { ...db, binding: 'DEMO_DB' }],
    kv_namespaces: [{ binding: 'NEXT_INC_CACHE_KV', id: mode === 'production' ? '00000000000000000000000000000001' : '00000000000000000000000000000002', remote: false }],
    r2_buckets: [{ binding: 'R2_BUCKET', bucket_name: 'local-isolation-media-' + mode, remote: false }],
    vars: { ESKAHADE_ENV: mode, JWT_SECRET: 'synthetic-shared-secret-tests-realm-isolation', BRI_ENV: 'sandbox', BRI_OUTBOUND_ENABLED: 'false', BRI_BRIVA_OUTBOUND_ENABLED: 'false', BRI_BRIVA_INBOUND_ENABLED: 'false', BRI_STATEMENT_SYNC_ENABLED: 'false', BRI_DIST_CASH_ENABLED: 'false', BRI_DIST_MANUAL_ENABLED: 'false' },
  };
  assert.ok(config.d1_databases.every(d => d.database_id.startsWith('00000000-') && d.remote === false));
  fs.writeFileSync(path.join(out, 'preview-' + mode + '.json'), JSON.stringify(config, null, 2));
}
fs.writeFileSync(path.join(out, 'preview-provenance.json'), JSON.stringify({ localOnly: true, actualRemoteResources: false, persistence: persist, copiedFixture: source,
  schemaProvenance: 'Existing all-zero synthetic local recovery fixture derived from demo DDL plus exact 0192–0195; production-mode tests prove routing/auth behavior, not actual deployed production schema readiness.',
  sameSyntheticJwtSecretIntentionallyUsed: true, separateDatabaseIds: true, separateKvAndR2: true, remoteMutations: 0 }, null, 2));
console.log('Prepared two isolated LOCAL ONLY configs and copied existing synthetic persistence. No remote resources.');
