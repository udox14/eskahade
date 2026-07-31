-- ============================================================
-- Migration 0126: POSKESTREN clinical expansion
-- Permanent health identity, diagnosis master, dorm visits,
-- observations, outside treatment, and simplified stock indexes.
-- ============================================================

ALTER TABLE santri ADD COLUMN poskestren_code TEXT;

WITH ranked AS (
  SELECT
    id,
    CASE
      WHEN UPPER(SUBSTR(TRIM(nama_lengkap), 1, 1)) GLOB '[A-Z]'
        THEN UPPER(SUBSTR(TRIM(nama_lengkap), 1, 1))
      ELSE 'X'
    END AS initial_letter,
    ROW_NUMBER() OVER (
      PARTITION BY CASE
        WHEN UPPER(SUBSTR(TRIM(nama_lengkap), 1, 1)) GLOB '[A-Z]'
          THEN UPPER(SUBSTR(TRIM(nama_lengkap), 1, 1))
        ELSE 'X'
      END
      ORDER BY created_at, id
    ) AS sequence_number
  FROM santri
)
UPDATE santri
SET poskestren_code = (
  SELECT ranked.initial_letter || '-' || ranked.sequence_number
  FROM ranked
  WHERE ranked.id = santri.id
)
WHERE poskestren_code IS NULL OR poskestren_code = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_santri_poskestren_code
  ON santri(poskestren_code);

CREATE TABLE IF NOT EXISTS poskestren_patient_code_sequence (
  initial_letter TEXT PRIMARY KEY,
  next_number    INTEGER NOT NULL CHECK (next_number > 0)
);

INSERT INTO poskestren_patient_code_sequence(initial_letter, next_number)
SELECT
  SUBSTR(poskestren_code, 1, 1),
  MAX(CAST(SUBSTR(poskestren_code, INSTR(poskestren_code, '-') + 1) AS INTEGER)) + 1
FROM santri
WHERE poskestren_code IS NOT NULL AND poskestren_code <> ''
GROUP BY SUBSTR(poskestren_code, 1, 1)
ON CONFLICT(initial_letter) DO UPDATE SET
  next_number = MAX(next_number, excluded.next_number);

CREATE TRIGGER IF NOT EXISTS trg_santri_poskestren_code
AFTER INSERT ON santri
WHEN NEW.poskestren_code IS NULL OR NEW.poskestren_code = ''
BEGIN
  INSERT INTO poskestren_patient_code_sequence(initial_letter, next_number)
  VALUES (
    CASE
      WHEN UPPER(SUBSTR(TRIM(NEW.nama_lengkap), 1, 1)) GLOB '[A-Z]'
        THEN UPPER(SUBSTR(TRIM(NEW.nama_lengkap), 1, 1))
      ELSE 'X'
    END,
    2
  )
  ON CONFLICT(initial_letter) DO UPDATE SET next_number = next_number + 1;

  UPDATE santri
  SET poskestren_code = (
    CASE
      WHEN UPPER(SUBSTR(TRIM(NEW.nama_lengkap), 1, 1)) GLOB '[A-Z]'
        THEN UPPER(SUBSTR(TRIM(NEW.nama_lengkap), 1, 1))
      ELSE 'X'
    END
  ) || '-' || (
    SELECT next_number - 1
    FROM poskestren_patient_code_sequence
    WHERE initial_letter = CASE
      WHEN UPPER(SUBSTR(TRIM(NEW.nama_lengkap), 1, 1)) GLOB '[A-Z]'
        THEN UPPER(SUBSTR(TRIM(NEW.nama_lengkap), 1, 1))
      ELSE 'X'
    END
  )
  WHERE id = NEW.id;
END;

ALTER TABLE poskestren_patient ADD COLUMN legacy_medical_record_no TEXT;

UPDATE poskestren_patient
SET legacy_medical_record_no = medical_record_no
WHERE legacy_medical_record_no IS NULL;

UPDATE poskestren_patient
SET medical_record_no = 'LEGACY-' || id;

UPDATE poskestren_patient
SET medical_record_no = (
  SELECT s.poskestren_code
  FROM santri s
  WHERE s.id = poskestren_patient.santri_id
)
WHERE EXISTS (
  SELECT 1 FROM santri s
  WHERE s.id = poskestren_patient.santri_id
    AND s.poskestren_code IS NOT NULL
);

