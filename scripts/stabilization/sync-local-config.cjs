/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node verification tooling. */
// Copies authorization configuration only into explicitly local synthetic bindings.
const fs = require('node:fs'), path = require('node:path');
async function main() {
  const root = path.resolve(__dirname, '../..'), out = path.join(root, 'output/stabilization-20261019');
  const configPath = path.join(root, 'wrangler.local-test.jsonc');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.d1_databases.some(d => d.remote !== false || !d.database_id.startsWith('00000000-'))) throw Error('Local isolation assertion failed');
  const [features, crud] = JSON.parse(fs.readFileSync(path.join(out, 'production-feature-config-readonly.json'), 'utf8'));
  const { getPlatformProxy } = await import('wrangler');
  const proxy = await getPlatformProxy({ configPath, persist: { path: path.join(root, '.wrangler/stabilization-local/v3') }, envFiles: [] });
  try {
    for (const name of ['DB', 'DEMO_DB']) {
      const db = proxy.env[name];
      const users = await db.prepare('SELECT id,email FROM users').all();
      if (users.results.some(u => !u.id.startsWith('local-') || !u.email.endsWith('@fixture.test'))) throw Error('Non-synthetic users; refusing local config sync');
      await db.prepare("DELETE FROM fitur_akses WHERE group_name='Local Test'").run();
      for (const row of features.results) {
        const cols = Object.keys(row);
        await db.prepare(`INSERT INTO fitur_akses(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')}) ON CONFLICT(href) DO UPDATE SET ${cols.filter(c => c !== 'href').map(c => `${c}=excluded.${c}`).join(',')}`).bind(...Object.values(row)).run();
      }
      for (const row of crud.results) {
        const cols = Object.keys(row);
        await db.prepare(`INSERT OR REPLACE INTO role_fitur_crud_permission(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`).bind(...Object.values(row)).run();
      }
    }
    console.log(`Local RBAC configuration synchronized: ${features.results.length} features, ${crud.results.length} CRUD rules. No remote writes.`);
  } finally { await proxy.dispose(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
