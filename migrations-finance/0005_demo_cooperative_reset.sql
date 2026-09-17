-- DEMO ONLY. Requires 0002_demo_sandbox_reset and 0004_cooperative_item_payments.
DROP TRIGGER finance_coop_item_no_delete;
CREATE TRIGGER finance_coop_item_no_delete BEFORE DELETE ON finance_order_items
WHEN COALESCE((SELECT reset_enabled FROM finance_sandbox_state WHERE singleton_id=1),0)<>1 BEGIN SELECT RAISE(ABORT,'Item immutable.'); END;
DROP TRIGGER finance_coop_distribution_items_no_delete;
CREATE TRIGGER finance_coop_distribution_items_no_delete BEFORE DELETE ON finance_distribution_items
WHEN COALESCE((SELECT reset_enabled FROM finance_sandbox_state WHERE singleton_id=1),0)<>1 BEGIN SELECT RAISE(ABORT,'Distribution immutable.'); END;
DROP TRIGGER finance_coop_cash_no_delete;
CREATE TRIGGER finance_coop_cash_no_delete BEFORE DELETE ON finance_cash_entries
WHEN COALESCE((SELECT reset_enabled FROM finance_sandbox_state WHERE singleton_id=1),0)<>1 BEGIN SELECT RAISE(ABORT,'Cash immutable.'); END;
DROP TRIGGER finance_coop_audit_no_delete;
CREATE TRIGGER finance_coop_audit_no_delete BEFORE DELETE ON finance_audit_log
WHEN COALESCE((SELECT reset_enabled FROM finance_sandbox_state WHERE singleton_id=1),0)<>1 BEGIN SELECT RAISE(ABORT,'Audit immutable.'); END;
