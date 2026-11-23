// NOTIF-5: approval notices (perizinan, setoran SPP, santri keluar), scheduled reminders, and the
// scanner dedupe-key regression. Notification fixture for routing; finance fixture for reminders.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { load, notifHarness } = require('./notifications-fixture.cjs')

const ap = load('lib/notifications/approval-events.ts')
const { processOutbox } = load('lib/notifications/dispatch.ts')
const { runSourceScans } = load('lib/notifications/scans.ts')
const fe = load('lib/notifications/finance-events.ts')
const { saveEventConfig } = load('lib/notifications/config.ts')
const { requireEventDefinition } = load('lib/notifications/catalog.ts')

const h = notifHarness()
let db = h.db
const run = statements => { for (const s of statements) db.prepare(s.sql).run(...s.params) }
const recipients = code => db.prepare(`SELECT n.recipient_id id, n.title, n.body, n.link FROM notifications n WHERE n.event_code = ? ORDER BY n.recipient_id`).all(code)
const outboxCount = code => db.prepare('SELECT COUNT(*) n FROM notif_outbox WHERE event_code = ?').get(code).n

function setup() {
  h.reset(); db = h.db; fe.resetNotificationSchemaCache()
  db.exec(`
    INSERT INTO users(id, full_name, role, roles, asrama_binaan) VALUES
      ('u-dewan','Dewan','dewan_santri','["dewan_santri"]',NULL),
      ('u-asrama-b','Pengurus B','pengurus_asrama','["pengurus_asrama"]','ASRAMA B'),
      ('u-sekpen','Sekpen','sekpen','["sekpen"]',NULL);
    CREATE TABLE perizinan_pengajuan(id TEXT PRIMARY KEY, santri_id TEXT, jenis TEXT, alasan TEXT, status TEXT, submitted_by TEXT);
    CREATE TABLE spp_setoran(id TEXT PRIMARY KEY, asrama TEXT, unit_setor TEXT, bulan INTEGER, tahun INTEGER, jumlah_aktual INTEGER, status TEXT, tujuan_setoran TEXT);
    CREATE TABLE santri_keluar_tandai(id TEXT PRIMARY KEY, santri_id TEXT, status TEXT, ditandai_oleh TEXT, created_at TEXT, updated_at TEXT);
    INSERT INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan) VALUES
      ('Keuangan','Setoran','/dashboard/dewan-santri/setoran','LayoutList','["admin","dewan_santri"]',1,3),
      ('Keuangan','SPP','/dashboard/asrama/spp','CreditCard','["admin","pengurus_asrama"]',1,4),
      ('Kesantrian','Santri Keluar','/dashboard/santri/keluar','UserX','["admin","sekpen","dewan_santri"]',1,5),
      ('Asrama','Kamar','/dashboard/asrama/kamar','Bed','["admin","pengurus_asrama"]',1,6);
    UPDATE fitur_akses SET roles='["admin","dewan_santri","pengurus_asrama"]' WHERE href='/dashboard/keamanan/perizinan';`)
}
let count = 0
async function test(name, fn) { setup(); await fn(); count++; console.log('PASS ' + name) }

