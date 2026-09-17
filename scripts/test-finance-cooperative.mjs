import { DatabaseSync } from 'node:sqlite'
import { build } from 'esbuild'
import { readFileSync,mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import path from 'node:path'
const root=process.cwd();mkdirSync('tmp/finance-cooperative',{recursive:true})
const dbMock=`
export const getFinanceDB=async()=>globalThis.financeTestDb;
export const getDB=async()=>globalThis.financeTestMain;
export const generateId=()=>crypto.randomUUID();
export const financeQuery=async(sql,params=[])=> (await globalThis.financeTestDb.prepare(sql).bind(...params).all()).results;
export const financeQueryOne=async(sql,params=[])=>globalThis.financeTestDb.prepare(sql).bind(...params).first();
export const query=async(sql,params=[])=> (await globalThis.financeTestMain.prepare(sql).bind(...params).all()).results;
export const queryOne=async(sql,params=[])=>globalThis.financeTestMain.prepare(sql).bind(...params).first();
`
await build({stdin:{contents:`
export * from './lib/finance/cooperative/orders';
export * from './lib/finance/cooperative/billing';
export * from './lib/finance/cooperative/non-spp-billing';
export * from './lib/finance/cooperative/distributions';
export * from './lib/finance/cooperative/corrections';
export * from './lib/finance/cooperative/cash';
export * from './lib/finance/cooperative/screen';
export * from './lib/finance/cooperative/snap';
export * from './lib/finance/credentials';
export * from './lib/finance/withdrawal';
export * from './lib/finance/credential-batches';
export * from './lib/finance/demo-seed';
export * from './lib/finance/access';
export * from './app/dashboard/keuangan-terpusat/billing-actions';
`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'tmp/finance-cooperative/domain.mjs',plugins:[{name:'isolated-db',setup(b){
 b.onResolve({filter:/^@\/lib\/db$/},()=>({path:'db',namespace:'mock'}))
 b.onResolve({filter:/^@\/lib\/auth\/demo-context$/},()=>({path:'demo',namespace:'mock'}))
 b.onResolve({filter:/^@\/lib\/auth\/session$/},()=>({path:'session',namespace:'mock'}))
 b.onResolve({filter:/^next\/cache$/},()=>({path:'cache',namespace:'mock'}))
 b.onLoad({filter:/.*/,namespace:'mock'},({path:p})=>({contents:p==='db'?dbMock:p==='demo'?'export const isDemoRequest=async()=>true;':p==='cache'?'export const revalidatePath=()=>{}; export const revalidateTag=()=>{};':'export const getEffectiveRoles=s=>s.roles; export const getSession=async()=>globalThis.financeTestSession;',loader:'js'}))
}}]})
const api=await import(pathToFileURL(path.resolve('tmp/finance-cooperative/domain.mjs')))
function wrap(sqlite){
 const prepare=(sql,values=[])=>({sql,values,bind(...v){return prepare(sql,v)},async all(){return {success:true,results:sqlite.prepare(sql).all(...values)}},async first(){return sqlite.prepare(sql).get(...values)||null},async run(){const r=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(r.changes)},results:[]}}})
 return {prepare,async batch(stmts){sqlite.exec('BEGIN');try{const result=[];for(const s of stmts){const st=sqlite.prepare(s.sql);if(st.columns().length){result.push({success:true,results:st.all(...s.values)})}else{const r=st.run(...s.values);result.push({success:true,results:[],meta:{changes:Number(r.changes)}})}}sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}}
}
const finance=new DatabaseSync(':memory:'),main=new DatabaseSync(':memory:')
for(const suffix of ['b_tables_core','c_tables_billing','d_tables_loket','e_tables_payout','f_tables_support','g_triggers','h_seed'])finance.exec(readFileSync('migrations-finance/0001'+suffix+'.sql','utf8'))
for(const file of ['0003_payroll_per_sesi.sql','0004_cooperative_item_payments.sql'])finance.exec(readFileSync('migrations-finance/'+file,'utf8'))
finance.exec(readFileSync('migrations-finance/0006_central_billing_workspaces.sql','utf8'))
finance.exec(readFileSync('migrations-finance/0007_payment_work_units.sql','utf8'))
main.exec(`CREATE TABLE santri(id TEXT PRIMARY KEY,nis TEXT,nama_lengkap TEXT,asrama TEXT,kamar TEXT,foto_url TEXT,status_global TEXT,tempat_makan_id TEXT,tempat_mencuci_id TEXT,tahun_masuk INTEGER,tanggal_masuk TEXT,created_at TEXT);
CREATE TABLE master_jasa(id TEXT PRIMARY KEY,nama_jasa TEXT,jenis TEXT);
CREATE TABLE tahun_ajaran(id INTEGER PRIMARY KEY,nama TEXT,is_active INTEGER);
CREATE TABLE biaya_settings(id INTEGER PRIMARY KEY AUTOINCREMENT,tahun_ajaran_id INTEGER,tahun_angkatan INTEGER,jenis_biaya TEXT,nominal INTEGER);
CREATE TABLE pembayaran_tahunan(id TEXT PRIMARY KEY,santri_id TEXT,jenis_biaya TEXT,tahun_ajaran_id INTEGER,tahun_tagihan INTEGER,nominal_bayar INTEGER,status TEXT);
CREATE TABLE santri_pembebasan_biaya(id TEXT PRIMARY KEY,santri_id TEXT,service_kind TEXT,is_active INTEGER);
INSERT INTO master_jasa VALUES('m','Ibu Makan','Makan'),('l','Ibu Laundry','Cuci');
INSERT INTO tahun_ajaran VALUES(1,'2026/2027',1);
INSERT INTO santri VALUES('s1','1001','Santri Satu','A','1',NULL,'aktif','m','l',2025,'2025-07-01','2025-07-01'),('s2','1002','Santri Dua','A','2',NULL,'aktif','m','l',2025,'2025-07-01','2025-07-01'),('s3','1003','Warga Lokal','AL-BAGHORY','-',NULL,'aktif','m','l',2025,'2025-07-01','2025-07-01');`)
globalThis.financeTestDb=wrap(finance);globalThis.financeTestMain=wrap(main);globalThis.financeTestSession={id:'staff',roles:['admin_koperasi']}
process.env.FINANCE_ENCRYPTION_KEY='isolated-test-key';process.env.CREDENTIAL_HMAC_SECRET='isolated-hmac-key'
const row=sql=>finance.prepare(sql).get()
let checks=0
async function test(name,fn){await fn();checks++;console.log('PASS',name)}
let shift,bill,order,distribution
await test('mixed cash checkout: item + jajan, no titipan',async()=>{
 finance.exec("INSERT INTO finance_cash_units(id,name) VALUES('unit','Koperasi')")
 shift=await api.openShift('staff','unit',0)
 bill=await api.createBill({santriId:'s1',kind:'SPP',title:'SPP',amount:100000,period:'2026-09',actor:'staff'})
 order=await api.createOrder({key:'mixed',santriId:'s1',actorId:'staff',channel:'CASH',items:[{billId:bill,amount:100000}],jajan:50000,shiftId:shift})
 assert.equal(order.status,'PAID');assert.equal(row("SELECT balance_rupiah FROM finance_student_wallets WHERE wallet_kind='JAJAN'").balance_rupiah,50000)
 assert.equal(row("SELECT COUNT(*) n FROM finance_student_wallets WHERE wallet_kind<>'JAJAN'").n,0)
 assert.equal(row('SELECT SUM(amount) n FROM finance_entitlements').n,100000)
})
await test('same request replays; altered payload rejected',async()=>{
 const input={key:'mixed',santriId:'s1',actorId:'staff',channel:'CASH',items:[{billId:bill,amount:100000}],jajan:50000,shiftId:shift}
 assert.equal((await api.createOrder(input)).id,order.id)
 await assert.rejects(api.createOrder({...input,jajan:60000}))
})
await test('fixed VA receipt records one SNAP event and replays safely',async()=>{
 finance.exec(`UPDATE finance_settings SET value='{"paymentPolicy":"FULL","overrides":{},"transferFeeBearer":"KOPERASI","gatewayFee":0,"onlineEnabled":true}' WHERE key='cooperative_settings'`)
 finance.exec("INSERT INTO finance_student_va(santri_id,va_number,customer_no) VALUES('s2','9999991002','1002')")
 const vaOrder=await api.createOrder({key:'va-jajan',santriId:'s2',actorId:'guardian',channel:'VA',items:[],jajan:25000})
 assert.equal(vaOrder.status,'PENDING')
 await api.receiveOrder({orderId:vaOrder.id,reference:'SNAP-EVENT-1',actorId:'DUITKU_SNAP',amount:25000,vaNumber:'9999991002'})
 await api.receiveOrder({orderId:vaOrder.id,reference:'SNAP-EVENT-1',actorId:'DUITKU_SNAP',amount:25000,vaNumber:'9999991002'})
 assert.equal(row("SELECT COUNT(*) n FROM finance_snap_events WHERE event_key='SNAP-EVENT-1'").n,1)
 assert.equal(row("SELECT balance_rupiah FROM finance_student_wallets WHERE santri_id='s2' AND wallet_kind='JAJAN'").balance_rupiah,25000)
})
await test('payout reserves funds before physical transfer',async()=>{
 distribution=await api.createDistribution({key:'dist1',recipientId:'pesantren',amount:100000,fee:0,method:'CASH',actor:'staff'})
 await assert.rejects(api.createDistribution({key:'dist2',recipientId:'pesantren',amount:1,fee:0,method:'CASH',actor:'staff'}))
 assert.equal(row('SELECT paid FROM finance_entitlements').paid,0)
})
await test('finish manual cash payout and prevent double payment',async()=>{
 const input={id:distribution,reference:'KUITANSI-1',proof:'',receivedBy:'Bendahara',shiftId:shift,actor:'staff'}
 await api.finishDistribution(input);await assert.rejects(api.finishDistribution(input))
 assert.equal(row('SELECT paid FROM finance_entitlements').paid,100000)
 assert.equal(row('SELECT SUM(amount) n FROM finance_cash_entries').n,50000)
})
let credential
await test('QR replacement revokes predecessor atomically',async()=>{
 const a=await api.issueCredential({santriId:'s1',kind:'QR_STATIC',actorId:'staff'});assert.equal(a.success,true)
 const b=await api.issueCredential({santriId:'s1',kind:'QR_STATIC',actorId:'staff',reissue:true});assert.equal(b.success,true);credential=b.credentialId
 assert.equal(finance.prepare('SELECT status FROM student_credentials WHERE id=?').get(a.credentialId).status,'REVOKED')
 assert.equal(finance.prepare('SELECT replacement_credential_id id FROM student_credentials WHERE id=?').get(a.credentialId).id,b.credentialId)
})
await test('withdraw QR + PIN checks and atomic cash/wallet movement',async()=>{
 await api.setStudentPin('s1','123456')
 const token=await api.getPrintableQrToken(credential)
 const input={idempotencyKey:'withdraw1',credentialKind:'QR_STATIC',rawToken:token,pin:'123456',amountRupiah:10000,cashUnitId:'unit',shiftId:shift,operatorId:'staff',terminalId:'koperasi-staff',identityConfirmed:true}
 assert.equal((await api.withdrawPocketMoney({...input,pin:'999999'})).success,false)
 const result=await api.withdrawPocketMoney(input);assert.equal(result.success,true,JSON.stringify(result))
 assert.equal(row("SELECT balance_rupiah FROM finance_student_wallets WHERE wallet_kind='JAJAN'").balance_rupiah,40000)
 assert.equal(row('SELECT SUM(amount) n FROM finance_cash_entries').n,40000)
})
await test('cannot refund already distributed payment',async()=>{
 await assert.rejects(api.reverseReceipt({id:order.id,actor:'staff',reason:'Pengembalian salah pembayaran',reference:'R-1',shiftId:shift}))
})
await test('all screens load with scope; unit cannot see other recipients',async()=>{
 for(const view of ['home','bills','distributions','reports','settings','cashier']){const d=await api.loadScreen(view,globalThis.financeTestSession,{});assert.ok(d.title)}
 const d=await api.loadScreen('distributions',{id:'outsider',roles:['pengelola_makan']},{})
 assert.equal(d.total,0)
})
await test('monthly generator is independent and idempotent',async()=>{
 finance.exec("INSERT INTO finance_coop_tariffs(id,kind,title,amount,effective_month,created_by) VALUES('t','MAKAN','Makan',30000,'2026-01','staff')")
 const a=await api.generateMonthlyBills(globalThis.financeTestMain,globalThis.financeTestDb,'2026-09','staff'),b=await api.generateMonthlyBills(globalThis.financeTestMain,globalThis.financeTestDb,'2026-09','staff')
 assert.equal(a.created,2);assert.equal(b.created,0)
})
await test('monthly generator honors centralized exemptions',async()=>{
 finance.exec("INSERT INTO finance_bill_exemptions(id,santri_id,item_code,scope,reason,created_by) VALUES('ex-month','s2','MAKAN','PERMANENT','Kebijakan pengurus','staff')")
 const result=await api.generateMonthlyBills(globalThis.financeTestMain,globalThis.financeTestDb,'2026-10','staff')
 assert.equal(result.created,1);assert.equal(result.exempted,1)
})
await test('Non-SPP batch applies lifetime, annual, legacy and idempotency rules',async()=>{
 main.exec("INSERT INTO biaya_settings(tahun_ajaran_id,tahun_angkatan,jenis_biaya,nominal) VALUES(1,2025,'BANGUNAN',1000000),(1,2025,'KESEHATAN',200000),(1,2025,'EHB',100000),(1,2025,'EKSKUL',50000)")
 finance.exec("INSERT INTO finance_bill_exemptions(id,santri_id,item_code,scope,period_key,reason,created_by) VALUES('ex-ehb','s2','EHB','PERIOD','TA:1','Beasiswa tahunan','staff')")
 main.exec("INSERT INTO pembayaran_tahunan VALUES('legacy-free','s1','EKSKUL',1,2026,0,'AKTIF')")
 const preview=await api.previewNonSppBills(globalThis.financeTestMain,globalThis.financeTestDb,true)
 assert.equal(preview.eligibleStudents,2);assert.equal(preview.created,6);assert.equal(preview.skipped,2)
 const first=await api.generateNonSppBills(globalThis.financeTestMain,globalThis.financeTestDb,'staff',true)
 const second=await api.generateNonSppBills(globalThis.financeTestMain,globalThis.financeTestDb,'staff',true)
 assert.equal(first.created,6);assert.equal(second.created,0)
 assert.equal(row("SELECT COUNT(*) n FROM finance_coop_bills WHERE category_code='BANGUNAN'").n,2)
 assert.equal(row("SELECT COUNT(*) n FROM finance_coop_bills WHERE category_code IN ('KESEHATAN','EHB','EKSKUL')").n,4)
 assert.throws(()=>finance.exec("INSERT INTO finance_coop_bills(id,santri_id,kind,category_code,title,period_key,recipient_id,amount,created_by) VALUES('dup','s1','NON_SPP','BANGUNAN','Bangunan lagi','x','pesantren',1,'staff')"))
})
await test('recipient bulk save validates all rows, encrypts, masks, and preserves blank account',async()=>{
 const invalid=await api.saveRecipientAccounts([
  {id:'pesantren',method:'TRANSFER',bankCode:'014',bankName:'BCA',accountNumber:'1234567890',accountHolder:'Bendahara'},
  {id:'jasa-m',method:'TRANSFER',bankCode:'002',bankName:'BRI',accountNumber:'abc',accountHolder:'Ibu Makan'},
 ])
 assert.equal(invalid.success,false)
 assert.equal(row("SELECT method FROM finance_coop_recipients WHERE id='pesantren'").method,'CASH')
 const valid=await api.saveRecipientAccounts([
  {id:'pesantren',method:'TRANSFER',bankCode:'014',bankName:'BCA',accountNumber:'1234567890',accountHolder:'Bendahara'},
  {id:'jasa-m',method:'CASH',bankCode:'',bankName:'',accountNumber:'',accountHolder:''},
 ])
 assert.equal(valid.success,true)
 const saved=row("SELECT account_encrypted,account_mask FROM finance_coop_recipients WHERE id='pesantren'")
 assert.notEqual(saved.account_encrypted,'1234567890');assert.equal(saved.account_mask,'****7890')
 await api.saveRecipientAccounts([{id:'pesantren',method:'TRANSFER',bankCode:'014',bankName:'BCA',accountNumber:'',accountHolder:'Bendahara Baru'}])
 assert.equal(row("SELECT account_encrypted FROM finance_coop_recipients WHERE id='pesantren'").account_encrypted,saved.account_encrypted)
})
await test('exemption voids OPEN bill, revokes safely, and rejects PARTIAL bill',async()=>{
 const saved=await api.saveBillingExemption({santriId:'s1',itemCode:'KESEHATAN',scope:'PERIOD',periodKey:'TA:1',reason:'Beasiswa kesehatan'})
 assert.equal(saved.affectedBills,1)
 assert.equal(row("SELECT status FROM finance_coop_bills WHERE santri_id='s1' AND category_code='KESEHATAN'").status,'VOID')
 await api.revokeBillingExemptions([saved.ruleId],'Keputusan dibatalkan')
 assert.equal(row("SELECT status FROM finance_coop_bills WHERE santri_id='s1' AND category_code='KESEHATAN'").status,'OPEN')
 finance.exec("UPDATE finance_coop_bills SET paid=1,status='PARTIAL' WHERE santri_id='s1' AND category_code='BANGUNAN'")
 await assert.rejects(api.saveBillingExemption({santriId:'s1',itemCode:'BANGUNAN',scope:'PERMANENT',reason:'Pembebasan bangunan'}),/koreksi atau refund/)
})
await test('closed shift preserves expected cash including receipts',async()=>{
 await api.closeShift('staff',shift,40000,'Sesuai hitungan')
 assert.equal(row("SELECT status FROM finance_cash_shifts").status,'CLOSED_OK')
})
await test('full app admin and operational roles; reader cannot mutate',async()=>{
 globalThis.financeTestSession={id:'a',roles:['admin']};await api.requireFinanceAccess('CARDS');await api.requireFinanceAccess('CONFIGURE')
 globalThis.financeTestSession={id:'u',roles:['pengelola_makan']};await assert.rejects(api.requireFinanceAccess('CREATE'))
})
await test('demo reset is transactional and leaves only jajan wallets',async()=>{
 finance.exec(readFileSync('migrations-finance/0002_demo_sandbox_reset.sql','utf8'))
 finance.exec(readFileSync('migrations-finance/0005_demo_cooperative_reset.sql','utf8'))
 await api.resetDemoFinanceDatabase(globalThis.financeTestDb,[{id:'demo-user',fullName:'Demo',roles:['demo']}])
 assert.equal(row("SELECT COUNT(*) n FROM finance_student_wallets WHERE wallet_kind<>'JAJAN'").n,0)
 assert.equal(row('SELECT COUNT(*) n FROM finance_coop_bills').n,6)
 await api.resetDemoFinanceDatabase(globalThis.financeTestDb,[{id:'demo-user',fullName:'Demo',roles:['demo']}])
 assert.equal(row('SELECT reset_enabled FROM finance_sandbox_state').reset_enabled,0)
})
console.log('Passed',checks,'TypeScript service integration tests.')
