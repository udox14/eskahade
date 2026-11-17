CREATE TABLE ehb_rab_revision (
  ehb_event_id INTEGER PRIMARY KEY REFERENCES ehb_event(id) ON DELETE CASCADE,
  revision TEXT NOT NULL,
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL
);

ALTER TABLE ehb_rab_item ADD COLUMN client_key TEXT;

CREATE UNIQUE INDEX idx_ehb_rab_item_event_client_key
  ON ehb_rab_item(ehb_event_id, client_key) WHERE client_key IS NOT NULL;

CREATE INDEX idx_ehb_transaksi_rab_item
  ON ehb_keuangan_transaksi(rab_item_id) WHERE rab_item_id IS NOT NULL;
