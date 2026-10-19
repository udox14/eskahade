/* eslint-disable @typescript-eslint/no-require-imports -- Fixed read-only deployment metadata audit. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/stabilization-20261019');
const cli=path.join(root,'node_modules/wrangler/bin/wrangler.js');
const publicFlags=new Set(['BRI_ENV','BRI_OUTBOUND_ENABLED','BRI_BRIVA_OUTBOUND_ENABLED','BRI_BRIVA_INBOUND_ENABLED','BRI_STATEMENT_SYNC_ENABLED','BRI_DIST_CASH_ENABLED','BRI_DIST_MANUAL_ENABLED','FINANCE_PROOFS_PRIVATE_STORAGE_CONFIRMED','BUILD_TIMESTAMP','NEXT_PUBLIC_BUILD_ID']);
function read(args){return JSON.parse(execFileSync(process.execPath,[cli,...args,'--json'],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024}));}
for(const [label,name] of [['production','eskahade'],['sandbox','eskahade-sandbox']]){
  const deployments=read(['deployments','list','--name',name]);
  const ordered=[...deployments].sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));
  const latest=ordered[0];if(!latest?.versions?.length)throw Error('No deployment metadata');
  const versions=latest.versions.map(v=>read(['versions','view',v.version_id,'--name',name]));
  const binding=b=>{const r={name:b.name,type:b.type};for(const key of ['id','namespace_id','bucket_name','service','environment'])if(b[key]!==undefined)r[key]=b[key];if(b.type==='plain_text'&&publicFlags.has(b.name))r.value=b.text;return r;};
  const result={observedAt:new Date().toISOString(),worker:name,selection:'Newest deployment by created_on, never array position',deployment:{id:latest.id,createdOn:latest.created_on,versions:latest.versions},versions:versions.map(v=>({id:v.id,createdOn:v.metadata?.created_on,annotations:Object.fromEntries(Object.entries(v.annotations||{}).filter(([k])=>['workers/message','workers/tag','workers/triggered_by'].includes(k))),bindings:(v.resources?.bindings||[]).map(binding),scriptEtag:v.resources?.script?.etag})),gitRevisionMapping:'UNVERIFIED unless a deployed immutable Git annotation is present'};
  fs.writeFileSync(path.join(out,label+'-deployed-current.json'),JSON.stringify(result,null,2));console.log(label+' deployment '+latest.id+' at '+latest.created_on);
}
