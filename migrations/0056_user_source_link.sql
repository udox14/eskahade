ALTER TABLE users ADD COLUMN source_type TEXT;
ALTER TABLE users ADD COLUMN source_ref_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_source_unique
  ON users(source_type, source_ref_id)
  WHERE source_type IS NOT NULL AND source_ref_id IS NOT NULL;
