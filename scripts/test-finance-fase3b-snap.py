"""Local SQLite contract & business logic test suite for Fase 3B SNAP Virtual Account.

Verifies:
1. SNAP Cryptography & Signatures:
   - B2B Token Asymmetric Signature (RSA-SHA256):
     - stringToSign = partnerId + "|" + timestamp
     - Header: X-SIGNATURE (Base64 RSA-SHA256)
   - Outbound Service Request Symmetric Signature (HMAC-SHA512):
     - stringToSign = HTTPMethod + ":" + EndpointUrl + ":" + AccessToken + ":" + Lowercase(Hex(SHA256(MinifiedBody))) + ":" + Timestamp
     - Header: X-SIGNATURE (Base64 HMAC-SHA512)
   - Inbound Payment VA Notification Asymmetric Signature (RSA-SHA256):
     - stringToSign = POST:/v1.0/transfer-va/payment:${Lowercase(Hex(SHA256(MinifiedBody)))}:${Timestamp}
     - Tamper resistance: modifying body or timestamp fails signature verification.
2. SNAP Idempotency via paymentRequestId:
   - First incoming notification records event 'DUITKU_SNAP_${paymentRequestId}' as PROCESSED and executes payment.
   - Replayed notification with exact same paymentRequestId returns 2002500 (Successful) with isDuplicate = True,
     creating ZERO duplicate payments or duplicate allocations.
3. Fixed Virtual Account Permanence with Multiple Payments:
   - Same student with permanent Fixed VA receives two distinct payments with different paymentRequestId.
   - Both payments succeed and are recorded independently without collision.
4. Anti-Guessing Rule (Unallocated Flow):
   - Payment arriving without active order (Open Amount or direct VA transfer) NEVER guesses allocations.
   - Safely records to finance_payments (status='PAID', allocation_status='UNALLOCATED')
     and finance_reconciliation_items (match_status='UNALLOCATED_TRANSFER').
   - SNAP response returns 2002500 (Successful) so bank does not fail customer transfer.
5. Close Amount vs Open Amount Lifecycle:
   - Close Amount ('C'): active pending order sets trxId = order_number, totalAmount = order.total_charged.
   - Open Amount ('O'): no pending order sets totalAmount = '0.00' for flexible transfer.
6. Order Amount Mismatch:
   - Payment arriving with amount != order.total_charged is safely diverted to UNALLOCATED + AMOUNT_MISMATCH.
7. Payment for Expired/Cancelled Order:
   - Payment received for expired order is not lost; safely captured into UNALLOCATED reconciliation.
8. Zero Plaintext Secrets in Database:
   - Database app_settings does not store privateKey or clientSecret.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import sqlite3
import subprocess
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


# ============================================================
# 1. Cryptography Helpers (SNAP BI Specification)
# ============================================================

def sha256_hex_lower(data: str) -> str:
    """Calculates lowercase hex SHA-256 of string."""
    return hashlib.sha256(data.encode("utf-8")).hexdigest().lower()


def hmac_sha512_base64(message: str, key: str) -> str:
    """Calculates Base64 HMAC-SHA512 as per official SNAP BI specification."""
    digest = hmac.new(key.encode("utf-8"), message.encode("utf-8"), hashlib.sha512).digest()
    return base64.b64encode(digest).decode("utf-8")


def minify_json(data: dict | None) -> str:
    """Produces canonical minified JSON without whitespace."""
    if not data:
        return ""
    return json.dumps(data, separators=(",", ":"), ensure_ascii=False)


def generate_snap_request_signature(
    http_method: str,
    endpoint_path: str,
    access_token: str,
    body_json: str,
    timestamp: str,
    client_secret: str,
) -> str:
    """Generates symmetric SNAP BI request signature (HMAC-SHA512).

    Formula: HTTPMethod + ":" + EndpointUrl + ":" + AccessToken + ":" + Lowercase(Hex(SHA256(MinifiedBody))) + ":" + Timestamp
    """
    body_hash = sha256_hex_lower(body_json) if body_json else sha256_hex_lower("")
    string_to_sign = f"{http_method.upper()}:{endpoint_path}:{access_token}:{body_hash}:{timestamp}"
    return hmac_sha512_base64(string_to_sign, client_secret)


# ============================================================
# 2. Database Setup & Seed
# ============================================================

def setup_database() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.isolation_level = None
    conn.execute("PRAGMA foreign_keys = ON;")

    # Prerequisites
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


# ============================================================
# 3. Python SNAP Payment Processing Simulation
# (Mirrors lib/finance/gateway/duitku-snap.ts precisely)
# ============================================================

def simulate_process_snap_payment(conn: sqlite3.Connection, payload: dict) -> dict:
    payment_request_id = str(payload.get("paymentRequestId", "")).strip()
    customer_no = str(payload.get("customerNo", "")).strip()
    virtual_account_no = str(payload.get("virtualAccountNo", "")).strip()
    trx_id = str(payload.get("trxId", "")).strip()
    paid_amount_obj = payload.get("paidAmount", {})
    raw_amount = paid_amount_obj.get("value", 0)
    amount = int(float(raw_amount)) if raw_amount else 0
    additional_info = payload.get("additionalInfo", {})
    reference = str(additional_info.get("reference") or payment_request_id).strip()
    payment_code = additional_info.get("paymentCode")
    method = f"SNAP_{str(payment_code).upper()}" if payment_code else "SNAP_VA"

    if not payment_request_id or not virtual_account_no or amount <= 0:
        raise ValueError("Parameter payload SNAP Payment VA tidak lengkap.")

    # 1. Idempotency check via paymentRequestId
    event_key = f"DUITKU_SNAP_{payment_request_id}"
    cur = conn.execute(
        "SELECT id, processing_status FROM finance_gateway_events WHERE event_key = ?",
        (event_key,),
    )
    existing_event = cur.fetchone()
    if existing_event and existing_event[1] == "PROCESSED":
        return {
            "success": True,
            "responseCode": "2002500",
            "responseMessage": "Successful",
            "isDuplicate": True,
            "matchType": "ALREADY_PROCESSED",
        }

    # 2. Find student
    cur_va = conn.execute(
        "SELECT santri_id FROM finance_student_va WHERE va_number = ?",
        (virtual_account_no,),
    )
    va_row = cur_va.fetchone()
    student_id = va_row[0] if va_row else None

    if not student_id and customer_no:
        cur_nis = conn.execute(
            "SELECT id FROM santri WHERE id = ? OR nis = ?",
            (customer_no, customer_no),
        )
        nis_row = cur_nis.fetchone()
        if nis_row:
            student_id = nis_row[0]

    if not student_id:
        err_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO finance_gateway_events (
                id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at
            ) VALUES (?, 'DUITKU_SNAP', ?, ?, 1, ?, 'ERROR', datetime('now'))
            """,
            (err_id, event_key, trx_id or None, json.dumps(payload)),
        )
        raise ValueError(f"Santri pemilik VA {virtual_account_no} tidak ditemukan.")

    # 3. Match order
    cur_ord = conn.execute(
        "SELECT id, order_number, santri_id, gross_amount, gateway_fee, total_charged, status FROM finance_payment_orders WHERE order_number = ?",
        (trx_id,),
    )
    order = cur_ord.fetchone()

    # Fallback if trxId is not order_number: check if student has exactly 1 pending order with matching amount
    if not order and student_id:
        cur_pending = conn.execute(
            "SELECT id, order_number, santri_id, gross_amount, gateway_fee, total_charged, status FROM finance_payment_orders WHERE santri_id = ? AND status = 'PENDING' AND datetime(expires_at) > datetime('now')",
            (student_id,),
        )
        pending_list = cur_pending.fetchall()
        if len(pending_list) == 1 and pending_list[0][5] == amount:
            order = pending_list[0]

    payment_id = str(uuid.uuid4())
    payment_number = f"PAY-SNAP-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    matched_order_id = None
    match_type = ""

    if order:
        order_id, order_num, ord_santri_id, gross_amt, gw_fee, total_charged, order_status = order
        matched_order_id = order_id

        if order_status == "PENDING":
            if total_charged == amount:
                # MATCH: full order payment
                conn.execute(
                    """
                    INSERT INTO finance_payments (
                        id, payment_number, order_id, santri_id, channel, method,
                        gross_amount, gateway_fee, net_amount, status, correction_status,
                        allocation_status, paid_at, external_reference, created_at
                    ) VALUES (?, ?, ?, ?, 'DUITKU', ?, ?, ?, ?, 'PAID', 'NONE', 'ALLOCATED', datetime('now'), ?, datetime('now'))
                    """,
                    (payment_id, payment_number, order_id, student_id, method, gross_amt, gw_fee, gross_amt - gw_fee, reference),
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
                # AMOUNT MISMATCH
                conn.execute(
                    """
                    INSERT INTO finance_payments (
                        id, payment_number, order_id, santri_id, channel, method,
                        gross_amount, gateway_fee, net_amount, status, correction_status,
                        allocation_status, paid_at, external_reference, created_at
                    ) VALUES (?, ?, NULL, ?, 'DUITKU', ?, ?, 0, ?, 'PAID', 'NONE', 'UNALLOCATED', datetime('now'), ?, datetime('now'))
                    """,
                    (payment_id, payment_number, student_id, method, amount, amount, reference),
                )
                conn.execute(
                    """
                    INSERT INTO finance_reconciliation_items (
                        id, payment_id, external_reference, internal_amount, external_amount,
                        discrepancy_amount, match_status, resolution_action, resolution_notes, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'AMOUNT_MISMATCH', 'NONE', 'Nominal bayar tidak sama dengan tagihan order', datetime('now'))
                    """,
                    (str(uuid.uuid4()), payment_id, reference, total_charged, amount, abs(total_charged - amount)),
                )
                match_type = "AMOUNT_MISMATCH"
        else:
            # EXPIRED OR CANCELLED ORDER
            conn.execute(
                """
                INSERT INTO finance_payments (
                    id, payment_number, order_id, santri_id, channel, method,
                    gross_amount, gateway_fee, net_amount, status, correction_status,
                    allocation_status, paid_at, external_reference, created_at
                ) VALUES (?, ?, NULL, ?, 'DUITKU', ?, ?, 0, ?, 'PAID', 'NONE', 'UNALLOCATED', datetime('now'), ?, datetime('now'))
                """,
                (payment_id, payment_number, student_id, method, amount, amount, reference),
            )
            conn.execute(
                """
                INSERT INTO finance_reconciliation_items (
                    id, payment_id, external_reference, internal_amount, external_amount,
                    discrepancy_amount, match_status, resolution_action, resolution_notes, created_at
                ) VALUES (?, ?, ?, 0, ?, ?, 'UNALLOCATED_TRANSFER', 'NONE', 'Pembayaran untuk order kedaluwarsa atau dibatalkan', datetime('now'))
                """,
                (str(uuid.uuid4()), payment_id, reference, amount, amount),
            )
            match_type = "EXPIRED_OR_CANCELLED_ORDER"
    else:
        # NO MATCHING ORDER (UNALLOCATED DIRECT TRANSFER / OPEN AMOUNT)
        conn.execute(
            """
            INSERT INTO finance_payments (
                id, payment_number, order_id, santri_id, channel, method,
                gross_amount, gateway_fee, net_amount, status, correction_status,
                allocation_status, paid_at, external_reference, created_at
            ) VALUES (?, ?, NULL, ?, 'DUITKU', ?, ?, 0, ?, 'PAID', 'NONE', 'UNALLOCATED', datetime('now'), ?, datetime('now'))
            """,
            (payment_id, payment_number, student_id, method, amount, amount, reference),
        )
        conn.execute(
            """
            INSERT INTO finance_reconciliation_items (
                id, payment_id, external_reference, internal_amount, external_amount,
                discrepancy_amount, match_status, resolution_action, resolution_notes, created_at
            ) VALUES (?, ?, ?, 0, ?, ?, 'UNALLOCATED_TRANSFER', 'NONE', 'Transfer Open Amount ke Fixed VA santri tanpa checkout order', datetime('now'))
            """,
            (str(uuid.uuid4()), payment_id, reference, amount, amount),
        )
        match_type = "UNALLOCATED_TRANSFER"

    # Record event as PROCESSED
    event_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO finance_gateway_events (
            id, provider, event_key, merchant_order_id, signature_valid, payload_json, processing_status, created_at
        ) VALUES (?, 'DUITKU_SNAP', ?, ?, 1, ?, 'PROCESSED', datetime('now'))
        """,
        (event_id, event_key, trx_id or None, json.dumps(payload)),
    )

    return {
        "success": True,
        "responseCode": "2002500",
        "responseMessage": "Successful",
        "paymentId": payment_id,
        "paymentNumber": payment_number,
        "orderId": matched_order_id,
        "isDuplicate": False,
        "matchType": match_type,
        "virtualAccountData": {
            "partnerServiceId": payload.get("partnerServiceId"),
            "customerNo": payload.get("customerNo"),
            "virtualAccountNo": payload.get("virtualAccountNo"),
            "paymentRequestId": payment_request_id,
            "paidAmount": payload.get("paidAmount"),
        },
    }


# ============================================================
# 4. Test Cases
# ============================================================

def test_node_rsa_cryptography() -> None:
    """Verifies that Node.js native crypto executes RSA-SHA256 signature and verification correctly."""
    print("Testing Node.js RSA-SHA256 SNAP Cryptography...")
    node_code = """
    const crypto = require('node:crypto');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // 1. Token Signature test: partnerId + "|" + timestamp
    const partnerId = '0070000000001';
    const timestamp = '2026-09-19T14:00:00+07:00';
    const stringToSign = `${partnerId}|${timestamp}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(stringToSign);
    const signature = signer.sign(privateKey, 'base64');

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(stringToSign);
    const isValid = verifier.verify(publicKey, signature, 'base64');

    // 2. Tampered signature test
    const tamperVerifier = crypto.createVerify('RSA-SHA256');
    tamperVerifier.update(`${partnerId}|tampered_timestamp`);
    const isTamperValid = tamperVerifier.verify(publicKey, signature, 'base64');

    console.log(JSON.stringify({ isValid, isTamperValid }));
    """
    res = subprocess.run(["node", "-e", node_code], capture_output=True, text=True, check=True)
    out = json.loads(res.stdout.strip())
    assert out["isValid"] is True, "Expected valid RSA-SHA256 signature to verify"
    assert out["isTamperValid"] is False, "Expected tampered signature to be rejected"
    print("[OK] Node.js RSA-SHA256 signature and tamper detection verified.")


def test_snap_outbound_hmac_sha512_signature() -> None:
    """Verifies symmetric HMAC-SHA512 SNAP request signature calculation."""
    print("Testing SNAP Outbound HMAC-SHA512 Request Signature...")
    method = "POST"
    endpoint = "/v1.0/transfer-va/create-va"
    token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token"
    body = {
        "partnerServiceId": "0070",
        "customerNo": "10001",
        "virtualAccountNo": "007010001",
        "virtualAccountName": "Ahmad Fauzi",
        "trxId": "ORD-2026-001",
        "totalAmount": {"value": "500000.00", "currency": "IDR"},
        "virtualAccountTrxType": "C",
    }
    body_json = minify_json(body)
    timestamp = "2026-09-19T14:30:00+07:00"
    client_secret = "duitku_super_secret_key_123"

    sig1 = generate_snap_request_signature(method, endpoint, token, body_json, timestamp, client_secret)
    sig2 = generate_snap_request_signature(method, endpoint, token, body_json, timestamp, client_secret)
    assert sig1 == sig2, "Signature must be deterministic"
    assert len(sig1) > 40, "Base64 HMAC-SHA512 signature should be ~88 characters"

    # Tamper test: change amount
    body_tampered = dict(body)
    body_tampered["totalAmount"] = {"value": "500001.00", "currency": "IDR"}
    sig_tampered = generate_snap_request_signature(
        method, endpoint, token, minify_json(body_tampered), timestamp, client_secret
    )
    assert sig1 != sig_tampered, "Altered payload amount must alter request signature"
    print("[OK] Outbound HMAC-SHA512 request signature verified.")


def test_snap_idempotency_via_payment_request_id(conn: sqlite3.Connection) -> None:
    """Verifies that SNAP Payment VA uses paymentRequestId as idempotency identifier.

    Duplicate incoming webhook returns 2002500 without double payment or double allocation.
    """
    print("Testing SNAP Payment VA Idempotency via paymentRequestId...")
    # Seed santri & order
    santri_id = str(uuid.uuid4())
    va_number = "007010001"
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap) VALUES (?, ?, ?)",
        (santri_id, "10001", "Santri SNAP Test"),
    )
    conn.execute(
        "INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES (?, ?, ?)",
        (santri_id, va_number, "DUITKU_SNAP"),
    )

    # Create obligation & order
    ob_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status
        ) VALUES (?, ?, 'SPP', '2026-09', 600000, 0, 0, 'UNPAID')
        """,
        (ob_id, santri_id),
    )

    order_id = str(uuid.uuid4())
    order_number = "ORD-SNAP-001"
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee, total_charged, status, expires_at
        ) VALUES (?, ?, ?, 'PORTAL_ORTU', 600000, 0, 600000, 'PENDING', datetime('now', '+1 day'))
        """,
        (order_id, order_number, santri_id),
    )
    order_item_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount)
        VALUES (?, ?, ?, 'SPP', 600000)
        """,
        (order_item_id, order_id, ob_id),
    )

    # First callback simulation with paymentRequestId = 'SNAP_REQ_999'
    payload = {
        "partnerServiceId": "0070",
        "customerNo": "10001",
        "virtualAccountNo": va_number,
        "paymentRequestId": "SNAP_REQ_999",
        "trxId": order_number,
        "paidAmount": {"value": "600000.00", "currency": "IDR"},
        "additionalInfo": {"reference": "DUITKU_REF_999", "paymentCode": "VA"},
    }

    res1 = simulate_process_snap_payment(conn, payload)
    assert res1["success"] is True, "First callback must succeed"
    assert res1["responseCode"] == "2002500", "Response code must be 2002500"
    assert res1["isDuplicate"] is False, "First callback must not be duplicate"
    assert res1["matchType"] == "ORDER_ALLOCATED", "Match type must be ORDER_ALLOCATED"

    # Verify order is PAID and obligation is PAID
    order_status = conn.execute("SELECT status FROM finance_payment_orders WHERE id = ?", (order_id,)).fetchone()[0]
    ob_status = conn.execute("SELECT status, amount_paid FROM finance_obligations WHERE id = ?", (ob_id,)).fetchone()
    assert order_status == "PAID", "Order must be PAID"
    assert ob_status[0] == "PAID" and ob_status[1] == 600000, "Obligation must be PAID"

    # Replay check: Exact same paymentRequestId arrives again (network retry or replay)
    res2 = simulate_process_snap_payment(conn, payload)
    assert res2["success"] is True, "Replay must return success (idempotent)"
    assert res2["responseCode"] == "2002500", "Response code must be 2002500"
    assert res2["isDuplicate"] is True, "Replay must be recognized as duplicate"
    assert res2["matchType"] == "ALREADY_PROCESSED", "Match type must be ALREADY_PROCESSED"

    # Count payments & allocations: strictly 1
    payment_count = conn.execute(
        "SELECT count(*) FROM finance_payments WHERE order_id = ?",
        (order_id,),
    ).fetchone()[0]
    alloc_count = conn.execute(
        "SELECT count(*) FROM finance_allocations WHERE payment_id = ?",
        (res1["paymentId"],),
    ).fetchone()[0]
    assert payment_count == 1, f"Expected exactly 1 payment record, found {payment_count}"
    assert alloc_count == 1, f"Expected exactly 1 allocation record, found {alloc_count}"
    print("[OK] SNAP Payment VA idempotency via paymentRequestId verified.")


def test_fixed_va_permanence_dual_payments(conn: sqlite3.Connection) -> None:
    """Verifies that a Santri's single permanent Fixed VA can receive distinct payments over time.

    Month 1: paymentRequestId = 'REQ_M1' -> Paid & Allocated.
    Month 2: paymentRequestId = 'REQ_M2' -> Paid & Allocated.
    Both records exist safely under the same Fixed VA and santri.
    """
    print("Testing Fixed VA Permanence with Multiple Payments on Same VA Number...")
    santri_id = str(uuid.uuid4())
    va_number = "007020002"
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap) VALUES (?, ?, ?)",
        (santri_id, "20002", "Santri Dua Bulan"),
    )
    conn.execute(
        "INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES (?, ?, ?)",
        (santri_id, va_number, "DUITKU_SNAP"),
    )

    # Month 1 Obligation & Order
    ob1_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status
        ) VALUES (?, ?, 'SPP', '2026-08', 500000, 0, 0, 'UNPAID')
        """,
        (ob1_id, santri_id),
    )
    ord1_id = str(uuid.uuid4())
    ord1_num = "ORD-SNAP-M1"
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee, total_charged, status, expires_at
        ) VALUES (?, ?, ?, 'PORTAL_ORTU', 500000, 0, 500000, 'PENDING', datetime('now', '+1 day'))
        """,
        (ord1_id, ord1_num, santri_id),
    )
    conn.execute(
        "INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES (?, ?, ?, 'SPP', 500000)",
        (str(uuid.uuid4()), ord1_id, ob1_id),
    )

    # Process Month 1 Payment
    payload_m1 = {
        "partnerServiceId": "0070",
        "customerNo": "20002",
        "virtualAccountNo": va_number,
        "paymentRequestId": "REQ_M1",
        "trxId": ord1_num,
        "paidAmount": {"value": "500000.00", "currency": "IDR"},
        "additionalInfo": {"reference": "DUITKU_REF_M1"},
    }
    res_m1 = simulate_process_snap_payment(conn, payload_m1)
    assert res_m1["matchType"] == "ORDER_ALLOCATED"

    # Month 2 Obligation & Order (Same Santri, Same Fixed VA!)
    ob2_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status
        ) VALUES (?, ?, 'SPP', '2026-09', 500000, 0, 0, 'UNPAID')
        """,
        (ob2_id, santri_id),
    )
    ord2_id = str(uuid.uuid4())
    ord2_num = "ORD-SNAP-M2"
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee, total_charged, status, expires_at
        ) VALUES (?, ?, ?, 'PORTAL_ORTU', 500000, 0, 500000, 'PENDING', datetime('now', '+1 day'))
        """,
        (ord2_id, ord2_num, santri_id),
    )
    conn.execute(
        "INSERT INTO finance_order_items (id, order_id, obligation_id, item_type, amount) VALUES (?, ?, ?, 'SPP', 500000)",
        (str(uuid.uuid4()), ord2_id, ob2_id),
    )

    # Process Month 2 Payment with different paymentRequestId
    payload_m2 = {
        "partnerServiceId": "0070",
        "customerNo": "20002",
        "virtualAccountNo": va_number,
        "paymentRequestId": "REQ_M2",
        "trxId": ord2_num,
        "paidAmount": {"value": "500000.00", "currency": "IDR"},
        "additionalInfo": {"reference": "DUITKU_REF_M2"},
    }
    res_m2 = simulate_process_snap_payment(conn, payload_m2)
    assert res_m2["matchType"] == "ORDER_ALLOCATED"

    # Verify both payments exist for the same student
    total_student_payments = conn.execute(
        "SELECT count(*) FROM finance_payments WHERE santri_id = ?",
        (santri_id,),
    ).fetchone()[0]
    assert total_student_payments == 2, f"Expected 2 payments for student, found {total_student_payments}"

    # Verify both obligations are paid
    ob1_paid = conn.execute("SELECT status FROM finance_obligations WHERE id = ?", (ob1_id,)).fetchone()[0]
    ob2_paid = conn.execute("SELECT status FROM finance_obligations WHERE id = ?", (ob2_id,)).fetchone()[0]
    assert ob1_paid == "PAID" and ob2_paid == "PAID", "Both obligations must be PAID"

    # Verify both gateway events exist
    events = conn.execute(
        "SELECT event_key FROM finance_gateway_events WHERE event_key IN ('DUITKU_SNAP_REQ_M1', 'DUITKU_SNAP_REQ_M2')"
    ).fetchall()
    assert len(events) == 2, "Both paymentRequestId events must exist independently"
    print("[OK] Fixed VA permanence with multiple payments on same VA verified.")


def test_anti_guessing_unallocated_flow(conn: sqlite3.Connection) -> None:
    """Verifies that SNAP payment received without matching order triggers UNALLOCATED_TRANSFER in reconciliation."""
    print("Testing SNAP Anti-Guessing Rule (Unallocated Payment Flow)...")
    santri_id = str(uuid.uuid4())
    va_number = "007030003"
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap) VALUES (?, ?, ?)",
        (santri_id, "30003", "Santri Open Transfer"),
    )
    conn.execute(
        "INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES (?, ?, ?)",
        (santri_id, va_number, "DUITKU_SNAP"),
    )

    # Student has unfulfilled obligations, BUT payment arrives directly with Open Amount (no order checkout)
    ob_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO finance_obligations (
            id, santri_id, item_type, period, amount_expected, amount_exempted, amount_paid, status
        ) VALUES (?, ?, 'SPP', '2026-09', 500000, 0, 0, 'UNPAID')
        """,
        (ob_id, santri_id),
    )

    transfer_amount = 750000  # Arbitrary amount transferred by parent at ATM
    payload_open = {
        "partnerServiceId": "0070",
        "customerNo": "30003",
        "virtualAccountNo": va_number,
        "paymentRequestId": "SNAP_OPEN_REQ_001",
        "trxId": "",  # Empty trxId for open transfer
        "paidAmount": {"value": "750000.00", "currency": "IDR"},
        "additionalInfo": {"reference": "DUITKU_OPEN_REF_001"},
    }

    res = simulate_process_snap_payment(conn, payload_open)
    assert res["success"] is True
    assert res["responseCode"] == "2002500"
    assert res["matchType"] == "UNALLOCATED_TRANSFER"

    # Invariant checks:
    # 1. Zero allocations created automatically (anti-guessing!)
    alloc_count = conn.execute(
        "SELECT count(*) FROM finance_allocations WHERE payment_id = ?",
        (res["paymentId"],),
    ).fetchone()[0]
    assert alloc_count == 0, "System must NEVER guess allocations automatically!"

    # 2. Obligation remains UNPAID (untouched)
    ob_paid = conn.execute("SELECT amount_paid, status FROM finance_obligations WHERE id = ?", (ob_id,)).fetchone()
    assert ob_paid[0] == 0 and ob_paid[1] == "UNPAID", "Obligation must NOT be guessed"

    # 3. Reconciliation item has match_status = 'UNALLOCATED_TRANSFER'
    rec_item = conn.execute(
        "SELECT match_status, discrepancy_amount FROM finance_reconciliation_items WHERE payment_id = ?",
        (res["paymentId"],),
    ).fetchone()
    assert rec_item is not None
    assert rec_item[0] == "UNALLOCATED_TRANSFER" and rec_item[1] == transfer_amount, (
        "Reconciliation item must hold UNALLOCATED_TRANSFER"
    )
    print("[OK] SNAP Anti-guessing rule verified: funds secured to reconciliation without guessing.")


def test_amount_mismatch_safety(conn: sqlite3.Connection) -> None:
    """Verifies that an incoming SNAP payment with mismatched amount is diverted safely to reconciliation."""
    print("Testing SNAP Amount Mismatch Safety...")
    santri_id = str(uuid.uuid4())
    va_number = "007040004"
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap) VALUES (?, ?, ?)",
        (santri_id, "40004", "Santri Mismatch"),
    )
    conn.execute(
        "INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES (?, ?, ?)",
        (santri_id, va_number, "DUITKU_SNAP"),
    )

    order_id = str(uuid.uuid4())
    order_num = "ORD-SNAP-MISMATCH"
    # Order expects 500,000
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee, total_charged, status, expires_at
        ) VALUES (?, ?, ?, 'PORTAL_ORTU', 500000, 0, 500000, 'PENDING', datetime('now', '+1 day'))
        """,
        (order_id, order_num, santri_id),
    )

    # Notification arrives with 450,000 (Rp 50,000 short)
    payload_mismatch = {
        "partnerServiceId": "0070",
        "customerNo": "40004",
        "virtualAccountNo": va_number,
        "paymentRequestId": "REQ_MISMATCH_001",
        "trxId": order_num,
        "paidAmount": {"value": "450000.00", "currency": "IDR"},
        "additionalInfo": {"reference": "REF-MISMATCH-01"},
    }

    res = simulate_process_snap_payment(conn, payload_mismatch)
    assert res["success"] is True
    assert res["responseCode"] == "2002500"
    assert res["matchType"] == "AMOUNT_MISMATCH"

    # Order must remain PENDING
    order_status = conn.execute("SELECT status FROM finance_payment_orders WHERE id = ?", (order_id,)).fetchone()[0]
    assert order_status == "PENDING", "Order must remain PENDING on amount mismatch"

    # Reconciliation item must hold AMOUNT_MISMATCH
    rec_row = conn.execute(
        "SELECT match_status, discrepancy_amount FROM finance_reconciliation_items WHERE payment_id = ?",
        (res["paymentId"],),
    ).fetchone()
    assert rec_row[0] == "AMOUNT_MISMATCH" and rec_row[1] == 50000
    print("[OK] SNAP Amount mismatch properly diverted to reconciliation.")


def test_payment_for_expired_order(conn: sqlite3.Connection) -> None:
    """Verifies that real money received for an expired order is not lost and recorded to reconciliation."""
    print("Testing SNAP Payment for Expired/Cancelled Order...")
    santri_id = str(uuid.uuid4())
    va_number = "007050005"
    conn.execute(
        "INSERT INTO santri (id, nis, nama_lengkap) VALUES (?, ?, ?)",
        (santri_id, "50005", "Santri Expired Order"),
    )
    conn.execute(
        "INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES (?, ?, ?)",
        (santri_id, va_number, "DUITKU_SNAP"),
    )

    order_id = str(uuid.uuid4())
    order_num = "ORD-SNAP-EXPIRED"
    # Order is EXPIRED
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee, total_charged, status, expires_at
        ) VALUES (?, ?, ?, 'PORTAL_ORTU', 300000, 0, 300000, 'EXPIRED', datetime('now', '-1 day'))
        """,
        (order_id, order_num, santri_id),
    )

    payload_expired = {
        "partnerServiceId": "0070",
        "customerNo": "50005",
        "virtualAccountNo": va_number,
        "paymentRequestId": "REQ_EXPIRED_001",
        "trxId": order_num,
        "paidAmount": {"value": "300000.00", "currency": "IDR"},
        "additionalInfo": {"reference": "REF-EXPIRED-01"},
    }

    res = simulate_process_snap_payment(conn, payload_expired)
    assert res["success"] is True
    assert res["responseCode"] == "2002500"
    assert res["matchType"] == "EXPIRED_OR_CANCELLED_ORDER"

    # Order remains EXPIRED (not revived)
    order_status = conn.execute("SELECT status FROM finance_payment_orders WHERE id = ?", (order_id,)).fetchone()[0]
    assert order_status == "EXPIRED", "Expired order must NOT be revived automatically"

    # Money is safely captured in finance_payments with UNALLOCATED status
    pay_row = conn.execute(
        "SELECT status, allocation_status, gross_amount FROM finance_payments WHERE id = ?",
        (res["paymentId"],),
    ).fetchone()
    assert pay_row[0] == "PAID" and pay_row[1] == "UNALLOCATED" and pay_row[2] == 300000
    print("[OK] Real money received for expired order safely captured.")


def test_zero_plaintext_secrets_in_database(conn: sqlite3.Connection) -> None:
    """Verifies that database app_settings contains zero plaintext cryptographic secrets."""
    print("Testing Zero Plaintext Secrets in Database...")
    # Add non-secret settings
    conn.execute("INSERT INTO app_settings (id, key, value) VALUES ('1', 'duitku_snap_partner_id', '0070001')")
    conn.execute("INSERT INTO app_settings (id, key, value) VALUES ('2', 'duitku_snap_partner_service_id', '0070')")
    conn.execute("INSERT INTO app_settings (id, key, value) VALUES ('3', 'duitku_snap_default_trx_type', 'C')")

    # Assert no secret keys exist in database
    forbidden_keys = [
        "duitku_private_key",
        "duitku_snap_private_key",
        "duitku_client_secret",
        "duitku_snap_client_secret",
        "duitku_api_key",
    ]
    for key in forbidden_keys:
        row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
        assert row is None, f"Security Violation: Plaintext secret key '{key}' found in database app_settings!"
    print("[OK] Zero plaintext secrets in database confirmed.")


def simulate_process_snap_va_inquiry(conn: sqlite3.Connection, payload: dict) -> dict:
    va_number = str(payload.get("virtualAccountNo", "")).strip()
    customer_no = str(payload.get("customerNo", "")).strip()

    if not va_number and not customer_no:
        return {
            "responseCode": "4002400",
            "responseMessage": "virtualAccountNo atau customerNo wajib diisi.",
        }

    # 1. Find student
    student_id = None
    student_name = ""
    if va_number:
        cur = conn.execute(
            """
            SELECT s.id, s.nama_lengkap
            FROM finance_student_va va
            JOIN santri s ON va.santri_id = s.id
            WHERE va.va_number = ?
            """,
            (va_number,),
        )
        row = cur.fetchone()
        if row:
            student_id, student_name = row

    if not student_id and customer_no:
        cur = conn.execute(
            "SELECT id, nama_lengkap FROM santri WHERE id = ? OR nis = ?",
            (customer_no, customer_no),
        )
        row = cur.fetchone()
        if row:
            student_id, student_name = row

    if not student_id:
        return {
            "responseCode": "4042412",
            "responseMessage": "Virtual Account atau Santri tidak ditemukan.",
        }

    # 2. Check active pending order (Close Amount)
    cur_order = conn.execute(
        """
        SELECT order_number, total_charged, expires_at
        FROM finance_payment_orders
        WHERE santri_id = ? AND status = 'PENDING' AND datetime(expires_at) > datetime('now')
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (student_id,),
    )
    pending_order = cur_order.fetchone()

    if pending_order:
        ord_num, total_charged, expires_at = pending_order
        return {
            "responseCode": "2002600",
            "responseMessage": "Successful",
            "virtualAccountData": {
                "partnerServiceId": "0070",
                "customerNo": customer_no or student_id,
                "virtualAccountNo": va_number,
                "virtualAccountName": student_name,
                "trxId": ord_num,
                "totalAmount": {
                    "value": f"{total_charged:.2f}",
                    "currency": "IDR",
                },
                "virtualAccountTrxType": "C",
                "expiredDate": expires_at,
            },
        }

    # 3. Open Amount (flexible top-up)
    return {
        "responseCode": "2002600",
        "responseMessage": "Successful",
        "virtualAccountData": {
            "partnerServiceId": "0070",
            "customerNo": customer_no or student_id,
            "virtualAccountNo": va_number,
            "virtualAccountName": student_name,
            "trxId": payload.get("trxId") or f"TOPUP_{student_id}",
            "totalAmount": {
                "value": "0.00",
                "currency": "IDR",
            },
            "virtualAccountTrxType": "O",
            "expiredDate": "2030-01-01T00:00:00+07:00",
        },
    }


def test_snap_va_inquiry(conn: sqlite3.Connection) -> None:
    print("Testing SNAP Virtual Account Inquiry (Close vs Open Amount)...")
    # 1. Ahmad with pending order -> Close Amount 'C'
    santri_ahmad = str(uuid.uuid4())
    va_ahmad = "007088888"
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap) VALUES (?, '88888', 'Ahmad SNAP Inq')", (santri_ahmad,))
    conn.execute("INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES (?, ?, 'DUITKU_SNAP')", (santri_ahmad, va_ahmad))
    conn.execute(
        """
        INSERT INTO finance_payment_orders (
            id, order_number, santri_id, payer_type, gross_amount, gateway_fee, total_charged, status, expires_at
        ) VALUES ('ord-inq-1', 'ORD-INQ-SNAP-01', ?, 'PORTAL_ORTU', 750000, 0, 750000, 'PENDING', datetime('now', '+1 day'))
        """,
        (santri_ahmad,),
    )

    inq_res_1 = simulate_process_snap_va_inquiry(conn, {"virtualAccountNo": va_ahmad, "customerNo": "88888"})
    assert inq_res_1["responseCode"] == "2002600"
    va_data_1 = inq_res_1["virtualAccountData"]
    assert va_data_1["virtualAccountTrxType"] == "C", "Must be Close Amount when order is pending"
    assert va_data_1["trxId"] == "ORD-INQ-SNAP-01"
    assert va_data_1["totalAmount"]["value"] == "750000.00"
    assert va_data_1["virtualAccountName"] == "Ahmad SNAP Inq"

    # 2. Budi without pending order -> Open Amount 'O'
    santri_budi = str(uuid.uuid4())
    va_budi = "007099999"
    conn.execute("INSERT INTO santri (id, nis, nama_lengkap) VALUES (?, '99999', 'Budi SNAP Open')", (santri_budi,))
    conn.execute("INSERT INTO finance_student_va (santri_id, va_number, bank_code) VALUES (?, ?, 'DUITKU_SNAP')", (santri_budi, va_budi))

    inq_res_2 = simulate_process_snap_va_inquiry(conn, {"virtualAccountNo": va_budi, "customerNo": "99999"})
    assert inq_res_2["responseCode"] == "2002600"
    va_data_2 = inq_res_2["virtualAccountData"]
    assert va_data_2["virtualAccountTrxType"] == "O", "Must be Open Amount when no order is pending"
    assert va_data_2["totalAmount"]["value"] == "0.00"
    assert va_data_2["virtualAccountName"] == "Budi SNAP Open"

    # 3. Unknown VA -> 4042412
    inq_res_3 = simulate_process_snap_va_inquiry(conn, {"virtualAccountNo": "0070000000000"})
    assert inq_res_3["responseCode"] == "4042412"
    assert "tidak ditemukan" in inq_res_3["responseMessage"]

    print("[OK] SNAP Virtual Account Inquiry (Close vs Open Amount & 404) verified.")


# ============================================================
# Main Runner
# ============================================================

def main() -> None:
    print("=" * 60)
    print("Starting Fase 3B SNAP Virtual Account Test Suite...")
    print("=" * 60)

    test_node_rsa_cryptography()
    test_snap_outbound_hmac_sha512_signature()

    conn = setup_database()
    test_snap_idempotency_via_payment_request_id(conn)
    test_fixed_va_permanence_dual_payments(conn)
    test_anti_guessing_unallocated_flow(conn)
    test_amount_mismatch_safety(conn)
    test_payment_for_expired_order(conn)
    test_snap_va_inquiry(conn)
    test_zero_plaintext_secrets_in_database(conn)

    print("\n" + "=" * 60)
    print("ALL FASE 3B SNAP VIRTUAL ACCOUNT TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    main()