async function main() {
  await test('izin submitted → dewan santri + admin (not the submitting pengurus); decided → only the submitter', async () => {
    db.exec("INSERT INTO perizinan_pengajuan VALUES ('iz-1','s-1','PULANG','Acara keluarga','PENDING','u-asrama-a')")
    run(ap.izinSubmittedNotices({ pengajuanId: 'iz-1', santriId: 's-1', namaSantri: 'Ahmad', asrama: 'ASRAMA A', jenis: 'PULANG', alasan: 'Acara keluarga', actorId: 'u-asrama-a' }))
    db.exec("UPDATE perizinan_pengajuan SET status='APPROVED' WHERE id='iz-1'")
    run(ap.izinDecidedNotices({ pengajuanId: 'iz-1', namaSantri: 'Ahmad', jenis: 'PULANG', alasan: 'Acara keluarga', submittedBy: 'u-asrama-a', decision: 'APPROVED' }))
    await processOutbox(h.store)
    assert.deepEqual(recipients('STAFF_IZIN_DIAJUKAN').map(r => r.id), ['u-admin', 'u-dewan'])
    assert.match(recipients('STAFF_IZIN_DIAJUKAN')[0].body, /izin pulang \(Acara keluarga\)/)
    const decided = recipients('STAFF_IZIN_DIPUTUSKAN')
    assert.deepEqual(decided.map(r => r.id), ['u-asrama-a'])
    assert.equal(decided[0].title, 'Pengajuan Izin disetujui')
    assert.equal(decided[0].link, '/dashboard/keamanan/perizinan')
  })

  await test('decision notice is guarded by the decided status (no notice when another reviewer got there first)', async () => {
    db.exec("INSERT INTO perizinan_pengajuan VALUES ('iz-2','s-1','KELUAR_KOMPLEK',NULL,'REJECTED','u-asrama-a')")
    run(ap.izinDecidedNotices({ pengajuanId: 'iz-2', namaSantri: 'Ahmad', jenis: 'KELUAR_KOMPLEK', alasan: null, submittedBy: 'u-asrama-a', decision: 'APPROVED' }))
    assert.equal(outboxCount('STAFF_IZIN_DIPUTUSKAN'), 0)
    assert.deepEqual(ap.izinDecidedNotices({ pengajuanId: 'iz-2', namaSantri: 'x', jenis: 'PULANG', alasan: null, submittedBy: null, decision: 'REJECTED' }), [])
  })

  await test('setoran routes by destination; confirmation reaches only the pengurus of that unit; spaced unit names work', async () => {
    db.exec(`INSERT INTO spp_setoran VALUES ('st-1','ASRAMA A','ASRAMA A',7,2026,1500000,'menunggu_konfirmasi','BENDAHARA_PUSAT'),
      ('st-2','ASRAMA B','ASRAMA B',11,2026,900000,'menunggu_konfirmasi','DEWAN_SANTRI')`)
    db.exec("UPDATE users SET roles='[\"bendahara\"]', role='bendahara' WHERE id='u-bendahara'")
    db.exec(`INSERT INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan) VALUES ('Keuangan','SPP Baru','/dashboard/keuangan/setoran-spp-baru','Coins','["admin","bendahara"]',1,7)`)
    run(ap.setoranSubmittedNotices({ unit: 'ASRAMA A', tahun: 2026, bulan: 7, jumlah: 1500000, tujuan: 'BENDAHARA_PUSAT', actorId: 'u-asrama-a', stamp: '2026-11-23T01:00:00.000Z' }))
    run(ap.setoranSubmittedNotices({ unit: 'ASRAMA B', tahun: 2026, bulan: 11, jumlah: 900000, tujuan: 'DEWAN_SANTRI', actorId: 'u-asrama-b', stamp: '2026-11-23T01:00:00.000Z' }))
    db.exec("UPDATE spp_setoran SET status='dikonfirmasi'")
    run(ap.setoranConfirmedNotices({ unit: 'ASRAMA A', tahun: 2026, bulan: 7, jumlah: 1500000, tujuan: 'BENDAHARA_PUSAT', actorId: 'u-bendahara', stamp: '2026-11-23T02:00:00.000Z' }))
    run(ap.setoranConfirmedNotices({ unit: 'ASRAMA B', tahun: 2026, bulan: 11, jumlah: 900000, tujuan: 'DEWAN_SANTRI', actorId: 'u-dewan', stamp: '2026-11-23T02:00:00.000Z' }))
    await processOutbox(h.store)
    assert.deepEqual(recipients('STAFF_SETORAN_SPP_MENUNGGU').map(r => r.id), ['u-admin', 'u-bendahara'])
    assert.deepEqual(recipients('STAFF_SETORAN_DEWAN_MENUNGGU').map(r => r.id), ['u-admin', 'u-dewan'])
    const confirmed = db.prepare(`SELECT n.recipient_id id, n.body FROM notifications n WHERE event_code='STAFF_SETORAN_SPP_DIKONFIRMASI' ORDER BY id`).all()
    assert.deepEqual(confirmed.map(r => r.id), ['u-asrama-a', 'u-asrama-b'])
    assert.match(confirmed[0].body, /Juli 2026 sebesar Rp1\.500\.000 sudah dikonfirmasi Bendahara Pesantren/)
    assert.match(confirmed[1].body, /Dewan Santri/)
    assert.ok(ap.setoranSubmittedNotices({ unit: 'UNIT DUA KATA', tahun: 2026, bulan: 1, jumlah: 1, tujuan: 'DEWAN_SANTRI', actorId: null, stamp: '2026-01-01T00:00:00.000Z' })[0].params[2].includes('UNIT_DUA_KATA'))
  })

  await test('santri keluar: submission → santri-keluar approvers; decision → the marking pengurus with the note', async () => {
    const stamp = '2026-11-23T03:00:00.000Z'
    db.prepare("INSERT INTO santri_keluar_tandai VALUES ('k-1','s-1','pending','u-asrama-a',?,NULL)").run(stamp)
    run(ap.keluarSubmittedNotices({ pengajuanId: 'k-1', namaSantri: 'Ahmad', asrama: 'ASRAMA A', actorId: 'u-asrama-a', stamp }))
    db.exec("UPDATE santri_keluar_tandai SET status='ditolak'")
    run(ap.keluarDecidedNotices({ pengajuanId: 'k-1', namaSantri: 'Ahmad', submittedBy: 'u-asrama-a', decision: 'ditolak', catatan: 'Dokumen belum lengkap' }))
    run(ap.keluarDecidedNotices({ pengajuanId: 'k-1', namaSantri: 'Ahmad', submittedBy: 'u-asrama-a', decision: 'disetujui' }))
    await processOutbox(h.store)
    assert.deepEqual(recipients('STAFF_SANTRI_KELUAR_DIAJUKAN').map(r => r.id), ['u-admin', 'u-dewan', 'u-sekpen'])
    const decided = recipients('STAFF_SANTRI_KELUAR_DIPUTUSKAN')
    assert.deepEqual(decided.map(r => [r.id, r.title]), [['u-asrama-a', 'Pengajuan Santri Keluar ditolak']])
    assert.match(decided[0].body, /Catatan: Dokumen belum lengkap/)
  })

  await test('scanner keys tolerate SQLite datetime() values with spaces (BRIVA anomaly regression)', async () => {
    db.exec(`CREATE TABLE finance_bri_recovery_queue(id TEXT PRIMARY KEY, recovery_status TEXT, reason TEXT, created_at TEXT);
      CREATE TABLE finance_reconciliation_items(id TEXT, match_status TEXT, created_at TEXT);
      CREATE TABLE finance_billing_issues(period TEXT, status TEXT, updated_at TEXT);`)
    await runSourceScans(h.store) // initialize cursors
    db.exec("INSERT INTO finance_bri_recovery_queue VALUES ('q1','DISCREPANCY','CALLBACK_IDENTIFIER_CONFLICT_REQUIRES_REVIEW','2026-11-23 04:05:06')")
    const r = await runSourceScans(h.store)
    assert.equal(r.find(x => x.source === 'finance_bri_recovery_queue').error, undefined)
    assert.equal(outboxCount('STAFF_BRIVA_ANOMALI'), 1)
    await runSourceScans(h.store)
    assert.equal(outboxCount('STAFF_BRIVA_ANOMALI'), 1)
  })

  await reminderTests()
  console.log(`\n${count} approval & reminder tests passed`)
}

