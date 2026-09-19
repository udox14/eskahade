// scripts/test-snap-crypto-ts.ts
// Direct TypeScript integration test for SNAP Virtual Account cryptography

import crypto from 'node:crypto'
import {
  getSnapTimestamp,
  generateSnapTokenSignature,
  verifySnapTokenSignature,
  minifyJsonBody,
  hashBodySha256,
  generateSnapRequestSignature,
  generateSnapNotificationSignature,
  verifySnapPaymentNotificationSignature,
} from '../lib/finance/gateway/duitku-snap'

async function main() {
  console.log('Testing TypeScript SNAP Cryptography Directly...')

  // 1. Generate real RSA 2048 keypair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  // 2. Test Token Signature (RSA-SHA256)
  const partnerId = '0070123456789'
  const timestamp = getSnapTimestamp()
  const tokenSig = generateSnapTokenSignature(partnerId, timestamp, privateKey)
  if (!tokenSig || tokenSig.length < 50) {
    throw new Error('Token signature is invalid or too short.')
  }
  const isTokenValid = verifySnapTokenSignature(partnerId, timestamp, tokenSig, publicKey)
  if (!isTokenValid) {
    throw new Error('Token signature verification failed.')
  }
  console.log('✓ Token RSA-SHA256 signature generated and verified.')

  // 3. Test Outbound Request Signature (HMAC-SHA512)
  const clientSecret = 'super_secret_client_key_999'
  const endpoint = '/v1.0/transfer-va/create-va'
  const body = {
    partnerServiceId: '0070',
    customerNo: '10001',
    trxId: 'ORD-001',
    totalAmount: { value: '500000.00', currency: 'IDR' },
  }
  const token = 'mock_b2b_access_token'
  const reqSig = generateSnapRequestSignature('POST', endpoint, token, body, timestamp, clientSecret)
  if (!reqSig || reqSig.length < 40) {
    throw new Error('Request signature is invalid or too short.')
  }
  console.log('✓ Outbound HMAC-SHA512 request signature generated.')

  // 4. Test Inbound Notification Signature (RSA-SHA256)
  const notifBody = {
    partnerServiceId: '0070',
    customerNo: '10001',
    virtualAccountNo: '007010001',
    paymentRequestId: 'PAY-REQ-001',
    trxId: 'ORD-001',
    paidAmount: { value: '500000.00', currency: 'IDR' },
    additionalInfo: { reference: 'DUITKU-REF-001' },
  }
  const notifEndpoint = '/v1.0/transfer-va/payment'
  const notifSig = generateSnapNotificationSignature('POST', notifEndpoint, notifBody, timestamp, privateKey)

  const isNotifValid = verifySnapPaymentNotificationSignature(
    'POST',
    notifEndpoint,
    notifBody,
    timestamp,
    notifSig,
    publicKey
  )
  if (!isNotifValid) {
    throw new Error('Notification signature verification failed.')
  }
  console.log('✓ Inbound notification RSA-SHA256 verified successfully with Public Key.')

  // 5. Tamper test: Alter body amount
  const tamperedBody = {
    ...notifBody,
    paidAmount: { value: '500001.00', currency: 'IDR' },
  }
  const isTamperBodyValid = verifySnapPaymentNotificationSignature(
    'POST',
    notifEndpoint,
    tamperedBody,
    timestamp,
    notifSig,
    publicKey
  )
  if (isTamperBodyValid) {
    throw new Error('Tampered body must NOT pass signature verification!')
  }
  console.log('✓ Tampered payload amount successfully rejected.')

  // 6. Tamper test: Alter timestamp
  const isTamperTimeValid = verifySnapPaymentNotificationSignature(
    'POST',
    notifEndpoint,
    notifBody,
    '2026-01-01T00:00:00+07:00',
    notifSig,
    publicKey
  )
  if (isTamperTimeValid) {
    throw new Error('Tampered timestamp must NOT pass signature verification!')
  }
  console.log('✓ Tampered timestamp successfully rejected.')

  console.log('\nALL DIRECT TYPESCRIPT SNAP CRYPTOGRAPHY TESTS PASSED!')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
