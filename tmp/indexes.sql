CREATE INDEX idx_finance_journal_date ON finance_journals(effective_date, status);
CREATE INDEX idx_finance_journal_source ON finance_journals(source_type, source_id);
CREATE UNIQUE INDEX uq_finance_single_allocation_return ON finance_journals(source_type,source_id) WHERE source_type='ALLOCATION_RETURN';
CREATE UNIQUE INDEX uq_finance_single_payout_journal ON finance_journals(source_type,source_id) WHERE source_type='PAYOUT';
CREATE UNIQUE INDEX uq_finance_single_provider_reversal ON finance_journals(source_type,source_id) WHERE source_type='PROVIDER_REVERSAL';
CREATE INDEX idx_finance_entry_account ON finance_journal_entries(account_id, created_at);
CREATE INDEX idx_finance_entry_santri ON finance_journal_entries(santri_id, created_at);
CREATE INDEX idx_finance_entry_asrama ON finance_journal_entries(asrama_scope, created_at);
CREATE INDEX idx_finance_wallet_movement_student ON finance_wallet_movements(santri_id, created_at);
CREATE UNIQUE INDEX uq_finance_guardian_phone ON finance_guardians(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX uq_finance_guardian_email ON finance_guardians(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX uq_finance_primary_guardian ON finance_guardian_students(santri_id) WHERE access_level='PRIMARY_FINANCE';
CREATE UNIQUE INDEX uq_finance_active_intent_student ON finance_payment_intents(santri_id) WHERE status='PENDING';
CREATE INDEX idx_finance_intent_status ON finance_payment_intents(status, expires_at);
CREATE INDEX idx_student_credentials_student ON student_credentials(santri_id, status);
CREATE UNIQUE INDEX uq_finance_open_shift_operator ON finance_cash_shifts(operator_id) WHERE status='OPEN';
CREATE INDEX idx_finance_withdrawal_student ON finance_withdrawals(santri_id, created_at);
CREATE INDEX idx_finance_withdrawal_shift ON finance_withdrawals(shift_id, created_at);
CREATE INDEX idx_finance_staff_sessions_user ON finance_staff_sessions(user_id,expires_at);
CREATE INDEX idx_finance_auth_attempts_identity ON finance_auth_attempts(identity_hash,created_at);
CREATE INDEX idx_finance_audit_entity ON finance_audit_log(entity_type,entity_id,created_at);
CREATE INDEX idx_finance_student_snapshot_asrama ON finance_student_snapshots(asrama,status_global);
CREATE UNIQUE INDEX uq_student_credentials_card_number
CREATE UNIQUE INDEX uq_student_credentials_current_kind
CREATE INDEX idx_finance_credential_batch_items_status
CREATE INDEX idx_finance_credential_batches_actor
CREATE INDEX idx_finance_cash_unit_operator
CREATE INDEX idx_finance_entry_journal ON finance_journal_entries(journal_id);
CREATE INDEX idx_finance_bills_student ON finance_bills(santri_id,status,due_date);
CREATE INDEX idx_finance_service_tariffs ON finance_service_tariffs(service_kind, effective_month);
CREATE INDEX idx_finance_service_arrears_santri ON finance_service_arrears_historis(santri_id, service_kind, status);
CREATE INDEX idx_finance_service_bill_skip_santri
CREATE INDEX idx_finance_service_bill_skip_period