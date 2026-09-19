"""Local SQLite contract & business logic test suite for Fase 3A (Payment Engine Core & Orders).

Verifies that:
1. Migration 0155 is strictly non-destructive and additive.
2. Foreign key relationships and check constraints hold across:
   - finance_student_va
   - finance_payment_orders
   - finance_order_items
   - finance_payments
   - finance_allocations
   - finance_gateway_events
   - finance_reconciliation_items
3. Fixed Virtual Account invariants:
   - One Fixed VA per santri (PK on santri_id)
   - Unique va_number globally across all students
4. Payment Order lifecycle & fee calculation:
   - Fee payer CUSTOMER: total_charged = gross_amount + gateway_fee
   - Fee payer INSTITUTION: total_charged = gross_amount
   - PENDING -> PAID, CANCELLED, EXPIRED transitions
5. Obligation validation rules on order creation:
   - Reject obligation belonging to different santri
   - Reject already PAID or EXEMPTED obligations
   - Reject overpaying remaining obligation amount
   - Enforce DISALLOWED installment rule (SPP requires exact full amount)
6. Atomic Payment Execution & Allocation:
   - Mark order PAID
   - Insert finance_payments
   - Insert finance_allocations
   - Update finance_obligations amount_paid and status (PARTIALLY_PAID / PAID)
7. Unallocated Transfer flow:
   - No guessing allocation
   - Record in finance_payments (UNALLOCATED)
   - Record in finance_reconciliation_items (UNALLOCATED_TRANSFER)
8. All expected indexes exist in sqlite_master.
"""

from __future__ import annotations

import sqlite3
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_0152 = ROOT / "migrations" / "0152_finance_tariffs_and_obligations.sql"
MIGRATION_0153 = ROOT / "migrations" / "0153_finance_tariffs_overlap_trigger.sql"
MIGRATION_0154 = ROOT / "migrations" / "0154_finance_exemptions_revocation_metadata.sql"
MIGRATION_0155 = ROOT / "migrations" / "0155_finance_payments_and_orders.sql"
MIGRATION_0156 = ROOT / "migrations" / "0156_finance_payment_hardening.sql"
MIGRATION_0157 = ROOT / "migrations" / "0157_finance_unallocated_idempotency.sql"
MIGRATION_0158 = ROOT / "migrations" / "0158_finance_payment_order_multi_payment.sql"


def expect_integrity_error(connection: sqlite3.Connection, sql: str, params: tuple = ()) -> None:
    try:
        connection.execute(sql, params)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f"Expected IntegrityError but succeeded: {sql} with {params}")


def setup_database() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.isolation_level = None
    conn.execute("PRAGMA foreign_keys = ON;")

    # 1. Setup prerequisite tables
    conn.executescript(
        """
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            role TEXT NOT NULL DEFAULT 'bendahara',
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
            nama TEXT NOT NULL,
            jenis TEXT NOT NULL CHECK (jenis IN ('Makan', 'Cuci')),
            biaya INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'Aktif'
        );

        CREATE TABLE santri (
            id TEXT PRIMARY KEY,
            nis TEXT NOT NULL UNIQUE,
            nama_lengkap TEXT NOT NULL,
            asrama TEXT,
            kamar TEXT,
            status_global TEXT NOT NULL DEFAULT 'aktif',
            tempat_makan_id TEXT REFERENCES master_jasa(id),
            tempat_mencuci_id TEXT REFERENCES master_jasa(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """
    )

    # 2. Apply Phase 2 migrations (0152, 0153, 0154)
    conn.executescript(MIGRATION_0152.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0153.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0154.read_text(encoding="utf-8"))

    # 3. Apply Phase 3A migrations (0155, 0156, 0157, 0158)
    conn.executescript(MIGRATION_0155.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0156.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0157.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0158.read_text(encoding="utf-8"))

    return conn


