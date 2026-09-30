-- Optional, private evidence. Keep metadata after expiry; incidents are never deleted.
CREATE TABLE pengajian_violation_photos (
 violation_id TEXT UNIQUE REFERENCES pengajian_violations(id) ON DELETE SET NULL,
 request_id TEXT PRIMARY KEY NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 content_hash TEXT NOT NULL,
 byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 122880),
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','attached','deleted')),
 deleted_at TEXT
);
CREATE INDEX idx_pengajian_photo_expiry ON pengajian_violation_photos(state, expires_at);
