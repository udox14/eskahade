import subprocess
import sys
import time
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path("c:/DATA/eskahade")
STEP_FILE = ROOT / "temp_migration_step.sql"

STATEMENTS = [
    # 1. Triggers
    ("""DROP TRIGGER IF EXISTS discipline_session_owner_insert;
CREATE TRIGGER discipline_session_owner_insert BEFORE INSERT ON pelanggaran_sessions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM pelanggaran p WHERE p.id=NEW.pelanggaran_id AND p.santri_id=NEW.santri_id AND p.jenis=CASE NEW.source WHEN 'pengajian' THEN 'ALFA_PENGAJIAN' ELSE 'ALFA_BERJAMAAH' END) THEN RAISE(ABORT,'Incident owner mismatch') END;
END;""", "Trigger: discipline_session_owner_insert"),

    ("""DROP TRIGGER IF EXISTS discipline_session_owner_update;
CREATE TRIGGER discipline_session_owner_update BEFORE UPDATE ON pelanggaran_sessions BEGIN
 SELECT CASE WHEN NEW.pelanggaran_id<>OLD.pelanggaran_id OR NEW.santri_id<>OLD.santri_id OR NEW.source<>OLD.source THEN RAISE(ABORT,'Incident identity is immutable') END;
END;""", "Trigger: discipline_session_owner_update"),

    ("""DROP TRIGGER IF EXISTS discipline_record_revision;
CREATE TRIGGER discipline_record_revision AFTER UPDATE ON pelanggaran BEGIN
 INSERT INTO pelanggaran_revisions(pelanggaran_id,actor_id,changed_at,reason,before_json,after_json)
 VALUES(NEW.id,NEW.updated_by,COALESCE(NEW.updated_at,datetime('now')),NEW.reason,
 json_object('status',OLD.status,'review_state',OLD.review_state,'version',OLD.version),
 json_object('status',NEW.status,'review_state',NEW.review_state,'version',NEW.version));
END;""", "Trigger: discipline_record_revision"),

    ("""DROP TRIGGER IF EXISTS discipline_session_create;
CREATE TRIGGER discipline_session_create AFTER INSERT ON pelanggaran_sessions BEGIN
 INSERT INTO pelanggaran_revisions(pelanggaran_id,session_id,actor_id,changed_at,reason,after_json)
 VALUES(NEW.pelanggaran_id,NEW.id,NEW.updated_by,NEW.updated_at,NEW.reason,json_object('tanggal',NEW.tanggal,'sesi',NEW.sesi,'source_ref',NEW.source_ref,'status',NEW.status));
END;""", "Trigger: discipline_session_create"),

    ("""DROP TRIGGER IF EXISTS discipline_session_update;
CREATE TRIGGER discipline_session_update AFTER UPDATE ON pelanggaran_sessions BEGIN
 INSERT INTO pelanggaran_revisions(pelanggaran_id,session_id,actor_id,changed_at,reason,before_json,after_json)
 VALUES(NEW.pelanggaran_id,NEW.id,NEW.updated_by,NEW.updated_at,NEW.reason,
 json_object('tanggal',OLD.tanggal,'sesi',OLD.sesi,'status',OLD.status,'version',OLD.version),
 json_object('tanggal',NEW.tanggal,'sesi',NEW.sesi,'status',NEW.status,'version',NEW.version));
END;""", "Trigger: discipline_session_update"),

    # 2. Reset historical alfa review state to pending before backfilling
    ("""UPDATE pelanggaran SET review_state='pending',reason='Migrasi: bukti sesi perlu diverifikasi' WHERE jenis IN ('ALFA_PENGAJIAN','ALFA_BERJAMAAH');""",
     "Update pelanggaran initial pending state"),

    # 3. Create session links table and index
    ("""CREATE TABLE IF NOT EXISTS pelanggaran_session_links (
 pelanggaran_id TEXT NOT NULL REFERENCES pelanggaran(id),
 session_id TEXT NOT NULL REFERENCES pelanggaran_sessions(id),
 PRIMARY KEY(pelanggaran_id,session_id)
);""", "Create table pelanggaran_session_links"),

    ("""CREATE INDEX IF NOT EXISTS idx_discipline_link_session ON pelanggaran_session_links(session_id);""",
     "Create index idx_discipline_link_session"),

    # 4. Create backfill view
    ("""DROP VIEW IF EXISTS discipline_backfill_evidence;
CREATE VIEW discipline_backfill_evidence AS
 WITH tokens AS (
  SELECT p.id,p.santri_id,j.value token
  FROM pelanggaran p,json_each('['||replace(json_quote(substr(p.id,length('absensi-verifikasi:'||p.santri_id||':')+1)),'|','","')||']') j
  WHERE substr(p.id, 1, length('absensi-verifikasi:' || p.santri_id || ':')) = ('absensi-verifikasi:' || p.santri_id || ':') AND p.jenis='ALFA_PENGAJIAN'
 ), token_counts AS (
  SELECT id, count(*) as token_cnt FROM tokens GROUP BY id
 ), attendance AS (
  SELECT t.id,t.santri_id,'pengajian' source,a.tanggal,substr(token,instr(token,':')+1) sesi,token ref,'active' status,
  count(*) OVER (PARTITION BY t.id) as att_cnt
  FROM tokens t JOIN absensi_harian a ON a.id=substr(token,1,instr(token,':')-1)
  JOIN riwayat_pendidikan rp ON rp.id=a.riwayat_pendidikan_id AND rp.santri_id=t.santri_id
  WHERE substr(token,instr(token,':')+1) IN ('shubuh','ashar','maghrib')
  AND date(a.tanggal,'+0 days') IS a.tanggal
 ), complete_attendance AS (
  SELECT a.id,a.santri_id,a.source,a.tanggal,a.sesi,a.ref,a.status
  FROM attendance a
  JOIN token_counts tc ON tc.id=a.id
  WHERE a.att_cnt=tc.token_cnt
 ), detail_tokens AS (
  SELECT p.id,p.santri_id,p.jenis,trim(j.value) token,p.deskripsi
  FROM pelanggaran p,json_each('['||replace(json_quote(trim(substr(p.deskripsi,instr(p.deskripsi,'Detail:')+7))),',','","')||']') j
  WHERE p.jenis IN ('ALFA_PENGAJIAN','ALFA_BERJAMAAH') AND instr(p.deskripsi,'Detail:')>0
  AND p.id NOT LIKE 'absensi-verifikasi:%'
 ), detail_token_counts AS (
  SELECT id, count(*) as dt_cnt FROM detail_tokens GROUP BY id
 ), detail_mismatches AS (
  SELECT t.id FROM detail_tokens t
  JOIN detail_token_counts dtc ON dtc.id=t.id
  WHERE t.deskripsi LIKE 'Akumulasi Alfa Pengajian (% Sesi)%'
  AND CAST(substr(t.deskripsi,length('Akumulasi Alfa Pengajian (')+1,instr(t.deskripsi,' Sesi)')-length('Akumulasi Alfa Pengajian (')-1) AS INTEGER) <> dtc.dt_cnt
 ), details AS (
  SELECT dt.id,dt.santri_id,CASE dt.jenis WHEN 'ALFA_PENGAJIAN' THEN 'pengajian' ELSE 'berjamaah' END source,
  substr(dt.token,1,10) tanggal,substr(dt.token,13,instr(dt.token,')')-13) sesi,dt.token ref,'active' status,
  count(*) OVER (PARTITION BY dt.id) as det_cnt
  FROM detail_tokens dt
  WHERE date(substr(dt.token,1,10),'+0 days') IS substr(dt.token,1,10)
  AND substr(dt.token,11,2)=' (' AND substr(dt.token,-1)=')'
  AND substr(dt.token,13,instr(dt.token,')')-13) IN ('shubuh','dzuhur','ashar','maghrib','isya')
  AND (dt.jenis='ALFA_BERJAMAAH' OR substr(dt.token,13,instr(dt.token,')')-13) IN ('shubuh','ashar','maghrib'))
 ), complete_details AS (
  SELECT d.id,d.santri_id,d.source,d.tanggal,d.sesi,d.ref,d.status
  FROM details d
  JOIN detail_token_counts dtc ON dtc.id=d.id
  WHERE d.det_cnt=dtc.dt_cnt
  AND NOT EXISTS(SELECT 1 FROM detail_mismatches dm WHERE dm.id=d.id)
  AND NOT EXISTS(SELECT 1 FROM verifikasi_panggilan_vonis v WHERE v.pelanggaran_id=d.id)
 ), vonis_counts AS (
  SELECT pelanggaran_id, count(*) as v_cnt FROM verifikasi_panggilan_vonis GROUP BY pelanggaran_id
 ), final_refs AS (
  SELECT v.pelanggaran_id id,v.santri_id,v.source,v.tanggal,v.sesi,v.id ref,
  CASE WHEN v.status_final IN ('ALFA','MANGKIR') THEN 'active' ELSE 'cancelled' END status,
  count(*) OVER (PARTITION BY v.pelanggaran_id) as fr_cnt
  FROM verifikasi_panggilan_vonis v JOIN pelanggaran p ON p.id=v.pelanggaran_id AND p.santri_id=v.santri_id
  WHERE v.source IN ('pengajian','berjamaah') AND v.sesi IN ('shubuh','dzuhur','ashar','maghrib','isya')
  AND (v.source='berjamaah' OR v.sesi IN ('shubuh','ashar','maghrib'))
  AND date(v.tanggal,'+0 days') IS v.tanggal
  AND p.jenis=CASE v.source WHEN 'pengajian' THEN 'ALFA_PENGAJIAN' ELSE 'ALFA_BERJAMAAH' END
 ), complete_final_refs AS (
  SELECT f.id,f.santri_id,f.source,f.tanggal,f.sesi,f.ref,f.status
  FROM final_refs f
  JOIN vonis_counts vc ON vc.pelanggaran_id=f.id
  WHERE f.fr_cnt=vc.v_cnt
 )
 SELECT * FROM complete_attendance UNION ALL SELECT * FROM complete_details UNION ALL SELECT * FROM complete_final_refs;""",
     "Create view discipline_backfill_evidence"),

    # 5. Populate pelanggaran_sessions from backfill evidence
    ("""INSERT OR IGNORE INTO pelanggaran_sessions(id,pelanggaran_id,santri_id,source,tanggal,sesi,source_ref,status,updated_at,reason)
 SELECT 'alfa:'||source||':'||santri_id||':'||tanggal||':'||sesi,id,santri_id,source,tanggal,sesi,ref,status,datetime('now'),'Backfill bukti sesi'
 FROM discipline_backfill_evidence ORDER BY id,ref;""",
     "Insert into pelanggaran_sessions"),

    # 6. Populate pelanggaran_session_links
    ("""INSERT OR IGNORE INTO pelanggaran_session_links(pelanggaran_id,session_id)
 SELECT id,'alfa:'||source||':'||santri_id||':'||tanggal||':'||sesi FROM discipline_backfill_evidence;""",
     "Insert into pelanggaran_session_links"),

    # 7. Update pelanggaran to resolved
    ("""UPDATE pelanggaran SET review_state='resolved',reason='Backfill bukti sesi lengkap' WHERE id IN (SELECT pelanggaran_id FROM pelanggaran_session_links);""",
     "Update pelanggaran to resolved"),

    # 8. Re-mark conflicting evidence to pending
    ("""UPDATE pelanggaran SET review_state='pending',reason='Bukti atau vonis sesi bertentangan'
 WHERE id IN (
 SELECT a.id FROM discipline_backfill_evidence a JOIN discipline_backfill_evidence b
 ON a.santri_id=b.santri_id AND a.source=b.source AND a.tanggal=b.tanggal AND a.sesi=b.sesi AND a.status<>b.status
 );""", "Update conflicting evidence to pending"),

    # 9. Create discipline_incidents view
    ("""DROP VIEW IF EXISTS discipline_incidents;
CREATE VIEW discipline_incidents AS
 SELECT 'umum:'||p.id id,p.id source_id,'umum' source,p.santri_id,p.tanggal,
 p.created_at,p.jenis,p.deskripsi,p.master_id,p.foto_url,p.penindak_id,NULL sesi,1 jumlah_kejadian,0 perlu_verifikasi,p.status
 FROM pelanggaran p WHERE p.jenis NOT IN ('ALFA_PENGAJIAN','ALFA_BERJAMAAH')
 UNION ALL
 SELECT 'sesi:'||e.id,p.id,'umum',p.santri_id,e.tanggal,p.created_at,p.jenis,
 p.deskripsi,p.master_id,p.foto_url,p.penindak_id,e.sesi,1,0,
 CASE WHEN p.status='cancelled' THEN 'cancelled' ELSE e.status END
 FROM pelanggaran_sessions e JOIN pelanggaran p ON p.id=e.pelanggaran_id WHERE p.review_state='resolved' OR EXISTS(SELECT 1 FROM pelanggaran_session_links l JOIN pelanggaran alias ON alias.id=l.pelanggaran_id WHERE l.session_id=e.id AND alias.review_state='resolved' AND alias.status='active')
 UNION ALL
 SELECT 'umum:'||p.id,p.id,'umum',p.santri_id,NULL,p.created_at,p.jenis,p.deskripsi,p.master_id,p.foto_url,p.penindak_id,NULL,0,1,p.status
 FROM pelanggaran p WHERE p.jenis IN ('ALFA_PENGAJIAN','ALFA_BERJAMAAH') AND p.review_state='pending'
 UNION ALL
 SELECT 'pengajian:'||v.id,v.id,'pengajian',v.santri_id,datetime(v.occurred_at,'+7 hours'),
 v.created_at,v.type_name,v.type_name||CASE WHEN v.note<>'' THEN '. '||v.note ELSE '' END,NULL,NULL,v.created_by,v.session,1,0,v.status
 FROM pengajian_violations v;""",
     "Create view discipline_incidents")
]


