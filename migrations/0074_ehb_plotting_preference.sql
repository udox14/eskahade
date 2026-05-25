CREATE TABLE IF NOT EXISTS ehb_plotting_preference (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ehb_event_id INTEGER NOT NULL REFERENCES ehb_event(id) ON DELETE CASCADE,
  order_json   TEXT NOT NULL DEFAULT '{}',
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ehb_event_id)
);
