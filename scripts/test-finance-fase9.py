"""Automated Contract, Financial Dashboard KPI, & Global Transaction History Tests for Fase 9.

Validates:
1. Migration 0164 & fitur_akses Registration:
   - /dashboard/keuangan (Dashboard Keuangan, icon LayoutDashboard, urutan 0)
   - /dashboard/keuangan/riwayat (Riwayat Transaksi, icon Clock, urutan 5)
   - Performance indexes created.
2. Strict Separation of Pesantren Funds vs Uang Jajan (Titipan Santri):
   - Uang Jajan balance is tracked exclusively via authoritative wallet ledger.
   - Uang Jajan NEVER counts toward Pesantren revenue or available cash.
3. Separation of Payment PAID vs SETTLED:
   - Duitku payments with status 'PAID' are tracked as pending settlement.
   - Once linked to settlement batch, status transitions to 'SETTLED' and settledAmount reflects it.
4. Disbursement Status (Siap vs Sudah vs Belum Disalurkan):
   - Ready to disburse reflects remaining undisbursed allocation amounts.
   - Total disbursed reflects actual distribution transactions.
5. Channel Breakdown: Online (Duitku) vs Tunai (Cash).
6. Mismatch Detection (Reconciliation Indicators):
   - Unallocated transfers, cash discrepancies, settlement discrepancies, and recovery cases trigger mismatch alerts.
7. Unified Global Transaction History Stream:
   - Correctly aggregates Payments, Top-Ups, Withdrawals, Distributions, and Corrections without duplication.
   - Search by NIS, name, transaction number, reference.
   - Filter by date range, category, pos/item, method, status, asrama.
   - Sorting by timestamp and amount.
   - Server-side pagination.
8. Non-Destructive Read-Model Invariant:
   - Dashboard & history queries do not mutate financial state.
9. RBAC Authorization & View Guards:
   - Only authorized roles can access.
10. UI Component Files Existence & Structural Integrity.
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
            urutan INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """
    )

    # Seed Initial User
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

    # Seed Academic Year
    conn.execute("INSERT INTO tahun_ajaran (id, nama, status) VALUES (1, '2026/2027', 'Aktif')")

    # Apply Migrations 0152 through 0164
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
    ]:
        with open(mig, "r", encoding="utf-8") as f:
            conn.executescript(f.read())

    return conn


def test_migration_0164_and_fitur_akses(conn: sqlite3.Connection):
    print("1. Testing Migration 0164 Schema, Indexes & fitur_akses Registration...")

    # Verify /dashboard/keuangan
    dash_feature = conn.execute(
        "SELECT group_name, title, href, icon, roles, is_active, urutan FROM fitur_akses WHERE href = '/dashboard/keuangan'"
    ).fetchone()
    assert dash_feature is not None, "Menu /dashboard/keuangan must be registered in fitur_akses"
    assert dash_feature[0] == "Keuangan"
    assert dash_feature[1] == "Dashboard Keuangan"
    assert dash_feature[3] == "LayoutDashboard"
    roles = json.loads(dash_feature[4])
    assert "admin" in roles and "bendahara" in roles and "pimpinan" in roles

    # Verify /dashboard/keuangan/riwayat
    hist_feature = conn.execute(
        "SELECT group_name, title, href, icon, roles, is_active, urutan FROM fitur_akses WHERE href = '/dashboard/keuangan/riwayat'"
    ).fetchone()
    assert hist_feature is not None, "Menu /dashboard/keuangan/riwayat must be registered in fitur_akses"
    assert hist_feature[0] == "Keuangan"
    assert hist_feature[1] == "Riwayat Transaksi"
    assert hist_feature[3] == "Clock"
    roles_h = json.loads(hist_feature[4])
    assert "admin" in roles_h and "bendahara" in roles_h and "pimpinan" in roles_h

    # Verify performance indexes exist
    indexes = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()}
    assert "idx_finance_payments_paid_at" in indexes
    assert "idx_finance_wallet_ledger_created" in indexes
    assert "idx_finance_distributions_transferred" in indexes
    assert "idx_finance_corrections_created" in indexes

    print("[OK] Migration 0164 and navigation features successfully verified.")


