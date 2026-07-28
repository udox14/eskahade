ALTER TABLE kelas ADD COLUMN km_id TEXT REFERENCES santri(id);
ALTER TABLE kelas ADD COLUMN wakil_km_id TEXT REFERENCES santri(id);
ALTER TABLE kelas ADD COLUMN sekretaris_id TEXT REFERENCES santri(id);
ALTER TABLE kelas ADD COLUMN wakil_sekretaris_id TEXT REFERENCES santri(id);
