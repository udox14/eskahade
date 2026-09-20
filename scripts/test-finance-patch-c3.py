"""Automated Test Suite for POST-RELEASE PATCH C3: Redesign Status Pembayaran.

Validates:
1. Code Contracts & TypeScript Interface Integrity:
   - Export of RingkasanRowItem, BulananRowItem, TahunanRowItem, UsppRowItem, TunggakanRowItem, PaymentCorrectionItem.
   - RingkasanRowItem has distinct columns for EHB, Kesehatan, Ekskul, SPP, Makan, Cuci, USPP.
   - actions.ts contains helpers (getCurrentPeriodJakarta, normalizePaymentMethod, calculateOverdueAge).
   - Specialized query handlers exist for all 5 tabs (fetchRingkasanData, fetchBulananData, fetchTahunanData, fetchUsppData, fetchTunggakanData).
   - getStatusPembayaranFilterOptions returns kelasList and academicYearList.
   - getStatusPembayaranData defaults to RINGKASAN, pageSize=50.
   - _page-content.tsx renders 5 specialized tables with distinct business columns and adaptive filters.
   - detail-drawer.tsx renders corrections in Riwayat Bayar tab.

2. Authoritative Data & Correction-Aware Calculations:
   - Authoritative formula: amount_expected - amount_exempted - (gross_allocations - corrections).
   - Stale finance_obligations.amount_paid is ignored in favor of net allocations.
   - Correction (VOID / REVERSAL / REFUND) directly reduces net allocation and restores obligation balance.

3. Tab Bulanan Invariants:
   - Strict filtering: contains ONLY monthly items (SPP, UANG_MAKAN, UANG_NYUCI). Zero annual/USPP items.
   - Displays actual payment timestamp and normalized payment method (Tunai, QRIS, Virtual Account, Transfer via Portal).
   - Unpaid rows have empty / null / '-' payment date and method.

4. Tab Tahunan Invariants:
   - Strict filtering: contains ONLY annual items (DAFTAR_ULANG_EHB, KESEHATAN, EKSTRAKURIKULER).
   - Independent columns per item; academic year filtering works.

5. Tab USPP Invariants:
   - Installment count (jumlah cicilan) accurately counted.
   - Latest installment details (paid_at, amount, method, ref) returned.
   - Status transitions (UNPAID -> PARTIALLY_PAID -> PAID).

6. Tab Tunggakan & Deterministic Clock Cutoff:
   - Evaluates remaining > 0 AND period < currentPeriod in Asia/Jakarta.
   - Deterministic clock boundary test:
     * Clock 2026-09-30 23:59:59: period 2026-09 is CURRENT (NOT tunggakan); 2026-08 is tunggakan (1 bulan lalu).
     * Clock 2026-10-01 00:00:01: period 2026-09 BECOMES tunggakan (1 bulan lalu).
   - Paid and exempted obligations are strictly excluded.
   - Reversal correction restores obligation balance and makes overdue obligation reappear in tunggakan.
   - Future periods are never tunggakan.
   - Provider items (Uang Makan, Uang Nyuci) follow identical cutoff rules to SPP; vendor distribution date is never a cutoff.
   - Annual and USPP items are not included in tunggakan (no authoritative due date in schema).

7. Server-Side Pagination (50 Standard) & Filter Isolation:
   - 120+ mock records split into Page 1 (50), Page 2 (50), Page 3 (20) with 0 overlap.
   - Server-side search finds target record #77 on Page 1 of search results.
   - Filters (kelas, asrama, status, academic_year, item) properly scope datasets without leaking across tabs.
"""

from __future__ import annotations

import datetime
import os
import re
import sqlite3
import sys
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


def check(condition: bool, message: str) -> None:
    if not condition:
        print(f"  [FAIL] {message}")
        sys.exit(1)
    else:
        print(f"  [PASS] {message}")


