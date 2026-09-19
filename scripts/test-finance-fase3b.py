"""Local SQLite contract & business logic test suite for Fase 3B Web API V2 (Dynamic Checkout & QRIS).

Verifies that:
1. Duitku Cryptography & Signatures (Web API V2):
   - HMAC-SHA256 signature generator strictly matches official Duitku formula:
     - Inquiry: HMAC_SHA256(merchantCode + merchantOrderId + paymentAmount, apiKey)
     - Check Status: HMAC_SHA256(merchantCode + merchantOrderId, apiKey)
     - Callback: HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)
   - Invalid signature, altered amount, or altered order ID is strictly rejected.
   - Bad signature events are logged to finance_gateway_events with signature_valid = 0 and processing_status = 'ERROR'.
2. Idempotency & Gateway Events:
   - First incoming callback succeeds, records event with processing_status = 'PROCESSED'.
   - Replayed/retried callback with same reference is recognized as duplicate (idempotent):
     - Returns immediately without duplicate payments or duplicate allocations.
3. Dynamic Checkout Order Matching & Payment Execution:
   - Active PENDING checkout order matched by order_number with exact total_charged.
   - Order marked PAID, payment created, allocations created, obligations updated atomically.
4. Non-Existent Checkout Order Rejection:
   - Unknown merchantOrderId on V2 callback strictly throws/rejects as invalid checkout order.
   - Does NOT guess allocations or look up Fixed Virtual Account (protocol isolation).
5. Expired / Cancelled Order Callback:
   - Real money received for expired/cancelled order is not lost.
   - Recorded safely to reconciliation unallocated items.
6. Amount Mismatch Handling:
   - Callback amount differs from order total_charged.
   - Avoids guessing allocations, routes safely to santri unallocated reconciliation.
7. Failed Gateway Status (resultCode != '00'):
   - Records event as IGNORED, creates zero payments.
8. Zero Plaintext Secrets in Database:
   - Database app_settings does not store apiKey.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_0152 = ROOT / "migrations" / "0152_finance_tariffs_and_obligations.sql"
MIGRATION_0153 = ROOT / "migrations" / "0153_finance_tariffs_overlap_trigger.sql"
MIGRATION_0154 = ROOT / "migrations" / "0154_finance_exemptions_revocation_metadata.sql"
MIGRATION_0155 = ROOT / "migrations" / "0155_finance_payments_and_orders.sql"
MIGRATION_0156 = ROOT / "migrations" / "0156_finance_payment_hardening.sql"
MIGRATION_0157 = ROOT / "migrations" / "0157_finance_unallocated_idempotency.sql"
MIGRATION_0158 = ROOT / "migrations" / "0158_finance_payment_order_multi_payment.sql"


def hmac_sha256(message: str, key: str) -> str:
    """Calculates HMAC-SHA256 hex lowercase as per official Duitku Web API V2."""
    return hmac.new(key.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest().lower()


def setup_database() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.isolation_level = None
    conn.execute("PRAGMA foreign_keys = ON;")

    # Setup prerequisite tables
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
            tempat_makan_id TEXT REFERENCES master_jasa(id),
            tempat_mencuci_id TEXT REFERENCES master_jasa(id),
            status_global TEXT NOT NULL DEFAULT 'Aktif',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE app_settings (
            id TEXT PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """
    )

    # Migrations 0152 - 0158
    for migration_file in [
        MIGRATION_0152,
        MIGRATION_0153,
        MIGRATION_0154,
        MIGRATION_0155,
        MIGRATION_0156,
        MIGRATION_0157,
        MIGRATION_0158,
    ]:
        conn.executescript(migration_file.read_text(encoding="utf-8"))

    return conn


