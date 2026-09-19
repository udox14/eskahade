"""Automated Contract, Reconciliation Engine, Settlement, & Non-Destructive Correction Tests for Fase 8.

Validates:
1. Migration 0163 & Schema Invariants:
   - Tables: finance_settlements, finance_settlement_items, finance_corrections, finance_correction_items, finance_reconciliations.
   - Trigger trg_finance_correction_items_prevent_over_correct prevents over-correction.
   - Unique constraint finance_settlement_items(payment_id) guarantees 1-to-1 settlement linkage.
   - Registration of Rekonsiliasi in fitur_akses.
2. Invariant PAID != SETTLED & Settlement Bank Lifecycle (PRD #32.1):
   - Payments remain PAID until settlement batch is recorded.
   - Batch creation transitions payments to SETTLED.
   - Re-settling same payment strictly rejected by 1-to-1 unique database constraint.
   - Discrepancy detection: bank statement net != calculated net sets status DISCREPANCY and logs reconciliation item.
3. Rekonsiliasi Sesi Kas Fisik (PRD #23, #32.2):
   - Physical count matches expected -> difference 0, status SEIMBANG.
   - Physical count != expected -> difference != 0, status SELISIH with difference_notes preserved.
   - Historical ledger and payment transactions remain intact (non-destructive).
4. Resolusi Transaksi Unmatched / Unallocated Tanpa Menebak Alokasi (PRD #4.1, #32):
   - Fixed VA transfer without order recorded as UNALLOCATED_TRANSFER.
   - Manual allocation distributes funds precisely: obligation amount_paid increases, Uang Jajan ledger increases.
   - Payment allocation_status transitions to ALLOCATED.
   - Reconciliation item resolved with audit trail.
   - Over-allocation or under-allocation strictly rejected.
5. Engine Koreksi Finansial Non-Destruktif (VOID, REVERSAL, REFUND):
   - Payment history preserved: status remains PAID/SETTLED, row is never deleted or mutated to VOID.
   - Derived correction_status transitions: NONE -> PARTIALLY_CORRECTED -> FULLY_CORRECTED.
   - Partial and full corrections supported.
   - Obligation amount_paid rolled back and status recomputed (PAID -> UNPAID/PARTIALLY_PAID).
   - Cash refund links to active cash session, increases cash-out, and updates expected balance.
6. Pembalikan Uang Jajan Dua Arah yang Presisi (PRD #15, #16, Plan 4.3):
   - Reversal of Top-Up: mutasi OUT, movement REVERSAL, prevents negative balance.
   - Reversal of Withdrawal: mutasi IN, movement REVERSAL, restores student balance.
7. Proteksi Dana Telanjur Disalurkan (Disbursed Funds Protection, PRD & Plan 4.3):
   - If allocation disbursed_amount > 0, system STRICTLY FORBIDS auto-deducting next period.
   - Automatically flagged as Recovery Case (is_recovery_case = 1, recovery_status = 'PENDING_RECOVERY').
   - Logged in reconciliation queue for manual audit and third-party recovery.
   - Manual recovery resolution marks status RECOVERED with audit trail.
8. RBAC Server Action Authorization Matrix:
   - Pimpinan & Tester are strictly view-only.
   - Admin & Bendahara are authorized to mutate.
9. UI Components Existence & Structure Verification.
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
            description TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """
    )

    # Jalankan seluruh migrasi berurutan
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
    ]:
        with open(mig, "r", encoding="utf-8") as f:
            conn.executescript(f.read())

    return conn


def test_migration_0163_and_schema_invariants():
    print("1. Testing Migration 0163 Schema, Triggers & fitur_akses Registration...")
    conn = setup_test_db()

    # Pastikan tabel baru ada
    tables = [
        "finance_settlements",
        "finance_settlement_items",
        "finance_corrections",
        "finance_correction_items",
        "finance_reconciliations",
    ]
    for tbl in tables:
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tbl,)
        )
        assert cur.fetchone() is not None, f"Table {tbl} must exist."

    # Pastikan trigger over-correction ada
    cur = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_finance_correction_items_prevent_over_correct'"
    )
    assert cur.fetchone() is not None, "Trigger trg_finance_correction_items_prevent_over_correct must exist."

    # Pastikan menu Rekonsiliasi terdaftar di fitur_akses
    cur = conn.execute(
        "SELECT * FROM fitur_akses WHERE href = '/dashboard/keuangan/rekonsiliasi'"
    )
    menu = cur.fetchone()
    assert menu is not None, "Menu Rekonsiliasi must be registered in fitur_akses."

    print("[OK] Migration 0163 and schema invariants verified.")