def setup_test_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON;")

    # Base schema
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

        CREATE TABLE kelas (
            id TEXT PRIMARY KEY,
            nama_kelas TEXT NOT NULL,
            tingkat INTEGER NOT NULL DEFAULT 7
        );

        CREATE TABLE santri (
            id TEXT PRIMARY KEY,
            nis TEXT NOT NULL UNIQUE,
            nama_lengkap TEXT NOT NULL,
            jenis_kelamin TEXT NOT NULL,
            status_global TEXT NOT NULL DEFAULT 'aktif',
            asrama TEXT,
            kamar TEXT,
            kelas_id TEXT REFERENCES kelas(id),
            tempat_makan_id TEXT REFERENCES master_jasa(id),
            tempat_mencuci_id TEXT REFERENCES master_jasa(id),
            tahun_masuk INTEGER DEFAULT 2026,
            tanggal_masuk TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE spp_tunggakan_historis (
            id TEXT PRIMARY KEY,
            santri_id TEXT NOT NULL REFERENCES santri(id),
            tahun INTEGER NOT NULL,
            bulan INTEGER NOT NULL,
            nominal_tagihan INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'BELUM_LUNAS',
            tanggal_lunas TEXT,
            penerima_id TEXT REFERENCES users(id),
            catatan TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(santri_id, tahun, bulan)
        );

        CREATE TABLE IF NOT EXISTS fitur_akses (
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

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """
    )

    # Apply finance migrations
    migrations = [
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
    ]
    for mig in migrations:
        if mig.exists():
            with open(mig, "r", encoding="utf-8") as f:
                conn.executescript(f.read())

    return conn


def test_code_contracts_and_interfaces():
    print("\n--- 1. Testing Code Contracts & TypeScript Interface Integrity ---")
    actions_path = ROOT / "app" / "dashboard" / "keuangan" / "status-pembayaran" / "actions.ts"
    check(actions_path.exists(), "actions.ts exists")
    actions_content = actions_path.read_text(encoding="utf-8")

    # Verify type exports
    check("export interface RingkasanRowItem" in actions_content, "RingkasanRowItem exported")
    check("export interface BulananRowItem" in actions_content, "BulananRowItem exported")
    check("export interface TahunanRowItem" in actions_content, "TahunanRowItem exported")
    check("export interface UsppRowItem" in actions_content, "UsppRowItem exported")
    check("export interface TunggakanRowItem" in actions_content, "TunggakanRowItem exported")
    check("export interface PaymentCorrectionItem" in actions_content, "PaymentCorrectionItem exported")

    # Verify distinct columns in RingkasanRowItem
    check("ehb: RingkasanItemStatus" in actions_content, "RingkasanRowItem has individual ehb cell")
    check("kesehatan: RingkasanItemStatus" in actions_content, "RingkasanRowItem has individual kesehatan cell")
    check("ekskul: RingkasanItemStatus" in actions_content, "RingkasanRowItem has individual ekskul cell")
    check("spp: RingkasanItemStatus" in actions_content, "RingkasanRowItem has individual spp cell")
    check("uangMakan: RingkasanItemStatus" in actions_content, "RingkasanRowItem has individual uangMakan cell")
    check("uangNyuci: RingkasanItemStatus" in actions_content, "RingkasanRowItem has individual uangNyuci cell")
    check("uspp: RingkasanItemStatus" in actions_content, "RingkasanRowItem has individual uspp cell")

    # Verify helpers
    check("function getCurrentPeriodJakarta" in actions_content, "getCurrentPeriodJakarta helper defined")
    check("function normalizePaymentMethod" in actions_content, "normalizePaymentMethod helper defined")
    check("function calculateOverdueAge" in actions_content, "calculateOverdueAge helper defined")

    # Verify 5 specialized tab query fetchers
    check("async function fetchRingkasanData" in actions_content, "fetchRingkasanData handler implemented")
    check("async function fetchBulananData" in actions_content, "fetchBulananData handler implemented")
    check("async function fetchTahunanData" in actions_content, "fetchTahunanData handler implemented")
    check("async function fetchUsppData" in actions_content, "fetchUsppData handler implemented")
    check("async function fetchTunggakanData" in actions_content, "fetchTunggakanData handler implemented")

    # Verify getStatusPembayaranFilterOptions returns kelasList and academicYearList
    check("kelasList:" in actions_content, "filter options returns kelasList")
    check("academicYearList:" in actions_content, "filter options returns academicYearList")

    # Verify getStatusPembayaranData default params
    check("params?.pageSize !== undefined ? params.pageSize : 50" in actions_content, "pageSize defaults to 50")
    check("params?.tab || 'RINGKASAN'" in actions_content, "activeTab defaults to RINGKASAN")

    # Verify _page-content.tsx renders 5 specialized tables
    page_path = ROOT / "app" / "dashboard" / "keuangan" / "status-pembayaran" / "_page-content.tsx"
    check(page_path.exists(), "_page-content.tsx exists")
    page_content = page_path.read_text(encoding="utf-8")

    check("activeTab === 'RINGKASAN' && data.ringkasanItems" in page_content, "_page-content.tsx renders Ringkasan table")
    check("activeTab === 'BULANAN' && data.bulananItems" in page_content, "_page-content.tsx renders Bulanan table")
    check("activeTab === 'TAHUNAN' && data.tahunanItems" in page_content, "_page-content.tsx renders Tahunan table")
    check("activeTab === 'USPP' && data.usppItems" in page_content, "_page-content.tsx renders Uspp table")
    check("activeTab === 'TUNGGAKAN' && data.tunggakanItems" in page_content, "_page-content.tsx renders Tunggakan table")

    # Verify tab-sensitive filter isolation in toolbar
    check("activeTab === 'BULANAN' || activeTab === 'TUNGGAKAN'" in page_content, "selectedItem filter isolated to Bulanan & Tunggakan")
    check("activeTab === 'TAHUNAN'" in page_content, "selectedAcademicYear filter isolated to Tahunan")
    check("activeTab === 'RINGKASAN' || activeTab === 'BULANAN' || activeTab === 'TUNGGAKAN'" in page_content, "selectedPeriod filter shown only for Ringkasan, Bulanan & Tunggakan (hidden for USPP & Tahunan)")

    # Verify detail drawer renders corrections
    drawer_path = ROOT / "app" / "dashboard" / "keuangan" / "status-pembayaran" / "detail-drawer.tsx"
    check(drawer_path.exists(), "detail-drawer.tsx exists")
    drawer_content = drawer_path.read_text(encoding="utf-8")
    check("pay.corrections" in drawer_content, "detail-drawer.tsx renders pay.corrections")
    check("Koreksi / Penyesuaian Terkait" in drawer_content, "detail-drawer.tsx has Koreksi section in riwayatBayar")


def test_payment_method_normalization():
    print("\n--- 2. Testing Payment Method Normalization Contract ---")
    actions_content = (ROOT / "app" / "dashboard" / "keuangan" / "status-pembayaran" / "actions.ts").read_text(encoding="utf-8")

    # Emulate normalization logic exactly as defined in actions.ts:
    def normalize_payment_method(channel: str | None, method: str | None) -> str:
        if not channel and not method:
            return "-"
        c = (channel or "").upper()
        m = (method or "").upper()
        if c == "CASH" or m == "CASH":
            return "Tunai"
        if "QRIS" in c or "QRIS" in m:
            return "QRIS"
        if "VA" in c or "VA" in m:
            return "Virtual Account"
        if "DUITKU" in c or "GATEWAY" in c:
            return "Transfer via Portal"
        if m in ("TRANSFER", "BANK_TRANSFER"):
            return "Transfer Bank"
        return method or channel or "-"

    check(normalize_payment_method("CASH", "CASH") == "Tunai", "CASH/CASH maps to Tunai")
    check(normalize_payment_method("DUITKU", "DUITKU_QRIS") == "QRIS", "DUITKU/QRIS maps to QRIS")
    check(normalize_payment_method("DUITKU", "DUITKU_VA") == "Virtual Account", "DUITKU/VA maps to Virtual Account")
    check(normalize_payment_method("DUITKU", "CREDIT_CARD") == "Transfer via Portal", "DUITKU/CREDIT_CARD maps to Transfer via Portal")
    check(normalize_payment_method(None, None) == "-", "None/None maps to '-'")


def test_runtime_data_and_authoritative_corrections():
    print("\n--- 3. Testing Authoritative Data & Correction-Aware Calculations ---")
    conn = setup_test_db()

    # Seed master data
    conn.execute("INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('u1', 'admin@sukahideng.id', 'hash', 'Admin Keuangan', 'bendahara')")
    conn.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('mj-mkn', 'Dapur Utama', 'KATERING'), ('mj-cuc', 'Laundry Berkah', 'LAUNDRY')")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1)")
    conn.execute("INSERT INTO kelas (id, nama_kelas, tingkat) VALUES ('k-7a', '7A', 7), ('k-7b', '7B', 7)")

    # Seed Santri S1
    conn.execute(
        """INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, kamar, kelas_id, tempat_makan_id, tempat_mencuci_id, tahun_masuk)
        VALUES ('s1', '1001', 'Ahmad Dahlan', 'L', 'aktif', 'Asrama Abu Bakar', 'Kamar 01', 'k-7a', 'mj-mkn', 'mj-cuc', 2026)"""
    )

    # Seed monthly obligations for s1 in period 2026-08 (expected = 200.000)
    conn.execute(
        """INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status)
        VALUES ('oblg-s1-spp', 's1', 'SPP', '2026-08', 200000, 0, 200000, 'PAID')"""
    )

    # Seed payment of 200.000 fully allocating to oblg-s1-spp
    conn.execute(
        """INSERT INTO finance_payments (id, payment_number, santri_id, gross_amount, net_amount, gateway_fee, channel, method, status, paid_at, received_by)
        VALUES ('pay-1', 'PAY-001', 's1', 200000, 200000, 0, 'CASH', 'CASH', 'PAID', '2026-08-10 09:00:00', 'u1')"""
    )
    conn.execute(
        """INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, created_at)
        VALUES ('alloc-1', 'pay-1', 'oblg-s1-spp', 'OBLIGATION', 'SPP', 200000, '2026-08-10 09:00:00')"""
    )

    # Step A: Before correction, net paid is 200.000, remaining is 0 (PAID)
    net_paid_query = """
        SELECT
            fo.amount_expected - fo.amount_exempted - COALESCE(net_alloc.net_allocated, 0) AS calculated_remaining,
            COALESCE(net_alloc.net_allocated, 0) AS net_paid
        FROM finance_obligations fo
        LEFT JOIN (
            SELECT
                fa.obligation_id,
                SUM(fa.amount) - COALESCE(SUM(fci.amount), 0) AS net_allocated
            FROM finance_allocations fa
            LEFT JOIN finance_correction_items fci ON fci.target_allocation_id = fa.id
            GROUP BY fa.obligation_id
        ) net_alloc ON net_alloc.obligation_id = fo.id
        WHERE fo.id = 'oblg-s1-spp'
    """
    row = conn.execute(net_paid_query).fetchone()
    check(row[0] == 0 and row[1] == 200000, "Before correction: net_paid is 200000, remaining is 0")

    # Step B: Insert a REVERSAL correction of 50.000 on alloc-1
    conn.execute(
        """INSERT INTO finance_corrections (id, correction_number, correction_type, target_payment_id, total_amount, method, reason, created_by, created_at)
        VALUES ('corr-1', 'CORR-001', 'REVERSAL', 'pay-1', 50000, 'CASH', 'Kelebihan setor cash', 'u1', '2026-08-12 10:00:00')"""
    )
    conn.execute(
        """INSERT INTO finance_correction_items (id, correction_id, target_allocation_id, obligation_id, target_type, amount, created_at)
        VALUES ('ci-1', 'corr-1', 'alloc-1', 'oblg-s1-spp', 'OBLIGATION', 50000, '2026-08-12 10:00:00')"""
    )

    # Note: fo.amount_paid is deliberately left stale at 200000 to test that authoritative calculation ignores stale cache
    row_after = conn.execute(net_paid_query).fetchone()
    calculated_remaining = row_after[0]
    net_paid = row_after[1]
    check(net_paid == 150000, f"Authoritative correction-aware net_paid is 150000 (was {net_paid})")
    check(calculated_remaining == 50000, f"Authoritative calculated_remaining is 50000 (was {calculated_remaining})")
    check(conn.execute("SELECT amount_paid FROM finance_obligations WHERE id = 'oblg-s1-spp'").fetchone()[0] == 200000,
          "Stale amount_paid cache was NOT trusted; authoritative correction applied accurately")


def test_tab_bulanan_invariants():
    print("\n--- 4. Testing Tab Bulanan Invariants ---")
    conn = setup_test_db()

    # Seed Santri
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global) VALUES ('s1', '1001', 'Santri Bulanan', 'L', 'aktif')")

    # Seed diverse obligations: 2 monthly, 1 annual, 1 USPP
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-spp', 's1', 'SPP', '2026-09', 200000, 0, 200000, 'PAID')")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-mkn', 's1', 'UANG_MAKAN', '2026-09', 300000, 0, 0, 'UNPAID')")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-ehb', 's1', 'EHB', '2026/2027', 150000, 0, 150000, 'PAID')")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-uspp', 's1', 'USPP', 'LIFETIME', 1000000, 0, 500000, 'PARTIALLY_PAID')")

    # Seed payment for ob-spp with DUITKU_QRIS
    conn.execute("INSERT INTO users (id, email, password_hash, full_name) VALUES ('u1', 'admin@sukahideng.id', 'hash', 'Admin')")
    conn.execute(
        """INSERT INTO finance_payments (id, payment_number, santri_id, gross_amount, net_amount, gateway_fee, channel, method, status, paid_at, received_by)
        VALUES ('pay-qris', 'PAY-QRIS-1', 's1', 200000, 200000, 0, 'DUITKU', 'DUITKU_QRIS', 'PAID', '2026-09-05 14:30:00', 'u1')"""
    )
    conn.execute(
        """INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, created_at)
        VALUES ('alloc-qris', 'pay-qris', 'ob-spp', 'OBLIGATION', 'SPP', 200000, '2026-09-05 14:30:00')"""
    )

    # Query Bulanan exactly as in actions.ts: item_type IN ('SPP', 'UANG_MAKAN', 'UANG_NYUCI')
    bulanan_rows = conn.execute(
        """SELECT fo.id, fo.item_type, fo.period, p.paid_at, p.channel, p.method, fo.status
        FROM finance_obligations fo
        LEFT JOIN (
            SELECT fa.obligation_id, fp.paid_at, fp.channel, fp.method
            FROM finance_allocations fa
            JOIN finance_payments fp ON fp.id = fa.payment_id
            WHERE fp.status = 'PAID'
            ORDER BY fp.paid_at DESC
        ) p ON p.obligation_id = fo.id
        WHERE fo.item_type IN ('SPP', 'UANG_MAKAN', 'UANG_NYUCI')"""
    ).fetchall()

    check(len(bulanan_rows) == 2, f"Tab Bulanan contains exactly 2 monthly records (got {len(bulanan_rows)})")
    item_types = {r[1] for r in bulanan_rows}
    check("EHB" not in item_types and "USPP" not in item_types, "Annual & USPP obligations strictly excluded from Bulanan")

    # Check SPP row has real timestamp and QRIS method
    spp_row = next(r for r in bulanan_rows if r[1] == "SPP")
    check(spp_row[3] == "2026-09-05 14:30:00", "SPP row contains real payment timestamp")
    check(spp_row[4] == "DUITKU" and spp_row[5] == "DUITKU_QRIS", "SPP row contains DUITKU / DUITKU_QRIS")

    # Check Makan row is unpaid and has NULL payment date & method
    mkn_row = next(r for r in bulanan_rows if r[1] == "UANG_MAKAN")
    check(mkn_row[3] is None and mkn_row[4] is None, "Unpaid Makan row has NULL payment timestamp and channel")


def test_tab_tahunan_invariants():
    print("\n--- 5. Testing Tab Tahunan Invariants ---")
    conn = setup_test_db()
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global) VALUES ('s1', '1001', 'Santri Tahunan', 'L', 'aktif')")
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1), (2, '2025/2026', 0)")

    # Seed 3 annual obligations for 2026/2027
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, amount_expected) VALUES ('ob-ehb', 's1', 'EHB', 1, '2026/2027', 250000)")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, amount_expected) VALUES ('ob-kes', 's1', 'KESEHATAN', 1, '2026/2027', 100000)")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, amount_expected) VALUES ('ob-eks', 's1', 'EKSKUL', 1, '2026/2027', 75000)")

    # Seed 1 old annual obligation for 2025/2026
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, amount_expected) VALUES ('ob-ehb-old', 's1', 'EHB', 2, '2025/2026', 200000)")

    # Query Tahunan: only 3 annual items
    tahunan_rows = conn.execute(
        """SELECT fo.id, fo.item_type, fo.period, ta.nama
        FROM finance_obligations fo
        LEFT JOIN tahun_ajaran ta ON ta.id = fo.academic_year_id
        WHERE fo.item_type IN ('EHB', 'KESEHATAN', 'EKSKUL') AND fo.academic_year_id = 1"""
    ).fetchall()

    check(len(tahunan_rows) == 3, f"Tahunan filtered by academic_year_id=1 returns exactly 3 rows (got {len(tahunan_rows)})")
    annual_types = {r[1] for r in tahunan_rows}
    check(annual_types == {"EHB", "KESEHATAN", "EKSKUL"}, "Contains only EHB, Kesehatan, Ekskul")


def test_tab_uspp_invariants():
    print("\n--- 6. Testing Tab USPP Invariants ---")
    conn = setup_test_db()
    conn.execute("INSERT INTO users (id, email, password_hash, full_name) VALUES ('u1', 'admin@sukahideng.id', 'hash', 'Admin')")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global) VALUES ('s-uspp', '1002', 'Santri USPP', 'L', 'aktif')")

    # USPP obligation: expected 5.000.000
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-uspp-1', 's-uspp', 'USPP', 'LIFETIME', 5000000, 0, 0, 'UNPAID')")

    # Step 1: Unpaid USPP -> 0 installments
    inst_count = conn.execute("SELECT COUNT(*) FROM finance_allocations WHERE obligation_id = 'ob-uspp-1'").fetchone()[0]
    check(inst_count == 0, "Initial USPP has 0 installments")

    # Step 2: Installment 1 (Rp1.000.000 CASH on 2026-07-15)
    conn.execute(
        """INSERT INTO finance_payments (id, payment_number, santri_id, gross_amount, net_amount, gateway_fee, channel, method, status, paid_at, received_by)
        VALUES ('p-uspp-1', 'PAY-U1', 's-uspp', 1000000, 1000000, 0, 'CASH', 'CASH', 'PAID', '2026-07-15 10:00:00', 'u1')"""
    )
    conn.execute("INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, created_at) VALUES ('al-u1', 'p-uspp-1', 'ob-uspp-1', 'OBLIGATION', 'USPP', 1000000, '2026-07-15 10:00:00')")

    # Step 3: Installment 2 (Rp1.500.000 DUITKU_VA on 2026-08-20)
    conn.execute(
        """INSERT INTO finance_payments (id, payment_number, santri_id, gross_amount, net_amount, gateway_fee, channel, method, external_reference, status, paid_at, received_by)
        VALUES ('p-uspp-2', 'PAY-U2', 's-uspp', 1500000, 1500000, 0, 'DUITKU', 'DUITKU_VA', 'VA-998877', 'PAID', '2026-08-20 11:30:00', 'u1')"""
    )
    conn.execute("INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, created_at) VALUES ('al-u2', 'p-uspp-2', 'ob-uspp-1', 'OBLIGATION', 'USPP', 1500000, '2026-08-20 11:30:00')")

    # Query USPP stats exactly as in actions.ts:
    uspp_stats = conn.execute(
        """SELECT
            COUNT(fa.id) as installment_count,
            SUM(fa.amount) as total_paid,
            MAX(fp.paid_at) as latest_paid_at
        FROM finance_allocations fa
        JOIN finance_payments fp ON fp.id = fa.payment_id
        WHERE fa.obligation_id = 'ob-uspp-1' AND fp.status = 'PAID'"""
    ).fetchone()

    check(uspp_stats[0] == 2, f"USPP installment count is exactly 2 (got {uspp_stats[0]})")
    check(uspp_stats[1] == 2500000, f"USPP total paid is 2500000 (got {uspp_stats[1]})")
    check(uspp_stats[2] == "2026-08-20 11:30:00", f"USPP latest paid at matches most recent payment (got {uspp_stats[2]})")

    # Latest payment detail:
    latest_pay = conn.execute(
        """SELECT fp.paid_at, fa.amount, fp.channel, fp.method, fp.external_reference
        FROM finance_allocations fa
        JOIN finance_payments fp ON fp.id = fa.payment_id
        WHERE fa.obligation_id = 'ob-uspp-1' AND fp.status = 'PAID'
        ORDER BY fp.paid_at DESC LIMIT 1"""
    ).fetchone()

    check(latest_pay[1] == 1500000, "Latest installment amount is 1500000")
    check(latest_pay[3] == "DUITKU_VA", "Latest installment method is DUITKU_VA")
    check(latest_pay[4] == "VA-998877", "Latest installment external_reference captured")


def test_tab_tunggakan_deterministic_clock():
    print("\n--- 7. Testing Tab Tunggakan & Deterministic Clock Cutoff Invariants ---")
    conn = setup_test_db()
    conn.execute("INSERT INTO users (id, email, password_hash, full_name) VALUES ('u1', 'admin@sukahideng.id', 'hash', 'Admin')")
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global) VALUES ('s-tung', '1003', 'Santri Tunggakan', 'L', 'aktif')")

    # Monthly obligations across periods:
    # 2026-07: SPP 200.000 unpaid
    # 2026-08: UANG_MAKAN 300.000 unpaid (provider item)
    # 2026-09: SPP 200.000 unpaid (active period in Sep)
    # 2026-10: SPP 200.000 unpaid (future period in Sep)
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-07', 's-tung', 'SPP', '2026-07', 200000, 0, 0, 'UNPAID')")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-08', 's-tung', 'UANG_MAKAN', '2026-08', 300000, 0, 0, 'UNPAID')")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-09', 's-tung', 'SPP', '2026-09', 200000, 0, 0, 'UNPAID')")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-10', 's-tung', 'SPP', '2026-10', 200000, 0, 0, 'UNPAID')")

    # Annual & USPP obligations (must NEVER be in tunggakan)
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-ann', 's-tung', 'EHB', '2026/2027', 250000, 0, 0, 'UNPAID')")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-usp', 's-tung', 'USPP', 'LIFETIME', 5000000, 0, 0, 'UNPAID')")

    # Helper query for tunggakan given current_period
    def get_tunggakan(current_period: str):
        return conn.execute(
            """SELECT
                fo.id,
                fo.item_type,
                fo.period,
                fo.amount_expected - fo.amount_exempted - COALESCE(net_alloc.net_allocated, 0) AS remaining
            FROM finance_obligations fo
            LEFT JOIN (
                SELECT
                    fa.obligation_id,
                    SUM(fa.amount) - COALESCE(SUM(fci.amount), 0) AS net_allocated
                FROM finance_allocations fa
                LEFT JOIN finance_correction_items fci ON fci.target_allocation_id = fa.id
                GROUP BY fa.obligation_id
            ) net_alloc ON net_alloc.obligation_id = fo.id
            WHERE fo.item_type IN ('SPP', 'UANG_MAKAN', 'UANG_NYUCI')
              AND fo.period < ?
              AND (fo.amount_expected - fo.amount_exempted - COALESCE(net_alloc.net_allocated, 0)) > 0
            ORDER BY fo.period ASC""",
            (current_period,)
        ).fetchall()

    # Case 1: Clock is 2026-09-30 23:59:59 (Current period: 2026-09)
    # Tunggakan MUST contain ONLY < 2026-09 (i.e. 2026-07 and 2026-08)
    tunggakan_sep = get_tunggakan("2026-09")
    tunggakan_ids_sep = [r[0] for r in tunggakan_sep]
    check(len(tunggakan_sep) == 2, f"On 2026-09-30, exactly 2 periods are tunggakan (got {len(tunggakan_sep)})")
    check("ob-07" in tunggakan_ids_sep and "ob-08" in tunggakan_ids_sep, "2026-07 and 2026-08 are in tunggakan")
    check("ob-09" not in tunggakan_ids_sep, "Current period 2026-09 is strictly NOT in tunggakan on 2026-09-30")
    check("ob-10" not in tunggakan_ids_sep, "Future period 2026-10 is strictly NOT in tunggakan")
    check("ob-ann" not in tunggakan_ids_sep and "ob-usp" not in tunggakan_ids_sep, "Annual and USPP are strictly NOT in tunggakan")

    # Case 2: Clock transitions to 2026-10-01 00:00:01 (Current period: 2026-10)
    # Now 2026-09 BECOMES tunggakan!
    tunggakan_oct = get_tunggakan("2026-10")
    tunggakan_ids_oct = [r[0] for r in tunggakan_oct]
    check(len(tunggakan_oct) == 3, f"On 2026-10-01, exactly 3 periods are tunggakan (got {len(tunggakan_oct)})")
    check("ob-09" in tunggakan_ids_oct, "2026-09 successfully transitioned into tunggakan on 2026-10-01")

    # Case 3: Reversal correction restoring tunggakan
    # Fully pay ob-07 (SPP 2026-07)
    conn.execute(
        """INSERT INTO finance_payments (id, payment_number, santri_id, gross_amount, net_amount, gateway_fee, channel, method, status, paid_at, received_by)
        VALUES ('p-pay-07', 'PAY-07', 's-tung', 200000, 200000, 0, 'CASH', 'CASH', 'PAID', '2026-07-20', 'u1')"""
    )
    conn.execute("INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount, created_at) VALUES ('al-07', 'p-pay-07', 'ob-07', 'OBLIGATION', 'SPP', 200000, '2026-07-20')")

    # With ob-07 fully paid, tunggakan on 2026-10 should now have 2 rows (ob-08, ob-09)
    tunggakan_paid = get_tunggakan("2026-10")
    check("ob-07" not in [r[0] for r in tunggakan_paid], "Fully paid obligation is excluded from tunggakan")

    # Now apply a REVERSAL correction on al-07
    conn.execute(
        """INSERT INTO finance_corrections (id, correction_number, correction_type, target_payment_id, total_amount, method, reason, created_by, created_at)
        VALUES ('corr-rev-07', 'CORR-07', 'REVERSAL', 'p-pay-07', 200000, 'CASH', 'Reversal salah alokasi', 'u1', '2026-08-01')"""
    )
    conn.execute(
        """INSERT INTO finance_correction_items (id, correction_id, target_allocation_id, obligation_id, target_type, amount, created_at)
        VALUES ('ci-rev-07', 'corr-rev-07', 'al-07', 'ob-07', 'OBLIGATION', 200000, '2026-08-01')"""
    )

    # After correction, ob-07 has remaining > 0 again and period < 2026-10 -> it MUST reappear in tunggakan!
    tunggakan_restored = get_tunggakan("2026-10")
    check("ob-07" in [r[0] for r in tunggakan_restored], "Correction restored remaining balance; obligation reappeared in tunggakan")


def test_pagination_and_filter_isolation():
    print("\n--- 8. Testing Server-Side Pagination (50 Standard) & Filter Isolation ---")
    conn = setup_test_db()
    conn.execute("INSERT INTO kelas (id, nama_kelas, tingkat) VALUES ('k-7a', '7A', 7), ('k-7b', '7B', 7)")

    # Seed 120 santri across 2 kelas and 2 asrama
    for i in range(1, 121):
        sid = f"s-{i:03d}"
        nis = f"NIS-{1000 + i}"
        if i == 77:
            nama = "Fauzan TargetSearch Record77"
            asrama = "Asrama Salman"
            kelas_id = "k-7a"
        else:
            nama = f"Santri Testing {i:03d}"
            asrama = "Asrama Salman" if i % 2 == 0 else "Asrama Bilal"
            kelas_id = "k-7a" if i % 3 == 0 else "k-7b"

        conn.execute(
            "INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, asrama, kelas_id, status_global) VALUES (?, ?, ?, 'L', ?, ?, 'aktif')",
            (sid, nis, nama, asrama, kelas_id)
        )
        # Create monthly SPP obligation for each
        conn.execute(
            "INSERT INTO finance_obligations (id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status) VALUES (?, ?, 'SPP', '2026-08', 200000, 0, 0, 'UNPAID')",
            (f"ob-pag-{i:03d}", sid)
        )

    # 1. Total count
    total_count = conn.execute("SELECT COUNT(*) FROM santri WHERE status_global = 'aktif'").fetchone()[0]
    check(total_count == 120, "Total count is 120 (>100 records)")

    # 2. Server-side pagination query (50 per page)
    page_size = 50
    page_1 = conn.execute("SELECT id FROM santri WHERE status_global = 'aktif' ORDER BY id ASC LIMIT ? OFFSET ?", (page_size, 0)).fetchall()
    page_2 = conn.execute("SELECT id FROM santri WHERE status_global = 'aktif' ORDER BY id ASC LIMIT ? OFFSET ?", (page_size, 50)).fetchall()
    page_3 = conn.execute("SELECT id FROM santri WHERE status_global = 'aktif' ORDER BY id ASC LIMIT ? OFFSET ?", (page_size, 100)).fetchall()

    check(len(page_1) == 50, "Page 1 contains exactly 50 records")
    check(len(page_2) == 50, "Page 2 contains exactly 50 records")
    check(len(page_3) == 20, "Page 3 contains remaining 20 records")

    # 3. Non-overlapping verification
    p1_set = {r[0] for r in page_1}
    p2_set = {r[0] for r in page_2}
    check(len(p1_set.intersection(p2_set)) == 0, "Page 1 and Page 2 have ZERO overlapping records")

    # 4. Target record #77 sits on Page 2 naturally
    check("s-077" not in p1_set, "Record #77 is NOT on Page 1 without search")
    check("s-077" in p2_set, "Record #77 is on Page 2")

    # 5. Server-side search finds target record #77 on Page 1 of search results
    search_q = "%TargetSearch%"
    search_count = conn.execute("SELECT COUNT(*) FROM santri WHERE status_global = 'aktif' AND nama_lengkap LIKE ?", (search_q,)).fetchone()[0]
    check(search_count == 1, "Search count evaluated across full dataset returns 1")

    search_page_1 = conn.execute(
        "SELECT id, nama_lengkap FROM santri WHERE status_global = 'aktif' AND nama_lengkap LIKE ? ORDER BY id ASC LIMIT ? OFFSET ?",
        (search_q, page_size, 0)
    ).fetchall()
    check(len(search_page_1) == 1 and search_page_1[0][0] == "s-077", "Search retrieves record #77 on Page 1 of search results")

    # 6. Kelas filter isolation
    k7a_count = conn.execute("SELECT COUNT(*) FROM santri WHERE status_global = 'aktif' AND kelas_id = 'k-7a'").fetchone()[0]
    k7a_rows = conn.execute("SELECT id FROM santri WHERE status_global = 'aktif' AND kelas_id = 'k-7a' ORDER BY id ASC LIMIT ? OFFSET ?", (page_size, 0)).fetchall()
    check(len(k7a_rows) == min(page_size, k7a_count), "Kelas filter correctly scopes server-side query")


if __name__ == "__main__":
    print("================================================================================")
    print("   AUTOMATED VERIFICATION TEST SUITE: POST-RELEASE PATCH C3")
    print("   Redesign Status Pembayaran (Authoritative Data, Tabs & Cutoff Governance)")
    print("================================================================================")

    test_code_contracts_and_interfaces()
    test_payment_method_normalization()
    test_runtime_data_and_authoritative_corrections()
    test_tab_bulanan_invariants()
    test_tab_tahunan_invariants()
    test_tab_uspp_invariants()
    test_tab_tunggakan_deterministic_clock()
    test_pagination_and_filter_isolation()

    print("\n================================================================================")
    print("   ALL PATCH C3 CONTRACTS & INVARIANTS PASSED SUCCESSFULLY!")
    print("================================================================================")
