/* Integration tests execute the actual server actions against an in-memory D1 adapter. */
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const db = new DatabaseSync(':memory:')
const fixture = fs.readFileSync(path.join(__dirname,'test-poskestren-invariants.py'),'utf8').split('def create_legacy_fixture')[1].split('"""')[1]
db.exec(fixture)
db.exec(`ALTER TABLE santri ADD COLUMN created_at TEXT DEFAULT '2026-01-01';
 ALTER TABLE santri ADD COLUMN status_global TEXT DEFAULT 'aktif'; ALTER TABLE santri ADD COLUMN kamar TEXT;
 ALTER TABLE santri ADD COLUMN foto_url TEXT; ALTER TABLE santri ADD COLUMN tanggal_lahir TEXT;
 ALTER TABLE fitur_akses ADD COLUMN updated_at TEXT;
 CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT);
 CREATE TABLE data_guru(id INTEGER PRIMARY KEY);`)
for(const prefix of ['0124','0125','0126','0127','0128','0131','0138','0139']) {
 const file=fs.readdirSync(path.join(root,'migrations')).find(n=>n.startsWith(prefix+'_'))
 db.exec(fs.readFileSync(path.join(root,'migrations',file),'utf8'))
}
db.exec(`INSERT INTO poskestren_patient(id,santri_id,medical_record_no,allergies,special_conditions) VALUES('patient','s1','RM-TEST','Penisilin','Asma');
 INSERT INTO poskestren_personnel(id,user_id,personnel_type,full_name,is_active) VALUES('doctor','u1','MEDICAL','Dokter',1);
 INSERT INTO poskestren_compensation_history(id,personnel_id,effective_from,patient_rate_rupiah,patient_rate_with_treatment_rupiah,session_rate_rupiah) VALUES('rate','doctor','2026-01-01',10000,20000,50000);
 INSERT INTO poskestren_visit(id,patient_id,queue_date,queue_number,source_type,status,treatment,personnel_id) VALUES('legacy','patient','2026-09-01',1,'MANUAL','SELESAI','Tindakan lama','doctor');
 INSERT INTO poskestren_dorm_visit(id,patient_id,visited_at,complaint) VALUES('old-dorm','patient','2026-09-01T01:00:00Z','Lama');
 INSERT INTO users(id,full_name,role,roles) VALUES('staff','Petugas','poskestren','["poskestren"]');
 INSERT INTO santri(id,nis,nama_lengkap,asrama) VALUES('s2','1002','Santri Kedua','B');`)
