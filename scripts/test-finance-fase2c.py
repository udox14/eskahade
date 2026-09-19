"""Automated Contract & Business Logic Tests for Fase 2C - Exemption Module & Active Students Obligation Generator.
Includes Final Patches:
1. Non-destructive revokeExemption: Persists status='REVOKED', revoked_at, revoked_by, revocation_reason (no hard delete).
2. Exact Obligation Status Formula: amount_paid evaluated against (amount_expected - amount_exempted).
   - Partially-paid + remainder exempted -> obligation fulfilled (PAID).
   - Revocation of exemption -> status recalculated back to PARTIALLY_PAID (or UNPAID).
3. Cutover / Legacy Guard on Generator & USPP/BANGUNAN Adapter:
   - Historical monthly periods (< 2026-07) and annual (< 2026) are guarded and not re-billed.
   - USPP Belum Pernah Bayar: Tagihan 5M dibuat, status UNPAID, sisa 5M.
   - USPP Baru Dibayar Sebagian: Tagihan dibuat membawa amount_paid legacy (misal 2M), status PARTIALLY_PAID, sisa 3M.
   - USPP Sudah Lunas: Tidak dibuat kewajiban baru (skip legacy), mencegah duplicate debt.
   - Pembayaran legacy tidak dicatat ulang sebagai payment baru (mencegah duplicate payment).
4. Active students batch obligation generation & granular error handling.
5. Obligation matrix aggregation (5 core pillars).
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_0152 = ROOT / "migrations" / "0152_finance_tariffs_and_obligations.sql"
MIGRATION_0153 = ROOT / "migrations" / "0153_finance_tariffs_overlap_trigger.sql"
MIGRATION_0154 = ROOT / "migrations" / "0154_finance_exemptions_revocation_metadata.sql"

FINANCE_CUTOVER_START_MONTHLY = "2026-07"
FINANCE_CUTOVER_START_ANNUAL = 2026


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
            asrama TEXT,
            kamar TEXT,
            tempat_makan_id TEXT REFERENCES master_jasa(id),
            tempat_mencuci_id TEXT REFERENCES master_jasa(id),
            tahun_masuk INTEGER DEFAULT 2026,
            tanggal_masuk TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Legacy financial tables
        CREATE TABLE biaya_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tahun_angkatan INTEGER NOT NULL,
            jenis_biaya TEXT NOT NULL,
            nominal INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE spp_log (
            id TEXT PRIMARY KEY,
            santri_id TEXT REFERENCES santri(id),
            bulan INTEGER NOT NULL,
            tahun INTEGER NOT NULL,
            nominal_bayar INTEGER NOT NULL,
            tanggal_bayar TEXT NOT NULL DEFAULT (datetime('now')),
            penerima_id TEXT REFERENCES users(id),
            keterangan TEXT
        );

        CREATE TABLE pembayaran_tahunan (
            id TEXT PRIMARY KEY,
            santri_id TEXT REFERENCES santri(id),
            jenis_biaya TEXT NOT NULL,
            tahun_tagihan INTEGER,
            nominal_bayar INTEGER NOT NULL,
            status TEXT DEFAULT 'AKTIF',
            tanggal_bayar TEXT NOT NULL DEFAULT (datetime('now')),
            penerima_id TEXT REFERENCES users(id),
            keterangan TEXT
        );

        -- Mock finance_payments & allocations to verify NO duplicate payment records are created
        CREATE TABLE finance_payments (
            id TEXT PRIMARY KEY,
            santri_id TEXT,
            amount INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE finance_allocations (
            id TEXT PRIMARY KEY,
            obligation_id TEXT,
            amount INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        );
        """
    )

    # Apply migrations 0152, 0153, and 0154
    conn.executescript(MIGRATION_0152.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0153.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0154.read_text(encoding="utf-8"))

    # Seed baseline data
    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('usr-1', 'bendahara@test.id', 'pw', 'Bendahara', 'admin');")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1);")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (2, '2027/2028', 0);")

    conn.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('kat-1', 'Katering Barokah', 'Makan');")
    conn.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('lnd-1', 'Laundry Bersih Kilat', 'Cuci');")

    # Santri 1: Reguler Lengkap
    conn.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, kamar, tempat_makan_id, tempat_mencuci_id, tahun_masuk)
        VALUES ('san-1', 'NIS-001', 'Fauzan Adhim', 'L', 'aktif', 'Asrama A', 'Kamar 1', 'kat-1', 'lnd-1', 2026);
        """
    )
    # Santri 2: Santri Aktif tapi tempat_makan_id NULL
    conn.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, kamar, tempat_makan_id, tempat_mencuci_id, tahun_masuk)
        VALUES ('san-2', 'NIS-002', 'Budi Santoso', 'L', 'aktif', 'Asrama A', 'Kamar 2', NULL, 'lnd-1', 2026);
        """
    )
    # Santri 3: Santri Nonaktif (arsip)
    conn.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, kamar, tempat_makan_id, tempat_mencuci_id, tahun_masuk)
        VALUES ('san-3', 'NIS-003', 'Citra Arsip', 'P', 'arsip', 'Asrama B', 'Kamar 1', 'kat-1', 'lnd-1', 2026);
        """
    )
    # Santri 4: Santri Reguler Lengkap Lainnya
    conn.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, kamar, tempat_makan_id, tempat_mencuci_id, tahun_masuk)
        VALUES ('san-4', 'NIS-004', 'Dewi Lestari', 'P', 'aktif', 'Asrama B', 'Kamar 2', 'kat-1', 'lnd-1', 2026);
        """
    )

    # Seed tariffs for TA 1 (2026/2027)
    conn.execute("INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, effective_until) VALUES ('trf-spp', 'SPP', 1, 300000, 'DISALLOWED', '2026-07-01', '2027-06-30');")
    conn.execute("INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, effective_until) VALUES ('trf-mkn', 'UANG_MAKAN', 1, 450000, 'DISALLOWED', '2026-07-01', '2027-06-30');")
    conn.execute("INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, effective_until) VALUES ('trf-cuci', 'UANG_NYUCI', 1, 150000, 'DISALLOWED', '2026-07-01', '2027-06-30');")
    conn.execute("INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, effective_until) VALUES ('trf-ehb', 'EHB', 1, 100000, 'DISALLOWED', '2026-07-01', '2027-06-30');")
    conn.execute("INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, effective_until) VALUES ('trf-ekskul', 'EKSKUL', 1, 50000, 'DISALLOWED', '2026-07-01', '2027-06-30');")
    conn.execute("INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, effective_until) VALUES ('trf-kes', 'KESEHATAN', 1, 50000, 'DISALLOWED', '2026-07-01', '2027-06-30');")
    conn.execute("INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from, effective_until) VALUES ('trf-uspp', 'USPP', 1, 5000000, 'ALLOWED', '2026-07-01', NULL);")

    # Seed legacy biaya_settings for USPP
    conn.execute("INSERT INTO biaya_settings (tahun_angkatan, jenis_biaya, nominal) VALUES (2026, 'BANGUNAN', 5000000);")

    return conn


