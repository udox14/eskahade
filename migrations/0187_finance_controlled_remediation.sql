-- Forward-only LOCAL remediation. Apply only after reviewed backup/preflight.
-- Historical 0182-0186 are NOT re-applied or rewritten. Existing money rows are preserved.
ALTER TABLE finance_idempotency_keys ADD COLUMN request_hash TEXT;
ALTER TABLE finance_idempotency_keys ADD COLUMN actor_id TEXT REFERENCES users(id);
ALTER TABLE finance_idempotency_keys ADD COLUMN santri_id TEXT REFERENCES santri(id);
ALTER TABLE finance_idempotency_keys ADD COLUMN amount INTEGER;
ALTER TABLE finance_idempotency_keys ADD COLUMN cash_session_id TEXT REFERENCES finance_cash_sessions(id);
ALTER TABLE finance_idempotency_keys ADD COLUMN pin_token_hash TEXT;
ALTER TABLE finance_idempotency_keys ADD COLUMN expected_wallet_balance INTEGER;
ALTER TABLE finance_payment_orders ADD COLUMN cooperative_fee_rule_id TEXT;
ALTER TABLE finance_payment_orders ADD COLUMN cooperative_fee_snapshot TEXT;
CREATE TABLE finance_pin_authorizations (
 token_hash TEXT PRIMARY KEY, santri_id TEXT NOT NULL REFERENCES santri(id),
 operator_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL,
 consumed_by TEXT UNIQUE, created_at TEXT NOT NULL
);
CREATE TABLE finance_proofs (
 object_key TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
 content_hash TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL CHECK(size_bytes>0),
 created_at TEXT NOT NULL
);
CREATE TRIGGER trg_finance_operation_session_guard BEFORE INSERT ON finance_idempotency_keys
WHEN NEW.scope IN ('LOKET_WITHDRAWAL','LOKET_DEPOSIT') BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM finance_cash_sessions WHERE id=NEW.cash_session_id
   AND operator_id=NEW.actor_id AND status='OPEN') THEN RAISE(ABORT,'CASH_SESSION_NOT_OPEN') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM santri WHERE id=NEW.santri_id AND status_global='aktif'
   AND UPPER(TRIM(COALESCE(asrama,'')))!='AL-BAGHORY') THEN RAISE(ABORT,'STUDENT_NOT_BILLABLE') END;
 SELECT CASE WHEN typeof(NEW.amount)!='integer' OR NEW.amount<=0 THEN RAISE(ABORT,'INVALID_RUPIAH') END;
 SELECT CASE WHEN NEW.expected_wallet_balance IS NOT NULL AND NEW.expected_wallet_balance !=
  (SELECT COALESCE(SUM(CASE direction WHEN 'IN' THEN amount ELSE -amount END),0) FROM finance_wallet_ledger WHERE santri_id=NEW.santri_id)
  THEN RAISE(ABORT,'STALE_WALLET_RECEIPT') END;
END;
CREATE TRIGGER trg_finance_operation_pin_guard BEFORE INSERT ON finance_idempotency_keys
WHEN NEW.scope='LOKET_WITHDRAWAL' BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM finance_pin_authorizations WHERE token_hash=NEW.pin_token_hash
   AND santri_id=NEW.santri_id AND operator_id=NEW.actor_id AND expires_at>NEW.created_at AND consumed_by IS NULL)
   THEN RAISE(ABORT,'PIN_AUTHORIZATION_INVALID') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM finance_credentials WHERE santri_id=NEW.santri_id AND status='ACTIVE')
   THEN RAISE(ABORT,'ACTIVE_CARD_REQUIRED') END;
 SELECT CASE WHEN NEW.amount > (SELECT expected_closing_balance FROM finance_cash_sessions WHERE id=NEW.cash_session_id)
   - COALESCE((SELECT SUM(total_amount) FROM finance_distributions WHERE cash_session_id=NEW.cash_session_id AND method='CASH' AND status='PROCESSING'),0)
   THEN RAISE(ABORT,'INSUFFICIENT_CASH') END;
END;
CREATE TRIGGER trg_finance_operation_consume_pin AFTER INSERT ON finance_idempotency_keys
WHEN NEW.scope='LOKET_WITHDRAWAL' BEGIN
 UPDATE finance_pin_authorizations SET consumed_by=NEW.key WHERE token_hash=NEW.pin_token_hash;
