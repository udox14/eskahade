// NOTIF-2: Web Push crypto (RFC 8291 test vector, VAPID RFC 8292), device registration,
// and the delivery queue against the real 0202 migration. fetch is mocked; no network.
const assert = require('node:assert/strict')
const { load, notifHarness } = require('./notifications-fixture.cjs')

const wp = load('lib/notifications/channels/webpush.ts')
const devices = load('lib/notifications/devices.ts')
const { notifyStatement, testNotifyStatement } = load('lib/notifications/outbox.ts')
const { processOutbox } = load('lib/notifications/dispatch.ts')
const { processDeliveries, MAX_PUSH_ATTEMPTS } = load('lib/notifications/push.ts')
const { saveEventConfig } = load('lib/notifications/config.ts')
const { requireEventDefinition } = load('lib/notifications/catalog.ts')
const { setPreference } = load('lib/notifications/inbox.ts')

const subtle = crypto.subtle
const enc = new TextEncoder()
const h = notifHarness()
const store = h.store
let db = h.db

// ── helpers ──────────────────────────────────────────────────────────
async function makeUserAgent() {
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const pub = new Uint8Array(await subtle.exportKey('raw', pair.publicKey))
  return { privateKey: pair.privateKey, p256dh: wp.bytesToB64url(pub), auth: wp.bytesToB64url(crypto.getRandomValues(new Uint8Array(16))) }
}

async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

/** Independent receiver-side decryption (RFC 8291 §3 from the user agent's perspective). */
async function decrypt(body, ua) {
  const bytes = new Uint8Array(body)
  const salt = bytes.slice(0, 16)
  assert.equal(new DataView(bytes.buffer, bytes.byteOffset).getUint32(16), 4096)
  const idlen = bytes[20]
  const asPublic = bytes.slice(21, 21 + idlen)
  const ciphertext = bytes.slice(21 + idlen)
  const uaPublic = wp.b64urlToBytes(ua.p256dh)
  const asKey = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const secret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256))
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic])
  const ikm = await hkdf(wp.b64urlToBytes(ua.auth), secret, info, 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext))
  assert.equal(plain[plain.length - 1], 0x02, 'last-record delimiter')
  return new TextDecoder().decode(plain.slice(0, -1))
}

async function makeVapid() {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await subtle.exportKey('jwk', pair.privateKey)
  const pub = new Uint8Array(await subtle.exportKey('raw', pair.publicKey))
  return { publicKey: wp.bytesToB64url(pub), privateKey: jwk.d, subject: 'mailto:it@example.test' }
}

function mockFetch(responder) {
  const calls = []
  const fn = async (url, init) => {
    calls.push({ url, init })
    const status = typeof responder === 'function' ? await responder(url, init, calls.length) : responder
    if (status instanceof Error) throw status
    return new Response(null, { status })
  }
  fn.calls = calls
  return fn
}

const endpointFor = n => `https://fcm.googleapis.com/fcm/send/device-${n}`
let deviceSeq = 0
async function subscribe(owner) {
  const ua = await makeUserAgent()
  const endpoint = endpointFor(++deviceSeq)
  const { deviceId } = await devices.registerWebPushDevice(store, owner, { endpoint, keys: { p256dh: ua.p256dh, auth: ua.auth } })
  return { ua, endpoint, deviceId }
}

let vapid
async function runtime(fetchImpl) { return { webpush: vapid, fetchImpl } }
const deliveries = () => db.prepare('SELECT * FROM notif_deliveries ORDER BY created_at, id').all()
const SANTRI = id => ({ kind: 'SANTRI', id })
const USER = id => ({ kind: 'USER', id })

let count = 0
async function test(name, fn) {
  h.reset(); db = h.db; deviceSeq = 0
  db.exec("UPDATE app_settings SET value='1' WHERE key='notifications_push_enabled'")
  await fn(); count++; console.log('PASS ' + name)
}

