"""Local SQLite contract tests for migration 0124.

The fixture intentionally represents an already-populated legacy main database.
It verifies that POSKESTREN migration is additive and that its critical database
constraints and indexed access paths hold without requiring a remote D1.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "migrations" / "0124_poskestren.sql"


def expect_integrity_error(connection: sqlite3.Connection, sql: str, params: tuple) -> None:
    try:
        connection.execute(sql, params)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f"Expected integrity error for: {sql}")


def create_legacy_fixture(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          full_name TEXT,
          role TEXT,
          roles TEXT,
          updated_at TEXT
        );
        CREATE TABLE santri (
          id TEXT PRIMARY KEY,
          nis TEXT,
          nama_lengkap TEXT,
          asrama TEXT
        );
        CREATE TABLE absen_sakit (
          id TEXT PRIMARY KEY,
          santri_id TEXT,
          episode_id TEXT,
          sakit_apa TEXT,
          status_sakit TEXT
        );
        CREATE TABLE fitur_akses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_name TEXT NOT NULL,
          title TEXT NOT NULL,
          href TEXT NOT NULL UNIQUE,
          icon TEXT,
          roles TEXT,
          is_active INTEGER,
          urutan INTEGER,
          is_bottomnav INTEGER,
          bottomnav_urutan INTEGER
        );
        CREATE TABLE role_fitur_crud_permission (
          fitur_href TEXT NOT NULL,
          role TEXT NOT NULL,
          can_create INTEGER,
          can_update INTEGER,
          can_delete INTEGER,
          created_at TEXT,
          updated_at TEXT,
          PRIMARY KEY (fitur_href, role)
        );
        INSERT INTO users(id, full_name, role, roles)
        VALUES ('u1', 'Petugas Lama', 'admin', '["admin"]');
        INSERT INTO santri(id, nis, nama_lengkap, asrama)
        VALUES ('s1', '1001', 'Santri Lama', 'A');
        INSERT INTO absen_sakit(id, santri_id, episode_id, sakit_apa, status_sakit)
        VALUES ('as1', 's1', 'episode-lama', 'Demam', 'SAKIT');
        """
    )


