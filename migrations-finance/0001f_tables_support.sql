-- Migrasi keuangan 0001f - TABEL pendukung: jejak audit, setelan, snapshot master.
-- finance_staff_snapshots dihapus: nama staf di-resolve saat render dari DB utama.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS finance_audit_log (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  asrama_scope TEXT,
  before_json TEXT,
  after_json TEXT,
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS finance_student_snapshots (
  santri_id TEXT PRIMARY KEY,
  nis TEXT NOT NULL,
  full_name TEXT NOT NULL,
  asrama TEXT,
  kamar TEXT,
  photo_url TEXT,
  status_global TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS finance_teacher_snapshots (
  teacher_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_audit_entity ON finance_audit_log(entity_type,entity_id,created_at);
CREATE INDEX IF NOT EXISTS idx_finance_student_snapshot_asrama ON finance_student_snapshots(asrama,status_global);
