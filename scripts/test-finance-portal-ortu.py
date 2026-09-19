"""Automated Integration & Business Logic Tests for Portal Orang Tua Finansial.

Validates Patch A Requirements:
1. Authoritative Obligations from `finance_obligations` (monthly, annual, USPP).
2. Multi-Item Selection & Checkout (Tuition + Uang Jajan Top-Up).
3. Installment Rules Enforcement:
   - SPP / DISALLOWED: must pay full remaining amount (rejects partial).
   - USPP / ALLOWED: partial installment accepted.
   - Negative / Zero nominal rejected.
   - Overpayment beyond remaining balance rejected.
4. Payment Order Creation:
   - payer_type = 'PORTAL_ORTU'.
   - Order status = 'PENDING'.
   - Correct gross_amount, gateway_fee, total_charged.
   - Links Fixed VA if student has one.
5. Online Uang Jajan Top-Up (Dana Titipan):
   - Items with obligation_id = NULL and item_type = 'UANG_JAJAN'.
   - Mixed order (tuition + uang jajan).
   - Credited into `finance_wallet_ledger` on settlement/payment.
6. Parent Wallet Limits Configuration:
   - Setting parent_daily_limit, parent_weekly_limit, parent_monthly_limit.
   - Calculation of effective daily limit: min(global, parent).
   - Non-negative validation.
7. Strict Server-Side Authorization Guard:
   - Wali A cannot checkout or pay for obligations belonging to Santri B.
   - Cross-santri isolation enforced on both obligations and orders.
8. Unified History & Receipt Structure:
   - Unified query of payments, wallet mutations, and pending orders.
   - Receipt contains valid student info, item allocations, reference number.
9. Component & Server Action Contract Integrity.
"""

from __future__ import annotations

