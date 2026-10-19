-- SANDBOX ONLY. Explicit operator approval, frozen preflight and backup required.
-- Never use d1 migrations apply, never apply to production, never replay a partial stage.
SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM d1_migrations WHERE name='0194_sandbox_indexes_and_integrity.sql') THEN 'true' ELSE 'STOP_MIGRATION_ALREADY_RECORDED' END);

CREATE INDEX idx_absen_malam_tanggal_santri
  ON absen_malam_v2(tanggal, santri_id);

CREATE INDEX idx_absensi_pengajar_detail_sesi
  ON absensi_pengajar_detail(sesi_id, riwayat_pendidikan_id);

CREATE INDEX idx_absensi_pengajar_sesi_kelas
  ON absensi_pengajar_sesi(kelas_id, tanggal DESC, created_at DESC, id);

CREATE INDEX idx_absensi_pengajar_sesi_owner
  ON absensi_pengajar_sesi(created_by, kelas_id, tanggal DESC, created_at DESC);

CREATE INDEX idx_absensi_verif_periode_lookup ON absensi_verifikasi_periode(tanggal_mulai, tanggal_selesai, status);

CREATE INDEX idx_absensi_verif_periode_status ON absensi_verifikasi_periode(status, tanggal_mulai);

CREATE UNIQUE INDEX idx_asrama_pengurus_inti_unique_v2
    ON asrama_kepengurusan(asrama, jabatan_key)
    WHERE kamar IS NULL AND jabatan_key IN ('pembina_asrama')
  ;

CREATE UNIQUE INDEX idx_asrama_pengurus_pembina_kamar_unique
    ON asrama_kepengurusan(asrama, kamar)
    WHERE jabatan_key = 'pembina_kamar'
  ;

CREATE INDEX idx_biaya_settings_angkatan
  ON biaya_settings(tahun_angkatan);

CREATE INDEX idx_dashboard_activity_actor_date
  ON activity_log(actor_user_id, created_at DESC);

CREATE INDEX idx_dashboard_role_widgets_role_position
  ON dashboard_role_widgets(role, enabled, position);

CREATE INDEX idx_dashboard_user_shortcuts_user_position
  ON dashboard_user_shortcuts(user_id, position);

CREATE INDEX idx_discipline_link_session ON pelanggaran_session_links(session_id);

CREATE INDEX idx_discipline_revision_parent ON pelanggaran_revisions(pelanggaran_id,id);

CREATE INDEX idx_discipline_session_parent ON pelanggaran_sessions(pelanggaran_id);

CREATE INDEX idx_discipline_session_period ON pelanggaran_sessions(tanggal,status);

CREATE INDEX idx_hasil_tes_klasifikasi_tahun_ajaran
ON hasil_tes_klasifikasi(tahun_ajaran_id);

CREATE INDEX idx_mutasi_santri_date
  ON mutasi_asrama_log(santri_id, created_at DESC, id DESC);

CREATE INDEX idx_pembayaran_jenis_tahun
  ON pembayaran_tahunan(jenis_biaya, tahun_tagihan);

CREATE INDEX idx_pembayaran_santri_jenis_tahun
  ON pembayaran_tahunan(santri_id, jenis_biaya, tahun_tagihan);

CREATE INDEX idx_pembayaran_tahunan_santri ON pembayaran_tahunan(santri_id);

CREATE INDEX idx_pembayaran_tanggal
  ON pembayaran_tahunan(tanggal_bayar);

CREATE INDEX idx_penempatan_draft_kelas ON penempatan_draft(kelas_id);

CREATE INDEX idx_penempatan_draft_marhalah ON penempatan_draft(marhalah_target_id);

CREATE INDEX idx_pengajian_photo_expiry ON pengajian_violation_photos(state, expires_at);

CREATE INDEX idx_pengajian_revisions_incident ON pengajian_violation_revisions(violation_id, id);

CREATE UNIQUE INDEX idx_pengajian_type_name ON pengajian_violation_types(lower(trim(name)));

CREATE INDEX idx_pengajian_violations_actor ON pengajian_violations(created_by);

CREATE INDEX idx_pengajian_violations_date ON pengajian_violations(status, occurred_at DESC, id);

CREATE INDEX idx_pengajian_violations_santri_date ON pengajian_violations(santri_id, status, occurred_at DESC);

CREATE INDEX idx_pengajian_violations_type ON pengajian_violations(type_id, occurred_at);

