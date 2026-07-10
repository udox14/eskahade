-- Migration 0114: Portal Orang Tua
-- Ortu login dengan NIS anak + password (default NIS / tanggal lahir DDMMYYYY,
-- di-provision lazy saat login pertama). Pembayaran SPP & Non-SPP via transfer/QRIS
-- dengan upload bukti → dikonfirmasi petugas (SPP: pengurus asrama / dewan santri
-- utk SADESA; Non-SPP: bendahara).

CREATE TABLE IF NOT EXISTS portal_ortu_credentials (
  santri_id            TEXT PRIMARY KEY REFERENCES santri(id),
  password_hash        TEXT NOT NULL,                 -- format salt_hex:hash_hex (lib/auth/password.ts)
  must_change_password INTEGER NOT NULL DEFAULT 1,
  is_active            INTEGER NOT NULL DEFAULT 1,    -- 0 = login diblokir admin
  last_login_at        TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS portal_payment_submission (
  id             TEXT PRIMARY KEY,
  santri_id      TEXT NOT NULL REFERENCES santri(id),
  kategori       TEXT NOT NULL,            -- 'SPP' | 'NON_SPP'
  detail_json    TEXT NOT NULL,            -- SPP: [{source,historis_id,tahun,bulan,nominal}]
                                           -- NON_SPP: [{jenis_biaya,tahun_ajaran_id,tahun_tagihan,nominal}]
  jumlah         INTEGER NOT NULL,         -- total rupiah (selalu dihitung ulang server-side)
  metode         TEXT NOT NULL,            -- 'TRANSFER' | 'QRIS'
  bank_tujuan    TEXT,                     -- snapshot JSON rekening terpilih (metode TRANSFER)
  bukti_url      TEXT,                     -- /api/file/bukti-portal/...
  status         TEXT NOT NULL DEFAULT 'menunggu_konfirmasi',
                                           -- menunggu_konfirmasi | terkonfirmasi | ditolak | dibatalkan
  catatan_ortu   TEXT,
  confirmed_by   TEXT REFERENCES users(id),
  confirmed_at   TEXT,
  rejected_by    TEXT REFERENCES users(id),
  rejected_at    TEXT,
  reject_reason  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_portal_submission_santri ON portal_payment_submission(santri_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_submission_status ON portal_payment_submission(kategori, status);
-- Anti double-submit: maksimal 1 pengajuan pending per santri per kategori
CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_submission_pending
  ON portal_payment_submission(santri_id, kategori)
  WHERE status = 'menunggu_konfirmasi';

-- Tag baris ledger hasil konfirmasi portal (pola psb_receipt_id di 0069):
-- baris bertag tidak boleh dibatalkan dari halaman SPP biasa.
ALTER TABLE spp_log            ADD COLUMN portal_submission_id TEXT REFERENCES portal_payment_submission(id);
ALTER TABLE pembayaran_tahunan ADD COLUMN portal_submission_id TEXT REFERENCES portal_payment_submission(id);

-- Rekening tujuan + QRIS untuk wizard pembayaran portal
INSERT OR IGNORE INTO app_settings (key, value)
VALUES ('portal_payment_channels', '{"banks":[],"qris_url":null}');

-- Menu sidebar
INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan) VALUES
('Keuangan Santri', 'Konfirmasi SPP Portal',     '/dashboard/asrama/spp/konfirmasi-portal',       'ShieldCheck',        '["admin","pengurus_asrama","dewan_santri"]', 1, 90),
('Keuangan Pusat',  'Konfirmasi Non-SPP Portal', '/dashboard/keuangan/non-spp/konfirmasi-portal', 'ShieldCheck',        '["admin","bendahara"]',                      1, 91),
('Master Data',     'Portal Ortu',               '/dashboard/pengaturan/portal-ortu',             'IdentificationCard', '["admin"]',                                  1, 92);
