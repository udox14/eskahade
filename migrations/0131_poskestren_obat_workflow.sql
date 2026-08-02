-- ============================================================
-- Migration 0131: POSKESTREN medicine workflow from DATA STOK OBAT PERBULAN.
-- Catalog rows are a master-data seed only: no workbook stock, price,
-- batch, expiry, or historical movement is imported.
-- ============================================================

CREATE TABLE IF NOT EXISTS poskestren_stock_location (
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

CREATE INDEX IF NOT EXISTS idx_pos_stock_location_active
  ON poskestren_stock_location(is_active, location_type, name COLLATE NOCASE);

INSERT OR IGNORE INTO poskestren_stock_location(
  id, location_type, name, normalized_key, asrama_name, is_active
)
VALUES (
  'pos-location-central', 'CENTRAL', 'Gudang Pusat', 'central', NULL, 1
);

CREATE TABLE IF NOT EXISTS poskestren_medicine_location_stock (
  medicine_id   TEXT NOT NULL REFERENCES poskestren_medicine(id) ON DELETE CASCADE,
  location_id   TEXT NOT NULL REFERENCES poskestren_stock_location(id) ON DELETE CASCADE,
  quantity_base INTEGER NOT NULL DEFAULT 0 CHECK (quantity_base >= 0),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (medicine_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_medicine_location_stock_location
  ON poskestren_medicine_location_stock(location_id, medicine_id);

ALTER TABLE poskestren_stock_movement ADD COLUMN location_id TEXT REFERENCES poskestren_stock_location(id);

CREATE INDEX IF NOT EXISTS idx_pos_stock_movement_location_period
  ON poskestren_stock_movement(location_id, movement_date, medicine_id);

-- Existing stock, if any, is considered central. The new workbook seed has
-- zero stock, so this statement never creates a movement or opening history.
INSERT OR IGNORE INTO poskestren_medicine_location_stock(medicine_id, location_id, quantity_base)
SELECT id, 'pos-location-central', total_stock_base
FROM poskestren_medicine;

CREATE TABLE IF NOT EXISTS poskestren_stock_transfer (
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

CREATE INDEX IF NOT EXISTS idx_pos_stock_transfer_period
  ON poskestren_stock_transfer(transfer_date DESC, source_location_id, destination_location_id);

CREATE TABLE IF NOT EXISTS poskestren_stock_transfer_item (
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

CREATE INDEX IF NOT EXISTS idx_pos_stock_transfer_item_medicine
  ON poskestren_stock_transfer_item(medicine_id, transfer_id);

CREATE TABLE IF NOT EXISTS poskestren_medicine_issue (
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

CREATE INDEX IF NOT EXISTS idx_pos_medicine_issue_period
  ON poskestren_medicine_issue(issue_date DESC, recipient_type, source_location_id);

CREATE TABLE IF NOT EXISTS poskestren_medicine_issue_item (
  id          TEXT PRIMARY KEY,
  issue_id    TEXT NOT NULL REFERENCES poskestren_medicine_issue(id) ON DELETE CASCADE,
  medicine_id TEXT NOT NULL REFERENCES poskestren_medicine(id),
  quantity_base INTEGER NOT NULL CHECK (quantity_base > 0),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(issue_id, medicine_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_medicine_issue_item_medicine
  ON poskestren_medicine_issue_item(medicine_id, issue_id);

CREATE TABLE IF NOT EXISTS poskestren_stocktake (
  id          TEXT PRIMARY KEY,
  opname_date TEXT NOT NULL,
  location_id TEXT NOT NULL REFERENCES poskestren_stock_location(id),
  status      TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','CANCELLED')),
  notes       TEXT,
  created_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pos_stocktake_period
  ON poskestren_stocktake(opname_date DESC, location_id);

CREATE TABLE IF NOT EXISTS poskestren_stocktake_item (
  id             TEXT PRIMARY KEY,
  stocktake_id   TEXT NOT NULL REFERENCES poskestren_stocktake(id) ON DELETE CASCADE,
  medicine_id    TEXT NOT NULL REFERENCES poskestren_medicine(id),
  counted_quantity INTEGER NOT NULL CHECK (counted_quantity >= 0),
  before_quantity  INTEGER NOT NULL CHECK (before_quantity >= 0),
  delta_quantity   INTEGER NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(stocktake_id, medicine_id)
);

CREATE TABLE IF NOT EXISTS poskestren_medicine_order (
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

CREATE INDEX IF NOT EXISTS idx_pos_medicine_order_period
  ON poskestren_medicine_order(plan_year, order_date DESC, status);

CREATE TABLE IF NOT EXISTS poskestren_medicine_order_item (
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

CREATE INDEX IF NOT EXISTS idx_pos_medicine_order_item_medicine
  ON poskestren_medicine_order_item(medicine_id, order_id);

ALTER TABLE poskestren_purchase_item ADD COLUMN order_item_id TEXT;

CREATE INDEX IF NOT EXISTS idx_pos_purchase_item_order
  ON poskestren_purchase_item(order_item_id);

-- Catalog seed: 161 rows copied from DAFTAR OBAT, with deterministic IDs.
-- Category/minimum thresholds follow the workbook groups. Strength is copied
-- only when the name has an unambiguous numeric suffix.
WITH seed(name, form, strength, category, minimum_stock_base, ordinal) AS (VALUES
('ACYCLOVIR 400 MG','TABLET','400 MG','OBAT',100,1),
('ACYCLOVIR 200 MG','TABLET','200 MG','OBAT',100,2),
('ADROME 10 MG','TABLET','10 MG','OBAT',100,3),
('AMBEVEN','KAPSUL','','OBAT',100,4),
('AMBROXOL 30 MG','TABLET','30 MG','OBAT',100,5),
('AMLODIPINE 5 MG','TABLET','5 MG','OBAT',100,6),
('AMLODIPINE 10 MG','TABLET','10 MG','OBAT',100,7),
('AMOXICILLIN 500 MG','TABLET','500 MG','OBAT',100,8),
('ANTASIDA DOEN','TABLET','','OBAT',100,9),
('ASAM MEFENAMAT 500 MG','TABLET','500 MG','OBAT',100,10),
('BICNAT','TABLET','','OBAT',100,11),
('BIOGASTRON','TABLET','','OBAT',100,12),
('BIOMEGA','TABLET','','OBAT',100,13),
('BROMEXHINE HCL','TABLET','','OBAT',100,14),
('CALORTUSIN','TABLET','','OBAT',100,15),
('CAPTOPRIL 12,5 MG','TABLET','12.5 MG','OBAT',100,16),
('CAVICUR','TABLET','','OBAT',100,17),
('CEFADROXIL 500 MG','TABLET','500 MG','OBAT',100,18),
('CEFIXIME 200 MG','TABLET','200 MG','OBAT',100,19),
('CEFIXIME 100 MG','TABLET','100 MG','OBAT',100,20),
('CETIRIZINE','TABLET','','OBAT',100,21),
('CIPROFLOXACIN','TABLET','','OBAT',100,22),
('CLINDAMICINE 150 MG','KAPSUL','150 MG','OBAT',100,23),
('CLINDAMICINE 300 MG','KAPSUL','300 MG','OBAT',100,24),
('CTM','TABLET','','OBAT',100,25),
('DEMACOLIN','TABLET','','OBAT',100,26),
('DEXAMETHASONE','TABLET','','OBAT',100,27),
('DEGIROL','TABLET','','OBAT',100,28),
('DIMENHIDRINATE','TABLET','','OBAT',100,29),
('DIONICOL','TABLET','','OBAT',100,30),
('DOXYCYCLINE','TABLET','','OBAT',100,31),
('FAMOTIDINE 40 MG','TABLET','40 MG','OBAT',100,32),
('FARGOXINE','TABLET','','OBAT',100,33),
('FASIDOL FORTE','TABLET','','OBAT',100,34),
('FLUCADEX','TABLET','','OBAT',100,35),
('FLUTAMOL','TABLET','','OBAT',100,36),
('FUROSEMIDE 40 MG','TABLET','40 MG','OBAT',100,37),
('GLYCERIL GUAIACOLATE','TABLET','','OBAT',100,38),
('GRAFAZOLE','TABLET','','OBAT',100,39),
('GRANTUSIF','TABLET','','OBAT',100,40),
('GRAXINE','TABLET','','OBAT',100,41),
('GRISEOFULVIN','TABLET','','OBAT',100,42),
('HISTIGO','TABLET','','OBAT',100,43),
('HUFADON 10 MG','TABLET','10 MG','OBAT',100,44),
('IBUPROPEN 400 MG','TABLET','400 MG','OBAT',100,45),
('INAMID','TABLET','','OBAT',100,46),
('KETOCONAZOLE 200 MG','TABLET','200 MG','OBAT',100,47),
('LANSOPRAZOLE','KAPSUL','','OBAT',100,48),
('LAXING','KAPSUL','','OBAT',100,49),
('LEVOFLOXACIN','TABLET','','OBAT',100,50),
('LO HAN KUO','PCS','','OBAT',100,51),
('LORATADINE','TABLET','','OBAT',100,52),
('LYBROZIM PLUS','TABLET','','OBAT',100,53),
('LICOKALK','TABLET','','OBAT',100,54),
('MELOXICAM','TABLET','','OBAT',100,55),
('METHIL PREDNISOLON 4 MG','TABLET','4 MG','OBAT',100,56),
('MOLAGIT','TABLET','','OBAT',100,57),
('MULTIVITAMIN','TABLET','','OBAT',100,58),
('METFORMIN','TABLET','','OBAT',100,59),
('NOVACHLOR','TABLET','','OBAT',100,60),
('NEOURODEX','TABLET','','OBAT',100,61),
('OMEPRAZOLE 20 MG','KAPSUL','20 MG','OBAT',100,62),
('ORALIT','BUNGKUS','','OBAT',100,63),
('PARASETAMOL','TABLET','','OBAT',100,64),
('PIROXICAM','TABLET','','OBAT',100,65),
('PREDNISON','TABLET','','OBAT',100,66),
('PRONICY','TABLET','','OBAT',100,67),
('POTASIUM DICLOFENAC','TABLET','','OBAT',100,68),
('PRIMAVON','TABLET','','OBAT',100,69),
('RANITIDINE 150 MG','TABLET','150 MG','OBAT',100,70),
('SALBUTAMOL 2 MG','TABLET','2 MG','OBAT',100,71),
('SALBUTAMOL 4 MG','TABLET','4 MG','OBAT',100,72),
('SEREMIG','TABLET','','OBAT',100,73),
('SODIUM DICLOFENAC','TABLET','','OBAT',100,74),
('SPASMAL','KAPSUL','','OBAT',100,75),
('SCOPMA PLUS','TABLET','','OBAT',100,76),
('SUPERHOID','PCS','','OBAT',100,77),
('SUPRABION','KAPSUL','','OBAT',100,78),
('SIMVASTATIN','TABLET','','OBAT',100,79),
('SANMOL','TABLET','','OBAT',100,80),
('SANMOL FORTE','TABLET','','OBAT',100,81),
('TEOSAL','TABLET','','OBAT',100,82),
('TERA F','TABLET','','OBAT',100,83),
('TETRACYCLIN HCL 500 MG','TABLET','500 MG','OBAT',100,84),
('TRODEX','TABLET','','OBAT',100,85),
('TRIAMCYNOLONE','TABLET','','OBAT',100,86),
('VIT C IPI','BOX','','OBAT',100,87),
('VIT C 1000','BUNGKUS','','OBAT',100,88),
('VIT B IPI','BOX','','OBAT',100,89),
('VOSEA','TABLET','','OBAT',100,90),
('ZINC 20 MG','TABLET','20 MG','OBAT',100,91),
('ACYCLOVIR SK','TUBE','','SALEP',10,92),
('BETAMETASON SK','TUBE','','SALEP',10,93),
('BIOPLACENTON SK','TUBE','','SALEP',10,94),
('CHLORAMFECORT SK','TUBE','','SALEP',10,95),
('ERLAMYCETIN SM','TUBE','','SALEP',10,96),
('GENALTEN SK','TUBE','','SALEP',10,97),
('GENOINT SK','TUBE','','SALEP',10,98),
('HYDROCORTISON SK','TUBE','','SALEP',10,99),
('ICHTIOL SK','TUBE','','SALEP',10,100),
('KETOCONAZOLE SK','TUBE','','SALEP',10,101),
('SALEP 24','TUBE','','SALEP',10,102),
('SCABIMITE SK','TUBE','','SALEP',10,103),
('ALLETROL TM','BTL','','TETES',5,104),
('CALLUSOL','BTL','','TETES',5,105),
('ERLAMYCETIN TK','BTL','','TETES',5,106),
('ERLAMYCETIN TM','BTL','','TETES',5,107),
('CENDO XITROL','PCS','','TETES',5,108),
('GOM','BTL','','TETES',5,109),
('ALKOHOL','BTL','','P3K',5,110),
('BETADINE','BTL','','P3K',5,111),
('HOT CREAM','PCS','','P3K',5,112),
('KASSA GULUNG 5 CM','PCS','','P3K',5,113),
('KASSA GULUNG 10 CM','PCS','','P3K',5,114),
('KASSA STERIL','LEMBAR','','P3K',5,115),
('KOOL FEVER DEWASA','SACHET','','P3K',5,116),
('KOOL FEVER ANAK','SACHET','','P3K',5,117),
('KTO BESAR','BUNGKUS','','P3K',5,118),
('KTO KECIL','BUNGKUS','','P3K',5,119),
('MASKER','PCS','','P3K',5,120),
('NACL','BTL','','P3K',5,121),
('OKSIGEN','TABUNG','','P3K',5,122),
('BEDAK SALICYL','BTL','','P3K',5,123),
('PLESTER ROLL','PCS','','P3K',5,124),
('PLESTER LUKA','PCS','','P3K',5,125),
('POT SALEP','PCS','','P3K',5,126),
('POT TETES','PCS','','P3K',5,127),
('RIVANOL','BTL','','P3K',5,128),
('SUNTIKAN 10 CC','PCS','10 CC','P3K',5,129),
('SUNTIKAN 3 CC','PCS','3 CC','P3K',5,130),
('LIDOCAINE HCL','AMPUL','','P3K',5,131),
('VELUTINE NEBU','BTL','','P3K',5,132),
('GASTRUCID','BTL','','SYRUP',3,133),
('GUANISTREP','BTL','','SYRUP',3,134),
('HUFAGRIP BP','BTL','','SYRUP',3,135),
('HUFAGRIP FLU','BTL','','SYRUP',3,136),
('HUFAGRIP FLU BATUK','BTL','','SYRUP',3,137),
('NOVACHLOR','BTL','','SYRUP',3,138),
('OBH COMBI','BTL','','SYRUP',3,139),
('OBH ITRASAL','BTL','','SYRUP',3,140),
('SANMAG','BTL','','SYRUP',3,141),
('SANMOL','BTL','','SYRUP',3,142),
('SUCRALFATE','BTL','','SYRUP',3,143),
('AMOXICILLIN SYR KERING','BTL','','SYRUP',3,144),
('AMBROXOL','BTL','','SYRUP',3,145),
('KARET BULI-BULI','PCS','','ALKES',0,146),
('PISPOT','PCS','','ALKES',0,147),
('TENSI','PCS','','ALKES',0,148),
('TERMOMETER','PCS','','ALKES',0,149),
('REGULATOR','PCS','','ALKES',0,150),
('NEBULIZER','PCS','','ALKES',0,151),
('AUTOCHECK URIN ACID','BOX','','ALKES',0,152),
('AUTOCHECK BLOOD GLUCOSE','BOX','','ALKES',0,153),
('AUTOCHEK CHOLESTEROL','BOX','','ALKES',0,154),
('ZENICHLOR','BTL','','ALKES',0,155),
('MINYAK KAYU PUTIH 30ML','BTL','30 ML','ALKES',0,156),
('MINYAK ZAITUN 75 ML','BTL','75 ML','ALKES',0,157),
('FRESH CARE','BTL','','ALKES',0,158),
('SALONPAS','LEMBAR','','LAINNYA',0,159),
('TOLAK ANGIN','SACHET','','LAINNYA',0,160),
('ALCOHOL SWAB','LEMBAR','','LAINNYA',0,161)
)
INSERT OR IGNORE INTO poskestren_medicine(
  id, name, category, form, strength, base_unit, minimum_stock_base,
  total_stock_base, normalized_key, is_active
)
SELECT
  'pos-med-' || printf('%03d', seed.ordinal),
  seed.name, seed.category, seed.form, NULLIF(seed.strength, ''), seed.form,
  seed.minimum_stock_base, 0,
  LOWER(TRIM(seed.name)) || '|' || LOWER(TRIM(seed.form)) || '|' || LOWER(TRIM(seed.strength)),
  1
FROM seed
WHERE NOT EXISTS (
  SELECT 1 FROM poskestren_medicine existing
  WHERE existing.id = 'pos-med-' || printf('%03d', seed.ordinal)
     OR existing.normalized_key = LOWER(TRIM(seed.name)) || '|' || LOWER(TRIM(seed.form)) || '|' || LOWER(TRIM(seed.strength))
);

INSERT OR IGNORE INTO poskestren_search_fts(entity_type, entity_id, text_content)
SELECT 'MEDICINE', id, name || ' ' || COALESCE(form, '') || ' ' || COALESCE(strength, '')
FROM poskestren_medicine
WHERE id LIKE 'pos-med-%';

INSERT OR IGNORE INTO poskestren_medicine_location_stock(medicine_id, location_id, quantity_base)
SELECT id, 'pos-location-central', total_stock_base
FROM poskestren_medicine;
