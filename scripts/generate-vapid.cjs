// Membuat pasangan kunci VAPID (P-256) untuk Web Push. Tidak menulis file apa pun dan
// tidak memanggil Cloudflare: hasil dicetak sekali ke terminal untuk dimasukkan sebagai secret.
//
//   node scripts/generate-vapid.cjs mailto:admin@domain-anda
//
// Buat pasangan BERBEDA untuk sandbox dan production. Mengganti kunci membuat semua langganan
// lama tidak berlaku; browser akan berlangganan ulang otomatis saat pengguna membuka aplikasi.
const { generateKeyPairSync } = require('node:crypto')

const subject = process.argv[2]
if (!subject || !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(subject)) {
  console.error('Pemakaian: node scripts/generate-vapid.cjs mailto:alamat@domain  (atau https://domain)')
  process.exit(1)
}

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ format: 'jwk' })
const priv = privateKey.export({ format: 'jwk' })
const b64 = s => Buffer.from(s, 'base64url')
const publicRaw = Buffer.concat([Buffer.from([0x04]), b64(pub.x), b64(pub.y)]).toString('base64url')

console.log(`
VAPID_PUBLIC_KEY=${publicRaw}
VAPID_PRIVATE_KEY=${priv.d}
VAPID_SUBJECT=${subject}

Pasang ketiganya sebagai secret di app Worker DAN worker notification-dispatch, per environment:

  Sandbox (app):        npx wrangler secret put VAPID_PUBLIC_KEY --env sandbox
  Sandbox (dispatch):   npx wrangler secret put VAPID_PUBLIC_KEY --config wrangler.notification-dispatch.jsonc
  Production (app):     npx wrangler secret put VAPID_PUBLIC_KEY
  Production (dispatch):npx wrangler secret put VAPID_PUBLIC_KEY --config wrangler.notification-dispatch.jsonc --env production

(ulangi untuk VAPID_PRIVATE_KEY dan VAPID_SUBJECT). Jangan simpan kunci privat di Git, .env, atau D1.
`)
