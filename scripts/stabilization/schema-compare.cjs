/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node verification tooling. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const out = path.resolve(__dirname, '../../output/stabilization-20261019');
const read = file => JSON.parse(fs.readFileSync(path.join(out, file), 'utf8').replace(/^\uFEFF/, ''));
const production = read('production-schema-readonly.json')[0].results;
const demo = read('demo-schema-readonly.json')[0].results;
const final = read('local-final-schema.json');
const publicFlags=new Set(['BRI_ENV','BRI_OUTBOUND_ENABLED','BRI_BRIVA_OUTBOUND_ENABLED','BRI_BRIVA_INBOUND_ENABLED','BRI_STATEMENT_SYNC_ENABLED','BRI_DIST_CASH_ENABLED','BRI_DIST_MANUAL_ENABLED','FINANCE_PROOFS_PRIVATE_STORAGE_CONFIRMED','BUILD_TIMESTAMP','NEXT_PUBLIC_BUILD_ID']);
function compare(a, b) {
  const key = o => o.type + ':' + o.name, target = new Map(b.map(o => [key(o), o]));
  const normalize = sql => (sql || '').replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  return { missing: a.filter(o => !target.has(key(o))).map(o => ({ type: o.type, name: o.name, table: o.tbl_name })),
    changed: a.filter(o => target.has(key(o)) && normalize(o.sql) !== normalize(target.get(key(o)).sql)).map(o => ({ type: o.type, name: o.name, table: o.tbl_name })),
    extra: b.filter(o => !a.some(i => key(i) === key(o))).map(o => ({ type: o.type, name: o.name, table: o.tbl_name })) };
}
const result = { generatedAt: new Date().toISOString(), source: 'Fresh read-only D1 sqlite_schema; local candidate applies 0187–0190',
  productionToDemo: compare(production, demo), candidateToProduction: compare(final, production), candidateToDemo: compare(final, demo),
  productionLedger: read('production-migrations-readonly.json')[0].results, demoLedger: read('demo-migrations-readonly.json')[0].results,
  caution: 'Applied history includes manual migrations. Do not bulk migrations apply or infer missing schema from ledger alone. 0191 is already present in both actual schemas; never reapply it.' };
fs.writeFileSync(path.join(out, 'schema-compatibility.json'), JSON.stringify(result, null, 2));
for (const [name, objects] of [['production', production], ['demo', demo]]) {
  const virtualNames = objects.filter(o => /CREATE VIRTUAL TABLE/i.test(o.sql || '')).map(o => o.name);
  const tables = objects.filter(o => o.type === 'table' && !virtualNames.some(v => o.name.startsWith(v + '_')));
  const chunks = [];
  for (let i = 0; i < tables.length; i += 10) chunks.push(tables.slice(i, i + 10).map(o => `SELECT '${o.name}' AS table_name, COUNT(*) AS row_count FROM "${o.name}"`).join('\nUNION ALL\n') + ';');
  const sql = chunks.join('\n') + '\nSELECT COUNT(*) AS foreign_key_violation_count FROM pragma_foreign_key_check;\n';
  fs.writeFileSync(path.join(out, name + '-counts-readonly.sql'), sql);
}
for (const name of ['production', 'sandbox']) {
  const deployments = read(name + '-deployments-readonly.json'), version = read(name + '-version-readonly.json');
  const sanitizeBinding = b => { const copy = { type: b.type, name: b.name }; for (const field of ['id', 'namespace_id', 'bucket_name', 'service', 'environment']) if (b[field] !== undefined) copy[field] = b[field]; if (b.type === 'plain_text' && publicFlags.has(b.name)) copy.value = b.text; return copy; };
  const sanitized = { observedAt: new Date().toISOString(), deployments: deployments.map(d => ({ id: d.id, created_on: d.created_on, versions: d.versions, source: d.source })),
    versionId: version.id, metadata: { created_on: version.metadata?.created_on, source: version.metadata?.source }, annotations: version.annotations,
    bindings: (version.resources?.bindings || []).map(sanitizeBinding), script: version.resources?.script };
  fs.writeFileSync(path.join(out, name + '-deployed-sanitized.json'), JSON.stringify(sanitized, null, 2));
}
console.log(JSON.stringify({ productionTables: production.filter(o => o.type === 'table').length, demoTables: demo.filter(o => o.type === 'table').length, missingDemoTables: result.productionToDemo.missing.filter(o => o.type === 'table').length, candidateMissingProduction: result.candidateToProduction.missing.length, candidateMissingDemo: result.candidateToDemo.missing.length }));
