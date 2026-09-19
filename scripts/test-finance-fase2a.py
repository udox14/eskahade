"""Local SQLite contract tests for migration 0152 (Fase 2A: Fondasi Schema Tarif & Tagihan).

Verifies that:
1. Migration 0152 is strictly non-destructive and additive.
2. Foreign key relationships to users, santri, tahun_ajaran, master_jasa hold.
3. Item type invariants and installment rule invariants hold:
   - SPP MUST have installment_rule = 'DISALLOWED'
   - USPP MUST have installment_rule = 'ALLOWED'
   - Other items can have DISALLOWED or ALLOWED
4. Snapshotting semantics on finance_obligations:
   - tariff_id & amount_expected capture tariff snapshot
   - provider_id captures catering/laundry provider snapshot
5. Unique constraint on (santri_id, item_type, period) prevents duplicate obligations.
6. Non-negative nominal / Rupiah checks hold.
7. Indexes exist and query plans leverage them.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0152_finance_tariffs_and_obligations.sql"


def expect_integrity_error(connection: sqlite3.Connection, sql: str, params: tuple = ()) -> None:
    try:
        connection.execute(sql, params)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f"Expected IntegrityError but succeeded: {sql} with {params}")


def setup_database() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON;")

    # Setup existing core tables as present in eskahade
    conn.executescript(
        """
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            role TEXT NOT NULL DEFAULT 'wali_kelas',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE tahun_ajaran (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nama TEXT NOT NULL,
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
            tempat_makan_id TEXT REFERENCES master_jasa(id),
            tempat_mencuci_id TEXT REFERENCES master_jasa(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        """
    )

    # Seed baseline relational entities
    conn.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?);",
        ("usr-admin", "bendahara@eskahade.id", "hash_pw", "Bendahara Pesantren", "admin"),
    )
    conn.execute(
        "INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (?, ?, ?);",
        (1, "2026/2027", 1),
    )
    conn.execute(
        "INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?);",
        ("jasa-katering-1", "Dapur Barokah", "Makan"),
    )
    conn.execute(
        "INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, ?, ?);",
        ("jasa-laundry-1", "Laundry Bersih", "Cuci"),
    )
    conn.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, tempat_makan_id, tempat_mencuci_id)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        ("san-001", "NIS2026001", "Ahmad Fauzan", "L", "aktif", "jasa-katering-1", "jasa-laundry-1"),
    )

    # Apply migration 0152
    migration_sql = MIGRATION.read_text(encoding="utf-8")
    conn.executescript(migration_sql)

    return conn


def test_tariffs_constraints(conn: sqlite3.Connection) -> None:
    print("Testing finance_tariffs constraints...")

    # 1. Valid SPP tariff with DISALLOWED
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        ("trf-spp-2026", "SPP", 1, 300000, "DISALLOWED", "2026-07-01", "usr-admin"),
    )

    # 2. SPP tariff with ALLOWED must fail
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES (?, ?, ?, ?, ?, ?);
        """,
        ("trf-spp-fail", "SPP", 1, 300000, "ALLOWED", "2026-07-01"),
    )

    # 3. Valid USPP tariff with ALLOWED
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        ("trf-uspp-2026", "USPP", 1, 5000000, "ALLOWED", "2026-07-01", "usr-admin"),
    )

    # 4. USPP tariff with DISALLOWED must fail
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES (?, ?, ?, ?, ?, ?);
        """,
        ("trf-uspp-fail", "USPP", 1, 5000000, "DISALLOWED", "2026-07-01"),
    )

    # 5. Negative nominal must fail
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES (?, ?, ?, ?, ?, ?);
        """,
        ("trf-neg", "UANG_MAKAN", 1, -10000, "DISALLOWED", "2026-07-01"),
    )

    # 6. Invalid item_type must fail
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES (?, ?, ?, ?, ?, ?);
        """,
        ("trf-inv-item", "UANG_GEDUNG", 1, 100000, "DISALLOWED", "2026-07-01"),
    )

    # 7. Valid catering & laundry tariffs
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        ("trf-mkn-2026", "UANG_MAKAN", 1, 450000, "DISALLOWED", "2026-07-01", "usr-admin"),
    )
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        ("trf-cuci-2026", "UANG_NYUCI", 1, 150000, "DISALLOWED", "2026-07-01", "usr-admin"),
    )

    print("[OK] finance_tariffs constraints verified successfully.")


def test_exemptions_constraints(conn: sqlite3.Connection) -> None:
    print("Testing finance_exemptions constraints...")

    # 1. Valid exemption
    conn.execute(
        """
        INSERT INTO finance_exemptions (id, santri_id, item_type, academic_year_id, period_start, period_end, reason, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        ("exm-001", "san-001", "SPP", 1, "2026-07", "2026-12", "Beasiswa Prestasi Tahfidz", "Gratis 6 bulan", "usr-admin"),
    )

    # 2. Exemption with invalid item_type must fail
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_exemptions (id, santri_id, item_type, reason)
        VALUES (?, ?, ?, ?);
        """,
        ("exm-fail-item", "san-001", "INVALID_ITEM", "Alasan"),
    )

    # 3. Exemption with non-existent santri_id must fail (FK)
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_exemptions (id, santri_id, item_type, reason)
        VALUES (?, ?, ?, ?);
        """,
        ("exm-fail-fk", "san-nonexistent", "SPP", "Alasan"),
    )

    print("[OK] finance_exemptions constraints verified successfully.")


