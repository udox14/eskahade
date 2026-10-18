# Controlled remediation — 18 October 2026

Base: `6ee5debfb39881aba7bd74b4c3f1058a97210308`. Branch: `fix/finance-bri-audit-20261018`.
Existing untracked audit report/output are preserved. No remote mutations, deployment, bank requests, flag changes or pushes are authorized.

## Checkpoint 0 — revalidation

| ID | Validity | Severity | Entry points / root cause | Planned fix | Required regression |
|---|---|---|---|---|---|
| A01 | CONFIRMED | P1 | Correction commits before wallet reversal | Single batch and durable request identity | Every write failure, partial/replay/concurrent correction |
| A02 | CONFIRMED | P1 | Loket maps, separate payment/wallet/cash writes | Durable operation/PIN authorization, composable existing engine batch | Sequential/cross-isolate replay, limits, lost response, rollback |
| A03 | CONFIRMED | P1 | Actual UI uses direct terminal distribution INSERT | Existing draft/prepare/finalize workflows, INSERT guards | Actual actions, each method/recipient, evidence/reservations |
| A04 | CONFIRMED | P1 | Generic file endpoint serves both proof prefixes | Block public proof access; scoped private retrieval/upload | Anonymous/wrong role/resource and public asset compatibility |
| A05 | CONFIRMED | P1 | BRI writes synthetic wallet columns | Actual movement_type/reference_id ledger writes | Migration-derived wallet/topup/rollback |
| A06 | CONFIRMED | P1 | Statement decoder assumes non-contract structure | Strict versioned decoder/totals, fail closed on incomplete lines | Official fixture, malformed/duplicate/incomplete response |
| A07 | CONFIRMED | P1 | Inquiry UPSERT overwrites original order snapshot | Immutable replay identity and durable persistence | Same replay/replacement/collision/persistence fault |
| A08 | CONFIRMED | P1 | Payment guard has no expiry evidence policy | Validate bank time and immutable expiry; reconcile late evidence | Expired/replaced/cancelled and bank-time boundary |
| A09 | PARTIALLY CONFIRMED | P1 | Root trxId/codes/channel/padding mismatch | Recheck official request/response schemas before edits | Official service-specific fixtures; malformed identity |
| A10 | CONFIRMED | P1 | Read actions omit authorization | Finance action permission/resource checks | Anonymous/no feature/pimpinan/demo scope |
| A11 | CONFIRMED | P2 | VA ownership can be overwritten | Immutable ownership with additive guards | Existing records, replacement/reuse/inactive |
| A12 | CONFIRMED | P2 | Beneficiary service invents isMatched/name | Explicit NOT_VERIFIED, no invented evidence | Invalid and plausible account both unverified |
| A13 | PARTIALLY CONFIRMED | P1 | Statement workflows/reports not wired; external transport lacks entitlement | Wire authorized local workflow and reports; keep external calls gated | Actions/reports, flags, unknown outcome |
| A14 | CONFIRMED | P2 | Recovery asserts exact identity from amount | Explicit audited manual resolution or proven linkage | Two students/same amount, unrelated credit |
| A15 | CONFIRMED | P2 | Query errors swallowed as consistency | Per-check PASS/FAIL/ERROR/NOT_CHECKED | Missing schema/failing query blocks gate |
| A16 | CONFIRMED | P2 | Cancel/bridge reference removed column | Use actual schema fields | Before/after write, bridge preservation |
| A17 | CONFIRMED | P2 | floor/clamp/config failure defaults/snapshot gaps | Strict safe integers, fail-closed reads, immutable snapshot, atomic exemptions | Invalid numbers, config failure/change, exemption failure |
| A18 | PARTIALLY CONFIRMED | P2 | Incorrect fixtures and stale UAT; historical manual migration ledger | Real-schema fixtures and truthful evidence; forward migration only | Original suites, local schema/migration/conservation |

A09: original audit suggestion that Payment must require totalAmount is **not accepted without contract confirmation**. Inquiry response and Payment request are distinct. Historical manual migrations 0182–0186 are already applied; `d1_migrations` is not their authoritative history.

External gates: partner entitlement, inbound token/onboarding identity contract, BRI sandbox interoperability and QLola non-STP H2H remain required. No public bank API is presumed to provide QLola Signer approval.

## Penutupan checkpoint 4

Status akhir per temuan, reproduksi sebelum/sesudah, evidence pengujian dan batas eksternal dicatat pada [laporan remediation](C:/DATA/eskahade/docs/FINANCE_BRI_REMEDIATION_REPORT_2026-10-18.md). A04 dan A09 tetap PARTIALLY_FIXED; A12 CONTRACT_BLOCKED; A13 PARTIALLY_FIXED. Temuan lain FIXED_AND_VERIFIED dalam batas verifikasi lokal. Subklaim A09 bahwa Payment wajib totalAmount ditolak berdasarkan tabel request publik. Tidak ada klaim bank go-live.
