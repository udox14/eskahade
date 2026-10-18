import {timingSafeEqual} from 'node:crypto';
import {runSuite} from './suite.mjs';
const marker='ESKAHADE_SYNTHETIC_ONLY_66449217_FIN_GATE';
export default{async fetch(request,env){
 const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 const expected=env.TEST_AUTH_TOKEN,actual=request.headers.get('Authorization')||'';
 if(typeof expected!=='string'||expected.length<32)return response({error:'Test token not configured'},503);
 const a=Buffer.from(actual),b=Buffer.from('Bearer '+expected);
 if(a.length!==b.length||!timingSafeEqual(a,b))return response({error:'Unauthorized'},401);
 const url=new URL(request.url);if(!['/run','/status'].includes(url.pathname))return response({error:'Not found'},404);
 try{
  const identity=await env.TEST_DB.prepare("SELECT marker FROM finance_behavior_control WHERE id='identity'").first();
  if(identity?.marker!==marker)return response({error:'Synthetic dataset marker missing'},403);
  const existing=await env.TEST_DB.prepare("SELECT status,result_json FROM finance_behavior_runs WHERE id='single-approved-run'").first();
  if(url.pathname==='/status')return response(existing?.result_json?JSON.parse(existing.result_json):{status:existing?.status||'NOT_STARTED'});
  if(request.method!=='POST')return response({error:'Method not allowed'},405);
  if(existing)return response(existing.result_json?JSON.parse(existing.result_json):{status:'RUNNING'},existing.result_json?200:409);
  // Unique claim serializes concurrent invocations; no reset/delete API exists.
  await env.TEST_DB.prepare("INSERT INTO finance_behavior_runs(id,status) VALUES('single-approved-run','RUNNING')").run();
  const result=await runSuite(env.TEST_DB);
  await env.TEST_DB.prepare("UPDATE finance_behavior_runs SET status=?,result_json=? WHERE id='single-approved-run'").bind(result.failed?'FAILED':'PASSED',JSON.stringify(result)).run();
  return response(result,result.failed?500:200);
 }catch{return response({error:'Isolated test failed; inspect synthetic database only'},500)}
}};
