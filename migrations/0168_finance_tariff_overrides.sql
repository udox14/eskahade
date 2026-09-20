-- Migration: 0168_finance_tariff_overrides.sql
-- Mendukung Tarif Khusus Periode (Period-Specific Tariff Override)
-- Terutama untuk UANG_MAKAN (Ramadan/Libur) dan UANG_NYUCI
-- Memiliki presedensi lebih tinggi daripada tarif dasar di finance_tariffs
-- Tanpa memicu trigger overlap pada finance_tariffs (0153).

CREATE TABLE IF NOT EXISTS finance_tariff_overrides (
    id TEXT PRIMARY KEY,
    item_type TEXT NOT NULL CHECK (item_type IN ('SPP', 'UANG_MAKAN', 'UANG_NYUCI', 'EHB', 'EKSKUL', 'KESEHATAN', 'USPP')),
    period TEXT NOT NULL, -- Format YYYY-MM
    nominal INTEGER NOT NULL CHECK (nominal >= 0),
    academic_year_id INTEGER REFERENCES tahun_ajaran(id),
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (item_type, period)
);

CREATE INDEX IF NOT EXISTS idx_finance_tariff_overrides_lookup
    ON finance_tariff_overrides(item_type, period);

CREATE INDEX IF NOT EXISTS idx_finance_tariff_overrides_ta
    ON finance_tariff_overrides(academic_year_id);