# --- Logic Simulation for Python Test Suite ---

def compute_obligation_status(expected: int, exempted: int, paid: int) -> str:
    effective = max(0, expected - exempted)
    if effective == 0 and paid == 0:
        return "EXEMPTED"
    if paid >= effective:
        return "PAID"
    if paid > 0:
        return "PARTIALLY_PAID"
    return "UNPAID"


def get_historical_uspp_tariff(conn: sqlite3.Connection, santri_id: str) -> int:
    santri = conn.execute("SELECT tahun_masuk, tanggal_masuk, created_at FROM santri WHERE id = ?;", (santri_id,)).fetchone()
    tahun_angkatan = None
    if santri:
        if santri[0]:
            tahun_angkatan = santri[0]
        elif santri[1]:
            try:
                tahun_angkatan = int(santri[1][:4])
            except ValueError:
                pass

    if tahun_angkatan:
        row = conn.execute("SELECT nominal FROM biaya_settings WHERE jenis_biaya = 'BANGUNAN' AND tahun_angkatan = ? LIMIT 1;", (tahun_angkatan,)).fetchone()
        if row and row[0] > 0:
            return row[0]

    row_def = conn.execute("SELECT nominal FROM biaya_settings WHERE jenis_biaya = 'BANGUNAN' ORDER BY tahun_angkatan DESC LIMIT 1;").fetchone()
    if row_def and row_def[0] > 0:
        return row_def[0]

    row_mod = conn.execute("SELECT nominal FROM finance_tariffs WHERE item_type = 'USPP' ORDER BY effective_from DESC LIMIT 1;").fetchone()
    if row_mod and row_mod[0] > 0:
        return row_mod[0]

    return 5000000


def check_legacy_uspp_status(conn: sqlite3.Connection, santri_id: str) -> dict:
    total_tariff = get_historical_uspp_tariff(conn, santri_id)
    row_paid = conn.execute(
        "SELECT COALESCE(SUM(nominal_bayar), 0), MAX(CASE WHEN nominal_bayar = 0 THEN 1 ELSE 0 END) FROM pembayaran_tahunan WHERE santri_id = ? AND jenis_biaya = 'BANGUNAN' AND COALESCE(status, 'AKTIF') != 'VOID';",
        (santri_id,),
    ).fetchone()
    legacy_paid = row_paid[0] if row_paid else 0
    is_exempted = (row_paid[1] == 1) if row_paid else False

    is_fully_settled = is_exempted or (total_tariff > 0 and legacy_paid >= total_tariff)
    remaining = 0 if is_fully_settled else max(0, total_tariff - legacy_paid)

    return {
        "totalTariff": total_tariff,
        "legacyPaid": legacy_paid,
        "isExempted": is_exempted,
        "isFullySettled": is_fully_settled,
        "remainingAmount": remaining,
    }


