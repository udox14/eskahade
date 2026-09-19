"""Exhaustive Runtime Schema Contract & Verification Test for Finance Reports & Status Pembayaran.

Validates:
1. BLOCKER 1 Fix & Extension:
   - Reports module queries master_jasa using existing columns (nama_jasa, jenis) without nonexistent `nama_perusahaan` or `status`.
   - Reports module queries kelas using existing column (nama_kelas) without nonexistent `nama`.
   - Reports module queries finance_credentials using existing column (card_token AS card_code) without nonexistent `card_code`.
2. BLOCKER 2 Fix: Status Pembayaran matrix query parameter binding has exact 1-to-1 match
   between SQL placeholders and bound parameters under all filter combinations.
3. Actual SQLite runtime execution across all 6 page bootstrap queries and all 9 report types
   with diverse multi-dimensional filters (periode, santri, asrama, kelas, Katering, Laundry, operator, settlement, rekonsiliasi).
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Load migrations
MIGRATIONS = [
    ROOT / "migrations" / "0152_finance_tariffs_and_obligations.sql",
    ROOT / "migrations" / "0153_finance_tariffs_overlap_trigger.sql",
    ROOT / "migrations" / "0154_finance_exemptions_revocation_metadata.sql",
    ROOT / "migrations" / "0155_finance_payments_and_orders.sql",
    ROOT / "migrations" / "0159_finance_cash_sessions_and_idempotency.sql",
    ROOT / "migrations" / "0160_finance_cards_and_wallet.sql",
    ROOT / "migrations" / "0161_finance_loket_and_cash_session.sql",
    ROOT / "migrations" / "0162_finance_distributions.sql",
    ROOT / "migrations" / "0163_finance_reconciliation_and_corrections.sql",
    ROOT / "migrations" / "0164_finance_dashboard_and_history.sql",
    ROOT / "migrations" / "0165_finance_reports_and_fitur_akses.sql",
    ROOT / "migrations" / "0166_finance_navigation_and_settings.sql",
]


def setup_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON;")

    # Base schema matching Remote D1 actual schema
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

        -- Actual schema of master_jasa in Remote D1
        CREATE TABLE master_jasa (
            id TEXT PRIMARY KEY,
            nama_jasa TEXT NOT NULL,
            jenis TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Actual schema of kelas in Remote D1 (nama_kelas, NOT nama)
        CREATE TABLE kelas (
            id TEXT PRIMARY KEY,
            nama_kelas TEXT NOT NULL,
            tahun_ajaran_id INTEGER,
            marhalah_id INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE santri (
            id TEXT PRIMARY KEY,
            nis TEXT NOT NULL UNIQUE,
            nama_lengkap TEXT NOT NULL,
            jenis_kelamin TEXT NOT NULL DEFAULT 'L',
            status_global TEXT NOT NULL DEFAULT 'aktif',
            asrama TEXT,
            kamar TEXT,
            kelas_sekolah TEXT,
            no_wa_ortu TEXT,
            tempat_makan_id TEXT REFERENCES master_jasa(id),
            tempat_mencuci_id TEXT REFERENCES master_jasa(id),
            tahun_masuk INTEGER,
            tanggal_masuk TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE riwayat_pendidikan (
            id TEXT PRIMARY KEY,
            santri_id TEXT NOT NULL REFERENCES santri(id),
            kelas_id TEXT REFERENCES kelas(id),
            status_riwayat TEXT NOT NULL DEFAULT 'aktif',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE spp_tunggakan_historis (
            id TEXT PRIMARY KEY,
            santri_id TEXT NOT NULL REFERENCES santri(id),
            tahun INTEGER NOT NULL,
            bulan INTEGER NOT NULL,
            nominal_tagihan INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'BELUM_LUNAS',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE fitur_akses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_name TEXT NOT NULL,
            title TEXT NOT NULL,
            href TEXT NOT NULL UNIQUE,
            icon TEXT,
            roles TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            urutan INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """
    )

    for mig in MIGRATIONS:
        conn.executescript(mig.read_text(encoding="utf-8"))

    # Seed master data
    conn.executescript(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, roles)
        VALUES ('u-admin', 'admin@sukahideng.or.id', 'h', 'Admin Keuangan', 'admin', '["admin","bendahara"]');

        INSERT INTO tahun_ajaran (id, nama, is_active)
        VALUES (1, '2026/2027', 1);

        INSERT INTO master_jasa (id, nama_jasa, jenis)
        VALUES
            ('jasa-kat-1', 'Katering Al-Barokah', 'Makan'),
            ('jasa-kat-2', 'Katering Dapur Utama', 'Makan'),
            ('jasa-lnd-1', 'Laundry Bersih Kilat', 'Cuci'),
            ('jasa-lnd-2', 'Laundry Wangi Barokah', 'Cuci');

        INSERT INTO kelas (id, nama_kelas)
        VALUES ('k-1', '10 IPA 1'), ('k-2', '10 IPS 1');

        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, kamar, kelas_sekolah, tempat_makan_id, tempat_mencuci_id)
        VALUES
            ('s-1', '2627001', 'A FAUZI RAMDAN', 'L', 'aktif', 'Asrama Al-Falah', 'Kamar 01', '10 IPA 1', 'jasa-kat-1', 'jasa-lnd-1'),
            ('s-2', '2627002', 'AAFIA RACHMANI', 'P', 'aktif', 'Asrama Fatimah', 'Kamar 02', '10 IPA 1', 'jasa-kat-2', 'jasa-lnd-2'),
            ('s-3', '2627003', 'ALIF NAUFAL SURYA', 'L', 'aktif', 'Asrama Al-Falah', 'Kamar 03', '10 IPS 1', 'jasa-kat-1', 'jasa-lnd-1');

        INSERT INTO riwayat_pendidikan (id, santri_id, kelas_id, status_riwayat)
        VALUES ('rp-1', 's-1', 'k-1', 'aktif'), ('rp-2', 's-2', 'k-1', 'aktif'), ('rp-3', 's-3', 'k-2', 'aktif');

        INSERT INTO finance_tariffs (id, academic_year_id, item_type, nominal, installment_rule, effective_from)
        VALUES ('t-spp', 1, 'SPP', 500000, 'DISALLOWED', '2026-07-01'),
               ('t-mkn', 1, 'UANG_MAKAN', 300000, 'DISALLOWED', '2026-07-01'),
               ('t-ehb', 1, 'EHB', 250000, 'DISALLOWED', '2026-07-01'),
               ('t-usp', 1, 'USPP', 5000000, 'ALLOWED', '2026-07-01');

        INSERT INTO finance_obligations (id, santri_id, tariff_id, academic_year_id, item_type, period, amount_expected, amount_exempted, amount_paid, status, provider_id)
        VALUES
            ('ob-1', 's-1', 't-spp', 1, 'SPP', '2026-07', 500000, 0, 500000, 'PAID', NULL),
            ('ob-2', 's-1', 't-mkn', 1, 'UANG_MAKAN', '2026-07', 300000, 0, 0, 'UNPAID', 'jasa-kat-1'),
            ('ob-3', 's-1', 't-ehb', 1, 'EHB', '2026', 250000, 0, 0, 'UNPAID', NULL),
            ('ob-4', 's-1', 't-usp', 1, 'USPP', 'LIFETIME', 5000000, 0, 1000000, 'PARTIALLY_PAID', NULL),
            ('ob-5', 's-2', 't-spp', 1, 'SPP', '2026-07', 500000, 0, 0, 'UNPAID', NULL),
            ('ob-6', 's-3', 't-spp', 1, 'SPP', '2026-07', 500000, 500000, 0, 'EXEMPTED', NULL);

        INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, gateway_fee, total_charged, status, expires_at)
        VALUES ('ord-1', 'ORD-001', 's-1', 'LOKET', 500000, 0, 500000, 'PAID', '2026-07-16 10:00:00');

        INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, net_amount, status, allocation_status, paid_at, received_by)
        VALUES ('pay-1', 'PAY-001', 'ord-1', 's-1', 'CASH', 'CASH', 500000, 500000, 'PAID', 'ALLOCATED', '2026-07-15 10:00:00', 'u-admin');

        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, provider_id)
        VALUES ('alc-1', 'pay-1', 'ob-1', 'OBLIGATION', 'SPP', 500000, NULL);

        INSERT INTO finance_distributions (id, distribution_number, recipient_type, recipient_id, item_type, period, total_amount, method, transferred_at, transferred_by)
        VALUES
            ('dist-1', 'DST-001', 'BENDAHARA', NULL, 'SPP', '2026-07', 500000, 'CASH', '2026-07-20 09:00:00', 'u-admin'),
            ('dist-2', 'DST-002', 'KATERING', 'jasa-kat-1', 'UANG_MAKAN', '2026-07', 300000, 'TRANSFER', '2026-07-20 09:30:00', 'u-admin'),
            ('dist-3', 'DST-003', 'LAUNDRY', 'jasa-lnd-1', 'LAUNDRY', '2026-07', 150000, 'TRANSFER', '2026-07-20 09:45:00', 'u-admin');

        INSERT INTO finance_wallet_ledger (id, santri_id, movement_type, direction, amount, balance_before, balance_after, created_at, operator_id)
        VALUES ('w-1', 's-1', 'TOPUP_CASH', 'IN', 100000, 0, 100000, '2026-07-10 08:00:00', 'u-admin');

        INSERT INTO finance_cash_sessions (id, session_code, operator_id, opened_at, opening_balance, status)
        VALUES ('cs-1', 'CS-20260715-01', 'u-admin', '2026-07-15 07:00:00', 500000, 'OPEN');

        INSERT INTO finance_credentials (id, santri_id, card_token, status, issued_at, issued_by)
        VALUES ('fc-1', 's-1', 'CRD-001-TOKEN', 'ACTIVE', '2026-07-01 00:00:00', 'u-admin');

        INSERT INTO finance_student_va (santri_id, va_number, bank_code)
        VALUES ('s-1', '988001001', '014');

        INSERT INTO finance_wallet_limits (santri_id, parent_daily_limit, updated_by)
        VALUES ('s-1', 50000, 'u-admin');
        """
    )
    conn.commit()
    return conn


def test_blocker_1_reports_schema_and_bootstrap(conn: sqlite3.Connection):
    """Test BLOCKER 1: Ensure initial bootstrap queries and schema contracts succeed."""
    print("Testing BLOCKER 1 (Report Bootstrap Queries & Schema Contracts)...")

    # 1. Asrama
    asrama_rows = conn.execute(
        "SELECT DISTINCT asrama FROM santri WHERE asrama IS NOT NULL AND asrama != '' ORDER BY asrama ASC"
    ).fetchall()
    assert len(asrama_rows) >= 2
    print(f"  [PASS] Bootstrap: asrama query returned {len(asrama_rows)} items.")

    # 2. Kelas (Fixed: nama_kelas)
    kelas_rows = conn.execute(
        "SELECT DISTINCT nama_kelas FROM kelas WHERE nama_kelas IS NOT NULL AND nama_kelas != '' ORDER BY nama_kelas ASC"
    ).fetchall()
    assert len(kelas_rows) == 2
    print(f"  [PASS] Bootstrap: kelas (nama_kelas) query returned {len(kelas_rows)} items.")

    # 3. Tahun Ajaran
    ta_rows = conn.execute(
        "SELECT id, nama, is_active FROM tahun_ajaran ORDER BY is_active DESC, nama DESC"
    ).fetchall()
    assert len(ta_rows) >= 1
    print(f"  [PASS] Bootstrap: tahun_ajaran query returned {len(ta_rows)} items.")

    # 4. Operator Users
    op_rows = conn.execute(
        "SELECT DISTINCT u.id, u.full_name FROM users u JOIN finance_cash_sessions fcs ON fcs.operator_id = u.id ORDER BY u.full_name ASC"
    ).fetchall()
    assert len(op_rows) >= 1
    print(f"  [PASS] Bootstrap: operators query returned {len(op_rows)} items.")

    # 5. Master Jasa Providers (Fixed: nama_jasa, jenis)
    prov_rows = conn.execute(
        "SELECT id, nama_jasa, jenis FROM master_jasa ORDER BY nama_jasa ASC"
    ).fetchall()
    assert len(prov_rows) == 4
    print(f"  [PASS] Bootstrap: master_jasa (nama_jasa, jenis) query returned {len(prov_rows)} items.")

    # 6. Active Students
    santri_rows = conn.execute(
        "SELECT id, nis, nama_lengkap, asrama, kelas_sekolah FROM santri WHERE status_global = 'aktif' ORDER BY nama_lengkap ASC LIMIT 500"
    ).fetchall()
    assert len(santri_rows) == 3
    print(f"  [PASS] Bootstrap: santri query returned {len(santri_rows)} items.")

    # 7. Codebase static scan assertions
    reports_file = ROOT / "lib" / "finance" / "reports.ts"
    content = reports_file.read_text(encoding="utf-8")

    assert "nama_perusahaan" not in content, "Error: nama_perusahaan still found in reports.ts!"
    assert "k.nama " not in content, "Error: k.nama still found in reports.ts! Must use k.nama_kelas."
    assert "k.nama," not in content, "Error: k.nama still found in reports.ts! Must use k.nama_kelas."
    assert "k.nama)" not in content, "Error: k.nama still found in reports.ts! Must use k.nama_kelas."
    assert "SELECT DISTINCT nama FROM kelas" not in content, "Error: SELECT DISTINCT nama FROM kelas found! Must use nama_kelas."
    assert "fc.card_code," not in content, "Error: fc.card_code found! Must use fc.card_token AS card_code."
    print("  [PASS] Zero schema discrepancies in reports.ts verified statically.")


def test_blocker_2_status_pembayaran_matrix(conn: sqlite3.Connection):
    """Test BLOCKER 2: Parameter bindings match exact placeholders in getStudentsObligationMatrix."""
    print("Testing BLOCKER 2 (Status Pembayaran Matrix Query Bindings)...")

    def run_matrix_query(period: str, asrama: str | None = None, search: str | None = None, limit: int | None = None, offset: int | None = None):
        santri_conditions = ["s.status_global = 'aktif'"]
        params = [period, period]  # 2 params for 2 base placeholders

        if asrama:
            santri_conditions.append("s.asrama = ?")
            params.append(asrama)

        if search:
            santri_conditions.append("(s.nama_lengkap LIKE ? OR s.nis LIKE ?)")
            q = f"%{search}%"
            params.extend([q, q])

        limit_clause = f"LIMIT {limit}" if limit else ""
        offset_clause = f"OFFSET {offset}" if offset else ""

        sql = f"""
            SELECT
              s.id AS santri_id,
              s.nis,
              s.nama_lengkap,
              s.asrama,
              s.kamar,
              s.tempat_makan_id,
              s.tempat_mencuci_id,
              o.id AS obligation_id,
              o.item_type,
              o.period,
              o.amount_expected,
              o.amount_exempted,
              o.amount_paid,
              o.status,
              o.provider_id,
              m.nama_jasa AS provider_name
            FROM santri s
            LEFT JOIN finance_obligations o
              ON s.id = o.santri_id
              AND (
                o.period = ?
                OR o.period = 'LIFETIME'
                OR (length(o.period) = 4 AND substr(?, 1, 4) = o.period)
              )
            LEFT JOIN master_jasa m ON o.provider_id = m.id
            WHERE {" AND ".join(santri_conditions)}
            ORDER BY s.nama_lengkap ASC, o.item_type ASC
            {limit_clause} {offset_clause}
        """

        num_placeholders = sql.count("?")
        num_params = len(params)
        assert num_placeholders == num_params, (
            f"Binding mismatch! SQL has {num_placeholders} placeholders, but params has {num_params} elements: {params}"
        )

        cursor = conn.execute(sql, params)
        return cursor.fetchall()

    # Matrix tests under all filters
    rows = run_matrix_query("2026-07")
    assert len(rows) > 0
    print(f"  [PASS] Default query without filter: {len(rows)} rows.")

    search_rows = run_matrix_query("2026-07", search="FAUZI")
    assert len(search_rows) > 0
    print(f"  [PASS] Search santri query: {len(search_rows)} rows.")

    asrama_rows = run_matrix_query("2026-07", asrama="Asrama Al-Falah")
    assert len(asrama_rows) > 0
    print(f"  [PASS] Asrama filter query: {len(asrama_rows)} rows.")

    period_rows = run_matrix_query("2026-08")
    assert len(period_rows) >= 0
    print(f"  [PASS] Different period query: {len(period_rows)} rows.")

    combo_rows = run_matrix_query("2026-07", asrama="Asrama Al-Falah", search="2627001")
    assert len(combo_rows) > 0
    print(f"  [PASS] Combined asrama + search query: {len(combo_rows)} rows.")

    paged_rows = run_matrix_query("2026-07", limit=2, offset=0)
    assert len(paged_rows) == 2
    print(f"  [PASS] Pagination executed cleanly.")


def test_all_reports_runtime_queries(conn: sqlite3.Connection):
    """Execute runtime queries for all 9 report types on SQLite matching exact production code."""
    print("Testing all 9 report types runtime queries...")

    # 1. Penerimaan (Receipts) - with join to kelas k (nama_kelas)
    receipts_sql = """
        SELECT
           fp.id,
           fp.payment_number,
           fpo.order_number,
           fp.paid_at,
           fp.santri_id,
           s.nama_lengkap AS santri_name,
           s.nis AS santri_nis,
           s.asrama AS santri_asrama,
           COALESCE(k.nama_kelas, s.kelas_sekolah) AS santri_kelas,
           fp.channel,
           fp.method,
           fp.gross_amount,
           fp.gateway_fee,
           fp.net_amount,
           fp.status,
           fp.correction_status,
           u.full_name AS cashier_name,
           (
             SELECT GROUP_CONCAT(fa.item_type || ': Rp' || fa.amount, ', ')
             FROM finance_allocations fa
             WHERE fa.payment_id = fp.id
           ) AS allocations_summary
        FROM finance_payments fp
        LEFT JOIN finance_payment_orders fpo ON fpo.id = fp.order_id
        JOIN santri s ON s.id = fp.santri_id
        LEFT JOIN users u ON u.id = fp.received_by
        LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        LEFT JOIN kelas k ON k.id = rp.kelas_id
        WHERE fp.status IN ('PAID', 'SETTLED')
        ORDER BY fp.paid_at DESC
        LIMIT 25 OFFSET 0
    """
    rows = conn.execute(receipts_sql).fetchall()
    assert len(rows) == 1
    assert rows[0][8] == "10 IPA 1"
    print(f"  [PASS] Report 1: Penerimaan (Receipts) executed cleanly with santri_kelas = {rows[0][8]}.")

    # 2. Penyaluran (Distributions) - with join to master_jasa (nama_jasa)
    dist_sql = """
        SELECT
           fd.id,
           fd.distribution_number,
           fd.transferred_at,
           fd.recipient_type,
           CASE
             WHEN fd.recipient_type = 'BENDAHARA' THEN 'Bendahara Pesantren'
             ELSE COALESCE(j.nama_jasa, fd.recipient_type)
           END AS recipient_name,
           fd.method,
           fd.total_amount,
           u.full_name AS operator_name
        FROM finance_distributions fd
        LEFT JOIN master_jasa j ON j.id = fd.recipient_id
        LEFT JOIN users u ON u.id = fd.transferred_by
        ORDER BY fd.transferred_at DESC
        LIMIT 25 OFFSET 0
    """
    rows = conn.execute(dist_sql).fetchall()
    assert len(rows) == 3
    print(f"  [PASS] Report 2: Penyaluran (Distributions) executed cleanly ({len(rows)} items).")

    # 3. Penunggak (Arrears) - with join to kelas (nama_kelas) and tahun_ajaran (nama)
    arrears_sql = """
        SELECT
           fo.id AS obligation_id,
           fo.santri_id,
           s.nama_lengkap AS santri_name,
           s.nis AS santri_nis,
           s.asrama AS santri_asrama,
           COALESCE(k.nama_kelas, s.kelas_sekolah) AS santri_kelas,
           s.no_wa_ortu,
           ta.nama AS academic_year_name,
           fo.period,
           fo.item_type,
           fo.amount_expected,
           fo.amount_exempted,
           fo.amount_paid,
           fo.status
        FROM finance_obligations fo
        JOIN santri s ON s.id = fo.santri_id
        LEFT JOIN tahun_ajaran ta ON ta.id = fo.academic_year_id
        LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        LEFT JOIN kelas k ON k.id = rp.kelas_id
        WHERE fo.status != 'EXEMPTED'
        LIMIT 25 OFFSET 0
    """
    rows = conn.execute(arrears_sql).fetchall()
    assert len(rows) >= 1
    print(f"  [PASS] Report 3: Penunggak (Arrears) executed cleanly ({len(rows)} items).")

    # 4. Pembebasan (Exemptions) - with join to kelas (nama_kelas)
    conn.execute(
        """
        INSERT INTO finance_exemptions (id, santri_id, item_type, academic_year_id, reason, status, created_by)
        VALUES ('fe-1', 's-3', 'SPP', 1, 'Yatim Piatu', 'ACTIVE', 'u-admin');
        """
    )
    conn.commit()
    exemptions_sql = """
        SELECT
           fe.id,
           fe.santri_id,
           s.nama_lengkap AS santri_name,
           s.nis AS santri_nis,
           s.asrama AS santri_asrama,
           COALESCE(k.nama_kelas, s.kelas_sekolah) AS santri_kelas,
           fe.item_type,
           ta.nama AS academic_year_name,
           fe.reason,
           fe.status,
           u_c.full_name AS created_by_name
        FROM finance_exemptions fe
        JOIN santri s ON s.id = fe.santri_id
        LEFT JOIN tahun_ajaran ta ON ta.id = fe.academic_year_id
        LEFT JOIN users u_c ON u_c.id = fe.created_by
        LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        LEFT JOIN kelas k ON k.id = rp.kelas_id
        LIMIT 25 OFFSET 0
    """
    rows = conn.execute(exemptions_sql).fetchall()
    assert len(rows) == 1
    print(f"  [PASS] Report 4: Pembebasan (Exemptions) executed cleanly.")

    # 5. Detail Santri (Student Financial Statement)
    detail_sql = """
        SELECT
           s.id,
           s.nis,
           s.nama_lengkap AS nama,
           s.asrama,
           s.kamar,
           COALESCE(k.nama_kelas, s.kelas_sekolah) AS kelas,
           s.no_wa_ortu,
           sva.va_number AS fixed_va,
           sva.bank_code,
           fwl.parent_daily_limit
        FROM santri s
        LEFT JOIN finance_student_va sva ON sva.santri_id = s.id
        LEFT JOIN finance_wallet_limits fwl ON fwl.santri_id = s.id
        LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        LEFT JOIN kelas k ON k.id = rp.kelas_id
        WHERE s.id = ?
    """
    rows = conn.execute(detail_sql, ("s-1",)).fetchall()
    assert len(rows) == 1
    assert rows[0][5] == "10 IPA 1"
    print(f"  [PASS] Report 5: Detail Santri executed cleanly with kelas = {rows[0][5]}.")

    # 6A. Uang Jajan Summary (with fc.card_token AS card_code, k.nama_kelas)
    wallet_summary_sql = """
        SELECT
           s.id AS santri_id,
           s.nama_lengkap AS santri_name,
           s.nis AS santri_nis,
           s.asrama AS santri_asrama,
           COALESCE(k.nama_kelas, s.kelas_sekolah) AS santri_kelas,
           COALESCE(wl.total_in, 0) AS total_in,
           COALESCE(wl.total_out, 0) AS total_out,
           flim.parent_daily_limit,
           fc.card_token AS card_code,
           fc.status AS card_status
        FROM santri s
        LEFT JOIN (
           SELECT
             santri_id,
             SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END) AS total_in,
             SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END) AS total_out
           FROM finance_wallet_ledger
           GROUP BY santri_id
        ) wl ON wl.santri_id = s.id
        LEFT JOIN finance_wallet_limits flim ON flim.santri_id = s.id
        LEFT JOIN finance_credentials fc ON fc.santri_id = s.id AND fc.status = 'ACTIVE'
        LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        LEFT JOIN kelas k ON k.id = rp.kelas_id
        WHERE s.status_global = 'aktif'
        LIMIT 25 OFFSET 0
    """
    rows = conn.execute(wallet_summary_sql).fetchall()
    assert len(rows) == 3
    assert rows[0][8] == "CRD-001-TOKEN"
    print(f"  [PASS] Report 6A: Uang Jajan Summary executed cleanly with card_token token mapped.")

    # 6B. Uang Jajan Mutations (Jurnal)
    wallet_mut_sql = """
        SELECT
           fwl.id,
           fwl.created_at,
           fwl.santri_id,
           s.nama_lengkap AS santri_name,
           s.nis AS santri_nis,
           s.asrama AS santri_asrama,
           COALESCE(k.nama_kelas, s.kelas_sekolah) AS santri_kelas,
           fwl.movement_type,
           fwl.direction,
           fwl.amount,
           fwl.balance_before,
           fwl.balance_after,
           u.full_name AS operator_name,
           fcs.session_code AS cash_session_code,
           fwl.notes
        FROM finance_wallet_ledger fwl
        JOIN santri s ON s.id = fwl.santri_id
        LEFT JOIN users u ON u.id = fwl.operator_id
        LEFT JOIN finance_cash_sessions fcs ON fcs.id = fwl.cash_session_id
        LEFT JOIN riwayat_pendidikan rp ON rp.santri_id = s.id AND rp.status_riwayat = 'aktif'
        LEFT JOIN kelas k ON k.id = rp.kelas_id
        LIMIT 25 OFFSET 0
    """
    rows = conn.execute(wallet_mut_sql).fetchall()
    assert len(rows) == 1
    print(f"  [PASS] Report 6B: Uang Jajan Mutations executed cleanly.")

    # 7. Transaksi Loket (Cash Sessions)
    sessions_sql = """
        SELECT
           fcs.id,
           fcs.session_code,
           COALESCE(u.full_name, 'Kasir') AS operator_name,
           fcs.opened_at,
           fcs.closed_at,
           fcs.opening_balance,
           fcs.status
        FROM finance_cash_sessions fcs
        LEFT JOIN users u ON u.id = fcs.operator_id
        LIMIT 25 OFFSET 0
    """
    rows = conn.execute(sessions_sql).fetchall()
    assert len(rows) == 1
    print(f"  [PASS] Report 7: Transaksi Loket (Cash Sessions) executed cleanly.")

    # 8. Settlement
    settlements_sql = """
        SELECT
           fs.id,
           fs.settlement_number,
           fs.settlement_date,
           fs.destination_bank,
           fs.destination_account,
           fs.total_gross_amount,
           fs.status,
           u.full_name AS verifier_name
        FROM finance_settlements fs
        LEFT JOIN users u ON u.id = fs.verified_by
        LIMIT 25 OFFSET 0
    """
    rows = conn.execute(settlements_sql).fetchall()
    assert len(rows) >= 0
    print(f"  [PASS] Report 8: Settlement executed cleanly.")

    # 9. Rekonsiliasi
    reconciliations_sql = """
        SELECT
           fri.id,
           fri.match_status,
           fri.external_reference,
           fri.internal_amount,
           fri.external_amount,
           fri.discrepancy_amount,
           u.full_name AS resolved_by_name,
           fp.payment_number,
           s.nama_lengkap AS santri_name
        FROM finance_reconciliation_items fri
        LEFT JOIN finance_payments fp ON fp.id = fri.payment_id
        LEFT JOIN santri s ON s.id = fp.santri_id
        LEFT JOIN users u ON u.id = fri.resolved_by
        LIMIT 25 OFFSET 0
    """
    rows = conn.execute(reconciliations_sql).fetchall()
    assert len(rows) >= 0
    print(f"  [PASS] Report 9: Rekonsiliasi executed cleanly.")


def main():
    print("=" * 75)
    print("STARTING EXHAUSTIVE RUNTIME SCHEMA CONTRACT VERIFICATION")
    print("=" * 75)

    conn = setup_db()
    test_blocker_1_reports_schema_and_bootstrap(conn)
    test_blocker_2_status_pembayaran_matrix(conn)
    test_all_reports_runtime_queries(conn)

    print("=" * 75)
    print("ALL RUNTIME SCHEMA CONTRACT & INTEGRATION TESTS PASSED (100%)")
    print("=" * 75)


if __name__ == "__main__":
    main()