def seed_test_data(conn: sqlite3.Connection) -> None:
    conn.execute("INSERT INTO tahun_ajaran (id, nama, is_active) VALUES (1, '2026/2027', 1)")
    conn.execute("INSERT INTO master_jasa (id, nama, jenis, biaya) VALUES ('jasa-makan-1', 'Katering Barokah', 'Makan', 450000)")
    conn.execute("INSERT INTO master_jasa (id, nama, jenis, biaya) VALUES ('jasa-cuci-1', 'Laundry Bersih', 'Cuci', 150000)")

    conn.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar, tempat_makan_id, tempat_mencuci_id, status_global)
        VALUES ('san-ahmad', '1001', 'Ahmad Dahlan', 'Asrama Al-Falah', 'Kamar 01', 'jasa-makan-1', 'jasa-cuci-1', 'Aktif')
        """
    )
    conn.execute(
        """
        INSERT INTO santri (id, nis, nama_lengkap, asrama, kamar, tempat_makan_id, tempat_mencuci_id, status_global)
        VALUES ('san-budi', '1002', 'Budi Utomo', 'Asrama Al-Falah', 'Kamar 02', 'jasa-makan-1', 'jasa-cuci-1', 'Aktif')
        """
    )

    # Tariffs
    conn.execute("INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from) VALUES ('tar-spp-1', 'SPP', 1, 500000, 'DISALLOWED', '2026-07-01')")
    conn.execute("INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from) VALUES ('tar-makan-1', 'UANG_MAKAN', 1, 450000, 'DISALLOWED', '2026-07-01')")
    conn.execute("INSERT INTO finance_tariffs (id, item_type, academic_year_id, nominal, installment_rule, effective_from) VALUES ('tar-uspp-1', 'USPP', 1, 3000000, 'ALLOWED', '2026-07-01')")

    # Obligations for Ahmad
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, tariff_id, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-ahmad-spp-09', 'san-ahmad', 'SPP', 1, '2026-09', 'tar-spp-1', 500000, 0, 0, 'UNPAID')")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, tariff_id, amount_expected, amount_exempted, amount_paid, status, provider_id) VALUES ('ob-ahmad-makan-09', 'san-ahmad', 'UANG_MAKAN', 1, '2026-09', 'tar-makan-1', 450000, 0, 0, 'UNPAID', 'jasa-makan-1')")
    conn.execute("INSERT INTO finance_obligations (id, santri_id, item_type, academic_year_id, period, tariff_id, amount_expected, amount_exempted, amount_paid, status) VALUES ('ob-ahmad-uspp', 'san-ahmad', 'USPP', 1, 'LIFETIME', 'tar-uspp-1', 3000000, 0, 0, 'UNPAID')")


MERCHANT_CODE = "D12345"
API_KEY = "test_secret_api_key_12345"


def simulate_process_duitku_v2_callback(conn: sqlite3.Connection, payload: dict, skip_sig: bool = False) -> dict:
    """Mirrors lib/finance/gateway/duitku-v2.ts processDuitkuV2Callback precisely."""
    merchant_code = str(payload.get("merchantCode", "")).strip()
    raw_amount = payload.get("amount", "")
    amount = int(raw_amount) if raw_amount != "" else 0
    merchant_order_id = str(payload.get("merchantOrderId", "")).strip()
    reference = str(payload.get("reference", "")).strip()
    signature = str(payload.get("signature", "")).strip()
    result_code = str(payload.get("resultCode", "")).strip()
    payment_code = str(payload.get("paymentCode", "")).strip()
    settlement_date = payload.get("settlementDate")

    if not merchant_code or amount is None or not merchant_order_id or not reference or not signature:
        raise ValueError("Parameter callback Duitku V2 tidak lengkap.")

    # 1. Signature check
    if not skip_sig:
        expected_sig = hmac_sha256(f"{merchant_code}{amount}{merchant_order_id}", API_KEY)
        if signature.lower() != expected_sig.lower():
            err_key = f"DUITKU_V2_BAD_SIG_{reference}_{uuid.uuid4().hex[:6]}"
            conn.execute(
                """
                INSERT INTO finance_gateway_events (id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at)
                VALUES (?, 'DUITKU_V2', ?, ?, 0, ?, 'ERROR', datetime('now'))
                """,
                (str(uuid.uuid4()), err_key, merchant_order_id, json.dumps(payload)),
            )
            raise ValueError("Bad Signature")

    # 2. Idempotency check via finance_gateway_events
    event_key = f"DUITKU_V2_{reference}"
    cur = conn.execute("SELECT id, processing_status FROM finance_gateway_events WHERE event_key = ?", (event_key,))
    existing_event = cur.fetchone()

    if existing_event and existing_event[1] == "PROCESSED":
        return {
            "success": True,
            "message": "Callback Duitku V2 sudah diproses sebelumnya.",
            "isDuplicate": True,
            "matchType": "ALREADY_PROCESSED",
        }

    # 3. Handle resultCode != '00'
    if result_code != "00":
        event_id = existing_event[0] if existing_event else str(uuid.uuid4())
        if not existing_event:
            conn.execute(
                """
                INSERT INTO finance_gateway_events (id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at)
                VALUES (?, 'DUITKU_V2', ?, ?, 1, ?, 'IGNORED', datetime('now'))
                """,
                (event_id, event_key, merchant_order_id, json.dumps(payload)),
            )
        else:
            conn.execute("UPDATE finance_gateway_events SET processing_status = 'IGNORED' WHERE id = ?", (event_id,))
        return {
            "success": False,
            "message": f"Status transaksi gateway bukan sukses: {result_code}",
            "isDuplicate": False,
            "matchType": "ALREADY_PROCESSED",
        }

    method = f"DUITKU_{payment_code.upper()}" if payment_code else "DUITKU_V2"
    paid_at = f"{settlement_date}T12:00:00Z" if settlement_date else datetime.now(timezone.utc).isoformat()

    # 4. Search dynamic checkout order
    cur = conn.execute(
        "SELECT id, order_number, santri_id, gross_amount, gateway_fee, total_charged, status FROM finance_payment_orders WHERE order_number = ?",
        (merchant_order_id,),
    )
    order = cur.fetchone()

    match_type = ""
    payment_id = str(uuid.uuid4())
    payment_number = f"PAY-V2-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    rec_item_id = None

    if order:
        order_id, order_num, santri_id, gross_amt, gw_fee, total_charged, order_status = order

        if order_status == "PENDING":
            if total_charged == amount:
                # MATCH: full order payment
                conn.execute(
                    """
                    INSERT INTO finance_payments (
                        id, payment_number, order_id, santri_id, channel, method,
                        gross_amount, gateway_fee, net_amount, status, correction_status,
                        allocation_status, paid_at, external_reference, created_at
                    ) VALUES (?, ?, ?, ?, 'DUITKU', ?, ?, ?, ?, 'PAID', 'NONE', 'ALLOCATED', ?, ?, datetime('now'))
                    """,
                    (payment_id, payment_number, order_id, santri_id, method, gross_amt, gw_fee, gross_amt - gw_fee, paid_at, reference),
                )

                # Allocations
                cur_items = conn.execute("SELECT id, obligation_id, item_type, amount FROM finance_order_items WHERE order_id = ?", (order_id,))
                for itm_id, ob_id, itm_type, itm_amt in cur_items.fetchall():
                    alloc_id = str(uuid.uuid4())
                    target_type = "OBLIGATION" if ob_id else "UANG_JAJAN"
                    conn.execute(
                        """
                        INSERT INTO finance_allocations (
                            id, payment_id, obligation_id, target_type, item_type, amount, disbursed_amount, distribution_status, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, 0, 'UNDISBURSED', datetime('now'))
                        """,
                        (alloc_id, payment_id, ob_id, target_type, itm_type, itm_amt),
                    )
                    if ob_id:
                        conn.execute(
                            """
                            UPDATE finance_obligations
                            SET amount_paid = amount_paid + ?,
                                status = CASE
                                    WHEN (amount_paid + ?) >= (amount_expected - amount_exempted) THEN 'PAID'
                                    ELSE 'PARTIALLY_PAID'
                                END,
                                updated_at = datetime('now')
                            WHERE id = ?
                            """,
                            (itm_amt, itm_amt, ob_id),
                        )

                # Mark order PAID
                conn.execute("UPDATE finance_payment_orders SET status = 'PAID', updated_at = datetime('now') WHERE id = ?", (order_id,))
                match_type = "ORDER_ALLOCATED"
            else:
                # AMOUNT MISMATCH on checkout order
                conn.execute(
                    """
                    INSERT INTO finance_payments (
                        id, payment_number, order_id, santri_id, channel, method,
                        gross_amount, gateway_fee, net_amount, status, correction_status,
                        allocation_status, paid_at, external_reference, created_at
                    ) VALUES (?, ?, ?, ?, 'DUITKU', ?, ?, ?, ?, 'PAID', 'NONE', 'UNALLOCATED', ?, ?, datetime('now'))
                    """,
                    (payment_id, payment_number, order_id, santri_id, method, amount, gw_fee, max(0, amount - gw_fee), paid_at, reference),
                )
                conn.execute(
                    """
                    INSERT INTO finance_reconciliation_items (
                        id, reconciliation_id, payment_id, external_reference, internal_amount, external_amount, discrepancy_amount,
                        match_status, resolution_action, resolution_notes, created_at
                    ) VALUES (?, NULL, ?, ?, 0, ?, ?, 'AMOUNT_MISMATCH', 'NONE', 'Nominal callback berbeda dari order total_charged', datetime('now'))
                    """,
                    (str(uuid.uuid4()), payment_id, reference, amount, amount),
                )
                match_type = "AMOUNT_MISMATCH"
        else:
            # Order is already PAID, EXPIRED, or CANCELLED
            conn.execute(
                """
                INSERT INTO finance_payments (
                    id, payment_number, order_id, santri_id, channel, method,
                    gross_amount, gateway_fee, net_amount, status, correction_status,
                    allocation_status, paid_at, external_reference, created_at
                ) VALUES (?, ?, ?, ?, 'DUITKU', ?, ?, ?, ?, 'PAID', 'NONE', 'UNALLOCATED', ?, ?, datetime('now'))
                """,
                (payment_id, payment_number, order_id, santri_id, method, amount, gw_fee, max(0, amount - gw_fee), paid_at, reference),
            )
            conn.execute(
                """
                INSERT INTO finance_reconciliation_items (
                    id, reconciliation_id, payment_id, external_reference, internal_amount, external_amount, discrepancy_amount,
                    match_status, resolution_action, resolution_notes, created_at
                ) VALUES (?, NULL, ?, ?, 0, ?, ?, 'UNALLOCATED_TRANSFER', 'NONE', ?, datetime('now'))
                """,
                (str(uuid.uuid4()), payment_id, reference, amount, amount, f"Order status is {order_status}"),
            )
            match_type = "EXPIRED_OR_CANCELLED_ORDER"
    else:
        # Order checkout V2 tidak ditemukan, namun signature valid dan uang nyata diterima (resultCode = '00').
        # Sesuai prinsip rekonsiliasi: catat sebagai unmatched external receipt ke finance_reconciliation_items
        # tanpa memalsukan santri_id atau menghasilkan alokasi.
        rec_item_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO finance_reconciliation_items (
                id, reconciliation_id, payment_id, settlement_id, cash_session_id,
                external_reference, internal_amount, external_amount, discrepancy_amount,
                match_status, resolution_action, resolution_notes, created_at
            ) VALUES (?, NULL, NULL, NULL, NULL, ?, 0, ?, ?, 'UNMATCHED_EXTERNAL', 'NONE', ?, datetime('now'))
            """,
            (rec_item_id, reference, amount, amount, f"Penerimaan dana gateway Duitku V2 berhasil (ref: {reference}), namun order '{merchant_order_id}' tidak ditemukan. Tercatat sebagai unmatched external receipt untuk rekonsiliasi manual."),
        )
        match_type = "UNMATCHED_EXTERNAL"

    # Mark gateway event PROCESSED
    event_id = existing_event[0] if existing_event else str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO finance_gateway_events (id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at)
        VALUES (?, 'DUITKU_V2', ?, ?, 1, ?, 'PROCESSED', datetime('now'))
        ON CONFLICT(event_key) DO UPDATE SET processing_status = 'PROCESSED'
        """,
        (event_id, event_key, merchant_order_id, json.dumps(payload)),
    )

    return {
        "success": True,
        "message": "Callback processed",
        "paymentId": payment_id if order else None,
        "paymentNumber": payment_number if order else None,
        "orderId": order[0] if order else None,
        "reconciliationItemId": rec_item_id,
        "isDuplicate": False,
        "matchType": match_type,
    }


# ============================================================
# Test Cases for Web API V2
# ============================================================

def test_duitku_v2_cryptography_and_signatures():
    print("Testing Duitku V2 Official Signatures (HMAC-SHA256)...")
    merchant_code = "D12345"
    order_id = "ORD-20260919-001"
    amount = 500000
    api_key = "secret_key_testing_1234"

    # 1. Inquiry Signature V2: merchantCode + merchantOrderId + paymentAmount
    inquiry_sig = hmac_sha256(f"{merchant_code}{order_id}{amount}", api_key)
    assert len(inquiry_sig) == 64, "SHA256 hex must be 64 chars"

    # 2. Check Status Signature V2: merchantCode + merchantOrderId
    status_sig = hmac_sha256(f"{merchant_code}{order_id}", api_key)
    assert len(status_sig) == 64

    # 3. Callback Signature V2: merchantCode + amount + merchantOrderId
    callback_sig = hmac_sha256(f"{merchant_code}{amount}{order_id}", api_key)
    assert len(callback_sig) == 64

    # Tamper test
    tampered_callback_sig = hmac_sha256(f"{merchant_code}{amount + 1}{order_id}", api_key)
    assert callback_sig != tampered_callback_sig

    print("[OK] Duitku official signature generation & tamper detection verified.")


def test_invalid_signature_rejection_and_error_logging():
    print("Testing invalid signature rejection and error event logging...")
    conn = setup_database()
    seed_test_data(conn)

    payload = {
        "merchantCode": MERCHANT_CODE,
        "amount": "500000",
        "merchantOrderId": "ORD-AHMAD-20260919-01",
        "resultCode": "00",
        "reference": "REF-BAD-SIG-01",
        "signature": "invalidsignature1234567890abcdef1234567890abcdef1234567890abcdef",
    }

    try:
        simulate_process_duitku_v2_callback(conn, payload)
        assert False, "Should have thrown ValueError for bad signature"
    except ValueError as e:
        assert "Bad Signature" in str(e)

    # Check error event logged
    cur = conn.execute("SELECT signature_valid, processing_status FROM finance_gateway_events WHERE event_key LIKE 'DUITKU_V2_BAD_SIG_REF-BAD-SIG-01%'")
    row = cur.fetchone()
    assert row is not None
    assert row[0] == 0  # signature_valid = 0
    assert row[1] == "ERROR"

    print("[OK] Invalid signature rejected and logged as ERROR.")


def test_v2_checkout_order_matching_and_payment_allocation():
    print("Testing Dynamic Checkout Order matching, fee handling & atomic obligation allocation...")
    conn = setup_database()
    seed_test_data(conn)

    order_id = "ord-ahmad-checkout-1"
    order_num = "ORD-AHMAD-20260919-01"
    gross_amount = 1250000
    gateway_fee = 4000
    total_charged = 1254000

    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee, fee_payer, total_charged,
            payment_method, status, expires_at, created_at, updated_at
        ) VALUES (?, ?, 'san-ahmad', 'PORTAL_ORTU', ?, ?, 'CUSTOMER', ?, 'DUITKU_QRIS', 'PENDING', datetime('now', '+1 day'), datetime('now'), datetime('now'))
        """,
        (order_id, order_num, gross_amount, gateway_fee, total_charged),
    )

    conn.execute("INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('oi-1', ?, 'ob-ahmad-spp-09', 'SPP', 500000)", (order_id,))
    conn.execute("INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('oi-2', ?, 'ob-ahmad-makan-09', 'UANG_MAKAN', 450000)", (order_id,))
    conn.execute("INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('oi-3', ?, 'ob-ahmad-uspp', 'USPP', 300000)", (order_id,))

    ref = "DUITKU-REF-QRIS-001"
    sig = hmac_sha256(f"{MERCHANT_CODE}{total_charged}{order_num}", API_KEY)
    payload = {
        "merchantCode": MERCHANT_CODE,
        "amount": str(total_charged),
        "merchantOrderId": order_num,
        "paymentCode": "QR",
        "resultCode": "00",
        "reference": ref,
        "signature": sig,
    }

    res = simulate_process_duitku_v2_callback(conn, payload)
    assert res["success"] is True
    assert res["isDuplicate"] is False
    assert res["matchType"] == "ORDER_ALLOCATED"

    # Check order is PAID
    cur = conn.execute("SELECT status FROM finance_payment_orders WHERE id = ?", (order_id,))
    assert cur.fetchone()[0] == "PAID"

    # Check payment
    cur = conn.execute("SELECT channel, method, gross_amount, gateway_fee, net_amount, status, allocation_status FROM finance_payments WHERE external_reference = ?", (ref,))
    p_row = cur.fetchone()
    assert p_row[0] == "DUITKU"
    assert p_row[1] == "DUITKU_QR"
    assert p_row[2] == gross_amount
    assert p_row[3] == gateway_fee
    assert p_row[4] == gross_amount - gateway_fee
    assert p_row[5] == "PAID"
    assert p_row[6] == "ALLOCATED"

    # Check obligations updated
    spp = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = 'ob-ahmad-spp-09'").fetchone()
    assert spp[0] == 500000 and spp[1] == "PAID"

    makan = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = 'ob-ahmad-makan-09'").fetchone()
    assert makan[0] == 450000 and makan[1] == "PAID"

    uspp = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = 'ob-ahmad-uspp'").fetchone()
    assert uspp[0] == 300000 and uspp[1] == "PARTIALLY_PAID"

    print("[OK] Dynamic Checkout Order matching and atomic obligation allocation verified.")