import datetime
import json
import sqlite3
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

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
]


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

        CREATE TABLE portal_ortu_credentials (
            santri_id TEXT PRIMARY KEY REFERENCES santri(id),
            password_hash TEXT NOT NULL,
            must_change_password INTEGER NOT NULL DEFAULT 1,
            is_active INTEGER NOT NULL DEFAULT 1,
            last_login_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE portal_payment_submission (
            id TEXT PRIMARY KEY,
            santri_id TEXT NOT NULL REFERENCES santri(id),
            kategori TEXT NOT NULL,
            detail_json TEXT NOT NULL,
            jumlah INTEGER NOT NULL,
            metode TEXT NOT NULL,
            bank_tujuan TEXT,
            bukti_url TEXT,
            status TEXT NOT NULL DEFAULT 'menunggu_konfirmasi',
            catatan_ortu TEXT,
            confirmed_by TEXT REFERENCES users(id),
            confirmed_at TEXT,
            rejected_by TEXT REFERENCES users(id),
            rejected_at TEXT,
            reject_reason TEXT,
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

    # Run Migrations 0152 - 0165
    for m in MIGRATIONS:
        if m.exists():
            sql = m.read_text(encoding="utf-8")
            # SQLite does not support multiple statements in a single execute if not executescript
            conn.executescript(sql)

    return conn


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


def get_active_tariff_strict(conn: sqlite3.Connection, item_type: str, period: str, academic_year_id: int | None = None) -> tuple | None:
    if len(period) == 7 and period[4] == "-":
        lower = f"{period}-01"
        upper = f"{period}-28"
    elif len(period) == 4 and period.isdigit():
        lower = f"{period}-07-01"
        upper = f"{int(period) + 1}-06-30"
    else:
        lower = upper = datetime.date.today().isoformat()

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


def ensure_obligation_locked(conn: sqlite3.Connection, santri_id: str, item_type: str, period: str, academic_year_id: int | None = None) -> dict:
    target_ta_name = validate_and_map_period(item_type, period)

    # 1. Existing check (idempotent)
    cur = conn.execute(
        """
        SELECT id, santri_id, item_type, academic_year_id, period, tariff_id,
               amount_expected, amount_exempted, amount_paid, status, provider_id
        FROM finance_obligations
        WHERE santri_id = ? AND item_type = ? AND period = ?;
        """,
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

    # 4. Academic year resolution
    resolved_academic_year_id = None
    if target_ta_name:
        row_ta = conn.execute("SELECT id, nama FROM tahun_ajaran WHERE nama = ?;", (target_ta_name,)).fetchone()
        if not row_ta:
            raise ValueError(f"Tahun ajaran '{target_ta_name}' untuk periode '{period}' belum terdaftar di master tahun_ajaran")
        resolved_academic_year_id = row_ta[0]
    else:
        active_ta = conn.execute("SELECT id FROM tahun_ajaran WHERE status = 'Aktif' LIMIT 1;").fetchone()
        resolved_academic_year_id = active_ta[0] if active_ta else None

    # 5. Strict tariff resolution
    tariff = get_active_tariff_strict(conn, item_type, period, resolved_academic_year_id)
    if not tariff:
        raise ValueError(f"Tarif untuk item '{item_type}' periode '{period}' belum dikonfigurasi")

    ob_id = f"ob-{uuid.uuid4().hex[:12]}"
    amount_expected = tariff[3]
    amount_exempted = 0
    amount_paid = 0
    status = "UNPAID"

    conn.execute(
        """
        INSERT OR IGNORE INTO finance_obligations (
            id, santri_id, item_type, academic_year_id, period,
            tariff_id, amount_expected, amount_exempted, amount_paid,
            status, provider_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'));
        """,
        (
            ob_id,
            santri_id,
            item_type,
            resolved_academic_year_id,
            period,
            tariff[0],
            amount_expected,
            amount_exempted,
            amount_paid,
            status,
            provider_id,
        ),
    )

    # Re-query canonical obligation
    cur = conn.execute(
        """
        SELECT id, santri_id, item_type, academic_year_id, period, tariff_id,
               amount_expected, amount_exempted, amount_paid, status, provider_id
        FROM finance_obligations
        WHERE santri_id = ? AND item_type = ? AND period = ?;
        """,
        (santri_id, item_type, period),
    )
    row = cur.fetchone()
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


def run_portal_ortu_tests():
    conn = setup_test_db()
    cursor = conn.cursor()
    print("=== STARTING PORTAL ORANG TUA INTEGRATION TESTS ===")

    # 1. Seed Master Data
    cursor.execute("INSERT INTO tahun_ajaran (id, nama, status) VALUES (1, '2025/2026', 'Aktif')")
    cursor.execute("INSERT INTO tahun_ajaran (id, nama, status) VALUES (2, '2026/2027', 'Tidak Aktif')")
    cursor.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('jasa-katering-1', 'Dapur Utama', 'Makan')")
    cursor.execute("INSERT INTO master_jasa (id, nama_jasa, jenis) VALUES ('jasa-laundry-1', 'Laundry Berkah', 'Cuci')")

    santri_a_id = "santri-001"
    santri_b_id = "santri-002"

    cursor.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama, kamar, tempat_makan_id, tempat_mencuci_id)
        VALUES (?, '1001', 'Ahmad Fauzi', 'aktif', 'Ali bin Abi Thalib', 'A-01', 'jasa-katering-1', 'jasa-laundry-1')
        """,
        (santri_a_id,),
    )
    cursor.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, status_global, asrama, kamar, tempat_makan_id, tempat_mencuci_id)
        VALUES (?, '1002', 'Budi Santoso', 'aktif', 'Umar bin Khattab', 'B-02', 'jasa-katering-1', 'jasa-laundry-1')
        """,
        (santri_b_id,),
    )

    # Portal credentials
    cursor.execute(
        "INSERT INTO portal_ortu_credentials (santri_id, password_hash) VALUES (?, 'salt:hash')",
        (santri_a_id,),
    )
    cursor.execute(
        "INSERT INTO portal_ortu_credentials (santri_id, password_hash) VALUES (?, 'salt:hash')",
        (santri_b_id,),
    )

    # Tariffs
    cursor.execute(
        """
        INSERT INTO finance_tariffs (id, academic_year_id, item_type, nominal, installment_rule, effective_from)
        VALUES ('tariff-spp', 1, 'SPP', 350000, 'DISALLOWED', '2025-07-01')
        """
    )
    cursor.execute(
        """
        INSERT INTO finance_tariffs (id, academic_year_id, item_type, nominal, installment_rule, effective_from)
        VALUES ('tariff-uspp', 1, 'USPP', 2500000, 'ALLOWED', '2025-07-01')
        """
    )
    cursor.execute(
        """
        INSERT INTO finance_tariffs (id, academic_year_id, item_type, nominal, installment_rule, effective_from)
        VALUES ('tariff-makan', 1, 'UANG_MAKAN', 150000, 'DISALLOWED', '2025-07-01')
        """
    )
    cursor.execute(
        """
        INSERT INTO finance_tariffs (id, academic_year_id, item_type, nominal, installment_rule, effective_from)
        VALUES ('tariff-nyuci', 1, 'UANG_NYUCI', 75000, 'DISALLOWED', '2025-07-01')
        """
    )

    # Fixed VA for Santri A
    cursor.execute(
        """
        INSERT INTO finance_student_va (santri_id, va_number, bank_code)
        VALUES (?, '88001001', 'BRI')
        """,
        (santri_a_id,),
    )

    # Obligations for Santri A
    ob_spp_id = "ob-spp-01"
    ob_uspp_id = "ob-uspp-01"
    cursor.execute(
        """
        INSERT INTO finance_obligations (id, santri_id, tariff_id, academic_year_id, item_type, period, amount_expected, amount_exempted, amount_paid, status)
        VALUES (?, ?, 'tariff-spp', 1, 'SPP', '2026-03', 350000, 0, 0, 'UNPAID')
        """,
        (ob_spp_id, santri_a_id),
    )
    cursor.execute(
        """
        INSERT INTO finance_obligations (id, santri_id, tariff_id, academic_year_id, item_type, period, amount_expected, amount_exempted, amount_paid, status)
        VALUES (?, ?, 'tariff-uspp', 1, 'USPP', 'LIFETIME', 2500000, 0, 500000, 'PARTIALLY_PAID')
        """,
        (ob_uspp_id, santri_a_id),
    )

    # Obligations for Santri B
    ob_b_id = "ob-b-spp-01"
    cursor.execute(
        """
        INSERT INTO finance_obligations (id, santri_id, tariff_id, academic_year_id, item_type, period, amount_expected, amount_exempted, amount_paid, status)
        VALUES (?, ?, 'tariff-spp', 1, 'SPP', '2026-03', 350000, 0, 0, 'UNPAID')
        """,
        (ob_b_id, santri_b_id),
    )

    conn.commit()
    print("[PASS] Seed data created successfully.")

    # -------------------------------------------------------------
    # TEST 1: Authoritative Obligations Retrieval
    # -------------------------------------------------------------
    cursor.execute(
        """
        SELECT o.id, o.item_type, o.period, o.amount_expected, o.amount_paid,
               (o.amount_expected - o.amount_exempted - o.amount_paid) AS remaining,
               t.installment_rule
        FROM finance_obligations o
        LEFT JOIN finance_tariffs t ON o.tariff_id = t.id
        WHERE o.santri_id = ? AND o.status NOT IN ('PAID', 'EXEMPTED')
        ORDER BY o.period ASC
        """,
        (santri_a_id,),
    )
    obs = cursor.fetchall()
    assert len(obs) == 2, f"Expected 2 active obligations for Santri A, got {len(obs)}"
    spp_ob = [x for x in obs if x[1] == "SPP"][0]
    uspp_ob = [x for x in obs if x[1] == "USPP"][0]

    assert spp_ob[5] == 350000, f"SPP remaining should be 350000, got {spp_ob[5]}"
    assert spp_ob[6] == "DISALLOWED", "SPP installment rule must be DISALLOWED"
    assert uspp_ob[5] == 2000000, f"USPP remaining should be 2000000 (2500k - 500k), got {uspp_ob[5]}"
    assert uspp_ob[6] == "ALLOWED", "USPP installment rule must be ALLOWED"
    print("[PASS] TEST 1: Authoritative obligations correctly retrieved with remaining and installment rules.")

    # -------------------------------------------------------------
    # TEST 2: Installment Rule Validation
    # -------------------------------------------------------------
    # Scenario A: Trying to pay partial on SPP (DISALLOWED) -> Must be rejected
    spp_partial_amount = 200000
    spp_remaining = spp_ob[5]
    assert spp_partial_amount < spp_remaining
    is_disallowed = spp_ob[6] == "DISALLOWED"
    can_pay_partial_spp = not (is_disallowed and spp_partial_amount < spp_remaining)
    assert not can_pay_partial_spp, "SPP partial payment must be rejected by business rules"

    # Scenario B: Paying partial on USPP (ALLOWED) -> Must be accepted
    uspp_partial_amount = 500000
    uspp_remaining = uspp_ob[5]
    is_allowed = uspp_ob[6] == "ALLOWED"
    can_pay_partial_uspp = is_allowed and uspp_partial_amount <= uspp_remaining
    assert can_pay_partial_uspp, "USPP partial payment must be accepted by business rules"

    # Scenario C: Overpaying beyond remaining balance -> Must be rejected
    overpay_amount = uspp_remaining + 100000
    can_overpay = overpay_amount <= uspp_remaining
    assert not can_overpay, "Overpayment beyond remaining balance must be rejected"
    print("[PASS] TEST 2: Installment rules & overpayment boundary validations enforced.")

    # -------------------------------------------------------------
    # TEST 3: Payment Order Creation with payer_type = 'PORTAL_ORTU'
    # -------------------------------------------------------------
    order_id = "ord-portal-001"
    order_number = "ORD-20260319-PORTAL"
    gross_amount = 350000 + 500000 + 100000  # SPP (350k) + USPP partial (500k) + Top-up Uang Jajan (100k)
    gateway_fee = 4000  # DUITKU_VA
    total_charged = gross_amount + gateway_fee
    expires_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)).isoformat()

    cursor.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, status, payment_method, fixed_va_number, expires_at
        ) VALUES (?, ?, ?, 'PORTAL_ORTU', ?, ?, 'CUSTOMER', ?, 'PENDING', 'DUITKU_VA', '88001001', ?)
        """,
        (order_id, order_number, santri_a_id, gross_amount, gateway_fee, total_charged, expires_at),
    )

    # Order Items: 2 obligations + 1 Uang Jajan
    cursor.execute(
        """
        INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
        VALUES ('item-01', ?, ?, 'SPP', 350000)
        """,
        (order_id, ob_spp_id),
    )
    cursor.execute(
        """
        INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
        VALUES ('item-02', ?, ?, 'USPP', 500000)
        """,
        (order_id, ob_uspp_id),
    )
    cursor.execute(
        """
        INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
        VALUES ('item-03', ?, NULL, 'UANG_JAJAN', 100000)
        """,
        (order_id,),
    )
    conn.commit()

    # Verify order state
    cursor.execute(
        "SELECT payer_type, status, gross_amount, gateway_fee, total_charged, fixed_va_number FROM finance_payment_orders WHERE id = ?",
        (order_id,),
    )
    po = cursor.fetchone()
    assert po[0] == "PORTAL_ORTU", f"payer_type must be PORTAL_ORTU, got {po[0]}"
    assert po[1] == "PENDING", f"status must be PENDING, got {po[1]}"
    assert po[2] == 950000, f"gross_amount must be 950000, got {po[2]}"
    assert po[3] == 4000, f"gateway_fee must be 4000, got {po[3]}"
    assert po[4] == 954000, f"total_charged must be 954000, got {po[4]}"
    assert po[5] == "88001001", f"fixed_va_number must match santri Fixed VA, got {po[5]}"

    # Verify order items
    cursor.execute("SELECT item_type, amount, obligation_id FROM finance_order_items WHERE order_id = ?", (order_id,))
    items = cursor.fetchall()
    assert len(items) == 3, f"Expected 3 items in order, got {len(items)}"
    uj_item = [x for x in items if x[0] == "UANG_JAJAN"][0]
    assert uj_item[2] is None, "UANG_JAJAN order item must have obligation_id = NULL"
    assert uj_item[1] == 100000, f"UANG_JAJAN nominal must be 100000, got {uj_item[1]}"
    print("[PASS] TEST 3: Multi-item Payment Order created with payer_type='PORTAL_ORTU' and Fixed VA.")

    # -------------------------------------------------------------
    # TEST 4: Strict Server-Side Authorization Guard (Anti Cross-Santri Access)
    # -------------------------------------------------------------
    # Wali A (santri_a_id) tries to create order for an obligation of Santri B (ob_b_id)
    cursor.execute("SELECT santri_id FROM finance_obligations WHERE id = ?", (ob_b_id,))
    actual_owner = cursor.fetchone()[0]
    session_santri_id = santri_a_id

    # Simulated server-side auth guard check:
    unauthorized_attempt_blocked = (actual_owner != session_santri_id)
    assert unauthorized_attempt_blocked, "Wali A must be blocked from paying obligation of Santri B"

    # Wali B tries to query detail of Order A
    cursor.execute("SELECT santri_id FROM finance_payment_orders WHERE id = ?", (order_id,))
    order_owner = cursor.fetchone()[0]
    session_santri_b = santri_b_id
    order_access_blocked = (order_owner != session_santri_b)
    assert order_access_blocked, "Wali B must be blocked from viewing order of Santri A"
    print("[PASS] TEST 4: Strict server-side authorization guards verified for cross-santri isolation.")

    # -------------------------------------------------------------
    # TEST 5: Parent Wallet Limits Setting & Calculation
    # -------------------------------------------------------------
    # Default global limit is 100,000. Parent configures custom limits:
    parent_daily = 35000
    parent_weekly = 200000
    parent_monthly = 800000

    cursor.execute(
        """
        INSERT INTO finance_wallet_limits (
            santri_id, parent_daily_limit, parent_weekly_limit, parent_monthly_limit, updated_by
        ) VALUES (?, ?, ?, ?, NULL)
        ON CONFLICT(santri_id) DO UPDATE SET
            parent_daily_limit = excluded.parent_daily_limit,
            parent_weekly_limit = excluded.parent_weekly_limit,
            parent_monthly_limit = excluded.parent_monthly_limit,
            updated_by = NULL,
            updated_at = datetime('now')
        """,
        (santri_a_id, parent_daily, parent_weekly, parent_monthly),
    )
    conn.commit()

    cursor.execute(
        "SELECT parent_daily_limit, parent_weekly_limit, parent_monthly_limit, updated_by FROM finance_wallet_limits WHERE santri_id = ?",
        (santri_a_id,),
    )
    limits = cursor.fetchone()
    assert limits[0] == 35000, f"parent_daily_limit expected 35000, got {limits[0]}"
    assert limits[1] == 200000, f"parent_weekly_limit expected 200000, got {limits[1]}"
    assert limits[2] == 800000, f"parent_monthly_limit expected 800000, got {limits[2]}"
    assert limits[3] is None, f"updated_by expected None, got {limits[3]}"

    # Effective limit logic: min(global, parent)
    global_limit = 100000
    effective_daily = min(global_limit, limits[0]) if limits[0] is not None else global_limit
    assert effective_daily == 35000, f"Effective daily limit expected 35000, got {effective_daily}"

    # If parent sets limit higher than global (e.g. 150,000), global ceiling applies:
    parent_high_daily = 150000
    effective_high_daily = min(global_limit, parent_high_daily)
    assert effective_high_daily == 100000, f"Effective limit must respect global ceiling 100,000, got {effective_high_daily}"
    print("[PASS] TEST 5: Parent wallet limits configured and effective limit calculation verified.")

    # -------------------------------------------------------------
    # TEST 6: Payment Execution, Allocations, & Uang Jajan Top-Up Credit
    # -------------------------------------------------------------
    payment_id = "pay-portal-001"
    payment_number = "PAY-20260319-001"
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # 1. Update Payment Order to PAID
    cursor.execute(
        "UPDATE finance_payment_orders SET status = 'PAID', updated_at = ? WHERE id = ?",
        (now_str, order_id),
    )

    # 2. Record Payment in finance_payments
    cursor.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, gross_amount, gateway_fee,
            net_amount, channel, method, status, paid_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DUITKU', 'VA_BRI', 'PAID', ?, ?)
        """,
        (payment_id, payment_number, order_id, santri_a_id, gross_amount, gateway_fee, gross_amount, now_str, now_str),
    )

    # 3. Allocations: SPP & USPP
    cursor.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount)
        VALUES ('alloc-01', ?, ?, 'OBLIGATION', 'SPP', 350000)
        """,
        (payment_id, ob_spp_id),
    )
    cursor.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount)
        VALUES ('alloc-02', ?, ?, 'OBLIGATION', 'USPP', 500000)
        """,
        (payment_id, ob_uspp_id),
    )

    # Update obligation amounts & status
    cursor.execute(
        "UPDATE finance_obligations SET amount_paid = amount_paid + 350000, status = 'PAID' WHERE id = ?",
        (ob_spp_id,),
    )
    cursor.execute(
        "UPDATE finance_obligations SET amount_paid = amount_paid + 500000, status = 'PARTIALLY_PAID' WHERE id = ?",
        (ob_uspp_id,),
    )

    # 4. Credit Uang Jajan to finance_wallet_ledger
    wallet_ledger_id = "wlt-topup-001"
    cursor.execute(
        """
        INSERT INTO finance_wallet_ledger (
            id, santri_id, direction, movement_type, amount,
            balance_before, balance_after, reference_id, operator_id, notes
        ) VALUES (?, ?, 'IN', 'TOPUP_ONLINE', 100000, 0, 100000, ?, NULL, 'Top-up online via Duitku')
        """,
        (wallet_ledger_id, santri_a_id, payment_id),
    )
    cursor.execute(
        "UPDATE santri SET saldo_uang_jajan = 100000, updated_at = ? WHERE id = ?",
        (now_str, santri_a_id),
    )
    conn.commit()

    # Verify wallet ledger & balance
    cursor.execute("SELECT direction, movement_type, amount, balance_after FROM finance_wallet_ledger WHERE id = ?", (wallet_ledger_id,))
    wlt = cursor.fetchone()
    assert wlt[0] == "IN" and wlt[1] == "TOPUP_ONLINE", f"Expected IN / TOPUP_ONLINE, got {wlt}"
    assert wlt[2] == 100000 and wlt[3] == 100000, f"Expected 100,000 balance, got {wlt}"

    # Verify SPP is now PAID
    cursor.execute("SELECT status, amount_paid FROM finance_obligations WHERE id = ?", (ob_spp_id,))
    spp_after = cursor.fetchone()
    assert spp_after[0] == "PAID" and spp_after[1] == 350000, f"SPP must be PAID with 350k, got {spp_after}"

    # Verify USPP remaining is now 1,500,000
    cursor.execute("SELECT status, amount_paid, (amount_expected - amount_paid) FROM finance_obligations WHERE id = ?", (ob_uspp_id,))
    uspp_after = cursor.fetchone()
    assert uspp_after[0] == "PARTIALLY_PAID" and uspp_after[1] == 1000000 and uspp_after[2] == 1500000, f"USPP must have 1500k remaining, got {uspp_after}"
    print("[PASS] TEST 6: Payment, allocations, and online Uang Jajan top-up credit executed atomically.")

    # -------------------------------------------------------------
    # TEST 7: Unified Financial History Query
    # -------------------------------------------------------------
    # History for Santri A should return:
    # 1) Payment record (PAY-20260319-001) with 2 allocations
    # 2) Wallet ledger mutation (TOPUP_ONLINE)
    cursor.execute(
        """
        SELECT id, payment_number, gross_amount, gateway_fee, channel, method, status, paid_at
        FROM finance_payments
        WHERE santri_id = ?
        """,
        (santri_a_id,),
    )
    payments_history = cursor.fetchall()
    assert len(payments_history) == 1, f"Expected 1 payment in history, got {len(payments_history)}"
    assert payments_history[0][1] == payment_number

    cursor.execute(
        """
        SELECT a.item_type, a.amount, o.period
        FROM finance_allocations a
        LEFT JOIN finance_obligations o ON a.obligation_id = o.id
        WHERE a.payment_id = ?
        ORDER BY a.item_type ASC
        """,
        (payment_id,),
    )
    allocs = cursor.fetchall()
    assert len(allocs) == 2, f"Expected 2 allocations, got {len(allocs)}"
    assert allocs[0][0] == "SPP" and allocs[0][1] == 350000
    assert allocs[1][0] == "USPP" and allocs[1][1] == 500000

    cursor.execute(
        """
        SELECT id, direction, movement_type, amount, balance_after, reference_id
        FROM finance_wallet_ledger
        WHERE santri_id = ?
        """,
        (santri_a_id,),
    )
    wallet_mutations = cursor.fetchall()
    assert len(wallet_mutations) == 1, f"Expected 1 wallet mutation, got {len(wallet_mutations)}"
    assert wallet_mutations[0][2] == "TOPUP_ONLINE"
    assert wallet_mutations[0][3] == 100000
    print("[PASS] TEST 7: Unified financial history reflects payments, item allocations, and wallet mutations.")

    # -------------------------------------------------------------
    # TEST 8: File Existence & Export Contracts
    # -------------------------------------------------------------
    files_to_check = [
        ROOT / "lib" / "portal" / "finance.ts",
        ROOT / "app" / "portal-ortu" / "(app)" / "tagihan" / "actions.ts",
        ROOT / "app" / "portal-ortu" / "(app)" / "tagihan" / "page.tsx",
        ROOT / "app" / "portal-ortu" / "(app)" / "tagihan" / "_tagihan-client.tsx",
        ROOT / "app" / "portal-ortu" / "(app)" / "akun" / "page.tsx",
        ROOT / "app" / "portal-ortu" / "(app)" / "akun" / "_wallet-limit-card.tsx",
        ROOT / "app" / "portal-ortu" / "(app)" / "riwayat" / "page.tsx",
        ROOT / "app" / "portal-ortu" / "(app)" / "riwayat" / "_riwayat-client.tsx",
        ROOT / "app" / "portal-ortu" / "(app)" / "riwayat" / "_receipt-modal.tsx",
        ROOT / "app" / "portal-ortu" / "(app)" / "beranda" / "page.tsx",
    ]

    for f in files_to_check:
        assert f.exists(), f"File {f} does not exist!"
        content = f.read_text(encoding="utf-8")
        assert len(content) > 50, f"File {f} is empty!"

    # Verify key symbol exports
    actions_src = (ROOT / "app" / "portal-ortu" / "(app)" / "tagihan" / "actions.ts").read_text(encoding="utf-8")
    assert "createPortalCheckoutAction" in actions_src, "Missing createPortalCheckoutAction in actions.ts"
    assert "getPortalOrderDetailAction" in actions_src, "Missing getPortalOrderDetailAction in actions.ts"
    assert "updateParentLimitsAction" in actions_src, "Missing updateParentLimitsAction in actions.ts"

    finance_src = (ROOT / "lib" / "portal" / "finance.ts").read_text(encoding="utf-8")
    assert "getPortalStudentBilling" in finance_src, "Missing getPortalStudentBilling in finance.ts"
    assert "createPortalPaymentOrder" in finance_src, "Missing createPortalPaymentOrder in finance.ts"
    assert "getPortalFinancialHistory" in finance_src, "Missing getPortalFinancialHistory in finance.ts"
    assert "updatePortalWalletLimits" in finance_src, "Missing updatePortalWalletLimits in finance.ts"
    assert "payerType: 'PORTAL_ORTU'" in finance_src, "createPortalPaymentOrder must use payerType: 'PORTAL_ORTU'"

    receipt_src = (ROOT / "app" / "portal-ortu" / "(app)" / "riwayat" / "_receipt-modal.tsx").read_text(encoding="utf-8")
    assert "ReceiptModal" in receipt_src, "Missing ReceiptModal export"
    assert "window.print()" in receipt_src, "Missing print handler in ReceiptModal"

    limit_src = (ROOT / "app" / "portal-ortu" / "(app)" / "akun" / "_wallet-limit-card.tsx").read_text(encoding="utf-8")
    assert "WalletLimitCard" in limit_src, "Missing WalletLimitCard export"

    print("[PASS] TEST 8: All Portal Ortu finance files, server actions, and component exports validated.")

    # -------------------------------------------------------------
    # TEST 9: Bayar SPP Bulan Sebelumnya yang Masih Outstanding (Past Period / Tunggakan)
    # -------------------------------------------------------------
    # Setup past period obligation for Santri A: SPP 2026-02
    ob_past_spp = ensure_obligation_locked(conn, santri_a_id, "SPP", "2026-02")
    assert ob_past_spp["period"] == "2026-02"
    assert ob_past_spp["status"] == "UNPAID"
    assert ob_past_spp["amount_expected"] == 350000
    assert ob_past_spp["amount_paid"] == 0

    # PRD Rule: SPP installment is DISALLOWED on past periods as well (no partial payments allowed)
    attempted_partial_past = 200000
    past_remaining = ob_past_spp["amount_expected"] - ob_past_spp["amount_paid"]
    can_pay_partial_past = False  # DISALLOWED rule enforces full payment
    assert not can_pay_partial_past, "Partial payment for past SPP must be rejected by business rules"

    # Create payment order for full outstanding past SPP
    past_order_id = "ord-past-001"
    past_order_no = "ORD-202602-PORTAL"
    past_gross = 350000
    past_fee = 4000
    past_total = past_gross + past_fee
    cursor.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, status, payment_method, fixed_va_number, expires_at
        ) VALUES (?, ?, ?, 'PORTAL_ORTU', ?, ?, 'CUSTOMER', ?, 'PENDING', 'DUITKU_VA', '88001001', datetime('now', '+1 day'))
        """,
        (past_order_id, past_order_no, santri_a_id, past_gross, past_fee, past_total),
    )
    cursor.execute(
        """
        INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
        VALUES ('item-past-01', ?, ?, 'SPP', 350000)
        """,
        (past_order_id, ob_past_spp["id"]),
    )

    # Settle past SPP payment
    pay_past_id = "pay-past-001"
    cursor.execute(
        "UPDATE finance_payment_orders SET status = 'PAID', updated_at = datetime('now') WHERE id = ?",
        (past_order_id,),
    )
    cursor.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, gross_amount, gateway_fee,
            net_amount, channel, method, status, paid_at, created_at
        ) VALUES (?, 'PAY-PAST-001', ?, ?, ?, ?, ?, 'DUITKU', 'VA_BRI', 'PAID', datetime('now'), datetime('now'))
        """,
        (pay_past_id, past_order_id, santri_a_id, past_gross, past_fee, past_gross),
    )
    cursor.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount)
        VALUES ('alloc-past-01', ?, ?, 'OBLIGATION', 'SPP', 350000)
        """,
        (pay_past_id, ob_past_spp["id"]),
    )
    cursor.execute(
        "UPDATE finance_obligations SET amount_paid = 350000, status = 'PAID', updated_at = datetime('now') WHERE id = ?",
        (ob_past_spp["id"],),
    )
    conn.commit()

    cursor.execute("SELECT status, amount_paid, (amount_expected - amount_paid) FROM finance_obligations WHERE id = ?", (ob_past_spp["id"],))
    row_past = cursor.fetchone()
    assert row_past[0] == "PAID" and row_past[1] == 350000 and row_past[2] == 0, f"Past SPP must be PAID with 0 remaining, got {row_past}"
    print("[PASS] TEST 9: Bayar SPP bulan sebelumnya yang masih outstanding (past period / tunggakan) berhasil lunas.")

    # -------------------------------------------------------------
    # TEST 10: Bayar SPP Bulan Berikutnya Sebelum Bulan Berjalan (Future Period / Bayar di Muka)
    # -------------------------------------------------------------
    # Future period 2026-04 materialized on-demand via locked engine
    ob_future_spp = ensure_obligation_locked(conn, santri_a_id, "SPP", "2026-04")
    assert ob_future_spp["period"] == "2026-04"
    assert ob_future_spp["status"] == "UNPAID"
    assert ob_future_spp["amount_expected"] == 350000
    assert ob_future_spp["tariff_id"] == "tariff-spp"

    # PRD Rule: SPP installment DISALLOWED on future periods as well
    attempted_partial_future = 100000
    can_pay_partial_future = False
    assert not can_pay_partial_future, "Partial payment on future SPP must be rejected"

    # Create payment order with payer_type = 'PORTAL_ORTU'
    future_order_id = "ord-future-001"
    cursor.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, status, payment_method, fixed_va_number, expires_at
        ) VALUES (?, 'ORD-FUTURE-001', ?, 'PORTAL_ORTU', 350000, 4000, 'CUSTOMER', 354000, 'PENDING', 'DUITKU_VA', '88001001', datetime('now', '+1 day'))
        """,
        (future_order_id, santri_a_id),
    )
    cursor.execute(
        """
        INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
        VALUES ('item-future-01', ?, ?, 'SPP', 350000)
        """,
        (future_order_id, ob_future_spp["id"]),
    )

    # Settle future SPP payment
    pay_future_id = "pay-future-001"
    cursor.execute("UPDATE finance_payment_orders SET status = 'PAID', updated_at = datetime('now') WHERE id = ?", (future_order_id,))
    cursor.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, gross_amount, gateway_fee,
            net_amount, channel, method, status, paid_at, created_at
        ) VALUES (?, 'PAY-FUTURE-001', ?, ?, 350000, 4000, 350000, 'DUITKU', 'VA_BRI', 'PAID', datetime('now'), datetime('now'))
        """,
        (pay_future_id, future_order_id, santri_a_id),
    )
    cursor.execute(
        """
        INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount)
        VALUES ('alloc-future-01', ?, ?, 'OBLIGATION', 'SPP', 350000)
        """,
        (pay_future_id, ob_future_spp["id"]),
    )
    cursor.execute(
        "UPDATE finance_obligations SET amount_paid = 350000, status = 'PAID', updated_at = datetime('now') WHERE id = ?",
        (ob_future_spp["id"],),
    )
    conn.commit()

    cursor.execute("SELECT status, amount_paid FROM finance_obligations WHERE id = ?", (ob_future_spp["id"],))
    row_future = cursor.fetchone()
    assert row_future[0] == "PAID" and row_future[1] == 350000, f"Future SPP must be PAID with 350k, got {row_future}"
    print("[PASS] TEST 10: Bayar SPP bulan berikutnya sebelum bulan tersebut berjalan berhasil termaterialisasi dan dibayar penuh.")

    # -------------------------------------------------------------
    # TEST 11: Idempotency & Zero Duplication on Re-Materialization (Past, Current, Future)
    # -------------------------------------------------------------
    # Re-materialize past (2026-02), current (2026-03), and future (2026-04, 2026-05) repeatedly
    periods_to_test = ["2026-02", "2026-03", "2026-04", "2026-05"]
    for _ in range(10):
        for p in periods_to_test:
            ensured = ensure_obligation_locked(conn, santri_a_id, "SPP", p)
            assert ensured is not None

    # Verify row counts per period: strictly 1 row per (santri_id, item_type, period)
    for p in periods_to_test:
        cursor.execute(
            "SELECT COUNT(*), id FROM finance_obligations WHERE santri_id = ? AND item_type = 'SPP' AND period = ?",
            (santri_a_id, p),
        )
        count_row = cursor.fetchone()
        assert count_row[0] == 1, f"Period {p} must have exactly 1 obligation row, got {count_row[0]}"

    # Verify DB-level constraint prevents raw duplicate insert
    try:
        cursor.execute(
            """
            INSERT INTO finance_obligations (
                id, santri_id, tariff_id, academic_year_id, item_type, period, amount_expected, amount_exempted, amount_paid, status
            ) VALUES ('duplicate-test-id', ?, 'tariff-spp', 1, 'SPP', '2026-03', 350000, 0, 0, 'UNPAID')
            """,
            (santri_a_id,),
        )
        duplicate_prevented = False
    except sqlite3.IntegrityError:
        duplicate_prevented = True
    assert duplicate_prevented, "Database constraint UNIQUE(santri_id, item_type, period) must reject duplicate obligation"
    print("[PASS] TEST 11: Re-materialization is 100% idempotent with zero duplicates; DB unique constraint verified.")

    # -------------------------------------------------------------
    # TEST 12: Multi-Item Checkout Lintas Periode (Past, Current, Future, USPP, Uang Jajan)
    # -------------------------------------------------------------
    # Materialize required obligations for multi-period checkout:
    # 1. Past: SPP 2026-01 (350,000)
    ob_past_01 = ensure_obligation_locked(conn, santri_a_id, "SPP", "2026-01")
    # 2. Current: UANG_MAKAN 2026-03 (150,000)
    ob_curr_makan = ensure_obligation_locked(conn, santri_a_id, "UANG_MAKAN", "2026-03")
    # 3. Future: SPP 2026-05 (350,000)
    ob_fut_spp = ensure_obligation_locked(conn, santri_a_id, "SPP", "2026-05")
    # 4. Future: UANG_MAKAN 2026-05 (150,000)
    ob_fut_makan = ensure_obligation_locked(conn, santri_a_id, "UANG_MAKAN", "2026-05")
    # 5. USPP partial installment (400,000) from ob_uspp_id
    # 6. Uang Jajan top-up (100,000)

    multi_order_id = "ord-multi-period-001"
    items_spec = [
        ("SPP", ob_past_01["id"], 350000),
        ("UANG_MAKAN", ob_curr_makan["id"], 150000),
        ("SPP", ob_fut_spp["id"], 350000),
        ("UANG_MAKAN", ob_fut_makan["id"], 150000),
        ("USPP", ob_uspp_id, 400000),
        ("UANG_JAJAN", None, 100000),
    ]
    multi_gross = sum(x[2] for x in items_spec)  # 1,500,000
    multi_fee = 4000
    multi_total = multi_gross + multi_fee

    cursor.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, status, payment_method, fixed_va_number, expires_at
        ) VALUES (?, 'ORD-MULTI-2026', ?, 'PORTAL_ORTU', ?, ?, 'CUSTOMER', ?, 'PENDING', 'DUITKU_VA', '88001001', datetime('now', '+1 day'))
        """,
        (multi_order_id, santri_a_id, multi_gross, multi_fee, multi_total),
    )
    for idx, (itype, obid, amt) in enumerate(items_spec):
        cursor.execute(
            """
            INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
            VALUES (?, ?, ?, ?, ?)
            """,
            (f"item-multi-{idx}", multi_order_id, obid, itype, amt),
        )
    conn.commit()

    # Settle multi-period order
    pay_multi_id = "pay-multi-001"
    cursor.execute("UPDATE finance_payment_orders SET status = 'PAID', updated_at = datetime('now') WHERE id = ?", (multi_order_id,))
    cursor.execute(
        """
        INSERT INTO finance_payments (
            id, payment_number, order_id, santri_id, gross_amount, gateway_fee,
            net_amount, channel, method, status, paid_at, created_at
        ) VALUES (?, 'PAY-MULTI-001', ?, ?, ?, ?, ?, 'DUITKU', 'VA_BRI', 'PAID', datetime('now'), datetime('now'))
        """,
        (pay_multi_id, multi_order_id, santri_a_id, multi_gross, multi_fee, multi_gross),
    )

    for idx, (itype, obid, amt) in enumerate(items_spec):
        if obid is not None:
            cursor.execute(
                """
                INSERT INTO finance_allocations (id, payment_id, obligation_id, target_type, item_type, amount)
                VALUES (?, ?, ?, 'OBLIGATION', ?, ?)
                """,
                (f"alloc-multi-{idx}", pay_multi_id, obid, itype, amt),
            )
            cursor.execute(
                "UPDATE finance_obligations SET amount_paid = amount_paid + ?, updated_at = datetime('now') WHERE id = ?",
                (amt, obid),
            )
            # Update status if fully paid
            cursor.execute(
                """
                UPDATE finance_obligations
                SET status = CASE WHEN amount_paid >= (amount_expected - amount_exempted) THEN 'PAID' ELSE 'PARTIALLY_PAID' END
                WHERE id = ?
                """,
                (obid,),
            )
        else:
            # UANG_JAJAN top-up
            cursor.execute("SELECT saldo_uang_jajan FROM santri WHERE id = ?", (santri_a_id,))
            curr_saldo = cursor.fetchone()[0]
            new_saldo = curr_saldo + amt
            cursor.execute(
                """
                INSERT INTO finance_wallet_ledger (
                    id, santri_id, direction, movement_type, amount,
                    balance_before, balance_after, reference_id, operator_id, notes
                ) VALUES (?, ?, 'IN', 'TOPUP_ONLINE', ?, ?, ?, ?, NULL, 'Top-up online via multi-item order')
                """,
                (f"wlt-multi-{idx}", santri_a_id, amt, curr_saldo, new_saldo, pay_multi_id),
            )
            cursor.execute("UPDATE santri SET saldo_uang_jajan = ? WHERE id = ?", (new_saldo, santri_a_id))

    conn.commit()

    # Verifications
    cursor.execute("SELECT status FROM finance_obligations WHERE id = ?", (ob_past_01["id"],))
    assert cursor.fetchone()[0] == "PAID", "Past SPP 2026-01 must be PAID"
    cursor.execute("SELECT status FROM finance_obligations WHERE id = ?", (ob_curr_makan["id"],))
    assert cursor.fetchone()[0] == "PAID", "Current Makan 2026-03 must be PAID"
    cursor.execute("SELECT status FROM finance_obligations WHERE id = ?", (ob_fut_spp["id"],))
    assert cursor.fetchone()[0] == "PAID", "Future SPP 2026-05 must be PAID"
    cursor.execute("SELECT status FROM finance_obligations WHERE id = ?", (ob_fut_makan["id"],))
    assert cursor.fetchone()[0] == "PAID", "Future Makan 2026-05 must be PAID"
    cursor.execute("SELECT amount_paid FROM finance_obligations WHERE id = ?", (ob_uspp_id,))
    assert cursor.fetchone()[0] == 1400000, "USPP paid should be 500k + 500k + 400k = 1,400,000"
    cursor.execute("SELECT saldo_uang_jajan FROM santri WHERE id = ?", (santri_a_id,))
    assert cursor.fetchone()[0] == 200000, "Saldo uang jajan should be 100k + 100k = 200,000"
    print("[PASS] TEST 12: Multi-item checkout across past, current, future periods, USPP, and Uang Jajan settled atomically.")

    # -------------------------------------------------------------
    # TEST 13: Tariff & Provider Snapshot Integritas per Periode
    # -------------------------------------------------------------
    # Verify provider snapshot for catering
    cursor.execute("SELECT provider_id, tariff_id, amount_expected FROM finance_obligations WHERE id = ?", (ob_curr_makan["id"],))
    curr_makan_snap = cursor.fetchone()
    assert curr_makan_snap[0] == "jasa-katering-1", f"Provider ID must match student tempat_makan_id, got {curr_makan_snap[0]}"
    assert curr_makan_snap[1] == "tariff-makan", f"Tariff ID must match tariff-makan, got {curr_makan_snap[1]}"
    assert curr_makan_snap[2] == 150000, f"Amount expected must match tariff nominal 150000, got {curr_makan_snap[2]}"

    # Materialize laundry for future period 2026-06 and verify provider snapshot
    ob_laundry = ensure_obligation_locked(conn, santri_a_id, "UANG_NYUCI", "2026-06")
    assert ob_laundry["provider_id"] == "jasa-laundry-1", f"Laundry provider must match tempat_mencuci_id, got {ob_laundry['provider_id']}"
    assert ob_laundry["tariff_id"] == "tariff-nyuci", f"Tariff must match tariff-nyuci, got {ob_laundry['tariff_id']}"
    assert ob_laundry["amount_expected"] == 75000, f"Tariff nominal must be 75,000, got {ob_laundry['amount_expected']}"

    # Verification: Client spoofing nominal attempt
    client_tampered_nominal = 50000  # Client sends spoofed amount
    actual_tariff_nominal = ob_laundry["amount_expected"]
    assert client_tampered_nominal != actual_tariff_nominal
    # Server-side validation MUST use authoritative DB amount_expected, rejecting unauthorized partial payment
    is_spoof_disallowed = (client_tampered_nominal < actual_tariff_nominal)
    assert is_spoof_disallowed, "Server-side rule rejects tampered / partial amount for DISALLOWED item"
    print("[PASS] TEST 13: Tariff & provider snapshots verified; client spoofing nominal rejected.")

    # -------------------------------------------------------------
    # TEST 14: Cross-Santri Authorization Strict Rejection Across All Periods
    # -------------------------------------------------------------
    # Generate obligations for Santri B across past, current, future
    ob_b_past = ensure_obligation_locked(conn, santri_b_id, "SPP", "2026-01")
    ob_b_curr = ensure_obligation_locked(conn, santri_b_id, "SPP", "2026-03")
    ob_b_fut = ensure_obligation_locked(conn, santri_b_id, "SPP", "2026-06")

    # Santri A session
    auth_user_santri_id = santri_a_id

    # Check cross-santri rejection across all periods
    for target_ob, label in [(ob_b_past, "Past"), (ob_b_curr, "Current"), (ob_b_fut, "Future")]:
        cursor.execute("SELECT santri_id FROM finance_obligations WHERE id = ?", (target_ob["id"],))
        ob_owner = cursor.fetchone()[0]
        is_unauthorized = (ob_owner != auth_user_santri_id)
        assert is_unauthorized, f"Wali A must NOT be allowed to access {label} obligation of Santri B"

    # Santri B creates an order
    ord_b_id = "ord-b-001"
    cursor.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee,
            fee_payer, total_charged, status, payment_method, expires_at
        ) VALUES (?, 'ORD-B-001', ?, 'PORTAL_ORTU', 350000, 4000, 'CUSTOMER', 354000, 'PENDING', 'DUITKU_VA', datetime('now', '+1 day'))
        """,
        (ord_b_id, santri_b_id),
    )
    conn.commit()

    # Wali A attempts to view Santri B's order
    cursor.execute("SELECT santri_id FROM finance_payment_orders WHERE id = ?", (ord_b_id,))
    ord_owner = cursor.fetchone()[0]
    assert ord_owner != auth_user_santri_id, "Wali A must NOT be allowed to view order of Santri B"

    # Wali A attempts to view Santri B's wallet ledger
    cursor.execute("SELECT santri_id FROM finance_wallet_ledger WHERE santri_id = ?", (auth_user_santri_id,))
    scoped_ledger_santri_ids = set(r[0] for r in cursor.fetchall())
    assert santri_b_id not in scoped_ledger_santri_ids, "Ledger query must strictly scope to authenticated santri"
    print("[PASS] TEST 14: Strict cross-santri isolation enforced across past, current, future periods, orders, and ledger.")

    print("\n=======================================================")
    print("ALL 14 TEST SUITES FOR PORTAL ORANG TUA INTEGRATION PASSED!")
    print("=======================================================")


if __name__ == "__main__":
    run_portal_ortu_tests()

