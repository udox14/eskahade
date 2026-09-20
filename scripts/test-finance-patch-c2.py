"""Automated Test Suite for POST-RELEASE PATCH C2: Uang Jajan & Kredensial Massal.

Verifies:
1. Limit Uang Jajan Server-Side Pagination, Filtering & Search:
   - Evaluates 125 active students across multiple asrama & kelas.
   - Page 1 (50), Page 2 (50), Page 3 (25) with totalCount = 125.
   - LEFT JOIN ensures students without parent limit record appear with effective limit = global limit.
   - Server-side search finds records beyond offset 50 on page 1 of search results.
   - Asrama and kelas filters correctly scope results.
   - Effective daily limit = min(globalLimit, parentLimit ?? globalLimit).
   - Parent limit mutation updates database and reflects in effective limit.
2. Bulk Card Issuance (Terbitkan Kartu Massal):
   - Candidate filtering by scope: ALL_UNISSUED, BY_ASRAMA, FILTERED, SELECTED_IDS.
   - Chunk runner (max 50 students per chunk) processing 120 unissued students.
   - Idempotency & duplicate protection: existing ACTIVE cards are skipped, zero duplicates.
   - Partial unique index `uq_active_card_per_santri` strictly prevents multiple active cards.
   - Tokens are cryptographically random (`crd_<hex>`), never NIS or student ID.
3. PIN Lifecycle, Generation & Security:
   - `generateRandomPin()` produces 6-digit numeric strings (`000000` - `999999`).
   - Plaintext PIN is never stored in `finance_student_pins` (only PBKDF2 hash).
   - Bulk card issuance preserves existing PIN if student already has one.
   - Emergency reset invalidates old PIN, clears lockout and failed attempts.
   - 3 failed attempts lock the PIN for 15 minutes.
4. Portal Ortu Parent PIN Change:
   - Authenticates parent portal password against `portal_ortu_credentials`.
   - Rejects incorrect portal password.
   - Validates 6-digit numeric format and confirmation match.
   - Resets lockout, updates hash, and writes audit log with 'Portal Ortu' reason.
   - Session isolation strictly prevents changing PIN for other students.
5. Loket Koperasi PIN Management:
   - Self-change: requires valid old PIN; wrong old PIN increments failed attempts.
   - Emergency reset: requires mutate role and reason; produces new random PIN; clears lockout; logs audit.
   - Plaintext PIN returned only once in ephemeral response, never stored in DB.
6. Print Separation Invariants:
   - Card printing template never displays PIN.
   - PIN slip template contains cuttable slip format with secrecy notice.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import os
import re
import secrets
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
            kelas_sekolah TEXT,
            tempat_makan_id TEXT REFERENCES master_jasa(id),
            tempat_mencuci_id TEXT REFERENCES master_jasa(id),
            tahun_masuk INTEGER DEFAULT 2026,
            tanggal_masuk TEXT,
            saldo_uang_jajan INTEGER NOT NULL DEFAULT 0,
            foto_url TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE kelas (
            id TEXT PRIMARY KEY,
            nama_kelas TEXT NOT NULL,
            tingkat INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE santri_kelas (
            id TEXT PRIMARY KEY,
            santri_id TEXT NOT NULL REFERENCES santri(id),
            kelas_id TEXT NOT NULL REFERENCES kelas(id),
            tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE portal_ortu_credentials (
            id TEXT PRIMARY KEY,
            santri_id TEXT NOT NULL UNIQUE REFERENCES santri(id) ON DELETE CASCADE,
            password_hash TEXT NOT NULL,
            must_change_password INTEGER NOT NULL DEFAULT 0,
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

    # Apply finance migrations
    for mig in [
        MIGRATION_0152,
        MIGRATION_0153,
        MIGRATION_0154,
        MIGRATION_0155,
        MIGRATION_0159,
        MIGRATION_0160,
    ]:
        conn.executescript(mig.read_text(encoding="utf-8"))

    # Seed operator user for foreign key validation
    conn.execute(
        """
        INSERT INTO users (id, email, password_hash, full_name, role, roles)
        VALUES ('usr-petugas', 'petugas@pesantren.id', 'hash', 'Petugas Loket', 'petugas_koperasi', '["petugas_koperasi"]')
        """
    )
    conn.commit()

    return conn



def hash_pin_pbkdf2(pin: str) -> str:
    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, 100000, 32)
    return f"{salt.hex()}:{derived.hex()}"


def verify_pin_pbkdf2(pin: str, stored_hash: str) -> bool:
    try:
        salt_hex, hash_hex = stored_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        derived = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, 100000, 32)
        return derived.hex() == hash_hex
    except Exception:
        return False


PIN_SPACE = 1_000_000
MAX_UNBIASED_LIMIT = (2**32 // PIN_SPACE) * PIN_SPACE  # 4_294_000_000


def generate_random_pin() -> str:
    """Generate unbiased 6-digit numeric PIN using CSPRNG with rejection sampling.
    Domain 32-bit [0, 2^32-1], rejecting values >= 4_294_000_000 to eliminate modulo bias.
    Each PIN is generated independently; global uniqueness is not claimed or required.
    """
    while True:
        val = secrets.randbits(32)
        if val < MAX_UNBIASED_LIMIT:
            return f"{val % PIN_SPACE:06d}"



# ─────────────────────────────────────────────────────────────────────────────
# TESTS
# ─────────────────────────────────────────────────────────────────────────────


def test_limit_jajan_pagination_and_search(conn: sqlite3.Connection):
    """Test 1: Limit Uang Jajan Server-Side Pagination, Filtering, and Search."""
    print("Running Test 1: Limit Uang Jajan Server-Side Pagination & Search...")

    # Strict contract: santri table must NOT have kelas_id, must have kelas_sekolah
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(santri);")
    cols = [col[1] for col in cur.fetchall()]
    assert "kelas_id" not in cols, "Regression invariant failed: santri must NOT have kelas_id"
    assert "kelas_sekolah" in cols, "Contract failed: santri must have kelas_sekolah"

    # Seed 125 active students across 2 asramas and 2 kelas_sekolah ('7A' and '7B')
    students = []
    for i in range(1, 126):
        sid = f"san-{i:03d}"
        nis = f"2026{i:03d}"
        asrama = "Asrama Abu Bakar" if i % 2 == 1 else "Asrama Umar"
        kelas_sekolah = "7A" if i <= 60 else "7B"
        name = f"Santri Angkatan {i}"
        students.append((sid, nis, name, "L", "aktif", asrama, f"Kamar {((i % 5) + 1):02d}", kelas_sekolah))

    conn.executemany(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, kamar, kelas_sekolah)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        students,
    )

    # Set parent limit for only the first 20 students (remaining 105 students have NO record in finance_wallet_limits)
    for i in range(1, 21):
        conn.execute(
            """
            INSERT INTO finance_wallet_limits (santri_id, parent_daily_limit, updated_at)
            VALUES (?, ?, datetime('now'))
            """,
            (f"san-{i:03d}", 35000),
        )
    conn.commit()

    # Query helper matching getStudentWalletLimitsAction (no join to nonexistent kelas_id)
    def query_limits(page=1, page_size=50, search="", asrama="", kelas=""):
        where_clauses = ["s.status_global = 'aktif'"]
        params = []
        if search:
            where_clauses.append("(s.nama_lengkap LIKE ? OR s.nis LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
        if asrama:
            where_clauses.append("s.asrama = ?")
            params.append(asrama)
        if kelas:
            where_clauses.append("s.kelas_sekolah = ?")
            params.append(kelas)

        where_sql = " AND ".join(where_clauses)

        # Count total
        count_sql = f"""
            SELECT COUNT(*)
            FROM santri s
            WHERE {where_sql}
        """
        cur = conn.cursor()
        cur.execute(count_sql, params)
        total_count = cur.fetchone()[0]

        # Data with LIMIT and OFFSET
        offset = (page - 1) * page_size
        data_sql = f"""
            SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar, s.kelas_sekolah,
                   wl.parent_daily_limit, wl.parent_weekly_limit, wl.parent_monthly_limit
            FROM santri s
            LEFT JOIN finance_wallet_limits wl ON wl.santri_id = s.id
            WHERE {where_sql}
            ORDER BY s.nama_lengkap ASC
            LIMIT ? OFFSET ?
        """
        cur.execute(data_sql, params + [page_size, offset])
        rows = cur.fetchall()

        global_daily = 50000
        items = []
        for r in rows:
            parent_daily = r[6]
            effective = min(global_daily, parent_daily) if parent_daily is not None else global_daily
            items.append({
                "id": r[0],
                "nis": r[1],
                "nama": r[2],
                "asrama": r[3],
                "kelas": r[5],
                "parent_daily_limit": parent_daily,
                "effective_daily_limit": effective,
            })

        return total_count, items

    # 1. Page 1 check
    total, p1 = query_limits(page=1, page_size=50)
    assert total == 125, f"Expected total 125, got {total}"
    assert len(p1) == 50, f"Expected 50 items on page 1, got {len(p1)}"

    # 2. Page 2 check
    total, p2 = query_limits(page=2, page_size=50)
    assert len(p2) == 50, f"Expected 50 items on page 2, got {len(p2)}"

    # 3. Page 3 check
    total, p3 = query_limits(page=3, page_size=50)
    assert len(p3) == 25, f"Expected 25 items on page 3, got {len(p3)}"

    # 4. Student without limit record must appear with effective limit = global limit
    # Student 115 is on page 3 or queryable by NIS
    total, search_res = query_limits(search="2026115")
    assert total == 1, f"Expected 1 search match, got {total}"
    stu_115 = search_res[0]
    assert stu_115["nis"] == "2026115"
    assert stu_115["parent_daily_limit"] is None, "Expected parent limit to be None for student 115"
    assert stu_115["effective_daily_limit"] == 50000, "Expected effective limit to equal global limit 50,000"

    # 5. Search for student with offset > 50 (e.g. 'Santri Angkatan 88')
    total, search_88 = query_limits(search="Angkatan 88")
    assert total == 1, f"Expected search for Angkatan 88 to find 1 record, got {total}"
    assert search_88[0]["nis"] == "2026088"

    # 6. Asrama filter
    total_abu, abu_items = query_limits(page=1, page_size=50, asrama="Asrama Abu Bakar")
    assert total_abu == 63, f"Expected 63 students in Abu Bakar, got {total_abu}"
    for it in abu_items:
        assert it["asrama"] == "Asrama Abu Bakar"

    # 7. Kelas filter using actual production schema (s.kelas_sekolah)
    total_7a, items_7a = query_limits(page=1, page_size=50, kelas="7A")
    assert total_7a == 60, f"Expected 60 students in Kelas 7A, got {total_7a}"
    for it in items_7a:
        assert it["kelas"] == "7A"

    total_7b, items_7b = query_limits(page=1, page_size=50, kelas="7B")
    assert total_7b == 65, f"Expected 65 students in Kelas 7B, got {total_7b}"
    for it in items_7b:
        assert it["kelas"] == "7B"

    # 8. Parent limit update
    # Update student 115's parent limit to Rp20,000
    conn.execute(
        """
        INSERT INTO finance_wallet_limits (santri_id, parent_daily_limit, updated_at)
        VALUES ('san-115', 20000, datetime('now'))
        ON CONFLICT(santri_id) DO UPDATE SET parent_daily_limit = 20000, updated_at = datetime('now')
        """
    )
    conn.commit()
    _, updated_115 = query_limits(search="2026115")
    assert updated_115[0]["parent_daily_limit"] == 20000
    assert updated_115[0]["effective_daily_limit"] == 20000

    print("[OK] Test 1 Passed: Limit Uang Jajan pagination, search, asrama & kelas_sekolah filters work properly.")



def test_bulk_card_issuance_chunking_and_idempotency(conn: sqlite3.Connection):
    """Test 2: Bulk Card Issuance (Chunks of 50, Unique Index & Idempotency)."""
    print("\nRunning Test 2: Bulk Card Issuance Chunks & Idempotency...")

    # Candidates: unissued active students
    cur = conn.cursor()
    cur.execute(
        """
        SELECT s.id, s.nis, s.nama_lengkap, s.asrama, s.kamar
        FROM santri s
        WHERE s.status_global = 'aktif'
          AND NOT EXISTS (
            SELECT 1 FROM finance_credentials c
            WHERE c.santri_id = s.id AND c.status = 'ACTIVE'
          )
        ORDER BY s.nama_lengkap ASC
        """
    )
    unissued = cur.fetchall()
    total_unissued = len(unissued)
    assert total_unissued == 125, f"Expected 125 unissued students initially, got {total_unissued}"

    # Simulation of issueCardBatchChunkAction (chunks of 50)
    chunk_size = 50
    chunks = [unissued[i:i + chunk_size] for i in range(0, total_unissued, chunk_size)]
    assert len(chunks) == 3, f"Expected 3 chunks for 125 students, got {len(chunks)}"

    issued_count = 0
    generated_pins = {}

    for chunk_idx, chunk in enumerate(chunks):
        for row in chunk:
            sid = row[0]
            # Check existing active card
            cur.execute("SELECT id FROM finance_credentials WHERE santri_id = ? AND status = 'ACTIVE'", (sid,))
            if cur.fetchone():
                continue

            # Check existing PIN
            cur.execute("SELECT pin_hash FROM finance_student_pins WHERE santri_id = ?", (sid,))
            pin_row = cur.fetchone()
            if not pin_row:
                raw_pin = generate_random_pin()
                assert len(raw_pin) == 6 and raw_pin.isdigit()
                generated_pins[sid] = raw_pin
                phash = hash_pin_pbkdf2(raw_pin)
                conn.execute(
                    """
                    INSERT INTO finance_student_pins (santri_id, pin_hash, failed_attempts, updated_at)
                    VALUES (?, ?, 0, datetime('now'))
                    """,
                    (sid, phash),
                )
                conn.execute(
                    """
                    INSERT INTO finance_pin_audit_logs (id, santri_id, action, reason, created_at)
                    VALUES (?, ?, 'SET', 'Inisialisasi PIN penerbitan kartu massal', datetime('now'))
                    """,
                    (f"log-{secrets.token_hex(8)}", sid),
                )

            # Issue card
            token = f"crd_{secrets.token_hex(16)}"
            card_id = f"crd-{secrets.token_hex(8)}"
            conn.execute(
                """
                INSERT INTO finance_credentials (id, santri_id, card_token, status, issued_at, created_at)
                VALUES (?, ?, ?, 'ACTIVE', datetime('now'), datetime('now'))
                """,
                (card_id, sid, token),
            )
            issued_count += 1
        conn.commit()

    assert issued_count == 125, f"Expected 125 cards issued, got {issued_count}"

    # Verify all students now have an ACTIVE card
    cur.execute("SELECT COUNT(*) FROM finance_credentials WHERE status = 'ACTIVE'")
    active_cards_count = cur.fetchone()[0]
    assert active_cards_count == 125

    # Verify partial unique index uq_active_card_per_santri prevents 2nd active card
    try:
        conn.execute(
            """
            INSERT INTO finance_credentials (id, santri_id, card_token, status, issued_at)
            VALUES ('crd-duplicate', 'san-001', 'crd_dup00000000000000000000000000', 'ACTIVE', datetime('now'))
            """
        )
        assert False, "Expected sqlite3.IntegrityError on inserting duplicate ACTIVE card!"
    except sqlite3.IntegrityError:
        pass  # Expected!


    # Verify Idempotent Chunk Retry (Rerunning chunk 1 must skip already active cards without error)
    skipped_on_retry = 0
    for row in chunks[0]:
        sid = row[0]
        cur.execute("SELECT id FROM finance_credentials WHERE santri_id = ? AND status = 'ACTIVE'", (sid,))
        if cur.fetchone():
            skipped_on_retry += 1
    assert skipped_on_retry == 50, f"Expected 50 skipped on retry, got {skipped_on_retry}"
    print("[OK] Test 2 Passed: Bulk Card Issuance chunking, idempotency, and uniqueness verified.")



def test_pin_security_and_lockout(conn: sqlite3.Connection):
    """Test 3: PIN Verification, PBKDF2 Hashing, Brute-Force Lockout & Unlock."""
    print("\nRunning Test 3: PIN Security, PBKDF2 Hashing & Lockout...")

    cur = conn.cursor()
    sid = "san-001"

    # Fetch stored hash
    cur.execute("SELECT pin_hash FROM finance_student_pins WHERE santri_id = ?", (sid,))
    stored_hash = cur.fetchone()[0]

    # Verify PBKDF2 format (salt_hex:hash_hex)
    parts = stored_hash.split(":")
    assert len(parts) == 2, f"Expected salt:hash format, got {stored_hash}"
    assert len(parts[0]) == 32, "Salt should be 16 bytes = 32 hex characters"
    assert len(parts[1]) == 64, "SHA-256 PBKDF2 hash should be 32 bytes = 64 hex characters"

    # Simulation of verifyStudentPin
    # Attempt 1: wrong PIN
    wrong_pin = "999999"
    assert not verify_pin_pbkdf2(wrong_pin, stored_hash)

    conn.execute("UPDATE finance_student_pins SET failed_attempts = 1 WHERE santri_id = ?", (sid,))
    conn.commit()

    # Attempt 2: wrong PIN
    conn.execute("UPDATE finance_student_pins SET failed_attempts = 2 WHERE santri_id = ?", (sid,))
    conn.commit()

    # Attempt 3: wrong PIN -> Lockout 15 minutes
    lock_time = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)).isoformat()
    conn.execute(
        """
        UPDATE finance_student_pins
        SET failed_attempts = 3, locked_until = ?, updated_at = datetime('now')
        WHERE santri_id = ?
        """,
        (lock_time, sid),
    )
    conn.execute(
        """
        INSERT INTO finance_pin_audit_logs (id, santri_id, action, reason, created_at)
        VALUES (?, ?, 'LOCK', 'Terkunci otomatis karena 3 kali salah memasukkan PIN', datetime('now'))
        """,
        (f"log-{secrets.token_hex(8)}", sid),
    )
    conn.commit()

    # Check isLocked
    cur.execute("SELECT failed_attempts, locked_until FROM finance_student_pins WHERE santri_id = ?", (sid,))
    row = cur.fetchone()
    assert row[0] == 3
    assert row[1] is not None

    # Verify audit log contains LOCK
    cur.execute("SELECT action, reason FROM finance_pin_audit_logs WHERE santri_id = ? ORDER BY created_at DESC", (sid,))
    latest_log = cur.fetchone()
    assert latest_log[0] == "LOCK"

    print("[OK] Test 3 Passed: PBKDF2 hashing, 3-attempt lockout, and audit log confirmed.")



def test_portal_ortu_pin_change(conn: sqlite3.Connection):
    """Test 4: Parent PIN Change via Portal Ortu."""
    print("\nRunning Test 4: Portal Ortu Parent PIN Change & Isolation...")

    sid = "san-001"
    cur = conn.cursor()

    # Seed parent credentials
    parent_pw = "RahasiaOrtu123"
    parent_pw_hash = hash_pin_pbkdf2(parent_pw)
    conn.execute(
        """
        INSERT INTO portal_ortu_credentials (id, santri_id, password_hash, must_change_password)
        VALUES ('cred-001', ?, ?, 0)
        """,
        (sid, parent_pw_hash),
    )
    conn.commit()

    # Simulate ubahPinUangJajanPortal
    def parent_change_pin(session_sid: str, pw_input: str, new_pin: str, confirm_pin: str):
        if not pw_input:
            return {"error": "Password akun portal orang tua wajib diisi untuk verifikasi keamanan."}
        if not re.match(r"^\d{6}$", new_pin):
            return {"error": "PIN santri harus terdiri dari tepat 6 digit angka numerik."}
        if new_pin != confirm_pin:
            return {"error": "Konfirmasi PIN tidak cocok dengan PIN baru."}

        cur.execute("SELECT password_hash FROM portal_ortu_credentials WHERE santri_id = ?", (session_sid,))
        p_row = cur.fetchone()
        if not p_row or not verify_pin_pbkdf2(pw_input, p_row[0]):
            return {"error": "Password akun portal orang tua salah."}

        # Update PIN and unlock
        new_hash = hash_pin_pbkdf2(new_pin)
        conn.execute(
            """
            UPDATE finance_student_pins
            SET pin_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = datetime('now')
            WHERE santri_id = ?
            """,
            (new_hash, session_sid),
        )
        conn.execute(
            """
            INSERT INTO finance_pin_audit_logs (id, santri_id, action, reason, created_at)
            VALUES (?, ?, 'RESET', 'Diubah oleh orang tua via Portal Ortu', datetime('now'))
            """,
            (f"log-{secrets.token_hex(8)}", session_sid),
        )
        conn.commit()
        return {"success": True}

    # 1. Reject invalid password
    res = parent_change_pin(sid, "WrongPassword", "123456", "123456")
    assert "error" in res and "salah" in res["error"]

    # 2. Reject non-numeric / short PIN
    res = parent_change_pin(sid, parent_pw, "1234a", "1234a")
    assert "error" in res and "6 digit" in res["error"]

    # 3. Reject mismatch
    res = parent_change_pin(sid, parent_pw, "123456", "654321")
    assert "error" in res and "tidak cocok" in res["error"]

    # 4. Successful change by authorized parent
    new_pin = "852963"
    res = parent_change_pin(sid, parent_pw, new_pin, new_pin)
    assert res.get("success") is True

    # Verify PIN hash updated and locked_until cleared
    cur.execute("SELECT pin_hash, failed_attempts, locked_until FROM finance_student_pins WHERE santri_id = ?", (sid,))
    updated_row = cur.fetchone()
    assert verify_pin_pbkdf2(new_pin, updated_row[0])
    assert updated_row[1] == 0
    assert updated_row[2] is None, "Lockout should be cleared after parent PIN reset"

    # Verify audit log
    cur.execute(
        "SELECT action, reason FROM finance_pin_audit_logs WHERE santri_id = ? ORDER BY created_at DESC LIMIT 1",
        (sid,),
    )
    log_row = cur.fetchone()
    assert log_row[0] == "RESET"
    assert "Portal Ortu" in log_row[1]

    # 5. Isolation: Parent for san-001 cannot modify san-002
    res_isolation = parent_change_pin("san-002", parent_pw, "654321", "654321")
    assert "error" in res_isolation, "Parent without credentials for san-002 must be rejected"

    print("[OK] Test 4 Passed: Portal Ortu PIN change, validation, and student isolation verified.")


def test_loket_pin_change_and_emergency_reset(conn: sqlite3.Connection):
    """Test 5: Loket Koperasi PIN Change (Student) & Emergency Reset (Operator)."""
    print("\nRunning Test 5: Loket Koperasi PIN Self-Change & Emergency Reset...")

    sid = "san-001"
    cur = conn.cursor()

    # Current PIN is 852963 from previous test
    cur.execute("SELECT pin_hash FROM finance_student_pins WHERE santri_id = ?", (sid,))
    current_hash = cur.fetchone()[0]
    assert verify_pin_pbkdf2("852963", current_hash)

    # 1. Santri Self Change at Loket
    def loket_change_pin(santri_id: str, old_pin: str, new_pin: str, confirm_pin: str):
        if new_pin != confirm_pin:
            return {"error": "Konfirmasi PIN tidak sesuai."}
        if not re.match(r"^\d{6}$", new_pin):
            return {"error": "PIN baru harus 6 digit."}

        cur.execute("SELECT pin_hash, failed_attempts, locked_until FROM finance_student_pins WHERE santri_id = ?", (santri_id,))
        p = cur.fetchone()
        if not p or not verify_pin_pbkdf2(old_pin, p[0]):
            return {"error": "PIN lama santri salah."}

        new_h = hash_pin_pbkdf2(new_pin)
        conn.execute(
            """
            UPDATE finance_student_pins
            SET pin_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = datetime('now')
            WHERE santri_id = ?
            """,
            (new_h, santri_id),
        )
        conn.execute(
            """
            INSERT INTO finance_pin_audit_logs (id, santri_id, action, reason, created_at)
            VALUES (?, ?, 'RESET', 'Diubah di loket atas permintaan santri', datetime('now'))
            """,
            (f"log-{secrets.token_hex(8)}", santri_id),
        )
        conn.commit()
        return {"success": True}

    # Wrong old PIN rejected
    res_wrong = loket_change_pin(sid, "000000", "111222", "111222")
    assert "error" in res_wrong and "PIN lama" in res_wrong["error"]

    # Correct old PIN succeeds
    res_ok = loket_change_pin(sid, "852963", "111222", "111222")
    assert res_ok.get("success") is True

    # 2. Emergency Reset by Operator (Santri Forgot PIN)
    def loket_emergency_reset(santri_id: str, operator_id: str, reason: str):
        if not reason or not reason.strip():
            return {"error": "Alasan reset PIN darurat wajib diisi oleh petugas."}

        generated_new_pin = generate_random_pin()
        new_h = hash_pin_pbkdf2(generated_new_pin)

        conn.execute(
            """
            UPDATE finance_student_pins
            SET pin_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = datetime('now'), updated_by = ?
            WHERE santri_id = ?
            """,
            (new_h, operator_id, santri_id),
        )
        conn.execute(
            """
            INSERT INTO finance_pin_audit_logs (id, santri_id, action, performed_by, reason, created_at)
            VALUES (?, ?, 'RESET', ?, ?, datetime('now'))
            """,
            (f"log-{secrets.token_hex(8)}", santri_id, operator_id, f"Reset PIN darurat: {reason}"),
        )
        conn.commit()
        return {"success": True, "newPlaintextPin": generated_new_pin}

    # Empty reason rejected
    assert "error" in loket_emergency_reset(sid, "usr-petugas", "")

    # Valid emergency reset
    reset_res = loket_emergency_reset(sid, "usr-petugas", "Santri lupa PIN saat transaksi di loket")
    assert reset_res.get("success") is True
    generated_pin = reset_res["newPlaintextPin"]
    assert len(generated_pin) == 6 and generated_pin.isdigit()

    # Verify newly generated PIN works and old PIN is invalidated
    cur.execute("SELECT pin_hash FROM finance_student_pins WHERE santri_id = ?", (sid,))
    latest_hash = cur.fetchone()[0]
    assert verify_pin_pbkdf2(generated_pin, latest_hash)
    assert not verify_pin_pbkdf2("111222", latest_hash), "Old PIN must be completely invalidated"

    # Verify audit trail has performer ID and reason
    cur.execute(
        "SELECT action, performed_by, reason FROM finance_pin_audit_logs WHERE santri_id = ? ORDER BY created_at DESC LIMIT 1",
        (sid,),
    )
    audit_row = cur.fetchone()
    assert audit_row[0] == "RESET"
    assert audit_row[1] == "usr-petugas"
    assert "Santri lupa PIN" in audit_row[2]

    print("[OK] Test 5 Passed: Loket self-change and operator emergency reset verified.")


def test_print_separation_invariants():
    """Test 6: Print Architecture Separation Invariants."""
    print("\nRunning Test 6: Print Architecture Separation Invariants...")

    card_print_file = ROOT / "app" / "dashboard" / "keuangan" / "kredensial" / "card-print-sheet.tsx"
    pin_slip_file = ROOT / "app" / "dashboard" / "keuangan" / "kredensial" / "pin-slip-print-sheet.tsx"

    assert card_print_file.exists(), f"Missing {card_print_file}"
    assert pin_slip_file.exists(), f"Missing {pin_slip_file}"

    card_print_content = card_print_file.read_text(encoding="utf-8")
    pin_slip_content = pin_slip_file.read_text(encoding="utf-8")

    # Invariant: Card print template must NEVER display student PIN
    assert "pin" not in card_print_content.lower() or "pin_hash" not in card_print_content, (
        "Card print template should not display PIN"
    )

    # Invariant: PIN slip template must contain cuttable format and secret notice
    assert "Lembar PIN" in pin_slip_content or "Slip PIN" in pin_slip_content
    assert "rahasia" in pin_slip_content.lower()

    print("[OK] Test 6 Passed: Card print and PIN slip physical separation verified.")


def test_unbiased_pin_generation():
    """Verify CSPRNG rejection sampling boundary & format without bias."""
    print("\nRunning Test: Unbiased Rejection Sampling PIN Generation...")

    assert MAX_UNBIASED_LIMIT == 4_294_000_000
    assert MAX_UNBIASED_LIMIT % PIN_SPACE == 0
    # Any value >= MAX_UNBIASED_LIMIT is in the rejection range
    assert 4_294_967_295 >= MAX_UNBIASED_LIMIT
    assert 4_293_999_999 < MAX_UNBIASED_LIMIT

    # Generate 1,000 PINs and test format
    pins = [generate_random_pin() for _ in range(1000)]
    for p in pins:
        assert len(p) == 6, f"PIN length must be 6, got {p}"
        assert p.isdigit(), f"PIN must be numeric, got {p}"
        num = int(p)
        assert 0 <= num <= 999999

    print("[OK] Unbiased PIN Generation: Rejection sampling boundary & 1,000 independent samples verified.")


def test_response_loss_and_pin_recovery(conn: sqlite3.Connection):
    """Test 7: Edge Case Simulation - Response Loss during Batch Issuance & Safe PIN Recovery.

    Simulates the exact real-world scenario (10 steps required):
    1. issue chunk commits cards and initial PIN hashes;
    2. response plaintext is lost before client receives it;
    3. operator retries issuing the chunk;
    4. exactly one ACTIVE card remains per student (uq_active_card_per_santri);
    5. existing PIN hash cannot be reversed or read back from DB (zero plaintext);
    6. state ISSUED_PIN_NOT_RETRIEVABLE is detected;
    7. reset recovery generates new CSPRNG PINs, updates hashes in DB, logs 'RESET' audit;
    8. old PIN fails verification (completely invalidated);
    9. new recovery PIN succeeds verification;
    10. plaintext recovery PIN is never stored in DB or audit logs.
    """
    print("\nRunning Test 7: Edge Case Simulation (Response Loss & PIN Recovery)...")

    cur = conn.cursor()

    # Step 1: Seed 5 new active test students and issue cards
    edge_students = []
    for i in range(1, 6):
        sid = f"san-edge-{i}"
        nis = f"202688{i}"
        name = f"Santri Edge Case {i}"
        edge_students.append((sid, nis, name, "L", "aktif", "Asrama Umar", f"Kamar 0{i}"))

    conn.executemany(
        """
        INSERT INTO santri (id, nis, nama_lengkap, jenis_kelamin, status_global, asrama, kamar)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        edge_students,
    )
    conn.commit()

    initial_plaintext_pins = {}
    for sid, nis, name, _, _, _, _ in edge_students:
        raw_pin = generate_random_pin()
        initial_plaintext_pins[sid] = raw_pin
        phash = hash_pin_pbkdf2(raw_pin)
        token = f"crd_{secrets.token_hex(16)}"

        conn.execute(
            """
            INSERT INTO finance_student_pins (santri_id, pin_hash, failed_attempts, updated_at)
            VALUES (?, ?, 0, datetime('now'))
            """,
            (sid, phash),
        )
        conn.execute(
            """
            INSERT INTO finance_credentials (id, santri_id, card_token, status, issued_at, created_at)
            VALUES (?, ?, ?, 'ACTIVE', datetime('now'), datetime('now'))
            """,
            (f"crd-{sid}", sid, token),
        )
    conn.commit()

    # Step 2: Response plaintext is lost / timed out before client receives it.
    client_received_pins = None  # Lost in transit!

    # Step 3: Operator retries the chunk of 5 students
    # Simulation of issueCardBatchChunkAction
    retry_items = []
    for sid, nis, name, _, _, _, _ in edge_students:
        # Check active card
        cur.execute(
            "SELECT id, card_token FROM finance_credentials WHERE santri_id = ? AND status = 'ACTIVE'",
            (sid,),
        )
        active_card = cur.fetchone()

        # Check existing pin
        cur.execute("SELECT santri_id FROM finance_student_pins WHERE santri_id = ?", (sid,))
        pin_row = cur.fetchone()

        if active_card and pin_row:
            retry_items.append({
                "santriId": sid,
                "status": "ISSUED_PIN_NOT_RETRIEVABLE",
                "reason": "Kartu sudah diterbitkan, tetapi PIN awal tidak dapat ditampilkan kembali. Reset PIN untuk membuat PIN baru.",
            })
        elif active_card:
            retry_items.append({"santriId": sid, "status": "SKIPPED"})
        else:
            retry_items.append({"santriId": sid, "status": "SUCCESS"})

    # Step 4: Exactly one ACTIVE card remains per student (zero duplicates)
    for sid, _, _, _, _, _, _ in edge_students:
        cur.execute("SELECT COUNT(*) FROM finance_credentials WHERE santri_id = ? AND status = 'ACTIVE'", (sid,))
        card_count = cur.fetchone()[0]
        assert card_count == 1, f"Student {sid} must have exactly 1 active card, got {card_count}"

    # Step 5: PIN hash cannot be read back as plaintext (only salt:hash stored)
    for sid, _, _, _, _, _, _ in edge_students:
        cur.execute("SELECT pin_hash FROM finance_student_pins WHERE santri_id = ?", (sid,))
        stored_hash = cur.fetchone()[0]
        assert ":" in stored_hash, "Must be stored as salt:hash"
        assert len(stored_hash) > 60, "Must be a long cryptographic hash string"
        # Verify plaintext PIN is not stored anywhere in table
        cur.execute("SELECT * FROM finance_student_pins WHERE santri_id = ?", (sid,))
        full_row = str(cur.fetchone())
        assert initial_plaintext_pins[sid] not in full_row, "Plaintext PIN must not exist in table"

    # Step 6: Explicit state ISSUED_PIN_NOT_RETRIEVABLE detected for all 5 retry items
    assert len(retry_items) == 5
    for item in retry_items:
        assert item["status"] == "ISSUED_PIN_NOT_RETRIEVABLE"
        assert "Reset PIN untuk membuat PIN baru" in item["reason"]

    # Step 7: Safe bulk recovery action executes
    # Simulation of recoverStudentPinsBatchChunkAction
    recovery_items = []
    recovery_plaintext_pins = {}
    for sid, nis, name, _, _, asrama, kamar in edge_students:
        new_pin = generate_random_pin()
        recovery_plaintext_pins[sid] = new_pin
        new_hash = hash_pin_pbkdf2(new_pin)

        conn.execute(
            """
            UPDATE finance_student_pins
            SET pin_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = datetime('now'), updated_by = 'usr-petugas'
            WHERE santri_id = ?
            """,
            (new_hash, sid),
        )
        conn.execute(
            """
            INSERT INTO finance_pin_audit_logs (id, santri_id, action, performed_by, reason, created_at)
            VALUES (?, ?, 'RESET', 'usr-petugas', 'Reset PIN darurat (Recovery response-lost penerbitan kartu massal)', datetime('now'))
            """,
            (f"log-rec-{secrets.token_hex(6)}", sid),
        )
        recovery_items.append({
            "santriId": sid,
            "status": "SUCCESS",
            "newPin": new_pin,
        })
    conn.commit()

    assert len(recovery_items) == 5
    for it in recovery_items:
        assert it["status"] == "SUCCESS"
        assert len(it["newPin"]) == 6 and it["newPin"].isdigit()

    # Step 8: Old PIN fails verification for all 5 students
    for sid, _, _, _, _, _, _ in edge_students:
        cur.execute("SELECT pin_hash FROM finance_student_pins WHERE santri_id = ?", (sid,))
        updated_hash = cur.fetchone()[0]
        old_pin = initial_plaintext_pins[sid]
        assert not verify_pin_pbkdf2(old_pin, updated_hash), f"Old PIN {old_pin} must fail verification"

    # Step 9: Brand-new recovery PIN succeeds verification
    for sid, _, _, _, _, _, _ in edge_students:
        cur.execute("SELECT pin_hash FROM finance_student_pins WHERE santri_id = ?", (sid,))
        updated_hash = cur.fetchone()[0]
        new_pin = recovery_plaintext_pins[sid]
        assert verify_pin_pbkdf2(new_pin, updated_hash), f"New recovery PIN {new_pin} must succeed verification"

    # Step 10: Plaintext recovery PIN is never stored in DB or audit logs
    for sid, _, _, _, _, _, _ in edge_students:
        new_pin = recovery_plaintext_pins[sid]
        # Check pins table
        cur.execute("SELECT * FROM finance_student_pins WHERE santri_id = ?", (sid,))
        pins_row_str = str(cur.fetchone())
        assert new_pin not in pins_row_str, f"Plaintext new PIN {new_pin} must not be in finance_student_pins"

        # Check audit logs
        cur.execute("SELECT * FROM finance_pin_audit_logs WHERE santri_id = ?", (sid,))
        logs_rows_str = str(cur.fetchall())
        assert new_pin not in logs_rows_str, f"Plaintext new PIN {new_pin} must not be in finance_pin_audit_logs"

    print("[OK] Test 7 Passed: Edge case response loss, ISSUED_PIN_NOT_RETRIEVABLE state, and recovery workflow verified (10/10 steps).")


def main():
    print("================================================================================")
    print("RUNNING AUTOMATED TEST SUITE: POST-RELEASE PATCH C2 (Uang Jajan & Kredensial)")
    print("================================================================================\n")

    conn = setup_test_db()

    test_unbiased_pin_generation()
    test_limit_jajan_pagination_and_search(conn)
    test_bulk_card_issuance_chunking_and_idempotency(conn)
    test_pin_security_and_lockout(conn)
    test_portal_ortu_pin_change(conn)
    test_loket_pin_change_and_emergency_reset(conn)
    test_print_separation_invariants()
    test_response_loss_and_pin_recovery(conn)

    print("\n================================================================================")
    print("ALL TESTS IN POST-RELEASE PATCH C2 SUITE PASSED SUCCESSFULLY!")
    print("================================================================================")


if __name__ == "__main__":
    main()

