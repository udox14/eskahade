# Inventaris file remediation

Baseline `6ee5debfb39881aba7bd74b4c3f1058a97210308`; branch `fix/finance-bri-audit-20261018`. Semua path di bawah merupakan perubahan remediation; artefak audit awal/output generated tidak dimasukkan. Tidak ada perubahan modul akademik, auth/session global, DB selector global, package atau deployment config.

| File | Alasan |
|---|---|
| [app/api/bri/v1.0/transfer-va/inquiry/route.ts](C:/DATA/eskahade/app/api/bri/v1.0/transfer-va/inquiry/route.ts) | Canonical protocol route/raw signature/error sanitization; production alias/onboarding gate (A09). |
| [app/api/bri/v1.0/transfer-va/payment/route.ts](C:/DATA/eskahade/app/api/bri/v1.0/transfer-va/payment/route.ts) | Canonical protocol route/raw signature/error sanitization; production alias/onboarding gate (A09). |
| [app/api/file/[...key]/route.ts](C:/DATA/eskahade/app/api/file/[...key]/route.ts) | Tutup akses/unggah publik financial proof, pertahankan aset publik lain (A04). |
| [app/api/finance/proofs/[...key]/route.ts](C:/DATA/eskahade/app/api/finance/proofs/[...key]/route.ts) | Private proof upload/retrieval dengan auth, RBAC, metadata dan no-store (A04). |
| [app/api/finance/proofs/route.ts](C:/DATA/eskahade/app/api/finance/proofs/route.ts) | Private proof upload/retrieval dengan auth, RBAC, metadata dan no-store (A04). |
| [app/api/upload-foto/route.ts](C:/DATA/eskahade/app/api/upload-foto/route.ts) | Tutup akses/unggah publik financial proof, pertahankan aset publik lain (A04). |
| [app/dashboard/keuangan/kredensial/actions.ts](C:/DATA/eskahade/app/dashboard/keuangan/kredensial/actions.ts) | Entry-point authentication, feature/role/mutation guard dan scope; nominal/config sesuai schema (A10/A17). |
| [app/dashboard/keuangan/laporan/actions.ts](C:/DATA/eskahade/app/dashboard/keuangan/laporan/actions.ts) | Entry-point authentication, feature/role/mutation guard dan scope; nominal/config sesuai schema (A10/A17). |
| [app/dashboard/keuangan/penyaluran/actions.ts](C:/DATA/eskahade/app/dashboard/keuangan/penyaluran/actions.ts) | Entry-point authentication, feature/role/mutation guard dan scope; nominal/config sesuai schema (A10/A17). |
| [app/dashboard/keuangan/penyaluran/catat-penyaluran-modal.tsx](C:/DATA/eskahade/app/dashboard/keuangan/penyaluran/catat-penyaluran-modal.tsx) | Master account, nama penerima/private proof dan idempotency UI distribution (A03/A04). |
| [app/dashboard/keuangan/rekonsiliasi/_page-content.tsx](C:/DATA/eskahade/app/dashboard/keuangan/rekonsiliasi/_page-content.tsx) | Workbench reconciliation operator dengan evidence/notes/confirmation dan flag sync (A13). |
| [app/dashboard/keuangan/rekonsiliasi/actions.ts](C:/DATA/eskahade/app/dashboard/keuangan/rekonsiliasi/actions.ts) | Entry-point authentication, feature/role/mutation guard dan scope; nominal/config sesuai schema (A10/A17). |
| [app/dashboard/keuangan/rekonsiliasi/bri-actions.ts](C:/DATA/eskahade/app/dashboard/keuangan/rekonsiliasi/bri-actions.ts) | Authorized operator statement/recovery/settlement actions ke service existing (A10/A13). |
| [app/dashboard/keuangan/rekonsiliasi/bri-workbench.tsx](C:/DATA/eskahade/app/dashboard/keuangan/rekonsiliasi/bri-workbench.tsx) | Workbench reconciliation operator dengan evidence/notes/confirmation dan flag sync (A13). |
| [app/dashboard/keuangan/rekonsiliasi/record-correction-modal.tsx](C:/DATA/eskahade/app/dashboard/keuangan/rekonsiliasi/record-correction-modal.tsx) | Pertahankan correction idempotency key saat retry (A01). |
| [app/dashboard/keuangan/riwayat/actions.ts](C:/DATA/eskahade/app/dashboard/keuangan/riwayat/actions.ts) | Entry-point authentication, feature/role/mutation guard dan scope; nominal/config sesuai schema (A10/A17). |
| [app/dashboard/keuangan/status-pembayaran/actions.ts](C:/DATA/eskahade/app/dashboard/keuangan/status-pembayaran/actions.ts) | Entry-point authentication, feature/role/mutation guard dan scope; nominal/config sesuai schema (A10/A17). |
| [app/dashboard/keuangan/tarif/actions.ts](C:/DATA/eskahade/app/dashboard/keuangan/tarif/actions.ts) | Entry-point authentication, feature/role/mutation guard dan scope; nominal/config sesuai schema (A10/A17). |
| [app/dashboard/keuangan/uang-jajan/actions.ts](C:/DATA/eskahade/app/dashboard/keuangan/uang-jajan/actions.ts) | Entry-point authentication, feature/role/mutation guard dan scope; nominal/config sesuai schema (A10/A17). |
| [app/dashboard/koperasi/loket/actions.ts](C:/DATA/eskahade/app/dashboard/koperasi/loket/actions.ts) | Durable receipt/PIN dan atomic mixed payment/wallet/cash, data scope operator (A02/A10). |
| [app/snap/v1.0/transfer-va/inquiry/route.ts](C:/DATA/eskahade/app/snap/v1.0/transfer-va/inquiry/route.ts) | Canonical protocol route/raw signature/error sanitization; production alias/onboarding gate (A09). |
| [app/snap/v1.0/transfer-va/payment/route.ts](C:/DATA/eskahade/app/snap/v1.0/transfer-va/payment/route.ts) | Canonical protocol route/raw signature/error sanitization; production alias/onboarding gate (A09). |
| [app/snap/v2.0/transfer-va/inquiry/route.ts](C:/DATA/eskahade/app/snap/v2.0/transfer-va/inquiry/route.ts) | Canonical protocol route/raw signature/error sanitization; production alias/onboarding gate (A09). |
| [app/snap/v2.0/transfer-va/payment/route.ts](C:/DATA/eskahade/app/snap/v2.0/transfer-va/payment/route.ts) | Canonical protocol route/raw signature/error sanitization; production alias/onboarding gate (A09). |
| [docs/BRI_7_WALKTHROUGH.md](C:/DATA/eskahade/docs/BRI_7_WALKTHROUGH.md) | Koreksi runbook/UAT/walkthrough yang superseded; jangan reapply 0182–0186 atau mengklaim bank go-live (A18). |
| [docs/BRI_PRODUCTION_RUNBOOK.md](C:/DATA/eskahade/docs/BRI_PRODUCTION_RUNBOOK.md) | Koreksi runbook/UAT/walkthrough yang superseded; jangan reapply 0182–0186 atau mengklaim bank go-live (A18). |
| [docs/BRI_UAT_REPORT.md](C:/DATA/eskahade/docs/BRI_UAT_REPORT.md) | Laporan akhir A–F, status A01–A18, before/after dan batas verifikasi. |
| [docs/FINANCE_BRI_REMEDIATION_EVIDENCE.json](C:/DATA/eskahade/docs/FINANCE_BRI_REMEDIATION_EVIDENCE.json) | Ringkasan machine-readable verifikasi lokal checkpoint 4. |
| [docs/FINANCE_BRI_REMEDIATION_FILES.md](C:/DATA/eskahade/docs/FINANCE_BRI_REMEDIATION_FILES.md) | Inventaris lengkap perubahan dan alasan per file. |
| [docs/FINANCE_BRI_REMEDIATION_MATRIX.md](C:/DATA/eskahade/docs/FINANCE_BRI_REMEDIATION_MATRIX.md) | Revalidasi awal dan status akhir A01–A18. |
| [docs/FINANCE_BRI_REMEDIATION_REPORT_2026-10-18.md](C:/DATA/eskahade/docs/FINANCE_BRI_REMEDIATION_REPORT_2026-10-18.md) | Laporan akhir A–F, status A01–A18, before/after dan batas verifikasi. |
| [docs/FINANCE_BRI_REMEDIATION_RUNBOOK.md](C:/DATA/eskahade/docs/FINANCE_BRI_REMEDIATION_RUNBOOK.md) | Koreksi runbook/UAT/walkthrough yang superseded; jangan reapply 0182–0186 atau mengklaim bank go-live (A18). |
| [lib/finance/authorization.ts](C:/DATA/eskahade/lib/finance/authorization.ts) | Auth/feature/role guard finance dan validasi multi-role operator tersimpan (A10). |
| [lib/finance/bri/account-inquiry-service.ts](C:/DATA/eskahade/lib/finance/bri/account-inquiry-service.ts) | Explicit NOT_VERIFIED tanpa nama/reference bank palsu (A12). |
| [lib/finance/bri/audit-report-service.ts](C:/DATA/eskahade/lib/finance/bri/audit-report-service.ts) | PASS/FAIL/ERROR/NOT_CHECKED dan false-green guard (A15). |
| [lib/finance/bri/briva-config.ts](C:/DATA/eskahade/lib/finance/bri/briva-config.ts) | Partner Service ID tervalidasi terpisah dari X-PARTNER-ID (A09). |
| [lib/finance/bri/briva-service.ts](C:/DATA/eskahade/lib/finance/bri/briva-service.ts) | Immutable inquiry, protokol/payment identity, expiry/evidence dan atomic wallet (A05/A07/A08/A09). |
| [lib/finance/bri/briva-types.ts](C:/DATA/eskahade/lib/finance/bri/briva-types.ts) | Kontrak wire dan response codes per layanan BRIVA (A09). |
| [lib/finance/bri/cash-manual-distribution-service.ts](C:/DATA/eskahade/lib/finance/bri/cash-manual-distribution-service.ts) | Evidence, private proof, stored operator, integer dan master-account guards (A03/A04/A17). |
| [lib/finance/bri/feature-flags.ts](C:/DATA/eskahade/lib/finance/bri/feature-flags.ts) | Production QLola tetap hard-disabled (A03/A13). |
| [lib/finance/bri/matching-engine.ts](C:/DATA/eskahade/lib/finance/bri/matching-engine.ts) | Amount/remark hanya kandidat sampai mapping bank terbukti (A14). |
| [lib/finance/bri/proof-storage-service.ts](C:/DATA/eskahade/lib/finance/bri/proof-storage-service.ts) | No false upload success; produksi fail closed tanpa konfirmasi private storage (A04). |
| [lib/finance/bri/qlola-service.ts](C:/DATA/eskahade/lib/finance/bri/qlola-service.ts) | Production non-STP contract gate, draft idempotency/master account/reservations (A03/A12). |
| [lib/finance/bri/qlola-types.ts](C:/DATA/eskahade/lib/finance/bri/qlola-types.ts) | Tipe beneficiary unverified dan workflow yang sesuai (A12). |
| [lib/finance/bri/recovery-service.ts](C:/DATA/eskahade/lib/finance/bri/recovery-service.ts) | Recovery operator berbukti bank dan atomic payment/allocation/wallet/settlement (A05/A13/A14). |
| [lib/finance/bri/settlement-service.ts](C:/DATA/eskahade/lib/finance/bri/settlement-service.ts) | Authorized manual provenance, collection account dan no unverified exact match (A13/A14). |
| [lib/finance/bri/statement-service.ts](C:/DATA/eskahade/lib/finance/bri/statement-service.ts) | Parser statement v2.1, validasi lengkap, dedup dan cursor fail closed (A06/A13). |
| [lib/finance/bri/statement-types.ts](C:/DATA/eskahade/lib/finance/bri/statement-types.ts) | Struktur response statement resmi dan provenance (A06). |
| [lib/finance/bri/unallocated-service.ts](C:/DATA/eskahade/lib/finance/bri/unallocated-service.ts) | Evidence/manual review tanpa fabricated BRIVA identity (A13/A14). |
| [lib/finance/bridge.ts](C:/DATA/eskahade/lib/finance/bridge.ts) | Kolom cooperative_admin_fee schema aktual, legacy behavior tetap (A16). |
| [lib/finance/cash-session.ts](C:/DATA/eskahade/lib/finance/cash-session.ts) | Validasi nominal kas tanpa pembulatan (A02/A17). |
| [lib/finance/cooperative-admin.ts](C:/DATA/eskahade/lib/finance/cooperative-admin.ts) | Fee rule integer, fail-closed config dan snapshot (A17). |
| [lib/finance/corrections.ts](C:/DATA/eskahade/lib/finance/corrections.ts) | Atomic correction termasuk wallet/cash/fee dan idempotency/concurrency (A01). |
| [lib/finance/distribution-types.ts](C:/DATA/eskahade/lib/finance/distribution-types.ts) | Input nama penerima/idempotency workflow (A03). |
| [lib/finance/distributions.ts](C:/DATA/eskahade/lib/finance/distributions.ts) | Actual UI path memakai engine draft/prepare/finalize, canonical accounts/private proof (A03/A04). |
| [lib/finance/exemptions.ts](C:/DATA/eskahade/lib/finance/exemptions.ts) | Grant/revoke konsisten atomik, riwayat dan lingkup academic year (A17). |
| [lib/finance/fund-management.ts](C:/DATA/eskahade/lib/finance/fund-management.ts) | Config/timestamp error eksplisit, tanpa fallback finansial palsu (A17). |
| [lib/finance/money.ts](C:/DATA/eskahade/lib/finance/money.ts) | Validasi integer Rupiah aman dan penjumlahan overflow-safe (A17). |
| [lib/finance/operation.ts](C:/DATA/eskahade/lib/finance/operation.ts) | Durable idempotency dengan request hash, actor, receipt, serta hash otorisasi PIN (A01/A02). |
| [lib/finance/orders.ts](C:/DATA/eskahade/lib/finance/orders.ts) | Composable order, strict money/server fee snapshot dan schema cancellation (A02/A16/A17). |
| [lib/finance/payment-types.ts](C:/DATA/eskahade/lib/finance/payment-types.ts) | Snapshot cooperative fee pada order (A17). |
| [lib/finance/payments.ts](C:/DATA/eskahade/lib/finance/payments.ts) | Composable payment dan atomic statements, strict amount (A02/A17). |
| [lib/finance/proofs.ts](C:/DATA/eskahade/lib/finance/proofs.ts) | Canonical proof key, private URL, ownership dan resource authorization (A04). |
| [lib/finance/reconciliation-types.ts](C:/DATA/eskahade/lib/finance/reconciliation-types.ts) | Tipe workflow koreksi idempotent (A01). |
| [lib/finance/reports.ts](C:/DATA/eskahade/lib/finance/reports.ts) | Laporan settlement legacy dan BRI melalui view gabungan (A13). |
| [lib/finance/settlement.ts](C:/DATA/eskahade/lib/finance/settlement.ts) | Query settlement terpadu dan read-model schema aktual (A13). |
| [lib/finance/tariffs.ts](C:/DATA/eskahade/lib/finance/tariffs.ts) | Nominal integer tanpa floor/normalisasi diam-diam (A17). |
| [lib/finance/va.ts](C:/DATA/eskahade/lib/finance/va.ts) | Ownership Fixed VA permanen dan larangan reuse (A11). |
| [lib/finance/wallet-statements.ts](C:/DATA/eskahade/lib/finance/wallet-statements.ts) | SQL ledger schema aktual dan cache saldo dalam batch (A01/A02/A05). |
| [lib/finance/wallet.ts](C:/DATA/eskahade/lib/finance/wallet.ts) | Shared ledger statements dan safe integer limits (A01/A02/A17). |
| [lib/finance/write-plan.ts](C:/DATA/eskahade/lib/finance/write-plan.ts) | Komposisi statements order/payment existing dalam satu batch, tanpa engine baru (A02). |
| [lib/portal/finance.ts](C:/DATA/eskahade/lib/portal/finance.ts) | Fee/error config dan nominal server authoritative pada Portal Ortu (A17). |
| [migrations/0187_finance_controlled_remediation.sql](C:/DATA/eskahade/migrations/0187_finance_controlled_remediation.sql) | Forward local-only durable operation/proof/snapshot dan database guards (A01–A04/A07/A11/A17). |
| [migrations/0188_bri_evidence_guards.sql](C:/DATA/eskahade/migrations/0188_bri_evidence_guards.sql) | Forward local-only expiry dan bank/manual evidence guards, multi-role (A08/A14). |
| [migrations/0189_finance_snapshot_and_reporting.sql](C:/DATA/eskahade/migrations/0189_finance_snapshot_and_reporting.sql) | Forward local-only reporting, immutable terms, integer, exact-contract dan correction/reservation guards (A01/A13/A14/A17). |
| [scripts/finance-remediation-fixture.cjs](C:/DATA/eskahade/scripts/finance-remediation-fixture.cjs) | Fixture DDL finance asli, FK ON, batch/fault/query injection dan module runtime harness (A18). |
| [scripts/seed-uat-fixtures.cjs](C:/DATA/eskahade/scripts/seed-uat-fixtures.cjs) | Fixture local target eksplisit/schema asli, tanpa penghapusan financial history (A18). |
| [scripts/test-bri-audit-reports.cjs](C:/DATA/eskahade/scripts/test-bri-audit-reports.cjs) | Suite BRI existing memakai schema migration asli, evidence/state sah dan kontrak publik; seluruh skenario relevan tetap diuji (A18). |
| [scripts/test-bri-cash-manual-distribution.cjs](C:/DATA/eskahade/scripts/test-bri-cash-manual-distribution.cjs) | Suite BRI existing memakai schema migration asli, evidence/state sah dan kontrak publik; seluruh skenario relevan tetap diuji (A18). |
| [scripts/test-bri-collection.cjs](C:/DATA/eskahade/scripts/test-bri-collection.cjs) | Suite BRI existing memakai schema migration asli, evidence/state sah dan kontrak publik; seluruh skenario relevan tetap diuji (A18). |
| [scripts/test-bri-distribution.cjs](C:/DATA/eskahade/scripts/test-bri-distribution.cjs) | Suite BRI existing memakai schema migration asli, evidence/state sah dan kontrak publik; seluruh skenario relevan tetap diuji (A18). |
| [scripts/test-bri-settlement.cjs](C:/DATA/eskahade/scripts/test-bri-settlement.cjs) | Suite BRI existing memakai schema migration asli, evidence/state sah dan kontrak publik; seluruh skenario relevan tetap diuji (A18). |
| [scripts/test-finance-bri-remediation.cjs](C:/DATA/eskahade/scripts/test-finance-bri-remediation.cjs) | Regresi runtime actual entrypoint/service, schema asli, negative/fault/replay/concurrency terkait A01–A18. |
| [scripts/test-finance-operations-remediation.cjs](C:/DATA/eskahade/scripts/test-finance-operations-remediation.cjs) | Regresi runtime actual entrypoint/service, schema asli, negative/fault/replay/concurrency terkait A01–A18. |
| [scripts/test-finance-patch-b.py](C:/DATA/eskahade/scripts/test-finance-patch-b.py) | Assertion regression historis diselaraskan dengan retirement Duitku/UI existing tanpa menghapus pemeriksaan perilaku (A18). |
| [scripts/test-finance-patch-c1.py](C:/DATA/eskahade/scripts/test-finance-patch-c1.py) | Assertion regression historis diselaraskan dengan retirement Duitku/UI existing tanpa menghapus pemeriksaan perilaku (A18). |
| [scripts/test-finance-remediation.cjs](C:/DATA/eskahade/scripts/test-finance-remediation.cjs) | Regresi runtime actual entrypoint/service, schema asli, negative/fault/replay/concurrency terkait A01–A18. |

87 file terdaftar. Migration 0182–0186 tidak berubah. Dokumen ini juga mencatat dirinya sendiri.
