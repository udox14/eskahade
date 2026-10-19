-- SANDBOX ONLY. Explicit operator approval, frozen preflight and backup required.
-- Never use d1 migrations apply, never apply to production, never replay a partial stage.
SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM d1_migrations WHERE name='0192_sandbox_missing_module_tables.sql') THEN 'true' ELSE 'STOP_MIGRATION_ALREADY_RECORDED' END);

CREATE TABLE absensi_pengajar_detail (
  id TEXT PRIMARY KEY,
  sesi_id TEXT NOT NULL REFERENCES absensi_pengajar_sesi(id) ON DELETE CASCADE,
  riwayat_pendidikan_id TEXT NOT NULL REFERENCES riwayat_pendidikan(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'H' CHECK (status IN ('H', 'S', 'I', 'A')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(sesi_id, riwayat_pendidikan_id)
);

CREATE TABLE absensi_pengajar_sesi (
  id TEXT PRIMARY KEY,
  kelas_id TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  guru_id INTEGER REFERENCES data_guru(id) ON DELETE SET NULL,
  tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id) ON DELETE SET NULL,
  tanggal TEXT NOT NULL,
  waktu TEXT NOT NULL CHECK (waktu IN ('shubuh', 'ashar', 'maghrib')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(kelas_id, created_by, tanggal, waktu)
);

CREATE TABLE absensi_verifikasi_periode (
        id TEXT PRIMARY KEY,
        tanggal_mulai TEXT NOT NULL,
        tanggal_selesai TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'FINAL' CHECK(status IN ('FINAL', 'REOPENED')),
        verified_by TEXT REFERENCES users(id),
        verified_at TEXT NOT NULL,
        reopened_by TEXT REFERENCES users(id),
        reopened_at TEXT,
        reopen_reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(tanggal_mulai, tanggal_selesai)
      );

CREATE TABLE dashboard_role_widgets (
  role TEXT NOT NULL,
  widget_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES users(id),
  PRIMARY KEY (role, widget_key)
);

CREATE TABLE dashboard_user_shortcuts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fitur_id INTEGER NOT NULL REFERENCES fitur_akses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 7),
  PRIMARY KEY (user_id, fitur_id),
  UNIQUE (user_id, position)
);

CREATE TABLE ehb_pengawas_config (
      ehb_event_id                 INTEGER PRIMARY KEY REFERENCES ehb_event(id) ON DELETE CASCADE,
      senior_allowed_sesi          TEXT,
      senior_blocked_sesi          TEXT,
      senior_avoid_last_session    INTEGER NOT NULL DEFAULT 1,
      updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
    );

CREATE TABLE pelanggaran_revisions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, pelanggaran_id TEXT NOT NULL REFERENCES pelanggaran(id),
 session_id TEXT, actor_id TEXT REFERENCES users(id), changed_at TEXT NOT NULL,
 reason TEXT NOT NULL, before_json TEXT, after_json TEXT NOT NULL
);

CREATE TABLE pelanggaran_session_links (
 pelanggaran_id TEXT NOT NULL REFERENCES pelanggaran(id),
 session_id TEXT NOT NULL REFERENCES pelanggaran_sessions(id),
 PRIMARY KEY(pelanggaran_id,session_id)
);

CREATE TABLE pelanggaran_sessions (
 id TEXT PRIMARY KEY,
 pelanggaran_id TEXT NOT NULL REFERENCES pelanggaran(id),
 santri_id TEXT NOT NULL REFERENCES santri(id),
 source TEXT NOT NULL CHECK(source IN ('pengajian','berjamaah')),
 tanggal TEXT NOT NULL CHECK(length(tanggal)=10 AND date(tanggal,'+0 days') IS tanggal),
 sesi TEXT NOT NULL CHECK(sesi IN ('shubuh','dzuhur','ashar','maghrib','isya')),
 source_ref TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
 updated_by TEXT REFERENCES users(id), updated_at TEXT NOT NULL,
 reason TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 UNIQUE(santri_id,source,tanggal,sesi),
 CHECK(source='berjamaah' OR sesi IN ('shubuh','ashar','maghrib'))
);

