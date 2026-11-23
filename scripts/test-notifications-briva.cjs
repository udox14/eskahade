// NOTIF-4: authenticated BRIVA payment callbacks write the parent notice inside the same atomic
// batch, exactly once, and never for review-only / conflicting / rejected callbacks.
// Reuses the synthetic signed-callback setup of test-finance-bri-callback-evidence.cjs.
const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto')
const { harness } = require('./finance-remediation-fixture.cjs'), h = harness()
const service = h.load('lib/finance/bri/briva-service.ts'), sign = h.load('lib/finance/bri/crypto.ts').generateBriInboundNotificationSignature
const fe = h.load('lib/notifications/finance-events.ts')
const RealDate = Date; let clock = RealDate.parse('2026-10-18T03:05:00Z')
global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [clock])) } static now() { return clock } }
Object.assign(process.env, { NODE_ENV: 'test', BRI_ENV: 'sandbox', BRI_BRIVA_INBOUND_ENABLED: 'true', BRI_PARTNER_SERVICE_ID: '77777', BRI_REQUIRE_PRIOR_INQUIRY_FOR_PAYMENT: 'true' })
const config = { env: 'sandbox', partnerId: 'synthetic-partner', clientSecret: crypto.randomBytes(32).toString('hex'), channelId: '00009', outboundEnabled: false }
const identity = { partnerServiceId: '   77777', customerNo: '0000000000001', virtualAccountNo: '   777770000000000001' }
const payload = (extra = {}) => ({ ...identity, virtualAccountName: 'Synthetic Student', paymentRequestId: 'SYNTHETIC-REVIEW-001', trxId: '2132902068917559061', paidAmount: { value: '12000.00', currency: 'IDR' }, ...extra })
function signed(body, kind = 'payment') {
  const rawBody = JSON.stringify(body), endpointPath = '/snap/v2.0/transfer-va/' + kind, timestamp = new Date().toISOString()
  return { rawBody, endpointPath, method: 'POST', configOverride: config, headers: { timestamp, partnerId: config.partnerId, channelId: '00009', externalId: '123456789', contentType: 'application/json', authorization: 'Bearer synthetic-token',
    signature: sign({ method: 'POST', endpointPath, accessToken: 'synthetic-token', body: rawBody, timestamp, clientSecret: config.clientSecret }) } }
}
const pay = body => service.handleBrivaPayment(signed(body))
const notices = () => h.db.prepare('SELECT event_code, dedupe_key, payload_json FROM notif_outbox ORDER BY created_at').all().map(r => ({ ...r, payload: JSON.parse(r.payload_json) }))

function seed() {
  h.reset(); fe.resetNotificationSchemaCache(); clock = RealDate.parse('2026-10-18T03:05:00Z')
  h.db.exec(fs.readFileSync('migrations/0202_notifications.sql', 'utf8'))
  h.db.prepare("INSERT INTO finance_student_va(santri_id,va_number,customer_no,status) VALUES('student',?,?,'ACTIVE')").run(identity.virtualAccountNo.trim(), identity.customerNo)
}
async function payable(items = 'mixed') {
  seed()
  h.db.prepare("INSERT INTO finance_payment_orders(id,order_number,santri_id,payer_type,gross_amount,cooperative_admin_fee,total_charged,payment_method,fixed_va_number,status,created_at,expires_at) VALUES('order','SYNTHETIC-ORDER','student','PORTAL_ORTU',10000,2000,12000,'BRI_VA',?,'PENDING','2026-10-18T01:00:00Z','2026-10-18T03:00:00Z')").run(identity.virtualAccountNo.trim())
  if (items === 'mixed') h.db.exec("INSERT INTO finance_obligations(id,santri_id,item_type,period,academic_year_id,amount_expected) VALUES('ob','student','SPP','2026-10',2,7000); INSERT INTO finance_order_items(id,order_id,obligation_id,item_type,amount) VALUES('ob-item','order','ob','SPP',7000),('wallet-item','order',NULL,'UANG_JAJAN',3000)")
  else h.db.exec("INSERT INTO finance_order_items(id,order_id,obligation_id,item_type,amount) VALUES('wallet-item','order',NULL,'UANG_JAJAN',10000)")
  clock = RealDate.parse('2026-10-18T02:30:00Z')
  assert.equal((await service.handleBrivaInquiry(signed({ ...identity, inquiryRequestId: 'SYNTHETIC-REVIEW-001' }, 'inquiry'))).status, 200)
  clock = RealDate.parse('2026-10-18T03:05:00Z')
}
let count = 0
async function test(name, fn) { await fn(); count++; console.log('PASS ' + name) }

