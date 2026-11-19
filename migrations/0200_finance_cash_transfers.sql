-- 0200 — Mutasi Kas Bank ↔ Tunai (pengambilan uang dari rekening Koperasi untuk laci loket,
-- dan penyetoran uang tunai kembali ke rekening).
--
-- Mutasi kas BUKAN pembayaran, pendapatan, alokasi, atau penyaluran: uangnya hanya berpindah
-- tempat simpan. Karena itu dicatat di tabel sendiri dan hanya memengaruhi hitungan sesi kas.
--
-- Invariant (dijaga di sini dan di lib/finance/cash-transfers.ts):
--   * setiap mutasi terikat ke sesi kas OPEN milik operator yang mencatat;
--   * nominal integer Rupiah > 0; foto bukti wajib dan satu foto (hash isi) hanya sekali dipakai;
--   * rekening Koperasi disalin (snapshot); edit master rekening tidak mengubah riwayat;
--   * riwayat append-only: tidak ada DELETE; pembatalan = status VOIDED + alasan, hanya selama sesi OPEN
--     dan selama belum dicocokkan dengan mutasi bank; setoran tidak boleh melebihi uang di laci;
--   * satu baris rekening koran hanya untuk satu mutasi kas, arah & nominal & rekening harus sama,
--     dan baris kredit yang sudah menjadi pembayaran/dana belum teralokasi tidak bisa dipakai (dan sebaliknya).
-- Additive: tidak ada baris finansial yang diubah. Satu file = satu transaksi D1.

CREATE TABLE finance_cash_transfers (
  id TEXT PRIMARY KEY,
  transfer_number TEXT NOT NULL UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('BANK_TO_CASH', 'CASH_TO_BANK')),
  amount INTEGER NOT NULL CHECK (typeof(amount) = 'integer' AND amount > 0),
  cash_session_id TEXT NOT NULL REFERENCES finance_cash_sessions(id),
  operator_id TEXT NOT NULL REFERENCES users(id),
  account_id TEXT NOT NULL REFERENCES finance_transfer_accounts(id),
  account_snapshot TEXT NOT NULL,
  account_number TEXT NOT NULL CHECK (account_number GLOB '[0-9]*' AND length(account_number) BETWEEN 5 AND 25),
  handled_by_name TEXT NOT NULL CHECK (length(trim(handled_by_name)) >= 2),
  bank_transacted_at TEXT NOT NULL,
  bank_reference TEXT,
  proof_object_key TEXT NOT NULL,
  proof_hash TEXT NOT NULL UNIQUE CHECK (length(proof_hash) = 64),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
  void_reason TEXT,
  voided_by TEXT REFERENCES users(id),
  voided_at TEXT,
  statement_transaction_id TEXT REFERENCES finance_bri_statement_transactions(id),
  matched_by TEXT REFERENCES users(id),
  matched_at TEXT,
  match_notes TEXT,
  created_at TEXT NOT NULL,
  CHECK (status != 'VOIDED' OR (voided_by IS NOT NULL AND voided_at IS NOT NULL AND length(trim(COALESCE(void_reason, ''))) >= 5)),
  CHECK (status != 'POSTED' OR (voided_by IS NULL AND voided_at IS NULL AND void_reason IS NULL)),
  CHECK (statement_transaction_id IS NULL OR (matched_by IS NOT NULL AND matched_at IS NOT NULL AND length(trim(COALESCE(match_notes, ''))) >= 10))
);
CREATE INDEX idx_finance_cash_transfers_session ON finance_cash_transfers(cash_session_id, status);
CREATE INDEX idx_finance_cash_transfers_unmatched ON finance_cash_transfers(direction, amount)
  WHERE statement_transaction_id IS NULL AND status = 'POSTED';
CREATE UNIQUE INDEX uq_finance_cash_transfers_statement ON finance_cash_transfers(statement_transaction_id)
  WHERE statement_transaction_id IS NOT NULL;

-- Kas awal bersambung: sesi baru menyimpan sisa fisik sesi sebelumnya milik operator yang sama.
ALTER TABLE finance_cash_sessions ADD COLUMN previous_session_id TEXT REFERENCES finance_cash_sessions(id);
ALTER TABLE finance_cash_sessions ADD COLUMN previous_closing_balance INTEGER;
ALTER TABLE finance_cash_sessions ADD COLUMN opening_notes TEXT;

CREATE TRIGGER trg_finance_cash_session_opening_gap_note BEFORE INSERT ON finance_cash_sessions
WHEN NEW.previous_session_id IS NOT NULL AND NEW.opening_balance != COALESCE(NEW.previous_closing_balance, -1)
  AND length(trim(COALESCE(NEW.opening_notes, ''))) < 5
BEGIN SELECT RAISE(ABORT, 'OPENING_GAP_NOTE_REQUIRED: Kas awal berbeda dari sisa fisik sesi sebelumnya; catatan wajib diisi'); END;

