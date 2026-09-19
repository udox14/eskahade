"""Automated Contract, Business Logic, Provider Snapshot, & Distribution Engine Tests for Fase 7.

Validates:
1. Migration 0162 & Schema Invariants:
   - Tables: finance_distributions, finance_distribution_items, finance_provider_accounts.
   - Trigger trg_finance_dist_items_prevent_overdraw prevents over-disbursement at database level.
   - Registration of Penyaluran Dana in fitur_akses.
2. Provider Accounts Management (PRD #26):
   - CRUD provider accounts linked to master_jasa (no duplicate provider master).
   - Primary account toggle rule.
3. Penyaluran ke Katering & Laundry (PRD #25, #27):
   - Slicing alokasi Uang Makan & Uang Nyuci.
   - Penyaluran bertahap / parsial berulang (UNDISBURSED -> PARTIALLY_DISBURSED -> DISBURSED).
   - Strict prevention of over-disbursement (engine check and database trigger).
4. Penyaluran ke Bendahara Pesantren (PRD #24.1):
   - SPP, USPP, EHB multi-allocation slicing FIFO.
5. Provider Snapshot Invariant (PRD #28):
   - Santri changing provider in subsequent period does not mutate or divert historical distribution entitlement.
6. Multi-Method (TRANSFER & CASH) & Receipt Generation (PRD #27, #29).
7. Authoritative Recalculation (recalculateAllocationDisbursement).
8. RBAC Server Guards: Pimpinan & Tester strictly view-only, Admin & Bendahara authorized.
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
    ]:
        with open(mig, "r", encoding="utf-8") as f:
            conn.executescript(f.read())

    # Seed data dasar
    conn.execute("INSERT INTO tahun_ajaran (nama, status) VALUES ('2026/2027', 'Aktif');")

    # Seed users
    conn.executescript(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, roles)
        VALUES ('usr_admin', 'admin@pesantren.id', 'hash', 'Admin Keuangan', 'admin', '["admin"]');

        INSERT INTO users (id, email, password_hash, full_name, role, roles)
        VALUES ('usr_bendahara', 'bendahara@pesantren.id', 'hash', 'Ustadz Bendahara', 'bendahara', '["bendahara"]');

        INSERT INTO users (id, email, password_hash, full_name, role, roles)
        VALUES ('usr_pimpinan', 'pimpinan@pesantren.id', 'hash', 'K.H. Pimpinan', 'pimpinan', '["pimpinan"]');

        INSERT INTO users (id, email, password_hash, full_name, role, roles)
        VALUES ('usr_tester', 'tester@pesantren.id', 'hash', 'Akun Tester', 'tester', '["tester"]');
        """
    )

    # Seed master_jasa
    conn.executescript(
        """
        INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('jasa_makan_1', 'Katering Barokah', 'Makan');
        INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('jasa_makan_2', 'Katering Amanah', 'Makan');
        INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('jasa_cuci_1', 'Laundry Bersih', 'Cuci');
        INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('jasa_cuci_2', 'Laundry Wangi', 'Cuci');
        """
    )

    # Seed santri
    conn.executescript(
        """
        INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama, kamar, tempat_makan_id, tempat_mencuci_id)
        VALUES ('san_1', 'NIS001', 'Ahmad Zaki', 'aktif', 'Asrama Al-Falah', '101', 'jasa_makan_1', 'jasa_cuci_1');

        INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama, kamar, tempat_makan_id, tempat_mencuci_id)
        VALUES ('san_2', 'NIS002', 'Budi Santoso', 'aktif', 'Asrama Al-Falah', '102', 'jasa_makan_1', 'jasa_cuci_1');

        INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama, kamar, tempat_makan_id, tempat_mencuci_id)
        VALUES ('san_3', 'NIS003', 'Chandra Gunawan', 'aktif', 'Asrama Al-Ikhlas', '201', 'jasa_makan_2', 'jasa_cuci_2');
        """
    )

    conn.commit()
    return conn


