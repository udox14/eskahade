-- Migration: 0153_finance_tariffs_overlap_trigger.sql
-- Fase 2B: Trigger Pencegahan Overlapping Tariff Version di Level Database

CREATE TRIGGER IF NOT EXISTS trg_finance_tariffs_no_overlap_insert
BEFORE INSERT ON finance_tariffs
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM finance_tariffs
  WHERE item_type = NEW.item_type
    AND (
      (academic_year_id = NEW.academic_year_id) OR
      (academic_year_id IS NULL AND NEW.academic_year_id IS NULL)
    )
    AND effective_from <= COALESCE(NEW.effective_until, '9999-12-31')
    AND COALESCE(effective_until, '9999-12-31') >= NEW.effective_from
)
BEGIN
  SELECT RAISE(ABORT, 'Tarif versi baru tumpang tindih (overlapping) dengan tarif yang sudah ada.');
END;

CREATE TRIGGER IF NOT EXISTS trg_finance_tariffs_no_overlap_update
BEFORE UPDATE OF effective_from, effective_until, item_type, academic_year_id ON finance_tariffs
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM finance_tariffs
  WHERE id <> NEW.id
    AND item_type = NEW.item_type
    AND (
      (academic_year_id = NEW.academic_year_id) OR
      (academic_year_id IS NULL AND NEW.academic_year_id IS NULL)
    )
    AND effective_from <= COALESCE(NEW.effective_until, '9999-12-31')
    AND COALESCE(effective_until, '9999-12-31') >= NEW.effective_from
)
BEGIN
  SELECT RAISE(ABORT, 'Tarif versi baru tumpang tindih (overlapping) dengan tarif yang sudah ada.');
END;