def execute_step(sql: str, desc: str, step_num: int, total: int):
    print(f"\n[{step_num}/{total}] {desc}...")
    STEP_FILE.write_text(sql.strip(), encoding="utf-8")
    cmd = [
        "npx.cmd",
        "wrangler",
        "d1",
        "execute",
        "eskahade-db",
        "--remote",
        f"--file={STEP_FILE}",
        "--json"
    ]
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        start = time.time()
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=str(ROOT)
        )
        elapsed = time.time() - start
        if res.returncode == 0 or "success\": true" in res.stdout or "Executed" in res.stdout:
            print(f"  -> SUCCESS ({elapsed:.2f}s)")
            return True
        else:
            print(f"  -> Attempt {attempt} failed ({elapsed:.2f}s): {(res.stderr or res.stdout)[:300]}")
            time.sleep(2)
    print(f"FAILED to execute: {desc}")
    return False


def main():
    total = len(STATEMENTS)
    print(f"Applying {total} migration steps to eskahade-db...")
    for i, (sql, desc) in enumerate(STATEMENTS, 1):
        if not execute_step(sql, desc, i, total):
            print(f"\nMigration halted at step {i}: {desc}")
            sys.exit(1)
    
    if STEP_FILE.exists():
        STEP_FILE.unlink()
    print("\nAll migration 0176 steps completed successfully!")


if __name__ == "__main__":
    main()
