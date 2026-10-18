-- LOCAL ONLY. Forward hardening, preserving all existing financial rows.
CREATE TRIGGER trg_finance_briva_expiry_guard BEFORE INSERT ON finance_payments
WHEN NEW.channel='BRI' AND NEW.order_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_payment_orders WHERE id=NEW.order_id
  AND julianday(NEW.paid_at) BETWEEN julianday(created_at) AND julianday(expires_at))
  THEN RAISE(ABORT,'BRIVA_GUARD_ABORT: Payment outside order validity') END;
END;
CREATE TRIGGER trg_finance_settlement_evidence_guard BEFORE INSERT ON finance_bri_settlement_items BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_bri_statement_transactions st
  JOIN finance_bri_statement_fetches f ON f.id=st.fetch_id WHERE st.id=NEW.statement_transaction_id
  AND f.status='SUCCESS' AND f.cursor_advanced=1 AND st.match_status!='AMBIGUOUS')
  THEN RAISE(ABORT,'STATEMENT_FETCH_NOT_VERIFIED') END;
 SELECT CASE WHEN NEW.match_strength='AUTHORITATIVE_EXACT' AND NOT EXISTS(
  SELECT 1 FROM finance_briva_reconciliation_metadata rm JOIN finance_bri_statement_transactions st
   ON st.id=NEW.statement_transaction_id WHERE rm.payment_id=NEW.payment_id
   AND st.identity_strength='STRONG' AND st.va_number=rm.virtual_account_no
   AND julianday(st.transaction_date_raw)=julianday(rm.trx_date_time)
   AND st.amount=rm.paid_amount)
  THEN RAISE(ABORT,'AUTHORITATIVE_IDENTITY_REQUIRED') END;
 SELECT CASE WHEN NEW.match_strength='MANUAL_RESOLVED' AND NOT EXISTS(
  SELECT 1 FROM finance_reconciliation_items ri JOIN users u ON u.id=NEW.resolved_by
   WHERE ri.id=NEW.reconciliation_item_id AND ri.external_reference=NEW.statement_transaction_id
   AND u.role IN ('admin','bendahara') AND length(trim(NEW.resolution_notes))>0)
  THEN RAISE(ABORT,'MANUAL_RESOLUTION_EVIDENCE_REQUIRED') END;
END;
