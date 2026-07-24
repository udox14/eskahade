-- Finance migration 0003: penugasan operator loket dan review penutupan kas.

CREATE TABLE IF NOT EXISTS finance_cash_unit_operators (
  cash_unit_id TEXT NOT NULL REFERENCES finance_cash_units(id),
  operator_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (cash_unit_id, operator_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_cash_unit_operator
ON finance_cash_unit_operators(operator_id, is_active, cash_unit_id);

ALTER TABLE finance_cash_shifts ADD COLUMN operator_closing_note TEXT;
ALTER TABLE finance_cash_shifts ADD COLUMN supervisor_reviewed_at TEXT;
