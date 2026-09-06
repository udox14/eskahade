/* Integration test for the actual disease-report server action. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const db = new DatabaseSync(':memory:')
db.exec(`
  CREATE TABLE santri (
    id TEXT PRIMARY KEY, jenis_kelamin TEXT NOT NULL, status_global TEXT NOT NULL,
    tanggal_masuk TEXT, created_at TEXT, tanggal_keluar TEXT, asrama TEXT
  );
  CREATE TABLE santri_arsip (santri_id_asli TEXT, tanggal_arsip TEXT);
  CREATE TABLE santri_nonaktif_log (santri_id TEXT, tanggal_mulai TEXT, tanggal_aktif_aktual TEXT);
  CREATE TABLE mutasi_asrama_log (
    id INTEGER PRIMARY KEY, santri_id TEXT, asrama_lama TEXT, asrama_baru TEXT, created_at TEXT
  );
  CREATE TABLE poskestren_patient (id TEXT PRIMARY KEY, santri_id TEXT NOT NULL);
  CREATE TABLE poskestren_diagnosis (id TEXT PRIMARY KEY, name TEXT, is_active INTEGER DEFAULT 1);
  CREATE TABLE poskestren_visit (
    id TEXT PRIMARY KEY, patient_id TEXT, queue_date TEXT, status TEXT, diagnosis_id TEXT, diagnosis TEXT
  );
  CREATE TABLE poskestren_dorm_visit (id TEXT PRIMARY KEY, patient_id TEXT, status TEXT);
  CREATE TABLE poskestren_observation (id TEXT PRIMARY KEY, patient_id TEXT);
  CREATE TABLE poskestren_clinical_exam (
    id TEXT PRIMARY KEY, dorm_visit_id TEXT, observation_id TEXT, examined_at TEXT, clinical_json TEXT
  );
  CREATE TABLE fitur_akses (
    group_name TEXT, title TEXT, href TEXT UNIQUE, icon TEXT, roles TEXT, is_active INTEGER,
    urutan INTEGER, is_bottomnav INTEGER, bottomnav_urutan INTEGER, updated_at TEXT
  );
  CREATE TABLE role_fitur_crud_permission (
    fitur_href TEXT, role TEXT, can_create INTEGER, can_update INTEGER, can_delete INTEGER, created_at TEXT, updated_at TEXT, UNIQUE(fitur_href, role)
  );
`)
db.exec(fs.readFileSync(path.join(root, 'migrations/0149_poskestren_penyakit.sql'), 'utf8'))
assert.equal(db.prepare("SELECT title FROM fitur_akses WHERE href='/dashboard/poskestren/penyakit'").get().title, 'Penyakit')


db.exec(`
  INSERT INTO santri VALUES
    ('s1','L','aktif','2026-01-01','2026-01-01',NULL,'B'),
    ('s2','L','aktif','2026-01-01','2026-01-01',NULL,'A'),
    ('s3','P','aktif','2026-01-01','2026-01-01',NULL,'A'),
    ('s4','L','keluar','2026-01-01','2026-01-01','2026-09-20','A'),
    ('s5','L','nonaktif_sementara','2026-01-01','2026-01-01',NULL,'A');
  INSERT INTO santri_nonaktif_log VALUES ('s5','2026-09-25',NULL);
  INSERT INTO mutasi_asrama_log VALUES (1,'s1','A','B','2026-09-15 08:00:00');
  INSERT INTO poskestren_patient VALUES ('p1','s1'),('p2','s2'),('p3','s3'),('p4','s4'),('p5','s5');
  INSERT INTO poskestren_diagnosis VALUES ('flu','Flu',1),('abses','Abses',1);
  INSERT INTO poskestren_visit VALUES
    ('v1','p1','2026-09-10','SELESAI','flu','Flu'),
    ('v2','p1','2026-09-12','DIRUJUK','flu','Flu'),
    ('v3','p2','2026-09-18','SELESAI','flu','Flu'),
    ('v4','p2','2026-09-19','BATAL','abses','Abses'),
    ('v5','p2','2026-09-20','SELESAI',NULL,'Abses');
  INSERT INTO poskestren_dorm_visit VALUES ('d1','p3','SELESAI');
  INSERT INTO poskestren_observation VALUES ('o1','p1');
  INSERT INTO poskestren_clinical_exam VALUES
    ('e1','d1',NULL,'2026-09-22T08:00:00Z','{"diagnosisId":"flu","diagnosis":"Flu"}'),
    ('e2',NULL,'o1','2026-09-25T08:00:00Z','{"diagnosisId":"abses","diagnosis":"Abses"}');
`)

const stubs = {
  '@/lib/db': { query: async (sql, args = []) => db.prepare(sql).all(...args) },
  '@/lib/poskestren/access': { requirePoskestrenStaffFeature: async () => ({ id: 'staff' }) },
}
const originalLoad = Module._load
Module._load = function(request, parent, isMain) {
  if (stubs[request]) return stubs[request]
  if (request.startsWith('@/')) request = path.join(root, request.slice(2))
  return originalLoad.call(this, request, parent, isMain)
}
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file)

const { getDiseaseCaseReport } = require('../app/dashboard/poskestren/penyakit/actions.ts')

async function main() {
  const all = await getDiseaseCaseReport({ periodMode: 'month', month: '2026-09', basis: 'both' })
  assert.deepEqual(all.totals, { diagnosedStudents: 3, episodes: 6, activeStudents: 3, diagnoses: 2 })
  const flu = all.rows.find(row => row.diagnosisName === 'Flu')
  const abses = all.rows.find(row => row.diagnosisName === 'Abses')
  assert.equal(flu.uniqueStudents, 3)
  assert.equal(flu.episodes, 4)
  assert.equal(flu.uniqueSharePercent, 100)
  assert.equal(flu.uniqueActivePercent, 100)
  assert.equal(flu.episodeSharePercent, 66.67)
  assert.equal(abses.uniqueStudents, 2)
  assert.equal(abses.episodes, 2)

  const male = await getDiseaseCaseReport({ periodMode: 'month', month: '2026-09', gender: 'L' })
  assert.equal(male.totals.activeStudents, 2)
  assert.equal(male.totals.episodes, 5)

  const dormA = await getDiseaseCaseReport({ periodMode: 'month', month: '2026-09', asrama: 'A' })
  assert.equal(dormA.totals.activeStudents, 2)
  assert.equal(dormA.totals.episodes, 5)
  assert.equal(dormA.rows.find(row => row.diagnosisName === 'Flu').episodes, 4)
  assert.equal(dormA.rows.find(row => row.diagnosisName === 'Abses').episodes, 1)

  const semester1 = await getDiseaseCaseReport({ periodMode: 'semester', academicYearStart: 2026, semester: 1 })
  assert.equal(semester1.period.from, '2026-07-01')
  assert.equal(semester1.period.to, '2026-12-31')
  const semester2 = await getDiseaseCaseReport({ periodMode: 'semester', academicYearStart: 2026, semester: 2 })
  assert.equal(semester2.period.from, '2027-01-01')
  assert.equal(semester2.period.to, '2027-06-30')

  const empty = await getDiseaseCaseReport({ periodMode: 'range', from: '2025-01-01', to: '2025-01-31' })
  assert.deepEqual(empty.totals, { diagnosedStudents: 0, episodes: 0, activeStudents: 0, diagnoses: 0 })
  assert.deepEqual(empty.rows, [])
  await assert.rejects(() => getDiseaseCaseReport({ periodMode: 'range', from: '2026-02-31', to: '2026-03-01' }), /tidak valid/)
  console.log('PASS: disease report sources, unique/episode metrics, percentages, status, dorm mutation, gender, month, semester and empty range')
}

main().finally(() => db.close()).catch(error => { console.error(error); process.exitCode = 1 })
