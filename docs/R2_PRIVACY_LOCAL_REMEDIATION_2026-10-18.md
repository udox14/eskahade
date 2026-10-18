# Eskahade R2 privacy local remediation

Branch: `fix/finance-bri-audit-20261018`. Starting commit: `c1bee04eda85c030e699f3f005c058b864507eec`. Scope: the two legacy proof paths and verified-origin photo compatibility only. No remote test, deployment, migration, data rewrite, infrastructure change or A01–A18 re-audit.

Verdict: **R2_LOCAL_FIX_READY_FOR_REVIEW** after the validation recorded below. This is local code readiness for review, not verification that the production bucket is private or authorization to deploy.

## Implemented behavior

The generic public file route canonicalizes keys and rejects the `bukti-portal/` and `operasional-receipts/` prefixes together with existing new-finance proof and pengajian-evidence prefixes, before any R2 read. Invalid percent encoding, residual/double encoding, traversal, empty segments, backslashes, query/fragment ambiguity and malformed paths fail closed with 404/no-store. The generic public uploader and shared public upload helper also reject private prefixes. Ordinary public file delivery remains available.

Portal proofs are exposed through `/api/portal/payment-submissions/{id}/proof`. The server loads the submission and its stored reference; the URL does not select an arbitrary object key. Parents need a hydrated, active portal session, completed password-change policy and matching student ownership. Staff need the category-specific feature and existing SPP asrama/SADESA scope, or the existing NON_SPP role policy. Both GET and HEAD enforce the same checks. Missing, unlinked, foreign-origin or invalid references return generic 404/no-store. New parent proof uploads retain the existing ownership/status/2MB validation, add raster MIME/magic-byte validation and private metadata, and store a canonical R2 key. Parent history and staff confirmation DTOs return the resource URL. Existing stored references and object keys are not rewritten.

Operational receipts are exposed through `/api/operasional/transactions/{id}/proof`. Access requires a current staff identity, the relevant feature and the same unit policy used by the ledger. The transaction must exist and not be logically deleted, and its unit must remain active. The pure unit policy was extracted and reused by the existing ledger scope without changing accounting logic. GET/HEAD never call operational schema initialization or unit synchronization.

Proof routes also avoid the global `getSession()` hydration path, which can run lazy user-schema DDL. A route-local adapter reuses the existing signed JWT verifier and SELECTs current stored roles/asrama/structural scope, failing closed on missing data or invalid permissions. Global authentication/session code is unchanged. Role revocation is effective even when an older JWT claimed admin access. Existing DB helpers and demo routing are retained; no fallback to another database is introduced.

New operational uploads use `/api/operasional/receipts`, not the generic uploader. The server validates read/write feature permission, unit scope, bounded request size, raster image type/magic and a 3MB file limit. The server chooses the key and records uploader, unit and production/demo dataset in R2 metadata. The existing compressed-image upload and immediate preview flow are preserved. Draft preview is private, uploader/unit/dataset-bound and unavailable after a transaction references the object, including after logical deletion. Saving a resource URL resolves the existing reference server-side, preserving the original key; an unattached new reference must belong to the current uploader/unit. No new financial row/table/migration or cleanup scheduler is introduced.

Authorized GET streams the object; HEAD reads metadata only. Private responses override old public metadata with `Cache-Control: private, no-store`, add `nosniff`, and sandbox active content. CSP permits same-origin/data image rendering for the image viewer. Unexpected old content types are served as an attachment with `application/octet-stream`; new uploads accept JPEG, PNG, WebP and GIF. Denials are no-store and HEAD denials have no body. New dataset metadata is checked before reading proof contents. No object deletion or cache purge was added to these proof paths.

Legacy photo compatibility is a pure display conversion for the exact previously verified origin `https://pub-1209482eb6d6461389443ee22c5764f5.r2.dev`. Only `foto-santri/`, `avatar-profil/` and `dashboard/` keys resolve to the public application file route. Foreign hosts, credentials, unexpected ports, unknown/private prefixes and malformed paths fail closed to the existing empty-media fallback. Known same-origin photo URLs and bundled static media continue to work. The shared photo/avatar controls and actual direct photo renderers, including printed finance cards, use this conversion. Stored production records are not changed. Other image classes such as old QR/channel/signature links still need inventory before bucket closure; this helper deliberately does not turn arbitrary old URLs into public proxies.

## Verification

Evidence folder: `output/r2-local-privacy-c1bee04e/`. `verification.json` records the final build/typecheck exit codes; `commits.txt` records the final local commit and Git status.

- **24 targeted privacy cases PASS, 0 FAIL** in `privacy-results.json` / `privacy.log`.
- **44 regression suites PASS, 0 FAIL**: the existing selected 43 finance/BRI/migration suites plus the new R2 privacy suite. The 24 privacy cases are one of those suites, not 24 additional suites. Logs and machine-readable results are in `regression/`.
- Standalone TypeScript `tsc --noEmit --incremental false`: PASS, exit 0.
- `npm run build:cf` (Next.js webpack + OpenNext Cloudflare bundle): PASS, exit 0; final evidence in `verification.json` and `build-cf.log`. No deploy script is run. Existing OpenNext Windows runtime compatibility warning remains a platform limitation, not a deployment test.
- Focused diff/whitespace review: only proof authorization/upload/display integration, shared read-only scope extraction and photo display normalization. No global auth, BRI/QLola or finance-engine calculation/state code changed. Existing applied migrations and configuration remain unchanged.