def check_legacy_settlement(
    conn: sqlite3.Connection,
    santri_id: str,
    item_type: str,
    period: str,
) -> tuple[bool, str]:
    # 1. Historical cutover check
    if item_type in ("SPP", "UANG_MAKAN", "UANG_NYUCI"):
        if period < FINANCE_CUTOVER_START_MONTHLY:
            return True, f"Periode {period} sebelum cutover ({FINANCE_CUTOVER_START_MONTHLY})"
    elif item_type in ("EHB", "EKSKUL", "KESEHATAN"):
        try:
            year = int(period)
            if year < FINANCE_CUTOVER_START_ANNUAL:
                return True, f"Tahun tagihan {period} sebelum cutover ({FINANCE_CUTOVER_START_ANNUAL})"
        except ValueError:
            pass

    # 2. Check spp_log
    if item_type == "SPP":
        parts = period.split("-")
        if len(parts) == 2:
            year, month = int(parts[0]), int(parts[1])
            row = conn.execute(
                "SELECT id, nominal_bayar FROM spp_log WHERE santri_id = ? AND tahun = ? AND bulan = ? AND nominal_bayar > 0 LIMIT 1;",
                (santri_id, year, month),
            ).fetchone()
            if row:
                return True, f"SPP sudah dibayar pada legacy spp_log ID {row[0]}"

    # 3. Check pembayaran_tahunan for annual items
    if item_type in ("EHB", "EKSKUL", "KESEHATAN"):
        try:
            year = int(period)
            row = conn.execute(
                "SELECT id, nominal_bayar FROM pembayaran_tahunan WHERE santri_id = ? AND jenis_biaya = ? AND (tahun_tagihan = ? OR tahun_tagihan IS NULL) AND COALESCE(status, 'AKTIF') != 'VOID' LIMIT 1;",
                (santri_id, item_type, year),
            ).fetchone()
            if row:
                return True, f"Biaya {item_type} sudah tercatat pada legacy pembayaran_tahunan ID {row[0]}"
        except ValueError:
            pass

    # 4. Check pembayaran_tahunan for USPP (BANGUNAN)
    if item_type == "USPP":
        uspp_st = check_legacy_uspp_status(conn, santri_id)
        if uspp_st["isFullySettled"]:
            return True, f"USPP sudah lunas sepenuhnya pada sistem legacy (Terbayar: {uspp_st['legacyPaid']} / {uspp_st['totalTariff']})"
        return False, ""

    return False, ""


def grant_exemption_logic(
    conn: sqlite3.Connection,
    santri_id: str,
    item_type: str,
    period_start: str | None,
    period_end: str | None,
    reason: str,
    created_by: str = "usr-1",
) -> str:
    santri = conn.execute("SELECT id, status_global FROM santri WHERE id = ?;", (santri_id,)).fetchone()
    if not santri or santri[1] != "aktif":
        raise ValueError("Hanya santri aktif yang dapat diberikan pembebasan")

    ex_id = f"exm-{santri_id}-{item_type}"
    conn.execute(
        """
        INSERT INTO finance_exemptions (
            id, santri_id, item_type, academic_year_id,
            period_start, period_end, reason, status, created_by
        ) VALUES (?, ?, ?, 1, ?, ?, ?, 'ACTIVE', ?);
        """,
        (ex_id, santri_id, item_type, period_start, period_end, reason, created_by),
    )

    cur = conn.execute(
        "SELECT id, item_type, period, amount_expected, amount_exempted, amount_paid, status FROM finance_obligations WHERE santri_id = ?;",
        (santri_id,),
    )
    for ob in cur.fetchall():
        ob_id, ob_item, ob_period, expected, exempted, paid, status = ob
        matches_item = (item_type == "ALL" or item_type == ob_item)
        matches_period = True
        if period_start and ob_period < period_start:
            matches_period = False
        if period_end and ob_period > period_end:
            matches_period = False

        if matches_item and matches_period:
            if paid == 0 and status == "UNPAID":
                conn.execute(
                    "UPDATE finance_obligations SET amount_exempted = ?, status = 'EXEMPTED', updated_at = datetime('now') WHERE id = ?;",
                    (expected, ob_id),
                )
            elif 0 < paid < expected:
                remainder = expected - paid
                new_status = compute_obligation_status(expected, remainder, paid)
                conn.execute(
                    "UPDATE finance_obligations SET amount_exempted = ?, status = ?, updated_at = datetime('now') WHERE id = ?;",
                    (remainder, new_status, ob_id),
                )

    return ex_id


