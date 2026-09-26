"""Test Suite for Uang Jajan Non-Migration & Zero Starting Balance Cutover.

Validates:
1. Legacy uang jajan balances (from tabungan_log / old santri.saldo_uang_jajan) are NOT migrated to finance_wallet_ledger.
2. Migration 0173 resets/aligns santri.saldo_uang_jajan derived cache to strictly reflect finance_wallet_ledger (starts at 0).
3. Non-destructive: legacy tabungan_log rows remain completely intact for historical audit.
4. Subsequent new transactions in finance_wallet_ledger are preserved upon repeated executions of migration 0173 (idempotency).
5. PRD and IMPLEMENTATION_PLAN documentation integrity.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_0160 = ROOT / "migrations" / "0160_finance_cards_and_wallet.sql"
MIGRATION_0173 = ROOT / "migrations" / "0173_finance_zero_wallet_balance_cutover.sql"
PRD_PATH = ROOT / "docs" / "SISTEM_KEUANGAN_BARU_PRD.md"
PLAN_PATH = ROOT / "docs" / "IMPLEMENTATION_PLAN.md"


def setup_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON;")

    # Setup base tables needed
    conn.executescript("""
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin'
        );
        INSERT INTO users (id, username, name, role) VALUES ('usr-1', 'admin', 'Administrator', 'admin');

        CREATE TABLE app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE santri (
            id TEXT PRIMARY KEY,
            nis TEXT NOT NULL UNIQUE,
            nama_lengkap TEXT NOT NULL,
            status_global TEXT NOT NULL DEFAULT 'aktif',
            asrama TEXT,
            kamar TEXT,
            saldo_tabungan INTEGER NOT NULL DEFAULT 0,
            saldo_uang_jajan INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT
        );

        CREATE TABLE finance_cash_sessions (
            id TEXT PRIMARY KEY
        );

        CREATE TABLE tabungan_log (
            id TEXT PRIMARY KEY,
            santri_id TEXT NOT NULL,
            nominal INTEGER NOT NULL,
            jenis TEXT NOT NULL,
            dompet TEXT NOT NULL DEFAULT 'JAJAN',
            created_at TEXT NOT NULL
        );
    """)

    # Populate legacy santri data with old balances
    conn.executescript("""
        INSERT INTO santri (id, nis, nama_lengkap, saldo_uang_jajan, saldo_tabungan)
        VALUES 
            ('san-01', 'NIS001', 'Ahmad Faris', 175000, 50000),
            ('san-02', 'NIS002', 'Budi Pratama', 250000, 0),
            ('san-03', 'NIS003', 'Citra Dewi', 0, 0);

        INSERT INTO tabungan_log (id, santri_id, nominal, jenis, dompet, created_at)
        VALUES
            ('log-01', 'san-01', 175000, 'MASUK', 'JAJAN', '2026-05-10 10:00:00'),
            ('log-02', 'san-02', 250000, 'MASUK', 'JAJAN', '2026-06-01 08:30:00');
    """)

    return conn


def test_cutover():
    print("=" * 60)
    print("Testing Uang Jajan Cutover (Zero Starting Balance)...")
    print("=" * 60)

    conn = setup_db()

    # Step 1: Apply Migration 0160 (Create finance_cards_and_wallet)
    print("1. Applying Migration 0160 (Wallet Ledger schema)...")
    with open(MIGRATION_0160, "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    # Verify finance_wallet_ledger is completely empty
    count = conn.execute("SELECT COUNT(*) FROM finance_wallet_ledger").fetchone()[0]
    assert count == 0, f"Expected 0 entries in finance_wallet_ledger, got {count}"
    print("   [OK] finance_wallet_ledger created clean with 0 records.")

    # Prior to migration 0173, legacy saldo_uang_jajan still has old values in santri table
    legacy_balances = dict(conn.execute("SELECT id, saldo_uang_jajan FROM santri").fetchall())
    assert legacy_balances['san-01'] == 175000
    assert legacy_balances['san-02'] == 250000
    assert legacy_balances['san-03'] == 0
    print("   [OK] Pre-cutover state correctly simulates legacy non-zero balances.")

    # Step 2: Apply Migration 0173
    print("2. Applying Migration 0173 (Zero Balance Cutover)...")
    with open(MIGRATION_0173, "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    # Verify all santri now have saldo_uang_jajan = 0
    post_balances = dict(conn.execute("SELECT id, saldo_uang_jajan FROM santri").fetchall())
    assert post_balances['san-01'] == 0, f"Expected 0, got {post_balances['san-01']}"
    assert post_balances['san-02'] == 0, f"Expected 0, got {post_balances['san-02']}"
    assert post_balances['san-03'] == 0, f"Expected 0, got {post_balances['san-03']}"
    print("   [OK] All santri saldo_uang_jajan derived cache reset to Rp 0.")

    # Step 3: Verify tabungan_log is untouched (Non-destructive check)
    print("3. Verifying non-destructive legacy log integrity...")
    log_count = conn.execute("SELECT COUNT(*) FROM tabungan_log").fetchone()[0]
    assert log_count == 2, f"Expected 2 tabungan_log rows, got {log_count}"
    print("   [OK] tabungan_log entries preserved for historical audit trail.")

    # Step 4: Record a new transaction in the new system
    print("4. Testing new financial transaction in Sistem Keuangan Baru...")
    conn.execute("""
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, created_at
        ) VALUES (
            'wlt-new-01', 'san-01', 'IN', 'TOPUP_ONLINE', 100000, 0, 100000, datetime('now')
        );
    """)
    conn.execute("UPDATE santri SET saldo_uang_jajan = 100000 WHERE id = 'san-01';")

    # Authoritative balance calculation
    auth_bal = conn.execute("""
        SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
        FROM finance_wallet_ledger WHERE santri_id = 'san-01'
    """).fetchone()[0]
    assert auth_bal == 100000
    print("   [OK] New transaction correctly recorded (Authoritative Balance = 100.000).")

    # Step 5: Idempotency of Migration 0173
    print("5. Testing Idempotency of Migration 0173...")
    with open(MIGRATION_0173, "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    idem_balances = dict(conn.execute("SELECT id, saldo_uang_jajan FROM santri").fetchall())
    assert idem_balances['san-01'] == 100000, f"Expected 100.000 for san-01, got {idem_balances['san-01']}"
    assert idem_balances['san-02'] == 0, f"Expected 0 for san-02, got {idem_balances['san-02']}"
    assert idem_balances['san-03'] == 0, f"Expected 0 for san-03, got {idem_balances['san-03']}"
    print("   [OK] Migration 0173 is idempotent; preserves new ledger transactions while keeping untransacted santri at 0.")

    # Step 6: Verify PRD & Plan documentation
    print("6. Verifying PRD & Plan documentation...")
    prd_text = PRD_PATH.read_text(encoding="utf-8")
    assert "15.1 Aturan Cutover: Non-Migrasi Saldo Uang Jajan Lama" in prd_text, "PRD missing Section 15.1"
    assert "TIDAK dimigrasikan" in prd_text, "PRD missing explicit non-migration rule"

    plan_text = PLAN_PATH.read_text(encoding="utf-8")
    assert "4.8 Rencana Cutover & Non-Migrasi Saldo Uang Jajan Lama" in plan_text, "Plan missing Section 4.8"
    print("   [OK] Documentation strictly aligned with user requirement.")

    print("=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    test_cutover()