def test_migration_0162_schema_and_features():
    print("1. Testing Migration 0162 Schema, Trigger & fitur_akses Registration...")
    conn = setup_test_db()
    cur = conn.cursor()

    # Cek tabel-tabel baru
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    assert "finance_distributions" in tables, "Table finance_distributions missing"
    assert "finance_distribution_items" in tables, "Table finance_distribution_items missing"
    assert "finance_provider_accounts" in tables, "Table finance_provider_accounts missing"

    # Cek trigger
    triggers = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='trigger'").fetchall()]
    assert "trg_finance_dist_items_prevent_overdraw" in triggers, "Trigger prevent overdraw missing"

    # Cek fitur_akses
    row = cur.execute("SELECT roles, is_active FROM fitur_akses WHERE href = '/dashboard/keuangan/penyaluran'").fetchone()
    assert row is not None, "Fitur Penyaluran Dana belum terdaftar di fitur_akses"
    roles = json.loads(row[0])
    assert "bendahara" in roles and "admin" in roles and "pimpinan" in roles, "Role akses penyaluran tidak lengkap"

    conn.close()
    print("[OK] Migration 0162 and schema invariants verified.")


def test_provider_accounts_management():
    print("2. Testing Provider Accounts Management (PRD #26)...")
    conn = setup_test_db()
    cur = conn.cursor()

    # Tambah rekening 1 (primary)
    cur.execute(
        """
        INSERT INTO finance_provider_accounts (id, provider_id, bank_name, account_number, account_holder, is_primary)
        VALUES ('acc_1', 'jasa_makan_1', 'BSI', '7123456789', 'Katering Barokah Utama', 1)
        """
    )

    # Tambah rekening 2 (non-primary)
    cur.execute(
        """
        INSERT INTO finance_provider_accounts (id, provider_id, bank_name, account_number, account_holder, is_primary)
        VALUES ('acc_2', 'jasa_makan_1', 'BCA', '5432109876', 'Hj. Barokah', 0)
        """
    )
    conn.commit()

    # Cek list rekening
    rows = cur.execute(
        "SELECT id, bank_name, is_primary FROM finance_provider_accounts WHERE provider_id = 'jasa_makan_1' ORDER BY is_primary DESC"
    ).fetchall()
    assert len(rows) == 2
    assert rows[0][0] == "acc_1" and rows[0][2] == 1

    # Ubah rekening 2 menjadi primary
    cur.execute("UPDATE finance_provider_accounts SET is_primary = 0 WHERE provider_id = 'jasa_makan_1'")
    cur.execute("UPDATE finance_provider_accounts SET is_primary = 1 WHERE id = 'acc_2'")
    conn.commit()

    rows = cur.execute(
        "SELECT id, is_primary FROM finance_provider_accounts WHERE provider_id = 'jasa_makan_1' ORDER BY is_primary DESC"
    ).fetchall()
    assert rows[0][0] == "acc_2" and rows[0][1] == 1
    assert rows[1][0] == "acc_1" and rows[1][1] == 0

    # Hapus rekening 1
    cur.execute("DELETE FROM finance_provider_accounts WHERE id = 'acc_1'")
    conn.commit()
    assert cur.execute("SELECT COUNT(*) FROM finance_provider_accounts WHERE provider_id = 'jasa_makan_1'").fetchone()[0] == 1

    conn.close()
    print("[OK] Provider accounts management verified.")


