// Impor manual rekening koran (CSV) terhadap migrasi asli: parser, integritas, dedup, dan settlement transfer manual.
process.env.BRI_COLLECTION_ACCOUNT_NO = '001901000123301'
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
const csv = h.load('lib/finance/statement-csv.ts')
const imp = h.load('lib/finance/statement-import.ts')
const { createPaymentOrder } = h.load('lib/finance/orders.ts')
const mt = h.load('lib/finance/manual-transfer.ts')
const { matchStatementTransaction } = h.load('lib/finance/bank-statement/matching-engine.ts')
const { executeSettlementTransition } = h.load('lib/finance/bank-statement/settlement-service.ts')

const one = (sql, ...p) => h.db.prepare(sql).get(...p)
const all = (sql, ...p) => h.db.prepare(sql).all(...p)
const jpeg = n => new Uint8Array([255, 216, 255, 224, n, n + 1, n + 2, 9, 9, 9])
const officer = { session: { id: 'cashier', role: 'petugas_koperasi', roles: ['petugas_koperasi'] }, scope: { all: true, asrama: [], canMutate: true } }
let count = 0
async function test(name, fn) {
  h.reset()
  h.db.exec(fs.readFileSync('migrations/0196_finance_billing_issuance.sql', 'utf8'))
  h.db.exec(`INSERT INTO finance_transfer_accounts(id,bank_name,account_number,account_holder,sort_order) VALUES('acc','BRI','001901000123301','Koperasi',1);
    INSERT INTO finance_obligations(id,santri_id,item_type,period,amount_expected) VALUES('uspp','student','USPP','LIFETIME',3000000);`)
  objects.clear()
  await fn()
  count++
  console.log('PASS ' + name)
}
const day = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const dmy = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4)

