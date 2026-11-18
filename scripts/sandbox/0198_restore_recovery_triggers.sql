-- SANDBOX ONLY (eskahade-demo-db). Run once after migration 0198 has been applied to sandbox.
-- 0198 drops these sandbox-recovery/0194 triggers because they reference the rebuilt finance
-- tables (SQLite cannot rename a table while another trigger references it). This restores them
-- byte-for-byte. Never run on production: production never had them.
CREATE TRIGGER IF NOT EXISTS trg_sandbox_recovery_wallet_arithmetic BEFORE INSERT ON finance_wallet_ledger BEGIN
 SELECT CASE WHEN NEW.balance_before+(CASE NEW.direction WHEN 'IN' THEN NEW.amount ELSE -NEW.amount END)<0 THEN RAISE(ABORT,'OVERDRAW_DETECTED') END;
 SELECT CASE WHEN NEW.balance_after!=NEW.balance_before+(CASE NEW.direction WHEN 'IN' THEN NEW.amount ELSE -NEW.amount END) THEN RAISE(ABORT,'INVALID_BALANCE_AFTER') END; END;

CREATE TRIGGER IF NOT EXISTS trg_sandbox_recovery_quarantine_dist_insert BEFORE INSERT ON finance_distribution_items
 WHEN EXISTS(SELECT 1 FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id WHERE a.id=NEW.allocation_id AND (SELECT COALESCE(SUM(amount),0) FROM finance_allocations x WHERE x.payment_id=p.id)>p.gross_amount)
 BEGIN SELECT RAISE(ABORT,'INTERNAL_CONSERVATION_CASE_OPEN: allocation exceeds recorded payment'); END;

CREATE TRIGGER IF NOT EXISTS trg_sandbox_recovery_quarantine_dist_update BEFORE UPDATE OF distribution_id,allocation_id,amount ON finance_distribution_items
 WHEN EXISTS(SELECT 1 FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id WHERE a.id=NEW.allocation_id AND (SELECT COALESCE(SUM(amount),0) FROM finance_allocations x WHERE x.payment_id=p.id)>p.gross_amount)
 BEGIN SELECT RAISE(ABORT,'INTERNAL_CONSERVATION_CASE_OPEN: allocation exceeds recorded payment'); END;