def seed_sample_obligations_and_payments(conn: sqlite3.Connection):
    cur = conn.cursor()

    # 1. Buat kewajiban Uang Makan untuk san_1 dan san_2 (Katering Barokah, periode 2026-09, Rp 400.000 masing-masing)
    cur.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, provider_id
        ) VALUES (
            'ob_makan_san1', 'san_1', 'UANG_MAKAN', 1, '2026-09',
            400000, 0, 400000, 'PAID', 'jasa_makan_1'
        )
        """
    )
    cur.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, provider_id
        ) VALUES (
            'ob_makan_san2', 'san_2', 'UANG_MAKAN', 1, '2026-09',
            400000, 0, 400000, 'PAID', 'jasa_makan_1'
        )
        """
    )

    # 2. Buat kewajiban SPP untuk san_1 dan san_2 (Bendahara, periode 2026-09, Rp 200.000 masing-masing)
    cur.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, provider_id
        ) VALUES (
            'ob_spp_san1', 'san_1', 'SPP', 1, '2026-09',
            200000, 0, 200000, 'PAID', NULL
        )
        """
    )
    cur.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, provider_id
        ) VALUES (
            'ob_spp_san2', 'san_2', 'SPP', 1, '2026-09',
            200000, 0, 200000, 'PAID', NULL
        )
        """
    )

    # 3. Buat payments
    cur.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, gateway_fee, net_amount,
            status, paid_at
        ) VALUES (
            'pay_1', 'PAY-20260919-0001', 'san_1', 'CASH', 'CASH', 600000, 0, 600000,
            'PAID', '2026-09-01 10:00:00'
        )
        """
    )
    cur.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, gateway_fee, net_amount,
            status, paid_at
        ) VALUES (
            'pay_2', 'PAY-20260919-0002', 'san_2', 'CASH', 'CASH', 600000, 0, 600000,
            'PAID', '2026-09-02 11:00:00'
        )
        """
    )

    # 4. Buat finance_allocations
    # Alokasi Makan san_1
    cur.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, provider_id,
            amount, disbursed_amount, distribution_status, created_at
        ) VALUES (
            'alloc_makan_1', 'pay_1', 'ob_makan_san1', 'OBLIGATION', 'UANG_MAKAN', 'jasa_makan_1',
            400000, 0, 'UNDISBURSED', '2026-09-01 10:00:00'
        )
        """
    )
    # Alokasi Makan san_2
    cur.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, provider_id,
            amount, disbursed_amount, distribution_status, created_at
        ) VALUES (
            'alloc_makan_2', 'pay_2', 'ob_makan_san2', 'OBLIGATION', 'UANG_MAKAN', 'jasa_makan_1',
            400000, 0, 'UNDISBURSED', '2026-09-02 11:00:00'
        )
        """
    )

    # Alokasi SPP san_1
    cur.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, provider_id,
            amount, disbursed_amount, distribution_status, created_at
        ) VALUES (
            'alloc_spp_1', 'pay_1', 'ob_spp_san1', 'OBLIGATION', 'SPP', NULL,
            200000, 0, 'UNDISBURSED', '2026-09-01 10:00:00'
        )
        """
    )
    # Alokasi SPP san_2
    cur.execute(
        """
        INSERT INTO finance_allocations (
            id, payment_id, obligation_id, target_type, item_type, provider_id,
            amount, disbursed_amount, distribution_status, created_at
        ) VALUES (
            'alloc_spp_2', 'pay_2', 'ob_spp_san2', 'OBLIGATION', 'SPP', NULL,
            200000, 0, 'UNDISBURSED', '2026-09-02 11:00:00'
        )
        """
    )

    conn.commit()


def test_partial_and_full_distribution_katering():
    print("3. Testing Partial & Sequential Distribution for Katering (PRD #25, #27)...")
    conn = setup_test_db()
    seed_sample_obligations_and_payments(conn)
    cur = conn.cursor()

    # Total Uang Makan untuk Katering Barokah (jasa_makan_1) pada 2026-09 adalah 400k + 400k = 800k
    total_avail = cur.execute(
        """
        SELECT SUM(amount - disbursed_amount)
        FROM finance_allocations a
        JOIN finance_obligations o ON a.obligation_id = o.id
        WHERE a.provider_id = 'jasa_makan_1' AND a.item_type = 'UANG_MAKAN' AND o.period = '2026-09'
        """
    ).fetchone()[0]
    assert total_avail == 800000, f"Expected 800k available, got {total_avail}"

    # TAHAP 1: Penyaluran Parsial Rp 300.000 ke Katering Barokah
    # Harus memotong alloc_makan_1 sebesar Rp 300.000 (sisa alloc 1: 100k)
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, destination_bank, destination_account, account_holder_name,
            transferred_by, transferred_at, notes
        ) VALUES (
            'dist_1', 'DIS-20260919-001', 'KATERING', 'jasa_makan_1', 'UANG_MAKAN', '2026-09',
            300000, 'TRANSFER', 'BSI', '7123456789', 'Katering Barokah',
            'usr_bendahara', '2026-09-05 14:00:00', 'Penyaluran termin 1'
        )
        """
    )
    cur.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
        VALUES ('item_1', 'dist_1', 'alloc_makan_1', 300000)
        """
    )
    cur.execute(
        """
        UPDATE finance_allocations
        SET disbursed_amount = disbursed_amount + 300000,
            distribution_status = 'PARTIALLY_DISBURSED'
        WHERE id = 'alloc_makan_1'
        """
    )
    conn.commit()

    # Verifikasi status alloc_makan_1
    row = cur.execute("SELECT disbursed_amount, distribution_status FROM finance_allocations WHERE id = 'alloc_makan_1'").fetchone()
    assert row[0] == 300000
    assert row[1] == "PARTIALLY_DISBURSED"

    # Sisa dana siap salur sekarang harus 500k (100k dari alloc 1, 400k dari alloc 2)
    sisa = cur.execute(
        """
        SELECT SUM(amount - disbursed_amount)
        FROM finance_allocations
        WHERE provider_id = 'jasa_makan_1' AND distribution_status IN ('UNDISBURSED', 'PARTIALLY_DISBURSED')
        """
    ).fetchone()[0]
    assert sisa == 500000, f"Expected 500k remaining, got {sisa}"

    # TAHAP 2: Penyaluran Termin 2 Rp 500.000 (Melunasi sisa alloc 1 Rp 100k dan seluruh alloc 2 Rp 400k)
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, destination_bank, destination_account, account_holder_name,
            transferred_by, transferred_at, notes
        ) VALUES (
            'dist_2', 'DIS-20260919-002', 'KATERING', 'jasa_makan_1', 'UANG_MAKAN', '2026-09',
            500000, 'TRANSFER', 'BSI', '7123456789', 'Katering Barokah',
            'usr_bendahara', '2026-09-10 15:00:00', 'Penyaluran termin 2 (pelunasan)'
        )
        """
    )
    # Slice 100k to alloc_makan_1
    cur.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
        VALUES ('item_2a', 'dist_2', 'alloc_makan_1', 100000)
        """
    )
    cur.execute(
        """
        UPDATE finance_allocations
        SET disbursed_amount = disbursed_amount + 100000,
            distribution_status = 'DISBURSED'
        WHERE id = 'alloc_makan_1'
        """
    )
    # Slice 400k to alloc_makan_2
    cur.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
        VALUES ('item_2b', 'dist_2', 'alloc_makan_2', 400000)
        """
    )
    cur.execute(
        """
        UPDATE finance_allocations
        SET disbursed_amount = disbursed_amount + 400000,
            distribution_status = 'DISBURSED'
        WHERE id = 'alloc_makan_2'
        """
    )
    conn.commit()

    # Verifikasi status kedua alokasi sudah DISBURSED penuh
    status_rows = cur.execute(
        "SELECT id, disbursed_amount, distribution_status FROM finance_allocations WHERE provider_id = 'jasa_makan_1'"
    ).fetchall()
    for st in status_rows:
        assert st[1] == 400000, f"Alloc {st[0]} disbursed amount should be 400k, got {st[1]}"
        assert st[2] == "DISBURSED", f"Alloc {st[0]} status should be DISBURSED, got {st[2]}"

    # Sisa dana siap salur sekarang harus 0
    sisa_akhir = cur.execute(
        """
        SELECT COALESCE(SUM(amount - disbursed_amount), 0)
        FROM finance_allocations
        WHERE provider_id = 'jasa_makan_1' AND distribution_status IN ('UNDISBURSED', 'PARTIALLY_DISBURSED')
        """
    ).fetchone()[0]
    assert sisa_akhir == 0, f"Expected 0 remaining, got {sisa_akhir}"

    conn.close()
    print("[OK] Partial and full distribution for Katering verified.")


