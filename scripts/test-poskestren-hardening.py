"""Additional empty/legacy migration and role-unlink tests for POSKESTREN."""

from __future__ import annotations

import importlib.util
import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASE_TEST = ROOT / "scripts" / "test-poskestren-invariants.py"
MIGRATION_0124 = ROOT / "migrations" / "0124_poskestren.sql"
MIGRATION_0125 = ROOT / "migrations" / "0125_poskestren_hardening.sql"

spec = importlib.util.spec_from_file_location("poskestren_invariants", BASE_TEST)
assert spec and spec.loader
invariants = importlib.util.module_from_spec(spec)
spec.loader.exec_module(invariants)


def apply_poskestren(connection: sqlite3.Connection) -> None:
    connection.executescript(MIGRATION_0124.read_text(encoding="utf-8"))
    connection.executescript(MIGRATION_0125.read_text(encoding="utf-8"))


def empty_base_test() -> None:
    connection = sqlite3.connect(":memory:")
    invariants.create_legacy_fixture(connection)
    connection.executescript(
        """
        DELETE FROM absen_sakit;
        DELETE FROM santri;
        DELETE FROM users;
        """
    )
    apply_poskestren(connection)
    assert connection.execute(
        "SELECT COUNT(*) FROM fitur_akses WHERE group_name = 'POSKESTREN'"
    ).fetchone()[0] == 5


def legacy_and_unlink_test() -> None:
    connection = sqlite3.connect(":memory:")
    invariants.create_legacy_fixture(connection)
    apply_poskestren(connection)
    connection.execute(
        """UPDATE users
           SET roles = '["wali_kelas","poskestren","poskestren:bendahara"]',
               poskestren_jabatan = 'bendahara'
           WHERE id = 'u1'"""
    )
    connection.execute(
        """INSERT INTO users(id, full_name, role, roles)
           VALUES ('u2', 'Petugas Baru', 'wali_kelas', '["wali_kelas"]')"""
    )
    connection.execute(
        """INSERT INTO poskestren_personnel(
             id, user_id, personnel_type, full_name
           ) VALUES ('personnel-1', 'u1', 'MEDICAL', 'Petugas Lama')"""
    )
    connection.execute(
        "UPDATE poskestren_personnel SET user_id = 'u2' WHERE id = 'personnel-1'"
    )
    old_user = connection.execute(
        "SELECT roles, poskestren_jabatan FROM users WHERE id = 'u1'"
    ).fetchone()
    assert json.loads(old_user[0]) == ["wali_kelas"]
    assert old_user[1] is None

    indexes = {
        row[1]
        for row in connection.execute(
            "PRAGMA index_list('poskestren_stock_movement')"
        )
    }
    assert "idx_pos_stock_movement_medicine_period" in indexes
    assert "idx_pos_stock_movement_cursor" in indexes


if __name__ == "__main__":
    empty_base_test()
    legacy_and_unlink_test()
    print(
        json.dumps(
            {
                "empty_database_migration": "ok",
                "legacy_database_migration": "ok",
                "former_account_role_cleanup": "ok",
                "cursor_indexes": "ok",
            },
            indent=2,
        )
    )
