# Eskahade consolidated delivery — 20 October 2026

This is the controlling execution document for the consolidated package. It supersedes temporary DEMO_DB reconnect/maintenance instructions and older combined-release orders. No remote mutation is authorized or performed by this delivery workflow. Production and sandbox deployment, SQL, public routing/R2 changes, secrets, Git publication and bank activation require separate approval. Local results and remote results are separate.

## Two artifacts, one release package

The package contains a minimal production isolation hotfix and the complete integrated application candidate. They serve different schema states and MUST NOT be interchanged.

**Hotfix:** reconstructed from the exact active production compiled Worker, version `f6c8d3d7-0aa6-46b7-b51a-9c5978a4171d`, deployment `f7369162-f3cb-4110-bd3f-793aee51e4bc` at 100%, script ETag `a49c07e778fdd29f36e736904e4f973d4f5c91311c7fa0c3c41025de4fa662c1`. Download ETag matched the active version. No immutable Git annotation exists, so no Git commit mapping is invented. The exact compiled source, deterministic transformer, original SHA256, hotfix SHA256 and unified diff are included. This artifact uses the existing production schema and existing assets; it does not introduce 0187–0190 or new finance code.

Six compiled auth copies, including the server-action variant, are patched. Missing DB or unexpected DEMO_DB fails closed; all fourteen role-driven DB selectors lose their demo branch. Session hydration rejects database failure, missing/revoked/demo roles and uses current stored roles. Staff and parent tokens are scoped to production; old and sandbox tokens require fresh login. Both staff login implementations reject stored demo accounts. No auth schema ALTER/backfill remains. The Worker boundary retires `/api/demo/reset`, `/api/migrate` and `/api/update-db` before database access. No account/history is deleted, password/secret changed or money calculation modified. Existing normal users and parents must log in again once. This intentional session invalidation requires rollout communication.

**Integrated application:** exact Git baseline `ade5b89b837a82fe824f9f61aff055d50f893674` plus the consolidated patch/source hashes in the manifest. It includes the existing reviewed finance/BRI fixes, R2 privacy remediation, stabilization, scoped authentication and permanent environment isolation. Production requires reviewed 0187–0190 prerequisites; sandbox requires its own 0192–0195 repair. Source/config, not a baseline package's older bundle, defines this candidate. No new bank adapter/protocol or feature is introduced.

## Verify and reproduce after extraction (local only)

Run `python verify-package.py` from the extracted package root before using any artifact. `source/` is the complete integrated working tree; `integrated-source.patch` is the equivalent patch against the stated Git baseline. Do not apply the patch again to `source/`. Dependencies/build caches/local D1 files are intentionally excluded.

For a fresh extracted copy, prepare the historical schema-only fixture inputs at the locations expected by the existing rehearsal scripts. These commands copy packaged, sanitized files only; they neither contact Cloudflare nor initialize a database:

```powershell
$packageRoot = (Get-Location).Path
$sourceRoot = Join-Path $packageRoot 'source'
$prodFixture = Join-Path $sourceRoot 'output/stabilization-20261019'
$demoFixture = Join-Path $sourceRoot 'output/sandbox-recovery-20261019'
$deliveryFixture = Join-Path $sourceRoot 'output/autonomous-delivery-20261020'
New-Item -ItemType Directory -Path $prodFixture,$demoFixture,$deliveryFixture -ErrorAction Stop
foreach ($name in @('production-schema-readonly.json','production-feature-config-readonly.json','application-inventory.json')) {
  Copy-Item -LiteralPath (Join-Path $packageRoot ('rehearsal-baselines/' + $name)) -Destination $prodFixture -ErrorAction Stop
}
foreach ($name in @('recovery-plan.json','stage-schema-fingerprints.json','mapping-19-columns.json','demo-schema-readonly.json','demo-migrations-readonly.json','demo-counts-readonly.json')) {
  Copy-Item -LiteralPath (Join-Path $packageRoot ('rehearsal-baselines/' + $name)) -Destination $demoFixture -ErrorAction Stop
}
Copy-Item -LiteralPath (Join-Path $packageRoot 'production-hotfix') -Destination $deliveryFixture -Recurse -ErrorAction Stop
```