END;
CREATE TRIGGER trg_finance_wallet_withdrawal_limit BEFORE INSERT ON finance_wallet_ledger
WHEN NEW.movement_type='WITHDRAWAL_LOKET' BEGIN
 SELECT CASE WHEN NEW.amount + COALESCE((SELECT SUM(amount) FROM finance_wallet_ledger WHERE santri_id=NEW.santri_id
  AND movement_type='WITHDRAWAL_LOKET' AND direction='OUT' AND date(created_at,'+7 hours')=date(NEW.created_at,'+7 hours')),0)
  > MIN(COALESCE((SELECT CAST(value AS INTEGER) FROM app_settings WHERE key='uang_jajan_global_daily_limit'),100000),
     COALESCE((SELECT parent_daily_limit FROM finance_wallet_limits WHERE santri_id=NEW.santri_id),9223372036854775807))
  THEN RAISE(ABORT,'DAILY_LIMIT_EXCEEDED') END;
 SELECT CASE WHEN NEW.amount + COALESCE((SELECT SUM(amount) FROM finance_wallet_ledger WHERE santri_id=NEW.santri_id
  AND movement_type='WITHDRAWAL_LOKET' AND direction='OUT' AND strftime('%Y-%W',created_at,'+7 hours')=strftime('%Y-%W',NEW.created_at,'+7 hours')),0)
  > COALESCE((SELECT parent_weekly_limit FROM finance_wallet_limits WHERE santri_id=NEW.santri_id),9223372036854775807)
  THEN RAISE(ABORT,'WEEKLY_LIMIT_EXCEEDED') END;
 SELECT CASE WHEN NEW.amount + COALESCE((SELECT SUM(amount) FROM finance_wallet_ledger WHERE santri_id=NEW.santri_id
  AND movement_type='WITHDRAWAL_LOKET' AND direction='OUT' AND strftime('%Y-%m',created_at,'+7 hours')=strftime('%Y-%m',NEW.created_at,'+7 hours')),0)
  > COALESCE((SELECT parent_monthly_limit FROM finance_wallet_limits WHERE santri_id=NEW.santri_id),9223372036854775807)
  THEN RAISE(ABORT,'MONTHLY_LIMIT_EXCEEDED') END;
END;
CREATE TRIGGER trg_finance_distribution_insert_draft BEFORE INSERT ON finance_distributions
WHEN NEW.status!='DRAFT' BEGIN SELECT RAISE(ABORT,'DISTRIBUTION_MUST_START_DRAFT'); END;
CREATE TRIGGER trg_finance_va_permanent BEFORE UPDATE OF va_number,customer_no,santri_id ON finance_student_va
WHEN NEW.va_number!=OLD.va_number OR NEW.customer_no!=OLD.customer_no OR NEW.santri_id!=OLD.santri_id
BEGIN SELECT RAISE(ABORT,'FIXED_VA_OWNERSHIP_IMMUTABLE'); END;
CREATE TRIGGER trg_finance_va_preserve_history BEFORE DELETE ON finance_student_va
BEGIN SELECT RAISE(ABORT,'FIXED_VA_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER trg_finance_inquiry_immutable BEFORE UPDATE ON finance_briva_inquiries
BEGIN SELECT RAISE(ABORT,'INQUIRY_SNAPSHOT_IMMUTABLE'); END;
CREATE TRIGGER trg_finance_inquiry_preserve BEFORE DELETE ON finance_briva_inquiries
BEGIN SELECT RAISE(ABORT,'INQUIRY_SNAPSHOT_IMMUTABLE'); END;

-- Compatibility projection for existing account UI. Canonical master is recipient_accounts.
-- Preserve the original provider_accounts history; do not maintain a second active master.
CREATE VIEW finance_provider_accounts_current AS
 SELECT a.id,COALESCE(r.provider_id,'BENDAHARA') provider_id,a.bank_code bank_name,a.account_number,a.account_holder,
 a.is_primary,a.notes,a.created_at,a.updated_at FROM finance_recipient_accounts a
 JOIN finance_distribution_recipients r ON r.id=a.recipient_id WHERE a.is_active=1;
CREATE TRIGGER trg_finance_accounts_ui_insert INSTEAD OF INSERT ON finance_provider_accounts_current BEGIN
 INSERT OR IGNORE INTO finance_distribution_recipients(id,recipient_type,name,provider_id)
 SELECT 'rec_'||id,CASE jenis WHEN 'Makan' THEN 'KATERING' ELSE 'LAUNDRY' END,nama_jasa,id
 FROM master_jasa WHERE id=NEW.provider_id AND jenis IN ('Makan','Cuci');
 INSERT OR IGNORE INTO finance_recipient_allowed_methods(recipient_id,method)
 SELECT 'rec_'||id,'CASH' FROM master_jasa WHERE id=NEW.provider_id;
 INSERT OR IGNORE INTO finance_recipient_allowed_methods(recipient_id,method)
 SELECT 'rec_'||id,'MANUAL_TRANSFER' FROM master_jasa WHERE id=NEW.provider_id;
 INSERT INTO finance_recipient_accounts(id,recipient_id,bank_code,account_number,account_holder,is_primary,notes,created_at,updated_at)
 VALUES(NEW.id,CASE NEW.provider_id WHEN 'BENDAHARA' THEN 'rec_pesantren' ELSE 'rec_'||NEW.provider_id END,
 NEW.bank_name,NEW.account_number,NEW.account_holder,NEW.is_primary,NEW.notes,NEW.created_at,NEW.updated_at);
END;
CREATE TRIGGER trg_finance_accounts_ui_update INSTEAD OF UPDATE ON finance_provider_accounts_current BEGIN
 UPDATE finance_recipient_accounts SET bank_code=NEW.bank_name,account_number=NEW.account_number,account_holder=NEW.account_holder,
 is_primary=NEW.is_primary,notes=NEW.notes,updated_at=NEW.updated_at WHERE id=OLD.id;
END;
CREATE TRIGGER trg_finance_accounts_ui_delete INSTEAD OF DELETE ON finance_provider_accounts_current BEGIN
 UPDATE finance_recipient_accounts SET is_active=0,is_primary=0,updated_at=CURRENT_TIMESTAMP WHERE id=OLD.id;
END;
