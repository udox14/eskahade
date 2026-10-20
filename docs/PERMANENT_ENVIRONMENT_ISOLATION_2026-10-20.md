# Permanent Eskahade production/sandbox isolation

> Execution order superseded by `CONSOLIDATED_DELIVERY_2026-10-20.md`: deploy the minimal artifact-based production hotfix first; the full candidate remains gated on production 0187–0190/R2 prerequisites. Never reconnect production DEMO_DB.

20 October 2026 (Asia/Bangkok). **Local implementation and execution package; no remote execution.** This replaces the temporary maintenance plan. Production must never regain DEMO_DB during cleanup or automatic rollback. The 19 October package remains the source of the exact 0192–0195 SQL, not the source of the new application/configuration candidate.

## Exact candidate and scope

Baseline Git commit: `ade5b89b837a82fe824f9f61aff055d50f893674`. The execution ZIP's manifest identifies the new candidate by baseline plus the complete patch SHA256 and source file hashes. No new commit, push, merge, workflow dispatch, resource provisioning, credential/IAM change, database export, remote SQL, deployment, reset or bank activation is implied. Apply the patch to that exact baseline, verify the source hashes and build with the included lockfile. Do not deploy the old baseline as though it contains this isolation patch.

Production `eskahade` has exactly one D1 binding: DB → `eskahade-db` / `a2010f08-f314-46af-88fd-dbb9b4ef1bb1`. DEMO_DB is absent. Sandbox `eskahade-sandbox` has DB and DEMO_DB → `eskahade-demo-db` / `677f05ba-9b52-4534-9542-96cc785f25e4`. Account: `a170ed4144c00927988a828aa9a41896`. Existing sandbox KV/R2/self-reference remain separate. Version/preview URLs are explicitly disabled on both Workers; normal production routes stay available. Bank outbound, BRIVA inbound/outbound and statement sync remain OFF. Sandbox cash/manual distribution flags remain OFF as before; no bank protocol or finance calculation was changed.

The only runtime database selector is the Worker's DB. It requires an explicit `ESKAHADE_ENV` and valid bindings, rejects an unexpected production DEMO_DB, rejects missing DB and missing sandbox DEMO_DB, and never falls back to the other environment. Cloudflare D1 binding objects do not expose an authoritative database UUID to application code; exact UUID/isolation is enforced by the configuration validator and deployment metadata gates. All future deployment paths must run that validator.

Production login rejects stored demo roles, including admin+demo combinations, without deleting account rows. Staff session and Portal Ortu tokens carry their environment; wrong-environment and unscoped legacy tokens fail closed. **Existing staff and parent sessions must log in again once after cutover.** No password or signing secret is changed. Login chooses its DB independently of an old cookie. Current stored roles remain authoritative. Production auth hydration no longer performs lazy schema additions: missing required account columns fail closed and are a rollout STOP condition, not an automatic migration.

Sandbox normal staff, demo, portal, finance and metadata queries use the sandbox DB. Cache namespaces and proof/photo dataset metadata use the Worker environment, including normal sandbox staff without a demo role. The unused role-driven database selector was removed. `/api/demo/reset` is retired with HTTP 410/no-store in both environments and its destructive UI control is removed; do not run a reset as a verification step.

The separate photo-cleanup configuration no longer has DEMO_DB; its scheduled handler processes only its production DB. The standalone auto-potong handler also rejects missing/cross-environment bindings. These files do not authorize deployment or creation of either auxiliary Worker. Existing production finance jobs remain running. Both GitHub deploy workflows are manual-dispatch only, with isolation validation; no push/PR automatically deploys this patch. A repository patch does not change workflows already stored on GitHub until separately published, so an operator deployment freeze remains necessary during rollout.

## Local evidence and its limits

Read `REPORT.md` and `evidence/` in the ZIP for final test counts, logs, source/build hashes and verification results. Tests cover normal production-mode/sandbox login, current/legacy/cross-environment staff and portal sessions, dashboard/finance guards, concurrent financial batches, actual wallet ledger/projection posting through the new selector, proof metadata, reset retirement, misconfigured/missing bindings, background handlers and rollback constraints. The existing finance regression suites remain part of the gate.

The workerd previews use only all-zero local D1 IDs, separate local KV/R2 and synthetic accounts. Their schema is the existing synthetic recovery fixture derived from demo DDL plus 0192–0195. They prove application routing and authentication behavior in production/sandbox **modes**; they do not prove that the current remote production schema has every dependency of this previously unreleased baseline. No production rows, users' credentials or real transactions were copied into tests. No live bank request is permitted. Deliberately denied login/role/proof/reset requests are separated from unexpected errors.