Use a fresh extraction: an existing destination is a STOP, not permission to overwrite prior evidence or local databases. Install the exact lockfile dependencies inside `source/` before Node tests. To independently regenerate the hotfix, set `ESKAHADE_HOTFIX_BASELINE_DIR` to the extracted package's `production-hotfix/` and `ESKAHADE_HOTFIX_OUTPUT_DIR` to a new scratch directory, then run `node source/scripts/stabilization/delivery/prepare-hotfix.cjs`. Compare all five generated artifact files to their packaged SHA256 values. This reproduction was executed locally and matched byte-for-byte. Browser evidence is a recorded manual local session; no standalone browser automation script is claimed. Local fixtures must use the explicit localhost-only configs and fresh persistence paths described in the detailed isolation runbook. Never point rehearsal scripts at a remote binding.

## Known evidence and permission boundary

Read `evidence/` and the generated final report for actual current test counts. Fresh combined regression, native D1 finance/credentials, native recovery, isolation, hotfix, HTTP/browser, typecheck, lint delta and build results are recorded individually. Existing evidence is labelled historical, never relabelled as a new run. Four excluded regression entries remain NOT_RUN with reasons; native D1/browser coverage is recorded separately.

The latest read-only production schema query was denied with Cloudflare `7403`. No SQL write, IAM change or retry using broader permissions was attempted. Hotfix tests use the actual historical production DDL captured earlier, with only synthetic identities and **zero pending migrations applied**. The required auth columns exist in that DDL. This proves compatibility with that captured schema, not absence of current remote drift. An operator must supply a fresh read-only schema snapshot/confirmation using existing approved access; do not expand IAM implicitly. Fresh live schema compatibility is a hard remote gate.

The hotfix local browser uses public static assets fetched only from the existing production `/_next/static/` paths, without credentials/cookies; synthetic login requests go only to localhost. Assets are retained remotely by `keep_assets:true`. Local fixture DBs, dotenv, auth tokens, private settings and real customer rows are excluded from the release ZIP. The full application's proof/privacy tests do not prove R2 public access is already closed remotely. Whole-database native quick_check previously encountered SQLite NOMEM; complete offline integrity and native FK/core-table checks are separate evidence. Actual remote integrity and verified backup remain hard gates.

## Dependency and approval order

1. **Approve production hotfix + permanent detachment + preview closure.** No finance migration and no full candidate deployment belongs in this step. Preserve normal production traffic, DB/KV/R2/service/secret/asset identities. Revalidate the active ETag and settings before upload; if either differs, STOP and regenerate/review against that artifact. Freeze competing deployment/config pipelines without interrupting normal finance operations. The source workflows are manual only, but GitHub's old published workflow remains until separately approved publication/closure.
2. **Approve sandbox maintenance/backup/0192–0195.** Only after production detachment and old demo invocation drain are positively proven. Pause all sandbox/operator/CLI/background writers. Deploy the no-D1 maintenance responder to existing sandbox only; prove pre-maintenance operations have completed. Arbitrary sleeps or quiet metrics do not prove drain.
3. **Approve sandbox integrated application deployment and synthetic smoke/reopening.** Only after every recovery stage passes. Production stays permanently detached. Keep BRI/QLola OFF and historical mismatch quarantined.
4. **Approve production finance maintenance, verified private backup and 0187–0190.** Separate from the isolation hotfix and sandbox repair. All relevant production writers, including jobs, must be controlled for this later financial change window. The explicitly production-targeted no-D1 responder configuration is prepared under `scripts/stabilization/delivery/production-maintenance.jsonc`, uses the same concurrently tested import-free handler, and MUST NOT be deployed for the isolation hotfix. It intentionally pauses normal application writes only in the separately approved finance change window. It is insufficient alone: the prior binding inventory also identified `eskahade-pdf-test`, `eskahade-service-billing-auto` and `sukahideng-web` with production D1 access. Their actual writer/schedule/service behavior, owners, fresh identities and exact approved pause/drain controls remain external gates; no change to those other Workers is authorized or prepared blindly. Operator/CLI/REST writers are included. No production SQL proceeds until all such paths are demonstrably frozen and drained.
5. **Approve integrated production application deployment, R2 public-access closure/cache handling, privacy confirmation and smoke.** Follow the order below; resume only after schema/code/media/privacy and finance gates agree.
6. **External BRI/QLola contract/UAT/onboarding and activation** remain a future separate phase. Never infer approval from application release or demo readiness.

## Production hotfix execution (approval required)