CREATE TABLE IF NOT EXISTS poskestren_diagnosis (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL COLLATE NOCASE UNIQUE,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pos_diagnosis_active_name
  ON poskestren_diagnosis(is_active, name COLLATE NOCASE);

ALTER TABLE poskestren_visit ADD COLUMN diagnosis_id TEXT REFERENCES poskestren_diagnosis(id) ON DELETE SET NULL;
ALTER TABLE poskestren_visit ADD COLUMN updated_by TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_pos_visit_diagnosis_period
  ON poskestren_visit(diagnosis_id, queue_date, status);

CREATE TABLE IF NOT EXISTS poskestren_dorm_visit (
  id                       TEXT PRIMARY KEY,
  patient_id               TEXT NOT NULL REFERENCES poskestren_patient(id),
  visited_at               TEXT NOT NULL,
  temperature_celsius      REAL,
  systolic_pressure        INTEGER,
  diastolic_pressure       INTEGER,
  weight_kg                REAL,
  complaint                TEXT NOT NULL,
  disease_history_snapshot TEXT,
  notes                    TEXT,
  created_by               TEXT REFERENCES users(id),
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by               TEXT REFERENCES users(id),
  updated_at               TEXT
);

CREATE INDEX IF NOT EXISTS idx_pos_dorm_visit_period
  ON poskestren_dorm_visit(visited_at DESC, patient_id);
CREATE INDEX IF NOT EXISTS idx_pos_dorm_visit_patient
  ON poskestren_dorm_visit(patient_id, visited_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS poskestren_dorm_visit_medicine (
  id             TEXT PRIMARY KEY,
  dorm_visit_id  TEXT NOT NULL REFERENCES poskestren_dorm_visit(id) ON DELETE CASCADE,
  source_type    TEXT NOT NULL CHECK (source_type IN ('STOCK','EXTERNAL')),
  medicine_id    TEXT REFERENCES poskestren_medicine(id) ON DELETE SET NULL,
  medicine_name  TEXT NOT NULL,
  quantity_base  INTEGER CHECK (quantity_base IS NULL OR quantity_base > 0),
  dosage         TEXT,
  notes          TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (source_type = 'STOCK' AND medicine_id IS NOT NULL AND quantity_base IS NOT NULL)
    OR source_type = 'EXTERNAL'
  )
);

CREATE INDEX IF NOT EXISTS idx_pos_dorm_medicine_visit
  ON poskestren_dorm_visit_medicine(dorm_visit_id, created_at);

CREATE TABLE IF NOT EXISTS poskestren_observation (
  id                   TEXT PRIMARY KEY,
  patient_id           TEXT NOT NULL REFERENCES poskestren_patient(id),
  admitted_at          TEXT NOT NULL,
  discharged_at        TEXT,
  symptoms             TEXT NOT NULL,
  notes                TEXT,
  status               TEXT NOT NULL DEFAULT 'ACTIVE'
                       CHECK (status IN ('ACTIVE','RECOVERED','REFERRED')),
  referral_destination TEXT,
  created_by           TEXT REFERENCES users(id),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by           TEXT REFERENCES users(id),
  updated_at           TEXT,
  CHECK (
    status = 'ACTIVE'
    OR (discharged_at IS NOT NULL AND status = 'RECOVERED')
    OR (discharged_at IS NOT NULL AND status = 'REFERRED' AND referral_destination IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pos_observation_status_period
  ON poskestren_observation(status, admitted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pos_observation_patient
  ON poskestren_observation(patient_id, admitted_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_observation_one_active
  ON poskestren_observation(patient_id)
  WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS poskestren_observation_medicine (
  id              TEXT PRIMARY KEY,
  observation_id  TEXT NOT NULL REFERENCES poskestren_observation(id) ON DELETE CASCADE,
  administered_at TEXT NOT NULL,
  source_type     TEXT NOT NULL CHECK (source_type IN ('STOCK','EXTERNAL')),
  medicine_id     TEXT REFERENCES poskestren_medicine(id) ON DELETE SET NULL,
  medicine_name   TEXT NOT NULL,
  quantity_base   INTEGER CHECK (quantity_base IS NULL OR quantity_base > 0),
  dosage          TEXT,
  notes           TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (source_type = 'STOCK' AND medicine_id IS NOT NULL AND quantity_base IS NOT NULL)
    OR source_type = 'EXTERNAL'
  )
);

CREATE INDEX IF NOT EXISTS idx_pos_observation_medicine
  ON poskestren_observation_medicine(observation_id, administered_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS poskestren_outside_reference (
  id             TEXT PRIMARY KEY,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('REGION','PROVIDER','DRIVER')),
  name           TEXT NOT NULL COLLATE NOCASE,
  is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT,
  UNIQUE(reference_type, name)
);

CREATE INDEX IF NOT EXISTS idx_pos_outside_reference
  ON poskestren_outside_reference(reference_type, is_active, name COLLATE NOCASE);

INSERT OR IGNORE INTO poskestren_outside_reference(id, reference_type, name, is_active)
VALUES
  ('pos-region-pesantren', 'REGION', 'SEKITAR PESANTREN', 1),
  ('pos-region-singaparna', 'REGION', 'SINGAPARNA', 1),
  ('pos-region-kota-tasik', 'REGION', 'KOTA TASIKMALAYA', 1);

CREATE TABLE IF NOT EXISTS poskestren_outside_treatment (
  id                TEXT PRIMARY KEY,
  patient_id        TEXT NOT NULL REFERENCES poskestren_patient(id),
  treated_at        TEXT NOT NULL,
  asrama_snapshot   TEXT,
  kamar_snapshot    TEXT,
  region_id         TEXT NOT NULL REFERENCES poskestren_outside_reference(id),
  region_name       TEXT NOT NULL,
  provider_id       TEXT NOT NULL REFERENCES poskestren_outside_reference(id),
  provider_name     TEXT NOT NULL,
  driver_id         TEXT REFERENCES poskestren_outside_reference(id),
  driver_name       TEXT,
  complaint         TEXT NOT NULL,
  created_by        TEXT REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by        TEXT REFERENCES users(id),
  updated_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_pos_outside_period
  ON poskestren_outside_treatment(treated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pos_outside_patient
  ON poskestren_outside_treatment(patient_id, treated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pos_outside_asrama_period
  ON poskestren_outside_treatment(asrama_snapshot, treated_at DESC, id DESC);

ALTER TABLE poskestren_medicine ADD COLUMN normalized_key TEXT;

UPDATE poskestren_medicine
SET normalized_key =
  LOWER(TRIM(name)) || '|' ||
  LOWER(TRIM(COALESCE(form, base_unit, ''))) || '|' ||
  LOWER(TRIM(COALESCE(strength, '')))
WHERE normalized_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_pos_medicine_normalized
  ON poskestren_medicine(normalized_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_stock_reference_unique
  ON poskestren_stock_movement(reference_type, reference_id, medicine_id, movement_type)
  WHERE reference_type IN (
    'PRESCRIPTION_ITEM',
    'DORM_MEDICINE',
    'OBSERVATION_MEDICINE',
    'VISIT_REVISION',
    'PURCHASE_ITEM',
    'MANUAL_ADJUSTMENT',
    'SAMPLE_CLEANUP'
  )
  AND reference_id IS NOT NULL;

INSERT OR IGNORE INTO app_settings(key, value)
VALUES ('poskestren_sample_cleanup_done', '0');

UPDATE fitur_akses
SET roles = '["admin","poskestren","dewan_santri","pengurus_asrama"]',
    updated_at = datetime('now')
WHERE href = '/dashboard/poskestren/pemeriksaan';

INSERT OR IGNORE INTO fitur_akses
  (group_name, title, href, icon, roles, is_active, urutan, is_bottomnav, bottomnav_urutan)
VALUES
  ('POSKESTREN', 'Observasi', '/dashboard/poskestren/observasi', 'Bed', '["admin","poskestren"]', 1, 2, 0, 0);

UPDATE fitur_akses
SET urutan = CASE href
  WHEN '/dashboard/poskestren/pemeriksaan' THEN 1
  WHEN '/dashboard/poskestren/observasi' THEN 2
  WHEN '/dashboard/poskestren/obat' THEN 3
  WHEN '/dashboard/poskestren/keuangan' THEN 4
  WHEN '/dashboard/poskestren/laporan' THEN 5
  WHEN '/dashboard/poskestren/manajemen' THEN 6
  ELSE urutan
END,
updated_at = datetime('now')
WHERE group_name = 'POSKESTREN';

INSERT OR IGNORE INTO role_fitur_crud_permission
  (fitur_href, role, can_create, can_update, can_delete, created_at, updated_at)
VALUES
  ('/dashboard/poskestren/observasi', 'poskestren', 1, 1, 0, datetime('now'), datetime('now'));
