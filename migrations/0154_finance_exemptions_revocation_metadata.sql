-- Migration: 0154_finance_exemptions_revocation_metadata.sql
-- Add audit and revocation metadata to finance_exemptions (non-destructive revocation)

ALTER TABLE finance_exemptions ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED'));
ALTER TABLE finance_exemptions ADD COLUMN revoked_at TEXT;
ALTER TABLE finance_exemptions ADD COLUMN revoked_by TEXT REFERENCES users(id);
ALTER TABLE finance_exemptions ADD COLUMN revocation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_finance_exemptions_status
    ON finance_exemptions(status, santri_id);