Verify account `a170ed4144c00927988a828aa9a41896`; existing Worker `eskahade`; DB `eskahade-db` / `a2010f08-f314-46af-88fd-dbb9b4ef1bb1`. Read current deployment/version, code ETag, bindings, secrets names, asset configuration, compatibility, annotations/tags, logging/placement, domains/routes, preview settings and self-reference. Privately save exact before state with protected ACL. No new resources, secret retrieval/rotation or D1 mutations.

Require the exact hotfix baseline and a fresh schema comparison against the included compatibility SQL. Check required user columns, roles JSON validity and existing normal parent/finance dependencies. If unavailable or different, STOP; do not deploy the full integrated candidate to bypass this gate. The local 7403 failure has not been fixed by changing permissions.

Close production historical/aliased preview access using the existing subdomain settings operation: GET then POST `/accounts/a170ed4144c00927988a828aa9a41896/workers/scripts/eskahade/subdomain` with `{"enabled":true,"previews_enabled":false}` **only if the observed main-route enabled state is true**; otherwise preserve its observed boolean. GET and verify. Preserve all normal domains/routes. Check known old version URLs and service/version-override entrypoints; an old version with DEMO_DB must not remain selectable, even at 0%. Do not reactivate old versions to test them. Unknown additional callers are a STOP requiring precise closure approval.

The prepared hotfix upload is a multipart **code hotfix**, not the rejected settings-only operation and not a full application release. Target only `PUT /accounts/a170ed4144c00927988a828aa9a41896/workers/scripts/eskahade`. Parts: `worker.js` (`application/javascript+module`) and `metadata` (`application/json`) from `production-hotfix/upload-metadata.json`. Metadata preserves the captured compatibility/settings/annotations/tags and every non-secret binding except DEMO_DB, retains existing secret bindings via `keep_bindings:["secret_text"]` and existing assets via `keep_assets:true`; ASSETS remains bound. No asset files, secret values, SQL or new resources are uploaded. Compare this metadata to **fresh** settings before approval, including any fields newly exposed by the API; unknown semantics/drift STOP. The API's keep-assets support is documented in Cloudflare's multipart metadata/static-assets direct-upload documentation. No mutating uploader is executed by the package verifier.

The resulting Worker must have only DB production, no DEMO_DB; the exact hotfix code and unchanged assets/secrets/KV/R2/services/routes; no new bank activation; one isolated version at 100% and no old 0% version override target. Record the new version/deployment IDs and effective configuration diff, not just the upload response. Normal authorized production and parent login/read smoke must pass; old/demo/sandbox sessions and demo login must be denied. No synthetic finance posting on production. No remote probe of `/api/demo/reset` or historical schema endpoints is needed; local proof is included. Old running demo operations require positive completion evidence before any sandbox migration.

## Sandbox maintenance, backup and recovery

Use the included permanent-isolation runbook and exact 0192–0195 files/manifest. Both sandbox DB and DEMO_DB must be `677f05ba-9b52-4534-9542-96cc785f25e4`, never production. Verify effective deployment permission before any SQL. Deploy `sandbox-maintenance.jsonc` only to existing `eskahade-sandbox`, no D1/imports/jobs, then prove drain and exclusive operator access. Production hotfix never regains DEMO_DB.

Save a Time Travel bookmark and private D1 export outside Git/ZIP with user-only ACL. Verify hash, schema/ledger/counts, old-column row fingerprints, balances/payment/allocation/wallet/reservations, FK and complete integrity on a private local copy. A backup filename or successful download alone is insufficient. Recoverability, owner, retention and explicit manual recovery procedure must be recorded. No automatic restore.

Fresh preflight must match the approved baseline and known mismatch exactly. All commands explicitly use `--env sandbox --remote` and `eskahade-demo-db`. Apply **0192, checkpoint, 0193, checkpoint, 0194, checkpoint, 0195, postflight**. The included schema/ledger checker is intentionally labelled OFFLINE_SCHEMA_AND_LEDGER_ONLY; private old-row/money/FK/integrity gates are additional, mandatory. SQL checksums must match Git/package after CRLF→LF-only normalization; never trim or ignore substantive SQL. Do not bulk apply migrations or retry a timeout/partially applied stage. STOP in no-D1 maintenance on ambiguity.

Known demo payment/allocation discrepancy is preserved: no amount correction, redistribution, reservation release, invented settlement or automatic case-resolution. Stage 0194 adds quarantine protection if actually applied; existing remote quarantine is not claimed. Case-opening SQL in historical tests is not an approved remote stage. Native local recovery tests preserve the old 21 distribution/reservation records and demonstrate rollback/replay/overdraw/wallet guards.

