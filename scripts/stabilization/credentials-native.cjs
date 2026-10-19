/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local workerd security regression. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
  const h=require('../finance-remediation-fixture.cjs').harness();
  const {Miniflare}=await import('miniflare');
  const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("SYNTHETIC_ONLY")}}',compatibilityDate:'2025-04-01',d1Databases:['TEST_DB']});
  const results=[];
  try{
    const target=await mf.getD1Database('TEST_DB');
    const objects=h.db.prepare("SELECT type,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all();
    for(const kind of ['table','index','view','trigger'])for(const o of objects.filter(o=>o.type===kind))await target.prepare(o.sql).run();
    await target.prepare("INSERT INTO users(id,full_name,role,roles) VALUES('admin','Synthetic','admin','[\"admin\"]')").run();
    await target.prepare("INSERT INTO santri(id,nis,nama_lengkap,asrama,status_global,kategori_santri) VALUES('student','99001','Synthetic','AL-FALAH','aktif','REGULER')").run();
    require('./core-d1-adapter.cjs').attach(h,target);
    const pins=h.load('lib/finance/pins.ts'),cards=h.load('lib/finance/cards.ts');
    async function test(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
    await test('native D1 parallel wrong PIN attempts stop at threshold with one LOCK audit',async()=>{
      await pins.setStudentPin('student','123456','admin');await Promise.all(Array.from({length:10},()=>pins.verifyStudentPin('student','999999')));
      assert.equal((await target.prepare('SELECT failed_attempts n FROM finance_student_pins').first()).n,3);
      assert.equal((await target.prepare("SELECT COUNT(*) n FROM finance_pin_audit_logs WHERE action='LOCK'").first()).n,1);
    });
    await test('native D1 PIN reset expires authorizations atomically',async()=>{
      await pins.resetStudentPin('student','123456','admin');assert.equal((await pins.verifyStudentPin('student','123456',{authorization:{tokenHash:'synthetic-hash',operatorId:'admin',expiresAt:new Date(Date.now()+300000).toISOString()}})).verified,true);
      await pins.resetStudentPin('student','654321','admin');assert.equal((await target.prepare("SELECT COUNT(*) n FROM finance_pin_authorizations WHERE julianday(expires_at)>julianday('now')").first()).n,0);
    });
    await test('native D1 card replacement abort preserves active card',async()=>{
      const card=await cards.issueCard('student','admin'),original=h.adapter.batch;
      h.adapter.batch=async statements=>target.batch(statements.map((s,i)=>i===1?target.prepare("SELECT json('synthetic_abort')"):target.prepare(s.sql).bind(...s.params)));
      try{await assert.rejects(()=>cards.issueCard('student','admin'));assert.equal((await cards.getActiveCard('student')).id,card.id);}finally{h.adapter.batch=original;}
    });
    await test('native D1 audit failure rolls back failed PIN counter',async()=>{
      await pins.resetStudentPin('student','123456','admin');const original=h.adapter.batch;
      h.adapter.batch=async statements=>target.batch(statements.map((s,i)=>i===1?target.prepare("SELECT json('synthetic_abort')"):target.prepare(s.sql).bind(...s.params)));
      try{await assert.rejects(()=>pins.verifyStudentPin('student','999999'));assert.equal((await target.prepare('SELECT failed_attempts n FROM finance_student_pins').first()).n,0);}finally{h.adapter.batch=original;}
    });
    assert.equal((await target.prepare('PRAGMA foreign_key_check').all()).results.length,0);
    fs.writeFileSync(path.resolve(__dirname,'../../output/stabilization-20261019/credentials-native.json'),JSON.stringify({engine:'LOCAL workerd/D1 native batch, actual credential service functions',syntheticOnly:true,passed:results.length,failed:0,results},null,2));
  }finally{h.db.close();await mf.dispose();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
