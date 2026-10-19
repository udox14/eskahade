/* eslint-disable @typescript-eslint/no-require-imports -- Offline validation of read-only operator snapshots. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),base=path.resolve(process.argv[2]||path.join(root,'output/sandbox-recovery-20261019')),current=path.resolve(process.argv[3]||base),next=Number(process.argv[4]||1);
if(!Number.isInteger(next)||next<1||next>5)throw Error('Next stage must be 1..5 (5=final postflight)');
const read=(dir,f)=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8').replace(/^\uFEFF/,''));
const plan=read(base,'recovery-plan.json'),schema=read(current,'demo-schema-readonly.json'),ledger=read(current,'demo-migrations-readonly.json'),counts=read(current,'demo-counts-readonly.json');
for(const group of [schema,ledger,counts])if(group.some(r=>r.meta?.rows_written!==0))throw Error('Snapshot is not a verified read-only query result');
const errors=[],hash=crypto.createHash('sha256').update(JSON.stringify(schema[0].results)).digest('hex');
const fingerprints=read(base,'stage-schema-fingerprints.json');
const expected=next===1?plan.snapshotSha256:fingerprints[next-1].sha256;
if(hash!==expected)errors.push('Schema differs from the exact approved stage. STOP; inspect drift/partial stage, do not replay.');
const names=ledger[0].results.map(r=>r.name);
for(const required of plan.numberingVerifiedAgainstLedger)if(!names.includes(required))errors.push('Baseline ledger entry missing: '+required);
for(const [i,s] of plan.stages.entries())if(names.includes(s.file)!==(i<next-1))errors.push('Stage ledger does not match expected next stage: '+s.file);
const allocatedNumbers=names.filter(n=>/^019[2-5]_/.test(n));for(const n of allocatedNumbers)if(!plan.stages.some(s=>s.file===n))errors.push('Number collision: '+n);
if(next<=2)for(const t of ['psb_payment_receipt','tabungan_log','upk_pemasukan','spp_setoran','pembayaran_tahunan','ehb_pengawas'])if(counts[0].results[0][t]!==0)errors.push('Historical mapping empty-source predicate failed: '+t);
const result={status:errors.length?'STOP':'PASS_OFFLINE_SCHEMA_AND_LEDGER_ONLY',nextStage:next===5?'POSTFLIGHT':plan.stages[next-1].file,errors,operatorMustStillConfirm:['Exact database ID/account','Maintenance and no concurrent writers','Verified private backup/bookmark and recovery owner','Money/row hashes unchanged, FK/integrity and approved role configuration','BRI and QLola flags OFF; no bank instruction retried or reservation released']};
console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
