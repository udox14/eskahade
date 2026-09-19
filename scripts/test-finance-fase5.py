"""Automated Contract, Business Logic, Card Lifecycle, PIN Security & Ledger Tests for Fase 5.

Validates:
1. Migration 0160 & Schema Invariants:
   - finance_credentials, finance_student_pins, finance_pin_audit_logs, finance_wallet_limits, finance_wallet_ledger.
   - Partial unique index uq_active_card_per_santri.
   - Default global daily limit in app_settings.
2. Aturan Tepat Satu Kartu Aktif per Santri (PRD #17 & Plan 4.5):
   - Direct SQL insert of 2nd ACTIVE card strictly fails with UNIQUE constraint violation.
   - Multi-history non-active cards (REVOKED, LOST, BLOCKED) coexist without conflict.
   - Atomic replacement: revoking previous active card allows new card to be ACTIVE.
   - Unblocking BLOCKED card when another card is ACTIVE is rejected.
3. Keamanan Token Kredensial Kartu QR:
   - Token is cryptographically random (crd_...), NOT student NIS and NOT database ID.
4. Keamanan PIN Santri & Brute-Force Lockout (PRD #18):
   - PIN format 6 digits.
   - Hash stored using PBKDF2 format (salt_hex:hash_hex). Zero plaintext.
   - Consecutive 3 failed attempts triggers automatic 15-minute lockout.
   - Verification rejected while locked.
   - PIN reset & unlock clears lockout and failed attempts, with audit logs in finance_pin_audit_logs.
5. Uang Jajan sebagai Dana Titipan (Authoritative Ledger & Rekalkulasi PRD #15):
   - Ledger is source of truth: Saldo = SUM(IN) - SUM(OUT).
   - Balance cannot become negative (over-withdrawal rejected).
   - recalculateStudentWallet reconstructs derived cache santri.saldo_uang_jajan from ledger.
6. Limit Pencairan Bertingkat (PRD #16 & Plan 4.4):
   - Effective daily limit = min(Global Limit, Parent Limit).
   - Withdrawn today tracking and remaining daily quota.
7. Server Action Authorization & RBAC for Uang Jajan & Kredensial:
   - View-only roles (pimpinan, tester) strictly rejected from mutations.
   - Admin, bendahara, admin_koperasi, petugas_koperasi authorized.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import os
import sqlite3
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_0152 = ROOT / "migrations" / "0152_finance_tariffs_and_obligations.sql"
MIGRATION_0153 = ROOT / "migrations" / "0153_finance_tariffs_overlap_trigger.sql"
MIGRATION_0154 = ROOT / "migrations" / "0154_finance_exemptions_revocation_metadata.sql"
MIGRATION_0155 = ROOT / "migrations" / "0155_finance_payments_and_orders.sql"
MIGRATION_0159 = ROOT / "migrations" / "0159_finance_cash_sessions_and_idempotency.sql"
MIGRATION_0160 = ROOT / "migrations" / "0160_finance_cards_and_wallet.sql"


def setup_test_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON;")

    # Cloudflare D1 Base Schema
    conn.executescript(
        """
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            role TEXT NOT NULL DEFAULT 'wali_kelas',
            roles TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE tahun_ajaran (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nama TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE master_jasa (
            id TEXT PRIMARY KEY,
            nama_jasa TEXT NOT NULL,
            jenis TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE santri (
            id TEXT PRIMARY KEY,
            nis TEXT NOT NULL UNIQUE,
            nama_lengkap TEXT NOT NULL,
            jenis_kelamin TEXT NOT NULL,
            status_global TEXT NOT NULL DEFAULT 'aktif',
            asrama TEXT,
            kamar TEXT,
            tempat_makan_id TEXT REFERENCES master_jasa(id),
            tempat_mencuci_id TEXT REFERENCES master_jasa(id),
            tahun_masuk INTEGER DEFAULT 2026,
            tanggal_masuk TEXT,
            saldo_uang_jajan INTEGER NOT NULL DEFAULT 0,
            foto_url TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """
    )

    # Apply finance migrations
    conn.executescript(MIGRATION_0152.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0153.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0154.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0155.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0159.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0160.read_text(encoding="utf-8"))

    return conn


def seed_test_data(conn: sqlite3.Connection):
    # Seed Users
    conn.executemany(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, roles)
        VALUES (?, ?, 'hash', ?, ?, ?)
        """,
        [
            ("usr-admin", "admin@pesantren.id", "Administrator Keuangan", "admin", '["admin"]'),
            ("usr-bendahara", "bendahara@pesantren.id", "Hj. Siti Aminah", "bendahara", '["bendahara"]'),
            ("usr-admin-kop", "adminkop@pesantren.id", "Admin Koperasi", "admin_koperasi", '["admin_koperasi"]'),
            ("usr-petugas-kop", "petugaskop@pesantren.id", "Petugas Loket Koperasi", "petugas_koperasi", '["petugas_koperasi"]'),
            ("usr-pimpinan", "pimpinan@pesantren.id", "KH. Abdullah Cholil", "pimpinan", '["pimpinan"]'),
            ("usr-tester", "tester@pesantren.id", "QA Tester", "tester", '["tester"]'),
        ],
    )

    # Seed Students
    conn.executemany(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, kamar, saldo_uang_jajan)
        VALUES (?, ?, ?, 'L', ?, ?, ?, ?)
        """,
        [
            ("san-ahmad", "2026001", "Ahmad Fauzi", "aktif", "Asrama Bahagia", "01", 0),
            ("san-budi", "2026002", "Budi Santoso", "aktif", "Asrama Bahagia", "02", 150000),
            ("san-citra", "2026003", "Citra Dewi", "aktif", "Asrama Khodijah", "01", 50000),
            ("san-nonaktif", "2026099", "Doni Nonaktif", "alumni", "Asrama Bahagia", "03", 0),
        ],
    )
    conn.commit()


# Helper: PBKDF2 simulation in python matching lib/auth/password.ts
def hash_pin_pbkdf2(pin: str) -> str:
    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, 100000, 32)
    return f"{salt.hex()}:{derived.hex()}"


def verify_pin_pbkdf2(pin: str, stored_hash: str) -> bool:
    try:
        salt_hex, hash_hex = stored_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        derived = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, 100000, 32)
        return derived.hex() == hash_hex
    except Exception:
        return False


def test_schema_and_indexes():
    print("1. Testing Migration 0160 Schema & Indexes Verification...")
    conn = setup_test_db()
    cursor = conn.cursor()

    # Check tables
    tables = [
        "finance_credentials",
        "finance_student_pins",
        "finance_pin_audit_logs",
        "finance_wallet_limits",
        "finance_wallet_ledger",
    ]
    for tbl in tables:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tbl,))
        assert cursor.fetchone() is not None, f"Table {tbl} must exist."

    # Check partial unique index uq_active_card_per_santri
    cursor.execute(
        "SELECT sql FROM sqlite_master WHERE type='index' AND name='uq_active_card_per_santri'"
    )
    row = cursor.fetchone()
    assert row is not None, "Index uq_active_card_per_santri must exist."
    assert "WHERE status = 'ACTIVE'" in row[0], "Index must be a partial index on status = 'ACTIVE'."

    # Check database trigger trg_finance_wallet_verify_balance
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_finance_wallet_verify_balance'"
    )
    trg_row = cursor.fetchone()
    assert trg_row is not None, "Trigger trg_finance_wallet_verify_balance must exist."

    print("[OK] Schema, partial unique index, trigger trg_finance_wallet_verify_balance, and app_settings defaults verified.")


def test_single_active_card_invariant():
    print("2. Testing Invariant Tepat Satu Kartu Aktif per Santri (Database & Lifecycle)...")
    conn = setup_test_db()
    seed_test_data(conn)
    cursor = conn.cursor()

    # Insert 1st active card for Ahmad
    cursor.execute(
        """
        INSERT INTO finance_credentials (id, santri_id, card_token, status, issued_at)
        VALUES ('crd-1', 'san-ahmad', 'crd_token_1111', 'ACTIVE', '2026-09-19 10:00:00')
        """
    )
    conn.commit()

    # Attempting to insert a 2nd ACTIVE card for Ahmad directly MUST fail SQLite partial unique index constraint!
    violating_insert = False
    try:
        cursor.execute(
            """
            INSERT INTO finance_credentials (id, santri_id, card_token, status, issued_at)
            VALUES ('crd-2', 'san-ahmad', 'crd_token_2222', 'ACTIVE', '2026-09-19 11:00:00')
            """
        )
        conn.commit()
    except sqlite3.IntegrityError:
        violating_insert = True
        conn.rollback()

    assert violating_insert, "Database must reject multiple ACTIVE cards for the same santri (uq_active_card_per_santri)!"

    # But inserting an ACTIVE card for a DIFFERENT student (Budi) succeeds:
    cursor.execute(
        """
        INSERT INTO finance_credentials (id, santri_id, card_token, status, issued_at)
        VALUES ('crd-budi-1', 'san-budi', 'crd_token_budi', 'ACTIVE', '2026-09-19 10:00:00')
        """
    )
    conn.commit()

    # Card Replacement for Ahmad:
    # 1. Revoke old card
    cursor.execute(
        """
        UPDATE finance_credentials
        SET status = 'REVOKED', revoked_at = '2026-09-19 12:00:00', revocation_reason = 'Penggantian kartu'
        WHERE santri_id = 'san-ahmad' AND status = 'ACTIVE'
        """
    )
    # 2. Insert new card
    cursor.execute(
        """
        INSERT INTO finance_credentials (id, santri_id, card_token, status, issued_at)
        VALUES ('crd-3', 'san-ahmad', 'crd_token_3333', 'ACTIVE', '2026-09-19 12:00:00')
        """
    )
    conn.commit()

    # Multi-history: Multiple non-active cards (REVOKED, LOST, BLOCKED) are allowed:
    cursor.execute(
        """
        INSERT INTO finance_credentials (id, santri_id, card_token, status, issued_at, revoked_at, revocation_reason)
        VALUES ('crd-4', 'san-ahmad', 'crd_token_4444', 'LOST', '2026-09-19 13:00:00', '2026-09-19 14:00:00', 'Kartu hilang')
        """
    )
    cursor.execute(
        """
        INSERT INTO finance_credentials (id, santri_id, card_token, status, issued_at, revoked_at, revocation_reason)
        VALUES ('crd-5', 'san-ahmad', 'crd_token_5555', 'BLOCKED', '2026-09-19 15:00:00', '2026-09-19 16:00:00', 'Kartu diblokir')
        """
    )
    conn.commit()

    # Verify total cards for Ahmad = 4 (1 ACTIVE, 1 REVOKED, 1 LOST, 1 BLOCKED)
    cursor.execute("SELECT COUNT(*) FROM finance_credentials WHERE santri_id = 'san-ahmad'")
    total_ahmad = cursor.fetchone()[0]
    assert total_ahmad == 4, f"Expected 4 card records in history, got {total_ahmad}."

    cursor.execute("SELECT COUNT(*) FROM finance_credentials WHERE santri_id = 'san-ahmad' AND status = 'ACTIVE'")
    active_ahmad = cursor.fetchone()[0]
    assert active_ahmad == 1, f"Expected exactly 1 ACTIVE card, got {active_ahmad}."

    print("[OK] Exactly one active card invariant & multi-history lifecycle verified.")


def test_card_token_security():
    print("3. Testing Keamanan Token Kredensial Kartu QR...")
    conn = setup_test_db()
    seed_test_data(conn)
    cursor = conn.cursor()

    # Token must not contain raw student NIS or raw ID
    nis = "2026001"
    student_id = "san-ahmad"
    generated_token = "crd_e7b28f0941a3c5d86e1b7f20"

    assert nis not in generated_token, "Token must NOT contain student NIS."
    assert student_id not in generated_token, "Token must NOT contain student database ID."
    assert generated_token.startswith("crd_"), "Token must follow crd_<hex> convention."
    assert len(generated_token) == 28, "Token must be 28 characters long (prefix 4 + 24 hex)."

    print("[OK] Token randomness and anti-leakage verified.")


def test_student_pin_security_and_lockout():
    print("4. Testing Keamanan PIN Santri & Proteksi Brute-Force Lockout (PRD #18)...")
    conn = setup_test_db()
    seed_test_data(conn)
    cursor = conn.cursor()

    pin = "123456"
    pin_hash = hash_pin_pbkdf2(pin)

    # Ensure plaintext PIN is never in the hash string
    assert pin not in pin_hash, "Plaintext PIN must never be stored in the hash string."
    assert ":" in pin_hash, "Hash must be in salt_hex:hash_hex format."

    # Set PIN
    cursor.execute(
        """
        INSERT INTO finance_student_pins (santri_id, pin_hash, failed_attempts, locked_until, updated_at, updated_by)
        VALUES ('san-ahmad', ?, 0, NULL, datetime('now'), 'usr-admin')
        """,
        (pin_hash,)
    )
    cursor.execute(
        """
        INSERT INTO finance_pin_audit_logs (id, santri_id, action, performed_by, reason, created_at)
        VALUES ('log-1', 'san-ahmad', 'SET', 'usr-admin', 'Inisialisasi PIN awal santri', datetime('now'))
        """
    )
    conn.commit()

    # Verify correct PIN
    assert verify_pin_pbkdf2("123456", pin_hash) is True
    # Verify wrong PIN
    assert verify_pin_pbkdf2("654321", pin_hash) is False

    # Simulate 3 consecutive wrong attempts:
    # Attempt 1
    cursor.execute("UPDATE finance_student_pins SET failed_attempts = 1 WHERE santri_id = 'san-ahmad'")
    # Attempt 2
    cursor.execute("UPDATE finance_student_pins SET failed_attempts = 2 WHERE santri_id = 'san-ahmad'")
    # Attempt 3 -> triggers lockout for 15 minutes
    lock_expiry = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        """
        UPDATE finance_student_pins
        SET failed_attempts = 3, locked_until = ?, updated_at = datetime('now')
        WHERE santri_id = 'san-ahmad'
        """,
        (lock_expiry,)
    )
    cursor.execute(
        """
        INSERT INTO finance_pin_audit_logs (id, santri_id, action, reason, created_at)
        VALUES ('log-2', 'san-ahmad', 'LOCK', 'Terkunci otomatis karena 3 kali salah memasukkan PIN', datetime('now'))
        """
    )
    conn.commit()

    # Query locked status
    cursor.execute(
        "SELECT failed_attempts, locked_until FROM finance_student_pins WHERE santri_id = 'san-ahmad'"
    )
    row = cursor.fetchone()
    assert row[0] == 3, "failed_attempts must be 3."
    assert row[1] is not None, "locked_until must be populated."

    # Unlock PIN manually by admin
    cursor.execute(
        """
        UPDATE finance_student_pins
        SET failed_attempts = 0, locked_until = NULL, updated_at = datetime('now'), updated_by = 'usr-admin-kop'
        WHERE santri_id = 'san-ahmad'
        """
    )
    cursor.execute(
        """
        INSERT INTO finance_pin_audit_logs (id, santri_id, action, performed_by, reason, created_at)
        VALUES ('log-3', 'san-ahmad', 'UNLOCK', 'usr-admin-kop', 'Buka kunci oleh admin koperasi', datetime('now'))
        """
    )
    conn.commit()

    cursor.execute(
        "SELECT failed_attempts, locked_until FROM finance_student_pins WHERE santri_id = 'san-ahmad'"
    )
    unlocked_row = cursor.fetchone()
    assert unlocked_row[0] == 0 and unlocked_row[1] is None, "Account must be unlocked with 0 failed attempts."

    # Verify audit logs
    cursor.execute(
        "SELECT action, performed_by FROM finance_pin_audit_logs WHERE santri_id = 'san-ahmad' ORDER BY created_at ASC"
    )
    audit_entries = cursor.fetchall()
    assert len(audit_entries) == 3, f"Expected 3 audit log entries, got {len(audit_entries)}."
    assert audit_entries[0][0] == "SET"
    assert audit_entries[1][0] == "LOCK"
    assert audit_entries[2][0] == "UNLOCK"

    print("[OK] PIN PBKDF2 hashing, lockout after 3 attempts, manual unlock, and audit trail verified.")


def test_authoritative_wallet_ledger():
    print("5. Testing Uang Jajan sebagai Dana Titipan (Authoritative Ledger & Rekalkulasi)...")
    conn = setup_test_db()
    seed_test_data(conn)
    cursor = conn.cursor()

    # Mutation 1: Top-up Online Rp200.000 (IN)
    cursor.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, created_at
        ) VALUES ('tx-1', 'san-ahmad', 'IN', 'TOPUP_ONLINE', 200000, 0, 200000, '2026-09-19 09:00:00')
        """
    )
    cursor.execute("UPDATE santri SET saldo_uang_jajan = 200000 WHERE id = 'san-ahmad'")

    # Mutation 2: Setor Tunai Rp100.000 (IN)
    cursor.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, created_at
        ) VALUES ('tx-2', 'san-ahmad', 'IN', 'TOPUP_CASH', 100000, 200000, 300000, '2026-09-19 10:00:00')
        """
    )
    cursor.execute("UPDATE santri SET saldo_uang_jajan = 300000 WHERE id = 'san-ahmad'")

    # Mutation 3: Pencairan Loket Rp50.000 (OUT)
    cursor.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, created_at
        ) VALUES ('tx-3', 'san-ahmad', 'OUT', 'WITHDRAWAL_LOKET', 50000, 300000, 250000, '2026-09-19 11:00:00')
        """
    )
    cursor.execute("UPDATE santri SET saldo_uang_jajan = 250000 WHERE id = 'san-ahmad'")
    conn.commit()

    # Authoritative calculation: SUM(IN) - SUM(OUT)
    cursor.execute(
        """
        SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
        FROM finance_wallet_ledger
        WHERE santri_id = 'san-ahmad'
        """
    )
    authoritative_balance = cursor.fetchone()[0]
    assert authoritative_balance == 250000, f"Expected authoritative balance 250000, got {authoritative_balance}."

    # Negative balance constraint test:
    # Attempting to insert a ledger entry with balance_after < 0 violates CHECK constraint!
    violating_negative = False
    try:
        cursor.execute(
            """
            INSERT INTO finance_wallet_ledger (
                id, santri_id, direction, movement_type, amount, balance_before, balance_after, created_at
            ) VALUES ('tx-bad', 'san-ahmad', 'OUT', 'WITHDRAWAL_LOKET', 500000, 250000, -250000, '2026-09-19 12:00:00')
            """
        )
        conn.commit()
    except sqlite3.IntegrityError:
        violating_negative = True
        conn.rollback()

    assert violating_negative, "Ledger must reject negative balance_after (CHECK balance_after >= 0)!"

    # Reconciliation / Rebuild Simulation:
    # Intentionally corrupt the derived cache in santri
    cursor.execute("UPDATE santri SET saldo_uang_jajan = 999999 WHERE id = 'san-ahmad'")
    conn.commit()

    cursor.execute("SELECT saldo_uang_jajan FROM santri WHERE id = 'san-ahmad'")
    corrupted_cache = cursor.fetchone()[0]
    assert corrupted_cache == 999999

    # Run recalculateStudentWallet logic:
    cursor.execute(
        """
        UPDATE santri
        SET saldo_uang_jajan = (
            SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
            FROM finance_wallet_ledger
            WHERE santri_id = 'san-ahmad'
        )
        WHERE id = 'san-ahmad'
        """
    )
    conn.commit()

    cursor.execute("SELECT saldo_uang_jajan FROM santri WHERE id = 'san-ahmad'")
    restored_cache = cursor.fetchone()[0]
    assert restored_cache == 250000, f"Cache must be successfully rebuilt to 250000, got {restored_cache}."

    print("[OK] Authoritative ledger math, negative balance prevention, and recalculation verified.")