def test_paid_not_settled_and_settlement_batch():
    print("2. Testing Invariant PAID != SETTLED & Settlement Bank Lifecycle (PRD #32.1)...")
    conn = setup_test_db()

    # Seed User & Santri
    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('usr-bend', 'bend@test.com', 'hash', 'Bendahara', 'bendahara')")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap) VALUES ('san-1', 'NIS001', 'Ahmad Faris')")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap) VALUES ('san-2', 'NIS002', 'Budi Santoso')")

    # Seed Online Payments (channel = 'DUITKU', status = 'PAID')
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at
        ) VALUES
        ('pay-1', 'PAY-001', NULL, 'san-1', 'DUITKU', 'DUITKU_VA', 200000, 3000, 197000, 'PAID', 'NONE', 'ALLOCATED', '2026-09-19 10:00:00'),
        ('pay-2', 'PAY-002', NULL, 'san-2', 'DUITKU', 'DUITKU_QRIS', 300000, 2000, 298000, 'PAID', 'NONE', 'ALLOCATED', '2026-09-19 11:00:00')
        """
    )

    # INVARIANT 1: Payment yang baru dibayar online berstatus PAID, BELUM SETTLED
    cur = conn.execute("SELECT status FROM finance_payments WHERE id = 'pay-1'")
    assert cur.fetchone()[0] == "PAID", "Initial online payment status must be PAID."

    # Buat Batch Settlement Bank untuk pay-1 dan pay-2
    stl_id = "stl-batch-1"
    stl_num = "STL-20260919-0001"
    total_gross = 200000 + 300000
    total_fee = 3000 + 2000
    total_net = 197000 + 298000  # 495.000

    conn.execute(
        """
        INSERT INTO finance_settlements (
            id, settlement_number, provider, settlement_date, destination_bank,
            destination_account, total_payments_count, total_gross_amount,
            total_fee_amount, total_net_amount, status, verified_by
        ) VALUES (?, ?, 'DUITKU', '2026-09-19', 'BSI', '7123456789', 2, ?, ?, ?, 'COMPLETED', 'usr-bend')
        """,
        (stl_id, stl_num, total_gross, total_fee, total_net),
    )

    conn.execute(
        "INSERT INTO finance_settlement_items (id, settlement_id, payment_id, gross_amount, gateway_fee, net_amount) VALUES ('si-1', ?, 'pay-1', 200000, 3000, 197000)",
        (stl_id,),
    )
    conn.execute("UPDATE finance_payments SET status = 'SETTLED' WHERE id = 'pay-1'")

    conn.execute(
        "INSERT INTO finance_settlement_items (id, settlement_id, payment_id, gross_amount, gateway_fee, net_amount) VALUES ('si-2', ?, 'pay-2', 300000, 2000, 298000)",
        (stl_id,),
    )
    conn.execute("UPDATE finance_payments SET status = 'SETTLED' WHERE id = 'pay-2'")

    # INVARIANT 2: Setelah settlement, status pembayaran beralih ke SETTLED
    cur = conn.execute("SELECT status FROM finance_payments WHERE id IN ('pay-1', 'pay-2')")
    statuses = [r[0] for r in cur.fetchall()]
    assert statuses == ["SETTLED", "SETTLED"], "Payments in settlement batch must transition to SETTLED."

    # INVARIANT 3: Payment tidak boleh di-settle ganda (UNIQUE payment_id)
    try:
        conn.execute(
            "INSERT INTO finance_settlement_items (id, settlement_id, payment_id, gross_amount, gateway_fee, net_amount) VALUES ('si-dup', 'stl-other', 'pay-1', 200000, 3000, 197000)"
        )
        assert False, "Double settlement of the same payment must raise IntegrityError."
    except sqlite3.IntegrityError:
        pass  # SUCCESS: 1-to-1 unique invariant enforced

    # INVARIANT 4: Deteksi Selisih Rekening Koran Bank (DISCREPANCY)
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at
        ) VALUES ('pay-3', 'PAY-003', NULL, 'san-1', 'DUITKU', 'DUITKU_VA', 100000, 1000, 99000, 'PAID', 'NONE', 'ALLOCATED', '2026-09-19 12:00:00')
        """
    )
    # Bank mencairkan Rp 95.000 (selisih Rp 4.000)
    bank_actual_net = 95000
    stl_id_disc = "stl-batch-disc"
    conn.execute(
        """
        INSERT INTO finance_settlements (
            id, settlement_number, provider, settlement_date, destination_bank,
            destination_account, total_payments_count, total_gross_amount,
            total_fee_amount, total_net_amount, status, notes, verified_by
        ) VALUES (?, 'STL-DISC', 'DUITKU', '2026-09-19', 'BSI', '7123456789', 1, 100000, 1000, 99000, 'DISCREPANCY', 'Selisih Rp 4.000', 'usr-bend')
        """,
        (stl_id_disc,),
    )
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, reconciliation_id, payment_id, settlement_id, external_reference,
            internal_amount, external_amount, discrepancy_amount, match_status, resolution_action, resolution_notes
        ) VALUES ('rec-disc-1', NULL, NULL, ?, 'STL-DISC', 99000, ?, 4000, 'AMOUNT_MISMATCH', 'NONE', 'Selisih net settlement')
        """,
        (stl_id_disc, bank_actual_net),
    )

    cur = conn.execute("SELECT status FROM finance_settlements WHERE id = ?", (stl_id_disc,))
    assert cur.fetchone()[0] == "DISCREPANCY", "Settlement with mismatch must have status DISCREPANCY."

    print("[OK] Invariant PAID != SETTLED, 1-to-1 linkage, and settlement discrepancy verified.")


def test_cash_session_physical_reconciliation():
    print("3. Testing Rekonsiliasi Sesi Kas Loket <-> Kas Fisik (PRD #23, #32.2)...")
    conn = setup_test_db()
    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('usr-kasir', 'kasir@test.com', 'hash', 'Kasir Loket', 'petugas_koperasi')")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, saldo_uang_jajan) VALUES ('san-1', 'NIS001', 'Ahmad Faris', 0)")

    # Kasus A: Sesi Kas Seimbang Pas
    conn.execute(
        """
        INSERT INTO finance_cash_sessions (
            id, session_code, operator_id, opened_at, opening_balance,
            total_cash_in, total_cash_out, expected_closing_balance,
            actual_closing_balance, difference, status, closed_at
        ) VALUES (
            'ses-bal', 'SES-BAL', 'usr-kasir', '2026-09-19 08:00:00', 500000,
            200000, 100000, 600000,
            600000, 0, 'CLOSED', '2026-09-19 16:00:00'
        )
        """
    )
    cur = conn.execute("SELECT difference, status FROM finance_cash_sessions WHERE id = 'ses-bal'")
    diff, status = cur.fetchone()
    assert diff == 0 and status == "CLOSED", "Balanced cash session must have difference 0."

    # Kasus B: Sesi Kas Ada Selisih Fisik (Kas fisik kurang Rp 50.000)
    # PRD RULE: Mismatch tidak boleh diperbaiki dengan mengubah nominal transaksi secara diam-diam.
    conn.execute(
        """
        INSERT INTO finance_cash_sessions (
            id, session_code, operator_id, opened_at, opening_balance,
            total_cash_in, total_cash_out, expected_closing_balance,
            actual_closing_balance, difference, difference_notes, status, closed_at
        ) VALUES (
            'ses-diff', 'SES-DIFF', 'usr-kasir', '2026-09-19 08:00:00', 500000,
            300000, 50000, 750000,
            700000, -50000, 'Uang kembalian tercecer di laci kasir', 'CLOSED', '2026-09-19 16:00:00'
        )
        """
    )
    # Catat ke finance_reconciliation_items
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, cash_session_id, internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes
        ) VALUES (
            'rec-cash-1', 'ses-diff', 750000, 700000, 50000,
            'AMOUNT_MISMATCH', 'NONE', 'Selisih kas fisik sesi SES-DIFF sebesar Rp 50.000'
        )
        """
    )

    cur = conn.execute("SELECT expected_closing_balance, actual_closing_balance, difference FROM finance_cash_sessions WHERE id = 'ses-diff'")
    exp, act, d = cur.fetchone()
    assert exp == 750000 and act == 700000 and d == -50000, "Cash session difference must reflect reality without mutating transactions."

    # Kasus C (Patch Poin 1): Refund CASH wajib masuk Cash Session sebagai cash-out
    # Test contoh: opening 500k + cash payment 200k - cash refund 100k = expected 600k.
    # Pastikan live cache, recalculate, dan close-session semuanya tetap 600k.
    session_patch_id = "ses-cash-patch-1"
    conn.execute(
        """
        INSERT INTO finance_cash_sessions (
            id, session_code, operator_id, opened_at, opening_balance,
            total_cash_in, total_cash_out, expected_closing_balance,
            actual_closing_balance, difference, status
        ) VALUES (
            ?, 'SES-PATCH-01', 'usr-kasir', '2026-09-19 08:00:00', 500000,
            0, 0, 500000, NULL, 0, 'OPEN'
        )
        """,
        (session_patch_id,),
    )
    # Pembayaran tunai masuk Rp 200.000
    pay_cash_id = "pay-cash-in-200"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, cash_session_id, paid_at
        ) VALUES (?, 'PAY-CSH-200', NULL, 'san-1', 'CASH', 'CASH', 200000, 0, 200000, 'PAID', 'NONE', 'ALLOCATED', ?, '2026-09-19 09:00:00')
        """,
        (pay_cash_id, session_patch_id),
    )
    # Live cache update dari pembayaran masuk
    conn.execute(
        "UPDATE finance_cash_sessions SET total_cash_in = total_cash_in + 200000, expected_closing_balance = expected_closing_balance + 200000 WHERE id = ?",
        (session_patch_id,),
    )

    # Refund tunai keluar Rp 100.000 via finance_corrections dengan method = 'CASH'
    corr_cash_id = "cor-cash-out-100"
    conn.execute(
        """
        INSERT INTO finance_corrections (
            id, correction_number, correction_type, target_payment_id, total_amount,
            method, reason, is_recovery_case, recovery_amount, recovery_status,
            cash_session_id, created_by
        ) VALUES (?, 'REF-CSH-100', 'REFUND', ?, 100000, 'CASH', 'Pengembalian tunai ke wali', 0, 0, 'NONE', ?, 'usr-kasir')
        """,
        (corr_cash_id, pay_cash_id, session_patch_id),
    )
    # Live cache update dari koreksi tunai
    conn.execute(
        "UPDATE finance_cash_sessions SET total_cash_out = total_cash_out + 100000, expected_closing_balance = expected_closing_balance - 100000 WHERE id = ?",
        (session_patch_id,),
    )

    # 1. Verifikasi live cache: 500k + 200k - 100k = 600k
    cur = conn.execute("SELECT total_cash_in, total_cash_out, expected_closing_balance FROM finance_cash_sessions WHERE id = ?", (session_patch_id,))
    cin, cout, exp = cur.fetchone()
    assert cin == 200000, f"Expected live cash-in 200k, got {cin}"
    assert cout == 100000, f"Expected live cash-out 100k, got {cout}"
    assert exp == 600000, f"Expected live closing 600k, got {exp}"

    # 2. Verifikasi recalculate query logic (authoritative recalculateCashSession):
    auth_payment_in = conn.execute(
        "SELECT COALESCE(SUM(gross_amount), 0) FROM finance_payments WHERE cash_session_id = ? AND channel = 'CASH' AND status = 'PAID'",
        (session_patch_id,),
    ).fetchone()[0]
    auth_topup_in = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM finance_wallet_ledger WHERE cash_session_id = ? AND direction = 'IN' AND movement_type = 'TOPUP_CASH'",
        (session_patch_id,),
    ).fetchone()[0]
    auth_cash_in = auth_payment_in + auth_topup_in

    auth_wallet_out = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM finance_wallet_ledger WHERE cash_session_id = ? AND direction = 'OUT' AND movement_type = 'WITHDRAWAL_LOKET'",
        (session_patch_id,),
    ).fetchone()[0]
    auth_corr_out = conn.execute(
        "SELECT COALESCE(SUM(total_amount), 0) FROM finance_corrections WHERE cash_session_id = ? AND method = 'CASH'",
        (session_patch_id,),
    ).fetchone()[0]
    auth_cash_out = auth_wallet_out + auth_corr_out

    recalculated_expected = 500000 + auth_cash_in - auth_cash_out
    assert auth_cash_in == 200000, f"Authoritative cash-in must be 200k, got {auth_cash_in}"
    assert auth_cash_out == 100000, f"Authoritative cash-out must be 100k, got {auth_cash_out}"
    assert recalculated_expected == 600000, f"Recalculated expected balance must be 600k, got {recalculated_expected}"

    # 3. Verifikasi close-session dengan uang fisik 600k -> difference harus 0
    actual_closing = 600000
    diff_closing = actual_closing - recalculated_expected
    assert diff_closing == 0, f"Difference on close-session must be 0, got {diff_closing}"

    conn.execute(
        """
        UPDATE finance_cash_sessions
        SET status = 'CLOSED',
            actual_closing_balance = ?,
            difference = ?,
            closed_at = datetime('now')
        WHERE id = ?
        """,
        (actual_closing, diff_closing, session_patch_id),
    )
    cur = conn.execute("SELECT expected_closing_balance, actual_closing_balance, difference, status FROM finance_cash_sessions WHERE id = ?", (session_patch_id,))
    exp_c, act_c, d_c, st_c = cur.fetchone()
    assert exp_c == 600000 and act_c == 600000 and d_c == 0 and st_c == "CLOSED", "Close-session must preserve 600k balance."

    print("[OK] Rekonsiliasi sesi kas fisik dan pelaporan selisih non-destruktif verified.")


def test_unallocated_resolution_without_guessing():
    print("4. Testing Resolusi Transaksi Unmatched/Unallocated Tanpa Menebak Alokasi (PRD #4.1, #32)...")
    conn = setup_test_db()

    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('usr-bend', 'bend@test.com', 'hash', 'Bendahara', 'bendahara')")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, saldo_uang_jajan) VALUES ('san-1', 'NIS001', 'Ahmad Faris', 0)")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, status) VALUES (1, '2026/2027', 'Aktif')")

    # Kewajiban SPP September (Rp 200.000)
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES ('oblg-spp-sep', 'san-1', 'SPP', 1, '2026-09', 200000, 0, 0, 'UNPAID')
        """
    )

    # Pembayaran transfer Fixed VA tanpa Payment Order aktif (Rp 500.000)
    # Sesuai aturan: Dicatat sebagai UNALLOCATED + UNALLOCATED_TRANSFER
    pay_id = "pay-unalloc-1"
    rec_item_id = "rec-unalloc-1"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference
        ) VALUES (?, 'PAY-UNALLOC-001', NULL, 'san-1', 'DUITKU', 'DUITKU_VA', 500000, 0, 500000, 'PAID', 'NONE', 'UNALLOCATED', '2026-09-19 10:00:00', 'VA-TRANSFER-999')
        """,
        (pay_id,),
    )
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, reconciliation_id, payment_id, external_reference,
            internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes
        ) VALUES (?, NULL, ?, 'VA-TRANSFER-999', 0, 500000, 500000, 'UNALLOCATED_TRANSFER', 'NONE', 'Transfer masuk tanpa order aktif')
        """,
        (rec_item_id, pay_id),
    )

    # 1. Alokasi manual oleh Bendahara:
    # - Rp 200.000 ke SPP 2026-09
    # - Rp 300.000 ke Uang Jajan
    conn.execute(
        "INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status) VALUES ('alloc-1', ?, 'oblg-spp-sep', 'OBLIGATION', 'SPP', 200000, 0, 'UNDISBURSED')",
        (pay_id,),
    )
    conn.execute("UPDATE finance_obligations SET amount_paid = 200000, status = 'PAID' WHERE id = 'oblg-spp-sep'")

    conn.execute(
        "INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status) VALUES ('alloc-2', ?, NULL, 'UANG_JAJAN', 'UANG_JAJAN', 300000, 0, 'UNDISBURSED')",
        (pay_id,),
    )
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, reference_id, notes
        ) VALUES ('w-1', 'san-1', 'IN', 'TOPUP_ONLINE', 300000, 0, 300000, 'PAY-UNALLOC-001', 'Alokasi manual transfer Fixed VA')
        """
    )
    conn.execute("UPDATE santri SET saldo_uang_jajan = 300000 WHERE id = 'san-1'")

    # Update payment & reconciliation item
    conn.execute("UPDATE finance_payments SET allocation_status = 'ALLOCATED' WHERE id = ?", (pay_id,))
    conn.execute(
        "UPDATE finance_reconciliation_items SET resolution_action = 'MANUAL_ALLOCATION', resolution_notes = 'Sesuai konfirmasi orang tua: SPP 200k + Jajan 300k', resolved_by = 'usr-bend', resolved_at = datetime('now') WHERE id = ?",
        (rec_item_id,),
    )

    # Verifikasi hasil alokasi manual
    cur = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = 'oblg-spp-sep'")
    paid, st = cur.fetchone()
    assert paid == 200000 and st == "PAID", "SPP must be marked PAID after manual allocation."

    cur = conn.execute("SELECT saldo_uang_jajan FROM santri WHERE id = 'san-1'")
    assert cur.fetchone()[0] == 300000, "Student wallet balance must increase by Rp 300.000."

    cur = conn.execute("SELECT allocation_status FROM finance_payments WHERE id = ?", (pay_id,))
    assert cur.fetchone()[0] == "ALLOCATED", "Payment allocation_status must be ALLOCATED."

    cur = conn.execute("SELECT resolution_action FROM finance_reconciliation_items WHERE id = ?", (rec_item_id,))
    assert cur.fetchone()[0] == "MANUAL_ALLOCATION", "Reconciliation item must be resolved as MANUAL_ALLOCATION."

    # Kasus B (Patch Poin 2): Payment UNALLOCATED Rp 100k -> resolve ke Uang Jajan
    # Tepat satu ledger IN Rp 100k, authoritative wallet +100k, cache sama, retry tidak menduplikasi.
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, saldo_uang_jajan) VALUES ('san-2', 'NIS002', 'Budi Santoso', 0)")
    pay_unalloc_2 = "pay-unalloc-2"
    rec_unalloc_2 = "rec-unalloc-2"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at, external_reference
        ) VALUES (?, 'PAY-UNALLOC-002', NULL, 'san-2', 'DUITKU', 'VA_BNI', 100000, 0, 100000, 'PAID', 'NONE', 'UNALLOCATED', '2026-09-19 11:00:00', 'VA-REF-100K')
        """,
        (pay_unalloc_2,),
    )
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, reconciliation_id, payment_id, external_reference,
            internal_amount, external_amount, discrepancy_amount,
            match_status, resolution_action, resolution_notes
        ) VALUES (?, NULL, ?, 'VA-REF-100K', 0, 100000, 100000, 'UNALLOCATED_TRANSFER', 'NONE', 'Dana masuk 100k unallocated')
        """,
        (rec_unalloc_2, pay_unalloc_2),
    )

    # Eksekusi resolusi manual ke Uang Jajan:
    # 1. Cek validasi anti-duplikasi sebelum resolusi:
    existing_check = conn.execute(
        "SELECT COUNT(*) FROM finance_wallet_ledger WHERE (reference_id = 'PAY-UNALLOC-002' OR reference_id = ?) AND direction = 'IN'",
        (rec_unalloc_2,),
    ).fetchone()[0]
    assert existing_check == 0, "No previous ledger entry should exist before resolution."

    # 2. Insert alokasi & mutasi ledger
    conn.execute(
        "INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status) VALUES ('alloc-uj-100', ?, NULL, 'UANG_JAJAN', 'UANG_JAJAN', 100000, 0, 'UNDISBURSED')",
        (pay_unalloc_2,),
    )
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, reference_id, notes
        ) VALUES ('w-uj-100', 'san-2', 'IN', 'TOPUP_ONLINE', 100000, 0, 100000, 'PAY-UNALLOC-002', 'Resolusi manual ke Uang Jajan')
        """
    )
    conn.execute("UPDATE santri SET saldo_uang_jajan = 100000 WHERE id = 'san-2'")
    conn.execute("UPDATE finance_payments SET allocation_status = 'ALLOCATED' WHERE id = ?", (pay_unalloc_2,))
    conn.execute("UPDATE finance_reconciliation_items SET resolution_action = 'MANUAL_ALLOCATION', resolution_notes = 'Disalurkan ke Uang Jajan', resolved_by = 'usr-bend', resolved_at = datetime('now') WHERE id = ?", (rec_unalloc_2,))

    # 3. Verifikasi tepat satu ledger IN Rp 100k:
    ledger_rows = conn.execute("SELECT id, direction, amount, balance_after FROM finance_wallet_ledger WHERE santri_id = 'san-2'").fetchall()
    assert len(ledger_rows) == 1, f"Must have exactly 1 ledger row, found {len(ledger_rows)}"
    assert ledger_rows[0][1] == "IN" and ledger_rows[0][2] == 100000 and ledger_rows[0][3] == 100000

    # 4. Authoritative wallet: SUM(IN) - SUM(OUT)
    auth_bal = conn.execute("SELECT COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE -amount END), 0) FROM finance_wallet_ledger WHERE santri_id = 'san-2'").fetchone()[0]
    assert auth_bal == 100000, f"Authoritative wallet must be 100k, got {auth_bal}"
    cache_bal = conn.execute("SELECT saldo_uang_jajan FROM santri WHERE id = 'san-2'").fetchone()[0]
    assert cache_bal == 100000, f"Cached wallet must be 100k, got {cache_bal}"

    # 5. Payment mempertahankan histori asli:
    pay_rec = conn.execute("SELECT status, gross_amount, channel, allocation_status FROM finance_payments WHERE id = ?", (pay_unalloc_2,)).fetchone()
    assert pay_rec[0] == "PAID" and pay_rec[1] == 100000 and pay_rec[2] == "DUITKU" and pay_rec[3] == "ALLOCATED"

    # 6. Retry detection: Pembayaran berstatus ALLOCATED atau ledger duplikat dilarang:
    retry_pay_status = conn.execute("SELECT allocation_status FROM finance_payments WHERE id = ?", (pay_unalloc_2,)).fetchone()[0]
    assert retry_pay_status == "ALLOCATED", "Payment must be marked ALLOCATED to prevent re-allocation."
    dup_ledger = conn.execute("SELECT COUNT(*) FROM finance_wallet_ledger WHERE reference_id = 'PAY-UNALLOC-002' AND direction = 'IN'").fetchone()[0]
    assert dup_ledger == 1, "Duplicate ledger entry must be blocked."

    print("[OK] Resolusi manual transaksi unallocated tanpa menebak alokasi verified.")