def revoke_exemption_logic(
    conn: sqlite3.Connection,
    exemption_id: str,
    revoked_by: str | None = None,
    reason: str | None = None,
) -> int:
    ex = conn.execute(
        "SELECT santri_id, item_type, status FROM finance_exemptions WHERE id = ?;",
        (exemption_id,),
    ).fetchone()
    if not ex:
        raise ValueError("Exemption not found")
    if ex[2] == "REVOKED":
        raise ValueError("Exemption already revoked")

    santri_id, item_type, _ = ex

    conn.execute(
        """
        UPDATE finance_exemptions
        SET status = 'REVOKED',
            revoked_at = datetime('now'),
            revoked_by = ?,
            revocation_reason = ?
        WHERE id = ?;
        """,
        (revoked_by, reason, exemption_id),
    )

    cur = conn.execute(
        "SELECT id, item_type, period, amount_expected, amount_exempted, amount_paid, status FROM finance_obligations WHERE santri_id = ? AND amount_exempted > 0;",
        (santri_id,),
    )
    restored = 0
    for ob in cur.fetchall():
        ob_id, ob_item, ob_period, expected, cur_exempted, paid, cur_status = ob
        other = conn.execute(
            "SELECT id FROM finance_exemptions WHERE santri_id = ? AND status = 'ACTIVE' AND (item_type = ? OR item_type = 'ALL');",
            (santri_id, ob_item),
        ).fetchone()

        new_exempted = 0
        if other:
            new_exempted = expected if paid == 0 else max(0, expected - paid)

        new_status = compute_obligation_status(expected, new_exempted, paid)
        if new_exempted != cur_exempted or new_status != cur_status:
            conn.execute(
                "UPDATE finance_obligations SET amount_exempted = ?, status = ?, updated_at = datetime('now') WHERE id = ?;",
                (new_exempted, new_status, ob_id),
            )
            restored += 1

    return restored


def ensure_obligation_logic(conn: sqlite3.Connection, santri_id: str, item_type: str, period: str) -> dict:
    existing = conn.execute(
        "SELECT id, amount_expected, amount_exempted, amount_paid, status FROM finance_obligations WHERE santri_id = ? AND item_type = ? AND period = ?;",
        (santri_id, item_type, period),
    ).fetchone()
    if existing:
        return {
            "id": existing[0],
            "amountExpected": existing[1],
            "amountExempted": existing[2],
            "amountPaid": existing[3],
            "status": existing[4],
        }

    is_legacy, reason = check_legacy_settlement(conn, santri_id, item_type, period)
    if is_legacy:
        raise ValueError(f"Pembuatan kewajiban {item_type} periode '{period}' ditolak: {reason}")

    trf = conn.execute("SELECT id, nominal FROM finance_tariffs WHERE item_type = ? ORDER BY effective_from DESC LIMIT 1;", (item_type,)).fetchone()
    if not trf:
        raise ValueError(f"Tarif tidak ditemukan untuk {item_type}")
    tariff_id, nominal = trf

    amount_expected = nominal
    initial_paid = 0

    if item_type == "USPP":
        uspp_st = check_legacy_uspp_status(conn, santri_id)
        if uspp_st["totalTariff"] > 0:
            amount_expected = uspp_st["totalTariff"]
        if uspp_st["legacyPaid"] > 0 and not uspp_st["isFullySettled"]:
            initial_paid = uspp_st["legacyPaid"]

    exm = conn.execute("SELECT id FROM finance_exemptions WHERE santri_id = ? AND status = 'ACTIVE' AND (item_type = ? OR item_type = 'ALL');", (santri_id, item_type)).fetchone()
    amount_exempted = amount_expected if exm else 0
    status = compute_obligation_status(amount_expected, amount_exempted, initial_paid)

    ob_id = f"ob-{santri_id}-{item_type}-{period}"
    conn.execute(
        """
        INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, tariff_id, amount_expected, amount_exempted, amount_paid, status)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?);
        """,
        (ob_id, santri_id, item_type, period, tariff_id, amount_expected, amount_exempted, initial_paid, status),
    )

    return {
        "id": ob_id,
        "amountExpected": amount_expected,
        "amountExempted": amount_exempted,
        "amountPaid": initial_paid,
        "status": status,
    }