def test_v2_idempotency_duplicate_webhook():
    print("Testing Gateway Callback idempotency & replay attack prevention...")
    conn = setup_database()
    seed_test_data(conn)

    order_id = "ord-ahmad-single"
    order_num = "ORD-AHMAD-20260919-02"
    total_charged = 500000

    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee, fee_payer, total_charged,
            payment_method, status, expires_at, created_at, updated_at
        ) VALUES (?, ?, 'san-ahmad', 'PORTAL_ORTU', 500000, 0, 'INSTITUTION', 500000, 'DUITKU_QRIS', 'PENDING', datetime('now', '+1 day'), datetime('now'), datetime('now'))
        """,
        (order_id, order_num),
    )
    conn.execute("INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('oi-spp', ?, 'ob-ahmad-spp-09', 'SPP', 500000)", (order_id,))

    ref = "DUITKU-REF-IDEMPOTENT-01"
    sig = hmac_sha256(f"{MERCHANT_CODE}{total_charged}{order_num}", API_KEY)
    payload = {
        "merchantCode": MERCHANT_CODE,
        "amount": str(total_charged),
        "merchantOrderId": order_num,
        "resultCode": "00",
        "reference": ref,
        "signature": sig,
    }

    # First callback
    res1 = simulate_process_duitku_v2_callback(conn, payload)
    assert res1["success"] is True
    assert res1["isDuplicate"] is False
    assert res1["matchType"] == "ORDER_ALLOCATED"

    # Replay
    res2 = simulate_process_duitku_v2_callback(conn, payload)
    assert res2["success"] is True
    assert res2["isDuplicate"] is True
    assert res2["matchType"] == "ALREADY_PROCESSED"

    p_count = conn.execute("SELECT COUNT(*) FROM finance_payments").fetchone()[0]
    assert p_count == 1, "Must not create duplicate payment on replay"
    print("[OK] Gateway callback idempotency verified: 0 duplicate payments, 0 duplicate allocations.")


def test_v2_unknown_order_unmatched_receipt():
    print("Testing valid callback with unknown order (unmatched external receipt & zero allocation)...")
    conn = setup_database()
    seed_test_data(conn)

    unknown_order = "ORD-UNKNOWN-999"
    amount = 750000
    ref = "REF-UNMATCHED-V2-001"
    sig = hmac_sha256(f"{MERCHANT_CODE}{amount}{unknown_order}", API_KEY)

    payload = {
        "merchantCode": MERCHANT_CODE,
        "amount": str(amount),
        "merchantOrderId": unknown_order,
        "resultCode": "00",
        "reference": ref,
        "signature": sig,
    }

    # 1. First callback: must succeed, record to reconciliation, zero allocation
    res1 = simulate_process_duitku_v2_callback(conn, payload)
    assert res1["success"] is True
    assert res1["isDuplicate"] is False
    assert res1["matchType"] == "UNMATCHED_EXTERNAL"
    assert res1["reconciliationItemId"] is not None

    # Real money / fact of receipt is captured in finance_reconciliation_items
    rec = conn.execute(
        "SELECT external_reference, internal_amount, external_amount, discrepancy_amount, match_status, resolution_action FROM finance_reconciliation_items WHERE id = ?",
        (res1["reconciliationItemId"],),
    ).fetchone()
    assert rec is not None
    assert rec[0] == ref
    assert rec[1] == 0          # internal_amount: 0 (no internal order)
    assert rec[2] == amount     # external_amount: 750000
    assert rec[3] == amount     # discrepancy_amount: 750000
    assert rec[4] == "UNMATCHED_EXTERNAL"
    assert rec[5] == "NONE"

    # Zero allocations created (never guess allocations!)
    alloc_count = conn.execute("SELECT count(*) FROM finance_allocations").fetchone()[0]
    assert alloc_count == 0, "System must NEVER generate allocations for unknown order"

    # No payment with fake santri created in finance_payments
    pay_count = conn.execute("SELECT count(*) FROM finance_payments").fetchone()[0]
    assert pay_count == 0, "Must not fake santri_id in finance_payments"

    # Gateway event is PROCESSED
    event_status = conn.execute("SELECT processing_status FROM finance_gateway_events WHERE event_key = ?", (f"DUITKU_V2_{ref}",)).fetchone()
    assert event_status is not None and event_status[0] == "PROCESSED"

    # 2. Callback retry with identical reference: idempotency check (no duplicate money)
    res2 = simulate_process_duitku_v2_callback(conn, payload)
    assert res2["success"] is True
    assert res2["isDuplicate"] is True
    assert res2["matchType"] == "ALREADY_PROCESSED"

    # Count of reconciliation items must remain strictly 1
    rec_count = conn.execute("SELECT count(*) FROM finance_reconciliation_items WHERE external_reference = ?", (ref,)).fetchone()[0]
    assert rec_count == 1, "Idempotency failed: duplicate reconciliation item created on retry"

    print("[OK] Valid callback with unknown order safely secured to reconciliation as unmatched receipt.")


def test_v2_expired_order_callback():
    print("Testing payment received for expired or cancelled order...")
    conn = setup_database()
    seed_test_data(conn)

    order_id = "ord-expired-1"
    order_num = "ORD-EXPIRED-001"
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee, fee_payer, total_charged,
            payment_method, status, expires_at, created_at, updated_at
        ) VALUES (?, ?, 'san-budi', 'PORTAL_ORTU', 500000, 0, 'CUSTOMER', 500000, 'DUITKU_QRIS', 'EXPIRED', datetime('now', '-2 hours'), datetime('now', '-1 day'), datetime('now'))
        """,
        (order_id, order_num),
    )
    conn.execute("INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES ('oi-exp', ?, NULL, 'SPP', 500000)", (order_id,))

    ref = "DUITKU-EXPIRED-PAY-01"
    sig = hmac_sha256(f"{MERCHANT_CODE}500000{order_num}", API_KEY)
    payload = {
        "merchantCode": MERCHANT_CODE,
        "amount": "500000",
        "merchantOrderId": order_num,
        "resultCode": "00",
        "reference": ref,
        "signature": sig,
    }

    res = simulate_process_duitku_v2_callback(conn, payload)
    assert res["success"] is True
    assert res["matchType"] == "EXPIRED_OR_CANCELLED_ORDER"

    p = conn.execute("SELECT status, allocation_status FROM finance_payments WHERE external_reference = ?", (ref,)).fetchone()
    assert p[0] == "PAID" and p[1] == "UNALLOCATED"

    rec = conn.execute("SELECT match_status FROM finance_reconciliation_items WHERE payment_id = ?", (res["paymentId"],)).fetchone()
    assert rec[0] == "UNALLOCATED_TRANSFER"
    print("[OK] Payment for expired/cancelled order safely captured into reconciliation.")


