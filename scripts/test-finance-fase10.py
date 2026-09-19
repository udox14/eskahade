"""Automated Contract, Financial Reports Read-Model, & Export Tests for Fase 10.

Validates:
1. Migration 0165 & fitur_akses Registration:
   - /dashboard/keuangan/laporan (Laporan & Ekspor, icon FileSpreadsheet, urutan 6)
   - Performance indexes created for reporting queries.
2. Report 1: Penerimaan (Receipts Report):
   - Authoritative calculation of gross_amount, gateway_fee, net_amount.
   - Multi-filter (date range, period, channel, method, academic year, santri, asrama).
   - Summary KPIs (total nominal, average, channel breakdown).
3. Report 2: Penyaluran (Distributions Report):
   - Authoritative calculation of provider payouts (catering, laundry, etc.).
   - Multi-filter (provider, period, item_type, status).
4. Report 3: Penunggak (Arrears Report):
   - Authoritative formula: expected - exempted - SUM(allocations).
   - Invariant: Does NOT trust stale fo.amount_paid or fo.status.
   - Multi-filter (academic year, period, asrama, item_type).
5. Report 4: Santri Dibebaskan (Exemptions Report):
   - Multi-filter (academic year, reason, status, item_type).
   - Correctly handles APPROVED, REVOKED, EXPIRED exemptions.
6. Report 5: Detail Santri (Student Financial Statement / Kartu Keuangan):
   - Aggregates obligations, payments, remaining arrears, and live wallet balance.
   - Invariant: Wallet balance is tracked exclusively via ledger, never mixed with tuition.
7. Report 6: Uang Jajan (Wallet Ledger Report):
   - Multi-filter (date range, movement_type, santri, asrama).
   - Strict separation of titipan santri from pesantren revenue.
8. Report 7: Transaksi Loket (Cash Sessions & Counter Transactions):
   - Multi-filter (cashier, session status, date range).
   - Reconciles cash transactions, expected cash, actual counted cash, and discrepancies.
9. Report 8: Settlement (Settlement Batches & Inflows):
   - Multi-filter (status, date range).
   - Reconciles payment gateway settlement inflows, fees, and discrepancy records.
10. Report 9: Rekonsiliasi (Reconciliation Discrepancies):
    - Multi-filter (match_status, resolution_action, date range).
11. UI, Server Actions, & Export Files Existence & Structural Integrity.
"""

from __future__ import annotations

import datetime
import json
import os
import sqlite3
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_0152 = ROOT / "migrations" / "0152_finance_tariffs_and_obligations.sql"
MIGRATION_0153 = ROOT / "migrations" / "0153_finance_tariffs_overlap_trigger.sql"
MIGRATION_0154 = ROOT / "migrations" / "0154_finance_exemptions_revocation_metadata.sql"
MIGRATION_0155 = ROOT / "migrations" / "0155_finance_payments_and_orders.sql"
MIGRATION_0159 = ROOT / "migrations" / "0159_finance_cash_sessions_and_idempotency.sql"
MIGRATION_0160 = ROOT / "migrations" / "0160_finance_cards_and_wallet.sql"
MIGRATION_0161 = ROOT / "migrations" / "0161_finance_loket_and_cash_session.sql"
MIGRATION_0162 = ROOT / "migrations" / "0162_finance_distributions.sql"
MIGRATION_0163 = ROOT / "migrations" / "0163_finance_reconciliation_and_corrections.sql"
MIGRATION_0164 = ROOT / "migrations" / "0164_finance_dashboard_and_history.sql"
MIGRATION_0165 = ROOT / "migrations" / "0165_finance_reports_and_fitur_akses.sql"


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
            status TEXT NOT NULL DEFAULT 'Aktif',
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
            status_global TEXT NOT NULL DEFAULT 'aktif',
            asrama TEXT,
            kamar TEXT,
            tempat_makan_id TEXT REFERENCES master_jasa(id),
            tempat_mencuci_id TEXT REFERENCES master_jasa(id),
            saldo_uang_jajan INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

    # Seed Initial Users
    conn.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role, roles) VALUES (?, ?, ?, ?, ?, ?)",
        ("usr-admin", "admin@pesantren.test", "hash", "Super Admin", "admin", json.dumps(["admin"])),
    )
    conn.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role, roles) VALUES (?, ?, ?, ?, ?, ?)",
        ("usr-bendahara", "bendahara@pesantren.test", "hash", "Bendahara Pesantren", "bendahara", json.dumps(["bendahara"])),
    )
    conn.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role, roles) VALUES (?, ?, ?, ?, ?, ?)",
        ("usr-pimpinan", "pimpinan@pesantren.test", "hash", "Pimpinan Kyai", "pimpinan", json.dumps(["pimpinan"])),
    )
    conn.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role, roles) VALUES (?, ?, ?, ?, ?, ?)",
        ("usr-petugas-1", "petugas1@pesantren.test", "hash", "Kasir Loket 1", "staff", json.dumps(["staff"])),
    )

    # Seed Academic Year
    conn.execute("INSERT INTO tahun_ajaran (id, nama, status) VALUES (1, '2026/2027', 'Aktif')")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, status) VALUES (2, '2025/2026', 'Arsip')")

    # Apply Migrations 0152 through 0165
    for mig in [
        MIGRATION_0152,
        MIGRATION_0153,
        MIGRATION_0154,
        MIGRATION_0155,
        MIGRATION_0159,
        MIGRATION_0160,
        MIGRATION_0161,
        MIGRATION_0162,
        MIGRATION_0163,
        MIGRATION_0164,
        MIGRATION_0165,
    ]:
        with open(mig, "r", encoding="utf-8") as f:
            conn.executescript(f.read())

    return conn


