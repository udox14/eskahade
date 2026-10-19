-- READ ONLY. First query is counts-only. Details query is for the authorized
-- operator in a private console; do not publish its output or person records.
SELECT COUNT(*) AS open_internal_conservation_cases
FROM finance_payments p
WHERE (SELECT COALESCE(SUM(amount),0) FROM finance_allocations WHERE payment_id=p.id)>p.gross_amount;

SELECT p.id AS internal_payment_id,p.status,p.allocation_status,p.gross_amount,
 (SELECT COALESCE(SUM(amount),0) FROM finance_allocations WHERE payment_id=p.id) AS allocation_total,
 (SELECT COALESCE(SUM(di.amount),0) FROM finance_distribution_items di JOIN finance_allocations a ON a.id=di.allocation_id JOIN finance_distributions d ON d.id=di.distribution_id WHERE a.payment_id=p.id AND d.status IN ('DRAFT','PENDING_APPROVAL','PROCESSING','CANCEL_PENDING','DISTRIBUTED')) AS committed_or_reserved,
 (SELECT COALESCE(SUM(di.amount),0) FROM finance_distribution_items di JOIN finance_allocations a ON a.id=di.allocation_id JOIN finance_distributions d ON d.id=di.distribution_id WHERE a.payment_id=p.id AND d.status='DISTRIBUTED') AS already_distributed,
 (SELECT COUNT(*) FROM finance_distribution_items di JOIN finance_allocations a ON a.id=di.allocation_id JOIN finance_distributions d ON d.id=di.distribution_id WHERE a.payment_id=p.id AND d.status IN ('PENDING_APPROVAL','PROCESSING','CANCEL_PENDING')) AS bank_or_cash_inflight_items
FROM finance_payments p
WHERE (SELECT COALESCE(SUM(amount),0) FROM finance_allocations WHERE payment_id=p.id)>p.gross_amount;