async function main() {
  vapid = await makeVapid()

  await test('aes128gcm output matches RFC 8291 §5 test vector byte for byte', async () => {
    const out = await wp.encryptWebPushPayload(enc.encode('When I grow up, I want to be a watermelon'), {
      p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg',
    }, {
      senderPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
      senderPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
      salt: 'DGv6ra1nlYgDCS1FRnbzlw',
    })
    assert.equal(wp.bytesToB64url(out),
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN')
  })

  await test('random-key encryption is decryptable by the subscriber and differs every time', async () => {
    const ua = await makeUserAgent()
    const a = await wp.encryptWebPushPayload(enc.encode('{"title":"Uji"}'), ua)
    const b = await wp.encryptWebPushPayload(enc.encode('{"title":"Uji"}'), ua)
    assert.notEqual(wp.bytesToB64url(a), wp.bytesToB64url(b))
    assert.equal(await decrypt(a, ua), '{"title":"Uji"}')
    await assert.rejects(() => wp.encryptWebPushPayload(new Uint8Array(4080), ua), /terlalu besar/)
  })

  await test('VAPID JWT is ES256-verifiable with the public key and scoped to the push origin', async () => {
    const now = Date.UTC(2026, 10, 23)
    const header = await wp.vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', vapid, now)
    const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)
    assert.ok(m, header)
    assert.equal(m[4], vapid.publicKey)
    assert.deepEqual(JSON.parse(Buffer.from(m[1], 'base64url')), { typ: 'JWT', alg: 'ES256' })
    const claims = JSON.parse(Buffer.from(m[2], 'base64url'))
    assert.equal(claims.aud, 'https://fcm.googleapis.com')
    assert.equal(claims.sub, vapid.subject)
    assert.equal(claims.exp, now / 1000 + 12 * 3600)
    const key = await subtle.importKey('raw', wp.b64urlToBytes(vapid.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const signature = wp.b64urlToBytes(m[3])
    assert.equal(signature.length, 64)
    assert.ok(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, enc.encode(`${m[1]}.${m[2]}`)))
  })

  await test('VAPID config fails closed on missing or malformed secrets', async () => {
    assert.deepEqual(wp.parseVapidConfig({ VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: vapid.subject }), vapid)
    for (const env of [
      {},
      { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey },
      { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'it@example.test' },
      { VAPID_PUBLIC_KEY: 'short', VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: vapid.subject },
      { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: 'x'.repeat(10), VAPID_SUBJECT: vapid.subject },
    ]) assert.equal(wp.parseVapidConfig(env), null)
  })

  await test('only official push services are reachable (SSRF allowlist) and statuses map safely', async () => {
    for (const ok of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x',
      'https://web.push.apple.com/QH', 'https://wns2-par02p.notify.windows.com/w/?token=x']) assert.equal(wp.isAllowedPushEndpoint(ok), true, ok)
    for (const bad of ['http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.test/x', 'https://evil.test/x',
      'https://fcm.googleapis.com:8443/x', 'https://u:p@fcm.googleapis.com/x', 'https://169.254.169.254/latest', 42, null])
      assert.equal(wp.isAllowedPushEndpoint(bad), false, String(bad))
    assert.equal(wp.classifyPushStatus(201).outcome, 'SENT')
    assert.equal(wp.classifyPushStatus(410).outcome, 'EXPIRED')
    assert.equal(wp.classifyPushStatus(404).outcome, 'EXPIRED')
    assert.equal(wp.classifyPushStatus(429).outcome, 'TRANSIENT')
    assert.equal(wp.classifyPushStatus(503).outcome, 'TRANSIENT')
    assert.deepEqual(wp.classifyPushStatus(403), { outcome: 'REJECTED', httpStatus: 403, errorCode: 'VAPID_REJECTED' })
  })

  await test('device registration: idempotent, multi-owner, key-hijack refused, owner cap, unlink count', async () => {
    const ua = await makeUserAgent()
    const sub = { endpoint: endpointFor(1), keys: { p256dh: ua.p256dh, auth: ua.auth } }
    const a = await devices.registerWebPushDevice(store, SANTRI('s-1'), sub)
    const b = await devices.registerWebPushDevice(store, SANTRI('s-1'), sub)
    assert.equal(a.deviceId, b.deviceId)
    await devices.registerWebPushDevice(store, SANTRI('s-2'), sub) // sibling on the same phone
    assert.equal(db.prepare('SELECT COUNT(*) n FROM notif_devices').get().n, 1)
    assert.equal(db.prepare('SELECT COUNT(*) n FROM notif_device_links').get().n, 2)
    const other = await makeUserAgent()
    await assert.rejects(() => devices.registerWebPushDevice(store, USER('u-admin'), { endpoint: sub.endpoint, keys: { p256dh: other.p256dh, auth: other.auth } }),
      e => e instanceof devices.DeviceConflictError)
    await devices.registerWebPushDevice(store, SANTRI('s-1'), { endpoint: sub.endpoint, keys: { p256dh: other.p256dh, auth: other.auth } })
    assert.equal(db.prepare('SELECT p256dh FROM notif_devices').get().p256dh, other.p256dh, 'linked owner may rotate keys')
    await assert.rejects(() => devices.registerWebPushDevice(store, SANTRI('s-1'), { endpoint: 'https://evil.test/x', keys: sub.keys }), /tidak didukung/)
    await assert.rejects(() => devices.registerWebPushDevice(store, SANTRI('s-1'), { endpoint: endpointFor(9), keys: { p256dh: 'AAAA', auth: ua.auth } }), /tidak valid/)
    assert.equal(await devices.unlinkDevice(store, SANTRI('s-1'), a.deviceId), 1)
    assert.equal(await devices.unlinkByEndpoint(store, SANTRI('s-2'), sub.endpoint), 0)
    for (let i = 0; i < devices.MAX_LINKS_PER_OWNER + 2; i++) await subscribe(USER('u-bendahara'))
    assert.equal(db.prepare("SELECT COUNT(*) n FROM notif_device_links WHERE owner_id='u-bendahara'").get().n, devices.MAX_LINKS_PER_OWNER)
  })

  await test('subscription renewal moves only owners proven by session', async () => {
    const old = await subscribe(SANTRI('s-1'))
    await devices.registerWebPushDevice(store, SANTRI('s-2'), { endpoint: old.endpoint, keys: { p256dh: old.ua.p256dh, auth: old.ua.auth } })
    const fresh = await makeUserAgent()
    const next = { endpoint: endpointFor(99), keys: { p256dh: fresh.p256dh, auth: fresh.auth } }
    assert.equal(await devices.renewWebPushDevice(store, [USER('u-admin')], old.endpoint, next), null, 'unlinked session cannot hijack')
    const r = await devices.renewWebPushDevice(store, [SANTRI('s-1')], old.endpoint, next)
    assert.equal(r.moved, 1)
    const links = db.prepare('SELECT d.endpoint_or_token e, l.owner_id o FROM notif_device_links l JOIN notif_devices d ON d.id=l.device_id ORDER BY o').all()
    assert.deepEqual(links.map(l => `${l.o}@${l.e.slice(-6)}`), ['s-1@ice-99', 's-2@vice-1'])
  })

  await test('parent push is encrypted to the device, masked on the lock screen, and sent exactly once', async () => {
    const device = await subscribe(SANTRI('s-1'))
    const fetchImpl = mockFetch(201)
    run(notifyStatement('PORTAL_TRANSFER_DITOLAK', 'REJ:1', { santri_id: 's-1', nama_santri: 'Ahmad', nomor: 'TRF-1', alasan: 'Bukti buram' }))
    const result = await processOutbox(store, { push: await runtime(fetchImpl) })
    assert.equal(result.push.sent, 1)
    assert.equal(fetchImpl.calls.length, 1)
    const { url, init } = fetchImpl.calls[0]
    assert.equal(url, device.endpoint)
    assert.equal(init.headers['Content-Encoding'], 'aes128gcm')
    assert.equal(init.headers.Urgency, 'high')
    assert.equal(init.headers.TTL, '86400')
    assert.match(init.headers.Authorization, /^vapid t=.+, k=/)
    assert.equal(init.redirect, 'error')
    const payload = JSON.parse(await decrypt(init.body, device.ua))
    assert.equal(payload.title, 'Transfer Ditolak')
    assert.doesNotMatch(payload.body, /Bukti buram/)
    assert.equal(payload.url, '/portal-ortu/tagihan')
    assert.equal(deliveries()[0].status, 'SENT')
    assert.ok(db.prepare('SELECT last_success_at FROM notif_devices').get().last_success_at)
    await processOutbox(store, { push: await runtime(fetchImpl) })
    await processDeliveries(store, await runtime(fetchImpl), { at: new Date(Date.now() + 3600_000) })
    assert.equal(fetchImpl.calls.length, 1, 'no re-send')
  })

  await test('push is not queued when disabled, unconfigured, channel removed, or category push-muted', async () => {
    await subscribe(SANTRI('s-1'))
    const fetchImpl = mockFetch(201)
    db.exec("UPDATE app_settings SET value='0' WHERE key='notifications_push_enabled'")
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'A:1', { santri_id: 's-1' }))
    await processOutbox(store, { push: await runtime(fetchImpl) })
    db.exec("UPDATE app_settings SET value='1' WHERE key='notifications_push_enabled'")
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'A:2', { santri_id: 's-1' }))
    await processOutbox(store, { push: { webpush: null, fetchImpl } })
    const def = requireEventDefinition('PORTAL_UANG_JAJAN_MASUK')
    await saveEventConfig(store, def.code, { enabled: true, mandatory: false, channels: ['in_app'], title: def.title, inApp: def.inApp, push: def.push, pushPrivacy: 'MASKED' }, 'u-admin')
    run(notifyStatement(def.code, 'A:3', { santri_id: 's-1' }))
    await processOutbox(store, { push: await runtime(fetchImpl) })
    db.exec("INSERT INTO notif_preferences(owner_kind, owner_id, category, in_app_enabled, push_enabled) VALUES ('SANTRI','s-1','pembayaran',1,0)")
    run(notifyStatement('PORTAL_TRANSFER_KEDALUWARSA', 'A:4', { santri_id: 's-1' }))
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'A:5', { santri_id: 's-1' })) // mandatory overrides push mute
    await processOutbox(store, { push: await runtime(fetchImpl) })
    assert.equal(db.prepare('SELECT COUNT(*) n FROM notifications').get().n, 5, 'in-app always stored')
    assert.equal(deliveries().length, 1)
    assert.equal(fetchImpl.calls.length, 1)
  })

  await test('410 deactivates the device; 403 keeps it active; later notifications skip expired devices', async () => {
    const gone = await subscribe(SANTRI('s-1'))
    const kept = await subscribe(SANTRI('s-1'))
    const fetchImpl = mockFetch(url => url === gone.endpoint ? 410 : 403)
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'B:1', { santri_id: 's-1' }))
    const r = await processOutbox(store, { push: await runtime(fetchImpl) })
    assert.equal(r.push.expired, 1); assert.equal(r.push.failed, 1)
    const state = id => db.prepare('SELECT is_active, failure_count, deactivated_reason FROM notif_devices WHERE id=?').get(id)
    assert.deepEqual({ ...state(gone.deviceId) }, { is_active: 0, failure_count: 0, deactivated_reason: 'SUBSCRIPTION_GONE' })
    assert.deepEqual({ ...state(kept.deviceId) }, { is_active: 1, failure_count: 0, deactivated_reason: null })
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'B:2', { santri_id: 's-1' }))
    await processOutbox(store, { push: await runtime(mockFetch(201)) })
    assert.equal(db.prepare("SELECT COUNT(*) n FROM notif_deliveries WHERE device_id=?").get(gone.deviceId).n, 1)
  })

  await test('transient failures (5xx/429/network) retry with backoff then fail; inbox unaffected', async () => {
    await subscribe(SANTRI('s-1'))
    const fetchImpl = mockFetch((u, i, n) => n === 2 ? new Error('ECONNRESET') : 503)
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'C:1', { santri_id: 's-1' }))
    let at = new Date(Date.now() + 2000)
    const first = await processOutbox(store, { at, push: await runtime(fetchImpl) })
    assert.equal(first.done, 1); assert.equal(first.push.retried, 1)
    let row = deliveries()[0]
    assert.equal(row.status, 'PENDING'); assert.equal(row.http_status, 503); assert.ok(row.next_attempt_at > at.toISOString())
    assert.equal((await processDeliveries(store, await runtime(fetchImpl), { at })).claimed, 0, 'not due yet')
    for (let i = 2; i <= MAX_PUSH_ATTEMPTS; i++) {
      at = new Date(at.getTime() + 3600_000)
      await processDeliveries(store, await runtime(fetchImpl), { at })
      if (i === 2) assert.equal(deliveries()[0].error_code, 'NETWORK')
    }
    row = deliveries()[0]
    assert.equal(row.status, 'FAILED'); assert.equal(row.attempts, MAX_PUSH_ATTEMPTS)
    assert.equal(db.prepare("SELECT status FROM notif_outbox WHERE dedupe_key='C:1'").get().status, 'DONE')
    assert.equal(db.prepare('SELECT is_active FROM notif_devices').get().is_active, 1)
  })

  await test('shared sibling phone gets one push per notification; concurrent senders never double-send', async () => {
    const phone = await subscribe(SANTRI('s-1'))
    await devices.registerWebPushDevice(store, SANTRI('s-2'), { endpoint: phone.endpoint, keys: { p256dh: phone.ua.p256dh, auth: phone.ua.auth } })
    for (let i = 0; i < 6; i++) run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'D:' + i, { santri_id: i % 2 ? 's-1' : 's-2' }))
    await processOutbox(store, {}) // in-app only; queue nothing yet
    assert.equal(deliveries().length, 0)
    // Queue via a second pass with push for fresh notifications.
    for (let i = 6; i < 12; i++) run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'D:' + i, { santri_id: i % 2 ? 's-1' : 's-2' }))
    const fetchImpl = mockFetch(async () => { await new Promise(r => setTimeout(r, 2)); return 201 })
    const push = await runtime(fetchImpl)
    await processOutbox(store, { push })
    await Promise.all([processDeliveries(store, push, { at: new Date(Date.now() + 5000) }), processDeliveries(store, push, { at: new Date(Date.now() + 5000) })])
    assert.equal(fetchImpl.calls.length, 6)
    assert.equal(new Set(deliveries().map(d => d.notification_id)).size, 6)
  })

  await test('staff verification push reaches scoped petugas devices; admin test send reaches only the admin', async () => {
    const petugas = await subscribe(USER('u-petugas-a'))
    await subscribe(USER('u-petugas-b'))
    const admin = await subscribe(USER('u-admin'))
    const fetchImpl = mockFetch(201)
    run(notifyStatement('STAFF_TRANSFER_MENUNGGU_VERIFIKASI', 'E:1', { asrama: 'ASRAMA A', nama_santri: 'Ahmad', nominal: 50000 }))
    await processOutbox(store, { push: await runtime(fetchImpl) })
    assert.deepEqual(fetchImpl.calls.map(c => c.url).sort(), [admin.endpoint, petugas.endpoint].sort())
    const body = JSON.parse(await decrypt(fetchImpl.calls.find(c => c.url === petugas.endpoint).init.body, petugas.ua))
    assert.equal(body.url, '/dashboard/keuangan/verifikasi-transfer')
    assert.doesNotMatch(body.body, /Rp/)
    const testFetch = mockFetch(201)
    run(testNotifyStatement('PORTAL_PENGINGAT_TUNGGAKAN', 'u-admin', { nama_santri: 'Ahmad' }))
    await processOutbox(store, { push: await runtime(testFetch) })
    assert.deepEqual(testFetch.calls.map(c => c.url), [admin.endpoint])
    assert.match(JSON.parse(await decrypt(testFetch.calls[0].init.body, admin.ua)).title, /^\[Uji\] /)
  })

  console.log(`\n${count} web push tests passed`)
}

function run(statement) { return db.prepare(statement.sql).run(...statement.params) }

main().catch(error => { console.error(error); process.exitCode = 1 })
