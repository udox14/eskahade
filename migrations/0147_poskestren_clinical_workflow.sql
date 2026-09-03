ALTER TABLE poskestren_patient ADD COLUMN profile_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE poskestren_visit ADD COLUMN clinical_snapshot TEXT;
ALTER TABLE poskestren_visit ADD COLUMN fee_category TEXT NOT NULL DEFAULT 'NORMAL' CHECK (fee_category IN ('NORMAL','TREATMENT'));
UPDATE poskestren_visit SET fee_category = 'TREATMENT' WHERE TRIM(COALESCE(treatment,'')) <> '';
ALTER TABLE poskestren_dorm_visit ADD COLUMN status TEXT NOT NULL DEFAULT 'LEGACY' CHECK (status IN ('LEGACY','MENUNGGU','DIPERIKSA','SELESAI'));
ALTER TABLE poskestren_dorm_visit ADD COLUMN personnel_id TEXT REFERENCES poskestren_personnel(id);
ALTER TABLE poskestren_dorm_visit ADD COLUMN completed_at TEXT;
ALTER TABLE poskestren_dorm_visit ADD COLUMN allergies_snapshot TEXT;
CREATE TABLE poskestren_clinical_exam (
 id TEXT PRIMARY KEY,
 dorm_visit_id TEXT UNIQUE REFERENCES poskestren_dorm_visit(id),
 observation_id TEXT REFERENCES poskestren_observation(id),
 personnel_id TEXT NOT NULL REFERENCES poskestren_personnel(id),
 examined_at TEXT NOT NULL,
 clinical_json TEXT NOT NULL CHECK(json_valid(clinical_json)),
 delivery_status TEXT NOT NULL CHECK(delivery_status IN ('PENDING','DONE','NONE')),
 delivered_at TEXT, delivered_by TEXT REFERENCES users(id),
 created_by TEXT NOT NULL REFERENCES users(id),
 CHECK ((dorm_visit_id IS NOT NULL) + (observation_id IS NOT NULL) = 1)
);
CREATE INDEX idx_pos_clinical_observation ON poskestren_clinical_exam(observation_id, examined_at, id);
CREATE INDEX idx_pos_clinical_delivery ON poskestren_clinical_exam(delivery_status, examined_at, id);
CREATE TABLE poskestren_clinical_prescription_item (
 id TEXT PRIMARY KEY, exam_id TEXT NOT NULL REFERENCES poskestren_clinical_exam(id),
 source_type TEXT NOT NULL CHECK(source_type IN ('STOCK','EXTERNAL')),
 medicine_id TEXT REFERENCES poskestren_medicine(id), medicine_name TEXT NOT NULL, unit TEXT NOT NULL,
 requested_quantity INTEGER NOT NULL CHECK(requested_quantity > 0),
 dispensed_quantity INTEGER NOT NULL DEFAULT 0 CHECK(dispensed_quantity >= 0 AND dispensed_quantity <= requested_quantity),
 dosage TEXT, notes TEXT,
 CHECK ((source_type = 'STOCK' AND medicine_id IS NOT NULL) OR (source_type = 'EXTERNAL' AND medicine_id IS NULL))
);
CREATE INDEX idx_pos_clinical_rx ON poskestren_clinical_prescription_item(exam_id);
CREATE TABLE poskestren_prescription_external_item (
 id TEXT PRIMARY KEY, prescription_id TEXT NOT NULL REFERENCES poskestren_prescription(id) ON DELETE CASCADE,
 medicine_name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), unit TEXT NOT NULL, dosage TEXT, notes TEXT
);
CREATE INDEX idx_pos_external_rx ON poskestren_prescription_external_item(prescription_id);
CREATE TABLE poskestren_operation (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid = 1));
INSERT INTO poskestren_patient(id, santri_id, medical_record_no)
SELECT 'profile-' || s.id, s.id, COALESCE(NULLIF(s.poskestren_code,''), 'RM-' || s.id)
FROM santri s WHERE NOT EXISTS (SELECT 1 FROM poskestren_patient p WHERE p.santri_id = s.id);
CREATE TRIGGER trg_poskestren_permanent_profile AFTER INSERT ON santri BEGIN
 INSERT OR IGNORE INTO poskestren_patient(id, santri_id, medical_record_no)
 VALUES ('profile-' || NEW.id, NEW.id, COALESCE(NULLIF(NEW.poskestren_code,''), 'RM-' || NEW.id));
END;
CREATE TRIGGER trg_poskestren_profile_code AFTER UPDATE OF poskestren_code ON santri
WHEN NEW.poskestren_code IS NOT NULL AND NEW.poskestren_code <> '' BEGIN
 UPDATE poskestren_patient SET medical_record_no = NEW.poskestren_code
 WHERE santri_id = NEW.id AND medical_record_no = 'RM-' || NEW.id;
END;

ALTER TABLE poskestren_observation ADD COLUMN clinical_snapshot TEXT;
CREATE TRIGGER trg_pos_one_active_observation BEFORE INSERT ON poskestren_observation
WHEN NEW.status='ACTIVE' AND EXISTS(SELECT 1 FROM poskestren_observation WHERE patient_id=NEW.patient_id AND status='ACTIVE')
BEGIN SELECT RAISE(ABORT,'Santri masih memiliki observasi aktif.'); END;
