-- Explicit whole-activity deletion only; individual interview/history deletion stays blocked.
CREATE TABLE IF NOT EXISTS supervisi_delete_request (
 token TEXT PRIMARY KEY, kegiatan_id TEXT NOT NULL, revision INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), authorized INTEGER NOT NULL DEFAULT 0 CHECK(authorized IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TRIGGER IF NOT EXISTS supervisi_delete_request_guard BEFORE UPDATE OF authorized ON supervisi_delete_request
 WHEN NEW.authorized=1 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM supervisi_kegiatan WHERE id=NEW.kegiatan_id AND revision=NEW.revision)
 THEN RAISE(ABORT,'Kegiatan berubah. Ulangi konfirmasi penghapusan.') END;
 END;
DROP TRIGGER IF EXISTS supervisi_no_delete;
CREATE TRIGGER supervisi_no_delete BEFORE DELETE ON supervisi_wawancara
 WHEN NOT EXISTS(SELECT 1 FROM supervisi_delete_request WHERE kegiatan_id=OLD.kegiatan_id AND authorized=1)
 BEGIN SELECT RAISE(ABORT,'Hapus melalui kegiatan dengan konfirmasi admin'); END;
DROP TRIGGER IF EXISTS supervisi_history_no_delete;
CREATE TRIGGER supervisi_history_no_delete BEFORE DELETE ON supervisi_history
 WHEN NOT EXISTS(SELECT 1 FROM supervisi_delete_request r JOIN supervisi_wawancara w ON w.kegiatan_id=r.kegiatan_id WHERE w.id=OLD.wawancara_id AND r.authorized=1)
 BEGIN SELECT RAISE(ABORT,'Riwayat tidak dapat dihapus terpisah'); END;
DROP TRIGGER IF EXISTS supervisi_target_delete_guard;
CREATE TRIGGER supervisi_target_delete_guard BEFORE DELETE ON supervisi_target
 WHEN (SELECT status FROM supervisi_kegiatan WHERE id=OLD.kegiatan_id)<>'persiapan'
 AND NOT EXISTS(SELECT 1 FROM supervisi_delete_request WHERE kegiatan_id=OLD.kegiatan_id AND authorized=1)
 BEGIN SELECT RAISE(ABORT,'Target kegiatan sudah dibekukan'); END;
CREATE TRIGGER IF NOT EXISTS supervisi_kegiatan_delete_guard BEFORE DELETE ON supervisi_kegiatan
 WHEN NOT EXISTS(SELECT 1 FROM supervisi_delete_request WHERE kegiatan_id=OLD.id AND revision=OLD.revision AND authorized=1)
 BEGIN SELECT RAISE(ABORT,'Kegiatan memerlukan konfirmasi penghapusan'); END;