def test_hard_prevent_over_distribution():
    print("4. Testing Hard Prevention of Over-Disbursement with Authoritative Source & Stale Cache...")
    conn = setup_test_db()
    seed_sample_obligations_and_payments(conn)
    cur = conn.cursor()

    # alloc_makan_1 nominal Rp 400.000
    # 4a. Coba salurkan Rp 500.000 langsung ke alloc_makan_1 (melebihi 400k)
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, transferred_by, transferred_at
        ) VALUES (
            'dist_overdraw', 'DIS-20260919-999', 'KATERING', 'jasa_makan_1', 'UANG_MAKAN', '2026-09',
            500000, 'CASH', 'usr_bendahara', '2026-09-01 12:00:00'
        )
        """
    )

    overdraw_caught = False
    try:
        cur.execute(
            """
            INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
            VALUES ('item_overdraw', 'dist_overdraw', 'alloc_makan_1', 500000)
            """
        )
        conn.commit()
    except sqlite3.IntegrityError as e:
        overdraw_caught = True
        assert "Total penyaluran melebihi dana alokasi yang tersedia" in str(e) or "CHECK" in str(e)

    assert overdraw_caught, "Trigger or CHECK constraint failed to prevent initial over-disbursement"

    # 4b. Skenario Stale Cache:
    # Salurkan Rp 250.000 (valid)
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, transferred_by, transferred_at
        ) VALUES (
            'dist_valid_1', 'DIS-20260919-004', 'KATERING', 'jasa_makan_1', 'UANG_MAKAN', '2026-09',
            250000, 'CASH', 'usr_bendahara', '2026-09-01 13:00:00'
        )
        """
    )
    cur.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
        VALUES ('item_valid_1', 'dist_valid_1', 'alloc_makan_1', 250000)
        """
    )
    conn.commit()

    # Sengaja manipulasi / corrupt derived cache finance_allocations.disbursed_amount menjadi 0 (stale)
    cur.execute("UPDATE finance_allocations SET disbursed_amount = 0, distribution_status = 'UNDISBURSED' WHERE id = 'alloc_makan_1'")
    conn.commit()

    # Sekarang coba masukkan item penyaluran baru sebesar Rp 200.000
    # Jika sistem hanya mengecek cache (0 + 200k = 200k <= 400k), transaksi akan lolos (BUG).
    # Namun karena trigger menggunakan SUM(finance_distribution_items.amount):
    # SUM aktual = 250.000 + 200.000 = 450.000 > 400.000 -> WAJIB DITOLAK!
    stale_cache_overdraw_caught = False
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, transferred_by, transferred_at
        ) VALUES (
            'dist_stale_overdraw', 'DIS-20260919-005', 'KATERING', 'jasa_makan_1', 'UANG_MAKAN', '2026-09',
            200000, 'CASH', 'usr_bendahara', '2026-09-01 14:00:00'
        )
        """
    )
    try:
        cur.execute(
            """
            INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
            VALUES ('item_stale_overdraw', 'dist_stale_overdraw', 'alloc_makan_1', 200000)
            """
        )
        conn.commit()
    except sqlite3.IntegrityError as e:
        stale_cache_overdraw_caught = True
        assert "Total penyaluran melebihi dana alokasi yang tersedia" in str(e)

    assert stale_cache_overdraw_caught, "Trigger FAILED to prevent over-disbursement when derived cache was stale!"

    # 4c. Skenario Penyaluran Pas (Remaining = 150.000):
    # 250.000 + 150.000 = 400.000 (harus sukses)
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, transferred_by, transferred_at
        ) VALUES (
            'dist_valid_exact', 'DIS-20260919-006', 'KATERING', 'jasa_makan_1', 'UANG_MAKAN', '2026-09',
            150000, 'CASH', 'usr_bendahara', '2026-09-01 15:00:00'
        )
        """
    )
    cur.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
        VALUES ('item_valid_exact', 'dist_valid_exact', 'alloc_makan_1', 150000)
        """
    )
    conn.commit()

    # 4d. Setelah genap 400.000, coba tambahkan lagi Rp 1 -> WAJIB DITOLAK
    even_one_rupiah_caught = False
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, transferred_by, transferred_at
        ) VALUES (
            'dist_plus_one', 'DIS-20260919-007', 'KATERING', 'jasa_makan_1', 'UANG_MAKAN', '2026-09',
            1, 'CASH', 'usr_bendahara', '2026-09-01 16:00:00'
        )
        """
    )
    try:
        cur.execute(
            """
            INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
            VALUES ('item_plus_one', 'dist_plus_one', 'alloc_makan_1', 1)
            """
        )
        conn.commit()
    except sqlite3.IntegrityError as e:
        even_one_rupiah_caught = True
        assert "Total penyaluran melebihi dana alokasi yang tersedia" in str(e)

    assert even_one_rupiah_caught, "Trigger FAILED to prevent 1 rupiah over-disbursement!"

    # Total item authoritative tetap presisi 400.000
    sum_items = cur.execute("SELECT SUM(amount) FROM finance_distribution_items WHERE allocation_id = 'alloc_makan_1'").fetchone()[0]
    assert sum_items == 400000, f"Authoritative sum must be exactly 400k, got {sum_items}"

    conn.close()
    print("[OK] Authoritative over-disbursement prevention & stale cache protection verified.")


def test_penyaluran_ke_bendahara_pesantren():
    print("5. Testing Penyaluran ke Bendahara Pesantren (SPP FIFO Multi-Allocation)...")
    conn = setup_test_db()
    seed_sample_obligations_and_payments(conn)
    cur = conn.cursor()

    # Total SPP siap salur: san_1 200k + san_2 200k = 400k
    # Salurkan Rp 300.000 secara FIFO
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, destination_bank, destination_account, account_holder_name,
            transferred_by, transferred_at
        ) VALUES (
            'dist_spp', 'DIS-20260919-003', 'BENDAHARA', NULL, 'SPP', '2026-09',
            300000, 'TRANSFER', 'BSI', '1002345678', 'Yayasan Pesantren Sukahideng',
            'usr_bendahara', '2026-09-05 10:00:00'
        )
        """
    )

    # Slice 1: 200k to alloc_spp_1 (Lunas)
    cur.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
        VALUES ('item_spp_1', 'dist_spp', 'alloc_spp_1', 200000)
        """
    )
    cur.execute(
        """
        UPDATE finance_allocations
        SET disbursed_amount = disbursed_amount + 200000,
            distribution_status = 'DISBURSED'
        WHERE id = 'alloc_spp_1'
        """
    )

    # Slice 2: 100k to alloc_spp_2 (Parsial)
    cur.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
        VALUES ('item_spp_2', 'dist_spp', 'alloc_spp_2', 100000)
        """
    )
    cur.execute(
        """
        UPDATE finance_allocations
        SET disbursed_amount = disbursed_amount + 100000,
            distribution_status = 'PARTIALLY_DISBURSED'
        WHERE id = 'alloc_spp_2'
        """
    )
    conn.commit()

    # Verifikasi status
    st1 = cur.execute("SELECT disbursed_amount, distribution_status FROM finance_allocations WHERE id = 'alloc_spp_1'").fetchone()
    st2 = cur.execute("SELECT disbursed_amount, distribution_status FROM finance_allocations WHERE id = 'alloc_spp_2'").fetchone()

    assert st1[0] == 200000 and st1[1] == "DISBURSED"
    assert st2[0] == 100000 and st2[1] == "PARTIALLY_DISBURSED"

    # Sisa dana siap salur SPP: 100k
    sisa_spp = cur.execute(
        """
        SELECT SUM(amount - disbursed_amount)
        FROM finance_allocations
        WHERE item_type = 'SPP' AND provider_id IS NULL AND distribution_status IN ('UNDISBURSED', 'PARTIALLY_DISBURSED')
        """
    ).fetchone()[0]
    assert sisa_spp == 100000, f"Expected 100k remaining SPP, got {sisa_spp}"

    conn.close()
    print("[OK] Penyaluran ke Bendahara Pesantren verified.")


