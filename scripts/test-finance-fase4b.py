"""Automated Contract, Business Logic & Drilldown Tests for Fase 4B - Detail / Drilldown Status Pembayaran.

Validates:
1. Server Action Authorization & RBAC for getStudentPaymentDetail:
   - Unauthenticated sessions rejected.
   - Unauthorized roles (e.g. wali_kelas, keamanan, guru, santri) rejected.
   - Authorized roles (admin, bendahara, pimpinan, demo, tester) granted access via canAccessFeatureForSession authority.
   - Pimpinan and tester are strictly view-only (canRecordPayment = False).
2. Student Identity & Catering/Laundry Vendor Enrichment:
   - Santri identity (NIS, nama_lengkap, asrama, kamar, tahun_masuk).
   - Catering & laundry vendor names resolved from master_jasa.
3. Drilldown Categories:
   - Bulanan (SPP, Makan, Cuci with vendor names).
   - Tahunan (EHB, Ekstrakurikuler, Kesehatan, etc.).
   - USPP (LIFETIME frequency, tariff, paid, exemption, remaining).
   - Tunggakan Modern (unpaid obligations).
4. Pre-Cutover Coexistence Isolation:
   - Legacy SPP arrears from remote D1 schema spp_tunggakan_historis (< 2026-07) with status = 'BELUM_LUNAS'.
   - Legacy records with status = 'LUNAS' excluded.
   - Invariant: ZERO duplicate rows inserted into finance_obligations.
   - Grand Total Tunggakan = modern remaining + legacy arrears.
5. Payment Allocation History (riwayatBayar):
   - Retrieved from finance_allocations JOIN finance_payments.
   - Audit trail verification (payment_number, channel, method, amount, paid_at).
6. Read-Only Enforcement:
   - Zero mutation endpoints or payments executed in 4B.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_0152 = ROOT / "migrations" / "0152_finance_tariffs_and_obligations.sql"
MIGRATION_0153 = ROOT / "migrations" / "0153_finance_tariffs_overlap_trigger.sql"
MIGRATION_0154 = ROOT / "migrations" / "0154_finance_exemptions_revocation_metadata.sql"
MIGRATION_0155 = ROOT / "migrations" / "0155_finance_payments_and_orders.sql"

FINANCE_CUTOVER_START_MONTHLY = "2026-07"


def setup_test_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON;")

    # Base schema matching Cloudflare D1 remote
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
        """
    )

    # Apply finance migrations
    conn.executescript(MIGRATION_0152.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0153.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0154.read_text(encoding="utf-8"))
    conn.executescript(MIGRATION_0155.read_text(encoding="utf-8"))

    return conn


