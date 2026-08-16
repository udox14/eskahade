-- Finance migration 0008: skip tagihan Uang Makan/Laundry per santri per
-- bulan — dicek di generateMonthlyServiceBills sebelum insert finance_bills.
-- Pola sama seperti spp_tagihan_ditiadakan (DB utama), khusus MAKAN/LAUNDRY
-- karena generator tagihannya jalan di sini (FINANCE_DB).

CREATE TABLE IF NOT EXISTS finance_service_bill_skip (
  id          TEXT PRIMARY KEY,
  santri_id   TEXT NOT NULL,
  service_kind TEXT NOT NULL CHECK (service_kind IN ('MAKAN','LAUNDRY')),
  tahun       INTEGER NOT NULL,
  bulan       INTEGER NOT NULL,
  alasan      TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(santri_id, service_kind, tahun, bulan)
);

CREATE INDEX IF NOT EXISTS idx_finance_service_bill_skip_santri
  ON finance_service_bill_skip(santri_id, service_kind, tahun, bulan, is_active);

CREATE INDEX IF NOT EXISTS idx_finance_service_bill_skip_period
  ON finance_service_bill_skip(service_kind, tahun, bulan, is_active);