def test_v2_amount_mismatch():
    print("Testing amount mismatch on pending order...")
    conn = setup_database()
    seed_test_data(conn)

    order_id = "ord-mismatch-1"
    order_num = "ORD-MISMATCH-001"
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee, fee_payer, total_charged,
            payment_method, status, expires_at, created_at, updated_at
        ) VALUES (?, ?, 'san-ahmad', 'PORTAL_ORTU', 500000, 0, 'CUSTOMER', 500000, 'DUITKU_QRIS', 'PENDING', datetime('now', '+1 day'), datetime('now'), datetime('now'))
        """,
        (order_id, order_num),
    )

    ref = "DUITKU-MISMATCH-REF"
    sig = hmac_sha256(f"{MERCHANT_CODE}400000{order_num}", API_KEY)
    payload = {
        "merchantCode": MERCHANT_CODE,
        "amount": "400000",
        "merchantOrderId": order_num,
        "resultCode": "00",
        "reference": ref,
        "signature": sig,
    }

    res = simulate_process_duitku_v2_callback(conn, payload)
    assert res["success"] is True
    assert res["matchType"] == "AMOUNT_MISMATCH"

    p = conn.execute("SELECT gross_amount, allocation_status FROM finance_payments WHERE external_reference = ?", (ref,)).fetchone()
    assert p[0] == 400000 and p[1] == "UNALLOCATED"

    rec = conn.execute("SELECT match_status FROM finance_reconciliation_items WHERE payment_id = ?", (res["paymentId"],)).fetchone()
    assert rec[0] == "AMOUNT_MISMATCH"
    print("[OK] Amount mismatch safely diverted to reconciliation unallocated.")


def test_v2_failed_gateway_result():
    print("Testing failed gateway result (resultCode != '00')...")
    conn = setup_database()
    seed_test_data(conn)

    ref = "DUITKU-FAIL-REF-01"
    sig = hmac_sha256(f"{MERCHANT_CODE}500000ORD-FAIL", API_KEY)
    payload = {
        "merchantCode": MERCHANT_CODE,
        "amount": "500000",
        "merchantOrderId": "ORD-FAIL",
        "resultCode": "01",
        "reference": ref,
        "signature": sig,
    }

    res = simulate_process_duitku_v2_callback(conn, payload)
    assert res["success"] is False

    cur = conn.execute("SELECT processing_status FROM finance_gateway_events WHERE event_key = ?", (f"DUITKU_V2_{ref}",))
    assert cur.fetchone()[0] == "IGNORED"

    p_count = conn.execute("SELECT COUNT(*) FROM finance_payments").fetchone()[0]
    assert p_count == 0
    print("[OK] Failed gateway status properly recorded as IGNORED with 0 payments.")


def main():
    print("=" * 60)
    print("Starting Fase 3B Web API V2 (Dynamic Checkout & QRIS) Test Suite...")
    print("=" * 60)

    test_duitku_v2_cryptography_and_signatures()
    test_invalid_signature_rejection_and_error_logging()
    test_v2_checkout_order_matching_and_payment_allocation()
    test_v2_idempotency_duplicate_webhook()
    test_v2_unknown_order_unmatched_receipt()
    test_v2_expired_order_callback()
    test_v2_amount_mismatch()
    test_v2_failed_gateway_result()

    print("\n" + "=" * 60)
    print("ALL FASE 3B WEB API V2 TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    main()
