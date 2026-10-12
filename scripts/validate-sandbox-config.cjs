// scripts/validate-sandbox-config.cjs
// Strict pre-deploy safety validation for BRI Sandbox Worker environment.
// Fails if configuration could accidentally target production, misroute database bindings,
// or share KV namespaces, R2 buckets, or service references with production.

const fs = require('fs');
const path = require('path');

const wranglerPath = path.resolve(__dirname, '..', 'wrangler.jsonc');
if (!fs.existsSync(wranglerPath)) {
  console.error('FATAL: wrangler.jsonc not found at', wranglerPath);
  process.exit(1);
}

const rawContent = fs.readFileSync(wranglerPath, 'utf8');

// Strip comments while preserving strings (avoids corrupting URLs like https://)
function stripJsonComments(jsonString) {
  let insideString = false;
  let result = '';
  let i = 0;
  while (i < jsonString.length) {
    const char = jsonString[i];
    const next = jsonString[i + 1];

    if (char === '"' && (i === 0 || jsonString[i - 1] !== '\\')) {
      insideString = !insideString;
      result += char;
      i++;
    } else if (!insideString && char === '/' && next === '/') {
      // Line comment: skip until newline
      i += 2;
      while (i < jsonString.length && jsonString[i] !== '\n' && jsonString[i] !== '\r') {
        i++;
      }
    } else if (!insideString && char === '/' && next === '*') {
      // Block comment: skip until */
      i += 2;
      while (i < jsonString.length && !(jsonString[i] === '*' && jsonString[i + 1] === '/')) {
        i++;
      }
      i += 2;
    } else {
      result += char;
      i++;
    }
  }
  return result;
}

const stripped = stripJsonComments(rawContent);

let config;
try {
  config = JSON.parse(stripped);
} catch (err) {
  console.error('FATAL: Failed to parse wrangler.jsonc as JSON:', err.message);
  process.exit(1);
}

const sandbox = config.env && config.env.sandbox;
if (!sandbox) {
  console.error('FATAL: env.sandbox block is missing in wrangler.jsonc');
  process.exit(1);
}

const errors = [];

// Production authoritative baseline identifiers
const PROD_WORKER_NAME = config.name || 'eskahade';
const PROD_DB_ID = 'a2010f08-f314-46af-88fd-dbb9b4ef1bb1';
const DEMO_DB_ID = '677f05ba-9b52-4534-9542-96cc785f25e4';

const prodKvBinding = (config.kv_namespaces || []).find(k => k.binding === 'NEXT_INC_CACHE_KV');
const PROD_KV_ID = prodKvBinding ? prodKvBinding.id : '5c584e05fa9749b3a4320199513c2275';
const PROD_KV_PREVIEW_ID = prodKvBinding ? prodKvBinding.preview_id : '4a01dc7b15284dd7aedc23ab613beef0';

const prodR2Binding = (config.r2_buckets || []).find(r => r.binding === 'R2_BUCKET');
const PROD_R2_BUCKET = prodR2Binding ? prodR2Binding.bucket_name : 'eskahade-foto';

// 1. Worker name must strictly be eskahade-sandbox
if (sandbox.name !== 'eskahade-sandbox') {
  errors.push(`Worker name must be "eskahade-sandbox", got "${sandbox.name}"`);
}

// 2. D1 databases check
const d1Databases = sandbox.d1_databases || [];
const dbBinding = d1Databases.find(d => d.binding === 'DB');
const demoDbBinding = d1Databases.find(d => d.binding === 'DEMO_DB');

if (!dbBinding) {
  errors.push('Missing "DB" binding in env.sandbox.d1_databases');
} else {
  if (dbBinding.database_name !== 'eskahade-demo-db') {
    errors.push(`DB database_name must be "eskahade-demo-db", got "${dbBinding.database_name}"`);
  }
  if (dbBinding.database_id === PROD_DB_ID) {
    errors.push(`CRITICAL SECURITY VIOLATION: Sandbox DB points to PRODUCTION database_id (${PROD_DB_ID})!`);
  }
  if (dbBinding.database_id !== DEMO_DB_ID) {
    errors.push(`Sandbox DB database_id must be demo DB (${DEMO_DB_ID}), got "${dbBinding.database_id}"`);
  }
}

