# Eskahade final financial behavioral gate

Date: 2026-10-18. Branch: `fix/finance-bri-audit-20261018`. Reviewed starting HEAD: `664492174266ed6fa66b4998d7035a9b988b6a80`.

**READY_FOR_FINAL_BEHAVIORAL_TESTING.** Local repair and verification pass; the disposable remote D1 test is prepared and awaits separate authorization. This is not independent approval, production readiness, deployment authorization or BRI go-live approval.

## Callback collision: CONFIRMED

The review-only path previously derived both durable evidence identifiers solely from the existing event key. `INSERT OR IGNORE` silently retained the first authenticated payload and dropped a second conflicting payload with the same identifiers. This affected both gateway evidence and the recovery queue. It could also hide ambiguity from a later valid-time callback.

Reproduction uses actual signature generation/verification and the actual finance migrations through 0189, including foreign keys and every trigger. It contains synthetic students, generated in-memory signing material and no bank network requests. The same test can load the baseline service using `git show`, without checking out or changing the branch.

| Scenario | Baseline | Fixed service |
| --- | --- | --- |
| Authenticated A: same request/trx/VA, Rp12,000; B: Rp13,000; missing bank time | 1 gateway event / 1 recovery entry: B lost | 2 gateway events / 2 recovery entries, amounts 12,000 and 13,000; no money posted |
| Same identifiers/amount, changed authenticated additionalInfo | Second evidence body lost | Both sanitized evidence variants retained |
| A/B/A/B concurrent service calls | Only one review variant retained | Two review variants; exact replay deduplicated |
| Later Rp12,000 callback supplies valid bank time while Rp13,000 conflict unresolved | HTTP 200; automatically posts | HTTP 409; third evidence variant retained, no payment/allocation/wallet/income |
| Conflict inserted after precheck, before financial batch | HTTP 200; posts despite conflict | HTTP 409; complete financial batch rolls back |
| Three simultaneous valid delayed callbacks | One payment | Still one payment: principal 10,000 = obligation 7,000 + wallet 3,000; separate cooperative income 2,000 |

The minimal application change is confined to `lib/finance/bri/briva-service.ts`:

1. Review identity includes SHA-256 of the authenticated parsed JSON body, preserving distinct variants while keeping the same body idempotent across fresh signatures/headers. Existing payload sanitization remains in effect; the integer amount remains traceable in the recovery record. Formatting whitespace does not create a new variant; JSON property order is not canonicalized.
2. Unresolved authenticated recovery evidence with conflicting payment identity, VA or amount blocks automatic posting. Resolved/non-conflicting review evidence does not block a legitimate replay or recovery.
3. The same condition is rechecked within the conditional payment insert in the atomic batch. A suppressed insert makes the dependent foreign key fail, rolling back the complete batch; the conflict is then recorded for reconciliation. Existing money, expiry, state and idempotency guards remain active.
4. Recovery resolution matches amount and bank transaction identifier as well as request/student/VA, so a disposition for another conflicting amount is not silently overwritten.

No schema migration, new dependency, endpoint, cryptographic algorithm, feature flag or global authentication change is introduced. Previously lost evidence cannot be reconstructed by this fix; affected historical callbacks would require bank evidence and authorized reconciliation. Real D1 concurrency remains a remote validation item; local concurrency coverage uses deterministic service interleavings and fault injection against SQLite.

## Verification results

Evidence folder: `output/final-behavioral-gate-66449217/`.

| Check | Result | Evidence |
| --- | --- | --- |
| Baseline callback reproduction, final 11 cases | 5 PASS / 6 expected FAIL | `callback-before.json`, `.log` |
| Repaired authenticated callback suite | 11 PASS / 0 FAIL | `callback-after.json`, `.log` |
| Finance/BRI/migration regression suites | 43 PASS / 0 FAIL | `regression/summary.json`, `results.json`, per-suite logs |
| Exact disposable SQL scenarios, Node SQLite preflight | 12 PASS / 0 FAIL | `d1-scenarios-sqlite.json` |
| Same scenarios, LOCAL workerd/Miniflare D1 native batch | 12 PASS / 0 FAIL; 97 scenario statements | `d1-local-workerd.json` |
| Local test Worker access/replay | No token 401; run 200; exact stored replay 200; status 200 | `d1-local-http-checks.json` |
| TypeScript | `tsc --noEmit --incremental false`, exit 0 | `typecheck.log` |
| Production-equivalent Cloudflare build | `npm run build:cf`, exit 0; OpenNext Worker bundle produced | `build-cf.log` |
| Whitespace/scope audit | `git diff --check` passes; one application file changed | Git diff |

The 43 suites consist of the previously selected 41 regression suites, the new callback suite, and the new disposable-scenario SQLite preflight. The callback's 11 cases are included in this suite count, not 11 additional suites. The workerd run is a separate execution of the same 12 SQL scenarios, not remote D1 evidence. Regression logs include migration compatibility checks; no migration file changed.

Callback cases include exact replay with fresh headers; conflicting amount and changed payload; invalid signature rejection; concurrent review and valid callbacks; each review-batch statement failure; committed write with lost acknowledgement followed by replay; authorized reconciliation disposition preservation; and the precheck-to-batch conflict race. The existing follow-up suite continues to cover callback expiry/timestamp validity, HTTP replay, statement completeness and settlement/admin reporting.