CREATE TABLE penempatan_draft (
  id                  TEXT PRIMARY KEY,
  santri_id           TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  kelas_id            TEXT NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  riwayat_lama_id     TEXT,
  marhalah_target_id  TEXT NOT NULL,
  sumber              TEXT NOT NULL, -- 'baru' | 'lama'
  created_by          TEXT,
  created_at          TEXT NOT NULL,
  UNIQUE(santri_id)
);

CREATE TABLE pengajian_violation_photos (
 violation_id TEXT UNIQUE REFERENCES pengajian_violations(id) ON DELETE SET NULL,
 request_id TEXT PRIMARY KEY NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 content_hash TEXT NOT NULL,
 byte_size INTEGER NOT NULL CHECK(byte_size BETWEEN 1 AND 122880),
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','attached','deleted')),
 deleted_at TEXT
);

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

CREATE TABLE portal_login_throttle (
  santri_id       TEXT PRIMARY KEY REFERENCES santri(id),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE portal_ortu_credentials (
  santri_id            TEXT PRIMARY KEY REFERENCES santri(id),
  password_hash        TEXT NOT NULL,                 -- format salt_hex:hash_hex (lib/auth/password.ts)
  must_change_password INTEGER NOT NULL DEFAULT 1,
  is_active            INTEGER NOT NULL DEFAULT 1,    -- 0 = login diblokir admin
  last_login_at        TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
, token_version INTEGER NOT NULL DEFAULT 1);

CREATE TABLE portal_payment_submission (
  id             TEXT PRIMARY KEY,
  santri_id      TEXT NOT NULL REFERENCES santri(id),
  kategori       TEXT NOT NULL,            -- 'SPP' | 'NON_SPP'
  detail_json    TEXT NOT NULL,            -- SPP: [{source,historis_id,tahun,bulan,nominal}]
                                           -- NON_SPP: [{jenis_biaya,tahun_ajaran_id,tahun_tagihan,nominal}]
  jumlah         INTEGER NOT NULL,         -- total rupiah (selalu dihitung ulang server-side)
  metode         TEXT NOT NULL,            -- 'TRANSFER' | 'QRIS'
  bank_tujuan    TEXT,                     -- snapshot JSON rekening terpilih (metode TRANSFER)
  bukti_url      TEXT,                     -- /api/file/bukti-portal/...
  status         TEXT NOT NULL DEFAULT 'menunggu_konfirmasi',
                                           -- menunggu_konfirmasi | terkonfirmasi | ditolak | dibatalkan
  catatan_ortu   TEXT,
  confirmed_by   TEXT REFERENCES users(id),
  confirmed_at   TEXT,
  rejected_by    TEXT REFERENCES users(id),
  rejected_at    TEXT,
  reject_reason  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE poskestren_cash_account (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL CHECK (account_type IN ('CASH','BANK','EWALLET')),
  is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT
);

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

CREATE TABLE poskestren_clinical_prescription_item (
 id TEXT PRIMARY KEY, exam_id TEXT NOT NULL REFERENCES poskestren_clinical_exam(id),
 source_type TEXT NOT NULL CHECK(source_type IN ('STOCK','EXTERNAL')),
 medicine_id TEXT REFERENCES poskestren_medicine(id), medicine_name TEXT NOT NULL, unit TEXT NOT NULL,
 requested_quantity INTEGER NOT NULL CHECK(requested_quantity > 0),
 dispensed_quantity INTEGER NOT NULL DEFAULT 0 CHECK(dispensed_quantity >= 0 AND dispensed_quantity <= requested_quantity),
 dosage TEXT, notes TEXT,
 CHECK ((source_type = 'STOCK' AND medicine_id IS NOT NULL) OR (source_type = 'EXTERNAL' AND medicine_id IS NULL))
);

CREATE TABLE poskestren_compensation_history (
  id                    TEXT PRIMARY KEY,
  personnel_id          TEXT NOT NULL REFERENCES poskestren_personnel(id),
  effective_from        TEXT NOT NULL,
  session_rate_rupiah   INTEGER CHECK (session_rate_rupiah IS NULL OR session_rate_rupiah >= 0),
  patient_rate_rupiah   INTEGER CHECK (patient_rate_rupiah IS NULL OR patient_rate_rupiah >= 0),
  monthly_salary_rupiah INTEGER CHECK (monthly_salary_rupiah IS NULL OR monthly_salary_rupiah >= 0),
  notes                 TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')), patient_rate_with_treatment_rupiah INTEGER 
  CHECK (patient_rate_with_treatment_rupiah IS NULL OR patient_rate_with_treatment_rupiah >= 0),
  UNIQUE(personnel_id, effective_from)
);

CREATE TABLE poskestren_diagnosis (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL COLLATE NOCASE UNIQUE,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE poskestren_dorm_visit (
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
, status TEXT NOT NULL DEFAULT 'LEGACY' CHECK (status IN ('LEGACY','MENUNGGU','DIPERIKSA','SELESAI')), personnel_id TEXT REFERENCES poskestren_personnel(id), completed_at TEXT, allergies_snapshot TEXT);

CREATE TABLE poskestren_dorm_visit_medicine (
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

CREATE TABLE poskestren_finance_category (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  direction        TEXT NOT NULL CHECK (direction IN ('INCOME','EXPENSE')),
  is_system        INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
  is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by       TEXT REFERENCES users(id),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, direction)
);

CREATE TABLE poskestren_finance_transaction (
  id                    TEXT PRIMARY KEY,
  transaction_date      TEXT NOT NULL,
  transaction_type      TEXT NOT NULL CHECK (transaction_type IN (
                            'INCOME','EXPENSE','TRANSFER_IN','TRANSFER_OUT','OPENING','REVERSAL'
                          )),
  account_id            TEXT NOT NULL REFERENCES poskestren_cash_account(id),
  category_id           TEXT REFERENCES poskestren_finance_category(id) ON DELETE SET NULL,
  amount_rupiah         INTEGER NOT NULL CHECK (amount_rupiah > 0),
  counterparty          TEXT,
  description           TEXT NOT NULL,
  receipt_url           TEXT,
  transfer_group_id     TEXT,
  linked_transaction_id TEXT REFERENCES poskestren_finance_transaction(id) ON DELETE SET NULL,
  source_type           TEXT,
  source_id             TEXT,
  status                TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','VOID')),
  void_reason           TEXT,
  voided_by             TEXT REFERENCES users(id),
  voided_at             TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE poskestren_medicine (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  generic_name        TEXT,
  category            TEXT,
  form                TEXT,
  strength            TEXT,
  base_unit           TEXT NOT NULL,
  minimum_stock_base  INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock_base >= 0),
  total_stock_base    INTEGER NOT NULL DEFAULT 0 CHECK (total_stock_base >= 0),
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  notes               TEXT,
  created_by          TEXT REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT
, normalized_key TEXT);

CREATE TABLE poskestren_medicine_batch (
  id                  TEXT PRIMARY KEY,
  medicine_id         TEXT NOT NULL REFERENCES poskestren_medicine(id),
  purchase_item_id    TEXT UNIQUE REFERENCES poskestren_purchase_item(id) ON DELETE SET NULL,
  batch_number        TEXT NOT NULL,
  expires_on          TEXT,
  purchase_price_base INTEGER NOT NULL DEFAULT 0 CHECK (purchase_price_base >= 0),
  initial_quantity    INTEGER NOT NULL CHECK (initial_quantity >= 0),
  remaining_quantity  INTEGER NOT NULL CHECK (remaining_quantity >= 0),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(medicine_id, batch_number)
);

CREATE TABLE poskestren_medicine_issue (
  id                TEXT PRIMARY KEY,
  issue_date        TEXT NOT NULL,
  recipient_type    TEXT NOT NULL CHECK (recipient_type IN ('SANTRI','GURU')),
  santri_id         TEXT REFERENCES santri(id),
  guru_id           INTEGER REFERENCES data_guru(id),
  recipient_name    TEXT NOT NULL,
  asrama_snapshot   TEXT,
  source_location_id TEXT NOT NULL REFERENCES poskestren_stock_location(id),
  purpose           TEXT NOT NULL CHECK (purpose IN ('PRIBADI','RESEP_DOKTER','LAINNYA')),
  notes             TEXT,
  created_by        TEXT REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (recipient_type = 'SANTRI' AND santri_id IS NOT NULL AND guru_id IS NULL)
    OR (recipient_type = 'GURU' AND guru_id IS NOT NULL AND santri_id IS NULL)
  )
);

CREATE TABLE poskestren_medicine_issue_item (
  id          TEXT PRIMARY KEY,
  issue_id    TEXT NOT NULL REFERENCES poskestren_medicine_issue(id) ON DELETE CASCADE,
  medicine_id TEXT NOT NULL REFERENCES poskestren_medicine(id),
  quantity_base INTEGER NOT NULL CHECK (quantity_base > 0),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(issue_id, medicine_id)
);

CREATE TABLE poskestren_medicine_location_stock (
  medicine_id   TEXT NOT NULL REFERENCES poskestren_medicine(id) ON DELETE CASCADE,
  location_id   TEXT NOT NULL REFERENCES poskestren_stock_location(id) ON DELETE CASCADE,
  quantity_base INTEGER NOT NULL DEFAULT 0 CHECK (quantity_base >= 0),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (medicine_id, location_id)
);

CREATE TABLE poskestren_medicine_order (
  id             TEXT PRIMARY KEY,
  plan_year      INTEGER NOT NULL CHECK (plan_year BETWEEN 2000 AND 2100),
  order_date     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'DRAFT'
                 CHECK (status IN ('DRAFT','ORDERED','PARTIAL','RECEIVED','CANCELLED')),
  supplier_id    TEXT REFERENCES poskestren_supplier(id) ON DELETE SET NULL,
  supplier_name  TEXT,
  notes          TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT,
  CHECK (supplier_id IS NOT NULL OR supplier_name IS NULL OR length(trim(supplier_name)) > 0)
);

CREATE TABLE poskestren_medicine_order_item (
  id                    TEXT PRIMARY KEY,
  order_id              TEXT NOT NULL REFERENCES poskestren_medicine_order(id) ON DELETE CASCADE,
  medicine_id           TEXT NOT NULL REFERENCES poskestren_medicine(id),
  unit_name             TEXT NOT NULL,
  total_usage           REAL NOT NULL DEFAULT 0,
  ca_quantity           REAL NOT NULL DEFAULT 0,
  daily_average         REAL NOT NULL DEFAULT 0,
  safety_stock          REAL NOT NULL DEFAULT 0,
  lead_time_stock       REAL NOT NULL DEFAULT 0,
  total_stock_snapshot  INTEGER NOT NULL DEFAULT 0 CHECK (total_stock_snapshot >= 0),
  planning_quantity     REAL NOT NULL DEFAULT 0,
  order_quantity        INTEGER NOT NULL DEFAULT 0 CHECK (order_quantity >= 0),
  received_quantity     INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(order_id, medicine_id)
);

CREATE TABLE poskestren_observation (
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
  updated_at           TEXT, clinical_snapshot TEXT,
  CHECK (
    status = 'ACTIVE'
    OR (discharged_at IS NOT NULL AND status = 'RECOVERED')
    OR (discharged_at IS NOT NULL AND status = 'REFERRED' AND referral_destination IS NOT NULL)
  )
);

CREATE TABLE poskestren_observation_medicine (
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

CREATE TABLE poskestren_operation (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid = 1));

CREATE TABLE poskestren_outside_reference (
  id             TEXT PRIMARY KEY,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('REGION','PROVIDER','DRIVER')),
  name           TEXT NOT NULL COLLATE NOCASE,
  is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT,
  UNIQUE(reference_type, name)
);

CREATE TABLE poskestren_outside_treatment (
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

CREATE TABLE poskestren_patient (
  id                 TEXT PRIMARY KEY,
  santri_id          TEXT NOT NULL UNIQUE REFERENCES santri(id),
  medical_record_no  TEXT NOT NULL UNIQUE,
  blood_type         TEXT,
  allergies          TEXT,
  special_conditions TEXT,
  routine_medicines  TEXT,
  emergency_contact  TEXT,
  notes              TEXT,
  created_by         TEXT REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT
, legacy_medical_record_no TEXT, profile_version INTEGER NOT NULL DEFAULT 0);

CREATE TABLE poskestren_patient_code_sequence (
  initial_letter TEXT PRIMARY KEY,
  next_number    INTEGER NOT NULL CHECK (next_number > 0)
);

CREATE TABLE poskestren_personnel (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  personnel_type      TEXT NOT NULL CHECK (personnel_type IN ('MEDICAL','EMPLOYEE')),
  full_name           TEXT NOT NULL,
  profession          TEXT,
  position_name       TEXT,
  phone               TEXT,
  license_number      TEXT,
  employment_start    TEXT,
  employment_end      TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  notes               TEXT,
  created_by          TEXT REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT
);

CREATE TABLE poskestren_practice_session (
  id           TEXT PRIMARY KEY,
  personnel_id TEXT NOT NULL REFERENCES poskestren_personnel(id),
  session_date TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  notes        TEXT,
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE poskestren_prescription (
  id         TEXT PRIMARY KEY,
  visit_id   TEXT UNIQUE REFERENCES poskestren_visit(id) ON DELETE SET NULL,
  program_id TEXT REFERENCES poskestren_preventive_program(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PARTIAL','DISPENSED','CANCELLED')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  CHECK (visit_id IS NOT NULL OR program_id IS NOT NULL)
);

CREATE TABLE poskestren_prescription_external_item (
 id TEXT PRIMARY KEY, prescription_id TEXT NOT NULL REFERENCES poskestren_prescription(id) ON DELETE CASCADE,
 medicine_name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), unit TEXT NOT NULL, dosage TEXT, notes TEXT
);

CREATE TABLE poskestren_prescription_item (
  id                      TEXT PRIMARY KEY,
  prescription_id         TEXT NOT NULL REFERENCES poskestren_prescription(id) ON DELETE CASCADE,
  medicine_id             TEXT NOT NULL REFERENCES poskestren_medicine(id),
  dosage                  TEXT,
  requested_quantity_base INTEGER NOT NULL CHECK (requested_quantity_base > 0),
  dispensed_quantity_base INTEGER NOT NULL DEFAULT 0 CHECK (dispensed_quantity_base >= 0),
  notes                   TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
, updated_at TEXT);

CREATE TABLE poskestren_preventive_participant (
  id          TEXT PRIMARY KEY,
  program_id  TEXT NOT NULL REFERENCES poskestren_preventive_program(id) ON DELETE CASCADE,
  santri_id   TEXT NOT NULL REFERENCES santri(id),
  attendance  TEXT NOT NULL DEFAULT 'PENDING' CHECK (attendance IN ('PENDING','PRESENT','ABSENT')),
  result      TEXT,
  follow_up   TEXT,
  notes       TEXT,
  updated_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT,
  UNIQUE(program_id, santri_id)
);

CREATE TABLE poskestren_preventive_program (
  id             TEXT PRIMARY KEY,
  type_id        TEXT REFERENCES poskestren_preventive_type(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  program_date   TEXT NOT NULL,
  target_summary TEXT,
  description    TEXT,
  attachment_url TEXT,
  personnel_id   TEXT REFERENCES poskestren_personnel(id),
  status         TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','COMPLETED','CANCELLED')),
  created_by     TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

CREATE TABLE poskestren_preventive_type (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE poskestren_purchase (
  id                  TEXT PRIMARY KEY,
  purchase_date       TEXT NOT NULL,
  supplier_id         TEXT REFERENCES poskestren_supplier(id) ON DELETE SET NULL,
  supplier_name       TEXT,
  status              TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','RECEIVED','CANCELLED')),
  payment_status      TEXT NOT NULL DEFAULT 'UNPOSTED' CHECK (payment_status IN ('UNPOSTED','POSTED','VOID')),
  total_rupiah        INTEGER NOT NULL DEFAULT 0 CHECK (total_rupiah >= 0),
  notes               TEXT,
  finance_transaction_id TEXT,
  created_by          TEXT REFERENCES users(id),
  received_by         TEXT REFERENCES users(id),
  received_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT
);

CREATE TABLE poskestren_purchase_item (
  id               TEXT PRIMARY KEY,
  purchase_id      TEXT NOT NULL REFERENCES poskestren_purchase(id) ON DELETE CASCADE,
  medicine_id      TEXT NOT NULL REFERENCES poskestren_medicine(id),
  unit_name        TEXT NOT NULL,
  factor_to_base   INTEGER NOT NULL CHECK (factor_to_base > 0),
  quantity_package INTEGER NOT NULL CHECK (quantity_package > 0),
  quantity_base    INTEGER NOT NULL CHECK (quantity_base > 0),
  unit_price       INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  subtotal_rupiah  INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_rupiah >= 0),
  batch_number     TEXT NOT NULL,
  expires_on       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
, order_item_id TEXT);

CREATE VIRTUAL TABLE poskestren_search_fts USING fts5(
  entity_type UNINDEXED,
  entity_id UNINDEXED,
  text_content,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE poskestren_stock_location (
  id              TEXT PRIMARY KEY,
  location_type   TEXT NOT NULL CHECK (location_type IN ('CENTRAL','DORM')),
  name            TEXT NOT NULL,
  normalized_key  TEXT NOT NULL UNIQUE,
  asrama_name     TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT
);

CREATE TABLE poskestren_stock_movement (
  id                 TEXT PRIMARY KEY,
  medicine_id        TEXT NOT NULL REFERENCES poskestren_medicine(id),
  batch_id           TEXT REFERENCES poskestren_medicine_batch(id) ON DELETE SET NULL,
  movement_date      TEXT NOT NULL,
  movement_type      TEXT NOT NULL CHECK (movement_type IN (
                         'PURCHASE','PATIENT','PREVENTIVE','EXPIRED','DAMAGED','LOST','ADJUSTMENT_IN','ADJUSTMENT_OUT','REVERSAL'
                       )),
  quantity_delta     INTEGER NOT NULL CHECK (quantity_delta <> 0),
  stock_before       INTEGER NOT NULL CHECK (stock_before >= 0),
  stock_after        INTEGER NOT NULL CHECK (stock_after >= 0),
  reference_type     TEXT,
  reference_id       TEXT,
  notes              TEXT,
  created_by         TEXT REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
, location_id TEXT REFERENCES poskestren_stock_location(id));

CREATE TABLE poskestren_stock_transfer (
  id                    TEXT PRIMARY KEY,
  source_location_id    TEXT NOT NULL REFERENCES poskestren_stock_location(id),
  destination_location_id TEXT NOT NULL REFERENCES poskestren_stock_location(id),
  transfer_date         TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'COMPLETED'
                        CHECK (status IN ('COMPLETED','CANCELLED')),
  notes                 TEXT,
  created_by            TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (source_location_id <> destination_location_id)
);

CREATE TABLE poskestren_stock_transfer_item (
  id                    TEXT PRIMARY KEY,
  transfer_id           TEXT NOT NULL REFERENCES poskestren_stock_transfer(id) ON DELETE CASCADE,
  medicine_id           TEXT NOT NULL REFERENCES poskestren_medicine(id),
  quantity_base         INTEGER NOT NULL CHECK (quantity_base > 0),
  source_before         INTEGER NOT NULL CHECK (source_before >= 0),
  source_after          INTEGER NOT NULL CHECK (source_after >= 0),
  destination_before    INTEGER NOT NULL CHECK (destination_before >= 0),
  destination_after     INTEGER NOT NULL CHECK (destination_after >= 0),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(transfer_id, medicine_id)
);

CREATE TABLE poskestren_stocktake (
  id          TEXT PRIMARY KEY,
  opname_date TEXT NOT NULL,
  location_id TEXT NOT NULL REFERENCES poskestren_stock_location(id),
  status      TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','CANCELLED')),
  notes       TEXT,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE poskestren_stocktake_item (
  id             TEXT PRIMARY KEY,
  stocktake_id   TEXT NOT NULL REFERENCES poskestren_stocktake(id) ON DELETE CASCADE,
  medicine_id    TEXT NOT NULL REFERENCES poskestren_medicine(id),
  counted_quantity INTEGER NOT NULL CHECK (counted_quantity >= 0),
  before_quantity  INTEGER NOT NULL CHECK (before_quantity >= 0),
  delta_quantity   INTEGER NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(stocktake_id, medicine_id)
);

CREATE TABLE poskestren_supplier (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  phone      TEXT,
  address    TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE poskestren_unit_conversion (
  id             TEXT PRIMARY KEY,
  medicine_id    TEXT NOT NULL REFERENCES poskestren_medicine(id) ON DELETE CASCADE,
  unit_name      TEXT NOT NULL,
  factor_to_base INTEGER NOT NULL CHECK (factor_to_base > 0),
  is_purchase_unit INTEGER NOT NULL DEFAULT 1 CHECK (is_purchase_unit IN (0,1)),
  UNIQUE(medicine_id, unit_name)
);

CREATE TABLE "poskestren_visit" (
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
  updated_at             TEXT, awaiting_medicine INTEGER NOT NULL DEFAULT 0 CHECK (awaiting_medicine IN (0,1)), clinical_snapshot TEXT, fee_category TEXT NOT NULL DEFAULT 'NORMAL' CHECK (fee_category IN ('NORMAL','TREATMENT')),
  UNIQUE(queue_date, queue_number)
);

CREATE TABLE poskestren_visit_revision (
  id            TEXT PRIMARY KEY,
  visit_id      TEXT NOT NULL REFERENCES poskestren_visit(id),
  revision_no   INTEGER NOT NULL,
  before_json   TEXT NOT NULL,
  reason        TEXT NOT NULL,
  revised_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(visit_id, revision_no)
);

CREATE TABLE santri_pembebasan_biaya (
  id          TEXT PRIMARY KEY,
  santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  service_kind TEXT NOT NULL CHECK (service_kind IN ('SPP','MAKAN','LAUNDRY','USPP')),
  is_active   INTEGER NOT NULL DEFAULT 1,
  alasan      TEXT,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  TEXT REFERENCES users(id),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(santri_id, service_kind)
);

CREATE TABLE supervisi_delete_request (
 token TEXT PRIMARY KEY, kegiatan_id TEXT NOT NULL, revision INTEGER NOT NULL,
 actor_id TEXT NOT NULL REFERENCES users(id), authorized INTEGER NOT NULL DEFAULT 0 CHECK(authorized IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE supervisi_history (
 id INTEGER PRIMARY KEY, wawancara_id TEXT NOT NULL REFERENCES supervisi_wawancara(id),
 operation_id TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, reason TEXT,
 revision INTEGER NOT NULL, before_json TEXT, after_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(wawancara_id,operation_id)
);

CREATE TABLE supervisi_kegiatan (
 id TEXT PRIMARY KEY, nama TEXT NOT NULL, tahun_ajaran_id INTEGER NOT NULL REFERENCES tahun_ajaran(id),
 status TEXT NOT NULL DEFAULT 'persiapan' CHECK(status IN ('persiapan','terbuka','ditutup')),
 revision INTEGER NOT NULL DEFAULT 0, actor_id TEXT NOT NULL REFERENCES users(id), reason TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE supervisi_kegiatan_history (
 id INTEGER PRIMARY KEY, kegiatan_id TEXT NOT NULL REFERENCES supervisi_kegiatan(id), actor_id TEXT NOT NULL REFERENCES users(id),
 before_status TEXT, after_status TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE supervisi_target (
 kegiatan_id TEXT NOT NULL REFERENCES supervisi_kegiatan(id), guru_id INTEGER NOT NULL REFERENCES data_guru(id),
 guru_nama TEXT NOT NULL, kelas_json TEXT NOT NULL CHECK(json_valid(kelas_json)),
 PRIMARY KEY(kegiatan_id,guru_id)
);

CREATE TABLE supervisi_user_permission (
 user_id TEXT PRIMARY KEY REFERENCES users(id), can_manage_all INTEGER NOT NULL DEFAULT 0 CHECK(can_manage_all IN (0,1))
);

CREATE TABLE supervisi_wawancara (
 id TEXT PRIMARY KEY, kegiatan_id TEXT NOT NULL, guru_id INTEGER NOT NULL,
 owner_id TEXT NOT NULL REFERENCES users(id), identity_json TEXT NOT NULL CHECK(json_valid(identity_json)),
 answers_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(answers_json)), instrument_version INTEGER NOT NULL DEFAULT 1,
 tanggal TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','selesai')),
 revision INTEGER NOT NULL DEFAULT 0, completed_count INTEGER NOT NULL DEFAULT 0 CHECK(completed_count BETWEEN 0 AND 53),
 actor_id TEXT NOT NULL REFERENCES users(id), operation_id TEXT NOT NULL, action TEXT NOT NULL DEFAULT 'start', reason TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(kegiatan_id,guru_id), FOREIGN KEY(kegiatan_id,guru_id) REFERENCES supervisi_target(kegiatan_id,guru_id)
);

CREATE TABLE tes_klasifikasi_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tahun_ajaran_id INTEGER REFERENCES tahun_ajaran(id),
  nama TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tes_klasifikasi_plotting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
  sesi_id INTEGER NOT NULL REFERENCES tes_klasifikasi_sesi(id) ON DELETE CASCADE,
  ruangan_id INTEGER NOT NULL REFERENCES tes_klasifikasi_ruangan(id) ON DELETE CASCADE,
  santri_id TEXT NOT NULL REFERENCES santri(id),
  nomor_urut INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, santri_id)
);

CREATE TABLE tes_klasifikasi_plotting_rule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
  sesi_id INTEGER NOT NULL REFERENCES tes_klasifikasi_sesi(id) ON DELETE CASCADE,
  ruangan_id INTEGER NOT NULL REFERENCES tes_klasifikasi_ruangan(id) ON DELETE CASCADE,
  jenis_kelamin TEXT NOT NULL,
  levels_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, sesi_id, ruangan_id)
);

CREATE TABLE tes_klasifikasi_ruangan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
  nomor_ruangan INTEGER NOT NULL,
  nama_ruangan TEXT NOT NULL,
  tempat TEXT,
  kapasitas INTEGER NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, nomor_ruangan)
);

CREATE TABLE tes_klasifikasi_ruangan_petugas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
  sesi_id INTEGER NOT NULL REFERENCES tes_klasifikasi_sesi(id) ON DELETE CASCADE,
  ruangan_id INTEGER NOT NULL REFERENCES tes_klasifikasi_ruangan(id) ON DELETE CASCADE,
  pengetes_guru_id INTEGER REFERENCES data_guru(id),
  pendamping_guru_id INTEGER REFERENCES data_guru(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, sesi_id, ruangan_id)
);

CREATE TABLE tes_klasifikasi_sesi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES tes_klasifikasi_event(id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL,
  nomor_sesi INTEGER NOT NULL,
  label TEXT NOT NULL,
  waktu_mulai TEXT,
  waktu_selesai TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, tanggal, nomor_sesi)
);

CREATE TABLE uang_jajan_auto_rule (
  id           TEXT PRIMARY KEY,
  scope_type   TEXT NOT NULL, -- ASRAMA | KAMAR | SANTRI
  asrama       TEXT,
  kamar        TEXT,
  santri_id    TEXT REFERENCES santri(id) ON DELETE CASCADE,
  nominal      INTEGER NOT NULL,
  jam          TEXT NOT NULL, -- HH:mm WIB
  days         TEXT NOT NULL, -- JSON array 0..6, Sunday=0
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE uang_jajan_auto_setting (
  asrama      TEXT PRIMARY KEY,
  mode        TEXT NOT NULL DEFAULT 'MANUAL', -- MANUAL | AUTO
  jam         TEXT NOT NULL DEFAULT '06:00',
  days        TEXT NOT NULL DEFAULT '[1,2,3,4,5,6]',
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE uang_jajan_auto_skip (
  id          TEXT PRIMARY KEY,
  santri_id   TEXT NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  skip_date   TEXT NOT NULL, -- YYYY-MM-DD WIB
  reason      TEXT,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')), is_active INTEGER NOT NULL DEFAULT 1, updated_at TEXT,
  UNIQUE (santri_id, skip_date)
);

INSERT INTO d1_migrations(name) VALUES('0192_sandbox_missing_module_tables.sql');
