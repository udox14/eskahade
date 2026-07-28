-- Finance migration 0004: reset terkontrol untuk database sandbox.
--
-- Nilai default selalu 0. Endpoint reset hanya mengaktifkan flag ini pada
-- binding DEMO_FINANCE_DB selama satu batch transaksional. Dengan demikian
-- aturan immutable tetap berlaku pada FINANCE_DB produksi.

CREATE TABLE IF NOT EXISTS finance_sandbox_state (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  reset_enabled INTEGER NOT NULL DEFAULT 0 CHECK (reset_enabled IN (0,1)),
  reset_at TEXT
);

INSERT OR IGNORE INTO finance_sandbox_state(singleton_id, reset_enabled)
VALUES(1, 0);

-- Kolom ini sudah dipakai service payout dan wajib tersedia sebelum sandbox
-- menguji verifikasi rekening maupun callback disbursement.
ALTER TABLE finance_recipients ADD COLUMN verified_by TEXT;
ALTER TABLE finance_payouts ADD COLUMN provider_payload_json TEXT;

DROP TRIGGER IF EXISTS trg_finance_entry_no_delete;
CREATE TRIGGER trg_finance_entry_no_delete
BEFORE DELETE ON finance_journal_entries
WHEN COALESCE((SELECT reset_enabled FROM finance_sandbox_state WHERE singleton_id=1),0) <> 1
BEGIN SELECT RAISE(ABORT, 'FINANCE_ENTRY_IMMUTABLE'); END;

DROP TRIGGER IF EXISTS trg_finance_journal_no_delete;
CREATE TRIGGER trg_finance_journal_no_delete
BEFORE DELETE ON finance_journals
WHEN COALESCE((SELECT reset_enabled FROM finance_sandbox_state WHERE singleton_id=1),0) <> 1
BEGIN SELECT RAISE(ABORT, 'FINANCE_JOURNAL_IMMUTABLE'); END;

DROP TRIGGER IF EXISTS trg_finance_wallet_movement_no_delete;
CREATE TRIGGER trg_finance_wallet_movement_no_delete
BEFORE DELETE ON finance_wallet_movements
WHEN COALESCE((SELECT reset_enabled FROM finance_sandbox_state WHERE singleton_id=1),0) <> 1
BEGIN SELECT RAISE(ABORT, 'FINANCE_WALLET_MOVEMENT_IMMUTABLE'); END;

DROP TRIGGER IF EXISTS trg_finance_withdrawal_no_delete;
CREATE TRIGGER trg_finance_withdrawal_no_delete
BEFORE DELETE ON finance_withdrawals
WHEN COALESCE((SELECT reset_enabled FROM finance_sandbox_state WHERE singleton_id=1),0) <> 1
BEGIN SELECT RAISE(ABORT, 'FINANCE_WITHDRAWAL_IMMUTABLE'); END;
