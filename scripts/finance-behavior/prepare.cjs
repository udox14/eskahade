// Build a schema-only disposable fixture from the existing migration-derived harness.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createDatabase}=require('../finance-remediation-fixture.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/final-behavioral-gate-66449217/isolated');fs.mkdirSync(out,{recursive:true});
const db=createDatabase(189,false),objects=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name").all();
const sql=['-- SYNTHETIC DISPOSABLE DATABASE ONLY. Never use production/demo/rehearsal.',...['table','index','view','trigger'].flatMap(type=>objects.filter(x=>x.type===type).map(x=>x.sql.replace(/;\s*$/,'')+';')),
 "CREATE TABLE finance_behavior_control(id TEXT PRIMARY KEY,marker TEXT NOT NULL);",
 "CREATE TABLE finance_behavior_runs(id TEXT PRIMARY KEY,status TEXT NOT NULL,result_json TEXT);",
 "INSERT INTO finance_behavior_control VALUES('identity','ESKAHADE_SYNTHETIC_ONLY_66449217_FIN_GATE');",
 "INSERT INTO tahun_ajaran(id,nama,is_active) VALUES(2,'Synthetic year',1);"].join('\n\n')+'\n';
fs.writeFileSync(path.join(out,'schema.sql'),sql);
const migrations=[152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,171,172,173,182,183,184,185,186,187,188,189].map(n=>{const name=fs.readdirSync(path.join(root,'migrations')).find(x=>x.startsWith(String(n).padStart(4,'0')+'_'));return{file:'migrations/'+name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'migrations',name))).digest('hex')}});
fs.writeFileSync(path.join(out,'schema-provenance.json'),JSON.stringify({source:'Existing finance-remediation-fixture.cjs createDatabase(189,false); all finance definitions from actual migrations, not handwritten finance tables',dependencySchema:'Six minimal synthetic non-finance dependency tables: users, santri, master_jasa, tahun_ajaran, app_settings, fitur_akses. Not a full production clone.',financeObjects:objects.filter(o=>o.name.startsWith('finance_')||o.tbl_name.startsWith('finance_')).length,objects:objects.length,triggers:objects.filter(o=>o.type==='trigger').length,sha256:crypto.createHash('sha256').update(sql).digest('hex'),containsRealRecords:false,containsSyntheticFinancialRecords:false,migrations},null,2)+'\n');db.close();console.log('Disposable schema prepared; no remote command executed.');