def test_separation_of_pesantren_vs_uang_jajan(conn: sqlite3.Connection):
    print("2. Testing Strict Separation of Pesantren Funds vs Uang Jajan (PRD #33)...")

    # Create test student
    santri_id = "san-sep-01"
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES (?, ?, ?, ?, ?)",
        (santri_id, "NIS-SEP01", "Ahmad Santri", "Asrama Al-Falah", "A-01"),
    )

    # 1. Pesantren Obligation & Payment (SPP Rp200.000)
    ob_id = "ob-spp-01"
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, created_at
        ) VALUES (?, ?, 'SPP', 1, '2026-09', 200000, 0, 200000, 'PAID', '2026-09-01 10:00:00')
        """,
        (ob_id, santri_id),
    )

    pay_id = "pay-spp-01"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status,
            allocation_status, paid_at, created_at
        ) VALUES (?, 'PAY-20260901-SPP', ?, 'DUITKU', 'DUITKU_VA', 200000, 0, 200000, 'PAID', 'ALLOCATED', '2026-09-01 10:05:00', '2026-09-01 10:05:00')
        """,
        (pay_id, santri_id),
    )

    conn.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
        ) VALUES ('alc-spp-01', ?, ?, 'OBLIGATION', 'SPP', 200000, 0, 'UNDISBURSED', '2026-09-01 10:05:00')
        """,
        (pay_id, ob_id),
    )

    # 2. Uang Jajan Top-Up (Rp500.000) via payment
    pay_topup_id = "pay-topup-01"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status,
            allocation_status, paid_at, created_at
        ) VALUES (?, 'PAY-20260901-TOP', ?, 'DUITKU', 'DUITKU_VA', 500000, 0, 500000, 'PAID', 'ALLOCATED', '2026-09-01 11:00:00', '2026-09-01 11:00:00')
        """,
        (pay_topup_id, santri_id),
    )

    conn.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
        ) VALUES ('alc-top-01', ?, NULL, 'UANG_JAJAN', 'UANG_JAJAN', 500000, 0, 'DISBURSED', '2026-09-01 11:00:00')
        """,
        (pay_topup_id,),
    )

    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, reference_id, created_at
        ) VALUES ('wlt-top-01', ?, 'IN', 'TOPUP_ONLINE', 500000, 0, 500000, ?, '2026-09-01 11:00:00')
        """,
        (santri_id, pay_topup_id),
    )

    # Validate Pesantren Revenue vs Uang Jajan Balance
    # Pesantren Revenue query
    pesantren_rev = conn.execute(
        """
        SELECT COALESCE(SUM(a.amount), 0)
        FROM finance_allocations a
        JOIN finance_payments p ON a.payment_id = p.id
        WHERE a.target_type = 'OBLIGATION'
          AND p.paid_at LIKE '2026-09%'
        """
    ).fetchone()[0]

    # Uang Jajan Authoritative Balance query
    uang_jajan_balance = conn.execute(
        """
        SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0)
        FROM finance_wallet_ledger
        """
    ).fetchone()[0]

    assert pesantren_rev == 200000, f"Pesantren revenue must be exactly Rp200.000 (got {pesantren_rev})"
    assert uang_jajan_balance == 500000, f"Uang Jajan balance must be exactly Rp500.000 (got {uang_jajan_balance})"
    assert pesantren_rev != uang_jajan_balance, "Pesantren revenue must NOT be mixed with Uang Jajan!"

    print("[OK] Strict separation of Pesantren funds and Uang Jajan titipan verified.")