Tests execute actual route/helper/action implementations with synthetic sessions, actual JWT signing/verification in the read-only-session case, in-memory SQLite schema from original 0057/0114 migration SQL plus the existing migration-derived finance fixture through 0189, and a fake R2 bucket containing synthetic bytes. The R2 adapter throws on deletion. No production personal/financial data, live R2 object or bank request is used.

Coverage includes encoded public-route bypasses; public media continuity; exact-origin photo allowlists; parent ownership/password policy; staff feature/category/asrama/SADESA scope; operational unit/deleted-row guards; metadata-only HEAD; unchanged schema and row-write counters on reads; missing demo rows with no production fallback; generic upload denial; scoped upload/private preview; wrong owner/unit/feature and read-only-role rejection; oversized/spoofed images; storage failure; attachment round-trip preservation; blocked preview for linked/deleted receipts; unchanged payment amount/method/detail fields after proof upload; current DB role revocation over stale JWT permissions; invalid JWT; active-content response safety; and dataset mismatch before content reads.

## Exact changed files

The list below includes the 32 implementation/test files and this report (33 files total). Many display integrations are only an import and a photo URL expression; they are direct media dependencies, not unrelated module refactors.

- `app/api/file/[...key]/route.ts`
- `app/api/operasional/receipts/preview/route.ts`
- `app/api/operasional/receipts/route.ts`
- `app/api/operasional/transactions/[id]/proof/route.ts`
- `app/api/portal/payment-submissions/[id]/proof/route.ts`
- `app/api/upload-foto/route.ts`
- `app/dashboard/asrama/spp/_page-content.tsx`
- `app/dashboard/asrama/spp/konfirmasi-portal/actions.ts`
- `app/dashboard/asrama/uang-jajan/_page-content.tsx`
- `app/dashboard/dewan-santri/uang-jajan/_page-content.tsx`
- `app/dashboard/keuangan/kredensial/card-print-sheet.tsx`
- `app/dashboard/keuangan/non-spp/konfirmasi-portal/actions.ts`
- `app/dashboard/keuangan/operasional/actions.ts`
- `app/dashboard/keuangan/status-pembayaran/_page-content.tsx`
- `app/dashboard/koperasi/loket/pos-student-card.tsx`
- `app/dashboard/operasional/_page-content.tsx`
- `app/dashboard/operasional/actions.ts`
- `app/dashboard/profil/actions.ts`
- `app/dashboard/santri/foto/_page-content.tsx`
- `app/portal-ortu/(app)/akun/_akun-client.tsx`
- `app/portal-ortu/(app)/beranda/page.tsx`
- `app/portal-ortu/(app)/riwayat/page.tsx`
- `app/portal-ortu/(app)/tagihan/actions.ts`
- `components/layout/header.tsx`
- `components/ui/santri-photo-avatar.tsx`
- `docs/R2_PRIVACY_LOCAL_REMEDIATION_2026-10-18.md`
- `lib/operasional.ts`
- `lib/operasional/scope.ts`
- `lib/r2/private-proofs.ts`
- `lib/r2/read-session.ts`
- `lib/r2/references.ts`
- `lib/r2/upload.ts`
- `scripts/test-r2-privacy.cjs`

## Remaining risks and separately approved production actions

1. The production bucket's public r2.dev endpoint was enabled at the last read-only configuration review. These application guards cannot close direct public bucket access. No current remote privacy pass is claimed. The R2 setting must remain unchanged in this task; later closure needs explicit approval after deployed-media and legacy-link checks.
2. Review and separately authorize deployment of this commit, along with the existing application/schema deployment dependencies. This task does not deploy the production/sandbox Worker or apply any migration. The existing `users`, `santri`, portal-submission and operational tables/columns must already exist; private reads fail closed rather than lazily creating missing schema.
3. Obtain a counts-only inventory of old absolute references and verify the deployed same-origin media routes before closure. Unknown origins/paths, encoded malformed keys and old unsupported types require review rather than a public fallback. Old external r2.dev bookmarks cannot be redirected by this application mapping; any reissued links/notifications require separate operational authorization.
4. After an approved deployment and separately approved bucket closure, verify harmless canaries: anonymous direct old-origin access denied, intended public application media still accessible, and private resource/role/ownership negatives enforced. No real sensitive proof download or production financial fixture is needed. Any new synthetic R2 fixture requires its own approved object/linkage/cleanup scope.
5. Existing one-year public browser/offline copies cannot be revoked by an application fix or bucket closure. Any edge purge, object rotation/deletion/metadata rewrite or abandoned-draft cleanup needs separate authorization. No automatic cleanup or destructive change is included.
6. `FINANCE_PROOFS_PRIVATE_STORAGE_CONFIRMED` was not set. Do not enable privacy-confirmation flags before approved infrastructure closure and verification. The disposable remote Worker/D1 behavioral test remains **DEFERRED**; no broader OAuth permissions or resources were requested or created. External BRI/UAT and go-live gates remain separate.

Production/demo/rehearsal databases were not queried or mutated, no private remote object was read, no R2 setting/object/cache was changed, no application credential/feature flag changed, and there was no Git push/merge or Worker deployment. Existing unrelated untracked audit bundles remain preserved. Stop after reporting.
