/* eslint-disable @typescript-eslint/no-require-imports -- Deterministic local transform of exact active Worker; no network/deployment. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'../../..'),evidence=path.join(root,'output/autonomous-delivery-20261020'),out=path.resolve(process.env.ESKAHADE_HOTFIX_OUTPUT_DIR||path.join(evidence,'production-hotfix'));
const packaged=process.env.ESKAHADE_HOTFIX_BASELINE_DIR;
const privateDir=packaged||fs.readFileSync(path.join(root,'output/detachment-private-evidence-path.txt'),'utf8').trim();
const baseline=fs.readFileSync(path.join(privateDir,packaged?'baseline-worker.js':'modules/000.txt'),'utf8');
const prior=packaged?JSON.parse(fs.readFileSync(path.join(privateDir,'manifest.json'))):null;
const headers=packaged?{etag:prior.baselineScriptEtag}:JSON.parse(fs.readFileSync(path.join(privateDir,'production-content-headers.json'))),version=packaged?{id:prior.baselineVersion,resources:{script:{etag:prior.baselineScriptEtag}}}:JSON.parse(fs.readFileSync(path.join(privateDir,'eskahade-version-f6c8d3d7-0aa6-46b7-b51a-9c5978a4171d.json')));
assert.equal(headers.etag.replaceAll('"',''),version.resources.script.etag);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),edits=[],counts={};
function replace(pattern,fn,label,expected){let n=0;source=source.replace(pattern,(...args)=>{n++;return fn(...args);});counts[label]=n;if(expected!==undefined)assert.equal(n,expected,label);else assert.ok(n>0,label);}
let source=baseline;
// Every duplicated compiled auth module, including server actions, uses its own AST.
const modules=require('./auth-modules.cjs').authModules(baseline);assert.equal(modules.length,6);
for(const authCopy of modules.toReversed()){
 let body=authCopy.body;
 const prefix='function moduleBody(){',parsed=ts.createSourceFile('auth.js',prefix+body+'}',ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),node=parsed.statements[0],changes=[];
 for(const stmt of node.body.statements){if(!ts.isFunctionDeclaration(stmt)||!stmt.body)continue;const text=stmt.getText(parsed);let next=text;
  if(text.includes('ALTER TABLE users ADD COLUMN structural_jabatan'))next=text.slice(0,text.indexOf('{')+1)+' return; }';
  if(text.includes('hydrateSessionFromDb ERROR')){
   next=next.replace(/if \(!([\w]+)\) return null;/,'if (!__eskIsolationRow($1)) return null;');
   next=next.replace(/return console\.error\([\s\S]*?\), \{[\s\S]*?\};\s*\}/,'/* __ESK_HYDRATION_FAIL_CLOSED__ */ return null; }');
   const param=stmt.parameters[0].name.getText(parsed);next=next.replaceAll('|| '+param+'.role','|| ""');
  }
  if(text.includes('crypto.subtle.sign')){const name=stmt.parameters[0].name.getText(parsed);next=next.slice(0,next.indexOf('{')+1)+` ${name}=__eskIsolationMint(${name});`+next.slice(next.indexOf('{')+1);}
  if(text.includes('crypto.subtle.verify'))next=next.replace(/return (\w+)\.exp && ([^;]+) \? null : \1;/,'return __eskIsolationClaims($1) ? ($1.exp && $2 ? null : $1) : null;');
  if(next!==text)changes.push({start:stmt.getStart(parsed)-prefix.length,end:stmt.end-prefix.length,text:next});
 }
 assert.equal(changes.length,4,'Expected schema/hydration/mint/verifier functions');
 for(const c of changes.sort((a,b)=>b.start-a.start))body=body.slice(0,c.start)+c.text+body.slice(c.end);
 source=source.slice(0,authCopy.start)+body+source.slice(authCopy.end);
}
counts.authModuleCopies=modules.length;
replace(/return await (\w+)\(\) \? (\w+)\.DEMO_DB : /g,(_all,fn,env)=>`if (!${env}.DB || 'DEMO_DB' in ${env}) throw Error('Konfigurasi database tidak tersedia.'); if (await ${fn}()) throw Error('Sesi demo tidak diizinkan.'); return `,'databaseSelectors',14);
replace(/await \(0, \w+\.queryOne\)\("SELECT id, email, password_hash[^\n]+?WHERE email = \?", \[[^\]]+\]\)/g,all=>'__eskIsolationRow('+all+')','primaryLoginLookups',2);
replace(/async function A\(e2\) \{\s*try \{\s*let \{ env: t2 \}[\s\S]*?__name\(A, "A"\);/g,()=> 'async function A(e2) { return null; }\n        __name(A, "A");','retiredDemoLoginHelper',1);
const policy=fs.readFileSync(path.join(__dirname,'hotfix-policy.mjs'),'utf8');
assert.equal((source.match(/worker_default as default/g)||[]).length,1);
source=policy+'\n'+source.replace('worker_default as default','__eskIsolatedWorker as default').replace(/\nexport \{\n  BucketCachePurge,/,'\nconst __eskIsolatedWorker = { ...worker_default, fetch(request,env,ctx) { return __eskIsolationFetch(request,env,ctx,(next)=>worker_default.fetch(next,env,ctx)); } };\nexport {\n  BucketCachePurge,');
assert.equal((source.match(/return await \w+\(\) \? \w+\.DEMO_DB/g)||[]).length,0);
assert.equal((source.match(/hydrateSessionFromDb ERROR/g)||[]).length,0,'No fail-open auth copy may remain');
// Only the retired reset handler and unreachable compatibility helper may still name DEMO_DB.
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'worker.js'),source);fs.writeFileSync(path.join(out,'baseline-worker.js'),baseline);
const settings=JSON.parse(fs.readFileSync(path.join(privateDir,packaged?'baseline-settings.json':'eskahade-settings-before.json'))),metadata={...settings,main_module:'worker.js',keep_assets:true,keep_bindings:['secret_text'],bindings:settings.bindings.filter(b=>b.name!=='DEMO_DB'&&b.type!=='secret_text')};
assert.ok(settings.bindings.every(b=>b.type!=='secret_text'||(!b.text&&!b.value)),'Secret values may never be saved');
assert.ok(settings.bindings.filter(b=>b.type==='plain_text').every(b=>b.name==='CLOUDFLARE_ACCOUNT_ID'||/^(BRI_|ESKAHADE_ENV)/.test(b.name)),'Unknown plain-text binding requires private review');
fs.writeFileSync(path.join(out,'baseline-settings.json'),JSON.stringify(settings,null,2));
delete metadata.tags; // REST settings tags are recorded separately; preserve them explicitly below.
metadata.tags=settings.tags;
fs.writeFileSync(path.join(out,'upload-metadata.json'),JSON.stringify(metadata,null,2));
const manifest={baselineVersion:version.id,baselineDeployment:'f7369162-f3cb-4110-bd3f-793aee51e4bc',baselineScriptEtag:version.resources.script.etag,baselineSha256:sha(baseline),hotfixSha256:sha(source),policySha256:sha(policy),counts,fullUnreleasedApplicationIncluded:false,productionMigrationRequired:false,oneTimeRelogin:true,assetStrategy:'keep_assets:true; no asset upload; exact existing ASSETS binding retained',secretStrategy:'keep_bindings:[secret_text]; no secret values',remoteActions:0,gitSourceMapping:'UNVERIFIED; exact deployed compiled artifact is the authoritative hotfix source'};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
