-- Migration: 0152_finance_tariffs_and_obligations.sql
-- Fase 2A: Fondasi Schema Tarif, Pembebasan, dan Kewajiban (Obligations)
-- Sistem Keuangan Baru Pesantren

-- 1. Tabel Master & Riwayat Tarif
CREATE TABLE IF NOT EXISTS finance_tariffs (
    id TEXT PRIMARY KEY,
    item_type TEXT NOT NULL CHECK (item_type IN ('SPP', 'UANG_MAKAN', 'UANG_NYUCI', 'EHB', 'EKSKUL', 'KESEHATAN', 'USPP')),
    academic_year_id INTEGER REFERENCES tahun_ajaran(id),
    nominal INTEGER NOT NULL CHECK (nominal >= 0),
    installment_rule TEXT NOT NULL DEFAULT 'DISALLOWED' CHECK (installment_rule IN ('DISALLOWED', 'ALLOWED')),
    effective_from TEXT NOT NULL,
    effective_until TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (
      (item_type = 'SPP' AND installment_rule = 'DISALLOWED') OR
      (item_type = 'USPP' AND installment_rule = 'ALLOWED') OR
      (item_type NOT IN ('SPP', 'USPP') AND installment_rule IN ('DISALLOWED', 'ALLOWED'))
    )
);

CREATE INDEX IF NOT EXISTS idx_finance_tariffs_lookup
    ON finance_tariffs(item_type, academic_year_id, effective_from, effective_until);

CREATE INDEX IF NOT EXISTS idx_finance_tariffs_academic_year
    ON finance_tariffs(academic_year_id);

-- 2. Tabel Pembebasan Biaya Santri
CREATE TABLE IF NOT EXISTS finance_exemptions (
    id TEXT PRIMARY KEY,
    santri_id TEXT NOT NULL REFERENCES santri(id),
    item_type TEXT NOT NULL CHECK (item_type IN ('ALL', 'SPP', 'UANG_MAKAN', 'UANG_NYUCI', 'EHB', 'EKSKUL', 'KESEHATAN', 'USPP')),
    academic_year_id INTEGER REFERENCES tahun_ajaran(id),
    period_start TEXT,
    period_end TEXT,
    reason TEXT NOT NULL,
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_exemptions_santri
    ON finance_exemptions(santri_id, item_type);

CREATE INDEX IF NOT EXISTS idx_finance_exemptions_academic_year
    ON finance_exemptions(academic_year_id);

-- 3. Tabel Kewajiban / Tagihan Santri
CREATE TABLE IF NOT EXISTS finance_obligations (
    id TEXT PRIMARY KEY,
    santri_id TEXT NOT NULL REFERENCES santri(id),
    item_type TEXT NOT NULL CHECK (item_type IN ('SPP', 'UANG_MAKAN', 'UANG_NYUCI', 'EHB', 'EKSKUL', 'KESEHATAN', 'USPP')),
    academic_year_id INTEGER REFERENCES tahun_ajaran(id),
    period TEXT NOT NULL,
    tariff_id TEXT REFERENCES finance_tariffs(id),
    amount_expected INTEGER NOT NULL CHECK (amount_expected >= 0),
    amount_exempted INTEGER NOT NULL DEFAULT 0 CHECK (amount_exempted >= 0 AND amount_exempted <= amount_expected),
    amount_paid INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'EXEMPTED')),
    provider_id TEXT REFERENCES master_jasa(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (santri_id, item_type, period)
);

CREATE INDEX IF NOT EXISTS idx_finance_obligations_santri
    ON finance_obligations(santri_id);

CREATE INDEX IF NOT EXISTS idx_finance_obligations_status
    ON finance_obligations(status);

CREATE INDEX IF NOT EXISTS idx_finance_obligations_period
    ON finance_obligations(period);

CREATE INDEX IF NOT EXISTS idx_finance_obligations_item
    ON finance_obligations(item_type);

CREATE INDEX IF NOT EXISTS idx_finance_obligations_academic_year
    ON finance_obligations(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_finance_obligations_provider
    ON finance_obligations(provider_id);
