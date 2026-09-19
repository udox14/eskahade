-- Migration: 0160_finance_cards_and_wallet.sql
-- Fase 5: Uang Jajan sebagai Dana Titipan & Kredensial Kartu QR Santri
-- Mengimplementasikan tabel kredensial kartu multi-histori, PIN santri PBKDF2 dengan lockout & audit,
-- limit bertingkat, serta buku besar mutasi uang jajan (authoritative ledger).

-- 1. Tabel Kredensial Kartu Fisik Multi-Histori (PRD #17 & Implementation Plan Tabel #16)
CREATE TABLE IF NOT EXISTS finance_credentials (
    id TEXT PRIMARY KEY,
    santri_id TEXT NOT NULL REFERENCES santri(id),
    card_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'LOST', 'BLOCKED')),
    issued_at TEXT NOT NULL,
    issued_by TEXT REFERENCES users(id),
    revoked_at TEXT,
    revoked_by TEXT REFERENCES users(id),
    revocation_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Aturan Invariant: Tepat satu kartu berstatus ACTIVE per santri pada satu waktu
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_card_per_santri 
    ON finance_credentials(santri_id) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_finance_credentials_token 
    ON finance_credentials(card_token);

CREATE INDEX IF NOT EXISTS idx_finance_credentials_santri 
    ON finance_credentials(santri_id, status);

-- 2. Tabel PIN Akun Santri Terpisah (PRD #18 & Implementation Plan Tabel #17)
CREATE TABLE IF NOT EXISTS finance_student_pins (
    santri_id TEXT PRIMARY KEY REFERENCES santri(id),
    pin_hash TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by TEXT REFERENCES users(id)
);

-- 3. Tabel Audit Trail Perubahan & Reset PIN Santri (PRD #18)
CREATE TABLE IF NOT EXISTS finance_pin_audit_logs (
    id TEXT PRIMARY KEY,
    santri_id TEXT NOT NULL REFERENCES santri(id),
    action TEXT NOT NULL CHECK (action IN ('SET', 'RESET', 'LOCK', 'UNLOCK', 'FAILED_ATTEMPT')),
    performed_by TEXT REFERENCES users(id),
    reason TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_pin_audit_santri 
    ON finance_pin_audit_logs(santri_id, created_at);

-- 4. Tabel Limit Uang Jajan Orang Tua per Santri (PRD #16 & Implementation Plan Tabel #18)
CREATE TABLE IF NOT EXISTS finance_wallet_limits (
    santri_id TEXT PRIMARY KEY REFERENCES santri(id),
    parent_daily_limit INTEGER CHECK (parent_daily_limit IS NULL OR parent_daily_limit >= 0),
    parent_weekly_limit INTEGER CHECK (parent_weekly_limit IS NULL OR parent_weekly_limit >= 0),
    parent_monthly_limit INTEGER CHECK (parent_monthly_limit IS NULL OR parent_monthly_limit >= 0),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by TEXT REFERENCES users(id)
);

-- 5. Tabel Buku Besar Mutasi Uang Jajan (Authoritative Ledger) (PRD #15 & Implementation Plan Tabel #19)
CREATE TABLE IF NOT EXISTS finance_wallet_ledger (
    id TEXT PRIMARY KEY,
    santri_id TEXT NOT NULL REFERENCES santri(id),
    direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('TOPUP_ONLINE', 'TOPUP_CASH', 'WITHDRAWAL_LOKET', 'REVERSAL')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    reference_id TEXT,
    cash_session_id TEXT REFERENCES finance_cash_sessions(id),
    operator_id TEXT REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_wallet_ledger_santri 
    ON finance_wallet_ledger(santri_id, created_at);

CREATE INDEX IF NOT EXISTS idx_finance_wallet_ledger_ref 
    ON finance_wallet_ledger(reference_id);

CREATE INDEX IF NOT EXISTS idx_finance_wallet_ledger_session 
    ON finance_wallet_ledger(cash_session_id);

-- 6. Trigger Integritas Buku Besar & Proteksi Race Condition / Saldo Negatif
CREATE TRIGGER IF NOT EXISTS trg_finance_wallet_verify_balance
BEFORE INSERT ON finance_wallet_ledger
FOR EACH ROW
BEGIN
    SELECT CASE
        -- Cegah pembacaan saldo usang (stale read / race condition)
        WHEN (
            SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
            FROM finance_wallet_ledger
            WHERE santri_id = NEW.santri_id
        ) != NEW.balance_before
        THEN RAISE(ABORT, 'STALE_BALANCE_DETECTED: balance_before tidak sesuai dengan saldo aktual buku besar.')

        -- Cegah saldo negatif (overdraw)
        WHEN (
            NEW.balance_before + (CASE WHEN NEW.direction = 'IN' THEN NEW.amount ELSE -NEW.amount END)
        ) < 0
        THEN RAISE(ABORT, 'OVERDRAW_DETECTED: Saldo buku besar tidak mencukupi untuk mutasi ini.')

        -- Validasi konsistensi internal balance_after
        WHEN NEW.balance_after != (
            NEW.balance_before + (CASE WHEN NEW.direction = 'IN' THEN NEW.amount ELSE -NEW.amount END)
        )
        THEN RAISE(ABORT, 'INVALID_BALANCE_AFTER: balance_after tidak sesuai dengan balance_before dan amount.')
    END;
END;

-- 7. Konfigurasi Limit Global Pesantren Default (PRD #16 & Implementation Plan 4.4)
INSERT OR IGNORE INTO app_settings (key, value, updated_at) 
VALUES ('uang_jajan_global_daily_limit', '100000', datetime('now'));