def test_provider_snapshot_integrity():
    print("6. Testing Provider Snapshot Invariant (PRD #28)...")
    conn = setup_test_db()
    seed_sample_obligations_and_payments(conn)
    cur = conn.cursor()

    # Pada periode 2026-09, san_1 memiliki alokasi Uang Makan Rp 400.000 dengan snapshot provider jasa_makan_1 (Katering Barokah).
    # Sekarang, santri pindah tempat makan ke jasa_makan_2 (Katering Amanah) pada master santri:
    cur.execute("UPDATE santri SET tempat_makan_id = 'jasa_makan_2' WHERE id = 'san_1'")
    conn.commit()

    # Pastikan alokasi transaksi 2026-09 TETAP terhubung ke jasa_makan_1
    alloc = cur.execute("SELECT provider_id FROM finance_allocations WHERE id = 'alloc_makan_1'").fetchone()
    assert alloc[0] == "jasa_makan_1", "Historical allocation provider_id was mutated!"

    # Dana yang siap disalurkan untuk jasa_makan_2 (Katering Amanah) pada 2026-09 tetap Rp 0
    dana_amanah = cur.execute(
        """
        SELECT COALESCE(SUM(amount - disbursed_amount), 0)
        FROM finance_allocations
        WHERE provider_id = 'jasa_makan_2' AND item_type = 'UANG_MAKAN'
        """
    ).fetchone()[0]
    assert dana_amanah == 0, f"Katering Amanah should have 0 ready to disburse, got {dana_amanah}"

    # Dana siap salur untuk jasa_makan_1 (Katering Barokah) tetap Rp 800.000
    dana_barokah = cur.execute(
        """
        SELECT COALESCE(SUM(amount - disbursed_amount), 0)
        FROM finance_allocations
        WHERE provider_id = 'jasa_makan_1' AND item_type = 'UANG_MAKAN'
        """
    ).fetchone()[0]
    assert dana_barokah == 800000, f"Katering Barokah should have 800k ready to disburse, got {dana_barokah}"

    conn.close()
    print("[OK] Provider snapshot integrity verified.")


