// NOTIF-4: finance events write guarded outbox rows in the SAME batch as the money movement,
// against the real finance migrations (0152..0200) + 0202. No network.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { harness } = require('./finance-remediation-fixture.cjs')

const h = harness()
h.state.productionDB = {}
const objects = new Map()
h.state.bucket = {
  put: async (key, bytes, options) => { objects.set(key, { bytes, options }); return { key } },
  head: async key => objects.get(key) ? { customMetadata: objects.get(key).options.customMetadata, writeHttpMetadata() {} } : null,
}
const { createPaymentOrder } = h.load('lib/finance/orders.ts')
const orders = h.load('lib/finance/orders.ts')
const mt = h.load('lib/finance/manual-transfer.ts')
const payout = h.load('lib/finance/wallet-payout.ts')
const cash = h.load('lib/finance/cash-session.ts')
const { recordOrderPayment } = h.load('lib/finance/payments.ts')
const { runBillingJob } = h.load('lib/finance/billing-job.ts')
const fe = h.load('lib/notifications/finance-events.ts')
const { processOutbox } = h.load('lib/notifications/dispatch.ts')
const { runSourceScans } = h.load('lib/notifications/scans.ts')

const MIGRATION_0202 = fs.readFileSync('migrations/0202_notifications.sql', 'utf8').replace(/\r\n/g, '\n')
const admin = { session: { id: 'admin', role: 'admin', roles: ['admin'] }, scope: { all: true, asrama: [], canMutate: true } }
const officerA = { session: { id: 'cashier', role: 'petugas_koperasi', roles: ['petugas_koperasi'] }, scope: { all: false, asrama: ['ASRAMA A'], canMutate: true } }
const jpeg = n => new Uint8Array([255, 216, 255, 224, n, n + 1, n + 2, 9, 9, 9])
const one = (sql, ...p) => h.db.prepare(sql).get(...p)
const all = (sql, ...p) => h.db.prepare(sql).all(...p)
const outbox = code => all('SELECT event_code, dedupe_key, payload_json FROM notif_outbox WHERE event_code = ? ORDER BY created_at, dedupe_key', code)
  .map(r => ({ ...r, payload: JSON.parse(r.payload_json) }))

function setup(withNotifications = true) {
  h.reset()
  fe.resetNotificationSchemaCache()
  h.db.exec(fs.readFileSync('migrations/0196_finance_billing_issuance.sql', 'utf8'))
  h.db.exec(`
    ALTER TABLE users ADD COLUMN asrama_binaan TEXT;
    ALTER TABLE users ADD COLUMN structural_jabatan TEXT;
    CREATE TABLE IF NOT EXISTS user_fitur_override(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, fitur_id INTEGER, action TEXT);
    INSERT INTO finance_transfer_accounts(id,bank_name,account_number,account_holder,sort_order) VALUES('acc-bsi','BSI','7001234567','Koperasi Pesantren',1);
    INSERT INTO finance_obligations(id,santri_id,item_type,period,amount_expected) VALUES ('uspp','student','USPP','LIFETIME',3000000);
  `)
  if (withNotifications) {
    h.db.exec(MIGRATION_0202)
    h.db.exec(`INSERT INTO finance_transfer_verifier_scopes(user_id, asrama) VALUES ('cashier','ASRAMA A');
      INSERT INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan) VALUES
      ('Keuangan','Verifikasi Transfer','/dashboard/keuangan/verifikasi-transfer','ListChecks','["admin","bendahara","admin_koperasi","petugas_koperasi","pimpinan"]',1,1)
      ON CONFLICT(href) DO UPDATE SET roles=excluded.roles, is_active=1;`)
  }
  objects.clear()
}
let count = 0
async function test(name, fn, withNotifications = true) { setup(withNotifications); await fn(); count++; console.log('PASS ' + name) }

