# Independent review follow-up — 18 October 2026

Review baseline: `ac9e4fa9772163b28c22090f2ae192d0f3163d81`. Branch: `fix/finance-bri-audit-20261018`. This report accompanies a new local follow-up commit; it does not alter the sealed review archive for the baseline. No push, merge, deployment, remote mutation, credential change, live bank request or feature enablement occurred.

## Timestamp finding: reproduction and root cause

The precise reported mismatch is **not reproduced at the declared baseline**. Its actual payment INSERT already binds `confirmedAt` to `finance_payments.paid_at`, and application `timestamp` to `created_at`. A signed event with bank payment 09:59, order created 08:00 / expiry 10:00, callback 10:05 succeeds with all migration-derived triggers enabled, both before and after this follow-up. Direct SQL that supplies callback time as paid_at correctly fails the unchanged 0188 guard, but is not the baseline service's INSERT.

Related defects were reproduced and fixed:

- The optional `trxDateTime` fallback `... : now()` invented bank event time when it was missing. An on-time callback without bank time previously auto-allocated money. It now preserves the authenticated sanitized payload and creates a recovery item for the known VA, returning a non-success business response without payment/allocation/wallet/income writes.
- Malformed bank time previously returned a format error without durable review evidence. It now retains evidence and a recovery item while preserving the format-error response. Optional in the public protocol does not mean safe for automatic allocation.
- Bank time before order creation was only rejected by SQL, leaving no durable callback review record. The service now checks both validity boundaries before allocation and records review; the SQL guard remains unchanged.
- An order state change immediately before INSERT could roll back the batch and return without retaining the authenticated event. The guard-abort path now records review after rollback; it does not bypass the guard or allocate to a replacement.

`paid_at` remains normalized, authenticated bank event time. `finance_payments.created_at` and event/metadata `created_at` remain application processing time. Reconciliation metadata preserves the exact bank-supplied `trx_date_time`, including its original offset. No new timestamp is fabricated, no expiry extended, and migration 0188 is not weakened or edited. Fresh authenticated request/header timestamp validation remains in place; this does not waive replay-window authentication for stale headers.

### Required cases, real schema

| Case | Outcome |
|---|---|
| On-time payment / on-time callback | PAID, event and processing timestamps remain distinct |
| 09:59 payment / 10:05 callback | PAID; paid_at=02:59Z and created_at=03:05Z; all triggers pass |
| Payment after expiry | Evidence/recovery, no automatic allocation |
| Missing bank time | Evidence/recovery, no processing-time substitute |
| Malformed bank time | Format rejection plus evidence/recovery |
| Bank time before order creation | Evidence/recovery before financial INSERT |
| Duplicate delayed callback | One payment, allocation entitlement, cooperative fee and wallet top-up |
| Replaced/expired/cancelled order | Evidence/recovery; no allocation, including same-amount replacement |
| Lost HTTP response | Actual v2.0 payment route replay returns success with one committed result |
| Concurrent terminal order change at INSERT | Existing SQL guard aborts; review evidence survives rollback |
| Direct SQL outside order validity / malformed paid_at | Unchanged expiry guard rejects insertion |

The test harness uses the actual finance SQL migrations through 0189, foreign keys ON, and all derived triggers. It mocks only the local database API adapter/auth/runtime and bank transport; it does not replace financial tables with a mock schema. Controlled clock tests exercise the services and the real HTTP route. No live financial operation is involved.

## Bank Statement cursor completeness

