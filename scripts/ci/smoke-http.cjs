/* Minimal post-deploy HTTP gate. No credentials, writes, or application data. */
const assert = require('node:assert/strict');

const [modeOrTarget, maybeTarget, maybeValue] = process.argv.slice(2);
const validateOnly = modeOrTarget === '--validate';
const target = validateOnly ? maybeTarget : modeOrTarget;
const value = validateOnly ? maybeValue : maybeTarget;
assert.ok(['sandbox', 'production'].includes(target), 'Expected sandbox or production target');
assert.ok(value, `Set the ${target} URL in GitHub Actions environment variables`);

const url = new URL(value);
assert.equal(url.protocol, 'https:', 'Smoke-test URL must use HTTPS');
assert.ok(!url.username && !url.password, 'Smoke-test URL must not include credentials');
if (validateOnly) {
  console.log(`${target} smoke-test URL configuration is valid`);
  process.exit(0);
}

(async () => {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { accept: 'text/html' },
  });
  assert.equal(response.status, 200, `${target} HTTP smoke test returned ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  assert.match(contentType, /text\/html/i, `${target} response is not HTML`);
  const html = await response.text();
  assert.ok(html.length > 0, `${target} returned an empty document`);
  console.log(`${target} HTTP smoke test passed: status=${response.status}, bytes=${Buffer.byteLength(html)}`);
})().catch(error => {
  console.error(`${target} HTTP smoke test failed: ${error.message}`);
  process.exitCode = 1;
});