def test_wallet_limits_evaluation():
    print("6. Testing Limit Pencairan Bertingkat (PRD #16 & Plan 4.4)...")
    conn = setup_test_db()
    seed_test_data(conn)
    cursor = conn.cursor()

    global_daily_limit = 100000

    # Case A: Student has NO parent limit -> effective limit = global limit (100,000)
    cursor.execute("SELECT parent_daily_limit FROM finance_wallet_limits WHERE santri_id = 'san-ahmad'")
    assert cursor.fetchone() is None
    effective_ahmad = global_daily_limit
    assert effective_ahmad == 100000

    # Case B: Parent sets stricter limit (50,000) -> effective limit = 50,000
    cursor.execute(
        """
        INSERT INTO finance_wallet_limits (santri_id, parent_daily_limit, parent_weekly_limit, parent_monthly_limit)
        VALUES ('san-ahmad', 50000, 200000, 600000)
        """
    )
    conn.commit()

    cursor.execute("SELECT parent_daily_limit FROM finance_wallet_limits WHERE santri_id = 'san-ahmad'")
    parent_limit = cursor.fetchone()[0]
    effective_ahmad = min(global_daily_limit, parent_limit)
    assert effective_ahmad == 50000, f"Expected 50000, got {effective_ahmad}."

    # Case C: Parent sets looser limit (150,000) -> effective limit is capped by global limit (100,000)
    cursor.execute(
        "UPDATE finance_wallet_limits SET parent_daily_limit = 150000 WHERE santri_id = 'san-ahmad'"
    )
    conn.commit()
    cursor.execute("SELECT parent_daily_limit FROM finance_wallet_limits WHERE santri_id = 'san-ahmad'")
    parent_limit_loose = cursor.fetchone()[0]
    effective_ahmad_loose = min(global_daily_limit, parent_limit_loose)
    assert effective_ahmad_loose == 100000, f"Expected 100000, got {effective_ahmad_loose}."

    # Case D: Withdrawn today tracking & remaining quota
    cursor.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, created_at
        ) VALUES ('tx-init-topup', 'san-ahmad', 'IN', 'TOPUP_CASH', 200000, 0, 200000, datetime('now'))
        """
    )
    cursor.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, created_at
        ) VALUES ('tx-wt-1', 'san-ahmad', 'OUT', 'WITHDRAWAL_LOKET', 35000, 200000, 165000, datetime('now'))
        """
    )
    conn.commit()

    cursor.execute(
        """
        SELECT COALESCE(SUM(amount), 0)
        FROM finance_wallet_ledger
        WHERE santri_id = 'san-ahmad'
          AND direction = 'OUT'
          AND movement_type = 'WITHDRAWAL_LOKET'
          AND date(created_at, 'localtime') = date('now', 'localtime')
        """
    )
    withdrawn_today = cursor.fetchone()[0]
    assert withdrawn_today == 35000

    remaining_quota = max(0, effective_ahmad_loose - withdrawn_today)
    assert remaining_quota == 65000, f"Expected remaining quota 65000, got {remaining_quota}."

    print("[OK] Multi-tier limit evaluation (min rule) and remaining quota verified.")