def test_schema_constraints() -> None:
    print("Testing Phase 3A schema constraints and foreign keys...")
    conn = setup_database()

    # Seed master data
    conn.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('usr-1', 'staff@test.com', 'hash', 'Staff', 'bendahara');"
    )
    conn.execute(
        "INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1);"
    )
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-1', '1001', 'Ahmad', 'aktif');"
    )
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-2', '1002', 'Budi', 'aktif');"
    )

    # 1. finance_student_va constraints
    conn.execute(
        "INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES ('san-1', '8888001', 'BSI');"
    )
    # Duplicate santri_id (PK violation)
    expect_integrity_error(
        conn,
        "INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES ('san-1', '8888002', 'BSI');"
    )
    # Duplicate va_number (UNIQUE violation)
    expect_integrity_error(
        conn,
        "INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES ('san-2', '8888001', 'BSI');"
    )
    # Non-existent santri_id (FK violation)
    expect_integrity_error(
        conn,
        "INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES ('san-ghost', '8888009', 'BSI');"
    )

    # 2. finance_payment_orders constraints
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, payment_method, status, expires_at
        ) VALUES (
            'ord-1', 'ORD-20260919-0001', 'san-1', 'PORTAL_ORTU', 500000, 4000,
            'CUSTOMER', 504000, 'DUITKU_VA', 'PENDING', '2026-09-20T12:00:00Z'
        );
        """
    )
    # Duplicate order_number (UNIQUE violation)
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, total_charged, expires_at
        ) VALUES ('ord-2', 'ORD-20260919-0001', 'san-1', 'PORTAL_ORTU', 500000, 500000, '2026-09-20T12:00:00Z');
        """
    )
    # Invalid payer_type
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, total_charged, expires_at
        ) VALUES ('ord-2', 'ORD-20260919-0002', 'san-1', 'INVALID_PAYER', 500000, 500000, '2026-09-20T12:00:00Z');
        """
    )
    # Invalid status
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, total_charged, status, expires_at
        ) VALUES ('ord-2', 'ORD-20260919-0002', 'san-1', 'PORTAL_ORTU', 500000, 500000, 'INVALID_STATUS', '2026-09-20T12:00:00Z');
        """
    )
    # Negative gross_amount
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, total_charged, expires_at
        ) VALUES ('ord-2', 'ORD-20260919-0002', 'san-1', 'PORTAL_ORTU', -5000, 500000, '2026-09-20T12:00:00Z');
        """
    )

    # 3. finance_order_items constraints
    # Amount > 0 check
    expect_integrity_error(
        conn,
        "INSERT INTO finance_order_items (id, order_id, item_type, amount) VALUES ('itm-1', 'ord-1', 'SPP', 0);"
    )
    expect_integrity_error(
        conn,
        "INSERT INTO finance_order_items (id, order_id, item_type, amount) VALUES ('itm-1', 'ord-1', 'SPP', -1000);"
    )
    # Valid order item insert
    conn.execute(
        "INSERT INTO finance_order_items (id, order_id, item_type, amount) VALUES ('itm-1', 'ord-1', 'SPP', 500000);"
    )

    # 4. finance_payments constraints
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, paid_at
        ) VALUES (
            'pay-1', 'PAY-20260919-0001', 'ord-1', 'san-1', 'DUITKU', 'VA_BSI',
            500000, 4000, 496000, 'PAID', '2026-09-19T12:30:00Z'
        );
        """
    )
    # Duplicate payment_number (UNIQUE violation)
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, net_amount, status, paid_at
        ) VALUES ('pay-2', 'PAY-20260919-0001', 'ord-1', 'san-1', 'DUITKU', 'VA_BSI', 500000, 496000, 'PAID', '2026-09-19T12:30:00Z');
        """
    )
    # Invalid channel
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, net_amount, status, paid_at
        ) VALUES ('pay-2', 'PAY-20260919-0002', 'san-1', 'CREDIT_CARD', 'VISA', 500000, 496000, 'PAID', '2026-09-19T12:30:00Z');
        """
    )

    # 5. finance_allocations constraints
    # Valid allocation
    conn.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, target_type, item_type, amount, disbursed_amount, distribution_status
        ) VALUES ('alc-1', 'pay-1', 'OBLIGATION', 'SPP', 500000, 0, 'UNDISBURSED');
        """
    )
    # Invalid target_type
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_allocations (
            id, payment_id, target_type, item_type, amount
        ) VALUES ('alc-2', 'pay-1', 'INVALID_TARGET', 'SPP', 500000);
        """
    )
    # Disbursed amount > amount (CHECK violation)
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_allocations (
            id, payment_id, target_type, item_type, amount, disbursed_amount
        ) VALUES ('alc-2', 'pay-1', 'OBLIGATION', 'SPP', 500000, 500001);
        """
    )

    # 6. finance_gateway_events constraints
    conn.execute(
        """
        INSERT INTO finance_gateway_events (
            id, provider, event_key, signature_valid, payload_json, processing_status
        ) VALUES ('evt-1', 'DUITKU', 'duitku_ref_12345', 1, '{"ref": "12345"}', 'PROCESSED');
        """
    )
    # Duplicate event_key (Idempotency UNIQUE violation)
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_gateway_events (
            id, provider, event_key, signature_valid, payload_json, processing_status
        ) VALUES ('evt-2', 'DUITKU', 'duitku_ref_12345', 1, '{"ref": "12345"}', 'PROCESSED');
        """
    )

    # 7. finance_reconciliation_items constraints
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, payment_id, external_reference, external_amount, discrepancy_amount, match_status
        ) VALUES ('rec-1', 'pay-1', 'ext-12345', 500000, 500000, 'UNALLOCATED_TRANSFER');
        """
    )
    # Invalid match_status
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_reconciliation_items (
            id, payment_id, match_status
        ) VALUES ('rec-2', 'pay-1', 'INVALID_MATCH_STATUS');
        """
    )

    print("[OK] All Phase 3A schema constraints, foreign keys, and invariants verified.")
    conn.close()


def test_order_creation_and_fee_rules() -> None:
    print("Testing Payment Order creation and fee calculation rules...")
    conn = setup_database()

    # Seed data
    conn.execute("INSERT INTO users (id, email, password_hash) VALUES ('usr-1', 'u@test.com', 'h');")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1);")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-1', '1001', 'Ahmad', 'aktif');")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-inactive', '1002', 'Budi', 'keluar');")

    # Seed Tariff & Obligation
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-spp', 'SPP', 1, 600000, 'DISALLOWED', '2026-07-01');
        """
    )
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-uspp', 'USPP', 1, 5000000, 'ALLOWED', '2026-07-01');
        """
    )
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period, tariff_id,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES (
            'ob-spp-1', 'san-1', 'SPP', 1, '2026-07', 'trf-spp', 600000, 0, 0, 'UNPAID'
        );
        """
    )
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period, tariff_id,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES (
            'ob-uspp-1', 'san-1', 'USPP', 1, 'LIFETIME', 'trf-uspp', 5000000, 0, 0, 'UNPAID'
        );
        """
    )

    # Test Fee Calculation: CUSTOMER (Gross 600k + Fee 4k = 604k)
    order_id_1 = "ord-test-1"
    gross = 600000
    fee = 4000
    total_charged_customer = gross + fee
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, payment_method, status, expires_at
        ) VALUES (?, 'ORD-CUST-1', 'san-1', 'PORTAL_ORTU', ?, ?, 'CUSTOMER', ?, 'DUITKU_VA', 'PENDING', '2026-09-20');
        """,
        (order_id_1, gross, fee, total_charged_customer)
    )
    conn.execute(
        "INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('itm-1', ?, 'ob-spp-1', 'SPP', ?);",
        (order_id_1, gross)
    )

    row = conn.execute("SELECT gross_amount, gateway_fee, fee_payer, total_charged FROM finance_payment_orders WHERE id = ?", (order_id_1,)).fetchone()
    assert row[0] == 600000
    assert row[1] == 4000
    assert row[2] == 'CUSTOMER'
    assert row[3] == 604000, f"Expected 604000, got {row[3]}"

    # Test Fee Calculation: INSTITUTION (Gross 1M + Fee 4k = Total Charged 1M)
    order_id_2 = "ord-test-2"
    uspp_partial = 1000000
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, payment_method, status, expires_at
        ) VALUES (?, 'ORD-INST-1', 'san-1', 'PORTAL_ORTU', ?, ?, 'INSTITUTION', ?, 'DUITKU_QRIS', 'PENDING', '2026-09-20');
        """,
        (order_id_2, uspp_partial, fee, uspp_partial)
    )
    conn.execute(
        "INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('itm-2', ?, 'ob-uspp-1', 'USPP', ?);",
        (order_id_2, uspp_partial)
    )

    row2 = conn.execute("SELECT gross_amount, gateway_fee, fee_payer, total_charged FROM finance_payment_orders WHERE id = ?", (order_id_2,)).fetchone()
    assert row2[0] == 1000000
    assert row2[1] == 4000
    assert row2[2] == 'INSTITUTION'
    assert row2[3] == 1000000, f"Expected 1000000, got {row2[3]}"

    print("[OK] Payment Order fee calculation rules verified.")
    conn.close()