CREATE INDEX idx_perizinan_active_window
  ON perizinan(santri_id, status, tgl_mulai, tgl_selesai_rencana);

CREATE INDEX idx_perizinan_status_santri
  ON perizinan(status, santri_id);

CREATE INDEX idx_portal_submission_santri ON portal_payment_submission(santri_id, status);

CREATE INDEX idx_portal_submission_status ON portal_payment_submission(kategori, status);

CREATE INDEX idx_pos_batch_fefo
  ON poskestren_medicine_batch(medicine_id, expires_on, remaining_quantity);

CREATE INDEX idx_pos_clinical_delivery ON poskestren_clinical_exam(delivery_status, examined_at, id);

CREATE INDEX idx_pos_clinical_exam_report
  ON poskestren_clinical_exam(examined_at, id);

CREATE INDEX idx_pos_clinical_observation ON poskestren_clinical_exam(observation_id, examined_at, id);

CREATE INDEX idx_pos_clinical_rx ON poskestren_clinical_prescription_item(exam_id);

CREATE INDEX idx_pos_compensation_effective
  ON poskestren_compensation_history(personnel_id, effective_from DESC);

CREATE INDEX idx_pos_diagnosis_active_name
  ON poskestren_diagnosis(is_active, name COLLATE NOCASE);

CREATE INDEX idx_pos_dorm_medicine_visit
  ON poskestren_dorm_visit_medicine(dorm_visit_id, created_at);

CREATE INDEX idx_pos_dorm_visit_patient
  ON poskestren_dorm_visit(patient_id, visited_at DESC, id DESC);

CREATE INDEX idx_pos_dorm_visit_period
  ON poskestren_dorm_visit(visited_at DESC, patient_id);

CREATE INDEX idx_pos_external_rx ON poskestren_prescription_external_item(prescription_id);

CREATE INDEX idx_pos_finance_category
  ON poskestren_finance_transaction(category_id, transaction_date, status);

CREATE INDEX idx_pos_finance_period
  ON poskestren_finance_transaction(transaction_date, transaction_type, status, account_id);

