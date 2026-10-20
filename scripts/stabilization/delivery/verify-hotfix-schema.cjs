/* eslint-disable @typescript-eslint/no-require-imports -- Offline validation only; input must be an approved fresh read-only export. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),file=process.argv[2];if(!file)throw Error('Fresh schema JSON path required');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),base=read(path.join(root,'output/stabilization-20261019/production-schema-readonly.json')),current=read(file);
assert.ok(current.every(r=>r.success!==false&&r.meta?.rows_written===0),'Verified zero-write results required');
const normalize=rows=>rows.map(({type,name,tbl_name,sql})=>({type,name,tbl_name,sql})).sort((a,b)=>(a.type+'\0'+a.name).localeCompare(b.type+'\0'+b.name,'en'));
assert.deepEqual(normalize(current[0].results),normalize(base[0].results),'STOP actual schema drift; do not assume migrations or hotfix compatibility');
console.log(JSON.stringify({status:'PASS_EXACT_SCHEMA_ONLY',schemaSha256:crypto.createHash('sha256').update(JSON.stringify(normalize(current[0].results))).digest('hex'),remainingGates:['Snapshot freshness/provenance, owner approval and effective permissions','No invalid stored roles; normal authenticated production smoke','Code ETag/settings/assets/secret identity match; preview closure']}));
