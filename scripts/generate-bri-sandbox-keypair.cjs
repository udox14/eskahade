// scripts/generate-bri-sandbox-keypair.cjs
// Generates RSA 2048 keypair for BRI Sandbox and verifies sign/verify locally.
// NEVER outputs or logs private key material.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECRETS_DIR = path.resolve(__dirname, '..', '.secrets');
const PRIVATE_KEY_PATH = path.join(SECRETS_DIR, 'bri-sandbox-private.pem');
const PUBLIC_KEY_PATH = path.join(SECRETS_DIR, 'bri-sandbox-public.pem');

if (!fs.existsSync(SECRETS_DIR)) {
  fs.mkdirSync(SECRETS_DIR, { recursive: true });
}

let privateKeyPem;
let publicKeyPem;

if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
  console.log('Existing keypair found in .secrets/');
  privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
  publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
} else {
  console.log('Generating new RSA 2048 keypair for BRI Sandbox...');
  const keypair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, keypair.privateKey, { mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY_PATH, keypair.publicKey, { mode: 0o644 });
  privateKeyPem = keypair.privateKey;
  publicKeyPem = keypair.publicKey;
  console.log('Keypair generated and saved to .secrets/');
}

// Verification using exact logic from lib/finance/bri/crypto.ts
const testClientKey = 'TEST_CLIENT_KEY_FOR_LOCAL_VERIFICATION';
const testTimestamp = '2026-10-09T12:00:00.000+07:00';
const stringToSign = `${testClientKey}|${testTimestamp}`;

let signVerifyPassed = false;
try {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(stringToSign, 'utf8');
  const signature = sign.sign(privateKeyPem, 'base64');

  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(stringToSign, 'utf8');
  signVerifyPassed = verify.verify(publicKeyPem, signature, 'base64');
} catch (err) {
  console.error('Sign/Verify error:', err.message);
}

console.log('RSA KEYPAIR GENERATED:', fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH) ? 'YES' : 'NO');
console.log('RSA LOCAL SIGN/VERIFY:', signVerifyPassed ? 'PASS' : 'FAIL');
console.log('PUBLIC KEY PATH:', PUBLIC_KEY_PATH);
console.log('PRIVATE KEY PATH:', PRIVATE_KEY_PATH);
console.log('PRIVATE KEY FILE SIZE (bytes):', fs.statSync(PRIVATE_KEY_PATH).size);
console.log('PUBLIC KEY FILE SIZE (bytes):', fs.statSync(PUBLIC_KEY_PATH).size);
