-- 0202 — Sistem Notifikasi (in-app, Web Push VAPID, FCM).
-- Fase NOTIF-1. Hanya tabel baru + satu baris menu + dua setting; tidak menyentuh tabel lain.
--
-- Prinsip:
-- * Event bisnis menulis satu baris notif_outbox DI DALAM batch transaksi yang sama
--   (INSERT OR IGNORE, dedupe_key deterministik, tanpa FK) → tidak ada notifikasi untuk
--   transaksi yang gagal dan tidak ada notifikasi ganda saat replay.
-- * Default redaksi/penerima ada di kode (lib/notifications/catalog.ts). notif_event_types
--   hanya menyimpan override admin; NULL = pakai default. Reset = hapus baris.
-- * Inbox & log pengiriman bukan riwayat finansial; boleh dipurge sesuai retensi.

CREATE TABLE IF NOT EXISTS notif_event_types (
  code                TEXT PRIMARY KEY,
  is_enabled          INTEGER CHECK (is_enabled IS NULL OR is_enabled IN (0, 1)),
  is_mandatory        INTEGER CHECK (is_mandatory IS NULL OR is_mandatory IN (0, 1)),
  channels_json       TEXT,
  title_template      TEXT,
  in_app_template     TEXT,
  push_template       TEXT,
  push_privacy        TEXT CHECK (push_privacy IS NULL OR push_privacy IN ('MASKED', 'FULL')),
  recipient_rule_json TEXT,
  updated_by          TEXT,
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS notif_outbox (
  id              TEXT PRIMARY KEY,
  event_code      TEXT NOT NULL,
  dedupe_key      TEXT NOT NULL UNIQUE,
  payload_json    TEXT NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'SKIPPED')),
  attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  claim_until     TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  skip_reason     TEXT,
  last_error      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  processed_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_outbox_due ON notif_outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notif_outbox_event ON notif_outbox(event_code, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id             TEXT PRIMARY KEY,
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('USER', 'SANTRI')),
  recipient_id   TEXT NOT NULL,
  event_code     TEXT NOT NULL,
  category       TEXT NOT NULL,
  outbox_id      TEXT,
  broadcast_id   TEXT,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  push_body      TEXT,
  link           TEXT,
  level          TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'success', 'warning', 'danger')),
  read_at        TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (outbox_id IS NOT NULL OR broadcast_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_outbox_recipient
  ON notifications(outbox_id, recipient_kind, recipient_id) WHERE outbox_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_broadcast_recipient
  ON notifications(broadcast_id, recipient_kind, recipient_id) WHERE broadcast_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_inbox
  ON notifications(recipient_kind, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(recipient_kind, recipient_id) WHERE read_at IS NULL;

-- Perangkat push (NOTIF-2/3). Satu endpoint/token unik; kepemilikan lewat tabel link
-- agar satu HP bisa menerima untuk beberapa santri (kakak-adik) atau staf yang juga wali.
CREATE TABLE IF NOT EXISTS notif_devices (
  id                TEXT PRIMARY KEY,
  channel           TEXT NOT NULL CHECK (channel IN ('WEBPUSH', 'FCM')),
  endpoint_or_token TEXT NOT NULL UNIQUE,
  p256dh            TEXT,
  auth              TEXT,
  platform          TEXT,
  user_agent        TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  failure_count     INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  deactivated_reason TEXT,
  last_success_at   TEXT,
  last_seen_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (channel <> 'WEBPUSH' OR (p256dh IS NOT NULL AND auth IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS notif_device_links (
  device_id  TEXT NOT NULL REFERENCES notif_devices(id),
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('USER', 'SANTRI')),
  owner_id   TEXT NOT NULL,
  linked_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (device_id, owner_kind, owner_id)
);
CREATE INDEX IF NOT EXISTS idx_notif_device_links_owner ON notif_device_links(owner_kind, owner_id);

-- Antrian pengiriman push per (notifikasi, perangkat). UNIQUE mencegah kirim ganda;
-- kegagalan sementara (429/5xx/jaringan) dijadwalkan ulang, tidak memengaruhi inbox.
CREATE TABLE IF NOT EXISTS notif_deliveries (
  id              TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  device_id       TEXT NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('WEBPUSH', 'FCM')),
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'EXPIRED', 'SKIPPED')),
  attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  claim_until     TEXT,
  http_status     INTEGER,
  error_code      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  attempted_at    TEXT,
  UNIQUE (notification_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_due ON notif_deliveries(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_time ON notif_deliveries(created_at);

-- Preferensi penerima per kategori. Event wajib (is_mandatory) mengabaikan mute.
CREATE TABLE IF NOT EXISTS notif_preferences (
  owner_kind     TEXT NOT NULL CHECK (owner_kind IN ('USER', 'SANTRI')),
  owner_id       TEXT NOT NULL,
  category       TEXT NOT NULL,
  in_app_enabled INTEGER NOT NULL DEFAULT 1 CHECK (in_app_enabled IN (0, 1)),
  push_enabled   INTEGER NOT NULL DEFAULT 1 CHECK (push_enabled IN (0, 1)),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (owner_kind, owner_id, category)
);

-- Broadcast/pengumuman manual (NOTIF-6).
CREATE TABLE IF NOT EXISTS notif_broadcasts (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  link            TEXT,
  audience_json   TEXT NOT NULL,
  channels_json   TEXT NOT NULL,
  scheduled_at    TEXT,
  status          TEXT NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED')),
  recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  cursor          TEXT,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_broadcasts_due ON notif_broadcasts(status, scheduled_at);

-- Cursor scan untuk sumber event dengan banyak writer (mis. finance_reconciliation_items).
CREATE TABLE IF NOT EXISTS notif_source_cursors (
  source     TEXT PRIMARY KEY,
  cursor     TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Kill switch. In-app aktif; push baru diaktifkan eksplisit setelah kredensial siap (NOTIF-2/3).
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('notifications_enabled', '1');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('notifications_push_enabled', '0');

INSERT INTO fitur_akses (group_name, title, href, icon, roles, is_active, urutan)
VALUES ('Master Data', 'Notifikasi', '/dashboard/pengaturan/notifikasi', 'BellRinging', '["admin"]', 1, 93)
ON CONFLICT(href) DO UPDATE SET is_active = 1;