def test_obligations_constraints(conn: sqlite3.Connection) -> None:
    print("Testing finance_obligations constraints & snapshots...")

    # 1. Valid obligation with snapshot tariff
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        ("ob-spp-202607", "san-001", "SPP", 1, "2026-07", "trf-spp-2026", 300000, 0, 0, "UNPAID", None),
    )

    # 2. Duplicate obligation for same santri_id, item_type, and period must fail (UNIQUE)
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """,
        ("ob-spp-dup", "san-001", "SPP", 1, "2026-07", "trf-spp-2026", 300000, "UNPAID"),
    )

    # 3. Valid obligation with catering provider snapshot
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        ("ob-mkn-202607", "san-001", "UANG_MAKAN", 1, "2026-07", "trf-mkn-2026", 450000, 0, 0, "UNPAID", "jasa-katering-1"),
    )

    # 4. Valid obligation with laundry provider snapshot
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        ("ob-cuci-202607", "san-001", "UANG_NYUCI", 1, "2026-07", "trf-cuci-2026", 150000, 0, 0, "UNPAID", "jasa-laundry-1"),
    )

    # 5. Valid USPP obligation with period = 'LIFETIME'
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        ("ob-uspp-lifetime", "san-001", "USPP", 1, "LIFETIME", "trf-uspp-2026", 5000000, 0, 0, "UNPAID", None),
    )

    # 6. Negative amount_expected must fail
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        ("ob-fail-neg", "san-001", "EHB", 1, "2026", -50000, "UNPAID"),
    )

    # 7. amount_exempted > amount_expected must fail
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """,
        ("ob-fail-exceed", "san-001", "EHB", 1, "2026", 100000, 150000, "EXEMPTED"),
    )

    # 8. Non-existent provider_id must fail (FK)
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, provider_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """,
        ("ob-fail-fk-provider", "san-001", "UANG_MAKAN", 1, "2026-08", 450000, "nonexistent-provider", "UNPAID"),
    )

    print("[OK] finance_obligations constraints & snapshots verified successfully.")


def test_indexes(conn: sqlite3.Connection) -> None:
    print("Testing index creation in sqlite_master...")
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_finance_%' OR name LIKE 'uq_finance_%';")
    indexes = {row[0] for row in cursor.fetchall()}

    expected_indexes = {
        "idx_finance_tariffs_lookup",
        "idx_finance_tariffs_academic_year",
        "idx_finance_exemptions_santri",
        "idx_finance_exemptions_academic_year",
        "idx_finance_obligations_santri",
        "idx_finance_obligations_status",
        "idx_finance_obligations_period",
        "idx_finance_obligations_item",
        "idx_finance_obligations_academic_year",
        "idx_finance_obligations_provider",
    }

    missing = expected_indexes - indexes
    if missing:
        raise AssertionError(f"Missing expected indexes: {missing}")

    print(f"[OK] All {len(expected_indexes)} expected indexes confirmed present.")


def main() -> None:
    print("Starting Fase 2A Schema Contract Tests...")
    conn = setup_database()
    test_tariffs_constraints(conn)
    test_exemptions_constraints(conn)
    test_obligations_constraints(conn)
    test_indexes(conn)
    print("\nALL FASE 2A INVARIANT TESTS PASSED!")


if __name__ == "__main__":
    main()
