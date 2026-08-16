-- Migration 0141: Hardening Portal Ortu
--
-- token_version: dibaca dari JWT portal (lib/portal/session.ts) dan
-- dibandingkan dengan nilai di tabel setiap request. Dinaikkan setiap kali
-- password diganti (mandiri) atau direset (admin) sehingga sesi lama yang
-- masih menyimpan cookie lawas otomatis dianggap tidak valid lagi.
ALTER TABLE portal_ortu_credentials ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;

-- Rate limit percobaan login portal per santri (NIS diketahui, password ditebak).
-- Terpisah dari portal_ortu_credentials supaya tidak mengubah makna
-- "punya_kredensial" di layar admin (baris ini bisa ada walau santri belum
-- pernah berhasil login).
CREATE TABLE IF NOT EXISTS portal_login_throttle (
  santri_id       TEXT PRIMARY KEY REFERENCES santri(id),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
