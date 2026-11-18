// Manual transfer channel + collective uang jajan payout against the real migrations (0198).
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { harness } = require('./finance-remediation-fixture.cjs')

const h = harness()
h.state.productionDB = {}
const objects = new Map()
h.state.bucket = {
  put: async (key, bytes, options) => { objects.set(key, { bytes, options }); return { key } },
  head: async key => objects.get(key) ? { customMetadata: objects.get(key).options.customMetadata, writeHttpMetadata() {} } : null,
  get: async key => objects.get(key) ? { body: null, customMetadata: objects.get(key).options.customMetadata, writeHttpMetadata() {} } : null,
}
const { createPaymentOrder } = h.load('lib/finance/orders.ts')
const mt = h.load('lib/finance/manual-transfer.ts')
const payout = h.load('lib/finance/wallet-payout.ts')
const { openCashSession } = h.load('lib/finance/cash-session.ts')
const { setCooperativeAdminFeeRule } = h.load('lib/finance/cooperative-admin.ts')

let count = 0
const jpeg = n => new Uint8Array([255, 216, 255, 224, n, n + 1, n + 2, 9, 9, 9])
const admin = { session: { id: 'admin', role: 'admin', roles: ['admin'] }, scope: { all: true, asrama: [], canMutate: true } }
const officerA = { session: { id: 'cashier', role: 'petugas_koperasi', roles: ['petugas_koperasi'] }, scope: { all: false, asrama: ['ASRAMA A'], canMutate: true } }
const officerB = { session: { id: 'officer-b', role: 'petugas_koperasi', roles: ['petugas_koperasi'] }, scope: { all: false, asrama: ['ASRAMA B'], canMutate: true } }

function setup() {
  h.reset()
  h.db.exec(fs.readFileSync('migrations/0196_finance_billing_issuance.sql', 'utf8'))
  h.db.exec(`
    INSERT INTO users(id,full_name,role,roles) VALUES('officer-b','Yusuf','petugas_koperasi','["petugas_koperasi"]');
    INSERT INTO santri(id,nis,nama_lengkap,asrama,kategori_santri) VALUES('baghory','1003','Baghory','AL-BAGHORY','REGULER'),
      ('sadesa','1004','Sadesa','ASRAMA A','SADESA');
    INSERT INTO finance_transfer_accounts(id,bank_name,account_number,account_holder,sort_order) VALUES('acc-bsi','BSI','7001234567','Koperasi Pesantren',1);
    INSERT INTO finance_obligations(id,santri_id,item_type,period,amount_expected) VALUES
      ('uspp','student','USPP','LIFETIME',3000000),('uspp-other','other','USPP','LIFETIME',3000000);
  `)
  objects.clear()
}
async function test(name, fn) { setup(); await fn(); count++; console.log('PASS ' + name) }
const one = (sql, ...p) => h.db.prepare(sql).get(...p)
const all = (sql, ...p) => h.db.prepare(sql).all(...p)
const balance = id => one(`SELECT COALESCE(SUM(CASE direction WHEN 'IN' THEN amount ELSE -amount END),0) b FROM finance_wallet_ledger WHERE santri_id=?`, id).b

async function enableFee(amount) {
  await setCooperativeAdminFeeRule({ amount, isEnabled: true, channel: 'TRANSFER', createdBy: 'admin' })
}
async function transferOrder(santriId, items, extra = {}) {
  return createPaymentOrder({ santriId, payerType: 'PORTAL_ORTU', paymentMethod: 'MANUAL_TRANSFER', destinationAccountId: 'acc-bsi', items, ...extra })
}
async function upload(santriId, orderId, seed = 1) {
  const sub = await mt.getTransferSubmissionByOrder(orderId)
  return mt.submitTransferProof({ santriId, submissionId: sub.id, bytes: jpeg(seed), mimeType: 'image/jpeg',
    senderName: 'Bapak Ahmad', senderBank: 'BRI', transferredAt: new Date().toISOString() })
}