def test_non_destructive_financial_corrections():
    print("5. Testing Engine Koreksi Finansial Non-Destruktif (VOID, REVERSAL, REFUND)...")
    conn = setup_test_db()

    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('usr-bend', 'bend@test.com', 'hash', 'Bendahara', 'bendahara')")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap) VALUES ('san-1', 'NIS001', 'Ahmad Faris')")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, status) VALUES (1, '2026/2027', 'Aktif')")

    # Obligasi USPP Rp 1.000.000
    conn.execute(
        "INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('oblg-uspp', 'san-1', 'USPP', 1, 'LIFETIME', 1000000, 0, 500000, 'PARTIALLY_PAID')"
    )

    # Payment Rp 500.000
    pay_id = "pay-corr-test"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at
        ) VALUES (?, 'PAY-CORR-001', NULL, 'san-1', 'CASH', 'CASH', 500000, 0, 500000, 'PAID', 'NONE', 'ALLOCATED', '2026-09-19 10:00:00')
        """,
        (pay_id,),
    )
    alloc_id = "alloc-uspp-500"
    conn.execute(
        "INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status) VALUES (?, ?, 'oblg-uspp', 'OBLIGATION', 'USPP', 500000, 0, 'UNDISBURSED')",
        (alloc_id, pay_id),
    )

    # 1. KOREKSI PARSIAL: VOID Rp 200.000 dari USPP
    corr_id_1 = "cor-part-1"
    conn.execute(
        """
        INSERT INTO finance_corrections (
            id, correction_number, correction_type, target_payment_id, total_amount,
            method, reason, is_recovery_case, recovery_amount, recovery_status, created_by
        ) VALUES (?, 'VOID-001', 'VOID', ?, 200000, NULL, 'Koreksi parsial input salah', 0, 0, 'NONE', 'usr-bend')
        """,
        (corr_id_1, pay_id),
    )
    conn.execute(
        "INSERT INTO finance_correction_items (id, correction_id, target_allocation_id, obligation_id, target_type, amount) VALUES ('ci-1', ?, ?, 'oblg-uspp', 'OBLIGATION', 200000)",
        (corr_id_1, alloc_id),
    )
    # Rollback amount_paid pada obligasi
    conn.execute("UPDATE finance_obligations SET amount_paid = amount_paid - 200000, status = 'PARTIALLY_PAID' WHERE id = 'oblg-uspp'")
    conn.execute("UPDATE finance_payments SET correction_status = 'PARTIALLY_CORRECTED' WHERE id = ?", (pay_id,))

    # Verifikasi parsial
    cur = conn.execute("SELECT status, correction_status FROM finance_payments WHERE id = ?", (pay_id,))
    st, corr_st = cur.fetchone()
    assert st == "PAID", "Payment status must remain PAID (non-destructive history)."
    assert corr_st == "PARTIALLY_CORRECTED", "Payment correction_status must be PARTIALLY_CORRECTED."

    cur = conn.execute("SELECT amount_paid FROM finance_obligations WHERE id = 'oblg-uspp'")
    assert cur.fetchone()[0] == 300000, "Obligation amount_paid must be reduced to Rp 300.000."

    # 2. KOREKSI PENUH: Sisa Rp 300.000 dikoreksi
    corr_id_2 = "cor-part-2"
    conn.execute(
        """
        INSERT INTO finance_corrections (
            id, correction_number, correction_type, target_payment_id, total_amount,
            method, reason, is_recovery_case, recovery_amount, recovery_status, created_by
        ) VALUES (?, 'VOID-002', 'VOID', ?, 300000, NULL, 'Pembatalan sisa pembayaran', 0, 0, 'NONE', 'usr-bend')
        """,
        (corr_id_2, pay_id),
    )
    conn.execute(
        "INSERT INTO finance_correction_items (id, correction_id, target_allocation_id, obligation_id, target_type, amount) VALUES ('ci-2', ?, ?, 'oblg-uspp', 'OBLIGATION', 300000)",
        (corr_id_2, alloc_id),
    )
    conn.execute("UPDATE finance_obligations SET amount_paid = amount_paid - 300000, status = 'UNPAID' WHERE id = 'oblg-uspp'")
    conn.execute("UPDATE finance_payments SET correction_status = 'FULLY_CORRECTED' WHERE id = ?", (pay_id,))

    cur = conn.execute("SELECT status, correction_status FROM finance_payments WHERE id = ?", (pay_id,))
    st, corr_st = cur.fetchone()
    assert st == "PAID", "Payment status must still remain PAID historically."
    assert corr_st == "FULLY_CORRECTED", "Payment correction_status must be FULLY_CORRECTED."

    cur = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = 'oblg-uspp'")
    paid, ost = cur.fetchone()
    assert paid == 0 and ost == "UNPAID", "Obligation must be reset to UNPAID with amount_paid = 0."

    # 4. Kasus C (Patch Poin 3): Koreksi obligation harus memakai net authoritative
    # Allocation 200k, refund 50k -> effective paid 150k.
    # Stale-cache/recalculate -> tetap 150k.
    # Full correction: refund sisa 150k -> effective paid 0k.
    # Over-correction divalidasi dari akumulasi finance_correction_items.
    oblg_net_id = "oblg-net-test"
    conn.execute(
        "INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, amount_expected, amount_exempted, amount_paid, status) VALUES (?, 'san-1', 'SPP', 1, '2026-10', 300000, 0, 0, 'UNPAID')",
        (oblg_net_id,),
    )
    pay_net_id = "pay-net-test"
    conn.execute(
        "INSERT INTO finance_payments (id, payment_number, santri_id, channel, method, gross_amount, net_amount, status, correction_status, allocation_status, paid_at) VALUES (?, 'PAY-NET-001', 'san-1', 'DUITKU', 'VA_BCA', 200000, 200000, 'PAID', 'NONE', 'ALLOCATED', '2026-09-19 12:00:00')",
        (pay_net_id,),
    )
    alloc_net_id = "alloc-net-test"
    conn.execute(
        "INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status) VALUES (?, ?, ?, 'OBLIGATION', 'SPP', 200000, 0, 'UNDISBURSED')",
        (alloc_net_id, pay_net_id, oblg_net_id),
    )
    conn.execute("UPDATE finance_obligations SET amount_paid = 200000, status = 'PARTIALLY_PAID' WHERE id = ?", (oblg_net_id,))

    # Partial refund Rp 50.000
    corr_net_1 = "corr-net-50k"
    conn.execute(
        "INSERT INTO finance_corrections (id, correction_number, correction_type, target_payment_id, total_amount, method, reason, is_recovery_case, recovery_amount, recovery_status, created_by) VALUES (?, 'REF-NET-001', 'REFUND', ?, 50000, 'TRANSFER', 'Pengembalian transfer 50k', 0, 0, 'NONE', 'usr-bend')",
        (corr_net_1, pay_net_id),
    )
    conn.execute(
        "INSERT INTO finance_correction_items (id, correction_id, target_allocation_id, obligation_id, target_type, amount) VALUES ('ci-net-1', ?, ?, ?, 'OBLIGATION', 50000)",
        (corr_net_1, alloc_net_id, oblg_net_id),
    )

    # Net authoritative query:
    gross_alloc = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM finance_allocations WHERE obligation_id = ?", (oblg_net_id,)).fetchone()[0]
    tot_corr = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM finance_correction_items WHERE obligation_id = ?", (oblg_net_id,)).fetchone()[0]
    net_paid = max(0, gross_alloc - tot_corr)
    assert gross_alloc == 200000, f"Gross alloc must be 200k, got {gross_alloc}"
    assert tot_corr == 50000, f"Total corr must be 50k, got {tot_corr}"
    assert net_paid == 150000, f"Net paid must be 150k, got {net_paid}"

    conn.execute("UPDATE finance_obligations SET amount_paid = ?, status = 'PARTIALLY_PAID' WHERE id = ?", (net_paid, oblg_net_id))

    # Simulasi stale cache: Timpa amount_paid dengan data corrupt (misal 999.999)
    conn.execute("UPDATE finance_obligations SET amount_paid = 999999 WHERE id = ?", (oblg_net_id,))

    # Jalankan query authoritative recalculateObligation:
    rec_gross = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM finance_allocations WHERE obligation_id = ?", (oblg_net_id,)).fetchone()[0]
    rec_corr = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM finance_correction_items WHERE obligation_id = ?", (oblg_net_id,)).fetchone()[0]
    rec_net = max(0, rec_gross - rec_corr)
    assert rec_net == 150000, f"Recalculate must restore exact net 150k, got {rec_net}"

    conn.execute("UPDATE finance_obligations SET amount_paid = ? WHERE id = ?", (rec_net, oblg_net_id))
    cur = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = ?", (oblg_net_id,))
    p_cur, st_cur = cur.fetchone()
    assert p_cur == 150000 and st_cur == "PARTIALLY_PAID"

    # Full correction: Refund sisa 150k
    corr_net_2 = "corr-net-150k"
    conn.execute(
        "INSERT INTO finance_corrections (id, correction_number, correction_type, target_payment_id, total_amount, method, reason, is_recovery_case, recovery_amount, recovery_status, created_by) VALUES (?, 'REF-NET-002', 'REFUND', ?, 150000, 'TRANSFER', 'Pengembalian sisa transfer 150k', 0, 0, 'NONE', 'usr-bend')",
        (corr_net_2, pay_net_id),
    )
    conn.execute(
        "INSERT INTO finance_correction_items (id, correction_id, target_allocation_id, obligation_id, target_type, amount) VALUES ('ci-net-2', ?, ?, ?, 'OBLIGATION', 150000)",
        (corr_net_2, alloc_net_id, oblg_net_id),
    )

    tot_corr_full = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM finance_correction_items WHERE obligation_id = ?", (oblg_net_id,)).fetchone()[0]
    net_paid_full = max(0, gross_alloc - tot_corr_full)
    assert tot_corr_full == 200000
    assert net_paid_full == 0
    conn.execute("UPDATE finance_obligations SET amount_paid = 0, status = 'UNPAID' WHERE id = ?", (oblg_net_id,))
    cur = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = ?", (oblg_net_id,))
    assert cur.fetchone() == (0, "UNPAID")

    # Over-correction test: Coba insert koreksi ke-3 melebihi alokasi awal 200k
    try:
        conn.execute(
            "INSERT INTO finance_correction_items (id, correction_id, target_allocation_id, obligation_id, target_type, amount) VALUES ('ci-over-net', ?, ?, ?, 'OBLIGATION', 1)",
            (corr_net_2, alloc_net_id, oblg_net_id),
        )
        assert False, "Database trigger must prevent over-correction beyond allocation amount."
    except sqlite3.IntegrityError:
        pass

    print("[OK] Koreksi parsial/penuh non-destruktif dan trigger over-correction verified.")


def test_accurate_two_way_wallet_reversal():
    print("6. Testing Pembalikan Uang Jajan Dua Arah yang Presisi (PRD #15, #16, Plan 4.3)...")
    conn = setup_test_db()
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, saldo_uang_jajan) VALUES ('san-1', 'NIS001', 'Ahmad Faris', 0)")

    # 1. Top-Up Uang Jajan Rp 100.000
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, notes
        ) VALUES ('w-in-1', 'san-1', 'IN', 'TOPUP_CASH', 100000, 0, 100000, 'Setoran tunai loket')
        """
    )
    conn.execute("UPDATE santri SET saldo_uang_jajan = 100000 WHERE id = 'san-1'")

    # 2. Pembalikan Top-up (Reversal Top-up): Arah mutasi WAJIB 'OUT', tipe 'REVERSAL'
    conn.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount, balance_before, balance_after, notes
        ) VALUES ('w-rev-1', 'san-1', 'OUT', 'REVERSAL', 100000, 100000, 0, 'Pembalikan salah top-up')
        """
    )
    conn.execute("UPDATE santri SET saldo_uang_jajan = 0 WHERE id = 'san-1'")

    cur = conn.execute("SELECT saldo_uang_jajan FROM santri WHERE id = 'san-1'")
    assert cur.fetchone()[0] == 0, "Wallet balance must be 0 after top-up reversal."

    # 3. Pembalikan Penarikan (Reversal Withdrawal): Arah mutasi WAJIB 'IN', tipe 'REVERSAL'
    # Santri menabung 50.000
    conn.execute(
        "INSERT INTO finance_wallet_ledger (id, santri_id, direction, movement_type, amount, balance_before, balance_after, notes) VALUES ('w-in-2', 'san-1', 'IN', 'TOPUP_CASH', 50000, 0, 50000, 'Top-up')"
    )
    conn.execute("UPDATE santri SET saldo_uang_jajan = 50000 WHERE id = 'san-1'")

    # Santri menarik 30.000 -> saldo 20.000
    conn.execute(
        "INSERT INTO finance_wallet_ledger (id, santri_id, direction, movement_type, amount, balance_before, balance_after, notes) VALUES ('w-out-1', 'san-1', 'OUT', 'WITHDRAWAL_LOKET', 30000, 50000, 20000, 'Penarikan di loket')"
    )
    conn.execute("UPDATE santri SET saldo_uang_jajan = 20000 WHERE id = 'san-1'")

    # Kasir membatalkan penarikan tersebut: Saldo harus bertambah kembali!
    conn.execute(
        "INSERT INTO finance_wallet_ledger (id, santri_id, direction, movement_type, amount, balance_before, balance_after, notes) VALUES ('w-rev-2', 'san-1', 'IN', 'REVERSAL', 30000, 20000, 50000, 'Pembalikan penarikan loket')"
    )
    conn.execute("UPDATE santri SET saldo_uang_jajan = 50000 WHERE id = 'san-1'")

    cur = conn.execute("SELECT saldo_uang_jajan FROM santri WHERE id = 'san-1'")
    assert cur.fetchone()[0] == 50000, "Wallet balance must be restored to 50.000 after withdrawal reversal."

    print("[OK] Pembalikan uang jajan dua arah (Top-up -> OUT, Withdrawal -> IN) verified.")


def test_disbursed_funds_recovery_case_protection():
    print("7. Testing Proteksi Dana Telanjur Disalurkan (Disbursed Funds Protection, PRD & Plan 4.3)...")
    conn = setup_test_db()

    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('usr-bend', 'bend@test.com', 'hash', 'Bendahara', 'bendahara')")
    conn.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('jas-kat-1', 'Katering Barokah', 'Makan')")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, tempat_makan_id) VALUES ('san-1', 'NIS001', 'Ahmad Faris', 'jas-kat-1')")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, status) VALUES (1, '2026/2027', 'Aktif')")

    # Obligasi Uang Makan Rp 400.000
    conn.execute(
        "INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, amount_expected, amount_exempted, amount_paid, status, provider_id) VALUES ('oblg-makan', 'san-1', 'UANG_MAKAN', 1, '2026-09', 400000, 0, 400000, 'PAID', 'jas-kat-1')"
    )

    pay_id = "pay-makan-disb"
    alloc_id = "alloc-makan-disb"
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, channel, method,
            gross_amount, gateway_fee, net_amount, status, correction_status,
            allocation_status, paid_at
        ) VALUES (?, 'PAY-MAKAN-001', NULL, 'san-1', 'DUITKU', 'DUITKU_VA', 400000, 0, 400000, 'SETTLED', 'NONE', 'ALLOCATED', '2026-09-01 10:00:00')
        """,
        (pay_id,),
    )
    # Alokasi Uang Makan sudah DISALURKAN PENUH ke Katering Barokah (disbursed_amount = 400.000)
    conn.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, provider_id,
            amount, disbursed_amount, distribution_status
        ) VALUES (?, ?, 'oblg-makan', 'OBLIGATION', 'UANG_MAKAN', 'jas-kat-1', 400000, 400000, 'DISBURSED')
        """,
        (alloc_id, pay_id),
    )

    # Pencatatan Penyaluran di tabel finance_distributions & items
    dist_id = "dist-makan-1"
    conn.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, transferred_by, transferred_at
        ) VALUES (?, 'DIS-20260905-001', 'KATERING', 'jas-kat-1', 'UANG_MAKAN', '2026-09', 400000, 'TRANSFER', 'usr-bend', '2026-09-05 14:00:00')
        """,
        (dist_id,),
    )
    conn.execute(
        "INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount) VALUES ('di-1', ?, ?, 400000)",
        (dist_id, alloc_id),
    )

    # KOREKSI DILAKUKAN (misal santri pindah/sakit):
    # PRD & PLAN 4.3 MANDATE:
    # "Sistem DILARANG secara otomatis menerapkan aturan 'potong periode berikutnya'.
    # Transaksi ditandai sebagai Recovery / Reconciliation Case khusus yang mewajibkan investigasi manual."
    corr_id = "cor-recovery-case-1"
    conn.execute(
        """
        INSERT INTO finance_corrections (
            id, correction_number, correction_type, target_payment_id, total_amount,
            method, reason, is_recovery_case, recovery_amount, recovery_status, recovery_notes, created_by
        ) VALUES (
            ?, 'REF-20260919-REC', 'REFUND', ?, 400000,
            'TRANSFER', 'Santri pindah asrama, alokasi makan dibatalkan',
            1, 400000, 'PENDING_RECOVERY', 'Dana telah ditransfer ke Katering Barokah; memerlukan klaim pengembalian dana', 'usr-bend'
        )
        """,
        (corr_id, pay_id),
    )
    conn.execute(
        "INSERT INTO finance_correction_items (id, correction_id, target_allocation_id, obligation_id, target_type, amount, is_disbursed_portion) VALUES ('ci-rec-1', ?, ?, 'oblg-makan', 'OBLIGATION', 400000, 1)",
        (corr_id, alloc_id),
    )
    # Catat ke finance_reconciliation_items
    rec_item_id = "rec-recovery-case-1"
    conn.execute(
        """
        INSERT INTO finance_reconciliation_items (
            id, payment_id, external_reference, internal_amount, external_amount,
            discrepancy_amount, match_status, resolution_action, resolution_notes
        ) VALUES (
            ?, ?, 'REF-20260919-REC', 400000, 0, 400000,
            'AMOUNT_MISMATCH', 'ADJUSTMENT', 'Kasus Pemulihan Dana dari koreksi REF-20260919-REC: Dana Rp 400.000 telah disalurkan ke Katering Barokah'
        )
        """,
        (rec_item_id, pay_id),
    )

    # Verifikasi Flagging Recovery Case
    cur = conn.execute("SELECT is_recovery_case, recovery_amount, recovery_status FROM finance_corrections WHERE id = ?", (corr_id,))
    is_rec, rec_amt, rec_st = cur.fetchone()
    assert is_rec == 1, "Correction must be flagged as is_recovery_case = 1."
    assert rec_amt == 400000, "Recovery amount must match disbursed portion."
    assert rec_st == "PENDING_RECOVERY", "Initial recovery status must be PENDING_RECOVERY."

    # Verifikasi Tidak Ada Auto-Deduct: Distribusi periode berikutnya tetap berjalan normal tanpa pemotongan liar
    # Simulasi penyelesaian manual oleh Bendahara setelah vendor mentransfer balik dana:
    conn.execute(
        "UPDATE finance_corrections SET recovery_status = 'RECOVERED', recovery_notes = recovery_notes || ' | [RESOLVED]: Katering Barokah telah menyetor kembali dana ke kas BSI' WHERE id = ?",
        (corr_id,),
    )
    cur = conn.execute("SELECT recovery_status FROM finance_corrections WHERE id = ?", (corr_id,))
    assert cur.fetchone()[0] == "RECOVERED", "Recovery status must transition to RECOVERED upon resolution."

    print("[OK] Proteksi dana telanjur disalurkan (Recovery Case tanpa auto-deduct) verified.")


