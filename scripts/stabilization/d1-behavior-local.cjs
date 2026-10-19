/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node verification tooling. */
const fs = require('node:fs'), path = require('node:path');
const { createDatabase } = require('../finance-remediation-fixture.cjs');
async function main() {
  const root = path.resolve(__dirname, '../..');
  const { Miniflare } = await import('miniflare');
  const mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("LOCAL_SYNTHETIC_ONLY") } }', compatibilityDate: '2025-04-01', d1Databases: ['SYNTHETIC_DB'] });
  try {
    const source = createDatabase(189, false);
    const objects = source.prepare("SELECT type,name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    const target = await mf.getD1Database('SYNTHETIC_DB');
    for (const kind of ['table', 'index', 'view', 'trigger']) for (const o of objects.filter(o => o.type === kind)) await target.prepare(o.sql).run();
    await target.prepare("INSERT INTO tahun_ajaran VALUES(2,'Synthetic year',1)").run();
    const { runSuite } = await import('../finance-behavior/suite.mjs');
    const result = await runSuite(target);
    result.engine = 'Fresh LOCAL workerd/Miniflare D1, native batch; not remote D1';
    fs.writeFileSync(path.join(root, 'output/stabilization-20261019/d1-native-batch.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    if (result.failed || result.passed !== result.plannedCases) process.exitCode = 1;
    source.close();
  } finally { await mf.dispose(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
