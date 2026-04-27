-- ============================================================
-- Migration 0034: Honor Panitia EHB
-- ============================================================

CREATE TABLE IF NOT EXISTS ehb_honor_panitia (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  panitia_id     INTEGER NOT NULL REFERENCES ehb_panitia(id) ON DELETE CASCADE,
  nominal        INTEGER NOT NULL DEFAULT 0,
  keterangan     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT,
  UNIQUE(ehb_event_id, panitia_id)
);

CREATE INDEX IF NOT EXISTS idx_ehb_honor_panitia_event
  ON ehb_honor_panitia(ehb_event_id, panitia_id);
