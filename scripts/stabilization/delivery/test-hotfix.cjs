/* eslint-disable @typescript-eslint/no-require-imports -- Execute actual transformed auth copies with synthetic rows and real HMAC. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'output/autonomous-delivery-20261020'),text=fs.readFileSync(path.join(out,'production-hotfix/worker.js'),'utf8');
const schema=JSON.parse(fs.readFileSync(path.join(root,'output/stabilization-20261019/production-schema-readonly.json'),'utf8').replace(/^\uFEFF/,''))[0].results;
const db=new DatabaseSync(':memory:');db.exec(schema.find(x=>x.type==='table'&&x.name==='users').sql);
const columns=db.prepare('PRAGMA table_info(users)').all().map(x=>x.name),needed=['email','full_name','avatar_url','role','roles','asrama_binaan','structural_jabatan','psb_verifikasi_akses','psb_asrama_akses','psb_bayar_akses','upk_panitia_akses'];for(const name of needed)assert.ok(columns.includes(name),'Actual historical production column missing '+name);
db.prepare("INSERT INTO users(id,email,password_hash,full_name,role,roles) VALUES('normal','admin@fixture.test','synthetic','Synthetic','admin','[\"admin\"]')").run();
const policy=fs.readFileSync(path.join(__dirname,'hotfix-policy.mjs'),'utf8'),results=[];
async function main(){
 const copies=require('./auth-modules.cjs').authModules(text);assert.equal(copies.length,6);
 for(const [copy,match]of copies.entries()){
  let cookie='',dbFailure=false,writes=0,exports={};
  const e={i(id){if([493458,905246].includes(id))return{cookies:async()=>({get:()=>cookie?{value:cookie}:undefined,set(){},delete(){}})};if([347540,800717].includes(id))return{cache:f=>f};if([512e3,812259].includes(id))return{queryOne:async(sql,args)=>{if(dbFailure)throw Error('Missing DB');return db.prepare(sql).get(...args);},execute:async()=>{writes++;throw Error('Unexpected auth write');}};throw Error('Unexpected import '+id);},s(array){for(let i=0;i<array.length;){const name=array[i++],kind=array[i++];exports[name]=kind===0?array[i++]:kind();}}};
  const ts=require('typescript'),parsed=ts.createSourceFile('auth.js','function mod(){'+match.body+'}',ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),functions=parsed.statements[0].body.statements.filter(ts.isFunctionDeclaration),mint=functions.find(f=>f.getText(parsed).includes('crypto.subtle.sign')).name.text,verify=functions.find(f=>f.getText(parsed).includes('crypto.subtle.verify')).name.text;
  const actual=vm.runInNewContext(policy+'\n'+match.body+`\n({mint:${mint},verify:${verify}})`,{[match.alias]:e,process:{env:{JWT_SECRET:'synthetic-key-only'}},crypto:crypto.webcrypto,TextEncoder,Uint8Array,atob,btoa,console:{error(){}},__name:x=>x,Response,Request,Headers,URL});
  exports.createJWTToken=actual.mint;exports.verifyJWTToken=actual.verify;
  const payload={id:'normal',email:'admin@fixture.test',full_name:'Synthetic',role:'admin',roles:['admin']};
  async function test(name,fn){await fn();results.push({copy,name,status:'PASS'});}
  const sign=value=>{const header=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),body=Buffer.from(JSON.stringify(value)).toString('base64url'),data=header+'.'+body;return data+'.'+crypto.createHmac('sha256','synthetic-key-only').update(data).digest('base64url');};
  await test('normal production session minted and hydrated',async()=>{cookie=await exports.createJWTToken(payload);assert.equal((await exports.getSession()).role,'admin');assert.equal((await exports.verifyJWTToken(cookie)).environment,'production');});
  await test('missing DB fails closed without auth DDL',async()=>{dbFailure=true;assert.equal(await exports.getSession(),null);dbFailure=false;assert.equal(writes,0);});
  await test('signed demo and mixed demo sessions denied',async()=>{for(const value of [{...payload,role:'demo',roles:['demo'],environment:'production'},{...payload,roles:['admin','demo'],environment:'production'}]){cookie=sign(value);assert.equal(await exports.getSession(),null);await assert.rejects(()=>exports.createJWTToken(value));}});
  await test('legacy cross-environment and tampered sessions denied',async()=>{for(const value of [payload,{...payload,environment:'sandbox'}]){cookie=sign(value);assert.equal(await exports.getSession(),null);}cookie=sign({...payload,environment:'production'})+'x';assert.equal(await exports.getSession(),null);});
  await test('current stored role revokes old admin authority',async()=>{cookie=await exports.createJWTToken(payload);db.prepare("UPDATE users SET role='guru',roles='[\"guru\"]' WHERE id='normal'").run();assert.equal((await exports.getSession()).role,'guru');db.prepare("UPDATE users SET role='',roles='[]' WHERE id='normal'").run();assert.equal(await exports.getSession(),null);db.prepare("UPDATE users SET role='admin',roles='[\"admin\"]' WHERE id='normal'").run();});
  await test('stored demo assignment denies a formerly normal token',async()=>{cookie=await exports.createJWTToken(payload);db.prepare("UPDATE users SET role='demo',roles='[\"demo\"]' WHERE id='normal'").run();assert.equal(await exports.getSession(),null);db.prepare("UPDATE users SET role='admin',roles='[\"admin\"]' WHERE id='normal'").run();});
  await test('parent token preserves kind and binds production realm',async()=>{const token=await exports.createJWTToken({kind:'portal_ortu',santri_id:'synthetic-student',nis:'99001'});const value=await exports.verifyJWTToken(token);assert.equal(value.kind,'portal_ortu');assert.equal(value.environment,'production');});
 }
 const policyExports=vm.runInNewContext(policy+'\n({fetch:__eskIsolationFetch,row:__eskIsolationRow})',{atob,Response,Request,Headers,URL});
 let calls=0;const delegate=async()=>{calls++;return new Response('NORMAL');};
 for(const env of [{},{DB:{},DEMO_DB:{}}])assert.equal((await policyExports.fetch(new Request('https://synthetic.invalid/dashboard'),env,{},delegate)).status,503);
 for(const method of ['GET','POST'])for(const route of ['/api/demo/reset','/api/migrate','/api/update-db'])assert.equal((await policyExports.fetch(new Request('https://synthetic.invalid'+route,{method}),{DB:{}},{},delegate)).status,410);
 assert.equal(calls,0);assert.equal((await policyExports.fetch(new Request('https://synthetic.invalid/login'),{DB:{}},{},delegate)).status,200);
 results.push({name:'missing/cross bindings and retired mutators rejected before delegation; normal login delegates',status:'PASS'});
 const report={passed:results.length,failed:0,results,productionSchemaSnapshot:'Historical actual DDL, no 0187–0190 applied; latest read denied 7403 so live compatibility remains operator gate',requiredUserColumns:needed,allColumnsPresent:true,remoteMutations:0};fs.writeFileSync(path.join(out,'hotfix-tests.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:0,compiledCopies:6}));db.close();
}
main().catch(e=>{console.error(e);process.exitCode=1;});

