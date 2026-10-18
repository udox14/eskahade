-- LOCAL ONLY: preserve historical tables and rows; additive reporting projection.
CREATE VIEW finance_settlement_report AS
 SELECT id,settlement_number,provider,settlement_date,destination_bank,destination_account,
 total_payments_count,total_gross_amount,total_fee_amount,total_net_amount,status,notes,verified_by,created_at
 FROM finance_settlements
 UNION ALL
 SELECT id,settlement_number,'BRI',settlement_date,'BRI',account_no,total_payments_count,
 total_gross_amount+total_cooperative_admin_fee,0,total_net_amount+total_cooperative_admin_fee,
 status,notes,verified_by,created_at FROM finance_bri_settlements;

-- Existing records are not transformed. Only new / changed monetary values are guarded.
CREATE TRIGGER trg_finance_order_money_guard BEFORE INSERT ON finance_payment_orders BEGIN
 SELECT CASE WHEN typeof(NEW.gross_amount)!='integer' OR NEW.gross_amount<0 OR NEW.gross_amount>9007199254740991
  OR typeof(NEW.cooperative_admin_fee)!='integer' OR NEW.cooperative_admin_fee<0
  OR typeof(NEW.total_charged)!='integer' OR NEW.total_charged>9007199254740991
  THEN RAISE(ABORT,'INVALID_RUPIAH') END;
END;
CREATE TRIGGER trg_finance_order_snapshot_immutable BEFORE UPDATE OF santri_id,gross_amount,cooperative_admin_fee,
 total_charged,fixed_va_number,cooperative_fee_rule_id,cooperative_fee_snapshot ON finance_payment_orders
WHEN NEW.santri_id IS NOT OLD.santri_id OR NEW.gross_amount IS NOT OLD.gross_amount
 OR NEW.cooperative_admin_fee IS NOT OLD.cooperative_admin_fee OR NEW.total_charged IS NOT OLD.total_charged
 OR NEW.fixed_va_number IS NOT OLD.fixed_va_number OR NEW.cooperative_fee_rule_id IS NOT OLD.cooperative_fee_rule_id
 OR NEW.cooperative_fee_snapshot IS NOT OLD.cooperative_fee_snapshot
BEGIN SELECT RAISE(ABORT,'ORDER_SNAPSHOT_IMMUTABLE'); END;
CREATE TRIGGER trg_finance_order_terms_immutable BEFORE UPDATE OF expires_at,payment_method,fee_payer,created_at
ON finance_payment_orders
WHEN NEW.expires_at IS NOT OLD.expires_at OR NEW.payment_method IS NOT OLD.payment_method
 OR NEW.fee_payer IS NOT OLD.fee_payer OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT,'ORDER_SNAPSHOT_IMMUTABLE'); END;
CREATE TRIGGER trg_finance_order_item_immutable BEFORE UPDATE ON finance_order_items
BEGIN SELECT RAISE(ABORT,'ORDER_ITEM_IMMUTABLE'); END;
CREATE TRIGGER trg_finance_order_item_preserve BEFORE DELETE ON finance_order_items
BEGIN SELECT RAISE(ABORT,'ORDER_ITEM_IMMUTABLE'); END;
CREATE TRIGGER trg_finance_wallet_integer_guard BEFORE INSERT ON finance_wallet_ledger BEGIN
 SELECT CASE WHEN typeof(NEW.amount)!='integer' OR NEW.amount<=0 OR NEW.amount>9007199254740991
  OR typeof(NEW.balance_before)!='integer' OR typeof(NEW.balance_after)!='integer'
  OR NEW.balance_after>9007199254740991 THEN RAISE(ABORT,'INVALID_RUPIAH') END;
END;
-- No verified cross-product statement identity mapping is available in this release.
-- Preserve existing evidence; new settlements require authorized manual review.
CREATE TRIGGER trg_finance_bri_authoritative_contract_gate BEFORE INSERT ON finance_bri_settlement_items
WHEN NEW.match_strength='AUTHORITATIVE_EXACT'
BEGIN SELECT RAISE(ABORT,'AUTHORITATIVE_IDENTITY_REQUIRED: Bank contract mapping is not verified'); END;
CREATE TRIGGER trg_finance_exemption_duplicate BEFORE INSERT ON finance_exemptions
WHEN NEW.status='ACTIVE' AND EXISTS(SELECT 1 FROM finance_exemptions e WHERE e.status='ACTIVE'
 AND e.santri_id=NEW.santri_id AND e.item_type=NEW.item_type AND e.academic_year_id IS NEW.academic_year_id
 AND e.period_start IS NEW.period_start AND e.period_end IS NEW.period_end AND e.reason=NEW.reason AND e.notes IS NEW.notes)
BEGIN SELECT RAISE(ABORT,'DUPLICATE_ACTIVE_EXEMPTION'); END;

CREATE TRIGGER trg_finance_correction_cash_guard BEFORE INSERT ON finance_corrections
WHEN NEW.method='CASH' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_cash_sessions WHERE id=NEW.cash_session_id
  AND status='OPEN' AND operator_id=NEW.created_by AND expected_closing_balance>=NEW.total_amount+
   COALESCE((SELECT SUM(total_amount) FROM finance_distributions WHERE cash_session_id=NEW.cash_session_id
    AND method='CASH' AND status='PROCESSING'),0)) THEN RAISE(ABORT,'CORRECTION_CASH_SESSION_UNAVAILABLE') END;
END;
CREATE TRIGGER trg_finance_correction_live_intent_guard BEFORE INSERT ON finance_correction_items
WHEN NEW.target_allocation_id IS NOT NULL BEGIN
 SELECT CASE WHEN NEW.amount+COALESCE((SELECT SUM(amount) FROM finance_correction_items WHERE target_allocation_id=NEW.target_allocation_id),0)
  +COALESCE((SELECT SUM(di.amount) FROM finance_distribution_items di JOIN finance_distributions d ON d.id=di.distribution_id
   WHERE di.allocation_id=NEW.target_allocation_id AND (d.status IN ('PENDING_APPROVAL','PROCESSING','CANCEL_PENDING')
    OR (d.status='DRAFT' AND EXISTS(SELECT 1 FROM finance_qlola_transfer_intents ti WHERE ti.distribution_id=d.id
     AND ti.intent_status IN ('SUBMISSION_PENDING','UNKNOWN','CANCEL_PENDING'))))),0)
  >(SELECT amount FROM finance_allocations WHERE id=NEW.target_allocation_id)
  THEN RAISE(ABORT,'CORRECTION_LIVE_RESERVATION') END;
END;
