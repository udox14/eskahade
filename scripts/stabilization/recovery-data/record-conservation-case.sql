-- REVIEWED METADATA-ONLY CASE OPENING. SANDBOX ONLY, separate operator approval.
-- No change to payments, allocations, balances, reservations, transfer state or settlement.
-- external_amount=0 means NO external bank evidence; follows existing internal
-- recovery-case semantics in lib/finance/corrections.ts, not a bank amount.
INSERT OR IGNORE INTO finance_reconciliation_items
 (id,payment_id,internal_amount,external_amount,discrepancy_amount,match_status,
  resolution_action,resolution_notes,reason_code)
SELECT 'sandbox-conservation-'||p.id,p.id,p.gross_amount,0,
 (SELECT SUM(amount) FROM finance_allocations WHERE payment_id=p.id)-p.gross_amount,
 'AMOUNT_MISMATCH','NONE',
 'Internal conservation discrepancy. Both gross and allocation totals are internal records. Bank amount is UNVERIFIED; external_amount=0 is an unavailable-evidence placeholder. Preserve history, paid/settled distinction and pending bank reservations. Requires operator evidence and approved correction/recovery; never increase gross or delete allocation to balance.',
 'INTERNAL_OVERALLOCATION_BANK_UNVERIFIED'
FROM finance_payments p
WHERE (SELECT COALESCE(SUM(amount),0) FROM finance_allocations WHERE payment_id=p.id)>p.gross_amount;