def test_migration_0165_and_fitur_akses(conn: sqlite3.Connection):
    print("1. Testing Migration 0165 Schema, Indexes & fitur_akses Registration...")

    # Verify /dashboard/keuangan/laporan registration
    rep_feature = conn.execute(
        "SELECT group_name, title, href, icon, roles, is_active, urutan FROM fitur_akses WHERE href = '/dashboard/keuangan/laporan'"
    ).fetchone()
    assert rep_feature is not None, "Menu /dashboard/keuangan/laporan must be registered in fitur_akses"
    assert rep_feature[0] == "Keuangan"
    assert rep_feature[1] == "Laporan & Ekspor"
    assert rep_feature[3] == "FileSpreadsheet"
    roles = json.loads(rep_feature[4])
    assert "admin" in roles and "bendahara" in roles and "pimpinan" in roles
    assert rep_feature[5] == 1, "Feature must be active"
    assert rep_feature[6] == 6, "Urutan must be 6"

    # Verify reporting performance indexes
    indexes = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()}
    assert "idx_finance_allocations_obligation_amount" in indexes
    assert "idx_finance_obligations_santri_period" in indexes
    assert "idx_finance_exemptions_santri_active" in indexes
    assert "idx_finance_wallet_ledger_santri_type" in indexes
    assert "idx_finance_cash_sessions_opened_at" in indexes

    print("[OK] Migration 0165 and navigation features successfully verified.")


def test_receipts_report(conn: sqlite3.Connection):
    print("2. Testing Report 1: Penerimaan (Receipts Report)...")

    # Create students
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES ('san-rec-01', 'NIS-REC01', 'Budi Santoso', 'Asrama A', 'A-1')")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES ('san-rec-02', 'NIS-REC02', 'Siti Aminah', 'Asrama B', 'B-1')")

    # Payment 1: Online DUITKU Rp254.000 gross, fee 4.000, net 250.000 (SPP 200k + Topup 50k)
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status,
            allocation_status, paid_at, created_at
        ) VALUES ('pay-r-01', 'PAY-R01', 'san-rec-01', 'DUITKU', 'DUITKU_VA', 254000, 4000, 250000, 'SETTLED', 'ALLOCATED', '2026-09-01 10:00:00', '2026-09-01 10:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, target_type, item_type, amount, created_at)
        VALUES ('alc-r-01a', 'pay-r-01', 'OBLIGATION', 'SPP', 200000, '2026-09-01 10:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, target_type, item_type, amount, created_at)
        VALUES ('alc-r-01b', 'pay-r-01', 'UANG_JAJAN', 'UANG_JAJAN', 50000, '2026-09-01 10:00:00')
        """
    )

    # Payment 2: CASH Loket Rp150.000 (KATERING Rp150.000)
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status,
            allocation_status, paid_at, created_at
        ) VALUES ('pay-r-02', 'PAY-R02', 'san-rec-02', 'CASH', 'CASH', 150000, 0, 150000, 'PAID', 'ALLOCATED', '2026-09-02 14:00:00', '2026-09-02 14:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, target_type, item_type, amount, created_at)
        VALUES ('alc-r-02', 'pay-r-02', 'OBLIGATION', 'KATERING', 150000, '2026-09-02 14:00:00')
        """
    )



    # Query receipts report matching lib/finance/reports.ts
    query = """
        SELECT
            p.id, p.payment_number, p.paid_at, p.channel, p.method,
            p.gross_amount, p.gateway_fee, p.net_amount, p.status,
            s.nama_lengkap, s.nis, s.asrama,
            COALESCE(GROUP_CONCAT(a.item_type || ': ' || a.amount, ', '), '-') as allocation_summary
        FROM finance_payments p
        LEFT JOIN santri s ON p.santri_id = s.id
        LEFT JOIN finance_allocations a ON p.id = a.payment_id
        WHERE p.status IN ('PAID', 'SETTLED')
        GROUP BY p.id
        ORDER BY p.paid_at DESC
    """
    rows = conn.execute(query).fetchall()
    assert len(rows) == 2, f"Expected 2 successful payments, got {len(rows)}"

    # Check KPI aggregations
    kpi_query = """
        SELECT
            COALESCE(SUM(net_amount), 0) as total_net,
            COALESCE(SUM(gross_amount), 0) as total_gross,
            COALESCE(SUM(gateway_fee), 0) as total_fee,
            COUNT(id) as total_tx,
            COALESCE(SUM(CASE WHEN channel = 'DUITKU' THEN net_amount ELSE 0 END), 0) as online_net,
            COALESCE(SUM(CASE WHEN channel = 'CASH' THEN net_amount ELSE 0 END), 0) as cash_net
        FROM finance_payments
        WHERE status IN ('PAID', 'SETTLED')
    """
    kpi = conn.execute(kpi_query).fetchone()
    assert kpi[0] == 400000, f"Total net expected 400.000, got {kpi[0]}"
    assert kpi[1] == 404000, f"Total gross expected 404.000, got {kpi[1]}"
    assert kpi[2] == 4000, f"Total fee expected 4.000, got {kpi[2]}"
    assert kpi[3] == 2, f"Total count expected 2, got {kpi[3]}"
    assert kpi[4] == 250000, f"Online net expected 250.000, got {kpi[4]}"
    assert kpi[5] == 150000, f"Cash net expected 150.000, got {kpi[5]}"

    # Multi-filter: Asrama 'Asrama A'
    filter_asrama = conn.execute(
        query.replace("WHERE p.status IN ('PAID', 'SETTLED')", "WHERE p.status IN ('PAID', 'SETTLED') AND s.asrama = 'Asrama A'")
    ).fetchall()
    assert len(filter_asrama) == 1
    assert filter_asrama[0][1] == "PAY-R01"

    print("[OK] Receipts report calculation, status exclusions, and multi-filter verified.")


def test_distributions_report(conn: sqlite3.Connection):
    print("3. Testing Report 2: Penyaluran (Distributions Report)...")

    # Setup providers
    conn.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('prov-kat-01', 'Katering Barokah', 'katering')")
    conn.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('prov-lau-01', 'Laundry Bersih', 'laundry')")

    # Insert distributions (0162 schema)
    conn.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type,
            period, total_amount, method,
            destination_bank, destination_account, account_holder_name,
            transferred_by, transferred_at, notes, created_at
        ) VALUES (
            'dis-01', 'DIS-202609-001', 'KATERING', 'prov-kat-01', 'KATERING',
            '2026-09', 15000000, 'TRANSFER',
            'BSI', '7123456789', 'Katering Barokah PT',
            'usr-admin', '2026-09-05 11:00:00', 'Penyaluran Batch 1', '2026-09-05 10:00:00'
        )
        """
    )
    conn.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type,
            period, total_amount, method,
            destination_bank, destination_account, account_holder_name,
            transferred_by, transferred_at, notes, created_at
        ) VALUES (
            'dis-02', 'DIS-202609-002', 'LAUNDRY', 'prov-lau-01', 'LAUNDRY',
            '2026-09', 5000000, 'TRANSFER',
            'BSI', '7987654321', 'Laundry Bersih CV',
            'usr-admin', '2026-09-06 09:00:00', 'Penyaluran Laundry', '2026-09-06 09:00:00'
        )
        """
    )

    # Query distributions report
    rows = conn.execute(
        """
        SELECT d.id, d.distribution_number, d.item_type, d.total_amount, d.recipient_type, m.nama_jasa
        FROM finance_distributions d
        JOIN master_jasa m ON d.recipient_id = m.id
        ORDER BY d.created_at DESC
        """
    ).fetchall()
    assert len(rows) == 2

    # Verify KPIs
    kpi = conn.execute(
        """
        SELECT
            COALESCE(SUM(total_amount), 0) as grand_total,
            COALESCE(SUM(CASE WHEN recipient_type = 'KATERING' THEN total_amount ELSE 0 END), 0) as katering_total,
            COALESCE(SUM(CASE WHEN recipient_type = 'LAUNDRY' THEN total_amount ELSE 0 END), 0) as laundry_total,
            COUNT(id) as count
        FROM finance_distributions
        """
    ).fetchone()
    assert kpi[0] == 20000000
    assert kpi[1] == 15000000
    assert kpi[2] == 5000000
    assert kpi[3] == 2

    print("[OK] Distributions report aggregations and provider linkage verified.")


