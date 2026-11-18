# Migration 0198 — Transfer Manual & Pencairan Kolektif

File: `migrations/0198_manual_transfer_and_collective_payout.sql` (one file = one D1 transaction).

The code in this release **requires** 0198. Apply it before (or together with) deploying the app.

## What it does

- Rebuilds `finance_payment_orders`, `finance_payments`, `finance_cooperative_admin_fee_rules`,
  `finance_wallet_ledger` only to widen CHECK constraints (new channel `TRANSFER`, method
  `MANUAL_TRANSFER`, new wallet movements). Every row is copied; row counts are verified inside
  the file and the whole file aborts on mismatch.
- D1 always enforces foreign keys, so the rebuild copies rows aside, swaps the empty table in,
  then re-inserts (re-inserting parents satisfies the deferred child checks).
- Drops and recreates every trigger that references those tables (SQLite refuses to rename while
  another table's trigger points at a missing table), including the 0196 billing review triggers.
- Adds: `finance_transfer_accounts`, `finance_transfer_submissions`, `finance_transfer_proofs`,
  `finance_transfer_submission_events`, `finance_transfer_verifier_scopes`,
  `finance_wallet_payout_batches`, `finance_wallet_payout_items`, guard triggers, settings,
  a disabled TRANSFER fee rule, two menu rows, and hides the Kredensial menu.

## 1. Preflight (read-only) — run first on the target database

```sql
SELECT name, tbl_name FROM sqlite_master
WHERE type = 'trigger' AND (
  sql LIKE '%finance_payment_orders%' OR sql LIKE '%finance_payments%' OR
  sql LIKE '%finance_wallet_ledger%' OR sql LIKE '%finance_cooperative_admin_fee_rules%')
ORDER BY name;
```

Expected names (all are recreated by 0198):

```
trg_finance_billing_allocation_review     trg_finance_order_terms_immutable
trg_finance_billing_order_review          trg_finance_orders_prevent_paid_if_not_pending
trg_finance_bri_settlement_items_guard    trg_finance_payments_briva_guard
trg_finance_briva_expiry_guard            trg_finance_payments_prevent_invalid_settled
trg_finance_operation_session_guard       trg_finance_wallet_integer_guard
trg_finance_order_money_guard             trg_finance_wallet_verify_balance
trg_finance_order_snapshot_immutable      trg_finance_wallet_withdrawal_limit
```

Sandbox additionally lists three sandbox-recovery/0194 triggers
(`trg_sandbox_recovery_wallet_arithmetic`, `trg_sandbox_recovery_quarantine_dist_insert`,
`trg_sandbox_recovery_quarantine_dist_update`). 0198 drops them (no-op on production); restore
them on sandbox afterwards:

```bash
npx wrangler d1 execute eskahade-demo-db --env sandbox --remote --file=scripts/sandbox/0198_restore_recovery_triggers.sql
```

Audited 2026-11-18: production has exactly the 14 expected triggers; sandbox has those 14 + the 3 above. **If any other name appears, stop** and
add it to the migration before applying — otherwise the rename step fails (the transaction rolls
back, nothing is changed).

Also record counts to compare afterwards:

```sql
SELECT (SELECT COUNT(*) FROM finance_payment_orders) orders, (SELECT COUNT(*) FROM finance_payments) payments,
       (SELECT COUNT(*) FROM finance_wallet_ledger) wallet, (SELECT COUNT(*) FROM finance_cooperative_admin_fee_rules) fee_rules;
```

## 2. Apply

The CI release gate (`scripts/ci/release-migrations.cjs`) lists 0198 as reviewed, so a push to
`main` applies it automatically through `wrangler d1 migrations apply` (and records it in
`d1_migrations`). Choose **one** path:

- **Let CI apply it** (recommended): merge to `main`; do not run the file manually.
- **Apply manually with wrangler** first (never the Cloudflare dashboard console: it splits input on
  `;`, breaking `CREATE TRIGGER ... BEGIN ... END` bodies, and can leave earlier statements such as
  `DROP TRIGGER` already executed). Sandbox first, then production:
  ```bash
  npx wrangler d1 execute eskahade-demo-db --env sandbox --remote --file=migrations/0198_manual_transfer_and_collective_payout.sql
  npx wrangler d1 execute eskahade-db --remote --file=migrations/0198_manual_transfer_and_collective_payout.sql
  ```
  `--remote` is required (without it wrangler writes to a local copy). Then record it so the CI
  release gate skips it on the next push to `main`:
  ```bash
  npx wrangler d1 execute eskahade-db --remote --command="INSERT INTO d1_migrations(name) VALUES('0198_manual_transfer_and_collective_payout.sql')"
  ```
  (same for `eskahade-demo-db --env sandbox`). Without that row CI would run the file again and fail
  on `CREATE TABLE finance_transfer_accounts` (the failed run changes nothing).

## 3. After applying

- Re-run the count query: orders/payments/wallet equal, fee_rules = previous + 1.
- `SELECT value FROM app_settings WHERE key = 'payment_channel_mode'` → `TRANSFER` (default).
- In the app: Pengaturan Keuangan → Jalur Pembayaran → add at least one destination account, set
  the transfer admin fee, assign verifiers per asrama, choose the mode.

## Rollback

There is no automatic down migration. Financial rows are unchanged by 0198, so a rollback is a new
migration that rebuilds the four tables back to the old CHECKs **only if** no `TRANSFER` /
`MANUAL_TRANSFER` / new wallet movement rows exist yet. Prefer switching the mode to `BRIVA` in
settings instead of rolling back.