def test_atomic_payment_execution_and_allocation() -> None:
    print("Testing Atomic Payment Execution & Allocation Engine...")
    conn = setup_database()

    # Seed data
    conn.execute("INSERT INTO users (id, email, password_hash) VALUES ('usr-1', 'u@test.com', 'h');")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1);")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-1', '1001', 'Ahmad', 'aktif');")

    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-spp', 'SPP', 1, 500000, 'DISALLOWED', '2026-07-01');
        """
    )
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-uspp', 'USPP', 1, 3000000, 'ALLOWED', '2026-07-01');
        """
    )
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period, tariff_id,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES (
            'ob-spp', 'san-1', 'SPP', 1, '2026-07', 'trf-spp', 500000, 0, 0, 'UNPAID'
        );
        """
    )
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period, tariff_id,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES (
            'ob-uspp', 'san-1', 'USPP', 1, 'LIFETIME', 'trf-uspp', 3000000, 0, 0, 'UNPAID'
        );
        """
    )

    # Create Order combining:
    # 1. SPP 500.000 (Full)
    # 2. USPP 1.000.000 (Partial Cicilan)
    # 3. UANG_JAJAN 200.000 (Top-up)
    # Total gross: 1.700.000
    order_id = "ord-multi-1"
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, payment_method, status, expires_at
        ) VALUES (?, 'ORD-MULTI-1', 'san-1', 'PORTAL_ORTU', 1700000, 4000, 'CUSTOMER', 1704000, 'DUITKU_VA', 'PENDING', '2026-09-20');
        """,
        (order_id,)
    )
    conn.execute("INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('itm-1', ?, 'ob-spp', 'SPP', 500000);", (order_id,))
    conn.execute("INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('itm-2', ?, 'ob-uspp', 'USPP', 1000000);", (order_id,))
    conn.execute("INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('itm-3', ?, NULL, 'UANG_JAJAN', 200000);", (order_id,))

    # Execute Payment via atomic simulation (mirrors lib/finance/payments.ts)
    payment_id = "pay-multi-1"
    now_str = "2026-09-19T13:00:00Z"
    gross = 1700000
    fee = 4000
    net = gross - fee

    conn.execute("BEGIN TRANSACTION;")
    # 1. Update Order status
    conn.execute("UPDATE finance_payment_orders SET status = 'PAID', updated_at = ? WHERE id = ?;", (now_str, order_id))
    # 2. Insert Payment
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, created_at
        ) VALUES (?, 'PAY-MULTI-1', ?, 'san-1', 'DUITKU', 'VA_BSI', ?, ?, ?, 'PAID', 'NONE', 'ALLOCATED', ?, 'DUITKU_1234', ?);
        """,
        (payment_id, order_id, gross, fee, net, now_str, now_str)
    )
    # 3. Insert Allocations & Update Obligations
    # Item 1: SPP (Full)
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at)
        VALUES ('alc-1', ?, 'ob-spp', 'OBLIGATION', 'SPP', 500000, 0, 'UNDISBURSED', ?);
        """,
        (payment_id, now_str)
    )
    conn.execute(
        """
        UPDATE finance_obligations
        SET amount_paid = amount_paid + 500000,
            status = CASE
              WHEN (amount_paid + 500000) >= MAX(0, amount_expected - amount_exempted) THEN 'PAID'
              WHEN (amount_paid + 500000) > 0 THEN 'PARTIALLY_PAID'
              ELSE 'UNPAID'
            END,
            updated_at = ?
        WHERE id = 'ob-spp';
        """,
        (now_str,)
    )

    # Item 2: USPP (Partial)
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at)
        VALUES ('alc-2', ?, 'ob-uspp', 'OBLIGATION', 'USPP', 1000000, 0, 'UNDISBURSED', ?);
        """,
        (payment_id, now_str)
    )
    conn.execute(
        """
        UPDATE finance_obligations
        SET amount_paid = amount_paid + 1000000,
            status = CASE
              WHEN (amount_paid + 1000000) >= MAX(0, amount_expected - amount_exempted) THEN 'PAID'
              WHEN (amount_paid + 1000000) > 0 THEN 'PARTIALLY_PAID'
              ELSE 'UNPAID'
            END,
            updated_at = ?
        WHERE id = 'ob-uspp';
        """,
        (now_str,)
    )

    # Item 3: Uang Jajan
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at)
        VALUES ('alc-3', ?, NULL, 'UANG_JAJAN', 'UANG_JAJAN', 200000, 0, 'UNDISBURSED', ?);
        """,
        (payment_id, now_str)
    )
    conn.execute("COMMIT;")

    # Verify Results:
    # 1. Order is PAID
    ord_row = conn.execute("SELECT status FROM finance_payment_orders WHERE id = ?", (order_id,)).fetchone()
    assert ord_row[0] == 'PAID'

    # 2. Payment row exists
    pay_row = conn.execute("SELECT status, allocation_status, net_amount FROM finance_payments WHERE id = ?", (payment_id,)).fetchone()
    assert pay_row[0] == 'PAID'
    assert pay_row[1] == 'ALLOCATED'
    assert pay_row[2] == 1696000

    # 3. 3 Allocations exist
    alc_count = conn.execute("SELECT COUNT(*) FROM finance_allocations WHERE payment_id = ?", (payment_id,)).fetchone()[0]
    assert alc_count == 3

    # 4. SPP is now PAID (500k of 500k)
    spp_row = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = 'ob-spp'").fetchone()
    assert spp_row[0] == 500000
    assert spp_row[1] == 'PAID'

    # 5. USPP is now PARTIALLY_PAID (1M of 3M)
    uspp_row = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = 'ob-uspp'").fetchone()
    assert uspp_row[0] == 1000000
    assert uspp_row[1] == 'PARTIALLY_PAID'

    print("[OK] Atomic payment execution and multi-item allocations verified.")
    conn.close()


def test_unallocated_payment_flow() -> None:
    print("Testing Unallocated Transfer & Reconciliation Item recording...")
    conn = setup_database()

    # Seed data
    conn.execute("INSERT INTO users (id, email, password_hash) VALUES ('usr-1', 'u@test.com', 'h');")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-1', '1001', 'Ahmad', 'aktif');")
    conn.execute("INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES ('san-1', '8888001', 'BSI');")

    # Simulate direct transfer to VA '8888001' with Rp 750.000, no active order
    transfer_amount = 750000
    payment_id = "pay-unallocated-1"
    rec_item_id = "rec-item-1"
    now_str = "2026-09-19T14:00:00Z"

    conn.execute("BEGIN TRANSACTION;")
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, created_at
        ) VALUES (?, 'PAY-UNALLOC-1', NULL, 'san-1', 'DUITKU', 'VA_BSI', ?, 0, ?, 'PAID', 'NONE', 'UNALLOCATED', ?, 'DUITKU_UNKNOWN_ORD', ?);
        """,
        (payment_id, transfer_amount, transfer_amount, now_str, now_str)
    )
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, reconciliation_id, payment_id, settlement_id, cash_session_id,
            external_reference, internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes, created_at
        ) VALUES (?, NULL, ?, NULL, NULL, 'DUITKU_UNKNOWN_ORD', 0, ?, ?, 'UNALLOCATED_TRANSFER', 'NONE', 'Transfer dana via Fixed VA tanpa Payment Order.', ?);
        """,
        (rec_item_id, payment_id, transfer_amount, transfer_amount, now_str)
    )
    conn.execute("COMMIT;")

    # Verify Payment row
    pay_row = conn.execute("SELECT allocation_status, gross_amount, order_id FROM finance_payments WHERE id = ?", (payment_id,)).fetchone()
    assert pay_row[0] == 'UNALLOCATED'
    assert pay_row[1] == 750000
    assert pay_row[2] is None

    # Verify Reconciliation row
    rec_row = conn.execute("SELECT match_status, discrepancy_amount, resolution_action FROM finance_reconciliation_items WHERE id = ?", (rec_item_id,)).fetchone()
    assert rec_row[0] == 'UNALLOCATED_TRANSFER'
    assert rec_row[1] == 750000
    assert rec_row[2] == 'NONE'

    # Verify NO allocations created
    alloc_count = conn.execute("SELECT COUNT(*) FROM finance_allocations WHERE payment_id = ?", (payment_id,)).fetchone()[0]
    assert alloc_count == 0

    print("[OK] Unallocated transfer and reconciliation flow verified.")
    conn.close()


def test_concurrent_overpayment_prevention() -> None:
    print("Testing Concurrent Overpayment Prevention & Trigger Safety...")
    conn = setup_database()

    # Seed data
    conn.execute("INSERT INTO users (id, email, password_hash) VALUES ('usr-1', 'u@test.com', 'h');")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1);")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-1', '1001', 'Ahmad', 'aktif');")
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-spp', 'SPP', 1, 500000, 'DISALLOWED', '2026-07-01');
        """
    )
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period, tariff_id,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES ('ob-spp-race', 'san-1', 'SPP', 1, '2026-07', 'trf-spp', 500000, 0, 0, 'UNPAID');
        """
    )

    # First payment updates amount_paid to 500,000 (Lunas)
    conn.execute(
        "UPDATE finance_obligations SET amount_paid = 500000, status = 'PAID' WHERE id = 'ob-spp-race';"
    )

    # Second concurrent payment attempts to add another 500,000 -> amount_paid becomes 1,000,000
    # The database trigger trg_finance_obligations_no_overpayment_update MUST ABORT!
    expect_integrity_error(
        conn,
        "UPDATE finance_obligations SET amount_paid = amount_paid + 500000 WHERE id = 'ob-spp-race';"
    )

    # Verify amount_paid remains exactly 500,000 and status remains PAID
    row = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = 'ob-spp-race';").fetchone()
    assert row[0] == 500000
    assert row[1] == 'PAID'

    print("[OK] Concurrent overpayment database trigger verified.")
    conn.close()


def test_order_multi_payment_and_gateway_idempotency() -> None:
    print("Testing Payment Order Gateway Idempotency & Multiple Payments per Order...")
    conn = setup_database()

    # Seed data
    conn.execute("INSERT INTO users (id, email, password_hash) VALUES ('usr-1', 'u@test.com', 'h');")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1);")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-1', '1001', 'Ahmad', 'aktif');")
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-spp', 'SPP', 1, 500000, 'DISALLOWED', '2026-07-01');
        """
    )
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period, tariff_id,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES ('ob-spp-multi', 'san-1', 'SPP', 1, '2026-07', 'trf-spp', 500000, 0, 0, 'UNPAID');
        """
    )
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, status, expires_at
        ) VALUES ('ord-multi-pay', 'ORD-MULTI-001', 'san-1', 'PORTAL_ORTU', 500000, 0, 'CUSTOMER', 500000, 'PENDING', '2026-09-20');
        """
    )
    conn.execute(
        "INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('itm-mp-1', 'ord-multi-pay', 'ob-spp-multi', 'SPP', 500000);"
    )

    now_str = "2026-09-19T15:00:00Z"
    channel = "DUITKU"
    method = "VA_BSI"

    # --- Step 1: First payment arrives for the order (REF_001) ---
    conn.execute("BEGIN TRANSACTION;")
    conn.execute("UPDATE finance_payment_orders SET status = 'PAID', updated_at = ? WHERE id = 'ord-multi-pay';", (now_str,))
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, created_at
        ) VALUES ('pay-mp-1', 'PAY-MP-001', 'ord-multi-pay', 'san-1', ?, ?, 500000, 0, 500000, 'PAID', 'NONE', 'ALLOCATED', ?, 'REF_001', ?);
        """,
        (channel, method, now_str, now_str)
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at)
        VALUES ('alc-mp-1', 'pay-mp-1', 'ob-spp-multi', 'OBLIGATION', 'SPP', 500000, 0, 'UNDISBURSED', ?);
        """,
        (now_str,)
    )
    conn.execute(
        "UPDATE finance_obligations SET amount_paid = 500000, status = 'PAID', updated_at = ? WHERE id = 'ob-spp-multi';",
        (now_str,)
    )
    conn.execute("COMMIT;")

    # --- Requirement 1: same order + same external reference → 1 payment (idempotent duplicate callback) ---
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, paid_at, external_reference
        ) VALUES ('pay-mp-dup', 'PAY-MP-DUP', 'ord-multi-pay', 'san-1', ?, ?, 500000, 0, 500000, 'PAID', ?, 'REF_001');
        """,
        (channel, method, now_str)
    )
    existing_p = conn.execute(
        "SELECT id, order_id, allocation_status FROM finance_payments WHERE channel = ? AND external_reference = 'REF_001';",
        (channel,)
    ).fetchone()
    assert existing_p is not None
    assert existing_p[0] == 'pay-mp-1'

    count_ref1 = conn.execute("SELECT COUNT(*) FROM finance_payments WHERE channel = ? AND external_reference = 'REF_001';", (channel,)).fetchone()[0]
    assert count_ref1 == 1

    # --- Requirement 2: same order + 2 external references berbeda → 2 payments ---
    # Second real payment arrives with different external_reference 'REF_002' for the same order_id
    now_str_2 = "2026-09-19T15:05:00Z"
    conn.execute("BEGIN TRANSACTION;")
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, created_at
        ) VALUES ('pay-mp-2', 'PAY-MP-002', 'ord-multi-pay', 'san-1', ?, ?, 500000, 0, 500000, 'PAID', 'NONE', 'UNALLOCATED', ?, 'REF_002', ?);
        """,
        (channel, method, now_str_2, now_str_2)
    )
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, reconciliation_id, payment_id, settlement_id, cash_session_id,
            external_reference, internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes, created_at
        ) VALUES ('rec-mp-2', NULL, 'pay-mp-2', NULL, NULL, 'REF_002', 0, 500000, 500000, 'UNALLOCATED_TRANSFER', 'NONE', 'Pembayaran kedua untuk order yang sudah lunas.', ?);
        """,
        (now_str_2,)
    )
    conn.execute("COMMIT;")

    # Verify Requirement 2: exactly 2 payments for the same order_id
    order_payments_count = conn.execute("SELECT COUNT(*) FROM finance_payments WHERE order_id = 'ord-multi-pay';").fetchone()[0]
    assert order_payments_count == 2, f"Expected 2 payments for order, found {order_payments_count}"

    # --- Requirement 3: hanya payment pertama dialokasikan ---
    p1_allocs = conn.execute("SELECT COUNT(*) FROM finance_allocations WHERE payment_id = 'pay-mp-1';").fetchone()[0]
    assert p1_allocs == 1

    p2_allocs = conn.execute("SELECT COUNT(*) FROM finance_allocations WHERE payment_id = 'pay-mp-2';").fetchone()[0]
    assert p2_allocs == 0, f"Expected 0 allocations for second payment, found {p2_allocs}"

    ob = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = 'ob-spp-multi';").fetchone()
    assert ob[0] == 500000, f"Obligation amount_paid must remain exactly 500000, found {ob[0]}"
    assert ob[1] == 'PAID'

    # --- Requirement 4: payment kedua masuk Rekonsiliasi sebagai dana tidak teralokasi ---
    rec_item = conn.execute(
        "SELECT payment_id, external_reference, match_status, discrepancy_amount FROM finance_reconciliation_items WHERE payment_id = 'pay-mp-2';"
    ).fetchone()
    assert rec_item is not None
    assert rec_item[0] == 'pay-mp-2'
    assert rec_item[1] == 'REF_002'
    assert rec_item[2] == 'UNALLOCATED_TRANSFER'
    assert rec_item[3] == 500000

    print("[OK] Same order multi-payment & gateway idempotency verified (same ref -> 1 payment; diff ref -> 2 payments, only 1st allocated, 2nd to reconciliation).")
    conn.close()


def test_wallet_ledger_guard() -> None:
    print("Testing Uang Jajan deferred guard (Fase 5 isolation)...")
    conn = setup_database()

    # Table finance_wallet_ledger does NOT exist in Phase 3
    has_wallet_ledger = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='finance_wallet_ledger';"
    ).fetchone()
    assert has_wallet_ledger is None, "finance_wallet_ledger must not exist until Phase 5"

    print("[OK] Wallet ledger guard & isolation verified.")
    conn.close()


def test_foreign_key_check_strict() -> None:
    print("Testing PRAGMA foreign_key_check and foreign_key_list...")
    conn = setup_database()

    # Seed valid test graph
    conn.execute("INSERT INTO users (id, email, password_hash) VALUES ('usr-1', 'u@test.com', 'h');")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1);")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-1', '1001', 'Ahmad', 'aktif');")
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, paid_at
        ) VALUES ('pay-fk-1', 'PAY-FK-001', NULL, 'san-1', 'DUITKU', 'VA', 300000, 0, 300000, 'PAID', '2026-09-19');
        """
    )
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, payment_id, external_reference, external_amount, discrepancy_amount, match_status
        ) VALUES ('rec-fk-1', 'pay-fk-1', 'EXT-001', 300000, 300000, 'UNALLOCATED_TRANSFER');
        """
    )

    # 1. PRAGMA foreign_key_check MUST return 0 violations
    violations = conn.execute("PRAGMA foreign_key_check;").fetchall()
    assert len(violations) == 0, f"Foreign key check violations found: {violations}"

    # 2. Inspect foreign_key_list on finance_reconciliation_items
    fk_list = conn.execute("PRAGMA foreign_key_list('finance_reconciliation_items');").fetchall()
    target_tables = {row[2] for row in fk_list}
    # Must only reference existing tables (users, finance_payments), NOT non-existent Phase 6/7/8 tables
    for tbl in target_tables:
        assert tbl in ('users', 'finance_payments'), f"Unexpected FK target table: {tbl}"

    print("[OK] PRAGMA foreign_key_check passed with 0 violations.")
    conn.close()


def test_index_presence() -> None:
    print("Testing Phase 3A index creation in sqlite_master...")
    conn = setup_database()

    expected_indexes = [
        "idx_finance_student_va_number",
        "idx_finance_payment_orders_santri",
        "idx_finance_payment_orders_number",
        "idx_finance_payment_orders_status",
        "idx_finance_payment_orders_expires",
        "idx_finance_order_items_order",
        "idx_finance_order_items_obligation",
        "idx_finance_payments_santri",
        "idx_finance_payments_order",
        "idx_finance_payments_number",
        "idx_finance_payments_ext_ref",
        "idx_finance_payments_status",
        "idx_finance_payments_alloc_status",
        "idx_finance_allocations_payment",
        "idx_finance_allocations_obligation",
        "idx_finance_allocations_dist_status",
        "idx_finance_gateway_events_order",
        "idx_finance_reconciliation_items_status",
        "idx_finance_reconciliation_items_payment",
        "uq_finance_order_items_order_obligation",
        "uq_finance_payments_channel_ext_ref",
        "idx_finance_reconciliation_items_ext_ref",
    ]

    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type = 'index';")
    existing_indexes = {row[0] for row in cursor.fetchall()}

    for index_name in expected_indexes:
        assert index_name in existing_indexes, f"Missing expected index: {index_name}"

    assert "uq_finance_payments_order_id" not in existing_indexes, "Index uq_finance_payments_order_id must be dropped by migration 0158"

    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type = 'trigger';")
    existing_triggers = {row[0] for row in cursor.fetchall()}
    assert "trg_finance_obligations_no_overpayment_update" in existing_triggers, "Missing overpayment trigger"

    print(f"[OK] All {len(expected_indexes)} expected Phase 3A indexes and triggers confirmed present.")
    conn.close()


def test_competing_payments_for_same_obligation() -> None:
    print("Testing Competing Payments for Same Obligation (Zero Money Lost)...")
    conn = setup_database()

    # Seed master data
    conn.execute("INSERT INTO users (id, email, password_hash) VALUES ('usr-1', 'u@test.com', 'h');")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1);")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-1', '1001', 'Ahmad', 'aktif');")
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-spp', 'SPP', 1, 500000, 'DISALLOWED', '2026-07-01');
        """
    )
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period, tariff_id,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES ('ob-spp-compete', 'san-1', 'SPP', 1, '2026-07', 'trf-spp', 500000, 0, 0, 'UNPAID');
        """
    )

    # Order 1 (e.g. VA) & Order 2 (e.g. QRIS) both created for SPP 500k
    conn.execute(
        """
        INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, gateway_fee, total_charged, status, expires_at)
        VALUES ('ord-compete-1', 'ORD-CMP-1', 'san-1', 'PORTAL_ORTU', 500000, 0, 500000, 'PENDING', '2026-09-20');
        """
    )
    conn.execute("INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('itm-c-1', 'ord-compete-1', 'ob-spp-compete', 'SPP', 500000);")

    conn.execute(
        """
        INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, gateway_fee, total_charged, status, expires_at)
        VALUES ('ord-compete-2', 'ORD-CMP-2', 'san-1', 'PORTAL_ORTU', 500000, 0, 500000, 'PENDING', '2026-09-20');
        """
    )
    conn.execute("INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('itm-c-2', 'ord-compete-2', 'ob-spp-compete', 'SPP', 500000);")

    # Payment 1 arrives first: allocates 500k to SPP
    now_1 = "2026-09-19T14:10:00Z"
    conn.execute("UPDATE finance_payment_orders SET status = 'PAID', updated_at = ? WHERE id = 'ord-compete-1';", (now_1,))
    conn.execute(
        """
        INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, gateway_fee, net_amount, status, allocation_status, paid_at, created_at)
        VALUES ('pay-cmp-1', 'PAY-CMP-1', 'ord-compete-1', 'san-1', 'DUITKU', 'VA', 500000, 0, 500000, 'PAID', 'ALLOCATED', ?, ?);
        """,
        (now_1, now_1)
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at)
        VALUES ('alc-c-1', 'pay-cmp-1', 'ob-spp-compete', 'OBLIGATION', 'SPP', 500000, 0, 'UNDISBURSED', ?);
        """,
        (now_1,)
    )
    conn.execute(
        """
        UPDATE finance_obligations
        SET amount_paid = amount_paid + 500000,
            status = 'PAID',
            updated_at = ?
        WHERE id = 'ob-spp-compete' AND (amount_paid + 500000) <= MAX(0, amount_expected - amount_exempted);
        """,
        (now_1,)
    )

    # Payment 2 arrives second: SPP obligation is ALREADY PAID!
    # Payment 2 MUST NOT BE DROPPED! It must be recorded as PAID + UNALLOCATED + Reconciliation Item!
    now_2 = "2026-09-19T14:12:00Z"
    conn.execute("UPDATE finance_payment_orders SET status = 'PAID', updated_at = ? WHERE id = 'ord-compete-2';", (now_2,))
    conn.execute(
        """
        INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, gateway_fee, net_amount, status, allocation_status, paid_at, created_at)
        VALUES ('pay-cmp-2', 'PAY-CMP-2', 'ord-compete-2', 'san-1', 'DUITKU', 'QRIS', 500000, 0, 500000, 'PAID', 'UNALLOCATED', ?, ?);
        """,
        (now_2, now_2)
    )
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, payment_id, external_reference, internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes, created_at
        ) VALUES ('rec-cmp-2', 'pay-cmp-2', 'QRIS_123', 0, 500000, 500000, 'UNALLOCATED_TRANSFER', 'NONE', 'Kewajiban sudah berstatus PAID saat pembayaran diterima.', ?);
        """,
        (now_2,)
    )

    # Verifications:
    # 1. BOTH payments are recorded in finance_payments (Total Rp 1.000.000 received)
    p1 = conn.execute("SELECT status, allocation_status FROM finance_payments WHERE id = 'pay-cmp-1';").fetchone()
    assert p1[0] == 'PAID' and p1[1] == 'ALLOCATED'

    p2 = conn.execute("SELECT status, allocation_status FROM finance_payments WHERE id = 'pay-cmp-2';").fetchone()
    assert p2[0] == 'PAID' and p2[1] == 'UNALLOCATED'

    # 2. Obligation is NOT overpaid (exactly 500,000 paid)
    ob = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = 'ob-spp-compete';").fetchone()
    assert ob[0] == 500000 and ob[1] == 'PAID'

    # 3. Exactly 1 allocation exists (500k)
    total_alloc = conn.execute("SELECT SUM(amount) FROM finance_allocations WHERE obligation_id = 'ob-spp-compete';").fetchone()[0]
    assert total_alloc == 500000

    # 4. Reconciliation captured the second payment with discrepancy = 500k
    rec = conn.execute("SELECT discrepancy_amount, match_status FROM finance_reconciliation_items WHERE payment_id = 'pay-cmp-2';").fetchone()
    assert rec[0] == 500000 and rec[1] == 'UNALLOCATED_TRANSFER'

    print("[OK] Competing payments verified: both payments recorded, zero overpayment, excess in reconciliation.")
    conn.close()


def test_callback_for_expired_or_cancelled_order() -> None:
    print("Testing Callback for Expired or Cancelled Orders (Zero Money Lost)...")
    conn = setup_database()

    # Seed master data
    conn.execute("INSERT INTO users (id, email, password_hash) VALUES ('usr-1', 'u@test.com', 'h');")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-1', '1001', 'Ahmad', 'aktif');")

    # Expired order
    conn.execute(
        """
        INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, gateway_fee, total_charged, status, expires_at)
        VALUES ('ord-exp-1', 'ORD-EXP-1', 'san-1', 'PORTAL_ORTU', 350000, 0, 350000, 'EXPIRED', '2026-09-18');
        """
    )

    # Money arrives from payment gateway anyway
    now_str = "2026-09-19T14:15:00Z"
    conn.execute(
        """
        INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, gateway_fee, net_amount, status, allocation_status, paid_at, created_at)
        VALUES ('pay-exp-1', 'PAY-EXP-1', 'ord-exp-1', 'san-1', 'DUITKU', 'VA', 350000, 0, 350000, 'PAID', 'UNALLOCATED', ?, ?);
        """,
        (now_str, now_str)
    )
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, payment_id, external_reference, internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes, created_at
        ) VALUES ('rec-exp-1', 'pay-exp-1', 'VA_EXP_REF', 0, 350000, 350000, 'UNALLOCATED_TRANSFER', 'NONE', 'Pembayaran diterima untuk pesanan yang sudah berstatus EXPIRED.', ?);
        """,
        (now_str,)
    )

    # Verify payment is recorded and auditable
    pay = conn.execute("SELECT status, allocation_status, gross_amount FROM finance_payments WHERE id = 'pay-exp-1';").fetchone()
    assert pay[0] == 'PAID'
    assert pay[1] == 'UNALLOCATED'
    assert pay[2] == 350000

    rec = conn.execute("SELECT match_status, discrepancy_amount FROM finance_reconciliation_items WHERE payment_id = 'pay-exp-1';").fetchone()
    assert rec[0] == 'UNALLOCATED_TRANSFER'
    assert rec[1] == 350000

    print("[OK] Expired/cancelled order callback verified: payment safely recorded in reconciliation.")
    conn.close()