async function main() {
  await test('ADD mode: transfer = items + admin fee + unique code, all server-side', async () => {
    await enableFee(5000)
    const order = await transferOrder('student', [{ obligationId: 'uspp', itemType: 'USPP', amount: 500000 }], { feeMode: 'ADD' })
    assert.equal(order.gross_amount, 500000)
    assert.equal(order.cooperative_admin_fee, 5000)
    assert.ok(order.unique_code >= 1 && order.unique_code <= 999)
    assert.equal(order.total_charged, 505000 + order.unique_code)
    const sub = await mt.getTransferSubmissionByOrder(order.id)
    assert.equal(sub.status, 'MENUNGGU_BUKTI'); assert.equal(sub.expected_amount, order.total_charged)
    assert.ok(JSON.parse(order.destination_snapshot).account_number === '7001234567')
  })

  await test('DEDUCT mode takes the fee from the flexible item; transfer = items + code', async () => {
    await enableFee(5000)
    const order = await transferOrder('student', [{ obligationId: 'uspp', itemType: 'USPP', amount: 500000 }], { feeMode: 'DEDUCT' })
    assert.equal(order.gross_amount, 495000)
    assert.equal(order.items[0].amount, 495000)
    assert.equal(order.total_charged, 500000 + order.unique_code)
  })

  await test('DEDUCT is refused when no flexible item can absorb the fee', async () => {
    await enableFee(5000)
    h.db.exec(`INSERT INTO finance_obligations(id,santri_id,item_type,period,amount_expected) VALUES('ehb','student','EHB','2026',100000)`)
    await assert.rejects(() => transferOrder('student', [{ obligationId: 'ehb', itemType: 'EHB', amount: 100000 }], { feeMode: 'DEDUCT' }), /hanya bisa dipotong/)
    await assert.rejects(() => transferOrder('student', [{ itemType: 'UANG_JAJAN', amount: 3000 }], { feeMode: 'DEDUCT' }), /hanya bisa dipotong/)
  })

  await test('unique codes never collide between pending transfers of the same base amount', async () => {
    h.db.exec(`INSERT INTO app_settings(key,value) VALUES('transfer_unique_code_max','99') ON CONFLICT(key) DO UPDATE SET value='99'`)
    const totals = new Set()
    for (let i = 0; i < 40; i++) {
      const id = 'mass-' + i
      h.db.prepare(`INSERT INTO santri(id,nis,nama_lengkap,asrama) VALUES(?,?,?,'ASRAMA A')`).run(id, '9' + i, 'Massal ' + i)
      const o = await transferOrder(id, [{ itemType: 'UANG_JAJAN', amount: 50000 }])
      assert.ok(!totals.has(o.total_charged)); totals.add(o.total_charged)
    }
    assert.throws(() => h.db.exec(`INSERT INTO finance_payment_orders(id,order_number,santri_id,payer_type,gross_amount,total_charged,payment_method,expires_at,unique_code,fee_mode,destination_account_id,destination_snapshot)
      SELECT 'dup','ORD-DUP','other','PORTAL_ORTU',gross_amount,total_charged,'MANUAL_TRANSFER',expires_at,unique_code,'ADD','acc-bsi','{}' FROM finance_payment_orders WHERE santri_id='mass-0'`), /UNIQUE/)
  })

  await test('exact approval posts payment, allocation, Koperasi income (fee + code) and wallet top-up atomically', async () => {
    await enableFee(5000)
    const order = await transferOrder('student', [{ obligationId: 'uspp', itemType: 'USPP', amount: 200000 }, { itemType: 'UANG_JAJAN', amount: 50000 }])
    await upload('student', order.id)
    const sub = await mt.getTransferSubmissionByOrder(order.id)
    assert.equal(sub.status, 'MENUNGGU_VERIFIKASI')
    await assert.rejects(() => mt.approveTransferSubmission(officerA, { submissionId: sub.id, receivedAmount: sub.expected_amount + 1 }), /tidak sama/)
    const r = await mt.approveTransferSubmission(officerA, { submissionId: sub.id, receivedAmount: sub.expected_amount })
    const p = one('SELECT * FROM finance_payments WHERE id=?', r.paymentId)
    assert.equal(p.channel, 'TRANSFER'); assert.equal(p.status, 'PAID'); assert.equal(p.allocation_status, 'ALLOCATED')
    assert.equal(p.gross_amount + p.cooperative_admin_fee + p.unique_code_amount, sub.expected_amount)
    assert.equal(one(`SELECT amount_paid FROM finance_obligations WHERE id='uspp'`).amount_paid, 200000)
    assert.equal(balance('student'), 50000)
    const income = all(`SELECT income_source, amount FROM finance_cooperative_income WHERE payment_id=? ORDER BY income_source`, r.paymentId)
    assert.deepEqual(income.map(i => [i.income_source, i.amount]), [['ADMIN_FEE', 5000], ['UNIQUE_CODE', order.unique_code]])
    assert.equal(one('SELECT status FROM finance_payment_orders WHERE id=?', order.id).status, 'PAID')
    assert.equal(one('SELECT status FROM finance_transfer_submissions WHERE id=?', sub.id).status, 'DITERIMA')
    // Replay is idempotent; a second verifier cannot double post.
    assert.deepEqual(await mt.approveTransferSubmission(officerA, { submissionId: sub.id, receivedAmount: sub.expected_amount }), r)
    await assert.rejects(() => mt.approveTransferSubmission(admin, { submissionId: sub.id, receivedAmount: sub.expected_amount }), /sudah diterima/)
    assert.equal(one('SELECT COUNT(*) n FROM finance_payments').n, 1)
    assert.equal(balance('student'), 50000)
  })

  await test('two verifiers racing on the same proof produce exactly one payment', async () => {
    const order = await transferOrder('student', [{ itemType: 'UANG_JAJAN', amount: 70000 }])
    await upload('student', order.id)
    const sub = await mt.getTransferSubmissionByOrder(order.id)
    const results = await Promise.allSettled([
      mt.approveTransferSubmission(officerA, { submissionId: sub.id, receivedAmount: sub.expected_amount }),
      mt.approveTransferSubmission(admin, { submissionId: sub.id, receivedAmount: sub.expected_amount }),
    ])
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    assert.equal(one('SELECT COUNT(*) n FROM finance_payments').n, 1)
    assert.equal(balance('student'), 70000)
  })

  await test('atomic failure leaves no half-posted state', async () => {
    const order = await transferOrder('student', [{ itemType: 'UANG_JAJAN', amount: 70000 }])
    await upload('student', order.id)
    const sub = await mt.getTransferSubmissionByOrder(order.id)
    h.fault(4)
    await assert.rejects(() => mt.approveTransferSubmission(officerA, { submissionId: sub.id, receivedAmount: sub.expected_amount }))
    h.fault(-1)
    assert.equal(one('SELECT COUNT(*) n FROM finance_payments').n, 0)
    assert.equal(one('SELECT COUNT(*) n FROM finance_wallet_ledger').n, 0)
    assert.equal(one('SELECT COUNT(*) n FROM finance_cooperative_income').n, 0)
    assert.equal(one('SELECT status FROM finance_transfer_submissions WHERE id=?', sub.id).status, 'MENUNGGU_VERIFIKASI')
  })

  await test('verifier scope: officer of asrama A cannot review asrama B', async () => {
    const order = await transferOrder('other', [{ itemType: 'UANG_JAJAN', amount: 30000 }])
    await upload('other', order.id)
    const sub = await mt.getTransferSubmissionByOrder(order.id)
    await assert.rejects(() => mt.approveTransferSubmission(officerA, { submissionId: sub.id, receivedAmount: sub.expected_amount }), /bukan bagian tugas/)
    assert.equal((await mt.listTransferQueue(officerA.scope, { status: 'MENUNGGU_VERIFIKASI' })).length, 0)
    assert.equal((await mt.listTransferQueue(officerB.scope, { status: 'MENUNGGU_VERIFIKASI' })).length, 1)
    assert.equal((await mt.listTransferQueue({ all: false, asrama: [], canMutate: true }, {})).length, 0)
    await mt.approveTransferSubmission(officerB, { submissionId: sub.id, receivedAmount: sub.expected_amount })
  })

  await test('amount mismatch is kept as unallocated money with a reconciliation item', async () => {
    await enableFee(5000)
    const order = await transferOrder('student', [{ obligationId: 'uspp', itemType: 'USPP', amount: 200000 }])
    await upload('student', order.id)
    const sub = await mt.getTransferSubmissionByOrder(order.id)
    await assert.rejects(() => mt.approveTransferAsUnallocated(officerA, { submissionId: sub.id, receivedAmount: 200000, notes: 'pendek' }), /minimal 10/)
    const r = await mt.approveTransferAsUnallocated(officerA, { submissionId: sub.id, receivedAmount: 200000, notes: 'Mutasi hanya Rp200.000, kurang biaya admin' })
    const p = one('SELECT * FROM finance_payments WHERE id=?', r.paymentId)
    assert.equal(p.allocation_status, 'UNALLOCATED'); assert.equal(p.order_id, null); assert.equal(p.gross_amount, 200000)
    assert.equal(one(`SELECT amount_paid FROM finance_obligations WHERE id='uspp'`).amount_paid, 0)
    assert.equal(one(`SELECT match_status FROM finance_reconciliation_items WHERE payment_id=?`, r.paymentId).match_status, 'UNALLOCATED_TRANSFER')
    assert.equal(one('SELECT status FROM finance_payment_orders WHERE id=?', order.id).status, 'CANCELLED')
    assert.equal(one('SELECT COUNT(*) n FROM finance_cooperative_income').n, 0)
  })

  await test('reject and fix request keep history; same proof image cannot be reused', async () => {
    const order = await transferOrder('student', [{ itemType: 'UANG_JAJAN', amount: 40000 }])
    await upload('student', order.id, 7)
    const sub = await mt.getTransferSubmissionByOrder(order.id)
    await mt.requestTransferProofFix(officerA, { submissionId: sub.id, reason: 'Foto buram, nominal tidak terbaca' })
    assert.equal(one('SELECT status FROM finance_transfer_submissions WHERE id=?', sub.id).status, 'PERLU_PERBAIKAN')
    await assert.rejects(() => upload('student', order.id, 7), /sudah pernah diunggah/)
    await upload('student', order.id, 8)
    assert.equal(one('SELECT status FROM finance_transfer_submissions WHERE id=?', sub.id).status, 'MENUNGGU_VERIFIKASI')
    await mt.rejectTransferSubmission(officerA, { submissionId: sub.id, reason: 'Transfer tidak ditemukan di mutasi' })
    assert.equal(one('SELECT status FROM finance_payment_orders WHERE id=?', order.id).status, 'CANCELLED')
    assert.deepEqual(all('SELECT action FROM finance_transfer_submission_events WHERE submission_id=? ORDER BY rowid', sub.id).map(e => e.action),
      ['CREATED', 'PROOF_UPLOADED', 'FIX_REQUESTED', 'PROOF_UPLOADED', 'REJECTED'])
    assert.equal(one('SELECT COUNT(*) n FROM finance_transfer_proofs').n, 2)
    assert.throws(() => h.db.exec(`DELETE FROM finance_transfer_submission_events`), /APPEND_ONLY/)
    assert.throws(() => h.db.exec(`UPDATE finance_transfer_submissions SET status='MENUNGGU_VERIFIKASI' WHERE id='${sub.id}'`), /FINAL|TRANSITION/)
  })

  await test('verifier can close a submission whose parent never re-uploads', async () => {
    const order = await transferOrder('student', [{ itemType: 'UANG_JAJAN', amount: 40000 }])
    await upload('student', order.id, 21)
    const sub = await mt.getTransferSubmissionByOrder(order.id)
    await mt.requestTransferProofFix(officerA, { submissionId: sub.id, reason: 'Nominal tidak terbaca' })
    await assert.rejects(() => transferOrder('student', [{ itemType: 'UANG_JAJAN', amount: 10000 }]), /sedang dicek petugas/)
    await mt.rejectTransferSubmission(officerA, { submissionId: sub.id, reason: 'Tidak ada tanggapan wali' })
    assert.equal(one('SELECT status FROM finance_payment_orders WHERE id=?', order.id).status, 'CANCELLED')
    await transferOrder('student', [{ itemType: 'UANG_JAJAN', amount: 10000 }])
  })

  await test('one active online order per santri; proof under review blocks replacement and expiry', async () => {
    const first = await transferOrder('student', [{ itemType: 'UANG_JAJAN', amount: 40000 }])
    const second = await transferOrder('student', [{ itemType: 'UANG_JAJAN', amount: 60000 }])
    assert.equal(one('SELECT status FROM finance_payment_orders WHERE id=?', first.id).status, 'REPLACED')
    assert.equal((await mt.getTransferSubmissionByOrder(first.id)).status, 'DIBATALKAN')
    await upload('student', second.id)
    await assert.rejects(() => transferOrder('student', [{ itemType: 'UANG_JAJAN', amount: 10000 }]), /sedang dicek petugas/)
    assert.throws(() => h.db.exec(`UPDATE finance_payment_orders SET status='EXPIRED' WHERE id='${second.id}'`), /TRANSFER_IN_REVIEW/)
  })

  await test('order expires when no proof arrives before the deadline', async () => {
    const order = await transferOrder('student', [{ itemType: 'UANG_JAJAN', amount: 40000 }])
    h.db.exec(`DROP TRIGGER trg_finance_order_terms_immutable`)
    h.db.prepare(`UPDATE finance_payment_orders SET expires_at='2020-01-01T00:00:00Z' WHERE id=?`).run(order.id)
    await assert.rejects(() => upload('student', order.id), /Batas waktu/)
    await h.load('lib/finance/orders.ts').expireStaleTransferOrders()
    assert.equal(one('SELECT status FROM finance_payment_orders WHERE id=?', order.id).status, 'EXPIRED')
    assert.equal((await mt.getTransferSubmissionByOrder(order.id)).status, 'KEDALUWARSA')
  })

  await test('AL-BAGHORY has no transfer payment; SADESA cannot be billed makan via transfer', async () => {
    await assert.rejects(() => transferOrder('baghory', [{ itemType: 'UANG_JAJAN', amount: 10000 }]))
    h.db.exec(`INSERT INTO finance_obligations(id,santri_id,item_type,period,amount_expected) VALUES('makan-sadesa','sadesa','UANG_MAKAN','2026-10',70000)`)
    await assert.rejects(() => transferOrder('sadesa', [{ obligationId: 'makan-sadesa', itemType: 'UANG_MAKAN', amount: 70000 }]))
    await transferOrder('sadesa', [{ itemType: 'UANG_JAJAN', amount: 10000 }])
  })

  await test('collective payout: handover, cancellation of absent santri, cash back, session close guard', async () => {
    h.db.exec(`INSERT INTO santri(id,nis,nama_lengkap,asrama,kamar) VALUES('s1','2001','Satu','ASRAMA A','1'),('s2','2002','Dua','ASRAMA A','1'),('s3','2003','Tiga','ASRAMA A','1')`)
    const session = await openCashSession('cashier', 100000)
    for (const id of ['s1', 's2', 's3']) {
      h.db.prepare(`INSERT INTO finance_wallet_ledger(id,santri_id,direction,movement_type,amount,balance_before,balance_after,cash_session_id,operator_id,created_at)
        VALUES(?,?,'IN','TOPUP_CASH',50000,0,50000,?,'cashier',?)`).run('top-' + id, id, session.id, new Date().toISOString())
    }
    const items = ['s1', 's2', 's3'].map(santriId => ({ santriId, amount: 20000 }))
    const created = await payout.createPayoutBatch('cashier', { idempotencyKey: 'k1', asrama: 'ASRAMA A', representativeName: 'Ketua Kamar 1', items })
    assert.equal(created.totalAmount, 60000)
    assert.deepEqual(await payout.createPayoutBatch('cashier', { idempotencyKey: 'k1', asrama: 'ASRAMA A', representativeName: 'Ketua Kamar 1', items }), created)
    assert.equal(balance('s1'), 30000)
    await assert.rejects(() => payout.createPayoutBatch('cashier', { idempotencyKey: 'k2', asrama: 'ASRAMA A', representativeName: 'Lain', items: [{ santriId: 's1', amount: 10000 }] }), /pencairan lain|limit/)
    assert.throws(() => h.db.exec(`UPDATE finance_cash_sessions SET status='CLOSED' WHERE id='${session.id}'`), /PAYOUT_BATCH_OPEN/)
    const detail = await payout.getPayoutBatchDetail(created.batchId)
    const s3 = detail.items.find(i => i.santri_id === 's3')
    await assert.rejects(() => payout.settlePayoutBatch('cashier', { batchId: created.batchId, idempotencyKey: 'st', cancelled: [{ itemId: s3.id, reason: 'Pulang' }], returnedCash: 10000 }), /harus Rp20.000/)
    await payout.settlePayoutBatch('cashier', { batchId: created.batchId, idempotencyKey: 'st', cancelled: [{ itemId: s3.id, reason: 'Pulang ke rumah' }], returnedCash: 20000 })
    assert.equal(balance('s3'), 50000); assert.equal(balance('s1'), 30000)
    const batchRow = one('SELECT * FROM finance_wallet_payout_batches WHERE id=?', created.batchId)
    assert.equal(batchRow.status, 'SELESAI'); assert.equal(batchRow.total_delivered, 40000); assert.equal(batchRow.total_returned, 20000)
    const cash = await h.load('lib/finance/cash-session.ts').recalculateCashSession(session.id)
    assert.equal(cash.expected_closing_balance, 100000 + 150000 - 40000)
    // Returned santri regains the daily allowance; settled batch is final.
    await payout.createPayoutBatch('cashier', { idempotencyKey: 'k3', asrama: 'ASRAMA A', representativeName: 'Susulan', items: [{ santriId: 's3', amount: 20000 }] })
    await assert.rejects(() => payout.settlePayoutBatch('cashier', { batchId: created.batchId, idempotencyKey: 'st2', cancelled: [], returnedCash: 0 }), /sudah diselesaikan/)
    assert.throws(() => h.db.exec(`DELETE FROM finance_wallet_payout_items`), /PAYOUT_NO_DELETE/)
  })

  await test('collective payout respects balance, limit and open cash session', async () => {
    h.db.exec(`INSERT INTO santri(id,nis,nama_lengkap,asrama,kamar) VALUES('s1','2001','Satu','ASRAMA A','1')`)
    await assert.rejects(() => payout.createPayoutBatch('cashier', { idempotencyKey: 'x', asrama: 'ASRAMA A', representativeName: 'Rep', items: [{ santriId: 's1', amount: 1000 }] }), /Buka sesi kas/)
    const session = await openCashSession('cashier', 500000)
    h.db.prepare(`INSERT INTO finance_wallet_ledger(id,santri_id,direction,movement_type,amount,balance_before,balance_after,cash_session_id,operator_id,created_at)
      VALUES('t','s1','IN','TOPUP_CASH',300000,0,300000,?,'cashier',?)`).run(session.id, new Date().toISOString())
    await assert.rejects(() => payout.createPayoutBatch('cashier', { idempotencyKey: 'y', asrama: 'ASRAMA A', representativeName: 'Rep', items: [{ santriId: 's1', amount: 150000 }] }), /limit/)
    assert.equal(balance('s1'), 300000)
  })

  console.log(`manual transfer + collective payout: ${count} passed`)
}
main().catch(error => { console.error(error); process.exit(1) })