CREATE UNIQUE INDEX idx_pos_finance_source_unique
  ON poskestren_finance_transaction(source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL AND status = 'POSTED';

CREATE INDEX idx_pos_medicine_active_name
  ON poskestren_medicine(is_active, name COLLATE NOCASE);

CREATE INDEX idx_pos_medicine_issue_item_medicine
  ON poskestren_medicine_issue_item(medicine_id, issue_id);

CREATE INDEX idx_pos_medicine_issue_period
  ON poskestren_medicine_issue(issue_date DESC, recipient_type, source_location_id);

CREATE INDEX idx_pos_medicine_location_stock_location
  ON poskestren_medicine_location_stock(location_id, medicine_id);

CREATE INDEX idx_pos_medicine_normalized
  ON poskestren_medicine(normalized_key);

CREATE INDEX idx_pos_medicine_order_item_medicine
  ON poskestren_medicine_order_item(medicine_id, order_id);

CREATE INDEX idx_pos_medicine_order_period
  ON poskestren_medicine_order(plan_year, order_date DESC, status);

CREATE INDEX idx_pos_observation_medicine
  ON poskestren_observation_medicine(observation_id, administered_at DESC, id DESC);

CREATE UNIQUE INDEX idx_pos_observation_one_active
  ON poskestren_observation(patient_id)
  WHERE status = 'ACTIVE';

CREATE INDEX idx_pos_observation_patient
  ON poskestren_observation(patient_id, admitted_at DESC, id DESC);

CREATE INDEX idx_pos_observation_status_period
  ON poskestren_observation(status, admitted_at DESC, id DESC);

CREATE INDEX idx_pos_outside_asrama_period
  ON poskestren_outside_treatment(asrama_snapshot, treated_at DESC, id DESC);

CREATE INDEX idx_pos_outside_patient
  ON poskestren_outside_treatment(patient_id, treated_at DESC, id DESC);

CREATE INDEX idx_pos_outside_period
  ON poskestren_outside_treatment(treated_at DESC, id DESC);

CREATE INDEX idx_pos_outside_reference
  ON poskestren_outside_reference(reference_type, is_active, name COLLATE NOCASE);

CREATE UNIQUE INDEX idx_pos_practice_one_open
  ON poskestren_practice_session(personnel_id)
  WHERE status = 'OPEN';

CREATE INDEX idx_pos_practice_period
  ON poskestren_practice_session(session_date, personnel_id, status);

CREATE INDEX idx_pos_prescription_item
  ON poskestren_prescription_item(prescription_id, medicine_id);

CREATE INDEX idx_pos_preventive_participant
  ON poskestren_preventive_participant(program_id, attendance, santri_id);

CREATE INDEX idx_pos_preventive_period
  ON poskestren_preventive_program(program_date, status, type_id);

CREATE INDEX idx_pos_purchase_cursor
  ON poskestren_purchase(purchase_date DESC, created_at DESC, id DESC);

CREATE INDEX idx_pos_purchase_item_order
  ON poskestren_purchase_item(order_item_id);

CREATE INDEX idx_pos_purchase_item_purchase
  ON poskestren_purchase_item(purchase_id, medicine_id);

CREATE INDEX idx_pos_purchase_period
  ON poskestren_purchase(purchase_date, status, payment_status);

CREATE INDEX idx_pos_stock_location_active
  ON poskestren_stock_location(is_active, location_type, name COLLATE NOCASE);

CREATE INDEX idx_pos_stock_movement_cursor
  ON poskestren_stock_movement(movement_date DESC, created_at DESC, id DESC);

CREATE INDEX idx_pos_stock_movement_location_period
  ON poskestren_stock_movement(location_id, movement_date, medicine_id);

CREATE INDEX idx_pos_stock_movement_medicine_period
  ON poskestren_stock_movement(medicine_id, movement_date, movement_type);

CREATE INDEX idx_pos_stock_movement_period
  ON poskestren_stock_movement(movement_date, medicine_id, movement_type);

CREATE INDEX idx_pos_stock_movement_reference
  ON poskestren_stock_movement(reference_type, reference_id);

CREATE UNIQUE INDEX idx_pos_stock_reference_unique
  ON poskestren_stock_movement(reference_type, reference_id, medicine_id, movement_type)
  WHERE reference_type IN (
    'PRESCRIPTION_ITEM',
    'PREVENTIVE_MEDICINE',
    'DORM_MEDICINE',
    'OBSERVATION_MEDICINE',
    'VISIT_REVISION',
    'PURCHASE_ITEM',
    'MANUAL_ADJUSTMENT',
    'SAMPLE_CLEANUP'
  )
  AND reference_id IS NOT NULL;

CREATE INDEX idx_pos_stock_transfer_item_medicine
  ON poskestren_stock_transfer_item(medicine_id, transfer_id);

CREATE INDEX idx_pos_stock_transfer_period
  ON poskestren_stock_transfer(transfer_date DESC, source_location_id, destination_location_id);

CREATE INDEX idx_pos_stocktake_period
  ON poskestren_stocktake(opname_date DESC, location_id);

CREATE INDEX idx_pos_visit_diagnosis_period
  ON poskestren_visit(diagnosis_id, queue_date, status);

CREATE INDEX idx_pos_visit_patient
  ON poskestren_visit(patient_id, queue_date DESC);

CREATE INDEX idx_pos_visit_personnel_period
  ON poskestren_visit(personnel_id, queue_date, status);

CREATE INDEX idx_pos_visit_queue
  ON poskestren_visit(queue_date, status, queue_number);

CREATE INDEX idx_psb_receipt_santri ON psb_payment_receipt(santri_id);

CREATE INDEX idx_riwayat_kelas_status
  ON riwayat_pendidikan(kelas_id, status_riwayat);

CREATE INDEX idx_riwayat_santri_status
  ON riwayat_pendidikan(santri_id, status_riwayat);

CREATE INDEX idx_riwayat_surat_jenis_created
  ON riwayat_surat(jenis_surat, created_at);

CREATE INDEX idx_santri_disease_population
  ON santri(status_global, tanggal_masuk, tanggal_keluar, jenis_kelamin, asrama);

CREATE INDEX idx_santri_nonaktif_period
  ON santri_nonaktif_log(santri_id, tanggal_mulai, tanggal_aktif_aktual);

CREATE INDEX idx_santri_pembebasan_biaya_kind_active
  ON santri_pembebasan_biaya(service_kind, is_active);

CREATE INDEX idx_santri_pembebasan_biaya_santri
  ON santri_pembebasan_biaya(santri_id, service_kind, is_active);

CREATE UNIQUE INDEX idx_santri_poskestren_code
  ON santri(poskestren_code);

CREATE INDEX idx_santri_psb_asrama_created
  ON santri(status_global, asrama, created_at);

CREATE INDEX idx_santri_psb_asrama_kategori
  ON santri(status_global, asrama, kategori_santri);

CREATE INDEX idx_santri_status_created ON santri(status_global, created_at);

CREATE INDEX idx_santri_status_keluar ON santri(status_global, tanggal_keluar);

CREATE INDEX idx_spp_bulan_tahun     ON spp_log(bulan, tahun);

CREATE INDEX idx_spp_log_santri_tahun_bulan ON spp_log(santri_id, tahun, bulan);

CREATE INDEX idx_spp_log_tujuan_period
  ON spp_log(tujuan_setoran, tahun, bulan);

CREATE INDEX idx_supervisi_owner ON supervisi_wawancara(owner_id,kegiatan_id,status);

CREATE INDEX idx_tabungan_log_auto_run ON tabungan_log(source, run_date, santri_id);

CREATE INDEX idx_tabungan_log_dompet_created ON tabungan_log(dompet, created_at);

CREATE INDEX idx_tabungan_santri_created
  ON tabungan_log(santri_id, created_at);

CREATE INDEX idx_tk_petugas_event ON tes_klasifikasi_ruangan_petugas(event_id);

CREATE INDEX idx_tk_plotting_event ON tes_klasifikasi_plotting(event_id);

CREATE INDEX idx_tk_plotting_santri ON tes_klasifikasi_plotting(santri_id);

CREATE INDEX idx_tk_ruangan_event ON tes_klasifikasi_ruangan(event_id);

CREATE INDEX idx_tk_rule_event ON tes_klasifikasi_plotting_rule(event_id);

CREATE INDEX idx_tk_sesi_event ON tes_klasifikasi_sesi(event_id);

CREATE INDEX idx_uang_jajan_auto_rule_active ON uang_jajan_auto_rule(is_active, scope_type, asrama, kamar, santri_id);

CREATE INDEX idx_uang_jajan_auto_setting_active
  ON uang_jajan_auto_setting(mode, is_active, jam);

CREATE INDEX idx_uang_jajan_auto_skip_date ON uang_jajan_auto_skip(skip_date, santri_id);

CREATE INDEX idx_uang_jajan_auto_skip_permanent
  ON uang_jajan_auto_skip(santri_id, skip_date, is_active);

CREATE INDEX idx_upk_antrian_status_unit_tanggal
  ON upk_antrian(status, unit, tanggal);

CREATE INDEX idx_users_poskestren_jabatan
  ON users(poskestren_jabatan);

CREATE UNIQUE INDEX uq_portal_submission_pending
  ON portal_payment_submission(santri_id, kategori)
  WHERE status = 'menunggu_konfirmasi';

CREATE UNIQUE INDEX uq_spp_setoran_unit_period_tujuan
  ON spp_setoran(unit_setor, bulan, tahun, tujuan_setoran);

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
 SELECT * FROM complete_attendance UNION ALL SELECT * FROM complete_details UNION ALL SELECT * FROM complete_final_refs;

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

CREATE TRIGGER discipline_record_revision AFTER UPDATE ON pelanggaran BEGIN
 INSERT INTO pelanggaran_revisions(pelanggaran_id,actor_id,changed_at,reason,before_json,after_json)
 VALUES(NEW.id,NEW.updated_by,COALESCE(NEW.updated_at,datetime('now')),NEW.reason,
 json_object('status',OLD.status,'review_state',OLD.review_state,'version',OLD.version),
 json_object('status',NEW.status,'review_state',NEW.review_state,'version',NEW.version));
END;

CREATE TRIGGER discipline_session_create AFTER INSERT ON pelanggaran_sessions BEGIN
 INSERT INTO pelanggaran_revisions(pelanggaran_id,session_id,actor_id,changed_at,reason,after_json)
 VALUES(NEW.pelanggaran_id,NEW.id,NEW.updated_by,NEW.updated_at,NEW.reason,json_object('tanggal',NEW.tanggal,'sesi',NEW.sesi,'source_ref',NEW.source_ref,'status',NEW.status));
END;

CREATE TRIGGER discipline_session_owner_insert BEFORE INSERT ON pelanggaran_sessions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM pelanggaran p WHERE p.id=NEW.pelanggaran_id AND p.santri_id=NEW.santri_id AND p.jenis=CASE NEW.source WHEN 'pengajian' THEN 'ALFA_PENGAJIAN' ELSE 'ALFA_BERJAMAAH' END) THEN RAISE(ABORT,'Incident owner mismatch') END;
END;