async function transferOrder(santriId = 'student', amount = 500000) {
  return createPaymentOrder({ santriId, payerType: 'PORTAL_ORTU', paymentMethod: 'MANUAL_TRANSFER', destinationAccountId: 'acc-bsi',
    items: [{ obligationId: 'uspp', itemType: 'USPP', amount }] })
}
async function upload(orderId, seed = 1) {
  const sub = await mt.getTransferSubmissionByOrder(orderId)
  return mt.submitTransferProof({ santriId: 'student', submissionId: sub.id, bytes: jpeg(seed), mimeType: 'image/jpeg',
    senderName: 'Bapak Ahmad', senderBank: 'BRI', transferredAt: new Date().toISOString() })
}

async function main() {
  await test('without migration 0202 every finance flow runs exactly as before (no outbox statements)', async () => {
    const order = await transferOrder()
    const sub = await upload(order.id)
    await mt.approveTransferSubmission(officerA, { submissionId: sub.id, receivedAmount: sub.expected_amount })
    assert.equal((await mt.getTransferSubmission(sub.id)).status, 'DITERIMA')
    assert.equal(one("SELECT COUNT(*) n FROM sqlite_master WHERE name='notif_outbox'").n, 0)
  }, false)

  await test('proof upload notifies verifiers of that asrama; dispatch reaches scoped petugas + admin', async () => {
    const order = await transferOrder()
    const sub = await upload(order.id)
    const [row] = outbox('STAFF_TRANSFER_MENUNGGU_VERIFIKASI')
    assert.equal(row.payload.asrama, 'ASRAMA A')
    assert.equal(row.payload.nominal, sub.expected_amount)
    assert.equal(row.payload.nomor, sub.submission_number)
    await processOutbox(h.adapter)
    const recipients = all("SELECT recipient_id FROM notifications WHERE event_code='STAFF_TRANSFER_MENUNGGU_VERIFIKASI' ORDER BY recipient_id").map(r => r.recipient_id)
    assert.deepEqual(recipients, ['admin', 'cashier'], 'pimpinan is read-only and not assigned')
  })

  await test('approval writes exactly one parent notice in the same batch; replay and second verifier add none', async () => {
    const order = await transferOrder()
    const sub = await upload(order.id)
    const r = await mt.approveTransferSubmission(officerA, { submissionId: sub.id, receivedAmount: sub.expected_amount })
    assert.deepEqual(await mt.approveTransferSubmission(officerA, { submissionId: sub.id, receivedAmount: sub.expected_amount }), r)
    await assert.rejects(() => mt.approveTransferSubmission(admin, { submissionId: sub.id, receivedAmount: sub.expected_amount }))
    const rows = outbox('PORTAL_TRANSFER_DITERIMA')
    assert.equal(rows.length, 1)
    assert.deepEqual({ santri: rows[0].payload.santri_id, nominal: rows[0].payload.nominal }, { santri: 'student', nominal: sub.expected_amount })
    await processOutbox(h.adapter)
    const inbox = one("SELECT recipient_kind k, recipient_id id, body FROM notifications WHERE event_code='PORTAL_TRANSFER_DITERIMA'")
    assert.equal(inbox.k, 'SANTRI'); assert.equal(inbox.id, 'student')
    assert.match(inbox.body, new RegExp(`Rp${sub.expected_amount.toLocaleString('id-ID').replace(/\./g, '\\.')}`))
  })

  await test('a failing financial batch leaves neither money nor notification', async () => {
    const order = await transferOrder()
    const sub = await upload(order.id)
    const before = one('SELECT COUNT(*) n FROM notif_outbox').n
    const original = h.adapter.batch
    h.adapter.batch = async statements => { // fail on the very last statement (the notice itself)
      h.db.exec('BEGIN')
      try { statements.forEach((s, i) => { if (i === statements.length - 1) throw new Error('INJECTED'); h.db.prepare(s.sql).run(...(s.params || [])) }); h.db.exec('COMMIT') }
      catch (e) { h.db.exec('ROLLBACK'); throw e }
    }
    try { await assert.rejects(() => mt.approveTransferSubmission(officerA, { submissionId: sub.id, receivedAmount: sub.expected_amount })) }
    finally { h.adapter.batch = original }
    assert.equal((await mt.getTransferSubmission(sub.id)).status, 'MENUNGGU_VERIFIKASI')
    assert.equal(one("SELECT COUNT(*) n FROM finance_payments WHERE external_reference=?", sub.submission_number).n, 0)
    assert.equal(one('SELECT COUNT(*) n FROM notif_outbox').n, before)
  })

  await test('guard: a notice whose audit row was not written (lost race) is not stored', async () => {
    const order = await transferOrder()
    const sub = await mt.getTransferSubmissionByOrder(order.id)
    for (const s of fe.transferClosedNotices(sub, 'REJECT', 'x', 'event-that-never-happened')) h.db.prepare(s.sql).run(...s.params)
    assert.equal(one('SELECT COUNT(*) n FROM notif_outbox').n, 0)
  })

  await test('reject / repeated fix requests / unallocated each notify the parent with the officer note', async () => {
    let order = await transferOrder()
    let sub = await upload(order.id, 1)
    await mt.requestTransferProofFix(officerA, { submissionId: sub.id, reason: 'Foto buram, nominal tidak terbaca' })
    sub = await mt.submitTransferProof({ santriId: 'student', submissionId: sub.id, bytes: jpeg(2), mimeType: 'image/jpeg', senderName: 'Bapak Ahmad', senderBank: 'BRI', transferredAt: new Date().toISOString() })
    await mt.requestTransferProofFix(officerA, { submissionId: sub.id, reason: 'Masih buram, mohon foto ulang' })
    await mt.rejectTransferSubmission(officerA, { submissionId: sub.id, reason: 'Transfer tidak ditemukan di mutasi' })
    assert.deepEqual(outbox('PORTAL_TRANSFER_PERLU_PERBAIKAN').map(r => r.payload.alasan), ['Foto buram, nominal tidak terbaca', 'Masih buram, mohon foto ulang'])
    assert.deepEqual(outbox('PORTAL_TRANSFER_DITOLAK').map(r => r.payload.alasan), ['Transfer tidak ditemukan di mutasi'])
    assert.equal(outbox('STAFF_TRANSFER_MENUNGGU_VERIFIKASI').length, 2, 'each proof upload notifies verifiers once')
    order = await transferOrder('student', 400000)
    sub = await upload(order.id, 3)
    await mt.approveTransferAsUnallocated(officerA, { submissionId: sub.id, receivedAmount: 200000, notes: 'Mutasi hanya Rp200.000, kurang' })
    const [u] = outbox('PORTAL_TRANSFER_BELUM_TERALOKASI')
    assert.equal(u.payload.nominal, 200000)
  })

  await test('expiry notifies only submissions that actually expire, once', async () => {
    // Satu order online aktif per santri: pakai dua santri berbeda.
    const expired = await createPaymentOrder({ santriId: 'student', payerType: 'PORTAL_ORTU', paymentMethod: 'MANUAL_TRANSFER',
      destinationAccountId: 'acc-bsi', items: [{ itemType: 'UANG_JAJAN', amount: 40000 }] })
    const reviewing = await createPaymentOrder({ santriId: 'other', payerType: 'PORTAL_ORTU', paymentMethod: 'MANUAL_TRANSFER',
      destinationAccountId: 'acc-bsi', items: [{ itemType: 'UANG_JAJAN', amount: 30000 }] })
    const reviewSub = await mt.getTransferSubmissionByOrder(reviewing.id)
    await mt.submitTransferProof({ santriId: 'other', submissionId: reviewSub.id, bytes: jpeg(7), mimeType: 'image/jpeg',
      senderName: 'Ibu Budi', senderBank: 'BRI', transferredAt: new Date().toISOString() })
    h.db.exec('DROP TRIGGER trg_finance_order_terms_immutable')
    h.db.prepare("UPDATE finance_payment_orders SET expires_at='2020-01-01T00:00:00Z' WHERE id IN (?, ?)").run(expired.id, reviewing.id)
    await orders.expireStaleTransferOrders()
    await orders.expireStaleTransferOrders()
    const rows = outbox('PORTAL_TRANSFER_KEDALUWARSA')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].payload.nomor, (await mt.getTransferSubmissionByOrder(expired.id)).submission_number)
    assert.equal(rows[0].payload.nama_santri, 'Santri')
  })

  await test('cash payment at Status Pembayaran notifies "Pembayaran Diterima" with the paid amount', async () => {
    const order = await createPaymentOrder({ santriId: 'student', payerType: 'LOKET', paymentMethod: 'CASH', items: [{ obligationId: 'uspp', itemType: 'USPP', amount: 750000 }] })
    const payment = await recordOrderPayment({ orderId: order.id, channel: 'CASH', method: 'CASH', externalReference: 'cash-notif-1' })
    const [row] = outbox('PORTAL_PEMBAYARAN_DITERIMA')
    assert.equal(row.dedupe_key, `PAY:${payment.id}`)
    assert.deepEqual({ nominal: row.payload.nominal, metode: row.payload.metode }, { nominal: 750000, metode: 'Tunai' })
    await recordOrderPayment({ orderId: order.id, channel: 'CASH', method: 'CASH', externalReference: 'cash-notif-1' }).catch(() => null)
    assert.equal(outbox('PORTAL_PEMBAYARAN_DITERIMA').length, 1, 'idempotent replay adds nothing')
  })

  await test('collective payout: DIBAWA per santri, then DITERIMA / DIBATALKAN with reason', async () => {
    h.db.exec(`INSERT INTO santri(id,nis,nama_lengkap,asrama,kamar) VALUES('s1','2001','Satu','ASRAMA A','1'),('s2','2002','Dua','ASRAMA A','1')`)
    const session = await cash.openCashSession('cashier', 100000)
    for (const id of ['s1', 's2']) h.db.prepare(`INSERT INTO finance_wallet_ledger(id,santri_id,direction,movement_type,amount,balance_before,balance_after,cash_session_id,operator_id,created_at)
      VALUES(?,?,'IN','TOPUP_CASH',50000,0,50000,?,'cashier',?)`).run('top-' + id, id, session.id, new Date().toISOString())
    const created = await payout.createPayoutBatch('cashier', { idempotencyKey: 'k1', asrama: 'ASRAMA A', representativeName: 'Ketua Kamar 1',
      items: [{ santriId: 's1', amount: 20000 }, { santriId: 's2', amount: 15000 }] })
    await payout.createPayoutBatch('cashier', { idempotencyKey: 'k1', asrama: 'ASRAMA A', representativeName: 'Ketua Kamar 1',
      items: [{ santriId: 's1', amount: 20000 }, { santriId: 's2', amount: 15000 }] })
    assert.deepEqual(outbox('PORTAL_PENCAIRAN_DIBAWA').map(r => [r.payload.santri_id, r.payload.nominal, r.payload.perwakilan]).sort(),
      [['s1', 20000, 'Ketua Kamar 1'], ['s2', 15000, 'Ketua Kamar 1']])
    const detail = await payout.getPayoutBatchDetail(created.batchId)
    const s2 = detail.items.find(i => i.santri_id === 's2')
    await payout.settlePayoutBatch('cashier', { batchId: created.batchId, idempotencyKey: 'st', cancelled: [{ itemId: s2.id, reason: 'Pulang ke rumah' }], returnedCash: 15000 })
    assert.deepEqual(outbox('PORTAL_PENCAIRAN_DITERIMA').map(r => r.payload.santri_id), ['s1'])
    assert.deepEqual(outbox('PORTAL_PENCAIRAN_DIBATALKAN').map(r => [r.payload.santri_id, r.payload.alasan]), [['s2', 'Pulang ke rumah']])
  })

  await test('closing a cash session with a difference alerts finance control; exact close does not', async () => {
    const exact = await cash.openCashSession('cashier', 100000)
    await cash.closeCashSession(exact.id, 'cashier', 100000)
    assert.equal(outbox('STAFF_SELISIH_KAS').length, 0)
    const short = await cash.openCashSession('cashier', 100000)
    await cash.closeCashSession(short.id, 'cashier', 90000, 'Uang kembalian kurang')
    const [row] = outbox('STAFF_SELISIH_KAS')
    assert.deepEqual({ selisih: row.payload.selisih, petugas: row.payload.petugas, actor: row.payload.actor_user_id }, { selisih: -10000, petugas: 'Kasir', actor: 'cashier' })
    assert.equal(one('SELECT status FROM finance_cash_sessions WHERE id=?', short.id).status, 'CLOSED')
  })

  await test('billing job sends one digest per santri per day, never per item, and none on replay', async () => {
    h.db.exec("UPDATE santri SET tanggal_masuk='2026-07-01',created_at='2026-07-01',tahun_masuk=2026; INSERT OR REPLACE INTO app_settings(key,value) VALUES('spp_tagihan_mulai','2026-07')")
    for (const item of ['SPP', 'UANG_MAKAN', 'UANG_NYUCI', 'EHB', 'EKSKUL', 'KESEHATAN'])
      if (!one('SELECT id FROM finance_tariffs WHERE item_type=? AND academic_year_id=2', item))
        h.db.prepare("INSERT INTO finance_tariffs(id,item_type,academic_year_id,nominal,effective_from) VALUES(?,?,2,70000,'2026-07-01')").run('t-' + item, item)
    const at = new Date('2026-10-15T12:00:00+07:00')
    await runBillingJob(h.adapter, at, 10)
    const rows = outbox('PORTAL_TAGIHAN_TERBIT')
    const created = one("SELECT COUNT(*) n, SUM(amount_expected - amount_exempted) total FROM finance_obligations WHERE santri_id='student' AND id <> 'uspp'")
    const mine = rows.find(r => r.payload.santri_id === 'student')
    assert.ok(mine, 'student digest exists')
    assert.equal(mine.payload.jumlah, created.n)
    assert.equal(mine.payload.total, created.total)
    assert.equal(new Set(rows.map(r => r.payload.santri_id)).size, rows.length, 'one per santri')
    await runBillingJob(h.adapter, at, 10)
    assert.equal(outbox('PORTAL_TAGIHAN_TERBIT').length, rows.length)
  })

  await test('source scans: first run only initializes cursors; new reconciliation items produce one digest', async () => {
    h.db.prepare(`INSERT INTO finance_reconciliation_items(id, external_reference, internal_amount, external_amount, discrepancy_amount, match_status, resolution_action, created_at)
      VALUES ('old', 'X', 0, 1, 1, 'UNALLOCATED_TRANSFER', 'NONE', '2026-11-01T00:00:00.000Z')`).run()
    const first = await runSourceScans(h.adapter)
    assert.ok(first.find(s => s.source === 'finance_reconciliation_items').initialized)
    assert.equal(outbox('STAFF_REKONSILIASI_BARU').length, 0, 'backlog is not announced')
    for (const id of ['n1', 'n2']) h.db.prepare(`INSERT INTO finance_reconciliation_items(id, external_reference, internal_amount, external_amount, discrepancy_amount, match_status, resolution_action, created_at)
      VALUES (?, 'Y', 0, 1, 1, 'UNALLOCATED_TRANSFER', 'NONE', ?)`).run(id, '2026-11-23T0' + (id === 'n1' ? '1' : '2') + ':00:00.000Z')
    await runSourceScans(h.adapter)
    await runSourceScans(h.adapter)
    const rows = outbox('STAFF_REKONSILIASI_BARU')
    assert.equal(rows.length, 1)
    assert.deepEqual({ jumlah: rows[0].payload.jumlah, jenis: rows[0].payload.jenis }, { jumlah: 2, jenis: 'transfer belum teralokasi' })
  })

  await test('a notice builder error never blocks the money movement', async () => {
    const statements = await fe.safeNotices(h.adapter, () => { throw new Error('boom') })
    assert.deepEqual(statements, [])
    const order = await transferOrder()
    const sub = await upload(order.id)
    assert.equal(sub.status, 'MENUNGGU_VERIFIKASI')
  })

  console.log(`\n${count} finance notification tests passed`)
}

main().catch(error => { console.error(error); process.exit(1) })
