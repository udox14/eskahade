/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node verification tooling. */
// Schema-only production definitions + reviewed pending migrations + synthetic rows.
// Only getPlatformProxy local bindings are used. Never execute this on a remote DB.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'output/stabilization-20261019');
async function main() {
  const configPath = path.resolve(process.env.ESKAHADE_LOCAL_CONFIG || path.join(root, 'wrangler.local-test.jsonc'));
  const outputDir = path.resolve(process.env.ESKAHADE_EVIDENCE_DIR || out);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.name !== 'eskahade-local-test-only' || config.d1_databases.some(d => d.remote !== false || !d.database_id.startsWith('00000000-'))) throw Error('Local isolation assertion failed');
  const rawObjects = JSON.parse(fs.readFileSync(path.join(out, 'production-schema-readonly.json'), 'utf8').replace(/^\uFEFF/, ''))[0].results.filter(o => o.sql);
  const virtualNames = rawObjects.filter(o => /CREATE VIRTUAL TABLE/i.test(o.sql)).map(o => o.name);
  const isShadow = o => virtualNames.some(name => o.name.startsWith(name + '_'));
  const objects = rawObjects.filter(o => !isShadow(o));
  const db = new DatabaseSync(':memory:');
  for (const kind of ['table', 'index', 'view', 'trigger']) for (const o of objects.filter(o => o.type === kind)) db.exec(o.sql);
  const applied = [];
  for (const prefix of ['0187_', '0188_', '0189_', '0190_']) {
    const file = fs.readdirSync(path.join(root, 'migrations')).find(f => f.startsWith(prefix));
    db.exec(fs.readFileSync(path.join(root, 'migrations', file), 'utf8')); applied.push(file);
  }
  const final = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all().filter(o => !isShadow(o));
  const { getPlatformProxy } = await import('wrangler');
  const proxy = await getPlatformProxy({ configPath, persist: { path: path.resolve(process.env.ESKAHADE_LOCAL_PRODUCTION_PERSIST || path.join(root, '.wrangler/stabilization-local/v3')) }, envFiles: [] });
  try {
    const salt = Buffer.from('local-only-fixture-salt');
    const passwordHash = salt.toString('hex') + ':' + crypto.pbkdf2Sync('LocalFixture!2026', salt, 100000, 32, 'sha256').toString('hex');
    const statements = [];
    function add(sql, ...params) { statements.push({ sql, params }); }
    for (const role of ['admin', 'tester', 'bendahara', 'admin_koperasi', 'petugas_koperasi', 'wali_kelas', 'guru', 'pengurus_asrama', 'pimpinan', 'keamanan', 'sekpen', 'dewan_santri', 'demo']) {
      add('INSERT INTO users(id,email,password_hash,full_name,role,roles,asrama_binaan) VALUES(?,?,?,?,?,?,?)', 'local-' + role, role + '@fixture.test', passwordHash, 'Fixture ' + role, role, JSON.stringify([role]), 'AL-FALAH');
    }
    add("INSERT INTO tahun_ajaran(id,nama,is_active) VALUES(1,'2026/2027',1)");
    add("INSERT INTO marhalah(id,nama,urutan) VALUES(1,'Ibtidaiyyah',1)");
    add("INSERT INTO data_guru(id,nama_lengkap,kode_guru) VALUES(1,'Guru Sintetis','TEST-1')");
    add("INSERT INTO kelas(id,tahun_ajaran_id,marhalah_id,nama_kelas,jenis_kelamin,wali_kelas_id,guru_shubuh_id) VALUES('local-kelas',1,1,'Ibtidaiyyah 1A','L','local-wali_kelas',1)");
    for (const [id, nis, asrama, kategori] of [['student', '99001', 'AL-FALAH', 'REGULER'], ['other', '99002', 'BAHAGIA', 'REGULER'], ['exempt', '99003', 'AL-BAGHORY', 'REGULER'], ['sadesa', '99004', 'SADESA', 'SADESA']]) {
      add('INSERT INTO santri(id,nis,nama_lengkap,jenis_kelamin,asrama,kamar,kategori_santri) VALUES(?,?,?,?,?,?,?)', id, nis, 'Santri Sintetis ' + id, 'L', asrama, '1', kategori);
      add("INSERT INTO riwayat_pendidikan(id,santri_id,kelas_id,status_riwayat) VALUES(?,?,?,'aktif')", 'riwayat-' + id, id, 'local-kelas');
      add('INSERT INTO portal_ortu_credentials(santri_id,password_hash,must_change_password,is_active) VALUES(?,?,0,1)', id, passwordHash);
    }
    const routes = JSON.parse(fs.readFileSync(path.join(out, 'application-inventory.json'), 'utf8')).routes;
    const roles = ['admin', 'tester', 'bendahara', 'admin_koperasi', 'petugas_koperasi', 'wali_kelas', 'guru', 'pengurus_asrama', 'pimpinan', 'keamanan', 'sekpen', 'dewan_santri', 'demo'];
    for (const r of routes.filter(r => !process.env.ESKAHADE_LOCAL_ACTUAL_RBAC && r.kind === 'page' && r.route.startsWith('/dashboard') && !r.route.includes('['))) {
      add("INSERT OR IGNORE INTO fitur_akses(group_name,title,href,roles,is_active) VALUES('Local Test',?,?,?,1)", r.route.split('/').pop() || 'Dashboard', r.route, JSON.stringify(roles));
    }
    if (process.env.ESKAHADE_LOCAL_ACTUAL_RBAC) {
      const [features, permissions] = JSON.parse(fs.readFileSync(path.join(out, 'production-feature-config-readonly.json'), 'utf8'));
      for (const [table, rows] of [['fitur_akses', features.results], ['role_fitur_crud_permission', permissions.results]]) for (const row of rows) {
        const keys = Object.keys(row);
        add(`INSERT OR REPLACE INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...Object.values(row));
      }
    }
    for (const binding of ['DB', 'DEMO_DB']) {
      const target = proxy.env[binding];
      const existing = await target.prepare("SELECT name FROM sqlite_schema WHERE name='users'").first();
      if (existing) throw Error(binding + ' already initialized; refusing to overwrite. Use the existing local fixture.');
      for (const kind of ['table', 'index', 'view', 'trigger']) for (const o of final.filter(o => o.type === kind)) await target.prepare(o.sql).run();
      for (const s of statements) await target.prepare(s.sql).bind(...s.params).run();
      const fk = await target.prepare('PRAGMA foreign_key_check').all();
      if (fk.results.length) throw Error('Synthetic seed FK failure: ' + JSON.stringify(fk.results));
    }
    fs.writeFileSync(path.join(outputDir, 'local-fixture-provenance.json'), JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Historical actual production schema definitions only; no remote records; latest revalidation separate gate', appliedLocally: applied, skipped0191: 'Column already exists in actual production schema', objects: final.length, bindings: ['DB', 'DEMO_DB'], syntheticOnly: true, actualRbac: !!process.env.ESKAHADE_LOCAL_ACTUAL_RBAC, remoteMutations: 0, foreignKeyCheck: 'PASS' }, null, 2));
    fs.writeFileSync(path.join(outputDir, 'local-final-schema.json'), JSON.stringify(final, null, 2));
    console.log('Local D1 synthetic fixture initialized for both isolated bindings.');
  } finally { await proxy.dispose(); db.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
