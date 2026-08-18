-- Migrasi keuangan 0001a — BUANG SKEMA LAMA.
--
-- URUTAN WAJIB: seluruh DROP TRIGGER dijalankan lebih dulu, baru DROP TABLE.
-- Insiden 0007 (16 Agu 2026) terjadi karena trigger yang tabel rujukannya sudah
-- hilang tetap tinggal di skema dan meledak belakangan. Jangan tukar urutan ini.
--
-- Berkas ini menghapus data. Hanya boleh dijalankan setelah export Fase 0 ada.

PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS trg_finance_period_reopen_two_approvals;
DROP TRIGGER IF EXISTS trg_finance_journal_period_open;
DROP TRIGGER IF EXISTS trg_finance_entry_draft_only;
DROP TRIGGER IF EXISTS trg_finance_entry_no_update;
DROP TRIGGER IF EXISTS trg_finance_entry_no_delete;
DROP TRIGGER IF EXISTS trg_finance_journal_validate_post;
DROP TRIGGER IF EXISTS trg_finance_journal_apply_balances;
DROP TRIGGER IF EXISTS trg_finance_journal_posted_immutable;
DROP TRIGGER IF EXISTS trg_finance_journal_no_delete;
DROP TRIGGER IF EXISTS trg_finance_wallet_movement_validate;
DROP TRIGGER IF EXISTS trg_finance_journal_apply_wallets;
DROP TRIGGER IF EXISTS trg_finance_wallet_movement_no_update;
DROP TRIGGER IF EXISTS trg_finance_wallet_movement_no_delete;
DROP TRIGGER IF EXISTS trg_finance_topup_journal_requires_paid_intent;
DROP TRIGGER IF EXISTS trg_finance_bill_payment_rules;
DROP TRIGGER IF EXISTS trg_finance_allocation_bill_validate;
DROP TRIGGER IF EXISTS trg_finance_allocation_bill_apply;
DROP TRIGGER IF EXISTS trg_finance_withdrawal_validate;
DROP TRIGGER IF EXISTS trg_finance_withdrawal_apply_wallet;
DROP TRIGGER IF EXISTS trg_finance_withdrawal_no_update;
DROP TRIGGER IF EXISTS trg_finance_withdrawal_no_delete;
DROP TRIGGER IF EXISTS trg_finance_payout_no_self_check;
DROP TRIGGER IF EXISTS trg_finance_payout_recipient_ready;
DROP TRIGGER IF EXISTS trg_finance_payout_insert_recipient_ready;

-- 50 tabel lama

DROP TABLE IF EXISTS finance_account_balances;
DROP TABLE IF EXISTS finance_accounts;
DROP TABLE IF EXISTS finance_allocation_bill_items;
DROP TABLE IF EXISTS finance_allocations;
DROP TABLE IF EXISTS finance_audit_log;
DROP TABLE IF EXISTS finance_auth_attempts;
DROP TABLE IF EXISTS finance_bank_transactions;
DROP TABLE IF EXISTS finance_bills;
DROP TABLE IF EXISTS finance_bills_new;
DROP TABLE IF EXISTS finance_break_glass;
DROP TABLE IF EXISTS finance_cash_unit_operators;
DROP TABLE IF EXISTS finance_cash_units;
DROP TABLE IF EXISTS finance_credential_batch_items;
DROP TABLE IF EXISTS finance_credential_batches;
DROP TABLE IF EXISTS finance_credential_policy;
DROP TABLE IF EXISTS finance_credential_policy_new;
DROP TABLE IF EXISTS finance_gateway_events;
DROP TABLE IF EXISTS finance_guardian_students;
DROP TABLE IF EXISTS finance_guardians;
DROP TABLE IF EXISTS finance_incident_modes;
DROP TABLE IF EXISTS finance_incident_receipts;
DROP TABLE IF EXISTS finance_journal_entries;
DROP TABLE IF EXISTS finance_journals;
DROP TABLE IF EXISTS finance_outbox;
DROP TABLE IF EXISTS finance_payment_intents;
DROP TABLE IF EXISTS finance_payouts;
DROP TABLE IF EXISTS finance_payroll_items;
DROP TABLE IF EXISTS finance_payroll_periods;
DROP TABLE IF EXISTS finance_payroll_policies;
DROP TABLE IF EXISTS finance_period_reopen_approvals;
DROP TABLE IF EXISTS finance_periods;
DROP TABLE IF EXISTS finance_recipients;
DROP TABLE IF EXISTS finance_reconciliation_imports;
DROP TABLE IF EXISTS finance_service_arrears_historis;
DROP TABLE IF EXISTS finance_service_bill_skip;
DROP TABLE IF EXISTS finance_service_tariffs;
DROP TABLE IF EXISTS finance_settings;
DROP TABLE IF EXISTS finance_staff_mfa;
DROP TABLE IF EXISTS finance_staff_sessions;
DROP TABLE IF EXISTS finance_staff_snapshots;
DROP TABLE IF EXISTS finance_student_security;
DROP TABLE IF EXISTS finance_student_snapshots;
DROP TABLE IF EXISTS finance_student_wallets;
DROP TABLE IF EXISTS finance_teacher_compensation;
DROP TABLE IF EXISTS finance_teacher_snapshots;
DROP TABLE IF EXISTS finance_teaching_attendance;
DROP TABLE IF EXISTS finance_wallet_movements;
DROP TABLE IF EXISTS finance_withdrawal_limits;
DROP TABLE IF EXISTS finance_withdrawals;
DROP TABLE IF EXISTS student_credentials;

PRAGMA foreign_keys = ON;