Disposable database scenarios cover atomic rollback, wallet stale balance, parent withdrawal limit, missing cash session/PIN, correction against a live bank reservation, distribution overdraw, on-time bank event with delayed processing, after-expiry rejection, inquiry immutability, missing statement provenance, authoritative contract mapping fail-closed, and principal/allocation/obligation conservation. All 69 finance triggers are present. The six supporting non-finance tables are intentionally minimal, so this is not full production schema/data parity.

Initial harness preparation exposed invalid fixture assumptions (duplicate unique Pesantren recipient; missing allowed method/provider evidence; an incomplete settlement setup). Only synthetic fixture setup was corrected. No application constraint was weakened. An initial local workerd start rejected the newer date; isolated configuration now uses the application's existing `2025-04-01` compatibility date. No dependency upgrade occurred. The successful build retains OpenNext's existing Windows compatibility warning; production execution itself was not tested or deployed.

## Isolated remote D1 plan and approval

See `FINANCE_FINAL_BEHAVIORAL_TEST_PLAN_2026-10-18.md` for exact resource names, commands, identity/UUID guards, fixed workload, estimated limits/cost, temporary secret and cleanup. Proposed NEW D1 and Worker: `eskahade-fin-behavior-20261018-66449217`, account `a170ed4144c00927988a828aa9a41896`. UUID is deliberately unknown until creation after explicit approval. No existing database or Worker may be reused. The local fake test token must never be used remotely.

The schema-only artifact is generated from actual migration definitions, not copied database records. SHA-256: `34e21b9301fc3d64b6e76a2e8afc4c018c4a0cf21abaa544d3839c73e1077ecf`. Per-migration hashes are recorded in `isolated/schema-provenance.json`. Remote Cloudflare D1 execution, remote native transaction behavior and runtime differences are **NOT TESTED** in this gate. Cloudflare Worker deployment authorization/access is still required for this isolated test only. The local workerd server was stopped after verification.

## R2 privacy: infrastructure exposure remains open (A04)

Read-only authenticated Cloudflare dashboard checks verified the correct account and root Worker binding `R2_BUCKET -> eskahade-foto`. The production bucket's Public Development URL is **enabled**:

`https://pub-1209482eb6d6461389443ee22c5764f5.r2.dev`

No custom domains were configured on that bucket. The separate `eskahade-sandbox-foto` bucket had the public development URL disabled and no custom domains. Configuration-only observations are recorded in `r2-privacy.json`. A CLI read was denied because the cached OAuth grant lacks R2 access; this was resolved through the existing authenticated dashboard session, without changing credentials or OAuth scopes.

Application code rejects financial-proof prefixes at the generic `/api/file/[...key]` route before an R2 read, and the private proof route enforces authentication/authorization and `no-store`. However, direct access through an enabled public bucket URL bypasses these Worker route checks. Any financial proof stored in this bucket would therefore be accessible to someone holding its object key. Object contents/financial-proof presence were deliberately not inspected, and no claim of actual proof disclosure or exfiltration is made. CORS is not an authorization boundary. [Cloudflare public bucket documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/) confirms that public access can be provided through r2.dev and custom domains.

Required action, subject to separate approval: disable this production bucket's public r2.dev access, after reviewing legacy/public-photo links and routing public assets through the existing application route; or design a separately approved private financial-proof bucket transition. No custom domain currently needs removal, but recheck all public endpoints at execution time. Verify with a harmless synthetic object that anonymous direct access is denied and private-route role/ownership checks still hold. Review cache impact; any purge, rotation, object migration or deletion requires explicit approval. Do not set `FINANCE_PROOFS_PRIVATE_STORAGE_CONFIRMED` until privacy has actually been verified. No R2 configuration, object or cache was modified in this task.

## Changed files and remaining gates

- `lib/finance/bri/briva-service.ts`: sole application change.
- `scripts/test-finance-bri-callback-evidence.cjs`: authenticated callback reproduction/regressions.
- `scripts/test-finance-d1-behavior-local.cjs`: schema-derived SQL preflight.
- `scripts/finance-behavior/prepare.cjs`: schema-only generator/provenance.
- `scripts/finance-behavior/suite.mjs`: fixed disposable scenarios.
- `scripts/finance-behavior/worker.mjs`: isolated authenticated single-run harness.
- `scripts/finance-behavior/run-local-http.cjs`: loopback auth/run/replay validation.
- `scripts/finance-behavior/wrangler.local.json`: local-only configuration with explicit fake token and dummy UUID.
- `scripts/finance-behavior/wrangler.remote.json.example`: intentionally invalid-until-reviewed disposable remote template.
- `scripts/finance-behavior/.gitignore`: excludes generated local Wrangler cache.
- This report and `FINANCE_FINAL_BEHAVIORAL_TEST_PLAN_2026-10-18.md`.

Commit identity and final working-tree status are captured separately in `output/final-behavioral-gate-66449217/commits.txt`; the reviewed patch and SHA-256 manifest are in the same evidence folder. Existing untracked audit/rehearsal artifacts were preserved and excluded from the change.

Remaining gates: separate authorization and execution of disposable remote D1 testing; A04 R2 privacy configuration; external BRI onboarding/UAT and cross-product statement identity mapping; non-STP QLola approval interface evidence. The eight previously restored historical rehearsal tables remain unrepresentative because production contents are unknown. No all-production-risk resolution is claimed.

Production, demo and existing rehearsal records were untouched. No migration was applied remotely or reapplied to rehearsal. No production/sandbox Worker was deployed, no resource was remotely provisioned, no push/merge occurred, no secret changed, and BRI/QLola remained disabled in real environments. Stop after this report and await separate remote-test authorization.
