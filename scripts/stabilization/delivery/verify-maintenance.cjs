/* eslint-disable @typescript-eslint/no-require-imports -- Concurrent synthetic calls, no bindings or remote access. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const worker=(await import('../isolation/sandbox-maintenance.mjs')).default,methods=['GET','POST','PUT','PATCH','DELETE','HEAD'];let reads=0;
 const env=new Proxy({},{get(){reads++;throw Error('No binding access allowed');}});
 const results=await Promise.all(Array.from({length:60},async(_,i)=>{const method=methods[i%methods.length],response=await worker.fetch(new Request('https://synthetic.invalid/dashboard',{method}),env,{});assert.equal(response.status,503);assert.match(response.headers.get('cache-control'),/no-store/);return{method,status:'PASS'};}));assert.equal(reads,0);
 const out=path.resolve(__dirname,'../../../output/autonomous-delivery-20261020');fs.writeFileSync(path.join(out,'maintenance-concurrency.json'),JSON.stringify({passed:60,failed:0,bindingReads:reads,results,remoteMutations:0},null,2));console.log('PASS 60 concurrent no-D1 maintenance calls');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
