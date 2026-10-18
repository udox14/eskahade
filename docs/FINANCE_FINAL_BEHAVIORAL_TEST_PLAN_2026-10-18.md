# Disposable D1 behavioral test: approval plan

Status: PREPARED ONLY. No new remote database or Worker has been provisioned. This plan requests separate explicit authorization for the exact resources, synthetic mutations, temporary test secret, and cleanup below. A general instruction to continue does not replace that authorization.

## Resources and isolation

Account: `a170ed4144c00927988a828aa9a41896`.

| Resource | Exact proposed name | Lifetime |
| --- | --- | --- |
| NEW disposable D1 | `eskahade-fin-behavior-20261018-66449217` | At most one hour after provisioning |
| NEW isolated Worker | `eskahade-fin-behavior-20261018-66449217` | Same, then delete |
| Worker-only secret | `TEST_AUTH_TOKEN` | New random 256-bit value; removed with this Worker |

Only binding: `TEST_DB`, pointing to the newly created and independently verified UUID. No R2, KV, service, cron, application, bank credential or BRI/QLola bindings. No application feature flags. The public workers.dev endpoint requires a timing-safe bearer-token check, fails closed without the secret, accepts fixed scenarios only, verifies the synthetic database marker before mutation, and claims one run with a unique key. It has no SQL input, reset, bank request, or delete endpoint. Secret and authenticated request headers must never enter evidence logs.

Reject reuse of an existing resource with this name. Forbidden database UUIDs:

- Production: `a2010f08-f314-46af-88fd-dbb9b4ef1bb1`.
- Rehearsal: `3de081e2-0225-42e5-993d-151652884335`.
- Demo: `677f05ba-9b52-4534-9542-96cc785f25e4`.

Never deploy `eskahade`, `eskahade-sandbox`, root wrangler configuration, or the local test configuration. Verify CLI identity and dashboard account before provisioning; after provisioning verify NEW database identity again before import, deploy, run and cleanup. Capture each response and stop on any failure or identity mismatch. Current CLI OAuth grants D1 access but lacks Worker deployment scopes; obtaining suitable access is an additional prerequisite. No scope expansion was performed for this task.

## Exact workload and limits

`scripts/finance-behavior/prepare.cjs` generates schema-only DDL from the existing migration-derived fixture through 0189: 254 finance objects including all 69 finance triggers, plus six minimal non-finance dependency tables. Two test-control tables and a synthetic year/marker are added. This is not a production clone. Schema SHA-256:

`34e21b9301fc3d64b6e76a2e8afc4c018c4a0cf21abaa544d3839c73e1077ecf`

No historical row export, real personal data or production financial records are imported. Synthetic provider-evidence rows explicitly say they are fixtures; they simulate database guard preconditions and do not prove bank authentication/onboarding.

Run the 12 fixed scenarios in `suite.mjs` once: atomic payment/allocation abort; stale wallet balance; parent withdrawal limit; missing cash session/PIN; correction against live reservation; distribution overdraw; delayed callback bank-time window; after-expiry reject; inquiry immutability; missing verified statement reject; unapproved authoritative mapping reject; principal/allocation/obligation conservation. Stop at first failed case. The local run used 97 scenario statements plus control/import queries. Schema import used 264 statements. Read `/status` and replay `/run` once; do not reset or auto-retry a failed run. Existing authenticated callback regressions exercise the real service locally; this Worker exercises database behavior, not the full deployed application or bank endpoint.

Budget estimate: fewer than 1,000 SQL statements total, fewer than 10,000 rows written including indexes/DDL, fewer than 100,000 rows read, less than 10 MB storage, fewer than 10 HTTP requests. These are review estimates, not metered hard limits; capture D1 metadata/usage afterward. One run plus one hour of storage is expected to cost $0 within remaining included quotas, conservatively under $0.05 incremental on an existing paid plan. Account-wide usage is shared; availability and remaining quotas have not been verified. Do not upgrade a plan, subscribe, or exceed this budget automatically.

Official rates checked 2026-10-18: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) includes Free 5 million reads/day, 100,000 writes/day and 5 GB; Paid includes 25 billion reads/month, 50 million writes/month and 5 GB, then $0.001/million reads, $1/million writes and $0.75/GB-month. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) has a $5/month paid base, with 10 million requests and 30 million CPU-ms included, then $0.30/million requests and $0.02/million CPU-ms. No new paid subscription is authorized by this proposal.

## Commands for execution AFTER explicit approval

PowerShell, repository root. These commands are a reviewed sequence with manual identity gates, not an unattended script. Check `$LASTEXITCODE` after every Wrangler command and stop if nonzero. Retain outputs privately until sanitized; do not log tokens. Keep a dedicated private `WRANGLER_LOG_PATH` under ignored `.wrangler` storage.

