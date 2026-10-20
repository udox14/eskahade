/* eslint-disable @typescript-eslint/no-require-imports -- Read-only production detachment evidence; no mutation operation exists. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'), out=process.argv[2];
const account='a170ed4144c00927988a828aa9a41896';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(!out||!path.isAbsolute(out)||!fs.statSync(out).isDirectory())throw Error('PRIVATE_EVIDENCE_DIRECTORY_REQUIRED');
const save=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2));
async function main(){
 const auth=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','auth','token','--json'],{cwd:root,encoding:'utf8',timeout:30000,env:{...process.env,CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false',WRANGLER_SEND_METRICS:'false'}});
 if(auth.status!==0)throw Error('STOP_AUTH_UNAVAILABLE');
 const credentials=JSON.parse(auth.stdout);if(!credentials.token)throw Error('STOP_AUTH_FORMAT');
 const requests=[];
 async function get(suffix,binary=false){
  if(!/^\/(?:accounts(?:\?[^#]*)?|accounts\/[a-f0-9]{32}(?:\/(?:workers\/(?:scripts\/(?:eskahade|eskahade-sandbox)(?:\/(?:settings|deployments|versions(?:\/[a-f0-9-]{36})?|subdomain|secrets|schedules|content\/v2))?|domains|subdomain)|d1\/database\/[a-f0-9-]{36}))?)$/.test(suffix))throw Error('STOP_NON_ALLOWLISTED_GET');
  const response=await fetch('https://api.cloudflare.com/client/v4'+suffix,{method:'GET',headers:{Authorization:'Bearer '+credentials.token},signal:AbortSignal.timeout(60000)});
  requests.push({method:'GET',path:suffix,status:response.status});
  if(!response.ok)throw Error('STOP_GET_'+response.status+'_'+suffix);
  if(binary)return response;
  const body=await response.json();if(!body.success)throw Error('STOP_API_FAILURE');return body.result;
 }
 const accountInfo=await get('/accounts/'+account); if(accountInfo.id!==account)throw Error('STOP_ACCOUNT_ID');save('account.json',{id:accountInfo.id,name:accountInfo.name});
 const databases={};for(const [name,id]of Object.entries({'eskahade-db':'a2010f08-f314-46af-88fd-dbb9b4ef1bb1','eskahade-demo-db':'677f05ba-9b52-4534-9542-96cc785f25e4'})){const d=await get('/accounts/'+account+'/d1/database/'+id);if(d.uuid!==id||d.name!==name)throw Error('STOP_DB_IDENTITY');databases[name]={id:d.uuid,name:d.name};}save('databases.json',databases);
 const workers={};
 for(const worker of ['eskahade','eskahade-sandbox']){
  const prefix='/accounts/'+account+'/workers/scripts/'+worker;
  const settings=await get(prefix+'/settings'), deployments=await get(prefix+'/deployments'), subdomain=await get(prefix+'/subdomain'), secrets=await get(prefix+'/secrets'), schedules=await get(prefix+'/schedules');
  save(worker+'-settings-before.json',settings);save(worker+'-deployments-before.json',deployments);save(worker+'-subdomain-before.json',subdomain);save(worker+'-secrets-before.json',secrets);save(worker+'-schedules-before.json',schedules);
  const list=deployments.deployments||deployments; if(!Array.isArray(list))throw Error('STOP_DEPLOYMENTS_SHAPE');
  const active=[...list].sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];if(!active?.versions?.length)throw Error('STOP_NO_ACTIVE_VERSION');
  const versions=[];for(const v of active.versions){const content=await get(prefix+'/versions/'+v.version_id);save(worker+'-version-'+v.version_id+'.json',content);versions.push(content);}
  const bindingSummary=(settings.bindings||[]).map(b=>{const safe={name:b.name,type:b.type};for(const k of ['id','namespace_id','bucket_name','service','environment'])if(b[k]!==undefined)safe[k]=b[k];if(b.type==='plain_text'&&/^(BRI_|ESKAHADE_ENV)/.test(b.name))safe.value=b.text;return safe;});
  workers[worker]={active,subdomain,bindings:bindingSummary,versions:versions.map(v=>({id:v.id,script:v.resources?.script})),secrets:(secrets||[]).map(s=>({name:s.name,type:s.type}))};
 }
 save('domains-before.json',await get('/accounts/'+account+'/workers/domains'));
 save('workers-subdomain.json',await get('/accounts/'+account+'/workers/subdomain'));
 const content=await get('/accounts/'+account+'/workers/scripts/eskahade/content/v2',true);
 const bytes=Buffer.from(await content.arrayBuffer());if(bytes.length>100*1024*1024)throw Error('STOP_BUNDLE_SIZE');
 fs.writeFileSync(path.join(out,'production-content.multipart'),bytes);save('production-content-headers.json',{contentType:content.headers.get('content-type'),etag:content.headers.get('etag'),sha256:sha(bytes),size:bytes.length});
 if(content.headers.get('content-type')?.includes('multipart/')){
  const form=await new Response(bytes,{headers:{'content-type':content.headers.get('content-type')}}).formData();const modules=[];
  fs.mkdirSync(path.join(out,'modules'),{recursive:true});let i=0;
  for(const [name,value]of form.entries()){const data=typeof value==='string'?Buffer.from(value):Buffer.from(await value.arrayBuffer());const file=String(i++).padStart(3,'0')+'.txt';fs.writeFileSync(path.join(out,'modules',file),data);modules.push({part:name,originalFile:value.name||null,localFile:file,size:data.length,sha256:sha(data)});}save('modules.json',modules);
 }
 save('requests.json',requests);const summary={observedAt:new Date().toISOString(),account,databases,workers,content:{bytes:bytes.length,etag:content.headers.get('etag')},remoteMutations:0,evidenceDirectory:out};save('summary.json',summary);console.log(JSON.stringify(summary));
}
main().catch(e=>{console.error(/^STOP_|PRIVATE_/.test(e.message)?e.message:'STOP_READ_ONLY_PREFLIGHT_ERROR');process.exitCode=1;});