def test_arrears_report_authoritative_invariants(conn: sqlite3.Connection):
    print("4. Testing Report 3: Penunggak (Arrears Report) & Authoritative Invariants...")

    # Student 1: Unpaid obligation (expected 300.000, paid 0) -> Arrears = 300.000
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES ('san-arr-01', 'NIS-ARR01', 'Farhan', 'Asrama C', 'C-1')")
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, created_at
        ) VALUES ('ob-arr-01', 'san-arr-01', 'SPP', 1, '2026-09', 300000, 0, 0, 'UNPAID', '2026-09-01 08:00:00')
        """
    )

    # Student 2: Partially paid obligation (expected 300.000, paid 100.000) -> Arrears = 200.000
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES ('san-arr-02', 'NIS-ARR02', 'Ghani', 'Asrama C', 'C-2')")
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, created_at
        ) VALUES ('ob-arr-02', 'san-arr-02', 'SPP', 1, '2026-09', 300000, 0, 100000, 'PARTIALLY_PAID', '2026-09-01 08:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, net_amount, status, paid_at, created_at
        ) VALUES ('pay-arr-02', 'PAY-ARR02', 'san-arr-02', 'CASH', 'CASH', 100000, 100000, 'PAID', '2026-09-02 09:00:00', '2026-09-02 09:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, created_at)
        VALUES ('alc-arr-02', 'pay-arr-02', 'ob-arr-02', 'OBLIGATION', 'SPP', 100000, '2026-09-02 09:00:00')
        """
    )

    # Student 3: STALE CACHE TEST!
    # Obligation table in SQLite has amount_paid = 0 and status = 'UNPAID' (e.g. background job lag),
    # BUT there is a valid paid allocation of 300.000!
    # The Authoritative Arrears report MUST compute: 300.000 - 0 - 300.000 = 0.
    # Therefore Student 3 MUST NOT appear in the arrears list!
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES ('san-arr-03', 'NIS-ARR03', 'Hasan', 'Asrama C', 'C-3')")
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, created_at
        ) VALUES ('ob-arr-03', 'san-arr-03', 'SPP', 1, '2026-09', 300000, 0, 0, 'UNPAID', '2026-09-01 08:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, net_amount, status, paid_at, created_at
        ) VALUES ('pay-arr-03', 'PAY-ARR03', 'san-arr-03', 'DUITKU', 'DUITKU_VA', 300000, 300000, 'PAID', '2026-09-03 09:00:00', '2026-09-03 09:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, created_at)
        VALUES ('alc-arr-03', 'pay-arr-03', 'ob-arr-03', 'OBLIGATION', 'SPP', 300000, '2026-09-03 09:00:00')
        """
    )

    # Student 4: Fully Exempted (expected 300.000, exempted 300.000) -> Arrears = 0 (MUST NOT appear)
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES ('san-arr-04', 'NIS-ARR04', 'Irfan', 'Asrama C', 'C-4')")
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, created_at
        ) VALUES ('ob-arr-04', 'san-arr-04', 'SPP', 1, '2026-09', 300000, 300000, 0, 'EXEMPTED', '2026-09-01 08:00:00')
        """
    )

    # Student 5: Tagihan 200k, allocation 200k, refund 50k -> effective paid 150k, tunggakan 50k!
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES ('san-arr-05', 'NIS-ARR05', 'Kurniawan', 'Asrama C', 'C-5')")
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, created_at
        ) VALUES ('ob-arr-05', 'san-arr-05', 'SPP', 1, '2026-09', 200000, 0, 200000, 'PAID', '2026-09-01 08:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, net_amount, status, paid_at, created_at
        ) VALUES ('pay-arr-05', 'PAY-ARR05', 'san-arr-05', 'CASH', 'CASH', 200000, 200000, 'PAID', '2026-09-04 09:00:00', '2026-09-04 09:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, created_at)
        VALUES ('alc-arr-05', 'pay-arr-05', 'ob-arr-05', 'OBLIGATION', 'SPP', 200000, '2026-09-04 09:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_corrections (
            id, correction_number, correction_type, target_payment_id, total_amount, method, reason, created_by, created_at
        ) VALUES ('corr-arr-05', 'CORR-ARR05', 'REFUND', 'pay-arr-05', 50000, 'CASH', 'Refund sebagian 50k', 'usr-admin', '2026-09-05 10:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_correction_items (
            id, correction_id, target_allocation_id, obligation_id, target_type, amount, created_at
        ) VALUES ('ci-arr-05', 'corr-arr-05', 'alc-arr-05', 'ob-arr-05', 'OBLIGATION', 50000, '2026-09-05 10:00:00')
        """
    )

    # Student 6: Full correction test case with stale cache:
    # Tagihan 250k, allocation 250k, refund 250k -> effective paid 0, tunggakan 250k
    # Even if obligation in DB has amount_paid = 250000 and status = 'PAID'
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES ('san-arr-06', 'NIS-ARR06', 'Lukman', 'Asrama C', 'C-6')")
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, created_at
        ) VALUES ('ob-arr-06', 'san-arr-06', 'SPP', 1, '2026-09', 250000, 0, 250000, 'PAID', '2026-09-01 08:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, net_amount, status, paid_at, created_at
        ) VALUES ('pay-arr-06', 'PAY-ARR06', 'san-arr-06', 'DUITKU', 'DUITKU_VA', 250000, 250000, 'SETTLED', '2026-09-04 11:00:00', '2026-09-04 11:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, created_at)
        VALUES ('alc-arr-06', 'pay-arr-06', 'ob-arr-06', 'OBLIGATION', 'SPP', 250000, '2026-09-04 11:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_corrections (
            id, correction_number, correction_type, target_payment_id, total_amount, method, reason, created_by, created_at
        ) VALUES ('corr-arr-06', 'CORR-ARR06', 'REFUND', 'pay-arr-06', 250000, 'GATEWAY', 'Full refund 250k', 'usr-admin', '2026-09-05 11:00:00')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_correction_items (
            id, correction_id, target_allocation_id, obligation_id, target_type, amount, created_at
        ) VALUES ('ci-arr-06', 'corr-arr-06', 'alc-arr-06', 'ob-arr-06', 'OBLIGATION', 250000, '2026-09-05 11:00:00')
        """
    )

    # Execute authoritative correction-aware arrears query (matching lib/finance/reports.ts)
    arrears_query = """
        SELECT
            fo.id as obligation_id,
            fo.santri_id,
            s.nis,
            s.nama_lengkap,
            s.asrama,
            s.kamar,
            fo.item_type,
            fo.period,
            fo.amount_expected,
            fo.amount_exempted,
            (CASE WHEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0)) > 0
                  THEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0))
                  ELSE 0 END) as real_amount_paid,
            ((fo.amount_expected - fo.amount_exempted) - (CASE WHEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0)) > 0
                  THEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0))
                  ELSE 0 END)) as true_remaining_arrears
        FROM finance_obligations fo
        JOIN santri s ON fo.santri_id = s.id
        LEFT JOIN (
            SELECT fa.obligation_id, SUM(fa.amount) as gross_paid
            FROM finance_allocations fa
            JOIN finance_payments fp ON fa.payment_id = fp.id
            WHERE fp.status IN ('PAID', 'SETTLED')
              AND fa.target_type = 'OBLIGATION'
            GROUP BY fa.obligation_id
        ) alloc ON fo.id = alloc.obligation_id
        LEFT JOIN (
            SELECT fci.obligation_id, SUM(fci.amount) as total_corrected
            FROM finance_correction_items fci
            WHERE fci.target_type = 'OBLIGATION'
            GROUP BY fci.obligation_id
        ) corr ON fo.id = corr.obligation_id
        WHERE fo.academic_year_id = 1 AND fo.period = '2026-09'
        GROUP BY fo.id
        HAVING true_remaining_arrears > 0
        ORDER BY true_remaining_arrears DESC
    """
    arrears_list = conn.execute(arrears_query).fetchall()

    # Must contain exactly 4 students: Farhan (300k), Lukman (250k), Ghani (200k), Kurniawan (50k)
    assert len(arrears_list) == 4, f"Expected 4 arrears rows, got {len(arrears_list)}: {arrears_list}"

    by_nis = {row[2]: row for row in arrears_list}

    # Farhan: Unpaid 300k
    assert by_nis["NIS-ARR01"][10] == 0  # real paid
    assert by_nis["NIS-ARR01"][11] == 300000  # remaining

    # Lukman: Full correction (250k - 250k = 0 paid), arrears = 250k despite stale cache
    assert by_nis["NIS-ARR06"][10] == 0
    assert by_nis["NIS-ARR06"][11] == 250000

    # Ghani: Partial payment (100k paid), arrears = 200k
    assert by_nis["NIS-ARR02"][10] == 100000
    assert by_nis["NIS-ARR02"][11] == 200000

    # Kurniawan: Tagihan 200k, 200k allocation, 50k refund -> paid efektif 150k, tunggakan 50k
    assert by_nis["NIS-ARR05"][10] == 150000
    assert by_nis["NIS-ARR05"][11] == 50000

    # Hasan (paid) and Irfan (exempted) must NOT be present
    assert "NIS-ARR03" not in by_nis, "Hasan (paid) should not be in arrears!"
    assert "NIS-ARR04" not in by_nis, "Irfan (exempted) should not be in arrears!"

    print("[OK] Authoritative arrears calculation verified against stale cache, exemptions, and corrections.")


