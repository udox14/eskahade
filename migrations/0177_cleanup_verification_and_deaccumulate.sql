-- 0177_cleanup_verification_and_deaccumulate.sql
-- 1. Pembersihan data verifikasi pending atas persetujuan klien
UPDATE pelanggaran
SET status = 'cancelled',
    review_state = 'resolved',
    updated_at = datetime('now'),
    reason = 'Pembersihan data verifikasi atas persetujuan klien'
WHERE review_state = 'pending';

-- 2. De-akumulasi deskripsi sesi alfa pengajian & jamaah agar tampil bersih per sesi
DROP VIEW IF EXISTS discipline_incidents;
CREATE VIEW discipline_incidents AS
 SELECT 'umum:'||p.id id, p.id source_id, 'umum' source, p.santri_id, p.tanggal,
 p.created_at, p.jenis,
 p.deskripsi,
 p.master_id, p.foto_url, p.penindak_id, NULL sesi,
 CASE
   WHEN p.deskripsi LIKE 'Akumulasi Alfa Pengajian (% Sesi)%'
     THEN CAST(substr(p.deskripsi, length('Akumulasi Alfa Pengajian (')+1, instr(p.deskripsi, ' Sesi)') - length('Akumulasi Alfa Pengajian (') - 1) AS INTEGER)
   WHEN p.deskripsi LIKE 'Akumulasi Alfa Berjamaah (% Sesi)%'
     THEN CAST(substr(p.deskripsi, length('Akumulasi Alfa Berjamaah (')+1, instr(p.deskripsi, ' Sesi)') - length('Akumulasi Alfa Berjamaah (') - 1) AS INTEGER)
   ELSE 1
 END jumlah_kejadian,
 0 perlu_verifikasi, p.status
 FROM pelanggaran p WHERE p.jenis NOT IN ('ALFA_PENGAJIAN','ALFA_BERJAMAAH')
 UNION ALL
 SELECT 'sesi:'||e.id, p.id, 'umum', p.santri_id, e.tanggal, p.created_at, p.jenis,
 CASE
   WHEN p.deskripsi LIKE 'Akumulasi Alfa Pengajian (%' THEN 'Alfa Pengajian'
   WHEN p.deskripsi LIKE 'Akumulasi Alfa Berjamaah (%' THEN 'Alfa Berjamaah'
   ELSE p.deskripsi
 END deskripsi,
 p.master_id, p.foto_url, p.penindak_id, e.sesi, 1 jumlah_kejadian, 0 perlu_verifikasi,
 CASE WHEN p.status='cancelled' THEN 'cancelled' ELSE e.status END
 FROM pelanggaran_sessions e JOIN pelanggaran p ON p.id=e.pelanggaran_id
 WHERE p.review_state='resolved' OR EXISTS(SELECT 1 FROM pelanggaran_session_links l JOIN pelanggaran alias ON alias.id=l.pelanggaran_id WHERE l.session_id=e.id AND alias.review_state='resolved' AND alias.status='active')
 UNION ALL
 SELECT 'umum:'||p.id, p.id, 'umum', p.santri_id, NULL, p.created_at, p.jenis, p.deskripsi, p.master_id, p.foto_url, p.penindak_id, NULL, 0, 1, p.status
 FROM pelanggaran p WHERE p.jenis IN ('ALFA_PENGAJIAN','ALFA_BERJAMAAH') AND p.review_state='pending'
 UNION ALL
 SELECT 'pengajian:'||v.id, v.id, 'pengajian', v.santri_id, datetime(v.occurred_at,'+7 hours'),
 v.created_at, v.type_name, v.type_name||CASE WHEN v.note<>'' THEN '. '||v.note ELSE '' END, NULL, NULL, v.created_by, v.session, 1, 0, v.status
 FROM pengajian_violations v;