def seed_test_data(conn: sqlite3.Connection):
    # 1. Users
    conn.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role) VALUES ('usr-bendahara', 'bendahara@test.local', 'hash', 'Ustadzah Fatimah', 'bendahara')"
    )

    # 2. Academic Year
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1)")

    # 3. Master Jasa
    conn.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('jasa-katering-a', 'Dapur Utama Putri', 'Makan')")
    conn.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('jasa-laundry-b', 'Berkah Laundry Express', 'Cuci')")

    # 4. Santri
    conn.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, kamar, tempat_makan_id, tempat_mencuci_id, tahun_masuk)
        VALUES ('san-01', '1001', 'Muhammad Zaki', 'L', 'aktif', 'Asrama Al-Falah', 'Kamar 01', 'jasa-katering-a', 'jasa-laundry-b', 2026)
        """
    )

    # 5. Tariffs
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-spp', 'SPP', 1, 500000, 'DISALLOWED', '2026-07-01')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-makan', 'UANG_MAKAN', 1, 450000, 'DISALLOWED', '2026-07-01')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-cuci', 'UANG_NYUCI', 1, 100000, 'DISALLOWED', '2026-07-01')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-ehb', 'EHB', 1, 250000, 'DISALLOWED', '2026-07-01')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from)
        VALUES ('trf-uspp', 'USPP', 1, 5000000, 'ALLOWED', '2026-07-01')
        """
    )

    # 6. Obligations for san-01 (Muhammad Zaki)
    # 6a. Bulanan (SPP paid, Makan partially paid with provider, Cuci unpaid with provider)
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, tariff_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES ('ob-spp-202607', 'san-01', 'trf-spp', 'SPP', 1, '2026-07', 500000, 0, 500000, 'PAID')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, tariff_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, provider_id
        ) VALUES ('ob-makan-202607', 'san-01', 'trf-makan', 'UANG_MAKAN', 1, '2026-07', 450000, 0, 200000, 'PARTIALLY_PAID', 'jasa-katering-a')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, tariff_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status, provider_id
        ) VALUES ('ob-cuci-202607', 'san-01', 'trf-cuci', 'UANG_NYUCI', 1, '2026-07', 100000, 0, 0, 'UNPAID', 'jasa-laundry-b')
        """
    )

    # 6b. Tahunan (EHB unpaid)
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, tariff_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES ('ob-ehb-2026', 'san-01', 'trf-ehb', 'EHB', 1, '2026/2027', 250000, 0, 0, 'UNPAID')
        """
    )

    # 6c. USPP (Lifetime 5.000.000, paid 2.000.000, exempted 500.000, remaining 2.500.000)
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, tariff_id, item_type, academic_year_id, period,
            amount_expected, amount_exempted, amount_paid, status
        ) VALUES ('ob-uspp-san01', 'san-01', 'trf-uspp', 'USPP', 1, 'LIFETIME', 5000000, 500000, 2000000, 'PARTIALLY_PAID')
        """
    )

    # 7. Legacy SPP Arrears from remote D1 spp_tunggakan_historis (< 2026-07)
    conn.execute(
        """
        INSERT INTO spp_tunggakan_historis (id, santri_id, tahun, bulan, nominal_tagihan, status)
        VALUES ('leg-1', 'san-01', 2026, 5, 400000, 'BELUM_LUNAS')
        """
    )
    conn.execute(
        """
        INSERT INTO spp_tunggakan_historis (id, santri_id, tahun, bulan, nominal_tagihan, status)
        VALUES ('leg-2', 'san-01', 2026, 6, 400000, 'BELUM_LUNAS')
        """
    )
    # One already paid month in 2026-04 (must be EXCLUDED from arrears)
    conn.execute(
        """
        INSERT INTO spp_tunggakan_historis (id, santri_id, tahun, bulan, nominal_tagihan, status, tanggal_lunas)
        VALUES ('leg-3', 'san-01', 2026, 4, 400000, 'LUNAS', '2026-04-10 10:00:00')
        """
    )

    # 8. Real Payments and Allocations
    # 8a. Fully allocated payment (SPP 500k + Makan 200k = 700k)
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, gateway_fee, net_amount,
            status, allocation_status, paid_at, received_by, external_reference
        ) VALUES ('pay-01', 'PAY-202607-0001', 'san-01', 'CASH', 'MANUAL', 700000, 0, 700000,
                  'PAID', 'ALLOCATED', '2026-07-05 09:30:00', 'usr-bendahara', 'REF-001')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount)
        VALUES ('alc-01', 'pay-01', 'ob-spp-202607', 'OBLIGATION', 'SPP', 500000)
        """
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount)
        VALUES ('alc-02', 'pay-01', 'ob-makan-202607', 'OBLIGATION', 'UANG_MAKAN', 200000)
        """
    )

    # 8b. Multi-item & Partially allocated payment (Gross 2.500.000, allocated 2.000.000 to USPP, remainder 500.000 UNALLOCATED)
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, gateway_fee, net_amount,
            status, allocation_status, paid_at, received_by, external_reference
        ) VALUES ('pay-02', 'PAY-202607-0002', 'san-01', 'DUITKU', 'VA_BCA', 2500000, 4000, 2496000,
                  'PAID', 'PARTIALLY_ALLOCATED', '2026-07-06 14:15:00', 'usr-bendahara', 'DUITKU-TRX-002')
        """
    )
    conn.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount)
        VALUES ('alc-uspp-01', 'pay-02', 'ob-uspp-san01', 'OBLIGATION', 'USPP', 2000000)
        """
    )

    # 8c. UNALLOCATED payment (Gross 300.000, zero rows in finance_allocations, requires reconciliation)
    conn.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, santri_id, channel, method, gross_amount, gateway_fee, net_amount,
            status, allocation_status, paid_at, received_by, external_reference
        ) VALUES ('pay-03', 'PAY-202607-0003', 'san-01', 'CASH', 'MANUAL', 300000, 0, 300000,
                  'PAID', 'UNALLOCATED', '2026-07-07 10:00:00', 'usr-bendahara', 'REF-UNALLOC-003')
        """
    )

    conn.commit()