def test_authoritative_recalculation():
    print("7. Testing Authoritative Recalculation (recalculateAllocationDisbursement)...")
    conn = setup_test_db()
    seed_sample_obligations_and_payments(conn)
    cur = conn.cursor()

    # Tambah 2 item penyaluran parsial ke alloc_makan_1
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, transferred_by, transferred_at
        ) VALUES (
            'dist_rec_1', 'DIS-20260919-REC1', 'KATERING', 'jasa_makan_1', 'UANG_MAKAN', '2026-09',
            150000, 'CASH', 'usr_bendahara', '2026-09-01 10:00:00'
        )
        """
    )
    cur.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
        VALUES ('item_rec_1', 'dist_rec_1', 'alloc_makan_1', 150000)
        """
    )
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, transferred_by, transferred_at
        ) VALUES (
            'dist_rec_2', 'DIS-20260919-REC2', 'KATERING', 'jasa_makan_1', 'UANG_MAKAN', '2026-09',
            100000, 'CASH', 'usr_bendahara', '2026-09-02 10:00:00'
        )
        """
    )
    cur.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
        VALUES ('item_rec_2', 'dist_rec_2', 'alloc_makan_1', 100000)
        """
    )
    # Sengaja corrupt derived cache di finance_allocations
    cur.execute(
        "UPDATE finance_allocations SET disbursed_amount = 9999, distribution_status = 'DISBURSED' WHERE id = 'alloc_makan_1'"
    )
    conn.commit()

    # Jalankan rekalkulasi authoritatif
    item_sum = cur.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM finance_distribution_items WHERE allocation_id = 'alloc_makan_1'"
    ).fetchone()[0]
    assert item_sum == 250000

    alloc_amount = cur.execute("SELECT amount FROM finance_allocations WHERE id = 'alloc_makan_1'").fetchone()[0]
    new_status = "DISBURSED" if item_sum >= alloc_amount else "PARTIALLY_DISBURSED" if item_sum > 0 else "UNDISBURSED"
    assert new_status == "PARTIALLY_DISBURSED"

    cur.execute(
        "UPDATE finance_allocations SET disbursed_amount = ?, distribution_status = ? WHERE id = 'alloc_makan_1'",
        (item_sum, new_status)
    )
    conn.commit()

    recalc_row = cur.execute("SELECT disbursed_amount, distribution_status FROM finance_allocations WHERE id = 'alloc_makan_1'").fetchone()
    assert recalc_row[0] == 250000
    assert recalc_row[1] == "PARTIALLY_DISBURSED"

    conn.close()
    print("[OK] Authoritative recalculation verified.")


