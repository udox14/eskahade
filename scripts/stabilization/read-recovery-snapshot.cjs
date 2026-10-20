/* eslint-disable @typescript-eslint/no-require-imports -- Allowlisted schema metadata and aggregate SELECTs only. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),ts=require('typescript');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.ESKAHADE_RECOVERY_SNAPSHOT_DIR||path.join(root,'output/sandbox-recovery-20261019'));fs.mkdirSync(out,{recursive:true});
const config=ts.parseConfigFileTextToJson('wrangler.jsonc',fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8')).config;
const id='677f05ba-9b52-4534-9542-96cc785f25e4';
if(!config.env.sandbox.d1_databases.some(d=>d.binding==='DEMO_DB'&&d.database_name==='eskahade-demo-db'&&d.database_id===id))throw Error('Target identity mismatch');
const queries={
 schema:"SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name",
 migrations:'SELECT id,name,applied_at FROM d1_migrations ORDER BY id',
 counts:'SELECT '+['santri','tabungan_log','spp_log','spp_setoran','psb_payment_receipt','upk_pemasukan','pembayaran_tahunan','ehb_pengawas','fitur_akses','role_fitur_crud_permission','finance_distribution_recipients','finance_recipient_allowed_methods'].map(t=>`(SELECT COUNT(*) FROM ${t}) AS ${t}`).join(','),
 roles:'SELECT role,COUNT(*) AS user_count FROM users GROUP BY role',
 features:'SELECT group_name,title,href,icon,roles,is_active,urutan,is_bottomnav,bottomnav_urutan FROM fitur_akses ORDER BY href',
 permissions:'SELECT fitur_href,role,can_create,can_update,can_delete FROM role_fitur_crud_permission ORDER BY fitur_href,role',
};
for(const [name,sql] of Object.entries(queries)){
 if(!/^SELECT\b/.test(sql)||/\b(INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|CREATE)\b/.test(sql))throw Error('Read-only guard');
 const r=spawnSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','eskahade-demo-db','--env','sandbox','--remote','--command='+sql,'--json'],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
 if(r.status||r.error){fs.writeFileSync(path.join(out,'read-failure.json'),r.stdout||'{}');throw Error(name+' read failed; diagnostic saved locally');}
 const rows=JSON.parse(r.stdout);if(rows.some(v=>v.meta?.rows_written!==0))throw Error('Unexpected write count');
 fs.writeFileSync(path.join(out,'demo-'+name+'-readonly.json'),JSON.stringify(rows,null,2));console.log(name+': read-only, zero writes');
}