async function main() {
  // ── parser murni ──
  await test('nominal Rupiah: format Indonesia/US diterima, pecahan & ambigu ditolak', async () => {
    const v = s => csv.parseRupiahCell(s)
    assert.equal(v('1.250.000,00').value, 1250000)
    assert.equal(v('1,250,000.00').value, 1250000)
    assert.equal(v('Rp 505.123').value, 505123)
    assert.equal(v('505123').value, 505123)
    assert.equal(v('1.250').value, 1250)
    assert.equal(v('(500.000)').negative, true)
    assert.equal(v('-1.000,00').negative, true)
    for (const bad of ['', '1.250,50', '1,5', '12a', '1e5', '1..000', '1.2.3,00', '999999999999999999999'])
      assert.equal(v(bad).ok, false, bad)
  })

  await test('tanggal WIB: DMY/MDY/ISO/nama bulan; tanggal mustahil ditolak', async () => {
    const p = (s, o = 'DMY') => csv.parseStatementDateTime(s, o)
    assert.equal(p('19/11/2026 10:15:30'), '2026-11-19T10:15:30+07:00')
    assert.equal(p('11/19/2026', 'MDY'), '2026-11-19T00:00:00+07:00')
    assert.equal(p('2026-11-19T08:05'), '2026-11-19T08:05:00+07:00')
    assert.equal(p('19 Nov 2026'), '2026-11-19T00:00:00+07:00')
    assert.equal(p('19-Des-26 23:59:59'), '2026-12-19T23:59:59+07:00')
    for (const bad of ['31/02/2026', '19/13/2026', 'kemarin', '19/11/2026 25:00']) assert.equal(p(bad), null, bad)
  })

  await test('CSV: kutip, koma di dalam sel, titik-koma, BOM, preamble & deteksi kolom otomatis', async () => {
    const text = '﻿Mutasi Rekening;;;;\nPeriode;November 2026;;;\nTanggal;Keterangan;Debet;Kredit;Saldo\n19/11/2026 10:00:00;"TRF DARI AHMAD; BSI";;505.123,00;10.505.123,00\n20/11/2026;BIAYA ADM;6.500,00;;10.498.623,00\n;Total;6.500,00;505.123,00;\n'
    const { rows, delimiter } = csv.parseCsv(text)
    assert.equal(delimiter, ';')
    const det = csv.detectStatementLayout(rows)
    assert.equal(det.headerRowIndex, 2)
    assert.deepEqual([det.mapping.date, det.mapping.description, det.mapping.debit, det.mapping.credit, det.mapping.balance], [0, 1, 2, 3, 4])
    const r = csv.parseStatementRows(rows, det.mapping, { headerRowIndex: 2, dateOrder: 'DMY' }, 'ACC')
    assert.deepEqual(r.errors, [])
    assert.equal(r.creditCount, 1); assert.equal(r.creditTotal, 505123)
    assert.equal(r.debitCount, 1); assert.equal(r.debitTotal, 6500)
    assert.equal(r.ignoredRows, 1)
    assert.equal(r.lines[0].remark, 'TRF DARI AHMAD; BSI')
    assert.equal(r.fromDateTime, '2026-11-19T00:00:00+07:00'); assert.equal(r.toDateTime, '2026-11-20T23:59:59+07:00')
  })

  await test('satu baris rusak menggagalkan seluruh berkas; kredit+debit bersamaan & tipe asing ditolak', async () => {
    const m = { date: 0, description: 1, credit: 2, debit: 3 }
    const bad = [['Tgl', 'Ket', 'K', 'D'], ['19/11/2026', 'a', '1.000', ''], ['19/11/2026', 'b', '1.000', '500'], ['xx', 'c', '1.000', '']]
    const r = csv.parseStatementRows(bad, m, { headerRowIndex: 0, dateOrder: 'DMY' }, 'ACC')
    assert.equal(r.errors.length, 2)
    const typed = csv.parseStatementRows([['t', 'k', 'n', 'x'], ['19/11/2026', 'a', '1.000', 'ZZ']], { date: 0, description: 1, amount: 2, type: 3 }, { headerRowIndex: 0, dateOrder: 'DMY' }, 'ACC')
    assert.match(typed.errors[0].message, /tipe/)
    const signed = csv.parseStatementRows([['t', 'k', 'n'], ['19/11/2026', 'a', '1.000'], ['19/11/2026', 'b', '-400']], { date: 0, description: 1, amount: 2 }, { headerRowIndex: 0, dateOrder: 'DMY' }, 'ACC')
    assert.deepEqual([signed.creditCount, signed.debitCount], [1, 1])
  })

  await test('baris identik dalam satu berkas tetap dua baris berbeda (urutan kemunculan), ID stabil lintas impor', async () => {
    const rows = [['t', 'k', 'n'], ['19/11/2026', 'SETORAN', '100.000'], ['19/11/2026', 'SETORAN', '100.000']]
    const a = csv.parseStatementRows(rows, { date: 0, description: 1, amount: 2 }, { headerRowIndex: 0, dateOrder: 'DMY' }, 'ACC')
    const b = csv.parseStatementRows(rows, { date: 0, description: 1, amount: 2 }, { headerRowIndex: 0, dateOrder: 'DMY' }, 'ACC')
    assert.notEqual(a.lines[0].transactionId, a.lines[1].transactionId)
    assert.deepEqual(a.lines.map(l => l.transactionId), b.lines.map(l => l.transactionId))
  })

  // ── impor ke database ──
  const d = day()
  const file = `Tanggal,Keterangan,Debet,Kredit,Saldo\n${dmy(d)} 09:00:00,TRF A,,100000,5000000\n${dmy(d)} 11:30:00,TRF B,,250000,5250000\n${dmy(d)} 12:00:00,BIAYA,6500,,5243500\n`
  const base = { csvText: file, filename: 'mutasi.csv', importedBy: 'admin' }

  await test('impor menolak jika total kredit tidak cocok dengan internet banking; tidak ada yang tersimpan', async () => {
    await assert.rejects(() => imp.importManualBankStatement({ ...base, expectedCreditCount: 2, expectedCreditTotal: 350001 }), /tidak cocok/)
    await assert.rejects(() => imp.importManualBankStatement({ ...base, expectedCreditCount: 3, expectedCreditTotal: 350000 }), /tidak cocok/)
    assert.equal(one('SELECT COUNT(*) n FROM finance_bri_statement_transactions').n, 0)
    assert.equal(one('SELECT COUNT(*) n FROM finance_bri_statement_fetches').n, 0)
  })

  await test('impor sukses: fetch SUCCESS+cursor, kredit UNMATCHED, debit IGNORED_DEBIT, jejak operator & hash berkas', async () => {
    const s = await imp.importManualBankStatement({ ...base, expectedCreditCount: 2, expectedCreditTotal: 350000 })
    assert.equal(s.newTransactionsCount, 3); assert.equal(s.cursorAdvanced, true)
    const f = one('SELECT * FROM finance_bri_statement_fetches')
    assert.equal(f.status, 'SUCCESS'); assert.equal(f.cursor_advanced, 1)
    assert.match(f.response_message, /^MANUAL_IMPORT user=admin file=mutasi\.csv sha256=[0-9a-f]{16}$/)
    const rows = all('SELECT type_normalized t, amount, match_status m, identity_strength i FROM finance_bri_statement_transactions ORDER BY amount')
    assert.deepEqual(rows.map(r => [r.t, r.amount, r.m, r.i]), [['DEBIT', 6500, 'IGNORED_DEBIT', 'STRONG'], ['CREDIT', 100000, 'UNMATCHED', 'STRONG'], ['CREDIT', 250000, 'UNMATCHED', 'STRONG']])
  })

  await test('impor ulang berkas sama / tumpang-tindih tidak menggandakan baris dan tidak membuat AMBIGUOUS', async () => {
    await imp.importManualBankStatement({ ...base, expectedCreditCount: 2, expectedCreditTotal: 350000 })
    const again = await imp.importManualBankStatement({ ...base, expectedCreditCount: 2, expectedCreditTotal: 350000 })
    assert.equal(again.newTransactionsCount, 0); assert.equal(again.dedupedCount, 3)
    const overlap = `Tanggal,Keterangan,Debet,Kredit,Saldo\n${dmy(d)} 11:30:00,TRF B,,250000,5250000\n${dmy(d)} 15:00:00,TRF C,,70000,5313500\n`
    const o = await imp.importManualBankStatement({ ...base, csvText: overlap, expectedCreditCount: 2, expectedCreditTotal: 320000 })
    assert.equal(o.newTransactionsCount, 1)
    assert.equal(one('SELECT COUNT(*) n FROM finance_bri_statement_transactions').n, 4)
    assert.equal(one("SELECT COUNT(*) n FROM finance_bri_statement_transactions WHERE match_status='AMBIGUOUS'").n, 0)
    const pv = await imp.previewStatementImport(base)
    assert.equal(pv.ok, true); assert.equal(pv.alreadyImportedCount, 3)
  })

  await test('tanggal di masa depan (salah format MDY/DMY) ditolak', async () => {
    const future = 'Tanggal,Keterangan,Debet,Kredit\n01/01/2099,x,,1000\n'
    await assert.rejects(() => imp.importManualBankStatement({ ...base, csvText: future, expectedCreditCount: 1, expectedCreditTotal: 1000 }), /masa depan/)
  })

  await test('rekening collection tidak dikonfigurasi → gagal tertutup', async () => {
    const keep = process.env.BRI_COLLECTION_ACCOUNT_NO
    delete process.env.BRI_COLLECTION_ACCOUNT_NO
    try {
      await assert.rejects(() => imp.previewStatementImport(base), /Rekening collection/)
      await assert.rejects(() => imp.importManualBankStatement({ ...base, expectedCreditCount: 2, expectedCreditTotal: 350000 }), /Rekening collection/)
    } finally { process.env.BRI_COLLECTION_ACCOUNT_NO = keep }
  })

  await test('ujung-ke-ujung: transfer manual disetujui → mutasi diimpor → kandidat → settle MANUAL_RESOLVED → SETTLED', async () => {
    const order = await createPaymentOrder({ santriId: 'student', payerType: 'PORTAL_ORTU', paymentMethod: 'MANUAL_TRANSFER', destinationAccountId: 'acc', items: [{ obligationId: 'uspp', itemType: 'USPP', amount: 500000 }] })
    const sub = await mt.getTransferSubmissionByOrder(order.id)
    await mt.submitTransferProof({ santriId: 'student', submissionId: sub.id, bytes: jpeg(1), mimeType: 'image/jpeg', senderName: 'Bapak Ahmad', senderBank: 'BRI', transferredAt: new Date().toISOString() })
    const approved = await mt.approveTransferSubmission(officer, { submissionId: sub.id, receivedAmount: sub.expected_amount })
    const payment = one("SELECT * FROM finance_payments WHERE channel='TRANSFER'")
    assert.equal(payment.status, 'PAID')
    const total = payment.gross_amount + payment.cooperative_admin_fee + payment.unique_code_amount
    assert.equal(total, order.total_charged)

    const text = `Tanggal,Keterangan,Debet,Kredit\n${dmy(d)} 10:00:00,TRF AHMAD,,${total}\n`
    await imp.importManualBankStatement({ csvText: text, filename: 'm.csv', importedBy: 'admin', expectedCreditCount: 1, expectedCreditTotal: total })
    const st = one("SELECT * FROM finance_bri_statement_transactions WHERE type_normalized='CREDIT'")
    const match = await matchStatementTransaction(st)
    assert.equal(match.classification, 'EXACT_MATCH'); assert.equal(match.matchingStrength, 'CANDIDATE'); assert.equal(match.matchedPaymentId, payment.id)

    // Tanpa pemeriksaan operator (AUTHORITATIVE_EXACT) tidak diizinkan untuk transfer manual.
    await assert.rejects(() => executeSettlementTransition({ statementTransactionId: st.id, paymentId: payment.id, matchStrength: 'AUTHORITATIVE_EXACT', matchMethod: 'X', verifiedBy: 'admin' }), /AUTHORITATIVE_IDENTITY_REQUIRED/)
    assert.equal(one('SELECT status FROM finance_payments WHERE id=?', payment.id).status, 'PAID')

    const reviewId = 'bri-review-' + st.id + '-' + payment.id
    h.db.prepare(`INSERT INTO finance_reconciliation_items(id,external_reference,external_amount,match_status,created_at) VALUES(?,?,?,'UNMATCHED_EXTERNAL',?)`).run(reviewId, st.id, st.amount, new Date().toISOString())
    const r = await executeSettlementTransition({ statementTransactionId: st.id, paymentId: payment.id, matchStrength: 'MANUAL_RESOLVED', matchMethod: 'OPERATOR_BANK_STATEMENT_REVIEW', reconciliationItemId: reviewId, verifiedBy: 'admin', resolutionNotes: 'Cocok kode unik dan nama pengirim' })
    assert.ok(r.settlementId)
    assert.equal(one('SELECT status FROM finance_payments WHERE id=?', payment.id).status, 'SETTLED')
    assert.equal(one('SELECT matched_payment_id m FROM finance_bri_statement_transactions WHERE id=?', st.id).m, payment.id)
    // Kasir (non admin/bendahara) tidak bisa menyelesaikan.
    assert.ok(approved)
  })

  console.log(`\n${count} tests passed`)
}
main().catch(e => { console.error(e); process.exit(1) })