def main() -> None:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    create_legacy_fixture(db)
    legacy_before = dict(db.execute("SELECT * FROM absen_sakit WHERE id = 'as1'").fetchone())
    db.executescript(MIGRATION.read_text(encoding="utf-8"))
    legacy_after = dict(db.execute("SELECT * FROM absen_sakit WHERE id = 'as1'").fetchone())
    assert legacy_before == legacy_after, "Migration changed legacy Data Sakit"

    assert db.execute("SELECT COUNT(*) FROM fitur_akses WHERE group_name = 'POSKESTREN'").fetchone()[0] == 5
    assert db.execute("SELECT name FROM poskestren_cash_account WHERE id = 'pos-cash-default'").fetchone()[0] == "Kas Tunai"

    db.execute(
        """INSERT INTO poskestren_patient(
             id, santri_id, medical_record_no, created_by
           ) VALUES ('patient-1', 's1', 'RM-0001', 'u1')"""
    )
    expect_integrity_error(
        db,
        "INSERT INTO poskestren_patient(id, santri_id, medical_record_no) VALUES (?, ?, ?)",
        ("patient-2", "s1", "RM-0002"),
    )

    db.execute(
        """INSERT INTO poskestren_visit(
             id, patient_id, queue_date, queue_number, source_type,
             source_episode_id, source_absen_sakit_id
           ) VALUES ('visit-1', 'patient-1', '2026-07-01', 1, 'DATA_SAKIT', 'episode-lama', 'as1')"""
    )
    expect_integrity_error(
        db,
        """INSERT INTO poskestren_visit(
             id, patient_id, queue_date, queue_number, source_type, source_episode_id
           ) VALUES (?, ?, ?, ?, ?, ?)""",
        ("visit-2", "patient-1", "2026-07-02", 1, "DATA_SAKIT", "episode-lama"),
    )
    expect_integrity_error(
        db,
        "INSERT INTO poskestren_visit(id, patient_id, queue_date, queue_number) VALUES (?, ?, ?, ?)",
        ("visit-3", "patient-1", "2026-07-01", 1),
    )

    db.execute(
        """INSERT INTO poskestren_personnel(
             id, user_id, personnel_type, full_name, created_by
           ) VALUES ('medic-1', 'u1', 'MEDICAL', 'Dokter Uji', 'u1')"""
    )
    db.executemany(
        """INSERT INTO poskestren_compensation_history(
             id, personnel_id, effective_from, session_rate_rupiah,
             patient_rate_rupiah, created_by
           ) VALUES (?, 'medic-1', ?, ?, ?, 'u1')""",
        [
            ("rate-1", "2026-01-01", 100_000, 10_000),
            ("rate-2", "2026-07-15", 120_000, 15_000),
        ],
    )
    expect_integrity_error(
        db,
        """INSERT INTO poskestren_compensation_history(
             id, personnel_id, effective_from, session_rate_rupiah
           ) VALUES (?, ?, ?, ?)""",
        ("rate-duplicate", "medic-1", "2026-07-15", 999_999),
    )
    db.executemany(
        """INSERT INTO poskestren_practice_session(
             id, personnel_id, session_date, status, started_at, ended_at
           ) VALUES (?, 'medic-1', ?, 'CLOSED', ?, ?)""",
        [
            ("session-1", "2026-07-10", "2026-07-10T01:00:00Z", "2026-07-10T02:00:00Z"),
            ("session-2", "2026-07-20", "2026-07-20T01:00:00Z", "2026-07-20T02:00:00Z"),
        ],
    )
    db.execute(
        """UPDATE poskestren_visit
           SET personnel_id = 'medic-1', practice_session_id = 'session-1',
               status = 'SELESAI', completed_at = '2026-07-10T02:00:00Z'
           WHERE id = 'visit-1'"""
    )
    db.execute(
        """INSERT INTO poskestren_visit(
             id, patient_id, queue_date, queue_number, status, personnel_id,
             practice_session_id, completed_at
           ) VALUES (
             'visit-repeat', 'patient-1', '2026-07-20', 1, 'DIRUJUK', 'medic-1',
             'session-2', '2026-07-20T02:00:00Z'
           )"""
    )
    session_total = db.execute(
        """SELECT SUM((
             SELECT ch.session_rate_rupiah
             FROM poskestren_compensation_history ch
             WHERE ch.personnel_id = ps.personnel_id
               AND ch.effective_from <= ps.session_date
             ORDER BY ch.effective_from DESC LIMIT 1
           ))
           FROM poskestren_practice_session ps
           WHERE ps.personnel_id = 'medic-1' AND ps.status = 'CLOSED'
             AND ps.session_date BETWEEN '2026-07-01' AND '2026-07-31'"""
    ).fetchone()[0]
    patient_total = db.execute(
        """SELECT SUM((
             SELECT ch.patient_rate_rupiah
             FROM poskestren_compensation_history ch
             WHERE ch.personnel_id = v.personnel_id
               AND ch.effective_from <= v.queue_date
             ORDER BY ch.effective_from DESC LIMIT 1
           ))
           FROM poskestren_visit v
           WHERE v.personnel_id = 'medic-1' AND v.status IN ('SELESAI','DIRUJUK')
             AND v.queue_date BETWEEN '2026-07-01' AND '2026-07-31'"""
    ).fetchone()[0]
    assert session_total == 220_000
    assert patient_total == 25_000

    db.execute(
        """INSERT INTO poskestren_medicine(
             id, name, base_unit, minimum_stock_base, total_stock_base, created_by
           ) VALUES ('medicine-1', 'Obat Uji', 'tablet', 5, 10, 'u1')"""
    )
    db.execute(
        """INSERT INTO poskestren_medicine_batch(
             id, medicine_id, batch_number, expires_on, initial_quantity, remaining_quantity
           ) VALUES ('batch-early', 'medicine-1', 'B-01', '2026-08-01', 5, 5)"""
    )
    db.execute(
        """INSERT INTO poskestren_medicine_batch(
             id, medicine_id, batch_number, expires_on, initial_quantity, remaining_quantity
           ) VALUES ('batch-late', 'medicine-1', 'B-02', '2026-12-01', 5, 5)"""
    )
    fefo = [
        row["id"]
        for row in db.execute(
            """SELECT id FROM poskestren_medicine_batch
               WHERE medicine_id = 'medicine-1' AND remaining_quantity > 0
               ORDER BY CASE WHEN expires_on IS NULL THEN 1 ELSE 0 END, expires_on, created_at"""
        )
    ]
    assert fefo == ["batch-early", "batch-late"]
    expect_integrity_error(
        db,
        "UPDATE poskestren_medicine_batch SET remaining_quantity = ? WHERE id = ?",
        (-1, "batch-early"),
    )

    db.execute(
        """INSERT INTO poskestren_finance_transaction(
             id, transaction_date, transaction_type, account_id, category_id,
             amount_rupiah, description, source_type, source_id, created_by
           ) VALUES (
             'tx-purchase', '2026-07-01', 'EXPENSE', 'pos-cash-default',
             'pos-expense-medicine', 50000, 'Belanja obat uji',
             'MEDICINE_PURCHASE', 'purchase-1', 'u1'
           )"""
    )
    expect_integrity_error(
        db,
        """INSERT INTO poskestren_finance_transaction(
             id, transaction_date, transaction_type, account_id, amount_rupiah,
             description, source_type, source_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            "tx-purchase-duplicate",
            "2026-07-01",
            "EXPENSE",
            "pos-cash-default",
            50_000,
            "Duplikat",
            "MEDICINE_PURCHASE",
            "purchase-1",
        ),
    )

    db.execute(
        "INSERT INTO poskestren_search_fts(entity_type, entity_id, text_content) VALUES ('MEDICINE', 'medicine-1', 'Obat Uji demam')"
    )
    assert db.execute(
        "SELECT COUNT(*) FROM poskestren_search_fts WHERE entity_type = 'MEDICINE' AND poskestren_search_fts MATCH 'demam*'"
    ).fetchone()[0] == 1

    visit_plan = " ".join(
        row[3]
        for row in db.execute(
            """EXPLAIN QUERY PLAN
               SELECT id FROM poskestren_visit
               WHERE queue_date = '2026-07-20' AND status = 'SELESAI'
               ORDER BY queue_number"""
        )
    )
    movement_plan = " ".join(
        row[3]
        for row in db.execute(
            """EXPLAIN QUERY PLAN
               SELECT id FROM poskestren_stock_movement
               WHERE movement_date BETWEEN '2026-07-01' AND '2026-07-31'
                 AND medicine_id = 'medicine-1'"""
        )
    )
    assert "idx_pos_visit_queue" in visit_plan
    assert "idx_pos_stock_movement_period" in movement_plan

    print(
        json.dumps(
            {
                "migration": "ok",
                "legacy_data_sakit_unchanged": True,
                "constraints": "ok",
                "fts5": "ok",
                "payroll_expected": session_total + patient_total,
                "visit_query_plan": visit_plan,
                "stock_query_plan": movement_plan,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
