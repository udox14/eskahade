-- ============================================================
-- Migration 0135: POSKESTREN Pemeriksaan - alur pendaftaran → pemeriksaan → penyerahan obat.
-- 1. Tanda vital pendaftaran disimpan pada kunjungan.
-- 2. Status baru 'OBAT' (pemeriksaan dokter selesai, menunggu penyerahan obat oleh petugas).
-- 3. Potong stok terjadi saat penyerahan obat, bukan saat pemeriksaan.
-- ============================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE poskestren_visit_new (
  id                     TEXT PRIMARY KEY,
  patient_id             TEXT NOT NULL REFERENCES poskestren_patient(id),
  queue_date             TEXT NOT NULL,
  queue_number           INTEGER NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'MENUNGGU'
                           CHECK (status IN ('MENUNGGU','DIPERIKSA','OBAT','SELESAI','DIRUJUK','BATAL')),
  source_type            TEXT NOT NULL DEFAULT 'MANUAL'
                           CHECK (source_type IN ('MANUAL','DATA_SAKIT')),
  source_episode_id      TEXT UNIQUE,
  source_absen_sakit_id  TEXT REFERENCES absen_sakit(id) ON DELETE SET NULL,
  personnel_id           TEXT REFERENCES poskestren_personnel(id),
  practice_session_id    TEXT REFERENCES poskestren_practice_session(id),
  temperature_celsius    REAL,
  systolic_pressure      INTEGER,
  diastolic_pressure     INTEGER,
  weight_kg              REAL,
  complaint              TEXT,
  diagnosis              TEXT,
  diagnosis_id           TEXT REFERENCES poskestren_diagnosis(id) ON DELETE SET NULL,
  treatment              TEXT,
  follow_up              TEXT,
  referral_destination   TEXT,
  referral_notes         TEXT,
  revision_no            INTEGER NOT NULL DEFAULT 0,
  registered_by          TEXT REFERENCES users(id),
  updated_by             TEXT REFERENCES users(id),
  started_at             TEXT,
  completed_at           TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT,
  UNIQUE(queue_date, queue_number)
);

INSERT INTO poskestren_visit_new (
  id, patient_id, queue_date, queue_number, status, source_type,
  source_episode_id, source_absen_sakit_id, personnel_id, practice_session_id,
  complaint, diagnosis, diagnosis_id, treatment, follow_up,
  referral_destination, referral_notes, revision_no, registered_by, updated_by,
  started_at, completed_at, created_at, updated_at
)
SELECT id, patient_id, queue_date, queue_number, status, source_type,
       source_episode_id, source_absen_sakit_id, personnel_id, practice_session_id,
       complaint, diagnosis, diagnosis_id, treatment, follow_up,
       referral_destination, referral_notes, revision_no, registered_by, updated_by,
       started_at, completed_at, created_at, updated_at
FROM poskestren_visit;

DROP TABLE poskestren_visit;

ALTER TABLE poskestren_visit_new RENAME TO poskestren_visit;

CREATE INDEX IF NOT EXISTS idx_pos_visit_queue
  ON poskestren_visit(queue_date, status, queue_number);
CREATE INDEX IF NOT EXISTS idx_pos_visit_patient
  ON poskestren_visit(patient_id, queue_date DESC);
CREATE INDEX IF NOT EXISTS idx_pos_visit_personnel_period
  ON poskestren_visit(personnel_id, queue_date, status);
CREATE INDEX IF NOT EXISTS idx_pos_visit_diagnosis_period
  ON poskestren_visit(diagnosis_id, queue_date, status);

PRAGMA foreign_keys = ON;