-- ------------------------------------------------------------------
-- Guard mutasi kas
-- ------------------------------------------------------------------
CREATE TRIGGER trg_finance_cash_transfer_insert_guard BEFORE INSERT ON finance_cash_transfers BEGIN
 SELECT CASE WHEN NEW.status != 'POSTED' OR NEW.statement_transaction_id IS NOT NULL
   THEN RAISE(ABORT, 'CASH_TRANSFER_GUARD: new transfer must be POSTED and unmatched') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM finance_cash_sessions WHERE id = NEW.cash_session_id
   AND operator_id = NEW.operator_id AND status = 'OPEN') THEN RAISE(ABORT, 'CASH_SESSION_NOT_OPEN') END;
 SELECT CASE WHEN NEW.direction = 'CASH_TO_BANK' AND NEW.amount >
   (SELECT expected_closing_balance FROM finance_cash_sessions WHERE id = NEW.cash_session_id)
   - COALESCE((SELECT SUM(total_amount) FROM finance_distributions WHERE cash_session_id = NEW.cash_session_id
       AND method = 'CASH' AND status = 'PROCESSING'), 0)
   THEN RAISE(ABORT, 'INSUFFICIENT_CASH') END;
END;

CREATE TRIGGER trg_finance_cash_transfer_immutable BEFORE UPDATE OF id, transfer_number, direction, amount,
 cash_session_id, operator_id, account_id, account_snapshot, account_number, handled_by_name, bank_transacted_at,
 bank_reference, proof_object_key, proof_hash, notes, created_at ON finance_cash_transfers
BEGIN SELECT RAISE(ABORT, 'CASH_TRANSFER_SNAPSHOT_IMMUTABLE'); END;

CREATE TRIGGER trg_finance_cash_transfer_final BEFORE UPDATE ON finance_cash_transfers
WHEN OLD.status = 'VOIDED' BEGIN SELECT RAISE(ABORT, 'CASH_TRANSFER_FINAL'); END;

CREATE TRIGGER trg_finance_cash_transfer_void_guard BEFORE UPDATE OF status ON finance_cash_transfers
WHEN NEW.status IS NOT OLD.status BEGIN
 SELECT CASE WHEN NOT (OLD.status = 'POSTED' AND NEW.status = 'VOIDED')
   THEN RAISE(ABORT, 'CASH_TRANSFER_INVALID_TRANSITION') END;
 SELECT CASE WHEN OLD.statement_transaction_id IS NOT NULL
   THEN RAISE(ABORT, 'CASH_TRANSFER_MATCHED: sudah dicocokkan dengan mutasi bank') END;
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM finance_cash_sessions WHERE id = OLD.cash_session_id AND status = 'OPEN')
   THEN RAISE(ABORT, 'CASH_SESSION_NOT_OPEN') END;
 SELECT CASE WHEN OLD.direction = 'BANK_TO_CASH' AND OLD.amount >
   (SELECT expected_closing_balance FROM finance_cash_sessions WHERE id = OLD.cash_session_id)
   - COALESCE((SELECT SUM(total_amount) FROM finance_distributions WHERE cash_session_id = OLD.cash_session_id
       AND method = 'CASH' AND status = 'PROCESSING'), 0)
   THEN RAISE(ABORT, 'INSUFFICIENT_CASH') END;
END;

CREATE TRIGGER trg_finance_cash_transfer_match_guard BEFORE UPDATE OF statement_transaction_id, matched_by,
 matched_at, match_notes ON finance_cash_transfers BEGIN
 SELECT CASE WHEN OLD.statement_transaction_id IS NOT NULL
   THEN RAISE(ABORT, 'CASH_TRANSFER_MATCH_FINAL') END;
 SELECT CASE WHEN NEW.statement_transaction_id IS NULL OR OLD.status != 'POSTED' OR NEW.status != 'POSTED'
   THEN RAISE(ABORT, 'CASH_TRANSFER_GUARD: only a posted transfer can be matched') END;
 SELECT CASE WHEN NOT EXISTS (
   SELECT 1 FROM finance_bri_statement_transactions st
   JOIN finance_bri_statement_fetches f ON f.id = st.fetch_id AND f.status = 'SUCCESS'
   WHERE st.id = NEW.statement_transaction_id AND st.currency = 'IDR' AND st.amount = OLD.amount
     AND REPLACE(REPLACE(REPLACE(st.account_no, '-', ''), ' ', ''), '.', '') = OLD.account_number
     AND ((OLD.direction = 'BANK_TO_CASH' AND st.type_normalized = 'DEBIT')
       OR (OLD.direction = 'CASH_TO_BANK' AND st.type_normalized = 'CREDIT'
           AND st.matched_payment_id IS NULL AND st.match_status NOT IN ('MATCHED', 'UNALLOCATED_RECORDED'))))
   THEN RAISE(ABORT, 'CASH_TRANSFER_GUARD: statement line must match direction, amount and account') END;
END;

CREATE TRIGGER trg_finance_cash_transfer_no_delete BEFORE DELETE ON finance_cash_transfers
BEGIN SELECT RAISE(ABORT, 'CASH_TRANSFER_NO_DELETE'); END;

-- Kredit rekening yang sudah dijelaskan sebagai setoran tunai bukan uang wali: tidak boleh
-- menjadi pembayaran, settlement, atau dana belum teralokasi.
CREATE TRIGGER trg_finance_statement_cash_transfer_guard BEFORE UPDATE OF matched_payment_id, match_status
 ON finance_bri_statement_transactions
WHEN (NEW.matched_payment_id IS NOT NULL OR NEW.match_status IN ('MATCHED', 'UNALLOCATED_RECORDED'))
 AND EXISTS (SELECT 1 FROM finance_cash_transfers WHERE statement_transaction_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'CASH_TRANSFER_LINKED: baris mutasi ini sudah dicocokkan sebagai mutasi kas'); END;
