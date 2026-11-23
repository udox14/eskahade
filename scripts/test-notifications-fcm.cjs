// NOTIF-3: FCM HTTP v1 sender (OAuth RS256 JWT, token cache, error mapping), FCM device
// registration, and mixed WEBPUSH+FCM delivery against the real 0202 migration. fetch is mocked.
const assert = require('node:assert/strict')
const { generateKeyPairSync, createVerify } = require('node:crypto')
const { load, notifHarness } = require('./notifications-fixture.cjs')

const fcm = load('lib/notifications/channels/fcm.ts')
const devices = load('lib/notifications/devices.ts')
const { notifyStatement } = load('lib/notifications/outbox.ts')
const { processOutbox } = load('lib/notifications/dispatch.ts')
const { pushRuntimeFromEnv } = load('lib/notifications/push.ts')
const { saveEventConfig } = load('lib/notifications/config.ts')
const { requireEventDefinition } = load('lib/notifications/catalog.ts')

const h = notifHarness()
const store = h.store
let db = h.db

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).trim()
const config = { projectId: 'eskahade-test', clientEmail: 'push@eskahade-test.iam.gserviceaccount.com', privateKey: PEM }
const TOKEN_A = 'fcm-token-A:' + 'a'.repeat(140)
const TOKEN_B = 'fcm-token-B:' + 'b'.repeat(140)

/** Mock Google: OAuth endpoint + FCM endpoint. `fcmStatus(token)` decides the FCM response. */
function google({ fcmStatus = () => [200, {}], oauth = () => [200, { access_token: 'ya29.test', expires_in: 3600 }] } = {}) {
  const calls = { oauth: [], send: [] }
  const fn = async (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      calls.oauth.push(init)
      const r = await oauth()
      if (r instanceof Error) throw r
      return new Response(JSON.stringify(r[1]), { status: r[0] })
    }
    assert.equal(url, `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`)
    const body = JSON.parse(init.body)
    calls.send.push({ init, body })
    const r = await fcmStatus(body.message.token)
    if (r instanceof Error) throw r
    return new Response(JSON.stringify(r[1]), { status: r[0] })
  }
  fn.calls = calls
  return fn
}
const fcmError = (status, code) => [status, { error: { status: 'X', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: code }] } }]
const payload = { id: 'n-1', title: 'Judul', body: 'Isi', url: '/portal-ortu/riwayat', tag: 'PORTAL_TRANSFER_DITERIMA' }

let count = 0
async function test(name, fn) {
  h.reset(); db = h.db; fcm.clearFcmTokenCache()
  db.exec("UPDATE app_settings SET value='1' WHERE key='notifications_push_enabled'")
  await fn(); count++; console.log('PASS ' + name)
}
function run(statement) { return db.prepare(statement.sql).run(...statement.params) }
const SANTRI = id => ({ kind: 'SANTRI', id })