The [BRI v2.1 public specification](https://developers.bri.co.id/id/node/54255), rechecked on this date, labels totals, counts and detailData optional. The implementation and TypeScript protocol types retain that optionality. Absence alone is **not** an invalid mandatory field or an accounting discrepancy.

The explicit conservative local cursor policy submitted for review is:

- `VERIFIED_TOTALS`: successful provider response, explicit detail array, both credit/debit amounts and counts present, every record valid, and both totals/counts consistent. Only this state advances the cursor under the current local policy.
- `UNVERIFIED`: successful response without sufficient completeness evidence. Store fetch `PENDING`, cursor=0, hasDiscrepancy=false. Do not ingest rows into the settlement-eligible transaction set or settle from the held fetch. Missing totals, missing either count, and omitted detailData are covered separately.
- `INVALID`: malformed/truncated record or inconsistent supplied totals. Store fetch `DISCREPANCY`, cursor=0; no partial row ingestion.
- An explicit empty array with both zero amounts/counts is accepted; omitted details with zero totals is conservatively held. Provider failure remains FAILED and does not advance.

Totals consistency is a local completeness criterion, not proof that BRI returned every page or every transaction in a window. No documented paging/window guarantee or partner-approved alternative completeness signal has been supplied. Live statement sync remains disabled pending entitlement, pagination/window semantics and bank UAT. This follow-up neither invents a bank completeness guarantee nor enables the integration.

## Settlement financial semantics

Migration 0189's arithmetic is retained: BRI headers store principal and cooperative admin separately, while the reporting view shows their combined collection receipt. Adding the separately stored admin **once** in that projection is not duplicate income. Settlement/replay does not post a second cooperative-income entry. The report previously described the received amount as effective bank balance and named the Pesantren as collection owner; those labels are corrected. The view is not a distribution-balance source.

The real-schema conservation test uses a mixed obligation/wallet payment and a synthetic known customer-paid bank fee:

| Meaning | Amount | Evidence/source |
|---|---:|---|
| Original principal | 10,000 | payment and settlement header principal |
| Obligation rights | 7,000 | SPP allocation and existing distribution eligibility engine |
| Entrusted wallet money | 3,000 | UANG_JAJAN allocation, wallet ledger/cache |
| Cooperative administration income | 2,000 | separate cooperative-income entry and header field |
| Eskahade amount charged / bank collection receipt | 12,000 | order total, statement credit, view gross/net |
| Synthetic customer-paid external BRI fee | 500 | payment fee metadata in test; outside collection amount |
| Total payer cost when that fee is known | 12,500 | principal + admin + known external fee |
| Deduction from tested collection settlement | 0 | statement matches full 12,000; not a claim that bank customer fee is zero |
| Available institutional distribution before any reservation | 7,000 | existing allocation engine; excludes wallet and cooperative income |

Conservation: 12,000 received = 7,000 obligation rights + 3,000 wallet liability + 2,000 cooperative income. Matching/replaying settlement keeps the cooperative income at 2,000 and creates one settlement linkage. The view and both report/list services return 12,000 collection receipt. No second distribution engine or fee calculation was introduced.

The callback itself still stores unknown bank fee as NULL. The 500 fixture is supplied explicitly as synthetic metadata, not an inferred contract tariff. If actual partner fees reduce collection credit or have different semantics, the current full-credit amount check fails closed; a contract-backed design/UAT is required. Unknown fee does not establish total payer cost.

## Exact changed files and purpose

| File | Purpose |
|---|---|
| `lib/finance/bri/briva-service.ts` | Remove invented bank time, retain review evidence, creation-boundary/race handling; preserve paid_at vs created_at |
| `lib/finance/bri/statement-service.ts` | Explicit completeness state and safe cursor hold without declaring optional fields mandatory |
| `lib/finance/reports.ts` | Identify BRI collection as Koperasi, not fabricated Pesantren ownership |
| `app/dashboard/keuangan/laporan/_page-content.tsx` | Clarify collection receipt vs bank balance/distributable amount and settlement deductions vs external customer fee, including print |
| `app/dashboard/keuangan/rekonsiliasi/_page-content.tsx` | Clarify admin/titipan exclusion from distribution rights and settlement labels |
| `scripts/test-finance-bri-review-followup.cjs` | 20 named real-schema follow-up scenarios including HTTP replay, order race and conservation |
| `scripts/test-bri-collection.cjs` | Preserve existing scenarios; explicitly test missing-time hold and reliable corrected evidence, date valid fixture events |
| `scripts/test-bri-settlement.cjs` | Give positive WEAK identity scenarios complete consistent totals; keep ambiguity/dedup assertions |
| `scripts/test-finance-bri-remediation.cjs` | Give existing positive HTTP fixture an actual bank event time |
| `docs/FINANCE_BRI_REMEDIATION_RUNBOOK.md` | Record updated timestamp and cursor policy / remaining gates |
| `docs/BRI_INDEPENDENT_REVIEW_FOLLOWUP.md` | This report, before/after reasoning and scope |
| `docs/BRI_REVIEW_FOLLOWUP_EVIDENCE.json` | Machine-readable before/after and regression/build/typecheck evidence |

## Verification and limitations

Twenty identical follow-up checks were executed against baseline service/report sources loaded read-only from Git, then against the repaired files, on the unchanged migration-derived schema. Baseline: 9 pass / 11 fail; repaired: 20 pass / 0 fail. Failures include new completeness observability assertions, not eleven distinct defects. Notably, the originally reported delayed-callback case passes **in both versions**. Baseline source injection affects only in-process source reads, not the checkout or commits.

Reproduce locally (the baseline invocation intentionally exits nonzero):

```powershell
node scripts/test-finance-bri-review-followup.cjs --baseline=ac9e4fa9772163b28c22090f2ae192d0f3163d81 --evidence=output/review-followup/before.json
node scripts/test-finance-bri-review-followup.cjs --evidence=output/review-followup/after.json
```

Regression: all 41 suite files pass (36 finance/BRI including the new suite, plus five historical migration suites). This includes the existing 0187–0189 forward compatibility/data-preservation/FK check, correction/loket fault/replay/concurrency, distribution reservation/evidence, auth/proof and demo isolation tests. No relevant assertion was skipped or financial guard disabled. Positive fixture updates do not remove the new missing-data negative cases.

TypeScript `tsc --noEmit`: PASS (exit 0). Production-equivalent `npm run build:cf`: PASS (exit 0; Next production compilation and OpenNext Worker bundle complete). The first build attempt encountered Windows EPERM writing a generated .next directory; the permitted retry did not deploy. Local outputs are in `output/review-followup/`, `output/review-followup-typecheck.log` and `output/review-followup-build.log`.

Final diff is restricted to the files listed above; no migration SQL, auth/session/global DB selector, dependency, deployment config or unrelated module changed. The original audit artifacts and baseline review ZIP are preserved. Existing and new tests remain local SQLite/HTTP simulations; no claim of real D1 distributed concurrency, browser UAT or bank interoperability is made.

## Status

- Local commit SHA: the follow-up commit containing this report; exact SHA supplied in the handoff after commit.
- Migration status: **UNAPPLIED REMOTELY** for 0187–0189. No SQL file was changed in this follow-up. Applied 0182–0186 remain untouched.
- Deployment status: **NOT DEPLOYED**. No push or merge.
- External gates remain: **A04 direct R2/custom-domain/cache privacy**, BRI partner onboarding/token/version/time semantics, statement completeness/pagination/entitlement, beneficiary inquiry, Transaction Status Inquiry and QLola non-STP/Signer UAT. No gate was enabled or declared resolved.
- Final verdict: **READY_FOR_REVIEW**. This is a local engineering handoff, not independent approval or production authorization.

Public references checked: [BRIVA Online SNAP BI](https://developers.bri.co.id/id/snap-bi/apidocs-virtual-account-briva-online-snap-bi) (trxDateTime optional; raw signed event/reconciliation), [Bank Statement v2.1](https://developers.bri.co.id/id/node/54255) (optional totals/counts/detail data). Partner-specific semantics remain external contract requirements.
