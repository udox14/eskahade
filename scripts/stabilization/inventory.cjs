/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node verification tooling. */
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'output/stabilization-20261019');
fs.mkdirSync(out, { recursive: true });
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
const files = ['app', 'lib', 'components', 'workers'].flatMap(d => walk(path.join(root, d))).filter(f => /\.[cm]?[jt]sx?$/.test(f));
const rel = f => path.relative(root, f).replaceAll('\\', '/');
const sources = new Map(files.map(f => [f, fs.readFileSync(f, 'utf8')]));
function resolveImport(file, spec) {
  const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null;
  return base && [base, ...['.ts', '.tsx', '.js', '/index.ts', '/index.tsx'].map(e => base + e)].find(f => sources.has(f));
}
const nodes = new Map(files.map(file => {
  const source = sources.get(file), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = [], exports = [];
  function visit(n) {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) { const target = resolveImport(file, n.moduleSpecifier.text); if (target) imports.push(target); }
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(n.arguments[0])) { const target = resolveImport(file, n.arguments[0].text); if (target) imports.push(target); }
    if (ts.isFunctionDeclaration(n) && n.name && n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) exports.push(n.name.text);
    ts.forEachChild(n, visit);
  }
  visit(ast);
  const first = ast.statements[0];
  const server = !!first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use server';
  return [file, { imports, exports, server, tables: [...source.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)\s+([a-zA-Z_][\w]*)/gi)].map(m => m[1]),
    flags: [...source.matchAll(/(?:process\.env\.|env\.)([A-Z][A-Z_0-9]+)/g)].map(m => m[1]),
    guards: ['getSession', 'guardPage', 'guardRole', 'requireAuth', 'requirePortalSession', 'canAccessFeature', 'assertFeature', 'requireFeature', 'requireFinance', 'requireCrud', 'assertSantriBillable'].filter(s => source.includes(s)) }];
}));
function closure(file, seen = new Set()) { if (seen.has(file)) return seen; seen.add(file); for (const i of nodes.get(file)?.imports || []) closure(i, seen); return seen; }
const routes = files.filter(f => /\/(?:page\.tsx|route\.ts)$/.test(f.replaceAll('\\', '/')) || nodes.get(f).server).map(file => {
  const dependencies = [...closure(file)], merged = key => [...new Set(dependencies.flatMap(f => nodes.get(f)[key]))].sort();
  const name = rel(file), parts = name.replace(/^app\//, '').split('/'); parts.pop();
  const route = '/' + parts.filter(s => !/^\(.*\)$/.test(s)).join('/');
  return { file: name, route, kind: nodes.get(file).server ? 'server-actions' : name.endsWith('route.ts') ? 'api' : 'page', exports: nodes.get(file).exports,
    dependencies: dependencies.map(rel).sort(), tables: merged('tables'), flags: merged('flags'), guards: merged('guards'),
    verification: 'INVENTORIED; runtime coverage recorded separately; inferred SQL names require schema comparison' };
});
const roles = [...new Set(['app/dashboard/pengaturan/users/actions.ts','lib/dashboard/catalog.ts'].flatMap(file => {
  const source = sources.get(path.join(root,file));
  const array = source.match(/(?:VALID_USER_ROLES|DASHBOARD_ROLES)\s*=\s*\[([\s\S]*?)\]/)?.[1] || '';
  return [...array.matchAll(/['"]([a-z_]+)['"]/g)].map(m => m[1]);
}))].sort();
fs.writeFileSync(path.join(out, 'application-inventory.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sourceFiles: files.length, roles, routes }, null, 2));
fs.writeFileSync(path.join(out, 'coverage-matrix.csv'), '\uFEFFkind,route,file,guards,tables,flags,verification\n' + routes.map(r => [r.kind, r.route, r.file, r.guards.join(';'), r.tables.join(';'), r.flags.join(';'), r.verification].map(s => '"' + s.replaceAll('"', '""') + '"').join(',')).join('\n'));
console.log(JSON.stringify({ sourceFiles: files.length, routes: routes.length, pages: routes.filter(r => r.kind === 'page').length, api: routes.filter(r => r.kind === 'api').length, actions: routes.filter(r => r.kind === 'server-actions').length, roles }));
