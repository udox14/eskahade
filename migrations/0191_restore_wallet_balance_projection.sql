-- Restore the derived wallet balance projection when an older schema bootstrap
-- skipped the legacy column. The ledger remains the sole source of truth.
-- Never import saldo_tabungan or historical tabungan_log balances here.
ALTER TABLE santri
  ADD COLUMN saldo_uang_jajan INTEGER NOT NULL DEFAULT 0
  CHECK (saldo_uang_jajan >= 0);

UPDATE santri
SET saldo_uang_jajan = COALESCE((
  SELECT SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END)
  FROM finance_wallet_ledger
  WHERE santri_id = santri.id
), 0);