// ── Reminders against the real finance schema ────────────────────────────
async function reminderTests() {
  const { harness } = require('./finance-remediation-fixture.cjs')
  const fh = harness()
  fh.state.productionDB = {}
  const { createPaymentOrder } = fh.load('lib/finance/orders.ts')
  const { runReminders } = fh.load('lib/notifications/reminders.ts')
  const fe2 = fh.load('lib/notifications/finance-events.ts')
  const cfg = fh.load('lib/notifications/config.ts')
  const def = fh.load('lib/notifications/catalog.ts').requireEventDefinition('PORTAL_PENGINGAT_TUNGGAKAN')
  const outbox = code => fh.db.prepare('SELECT dedupe_key, payload_json FROM notif_outbox WHERE event_code = ? ORDER BY dedupe_key').all(code).map(r => ({ key: r.dedupe_key, ...JSON.parse(r.payload_json) }))
  function fsetup() {
    fh.reset(); fe2.resetNotificationSchemaCache()
    fh.db.exec(fs.readFileSync('migrations/0196_finance_billing_issuance.sql', 'utf8'))
    fh.db.exec(fs.readFileSync('migrations/0202_notifications.sql', 'utf8'))
    fh.db.exec("INSERT INTO finance_transfer_accounts(id,bank_name,account_number,account_holder,sort_order) VALUES('acc','BSI','1','K',1)")
  }
  async function ftest(name, fn) { fsetup(); await fn(); count++; console.log('PASS ' + name) }

  await ftest('transfer reminder fires once inside the last 3 hours, never for short-lived or already-reviewed orders', async () => {
    const order = await createPaymentOrder({ santriId: 'student', payerType: 'PORTAL_ORTU', paymentMethod: 'MANUAL_TRANSFER', destinationAccountId: 'acc', items: [{ itemType: 'UANG_JAJAN', amount: 50000 }] })
    const expires = new Date(order.expires_at)
    assert.equal((await runReminders(fh.adapter, new Date(expires.getTime() - 5 * 3600_000))).transferExpiring, 0, 'too early')
    const inside = new Date(expires.getTime() - 2 * 3600_000)
    assert.equal((await runReminders(fh.adapter, inside)).transferExpiring, 1)
    assert.equal((await runReminders(fh.adapter, new Date(inside.getTime() + 600_000))).transferExpiring, 0, 'once per order')
    const [row] = outbox('PORTAL_TRANSFER_AKAN_KEDALUWARSA')
    assert.deepEqual({ santri: row.santri_id, batas: row.batas_waktu }, { santri: 'student', batas: order.expires_at })
    assert.equal((await runReminders(fh.adapter, new Date(expires.getTime() + 60_000))).transferExpiring, 0, 'expired orders are not reminded')
  })

  await ftest('arrears reminder: disabled by default; once enabled, once per santri per month from the set day', async () => {
    fh.db.exec(`INSERT INTO finance_obligations(id,santri_id,item_type,period,amount_expected,amount_paid,status) VALUES
      ('spp-sep','student','SPP','2026-09',150000,0,'UNPAID'),
      ('makan-oct','student','UANG_MAKAN','2026-10',300000,100000,'PARTIALLY_PAID'),
      ('spp-nov','student','SPP','2026-11',150000,0,'UNPAID'),
      ('uspp','student','USPP','LIFETIME',3000000,0,'UNPAID'),
      ('paid','other','SPP','2026-09',150000,150000,'PAID')`)
    const day10 = new Date('2026-11-10T02:00:00Z') // 09.00 WIB
    assert.equal((await runReminders(fh.adapter, day10)).arrears, 0, 'event disabled by default')
    await cfg.saveEventConfig(fh.adapter, def.code, { enabled: true, mandatory: false, channels: def.defaultChannels, title: def.title, inApp: def.inApp, push: def.push, pushPrivacy: 'MASKED' }, 'admin')
    assert.equal((await runReminders(fh.adapter, new Date('2026-11-09T02:00:00Z'))).arrears, 0, 'before the configured day')
    assert.equal((await runReminders(fh.adapter, new Date('2026-11-10T00:30:00Z'))).arrears, 0, 'before 08.00 WIB')
    const r = await runReminders(fh.adapter, day10)
    assert.equal(r.arrears, 1); assert.equal(r.arrearsMonth, '2026-11')
    const [row] = outbox('PORTAL_PENGINGAT_TUNGGAKAN')
    assert.deepEqual({ santri: row.santri_id, jumlah: row.jumlah, total: row.total }, { santri: 'student', jumlah: 2, total: 350000 },
      'only past monthly bills, remaining amount, current month & USPP excluded')
    assert.equal((await runReminders(fh.adapter, new Date('2026-11-20T02:00:00Z'))).arrears, 0, 'once per month')
    fh.db.exec("INSERT OR REPLACE INTO app_settings(key,value) VALUES('notifications_arrears_day','5')")
    assert.equal((await runReminders(fh.adapter, new Date('2026-12-05T02:00:00Z'))).arrears, 1, 'next month, configured day')
  })
}

main().catch(error => { console.error(error); process.exitCode = 1 })