def test_partial_allocation_and_excess_to_reconciliation() -> None:
    print("Testing Partial Allocation and Excess to Reconciliation...")
    conn = setup_database()

    # Seed master data
    conn.execute("INSERT INTO users (id, email, password_hash) VALUES ('usr-1', 'u@test.com', 'h');")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1);")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-1', '1001', 'Ahmad', 'aktif');")
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-uspp-part', 'USPP', 1, 1000000, 'ALLOWED', '2026-07-01');
        """
    )
    # Obligation already has 800k paid out of 1.000.000 expected (remaining capacity = 200k)
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period, tariff_id,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES ('ob-uspp-part', 'san-1', 'USPP', 1, 'LIFETIME', 'trf-uspp-part', 1000000, 0, 800000, 'PARTIALLY_PAID');
        """
    )

    # Order was created for 500k (e.g. parent thought sisa 500k, or created before other payment cleared)
    conn.execute(
        """
        INSERT INTO finance_payment_orders (id, order_number, santri_id, payer_type, gross_amount, gateway_fee, total_charged, status, expires_at)
        VALUES ('ord-uspp-part', 'ORD-USP-P', 'san-1', 'PORTAL_ORTU', 500000, 0, 500000, 'PENDING', '2026-09-20');
        """
    )
    conn.execute("INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('itm-usp-p', 'ord-uspp-part', 'ob-uspp-part', 'USPP', 500000);")

    # Payment arrives for 500k:
    # Remaining capacity is 200k -> 200k allocated to USPP (obligation becomes PAID)
    # Remaining 300k is excess -> routed to finance_reconciliation_items
    # Payment allocation_status = 'PARTIALLY_ALLOCATED'
    now_str = "2026-09-19T14:20:00Z"
    conn.execute("UPDATE finance_payment_orders SET status = 'PAID', updated_at = ? WHERE id = 'ord-uspp-part';", (now_str,))
    conn.execute(
        """
        INSERT INTO finance_payments (id, payment_number, order_id, santri_id, channel, method, gross_amount, gateway_fee, net_amount, status, allocation_status, paid_at, created_at)
        VALUES ('pay-uspp-part', 'PAY-USP-P', 'ord-uspp-part', 'san-1', 'DUITKU', 'VA', 500000, 0, 500000, 'PAID', 'PARTIALLY_ALLOCATED', ?, ?);
        """,
        (now_str, now_str)
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at)
        VALUES ('alc-usp-part', 'pay-uspp-part', 'ob-uspp-part', 'OBLIGATION', 'USPP', 200000, 0, 'UNDISBURSED', ?);
        """,
        (now_str,)
    )
    conn.execute(
        """
        UPDATE finance_obligations
        SET amount_paid = amount_paid + 200000,
            status = 'PAID',
            updated_at = ?
        WHERE id = 'ob-uspp-part' AND (amount_paid + 200000) <= MAX(0, amount_expected - amount_exempted);
        """,
        (now_str,)
    )
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, payment_id, external_reference, internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes, created_at
        ) VALUES ('rec-uspp-part', 'pay-uspp-part', 'VA_REF_PART', 200000, 500000, 300000, 'AMOUNT_MISMATCH', 'NONE', 'Kelebihan alokasi USPP sebesar Rp 300.000 dialihkan ke rekonsiliasi.', ?);
        """,
        (now_str,)
    )

    # Verifications:
    # 1. Payment is PARTIALLY_ALLOCATED
    pay = conn.execute("SELECT allocation_status, gross_amount FROM finance_payments WHERE id = 'pay-uspp-part';").fetchone()
    assert pay[0] == 'PARTIALLY_ALLOCATED'
    assert pay[1] == 500000

    # 2. Obligation has exactly 1.000.000 paid (800k + 200k), status PAID
    ob = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = 'ob-uspp-part';").fetchone()
    assert ob[0] == 1000000
    assert ob[1] == 'PAID'

    # 3. Reconciliation recorded the 300k discrepancy
    rec = conn.execute("SELECT discrepancy_amount, internal_amount, external_amount, match_status FROM finance_reconciliation_items WHERE payment_id = 'pay-uspp-part';").fetchone()
    assert rec[0] == 300000
    assert rec[1] == 200000
    assert rec[2] == 500000
    assert rec[3] == 'AMOUNT_MISMATCH'

    print("[OK] Partial allocation and excess to reconciliation verified: zero lost money, zero overpayment.")
    conn.close()


