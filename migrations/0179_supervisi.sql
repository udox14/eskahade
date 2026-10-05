-- Additive migration. No existing masters or historical data are changed.
CREATE TABLE IF NOT EXISTS supervisi_kegiatan (
 id TEXT PRIMARY KEY, nama TEXT NOT NULL, tahun_ajaran_id INTEGER NOT NULL REFERENCES tahun_ajaran(id),
 status TEXT NOT NULL DEFAULT 'persiapan' CHECK(status IN ('persiapan','terbuka','ditutup')),
 revision INTEGER NOT NULL DEFAULT 0, actor_id TEXT NOT NULL REFERENCES users(id), reason TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS supervisi_target (
 kegiatan_id TEXT NOT NULL REFERENCES supervisi_kegiatan(id), guru_id INTEGER NOT NULL REFERENCES data_guru(id),
 guru_nama TEXT NOT NULL, kelas_json TEXT NOT NULL CHECK(json_valid(kelas_json)),
 PRIMARY KEY(kegiatan_id,guru_id)
);
CREATE TABLE IF NOT EXISTS supervisi_user_permission (
 user_id TEXT PRIMARY KEY REFERENCES users(id), can_manage_all INTEGER NOT NULL DEFAULT 0 CHECK(can_manage_all IN (0,1))
);
CREATE TABLE IF NOT EXISTS supervisi_wawancara (
 id TEXT PRIMARY KEY, kegiatan_id TEXT NOT NULL, guru_id INTEGER NOT NULL,
 owner_id TEXT NOT NULL REFERENCES users(id), identity_json TEXT NOT NULL CHECK(json_valid(identity_json)),
 answers_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(answers_json)), instrument_version INTEGER NOT NULL DEFAULT 1,
 tanggal TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','selesai')),
 revision INTEGER NOT NULL DEFAULT 0, completed_count INTEGER NOT NULL DEFAULT 0 CHECK(completed_count BETWEEN 0 AND 53),
 actor_id TEXT NOT NULL REFERENCES users(id), operation_id TEXT NOT NULL, action TEXT NOT NULL DEFAULT 'start', reason TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(kegiatan_id,guru_id), FOREIGN KEY(kegiatan_id,guru_id) REFERENCES supervisi_target(kegiatan_id,guru_id)
);
CREATE INDEX IF NOT EXISTS idx_supervisi_owner ON supervisi_wawancara(owner_id,kegiatan_id,status);
CREATE TABLE IF NOT EXISTS supervisi_history (
 id INTEGER PRIMARY KEY, wawancara_id TEXT NOT NULL REFERENCES supervisi_wawancara(id),
 operation_id TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, reason TEXT,
 revision INTEGER NOT NULL, before_json TEXT, after_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(wawancara_id,operation_id)
);
CREATE TABLE IF NOT EXISTS supervisi_kegiatan_history (
 id INTEGER PRIMARY KEY, kegiatan_id TEXT NOT NULL REFERENCES supervisi_kegiatan(id), actor_id TEXT NOT NULL REFERENCES users(id),
 before_status TEXT, after_status TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TRIGGER IF NOT EXISTS supervisi_target_insert_guard BEFORE INSERT ON supervisi_target
 WHEN (SELECT status FROM supervisi_kegiatan WHERE id=NEW.kegiatan_id) <> 'persiapan'
 BEGIN SELECT RAISE(ABORT,'Target kegiatan sudah dibekukan'); END;
CREATE TRIGGER IF NOT EXISTS supervisi_target_update_guard BEFORE UPDATE ON supervisi_target
 BEGIN SELECT RAISE(ABORT,'Target tidak dapat diubah'); END;
CREATE TRIGGER IF NOT EXISTS supervisi_target_delete_guard BEFORE DELETE ON supervisi_target
 WHEN (SELECT status FROM supervisi_kegiatan WHERE id=OLD.kegiatan_id) <> 'persiapan'
 BEGIN SELECT RAISE(ABORT,'Target kegiatan sudah dibekukan'); END;
CREATE TRIGGER IF NOT EXISTS supervisi_start_guard BEFORE INSERT ON supervisi_wawancara
 WHEN (SELECT status FROM supervisi_kegiatan WHERE id=NEW.kegiatan_id) <> 'terbuka'
 BEGIN SELECT RAISE(ABORT,'Kegiatan tidak terbuka'); END;
CREATE TRIGGER IF NOT EXISTS supervisi_write_guard BEFORE UPDATE ON supervisi_wawancara
 BEGIN
 SELECT CASE WHEN (SELECT status FROM supervisi_kegiatan WHERE id=OLD.kegiatan_id) <> 'terbuka' THEN RAISE(ABORT,'Kegiatan tidak terbuka') END;
 SELECT CASE WHEN NEW.revision <> OLD.revision+1 THEN RAISE(ABORT,'Revisi tidak valid') END;
 SELECT CASE WHEN OLD.status='selesai' AND (NEW.action<>'reopen' OR NEW.status<>'draft' OR length(trim(COALESCE(NEW.reason,'')))=0 OR NEW.answers_json<>OLD.answers_json) THEN RAISE(ABORT,'Hasil terkunci') END;
 SELECT CASE WHEN NEW.status='selesai' AND NEW.completed_count<>53 THEN RAISE(ABORT,'Jawaban belum lengkap') END;
 SELECT CASE WHEN NEW.kegiatan_id<>OLD.kegiatan_id OR NEW.owner_id<>OLD.owner_id THEN RAISE(ABORT,'Identitas terkunci') END;
 SELECT CASE WHEN (NEW.identity_json<>OLD.identity_json OR NEW.guru_id<>OLD.guru_id) AND (OLD.status<>'draft' OR NEW.action<>'identity' OR EXISTS(SELECT 1 FROM json_each(OLD.answers_json))) THEN RAISE(ABORT,'Identitas terkunci') END;
 SELECT CASE WHEN NEW.action='identity' AND (NEW.answers_json<>OLD.answers_json OR NEW.status<>'draft') THEN RAISE(ABORT,'Koreksi identitas tidak boleh mengubah jawaban') END;
 END;
CREATE TRIGGER IF NOT EXISTS supervisi_insert_audit AFTER INSERT ON supervisi_wawancara BEGIN
 INSERT INTO supervisi_history(wawancara_id,operation_id,actor_id,action,revision,after_json)
 VALUES(NEW.id,NEW.operation_id,NEW.actor_id,'start',NEW.revision,json_object('answers',json(NEW.answers_json),'identity',json(NEW.identity_json),'tanggal',NEW.tanggal,'status',NEW.status));
 END;
CREATE TRIGGER IF NOT EXISTS supervisi_update_audit AFTER UPDATE ON supervisi_wawancara BEGIN
 INSERT INTO supervisi_history(wawancara_id,operation_id,actor_id,action,reason,revision,before_json,after_json)
 VALUES(NEW.id,NEW.operation_id,NEW.actor_id,NEW.action,NEW.reason,NEW.revision,
 json_object('answers',json(OLD.answers_json),'identity',json(OLD.identity_json),'guru_id',OLD.guru_id,'tanggal',OLD.tanggal,'status',OLD.status),
 json_object('answers',json(NEW.answers_json),'identity',json(NEW.identity_json),'guru_id',NEW.guru_id,'tanggal',NEW.tanggal,'status',NEW.status));
 END;
CREATE TRIGGER IF NOT EXISTS supervisi_no_delete BEFORE DELETE ON supervisi_wawancara BEGIN SELECT RAISE(ABORT,'Histori supervisi harus dipertahankan'); END;
CREATE TRIGGER IF NOT EXISTS supervisi_history_no_update BEFORE UPDATE ON supervisi_history BEGIN SELECT RAISE(ABORT,'Riwayat tidak dapat diubah'); END;
CREATE TRIGGER IF NOT EXISTS supervisi_history_no_delete BEFORE DELETE ON supervisi_history BEGIN SELECT RAISE(ABORT,'Riwayat tidak dapat dihapus'); END;
CREATE TRIGGER IF NOT EXISTS supervisi_kegiatan_insert_audit AFTER INSERT ON supervisi_kegiatan BEGIN
 INSERT INTO supervisi_kegiatan_history(kegiatan_id,actor_id,after_status) VALUES(NEW.id,NEW.actor_id,NEW.status); END;
CREATE TRIGGER IF NOT EXISTS supervisi_kegiatan_update_audit AFTER UPDATE ON supervisi_kegiatan BEGIN
 INSERT INTO supervisi_kegiatan_history(kegiatan_id,actor_id,before_status,after_status,reason) VALUES(NEW.id,NEW.actor_id,OLD.status,NEW.status,NEW.reason); END;
INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan)
 VALUES('Sekpen','Supervisi','/dashboard/sekpen/supervisi','ClipboardCheck','["admin"]',1,20);
INSERT OR IGNORE INTO sidebar_groups(group_name,label,urutan,is_active) VALUES('Sekpen','Sekpen',35,1);