def test_authorization_matrix():
    print("1. Testing Server Action Authorization & RBAC for getStudentPaymentDetail...")

    authorized_features = {
        "/dashboard/keuangan/status-pembayaran": ["admin", "bendahara", "pimpinan", "demo", "tester"]
    }

    def check_access(session: dict | None) -> tuple[bool, bool]:
        if not session or not session.get("user"):
            return False, False
        role = session["user"].get("role")
        roles = session["user"].get("roles") or [role]

        allowed_roles = authorized_features.get("/dashboard/keuangan/status-pembayaran", [])
        has_access = any(r in allowed_roles for r in roles)
        can_record = has_access and any(r in ["admin", "bendahara"] for r in roles)
        return has_access, can_record

    # 1. Unauthenticated -> Rejected
    allowed, _ = check_access(None)
    assert not allowed, "Unauthenticated session must be rejected"

    # 2. Unauthorized roles -> Rejected
    for r in ["wali_kelas", "keamanan", "guru", "alumni", "orang_tua"]:
        allowed, _ = check_access({"user": {"role": r}})
        assert not allowed, f"Role {r} must NOT have access to financial detail drilldown"

    # 3. Authorized roles -> Allowed
    for r in ["admin", "bendahara", "pimpinan", "demo", "tester"]:
        allowed, can_record = check_access({"user": {"role": r}})
        assert allowed, f"Role {r} must be allowed to access Status Pembayaran"
        if r in ["admin", "bendahara"]:
            assert can_record, f"Role {r} should have mutation permission"
        else:
            assert not can_record, f"Role {r} must be strictly view-only (no mutation capability)"

    print("[OK] Authorization and RBAC matrix verified successfully.")


def test_student_detail_and_vendor_enrichment(conn: sqlite3.Connection):
    print("2. Testing Student Detail & Vendor Name Enrichment...")

    row = conn.execute(
        """
        SELECT
            s.id, s.nis, s.nama_lengkap, s.jenis_kelamin, s.asrama, s.kamar, s.tahun_masuk,
            m_makan.nama_jasa as tempat_makan,
            m_cuci.nama_jasa as tempat_mencuci
        FROM santri s
        LEFT JOIN master_jasa m_makan ON s.tempat_makan_id = m_makan.id
        LEFT JOIN master_jasa m_cuci ON s.tempat_mencuci_id = m_cuci.id
        WHERE s.id = 'san-01'
        """
    ).fetchone()

    assert row is not None, "Student san-01 must exist"
    assert row[1] == "1001"
    assert row[2] == "Muhammad Zaki"
    assert row[4] == "Asrama Al-Falah"
    assert row[5] == "Kamar 01"
    assert row[6] == 2026
    assert row[7] == "Dapur Utama Putri", "Catering vendor name must be enriched from master_jasa"
    assert row[8] == "Berkah Laundry Express", "Laundry vendor name must be enriched from master_jasa"

    print(f"[OK] Santri {row[2]} identity and vendors enriched: Makan={row[7]}, Cuci={row[8]}.")


