-- Standalone manual pengajian violations. No changes to legacy violations.
CREATE TABLE pengajian_violation_types (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 description TEXT NOT NULL DEFAULT '',
 position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1,
 updated_by TEXT REFERENCES users(id),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX idx_pengajian_type_name ON pengajian_violation_types(lower(trim(name)));

CREATE TABLE pengajian_violations (
 id TEXT PRIMARY KEY,
 santri_id TEXT NOT NULL REFERENCES santri(id),
 type_id TEXT NOT NULL REFERENCES pengajian_violation_types(id),
 type_name TEXT NOT NULL,
 occurred_at TEXT NOT NULL,
 session TEXT NOT NULL CHECK(session IN ('shubuh','ashar','maghrib')),
 note TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL,
 updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at TEXT NOT NULL,
 reason TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1,
 request_id TEXT NOT NULL UNIQUE
);
CREATE INDEX idx_pengajian_violations_santri_date ON pengajian_violations(santri_id, status, occurred_at DESC);
CREATE INDEX idx_pengajian_violations_date ON pengajian_violations(status, occurred_at DESC, id);
CREATE INDEX idx_pengajian_violations_type ON pengajian_violations(type_id, occurred_at);
CREATE INDEX idx_pengajian_violations_actor ON pengajian_violations(created_by);

CREATE TABLE pengajian_violation_revisions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 violation_id TEXT REFERENCES pengajian_violations(id),
 type_id TEXT REFERENCES pengajian_violation_types(id),
 actor_id TEXT NOT NULL REFERENCES users(id),
 changed_at TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('create','update','cancel','type_update')),
 request_id TEXT UNIQUE,
 reason TEXT NOT NULL,
 before_json TEXT,
 after_json TEXT NOT NULL,
 CHECK(violation_id IS NOT NULL OR type_id IS NOT NULL)
);
CREATE INDEX idx_pengajian_revisions_incident ON pengajian_violation_revisions(violation_id, id);

-- Audit triggers run in the same SQLite transaction as the mutation. A failed
-- revision insert aborts the mutation, including when called through D1 batch.
CREATE TRIGGER pengajian_violation_create_audit AFTER INSERT ON pengajian_violations
BEGIN
 INSERT INTO pengajian_violation_revisions(violation_id,actor_id,changed_at,action,request_id,reason,after_json)
 VALUES(NEW.id,NEW.created_by,NEW.created_at,'create',NEW.request_id,'',json_object(
 'santri_id',NEW.santri_id,'type_id',NEW.type_id,'type_name',NEW.type_name,
 'occurred_at',NEW.occurred_at,'session',NEW.session,'note',NEW.note,'status',NEW.status,'version',NEW.version));
END;
CREATE TRIGGER pengajian_violation_update_audit AFTER UPDATE ON pengajian_violations
BEGIN
 INSERT INTO pengajian_violation_revisions(violation_id,actor_id,changed_at,action,request_id,reason,before_json,after_json)
 VALUES(NEW.id,NEW.updated_by,NEW.updated_at,CASE WHEN NEW.status='cancelled' THEN 'cancel' ELSE 'update' END,NEW.request_id,NEW.reason,
 json_object('santri_id',OLD.santri_id,'type_id',OLD.type_id,'type_name',OLD.type_name,'occurred_at',OLD.occurred_at,'session',OLD.session,'note',OLD.note,'status',OLD.status,'version',OLD.version),
 json_object('santri_id',NEW.santri_id,'type_id',NEW.type_id,'type_name',NEW.type_name,'occurred_at',NEW.occurred_at,'session',NEW.session,'note',NEW.note,'status',NEW.status,'version',NEW.version));
END;
CREATE TRIGGER pengajian_type_update_audit AFTER UPDATE ON pengajian_violation_types
BEGIN
 INSERT INTO pengajian_violation_revisions(type_id,actor_id,changed_at,action,reason,before_json,after_json)
 VALUES(NEW.id,NEW.updated_by,NEW.updated_at,'type_update','Pengaturan jenis pelanggaran',
 json_object('name',OLD.name,'description',OLD.description,'position',OLD.position,'active',OLD.active,'version',OLD.version),
 json_object('name',NEW.name,'description',NEW.description,'position',NEW.position,'active',NEW.active,'version',NEW.version));
END;

INSERT INTO pengajian_violation_types(id,name,position) VALUES
 ('terlambat','Terlambat',1),('kitab','Tidak membawa kitab',2),
 ('tidur','Tidur',3),('mengganggu','Mengganggu pengajian',4);

INSERT OR IGNORE INTO fitur_akses(group_name,title,href,icon,roles,is_active,urutan)
 VALUES('Akademik','Pelanggaran Pengajian','/dashboard/akademik/pelanggaran-pengajian','BookOpen','["admin","sekpen","keamanan","guru","wali_kelas"]',1,15);
INSERT OR IGNORE INTO role_fitur_crud_permission(fitur_href,role,can_create,can_update,can_delete)
 SELECT '/dashboard/akademik/pelanggaran-pengajian',value,1,1,1
 FROM json_each('["admin","sekpen","keamanan","guru","wali_kelas"]');