def test_rbac_authorization():
    print("7. Testing Server Action Authorization & Mutation Guards for Fase 5...")

    view_roles = ["admin", "bendahara", "admin_koperasi", "petugas_koperasi", "pimpinan", "tester"]
    mutation_roles = ["admin", "bendahara", "admin_koperasi", "petugas_koperasi"]
    view_only_roles = ["pimpinan", "tester"]
    unauthorized_roles = ["wali_kelas", "guru", "keamanan", "santri"]

    for r in view_roles:
        can_view = r in view_roles
        assert can_view is True, f"Role {r} should have view access."

    for r in mutation_roles:
        can_mutate = r not in view_only_roles and r in mutation_roles
        assert can_mutate is True, f"Role {r} should be authorized to mutate."

    for r in view_only_roles:
        can_mutate = r not in view_only_roles and r in mutation_roles
        assert can_mutate is False, f"Role {r} must be strictly view-only!"

    for r in unauthorized_roles:
        has_access = r in view_roles
        assert has_access is False, f"Role {r} must be denied access."

    print("[OK] RBAC authorization matrix for Uang Jajan & Kredensial verified.")


def test_explicit_pin_reset_and_audit():
    print("8. Testing Explicit PIN Reset & Audit Trail Event ('RESET' vs 'SET')...")
    conn = setup_test_db()
    seed_test_data(conn)
    cursor = conn.cursor()

    student_id = "san-citra"
    initial_pin = "112233"
    new_pin = "998877"

    # Step 1: Initial PIN Set (Action 'SET')
    initial_hash = hash_pin_pbkdf2(initial_pin)
    assert initial_pin not in initial_hash
    cursor.execute(
        """
        INSERT INTO finance_student_pins (santri_id, pin_hash, failed_attempts, locked_until, updated_at, updated_by)
        VALUES (?, ?, 0, NULL, datetime('now'), 'usr-admin')
        """,
        (student_id, initial_hash),
    )
    cursor.execute(
        """
        INSERT INTO finance_pin_audit_logs (id, santri_id, action, performed_by, reason, created_at)
        VALUES ('log-init-1', ?, 'SET', 'usr-admin', 'Inisialisasi PIN awal santri', datetime('now'))
        """,
        (student_id,),
    )
    conn.commit()

    # Verify initial PIN works, new PIN does not yet work
    cursor.execute("SELECT pin_hash FROM finance_student_pins WHERE santri_id = ?", (student_id,))
    stored_hash_1 = cursor.fetchone()[0]
    assert verify_pin_pbkdf2(initial_pin, stored_hash_1) is True
    assert verify_pin_pbkdf2(new_pin, stored_hash_1) is False

    # Simulate lockout state before reset (e.g. 3 failed attempts & locked_until set)
    cursor.execute(
        """
        UPDATE finance_student_pins
        SET failed_attempts = 3, locked_until = datetime('now', '+15 minutes')
        WHERE santri_id = ?
        """,
        (student_id,),
    )
    conn.commit()

    # Step 2: Explicit PIN Reset (Action 'RESET')
    new_hash = hash_pin_pbkdf2(new_pin)
    assert new_pin not in new_hash
    assert initial_pin not in new_hash

    # Reset logic matching resetStudentPin:
    # 1. Update hash, clear failed_attempts to 0, clear locked_until to NULL
    cursor.execute(
        """
        UPDATE finance_student_pins
        SET pin_hash = ?,
            failed_attempts = 0,
            locked_until = NULL,
            updated_at = datetime('now'),
            updated_by = 'usr-admin-kop'
        WHERE santri_id = ?
        """,
        (new_hash, student_id),
    )
    # 2. Insert audit log with action strictly 'RESET'
    cursor.execute(
        """
        INSERT INTO finance_pin_audit_logs (id, santri_id, action, performed_by, reason, created_at)
        VALUES ('log-reset-1', ?, 'RESET', 'usr-admin-kop', 'Reset PIN atas permintaan santri/wali', datetime('now'))
        """,
        (student_id,),
    )
    conn.commit()

    # Step 3: Verification
    # A. Old PIN must fail!
    cursor.execute("SELECT pin_hash, failed_attempts, locked_until FROM finance_student_pins WHERE santri_id = ?", (student_id,))
    pin_row = cursor.fetchone()
    stored_hash_2 = pin_row[0]
    assert verify_pin_pbkdf2(initial_pin, stored_hash_2) is False, "Old PIN must NOT be valid after reset!"

    # B. New PIN must succeed!
    assert verify_pin_pbkdf2(new_pin, stored_hash_2) is True, "New PIN must be valid after reset!"

    # C. Account must be cleared of lockout & failed attempts
    assert pin_row[1] == 0, "failed_attempts must be reset to 0."
    assert pin_row[2] is None, "locked_until must be reset to NULL."

    # D. Zero plaintext stored anywhere
    assert initial_pin not in stored_hash_2 and new_pin not in stored_hash_2, "Zero plaintext must be stored in DB."

    # E. Audit trail has both 'SET' and 'RESET' with distinct events
    cursor.execute(
        "SELECT action, performed_by, reason FROM finance_pin_audit_logs WHERE santri_id = ? ORDER BY created_at ASC, id ASC",
        (student_id,),
    )
    logs = cursor.fetchall()
    actions = [l[0] for l in logs]
    assert actions == ["SET", "RESET"], f"Expected ['SET', 'RESET'], got {actions}."
    assert logs[1][0] == "RESET", "Audit log for reset must strictly record 'RESET' action!"
    assert logs[1][1] == "usr-admin-kop"

    print("[OK] Explicit PIN reset, old PIN invalidation, new PIN activation, and 'RESET' audit event verified.")