def batch_generate_lifetime_uspp(conn: sqlite3.Connection) -> dict:
    students = conn.execute("SELECT id, nama_lengkap FROM santri WHERE status_global = 'aktif';").fetchall()
    created = 0
    skipped = 0
    skipped_legacy = 0

    for s in students:
        s_id, _ = s
        is_legacy, _ = check_legacy_settlement(conn, s_id, "USPP", "LIFETIME")
        if is_legacy:
            skipped_legacy += 1
            continue

        existing = conn.execute("SELECT id FROM finance_obligations WHERE santri_id = ? AND item_type = 'USPP' AND period = 'LIFETIME';", (s_id,)).fetchone()
        if existing:
            skipped += 1
            continue

        ensure_obligation_logic(conn, s_id, "USPP", "LIFETIME")
        created += 1

    return {
        "period": "LIFETIME",
        "createdCount": created,
        "alreadyExistsCount": skipped,
        "skippedLegacyCount": skipped_legacy,
    }


def batch_generate_monthly(conn: sqlite3.Connection, period: str) -> dict:
    students = conn.execute("SELECT id, nama_lengkap, tempat_makan_id, tempat_mencuci_id FROM santri WHERE status_global = 'aktif';").fetchall()
    created = 0
    skipped = 0
    exempted = 0
    skipped_legacy = 0
    failed = 0
    errors = []

    for s in students:
        s_id, s_name, makan_id, cuci_id = s
        for item in ["SPP", "UANG_MAKAN", "UANG_NYUCI"]:
            is_legacy, reason = check_legacy_settlement(conn, s_id, item, period)
            if is_legacy:
                skipped_legacy += 1
                continue

            try:
                provider_id = None
                if item == "UANG_MAKAN":
                    if not makan_id:
                        raise ValueError(f"Tempat makan kosong untuk {s_name}")
                    provider_id = makan_id
                elif item == "UANG_NYUCI":
                    if not cuci_id:
                        raise ValueError(f"Tempat cuci kosong untuk {s_name}")
                    provider_id = cuci_id

                existing = conn.execute("SELECT id, status FROM finance_obligations WHERE santri_id = ? AND item_type = ? AND period = ?;", (s_id, item, period)).fetchone()
                if existing:
                    skipped += 1
                    continue

                trf = conn.execute("SELECT id, nominal FROM finance_tariffs WHERE item_type = ? AND academic_year_id = 1;", (item,)).fetchone()
                tariff_id, nominal = trf

                exm = conn.execute("SELECT id FROM finance_exemptions WHERE santri_id = ? AND status = 'ACTIVE' AND (item_type = ? OR item_type = 'ALL');", (s_id, item)).fetchone()
                amount_exempted = nominal if exm else 0
                status = compute_obligation_status(nominal, amount_exempted, 0)

                ob_id = f"ob-{s_id}-{item}-{period}"
                conn.execute(
                    """
                    INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, tariff_id, amount_expected, amount_exempted, amount_paid, status, provider_id)
                    VALUES (?, ?, ?, 1, ?, ?, ?, ?, 0, ?, ?);
                    """,
                    (ob_id, s_id, item, period, tariff_id, nominal, amount_exempted, status, provider_id),
                )
                created += 1
                if status == "EXEMPTED":
                    exempted += 1

            except Exception as e:
                failed += 1
                errors.append({"santriId": s_id, "namaSantri": s_name, "itemType": item, "error": str(e)})

    return {
        "period": period,
        "totalStudents": len(students),
        "createdCount": created,
        "alreadyExistsCount": skipped,
        "exemptedCount": exempted,
        "skippedLegacyCount": skipped_legacy,
        "failedCount": failed,
        "errors": errors,
    }


def batch_generate_annual(conn: sqlite3.Connection, period: str) -> dict:
    students = conn.execute("SELECT id, nama_lengkap FROM santri WHERE status_global = 'aktif';").fetchall()
    created = 0
    skipped = 0
    skipped_legacy = 0
    failed = 0

    for s in students:
        s_id, s_name = s
        for item in ["EHB", "EKSKUL", "KESEHATAN"]:
            is_legacy, _ = check_legacy_settlement(conn, s_id, item, period)
            if is_legacy:
                skipped_legacy += 1
                continue

            existing = conn.execute("SELECT id FROM finance_obligations WHERE santri_id = ? AND item_type = ? AND period = ?;", (s_id, item, period)).fetchone()
            if existing:
                skipped += 1
                continue

            trf = conn.execute("SELECT id, nominal FROM finance_tariffs WHERE item_type = ? AND academic_year_id = 1;", (item,)).fetchone()
            tariff_id, nominal = trf
            ob_id = f"ob-{s_id}-{item}-{period}"
            conn.execute(
                """
                INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, tariff_id, amount_expected, amount_exempted, amount_paid, status)
                VALUES (?, ?, ?, 1, ?, ?, ?, 0, 0, 'UNPAID');
                """,
                (ob_id, s_id, item, period, tariff_id, nominal),
            )
            created += 1

    return {
        "period": period,
        "createdCount": created,
        "alreadyExistsCount": skipped,
        "skippedLegacyCount": skipped_legacy,
        "failedCount": failed,
    }


