"""Contract test for the additive Keuangan Terpusat workspace migration."""

import pathlib
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]


def apply_base(db):
    for suffix in [
        "b_tables_core",
        "c_tables_billing",
        "d_tables_loket",
        "e_tables_payout",
        "f_tables_support",
        "g_triggers",
        "h_seed",
    ]:
        db.executescript((ROOT / f"migrations-finance/0001{suffix}.sql").read_text(encoding="utf-8"))
    db.executescript((ROOT / "migrations-finance/0004_cooperative_item_payments.sql").read_text(encoding="utf-8"))


def apply_once_like_runner(db):
    columns = {row[1] for row in db.execute("PRAGMA table_info(finance_coop_bills)")}
    if "module_code" in columns:
        return "skipped"
    if "category_code" not in columns:
        db.executescript((ROOT / "migrations-finance/0006_central_billing_workspaces.sql").read_text(encoding="utf-8"))
    db.executescript((ROOT / "migrations-finance/0007_payment_work_units.sql").read_text(encoding="utf-8"))
    return "applied"


empty = sqlite3.connect(":memory:")
apply_base(empty)
assert apply_once_like_runner(empty) == "applied"
assert "category_code" in {row[1] for row in empty.execute("PRAGMA table_info(finance_coop_bills)")}
assert "module_code" in {row[1] for row in empty.execute("PRAGMA table_info(finance_coop_bills)")}
assert empty.execute("SELECT COUNT(*) FROM finance_bill_exemptions").fetchone()[0] == 0
assert apply_once_like_runner(empty) == "skipped"

legacy = sqlite3.connect(":memory:")
apply_base(legacy)
legacy.execute(
    "INSERT INTO finance_coop_bills(id,santri_id,kind,title,period_key,recipient_id,amount,created_by) VALUES('old','s1','NON_SPP','Tagihan lama','legacy','pesantren',1000,'staff')"
)
legacy.execute(
    "INSERT INTO finance_coop_tariffs(id,kind,title,amount,effective_month,created_by) VALUES('tarif-old','NON_SPP','Tarif lama',1000,'2025-01','staff')"
)
legacy.commit()
assert apply_once_like_runner(legacy) == "applied"
row = legacy.execute("SELECT kind,category_code,module_code,title,amount FROM finance_coop_bills WHERE id='old'").fetchone()
assert row == ("NON_SPP", None, None, "Tagihan lama", 1000)
assert legacy.execute("SELECT reason FROM finance_module_migration_reconciliation WHERE entity_type='BILL' AND entity_id='old'").fetchone()[0]
assert legacy.execute("SELECT module_code FROM finance_coop_tariffs WHERE id='tarif-old'").fetchone()[0] is None
assert legacy.execute("SELECT reason FROM finance_module_migration_reconciliation WHERE entity_type='TARIFF' AND entity_id='tarif-old'").fetchone()[0]
assert apply_once_like_runner(legacy) == "skipped"
assert legacy.execute("SELECT COUNT(*) FROM finance_coop_bills WHERE id='old'").fetchone()[0] == 1

print("LULUS migrasi workspace: backfill module_code, rekonsiliasi data lama, dan eksekusi ulang aman")
