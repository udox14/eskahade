// Behavioral checks for the notification core (NOTIF-1) against the real 0202 migration.
// No remote access: node:sqlite in-memory database + TypeScript transpiled on the fly.
const assert = require('node:assert/strict')
const { load, notifHarness, MIGRATION, VERIFY_HREF } = require('./notifications-fixture.cjs')

const { notifyStatement, testNotifyStatement, enqueueNotification } = load('lib/notifications/outbox.ts')
const { processOutbox, MAX_ATTEMPTS, requeueOutbox } = load('lib/notifications/dispatch.ts')
const { saveEventConfig, resetEventConfig, getEffectiveConfig } = load('lib/notifications/config.ts')
const { renderNotification, validateTemplates, formatRupiahExact, safeInternalLink } = load('lib/notifications/render.ts')
const { requireEventDefinition, samplePayload, NOTIF_EVENTS } = load('lib/notifications/catalog.ts')
const { listInbox, countUnread, markRead, markAllRead, setPreference } = load('lib/notifications/inbox.ts')
const { effectiveRolesForUser } = load('lib/notifications/recipients.ts')

const h = notifHarness()
const store = h.store
let db = h.db
function setup() { h.reset(); db = h.db }
const run = s => db.prepare(s.sql).run(...s.params)
const inbox = () => db.prepare('SELECT recipient_kind k, recipient_id id, title, body, push_body, link FROM notifications ORDER BY recipient_id').all()
const outbox = code => db.prepare('SELECT * FROM notif_outbox WHERE dedupe_key = ?').get(code)

let count = 0
async function test(name, fn) { setup(); await fn(); count++; console.log('PASS ' + name) }