CREATE TRIGGER discipline_session_owner_update BEFORE UPDATE ON pelanggaran_sessions BEGIN
 SELECT CASE WHEN NEW.pelanggaran_id<>OLD.pelanggaran_id OR NEW.santri_id<>OLD.santri_id OR NEW.source<>OLD.source THEN RAISE(ABORT,'Incident identity is immutable') END;
END;

CREATE TRIGGER discipline_session_update AFTER UPDATE ON pelanggaran_sessions BEGIN
 INSERT INTO pelanggaran_revisions(pelanggaran_id,session_id,actor_id,changed_at,reason,before_json,after_json)
 VALUES(NEW.pelanggaran_id,NEW.id,NEW.updated_by,NEW.updated_at,NEW.reason,
 json_object('tanggal',OLD.tanggal,'sesi',OLD.sesi,'status',OLD.status,'version',OLD.version),
 json_object('tanggal',NEW.tanggal,'sesi',NEW.sesi,'status',NEW.status,'version',NEW.version));
END;

CREATE TRIGGER pengajian_type_update_audit AFTER UPDATE ON pengajian_violation_types
BEGIN
 INSERT INTO pengajian_violation_revisions(type_id,actor_id,changed_at,action,reason,before_json,after_json)
 VALUES(NEW.id,NEW.updated_by,NEW.updated_at,'type_update','Pengaturan jenis pelanggaran',
 json_object('name',OLD.name,'description',OLD.description,'position',OLD.position,'active',OLD.active,'version',OLD.version),
 json_object('name',NEW.name,'description',NEW.description,'position',NEW.position,'active',NEW.active,'version',NEW.version));