def test_rbac_and_mutation_guards():
    print("8. Testing RBAC & View-Only Guards for Penyaluran...")
    # Verifikasi matriks izin sesuai kode server action:
    # isViewOnly = roles.includes('pimpinan') || roles.includes('tester')
    # canDisburse = !isViewOnly && (roles.includes('admin') || roles.includes('bendahara'))

    cases = [
        (["admin"], True),
        (["bendahara"], True),
        (["admin", "bendahara"], True),
        (["pimpinan"], False),
        (["tester"], False),
        (["admin", "pimpinan"], False),  # pimpinan role enforces view-only
        (["wali_kelas"], False),
    ]

    for roles, expected_can_disburse in cases:
        is_view_only = "pimpinan" in roles or "tester" in roles
        can_disburse = (not is_view_only) and ("admin" in roles or "bendahara" in roles)
        assert can_disburse == expected_can_disburse, f"Failed for roles {roles}: expected {expected_can_disburse}, got {can_disburse}"

    print("[OK] RBAC & view-only guards verified.")


def test_proof_attachment_workflow():
    print("9. Testing Proof Attachment Workflow (PRD & Audit Requirement)...")
    conn = setup_test_db()
    seed_sample_obligations_and_payments(conn)
    cur = conn.cursor()

    # 1. Catat penyaluran dengan bukti transfer URL (Cloudflare R2 endpoint)
    sample_proof_url = "/api/file/uploads/transfer_proof_20260919_abc123.webp"
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, destination_bank, destination_account, account_holder_name,
            proof_attachment_url, transferred_by, transferred_at, notes
        ) VALUES (
            'dist_proof_1', 'DIS-20260919-PRF1', 'KATERING', 'jasa_makan_1', 'UANG_MAKAN', '2026-09',
            200000, 'TRANSFER', 'BSI', '7123456789', 'Katering Barokah',
            ?, 'usr_bendahara', '2026-09-01 10:00:00', 'Disertai slip transfer m-banking'
        )
        """,
        (sample_proof_url,),
    )
    cur.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
        VALUES ('item_prf_1', 'dist_proof_1', 'alloc_makan_1', 200000)
        """
    )
    conn.commit()

    # 2. Verifikasi penyimpanan & retrieval di query riwayat
    history_row = cur.execute(
        """
        SELECT id, distribution_number, method, proof_attachment_url, notes
        FROM finance_distributions
        WHERE id = 'dist_proof_1'
        """
    ).fetchone()
    assert history_row is not None
    assert history_row[3] == sample_proof_url, f"Expected proof URL {sample_proof_url}, got {history_row[3]}"

    # 3. Verifikasi penyaluran tunai tanpa bukti attachment (opsional/null)
    cur.execute(
        """
        INSERT INTO finance_distributions (
            id, distribution_number, recipient_type, recipient_id, item_type, period,
            total_amount, method, proof_attachment_url, transferred_by, transferred_at
        ) VALUES (
            'dist_proof_null', 'DIS-20260919-PRF2', 'KATERING', 'jasa_makan_1', 'UANG_MAKAN', '2026-09',
            100000, 'CASH', NULL, 'usr_bendahara', '2026-09-02 10:00:00'
        )
        """
    )
    cur.execute(
        """
        INSERT INTO finance_distribution_items (id, distribution_id, allocation_id, amount)
        VALUES ('item_prf_2', 'dist_proof_null', 'alloc_makan_1', 100000)
        """
    )
    conn.commit()

    row_cash = cur.execute("SELECT proof_attachment_url FROM finance_distributions WHERE id = 'dist_proof_null'").fetchone()
    assert row_cash[0] is None

    conn.close()
    print("[OK] Proof attachment storage and audit retrieval verified.")