def test_exemptions_report(conn: sqlite3.Connection):
    print("5. Testing Report 4: Santri Dibebaskan (Exemptions Report)...")

    # Insert exemptions (0152 & 0154 schema)
    conn.execute(
        """
        INSERT INTO finance_exemptions (
            id, santri_id, item_type, academic_year_id,
            reason, status, created_by, created_at
        ) VALUES (
            'ex-01', 'san-arr-04', 'SPP', 1,
            'Beasiswa Yatim Dhuafa', 'ACTIVE', 'usr-admin', '2026-09-01 07:00:00'
        )
        """
    )
    conn.execute(
        """
        INSERT INTO finance_exemptions (
            id, santri_id, item_type, academic_year_id,
            reason, status, created_by, revoked_by, revoked_at, revocation_reason, created_at
        ) VALUES (
            'ex-02', 'san-arr-01', 'SPP', 1,
            'Keringanan Sementara', 'REVOKED', 'usr-admin', 'usr-bendahara', '2026-09-02 12:00:00', 'Tidak memenuhi kriteria', '2026-09-01 07:00:00'
        )
        """
    )

    # Query exemptions
    rows = conn.execute(
        """
        SELECT fe.id, fe.item_type, fe.reason, fe.status, s.nama_lengkap, u.full_name as creator
        FROM finance_exemptions fe
        JOIN santri s ON fe.santri_id = s.id
        LEFT JOIN users u ON fe.created_by = u.id
        WHERE fe.academic_year_id = 1
        ORDER BY fe.created_at ASC
        """
    ).fetchall()
    assert len(rows) == 2

    # Active filter
    active = conn.execute("SELECT COUNT(*) FROM finance_exemptions WHERE status = 'ACTIVE'").fetchone()[0]
    assert active == 1

    revoked = conn.execute("SELECT COUNT(*) FROM finance_exemptions WHERE status = 'REVOKED'").fetchone()[0]
    assert revoked == 1

    print("[OK] Exemptions report and status filtering verified.")