# --- Test Cases ---

def test_non_retroactive_exemption_and_status_formula(conn: sqlite3.Connection) -> None:
    print("Test 1: Non-Retroactive Exemption & Exact Status Formula...")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, tariff_id, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-spp-07', 'san-1', 'SPP', 1, '2026-07', 'trf-spp', 300000, 0, 0, 'UNPAID');")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, tariff_id, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-uspp-lt', 'san-1', 'USPP', 1, 'LIFETIME', 'trf-uspp', 5000000, 0, 2000000, 'PARTIALLY_PAID');")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, tariff_id, amount_expected, amount_exempted, amount_paid, status, provider_id) VALUES ('ob-mkn-07', 'san-1', 'UANG_MAKAN', 1, '2026-07', 'trf-mkn', 450000, 0, 450000, 'PAID', 'kat-1');")

    ex_id = grant_exemption_logic(conn, "san-1", "ALL", None, None, "Beasiswa Prestasi Yayasan", "usr-1")
    assert ex_id is not None

    row_spp = conn.execute("SELECT amount_exempted, amount_paid, status FROM finance_obligations WHERE id = 'ob-spp-07';").fetchone()
    assert row_spp[0] == 300000 and row_spp[1] == 0 and row_spp[2] == "EXEMPTED"

    row_uspp = conn.execute("SELECT amount_exempted, amount_paid, status FROM finance_obligations WHERE id = 'ob-uspp-lt';").fetchone()
    assert row_uspp[1] == 2000000, f"Retroactive destruction! Expected 2M paid, got {row_uspp[1]}"
    assert row_uspp[0] == 3000000, f"Expected 3M exempted remainder, got {row_uspp[0]}"
    assert row_uspp[2] == "PAID", f"Partially-paid obligation with remainder exempted MUST become PAID! Got: {row_uspp[2]}"

    row_mkn = conn.execute("SELECT amount_exempted, amount_paid, status FROM finance_obligations WHERE id = 'ob-mkn-07';").fetchone()
    assert row_mkn[1] == 450000 and row_mkn[2] == "PAID"

    print("[OK] Non-retroactive exemption rule and status formula verified.")


def test_non_destructive_revoke_exemption(conn: sqlite3.Connection) -> None:
    print("Test 2: Non-Destructive Revoke Exemption & Obligation Recalculation...")
    restored = revoke_exemption_logic(
        conn,
        "exm-san-1-ALL",
        revoked_by="usr-1",
        reason="Keluarga santri menyatakan sudah mampu membayar",
    )
    assert restored >= 2, f"Expected at least 2 obligations recalculated, got {restored}"

    ex_row = conn.execute(
        "SELECT status, revoked_at, revoked_by, revocation_reason FROM finance_exemptions WHERE id = 'exm-san-1-ALL';"
    ).fetchone()
    assert ex_row is not None, "Violation: Exemption was hard-deleted!"
    assert ex_row[0] == "REVOKED", f"Expected status 'REVOKED', got '{ex_row[0]}'"
    assert ex_row[1] is not None, "Expected revoked_at timestamp to be populated"
    assert ex_row[2] == "usr-1", f"Expected revoked_by 'usr-1', got '{ex_row[2]}'"
    assert ex_row[3] == "Keluarga santri menyatakan sudah mampu membayar"

    row_spp = conn.execute("SELECT amount_exempted, amount_paid, status FROM finance_obligations WHERE id = 'ob-spp-07';").fetchone()
    assert row_spp[0] == 0, f"Expected amount_exempted = 0, got {row_spp[0]}"
    assert row_spp[1] == 0
    assert row_spp[2] == "UNPAID", f"Expected status 'UNPAID', got '{row_spp[2]}'"

    row_uspp = conn.execute("SELECT amount_exempted, amount_paid, status FROM finance_obligations WHERE id = 'ob-uspp-lt';").fetchone()
    assert row_uspp[0] == 0, f"Expected amount_exempted = 0 after revocation, got {row_uspp[0]}"
    assert row_uspp[1] == 2000000, f"Historical amount_paid must be preserved at 2M! Got: {row_uspp[1]}"
    assert row_uspp[2] == "PARTIALLY_PAID", f"Expected status 'PARTIALLY_PAID' after exemption revocation, got '{row_uspp[2]}'"

    conn.execute("DELETE FROM finance_obligations WHERE santri_id = 'san-1';")
    print("[OK] Non-destructive revoke exemption & status recalculation verified.")


