-- Preventif medicine issuance uses the same idempotent stock reference guard.
DROP INDEX IF EXISTS idx_pos_stock_reference_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_stock_reference_unique
  ON poskestren_stock_movement(reference_type, reference_id, medicine_id, movement_type)
  WHERE reference_type IN (
    'PRESCRIPTION_ITEM',
    'PREVENTIVE_MEDICINE',
    'DORM_MEDICINE',
    'OBSERVATION_MEDICINE',
    'VISIT_REVISION',
    'PURCHASE_ITEM',
    'MANUAL_ADJUSTMENT',
    'SAMPLE_CLEANUP'
  )
  AND reference_id IS NOT NULL;