```powershell
$wr = 'C:\DATA\eskahade\node_modules\wrangler\bin\wrangler.js'
$resource = 'eskahade-fin-behavior-20261018-66449217'
$artifact = 'C:\DATA\eskahade\output\final-behavioral-gate-66449217'
$remoteConfig = Join-Path $artifact 'isolated\wrangler.approved-remote.json'
$env:CLOUDFLARE_ACCOUNT_ID = 'a170ed4144c00927988a828aa9a41896'
$env:WRANGLER_SEND_METRICS = 'false'
node $wr whoami
node $wr d1 list --json
# Gate: correct account; resource name absent from D1 and Workers dashboard.
# Check account plan/quota. No automatic plan upgrade or resource reuse.
node $wr d1 create $resource --location apac --update-config=false
# Gate: record NEW UUID; verify name/account in dashboard and d1 info.
$newUuid = Read-Host 'Verified NEW disposable database UUID'
$deny = @('a2010f08-f314-46af-88fd-dbb9b4ef1bb1',
          '3de081e2-0225-42e5-993d-151652884335',
          '677f05ba-9b52-4534-9542-96cc785f25e4',
          '00000000-0000-0000-0000-000000000000')
if ($newUuid -notmatch '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' -or $newUuid -in $deny) { throw 'Forbidden UUID' }
$cfg = Get-Content 'scripts\finance-behavior\wrangler.remote.json.example' -Raw | ConvertFrom-Json
$cfg.main = 'C:\DATA\eskahade\scripts\finance-behavior\worker.mjs'
$cfg.d1_databases[0].database_id = $newUuid
$cfg | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $remoteConfig
node $wr d1 info $resource --config $remoteConfig --json
# Gate: NEW UUID/name/account must match; only TEST_DB binding; no existing resources.
node scripts/finance-behavior/prepare.cjs
$schema = Join-Path $artifact 'isolated\schema.sql'
if ((Get-FileHash $schema -Algorithm SHA256).Hash -ne '34e21b9301fc3d64b6e76a2e8afc4c018c4a0cf21abaa544d3839c73e1077ecf') { throw 'Schema hash mismatch' }
node $wr d1 execute $resource --remote --config $remoteConfig --command 'SELECT COUNT(*) AS objects FROM sqlite_master WHERE name NOT LIKE ''sqlite_%'' AND name NOT LIKE ''_cf_%'';'
# Gate: brand-new DB only; inspect any objects; stop on unknown/user tables.
node $wr d1 execute $resource --remote --config $remoteConfig --file $schema --yes
node $wr d1 execute $resource --remote --config $remoteConfig --command "SELECT marker FROM finance_behavior_control; PRAGMA foreign_key_check; PRAGMA integrity_check;"
# Gate: correct marker, no FK violations, integrity_check=ok, expected schema signatures/counts.
node $wr deploy --dry-run --config $remoteConfig
# Gate: inspect bundle and exact isolated Worker name/binding; no app Worker.
node $wr deploy --config $remoteConfig
# Initially fails closed (503) until the new isolated Worker secret is set.
$random = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($random)
$testToken = -join ($random | ForEach-Object { $_.ToString('x2') })
$rng.Dispose()
$testToken | node $wr secret put TEST_AUTH_TOKEN --config $remoteConfig
# Do not print $testToken or serialize headers. Confirm emitted URL's Worker identity.
$testOrigin = Read-Host 'Exact HTTPS workers.dev origin emitted for the NEW Worker'
if ($testOrigin -notmatch '^https://eskahade-fin-behavior-20261018-66449217\.[a-z0-9-]+\.workers\.dev$') { throw 'Unexpected test origin' }
$headers = @{ Authorization = 'Bearer ' + $testToken }
$result = Invoke-RestMethod -Method Post -Uri "$testOrigin/run" -Headers $headers
$result | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8 (Join-Path $artifact 'd1-remote-result.json')
# Gate: 12 PASS / 0 FAIL. Failure => stop; preserve synthetic evidence; no rerun/reset.
Invoke-RestMethod -Uri "$testOrigin/status" -Headers $headers
Invoke-RestMethod -Method Post -Uri "$testOrigin/run" -Headers $headers
# Compare both with stored result; no additional fixtures/financial mutations.
node $wr d1 execute $resource --remote --config $remoteConfig --command "PRAGMA foreign_key_check; PRAGMA integrity_check; SELECT status FROM finance_behavior_runs;"
# Read-only schema/trigger signatures, synthetic totals, counts and resource metrics.
Remove-Variable testToken,headers,random
```

The authorized run must also test an unauthenticated request gets 401 without emitting headers or proof content. A transport timeout must be followed by authenticated GET `/status`; do not recreate resources or repeat mutation blindly. RUNNING without a result is a failure requiring review, not permission to reset. Twelve passing cases do not demonstrate production data parity, full application behavior on D1, or BRI/QLola UAT acceptance.

## Cleanup, included in the requested authorization

After evidence collection, reverify account, exact NEW Worker name, NEW UUID and synthetic marker. If an identity check fails, stop and request review; never delete by prefix or enumerate-and-delete resources. Retain sanitized result/provenance/hashes, not database copies, token or caches. Delete only the two resources created by this approved run, including on failure once evidence is preserved. Do not delete or modify any production/rehearsal/demo data or old audit ZIP.

```powershell
node $wr d1 info $resource --config $remoteConfig --json
# Gate: same approved NEW UUID/name; verify isolated Worker in dashboard.
node $wr delete $resource --config $remoteConfig
node $wr d1 delete $resource --config $remoteConfig
node $wr d1 list --json
# Verify NEW D1 and Worker absent; capture cleanup confirmation.
```

No force flags, no background schedule, no auto-restore and no deployment to existing Workers. If deletion fails, report the resource and obtain cleanup assistance. R2 configuration changes are outside this authorization and require a separate decision.