END;

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

CREATE TRIGGER supervisi_delete_request_guard BEFORE UPDATE OF authorized ON supervisi_delete_request
 WHEN NEW.authorized=1 BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM supervisi_kegiatan WHERE id=NEW.kegiatan_id AND revision=NEW.revision)
 THEN RAISE(ABORT,'Kegiatan berubah. Ulangi konfirmasi penghapusan.') END;
 END;

CREATE TRIGGER supervisi_history_no_delete BEFORE DELETE ON supervisi_history
 WHEN NOT EXISTS(SELECT 1 FROM supervisi_delete_request r JOIN supervisi_wawancara w ON w.kegiatan_id=r.kegiatan_id WHERE w.id=OLD.wawancara_id AND r.authorized=1)
 BEGIN SELECT RAISE(ABORT,'Riwayat tidak dapat dihapus terpisah'); END;

CREATE TRIGGER supervisi_history_no_update BEFORE UPDATE ON supervisi_history BEGIN SELECT RAISE(ABORT,'Riwayat tidak dapat diubah'); END;

CREATE TRIGGER supervisi_insert_audit AFTER INSERT ON supervisi_wawancara BEGIN
 INSERT INTO supervisi_history(wawancara_id,operation_id,actor_id,action,revision,after_json)
 VALUES(NEW.id,NEW.operation_id,NEW.actor_id,'start',NEW.revision,json_object('answers',json(NEW.answers_json),'identity',json(NEW.identity_json),'tanggal',NEW.tanggal,'status',NEW.status));
 END;

CREATE TRIGGER supervisi_kegiatan_delete_guard BEFORE DELETE ON supervisi_kegiatan
 WHEN NOT EXISTS(SELECT 1 FROM supervisi_delete_request WHERE kegiatan_id=OLD.id AND revision=OLD.revision AND authorized=1)
 BEGIN SELECT RAISE(ABORT,'Kegiatan memerlukan konfirmasi penghapusan'); END;

CREATE TRIGGER supervisi_kegiatan_insert_audit AFTER INSERT ON supervisi_kegiatan BEGIN
 INSERT INTO supervisi_kegiatan_history(kegiatan_id,actor_id,after_status) VALUES(NEW.id,NEW.actor_id,NEW.status); END;

CREATE TRIGGER supervisi_kegiatan_update_audit AFTER UPDATE ON supervisi_kegiatan BEGIN
 INSERT INTO supervisi_kegiatan_history(kegiatan_id,actor_id,before_status,after_status,reason) VALUES(NEW.id,NEW.actor_id,OLD.status,NEW.status,NEW.reason); END;

