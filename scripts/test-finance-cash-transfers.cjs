// Mutasi Kas Bank ↔ Tunai (migration 0200): cash session effect, guards, opening continuity, reconciliation.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { harness } = require('./finance-remediation-fixture.cjs')

const h = harness()
h.state.productionDB = {}
const objects = new Map()
h.state.bucket = {
  put: async (key, bytes, options) => { objects.set(key, { bytes, options }); return { key } },
  head: async () => null,
  get: async () => null,
}
process.env.FINANCE_COLLECTION_ACCOUNT_NO = '700-123-4567'

const ct = h.load('lib/finance/cash-transfers.ts')
const cs = h.load('lib/finance/cash-session.ts')
const reports = h.load('lib/finance/reports.ts')
const { matchStatementTransaction } = h.load('lib/finance/bank-statement/matching-engine.ts')
const { recordUnallocatedStatementPayment } = h.load('lib/finance/bank-statement/unallocated-service.ts')

let count = 0
let seq = 0
const jpeg = () => { seq++; return new Uint8Array([255, 216, 255, 224, seq & 255, (seq >> 8) & 255, 7, 7, 7, 7]) }
const one = (sql, ...p) => h.db.prepare(sql).get(...p)

function setup() {
  h.reset()
  h.db.exec(`
    INSERT INTO users(id,full_name,role,roles) VALUES('bendahara','Bendahara','bendahara','["bendahara"]'),('cashier-2','Kasir 2','petugas_koperasi','["petugas_koperasi"]');
    INSERT INTO finance_transfer_accounts(id,bank_name,account_number,account_holder,sort_order) VALUES
      ('acc-bri','BRI','7001234567','Koperasi Pesantren',1);
    INSERT INTO finance_transfer_accounts(id,bank_name,account_number,account_holder,is_active,sort_order) VALUES
      ('acc-old','BSI','9990001111','Koperasi Lama',0,2);
    INSERT INTO finance_bri_statement_fetches(id,fetch_reference_no,account_no,from_date_time,to_date_time,body_hash,status)
      VALUES('fetch-1','F1','700-123-4567','2026-11-01T00:00:00+07:00','2026-11-30T00:00:00+07:00','h','SUCCESS');
  `)
  objects.clear()
}
async function test(name, fn) { setup(); await fn(); count++; console.log('PASS ' + name) }

function statementLine(id, type, amount, account = '700-123-4567') {
  h.db.prepare(`INSERT INTO finance_bri_statement_transactions(id,fetch_id,account_no,transaction_id,identity_strength,dedup_key,
      transaction_date_raw,type_raw,type_normalized,amount,amount_raw,raw_evidence_hash,first_seen_at,last_seen_at,raw_json,match_status)
    VALUES(?,?,?,?,'STRONG',?,'2026-11-19 09:00','${type === 'DEBIT' ? 'D' : 'C'}',?,?,?,?,?,?,'{}',?)`)
    .run(id, 'fetch-1', account, 'TRX-' + id, 'dedup-' + id, type, amount, amount + '.00', 'ev-' + id,
      new Date().toISOString(), new Date().toISOString(), type === 'DEBIT' ? 'IGNORED_DEBIT' : 'UNMATCHED')
}

let keySeq = 0
function record(operator, input = {}) {
  return ct.recordCashTransfer(operator, {
    idempotencyKey: 'k' + (++keySeq),
    direction: 'BANK_TO_CASH', amount: 500000, accountId: 'acc-bri', handledByName: 'Ahmad',
    bankTransactedAt: new Date(Date.now() - 3600e3).toISOString(), bankReference: 'ATM-1',
    proofBytes: jpeg(), proofMimeType: 'image/jpeg', ...input,
  })
}
const expected = async id => (await cs.recalculateCashSession(id)).expected_closing_balance