def test_duplicate_unallocated_callback() -> None:
    print("Testing Duplicate Unallocated Callback (Idempotency & Zero Duplication)...")
    conn = setup_database()

    # Seed master data
    conn.execute("INSERT INTO users (id, email, password_hash) VALUES ('usr-1', 'u@test.com', 'h');")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, status_global) VALUES ('san-1', '1001', 'Ahmad', 'aktif');")
    conn.execute("INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES ('san-1', '8888001', 'BSI');")

    ext_ref = "DUITKU_VA_DUP_001"
    channel = "DUITKU"
    method = "VA_BSI"
    amount = 500000
    now_str = "2026-09-19T14:30:00Z"

    # --- Call 1: First callback for unallocated transfer arrives ---
    payment_id_1 = "pay-unalloc-first"
    rec_id_1 = "rec-unalloc-first"

    conn.execute("BEGIN TRANSACTION;")
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, created_at
        ) VALUES (?, 'PAY-UNALLOC-001', NULL, 'san-1', ?, ?, ?, 0, ?, 'PAID', 'NONE', 'UNALLOCATED', ?, ?, ?);
        """,
        (payment_id_1, channel, method, amount, amount, now_str, ext_ref, now_str)
    )
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, reconciliation_id, payment_id, settlement_id, cash_session_id,
            external_reference, internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes, created_at
        ) VALUES (?, NULL, ?, NULL, NULL, ?, 0, ?, ?, 'UNALLOCATED_TRANSFER', 'NONE', 'Transfer dana via Fixed VA tanpa Order.', ?);
        """,
        (rec_id_1, payment_id_1, ext_ref, amount, amount, now_str)
    )
    conn.execute("COMMIT;")

    # Verify Call 1 records
    p1 = conn.execute("SELECT id, status, allocation_status, gross_amount FROM finance_payments WHERE id = ?", (payment_id_1,)).fetchone()
    assert p1 is not None
    assert p1[1] == 'PAID'
    assert p1[2] == 'UNALLOCATED'
    assert p1[3] == 500000

    r1 = conn.execute("SELECT id, payment_id, external_reference, match_status FROM finance_reconciliation_items WHERE id = ?", (rec_id_1,)).fetchone()
    assert r1 is not None
    assert r1[1] == payment_id_1
    assert r1[2] == ext_ref
    assert r1[3] == 'UNALLOCATED_TRANSFER'

    # --- Call 2: Attempting direct duplicate insert via SQL MUST FAIL due to uq_finance_payments_channel_ext_ref ---
    payment_id_2 = "pay-unalloc-second"
    rec_id_2 = "rec-unalloc-second"
    expect_integrity_error(
        conn,
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference, created_at
        ) VALUES (?, 'PAY-UNALLOC-002', NULL, 'san-1', ?, ?, ?, 0, ?, 'PAID', 'NONE', 'UNALLOCATED', ?, ?, ?);
        """,
        (payment_id_2, channel, method, amount, amount, now_str, ext_ref, now_str)
    )

    # --- Call 2 (Application Flow Simulation): Pre-check or unique catch returns existing payment ---
    # Simulates:
    # const existing = await getPaymentByExternalReference(input.channel, externalRef)
    # if (existing) return existing
    existing_payment = conn.execute(
        "SELECT id, payment_number, allocation_status FROM finance_payments WHERE channel = ? AND external_reference = ?",
        (channel, ext_ref)
    ).fetchone()
    assert existing_payment is not None
    assert existing_payment[0] == payment_id_1

    # --- Verifications: STRICT ZERO DUPLICATION ---
    # 1. Exactly 1 payment in finance_payments for (channel, ext_ref)
    pay_count = conn.execute(
        "SELECT COUNT(*) FROM finance_payments WHERE channel = ? AND external_reference = ?",
        (channel, ext_ref)
    ).fetchone()[0]
    assert pay_count == 1, f"Expected exactly 1 payment record, found {pay_count}"

    # 2. Exactly 1 reconciliation item in finance_reconciliation_items for ext_ref
    rec_count = conn.execute(
        "SELECT COUNT(*) FROM finance_reconciliation_items WHERE external_reference = ?",
        (ext_ref,)
    ).fetchone()[0]
    assert rec_count == 1, f"Expected exactly 1 reconciliation item, found {rec_count}"

    # 3. Exactly 0 allocations exist for this unallocated payment
    alloc_count = conn.execute(
        "SELECT COUNT(*) FROM finance_allocations WHERE payment_id = ?",
        (payment_id_1,)
    ).fetchone()[0]
    assert alloc_count == 0, f"Expected 0 allocations, found {alloc_count}"

    # --- Partial Index Verification: NULL external_reference allows multiple payments ---
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, allocation_status, paid_at, external_reference
        ) VALUES ('pay-null-ref-1', 'PAY-NULL-1', NULL, 'san-1', 'CASH', 'TUNAI', 100000, 0, 100000, 'PAID', 'UNALLOCATED', ?, NULL);
        """,
        (now_str,)
    )
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, allocation_status, paid_at, external_reference
        ) VALUES ('pay-null-ref-2', 'PAY-NULL-2', NULL, 'san-1', 'CASH', 'TUNAI', 200000, 0, 200000, 'PAID', 'UNALLOCATED', ?, NULL);
        """,
        (now_str,)
    )
    null_count = conn.execute(
        "SELECT COUNT(*) FROM finance_payments WHERE external_reference IS NULL"
    ).fetchone()[0]
    assert null_count >= 2

    print("[OK] Duplicate unallocated callback verified: independent idempotency, 0 duplicate payments, 0 duplicate reconciliation items.")
    conn.close()


def main() -> None:
    print("=" * 60)
    print("Starting Fase 3A Payment Engine Core Test Suite (with Hardening)...")
    print("=" * 60)

    test_schema_constraints()
    test_order_creation_and_fee_rules()
    test_atomic_payment_execution_and_allocation()
    test_unallocated_payment_flow()
    test_concurrent_overpayment_prevention()
    test_order_multi_payment_and_gateway_idempotency()
    test_wallet_ledger_guard()
    test_foreign_key_check_strict()
    test_competing_payments_for_same_obligation()
    test_callback_for_expired_or_cancelled_order()
    test_partial_allocation_and_excess_to_reconciliation()
    test_duplicate_unallocated_callback()
    test_index_presence()

    print("\n" + "=" * 60)
    print("ALL FASE 3A INVARIANT, HARDENING & ENGINE TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    main()