const empty = new DatabaseSync(':memory:')
empty.exec(fixture)
empty.exec("DELETE FROM absen_sakit; DELETE FROM santri; DELETE FROM users; ALTER TABLE santri ADD COLUMN created_at TEXT; ALTER TABLE fitur_akses ADD COLUMN updated_at TEXT; CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE data_guru(id INTEGER PRIMARY KEY);")
for(const prefix of ['0124','0125','0126','0127','0128','0131','0138','0139','0147']) {
 const file=fs.readdirSync(path.join(root,'migrations')).find(n=>n.startsWith(prefix+'_'))
 empty.exec(fs.readFileSync(path.join(root,'migrations',file),'utf8'))
}
assert.equal(empty.prepare('SELECT COUNT(*) n FROM poskestren_patient').get().n,0)
empty.close()
const migration=fs.readFileSync(path.join(root,'migrations/0147_poskestren_clinical_workflow.sql'),'utf8')
db.exec(migration)
assert.equal(db.prepare('SELECT allergies FROM poskestren_patient WHERE id=?').get('patient').allergies,'Penisilin')
assert.equal(db.prepare('SELECT fee_category FROM poskestren_visit WHERE id=?').get('legacy').fee_category,'TREATMENT')
assert.equal(db.prepare('SELECT status FROM poskestren_dorm_visit WHERE id=?').get('old-dorm').status,'LEGACY')
db.exec("INSERT INTO santri(id,nis,nama_lengkap,asrama) VALUES('s3','1003','Santri Baru','A')")
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM poskestren_patient').get().n,3)
const patient3=db.prepare('SELECT medical_record_no FROM poskestren_patient WHERE santri_id=?').get('s3')
assert.equal(patient3.medical_record_no,db.prepare('SELECT poskestren_code FROM santri WHERE id=?').get('s3').poskestren_code)
let session={id:'u1',role:'poskestren',roles:['poskestren'],asrama_binaan:null}
const prepared = sql => ({bind(...args) {
 const params=args.map(v=>v===undefined?null:v)
 return {sql,params,
  async all(){return {results:db.prepare(sql).all(...params)}},
  async first(){return db.prepare(sql).get(...params)||null},
  async run(){const result=db.prepare(sql).run(...params);return {meta:{changes:Number(result.changes)}}}
 }
}})
const adapter={prepare:prepared,async batch(statements){
 db.exec('BEGIN IMMEDIATE')
 try {const result=[];for(const stmt of statements)result.push(await stmt.run());db.exec('COMMIT');return result}
 catch(e){db.exec('ROLLBACK');throw e}
}}
const stubs={
 '@/lib/db':{getDB:async()=>adapter,generateId:()=>crypto.randomUUID(),query:async(sql,args=[])=>db.prepare(sql).all(...args),queryOne:async(sql,args=[])=>db.prepare(sql).get(...args)||null},
 '@/lib/auth/session':{getSession:async()=>session,getEffectiveRoles:s=>s?.roles||[],isSuperAccess:s=>s?.roles?.includes('admin')},
 '@/lib/auth/feature':{canFeatureForSession:async()=>true},
 '@/lib/activity-log':{actorFromSession:s=>s,logActivity:async()=>{}},
 'next/cache':{revalidatePath:()=>{}},
}
const original=Module._load
Module._load=function(request,parent,isMain){
 if(stubs[request])return stubs[request]
 if(request.startsWith('@/'))request=path.join(root,request.slice(2))
 return original.call(this,request,parent,isMain)
}
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file)
const workflow=require('../app/dashboard/poskestren/pemeriksaan/clinical-workflow-actions.ts')
const actions=require('../app/dashboard/poskestren/pemeriksaan/actions.ts')
const records=require('../app/dashboard/poskestren/pemeriksaan/clinical-actions.ts')
const observation=require('../app/dashboard/poskestren/observasi/actions.ts')
const payroll=require('../app/dashboard/poskestren/laporan/actions.ts')
const {prepareStockMutation}=require('../lib/poskestren/stock.ts')
const stock=()=>db.prepare('SELECT total_stock_base AS n FROM poskestren_medicine WHERE id=?').get('test-med').n
async function main(){
 db.exec(`INSERT INTO poskestren_medicine(id,name,base_unit,total_stock_base) VALUES('test-med','Obat Uji','tablet',20);
 INSERT INTO poskestren_medicine_location_stock(medicine_id,location_id,quantity_base) VALUES('test-med','pos-location-central',20);
 INSERT INTO poskestren_diagnosis(id,name) VALUES('diagnosis','Diagnosis uji');`)
 const data={complaint:'Keluhan',diagnosisId:'diagnosis',diagnosis:'Diagnosis uji',treatment:'Hasil pemeriksaan',allergies:'Penisilin',diseaseHistory:'Asma'}
 const items=[{medicineId:'test-med',requestedQuantityBase:3,dosage:'3 x 1'},
   {medicineId:'',sourceType:'EXTERNAL',medicineName:'Obat luar',requestedQuantityBase:4,unit:'kapsul',dosage:'2 x 1',notes:'Beli di apotek'}]
 const registration=await actions.registerManualVisit({patientId:'patient',complaint:'Pendaftaran',queueDate:'2026-09-02',allergies:'Catatan saat datang'})
 assert.ok(registration.success)
 assert.equal(db.prepare('SELECT allergies FROM poskestren_patient WHERE id=?').get('patient').allergies,'Penisilin')
 const snap=JSON.parse(db.prepare('SELECT clinical_snapshot FROM poskestren_visit WHERE id=?').get(registration.id).clinical_snapshot)
 assert.equal(snap.allergies,'Catatan saat datang');assert.equal(snap.diseaseHistory,'Asma')
 const initialPayroll=await payroll.getPayrollReport('2026-09')
 session={...session,id:'staff'}
 await workflow.registerDormVisit({...data,santriId:'s1',visitedAt:'2026-09-02T08:00',requestId:'dorm'})
 await assert.rejects(()=>workflow.beginDormExamination('dorm'),/dokter/)
 session={...session,id:'u1'}
 await workflow.beginDormExamination('dorm')
 await workflow.completeClinicalExamination({...data,source:'VISIT_ASRAMA',sourceId:'dorm',requestId:'exam',prescriptionItems:items})
 assert.equal(stock(),20,'Saving a prescription must not reduce stock')
 assert.equal((await payroll.getPayrollReport('2026-09')).grandTotal,initialPayroll.grandTotal+10000)
 await assert.rejects(()=>workflow.completeClinicalExamination({...data,source:'VISIT_ASRAMA',sourceId:'dorm',requestId:'exam2',prescriptionItems:items}))
 const rx=await workflow.getClinicalPrescription('exam')
 const stockItem=rx.find(i=>i.source_type==='STOCK')
 const commands={examId:'exam',items:[{id:stockItem.id,quantity:3}]}
 await workflow.deliverClinicalPrescription(commands)
 assert.equal(stock(),17)
 await assert.rejects(()=>workflow.deliverClinicalPrescription(commands))
 assert.equal(stock(),17)
 assert.equal((await payroll.getPayrollReport('2026-09')).grandTotal,initialPayroll.grandTotal+10000)
 // Direct doctor registration and observation share clinical inputs, no visit session fee.
 await workflow.registerDormVisit({...data,santriId:'s1',visitedAt:'2026-09-02T09:00',requestId:'direct'})
 await workflow.beginDormExamination('direct')
 await workflow.completeClinicalExamination({...data,source:'VISIT_ASRAMA',sourceId:'direct',requestId:'direct-exam',prescriptionItems:[items[1]]})
 assert.equal((await workflow.getClinicalDeliveryQueue()).length,0,'External-only visit must not block on stock delivery')
 const obs=await observation.createObservation({santriId:'s1',admittedAt:'2026-09-02T10:00',symptoms:'Pantau',requestId:'observation',clinicalSnapshot:data})
 assert.ok(obs.success)
 const beforeObservation=(await payroll.getPayrollReport('2026-09')).grandTotal
 await workflow.completeClinicalExamination({...data,source:'OBSERVASI',sourceId:obs.id,requestId:'obs-exam',prescriptionItems:items})
 assert.equal(stock(),17)
 assert.equal((await payroll.getPayrollReport('2026-09')).grandTotal,beforeObservation)
 const obsRx=await workflow.getClinicalPrescription('obs-exam')
 await workflow.deliverClinicalPrescription({examId:'obs-exam',items:[{id:obsRx.find(i=>i.source_type==='STOCK').id,quantity:2}]})
 assert.equal(stock(),15)
 assert.equal((await observation.getObservationDetail(obs.id)).medicines.length,1)
 assert.equal((await observation.closeObservation({observationId:obs.id,dischargedAt:'2026-09-02T09:00',result:'RECOVERED'})).success,false)
 assert.ok((await observation.closeObservation({observationId:obs.id,dischargedAt:'2026-09-02T11:00',result:'RECOVERED'})).success)
 // Normal clinic prescriptions support external items and the new fee semantics.
 db.exec(`INSERT INTO poskestren_visit(id,patient_id,queue_date,queue_number,source_type,status,personnel_id) VALUES('normal','patient','2026-09-02',2,'MANUAL','DIPERIKSA','doctor')`)
 await actions.completeVisit({...data,visitId:'normal',prescriptionItems:items})
 assert.equal(stock(),15)
 assert.equal(db.prepare('SELECT fee_category FROM poskestren_visit WHERE id=?').get('normal').fee_category,'NORMAL')
 await assert.rejects(()=>actions.completeVisit({...data,visitId:'normal',prescriptionItems:items}))
 assert.equal((await actions.getVisitPrescriptionForDelivery('normal')).externalItems.length,1)
 await actions.deliverVisitMedicines({visitId:'normal',items:[{medicineId:'test-med',quantity:3}]})
 assert.equal(stock(),12)
 assert.equal((await actions.deliverVisitMedicines({visitId:'normal',items:[]})).success,false)
 // Revisions preserve external prescriptions and adjust only actual stock differences.
 db.exec("INSERT INTO poskestren_practice_session(id,personnel_id,session_date,status,started_at,ended_at) VALUES('practice','doctor','2026-09-02','CLOSED','2026-09-02T01:00:00Z','2026-09-02T02:00:00Z')")
 const revised=await records.reviseCompletedVisitFull({...data,visitId:'normal',reason:'Koreksi catatan',practiceSessionId:'practice',followUp:'Tindakan medis',prescriptionItems:items})
 assert.ok(revised.success);assert.equal(stock(),12)
 assert.equal(db.prepare('SELECT fee_category FROM poskestren_visit WHERE id=?').get('normal').fee_category,'TREATMENT')
 const editor=await require('../app/dashboard/poskestren/pemeriksaan/revision-cleanup-actions.ts').getVisitRevisionEditorData('normal')
 assert.equal(editor.prescriptionItems.filter(i=>i.source_type==='EXTERNAL').length,1)
 for(const filter of [{diagnosisId:'diagnosis'},{personnelId:'doctor'},{medicineId:'test-med'}]) {
  assert.ok((await records.getMedicalRecordPatients({...filter,limit:100})).items.some(i=>i.patient_id==='patient'))
 }
 // A stale stock snapshot must roll the entire batch back, never write a phantom movement.
 const mutation=await prepareStockMutation(adapter,{medicineId:'test-med',quantityDelta:-1,movementType:'PATIENT',movementDate:'2026-09-02',referenceType:'TEST',referenceId:'stale',actorId:'u1'})
 db.exec("UPDATE poskestren_medicine SET total_stock_base=11 WHERE id='test-med'")
 await assert.rejects(()=>adapter.batch(mutation.statements))
 assert.equal(db.prepare("SELECT COUNT(*) n FROM poskestren_stock_movement WHERE reference_id='stale'").get().n,0)
 const timeline=await records.getPatientMedicalTimeline({patientId:'patient',limit:100})
 assert.ok(timeline.items.find(i=>i.event_type==='VISIT_ASRAMA').detail)
 assert.equal(timeline.items.find(i=>i.event_id==='normal').detail.medicines.length,2)
 assert.ok(!(await actions.getExaminationHistory({limit:100})).items.some(i=>i.id==='dorm'))
 db.exec("INSERT INTO poskestren_compensation_history(id,personnel_id,effective_from,patient_rate_rupiah) VALUES('next-rate','doctor','2026-10-01',15000)")
 await workflow.registerDormVisit({...data,santriId:'s1',visitedAt:'2026-09-30T18:00:00Z',requestId:'oct-dorm'})
 await workflow.beginDormExamination('oct-dorm')
 await workflow.completeClinicalExamination({...data,source:'VISIT_ASRAMA',sourceId:'oct-dorm',requestId:'oct-exam',prescriptionItems:[]})
 assert.equal((await payroll.getPayrollReport('2026-10')).medical.find(i=>i.id==='doctor').dorm_subtotal,15000)
 session={...session,roles:['admin']}
 assert.equal((await records.getPatientMedicalTimeline({patientId:'patient'})).accessMode,'FULL')
 const originalAllergy=db.prepare('SELECT allergies FROM poskestren_patient WHERE id=?').get('patient').allergies
 assert.equal(originalAllergy,'Penisilin')
 assert.ok((await actions.updatePatient({id:'patient',profileVersion:0,allergies:'Alergi baru'})).success)
 assert.equal((await actions.updatePatient({id:'patient',profileVersion:0,allergies:'Stale'})).success,false)
 assert.equal(db.prepare('SELECT special_conditions FROM poskestren_patient WHERE id=?').get('patient').special_conditions,'Asma')
 assert.equal((await records.getPatientMedicalTimeline({patientId:'patient'})).items.find(i=>i.event_id==='normal').detail.clinical.allergies,'Penisilin')
 session={id:'staff',role:'pengurus_asrama',roles:['pengurus_asrama'],asrama_binaan:'A'}
 const summary=await records.getPatientMedicalTimeline({patientId:'patient'})
 assert.deepEqual(Object.keys(summary.patient).sort(),['nama_lengkap','patient_id'])
 assert.ok(summary.items.every(i=>Object.keys(i).sort().join(',')==='event_at,event_id'))
 const list=await records.getMedicalRecordPatients({limit:100})
 assert.ok(list.items.every(i=>Object.keys(i).sort().join(',')==='last_event_at,nama_lengkap,patient_id'))
 await assert.rejects(()=>records.getMedicalRecordPatients({diagnosisId:'diagnosis'}),/Filter klinis/)
 const other=db.prepare('SELECT id FROM poskestren_patient WHERE santri_id=?').get('s2')
 await assert.rejects(()=>records.getPatientMedicalTimeline({patientId:other.id}),/asrama/)
 const search=await records.searchHealthSantri('Santri')
 assert.ok(search.every(i=>i.drug_allergies===null&&i.disease_history===null))
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[])
 console.log('PASS: migration, profiles, privacy, clinical workflows, external prescriptions, stock transactions, payroll and legacy preservation')
}
main().catch(error=>{console.error(error);process.exitCode=1})