if (demoDbBinding) {
  if (demoDbBinding.database_id === PROD_DB_ID) {
    errors.push(`CRITICAL SECURITY VIOLATION: Sandbox DEMO_DB points to PRODUCTION database_id (${PROD_DB_ID})!`);
  }
  if (demoDbBinding.database_id !== DEMO_DB_ID) {
    errors.push(`Sandbox DEMO_DB database_id must be demo DB (${DEMO_DB_ID}), got "${demoDbBinding.database_id}"`);
  }
}

// 3. Service / self-reference checks (must NOT point to production Worker eskahade)
const services = sandbox.services || [];
services.forEach(svc => {
  if (svc.service === PROD_WORKER_NAME || svc.service === 'eskahade') {
    errors.push(`CRITICAL ISOLATION VIOLATION: Sandbox service binding "${svc.binding}" points to production Worker "${svc.service}"!`);
  }
});
const selfRef = services.find(s => s.binding === 'WORKER_SELF_REFERENCE');
if (selfRef && selfRef.service !== 'eskahade-sandbox') {
  errors.push(`WORKER_SELF_REFERENCE must point to "eskahade-sandbox", got "${selfRef.service}"`);
}

// 4. KV Namespace check (MUST NOT share production KV namespace)
const sandboxKv = (sandbox.kv_namespaces || []).find(k => k.binding === 'NEXT_INC_CACHE_KV');
if (!sandboxKv) {
  errors.push('Missing "NEXT_INC_CACHE_KV" binding in env.sandbox.kv_namespaces');
} else {
  if (sandboxKv.id === PROD_KV_ID || sandboxKv.id === PROD_KV_PREVIEW_ID) {
    errors.push(`CRITICAL ISOLATION VIOLATION: Sandbox NEXT_INC_CACHE_KV is sharing production KV namespace (${sandboxKv.id})!`);
  }
}

// 5. R2 Bucket check (MUST NOT share production R2 bucket)
const sandboxR2 = (sandbox.r2_buckets || []).find(r => r.binding === 'R2_BUCKET');
if (sandboxR2) {
  if (sandboxR2.bucket_name === PROD_R2_BUCKET || sandboxR2.bucket_name === 'eskahade-foto') {
    errors.push(`CRITICAL ISOLATION VIOLATION: Sandbox R2_BUCKET is sharing production bucket "${sandboxR2.bucket_name}"!`);
  }
}

// 6. BRI_ENV check
const vars = sandbox.vars || {};
if (vars.BRI_ENV === 'production') {
  errors.push('CRITICAL: Sandbox vars.BRI_ENV is configured as "production"!');
}
if (vars.BRI_ENV !== 'sandbox') {
  errors.push(`Sandbox vars.BRI_ENV must be "sandbox", got "${vars.BRI_ENV}"`);
}

if (errors.length > 0) {
  console.error('====================================================');
  console.error('SANDBOX PRE-DEPLOY SAFETY VALIDATION FAILED:');
  errors.forEach(e => console.error('  - ' + e));
  console.error('====================================================');
  process.exit(1);
}

console.log('SANDBOX PRE-DEPLOY SAFETY VALIDATION: PASS');
console.log('  Target Worker:      ', sandbox.name);
console.log('  DB Binding:         ', dbBinding ? `${dbBinding.database_name} (${dbBinding.database_id})` : 'NONE');
console.log('  DEMO_DB Binding:    ', demoDbBinding ? `${demoDbBinding.database_name} (${demoDbBinding.database_id})` : 'NONE');
console.log('  KV Namespace:       ', sandboxKv ? sandboxKv.id : 'NONE');
console.log('  R2 Bucket:          ', sandboxR2 ? sandboxR2.bucket_name : 'NONE');
console.log('  Self Service Ref:   ', selfRef ? selfRef.service : 'NONE');
console.log('  BRI_ENV:            ', vars.BRI_ENV);
console.log('  BRI_BASE_URL:       ', vars.BRI_BASE_URL);
console.log('  Production Isolation: COMPLETE (No shared DB, KV, R2, or Service bindings)');