async function main() {
  await test('withdrawal from the bank account becomes cash-in of the open session only', async () => {
    const session = await cs.openCashSession('cashier', 100000)
    const res = await record('cashier')
    assert.match(res.transferNumber, /^KAS-\d{8}-[0-9A-F]{6}$/)
    assert.equal(await expected(session.id), 600000)
    const row = one('SELECT * FROM finance_cash_transfers WHERE id=?', res.id)
    assert.equal(row.account_number, '7001234567'); assert.equal(JSON.parse(row.account_snapshot).bank_name, 'BRI')
    assert.ok(objects.has(row.proof_object_key) && row.proof_object_key.startsWith('bukti-mutasi-kas/'))
    // Not a payment, not income, not a wallet movement.
    assert.equal(one('SELECT COUNT(*) n FROM finance_payments').n, 0)
    assert.equal(one('SELECT COUNT(*) n FROM finance_cooperative_income').n, 0)
    assert.equal(one('SELECT COUNT(*) n FROM finance_wallet_ledger').n, 0)
  })

  await test('idempotent replay and guards: session, account, proof reuse, time, drawer balance', async () => {
    await assert.rejects(() => record('cashier'), /Buka sesi kas/)
    const session = await cs.openCashSession('cashier', 100000)
    const bytes = jpeg()
    const input = { idempotencyKey: 'same', proofBytes: bytes, bankTransactedAt: new Date(Date.now() - 7200e3).toISOString() }
    const first = await record('cashier', input)
    const again = await record('cashier', input)
    assert.equal(again.id, first.id)
    assert.equal(one('SELECT COUNT(*) n FROM finance_cash_transfers').n, 1)
    await assert.rejects(() => record('cashier', { proofBytes: bytes }), /sudah dipakai/)
    await assert.rejects(() => record('cashier', { accountId: 'acc-old' }), /rekening Koperasi yang aktif/)
    await assert.rejects(() => record('cashier', { bankTransactedAt: new Date(Date.now() + 3600e3).toISOString() }), /masa depan/)
    await assert.rejects(() => record('cashier', { amount: 0 }), /Rupiah positif|lebih dari Rp0/)
    await assert.rejects(() => record('cashier', { amount: 1.5 }))
    await assert.rejects(() => record('cashier', { handledByName: ' ' }), /petugas yang ke bank/)
    await assert.rejects(() => record('cashier', { direction: 'CASH_TO_BANK', amount: 700000 }), /tidak cukup/)
    // The DB refuses an over-deposit even when the app check is bypassed.
    assert.throws(() => h.db.prepare(`INSERT INTO finance_cash_transfers(id,transfer_number,direction,amount,cash_session_id,operator_id,account_id,
        account_snapshot,account_number,handled_by_name,bank_transacted_at,proof_object_key,proof_hash,status,created_at)
      VALUES('x','KAS-X','CASH_TO_BANK',999999,?,'cashier','acc-bri','{}','7001234567','Ahmad','2026-11-19','k','${'a'.repeat(64)}','POSTED','2026-11-19')`)
      .run(session.id), /INSUFFICIENT_CASH/)
    // Another operator's session is not usable.
    assert.throws(() => h.db.prepare(`INSERT INTO finance_cash_transfers(id,transfer_number,direction,amount,cash_session_id,operator_id,account_id,
        account_snapshot,account_number,handled_by_name,bank_transacted_at,proof_object_key,proof_hash,status,created_at)
      VALUES('y','KAS-Y','BANK_TO_CASH',1000,?,'cashier-2','acc-bri','{}','7001234567','Ahmad','2026-11-19','k','${'b'.repeat(64)}','POSTED','2026-11-19')`)
      .run(session.id), /CASH_SESSION_NOT_OPEN/)
  })

  await test('deposit to the bank is cash-out; report and session agree', async () => {
    const session = await cs.openCashSession('cashier', 300000)
    await record('cashier', { amount: 200000 })
    await record('cashier', { direction: 'CASH_TO_BANK', amount: 450000 })
    assert.equal(await expected(session.id), 50000)
    const report = await reports.getCashSessionsReport({ page: 1, pageSize: 10 })
    const item = report.items.find(i => i.id === session.id)
    assert.equal(item.totalCashIn, 200000); assert.equal(item.totalCashOut, 450000); assert.equal(item.expectedClosingBalance, 50000)
  })

  await test('void: only recorder/admin/bendahara, reason required, session open, history kept', async () => {
    const session = await cs.openCashSession('cashier', 0)
    const res = await record('cashier', { amount: 300000 })
    await assert.rejects(() => ct.voidCashTransfer({ userId: 'cashier-2', roles: ['petugas_koperasi'] }, { id: res.id, reason: 'salah input' }), /Hanya pencatat/)
    await assert.rejects(() => ct.voidCashTransfer({ userId: 'cashier', roles: ['petugas_koperasi'] }, { id: res.id, reason: 'x' }), /Alasan/)
    await ct.voidCashTransfer({ userId: 'cashier', roles: ['petugas_koperasi'] }, { id: res.id, reason: 'salah nominal' })
    assert.equal(await expected(session.id), 0)
    assert.equal(one('SELECT status FROM finance_cash_transfers WHERE id=?', res.id).status, 'VOIDED')
    await assert.rejects(() => ct.voidCashTransfer({ userId: 'cashier', roles: ['petugas_koperasi'] }, { id: res.id, reason: 'lagi lagi' }), /sudah dibatalkan/)
    assert.throws(() => h.db.exec(`DELETE FROM finance_cash_transfers`), /CASH_TRANSFER_NO_DELETE/)
    assert.throws(() => h.db.prepare(`UPDATE finance_cash_transfers SET amount=1 WHERE id=?`).run(res.id), /IMMUTABLE|FINAL/)
    // After the session closes, a posted transfer can no longer be voided.
    const kept = await record('cashier', { amount: 100000 })
    await cs.closeCashSession(session.id, 'cashier', 100000)
    await assert.rejects(() => ct.voidCashTransfer({ userId: 'admin', roles: ['admin'] }, { id: kept.id, reason: 'terlambat' }), /sudah ditutup/)
  })

  await test('voiding a withdrawal that was already paid out is refused (no negative drawer)', async () => {
    const session = await cs.openCashSession('cashier', 0)
    const res = await record('cashier', { amount: 300000 })
    await record('cashier', { direction: 'CASH_TO_BANK', amount: 250000 })
    await assert.rejects(() => ct.voidCashTransfer({ userId: 'cashier', roles: ['petugas_koperasi'] }, { id: res.id, reason: 'salah input' }), /lebih kecil/)
    assert.equal(await expected(session.id), 50000)
  })

  await test('opening balance continues from the previous closing; a gap needs a note', async () => {
    const first = await cs.openCashSession('cashier', 100000)
    await cs.closeCashSession(first.id, 'cashier', 100000)
    await assert.rejects(() => cs.openCashSession('cashier', 80000), /berbeda dari sisa fisik sesi terakhir/)
    const second = await cs.openCashSession('cashier', 80000, 'Rp20.000 disimpan di brankas')
    assert.equal(second.previous_session_id, first.id); assert.equal(second.previous_closing_balance, 100000)
    await cs.closeCashSession(second.id, 'cashier', 80000)
    const third = await cs.openCashSession('cashier', 80000)
    assert.equal(third.previous_session_id, second.id)
    // DB guard, even if the app check is bypassed.
    assert.throws(() => h.db.prepare(`INSERT INTO finance_cash_sessions(id,session_code,operator_id,opened_at,opening_balance,expected_closing_balance,status,created_at,updated_at,previous_session_id,previous_closing_balance)
      VALUES('s-x','S-X','cashier-2','2026-11-19',5,5,'OPEN','2026-11-19','2026-11-19',?,100000)`).run(first.id), /OPENING_GAP_NOTE_REQUIRED/)
  })

  await test('withdrawal is matched to exactly one debit line of the collection account', async () => {
    await cs.openCashSession('cashier', 0)
    const res = await record('cashier')
    statementLine('debit-1', 'DEBIT', 500000)
    statementLine('debit-other-acc', 'DEBIT', 500000, '1112223334')
    statementLine('debit-other-amount', 'DEBIT', 400000)
    let rec = await ct.getCashTransferReconciliation()
    assert.deepEqual(rec.pending[0].candidates.map(c => c.id), ['debit-1'])
    assert.equal(rec.unexplainedDebits.length, 3)
    await assert.rejects(() => ct.linkCashTransferToStatement('bendahara', { cashTransferId: res.id, statementTransactionId: 'debit-other-acc', notes: 'cek struk dan mutasi' }), /tidak cocok/)
    await assert.rejects(() => ct.linkCashTransferToStatement('bendahara', { cashTransferId: res.id, statementTransactionId: 'debit-1', notes: 'pendek' }), /Catatan/)
    await ct.linkCashTransferToStatement('bendahara', { cashTransferId: res.id, statementTransactionId: 'debit-1', notes: 'Struk ATM cocok dengan mutasi 19/11' })
    rec = await ct.getCashTransferReconciliation()
    assert.equal(rec.pending.length, 0); assert.equal(rec.unexplainedDebits.length, 2); assert.equal(rec.recentMatched.length, 1)
    await assert.rejects(() => ct.voidCashTransfer({ userId: 'admin', roles: ['admin'] }, { id: res.id, reason: 'coba batal' }), /sudah dicocokkan/)
    const second = await record('cashier')
    assert.throws(() => h.db.prepare(`UPDATE finance_cash_transfers SET statement_transaction_id='debit-1',matched_by='bendahara',matched_at='x',match_notes='paksa pakai baris sama' WHERE id=?`).run(second.id), /UNIQUE|uq_finance_cash_transfers_statement/)
    assert.throws(() => h.db.prepare(`UPDATE finance_cash_transfers SET statement_transaction_id='debit-other-amount',matched_by='bendahara',matched_at='x',match_notes='paksa nominal beda' WHERE id=?`).run(second.id), /must match direction/)
  })

  await test('a credit that is a cash deposit is never booked as unallocated parent money', async () => {
    await cs.openCashSession('cashier', 1000000)
    const dep = await record('cashier', { direction: 'CASH_TO_BANK', amount: 750000 })
    statementLine('credit-dep', 'CREDIT', 750000)
    const st = one('SELECT * FROM finance_bri_statement_transactions WHERE id=?', 'credit-dep')
    const match = await matchStatementTransaction(st)
    assert.equal(match.classification, 'CASH_DEPOSIT')
    await assert.rejects(() => recordUnallocatedStatementPayment({ statementTransactionId: 'credit-dep', recordedBy: 'admin', reason: 'tidak dikenal' }), /CASH_DEPOSIT_PENDING/)
    await ct.linkCashTransferToStatement('bendahara', { cashTransferId: dep.id, statementTransactionId: 'credit-dep', notes: 'Slip setoran teller cocok' })
    await assert.rejects(() => recordUnallocatedStatementPayment({ statementTransactionId: 'credit-dep', recordedBy: 'admin', reason: 'tidak dikenal' }), /CASH_DEPOSIT_PENDING/)
    assert.throws(() => h.db.exec(`UPDATE finance_bri_statement_transactions SET match_status='UNALLOCATED_RECORDED' WHERE id='credit-dep'`), /CASH_TRANSFER_LINKED/)
  })

  await test('a credit already booked as parent money cannot be claimed as a cash deposit', async () => {
    await cs.openCashSession('cashier', 1000000)
    const dep = await record('cashier', { direction: 'CASH_TO_BANK', amount: 120000 })
    statementLine('credit-used', 'CREDIT', 120000)
    h.db.exec(`UPDATE finance_bri_statement_transactions SET match_status='UNALLOCATED_RECORDED' WHERE id='credit-used'`)
    const rec = await ct.getCashTransferReconciliation()
    assert.equal(rec.pending.find(p => p.transfer.id === dep.id).candidates.length, 0)
    await assert.rejects(() => ct.linkCashTransferToStatement('bendahara', { cashTransferId: dep.id, statementTransactionId: 'credit-used', notes: 'paksa cocokkan' }), /tidak cocok/)
  })

  await test('Kas Bank menu: list filters and per-role scope', async () => {
    const own = await cs.openCashSession('cashier', 1000000)
    const other = await cs.openCashSession('cashier-2', 1000000)
    const a = await record('cashier', { amount: 100000, bankTransactedAt: '2026-11-18T03:00:00Z' })
    await record('cashier', { direction: 'CASH_TO_BANK', amount: 50000, bankTransactedAt: '2026-11-19T03:00:00Z' })
    await record('cashier-2', { amount: 70000, bankTransactedAt: '2026-11-19T04:00:00Z' })
    await ct.voidCashTransfer({ userId: 'cashier', roles: ['petugas_koperasi'] }, { id: a.id, reason: 'salah input' })
    let list = await ct.listCashTransfers()
    assert.equal(list.total, 3); assert.equal(list.summary.bankIn, 70000); assert.equal(list.summary.bankOut, 50000)
    assert.equal(list.summary.voided, 1); assert.equal(list.summary.unmatched, 2)
    assert.ok(list.items.every(r => r.session_status === 'OPEN'))
    assert.equal((await ct.listCashTransfers({ operatorId: 'cashier' })).total, 2)
    assert.equal((await ct.listCashTransfers({ direction: 'CASH_TO_BANK' })).total, 1)
    assert.equal((await ct.listCashTransfers({ state: 'VOIDED' })).total, 1)
    assert.equal((await ct.listCashTransfers({ state: 'POSTED_UNMATCHED' })).total, 2)
    // WIB date bounds: 2026-11-19 WIB covers 2026-11-18T17:00Z .. 2026-11-19T17:00Z.
    assert.equal((await ct.listCashTransfers({ fromDate: '2026-11-19', toDate: '2026-11-19' })).total, 2)
    assert.equal((await ct.listCashTransfers({ limit: 1 })).items.length, 1)
    // Server action scope: Petugas Koperasi sees only own rows, Bendahara sees all.
    const page = h.load('app/dashboard/koperasi/kas-bank/actions.ts')
    h.state.session = { id: 'cashier', role: 'petugas_koperasi', roles: ['petugas_koperasi'], full_name: 'Kasir' }
    let data = await page.getKasBankData()
    assert.equal(data.viewer.seesAll, false); assert.equal(data.total, 2); assert.equal(data.cashSession.id, own.id)
    assert.equal(data.accounts.length, 1)
    h.state.session = { id: 'bendahara', role: 'bendahara', roles: ['bendahara'], full_name: 'Bendahara' }
    data = await page.getKasBankData({ direction: 'BANK_TO_CASH' })
    assert.equal(data.viewer.seesAll, true); assert.equal(data.total, 2); assert.equal(data.cashSession, null)
    assert.ok(other.id)
    h.state.session = { id: 'admin', role: 'admin', roles: ['admin'], full_name: 'Admin' }
  })

  console.log(`cash transfers: ${count} passed`)
}
main().catch(error => { console.error(error); process.exit(1) })