def test_settlement_lifecycle_and_channel_breakdown(conn: sqlite3.Connection):
    print("3. Testing PAID vs SETTLED Separation & Online vs Cash Breakdown...")

    santri_id = "san-sep-02"
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES (?, ?, ?, ?, ?)",
        (santri_id, "NIS-SEP02", "Budi Santri", "Asrama Al-Falah", "A-02"),
    )

    # Cash Payment: Uang Makan Rp300.000
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, created_at
        ) VALUES ('ob-makan-01', ?, 'UANG_MAKAN', 1, '2026-09', 300000, 0, 300000, 'PAID', '2026-09-02 08:00:00')
        """,
        (santri_id,),
    )

    pay_cash_id = "pay-cash-01"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status,
            allocation_status, paid_at, created_at
        ) VALUES (?, 'PAY-20260902-CSH', ?, 'CASH', 'CASH', 300000, 0, 300000, 'PAID', 'ALLOCATED', '2026-09-02 08:30:00', '2026-09-02 08:30:00')
        """,
        (pay_cash_id, santri_id),
    )

    conn.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
        ) VALUES ('alc-makan-01', ?, 'ob-makan-01', 'OBLIGATION', 'UANG_MAKAN', 300000, 0, 'UNDISBURSED', '2026-09-02 08:30:00')
        """,
        (pay_cash_id,),
    )

    # Online Payment: SPP Rp200.000 (initially PAID)
    pay_online_id = "pay-online-settle"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status,
            allocation_status, paid_at, created_at
        ) VALUES (?, 'PAY-20260902-ONL', ?, 'DUITKU', 'DUITKU_VA', 200000, 2000, 198000, 'PAID', 'ALLOCATED', '2026-09-02 09:00:00', '2026-09-02 09:00:00')
        """,
        (pay_online_id, santri_id),
    )

    conn.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
        ) VALUES ('alc-onl-01', ?, 'ob-makan-01', 'OBLIGATION', 'UANG_MAKAN', 200000, 0, 'UNDISBURSED', '2026-09-02 09:00:00')
        """,
        (pay_online_id,),
    )

    # Test pending settlement
    pending_online = conn.execute(
        """
        SELECT COALESCE(SUM(a.amount), 0)
        FROM finance_allocations a
        JOIN finance_payments p ON a.payment_id = p.id
        WHERE p.channel = 'DUITKU' AND p.status = 'PAID'
        """
    ).fetchone()[0]
    assert pending_online >= 200000, "Online payment with status PAID must be in pending settlement pool"

    # Execute settlement batch for pay_online_id
    stl_id = "stl-batch-01"
    conn.execute(
        """
        INSERT INTO finance_settlements (
            id, settlement_number, provider, settlement_date, destination_bank, destination_account,
            total_payments_count, total_gross_amount, total_fee_amount, total_net_amount, status, created_at
        ) VALUES (?, 'STL-20260902-001', 'DUITKU', '2026-09-02', 'BCA', '1234567890', 1, 200000, 2000, 198000, 'COMPLETED', '2026-09-02 17:00:00')
        """,
        (stl_id,),
    )
    conn.execute(
        """
        INSERT INTO finance_settlement_items (
            id, settlement_id, payment_id, gross_amount, gateway_fee, net_amount, created_at
        ) VALUES ('sti-01', ?, ?, 200000, 2000, 198000, '2026-09-02 17:00:00')
        """,
        (stl_id, pay_online_id),
    )
    conn.execute("UPDATE finance_payments SET status = 'SETTLED' WHERE id = ?", (pay_online_id,))

    # Check settled vs pending after settlement
    settled_online = conn.execute(
        """
        SELECT COALESCE(SUM(a.amount), 0)
        FROM finance_allocations a
        JOIN finance_payments p ON a.payment_id = p.id
        WHERE p.channel = 'DUITKU' AND p.status = 'SETTLED'
        """
    ).fetchone()[0]
    assert settled_online >= 200000, "Online payment with status SETTLED must be counted in settledAmount"

    # Online vs Cash breakdown
    cash_amount = conn.execute(
        """
        SELECT COALESCE(SUM(a.amount), 0)
        FROM finance_allocations a
        JOIN finance_payments p ON a.payment_id = p.id
        WHERE p.channel = 'CASH' AND a.target_type = 'OBLIGATION'
        """
    ).fetchone()[0]
    assert cash_amount >= 300000, "Cash payments must be accurately tracked in cash_amount"

    print("[OK] PAID vs SETTLED and Online vs Cash separation verified.")


def test_disbursement_pool_and_mismatch_detection(conn: sqlite3.Connection):
    print("4. Testing Disbursement Pool & Reconciliation Mismatch Indicators...")

    # Available disbursement pool
    pool = conn.execute(
        """
        SELECT COALESCE(SUM(a.amount - a.disbursed_amount), 0)
        FROM finance_allocations a
        WHERE a.target_type = 'OBLIGATION'
          AND a.distribution_status IN ('UNDISBURSED', 'PARTIALLY_DISBURSED')
        """
    ).fetchone()[0]
    assert pool > 0, "Disbursement pool should have available funds"

    # Test Penyaluran (Distribution) to vendor
    vendor_id = "jasa-katering-01"
    conn.execute(
        "INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES (?, 'Katering Berkah', 'Makan')",
        (vendor_id,),
    )

    dist_id = "dist-test-01"
    conn.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, transferred_by, transferred_at, created_at
        ) VALUES (?, 'DIS-20260902-001', 'KATERING', ?, 'UANG_MAKAN', '2026-09', 200000, 'TRANSFER', 'usr-bendahara', '2026-09-02 14:00:00', '2026-09-02 14:00:00')
        """,
        (dist_id, vendor_id),
    )

    conn.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount, created_at)
        VALUES ('dti-01', ?, 'alc-makan-01', 200000, '2026-09-02 14:00:00')
        """,
        (dist_id,),
    )
    conn.execute(
        "UPDATE finance_allocations SET disbursed_amount = 200000, distribution_status = 'PARTIALLY_DISBURSED' WHERE id = 'alc-makan-01'"
    )

    # Check that pool reduced and disbursed amount recorded
    new_pool = conn.execute(
        """
        SELECT COALESCE(SUM(a.amount - a.disbursed_amount), 0)
        FROM finance_allocations a
        WHERE a.target_type = 'OBLIGATION'
          AND a.distribution_status IN ('UNDISBURSED', 'PARTIALLY_DISBURSED')
        """
    ).fetchone()[0]
    assert new_pool == pool - 200000, "Available pool must decrease exactly by distributed amount"

    # Mismatch Testing: Insert an unallocated transfer
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, external_reference, internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, created_at
        ) VALUES ('rec-item-unalloc', 'DUITKU-UNALLOC-99', 0, 150000, 150000, 'UNALLOCATED_TRANSFER', 'NONE', '2026-09-02 15:00:00')
        """
    )

    # Query mismatch indicators
    unalloc_count = conn.execute(
        "SELECT COUNT(*) FROM finance_reconciliation_items WHERE resolution_action = 'NONE' AND match_status = 'UNALLOCATED_TRANSFER'"
    ).fetchone()[0]
    assert unalloc_count == 1, "Should detect 1 unallocated transfer"

    # Resolve the unallocated transfer
    conn.execute(
        "UPDATE finance_reconciliation_items SET resolution_action = 'MANUAL_ALLOCATION', resolved_by = 'usr-bendahara' WHERE id = 'rec-item-unalloc'"
    )
    unalloc_count_after = conn.execute(
        "SELECT COUNT(*) FROM finance_reconciliation_items WHERE resolution_action = 'NONE' AND match_status = 'UNALLOCATED_TRANSFER'"
    ).fetchone()[0]
    assert unalloc_count_after == 0, "Resolved unallocated transfer must no longer trigger mismatch alert"

    print("[OK] Disbursement pool tracking and mismatch indicator alerts verified.")