The full lint backlog is not claimed clean; the gate is zero newly introduced lint errors. Windows build-source experiments encountered filesystem/symlink/memory limitations. Final local build commands and their successful results must be recorded, not inferred from those attempts. The build-only `build-no-dotenv.cjs` preload primes the installed Next environment loader cache from an empty directory and rejects dotenv reads/copies; it is not imported by the Worker. The Next tracing root is explicit; build workers are limited to two, Webpack memory optimizations enabled and Phosphor imports use the existing package-import optimization mechanism. These are build settings, with no new dependency or product feature. The released source contains no real dotenv/credentials or local database. Normal reproducible builds in a clean checkout use `npm ci` and `npm run build:cf`.

Final local results: 61 regression suites PASS, 4 explicitly NOT_RUN; 15 isolation cases, 13 topology/SQL/workflow checks, 4 background checks, 6 maintenance methods, 44 HTTP cases and 12 browser cases PASS. Standalone typecheck, Next build and resumed OpenNext bundling PASS; 40 linted changed/new files have zero new errors. Browser console: zero errors/warnings captured; no failed fetch/resource console messages. HTTP records include two expected 500 responses on the intentionally unconfigured bank callback alias (one per environment): the existing loader rejects absent BRI credentials before any bank processing. These are negative-test responses, not normal login/finance failures; no bank credentials were added. This is not a full browser HAR or remote observability claim. The initial HTTP attempt used an empty local fixture path and failed; after correcting only the fixture persistence path, the entire 44-case suite passed. The successful Next build and resumed OpenNext log are preserved separately; the first combined command stopped when the dotenv guard blocked an attempted read.

## Approval boundaries

Three explicit remote approvals remain necessary:

1. Production isolation release: disable historical version URL routing and deploy the reviewed new code/config to existing `eskahade`, permanently removing DEMO_DB. Read-only metadata/schema verification and authorized normal-user verification are included; no operator D1 write/migration/seed/correction is included. Normal application authentication/audit behavior is preserved; no synthetic production finance transaction is authorized.
2. Sandbox maintenance and database recovery: deploy the included no-D1 maintenance responder to existing `eskahade-sandbox`, establish drain/operator exclusivity, take verified private backup and apply only 0192–0195 one at a time with checkpoints.
3. Sandbox application deployment and smoke/reopening: deploy the same reviewed isolation application candidate to existing sandbox, verify bindings/flags and run the specifically approved synthetic account/student/amount smoke. No credential enrollment/reset, BRI/QLola enable or mismatch correction is included.

No IAM expansion is proposed. Existing Cloudflare OAuth scopes observed previously do not replace a fresh effective deployment permission check. Stop before database migration if deployment permission is unavailable. Do not create resources when a CLI prompts to provision them.

## Production rollout — no database migration

1. Acquire a named change owner and an exclusive deployment/configuration window. Stop old demo operator/CLI/REST activity and prevent old CI/other deployers from restoring bindings. Do not stop real production financial operators/jobs. Save current deployments/versions, binding identities, flags, route/version URL settings and immutable code/asset evidence privately. Previous read-only inventory identified two demo-bound Workers; it is dated evidence, not a fresh live lock.
2. Verify the account, exact existing Worker identities and target UUIDs. Inspect all current demo D1 binding holders, legacy service environments, service-call entrypoints, Pages configurations, version URLs and deployment pipelines. Any additional/unknown demo writer is a STOP requiring a narrowly reviewed closure; do not modify another Worker or expand IAM implicitly. Confirm every BRI/QLola activation gate OFF.
3. Confirm production compatibility using **read-only schema/metadata** before uploading. Verify required user columns and every schema prerequisite of the selected full candidate, including previously documented pending 0187–0190 compatibility. This isolation patch introduces no production migration and does not resolve those baseline prerequisites. A missing dependency blocks this production release under the current no-production-D1-write constraint. Do not replay migration ledger history or silently release incompatible code; prepare a compatible isolation-only candidate if required by actual evidence, subject to review.
4. Disable version/preview URL routing on existing production and sandbox Workers using the existing settings control; keep production's main routes enabled. Verify old version and aliased URL denial and metadata `previews_enabled:false`. Do not treat one guessed URL's 404 as sufficient. Check all known old version entrypoints; stale preview URLs can retain old bindings. No Access/IAM/new resource setup is included.
   Exact preview closure request shape (prepared only, not executed): for each existing script `eskahade` and `eskahade-sandbox`, GET `https://api.cloudflare.com/client/v4/accounts/a170ed4144c00927988a828aa9a41896/workers/scripts/<script>/subdomain`; require boolean `result.enabled`. POST to that same endpoint with `Content-Type: application/json`, `Cloudflare-Workers-Script-Api-Date: 2025-08-01` and body `{"enabled": <the unchanged observed boolean>, "previews_enabled": false}`. GET again and require unchanged `enabled` plus `previews_enabled:false`. This request shape is also used by the installed Wrangler `subdomainDeploy` implementation. Do not print auth headers, turn off the main workers.dev route or restore preview access in cleanup. Unknown legacy service environments require their own reviewed closure, not a guessed script mutation.