CREATE TRIGGER supervisi_no_delete BEFORE DELETE ON supervisi_wawancara
 WHEN NOT EXISTS(SELECT 1 FROM supervisi_delete_request WHERE kegiatan_id=OLD.kegiatan_id AND authorized=1)
 BEGIN SELECT RAISE(ABORT,'Hapus melalui kegiatan dengan konfirmasi admin'); END;

CREATE TRIGGER supervisi_start_guard BEFORE INSERT ON supervisi_wawancara
 WHEN (SELECT status FROM supervisi_kegiatan WHERE id=NEW.kegiatan_id) <> 'terbuka'
 BEGIN SELECT RAISE(ABORT,'Kegiatan tidak terbuka'); END;

CREATE TRIGGER supervisi_target_delete_guard BEFORE DELETE ON supervisi_target
 WHEN (SELECT status FROM supervisi_kegiatan WHERE id=OLD.kegiatan_id)<>'persiapan'
 AND NOT EXISTS(SELECT 1 FROM supervisi_delete_request WHERE kegiatan_id=OLD.kegiatan_id AND authorized=1)
 BEGIN SELECT RAISE(ABORT,'Target kegiatan sudah dibekukan'); END;

CREATE TRIGGER supervisi_target_insert_guard BEFORE INSERT ON supervisi_target
 WHEN (SELECT status FROM supervisi_kegiatan WHERE id=NEW.kegiatan_id) <> 'persiapan'
 BEGIN SELECT RAISE(ABORT,'Target kegiatan sudah dibekukan'); END;

CREATE TRIGGER supervisi_target_update_guard BEFORE UPDATE ON supervisi_target
 BEGIN SELECT RAISE(ABORT,'Target tidak dapat diubah'); END;

CREATE TRIGGER supervisi_update_audit AFTER UPDATE ON supervisi_wawancara BEGIN
 INSERT INTO supervisi_history(wawancara_id,operation_id,actor_id,action,reason,revision,before_json,after_json)
 VALUES(NEW.id,NEW.operation_id,NEW.actor_id,NEW.action,NEW.reason,NEW.revision,
 json_object('answers',json(OLD.answers_json),'identity',json(OLD.identity_json),'guru_id',OLD.guru_id,'tanggal',OLD.tanggal,'status',OLD.status),
 json_object('answers',json(NEW.answers_json),'identity',json(NEW.identity_json),'guru_id',NEW.guru_id,'tanggal',NEW.tanggal,'status',NEW.status));
 END;

CREATE TRIGGER supervisi_write_guard BEFORE UPDATE ON supervisi_wawancara
 BEGIN
 SELECT CASE WHEN (SELECT status FROM supervisi_kegiatan WHERE id=OLD.kegiatan_id) <> 'terbuka' THEN RAISE(ABORT,'Kegiatan tidak terbuka') END;
 SELECT CASE WHEN NEW.revision <> OLD.revision+1 THEN RAISE(ABORT,'Revisi tidak valid') END;
 SELECT CASE WHEN OLD.status='selesai' AND (NEW.action<>'reopen' OR NEW.status<>'draft' OR length(trim(COALESCE(NEW.reason,'')))=0 OR NEW.answers_json<>OLD.answers_json) THEN RAISE(ABORT,'Hasil terkunci') END;
 SELECT CASE WHEN NEW.status='selesai' AND NEW.completed_count<>53 THEN RAISE(ABORT,'Jawaban belum lengkap') END;
 SELECT CASE WHEN NEW.kegiatan_id<>OLD.kegiatan_id OR NEW.owner_id<>OLD.owner_id THEN RAISE(ABORT,'Identitas terkunci') END;
 SELECT CASE WHEN (NEW.identity_json<>OLD.identity_json OR NEW.guru_id<>OLD.guru_id) AND (OLD.status<>'draft' OR NEW.action<>'identity' OR EXISTS(SELECT 1 FROM json_each(OLD.answers_json))) THEN RAISE(ABORT,'Identitas terkunci') END;
 SELECT CASE WHEN NEW.action='identity' AND (NEW.answers_json<>OLD.answers_json OR NEW.status<>'draft') THEN RAISE(ABORT,'Koreksi identitas tidak boleh mengubah jawaban') END;
 END;