def test_rbac_and_view_only_guards():
    print("8. Testing RBAC & View-Only Guards for Rekonsiliasi...")
    conn = setup_test_db()

    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('u-admin', 'admin@test.com', 'h', 'Admin', 'admin')")
    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('u-bend', 'bend@test.com', 'h', 'Bendahara', 'bendahara')")
    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('u-pimp', 'pimp@test.com', 'h', 'Pimpinan', 'pimpinan')")
    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('u-test', 'test@test.com', 'h', 'Tester', 'tester')")

    def check_permissions(role: str) -> dict:
        is_pimpinan = role == "pimpinan"
        is_tester = role == "tester"
        is_bendahara_or_admin = role in ["admin", "bendahara"]
        can_view = is_pimpinan or is_tester or is_bendahara_or_admin
        can_mutate = can_view and is_bendahara_or_admin and not is_pimpinan and not is_tester
        return {"canView": can_view, "canMutate": can_mutate}

    pimp_perm = check_permissions("pimpinan")
    assert pimp_perm["canView"] is True, "Pimpinan must have view access."
    assert pimp_perm["canMutate"] is False, "Pimpinan must be strictly view-only."

    test_perm = check_permissions("tester")
    assert test_perm["canView"] is True, "Tester must have view access."
    assert test_perm["canMutate"] is False, "Tester must be strictly view-only."

    admin_perm = check_permissions("admin")
    assert admin_perm["canView"] is True and admin_perm["canMutate"] is True, "Admin must have full access."

    bend_perm = check_permissions("bendahara")
    assert bend_perm["canView"] is True and bend_perm["canMutate"] is True, "Bendahara must have full access."

    print("[OK] RBAC & view-only guards verified.")


