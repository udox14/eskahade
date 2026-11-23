// NOTIF-6: broadcast validation, chunked fan-out (multi-chunk, concurrent, scheduled, cancelled),
// audience routing, push queueing, and retention purge — against the real 0202 migration.
const assert = require('node:assert/strict')
const { load, notifHarness } = require('./notifications-fixture.cjs')

const bc = load('lib/notifications/broadcast.ts')
const { runRetention } = load('lib/notifications/retention.ts')
const { listInbox, setPreference } = load('lib/notifications/inbox.ts')

const h = notifHarness()
const store = h.store
let db = h.db
let count = 0
async function test(name, fn) { h.reset(); db = h.db; await fn(); count++; console.log('PASS ' + name) }
const push = { webpush: { publicKey: 'x', privateKey: 'y', subject: 'mailto:a@b.c' }, fcm: null }
const NOW = new Date('2026-11-23T03:00:00.000Z')

async function main() {
  await test('validation: lengths, internal links only, schedule window, non-empty audience', async () => {
    const ok = { title: 'Libur semester', body: 'Santri pulang tanggal 20 Desember.', audience: { kind: 'PARENTS_ALL' }, channels: [] }
    assert.equal(bc.normalizeBroadcast(ok, NOW).channels[0], 'in_app', 'in-app always on')
    assert.throws(() => bc.normalizeBroadcast({ ...ok, title: 'ab' }, NOW), /Judul/)
    assert.throws(() => bc.normalizeBroadcast({ ...ok, body: 'x'.repeat(501) }, NOW), /maksimal 500/)
    assert.throws(() => bc.normalizeBroadcast({ ...ok, link: 'https://evil.test' }, NOW), /di dalam aplikasi/)
    assert.equal(bc.normalizeBroadcast({ ...ok, link: '/portal-ortu/tagihan' }, NOW).link, '/portal-ortu/tagihan')
    assert.throws(() => bc.normalizeBroadcast({ ...ok, scheduledAt: '2026-11-22T00:00:00Z' }, NOW), /sudah lewat/)
    assert.throws(() => bc.normalizeBroadcast({ ...ok, scheduledAt: '2027-03-01T00:00:00Z' }, NOW), /60 hari/)
    assert.throws(() => bc.normalizeBroadcast({ ...ok, audience: { kind: 'PARENTS_ASRAMA', asrama: [] } }, NOW), /asrama/)
    assert.throws(() => bc.normalizeBroadcast({ ...ok, audience: { kind: 'STAFF_ROLES', roles: ['bad role!'] } }, NOW), /role/)
    assert.throws(() => bc.normalizeBroadcast({ ...ok, audience: { kind: 'EVERYONE' } }, NOW), /tidak dikenal/)
  })

  await test('multi-chunk fan-out reaches every active santri exactly once, then SENT with the right count', async () => {
    const insert = db.prepare("INSERT INTO santri(id, nama_lengkap, asrama, status_global) VALUES (?, ?, 'ASRAMA A', ?)")
    for (let i = 0; i < 450; i++) insert.run(`x-${String(i).padStart(4, '0')}`, 'S' + i, i === 7 ? 'keluar' : 'aktif')
    assert.equal(await bc.estimateAudience(store, { kind: 'PARENTS_ALL' }), 451)
    const { id } = await bc.createBroadcast(store, { title: 'Pengumuman', body: 'Isi pengumuman', audience: { kind: 'PARENTS_ALL' }, channels: ['in_app'] }, 'u-admin', NOW)
    const r = await bc.processBroadcasts(store, null, { at: NOW })
    assert.equal(r.completed, 1)
    const row = db.prepare('SELECT status, recipient_count FROM notif_broadcasts WHERE id = ?').get(id)
    assert.deepEqual({ ...row }, { status: 'SENT', recipient_count: 451 })
    assert.equal(db.prepare('SELECT COUNT(DISTINCT recipient_id) n FROM notifications WHERE broadcast_id = ?').get(id).n, 451)
    assert.equal(db.prepare("SELECT COUNT(*) n FROM notifications WHERE recipient_id = 'x-0007'").get().n, 0, 'inactive santri excluded')
    assert.equal((await bc.processBroadcasts(store, null, { at: NOW })).claimed, 0)
  })

  await test('concurrent runners never duplicate recipients', async () => {
    const insert = db.prepare("INSERT INTO santri(id, nama_lengkap, asrama) VALUES (?, 'S', 'ASRAMA B')")
    for (let i = 0; i < 520; i++) insert.run(`y-${String(i).padStart(4, '0')}`)
    const { id } = await bc.createBroadcast(store, { title: 'Pengumuman', body: 'Isi', audience: { kind: 'PARENTS_ALL' }, channels: ['in_app'] }, 'u-admin', NOW)
    await Promise.all([bc.processBroadcasts(store, null, { at: NOW, maxChunks: 1 }), bc.processBroadcasts(store, null, { at: NOW, maxChunks: 1 }),
      bc.processBroadcasts(store, null, { at: NOW, maxChunks: 1 })])
    for (let i = 0; i < 6; i++) await bc.processBroadcasts(store, null, { at: NOW })
    const n = db.prepare('SELECT COUNT(*) n, COUNT(DISTINCT recipient_id) d FROM notifications WHERE broadcast_id = ?').get(id)
    assert.equal(n.n, n.d)
    assert.equal(n.n, 522)
    assert.equal(db.prepare('SELECT status FROM notif_broadcasts WHERE id = ?').get(id).status, 'SENT')
  })

  await test('scheduled broadcast waits for its time; cancel works only before sending; pause holds everything', async () => {
    const later = await bc.createBroadcast(store, { title: 'Nanti', body: 'Isi', audience: { kind: 'PARENTS_ALL' }, channels: ['in_app'], scheduledAt: '2026-11-24T00:00:00Z' }, 'u-admin', NOW)
    assert.equal((await bc.processBroadcasts(store, null, { at: NOW })).claimed, 0)
    await bc.cancelBroadcast(store, later.id)
    assert.equal((await bc.processBroadcasts(store, null, { at: new Date('2026-11-25T00:00:00Z') })).claimed, 0)
    const now = await bc.createBroadcast(store, { title: 'Sekarang', body: 'Isi', audience: { kind: 'PARENTS_ALL' }, channels: ['in_app'] }, 'u-admin', NOW)
    db.exec("UPDATE app_settings SET value='0' WHERE key='notifications_enabled'")
    assert.equal((await bc.processBroadcasts(store, null, { at: NOW })).claimed, 0, 'paused')
    db.exec("UPDATE app_settings SET value='1' WHERE key='notifications_enabled'")
    await bc.processBroadcasts(store, null, { at: NOW })
    await assert.rejects(() => bc.cancelBroadcast(store, now.id), /tidak bisa dibatalkan/)
  })

  await test('audiences: asrama filter, staff roles (tester excluded), specific users; mute does not hide announcements', async () => {
    await setPreference(store, { kind: 'SANTRI', id: 's-2' }, 'pembayaran', false)
    const run = async audience => {
      const { id } = await bc.createBroadcast(store, { title: 'Pengumuman', body: 'Isi', audience, channels: ['in_app'] }, 'u-admin', NOW)
      await bc.processBroadcasts(store, null, { at: NOW })
      return db.prepare('SELECT recipient_kind k, recipient_id id FROM notifications WHERE broadcast_id = ? ORDER BY id').all(id).map(r => `${r.k}:${r.id}`)
    }
    assert.deepEqual(await run({ kind: 'PARENTS_ASRAMA', asrama: ['asrama b'] }), ['SANTRI:s-2'])
    assert.deepEqual(await run({ kind: 'STAFF_ROLES', roles: ['bendahara', 'petugas_koperasi'] }), ['USER:u-bendahara', 'USER:u-petugas-a', 'USER:u-petugas-b'])
    assert.deepEqual(await run({ kind: 'STAFF_USERS', userIds: ['u-pimpinan', 'nobody'] }), ['USER:u-pimpinan'])
    const inbox = await listInbox(store, { kind: 'SANTRI', id: 's-2' })
    assert.equal(inbox.items[0].category_label, 'Pengumuman')
  })

  await test('push is queued per recipient device only when the broadcast asks for it and push is active', async () => {
    db.exec(`INSERT INTO notif_devices(id, channel, endpoint_or_token, p256dh, auth) VALUES ('dev-1','WEBPUSH','https://fcm.googleapis.com/fcm/send/1','k','a'),
      ('dev-2','WEBPUSH','https://fcm.googleapis.com/fcm/send/2','k','a');
      INSERT INTO notif_devices(id, channel, endpoint_or_token, p256dh, auth, is_active) VALUES ('dev-3','WEBPUSH','https://fcm.googleapis.com/fcm/send/3','k','a',0);
      INSERT INTO notif_device_links(device_id, owner_kind, owner_id) VALUES ('dev-1','SANTRI','s-1'),('dev-2','SANTRI','s-2'),('dev-3','SANTRI','s-1');
      UPDATE app_settings SET value='1' WHERE key='notifications_push_enabled';`)
    const a = await bc.createBroadcast(store, { title: 'Dengan push', body: 'Isi', audience: { kind: 'PARENTS_ALL' }, channels: ['in_app', 'webpush'] }, 'u-admin', NOW)
    const b = await bc.createBroadcast(store, { title: 'Tanpa push', body: 'Isi', audience: { kind: 'PARENTS_ALL' }, channels: ['in_app'] }, 'u-admin', NOW)
    await bc.processBroadcasts(store, push, { at: NOW })
    const q = id => db.prepare('SELECT d.device_id FROM notif_deliveries d JOIN notifications n ON n.id = d.notification_id WHERE n.broadcast_id = ? ORDER BY d.device_id').all(id).map(r => r.device_id)
    assert.deepEqual(q(a.id), ['dev-1', 'dev-2'], 'inactive device skipped')
    assert.deepEqual(q(b.id), [])
  })

  await test('retention purges only old notification data, keeps pending work, runs once per day', async () => {
    const old = '2026-01-01T00:00:00.000Z', recent = '2026-11-20T00:00:00.000Z'
    db.exec(`INSERT INTO notif_outbox(id, event_code, dedupe_key, status, created_at) VALUES ('o-old','PORTAL_TRANSFER_DITERIMA','k-old','DONE','${old}'),
        ('o-new','PORTAL_TRANSFER_DITERIMA','k-new','DONE','${recent}'), ('o-pend','PORTAL_TRANSFER_DITERIMA','k-pend','PENDING','${old}');
      INSERT INTO notifications(id, recipient_kind, recipient_id, event_code, category, outbox_id, title, body, created_at) VALUES
        ('n-old','SANTRI','s-1','X','pembayaran','o-old','t','b','${old}'), ('n-new','SANTRI','s-1','X','pembayaran','o-new','t','b','${recent}');
      INSERT INTO notif_deliveries(id, notification_id, device_id, channel, status, created_at) VALUES
        ('d-old','n-old','dv','WEBPUSH','SENT','2026-08-01T00:00:00.000Z'), ('d-pend','n-old','dv2','WEBPUSH','PENDING','2026-08-01T00:00:00.000Z'),
        ('d-new','n-new','dv','WEBPUSH','SENT','${recent}');
      INSERT INTO notif_devices(id, channel, endpoint_or_token, p256dh, auth, is_active, last_seen_at) VALUES
        ('dead','WEBPUSH','https://fcm.googleapis.com/fcm/send/dead','k','a',0,'2026-01-01T00:00:00.000Z'),
        ('alive','WEBPUSH','https://fcm.googleapis.com/fcm/send/alive','k','a',1,'2026-01-01T00:00:00.000Z');
      INSERT INTO notif_device_links(device_id, owner_kind, owner_id) VALUES ('dead','SANTRI','s-1'),('alive','SANTRI','s-1');`)
    const r = await runRetention(store, NOW)
    assert.ok(r.ran && r.complete)
    const ids = table => db.prepare(`SELECT id FROM ${table} ORDER BY id`).all().map(x => x.id)
    assert.deepEqual(ids('notif_outbox'), ['o-new', 'o-pend'])
    assert.deepEqual(ids('notifications'), ['n-new'])
    assert.deepEqual(ids('notif_deliveries'), ['d-new', 'd-pend'])
    assert.deepEqual(ids('notif_devices'), ['alive'])
    assert.deepEqual(db.prepare('SELECT device_id FROM notif_device_links').all().map(x => x.device_id), ['alive'])
    assert.equal((await runRetention(store, NOW)).ran, false, 'once per WIB day')
    assert.equal((await runRetention(store, new Date('2026-11-24T03:00:00Z'))).ran, true)
  })

  console.log(`\n${count} broadcast & retention tests passed`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