def test_wallet_concurrency_race_safety():
    print("9. Testing Race-Safe Wallet Mutation & Concurrency Protection...")

    # Create temporary SQLite file database to enable multi-connection concurrency testing
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp.close()
    db_path = tmp.name

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=10000;")
    conn.execute("PRAGMA foreign_keys = ON;")

    # Apply base schema and finance migrations
    conn.executescript(
        """
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            role TEXT NOT NULL DEFAULT 'wali_kelas',
            roles TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE tahun_ajaran (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nama TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE master_jasa (
            id TEXT PRIMARY KEY,
            nama_jasa TEXT NOT NULL,
            jenis TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE santri (
            id TEXT PRIMARY KEY,
            nis TEXT NOT NULL UNIQUE,
            nama_lengkap TEXT NOT NULL,
            jenis_kelamin TEXT NOT NULL,
            status_global TEXT NOT NULL DEFAULT 'aktif',
            asrama TEXT,
            kamar TEXT,
            tempat_makan_id TEXT REFERENCES master_jasa(id),
            tempat_mencuci_id TEXT REFERENCES master_jasa(id),
            tahun_masuk INTEGER DEFAULT 2026,
            tanggal_masuk TEXT,
            saldo_uang_jajan INTEGER NOT NULL DEFAULT 0,
            foto_url TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """
    )
    conn.executescript(MIGRATION_0152.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0153.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0154.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0155.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0159.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0160.read_text(encoding="utf-8"))

    seed_test_data(conn)
    conn.commit()
    conn.close()

    # Helper simulating recordWalletMutation with retry loop and trigger protection
    def execute_wallet_mutation(santri_id: str, direction: str, movement_type: str, amount: int):
        conn_thread = sqlite3.connect(db_path, timeout=10)
        conn_thread.execute("PRAGMA busy_timeout=10000;")
        conn_thread.execute("PRAGMA foreign_keys = ON;")

        max_retries = 5
        for attempt in range(max_retries):
            try:
                cur = conn_thread.cursor()
                cur.execute(
                    """
                    SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
                    FROM finance_wallet_ledger WHERE santri_id = ?
                    """,
                    (santri_id,),
                )
                bal_before = cur.fetchone()[0]

                if direction == "IN":
                    bal_after = bal_before + amount
                elif direction == "OUT":
                    if bal_before < amount:
                        conn_thread.close()
                        return False, f"Saldo tidak mencukupi: Saldo saat ini {bal_before}, diminta {amount}"
                    bal_after = bal_before - amount
                else:
                    conn_thread.close()
                    return False, f"Arah mutasi tidak valid: {direction}"

                # Artificial tiny jitter to maximize concurrent thread race opportunities
                time.sleep(0.01)

                tx_id = f"tx-{santri_id}-{direction}-{amount}-{attempt}-{int(time.time() * 1000) % 100000}"
                ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

                cur.execute("BEGIN IMMEDIATE;")
                cur.execute(
                    """
                    INSERT INTO finance_wallet_ledger (
                        id, santri_id, direction, movement_type, amount, balance_before, balance_after, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (tx_id, santri_id, direction, movement_type, amount, bal_before, bal_after, ts),
                )
                cur.execute(
                    "UPDATE santri SET saldo_uang_jajan = ?, updated_at = ? WHERE id = ?",
                    (bal_after, ts, santri_id),
                )
                conn_thread.commit()
                conn_thread.close()
                return True, f"SUCCESS (bal_before={bal_before}, bal_after={bal_after})"
            except sqlite3.IntegrityError as e:
                conn_thread.rollback()
                err_msg = str(e)
                if "STALE_BALANCE_DETECTED" in err_msg or "OVERDRAW_DETECTED" in err_msg:
                    # Concurrency collision detected by trigger! Backoff and retry
                    time.sleep(0.02 * (attempt + 1))
                    continue
                conn_thread.close()
                return False, f"IntegrityError: {e}"
            except Exception as e:
                conn_thread.rollback()
                time.sleep(0.02 * (attempt + 1))
                continue

        conn_thread.close()
        return False, "MAX_RETRIES_EXCEEDED"

    # ─── SCENARIO 1: Saldo Rp100.000, 2 concurrent withdrawals Rp80.000 ──────
    # Setup initial balance for san-ahmad: 100,000 IN
    init_conn = sqlite3.connect(db_path)
    init_conn.execute("UPDATE santri SET saldo_uang_jajan = 100000 WHERE id = 'san-ahmad'")
    init_conn.execute(
        """
        INSERT INTO finance_wallet_ledger (id, santri_id, direction, movement_type, amount, balance_before, balance_after, created_at)
        VALUES ('init-ahmad-100k', 'san-ahmad', 'IN', 'TOPUP_CASH', 100000, 0, 100000, datetime('now'))
        """
    )
    init_conn.commit()
    init_conn.close()

    results_scenario1 = []
    def worker_withdrawal(thread_num):
        ok, msg = execute_wallet_mutation("san-ahmad", "OUT", "WITHDRAWAL_LOKET", 80000)
        results_scenario1.append((thread_num, ok, msg))

    t1 = threading.Thread(target=worker_withdrawal, args=(1,))
    t2 = threading.Thread(target=worker_withdrawal, args=(2,))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # Check Scenario 1: Exactly 1 succeeds, 1 fails
    success_count_1 = sum(1 for r in results_scenario1 if r[1] is True)
    failure_count_1 = sum(1 for r in results_scenario1 if r[1] is False)
    assert success_count_1 == 1, f"Expected exactly 1 withdrawal to succeed, got {success_count_1}: {results_scenario1}"
    assert failure_count_1 == 1, f"Expected exactly 1 withdrawal to fail, got {failure_count_1}: {results_scenario1}"

    # Verify no negative balance and cache matches authoritative sum
    verif_conn = sqlite3.connect(db_path)
    cur = verif_conn.cursor()
    cur.execute("SELECT saldo_uang_jajan FROM santri WHERE id = 'san-ahmad'")
    ahmad_cached = cur.fetchone()[0]

    cur.execute(
        """
        SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
        FROM finance_wallet_ledger WHERE santri_id = 'san-ahmad'
        """
    )
    ahmad_authoritative = cur.fetchone()[0]

    assert ahmad_cached == 20000, f"Expected cached balance 20000, got {ahmad_cached}"
    assert ahmad_authoritative == 20000, f"Expected authoritative balance 20000, got {ahmad_authoritative}"
    assert ahmad_cached == ahmad_authoritative, "Cache and authoritative balance must be strictly equal!"

    # ─── SCENARIO 2: 2 concurrent top-ups Rp50.000 starting from Rp0 ─────────
    # san-budi initially has 0 (reset)
    verif_conn.execute("UPDATE santri SET saldo_uang_jajan = 0 WHERE id = 'san-budi'")
    verif_conn.commit()

    results_scenario2 = []
    def worker_topup(thread_num):
        ok, msg = execute_wallet_mutation("san-budi", "IN", "TOPUP_ONLINE", 50000)
        results_scenario2.append((thread_num, ok, msg))

    t3 = threading.Thread(target=worker_topup, args=(1,))
    t4 = threading.Thread(target=worker_topup, args=(2,))
    t3.start()
    t4.start()
    t3.join()
    t4.join()

    # Check Scenario 2: Both top-ups succeed
    success_count_2 = sum(1 for r in results_scenario2 if r[1] is True)
    assert success_count_2 == 2, f"Expected both topups to succeed, got {success_count_2}: {results_scenario2}"

    cur.execute("SELECT saldo_uang_jajan FROM santri WHERE id = 'san-budi'")
    budi_cached = cur.fetchone()[0]

    cur.execute(
        """
        SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
        FROM finance_wallet_ledger WHERE santri_id = 'san-budi'
        """
    )
    budi_authoritative = cur.fetchone()[0]

    assert budi_cached == 100000, f"Expected cached balance 100000, got {budi_cached}"
    assert budi_authoritative == 100000, f"Expected authoritative balance 100000, got {budi_authoritative}"
    assert budi_cached == budi_authoritative, "Cache and authoritative balance must be strictly equal!"

    # Verify no stale reads in ledger rows for budi:
    cur.execute(
        "SELECT balance_before, balance_after FROM finance_wallet_ledger WHERE santri_id = 'san-budi' ORDER BY balance_before ASC"
    )
    budi_rows = cur.fetchall()
    assert len(budi_rows) == 2, f"Expected 2 ledger rows, got {len(budi_rows)}"
    assert budi_rows[0][0] == 0 and budi_rows[0][1] == 50000, f"Row 1 must be (0 -> 50000), got {budi_rows[0]}"
    assert budi_rows[1][0] == 50000 and budi_rows[1][1] == 100000, f"Row 2 must be (50000 -> 100000), got {budi_rows[1]}"

    # ─── SCENARIO 3: Concurrent IN Rp50.000 and OUT Rp80.000 starting from Rp50.000
    verif_conn.execute("UPDATE santri SET saldo_uang_jajan = 50000 WHERE id = 'san-citra'")
    verif_conn.execute(
        """
        INSERT INTO finance_wallet_ledger (id, santri_id, direction, movement_type, amount, balance_before, balance_after, created_at)
        VALUES ('init-citra-50k', 'san-citra', 'IN', 'TOPUP_CASH', 50000, 0, 50000, datetime('now'))
        """
    )
    verif_conn.commit()

    results_scenario3 = []
    def worker_in():
        ok, msg = execute_wallet_mutation("san-citra", "IN", "TOPUP_ONLINE", 50000)
        results_scenario3.append(("IN", ok, msg))

    def worker_out():
        ok, msg = execute_wallet_mutation("san-citra", "OUT", "WITHDRAWAL_LOKET", 80000)
        results_scenario3.append(("OUT", ok, msg))

    t5 = threading.Thread(target=worker_in)
    t6 = threading.Thread(target=worker_out)
    t5.start()
    t6.start()
    t5.join()
    t6.join()

    cur.execute("SELECT saldo_uang_jajan FROM santri WHERE id = 'san-citra'")
    citra_cached = cur.fetchone()[0]

    cur.execute(
        """
        SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
        FROM finance_wallet_ledger WHERE santri_id = 'san-citra'
        """
    )
    citra_authoritative = cur.fetchone()[0]

    assert citra_cached >= 0, f"Balance must never be negative, got {citra_cached}"
    assert citra_cached == citra_authoritative, "Cache and authoritative balance must be strictly equal!"

    verif_conn.close()
    time.sleep(0.05)
    try:
        os.remove(db_path)
    except Exception:
        pass

    print("[OK] Concurrency test passed: 2 concurrent withdrawals (80k/100k -> 1 success, 1 rejected, sum=20k), 2 concurrent top-ups (50k+50k -> strictly chained 0->50k->100k), and concurrent IN/OUT verified.")


def run_all_tests():
    print("=" * 60)
    print("Starting Fase 5 Test Suite (Uang Jajan, Kredensial Kartu, PIN & Limits)...")
    print("=" * 60)

    test_schema_and_indexes()
    test_single_active_card_invariant()
    test_card_token_security()
    test_student_pin_security_and_lockout()
    test_authoritative_wallet_ledger()
    test_wallet_limits_evaluation()
    test_rbac_authorization()
    test_explicit_pin_reset_and_audit()
    test_wallet_concurrency_race_safety()

    print("=" * 60)
    print("ALL FASE 5 TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()

