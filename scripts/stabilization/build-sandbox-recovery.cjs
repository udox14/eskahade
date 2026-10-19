/* eslint-disable @typescript-eslint/no-require-imports -- Offline, forward-only sandbox recovery compiler. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'../..'),prior=path.join(root,'output/stabilization-20261019'),out=path.join(root,'output/sandbox-recovery-20261019'),dir=path.join(root,'migrations/sandbox-recovery');
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(out,{recursive:true});
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const actual=read(path.join(out,'demo-schema-readonly.json'))[0].results,expected=read(path.join(prior,'local-final-schema.json'));
const count=read(path.join(out,'demo-counts-readonly.json'))[0].results[0];
const ledger=read(path.join(out,'demo-migrations-readonly.json'))[0].results;
for(const n of ['0187','0188','0189','0190','0191'])if(!ledger.some(r=>r.name.startsWith(n+'_')))throw Error('Required applied ledger absent: '+n);
if(ledger.some(r=>/^019[2-5]_/.test(r.name)))throw Error('Migration number now occupied; do not overwrite applied history');
const q=s=>'"'+s.replaceAll('"','""')+'"',lit=s=>s==null?'NULL':typeof s==='number'?String(s):"'"+String(s).replaceAll("'","''")+"'";
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
function strip(sql){return sql.replace(/--[^\r\n]*|\/\*[\s\S]*?\*\//g,' ');}
function definitions(sql){const s=strip(sql),start=s.indexOf('('),parts=[];let depth=0,quote=null,from=start+1;for(let i=start+1;i<s.length;i++){const c=s[i];if(quote){if(c===quote){if(s[i+1]===quote)i++;else quote=null;}continue;}if(c==="'"||c==='"'||c==='`'){quote=c;continue;}if(c==='(')depth++;if(c===')'){if(depth===0){parts.push(s.slice(from,i).trim());break;}depth--;}if(c===','&&depth===0){parts.push(s.slice(from,i).trim());from=i+1;}}return parts;}
function columnDefinition(sql,name){const d=definitions(sql).find(p=>{const m=p.match(/^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|(\w+))/);return (m?.[1]||m?.[2]||m?.[3]||m?.[4])===name;});if(!d)throw Error('Cannot preserve column constraint: '+name);return d;}
const virtual=objects=>objects.filter(o=>/CREATE VIRTUAL TABLE/i.test(o.sql||'')).map(o=>o.name);
const shadow=(o,objects)=>virtual(objects).some(n=>o.name.startsWith(n+'_'));
function database(objects){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const type of ['table','index','view','trigger'])for(const o of objects.filter(o=>o.type===type&&o.sql&&!shadow(o,objects)))db.exec(o.sql);return db;}
const have=database(actual),want=database(expected),exists=o=>actual.some(a=>a.type===o.type&&a.name===o.name);
const inventory=read(path.join(prior,'application-inventory.json'));
const sources=inventory.routes.flatMap(r=>r.dependencies);const sourceFiles=[...new Set(sources)].filter(f=>fs.existsSync(path.join(root,f)));
const text=new Map(sourceFiles.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
const refs=name=>sourceFiles.filter(f=>new RegExp('\\b'+name+'\\b').test(text.get(f)));
const stageFiles=['0192_sandbox_missing_module_tables.sql','0193_sandbox_compatibility_columns.sql','0194_sandbox_indexes_and_integrity.sql','0195_sandbox_dictionary_and_menu.sql'];
const deferred=new Set(['absensi_guru_kunci','absensi_guru_kunci_log','idx_absensi_guru_kunci_log_period']);
const stages=stageFiles.map((file,i)=>({file,order:i+1,statements:[]}));
const add=(i,sql)=>stages[i].statements.push(sql.replace(/;\s*$/,'')+';');
const guard=(i,predicate,label)=>add(i,`SELECT json(CASE WHEN (${predicate}) THEN 'true' ELSE 'STOP_${label}' END)`);
const classification=[],mappings=[];
for(const o of expected.filter(o=>o.type==='table'&&!exists(o)&&!shadow(o,expected))){
 if(deferred.has(o.name)){classification.push({type:o.type,name:o.name,decision:'DEFER_UNUSED_LEGACY_TABLE_NO_ACTIVE_CODE_OR_REQUIRED_FK_DEPENDENCY'});continue;}
 // New module tables are empty. No production rows or shadow FTS tables copied.
 classification.push({type:o.type,name:o.name,decision:'ADD_EMPTY_MODULE_TABLE',activeReferences:refs(o.name),foreignDependencies:want.prepare('PRAGMA foreign_key_list('+q(o.name)+')').all().map(f=>f.table)});add(0,o.sql);
}
// Defaults on nonempty historical money records are forbidden. These exact
// empty-table predicates are executed again in the frozen target before DDL.
for(const table of ['psb_payment_receipt','tabungan_log','upk_pemasukan','spp_setoran','pembayaran_tahunan','ehb_pengawas'])guard(1,`SELECT COUNT(*)=0 FROM ${q(table)}`,'NONEMPTY_'+table);
const legacy=read(path.join(prior,'schema-repair-plan/sandbox-plan.json')).requiresSeparateMapping;
for(const o of expected.filter(o=>o.type==='table'&&exists(o)&&!shadow(o,expected)&&!virtual(expected).includes(o.name))){
 const old=have.prepare('PRAGMA table_info('+q(o.name)+')').all(),cols=want.prepare('PRAGMA table_info('+q(o.name)+')').all();
 for(const c of cols.filter(c=>!old.some(x=>x.name===c.name))){
  const def=columnDefinition(o.sql,c.name);add(1,`ALTER TABLE ${q(o.name)} ADD COLUMN ${def}`);
  const financial=legacy.some(x=>x.table===o.name&&x.column===c.name);
  const rule=o.name==='santri'&&c.name==='saldo_tabungan'?'NEW_PROJECTION_FROM_EMPTY_TABUNGAN_LEDGER_NOT_EXISTING_JAJAN':o.name==='spp_log'&&c.name==='tujuan_setoran'?'ORIGINAL_0116_PSB_JULY_AND_ENTRY_YEAR_RULE':financial&&count[o.name]===0?'EMPTY_SOURCE_TABLE_NO_HISTORICAL_VALUES':financial?'NULL_NO_PARENT_HISTORY_OR_NEW_METADATA':'ORIGINAL_COLUMN_DEFINITION_CHECK_AND_FK_PRESERVED';
  const row={table:o.name,column:c.name,definition:def,decision:rule,observedSourceRows:count[o.name]??null};classification.push({type:'column',name:o.name+'.'+c.name,...row});if(financial)mappings.push(row);
 }
 // Existing column/FK differences are explicitly retained; cosmetic whitespace
 // and comments are normalized. No implicit table rebuild from production.
 for(const c of cols.filter(c=>old.some(x=>x.name===c.name))){const before=old.find(x=>x.name===c.name);if(['type','notnull','dflt_value','pk'].some(k=>before[k]!==c[k]))classification.push({type:'existing-column',name:o.name+'.'+c.name,decision:'RETAIN_EXISTING_REVIEWED_METADATA',actual:before,reference:c});}
 const fkHave=have.prepare('PRAGMA foreign_key_list('+q(o.name)+')').all(),fkWant=want.prepare('PRAGMA foreign_key_list('+q(o.name)+')').all();
 for(const fk of fkWant.filter(f=>old.some(c=>c.name===f.from)&&!fkHave.some(h=>h.from===f.from&&h.table===f.table&&h.to===f.to)))classification.push({type:'foreign-key',name:o.name+'.'+fk.from,decision:'RETAIN_EXISTING_NO_DESTRUCTIVE_REBUILD',reference:fk,limitation:'Preflight anti-join and existing application authorization; schema is intentionally not identical to production.'});
}
// Only the new projection column is written. Existing jajan balances and all
// old ledger rows are untouched; guard above proves legacy ledger is empty.
add(1,"UPDATE santri SET saldo_tabungan=COALESCE((SELECT SUM(CASE jenis WHEN 'MASUK' THEN nominal ELSE -nominal END) FROM tabungan_log t WHERE t.santri_id=santri.id AND t.dompet='TABUNGAN'),0)");
add(1,"UPDATE spp_log SET tujuan_setoran='BENDAHARA_PUSAT' WHERE bulan=7 AND EXISTS(SELECT 1 FROM psb_flow pf WHERE pf.santri_id=spp_log.santri_id) AND EXISTS(SELECT 1 FROM santri s WHERE s.id=spp_log.santri_id AND COALESCE(NULLIF(CAST(s.tahun_masuk AS INTEGER),0),CAST(substr(s.tanggal_masuk,1,4) AS INTEGER))=spp_log.tahun)");
// New health identity column: original 0126 deterministic backfill, no old
// identity/finance field overwritten. Seed its sequence before insert trigger.
add(1,`WITH ranked AS (SELECT id,CASE WHEN UPPER(SUBSTR(TRIM(nama_lengkap),1,1)) GLOB '[A-Z]' THEN UPPER(SUBSTR(TRIM(nama_lengkap),1,1)) ELSE 'X' END AS initial_letter,ROW_NUMBER() OVER(PARTITION BY CASE WHEN UPPER(SUBSTR(TRIM(nama_lengkap),1,1)) GLOB '[A-Z]' THEN UPPER(SUBSTR(TRIM(nama_lengkap),1,1)) ELSE 'X' END ORDER BY created_at,id) AS sequence_number FROM santri) UPDATE santri SET poskestren_code=(SELECT initial_letter||'-'||sequence_number FROM ranked WHERE ranked.id=santri.id) WHERE poskestren_code IS NULL OR poskestren_code=''`);
add(1,`INSERT INTO poskestren_patient_code_sequence(initial_letter,next_number) SELECT SUBSTR(poskestren_code,1,1),MAX(CAST(SUBSTR(poskestren_code,INSTR(poskestren_code,'-')+1) AS INTEGER))+1 FROM santri WHERE poskestren_code IS NOT NULL AND poskestren_code<>'' GROUP BY SUBSTR(poskestren_code,1,1) ON CONFLICT(initial_letter) DO UPDATE SET next_number=MAX(next_number,excluded.next_number)`);
for(const type of ['index','view','trigger'])for(const o of expected.filter(o=>o.type===type&&!exists(o))){if(deferred.has(o.name)){classification.push({type,name:o.name,decision:'DEFER_WITH_UNUSED_LEGACY_TABLE'});continue;}classification.push({type,name:o.name,decision:'ADD_REQUIRED_DEPENDENT_OBJECT',table:o.tbl_name});add(2,o.sql);}
// Replacement uniqueness includes recipient destination, as required by 0116.
// Create the new unique index above BEFORE removing obsolete narrower indexes.
for(const name of ['uq_spp_setoran_asrama_bulan_tahun','uq_spp_setoran_unit_setor_bulan_tahun'])if(actual.some(o=>o.type==='index'&&o.name===name)){add(2,'DROP INDEX '+q(name));classification.push({type:'index',name,decision:'REPLACE_WITH_EXISTING_0116_DESTINATION_AWARE_UNIQUE_INDEX'});}
// Demo has only stale-balance protection. Supplement it, preserving its trigger
// and every historical row; do not silently replace same-name trigger bodies.
add(2,`CREATE TRIGGER trg_sandbox_recovery_wallet_arithmetic BEFORE INSERT ON finance_wallet_ledger BEGIN
 SELECT CASE WHEN NEW.balance_before+(CASE NEW.direction WHEN 'IN' THEN NEW.amount ELSE -NEW.amount END)<0 THEN RAISE(ABORT,'OVERDRAW_DETECTED') END;
 SELECT CASE WHEN NEW.balance_after!=NEW.balance_before+(CASE NEW.direction WHEN 'IN' THEN NEW.amount ELSE -NEW.amount END) THEN RAISE(ABORT,'INVALID_BALANCE_AFTER') END; END`);
classification.push({type:'trigger',name:'trg_finance_wallet_verify_balance',decision:'PRESERVE_AND_SUPPLEMENT_MISSING_OVERDRAW_AND_ARITHMETIC_GUARDS'});
for(const operation of ['INSERT','UPDATE OF distribution_id,allocation_id,amount'])add(2,`CREATE TRIGGER trg_sandbox_recovery_quarantine_dist_${operation.startsWith('INSERT')?'insert':'update'} BEFORE ${operation} ON finance_distribution_items
 WHEN EXISTS(SELECT 1 FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id WHERE a.id=NEW.allocation_id AND (SELECT COALESCE(SUM(amount),0) FROM finance_allocations x WHERE x.payment_id=p.id)>p.gross_amount)
 BEGIN SELECT RAISE(ABORT,'INTERNAL_CONSERVATION_CASE_OPEN: allocation exceeds recorded payment'); END`);
classification.push({type:'trigger',name:'trg_sandbox_recovery_quarantine_dist_insert/update',decision:'BLOCK_NEW_DISTRIBUTION_FROM_OVERALLOCATED_PAYMENT_PRESERVE_HISTORY_AND_PENDING_BANK_RESERVATIONS'});
// Seed dictionaries, not users, passwords, bank accounts, balances or tariffs.
add(3,"INSERT OR IGNORE INTO poskestren_cash_account(id,name,account_type,is_active,created_by) VALUES('pos-cash-default','Kas Tunai','CASH',1,NULL)");
for(const r of [['pos-income-other','Lainnya','INCOME',0],['pos-expense-other','Lainnya','EXPENSE',0],['pos-expense-medicine','Belanja Obat','EXPENSE',1]])add(3,`INSERT OR IGNORE INTO poskestren_finance_category(id,name,direction,is_system,is_active) VALUES(${r.map(lit).join(',')},1)`);
for(const r of [['terlambat','Terlambat',1],['kitab','Tidak membawa kitab',2],['tidur','Tidur',3],['mengganggu','Mengganggu pengajian',4]])add(3,`INSERT OR IGNORE INTO pengajian_violation_types(id,name,position) VALUES(${r.map(lit).join(',')})`);
const demoFeatures=read(path.join(out,'demo-features-readonly.json'))[0].results,demoPermissions=read(path.join(out,'demo-permissions-readonly.json'))[0].results;
const [prodFeatures,prodPermissions]=read(path.join(prior,'production-feature-config-readonly.json'));
const missingFeatures=prodFeatures.results.filter(r=>!demoFeatures.some(d=>d.href===r.href)&&!['/dashboard/guru'].includes(r.href));
for(const r of missingFeatures){const cols=['group_name','title','href','icon','roles','is_active','urutan','is_bottomnav','bottomnav_urutan'];add(3,`INSERT OR IGNORE INTO fitur_akses(${cols.join(',')}) VALUES(${cols.map(c=>lit(r[c])).join(',')})`);}
for(const r of prodPermissions.results.filter(r=>missingFeatures.some(f=>f.href===r.fitur_href))){const cols=['fitur_href','role','can_create','can_update','can_delete'];add(3,`INSERT OR IGNORE INTO role_fitur_crud_permission(${cols.join(',')}) VALUES(${cols.map(c=>lit(r[c])).join(',')})`);}
for(const o of actual.filter(o=>!expected.some(e=>e.name===o.name&&e.type===o.type)&&!shadow(o,actual)))if(!classification.some(c=>c.name===o.name))classification.push({type:o.type,name:o.name,decision:'RETAIN_DEMO_SPECIFIC_NO_APPLICATION_CONFLICT'});
for(const o of expected.filter(o=>exists(o)&&o.sql&&['table','trigger','view','index'].includes(o.type))){const old=actual.find(a=>a.type===o.type&&a.name===o.name);if(strip(old.sql).replace(/\s/g,'')!==strip(o.sql).replace(/\s/g,''))classification.push({type:o.type,name:o.name,decision:o.type==='table'?'RETAIN_EXISTING_TABLE_PLUS_EXPLICIT_ADDITIONS':o.name==='trg_finance_wallet_verify_balance'?'SUPPLEMENTED_ABOVE':'REVIEW_DIFFERENT_EXISTING_OBJECT_NO_AUTOMATIC_REPLACEMENT',actualSql:old.sql,referenceSql:o.sql});}
for(const s of stages){s.statements.unshift(`SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM d1_migrations WHERE name=${lit(s.file)}) THEN 'true' ELSE 'STOP_MIGRATION_ALREADY_RECORDED' END);`);s.statements.push(`INSERT INTO d1_migrations(name) VALUES(${lit(s.file)});`);const body='-- SANDBOX ONLY. Explicit operator approval, frozen preflight and backup required.\n-- Never use d1 migrations apply, never apply to production, never replay a partial stage.\n'+s.statements.join('\n\n')+'\n';fs.writeFileSync(path.join(dir,s.file),body);s.sha256=sha(body);s.statementCount=s.statements.length;}
const plan={createdAt:new Date().toISOString(),target:{name:'eskahade-demo-db',id:'677f05ba-9b52-4534-9542-96cc785f25e4'},snapshotSha256:sha(actual),remoteWrites:0,numberingVerifiedAgainstLedger:ledger.map(r=>r.name),stages,mappings,classification,seed:{missingFeatures,existingFeaturesPreserved:demoFeatures.length,existingPermissionsPreserved:demoPermissions.length},guards:'All empty-source predicates re-run after maintenance. Historical SPP classification follows 0116. No production transactions copied. Existing money and role rows must hash-identically before/after.',blockers:['Internal demo payment/allocation mismatch remains open: schema repair does not correct or authorize spending this payment. Follow separate conservation-case procedure.','No portal password is invented: synthetic local credentials only; remote credential enrollment requires named operator action.']};
fs.writeFileSync(path.join(out,'recovery-plan.json'),JSON.stringify(plan,null,2));
fs.writeFileSync(path.join(out,'mapping-19-columns.json'),JSON.stringify({count:mappings.length,mappings,provenance:['Exact fresh demo schema and aggregate empty-table counts','Original migration 0062: wallet separation and ledger semantics, not replayed','Original migration 0116: deterministic new SPP destination attribute, not replayed'],conditions:'Only valid under the same frozen schema and row predicates. A nonempty source causes STOP before DDL; no guessed fallback.'},null,2));
have.close();want.close();console.log(JSON.stringify({stages:stages.map(s=>({file:s.file,statements:s.statementCount})),mappings:mappings.length,classified:classification.length,missingMenuEntries:missingFeatures.length}));