CREATE TRIGGER trg_pos_one_active_observation BEFORE INSERT ON poskestren_observation
WHEN NEW.status='ACTIVE' AND EXISTS(SELECT 1 FROM poskestren_observation WHERE patient_id=NEW.patient_id AND status='ACTIVE')
BEGIN SELECT RAISE(ABORT,'Santri masih memiliki observasi aktif.'); END;

CREATE TRIGGER trg_pos_personnel_delete_user
AFTER DELETE ON poskestren_personnel
WHEN OLD.user_id IS NOT NULL
BEGIN
  UPDATE users
  SET roles = COALESCE((
        SELECT json_group_array(value)
        FROM json_each(COALESCE(users.roles, '[]'))
        WHERE value <> 'poskestren'
          AND value NOT LIKE 'poskestren:%'
      ), '[]'),
      poskestren_jabatan = NULL,
      updated_at = datetime('now')
  WHERE id = OLD.user_id;
END;

CREATE TRIGGER trg_pos_personnel_unlink_user
AFTER UPDATE OF user_id ON poskestren_personnel
WHEN OLD.user_id IS NOT NULL
 AND (NEW.user_id IS NULL OR NEW.user_id <> OLD.user_id)
BEGIN
  UPDATE users
  SET roles = COALESCE((
        SELECT json_group_array(value)
        FROM json_each(COALESCE(users.roles, '[]'))
        WHERE value <> 'poskestren'
          AND value NOT LIKE 'poskestren:%'
      ), '[]'),
      poskestren_jabatan = NULL,
      updated_at = datetime('now')
  WHERE id = OLD.user_id;
END;

CREATE TRIGGER trg_poskestren_permanent_profile AFTER INSERT ON santri BEGIN
 INSERT OR IGNORE INTO poskestren_patient(id, santri_id, medical_record_no)
 VALUES ('profile-' || NEW.id, NEW.id, COALESCE(NULLIF(NEW.poskestren_code,''), 'RM-' || NEW.id));
END;

CREATE TRIGGER trg_poskestren_profile_code AFTER UPDATE OF poskestren_code ON santri
WHEN NEW.poskestren_code IS NOT NULL AND NEW.poskestren_code <> '' BEGIN
 UPDATE poskestren_patient SET medical_record_no = NEW.poskestren_code
 WHERE santri_id = NEW.id AND medical_record_no = 'RM-' || NEW.id;
END;

CREATE TRIGGER trg_santri_poskestren_code
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

DROP INDEX "uq_spp_setoran_asrama_bulan_tahun";

DROP INDEX "uq_spp_setoran_unit_setor_bulan_tahun";

CREATE TRIGGER trg_sandbox_recovery_wallet_arithmetic BEFORE INSERT ON finance_wallet_ledger BEGIN
 SELECT CASE WHEN NEW.balance_before+(CASE NEW.direction WHEN 'IN' THEN NEW.amount ELSE -NEW.amount END)<0 THEN RAISE(ABORT,'OVERDRAW_DETECTED') END;
 SELECT CASE WHEN NEW.balance_after!=NEW.balance_before+(CASE NEW.direction WHEN 'IN' THEN NEW.amount ELSE -NEW.amount END) THEN RAISE(ABORT,'INVALID_BALANCE_AFTER') END; END;

CREATE TRIGGER trg_sandbox_recovery_quarantine_dist_insert BEFORE INSERT ON finance_distribution_items
 WHEN EXISTS(SELECT 1 FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id WHERE a.id=NEW.allocation_id AND (SELECT COALESCE(SUM(amount),0) FROM finance_allocations x WHERE x.payment_id=p.id)>p.gross_amount)
 BEGIN SELECT RAISE(ABORT,'INTERNAL_CONSERVATION_CASE_OPEN: allocation exceeds recorded payment'); END;

CREATE TRIGGER trg_sandbox_recovery_quarantine_dist_update BEFORE UPDATE OF distribution_id,allocation_id,amount ON finance_distribution_items
 WHEN EXISTS(SELECT 1 FROM finance_allocations a JOIN finance_payments p ON p.id=a.payment_id WHERE a.id=NEW.allocation_id AND (SELECT COALESCE(SUM(amount),0) FROM finance_allocations x WHERE x.payment_id=p.id)>p.gross_amount)
 BEGIN SELECT RAISE(ABORT,'INTERNAL_CONSERVATION_CASE_OPEN: allocation exceeds recorded payment'); END;

INSERT INTO d1_migrations(name) VALUES('0194_sandbox_indexes_and_integrity.sql');
