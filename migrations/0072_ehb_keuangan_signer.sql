CREATE TABLE IF NOT EXISTS ehb_keuangan_signer (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id   INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  role           TEXT NOT NULL,
  nama           TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT,
  UNIQUE(ehb_event_id, role)
);