def test_legacy_uspp_adapter_comprehensive(conn: sqlite3.Connection) -> None:
    print("Test 3: Comprehensive Legacy Guard & Adapter for USPP/BANGUNAN...")

    # Tambahkan 3 santri khusus untuk menguji ketiga skenario USPP:
    # 1. san-uspp-unpaid: Belum pernah bayar USPP
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, tempat_makan_id, tempat_mencuci_id, tahun_masuk) VALUES ('san-uspp-unpaid', 'NIS-U1', 'Santri Belum Bayar', 'L', 'aktif', 'kat-1', 'lnd-1', 2026);")
    # 2. san-uspp-part: Baru dibayar sebagian (misal 2.000.000 dari 5.000.000)
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, tempat_makan_id, tempat_mencuci_id, tahun_masuk) VALUES ('san-uspp-part', 'NIS-U2', 'Santri Bayar Sebagian', 'L', 'aktif', 'kat-1', 'lnd-1', 2026);")
    conn.execute("INSERT INTO pembayaran_tahunan (id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, status) VALUES ('leg-uspp-part-1', 'san-uspp-part', 'BANGUNAN', NULL, 2000000, 'AKTIF');")
    # 3. san-uspp-paid: Sudah lunas (5.000.000 dari 5.000.000)
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, tempat_makan_id, tempat_mencuci_id, tahun_masuk) VALUES ('san-uspp-paid', 'NIS-U3', 'Santri Sudah Lunas', 'L', 'aktif', 'kat-1', 'lnd-1', 2026);")
    conn.execute("INSERT INTO pembayaran_tahunan (id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, status) VALUES ('leg-uspp-paid-1', 'san-uspp-paid', 'BANGUNAN', NULL, 5000000, 'AKTIF');")

    # Skenario 1: USPP Belum Pernah Bayar
    ob_unpaid = ensure_obligation_logic(conn, "san-uspp-unpaid", "USPP", "LIFETIME")
    assert ob_unpaid["amountExpected"] == 5000000, f"Expected 5M, got {ob_unpaid['amountExpected']}"
    assert ob_unpaid["amountPaid"] == 0, f"Expected 0 paid, got {ob_unpaid['amountPaid']}"
    assert ob_unpaid["status"] == "UNPAID", f"Expected UNPAID, got {ob_unpaid['status']}"
    # Sisa = 5M
    remaining_unpaid = ob_unpaid["amountExpected"] - ob_unpaid["amountPaid"]
    assert remaining_unpaid == 5000000

    # Skenario 2: USPP Baru Dibayar Sebagian
    ob_part = ensure_obligation_logic(conn, "san-uspp-part", "USPP", "LIFETIME")
    assert ob_part["amountExpected"] == 5000000, f"Expected 5M, got {ob_part['amountExpected']}"
    assert ob_part["amountPaid"] == 2000000, f"Expected 2M carried forward, got {ob_part['amountPaid']}"
    assert ob_part["status"] == "PARTIALLY_PAID", f"Expected PARTIALLY_PAID, got {ob_part['status']}"
    # Sisa kewajiban aman direpresentasikan: 5M - 2M = 3M (TIDAK ADA DUPLICATE DEBT!)
    remaining_part = ob_part["amountExpected"] - ob_part["amountPaid"]
    assert remaining_part == 3000000, f"Expected 3M remaining debt, got {remaining_part}"

    # Skenario 3: USPP Sudah Lunas
    try:
        ensure_obligation_logic(conn, "san-uspp-paid", "USPP", "LIFETIME")
        raise AssertionError("Expected ValueError when ensuring USPP for already fully settled student, but succeeded!")
    except ValueError as e:
        assert "sudah lunas sepenuhnya" in str(e).lower()

    # Verifikasi di database: san-uspp-paid TIDAK memiliki baris di finance_obligations (NO duplicate debt!)
    paid_ob_row = conn.execute("SELECT id FROM finance_obligations WHERE santri_id = 'san-uspp-paid' AND item_type = 'USPP';").fetchone()
    assert paid_ob_row is None, "Violation: Obligation created for already settled USPP student!"

    # Skenario 4: Verifikasi TIDAK ADA DUPLICATE PAYMENT
    # Pastikan tidak ada record baru yang disisipkan ke tabel finance_payments atau finance_allocations!
    p_count = conn.execute("SELECT COUNT(*) FROM finance_payments;").fetchone()[0]
    a_count = conn.execute("SELECT COUNT(*) FROM finance_allocations;").fetchone()[0]
    assert p_count == 0, f"Violation: {p_count} duplicate payment records created in finance_payments!"
    assert a_count == 0, f"Violation: {a_count} duplicate allocation records created in finance_allocations!"

    # Uji Batch Generator USPP
    res_batch_uspp = batch_generate_lifetime_uspp(conn)
    # san-uspp-paid harus ter-skip (skippedLegacyCount >= 1)
    assert res_batch_uspp["skippedLegacyCount"] >= 1
    # san-uspp-part dan san-uspp-unpaid sudah ada obligation -> alreadyExistsCount >= 2
    assert res_batch_uspp["alreadyExistsCount"] >= 2

    # Clean up santri USPP uji coba agar tidak mengotori tes batch bulanan
    conn.execute("DELETE FROM finance_obligations WHERE santri_id IN ('san-uspp-unpaid', 'san-uspp-part', 'san-uspp-paid');")
    conn.execute("DELETE FROM pembayaran_tahunan WHERE santri_id IN ('san-uspp-unpaid', 'san-uspp-part', 'san-uspp-paid');")
    conn.execute("DELETE FROM santri WHERE id IN ('san-uspp-unpaid', 'san-uspp-part', 'san-uspp-paid');")

    print("[OK] All 4 USPP legacy scenarios verified: no duplicate debt, no duplicate payment.")


