import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
db = sqlite3.connect(":memory:")
db.executescript(
    """
    CREATE TABLE fitur_akses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_name TEXT NOT NULL,
      title TEXT NOT NULL,
      href TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL,
      roles TEXT NOT NULL,
      is_active INTEGER NOT NULL,
      urutan INTEGER NOT NULL,
      updated_at TEXT
    );
    CREATE TABLE sidebar_groups (
      group_name TEXT PRIMARY KEY,
      label TEXT,
      urutan INTEGER NOT NULL DEFAULT 100,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    """
)

central = [
    ("Ringkasan", "/dashboard/keuangan-terpusat"),
    ("Tagihan", "/dashboard/keuangan-terpusat/tagihan"),
    ("Payout", "/dashboard/keuangan-terpusat/payout"),
    ("Loket", "/dashboard/keuangan-terpusat/loket"),
    ("QR", "/dashboard/keuangan-terpusat/kredensial"),
    ("Transaksi", "/dashboard/keuangan-terpusat/transaksi"),
    ("Pengaturan", "/dashboard/keuangan-terpusat/pengaturan"),
]
units = [
    ("Uang Jajan", "uang-jajan"), ("Makan", "makan"), ("Laundry", "laundry"),
    ("SPP", "spp"), ("Bangunan", "bangunan"), ("Biaya Tahunan", "biaya-tahunan"),
]
legacy = [
    ("Non-SPP", "/dashboard/keuangan/non-spp"),
    ("SPP Baru", "/dashboard/keuangan/setoran-spp-baru"),
    ("Operasional", "/dashboard/keuangan/operasional"),
    ("Alias Bayar", "/dashboard/keuangan/pembayaran"),
    ("Alias Laporan", "/dashboard/keuangan/laporan"),
    ("Alias Tarif", "/dashboard/keuangan/tarif"),
    ("Konfirmasi", "/dashboard/keuangan/non-spp/konfirmasi-portal"),
    ("Uang Jajan", "/dashboard/asrama/uang-jajan"),
    ("Monitoring", "/dashboard/dewan-santri/uang-jajan"),
]
for title, href in central:
    db.execute("INSERT INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan) VALUES('Keuangan Terpusat',?,?,?,'[]',1,1)", (title, href, "Bank"))
for title, slug in units:
    db.execute("INSERT INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan) VALUES('Unit Pembayaran',?,?,?,'[]',1,220)", (title, f"/dashboard/keuangan-terpusat/unit/{slug}", "Wallet"))
for title, href in legacy:
    db.execute("INSERT INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan) VALUES('Keuangan Pusat',?,?,?,'[]',1,1)", (title, href, "Coins"))
db.execute("INSERT INTO sidebar_groups(group_name,label,urutan,is_active) VALUES('Unit Pembayaran','Unit Pembayaran',13,1)")
db.execute("INSERT INTO sidebar_groups(group_name,label,urutan,is_active) VALUES('Keuangan Pusat','Keuangan Pusat',11,1)")

migration = (ROOT / "migrations/0153_payment_work_units_under_central.sql").read_text(encoding="utf-8")
correction = (ROOT / "migrations/0154_restore_central_finance_and_rename_new_system.sql").read_text(encoding="utf-8")
db.executescript(migration)
db.executescript(correction)
db.executescript(migration)
db.executescript(correction)

unit_rows = db.execute("SELECT group_name,title,urutan FROM fitur_akses WHERE href LIKE '/dashboard/keuangan-terpusat/unit/%' ORDER BY urutan").fetchall()
assert len(unit_rows) == 6
assert all(row[0] == "Sistem Keuangan Baru" for row in unit_rows)
assert [row[2] for row in unit_rows] == list(range(201, 207))

core = dict(db.execute("SELECT href,title FROM fitur_akses WHERE href LIKE '/dashboard/keuangan-terpusat%'"))
assert core["/dashboard/keuangan-terpusat/tagihan"] == "Pembayaran Gabungan"
assert core["/dashboard/keuangan-terpusat/payout"] == "Penyaluran Pusat"

non_spp = db.execute("SELECT group_name,title,urutan FROM fitur_akses WHERE href='/dashboard/keuangan/non-spp'").fetchone()
assert non_spp == ("Keuangan Pusat", "Keuangan Non-SPP", 0)
assert db.execute("SELECT group_name,title,urutan FROM fitur_akses WHERE href='/dashboard/keuangan/operasional'").fetchone() == ("Keuangan Pusat", "Operasional Unit", 3)
assert db.execute("SELECT group_name,title,urutan FROM fitur_akses WHERE href='/dashboard/keuangan/setoran-spp-baru'").fetchone() == ("Keuangan Pusat", "Setoran SPP Santri Baru", 4)
assert db.execute("SELECT is_active FROM fitur_akses WHERE href='/dashboard/keuangan/pembayaran'").fetchone()[0] == 0
assert db.execute("SELECT is_active FROM sidebar_groups WHERE group_name='Unit Pembayaran'").fetchone()[0] == 0
assert db.execute("SELECT label,is_active FROM sidebar_groups WHERE group_name='Keuangan Pusat'").fetchone() == ("Keuangan Pusat", 1)
assert db.execute("SELECT label,is_active FROM sidebar_groups WHERE group_name='Sistem Keuangan Baru'").fetchone() == ("Sistem Keuangan Baru", 1)
assert json.loads(db.execute("SELECT roles FROM fitur_akses WHERE href='/dashboard/keuangan-terpusat'").fetchone()[0]) == ["admin", "admin_koperasi", "bendahara"]

print("PASS Sistem Keuangan Baru terpisah; Keuangan Pusat tetap pada susunan lama")