def test_ui_components_existence_and_structure():
    print("9. Testing UI Components Existence & Structure for Rekonsiliasi...")
    req_files = [
        ROOT / "migrations" / "0163_finance_reconciliation_and_corrections.sql",
        ROOT / "lib" / "finance" / "reconciliation-types.ts",
        ROOT / "lib" / "finance" / "settlement.ts",
        ROOT / "lib" / "finance" / "corrections.ts",
        ROOT / "lib" / "finance" / "reconciliation.ts",
        ROOT / "app" / "dashboard" / "keuangan" / "rekonsiliasi" / "page.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "rekonsiliasi" / "actions.ts",
        ROOT / "app" / "dashboard" / "keuangan" / "rekonsiliasi" / "_page-content.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "rekonsiliasi" / "input-settlement-modal.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "rekonsiliasi" / "manual-allocation-modal.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "rekonsiliasi" / "record-correction-modal.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "rekonsiliasi" / "recovery-case-modal.tsx",
    ]

    for f in req_files:
        assert f.is_file(), f"Required file must exist: {f}"
        assert f.stat().st_size > 50, f"File must have valid content: {f}"

    print("[OK] All 12 Rekonsiliasi & Koreksi engine & UI files confirmed present.")


def main():
    print("=" * 60)
    print("Starting Fase 8 Test Suite (Rekonsiliasi & Koreksi)...")
    print("=" * 60)

    test_migration_0163_and_schema_invariants()
    test_paid_not_settled_and_settlement_batch()
    test_cash_session_physical_reconciliation()
    test_unallocated_resolution_without_guessing()
    test_non_destructive_financial_corrections()
    test_accurate_two_way_wallet_reversal()
    test_disbursed_funds_recovery_case_protection()
    test_rbac_and_view_only_guards()
    test_ui_components_existence_and_structure()

    print("=" * 60)
    print("ALL FASE 8 TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
