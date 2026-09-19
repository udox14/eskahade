-- Migration: 0162_finance_distributions.sql
-- Fase 7: Penyaluran Dana (Distribution Engine & Provider Accounts)
-- Sistem Keuangan Baru Pesantren (PRD Bab 24 s.d. 29, Implementation Plan #3.4 & #8)

-- 1. Tabel Header Penyaluran Dana (finance_distributions)
CREATE TABLE IF NOT EXISTS finance_distributions (
    id TEXT PRIMARY KEY,
    distribution_number TEXT NOT NULL UNIQUE,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('BENDAHARA', 'KATERING', 'LAUNDRY')),
    recipient_id TEXT REFERENCES master_jasa(id),
    item_type TEXT NOT NULL,
    period TEXT NOT NULL,
    total_amount INTEGER NOT NULL CHECK (total_amount > 0),
    method TEXT NOT NULL CHECK (method IN ('TRANSFER', 'CASH')),
    destination_bank TEXT,
    destination_account TEXT,
    account_holder_name TEXT,
    proof_attachment_url TEXT,
    transferred_by TEXT NOT NULL REFERENCES users(id),
    transferred_at TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_distributions_recipient
    ON finance_distributions(recipient_type, recipient_id, period);

CREATE INDEX IF NOT EXISTS idx_finance_distributions_item
    ON finance_distributions(item_type, period);

CREATE INDEX IF NOT EXISTS idx_finance_distributions_number
    ON finance_distributions(distribution_number);

CREATE INDEX IF NOT EXISTS idx_finance_distributions_transferred_at
    ON finance_distributions(transferred_at);

-- 2. Tabel Item Penyaluran (finance_distribution_items)
-- Mendukung relasi multi-penyaluran bertahap / parsial ke finance_allocations
CREATE TABLE IF NOT EXISTS finance_distribution_items (
    id TEXT PRIMARY KEY,
    distribution_id TEXT NOT NULL REFERENCES finance_distributions(id),
    allocation_id TEXT NOT NULL REFERENCES finance_allocations(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_distribution_items_dist
    ON finance_distribution_items(distribution_id);

CREATE INDEX IF NOT EXISTS idx_finance_distribution_items_alloc
    ON finance_distribution_items(allocation_id);

-- 3. Tabel Rekening Bank Penyedia Katering & Laundry (finance_provider_accounts)
CREATE TABLE IF NOT EXISTS finance_provider_accounts (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES master_jasa(id),
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_provider_accounts_provider
    ON finance_provider_accounts(provider_id);

-- 4. Trigger Pencegahan Overdraw / Over-Disbursement Alokasi Authoritative
-- Validasi hard guard mutlak terhadap buku transaksi finance_distribution_items,
-- BUKAN terhadap derived cache finance_allocations.disbursed_amount.
CREATE TRIGGER IF NOT EXISTS trg_finance_dist_items_prevent_overdraw
BEFORE INSERT ON finance_distribution_items
FOR EACH ROW
BEGIN
    SELECT
        CASE
            WHEN (
                COALESCE((
                    SELECT SUM(amount)
                    FROM finance_distribution_items
                    WHERE allocation_id = NEW.allocation_id
                ), 0) + NEW.amount
            ) > (
                SELECT amount
                FROM finance_allocations
                WHERE id = NEW.allocation_id
            )
            THEN RAISE(ABORT, 'Total penyaluran melebihi dana alokasi yang tersedia pada alokasi ini.')
        END;
END;

-- 5. Registrasi Menu Penyaluran Dana ke fitur_akses
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES (
    'Keuangan',
    'Penyaluran Dana',
    '/dashboard/keuangan/penyaluran',
    'Send',
    '["admin","bendahara","pimpinan"]',
    1,
    3
);
