// Shared fixture for notification tests: real 0202 migration on node:sqlite, TS transpiled on the fly.
const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f)
const load = p => require(path.join(root, p))

const MIGRATION = fs.readFileSync(path.join(root, 'migrations/0202_notifications.sql'), 'utf8').replace(/\r\n/g, '\n')
const VERIFY_HREF = '/dashboard/keuangan/verifikasi-transfer'

function createDatabase() {
  const db = new DatabaseSync(':memory:')
  db.exec(`PRAGMA foreign_keys=ON;
  CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT, full_name TEXT, role TEXT, roles TEXT, asrama_binaan TEXT, structural_jabatan TEXT);
  CREATE TABLE santri(id TEXT PRIMARY KEY, nama_lengkap TEXT, asrama TEXT, status_global TEXT DEFAULT 'aktif');
  CREATE TABLE app_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE fitur_akses(id INTEGER PRIMARY KEY AUTOINCREMENT, group_name TEXT, title TEXT, href TEXT UNIQUE, icon TEXT, roles TEXT, is_active INTEGER, urutan INTEGER);
  CREATE TABLE user_fitur_override(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, fitur_id INTEGER, action TEXT);
  CREATE TABLE finance_transfer_verifier_scopes(user_id TEXT, asrama TEXT, PRIMARY KEY(user_id, asrama));
  CREATE TABLE money(id TEXT PRIMARY KEY, amount INTEGER NOT NULL CHECK(amount > 0));`)
  db.exec(MIGRATION)
  db.exec(`
  INSERT INTO users(id, full_name, role, roles, asrama_binaan) VALUES
    ('u-admin','Admin','admin','["admin"]',NULL),
    ('u-bendahara','Bendahara','bendahara','["bendahara"]',NULL),
    ('u-petugas-a','Petugas A','petugas_koperasi','["petugas_koperasi"]',NULL),
    ('u-petugas-b','Petugas B','petugas_koperasi','["petugas_koperasi"]',NULL),
    ('u-pimpinan','Pimpinan','pimpinan','["pimpinan"]',NULL),
    ('u-tester','Tester','tester','["tester","bendahara"]',NULL),
    ('u-asrama-a','Pengurus A','pengurus_asrama','["pengurus_asrama"]','ASRAMA A'),
    ('u-broken','Rusak','admin','not-json',NULL);
  INSERT INTO santri(id, nama_lengkap, asrama) VALUES ('s-1','Ahmad','ASRAMA A'),('s-2','Budi','ASRAMA B');
  INSERT INTO finance_transfer_verifier_scopes VALUES ('u-petugas-a','ASRAMA A'),('u-petugas-b','ASRAMA B');
  INSERT INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan) VALUES
    ('Keuangan','Verifikasi Transfer','${VERIFY_HREF}','ListChecks','["admin","bendahara","admin_koperasi","petugas_koperasi","pimpinan"]',1,1),
    ('Keamanan','Perizinan','/dashboard/keamanan/perizinan','Gavel','["admin","dewan_santri"]',1,2);`)
  return db
}

function notifHarness() {
  let db = createDatabase()
  let batchFault = null
  const store = {
    query: async (sql, p = []) => db.prepare(sql).all(...p),
    queryOne: async (sql, p = []) => db.prepare(sql).get(...p) || null,
    execute: async (sql, p = []) => { db.prepare(sql).run(...p); return { success: true } },
    batch: async statements => {
      if (batchFault) throw new Error(batchFault)
      db.exec('BEGIN')
      try { for (const s of statements) db.prepare(s.sql).run(...(s.params || [])); db.exec('COMMIT') } catch (e) { db.exec('ROLLBACK'); throw e }
    },
  }
  return {
    get db() { return db },
    store,
    reset() { db.close(); db = createDatabase(); batchFault = null },
    fault(message) { batchFault = message },
  }
}

module.exports = { load, notifHarness, MIGRATION, VERIFY_HREF, root }
