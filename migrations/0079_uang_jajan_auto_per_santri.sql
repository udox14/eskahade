-- Uang Jajan auto mode per asrama, with per-santri auto nominal.

CREATE TABLE IF NOT EXISTS uang_jajan_auto_setting (
  asrama      TEXT PRIMARY KEY,
  mode        TEXT NOT NULL DEFAULT 'MANUAL', -- MANUAL | AUTO
  jam         TEXT NOT NULL DEFAULT '06:00',
  days        TEXT NOT NULL DEFAULT '[1,2,3,4,5,6]',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE uang_jajan_auto_skip ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE uang_jajan_auto_skip ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_uang_jajan_auto_setting_active
  ON uang_jajan_auto_setting(mode, is_active, jam);

CREATE INDEX IF NOT EXISTS idx_uang_jajan_auto_skip_permanent
  ON uang_jajan_auto_skip(santri_id, skip_date, is_active);