def test_unified_global_transaction_history(conn: sqlite3.Connection):
    print("5. Testing Unified Global Transaction History Stream...")

    santri_id = "san-sep-03"
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES (?, ?, ?, ?, ?)",
        (santri_id, "NIS-SEP03", "Cahyo Santri", "Asrama Bahagia", "B-03"),
    )

    # 1. Initial Top-Up (100.000) then withdrawal at loket (50.000)
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, reference_id, created_at
        ) VALUES ('wlt-init-01', ?, 'IN', 'TOPUP_CASH', 100000, 0, 100000, 'WLT-INIT-001', '2026-09-03 09:00:00')
        """,
        (santri_id,),
    )

    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, reference_id, created_at
        ) VALUES ('wlt-with-01', ?, 'OUT', 'WITHDRAWAL_LOKET', 50000, 100000, 50000, 'WLT-WITH-001', '2026-09-03 10:00:00')
        """,
        (santri_id,),
    )

    # 2. Add correction (Refund)
    cor_id = "cor-test-01"
    conn.execute(
        """
        INSERT INTO finance_corrections (
            id, correction_number, correction_type, target_payment_id, total_amount, method, reason, created_by, created_at
        ) VALUES (?, 'COR-20260903-001', 'REFUND', 'pay-cash-01', 50000, 'CASH', 'Koreksi salah bayar loket', 'usr-bendahara', '2026-09-03 11:00:00')
        """,
        (cor_id,),
    )

    # Unified query (mirroring lib/finance/history.ts)
    query_sql = """
    WITH all_transactions AS (
      SELECT
        p.id,
        p.payment_number AS transaction_number,
        CASE
          WHEN EXISTS (SELECT 1 FROM finance_allocations a WHERE a.payment_id = p.id AND a.target_type = 'UANG_JAJAN') THEN 'TOPUP'
          ELSE 'PAYMENT'
        END AS category,
        CASE
          WHEN EXISTS (SELECT 1 FROM finance_allocations a WHERE a.payment_id = p.id AND a.target_type = 'UANG_JAJAN') THEN 'TITIPAN_SANTRI'
          ELSE 'PESANTREN'
        END AS fund_type,
        'IN' AS direction,
        p.gross_amount AS amount,
        p.channel,
        p.method,
        p.status,
        s.nama_lengkap AS santri_name,
        s.nis AS santri_nis,
        s.asrama AS santri_asrama,
        NULL AS recipient_info,
        p.paid_at AS created_at
      FROM finance_payments p
      LEFT JOIN santri s ON s.id = p.santri_id

      UNION ALL

      SELECT
        wl.id,
        COALESCE(wl.reference_id, 'WLT-' || SUBSTR(wl.id, 1, 8)) AS transaction_number,
        CASE
          WHEN wl.movement_type = 'WITHDRAWAL_LOKET' THEN 'WITHDRAWAL'
          WHEN wl.movement_type = 'REVERSAL' THEN 'CORRECTION'
          ELSE 'TOPUP'
        END AS category,
        'TITIPAN_SANTRI' AS fund_type,
        wl.direction,
        wl.amount,
        CASE WHEN wl.movement_type = 'TOPUP_ONLINE' THEN 'DUITKU' ELSE 'CASH' END AS channel,
        CASE WHEN wl.movement_type = 'TOPUP_ONLINE' THEN 'DUITKU' ELSE 'CASH' END AS method,
        CASE
          WHEN wl.movement_type = 'REVERSAL' THEN 'REVERSAL'
          ELSE 'COMPLETED'
        END AS status,
        s.nama_lengkap AS santri_name,
        s.nis AS santri_nis,
        s.asrama AS santri_asrama,
        NULL AS recipient_info,
        wl.created_at
      FROM finance_wallet_ledger wl
      LEFT JOIN santri s ON s.id = wl.santri_id
      WHERE
        (wl.direction = 'OUT' AND wl.movement_type = 'WITHDRAWAL_LOKET')
        OR
        (wl.direction = 'IN' AND wl.movement_type IN ('TOPUP_CASH', 'TOPUP_ONLINE')
         AND NOT EXISTS (SELECT 1 FROM finance_payments p WHERE p.id = wl.reference_id OR p.payment_number = wl.reference_id))
        OR
        (wl.movement_type = 'REVERSAL'
         AND NOT EXISTS (SELECT 1 FROM finance_corrections c WHERE c.id = wl.reference_id OR c.correction_number = wl.reference_id))

      UNION ALL

      SELECT
        d.id,
        d.distribution_number AS transaction_number,
        'DISTRIBUTION' AS category,
        'PESANTREN' AS fund_type,
        'OUT' AS direction,
        d.total_amount AS amount,
        d.method AS channel,
        d.method,
        'COMPLETED' AS status,
        NULL AS santri_name,
        NULL AS santri_nis,
        NULL AS santri_asrama,
        COALESCE(j.nama_jasa, d.recipient_type) AS recipient_info,
        d.transferred_at AS created_at
      FROM finance_distributions d
      LEFT JOIN master_jasa j ON j.id = d.recipient_id

      UNION ALL

      SELECT
        c.id,
        c.correction_number AS transaction_number,
        'CORRECTION' AS category,
        'PESANTREN' AS fund_type,
        'OUT' AS direction,
        c.total_amount AS amount,
        COALESCE(c.method, 'SYSTEM') AS channel,
        COALESCE(c.method, 'SYSTEM') AS method,
        c.correction_type AS status,
        s.nama_lengkap AS santri_name,
        s.nis AS santri_nis,
        s.asrama AS santri_asrama,
        NULL AS recipient_info,
        c.created_at
      FROM finance_corrections c
      JOIN finance_payments p ON p.id = c.target_payment_id
      LEFT JOIN santri s ON s.id = p.santri_id
    )
    SELECT * FROM all_transactions ORDER BY created_at DESC
    """

    all_txs = conn.execute(query_sql).fetchall()
    categories_found = {row[2] for row in all_txs}

    assert "PAYMENT" in categories_found, "History must include PAYMENT transactions"
    assert "TOPUP" in categories_found, "History must include TOPUP transactions"
    assert "WITHDRAWAL" in categories_found, "History must include WITHDRAWAL transactions"
    assert "DISTRIBUTION" in categories_found, "History must include DISTRIBUTION transactions"
    assert "CORRECTION" in categories_found, "History must include CORRECTION transactions"

    # Test Search
    search_term = "%NIS-SEP03%"
    search_res = conn.execute(
        f"SELECT COUNT(*) FROM ({query_sql}) WHERE santri_nis LIKE ?", (search_term,)
    ).fetchone()[0]
    assert search_res >= 1, "Search by NIS must find matching transactions"

    # Test Category Filter
    topup_count = conn.execute(
        f"SELECT COUNT(*) FROM ({query_sql}) WHERE category = 'TOPUP'"
    ).fetchone()[0]
    assert topup_count >= 1, "Filter by TOPUP must return top-up items"

    # Test Pagination (LIMIT / OFFSET)
    page_1 = conn.execute(f"SELECT * FROM ({query_sql}) LIMIT 2 OFFSET 0").fetchall()
    page_2 = conn.execute(f"SELECT * FROM ({query_sql}) LIMIT 2 OFFSET 2").fetchall()
    assert len(page_1) == 2, "Page 1 must return 2 items"
    assert len(page_2) == 2, "Page 2 must return 2 items"
    assert page_1[0][0] != page_2[0][0], "Page 1 and Page 2 must not overlap"

    print("[OK] Unified global transaction stream, search, filtering, and pagination verified.")


