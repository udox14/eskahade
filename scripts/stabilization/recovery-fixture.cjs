/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic historical fixture; never remote. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/sandbox-recovery-20261019');
const read=f=>JSON.parse(fs.readFileSync(path.join(out,f),'utf8'));
const objects=read('demo-schema-readonly.json')[0].results;
const q=s=>'"'+s.replaceAll('"','""')+'"';
function create(file=':memory:',withLegacy=true){
 const db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON');
 for(const type of ['table','index','view'])for(const o of objects.filter(o=>o.type===type&&o.sql))db.exec(o.sql);
 const put=(sql,...params)=>db.prepare(sql).run(...params);
 put("INSERT INTO users(id,email,password_hash,full_name,role,roles) VALUES('historical-operator','historical@fixture.test','synthetic-not-a-login-hash','Synthetic historical operator','admin','[\"admin\"]')");
 put("INSERT INTO santri(id,nis,nama_lengkap,jenis_kelamin,asrama,tahun_masuk,saldo_uang_jajan) VALUES('historical-student','H0001','Historical Synthetic','L','AL-FALAH',2026,777)");
 if(withLegacy){
  put("INSERT INTO spp_log(id,santri_id,bulan,tahun,nominal_bayar,penerima_id) VALUES('legacy-july','historical-student',7,2026,20000,'historical-operator')");
  put("INSERT INTO spp_log(id,santri_id,bulan,tahun,nominal_bayar,penerima_id) VALUES('legacy-oct','historical-student',10,2026,20000,'historical-operator')");
  // No PSB link: both are legacy Dewan SPP, determined by the original predicate.
  put("INSERT INTO finance_distribution_recipients(id,recipient_type,name,allowed_methods) VALUES('rec_pesantren','PESANTREN','Historical Synthetic recipient','BRI_QLOLA,CASH,MANUAL_TRANSFER')");
  for(const method of ['BRI_QLOLA','CASH','MANUAL_TRANSFER'])put("INSERT INTO finance_recipient_allowed_methods(recipient_id,method) VALUES('rec_pesantren',?)",method);
  put("INSERT INTO finance_payments(id,payment_number,santri_id,channel,method,gross_amount,net_amount,status,paid_at) VALUES('synthetic-mismatch','SYNTHETIC-MISMATCH','historical-student','BRI','BRIVA',800000,800000,'PAID','2026-10-01T00:00:00Z')");
  for(let i=1;i<=13;i++)put("INSERT INTO finance_allocations(id,payment_id,target_type,item_type,amount) VALUES(?,'synthetic-mismatch','OBLIGATION','SPP',?)",'historical-allocation-'+i,i===13?200000:300000);
  for(let i=1;i<=21;i++){
   put("INSERT INTO finance_distributions(id,distribution_number,recipient_type,recipient_id,item_type,period,total_amount,method,status,submitted_by,transferred_by) VALUES(?,?,'PESANTREN','rec_pesantren','SPP','2026-10',1000,?,?, 'historical-operator','historical-operator')",'historical-distribution-'+i,'H-DIST-'+i,i===21?'BRI_QLOLA':'CASH',i===21?'PENDING_APPROVAL':'DISTRIBUTED');
   put('INSERT INTO finance_distribution_items(id,distribution_id,allocation_id,amount) VALUES(?,?,?,1000)','historical-dist-item-'+i,'historical-distribution-'+i,'historical-allocation-'+((i-1)%13+1));
  }
 }
 for(const r of read('demo-migrations-readonly.json')[0].results)put('INSERT INTO d1_migrations(id,name,applied_at) VALUES(?,?,?)',r.id,r.name,r.applied_at);
 for(const r of read('demo-features-readonly.json')[0].results){const cols=Object.keys(r);put(`INSERT INTO fitur_akses(${cols.map(q).join(',')}) VALUES(${cols.map(()=>'?').join(',')})`,...Object.values(r));}
 for(const r of read('demo-permissions-readonly.json')[0].results){const cols=Object.keys(r);put(`INSERT INTO role_fitur_crud_permission(${cols.map(q).join(',')}) VALUES(${cols.map(()=>'?').join(',')})`,...Object.values(r));}
 for(const o of objects.filter(o=>o.type==='trigger'&&o.sql))db.exec(o.sql);
 return db;
}
function historicalSnapshot(db){const result={};for(const o of objects.filter(o=>o.type==='table'&&o.name!=='d1_migrations')){const cols=db.prepare('PRAGMA table_info('+q(o.name)+')').all().map(c=>c.name);const rows=db.prepare('SELECT '+cols.map(q).join(',')+' FROM '+q(o.name)).all().map(r=>JSON.stringify(r)).sort();result[o.name]={columns:cols,rows};}return result;}
function checkPreserved(db,before){const errors=[];for(const [name,b] of Object.entries(before)){const now=db.prepare('SELECT '+b.columns.map(q).join(',')+' FROM '+q(name)).all().map(r=>JSON.stringify(r)).sort();for(const row of b.rows)if(!now.includes(row))errors.push(name+' historical row altered');}if(errors.length)throw Error(errors.join('\n'));return {tables:Object.keys(before).length,rows:Object.values(before).reduce((n,r)=>n+r.rows.length,0),sha256:crypto.createHash('sha256').update(JSON.stringify(before)).digest('hex')};}
module.exports={root,out,objects,q,read,create,historicalSnapshot,checkPreserved};