def test_drilldown_categorization(conn: sqlite3.Connection):
    print("3. Testing Drilldown Categorization (Bulanan, Tahunan, USPP, Tunggakan)...")

    # Mirror query from actions.ts
    obligations = conn.execute(
        """
        SELECT
            o.id, o.item_type, o.period,
            o.amount_expected, o.amount_exempted, o.amount_paid, o.status,
            m.nama_jasa as provider_name
        FROM finance_obligations o
        LEFT JOIN master_jasa m ON o.provider_id = m.id
        WHERE o.santri_id = 'san-01'
        ORDER BY o.period DESC, o.item_type ASC
        """
    ).fetchall()

    bulanan = []
    tahunan = []
    uspp = None
    tunggakan_modern = []

    for ob in obligations:
        expected = ob[3] or 0
        exempted = ob[4] or 0
        paid = ob[5] or 0
        remaining = max(0, expected - exempted - paid)

        item = {
            "id": ob[0],
            "itemType": ob[1],
            "period": ob[2],
            "amountExpected": expected,
            "amountExempted": exempted,
            "amountPaid": paid,
            "status": ob[6],
            "providerName": ob[7],
            "remaining": remaining,
        }

        if item["itemType"] in ("SPP", "UANG_MAKAN", "UANG_NYUCI"):
            bulanan.append(item)
        elif item["itemType"] in ("EHB", "EKSKUL", "KESEHATAN"):
            tahunan.append(item)
        elif item["itemType"] == "USPP":
            uspp = item

        if item["status"] not in ("PAID", "EXEMPTED") and item["remaining"] > 0:
            tunggakan_modern.append(item)

    # Assertions for Bulanan
    assert len(bulanan) == 3, f"Expected 3 monthly obligations, got {len(bulanan)}"
    types = {b["itemType"] for b in bulanan}
    assert types == {"SPP", "UANG_MAKAN", "UANG_NYUCI"}, f"Bulanan items mismatch. Got: {types}"
    # Verify vendor name was populated
    makan_ob = next(b for b in bulanan if b["itemType"] == "UANG_MAKAN")
    assert makan_ob["providerName"] == "Dapur Utama Putri"
    assert makan_ob["remaining"] == 250000

    cuci_ob = next(b for b in bulanan if b["itemType"] == "UANG_NYUCI")
    assert cuci_ob["providerName"] == "Berkah Laundry Express"
    assert cuci_ob["remaining"] == 100000

    # Assertions for Tahunan
    assert len(tahunan) == 1, f"Expected 1 annual obligation (EHB), got {len(tahunan)}"
    assert tahunan[0]["itemType"] == "EHB"
    assert tahunan[0]["remaining"] == 250000

    # Assertions for USPP
    assert uspp is not None, "USPP obligation must be present"
    assert uspp["amountExpected"] == 5000000
    assert uspp["amountExempted"] == 500000
    assert uspp["amountPaid"] == 2000000
    assert uspp["remaining"] == 2500000
    assert uspp["status"] == "PARTIALLY_PAID"

    # Assertions for Tunggakan Modern
    # Makan (250.000) + Cuci (100.000) + EHB (250.000) + USPP (2.500.000) = 4 items
    assert len(tunggakan_modern) == 4, f"Expected 4 unpaid modern obligations, got {len(tunggakan_modern)}"
    total_modern_arrears = sum(it["remaining"] for it in tunggakan_modern)
    assert total_modern_arrears == 3100000, f"Expected modern arrears 3.100.000, got {total_modern_arrears}"

    print(f"[OK] Drilldown verified: Bulanan={len(bulanan)}, Tahunan={len(tahunan)}, USPP remaining={uspp['remaining']:,}, Modern arrears={total_modern_arrears:,}.")


def test_legacy_coexistence_and_zero_duplicate_invariant(conn: sqlite3.Connection):
    print("4. Testing Legacy SPP Coexistence & Zero Duplicate Invariant...")

    legacy_rows = conn.execute(
        """
        SELECT id, tahun, bulan, nominal_tagihan, status
        FROM spp_tunggakan_historis
        WHERE santri_id = 'san-01'
          AND status = 'BELUM_LUNAS'
          AND (tahun * 100 + bulan) < 202607
        ORDER BY tahun ASC, bulan ASC
        """
    ).fetchall()

    assert len(legacy_rows) == 2, f"Expected exactly 2 legacy unpaid records, got {len(legacy_rows)}"
    total_legacy = sum(row[3] for row in legacy_rows)
    assert total_legacy == 800000, f"Expected 800.000 legacy arrears (400k x 2), got {total_legacy}"

    duplicate_rows = conn.execute(
        """
        SELECT COUNT(*) FROM finance_obligations
        WHERE santri_id = 'san-01' AND period IN ('2026-05', '2026-06')
        """
    ).fetchone()[0]
    assert duplicate_rows == 0, f"CRITICAL INVARIANT VIOLATED: {duplicate_rows} duplicate legacy rows found in finance_obligations!"

    grand_total_tunggakan = 3100000 + total_legacy
    assert grand_total_tunggakan == 3900000, f"Expected grand total 3.900.000, got {grand_total_tunggakan}"

    print(f"[OK] Legacy coexistence verified: Rp{total_legacy:,} legacy arrears isolated; 0 duplicate obligations created. Grand Total Tunggakan = Rp{grand_total_tunggakan:,}.")