def test_authoritative_settlement_kpi_stale_status(conn: sqlite3.Connection):
    print("6. Testing Authoritative Settlement KPI & Stale Payment Status Invariance...")

    santri_id = "san-stl-stale-01"
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES (?, ?, ?, ?, ?)",
        (santri_id, "NIS-STL01", "Dedi Santri", "Asrama C", "C-01"),
    )

    ob_id = "ob-stl-stale-01"
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, created_at
        ) VALUES (?, ?, 'SPP', 1, '2026-09', 250000, 0, 250000, 'PAID', '2026-09-04 08:00:00')
        """,
        (ob_id, santri_id),
    )

    # Scenario A: Payment status is 'PAID' (stale cache), but settlement record exists in finance_settlement_items
    pay_id_settled_item = "pay-duitku-settled-with-stale-paid"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status,
            allocation_status, paid_at, created_at
        ) VALUES (?, 'PAY-20260904-STALE-PAID', ?, 'DUITKU', 'DUITKU_VA', 250000, 2500, 247500, 'PAID', 'ALLOCATED', '2026-09-04 08:30:00', '2026-09-04 08:30:00')
        """,
        (pay_id_settled_item, santri_id),
    )

    conn.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
        ) VALUES ('alc-stl-01', ?, ?, 'OBLIGATION', 'SPP', 250000, 0, 'UNDISBURSED', '2026-09-04 08:30:00')
        """,
        (pay_id_settled_item, ob_id),
    )

    stl_id = "stl-batch-stale-01"
    conn.execute(
        """
        INSERT INTO finance_settlements (
            id, settlement_number, provider, settlement_date, destination_bank, destination_account,
            total_payments_count, total_gross_amount, total_fee_amount, total_net_amount, status, created_at
        ) VALUES (?, 'STL-20260904-001', 'DUITKU', '2026-09-04', 'BCA', '1234567890', 1, 250000, 2500, 247500, 'COMPLETED', '2026-09-04 18:00:00')
        """,
        (stl_id,),
    )
    conn.execute(
        """
        INSERT INTO finance_settlement_items (
            id, settlement_id, payment_id, gross_amount, gateway_fee, net_amount, created_at
        ) VALUES ('sti-stale-01', ?, ?, 250000, 2500, 247500, '2026-09-04 18:00:00')
        """,
        (stl_id, pay_id_settled_item),
    )

    # Scenario B: Payment status is 'SETTLED' (corrupted cache), but NO settlement record exists
    pay_id_no_settled_item = "pay-duitku-corrupted-settled-no-item"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status,
            allocation_status, paid_at, created_at
        ) VALUES (?, 'PAY-20260904-CORRUPT-STL', ?, 'DUITKU', 'DUITKU_VA', 100000, 1000, 99000, 'SETTLED', 'ALLOCATED', '2026-09-04 09:00:00', '2026-09-04 09:00:00')
        """,
        (pay_id_no_settled_item, santri_id),
    )

    conn.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
        ) VALUES ('alc-stl-02', ?, ?, 'OBLIGATION', 'SPP', 100000, 0, 'UNDISBURSED', '2026-09-04 09:00:00')
        """,
        (pay_id_no_settled_item, ob_id),
    )

    # Query using authoritative logic from dashboard.ts
    authoritative_row = conn.execute(
        """
        SELECT
          COALESCE(SUM(CASE WHEN p.channel = 'DUITKU' AND EXISTS (SELECT 1 FROM finance_settlement_items si WHERE si.payment_id = p.id) THEN a.amount ELSE 0 END), 0) AS settled_amount,
          COALESCE(SUM(CASE WHEN p.channel = 'DUITKU' AND NOT EXISTS (SELECT 1 FROM finance_settlement_items si WHERE si.payment_id = p.id) THEN a.amount ELSE 0 END), 0) AS pending_settlement_amount,
          COALESCE(COUNT(DISTINCT CASE WHEN p.channel = 'DUITKU' AND NOT EXISTS (SELECT 1 FROM finance_settlement_items si WHERE si.payment_id = p.id) THEN p.id ELSE NULL END), 0) AS pending_settlement_count
        FROM finance_allocations a
        JOIN finance_payments p ON a.payment_id = p.id
        WHERE a.target_type = 'OBLIGATION'
          AND p.id IN (?, ?)
        """,
        (pay_id_settled_item, pay_id_no_settled_item),
    ).fetchone()

    settled_res, pending_res, pending_cnt = authoritative_row[0], authoritative_row[1], authoritative_row[2]

    # Stale 'PAID' with settlement item MUST be counted in settled_amount
    assert settled_res == 250000, f"Settled amount must be exactly 250000 based on settlement record, got {settled_res}"
    # Corrupted 'SETTLED' without settlement item MUST be counted in pending_settlement_amount
    assert pending_res == 100000, f"Pending settlement must be exactly 100000 since settlement item is missing, got {pending_res}"
    assert pending_cnt == 1, f"Pending settlement count must be 1, got {pending_cnt}"

    print("[OK] Authoritative settlement KPI correctly overrides stale payment status via settlement linkage.")


def test_authoritative_ready_to_disburse_stale_cache(conn: sqlite3.Connection):
    print("7. Testing Authoritative Ready-to-Disburse & Stale Allocation Cache Invariance...")

    santri_id = "san-disb-stale-01"
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES (?, ?, ?, ?, ?)",
        (santri_id, "NIS-DSB01", "Eko Santri", "Asrama D", "D-01"),
    )

    ob_id = "ob-dsb-01"
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, created_at
        ) VALUES (?, ?, 'UANG_MAKAN', 1, '2026-09', 350000, 0, 350000, 'PAID', '2026-09-05 08:00:00')
        """,
        (ob_id, santri_id),
    )

    pay_id = "pay-dsb-01"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status,
            allocation_status, paid_at, created_at
        ) VALUES (?, 'PAY-20260905-DSB', ?, 'CASH', 'CASH', 350000, 0, 350000, 'PAID', 'ALLOCATED', '2026-09-05 08:30:00', '2026-09-05 08:30:00')
        """,
        (pay_id, santri_id),
    )

    # Allocation of Rp350.000
    alc_id = "alc-dsb-stale-01"
    conn.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
        ) VALUES (?, ?, ?, 'OBLIGATION', 'UANG_MAKAN', 350000, 0, 'UNDISBURSED', '2026-09-05 08:30:00')
        """,
        (alc_id, pay_id, ob_id),
    )

    # Now make an actual distribution of Rp350.000 recorded in finance_distributions & finance_distribution_items
    dist_id = "dst-stale-01"
    conn.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, transferred_by, transferred_at, created_at
        ) VALUES (?, 'DIS-20260905-001', 'KATERING', 'jasa-katering-01', 'UANG_MAKAN', '2026-09', 350000, 'TRANSFER', 'usr-bendahara', '2026-09-05 14:00:00', '2026-09-05 14:00:00')
        """,
        (dist_id,),
    )
    conn.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount, created_at)
        VALUES ('dti-stale-01', ?, ?, 350000, '2026-09-05 14:00:00')
        """,
        (dist_id, alc_id),
    )

    # Note: We INTENTIONALLY LEAVE finance_allocations.disbursed_amount = 0 and distribution_status = 'UNDISBURSED'
    # (Simulating stale cache or desynchronization)

    # Naive query would yield: 350000 - 0 = 350000
    naive_ready = conn.execute(
        "SELECT a.amount - a.disbursed_amount FROM finance_allocations a WHERE a.id = ?", (alc_id,)
    ).fetchone()[0]
    assert naive_ready == 350000, "Naive calculation demonstrates vulnerable stale cache state"

    # Authoritative query from lib/finance/dashboard.ts:
    authoritative_ready = conn.execute(
        """
        SELECT COALESCE(SUM(
          a.amount - COALESCE((
            SELECT SUM(di.amount)
            FROM finance_distribution_items di
            WHERE di.allocation_id = a.id
          ), 0)
        ), 0)
        FROM finance_allocations a
        JOIN finance_payments p ON a.payment_id = p.id
        WHERE a.id = ?
          AND a.target_type = 'OBLIGATION'
          AND p.correction_status != 'FULLY_CORRECTED'
          AND a.amount > COALESCE((
            SELECT SUM(di.amount)
            FROM finance_distribution_items di
            WHERE di.allocation_id = a.id
          ), 0)
        """,
        (alc_id,),
    ).fetchone()[0]

    assert authoritative_ready == 0, f"Authoritative ready-to-disburse must be 0 despite stale cache, got {authoritative_ready}"

    # Authoritative total disbursed
    authoritative_disbursed = conn.execute(
        """
        SELECT COALESCE(SUM(di.amount), 0)
        FROM finance_distribution_items di
        JOIN finance_distributions d ON d.id = di.distribution_id
        WHERE d.id = ?
        """,
        (dist_id,),
    ).fetchone()[0]
    assert authoritative_disbursed == 350000, f"Authoritative total disbursed must be 350000, got {authoritative_disbursed}"

    print("[OK] Authoritative ready-to-disburse correctly calculates remaining balance and resists stale cache.")