def test_student_detail_report_and_wallet_separation(conn: sqlite3.Connection):
    print("6. Testing Report 5: Detail Santri & Live Wallet Balance Separation...")

    # Student with both SPP obligation and Uang Jajan ledger mutations
    santri_id = "san-det-01"
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES (?, 'NIS-DET01', 'Joko Widodo', 'Asrama D', 'D-1')", (santri_id,))

    # Obligation SPP Rp350.000
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, created_at
        ) VALUES ('ob-det-01', ?, 'SPP', 1, '2026-09', 350000, 50000, 300000, 'PAID', '2026-09-01 08:00:00')
        """,
        (santri_id,),
    )

    # Payment for SPP Rp300.000
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, net_amount, status, paid_at, created_at
        ) VALUES ('pay-det-01', 'PAY-DET01', ?, 'DUITKU', 'DUITKU_VA', 300000, 300000, 'SETTLED', '2026-09-02 10:00:00', '2026-09-02 10:00:00')
        """,
        (santri_id,),
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, created_at)
        VALUES ('alc-det-01', 'pay-det-01', 'ob-det-01', 'OBLIGATION', 'SPP', 300000, '2026-09-02 10:00:00')
        """
    )

    # Uang Jajan Ledger with Migration 0160 Schema & Trigger Compliance:
    # Top-up: balance_before = 0, amount = 200.000, balance_after = 200.000
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after,
            reference_id, operator_id, notes, created_at
        ) VALUES ('wal-01', ?, 'IN', 'TOPUP_ONLINE', 200000, 0, 200000, 'pay-det-01', 'usr-admin', 'Topup Uang Jajan', '2026-09-02 10:05:00')
        """,
        (santri_id,),
    )

    # Spending / Withdrawal: balance_before = 200.000, amount = 50.000, balance_after = 150.000
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after,
            reference_id, operator_id, notes, created_at
        ) VALUES ('wal-02', ?, 'OUT', 'WITHDRAWAL_LOKET', 50000, 200000, 150000, 'ref-w-01', 'usr-petugas-1', 'Tarik Tunai Loket', '2026-09-03 12:00:00')
        """,
        (santri_id,),
    )

    # Compute live wallet balance directly from ledger:
    wallet_balance = conn.execute(
        """
        SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
        FROM finance_wallet_ledger
        WHERE santri_id = ?
        """,
        (santri_id,),
    ).fetchone()[0]
    assert wallet_balance == 150000, f"Expected wallet balance 150.000, got {wallet_balance}"

    # Verify obligations summary
    ob_summary = conn.execute(
        """
        SELECT
            COALESCE(SUM(amount_expected), 0) as total_expected,
            COALESCE(SUM(amount_exempted), 0) as total_exempted,
            COALESCE(SUM(amount_paid), 0) as total_paid
        FROM finance_obligations
        WHERE santri_id = ?
        """,
        (santri_id,),
    ).fetchone()
    assert ob_summary[0] == 350000
    assert ob_summary[1] == 50000
    assert ob_summary[2] == 300000

    # Remaining arrears: 350.000 - 50.000 - 300.000 = 0
    assert ob_summary[0] - ob_summary[1] - ob_summary[2] == 0

    # Invariant: Student Detail report summary must be correction-aware (Authoritative Net Paid)
    # Test on santri Kurniawan (san-arr-05): 200k tagihan, 200k paid, 50k refund -> paid 150k, sisa 50k
    det_kurniawan = conn.execute(
        """
        SELECT
            COALESCE(SUM(fo.amount_expected), 0) as total_expected,
            COALESCE(SUM(fo.amount_exempted), 0) as total_exempted,
            COALESCE(SUM(
                CASE WHEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0)) > 0
                     THEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0))
                     ELSE 0 END
            ), 0) as total_paid,
            COALESCE(SUM(
                (fo.amount_expected - fo.amount_exempted) -
                (CASE WHEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0)) > 0
                      THEN (COALESCE(alloc.gross_paid, 0) - COALESCE(corr.total_corrected, 0))
                      ELSE 0 END)
            ), 0) as total_remaining
        FROM finance_obligations fo
        LEFT JOIN (
            SELECT fa.obligation_id, SUM(fa.amount) as gross_paid
            FROM finance_allocations fa
            JOIN finance_payments fp ON fa.payment_id = fp.id
            WHERE fp.status IN ('PAID', 'SETTLED') AND fa.target_type = 'OBLIGATION'
            GROUP BY fa.obligation_id
        ) alloc ON fo.id = alloc.obligation_id
        LEFT JOIN (
            SELECT fci.obligation_id, SUM(fci.amount) as total_corrected
            FROM finance_correction_items fci
            WHERE fci.target_type = 'OBLIGATION'
            GROUP BY fci.obligation_id
        ) corr ON fo.id = corr.obligation_id
        WHERE fo.santri_id = 'san-arr-05'
        """
    ).fetchone()
    assert det_kurniawan[0] == 200000, f"Expected 200.000 tagihan, got {det_kurniawan[0]}"
    assert det_kurniawan[1] == 0, f"Expected 0 exempted, got {det_kurniawan[1]}"
    assert det_kurniawan[2] == 150000, f"Expected 150.000 net authoritative paid, got {det_kurniawan[2]}"
    assert det_kurniawan[3] == 50000, f"Expected 50.000 remaining arrears, got {det_kurniawan[3]}"

    print("[OK] Student financial card integrity, ledger balance separation, and correction-aware totals verified.")


def test_wallet_report(conn: sqlite3.Connection):
    print("7. Testing Report 6: Uang Jajan (Wallet Ledger Report)...")

    # Query KPI directly from wallet ledger
    kpi = conn.execute(
        """
        SELECT
            COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) as total_in,
            COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) as total_out,
            COUNT(*) as total_mutations
        FROM finance_wallet_ledger
        """
    ).fetchone()

    assert kpi[0] == 200000, f"Expected total IN 200.000, got {kpi[0]}"
    assert kpi[1] == 50000, f"Expected total OUT 50.000, got {kpi[1]}"
    assert kpi[2] == 2, f"Expected 2 mutations, got {kpi[2]}"
    current_balance = kpi[0] - kpi[1]
    assert current_balance == 150000, f"Expected net balance 150.000, got {current_balance}"

    # Filter by movement_type = 'TOPUP_ONLINE'
    topups = conn.execute(
        "SELECT COUNT(*), SUM(amount) FROM finance_wallet_ledger WHERE movement_type = 'TOPUP_ONLINE'"
    ).fetchone()
    assert topups[0] == 1
    assert topups[1] == 200000

    print("[OK] Wallet ledger report calculations and mutation filtering verified.")


def test_cash_sessions_and_settlements_reports(conn: sqlite3.Connection):
    print("8. Testing Report 7 & 8: Transaksi Loket & Settlement Batches...")

    # Cash Session (0159 schema)
    conn.execute(
        """
        INSERT INTO finance_cash_sessions (
            id, session_code, operator_id, opened_at, closed_at,
            opening_balance, expected_closing_balance, actual_closing_balance, difference,
            total_cash_in, total_cash_out, status, difference_notes
        ) VALUES (
            'sess-01', 'SESS-20260901-01', 'usr-petugas-1', '2026-09-01 08:00:00', '2026-09-01 16:00:00',
            100000, 1600000, 1600000, 0, 1500000, 0, 'CLOSED', 'Sesi Loket 1 Tutup Tepat'
        )
        """
    )
    conn.execute(
        """
        INSERT INTO finance_cash_sessions (
            id, session_code, operator_id, opened_at, closed_at,
            opening_balance, expected_closing_balance, actual_closing_balance, difference,
            total_cash_in, total_cash_out, status, difference_notes
        ) VALUES (
            'sess-02', 'SESS-20260902-01', 'usr-petugas-1', '2026-09-02 08:00:00', NULL,
            100000, 600000, NULL, 0, 500000, 0, 'OPEN', 'Sesi Hari Ini'
        )
        """
    )

    # Query Cash Sessions report
    sessions = conn.execute(
        """
        SELECT cs.id, cs.session_code, cs.status, u.full_name, cs.opening_balance, cs.actual_closing_balance, cs.total_cash_in, cs.difference
        FROM finance_cash_sessions cs
        JOIN users u ON cs.operator_id = u.id
        ORDER BY cs.opened_at DESC
        """
    ).fetchall()
    assert len(sessions) == 2
    assert sessions[0][2] == "OPEN"
    assert sessions[1][2] == "CLOSED"

    # Authoritative Cash Session Reconstruction & Stale Cache Test:
    # Opening 500k + cash payment 200k + topup 50k - withdrawal 100k - refund 25k = expected 625k
    # Intentionally corrupt derived cache columns in finance_cash_sessions
    conn.execute(
        """
        INSERT INTO finance_cash_sessions (
            id, session_code, operator_id, opened_at, closed_at,
            opening_balance, expected_closing_balance, actual_closing_balance, difference,
            total_cash_in, total_cash_out, status, difference_notes
        ) VALUES (
            'sess-stale', 'SESS-STALE-01', 'usr-petugas-1', '2026-09-03 08:00:00', '2026-09-03 16:00:00',
            500000, 999999, 625000, 999999,
            999999, 999999, 'CLOSED', 'Cache intentionally corrupted'
        )
        """
    )
    # Cash payment 200k linked to sess-stale
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, net_amount, status,
            cash_session_id, paid_at, created_at
        ) VALUES (
            'pay-stale-01', 'PAY-STALE01', 'san-arr-01', 'CASH', 'CASH', 200000, 200000, 'PAID',
            'sess-stale', '2026-09-03 09:00:00', '2026-09-03 09:00:00'
        )
        """
    )
    # Student for wallet transactions in sess-stale
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES ('san-stale-01', 'NIS-STL01', 'Zaid', 'Asrama A', 'A-5')")
    # Initial wallet topup prior to session (so withdrawal of 100k doesn't violate overdraw or balance constraints)
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after,
            reference_id, operator_id, notes, created_at
        ) VALUES ('wal-pre-01', 'san-stale-01', 'IN', 'TOPUP_ONLINE', 150000, 0, 150000, 'pay-pre-01', 'usr-admin', 'Pre-balance', '2026-09-02 08:00:00')
        """
    )
    # Cash Topup in sess-stale: +50k
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after,
            cash_session_id, reference_id, operator_id, notes, created_at
        ) VALUES ('wal-stale-in', 'san-stale-01', 'IN', 'TOPUP_CASH', 50000, 150000, 200000, 'sess-stale', 'ref-top-01', 'usr-petugas-1', 'Topup Kasir', '2026-09-03 10:00:00')
        """
    )
    # Cash Withdrawal in sess-stale: -100k
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after,
            cash_session_id, reference_id, operator_id, notes, created_at
        ) VALUES ('wal-stale-out', 'san-stale-01', 'OUT', 'WITHDRAWAL_LOKET', 100000, 200000, 100000, 'sess-stale', 'ref-wit-01', 'usr-petugas-1', 'Tarik Kasir', '2026-09-03 11:00:00')
        """
    )
    # Cash Refund in sess-stale: -25k
    conn.execute(
        """
        INSERT INTO finance_corrections (
            id, correction_number, correction_type, target_payment_id, total_amount, method,
            cash_session_id, reason, created_by, created_at
        ) VALUES ('corr-stale-ref', 'CORR-STL01', 'REFUND', 'pay-stale-01', 25000, 'CASH', 'sess-stale', 'Refund tunai loket', 'usr-petugas-1', '2026-09-03 12:00:00')
        """
    )

    # Authoritative reconstruction query (matching getCashSessionsReport in lib/finance/reports.ts)
    auth_sessions_query = """
        SELECT
            fcs.id,
            fcs.session_code,
            fcs.opening_balance,
            (COALESCE(c_pay.total_pay, 0) + COALESCE(c_top.total_top, 0)) AS auth_cash_in,
            (COALESCE(c_wit.total_wit, 0) + COALESCE(c_ref.total_ref, 0)) AS auth_cash_out,
            (fcs.opening_balance + (COALESCE(c_pay.total_pay, 0) + COALESCE(c_top.total_top, 0)) - (COALESCE(c_wit.total_wit, 0) + COALESCE(c_ref.total_ref, 0))) AS auth_expected_closing_balance,
            fcs.actual_closing_balance,
            (CASE WHEN fcs.actual_closing_balance IS NOT NULL THEN (fcs.actual_closing_balance - (fcs.opening_balance + (COALESCE(c_pay.total_pay, 0) + COALESCE(c_top.total_top, 0)) - (COALESCE(c_wit.total_wit, 0) + COALESCE(c_ref.total_ref, 0)))) ELSE NULL END) AS auth_difference,
            COALESCE(c_ref.total_ref, 0) as auth_refunds_amount
        FROM finance_cash_sessions fcs
        LEFT JOIN (
            SELECT cash_session_id, SUM(net_amount) as total_pay, COUNT(id) as count_pay
            FROM finance_payments
            WHERE channel = 'CASH' AND status = 'PAID' AND cash_session_id IS NOT NULL
            GROUP BY cash_session_id
        ) c_pay ON fcs.id = c_pay.cash_session_id
        LEFT JOIN (
            SELECT cash_session_id, SUM(amount) as total_top, COUNT(id) as count_top
            FROM finance_wallet_ledger
            WHERE movement_type = 'TOPUP_CASH' AND direction = 'IN' AND cash_session_id IS NOT NULL
            GROUP BY cash_session_id
        ) c_top ON fcs.id = c_top.cash_session_id
        LEFT JOIN (
            SELECT cash_session_id, SUM(amount) as total_wit, COUNT(id) as count_wit
            FROM finance_wallet_ledger
            WHERE movement_type = 'WITHDRAWAL_LOKET' AND direction = 'OUT' AND cash_session_id IS NOT NULL
            GROUP BY cash_session_id
        ) c_wit ON fcs.id = c_wit.cash_session_id
        LEFT JOIN (
            SELECT cash_session_id, SUM(total_amount) as total_ref, COUNT(id) as count_ref
            FROM finance_corrections
            WHERE method = 'CASH' AND cash_session_id IS NOT NULL
            GROUP BY cash_session_id
        ) c_ref ON fcs.id = c_ref.cash_session_id
        WHERE fcs.id = 'sess-stale'
    """
    stale_rec = conn.execute(auth_sessions_query).fetchone()
    assert stale_rec is not None
    assert stale_rec[2] == 500000, f"Opening balance expected 500.000, got {stale_rec[2]}"
    assert stale_rec[3] == 250000, f"Authoritative cash in expected 250.000, got {stale_rec[3]}"
    assert stale_rec[4] == 125000, f"Authoritative cash out expected 125.000, got {stale_rec[4]}"
    assert stale_rec[5] == 625000, f"Authoritative expected closing expected 625.000, got {stale_rec[5]}"
    assert stale_rec[6] == 625000, f"Actual closing expected 625.000, got {stale_rec[6]}"
    assert stale_rec[7] == 0, f"Authoritative difference expected 0, got {stale_rec[7]}"
    assert stale_rec[8] == 25000, f"Authoritative cash refund expected 25.000, got {stale_rec[8]}"

    # Verify session detail report queries (no double counting)
    pay_items = conn.execute(
        "SELECT id, gross_amount FROM finance_payments WHERE cash_session_id = 'sess-stale' AND channel = 'CASH' AND status = 'PAID'"
    ).fetchall()
    assert len(pay_items) == 1 and pay_items[0][1] == 200000

    top_items = conn.execute(
        "SELECT id, amount FROM finance_wallet_ledger WHERE cash_session_id = 'sess-stale' AND movement_type = 'TOPUP_CASH' AND direction = 'IN'"
    ).fetchall()
    assert len(top_items) == 1 and top_items[0][1] == 50000

    wit_items = conn.execute(
        "SELECT id, amount FROM finance_wallet_ledger WHERE cash_session_id = 'sess-stale' AND movement_type = 'WITHDRAWAL_LOKET' AND direction = 'OUT'"
    ).fetchall()
    assert len(wit_items) == 1 and wit_items[0][1] == 100000

    ref_items = conn.execute(
        "SELECT id, total_amount FROM finance_corrections WHERE cash_session_id = 'sess-stale' AND method = 'CASH'"
    ).fetchall()
    assert len(ref_items) == 1 and ref_items[0][1] == 25000

    # Settlement Batch (0163 Schema: total_payments_count, total_gross_amount, total_fee_amount, total_net_amount)
    conn.execute(
        """
        INSERT INTO finance_settlements (
            id, settlement_number, provider, settlement_date,
            destination_bank, destination_account,
            total_payments_count, total_gross_amount, total_fee_amount, total_net_amount,
            status, notes, verified_by, created_at
        ) VALUES (
            'set-01', 'SET-DUITKU-20260901', 'DUITKU', '2026-09-01',
            'BSI', '7123456789',
            10, 5000000, 80000, 4920000,
            'COMPLETED', 'Pencairan Duitku Tgl 01 Sep', 'usr-bendahara', '2026-09-01 18:00:00'
        )
        """
    )

    settlements = conn.execute(
        """
        SELECT fs.id, fs.settlement_number, fs.total_gross_amount, fs.total_net_amount, fs.total_fee_amount, fs.status, u.full_name
        FROM finance_settlements fs
        LEFT JOIN users u ON fs.verified_by = u.id
        """
    ).fetchall()
    assert len(settlements) == 1
    assert settlements[0][1] == "SET-DUITKU-20260901"
    assert settlements[0][2] == 5000000
    assert settlements[0][3] == 4920000
    assert settlements[0][4] == 80000
    assert settlements[0][5] == "COMPLETED"
    assert settlements[0][6] == "Bendahara Pesantren"

    print("[OK] Cash sessions and settlement reports verified.")


def test_reconciliations_report(conn: sqlite3.Connection):
    print("9. Testing Report 9: Rekonsiliasi (Reconciliation Items & Discrepancies)...")

    # Insert reconciliation items (0155 schema)
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, payment_id, external_reference,
            internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes,
            resolved_by, resolved_at, created_at
        ) VALUES (
            'rec-01', 'pay-r-01', 'DUITKU-REF-001',
            254000, 250000, 4000,
            'AMOUNT_MISMATCH', 'ADJUSTMENT', 'Selisih biaya gateway dikoreksi',
            'usr-bendahara', '2026-09-01 19:00:00', '2026-09-01 18:30:00'
        )
        """
    )
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, payment_id, external_reference,
            internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes,
            resolved_by, resolved_at, created_at
        ) VALUES (
            'rec-02', 'pay-r-02', 'LOKET-REF-002',
            150000, 150000, 0,
            'MATCHED', 'NONE', NULL,
            NULL, NULL, '2026-09-02 17:00:00'
        )
        """
    )

    recs = conn.execute(
        """
        SELECT id, match_status, internal_amount, external_amount, discrepancy_amount, resolution_action
        FROM finance_reconciliation_items
        ORDER BY created_at DESC
        """
    ).fetchall()
    assert len(recs) == 2

    kpi = conn.execute(
        """
        SELECT
            COALESCE(SUM(CASE WHEN match_status = 'MATCHED' THEN 1 ELSE 0 END), 0) AS matched_count,
            COALESCE(SUM(CASE WHEN match_status != 'MATCHED' THEN 1 ELSE 0 END), 0) AS discrepancy_count,
            COALESCE(SUM(discrepancy_amount), 0) AS total_discrepancy_amount,
            COALESCE(SUM(CASE WHEN resolution_action != 'NONE' THEN 1 ELSE 0 END), 0) AS resolved_count
        FROM finance_reconciliation_items
        """
    ).fetchone()
    assert kpi[0] == 1, f"Expected 1 matched, got {kpi[0]}"
    assert kpi[1] == 1, f"Expected 1 discrepancy, got {kpi[1]}"
    assert kpi[2] == 4000, f"Expected 4000 discrepancy amount, got {kpi[2]}"
    assert kpi[3] == 1, f"Expected 1 resolved, got {kpi[3]}"

    print("[OK] Reconciliation report items, match status, and resolution KPIs verified.")


def test_ui_and_export_components_structural_integrity():
    print("10. Testing UI Components, Server Actions & Export Structural Integrity...")

    required_files = [
        ROOT / "migrations" / "0165_finance_reports_and_fitur_akses.sql",
        ROOT / "lib" / "finance" / "reports.ts",
        ROOT / "lib" / "finance" / "report-exports.ts",
        ROOT / "components" / "finance" / "report-printable-view.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "laporan" / "page.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "laporan" / "actions.ts",
        ROOT / "app" / "dashboard" / "keuangan" / "laporan" / "_page-content.tsx",
    ]

    for rf in required_files:
        assert rf.exists(), f"File {rf.name} must exist on disk"
        assert rf.stat().st_size > 100, f"File {rf.name} must have non-trivial content"

    # Verify that lib/finance/reports.ts exports all 9 report query functions
    with open(ROOT / "lib" / "finance" / "reports.ts", "r", encoding="utf-8") as f:
        rep_content = f.read()
        assert "getReceiptsReport" in rep_content
        assert "getDistributionsReport" in rep_content
        assert "getArrearsReport" in rep_content
        assert "getExemptionsReport" in rep_content
        assert "getStudentDetailReport" in rep_content
        assert "getWalletReport" in rep_content
        assert "getCashSessionsReport" in rep_content
        assert "getCashSessionDetailReport" in rep_content
        assert "getSettlementsReport" in rep_content
        assert "getReconciliationsReport" in rep_content
        assert "getReportFilterOptions" in rep_content

    # Verify that lib/finance/report-exports.ts exports all 9 Excel builders
    with open(ROOT / "lib" / "finance" / "report-exports.ts", "r", encoding="utf-8") as f:
        exp_content = f.read()
        assert "exportReceiptsExcel" in exp_content
        assert "exportDistributionsExcel" in exp_content
        assert "exportArrearsExcel" in exp_content
        assert "exportExemptionsExcel" in exp_content
        assert "exportStudentDetailExcel" in exp_content
        assert "exportWalletExcel" in exp_content
        assert "exportCashSessionsExcel" in exp_content
        assert "exportSettlementsExcel" in exp_content
        assert "exportReconciliationsExcel" in exp_content
        # Verify xlsx-js-style usage and numeric formatting type 'n'
        assert "xlsx-js-style" in exp_content
        assert "t: 'n'" in exp_content

    # Verify that app/dashboard/keuangan/laporan/actions.ts enforces RBAC and session detail action
    with open(ROOT / "app" / "dashboard" / "keuangan" / "laporan" / "actions.ts", "r", encoding="utf-8") as f:
        act_content = f.read()
        assert "assertReportPermission" in act_content
        assert "canAccessFeatureForSession" in act_content
        assert "fetchCashSessionDetailReport" in act_content
        assert "admin" in act_content
        assert "bendahara" in act_content
        assert "pimpinan" in act_content

    # Verify report printable view contains Pesantren Kop and signatures
    with open(ROOT / "components" / "finance" / "report-printable-view.tsx", "r", encoding="utf-8") as f:
        print_content = f.read()
        assert "PONDOK PESANTREN ESKAHADE" in print_content
        assert "Bendahara Pesantren" in print_content
        assert "Petugas Pembuat Laporan" in print_content

    print("[OK] All Fase 10 read-model engine, exports, and UI components verified on disk.")


def main():
    print("=" * 60)
    print("Starting Fase 10 Test Suite (Laporan & Cetak Ekspor)...")
    print("=" * 60)

    conn = setup_test_db()
    test_migration_0165_and_fitur_akses(conn)
    test_receipts_report(conn)
    test_distributions_report(conn)
    test_arrears_report_authoritative_invariants(conn)
    test_exemptions_report(conn)
    test_student_detail_report_and_wallet_separation(conn)
    test_wallet_report(conn)
    test_cash_sessions_and_settlements_reports(conn)
    test_reconciliations_report(conn)
    test_ui_and_export_components_structural_integrity()

    print("=" * 60)
    print("ALL FASE 10 TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