async function main() {
  await test('FCM config fails closed on missing/malformed service-account secrets', async () => {
    assert.deepEqual(fcm.parseFcmConfig({ FCM_PROJECT_ID: config.projectId, FCM_CLIENT_EMAIL: config.clientEmail, FCM_PRIVATE_KEY: PEM }), config)
    for (const env of [{}, { FCM_PROJECT_ID: config.projectId, FCM_CLIENT_EMAIL: config.clientEmail },
      { FCM_PROJECT_ID: 'Bad Project', FCM_CLIENT_EMAIL: config.clientEmail, FCM_PRIVATE_KEY: PEM },
      { FCM_PROJECT_ID: config.projectId, FCM_CLIENT_EMAIL: 'someone@gmail.com', FCM_PRIVATE_KEY: PEM },
      { FCM_PROJECT_ID: config.projectId, FCM_CLIENT_EMAIL: config.clientEmail, FCM_PRIVATE_KEY: 'not a key' }])
      assert.equal(fcm.parseFcmConfig(env), null)
    assert.equal(pushRuntimeFromEnv({ FCM_PROJECT_ID: config.projectId, FCM_CLIENT_EMAIL: config.clientEmail, FCM_PRIVATE_KEY: PEM }).fcm.projectId, config.projectId)
  })

  await test('OAuth assertion is an RS256 JWT verifiable with the service-account public key; token is cached', async () => {
    const fetchImpl = google()
    const escaped = { ...config, privateKey: PEM.replace(/\n/g, '\\n') } // secret pasted from JSON
    assert.equal((await fcm.sendFcm(TOKEN_A, payload, escaped, { fetchImpl })).outcome, 'SENT')
    await Promise.all([fcm.sendFcm(TOKEN_A, payload, escaped, { fetchImpl }), fcm.sendFcm(TOKEN_B, payload, escaped, { fetchImpl })])
    assert.equal(fetchImpl.calls.oauth.length, 1, 'one mint for all sends')
    const form = new URLSearchParams(fetchImpl.calls.oauth[0].body)
    assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer')
    const [h64, c64, s64] = form.get('assertion').split('.')
    assert.deepEqual(JSON.parse(Buffer.from(h64, 'base64url')), { alg: 'RS256', typ: 'JWT' })
    const claims = JSON.parse(Buffer.from(c64, 'base64url'))
    assert.equal(claims.iss, config.clientEmail)
    assert.equal(claims.aud, 'https://oauth2.googleapis.com/token')
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/firebase.messaging')
    assert.equal(claims.exp - claims.iat, 3600)
    assert.ok(createVerify('RSA-SHA256').update(`${h64}.${c64}`).verify(publicKey, Buffer.from(s64, 'base64url')))
    const send = fetchImpl.calls.send[0]
    assert.equal(send.init.headers.Authorization, 'Bearer ya29.test')
    assert.equal(fetchImpl.calls.oauth[0].redirect, 'manual')
    assert.equal(send.init.redirect, 'manual')
    assert.equal(send.body.message.token, TOKEN_A)
    assert.deepEqual(send.body.message.notification, { title: 'Judul', body: 'Isi' })
    assert.deepEqual(send.body.message.data, { id: 'n-1', url: '/portal-ortu/riwayat', tag: 'PORTAL_TRANSFER_DITERIMA' })
    assert.equal(send.body.message.android.notification.channel_id, 'default')
    assert.equal(send.body.message.android.notification.icon, 'ic_stat_ic_notification')
  })

  await test('FCM error mapping: dead tokens expire, quota/5xx retry, auth errors never blame the device', async () => {
    const cases = [
      [fcmError(404, 'UNREGISTERED'), 'EXPIRED', 'UNREGISTERED'],
      [fcmError(403, 'SENDER_ID_MISMATCH'), 'EXPIRED', 'SENDER_ID_MISMATCH'],
      [[302, {}], 'TRANSIENT', 'REDIRECT_BLOCKED'],
      [fcmError(429, 'QUOTA_EXCEEDED'), 'TRANSIENT', 'QUOTA_EXCEEDED'],
      [fcmError(503, 'UNAVAILABLE'), 'TRANSIENT', 'UNAVAILABLE'],
      [fcmError(400, 'INVALID_ARGUMENT'), 'REJECTED', 'INVALID_ARGUMENT'],
      [fcmError(403, 'THIRD_PARTY_AUTH_ERROR'), 'REJECTED', 'FCM_AUTH_REJECTED'],
      [[401, {}], 'REJECTED', 'FCM_AUTH_REJECTED'],
    ]
    for (const [response, outcome, code] of cases) {
      const r = await fcm.sendFcm(TOKEN_A, payload, config, { fetchImpl: google({ fcmStatus: () => response }) })
      assert.equal(r.outcome, outcome, code); assert.equal(r.errorCode, code)
    }
    assert.equal((await fcm.sendFcm(TOKEN_A, payload, config, { fetchImpl: google({ fcmStatus: () => new Error('ECONNRESET') }) })).outcome, 'TRANSIENT')
    assert.equal((await fcm.sendFcm('short', payload, config, { fetchImpl: google() })).errorCode, 'INVALID_TOKEN')
  })

  await test('401 from FCM drops the cached access token; OAuth failures are classified, not thrown', async () => {
    let status = 401
    const fetchImpl = google({ fcmStatus: () => [status, {}] })
    await fcm.sendFcm(TOKEN_A, payload, config, { fetchImpl })
    status = 200
    await fcm.sendFcm(TOKEN_A, payload, config, { fetchImpl })
    assert.equal(fetchImpl.calls.oauth.length, 2, 're-minted after 401')
    fcm.clearFcmTokenCache()
    assert.deepEqual(await fcm.sendFcm(TOKEN_A, payload, config, { fetchImpl: google({ oauth: () => [400, { error: 'invalid_grant' }] }) }),
      { outcome: 'REJECTED', httpStatus: null, errorCode: 'FCM_AUTH_REJECTED' })
    assert.deepEqual(await fcm.sendFcm(TOKEN_A, payload, config, { fetchImpl: google({ oauth: () => [302, {}] }) }),
      { outcome: 'TRANSIENT', httpStatus: null, errorCode: 'FCM_AUTH_UNAVAILABLE' })
    assert.equal((await fcm.sendFcm(TOKEN_A, payload, config, { fetchImpl: google({ oauth: () => [503, {}] }) })).outcome, 'TRANSIENT')
    assert.equal((await fcm.sendFcm(TOKEN_A, payload, config, { fetchImpl: google({ oauth: () => new Error('dns') }) })).outcome, 'TRANSIENT')
    assert.equal((await fcm.sendFcm(TOKEN_A, payload, { ...config, privateKey: '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----' },
      { fetchImpl: google() })).errorCode, 'FCM_AUTH_REJECTED')
  })

  await test('FCM device registration: validated, idempotent, multi-owner, channel-consistent', async () => {
    await assert.rejects(() => devices.registerFcmDevice(store, SANTRI('s-1'), 'bad token!'), /tidak valid/)
    const a = await devices.registerFcmDevice(store, SANTRI('s-1'), TOKEN_A, { platform: 'android' })
    const b = await devices.registerFcmDevice(store, SANTRI('s-1'), TOKEN_A)
    await devices.registerFcmDevice(store, SANTRI('s-2'), TOKEN_A)
    assert.equal(a.deviceId, b.deviceId)
    assert.equal(db.prepare("SELECT COUNT(*) n FROM notif_devices WHERE channel='FCM'").get().n, 1)
    assert.equal(db.prepare('SELECT COUNT(*) n FROM notif_device_links').get().n, 2)
    db.prepare("UPDATE notif_devices SET is_active=0, deactivated_reason='UNREGISTERED'").run()
    await devices.registerFcmDevice(store, SANTRI('s-1'), TOKEN_A)
    assert.equal(db.prepare('SELECT is_active FROM notif_devices').get().is_active, 1, 'fresh registration revives the token')
    assert.equal(await devices.unlinkByEndpoint(store, SANTRI('s-1'), TOKEN_A), 1)
  })

  await test('dispatch sends to FCM and Web Push devices together and handles a dead FCM token', async () => {
    const { webcrypto } = require('node:crypto')
    const ua = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const raw = Buffer.from(await webcrypto.subtle.exportKey('raw', ua.publicKey)).toString('base64url')
    const vapidPair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
    const vapid = {
      publicKey: Buffer.from(await webcrypto.subtle.exportKey('raw', vapidPair.publicKey)).toString('base64url'),
      privateKey: (await webcrypto.subtle.exportKey('jwk', vapidPair.privateKey)).d, subject: 'mailto:it@example.test',
    }
    await devices.registerWebPushDevice(store, SANTRI('s-1'), { endpoint: 'https://fcm.googleapis.com/fcm/send/web-1', keys: { p256dh: raw, auth: Buffer.alloc(16, 7).toString('base64url') } })
    await devices.registerFcmDevice(store, SANTRI('s-1'), TOKEN_A)
    await devices.registerFcmDevice(store, SANTRI('s-1'), TOKEN_B)
    const webCalls = []
    const g = google({ fcmStatus: token => token === TOKEN_B ? fcmError(404, 'UNREGISTERED') : [200, {}] })
    const fetchImpl = async (url, init) => {
      if (url.startsWith('https://fcm.googleapis.com/fcm/send/')) { webCalls.push(url); return new Response(null, { status: 201 }) }
      return g(url, init)
    }
    run(notifyStatement('PORTAL_TRANSFER_DITOLAK', 'MIX:1', { santri_id: 's-1', nama_santri: 'Ahmad', alasan: 'Bukti buram' }))
    const r = await processOutbox(store, { push: { webpush: vapid, fcm: config, fetchImpl } })
    assert.deepEqual({ sent: r.push.sent, expired: r.push.expired }, { sent: 2, expired: 1 })
    assert.equal(webCalls.length, 1)
    const sent = g.calls.send.find(c => c.body.message.token === TOKEN_A).body.message
    assert.equal(sent.android.priority, 'HIGH', 'danger level → high priority')
    assert.doesNotMatch(sent.notification.body, /Bukti buram/, 'lock screen stays masked')
    assert.equal(sent.data.url, '/portal-ortu/tagihan')
    assert.equal(db.prepare('SELECT is_active FROM notif_devices WHERE endpoint_or_token=?').get(TOKEN_B).is_active, 0)

    const def = requireEventDefinition('PORTAL_UANG_JAJAN_MASUK')
    await saveEventConfig(store, def.code, { enabled: true, mandatory: false, channels: ['in_app', 'webpush'], title: def.title, inApp: def.inApp, push: def.push, pushPrivacy: 'MASKED' }, 'u-admin')
    const before = g.calls.send.length
    run(notifyStatement(def.code, 'MIX:2', { santri_id: 's-1', nominal: 5000 }))
    await processOutbox(store, { push: { webpush: vapid, fcm: config, fetchImpl } })
    assert.equal(g.calls.send.length, before, 'fcm channel unchecked → no FCM send')
    assert.equal(webCalls.length, 2)
  })

  await test('FCM credential rejection keeps devices active and fails the delivery without retry storms', async () => {
    await devices.registerFcmDevice(store, SANTRI('s-1'), TOKEN_A)
    const g = google({ oauth: () => [401, { error: 'unauthorized_client' }] })
    run(notifyStatement('PORTAL_TRANSFER_DITERIMA', 'AUTH:1', { santri_id: 's-1' }))
    const r = await processOutbox(store, { push: { webpush: null, fcm: config, fetchImpl: g } })
    assert.equal(r.push.failed, 1)
    const row = db.prepare('SELECT status, error_code FROM notif_deliveries').get()
    assert.deepEqual({ ...row }, { status: 'FAILED', error_code: 'FCM_AUTH_REJECTED' })
    assert.deepEqual({ ...db.prepare('SELECT is_active, failure_count FROM notif_devices').get() }, { is_active: 1, failure_count: 0 })
  })

  console.log(`\n${count} FCM tests passed`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