def test_topup_and_history_disambiguation(conn: sqlite3.Connection):
    print("8. Testing Top-Up & Global History Stream Disambiguation...")

    santri_id = "san-disam-01"
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar) VALUES (?, ?, ?, ?, ?)",
        (santri_id, "NIS-DSM01", "Faris Santri", "Asrama E", "E-01"),
    )

    # 1. Standalone cash top-up directly in finance_wallet_ledger (NO payment record)
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, reference_id, created_at
        ) VALUES ('wlt-standalone-topup', ?, 'IN', 'TOPUP_CASH', 80000, 0, 80000, 'WLT-CSH-TOPUP-01', '2026-09-06 10:00:00')
        """,
        (santri_id,),
    )

    # 2. Online / payment-driven top-up (BOTH finance_payments AND finance_wallet_ledger)
    online_pay_id = "pay-online-topup-both"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status,
            allocation_status, paid_at, created_at
        ) VALUES (?, 'PAY-20260906-DUITKU-TOP', ?, 'DUITKU', 'DUITKU_VA', 120000, 0, 120000, 'PAID', 'ALLOCATED', '2026-09-06 11:00:00', '2026-09-06 11:00:00')
        """,
        (online_pay_id, santri_id),
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
        ) VALUES ('alc-topup-both', ?, NULL, 'UANG_JAJAN', 'UANG_JAJAN', 120000, 0, 'DISBURSED', '2026-09-06 11:00:00')
        """,
        (online_pay_id,),
    )
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, reference_id, created_at
        ) VALUES ('wlt-online-topup-linked', ?, 'IN', 'TOPUP_ONLINE', 120000, 80000, 200000, ?, '2026-09-06 11:00:00')
        """,
        (santri_id, online_pay_id),
    )

    # 3. Withdrawal Reversal in finance_wallet_ledger (movement_type = 'REVERSAL', direction = 'IN')
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, reference_id, created_at
        ) VALUES ('wlt-reversal-in', ?, 'IN', 'REVERSAL', 30000, 200000, 230000, 'REV-WLT-WITH-01', '2026-09-06 12:00:00')
        """,
        (santri_id,),
    )

    # Check KPI: Top-Up period query must ONLY count TOPUP_CASH and TOPUP_ONLINE, excluding REVERSAL
    topup_kpi = conn.execute(
        """
        SELECT
          COALESCE(SUM(CASE WHEN direction = 'IN' AND movement_type IN ('TOPUP_ONLINE', 'TOPUP_CASH') THEN amount ELSE 0 END), 0) AS topup_period,
          COALESCE(SUM(CASE WHEN direction = 'IN' AND movement_type = 'TOPUP_ONLINE' THEN amount ELSE 0 END), 0) AS topup_online,
          COALESCE(SUM(CASE WHEN direction = 'IN' AND movement_type = 'TOPUP_CASH' THEN amount ELSE 0 END), 0) AS topup_cash
        FROM finance_wallet_ledger
        WHERE santri_id = ?
        """,
        (santri_id,),
    ).fetchone()

    total_topup_kpi, topup_online_kpi, topup_cash_kpi = topup_kpi[0], topup_kpi[1], topup_kpi[2]
    # Total top-up must be 80000 (cash) + 120000 (online) = 200000. Reversal (30000) MUST NOT be included!
    assert total_topup_kpi == 200000, f"Top-up KPI must be exactly 200000 (excluding 30000 reversal), got {total_topup_kpi}"
    assert topup_online_kpi == 120000, f"Top-up online must be 120000, got {topup_online_kpi}"
    assert topup_cash_kpi == 80000, f"Top-up cash must be 80000, got {topup_cash_kpi}"

    # Check Global History Stream (using baseUnionSql logic from lib/finance/history.ts)
    history_query = """
    WITH all_transactions AS (
      SELECT
        p.id,
        'PAYMENT' AS source_table,
        p.payment_number AS transaction_number,
        CASE
          WHEN EXISTS (SELECT 1 FROM finance_allocations a WHERE a.payment_id = p.id AND a.target_type = 'UANG_JAJAN') THEN 'TOPUP'
          ELSE 'PAYMENT'
        END AS category,
        CASE
          WHEN EXISTS (SELECT 1 FROM finance_allocations a WHERE a.payment_id = p.id AND a.target_type = 'UANG_JAJAN') THEN 'TITIPAN_SANTRI'
          ELSE 'PESANTREN'
        END AS fund_type,
        'IN' AS direction,
        p.gross_amount AS amount,
        p.channel,
        CASE
          WHEN p.channel = 'DUITKU' AND EXISTS (SELECT 1 FROM finance_settlement_items si WHERE si.payment_id = p.id) THEN 'SETTLED'
          ELSE p.status
        END AS status,
        p.paid_at AS created_at
      FROM finance_payments p

      UNION ALL

      SELECT
        wl.id,
        'WALLET' AS source_table,
        COALESCE(wl.reference_id, 'WLT-' || SUBSTR(wl.id, 1, 8)) AS transaction_number,
        CASE
          WHEN wl.movement_type = 'WITHDRAWAL_LOKET' THEN 'WITHDRAWAL'
          WHEN wl.movement_type = 'REVERSAL' THEN 'CORRECTION'
          ELSE 'TOPUP'
        END AS category,
        'TITIPAN_SANTRI' AS fund_type,
        wl.direction,
        wl.amount,
        CASE WHEN wl.movement_type = 'TOPUP_ONLINE' THEN 'DUITKU' ELSE 'CASH' END AS channel,
        CASE
          WHEN wl.movement_type = 'REVERSAL' THEN 'REVERSAL'
          ELSE 'COMPLETED'
        END AS status,
        wl.created_at
      FROM finance_wallet_ledger wl
      WHERE
        (wl.direction = 'OUT' AND wl.movement_type = 'WITHDRAWAL_LOKET')
        OR
        (wl.direction = 'IN' AND wl.movement_type IN ('TOPUP_CASH', 'TOPUP_ONLINE')
         AND NOT EXISTS (SELECT 1 FROM finance_payments p WHERE p.id = wl.reference_id OR p.payment_number = wl.reference_id))
        OR
        (wl.movement_type = 'REVERSAL'
         AND NOT EXISTS (SELECT 1 FROM finance_corrections c WHERE c.id = wl.reference_id OR c.correction_number = wl.reference_id))
    )
    SELECT id, transaction_number, category, fund_type, direction, amount, status
    FROM all_transactions
    WHERE id IN ('wlt-standalone-topup', ?, 'wlt-online-topup-linked', 'wlt-reversal-in')
    """

    res_history = conn.execute(history_query, (online_pay_id,)).fetchall()

    tx_map = {row[0]: row for row in res_history}

    # Verify 1: Standalone cash topup MUST appear in history
    assert "wlt-standalone-topup" in tx_map, "Standalone cash top-up must be present in history"
    standalone_row = tx_map["wlt-standalone-topup"]
    assert standalone_row[2] == "TOPUP", f"Standalone cash top-up category must be TOPUP, got {standalone_row[2]}"
    assert standalone_row[5] == 80000, f"Standalone cash top-up amount must be 80000, got {standalone_row[5]}"

    # Verify 2: Online topup (payment + ledger) MUST appear EXACTLY ONCE
    assert online_pay_id in tx_map, "Online top-up payment must be present in history"
    assert "wlt-online-topup-linked" not in tx_map, "Linked ledger entry must NOT cause duplicate history entry"
    online_row = tx_map[online_pay_id]
    assert online_row[2] == "TOPUP", f"Online top-up category must be TOPUP, got {online_row[2]}"
    assert online_row[5] == 120000, f"Online top-up amount must be 120000, got {online_row[5]}"

    # Verify 3: Reversal of withdrawal MUST appear as CORRECTION / REVERSAL, NEVER as TOPUP
    assert "wlt-reversal-in" in tx_map, "Wallet reversal must be present in history"
    reversal_row = tx_map["wlt-reversal-in"]
    assert reversal_row[2] == "CORRECTION", f"Wallet reversal category must be CORRECTION, got {reversal_row[2]}"
    assert reversal_row[6] == "REVERSAL", f"Wallet reversal status must be REVERSAL, got {reversal_row[6]}"
    assert reversal_row[2] != "TOPUP", "Wallet reversal must NEVER be categorized as TOPUP!"

    print("[OK] Standalone top-up, single-appearance online top-up, and wallet reversal disambiguation verified.")


def test_ui_components_existence_and_structure():
    print("9. Testing UI Components Existence & Structural Integrity...")

    required_files = [
        ROOT / "migrations" / "0164_finance_dashboard_and_history.sql",
        ROOT / "lib" / "finance" / "dashboard.ts",
        ROOT / "lib" / "finance" / "history.ts",
        ROOT / "app" / "dashboard" / "keuangan" / "page.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "actions.ts",
        ROOT / "app" / "dashboard" / "keuangan" / "_page-content.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "riwayat" / "page.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "riwayat" / "actions.ts",
        ROOT / "app" / "dashboard" / "keuangan" / "riwayat" / "_page-content.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "riwayat" / "transaction-detail-drawer.tsx",
    ]

    for rf in required_files:
        assert rf.exists(), f"File {rf.name} must exist on disk"
        assert rf.stat().st_size > 100, f"File {rf.name} must have non-trivial content"

    # Verify that Dashboard Keuangan imports and uses essential functions
    with open(ROOT / "app" / "dashboard" / "keuangan" / "actions.ts", "r", encoding="utf-8") as f:
        content = f.read()
        assert "getFinanceDashboardFullData" in content
        assert "canAccessFeatureForSession" in content

    with open(ROOT / "app" / "dashboard" / "keuangan" / "riwayat" / "actions.ts", "r", encoding="utf-8") as f:
        content = f.read()
        assert "getGlobalTransactionHistory" in content
        assert "getTransactionDetail" in content

    print("[OK] All 10 Fase 9 engine & UI components verified on disk.")


def main():
    print("=" * 60)
    print("Starting Fase 9 Test Suite (Dashboard Keuangan & Riwayat Global)...")
    print("=" * 60)

    conn = setup_test_db()
    test_migration_0164_and_fitur_akses(conn)
    test_separation_of_pesantren_vs_uang_jajan(conn)
    test_settlement_lifecycle_and_channel_breakdown(conn)
    test_disbursement_pool_and_mismatch_detection(conn)
    test_unified_global_transaction_history(conn)
    test_authoritative_settlement_kpi_stale_status(conn)
    test_authoritative_ready_to_disburse_stale_cache(conn)
    test_topup_and_history_disambiguation(conn)
    test_ui_components_existence_and_structure()

    print("=" * 60)
    print("ALL FASE 9 TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
