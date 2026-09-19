-- Migration: 0159_finance_cash_sessions_and_idempotency.sql
-- Fase 4C Patch: Fondasi Minimum Sesi Kas Loket & Tabel Proteksi Idempotency Konkuren
-- Memenuhi PRD Sesi Kas Loket (#23) dan mencegah duplicate/orphan order pada concurrent submit.

-- 1. Tabel Sesi Kas Loket (PRD #23 & Implementation Plan Tabel #20)
CREATE TABLE IF NOT EXISTS finance_cash_sessions (
    id TEXT PRIMARY KEY,
    session_code TEXT NOT NULL UNIQUE,
    operator_id TEXT NOT NULL REFERENCES users(id),
    opened_at TEXT NOT NULL,
    opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
    total_cash_in INTEGER NOT NULL DEFAULT 0 CHECK (total_cash_in >= 0),
    total_cash_out INTEGER NOT NULL DEFAULT 0 CHECK (total_cash_out >= 0),
    expected_closing_balance INTEGER NOT NULL DEFAULT 0 CHECK (expected_closing_balance >= 0),
    actual_closing_balance INTEGER,
    difference INTEGER,
    difference_notes TEXT,
    closed_at TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_cash_sessions_operator
    ON finance_cash_sessions(operator_id, status);

CREATE INDEX IF NOT EXISTS idx_finance_cash_sessions_status
    ON finance_cash_sessions(status);

CREATE INDEX IF NOT EXISTS idx_finance_cash_sessions_code
    ON finance_cash_sessions(session_code);

-- 2. Tabel Proteksi Idempotensi Konkuren (Race-Safe Idempotency)
CREATE TABLE IF NOT EXISTS finance_idempotency_keys (
    key TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'ORDER_CREATED', 'COMPLETED', 'FAILED')),
    order_id TEXT REFERENCES finance_payment_orders(id),
    payment_id TEXT REFERENCES finance_payments(id),
    response_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_idempotency_keys_scope
    ON finance_idempotency_keys(scope, status);