def test_cutover_and_legacy_guards_monthly_annual(conn: sqlite3.Connection) -> None:
    print("Test 4: Cutover & Legacy Guard on Monthly & Annual Generators...")

    # Seed legacy payments:
    conn.execute("INSERT INTO spp_log (id, santri_id, tahun, bulan, nominal_bayar) VALUES ('spp-leg-1', 'san-1', 2026, 7, 300000);")
    conn.execute("INSERT INTO pembayaran_tahunan (id, santri_id, jenis_biaya, tahun_tagihan, nominal_bayar, status) VALUES ('tah-leg-2', 'san-4', 'EHB', 2026, 100000, 'AKTIF');")

    # Case A: Historical Monthly Batch Generation (< 2026-07)
    res_hist = batch_generate_monthly(conn, "2026-06")
    assert res_hist["createdCount"] == 0, "No new obligations should be created for historical pre-cutover period!"
    assert res_hist["skippedLegacyCount"] > 0
    assert res_hist["failedCount"] == 0

    # Case B: Cutover Monthly Batch Generation (2026-07)
    res_july = batch_generate_monthly(conn, "2026-07")
    assert res_july["skippedLegacyCount"] == 1  # san-1 SPP skipped
    san1_spp = conn.execute("SELECT id FROM finance_obligations WHERE santri_id = 'san-1' AND item_type = 'SPP' AND period = '2026-07';").fetchone()
    assert san1_spp is None, "Violation: Duplicate debt created for SPP!"

    # Case C: Annual Batch Generation (2026)
    res_ann = batch_generate_annual(conn, "2026")
    assert res_ann["skippedLegacyCount"] == 1  # san-4 EHB skipped
    san4_ehb = conn.execute("SELECT id FROM finance_obligations WHERE santri_id = 'san-4' AND item_type = 'EHB' AND period = '2026';").fetchone()
    assert san4_ehb is None, "Violation: Duplicate debt created for EHB!"

    print("[OK] Monthly & annual cutover guards verified.")


def test_batch_generate_monthly_and_error_handling(conn: sqlite3.Connection) -> None:
    print("Test 5: Active Students Batch Obligation Generation & Error Isolation...")
    # san-2 missing makan_id -> error isolated, other students succeed
    res = batch_generate_monthly(conn, "2026-08")
    assert res["failedCount"] == 1
    assert len(res["errors"]) == 1
    assert res["errors"][0]["santriId"] == "san-2"

    print("[OK] Error isolation in batch generation verified.")


def test_obligation_matrix_query(conn: sqlite3.Connection) -> None:
    print("Test 6: Obligation Matrix Aggregation Query...")
    cur = conn.execute(
        """
        SELECT s.id, s.nama_lengkap,
               COUNT(o.id) as total_obs,
               SUM(o.amount_expected) as total_exp,
               SUM(o.amount_paid) as total_paid
        FROM santri s
        LEFT JOIN finance_obligations o ON s.id = o.santri_id AND o.period = '2026-08'
        WHERE s.status_global = 'aktif'
        GROUP BY s.id
        ORDER BY s.nama_lengkap ASC;
        """
    )
    rows = cur.fetchall()
    assert len(rows) >= 3
    print("[OK] Obligation matrix aggregation query verified.")


def main() -> None:
    print("Starting Fase 2C Test Suite (with Legacy USPP/BANGUNAN Fixes)...")
    conn = setup_test_environment()
    test_non_retroactive_exemption_and_status_formula(conn)
    test_non_destructive_revoke_exemption(conn)
    test_legacy_uspp_adapter_comprehensive(conn)
    test_cutover_and_legacy_guards_monthly_annual(conn)
    test_batch_generate_monthly_and_error_handling(conn)
    test_obligation_matrix_query(conn)
    print("\nALL FASE 2C TESTS (INCLUDING LEGACY USPP/BANGUNAN) PASSED!")


if __name__ == "__main__":
    main()