5. From the exact verified new source, run `node scripts/validate-sandbox-config.cjs`, install from lockfile in a clean checkout and build. With explicit production approval, run:

```powershell
# PRODUCTION APPLICATION/CONFIGURATION MUTATION — separate approval required.
node node_modules/@opennextjs/cloudflare/dist/cli/index.js deploy --config wrangler.jsonc --keep-vars
```

Never run this from the old baseline or the temporary maintenance package. Verify the resulting deployment has only the new isolated version active at 100%, with no old version even at 0%; version overrides can select a 0% version in the current deployment. Verify DB is the production UUID, DEMO_DB is absent, mode production, version URLs disabled, bank OFF, and existing secret/resource identities and production routes preserved. `--keep-vars` is not a binding/flag verification substitute. Old D1 bindings must not be inherited via unsafe metadata or an old configuration. Verify source/build and actual deployment IDs separately.
6. Verify normal authorized production login/dashboard/Portal Ortu and read paths, with no synthetic financial mutation. Verify demo login and signed sandbox/legacy sessions are denied without any demo DB call or primary finance posting. Verify service calls and version override attempts cannot select an old binding-bearing version. Use approved synthetic credentials only on sandbox; do not guess/reset production passwords. Stop on any normal production regression, unexpected schema write, bank request, binding drift or ambiguous deployment response.
7. Establish **completion of every old demo invocation**, including requests already holding a binding before deployment, background tasks, old preview traffic, service calls and operator commands. A deployment stops new access but cannot be assumed to invalidate already-captured D1 objects. HTTP Workers have no fixed maximum duration. An arbitrary sleep, quiet tail, stable count or two matching snapshots is insufficient. Obtain positive completion evidence from owners and available instrumentation/provider diagnostics. If old preview activity or unknown operator access prevents that proof, STOP before sandbox backup/migration. Do not cancel real production financial work to satisfy demo drain.

## Sandbox maintenance and exact 0192–0195 recovery

After production separation is deployed, verified and drained:

1. Hold a named exclusive demo D1 operator window, including all API/CLI/dashboard writers and redeployers. Verify effective sandbox deployment permission before any D1 mutation. With sandbox maintenance approval, deploy **only to the already-existing sandbox Worker**:

```powershell
node node_modules/wrangler/bin/wrangler.js deploy --config scripts/stabilization/isolation/sandbox-maintenance.jsonc --keep-vars
```

The responder returns 503/no-store and has zero D1 bindings, imports, jobs or bank access. Verify the deployed maintenance version, no D1 capabilities, previews disabled and no old active version. It does not delete D1/KV/R2 resources or records. Do not accidentally deploy this responder to production. Complete and prove drain of sandbox's pre-maintenance operations as above. Production never receives DEMO_DB again.
2. Record a private Time Travel bookmark and export only demo D1, explicitly selecting sandbox configuration:

```powershell
node node_modules/wrangler/bin/wrangler.js d1 time-travel info eskahade-demo-db --env sandbox --json
node node_modules/wrangler/bin/wrangler.js d1 export eskahade-demo-db --env sandbox --remote --output $ApprovedPrivateDemoBackup
```

Before export, verify the destination is outside Git/ZIP with user-only ACL. Verify complete output, SHA256, bookmark, schema/ledger/counts and private old-row fingerprints by loading into a private local scratch database. Never create another remote D1 or perform an automatic restore. Record recovery ownership/retention. Stop if the backup cannot be verified.
3. Verify the new package manifest and original four SQL files. Match Git/package/current SHA256; normalize CRLF to LF only when explaining EOL differences. Never trim whitespace or ignore substantive SQL. Use a new execution snapshot directory, not baseline evidence. Run `read-recovery-snapshot.cjs` (now explicitly sandbox-bound), then `check-recovery-preflight.cjs <approved baseline evidence> <fresh snapshot> 1`. Verify full integrity/FK, old-column hashes, sums/statuses, roles/config, VA/order/event uniqueness, obligation/payment/allocation/wallet/cash/reservation invariants and the unchanged known mismatch. An unavailable full integrity check remains a STOP; local emulator results do not replace it. Empty-source assumptions and off-ledger funds must still be verified. No general application audit is being restarted.
4. Run one file, gate, then proceed; never paste all four commands as an ungated batch:

```powershell
# Run only the current approved stage, then its checkpoint.
node node_modules/wrangler/bin/wrangler.js d1 execute eskahade-demo-db --env sandbox --remote --file migrations/sandbox-recovery/0192_sandbox_missing_module_tables.sql
# Fresh snapshot; check-recovery-preflight ... 2; schema/old data/FK/money/bank OFF.
node node_modules/wrangler/bin/wrangler.js d1 execute eskahade-demo-db --env sandbox --remote --file migrations/sandbox-recovery/0193_sandbox_compatibility_columns.sql
# Fresh snapshot; checker ... 3; mapping/projections/old saldo/FK/ledger/reservations.
node node_modules/wrangler/bin/wrangler.js d1 execute eskahade-demo-db --env sandbox --remote --file migrations/sandbox-recovery/0194_sandbox_indexes_and_integrity.sql
# Fresh snapshot; checker ... 4; quarantine, overdraw, uniqueness, old reservations.
node node_modules/wrangler/bin/wrangler.js d1 execute eskahade-demo-db --env sandbox --remote --file migrations/sandbox-recovery/0195_sandbox_dictionary_and_menu.sql
# Fresh snapshot; checker ... 5; intended dictionaries/new menu, old roles/permissions unchanged.
```

Every checkpoint also rechecks private row fingerprints, balances, payment/allocation/wallet/reservation status and all bank OFF flags. No historical payment correction, reservation release, redistribution or reconciliation resolution is approved. The known demo mismatch remains unresolved; new quarantine enforcement is installed only if 0194 actually passes. No case-opening SQL is included in this execution. No production/rehearsal D1 operation is permitted.

An error/timeout/ambiguous import stops execution immediately. Remote import atomicity must not be inferred from local D1 batch behavior. A missing migration stamp does not prove unchanged schema/data. Do not retry the stage, continue, reset, restore, release reservation or compensate old money automatically. Preserve actual state and prepare a reviewed manual recovery/roll-forward decision.

## Sandbox application, smoke and reopening

Only after stage 0195 postflight passes, with explicit sandbox application deployment approval:

```powershell
node scripts/validate-sandbox-config.cjs
node node_modules/@opennextjs/cloudflare/dist/cli/index.js deploy --config wrangler.jsonc --env sandbox --keep-vars
```

Verify both sandbox D1 bindings are the demo UUID, no production D1 capability, correct separate R2/KV/self-reference, mode sandbox, bank OFF, preview URLs disabled, code/version/deployment evidence. This intentionally replaces maintenance with the tested application; only approved synthetic operators may write during smoke. Keep other demo users/jobs/CLI/deployers paused. Test real login/session/dashboard/santri/kelas/finance/POS/Portal Ortu/transaction proofs/role/navigation, console/server exceptions and failed network requests. Capture expected denials separately. Only specifically approved synthetic students/amounts may post transactions; do not enroll credentials or use historical mismatch funds implicitly. Verify conservation/FK/old data/reservations after smoke. Existing legacy proof metadata inconsistent with its environment must be reviewed, not automatically retagged or granted access.

Reopen sandbox only after smoke and financial owner acceptance. Production remains permanently detached; no inverse production binding operation exists. Report actual 0192–0195, deployment, login/E2E, error counts, mismatch status, isolation and demo readiness separately. Local success does not mean sandbox remote recovery or BRI UAT is complete.

## STOP and rollback

- Stop for wrong/missing resources, deployment permission, binding/flag drift, new resource prompts, non-approved writer, incomplete drain, unverifiable backup, incompatible production schema, checksum/substantive SQL difference, new integrity violation, unexpected old-data change, partial-stage ambiguity, bank activation/request, normal production regression or failed smoke.
- No automatic `wrangler rollback` to a pre-isolation version: it can restore old bindings **and** old authentication behavior. Version URLs stay disabled. Do not reactivate an old version at 0% for testing.
- Preferred recovery is a reviewed forward fix retaining the environment selector, scoped tokens, production DB-only configuration and sandbox isolation. An isolated known-good artifact may be selected only after verifying its code/config compatibility and approval. If that requires restoring production access to demo D1, STOP for special explicit approval; never do so as cleanup.
- After partial D1 recovery keep sandbox in no-D1 maintenance. Do not roll back production DB or copy/reset demo. Schema roll-forward/restore remains a separate evidence-based operator decision. A D1 restore does not cancel a bank instruction.
- Publishing this source/workflow change and dispatching deployment are separate from local preparation; no push/merge/automatic workflow run was performed.

Suggested commit message: `fix(isolation): permanently separate production and sandbox databases`.

References: [Cloudflare binding update behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/), [version URLs and retained version resources](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/), [version overrides](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/), [HTTP invocation duration](https://developers.cloudflare.com/workers/platform/limits/), [Next standalone tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