async function main() {
  await test('paid callback (bill + uang jajan) → one "Pembayaran Diterima" with the bank-paid amount', async () => {
    await payable('mixed')
    assert.equal((await pay(payload({ trxDateTime: '2026-10-18T02:59:00Z' }))).status, 200)
    const rows = notices()
    assert.equal(rows.length, 1)
    const payment = h.db.prepare('SELECT id FROM finance_payments').get()
    assert.equal(rows[0].event_code, 'PORTAL_PEMBAYARAN_DITERIMA')
    assert.equal(rows[0].dedupe_key, `PAY:${payment.id}`)
    assert.deepEqual({ nominal: rows[0].payload.nominal, metode: rows[0].payload.metode, santri: rows[0].payload.santri_id }, { nominal: 12000, metode: 'BRIVA', santri: 'student' })
    assert.equal(rows[0].payload.waktu, '2026-10-18T02:59:00.000Z', 'authenticated bank time')
  })

  await test('wallet-only top-up → "Uang Jajan Masuk" with the amount that reached the wallet (not the admin fee)', async () => {
    await payable('wallet')
    assert.equal((await pay(payload({ trxDateTime: '2026-10-18T02:59:00Z' }))).status, 200)
    const [row] = notices()
    assert.equal(row.event_code, 'PORTAL_UANG_JAJAN_MASUK')
    assert.deepEqual({ nominal: row.payload.nominal, saldo: row.payload.saldo }, { nominal: 10000, saldo: 10000 })
    assert.equal(h.db.prepare('SELECT SUM(amount) n FROM finance_wallet_ledger').get().n, 10000)
  })

  await test('concurrent duplicate callbacks post once and notify once', async () => {
    await payable('mixed')
    const body = payload({ trxDateTime: '2026-10-18T02:59:00Z' })
    const r = await Promise.all([pay(body), pay(body), pay(body)])
    assert(r.every(x => x.status === 200))
    assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_payments').get().n, 1)
    assert.equal(notices().length, 1)
  })

  await test('review-only, conflicting and badly-signed callbacks never notify the parent', async () => {
    seed()
    assert.equal((await pay(payload())).status, 404)                                    // no order → review evidence only
    await payable('mixed')
    await pay(payload())
    await pay(payload({ paidAmount: { value: '13000.00', currency: 'IDR' } }))
    assert.equal((await pay(payload({ trxDateTime: '2026-10-18T02:59:00Z' }))).status, 409) // conflicting amounts block posting
    const bad = signed(payload({ trxDateTime: '2026-10-18T02:59:00Z', paymentRequestId: 'OTHER' })); bad.headers.signature = 'x'.repeat(88)
    assert.equal((await service.handleBrivaPayment(bad)).status, 401)
    assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_payments').get().n, 0)
    assert.equal(notices().length, 0)
  })

  await test('conflict arriving after precheck rolls back payment AND notice together', async () => {
    await payable('mixed')
    const original = h.adapter.batch; let injected = false
    h.adapter.batch = async statements => {
      if (!injected && statements.some(s => /INSERT INTO finance_payments\s*\(/.test(s.sql))) { injected = true; await pay(payload({ paidAmount: { value: '13000.00', currency: 'IDR' } })) }
      return original(statements)
    }
    try { assert.equal((await pay(payload({ trxDateTime: '2026-10-18T02:59:00Z' }))).status, 409) } finally { h.adapter.batch = original }
    assert.equal(h.db.prepare('SELECT COUNT(*) n FROM finance_payments').get().n, 0)
    assert.equal(notices().length, 0)
  })

  global.Date = RealDate
  console.log(`\n${count} BRIVA notification tests passed`)
}
main().catch(e => { global.Date = RealDate; console.error(e); process.exitCode = 1 })
