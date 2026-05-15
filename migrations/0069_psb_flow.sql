CREATE TABLE IF NOT EXISTS psb_flow (
  id                    TEXT PRIMARY KEY,
  santri_id             TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'VERIFICATION',
  verification_note     TEXT,
  verified_by           TEXT REFERENCES users(id),
  verified_at           TEXT,
  placed_asrama_by      TEXT REFERENCES users(id),
  placed_asrama_at      TEXT,
  placed_kamar_by       TEXT REFERENCES users(id),
  placed_kamar_at       TEXT,
  paid_by               TEXT REFERENCES users(id),
  paid_at               TEXT,
  done_by               TEXT REFERENCES users(id),
  done_at               TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(santri_id)
);

CREATE INDEX IF NOT EXISTS idx_psb_flow_status
  ON psb_flow(status);

CREATE INDEX IF NOT EXISTS idx_psb_flow_santri
  ON psb_flow(santri_id);

CREATE TABLE IF NOT EXISTS psb_payment_receipt (
  id             TEXT PRIMARY KEY,
  receipt_no     TEXT NOT NULL UNIQUE,
  santri_id      TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  tahun_tagihan  INTEGER NOT NULL,
  total          INTEGER NOT NULL DEFAULT 0,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_psb_payment_receipt_santri
  ON psb_payment_receipt(santri_id);

ALTER TABLE pembayaran_tahunan ADD COLUMN psb_receipt_id TEXT REFERENCES psb_payment_receipt(id);

CREATE INDEX IF NOT EXISTS idx_pembayaran_tahunan_psb_receipt
  ON pembayaran_tahunan(psb_receipt_id);

INSERT OR IGNORE INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES
  ('PSB', 'Flow PSB', '/dashboard/psb', 'ClipboardList', '["admin","sekpen","pengurus_asrama","bendahara"]', 1, 0),
  ('PSB', 'Monitoring PSB', '/dashboard/psb/monitoring', 'BarChart3', '["admin","dewan_santri"]', 1, 1);

INSERT OR IGNORE INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
VALUES
  ('/dashboard/psb', 'sekpen', 1, 1, 0, datetime('now'), datetime('now')),
  ('/dashboard/psb', 'pengurus_asrama', 0, 1, 0, datetime('now'), datetime('now')),
  ('/dashboard/psb', 'bendahara', 1, 1, 0, datetime('now'), datetime('now')),
  ('/dashboard/psb/monitoring', 'dewan_santri', 0, 0, 0, datetime('now'), datetime('now'));
