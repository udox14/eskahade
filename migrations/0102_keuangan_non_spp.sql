-- Migration 0102: Keuangan Non-SPP consolidation

ALTER TABLE biaya_settings ADD COLUMN tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id);

DROP INDEX IF EXISTS uq_biaya_settings_tahun_jenis;

CREATE UNIQUE INDEX IF NOT EXISTS uq_biaya_settings_ta_angkatan_jenis
  ON biaya_settings(COALESCE(tahun_ajaran_id, -1), tahun_angkatan, jenis_biaya);

ALTER TABLE pembayaran_tahunan ADD COLUMN tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id);
ALTER TABLE pembayaran_tahunan ADD COLUMN batch_id TEXT;
ALTER TABLE pembayaran_tahunan ADD COLUMN status TEXT NOT NULL DEFAULT 'AKTIF';
ALTER TABLE pembayaran_tahunan ADD COLUMN void_reason TEXT;
ALTER TABLE pembayaran_tahunan ADD COLUMN voided_by TEXT REFERENCES users(id);
ALTER TABLE pembayaran_tahunan ADD COLUMN voided_at TEXT;

CREATE INDEX IF NOT EXISTS idx_pembayaran_non_spp_status_ta
  ON pembayaran_tahunan(status, tahun_ajaran_id, tahun_tagihan);

CREATE INDEX IF NOT EXISTS idx_pembayaran_non_spp_batch
  ON pembayaran_tahunan(batch_id, status);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Keuangan Pusat', 'Keuangan Non-SPP', '/dashboard/keuangan/non-spp', 'HandCoins', '["admin","bendahara"]', 1, 0);

UPDATE fitur_akses
SET is_active = 0, updated_at = datetime('now')
WHERE href IN (
  '/dashboard/keuangan/pembayaran',
  '/dashboard/keuangan/tarif',
  '/dashboard/keuangan/laporan'
);

UPDATE fitur_akses
SET group_name = 'Keuangan Pusat', title = 'Keuangan Non-SPP', icon = 'HandCoins', roles = '["admin","bendahara"]', is_active = 1, urutan = 0, updated_at = datetime('now')
WHERE href = '/dashboard/keuangan/non-spp';