After all stage gates and separate deployment approval, deploy the integrated application with `--env sandbox`, not the production-only hotfix. Verify exact dual-demo bindings, separate KV/R2, scoped mode, preview closure and all BRI/QLola OFF flags. Synthetic-only smoke covers login/session/dashboard/santri/kelas/finance/POS/parent/receipt/proof/role/navigation, money conservation, server/client/network errors and no bank requests. Approved identities and amounts must be explicit before remote writes. Reopen only after financial owner acceptance.

## Integrated production migration, media and application release

Under separately approved production maintenance, fresh read-only preflight must identify manual 0182–0186 schema accurately despite incomplete historical ledger. Verify `saldo_uang_jajan` already exists; **never replay 0191**. Confirm 0187–0190 have not already been applied and there is no schema drift. Back up privately and prove recovery before mutation. Run only, with a gate after each:

```
0187_finance_controlled_remediation.sql
0188_bri_evidence_guards.sql
0189_finance_snapshot_and_reporting.sql
0190_retire_removed_finance_sidebar.sql
```

Use explicit production DB and root config, never `--env sandbox`, `migrations apply`, 0192–0195, or a guessed numbering repair. Preserve every old financial row/value, payment/allocation balance, cash/wallet projection/reservation and role. Validate added constraints/views/FK/conservation. Do not stamp fictitious applied migration history or rewrite an already-applied file. Partial failure is STOP; no blind retry or automatic restore.

Run the permanent topology validator and build the integrated candidate from exact source/lockfile. Deploy only after schema gates, preserving the isolated production DB-only config and preview closure. Keep the approved production write freeze until privacy and smoke gates pass. The integrated media code supports authorized Worker access to legacy/public media paths and private proofs. Then, with separate R2 approval, close production `r2.dev`/any direct-public custom domain, verify a known existing approved synthetic canary is denied directly and authorized Worker media still works, and handle stale public caches under explicit approval. Do not use a guessed 404 as evidence or fetch real sensitive proof content for smoke. Only after closure is proven may the privacy-confirmation flag be approved/set. No secret change is required by the local package. Keep bank OFF throughout.

Verify production normal staff/Portal Ortu/finance read paths, private proof GET/HEAD ownership/role controls, photos, errors and effective deployment bindings. Any new public exposure or finance regression blocks reopening. Ordinary operator transactions require their own authorized operational context; the release does not fabricate production test money.

## STOP and recovery

Stop for wrong identity/hash/version, unavailable approval/permission/schema/backup/drain, resource provisioning, secret or unrelated binding/route drift, bank activation, unexpected old-data change, new integrity violation, partial migration uncertainty, failed normal session/media/finance smoke or unresolved runtime errors. Capture private actual state and correlation IDs without tokens/payload secrets. Continue only independent local diagnostics.

Never run automatic rollback to pre-isolation code/settings; that could restore DEMO_DB and fail-open sessions. No inverse DEMO_DB operation is included. Prefer a reviewed forward fix retaining isolation and current schema/privacy. Even the hotfix is not an automatic rollback target after the full release: schema/media compatibility must be reviewed. If recovery would reconnect production to demo, STOP for special approval. Do not restore a D1 backup automatically, undo ledger money or infer cancellation of bank instructions.

## Local journal and final status

Execution journal/issues/self-review are included in `evidence/delivery-journal.json`. The source remains a local patch; no Git mapping for the deployed compiled artifact is claimed. Suggested commit message for the integrated source: `fix(release): complete isolated hotfix and consolidated recovery delivery`.

Local readiness and remote GO are distinct. A passing local candidate is ready for owner review; production isolation is remote NO-GO until current-schema access, hotfix/preview approval and live verification. Full production is additionally NO-GO until financial maintenance/backup/0187–0190/R2/deployment/smoke pass. Sandbox is remote NO-GO until detachment/drain/backup/0192–0195/deployment/smoke pass. Live BRI/QLola remains NO-GO until authoritative contract/UAT and activation approval.

References: [Cloudflare multipart metadata](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/), [retaining existing static assets](https://developers.cloudflare.com/workers/static-assets/direct-upload/), [version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/), [version overrides](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/). Historical detailed finance/R2 and permanent-isolation runbooks are included for checks, with this document taking priority over any old reconnect/release order.
