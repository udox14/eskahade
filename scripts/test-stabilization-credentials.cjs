/* eslint-disable @typescript-eslint/no-require-imports -- Standalone migration-derived SQLite regression harness. */
const assert = require('node:assert/strict');
const h = require('./finance-remediation-fixture.cjs').harness();
const pins = h.load('lib/finance/pins.ts'), cards = h.load('lib/finance/cards.ts');
let count = 0;
async function test(name, run) { h.reset(); await run(); console.log('PASS ' + name); count++; }
const read = () => h.db.prepare("SELECT * FROM finance_student_pins WHERE santri_id='student'").get();
const audits = () => h.db.prepare('SELECT COUNT(*) n FROM finance_pin_audit_logs').get().n;
const auth = () => ({ tokenHash: crypto.randomUUID(), operatorId: 'admin', expiresAt: new Date(Date.now()+300000).toISOString() });
async function main() {
  await test('card replacement failure preserves original active card and full history', async () => {
    const original = await cards.issueCard('student', 'admin');
    for (const index of [0,1]) { h.fault(index); await assert.rejects(() => cards.issueCard('student','admin'), /INJECTED/); assert.equal((await cards.getActiveCard('student')).id, original.id); assert.equal((await cards.getCardHistory('student')).length,1); }
    h.fault(-1); await cards.issueCard('student','admin'); assert.equal((await cards.getCardHistory('student')).length,2);
  });
  await test('initial PIN hash and audit roll back together', async () => { for (const index of [0,1]) { h.fault(index); await assert.rejects(() => pins.setStudentPin('student','123456','admin'), /INJECTED/); assert.equal(read(),undefined); assert.equal(audits(),0); } });
  await test('PIN reset, audit and authorization revocation are atomic at every statement', async () => {
    await pins.setStudentPin('student','123456','admin'); await pins.verifyStudentPin('student','123456',{authorization:auth()}); const before=read().pin_hash;
    for (const index of [0,1,2]) { h.fault(index); await assert.rejects(() => pins.resetStudentPin('student','654321','admin'), /INJECTED/); assert.equal(read().pin_hash,before); assert.equal(audits(),1); assert.ok(h.db.prepare('SELECT expires_at FROM finance_pin_authorizations').get().expires_at > new Date().toISOString()); }
    h.fault(-1); await pins.resetStudentPin('student','654321','admin'); assert.equal((await pins.verifyStudentPin('student','123456')).verified,false); assert.equal((await pins.verifyStudentPin('student','654321')).verified,true); assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_pin_authorizations WHERE julianday(expires_at)>julianday('now')").get().n,0);
  });
  await test('ten parallel wrong guesses lock after three durable attempts', async () => {
    await pins.setStudentPin('student','123456','admin'); await Promise.all(Array.from({length:10},()=>pins.verifyStudentPin('student','999999')));
    assert.equal(read().failed_attempts,3); assert.ok(read().locked_until); assert.equal(audits(),4); assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_pin_audit_logs WHERE action='LOCK'").get().n,1); assert.equal((await pins.verifyStudentPin('student','123456',{authorization:auth()})).verified,false); assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_pin_authorizations').get().n,0);
  });
  await test('failure while recording wrong attempt cannot partially increment counter', async () => { await pins.setStudentPin('student','123456','admin'); for (const i of [0,1,2]) { h.fault(i); await assert.rejects(()=>pins.verifyStudentPin('student','999999'), /INJECTED/); assert.equal(read().failed_attempts,0); assert.equal(audits(),1); } });
  await test('PIN verification and withdrawal authorization roll back together', async () => { await pins.setStudentPin('student','123456','admin'); for(const i of [0,1,2]) { h.fault(i); await assert.rejects(()=>pins.verifyStudentPin('student','123456',{authorization:auth()}), /INJECTED/); assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_pin_authorizations').get().n,0); } });
  await test('PIN rotation during asynchronous verification cannot issue stale authorization', async () => {
    await pins.setStudentPin('student','123456','admin'); const replacement=await h.load('lib/auth/password.ts').hashPassword('654321'); const original=h.adapter.batch;
    h.adapter.batch=async statements=>{ h.adapter.batch=original; h.db.prepare("UPDATE finance_student_pins SET pin_hash=? WHERE santri_id='student'").run(replacement); return original(statements); };
    try { assert.equal((await pins.verifyStudentPin('student','123456',{authorization:auth()})).verified,false); assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_pin_authorizations').get().n,0); } finally { h.adapter.batch=original; }
  });
  await test('student PIN change verifies old hash, rotates, audits and expires tokens in one batch', async () => { await pins.setStudentPin('student','123456','admin'); await pins.verifyStudentPin('student','123456',{authorization:auth()}); const result=await pins.verifyStudentPin('student','123456',{replacement:{pin:'654321',updatedBy:'admin',reason:'Synthetic request'}}); assert.equal(result.verified,true); assert.equal((await pins.verifyStudentPin('student','654321')).verified,true); assert.equal(audits(),2); assert.equal(h.db.prepare("SELECT COUNT(*) n FROM finance_pin_authorizations WHERE julianday(expires_at)>julianday('now')").get().n,0); });
  await test('unlock update cannot survive failed audit', async () => { await pins.setStudentPin('student','123456','admin'); await Promise.all(Array.from({length:3},()=>pins.verifyStudentPin('student','999999'))); const locked=read().locked_until; h.fault(1); await assert.rejects(()=>pins.unlockStudentPin('student','admin'),/INJECTED/); assert.equal(read().locked_until,locked); assert.equal(read().failed_attempts,3); });
  console.log('ALL ' + count + ' CREDENTIAL SECURITY CASES PASSED');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