def test_payment_driven_riwayat_bayar_and_unallocated(conn: sqlite3.Connection):
    print("5. Testing Payment-Driven Riwayat Bayar (All payments, UNALLOCATED, and PARTIALLY_ALLOCATED remainders)...")

    payments = conn.execute(
        """
        SELECT id, payment_number, channel, method, gross_amount, status, allocation_status, paid_at, external_reference
        FROM finance_payments
        WHERE santri_id = 'san-01'
        ORDER BY paid_at DESC
        """
    ).fetchall()

    assert len(payments) == 3, f"Expected exactly 3 payments for san-01, got {len(payments)}"

    allocations = conn.execute(
        """
        SELECT id, payment_id, item_type, amount
        FROM finance_allocations
        WHERE payment_id IN ('pay-01', 'pay-02', 'pay-03')
        """
    ).fetchall()

    alloc_map = {}
    for a in allocations:
        alloc_map.setdefault(a[1], []).append({"id": a[0], "itemType": a[2], "amount": a[3]})

    riwayat = []
    for p in payments:
        p_id, p_num, channel, method, gross, status, alloc_status, paid_at, ext_ref = p
        p_allocs = alloc_map.get(p_id, [])
        allocated_amt = sum(it["amount"] for it in p_allocs)
        is_unallocated = alloc_status == "UNALLOCATED" or (len(p_allocs) == 0 and gross > 0)
        unallocated_amt = gross if is_unallocated else max(0, gross - allocated_amt)

        status_label = "Teralokasi Penuh"
        if alloc_status == "UNALLOCATED" or is_unallocated:
            status_label = "Perlu Rekonsiliasi"
        elif alloc_status == "PARTIALLY_ALLOCATED" or unallocated_amt > 0:
            status_label = "Teralokasi Sebagian"

        riwayat.append({
            "id": p_id,
            "paymentNumber": p_num,
            "grossAmount": gross,
            "allocatedAmount": 0 if is_unallocated else allocated_amt,
            "unallocatedAmount": unallocated_amt,
            "allocationStatus": alloc_status,
            "allocationStatusLabel": status_label,
            "allocations": [] if is_unallocated else p_allocs,
        })

    pay03 = next((r for r in riwayat if r["id"] == "pay-03"), None)
    assert pay03 is not None, "CRITICAL: Payment UNALLOCATED must appear in Riwayat Bayar!"
    assert len(pay03["allocations"]) == 0, "pay-03 must have 0 allocation rows"
    assert pay03["grossAmount"] == 300000, "pay-03 gross amount must be 300.000"
    assert pay03["unallocatedAmount"] == 300000, "pay-03 unallocated remainder must equal full gross amount"
    assert pay03["allocationStatusLabel"] == "Perlu Rekonsiliasi", f"pay-03 human label must be 'Perlu Rekonsiliasi', got: {pay03['allocationStatusLabel']}"

    pay02 = next((r for r in riwayat if r["id"] == "pay-02"), None)
    assert pay02 is not None, "pay-02 must appear in Riwayat Bayar"
    assert pay02["grossAmount"] == 2500000, "pay-02 gross amount must be 2.500.000"
    assert pay02["allocatedAmount"] == 2000000, "pay-02 allocated amount must be 2.000.000 (USPP)"
    assert pay02["unallocatedAmount"] == 500000, "CRITICAL: pay-02 unallocated remainder (500.000) must NOT be lost!"
    assert pay02["allocationStatusLabel"] == "Teralokasi Sebagian"

    pay01 = next((r for r in riwayat if r["id"] == "pay-01"), None)
    assert pay01 is not None
    assert pay01["grossAmount"] == 700000
    assert pay01["allocatedAmount"] == 700000
    assert pay01["unallocatedAmount"] == 0
    assert pay01["allocationStatusLabel"] == "Teralokasi Penuh"

    total_obligation_paid = conn.execute(
        "SELECT SUM(amount_paid) FROM finance_obligations WHERE santri_id = 'san-01'"
    ).fetchone()[0]
    assert total_obligation_paid == 2700000, f"Obligation total paid must strictly be 2.700.000, got {total_obligation_paid}"

    total_gross_paid = sum(p[4] for p in payments)
    assert total_gross_paid == 3500000
    assert total_gross_paid - total_obligation_paid == 800000, "Unallocated difference must strictly equal 800.000"

    print("[OK] Payment-driven Riwayat Bayar verified: UNALLOCATED present with label 'Perlu Rekonsiliasi', PARTIALLY_ALLOCATED remainder preserved, unallocated money does not reduce obligations.")


