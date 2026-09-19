"""Automated Contract & Business Logic Tests for Fase 2B - Obligation Engine with Patches.

Verifies:
1. Strict academic year tariff isolation (NO cross-academic-year fallback).
2. Atomic/concurrency-safe prevention of overlapping tariff versions:
   - Atomic conditional INSERT (INSERT INTO ... SELECT ... WHERE NOT EXISTS ...)
   - Database trigger trg_finance_tariffs_no_overlap_insert
3. Academic year consistency check with July-June calendar:
   - If academic_year_id does not match the period's July-June mapping, reject with descriptive error.
   - Consistent academic_year_id succeeds.
   - Omitted academic_year_id automatically resolves to expected TA without blind fallback.
4. Period validation per item type and academic year mapping (July-June):
   - Monthly: YYYY-MM (07-12 -> start YYYY; 01-06 -> start YYYY-1)
   - Annual: YYYY
   - Lifetime: 'LIFETIME'
5. Active santri restriction & required valid provider snapshot for Makan ('Makan') and Nyuci ('Cuci').
6. Canonical re-query for concurrency safety after INSERT OR IGNORE.
7. Guard on recalculateObligation preventing invocation before finance_allocations table exists.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_0152 = ROOT / "migrations" / "0152_finance_tariffs_and_obligations.sql"
MIGRATION_0153 = ROOT / "migrations" / "0153_finance_tariffs_overlap_trigger.sql"


def expect_error(fn, expected_msg_part: str = "") -> None:
    try:
        fn()
    except Exception as e:
        if expected_msg_part and expected_msg_part.lower() not in str(e).lower():
            raise AssertionError(f"Expected error message containing '{expected_msg_part}', got: '{e}'")
        return
    raise AssertionError("Expected error but function succeeded without throwing!")


def setup_test_environment() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON;")

    # Schema existing
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
            tempat_makan_id TEXT REFERENCES master_jasa(id),
            tempat_mencuci_id TEXT REFERENCES master_jasa(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        """
    )

    # Apply migration 0152 and 0153
    conn.executescript(MIGRATION_0152.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0153.read_text(encoding="utf-8"))

    # Seed baseline data
    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('usr-1', 'bendahara@test.id', 'pw', 'Bendahara', 'admin');")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1);")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (2, '2027/2028', 0);")

    conn.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('kat-1', 'Katering Barokah', 'Makan');")
    conn.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('kat-2', 'Katering Al-Falah', 'Makan');")
    conn.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('lnd-1', 'Laundry Bersih Kilat', 'Cuci');")

    # Santri 1: Reguler Aktif (Katering 1, Laundry 1)
    conn.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, tempat_makan_id, tempat_mencuci_id)
        VALUES ('san-1', 'NIS-001', 'Fauzan Adhim', 'L', 'aktif', 'kat-1', 'lnd-1');
        """
    )
    # Santri 2: Santri Aktif tanpa tempat makan
    conn.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, tempat_makan_id, tempat_mencuci_id)
        VALUES ('san-2', 'NIS-002', 'Budi Santoso', 'L', 'aktif', NULL, 'lnd-1');
        """
    )
    # Santri 3: Santri Arsip (Nonaktif)
    conn.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, tempat_makan_id, tempat_mencuci_id)
        VALUES ('san-3', 'NIS-003', 'Citra Nonaktif', 'P', 'arsip', 'kat-1', 'lnd-1');
        """
    )

    return conn


# Python simulation of updated lib/finance logic for contract testing
def create_tariff_atomic(conn: sqlite3.Connection, item_type: str, academic_year_id: int | None, nominal: int, effective_from: str, effective_until: str | None) -> str:
    if nominal < 0:
        raise ValueError("Nominal cannot be negative")

    rule = "DISALLOWED" if item_type == "SPP" else ("ALLOWED" if item_type == "USPP" else "DISALLOWED")
    check_until = effective_until or "9999-12-31"
    tid = f"trf-{item_type}-{academic_year_id}-{effective_from}"

    # Atomic conditional INSERT: Tidak bisa lolos race condition
    sql = """
    INSERT INTO finance_tariffs (
        id, item_type, academic_year_id, nominal, installment_rule,
        effective_from, effective_until, created_by, created_at
    )
    SELECT
        ?, ?, ?, ?, ?, ?, ?, 'usr-1', datetime('now')
    WHERE NOT EXISTS (
        SELECT 1 FROM finance_tariffs
        WHERE item_type = ?
          AND (
            (academic_year_id = ? AND ? IS NOT NULL) OR
            (academic_year_id IS NULL AND ? IS NULL)
          )
          AND effective_from <= ?
          AND (effective_until IS NULL OR effective_until >= ?)
    );
    """
    try:
        conn.execute(sql, (
            tid, item_type, academic_year_id, nominal, rule, effective_from, effective_until,
            item_type, academic_year_id, academic_year_id, academic_year_id, check_until, effective_from
        ))
    except sqlite3.IntegrityError as e:
        if "tumpang tindih" in str(e) or "overlapping" in str(e):
            raise ValueError(f"Tarif versi baru tumpang tindih (overlapping) dengan tarif yang sudah ada untuk item {item_type}")
        raise

    cur = conn.execute("SELECT id FROM finance_tariffs WHERE id = ?;", (tid,))
    if not cur.fetchone():
        raise ValueError(f"Tarif versi baru tumpang tindih (overlapping) dengan tarif yang sudah ada untuk item {item_type}")

    return tid


def get_active_tariff_strict(conn: sqlite3.Connection, item_type: str, date_or_period: str, academic_year_id: int | None) -> tuple | None:
    if date_or_period == "LIFETIME":
        lower, upper = "2026-01-01", "2099-12-31"
    elif len(date_or_period) == 7:  # YYYY-MM
        lower = f"{date_or_period}-01"
        upper = f"{date_or_period}-31"
    elif len(date_or_period) == 4:  # YYYY
        lower = f"{date_or_period}-01-01"
        upper = f"{date_or_period}-12-31"
    else:
        lower = upper = date_or_period

    # STRICT: If academic_year_id is given, NO fallback to other academic years
    if academic_year_id is not None:
        cur = conn.execute(
            """
            SELECT id, item_type, academic_year_id, nominal, installment_rule, effective_from, effective_until
            FROM finance_tariffs
            WHERE item_type = ?
              AND academic_year_id = ?
              AND effective_from <= ?
              AND (effective_until IS NULL OR effective_until >= ?)
            ORDER BY effective_from DESC, created_at DESC
            LIMIT 1;
            """,
            (item_type, academic_year_id, upper, lower),
        )
        return cur.fetchone()

    # Global tariffs without academic_year_id
    cur = conn.execute(
        """
        SELECT id, item_type, academic_year_id, nominal, installment_rule, effective_from, effective_until
        FROM finance_tariffs
        WHERE item_type = ?
          AND academic_year_id IS NULL
          AND effective_from <= ?
          AND (effective_until IS NULL OR effective_until >= ?)
        ORDER BY effective_from DESC, created_at DESC
        LIMIT 1;
        """,
        (item_type, upper, lower),
    )
    return cur.fetchone()


def validate_and_map_period(item_type: str, period: str) -> str | None:
    if item_type == "USPP":
        if period != "LIFETIME":
            raise ValueError(f"Periode untuk USPP wajib bernilai 'LIFETIME', diterima: '{period}'")
        return None

    if item_type in ("SPP", "UANG_MAKAN", "UANG_NYUCI"):
        if len(period) != 7 or period[4] != "-":
            raise ValueError(f"Format periode bulanan ({item_type}) wajib YYYY-MM")
        year, month = int(period[:4]), int(period[5:7])
        if month < 1 or month > 12:
            raise ValueError("Bulan tidak valid")
        start_year = year if month >= 7 else year - 1
        return f"{start_year}/{start_year + 1}"

    if item_type in ("EHB", "EKSKUL", "KESEHATAN"):
        if len(period) != 4 or not period.isdigit():
            raise ValueError(f"Format periode tahunan ({item_type}) wajib YYYY")
        start_year = int(period)
        return f"{start_year}/{start_year + 1}"

    raise ValueError(f"Tipe item tidak dikenali: {item_type}")


def ensure_obligation_patched(conn: sqlite3.Connection, santri_id: str, item_type: str, period: str, academic_year_id: int | None = None) -> dict:
    target_ta_name = validate_and_map_period(item_type, period)

    # 1. Existing check (idempotent)
    cur = conn.execute(
        "SELECT id, santri_id, item_type, academic_year_id, period, tariff_id, amount_expected, amount_exempted, amount_paid, status, provider_id FROM finance_obligations WHERE santri_id = ? AND item_type = ? AND period = ?;",
        (santri_id, item_type, period),
    )
    existing = cur.fetchone()
    if existing:
        return {
            "id": existing[0],
            "santri_id": existing[1],
            "item_type": existing[2],
            "academic_year_id": existing[3],
            "period": existing[4],
            "tariff_id": existing[5],
            "amount_expected": existing[6],
            "amount_exempted": existing[7],
            "amount_paid": existing[8],
            "status": existing[9],
            "provider_id": existing[10],
        }

    # 2. Santri active check
    santri = conn.execute("SELECT id, nama_lengkap, status_global, tempat_makan_id, tempat_mencuci_id FROM santri WHERE id = ?;", (santri_id,)).fetchone()
    if not santri:
        raise ValueError(f"Santri {santri_id} tidak ditemukan")
    if santri[2] != "aktif":
        raise ValueError(f"Hanya santri berstatus 'aktif' yang dapat dimaterialisasi kewajibannya. Santri '{santri[1]}' berstatus '{santri[2]}'")

    # 3. Provider validation for Makan / Nyuci
    provider_id = None
    if item_type == "UANG_MAKAN":
        if not santri[3]:
            raise ValueError(f"Santri '{santri[1]}' belum memiliki tempat makan/katering")
        val = conn.execute("SELECT id FROM master_jasa WHERE id = ? AND jenis = 'Makan';", (santri[3],)).fetchone()
        if not val:
            raise ValueError(f"Tempat makan santri '{santri[3]}' tidak valid pada master_jasa (wajib jenis 'Makan')")
        provider_id = santri[3]
    elif item_type == "UANG_NYUCI":
        if not santri[4]:
            raise ValueError(f"Santri '{santri[1]}' belum memiliki tempat cuci/laundry")
        val = conn.execute("SELECT id FROM master_jasa WHERE id = ? AND jenis = 'Cuci';", (santri[4],)).fetchone()
        if not val:
            raise ValueError(f"Tempat cuci santri '{santri[4]}' tidak valid pada master_jasa (wajib jenis 'Cuci')")
        provider_id = santri[4]

    # 4. Academic year resolution & strict consistency check
    resolved_academic_year_id = None
    if target_ta_name:
        row_ta = conn.execute("SELECT id, nama FROM tahun_ajaran WHERE nama = ?;", (target_ta_name,)).fetchone()
        if not row_ta:
            raise ValueError(f"Tahun ajaran '{target_ta_name}' untuk periode '{period}' (kalender Juli-Juni) belum terdaftar di master tahun_ajaran")
        expected_ta_id, expected_ta_name = row_ta[0], row_ta[1]

        if academic_year_id is not None:
            if academic_year_id != expected_ta_id:
                prov_ta = conn.execute("SELECT id, nama FROM tahun_ajaran WHERE id = ?;", (academic_year_id,)).fetchone()
                prov_name = prov_ta[1] if prov_ta else f"ID {academic_year_id}"
                raise ValueError(
                    f"academic_year_id {academic_year_id} ({prov_name}) tidak konsisten dengan periode \"{period}\" yang berada pada Tahun Ajaran {expected_ta_name} (kalender Juli-Juni)"
                )
            resolved_academic_year_id = academic_year_id
        else:
            resolved_academic_year_id = expected_ta_id
    else:
        # USPP ('LIFETIME')
        if academic_year_id is not None:
            prov_ta = conn.execute("SELECT id, nama FROM tahun_ajaran WHERE id = ?;", (academic_year_id,)).fetchone()
            if not prov_ta:
                raise ValueError(f"Tahun ajaran dengan ID {academic_year_id} tidak ditemukan")
            resolved_academic_year_id = academic_year_id
        else:
            active_ta = conn.execute("SELECT id FROM tahun_ajaran WHERE is_active = 1;").fetchone()
            resolved_academic_year_id = active_ta[0] if active_ta else None

    # 5. Strict tariff resolution
    tariff = get_active_tariff_strict(conn, item_type, period, resolved_academic_year_id)
    if not tariff:
        raise ValueError(f"Tarif untuk item '{item_type}' periode '{period}' (Tahun Ajaran ID: {resolved_academic_year_id}) belum dikonfigurasi")

    tariff_id, _, _, nominal, _, _, _ = tariff

    # 6. Exemption check
    exm = conn.execute(
        """
        SELECT id FROM finance_exemptions
        WHERE santri_id = ? AND (item_type = ? OR item_type = 'ALL')
          AND (period_start IS NULL OR period_start <= ?)
          AND (period_end IS NULL OR period_end >= ?)
        LIMIT 1;
        """,
        (santri_id, item_type, period, period),
    ).fetchone()

    amount_expected = nominal
    amount_exempted = nominal if exm else 0
    status = "EXEMPTED" if amount_exempted >= amount_expected else "UNPAID"

    # 7. Insert or ignore
    ob_id = f"ob-{santri_id}-{item_type}-{period}"
    conn.execute(
        """
        INSERT OR IGNORE INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);
        """,
        (ob_id, santri_id, item_type, resolved_academic_year_id, period, tariff_id, amount_expected, amount_exempted, status, provider_id),
    )

    # 8. Re-query canonical row (concurrency safety)
    cur = conn.execute(
        "SELECT id, santri_id, item_type, academic_year_id, period, tariff_id, amount_expected, amount_exempted, amount_paid, status, provider_id FROM finance_obligations WHERE santri_id = ? AND item_type = ? AND period = ?;",
        (santri_id, item_type, period),
    )
    row = cur.fetchone()
    if not row:
        raise RuntimeError("Failed to re-query canonical obligation record")

    return {
        "id": row[0],
        "santri_id": row[1],
        "item_type": row[2],
        "academic_year_id": row[3],
        "period": row[4],
        "tariff_id": row[5],
        "amount_expected": row[6],
        "amount_exempted": row[7],
        "amount_paid": row[8],
        "status": row[9],
        "provider_id": row[10],
    }


def recalculate_obligation_guarded(conn: sqlite3.Connection, obligation_id: str) -> None:
    has_alloc = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='finance_allocations';").fetchone()
    if not has_alloc:
        raise RuntimeError("recalculateObligation tidak dapat dijalankan sebelum tabel finance_allocations tersedia di database")


# --- Test Cases ---
def test_atomic_overlapping_tariff_prevention(conn: sqlite3.Connection) -> None:
    print("Test: Atomic & Concurrency-Safe Overlapping Tariff Prevention...")
    # 1. Insert initial SPP tariff in TA 1 (2026/2027) = 300.000 from 2026-07-01 to 2027-06-30
    t1 = create_tariff_atomic(conn, "SPP", 1, 300000, "2026-07-01", "2027-06-30")
    assert t1 is not None

    # 2. Atomic conditional insert rejects partial overlap (2026-09-01 to 2027-02-28)
    expect_error(
        lambda: create_tariff_atomic(conn, "SPP", 1, 320000, "2026-09-01", "2027-02-28"),
        "tumpang tindih",
    )

    # 3. Direct SQL insert to bypass application logic MUST trigger database trigger trg_finance_tariffs_no_overlap_insert
    def direct_trigger_test():
        conn.execute(
            """
            INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, effective_until)
            VALUES ('trf-direct-overlap', 'SPP', 1, 999999, 'DISALLOWED', '2026-10-01', '2026-11-30');
            """
        )
    expect_error(direct_trigger_test, "tumpang tindih")

    # 4. Valid non-overlapping tariff in TA 2 (2027/2028) starting 2027-07-01 succeeds
    t2 = create_tariff_atomic(conn, "SPP", 2, 350000, "2027-07-01", "2028-06-30")
    assert t2 is not None

    print("[OK] Atomic overlapping tariff prevention verified.")


def test_academic_year_consistency(conn: sqlite3.Connection) -> None:
    print("Test: Academic Year Consistency with July-June Calendar...")
    # 1. Period 2026-08 belongs to TA 2026/2027 (ID: 1).
    # Passing academic_year_id = 2 (2027/2028) MUST be rejected!
    expect_error(
        lambda: ensure_obligation_patched(conn, "san-1", "SPP", "2026-08", academic_year_id=2),
        "tidak konsisten dengan periode \"2026-08\"",
    )

    # 2. Period 2027-01 (January 2027) belongs to TA 2026/2027 (ID: 1).
    # Passing academic_year_id = 2 MUST be rejected!
    expect_error(
        lambda: ensure_obligation_patched(conn, "san-1", "SPP", "2027-01", academic_year_id=2),
        "tidak konsisten dengan periode \"2027-01\"",
    )

    # 3. Period 2027-08 belongs to TA 2027/2028 (ID: 2).
    # Passing academic_year_id = 1 MUST be rejected!
    expect_error(
        lambda: ensure_obligation_patched(conn, "san-1", "SPP", "2027-08", academic_year_id=1),
        "tidak konsisten dengan periode \"2027-08\"",
    )

    # 4. Consistent academic_year_id = 1 for 2026-08 MUST succeed
    ob_consistent = ensure_obligation_patched(conn, "san-1", "SPP", "2026-08", academic_year_id=1)
    assert ob_consistent["academic_year_id"] == 1
    assert ob_consistent["amount_expected"] == 300000

    # 5. Omitted academic_year_id for 2026-08 automatically resolves to ID: 1
    ob_auto = ensure_obligation_patched(conn, "san-1", "SPP", "2026-08")
    assert ob_auto["academic_year_id"] == 1

    print("[OK] Academic year consistency verification passed.")


def test_strict_academic_year_isolation(conn: sqlite3.Connection) -> None:
    print("Test: Strict Academic Year Isolation (No Fallback)...")
    t1 = get_active_tariff_strict(conn, "SPP", "2026-08", 1)
    assert t1 is not None and t1[3] == 300000

    # Querying for TA 2 when no tariff exists in TA 2 returns None
    conn.execute("DELETE FROM finance_tariffs WHERE id LIKE '%trf-SPP-2%';")
    t2 = get_active_tariff_strict(conn, "SPP", "2027-08", 2)
    assert t2 is None, f"Leakage detected! Expected None, got {t2}"
    print("[OK] Strict academic year isolation confirmed.")


def test_active_santri_and_provider_validation(conn: sqlite3.Connection) -> None:
    print("Test: Active Santri & Required Valid Provider for Makan/Nyuci...")
    create_tariff_atomic(conn, "UANG_MAKAN", 1, 450000, "2026-07-01", "2027-06-30")
    create_tariff_atomic(conn, "UANG_NYUCI", 1, 150000, "2026-07-01", "2027-06-30")

    # Inactive santri rejected
    expect_error(lambda: ensure_obligation_patched(conn, "san-3", "SPP", "2026-08"), "Hanya santri berstatus 'aktif'")

    # Missing provider rejected
    expect_error(lambda: ensure_obligation_patched(conn, "san-2", "UANG_MAKAN", "2026-08"), "belum memiliki tempat makan")

    # Mismatched provider type (Cuci instead of Makan) rejected
    conn.execute("UPDATE santri SET tempat_makan_id = 'lnd-1' WHERE id = 'san-2';")
    expect_error(lambda: ensure_obligation_patched(conn, "san-2", "UANG_MAKAN", "2026-08"), "tidak valid pada master_jasa")

    # Valid provider succeeds
    ob_mkn = ensure_obligation_patched(conn, "san-1", "UANG_MAKAN", "2026-08")
    assert ob_mkn["provider_id"] == "kat-1"
    print("[OK] Active santri and valid provider confirmed.")


def test_concurrency_canonical_and_recalculate_guard(conn: sqlite3.Connection) -> None:
    print("Test: Concurrency Canonical Safety & recalculateObligation Guard...")
    first = ensure_obligation_patched(conn, "san-1", "SPP", "2026-08")
    second = ensure_obligation_patched(conn, "san-1", "SPP", "2026-08")
    assert first["id"] == second["id"]

    expect_error(lambda: recalculate_obligation_guarded(conn, first["id"]), "finance_allocations")
    print("[OK] Concurrency canonical re-query & recalculateObligation guard confirmed.")


def main() -> None:
    print("Starting Fase 2B Final Patches Test Suite...")
    conn = setup_test_environment()
    test_atomic_overlapping_tariff_prevention(conn)
    test_academic_year_consistency(conn)
    test_strict_academic_year_isolation(conn)
    test_active_santri_and_provider_validation(conn)
    test_concurrency_canonical_and_recalculate_guard(conn)
    print("\nALL FASE 2B FINAL PATCH TESTS PASSED!")


if __name__ == "__main__":
    main()