async function main() {
  await test('migration seeds kill switches (in-app on, push off) and the admin-only menu row', async () => {
    assert.equal(db.prepare("SELECT value FROM app_settings WHERE key='notifications_enabled'").get().value, '1')
    assert.equal(db.prepare("SELECT value FROM app_settings WHERE key='notifications_push_enabled'").get().value, '0')
    assert.equal(db.prepare("SELECT roles FROM fitur_akses WHERE href='/dashboard/pengaturan/notifikasi'").get().roles, '["admin"]')
    db.exec(MIGRATION) // idempotent re-run
  })

  await test('outbox insert is idempotent and rejects unknown events, bad keys, and non-primitive payloads', async () => {
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'TRANSFER_APPROVED:sub-1', { santri_id: 's-1', nominal: 100000 }))
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'TRANSFER_APPROVED:sub-1', { santri_id: 's-1', nominal: 999 }))
    assert.equal(db.prepare('SELECT COUNT(*) n FROM notif_outbox').get().n, 1)
    assert.equal(JSON.parse(outbox('TRANSFER_APPROVED:sub-1').payload_json).nominal, 100000)
    assert.throws(() => notifyStatement('NOPE', 'K:1', {}), /tidak dikenal/)
    assert.throws(() => notifyStatement('PORTAL_TRANSFER_DITERIMA', 'bad key', {}), /deduplikasi/)
    assert.throws(() => notifyStatement('PORTAL_TRANSFER_DITERIMA', 'K:2', { x: {} }), /primitif/)
    assert.throws(() => notifyStatement('PORTAL_TRANSFER_DITERIMA', 'K:3', { nominal: NaN }), /angka valid/)
  })

  await test('business payload cannot smuggle the admin test-recipient key', async () => {
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'K:smuggle', { santri_id: 's-1', __test_user_id: 'u-admin' }))
    assert.equal('__test_user_id' in JSON.parse(outbox('K:smuggle').payload_json), false)
    await processOutbox(store)
    assert.deepEqual(inbox().map(r => r.k + ':' + r.id), ['SANTRI:s-1'])
  })

  await test('outbox row commits atomically with the business write: failed batch leaves no notification', async () => {
    const stmts = [
      { sql: 'INSERT INTO money(id, amount) VALUES (?, ?)', params: ['m-1', 5000] },
      notifyStatement('PORTAL_PEMBAYARAN_DITERIMA', 'PAY:m-1', { santri_id: 's-1', nominal: 5000 }),
      { sql: 'INSERT INTO money(id, amount) VALUES (?, ?)', params: ['m-2', -1] },
    ]
    await assert.rejects(() => store.batch(stmts))
    assert.equal(db.prepare('SELECT COUNT(*) n FROM money').get().n, 0)
    assert.equal(db.prepare('SELECT COUNT(*) n FROM notif_outbox').get().n, 0)
  })

  await test('rupiah formatting is exact integer, never rounded; links must be internal paths', async () => {
    assert.equal(formatRupiahExact(1250000), 'Rp1.250.000')
    assert.equal(formatRupiahExact('750'), 'Rp750')
    assert.equal(formatRupiahExact(-15000), '-Rp15.000')
    assert.equal(formatRupiahExact(1250.5), '-')
    assert.equal(formatRupiahExact('12.5'), '-')
    assert.equal(safeInternalLink('/portal-ortu/tagihan'), '/portal-ortu/tagihan')
    for (const bad of ['https://evil.test', '//evil.test', 'javascript:alert(1)', '/\\evil', '/a b']) assert.equal(safeInternalLink(bad), null)
  })

  await test('masked push hides sensitive data; FULL reuses the in-app body; validator blocks leaks', async () => {
    const def = requireEventDefinition('PORTAL_TRANSFER_DITOLAK')
    const payload = { santri_id: 's-1', nama_santri: 'Ahmad', nomor: 'TRF-1', alasan: 'Bukti buram' }
    const masked = renderNotification(def, { title: def.title, inApp: def.inApp, push: def.push, pushPrivacy: 'MASKED' }, payload)
    assert.match(masked.body, /Bukti buram/)
    assert.doesNotMatch(masked.pushBody, /Bukti buram/)
    const full = renderNotification(def, { title: def.title, inApp: def.inApp, push: def.push, pushPrivacy: 'FULL' }, payload)
    assert.equal(full.pushBody, full.body)
    const errors = validateTemplates(def, { title: 'Ditolak {alasan}', inApp: '{nama_santri} {tidak_ada}', push: 'x {alasan}', pushPrivacy: 'MASKED' })
    assert.ok(errors.some(e => /tidak dikenal: \{tidak_ada\}/.test(e)))
    assert.ok(errors.some(e => /Judul tidak boleh memuat data sensitif/.test(e)))
    assert.ok(errors.some(e => /Isi push tidak boleh memuat data sensitif/.test(e)))
    assert.deepEqual(validateTemplates(def, { title: 'T {alasan}', inApp: 'B', push: 'P {alasan}', pushPrivacy: 'FULL' }), [])
  })

  await test('every catalog default passes its own validation and renders from sample data', async () => {
    const { validateConfigInput } = load('lib/notifications/config.ts')
    const codes = new Set()
    for (const def of NOTIF_EVENTS) {
      assert.ok(!codes.has(def.code), 'duplicate code ' + def.code); codes.add(def.code)
      assert.deepEqual(validateConfigInput(def, { enabled: true, mandatory: false, channels: def.defaultChannels, title: def.title,
        inApp: def.inApp, push: def.push, pushPrivacy: def.defaultPushPrivacy, recipients: def.defaultRecipients ?? null }), [], def.code)
      const r = renderNotification(def, { ...def, pushPrivacy: def.defaultPushPrivacy }, samplePayload(def))
      assert.doesNotMatch(r.title + r.body + r.pushBody, /\{[a-z_]+\}/, def.code)
      assert.ok(safeInternalLink(def.link), def.code)
      assert.equal(def.audience === 'STAFF', !!def.defaultRecipients, def.code)
    }
  })

  await test('override stores only differences; reset restores defaults; invalid input is rejected', async () => {
    const def = requireEventDefinition('PORTAL_TRANSFER_DITERIMA')
    const base = { enabled: true, mandatory: true, channels: def.defaultChannels, title: def.title, inApp: def.inApp, push: def.push, pushPrivacy: 'MASKED' }
    await saveEventConfig(store, def.code, { ...base, title: 'Transfer Sudah Masuk' }, 'u-admin')
    const row = db.prepare('SELECT * FROM notif_event_types WHERE code = ?').get(def.code)
    assert.equal(row.title_template, 'Transfer Sudah Masuk')
    assert.equal(row.in_app_template, null); assert.equal(row.is_enabled, null); assert.equal(row.channels_json, null)
    assert.equal((await getEffectiveConfig(store, def.code)).title, 'Transfer Sudah Masuk')
    await assert.rejects(() => saveEventConfig(store, def.code, { ...base, channels: ['webpush'] }, 'u-admin'), /in-app wajib/)
    await assert.rejects(() => saveEventConfig(store, def.code, { ...base, push: 'Rp {nominal}' }, 'u-admin'), /sensitif/)
    await resetEventConfig(store, def.code)
    assert.equal((await getEffectiveConfig(store, def.code)).title, def.title)
    const staffDef = requireEventDefinition('STAFF_IZIN_DIAJUKAN')
    await assert.rejects(() => saveEventConfig(store, staffDef.code, { ...base, title: staffDef.title, inApp: staffDef.inApp, push: staffDef.push,
      recipients: { roles: [], scope: 'ALL', includeUserIds: [], excludeUserIds: [], notifyActor: false, excludeActor: true } }, 'u-admin'), /minimal satu/)
  })

  await test('parent event reaches only the santri inbox, rendered from the server-side payload', async () => {
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'TRANSFER_APPROVED:sub-1', { santri_id: 's-1', nama_santri: 'Ahmad', nomor: 'TRF-1', nominal: 1250000 }))
    const r = await processOutbox(store)
    assert.equal(r.done, 1); assert.equal(r.delivered, 1)
    const rows = inbox()
    assert.equal(rows.length, 1); assert.equal(rows[0].k, 'SANTRI'); assert.equal(rows[0].id, 's-1')
    assert.match(rows[0].body, /Rp1\.250\.000/)
    assert.doesNotMatch(rows[0].push_body, /Rp/)
    assert.equal(rows[0].link, '/portal-ortu/riwayat')
    assert.equal(outbox('TRANSFER_APPROVED:sub-1').status, 'DONE')
    assert.equal((await processOutbox(store)).claimed, 0)
    assert.equal(inbox().length, 1)
  })

  await test('disabled event is skipped; paused dispatch leaves rows pending; unknown santri has no recipient', async () => {
    const def = requireEventDefinition('PORTAL_UANG_JAJAN_MASUK')
    await saveEventConfig(store, def.code, { enabled: false, mandatory: false, channels: def.defaultChannels, title: def.title, inApp: def.inApp, push: def.push, pushPrivacy: 'MASKED' }, 'u-admin')
    run(notifyStatement(def.code, 'TOPUP:1', { santri_id: 's-1', nominal: 5000 }))
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'TRANSFER_APPROVED:ghost', { santri_id: 's-ghost' }))
    await processOutbox(store)
    assert.equal(outbox('TOPUP:1').skip_reason, 'DISABLED')
    assert.equal(outbox('TRANSFER_APPROVED:ghost').skip_reason, 'NO_RECIPIENT')
    db.exec("UPDATE app_settings SET value='0' WHERE key='notifications_enabled'")
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'TRANSFER_APPROVED:later', { santri_id: 's-1' }))
    assert.equal((await processOutbox(store)).paused, true)
    assert.equal(outbox('TRANSFER_APPROVED:later').status, 'PENDING')
    db.exec("DELETE FROM app_settings WHERE key='notifications_enabled'")
    assert.equal((await processOutbox(store)).paused, true, 'missing setting fails closed')
  })

  await test('transfer verification goes to all-scope finance roles + scoped petugas, excluding tester/pimpinan/actor', async () => {
    run(notifyStatement('STAFF_TRANSFER_MENUNGGU_VERIFIKASI', 'PROOF:sub-1', { santri_id: 's-1', asrama: 'asrama a ', nama_santri: 'Ahmad', nominal: 50000 }))
    await processOutbox(store)
    assert.deepEqual(inbox().map(r => r.id), ['u-admin', 'u-bendahara', 'u-petugas-a'])
    assert.ok(inbox().every(r => r.link === VERIFY_HREF))
  })

  await test('feature access is enforced: revoked override and inactive menu drop role-based recipients', async () => {
    const featureId = db.prepare('SELECT id FROM fitur_akses WHERE href = ?').get(VERIFY_HREF).id
    db.prepare("INSERT INTO user_fitur_override(user_id, fitur_id, action) VALUES ('u-bendahara', ?, 'revoke')").run(featureId)
    run(notifyStatement('STAFF_TRANSFER_MENUNGGU_VERIFIKASI', 'PROOF:sub-2', { santri_id: 's-2', asrama: 'ASRAMA B' }))
    await processOutbox(store)
    assert.deepEqual(inbox().map(r => r.id), ['u-admin', 'u-petugas-b'])
    db.exec(`UPDATE fitur_akses SET is_active = 0 WHERE href = '${VERIFY_HREF}'`)
    run(notifyStatement('STAFF_TRANSFER_MENUNGGU_VERIFIKASI', 'PROOF:sub-3', { santri_id: 's-2', asrama: 'ASRAMA B' }))
    await processOutbox(store)
    assert.equal(outbox('PROOF:sub-3').skip_reason, 'NO_RECIPIENT')
  })

  await test('actor rules: excludeActor skips the clicker; notifyActor delivers result with link only if accessible', async () => {
    run(notifyStatement('STAFF_IZIN_DIAJUKAN', 'IZIN:1', { santri_id: 's-1', actor_user_id: 'u-admin' }))
    await processOutbox(store)
    assert.equal(outbox('IZIN:1').skip_reason, 'NO_RECIPIENT', 'only admin matches dewan_santri/admin and is the actor')
    run(notifyStatement('STAFF_IZIN_DIPUTUSKAN', 'IZIN_RESULT:1', { actor_user_id: 'u-asrama-a', keputusan: 'disetujui', nama_santri: 'Ahmad' }))
    await processOutbox(store)
    const rows = inbox()
    assert.deepEqual(rows.map(r => r.id), ['u-asrama-a'])
    assert.equal(rows[0].link, null, 'pengurus asrama has no access to the perizinan page')
    assert.equal(rows[0].title, 'Pengajuan Izin disetujui')
  })

  await test('ASRAMA_BINAAN scope and explicit include/exclude users', async () => {
    const def = requireEventDefinition('STAFF_SANTRI_KELUAR_DIAJUKAN')
    db.exec(`INSERT INTO fitur_akses(group_name,title,href,roles,is_active) VALUES ('Santri','Keluar','${def.link}','["admin","pengurus_asrama"]',1)`)
    await saveEventConfig(store, def.code, { enabled: true, mandatory: false, channels: def.defaultChannels, title: def.title, inApp: def.inApp, push: def.push, pushPrivacy: 'FULL',
      recipients: { roles: ['admin', 'pengurus_asrama'], scope: 'ASRAMA_BINAAN', includeUserIds: ['u-pimpinan'], excludeUserIds: ['u-admin'], notifyActor: false, excludeActor: true } }, 'u-admin')
    run(notifyStatement(def.code, 'KELUAR:a', { asrama: 'ASRAMA A' }))
    run(notifyStatement(def.code, 'KELUAR:b', { asrama: 'ASRAMA B' }))
    await processOutbox(store)
    const rows = db.prepare('SELECT o.dedupe_key k, n.recipient_id id, n.link FROM notifications n JOIN notif_outbox o ON o.id = n.outbox_id ORDER BY k, id').all()
    assert.deepEqual(rows.map(r => `${r.k}>${r.id}`), ['KELUAR:a>u-asrama-a', 'KELUAR:a>u-pimpinan', 'KELUAR:b>u-pimpinan'])
    assert.equal(rows.find(r => r.id === 'u-pimpinan').link, null)
  })

  await test('muted category is honored unless the event is mandatory', async () => {
    await setPreference(store, { kind: 'SANTRI', id: 's-1' }, 'pembayaran', false)
    run(notifyStatement('PORTAL_TRANSFER_KEDALUWARSA', 'EXP:1', { santri_id: 's-1' }))
    run(notifyStatement('PORTAL_TRANSFER_DITOLAK', 'REJ:1', { santri_id: 's-1' }))
    await processOutbox(store)
    assert.equal(outbox('EXP:1').skip_reason, 'NO_RECIPIENT')
    assert.equal(outbox('REJ:1').status, 'DONE')
    await assert.rejects(() => setPreference(store, { kind: 'SANTRI', id: 's-1' }, 'tidak-ada', false), /tidak dikenal/)
  })

  await test('transient failure retries with backoff, then FAILED after max attempts; requeue is idempotent', async () => {
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'RETRY:1', { santri_id: 's-1' }))
    h.fault('D1_ERROR: overloaded')
    let at = new Date(Date.now() + 2000)
    let r = await processOutbox(store, { at })
    assert.equal(r.retried, 1)
    let row = outbox('RETRY:1')
    assert.equal(row.status, 'PENDING'); assert.equal(row.attempts, 1); assert.match(row.last_error, /overloaded/)
    assert.ok(row.next_attempt_at > at.toISOString())
    assert.equal((await processOutbox(store, { at })).claimed, 0, 'not due yet')
    for (let i = 2; i <= MAX_ATTEMPTS; i++) { at = new Date(at.getTime() + 3600_000); await processOutbox(store, { at }) }
    row = outbox('RETRY:1')
    assert.equal(row.status, 'FAILED'); assert.equal(row.attempts, MAX_ATTEMPTS)
    h.fault(null)
    await requeueOutbox(store, row.id)
    await requeueOutbox(store, row.id)
    await processOutbox(store, { at: new Date(Date.now() + 1000) })
    assert.equal(outbox('RETRY:1').status, 'DONE')
    assert.equal(inbox().length, 1)
  })

  await test('concurrent dispatchers claim each row once and never duplicate inbox rows', async () => {
    for (let i = 0; i < 12; i++) run(notifyStatement('STAFF_TRANSFER_MENUNGGU_VERIFIKASI', 'PROOF:c' + i, { asrama: 'ASRAMA A' }))
    const results = await Promise.all([processOutbox(store, { limit: 7 }), processOutbox(store, { limit: 7 }), processOutbox(store, { limit: 7 })])
    assert.equal(results.reduce((n, r) => n + r.claimed, 0), 12)
    assert.equal(db.prepare('SELECT COUNT(*) n FROM notifications').get().n, 36)
    assert.equal(db.prepare("SELECT COUNT(*) n FROM notif_outbox WHERE status = 'DONE'").get().n, 12)
  })

  await test('stale PROCESSING claim is recovered, and a late finisher cannot overwrite the new claim', async () => {
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'STALE:1', { santri_id: 's-1' }))
    db.exec("UPDATE notif_outbox SET status='PROCESSING', claim_until='2000-01-01T00:00:00.000Z', attempts=1")
    const r = await processOutbox(store)
    assert.equal(r.done, 1); assert.equal(outbox('STALE:1').attempts, 2)
    db.prepare("UPDATE notif_outbox SET status='DONE' WHERE id=? AND status='PROCESSING' AND claim_until='2000-01-01T00:00:00.000Z'").run(outbox('STALE:1').id)
    assert.equal(outbox('STALE:1').status, 'DONE'); assert.equal(inbox().length, 1)
  })

  await test('admin test send reaches only the requesting admin, labelled, even for a disabled event', async () => {
    const def = requireEventDefinition('PORTAL_PENGINGAT_TUNGGAKAN')
    assert.equal(def.defaultEnabled, false)
    run(testNotifyStatement(def.code, 'u-admin', samplePayload(def)))
    await processOutbox(store)
    const rows = inbox()
    assert.deepEqual(rows.map(r => r.k + ':' + r.id), ['USER:u-admin'])
    assert.match(rows[0].title, /^\[Uji\] /)
    assert.equal(rows[0].link, null, 'parent link is not given to staff')
  })

  await test('inbox is scoped per recipient with stable tie-safe pagination and read tracking', async () => {
    for (let i = 0; i < 5; i++) run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'PAGE:' + i, { santri_id: 's-1' }))
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'PAGE:other', { santri_id: 's-2' }))
    await processOutbox(store, { at: new Date(Date.now() + 2000) }) // same created_at for all rows
    const me = { kind: 'SANTRI', id: 's-1' }
    const seen = []
    let cursor = null
    do {
      const page = await listInbox(store, me, { limit: 2, before: cursor })
      seen.push(...page.items.map(i => i.id)); cursor = page.nextCursor
    } while (cursor)
    assert.equal(seen.length, 5); assert.equal(new Set(seen).size, 5)
    assert.equal(await countUnread(store, me), 5)
    const otherId = db.prepare("SELECT id FROM notifications WHERE recipient_id='s-2'").get().id
    await markRead(store, me, [seen[0], otherId, 'not-a-uuid'])
    assert.equal(await countUnread(store, me), 4)
    assert.equal(await countUnread(store, { kind: 'SANTRI', id: 's-2' }), 1, 'cannot mark another recipient read')
    await markAllRead(store, me)
    assert.equal(await countUnread(store, me), 0)
    assert.equal((await listInbox(store, me, { unreadOnly: true })).items.length, 0)
  })

  await test('effective roles mirror session expansion and reject corrupt stored roles', async () => {
    assert.deepEqual(effectiveRolesForUser({ role: 'admin', roles: 'not-json', structural_jabatan: null }), [])
    const roles = effectiveRolesForUser({ role: 'pengurus_asrama', roles: '["pengurus_asrama"]', structural_jabatan: 'ketua' })
    for (const r of ['pengurus_asrama', 'jabatan:ketua', 'pengurus_asrama:ketua']) assert.ok(roles.includes(r), r)
    assert.ok(effectiveRolesForUser({ role: 'keamanan', roles: null, structural_jabatan: null }).includes('jabatan:anggota'))
  })

  await test('enqueueNotification returns the existing row id on duplicate', async () => {
    const a = await enqueueNotification(store, 'STAFF_REKONSILIASI_BARU', 'RECON:1', { jumlah: 2, jenis: 'X' })
    const b = await enqueueNotification(store, 'STAFF_REKONSILIASI_BARU', 'RECON:1', { jumlah: 9, jenis: 'Y' })
    assert.equal(a, b)
  })

  console.log(`\n${count} notification tests passed`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
