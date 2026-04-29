-- ============================================================
-- Migration 0049: Episode Data Sakit
-- ============================================================

ALTER TABLE absen_sakit ADD COLUMN episode_id TEXT;
ALTER TABLE absen_sakit ADD COLUMN status_sakit TEXT NOT NULL DEFAULT 'SAKIT';
ALTER TABLE absen_sakit ADD COLUMN mulai_at TEXT;
ALTER TABLE absen_sakit ADD COLUMN sembuh_at TEXT;

UPDATE absen_sakit
SET episode_id = id
WHERE episode_id IS NULL OR episode_id = '';

UPDATE absen_sakit
SET mulai_at = COALESCE(mulai_at, tanggal || 'T00:00:00.000Z')
WHERE mulai_at IS NULL OR mulai_at = '';

CREATE INDEX IF NOT EXISTS idx_absen_sakit_episode ON absen_sakit(episode_id);
CREATE INDEX IF NOT EXISTS idx_absen_sakit_status ON absen_sakit(status_sakit, sembuh_at);
