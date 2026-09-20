-- 1. Void and mark erroneous duplicate payments as fully corrected
UPDATE finance_payments
SET correction_status = 'FULLY_CORRECTED'
WHERE id IN (
  '4cb30f85-74fb-482b-b2f2-3780ba180ae3',
  '44b29563-b81e-4fb2-83d0-3d66cfafa866'
);

-- 2. Resolve the 2 reconciliation items
UPDATE finance_reconciliation_items
SET resolution_action = 'VOID_RECORDED',
    resolution_notes = 'Pembalikan transaksi salah input duplicate SPP legacy',
    resolved_at = datetime('now')
WHERE id IN (
  '043b7451-bed9-41cc-be21-292f848ffbe9',
  'a660483d-9f18-45cb-af3d-1dc4dc642df6'
);

-- 3. Update legacy sync log to VOIDED
UPDATE finance_legacy_sync_log
SET sync_status = 'VOIDED',
    updated_at = datetime('now')
WHERE target_payment_id IN (
  '4cb30f85-74fb-482b-b2f2-3780ba180ae3',
  '44b29563-b81e-4fb2-83d0-3d66cfafa866'
);

-- 4. Delete the 2 duplicate input rows from legacy spp_log
DELETE FROM spp_log
WHERE id IN (
  'b7512989-e154-4bb3-a544-c5bb5b8ac208',
  'c927f8f8-829d-483a-a45a-7eb48f35a32f'
);
