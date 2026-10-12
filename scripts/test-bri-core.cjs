// scripts/test-bri-core.cjs
// Comprehensive Unit & Integration Test Suite for BRI-2 Security & Core Adapter (Hardened)

const assert = require('node:assert')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')

// Setup TypeScript loader for testing TS files directly in Node
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request.startsWith('@/')) {
    request = path.join(root, request.slice(2))
  }
  return originalLoad.call(this, request, parent, isMain)
}

require.extensions['.ts'] = (mod, file) => {
  const content = fs.readFileSync(file, 'utf8')
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  return mod._compile(transpiled, file)
}

async function runTestSuite() {
  console.log('=================================================================')
  console.log('BRI-2: RUNNING HARDENED SECURITY & CORE ADAPTER TEST SUITE')
  console.log('=================================================================\n')

  const {
    BriError,
    isBriError,
    loadBriConfig,
    BRI_DEFAULT_SANDBOX_BASE_URL,
    BRI_DEFAULT_PRODUCTION_BASE_URL,
    getBriTimestamp,
    minifyJsonBody,
    hashBodySha256,
    generateBriTokenSignature,
    verifyBriTokenSignature,
    generateBriBusinessSignature,
    verifyBriBusinessSignature,
    generateBriInboundNotificationSignature,
    verifyBriInboundNotificationSignature,
    BriTokenClient,
    BriClient,
    validateExternalId,
    generateExternalIdForPolicy,
    generateCorrelationId,
    BRI_ENDPOINT_EXTERNAL_ID_POLICIES,
    redactSecrets,
    maskVa,
    maskAccount,
    sanitizePayload,
    resolveBriOutcome,
    isKnownTokenAuthError,
  } = require('../lib/finance/bri/index.ts')

  // Generate test RSA 2048 keypair for local test harness
  const { privateKey: testPrivateKey, publicKey: testPublicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  const validTestConfig = {
    env: 'sandbox',
    baseUrl: 'https://sandbox.partner.api.bri.co.id',
    clientKey: 'test_client_key_123',
    clientId: 'test_client_key_123',
    partnerId: 'PARTNER_KOPERASI_001',
    clientSecret: 'test_client_secret_xyz_987',
    privateKey: testPrivateKey,
    timestampOffsetHours: 7,
    channelId: '00009',
    timeoutMs: 5000,
    outboundEnabled: true,
  }

  // =========================================================================
  // 1. CONFIG & CANONICAL CLIENT KEY TESTS
  // =========================================================================
  console.log('--- 1. Config, Environment & Canonical Client Key Tests ---')

  // Test 1.1: Missing environment throws CONFIG_ERROR
  assert.throws(
    () => {
      loadBriConfig({}, { BRI_ENV: 'staging', BRI_CLIENT_KEY: 'k1', BRI_CLIENT_SECRET: 's', BRI_PRIVATE_KEY: testPrivateKey })
    },
    /Invalid BRI_ENV "staging"/,
    'Invalid environment must throw CONFIG_ERROR'
  )
  console.log('✓ 1.1: Invalid environment rejected fail-closed.')

  // Test 1.2: Client ID vs Client Key mismatch throws CONFIG_ERROR
  assert.throws(
    () => {
      loadBriConfig(
        {},
        {
          BRI_ENV: 'sandbox',
          BRI_CLIENT_KEY: 'key_value_A',
          BRI_CLIENT_ID: 'key_value_B',
          BRI_CLIENT_SECRET: 'sec',
          BRI_PRIVATE_KEY: testPrivateKey,
        }
      )
    },
    /Configuration conflict: BRI_CLIENT_KEY and BRI_CLIENT_ID are both set but have different values/,
    'Mismatch between clientKey and clientId must fail closed'
  )
  console.log('✓ 1.2: BRI_CLIENT_KEY and BRI_CLIENT_ID mismatch rejected fail-closed.')

  // Test 1.3: Unified canonical clientKey used
  const cfgKeyOnly = loadBriConfig(
    {},
    {
      BRI_ENV: 'sandbox',
      BRI_CLIENT_KEY: 'my_canonical_key',
      BRI_CLIENT_SECRET: 'sec',
      BRI_PRIVATE_KEY: testPrivateKey,
    }
  )
  assert.strictEqual(cfgKeyOnly.clientKey, 'my_canonical_key')
  assert.strictEqual(cfgKeyOnly.clientId, 'my_canonical_key')
  console.log('✓ 1.3: Canonical clientKey successfully resolved.')

  // Test 1.4: Production with sandbox credentials rejected
  assert.throws(
    () => {
      loadBriConfig(
        {},
        {
          BRI_ENV: 'production',
          BRI_CLIENT_KEY: 'test_dummy_key',
          BRI_CLIENT_SECRET: 'sandbox_secret_123',
          BRI_PRIVATE_KEY: testPrivateKey,
        }
      )
    },
    /Production environment cannot use sandbox or test Client Key\/ID/,
    'Production environment with sandbox credentials must be rejected'
  )
  console.log('✓ 1.4: Production with sandbox credentials rejected fail-closed.')

  // Test 1.5: Kill switch defaults to OFF (outboundEnabled: false)
  const defaultCfg = loadBriConfig(
    {},
    {
      BRI_ENV: 'sandbox',
      BRI_CLIENT_KEY: 'ckey',
      BRI_CLIENT_SECRET: 'csec',
      BRI_PRIVATE_KEY: testPrivateKey,
    }
  )
  assert.strictEqual(defaultCfg.outboundEnabled, false, 'Kill switch must default to false/OFF')
  console.log('✓ 1.5: Operational kill switch defaults to OFF (fail closed).')

  // =========================================================================
  // 2. CRYPTO TESTS (RSA Token & HMAC Business & Inbound)
  // =========================================================================
  console.log('\n--- 2. Cryptographic Contract Tests ---')

  const sampleTimestamp = '2026-10-08T12:00:00.000+07:00'
  const sampleClientKey = '0070123456789'

  // Test 2.1: RSA Token Signature & Verification (SELF-TEST)
  const tokenSig = generateBriTokenSignature(sampleClientKey, sampleTimestamp, testPrivateKey)
  assert.ok(tokenSig && tokenSig.length > 50)
  const isTokenSigValid = verifyBriTokenSignature(sampleClientKey, sampleTimestamp, tokenSig, testPublicKey)
  assert.strictEqual(isTokenSigValid, true)
  console.log('✓ 2.1: [CRYPTO SELF-TEST: PASSED] RSA-SHA256 token signature generated and verified.')

  // Test 2.2: Tampered timestamp in RSA token signature fails
  assert.strictEqual(verifyBriTokenSignature(sampleClientKey, '2026-10-08T12:00:01.000+07:00', tokenSig, testPublicKey), false)
  console.log('✓ 2.2: Tampered timestamp in token signature rejected.')

  // Test 2.3: Empty body produces empty string signature segment ("")
  const noBodySigResult = generateBriBusinessSignature({
    method: 'GET',
    endpointPath: '/snap/v1.0/bank-statement',
    accessToken: 'test_token',
    body: undefined, // No body
    timestamp: sampleTimestamp,
    clientSecret: 'secret_123',
  })
  // stringToSign should end with ::timestamp (empty segment between colons)
  assert.ok(
    noBodySigResult.stringToSign.includes(':test_token::'),
    `No body must produce empty body segment. Got: ${noBodySigResult.stringToSign}`
  )
  assert.strictEqual(noBodySigResult.bodyHash, '')
  console.log('✓ 2.3: No body explicitly produces empty string signature segment ("::").')

  // Test 2.4: Empty JSON object "{}" is treated as body and hashed
  const emptyObjSigResult = generateBriBusinessSignature({
    method: 'POST',
    endpointPath: '/snap/v1.0/bank-statement',
    accessToken: 'test_token',
    body: {}, // Body IS provided as empty object
    timestamp: sampleTimestamp,
    clientSecret: 'secret_123',
  })
  const expectedEmptyObjHash = crypto.createHash('sha256').update('{}', 'utf8').digest('hex').toLowerCase()
  assert.strictEqual(emptyObjSigResult.bodyHash, expectedEmptyObjHash)
  assert.ok(emptyObjSigResult.stringToSign.includes(`:test_token:${expectedEmptyObjHash}:`))
  assert.notStrictEqual(noBodySigResult.signature, emptyObjSigResult.signature, 'No body and "{}" must NOT produce identical signatures')
  console.log('✓ 2.4: Empty object "{}" is hashed as body and differs from no-body.')

  // Test 2.5: Host-independent timestamp generation
  const fixedUtcDate = new Date('2026-10-08T05:00:00.000Z')
  const wibTime = getBriTimestamp(fixedUtcDate, 7)
  const utcTime = getBriTimestamp(fixedUtcDate, 0)
  assert.strictEqual(wibTime, '2026-10-08T12:00:00.000+07:00', 'WIB offset must be exactly +7 hours from UTC')
  assert.strictEqual(utcTime, '2026-10-08T05:00:00.000Z', 'UTC offset must be exactly Z')
  console.log('✓ 2.5: Timestamp formatting is deterministic and host-timezone independent.')

  // Test 2.6: BRIVA Inbound Webhook uses HMAC-SHA512, NOT RSA
  const notifPayload = {
    partnerServiceId: '0070',
    customerNo: '10001',
    virtualAccountNo: '007010001',
    paymentRequestId: 'PAY-REQ-001',
    paidAmount: { value: '500000.00', currency: 'IDR' },
  }
  const notifSig = generateBriInboundNotificationSignature({
    method: 'POST',
    endpointPath: '/v1.0/transfer-va/payment',
    accessToken: 'mock_token',
    body: notifPayload,
    timestamp: sampleTimestamp,
    clientSecret: 'secret_123',
  })
  assert.ok(notifSig && notifSig.length > 40)
  const isNotifValid = verifyBriInboundNotificationSignature({
    method: 'POST',
    endpointPath: '/v1.0/transfer-va/payment',
    accessToken: 'mock_token',
    body: notifPayload,
    timestamp: sampleTimestamp,
    clientSecret: 'secret_123',
    signatureBase64: notifSig,
  })
  assert.strictEqual(isNotifValid, true, 'BRIVA Inbound notification HMAC-SHA512 signature must verify successfully')
  console.log('✓ 2.6: [CRYPTO SELF-TEST: PASSED] BRIVA Inbound notification verifies with HMAC-SHA512 (not RSA).')

  // =========================================================================
  // 3. X-EXTERNAL-ID POLICY TESTS (PRODUCT-AWARE)
  // =========================================================================
  console.log('\n--- 3. X-EXTERNAL-ID Product-Aware Policy Tests ---')

  // Test 3.1: Universal 16-digit default is rejected (Contract-aware enforcement)
  const mockTokenClient = {
    getAccessToken: async () => 'test_token',
    invalidateTokenCache: async () => {},
  }
  const dummyClient = new BriClient({ config: validTestConfig, tokenClient: mockTokenClient })
  await assert.rejects(
    async () => {
      await dummyClient.executeSignedRequest({
        method: 'POST',
        endpointPath: '/v1.0/transfer-va/create-va',
        body: {},
        // No externalId and no externalIdPolicy provided!
      })
    },
    /X-EXTERNAL-ID contract is endpoint-specific and cannot use a universal default/,
    'Missing external ID and policy must fail closed'
  )
  console.log('✓ 3.1: Universal default external-ID rejected fail-closed.')

  // Test 3.2: BRIVA Online 36-digit numeric policy accepted
  const brivaExtId = generateExternalIdForPolicy(BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BRIVA_ONLINE)
  assert.strictEqual(brivaExtId.length, 36)
  assert.ok(/^\d{36}$/.test(brivaExtId), 'BRIVA external ID must be strictly 36 numeric digits')
  validateExternalId(brivaExtId, BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BRIVA_ONLINE)
  console.log('✓ 3.2: BRIVA Online 36-digit numeric external-ID policy validated.')

  // Test 3.3: Invalid BRIVA Online external ID rejected (length mismatch or non-numeric)
  assert.throws(
    () => {
      validateExternalId('12345', BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BRIVA_ONLINE)
    },
    /X-EXTERNAL-ID length mismatch for BRIVA Online/,
    'Invalid length for BRIVA external ID must throw'
  )
  assert.throws(
    () => {
      validateExternalId('A'.repeat(36), BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BRIVA_ONLINE)
    },
    /X-EXTERNAL-ID must be strictly numeric/,
    'Non-numeric string for BRIVA external ID must throw'
  )
  console.log('✓ 3.3: Invalid BRIVA Online external-ID length and characters rejected.')

  // Test 3.4: Bank Statement 9-digit numeric policy validated
  const bsExtId = generateExternalIdForPolicy(BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT)
  assert.strictEqual(bsExtId.length, 9)
  assert.ok(/^\d{9}$/.test(bsExtId), 'Bank Statement external ID must be strictly 9 numeric digits')
  validateExternalId(bsExtId, BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT)
  console.log('✓ 3.4: Bank Statement 9-digit numeric external-ID policy validated.')

  // =========================================================================
  // 4. X-PARTNER-ID BUSINESS HEADER TESTS
  // =========================================================================
  console.log('\n--- 4. X-PARTNER-ID Header & Isolation Tests ---')

  // Test 4.1: Missing X-PARTNER-ID throws CONFIG_ERROR
  const noPartnerClient = new BriClient({
    config: { ...validTestConfig, partnerId: '' },
    tokenClient: mockTokenClient,
  })
  await assert.rejects(
    async () => {
      await noPartnerClient.executeSignedRequest({
        method: 'POST',
        endpointPath: '/snap/v1.0/bank-statement',
        externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT,
      })
    },
    /Missing required X-PARTNER-ID for BRI business API request/,
    'Missing partnerId must fail closed'
  )
  console.log('✓ 4.1: Missing X-PARTNER-ID fails closed.')

  // Test 4.2: Header sent matches partnerId exactly
  let capturedHeaders = null
  const mockFetchCapture = async (url, opts) => {
    capturedHeaders = opts.headers
    return new Response(JSON.stringify({ responseCode: '2007300', responseMessage: 'Success' }), { status: 200 })
  }
  const captureClient = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: mockFetchCapture,
  })
  await captureClient.executeSignedRequest({
    method: 'POST',
    endpointPath: '/snap/v1.0/bank-statement',
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT,
  })
  assert.strictEqual(capturedHeaders['X-PARTNER-ID'], 'PARTNER_KOPERASI_001')
  assert.ok(capturedHeaders['X-TIMESTAMP'])
  assert.ok(capturedHeaders['X-SIGNATURE'])
  console.log('✓ 4.2: Exact X-PARTNER-ID header injected into business request.')

  // =========================================================================
  // 5. TOKEN EXPIRY & ISOLATE LIMITATION TESTS
  // =========================================================================
  console.log('\n--- 5. Token Response Parsing & Isolate Lifecycle Tests ---')

  // Test 5.1: Numeric string "899" accepted
  let mockTokenCalls = 0
  const tokenClient899 = new BriTokenClient({
    config: validTestConfig,
    customFetch: async () => {
      mockTokenCalls++
      return new Response(
        JSON.stringify({
          responseCode: '2007300',
          responseMessage: 'Success',
          accessToken: 'tok_899',
          tokenType: 'Bearer',
          expiresIn: '899',
        }),
        { status: 200 }
      )
    },
  })
  const t1 = await tokenClient899.getAccessToken()
  assert.strictEqual(t1, 'tok_899')
  console.log('✓ 5.1: Numeric string "899" authoritative expiresIn parsed correctly.')

  // Test 5.2: Malformed non-numeric expiresIn throws TOKEN_ERROR
  const tokenClientMalformed = new BriTokenClient({
    config: validTestConfig,
    customFetch: async () => {
      return new Response(
        JSON.stringify({
          accessToken: 'tok_bad',
          expiresIn: 'invalid_expiry_string',
        }),
        { status: 200 }
      )
    },
  })
  await assert.rejects(
    async () => {
      await tokenClientMalformed.getAccessToken()
    },
    (err) => {
      assert.ok(isBriError(err))
      assert.strictEqual(err.category, 'TOKEN_ERROR')
      return true
    },
    'Non-numeric expiresIn must throw TOKEN_ERROR'
  )
  console.log('✓ 5.2: Malformed non-numeric expiresIn rejected with TOKEN_ERROR.')

  // Test 5.3: Zero / negative expiresIn throws TOKEN_ERROR
  const tokenClientZero = new BriTokenClient({
    config: validTestConfig,
    customFetch: async () => {
      return new Response(
        JSON.stringify({
          accessToken: 'tok_bad',
          expiresIn: 0,
        }),
        { status: 200 }
      )
    },
  })
  await assert.rejects(
    async () => {
      await tokenClientZero.getAccessToken()
    },
    (err) => {
      assert.ok(isBriError(err))
      assert.strictEqual(err.category, 'TOKEN_ERROR')
      return true
    },
    'Zero expiresIn must throw TOKEN_ERROR'
  )
  console.log('✓ 5.3: Zero/negative expiresIn rejected with TOKEN_ERROR.')

  // =========================================================================
  // 6. NETWORK UNKNOWN OUTCOME & TIMEOUT SAFETY TESTS (NO BLIND RETRY)
  // =========================================================================
  console.log('\n--- 6. Network Failure Unknown Outcome & Zero Blind Retry Tests ---')

  let fetchAttempts = 0
  const mockFetchConnectionDrop = async () => {
    fetchAttempts++
    // Simulate socket reset / drop after connection starts
    throw new Error('fetch failed: ECONNRESET')
  }

  const dropClient = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: mockFetchConnectionDrop,
  })

  fetchAttempts = 0
  await assert.rejects(
    async () => {
      await dropClient.executeSignedRequest({
        method: 'POST',
        endpointPath: '/v1.0/transfer-va/create-va',
        externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BRIVA_ONLINE,
        body: { amount: 100000 },
      })
    },
    (err) => {
      assert.ok(isBriError(err))
      assert.strictEqual(err.category, 'NETWORK_UNKNOWN')
      assert.strictEqual(err.outcomeKnown, false, 'Outcome must be marked as UNKNOWN (outcomeKnown: false)')
      assert.ok(err.message.includes('DO NOT retry blindly'))
      return true
    },
    'In-flight network error must yield NETWORK_UNKNOWN with outcomeKnown: false'
  )

  // Strictly 0 blind retries
  assert.strictEqual(fetchAttempts, 1, 'Client must NOT blind retry upon network failure!')
  console.log('✓ 6.1: In-flight network failure classified as NETWORK_UNKNOWN (outcomeKnown: false) with 0 blind retries.')

  // Test 6.2: Timeout yields TIMEOUT_UNKNOWN with outcomeKnown: false and 0 retries
  let timeoutAttempts = 0
  const mockFetchTimeout = async (url, opts) => {
    timeoutAttempts++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response('{}', { status: 200 })), 300)
      if (opts && opts.signal) {
        opts.signal.addEventListener('abort', () => {
          clearTimeout(timer)
          const abortErr = new Error('The operation was aborted')
          abortErr.name = 'AbortError'
          reject(abortErr)
        })
      }
    })
  }

  const timeoutClient = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: mockFetchTimeout,
  })

  timeoutAttempts = 0
  await assert.rejects(
    async () => {
      await timeoutClient.executeSignedRequest({
        method: 'POST',
        endpointPath: '/v1.0/transfer-va/create-va',
        externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BRIVA_ONLINE,
        body: { amount: 100000 },
        timeoutMs: 50,
      })
    },
    (err) => {
      assert.ok(isBriError(err))
      assert.strictEqual(err.category, 'TIMEOUT_UNKNOWN')
      assert.strictEqual(err.outcomeKnown, false, 'Timeout outcome must be marked as UNKNOWN')
      return true
    }
  )
  assert.strictEqual(timeoutAttempts, 1, 'Client must NOT blind retry upon timeout!')
  console.log('✓ 6.2: Timeout classified as TIMEOUT_UNKNOWN (outcomeKnown: false) with 0 blind retries.')

  // =========================================================================
  // 7. SECRET REDACTION & DATA LEAKAGE AUDIT TESTS
  // =========================================================================
  console.log('\n--- 7. Secret Redaction & Leakage Audit Tests ---')

  const sensitiveLog = `Bearer my_secret_token_12345678 and -----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY----- with clientSecret=super_secret`
  const sanitizedStr = redactSecrets(sensitiveLog)
  assert.ok(!sanitizedStr.includes('my_secret_token_12345678'))
  assert.ok(!sanitizedStr.includes('MIIEvgIBADANBgkqhkiG9w0BAQEFAASC'))
  assert.ok(!sanitizedStr.includes('super_secret'))
  console.log('✓ 7.1: Redaction of Bearer token, PEM key, and client secret verified.')

  const rawPayload = {
    virtualAccountNo: '1234567890123456',
    accountNumber: '9876543210',
    clientSecret: 'secret123',
    privateKey: testPrivateKey,
    amount: 150000,
  }
  const sanitizedObj = sanitizePayload(rawPayload)
  assert.strictEqual(sanitizedObj.clientSecret, '[REDACTED]')
  assert.strictEqual(sanitizedObj.privateKey, '[REDACTED]')
  assert.ok(sanitizedObj.virtualAccountNo.includes('****'))
  assert.ok(sanitizedObj.accountNumber.includes('***'))
  console.log('✓ 7.2: Payload masking (VA, account, secrets) verified.')

  // =========================================================================
  // 8. TRANSPORT VS BUSINESS OUTCOME DECOUPLING & REGRESSION TESTS
  // =========================================================================
  console.log('\n--- 8. Transport vs Business Outcome Decoupling & Regression Tests ---')

  // Test 8.1: HTTP 200 + responseCode sukses -> outcome SUCCESS, outcomeKnown = true
  const client200 = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: async () => new Response(JSON.stringify({ responseCode: '2007300', responseMessage: 'Success' }), { status: 200 }),
  })
  const res200 = await client200.executeSignedRequest({
    method: 'POST',
    endpointPath: '/snap/v1.0/bank-statement',
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT,
  })
  assert.strictEqual(res200.status, 200)
  assert.strictEqual(res200.outcome.classification, 'SUCCESS')
  assert.strictEqual(res200.outcome.outcomeKnown, true)
  assert.strictEqual(res200.outcome.isTerminal, true)
  assert.strictEqual(res200.outcome.requiresInquiryOrReconciliation, false)
  console.log('✓ 8.1: HTTP 200 + success code yields SUCCESS with outcomeKnown: true.')

  // Test 8.2: HTTP 202 -> outcome PENDING, outcomeKnown = false (not terminal success)
  const client202 = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: async () =>
      new Response(JSON.stringify({ responseCode: '2027300', responseMessage: 'Request In Progress' }), { status: 202 }),
  })
  const res202 = await client202.executeSignedRequest({
    method: 'POST',
    endpointPath: '/v1.0/transfer-va/create-va',
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BRIVA_ONLINE,
  })
  assert.strictEqual(res202.status, 202)
  assert.strictEqual(res202.outcome.classification, 'PENDING')
  assert.strictEqual(res202.outcome.outcomeKnown, false, 'HTTP 202 must NOT have outcomeKnown=true')
  assert.strictEqual(res202.outcome.isTerminal, false)
  assert.strictEqual(res202.outcome.requiresInquiryOrReconciliation, true)
  console.log('✓ 8.2: HTTP 202 classified as PENDING with outcomeKnown: false (NOT terminal success).')

  // Test 8.3: HTTP 400 dengan responseCode unknown/unlisted -> outcome PROVIDER_OUTCOME_UNKNOWN, outcomeKnown = false
  const client400 = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: async () =>
      new Response(JSON.stringify({ responseCode: '4009999', responseMessage: 'Unrecognized Bank Code' }), { status: 400 }),
  })
  const res400 = await client400.executeSignedRequest({
    method: 'POST',
    endpointPath: '/snap/v1.0/bank-statement',
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT,
  })
  assert.strictEqual(res400.status, 400)
  assert.strictEqual(res400.outcome.classification, 'PROVIDER_OUTCOME_UNKNOWN')
  assert.strictEqual(res400.outcome.outcomeKnown, false, 'Unlisted response code must fail-safe to outcomeKnown: false')
  assert.strictEqual(res400.outcome.isTerminal, false)
  assert.strictEqual(res400.outcome.requiresInquiryOrReconciliation, true)
  console.log('✓ 8.3: HTTP 400 with unlisted code yields PROVIDER_OUTCOME_UNKNOWN (outcomeKnown: false, not fatal).')

  // Test 8.4: HTTP 403 bisnis (contoh: Feature Not Allowed) -> TIDAK menginvalidasi token cache
  let tokenInvalidated = false
  const trackingTokenClient = {
    getAccessToken: async () => 'valid_token_xyz',
    invalidateTokenCache: async () => {
      tokenInvalidated = true
    },
  }
  const client403Biz = new BriClient({
    config: validTestConfig,
    tokenClient: trackingTokenClient,
    customFetch: async () =>
      new Response(JSON.stringify({ responseCode: '4037301', responseMessage: 'Feature Not Allowed' }), { status: 403 }),
  })
  tokenInvalidated = false
  const res403Biz = await client403Biz.executeSignedRequest({
    method: 'POST',
    endpointPath: '/snap/v1.0/bank-statement',
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT,
    responsePolicy: {
      terminalRejectionCodes: ['4037301'],
    },
  })
  assert.strictEqual(res403Biz.status, 403)
  assert.strictEqual(res403Biz.outcome.classification, 'TERMINAL_REJECTED')
  assert.strictEqual(tokenInvalidated, false, 'Business 403 must NOT invalidate OAuth token cache!')
  console.log('✓ 8.4: Business HTTP 403 Feature Not Allowed does NOT invalidate token cache.')

  // Test 8.5: HTTP 401 / error token SNAP BI -> menginvalidasi token cache
  tokenInvalidated = false
  const client401Auth = new BriClient({
    config: validTestConfig,
    tokenClient: trackingTokenClient,
    customFetch: async () =>
      new Response(JSON.stringify({ responseCode: '4017300', responseMessage: 'Unauthorized [Invalid Token]' }), { status: 401 }),
  })
  const res401Auth = await client401Auth.executeSignedRequest({
    method: 'POST',
    endpointPath: '/snap/v1.0/bank-statement',
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT,
  })
  assert.strictEqual(res401Auth.status, 401)
  assert.strictEqual(res401Auth.outcome.classification, 'AUTH_FAILURE')
  assert.strictEqual(tokenInvalidated, true, 'SNAP BI token auth error must invalidate token cache!')
  console.log('✓ 8.5: HTTP 401 SNAP BI token auth error correctly invalidates token cache.')

  // Test 8.6: HTTP 429 -> SUSPEND_INVESTIGATE, outcomeKnown = false, NO BLIND RETRY
  let calls429 = 0
  const client429 = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: async () => {
      calls429++
      return new Response(JSON.stringify({ responseCode: '4297300', responseMessage: 'Too Many Requests' }), { status: 429 })
    },
  })
  calls429 = 0
  const res429 = await client429.executeSignedRequest({
    method: 'POST',
    endpointPath: '/snap/v1.0/bank-statement',
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT,
  })
  assert.strictEqual(res429.status, 429)
  assert.strictEqual(res429.outcome.classification, 'SUSPEND_INVESTIGATE')
  assert.strictEqual(res429.outcome.outcomeKnown, false)
  assert.strictEqual(calls429, 1, 'Client must NOT blind retry upon HTTP 429!')
  console.log('✓ 8.6: HTTP 429 yields SUSPEND_INVESTIGATE (outcomeKnown: false) with 0 blind retries.')

  // Test 8.7: HTTP 500 -> SUSPEND_INVESTIGATE, outcomeKnown = false, NO BLIND RETRY
  let calls500 = 0
  const client500 = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: async () => {
      calls500++
      return new Response(JSON.stringify({ responseCode: '5007300', responseMessage: 'Internal Server Error' }), { status: 500 })
    },
  })
  calls500 = 0
  const res500 = await client500.executeSignedRequest({
    method: 'POST',
    endpointPath: '/snap/v1.0/bank-statement',
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT,
  })
  assert.strictEqual(res500.status, 500)
  assert.strictEqual(res500.outcome.classification, 'SUSPEND_INVESTIGATE')
  assert.strictEqual(res500.outcome.outcomeKnown, false)
  assert.strictEqual(calls500, 1, 'Client must NOT blind retry upon HTTP 500!')
  console.log('✓ 8.7: HTTP 500 yields SUSPEND_INVESTIGATE (outcomeKnown: false) with 0 blind retries.')

  // Test 8.8: HTTP 504 -> SUSPEND_INVESTIGATE, outcomeKnown = false
  const client504 = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: async () =>
      new Response(JSON.stringify({ responseCode: '5047300', responseMessage: 'Gateway Timeout' }), { status: 504 }),
  })
  const res504 = await client504.executeSignedRequest({
    method: 'POST',
    endpointPath: '/snap/v1.0/bank-statement',
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT,
  })
  assert.strictEqual(res504.status, 504)
  assert.strictEqual(res504.outcome.classification, 'SUSPEND_INVESTIGATE')
  assert.strictEqual(res504.outcome.outcomeKnown, false)
  assert.strictEqual(res504.outcome.requiresInquiryOrReconciliation, true)
  console.log('✓ 8.8: HTTP 504 yields SUSPEND_INVESTIGATE with outcomeKnown: false.')

  // Test 8.9: Endpoint policy dengan listed terminal rejection code -> TERMINAL_REJECTED, outcomeKnown = true
  const customPolicy = {
    endpointName: 'BRIVA_UPDATE',
    terminalRejectionCodes: ['4047300', '4037301'],
  }
  const clientListedReject = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: async () =>
      new Response(JSON.stringify({ responseCode: '4047300', responseMessage: 'VA Not Found' }), { status: 404 }),
  })
  const resListedReject = await clientListedReject.executeSignedRequest({
    method: 'POST',
    endpointPath: '/v1.0/transfer-va/update-va',
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BRIVA_ONLINE,
    responsePolicy: customPolicy,
  })
  assert.strictEqual(resListedReject.outcome.classification, 'TERMINAL_REJECTED')
  assert.strictEqual(resListedReject.outcome.outcomeKnown, true)
  assert.strictEqual(resListedReject.outcome.isTerminal, true)
  console.log('✓ 8.9: Listed terminal rejection code in policy yields TERMINAL_REJECTED (outcomeKnown: true).')

  // Test 8.10: Endpoint policy dengan unlisted provider code -> PROVIDER_OUTCOME_UNKNOWN, outcomeKnown = false
  const clientUnlisted = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: async () =>
      new Response(JSON.stringify({ responseCode: '4999999', responseMessage: 'Unforeseen Bank Code' }), { status: 400 }),
  })
  const resUnlisted = await clientUnlisted.executeSignedRequest({
    method: 'POST',
    endpointPath: '/v1.0/transfer-va/update-va',
    externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BRIVA_ONLINE,
    responsePolicy: customPolicy,
  })
  assert.strictEqual(resUnlisted.outcome.classification, 'PROVIDER_OUTCOME_UNKNOWN')
  assert.strictEqual(resUnlisted.outcome.outcomeKnown, false)
  assert.strictEqual(resUnlisted.outcome.isTerminal, false)
  assert.strictEqual(resUnlisted.outcome.requiresInquiryOrReconciliation, true)
  console.log('✓ 8.10: Unlisted provider code in policy fail-safes to PROVIDER_OUTCOME_UNKNOWN (outcomeKnown: false).')

  // Test 8.11: Malformed non-JSON body tetap MALFORMED_RESPONSE dan no blind retry
  let malformedCalls = 0
  const clientMalformed = new BriClient({
    config: validTestConfig,
    tokenClient: mockTokenClient,
    customFetch: async () => {
      malformedCalls++
      return new Response('<html>502 Bad Gateway</html>', { status: 502 })
    },
  })
  malformedCalls = 0
  await assert.rejects(
    async () => {
      await clientMalformed.executeSignedRequest({
        method: 'POST',
        endpointPath: '/snap/v1.0/bank-statement',
        externalIdPolicy: BRI_ENDPOINT_EXTERNAL_ID_POLICIES.BANK_STATEMENT,
      })
    },
    (err) => {
      assert.ok(isBriError(err))
      assert.strictEqual(err.category, 'MALFORMED_RESPONSE')
      return true
    }
  )
  assert.strictEqual(malformedCalls, 1, 'Client must NOT blind retry upon malformed response!')
  console.log('✓ 8.11: Malformed non-JSON body yields MALFORMED_RESPONSE with 0 blind retries.')

  // Test 8.12: Token endpoint mapping berdiri sendiri dan tidak terganggu oleh business endpoint mapping
  const independentTokenClient = new BriTokenClient({
    config: validTestConfig,
    customFetch: async (url) => {
      assert.ok(url.includes('/snap/v1.0/access-token/b2b'))
      return new Response(
        JSON.stringify({
          responseCode: '2007300',
          responseMessage: 'Token Success',
          accessToken: 'independent_tok_123',
          expiresIn: 900,
        }),
        { status: 200 }
      )
    },
  })
  const tok = await independentTokenClient.getAccessToken()
  assert.strictEqual(tok, 'independent_tok_123')
  console.log('✓ 8.12: Token endpoint mapping operates independently from business endpoint mapping.')

  console.log('\n=================================================================')
  console.log('SUCCESS: ALL BRI-2 HARDENED SECURITY & CORE ADAPTER TESTS PASSED!')
  console.log('=================================================================\n')
}

runTestSuite().catch((err) => {
  console.error('\nFATAL ERROR IN BRI-2 TEST SUITE:', err)
  process.exit(1)
})
