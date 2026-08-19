-- Migrasi keuangan 0002 - reset terkontrol khusus database sandbox.
--
-- HANYA diterapkan ke DEMO_FINANCE_DB. Jangan pernah dijalankan ke FINANCE_DB
-- produksi: berkas ini melonggarkan larangan DELETE pada jurnal, entri, dompet,
-- dan penarikan supaya tombol "Reset Data Demo" bisa membersihkan sandbox.
--
-- Pelonggarannya tidak permanen. Keempat trigger tetap ada dan tetap menolak
-- DELETE; yang berubah hanya syaratnya: penghapusan lolos apabila flag
-- reset_enabled sedang bernilai 1. Endpoint reset menyalakan flag itu selama
-- satu batch transaksional lalu mematikannya lagi. Di luar jendela itu, sandbox
-- sama tidak bisa dihapusnya dengan produksi.
--
-- Port dari 0004 lama. Dua ALTER TABLE di berkas lama (verified_by dan
-- provider_payload_json) dihapus karena kedua kolom itu sudah menjadi bagian
-- skema inti di 0001e.

CREATE TABLE IF NOT EXISTS finance_sandbox_state (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  reset_enabled INTEGER NOT NULL DEFAULT 0 CHECK (reset_enabled IN (0,1)),
  reset_at TEXT
);

INSERT OR IGNORE INTO finance_sandbox_state(singleton_id, reset_enabled)
VALUES(1, 0);

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