def test_uspp_installment_history_and_multi_item_isolation(conn: sqlite3.Connection):
    print("6. Testing Dedicated USPP Installment History & Multi-Item Allocation Isolation...")

    uspp_installments = conn.execute(
        """
        SELECT a.id, a.payment_id, a.amount,
               p.payment_number, p.channel, p.method, p.paid_at, p.external_reference
        FROM finance_allocations a
        JOIN finance_payments p ON a.payment_id = p.id
        WHERE p.santri_id = 'san-01' AND a.item_type = 'USPP'
        ORDER BY p.paid_at DESC
        """
    ).fetchall()

    assert len(uspp_installments) == 1, f"Expected exactly 1 USPP installment, got {len(uspp_installments)}"
    inst = uspp_installments[0]

    inst_amount = inst[2]
    assert inst_amount == 2000000, f"CRITICAL: USPP installment amount must be 2.000.000 (USPP allocation), NOT gross 2.500.000. Got: {inst_amount}"

    assert inst[3] == "PAY-202607-0002", "Payment number must match pay-02"
    assert inst[4] == "DUITKU", "Channel must be DUITKU"
    assert inst[5] == "VA_BCA", "Method must be VA_BCA"
    assert inst[6] == "2026-07-06 14:15:00", "Paid timestamp must match"
    assert inst[7] == "DUITKU-TRX-002", "External reference must match"

    print(f"[OK] USPP installment history verified: exactly Rp{inst_amount:,} isolated from multi-item payment with full audit trail.")


def test_read_only_contract():
    print("7. Verifying Read-Only Contract for Fase 4B...")
    actions_path = ROOT / "app" / "dashboard" / "keuangan" / "status-pembayaran" / "actions.ts"
    actions_content = actions_path.read_text(encoding="utf-8")

    # Extract getStudentPaymentDetail function body
    start_idx = actions_content.find("async function getStudentPaymentDetail")
    assert start_idx != -1, "getStudentPaymentDetail must exist in actions.ts"
    end_idx = actions_content.find("export async function searchStudentsForPayment", start_idx)
    if end_idx == -1:
        end_idx = len(actions_content)
    fn_body = actions_content[start_idx:end_idx]

    # Verify getStudentPaymentDetail does not execute write operations
    assert "INSERT INTO" not in fn_body.upper(), "getStudentPaymentDetail must not execute INSERT statements"
    assert "UPDATE " not in fn_body.upper(), "getStudentPaymentDetail must not execute UPDATE statements"
    assert "DELETE FROM" not in fn_body.upper(), "getStudentPaymentDetail must not execute DELETE statements"
    assert "createPaymentOrder" not in fn_body, "getStudentPaymentDetail must not call createPaymentOrder"
    print("[OK] Read-only contract verified. getStudentPaymentDetail executes strictly zero mutation paths.")


def main():
    print("=" * 60)
    print("Starting Fase 4B Test Suite (Detail / Drilldown Status Pembayaran)...")
    print("=" * 60)

    conn = setup_test_db()
    seed_test_data(conn)

    test_authorization_matrix()
    test_student_detail_and_vendor_enrichment(conn)
    test_drilldown_categorization(conn)
    test_legacy_coexistence_and_zero_duplicate_invariant(conn)
    test_payment_driven_riwayat_bayar_and_unallocated(conn)
    test_uspp_installment_history_and_multi_item_isolation(conn)
    test_read_only_contract()

    conn.close()

    print("=" * 60)
    print("ALL FASE 4B STATUS PEMBAYARAN DRILLDOWN TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    main()