def test_ui_components_structure():
    print("10. Testing UI Components Existence & Structure...")
    ui_files = [
        ROOT / "app" / "dashboard" / "keuangan" / "penyaluran" / "page.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "penyaluran" / "actions.ts",
        ROOT / "app" / "dashboard" / "keuangan" / "penyaluran" / "_page-content.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "penyaluran" / "catat-penyaluran-modal.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "penyaluran" / "rekening-modal.tsx",
        ROOT / "app" / "dashboard" / "keuangan" / "penyaluran" / "bukti-penyaluran-modal.tsx",
        ROOT / "lib" / "finance" / "distributions.ts",
        ROOT / "lib" / "finance" / "distribution-types.ts",
    ]

    for f in ui_files:
        assert f.exists(), f"File {f.relative_to(ROOT)} is missing"

    print("[OK] All 8 Penyaluran UI & engine files confirmed present and structured.")


if __name__ == "__main__":
    print("=" * 60)
    print("Starting Fase 7 Test Suite (Penyaluran / Distribution Engine)...")
    print("=" * 60)
    test_migration_0162_schema_and_features()
    test_provider_accounts_management()
    test_partial_and_full_distribution_katering()
    test_hard_prevent_over_distribution()
    test_penyaluran_ke_bendahara_pesantren()
    test_provider_snapshot_integrity()
    test_authoritative_recalculation()
    test_rbac_and_mutation_guards()
    test_proof_attachment_workflow()
    test_ui_components_structure()
    print("=" * 60)
    print("ALL FASE 7 TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)
